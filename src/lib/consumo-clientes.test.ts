import { describe, it, expect } from 'vitest';
import { sumarConsumo, creditoConsumoAbierto, CATEGORIA_CONSUMO } from './consumo-clientes';
import type { CreditoCliente } from '@/types';

const jairo = { id: 'c-jairo', nombre: 'Jairo compadre', telefono: '' };
const ahora = new Date(2026, 10, 16, 10, 0);

describe('Consumo de clientes de confianza', () => {
  it('primer consumo crea un crédito de consumo abierto', () => {
    const r = sumarConsumo(undefined, { cliente: jairo, monto: 5000, descripcion: '2 panes', usuarioId: 'u1', ahora });
    expect(r.esNuevo).toBe(true);
    expect(r.credito.clienteId).toBe('c-jairo');
    expect(r.credito.categoriaCliente).toBe(CATEGORIA_CONSUMO);
    expect(r.credito.monto).toBe(5000);
    expect(r.credito.saldo).toBe(5000);
    expect(r.credito.estado).toBe('activo');
    expect(r.credito.items[0].nombre).toBe('16/11 · 2 panes');
  });

  it('segundo consumo se suma al mismo crédito (no crea otro)', () => {
    const abierto = {
      ...(sumarConsumo(undefined, { cliente: jairo, monto: 5000, descripcion: 'pan', usuarioId: 'u1', ahora }).credito),
      id: 'cr1', createdAt: ahora.toISOString(),
    } as CreditoCliente;
    const r = sumarConsumo(abierto, { cliente: jairo, monto: 3500, descripcion: 'gaseosa', usuarioId: 'u1', ahora });
    expect(r.esNuevo).toBe(false);
    expect(r.credito).toMatchObject({ id: 'cr1', monto: 8500, saldo: 8500 });
    expect(r.credito.items).toHaveLength(2);
  });

  it('si ya abonó, el saldo sube solo lo nuevo', () => {
    const abierto = { id: 'cr1', clienteId: 'c-jairo', clienteNombre: 'Jairo', categoriaCliente: CATEGORIA_CONSUMO,
      monto: 10000, saldo: 4000, descripcion: '', fecha: '', estado: 'activo', items: [], pagos: [], usuarioId: 'u1', createdAt: '' } as CreditoCliente;
    const r = sumarConsumo(abierto, { cliente: jairo, monto: 2000, descripcion: 'x', usuarioId: 'u1', ahora });
    expect(r.credito).toMatchObject({ monto: 12000, saldo: 6000 });
  });

  it('rechaza montos inválidos', () => {
    expect(() => sumarConsumo(undefined, { cliente: jairo, monto: 0, descripcion: '', usuarioId: 'u1' })).toThrow();
    expect(() => sumarConsumo(undefined, { cliente: jairo, monto: NaN, descripcion: '', usuarioId: 'u1' })).toThrow();
  });

  it('solo toma como abierto el crédito de consumo activo de ese cliente', () => {
    const base = { clienteNombre: 'J', monto: 1, saldo: 1, descripcion: '', fecha: '', items: [], pagos: [], usuarioId: 'u', createdAt: '' };
    const creditos = [
      { ...base, id: 'a', clienteId: 'c-jairo', categoriaCliente: 'Mayorista', estado: 'activo' },
      { ...base, id: 'b', clienteId: 'c-jairo', categoriaCliente: CATEGORIA_CONSUMO, estado: 'pagado' },
      { ...base, id: 'c', clienteId: 'otro', categoriaCliente: CATEGORIA_CONSUMO, estado: 'activo' },
      { ...base, id: 'd', clienteId: 'c-jairo', categoriaCliente: CATEGORIA_CONSUMO, estado: 'activo' },
    ] as CreditoCliente[];
    expect(creditoConsumoAbierto(creditos, 'c-jairo')?.id).toBe('d');
  });
});
