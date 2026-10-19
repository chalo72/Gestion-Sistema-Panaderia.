import { describe, it, expect, vi, afterEach } from 'vitest';
import { hoyLocalYMD, ymdLocal, ymdLocalDeISO } from './fecha-local';

// Las fechas se construyen con componentes LOCALES, así que pasan en cualquier zona horaria.
const noche = () => new Date(2026, 9, 18, 20, 0, 0); // 18-oct-2026, 8:00 p. m. local

describe('fecha-local', () => {
  afterEach(() => vi.useRealTimers());

  it('ymdLocal usa el calendario local', () => {
    expect(ymdLocal(noche())).toBe('2026-10-18');
  });

  it('ymdLocalDeISO respeta YYYY-MM-DD sin hora y rechaza basura', () => {
    expect(ymdLocalDeISO('2026-10-18')).toBe('2026-10-18');
    expect(ymdLocalDeISO('')).toBe('');
    expect(ymdLocalDeISO(undefined)).toBe('');
    expect(ymdLocalDeISO('no-es-fecha')).toBe('');
  });

  it('una caja cerrada a las 8 p. m. locales sigue siendo del mismo día', () => {
    expect(ymdLocalDeISO(noche().toISOString())).toBe('2026-10-18');
  });

  it('hoyLocalYMD a las 8 p. m. locales no salta al día siguiente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(noche());
    expect(hoyLocalYMD()).toBe('2026-10-18');
  });
});
