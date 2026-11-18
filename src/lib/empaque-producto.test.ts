import { describe, it, expect } from 'vitest';
import {
  numeroFormulario, empaqueDesdeFormulario, precioProveedorDesdeEmpaque, camposEmpaqueParaEditar, precioVentaConMargen,
} from './empaque-producto';

describe('producto por paquete: compra por paca, venta por unidad', () => {
  it('lee números como los escribe Gonzalo', () => {
    expect(numeroFormulario('12.300')).toBe(12300);
    expect(numeroFormulario('12300')).toBe(12300);
    expect(numeroFormulario('512,5')).toBe(512.5);
    expect(numeroFormulario('')).toBe(0);
  });

  it('agua Pool: paca de 24 a $12.300 → $512,5 por unidad', () => {
    const e = empaqueDesdeFormulario({ tipoEmbalaje: 'paca', unidadesPaquete: '24', precioPaquete: '12.300' });
    expect(e).toMatchObject({ porPaquete: true, tipo: 'paca', unidades: 24, precioPaquete: 12300, costoUnidad: 512.5 });
    expect(precioProveedorDesdeEmpaque(e)).toEqual({ precioCosto: 12300, cantidadEmbalaje: 24, tipoEmbalaje: 'paca' });
  });

  it('por unidad: el costo es el que se escribe y el proveedor queda por unidad', () => {
    const e = empaqueDesdeFormulario({ tipoEmbalaje: 'unidad', precioCosto: '700' });
    expect(e).toMatchObject({ porPaquete: false, unidades: 1, costoUnidad: 700 });
    expect(precioProveedorDesdeEmpaque(e)).toEqual({ precioCosto: 700, cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' });
  });

  it('paquete sin precio o con 1 unidad cuenta como unidad', () => {
    expect(empaqueDesdeFormulario({ tipoEmbalaje: 'paca', unidadesPaquete: '24', precioPaquete: '', precioCosto: '500' }).porPaquete).toBe(false);
    expect(empaqueDesdeFormulario({ tipoEmbalaje: 'paca', unidadesPaquete: '1', precioPaquete: '900' }).porPaquete).toBe(false);
  });

  it('al editar: la paca del proveedor NO se pone como costo de una unidad', () => {
    const c = camposEmpaqueParaEditar({ precioCosto: 14000, cantidadEmbalaje: 20, tipoEmbalaje: 'paca' }, { costoBase: 700 });
    expect(c).toEqual({ tipoEmbalaje: 'paca', unidadesPaquete: '20', precioPaquete: '14000', precioCosto: '700' });
  });

  it('al editar un producto por unidad, queda igual que antes', () => {
    expect(camposEmpaqueParaEditar({ precioCosto: 2225, cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' }, {}))
      .toEqual({ tipoEmbalaje: 'unidad', unidadesPaquete: '1', precioPaquete: '', precioCosto: '2225' });
    expect(camposEmpaqueParaEditar(null, { costoBase: 500 }).precioCosto).toBe('500');
  });

  it('precio de venta por unidad con margen (redondeado a 100)', () => {
    expect(precioVentaConMargen(512.5, 40)).toBe(900);
    expect(precioVentaConMargen(0, 40)).toBe(0);
  });
});
