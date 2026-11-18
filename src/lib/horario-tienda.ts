// Horario rotativo de la tienda.
// Lunes a viernes: una persona fija en la mañana y dos fijas en la tarde.
// El apoyo de fin de semana entra sábado y domingo para que las otras tres
// descansen un fin de semana completo cada una, en un ciclo de 3 semanas.
// La semana 4 del esquema es otra vez la semana 1.

export type SemanaRotacion = 1 | 2 | 3 | 4;
export type MotivoCambio = 'enfermo' | 'cita' | 'permiso' | 'iglesia' | 'favor' | 'otro';
export type PuestoTurno = 'mañana' | 'tarde';

export const TEXTO_MOTIVO: Record<MotivoCambio, string> = {
  enfermo: 'se enfermó',
  cita: 'cita médica',
  permiso: 'permiso',
  iglesia: 'iglesia',
  favor: 'pidió el favor',
  otro: 'otro motivo',
};

export interface PersonasHorario {
  /** Mañana de lunes a viernes. */
  manana: string;
  /** Tarde, de lunes a viernes. */
  tardeA: string;
  /** Tarde, de lunes a viernes. Su domingo libre del ciclo es de iglesia. */
  tardeB: string;
  /** Apoyo de sábado y domingo, para que las otras tres descansen igual. */
  finde: string;
}

export const PERSONAS_BASE: PersonasHorario = {
  manana: 'Andrea',
  tardeA: 'Erika',
  tardeB: 'Dayana',
  finde: 'Shirley',
};

export interface FilaHorario {
  dia: string;
  dow: number;
  fecha?: string;
  manana: string[];
  tarde: string[];
  descansa: string | null;
  /** 'Iglesia' cuando el descanso del domingo es el de Dayana, sin que nadie lo haya movido. */
  notaDescanso: string | null;
  turnoApoyo: string | null;
}

export interface CambioHorario {
  fecha: string;
  semana: SemanaRotacion;
  dow: number;
  enfermo: string;
  enfermoId?: string | null;
  cubre: string | null;
  cubreId?: string | null;
  motivo: MotivoCambio;
  /** Lo que se escribió: por qué no vino y por qué se movió el turno. */
  nota: string;
  porque: string;
  puesto: PuestoTurno;
}

export interface EnlacePersonas {
  mananaId: string | null;
  tardeAId: string | null;
  tardeBId: string | null;
  findeId: string | null;
}

export interface AnclaHorario {
  lunes: string;
  semana: SemanaRotacion;
}

export interface NotaDiaNomina {
  esperado: boolean;
  texto: string | null;
  esCambio: boolean;
}

export interface PersonaNomina {
  id: string;
  nombre: string;
  estado?: string;
}

export const CLAVE_CAMBIOS = 'dulce_horario_tienda_cambios_v2';
export const CLAVE_PERSONAS = 'dulce_horario_tienda_personas_v2';
export const CLAVE_ANCLA = 'dulce_horario_tienda_ancla_v2';
export const RESPALDOS_HORARIO = {
  cambios: 'horario_tienda_cambios_data',
  personas: 'horario_tienda_personas_data',
  ancla: 'horario_tienda_ancla_data',
} as const;
export const EVENTO_HORARIO = 'dulce-horario-cambiado';

const DIAS: Array<{ dia: string; dow: number }> = [
  { dia: 'Lunes', dow: 1 },
  { dia: 'Martes', dow: 2 },
  { dia: 'Miércoles', dow: 3 },
  { dia: 'Jueves', dow: 4 },
  { dia: 'Viernes', dow: 5 },
  { dia: 'Sábado', dow: 6 },
  { dia: 'Domingo', dow: 0 },
];

function copiar(nombres: string[]): string[] {
  return [...nombres];
}

export function unirNombres(nombres: string[]): string {
  if (nombres.length === 0) return '—';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function fechaLocalDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseFecha(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function sumarDias(fecha: string, dias: number): string {
  const dt = parseFecha(fecha);
  dt.setDate(dt.getDate() + dias);
  return fechaLocalDe(dt);
}

export function diaDeFecha(fecha: string): number {
  return parseFecha(fecha).getDay();
}

export function lunesDe(fecha: string): string {
  const day = diaDeFecha(fecha);
  const restar = day === 0 ? 6 : day - 1;
  return sumarDias(fecha, -restar);
}

export function diffSemanas(lunesDesde: string, lunesHasta: string): number {
  const a = parseFecha(lunesDesde).getTime();
  const b = parseFecha(lunesHasta).getTime();
  return Math.round((b - a) / (7 * 86400000));
}

export function semanaDeFecha(fecha: string, ancla: AnclaHorario): SemanaRotacion {
  const delta = diffSemanas(ancla.lunes, lunesDe(fecha));
  const semanaAncla = ancla.semana === 4 ? 1 : ancla.semana;
  const n = ((semanaAncla - 1 + delta) % 3 + 3) % 3;
  return (n + 1) as SemanaRotacion;
}

export function anclaEfectiva(guardada: AnclaHorario | null, hoy: string): AnclaHorario {
  if (guardada?.lunes && (guardada.semana === 1 || guardada.semana === 2 || guardada.semana === 3 || guardada.semana === 4)) return guardada;
  return { lunes: lunesDe(hoy), semana: 1 };
}

export function fechasDeSemana(lunes: string): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 0; i < 7; i++) {
    const dow = i === 6 ? 0 : i + 1;
    map.set(dow, sumarDias(lunes, i));
  }
  return map;
}

function turnoDeApoyo(fila: { manana: string[]; tarde: string[] }, apoyo: string): string | null {
  const enManana = fila.manana.includes(apoyo);
  const enTarde = fila.tarde.includes(apoyo);
  if (enManana && enTarde) return 'Mañana y tarde';
  if (enManana) return 'Mañana';
  if (enTarde) return 'Tarde';
  return null;
}

function armar(
  dia: string,
  dow: number,
  manana: string[],
  tarde: string[],
  descansa: string,
  notaDescanso: string | null,
  apoyo: string,
): FilaHorario {
  const fila: FilaHorario = { dia, dow, manana, tarde, descansa, notaDescanso, turnoApoyo: null };
  fila.turnoApoyo = turnoDeApoyo(fila, apoyo);
  return fila;
}

function entreSemana(dia: string, dow: number, p: PersonasHorario): FilaHorario {
  return armar(dia, dow, [p.manana], [p.tardeA, p.tardeB], p.finde, null, p.finde);
}

function sabado(semana: SemanaRotacion, p: PersonasHorario): FilaHorario {
  if (semana === 2) return armar('Sábado', 6, [p.tardeB], [p.manana, p.finde], p.tardeA, null, p.finde);
  if (semana === 3) return armar('Sábado', 6, [p.tardeA], [p.tardeB, p.finde], p.manana, null, p.finde);
  return armar('Sábado', 6, [p.tardeA], [p.manana, p.finde], p.tardeB, null, p.finde);
}

function domingo(semana: SemanaRotacion, p: PersonasHorario): FilaHorario {
  if (semana === 2) return armar('Domingo', 0, [p.finde], [p.manana, p.tardeB], p.tardeA, null, p.finde);
  if (semana === 3) return armar('Domingo', 0, [p.finde], [p.tardeA, p.tardeB], p.manana, null, p.finde);
  return armar('Domingo', 0, [p.finde], [p.manana, p.tardeA], p.tardeB, 'Iglesia', p.finde);
}

/** Cuadro de una semana del ciclo, sin fechas y sin cambios. */
export function cuadroSemana(semana: SemanaRotacion, personas: PersonasHorario = PERSONAS_BASE): FilaHorario[] {
  const semanaCiclo = semana === 4 ? 1 : semana;
  return DIAS.map(({ dia, dow }) => {
    if (dow === 6) return sabado(semanaCiclo, personas);
    if (dow === 0) return domingo(semanaCiclo, personas);
    return entreSemana(dia, dow, personas);
  });
}

export function tituloSemana(semana: SemanaRotacion, p: PersonasHorario): string {
  if (semana === 1) return `Descansa ${p.tardeB} el fin de semana. El domingo queda para la iglesia.`;
  if (semana === 2) return `Descansa ${p.tardeA} el fin de semana.`;
  return `Descansa ${p.manana} el fin de semana.`;
}

export function coberturaCompleta(fila: FilaHorario): boolean {
  return fila.manana.length === 1 && fila.tarde.length === 2;
}

/** Días de sábado y domingo libres en las 3 semanas. Las tres fijas deben tener 2. */
export function balanceCiclo(personas: PersonasHorario = PERSONAS_BASE): { finesLibres: Record<string, number>; equitativo: boolean } {
  const finesLibres: Record<string, number> = {
    [personas.manana]: 0,
    [personas.tardeA]: 0,
    [personas.tardeB]: 0,
    [personas.finde]: 0,
  };
  for (const semana of [1, 2, 3] as SemanaRotacion[]) {
    for (const fila of cuadroSemana(semana, personas)) {
      if (fila.dow !== 0 && fila.dow !== 6) continue;
      if (fila.descansa && finesLibres[fila.descansa] !== undefined) finesLibres[fila.descansa] += 1;
    }
  }
  const tres = [personas.manana, personas.tardeA, personas.tardeB].map(n => finesLibres[n]);
  return { finesLibres, equitativo: tres.every(n => n === 2) };
}

function ponerEnPuesto(nombres: string[], ausente: string, cubre: string | null): string[] {
  if (!nombres.includes(ausente)) return copiar(nombres);
  const sinAusente = nombres.filter(n => n !== ausente);
  if (!cubre || sinAusente.includes(cubre)) return sinAusente;
  return [...sinAusente, cubre];
}

export function cambiosConNombresActuales(cambios: CambioHorario[], equipo: PersonaNomina[]): CambioHorario[] {
  if (equipo.length === 0) return cambios;
  return cambios.map(c => {
    const enfermo = (c.enfermoId && equipo.find(t => t.id === c.enfermoId)?.nombre) || c.enfermo;
    const cubre = c.cubreId ? (equipo.find(t => t.id === c.cubreId)?.nombre ?? c.cubre) : c.cubre;
    return { ...c, enfermo, cubre };
  });
}

export function aplicarCambios(
  filas: FilaHorario[],
  cambios: CambioHorario[],
  semana: SemanaRotacion,
  apoyo: string,
  fechaDeDow?: Map<number, string>,
): FilaHorario[] {
  return filas.map(fila => {
    const fecha = fechaDeDow?.get(fila.dow) ?? fila.fecha;
    const delDia = cambios.filter(c => {
      if (c.fecha) return fecha != null && c.fecha === fecha;
      return c.semana === semana && c.dow === fila.dow;
    });
    if (delDia.length === 0) {
      return { ...fila, fecha, manana: copiar(fila.manana), tarde: copiar(fila.tarde) };
    }
    let manana = copiar(fila.manana);
    let tarde = copiar(fila.tarde);
    const descansan = new Set<string>();
    if (fila.descansa) descansan.add(fila.descansa);
    let notaDescanso = fila.notaDescanso;
    for (const c of delDia) {
      const estaba = manana.includes(c.enfermo) || tarde.includes(c.enfermo);
      if (!estaba) continue;
      manana = ponerEnPuesto(manana, c.enfermo, c.cubre);
      tarde = ponerEnPuesto(tarde, c.enfermo, c.cubre);
      descansan.add(`${c.enfermo} (${TEXTO_MOTIVO[c.motivo]})`);
      if (c.cubre) descansan.delete(c.cubre);
      if (notaDescanso && c.cubre === fila.descansa) notaDescanso = null;
    }
    const siguiente: FilaHorario = {
      ...fila,
      fecha,
      manana,
      tarde,
      descansa: descansan.size ? [...descansan].join(', ') : null,
      notaDescanso,
      turnoApoyo: null,
    };
    siguiente.turnoApoyo = turnoDeApoyo(siguiente, apoyo);
    return siguiente;
  });
}

export function cuadroDeSemana(
  lunes: string,
  ancla: AnclaHorario,
  personas: PersonasHorario,
  cambios: CambioHorario[],
  equipo: PersonaNomina[] = [],
): FilaHorario[] {
  const semana = semanaDeFecha(lunes, ancla);
  const base = cuadroSemana(semana, personas).map(fila => ({ ...fila, fecha: fechasDeSemana(lunes).get(fila.dow) }));
  const listos = cambiosConNombresActuales(cambios, equipo);
  return aplicarCambios(base, listos, semana, personas.finde, fechasDeSemana(lunes));
}

/** Si no puede venir, propone quién entra sin quitarle el fin de semana a las otras. */
export function proponerCobertura(
  fila: FilaHorario,
  ausente: string,
  personas: PersonasHorario,
): { nombre: string; porque: string } | null {
  const trabaja = fila.manana.includes(ausente) || fila.tarde.includes(ausente);
  if (!trabaja) return null;
  const apoyo = personas.finde;
  const apoyoLibre = !fila.manana.includes(apoyo) && !fila.tarde.includes(apoyo);
  if (ausente !== apoyo && apoyoLibre) {
    return {
      nombre: apoyo,
      porque: `${apoyo} no trabaja ese día y es el apoyo. ${personas.manana}, ${personas.tardeA} y ${personas.tardeB} siguen con el mismo descanso de fin de semana.`,
    };
  }
  if (fila.descansa && fila.descansa !== ausente && !fila.manana.includes(fila.descansa) && !fila.tarde.includes(fila.descansa)) {
    const iglesia = fila.notaDescanso === 'Iglesia';
    return {
      nombre: fila.descansa,
      porque: iglesia
        ? `${fila.descansa} está libre, pero ese domingo es de iglesia. Si entra, queda anotado para no quitarle el descanso a las otras.`
        : `${fila.descansa} está libre ese día. Si entra, queda anotado que cambió su descanso.`,
    };
  }
  return null;
}

export function textoCambio(c: CambioHorario): string {
  const porqueNoVino = TEXTO_MOTIVO[c.motivo];
  const detalle = c.nota.trim() ? ` ${c.nota.trim()}` : '';
  const dejo = `Dejó la ${c.puesto}.`;
  if (!c.cubre) return `${c.enfermo} no vino (${porqueNoVino}).${detalle} ${dejo} El turno quedó sin cubrir.`;
  const porque = c.porque.trim() ? ` ${c.porque.trim()}` : '';
  return `${c.enfermo} no vino (${porqueNoVino}).${detalle} ${dejo} El turno lo tomó ${c.cubre}.${porque}`;
}

export function trabajaEseDia(fila: FilaHorario, nombre: string): boolean {
  return fila.manana.includes(nombre) || fila.tarde.includes(nombre);
}

export function mapaNotasPeriodo(
  fechas: string[],
  trabajadores: PersonaNomina[],
  enlace: EnlacePersonas | null,
  cambios: CambioHorario[],
  anclaGuardada: AnclaHorario | null,
  hoy: string,
): Map<string, Map<string, NotaDiaNomina>> {
  const mapa = new Map<string, Map<string, NotaDiaNomina>>();
  const { personas, ids } = resolverPersonas(trabajadores, enlace);
  const ancla = anclaEfectiva(anclaGuardada, hoy);
  const porId = new Map(trabajadores.map(t => [t.id, t.nombre]));
  const links: Array<{ id: string; nombre: string }> = [];
  for (const id of [ids.mananaId, ids.tardeAId, ids.tardeBId, ids.findeId]) {
    if (!id) continue;
    const nombre = porId.get(id);
    if (!nombre || links.some(l => l.id === id)) continue;
    links.push({ id, nombre });
  }
  if (links.length === 0) return mapa;
  const listos = cambiosConNombresActuales(cambios, trabajadores);
  for (const link of links) mapa.set(link.id, new Map());
  for (const fecha of fechas) {
    const lunes = lunesDe(fecha);
    const filas = cuadroDeSemana(lunes, ancla, personas, listos, trabajadores);
    const fila = filas.find(f => f.fecha === fecha);
    if (!fila) continue;
    const semana = semanaDeFecha(fecha, ancla);
    const base = cuadroSemana(semana, personas).find(f => f.dow === fila.dow);
    const delDia = listos.filter(c => c.fecha === fecha);
    for (const link of links) {
      const esperado = trabajaEseDia(fila, link.nombre);
      const propio = delDia.find(c => c.enfermo === link.nombre || c.cubre === link.nombre);
      let texto: string | null = null;
      let esCambio = false;
      if (propio) {
        esCambio = true;
        texto = textoCambio(propio);
      } else if (!esperado && base?.descansa === link.nombre && base.notaDescanso) {
        texto = `Descanso de ${base.notaDescanso.toLowerCase()}. Horario normal, no se cambió el turno.`;
      } else if (!esperado && base?.descansa === link.nombre && (fila.dow === 0 || fila.dow === 6)) {
        texto = 'Descanso de fin de semana. Horario normal, no se cambió el turno.';
      } else if (!esperado && base?.descansa === link.nombre) {
        texto = 'No trabaja entre semana. Entra sábado y domingo.';
      }
      mapa.get(link.id)!.set(fecha, { esperado, texto, esCambio });
    }
  }
  return mapa;
}

function sinTildes(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function primerNombre(nombre: string): string {
  return sinTildes(nombre).split(/\s+/)[0] ?? '';
}

function buscarPorId(trabajadores: PersonaNomina[], id: string | null): PersonaNomina | null {
  if (!id) return null;
  const t = trabajadores.find(x => x.id === id);
  if (!t || t.estado === 'inactivo') return null;
  return t;
}

function buscarPorNombre(trabajadores: PersonaNomina[], base: string): PersonaNomina | null {
  const clave = primerNombre(base);
  const activos = trabajadores.filter(t => t.estado !== 'inactivo');
  return activos.find(t => primerNombre(t.nombre) === clave) ?? null;
}

export function resolverPersonas(
  trabajadores: PersonaNomina[],
  enlace: EnlacePersonas | null,
): { personas: PersonasHorario; ids: EnlacePersonas; avisos: string[] } {
  const avisos: string[] = [];
  const tomar = (id: string | null, base: string, puesto: string): { nombre: string; id: string | null } => {
    const porId = buscarPorId(trabajadores, id);
    if (porId) return { nombre: porId.nombre, id: porId.id };
    const porNombre = buscarPorNombre(trabajadores, base);
    if (porNombre) return { nombre: porNombre.nombre, id: porNombre.id };
    if (trabajadores.length > 0) avisos.push(`${base} no está en la nómina. Elige quién hace ${puesto}.`);
    return { nombre: base, id: null };
  };
  const manana = tomar(enlace?.mananaId ?? null, PERSONAS_BASE.manana, 'la mañana');
  const tardeA = tomar(enlace?.tardeAId ?? null, PERSONAS_BASE.tardeA, 'la tarde');
  const tardeB = tomar(enlace?.tardeBId ?? null, PERSONAS_BASE.tardeB, 'la otra tarde');
  const finde = tomar(enlace?.findeId ?? null, PERSONAS_BASE.finde, 'el apoyo de fin de semana');
  return {
    personas: { manana: manana.nombre, tardeA: tardeA.nombre, tardeB: tardeB.nombre, finde: finde.nombre },
    ids: { mananaId: manana.id, tardeAId: tardeA.id, tardeBId: tardeB.id, findeId: finde.id },
    avisos,
  };
}

function leerJson<T>(clave: string, vacio: T): T {
  try {
    if (typeof localStorage === 'undefined') return vacio;
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) as T : vacio;
  } catch {
    return vacio;
  }
}

function avisarHorario(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_HORARIO));
}

export function leerCambios(): CambioHorario[] {
  const data = leerJson<unknown>(CLAVE_CAMBIOS, []);
  return Array.isArray(data) ? data as CambioHorario[] : [];
}

export function guardarCambios(lista: CambioHorario[]): void {
  if (typeof localStorage === 'undefined') throw new Error('Almacenamiento local no disponible');
  localStorage.setItem(CLAVE_CAMBIOS, JSON.stringify(lista));
  avisarHorario();
}

export function leerEnlace(): EnlacePersonas | null {
  const data = leerJson<EnlacePersonas | null>(CLAVE_PERSONAS, null);
  if (!data || typeof data !== 'object') return null;
  return data;
}

export function guardarEnlace(enlace: EnlacePersonas): void {
  if (typeof localStorage === 'undefined') throw new Error('Almacenamiento local no disponible');
  localStorage.setItem(CLAVE_PERSONAS, JSON.stringify(enlace));
  avisarHorario();
}

export function leerAncla(): AnclaHorario | null {
  const data = leerJson<AnclaHorario | null>(CLAVE_ANCLA, null);
  if (!data?.lunes) return null;
  return data;
}

export function guardarAncla(ancla: AnclaHorario): void {
  if (typeof localStorage === 'undefined') throw new Error('Almacenamiento local no disponible');
  localStorage.setItem(CLAVE_ANCLA, JSON.stringify(ancla));
  avisarHorario();
}
