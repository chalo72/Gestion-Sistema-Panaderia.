import { describe, it, expect } from 'vitest';
import { esAccesoVendedoras, perfilesVendedoras, turnoDePerfil } from './acceso-vendedoras';

const u = (email: string, rol: string) => ({ id: email, email, nombre: email, rol, activo: true } as any);
const lista = [u('chalo@x.com', 'ADMIN'), u('vendedor.manana@x.com', 'VENDEDOR'), u('vendedor.tarde@x.com', 'VENDEDOR'), u('panadero@x.com', 'PANADERO'), u('vendedor.noche@x.com', 'VENDEDOR')];

describe('acceso vendedoras', () => {
    it('se activa por enlace o por aparato fijado', () => {
        expect(esAccesoVendedoras('?acceso=vendedoras', false)).toBe(true);
        expect(esAccesoVendedoras('', true)).toBe(true);
        expect(esAccesoVendedoras('?acceso=otro', false)).toBe(false);
        expect(esAccesoVendedoras('', false)).toBe(false);
    });

    it('solo muestra perfiles de venta', () => {
        const r = perfilesVendedoras(lista, new Date('2026-10-09T10:00:00'));
        expect(r).toHaveLength(3);
        expect(r.every(x => x.rol === 'VENDEDOR')).toBe(true);
    });

    it('pone primero el turno actual', () => {
        expect(perfilesVendedoras(lista, new Date('2026-10-09T10:00:00'))[0].email).toContain('manana');
        expect(perfilesVendedoras(lista, new Date('2026-10-09T15:00:00'))[0].email).toContain('tarde');
        expect(perfilesVendedoras(lista, new Date('2026-10-09T20:00:00'))[0].email).toContain('noche');
    });

    it('reconoce el turno del perfil', () => {
        expect(turnoDePerfil(lista[2])).toBe('Tarde');
        expect(turnoDePerfil(lista[0])).toBeNull();
    });
});
