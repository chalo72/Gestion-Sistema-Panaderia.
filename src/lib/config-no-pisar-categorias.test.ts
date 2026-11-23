import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 2026-11-23: guardar la configuración en CADA carga hacía que el último aparato en abrir la app
// impusiera su lista vieja de categorías en la nube (volvían las borradas, se perdía «Colanta»).
const src = readFileSync(resolve(__dirname, '../hooks/usePriceControl.ts'), 'utf-8');

describe('la carga no pisa las categorías de otros aparatos', () => {
  it('solo guarda la configuración al cargar si cambió algo', () => {
    expect(src).toContain('if (cambioAlCargar) await db.saveConfiguracion({ ...finalConfig, id: \'main\' });');
    expect(src).not.toMatch(/\n\s*await db\.saveConfiguracion\(\{ \.\.\.finalConfig, id: 'main' \}\);/);
  });
});
