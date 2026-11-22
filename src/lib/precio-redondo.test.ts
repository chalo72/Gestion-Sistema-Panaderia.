import { describe, it, expect } from 'vitest';
import { redondearPrecio } from './precio-redondo';

describe('precio redondo', () => {
  it('quita los pesos corridos', () => {
    expect(redondearPrecio(2002)).toBe(2000);
    expect(redondearPrecio(3001)).toBe(3000);
    expect(redondearPrecio(7502)).toBe(7500);
    expect(redondearPrecio(501.65)).toBe(500);
    expect(redondearPrecio(2528)).toBe(2550);
  });
  it('no toca los que ya son redondos y no deja en cero', () => {
    expect(redondearPrecio(4500)).toBe(4500);
    expect(redondearPrecio(20)).toBe(50);
    expect(redondearPrecio(0)).toBe(0);
    expect(redondearPrecio('abc')).toBe(0);
  });
});
