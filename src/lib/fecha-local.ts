/**
 * Fechas en hora de Colombia (2026-10-12, AUTORIZO Gonzalo).
 *
 * `new Date().toISOString().split('T')[0]` da la fecha en hora UTC: en Colombia (UTC-5),
 * desde las 7 pm ya devuelve el día SIGUIENTE. Estas funciones dan la fecha local.
 * (2026-11-16: unidas la versión publicada y la de main; mismas reglas.)
 */

/** Fecha local YYYY-MM-DD de un momento (Date, número o texto ISO). Un texto que ya es
 *  solo fecha ("2026-10-11") se devuelve igual, sin moverlo de día. */
export function ymdLocal(x: Date | string | number | null | undefined): string {
    if (x == null || x === '') return '';
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
    const d = x instanceof Date ? x : new Date(x);
    if (!Number.isFinite(d.getTime())) return typeof x === 'string' ? x.slice(0, 10) : '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hoy (fecha local YYYY-MM-DD). */
export const hoyLocal = (): string => ymdLocal(new Date());

/** Igual que hoyLocal (nombre usado en caja/ventas de main). */
export const hoyLocalYMD = hoyLocal;

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
