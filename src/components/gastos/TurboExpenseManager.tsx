import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Zap, 
  TableProperties, 
  Wand2, 
  PlusCircle,
  Save,
  Coffee,
  Lightbulb,
  Droplets,
  PackageSearch,
  ShoppingCart,
  Calendar,
  Mic,
  MicOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { generateUUID } from '@/lib/safe-utils';
import { CAJAS_POS_DEFAULT } from '@/lib/boveda-pos-sync';
import { getBovedas, type Boveda } from '@/lib/boveda-store';
import { matchProductoEnCatalogo } from '@/lib/ocr-service';
import {
  inferirCategoriaGasto,
  planificarRecategorizacionGastos,
  extraerNombreProductoDeDescripcion,
  normalizarCategoriaGasto,
} from '@/lib/gasto-categoria-inferencia';
import {
  iniciarDictadoVoz,
  separarItemsDictadoFactura,
  parsearItemDictadoGasto,
  normalizarTranscriptDictado,
  limpiarDescripcionDictada,
  extraerCantidadMontoDescripcion,
} from '@/lib/dictado-voz';
import type { GastoCategoria, MetodoPago, Gasto, Proveedor, Producto, PrecioProveedor } from '@/types';
import { Trash2, Edit2, Tags } from 'lucide-react';

const cargarCatalogoCajas = (): {id: string, nombre: string}[] => {
  try {
    const raw = localStorage.getItem('dp_cajas_config');
    if (raw) {
      const lista = JSON.parse(raw);
      return lista.map((c: any) => ({ id: c.nombre, nombre: c.nombre }));
    }
  } catch (e) {}
  return [];
};

export interface TurboExpenseManagerProps {
  onSave: (data: { 
    descripcion: string; 
    monto: number; 
    categoria: GastoCategoria; 
    metodoPago: MetodoPago; 
    esIngreso: boolean;
    fecha?: string;
    proveedorId?: string;
    origenTipo?: 'pos' | 'tesoreria';
    cajaId?: string;
    bovedaId?: string;
  }) => Promise<void>;
  esInline?: boolean;
  proveedores?: Proveedor[];
  gastosList?: Gasto[];
  onDeleteGasto?: (id: string) => Promise<void>;
  onEditGasto?: (gasto: Gasto) => void;
  onUpdateGasto?: (id: string, updates: Partial<Gasto>) => Promise<void>;
  /** Gasto a cargar en el formulario (desde lista inferior) */
  gastoEdicion?: Gasto | null;
  onEdicionCerrada?: () => void;
  productos?: Producto[];
  precios?: PrecioProveedor[];
}

const selectCls = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const TEMPLATES = [
  { label: 'Luz', icon: Lightbulb, monto: 150000, desc: 'Pago Luz Local', cat: 'Servicios' },
  { label: 'Agua', icon: Droplets, monto: 80000, desc: 'Pago Acueducto', cat: 'Servicios' },
  { label: 'Caja Menor', icon: Coffee, monto: 20000, desc: 'Gastos de cafetería/aseo', cat: 'Otros' },
  { label: 'Empaques', icon: PackageSearch, monto: 50000, desc: 'Bolsas y empaques', cat: 'Materia Prima' },
  { label: 'Insumos', icon: ShoppingCart, monto: 0, desc: 'Compra en Mayorista', cat: 'Materia Prima' }
];

const inferirCategoriaYTipoInteligente = (nombre: string, provId: string | undefined, pCatalog: any[], preciosCat: any[]) => {
  const catalogoProv = provId
    ? pCatalog.filter((p) =>
        preciosCat.some((px) => px.proveedorId === provId && px.productoId === p.id)
      )
    : pCatalog;

  const matchProv = matchProductoEnCatalogo(
    nombre,
    catalogoProv.length > 0 ? catalogoProv : pCatalog,
    (p) => p.nombre,
    provId ? 0.52 : 0.58
  );
  if (matchProv.indice >= 0) {
    const p = (catalogoProv.length > 0 ? catalogoProv : pCatalog)[matchProv.indice];
    return {
      tipo: p.tipo || 'ingrediente',
      categoria: p.categoria,
      destino: p.tipo === 'elaborado' ? 'venta' : 'insumo',
    };
  }

  const text = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = text.split(' ').filter(w => w.length > 2); // Palabras clave significativas

  let catFrequencies: Record<string, number> = {};
  let typeFrequencies: Record<string, number> = {};

  // 1. Minería de datos: Buscar similitud en el catálogo entero
  for (const p of pCatalog) {
    if (!p.categoria) continue;
    const pName = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sharedWords = words.filter(w => pName.includes(w));
    
    if (sharedWords.length > 0) {
      const weight = sharedWords.length;
      catFrequencies[p.categoria] = (catFrequencies[p.categoria] || 0) + weight;
      typeFrequencies[p.tipo || 'ingrediente'] = (typeFrequencies[p.tipo || 'ingrediente'] || 0) + weight;
    }
  }

  // 2. Dar peso EXTRA ALTO a la historia del Proveedor
  if (provId) {
    const supplierProductIds = preciosCat.filter(px => px.proveedorId === provId).map(px => px.productoId);
    const supplierProducts = pCatalog.filter(p => supplierProductIds.includes(p.id));
    
    for (const p of supplierProducts) {
      if (!p.categoria) continue;
      // Por defecto, si el proveedor vende esto, le damos algo de peso a sus categorías principales
      catFrequencies[p.categoria] = (catFrequencies[p.categoria] || 0) + 0.5;
      
      const pName = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sharedWords = words.filter(w => pName.includes(w));
      if (sharedWords.length > 0) {
        catFrequencies[p.categoria] += sharedWords.length * 3; // Super peso si coincide la palabra Y el proveedor
        typeFrequencies[p.tipo || 'ingrediente'] = (typeFrequencies[p.tipo || 'ingrediente'] || 0) + sharedWords.length * 3;
      }
    }
  }

  // Encontrar la categoría ganadora
  let bestCat = '';
  let maxCatScore = 0;
  for (const cat in catFrequencies) {
    if (catFrequencies[cat] > maxCatScore) {
      maxCatScore = catFrequencies[cat];
      bestCat = cat;
    }
  }

  let bestType = '';
  let maxTypeScore = 0;
  for (const t in typeFrequencies) {
    if (typeFrequencies[t] > maxTypeScore) {
      maxTypeScore = typeFrequencies[t];
      bestType = t;
    }
  }

  // 3. Fallback Estático si el motor no encontró suficientes pistas históricas (Puntaje < 1)
  if (maxCatScore < 1) {
    if (text.match(/helado|paleta|cono|postre|crema/)) return { tipo: 'elaborado', categoria: 'Helados', destino: 'venta' };
    if (text.match(/dulce|chicle|bombon|menta|chocolate|masmelo|galleta|papas|mecato|snack|goma|barrilete|supercoco/)) return { tipo: 'elaborado', categoria: 'Mecato', destino: 'venta' };
    if (text.match(/gaseosa|jugo|agua|bebida|coca|postobon|hit|tampico/)) return { tipo: 'elaborado', categoria: 'Bebidas', destino: 'venta' };
    if (text.match(/leche|yogur|kumis|lacteo|queso|bon yurt|alpina/)) return { tipo: 'elaborado', categoria: 'Lácteos', destino: 'venta' };
    if (text.match(/gelatina/)) return { tipo: 'elaborado', categoria: 'Postres', destino: 'venta' };
    
    return { tipo: 'ingrediente', categoria: 'Insumos', destino: 'insumo' };
  }

  return {
    tipo: bestType || 'ingrediente',
    categoria: bestCat,
    destino: bestType === 'elaborado' ? 'venta' : 'insumo'
  };
};

const procesarAuditoriaPrecios = async (items: { nombre: string; precioUnitario: number }[], provId?: string) => {
  try {
    const pCatalog = (await db.getAllProductos()) as any[];
    const preciosCat = (await db.getAllPrecios()) as any[];
    
    for (const item of items) {
      const nombreClean = item.nombre.trim().toLowerCase();
      if (!nombreClean) continue;
      
      const matchCat = matchProductoEnCatalogo(item.nombre, pCatalog, (p) => p.nombre);
      let producto = matchCat.indice >= 0 ? pCatalog[matchCat.indice] : undefined;
      const inferido = inferirCategoriaYTipoInteligente(item.nombre, provId, pCatalog, preciosCat);
      
      // 1. Si no existe, crear el producto automáticamente
      if (!producto) {
        producto = {
          id: generateUUID(),
          nombre: item.nombre.trim(),
          categoria: inferido.categoria,
          precioVenta: 0,
          margenUtilidad: 0,
          tipo: inferido.tipo as any,
          costoBase: item.precioUnitario,
          createdAt: new Date().toISOString()
        };
        await db.addProducto(producto);
        pCatalog.push(producto);
        toast.success(`NUEVO: Producto "${producto.nombre}" guardado como ${inferido.categoria} (${inferido.destino}).`);
      }
      
      // 2. Si hay proveedor, auditar y/o actualizar el precio
      if (provId) {
        const precioActual = preciosCat.find(px => px.productoId === producto.id && px.proveedorId === provId);
        
        if (!precioActual) {
          const nuevoPrecio = {
            id: generateUUID(),
            productoId: producto.id,
            proveedorId: provId,
            precioCosto: item.precioUnitario,
            fechaActualizacion: new Date().toISOString(),
            destino: inferido.destino
          };
          await db.addPrecio(nuevoPrecio as any);
          preciosCat.push(nuevoPrecio);
          toast.success(`NUEVO PRECIO: $${item.precioUnitario} registrado para ${producto.nombre}.`);
        } else {
          const diff = item.precioUnitario - precioActual.precioCosto;
          if (diff > 0) {
            const pct = ((diff / precioActual.precioCosto) * 100).toFixed(1);
            toast.warning(`⚠️ ALERTA: ${producto.nombre} SUBIÓ un ${pct}% (De $${precioActual.precioCosto} a $${item.precioUnitario})`, { duration: 6000 });
          } else if (diff < 0) {
            const pct = ((Math.abs(diff) / precioActual.precioCosto) * 100).toFixed(1);
            toast.success(`✅ AHORRO: ${producto.nombre} BAJÓ un ${pct}% (De $${precioActual.precioCosto} a $${item.precioUnitario})`, { duration: 6000 });
          }
          
          if (diff !== 0) {
            const pxToUpdate = {
              ...precioActual,
              precioCosto: item.precioUnitario,
              fechaActualizacion: new Date().toISOString()
            };
            await db.updatePrecio(pxToUpdate as any);
            // Actualizar localmente por si hay duplicados en la misma factura
            const idx = preciosCat.findIndex(px => px.id === precioActual.id);
            if(idx !== -1) preciosCat[idx] = pxToUpdate;
          }
        }
      }
    }
  } catch (err) {
    console.error("Error en auditoría de precios:", err);
  }
};

const FILA_VACIA = () => ({
  id: Date.now() + Math.random(),
  desc: '',
  cantidad: '',
  proveedorId: '',
  monto: '',
  cat: 'Materia Prima' as GastoCategoria,
});

/** Desglosa descripción guardada → cantidad + nombre para la tabla */
function parseDescripcionParaEdicion(descripcion: string): { cantidad: string; desc: string } {
  const raw = (descripcion || '').trim();
  const unids = raw.match(/^(\d+)\s+UNIDS\s+(.*?)(?:\s+valor)?$/i);
  if (unids) {
    return { cantidad: unids[1], desc: unids[2].trim() };
  }
  const mult = raw.match(/^(\d+)\s*x\s+(.+)$/i);
  if (mult) {
    return { cantidad: mult[1], desc: mult[2].trim() };
  }
  return {
    cantidad: '1',
    desc: extraerNombreProductoDeDescripcion(raw) || raw,
  };
}

export function TurboExpenseManager({ 
  onSave, 
  esInline = false,
  proveedores = [],
  gastosList = [],
  onDeleteGasto,
  onEditGasto,
  onUpdateGasto,
  gastoEdicion,
  onEdicionCerrada,
  productos: productosProp,
  precios: preciosProp,
}: TurboExpenseManagerProps) {
  const [smartText, setSmartText] = useState('');
  const [transcriptMasivo, setTranscriptMasivo] = useState('');
  const [isSpreadsheet, setIsSpreadsheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fechaGlobal, setFechaGlobal] = useState(() => new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]);
  const [isListening, setIsListening] = useState(false);
  const [isListeningSmart, setIsListeningSmart] = useState(false);
  const recMasivoRef = useRef<(() => void) | null>(null);
  const recSmartRef = useRef<(() => void) | null>(null);
  const finalTranscriptMasivoRef = useRef('');
  const finalTranscriptSmartRef = useRef('');
  const snapshotRowsRef = useRef<ReturnType<typeof FILA_VACIA>[]>([]);
  const debounceDictadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bovedas] = useState(() => getBovedas());
  const [cajas] = useState(() => cargarCatalogoCajas());
  const [origenTipo, setOrigenTipo] = useState<'pos' | 'tesoreria'>('pos');
  const [cajaId, setCajaId] = useState('');
  const [bovedaId, setBovedaId] = useState('');
  const [smartProv, setSmartProv] = useState('');
  const [recategorizando, setRecategorizando] = useState(false);
  const [editandoGastoId, setEditandoGastoId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const ultimaEdicionCargadaRef = useRef<string | null>(null);
  
  // Estado para la tabla (Hoja de cálculo)
  const [rows, setRows] = useState([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);

  const cargarGastoEnFormulario = useCallback((g: Gasto) => {
    const { cantidad, desc } = parseDescripcionParaEdicion(g.descripcion);
    setEditandoGastoId(g.id);
    setFechaGlobal(
      (g.fecha || '').slice(0, 10) ||
        new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
    );
    setSmartProv(g.proveedorId || '');
    if (g.bovedaId) {
      setOrigenTipo('tesoreria');
      setBovedaId(g.bovedaId);
      setCajaId('');
    } else {
      setOrigenTipo('pos');
      setCajaId(g.cajaId || '');
      setBovedaId('');
    }
    setIsSpreadsheet(true);
    setSmartText('');
    setRows([
      {
        id: Date.now(),
        cantidad,
        desc,
        proveedorId: g.proveedorId || '',
        monto: g.monto > 0 ? String(Math.round(g.monto)) : '',
        cat: normalizarCategoriaGasto(g.categoria as string),
      },
    ]);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toast.info('Editando en la tabla — cambia fecha, producto o monto y guarda', { duration: 4500 });
  }, []);

  const cancelarEdicion = useCallback(() => {
    setEditandoGastoId(null);
    ultimaEdicionCargadaRef.current = null;
    setRows([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);
    onEdicionCerrada?.();
  }, [onEdicionCerrada]);

  useEffect(() => {
    if (!gastoEdicion) {
      ultimaEdicionCargadaRef.current = null;
      return;
    }
    if (gastoEdicion.id === ultimaEdicionCargadaRef.current) return;
    ultimaEdicionCargadaRef.current = gastoEdicion.id;
    cargarGastoEnFormulario(gastoEdicion);
    onEdicionCerrada?.();
  }, [gastoEdicion, cargarGastoEnFormulario, onEdicionCerrada]);

  const cargarCatalogo = async (): Promise<{ productos: Producto[]; precios: PrecioProveedor[] }> => {
    const productos = productosProp ?? ((await db.getAllProductos()) as Producto[]);
    const precios = preciosProp ?? ((await db.getAllPrecios()) as PrecioProveedor[]);
    return { productos, precios };
  };

  const resolverCategoriaGasto = async (
    descripcion: string,
    proveedorId?: string,
    catalogo?: { productos: Producto[]; precios: PrecioProveedor[] }
  ): Promise<GastoCategoria> => {
    const { productos, precios } = catalogo ?? (await cargarCatalogo());
    return inferirCategoriaGasto(descripcion, productos, precios, proveedorId).categoria;
  };

  const handleRecategorizarMasivo = async () => {
    if (!onUpdateGasto) {
      toast.error('No hay conexión para actualizar gastos');
      return;
    }
    setRecategorizando(true);
    try {
      const { productos, precios } = await cargarCatalogo();
      const plan = planificarRecategorizacionGastos(gastosList, productos, precios);
      if (plan.length === 0) {
        toast.success('Todas las categorías ya coinciden con el catálogo');
        return;
      }
      const preview = plan
        .slice(0, 8)
        .map((c) => `• ${extraerNombreProductoDeDescripcion(c.descripcion).slice(0, 35)}: ${c.anterior} → ${c.nueva}`)
        .join('\n');
      const mas = plan.length > 8 ? `\n…y ${plan.length - 8} más` : '';
      const ok = window.confirm(
        `Se corregirán ${plan.length} gastos usando el catálogo de productos.\n\n${preview}${mas}\n\n¿Continuar?`
      );
      if (!ok) return;

      for (const c of plan) {
        await onUpdateGasto(c.id, { categoria: c.nueva });
      }
      toast.success(`${plan.length} gastos recategorizados con el catálogo`);
    } catch (err) {
      console.error(err);
      toast.error('Error al recategorizar gastos');
    } finally {
      setRecategorizando(false);
    }
  };

  // Estrategia 1: Smart Input (Parser simple)
  const handleSmartSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!smartText.trim()) return;

    const { cantidad, monto: montoExtraido, descripcionBase } = extraerCantidadMontoDescripcion(smartText);
    
    if (montoExtraido === 0) {
      toast.error('No detecté el monto', { description: 'Ejemplo: "50 gaseosas quince mil" o "vaso de cinco onzas doce mil"' });
      return;
    }

    let descripcion = descripcionBase || 'Gasto general';
    
    if (cantidad !== '1' && parseFloat(cantidad) > 0) {
        descripcion = `${cantidad}x ${descripcion}`.trim();
    }
    
    const cat = await resolverCategoriaGasto(descripcion, smartProv || undefined);
    
    setSaving(true);
    try {
      await onSave({
        descripcion,
        monto: montoExtraido,
        categoria: cat,
        metodoPago: 'efectivo',
        esIngreso: false,
        fecha: fechaGlobal
      , proveedorId: smartProv || undefined, origenTipo, cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined, bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined});
      
      // 🚀 Ejecutar auditoría de precios
      if (cat === 'Materia Prima' || cat === 'Otros' || smartProv) {
        let cleanName = descripcion;
        if (cleanName.match(/^\d+x\s/)) {
            cleanName = cleanName.replace(/^\d+x\s/, '');
        }
        
        await procesarAuditoriaPrecios([{
          nombre: cleanName,
          precioUnitario: montoExtraido / (parseFloat(cantidad) || 1)
        }], smartProv || undefined);
      }

      toast.success(`Smart Input: Guardado $${montoExtraido}`, { description: cat });
      setSmartText('');
    } catch (err) {
      toast.error('Error al guardar el gasto');
    } finally {
      setSaving(false);
    }
  };

  // Estrategia 2: One-Click Templates
  const handleTemplate = async (tmpl: typeof TEMPLATES[0]) => {
    let finalMonto = tmpl.monto;
    // Si el template tiene 0, se le pide el monto con un prompt rápido
    if (finalMonto === 0) {
      const resp = window.prompt(`Ingresa el monto para: ${tmpl.desc}`);
      if (!resp) return;
      finalMonto = parseFloat(resp.replace(/[^\d]/g, ''));
      if (isNaN(finalMonto) || finalMonto <= 0) return;
    }
    
    setSaving(true);
    try {
      await onSave({
        descripcion: tmpl.desc,
        monto: finalMonto,
        categoria: tmpl.cat as GastoCategoria,
        metodoPago: 'efectivo',
        esIngreso: false,
        fecha: fechaGlobal
      });
      toast.success(`Plantilla: ${tmpl.label} guardada.`);
    } catch (err) {
      toast.error('Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  // Estrategia 3: Modo Hoja de cálculo
  const updateRow = (id: number, field: string, value: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  
  
  const procesarDictadoMasivo = useCallback((
    transcript: string,
    filasManuales: ReturnType<typeof FILA_VACIA>[],
    catalogo?: { productos: Producto[]; precios: PrecioProveedor[] }
  ) => {
    const texto = normalizarTranscriptDictado(transcript);
    if (!texto) return;

    const chunks = separarItemsDictadoFactura(texto);
    const newRows = chunks.map((chunk, index) => {
      const { cantidad, descripcion, monto } = parsearItemDictadoGasto(chunk);
      let cat: GastoCategoria = 'Materia Prima';
      if (catalogo) {
        cat = inferirCategoriaGasto(
          descripcion,
          catalogo.productos,
          catalogo.precios,
          smartProv || undefined
        ).categoria;
      }
      return {
        id: Date.now() + index + Math.random(),
        cantidad,
        desc: descripcion,
        proveedorId: smartProv || '',
        monto: monto > 0 ? monto.toString() : '',
        cat,
      };
    }).filter((r) => r.desc.length > 0);

    if (newRows.length === 0) {
      toast.warning('No se entendió el dictado. Intenta: "50 gaseosas quince mil y harina doce mil"');
      return;
    }

    setRows(() => {
      const combined = [...filasManuales, ...newRows];
      while (combined.length < 3) combined.push(FILA_VACIA());
      return combined;
    });
  }, [smartProv]);

  const aplicarDictadoMasivoConCatalogo = useCallback(async (transcript: string) => {
    const catalogo = await cargarCatalogo();
    procesarDictadoMasivo(transcript, snapshotRowsRef.current, catalogo);
  }, [procesarDictadoMasivo, productosProp, preciosProp]);

  const programarActualizacionDictado = useCallback((textoFinal: string) => {
    if (debounceDictadoRef.current) clearTimeout(debounceDictadoRef.current);
    debounceDictadoRef.current = setTimeout(() => {
      void aplicarDictadoMasivoConCatalogo(textoFinal);
    }, 1400);
  }, [aplicarDictadoMasivoConCatalogo]);

  const toggleDictado = () => {
    if (isListening) {
      if (recMasivoRef.current) {
        recMasivoRef.current();
        recMasivoRef.current = null;
      }
      if (debounceDictadoRef.current) {
        clearTimeout(debounceDictadoRef.current);
        debounceDictadoRef.current = null;
      }
      setIsListening(false);
      const texto = finalTranscriptMasivoRef.current.trim();
      if (texto) {
        void aplicarDictadoMasivoConCatalogo(texto);
      }
      return;
    }

    snapshotRowsRef.current = rows.filter((r) => r.desc.trim() !== '' || r.monto !== '');
    finalTranscriptMasivoRef.current = '';
    setTranscriptMasivo('');

    const detener = iniciarDictadoVoz({
      onTranscript: (estado) => {
        setTranscriptMasivo(estado.completo);
      },
      onSegmentoFinal: (_segmento, acumulado) => {
        finalTranscriptMasivoRef.current = acumulado;
        programarActualizacionDictado(acumulado);
      },
      onError: (error) => {
        if (error === 'not-allowed' || error === 'audio-capture') {
          toast.error('Permiso de micrófono denegado. Actívalo en el candado 🔒 de la barra.');
        } else if (error !== 'no-speech' && error !== 'aborted') {
          toast.error(`Error de micrófono: ${error}`);
        }
      },
      onEstado: (escuchando) => {
        setIsListening(escuchando);
        if (!escuchando) setTranscriptMasivo(finalTranscriptMasivoRef.current);
      },
    });

    if (!detener) {
      toast.error('Tu navegador no soporta dictado por voz.');
      return;
    }

    recMasivoRef.current = detener;
    toast.info('🎙️ Dictando… Habla pausado. Toca otra vez el micrófono al terminar.', { duration: 4000 });
  };

  const toggleDictadoSmart = () => {
    if (isListeningSmart) {
      recSmartRef.current?.();
      recSmartRef.current = null;
      setIsListeningSmart(false);
      setSmartText(finalTranscriptSmartRef.current.trim());
      return;
    }

    finalTranscriptSmartRef.current = smartText.trim();

    const detener = iniciarDictadoVoz({
      textoInicial: finalTranscriptSmartRef.current,
      onTranscript: (estado) => {
        setSmartText(estado.completo);
      },
      onSegmentoFinal: (_segmento, acumulado) => {
        finalTranscriptSmartRef.current = acumulado;
      },
      onError: (error) => {
        setIsListeningSmart(false);
        if (error === 'not-allowed' || error === 'audio-capture') {
          toast.error('Permiso de micrófono denegado.');
        } else if (error !== 'aborted') {
          toast.error(`Error de voz: ${error}`);
        }
      },
      onEstado: (escuchando) => {
        setIsListeningSmart(escuchando);
        if (!escuchando) {
          setSmartText(finalTranscriptSmartRef.current);
        }
      },
    });

    if (!detener) {
      toast.error('Dictado no disponible en este navegador.');
      return;
    }

    recSmartRef.current = detener;
    toast.info('🎙️ Escuchando… Di el monto y el producto. Toca el micrófono al terminar.', { duration: 3500 });
  };

  const handleSpreadsheetSave = async () => {
    const validRows = rows.filter(r => r.desc.trim() !== '' && parseFloat(r.monto) > 0);
    if (validRows.length === 0) {
      toast.warning('No hay datos válidos para guardar en la tabla.');
      return;
    }
    
    setSaving(true);
    let count = 0;
    try {
      const catalogo = await cargarCatalogo();

      // Modo edición: un solo gasto existente
      if (editandoGastoId && onUpdateGasto) {
        const row = validRows[0];
        const provId = row.proveedorId || smartProv || undefined;
        let finalDesc = row.desc.trim();
        const qty = parseFloat(row.cantidad || '1') || 1;
        if (provId) {
          finalDesc = `${qty} UNIDS ${finalDesc} valor`;
        } else if (qty > 1) {
          finalDesc = `${qty}x ${finalDesc}`;
        }
        const monto = parseFloat(row.monto);
        const cat = await resolverCategoriaGasto(finalDesc, provId, catalogo);

        await onUpdateGasto(editandoGastoId, {
          descripcion: finalDesc,
          monto,
          categoria: cat,
          fecha: fechaGlobal,
          proveedorId: provId,
          cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined,
          bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined,
        });

        toast.success('Gasto actualizado ✓');
        setEditandoGastoId(null);
        ultimaEdicionCargadaRef.current = null;
        setRows([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);
        setIsSpreadsheet(false);
        onEdicionCerrada?.();
        return;
      }

      // Asignar el proveedor global a cada fila si la fila no tiene uno propio
      const rowsWithProv = validRows.map(r => ({ ...r, proveedorId: r.proveedorId || smartProv }));
      
      const rowsSinProv = rowsWithProv.filter(r => !r.proveedorId);
      const rowsConProv = rowsWithProv.filter(r => !!r.proveedorId);

      // 1. Guardar como individuales los que NO tienen proveedor seleccionado
      for (const row of rowsSinProv) {
        let finalDesc = row.desc.trim();
        if (row.cantidad && Number(row.cantidad) > 1) {
          finalDesc = `${row.cantidad}x ${finalDesc}`;
        }
        const cat = await resolverCategoriaGasto(finalDesc, undefined, catalogo);
        await onSave({
          descripcion: finalDesc,
          monto: parseFloat(row.monto),
          categoria: cat,
          metodoPago: 'efectivo',
          esIngreso: false,
          fecha: fechaGlobal,
          proveedorId: undefined, 
          origenTipo, 
          cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined, 
          bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined
        });
        count++;
      }

      // 2. Cada fila con proveedor = gasto INDIVIDUAL (no fusionar en una sola factura)
      for (const row of rowsConProv) {
        let finalDesc = row.desc.trim();
        const qty = parseFloat(row.cantidad || '1') || 1;
        if (qty >= 1) {
          finalDesc = `${qty} UNIDS ${finalDesc} valor`;
        }
        const monto = parseFloat(row.monto);
        const cat = await resolverCategoriaGasto(finalDesc, row.proveedorId, catalogo);

        await onSave({
          descripcion: finalDesc,
          monto,
          categoria: cat,
          metodoPago: 'efectivo',
          esIngreso: false,
          fecha: fechaGlobal,
          proveedorId: row.proveedorId,
          origenTipo,
          cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined,
          bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined,
        });

        await procesarAuditoriaPrecios(
          [
            {
              nombre: row.desc.trim(),
              cantidad: qty,
              precioUnitario: monto / qty,
              total: monto,
            },
          ],
          row.proveedorId
        );
        count++;
      }

      toast.success(`¡Masivo! ${count} registros guardados exitosamente.`);
      setRows([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);
      setIsSpreadsheet(false);
    } catch (err) {
      toast.error('Error guardando registros masivos');
    } finally {
      setSaving(false);
    }
  };

  const barra = (
    <div
      ref={formRef}
      className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col",
      !esInline && "shadow-indigo-500/10",
      editandoGastoId && "ring-2 ring-amber-400 dark:ring-amber-600"
    )}>
      {editandoGastoId && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">
            ✏️ Editando gasto — cambia fecha arriba, producto o monto abajo
          </span>
          <button
            type="button"
            onClick={cancelarEdicion}
            className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 hover:text-amber-900 dark:text-amber-400"
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      )}
      {/* HEADER / TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Zap className="w-4 h-4 fill-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-widest">Modo Turbo Gastos</span>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {onUpdateGasto && gastosList.length > 0 && (
            <button
              type="button"
              onClick={handleRecategorizarMasivo}
              disabled={recategorizando}
              title="Corrige categorías de gastos ya guardados comparando con el catálogo"
              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-50"
            >
              <Tags className="w-3 h-3" />
              {recategorizando ? 'Corrigiendo…' : 'Corregir categorías'}
            </button>
          )}
          
          <div className="flex items-center gap-1">
            <select value={origenTipo} onChange={(e) => setOrigenTipo(e.target.value as 'pos'|'tesoreria')} className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1 py-1 font-bold text-slate-600 outline-none">
              <option value="pos">Caja POS</option>
              <option value="tesoreria">Bóveda</option>
            </select>
            {origenTipo === 'pos' ? (
              <select value={cajaId} onChange={(e) => setCajaId(e.target.value)} className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1 py-1 font-bold text-slate-600 max-w-[100px] truncate outline-none">
                <option value="">Efectivo suelto</option>
                {CAJAS_POS_DEFAULT.map(c => <option key={c} value={c}>{c}</option>)}
                {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            ) : (
              <select value={bovedaId} onChange={(e) => setBovedaId(e.target.value)} className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1 py-1 font-bold text-slate-600 max-w-[100px] truncate outline-none">
                <option value="">Elegir Bóveda...</option>
                {bovedas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            )}
          </div>
          {/* SELECTOR DE FECHA GLOBAL */}

          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 gap-1" title="Fecha para estos gastos">
            <Calendar className="w-3 h-3 text-slate-400" />
            <input 
              type="date"
              value={fechaGlobal}
              onChange={(e) => setFechaGlobal(e.target.value)}
              className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-transparent outline-none cursor-pointer"
            />
          </div>

          <button 
            onClick={() => setIsSpreadsheet(!isSpreadsheet)}
            className={cn(
              "text-[9px] font-bold uppercase px-2 py-1 rounded-md transition-colors flex items-center gap-1",
              isSpreadsheet ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
            )}
          >
            <TableProperties className="w-3 h-3" />
            Masivo
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ONE CLICK TEMPLATES */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TEMPLATES.map((tmpl, idx) => {
            const Icon = tmpl.icon;
            return (
              <button 
                key={idx}
                disabled={saving}
                onClick={() => handleTemplate(tmpl)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-lg text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 transition-all text-xs font-bold"
              >
                <Icon className="w-3.5 h-3.5" />
                {tmpl.label}
              </button>
            )
          })}
        </div>

        {/* MAIN INPUT AREA */}
        {!isSpreadsheet ? (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <select value={smartProv} onChange={e => setSmartProv(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <option value="">-- Proveedor Opcional --</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            {isListeningSmart && smartText && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1 -mt-1 mb-1 truncate">
                🎙️ {smartText}
              </p>
            )}
            <form onSubmit={handleSmartSubmit} className="flex flex-col sm:flex-row gap-2 relative">

              <div className="absolute left-3 top-3.5 text-slate-400">
                <Wand2 className="w-5 h-5" />
              </div>
              <input 
                value={smartText}
                onChange={(e) => setSmartText(e.target.value)}
                disabled={saving}
              placeholder="Escribe: 150000 pago de luz local..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-slate-800 dark:text-white placeholder:font-normal"
            />
              <button
                type="button"
                onClick={toggleDictadoSmart}
                className={`absolute right-[130px] top-2 p-2 rounded-lg transition-colors ${isListeningSmart ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                {isListeningSmart ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button 
                type="submit"
                disabled={saving || !smartText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-sm transition-colors flex items-center justify-center min-w-[120px]"
            >
              {saving ? '...' : 'Registrar'}
              </button>
            </form>
          </>
         ) : (
            /* SPREADSHEET MODE */
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <select value={smartProv} onChange={e => setSmartProv(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 w-full sm:w-auto">
                  <option value="">-- Proveedor General Opcional --</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 text-[10px] uppercase font-bold p-2 rounded-lg flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3 h-3 shrink-0" />
                Dicta pausado: &quot;50 gaseosas quince mil y harina doce mil&quot;. Toca el micrófono otra vez al terminar.
              </div>
              {(isListening || transcriptMasivo) && (
                <p className="normal-case text-[11px] font-semibold text-amber-900 dark:text-amber-200 truncate">
                  {isListening ? '🎙️ ' : ''}{transcriptMasivo || 'Escuchando…'}
                </p>
              )}
            </div>
            
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <div className="grid grid-cols-[60px_3fr_2fr_40px] min-w-[440px] gap-px bg-slate-200 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 text-center">
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Cant.</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Producto / Descripción</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Monto ($)</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5"></div>
              </div>
              
              {rows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-[60px_3fr_2fr_40px] min-w-[440px] gap-px bg-slate-100 dark:bg-slate-800 group">
                  <input 
                    type="number"
                    value={row.cantidad}
                    onChange={(e) => updateRow(row.id, 'cantidad', e.target.value)}
                    placeholder="1"
                    className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 px-2 py-3 text-sm font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 w-full text-center tabular-nums"
                  />
                  <input 
                    value={row.desc}
                    onChange={(e) => updateRow(row.id, 'desc', e.target.value)}
                    placeholder="Ej: Harina de trigo..."
                    className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 px-3 py-3 text-sm font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 w-full"
                  />
                  <input 
                    type="number"
                    value={row.monto}
                    onChange={(e) => updateRow(row.id, 'monto', e.target.value)}
                    placeholder="0"
                    className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 px-3 py-3 text-sm font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 tabular-nums text-right w-full"
                  />
                  <button
                    onClick={() => setRows(rows.filter(r => r.id !== row.id))}
                    className="bg-white dark:bg-slate-950 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar fila"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => {
                      setRows([FILA_VACIA()]);
                      setTranscriptMasivo('');
                  }}
                  title="Limpiar toda la tabla"
                  className="bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar
                </button>

                <button 
                  onClick={() => setRows([...rows, FILA_VACIA()])}
                  className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Fila
                </button>

                <button 
                  onClick={toggleDictado}
                  type="button"
                  className={`px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {isListening ? 'Escuchando...' : 'Dictar Factura'}
                </button>
  
                <button 
                  onClick={handleSpreadsheetSave}
                  disabled={saving}
                  className={cn(
                    "text-white px-4 py-2 rounded-lg font-black text-xs transition-colors flex items-center gap-1",
                    editandoGastoId
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : editandoGastoId ? 'Guardar cambios' : 'Procesar Masivo'}
                </button>
              </div>

              {/* LIVE TRANSCRIPTION PREVIEW */}
              {isListening && transcriptMasivo && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-2 rounded-r-lg text-xs italic text-red-700 dark:text-red-400 font-medium animate-in fade-in slide-in-from-top-2">
                  "{transcriptMasivo}"
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );

  if (esInline) {
    return <div className="w-full relative z-10">{barra}</div>;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:right-auto">
      {barra}
    </div>
  );
}










