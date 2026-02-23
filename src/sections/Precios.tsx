import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
  DollarSign,
  Plus,
  Search,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Store,
  ArrowRightLeft,
  Check,
  Clock,
  History,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Producto, Proveedor, PrecioProveedor, HistorialPrecio } from '@/types';

interface PreciosProps {
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  historial: HistorialPrecio[];
  onAddOrUpdatePrecio: (data: {
    productoId: string;
    proveedorId: string;
    precioCosto: number;
    notas?: string;
  }) => void;
  onDeletePrecio: (id: string) => void;
  getPrecioByIds: (productoId: string, proveedorId: string) => PrecioProveedor | undefined;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function Precios({
  productos,
  proveedores,
  precios,
  historial,
  onAddOrUpdatePrecio,
  onDeletePrecio,
  getPrecioByIds: _getPrecioByIds,
  getProductoById,
  getProveedorById,
  formatCurrency: formatCurrencyProp,
}: PreciosProps) {
  const { check } = useCan(); // Integración de permisos
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrecio, setEditingPrecio] = useState<PrecioProveedor | null>(null);
  const [filtroProductoHistorial, setFiltroProductoHistorial] = useState<string>('todos');

  const [formData, setFormData] = useState({
    productoId: '',
    proveedorId: '',
    precioCosto: '',
    notas: '',
  });

  const filteredPrecios = precios.filter(p => {
    const producto = getProductoById(p.productoId);
    const proveedor = getProveedorById(p.proveedorId);
    return (
      producto?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const preciosPorProducto = useMemo(() => {
    const grouped: Record<string, PrecioProveedor[]> = {};
    precios.forEach(p => {
      if (!grouped[p.productoId]) {
        grouped[p.productoId] = [];
      }
      grouped[p.productoId].push(p);
    });
    return grouped;
  }, [precios]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productoId || !formData.proveedorId || !formData.precioCosto) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    onAddOrUpdatePrecio({
      productoId: formData.productoId,
      proveedorId: formData.proveedorId,
      precioCosto: parseFloat(formData.precioCosto),
      notas: formData.notas,
    });

    toast.success(editingPrecio ? 'Precio actualizado correctamente' : 'Precio registrado correctamente');
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      productoId: '',
      proveedorId: '',
      precioCosto: '',
      notas: '',
    });
    setEditingPrecio(null);
  };

  const handleEdit = (precio: PrecioProveedor) => {
    if (!check('EDITAR_PRECIOS')) {
      toast.error('No tienes permiso para editar precios');
      return;
    }
    setEditingPrecio(precio);
    setFormData({
      productoId: precio.productoId,
      proveedorId: precio.proveedorId,
      precioCosto: precio.precioCosto.toString(),
      notas: precio.notas || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!check('EDITAR_PRECIOS')) {
      toast.error('No tienes permiso para eliminar precios');
      return;
    }
    if (confirm('¿Estás seguro de eliminar este precio?')) {
      onDeletePrecio(id);
      toast.success('Precio eliminado correctamente');
    }
  };

  const formatCurrency = (value: number) => {
    return formatCurrencyProp(value);
  };

  const getMejorPrecioProducto = (productoId: string) => {
    const preciosProducto = precios.filter(p => p.productoId === productoId);
    if (preciosProducto.length === 0) return null;
    return preciosProducto.reduce((min, p) => p.precioCosto < min.precioCosto ? p : min);
  };

  const getComparacionProducto = (productoId: string) => {
    const preciosProducto = precios.filter(p => p.productoId === productoId);
    if (preciosProducto.length < 2) return null;

    const ordenados = [...preciosProducto].sort((a, b) => a.precioCosto - b.precioCosto);
    const masBarato = ordenados[0];
    const masCaro = ordenados[ordenados.length - 1];
    const diferencia = masCaro.precioCosto - masBarato.precioCosto;
    const porcentaje = (diferencia / masBarato.precioCosto) * 100;

    return {
      masBarato,
      masCaro,
      diferencia,
      porcentaje,
      totalProveedores: preciosProducto.length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Gestión de Precios</h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            Inteligencia de mercado y comparativa de proveedores
          </p>
        </div>
        {check('EDITAR_PRECIOS') ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="btn-gradient-primary shadow-lg shadow-blue-600/20">
                <Plus className="w-4 h-4 mr-2" />
                Registrar Precio
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingPrecio ? 'Actualizar Precio' : 'Registrar Precio'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="producto">Producto *</Label>
                  <Select
                    value={formData.productoId}
                    onValueChange={(value) => setFormData({ ...formData, productoId: value })}
                    disabled={!!editingPrecio}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="proveedor">Proveedor *</Label>
                  <Select
                    value={formData.proveedorId}
                    onValueChange={(value) => setFormData({ ...formData, proveedorId: value })}
                    disabled={!!editingPrecio}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.map((proveedor) => (
                        <SelectItem key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="precioCosto">Precio de Costo (€) *</Label>
                  <Input
                    id="precioCosto"
                    type="number"
                    step="0.01"
                    value={formData.precioCosto}
                    onChange={(e) => setFormData({ ...formData, precioCosto: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="notas">Notas</Label>
                  <Input
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Notas opcionales"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingPrecio ? 'Actualizar' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="lista">Lista de Precios</TabsTrigger>
          <TabsTrigger value="comparacion">Comparación</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1">
            <History className="w-3 h-3" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por producto o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredPrecios.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No hay precios registrados</p>
                  <p className="text-sm">Haz clic en "Nuevo Precio" para comenzar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Precio Costo</TableHead>
                        <TableHead>Precio Venta</TableHead>
                        <TableHead>Utilidad</TableHead>
                        <TableHead>Actualizado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrecios.map((precio) => {
                        const producto = getProductoById(precio.productoId);
                        const proveedor = getProveedorById(precio.proveedorId);
                        const mejorPrecio = producto ? getMejorPrecioProducto(producto.id) : null;
                        const esMejorPrecio = mejorPrecio?.id === precio.id;

                        if (!producto || !proveedor) return null;

                        const utilidad = ((producto.precioVenta - precio.precioCosto) / precio.precioCosto) * 100;

                        return (
                          <TableRow key={precio.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{producto.nombre}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Store className="w-4 h-4 text-gray-400" />
                                <span>{proveedor.nombre}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-600">
                                  {formatCurrency(precio.precioCosto)}
                                </span>
                                {esMejorPrecio && (
                                  <Badge variant="default" className="text-xs bg-green-500">
                                    <Check className="w-3 h-3 mr-1" />
                                    Mejor
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-emerald-600">
                                {formatCurrency(producto.precioVenta)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {utilidad >= 0 ? (
                                  <TrendingUp className="w-4 h-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-500" />
                                )}
                                <span className={`font-medium ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {utilidad.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">
                                {new Date(precio.fechaActualizacion).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(precio)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(precio.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparacion" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productos.filter(p => (preciosPorProducto[p.id] || []).length >= 2).map((producto) => {
              const comparacion = getComparacionProducto(producto.id);
              if (!comparacion) return null;

              const proveedorBarato = getProveedorById(comparacion.masBarato.proveedorId);
              const proveedorCaro = getProveedorById(comparacion.masCaro.proveedorId);

              return (
                <Card key={producto.id} className="shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-500" />
                      {producto.nombre}
                    </CardTitle>
                    <p className="text-sm text-gray-500">{producto.categoria}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <div>
                        <p className="text-xs text-green-600 font-medium">MEJOR PRECIO</p>
                        <p className="font-semibold text-green-700">{proveedorBarato?.nombre}</p>
                      </div>
                      <p className="text-xl font-bold text-green-700">
                        {formatCurrency(comparacion.masBarato.precioCosto)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="text-xs text-red-600 font-medium">PRECIO MÁS ALTO</p>
                        <p className="font-semibold text-red-700">{proveedorCaro?.nombre}</p>
                      </div>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(comparacion.masCaro.precioCosto)}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 rounded-lg">
                      <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-700 font-medium">
                        Diferencia: {formatCurrency(comparacion.diferencia)} ({comparacion.porcentaje.toFixed(1)}%)
                      </span>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                      Comparando {comparacion.totalProveedores} proveedores
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            {productos.filter(p => (preciosPorProducto[p.id] || []).length >= 2).length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <ArrowRightLeft className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No hay productos con múltiples proveedores</p>
                <p className="text-sm">Agrega precios de diferentes proveedores para ver comparaciones</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab Historial */}
        <TabsContent value="historial" className="mt-6">
          <div className="space-y-4">
            {/* Filtro por producto */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    className="flex-1 p-2 rounded-md border bg-background text-sm"
                    value={filtroProductoHistorial}
                    onChange={(e) => setFiltroProductoHistorial(e.target.value)}
                  >
                    <option value="todos">Todos los productos</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* KPIs del historial */}
            {(() => {
              const historialFiltrado = filtroProductoHistorial === 'todos'
                ? historial
                : historial.filter(h => h.productoId === filtroProductoHistorial);

              const subidas = historialFiltrado.filter(h => h.precioNuevo > h.precioAnterior);
              const bajadas = historialFiltrado.filter(h => h.precioNuevo < h.precioAnterior);
              const promedioSubida = subidas.length > 0
                ? subidas.reduce((sum, h) => sum + ((h.precioNuevo - h.precioAnterior) / h.precioAnterior * 100), 0) / subidas.length
                : 0;

              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Total Cambios</p>
                      <p className="text-2xl font-bold">{historialFiltrado.length}</p>
                    </Card>
                    <Card className="p-4 text-center border-red-200 bg-red-50/50">
                      <p className="text-xs text-muted-foreground">Subidas</p>
                      <p className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                        <TrendingUp className="w-4 h-4" /> {subidas.length}
                      </p>
                    </Card>
                    <Card className="p-4 text-center border-emerald-200 bg-emerald-50/50">
                      <p className="text-xs text-muted-foreground">Bajadas</p>
                      <p className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
                        <TrendingDown className="w-4 h-4" /> {bajadas.length}
                      </p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Promedio Subida</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {promedioSubida.toFixed(1)}%
                      </p>
                    </Card>
                  </div>

                  {/* Timeline */}
                  {historialFiltrado.length === 0 ? (
                    <Card className="p-12">
                      <div className="text-center text-muted-foreground">
                        <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Sin historial de cambios</p>
                        <p className="text-sm">Los cambios de precio se registrarán automáticamente aquí</p>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="w-4 h-4" /> Línea de Tiempo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          {/* Línea vertical de timeline */}
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                          <div className="space-y-4">
                            {[...historialFiltrado]
                              .sort((a, b) => new Date(b.fechaCambio).getTime() - new Date(a.fechaCambio).getTime())
                              .slice(0, 50)
                              .map((entry) => {
                                const diff = entry.precioNuevo - entry.precioAnterior;
                                const pctChange = (diff / entry.precioAnterior) * 100;
                                const isSubida = diff > 0;
                                const producto = getProductoById(entry.productoId);
                                const proveedor = getProveedorById(entry.proveedorId);

                                return (
                                  <div key={entry.id} className="relative pl-10">
                                    {/* Dot del timeline */}
                                    <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-background ${isSubida ? 'bg-red-500' : 'bg-emerald-500'
                                      }`} />

                                    <div className={`p-4 rounded-lg border transition-colors hover:shadow-sm ${isSubida ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'
                                      }`}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-sm truncate">
                                            {producto?.nombre || 'Producto Desconocido'}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {proveedor?.nombre || 'Proveedor'} • {new Date(entry.fechaCambio).toLocaleString('es-ES', {
                                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                          </p>
                                          <div className="flex items-center gap-2 mt-2">
                                            <span className="text-sm text-muted-foreground line-through">
                                              {formatCurrency(entry.precioAnterior)}
                                            </span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="text-sm font-bold">
                                              {formatCurrency(entry.precioNuevo)}
                                            </span>
                                          </div>
                                        </div>
                                        <Badge variant={isSubida ? 'destructive' : 'default'} className={`shrink-0 gap-1 ${!isSubida ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''
                                          }`}>
                                          {isSubida ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                          {isSubida ? '+' : ''}{pctChange.toFixed(1)}%
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Precios;
