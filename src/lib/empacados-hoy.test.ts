import { describe, it, expect } from 'vitest';
import { esPanEmpaque, calcularEmpacados } from './empacados-hoy';
import type { Despacho } from './rutas-reparto';

const productos = [
  { id: 'ali', nombre: 'Pan aliñado empacado', categoria: 'Panes', descripcion: 'Pan de empaque', tipo: 'elaborado' },
  { id: 'cor', nombre: 'Pan corona empacado', categoria: 'Panes', tipo: 'elaborado' },
  { id: 'fra', nombre: 'Pan francés', categoria: 'Panes', tipo: 'elaborado' },
  { id: 'bol', nombre: 'Bolsa de empaque', categoria: 'INS: Panadería', tipo: 'ingrediente' },
];

// Jueves 19-nov-2026 → jueves anteriores: 12, 5 nov, 29 y 22 oct
const hoy = new Date('2026-11-19T08:00:00');

describe('empacados de hoy', () => {
  it('reconoce los panes de empaque y deja fuera insumos y panes sueltos', () => {
    expect(productos.filter(esPanEmpaque).map(p => p.id)).toEqual(['ali', 'cor']);
  });

  it('suma panadería + rutas del mismo día de la semana y resta lo que hay', () => {
    const ventas = [
      { fecha: '2026-11-12T15:00:00', items: [{ productoId: 'ali', cantidad: 10 }] },
      { fecha: '2026-11-05T15:00:00', items: [{ productoId: 'ali', cantidad: 6 }, { productoId: 'fra', cantidad: 50 }] },
      { fecha: '2026-11-18T15:00:00', items: [{ productoId: 'ali', cantidad: 99 }] }, // miércoles: no cuenta
    ];
    const despachos = [{
      id: 'd', fecha: '2026-11-12', vendedor: 'S', rutaNombre: 'Vereda', estado: 'liquidado',
      carga: [{ productoId: 'ali', nombre: 'Pan aliñado empacado', cantidad: 20, precioUnit: 2400, costoUnit: 0 }],
      paradas: [], regreso: [{ productoId: 'ali', buenos: 4, danados: 0 }], actualizadoEn: 1,
    }] as unknown as Despacho[];
    const filas = calcularEmpacados({ productos, ventas, despachos, stock: { ali: 3 }, bases: { cor: 12 }, hoy });
    const ali = filas.find(f => f.productoId === 'ali')!;
    // 2 jueves con movimiento: panadería (10+6)/2 = 8, rutas 16/2 = 8 → 16, menos 3 en estante = 13
    expect(ali.promTienda).toBe(8);
    expect(ali.promRuta).toBe(8);
    expect(ali.hacer).toBe(13);
    expect(ali.porBase).toBe(false);
    const cor = filas.find(f => f.productoId === 'cor')!;
    expect(cor.porBase).toBe(true);
    expect(cor.hacer).toBe(12);
  });

  it('nunca pide un número negativo', () => {
    const filas = calcularEmpacados({ productos, ventas: [], despachos: [], stock: { cor: 50 }, bases: { cor: 10 }, hoy });
    expect(filas.find(f => f.productoId === 'cor')!.hacer).toBe(0);
  });
});
