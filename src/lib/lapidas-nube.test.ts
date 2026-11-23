import { describe, it, expect } from 'vitest';
import { leerLapidasNube, borradoSegunNube } from './lapidas-nube';

const lap = leerLapidasNube([
  { table: 'productos', item_id: 'agua300', deleted_at: '2026-11-23T14:28:03Z' },
  { table: 'productos', item_id: 'viejo', deleted_at: null },
]);

describe('guardián de borrados (2026-11-23)', () => {
  it('lo borrado no vuelve aunque siga en la nube con su fecha vieja', () => {
    const enNube = { id: 'agua300', nombre: 'Agua cristal 300*24', updatedAt: '2026-08-31T01:29:51Z' };
    expect(borradoSegunNube(lap, 'productos', 'agua300', enNube)).toBe(true);
    expect(borradoSegunNube(lap, 'productos', 'agua300', enNube, { ...enNube })).toBe(true);
  });

  it('si alguien lo editó después de borrarlo, se respeta (fue restaurado)', () => {
    const editado = { id: 'agua300', updatedAt: '2026-11-23T16:00:00Z' };
    expect(borradoSegunNube(lap, 'productos', 'agua300', editado)).toBe(false);
  });

  it('sin lápida o de otra tabla, no se toca', () => {
    expect(borradoSegunNube(lap, 'productos', 'otro', { id: 'otro' })).toBe(false);
    expect(borradoSegunNube(lap, 'precios', 'agua300', { id: 'agua300' })).toBe(false);
    expect(borradoSegunNube(null, 'productos', 'agua300', {})).toBe(false);
  });

  it('lápida sin hora: gana el borrado', () => {
    expect(borradoSegunNube(lap, 'productos', 'viejo', { updatedAt: '2026-11-20T00:00:00Z' })).toBe(true);
  });
});
