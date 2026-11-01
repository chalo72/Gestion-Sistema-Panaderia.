import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Store,
  ShoppingCart,
  ArrowLeft,
  Package,
  Check,
  Minus,
  Plus,
  FlaskConical,
  ShoppingBag,
  Zap,
  Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  Producto,
  Proveedor,
  PrecioProveedor,
  InventarioItem,
  OrdenProduccion,
  Receta,
  Categoria
} from '@/types';
import { MarcaPrecioModificado } from '@/components/precios/MarcaPrecioModificado';
import { ultimoCambioPrecio, useCambiosPrecio } from '@/lib/cambio-precio-catalogo';

// insumos: tipo==='ingrediente' | cat ins: | destino==='insumo' del PrecioProveedor
type ZoneFilter = 'ambas' | 'insumos' | 'ventas';

interface ProveedorCatalogoTacticoProps {
  proveedores: Proveedor[];
  productos: Producto[];
  precios: PrecioProveedor[];
  inventario: InventarioItem[];
  produccion: OrdenProduccion[];
  recetas: Receta[];
  formatCurrency: (amount: number) => string;
  onAddItemToDraft: (productoId: string, proveedorId: string, cantidad: number, precio: number) => void;
  getProductoById: (id: string) => Producto | undefined;
  activeProveedorId: string | null;
  onShowBoard?: () => void;
  draftItems?: { productoId: string; cantidad: number }[];
  addOrUpdatePrecio?: (precio: Omit<PrecioProveedor, 'id'>) => void;
  removePrecioFromCatalogo?: (precioId: string) => void;
  onAddProducto?: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto | null | void>;
  categorias?: Categoria[];
}

const esInsumo = (p: any): boolean => {
  const tipo = p.tipo;
  const cat = ((p.categoria || '') as string).toLowerCase();
  const destino = p.destino;
  return tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos' || destino === 'insumo';
};

export function ProveedorCatalogoTactico({
  proveedores,
  productos,
  precios,
  inventario,
  produccion,
  recetas,
  formatCurrency,
  onAddItemToDraft,
  activeProveedorId,
  onShowBoard,
  draftItems = [],
  addOrUpdatePrecio,
  removePrecioFromCatalogo,
  onAddProducto,
  categorias = [],
}: ProveedorCatalogoTacticoProps) {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [selectedProvId, setSelectedProvId] = useState<string | null>(activeProveedorId);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('ambas');
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [formNuevo, setFormNuevo] = useState({
    nombre: '',
    precio: '',
    destino: 'venta' as 'venta' | 'insumo',
    categoria: '',
    tipoEmbalaje: 'unidad',
    cantidadEmbalaje: '1',
  });
  const historial = useCambiosPrecio(precios);

  const refInsumos = useRef<HTMLDivElement>(null);
  const refVentas  = useRef<HTMLDivElement>(null);

  const necesidadesProduccion = useMemo(() => {
    return produccion.filter(p => ['pendiente', 'en_progreso'].includes(p.estado));
  }, [produccion]);

  const stats = useMemo(() => {
    return proveedores.map(prov => {
      const preciosProvBrutos = precios.filter(pr => pr.proveedorId === prov.id);
      
      // Eliminar duplicados (un mismo producto puede tener múltiples registros de precio histórico)
      const uniquePreciosMap = new Map();
      preciosProvBrutos.forEach(pr => {
          // Si queremos mantener el más reciente podríamos comparar fechas, por ahora nos quedamos con el último mapeado
          uniquePreciosMap.set(pr.productoId, pr);
      });
      const preciosProv = Array.from(uniquePreciosMap.values());

      const productosProv = preciosProv.map(pr => {
        const prod = productos.find(p => p.id === pr.productoId);
        const inv  = inventario.find(i => i.productoId === pr.productoId);

        const necesidadProd = necesidadesProduccion.reduce((acc, p) => {
          const prodObj = p as any;
          const receta = recetas.find(r => r.id === (prodObj.recetaId || prodObj.productoId));
          const ingrediente = receta?.ingredientes.find(i => i.productoId === pr.productoId);
          return acc + (ingrediente ? ingrediente.cantidad * (prodObj.cantidad || prodObj.cantidadPlanificada || 0) : 0);
        }, 0);

        const stockActual = inv?.stockActual || 0;
        const stockMinimo = inv?.stockMinimo || 0;
        const esCritico = stockActual < stockMinimo || necesidadProd > stockActual;

        return {
          ...prod,
          nombre: prod?.nombre || 'Producto',
          id: pr.productoId,
          precioId: pr.id,
          precioCosto: pr.precioCosto,
          destino: pr.destino,
          tipoEmbalaje: pr.tipoEmbalaje || 'UNIDAD',
          cantidadEmbalaje: pr.cantidadEmbalaje || 1,
          stockActual,
          stockMinimo,
          necesidadProduccion: necesidadProd,
          necesidadTotal: Math.ceil(Math.max(0, (stockMinimo * 2) + necesidadProd - stockActual)),
          esCritico,
          ultimoCambio: ultimoCambioPrecio(historial, pr.productoId, prov.id),
        };
      });

      return {
        ...prov,
        productos: productosProv,
        itemsCriticos: productosProv.filter(p => p.esCritico).length
      };
    });
  }, [proveedores, precios, productos, inventario, necesidadesProduccion, recetas, historial]);

  const activeProveedor = stats.find(s => s.id === (selectedProvId || activeProveedorId))
    || stats.find(s => s.productos.length > 0)
    || stats[0];

  const catalogoInsumos = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => esInsumo(p));
  }, [activeProveedor]);

  const catalogoVentas = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => !esInsumo(p));
  }, [activeProveedor]);

  // Reset al cambiar proveedor
  useEffect(() => {
    setSearch('');
    setZoneFilter('ambas');
  }, [selectedProvId]);

  // Filtrar por búsqueda
  const applySearch = (list: typeof catalogoInsumos) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(p => p.nombre.toLowerCase().includes(q) || ((p.categoria || '') as string).toLowerCase().includes(q));
  };

  const insumosFiltrados = applySearch(catalogoInsumos);
  const ventasFiltradas  = applySearch(catalogoVentas);

  const updateQuantity = (id: string, delta: number, sugerida: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] !== undefined ? prev[id] : sugerida || 1) + delta),
    }));
  };

  const handleAddWithFeedback = (prodId: string, proveedorId: string, qty: number, precio: number) => {
    setAddingIds(prev => new Set(prev).add(prodId));
    onAddItemToDraft(prodId, proveedorId, qty, precio);
    setTimeout(() => {
      setAddingIds(prev => { const n = new Set(prev); n.delete(prodId); return n; });
    }, 1000);
  };

  const nombresCategoria = useMemo(() => {
    const desdeConfig = categorias.map(c => c.nombre).filter(Boolean);
    if (desdeConfig.length > 0) return desdeConfig;
    return [...new Set(productos.map(p => p.categoria).filter(Boolean))];
  }, [categorias, productos]);

  const abrirCrearProducto = () => {
    setFormNuevo({
      nombre: '',
      precio: '',
      destino: 'venta',
      categoria: nombresCategoria[0] || '',
      tipoEmbalaje: 'unidad',
      cantidadEmbalaje: '1',
    });
    setCreandoProducto(true);
  };

  const guardarProductoNuevo = async () => {
    if (!activeProveedor || !addOrUpdatePrecio || !onAddProducto) {
      toast.error('No se puede crear el producto en este momento');
      return;
    }
    const nombre = formNuevo.nombre.trim();
    const precio = Math.round(Number(formNuevo.precio) * 100) / 100;
    const cantidadEmbalaje = Math.max(1, Math.round(Number(formNuevo.cantidadEmbalaje) || 1));
    const categoria = formNuevo.categoria.trim();
    if (!nombre) {
      toast.error('Escribe el nombre del producto');
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      toast.error('Escribe el precio de costo');
      return;
    }
    if (!categoria) {
      toast.error('Elige la categoría');
      return;
    }
    const yaExiste = productos.find(p => p.nombre.trim().toLowerCase() === nombre.toLowerCase());
    setGuardandoProducto(true);
    try {
      let productoId = yaExiste?.id;
      if (!productoId) {
        const costoUnitario = Math.round((precio / cantidadEmbalaje) * 100) / 100;
        const creado = await onAddProducto({
          nombre,
          categoria,
          precioVenta: 0,
          margenUtilidad: 0,
          tipo: formNuevo.destino === 'insumo' ? 'ingrediente' : 'elaborado',
          costoBase: costoUnitario,
        });
        productoId = creado && typeof creado === 'object' ? creado.id : undefined;
      }
      if (!productoId) {
        toast.error(yaExiste ? 'No se pudo enlazar el producto' : 'No se pudo crear el producto');
        return;
      }
      await addOrUpdatePrecio({
        productoId,
        proveedorId: activeProveedor.id,
        precioCosto: precio,
        destino: formNuevo.destino,
        tipoEmbalaje: formNuevo.tipoEmbalaje,
        cantidadEmbalaje,
      });
      toast.success(
        yaExiste
          ? `${nombre} ya existía. Quedó en el catálogo de ${activeProveedor.nombre}`
          : `${nombre} creado en el catálogo de ${activeProveedor.nombre}`
      );
      setCreandoProducto(false);
    } catch {
      toast.error('No se pudo guardar el producto');
    } finally {
      setGuardandoProducto(false);
    }
  };

  if (!activeProveedor) return null;

  const totalEnCarrito = draftItems.reduce((s, i) => s + i.cantidad, 0);
  const criticosCount  = activeProveedor.itemsCriticos;

  // ─── Tarjeta de producto ────────────────────────────────────────────────
  const ProductoCard = ({ prod, isInsumo }: { prod: typeof catalogoInsumos[0]; isInsumo: boolean }) => {
    const qty      = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || 1);
    const [editPrecio, setEditPrecio] = useState(prod.precioCosto || 0);
    const [isEditingPrecio, setIsEditingPrecio] = useState(false);
    
    // Sync price if it changes externally
    useEffect(() => {
        if (!isEditingPrecio) setEditPrecio(prod.precioCosto || 0);
    }, [prod.precioCosto, isEditingPrecio]);

    const handleSavePrecio = () => {
        setIsEditingPrecio(false);
        const precio = Math.round(Number(editPrecio) * 100) / 100;
        if (!Number.isFinite(precio) || precio <= 0) {
            toast.error('Escribe un precio mayor que cero');
            setEditPrecio(prod.precioCosto || 0);
            return;
        }
        if (precio !== prod.precioCosto && addOrUpdatePrecio) {
            addOrUpdatePrecio({
                productoId: prod.id,
                proveedorId: activeProveedor.id,
                precioCosto: precio,
                tipoEmbalaje: prod.tipoEmbalaje,
                cantidadEmbalaje: prod.cantidadEmbalaje,
                destino: prod.destino,
            });
            toast.success(`Precio de ${prod.nombre} actualizado en el catálogo de ${activeProveedor.nombre}`);
        }
    };

    const isAdding = addingIds.has(prod.id);
    const draftQty = draftItems.find(i => i.productoId === prod.id)?.cantidad ?? 0;
    const enCarrito= draftQty > 0;

    const accent = isInsumo
      ? { bar: 'bg-amber-400', btn: isAdding ? 'bg-emerald-500' : 'bg-amber-500 hover:bg-amber-600', ring: 'ring-amber-300/60 border-amber-300', badge: 'bg-amber-500', text: 'text-amber-600', soft: 'bg-amber-50/60 dark:bg-amber-950/20' }
      : { bar: 'bg-indigo-400', btn: isAdding ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700', ring: 'ring-indigo-300/60 border-indigo-300', badge: 'bg-indigo-600', text: 'text-indigo-600', soft: 'bg-indigo-50/40 dark:bg-indigo-950/20' };

    return (
      <Card className={cn(
        'rounded-2xl border transition-all duration-200 relative overflow-hidden shadow-sm hover:shadow-md flex flex-col',
        enCarrito
          ? `${accent.ring} ring-2 ${accent.soft}`
          : prod.esCritico
            ? 'border-rose-200 bg-rose-50/30 dark:bg-rose-950/10'
            : `border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900`
      )}>
        {/* Barra lateral de color */}
        <div className={cn('absolute top-0 left-0 w-1.5 h-full', prod.esCritico ? 'bg-rose-400' : accent.bar)} />

        {/* Badge carrito */}
        {enCarrito && (
          <div className={cn('absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-black shadow-md', accent.badge)}>
            <ShoppingCart className="w-2.5 h-2.5" />
            <span className="tabular-nums leading-none">{draftQty}</span>
          </div>
        )}

        <CardContent className="pl-4 pr-3 py-3 flex flex-col flex-1 gap-2 relative group">
          <div className="flex justify-between items-start gap-1">
            <h4 title={prod.nombre} className={cn('font-black uppercase text-[11px] sm:text-xs tracking-tight text-slate-900 dark:text-slate-100 leading-snug break-words', enCarrito && 'pr-10')}>
              {prod.nombre}
            </h4>
            {removePrecioFromCatalogo && (prod as any).precioId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Estás seguro que deseas desvincular ${prod.nombre} del catálogo de este proveedor? (No se eliminará el producto del sistema)`)) {
                    removePrecioFromCatalogo((prod as any).precioId);
                    toast.success('Producto desvinculado del proveedor');
                  }
                }}
                title="Desvincular del proveedor"
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all shrink-0 -mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {isEditingPrecio ? (
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-slate-400">$</span>
                <Input
                  type="number"
                  value={editPrecio || ''}
                  onChange={e => setEditPrecio(Number(e.target.value))}
                  onBlur={handleSavePrecio}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePrecio();
                    }
                  }}
                  autoFocus
                  className={cn("h-7 w-24 text-sm font-black px-1.5 py-0 border-indigo-300 ring-indigo-200", accent.text)}
                />
              </div>
            ) : (
              <span 
                className={cn('text-sm font-black tabular-nums leading-none cursor-text hover:opacity-80 transition-opacity border-b border-transparent hover:border-slate-300 w-fit', accent.text)}
                onClick={() => setIsEditingPrecio(true)}
                title="Toca para editar precio de paca"
              >
                {formatCurrency(prod.precioCosto || 0)}
              </span>
            )}
            <MarcaPrecioModificado cambio={prod.ultimoCambio ?? null} />
            <div className="flex flex-wrap gap-1 items-center mt-1">
              <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded border',
                prod.esCritico
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
              )}>
                Stock: {prod.stockActual}
              </span>
              {isInsumo && prod.necesidadProduccion > 0 && (
                <span className="text-[9px] font-black uppercase bg-amber-50 border border-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  Fab: {prod.necesidadProduccion.toFixed(0)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
            <Package className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
              {prod.tipoEmbalaje} × {prod.cantidadEmbalaje}
            </span>
          </div>

          <div className="mt-auto space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Selector de cantidad — objetivos grandes para tocar con el pulgar */}
            <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
              <div className="flex gap-1">
                {Number(prod.cantidadEmbalaje || 1) > 1 && (
                  <Button onClick={() => updateQuantity(prod.id, -Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost"
                    className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 text-rose-500 hover:bg-rose-50 p-0 text-[9px] font-black shadow-sm active:scale-90">
                    -{prod.cantidadEmbalaje}
                  </Button>
                )}
                <Button onClick={() => updateQuantity(prod.id, -1, prod.necesidadTotal)} size="icon" variant="ghost"
                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-0 shadow-sm active:scale-90">
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
              <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white px-1 min-w-[24px] text-center">{qty}</span>
              <div className="flex gap-1">
                <Button onClick={() => updateQuantity(prod.id, 1, prod.necesidadTotal)} size="icon" variant="ghost"
                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 p-0 shadow-sm active:scale-90">
                  <Plus className="w-4 h-4" />
                </Button>
                {Number(prod.cantidadEmbalaje || 1) > 1 && (
                  <Button onClick={() => updateQuantity(prod.id, Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost"
                    className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 p-0 text-[9px] font-black shadow-sm active:scale-90">
                    +{prod.cantidadEmbalaje}
                  </Button>
                )}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => handleAddWithFeedback(prod.id!, activeProveedor.id, qty, prod.precioCosto || 0)}
              disabled={isAdding}
              className={cn('w-full h-11 rounded-xl font-black uppercase text-[11px] tracking-widest gap-1.5 transition-all shadow-sm active:scale-95 text-white', accent.btn)}
            >
              {isAdding ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              {isAdding ? 'LISTO ✓' : 'AGREGAR'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── Sección de zona (insumos o ventas) ─────────────────────────────────
  const ZonaSection = ({
    title, icon, items, isInsumo, refEl, accentBg, accentText, accentBorder, emptyMsg,
  }: {
    title: string; icon: React.ReactNode; items: typeof catalogoInsumos;
    isInsumo: boolean; refEl: React.RefObject<HTMLDivElement>;
    accentBg: string; accentText: string; accentBorder: string; emptyMsg: string;
  }) => (
    <div ref={refEl} className="space-y-2">
      {/* Separador de sección compacto */}
      <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-xl border', accentBg, accentBorder)}>
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0', isInsumo ? 'bg-amber-500' : 'bg-indigo-600')}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className={cn('text-[11px] font-black uppercase tracking-wider truncate', accentText)}>{title}</p>
          <span className={cn('text-sm font-black tabular-nums shrink-0', accentText)}>{items.length}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={cn('flex flex-col items-center py-8 px-4 rounded-2xl border-2 border-dashed text-center gap-2', isInsumo ? 'border-amber-200 bg-amber-50/50' : 'border-indigo-200 bg-indigo-50/50')}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{emptyMsg}</p>
          <p className="text-[10px] text-slate-400 max-w-xs">
            {isInsumo
              ? 'Ve a Proveedores → editar → Catálogo y agrega insumos con destino "Insumo 🧪"'
              : 'Ve a Proveedores → editar → Catálogo y agrega productos con destino "Venta 🛒"'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map(prod => <ProductoCard key={prod.id} prod={prod} isInsumo={isInsumo} />)}
        </div>
      )}
    </div>
  );

  const showInsumos = zoneFilter === 'ambas' || zoneFilter === 'insumos';
  const showVentas  = zoneFilter === 'ambas' || zoneFilter === 'ventas';

  return (
    <div className="animate-ag-fade-in flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── HEADER COMPACTO (sin sticky; scroll solo en productos) ─────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 py-2 shrink-0 z-20">
        <div className="flex items-center gap-2 mb-2">
          <Button onClick={onShowBoard} variant="outline"
            className="w-9 h-9 rounded-lg border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate leading-tight">
              {activeProveedor.nombre}
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              {catalogoInsumos.length + catalogoVentas.length} productos
            </p>
          </div>
          <Button
            type="button"
            onClick={abrirCrearProducto}
            className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wide gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear producto
          </Button>
          {totalEnCarrito > 0 && (
            <div className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm shrink-0">
              <ShoppingCart className="w-3 h-3" />
              {totalEnCarrito}
            </div>
          )}
          {criticosCount > 0 && (
            <div className="flex items-center gap-1 bg-rose-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm shrink-0">
              <Zap className="w-3 h-3" />
              {criticosCount}
            </div>
          )}
        </div>

        {/* Filtros + buscador en una franja compacta */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setZoneFilter('ambas')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-all',
                zoneFilter === 'ambas'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700'
              )}
            >
              Todo
              <span className={cn('tabular-nums text-[9px] px-1 rounded',
                zoneFilter === 'ambas' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              )}>
                {catalogoInsumos.length + catalogoVentas.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setZoneFilter('insumos');
                setTimeout(() => refInsumos.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-all',
                zoneFilter === 'insumos'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              )}
            >
              <FlaskConical className="w-3 h-3" />
              Insumos
              <span className={cn('tabular-nums text-[9px] px-1 rounded',
                zoneFilter === 'insumos' ? 'bg-white/25' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
              )}>
                {catalogoInsumos.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setZoneFilter('ventas');
                setTimeout(() => refVentas.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-all',
                zoneFilter === 'ventas'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
              )}
            >
              <ShoppingBag className="w-3 h-3" />
              Ventas
              <span className={cn('tabular-nums text-[9px] px-1 rounded',
                zoneFilter === 'ventas' ? 'bg-white/25' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200'
              )}>
                {catalogoVentas.length}
              </span>
            </button>
          </div>

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Buscar producto o insumo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 rounded-lg border-slate-200 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE PROVEEDORES (si hay varios) ─────────────────────── */}
      {stats.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto py-1.5 px-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
          {stats.map(prov => {
            const isActive = activeProveedor?.id === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => { setSelectedProvId(prov.id); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shrink-0',
                  isActive
                    ? 'bg-slate-900 text-white border-transparent shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                )}
              >
                <Store className="w-3 h-3" />
                {prov.nombre}
              </button>
            );
          })}
        </div>
      )}

      {/* ── ÚNICO SCROLL: lista de productos ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 pb-20 min-h-0">

        {/* ZONA INSUMOS */}
        {showInsumos && (
          <ZonaSection
            title="Insumos de Producción"
            icon={<FlaskConical className="w-4 h-4" />}
            items={insumosFiltrados}
            isInsumo={true}
            refEl={refInsumos}
            accentBg="bg-amber-50 dark:bg-amber-950/20"
            accentText="text-amber-700 dark:text-amber-400"
            accentBorder="border-amber-200 dark:border-amber-800"
            emptyMsg="Sin insumos registrados para este proveedor"
          />
        )}

        {/* ZONA VENTAS */}
        {showVentas && (
          <ZonaSection
            title="Productos de Venta / Reventa"
            icon={<ShoppingBag className="w-4 h-4" />}
            items={ventasFiltradas}
            isInsumo={false}
            refEl={refVentas}
            accentBg="bg-indigo-50 dark:bg-indigo-950/20"
            accentText="text-indigo-700 dark:text-indigo-400"
            accentBorder="border-indigo-200 dark:border-indigo-800"
            emptyMsg="Sin productos de venta registrados para este proveedor"
          />
        )}

        {/* Sin resultados de búsqueda */}
        {search.trim() && insumosFiltrados.length === 0 && ventasFiltradas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-50">
            <Search className="w-14 h-14 mb-3 text-slate-300" />
            <p className="font-black text-slate-500 uppercase tracking-widest text-sm">Sin resultados</p>
            <p className="text-xs text-slate-400 mt-1">No hay productos que coincidan con "{search}"</p>
          </div>
        )}
      </div>
      {creandoProducto && createPortal(
        <div className="fixed inset-0 z-[80] bg-slate-950/60 flex items-end sm:items-center justify-center p-3" onClick={() => !guardandoProducto && setCreandoProducto(false)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Catálogo de {activeProveedor.nombre}</p>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Crear producto</h3>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500">Nombre</span>
              <Input value={formNuevo.nombre} onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Harina de trigo" className="h-10 font-bold" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Precio de costo</span>
                <Input type="number" inputMode="decimal" value={formNuevo.precio} onChange={e => setFormNuevo(f => ({ ...f, precio: e.target.value }))} placeholder="0" className="h-10 font-black" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Uso</span>
                <select value={formNuevo.destino} onChange={e => setFormNuevo(f => ({ ...f, destino: e.target.value as 'venta' | 'insumo' }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900">
                  <option value="venta">Venta</option>
                  <option value="insumo">Insumo</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500">Categoría</span>
              {nombresCategoria.length > 0 ? (
                <select value={formNuevo.categoria} onChange={e => setFormNuevo(f => ({ ...f, categoria: e.target.value }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900">
                  {nombresCategoria.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              ) : (
                <Input value={formNuevo.categoria} onChange={e => setFormNuevo(f => ({ ...f, categoria: e.target.value }))} placeholder="Categoría" className="h-10 font-bold" />
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Embalaje</span>
                <select value={formNuevo.tipoEmbalaje} onChange={e => setFormNuevo(f => ({ ...f, tipoEmbalaje: e.target.value }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900">
                  <option value="unidad">Unidad</option>
                  <option value="paca">Paca</option>
                  <option value="bulto">Bulto</option>
                  <option value="caja">Caja</option>
                  <option value="saco">Saco</option>
                  <option value="bolsa">Bolsa</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Cantidad por embalaje</span>
                <Input type="number" inputMode="numeric" value={formNuevo.cantidadEmbalaje} onChange={e => setFormNuevo(f => ({ ...f, cantidadEmbalaje: e.target.value }))} className="h-10 font-black" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-11 font-black" disabled={guardandoProducto} onClick={() => setCreandoProducto(false)}>Cancelar</Button>
              <Button type="button" className="flex-1 h-11 font-black bg-indigo-600 hover:bg-indigo-700 text-white" disabled={guardandoProducto} onClick={guardarProductoNuevo}>
                {guardandoProducto ? 'Guardando…' : 'Guardar en catálogo'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
