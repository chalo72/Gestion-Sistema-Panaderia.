/**
 * Disparadores de video: detecta cuándo pasa algo en caja (venta, venta anulada, movimiento de caja)
 * para que Videovigilancia grabe un clip justo en ese momento, en vez de grabar a ciegas cada minuto.
 */
const VENTANA_RECIENTE_MS = 10 * 60 * 1000;   // ignora lo que llega por sincronización y ya es viejo
const VENTANA_ANULADA_MS = 24 * 3600 * 1000;

export type TipoEventoOperativo = 'venta' | 'venta_anulada' | 'movimiento_caja';

export interface EventoOperativo {
    clave: string;
    tipo: TipoEventoOperativo;
    motivo: string;
    /** Anulaciones, retiros y devoluciones: se graban aunque haya mucho movimiento. */
    sensible: boolean;
}

export interface EstadoVisto {
    iniciado: boolean;
    ventas: Map<string, string>;  // id → fecha
    movs: Set<string>;
}

export const estadoVistoVacio = (): EstadoVisto => ({ iniciado: false, ventas: new Map(), movs: new Set() });

const money = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const RE_SENS = /anul|elimin|borr|devoluci|reembols|retiro|retirar|ajust|egreso/i;

/** Compara con lo ya visto y devuelve los eventos nuevos. Modifica `visto`. */
export function detectarEventos(visto: EstadoVisto, ventas: any[], cajas: any[], ahora = Date.now()): EventoOperativo[] {
    const movs: any[] = [];
    for (const c of cajas || []) for (const m of c.movimientos || []) movs.push({ ...m, _caja: c });

    if (!visto.iniciado) {
        ventas.forEach(v => visto.ventas.set(v.id, v.fecha));
        movs.forEach(m => visto.movs.add(m.id));
        visto.iniciado = true;
        return [];
    }

    const out: EventoOperativo[] = [];
    const actuales = new Set<string>();

    for (const v of ventas) {
        actuales.add(v.id);
        if (visto.ventas.has(v.id)) continue;
        visto.ventas.set(v.id, v.fecha);
        const t = new Date(v.fecha).getTime();
        if (Number.isFinite(t) && ahora - t <= VENTANA_RECIENTE_MS) {
            const quien = v.vendedoraNombre ? ` (${v.vendedoraNombre})` : '';
            out.push({ clave: `venta-${v.id}`, tipo: 'venta', motivo: `Venta ${money(v.total)}${quien}`, sensible: v.metodoPago === 'credito' || /descuento/i.test(String(v.notas || '')) });
        }
    }

    // Ventas que estaban y ya no están = anuladas/eliminadas (solo si la lista no llegó vacía por una recarga)
    if (ventas.length > 0) {
        for (const [id, fecha] of [...visto.ventas]) {
            if (actuales.has(id)) continue;
            visto.ventas.delete(id);
            const t = new Date(fecha).getTime();
            if (Number.isFinite(t) && ahora - t <= VENTANA_ANULADA_MS) {
                out.push({ clave: `anulada-${id}`, tipo: 'venta_anulada', motivo: 'Venta anulada o eliminada', sensible: true });
            }
        }
    }

    for (const m of movs) {
        if (visto.movs.has(m.id)) continue;
        visto.movs.add(m.id);
        const t = new Date(m.fecha).getTime();
        if (!Number.isFinite(t) || ahora - t > VENTANA_RECIENTE_MS) continue;
        const texto = String(m.motivo || '').trim();
        out.push({
            clave: `mov-${m.id}`, tipo: 'movimiento_caja',
            motivo: `Caja: ${m.tipo === 'salida' ? 'salida' : 'entrada'} ${money(m.monto)}${texto ? ` — ${texto}` : ''}`,
            sensible: m.tipo === 'salida' || RE_SENS.test(texto),
        });
    }
    return out;
}

export type ModoClips = 'continuo' | 'eventos' | 'ambos';
const KEY_MODO = 'dp_modo_clips_v1';
export const cargarModoClips = (): ModoClips => {
    try { const v = localStorage.getItem(KEY_MODO); return v === 'eventos' || v === 'continuo' ? v : 'ambos'; } catch { return 'ambos'; }
};
export const guardarModoClips = (m: ModoClips) => { try { localStorage.setItem(KEY_MODO, m); } catch { /* sin almacenamiento */ } };
export const siguienteModoClips = (m: ModoClips): ModoClips => (m === 'continuo' ? 'ambos' : m === 'ambos' ? 'eventos' : 'continuo');
export const ETIQUETA_MODO: Record<ModoClips, string> = { continuo: 'Cada minuto', ambos: 'Minuto + eventos', eventos: 'Solo eventos' };
