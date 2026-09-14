/**
 * Perfiles oficiales del login Dulce Placer.
 * El selector «¿Quién eres?» solo muestra estos (si están activos).
 */

import type { Usuario, UserRole } from '@/types';

const createdAt = '2026-08-10T00:00:00.000Z';

/** Emails permitidos en la pantalla de login (orden de aparición). */
export const EMAILS_LOGIN_OFICIALES: string[] = [
  'chalo8321@gmail.com',
  'gerente@dulceplacer.com',
  'panadero@dulceplacer.com',
  'vendedor.manana@dulceplacer.com',
  'vendedor.tarde@dulceplacer.com',
  'vendedor.noche@dulceplacer.com',
];

/**
 * PIN temporales (4 dígitos). El Director puede cambiarlos en Usuarios.
 * Admin (Chalo) conserva su contraseña actual si ya tiene una.
 */
export const USUARIOS_LOGIN_OFICIALES: Usuario[] = [
  {
    id: 'owner-local-id',
    email: 'Chalo8321@gmail.com',
    nombre: 'Administrador',
    apellido: 'Dulce Placer',
    rol: 'ADMIN',
    activo: true,
    createdAt,
  },
  {
    id: 'gerente-oficial-id',
    email: 'gerente@dulceplacer.com',
    nombre: 'Gerente',
    apellido: 'Dulce Placer',
    rol: 'GERENTE',
    activo: true,
    password: '2580',
    createdAt,
  },
  {
    id: 'panadero-oficial-id',
    email: 'panadero@dulceplacer.com',
    nombre: 'Panadero',
    apellido: 'Horno',
    rol: 'PANADERO',
    activo: true,
    password: '1357',
    createdAt,
  },
  {
    id: 'vendedor-manana-id',
    email: 'vendedor.manana@dulceplacer.com',
    nombre: 'Vendedor Mañana',
    apellido: 'Turno',
    rol: 'VENDEDOR',
    activo: true,
    password: '1111',
    createdAt,
  },
  {
    id: 'vendedor-tarde-id',
    email: 'vendedor.tarde@dulceplacer.com',
    nombre: 'Vendedor Tarde',
    apellido: 'Turno',
    rol: 'VENDEDOR',
    activo: true,
    password: '2222',
    createdAt,
  },
  {
    id: 'vendedor-noche-id',
    email: 'vendedor.noche@dulceplacer.com',
    nombre: 'Vendedor Noche',
    apellido: 'Turno',
    rol: 'VENDEDOR',
    activo: true,
    password: '3333',
    createdAt,
  },
];

/** Nombres (normalizados) que deben salir del login. */
const NOMBRES_A_INACTIVAR = [
  'dilia maria',
  'dilia johanna',
  'gabriela postventa',
  'gabriela',
  'johanna',
];

/** Emails viejos que también se desactivan. */
const EMAILS_A_INACTIVAR = [
  'dilia@dulceplacer.com',
  'dilía@dulceplacer.com',
  'dilia.maria@dulceplacer.com',
  'dilia.johanna@dulceplacer.com',
  'gabriela@dulceplacer.com',
  'gabriela.postventa@dulceplacer.com',
  'johanna@dulceplacer.com',
];

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const nombreCompleto = (u: Usuario) =>
  sinTildes(`${u.nombre || ''} ${u.apellido || ''}`.replace(/\s+/g, ' ').trim());

const debeInactivar = (u: Usuario): boolean => {
  const email = (u.email || '').toLowerCase().trim();
  if (EMAILS_LOGIN_OFICIALES.includes(email)) return false;
  if (EMAILS_A_INACTIVAR.includes(email)) return true;

  const full = nombreCompleto(u);
  const nom = sinTildes(u.nombre || '');

  // Coincidencias pedidas por el Director
  if (full.includes('dilia maria') || nom === 'dilia maria') return true;
  if (full.includes('dilia johanna') || nom === 'dilia johanna') return true;
  if (full.includes('gabriela postventa') || full === 'gabriela' || nom === 'gabriela') return true;
  // Johanna sola (no “Dilia Johanna”, ya cubierta arriba)
  if (nom === 'johanna' || full === 'johanna' || full.startsWith('johanna ')) return true;

  return NOMBRES_A_INACTIVAR.some((n) => full === n || nom === n);
};

const mergeOficial = (existente: Usuario | undefined, oficial: Usuario): Usuario => {
  if (!existente) return { ...oficial, activo: true };
  // Conservar password del admin si ya tenía una
  const password =
    oficial.rol === 'ADMIN' && existente.password
      ? existente.password
      : oficial.password ?? existente.password;
  return {
    ...existente,
    ...oficial,
    id: existente.id || oficial.id,
    password,
    activo: true,
    // Mantener avatar si el usuario ya tenía
    avatar: existente.avatar ?? oficial.avatar,
  };
};

/**
 * Asegura perfiles oficiales, inactiva los pedidos y deja lista lista para login.
 */
export const normalizarUsuariosLogin = (lista: Usuario[]): Usuario[] => {
  const byEmail = new Map<string, Usuario>();
  for (const u of lista) {
    if (!u?.email) continue;
    byEmail.set(u.email.toLowerCase().trim(), { ...u });
  }

  // Aplicar oficiales
  for (const oficial of USUARIOS_LOGIN_OFICIALES) {
    const key = oficial.email.toLowerCase().trim();
    byEmail.set(key, mergeOficial(byEmail.get(key), oficial));
  }

  // Inactivar antiguos
  for (const [key, u] of byEmail) {
    if (debeInactivar(u)) {
      byEmail.set(key, { ...u, activo: false });
    }
  }

  return Array.from(byEmail.values());
};

/** Orden del selector de login. */
export const ordenarUsuariosLogin = (usuarios: Usuario[]): Usuario[] => {
  const orden = new Map(EMAILS_LOGIN_OFICIALES.map((e, i) => [e, i]));
  return [...usuarios].sort((a, b) => {
    const ia = orden.get((a.email || '').toLowerCase()) ?? 999;
    const ib = orden.get((b.email || '').toLowerCase()) ?? 999;
    return ia - ib;
  });
};

export const esUsuarioLoginOficial = (u: Usuario): boolean =>
  EMAILS_LOGIN_OFICIALES.includes((u.email || '').toLowerCase().trim()) && u.activo === true;

export const etiquetaRolLogin = (rol: UserRole): string => {
  switch (rol) {
    case 'ADMIN':
      return 'Administrador';
    case 'GERENTE':
      return 'Gerente';
    case 'PANADERO':
      return 'Panadero';
    case 'VENDEDOR':
      return 'Vendedor';
    default:
      return rol;
  }
};
