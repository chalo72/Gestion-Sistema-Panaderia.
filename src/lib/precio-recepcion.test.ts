import { describe, it, expect } from 'vitest';
import { precioParaRecepcion, describirEmpaque } from './precio-recepcion';

const pp = (id: string, proveedorId: string, precioCosto: number, fechaActualizacion: string, cantidadEmbalaje?: number, tipoEmbalaje?: string) =>
  ({ id, productoId: 'agua600', proveedorId, precioCosto, fechaActualizacion, cantidadEmbalaje, tipoEmbalaje } as any);

describe('precioParaRecepcion (agua Pool: paca, no botella)', () => {
  const precios = [
    pp('a', 'camercar', 14000, '2026-05-25T00:00:00Z', 20, 'paca'),
    pp('b', 'bigcola', 13500, '2026-03-01T00:00:00Z', 20, 'paca'),
  ];

  it('usa el precio del proveedor escogido', () => {
    const r = precioParaRecepcion(precios, 'agua600', 'camercar', 700);
    expect(r).toMatchObject({ precio: 14000, fuente: 'proveedor' });
  });

  it('si el proveedor escogido no lo tiene, usa la paca más reciente de otro (no $700 por botella)', () => {
    const r = precioParaRecepcion(precios, 'agua600', 'comercar-repetido', 700);
    expect(r.fuente).toBe('otro-proveedor');
    expect(r.precio).toBe(14000);
    expect(r.referencia?.proveedorId).toBe('camercar');
  });

  it('sin proveedor escogido también usa la paca', () => {
    expect(precioParaRecepcion(precios, 'agua600', '', 700).precio).toBe(14000);
  });

  it('solo si ningún proveedor tiene precio, usa el costo por unidad', () => {
    expect(precioParaRecepcion([], 'agua600', 'camercar', 700)).toMatchObject({ precio: 700, fuente: 'unidad' });
    expect(precioParaRecepcion([], 'agua600', 'camercar', 0)).toMatchObject({ precio: 0, fuente: 'ninguno' });
  });

  it('ignora precios en cero', () => {
    // El proveedor escogido tiene el precio en $0: no sirve, se usa la paca de otro
    const r = precioParaRecepcion([pp('z', 'nuevo', 0, '2026-11-01T00:00:00Z'), ...precios], 'agua600', 'nuevo', 700);
    expect(r.fuente).toBe('otro-proveedor');
    expect(r.precio).toBe(14000);
  });

  it('describe el empaque', () => {
    expect(describirEmpaque(precios[0])).toBe('paca x20');
    expect(describirEmpaque(pp('u', 'x', 1, '', 1, 'unidad'))).toBe('');
  });
});
