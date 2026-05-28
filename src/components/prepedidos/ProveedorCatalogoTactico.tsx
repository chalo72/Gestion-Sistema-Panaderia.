import { useState, useMemo } from 'react';
import {
  Search,
  Store,
  AlertTriangle,
  ShoppingCart,
  ArrowLeft,
  Package,
  Check,
  Minus,
  Plus,
  PackagePlus,
  ChevronDown
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
  }, [proveedores, precios, productos, inventario, necesidadesProduccion, search, recetas]);

  const activeProveedor = stats.find(s => s.id === (selectedProvId || activeProveedorId)) || stats.find(s => s.productos.length > 0) || stats[0];

  // Categorias unicas del proveedor activo
  const categoriasDisponibles = useMemo(() => {
    if (!activeProveedor) return [];
    const cats = [...new Set(
      activeProveedor.productos
        .map(p => (p as any).categoria as string)
        .filter(Boolean)
    )].sort();
    return cats;
  }, [activeProveedor]);

  // Productos filtrados por categoria + busqueda de texto
  const productosFiltrados = useMemo(() => {
    if (!activeProveedor) return [];
    return activeProveedor.productos.filter(p => {
      const matchCat = categoriaActiva === 'todos' || (p as any).categoria === categoriaActiva;
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeProveedor, categoriaActiva, search]);

  // Insumos sin precio: ingredientes que NO tienen precio en este proveedor
  const [showInsumosSinPrecio, setShowInsumosSinPrecio] = useState(false);
  const [searchInsumos, setSearchInsumos] = useState('');
  const [qtyInsumos, setQtyInsumos] = useState<Record<string, number>>({});

  const insumosSinPrecio = useMemo(() => {
    if (!activeProveedor) return [];
    const idsConPrecio = new Set(activeProveedor.productos.map(p => p.id));
    return productos
      .filter(p => {
        const tipo = (p as any).tipo;
        const cat = ((p as any).categoria || '').toLowerCase();
        const esInsumo = tipo === 'ingrediente' || cat.startsWith('ins:') || cat === 'insumos';
        const sinPrecio = !idsConPrecio.has(p.id);
        const matchSearch = !searchInsumos || p.nombre.toLowerCase().includes(searchInsumos.toLowerCase());
        return esInsumo && sinPrecio && matchSearch;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [activeProveedor, productos, searchInsumos]);

  const updateQuantity = (id: string, delta: number, base: number) => {
    setQuantities(prev => {
      const current = prev[id] !== undefined ? prev[id] : base;
      return { ...prev, [id]: Math.max(0, current + delta) };
    });
  };

  const handleAddWithFeedback = (prodId: string, proveedorId: string, qty: number, precio: number) => {
     setAddingIds(prev => new Set(prev).add(prodId));
     onAddItemToDraft(prodId, proveedorId, qty, precio);
     
     // Feedback visual instantáneo
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
    <div className="animate-ag-fade-in space-y-6 pb-20">
      
      {/* HEADER ESTÁNDAR PROFESIONAL */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20">
         <div className="flex items-center gap-4">
            <Button 
                onClick={onShowBoard}
                variant="outline"
                className="w-10 h-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm"
            >
               <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
               <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 group">{activeProveedor.nombre}</h2>
               <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] px-2 py-0.5 uppercase">Catálogo Activo</Badge>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {productosFiltrados.length === activeProveedor.productos.length
                      ? `${activeProveedor.productos.length} items`
                      : `${productosFiltrados.length} de ${activeProveedor.productos.length} items`}
                  </span>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <Input 
                 placeholder="BUSCAR PRODUCTO..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="h-10 pl-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold uppercase"
               />
            </div>
         </div>
      </div>

      {/* SELECTOR DE PROVEEDORES (pills horizontales) */}
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

      {/* PESTAÑAS DE CATEGORIA */}
      {categoriasDisponibles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {/* Pestaña "Todos" */}
          <button
            onClick={() => setCategoriaActiva('todos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
              ${categoriaActiva === 'todos'
                ? 'bg-slate-900 text-white border-transparent shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
          >
            Todos
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${categoriaActiva === 'todos' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
              {activeProveedor.productos.length}
            </span>
          </button>

          {/* Una pestaña por categoria */}
          {categoriasDisponibles.map(cat => {
            const count = activeProveedor.productos.filter(p => (p as any).categoria === cat).length;
            const isActive = categoriaActiva === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
                  ${isActive
                    ? 'bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-200 hover:text-indigo-600'}`}
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

      {/* GRID COMPACTO ESTILO POS O ESTADOS VACÍOS */}
      {activeProveedor.productos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center opacity-50">
           <Package className="w-16 h-16 mb-4 text-slate-400" />
           <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white">Catálogo Vacío</h3>
           <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
             {activeProveedor.nombre} no tiene productos asignados.
           </p>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center opacity-50">
           <Search className="w-16 h-16 mb-4 text-slate-400" />
           <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white">Sin resultados</h3>
           <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
             No se encontró "{search}" en el catálogo de {activeProveedor.nombre}.
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 px-1">
          {productosFiltrados.map((prod) => {
            const qty = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || 12);
            const isAdding = addingIds.has(prod.id);
            
            return (
              <Card key={prod.id} className={cn(
                "rounded-xl border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md flex flex-col",
                prod.esCritico ? "border-rose-200 bg-rose-50/30" : "border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800"
              )}>
                <CardContent className="p-3 flex flex-col flex-1 gap-2">
                   
                   {/* Metadata Superior: Título */}
                   <div>
                      <h4 className="font-black uppercase text-[11px] tracking-tight text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[34px]">
                         {prod.nombre}
                      </h4>
                   </div>

                   {/* Bloque de Compra y Stock Compacto */}
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

                   {/* Empaque info */}
                   <div className="flex items-center gap-1 opacity-75 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-md border border-slate-100 dark:border-slate-800 mt-1">
                       <Package className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                       <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {prod.tipoEmbalaje} x {prod.cantidadEmbalaje}
                       </span>
                   </div>

                   <div className="mt-auto space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Control POS Estándar */}
                      <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="flex gap-0.5">
                              {Number(prod.cantidadEmbalaje || 1) > 1 && (
                                <Button 
                                  onClick={() => updateQuantity(prod.id, -Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)}
                                  size="icon" variant="ghost" title={`Quitar 1 ${prod.tipoEmbalaje}`}
                                  className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-0 text-[8px] font-black shadow-sm"
                                >
                                  {`-${prod.cantidadEmbalaje}`}
                                </Button>
                              )}
                              <Button 
                                onClick={() => updateQuantity(prod.id, -1, prod.necesidadTotal)}
                                size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-0 shadow-sm"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white px-1 min-w-[20px] text-center">{qty}</span>
                            
                            <div className="flex gap-0.5">
                              <Button 
                                onClick={() => updateQuantity(prod.id, 1, prod.necesidadTotal)}
                                size="icon" variant="ghost" className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 p-0 shadow-sm"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              {Number(prod.cantidadEmbalaje || 1) > 1 && (
                                <Button 
                                  onClick={() => updateQuantity(prod.id, Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)}
                                  size="icon" variant="ghost" title={`Agregar 1 ${prod.tipoEmbalaje}`}
                                  className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 p-0 text-[8px] font-black shadow-sm"
                                >
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
                          isAdding 
                             ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20" 
                             : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
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

      {/* ── Sección: Insumos sin precio registrado ── */}
      {insumosSinPrecio.length > 0 || showInsumosSinPrecio ? (
        <div className="mt-6 border border-dashed border-amber-300 dark:border-amber-700 rounded-2xl overflow-hidden">
          {/* Header colapsable */}
          <button
            onClick={() => setShowInsumosSinPrecio(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Insumos sin precio registrado
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300">
                {insumosSinPrecio.length}
              </span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-amber-600 transition-transform", showInsumosSinPrecio && "rotate-180")} />
          </button>

          {showInsumosSinPrecio && (
            <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
              <p className="text-[10px] text-slate-500 font-bold">
                Estos insumos no tienen precio asignado a este proveedor. Puedes agregarlos igualmente — el costo quedará en $0 y podrás actualizarlo en el módulo de Proveedores.
              </p>
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  placeholder="Buscar insumo..."
                  value={searchInsumos}
                  onChange={e => setSearchInsumos(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>

              {insumosSinPrecio.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Sin resultados</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                  {insumosSinPrecio.map(insumo => {
                    const qty = qtyInsumos[insumo.id] ?? 1;
                    const isAdding = addingIds.has(insumo.id);
                    return (
                      <div key={insumo.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 min-h-[28px]">
                          {insumo.nombre}
                        </p>
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Sin precio</span>
                        {/* Cantidad */}
                        <div className="flex items-center justify-between bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-1">
                          <button
                            onClick={() => setQtyInsumos(p => ({ ...p, [insumo.id]: Math.max(1, (p[insumo.id] ?? 1) - 1) }))}
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-rose-500 hover:bg-rose-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black tabular-nums">{qty}</span>
                          <button
                            onClick={() => setQtyInsumos(p => ({ ...p, [insumo.id]: (p[insumo.id] ?? 1) + 1 }))}
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-emerald-500 hover:bg-emerald-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleAddWithFeedback(insumo.id, activeProveedor.id, qty, 0)}
                          disabled={isAdding}
                          className={cn(
                            "w-full h-7 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                            isAdding ? "bg-emerald-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
                          )}
                        >
                          {isAdding ? '✓ Listo' : 'Agregar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
