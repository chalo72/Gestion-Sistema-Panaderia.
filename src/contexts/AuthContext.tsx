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
  syncRolePasswordsToCloud: (passwords: Record<string, string>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// PROTEGIDO: No modificar sin revisión. Contexto de autenticación validado y crítico para acceso seguro.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Gestión de Usuarios LOCAL + NUBE
  const syncUsuariosToCloud = useCallback(async (list: Usuario[]) => {
    try {
      const { error } = await supabase.from('configuracion').upsert({
        id: 'usuarios_equipo',
        categorias: list,
      });
      if (error) console.warn('⚠️ Error sincronizando usuarios a nube:', error.message);
      else console.log('☁️ Usuarios del equipo sincronizados a la nube');
    } catch (e) {
      console.warn('⚠️ Sync usuarios a nube falló:', e);
    }
  }, []);

  // Sincronizar contraseñas por rol a la nube
  const syncRolePasswordsToCloud = useCallback(async (passwords: Record<string, string>) => {
    try {
      const { error } = await supabase.from('configuracion').upsert({
        id: 'role_passwords',
        categorias: passwords,
      });
      if (error) console.warn('⚠️ Error sincronizando contraseñas de rol a nube:', error.message);
      else console.log('☁️ Contraseñas de rol sincronizadas a la nube');
    } catch (e) {
      console.warn('⚠️ Sync contraseñas de rol falló:', e);
    }
  }, []);

  // Cargar contraseñas de rol desde la nube si no existen en local
  const loadRolePasswordsFromCloud = useCallback(async () => {
    try {
      const localPasswords = localStorage.getItem('pricecontrol_role_passwords');
      if (localPasswords && Object.keys(JSON.parse(localPasswords)).length > 0) return; // Ya hay datos locales
      
      const { data } = await supabase.from('configuracion').select('categorias').eq('id', 'role_passwords').maybeSingle();
      if (data?.categorias && typeof data.categorias === 'object' && !Array.isArray(data.categorias)) {
        console.log('☁️ Contraseñas de rol cargadas desde la nube');
        localStorage.setItem('pricecontrol_role_passwords', JSON.stringify(data.categorias));
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron cargar contraseñas de rol de la nube');
    }
  }, []);

  // Sincronizar permisos personalizados a la nube
  const syncPermissionsToCloud = useCallback(async (perms: Record<string, string[]>) => {
    try {
      const { error } = await supabase.from('configuracion').upsert({
        id: 'role_permissions',
        categorias: perms,
      });
      if (error) console.warn('⚠️ Error sincronizando permisos a nube:', error.message);
      else console.log('☁️ Permisos de rol sincronizados a la nube');
    } catch (e) {
      console.warn('⚠️ Sync permisos falló:', e);
    }
  }, []);

  // Cargar permisos personalizados desde la nube si no existen en local
  const loadPermissionsFromCloud = useCallback(async (): Promise<Record<string, string[]> | null> => {
    try {
      const { data } = await supabase.from('configuracion').select('categorias').eq('id', 'role_permissions').maybeSingle();
      if (data?.categorias && typeof data.categorias === 'object' && !Array.isArray(data.categorias)) {
        console.log('☁️ Permisos de rol cargados desde la nube');
        return data.categorias as Record<string, string[]>;
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron cargar permisos de la nube');
    }
    return null;
  }, []);

  const loadUsuarios = useCallback(async () => {
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

      // SIEMPRE intentar cargar desde la nube primero si:
      // 1. No hay datos locales
      // 2. Hay datos de prueba antiguos
      // 3. Solo están los 2 defaults
      const isOnlyDefaults = savedUsuarios.length <= 2 && savedUsuarios.every((u: any) =>
        u.id === 'owner-local-id' || u.id === 'guest-local-id'
      );
      const shouldLoadFromCloud = !savedUsuariosStr || hasOldTestData || isOnlyDefaults;

      if (shouldLoadFromCloud) {
        console.log('☁️ Intentando cargar usuarios desde la nube...');
        try {
          const { data } = await supabase.from('configuracion').select('categorias').eq('id', 'usuarios_equipo').maybeSingle();
          if (data?.categorias && Array.isArray(data.categorias) && data.categorias.length > 0) {
            console.log('☁️ Usuarios cargados desde la nube:', data.categorias.length);
            setUsuarios(data.categorias as Usuario[]);
            localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(data.categorias));
            
            // Sincronizar también contraseñas de rol si vienen de la nube
            await loadRolePasswordsFromCloud();
            return;
          }
        } catch (e) { console.warn('⚠️ No se pudieron cargar usuarios de la nube:', e); }

        // Si la nube no tiene datos y es primer uso, usar defaults
        if (!savedUsuariosStr || hasOldTestData) {
          setUsuarios(USUARIOS_PRUEBA);
          localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(USUARIOS_PRUEBA));
        } else {
          setUsuarios(savedUsuarios);
        }
      } else {
        // Local tiene datos reales — usarlos directamente
        setUsuarios(savedUsuarios);
      }
    } catch (e) {
      console.error('Error cargando usuarios locales:', e);
      setUsuarios(USUARIOS_PRUEBA);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // DETECCIÓN DE BUCLE DE REDIRECCIÓN NEXUS-VOLT
        // Si hay más de 3 recargas en 30 segundos, es un bucle corrupto
        const now = Date.now();
        const lastReset = Number(localStorage.getItem('nexus_last_reset') || 0);
        const redirectCount = Number(sessionStorage.getItem('nexus_redirect_count') || 0);
        
        if (now - lastReset < 30000 && redirectCount > 3) {
          console.error('🚨 [Nexus-Volt] Bucle de login detectado. Ejecutando Nuke de emergencia...');
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem('nexus_last_reset', Date.now().toString());
          window.location.href = '/?reset=force';
          return;
        }

        const savedUser = localStorage.getItem('pricecontrol_local_user') || sessionStorage.getItem('pricecontrol_session_user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUsuario(userData);
          
          // BLINDAJE: Carga inmediata (Background Sync)
          // No bloqueamos la UI esperando a loadCriticalData si ya tenemos sesión.
          // El Dashboard se mostrará con datos locales mientras la nube sincroniza.
          setIsLoading(false); 
          
          // La sincronización ocurre en paralelo, silenciosamente
          console.log('⚡ [Nexus-Volt] Sesión restaurada. Sincronización en segundo plano iniciada.');
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsLoading(false);
      }
    };

    checkSession();
    loadUsuarios();
    loadRolePasswordsFromCloud();
  }, [loadUsuarios, loadRolePasswordsFromCloud]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const emailLower = email.toLowerCase().trim();
    // ELIMINAR BLOQUEO MULTI-DISPOSITIVO: Sincronización ultrarrápida con tiempo de espera (2s)
    try {
      const cloudSync = async () => {
        const { data: uData } = await supabase.from('configuracion').select('categorias').eq('id', 'usuarios_equipo').maybeSingle();
        if (uData?.categorias && Array.isArray(uData.categorias)) {
          localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(uData.categorias));
          setUsuarios(uData.categorias as Usuario[]);
        }
        const { data: rData } = await supabase.from('configuracion').select('categorias').eq('id', 'role_passwords').maybeSingle();
        if (rData?.categorias && typeof rData.categorias === 'object') {
          localStorage.setItem('pricecontrol_role_passwords', JSON.stringify(rData.categorias));
        }
      };
      
      // Correr sincronización en paralelo con un timeout para no bloquear el login
      await Promise.race([
        cloudSync(),
        new Promise(resolve => setTimeout(resolve, 2000)) 
      ]);
    } catch (e) { console.warn('⚠️ Sincronización saltada (usando local)'); }

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
      const rolFinal = esOwner ? 'ADMIN' : baseUser.rol;
      const userData = { ...baseUser, rol: rolFinal, ultimoAcceso: new Date().toISOString() };
      
      // PERSISTENCIA DUAL (para navegadores restrictivos)
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(userData));
      sessionStorage.setItem('pricecontrol_session_user', JSON.stringify(userData));
      
      setUsuario(userData);
      setIsLoading(false);
      
      toast.success('¡Bienvenido! Sesión activada en todos los sistemas.');
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

  // Al montar: si localStorage está vacío para permisos, cargar desde la nube
  useEffect(() => {
    const saved = localStorage.getItem('pricecontrol_permissions');
    if (!saved) {
      loadPermissionsFromCloud().then(cloudPerms => {
        if (cloudPerms) {
          const mergedPerms = { ...ROLE_PERMISSIONS, ...cloudPerms } as Record<UserRole, Permission[]>;
          setRolePermissions(mergedPerms);
          localStorage.setItem('pricecontrol_permissions', JSON.stringify(mergedPerms));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('pricecontrol_permissions', JSON.stringify(rolePermissions));
    // Sincronizar permisos a la nube cada vez que cambian
    syncPermissionsToCloud(rolePermissions);
  }, [rolePermissions, syncPermissionsToCloud]);

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
    syncUsuariosToCloud(newList);
    toast.success('Usuario guardado localmente');
    return true;
  }, [usuarios, syncUsuariosToCloud]);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    // El dueño (owner-local-id) no puede perder su rol ADMIN
    if (id === 'owner-local-id' && updates.rol && updates.rol !== 'ADMIN') {
      toast.error('El rol del dueño no puede ser modificado.');
      return false;
    }
    const newList = usuarios.map(u => u.id === id ? { ...u, ...updates } : u);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    syncUsuariosToCloud(newList);
    if (usuario && id === usuario.id) {
      const updatedMe = { ...usuario, ...updates };
      setUsuario(updatedMe);
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(updatedMe));
    }
    return true;
  }, [usuarios, usuario, syncUsuariosToCloud]);

  const deleteUsuario = useCallback(async (id: string): Promise<boolean> => {
    if (id === 'owner-local-id' || (usuario && id === usuario.id)) {
      toast.error('No puedes eliminar tu propio usuario de administrador.');
      return false;
    }
    const newList = usuarios.filter(u => u.id !== id);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    syncUsuariosToCloud(newList);
    return true;
  }, [usuarios, usuario, syncUsuariosToCloud]);

  const value = {
    usuario, isAuthenticated: !!usuario, isLoading, login, logout,
    hasPermission, hasAnyPermission, hasAllPermissions,
    role: usuario?.rol || null, permissions, rolePermissions,
    updateRolePermissions, resetPermissions, usuarios, addUsuario, updateUsuario, deleteUsuario,
    syncRolePasswordsToCloud
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
