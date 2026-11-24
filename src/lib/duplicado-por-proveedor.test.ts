import { describe, it, expect } from 'vitest';
import { tipoDeDuplicado, claveProveedor } from './duplicado-por-proveedor';

describe('duplicado según proveedor (2026-11-23)', () => {
  it('los dos El Carmen son el mismo proveedor', () => {
    expect(claveProveedor('El Carmen  Tienda  y Distribuidora ')).toBe(claveProveedor('Tienda Y Distribuidora El Carmen '));
  });
  it('mismo proveedor en los dos → es copia', () => {
    expect(tipoDeDuplicado([['El Carmen  Tienda  y Distribuidora'], ['Tienda Y Distribuidora El Carmen']])).toBe('mismo-proveedor');
  });
  it('Postobón en uno y El Carmen en otro → no borrar', () => {
    expect(tipoDeDuplicado([['Postobón-Distr'], ['El Carmen Tienda y Distribuidora']])).toBe('proveedores-distintos');
  });
  it('uno sin proveedor → ese es la copia', () => {
    expect(tipoDeDuplicado([['BIGCOLA-DISTR'], []])).toBe('sin-proveedor');
  });
});
