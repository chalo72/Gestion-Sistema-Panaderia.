import { useState, useMemo, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  Producto,
  Proveedor,
  PrecioProveedor,
  InventarioItem,
  OrdenProduccion,
  Receta
} from '@/types';

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
}: ProveedorCatalogoTacticoProps) {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [selectedProvId, setSelectedProvId] = useState<string | null>(activeProveedorId);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('ambas');

  const refInsumos = useRef<HTMLDivElement>(null);
  const refVentas  = useRef<HTMLDivElement>(null);

  const necesidadesProduccion = useMemo(() => {
    return produccion.filter(p => ['pendiente', 'en_progreso'].includes(p.estado));
  }, [produccion]);

  const stats = useMemo(() => {
    return proveedores.map(prov => {
      const preciosProv = precios.filter(pr => pr.proveedorId === prov.id);
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
          precioCosto: pr.precioCosto,
          destino: pr.destino,
          tipoEmbalaje: pr.tipoEmbalaje || 'UNIDAD',
          cantidadEmbalaje: pr.cantidadEmbalaje || 1,
          stockActual,
          stockMinimo,
          necesidadProduccion: necesidadProd,
          necesidadTotal: Math.ceil(Math.max(0, (stockMinimo * 2) + necesidadProd - stockActual)),
          esCritico
        };
      });

      return {
        ...prov,
        productos: productosProv,
        itemsCriticos: productosProv.filter(p => p.esCritico).length
      };
    });
  }, [proveedores, precios, productos, inventario, necesidadesProduccion, recetas]);

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

  if (!activeProveedor) return null;

  const totalEnCarrito = draftItems.reduce((s, i) => s + i.cantidad, 0);
  const criticosCount  = activeProveedor.itemsCriticos;

  // ─── Tarjeta de producto ────────────────────────────────────────────────
  const ProductoCard = ({ prod, isInsumo }: { prod: typeof catalogoInsumos[0]; isInsumo: boolean }) => {
    const qty      = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || 1);
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

        <CardContent className="pl-4 pr-3 py-3 flex flex-col flex-1 gap-2">
          <h4 className={cn('font-black uppercase text-[11px] tracking-tight text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[34px]', enCarrito && 'pr-10')}>
            {prod.nombre}
          </h4>

          <div className="flex flex-col gap-1">
            <span className={cn('text-sm font-black tabular-nums leading-none', accent.text)}>
              {formatCurrency(prod.precioCosto || 0)}
            </span>
            <div className="flex flex-wrap gap-1 items-center">
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
            {/* Selector de cantidad */}
            <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
              <div className="flex gap-0.5">
                {Number(prod.cantidadEmbalaje || 1) > 1 && (
                  <Button onClick={() => updateQuantity(prod.id, -Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost"
                    className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-rose-500 hover:bg-rose-50 p-0 text-[8px] font-black shadow-sm">
                    -{prod.cantidadEmbalaje}
                  </Button>
                )}
                <Button onClick={() => updateQuantity(prod.id, -1, prod.necesidadTotal)} size="icon" variant="ghost"
                  className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-0 shadow-sm">
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white px-1 min-w-[20px] text-center">{qty}</span>
              <div className="flex gap-0.5">
                <Button onClick={() => updateQuantity(prod.id, 1, prod.necesidadTotal)} size="icon" variant="ghost"
                  className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 p-0 shadow-sm">
                  <Plus className="w-3 h-3" />
                </Button>
                {Number(prod.cantidadEmbalaje || 1) > 1 && (
                  <Button onClick={() => updateQuantity(prod.id, Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost"
                    className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 p-0 text-[8px] font-black shadow-sm">
                    +{prod.cantidadEmbalaje}
                  </Button>
                )}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => handleAddWithFeedback(prod.id!, activeProveedor.id, qty, prod.precioCosto || 0)}
              disabled={isAdding}
              className={cn('w-full h-8 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1.5 transition-all shadow-sm active:scale-95 text-white', accent.btn)}
            >
              {isAdding ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3 h-3" />}
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
    <div ref={refEl} className="space-y-3">
      {/* Separador de sección */}
      <div className={cn('flex items-center gap-3 px-2 py-2 rounded-2xl border', accentBg, accentBorder)}>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0', isInsumo ? 'bg-amber-500' : 'bg-indigo-600')}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-black uppercase tracking-widest', accentText)}>{title}</p>
          <p className="text-[10px] text-slate-400 font-bold">
            {items.length === 0 ? emptyMsg : `${items.length} producto${items.length !== 1 ? 's' : ''} disponible${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <span className={cn('text-2xl font-black tabular-nums shrink-0', accentText)}>{items.length}</span>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {items.map(prod => <ProductoCard key={prod.id} prod={prod} isInsumo={isInsumo} />)}
        </div>
      )}
    </div>
  );

  const showInsumos = zoneFilter === 'ambas' || zoneFilter === 'insumos';
  const showVentas  = zoneFilter === 'ambas' || zoneFilter === 'ventas';

  return (
    <div className="animate-ag-fade-in flex flex-col h-full">

      {/* ── HEADER PEGADO ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Button onClick={onShowBoard} variant="outline"
            className="w-10 h-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white truncate leading-tight">
              {activeProveedor.nombre}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {catalogoInsumos.length + catalogoVentas.length} productos · Selecciona zona de compra
            </p>
          </div>
          {totalEnCarrito > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-black shadow-md shrink-0">
              <ShoppingCart className="w-3.5 h-3.5" />
              {totalEnCarrito}
            </div>
          )}
          {criticosCount > 0 && (
            <div className="flex items-center gap-1 bg-rose-500 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black shadow-md shrink-0">
              <Zap className="w-3 h-3" />
              {criticosCount}
            </div>
          )}
        </div>

        {/* ── ZONA SELECTOR (3 botones grandes) ── */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Ambas */}
          <button
            onClick={() => setZoneFilter('ambas')}
            className={cn(
              'flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest gap-1',
              zoneFilter === 'ambas'
                ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
            )}
          >
            <span className="text-base">📋</span>
            <span>Todo</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-black',
              zoneFilter === 'ambas' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
            )}>
              {catalogoInsumos.length + catalogoVentas.length}
            </span>
          </button>

          {/* Insumos */}
          <button
            onClick={() => {
              setZoneFilter('insumos');
              setTimeout(() => refInsumos.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
            className={cn(
              'flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest gap-1',
              zoneFilter === 'insumos'
                ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/30'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:border-amber-400'
            )}
          >
            <FlaskConical className="w-4 h-4" />
            <span>Insumos</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-black',
              zoneFilter === 'insumos' ? 'bg-white/25' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
            )}>
              {catalogoInsumos.length}
            </span>
          </button>

          {/* Ventas */}
          <button
            onClick={() => {
              setZoneFilter('ventas');
              setTimeout(() => refVentas.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
            className={cn(
              'flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest gap-1',
              zoneFilter === 'ventas'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:border-indigo-400'
            )}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ventas</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-black',
              zoneFilter === 'ventas' ? 'bg-white/25' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
            )}>
              {catalogoVentas.length}
            </span>
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar producto o insumo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 pl-10 rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
          />
        </div>
      </div>

      {/* ── SELECTOR DE PROVEEDORES (si hay varios) ─────────────────────── */}
      {stats.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-2 px-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          {stats.map(prov => {
            const isActive = activeProveedor?.id === prov.id;
            return (
              <button
                key={prov.id}
                onClick={() => { setSelectedProvId(prov.id); }}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0',
                  isActive
                    ? 'bg-slate-900 text-white border-transparent shadow-md'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                )}
              >
                <Store className="w-3.5 h-3.5" />
                {prov.nombre}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CONTENIDO SCROLLEABLE ──────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 space-y-6 pb-24">

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
    </div>
  );
}
