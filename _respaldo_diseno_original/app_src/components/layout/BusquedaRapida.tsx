import { useState, useEffect, useMemo } from 'react';
import { Search, X, DollarSign, TrendingUp, Package, Store, ArrowRight, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCan } from '@/contexts/AuthContext';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';
import { cn } from '@/lib/utils';
import { buscarProductosVenta, resumenEspurgue } from '@/lib/busqueda-productos';

// Utilidad ultra-segura para evitar "Cannot convert object to primitive value"
const safeNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object') return 0;
  try {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
};

interface BusquedaRapidaProps {
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  inventario?: any[]; // Añadido
  getMejorPrecio: (productoId: string) => PrecioProveedor | null;
  getPreciosByProducto: (productoId: string) => PrecioProveedor[];
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function BusquedaRapida({
  productos,
  proveedores,
  precios: _precios,
  inventario = [],
  getMejorPrecio,
  getPreciosByProducto,
  getProveedorById,
  formatCurrency
}: BusquedaRapidaProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { check } = useCan();

  // Permisos
  const canVerPrecioCosto = check('VER_PRECIO_COSTO');
  const canVerMargen = check('VER_MARGEN');
  const canVerProveedores = check('VER_PROVEEDORES');

  // Atajo de teclado Ctrl+K o Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Espurgue suave: oculta insumos sin precio y basura; PVP > 0 siempre sale
  const resultados = useMemo(
    () => buscarProductosVenta(productos, searchTerm, { limite: 60, incluirSinPrecio: true, priorizarNombre: true }),
    [searchTerm, productos]
  );

  const espurgue = useMemo(() => resumenEspurgue(productos), [productos]);

  // Calcular estadísticas del producto
  const getProductoStats = (producto: Producto) => {
    const mejorPrecio = getMejorPrecio(producto.id);
    const todosPrecios = getPreciosByProducto(producto.id);

    if (!mejorPrecio) {
      return {
        tienePrecio: false,
        utilidad: 0,
        numProveedores: 0,
        mejorCosto: 0,
      };
    }

    const costoRef = safeNumber(mejorPrecio.precioCosto) / (safeNumber(mejorPrecio.cantidadEmbalaje) || 1);
    const v = safeNumber(producto.precioVenta);
    const utilidad = v > 0 && costoRef > 0 ? ((v - costoRef) / v) * 100 : 0;

    return {
      tienePrecio: true,
      utilidad,
      numProveedores: todosPrecios.length,
      mejorCosto: costoRef,
    };
  };

  const handleCopyPrice = (precio: number, name: string) => {
    navigator.clipboard.writeText(precio.toString())
      .then(() => {
        toast.success(`Precio copiado: ${formatCurrency(precio)}`, {
          description: name,
        });
        setIsOpen(false);
      })
      .catch(() => {
        toast.error('Error al copiar el precio');
      });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-pink-300 dark:hover:border-pink-500/50 hover:shadow-md hover:shadow-pink-500/10 transition-all duration-300 group"
      >
        <Search className="w-4 h-4 sm:w-5 sm:h-5 group-hover:text-pink-500 transition-colors shrink-0" />
        <span className="flex-1 text-left text-sm sm:text-base font-medium">Búsqueda rápida...</span>
        <kbd className="hidden sm:inline-flex h-5 sm:h-6 items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 font-mono text-[10px] sm:text-[12px] font-medium text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Modal de búsqueda interactivo y premium */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden p-0 gap-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl sm:rounded-2xl">
          <DialogHeader className="p-0 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-pink-50/50 to-purple-50/50 dark:from-pink-900/10 dark:to-purple-900/10">
            <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
              <Search className="w-6 h-6 sm:w-7 sm:h-7 text-pink-500 animate-pulse shrink-0" />
              <Input
                placeholder="Busca un producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 text-xl sm:text-2xl bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 font-medium h-auto p-0"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">ESC</kbd>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[65vh] sm:max-h-[60vh] p-2 sm:p-4 bg-slate-50/50 dark:bg-slate-950/50">
            {searchTerm.trim() === '' ? (
              <div className="py-12 sm:py-20 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center">
                  <Search className="w-10 h-10 sm:w-12 sm:h-12 text-pink-400 dark:text-pink-500" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200 px-4">Busca productos al instante</p>
                <p className="text-slate-500 mt-2 text-base sm:text-lg px-4">Escribe el nombre del producto · insumos y pruebas quedan ocultos</p>
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 text-sm px-4">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <Package className="w-4 h-4 text-pink-500" />
                    <span className="font-semibold">{espurgue.venta}</span> a la venta
                    {espurgue.ocultos > 0 && (
                      <span className="text-slate-400 font-normal">· {espurgue.ocultos} ocultos</span>
                    )}
                  </div>
                  {canVerProveedores && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <Store className="w-4 h-4 text-purple-500" />
                      <span className="font-semibold">{proveedores.length}</span> proveedores
                    </div>
                  )}
                </div>
              </div>
            ) : resultados.length === 0 ? (
              <div className="py-12 sm:py-20 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <Package className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200">No se encontraron resultados</p>
                <p className="text-slate-500 mt-2 text-base sm:text-lg px-4">
                  Si no sale, prueba otra palabra. Solo se ocultan insumos sin precio y pruebas.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:gap-3 pb-2 sm:pb-4">
                {resultados.map((producto, index) => {
                  const invItem = inventario.find(i => i.productoId === producto.id);
                  const stock = invItem ? invItem.stockActual : 0;
                  const hasStock = stock > 0;

                  return (
                    <div
                      key={producto.id}
                      onClick={() => { if ((Number(producto.precioVenta) || 0) > 0) handleCopyPrice(producto.precioVenta, producto.nombre); else toast.message('Sin precio de venta', { description: producto.nombre }); }}
                      className="group relative flex items-center bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-pink-500/10 hover:border-pink-300 dark:hover:border-pink-500/50 hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 cursor-pointer overflow-hidden"
                      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                    >
                      {/* Efecto hover glass (resplandor izquierdo) */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-pink-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      <div className="flex flex-row items-center gap-3 sm:gap-5 w-full z-10 pl-1 sm:pl-2">
                        {/* Imagen con reborde elegante */}
                        <div className="relative shrink-0">
                          {producto.imagen ? (
                            <img
                              src={producto.imagen}
                              alt={producto.nombre}
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover shadow-md border border-white dark:border-slate-800 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 drop-shadow-sm" />
                            </div>
                          )}
                        </div>

                        {/* Contenido (Nombre + Inventario) */}
                        <div className="flex flex-col flex-1 min-w-0 py-1">
                          <h3 className="font-bold text-base sm:text-xl md:text-2xl text-slate-800 dark:text-slate-100 leading-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                            {producto.nombre}
                          </h3>

                          {/* Inventario/Stock y Categoría */}
                          <div className="mt-1 sm:mt-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity flex-wrap">
                            <Badge 
                              variant={hasStock ? "default" : "destructive"} 
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border-0 shadow-sm",
                                hasStock 
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30" 
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/30"
                              )}
                            >
                              <Package className="w-3 h-3" />
                              {stock} en stock
                            </Badge>

                            {(Number(producto.precioVenta) || 0) <= 0 && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-0">
                                Sin PVP
                              </Badge>
                            )}

                            {producto.categoria && (
                              <Badge 
                                variant="secondary" 
                                className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-0 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors capitalize"
                              >
                                <Tag className="w-3 h-3" />
                                {producto.categoria}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* PVP con GLOW Neon */}
                        <div className="flex flex-col items-end shrink-0 pl-1 sm:pl-6 relative">
                          <span className="text-[26px] sm:text-4xl md:text-[42px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-pink-500 to-purple-600 drop-shadow-[0_2px_10px_rgba(236,72,153,0.3)] group-hover:drop-shadow-[0_4px_15px_rgba(236,72,153,0.6)] group-hover:scale-105 transition-all duration-300 whitespace-nowrap">
                            {formatCurrency(producto.precioVenta)}
                          </span>
                          
                          {/* Tooltip de "Copiar" que aparece on hover */}
                          <div className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold px-3 py-1 rounded-full text-xs shadow-lg transform translate-y-2 group-hover:translate-y-0 pointer-events-none hidden md:block">
                            Copiar PVP
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer ultra moderno */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between sm:justify-between justify-center">
            <div className="hidden sm:flex items-center gap-6">
              <span className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md">↑↓</kbd>
                Navegar
              </span>
              <span className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md">↵</kbd>
                Seleccionar
              </span>
              <span className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md">ESC</kbd>
                Cerrar
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-pink-500 flex items-center gap-2 drop-shadow-sm">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-pink-500 animate-ping"></span>
              Búsqueda Ultra-Rápida
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
