import { useState, useMemo } from 'react';
import { ChevronLeft, Check, Search, TrendingDown, Store, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';

interface ComparadorPreciosProps {
  proveedores: Proveedor[];
  productos: Producto[];
  precios: PrecioProveedor[];
  formatCurrency: (amount: number) => string;
  onVolver: () => void;
}

// Subcomponente para cada panel de proveedor
function PanelProductosProveedor({
  proveedor,
  productos,
  precios,
  selectedProductos,
  toggleProd
}: {
  proveedor: Proveedor;
  productos: Producto[];
  precios: PrecioProveedor[];
  selectedProductos: Set<string>;
  toggleProd: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  
  const prodsDelProveedor = useMemo(() => {
    // 1. Encontrar qué productos vende este proveedor
    const ids = new Set(precios.filter(p => p.proveedorId === proveedor.id).map(p => p.productoId));
    // 2. Mapear a objetos Producto
    let list = productos.filter(p => ids.has(p.id));
    // 3. Filtrar por búsqueda
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p?.nombre || '').toLowerCase().includes(s));
    }
    return list;
  }, [proveedor.id, productos, precios, search]);

  return (
    <div className="w-64 shrink-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-full">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
           <Package className="w-4 h-4" />
           <h4 className="text-[11px] font-black uppercase tracking-widest truncate">{proveedor.nombre}</h4>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-800">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar producto..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-[10px] font-bold w-full outline-none uppercase tracking-widest text-slate-600 dark:text-slate-300"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className="p-2 flex flex-col gap-1">
          {prodsDelProveedor.map(prod => {
            const isSel = selectedProductos.has(prod.id);
            return (
              <button 
                key={prod.id}
                onClick={() => toggleProd(prod.id)}
                className={`text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-colors border ${isSel ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-transparent text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate pr-2">{prod.nombre}</span>
                  {isSel && <Check className="w-3 h-3 shrink-0" />}
                </div>
              </button>
            );
          })}
          {prodsDelProveedor.length === 0 && (
            <div className="text-center p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
              No hay coincidencias
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ComparadorPrecios({
  proveedores,
  productos,
  precios,
  formatCurrency,
  onVolver
}: ComparadorPreciosProps) {
  const [selectedProveedores, setSelectedProveedores] = useState<Set<string>>(new Set());
  const [selectedProductos, setSelectedProductos] = useState<Set<string>>(new Set());
  
  const [searchProv, setSearchProv] = useState('');

  // Función para mostrar valores unitarios exactos sin el redondeo agresivo a la centena de formatCurrency
  const formatExact = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const provFiltrados = useMemo(() => 
    proveedores.filter(p => (p?.nombre || '').toLowerCase().includes(searchProv.toLowerCase()))
  , [proveedores, searchProv]);

  const toggleProv = (id: string) => {
    setSelectedProveedores(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleProd = (id: string) => {
    setSelectedProductos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] p-2 sm:p-4 bg-slate-50 dark:bg-slate-950 flex flex-col gap-4 animate-ag-fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <Button variant="ghost" onClick={onVolver} className="gap-2 font-black">
          <ChevronLeft className="w-4 h-4" /> VOLVER
        </Button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-indigo-500" />
            Comparador de Precios
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Analiza y encuentra la mejor opción de compra
          </p>
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 h-[calc(100vh-10rem)] min-h-[500px]">
        
        {/* SIDEBAR: Proveedores */}
        <div className="lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-sm shrink-0 h-full">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Proveedores</h3>
              </div>
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none">
                {selectedProveedores.size}
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar proveedor..." 
                value={searchProv}
                onChange={e => setSearchProv(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-[11px] font-bold w-full outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <div className="p-2 flex flex-col gap-1">
              {provFiltrados.map(prov => {
                const isSel = selectedProveedores.has(prov.id);
                return (
                  <button 
                    key={prov.id}
                    onClick={() => toggleProv(prov.id)}
                    className={`text-left px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-colors border ${isSel ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/30 dark:text-indigo-300' : 'bg-white border-transparent text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{prov.nombre}</span>
                      {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONTENT: Paneles de Productos + Tabla */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
          {selectedProveedores.size === 0 ? (
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 opacity-50 p-8 text-center shadow-sm">
               <Search className="w-16 h-16 mb-4 animate-pulse" />
               <p className="text-sm font-black uppercase tracking-widest">Aún no hay proveedores seleccionados</p>
               <p className="text-xs font-bold uppercase tracking-widest mt-2 max-w-sm">Selecciona proveedores en el panel izquierdo para ver sus productos y armar la comparativa</p>
            </div>
          ) : (
            <>
              {/* Paneles de Productos (Uno por Proveedor) */}
              <div className="h-[250px] shrink-0 overflow-x-auto overflow-y-hidden scrollbar-hide pb-2">
                <div className="flex gap-4 h-full">
                  {Array.from(selectedProveedores).map(provId => {
                     const prov = proveedores.find(p => p.id === provId);
                     if (!prov) return null;
                     return (
                       <PanelProductosProveedor 
                         key={provId}
                         proveedor={prov}
                         productos={productos}
                         precios={precios}
                         selectedProductos={selectedProductos}
                         toggleProd={toggleProd}
                       />
                     );
                  })}
                </div>
              </div>

              {/* Tabla Comparativa */}
              <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                {selectedProductos.size === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 p-8 text-center">
                      <Package className="w-12 h-12 mb-4" />
                      <p className="text-sm font-black uppercase tracking-widest">Selecciona productos a comparar</p>
                      <p className="text-[10px] font-bold mt-2 uppercase tracking-widest">Elige productos de los paneles superiores</p>
                   </div>
                ) : (
                  <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="p-4 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky left-0 top-0 bg-slate-50 dark:bg-slate-900 z-20 w-48 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                            Producto
                          </th>
                          {Array.from(selectedProveedores).map(provId => {
                            const prov = proveedores.find(p => p.id === provId);
                            return (
                              <th key={provId} className="p-4 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 min-w-[140px] sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/50 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                {prov?.nombre}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(selectedProductos).map(prodId => {
                          const prod = productos.find(p => p.id === prodId);
                          
                          // Calcular el costo unitario EXACTO para cada proveedor y encontrar el mínimo/máximo
                          let minUnitCost = Infinity;
                          let maxUnitCost = -Infinity;
                          const preciosParaProducto = Array.from(selectedProveedores).map(provId => {
                             const pp = precios.find(p => p.productoId === prodId && p.proveedorId === provId);
                             let unitCost = Infinity;
                             
                             if (pp) {
                               const cantPack = pp.cantidadEmbalaje || 1;
                               // No redondear agresivamente para no perder precisión en la comparación
                               unitCost = cantPack > 1 ? pp.precioCosto / cantPack : pp.precioCosto;
                               
                               if (unitCost < minUnitCost) minUnitCost = unitCost;
                               if (unitCost > maxUnitCost) maxUnitCost = unitCost;
                             }
                             
                             return { provId, pp, unitCost };
                          });

                          return (
                            <tr key={prodId} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                              <td className="p-4 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/20 z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                                {prod?.nombre}
                              </td>
                              {preciosParaProducto.map(({ provId, pp, unitCost }) => {
                                const isMin = pp && unitCost === minUnitCost && minUnitCost !== Infinity;
                                const isOnlyOption = isMin && maxUnitCost === minUnitCost;
                                const cantPack = pp?.cantidadEmbalaje || 1;
                                
                                // Análisis detallado basado en el empaque (multiplicando la diferencia por la cantidad de la caja)
                                const diffFromMinUnit = unitCost !== Infinity ? unitCost - minUnitCost : 0;
                                const perdidaCaja = Math.round(diffFromMinUnit * cantPack);
                                
                                const maxDiffUnit = maxUnitCost !== -Infinity ? maxUnitCost - minUnitCost : 0;
                                const ahorrosCajaMin = Math.round(maxDiffUnit * cantPack);
                                
                                return (
                                  <td key={provId} className="p-4">
                                    {pp ? (
                                      <div className={`inline-flex flex-col ${isMin && !isOnlyOption ? 'bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm' : 'px-3 py-2'}`}>
                                        <span className={`text-sm font-black tabular-nums ${isMin && !isOnlyOption ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                          {formatCurrency(pp.precioCosto)}
                                        </span>
                                        {cantPack > 1 ? (
                                          <div className="flex flex-col mt-0.5">
                                            <span className={`text-[9px] font-bold uppercase ${isMin && !isOnlyOption ? 'text-emerald-500/80' : 'text-slate-400'}`}>
                                              {pp.tipoEmbalaje || 'PACA'} (x{cantPack})
                                            </span>
                                            <span className={`text-[9px] font-black tracking-widest ${isMin && !isOnlyOption ? 'text-emerald-600/80' : 'text-indigo-500/70'}`}>
                                              P.U: {formatExact(Math.round(unitCost))}
                                            </span>
                                          </div>
                                        ) : (
                                          pp.tipoEmbalaje && pp.tipoEmbalaje !== 'UND' && (
                                            <span className={`text-[9px] font-bold uppercase mt-0.5 ${isMin && !isOnlyOption ? 'text-emerald-500/80' : 'text-slate-400'}`}>
                                              {pp.tipoEmbalaje}
                                            </span>
                                          )
                                        )}
                                        {/* Análisis IA */}
                                        {isMin && !isOnlyOption && (
                                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60">
                                            <div className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 tracking-widest bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-1 rounded-md w-fit">
                                              <Check className="w-3 h-3" /> Es el más barato
                                            </div>
                                            {maxDiffUnit > 0 && (
                                              <p className="text-[10px] font-bold text-emerald-700/90 dark:text-emerald-300/90 leading-snug">
                                                Ahorras <span className="font-black text-emerald-800 dark:text-emerald-200">{formatExact(Math.round(maxDiffUnit))}</span> por unidad.
                                                {cantPack > 1 && (
                                                  <>
                                                    <br/>
                                                    <span className="text-emerald-600 dark:text-emerald-400 text-[9px] mt-0.5 block">En esta presentación (x{cantPack}) ahorras un total de <span className="font-black">{formatCurrency(ahorrosCajaMin)}</span>.</span>
                                                  </>
                                                )}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                        
                                        {!isMin && diffFromMinUnit > 0 && (
                                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-800/60">
                                            <div className="text-[9px] font-black uppercase text-rose-500 dark:text-rose-400 flex items-center gap-1.5 tracking-widest bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md w-fit">
                                              <TrendingDown className="w-3 h-3 rotate-180" /> Opción costosa
                                            </div>
                                            <p className="text-[10px] font-bold text-rose-600/90 dark:text-rose-300/90 leading-snug">
                                              Pagas <span className="font-black text-rose-700 dark:text-rose-200">{formatExact(Math.round(diffFromMinUnit))}</span> de más por unidad.
                                              {cantPack > 1 && (
                                                <>
                                                  <br/>
                                                  <span className="text-rose-500 dark:text-rose-400 text-[9px] mt-0.5 block">En esta presentación (x{cantPack}) pagarías un total de <span className="font-black">{formatCurrency(perdidaCaja)}</span> de más.</span>
                                                </>
                                              )}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest px-3 py-1.5">
                                        No maneja
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
