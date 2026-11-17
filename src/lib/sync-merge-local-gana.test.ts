import { describe, it, expect } from 'vitest';
import {
  mergeCloudItemLocalGana,
  mergePrecioLocalGana,
  mergeHydrateItem,
  preciosParaSubir,
  pendientesDeSubir,
  timestampDeDoc,
  esCajaRevivida,
  valoresIguales,
  enLotes,
} from './sync-merge-local-gana';

describe('pendientesDeSubir (clientes y créditos: celular viejo no devuelve un saldo anterior)', () => {
  const nube = new Map([['cr1', '2026-11-16T15:00:00.000Z']]); // abono registrado hoy en el PC

  it('NO sube el crédito con saldo viejo de un celular desactualizado', () => {
    const local = [{ id: 'cr1', saldo: 10000, updatedAt: '2026-11-15T09:00:00.000Z' }];
    expect(pendientesDeSubir(local, nube)).toEqual([]);
  });

  it('SÍ sube un consumo anotado aquí después del abono', () => {
    const local = [{ id: 'cr1', saldo: 7000, updatedAt: '2026-11-16T16:00:00.000Z' }];
    expect(pendientesDeSubir(local, nube).map(c => c.id)).toEqual(['cr1']);
  });

  it('SÍ sube créditos que la nube nunca recibió', () => {
    const local = [{ id: 'viejo-sin-subir', saldo: 5000, createdAt: '2026-10-01T09:00:00.000Z' }];
    expect(pendientesDeSubir(local, nube).map(c => c.id)).toEqual(['viejo-sin-subir']);
  });

  it('no sube nada si no se pudo leer la nube', () => {
    expect(pendientesDeSubir([{ id: 'x', updatedAt: '2026-11-16T16:00:00.000Z' }], null)).toEqual([]);
  });
});

describe('preciosParaSubir (celular viejo no borra corrección de otro equipo)', () => {
  const nube = new Map([
    ['p1', '2026-11-16T15:00:00.000Z'], // corregido hoy en otro equipo
    ['p2', '2026-11-01T10:00:00.000Z'],
  ]);

  it('NO sube un costo viejo cuando la nube tiene uno más nuevo', () => {
    const local = [{ id: 'p1', precioCosto: 80, fechaActualizacion: '2026-10-01T10:00:00.000Z' }];
    expect(preciosParaSubir(local, nube)).toEqual([]);
  });

  it('SÍ sube cuando este aparato lo editó después que la nube', () => {
    const local = [{ id: 'p2', precioCosto: 4800, fechaActualizacion: '2026-11-16T16:00:00.000Z' }];
    expect(preciosParaSubir(local, nube).map(p => p.id)).toEqual(['p2']);
  });

  it('SÍ sube un precio nuevo que la nube no tiene', () => {
    const local = [{ id: 'nuevo', precioCosto: 1000, fechaActualizacion: '2026-11-16T16:00:00.000Z' }];
    expect(preciosParaSubir(local, nube).map(p => p.id)).toEqual(['nuevo']);
  });

  it('NO sube si la fecha es igual (ya está al día)', () => {
    const local = [{ id: 'p2', precioCosto: 1, fechaActualizacion: '2026-11-01T10:00:00.000Z' }];
    expect(preciosParaSubir(local, nube)).toEqual([]);
  });

  it('NO sube precios borrados ni nada si no se pudo leer la nube', () => {
    const local = [{ id: 'nuevo', precioCosto: 1000, fechaActualizacion: '2026-11-16T16:00:00.000Z' }];
    expect(preciosParaSubir(local, nube, new Set(['nuevo']))).toEqual([]);
    expect(preciosParaSubir(local, null)).toEqual([]);
  });

  it('NO sube un precio local sin fecha si ya existe en la nube', () => {
    const local = [{ id: 'p1', precioCosto: 80 }];
    expect(preciosParaSubir(local, nube)).toEqual([]);
  });
});

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

describe('valoresIguales (no resubir lo que la nube ya tiene igual)', () => {
  it('la misma hora escrita con +00:00 o con Z es igual', () => {
    expect(valoresIguales('2026-11-07T13:05:00.123+00:00', '2026-11-07T13:05:00.123Z')).toBe(true);
    expect(valoresIguales('2026-11-07T13:05:00+00:00', '2026-11-07T13:06:00Z')).toBe(false);
  });

  it('objetos con las llaves en otro orden son iguales; un monto distinto no', () => {
    const local = [{ nombre: 'Pan', subtotal: 1000, cantidad: 2 }];
    const nube = [{ cantidad: 2, subtotal: 1000, nombre: 'Pan' }];
    expect(valoresIguales(local, nube)).toBe(true);
    expect(valoresIguales(local, [{ cantidad: 2, subtotal: 1500, nombre: 'Pan' }])).toBe(false);
  });

  it('números como texto, vacíos y nulos', () => {
    expect(valoresIguales(7000, '7000')).toBe(true);
    expect(valoresIguales(null, '')).toBe(true);
    expect(valoresIguales(null, 0)).toBe(false);
  });
});

describe('enLotes', () => {
  it('procesa todos sin pasar del tamaño del lote a la vez', async () => {
    let enCurso = 0, maximo = 0; const hechos: number[] = [];
    await enLotes([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      enCurso++; maximo = Math.max(maximo, enCurso);
      await new Promise(r => setTimeout(r, 1));
      hechos.push(n); enCurso--;
    });
    expect(hechos.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(maximo).toBeLessThanOrEqual(3);
  });
});
