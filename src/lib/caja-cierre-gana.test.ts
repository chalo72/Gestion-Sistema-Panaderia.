import { describe, it, expect } from 'vitest';
import { mergeHydrateItem, mergeCajaCierreGana } from './sync-merge-local-gana';

// 2026-11-07: el PC conservaba abierta la caja de ayer aunque la nube ya la había cerrado,
// y luego la volvía a subir como abierta. Una caja cerrada nunca se reabre.
describe('sesiones_caja: el cierre siempre gana', () => {
  const abierta = { id: 'c1', estado: 'abierta', montoCierre: 0, updatedAt: '2026-11-07T16:18:00Z', cajaNombre: 'Caja 1' };
  const cerrada = { id: 'c1', estado: 'cerrada', montoCierre: 120000, fechaCierre: '2026-11-07T08:05:00Z', updatedAt: '2026-11-07T08:05:00Z' };

  it('nube cerrada + local abierta (local más nuevo) → queda cerrada', () => {
    const r = mergeHydrateItem('sesiones_caja', abierta as any, cerrada as any) as any;
    expect(r.estado).toBe('cerrada');
    expect(r.montoCierre).toBe(120000);
    expect(r.fechaCierre).toBe('2026-11-07T08:05:00Z');
    expect(r.cajaNombre).toBe('Caja 1');
  });

  it('local cerrada + nube abierta → queda cerrada', () => {
    const r = mergeHydrateItem('sesiones_caja', cerrada as any, { ...abierta, updatedAt: '2026-11-08T00:00:00Z' } as any) as any;
    expect(r.estado).toBe('cerrada');
    expect(r.montoCierre).toBe(120000);
  });

  it('sin conflicto de estado no interviene', () => {
    expect(mergeCajaCierreGana(abierta as any, abierta as any)).toBeUndefined();
  });

  it('otras colecciones no se afectan', () => {
    const r = mergeHydrateItem('mesas', { id: 'm', estado: 'abierta' } as any, { id: 'm', estado: 'cerrada' } as any) as any;
    expect(r.estado).toBe('abierta');
  });
});
