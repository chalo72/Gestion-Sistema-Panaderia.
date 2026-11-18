import type { Trabajador, RegistroAsistencia } from '@/types';

/**
 * Pantalla Turno / Asistencia (2026-11-17).
 * Antes la lista de trabajadoras llegaba al final de una carga larga (21 listas, todas
 * las ventas…). Mientras tanto, o si algo en esa cadena fallaba, la pantalla decía
 * "No hay trabajadoras activas". Ahora la pantalla lee lo suyo directo y une las dos fuentes.
 */

/** Activa aunque esté escrito "Activo", " activo " o "ACTIVO". */
export const esTrabajadoraActiva = (t: Pick<Trabajador, 'estado'> | null | undefined): boolean =>
  String(t?.estado ?? '').trim().toLowerCase() === 'activo';

/** Une las listas por id (sin repetir). La primera fuente manda si el mismo id está en ambas. */
export const unirPorId = <T extends { id: string }>(principal: T[], extra: T[]): T[] => {
  const mapa = new Map<string, T>();
  for (const x of extra) if (x?.id) mapa.set(x.id, x);
  for (const x of principal) if (x?.id) mapa.set(x.id, x);
  return Array.from(mapa.values());
};

/** Trabajadoras activas, sin repetir, ordenadas por nombre. */
export const trabajadorasActivas = (principal: Trabajador[], extra: Trabajador[]): Trabajador[] =>
  unirPorId(principal, extra)
    .filter(esTrabajadoraActiva)
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

export const unirAsistencia = (principal: RegistroAsistencia[], extra: RegistroAsistencia[]): RegistroAsistencia[] =>
  unirPorId(principal, extra);
