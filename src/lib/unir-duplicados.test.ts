import { describe, it, expect } from 'vitest';
import { planDeUnion, distanciaLetras } from './unir-duplicados';

const pv = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({ id, nombre, precioVenta: 0, ...extra });

describe('reglas estrictas para unir duplicados (2026-11-23)', () => {
  it('Agua cristal 600 *24 (paca) se une al suelto de 600 ml: seguro, se queda el suelto', () => {
    const plan = planDeUnion([
      pv('paca', 'Agua cristal 600 *24', { categoria: 'Postobón', costoBase: 29999, stock: 2, proveedores: [{ proveedorId: 'post', costo: 29999, cantidadEmbalaje: 1 }] }),
      pv('suelto', 'Agua crital 600ml', { categoria: 'Postobón', precioVenta: 4200, costoBase: 1250, stock: 10, proveedores: [{ proveedorId: 'post', costo: 1250, cantidadEmbalaje: 1 }] }),
    ], ['Postobón']);
    expect(plan.nivel).toBe('seguro');
    expect(plan.principal.id).toBe('suelto');
    expect(plan.resultado.precioVenta).toBe(4200);          // el precio de venta NO cambia
    expect(plan.resultado.stock).toBe(10 + 2 * 24);         // 2 pacas = 48 unidades
    expect(plan.resultado.stockConvertido).toBe(true);
    expect(plan.resultado.proveedores).toContainEqual({ proveedorId: 'post', costo: 29999, cantidadEmbalaje: 24 });
  });

  it('Golpe Original 140g ×2 con costos que no cuadran ($6.500 vs $52.000): dudoso', () => {
    const plan = planDeUnion([
      pv('v', 'Golpe Original 140g', { precioVenta: 8500, costoBase: 6500, categoria: 'Mekatos' }),
      pv('i', 'Golpe Original 140g', { precioVenta: 67600, costoBase: 52000, tipo: 'ingrediente', categoria: 'Mekatos' }),
    ], ['Mekatos']);
    expect(plan.nivel).toBe('dudoso');
    expect(plan.principal.id).toBe('v');
    expect(plan.motivos.join(' ')).toMatch(/costos por unidad no cuadran/);
  });

  it('si el que se queda no tiene precio de venta, se completa del otro y se avisa', () => {
    const plan = planDeUnion([
      pv('a', 'Karaqueña', { categoria: 'Mekatos', costoBase: 2000, stock: 5 }),
      pv('b', 'Karaqueña', { categoria: 'Mekatos', precioVenta: 3000 }),
    ], ['Mekatos']);
    expect(plan.resultado.precioVenta).toBe(3000);
    expect(plan.resultado.precioVentaCompletado).toBe(true);
  });

  it('precios de venta muy distintos entre sueltos: dudoso', () => {
    const plan = planDeUnion([pv('1', 'Piezza jirafa', { precioVenta: 14400 }), pv('2', 'piazza jirafa', { precioVenta: 1100 })]);
    expect(plan.nivel).toBe('dudoso');
  });

  it('distancia de letras', () => {
    expect(distanciaLetras('agua crital', 'agua cristal')).toBe(1);
    expect(distanciaLetras('pony', 'ponny')).toBe(1);
  });
});

describe('costo verdadero = compra más reciente (2026-11-23)', () => {
  it('toma el costo del proveedor con la fecha más nueva, aunque sea del duplicado', () => {
    const plan = planDeUnion([
      pv('a', 'Agua crital 600ml', { precioVenta: 4200, categoria: 'Postobón', proveedores: [{ proveedorId: 'c', proveedor: 'Carmen', costo: 2700, cantidadEmbalaje: 1, fecha: '2026-05-10' }] }),
      pv('b', 'Agua cristal 600 *24', { categoria: 'Postobón', proveedores: [{ proveedorId: 'p', proveedor: 'Postobón', costo: 29999, cantidadEmbalaje: 1, fecha: '2026-11-20' }] }),
    ], ['Postobón']);
    expect(plan.resultado.costoFuente).toMatchObject({ proveedor: 'Postobón', fecha: '2026-11-20', cantidadEmbalaje: 24 });
    expect(plan.resultado.costoUnitario).toBe(1250);
    expect(plan.resultado.precioVenta).toBe(4200);
  });
});
