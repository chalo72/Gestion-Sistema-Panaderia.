import { describe, it, expect } from 'vitest';
import { precioConPorcentaje, armarFilas, cambiosParaAplicar, textoWhatsApp, htmlImpresion, AJUSTES_VACIOS } from './lista-precios';

const prods = [
  { id: 'a', nombre: 'Pan aliñado empacado', categoria: 'Pan empacado', precioVenta: 3000 },
  { id: 'b', nombre: 'Pan 500', categoria: 'Panes', precioVenta: 500 },
  { id: 'c', nombre: 'Pan2000', categoria: 'Panes', precioVenta: 2000 },
  { id: 'd', nombre: 'Torta Media', categoria: 'Tortas', precioVenta: 30000 },
  { id: 'e', nombre: 'Harina', categoria: 'INS', precioVenta: 2000, tipo: 'ingrediente' },
  { id: 'f', nombre: 'Gonzalo prueba', categoria: 'Otro', precioVenta: 99999999 },
  { id: 'g', nombre: 'Coca <cola>', categoria: 'Cocacola', precioVenta: 3500 },
];

describe('lista de precios', () => {
  it('sube y redondea como se cobra', () => {
    expect(precioConPorcentaje(3000, 7)).toBe(3200);
    expect(precioConPorcentaje(2000, 7)).toBe(2100);
    expect(precioConPorcentaje(30000, 5)).toBe(32000);
    expect(precioConPorcentaje(700, 10)).toBe(750);
    expect(precioConPorcentaje(3000, -5)).toBe(2900); // también baja
    expect(precioConPorcentaje(500, 7, 1000)).toBe(500); // pan barato protegido
  });

  it('solo entran productos de venta reales, y respeta % por categoría, manuales y ocultos', () => {
    const filas = armarFilas(prods as any, { ...AJUSTES_VACIOS, pctPorCategoria: { Panes: 7, 'Pan empacado': 7 }, manuales: { g: 4000 }, ocultos: ['d'], protegerHasta: 1000 });
    expect(filas.map(f => f.id).sort()).toEqual(['a', 'b', 'c', 'd', 'g']);
    const por = Object.fromEntries(filas.map(f => [f.id, f]));
    expect(por.a.nuevo).toBe(3200);
    expect(por.b.nuevo).toBe(500);
    expect(por.c.nuevo).toBe(2100);
    expect(por.g).toMatchObject({ nuevo: 4000, manual: true });
    expect(por.d.oculto).toBe(true);
    expect(cambiosParaAplicar(filas).map(f => f.id).sort()).toEqual(['a', 'c', 'g']);
  });

  it('WhatsApp e impresión dejan fuera lo oculto y escapan el texto', () => {
    const filas = armarFilas(prods as any, { ...AJUSTES_VACIOS, pctPorCategoria: { Panes: 7 }, ocultos: ['d'] });
    const txt = textoWhatsApp(filas, true);
    expect(txt).toContain('Pan2000: $2.100 (antes $2.000)');
    expect(txt).not.toContain('Torta');
    const html = htmlImpresion(filas, 'Dulce Placer', 'hoy');
    expect(html).toContain('Coca &lt;cola&gt;');
    expect(html).not.toContain('Torta Media');
  });
});
