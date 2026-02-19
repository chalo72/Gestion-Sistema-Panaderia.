import { useState } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Package,
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,

  MoreVertical,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';

interface ProveedoresProps {
  proveedores: Proveedor[];
  productos: Producto[];
  precios: PrecioProveedor[];
  onAddProveedor: (proveedor: Omit<Proveedor, 'id' | 'createdAt'>) => Promise<Proveedor>;
  onUpdateProveedor: (id: string, updates: Partial<Proveedor>) => void;
  onDeleteProveedor: (id: string) => void;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
}

export function Proveedores({
  proveedores,
  productos: _productos,
  precios: _precios,
  onAddProveedor,
  onUpdateProveedor,
  onDeleteProveedor,
  getPreciosByProveedor,
  getProductoById,
  formatCurrency,
}: ProveedoresProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { check } = useCan();
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [viewingProveedor, setViewingProveedor] = useState<Proveedor | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    imagen: '',
    calificacion: 5,
  });

  const filteredProveedores = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.contacto && p.contacto.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const data = {
      nombre: formData.nombre,
      contacto: formData.contacto,
      telefono: formData.telefono,
      email: formData.email,
      direccion: formData.direccion,
      imagen: formData.imagen,
      calificacion: formData.calificacion,
    };

    if (editingProveedor) {
      onUpdateProveedor(editingProveedor.id, data);
      toast.success('Proveedor actualizado correctamente');
    } else {
      onAddProveedor(data);
      toast.success('Proveedor creado correctamente');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
      imagen: '',
      calificacion: 5,
    });
    setEditingProveedor(null);
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setFormData({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      imagen: proveedor.imagen || '',
      calificacion: proveedor.calificacion || 5,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este proveedor? Se eliminarán también todos sus precios asociados.')) {
      onDeleteProveedor(id);
      toast.success('Proveedor eliminado correctamente');
    }
  };

  return (
    <div className="space-y-6 animate-ag-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Proveedores</h2>
          <p className="text-muted-foreground mt-1">Directorio y gestión de aliados comerciales</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {check('CREAR_PROVEEDORES') && (
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="shrink-0 bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Nuevo Proveedor</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre de Empresa *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Distribuidora Central S.A."
                  />
                </div>
                <div>
                  <Label htmlFor="contacto">Persona de Contacto</Label>
                  <Input
                    id="contacto"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono">Teléfono / WhatsApp</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+XX XXX XXX XXX"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contacto@ejemplo.com"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="direccion">Dirección Física</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Calle Principal #123, Ciudad"
                  />
                </div>
                <div>
                  <Label htmlFor="imagen" className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    URL de Logo (Opcional)
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      id="imagen"
                      value={formData.imagen}
                      onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                      placeholder="https://..."
                    />
                    {formData.imagen && (
                      <div className="w-10 h-10 rounded-full border overflow-hidden shrink-0 bg-white">
                        <img src={formData.imagen} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Confiabilidad / Calificación</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, calificacion: star })}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${star <= (formData.calificacion || 5)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground/30'
                            }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground font-medium">
                      {(formData.calificacion || 5) === 5 ? 'Excelente' :
                        (formData.calificacion || 5) >= 4 ? 'Muy Bueno' :
                          (formData.calificacion || 5) >= 3 ? 'Bueno' :
                            (formData.calificacion || 5) >= 2 ? 'Regular' : 'Malo'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProveedor ? 'Guardar Cambios' : 'Crear Proveedor'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredProveedores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-lg font-medium">No se encontraron proveedores</p>
            <p className="text-sm">Intenta con otro término o agrega uno nuevo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProveedores.map((proveedor) => {
            const preciosProveedor = getPreciosByProveedor(proveedor.id);
            return (
              <Card key={proveedor.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {proveedor.imagen ? (
                        <img src={proveedor.imagen} alt={proveedor.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold border-2 border-background">
                          {proveedor.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-base leading-tight line-clamp-1" title={proveedor.nombre}>{proveedor.nombre}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="w-3 h-3" /> {preciosProveedor.length} productos
                      </p>
                      <div className="flex items-center gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3 h-3 ${s <= (proveedor.calificacion || 5) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingProveedor(proveedor)}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Ver Detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(proveedor)}>
                        <Edit2 className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDelete(proveedor.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="pt-4 pb-2 text-sm space-y-2.5">
                  {proveedor.contacto && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-6 flex justify-center"><Badge variant="outline" className="text-[10px] h-5 px-1">C</Badge></div>
                      <span className="truncate">{proveedor.contacto}</span>
                    </div>
                  )}
                  {proveedor.telefono && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-6 flex justify-center"><Phone className="w-3.5 h-3.5" /></div>
                      <span className="truncate font-mono text-xs">{proveedor.telefono}</span>
                    </div>
                  )}
                  {proveedor.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-6 flex justify-center"><Mail className="w-3.5 h-3.5" /></div>
                      <span className="truncate text-xs">{proveedor.email}</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 pb-4 px-4 flex gap-2">
                  {proveedor.telefono && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                      onClick={() => window.open(`https://wa.me/${proveedor.telefono.replace(/\D/g, '')}`, '_blank')}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                    </Button>
                  )}
                  {proveedor.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => window.location.href = `mailto:${proveedor.email}`}
                    >
                      <Mail className="w-3.5 h-3.5 mr-1.5" /> Email
                    </Button>
                  )}
                  {!proveedor.telefono && !proveedor.email && (
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" disabled>
                      Sin contacto directo
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog para ver detalles del proveedor */}
      <Dialog open={!!viewingProveedor} onOpenChange={() => setViewingProveedor(null)}>
        <DialogContent className="max-w-2xl">
          {viewingProveedor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  {viewingProveedor.imagen ? (
                    <img src={viewingProveedor.imagen} alt={viewingProveedor.nombre} className="w-12 h-12 rounded-full object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border">
                      {viewingProveedor.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold">{viewingProveedor.nombre}</h3>
                    <p className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {viewingProveedor.direccion || 'Ubicación no registrada'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= (viewingProveedor.calificacion || 5) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({(viewingProveedor.calificacion || 5).toFixed(1)} / 5.0)
                      </span>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {/* Sidebar Info */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 space-y-3 text-sm">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4 mr-2" /> {viewingProveedor.telefono || 'Sin teléfono'}
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Persona</p>
                        <p className="font-medium">{viewingProveedor.contacto || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Teléfono</p>
                        <p className="font-medium font-mono">{viewingProveedor.telefono || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium truncate" title={viewingProveedor.email}>{viewingProveedor.email || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content: Products */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4" /> Catálogo de Productos
                    </h4>
                    <Badge variant="secondary">{getPreciosByProveedor(viewingProveedor.id).length} items</Badge>
                  </div>

                  {getPreciosByProveedor(viewingProveedor.id).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No hay productos asociados.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {getPreciosByProveedor(viewingProveedor.id).map((precio) => {
                        const producto = getProductoById(precio.productoId);
                        if (!producto) return null;
                        // Simple margen estimation
                        const margen = ((producto.precioVenta - precio.precioCosto) / precio.precioCosto) * 100;

                        return (
                          <div key={precio.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="font-medium truncate">{producto.nombre}</p>
                              <p className="text-xs text-muted-foreground">{producto.categoria}</p>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <p className="font-bold text-foreground">{formatCurrency(precio.precioCosto)}</p>
                              <Badge variant={margen > 30 ? 'default' : margen > 15 ? 'secondary' : 'destructive'} className="text-[10px] h-5 mt-1">
                                {margen.toFixed(0)}% mg.
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Proveedores;
