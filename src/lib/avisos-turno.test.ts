import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLAVE_AVISOS_TURNO,
  crearAvisosDeCambio,
  destinosWhatsAppDeCambio,
  leerAvisosTurno,
  marcarAvisoLeido,
  telefonoWhatsApp,
  avisosNoLeidos,
  avisosVisiblesPara,
} from './avisos-turno';
import type { CambioHorario } from './horario-tienda';

const cambio = (parcial?: Partial<CambioHorario>): CambioHorario => ({
  fecha: '2026-10-27',
  semana: 1,
  dow: 1,
  enfermo: 'Andrea Cadena',
  enfermoId: 'a1',
  cubre: 'Shirley',
  cubreId: 's1',
  motivo: 'cita',
  nota: 'médico a las 9',
  porque: 'Shirley está libre',
  puesto: 'mañana',
  ...parcial,
});

describe('avisos de cambio de turno', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normaliza teléfono colombiano', () => {
    expect(telefonoWhatsApp('3001234567')).toBe('573001234567');
    expect(telefonoWhatsApp('+57 300 123 4567')).toBe('573001234567');
    expect(telefonoWhatsApp('123')).toBeNull();
  });

  it('crea avisos para quien no viene y quien cubre', () => {
    const creados = crearAvisosDeCambio(cambio());
    expect(creados).toHaveLength(2);
    expect(creados[0].rol).toBe('ausente');
    expect(creados[1].rol).toBe('cubre');
    expect(creados[0].leido).toBe(false);
    expect(leerAvisosTurno()).toHaveLength(2);
    expect(localStorage.getItem(CLAVE_AVISOS_TURNO)).toBeTruthy();
  });

  it('se puede marcar leído y ya no aparece', () => {
    const [aviso] = crearAvisosDeCambio(cambio({ cubre: null, cubreId: null }));
    expect(avisosNoLeidos()).toHaveLength(1);
    marcarAvisoLeido(aviso.id);
    expect(avisosNoLeidos()).toHaveLength(0);
  });

  it('la trabajadora solo ve su aviso; admin ve todos', () => {
    crearAvisosDeCambio(cambio());
    const todos = leerAvisosTurno();
    expect(avisosVisiblesPara(todos, { nombre: 'Shirley Gómez' })).toHaveLength(1);
    expect(avisosVisiblesPara(todos, { nombre: 'Shirley Gómez' })[0].rol).toBe('cubre');
    expect(avisosVisiblesPara(todos, { verTodos: true })).toHaveLength(2);
  });

  it('prepara WhatsApp para ausente y quien cubre', () => {
    const destinos = destinosWhatsAppDeCambio(cambio(), {
      a1: '3001112233',
      s1: '3009998877',
    });
    expect(destinos).toHaveLength(2);
    expect(destinos[0].telefono).toBe('573001112233');
    expect(destinos[0].texto).toContain('Andrea');
    expect(destinos[0].texto).toContain('médico');
    expect(destinos[1].texto).toContain('cubres');
    expect(destinos[1].texto).toContain('Shirley');
  });
});
