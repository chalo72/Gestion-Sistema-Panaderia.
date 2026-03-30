import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Usuario, UserRole, Permission } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';
import { USUARIOS_PRUEBA } from '@/lib/seed-data';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  rolePermissions: Record<UserRole, Permission[]>;
  updateRolePermissions: (role: UserRole, permissions: Permission[]) => void;
  resetPermissions: () => void;
  role: UserRole | null;
  permissions: Permission[];
  usuarios: Usuario[];
  addUsuario: (usuario: Omit<Usuario, 'id' | 'createdAt'>) => Promise<boolean>;
  updateUsuario: (id: string, updates: Partial<Usuario>) => Promise<boolean>;
  deleteUsuario: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// PROTEGIDO: No modificar sin revisión. Contexto de autenticación validado y crítico para acceso seguro.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Gestión de Usuarios LOCAL
  const loadUsuarios = useCallback(() => {
    try {
      const savedUsuariosStr = localStorage.getItem('pricecontrol_local_user_list');
      const savedUsuarios = savedUsuariosStr ? JSON.parse(savedUsuariosStr) : [];

      // Limpieza Forzada de Usuarios de Prueba
      const hasOldTestData = savedUsuarios.some((u: any) =>
        u.email === 'admin@example.com' ||
        u.email === 'gerente@example.com' ||
        u.email === 'comprador@example.com' ||
        u.email === 'vendedor@example.com'
      );

      if (!savedUsuariosStr || hasOldTestData) {
        console.log("🧹 Limpiando usuarios de prueba antiguos...");
        setUsuarios(USUARIOS_PRUEBA);
        localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(USUARIOS_PRUEBA));
      } else {
        setUsuarios(savedUsuarios);
      }
    } catch (e) {
      console.error('Error cargando usuarios locales:', e);
      setUsuarios(USUARIOS_PRUEBA);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      console.log('🚀 Inicializando Sistema en MODO LOCAL SEGURO...');
      setIsLoading(true);
      try {
        const savedLocalUser = localStorage.getItem('pricecontrol_local_user');
        if (savedLocalUser) {
          const userData = JSON.parse(savedLocalUser) as Usuario;
          // Validar que la sesion no tenga mas de 30 dias de antiguedad
          const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;
          const ultimoAcceso = userData.ultimoAcceso ? new Date(userData.ultimoAcceso).getTime() : 0;
          const sesionExpirada = ultimoAcceso > 0 && (Date.now() - ultimoAcceso) > SESSION_MAX_MS;
          if (sesionExpirada) {
            console.info('⏰ [Auth] Sesion expirada (>12h). Requiere nuevo inicio de sesion.');
            localStorage.removeItem('pricecontrol_local_user');
          } else {
            setUsuario(userData);
          }
        }
      } catch (err) {
        console.error('❌ Error cargando sesión local:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();
    loadUsuarios();
    return () => { mounted = false; };
  }, [loadUsuarios]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const emailLower = email.toLowerCase().trim();
    const localUserListStr = localStorage.getItem('pricecontrol_local_user_list');
    const localUserList = localUserListStr ? JSON.parse(localUserListStr) : USUARIOS_PRUEBA;
    const localUser = (localUserList as Usuario[]).find(u => u.email.toLowerCase() === emailLower);

    const passMaestra = import.meta.env.VITE_MASTER_PASSWORD;
    const passInvitado = import.meta.env.VITE_GUEST_PASSWORD;
    if (!passMaestra) {
      setIsLoading(false);
      toast.error('Error de configuración del sistema.');
      return { success: false, error: 'Sistema no configurado.' };
    }

    // El dueño siempre entra como ADMIN con la contraseña maestra
    const esOwner = emailLower === 'chalo8321@gmail.com' && password === passMaestra;
    const isAdmin = (localUser?.rol === 'ADMIN' || esOwner) && password === passMaestra;
    // Contraseña individual del usuario (si tiene una asignada)
    const tienePassPropia = !!(localUser as any)?.password;
    const passIndividualOk = tienePassPropia && password === (localUser as any).password;
    // Contraseña por rol (configurada en Configuración → Contraseñas por Rol)
    const rolePasswords = JSON.parse(localStorage.getItem('pricecontrol_role_passwords') || '{}');
    const passRolOk = localUser?.rol && rolePasswords[localUser.rol] && password === rolePasswords[localUser.rol];
    const isGuest = !isAdmin && localUser?.rol !== 'ADMIN' && (passIndividualOk || passRolOk || password === passInvitado || password === passMaestra);
    const isMasterPass = isAdmin || isGuest;

    if ((localUser || esOwner) && isMasterPass) {
      const baseUser = localUser ?? USUARIOS_PRUEBA[0];
      // Restaurar rol ADMIN si fue modificado accidentalmente
      const rolFinal = esOwner ? 'ADMIN' : baseUser.rol;
      const userData = { ...baseUser, rol: rolFinal, ultimoAcceso: new Date().toISOString() };
      // Corregir también en la lista guardada
      if (esOwner && localUser?.rol !== 'ADMIN') {
        const listCorregida = (localUserList as Usuario[]).map(u =>
          u.email.toLowerCase() === emailLower ? { ...u, rol: 'ADMIN' } : u
        );
        localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(listCorregida));
      }
      setUsuario(userData);
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(userData));
      setIsLoading(false);
      toast.success('¡Bienvenido! Iniciando en modo local seguro.');
      return { success: true };
    }

    setIsLoading(false);
    toast.error('Email o contraseña incorrectos.');
    return { success: false, error: 'Email o contraseña incorrectos.' };
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Error no critico: la sesion local se cierra igualmente
      console.warn('⚠️ [Auth] Error al cerrar sesion en Supabase (ignorado):', e);
    }
    localStorage.removeItem('pricecontrol_local_user');
    setUsuario(null);
  }, []);

  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(() => {
    const saved = localStorage.getItem('pricecontrol_permissions');
    return saved ? JSON.parse(saved) : ROLE_PERMISSIONS;
  });

  useEffect(() => {
    localStorage.setItem('pricecontrol_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  const updateRolePermissions = useCallback((role: UserRole, newPermissions: Permission[]) => {
    setRolePermissions(prev => ({ ...prev, [role]: newPermissions }));
  }, []);

  const resetPermissions = useCallback(() => {
    setRolePermissions(ROLE_PERMISSIONS);
    localStorage.removeItem('pricecontrol_permissions');
  }, []);

  const permissions = usuario ? rolePermissions[usuario.rol] : [];

  // Sincronización Automática de Permisos - Optimizado para evitar bucles
  useEffect(() => {
    if (usuario && rolePermissions) {
      const currentRole = usuario.rol;
      const defaultRolePerms = ROLE_PERMISSIONS[currentRole] || [];
      const savedRolePerms = rolePermissions[currentRole] || [];

      // Solo actualizar si faltan permisos del sistema base
      const missingPerms = defaultRolePerms.filter(p => !savedRolePerms.includes(p));

      if (missingPerms.length > 0) {
        console.log(`🔄 [Nexus-Volt] Sincronizando permisos faltantes para ${currentRole}:`, missingPerms);
        const updatedPerms = [...new Set([...savedRolePerms, ...missingPerms])];

        setRolePermissions(prev => ({
          ...prev,
          [currentRole]: updatedPerms
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.rol]); // Solo re-accionar si el ROL del usuario cambia

  const hasPermission = useCallback((permission: Permission): boolean => permissions.includes(permission), [permissions]);
  const hasAnyPermission = useCallback((perms: Permission[]): boolean => perms.some(p => permissions.includes(p)), [permissions]);
  const hasAllPermissions = useCallback((perms: Permission[]): boolean => perms.every(p => permissions.includes(p)), [permissions]);

  const addUsuario = useCallback(async (userData: Omit<Usuario, 'id' | 'createdAt'>): Promise<boolean> => {
    const nuevo: Usuario = { ...userData, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const newList = [...usuarios, nuevo];
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    toast.success('Usuario guardado localmente');
    return true;
  }, [usuarios]);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    // El dueño (owner-local-id) no puede perder su rol ADMIN
    if (id === 'owner-local-id' && updates.rol && updates.rol !== 'ADMIN') {
      toast.error('El rol del dueño no puede ser modificado.');
      return false;
    }
    const newList = usuarios.map(u => u.id === id ? { ...u, ...updates } : u);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    if (usuario && id === usuario.id) {
      const updatedMe = { ...usuario, ...updates };
      setUsuario(updatedMe);
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(updatedMe));
    }
    return true;
  }, [usuarios, usuario]);

  const deleteUsuario = useCallback(async (id: string): Promise<boolean> => {
    if (id === 'owner-local-id' || (usuario && id === usuario.id)) {
      toast.error('No puedes eliminar tu propio usuario de administrador.');
      return false;
    }
    const newList = usuarios.filter(u => u.id !== id);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    return true;
  }, [usuarios, usuario]);

  const value = {
    usuario, isAuthenticated: !!usuario, isLoading, login, logout,
    hasPermission, hasAnyPermission, hasAllPermissions,
    role: usuario?.rol || null, permissions, rolePermissions,
    updateRolePermissions, resetPermissions, usuarios, addUsuario, updateUsuario, deleteUsuario
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};

export const useCan = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, role, usuario } = useAuth();
  return {
    check: hasPermission, checkAny: hasAnyPermission, checkAll: hasAllPermissions,
    role, isAdmin: role === 'ADMIN', isGerente: role === 'GERENTE',
    isComprador: role === 'COMPRADOR', isVendedor: role === 'VENDEDOR', usuario
  };
};
