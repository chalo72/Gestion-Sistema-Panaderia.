// Quién trabaja cada día y quién puede cubrir si alguien se enferma.
// No toca el pago: solo arma el horario para que se pueda cambiar.

import { parseHorario, diaSemana } from './horario-trabajo';

export type MotivoAusencia = 'enfermo' | 'permiso' | 'otro';

export interface Cubierta {
  fecha: string;
  ausenteId: string;
  /** null = se marcó la ausencia y todavía nadie cubre. */
  cubreId: string | null;
  motivo: MotivoAusencia;
}

export interface PersonaTurno {
  id: string;
  nombre: string;
  rol: string;
  estado: string;
  horario?: string | null;
}

export interface QuienPuedeCubrir {
  id: string;
  nombre: string;
  rol: string;
  libre: boolean;
  mismoOficio: boolean;
  porque: string;
}

const OFICIO: Record<string, string> = {
  panadero: 'panadería',
  vendedor: 'venta',
  cajero: 'caja',
  repartidor: 'reparto',
  administrador: 'administración',
  otro: 'otro oficio',
};

export function oficio(rol: string): string {
  return OFICIO[rol] ?? rol;
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function semanaDesde(fecha: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(fecha, i));
}

/** true si ese día le toca según el horario escrito. Sin horario, se asume que puede venir. */
export function leTocaTrabajar(p: PersonaTurno, fecha: string): boolean {
  if (p.estado === 'inactivo' || p.estado === 'vacaciones') return false;
  const dias = parseHorario(p.horario).dias;
  if (!dias) return true;
  return dias.includes(diaSemana(fecha));
}

export function quienTrabaja(equipo: PersonaTurno[], fecha: string, cubiertas: Cubierta[]): PersonaTurno[] {
  const ausentes = new Set(cubiertas.filter(c => c.fecha === fecha).map(c => c.ausenteId));
  return equipo.filter(p => leTocaTrabajar(p, fecha) && !ausentes.has(p.id));
}

export function proponerQuienCubre(
  equipo: PersonaTurno[],
  fecha: string,
  ausenteId: string,
  cubiertas: Cubierta[],
): QuienPuedeCubrir[] {
  const ausente = equipo.find(p => p.id === ausenteId);
  if (!ausente) return [];
  const delDia = cubiertas.filter(c => c.fecha === fecha);
  const noPuede = new Set<string>([ausenteId]);
  for (const c of delDia) {
    noPuede.add(c.ausenteId);
    if (c.cubreId && c.ausenteId !== ausenteId) noPuede.add(c.cubreId);
  }

  const propuestas: Array<QuienPuedeCubrir & { peso: number }> = [];
  for (const p of equipo) {
    if (noPuede.has(p.id)) continue;
    if (p.estado !== 'activo') continue;
    const dias = parseHorario(p.horario).dias;
    const libre = dias ? !dias.includes(diaSemana(fecha)) : false;
    const horarioClaro = dias !== null;
    const mismoOficio = p.rol === ausente.rol;
    let peso = 0;
    let porque = '';
    if (mismoOficio && libre) {
      peso = 100;
      porque = `Descansa ese día y hace ${oficio(p.rol)}`;
    } else if (mismoOficio && !horarioClaro) {
      peso = 70;
      porque = `Hace ${oficio(p.rol)}. No tiene días escritos, se puede mover`;
    } else if (mismoOficio) {
      peso = 50;
      porque = `Hace ${oficio(p.rol)}, pero ese día ya le toca. Quedaría con doble turno`;
    } else if (libre) {
      peso = 40;
      porque = `Descansa, pero su oficio es ${oficio(p.rol)}`;
    } else if (!horarioClaro) {
      peso = 20;
      porque = `Oficio ${oficio(p.rol)}, sin horario fijo`;
    } else {
      peso = 10;
      porque = `Ese día ya trabaja en ${oficio(p.rol)}`;
    }
    propuestas.push({ id: p.id, nombre: p.nombre, rol: p.rol, libre, mismoOficio, porque, peso });
  }
  return propuestas
    .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, 'es'))
    .map(({ peso: _peso, ...resto }) => resto);
}

export function guardarCubierta(lista: Cubierta[], nueva: Cubierta): { lista: Cubierta[]; error?: string } {
  if (!nueva.fecha || !nueva.ausenteId) return { lista, error: 'Falta el día o la persona' };
  if (nueva.cubreId && nueva.cubreId === nueva.ausenteId) {
    return { lista, error: 'Una persona no se cubre a sí misma' };
  }
  const delDia = lista.filter(c => c.fecha === nueva.fecha && c.ausenteId !== nueva.ausenteId);
  if (nueva.cubreId && delDia.some(c => c.ausenteId === nueva.cubreId)) {
    return { lista, error: 'Esa persona también está ausente ese día' };
  }
  if (nueva.cubreId && delDia.some(c => c.cubreId === nueva.cubreId)) {
    return { lista, error: 'Esa persona ya cubre a alguien ese día' };
  }
  const sinEsta = lista.filter(c => !(c.fecha === nueva.fecha && c.ausenteId === nueva.ausenteId));
  return { lista: [...sinEsta, nueva] };
}

export function quitarAusencia(lista: Cubierta[], fecha: string, ausenteId: string): Cubierta[] {
  return lista.filter(c => !(c.fecha === fecha && c.ausenteId === ausenteId));
}
