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

export type EstadoLlegada = 'sin-llegar' | 'adentro' | 'salio';

/**
 * Cómo está hoy una trabajadora (2026-11-17, pedido de Gonzalo):
 * - 'sin-llegar': no ha presionado "Llegué" → aviso.
 * - 'adentro': ya llegó → tarjeta verde y "Llegué" bloqueado en TODOS los aparatos.
 * - 'salio': presionó "Me voy".
 */
export const estadoDelDia = (
  registros: RegistroAsistencia[],
  trabajadorId: string,
  hoy: string,
): { estado: EstadoLlegada; ultimo?: RegistroAsistencia; llegada?: RegistroAsistencia } => {
  const delDia = registros
    .filter(r => r.trabajadorId === trabajadorId && r.fecha === hoy)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  if (delDia.length === 0) return { estado: 'sin-llegar' };
  const ultimo = delDia[delDia.length - 1];
  const llegada = [...delDia].reverse().find(r => r.tipo === 'entrada');
  return { estado: ultimo.tipo === 'entrada' ? 'adentro' : 'salio', ultimo, llegada };
};

/**
 * Hora local del registro. La nube devolvía la hora en UTC ("12:05" en vez de "07:05"),
 * así que si hay fecha de creación se usa esa, convertida a la hora del aparato.
 */
export const horaLocalDeRegistro = (r: Pick<RegistroAsistencia, 'hora' | 'createdAt'> | undefined): string => {
  if (!r) return '';
  const d = r.createdAt ? new Date(r.createdAt) : null;
  if (d && Number.isFinite(d.getTime())) {
    return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return r.hora || '';
};
