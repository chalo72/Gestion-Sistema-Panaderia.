import { useState, useEffect, useMemo } from 'react';
import { Search, X, DollarSign, TrendingUp, Package, Store, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCan } from '@/contexts/AuthContext';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';

interface BusquedaRapidaProps {
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  getMejorPrecio: (productoId: string) => PrecioProveedor | null;
  getPreciosByProducto: (productoId: string) => PrecioProveedor[];
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function BusquedaRapida({ 
  productos, 
  proveedores, 
  precios: _precios,
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

  // Filtrar productos según búsqueda
  const resultados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return productos
      .filter(p => 
        p.nombre.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term)
      )
      .slice(0, 10); // Máximo 10 resultados
  }, [searchTerm, productos]);

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

    const utilidad = ((producto.precioVenta - mejorPrecio.precioCosto) / mejorPrecio.precioCosto) * 100;
    
    return {
      tienePrecio: true,
      utilidad,
      numProveedores: todosPrecios.length,
      mejorCosto: mejorPrecio.precioCosto,
    };
  };

  const handleCopyPrice = (precio: number, nombre: string) => {
    navigator.clipboard.writeText(formatCurrency(precio));
    toast.success(`Precio de ${nombre} copiado al portapapeles`);
  };

  return (
    <>
      {/* Botón de búsqueda en el sidebar */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white mb-2"
      >
        <Search className="w-5 h-5" />
        <span className="font-medium flex-1 text-left">Buscar Precios</span>
        <kbd className="px-2 py-1 text-xs bg-slate-700 rounded text-slate-400">Ctrl+K</kbd>
      </button>

      {/* Modal de búsqueda */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar producto por nombre, categoría o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 text-lg"
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              )}
              <kbd className="px-2 py-1 text-xs bg-gray-100 rounded text-gray-500">ESC</kbd>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            {searchTerm.trim() === '' ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Busca productos rápidamente</p>
                <p className="text-sm mt-2">Escribe el nombre, categoría o descripción</p>
                <div className="mt-6 flex justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>{productos.length} productos</span>
                  </div>
                  {canVerProveedores && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Store className="w-4 h-4" />
                      <span>{proveedores.length} proveedores</span>
                    </div>
                  )}
                </div>
              </div>
            ) : resultados.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No se encontraron productos</p>
                <p className="text-sm mt-1">Intenta con otra búsqueda</p>
              </div>
            ) : (
              <div className="divide-y">
                {resultados.map((producto) => {
                  const stats = getProductoStats(producto);
                  
                  return (
                    <div 
                      key={producto.id} 
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Nombre y categoría */}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{producto.nombre}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {producto.categoria}
                            </Badge>
                          </div>
                          
                          {/* Descripción */}
                          {producto.descripcion && (
                            <p className="text-sm text-gray-500 mb-2">{producto.descripcion}</p>
                          )}

                          {/* Precios - Según permisos */}
                          <div className="flex items-center gap-6 mt-3 flex-wrap">
                            {/* Precio de Venta - Todos lo ven */}
                            <button
                              onClick={() => handleCopyPrice(producto.precioVenta, producto.nombre)}
                              className="flex items-center gap-2 group"
                              title="Click para copiar"
                            >
                              <div className="bg-emerald-100 p-2 rounded-lg">
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="text-left">
                                <p className="text-xs text-gray-500">Precio Venta</p>
                                <p className="font-bold text-emerald-600 text-lg group-hover:underline">
                                  {formatCurrency(producto.precioVenta)}
                                </p>
                              </div>
                            </button>

                            {/* Mejor Costo - Solo con permiso */}
                            {canVerPrecioCosto && stats.tienePrecio && (
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                  <Store className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Mejor Costo</p>
                                  <p className="font-semibold text-blue-600">
                                    {formatCurrency(stats.mejorCosto)}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Utilidad - Solo con permiso */}
                            {canVerMargen && stats.tienePrecio && (
                              <div className="flex items-center gap-2">
                                <div className="bg-purple-100 p-2 rounded-lg">
                                  <TrendingUp className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Utilidad</p>
                                  <p className={`font-semibold ${stats.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stats.utilidad.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Proveedores - Solo con permiso */}
                            {canVerProveedores && stats.tienePrecio && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {stats.numProveedores} proveedor{stats.numProveedores !== 1 ? 'es' : ''}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Lista de precios por proveedor - Solo con permiso */}
                          {canVerProveedores && canVerPrecioCosto && stats.tienePrecio && stats.numProveedores > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-2">Precios por proveedor:</p>
                              <div className="flex flex-wrap gap-2">
                                {getPreciosByProducto(producto.id).map((precio) => {
                                  const proveedor = getProveedorById(precio.proveedorId);
                                  const esMejor = precio.precioCosto === stats.mejorCosto;
                                  
                                  return (
                                    <button
                                      key={precio.id}
                                      onClick={() => handleCopyPrice(precio.precioCosto, `${producto.nombre} - ${proveedor?.nombre}`)}
                                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                        esMejor 
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                      title="Click para copiar precio"
                                    >
                                      <span className="font-medium">{proveedor?.nombre}</span>
                                      <ArrowRight className="w-3 h-3" />
                                      <span>{formatCurrency(precio.precioCosto)}</span>
                                      {esMejor && (
                                        <Badge className="bg-green-500 text-white text-[10px] px-1">MEJOR</Badge>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer con tips */}
          <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded">↑↓</kbd>
                <span>navegar</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded">↵</kbd>
                <span>seleccionar</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded">esc</kbd>
                <span>cerrar</span>
              </span>
            </div>
            <span>Haz clic en cualquier precio para copiarlo</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
