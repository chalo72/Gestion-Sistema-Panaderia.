import { fechaLocalHoy } from '@/lib/finanzas-personales';

/** Convierte un Date del navegador a YYYY-MM-DD en calendario local. */
export function fechaCalendarioLocalDesdeDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fechaCalendarioLocalDesdeISO(fecha: string | undefined | null): string {
  if (!fecha || typeof fecha !== 'string') return '';
  const trimmed = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ¿La fecha cae en el día de hoy (calendario local)? */
export function esMismoDiaLocal(fecha: string | undefined | null): boolean {
  const dia = fechaCalendarioLocalDesdeISO(fecha);
  return dia.length > 0 && dia === fechaLocalHoy();
}

/** Filtra ventas/gastos del día local. */
export function filtrarRegistrosDelDiaLocal<T extends { fecha?: string | null }>(items: T[]): T[] {
  const hoy = fechaLocalHoy();
  return items.filter((item) => fechaCalendarioLocalDesdeISO(item.fecha) === hoy);
}

/** ¿La fecha cae en el rango inclusivo [inicio, fin] (YYYY-MM-DD local)? */
export function estaEnRangoCalendarioLocal(
  fecha: string | undefined | null,
  inicio: string,
  fin: string,
): boolean {
  const dia = fechaCalendarioLocalDesdeISO(fecha);
  if (!dia) return false;
  return dia >= inicio && dia <= fin;
}
