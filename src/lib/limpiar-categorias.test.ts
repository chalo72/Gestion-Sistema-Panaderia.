import { describe, it, expect } from 'vitest';
import { normalizarNombreCat, esCategoriaDeReceta, preferirPorUsoEnProductos } from './limpiar-categorias';

describe('limpiar categorías del aparato', () => {
  it('"Postobon" y "Postobón" son la misma', () => {
    expect(normalizarNombreCat('Postobón ')).toBe(normalizarNombreCat('postobon'));
  });

  it('reconoce una receta de pan colada como categoría', () => {
    expect(esCategoriaDeReceta({ nombre: 'Pan aliñado Grd empaque', formulacionId: 'x', panesPorArroba: 80 })).toBe(true);
    expect(esCategoriaDeReceta({ nombre: 'Trenza', ingredientes: [] })).toBe(true);
    expect(esCategoriaDeReceta({ id: '1', nombre: 'Panes', color: '#fff', tipo: 'venta' })).toBe(false);
  });

  it('se queda con el nombre que usan los productos', () => {
    const usados = new Set(['Postobón']);
    expect(preferirPorUsoEnProductos('Postobón', 'Postobon', usados)).toBe(true);
    expect(preferirPorUsoEnProductos('Postobon', 'Postobón', usados)).toBe(false);
  });
});
