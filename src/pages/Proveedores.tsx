import { useState, useMemo, useCallback } from 'react';
import { validarCatalogo } from '@/lib/price-guard';
import { useCan } from '@/contexts/AuthContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Package,
  MessageCircle,
  Star,
  Building2,
  UserCheck,
  SortAsc,
  Download,
  Tag,
  FileText,
  ChevronDown,
  PhoneCall,
  AlertTriangle,
  Store,
  FlaskConical,
  BarChart3,
  Zap,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Filter,
  Database,
  Bell,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor, ProductoTipo, Categoria } from '@/types';
import { ProveedorForm, type ProductoCatalogo } from '@/components/proveedores/ProveedorForm';
import { AnalisisInteligente, getScheduleAlerta } from '@/components/proveedores/AnalisisInteligente';
import { ComparadorPrecios } from '@/components/prepedidos/ComparadorPrecios';

/* ── Tipos para la vista ── */
type TipoEmbalaje =
  | 'unidad' | 'paca'   | 'sipak'  | 'saco'   | 'caja'   | 'bolsa'
  | 'bandeja'| 'bulto'  | 'bloque' | 'tarro'  | 'costal' | 'garrafa'
  | 'caneca' | 'arroba' | 'docena' | 'rollo'  | 'atado'  | 'otro';

const EMBALAJES: { value: TipoEmbalaje; label: string; emoji: string; desc: string }[] = [
  { value: 'unidad',  label: 'Unidad',   emoji: '🔹', desc: 'Producto individual'        },
  { value: 'paca',    label: 'Paca',     emoji: '📦', desc: 'Paquete de unidades'        },
  { value: 'sipak',   label: 'Sipak',    emoji: '🛍️', desc: 'Six-pack / multipack'       },
  { value: 'bloque',  label: 'Bloque',   emoji: '🧱', desc: 'Bloque compacto'            },
  { value: 'bulto',   label: 'Bulto',    emoji: '🎁', desc: 'Bulto o fardo'              },
  { value: 'tarro',   label: 'Tarro',    emoji: '🫙', desc: 'Tarro, lata o frasco'       },
  { value: 'saco',    label: 'Saco',     emoji: '🌾', desc: 'Saco o costal pequeño'      },
  { value: 'costal',  label: 'Costal',   emoji: '⛽', desc: 'Costal grande (50 kg+)'     },
  { value: 'caja',    label: 'Caja',     emoji: '📫', desc: 'Caja de cartón o madera'    },
  { value: 'bolsa',   label: 'Bolsa',    emoji: '🛒', desc: 'Bolsa plástica o de tela'   },
  { value: 'garrafa', label: 'Garrafa',  emoji: '🧴', desc: 'Garrafa o bidón de líquido' },
  { value: 'caneca',  label: 'Caneca',   emoji: '🪣', desc: 'Caneca o tambor'            },
  { value: 'bandeja', label: 'Bandeja',  emoji: '🍱', desc: 'Bandeja o charola'          },
  { value: 'arroba',  label: 'Arroba',   emoji: '⚖️', desc: 'Arroba (11.5 kg)'           },
  { value: 'docena',  label: 'Docena',   emoji: '🔢', desc: '12 unidades'                },
  { value: 'rollo',   label: 'Rollo',    emoji: '🧻', desc: 'Rollo o bobina'             },
  { value: 'atado',   label: 'Atado',    emoji: '🪢', desc: 'Atado o manojo'             },
  { value: 'otro',    label: 'Otro',     emoji: '🔖', desc: 'Tipo personalizado'         },
];

const CATEGORIAS_PROD = [
  'Harinas y Materia Prima', 'Azúcares y Endulzantes', 'Lácteos y Huevos',
  'Levaduras y Aditivos', 'Aceites y Grasas', 'Frutas y Verduras',
  'Carnes y Embutidos', 'Bebidas', 'Empaques y Desechables',
  'Condimentos y Salsas', 'Granos y Semillas', 'Otro',
];

// Componentes auxiliares fuera del componente principal para evitar remount en cada render
function ProveedorAvatar({ proveedor, size = 'md' }: { proveedor: Proveedor; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-28 h-28 text-5xl rounded-[2rem]' : size === 'sm' ? 'w-10 h-10 text-base rounded-xl' : 'w-16 h-16 text-3xl rounded-[1.5rem]';
  return proveedor.imagen ? (
    <img src={proveedor.imagen} alt={proveedor.nombre} className={cn(cls, 'object-cover border-2 border-white/20 shadow-xl')} />
  ) : (
    <div className={cn(cls, 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black border-2 border-white/10 shadow-xl')}>
      {proveedor.nombre.charAt(0).toUpperCase()}
    </div>
  );
}

function EstrellasRating({ val }: { val: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={cn('w-3.5 h-3.5', s <= val ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700')} />
      ))}
    </div>
  );
}

interface ProveedoresProps {
  proveedores: Proveedor[];
  productos: Producto[];
  precios: PrecioProveedor[];
  onAddProveedor: (proveedor: Omit<Proveedor, 'id' | 'createdAt'>) => Promise<Proveedor>;
  onUpdateProveedor: (id: string, updates: Partial<Proveedor>) => void;
  onDeleteProveedor: (id: string) => void;
  onAddProducto: (p: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
  onAddOrUpdatePrecio: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string; destino?: 'venta' | 'insumo'; tipoEmbalaje?: string; cantidadEmbalaje?: number }) => Promise<void>;
  onDeletePrecio: (id: string) => void;
  onDeleteProducto: (id: string) => Promise<void>;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  onUpdateProducto: (id: string, updates: Partial<Producto>) => void;
  onAjustarStock?: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida', motivo: string) => Promise<void>;
  onNavigateTo?: (view: string) => void;
  categorias?: Categoria[];
}

type OrdenTipo = 'nombre' | 'calificacion' | 'insumos';
type VistasTipo = 'grid' | 'lista';
type TabDetalle = 'contacto' | 'catalogo' | 'analisis';

const RUBROS = [
  'Panadería / Pastelería',
  'Lácteos',
  'Aceites y Grasas',
  'Harinas y Cereales',
  'Azúcar y Edulcorantes',
  'Empaques / Packaging',
  'Frutas y Verduras',
  'Carnes y Proteínas',
  'Bebidas',
  'Limpieza e Higiene',
  'Equipamiento',
  'Otro',
];

export function Proveedores({
  proveedores,
  productos: _productos,
  precios: _precios,
  onAddProveedor,
  onUpdateProveedor,
  onDeleteProveedor,
  onAddProducto,
  onAddOrUpdatePrecio,
  onDeletePrecio,
  onDeleteProducto,
  getPreciosByProveedor,
  getProductoById,
  formatCurrency,
  onUpdateProducto,
  onAjustarStock,
  onNavigateTo,
  categorias = [],
}: ProveedoresProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { check } = useCan();
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [orden, setOrden] = useState<OrdenTipo>('nombre');
  const [vistaActual] = useState<VistasTipo>('lista');
  const [activeView, setActiveView] = useState<'lista' | 'comparador'>('lista');
  const [soloActivos, setSoloActivos] = useState(false);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('contacto');
  // Dialog de confirmacion de eliminacion
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  const [selectedProvId, setSelectedProvId] = useState<string | null>(null);

  /* ─── Estado catálogo de productos para el componente Form ─── */
  const [catalogoParaForm, setCatalogoParaForm] = useState<ProductoCatalogo[]>([]);

  /* ─── Recuperación de proveedores eliminados ─── */
  const [showRecuperarDialog, setShowRecuperarDialog] = useState(false);
  const [buscandoEliminados, setBuscandoEliminados] = useState(false);
  const [proveedoresEliminados, setProveedoresEliminados] = useState<Array<{
    proveedor: any; precios: any[]; recuperando: boolean; yaExisteLocal: boolean;
  }>>([]);

  const buscarProveedoresEliminados = useCallback(async () => {
    setBuscandoEliminados(true);
    setShowRecuperarDialog(true);
    setProveedoresEliminados([]);
    try {
      // Traer TODOS los proveedores de Supabase
      const { data: supabaseProvs, error } = await supabase
        .from('proveedores')
        .select('*');
      if (error || !supabaseProvs || supabaseProvs.length === 0) {
        toast.info('No se encontraron proveedores en la nube.');
        setShowRecuperarDialog(false);
        return;
      }

      // Comparar contra los que ya existen localmente
      const localProvs = await db.getAllProveedores();
      const localIds = new Set(localProvs.map((p: any) => p.id));

      // Traer precios de todos y ordenar: primero los que tienen más productos
      const resultados = await Promise.all(
        supabaseProvs.map(async (prov) => {
          const { data: preciosData } = await supabase
            .from('precios').select('*').eq('proveedor_id', prov.id);
          return {
            proveedor: prov,
            precios: preciosData || [],
            recuperando: false,
            yaExisteLocal: localIds.has(prov.id),
          };
        })
      );

      // Ordenar: primero los que tienen productos, luego los que no están en local
      resultados.sort((a, b) => {
        if (b.precios.length !== a.precios.length) return b.precios.length - a.precios.length;
        return a.yaExisteLocal ? 1 : -1;
      });

      setProveedoresEliminados(resultados);
    } catch (err) {
      console.error('[Recuperar] Error:', err);
      toast.error('Error al buscar en la nube. Verifica la conexión.');
      setShowRecuperarDialog(false);
    } finally {
      setBuscandoEliminados(false);
    }
  }, []);

  const recuperarProveedor = useCallback(async (idx: number) => {
    const entry = proveedoresEliminados[idx];
    if (!entry) return;
    setProveedoresEliminados(prev =>
      prev.map((e, i) => i === idx ? { ...e, recuperando: true } : e)
    );
    try {
      const p = entry.proveedor;
      const provData = {
        id: p.id,
        nombre: p.nombre || '',
        contacto: p.contacto || '',
        telefono: p.telefono || '',
        email: p.email || '',
        direccion: p.direccion || '',
        ubicacion: p.ubicacion || '',
        imagen: p.imagen || '',
        calificacion: p.calificacion || 5,
        activo: p.activo !== false,
        rubro: p.rubro || '',
        notas: p.notas || '',
        createdAt: p.created_at || new Date().toISOString(),
      };
      // Limpiar tombstone del ID actual (por si existe) y todos los tombstones
      // de proveedores con este mismo nombre (IDs viejos de versiones anteriores)
      const tombedProvIds = await db.getTombstones('proveedores').catch(() => [] as string[]);
      await Promise.all(tombedProvIds.map((tid: string) => db.removeTombstone('proveedores', tid).catch(() => {})));
      await db.addProveedor(provData);
      // Restaurar precios limpiando tombstones previos también
      const tombedPrecioIds = await db.getTombstones('precios').catch(() => [] as string[]);
      await Promise.all(tombedPrecioIds.map((tid: string) => db.removeTombstone('precios', tid).catch(() => {})));
      for (const precio of entry.precios) {
        const precioData = {
          id: precio.id,
          productoId: precio.producto_id,
          proveedorId: precio.proveedor_id,
          precioCosto: precio.precio_costo || 0,
          fechaActualizacion: precio.fecha_actualizacion || new Date().toISOString(),
          notas: precio.notas || '',
          destino: precio.destino || 'insumo',
          tipoEmbalaje: precio.tipo_embalaje || 'unidad',
          cantidadEmbalaje: precio.cantidad_embalaje || 1,
        };
        await db.addPrecio(precioData);
      }
      toast.success(`✅ "${p.nombre}" recuperado con ${entry.precios.length} producto(s). Recargando...`);
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      console.error('[Recuperar] Error al restaurar:', err);
      toast.error('Error al recuperar. Verifica la conexión e intenta de nuevo.');
      setProveedoresEliminados(prev =>
        prev.map((e, i) => i === idx ? { ...e, recuperando: false } : e)
      );
    }
  }, [proveedoresEliminados]);


  /* ─── Helper: obtener precios válidos (sin fantasmas ni duplicados) ─── */
  const getInsumosValidos = useCallback((provId: string): PrecioProveedor[] => {
    const todos = getPreciosByProveedor(provId);
    // Deduplicar por productoId + empaque + cantidad (permite diferentes presentaciones del mismo producto)
    const mapa = new Map<string, PrecioProveedor>();
    for (const p of todos) {
      if (!getProductoById(p.productoId)) continue; // Saltar fantasmas
      
      const qty = Number(p.cantidadEmbalaje) || 1;
      const tipo = p.tipoEmbalaje || 'unidad';
      const key = `${p.productoId}-${tipo}-${qty}`;
      
      const existing = mapa.get(key);
      if (!existing) {
        mapa.set(key, p);
      } else {
        // En caso de conflicto exacto (mismo producto y misma presentación)
        // Prioridad 1: El que tenga costo válido
        const pCosto = Number(p.precioCosto) || 0;
        const eCosto = Number(existing.precioCosto) || 0;
        
        if (pCosto > 0 && eCosto <= 0) {
          mapa.set(key, p);
        } else if (pCosto <= 0 && eCosto > 0) {
          // Mantener existing
        } else {
          // Prioridad 2: El más reciente
          if ((p.fechaActualizacion || '') > (existing.fechaActualizacion || '')) {
            mapa.set(key, p);
          }
        }
      }
    }
    return Array.from(mapa.values());
  }, [getPreciosByProveedor, getProductoById]);

  /* ─── Detectar y limpiar registros huérfanos/duplicados de un proveedor ─── */
  const limpiarCatalogoProveedor = useCallback(async (provId: string) => {
    const todos = getPreciosByProveedor(provId);
    const validos = new Set(getInsumosValidos(provId).map(p => p.id));
    const aEliminar = todos.filter(p => !validos.has(p.id));
    if (aEliminar.length === 0) {
      toast.info('El catálogo ya está limpio — no hay registros duplicados ni fantasmas.');
      return;
    }
    for (const p of aEliminar) {
      await onDeletePrecio(p.id);
    }
    toast.success(`✅ Se eliminaron ${aEliminar.length} registro(s) duplicado(s) o huérfano(s).`);
  }, [getPreciosByProveedor, getInsumosValidos, onDeletePrecio]);

  /* ─── Reparación global de datos contaminados entre proveedores ─── */
  const repararDatosGlobal = useCallback(async () => {
    let corregidos = 0;
    // Para cada producto compartido entre múltiples proveedores, el tipo del Producto
    // debe reflejar el consenso: si ALGÚN proveedor lo marca como insumo, el tipo
    // debe ser 'ingrediente' a menos que TODOS lo marquen como venta.
    const todosLosPrecios = proveedores.flatMap(pv => getPreciosByProveedor(pv.id));
    const porProducto = new Map<string, { insumo: boolean; venta: boolean }>();
    for (const p of todosLosPrecios) {
      const entrada = porProducto.get(p.productoId) || { insumo: false, venta: false };
      if (p.destino === 'insumo') entrada.insumo = true;
      else entrada.venta = true;
      porProducto.set(p.productoId, entrada);
    }
    for (const [productoId, flags] of porProducto.entries()) {
      const prod = getProductoById(productoId);
      if (!prod) continue;
      // Si tiene entradas como insumo en algún proveedor pero está marcado como elaborado → corregir
      if (flags.insumo && !flags.venta && prod.tipo === 'elaborado') {
        await onUpdateProducto(productoId, { tipo: 'ingrediente' as any, updatedAt: new Date().toISOString() });
        corregidos++;
      }
    }
    if (corregidos === 0) {
      toast.info('✅ Los datos ya están consistentes — no se encontraron productos mal clasificados.');
    } else {
      toast.success(`✅ Se corrigieron ${corregidos} producto(s) mal clasificados. Recarga la vista de Ventas.`);
    }
  }, [proveedores, getPreciosByProveedor, getProductoById, onUpdateProducto]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const totalInsumos = proveedores.reduce((acc, p) => acc + getInsumosValidos(p.id).length, 0);
    const activos = proveedores.filter(p => (p as any).activo !== false).length;
    const mejorCalificado = proveedores.reduce<Proveedor | null>((best, p) =>
      !best || (p.calificacion || 0) > (best.calificacion || 0) ? p : best, null);
    const promedioRating = proveedores.length
      ? proveedores.reduce((s, p) => s + (p.calificacion || 5), 0) / proveedores.length
      : 0;
    const conProductos = proveedores.filter(p => getInsumosValidos(p.id).length > 0).length;
    const sinProductos = proveedores.length - conProductos;
    return { totalInsumos, activos, mejorCalificado, promedioRating, conProductos, sinProductos };
  }, [proveedores, getInsumosValidos]);

  /* ─── Alertas de visitas próximas ─── */
  const alertasVisita = useMemo(() => {
    return proveedores
      .map(p => ({ prov: p, alerta: getScheduleAlerta(p.id) }))
      .filter(x => x.alerta !== null) as { prov: Proveedor; alerta: { diasRestantes: number; proximaVisita: string } }[];
  }, [proveedores]);

  /* ─── Filtrado + orden ─── */
  const filtrados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let lista = proveedores.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.contacto && p.contacto.toLowerCase().includes(term)) ||
      (p.telefono && p.telefono.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term)) ||
      (p.direccion && p.direccion.toLowerCase().includes(term))
    );
    if (soloActivos) lista = lista.filter(p => (p as any).activo !== false);
    if (filtroRubro) lista = lista.filter(p => (p as any).rubro === filtroRubro);
    return lista.sort((a, b) => {
      if (orden === 'calificacion') return (b.calificacion || 5) - (a.calificacion || 5);
      if (orden === 'insumos') return getPreciosByProveedor(b.id).length - getPreciosByProveedor(a.id).length;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [proveedores, searchTerm, orden, soloActivos, filtroRubro, getPreciosByProveedor]);

  /* ─── Exportar CSV ─── */
  const exportarCSV = () => {
    const headers = ['Nombre', 'Rubro', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Calificación', 'Insumos', 'Estado'];
    const filas = filtrados.map(p => [
      p.nombre,
      (p as any).rubro || '',
      p.contacto || '',
      p.telefono || '',
      p.email || '',
      p.direccion || '',
      p.calificacion || 5,
      getPreciosByProveedor(p.id).length,
      (p as any).activo !== false ? 'Activo' : 'Inactivo',
    ]);
    const csv = [headers, ...filas].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proveedores_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtrados.length} proveedores exportados`);
  };

  /* ─── Formulario ─── */
  const handleSubmit = async (data: any, items: ProductoCatalogo[]) => {
    // 🛡️ GUARD: verificar que las funciones críticas están conectadas antes de intentar guardar
    if (!onAddProducto || !onAddOrUpdatePrecio || !onUpdateProducto) {
      console.error('[Proveedores] GUARD ACTIVADO — props de guardado no conectadas:', {
        onAddProducto: !!onAddProducto,
        onAddOrUpdatePrecio: !!onAddOrUpdatePrecio,
        onUpdateProducto: !!onUpdateProducto,
      });
      toast.error('⛔ Error interno: el módulo no está correctamente inicializado. Recarga la página.');
      return;
    }
    if (!data.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    try {
      let provId: string;
      if (editingProveedor) {
        await onUpdateProveedor(editingProveedor.id, data);
        provId = editingProveedor.id;
        toast.success('Proveedor actualizado');
      } else {
        const nuevo = await onAddProveedor(data);
        provId = nuevo.id;
        toast.success('Proveedor creado');
      }

      // Eliminar precios que el usuario quitó del catálogo
      if (editingProveedor && onDeletePrecio) {
        const preciosOriginales = getPreciosByProveedor(editingProveedor.id);
        const uidsActuales = new Set(items.map(i => i.uid));
        const preciosAEliminar = preciosOriginales.filter(p => !uidsActuales.has(p.id));
        const idsAEliminar = new Set(preciosAEliminar.map(p => p.id));
        for (const precio of preciosAEliminar) {
          await onDeletePrecio(precio.id);
        }
        // Eliminar el producto si quedó sin ningún proveedor que lo venda
        if (onDeleteProducto) {
          for (const precio of preciosAEliminar) {
            const otrosPrecios = _precios.filter(
              p => p.productoId === precio.productoId && !idsAEliminar.has(p.id)
            );
            if (otrosPrecios.length === 0) {
              await onDeleteProducto(precio.productoId);
            }
          }
        }
      }

      // ── NIVEL 1: Validar márgenes y precios antes de guardar ──────────────
      if (items.length > 0) {
        // Construir mapa de precios anteriores para detectar cambios extremos
        const preciosAnteriores: Record<string, number> = {};
        if (editingProveedor) {
          getPreciosByProveedor(editingProveedor.id).forEach(p => {
            const prod = getProductoById(p.productoId);
            if (prod) preciosAnteriores[prod.nombre] = p.precioCosto;
          });
        }

        const { bloquear, erroresBloqueantes, advertencias } = validarCatalogo(items, preciosAnteriores);

        if (bloquear) {
          toast.error(
            `⛔ No se puede guardar — corrige estos problemas:\n${erroresBloqueantes.slice(0, 4).join('\n')}`,
            { duration: 10000 }
          );
          // Lanzar para que el formulario NO se cierre ni borre el catálogo
          throw new Error('VALIDATION_BLOCK');
        }

        if (advertencias.length > 0) {
          // Advertencia suave: muestra pero permite continuar
          toast.warning(
            `⚠️ Precio inusual detectado:\n${advertencias.slice(0, 2).join('\n')}`,
            { duration: 6000 }
          );
        }
      }

      // Guardar productos del catálogo
      if (items.length > 0) {
        for (const item of items) {
          try {
            let productoId = item.productoId;

            // Buscar etiquetas de embalaje con seguridad (Nexus-Shield-Guard)
            const infoEmbalaje = EMBALAJES.find(e => e.value === item.tipoEmbalaje) || { label: 'Unidad', emoji: '🔹' };
            const descripcionGenerada = `${infoEmbalaje.label} x${item.cantidadEmbalaje || 1}`;

            // Crear producto si no existe o si el ID apunta a un producto eliminado (huérfano)
            const yaExiste = productoId ? !!getProductoById(productoId) : false;

            // Si no hay productoId (el usuario escribió el nombre sin seleccionar del dropdown),
            // buscar si ya existe un producto con ese nombre exacto para reutilizarlo en vez de duplicar
            if (!productoId || !yaExiste) {
              const nombreNorm = item.nombre.trim().toLowerCase();
              const productoHomonimo = _productos.find(p => p.nombre.trim().toLowerCase() === nombreNorm);
              if (productoHomonimo) {
                productoId = productoHomonimo.id;
              }
            }

            // Crear producto solo si después de la búsqueda por nombre todavía no hay un ID válido
            const productoIdFinal = productoId ? !!getProductoById(productoId) : false;
            if (!productoId || !productoIdFinal) {
              const tipo: ProductoTipo = item.destino === 'venta' ? 'elaborado' : 'ingrediente';
              const np = await onAddProducto({
                nombre: item.nombre,
                categoria: item.categoria || 'Otro',
                descripcion: descripcionGenerada,
                precioVenta: Math.round((Number(item.precioVenta) || 0) / 100) * 100,
                margenUtilidad: Number(item.margenVenta) || 30,
                tipo,
                costoBase: Math.round((Number(item.costoUnitario) || 0) / 100) * 100,
              });
              productoId = np.id;
            }

            if (productoId) {
              await onAddOrUpdatePrecio({
                productoId,
                proveedorId: provId,
                precioCosto: Math.round((Number(item.precioCosto) || 0) / 100) * 100,
                notas: item.notas || descripcionGenerada,
                destino: item.destino,
                tipoEmbalaje: item.tipoEmbalaje,
                cantidadEmbalaje: Number(item.cantidadEmbalaje) || 1,
              });

              // Sincronización con Módulo de Productos
              const tipo: ProductoTipo = item.destino === 'venta' ? 'elaborado' : 'ingrediente';
              // Si el producto está compartido entre varios proveedores, solo actualizar campos
              // neutros (nombre, tipo, descripción). Los campos económicos (categoría, margen,
              // precio, costoBase) son contextuales al proveedor y no deben contaminar a los otros.
              const esCompartido = _precios.some(
                p => p.productoId === productoId && p.proveedorId !== provId
              );
              await onUpdateProducto(productoId, {
                nombre: item.nombre,
                descripcion: descripcionGenerada,
                tipo,
                updatedAt: new Date().toISOString(),
                ...(!esCompartido && {
                  categoria: item.categoria || 'Otro',
                  costoBase: Math.round((Number(item.costoUnitario) || 0) / 100) * 100,
                  margenUtilidad: Number(item.margenVenta) || 30,
                  precioVenta: Math.round((Number(item.precioVenta) || 0) / 100) * 100,
                }),
              });

              // AJUSTE DE STOCK AUTOMÁTICO
              if (onAjustarStock && item.stockRecibido > 0) {
                await onAjustarStock(
                  productoId,
                  Number(item.stockRecibido),
                  'entrada',
                  `Proveedor: ${data.nombre} (Sincronización)`
                );
              }
            }
          } catch (itemErr) {
            console.error(`❌ [Nexus] Error procesando item ${item.nombre}:`, itemErr);
            toast.error(`Error con el producto: ${item.nombre}`);
            // Continuamos con el siguiente item si uno falla (estrategia Best-Effort)
          }
        }
        toast.success(`${items.length} producto(s) gestionados correctamente`);
      }
      setIsDialogOpen(false);
      setEditingProveedor(null);
    } catch (err) {
      // Re-lanzar VALIDATION_BLOCK para que ProveedorForm.handleSave lo capture
      // y mantenga el formulario abierto con los datos intactos.
      if (err instanceof Error && err.message === 'VALIDATION_BLOCK') {
        throw err;
      }
      console.error("❌ [Nexus-Volt] Error crítico en el flujo de guardado:", err);
      toast.error('Error al guardar. Verifica los datos e intenta de nuevo.');
    }
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    // Pre-cargar solo precios válidos (sin fantasmas ni duplicados)
    const preciosExistentes = getInsumosValidos(proveedor.id);
    const itemsPreCargados: ProductoCatalogo[] = preciosExistentes.map(precio => {
      const prod = getProductoById(precio.productoId);
      return {
        uid: precio.id,
        productoId: precio.productoId,
        nombre: prod?.nombre || 'Producto eliminado',
        categoria: prod?.categoria || CATEGORIAS_PROD[0],
        precioCosto: precio.precioCosto,
        margenVenta: prod?.margenUtilidad || 30,
        cantidadEmbalaje: precio.cantidadEmbalaje || 1,
        tipoEmbalaje: (precio.tipoEmbalaje as any) || 'unidad',
        // Fallback inteligente: primero el campo guardado, luego el tipo del producto
        destino: precio.destino || (prod?.tipo === 'elaborado' ? 'venta' : 'insumo'),
        notas: precio.notas || '',
        costoUnitario: precio.cantidadEmbalaje ? Math.round(precio.precioCosto / precio.cantidadEmbalaje / 100) * 100 : precio.precioCosto,
        precioVenta: Math.round((prod?.precioVenta || 0) / 100) * 100,
        precioVentaPack: prod?.precioVenta ? Math.round(prod.precioVenta * (precio.cantidadEmbalaje || 1) / 100) * 100 : 0,
        stockRecibido: 0, // Campo requerido por la interfaz ProductoCatalogo
      };
    });
    setCatalogoParaForm(itemsPreCargados);
    setIsDialogOpen(true);
  };

  const confirmarEliminar = (prov: Proveedor) => setDeleteTarget(prov);

  const ejecutarEliminar = () => {
    if (!deleteTarget) return;
    onDeleteProveedor(deleteTarget.id);
    toast.success('Proveedor eliminado');
    setDeleteTarget(null);
  };

  // Avatar y Estrellas ahora son ProveedorAvatar y EstrellasRating — definidas fuera del componente

  /* ─── Metricas reales del proveedor ─── */
  const getMetricasProveedor = (prov: Proveedor) => {
    const insumos = getInsumosValidos(prov.id);
    const calidad = Math.round(((prov.calificacion || 5) / 5) * 100);
    const cobertura = insumos.length > 0 ? Math.min(100, Math.round((insumos.length / 10) * 100)) : 0;
    let margenPromedio = 0;
    if (insumos.length > 0) {
      const margenes = insumos.map(pr => {
        const prod = getProductoById(pr.productoId);
        if (!prod) return 0;
        // Usar costo UNITARIO (no el precio del pack) para comparar vs precioVenta unitario
        const cantEmbalaje = Number((pr as any).cantidadEmbalaje || 1) || 1;
        const costoUnit = Number(pr.precioCosto || 0) / cantEmbalaje;
        const venta = Number(prod.precioVenta || 0);
        return costoUnit > 0 ? ((venta - costoUnit) / costoUnit) * 100 : 0;
      });
      margenPromedio = margenes.length > 0 ? Math.round(margenes.reduce((s, m) => s + m, 0) / margenes.length) : 0;
    }
    return { calidad, cobertura, margenPromedio };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  
  if (activeView === 'comparador') {
    return (
      <ComparadorPrecios 
        proveedores={proveedores} 
        productos={_productos} 
        precios={_precios} 
        formatCurrency={formatCurrency} 
        onVolver={() => setActiveView('lista')} 
      />
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Gestión de Proveedores</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Aliados estratégicos · Dulce Placer</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar nombre, contacto, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>
          <Button
            variant="outline"
            onClick={exportarCSV}
            className="h-10 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
          >
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button
            onClick={() => setActiveView('comparador')}
            className="h-10 px-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 shadow-none border-none rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
          >
            <TrendingDown className="w-4 h-4" />
            Comparar Precios
          </Button>
          <Button
            onClick={repararDatosGlobal}
            title="Corrige productos mal clasificados que aparecen en el carrito de ventas sin ser productos elaborados"
            className="h-10 px-3 bg-amber-500 hover:bg-amber-600 text-white shadow-none border-none rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
          >
            <FlaskConical className="w-4 h-4" />
            Reparar
          </Button>
          <Button
            onClick={buscarProveedoresEliminados}
            title="Busca y recupera proveedores eliminados desde la copia de seguridad en la nube"
            className="h-10 px-3 bg-rose-500 hover:bg-rose-600 text-white shadow-none border-none rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Recuperar
          </Button>
           {check('CREAR_PROVEEDORES') && (
            <Button
              onClick={() => { setEditingProveedor(null); setCatalogoParaForm([]); setIsDialogOpen(true); }}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo
            </Button>
          )}
        </div>
      </header>

      {/* ── KPI Strip ── */}
      {proveedores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Proveedores', valor: proveedores.length, icon: Building2, color: 'blue' },
            { label: 'Con Productos', valor: kpis.conProductos, icon: CheckCircle2, color: 'emerald' },
            { label: 'Insumos cargados', valor: kpis.totalInsumos, icon: Package, color: 'indigo' },
            { label: 'Rating promedio', valor: kpis.promedioRating.toFixed(1), icon: Star, color: 'amber' },
            { label: 'Sin Productos', valor: kpis.sinProductos, icon: AlertTriangle, color: 'violet' },
          ].map(({ label, valor, icon: Icon, color }) => (
            <div key={label} className="p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                color === 'blue' && 'bg-blue-50 dark:bg-blue-900/30',
                color === 'emerald' && 'bg-emerald-50 dark:bg-emerald-900/30',
                color === 'indigo' && 'bg-indigo-50 dark:bg-indigo-900/30',
                color === 'amber' && 'bg-amber-50 dark:bg-amber-900/30',
                color === 'violet' && 'bg-violet-50 dark:bg-violet-900/30',
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  color === 'blue' && 'text-blue-600',
                  color === 'emerald' && 'text-emerald-600',
                  color === 'indigo' && 'text-indigo-600',
                  color === 'amber' && 'text-amber-500',
                  color === 'violet' && 'text-violet-600',
                )} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 truncate">{label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-white truncate">{valor}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Alertas de visitas próximas ── */}
      {alertasVisita.length > 0 && (
        <div className="flex flex-col gap-2">
          {alertasVisita.map(({ prov, alerta }) => (
            <div key={prov.id} className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl border',
              alerta.diasRestantes <= 0
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                : alerta.diasRestantes <= 1
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
            )}>
              <Bell className={cn('w-4 h-4 shrink-0',
                alerta.diasRestantes <= 0 ? 'text-red-600' :
                alerta.diasRestantes <= 1 ? 'text-amber-600' : 'text-yellow-600'
              )} />
              <p className="text-xs font-black text-slate-800 dark:text-white flex-1">
                {alerta.diasRestantes <= 0
                  ? `🚨 Hoy llega el preventista de ${prov.nombre} — ¡prepedido listo?`
                  : alerta.diasRestantes === 1
                  ? `🔔 Mañana llega el preventista de ${prov.nombre} — prepara el prepedido`
                  : `📅 En ${alerta.diasRestantes} días llega el preventista de ${prov.nombre}`}
              </p>
              <button
                onClick={() => setSelectedProvId(prov.id)}
                className="shrink-0 text-[10px] font-black text-blue-600 hover:text-blue-800 underline"
              >
                Ver proveedor
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 px-1 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Orden */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl px-4 h-10 shadow-sm">
            <SortAsc className="w-4 h-4 text-blue-500 opacity-60" />
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as OrdenTipo)}
              className="text-[10px] font-black uppercase tracking-widest bg-transparent outline-none text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="nombre">Nombre A-Z</option>
              <option value="calificacion">Mejor calificados</option>
              <option value="insumos">Más insumos</option>
            </select>
          </div>

          {/* Filtro rubro */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl px-4 h-10 shadow-sm">
            <Tag className="w-3.5 h-3.5 text-violet-500 opacity-60" />
            <select
              value={filtroRubro}
              onChange={e => setFiltroRubro(e.target.value)}
              className="text-[10px] font-black uppercase tracking-widest bg-transparent outline-none text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="">Todos los rubros</option>
              {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Filtro activos */}
          <button
            onClick={() => setSoloActivos(!soloActivos)}
            className={cn(
              'flex items-center gap-2 h-10 px-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all',
              soloActivos
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20'
                : 'bg-white dark:bg-gray-900 border-slate-100 dark:border-gray-800 text-slate-500 shadow-sm'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Solo activos
          </button>

          {/* Contador resultados */}
          {(searchTerm || soloActivos || filtroRubro) && (
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 opacity-70">
              {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

      </div>

      {/* ── Contenido: Cuadrícula con desplegable por tarjeta ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-10">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-24 h-24 mb-6 text-blue-500 opacity-50 animate-ag-float" />
            <h3 className="text-xl font-black uppercase tracking-[0.3em] opacity-50">Directorio Vacío</h3>
            <p className="max-w-xs text-[10px] font-bold uppercase tracking-widest mt-3 opacity-50">
              {searchTerm || filtroRubro ? 'Sin resultados para ese filtro.' : 'Registra tu primer proveedor.'}
            </p>
              {/* Removed the empty condition */}
          </div>
        ) : (
          /* ── VISTA GRID / LISTA — un solo map unificado ── */
          <div className={cn(
            'gap-3',
            vistaActual === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              : 'flex flex-col'
          )}>
            {filtrados.map(prov => {
              const activo       = (prov as any).activo !== false;
              const rubro        = (prov as any).rubro as string | undefined;
              const notas        = (prov as any).notas as string | undefined;
              const insumos = getInsumosValidos(prov.id).sort((a, b) => {
                const nombreA = getProductoById(a.productoId)?.nombre || '';
                const nombreB = getProductoById(b.productoId)?.nombre || '';
                return nombreA.localeCompare(nombreB);
              });
              const totalInsumos = insumos.filter(i => i.destino !== 'venta').length;
              const totalVenta   = insumos.filter(i => i.destino === 'venta').length;
              const isSel        = selectedProvId === prov.id;
              return (
                <div key={prov.id} className={cn(
                  'rounded-2xl border-2 overflow-hidden transition-all duration-300 bg-white dark:bg-slate-800',
                  isSel
                    ? vistaActual === 'grid'
                      ? 'border-blue-400 shadow-xl shadow-blue-500/15 col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5'
                      : 'border-blue-400 shadow-xl shadow-blue-500/15'
                    : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 hover:shadow-md'
                )}>
                  <button
                    className={cn('w-full flex items-center gap-3 cursor-pointer group', vistaActual === 'lista' ? 'px-5 py-3' : 'p-3')}
                    onClick={() => {
                      if (!isSel) setTabDetalle('catalogo');
                      setSelectedProvId(isSel ? null : prov.id);
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <ProveedorAvatar proveedor={prov} size={vistaActual === 'grid' && isSel ? 'md' : 'sm'} />
                      <div className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800', activo ? 'bg-emerald-500' : 'bg-slate-300')} />
                    </div>
                    {/* Nombre + rubro */}
                    <div className="min-w-0 flex-1 text-left">
                      {rubro && <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest">{rubro}</p>}
                      <p className={cn('font-black uppercase tracking-tight leading-tight transition-colors break-words', isSel && vistaActual === 'grid' ? 'text-blue-700 dark:text-blue-400 text-base' : 'text-sm text-slate-800 dark:text-white group-hover:text-blue-600')}>{prov.nombre}</p>
                      {/* En grid: badges bajo el nombre */}
                      {vistaActual === 'grid' && (
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <div className="flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            <span className="text-[9px] font-black text-amber-500">{prov.calificacion || 5}</span>
                          </div>
                          {totalInsumos > 0 && <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded"><FlaskConical className="w-2 h-2 inline mr-0.5" />{totalInsumos}</span>}
                          {totalVenta   > 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded"><Store className="w-2 h-2 inline mr-0.5" />{totalVenta}</span>}
                        </div>
                      )}
                    </div>
                    {/* En lista: contacto + badges en línea */}
                    {vistaActual === 'lista' && (
                      <>
                        <div className="hidden md:flex items-center gap-5 shrink-0 text-xs">
                          {prov.telefono && <span className="text-emerald-600 flex items-center gap-1"><Phone className="w-3 h-3" />{prov.telefono}</span>}
                          {prov.email    && <span className="text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{prov.email}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-black text-amber-500">{prov.calificacion || 5}</span>
                          </div>
                          {totalInsumos > 0 && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full"><FlaskConical className="w-2.5 h-2.5 inline mr-0.5" />{totalInsumos} ins.</span>}
                          {totalVenta   > 0 && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full"><Store className="w-2.5 h-2.5 inline mr-0.5" />{totalVenta} vta.</span>}
                        </div>
                      </>
                    )}
                    <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-300', isSel ? 'rotate-180 text-blue-500' : 'text-slate-300 group-hover:text-slate-500')} />
                  </button>

                  {/* ── Panel acordeón inline ── */}
                  {isSel && (
                    <div className="border-t-2 border-blue-100 dark:border-blue-800/40 bg-white dark:bg-slate-900">
                      {/* ── Header: avatar + datos + acciones ── */}
                      <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 border-b border-blue-100 dark:border-blue-800/30 flex items-start gap-5 flex-wrap">
                        <ProveedorAvatar proveedor={prov} size="lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            {rubro && <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-0.5">{rubro}</p>}
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">{prov.nombre}</h3>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={cn('w-3.5 h-3.5', i < (prov.calificacion || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
                              ))}
                              <span className="text-xs font-black text-amber-500 ml-1">{prov.calificacion || 5}.0</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-1">
                            {prov.telefono && (
                              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                <Phone className="w-3.5 h-3.5 shrink-0" />{prov.telefono}
                              </span>
                            )}
                            {prov.contacto && (
                              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold">
                                <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />{prov.contacto}
                              </span>
                            )}
                            {prov.ubicacion && (
                              <span className="flex items-center gap-1.5 text-indigo-500 font-semibold">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />{prov.ubicacion}
                              </span>
                            )}
                            {prov.email && (
                              <span className="flex items-center gap-1.5 text-slate-500">
                                <Mail className="w-3.5 h-3.5 shrink-0" />{prov.email}
                              </span>
                            )}
                            {prov.direccion && (
                              <span className="flex items-center gap-1.5 text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />{prov.direccion}
                              </span>
                            )}
                            {notas && <span className="text-amber-600 italic text-xs md:col-span-2">"{notas}"</span>}
                          </div>
                        </div>
                        {/* Acciones */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {prov.telefono && (
                            <button onClick={() => window.open(`https://wa.me/${(prov.telefono||'').replace(/\D/g,'')}`, '_blank')}
                              className="h-9 px-4 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors">
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                          )}
                          <button onClick={() => handleEdit(prov)}
                            className="h-9 px-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors">
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => confirmarEliminar(prov)}
                            className="h-9 px-4 flex items-center gap-1.5 text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        </div>
                      </div>

                      {/* ── Tabs sutiles ── */}
                      <div className="flex gap-1.5 px-6 py-2 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
                        {([
                          { id: 'catalogo' as TabDetalle, label: `Catálogo (${totalInsumos}🏭 + ${totalVenta}🛒)`, icon: Package },
                          { id: 'analisis' as TabDetalle, label: 'Análisis', icon: BarChart3 },
                          { id: 'contacto' as TabDetalle, label: 'Contacto', icon: UserCheck },
                        ]).map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setTabDetalle(id)}
                            className={cn(
                              'flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all',
                              tabDetalle === id
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/40'
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* ── Tab: Catálogo (tabla de productos) ── */}
                      {tabDetalle === 'catalogo' && (() => {
                        // Detectar registros sucios (fantasmas o duplicados)
                        const totalBruto = getPreciosByProveedor(prov.id).length;
                        const hayRegistrosSucios = totalBruto > insumos.length;
                        return (
                        <>
                          {/* Banner de limpieza cuando hay fantasmas/duplicados */}
                          {hayRegistrosSucios && (
                            <div className="mx-4 mt-3 mb-1 flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-2.5 animate-ag-fade-in">
                              <div className="flex items-center gap-2 min-w-0">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                  {totalBruto - insumos.length} registro(s) duplicado(s) o huérfano(s) detectado(s)
                                </p>
                              </div>
                              <button
                                onClick={() => limpiarCatalogoProveedor(prov.id)}
                                className="shrink-0 h-8 px-3 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                              >
                                <Database className="w-3.5 h-3.5" /> Limpiar
                              </button>
                            </div>
                          )}
                          {insumos.length === 0 ? (
                            <div className="flex flex-col items-center py-10 gap-2 opacity-40">
                              <Package className="w-10 h-10 text-slate-300" />
                              <p className="text-sm font-bold text-slate-400">Sin productos registrados</p>
                              <button onClick={() => handleEdit(prov)} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700">+ Agregar</button>
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-x-auto m-4">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Producto / Insumo</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Und/Pack</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Costo Aliado</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 text-center">Ganancia %</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 text-right">Precio Venta</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 text-right">Ganancia Est.</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Acción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {insumos.map((precio) => {
                                    const prodItem = getProductoById(precio.productoId);
                                    if (!prodItem) return null;
                                    
                                    const nombre = prodItem.nombre;
                                    const categoria = prodItem.categoria;
                                    const destino = precio.destino || (prodItem.tipo === 'ingrediente' ? 'insumo' : 'venta');
                                    const cantidadEmbalaje = precio.cantidadEmbalaje || 1;
                                    const tipoEmbalaje = precio.tipoEmbalaje || 'unidad';
                                    const precioCosto = precio.precioCosto;
                                    const costoUnitario = cantidadEmbalaje > 1 ? Math.round(precioCosto / cantidadEmbalaje / 100) * 100 : precioCosto;
                                    const margenVenta = prodItem.margenUtilidad || 0;
                                    const precioVenta = prodItem.precioVenta || 0;
                                    const costoReal = cantidadEmbalaje > 1 ? precioCosto / cantidadEmbalaje : precioCosto;
                                    const gananciaU = precioVenta - costoReal;
                                    
                                    return (
                                      <tr key={precio.id} className="transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border-l-4 border-transparent group">
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-4">
                                            <div className={cn(
                                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110", 
                                              destino === 'insumo' ? "bg-amber-50 text-amber-500 border-amber-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"
                                            )}>
                                              {destino === 'insumo' ? <FlaskConical className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight truncate">{nombre}</p>
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{categoria}</p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">
                                            {EMBALAJES.find(e => e.value === tipoEmbalaje)?.emoji} {cantidadEmbalaje}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatCurrency(precioCosto)}</p>
                                          {cantidadEmbalaje > 1 && <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">P.U: {formatCurrency(costoUnitario)}</p>}
                                        </td>
                                        <td className="px-4 py-4 text-center font-black text-[10px] text-emerald-600">
                                          {margenVenta}%
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                          <p className="text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(precioVenta)}</p>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                          <p className="text-sm font-black text-amber-500 tabular-nums">
                                            +{formatCurrency(Math.round(gananciaU / 100) * 100)}<span className="text-[9px] text-slate-400">/u</span>
                                          </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() => {
                                                if (window.confirm(`¿Eliminar "${nombre}" del catálogo de ${prov.nombre}?`)) {
                                                  onDeletePrecio(precio.id);
                                                }
                                              }}
                                              className="w-9 h-9 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center justify-center transition-all bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 border"
                                              title="Eliminar"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* ── Asistente de Negocio ── */}
                          {insumos.length > 0 && (
                            <AnalisisInteligente
                              precios={insumos}
                              getProductoById={getProductoById}
                              formatCurrency={formatCurrency}
                              proveedorNombre={prov.nombre}
                              proveedorUbicacion={prov.ubicacion}
                              proveedorId={prov.id}
                            />
                          )}
                        </>
                        );
                      })()}

                      {/* ── Tab: Análisis ── */}
                      {tabDetalle === 'analisis' && (() => {
                        const metricas = getMetricasProveedor(prov);
                        // ── Cálculos financieros del ciclo ──
                        const productosAnalisis = insumos.map(precio => {
                          const prod = getProductoById(precio.productoId);
                          const cantEmb = precio.cantidadEmbalaje || 1;
                          const costoU = precio.precioCosto / cantEmb;
                          const pventa = prod?.precioVenta || 0;
                          const gananciaU = pventa - costoU;
                          const margenPct = costoU > 0 && pventa > 0 ? ((pventa - costoU) / costoU) * 100 : 0;
                          const esVenta = (precio.destino === 'venta') || (!precio.destino && prod?.tipo === 'elaborado');
                          return { nombre: prod?.nombre || 'Producto', costoU, pventa, gananciaU, margenPct, cantEmb, precioCosto: precio.precioCosto, esVenta };
                        });
                        const ventas = productosAnalisis.filter(p => p.esVenta && p.pventa > 0);
                        const inversionTotal = productosAnalisis.reduce((s, p) => s + p.precioCosto, 0);
                        const gananciaCiclo = ventas.reduce((s, p) => s + (p.gananciaU * p.cantEmb), 0);
                        const roiCiclo = inversionTotal > 0 ? (gananciaCiclo / inversionTotal) * 100 : 0;
                        const margenProm = ventas.length > 0 ? ventas.reduce((s, p) => s + p.margenPct, 0) / ventas.length : 0;
                        const topProductos = [...ventas].sort((a, b) => (b.gananciaU * b.cantEmb) - (a.gananciaU * a.cantEmb)).slice(0, 5);
                        const alertasMargen = ventas.filter(p => p.margenPct > 0 && p.margenPct < 25);
                        const estrellasCount = ventas.filter(p => p.margenPct >= 60).length;
                        return (
                          <div className="p-5 space-y-5">
                            {/* Score proveedor */}
                            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-5 relative overflow-hidden">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1">
                                    {prov.ubicacion ? `📍 ${prov.ubicacion} — ` : ''}Score del Proveedor
                                  </p>
                                  <h4 className="text-lg font-black uppercase">{prov.nombre}</h4>
                                  <p className="text-[10px] text-indigo-200 mt-1">
                                    {insumos.length} productos · {ventas.length} de reventa · {insumos.length - ventas.length} insumos producción
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-3xl font-black">{metricas.calidad}%</p>
                                  <p className="text-[9px] font-black uppercase text-indigo-200">Score calidad</p>
                                </div>
                              </div>
                              <div className="mt-4 space-y-2.5">
                                {[
                                  { label: 'Calidad del proveedor', pct: metricas.calidad, color: 'bg-amber-400' },
                                  { label: 'Cobertura del catálogo', pct: metricas.cobertura, color: 'bg-cyan-400' },
                                  { label: 'Rentabilidad del portafolio', pct: Math.min(100, Math.round(roiCiclo)), color: roiCiclo >= 30 ? 'bg-emerald-400' : 'bg-rose-400' },
                                ].map(({ label, pct, color }) => (
                                  <div key={label}>
                                    <div className="flex justify-between text-[9px] font-black uppercase mb-1 text-indigo-100">
                                      <span>{label}</span><span>{pct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full">
                                      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, pct)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <ShieldCheck className="absolute -bottom-4 -right-4 w-28 h-28 opacity-10" />
                            </div>

                            {/* KPIs financieros */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'Inversión x Ciclo', value: formatCurrency(Math.round(inversionTotal / 100) * 100), sub: 'Lo que inviertes por pedido', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', icon: '💰' },
                                { label: 'Ganancia del Ciclo', value: gananciaCiclo > 0 ? `+${formatCurrency(Math.round(gananciaCiclo / 100) * 100)}` : '—', sub: 'Si vendes todas las unidades', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', icon: '📈' },
                                { label: 'ROI del Ciclo', value: roiCiclo > 0 ? `${roiCiclo.toFixed(0)}%` : '—', sub: roiCiclo >= 30 ? '✅ Rentable' : roiCiclo > 0 ? '⚠️ Mejorable' : 'Sin datos', color: roiCiclo >= 30 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', icon: '🎯' },
                                { label: 'Margen Promedio', value: margenProm > 0 ? `${margenProm.toFixed(0)}%` : '—', sub: `${estrellasCount} estrella${estrellasCount !== 1 ? 's' : ''} · ${alertasMargen.length} alerta${alertasMargen.length !== 1 ? 's' : ''}`, color: margenProm >= 40 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : margenProm >= 25 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: '📊' },
                              ].map(kpi => (
                                <div key={kpi.label} className={cn('rounded-xl p-3.5 border border-slate-100 dark:border-slate-800', kpi.color)}>
                                  <p className="text-base mb-0.5">{kpi.icon}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{kpi.label}</p>
                                  <p className="text-xl font-black tabular-nums leading-none">{kpi.value}</p>
                                  <p className="text-[9px] mt-1 opacity-60 font-bold">{kpi.sub}</p>
                                </div>
                              ))}
                            </div>

                            {/* Top productos rentables */}
                            {topProductos.length > 0 && (
                              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">🏆 Top Productos por Ganancia del Ciclo</p>
                                  <p className="text-[9px] text-slate-400 font-bold">ganancia/u × unidades en paca</p>
                                </div>
                                {topProductos.map((p, i) => {
                                  const gCiclo = p.gananciaU * p.cantEmb;
                                  const pctDelTotal = gananciaCiclo > 0 ? (gCiclo / gananciaCiclo) * 100 : 0;
                                  return (
                                    <div key={i} className={cn('px-4 py-3 flex items-center gap-3', i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30')}>
                                      <span className="text-base shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{p.nombre}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">×{p.cantEmb} und · {formatCurrency(Math.round(p.gananciaU / 100) * 100)}/u · margen {p.margenPct.toFixed(0)}%</p>
                                        <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pctDelTotal}%` }} />
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-emerald-600 tabular-nums">+{formatCurrency(Math.round(gCiclo / 100) * 100)}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">{pctDelTotal.toFixed(0)}% del total</p>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                                  <p className="text-[9px] font-black uppercase text-slate-400">Total ganancia del ciclo</p>
                                  <p className="text-sm font-black text-emerald-600 tabular-nums">+{formatCurrency(Math.round(gananciaCiclo / 100) * 100)}</p>
                                </div>
                              </div>
                            )}

                            {/* Alertas de margen bajo */}
                            {alertasMargen.length > 0 && (
                              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
                                <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                    {alertasMargen.length} Producto{alertasMargen.length !== 1 ? 's' : ''} con Margen Bajo (&lt;25%)
                                  </p>
                                </div>
                                <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                  {alertasMargen.map((p, i) => (
                                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                                      <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{p.nombre}</p>
                                        <p className="text-[9px] text-amber-600 font-bold">
                                          Costo: {formatCurrency(Math.round(p.costoU / 100) * 100)} → Venta: {formatCurrency(p.pventa)} → Ganancia: {formatCurrency(Math.round(p.gananciaU / 100) * 100)}/u
                                        </p>
                                      </div>
                                      <span className="text-xs font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg shrink-0">{p.margenPct.toFixed(0)}%</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="px-4 py-2.5 border-t border-amber-200 dark:border-amber-800">
                                  <p className="text-[9px] text-amber-600 font-bold">💡 Sube el precio de venta de estos productos o negocia mejor costo con {prov.nombre} para mejorar la rentabilidad.</p>
                                </div>
                              </div>
                            )}

                            {/* Conclusión */}
                            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/40 dark:to-blue-950/20 border border-slate-200/60 dark:border-slate-700/60 p-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">📋 Conclusión del Ciclo</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                {prov.nombre} te suministra <strong>{insumos.length} productos</strong>
                                {prov.ubicacion ? ` desde ${prov.ubicacion}` : ''}.
                                {inversionTotal > 0 && ` Inviertes ${formatCurrency(Math.round(inversionTotal / 100) * 100)} por ciclo de compra.`}
                                {gananciaCiclo > 0 && ` Si vendes todas las unidades, generas +${formatCurrency(Math.round(gananciaCiclo / 100) * 100)} de ganancia bruta con un ROI del ${roiCiclo.toFixed(0)}%.`}
                                {alertasMargen.length > 0 && ` ⚠️ Tienes ${alertasMargen.length} producto${alertasMargen.length !== 1 ? 's' : ''} con margen por debajo del 25% que requieren atención.`}
                                {estrellasCount > 0 && ` ⭐ ${estrellasCount} producto${estrellasCount !== 1 ? 's están' : ' está'} por encima del 60% de margen — aprovéchalos.`}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Tab: Contacto ── */}
                      {tabDetalle === 'contacto' && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-5">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-4">Datos de Contacto</h4>
                            <div className="space-y-4">
                              {([
                                { label: 'Teléfono', val: prov.telefono, icon: Phone },
                                { label: 'Email', val: prov.email, icon: Mail },
                                { label: 'Ubicación', val: prov.ubicacion, icon: MapPin },
                                { label: 'Dirección', val: prov.direccion, icon: MapPin },
                                { label: 'Rubro', val: rubro, icon: Tag },
                                { label: 'Contacto', val: prov.contacto, icon: UserCheck },
                              ] as { label: string; val: string | undefined; icon: any }[]).map(({ label, val, icon: Ic }) => val ? (
                                <div key={label} className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                    <Ic className="w-3.5 h-3.5 text-blue-500" />
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest block">{label}</span>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{val}</p>
                                  </div>
                                </div>
                              ) : null)}
                            </div>
                          </Card>

                          <div className="space-y-4">
                            {notas && (
                              <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-5">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5" /> Notas Internas
                                </h4>
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notas}</p>
                              </Card>
                            )}

                            <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-5">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Acciones Rápidas</h4>
                              <div className="flex flex-wrap gap-2">
                                {prov.telefono && (
                                  <>
                                    <button onClick={() => window.open(`https://wa.me/${(prov.telefono||'').replace(/\D/g,'')}`, '_blank')}
                                      className="h-8 px-3 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 rounded-lg text-[10px] font-black transition-all">
                                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                    </button>
                                    <button onClick={() => window.location.href = `tel:${prov.telefono}`}
                                      className="h-8 px-3 flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 hover:bg-teal-600 hover:text-white border border-teal-200 dark:border-teal-800 rounded-lg text-[10px] font-black transition-all">
                                      <PhoneCall className="w-3.5 h-3.5" /> Llamar
                                    </button>
                                  </>
                                )}
                                {prov.email && (
                                  <button onClick={() => window.location.href = `mailto:${prov.email}`}
                                    className="h-8 px-3 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-black transition-all">
                                    <Mail className="w-3.5 h-3.5" /> Email
                                  </button>
                                )}
                              </div>
                            </Card>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* ── DIALOG: Confirmar Eliminacion ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-gray-950">
          <div className="bg-gradient-to-br from-rose-500 to-red-700 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Eliminar Proveedor</DialogTitle>
            <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
              Esta acción no se puede deshacer
            </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <p className="text-center text-slate-600 dark:text-slate-300 font-semibold text-sm">
              ¿Eliminar a <span className="font-black text-slate-800 dark:text-white">{deleteTarget?.nombre}</span>?<br />
              <span className="text-[11px] text-rose-500 font-bold">Se eliminarán también sus precios asociados.</span>
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border-none shadow-xl shadow-rose-500/25" onClick={ejecutarEliminar}>
                Sí, eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── COMPONENTE MODULAR FORMULARIO: Crear / Editar ── */}
      <ProveedorForm
        key={editingProveedor?.id ?? 'nuevo'}
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingProveedor(null); }}
        onSubmit={handleSubmit}
        editingProveedor={editingProveedor}
        productosExistentes={_productos}
        initialCatalogo={catalogoParaForm}
        formatCurrency={formatCurrency}
        categoriasVenta={categorias}
      />

      {/* ── DIÁLOGO DE RECUPERACIÓN DE PROVEEDORES ELIMINADOS ── */}
      <Dialog open={showRecuperarDialog} onOpenChange={setShowRecuperarDialog}>
        <DialogContent className="w-[95vw] max-w-lg rounded-[2rem] p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Recuperar Proveedor</DialogTitle>
            <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
              Proveedores eliminados · Copia de seguridad en la nube
            </DialogDescription>
          </div>
          <div className="p-6 space-y-4">
            {buscandoEliminados ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Buscando en la nube...</p>
              </div>
            ) : proveedoresEliminados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm font-bold text-slate-400">No se encontraron proveedores recuperables.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {proveedoresEliminados.length} en la nube — el que tiene más productos es el que buscas:
                </p>
                {proveedoresEliminados.map((entry, idx) => (
                  <div key={entry.proveedor.id} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border ${entry.precios.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-800 dark:text-white text-sm uppercase">{entry.proveedor.nombre}</p>
                        {entry.yaExisteLocal && (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">ya está aquí</span>
                        )}
                      </div>
                      <p className={`text-xs font-black mt-1 ${entry.precios.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {entry.precios.length > 0
                          ? `🧾 ${entry.precios.length} producto(s) en catálogo`
                          : 'Sin productos'}
                        {entry.proveedor.telefono ? ` · ${entry.proveedor.telefono}` : ''}
                      </p>
                    </div>
                    <Button
                      onClick={() => recuperarProveedor(idx)}
                      disabled={entry.recuperando}
                      className={`shrink-0 h-9 px-4 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none ${entry.precios.length > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-600 hover:bg-rose-700'}`}
                    >
                      {entry.recuperando
                        ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Restaurando...</>
                        : <><RotateCcw className="w-3 h-3 mr-1" />{entry.yaExisteLocal ? 'Actualizar' : 'Restaurar'}</>
                      }
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400"
              onClick={() => setShowRecuperarDialog(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalle eliminado — todo se muestra inline en el acordeón */}
    </div>
  );
}

export default Proveedores;
