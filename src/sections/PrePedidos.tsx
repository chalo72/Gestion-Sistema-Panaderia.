import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Package,
  Store,
  AlertTriangle,
  Check,
  X,
  ArrowLeft,
  Minus,
  TrendingUp,
  Calculator,
  Wand2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { Producto, Proveedor, PrecioProveedor, PrePedido } from '@/types';

interface PrePedidosProps {
  prepedidos: PrePedido[];
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  onAddPrePedido: (data: Omit<PrePedido, 'id' | 'fechaCreacion' | 'fechaActualizacion'>) => Promise<PrePedido>;
  onUpdatePrePedido: (id: string, updates: Partial<PrePedido>) => void;
  onDeletePrePedido: (id: string) => void;
  onAddItem: (prePedidoId: string, item: { productoId: string; proveedorId: string; cantidad: number; precioUnitario: number }) => void;
  onRemoveItem: (prePedidoId: string, itemId: string) => void;
  onUpdateItemCantidad: (prePedidoId: string, itemId: string, cantidad: number) => void;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  getMejorPrecioByProveedor: (productoId: string, proveedorId: string) => PrecioProveedor | undefined;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  formatCurrency: (value: number) => string;
  onGenerarSugerencias: () => Promise<number>;
}

export function PrePedidos({
  prepedidos,
  productos: _productos,
  proveedores,
  precios: _precios,
  onAddPrePedido,
  onUpdatePrePedido,
  onDeletePrePedido,
  onAddItem,
  onRemoveItem,
  onUpdateItemCantidad,
  getProductoById,
  getProveedorById,
  getMejorPrecioByProveedor,
  getPreciosByProveedor,
  formatCurrency,
  onGenerarSugerencias,
}: PrePedidosProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPrePedido, setSelectedPrePedido] = useState<PrePedido | null>(null);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);

  const [nuevoPedido, setNuevoPedido] = useState({
    nombre: '',
    proveedorId: '',
    presupuestoMaximo: '',
    notas: '',
  });

  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);

  // Calcular total actual del pedido seleccionado
  const totalActual = useMemo(() => {
    if (!selectedPrePedido) return 0;
    return selectedPrePedido.items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedPrePedido]);

  // Calcular porcentaje del presupuesto usado
  const porcentajeUsado = useMemo(() => {
    if (!selectedPrePedido || selectedPrePedido.presupuestoMaximo === 0) return 0;
    return (totalActual / selectedPrePedido.presupuestoMaximo) * 100;
  }, [totalActual, selectedPrePedido]);

  const handleCrearPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoPedido.nombre || !nuevoPedido.proveedorId || !nuevoPedido.presupuestoMaximo) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    const pedido = await onAddPrePedido({
      nombre: nuevoPedido.nombre,
      proveedorId: nuevoPedido.proveedorId,
      items: [],
      total: 0,
      presupuestoMaximo: parseFloat(nuevoPedido.presupuestoMaximo),
      estado: 'borrador',
      notas: nuevoPedido.notas,
    });

    toast.success('Pre-pedido creado correctamente');
    setNuevoPedido({ nombre: '', proveedorId: '', presupuestoMaximo: '', notas: '' });
    setIsDialogOpen(false);
    setSelectedPrePedido(pedido);
  };

  const handleAgregarItem = async () => {
    if (!selectedPrePedido || !selectedProductoId || cantidad < 1) {
      toast.error('Selecciona un producto y cantidad válida');
      return;
    }

    const precio = getMejorPrecioByProveedor(selectedProductoId, selectedPrePedido.proveedorId);
    if (!precio) {
      toast.error('Este proveedor no tiene precio para este producto');
      return;
    }

    await onAddItem(selectedPrePedido.id, {
      productoId: selectedProductoId,
      proveedorId: selectedPrePedido.proveedorId,
      cantidad: cantidad,
      precioUnitario: precio.precioCosto,
    });

    // Actualizar el pedido seleccionado
    const updated = prepedidos.find(p => p.id === selectedPrePedido.id);
    if (updated) {
      setSelectedPrePedido(updated);
    }

    toast.success('Producto agregado al pedido');
    setSelectedProductoId('');
    setCantidad(1);
    setShowAddItemDialog(false);
  };

  const handleEliminarItem = async (itemId: string) => {
    if (!selectedPrePedido) return;
    await onRemoveItem(selectedPrePedido.id, itemId);

    const updated = prepedidos.find(p => p.id === selectedPrePedido.id);
    if (updated) {
      setSelectedPrePedido(updated);
    }
    toast.success('Producto eliminado del pedido');
  };

  const handleCambiarCantidad = async (itemId: string, nuevaCantidad: number) => {
    if (!selectedPrePedido || nuevaCantidad < 1) return;
    await onUpdateItemCantidad(selectedPrePedido.id, itemId, nuevaCantidad);

    const updated = prepedidos.find(p => p.id === selectedPrePedido.id);
    if (updated) {
      setSelectedPrePedido(updated);
    }
  };

  const handleConfirmarPedido = async () => {
    if (!selectedPrePedido) return;
    await onUpdatePrePedido(selectedPrePedido.id, { estado: 'confirmado' });
    toast.success('Pedido confirmado');
    setSelectedPrePedido(null);
  };

  const handleRechazarPedido = async () => {
    if (!selectedPrePedido) return;
    await onUpdatePrePedido(selectedPrePedido.id, { estado: 'rechazado' });
    toast.success('Pedido rechazado');
    setSelectedPrePedido(null);
  };

  const handleEliminarPedido = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este pre-pedido?')) {
      await onDeletePrePedido(id);
      toast.success('Pre-pedido eliminado');
      if (selectedPrePedido?.id === id) setSelectedPrePedido(null);
    }
  };

  // Obtener productos disponibles para el proveedor seleccionado
  const getProductosDisponibles = (proveedorId: string) => {
    const preciosProveedor = getPreciosByProveedor(proveedorId);
    return preciosProveedor
      .map(p => {
        const producto = getProductoById(p.productoId);
        return producto ? { ...producto, precioCosto: p.precioCosto } : null;
      })
      .filter(Boolean) as (Producto & { precioCosto: number })[];
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Borrador</Badge>;
      case 'confirmado':
        return <Badge className="bg-green-500">Confirmado</Badge>;
      case 'rechazado':
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const pedidosBorrador = prepedidos.filter(p => p.estado === 'borrador');
  const pedidosConfirmados = prepedidos.filter(p => p.estado === 'confirmado');
  const pedidosRechazados = prepedidos.filter(p => p.estado === 'rechazado');

  // Vista de detalle del pedido seleccionado
  if (selectedPrePedido) {
    const proveedor = getProveedorById(selectedPrePedido.proveedorId);
    const productosDisponibles = getProductosDisponibles(selectedPrePedido.proveedorId);
    const excedePresupuesto = totalActual > selectedPrePedido.presupuestoMaximo;

    return (
      <div className="space-y-6">
        {/* Header con botón de regreso */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedPrePedido(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedPrePedido.nombre}</h2>
            <p className="text-gray-500 flex items-center gap-1">
              <Store className="w-4 h-4" />
              {proveedor?.nombre}
            </p>
          </div>
          <div className="ml-auto">
            {getEstadoBadge(selectedPrePedido.estado)}
          </div>
        </div>

        {/* Tarjeta de presupuesto */}
        <Card className={`border-2 ${excedePresupuesto ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calculator className={`w-6 h-6 ${excedePresupuesto ? 'text-red-600' : 'text-blue-600'}`} />
                <span className="font-semibold text-lg">Control de Presupuesto</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-600">Presupuesto: </span>
                <span className="font-bold text-lg">{formatCurrency(selectedPrePedido.presupuestoMaximo)}</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Total gastado:</span>
                <span className={`font-bold text-xl ${excedePresupuesto ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(totalActual)}
                </span>
              </div>
              <Progress
                value={Math.min(porcentajeUsado, 100)}
                className={`h-4 ${excedePresupuesto ? 'bg-red-200' : ''}`}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {excedePresupuesto ? (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Excedido por {formatCurrency(totalActual - selectedPrePedido.presupuestoMaximo)}
                  </span>
                ) : (
                  <span className="text-green-600">
                    Disponible: {formatCurrency(selectedPrePedido.presupuestoMaximo - totalActual)}
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-500">
                {porcentajeUsado.toFixed(1)}% usado
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sección de productos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Productos en el Pedido
              <Badge variant="secondary">{selectedPrePedido.items.length}</Badge>
            </CardTitle>
            {selectedPrePedido.estado === 'borrador' && (
              <Button onClick={() => setShowAddItemDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedPrePedido.items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No hay productos en este pedido</p>
                {selectedPrePedido.estado === 'borrador' && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowAddItemDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Producto
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedPrePedido.items.map((item) => {
                  const producto = getProductoById(item.productoId);
                  const margenGanancia = producto ? ((producto.precioVenta - item.precioUnitario) / item.precioUnitario) * 100 : 0;

                  return (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-500" />
                          <span className="font-semibold">{producto?.nombre}</span>
                          <Badge variant="outline" className="text-xs">{producto?.categoria}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span>Precio unitario: {formatCurrency(item.precioUnitario)}</span>
                          {producto && (
                            <span className="text-green-600 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Margen: {margenGanancia.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedPrePedido.estado === 'borrador' ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCambiarCantidad(item.id, item.cantidad - 1)}
                            disabled={item.cantidad <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-12 text-center font-semibold">{item.cantidad}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCambiarCantidad(item.id, item.cantidad + 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-semibold">Cantidad: {item.cantidad}</span>
                      )}

                      <div className="text-right min-w-[120px]">
                        <div className="font-bold text-lg">{formatCurrency(item.subtotal)}</div>
                        <div className="text-xs text-gray-500">subtotal</div>
                      </div>

                      {selectedPrePedido.estado === 'borrador' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminarItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Total */}
                <div className="flex items-center justify-between p-4 bg-blue-100 rounded-lg mt-4">
                  <span className="font-bold text-lg">TOTAL DEL PEDIDO:</span>
                  <span className={`font-bold text-2xl ${excedePresupuesto ? 'text-red-600' : 'text-blue-700'}`}>
                    {formatCurrency(totalActual)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones */}
        {selectedPrePedido.estado === 'borrador' && selectedPrePedido.items.length > 0 && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedPrePedido(null)}>
              Guardar Borrador
            </Button>
            <Button variant="destructive" onClick={handleRechazarPedido}>
              <X className="w-4 h-4 mr-2" />
              Rechazar
            </Button>
            <Button
              onClick={handleConfirmarPedido}
              disabled={excedePresupuesto}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Pedido
            </Button>
          </div>
        )}

        {/* Dialog para agregar producto */}
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Agregar Producto al Pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Selecciona un Producto</Label>
                <div className="mt-2 max-h-64 overflow-y-auto border rounded-lg">
                  {productosDisponibles.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">
                      Este proveedor no tiene productos con precios registrados
                    </p>
                  ) : (
                    <div className="divide-y">
                      {productosDisponibles.map((producto) => (
                        <div
                          key={producto.id}
                          onClick={() => setSelectedProductoId(producto.id)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${selectedProductoId === producto.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                        >
                          <div>
                            <p className="font-medium">{producto.nombre}</p>
                            <p className="text-xs text-gray-500">{producto.categoria}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-blue-600">{formatCurrency(producto.precioCosto)}</p>
                            <p className="text-xs text-gray-500">por unidad</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedProductoId && (
                <div>
                  <Label>Cantidad</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      variant="outline"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setCantidad(cantidad + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedProductoId && cantidad > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Subtotal a agregar:</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      (productosDisponibles.find(p => p.id === selectedProductoId)?.precioCosto || 0) * cantidad
                    )}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowAddItemDialog(false);
                  setSelectedProductoId('');
                  setCantidad(1);
                }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleAgregarItem}
                  disabled={!selectedProductoId}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar al Pedido
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Vista de lista de pedidos
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Pre-Pedidos</h2>
          <p className="text-gray-500 mt-1">Planifica tus compras y controla tu presupuesto</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={async () => {
              const count = await onGenerarSugerencias();
              if (count > 0) {
                toast.success(`${count} Borradores generados automáticamente 🪄`);
              } else {
                toast.info('No se encontraron productos con stock bajo para reabastecer');
              }
            }}
          >
            <Wand2 className="w-4 h-4" />
            Generar Automáticamente
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Pre-Pedido
            </Button>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Pre-Pedido</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCrearPedido} className="space-y-4">
                <div>
                  <Label>Nombre del Pedido *</Label>
                  <Input
                    value={nuevoPedido.nombre}
                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, nombre: e.target.value })}
                    placeholder="Ej: Pedido Enero 2024"
                  />
                </div>
                <div>
                  <Label>Proveedor *</Label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    value={nuevoPedido.proveedorId}
                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, proveedorId: e.target.value })}
                  >
                    <option value="">Selecciona un proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Presupuesto Máximo (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={nuevoPedido.presupuestoMaximo}
                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, presupuestoMaximo: e.target.value })}
                    placeholder="1000.00"
                  />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input
                    value={nuevoPedido.notas}
                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, notas: e.target.value })}
                    placeholder="Notas opcionales"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear Pedido</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

      </div>

      <Tabs defaultValue="borrador" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="borrador">
            Borradores ({pedidosBorrador.length})
          </TabsTrigger>
          <TabsTrigger value="confirmados">
            Confirmados ({pedidosConfirmados.length})
          </TabsTrigger>
          <TabsTrigger value="rechazados">
            Rechazados ({pedidosRechazados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="borrador" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosBorrador.map((pedido) => {
              const proveedor = getProveedorById(pedido.proveedorId);
              const porcentaje = (pedido.total / pedido.presupuestoMaximo) * 100;

              return (
                <Card
                  key={pedido.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedPrePedido(pedido)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pedido.nombre}</CardTitle>
                      {getEstadoBadge(pedido.estado)}
                    </div>
                    <p className="text-sm text-gray-500">{proveedor?.nombre}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Productos:</span>
                        <span className="font-medium">{pedido.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-semibold">{formatCurrency(pedido.total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Presupuesto:</span>
                        <span>{formatCurrency(pedido.presupuestoMaximo)}</span>
                      </div>
                      <Progress value={Math.min(porcentaje, 100)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {pedidosBorrador.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No hay pre-pedidos en borrador</p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Pre-Pedido
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="confirmados" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosConfirmados.map((pedido) => {
              const proveedor = getProveedorById(pedido.proveedorId);
              return (
                <Card key={pedido.id} className="opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pedido.nombre}</CardTitle>
                      {getEstadoBadge(pedido.estado)}
                    </div>
                    <p className="text-sm text-gray-500">{proveedor?.nombre}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Productos:</span>
                        <span>{pedido.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(pedido.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {pedidosConfirmados.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Check className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No hay pedidos confirmados</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rechazados" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosRechazados.map((pedido) => {
              const proveedor = getProveedorById(pedido.proveedorId);
              return (
                <Card key={pedido.id} className="opacity-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pedido.nombre}</CardTitle>
                      {getEstadoBadge(pedido.estado)}
                    </div>
                    <p className="text-sm text-gray-500">{proveedor?.nombre}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Productos:</span>
                        <span>{pedido.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-semibold">{formatCurrency(pedido.total)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-red-500"
                      onClick={() => handleEliminarPedido(pedido.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {pedidosRechazados.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <X className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No hay pedidos rechazados</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div >
  );
}

export default PrePedidos;
