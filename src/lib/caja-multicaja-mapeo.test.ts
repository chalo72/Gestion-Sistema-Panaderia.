import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { SupabaseDatabase } from './supabase-db';

// Los mapeos son privados; se prueban igual porque de ellos depende que una caja abierta
// en el celular llegue al PC con su nombre, turno y vendedora.
const sdb = new SupabaseDatabase() as any;

const cajaLocal = {
  id: 'c1',
  usuarioId: 'u1',
  fechaApertura: '2026-10-18T19:46:22.792Z',
  montoApertura: 50000,
  totalVentas: 0,
  ventasIds: [],
  estado: 'abierta',
  cajaNombre: 'Caja 2',
  turno: 'Mañana',
  vendedoraNombre: 'Ana',
  eventoEspecial: 'Feria',
};

describe('mapeo de caja multi-caja (nube <-> local)', () => {
  it('envía nombre, turno, vendedora y evento a la nube', () => {
    const db = sdb.mapCajaToDB(cajaLocal);
    expect(db.caja_nombre).toBe('Caja 2');
    expect(db.turno).toBe('Mañana');
    expect(db.vendedora_nombre).toBe('Ana');
    expect(db.evento_especial).toBe('Feria');
  });

  it('no manda las columnas cuando el dato local no existe (no borra lo de otro aparato)', () => {
    const { cajaNombre, turno, vendedoraNombre, eventoEspecial, ...sinExtras } = cajaLocal;
    const db = sdb.mapCajaToDB(sinExtras);
    expect(db).not.toHaveProperty('caja_nombre');
    expect(db).not.toHaveProperty('turno');
    expect(db).not.toHaveProperty('vendedora_nombre');
    expect(db).not.toHaveProperty('evento_especial');
  });

  it('lee de la nube los cuatro campos', () => {
    const local = sdb.mapCajaFromDB({
      id: 'c1',
      usuario_id: 'u1',
      fecha_apertura: '2026-10-18T19:46:22.792Z',
      monto_apertura: '50000.00',
      total_ventas: '0',
      ventas_ids: [],
      estado: 'abierta',
      caja_nombre: 'Caja 2',
      turno: 'Mañana',
      vendedora_nombre: 'Ana',
      evento_especial: 'Feria',
    });
    expect(local.cajaNombre).toBe('Caja 2');
    expect(local.turno).toBe('Mañana');
    expect(local.vendedoraNombre).toBe('Ana');
    expect(local.eventoEspecial).toBe('Feria');
  });

  it('una caja vieja de la nube (columnas en null) no trae claves vacías que pisen lo local', () => {
    const local = sdb.mapCajaFromDB({
      id: 'c0',
      usuario_id: 'u1',
      fecha_apertura: '2026-10-01T10:00:00Z',
      monto_apertura: 0,
      total_ventas: 0,
      estado: 'cerrada',
      caja_nombre: null,
      turno: null,
      vendedora_nombre: null,
      evento_especial: null,
    });
    expect(local).not.toHaveProperty('cajaNombre');
    expect(local).not.toHaveProperty('turno');
    expect(local).not.toHaveProperty('vendedoraNombre');
    expect(local).not.toHaveProperty('eventoEspecial');
  });
});
