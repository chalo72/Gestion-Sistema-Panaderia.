import { describe, it, expect } from 'vitest';
import { sugerirCategoriaPan, productosPorOrdenar, categoriaDeModelo, planOrdenPanes, claveNombre } from './clasificar-panes';

const prod = (id: string, nombre: string, extra: any = {}): any => ({
  id, nombre, categoria: 'Panes', tipo: 'elaborado', precioVenta: 1000, margenUtilidad: 0, createdAt: '', ...extra,
});
const modelo = (extra: any): any => ({ id: 'm', nombre: 'Modelo', formulacionId: 'f', activo: true, ...extra });
// (las pruebas de modelo usan también este helper)

describe('clasificar panes', () => {
  it('el modelo de pan manda sobre el nombre', () => {
    const p = prod('1', 'Pan Especial');
    const s = sugerirCategoriaPan(p, [modelo({ productoId: '1', categoriaProduccion: 'pan_dulce' })]);
    expect(s).toMatchObject({ categoria: 'Pan de dulce', confianza: 'alta' });
    const s2 = sugerirCategoriaPan(p, [modelo({ productoCatalogoId: '1', categoriaProduccion: 'empacado_sal' })]);
    expect(s2?.categoria).toBe('Pan de sal');
  });

  it('usa el nombre cuando no hay modelo', () => {
    expect(sugerirCategoriaPan(prod('a', 'Croissant de Mantequilla'), [])?.categoria).toBe('Croissant');
    expect(sugerirCategoriaPan(prod('b', 'Pan de Coco'), [])?.categoria).toBe('Pan de dulce');
    expect(sugerirCategoriaPan(prod('c', 'Pan de Queso'), [])?.categoria).toBe('Pan de sal');
    expect(sugerirCategoriaPan(prod('d', 'Pan Francés Tradicional'), [])?.categoria).toBe('Pan de sal');
    expect(sugerirCategoriaPan(prod('e', 'Galleta de avena'), [])?.categoria).toBe('Galletería');
  });

  it('no adivina cuando no hay pista o es ambiguo', () => {
    expect(sugerirCategoriaPan(prod('f', 'Pan Especial'), [])).toBeNull();
    expect(sugerirCategoriaPan(prod('g', 'Pan dulce con queso'), [])).toBeNull();
  });

  it('modelo de pan: la categoría sale de la masa que usa', () => {
    const SAL = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51';
    const DULCE = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52';
    const HOJ = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53';
    const fs: any[] = [{ id: SAL, nombre: 'Masa de Sal Mixta' }, { id: DULCE, nombre: 'Masa de Dulce' }, { id: HOJ, nombre: 'Masa de Hojaldre Mixta' }];
    expect(categoriaDeModelo(modelo({ nombre: 'Pan queso dulce 45gr', formulacionId: DULCE }), fs)?.categoria).toBe('Pan de dulce');
    expect(categoriaDeModelo(modelo({ nombre: 'Pan Mantequilla', formulacionId: SAL }), fs)?.categoria).toBe('Pan de sal');
    expect(categoriaDeModelo(modelo({ nombre: 'Croissant grande', formulacionId: HOJ }), fs)?.categoria).toBe('Croissant');
    expect(categoriaDeModelo(modelo({ nombre: 'Palmera', formulacionId: HOJ }), fs)?.categoria).toBe('Hojaldres');
    // la categoría de producción puesta a mano manda sobre la masa
    expect(categoriaDeModelo(modelo({ nombre: 'X', formulacionId: SAL, categoriaProduccion: 'pan_dulce' }), fs)?.categoria).toBe('Pan de dulce');
  });

  it('plan: empareja por nombre sin pesos y detecta lo que falta', () => {
    const SAL = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51';
    const fs: any[] = [{ id: SAL, nombre: 'Masa de Sal Mixta' }];
    const plan = planOrdenPanes(
      [prod('1', 'Pan Mantequilla'), prod('2', 'Pan Suelto')],
      [modelo({ id: 'a', nombre: 'Pan Mantequilla 45gr', formulacionId: SAL }), modelo({ id: 'b', nombre: 'Pan Nuevo', formulacionId: SAL })],
      fs
    );
    expect(claveNombre('Pan Mantequilla 45gr')).toBe('pan mantequilla');
    expect(plan.filas.map((f) => f.estado)).toEqual(['vincular', 'crear']);
    expect(plan.huerfanos.map((p) => p.id)).toEqual(['2']);
    expect(plan.pendientes).toBe(3);
  });

  it('solo lista productos de venta que siguen en Panes', () => {
    const lista = productosPorOrdenar([
      prod('1', 'A'), prod('2', 'B', { categoria: 'Pan de sal' }), prod('3', 'C', { tipo: 'ingrediente' }), prod('4', 'D', { categoria: 'panes' }),
    ]);
    expect(lista.map((p) => p.id)).toEqual(['1', '4']);
  });
});
