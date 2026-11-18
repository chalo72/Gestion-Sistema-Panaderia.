import { describe, it, expect } from 'vitest';
import {
  nombreAparato, unirHistorial, tieneEventosNuevos, detalleCreado, detalleCambios,
  clasificarCreditoNomina, entraSoloEnNomina,
} from './historial-credito';

describe('historial de créditos', () => {
  it('reconoce el aparato', () => {
    expect(nombreAparato('Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-A032M Build/SP1A) Chrome')).toBe('Celular SAMSUNG SM-A032M');
    expect(nombreAparato('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome')).toBe('PC Windows');
    expect(nombreAparato('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iPhone');
  });

  it('une historiales de dos aparatos sin perder ni repetir eventos', () => {
    const a = [{ id: '1', fecha: '2026-11-03T14:40:00Z', accion: 'creado' }];
    const b = [{ id: '1', fecha: '2026-11-03T14:40:00Z', accion: 'creado' }, { id: '2', fecha: '2026-11-18T19:00:00Z', accion: 'cobrado' }];
    expect(unirHistorial(a, b).map(e => e.id)).toEqual(['1', '2']);
    expect(tieneEventosNuevos(b, a)).toBe(true);
    expect(tieneEventosNuevos(a, b)).toBe(false);
  });

  it('describe lo creado y lo que cambió', () => {
    expect(detalleCreado({ tipo: 'prestamo', monto: 200000, descripcion: 'colegio', trabajadorNombre: 'ANDREA ' }))
      .toBe('Préstamo $200.000 · colegio · a ANDREA');
    expect(detalleCambios({ monto: 100000, descripcion: 'x' }, { monto: 200000 })).toBe('monto $100.000 → $200.000');
    expect(detalleCambios({ monto: 100000 }, { saldo: 0, estado: 'descontado' })).toBe('');
  });
});

describe('nómina: qué se suma solo en la quincena (1–15 nov)', () => {
  const rango = { inicio: '2026-11-01', fin: '2026-11-15' };

  it('lo anotado en la quincena entra', () => {
    expect(clasificarCreditoNomina({ fecha: '2026-11-08T10:00:00Z', pagos: [] }, rango)).toBe('quincena');
  });

  it('lo de octubre que nunca se cobró ni se pospuso NO entra solo (sale aparte)', () => {
    const c = { fecha: '2026-10-28T15:00:00Z', pagos: [] };
    expect(clasificarCreditoNomina(c, rango)).toBe('atrasado');
    expect(entraSoloEnNomina('atrasado')).toBe(false);
  });

  it('lo pospuesto a propósito para esta quincena entra', () => {
    const c = { fecha: '2026-10-28T15:00:00Z', pagos: [{ monto: 0, cobrada: false, posponerHasta: '2026-11-01', nota: 'Pospuesto' }] };
    expect(clasificarCreditoNomina(c, rango)).toBe('pospuesto');
  });

  it('lo pospuesto para la próxima quincena todavía no entra', () => {
    const c = { fecha: '2026-11-05T15:00:00Z', pagos: [{ monto: 0, cobrada: false, posponerHasta: '2026-11-16' }] };
    expect(clasificarCreditoNomina(c, rango)).toBe('pospuesto_futuro');
  });

  it('un préstamo en cuotas que ya tuvo cobros sigue entrando', () => {
    const c = { fecha: '2026-10-07T10:00:00Z', pagos: [{ monto: 50000, cobrada: true, nota: 'Cuota cobrada · 1ra quincena Octubre' }] };
    expect(clasificarCreditoNomina(c, rango)).toBe('en_curso');
  });

  it('lo anotado después de la quincena no entra', () => {
    expect(clasificarCreditoNomina({ fecha: '2026-11-17T10:00:00Z' }, rango)).toBe('futuro');
  });
});
