import { describe, it, expect, beforeEach } from 'vitest';
import {
  fusionarGastosUnicos,
  fusionarGastosEnEstado,
  leerCacheGastos,
  guardarCacheGastos,
} from './gastos-hidratacion';
import type { Gasto } from '@/types';

const gasto = (id: string, monto: number): Gasto => ({
  id,
  descripcion: `Gasto ${id}`,
  monto,
  categoria: 'Otros',
  fecha: '2026-03-01',
  estado: 'pagado',
  metodoPago: 'efectivo',
  usuarioId: 'u1',
});

describe('gastos-hidratacion', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('fusiona sin duplicar por id', () => {
    const a = [gasto('1', 100)];
    const b = [gasto('1', 150), gasto('2', 50)];
    const merged = fusionarGastosUnicos(a, b);
    expect(merged).toHaveLength(2);
    expect(merged.find((g) => g.id === '1')?.monto).toBe(150);
  });

  it('no vacía estado si llega lista vacía', () => {
    const prev = [gasto('1', 100)];
    const next = fusionarGastosEnEstado(prev, []);
    expect(next).toHaveLength(1);
    expect(next[0].monto).toBe(100);
  });

  it('guarda y lee caché de sesión', () => {
    guardarCacheGastos([gasto('x', 99)]);
    expect(leerCacheGastos()).toHaveLength(1);
  });
});
