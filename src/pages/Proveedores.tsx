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
  Zap,
  ShieldCheck,
  LayoutGrid,
  List,
  SortAsc,
  Award,
  Filter,
  CheckCircle2,
  Circle,
  Download,
  Tag,
  FileText,
  TrendingUp,
  PhoneCall,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor, ProductoTipo } from '@/types';

/* ── Tipos para el catálogo de productos en el formulario ── */
type TipoEmbalaje = 'unidad' | 'paca' | 'sipak' | 'saco' | 'caja' | 'bolsa' | 'bandeja' | 'otro';
type DestinoUso   = 'venta' | 'insumo';

interface ProductoCatalogo {
  uid: string;
  productoId: string;
  nombre: string;
  categoria: string;
  precioCosto: number;
  margenVenta: number;
  cantidadEmbalaje: number;
  tipoEmbalaje: TipoEmbalaje;
  destino: DestinoUso;
  notas: string;
  costoUnitario: number;
  precioVenta: number;
}

const EMBALAJES: { value: TipoEmbalaje; label: string; emoji: string }[] = [
  { value: 'unidad',  label: 'Unidad',  emoji: '📦' },
  { value: 'paca',    label: 'Paca',    emoji: '🗃️' },
  { value: 'sipak',   label: 'Sipak',   emoji: '🛍️' },
  { value: 'saco',    label: 'Saco',    emoji: '🌾' },
  { value: 'caja',    label: 'Caja',    emoji: '📫' },
  { value: 'bolsa',   label: 'Bolsa',   emoji: '🛒' },
  { value: 'bandeja', label: 'Bandeja', emoji: '🍱' },
  { value: 'otro',    label: 'Otro',    emoji: '🔖' },
];

const CATEGORIAS_PROD = [
  'Harinas y Materia Prima', 'Azúcares y Endulzantes', 'Lácteos y Huevos',
  'Levaduras y Aditivos', 'Aceites y Grasas', 'Frutas y Verduras',
  'Carnes y Embutidos', 'Bebidas', 'Empaques y Desechables',
  'Condimentos y Salsas', 'Granos y Semillas', 'Otro',
];

// Constante fuera del componente para evitar nuevo objeto en cada render
const PROD_INIT = {
  productoId: '', nombre: '', categoria: CATEGORIAS_PROD[0],
  precioCosto: 0, margenVenta: 30, cantidadEmbalaje: 1,
  tipoEmbalaje: 'unidad' as TipoEmbalaje, destino: 'insumo' as DestinoUso, notas: '',
};

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

function EstrellasRating({ val, size = 'sm' }: { val: number; size?: 'sm' | 'xs' }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={cn(size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5', s <= val ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700')} />
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
  onAddOrUpdatePrecio?: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string }) => Promise<void>;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  onNavigateTo?: (view: string) => void;
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
  getPreciosByProveedor,
  getProductoById,
  formatCurrency,
  onNavigateTo,
}: ProveedoresProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { check } = useCan();
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [viewingProveedor, setViewingProveedor] = useState<Proveedor | null>(null);
  const [orden, setOrden] = useState<OrdenTipo>('nombre');
  const [vistaActual, setVistaActual] = useState<VistasTipo>('grid');
  const [soloActivos, setSoloActivos] = useState(false);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('contacto');
  // Dialog de confirmacion de eliminacion
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    imagen: '',
    calificacion: 5,
    activo: true,
    rubro: '',
    notas: '',
  });

  /* ─── Estado catálogo de productos ─── */
  const [catalogoItems, setCatalogoItems] = useState<ProductoCatalogo[]>([]);
  const [prodActual, setProdActual]       = useState<typeof PROD_INIT>(PROD_INIT);
  const [buscarProd, setBuscarProd]       = useState('');
  const [showDropdown, setShowDropdown]   = useState(false);
  const [guardando, setGuardando]         = useState(false);

  const costoUnitarioCalc = prodActual.cantidadEmbalaje > 0
    ? prodActual.precioCosto / prodActual.cantidadEmbalaje : 0;
  const precioVentaCalc = costoUnitarioCalc * (1 + prodActual.margenVenta / 100);

  const productosFiltrados = useMemo(() =>
    buscarProd.length >= 1
      ? _productos.filter(p => p.nombre.toLowerCase().includes(buscarProd.toLowerCase())).slice(0, 8)
      : [],
    [_productos, buscarProd]
  );

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const totalInsumos = proveedores.reduce((acc, p) => acc + getPreciosByProveedor(p.id).length, 0);
    const activos = proveedores.filter(p => (p as any).activo !== false).length;
    const mejorCalificado = proveedores.reduce<Proveedor | null>((best, p) =>
      !best || (p.calificacion || 0) > (best.calificacion || 0) ? p : best, null);
    const promedioRating = proveedores.length
      ? proveedores.reduce((s, p) => s + (p.calificacion || 5), 0) / proveedores.length
      : 0;
    return { totalInsumos, activos, mejorCalificado, promedioRating };
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      const data = { ...formData };
      let provId: string;
      if (editingProveedor) {
        onUpdateProveedor(editingProveedor.id, data);
        provId = editingProveedor.id;
        toast.success('Proveedor actualizado');
      } else {
        const nuevo = await onAddProveedor(data);
        provId = nuevo.id;
        toast.success('Proveedor creado');
      }
      // Guardar productos del catálogo
      if (onAddOrUpdatePrecio && catalogoItems.length > 0) {
        for (const item of catalogoItems) {
          let productoId = item.productoId;
          if (!productoId && onAddProducto) {
            const tipo: ProductoTipo = item.destino === 'venta' ? 'elaborado' : 'ingrediente';
            const np = await onAddProducto({
              nombre: item.nombre,
              categoria: item.categoria,
              descripcion: `${EMBALAJES.find(e => e.value === item.tipoEmbalaje)?.label} x${item.cantidadEmbalaje}`,
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
              notas: item.notas || `${EMBALAJES.find(e => e.value === item.tipoEmbalaje)?.label} x${item.cantidadEmbalaje}`,
            });
          }
        }
        toast.success(`${catalogoItems.length} producto(s) vinculados`);
      }
      resetForm();
      setIsDialogOpen(false);
    } catch {
      toast.error('Error al guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', imagen: '', calificacion: 5, activo: true, rubro: '', notas: '' });
    setCatalogoItems([]);
    setProdActual(PROD_INIT);
    setBuscarProd('');
    setEditingProveedor(null);
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setFormData({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      imagen: proveedor.imagen || '',
      calificacion: proveedor.calificacion || 5,
      activo: (proveedor as any).activo !== false,
      rubro: (proveedor as any).rubro || '',
      notas: (proveedor as any).notas || '',
    });
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
      margenPromedio = Math.round(margenes.reduce((s, m) => s + m, 0) / margenes.length);
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
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
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
            { label: 'Activos', valor: kpis.activos, icon: CheckCircle2, color: 'emerald' },
            { label: 'Insumos cargados', valor: kpis.totalInsumos, icon: Package, color: 'indigo' },
            { label: 'Rating promedio', valor: kpis.promedioRating.toFixed(1), icon: Star, color: 'amber' },
            { label: 'Mejor calificado', valor: kpis.mejorCalificado?.nombre.split(' ')[0] ?? '—', icon: Award, color: 'violet' },
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

        {/* Vista grid/lista */}
        <div className="flex items-center bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setVistaActual('grid')}
            className={cn('p-2 rounded-xl transition-all', vistaActual === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVistaActual('lista')}
            className={cn('p-2 rounded-xl transition-all', vistaActual === 'lista' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-30 text-center">
            <Building2 className="w-24 h-24 mb-6 text-blue-500 animate-ag-float" />
            <h3 className="text-xl font-black uppercase tracking-[0.3em]">Directorio Vacío</h3>
            <p className="max-w-xs text-[10px] font-bold uppercase tracking-widest mt-3">
              {searchTerm || filtroRubro ? 'Sin resultados para ese filtro.' : 'Registra tu primer proveedor.'}
            </p>
          </div>
        ) : vistaActual === 'grid' ? (
          /* ─ GRID ─ */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {filtrados.map((prov) => {
              const insumos = getPreciosByProveedor(prov.id);
              const activo = (prov as any).activo !== false;
              const rubro = (prov as any).rubro as string | undefined;
              return (
                <Card
                  key={prov.id}
                  className="group relative overflow-hidden border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-[2rem] shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer"
                  onClick={() => { setViewingProveedor(prov); setTabDetalle('contacto'); }}
                >
                  {/* Badge calificacion */}
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-amber-100 dark:border-amber-800/40">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    {prov.calificacion || 5}
                  </div>
                  {/* Indicador activo */}
                  <div className={cn(
                    'absolute top-4 left-4 z-10 w-2.5 h-2.5 rounded-full shadow-md',
                    activo ? 'bg-emerald-500 shadow-emerald-400/50' : 'bg-slate-300'
                  )} title={activo ? 'Activo' : 'Inactivo'} />

                  <CardHeader className="flex flex-col items-center text-center pt-10 pb-4">
                    <div className="mb-4 transition-transform group-hover:scale-105 duration-300">
                      <ProveedorAvatar proveedor={prov} size="md" />
                    </div>
                    <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors w-full px-2">
                      {prov.nombre}
                    </h3>
                    {rubro && (
                      <Badge variant="outline" className="mt-1 text-[8px] font-black uppercase tracking-tighter border-violet-100 dark:border-violet-800 text-violet-500 bg-violet-50/50 dark:bg-violet-900/20">
                        {rubro}
                      </Badge>
                    )}
                    <Badge variant="outline" className="mt-1.5 text-[8px] font-black uppercase tracking-tighter border-blue-100 dark:border-blue-800 text-blue-500 bg-blue-50/50 dark:bg-blue-900/20">
                      {insumos.length} insumos
                    </Badge>
                  </CardHeader>

                  <CardContent className="px-6 pb-4 space-y-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-100 dark:via-gray-700 to-transparent mb-4" />
                    {prov.contacto && (
                      <div className="flex items-center gap-2.5 text-slate-500">
                        <UserCheck className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                        <span className="text-[11px] font-semibold truncate">{prov.contacto}</span>
                      </div>
                    )}
                    {prov.telefono && (
                      <div className="flex items-center gap-2.5 text-emerald-600">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-bold tracking-wide truncate">{prov.telefono}</span>
                      </div>
                    )}
                    {prov.email && (
                      <div className="flex items-center gap-2.5 text-slate-400">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] truncate">{prov.email}</span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="px-4 pb-4 pt-0 flex gap-2 flex-wrap">
                    {prov.telefono && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all p-0"
                        onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${(prov.telefono||'').replace(/\D/g,'')}`, '_blank'); }}
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {prov.telefono && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 rounded-xl bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800/40 text-teal-600 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all p-0"
                        onClick={e => { e.stopPropagation(); window.location.href = `tel:${prov.telefono}`; }}
                        title="Llamar"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all p-0"
                      onClick={e => { e.stopPropagation(); handleEdit(prov); }}
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 rounded-xl bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/40 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all p-0"
                      onClick={e => { e.stopPropagation(); confirmarEliminar(prov); }}
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          /* ─ LISTA ─ */
          <div className="space-y-3 pb-10">
            {/* Cabecera */}
            <div className="grid grid-cols-12 gap-4 px-5 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
              <div className="col-span-3">Proveedor</div>
              <div className="col-span-2">Rubro</div>
              <div className="col-span-2">Contacto</div>
              <div className="col-span-2">Teléfono</div>
              <div className="col-span-1 text-center">Insumos</div>
              <div className="col-span-1 text-center">Rating</div>
              <div className="col-span-1 text-right">Acciones</div>
            </div>
            {filtrados.map((prov) => {
              const insumos = getPreciosByProveedor(prov.id);
              const activo = (prov as any).activo !== false;
              const rubro = (prov as any).rubro as string | undefined;
              return (
                <div
                  key={prov.id}
                  className="grid grid-cols-12 gap-4 items-center px-5 py-4 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                  onClick={() => { setViewingProveedor(prov); setTabDetalle('contacto'); }}
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <ProveedorAvatar proveedor={prov} size="sm" />
                      <div className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900', activo ? 'bg-emerald-500' : 'bg-slate-300')} />
                    </div>
                    <span className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tight truncate group-hover:text-blue-600 transition-colors">{prov.nombre}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-violet-500 truncate block">{rubro || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] font-semibold text-slate-500 truncate block">{prov.contacto || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] font-bold text-emerald-600 truncate block">{prov.telefono || '—'}</span>
                  </div>
                  <div className="col-span-1 text-center">
                    <Badge variant="outline" className="text-[9px] font-black border-blue-100 text-blue-500 bg-blue-50/50">{insumos.length}</Badge>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <EstrellasRating val={prov.calificacion || 5} size="xs" />
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {prov.telefono && (
                      <button className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        onClick={() => window.open(`https://wa.me/${(prov.telefono||'').replace(/\D/g,'')}`, '_blank')}
                        title="WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {prov.telefono && (
                      <button className="p-1.5 rounded-lg text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                        onClick={() => window.location.href = `tel:${prov.telefono}`}
                        title="Llamar">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" onClick={() => handleEdit(prov)} title="Editar">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" onClick={() => confirmarEliminar(prov)} title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

      {/* ── DIALOG: Crear / Editar ── */}
      <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-gray-950">
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                {editingProveedor ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">
                  {editingProveedor ? 'Actualizar Proveedor' : 'Nuevo Proveedor'}
                </DialogTitle>
                <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest mt-0.5">
                  Información corporativa del aliado
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="absolute right-5 top-5 text-white/40 hover:text-white" onClick={() => setIsDialogOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Nombre de la Empresa *</Label>
              <Input
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej. Comercializadora Global S.A."
                className="h-14 text-lg font-black rounded-2xl bg-slate-50 dark:bg-gray-800 border-none shadow-inner px-5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Representante */}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Representante</Label>
                <Input
                  value={formData.contacto}
                  onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                  placeholder="Nombre completo"
                  className="h-12 font-semibold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-5"
                />
              </div>

              {/* Calificacion */}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Calificación</Label>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-gray-800 h-12 px-5 rounded-2xl shadow-inner">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" onClick={() => setFormData({ ...formData, calificacion: s })} className="hover:scale-110 transition-transform">
                      <Star className={cn('w-5 h-5', s <= formData.calificacion ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Telefono */}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">WhatsApp / Celular</Label>
                <Input
                  value={formData.telefono}
                  onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+54 9 11 0000-0000"
                  className="h-12 font-mono bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-5"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Correo Corporativo</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="aliado@empresa.com"
                  className="h-12 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-5"
                />
              </div>
            </div>

            {/* Rubro */}
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Rubro / Categoría</Label>
              <div className="relative">
                <Tag className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
                <select
                  value={formData.rubro}
                  onChange={e => setFormData({ ...formData, rubro: e.target.value })}
                  className="w-full h-12 pl-12 pr-5 font-semibold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner outline-none text-slate-700 dark:text-slate-200 text-sm"
                >
                  <option value="">Seleccionar rubro...</option>
                  {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Direccion */}
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Sede Principal</Label>
              <Input
                value={formData.direccion}
                onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección completa"
                className="h-12 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-5"
              />
            </div>

            {/* Notas internas */}
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Notas Internas</Label>
              <textarea
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Condiciones de pago, días de entrega, observaciones..."
                rows={3}
                className="w-full px-5 py-4 text-sm font-semibold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner outline-none resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Logo (URL)</Label>
              <div className="flex gap-3">
                <Input
                  value={formData.imagen}
                  onChange={e => setFormData({ ...formData, imagen: e.target.value })}
                  placeholder="https://..."
                  className="h-12 flex-1 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-5"
                />
                {formData.imagen && (
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-slate-100 bg-white shadow-lg shrink-0">
                    <img src={formData.imagen} className="w-full h-full object-cover" alt="logo preview" />
                  </div>
                )}
              </div>
            </div>

            {/* Estado activo */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, activo: !formData.activo })}
              className={cn(
                'w-full h-12 rounded-2xl border-2 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all',
                formData.activo
                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                  : 'border-slate-200 bg-slate-50 dark:bg-gray-800 text-slate-400'
              )}
            >
              {formData.activo ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {formData.activo ? 'Proveedor Activo' : 'Proveedor Inactivo'}
            </button>

            {/* ══ SECCIÓN: CATÁLOGO DE PRODUCTOS ══ */}
            <div className="border-t border-slate-100 dark:border-gray-800 pt-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" /> Catálogo de Productos del Proveedor
              </h3>

              {/* Mini formulario de producto */}
              <div className="bg-slate-50 dark:bg-gray-900 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-gray-800">
                {/* Búsqueda */}
                <div className="relative">
                  <Input
                    value={buscarProd}
                    onChange={e => { setBuscarProd(e.target.value); setProdActual(prev => ({ ...prev, nombre: e.target.value, productoId: '' })); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Buscar producto existente o escribir nuevo..."
                    className="h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-4 text-sm"
                  />
                  {showDropdown && productosFiltrados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
                      {productosFiltrados.map(prod => (
                        <button key={prod.id} type="button"
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                          onMouseDown={() => { setProdActual(prev => ({ ...prev, productoId: prod.id, nombre: prod.nombre, categoria: prod.categoria, margenVenta: prod.margenUtilidad || 30, destino: prod.tipo === 'ingrediente' ? 'insumo' : 'venta' })); setBuscarProd(prod.nombre); setShowDropdown(false); }}>
                          <Package className="w-4 h-4 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{prod.nombre}</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">{prod.categoria}</p>
                          </div>
                          <Badge className="ml-auto text-[8px] bg-blue-50 text-blue-600 border-none shrink-0">Existente</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Categoría */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Categoría</label>
                    <select value={prodActual.categoria} onChange={e => setProdActual(prev => ({ ...prev, categoria: e.target.value }))}
                      className="w-full h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-3 text-sm font-semibold outline-none cursor-pointer">
                      {CATEGORIAS_PROD.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* Destino */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Destino</label>
                    <div className="flex h-10 gap-2">
                      {(['insumo', 'venta'] as DestinoUso[]).map(val => (
                        <button key={val} type="button" onClick={() => setProdActual(prev => ({ ...prev, destino: val }))}
                          className={cn('flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2',
                            prodActual.destino === val
                              ? val === 'insumo' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-400')}>
                          {val === 'insumo' ? '🏭 Insumo' : '🛒 Venta'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Costo embalaje */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Costo del Embalaje</label>
                    <Input type="number" min="0" step="0.01" value={prodActual.precioCosto || ''}
                      onChange={e => setProdActual(prev => ({ ...prev, precioCosto: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00" className="h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-3 text-right font-bold" />
                  </div>
                  {/* % Margen */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Margen de Venta %</label>
                    <Input type="number" min="0" max="500" value={prodActual.margenVenta || ''}
                      onChange={e => setProdActual(prev => ({ ...prev, margenVenta: parseFloat(e.target.value) || 0 }))}
                      placeholder="30" className="h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-3 text-right font-bold" />
                  </div>
                  {/* Unidades */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Unidades x Embalaje</label>
                    <Input type="number" min="1" value={prodActual.cantidadEmbalaje || ''}
                      onChange={e => setProdActual(prev => ({ ...prev, cantidadEmbalaje: parseInt(e.target.value) || 1 }))}
                      placeholder="1" className="h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-3 text-right font-bold" />
                  </div>
                  {/* Tipo embalaje */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-50">Tipo de Embalaje</label>
                    <select value={prodActual.tipoEmbalaje} onChange={e => setProdActual(prev => ({ ...prev, tipoEmbalaje: e.target.value as TipoEmbalaje }))}
                      className="w-full h-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-inner px-3 text-sm font-semibold outline-none cursor-pointer">
                      {EMBALAJES.map(em => <option key={em.value} value={em.value}>{em.emoji} {em.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Panel calculado */}
                {prodActual.precioCosto > 0 && (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 text-center">
                    {[
                      { label: 'Costo Unit.', val: formatCurrency(costoUnitarioCalc), color: 'text-blue-600' },
                      { label: 'P. Venta',   val: formatCurrency(precioVentaCalc),   color: 'text-emerald-600' },
                      { label: 'Ganancia',   val: `${prodActual.margenVenta}%`,       color: 'text-amber-600' },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-0.5">{label}</p>
                        <p className={cn('text-sm font-black', color)}>{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="button"
                  onClick={() => {
                    if (!prodActual.nombre.trim()) { toast.error('Ingresa el nombre'); return; }
                    if (prodActual.precioCosto <= 0) { toast.error('El costo debe ser mayor a 0'); return; }
                    setCatalogoItems(prev => [...prev, { ...prodActual, uid: crypto.randomUUID(), costoUnitario: costoUnitarioCalc, precioVenta: precioVentaCalc }]);
                    setProdActual(PROD_INIT);
                    setBuscarProd('');
                    toast.success(`Producto agregado al catálogo`);
                  }}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] border-none gap-2">
                  <Plus className="w-3.5 h-3.5" /> Agregar al Catálogo
                </Button>
              </div>

              {/* Tabla de productos agregados */}
              {catalogoItems.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 px-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                    <div className="col-span-4">Producto</div>
                    <div className="col-span-2 text-center">Embalaje</div>
                    <div className="col-span-2 text-right">Costo u.</div>
                    <div className="col-span-2 text-right">P. Venta</div>
                    <div className="col-span-1 text-center">Dest.</div>
                    <div className="col-span-1"/>
                  </div>
                  {catalogoItems.map(item => (
                    <div key={item.uid} className="grid grid-cols-12 gap-1 items-center px-3 py-2.5 bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-gray-800 shadow-sm">
                      <div className="col-span-4 min-w-0">
                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.nombre}</p>
                        <p className="text-[8px] text-slate-400 uppercase truncate">{item.categoria}</p>
                      </div>
                      <div className="col-span-2 text-center text-xs text-slate-400">{EMBALAJES.find(e => e.value === item.tipoEmbalaje)?.emoji} {item.cantidadEmbalaje}u</div>
                      <div className="col-span-2 text-right font-black text-sm text-blue-600 tabular-nums">{formatCurrency(item.costoUnitario)}</div>
                      <div className="col-span-2 text-right font-black text-sm text-emerald-600 tabular-nums">{formatCurrency(item.precioVenta)}</div>
                      <div className="col-span-1 flex justify-center">
                        <span className="text-sm">{item.destino === 'insumo' ? '🏭' : '🛒'}</span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => setCatalogoItems(prev => prev.filter(i => i.uid !== item.uid))}
                          className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/40">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">{catalogoItems.length} productos · {catalogoItems.filter(i => i.destino === 'insumo').length} insumos · {catalogoItems.filter(i => i.destino === 'venta').length} venta</span>
                    <span className="text-sm font-black text-blue-700">{formatCurrency(catalogoItems.reduce((s, i) => s + i.precioCosto, 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-50" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando} className="h-14 flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/25 border-none">
                {guardando ? 'Guardando...' : editingProveedor ? `Guardar${catalogoItems.length > 0 ? ` + ${catalogoItems.length} prod.` : ''}` : `Crear Proveedor${catalogoItems.length > 0 ? ` + ${catalogoItems.length} prod.` : ''}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                          <p className="text-2xl font-black">{insumos.length}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Insumos</p>
                        </div>
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
                    { id: 'catalogo' as TabDetalle, label: `Catálogo (${insumos.length})`, icon: Package },
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

                      {insumos.length === 0 ? (
                        <div className="py-16 text-center opacity-30">
                          <Package className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Sin insumos vinculados</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {insumos.map(precio => {
                            const prod = getProductoById(precio.productoId);
                            if (!prod) return null;
                            const costoBase = Number(precio.precioCosto || 0);
                            const precioVenta = Number(prod.precioVenta || 0);
                            const margen = costoBase > 0 ? ((precioVenta - costoBase) / costoBase) * 100 : 0;
                            return (
                              <div key={precio.id} className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group">
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight truncate group-hover:text-blue-600 transition-colors">{prod.nombre}</p>
                                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-0.5 truncate">{prod.categoria}</p>
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
