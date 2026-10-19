import { describe, it, expect } from 'vitest';
import { parsearDineroCO } from './parseo-dinero';

describe('parsearDineroCO — tabla de casos del proyecto', () => {
  const casos: Array<[string, number]> = [
    ['45.000', 45000],
    ['1.234.567', 1234567],
    ['45.5', 45.5],
    ['0.99', 0.99],
    ['45,5', 45.5],
    ['45,000', 45000],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.500', 1500],
    ['1,500', 1500],
    ['1500,5', 1500.5],
    ['1500', 1500],
    ['0,5', 0.5],
    ['1.000.000', 1000000],
    ['1.234.567,89', 1234567.89],
    ['$ 1.500', 1500],
    [' 675 ', 675],
  ];

  it.each(casos)('"%s" → %d', (texto, esperado) => {
    expect(parsearDineroCO(texto)).toBe(esperado);
  });
});

describe('parsearDineroCO — entradas inválidas devuelven NaN', () => {
  it.each(['', '   ', 'abc', '12a', '--5', '1..5x', '$'])('"%s"', (texto) => {
    expect(parsearDineroCO(texto)).toBeNaN();
  });

  it('null, undefined y números no finitos', () => {
    expect(parsearDineroCO(null)).toBeNaN();
    expect(parsearDineroCO(undefined)).toBeNaN();
    expect(parsearDineroCO(Infinity)).toBeNaN();
  });

  it('un número ya numérico pasa tal cual', () => {
    expect(parsearDineroCO(1500.5)).toBe(1500.5);
  });
});

describe('contraste con parseFloat (el bug original)', () => {
  it('parseFloat daba valores ~1000 veces menores con formato colombiano', () => {
    expect(parseFloat('1.500')).toBe(1.5);
    expect(parseFloat('1,500')).toBe(1);
    expect(parsearDineroCO('1.500')).toBe(1500);
    expect(parsearDineroCO('1,500')).toBe(1500);
  });
});

describe('Mayoristas — precio manual (campo de texto) usa el parseo colombiano', () => {
  it('no queda parseFloat(tempPrecio) y el prefill redondea a 2 decimales (evita ambigüedad de "1234.567")', async () => {
    const mod = await import('../pages/Mayoristas.tsx?raw');
    const src: string = mod.default;
    expect(src).not.toContain('parseFloat(tempPrecio)');
    expect(src.match(/parsearDineroCO\(tempPrecio\)/g)?.length).toBe(2);
    expect(src).toContain('setTempPrecio(String(Math.round(d.precioMayorista * 100) / 100))');
  });
});
