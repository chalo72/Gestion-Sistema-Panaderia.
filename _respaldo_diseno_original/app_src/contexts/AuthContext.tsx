import { generateUUID } from '@/lib/safe-utils';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Usuario, UserRole, Permission } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';
import { USUARIOS_PRUEBA, EMAILS_USUARIOS_LEGACY } from '@/lib/seed-data';
import { normalizarUsuariosLogin } from '@/lib/usuarios-login-oficiales';
import { verificarPinUsuario } from '@/lib/acceso-unificado';
import { registrarEventoLogin } from '@/lib/login-auditoria';
import { supabase } from '@/lib/supabase';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, doc as fbDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { pushUserToCloud, deleteUserFromCloud, USUARIOS_SYNC_EVENT } from '@/lib/user-cloud-sync';
import {
  pushPermisoBlob,
  PERMISSIONS_KEY,
  PERMISOS_SYNC_EVENT,
  shouldSkipPermisoPush,
} from '@/lib/permisos-cloud-sync';

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
    activo: u.activo,
  };
  // createdAt puede faltar en usuarios viejos — Firestore rechaza setDoc() si el campo queda en `undefined`
  if (u.createdAt !== undefined) d.createdAt = u.createdAt;
  if (u.apellido !== undefined) d.apellido = u.apellido;
  if (u.password !== undefined) d.password = u.password;
  if (u.avatar !== undefined) d.avatar = u.avatar;
  if (u.ultimoAcceso !== undefined) d.ultimoAcceso = u.ultimoAcceso;
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

      // Asegurar oficiales + inactivar Dilias/Gabriela/Johanna (pedido del Director)
      baseList = normalizarUsuariosLogin(baseList);

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

          // LOCAL SIEMPRE GANA: nube solo agrega usuarios que no existen localmente
          const mergedMap = new Map<string, Usuario>();
          const deletedUsers: string[] = JSON.parse(localStorage.getItem('pricecontrol_deleted_users') || '[]');
          
          cloudUsers.forEach(u => {
            if (!deletedUsers.includes(u.id)) {
              mergedMap.set(u.email.toLowerCase(), u);
            }
          }); // nube - prioridad baja
          freshLocalList.forEach(u => mergedMap.set(u.email.toLowerCase(), u)); // local gana siempre
          let merged = normalizarUsuariosLogin(Array.from(mergedMap.values()));

          // Subir a la nube en segundo plano (no bloquear carga local)
          for (const u of merged) {
            setDoc(fbDoc(firestore, 'usuarios_sistema', u.id), toFirestoreDoc(u), { merge: true }).catch(() => {});
          }

          setUsuarios(merged);
          localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(merged));
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

    const onUsuariosSync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reason?: string }>).detail;
      const reason = detail?.reason ?? '';
      // Cambios locales ya están en estado — no recargar desde Firebase (evita cuelgue)
      if (reason === 'bootstrap') {
        try {
          const raw = localStorage.getItem('pricecontrol_local_user_list');
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setUsuarios(normalizarUsuariosLogin(parsed as Usuario[]));
            }
          }
        } catch { /* ignore */ }
        return;
      }
      if (
        reason === 'add_local' ||
        reason === 'update_local' ||
        reason === 'local_save' ||
        reason.startsWith('trabajador_')
      ) {
        return;
      }
      if (reason === 'pull_nube') {
        try {
          const raw = localStorage.getItem('pricecontrol_local_user_list');
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setUsuarios(normalizarUsuariosLogin(parsed as Usuario[]));
            }
          }
        } catch { /* ignore */ }
        return;
      }
      loadUsuarios();
    };
    window.addEventListener(USUARIOS_SYNC_EVENT, onUsuariosSync);
    return () => {
      mounted = false;
      window.removeEventListener(USUARIOS_SYNC_EVENT, onUsuariosSync);
    };
  }, [loadUsuarios]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const emailLower = email.toLowerCase().trim();
    const verificacion = await verificarPinUsuario(emailLower, password);

    if (!verificacion.ok) {
      console.warn(`[Login] ${verificacion.error}: "${emailLower}"`);
      if (verificacion.error === 'Usuario no registrado.') {
        registrarEventoLogin({
          tipo: 'login_fallo',
          email: emailLower,
          exito: false,
          motivo: 'Usuario no registrado',
        });
        toast.error('No existe un usuario con ese identificador.');
      } else if (verificacion.error === 'Usuario inactivo.') {
        registrarEventoLogin({
          tipo: 'login_fallo',
          email: emailLower,
          exito: false,
          motivo: 'Usuario inactivo',
        });
        toast.error('Este usuario está desactivado. Contacta al administrador.');
      } else {
        registrarEventoLogin({
          tipo: 'login_fallo',
          email: emailLower,
          exito: false,
          motivo: 'Contraseña incorrecta',
        });
        toast.error('Contraseña incorrecta.');
      }
      return { success: false, error: verificacion.error };
    }

    const localUser = verificacion.usuario;
    const ahora = new Date().toISOString();
    const userData = { ...localUser, ultimoAcceso: ahora };
    setUsuario(userData);
    localStorage.setItem('pricecontrol_local_user', JSON.stringify(userData));

    let localUserList: Usuario[] = [];
    try {
      const raw = localStorage.getItem('pricecontrol_local_user_list');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) localUserList = parsed as Usuario[];
      }
    } catch { /* ignore */ }

    const listaActualizada = localUserList.map((u) =>
      u.id === localUser.id ? { ...u, ultimoAcceso: ahora } : u,
    );
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(listaActualizada));
    setUsuarios(normalizarUsuariosLogin(listaActualizada));

    registrarEventoLogin({
      tipo: 'login_ok',
      email: emailLower,
      exito: true,
      usuarioId: localUser.id,
      nombre: localUser.nombre,
      rol: localUser.rol,
    });

    toast.success(`¡Bienvenido, ${localUser.nombre}!`);
    return { success: true };
  }, []);


  const logout = useCallback(async () => {
    const actual = usuario;
    if (actual) {
      registrarEventoLogin({
        tipo: 'logout',
        email: actual.email,
        exito: true,
        usuarioId: actual.id,
        nombre: actual.nombre,
        rol: actual.rol,
      });
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Error no critico: la sesion local se cierra igualmente
      console.warn('⚠️ [Auth] Error al cerrar sesion en Supabase (ignorado):', e);
    }
    localStorage.removeItem('pricecontrol_local_user');
    setUsuario(null);
  }, [usuario]);

  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(() => {
    const saved = localStorage.getItem('pricecontrol_permissions');
    return saved ? JSON.parse(saved) : ROLE_PERMISSIONS;
  });
  const skipPermisosPushRef = useRef(true);

  useEffect(() => {
    localStorage.setItem('pricecontrol_permissions', JSON.stringify(rolePermissions));
    if (skipPermisosPushRef.current) {
      skipPermisosPushRef.current = false;
      return;
    }
    if (shouldSkipPermisoPush()) return;
    pushPermisoBlob(PERMISSIONS_KEY, rolePermissions).catch(() => {});
  }, [rolePermissions]);

  useEffect(() => {
    const recargarPermisos = () => {
      try {
        const saved = localStorage.getItem('pricecontrol_permissions');
        if (saved) {
          skipPermisosPushRef.current = true;
          setRolePermissions(JSON.parse(saved) as Record<UserRole, Permission[]>);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener(PERMISOS_SYNC_EVENT, recargarPermisos);
    window.addEventListener('dp_permissions_changed', recargarPermisos);
    return () => {
      window.removeEventListener(PERMISOS_SYNC_EVENT, recargarPermisos);
      window.removeEventListener('dp_permissions_changed', recargarPermisos);
    };
  }, []);

  const updateRolePermissions = useCallback((role: UserRole, newPermissions: Permission[]) => {
    setRolePermissions(prev => ({ ...prev, [role]: newPermissions }));
  }, []);

  const resetPermissions = useCallback(() => {
    setRolePermissions(ROLE_PERMISSIONS);
    localStorage.removeItem('pricecontrol_permissions');
    pushPermisoBlob(PERMISSIONS_KEY, ROLE_PERMISSIONS).catch(() => {});
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
    const ahora = new Date().toISOString();
    const nuevo: Usuario = { ...userData, id: generateUUID(), createdAt: ahora, updatedAt: ahora };
    const newList = [...usuarios, nuevo];
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    pushUserToCloud(nuevo as unknown as Record<string, unknown>).catch(() => {});
    if (firestore) {
      setDoc(fbDoc(firestore, 'usuarios_sistema', nuevo.id), toFirestoreDoc(nuevo)).catch((e) => {
        console.warn('⚠️ [Auth] No se pudo guardar en nube (guardado localmente):', e);
      });
    }
    window.dispatchEvent(new CustomEvent(USUARIOS_SYNC_EVENT, { detail: { reason: 'add_local' } }));
    toast.success('Usuario guardado');
    return true;
  }, [usuarios]);

  const updateUsuario = useCallback(async (id: string, updates: Partial<Usuario>): Promise<boolean> => {
    const ahora = new Date().toISOString();
    const newList = usuarios.map(u => u.id === id ? { ...u, ...updates, updatedAt: ahora } : u);
    setUsuarios(newList);
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify(newList));
    if (usuario && id === usuario.id) {
      const updatedMe = { ...usuario, ...updates, updatedAt: ahora };
      setUsuario(updatedMe);
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(updatedMe));
    }
    const updated = newList.find(u => u.id === id);
    if (updated) pushUserToCloud(updated as unknown as Record<string, unknown>).catch(() => {});
    if (firestore && updated) {
      setDoc(fbDoc(firestore, 'usuarios_sistema', id), toFirestoreDoc(updated)).catch((e) => {
        console.warn('⚠️ [Auth] No se pudo actualizar en nube:', e);
      });
    }
    window.dispatchEvent(new CustomEvent(USUARIOS_SYNC_EVENT, { detail: { reason: 'update_local', userId: id } }));
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
    deleteUserFromCloud(id).catch(() => {});
    
    // Add to tombstones to prevent zombies from cloud
    const deletedUsers = JSON.parse(localStorage.getItem('pricecontrol_deleted_users') || '[]');
    if (!deletedUsers.includes(id)) {
      deletedUsers.push(id);
      localStorage.setItem('pricecontrol_deleted_users', JSON.stringify(deletedUsers));
    }

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
