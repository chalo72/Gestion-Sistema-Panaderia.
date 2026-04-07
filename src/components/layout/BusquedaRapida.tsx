import { useState, useEffect, useMemo } from 'react';
import { Search, X, DollarSign, TrendingUp, Package, Store, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCan } from '@/contexts/AuthContext';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';

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

    // SINCRONIZADO: Usar costo UNITARIO (dividido por cantidadEmbalaje) para comparar con precioVenta
    const cantidadEmbalaje = safeNumber((mejorPrecio as any).cantidadEmbalaje) || 1;
    const costoUnitario = safeNumber(mejorPrecio.precioCosto) / cantidadEmbalaje;
    const precioVenta = safeNumber(producto.precioVenta);
    const utilidad = costoUnitario > 0 ? ((precioVenta - costoUnitario) / costoUnitario) * 100 : 0;

    return {
      tienePrecio: true,
      utilidad,
      numProveedores: todosPrecios.length,
      mejorCosto: costoUnitario,
    };
  };

  const handleCopyPrice = (precio: any, nombre: string) => {
    navigator.clipboard.writeText(formatCurrency(safeNumber(precio)));
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
                  const todosPrecios = getPreciosByProducto(producto.id);

                  return (
                    <div
                      key={producto.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* Fila principal: foto + nombre + precio venta */}
                      <div className="flex items-center gap-3">
                        {producto.imagen ? (
                          <img
                            src={producto.imagen}
                            alt={producto.nombre}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <h3 className="font-semibold text-sm flex-1 min-w-0 text-gray-800">{producto.nombre}</h3>
                        <span className="font-bold text-emerald-600 text-base whitespace-nowrap shrink-0">
                          {formatCurrency(producto.precioVenta)}
                        </span>
                      </div>

                      {/* Costos por proveedor (solo si tiene permisos y hay precios) */}
                      {canVerPrecioCosto && canVerProveedores && todosPrecios.length > 0 && (
                        <div className="mt-1.5 ml-13 flex flex-wrap gap-2">
                          {todosPrecios.map(precio => {
                            const cantEmbalaje = safeNumber((precio as any).cantidadEmbalaje) || 1;
                            const costoUnit = safeNumber(precio.precioCosto) / cantEmbalaje;
                            const esMejor = costoUnit === stats.mejorCosto;
                            const prov = getProveedorById(precio.proveedorId);
                            return (
                              <button
                                key={precio.id}
                                onClick={() => handleCopyPrice(costoUnit, prov?.nombre || 'proveedor')}
                                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                                  esMejor
                                    ? 'bg-emerald-100 text-emerald-700 font-semibold'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                <Store className="w-3 h-3" />
                                <span>{prov?.nombre || 'Proveedor'}</span>
                                <ArrowRight className="w-3 h-3 opacity-50" />
                                <span>{formatCurrency(costoUnit)}</span>
                                {esMejor && <TrendingUp className="w-3 h-3" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
