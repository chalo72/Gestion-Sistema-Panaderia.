import { useState } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  TrendingUp,
  Store,
  Tag,
  Palette,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Producto, Proveedor, PrecioProveedor, Categoria } from '@/types';
// Importar nuevos componentes Antigravity
import { ProductVariantEditor } from '@/components/ProductVariantEditor';
import { PaymentProcessor } from '@/components/PaymentProcessor';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { CategoryBrowser } from '@/components/CategoryBrowser';

interface ProductosProps {
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  categorias: Categoria[];
  onAddProducto: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
  onUpdateProducto: (id: string, updates: Partial<Producto>) => void;
  onDeleteProducto: (id: string) => void;
  onAddCategoria: (nombre: string, color: string) => Promise<Categoria>;
  onDeleteCategoria: (id: string) => void;
  onAddOrUpdatePrecio: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string }) => void;
  onDeletePrecio: (id: string) => void;
  getMejorPrecio: (productoId: string) => PrecioProveedor | null;
  getPreciosByProducto: (productoId: string) => PrecioProveedor[];
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

const COLORES_PRESET = [
  '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#6b7280',
  '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#1e293b',
  '#06b6d4', '#84cc16', '#d946ef', '#6366f1', '#10b981',
];

export function Productos({
  productos,
  proveedores,
  categorias,
  onAddProducto,
  onUpdateProducto,
  onDeleteProducto,
  onAddCategoria,
  onDeleteCategoria,
  onAddOrUpdatePrecio,
  onDeletePrecio,
  getMejorPrecio,
  getPreciosByProducto,
  getProveedorById,
  formatCurrency,
}: ProductosProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [expandedProducto, setExpandedProducto] = useState<string | null>(null);
  const { check } = useCan();

  // Estados para agregar precio - específicos por producto
  const [addingPrecioForProducto, setAddingPrecioForProducto] = useState<string | null>(null);
  const [selectedProveedorId, setSelectedProveedorId] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [notasPrecio, setNotasPrecio] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    precioVenta: '',
    margenUtilidad: '30',
    proveedorId: '',
    precioCosto: '',
    notasPrecio: '',
    imagen: '',
  });

  const [nuevaCategoria, setNuevaCategoria] = useState({
    nombre: '',
    color: COLORES_PRESET[0],
  });

  const filteredProductos = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.categoria) {
      toast.error('Nombre y categoría son obligatorios');
      return;
    }

    // Calcular precio de venta automáticamente si hay precio de costo
    let precioVenta = parseFloat(formData.precioVenta) || 0;
    const margen = parseFloat(formData.margenUtilidad) || 30;
    const costo = parseFloat(formData.precioCosto) || 0;

    if (costo > 0 && precioVenta === 0) {
      precioVenta = costo * (1 + margen / 100);
    }

    const data = {
      nombre: formData.nombre,
      categoria: formData.categoria,
      descripcion: formData.descripcion,
      precioVenta: precioVenta,
      margenUtilidad: margen,
      imagen: formData.imagen,
    };

    if (editingProducto) {
      onUpdateProducto(editingProducto.id, data);
      // Si hay proveedor y precio de costo, agregarlo
      if (formData.proveedorId && formData.precioCosto) {
        onAddOrUpdatePrecio({
          productoId: editingProducto.id,
          proveedorId: formData.proveedorId,
          precioCosto: parseFloat(formData.precioCosto),
          notas: formData.notasPrecio,
        });
      }
      toast.success('Producto actualizado correctamente');
    } else {
      const nuevoProducto = await onAddProducto(data);
      // Si hay proveedor y precio de costo, agregarlo
      if (formData.proveedorId && formData.precioCosto) {
        onAddOrUpdatePrecio({
          productoId: nuevoProducto.id,
          proveedorId: formData.proveedorId,
          precioCosto: parseFloat(formData.precioCosto),
          notas: formData.notasPrecio,
        });
      }
      toast.success('Producto creado correctamente');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleAddCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoria.nombre) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }
    onAddCategoria(nuevaCategoria.nombre, nuevaCategoria.color);
    toast.success('Categoría agregada correctamente');
    setNuevaCategoria({ nombre: '', color: COLORES_PRESET[0] });
    setIsCategoriaDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      categoria: '',
      descripcion: '',
      precioVenta: '',
      margenUtilidad: '30',
      proveedorId: '',
      precioCosto: '',
      notasPrecio: '',
      imagen: '',
    });
    setEditingProducto(null);
  };

  const handleEdit = (producto: Producto) => {
    setEditingProducto(producto);
    const mejorPrecio = getMejorPrecio(producto.id);
    setFormData({
      nombre: producto.nombre,
      categoria: producto.categoria,
      descripcion: producto.descripcion || '',
      precioVenta: producto.precioVenta.toString(),
      margenUtilidad: producto.margenUtilidad.toString(),
      imagen: producto.imagen || '',
      proveedorId: mejorPrecio?.proveedorId || '',
      precioCosto: mejorPrecio?.precioCosto.toString() || '',
      notasPrecio: mejorPrecio?.notas || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      onDeleteProducto(id);
      toast.success('Producto eliminado correctamente');
    }
  };

  const handleAgregarPrecio = (productoId: string) => {
    if (!selectedProveedorId || !precioCosto) {
      toast.error('Selecciona un proveedor y un precio');
      return;
    }

    onAddOrUpdatePrecio({
      productoId,
      proveedorId: selectedProveedorId,
      precioCosto: parseFloat(precioCosto),
      notas: notasPrecio,
    });

    toast.success('Precio agregado correctamente');
    setAddingPrecioForProducto(null);
    setSelectedProveedorId('');
    setPrecioCosto('');
    setNotasPrecio('');
  };

  const handleEliminarPrecio = (precioId: string) => {
    if (confirm('¿Eliminar este precio?')) {
      onDeletePrecio(precioId);
      toast.success('Precio eliminado');
    }
  };

  const calcularUtilidad = (precioVenta: number, precioCosto: number) => {
    if (precioCosto === 0) return 0;
    return ((precioVenta - precioCosto) / precioCosto) * 100;
  };

  const getCategoriaColor = (nombreCategoria: string) => {
    const categoria = categorias.find(c => c.nombre === nombreCategoria);
    return categoria?.color || '#6b7280';
  };

  // Obtener proveedores que NO tienen precio para este producto
  const getProveedoresSinPrecio = (productoId: string) => {
    const preciosProducto = getPreciosByProducto(productoId);
    const proveedoresConPrecio = preciosProducto.map(p => p.proveedorId);
    return proveedores.filter(p => !proveedoresConPrecio.includes(p.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Productos</h2>
          <p className="text-gray-500 mt-1">Gestiona tu catálogo y precios de proveedores</p>
        </div>
        <div className="flex gap-2">
          {check('CREAR_PRODUCTOS') && (
            <Dialog open={isCategoriaDialogOpen} onOpenChange={setIsCategoriaDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Tag className="w-4 h-4 mr-2" />
                  Categorías
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Gestionar Categorías</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="lista" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="lista">Categorías</TabsTrigger>
                    <TabsTrigger value="nueva">Nueva Categoría</TabsTrigger>
                  </TabsList>

                  <TabsContent value="lista" className="mt-4">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {categorias.map((categoria) => (
                        <div
                          key={categoria.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: categoria.color }}
                            />
                            <span>{categoria.nombre}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`¿Eliminar categoría "${categoria.nombre}"?`)) {
                                onDeleteCategoria(categoria.id);
                                toast.success('Categoría eliminada');
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="nueva" className="mt-4">
                    <form onSubmit={handleAddCategoria} className="space-y-4">
                      <div>
                        <Label htmlFor="nombreCategoria">Nombre de la Categoría</Label>
                        <Input
                          id="nombreCategoria"
                          value={nuevaCategoria.nombre}
                          onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
                          placeholder="Ej: Jardinería"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Color
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {COLORES_PRESET.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNuevaCategoria({ ...nuevaCategoria, color })}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${nuevaCategoria.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                                }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      <Button type="submit" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Categoría
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}

          {check('CREAR_PRODUCTOS') && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingProducto ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Nombre del producto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((categoria) => (
                          <SelectItem key={categoria.id} value={categoria.nombre}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: categoria.color }}
                              />
                              {categoria.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Descripción opcional"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="precioVenta">Precio de Venta (€)</Label>
                      <Input
                        id="precioVenta"
                        type="number"
                        step="0.01"
                        value={formData.precioVenta}
                        onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Déjalo en 0 para calcular automáticamente
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="margenUtilidad">Margen de Utilidad (%)</Label>
                      <Input
                        id="margenUtilidad"
                        type="number"
                        value={formData.margenUtilidad}
                        onChange={(e) => setFormData({ ...formData, margenUtilidad: e.target.value })}
                        placeholder="30"
                      />
                    </div>
                  </div>

                  {/* Sección de Precio de Costo */}
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-semibold text-blue-600 flex items-center gap-2 mb-3">
                      <Store className="w-4 h-4" />
                      Precio de Costo (Opcional)
                    </Label>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label htmlFor="proveedorId">Proveedor</Label>
                        <Select
                          value={formData.proveedorId}
                          onValueChange={(value) => setFormData({ ...formData, proveedorId: value })}
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
                        <Label htmlFor="precioCosto">Precio de Costo (€)</Label>
                        <Input
                          id="precioCosto"
                          type="number"
                          step="0.01"
                          value={formData.precioCosto}
                          onChange={(e) => setFormData({ ...formData, precioCosto: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notasPrecio">Notas (opcional)</Label>
                      <Input
                        id="notasPrecio"
                        value={formData.notasPrecio}
                        onChange={(e) => setFormData({ ...formData, notasPrecio: e.target.value })}
                        placeholder="Ej: Precio especial, descuento por volumen..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="imagen" className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        URL de Imagen (opcional)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="imagen"
                          value={formData.imagen}
                          onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                          placeholder="https://ejemplo.com/imagen.jpg"
                        />
                        {formData.imagen && (
                          <div className="w-10 h-10 rounded border overflow-hidden shrink-0">
                            <img src={formData.imagen} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          </div>
                        )}
                      </div>
                    </div>
                    {formData.precioCosto && formData.margenUtilidad && !formData.precioVenta && (
                      <p className="text-sm text-green-600 mt-2">
                        Precio de venta calculado: {formatCurrency(parseFloat(formData.precioCosto) * (1 + parseFloat(formData.margenUtilidad) / 100))}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingProducto ? 'Actualizar' : 'Crear'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredProductos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay productos registrados</p>
              <p className="text-sm">Haz clic en "Nuevo Producto" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProductos.map((producto) => {
                const mejorPrecio = getMejorPrecio(producto.id);
                const preciosProducto = getPreciosByProducto(producto.id);
                const utilidad = mejorPrecio ? calcularUtilidad(producto.precioVenta, mejorPrecio.precioCosto) : 0;
                const categoriaColor = getCategoriaColor(producto.categoria);
                const isExpanded = expandedProducto === producto.id;
                const isAddingPrecio = addingPrecioForProducto === producto.id;
                const proveedoresDisponibles = getProveedoresSinPrecio(producto.id);

                return (
                  <div key={producto.id} className="border rounded-lg overflow-hidden">
                    {/* Fila principal del producto */}
                    <div
                      className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => setExpandedProducto(isExpanded ? null : producto.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            {producto.imagen ? (
                              <img src={producto.imagen} alt={producto.nombre} className="w-10 h-10 rounded object-cover border" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center border border-blue-200">
                                <Package className="w-5 h-5 text-blue-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{producto.nombre}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: `${categoriaColor}20`,
                                  color: categoriaColor,
                                  borderColor: categoriaColor,
                                  borderWidth: '1px'
                                }}
                              >
                                {producto.categoria}
                              </Badge>
                              {producto.descripcion && (
                                <span className="text-sm text-gray-500">{producto.descripcion}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Precio de Venta */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Precio Venta</p>
                            <p className="font-bold text-emerald-600 text-lg">
                              {formatCurrency(producto.precioVenta)}
                            </p>
                          </div>

                          {/* Mejor Costo */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Mejor Costo</p>
                            {mejorPrecio ? (
                              <p className="font-semibold text-blue-600">
                                {formatCurrency(mejorPrecio.precioCosto)}
                              </p>
                            ) : (
                              <p className="text-gray-400 text-sm">Sin precio</p>
                            )}
                          </div>

                          {/* Utilidad */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Utilidad</p>
                            {mejorPrecio ? (
                              <div className="flex items-center gap-1 justify-end">
                                <TrendingUp className="w-4 h-4 text-purple-500" />
                                <span className={`font-medium ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {utilidad.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>

                          {/* Proveedores */}
                          <div className="text-right min-w-[80px]">
                            <p className="text-xs text-gray-500">Proveedores</p>
                            <div className="flex items-center gap-1 justify-end">
                              <Store className="w-4 h-4 text-gray-400" />
                              <span>{preciosProducto.length}</span>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2">
                            {check('EDITAR_PRODUCTOS') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(producto);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {check('ELIMINAR_PRODUCTOS') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(producto.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Panel expandible con precios */}
                    {isExpanded && (
                      <div className="p-4 bg-white border-t">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Store className="w-4 h-4" />
                            Precios por Proveedor
                          </h4>
                          {proveedoresDisponibles.length > 0 && !isAddingPrecio && check('EDITAR_PRECIOS') && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingPrecioForProducto(producto.id);
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Agregar Precio
                            </Button>
                          )}
                        </div>

                        {/* Formulario para agregar precio */}
                        {isAddingPrecio && (
                          <div className="bg-gray-50 p-4 rounded-lg mb-4">
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <Label className="text-sm">Proveedor</Label>
                                <select
                                  className="w-full p-2 border rounded-lg mt-1"
                                  value={selectedProveedorId}
                                  onChange={(e) => setSelectedProveedorId(e.target.value)}
                                >
                                  <option value="">Seleccionar...</option>
                                  {proveedoresDisponibles.map((p) => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-32">
                                <Label className="text-sm">Precio Costo (€)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={precioCosto}
                                  onChange={(e) => setPrecioCosto(e.target.value)}
                                  placeholder="0.00"
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-sm">Notas (opcional)</Label>
                                <Input
                                  value={notasPrecio}
                                  onChange={(e) => setNotasPrecio(e.target.value)}
                                  placeholder="Ej: Precio especial"
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAddingPrecioForProducto(null);
                                    setSelectedProveedorId('');
                                    setPrecioCosto('');
                                    setNotasPrecio('');
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAgregarPrecio(producto.id)}
                                  disabled={!selectedProveedorId || !precioCosto}
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tabla de precios */}
                        {preciosProducto.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">
                            No hay precios registrados. Agrega precios de tus proveedores.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Proveedor</TableHead>
                                  <TableHead>Precio Costo</TableHead>
                                  <TableHead>Utilidad</TableHead>
                                  <TableHead>Notas</TableHead>
                                  <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {preciosProducto.map((precio) => {
                                  const proveedor = getProveedorById(precio.proveedorId);
                                  const utilidadPrecio = calcularUtilidad(producto.precioVenta, precio.precioCosto);
                                  const esMejor = mejorPrecio?.id === precio.id;

                                  return (
                                    <TableRow key={precio.id}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Store className="w-4 h-4 text-gray-400" />
                                          <span className="font-medium">{proveedor?.nombre}</span>
                                          {esMejor && (
                                            <Badge className="bg-green-500 text-white text-xs">MEJOR</Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <span className="font-semibold text-blue-600">
                                          {formatCurrency(precio.precioCosto)}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <span className={`font-medium ${utilidadPrecio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {utilidadPrecio.toFixed(1)}%
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm text-gray-500">{precio.notas || '-'}</span>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEliminarPrecio(precio.id)}
                                        >
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )
                    }
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🎆 NUEVA SECCIÓN: FEATURES ANTIGRAVITY */}
      <Card className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-2xl shadow-lg">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">✨ Features Antigravity</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Variantes, Pagos, Categorías Premium y más</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="variantes" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="variantes" className="gap-2">
                <Palette className="w-4 h-4" />
                Variantes
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Pagos
              </TabsTrigger>
              <TabsTrigger value="categorias" className="gap-2">
                <Tag className="w-4 h-4" />
                Categorías
              </TabsTrigger>
              <TabsTrigger value="finanzas" className="gap-2">
                <Package className="w-4 h-4" />
                Finanzas
              </TabsTrigger>
            </TabsList>

            {/* Tab: Variantes */}
            <TabsContent value="variantes" className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-700/30">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <strong>📸 Variantes de Productos:</strong> Crea tallas, colores, combos y variantes personalizadas con SKU único, precios diferenciales y múltiples fotos.
                </p>
              </div>
              <ProductVariantEditor />
            </TabsContent>

            {/* Tab: Pagos */}
            <TabsContent value="pagos" className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-700/30">
                <p className="text-sm text-green-600 dark:text-green-400">
                  <strong>💳 Sistema de Pagos Inteligente:</strong> Efectivo, tarjeta, transferencia, E-Wallet y crédito. Manejo completo de carteras digitales y deudas.
                </p>
              </div>
              <PaymentProcessor />
            </TabsContent>

            {/* Tab: Categorías */}
            <TabsContent value="categorias" className="space-y-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-700/30">
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  <strong>🎨 Navegador de Categorías:</strong> Estructura jerárquica de categorías y subcategorías con fácil reordenamiento y edición.
                </p>
              </div>
              <CategoryBrowser isEditable={true} />
            </TabsContent>

            {/* Tab: Finanzas */}
            <TabsContent value="finanzas" className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-700/30">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  <strong>📊 Dashboard Financiero:</strong> KPI en tiempo real: ventas, ingresos, órdenes activas, crédito pendiente y ticket promedio.
                </p>
              </div>
              <FinancialDashboard />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>    </div>
  );
}

export default Productos;