import { useState, useMemo } from 'react';
import { 
  Search, 
  Store, 
  AlertTriangle, 
  ShoppingCart,
  ArrowLeft,
  Package,
  Check
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

      {/* GRID ESTÁNDAR MEDIANO: Cards cómodas y balanceadas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-1">
        {productosFiltrados.map((prod) => {
          const qty = quantities[prod.id] !== undefined ? quantities[prod.id] : (prod.necesidadTotal || 12);
          const isAdding = addingIds.has(prod.id);
          
          return (
            <Card key={prod.id} className={cn(
              "rounded-2xl border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md flex flex-col min-h-[300px]",
              prod.esCritico ? "border-rose-200 bg-rose-50/10" : "border-slate-100 bg-white"
            )}>
              <CardContent className="p-4 flex flex-col flex-1">
                 
                 {/* Metadata Superior: Título y SKU */}
                 <div className="mb-4">
                    <h4 className="font-black uppercase text-sm tracking-tight text-slate-900 dark:text-slate-100 leading-tight line-clamp-2 min-h-[40px] uppercase">
                       {prod.nombre}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-300 uppercase block mt-1 tracking-widest">#{prod.id.slice(-4).toUpperCase()}</span>
                 </div>

                 {/* Bloque de Compra (Precio y Empaque) */}
                 <div className="bg-indigo-50/50 rounded-2xl p-3 mb-4 border border-indigo-100/50">
                    <div className="flex items-center gap-2 mb-1.5 opacity-80">
                       <Package className="w-3.5 h-3.5 text-indigo-500" />
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                         {prod.tipoEmbalaje} X {prod.cantidadEmbalaje}
                       </span>
                    </div>
                    <span className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(prod.precioCosto || 0)}</span>
                 </div>

                 {/* Stock y Necesidad (Mediano) */}
                 <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={cn("p-2 rounded-xl border text-center transition-colors", prod.esCritico ? "bg-white border-rose-200" : "bg-slate-50 border-slate-50")}>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Stock</p>
                       <p className={cn("text-xl font-black tabular-nums leading-none", prod.esCritico ? "text-rose-600" : "text-slate-800")}>{prod.stockActual}</p>
                    </div>
                    <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Falta</p>
                       <p className="text-xl font-black tabular-nums text-indigo-500 leading-none">+{prod.necesidadProduccion.toFixed(0)}</p>
                    </div>
                 </div>

                 <div className="mt-auto space-y-3">
                    {/* Control POS Estándar */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-slate-100/50 p-1.5 rounded-xl border border-slate-50">
                          <div className="flex gap-1">
                            {Number(prod.cantidadEmbalaje || 1) > 1 && (
                              <Button 
                                onClick={() => updateQuantity(prod.id, -Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)}
                                size="icon"
                                variant="ghost" 
                                title={`Quitar 1 ${prod.tipoEmbalaje || 'PACA'} (${prod.cantidadEmbalaje} uni)`}
                                className="w-8 h-8 rounded-lg bg-white border border-rose-100 shadow-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-0 text-[9px] font-black"
                              >
                                {`-${prod.cantidadEmbalaje}`}
                              </Button>
                            )}
                            <Button 
                              onClick={() => updateQuantity(prod.id, -1, prod.necesidadTotal)}
                              size="icon"
                              variant="ghost" 
                              className="w-8 h-8 rounded-lg bg-white shadow-sm text-slate-400 hover:text-rose-500 p-0"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                            </Button>
                          </div>
                          
                          <span className="text-xl font-black tabular-nums text-slate-900 px-2">{qty}</span>
                          
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => updateQuantity(prod.id, 1, prod.necesidadTotal)}
                              size="icon"
                              variant="ghost" 
                              className="w-8 h-8 rounded-lg bg-white shadow-sm text-slate-400 hover:text-emerald-500 p-0"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                            </Button>
                            {Number(prod.cantidadEmbalaje || 1) > 1 && (
                              <Button 
                                onClick={() => updateQuantity(prod.id, Number(prod.cantidadEmbalaje || 1), prod.necesidadTotal)}
                                size="icon"
                                variant="ghost" 
                                title={`Agregar 1 ${prod.tipoEmbalaje || 'PACA'} (${prod.cantidadEmbalaje} uni)`}
                                className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 p-0 text-[9px] font-black"
                              >
                                {`+${prod.cantidadEmbalaje}`}
                              </Button>
                            )}
                          </div>
                      </div>
                      
                      {/* Resumen de conversión visible solo si es embalaje y la cantidad es múltiplo aprox */}
                      {Number(prod.cantidadEmbalaje || 1) > 1 && qty >= Number(prod.cantidadEmbalaje || 1) && (
                        <div className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 rounded-lg py-1 border border-slate-100">
                           Eq: {(qty / Number(prod.cantidadEmbalaje || 1)).toFixed(1).replace('.0', '')} {prod.tipoEmbalaje || 'CAJA'}(s)
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      size="lg"
                      onClick={() => handleAddWithFeedback(prod.id!, activeProveedor.id, qty, prod.precioCosto || 0)}
                      disabled={isAdding}
                      className={cn(
                        "w-full h-12 rounded-xl font-black uppercase text-xs tracking-widest gap-2 transition-all active:scale-95 shadow-lg",
                        isAdding 
                           ? "bg-emerald-500 text-white animate-ag-pop shadow-emerald-500/10" 
                           : "bg-slate-950 hover:bg-slate-900 text-white shadow-slate-900/10"
                      )}
                    >
                      {isAdding ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-4 h-4" />}
                      {isAdding ? 'AGREGADO' : 'AGREGAR'}
                    </Button>
                 </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
