import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
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
  X,
  UserCheck,
  SortAsc,
  Download,
  Tag,
  FileText,
  ChevronDown,
  PhoneCall,
  AlertTriangle,
  Store,
  Wrench,
  BarChart3,
  Zap,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Filter,
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
  onAddProducto?: (p: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
  onAddOrUpdatePrecio?: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string; destino?: 'venta' | 'insumo'; tipoEmbalaje?: string; cantidadEmbalaje?: number }) => Promise<void>;
  onDeletePrecio?: (id: string) => void;
  onDeleteProducto?: (id: string) => Promise<void>;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  onUpdateProducto?: (id: string, updates: Partial<Producto>) => void;
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
  const [viewingProveedor, setViewingProveedor] = useState<Proveedor | null>(null);
  const [orden, setOrden] = useState<OrdenTipo>('nombre');
  const [vistaActual] = useState<VistasTipo>('lista');
  const [soloActivos, setSoloActivos] = useState(false);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('contacto');
  // Dialog de confirmacion de eliminacion
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  const [selectedProvId, setSelectedProvId] = useState<string | null>(null);

  /* ─── Estado catálogo de productos para el componente Form ─── */
  const [catalogoParaForm, setCatalogoParaForm] = useState<ProductoCatalogo[]>([]);


  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const totalInsumos = proveedores.reduce((acc, p) => acc + getPreciosByProveedor(p.id).length, 0);
    const activos = proveedores.filter(p => (p as any).activo !== false).length;
    const mejorCalificado = proveedores.reduce<Proveedor | null>((best, p) =>
      !best || (p.calificacion || 0) > (best.calificacion || 0) ? p : best, null);
    const promedioRating = proveedores.length
      ? proveedores.reduce((s, p) => s + (p.calificacion || 5), 0) / proveedores.length
      : 0;
    const conProductos = proveedores.filter(p => getPreciosByProveedor(p.id).length > 0).length;
    const sinProductos = proveedores.length - conProductos;
    return { totalInsumos, activos, mejorCalificado, promedioRating, conProductos, sinProductos };
  }, [proveedores, getPreciosByProveedor]);

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

      // Guardar productos del catálogo
      if (onAddOrUpdatePrecio && items.length > 0) {
        for (const item of items) {
          let productoId = item.productoId;
          
          // Buscar etiquetas de embalaje con seguridad (Nexus-Shield-Guard)
          const infoEmbalaje = EMBALAJES.find(e => e.value === item.tipoEmbalaje) || { label: 'Unidad', emoji: '🔹' };
          const descripcionGenerada = `${infoEmbalaje.label} x${item.cantidadEmbalaje || 1}`;

          // Crear producto si no existe o si el ID apunta a un producto eliminado (huérfano)
          const productoExiste = productoId ? !!getProductoById(productoId) : false;
          if ((!productoId || !productoExiste) && onAddProducto) {
            const tipo: ProductoTipo = item.destino === 'venta' ? 'elaborado' : 'ingrediente';
            const np = await onAddProducto({
              nombre: item.nombre,
              categoria: item.categoria || 'Otro',
              descripcion: descripcionGenerada,
              precioVenta: item.precioVenta,
              margenUtilidad: item.margenVenta,
              tipo,
              costoBase: item.costoUnitario,
            });
            productoId = np.id;
          }
          if (productoId) {
            await onAddOrUpdatePrecio({
              productoId,
              proveedorId: provId,
              precioCosto: item.precioCosto,
              notas: item.notas || descripcionGenerada,
              destino: item.destino,
              tipoEmbalaje: item.tipoEmbalaje,
              cantidadEmbalaje: item.cantidadEmbalaje,
            });

            // Sincronización Completa con Módulo de Productos
            if (onUpdateProducto) {
              const tipo: ProductoTipo = item.destino === 'venta' ? 'elaborado' : 'ingrediente';
              await onUpdateProducto(productoId, {
                nombre: item.nombre,
                categoria: item.categoria || 'Otro',
                descripcion: descripcionGenerada,
                tipo,
                costoBase: item.costoUnitario,
                margenUtilidad: item.margenVenta,
                precioVenta: item.precioVenta,
                updatedAt: new Date().toISOString()
              });
            }

            // AJUSTE DE STOCK AUTOMÁTICO
            if (onAjustarStock && item.stockRecibido > 0) {
              await onAjustarStock(
                productoId,
                item.stockRecibido,
                'entrada',
                `Proveedor: ${data.nombre} (Sincronización)`
              );
            }
          }
        }
        toast.success(`${items.length} producto(s) gestionados correctamente`);
      }
      setIsDialogOpen(false);
      setEditingProveedor(null);
    } catch (err) {
      console.error("❌ [Nexus-Volt] Error al guardar datos:", err);
      toast.error('Error al guardar. Verifica los datos e intenta de nuevo.');
    }
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    // Pre-cargar productos existentes del proveedor
    const preciosExistentes = getPreciosByProveedor(proveedor.id);
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
        destino: precio.destino || 'insumo',
        notas: precio.notas || '',
        costoUnitario: precio.cantidadEmbalaje ? precio.precioCosto / precio.cantidadEmbalaje : precio.precioCosto,
        precioVenta: prod?.precioVenta || 0,
        precioVentaPack: prod?.precioVenta ? prod.precioVenta * (precio.cantidadEmbalaje || 1) : 0,
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
    if (viewingProveedor?.id === deleteTarget.id) setViewingProveedor(null);
  };

  // Avatar y Estrellas ahora son ProveedorAvatar y EstrellasRating — definidas fuera del componente

  /* ─── Metricas reales del proveedor ─── */
  const getMetricasProveedor = (prov: Proveedor) => {
    const insumos = getPreciosByProveedor(prov.id);
    const calidad = Math.round(((prov.calificacion || 5) / 5) * 100);
    const cobertura = insumos.length > 0 ? Math.min(100, Math.round((insumos.length / 10) * 100)) : 0;
    let margenPromedio = 0;
    if (insumos.length > 0) {
      const margenes = insumos.map(pr => {
        const prod = getProductoById(pr.productoId);
        if (!prod) return 0;
        const costo = Number(pr.precioCosto || 0);
        const venta = Number(prod.precioVenta || 0);
        return costo > 0 ? ((venta - costo) / costo) * 100 : 0;
      });
      margenPromedio = margenes.length > 0 ? Math.round(margenes.reduce((s, m) => s + m, 0) / margenes.length) : 0;
    }
    return { calidad, cobertura, margenPromedio };
  };

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
          <div className="flex flex-col items-center justify-center py-32 opacity-30 text-center">
            <Building2 className="w-24 h-24 mb-6 text-blue-500 animate-ag-float" />
            <h3 className="text-xl font-black uppercase tracking-[0.3em]">Directorio Vacío</h3>
            <p className="max-w-xs text-[10px] font-bold uppercase tracking-widest mt-3">
              {searchTerm || filtroRubro ? 'Sin resultados para ese filtro.' : 'Registra tu primer proveedor.'}
            </p>
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
              const insumos      = getPreciosByProveedor(prov.id);
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
                    onClick={() => setSelectedProvId(isSel ? null : prov.id)}
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
                          {totalInsumos > 0 && <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded"><Wrench className="w-2 h-2 inline mr-0.5" />{totalInsumos}</span>}
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
                          {totalInsumos > 0 && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full"><Wrench className="w-2.5 h-2.5 inline mr-0.5" />{totalInsumos} ins.</span>}
                          {totalVenta   > 0 && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full"><Store className="w-2.5 h-2.5 inline mr-0.5" />{totalVenta} vta.</span>}
                        </div>
                      </>
                    )}
                    <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-300', isSel ? 'rotate-180 text-blue-500' : 'text-slate-300 group-hover:text-slate-500')} />
                  </button>

                  {/* ── Panel acordeón inline ── */}
                  {isSel && (
                    <div className="border-t-2 border-blue-100 dark:border-blue-800/40 bg-white dark:bg-slate-900">
                      {/* ── Header: avatar + datos completos + acciones ── */}
                      <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 border-b border-blue-100 dark:border-blue-800/30 flex items-start gap-5 flex-wrap">
                        {/* Avatar grande */}
                        <ProveedorAvatar proveedor={prov} size="lg" />
                        {/* Datos del proveedor */}
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            {rubro && <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-0.5">{rubro}</p>}
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">{prov.nombre}</h3>
                            {/* Rating */}
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={cn('w-3.5 h-3.5', i < (prov.calificacion || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
                              ))}
                              <span className="text-xs font-black text-amber-500 ml-1">{prov.calificacion || 5}.0</span>
                            </div>
                          </div>
                          {/* Datos de contacto en grid — siempre visibles */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-1">
                            <span className={cn('flex items-center gap-1.5', prov.contacto ? 'text-slate-700 dark:text-slate-200 font-semibold' : 'text-slate-300 dark:text-slate-600 italic')}>
                              <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              {prov.contacto || 'Sin representante'}
                            </span>
                            <span className={cn('flex items-center gap-1.5 font-bold', prov.telefono ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-600 italic font-normal')}>
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              {prov.telefono || 'Sin teléfono'}
                            </span>
                            <span className={cn('flex items-center gap-1.5', prov.email ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600 italic')}>
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              {prov.email || 'Sin email'}
                            </span>
                            <span className={cn('flex items-center gap-1.5', prov.direccion ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600 italic')}>
                              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              {prov.direccion || 'Sin dirección'}
                            </span>
                            <span className="text-slate-400 flex items-center gap-1.5 text-xs">
                              <FileText className="w-3 h-3 shrink-0" />
                              Registrado: {new Date(prov.createdAt).toLocaleDateString('es-CO')}
                            </span>
                            {notas && <span className="text-amber-600 italic flex items-center gap-1.5 text-xs md:col-span-2">"{notas}"</span>}
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

                      {/* Tabla de productos */}
                      {insumos.length === 0 ? (
                        <div className="flex flex-col items-center py-10 gap-2 opacity-40">
                          <Package className="w-10 h-10 text-slate-300" />
                          <p className="text-sm font-bold text-slate-400">Sin productos registrados</p>
                          <button onClick={() => handleEdit(prov)} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700">+ Agregar</button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                            <div className="col-span-5 text-xs font-black uppercase tracking-widest text-slate-400">Producto</div>
                            <div className="col-span-2 text-xs font-black uppercase tracking-widest text-slate-400 text-center">Empaque</div>
                            <div className="col-span-2 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Costo/u</div>
                            <div className="col-span-3 text-xs font-black uppercase tracking-widest text-slate-400 text-right">P. Venta</div>
                          </div>
                          {insumos.map((precio, idx) => {
                            const prodItem = getProductoById(precio.productoId);
                            const costoU   = precio.cantidadEmbalaje && precio.cantidadEmbalaje > 1 ? precio.precioCosto / precio.cantidadEmbalaje : precio.precioCosto;
                            const pventa   = prodItem?.precioVenta || 0;
                            const emb      = EMBALAJES.find(e => e.value === precio.tipoEmbalaje);
                            return (
                              <div key={precio.id} className={cn('grid grid-cols-12 gap-2 items-center px-6 py-3 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors', idx < insumos.length - 1 && 'border-b border-slate-100 dark:border-slate-800')}>
                                <div className="col-span-5 flex items-center gap-2 min-w-0">
                                  <span className="text-sm shrink-0">{precio.destino === 'venta' ? '🛒' : '🏭'}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{prodItem?.nombre || 'Producto'}</p>
                                    <p className="text-xs text-slate-400 truncate">{prodItem?.categoria || ''}</p>
                                  </div>
                                </div>
                                <div className="col-span-2 text-center">
                                  {precio.tipoEmbalaje && precio.tipoEmbalaje !== 'unidad'
                                    ? <span className="text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-lg">{emb?.emoji} ×{precio.cantidadEmbalaje}</span>
                                    : <span className="text-xs text-slate-400">Unidad</span>}
                                </div>
                                <div className="col-span-2 text-right">
                                  <p className="text-sm font-black text-blue-600 tabular-nums">{formatCurrency(costoU)}</p>
                                </div>
                                <div className="col-span-3 text-right">
                                  {pventa > 0
                                    ? <p className="text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(pventa)}</p>
                                    : <p className="text-sm text-slate-300">—</p>}
                                </div>
                              </div>
                            );
                          })}
                        </>
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
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        editingProveedor={editingProveedor}
        productosExistentes={_productos}
        initialCatalogo={catalogoParaForm}
        formatCurrency={formatCurrency}
        categoriasVenta={categorias}
      />

      {/* ── DIALOG: Detalle proveedor ── */}
      <Dialog open={!!viewingProveedor} onOpenChange={() => setViewingProveedor(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-gray-950">
          {viewingProveedor && (() => {
            const insumos = getPreciosByProveedor(viewingProveedor.id);
            const activo = (viewingProveedor as any).activo !== false;
            const rubro = (viewingProveedor as any).rubro as string | undefined;
            const notas = (viewingProveedor as any).notas as string | undefined;
            const metricas = getMetricasProveedor(viewingProveedor);
            return (
              <div className="flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header perfil */}
                <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-indigo-950 p-8 md:p-10 text-white relative shrink-0">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-white/20 rounded-[2rem] blur-2xl animate-pulse" />
                      <ProveedorAvatar proveedor={viewingProveedor} size="lg" />
                      <div className={cn('absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-indigo-900 shadow', activo ? 'bg-emerald-400' : 'bg-slate-400')} />
                    </div>
                    <div className="flex-1 space-y-3 text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <h2 className="text-3xl font-black uppercase tracking-tighter">{viewingProveedor.nombre}</h2>
                        <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-black">{viewingProveedor.calificacion || 5}</span>
                        </div>
                        <Badge className={cn('text-[9px] font-black border-none', activo ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50')}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {rubro && (
                          <Badge className="text-[9px] font-black bg-violet-500/20 text-violet-300 border-none">{rubro}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-center md:justify-start gap-5 text-xs font-semibold text-blue-200">
                        {viewingProveedor.direccion && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{viewingProveedor.direccion}</span>}
                        {viewingProveedor.contacto && <span className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-emerald-300" />{viewingProveedor.contacto}</span>}
                      </div>
                      {/* KPIs del proveedor */}
                      <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                          <p className="text-2xl font-black">{insumos.filter(i => i.destino !== 'venta').length}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">🏭 Insumos</p>
                        </div>
                        {insumos.filter(i => i.destino === 'venta').length > 0 && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                          <p className="text-2xl font-black">{insumos.filter(i => i.destino === 'venta').length}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">🛒 Venta</p>
                        </div>
                        )}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                          <p className="text-2xl font-black">
                            {insumos.length > 0 ? formatCurrency(insumos.reduce((s, i) => s + i.precioCosto, 0) / insumos.length) : '—'}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Precio prom.</p>
                        </div>
                        {metricas.margenPromedio > 0 && (
                          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-black">{metricas.margenPromedio}%</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Margen prom.</p>
                          </div>
                        )}
                      </div>
                      {/* Botones de accion */}
                      <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                        {viewingProveedor.telefono && (
                          <Button size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest h-10 px-5 border-none shadow-lg shadow-emerald-500/30 gap-2"
                            onClick={() => window.open(`https://wa.me/${(viewingProveedor.telefono||'').replace(/\D/g,'')}`, '_blank')}>
                            <MessageCircle className="w-4 h-4" /> WhatsApp
                          </Button>
                        )}
                        {viewingProveedor.telefono && (
                          <Button size="sm" className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-[10px] uppercase tracking-widest h-10 px-5 border-none shadow-lg shadow-teal-500/30 gap-2"
                            onClick={() => window.location.href = `tel:${viewingProveedor.telefono}`}>
                            <PhoneCall className="w-4 h-4" /> Llamar
                          </Button>
                        )}
                        <Button size="sm" className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-[10px] uppercase tracking-widest h-10 px-5 border border-white/10 gap-2"
                          onClick={() => { setViewingProveedor(null); onNavigateTo?.('prepedidos'); toast.success(`Crea un pedido para ${viewingProveedor.nombre}`); }}>
                          <Package className="w-4 h-4" /> Realizar Pedido
                        </Button>
                        {viewingProveedor.email && (
                          <Button size="sm" variant="ghost" className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-[10px] uppercase tracking-widest h-10 px-5 border border-white/10 gap-2"
                            onClick={() => window.location.href = `mailto:${viewingProveedor.email}`}>
                            <Mail className="w-4 h-4" /> Email
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="absolute right-6 top-6 text-white/40 hover:text-white" onClick={() => setViewingProveedor(null)}>
                    <X className="w-6 h-6" />
                  </Button>
                </div>

                {/* Tabs de navegacion */}
                <div className="flex border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-8 shrink-0">
                  {([
                    { id: 'contacto' as TabDetalle, label: 'Contacto', icon: UserCheck },
                    { id: 'catalogo' as TabDetalle, label: `Catálogo (${insumos.filter(i=>i.destino!=='venta').length}🏭 + ${insumos.filter(i=>i.destino==='venta').length}🛒)`, icon: Package },
                    { id: 'analisis' as TabDetalle, label: 'Análisis', icon: BarChart3 },
                  ]).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTabDetalle(id)}
                      className={cn(
                        'flex items-center gap-2 px-5 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all',
                        tabDetalle === id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Contenido del tab */}
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950">

                  {/* Tab: Contacto */}
                  {tabDetalle === 'contacto' && (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-6">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-5">Datos de Contacto</h4>
                        <div className="space-y-5">
                          {([
                            { label: 'Teléfono', val: viewingProveedor.telefono, icon: Phone },
                            { label: 'Email', val: viewingProveedor.email, icon: Mail },
                            { label: 'Dirección', val: viewingProveedor.direccion, icon: MapPin },
                            { label: 'Rubro', val: rubro, icon: Tag },
                          ] as { label: string; val: string | undefined; icon: any }[]).map(({ label, val, icon: Ic }) => val ? (
                            <div key={label} className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                <Ic className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest block">{label}</span>
                                <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{val}</p>
                              </div>
                            </div>
                          ) : null)}
                        </div>
                      </Card>

                      {notas && (
                        <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-6">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-5 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" /> Notas Internas
                          </h4>
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notas}</p>
                        </Card>
                      )}

                      <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-6 md:col-span-2">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-5">Acciones Rápidas</h4>
                        <div className="flex flex-wrap gap-3">
                          {viewingProveedor.telefono && (
                            <>
                              <Button size="sm" className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 font-black text-[10px] uppercase h-10 px-4 gap-2 transition-all"
                                onClick={() => window.open(`https://wa.me/${(viewingProveedor.telefono||'').replace(/\D/g,'')}`, '_blank')}>
                                <MessageCircle className="w-4 h-4" /> WhatsApp
                              </Button>
                              <Button size="sm" className="rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 hover:bg-teal-600 hover:text-white border border-teal-200 dark:border-teal-800 font-black text-[10px] uppercase h-10 px-4 gap-2 transition-all"
                                onClick={() => window.location.href = `tel:${viewingProveedor.telefono}`}>
                                <PhoneCall className="w-4 h-4" /> Llamar
                              </Button>
                            </>
                          )}
                          {viewingProveedor.email && (
                            <Button size="sm" className="rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 dark:border-blue-800 font-black text-[10px] uppercase h-10 px-4 gap-2 transition-all"
                              onClick={() => window.location.href = `mailto:${viewingProveedor.email}`}>
                              <Mail className="w-4 h-4" /> Enviar Email
                            </Button>
                          )}
                          <Button size="sm" className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-indigo-800 font-black text-[10px] uppercase h-10 px-4 gap-2 transition-all"
                            onClick={() => { setViewingProveedor(null); handleEdit(viewingProveedor); }}>
                            <Edit2 className="w-4 h-4" /> Editar Proveedor
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Tab: Catalogo */}
                  {tabDetalle === 'catalogo' && (
                    <div className="p-8 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                          <div className="p-2 bg-blue-600 rounded-xl"><Package className="w-4 h-4 text-white" /></div>
                          Catálogo Vinculado
                        </h3>
                        <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-black px-4 py-1.5 rounded-xl border-none text-[10px]">
                          {insumos.length} items
                        </Badge>
                      </div>

                      {/* Resumen rápido venta vs insumo */}
                      {insumos.length > 0 && (
                        <div className="flex gap-3 mb-2">
                          <div className="flex-1 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl px-4 py-2.5">
                            <span className="text-lg">🏭</span>
                            <div>
                              <p className="text-xl font-black text-indigo-600">{insumos.filter(i => i.destino !== 'venta').length}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Insumos</p>
                            </div>
                          </div>
                          <div className="flex-1 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
                            <span className="text-lg">🛒</span>
                            <div>
                              <p className="text-xl font-black text-emerald-600">{insumos.filter(i => i.destino === 'venta').length}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Para Venta</p>
                            </div>
                          </div>
                          <div className="flex-1 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-4 py-2.5">
                            <span className="text-lg">💰</span>
                            <div>
                              <p className="text-sm font-black text-blue-600">{formatCurrency(insumos.reduce((s, i) => s + i.precioCosto, 0))}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Valor Total</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {insumos.length === 0 ? (
                        <div className="py-16 text-center opacity-30">
                          <Package className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Sin productos vinculados</p>
                          <p className="text-[9px] text-slate-400 mt-2">Edita este proveedor para agregar productos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {insumos.map(precio => {
                            const prod = getProductoById(precio.productoId);
                            if (!prod) return null;
                            const costoBase = Number(precio.precioCosto || 0);
                            const precioVenta = Number(prod.precioVenta || 0);
                            const margen = costoBase > 0 ? ((precioVenta - costoBase) / costoBase) * 100 : 0;
                            const esVenta = precio.destino === 'venta';
                            const embalajeInfo = precio.tipoEmbalaje
                              ? `${EMBALAJES.find(e => e.value === precio.tipoEmbalaje)?.emoji || '📦'} ${EMBALAJES.find(e => e.value === precio.tipoEmbalaje)?.label || precio.tipoEmbalaje}${precio.cantidadEmbalaje && precio.cantidadEmbalaje > 1 ? ` x${precio.cantidadEmbalaje}` : ''}`
                              : precio.notas || '';
                            return (
                              <div key={precio.id} className={cn(
                                'p-5 rounded-2xl border shadow-sm hover:shadow-lg transition-all flex items-center justify-between group',
                                esVenta
                                  ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30'
                                  : 'bg-white dark:bg-gray-900 border-slate-100 dark:border-gray-800'
                              )}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm">{esVenta ? '🛒' : '🏭'}</span>
                                    <p className={cn('font-black uppercase tracking-tight truncate group-hover:transition-colors text-sm', esVenta ? 'text-emerald-800 dark:text-emerald-200 group-hover:text-emerald-600' : 'text-slate-800 dark:text-white group-hover:text-blue-600')}>{prod.nombre}</p>
                                  </div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 truncate">{prod.categoria}</p>
                                  {embalajeInfo && <p className="text-[9px] font-semibold text-slate-400 mt-0.5 truncate">{embalajeInfo}</p>}
                                </div>
                                <div className="text-right ml-3 shrink-0">
                                  <p className="text-lg font-black text-blue-600 tabular-nums">{formatCurrency(precio.precioCosto)}</p>
                                  <Badge className={cn(
                                    'text-[8px] font-black uppercase mt-1 border-none',
                                    margen > 30 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                                  )}>
                                    {margen.toFixed(0)}% margen
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab: Analisis */}
                  {tabDetalle === 'analisis' && (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="rounded-2xl border-none bg-indigo-600 text-white shadow-xl p-6 relative overflow-hidden">
                        <Zap className="w-7 h-7 mb-3 text-emerald-300" />
                        <h4 className="text-lg font-black uppercase tracking-tight">Desempeño del Aliado</h4>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 mt-0.5 mb-6 opacity-70">Basado en datos registrados</p>
                        <div className="space-y-4">
                          {[
                            { label: 'Calidad (rating)', pct: metricas.calidad, color: 'bg-amber-400' },
                            { label: 'Cobertura de catálogo', pct: metricas.cobertura, color: 'bg-blue-300' },
                          ].map(({ label, pct, color }) => (
                            <div key={label}>
                              <div className="flex justify-between text-[9px] font-black uppercase mb-1.5">
                                <span>{label}</span><span>{pct}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/10 rounded-full">
                                <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <ShieldCheck className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10" />
                      </Card>

                      <Card className="rounded-2xl border-none bg-white dark:bg-gray-900 shadow-md p-6">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-5 flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5" /> Resumen Financiero
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Insumos totales</span>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">{insumos.length}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Valor total del catálogo</span>
                            <p className="text-2xl font-black text-blue-600">
                              {formatCurrency(insumos.reduce((s, i) => s + i.precioCosto, 0))}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Precio promedio</span>
                            <p className="text-xl font-black text-slate-700 dark:text-slate-200">
                              {insumos.length > 0 ? formatCurrency(insumos.reduce((s, i) => s + i.precioCosto, 0) / insumos.length) : '—'}
                            </p>
                          </div>
                          {metricas.margenPromedio > 0 && (
                            <div>
                              <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Margen promedio</span>
                              <p className={cn('text-xl font-black', metricas.margenPromedio > 30 ? 'text-emerald-600' : 'text-amber-600')}>
                                {metricas.margenPromedio}%
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Proveedores;
