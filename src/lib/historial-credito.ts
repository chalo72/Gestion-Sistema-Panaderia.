/**
 * Historial de créditos y préstamos de trabajadoras (2026-11-18, pedido de Gonzalo).
 *
 * Cada crédito guarda quién lo anotó o cambió, desde qué aparato, fecha y hora, y cada
 * cobro o posposición de nómina. Así, si alguien dice "yo solo pedí $100.000", se ve
 * quién registró qué y cuándo.
 *
 * Y en Nómina (`clasificarCreditoNomina`): solo entra lo de la quincena, lo pospuesto a
 * propósito y los préstamos en curso. Lo viejo que nunca se cobró ni se pospuso NO se suma
 * solo: sale aparte para que Gonzalo decida.
 */

export type AccionHistorial = 'creado' | 'editado' | 'cobrado' | 'pospuesto' | 'cobrar_atrasado';

export interface EventoHistorial {
  id: string;
  fecha: string;          // ISO, con hora
  accion: AccionHistorial;
  usuario: string;        // nombre del usuario que lo hizo
  aparato: string;        // "Celular Android", "PC Windows"…
  detalle: string;        // texto para leer: "Préstamo $200.000", "monto $100.000 → $200.000"…
}

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `h-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Nombre corto del aparato, a partir del navegador. */
export const nombreAparato = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string => {
  const s = ua || '';
  if (/iPhone|iPad/i.test(s)) return 'iPhone';
  if (/Android/i.test(s)) {
    const modelo = /Android[^;]*;\s*([^;)]+?)\s*(?:Build|\))/i.exec(s)?.[1]?.trim();
    return modelo && !/^(wv|K|Linux)$/i.test(modelo) ? `Celular ${modelo}` : 'Celular Android';
  }
  if (/Windows/i.test(s)) return 'PC Windows';
  if (/Macintosh/i.test(s)) return 'Mac';
  if (/Linux/i.test(s)) return 'PC Linux';
  return 'Aparato desconocido';
};

/** Usuario que tiene la sesión abierta en este aparato. */
export const usuarioActual = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem('pricecontrol_local_user') || 'null');
    return String(u?.nombre || u?.email || 'Sin usuario').trim();
  } catch {
    return 'Sin usuario';
  }
};

export const nuevoEvento = (accion: AccionHistorial, detalle: string, fecha: Date = new Date()): EventoHistorial => ({
  id: uid(),
  fecha: fecha.toISOString(),
  accion,
  usuario: usuarioActual(),
  aparato: nombreAparato(),
  detalle,
});

const lista = (h: unknown): EventoHistorial[] => (Array.isArray(h) ? (h as EventoHistorial[]).filter(e => e && e.id) : []);

/** Une dos historiales sin repetir (por id) y ordenados por fecha. Ningún aparato pierde eventos. */
export const unirHistorial = (a: unknown, b: unknown): EventoHistorial[] => {
  const m = new Map<string, EventoHistorial>();
  for (const e of [...lista(a), ...lista(b)]) m.set(e.id, e);
  return [...m.values()].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
};

/** ¿`local` tiene eventos que `remoto` no tiene? (entonces hay que subirlo) */
export const tieneEventosNuevos = (local: unknown, remoto: unknown): boolean => {
  const ids = new Set(lista(remoto).map(e => e.id));
  return lista(local).some(e => !ids.has(e.id));
};

export const conEvento = <T extends { historial?: unknown }>(c: T, e: EventoHistorial): T =>
  ({ ...c, historial: unirHistorial(c.historial, [e]) });

const pesos = (n: unknown) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/** Texto del evento "creado". */
export const detalleCreado = (c: { tipo?: string; monto?: number; descripcion?: string; trabajadorNombre?: string }): string =>
  `${c.tipo === 'prestamo' ? 'Préstamo' : 'Consumo'} ${pesos(c.monto)}${c.descripcion ? ` · ${c.descripcion}` : ''}${c.trabajadorNombre ? ` · a ${String(c.trabajadorNombre).trim()}` : ''}`;

/** Qué cambió (solo lo que importa para reclamar): monto, descripción, tipo, trabajadora. '' si nada. */
export const detalleCambios = (antes: Record<string, any>, despues: Record<string, any>): string => {
  const cambios: string[] = [];
  if (despues.monto !== undefined && Number(despues.monto) !== Number(antes.monto)) cambios.push(`monto ${pesos(antes.monto)} → ${pesos(despues.monto)}`);
  if (despues.descripcion !== undefined && String(despues.descripcion ?? '') !== String(antes.descripcion ?? '')) cambios.push(`descripción "${antes.descripcion ?? ''}" → "${despues.descripcion ?? ''}"`);
  if (despues.tipo !== undefined && despues.tipo !== antes.tipo) cambios.push(`tipo ${antes.tipo ?? 'consumo'} → ${despues.tipo}`);
  if (despues.trabajadorId !== undefined && despues.trabajadorId !== antes.trabajadorId) cambios.push(`trabajadora ${String(antes.trabajadorNombre ?? '').trim()} → ${String(despues.trabajadorNombre ?? '').trim()}`);
  return cambios.join(' · ');
};

// ── Nómina: qué entra en la quincena ──

export type ClaseCreditoNomina =
  | 'quincena'          // anotado dentro de esta quincena
  | 'pospuesto'         // pospuesto a propósito para esta quincena (o antes)
  | 'en_curso'          // préstamo/crédito que ya tuvo movimientos de nómina (cuotas)
  | 'pospuesto_futuro'  // pospuesto para una quincena que todavía no llega
  | 'atrasado'          // de una quincena pasada, sin cobro ni posposición: NO se suma solo
  | 'futuro';           // anotado después de esta quincena

export interface MovimientoNomina { monto?: number; cobrada?: boolean; nota?: string; fecha?: string; posponerHasta?: string }

/** Fecha (YYYY-MM-DD) en que se anotó el crédito. */
const diaDe = (c: { fecha?: string; createdAt?: string }): string => String(c.fecha || c.createdAt || '').slice(0, 10);

/** Última posposición registrada en los movimientos del crédito. */
export const ultimaPosposicion = (pagos: unknown): MovimientoNomina | undefined =>
  (Array.isArray(pagos) ? (pagos as MovimientoNomina[]) : [])
    .filter(p => p && p.posponerHasta)
    .sort((a, b) => String(a.posponerHasta).localeCompare(String(b.posponerHasta)))
    .pop();

export const clasificarCreditoNomina = (
  c: { fecha?: string; createdAt?: string; pagos?: unknown },
  rango: { inicio: string; fin: string },
): ClaseCreditoNomina => {
  const dia = diaDe(c);
  if (dia && dia > rango.fin) return 'futuro';
  const pos = ultimaPosposicion(c.pagos);
  if (pos?.posponerHasta) return pos.posponerHasta > rango.fin ? 'pospuesto_futuro' : 'pospuesto';
  if (!dia || dia >= rango.inicio) return 'quincena';
  const movimientos = Array.isArray(c.pagos) ? (c.pagos as MovimientoNomina[]).filter(p => !String(p?.nota || '').startsWith('cuota:')) : [];
  return movimientos.length > 0 ? 'en_curso' : 'atrasado';
};

/** ¿Se suma solo en la nómina de este rango? */
export const entraSoloEnNomina = (clase: ClaseCreditoNomina): boolean =>
  clase === 'quincena' || clase === 'pospuesto' || clase === 'en_curso';
