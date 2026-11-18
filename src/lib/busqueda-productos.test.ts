import { describe, expect, it } from 'vitest';
import type { Producto } from '@/types';
import {
  esProductoBusquedaVenta,
  esNombreBasura,
  esCategoriaInsumo,
  buscarProductosVenta,
  deduplicarPorNombre,
  coincideBusquedaProducto,
} from './busqueda-productos';

const base = (over: Partial<Producto>): Producto => ({
  id: over.id || '1',
  nombre: over.nombre || 'Pan Francés',
  categoria: over.categoria || 'Panes',
  precioVenta: over.precioVenta ?? 800,
  margenUtilidad: 30,
  tipo: over.tipo || 'elaborado',
  createdAt: '2026-01-01',
  ...over,
});

describe('busqueda-productos — espurgue inteligente', () => {
  it('oculta insumos SIN precio; muestra si tienen PVP aunque digan ingrediente', () => {
    expect(esProductoBusquedaVenta(base({ tipo: 'ingrediente', nombre: 'Harina', precioVenta: 0 }))).toBe(false);
    expect(
      esProductoBusquedaVenta(
        base({ tipo: 'ingrediente', nombre: 'Gelatina Boggy', precioVenta: 3500, categoria: 'INS: Helados' })
      )
    ).toBe(true);
    expect(esCategoriaInsumo('INS: Helados')).toBe(true);
    expect(esProductoBusquedaVenta(base({ nombre: 'Croissant', categoria: 'Panes' }))).toBe(true);
  });

  it('detecta nombres basura', () => {
    expect(esNombreBasura('test 1')).toBe(true);
    expect(esNombreBasura('Nuevo producto')).toBe(true);
    expect(esNombreBasura('')).toBe(true);
    expect(esNombreBasura('Pan de Bono')).toBe(false);
  });

  it('encuentra Gelatina Boggy aunque esté mal tipada o con typo', () => {
    const catalogo = [
      base({
        id: 'g1',
        nombre: 'Gelatina Boggy',
        tipo: 'ingrediente',
        precioVenta: 2500,
        categoria: 'Postres',
      }),
      base({ id: 'b', nombre: 'Harina Extra', tipo: 'ingrediente', precioVenta: 0, categoria: 'INS: Panadería' }),
      base({ id: 'c', nombre: 'test xxx', precioVenta: 100 }),
    ];
    const r = buscarProductosVenta(catalogo, 'gelatina boggy');
    expect(r.map((p) => p.id)).toContain('g1');
    expect(buscarProductosVenta(catalogo, 'boggi').map((p) => p.id)).toContain('g1');
    expect(coincideBusquedaProducto(catalogo[0], 'gelatina')).toBe(true);
  });

  it('no lista insumos sin precio ni nombres basura', () => {
    const catalogo = [
      base({ id: 'a', nombre: 'Pan Francés Tradicional', precioVenta: 800 }),
      base({ id: 'b', nombre: 'Harina Extra', tipo: 'ingrediente', precioVenta: 0, categoria: 'INS: Panadería' }),
      base({ id: 'c', nombre: 'test xxx', precioVenta: 100 }),
    ];
    const r = buscarProductosVenta(catalogo, 'pan');
    expect(r.map((p) => p.id)).toEqual(['a']);
  });

  it('encuentra por categoría y prefijo', () => {
    const catalogo = [
      base({ id: '1', nombre: 'Croissant de Mantequilla', categoria: 'Hojaldres', precioVenta: 2500 }),
      base({ id: '2', nombre: 'Pan de Bono', categoria: 'Panes', precioVenta: 1500 }),
    ];
    expect(buscarProductosVenta(catalogo, 'hojald').map((p) => p.id)).toContain('1');
    expect(buscarProductosVenta(catalogo, 'bono').map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por NOMBRE: no trae toda la categoría ni subcadenas a mitad de palabra', () => {
    const catalogo = [
      base({ id: 'p1', nombre: 'Pan Francés', categoria: 'Panadería' }),
      base({ id: 'p2', nombre: 'Croissant', categoria: 'Panadería' }),
      base({ id: 'p3', nombre: 'Empanada de Pollo', categoria: 'Fritos' }),
      base({ id: 'p4', nombre: 'Torta de Pan', categoria: 'Tortas' }),
      base({ id: 'p5', nombre: 'Gelatina Fresa', categoria: 'Postres' }),
      base({ id: 'p6', nombre: 'Gaseosa Fresa', categoria: 'Bebidas' }),
      base({ id: 'p7', nombre: 'Gelatina Boggy', categoria: 'Postres' }),
    ];
    const pan = buscarProductosVenta(catalogo, 'pan').map((p) => p.id);
    expect(pan[0]).toBe('p1');
    expect(pan).toContain('p4');
    expect(pan).not.toContain('p2');
    expect(pan).not.toContain('p3');

    expect(buscarProductosVenta(catalogo, 'gelatina fresa').map((p) => p.id)).toEqual(['p5']);
    expect(buscarProductosVenta(catalogo, 'postres').map((p) => p.id).sort()).toEqual(['p5', 'p7']);
    expect(buscarProductosVenta(catalogo, 'panes').map((p) => p.id)).toContain('p1');
  });

  it('deduplica por nombre normalizado', () => {
    const dups = [
      base({ id: '1', nombre: 'Pan Bono', precioVenta: 1000 }),
      base({ id: '2', nombre: 'pan  bono', precioVenta: 1500 }),
    ];
    const u = deduplicarPorNombre(dups);
    expect(u).toHaveLength(1);
    expect(u[0].id).toBe('2');
  });
});
