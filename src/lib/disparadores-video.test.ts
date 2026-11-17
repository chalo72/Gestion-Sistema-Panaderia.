import { describe, it, expect } from 'vitest';
import { detectarEventos, estadoVistoVacio, siguienteModoClips } from './disparadores-video';

const ahora = new Date('2026-10-09T10:00:00').getTime();
const hace = (min: number) => new Date(ahora - min * 60000).toISOString();
const venta = (id: string, min: number, extra: any = {}) => ({ id, fecha: hace(min), total: 12000, metodoPago: 'efectivo', vendedoraNombre: 'Ana', ...extra });

describe('disparadores de video', () => {
    it('la primera lectura no dispara nada (solo memoriza)', () => {
        const v = estadoVistoVacio();
        expect(detectarEventos(v, [venta('a', 1)], [], ahora)).toEqual([]);
        expect(detectarEventos(v, [venta('a', 1)], [], ahora)).toEqual([]);
    });

    it('una venta nueva y reciente dispara un clip', () => {
        const v = estadoVistoVacio();
        detectarEventos(v, [venta('a', 5)], [], ahora);
        const ev = detectarEventos(v, [venta('a', 5), venta('b', 0)], [], ahora);
        expect(ev).toHaveLength(1);
        expect(ev[0].tipo).toBe('venta');
        expect(ev[0].motivo).toContain('Ana');
    });

    it('una venta vieja que llega por sincronización no dispara', () => {
        const v = estadoVistoVacio();
        detectarEventos(v, [], [], ahora);
        expect(detectarEventos(v, [venta('vieja', 120)], [], ahora)).toEqual([]);
    });

    it('venta que desaparece = anulada (sensible)', () => {
        const v = estadoVistoVacio();
        detectarEventos(v, [venta('a', 30), venta('b', 20)], [], ahora);
        const ev = detectarEventos(v, [venta('b', 20)], [], ahora);
        expect(ev).toHaveLength(1);
        expect(ev[0].tipo).toBe('venta_anulada');
        expect(ev[0].sensible).toBe(true);
    });

    it('lista vacía por recarga no marca todo como anulado', () => {
        const v = estadoVistoVacio();
        detectarEventos(v, [venta('a', 30)], [], ahora);
        expect(detectarEventos(v, [], [], ahora)).toEqual([]);
    });

    it('movimiento de caja nuevo: salida es sensible', () => {
        const v = estadoVistoVacio();
        const caja = (movs: any[]) => [{ id: 'c1', movimientos: movs }];
        detectarEventos(v, [], caja([]), ahora);
        const ev = detectarEventos(v, [], caja([{ id: 'm1', tipo: 'salida', monto: 20000, motivo: 'Devolución cliente', fecha: hace(0) }]), ahora);
        expect(ev).toHaveLength(1);
        expect(ev[0].sensible).toBe(true);
        expect(ev[0].motivo).toContain('Devolución cliente');
    });

    it('rota el modo de clips', () => {
        expect(siguienteModoClips('continuo')).toBe('ambos');
        expect(siguienteModoClips('ambos')).toBe('eventos');
        expect(siguienteModoClips('eventos')).toBe('continuo');
    });
});
