/**
 * Fechas en calendario LOCAL (Colombia, UTC-5).
 * `toISOString().slice(0, 10)` devuelve el día en UTC: desde las 7 p. m. locales ya es "mañana",
 * y las ventas/cajas de la tarde caían en el día equivocado.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** YYYY-MM-DD del calendario local para una fecha dada. */
export const ymdLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** YYYY-MM-DD de hoy en calendario local. */
export const hoyLocalYMD = (): string => ymdLocal(new Date());

/**
 * Día local (YYYY-MM-DD) de un instante guardado como ISO (p. ej. fechaApertura/fechaCierre).
 * Si ya viene como YYYY-MM-DD sin hora, se respeta tal cual. Devuelve '' si no es una fecha válida.
 */
export const ymdLocalDeISO = (iso: string | undefined | null): string => {
  if (!iso || typeof iso !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : ymdLocal(d);
};
