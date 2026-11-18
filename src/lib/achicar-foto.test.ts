import { describe, it, expect } from 'vitest';
import { medidasAchicadas } from './achicar-foto';

describe('medidasAchicadas (fotos de consumo livianas)', () => {
  it('achica una foto de celular grande a 1000 px manteniendo la proporción', () => {
    expect(medidasAchicadas(4000, 3000)).toEqual({ ancho: 1000, alto: 750 });
    expect(medidasAchicadas(3000, 4000)).toEqual({ ancho: 750, alto: 1000 });
  });

  it('no agranda una foto pequeña', () => {
    expect(medidasAchicadas(640, 480)).toEqual({ ancho: 640, alto: 480 });
  });

  it('medidas inválidas devuelven cero', () => {
    expect(medidasAchicadas(0, 100)).toEqual({ ancho: 0, alto: 0 });
  });
});
