/**
 * Historial de cajas por día (2026-10-09, AUTORIZO Gonzalo).
 * Junta, para UNA fecha, cada caja con su turno, horas, base, cierre y lo que de verdad se entregó en Bóveda,
 * y marca lo que no cuadra. Lógica pura (sin React) para poder probarla.
 */
export interface CajaDia {
    id: string;
    nombre: string;
    responsable: string;
    turno: string;
    abre: number;
    cierra?: number;
    minutos?: number;
    base: number;
    cierre: number | null;
    ventasApp: number;
    entregado: number | null;
    entregas: { t: number; monto: number }[];
    cierreAutomatico: boolean;
    estado: 'abierta' | 'cerrada';
    alertas: string[];
    sesion: any;
}

export interface TurnoDia {
    turno: string;
    responsables: string;
    desde: number;
    hasta?: number;
    cajas: CajaDia[];
    base: number;
    cierre: number;
    entregado: number;
    abiertas: number;
    alertas: number;
}

export interface ResumenDia {
    fecha: string;
    turnos: TurnoDia[];
    totalCierre: number;
    totalEntregado: number;
    totalBase: number;
    nCajas: number;
    nAbiertas: number;
    nAlertas: number;
    movimientosBoveda: { t: number; monto: number; motivo: string; tipo?: string }[];
}

const ORDEN_TURNO = ['Mañana', 'Tarde', 'Noche'];

/** Mañana hasta las 2 p. m., tarde hasta las 7 p. m., noche después. */
export function bandaHoraria(abre: number): 'Mañana' | 'Tarde' | 'Noche' {
    const h = new Date(abre).getHours();
    if (h < 14) return 'Mañana';
    if (h < 19) return 'Tarde';
    return 'Noche';
}
const num = (x: any) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
const ms = (x: any) => { const t = new Date(x).getTime(); return Number.isFinite(t) ? t : NaN; };
export const fechaLocal = (t: number | Date) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const norm = (s: any) => String(s || '').trim().toLowerCase();
export const unirNombres = (s: any): string => {
    const p = String(s || '').split(/\s*,\s*|\s+y\s+/i).map(x => x.trim()).filter(Boolean);
    if (p.length <= 1) return p[0] || '';
    return `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}`;
};
const cajaDeMotivo = (motivo: string) => norm(String(motivo).replace(/^[^:]*:\s*/, '').replace(/\s*\([^)]*\)\s*$/, ''));

export function resumenCajasDelDia(
    sesiones: any[],
    bovedaMovs: { fecha: string; monto: number; motivo: string; tipo?: string }[],
    fecha: string,
    opts: { nombre?: (s: any) => string; responsable?: (s: any) => string; umbral?: number } = {},
): ResumenDia {
    const umbral = opts.umbral ?? 2000;
    const nombreDe = opts.nombre || ((s: any) => s.cajaNombre || 'Caja');
    const respDe = opts.responsable || ((s: any) => s.vendedoraNombre || '');
    const movs = (bovedaMovs || []).map(m => ({ ...m, t: ms(m.fecha) })).filter(m => Number.isFinite(m.t));
    const entregas = movs.filter(m => /^Entrega de Turno:/i.test(String(m.motivo || '')));
    const autos = movs.filter(m => /^Cierre autom/i.test(String(m.motivo || '')));

    const delDia = (sesiones || []).filter(s => Number.isFinite(ms(s.fechaApertura)) && fechaLocal(ms(s.fechaApertura)) === fecha);
    const cajas: CajaDia[] = delDia.map(s => {
        const abre = ms(s.fechaApertura);
        const cierra = s.fechaCierre ? ms(s.fechaCierre) : undefined;
        const nombre = nombreDe(s);
        const fin = cierra ?? Date.now();
        const suyas = entregas.filter(m => cajaDeMotivo(m.motivo) === norm(nombre) && m.t >= abre && m.t <= fin + 60000)
            .sort((a, b) => a.t - b.t);
        const auto = !!cierra && autos.some(m => cajaDeMotivo(m.motivo) === norm(nombre) && Math.abs(m.t - cierra) <= 15000);
        const cierre = s.estado === 'cerrada' ? num(s.montoCierre) : null;
        const entregado = suyas.length ? num(suyas[suyas.length - 1].monto) : null;
        const minutos = cierra ? Math.round((cierra - abre) / 60000) : undefined;
        const alertas: string[] = [];
        if (suyas.length >= 2) alertas.push(`Entregada ${suyas.length} veces`);
        if (cierre != null && suyas.length && !suyas.some(m => Math.abs(num(m.monto) - cierre) < umbral)) alertas.push('Cierre ≠ entrega');
        if (auto) alertas.push('Se cerró sola al abrir otro turno');
        if (minutos != null && minutos < 15) alertas.push(`Solo ${Math.max(1, minutos)} min abierta`);
        if (s.estado === 'cerrada' && !suyas.length && num(s.montoCierre) === 0 && !auto) alertas.push('Cerrada en $0 sin entrega');
        return {
            id: s.id, nombre, responsable: unirNombres(respDe(s)) || 'Sin nombre', turno: s.turno || 'Sin turno',
            abre, cierra, minutos, base: num(s.montoApertura), cierre, ventasApp: num(s.totalVentas), entregado,
            entregas: suyas.map(m => ({ t: m.t, monto: num(m.monto) })), cierreAutomatico: auto,
            estado: s.estado === 'abierta' ? 'abierta' : 'cerrada', alertas, sesion: s,
        };
    });

    const grupos = new Map<string, CajaDia[]>();
    for (const c of cajas) {
        const clave = c.turno || 'Sin turno';
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave)!.push(c);
    }
    // Si un mismo nombre de turno mezcla mañana y tarde (pasó el 17: todo quedó
    // guardado como "Mañana" aunque Andrea abrió a las 6 p. m.), se parte por la hora.
    const piezas: { turno: string; cajas: CajaDia[] }[] = [];
    for (const [turno, lista] of grupos) {
        const bandas = new Set(lista.map(c => bandaHoraria(c.abre)));
        if (bandas.size > 1) {
            for (const b of ORDEN_TURNO) {
                const delBloque = lista.filter(c => bandaHoraria(c.abre) === b);
                if (delBloque.length) piezas.push({ turno: b, cajas: delBloque });
            }
        } else {
            const unica = [...bandas][0];
            const nombre = ((turno === 'Mañana' && unica && unica !== 'Mañana') || turno === 'Sin turno')
                ? (unica || turno)
                : turno;
            piezas.push({ turno: nombre, cajas: lista });
        }
    }
    const fusion = new Map<string, CajaDia[]>();
    for (const p of piezas) {
        if (!fusion.has(p.turno)) fusion.set(p.turno, []);
        fusion.get(p.turno)!.push(...p.cajas);
    }
    const turnos: TurnoDia[] = [...fusion.entries()].map(([turno, lista]) => {
        lista.sort((a, b) => (a.nombre === 'Caja Principal' ? -1 : b.nombre === 'Caja Principal' ? 1 : a.abre - b.abre));
        const cierres = lista.map(c => c.cierra).filter((x): x is number => x != null);
        return {
            turno,
            responsables: [...new Set(lista.map(c => c.responsable).filter(r => r !== 'Sin nombre'))].join(' · ') || 'Sin nombre',
            desde: Math.min(...lista.map(c => c.abre)),
            hasta: lista.some(c => c.estado === 'abierta') ? undefined : (cierres.length ? Math.max(...cierres) : undefined),
            cajas: lista,
            base: lista.reduce((s, c) => s + c.base, 0),
            cierre: lista.reduce((s, c) => s + (c.cierre || 0), 0),
            entregado: lista.reduce((s, c) => s + (c.entregado || 0), 0),
            abiertas: lista.filter(c => c.estado === 'abierta').length,
            alertas: lista.reduce((s, c) => s + c.alertas.length, 0),
        };
    }).sort((a, b) => {
        const ia = ORDEN_TURNO.indexOf(a.turno), ib = ORDEN_TURNO.indexOf(b.turno);
        return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.desde - b.desde;
    });

    return {
        fecha, turnos,
        totalCierre: turnos.reduce((s, t) => s + t.cierre, 0),
        totalEntregado: turnos.reduce((s, t) => s + t.entregado, 0),
        totalBase: turnos.reduce((s, t) => s + t.base, 0),
        nCajas: cajas.length,
        nAbiertas: cajas.filter(c => c.estado === 'abierta').length,
        nAlertas: cajas.reduce((s, c) => s + c.alertas.length, 0),
        movimientosBoveda: movs.filter(m => fechaLocal(m.t) === fecha && /^(Entrega de Turno|Cierre autom)/i.test(String(m.motivo || '')))
            .sort((a, b) => a.t - b.t).map(m => ({ t: m.t, monto: num(m.monto), motivo: m.motivo, tipo: m.tipo })),
    };
}

/** Texto para mandar por WhatsApp. */
export function resumenDiaTexto(r: ResumenDia): string {
    const $ = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
    const h = (t?: number) => (t ? new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'abierta');
    const l = [`🧾 *CAJAS ${r.fecha}*`, `Cierres ${$(r.totalCierre)} · Entregado en Bóveda ${$(r.totalEntregado)} · ${r.nCajas} cajas${r.nAlertas ? ` · ⚠ ${r.nAlertas} alertas` : ''}`];
    for (const t of r.turnos) {
        l.push('', `*${t.turno}* (${t.responsables}) ${h(t.desde)}–${h(t.hasta)}: cierre ${$(t.cierre)}, entregado ${$(t.entregado)}`);
        for (const c of t.cajas) l.push(`• ${c.nombre}: ${c.cierre == null ? 'abierta' : $(c.cierre)}${c.alertas.length ? ' ⚠ ' + c.alertas.join(', ') : ''}`);
    }
    return l.join('\n');
}
