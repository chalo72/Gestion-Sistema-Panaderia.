import { describe, it, expect, beforeEach } from 'vitest';
import {
    nuevoPedido, cambiarEstado, nivelUrgencia, etiquetaUrgencia, ordenarPedidos, totalPedido, saldoPedido,
    recordatorios, opcionesCatalogo, agregarAdicional, validarPedido, textoPedido, enlaceWhatsApp, diasHasta,
    guardarPedidos, cargarPedidosLocal, cargarPedidosDesdeNube, yaAvisado, marcarAvisado, horaBonita, htmlComanda,
    type PedidoTorta,
} from './pedidos-tortas';

const HOY = '2026-10-08';
const ped = (o: Partial<PedidoTorta> = {}): PedidoTorta => ({ ...nuevoPedido('Ana', o.id || 'x', 1000), cliente: 'Lola', sabor: 'Tres leches', fechaEntrega: HOY, ...o });
const fmt = (n: number) => `$${n}`;

describe('pedidos-tortas', () => {
    beforeEach(() => localStorage.clear());

    it('urgencia y etiquetas', () => {
        expect(nivelUrgencia(ped({ fechaEntrega: '2026-10-07' }), HOY)).toBe('atrasada');
        expect(nivelUrgencia(ped(), HOY)).toBe('hoy');
        expect(nivelUrgencia(ped({ fechaEntrega: '2026-10-09' }), HOY)).toBe('manana');
        expect(nivelUrgencia(ped({ fechaEntrega: '2026-10-12' }), HOY)).toBe('semana');
        expect(nivelUrgencia(ped({ fechaEntrega: '2026-11-12' }), HOY)).toBe('normal');
        expect(nivelUrgencia(ped({ estado: 'entregada' }), HOY)).toBe('cerrada');
        expect(etiquetaUrgencia(ped({ fechaEntrega: '2026-10-12' }), HOY)).toBe('en 4 días');
        expect(diasHasta('2026-10-31', HOY)).toBe(23);
    });

    it('ordena por fecha y hora', () => {
        const l = ordenarPedidos([
            ped({ id: 'c', fechaEntrega: '2026-10-10', horaEntrega: '09:00' }),
            ped({ id: 'a', fechaEntrega: '2026-10-09', horaEntrega: '15:00' }),
            ped({ id: 'b', fechaEntrega: '2026-10-09', horaEntrega: '08:00' }),
        ]);
        expect(l.map(x => x.id)).toEqual(['b', 'a', 'c']);
    });

    it('totales y saldo', () => {
        let p = ped({ precioBase: 50000, abono: 20000 });
        p = { ...p, adicionales: agregarAdicional(agregarAdicional([], { productoId: 'v', nombre: 'Vejiga', precio: 500 }), { productoId: 'v', nombre: 'Vejiga', precio: 500 }) };
        expect(p.adicionales[0].cantidad).toBe(2);
        expect(totalPedido(p)).toBe(51000);
        expect(saldoPedido(p)).toBe(31000);
        expect(saldoPedido({ ...p, abono: 99999 })).toBe(0);
    });

    it('recordatorios y cambio de estado con historial', () => {
        const r = recordatorios([
            ped({ id: '1', fechaEntrega: '2026-10-06' }), ped({ id: '2' }), ped({ id: '3', fechaEntrega: '2026-10-09' }),
            ped({ id: '4', fechaEntrega: '2026-10-20' }), ped({ id: '5', estado: 'entregada' }),
        ], HOY);
        expect([r.atrasadas.length, r.hoy.length, r.manana.length]).toEqual([1, 1, 1]);
        const p = cambiarEstado(ped(), 'en_preparacion', 'Rosa', 5000);
        expect(p.estado).toBe('en_preparacion');
        expect(p.historial.at(-1)).toEqual({ estado: 'en_preparacion', por: 'Rosa', en: 5000 });
    });

    it('catálogo: solo piñatería por defecto, todo si se pide, nunca ingredientes', () => {
        const prods = [
            { id: '1', nombre: 'Vejiga x10', categoria: 'Piñatería', precioVenta: 3000 },
            { id: '2', nombre: 'Pan', categoria: 'Panadería', precioVenta: 1000 },
            { id: '3', nombre: 'Harina', categoria: 'Piñatería', precioVenta: 5, tipo: 'ingrediente' },
            { id: '4', nombre: 'Sin precio', categoria: 'Piñatería', precioVenta: 0 },
        ];
        expect(opcionesCatalogo(prods, '', false).map(p => p.id)).toEqual(['1']);
        expect(opcionesCatalogo(prods, '', true).map(p => p.id)).toEqual(['2', '1']);
        expect(opcionesCatalogo(prods, 'vej', false)).toHaveLength(1);
    });

    it('validación, texto, whatsapp, hora, comanda', () => {
        expect(validarPedido(ped({ cliente: '' }))).toMatch(/cliente/);
        expect(validarPedido(ped({ fechaEntrega: '' }))).toMatch(/fecha/);
        expect(validarPedido(ped({ sabor: '' }))).toMatch(/sabor/);
        expect(validarPedido(ped())).toBeNull();
        const p = ped({ dedicatoria: 'Feliz día', precioBase: 40000, abono: 10000, telefono: '3101234567' });
        expect(textoPedido(p, fmt)).toContain('Saldo $30000');
        expect(enlaceWhatsApp('hola', p.telefono)).toContain('wa.me/573101234567');
        expect(horaBonita('15:30')).toBe('3:30 pm');
        expect(horaBonita('00:05')).toBe('12:05 am');
        expect(htmlComanda(p, fmt)).toContain('Feliz día');
    });

    it('guardar/cargar local, mezcla con nube y avisos diarios', async () => {
        const a = ped({ id: 'a' });
        guardarPedidos(null, [a]);
        expect(cargarPedidosLocal()).toHaveLength(1);
        const nube = { ...ped({ id: 'a' }), sabor: 'Chocolate', actualizadoEn: a.actualizadoEn + 100 };
        const otro = ped({ id: 'b' });
        const lista = await cargarPedidosDesdeNube({ getBackup: async () => [nube, otro], saveBackup: async () => {} });
        expect(lista).toHaveLength(2);
        expect(lista.find(x => x.id === 'a')?.sabor).toBe('Chocolate');
        expect(yaAvisado('a', HOY)).toBe(false);
        marcarAvisado('a', HOY);
        expect(yaAvisado('a', HOY)).toBe(true);
        expect(yaAvisado('a', '2026-10-09')).toBe(false);
    });
});
