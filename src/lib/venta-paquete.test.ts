import { describe, it, expect } from 'vitest';
import {
  seVendePorPaquete, conTarjetasDePaquete, lineaVenta, productoDesdeId, unidadesQueDescuenta,
  unidadesQueEntran, textoUnidades, unidadesPorItem, idBase,
} from './venta-paquete';

const agua = { id: 'agua', nombre: 'Agua Pool', precioVenta: 1000, precioVentaPaquete: 20000, unidadesPaquete: 24 } as any;
const pan = { id: 'pan', nombre: 'Pan', precioVenta: 500 } as any;

describe('venta por paquete e inventario en unidades', () => {
  it('solo se vende por paquete si tiene unidades y precio de paquete', () => {
    expect(seVendePorPaquete(agua)).toBe(true);
    expect(seVendePorPaquete(pan)).toBe(false);
    expect(seVendePorPaquete({ ...agua, precioVentaPaquete: 0 })).toBe(false);
  });

  it('el Punto de Venta muestra la unidad y además la tarjeta del paquete', () => {
    const cat = conTarjetasDePaquete([agua, pan]);
    expect(cat.map(p => p.nombre)).toEqual(['Agua Pool', 'Agua Pool (paquete x24)', 'Pan']);
    expect(cat[1].precioVenta).toBe(20000);
    expect(unidadesPorItem(cat[1])).toBe(24);
    expect(unidadesPorItem(agua)).toBe(1);
  });

  it('la venta guarda el producto real y cuántas unidades descuenta', () => {
    const paq = conTarjetasDePaquete([agua])[1];
    expect(lineaVenta(paq)).toEqual({ productoId: 'agua', unidadesPorItem: 24, nombre: 'Agua Pool (paquete x24)' });
    expect(lineaVenta(agua)).toEqual({ productoId: 'agua' });
    expect(unidadesQueDescuenta({ cantidad: 2, unidadesPorItem: 24 })).toBe(48);
    expect(unidadesQueDescuenta({ cantidad: 3 })).toBe(3);
  });

  it('una mesa guardada con el paquete se vuelve a abrir como paquete', () => {
    const p = productoDesdeId('agua::paq', [agua]);
    expect(p?.precioVenta).toBe(20000);
    expect(idBase('agua::paq')).toBe('agua');
    expect(productoDesdeId('agua', [agua])?.precioVenta).toBe(1000);
  });

  it('recepción: 2 pacas de 24 → 48 unidades; sin "trae" guardado queda igual', () => {
    expect(unidadesQueEntran(2, agua)).toBe(48);
    expect(unidadesQueEntran(2, pan)).toBe(2);
  });

  it('muestra unidades y paquetes', () => {
    expect(textoUnidades(50, agua)).toBe('50 unidades (2 paquetes + 2 sueltas)');
    expect(textoUnidades(5, pan)).toBe('5 unidades');
  });
});
