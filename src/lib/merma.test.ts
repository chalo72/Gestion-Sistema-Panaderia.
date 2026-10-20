import { describe, it, expect } from 'vitest';
import type { MovimientoInventario } from '@/types';
import {
  construirMotivoMerma, construirMotivoAnulacion, parsearMotivoMerma, extraerMermas,
  resumirMermas, filtrarPorPeriodo, esMovimientoMerma,
} from './merma';

const mov = (p: Partial<MovimientoInventario>): MovimientoInventario => ({
  id: Math.random().toString(36).slice(2), productoId: 'p1', tipo: 'salida', cantidad: 1,
  motivo: '', fecha: new Date().toISOString(), usuario: 'x', ...p,
} as MovimientoInventario);

describe('merma', () => {
  it('construye y vuelve a leer el motivo', () => {
    const m = construirMotivoMerma({ causa: 'Quemado en horno', nota: 'horno · caliente', usuario: 'Ana', token: 'ab12' });
    expect(m).toBe('Merma · Quemado en horno · nota: horno - caliente · por Ana · #ab12');
    expect(parsearMotivoMerma(m)).toEqual({ causa: 'Quemado en horno', nota: 'horno - caliente', usuario: 'Ana', token: 'ab12' });
  });

  it('reconoce formato antiguo y no confunde otras salidas', () => {
    expect(esMovimientoMerma({ tipo: 'salida', motivo: 'Merma: Quemado' })).toBe(true);
    expect(esMovimientoMerma({ tipo: 'salida', motivo: 'Venta POS' })).toBe(false);
    expect(esMovimientoMerma({ tipo: 'entrada', motivo: 'Merma · X · #1' })).toBe(false);
  });

  it('las anuladas no cuentan en el resumen', () => {
    const movs = [
      mov({ id: 'a', cantidad: 5, motivo: construirMotivoMerma({ causa: 'Quemado en horno', token: 't1' }) }),
      mov({ id: 'b', cantidad: 3, motivo: construirMotivoMerma({ causa: 'Caída / accidente', token: 't2' }) }),
      mov({ id: 'c', tipo: 'entrada', cantidad: 3, motivo: construirMotivoAnulacion('t2') }),
    ];
    const regs = extraerMermas(movs);
    expect(regs).toHaveLength(2);
    expect(regs.find((r) => r.token === 't2')?.anulada).toBe(true);
    const r = resumirMermas(regs, () => ({ nombre: 'Pan de sal', categoria: 'Pan de sal', costoUnitario: 200, ventaUnitaria: 500 }));
    expect(r.unidades).toBe(5);
    expect(r.costo).toBe(1000);
    expect(r.venta).toBe(2500);
    expect(r.porCausa[0].nombre).toBe('Quemado en horno');
    expect(r.porCategoria[0].nombre).toBe('Pan de sal');
  });

  it('filtra por periodo', () => {
    const hoy = new Date('2026-10-08T15:00:00');
    const regs = extraerMermas([
      mov({ id: '1', fecha: '2026-10-08T09:00:00', motivo: 'Merma · Otro · #a' }),
      mov({ id: '2', fecha: '2026-10-03T09:00:00', motivo: 'Merma · Otro · #b' }),
      mov({ id: '4', fecha: '2026-09-20T09:00:00', motivo: 'Merma · Otro · #d' }),
      mov({ id: '3', fecha: '2026-08-01T09:00:00', motivo: 'Merma · Otro · #c' }),
    ]);
    expect(filtrarPorPeriodo(regs, 'hoy', hoy)).toHaveLength(1);
    expect(filtrarPorPeriodo(regs, '7d', hoy)).toHaveLength(2);
    expect(filtrarPorPeriodo(regs, '30d', hoy)).toHaveLength(3);
    expect(filtrarPorPeriodo(regs, 'todo', hoy)).toHaveLength(4);
  });
});
