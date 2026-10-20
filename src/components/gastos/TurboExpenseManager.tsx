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
  Home,
  Wifi,
  Flame,
  Wrench,
  Receipt,
  Landmark,
  CalendarClock,
} from 'lucide-react';
import { getCompromisos } from '@/lib/finanzas-personales';
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

const CLAVE_ORIGEN_GASTO = 'dp_gasto_origen_ultimo';

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

// 🩹 2026-10-09: pagos fijos y varios. Todos piden el monto REAL (antes Luz/Agua tenían montos inventados).
const TEMPLATES = [
  { label: 'Arriendo', icon: Home, monto: 0, desc: 'Pago Arriendo', cat: 'Arriendo' },
  { label: 'Luz', icon: Lightbulb, monto: 0, desc: 'Pago Luz Local', cat: 'Servicios' },
  { label: 'Agua', icon: Droplets, monto: 0, desc: 'Pago Acueducto', cat: 'Servicios' },
  { label: 'Gas', icon: Flame, monto: 0, desc: 'Pago Gas', cat: 'Servicios' },
  { label: 'Internet', icon: Wifi, monto: 0, desc: 'Pago Internet', cat: 'Servicios' },
  { label: 'Arreglos', icon: Wrench, monto: 0, desc: 'Arreglo / Mantenimiento', cat: 'Mantenimiento' },
  { label: 'Bancos', icon: Landmark, monto: 0, desc: 'Pago Banco / Crédito', cat: 'Otros' },
  { label: 'Compromisos', icon: CalendarClock, monto: 0, desc: 'Pago Compromiso', cat: 'Otros' },
  { label: 'Caja Menor', icon: Coffee, monto: 0, desc: 'Gastos de cafetería/aseo', cat: 'Otros' },
  { label: 'Empaques', icon: PackageSearch, monto: 0, desc: 'Bolsas y empaques', cat: 'Materia Prima' },
  { label: 'Insumos', icon: ShoppingCart, monto: 0, desc: 'Compra en Mayorista', cat: 'Materia Prima' }
];
/** Último monto pagado por cada pago fijo (solo como sugerencia, en este aparato) */
const CLAVE_PAGO_FIJO_ULTIMO = 'dp_pago_fijo_ultimo';
const leerUltimosPagosFijos = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(CLAVE_PAGO_FIJO_ULTIMO) || '{}') || {}; } catch { return {}; }
};
const normNombre = (s: string) => (s || '').trim().toLowerCase();

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

export const procesarAuditoriaPrecios = async (items: { nombre: string; precioUnitario: number }[], provId?: string, crearSiNoExiste = true) => {
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
        if (!crearSiNoExiste) continue; // al editar un gasto viejo no se crean productos nuevos
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
  /** Precio por unidad sugerido del catálogo del proveedor (para recalcular al cambiar la cantidad) */
  precioUnit: '',
  /** Costo que tenía el catálogo al elegir el producto (para avisar si cambió) */
  precioCatalogo: '',
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
  // 🩹 2026-10-09: el pago masivo (tabla por productos) sale de una vez
  const [isSpreadsheet, setIsSpreadsheet] = useState(true);
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
  const [bovedas, setBovedas] = useState<Boveda[]>(() => getBovedas());
  const [cajas] = useState(() => cargarCatalogoCajas());
  // 🩹 2026-10-09: "¿De dónde sale la plata?" — se recuerda la última elección en este aparato
  const origenGuardado = (() => {
    try { return localStorage.getItem(CLAVE_ORIGEN_GASTO) || ''; } catch { return ''; }
  })();
  const [origenTipo, setOrigenTipo] = useState<'pos' | 'tesoreria'>(
    origenGuardado.startsWith('boveda:') ? 'tesoreria' : 'pos'
  );
  const [cajaId, setCajaId] = useState(origenGuardado.startsWith('caja:') ? origenGuardado.slice(5) : '');
  const [bovedaId, setBovedaId] = useState(origenGuardado.startsWith('boveda:') ? origenGuardado.slice(7) : '');
  // Cajas reales configuradas (Configuración → cajas). Si no hay, las de fábrica.
  const opcionesCajas: { id: string; nombre: string }[] =
    cajas.length > 0 ? cajas : CAJAS_POS_DEFAULT.map((c) => ({ id: c, nombre: c }));
  const valorOrigen = origenTipo === 'tesoreria'
    ? (bovedaId ? `boveda:${bovedaId}` : '')
    : (cajaId ? `caja:${cajaId}` : '');
  const elegirOrigen = (valor: string) => {
    if (valor.startsWith('boveda:')) {
      setOrigenTipo('tesoreria'); setBovedaId(valor.slice(7)); setCajaId('');
    } else if (valor.startsWith('caja:')) {
      setOrigenTipo('pos'); setCajaId(valor.slice(5)); setBovedaId('');
    } else {
      setOrigenTipo('pos'); setCajaId(''); setBovedaId('');
    }
    try { localStorage.setItem(CLAVE_ORIGEN_GASTO, valor); } catch { /* sin almacenamiento */ }
  };
  /** Obliga a decir de dónde sale la plata. Avisa si la bóveda no alcanza (no bloquea). */
  const validarOrigen = (montoTotal: number): boolean => {
    if (!valorOrigen) {
      toast.error('Elige de dónde sale la plata', {
        description: 'Arriba, en "¿De dónde sale la plata?": una caja o una bóveda.',
      });
      return false;
    }
    if (origenTipo === 'tesoreria') {
      const b = bovedas.find((x) => x.id === bovedaId);
      if (b && montoTotal > (b.saldo || 0)) {
        toast.warning(`Ojo: ${b.nombre} tiene $${Math.round(b.saldo || 0).toLocaleString('es-CO')} y vas a sacar $${Math.round(montoTotal).toLocaleString('es-CO')}`, { duration: 6000 });
      }
    }
    return true;
  };
  const refrescarBovedas = () => setBovedas(getBovedas());
  const [smartProv, setSmartProv] = useState('');
  const [recategorizando, setRecategorizando] = useState(false);
  const [editandoGastoId, setEditandoGastoId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const ultimaEdicionCargadaRef = useRef<string | null>(null);
  
  // Estado para la tabla (Hoja de cálculo)
  const [rows, setRows] = useState([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);
  const [catalogoTabla, setCatalogoTabla] = useState<{ productos: Producto[]; precios: PrecioProveedor[] }>({ productos: [], precios: [] });
  const recargarCatalogoTabla = useCallback(async () => {
    try {
      const productos = productosProp ?? ((await db.getAllProductos()) as Producto[]);
      const precios = preciosProp ?? ((await db.getAllPrecios()) as PrecioProveedor[]);
      setCatalogoTabla({ productos, precios });
    } catch { /* sin catálogo: se escribe a mano */ }
  }, [productosProp, preciosProp]);
  useEffect(() => { void recargarCatalogoTabla(); }, [recargarCatalogoTabla]);

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
        precioUnit: '',
        precioCatalogo: '',
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
    
    if (!validarOrigen(montoExtraido)) return;
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
      refrescarBovedas();
    } catch (err) {
      toast.error('Error al guardar el gasto');
    } finally {
      setSaving(false);
    }
  };

  // Estrategia 2: Pagos fijos y varios (arriendo, luz, agua, arreglos...)
  // 🩹 2026-10-09: abre un panel para escribir el monto real, a quién se pagó y una nota.
  const [pagoFijo, setPagoFijo] = useState<typeof TEMPLATES[0] | null>(null);
  const [pagoFijoMonto, setPagoFijoMonto] = useState('');
  const [pagoFijoQuien, setPagoFijoQuien] = useState('');
  const [pagoFijoNota, setPagoFijoNota] = useState('');
  // 🩹 2026-10-09: compromisos fijos registrados (Finanzas → compromisos) para elegir cuál se paga
  const [compromisoId, setCompromisoId] = useState('');
  const compromisosActivos = (() => {
    try { return getCompromisos().filter((c) => c.activo); } catch { return []; }
  })();
  const elegirCompromiso = (id: string) => {
    setCompromisoId(id);
    const c = compromisosActivos.find((x) => x.id === id);
    if (c) {
      setPagoFijoQuien(c.nombre);
      if (c.monto > 0) setPagoFijoMonto(String(Math.round(c.monto)));
    }
  };
  const handleTemplate = (tmpl: typeof TEMPLATES[0]) => {
    const ultimo = leerUltimosPagosFijos()[tmpl.label];
    setCompromisoId('');
    setPagoFijo(tmpl);
    setPagoFijoMonto(ultimo ? String(ultimo) : '');
    setPagoFijoQuien('');
    setPagoFijoNota('');
  };
  const guardarPagoFijo = async () => {
    if (!pagoFijo) return;
    const monto = parseFloat(pagoFijoMonto.replace(/[^\d.]/g, '')) || 0;
    if (monto <= 0) {
      toast.error('Escribe cuánto se pagó');
      return;
    }
    if (!validarOrigen(monto)) return;
    const partes = [pagoFijo.desc];
    if (pagoFijoQuien.trim()) partes.push(`— ${pagoFijoQuien.trim()}`);
    if (pagoFijoNota.trim()) partes.push(`(${pagoFijoNota.trim()})`);
    setSaving(true);
    try {
      await onSave({
        descripcion: partes.join(' '),
        monto,
        categoria: ((pagoFijo.label === 'Compromisos'
          ? compromisosActivos.find((x) => x.id === compromisoId)?.categoria
          : undefined) || pagoFijo.cat) as GastoCategoria,
        metodoPago: 'efectivo',
        esIngreso: false,
        fecha: fechaGlobal,
        origenTipo,
        cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined,
        bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined,
      });
      try {
        const ult = leerUltimosPagosFijos();
        ult[pagoFijo.label] = monto;
        localStorage.setItem(CLAVE_PAGO_FIJO_ULTIMO, JSON.stringify(ult));
      } catch { /* sin almacenamiento */ }
      toast.success(`${pagoFijo.label}: $${Math.round(monto).toLocaleString('es-CO')} guardado`);
      setPagoFijo(null);
      refrescarBovedas();
    } catch (err) {
      toast.error('Error al guardar el pago');
    } finally {
      setSaving(false);
    }
  };

  // 🩹 2026-10-09: FACTURA POR TOTAL — registrar solo el total del recibo, sin producto por producto.
  const [modoTabla, setModoTabla] = useState<'producto' | 'factura'>('producto');
  const [facturaProv, setFacturaProv] = useState('');
  const [facturaNumero, setFacturaNumero] = useState('');
  const [facturaTotal, setFacturaTotal] = useState('');
  const [facturaNota, setFacturaNota] = useState('');
  const guardarFacturaTotal = async () => {
    const total = parseFloat(facturaTotal.replace(/[^\d.]/g, '')) || 0;
    if (!facturaProv) {
      toast.error('Elige el proveedor de la factura');
      return;
    }
    if (total <= 0) {
      toast.error('Escribe el total de la factura');
      return;
    }
    if (!validarOrigen(total)) return;
    const provNombre = proveedores.find((p) => p.id === facturaProv)?.nombre || 'Proveedor';
    let descripcion = `Factura ${facturaNumero.trim() ? `N° ${facturaNumero.trim()} ` : ''}${provNombre}`;
    if (facturaNota.trim()) descripcion += ` — ${facturaNota.trim()}`;
    setSaving(true);
    try {
      await onSave({
        descripcion,
        monto: total,
        categoria: 'Materia Prima',
        metodoPago: 'efectivo',
        esIngreso: false,
        fecha: fechaGlobal,
        proveedorId: facturaProv,
        origenTipo,
        cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined,
        bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined,
      });
      toast.success(`Factura de ${provNombre}: $${Math.round(total).toLocaleString('es-CO')} guardada`);
      setFacturaNumero('');
      setFacturaTotal('');
      setFacturaNota('');
      refrescarBovedas();
    } catch (err) {
      toast.error('Error al guardar la factura');
    } finally {
      setSaving(false);
    }
  };

  // 🩹 2026-10-09: cambiar el nombre de un producto del catálogo para que quede como lo escribe la factura
  const renombrarEnCatalogo = async (prod: Producto, nuevoNombre: string) => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const ok = window.confirm(`¿Cambiar el nombre en el catálogo?\n\n"${prod.nombre}" → "${nombre}"\n\nSe verá con el nombre nuevo en toda la app.`);
    if (!ok) return;
    try {
      await db.updateProducto({ ...prod, nombre });
      toast.success(`Nombre cambiado: ${nombre}`);
      await recargarCatalogoTabla();
    } catch (err) {
      toast.error('No se pudo cambiar el nombre');
    }
  };

  // Estrategia 3: Modo Hoja de cálculo
  // 🩹 2026-10-09: elegir PRODUCTO por fila. Al escribir/elegir un producto del catálogo del
  // proveedor se pone su último costo registrado y se calcula monto = cantidad × costo.
  const costoSugerido = (nombre: string, provId: string): number => {
    const n = nombre.trim().toLowerCase();
    if (!n) return 0;
    const prod = catalogoTabla.productos.find((p) => (p.nombre || '').trim().toLowerCase() === n);
    if (!prod) return 0;
    const delProv = provId
      ? catalogoTabla.precios.find((px) => px.productoId === prod.id && px.proveedorId === provId)
      : undefined;
    const cualquiera = delProv ?? catalogoTabla.precios.find((px) => px.productoId === prod.id);
    return Number(cualquiera?.precioCosto) || 0;
  };
  const updateRow = (id: number, field: string, value: string) => {
    const nuevas = rows.map(r => {
      if (r.id !== id) return r;
      const nueva = { ...r, [field]: value };
      const provFila = nueva.proveedorId || smartProv;
      const qty = parseFloat((field === 'cantidad' ? value : nueva.cantidad) || '1') || 1;
      if (field === 'desc' || field === 'proveedorId') {
        const costo = costoSugerido(nueva.desc, provFila);
        if (costo > 0) {
          nueva.precioUnit = String(costo);
          nueva.precioCatalogo = String(costo);
          nueva.monto = String(Math.round(qty * costo));
        } else {
          nueva.precioCatalogo = '';
        }
      } else if (field === 'cantidad' && parseFloat(r.precioUnit) > 0) {
        nueva.monto = String(Math.round(qty * parseFloat(r.precioUnit)));
      } else if (field === 'precioUnit') {
        // 🩹 2026-10-09: corregir el PRECIO por unidad aquí → recalcula el monto, y al
        // guardar se actualiza ese precio en el catálogo del proveedor.
        const pu = parseFloat(value) || 0;
        nueva.monto = pu > 0 ? String(Math.round(qty * pu)) : '';
      } else if (field === 'monto') {
        const m = parseFloat(value) || 0;
        nueva.precioUnit = m > 0 ? String(Math.round((m / qty) * 100) / 100) : '';
      }
      return nueva;
    });
    // 🩹 2026-10-09: sin límite de filas — al escribir en la última, aparece otra vacía.
    const ultima = nuevas[nuevas.length - 1];
    if (ultima && ultima.id === id && (ultima.desc.trim() !== '' || ultima.monto !== '')) {
      nuevas.push(FILA_VACIA());
    }
    setRows(nuevas);
  };
  /** Productos que vende un proveedor (por sus precios registrados); si no tiene, todo el catálogo. */
  const productosDeProveedor = (provId: string): Producto[] => {
    if (!provId) return catalogoTabla.productos;
    const ids = new Set(catalogoTabla.precios.filter((px) => px.proveedorId === provId).map((px) => px.productoId));
    const lista = catalogoTabla.productos.filter((p) => ids.has(p.id));
    return lista.length > 0 ? lista : catalogoTabla.productos;
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
        precioUnit: '',
        precioCatalogo: '',
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
    if (!editandoGastoId) {
      const totalTabla = validRows.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
      if (!validarOrigen(totalTabla)) return;
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
      refrescarBovedas();
      void recargarCatalogoTabla(); // precios corregidos ya quedaron en el catálogo
      setRows([FILA_VACIA(), FILA_VACIA(), FILA_VACIA()]);
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
        {/* 🩹 2026-10-09: ¿DE DÓNDE SALE LA PLATA? (obligatorio) */}
        <div className={cn(
          "rounded-xl border-2 p-3",
          valorOrigen
            ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30"
        )}>
          <label className="block text-[11px] font-black uppercase tracking-widest mb-1.5 text-slate-700 dark:text-slate-200">
            💵 ¿De dónde sale la plata? <span className="text-rose-600">*</span>
          </label>
          <select
            value={valorOrigen}
            onChange={(e) => elegirOrigen(e.target.value)}
            className={cn(selectCls, "w-full text-base py-3")}
          >
            <option value="">— Elige una caja o una bóveda —</option>
            <optgroup label="Cajas del día">
              {opcionesCajas.map((c) => (
                <option key={`caja-${c.id}`} value={`caja:${c.id}`}>{c.nombre}</option>
              ))}
            </optgroup>
            {bovedas.length > 0 && (
              <optgroup label="Bóvedas / Tesorería">
                {bovedas.map((b) => (
                  <option key={`bov-${b.id}`} value={`boveda:${b.id}`}>
                    {b.nombre} — saldo ${Math.round(b.saldo || 0).toLocaleString('es-CO')}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {!valorOrigen && (
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 mt-1">
              Sin esto no se guarda el gasto.
            </p>
          )}
          {origenTipo === 'tesoreria' && bovedaId && (
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              Se descontará del saldo de esa bóveda al guardar.
            </p>
          )}
        </div>

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

        {/* 🩹 2026-10-09: panel del pago fijo elegido (arriendo, luz, agua, arreglos...) */}
        {pagoFijo && (
          <div className="rounded-xl border-2 border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-indigo-800 dark:text-indigo-200">
                Pago de {pagoFijo.label}
              </p>
              <button type="button" onClick={() => setPagoFijo(null)} className="text-slate-400 hover:text-slate-700" title="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            {pagoFijo.label === 'Compromisos' && (
              compromisosActivos.length > 0 ? (
                <select
                  value={compromisoId}
                  onChange={(e) => elegirCompromiso(e.target.value)}
                  className={cn(selectCls, "w-full py-3")}
                >
                  <option value="">— ¿Cuál compromiso vas a pagar? —</option>
                  {compromisosActivos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.monto > 0 ? ` — $${Math.round(c.monto).toLocaleString('es-CO')}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] font-semibold text-slate-500">No tienes compromisos fijos registrados. Escribe abajo a quién se le pagó.</p>
              )
            )}
            {/* 🩹 2026-10-09: de dónde sale la plata, aquí mismo en el pago */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest mb-1 text-slate-600 dark:text-slate-300">
                💵 ¿De dónde sale la plata? <span className="text-rose-600">*</span>
              </label>
              <select
                value={valorOrigen}
                onChange={(e) => elegirOrigen(e.target.value)}
                className={cn(
                  selectCls,
                  "w-full py-3",
                  !valorOrigen && "border-rose-400 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30"
                )}
              >
                <option value="">— Elige la caja o la bóveda —</option>
                <optgroup label="Cajas del día">
                  {opcionesCajas.map((c) => (
                    <option key={`pf-caja-${c.id}`} value={`caja:${c.id}`}>{c.nombre}</option>
                  ))}
                </optgroup>
                {bovedas.length > 0 && (
                  <optgroup label="Bóvedas / Tesorería">
                    {bovedas.map((b) => (
                      <option key={`pf-bov-${b.id}`} value={`boveda:${b.id}`}>
                        {b.nombre} — saldo ${Math.round(b.saldo || 0).toLocaleString('es-CO')}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={pagoFijoMonto}
              onChange={(e) => setPagoFijoMonto(e.target.value)}
              placeholder="¿Cuánto se pagó? $"
              className="w-full px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-lg font-black tabular-nums"
              autoFocus
            />
            {leerUltimosPagosFijos()[pagoFijo.label] ? (
              <p className="text-[11px] font-semibold text-slate-500">La última vez pagaste ${Math.round(leerUltimosPagosFijos()[pagoFijo.label]).toLocaleString('es-CO')} (cámbialo si es otro valor).</p>
            ) : null}
            <input
              value={pagoFijoQuien}
              onChange={(e) => setPagoFijoQuien(e.target.value)}
              placeholder="¿A quién se le pagó? (opcional) Ej: Don Pedro, Fábrica de muebles"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
            />
            <input
              value={pagoFijoNota}
              onChange={(e) => setPagoFijoNota(e.target.value)}
              placeholder="Nota (opcional) Ej: mes de octubre, arreglo del horno"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setPagoFijo(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button type="button" onClick={guardarPagoFijo} disabled={saving} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar pago'}
              </button>
            </div>
          </div>
        )}

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
              {/* 🩹 2026-10-09: dos formas de registrar lo que se le paga al proveedor */}
              {!editandoGastoId && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoTabla('producto')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 transition-colors",
                      modoTabla === 'producto'
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    <TableProperties className="w-4 h-4" /> Por producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoTabla('factura')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 transition-colors",
                      modoTabla === 'factura'
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    <Receipt className="w-4 h-4" /> Por total de factura
                  </button>
                </div>
              )}

              {modoTabla === 'factura' && !editandoGastoId ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Registra solo el total del recibo. No se anota producto por producto ni se tocan los precios del catálogo.
                  </p>
                  <select
                    value={facturaProv}
                    onChange={(e) => setFacturaProv(e.target.value)}
                    className={cn(selectCls, "w-full py-3")}
                  >
                    <option value="">— Proveedor de la factura —</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={facturaNumero}
                      onChange={(e) => setFacturaNumero(e.target.value)}
                      placeholder="N° de factura o recibo (opcional)"
                      className="w-full px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={facturaTotal}
                      onChange={(e) => setFacturaTotal(e.target.value)}
                      placeholder="Total de la factura $"
                      className="w-full px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-lg font-black tabular-nums"
                    />
                  </div>
                  <input
                    value={facturaNota}
                    onChange={(e) => setFacturaNota(e.target.value)}
                    placeholder="Nota (opcional) Ej: pedido del lunes"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={guardarFacturaTotal}
                      disabled={saving}
                      className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar factura'}
                    </button>
                  </div>
                </div>
              ) : (
              <>
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
              <div className="grid grid-cols-[56px_3fr_2fr_1.5fr_1.5fr_36px] min-w-[720px] gap-px bg-slate-200 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 text-center">
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Cant.</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Producto / Descripción</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Proveedor</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Precio c/u</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5">Total ($)</div>
                <div className="bg-slate-100 dark:bg-slate-900 py-1.5"></div>
              </div>
              
              {rows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-[56px_3fr_2fr_1.5fr_1.5fr_36px] min-w-[720px] gap-px bg-slate-100 dark:bg-slate-800 group">
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
                    list={`dl-prov-${row.proveedorId || smartProv || 'todos'}`}
                    placeholder="Escribe o elige el producto..."
                    className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 px-3 py-3 text-sm font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 w-full"
                  />
                  {/* 🩹 2026-10-09: proveedor por fila → pagar a varios proveedores en una sola tanda */}
                  <select
                    value={row.proveedorId}
                    onChange={(e) => updateRow(row.id, 'proveedorId', e.target.value)}
                    className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 px-2 py-3 text-xs font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 w-full"
                  >
                    <option value="">{smartProv ? '(el general)' : '— sin proveedor —'}</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {/* 🩹 2026-10-09: precio por unidad editable (si subió, se corrige aquí y se guarda en el catálogo) */}
                  <input
                    type="number"
                    value={row.precioUnit}
                    onChange={(e) => updateRow(row.id, 'precioUnit', e.target.value)}
                    placeholder="0"
                    title="Precio por unidad. Si lo cambias, al guardar se actualiza en el catálogo del proveedor."
                    className={cn(
                      "bg-white dark:bg-slate-950 px-2 py-3 text-sm font-bold focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/30 tabular-nums text-right w-full",
                      row.precioCatalogo && row.precioUnit && Math.round(parseFloat(row.precioUnit)) !== Math.round(parseFloat(row.precioCatalogo))
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-700 dark:text-slate-200"
                    )}
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

            {/* Listas de productos para elegir por fila (según el proveedor de la fila) */}
            {Array.from(new Set(rows.map((r) => r.proveedorId || smartProv || 'todos'))).map((clave) => (
              <datalist key={clave} id={`dl-prov-${clave}`}>
                {productosDeProveedor(clave === 'todos' ? '' : clave).map((pr) => (
                  <option key={pr.id} value={pr.nombre} />
                ))}
              </datalist>
            ))}

            {/* 🩹 2026-10-09: nombres que no coinciden igualito con el catálogo */}
            {(() => {
              const avisos = rows
                .filter((r) => r.desc.trim().length >= 3)
                .map((r) => {
                  const exacto = catalogoTabla.productos.some((p) => normNombre(p.nombre) === normNombre(r.desc));
                  if (exacto) return null;
                  const m = matchProductoEnCatalogo(r.desc, catalogoTabla.productos, (p) => p.nombre || '');
                  return { r, sugerido: m.indice >= 0 ? catalogoTabla.productos[m.indice] : null };
                })
                .filter((x): x is { r: (typeof rows)[number]; sugerido: Producto | null } => !!x);
              if (avisos.length === 0) return null;
              return (
                <div className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-sky-800 dark:text-sky-300">
                    Productos con nombre distinto al catálogo
                  </p>
                  {avisos.map(({ r, sugerido }) => (
                    <div key={r.id} className="text-sm font-bold text-sky-900 dark:text-sky-100 space-y-1">
                      {sugerido ? (
                        <>
                          <p>
                            «{r.desc.trim()}» se parece a «{sugerido.nombre}» del catálogo
                            {(r.proveedorId || smartProv) ? ' (al guardar se junta con ese).' : '.'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, 'desc', sugerido.nombre)}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black"
                            >
                              Usar «{sugerido.nombre}»
                            </button>
                            <button
                              type="button"
                              onClick={() => void renombrarEnCatalogo(sugerido, r.desc)}
                              className="px-3 py-1.5 rounded-lg border border-sky-400 text-sky-800 dark:text-sky-200 text-xs font-black hover:bg-sky-100 dark:hover:bg-sky-900/40"
                            >
                              Cambiar el del catálogo a «{r.desc.trim()}»
                            </button>
                          </div>
                        </>
                      ) : (
                        <p>
                          «{r.desc.trim()}» no está en el catálogo
                          {(r.proveedorId || smartProv)
                            ? ' — al guardar se crea como producto nuevo.'
                            : ' — sin proveedor queda solo como gasto (no entra al catálogo).'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 🩹 2026-10-09: precios corregidos → se guardan en el catálogo al guardar */}
            {(() => {
              const cambios = rows.filter((r) =>
                r.desc.trim() && r.precioCatalogo && r.precioUnit &&
                Math.round(parseFloat(r.precioUnit)) !== Math.round(parseFloat(r.precioCatalogo))
              );
              if (cambios.length === 0) return null;
              const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
              return (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">
                    Precios que cambiaron (se actualizan en el catálogo al guardar)
                  </p>
                  {cambios.map((r) => {
                    const antes = parseFloat(r.precioCatalogo);
                    const ahora = parseFloat(r.precioUnit);
                    const tieneProv = !!(r.proveedorId || smartProv);
                    return (
                      <p key={r.id} className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        {ahora > antes ? '⬆️' : '⬇️'} {r.desc}: {fmt(antes)} → {fmt(ahora)}
                        {!tieneProv && (
                          <span className="text-[11px] font-semibold text-rose-600"> (elige el proveedor para que se guarde en el catálogo)</span>
                        )}
                      </p>
                    );
                  })}
                </div>
              );
            })()}

            {/* 🩹 2026-10-09: total de cada factura (por proveedor) + total general */}
            {(() => {
              const filas = rows.filter((r) => r.desc.trim() && (parseFloat(r.monto) || 0) > 0);
              if (filas.length === 0) return null;
              const porProv = new Map<string, { productos: number; total: number }>();
              for (const r of filas) {
                const clave = r.proveedorId || smartProv || '';
                const act = porProv.get(clave) ?? { productos: 0, total: 0 };
                act.productos += 1;
                act.total += parseFloat(r.monto) || 0;
                porProv.set(clave, act);
              }
              const totalTabla = filas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
              const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-1">
                  {Array.from(porProv.entries()).map(([provId, info]) => (
                    <div key={provId || 'sin'} className="flex justify-between gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <span className="truncate">
                        🧾 {provId ? (proveedores.find((p) => p.id === provId)?.nombre ?? 'Proveedor') : 'Sin proveedor'}
                        <span className="text-[11px] font-semibold text-slate-500"> · {info.productos} producto{info.productos === 1 ? '' : 's'}</span>
                      </span>
                      <span className="tabular-nums">{fmt(info.total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2 pt-1 mt-1 border-t border-slate-200 dark:border-slate-700 text-base font-black text-slate-900 dark:text-white">
                    <span>Total a pagar</span>
                    <span className="tabular-nums">{fmt(totalTabla)}</span>
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setRows([...rows, FILA_VACIA()])}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-black text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            >
              <PlusCircle className="w-4 h-4" /> Agregar otro producto
            </button>

            <div className="flex flex-wrap gap-2 justify-end">
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
              </>
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










