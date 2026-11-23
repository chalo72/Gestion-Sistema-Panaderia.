import { describe, it, expect } from 'vitest';
import { analizarNombre, buscarDuplicados, ordenarPorNombreYTamano } from './productos-duplicados';

const p = (id: string, nombre: string) => ({ id, nombre });

describe('analizar el nombre', () => {
  it('saca tamaño, empaque y nombre base', () => {
    expect(analizarNombre('Agua cristal 600 *24')).toMatchObject({ base: 'agua cristal', tamano: 600, paca: 24 });
    expect(analizarNombre('Agua crital 600ml')).toMatchObject({ base: 'agua crital', tamano: 600, unidad: 'ml', paca: null });
    expect(analizarNombre('Post 1,5 Litro')).toMatchObject({ tamano: 1500, unidad: 'ml' });
    expect(analizarNombre('Coca-Cola mini')).toMatchObject({ base: 'cocacola', palabraTamano: 'chico', tamano: null });
    expect(analizarNombre('coca 250 pqñ')).toMatchObject({ base: 'cocacola', tamano: 250, palabraTamano: 'chico' });
  });
});

describe('posibles duplicados (casos reales, 2026-11-23)', () => {
  it('agua cristal paca vs suelta, aunque esté mal escrita', () => {
    const g = buscarDuplicados([p('a', 'Agua cristal 600 *24'), p('b', 'Agua crital 600ml'), p('c', 'Agua cristal 1.5 l')]);
    expect(g).toHaveLength(1);
    expect(g[0].motivo).toBe('paca');
    expect(g[0].productos.map(x => x.id).sort()).toEqual(['a', 'b']);
  });

  it('mismo nombre y tamaño = rojo', () => {
    const g = buscarDuplicados([p('1', 'Golpe Original 140g'), p('2', 'golpe original  140g')]);
    expect(g[0]).toMatchObject({ motivo: 'mismo-tamano', grave: true });
  });

  it('Coca-Cola mini con la de 250 ml, pero no con la de 1.5 l', () => {
    const g = buscarDuplicados([p('m', 'Coca-Cola mini'), p('2', 'Cocacola 250 ml'), p('3', 'Coca cola 1.5 litro')]);
    expect(g).toHaveLength(1);
    expect(g[0].productos.map(x => x.id).sort()).toEqual(['2', 'm']);
  });

  it('tamaños distintos no son duplicado', () => {
    expect(buscarDuplicados([p('1', 'Pony malta 330 ml'), p('2', 'Pony malta 1 litro')])).toEqual([]);
  });
});

describe('ordenar por nombre y tamaño', () => {
  it('del más pequeño al más grande dentro del mismo producto', () => {
    const r = ordenarPorNombreYTamano([p('3', 'Pony 1.5 l'), p('1', 'Pony 250 ml'), p('2', 'Pony 400 ml'), p('0', 'Agua 600 ml')]);
    expect(r.map(x => x.id)).toEqual(['0', '1', '2', '3']);
  });
});

describe('no junta cosas distintas', () => {
  it('galleta oreo y galleta dux no son duplicado', () => {
    expect(buscarDuplicados([p('1', 'Galleta Oreo 36 gr'), p('2', 'Galleta Dux 36 gr')])).toEqual([]);
  });
});
