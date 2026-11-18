import { describe, it, expect, beforeEach, vi } from 'vitest';

// La nube no existe en tests: se simula para comprobar que cada evento se intenta subir
const subidos: any[] = [];
vi.mock('@/lib/seguridad-nube', () => ({
  subirEventoSeguridad: (e: any) => { subidos.push(e); },
  bajarEventosSeguridad: async () => [],
  marcarLeidaNube: () => {},
  reintentarColaSeguridad: async () => {},
}));

import {
  procesarCuadreTurno, vigilarMovimientoCaja, getAlertas, getLogsActividad,
} from '@/lib/security-agent';

const baseCuadre = {
  usuarioId: 'u1', usuarioNombre: 'Ana', fechaApertura: new Date().toISOString(),
  montoApertura: 50000, ventasNequi: 0, ventasTransferencia: 0, ventasCredito: 0,
};

describe('vigilancia de cajas', () => {
  beforeEach(() => { localStorage.clear(); subidos.length = 0; });

  it('el cuadre descuenta los retiros: retiro registrado no es faltante', () => {
    const c = procesarCuadreTurno({ ...baseCuadre, ventasEfectivo: 100000, salidas: 40000, montoDeclarado: 110000 });
    expect(c.montoEsperado).toBe(110000);
    expect(c.alertaGenerada).toBe(false);
  });

  it('faltante real genera alerta y se sube a la nube', () => {
    const c = procesarCuadreTurno({ ...baseCuadre, ventasEfectivo: 100000, montoDeclarado: 120000 });
    expect(c.diferencia).toBe(-30000);
    expect(getAlertas()[0].tipo).toBe('faltante_caja');
    expect(subidos.some(e => e.tipo === 'alerta')).toBe(true);
    expect(subidos.some(e => e.tipo === 'cuadre')).toBe(true);
  });

  it('retiro grande alerta; retiro pequeño con motivo solo queda en bitácora', () => {
    vigilarMovimientoCaja({ tipo: 'salida', monto: 5000, motivo: 'compra de hielo', usuarioNombre: 'Ana' });
    expect(getAlertas()).toHaveLength(0);
    expect(getLogsActividad()[0].accion).toBe('retiro_caja');

    vigilarMovimientoCaja({ tipo: 'salida', monto: 80000, motivo: 'pago proveedor', usuarioNombre: 'Ana' });
    expect(getAlertas()).toHaveLength(1);
  });

  it('retiro sin motivo siempre alerta', () => {
    vigilarMovimientoCaja({ tipo: 'salida', monto: 2000, motivo: '', usuarioNombre: 'Ana' });
    expect(getAlertas()[0].descripcion).toContain('NO ESCRIBIÓ MOTIVO');
  });
});
