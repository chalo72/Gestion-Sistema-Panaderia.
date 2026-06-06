import { generateUUID } from '@/lib/safe-utils';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Usuario, UserRole, Permission } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';
import { USUARIOS_PRUEBA, EMAILS_USUARIOS_LEGACY } from '@/lib/seed-data';
import { supabase } from '@/lib/supabase';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, doc as fbDoc, setDoc, deleteDoc } from 'firebase/firestore';
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

// Serializa un Usuario a un objeto compatible con Firestore (sin campos undefined)
const toFirestoreDoc = (u: Usuario): Record<string, unknown> => {
  const d: Record<string, unknown> = {
    id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
    activo: u.activo, createdAt: u.createdAt,
  };
  if (u.apellido !== undefined) d.apellido = u.apellido;
  if (u.password !== undefined) d.password = u.password;
  if (u.avatar !== undefined) d.avatar = u.avatar;
  if (u.ultimoAcceso !== undefined) d.ultimoAcceso = u.ultimoAcceso;
  if (u.updatedAt !== undefined) d.updatedAt = u.updatedAt;
  return d;
};

// PROTEGIDO: No modificar sin revisión. Contexto de autenticación validado y crítico para acceso seguro.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const loadUsuarios = useCallback(async () => {
    try {
      // 1. Carga instantánea desde localStorage
      const savedStr = localStorage.getItem('pricecontrol_local_user_list');
      let savedLocales: Usuario[] = [];
      try {
        savedLocales = savedStr ? JSON.parse(savedStr) : [];
      } catch { savedLocales = []; }

      // Eliminar solo usuarios genéricos de prueba, conservar TODOS los usuarios reales del negocio
      const legacyEmails = new Set(EMAILS_USUARIOS_LEGACY.map(e => e.toLowerCase()));
      let baseList: Usuario[] = savedLocales.filter(
        (u: Usuario) => !legacyEmails.has((u.email || '').toLowerCase())
      );

      // Si no quedó nada (localStorage vacío o primer uso), partir de la lista base mínima
      if (baseList.length === 0) baseList = [...USUARIOS_PRUEBA];

      // Asegurar que los usuarios base siempre estén presentes (sin duplicar)
      USUARIOS_PRUEBA.forEach(up => {
        if (!baseList.some(u => u.email.toLowerCase() === up.email.toLowerCase())) baseList.push(up);
      });

      setUsuarios(baseList);
      localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(baseList));

      // 2. Sincronizar con Firebase Firestore (nube — en segundo plano, solo si disponible)
      if (firestore) {
        try {
          const snapshot = await getDocs(collection(firestore, 'usuarios_sistema'));
          // Filtrar usuarios legacy de la nube también
          const cloudUsers: Usuario[] = snapshot.docs
            .map(d => d.data() as Usuario)
            .filter(u => !legacyEmails.has((u.email || '').toLowerCase()));

          // Re-leer localStorage DESPUÉS del await para capturar usuarios creados durante la espera
          let freshLocalList: Usuario[] = baseList;
          try {
            const freshStr = localStorage.getItem('pricecontrol_local_user_list');
            if (freshStr) {
              const parsed: Usuario[] = JSON.parse(freshStr);
              if (Array.isArray(parsed) && parsed.length > 0) freshLocalList = parsed;
            }
          } catch { /* usar baseList como fallback */ }

          // FUSIÓN INTELIGENTE: El más reciente gana (basado en updatedAt)
          const mergedMap = new Map<string, Usuario>();

          // Primero cargamos lo local
          freshLocalList.forEach(u => mergedMap.set(u.email.toLowerCase(), u));

          // Luego fusionamos con la nube si es más reciente o el usuario no existe localmente
          cloudUsers.forEach(cloudUser => {
            const emailKey = cloudUser.email.toLowerCase();
            const localUser = mergedMap.get(emailKey);

            if (!localUser) {
              mergedMap.set(emailKey, cloudUser);
            } else {
              // Comparar fechas de actualización si existen
              const cloudUpdate = cloudUser.updatedAt ? new Date(cloudUser.updatedAt).getTime() : 0;
              const localUpdate = localUser.updatedAt ? new Date(localUser.updatedAt).getTime() : 0;

              if (cloudUpdate >= localUpdate) {
                mergedMap.set(emailKey, cloudUser);
              }
            }
          });

          // Los usuarios base siempre presentes
          USUARIOS_PRUEBA.forEach(up => {
            if (!mergedMap.has(up.email.toLowerCase())) mergedMap.set(up.email.toLowerCase(), up);
          });
          const merged = Array.from(mergedMap.values());

          // Migración resiliente: cada usuario se intenta individualmente, sin abortar en error
          const cloudEmailsAll = new Set(snapshot.docs.map(d => (d.data().email || '').toLowerCase()));
          const toMigrate = baseList.filter(u =>
            !cloudEmailsAll.has(u.email.toLowerCase()) && !legacyEmails.has(u.email.toLowerCase())
          );
          let migrados = 0;
          for (const u of toMigrate) {
            try {
              await setDoc(fbDoc(firestore, 'usuarios_sistema', u.id), toFirestoreDoc(u));
              migrados++;
            } catch {
              // Si falla un usuario, continuar con el siguiente
            }
          }
          if (migrados > 0) console.log(`☁️ [Auth] ${migrados} usuario(s) migrado(s) a la nube.`);

          // Siempre actualizar la UI con la lista fusionada, aunque la migración haya fallado parcialmente
          setUsuarios(merged);
          localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(merged));
          console.log(`✅ [Auth] ${merged.length} usuarios disponibles (local + nube).`);
        } catch (cloudErr) {
          console.warn('⚠️ [Auth] Firestore no disponible, modo local activo:', cloudErr);
        }
      }
    } catch (e) {
      console.error('❌ Error cargando usuarios:', e);
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
        let currentUser: Usuario | null = null;

        if (savedLocalUser) {
          const userData = JSON.parse(savedLocalUser) as Usuario;
          // Sesión permanente — solo el admin desactiva al usuario manualmente
          currentUser = userData;
        }

        // No hay sesión guardada → el usuario deberá iniciar sesión manualmente

        if (currentUser) {
          setUsuario(currentUser);
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
    await new Promise(resolve => setTimeout(resolve, 300));

    const emailLower = email.toLowerCase().trim();

    // Cargar lista de usuarios — triple fallback para máxima resiliencia
    let localUserList: Usuario[] = [...USUARIOS_PRUEBA];
    try {
      const localUserListStr = localStorage.getItem('pricecontrol_local_user_list');
      if (localUserListStr) {
        const parsed: Usuario[] = JSON.parse(localUserListStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localUserList = parsed;
          // Asegurar que siempre estén los usuarios oficiales
          USUARIOS_PRUEBA.forEach(up => {
            if (!localUserList.some(u => u.email.toLowerCase() === up.email.toLowerCase())) {
              localUserList.push(up);
            }
          });
        }
      }
    } catch {
      console.warn('[Login] localStorage corrupto — usando lista base segura');
      localUserList = [...USUARIOS_PRUEBA];
    }

    // Buscar usuario por email
    let userToAuth = localUserList.find(u => (u.email || '').toLowerCase().trim() === emailLower);

    // Si no está local o si la contraseña falla, intentamos refrescar desde la nube
    const passwordClean = password.trim();
    const isPasswordCorrect = (u: Usuario) => u.password ? passwordClean === u.password.trim() : true;

    if ((!userToAuth || !isPasswordCorrect(userToAuth)) && firestore) {
      try {
        console.log(`[Login] ${!userToAuth ? 'No encontrado local' : 'Contraseña local incorrecta'} — buscando/refrescando desde nube...`);
        const snapshot = await getDocs(collection(firestore, 'usuarios_sistema'));
        const cloudUser = snapshot.docs
          .map(d => d.data() as Usuario)
          .find(u => (u.email || '').toLowerCase().trim() === emailLower);

        if (cloudUser) {
          // Actualizar lista local con la versión de la nube
          const updatedList = userToAuth
            ? localUserList.map(u => u.email.toLowerCase() === emailLower ? cloudUser : u)
            : [...localUserList, cloudUser];

          localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(updatedList));
          setUsuarios(updatedList);
          userToAuth = cloudUser;
          console.log(`[Login] Usuario "${emailLower}" actualizado desde la nube.`);
        }
      } catch (e) {
        console.warn('[Login] Firebase no disponible para validación en tiempo real:', e);
      }
    }

    if (!userToAuth) {
      setIsLoading(false);
      console.warn(`[Login] Usuario no encontrado: "${emailLower}".`);
      toast.error('No existe un usuario con ese identificador.');
      return { success: false, error: 'Usuario no registrado.' };
    }

    if (!userToAuth.activo) {
      setIsLoading(false);
      toast.error('Este usuario está desactivado.');
      return { success: false, error: 'Usuario inactivo.' };
    }

    if (!isPasswordCorrect(userToAuth)) {
      setIsLoading(false);
      console.warn(`[Login] Contraseña incorrecta definitiva para: "${emailLower}"`);
      toast.error('Contraseña incorrecta.');
      return { success: false, error: 'Contraseña incorrecta.' };
    }

    // ✅ Login exitoso
    const userData = { ...userToAuth, ultimoAcceso: new Date().toISOString() };
    setUsuario(userData);
    localStorage.setItem('pricecontrol_local_user', JSON.stringify(userData));
    setIsLoading(false);
    toast.success(`¡Bienvenido, ${localUser.nombre}!`);
    return { success: true };
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
    const now = new Date().toISOString();
    const nuevo: Usuario = { ...userData, id: generateUUID(), createdAt: now, updatedAt: now };
    const newList = [...usuarios, nuevo];
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    if (firestore) {
      try {
        await setDoc(fbDoc(firestore, 'usuarios_sistema', nuevo.id), toFirestoreDoc(nuevo));
        console.log(`☁️ [Auth] Usuario "${nuevo.email}" guardado en la nube.`);
      } catch (e) {
        console.warn('⚠️ [Auth] No se pudo guardar en nube (guardado localmente):', e);
      }
    }
    toast.success('Usuario guardado');
    return true;
  }, [usuarios]);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    const now = new Date().toISOString();
    const newList = usuarios.map(u => u.id === id ? { ...u, ...updates, updatedAt: now } : u);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    if (usuario && id === usuario.id) {
      const updatedMe = { ...usuario, ...updates };
      setUsuario(updatedMe);
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(updatedMe));
    }
    if (firestore) {
      try {
        const updated = newList.find(u => u.id === id);
        if (updated) await setDoc(fbDoc(firestore, 'usuarios_sistema', id), toFirestoreDoc(updated));
      } catch (e) {
        console.warn('⚠️ [Auth] No se pudo actualizar en nube:', e);
      }
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
    if (firestore) {
      try {
        await deleteDoc(fbDoc(firestore, 'usuarios_sistema', id));
      } catch (e) {
        console.warn('⚠️ [Auth] No se pudo eliminar de nube:', e);
      }
    }
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
