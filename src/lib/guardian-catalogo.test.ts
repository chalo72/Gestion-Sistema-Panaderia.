import { describe, it, expect } from 'vitest';
import { productoExistenteDeFila, cantidadQueSeGuarda, productoQueYaExiste } from './guardian-catalogo';

const productos = [
  { id: 'nucita', nombre: 'Paletya Nucita' },
  { id: 'mora', nombre: 'Artesanal mora 60 gr casero' },
  { id: 'coco', nombre: 'Agua de coco' },
  { id: 'coca250', nombre: 'Coca cola 250 ml' },
  { id: 'coca400', nombre: 'Coca cola 400 ml' },
];
const precios = [
  { id: 'p1', productoId: 'nucita', proveedorId: 'helados', precioCosto: 42200, cantidadEmbalaje: 24, tipoEmbalaje: 'caja' },
  { id: 'p2', productoId: 'mora', proveedorId: 'helados', precioCosto: 30000, cantidadEmbalaje: 24, tipoEmbalaje: 'caja' },
  { id: 'p3', productoId: 'coco', proveedorId: 'bigcola', precioCosto: 1300, cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' },
  { id: 'p4', productoId: 'coca250', proveedorId: 'femsa', precioCosto: 18000, cantidadEmbalaje: 12, tipoEmbalaje: 'paca' },
];
const ctx = (proveedorId: string) => ({ precios, productos, proveedorId });

describe('el catálogo actualiza, no duplica (2026-11-23)', () => {
  it('renombrar una fila que ya estaba actualiza ese mismo producto', () => {
    expect(productoExistenteDeFila({ uid: 'p3', productoId: '', nombre: 'Agua de coco 400' }, ctx('bigcola'))).toBe('coco');
  });
  it('un nombre casi igual de lo que el proveedor ya vende reutiliza el producto', () => {
    expect(productoExistenteDeFila({ uid: 'nuevo', nombre: 'Paleta Nucita' }, ctx('helados'))).toBe('nucita');
    expect(productoExistenteDeFila({ uid: 'nuevo', nombre: 'artesanal  MORA 60 gr casero' }, ctx('helados'))).toBe('mora');
  });
  it('otro tamaño sí es otro producto', () => {
    expect(productoExistenteDeFila({ uid: 'nuevo', nombre: 'Coca cola 1.5 l' }, ctx('femsa'))).toBeUndefined();
  });
  it('un producto de verdad nuevo se deja crear', () => {
    expect(productoExistenteDeFila({ uid: 'nuevo', nombre: 'Gomitas Trululú' }, ctx('helados'))).toBeUndefined();
  });
});

describe('la cantidad por paca no se pierde (2026-11-23)', () => {
  it('si llega «1 unidad» con costo de paca, se conserva la paca', () => {
    const r = cantidadQueSeGuarda({ precioCosto: 19000, cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' }, precios[3]);
    expect(r).toEqual({ cantidadEmbalaje: 12, tipoEmbalaje: 'paca', corregida: true });
  });
  it('si el costo es de una unidad, se respeta lo nuevo', () => {
    expect(cantidadQueSeGuarda({ precioCosto: 1600, cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' }, precios[3]).corregida).toBe(false);
  });
  it('si cambia la paca a otra cantidad, se respeta', () => {
    expect(cantidadQueSeGuarda({ precioCosto: 30000, cantidadEmbalaje: 24 }, precios[3]).cantidadEmbalaje).toBe(24);
  });
});

describe('Recepción no crea lo que ya existe (2026-11-23)', () => {
  it('encuentra el mismo nombre aunque cambien mayúsculas, tildes o espacios', () => {
    expect(productoQueYaExiste('  agua DE coco ', productos)).toEqual({ producto: productos[2], exacto: true });
  });
  it('encuentra uno casi igual del mismo tamaño', () => {
    expect(productoQueYaExiste('Paleta Nucita', productos)?.producto.id).toBe('nucita');
  });
  it('otro tamaño o algo nuevo no se confunde', () => {
    expect(productoQueYaExiste('Coca cola 1.5 l', productos)).toBeUndefined();
    expect(productoQueYaExiste('Gomitas Trululú', productos)).toBeUndefined();
  });
});
