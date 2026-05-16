import { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Phone, Mail, MapPin, 
  CreditCard, Calendar, Filter, MoreVertical, 
  Pencil, Trash2, CheckCircle2, Building2, 
  User, Star, Info, ChevronRight, ArrowLeft,
  Download, FileText, BadgeCheck, PhoneCall
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import type { Cliente, ClienteTipo } from '@/types';

const TIPO_CLIENTE_CONFIG: Record<ClienteTipo, { label: string; color: string; bg: string; icon: any }> = {
  particular: { label: 'Particular', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', icon: User },
  empresa: { label: 'Empresa', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', icon: Building2 },
  frecuente: { label: 'Frecuente', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', icon: Star },
  mayorista: { label: 'Mayorista', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: BadgeCheck },
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  
  // Estado para el Modal
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<Partial<Cliente>>({
    tipo: 'particular',
    nombre: '',
    identificacion: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    notas: ''
  });

  // Carga inicial
  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const data = await db.getAllClientes();
      setClientes(data);
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditando(cliente);
      setFormData(cliente);
    } else {
      setEditando(null);
      setFormData({
        tipo: 'particular',
        nombre: '',
        identificacion: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        notas: ''
      });
    }
    setShowModal(true);
  };

  const handleGuardar = async () => {
    if (!formData.nombre?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      const payload: Cliente = {
        id: editando?.id || crypto.randomUUID(),
        nombre: formData.nombre,
        identificacion: formData.identificacion || '',
        telefono: formData.telefono || '',
        email: formData.email || '',
        direccion: formData.direccion || '',
        ciudad: formData.ciudad || '',
        tipo: formData.tipo as ClienteTipo || 'particular',
        notas: formData.notas || '',
        createdAt: editando?.createdAt || new Date().toISOString(),
      };

      if (editando) {
        await db.updateCliente(payload);
        toast.success('Cliente actualizado correctamente');
      } else {
        await db.addCliente(payload);
        toast.success('Cliente registrado exitosamente');
      }

      setShowModal(false);
      cargarClientes();
    } catch (error) {
      toast.error('Error al guardar el cliente');
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    
    try {
      await db.deleteCliente(id);
      toast.success('Cliente eliminado');
      cargarClientes();
    } catch (error) {
      toast.error('Error al eliminar cliente');
    }
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                           c.identificacion?.includes(busqueda) ||
                           c.telefono?.includes(busqueda);
      const matchFiltro = filtroTipo === 'todos' || c.tipo === filtroTipo;
      return matchBusqueda && matchFiltro;
    });
  }, [clientes, busqueda, filtroTipo]);

  return (
    <div className="min-h-full flex flex-col gap-6 p-6 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
      
      {/* ── Header Principal ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Soberanía de Clientes</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
              <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" /> 
              Gestión Maestra de Base de Datos Personal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            onClick={() => handleOpenModal()}
            className="flex-1 md:flex-none h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Registrar Cliente
          </Button>
          <Button variant="outline" className="w-12 h-12 p-0 rounded-2xl border-slate-200">
            <Download className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
      </header>

      {/* ── Filtros y Estadísticas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Filtros */}
        <Card className="lg:col-span-3 rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
          <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                placeholder="Buscar por nombre, identificación o teléfono..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="h-12 pl-12 bg-white dark:bg-slate-800 border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-5 h-5 text-slate-400 shrink-0" />
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-12 w-full md:w-48 bg-white dark:bg-slate-800 border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                  <SelectValue placeholder="Tipo de Cliente" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100">
                  <SelectItem value="todos" className="font-bold">Todos los Tipos</SelectItem>
                  <SelectItem value="particular" className="font-bold">Particular</SelectItem>
                  <SelectItem value="frecuente" className="font-bold">Frecuente</SelectItem>
                  <SelectItem value="mayorista" className="font-bold">Mayorista</SelectItem>
                  <SelectItem value="empresa" className="font-bold">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm bg-indigo-600 text-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Clientes</p>
              <h2 className="text-4xl font-black mt-1 tracking-tighter">{clientesFiltrados.length}</h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Users className="w-6 h-6 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Grilla de Clientes ── */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-black uppercase tracking-widest text-xs">Cargando base de datos...</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">No se encontraron clientes</h3>
          <p className="text-slate-400 font-bold mt-2">Prueba ajustando el filtro o registra uno nuevo</p>
          <Button 
            variant="outline" 
            onClick={() => handleOpenModal()}
            className="mt-8 h-12 px-8 rounded-2xl border-indigo-200 text-indigo-600 font-black uppercase text-xs tracking-widest"
          >
            Registrar Primer Cliente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clientesFiltrados.map(cliente => {
            const config = TIPO_CLIENTE_CONFIG[cliente.tipo] || TIPO_CLIENTE_CONFIG.particular;
            const Icon = config.icon;
            
            return (
              <Card 
                key={cliente.id} 
                className="group rounded-[32px] border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden border-b-4 border-b-transparent hover:border-b-indigo-500"
              >
                <CardContent className="p-0">
                  {/* Banner Superior */}
                  <div className={cn("h-2 w-full", config.bg.replace('/30', ''))} />
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner", config.bg)}>
                          <Icon className={cn("w-7 h-7", config.color)} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                            {cliente.nombre}
                          </h3>
                          <Badge className={cn("mt-1.5 border-none font-black text-[9px] uppercase tracking-widest py-0.5", config.bg, config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenModal(cliente)}
                          className="w-9 h-9 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEliminar(cliente.id)}
                          className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Información de Contacto */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold">{cliente.identificacion || 'Sin identificación'}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {cliente.telefono || 'No registrado'}
                        </span>
                        {cliente.telefono && (
                          <a href={`tel:${cliente.telefono}`} className="ml-auto w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold truncate">
                          {cliente.direccion ? `${cliente.direccion}${cliente.ciudad ? `, ${cliente.ciudad}` : ''}` : 'Sin dirección'}
                        </span>
                      </div>
                    </div>

                    {/* Notas / Metadata */}
                    {cliente.notas && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1">
                          <Info className="w-3 h-3" /> Notas Internas
                        </p>
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 italic line-clamp-2">
                          "{cliente.notas}"
                        </p>
                      </div>
                    )}

                    {/* Footer del Card */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registrado el</span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {new Date(cliente.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <Button variant="ghost" className="h-8 gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest p-0 px-3 hover:bg-indigo-50 rounded-xl">
                        Ver Perfil <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Modal de Registro / Edición ── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <UserPlus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                    {editando ? 'Actualizar Cliente' : 'Nuevo Cliente'}
                  </DialogTitle>
                  <DialogDescription className="text-white/70 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Gestión Maestra de Identidad Personal
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Completo *</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ej: Juan Pérez"
                    value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identificación (Cédula/NIT)</Label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ej: 1.065.789..."
                    value={formData.identificacion}
                    onChange={e => setFormData({...formData, identificacion: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono de Contacto</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ej: 300 123 4567"
                    value={formData.telefono}
                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    type="email"
                    placeholder="Ej: cliente@correo.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipo de Cliente</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={v => setFormData({...formData, tipo: v as ClienteTipo})}
                >
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="particular" className="font-bold">Particular</SelectItem>
                    <SelectItem value="frecuente" className="font-bold">Frecuente</SelectItem>
                    <SelectItem value="mayorista" className="font-bold">Mayorista</SelectItem>
                    <SelectItem value="empresa" className="font-bold">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ciudad / Municipio</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ej: Montería"
                    value={formData.ciudad}
                    onChange={e => setFormData({...formData, ciudad: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección de Residencia/Entrega</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ej: Calle 123 # 45-67 Barrio..."
                    value={formData.direccion}
                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                    className="h-12 pl-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notas y Observaciones</Label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                  <textarea 
                    placeholder="Información adicional sobre el cliente..."
                    value={formData.notas}
                    onChange={e => setFormData({...formData, notas: e.target.value})}
                    className="w-full min-h-[100px] pl-12 pt-4 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setShowModal(false)}
              className="h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleGuardar}
              className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/20"
            >
              {editando ? 'Actualizar Cliente' : 'Guardar Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
