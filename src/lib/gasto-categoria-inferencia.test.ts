import { describe, it, expect } from 'vitest';
import {
  extraerNombreProductoDeDescripcion,
  inferirCategoriaGasto,
  normalizarCategoriaGasto,
  planificarRecategorizacionGastos,
  esCategoriaLegacyInvalida,
} from './gasto-categoria-inferencia';
import type { Gasto, Producto } from '@/types';

const productos: Producto[] = [
  {
    id: 'p1',
    nombre: 'Gaseosa Postobón 3L',
    categoria: 'Bebidas',
    precioVenta: 5000,
    margenUtilidad: 30,
    tipo: 'elaborado',
    createdAt: '2026-01-01',
  },
  {
    id: 'p2',
    nombre: 'Harina de trigo',
    categoria: 'INS: Panadería',
    precioVenta: 0,
    margenUtilidad: 0,
    tipo: 'ingrediente',
    createdAt: '2026-01-01',
  },
  {
    id: 'p3',
    nombre: 'Maní salado Colombina',
    categoria: 'Mecato',
    precioVenta: 2000,
    margenUtilidad: 25,
    tipo: 'elaborado',
    createdAt: '2026-01-01',
  },
  {
    id: 'p4',
    nombre: 'Galleta Ping Pong',
    categoria: 'Mecato',
    precioVenta: 1500,
    margenUtilidad: 20,
    tipo: 'elaborado',
    createdAt: '2026-01-01',
  },
  {
    id: 'p5',
    nombre: 'Omega Valor',
    categoria: 'Bebidas',
    precioVenta: 3000,
    margenUtilidad: 25,
    tipo: 'elaborado',
    createdAt: '2026-01-01',
  },
  {
    id: 'p6',
    nombre: 'Café instantáneo',
    categoria: 'INS: Cafetería',
    precioVenta: 0,
    margenUtilidad: 0,
    tipo: 'ingrediente',
    createdAt: '2026-01-01',
  },
];

describe('gasto-categoria-inferencia', () => {
  it('detecta categorías legacy inválidas', () => {
    expect(esCategoriaLegacyInvalida('Insumos')).toBe(true);
    expect(esCategoriaLegacyInvalida('Materia Prima')).toBe(false);
  });

  it('extrae nombre sin prefijo UNIDS', () => {
    expect(extraerNombreProductoDeDescripcion('50 UNIDS Gaseosa Postobon valor')).toBe(
      'Gaseosa Postobon'
    );
  });

  it('clasifica gaseosa como Otros (reventa)', () => {
    const r = inferirCategoriaGasto('Gaseosa Postobon 3L', productos);
    expect(r.categoria).toBe('Otros');
  });

  it('clasifica Omega Valor como Otros, no insumo', () => {
    const r = inferirCategoriaGasto('50 UNIDS Omega Valor valor', productos);
    expect(r.categoria).toBe('Otros');
  });

  it('clasifica galleta ping pong como Otros (mecato)', () => {
    const r = inferirCategoriaGasto('Galleta Ping Pong', productos);
    expect(r.categoria).toBe('Otros');
  });

  it('clasifica café instantáneo como Materia Prima', () => {
    const r = inferirCategoriaGasto('Cafe instantaneo', productos);
    expect(r.categoria).toBe('Materia Prima');
  });

  it('clasifica harina como Materia Prima', () => {
    const r = inferirCategoriaGasto('Harina trigo', productos);
    expect(r.categoria).toBe('Materia Prima');
  });

  it('planifica corrección de Insumos legacy a Otros para mecato', () => {
    const gastos: Gasto[] = [
      {
        id: 'g1',
        descripcion: '50 UNIDS Galleta Ping Pong valor',
        monto: 10000,
        categoria: 'Insumos' as Gasto['categoria'],
        fecha: '2026-08-01',
        estado: 'pagado',
        metodoPago: 'efectivo',
        usuarioId: 'u1',
      },
      {
        id: 'g2',
        descripcion: 'Omega Valor',
        monto: 5000,
        categoria: 'Insumos' as Gasto['categoria'],
        fecha: '2026-08-01',
        estado: 'pagado',
        metodoPago: 'efectivo',
        usuarioId: 'u1',
      },
    ];
    const plan = planificarRecategorizacionGastos(gastos, productos);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.every((p) => p.nueva === 'Otros')).toBe(true);
  });

  it('normaliza Insumos legacy', () => {
    expect(normalizarCategoriaGasto('Insumos')).toBe('Materia Prima');
  });
});
