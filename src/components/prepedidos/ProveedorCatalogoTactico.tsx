import { useState, useMemo, useEffect } from 'react';
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
  Tag,
  ShoppingBag
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// insumos = ingredientes (tipo === 'ingrediente' o categoría empieza con 'ins:')
// ventas  = todo lo demás del catálogo del proveedor
type ViewMode = 'insumos' | 'ventas';

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
}

const esInsumo = (p: any): boolean => {
  const tipo = p.tipo;
  const cat = ((p.categoria || '') as string).toLowerCase();
  return tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos';
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
  onShowBoard
}: ProveedorCatalogoTacticoProps) {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todos');
  const [selectedProvId, setSelectedProvId] = useState<string | null>(activeProveedorId);
  const [viewMode, setViewMode] = useState<ViewMode>('insumos');

  const necesidadesProduccion = useMemo(() => {
    return produccion.filter(p => ['pendiente', 'en_progreso'].includes(p.estado));
  }, [produccion]);

  const stats = useMemo(() => {
    return proveedores.map(prov => {
      const preciosProv = precios.filter(pr => pr.proveedorId === prov.id);
      const productosProv = preciosProv.map(pr => {
        const prod = productos.find(p => p.id === pr.productoId);
        const inv = inventario.find(i => i.productoId === pr.productoId);

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

  const activeProveedor = stats.find(s => s.id === (selectedProvId || activeProveedorId)) || stats.find(s => s.productos.length > 0) || stats[0];

  // Separar el catálogo del proveedor en dos grupos
  const catalogoInsumos = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => esInsumo(p));
  }, [activeProveedor]);

  const catalogoVentas = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => !esInsumo(p));
  }, [activeProveedor]);

  // Si no hay insumos pero sí ventas, ir a ventas automáticamente
  useEffect(() => {
    if (activeProveedor) {
      const tieneInsumos = activeProveedor.productos.some(p => esInsumo(p));
      const tieneVentas = activeProveedor.productos.some(p => !esInsumo(p));
      if (!tieneInsumos && tieneVentas) setViewMode('ventas');
      else setViewMode('insumos');
    }
  }, [activeProveedor?.id]);

  // Reset búsqueda y categoría al cambiar proveedor o modo
  useEffect(() => {
    setSearch('');
    setCategoriaActiva('todos');
  }, [selectedProvId, viewMode]);

  // Catálogo activo según el modo
  const catalogoActivo = viewMode === 'insumos' ? catalogoInsumos : catalogoVentas;

  const categoriasDisponibles = useMemo(() => {
    const cats = [...new Set(
      catalogoActivo.map(p => (p as any).categoria as string).filter(Boolean)
    )].sort();
    return cats;
  }, [catalogoActivo]);

  const productosFiltrados = useMemo(() => {
    return catalogoActivo.filter(p => {
      const matchCat = categoriaActiva === 'todos' || (p as any).categoria === categoriaActiva;
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [catalogoActivo, categoriaActiva, search]);

  const updateQuantity = (id: string, delta: number, base: number) => {
    setQuantities(prev => {
      const current = prev[id] !== undefined ? prev[id] : base;
      return { ...prev, [id]: Math.max(0, current + delta) };
    });
  };

  const handleAddWithFeedback = (prodId: string, proveedorId: string, qty: number, precio: number) => {
    setAddingIds(prev => new Set(prev).add(prodId));
    onAddItemToDraft(prodId, proveedorId, qty, precio);
    setTimeout(() => {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(prodId);
        return next;
      });
    }, 1000);
  };

  if (!activeProveedor) return null;

  return (
    <div className="animate-ag-fade-in space-y-4 pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={onShowBoard}
            variant="outline"
            className="w-10 h-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 truncate">{activeProveedor.nombre}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn(
                "border-none font-black text-[9px] px-2 py-0.5 uppercase",
                viewMode === 'insumos'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-indigo-50 text-indigo-600'
              )}>
                {viewMode === 'insumos' ? 'Catálogo Insumos' : 'Catálogo Ventas'}
              </Badge>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {productosFiltrados.length} items
              </span>
            </div>
          </div>
        </div>

        {/* Toggle INSUMOS / VENTAS */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 p-0.5 gap-0.5 shrink-0">
            {/* Tab Insumos */}
            <button
              onClick={() => setViewMode('insumos')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all',
                viewMode === 'insumos'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
              )}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Insumos
              <span className={cn(
                'text-[9px] font-black px-1.5 py-0.5 rounded-full',
                viewMode === 'insumos'
                  ? 'bg-white/20'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
              )}>
                {catalogoInsumos.length}
              </span>
            </button>

            {/* Tab Ventas */}
            <button
              onClick={() => setViewMode('ventas')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all',
                viewMode === 'ventas'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Ventas
              <span className={cn(
                'text-[9px] font-black px-1.5 py-0.5 rounded-full',
                viewMode === 'ventas'
                  ? 'bg-white/20'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
              )}>
                {catalogoVentas.length}
              </span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={viewMode === 'insumos' ? 'Buscar insumo...' : 'Buscar producto de venta...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold uppercase"
            />
          </div>
        </div>
      </div>

      {/* SELECTOR DE PROVEEDORES */}
      {stats.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          {stats.map(prov => {
            const isActive = activeProveedor?.id === prov.id;
            return (
              <button
                key={prov.id}
                onClick={() => { setSelectedProvId(prov.id); setCategoriaActiva('todos'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0
                  ${isActive
                    ? 'bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-200 hover:text-indigo-600'}`}
              >
                <Store className="w-3.5 h-3.5" />
                {prov.nombre}
                {prov.itemsCriticos > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-rose-100 text-rose-600'}`}>
                    {prov.itemsCriticos}!
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* FILTROS DE CATEGORÍA */}
      {categoriasDisponibles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <button
            onClick={() => setCategoriaActiva('todos')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border',
              categoriaActiva === 'todos'
                ? viewMode === 'insumos'
                  ? 'bg-amber-500 text-white border-transparent shadow-md'
                  : 'bg-indigo-600 text-white border-transparent shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            )}
          >
            Todos
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${categoriaActiva === 'todos' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
              {catalogoActivo.length}
            </span>
          </button>
          {categoriasDisponibles.map(cat => {
            const count = catalogoActivo.filter(p => (p as any).categoria === cat).length;
            const isActive = categoriaActiva === cat;
            const activeColor = viewMode === 'insumos' ? 'bg-amber-500' : 'bg-indigo-600';
            const hoverColor = viewMode === 'insumos' ? 'hover:border-amber-200 hover:text-amber-600' : 'hover:border-indigo-200 hover:text-indigo-600';
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border',
                  isActive
                    ? `${activeColor} text-white border-transparent shadow-md`
                    : `bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 ${hoverColor}`
                )}
              >
                {cat}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── GRID DE PRODUCTOS ─────────────────────────────────────────────── */}
      {catalogoActivo.length === 0 ? (
        /* Catálogo vacío */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {viewMode === 'insumos' ? (
            <FlaskConical className="w-16 h-16 mb-4 text-amber-200" />
          ) : (
            <ShoppingBag className="w-16 h-16 mb-4 text-indigo-200" />
          )}
          <h3 className="font-black text-lg uppercase tracking-tight text-slate-700 dark:text-slate-300">
            Sin {viewMode === 'insumos' ? 'Insumos' : 'Productos de Venta'}
          </h3>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2 mb-6">
            {activeProveedor.nombre} no tiene {viewMode === 'insumos' ? 'insumos' : 'productos de venta'} con precio registrado.
          </p>
          <button
            onClick={() => setViewMode(viewMode === 'insumos' ? 'ventas' : 'insumos')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-md active:scale-95",
              viewMode === 'insumos'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
            )}
          >
            {viewMode === 'insumos' ? <ShoppingBag className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
            Ver {viewMode === 'insumos' ? `Catálogo de Ventas (${catalogoVentas.length})` : `Catálogo de Insumos (${catalogoInsumos.length})`}
          </button>
        </div>
      ) : productosFiltrados.length === 0 ? (
        /* Sin resultados de búsqueda */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center opacity-50">
          <Search className="w-16 h-16 mb-4 text-slate-400" />
          <h3 className="font-black text-lg uppercase tracking-tight">Sin resultados</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
            No se encontró "{search}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 px-1">
          {productosFiltrados.map((prod) => {
            const qty = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || (viewMode === 'insumos' ? 1 : 12));
            const isAdding = addingIds.has(prod.id);
            const accentColor = viewMode === 'insumos' ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400';
            const btnColor = viewMode === 'insumos'
              ? (isAdding ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600')
              : (isAdding ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700');

            return (
              <Card key={prod.id} className={cn(
                "rounded-xl border transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md flex flex-col",
                prod.esCritico
                  ? "border-rose-200 bg-rose-50/30"
                  : viewMode === 'insumos'
                    ? "border-amber-100 bg-amber-50/10 dark:bg-slate-900 dark:border-slate-800"
                    : "border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800"
              )}>
                {/* Indicador de tipo en la esquina */}
                <div className={cn(
                  "absolute top-0 left-0 w-1.5 h-full",
                  prod.esCritico ? "bg-rose-400" : viewMode === 'insumos' ? "bg-amber-400" : "bg-indigo-400"
                )} />
                <CardContent className="pl-4 pr-3 py-3 flex flex-col flex-1 gap-2">
                  <div>
                    <h4 className="font-black uppercase text-[11px] tracking-tight text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[34px]">
                      {prod.nombre}
                    </h4>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className={`text-sm font-black ${accentColor} tabular-nums leading-none`}>
                      {formatCurrency(prod.precioCosto || 0)}
                    </span>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                        prod.esCritico
                          ? "bg-white dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                      )}>
                        S: {prod.stockActual}
                      </span>
                      {viewMode === 'insumos' && (
                        <span className="text-[9px] font-black uppercase bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          F: {prod.necesidadProduccion.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-75 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-md border border-slate-100 dark:border-slate-800 mt-1">
                    <Package className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {prod.tipoEmbalaje} x {prod.cantidadEmbalaje}
                    </span>
                  </div>
                  <div className="mt-auto space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="flex gap-0.5">
                        {Number(prod.cantidadEmbalaje || 1) > 1 && (
                          <Button onClick={() => updateQuantity(prod.id, -Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-0 text-[8px] font-black shadow-sm">
                            {`-${prod.cantidadEmbalaje}`}
                          </Button>
                        )}
                        <Button onClick={() => updateQuantity(prod.id, -1, prod.necesidadTotal)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-0 shadow-sm">
                          <Minus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white px-1 min-w-[20px] text-center">{qty}</span>
                      <div className="flex gap-0.5">
                        <Button onClick={() => updateQuantity(prod.id, 1, prod.necesidadTotal)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 p-0 shadow-sm">
                          <Plus className="w-3 h-3" />
                        </Button>
                        {Number(prod.cantidadEmbalaje || 1) > 1 && (
                          <Button onClick={() => updateQuantity(prod.id, Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 p-0 text-[8px] font-black shadow-sm">
                            {`+${prod.cantidadEmbalaje}`}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddWithFeedback(prod.id!, activeProveedor.id, qty, prod.precioCosto || 0)}
                      disabled={isAdding}
                      className={cn(
                        "w-full h-8 rounded-lg font-black uppercase text-[10px] tracking-widest gap-1.5 transition-all shadow-sm active:scale-95 text-white",
                        btnColor
                      )}
                    >
                      {isAdding ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3 h-3" />}
                      {isAdding ? 'LISTO' : 'AGREGAR'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
