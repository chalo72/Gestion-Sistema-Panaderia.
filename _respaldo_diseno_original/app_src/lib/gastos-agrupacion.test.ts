import { describe, it, expect } from 'vitest';
import { parseDescripcionLineaGasto, etiquetaUnidades } from './gastos-agrupacion';

describe('gastos-agrupacion display', () => {
  it('parsea 2 UNIDS al inicio y quita valor', () => {
    const r = parseDescripcionLineaGasto('2 UNIDS bretaña friopack *24 valor');
    expect(r.cantidad).toBe(2);
    expect(r.nombre).toBe('bretaña friopack *24');
    expect(etiquetaUnidades(r.cantidad)).toBe('2 UNIDS');
  });

  it('parsea 3x producto', () => {
    const r = parseDescripcionLineaGasto('3x Pony pet *24');
    expect(r.cantidad).toBe(3);
    expect(r.nombre).toBe('Pony pet *24');
  });

  it('sin cantidad deja nombre limpio', () => {
    const r = parseDescripcionLineaGasto('Econolitro valor');
    expect(r.cantidad).toBeNull();
    expect(r.nombre).toBe('Econolitro');
    expect(etiquetaUnidades(r.cantidad)).toBeNull();
  });

  it('1 UNID singular', () => {
    expect(etiquetaUnidades(1)).toBe('1 UNID');
  });
});
