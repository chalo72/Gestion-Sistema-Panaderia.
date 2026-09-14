import { describe, it, expect } from 'vitest';
import { esMismoDiaLocal, fechaCalendarioLocalDesdeISO, estaEnRangoCalendarioLocal } from '@/lib/fecha-ventas';
import { fechaLocalHoy } from '@/lib/finanzas-personales';

describe('fecha-ventas', () => {
  it('fechaCalendarioLocalDesdeISO respeta día local en ISO UTC', () => {
    const hoy = fechaLocalHoy();
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    expect(fechaCalendarioLocalDesdeISO(d.toISOString())).toBe(hoy);
  });

  it('venta después de las 20:00 local no cae en día UTC siguiente', () => {
    const local = new Date();
    local.setHours(20, 30, 0, 0);
    const diaLocal = fechaCalendarioLocalDesdeISO(local.toISOString());
    const esperado = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(diaLocal).toBe(esperado);
    expect(esMismoDiaLocal(local.toISOString())).toBe(true);
  });

  it('estaEnRangoCalendarioLocal incluye ventas nocturnas del día', () => {
    const local = new Date();
    local.setHours(21, 0, 0, 0);
    const dia = fechaCalendarioLocalDesdeISO(local.toISOString());
    expect(estaEnRangoCalendarioLocal(local.toISOString(), dia, dia)).toBe(true);
  });

  it('esMismoDiaLocal con YYYY-MM-DD', () => {
    expect(esMismoDiaLocal(fechaLocalHoy())).toBe(true);
    expect(esMismoDiaLocal('1999-01-01')).toBe(false);
  });
});
