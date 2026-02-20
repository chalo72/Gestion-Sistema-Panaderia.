import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Usuario, UserRole, Permission } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  // Estado
  usuario: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Acciones
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Permisos
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;

  // Gestión de Permisos Dinámicos
  rolePermissions: Record<UserRole, Permission[]>;
  updateRolePermissions: (role: UserRole, permissions: Permission[]) => void;
  resetPermissions: () => void;

  // Info del rol
  role: UserRole | null;
  permissions: Permission[];

  // Gestión de usuarios (solo admin)
  usuarios: Usuario[];
  addUsuario: (usuario: Omit<Usuario, 'id' | 'createdAt'>) => Promise<boolean>;
  updateUsuario: (id: string, updates: Partial<Usuario>) => Promise<boolean>;
  deleteUsuario: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]); // Para gestión (solo admin)

  // Cargar sesión guardada al iniciar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setUsuario(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }

      if (data) {
        setUsuario({
          id: data.id,
          email: data.email,
          nombre: data.nombre,
          rol: data.rol as UserRole,
          activo: data.activo,
          ultimoAcceso: data.ultimo_acceso,
          createdAt: data.created_at
        });
      } else {
        // Create profile if missing (first login with this email if handled externally, or weird state)
        // For now, assume trigger handles it or we manually create if using just email auth
        // But handle_new_user trigger in SQL handles insertion. 
        // If trigger failed or slow, we might not see it yet.
        // Fallback: use metadata or temporary object
        setUsuario({
          id: userId,
          email: email,
          nombre: 'Usuario',
          rol: 'VENDEDOR', // Default
          activo: true,
          ultimoAcceso: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    // Auth logic handled in onAuthStateChange
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  }, []);

  // Permisos dinámicos (Podríamos migrarlos a DB también, pero localStorage está OK por ahora)
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(() => {
    try {
      const savedPermissions = localStorage.getItem('pricecontrol_permissions');
      return savedPermissions ? JSON.parse(savedPermissions) : ROLE_PERMISSIONS;
    } catch (e) {
      console.error('Error cargando permisos:', e);
      return ROLE_PERMISSIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem('pricecontrol_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  const updateRolePermissions = useCallback((role: UserRole, newPermissions: Permission[]) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: newPermissions
    }));
  }, []);

  const resetPermissions = useCallback(() => {
    setRolePermissions(ROLE_PERMISSIONS);
    localStorage.removeItem('pricecontrol_permissions');
  }, []);

  // Permisos actuales del usuario
  const permissions = usuario ? rolePermissions[usuario.rol] : [];

  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: Permission[]): boolean => {
    return perms.some(p => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((perms: Permission[]): boolean => {
    return perms.every(p => permissions.includes(p));
  }, [permissions]);

  // Gestión de usuarios (Admin Logic - Updated to use Supabase)
  // Nota: Para crear usuarios en Auth desde el cliente se necesita service_role o invitar.
  // Con anon key, lo ideal es usar `signUp` (que loguea al usuario) O una Edge Function.
  // Para MVP simple, solo permitiremos que ADMIN vea la lista de la tabla usuarios.
  // Crear usuarios requeriría invitar o que se registren ellos mismos.

  // Vamos a implementar "addUsuario" como un "signUp" secundario si no estamos logueados, 
  // pero ya estamos logueados como Admin.
  // Supabase no permite crear otros usuarios con el cliente JS simple mientras estás logueado,
  // salvo usando Admin API (backend).
  // Solución MVP: Generar un link de invitación o simplemente gestionar roles de usuarios ya registrados.

  // Por ahora, simularemos la gestión leyendo la tabla `usuarios` y permitiendo editar roles/nombres.
  // Creación real se delegará al registro (Login page -> Sign Up tab si existiera, o manual en dashboard supabase).

  const loadUsuarios = async () => {
    if (usuario?.rol === 'ADMIN') {
      const { data: _data } = await supabase.from('usuarios').select('*');
      if (_data) {
        setUsuarios(_data.map((u: any) => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          rol: u.rol,
          activo: u.activo,
          ultimoAcceso: u.ultimo_acceso,
          createdAt: u.created_at
        })));
      }
    }
  };

  useEffect(() => {
    if (usuario?.rol === 'ADMIN') {
      loadUsuarios();
    }
  }, [usuario]);


  const addUsuario = useCallback(async (_userData: Omit<Usuario, 'id' | 'createdAt'>): Promise<boolean> => {
    // Client-side user creation for OTHER users is restricted in Supabase Auth logic without edge functions.
    // For this demo, we will show a toast saying "Use Supabase Dashboard".
    toast.error("Para crear usuarios, por favor usa el panel de Supabase o invita al usuario.");
    return false;
  }, []);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    if (!usuario || usuario.rol !== 'ADMIN') return false;

    // Actualizar tabla usuarios (roles, activo, nombre)
    const { error } = await supabase.from('usuarios').update({
      nombre: updates.nombre,
      rol: updates.rol,
      activo: updates.activo
    }).eq('id', id);

    if (error) {
      toast.error('Error actualizando usuario: ' + error.message);
      return false;
    }

    await loadUsuarios();
    return true;
  }, [usuario]);

  const deleteUsuario = useCallback(async (id: string): Promise<boolean> => {
    if (!usuario || usuario.rol !== 'ADMIN') return false;
    if (id === usuario.id) return false;

    // Solo podemos borrar de public.usuarios
    // El usuario de Auth seguiría existiendo hasta que se borre en el panel.
    const { error } = await supabase.from('usuarios').delete().eq('id', id);

    if (error) {
      toast.error('Error eliminando perfil: ' + error.message);
      return false;
    }

    await loadUsuarios();
    toast.success('Perfil eliminado. El login debe borrarse en Supabase Auth.');
    return true;
  }, [usuario]);

  const value: AuthContextType = {
    usuario,
    isAuthenticated: !!usuario,
    isLoading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    role: usuario?.rol || null,
    permissions,
    rolePermissions,
    updateRolePermissions,
    resetPermissions,
    usuarios,
    addUsuario,
    updateUsuario,
    deleteUsuario,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

export function useCan() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, role, usuario } = useAuth();

  return {
    check: hasPermission,
    checkAny: hasAnyPermission,
    checkAll: hasAllPermissions,
    role,
    isAdmin: role === 'ADMIN',
    isGerente: role === 'GERENTE',
    isComprador: role === 'COMPRADOR',
    isVendedor: role === 'VENDEDOR',
    usuario,
  };
}
