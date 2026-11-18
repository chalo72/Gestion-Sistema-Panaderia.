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

// ── Doble turno automático (2026-11-18, decidido por Gonzalo) ──
// Cuenta como doble turno el día en que la trabajadora marcó "Llegué" en la mañana
// Y otra vez desde las 2:00 p. m. (turno de la tarde). Una salida y vuelta dentro de la
// misma mañana (almuerzo) NO cuenta doble.

/** Hora (en horas, hora del aparato) desde la que empieza el turno de la tarde. */
export const HORA_INICIO_TARDE = 14;

/** Hora decimal local de un registro (7.5 = 7:30). Usa createdAt; si no, el texto "HH:mm". */
export const horaDecimal = (r: Pick<RegistroAsistencia, 'hora' | 'createdAt'> | undefined): number | null => {
  if (!r) return null;
  const d = r.createdAt ? new Date(r.createdAt) : null;
  if (d && Number.isFinite(d.getTime())) return d.getHours() + d.getMinutes() / 60;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(r.hora || ''));
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};

export const esDeLaTarde = (r: Pick<RegistroAsistencia, 'hora' | 'createdAt'>): boolean => {
  const h = horaDecimal(r);
  return h !== null && h >= HORA_INICIO_TARDE;
};

/** Llegadas del día separadas en mañana y tarde. */
export const llegadasDelDia = (registros: RegistroAsistencia[], trabajadorId: string, fecha: string) => {
  const entradas = registros.filter(r => r.trabajadorId === trabajadorId && r.fecha === fecha && r.tipo === 'entrada');
  return {
    manana: entradas.filter(r => !esDeLaTarde(r)),
    tarde: entradas.filter(r => esDeLaTarde(r)),
  };
};

export const esDobleTurno = (registros: RegistroAsistencia[], trabajadorId: string, fecha: string): boolean => {
  const { manana, tarde } = llegadasDelDia(registros, trabajadorId, fecha);
  return manana.length > 0 && tarde.length > 0;
};

/** Días (YYYY-MM-DD) del listado en que hizo doble turno, ordenados. */
export const diasDobleTurnoDe = (registros: RegistroAsistencia[], trabajadorId: string, fechas: string[]): string[] =>
  fechas.filter(f => esDobleTurno(registros, trabajadorId, f)).sort();

/**
 * ¿Puede marcar ahora el turno de la tarde? Llegó en la mañana, ya son las 2:00 p. m.
 * o más, y todavía no marcó la tarde.
 */
export const puedeMarcarTarde = (
  registros: RegistroAsistencia[], trabajadorId: string, fecha: string, ahora: Date = new Date(),
): boolean => {
  const { manana, tarde } = llegadasDelDia(registros, trabajadorId, fecha);
  return manana.length > 0 && tarde.length === 0 && ahora.getHours() + ahora.getMinutes() / 60 >= HORA_INICIO_TARDE;
};
