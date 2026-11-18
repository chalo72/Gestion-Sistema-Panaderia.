import { describe, it, expect } from 'vitest';
import { parseHorario, minutosEntre, diaSemana } from './horario-trabajo';

describe('parseHorario', () => {
  it('lee "Lun-Vie 7am-3pm"', () => {
    expect(parseHorario('Lun-Vie 7am-3pm')).toEqual({ dias: [1, 2, 3, 4, 5], entrada: '07:00', salida: '15:00' });
  });
  it('lee lista de días y horas en 24 h', () => {
    expect(parseHorario('Lun, Mié, Vie 07:00-15:30')).toEqual({ dias: [1, 3, 5], entrada: '07:00', salida: '15:30' });
  });
  it('lee días completos y rango que cruza el domingo', () => {
    const h = parseHorario('Sábado a Lunes 6 am - 2 pm');
    expect(h.dias).toEqual([0, 1, 6]);
    expect(h.entrada).toBe('06:00');
    expect(h.salida).toBe('14:00');
  });
  it('"7-3" se entiende como 7:00 a 15:00', () => {
    const h = parseHorario('Mar-Sáb 7-3');
    expect(h.dias).toEqual([2, 3, 4, 5, 6]);
    expect(h.entrada).toBe('07:00');
    expect(h.salida).toBe('15:00');
  });
  it('si no se entiende devuelve null (no inventa)', () => {
    expect(parseHorario('Mañana')).toEqual({ dias: null, entrada: null, salida: null });
    expect(parseHorario('')).toEqual({ dias: null, entrada: null, salida: null });
    expect(parseHorario(undefined)).toEqual({ dias: null, entrada: null, salida: null });
  });
});

describe('utilidades de fecha/hora', () => {
  it('minutosEntre', () => {
    expect(minutosEntre('07:00', '15:00')).toBe(480);
    expect(minutosEntre('15:00', '07:00')).toBe(0);
  });
  it('diaSemana usa la fecha local (8 oct 2026 es jueves)', () => {
    expect(diaSemana('2026-10-08')).toBe(4);
  });
});
