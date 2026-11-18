import { describe, it, expect } from 'vitest';
import { esTrabajadoraActiva, trabajadorasActivas, unirAsistencia, estadoDelDia, horaLocalDeRegistro } from './asistencia-lista';

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

describe('estadoDelDia (botón Llegué bloqueado en todos los aparatos)', () => {
  const hoy = '2026-11-17';
  const reg = (id: string, tipo: 'entrada' | 'salida', createdAt: string, trabajadorId = 'ana') =>
    ({ id, trabajadorId, trabajadorNombre: 'Ana', tipo, fecha: hoy, hora: '', createdAt } as any);

  it('sin registros hoy → no ha marcado llegada', () => {
    expect(estadoDelDia([], 'ana', hoy).estado).toBe('sin-llegar');
    expect(estadoDelDia([{ ...reg('x', 'entrada', '2026-11-16T12:00:00Z'), fecha: '2026-11-16' }], 'ana', hoy).estado).toBe('sin-llegar');
  });

  it('con llegada (aunque venga de otro aparato) → adentro', () => {
    const r = estadoDelDia([reg('1', 'entrada', '2026-11-17T12:05:00Z')], 'ana', hoy);
    expect(r.estado).toBe('adentro');
    expect(r.llegada?.id).toBe('1');
  });

  it('el último registro manda: llegó y salió → salió', () => {
    const r = estadoDelDia([reg('2', 'salida', '2026-11-17T20:00:00Z'), reg('1', 'entrada', '2026-11-17T12:05:00Z')], 'ana', hoy);
    expect(r.estado).toBe('salio');
  });

  it('no mezcla trabajadoras', () => {
    expect(estadoDelDia([reg('1', 'entrada', '2026-11-17T12:05:00Z', 'luz')], 'ana', hoy).estado).toBe('sin-llegar');
  });

  it('la hora se muestra en hora local, no en UTC', () => {
    const h = horaLocalDeRegistro({ hora: '12:05', createdAt: '2026-11-17T12:05:00.000Z' } as any);
    const esperado = new Date('2026-11-17T12:05:00.000Z').toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
    expect(h).toBe(esperado);
    expect(horaLocalDeRegistro({ hora: '07:05' } as any)).toBe('07:05');
  });
});
