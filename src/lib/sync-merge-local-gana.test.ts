import { describe, it, expect } from 'vitest';
import {
  mergeCloudItemLocalGana,
  mergePrecioLocalGana,
  mergeHydrateItem,
  timestampDeDoc,
  esCajaRevivida,
} from './sync-merge-local-gana';

describe('mergeCloudItemLocalGana', () => {
  it('si no hay local, usa la nube', () => {
    const cloud = { id: '1', nombre: 'Harina' };
    expect(mergeCloudItemLocalGana(undefined, cloud)).toEqual(cloud);
  });

  it('si hay local, no deja que la nube borre campos llenos', () => {
    const local = { id: '1', nombre: 'Harina local', notas: 'importante' };
    const cloud = { id: '1', nombre: 'Harina nube', notas: '' };
    const merged = mergeCloudItemLocalGana(local, cloud);
    expect(merged.nombre).toBe('Harina local');
    expect(merged.notas).toBe('importante');
  });

  it('rellena huecos locales desde la nube', () => {
    const local = { id: '1', nombre: 'Harina', email: undefined as string | undefined };
    const cloud = { id: '1', nombre: 'X', email: 'a@b.com' };
    const merged = mergeCloudItemLocalGana(local, cloud);
    expect(merged.nombre).toBe('Harina');
    expect(merged.email).toBe('a@b.com');
  });
});

describe('mergePrecioLocalGana', () => {
  it('conserva cantidadEmbalaje y precioCosto locales frente a nube incompleta', () => {
    const local = {
      id: 'p1',
      productoId: 'prod',
      proveedorId: 'prov',
      precioCosto: 85000,
      cantidadEmbalaje: 50,
      tipoEmbalaje: 'bulto',
      destino: 'insumo',
      fechaActualizacion: '2026-07-28',
    };
    const cloud = {
      id: 'p1',
      productoId: 'prod',
      proveedorId: 'prov',
      precioCosto: 0,
      cantidadEmbalaje: 1,
      tipoEmbalaje: 'unidad',
      destino: 'venta',
      fechaActualizacion: '2026-07-29',
    };
    const merged = mergePrecioLocalGana(local, cloud);
    expect(merged.precioCosto).toBe(85000);
    expect(merged.cantidadEmbalaje).toBe(50);
    expect(merged.tipoEmbalaje).toBe('bulto');
    expect(merged.destino).toBe('insumo');
  });

  it('mergeHydrateItem usa regla de precios en colección precios', () => {
    const local = { id: 'x', precioCosto: 1000, cantidadEmbalaje: 12.5 };
    const cloud = { id: 'x', precioCosto: 0, cantidadEmbalaje: 1 };
    const merged = mergeHydrateItem('precios', local, cloud);
    expect(merged.precioCosto).toBe(1000);
    expect(merged.cantidadEmbalaje).toBe(12.5);
  });

  it('si la nube es más nueva por timestamp, esa versión manda (aparatos al día)', () => {
    const local = {
      id: '1',
      nombre: 'Viejo',
      updatedAt: '2026-08-01T10:00:00.000Z',
    };
    const cloud = {
      id: '1',
      nombre: 'Nuevo desde Admin',
      updatedAt: '2026-08-03T12:00:00.000Z',
    };
    const merged = mergeHydrateItem('productos', local, cloud);
    expect(merged.nombre).toBe('Nuevo desde Admin');
  });

  it('si local es más nuevo, LOCAL GANA el nombre', () => {
    const local = {
      id: '1',
      nombre: 'Editado en POS',
      updatedAt: '2026-08-03T15:00:00.000Z',
    };
    const cloud = {
      id: '1',
      nombre: 'Viejo nube',
      updatedAt: '2026-08-03T10:00:00.000Z',
    };
    const merged = mergeHydrateItem('productos', local, cloud);
    expect(merged.nombre).toBe('Editado en POS');
  });
});

describe('cierre de caja — no revivir cajas cerradas', () => {
  it('timestampDeDoc usa la hora más reciente (updatedAt viejo + actualizadoEn nuevo)', () => {
    const doc = { updatedAt: '2026-10-14T10:00:00.000Z', actualizadoEn: '2026-10-14T18:00:00.000Z' };
    expect(timestampDeDoc(doc)).toBe(new Date('2026-10-14T18:00:00.000Z').getTime());
  });

  it('una copia "abierta" más nueva de otro aparato no reabre la caja cerrada aquí', () => {
    const local: any = {
      id: 'c1', estado: 'cerrada', montoCierre: 250000, fechaCierre: '2026-10-14T18:00:00.000Z',
      totalVentas: 300000, updatedAt: '2026-10-14T10:00:00.000Z', actualizadoEn: '2026-10-14T18:00:00.000Z',
    };
    const cloud = {
      id: 'c1', estado: 'abierta', totalVentas: 305000,
      updatedAt: '2026-10-14T18:05:00.000Z', actualizadoEn: '2026-10-14T18:05:00.000Z',
    };
    const merged = mergeHydrateItem('sesiones_caja', local, cloud);
    expect(merged.estado).toBe('cerrada');
    expect(merged.montoCierre).toBe(250000);
    expect(merged.fechaCierre).toBe('2026-10-14T18:00:00.000Z');
    expect(merged.totalVentas).toBe(305000);
    expect(esCajaRevivida(local, cloud)).toBe(true);
  });

  it('el aparato que la tenía abierta acepta el cierre aunque su copia sea más nueva', () => {
    const local: any = { id: 'c1', estado: 'abierta', totalVentas: 310000, actualizadoEn: '2026-10-14T18:10:00.000Z' };
    const cloud = {
      id: 'c1', estado: 'cerrada', montoCierre: 250000, fechaCierre: '2026-10-14T18:00:00.000Z',
      actualizadoEn: '2026-10-14T18:00:00.000Z',
    };
    const merged = mergeHydrateItem('sesiones_caja', local, cloud);
    expect(merged.estado).toBe('cerrada');
    expect(merged.montoCierre).toBe(250000);
  });

  it('la regla solo aplica a cajas', () => {
    const local = { id: 'm1', estado: 'cerrada', updatedAt: '2026-10-14T10:00:00.000Z' };
    const cloud = { id: 'm1', estado: 'abierta', updatedAt: '2026-10-14T11:00:00.000Z' };
    expect(mergeHydrateItem('mesas', local, cloud).estado).toBe('abierta');
  });
});
