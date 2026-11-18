import { describe, expect, it } from 'vitest';
import {
  PERSONAS_BASE,
  CLAVE_CAMBIOS,
  anclaEfectiva,
  aplicarCambios,
  balanceCiclo,
  coberturaCompleta,
  cuadroDeSemana,
  cuadroSemana,
  guardarCambios,
  mapaNotasPeriodo,
  proponerCobertura,
  resolverPersonas,
  semanaDeFecha,
  textoCambio,
  unirNombres,
  type CambioHorario,
} from './horario-tienda';

const cambio = (parcial: Partial<CambioHorario> & Pick<CambioHorario, 'fecha' | 'enfermo' | 'dow'>): CambioHorario => ({
  semana: 1,
  cubre: 'Shirley',
  cubreId: null,
  enfermoId: null,
  motivo: 'cita',
  nota: 'va al médico',
  porque: 'Shirley no trabaja ese día y es el apoyo.',
  puesto: 'mañana',
  ...parcial,
});

describe('horario rotativo equitativo', () => {
  it('persiste los cambios de turno en el almacenamiento local', () => {
    const cambios = [cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea' })];

    guardarCambios(cambios);

    expect(JSON.parse(localStorage.getItem(CLAVE_CAMBIOS) || '[]')).toEqual(cambios);
  });

  it('de lunes a viernes Andrea mañana y Erika con Dayana en la tarde', () => {
    const f = cuadroSemana(1);
    const lunes = f.find(x => x.dia === 'Lunes')!;
    expect(unirNombres(lunes.manana)).toBe('Andrea');
    expect(unirNombres(lunes.tarde)).toBe('Erika y Dayana');
    expect(lunes.descansa).toBe('Shirley');
    expect(lunes.turnoApoyo).toBeNull();
    expect(coberturaCompleta(lunes)).toBe(true);
    for (const semana of [1, 2, 3] as const) {
      for (const fila of cuadroSemana(semana)) {
        if (fila.dow === 0 || fila.dow === 6) continue;
        expect(fila.manana).toEqual(['Andrea']);
        expect(fila.tarde).toEqual(['Erika', 'Dayana']);
        expect(coberturaCompleta(fila)).toBe(true);
      }
    }
  });

  it('el fin de semana rota y Shirley cubre para que las tres descansen igual', () => {
    const s1 = Object.fromEntries(cuadroSemana(1).map(x => [x.dia, x]));
    expect(s1.Sábado.manana).toEqual(['Erika']);
    expect(s1.Sábado.tarde).toEqual(['Andrea', 'Shirley']);
    expect(s1.Sábado.descansa).toBe('Dayana');
    expect(s1.Domingo.manana).toEqual(['Shirley']);
    expect(s1.Domingo.tarde).toEqual(['Andrea', 'Erika']);
    expect(s1.Domingo.descansa).toBe('Dayana');
    expect(s1.Domingo.notaDescanso).toBe('Iglesia');

    const s2 = Object.fromEntries(cuadroSemana(2).map(x => [x.dia, x]));
    expect(s2.Sábado.manana).toEqual(['Dayana']);
    expect(s2.Sábado.descansa).toBe('Erika');
    expect(s2.Domingo.tarde).toEqual(['Andrea', 'Dayana']);
    expect(s2.Domingo.descansa).toBe('Erika');
    expect(s2.Domingo.notaDescanso).toBeNull();

    const s3 = Object.fromEntries(cuadroSemana(3).map(x => [x.dia, x]));
    expect(s3.Sábado.manana).toEqual(['Erika']);
    expect(s3.Sábado.tarde).toEqual(['Dayana', 'Shirley']);
    expect(s3.Sábado.descansa).toBe('Andrea');
    expect(s3.Domingo.manana).toEqual(['Shirley']);
    expect(s3.Domingo.tarde).toEqual(['Erika', 'Dayana']);
    expect(s3.Domingo.descansa).toBe('Andrea');

    const balance = balanceCiclo();
    expect(balance.equitativo).toBe(true);
    expect(balance.finesLibres).toEqual({ Andrea: 2, Erika: 2, Dayana: 2, Shirley: 0 });
  });

  it('todos los días quedan 1 en la mañana y 2 en la tarde', () => {
    for (const semana of [1, 2, 3] as const) {
      for (const fila of cuadroSemana(semana)) expect(coberturaCompleta(fila)).toBe(true);
    }
  });

  it('si Andrea tiene cita el lunes, Shirley toma la mañana y las otras no pierden el finde', () => {
    const lunes = cuadroSemana(1).find(f => f.dia === 'Lunes')!;
    const propuesta = proponerCobertura(lunes, 'Andrea', PERSONAS_BASE);
    expect(propuesta?.nombre).toBe('Shirley');
    const cambiado = aplicarCambios(cuadroSemana(1), [
      cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea', cubre: 'Shirley', puesto: 'mañana' }),
    ], 1, 'Shirley', new Map([[1, '2026-10-19']]));
    const fila = cambiado.find(f => f.dia === 'Lunes')!;
    expect(fila.manana).toEqual(['Shirley']);
    expect(fila.tarde).toEqual(['Erika', 'Dayana']);
    expect(fila.descansa).toContain('Andrea');
    expect(fila.turnoApoyo).toBe('Mañana');
    expect(textoCambio(cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea' }))).toContain('cita médica');
    expect(textoCambio(cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea' }))).toContain('va al médico');
  });

  it('un cambio con fecha no se repite en otra semana', () => {
    const c = cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea' });
    const otra = cuadroDeSemana('2026-10-26', { lunes: '2026-10-19', semana: 1 }, PERSONAS_BASE, [c]);
    expect(otra.find(f => f.dia === 'Lunes')?.manana).toEqual(['Andrea']);
  });

  it('acepta la semana 4 como reinicio de la semana 1 del ciclo', () => {
    const ancla = { lunes: '2026-10-26', semana: 4 as const };
    expect(anclaEfectiva(ancla, '2026-10-26')).toEqual(ancla);
    expect(semanaDeFecha('2026-10-26', ancla)).toBe(1);
    expect(semanaDeFecha('2026-11-02', ancla)).toBe(2);
    expect(semanaDeFecha('2026-10-19', ancla)).toBe(3);
  });

  it('los nombres salen de la nómina y siguen el id si se edita el nombre', () => {
    const equipo = [
      { id: 'a', nombre: 'Andrea Cadena', estado: 'activo' },
      { id: 'e', nombre: 'Erika', estado: 'activo' },
      { id: 'd', nombre: 'Dayana', estado: 'activo' },
      { id: 's', nombre: 'Shirley', estado: 'activo' },
    ];
    const resuelto = resolverPersonas(equipo, null);
    expect(resuelto.personas.manana).toBe('Andrea Cadena');
    expect(resuelto.ids.mananaId).toBe('a');
    const renombrada = resolverPersonas(
      equipo.map(t => t.id === 's' ? { ...t, nombre: 'Shirley Gómez' } : t),
      resuelto.ids,
    );
    expect(renombrada.personas.finde).toBe('Shirley Gómez');
  });

  it('la nómina ve el descanso normal y el motivo del cambio', () => {
    const equipo = [
      { id: 'a', nombre: 'Andrea', estado: 'activo' },
      { id: 'e', nombre: 'Erika', estado: 'activo' },
      { id: 'd', nombre: 'Dayana', estado: 'activo' },
      { id: 's', nombre: 'Shirley', estado: 'activo' },
    ];
    const enlace = { mananaId: 'a', tardeAId: 'e', tardeBId: 'd', findeId: 's' };
    const ancla = { lunes: '2026-10-19', semana: 1 as const };
    const notas = mapaNotasPeriodo(
      ['2026-10-19', '2026-10-24', '2026-10-25'],
      equipo,
      enlace,
      [cambio({ fecha: '2026-10-19', dow: 1, enfermo: 'Andrea', enfermoId: 'a', cubre: 'Shirley', cubreId: 's' })],
      ancla,
      '2026-10-24',
    );
    expect(notas.get('a')?.get('2026-10-19')?.esperado).toBe(false);
    expect(notas.get('a')?.get('2026-10-19')?.texto).toContain('va al médico');
    expect(notas.get('s')?.get('2026-10-19')?.esperado).toBe(true);
    expect(notas.get('d')?.get('2026-10-25')?.esperado).toBe(false);
    expect(notas.get('d')?.get('2026-10-25')?.texto).toContain('iglesia');
    expect(notas.get('d')?.get('2026-10-25')?.esCambio).toBe(false);
  });
});
