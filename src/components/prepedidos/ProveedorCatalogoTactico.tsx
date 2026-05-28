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
  Tag
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

type ViewMode = 'catalogo' | 'insumos';

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
  const [viewMode, setViewMode] = useState<ViewMode>('catalogo');

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

  // Si el catálogo del proveedor activo está vacío, ir automáticamente a vista insumos
  useEffect(() => {
    if (activeProveedor && activeProveedor.productos.length === 0) {
      setViewMode('insumos');
    }
  }, [activeProveedor?.id]);

  // Reset búsqueda y categoría al cambiar proveedor o modo
  useEffect(() => {
    setSearch('');
    setCategoriaActiva('todos');
  }, [selectedProvId, viewMode]);

  // ── VISTA CATÁLOGO ──────────────────────────────────────────────────────────

  const categoriasDisponibles = useMemo(() => {
    if (!activeProveedor) return [];
    const cats = [...new Set(
      activeProveedor.productos
        .map(p => (p as any).categoria as string)
        .filter(Boolean)
    )].sort();
    return cats;
  }, [activeProveedor]);

  const productosFiltrados = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => {
      const matchCat = categoriaActiva === 'todos' || (p as any).categoria === categoriaActiva;
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeProveedor, categoriaActiva, search]);

  // ── VISTA INSUMOS ───────────────────────────────────────────────────────────
  // Todos los ingredientes del sistema, con precio si está registrado para este proveedor

  const todosLosInsumos = useMemo(() => {
    if (!activeProveedor) return [];
    // Mapa: productoId → precioCosto para este proveedor
    const preciosPorProducto = new Map(
      precios
        .filter(pr => pr.proveedorId === activeProveedor.id)
        .map(pr => [pr.productoId, pr])
    );

    return productos
      .filter(p => {
        const tipo = (p as any).tipo;
        const cat = ((p as any).categoria || '').toLowerCase();
        const esInsumo = tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos';
        const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
        const matchCat = categoriaActiva === 'todos' || (p as any).categoria === categoriaActiva;
        return esInsumo && matchSearch && matchCat;
      })
      .map(p => {
        const precioEntry = preciosPorProducto.get(p.id);
        const inv = inventario.find(i => i.productoId === p.id);
        const stockActual = inv?.stockActual || 0;
        const stockMinimo = inv?.stockMinimo || 0;
        return {
          ...p,
          precioCosto: precioEntry?.precioCosto ?? null as number | null,
          tipoEmbalaje: precioEntry?.tipoEmbalaje || 'UNIDAD',
          cantidadEmbalaje: precioEntry?.cantidadEmbalaje || 1,
          tienePrecio: !!precioEntry,
          stockActual,
          stockMinimo,
          esCritico: stockActual < stockMinimo
        };
      })
      .sort((a, b) => {
        // Los que tienen precio van primero
        if (a.tienePrecio && !b.tienePrecio) return -1;
        if (!a.tienePrecio && b.tienePrecio) return 1;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [activeProveedor, productos, precios, inventario, search, categoriaActiva]);

  const categoriasInsumos = useMemo(() => {
    const all = productos.filter(p => {
      const tipo = (p as any).tipo;
      const cat = ((p as any).categoria || '').toLowerCase();
      return tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos';
    });
    const cats = [...new Set(all.map(p => (p as any).categoria as string).filter(Boolean))].sort();
    return cats;
  }, [productos]);

  // ── SHARED ──────────────────────────────────────────────────────────────────

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

  const insumosCats = viewMode === 'insumos' ? categoriasInsumos : categoriasDisponibles;
  const totalInsumos = productos.filter(p => {
    const tipo = (p as any).tipo;
    const cat = ((p as any).categoria || '').toLowerCase();
    return tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos';
  }).length;

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
              <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] px-2 py-0.5 uppercase">
                {viewMode === 'catalogo' ? 'Catálogo Activo' : 'Todos los Insumos'}
              </Badge>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {viewMode === 'catalogo'
                  ? `${activeProveedor.productos.length} items`
                  : `${todosLosInsumos.length} insumos`}
              </span>
            </div>
          </div>
        </div>

        {/* Toggle CATÁLOGO / INSUMOS */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 p-0.5 gap-0.5 shrink-0">
            <button
              onClick={() => setViewMode('catalogo')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all',
                viewMode === 'catalogo'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
              )}
            >
              <Tag className="w-3.5 h-3.5" />
              Catálogo
              <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', viewMode === 'catalogo' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}>
                {activeProveedor.productos.length}
              </span>
            </button>
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
              <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', viewMode === 'insumos' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600')}>
                {totalInsumos}
              </span>
            </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={viewMode === 'insumos' ? 'BUSCAR INSUMO...' : 'BUSCAR PRODUCTO...'}
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
      {insumosCats.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <button
            onClick={() => setCategoriaActiva('todos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
              ${categoriaActiva === 'todos'
                ? viewMode === 'insumos' ? 'bg-amber-500 text-white border-transparent shadow-md' : 'bg-slate-900 text-white border-transparent shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
          >
            Todos
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${categoriaActiva === 'todos' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
              {viewMode === 'insumos' ? todosLosInsumos.length : activeProveedor.productos.length}
            </span>
          </button>
          {insumosCats.map(cat => {
            const count = viewMode === 'insumos'
              ? productos.filter(p => (p as any).categoria === cat && ((p as any).tipo === 'ingrediente' || (((p as any).categoria || '').toLowerCase().startsWith('ins:') || ((p as any).categoria || '').toLowerCase() === 'insumos'))).length
              : activeProveedor.productos.filter(p => (p as any).categoria === cat).length;
            const isActive = categoriaActiva === cat;
            const activeColor = viewMode === 'insumos' ? 'bg-amber-500' : 'bg-indigo-600';
            const hoverColor = viewMode === 'insumos' ? 'hover:border-amber-200 hover:text-amber-600' : 'hover:border-indigo-200 hover:text-indigo-600';
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
                  ${isActive
                    ? `${activeColor} text-white border-transparent shadow-md`
                    : `bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 ${hoverColor}`}`}
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

      {/* ── VISTA CATÁLOGO ─────────────────────────────────────────────────── */}
      {viewMode === 'catalogo' && (
        <>
          {activeProveedor.productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Package className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="font-black text-lg uppercase tracking-tight text-slate-700 dark:text-slate-300">Catálogo Vacío</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2 mb-6">
                {activeProveedor.nombre} no tiene productos con precio registrado.
              </p>
              <button
                onClick={() => setViewMode('insumos')}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 active:scale-95"
              >
                <FlaskConical className="w-4 h-4" />
                Ver todos los insumos ({totalInsumos})
              </button>
            </div>
          ) : productosFiltrados.length === 0 ? (
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
                const qty = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || 12);
                const isAdding = addingIds.has(prod.id);
                return (
                  <Card key={prod.id} className={cn(
                    "rounded-xl border transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md flex flex-col",
                    prod.esCritico ? "border-rose-200 bg-rose-50/30" : "border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800"
                  )}>
                    <CardContent className="p-3 flex flex-col flex-1 gap-2">
                      <div>
                        <h4 className="font-black uppercase text-[11px] tracking-tight text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[34px]">
                          {prod.nombre}
                        </h4>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums leading-none">
                          {formatCurrency(prod.precioCosto || 0)}
                        </span>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border", prod.esCritico ? "bg-white dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400")}>
                            S: {prod.stockActual}
                          </span>
                          <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                            F: {prod.necesidadProduccion.toFixed(0)}
                          </span>
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
                            "w-full h-8 rounded-lg font-black uppercase text-[10px] tracking-widest gap-1.5 transition-all shadow-sm active:scale-95",
                            isAdding ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
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
        </>
      )}

      {/* ── VISTA INSUMOS ──────────────────────────────────────────────────── */}
      {viewMode === 'insumos' && (
        <>
          {/* Leyenda rápida */}
          <div className="flex items-center gap-3 px-1 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Con precio en {activeProveedor.nombre}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              Sin precio — se agrega en $0
            </div>
          </div>

          {todosLosInsumos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center opacity-50">
              <FlaskConical className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="font-black text-lg uppercase tracking-tight">Sin insumos</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
                {search ? `No se encontró "${search}"` : 'No hay ingredientes registrados en el sistema.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 px-1">
              {todosLosInsumos.map((insumo) => {
                const qty = quantities[insumo.id] !== undefined ? quantities[insumo.id] : 1;
                const isAdding = addingIds.has(insumo.id);
                const precio = insumo.precioCosto ?? 0;

                return (
                  <Card key={insumo.id} className={cn(
                    "rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col",
                    insumo.tienePrecio
                      ? "border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-800/50"
                      : "border-amber-200/60 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-800/30"
                  )}>
                    <CardContent className="p-3 flex flex-col flex-1 gap-2">
                      <div>
                        <h4 className="font-black uppercase text-[11px] tracking-tight text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[34px]">
                          {insumo.nombre}
                        </h4>
                      </div>

                      {/* Precio / Badge */}
                      {insumo.tienePrecio ? (
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                          {formatCurrency(precio)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">
                          Sin precio
                        </span>
                      )}

                      {/* Stock si aplica */}
                      {insumo.stockActual > 0 && (
                        <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border w-fit",
                          insumo.esCritico
                            ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-400"
                            : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                        )}>
                          Stock: {insumo.stockActual}
                        </span>
                      )}

                      {/* Control de cantidad */}
                      <div className="mt-auto space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
                          <Button onClick={() => updateQuantity(insumo.id, -1, 1)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-0 shadow-sm">
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white px-1 min-w-[20px] text-center">{qty}</span>
                          <Button onClick={() => updateQuantity(insumo.id, 1, 1)} size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 p-0 shadow-sm">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddWithFeedback(insumo.id, activeProveedor.id, qty, precio)}
                          disabled={isAdding}
                          className={cn(
                            "w-full h-8 rounded-lg font-black uppercase text-[10px] tracking-widest gap-1.5 transition-all shadow-sm active:scale-95",
                            isAdding
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : insumo.tienePrecio
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-amber-500 hover:bg-amber-600 text-white"
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
        </>
      )}
    </div>
  );
}
