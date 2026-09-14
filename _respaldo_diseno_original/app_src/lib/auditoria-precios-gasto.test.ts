import { describe, expect, it } from 'vitest';
import {
  calcularPrecioPackFactura,
  compararLineaConCatalogo,
  resumirComparaciones,
} from './auditoria-precios-gasto';
import type { PrecioProveedor, Producto } from '@/types';

const productos: Producto[] = [
  {
    id: 'p1',
    nombre: 'Harina Trigo',
    categoria: 'Harinas',
    precioVenta: 0,
    margenUtilidad: 0,
    tipo: 'ingrediente',
    createdAt: '2026-01-01',
  },
];

const precios: PrecioProveedor[] = [
  {
    id: 'px1',
    productoId: 'p1',
    proveedorId: 'prov1',
    precioCosto: 50000,
    fechaActualizacion: '2026-01-01',
  },
];

describe('auditoria-precios-gasto', () => {
  it('calcula precio por pack desde total y cantidad', () => {
    expect(calcularPrecioPackFactura(2, 100000)).toBe(50000);
    expect(calcularPrecioPackFactura(0, 75000)).toBe(75000);
  });

  it('detecta subida de precio vs catálogo', () => {
    const r = compararLineaConCatalogo(
      { nombre: 'Harina Trigo', cantidad: 1, montoTotal: 55000 },
      'prov1',
      productos,
      precios,
    );
    expect(r.estado).toBe('subio');
    expect(r.precioPackCatalogo).toBe(50000);
    expect(r.precioPackFactura).toBe(55000);
  });

  it('detecta precio igual con tolerancia', () => {
    const r = compararLineaConCatalogo(
      { nombre: 'Harina Trigo', cantidad: 1, montoTotal: 50050 },
      'prov1',
      productos,
      precios,
    );
    expect(r.estado).toBe('igual');
  });

  it('pide proveedor para comparar', () => {
    const r = compararLineaConCatalogo(
      { nombre: 'Harina Trigo', cantidad: 1, montoTotal: 50000 },
      undefined,
      productos,
      precios,
    );
    expect(r.estado).toBe('sin_proveedor');
  });

  it('resume alertas por tipo', () => {
    const lista = [
      compararLineaConCatalogo(
        { nombre: 'Harina Trigo', cantidad: 1, montoTotal: 60000 },
        'prov1',
        productos,
        precios,
      ),
      compararLineaConCatalogo(
        { nombre: 'Harina Trigo', cantidad: 1, montoTotal: 50000 },
        'prov1',
        productos,
        precios,
      ),
    ];
    const resumen = resumirComparaciones(lista);
    expect(resumen.subieron).toHaveLength(1);
    expect(resumen.iguales).toBe(1);
  });
});
