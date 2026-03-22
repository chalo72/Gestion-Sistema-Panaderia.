import { useState, useMemo } from 'react';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Shield,
  Mail,
  Search,
  Activity,
  UserPlus,
  Lock,
  MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_DESCRIPTIONS, type UserRole, type Usuario } from '@/types';
import { cn } from '@/lib/utils';

export function Usuarios() {
  const { usuarios, addUsuario, updateUsuario, deleteUsuario } = useAuth();
  const { isAdmin } = useCan();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    nombre: '',
    apellido: '',
    rol: 'VENDEDOR' as UserRole,
    activo: true,
  });

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u =>
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.rol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usuarios, searchTerm]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-ag-fade-in">
        <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/20">
          <Lock className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Acceso Restringido</h2>
        <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.2em] mt-2 opacity-60">Solo el Alto Panel de Administración puede acceder</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const success = await updateUsuario(editingUser.id, formData);
      if (success) {
        toast.success('Entidad de usuario actualizada en el Nexus');
        setIsDialogOpen(false);
        setEditingUser(null);
      }
    } else {
      const success = await addUsuario(formData);
      if (success) {
        toast.success('Nueva entidad de usuario sincronizada');
        setIsDialogOpen(false);
        setFormData({ email: '', nombre: '', apellido: '', rol: 'VENDEDOR', activo: true });
      }
    }
  };

  const handleEdit = (user: Usuario) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido || '',
      rol: user.rol,
      activo: user.activo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de desvincular permanentemente esta entidad?')) {
      const success = await deleteUsuario(id);
      if (success) {
        toast.success('Entidad desvinculada del sistema');
      } else {
        toast.error('Fallo en la desvinculación crítica');
      }
    }
  };

  const handleToggleActivo = async (user: Usuario) => {
    const success = await updateUsuario(user.id, { activo: !user.activo });
    if (success) {
      toast.success(`Estado de entidad conmutado: ${!user.activo ? 'ACTIVO' : 'INACTIVO'}`);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Usuarios del Sistema</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{usuarios.length} activos · Dulce Placer</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs"
              onClick={() => {
                setEditingUser(null);
                setFormData({ email: '', nombre: '', apellido: '', rol: 'VENDEDOR', activo: true });
              }}
            >
              <UserPlus className="w-5 h-5" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </DialogTitle>
              <DialogDescription>
                Completa los datos del usuario
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-3">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500/50" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-10 pl-12 rounded-xl border border-slate-200 dark:border-slate-700 mt-1"
                      placeholder="usuario@dulceplacer.com"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nombre</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 mt-1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Apellido</Label>
                    <Input
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 mt-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rol" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Rol</Label>
                  <Select
                    value={formData.rol}
                    onValueChange={(value: UserRole) => setFormData({ ...formData, rol: value })}
                  >
                    <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ADMIN" className="font-bold uppercase text-[10px] tracking-widest">Administrador</SelectItem>
                      <SelectItem value="GERENTE" className="font-bold uppercase text-[10px] tracking-widest">Gerente</SelectItem>
                      <SelectItem value="COMPRADOR" className="font-bold uppercase text-[10px] tracking-widest">Comprador</SelectItem>
                      <SelectItem value="VENDEDOR" className="font-bold uppercase text-[10px] tracking-widest">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <Label htmlFor="activo" className="mb-0 text-[10px] font-black uppercase tracking-widest cursor-pointer">Usuario activo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm">
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </header>

      {/* Modern Search */}
      <div className="relative group max-w-2xl mx-auto px-4">
        <div className="absolute inset-0 bg-indigo-500/10 blur-2xl group-focus-within:bg-indigo-500/20 transition-all rounded-3xl" />
        <div className="relative flex items-center h-16 bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-[1.5rem] border border-white/20 dark:border-slate-800/50 px-6 shadow-2xl">
          <Search className="w-5 h-5 text-indigo-500 mr-4" />
          <Input
            placeholder="Analizar entidades por nombre, email o cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none bg-transparent h-full text-sm font-bold uppercase tracking-tight focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsuarios.map((user) => (
          <Card key={user.id} className={cn(
            "rounded-[2.5rem] border-none bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden group hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl relative",
            !user.activo && "opacity-60 grayscale"
          )}>
            <div className="absolute top-0 right-0 p-4">
              <Badge variant="outline" className="bg-white/5 border-none text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                ID: {user.id.slice(0, 8)}
              </Badge>
            </div>

            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center gap-6">
                <div className="relative">
                  <div
                    className="w-24 h-24 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-2xl relative z-10 overflow-hidden transform group-hover:rotate-6 transition-transform duration-500"
                    style={{ background: `linear-gradient(135deg, ${ROLE_DESCRIPTIONS[user.rol].color}, ${ROLE_DESCRIPTIONS[user.rol].color}99)` }}
                  >
                    {user.nombre.charAt(0)}{user.apellido?.charAt(0)}
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:10px_10px] opacity-20" />
                  </div>
                  <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tighter truncate max-w-[200px]">
                    {user.nombre} {user.apellido}
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 flex items-center justify-center gap-2">
                    <Mail className="w-3 h-3" /> {user.email}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    className="text-[10px] font-black uppercase tracking-[0.2em] border-none shadow-lg px-4 py-1.5"
                    style={{ backgroundColor: ROLE_DESCRIPTIONS[user.rol].color, color: 'white' }}
                  >
                    <Shield className="w-3 h-3 mr-2" /> {ROLE_DESCRIPTIONS[user.rol].nombre}
                  </Badge>
                  {!user.activo && (
                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-[0.2em]">Inactivo</Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-4 w-full border-t border-white/5 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActivo(user)}
                    className={cn(
                      "flex-1 h-12 rounded-2xl transition-all",
                      user.activo ? "hover:bg-rose-500/10 text-rose-500" : "hover:bg-emerald-500/10 text-emerald-500"
                    )}
                    title={user.activo ? 'Desactivar Entidad' : 'Activar Entidad'}
                  >
                    {user.activo ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(user)}
                    className="flex-1 h-12 rounded-2xl hover:bg-blue-500/10 text-blue-500 transition-all font-black text-[10px]"
                    title="Configurar Perfil"
                  >
                    <Edit2 className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(user.id)}
                    className="flex-1 h-12 rounded-2xl hover:bg-rose-600 text-rose-600 hover:text-white transition-all"
                    title="Expulsar del Sistema"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info de Roles - Dynamic Cards */}
      <div className="pt-12">
        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground text-center mb-8 opacity-40 italic">
          Arquitectura de Permisos y Jerarquías
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Object.entries(ROLE_DESCRIPTIONS).map(([rol, info]) => (
            <Card key={rol} className="border-none bg-white/5 backdrop-blur-md rounded-[2rem] overflow-hidden group hover:bg-white/10 transition-all">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                    style={{ backgroundColor: info.color, boxShadow: `0 0 15px ${info.color}66` }}
                  />
                  <p className="font-black uppercase text-[10px] tracking-widest">{info.nombre}</p>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground italic group-hover:text-foreground transition-colors">
                  "{info.descripcion}"
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Usuarios;

