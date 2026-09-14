/**
 * Acceso unificado — una sola libreta para usuarios del sistema.
 * Trabajadores, Seguridad/Roles y Usuarios usan este puente.
 */
import { generateUUID } from '@/lib/safe-utils';
import type { Trabajador, UserRole, Usuario } from '@/types';
import { normalizarUsuariosLogin } from '@/lib/usuarios-login-oficiales';
import {
  mergeUsersToLocalStorage,
  notifyUsuariosSync,
  pushUserToCloud,
  pullUsersFromCloud,
} from '@/lib/user-cloud-sync';

export const LOCAL_USERS_KEY = 'pricecontrol_local_user_list';
const VINCULOS_KEY = 'dp_trabajador_usuario_vinculos';

export const ROL_TRABAJADOR_A_SISTEMA: Record<Trabajador['rol'], UserRole> = {
  panadero: 'PANADERO',
  vendedor: 'VENDEDOR',
  cajero: 'VENDEDOR',
  repartidor: 'AUXILIAR',
  administrador: 'ADMIN',
  otro: 'AUXILIAR',
};

export function leerUsuariosLocales(): Usuario[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Usuario[]) : [];
  } catch {
    return [];
  }
}

export function guardarUsuariosLocales(lista: Usuario[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(lista));
  notifyUsuariosSync('local_save');
}

export function leerVinculosTrabajadorUsuario(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VINCULOS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function vincularTrabajadorUsuario(trabajadorId: string, usuarioId: string): void {
  const map = leerVinculosTrabajadorUsuario();
  map[trabajadorId] = usuarioId;
  localStorage.setItem(VINCULOS_KEY, JSON.stringify(map));
}

export function obtenerUsuarioDeTrabajador(
  trabajador: Trabajador,
  usuarios: Usuario[],
): Usuario | undefined {
  const vinculos = leerVinculosTrabajadorUsuario();
  const porVinculo = vinculos[trabajador.id]
    ? usuarios.find((u) => u.id === vinculos[trabajador.id])
    : undefined;
  if (porVinculo) return porVinculo;

  const email = (trabajador.email || '').toLowerCase().trim();
  if (email) {
    return usuarios.find((u) => (u.email || '').toLowerCase().trim() === email);
  }

  const username = trabajador.nombre.toLowerCase().replace(/\s+/g, '.');
  return usuarios.find((u) => (u.email || '').toLowerCase().trim() === username);
}

export function usuarioTieneAcceso(trabajador: Trabajador, usuarios: Usuario[]): boolean {
  const u = obtenerUsuarioDeTrabajador(trabajador, usuarios);
  return Boolean(u && u.activo);
}

export function emailSugeridoParaTrabajador(trabajador: Trabajador): string {
  const email = trabajador.email?.trim();
  if (email) return email.toLowerCase();
  return trabajador.nombre.toLowerCase().replace(/\s+/g, '.');
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/** Clave guardada como hash SHA-256 (versiones anteriores); no se puede mostrar el PIN original. */
export function esClaveEncriptadaSha256(clave: string | undefined): boolean {
  const normalizada = (clave || '').trim();
  return normalizada.length > 0 && SHA256_HEX.test(normalizada);
}

export function obtenerClaveUsuarioEnLibreta(usuarioId: string): string {
  const enLibreta = leerUsuariosLocales().find((u) => u.id === usuarioId);
  return (enLibreta?.password || '').trim();
}

/** PIN legible para el panel admin (texto plano en libreta local). */
export function claveLegibleParaAdmin(
  usuarioId: string,
  fallbackPassword?: string,
): { clave: string; eraEncriptada: boolean } {
  const stored = obtenerClaveUsuarioEnLibreta(usuarioId) || (fallbackPassword || '').trim();
  if (!stored) return { clave: '', eraEncriptada: false };
  if (esClaveEncriptadaSha256(stored)) return { clave: '', eraEncriptada: true };
  return { clave: stored, eraEncriptada: false };
}

/** Verifica PIN/contraseña contra la libreta local (oficial + custom). */
export async function verificarPinUsuario(
  email: string,
  pin: string,
): Promise<{ ok: true; usuario: Usuario } | { ok: false; error: string }> {
  const emailLower = email.toLowerCase().trim();
  const pinClean = pin.trim();

  let lista = leerUsuariosLocales();
  if (lista.length === 0) {
    return { ok: false, error: 'Usuario no registrado.' };
  }

  lista = normalizarUsuariosLogin(lista);
  const usuario = lista.find((u) => (u.email || '').toLowerCase().trim() === emailLower);
  if (!usuario) {
    return { ok: false, error: 'Usuario no registrado.' };
  }
  if (!usuario.activo) {
    return { ok: false, error: 'Usuario inactivo.' };
  }

  const stored = (usuario.password || '').trim();
  if (!stored) {
    return { ok: true, usuario };
  }

  let pinOk = false;
  if (esClaveEncriptadaSha256(stored)) {
    const { hashPassword } = await import('@/lib/safe-utils');
    pinOk = (await hashPassword(pinClean)) === stored;
  } else {
    pinOk = pinClean === stored;
  }

  if (!pinOk) {
    return { ok: false, error: 'Contraseña incorrecta.' };
  }
  return { ok: true, usuario };
}

/** Crea usuario + nube + vínculo trabajador (sin pasar por AuthContext). */
export async function crearAccesoParaTrabajador(
  trabajador: Trabajador,
  password: string,
): Promise<{ ok: true; usuario: Usuario } | { ok: false; error: string }> {
  const email = emailSugeridoParaTrabajador(trabajador);
  const lista = leerUsuariosLocales();
  const duplicado = lista.find((u) => (u.email || '').toLowerCase() === email);
  if (duplicado) {
    return { ok: false, error: `Ya existe un usuario con identificador "${email}".` };
  }

  const ahora = new Date().toISOString();
  const usuario: Usuario = {
    id: generateUUID(),
    email,
    nombre: trabajador.nombre.split(' ')[0] || trabajador.nombre,
    apellido: trabajador.nombre.split(' ').slice(1).join(' ') || '',
    rol: ROL_TRABAJADOR_A_SISTEMA[trabajador.rol],
    activo: true,
    password: password.trim(),
    createdAt: ahora,
    updatedAt: ahora,
  };

  lista.push(usuario);
  guardarUsuariosLocales(lista);
  vincularTrabajadorUsuario(trabajador.id, usuario.id);
  pushUserToCloud(usuario as unknown as Record<string, unknown>).catch(() => {});
  notifyUsuariosSync('trabajador_acceso_creado', usuario.id);
  return { ok: true, usuario };
}

/** Trae usuarios de Supabase y fusiona (LOCAL GANA salvo altas nuevas). */
export async function sincronizarUsuariosDesdeNube(): Promise<number> {
  const remotos = await pullUsersFromCloud();
  const cambios = mergeUsersToLocalStorage(remotos);
  if (cambios > 0) notifyUsuariosSync('pull_nube');
  return cambios;
}
