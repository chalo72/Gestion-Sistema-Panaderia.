/**
 * Equipo del turno (2026-10-08)
 *
 * Idea: el usuario que entra al sistema NO cambia (no hace falta "Vendedor Mañana" / "Vendedor Tarde").
 * Al abrir la jornada se elige el TURNO y QUIÉN LLEGÓ. Eso queda guardado como "equipo del turno" y
 * es lo que usa Ventas para poner el nombre en cada venta, mesa y venta rápida.
 *
 *  - Mañana (ej. Andrea / Erika): modo 'individual' → se vende a nombre de la persona.
 *  - Tarde (ej. María y Jessica): modo 'conjunta' → las dos son UNA sola responsable de la caja
 *    y todo sale a nombre de "María y Jessica".
 */
import { useEffect, useState } from 'react';

export type TurnoNombre = 'Mañana' | 'Tarde' | 'Noche';
export type ModoEquipo = 'individual' | 'conjunta';

export interface IntegranteTurno { id: string; nombre: string }

export interface EquipoTurno {
    fecha: string; // YYYY-MM-DD local
    turno: TurnoNombre;
    modo: ModoEquipo;
    integrantes: IntegranteTurno[];
    actualizadoEn: number;
}

export interface OpcionVendedora { id: string; nombre: string; rol?: string; equipo?: boolean }

const LS_KEY = 'dp_turno_equipo';
const CLOUD_KEY = 'equipo_turno';
const EVENTO = 'dp-equipo-turno';

export function fechaHoy(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function turnoPorHora(d: Date = new Date()): TurnoNombre {
    const h = d.getHours();
    if (h < 12) return 'Mañana';
    if (h < 18) return 'Tarde';
    return 'Noche';
}

/** "María", "María y Jessica", "Ana, María y Jessica" */
export function nombreEquipo(nombres: string[]): string {
    const n = nombres.map(x => (x || '').trim()).filter(Boolean);
    if (n.length <= 1) return n[0] || '';
    return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

/** Nombre con el que se firman las ventas cuando nadie fue elegido a mano. */
export function nombreResponsable(e: EquipoTurno | null): string {
    if (!e || e.integrantes.length === 0) return '';
    return nombreEquipo(e.integrantes.map(i => i.nombre));
}

/**
 * Opciones que se ofrecen en Ventas (chips / modal de mesa).
 *  - conjunta con 2+ personas → UNA sola opción con el nombre unido.
 *  - individual → una opción por persona.
 */
export function opcionesVendedoras(e: EquipoTurno | null): OpcionVendedora[] {
    if (!e || e.integrantes.length === 0) return [];
    if (e.modo === 'conjunta' && e.integrantes.length >= 2) {
        return [{
            id: `equipo:${e.fecha}:${e.turno}`,
            nombre: nombreEquipo(e.integrantes.map(i => i.nombre)),
            rol: 'EQUIPO',
            equipo: true,
        }];
    }
    return e.integrantes.map(i => ({ id: i.id, nombre: i.nombre, rol: 'VENDEDOR' }));
}

/** El equipo vale hoy; y también la madrugada siguiente (turno de noche que pasa de medianoche). */
export function equipoVigente(e: EquipoTurno | null, ahora: Date = new Date()): EquipoTurno | null {
    if (!e || !Array.isArray(e.integrantes) || e.integrantes.length === 0) return null;
    const hoy = fechaHoy(ahora);
    if (e.fecha === hoy) return e;
    const ayer = fechaHoy(new Date(ahora.getTime() - 86400000));
    if (e.fecha === ayer && ahora.getHours() < 7) return e;
    return null;
}

export function leerEquipoLocal(): EquipoTurno | null {
    try {
        const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        return v && Array.isArray(v.integrantes) ? (v as EquipoTurno) : null;
    } catch {
        return null;
    }
}

export interface DbRespaldo {
    getBackup(key: string): Promise<any>;
    saveBackup(key: string, val: any): Promise<void>;
}

export function guardarEquipo(e: EquipoTurno, dbx?: DbRespaldo | null): EquipoTurno {
    const nuevo = { ...e, actualizadoEn: Date.now() };
    try { localStorage.setItem(LS_KEY, JSON.stringify(nuevo)); } catch { /* lleno */ }
    try { window.dispatchEvent(new Event(EVENTO)); } catch { /* sin window */ }
    if (dbx) dbx.saveBackup(CLOUD_KEY, [nuevo]).catch(() => {});
    return nuevo;
}

export function limpiarEquipo(dbx?: DbRespaldo | null) {
    try { localStorage.removeItem(LS_KEY); } catch { /* nada */ }
    try { window.dispatchEvent(new Event(EVENTO)); } catch { /* nada */ }
    void dbx;
}

/** Trae el equipo de la nube (otro celular/PC) si es más nuevo que el local. */
export async function sincronizarEquipoDesdeNube(dbx: DbRespaldo): Promise<EquipoTurno | null> {
    const local = leerEquipoLocal();
    try {
        const cloud = await dbx.getBackup(CLOUD_KEY);
        const c = Array.isArray(cloud) ? cloud[0] : null;
        if (c && Array.isArray(c.integrantes) && (!local || (c.actualizadoEn || 0) > (local.actualizadoEn || 0))) {
            try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* lleno */ }
            try { window.dispatchEvent(new Event(EVENTO)); } catch { /* nada */ }
            return c as EquipoTurno;
        }
    } catch { /* sin nube */ }
    return local;
}

/** Hook: equipo vigente del turno (se actualiza solo al guardarlo en cualquier parte de la app). */
export function useEquipoTurno(dbx?: DbRespaldo | null): EquipoTurno | null {
    const [equipo, setEquipo] = useState<EquipoTurno | null>(() => equipoVigente(leerEquipoLocal()));
    useEffect(() => {
        const refrescar = () => setEquipo(equipoVigente(leerEquipoLocal()));
        window.addEventListener(EVENTO, refrescar);
        window.addEventListener('storage', refrescar);
        if (dbx) sincronizarEquipoDesdeNube(dbx).then(refrescar).catch(() => {});
        const t = setInterval(refrescar, 5 * 60 * 1000); // por si cambia el día
        return () => {
            window.removeEventListener(EVENTO, refrescar);
            window.removeEventListener('storage', refrescar);
            clearInterval(t);
        };
    }, [dbx]);
    return equipo;
}
