import { useState } from 'react';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_DESCRIPTIONS, type UserRole, type Usuario } from '@/types';

export function Usuarios() {
  const { usuarios, addUsuario, updateUsuario, deleteUsuario } = useAuth();
  const { isAdmin } = useCan();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    nombre: '',
    apellido: '',
    rol: 'VENDEDOR' as UserRole,
    activo: true,
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-800">Acceso Restringido</h2>
        <p className="text-gray-500 mt-2">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const success = await updateUsuario(editingUser.id, formData);
      if (success) {
        toast.success('Usuario actualizado correctamente');
        setIsDialogOpen(false);
        setEditingUser(null);
      }
    } else {
      const success = await addUsuario(formData);
      if (success) {
        toast.success('Usuario creado correctamente');
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
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
      const success = await deleteUsuario(id);
      if (success) {
        toast.success('Usuario eliminado correctamente');
      } else {
        toast.error('No se pudo eliminar el usuario');
      }
    }
  };

  const handleToggleActivo = async (user: Usuario) => {
    const success = await updateUsuario(user.id, { activo: !user.activo });
    if (success) {
      toast.success(`Usuario ${user.activo ? 'desactivado' : 'activado'} correctamente`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">👥 Gestión de Usuarios</h1>
          <p className="text-gray-500 mt-1">Administra los usuarios y sus permisos del sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => {
              setEditingUser(null);
              setFormData({ email: '', nombre: '', apellido: '', rol: 'VENDEDOR', activo: true });
            }}>
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="rol">Rol</Label>
                <Select
                  value={formData.rol}
                  onValueChange={(value: UserRole) => setFormData({ ...formData, rol: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="GERENTE">Gerente</SelectItem>
                    <SelectItem value="COMPRADOR">Comprador</SelectItem>
                    <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="activo" className="mb-0">Usuario activo</Label>
              </div>
              <Button type="submit" className="w-full">
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Usuarios */}
      <div className="grid gap-4">
        {usuarios.map((user) => (
          <Card key={user.id} className={!user.activo ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: ROLE_DESCRIPTIONS[user.rol].color }}
                  >
                    {user.nombre.charAt(0)}{user.apellido?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{user.nombre} {user.apellido}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        style={{
                          backgroundColor: ROLE_DESCRIPTIONS[user.rol].color,
                          color: 'white'
                        }}
                      >
                        {ROLE_DESCRIPTIONS[user.rol].nombre}
                      </Badge>
                      {!user.activo && (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActivo(user)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={user.activo ? 'Desactivar' : 'Activar'}
                  >
                    {user.activo ? (
                      <UserCheck className="w-5 h-5 text-green-600" />
                    ) : (
                      <UserX className="w-5 h-5 text-red-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(user)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info de Roles */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>📋 Descripción de Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(ROLE_DESCRIPTIONS).map(([rol, info]) => (
              <div key={rol} className="flex items-start gap-3 p-3 rounded-lg border">
                <div
                  className="w-4 h-4 rounded-full mt-1"
                  style={{ backgroundColor: info.color }}
                />
                <div>
                  <p className="font-semibold">{info.nombre}</p>
                  <p className="text-sm text-gray-500">{info.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Usuarios;
