import { describe, it, expect } from 'vitest';
import { precioConPorcentaje, armarFilas, cambiosParaAplicar, textoWhatsApp, htmlImpresion, AJUSTES_VACIOS,
  familiaDeCategoria, sugerenciaBase, leerAnalisisIA, verificarGuardado, contextoCategoria } from './lista-precios';

describe('insumos e impresión (2026-11-22)', () => {
  it('la lista de insumos trae solo insumos con su costo', () => {
    const filas = armarFilas([
      { id: 'i', nombre: 'Harina', categoria: 'Harinas', precioVenta: 0, costoBase: 98000, tipo: 'ingrediente' },
      { id: 'v', nombre: 'Pan2000', categoria: 'Panes', precioVenta: 2000 },
    ] as any, AJUSTES_VACIOS, 'insumos');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id: 'i', actual: 98000, nuevo: 98000 });
  });
  it('la hoja es oficio, nombres en negrita y títulos rojos subrayados', () => {
    const html = htmlImpresion([{ id: 'a', nombre: 'pan', categoria: 'Alpina', actual: 1, nuevo: 1, manual: false, oculto: false }], 'DP', 'hoy');
    expect(html).toContain('size: 216mm 330mm');
    expect(html).toContain('<strong>Pan</strong>');
    expect(html).toMatch(/h2 \{[^}]*color: #c1121f[^}]*text-decoration: underline/);
    expect(htmlImpresion([], 'DP', 'hoy', 'carta')).toContain('size: 216mm 279mm');
  });
  it('las categorías nuevas de pan cuentan como horno', () => {
    expect(familiaDeCategoria('Pan de dulce')).toBe('horno');
    expect(familiaDeCategoria('Pan hojaldrado')).toBe('horno');
    expect(familiaDeCategoria('Helado preparado')).toBe('helados');
  });
});

describe('análisis por categoría', () => {
  it('sabe qué categoría usa horno, nevera o es reventa', () => {
    expect(familiaDeCategoria('Panes')).toBe('horno');
    expect(familiaDeCategoria('Pan empacado')).toBe('horno');
    expect(familiaDeCategoria('Fritos')).toBe('horno');
    expect(familiaDeCategoria('Tortas Decoradas')).toBe('tortas');
    expect(familiaDeCategoria('Helado Empaque')).toBe('helados');
    expect(familiaDeCategoria('Postobón')).toBe('reventa');
    expect(familiaDeCategoria('Alpina')).toBe('reventa');
    expect(familiaDeCategoria('Papelería')).toBe('reventa');
    expect(sugerenciaBase('Panes').pct).toBe(7);
    expect(sugerenciaBase('Cocacola').pct).toBe(0);
  });

  it('lee el JSON de la IA aunque venga con texto alrededor, y rechaza basura', () => {
    expect(leerAnalisisIA('Claro:\n{"pct": 6, "porque": "gas", "paraQue": "cubrir", "razon": "640.000"}\nlisto'))
      .toEqual({ pct: 6, porque: 'gas', paraQue: 'cubrir', razon: '640.000' });
    expect(leerAnalisisIA('ESTADO: bien')).toBeNull();
    expect(leerAnalisisIA('{"pct": 90, "porque": "x"}')).toBeNull();
  });

  it('los datos para la IA solo traen precios y costos reales', () => {
    const ctx = contextoCategoria('Panes', [{ id: 'a', nombre: 'Pan2000', categoria: 'Panes', actual: 2000, nuevo: 2000, manual: false, oculto: false }], { a: 900 });
    expect(ctx).toContain('Pan2000: $2000 (costo $900)');
    expect(ctx).toContain('$1.300.000');
  });

  it('confirma lo guardado comparando producto por producto', () => {
    expect(verificarGuardado([{ id: 'a', nuevo: 3200 }, { id: 'b', nuevo: 2100 }], [{ id: 'a', precioVenta: 3200 }, { id: 'b', precioVenta: 2000 }]))
      .toEqual({ ok: 1, total: 2, fallaron: ['b'] });
  });
});

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
