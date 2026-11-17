import { describe, expect, it } from 'vitest';
import {
  guardarCubierta,
  leTocaTrabajar,
  proponerQuienCubre,
  quienTrabaja,
  quitarAusencia,
  semanaDesde,
  type PersonaTurno,
} from './horario-enfermo';

const equipo: PersonaTurno[] = [
  { id: 'ana', nombre: 'Ana', rol: 'vendedor', estado: 'activo', horario: 'Lun-Vie 7am-3pm' },
  { id: 'luz', nombre: 'Luz', rol: 'vendedor', estado: 'activo', horario: 'Sáb-Dom 8am-2pm' },
  { id: 'caro', nombre: 'Caro', rol: 'panadero', estado: 'activo', horario: 'Lun-Sáb 4am-12pm' },
  { id: 'ines', nombre: 'Inés', rol: 'vendedor', estado: 'vacaciones', horario: 'Lun-Vie 7am-3pm' },
  { id: 'sol', nombre: 'Sol', rol: 'cajero', estado: 'activo', horario: 'Lun-Vie 7am-3pm' },
];

describe('horario si alguien se enferma', () => {
  it('el jueves 8 oct 2026 le toca a Ana y no a Luz', () => {
    expect(leTocaTrabajar(equipo[0], '2026-10-08')).toBe(true);
    expect(leTocaTrabajar(equipo[1], '2026-10-08')).toBe(false);
    expect(leTocaTrabajar(equipo[3], '2026-10-08')).toBe(false);
  });

  it('propone primero a quien descansa y hace el mismo oficio', () => {
    const ideas = proponerQuienCubre(equipo, '2026-10-08', 'ana', []);
    expect(ideas[0]?.id).toBe('luz');
    expect(ideas[0]?.libre).toBe(true);
    expect(ideas.map(i => i.id)).not.toContain('ines');
    expect(ideas.map(i => i.id)).not.toContain('ana');
  });

  it('quien ya cubre o está enfermo no sale otra vez', () => {
    const ideas = proponerQuienCubre(equipo, '2026-10-08', 'sol', [
      { fecha: '2026-10-08', ausenteId: 'ana', cubreId: 'luz', motivo: 'enfermo' },
    ]);
    expect(ideas.map(i => i.id)).not.toContain('luz');
    expect(ideas.map(i => i.id)).not.toContain('ana');
  });

  it('guardar reemplaza la cubierta del mismo día y rechaza el doble cubrimiento', () => {
    const primera = guardarCubierta([], { fecha: '2026-10-08', ausenteId: 'ana', cubreId: 'luz', motivo: 'enfermo' });
    const cambiada = guardarCubierta(primera.lista, { fecha: '2026-10-08', ausenteId: 'ana', cubreId: null, motivo: 'enfermo' });
    expect(cambiada.lista).toHaveLength(1);
    expect(cambiada.lista[0]?.cubreId).toBeNull();
    const doble = guardarCubierta(primera.lista, { fecha: '2026-10-08', ausenteId: 'sol', cubreId: 'luz', motivo: 'permiso' });
    expect(doble.error).toMatch(/ya cubre/);
    expect(doble.lista).toEqual(primera.lista);
  });

  it('al enfermarse sale del tablero de ese día', () => {
    const cubiertas = [{ fecha: '2026-10-08', ausenteId: 'ana', cubreId: 'luz' as string | null, motivo: 'enfermo' as const }];
    expect(quienTrabaja(equipo, '2026-10-08', cubiertas).map(p => p.id)).not.toContain('ana');
    expect(quitarAusencia(cubiertas, '2026-10-08', 'ana')).toEqual([]);
  });

  it('arma siete días seguidos sin saltar de mes', () => {
    expect(semanaDesde('2026-10-29')).toEqual([
      '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
    ]);
  });
});
