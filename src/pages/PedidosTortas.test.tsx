// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

vi.mock('@/lib/database', () => ({
    db: {
        getBackup: vi.fn(async () => null),
        saveBackup: vi.fn(async () => {}),
        getAllTrabajadores: vi.fn(async () => [{ id: 't1', nombre: 'Rosa', estado: 'activo' }]),
        batchAjustarStock: vi.fn(async () => {}),
    },
}));
vi.mock('@/lib/nube-kv', () => ({ dbNube: { getBackup: async () => null, saveBackup: async () => {} } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import PedidosTortas from './PedidosTortas';
import { cargarPedidosLocal } from '@/lib/pedidos-tortas';
import { db } from '@/lib/database';

const registrarVenta = vi.fn(async (v: any) => v);

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement; let root: Root;
const flush = async () => { await act(async () => { await new Promise(r => setTimeout(r, 20)); }); };
const setVal = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};
const q = <T extends Element>(s: string) => document.querySelector(s) as T;

const productos = [
    { id: 'p1', nombre: 'Vejiga paquete', categoria: 'Piñatería', precioVenta: 3000 },
    { id: 'p2', nombre: 'Pan francés', categoria: 'Panadería', precioVenta: 1000 },
];

beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ''; });

describe('PedidosTortas', () => {
    it('crea un pedido con adicional de piñatería, lo muestra en el tablero y avanza de estado', async () => {
        await act(async () => { root.render(<PedidosTortas productos={productos} clientes={[]} usuarioNombre="Vendedora" usuarioId="u1" registrarVenta={registrarVenta} cajaActiva={{ id: 'c1' }} />); });
        await flush();

        await act(async () => { q<HTMLButtonElement>('[data-nuevo-pedido]').click(); });
        await flush();

        // solo piñatería aparece por defecto
        expect(q('[data-add-producto="p1"]')).toBeTruthy();
        expect(q('[data-add-producto="p2"]')).toBeNull();

        await act(async () => {
            setVal(q('[data-campo="cliente"]'), 'Lola');
            setVal(q('[data-campo="fecha"]'), new Date().toISOString().slice(0, 10));
            setVal(q('[data-campo="sabor"]'), 'Tres leches');
            setVal(q('[data-campo="precio"]'), '50000');
            setVal(q('[data-campo="abono"]'), '20000');
        });
        await act(async () => { q<HTMLButtonElement>('[data-add-producto="p1"]').click(); });
        expect(q('[data-resumen]').textContent).toContain('53.000');
        expect(q('[data-saldo]').textContent).toContain('33.000');

        await act(async () => { q<HTMLButtonElement>('[data-guardar]').click(); });
        await flush();

        const guardados = cargarPedidosLocal();
        expect(guardados).toHaveLength(1);
        expect(guardados[0].adicionales[0].productoId).toBe('p1');
        expect(q('[data-pedido]').textContent).toContain('Lola');
        expect(q('[data-recordatorios]').textContent).toContain('HOY');

        // avanzar: pendiente → en preparación (con saldo, pero solo confirma al entregar)
        await act(async () => { q<HTMLButtonElement>('[data-avanzar]').click(); });
        expect(cargarPedidosLocal()[0].estado).toBe('en_preparacion');

        // el abono entró a caja una sola vez
        expect(registrarVenta).toHaveBeenCalledTimes(1);
        expect(registrarVenta.mock.calls[0][0].total).toBe(20000);
        expect(cargarPedidosLocal()[0].registradoCaja).toBe(20000);

        // lista → entregar y cobrar el saldo
        await act(async () => { q<HTMLButtonElement>('[data-avanzar]').click(); });
        expect(cargarPedidosLocal()[0].estado).toBe('lista');
        await act(async () => { q<HTMLButtonElement>('[data-avanzar]').click(); });
        expect(q('[data-saldo-entrega]').textContent).toContain('33.000');
        await act(async () => { q<HTMLButtonElement>('[data-confirmar-entrega]').click(); });
        await flush();
        expect(registrarVenta).toHaveBeenCalledTimes(2);
        expect(registrarVenta.mock.calls[1][0].total).toBe(33000);
        expect((db as any).batchAjustarStock).toHaveBeenCalledWith([expect.objectContaining({ productoId: 'p1', cantidad: 1, tipo: 'salida' })]);
        const fin = cargarPedidosLocal()[0];
        expect(fin.estado).toBe('entregada');
        expect(fin.abono).toBe(53000);
        expect(fin.registradoCaja).toBe(53000);
        expect(fin.stockDescontado).toBe(true);
    });

    it('no guarda sin cliente', async () => {
        await act(async () => { root.render(<PedidosTortas productos={productos} clientes={[]} />); });
        await flush();
        await act(async () => { q<HTMLButtonElement>('[data-nuevo-pedido]').click(); });
        await flush();
        await act(async () => { q<HTMLButtonElement>('[data-guardar]').click(); });
        expect(cargarPedidosLocal()).toHaveLength(0);
    });
});
