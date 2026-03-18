import { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  Package,
  Download,
  Plus,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Producto } from '@/types';

interface ListaPreciosProvincialProps {
  productos?: Producto[];
  inventario?: any[];
  categorias?: (string | { id: string; nombre: string; color?: string })[];
  formatCurrency?: (value: number) => string;
  onAddProducto?: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function ListaPreciosProvincial({
  productos = [],
  inventario = [],
  categorias = [],
  formatCurrency = (v: number) => '$' + v.toLocaleString('es-ES'),
  onAddProducto
}: ListaPreciosProvincialProps) {
  // Extraer nombres de categorías (puede ser string o {nombre})
  const categoriasArray = Array.isArray(categorias) 
    ? categorias.map(c => typeof c === 'string' ? c : c.nombre)
    : [];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProducto, setNewProducto] = useState({
    nombre: '',
    categoria: categoriasArray[0] || '',
    descripcion: '',
    precioVenta: 0,
    precioCompra: 0,
    margenUtilidad: 30,
    tipo: 'elaborado' as const,
  });
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla');

  // Mapear stock a productos
  const productosConStock = useMemo(() => {
    const inventarioMap = new Map(
      (inventario || []).map((inv: any) => [inv.producto_id, inv.stock_actual])
    );
    return (productos || []).map(p => ({
      ...p,
      stock: inventarioMap.get(p.id) || 0,
    }));
  }, [productos, inventario]);

  // Filtrar productos
  const filteredProductos = useMemo(() => {
    return productosConStock.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [productosConStock, searchTerm, selectedCategory]);

  const categoriasUnicas = useMemo(() => {
    return ['Todos', ...Array.from(new Set(productosConStock.map(p => p.categoria)))];
  }, [productosConStock]);

  const totalProductos = filteredProductos.length;
  const valorInventario = filteredProductos.reduce((sum, p) => sum + (p.precioVenta * (p.stock || 0)), 0);
  const promedioPrecio = filteredProductos.length > 0 
    ? filteredProductos.reduce((sum, p) => sum + p.precioVenta, 0) / filteredProductos.length 
    : 0;

  const exportarCSV = () => {
    const headers = ['Producto', 'Categoría', 'Descripción', 'Precio Venta', 'Stock', 'Margen'];
    const csv = [
      headers.join(','),
      ...filteredProductos.map(p => 
        `"${p.nombre}","${p.categoria}","${p.descripcion || ''}",${p.precioVenta},${p.stock || 0},${p.margenUtilidad}%`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-precios-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Lista de precios exportada');
  };

  const handleCrearProducto = () => {
    if (!newProducto.nombre.trim()) {
      toast.error('El nombre del producto es requerido');
      return;
    }
    if (newProducto.precioVenta <= 0) {
      toast.error('El precio de venta debe ser mayor a 0');
      return;
    }

    if (onAddProducto) {
      onAddProducto({
        ...newProducto,
        precioVenta: Number(newProducto.precioVenta),
        precioCompra: Number(newProducto.precioCompra),
        margenUtilidad: Number(newProducto.margenUtilidad),
      });
      toast.success('Producto creado correctamente');
      setIsModalOpen(false);
      setNewProducto({
        nombre: '',
        categoria: categorias[0] || '',
        descripcion: '',
        precioVenta: 0,
        precioCompra: 0,
        margenUtilidad: 30,
        tipo: 'elaborado' as const,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-8 h-8" />
            Lista de Precios Provincial
          </h1>
          <p className="text-gray-500 mt-1">Consulta rápida de precios de venta y características</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Crear Producto
          </Button>
          <Button 
            onClick={exportarCSV}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProductos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Precio Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(promedioPrecio)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Stock Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(valorInventario)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Margen Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredProductos.length > 0 
                ? (filteredProductos.reduce((sum, p) => sum + p.margenUtilidad, 0) / filteredProductos.length).toFixed(1)
                : '0'}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Busca producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Categorías
            </label>
            <div className="flex flex-wrap gap-2">
              {categoriasUnicas.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === (cat === 'Todos' ? null : cat) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat === 'Todos' ? null : cat)}
                  className="rounded-full"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm font-medium">Vista:</span>
            <Button
              size="sm"
              variant={viewMode === 'tabla' ? 'default' : 'outline'}
              onClick={() => setViewMode('tabla')}
            >
              Tabla
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'tarjetas' ? 'default' : 'outline'}
              onClick={() => setViewMode('tarjetas')}
            >
              Tarjetas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {filteredProductos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay productos</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'tabla' && (
            <Card>
              <CardHeader>
                <CardTitle>{totalProductos} Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProductos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.categoria}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs text-gray-600 dark:text-gray-400">
                            {p.descripcion || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(p.precioVenta)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge>{p.stock || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{p.margenUtilidad}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {viewMode === 'tarjetas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProductos.map((p) => (
                <Card key={p.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{p.nombre}</CardTitle>
                        <CardDescription>{p.categoria}</CardDescription>
                      </div>
                      <Badge>{p.stock || 0}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-gray-600">{p.descripcion || 'Sin descripción'}</p>
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Precio:</span>
                        <span className="font-bold text-green-600">{formatCurrency(p.precioVenta)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Margen:</span>
                        <Badge>{p.margenUtilidad}%</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Crear Producto */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Producto</DialogTitle>
            <DialogDescription>
              Agrega un nuevo producto a la lista de precios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="text-sm font-medium">Nombre del Producto *</label>
              <Input
                placeholder="Ej: Pan Integral"
                value={newProducto.nombre}
                onChange={(e) => setNewProducto({ ...newProducto, nombre: e.target.value })}
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="text-sm font-medium">Categoría</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={newProducto.categoria}
                onChange={(e) => setNewProducto({ ...newProducto, categoria: e.target.value })}
              >
                {categoriasArray.length > 0 ? (
                  categoriasArray.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))
                ) : (
                  <option value="">Sin categorías</option>
                )}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                placeholder="Especificaciones del producto"
                value={newProducto.descripcion}
                onChange={(e) => setNewProducto({ ...newProducto, descripcion: e.target.value })}
              />
            </div>

            {/* Precio Compra */}
            <div>
              <label className="text-sm font-medium">Precio de Compra</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newProducto.precioCompra || ''}
                onChange={(e) => setNewProducto({ ...newProducto, precioCompra: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Precio Venta */}
            <div>
              <label className="text-sm font-medium">Precio de Venta *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={newProducto.precioVenta || ''}
                onChange={(e) => setNewProducto({ ...newProducto, precioVenta: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Margen Utilidad */}
            <div>
              <label className="text-sm font-medium">Margen de Utilidad (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="30"
                value={newProducto.margenUtilidad || ''}
                onChange={(e) => setNewProducto({ ...newProducto, margenUtilidad: parseFloat(e.target.value) || 30 })}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCrearProducto}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Crear Producto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
