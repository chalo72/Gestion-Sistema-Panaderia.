import { describe, expect, it } from 'vitest';
import {
  buscarProveedorIdPorNombre,
  catalogoProductosProveedor,
  mapComprasRealesALineasOC,
  normalizarNombreProv,
  resolverProveedorPresupuesto,
} from './presupuesto-catalogo';

describe('presupuesto-catalogo', () => {
  const proveedores = [
    { id: 'p1', nombre: 'Postobón' },
    { id: 'p2', nombre: 'Huevos del Norte' },
  ];
  const productos = [
    { id: 'a', nombre: 'Gaseosa 2L' },
    { id: 'b', nombre: 'Agua 600ml' },
    { id: 'c', nombre: 'Huevo AA' },
  ];
  const precios = [
    { proveedorId: 'p1', productoId: 'a', precioCosto: 4500 },
    { proveedorId: 'p1', productoId: 'b', precioCosto: 1200 },
    { proveedorId: 'p2', productoId: 'c', precioCosto: 18000 },
  ];

  it('normaliza acentos y espacios (postobon ≈ Postobón)', () => {
    expect(normalizarNombreProv('Postobón')).toBe('postobon');
    expect(normalizarNombreProv('postobon')).toBe('postobon');
  });

  it('resuelve proveedor por nombre sin acento', () => {
    const p = resolverProveedorPresupuesto('postobon', proveedores);
    expect(p?.id).toBe('p1');
  });

  it('prioriza proveedorId si viene en el presupuesto', () => {
    const p = resolverProveedorPresupuesto('cualquier', proveedores, 'p2');
    expect(p?.id).toBe('p2');
  });

  it('filtra solo productos del proveedor con precio', () => {
    const cat = catalogoProductosProveedor('postobon', proveedores, productos, precios);
    expect(cat).toHaveLength(2);
    expect(cat.map((c) => c.nombre)).toEqual(['Agua 600ml', 'Gaseosa 2L']);
    expect(cat.find((c) => c.nombre === 'Gaseosa 2L')?.precioUnitario).toBe(4500);
  });

  it('buscarProveedorIdPorNombre enlaza postobon → id', () => {
    expect(buscarProveedorIdPorNombre('postobon', proveedores)).toBe('p1');
  });

  it('mapea comprasReales a líneas de OC y omite sin match', () => {
    const { lineas, omitidas } = mapComprasRealesALineasOC(
      [
        { producto: 'Gaseosa 2L', cantidad: 2, montoReal: 9000 },
        { producto: 'Algo inventado', cantidad: 1, montoReal: 100 },
      ],
      'postobon',
      proveedores,
      productos,
      precios
    );
    expect(lineas).toHaveLength(1);
    expect(lineas[0].productoId).toBe('a');
    expect(lineas[0].cantidad).toBe(2);
    expect(lineas[0].precioUnitario).toBe(4500);
    expect(omitidas).toBe(1);
  });
});
