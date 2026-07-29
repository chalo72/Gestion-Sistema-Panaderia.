import { describe, it, expect, vi } from 'vitest';
import { construirDecisionesDirector } from './mano-derecha-director';

const base = {
  itemsBajoStock: 0,
  alertasNoLeidas: 0,
  ingresosHoy: 500_000,
  gastosHoy: 50_000,
  ventasHoy: 12,
  alcanzaQuincena: true,
  deficit: 0,
  hayProduccionHoy: true,
  ultimaProduccionFecha: '2026-07-28',
  formatCurrency: (n: number) => `$${n}`,
  onViewVentas: vi.fn(),
  onViewInventario: vi.fn(),
  onViewAlertas: vi.fn(),
  avisarReportes: vi.fn(),
};

describe('construirDecisionesDirector', () => {
  it('prioriza déficit de quincena y stock bajo como urgentes', () => {
    const decisiones = construirDecisionesDirector({
      ...base,
      alcanzaQuincena: false,
      deficit: 200_000,
      itemsBajoStock: 2,
    });
    expect(decisiones).toHaveLength(3);
    expect(decisiones[0].id).toBe('quincena-deficit');
    expect(decisiones[0].prioridad).toBe('urgente');
    expect(decisiones[1].id).toBe('stock-bajo');
  });

  it('sugiere día en orden cuando no hay problemas', () => {
    const decisiones = construirDecisionesDirector(base);
    expect(decisiones).toHaveLength(1);
    expect(decisiones[0].id).toBe('dia-ok');
  });

  it('avisa si no hay producción hoy', () => {
    const decisiones = construirDecisionesDirector({
      ...base,
      hayProduccionHoy: false,
    });
    expect(decisiones.some((d) => d.id === 'sin-produccion')).toBe(true);
  });
});
