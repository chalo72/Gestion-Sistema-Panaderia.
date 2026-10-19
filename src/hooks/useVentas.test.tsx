// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let sesionesNube: any[] = [];

vi.mock('@/lib/database', () => ({
  db: {
    getAllSesionesCaja: vi.fn(async () => sesionesNube),
    getAllVentas: vi.fn(async () => []),
    getAllMesas: vi.fn(async () => []),
    getAllPedidosActivos: vi.fn(async () => []),
    addSesionCaja: vi.fn(async () => {}),
    updateSesionCaja: vi.fn(async () => {}),
  },
}));
vi.mock('@/lib/supabase-db', () => ({
  SupabaseDatabase: class {
    addSesionCaja = vi.fn(async () => {});
    updateSesionCaja = vi.fn(async () => {});
    addVenta = vi.fn(async () => {});
  },
}));
vi.mock('@/lib/security-agent', () => ({ procesarCuadreTurno: vi.fn() }));
vi.mock('@/lib/finanzas-personales', () => ({ upsertCajaEnVentaDiaria: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useVentas, avisarFalloNube } from './useVentas';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const caja = (id: string, estado: 'abierta' | 'cerrada' = 'abierta') =>
  ({ id, usuarioId: 'u', estado, fechaApertura: '2026-10-18T14:00:00.000Z', montoApertura: 0, totalVentas: 0, movimientos: [], ventasIds: [] }) as any;

describe('useVentas — caja activa ante cambios remotos', () => {
  let root: Root;
  let host: HTMLElement;
  let api: ReturnType<typeof useVentas>;

  const Probe = () => {
    api = useVentas({ onAjustarStock: async () => {} });
    return null;
  };

  const cambioRemotoDeCaja = async () => {
    await act(async () => {
      window.dispatchEvent(new CustomEvent('nexus-realtime-change', { detail: { table: 'caja', eventType: 'UPDATE', id: 'x' } }));
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    host = document.createElement('div');
    root = createRoot(host);
    act(() => root.render(createElement(Probe)));
  });
  afterEach(() => act(() => root.unmount()));

  it('mantiene MI caja aunque en la nube haya otras cajas abiertas', async () => {
    act(() => api.setCajaActiva(caja('mia')));
    sesionesNube = [caja('ajena-1'), caja('ajena-2'), caja('mia')];
    await cambioRemotoDeCaja();
    expect(api.cajaActiva?.id).toBe('mia');
    expect(api.sesionesCaja).toHaveLength(3);
  });

  it('suelta mi caja solo si se cerró desde otro dispositivo', async () => {
    act(() => api.setCajaActiva(caja('mia')));
    sesionesNube = [caja('mia', 'cerrada'), caja('ajena-1')];
    await cambioRemotoDeCaja();
    expect(api.cajaActiva).toBeUndefined();
  });

  it('no adopta la caja de otro dispositivo cuando no tengo ninguna activa', async () => {
    sesionesNube = [caja('ajena-1')];
    await cambioRemotoDeCaja();
    expect(api.cajaActiva).toBeUndefined();
    expect(api.sesionesCaja).toHaveLength(1);
  });
});

describe('avisarFalloNube', () => {
  it('registra el fallo en consola en vez de tragarlo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    avisarFalloNube('subir venta')(new Error('sin red'));
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('subir venta');
    warn.mockRestore();
  });
});
