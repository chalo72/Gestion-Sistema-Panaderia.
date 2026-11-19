import { describe, it, expect } from 'vitest';
import { esCategoriaPan, catalogoDespacho, resumenDespacho, analizarCasaEnCasa, type Despacho } from './rutas-reparto';

describe('despacho: solo panes en el buscador', () => {
  it('reconoce categorías de pan y deja fuera insumos y otras', () => {
    expect(esCategoriaPan('Panes')).toBe(true);
    expect(esCategoriaPan('Pan de empaque')).toBe(true);
    expect(esCategoriaPan('PANADERÍA')).toBe(true);
    expect(esCategoriaPan('INS: Panadería')).toBe(false);
    expect(esCategoriaPan('Empanadas')).toBe(false);
    expect(esCategoriaPan('Bebidas')).toBe(false);
    expect(esCategoriaPan(undefined)).toBe(false);
  });

  it('filtra el catálogo y permite ver todo', () => {
    const cat = [
      { productoId: 'a', nombre: 'Pan francés', categoria: 'Panes', costo: 100, precioMayorista: 250, pvp: 300 },
      { productoId: 'b', nombre: 'Coca-Cola', categoria: 'Bebidas', costo: 1000, precioMayorista: 1800, pvp: 2500 },
    ];
    expect(catalogoDespacho(cat).map(c => c.productoId)).toEqual(['a']);
    expect(catalogoDespacho(cat, true)).toHaveLength(2);
  });
});

const despacho = (extra: Partial<Despacho> = {}): Despacho => ({
  id: 'd1', fecha: '2026-11-19', vendedor: 'Samir', rutaNombre: 'Centro', estado: 'en_ruta',
  carga: [{ productoId: 'pan', nombre: 'Pan', cantidad: 100, precioUnit: 250, costoUnit: 100, precioPublico: 300 }],
  paradas: [{
    clienteId: 't1', clienteNombre: 'Tienda Ana', visitada: true, cobrado: 10000, metodoCobro: 'efectivo',
    lineas: [{ productoId: 'pan', nombre: 'Pan', dejado: 40, recogido: 0, motivo: 'sobrante', precioUnit: 250, costoUnit: 100 }],
  }],
  regreso: [],
  ventasCasa: [
    { id: 'v1', hora: '09:10', productoId: 'pan', nombre: 'Pan', cantidad: 10, precioUnit: 300, costoUnit: 100, metodo: 'efectivo' },
    { id: 'v2', hora: '09:40', productoId: 'pan', nombre: 'Pan', cantidad: 5, precioUnit: 300, costoUnit: 100, metodo: 'nequi' },
  ],
  actualizadoEn: 1,
  ...extra,
});

describe('cuadre con venta casa en casa', () => {
  it('el pan vendido casa en casa sale del carro', () => {
    const r = resumenDespacho(despacho());
    expect(r.filas[0].vendidoCasa).toBe(15);
    expect(r.filas[0].esperadoRegreso).toBe(100 - 40 - 15); // 45 deben volver
    expect(r.sinEntregar).toBe(45);
  });

  it('el efectivo a entregar suma tiendas + casa en casa en efectivo', () => {
    const r = resumenDespacho(despacho());
    expect(r.ventaCasa).toBe(4500);
    expect(r.ventaCasaEfectivo).toBe(3000);
    expect(r.cobradoEfectivo).toBe(10000 + 3000);
    expect(r.ventaTotal).toBe(40 * 250 + 4500);
  });

  it('un despacho viejo (sin ventas casa en casa) queda igual que antes', () => {
    const r = resumenDespacho(despacho({ ventasCasa: undefined }));
    expect(r.filas[0].esperadoRegreso).toBe(60);
    expect(r.cobradoEfectivo).toBe(10000);
    expect(r.ventaCasa).toBe(0);
  });
});

describe('análisis casa en casa vs tiendas', () => {
  it('suma por ruta, por pan y por día', () => {
    const a = analizarCasaEnCasa([despacho(), despacho({ id: 'd2', rutaNombre: 'Vereda', ventasCasa: [] })]);
    expect(a.ventasCasa).toBe(2);
    expect(a.unidadesCasa).toBe(15);
    expect(a.valorCasa).toBe(4500);
    expect(a.porPan[0]).toMatchObject({ productoId: 'pan', unidades: 15, valor: 4500 });
    expect(a.porRuta.find(r => r.ruta === 'Centro')?.valorCasa).toBe(4500);
    expect(a.porDia.find(d => d.dia === 'Jue')?.valorCasa).toBe(4500); // 19-nov-2026 es jueves
  });
});
