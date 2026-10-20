/**
 * Acceso directo para vendedoras (2026-10-09).
 * - Enlace /?acceso=vendedoras (o el acceso directo de la app instalada) abre el login solo con los perfiles de venta.
 * - "Fijar en este aparato" deja ese login como el normal en el celular/PC de la caja.
 * - El perfil del turno actual sale primero y resaltado.
 */
import type { Usuario } from '@/types';
import { turnoPorHora, type TurnoNombre } from '@/lib/equipo-turno';

const LS_FIJO = 'dp_acceso_vendedoras_fijo';

export function esAccesoVendedoras(search: string, fijo: boolean): boolean {
    try { return fijo || new URLSearchParams(search).get('acceso') === 'vendedoras'; } catch { return fijo; }
}

export const accesoVendedorasFijo = (): boolean => {
    try { return localStorage.getItem(LS_FIJO) === '1'; } catch { return false; }
};

export const fijarAccesoVendedoras = (v: boolean) => {
    try { if (v) localStorage.setItem(LS_FIJO, '1'); else localStorage.removeItem(LS_FIJO); } catch { /* sin almacenamiento */ }
};

export const esPerfilVendedora = (u: Usuario): boolean => u.rol === 'VENDEDOR' || u.rol === 'AUXILIAR';

/** Turno al que pertenece un perfil, según su correo ("vendedor.tarde@…"). */
export function turnoDePerfil(u: Usuario): TurnoNombre | null {
    const e = (u.email || '').toLowerCase();
    if (e.includes('manana') || e.includes('mañana')) return 'Mañana';
    if (e.includes('tarde')) return 'Tarde';
    if (e.includes('noche')) return 'Noche';
    return null;
}

/** Solo perfiles de venta, con el del turno actual primero. */
export function perfilesVendedoras(usuarios: Usuario[], ahora: Date = new Date()): Usuario[] {
    const actual = turnoPorHora(ahora);
    return usuarios
        .filter(esPerfilVendedora)
        .sort((a, b) => Number(turnoDePerfil(b) === actual) - Number(turnoDePerfil(a) === actual));
}
