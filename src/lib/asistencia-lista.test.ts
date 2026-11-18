import { describe, it, expect } from 'vitest';
import { esTrabajadoraActiva, trabajadorasActivas, unirAsistencia } from './asistencia-lista';

const t = (id: string, nombre: string, estado: string) => ({ id, nombre, estado } as any);

describe('Turno / Asistencia: lista de trabajadoras', () => {
  it('reconoce "Activo" escrito de varias formas', () => {
    expect(esTrabajadoraActiva(t('1', 'A', 'Activo'))).toBe(true);
    expect(esTrabajadoraActiva(t('1', 'A', ' activo '))).toBe(true);
    expect(esTrabajadoraActiva(t('1', 'A', 'inactivo'))).toBe(false);
  });

  it('si la carga general aún no llegó, usa lo que la pantalla leyó sola', () => {
    const r = trabajadorasActivas([], [t('2', 'Luz', 'activo'), t('1', 'Ana', 'activo'), t('3', 'Eva', 'retirado')]);
    expect(r.map(x => x.nombre)).toEqual(['Ana', 'Luz']);
  });

  it('no repite a la misma trabajadora y gana la versión de la carga general', () => {
    const r = trabajadorasActivas([t('1', 'Ana María', 'activo')], [t('1', 'Ana', 'activo')]);
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe('Ana María');
  });

  it('une los registros de asistencia sin duplicar', () => {
    const a = { id: 'r1', trabajadorId: '1', tipo: 'entrada', fecha: '2026-11-17', hora: '07:00' } as any;
    const b = { id: 'r2', trabajadorId: '2', tipo: 'entrada', fecha: '2026-11-17', hora: '07:05' } as any;
    expect(unirAsistencia([a], [a, b]).map(x => x.id).sort()).toEqual(['r1', 'r2']);
  });
});
