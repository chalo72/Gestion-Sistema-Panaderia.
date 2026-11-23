import { describe, it, expect } from 'vitest';
import { revisarPrecio, indiceRepetidos } from './precio-inconsistente';

const motivos = (ps: { motivo: string }[]) => ps.map(p => p.motivo);

describe('precios de venta inconsistentes (2026-11-23)', () => {
  it('un precio sano no se marca', () => {
    expect(revisarPrecio({ id: '1', nombre: 'Pan', precioVenta: 1000, costoBase: 600 })).toEqual([]);
  });

  it('marca sin precio, bajo el costo y costo de paquete', () => {
    expect(motivos(revisarPrecio({ id: '1', nombre: 'X', precioVenta: 0 }))).toContain('sin-precio');
    expect(motivos(revisarPrecio({ id: '1', nombre: 'X', precioVenta: 900, costoBase: 1000 }))).toContain('bajo-costo');
    // Caso real: Cifrut 400, costo $14.500 (paquete) y PVP $1.637
    expect(motivos(revisarPrecio({ id: '1', nombre: 'Cifrut 400', precioVenta: 1637, costoBase: 14500 }))).toEqual(['costo-paquete', 'no-redondo']);
  });

  it('marca ganancia muy baja y muy alta', () => {
    expect(motivos(revisarPrecio({ id: '1', nombre: 'X', precioVenta: 1050, costoBase: 1000 }))).toContain('margen-bajo');
    expect(motivos(revisarPrecio({ id: '1', nombre: 'X', precioVenta: 5000, costoBase: 1000 }))).toContain('margen-alto');
  });

  it('marca precio no redondo ($3.071)', () => {
    const ps = revisarPrecio({ id: '1', nombre: 'BIG-1 ltro', precioVenta: 3071, costoBase: 2193 });
    expect(motivos(ps)).toEqual(['no-redondo']);
    expect(ps[0].texto).toContain('3.071');
  });

  it('marca nombres repetidos con otro precio (Golpe Original 140g)', () => {
    const prods = [
      { id: 'a', nombre: 'Golpe Original 140g', precioVenta: 8500, costoBase: 6500 },
      { id: 'b', nombre: 'golpe original  140g', precioVenta: 67600, costoBase: 52000, tipo: 'ingrediente' },
    ];
    const rep = indiceRepetidos(prods);
    expect(revisarPrecio(prods[0], { repetidos: rep })[0].texto).toContain('67.600');
    expect(motivos(revisarPrecio(prods[1], { repetidos: rep }))).toEqual(['repetido']);
  });

  it('un insumo sin precio de venta no se marca', () => {
    expect(revisarPrecio({ id: '1', nombre: 'Harina', precioVenta: 0, costoBase: 98000, tipo: 'ingrediente' })).toEqual([]);
  });
});
