import { describe, it, expect } from 'vitest';
import { armarVinculoProveedor } from './vinculo-proveedor';

describe('armarVinculoProveedor', () => {
  it('usa el proveedor de la factura cuando el formulario no eligió uno', () => {
    const v = armarVinculoProveedor({
      productoId: 'p1',
      proveedorIdForm: '',
      proveedorIdRecepcion: 'prov-colombina',
      precioCosto: 55595.96,
    });
    expect(v).toEqual({ productoId: 'p1', proveedorId: 'prov-colombina', precioCosto: 55595.96 });
  });

  it('prefiere el proveedor elegido en el formulario sobre el de la factura', () => {
    const v = armarVinculoProveedor({
      productoId: 'p1',
      proveedorIdForm: 'prov-otro',
      proveedorIdRecepcion: 'prov-colombina',
      precioCosto: 1000,
    });
    expect(v?.proveedorId).toBe('prov-otro');
  });

  it('no vincula si no hay ningún proveedor', () => {
    expect(armarVinculoProveedor({ productoId: 'p1', precioCosto: 1000 })).toBeNull();
  });

  it.each([0, -5, NaN, Infinity])('no vincula con costo inválido (%s)', (costo) => {
    expect(
      armarVinculoProveedor({ productoId: 'p1', proveedorIdRecepcion: 'prov', precioCosto: costo }),
    ).toBeNull();
  });

  it('no vincula sin id de producto', () => {
    expect(
      armarVinculoProveedor({ productoId: '', proveedorIdRecepcion: 'prov', precioCosto: 100 }),
    ).toBeNull();
  });

  it('redondea el costo a 2 decimales y conserva las notas con texto', () => {
    const v = armarVinculoProveedor({
      productoId: 'p1',
      proveedorIdRecepcion: 'prov',
      precioCosto: 10.456,
      notas: '  caja x10  ',
    });
    expect(v).toEqual({ productoId: 'p1', proveedorId: 'prov', precioCosto: 10.46, notas: 'caja x10' });
  });
});
