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
  MessageCircle,
  Star,
  ExternalLink,
  Building2,
  X,
  UserCheck,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
    <div className="space-y-8 h-full flex flex-col animate-ag-fade-in p-2 md:p-6 bg-slate-50/50 dark:bg-black/20 rounded-[3rem]">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 p-8 glass-card rounded-[2.5rem] bg-blue-50/30 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
              Aliados <span className="text-blue-600 dark:text-blue-400">Estratégicos</span>
            </h1>
            <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">Gestión de cadena de suministro Dulce Placer</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
            <Input
              placeholder="Buscar proveedor por nombre o contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 h-14 bg-white/60 dark:bg-gray-950/40 border-none rounded-2xl shadow-inner text-sm font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {check('CREAR_PROVEEDORES') && (
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] shadow-xl shadow-blue-500/20 gap-3 font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 border-none">
                  <Plus className="w-5 h-5" />
                  Registrar Aliado
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
              <div className="bg-blue-600 p-8 text-white relative">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    {editingProveedor ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                      {editingProveedor ? 'Actualizar Aliado' : 'Nuevo Registro'}
                    </DialogTitle>
                    <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                      Información corporativa del proveedor
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-6 top-6 text-white/40 hover:text-white"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre de la Empresa *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej. Comercializadora Global S.A.S."
                      className="h-16 text-xl font-black rounded-2xl bg-slate-50 dark:bg-gray-800 border-none shadow-inner px-6"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Representante</Label>
                    <Input
                      id="contacto"
                      value={formData.contacto}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                      placeholder="Nombre completo"
                      className="h-14 font-bold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Calificación Inicial</Label>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 h-14 px-6 rounded-2xl shadow-inner">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, calificacion: star })}
                          className="hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-6 h-6 ${star <= (formData.calificacion || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">WhatsApp / Celular</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+57 300 000 0000"
                      className="h-14 font-mono text-sm bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Correo Corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="aliado@empresa.com"
                      className="h-14 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                    />
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede Principal</Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Dirección física completa"
                      className="h-14 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                    />
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Identidad Visual (URL Logo)</Label>
                    <div className="flex gap-4">
                      <Input
                        id="imagen"
                        value={formData.imagen}
                        onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                        placeholder="https://..."
                        className="h-14 flex-1 bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                      />
                      {formData.imagen && (
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 bg-white shadow-lg shrink-0">
                          <img src={formData.imagen} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <Button type="button" variant="ghost" className="h-16 flex-1 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] opacity-50" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="h-16 flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-600/30 border-none">
                    {editingProveedor ? 'Actualizar Aliado' : 'Crear Aliado'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-400/5 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Proveedores Grid */}
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
        {filteredProveedores.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-40 opacity-30 text-center">
            <Building2 className="w-32 h-32 mb-8 text-blue-500 animate-ag-float" />
            <h3 className="text-2xl font-black uppercase tracking-[0.3em]">Directorio Vacío</h3>
            <p className="max-w-xs text-[10px] font-bold uppercase tracking-widest mt-4">Comienza registrando a tus proveedores para optimizar la cadena de precios.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-10">
            {filteredProveedores.map((proveedor, index) => {
              const preciosProveedor = getPreciosByProveedor(proveedor.id);
              return (
                <Card
                  key={proveedor.id}
                  className="group relative overflow-hidden border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-3 cursor-pointer border border-white/20 dark:border-gray-800/30"
                  onClick={() => setViewingProveedor(proveedor)}
                >
                  <div className="absolute top-0 right-0 p-6 z-10">
                    <div className="flex items-center gap-1.5 bg-white/60 dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/40 text-[10px] font-black text-amber-500 shadow-xl">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      {proveedor.calificacion || 5.0}
                    </div>
                  </div>

                  <CardHeader className="flex flex-col items-center text-center pt-12 pb-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-all duration-700" />
                      {proveedor.imagen ? (
                        <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl relative z-10 transition-transform group-hover:rotate-6">
                          <img src={proveedor.imagen} alt={proveedor.nombre} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center text-4xl font-black border-4 border-white dark:border-gray-800 shadow-2xl relative z-10 transition-transform group-hover:rotate-6">
                          {proveedor.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 relative z-10">
                      <h3 className="font-black text-xl uppercase tracking-tight text-slate-800 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">{proveedor.nombre}</h3>
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-blue-200 text-blue-500 bg-blue-50/50">
                          {preciosProveedor.length} INSUMOS
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-8 px-8 space-y-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-gray-800 to-transparent opacity-50 mb-6"></div>

                    <div className="space-y-3">
                      {proveedor.contacto && (
                        <div className="flex items-center gap-3 text-slate-500 group/info">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/50">
                            <Truck className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 truncate">{proveedor.contacto}</span>
                        </div>
                      )}

                      {proveedor.telefono && (
                        <div className="flex items-center gap-3 text-emerald-600 group/info">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50">
                            <Phone className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-[10px] font-black tracking-widest truncate">{proveedor.telefono}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-gray-800 text-blue-600 hover:bg-blue-100 transition-all border border-transparent hover:border-blue-200"
                        onClick={(e) => { e.stopPropagation(); handleEdit(proveedor); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-gray-800 text-rose-600 hover:bg-rose-100 transition-all border border-transparent hover:border-rose-200"
                        onClick={(e) => { e.stopPropagation(); handleDelete(proveedor.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm grid grid-cols-2 gap-2">
                    {proveedor.telefono && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-2xl bg-white dark:bg-gray-950 border-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all gap-2"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${(proveedor.telefono || '').replace(/\D/g, '')}`, '_blank'); }}
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </Button>
                    )}
                    {proveedor.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-2xl bg-white dark:bg-gray-950 border-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all gap-2"
                        onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${proveedor.email}`; }}
                      >
                        <Mail className="w-4 h-4" /> Enviar Mail
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewingProveedor} onOpenChange={() => setViewingProveedor(null)}>
        <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
          {viewingProveedor && (
            <div className="flex flex-col h-[80vh]">
              {/* Header Profile */}
              <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-indigo-950 p-12 text-white relative">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 rounded-[2.5rem] blur-2xl animate-pulse" />
                    {viewingProveedor.imagen ? (
                      <img src={viewingProveedor.imagen} className="w-40 h-40 rounded-[2.5rem] object-cover border-4 border-white/20 shadow-2xl relative z-10 transform -rotate-3" />
                    ) : (
                      <div className="w-40 h-40 rounded-[2.5rem] bg-white/10 backdrop-blur-xl border-4 border-white/20 flex items-center justify-center text-7xl font-black relative z-10 transform -rotate-3">
                        {viewingProveedor.nombre.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <h2 className="text-4xl font-black uppercase tracking-tighter">{viewingProveedor.nombre}</h2>
                      <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-black">5.0</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-6 opacity-80">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-200">
                        <MapPin className="w-4 h-4" /> {viewingProveedor.direccion || 'Bogotá, Colombia'}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
                        <UserCheck className="w-4 h-4" /> {viewingProveedor.contacto || 'Aliado Certificado'}
                      </div>
                    </div>

                    <div className="flex justify-center md:justify-start gap-4 pt-4">
                      <Button className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 shadow-xl shadow-emerald-500/30 border-none">
                        Realizar Pedido
                      </Button>
                      <Button variant="ghost" className="rounded-2xl bg-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 border border-white/10 hover:bg-white/20">
                        Ver Historial
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-8 top-8 text-white/40 hover:text-white"
                  onClick={() => setViewingProveedor(null)}
                >
                  <X className="w-8 h-8" />
                </Button>
              </div>

              {/* Stats & Products List */}
              <div className="flex-1 p-12 grid grid-cols-1 lg:grid-cols-4 gap-12 overflow-y-auto bg-slate-50 dark:bg-gray-950">
                <div className="space-y-8">
                  <Card className="rounded-[2rem] border-none bg-white dark:bg-gray-900 shadow-xl p-8 border border-white/20">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-6">Mecanismos de Contacto</h4>
                    <div className="space-y-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Línea Directa</span>
                        <p className="font-black text-slate-800 dark:text-white tracking-widest">{viewingProveedor.telefono || '---'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Email Corporativo</span>
                        <p className="font-black text-slate-800 dark:text-white truncate" title={viewingProveedor.email}>{viewingProveedor.email || '---'}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="rounded-[2rem] border-none bg-indigo-600 text-white shadow-2xl p-8 relative overflow-hidden group">
                    <div className="relative z-10">
                      <Zap className="w-8 h-8 mb-4 text-emerald-300" />
                      <h4 className="text-xl font-black uppercase tracking-tight">Análisis Yimi</h4>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mt-1 opacity-70">Desempeño del Aliado</p>
                      <div className="mt-8 space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase">
                          <span>Puntualidad</span>
                          <span className="text-emerald-300">100%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full">
                          <div className="h-full w-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                        </div>
                      </div>
                    </div>
                    <ShieldCheck className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:scale-125 transition-transform" />
                  </Card>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-4">
                      <div className="p-2 bg-blue-600 rounded-xl shadow-lg">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Catálogo Vinculado
                    </h3>
                    <Badge className="bg-blue-100 text-blue-600 font-black px-4 py-1.5 rounded-xl border-none">
                      {getPreciosByProveedor(viewingProveedor.id).length} ITEMS DETECTADOS
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPreciosByProveedor(viewingProveedor.id).map(precio => {
                      const prod = getProductoById(precio.productoId);
                      if (!prod) return null;
                      const costoBase = Number(precio.precioCosto || 0);
                      const precioVenta = Number(prod.precioVenta || 0);
                      const margen = costoBase > 0 ? ((precioVenta - costoBase) / costoBase) * 100 : 0;

                      return (
                        <div key={precio.id} className="p-6 rounded-[2rem] bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 flex items-center justify-between group">
                          <div className="flex-1">
                            <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg group-hover:text-blue-600 transition-colors">{prod.nombre}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{prod.categoria}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-blue-600 tabular-nums tracking-tighter">{formatCurrency(precio.precioCosto)}</p>
                            <Badge className={cn(
                              "text-[8px] font-black uppercase tracking-tighter mt-1 border-none",
                              margen > 30 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              Rentabilidad: {margen.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Proveedores;
