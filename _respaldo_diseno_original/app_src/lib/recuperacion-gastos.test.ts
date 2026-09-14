import { describe, it, expect } from 'vitest';
import { normalizarGastoRecuperado } from './recuperacion-gastos';

describe('normalizarGastoRecuperado', () => {
  it('normaliza registro legacy con campos alternos', () => {
    const g = normalizarGastoRecuperado({
      id: 'abc-123',
      concepto: 'Harina 50kg',
      valor: 150000,
      fechaGasto: '2026-08-15',
      categoria: 'Materia Prima',
      metodo_pago: 'efectivo',
    });
    expect(g).not.toBeNull();
    expect(g?.descripcion).toBe('Harina 50kg');
    expect(g?.monto).toBe(150000);
    expect(g?.fecha).toBe('2026-08-15');
    expect(g?.estado).toBe('pagado');
  });

  it('rechaza filas sin monto válido', () => {
    expect(normalizarGastoRecuperado({ descripcion: 'x', monto: 0 })).toBeNull();
  });
});
