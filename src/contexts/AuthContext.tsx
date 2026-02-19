import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Usuario, UserRole, Permission } from '@/types';
import { ROLE_PERMISSIONS, USUARIOS_PRUEBA, CREDENCIALES_PRUEBA } from '@/types';

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

const STORAGE_KEY = 'pricecontrol_auth';
const USERS_STORAGE_KEY = 'pricecontrol_users';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Cargar sesión guardada al iniciar
  useEffect(() => {
    const initAuth = () => {
      try {
        // Cargar usuarios
        const savedUsers = localStorage.getItem(USERS_STORAGE_KEY);
        if (savedUsers) {
          setUsuarios(JSON.parse(savedUsers));
        } else {
          // Inicializar con usuarios de prueba
          setUsuarios(USUARIOS_PRUEBA);
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(USUARIOS_PRUEBA));
        }

        // Cargar sesión
        const savedAuth = localStorage.getItem(STORAGE_KEY);
        if (savedAuth) {
          const parsed = JSON.parse(savedAuth);
          if (parsed.usuario && parsed.expiresAt > Date.now()) {
            setUsuario(parsed.usuario);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Error inicializando auth:', error);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Guardar usuarios cuando cambien
  useEffect(() => {
    if (usuarios.length > 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usuarios));
    }
  }, [usuarios]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Validar credenciales
    const expectedPassword = CREDENCIALES_PRUEBA[email.toLowerCase()];

    if (!expectedPassword || expectedPassword !== password) {
      return { success: false, error: 'Email o contraseña incorrectos' };
    }

    // Buscar usuario
    const user = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (!user.activo) {
      return { success: false, error: 'Usuario desactivado' };
    }

    // Actualizar último acceso
    const updatedUser = { ...user, ultimoAcceso: new Date().toISOString() };
    setUsuarios(prev => prev.map(u => u.id === user.id ? updatedUser : u));

    // Guardar sesión (expira en 24 horas)
    const session = {
      usuario: updatedUser,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUsuario(updatedUser);

    return { success: true };
  }, [usuarios]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuario(null);
  }, []);

  // Permisos dinámicos
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(() => {
    // Intentar cargar permisos personalizados del storage
    try {
      const savedPermissions = localStorage.getItem('pricecontrol_permissions');
      return savedPermissions ? JSON.parse(savedPermissions) : ROLE_PERMISSIONS;
    } catch (e) {
      console.error('Error cargando permisos:', e);
      return ROLE_PERMISSIONS;
    }
  });

  // Guardar permisos cuando cambien
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

  // Gestión de usuarios
  const addUsuario = useCallback(async (userData: Omit<Usuario, 'id' | 'createdAt'>): Promise<boolean> => {
    if (!usuario || usuario.rol !== 'ADMIN') return false;

    const newUser: Usuario = {
      ...userData,
      id: crypto.randomUUID(), // Usar crypto.randomUUID() nativo
      createdAt: new Date().toISOString(),
    };

    setUsuarios(prev => [...prev, newUser]);
    return true;
  }, [usuario]);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    if (!usuario || usuario.rol !== 'ADMIN') return false;

    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    return true;
  }, [usuario]);

  const deleteUsuario = useCallback(async (id: string): Promise<boolean> => {
    if (!usuario || usuario.rol !== 'ADMIN') return false;
    if (id === usuario.id) return false; // No puede eliminarse a sí mismo

    setUsuarios(prev => prev.filter(u => u.id !== id));
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

// Hook para verificar permisos de forma más sencilla
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
