/**
 * Guardián de la adaptación móvil del módulo "Ventas al Mayor" (src/pages/Mayoristas.tsx).
 *
 * Regla del trabajo: SOLO móvil, escritorio no cambia. Por eso todo ajuste visual va con
 * `max-md:` (solo < 768px) y las clases de escritorio originales deben seguir ahí.
 * Es un test de contrato sobre el código fuente (mismo estilo que blindaje-form-dashboard.test.ts):
 * si alguien borra un ajuste móvil o toca una clase de escritorio, falla.
 */
import { describe, it, expect } from 'vitest';
import src from '../pages/Mayoristas.tsx?raw';

/** Devuelve el className completo de la etiqueta JSX donde aparece `fragmento` (antes o después del atributo). */
const clasesDe = (fragmento: string): string => {
  const i = src.indexOf(fragmento);
  expect(i, `no se encontró "${fragmento}"`).toBeGreaterThan(-1);
  const inicioEtiqueta = src.lastIndexOf('<', i);
  const ini = src.indexOf('className="', inicioEtiqueta);
  expect(ini, `la etiqueta de "${fragmento}" no tiene className`).toBeGreaterThan(-1);
  const fin = src.indexOf('"', ini + 11);
  return src.slice(ini + 11, fin);
};

describe('Mayoristas — barra del ticket en el Mini-POS (móvil)', () => {
  const barra = clasesDe('lg:hidden sticky bottom-');

  it('queda fija sobre la barra inferior de la app en vez de al final de la lista', () => {
    expect(barra).toContain('sticky');
    expect(barra).toContain('bottom-[calc(68px+env(safe-area-inset-bottom,0px))]');
    expect(barra).toContain('z-30');
  });

  it('sigue oculta en escritorio (lg) y en tablet sin barra inferior vuelve a bottom-0', () => {
    expect(barra).toContain('lg:hidden');
    expect(barra).toContain('md:bottom-0');
    expect(barra).toContain('md:pb-[env(safe-area-inset-bottom,0px)]');
  });
});

describe('Mayoristas — vista principal en celular', () => {
  it('el subtítulo del encabezado se oculta solo en móvil', () => {
    expect(clasesDe('Precios para tiendas y vendedores')).toContain('max-md:hidden');
  });

  it('los botones del encabezado van en 2 columnas de 44px en móvil y conservan h-10 en escritorio', () => {
    const c = clasesDe('h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-black uppercase tracking-widest text-xs max-md:h-11');
    expect(c).toContain('h-10 px-4');
    expect(c).toContain('max-md:h-11');
  });

  it('la cadena de precios es una sola fila deslizable en móvil y envuelve en escritorio', () => {
    const c = clasesDe('max-md:flex-nowrap max-md:overflow-x-auto');
    expect(c).toContain('flex-wrap');
    expect(c).toContain('max-md:flex-nowrap');
  });

  it('las pestañas miden 44px y se reparten el ancho en móvil; el texto de escritorio no cambia', () => {
    const c = clasesDe('max-md:flex-1 max-md:h-11');
    expect(c).toContain('h-9 px-4');
    expect(src).toContain('<span className="max-md:hidden">Lista de&nbsp;</span>Precios');
  });

  it('las tarjetas de resumen se compactan solo en móvil (escritorio conserva p-4 y text-2xl)', () => {
    expect(src).toContain('max-md:py-0 max-md:gap-0');
    expect(clasesDe('text-2xl max-md:text-xl')).toContain('text-2xl');
    expect(src).toContain('<CardContent className="p-4 max-md:p-3">');
  });
});

describe('Mayoristas — áreas de toque en móvil', () => {
  it('el lápiz de precio tiene área de ~44px sin cambiar el diseño y etiqueta accesible', () => {
    const c = clasesDe('aria-label="Editar precio mayorista"');
    expect(c).toContain('max-md:p-4');
    expect(c).toContain('max-md:-m-4');
  });

  it('el campo de precio abre el teclado numérico decimal', () => {
    expect(src).toContain('inputMode="decimal"');
  });

  it('editar/eliminar cliente pasan de 32px a 44px en móvil y conservan w-8 h-8 en escritorio', () => {
    for (const label of ['aria-label="Editar cliente"', 'aria-label="Eliminar cliente"']) {
      const c = clasesDe(label);
      expect(c).toContain('w-8 h-8');
      expect(c).toContain('max-md:w-11 max-md:h-11');
    }
  });

  it('el selector "Ver precios para cliente" tiene color de texto legible en móvil', () => {
    expect(clasesDe('focus:border-indigo-400 max-md:h-11')).toContain('max-md:text-slate-700');
  });
});

describe('Mayoristas — escritorio intacto', () => {
  it('no se usan breakpoints que afecten a escritorio en los ajustes nuevos (solo max-md:)', () => {
    // Los ajustes de esta adaptación son todos max-md:. Si aparece p. ej. "md:h-11" en las
    // pestañas o el encabezado, estaría cambiando escritorio.
    expect(clasesDe('max-md:flex-1 max-md:h-11')).not.toMatch(/(^|\s)md:h-/);
    expect(clasesDe('h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-black uppercase tracking-widest text-xs max-md:h-11')).not.toMatch(/(^|\s)md:h-/);
  });
});
