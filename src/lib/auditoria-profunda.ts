/**
 * Auditoría profunda — motor de reglas (puro, sin React ni red).
 * Cruza ventas, cajas, gastos, inventario y las cintas grabadas para encontrar
 * lo que no cuadra, y lo resume en un puntaje de riesgo.
 */

export type Severidad = 'critica' | 'alta' | 'media' | 'info';
export type CategoriaHallazgo = 'caja' | 'ventas' | 'inventario' | 'gastos' | 'cinta' | 'video';

/** Micro-video de Videovigilancia (Bitácora Visual) ya analizado por la IA. */
export interface ClipVideo {
    id: string;
    camara_id: string;
    camara_nombre?: string | null;
    capturado_en: string;
    url_clip?: string;
    analizado?: boolean;
    descripcion_ia?: string | null;
    clasificacion?: 'bueno' | 'regular' | 'malo' | 'por_mejorar' | null;
    categorias_detectadas?: string[] | null;
    alerta?: boolean;
}

export interface RefHallazgo { tipo: 'venta' | 'caja' | 'gasto' | 'movimiento' | 'sesion' | 'clip'; id: string; t?: number }

export interface Hallazgo {
    id: string;
    regla: string;
    severidad: Severidad;
    categoria: CategoriaHallazgo;
    titulo: string;
    detalle: string;
    fecha?: string;
    monto?: number;
    responsable?: string;
    refs: RefHallazgo[];
    puntos: number;
}

/** Metadatos de una cinta (sesión grabada). Se guardan aparte de los eventos pesados. */
export interface SesionMeta {
    id: string;
    inicio: number;
    fin: number;
    usuario?: string;
    rol?: string;
    /** Id de quien tenía la sesión abierta. No es el turno de caja. */
    usuarioId?: string;
    turno?: string;
    equipo?: string;      // quién estaba en el turno (ej. "María y Jessica")
    dispositivo?: string;
    eventos: number;
    clics: number;
    entradas: number;
    vistas: string[];
    sensibles: { t: number; texto: string; usuario?: string; rol?: string; usuarioId?: string }[];
    acciones: { t: number; texto: string; usuario?: string; rol?: string; usuarioId?: string }[];
    semilla?: string;     // hash de la cinta anterior (cadena)
    chunks: { n: number; hash: string }[];
    hashFinal?: string;
    nube?: boolean;
    sinCinta?: boolean;   // la cinta pesada ya se podó; solo queda el resumen
    integridad?: 'ok' | 'rota' | 'sin_verificar';
    /** Recorrido por módulos: cuándo entró y salió de cada pantalla. */
    modulos?: { vista: string; entra: number; sale?: number; critico?: boolean }[];
    /** Momentos críticos (micro-videos de ~30 s dentro de la cinta). */
    momentos?: { t: number; motivo: string; vista?: string }[];
}

export interface DatosAuditoria {
    ventas: any[];
    sesionesCaja: any[];
    gastos: any[];
    movimientos: any[];
    productos: any[];
    inventario: any[];
    sesionesGrabadas: SesionMeta[];
    /** Clips de Videovigilancia del periodo (opcional). */
    clips?: ClipVideo[];
    /** Movimientos de la Bóveda (Entregas de Turno, cierres automáticos…). */
    bovedaMovs?: { fecha: string; monto: number; motivo: string; tipo?: string }[];
}

export interface OpcionesAuditoria {
    desde: string;   // YYYY-MM-DD
    hasta: string;   // YYYY-MM-DD
    ahora?: number;
    horaApertura?: number;     // antes de esta hora = fuera de horario
    horaCierre?: number;       // desde esta hora = fuera de horario
    umbralDescuadre?: number;  // $ mínimo para marcar descuadre
    umbralGasto?: number;      // $ desde el cual un gasto necesita comprobante
}

export interface PersonaRiesgo {
    nombre: string;
    ventas: number;
    total: number;
    ticketPromedio: number;
    descuentos: number;
    creditoPct: number;
    fueraHorario: number;
    hallazgos: number;
    puntos: number;
    riesgo: number; // 0-100
}

export interface ResultadoAuditoria {
    hallazgos: Hallazgo[];
    score: number;
    nivel: 'verde' | 'amarillo' | 'rojo';
    kpis: {
        nVentas: number; totalVentas: number; ticketPromedio: number;
        efectivoPct: number; digitalPct: number; creditoPct: number;
        descuadreNeto: number; cajasAuditadas: number;
        porSeveridad: Record<Severidad, number>;
        nClips: number; clipsAlerta: number;
        nEntregas: number; cajasCruzadas: number; sinVentasPOS: boolean;
    };
    personas: PersonaRiesgo[];
}

const PUNTOS: Record<Severidad, number> = { critica: 25, alta: 12, media: 5, info: 1 };
export const SEVERIDAD_ORDEN: Severidad[] = ['critica', 'alta', 'media', 'info'];

const num = (x: any): number => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
const ts = (iso: any): number => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? t : NaN; };
const dia = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** "Daniela, Shirley " y "Daniela y Shirley" son la misma responsable → "Daniela y Shirley". */
export const normalizarNombre = (s: any): string => {
    const partes = String(s || '').split(/\s*,\s*|\s+y\s+/i).map(x => x.trim()).filter(Boolean);
    if (partes.length <= 1) return partes[0] || '';
    return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};
export const quienVendio = (v: any): string => normalizarNombre(v?.vendedoraNombre) || String(v?.usuarioId || 'Sin nombre');
const responsableCaja = (c: any): string | undefined => normalizarNombre(c?.vendedoraNombre) || c?.usuarioId || undefined;
const normCaja = (s: any) => String(s || '').trim().toLowerCase();
/** "$5.000,50" → 5000.5 (formato colombiano: punto de miles, coma decimal). */
const montoCO = (s: string): number => num(String(s).replace(/\./g, '').replace(',', '.'));
/** Turnos válidos según la hora de apertura. Mañana 4–13 h, Tarde 12–21 h, Noche 20–5 h. */
export function turnosPosibles(hora: number): string[] {
    const r: string[] = [];
    if (hora >= 4 && hora < 13) r.push('Mañana');
    if (hora >= 12 && hora < 21) r.push('Tarde');
    if (hora >= 20 || hora < 5) r.push('Noche');
    return r;
}

/** Palabras que hacen sensible una acción registrada en la cinta. */
export const RE_SENSIBLE = /anular|eliminar|borrar|descuento|devoluci|reembols|ajust|cerrar caja|abrir caja|retiro|retirar|precio|cr[eé]dito|fiado|abono|gasto|vaciar|reiniciar|restaurar|merma|egreso/i;

function hallazgo(h: Omit<Hallazgo, 'puntos' | 'refs'> & { refs?: RefHallazgo[] }): Hallazgo {
    return { ...h, refs: h.refs || [], puntos: PUNTOS[h.severidad] };
}

function enRango(t: number, desde: number, hasta: number) { return Number.isFinite(t) && t >= desde && t <= hasta; }

export function ejecutarAuditoria(datos: DatosAuditoria, op: OpcionesAuditoria): ResultadoAuditoria {
    const ahora = op.ahora ?? Date.now();
    const desde = ts(`${op.desde}T00:00:00`);
    const hasta = ts(`${op.hasta}T23:59:59`);
    const hApertura = op.horaApertura ?? 5;
    const hCierre = op.horaCierre ?? 23; // el turno de la tarde entrega hasta ~22:40
    const umbralDescuadre = op.umbralDescuadre ?? 2000;
    const umbralGasto = op.umbralGasto ?? 200000;

    const ventas = (datos.ventas || []).filter(v => enRango(ts(v.fecha), desde, hasta));
    const ventasPorId = new Map<string, any>((datos.ventas || []).map(v => [v.id, v]));
    const hall: Hallazgo[] = [];

    // ── CAJA ────────────────────────────────────────────────────────────────
    let descuadreNeto = 0; let cajasAuditadas = 0;
    for (const c of datos.sesionesCaja || []) {
        const tAp = ts(c.fechaApertura);
        if (c.estado === 'abierta') {
            const horas = (ahora - tAp) / 3600000;
            if (Number.isFinite(horas) && horas > 16 && tAp <= hasta) {
                hall.push(hallazgo({
                    id: `caja-abierta-${c.id}`, regla: 'caja_abierta_larga', severidad: 'media', categoria: 'caja',
                    titulo: `Caja abierta hace ${Math.round(horas)} horas`,
                    detalle: `${c.cajaNombre || 'Caja'} sigue abierta desde ${new Date(tAp).toLocaleString('es-CO')}. Una caja olvidada abierta mezcla turnos y esconde faltantes.`,
                    fecha: c.fechaApertura, responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
                }));
            }
            continue;
        }
        const tCierre = ts(c.fechaCierre || c.fechaApertura);
        if (!enRango(tCierre, desde, hasta)) continue;
        if (c.montoCierre == null || c.ventasManualIngresadas) continue;
        const vs = (c.ventasIds || []).map((id: string) => ventasPorId.get(id)).filter(Boolean);
        if (vs.length === 0 && !num(c.totalVentas)) continue;
        const efectivo = vs.filter((v: any) => v.metodoPago === 'efectivo').reduce((s: number, v: any) => s + num(v.total), 0);
        const mov = c.movimientos || [];
        const entradas = mov.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + num(m.monto), 0);
        const salidas = mov.filter((m: any) => m.tipo === 'salida').reduce((s: number, m: any) => s + num(m.monto), 0);
        const esperado = num(c.montoApertura) + efectivo + entradas - salidas;
        const diff = num(c.montoCierre) - esperado;
        cajasAuditadas++;
        descuadreNeto += diff;
        if (Math.abs(diff) >= umbralDescuadre) {
            const falta = diff < 0;
            const sev: Severidad = Math.abs(diff) >= 100000 ? (falta ? 'critica' : 'alta') : Math.abs(diff) >= 20000 ? 'alta' : 'media';
            hall.push(hallazgo({
                id: `descuadre-${c.id}`, regla: 'descuadre_caja', severidad: sev, categoria: 'caja',
                titulo: `${falta ? 'Faltante' : 'Sobrante'} de ${money(Math.abs(diff))} en ${c.cajaNombre || 'caja'}`,
                detalle: `Esperado en cajón ${money(esperado)} (apertura ${money(num(c.montoApertura))} + ventas en efectivo ${money(efectivo)} + entradas ${money(entradas)} − salidas ${money(salidas)}). Contado al cierre ${money(num(c.montoCierre))}. Es una estimación: no descuenta gastos pagados de caja que no se hayan registrado como salida.`,
                fecha: c.fechaCierre || c.fechaApertura, monto: diff, responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
            }));
        }
    }

    // ── CAJA ↔ BÓVEDA (lo que sí se registra: Entrega de Turno) ─────────────
    // 2026-10-09 (AUTORIZO Gonzalo): casi no hay ventas del POS, así que la regla de descuadre de
    // arriba no revisaba ninguna caja. Estas reglas cruzan cada caja con su entrega en Bóveda.
    const bov = (datos.bovedaMovs || []).filter(m => m && Number.isFinite(ts(m.fecha)));
    const entregas = bov.filter(m => /^Entrega de Turno:/i.test(String(m.motivo || '')));
    const cajaDeMotivo = (motivo: string) => normCaja(String(motivo).replace(/^[^:]*:\s*/, '').replace(/\s*\([^)]*\)\s*$/, ''));
    let cajasCruzadas = 0;
    const lotes = new Map<string, any[]>(); // cajas abiertas juntas (mismo turno, ≤10 min)
    const turnoMal = new Map<string, any[]>();
    for (const c of datos.sesionesCaja || []) {
        const tAp = ts(c.fechaApertura);
        if (!enRango(tAp, desde, hasta)) continue;
        const nombre = c.cajaNombre || 'Caja';
        const lote = `${c.turno || ''}|${Math.floor(tAp / 600000)}`;
        if (!lotes.has(lote)) lotes.set(lote, []);
        lotes.get(lote)!.push(c);
        if (c.turno && !turnosPosibles(new Date(tAp).getHours()).includes(c.turno)) {
            const k = `${dia(tAp)}|${c.turno}`;
            if (!turnoMal.has(k)) turnoMal.set(k, []);
            turnoMal.get(k)!.push(c);
        }
        if (c.estado !== 'cerrada' || !c.fechaCierre) continue;
        const tCi = ts(c.fechaCierre);
        const mins = (tCi - tAp) / 60000;
        if (Number.isFinite(mins) && mins >= 0 && mins < 15) {
            hall.push(hallazgo({
                id: `caja-corta-${c.id}`, regla: 'caja_abierta_corta', severidad: 'media', categoria: 'caja',
                titulo: `${nombre} estuvo abierta solo ${Math.max(1, Math.round(mins))} min (turno ${c.turno || '—'})`,
                detalle: `Abrió ${new Date(tAp).toLocaleTimeString('es-CO')} y cerró ${new Date(tCi).toLocaleTimeString('es-CO')}. Suele ser una caja abierta por error, en el turno equivocado o cerrada sola al abrir otra.`,
                fecha: c.fechaApertura, responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
            }));
        }
        const suyas = entregas.filter(m => { const t = ts(m.fecha); return cajaDeMotivo(m.motivo) === normCaja(nombre) && t >= tAp && t <= tCi + 60000; });
        // Caja cerrada sin Entrega de Turno = la vendedora no dejó rastro en Bóveda (hueco de control).
        // Las abiertas <15 min ya salen en caja_abierta_corta; aquí solo turnos "reales".
        if (suyas.length === 0) {
            if (Number.isFinite(mins) && mins >= 15) {
                hall.push(hallazgo({
                    id: `sin-entrega-${c.id}`, regla: 'sin_entrega_turno', severidad: 'alta', categoria: 'caja',
                    titulo: `${nombre} cerró sin Entrega de Turno en Bóveda`,
                    detalle: `Cerró el ${new Date(tCi).toLocaleString('es-CO')} (turno ${c.turno || '—'}, cierre ${money(num(c.montoCierre))}) y no hay "Entrega de Turno" en Bóveda para esa caja. Pregunta: ¿la vendedora entregó el efectivo? Si sí, falta registrarlo; si no, el dinero no quedó auditado.`,
                    fecha: c.fechaCierre, monto: num(c.montoCierre), responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
                }));
            }
            continue;
        }
        cajasCruzadas++;
        const cierre = num(c.montoCierre);
        if (suyas.length >= 2) {
            hall.push(hallazgo({
                id: `entrega-dup-${c.id}`, regla: 'entrega_duplicada', severidad: 'alta', categoria: 'caja',
                titulo: `${nombre} se entregó ${suyas.length} veces en el mismo turno`,
                detalle: `Entregas a Bóveda: ${suyas.map(m => `${money(num(m.monto))} (${new Date(ts(m.fecha)).toLocaleTimeString('es-CO')})`).join(', ')}. Solo una debería contar; la Bóveda puede tener plata de más.`,
                fecha: suyas[0].fecha, monto: suyas.slice(1).reduce((s, m) => s + num(m.monto), 0), responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
            }));
        }
        if (!suyas.some(m => Math.abs(num(m.monto) - cierre) < umbralDescuadre)) {
            const entregado = num(suyas[suyas.length - 1].monto);
            hall.push(hallazgo({
                id: `cierre-vs-entrega-${c.id}`, regla: 'cierre_no_cuadra_entrega', severidad: Math.abs(entregado - cierre) >= 100000 ? 'critica' : 'alta', categoria: 'caja',
                titulo: `${nombre}: en caja dice ${money(cierre)} pero se entregó ${money(entregado)}`,
                detalle: `El cierre guardado (${money(cierre)}) no coincide con la Entrega de Turno en Bóveda (${money(entregado)}). Pasa cuando la caja se cerró sola al abrir otro turno y pisó lo contado. Corrige el cierre en el Historial.`,
                fecha: c.fechaCierre, monto: entregado - cierre, responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
            }));
        }
    }
    for (const [k, lista] of turnoMal) {
        const [d, turno] = k.split('|');
        const h = new Date(ts(lista[0].fechaApertura));
        hall.push(hallazgo({
            id: `turno-mal-${k}`, regla: 'turno_no_cuadra', severidad: 'media', categoria: 'caja',
            titulo: `${lista.length} caja(s) abiertas como "${turno}" a las ${h.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} (${d})`,
            detalle: `A esa hora el turno debería ser ${turnosPosibles(h.getHours()).join(' o ') || 'otro'}. Los reportes por turno quedan mezclados.`,
            fecha: lista[0].fechaApertura, responsable: responsableCaja(lista[0]), refs: lista.slice(0, 10).map(c => ({ tipo: 'caja' as const, id: c.id })),
        }));
    }
    for (const [, lista] of lotes) {
        const conBase = lista.filter(c => num(c.montoApertura) > 0);
        if (lista.length >= 3 && conBase.length >= 2) {
            hall.push(hallazgo({
                id: `base-varias-${conBase[0].id}`, regla: 'base_en_varias_cajas', severidad: 'media', categoria: 'caja',
                titulo: `${conBase.length} de ${lista.length} cajas abrieron con base (${money(conBase.reduce((s, c) => s + num(c.montoApertura), 0))})`,
                detalle: `Normalmente solo Caja Principal lleva base. Cajas: ${conBase.map(c => `${c.cajaNombre || 'Caja'} ${money(num(c.montoApertura))}`).join(', ')}.`,
                fecha: conBase[0].fechaApertura, responsable: responsableCaja(conBase[0]), refs: conBase.slice(0, 10).map(c => ({ tipo: 'caja' as const, id: c.id })),
            }));
        }
    }
    for (const m of bov.filter(m => /^Cierre autom/i.test(String(m.motivo || '')) && enRango(ts(m.fecha), desde, hasta))) {
        hall.push(hallazgo({
            id: `cierre-auto-${m.fecha}`, regla: 'cierre_automatico', severidad: 'alta', categoria: 'caja',
            titulo: `Cierre automático en Bóveda por ${money(num(m.monto))}`,
            detalle: `"${m.motivo}". La app cerró una caja sola al abrir otro turno y depositó el monto calculado, no lo contado. Revisa si esa plata ya estaba entregada (doble conteo).`,
            fecha: m.fecha, monto: num(m.monto),
        }));
    }

    // ── VENTAS ──────────────────────────────────────────────────────────────
    const ceros = ventas.filter(v => num(v.total) <= 0);
    if (ceros.length) {
        hall.push(hallazgo({
            id: 'ventas-cero', regla: 'venta_en_cero', severidad: 'media', categoria: 'ventas',
            titulo: `${ceros.length} venta(s) con total en cero o negativo`,
            detalle: 'Una venta sin valor suele ser una anulación sin registrar o un producto regalado.',
            refs: ceros.slice(0, 20).map(v => ({ tipo: 'venta' as const, id: v.id, t: ts(v.fecha) })), responsable: quienVendio(ceros[0]),
        }));
    }

    // duplicadas: misma persona, mismo total y mismos ítems en < 2 min
    const porPersona = new Map<string, any[]>();
    for (const v of ventas) {
        const k = quienVendio(v);
        if (!porPersona.has(k)) porPersona.set(k, []);
        porPersona.get(k)!.push(v);
    }
    const firma = (v: any) => (v.items || []).map((i: any) => `${i.productoId}x${i.cantidad}`).sort().join('|');
    for (const [persona, lista] of porPersona) {
        const orden = [...lista].sort((a, b) => ts(a.fecha) - ts(b.fecha));
        for (let i = 1; i < orden.length; i++) {
            const a = orden[i - 1]; const b = orden[i];
            if (num(a.total) > 0 && num(a.total) === num(b.total) && firma(a) === firma(b) && ts(b.fecha) - ts(a.fecha) < 120000) {
                hall.push(hallazgo({
                    id: `dup-${b.id}`, regla: 'venta_duplicada', severidad: num(b.total) >= 50000 ? 'alta' : 'media', categoria: 'ventas',
                    titulo: `Posible venta duplicada de ${money(num(b.total))}`,
                    detalle: `${persona} registró dos ventas idénticas con menos de 2 minutos de diferencia (${new Date(ts(a.fecha)).toLocaleTimeString('es-CO')} y ${new Date(ts(b.fecha)).toLocaleTimeString('es-CO')}). Puede ser doble clic o cobro repetido.`,
                    fecha: b.fecha, monto: num(b.total), responsable: persona,
                    refs: [{ tipo: 'venta', id: a.id, t: ts(a.fecha) }, { tipo: 'venta', id: b.id, t: ts(b.fecha) }],
                }));
            }
        }
    }

    // fuera de horario (agrupado por día y persona)
    const fuera = new Map<string, any[]>();
    for (const v of ventas) {
        const h = new Date(ts(v.fecha)).getHours();
        if (h < hApertura || h >= hCierre) {
            const k = `${dia(ts(v.fecha))}|${quienVendio(v)}`;
            if (!fuera.has(k)) fuera.set(k, []);
            fuera.get(k)!.push(v);
        }
    }
    for (const [k, lista] of fuera) {
        const [d, persona] = k.split('|');
        hall.push(hallazgo({
            id: `horario-${k}`, regla: 'venta_fuera_horario', severidad: lista.length >= 3 ? 'alta' : 'media', categoria: 'ventas',
            titulo: `${lista.length} venta(s) fuera de horario el ${d}`,
            detalle: `${persona} registró ventas antes de las ${hApertura}:00 o después de las ${hCierre}:00 por ${money(lista.reduce((s, v) => s + num(v.total), 0))}.`,
            fecha: lista[0].fecha, monto: lista.reduce((s, v) => s + num(v.total), 0), responsable: persona,
            refs: lista.slice(0, 20).map(v => ({ tipo: 'venta' as const, id: v.id, t: ts(v.fecha) })),
        }));
    }

    // descuentos
    const descPorPersona = new Map<string, { n: number; monto: number; refs: RefHallazgo[] }>();
    for (const v of ventas) {
        const m = /Descuento aplicado:\s*\$?\s*([\d.,]+)/i.exec(String(v.notas || ''));
        if (!m) continue;
        const monto = montoCO(m[1]);
        const k = quienVendio(v);
        const e = descPorPersona.get(k) || { n: 0, monto: 0, refs: [] };
        e.n++; e.monto += monto; e.refs.push({ tipo: 'venta', id: v.id, t: ts(v.fecha) });
        descPorPersona.set(k, e);
    }
    for (const [persona, e] of descPorPersona) {
        const total = (porPersona.get(persona) || []).length || 1;
        const pct = e.n / total;
        if (e.n >= 3 && (pct >= 0.25 || e.monto >= 30000)) {
            hall.push(hallazgo({
                id: `desc-${persona}`, regla: 'descuentos_frecuentes', severidad: pct >= 0.4 ? 'alta' : 'media', categoria: 'ventas',
                titulo: `${persona} aplicó ${e.n} descuentos (${money(e.monto)})`,
                detalle: `Descuenta en ${Math.round(pct * 100)}% de sus ventas del periodo. Revisa si están autorizados.`,
                monto: e.monto, responsable: persona, refs: e.refs.slice(0, 20),
            }));
        }
    }

    // crédito sin cliente identificado
    const credSin = ventas.filter(v => v.metodoPago === 'credito' && (!String(v.cliente || '').trim() || /an[oó]nimo/i.test(String(v.cliente))));
    if (credSin.length) {
        hall.push(hallazgo({
            id: 'credito-sin-cliente', regla: 'credito_sin_cliente', severidad: 'alta', categoria: 'ventas',
            titulo: `${credSin.length} venta(s) a crédito sin cliente identificado`,
            detalle: `Suman ${money(credSin.reduce((s, v) => s + num(v.total), 0))}. Un fiado sin nombre no se puede cobrar.`,
            monto: credSin.reduce((s, v) => s + num(v.total), 0), responsable: quienVendio(credSin[0]),
            refs: credSin.slice(0, 20).map(v => ({ tipo: 'venta' as const, id: v.id, t: ts(v.fecha) })),
        }));
    }

    // ventas atípicamente grandes
    const totales = ventas.map(v => num(v.total)).filter(t => t > 0);
    if (totales.length >= 20) {
        const media = totales.reduce((a, b) => a + b, 0) / totales.length;
        const sd = Math.sqrt(totales.reduce((a, b) => a + (b - media) ** 2, 0) / totales.length);
        const limite = media + 4 * sd;
        const grandes = ventas.filter(v => num(v.total) > limite && num(v.total) >= 100000);
        for (const v of grandes.slice(0, 5)) {
            hall.push(hallazgo({
                id: `grande-${v.id}`, regla: 'venta_atipica', severidad: 'info', categoria: 'ventas',
                titulo: `Venta inusualmente grande: ${money(num(v.total))}`,
                detalle: `Está muy por encima del promedio (${money(media)}). Confirma que el pago entró.`,
                fecha: v.fecha, monto: num(v.total), responsable: quienVendio(v), refs: [{ tipo: 'venta', id: v.id, t: ts(v.fecha) }],
            }));
        }
    }

    // ── INVENTARIO ──────────────────────────────────────────────────────────
    const nombreProd = (id: string) => (datos.productos || []).find(p => p.id === id)?.nombre || 'Producto';
    const RE_NORMAL = /venta|producci|receta|pedido|despacho|ruta|recepci|compra|orden|mayorista|torta/i;
    const movs = (datos.movimientos || []).filter(m => enRango(ts(m.fecha), desde, hasta));
    const sospechosos = movs.filter(m => (m.tipo === 'ajuste' || m.tipo === 'salida') && !RE_NORMAL.test(String(m.motivo || '')));
    const porUsuarioMov = new Map<string, any[]>();
    for (const m of sospechosos) {
        const k = String(m.usuario || 'Sin nombre');
        if (!porUsuarioMov.has(k)) porUsuarioMov.set(k, []);
        porUsuarioMov.get(k)!.push(m);
    }
    for (const [usuario, lista] of porUsuarioMov) {
        if (lista.length < 3) continue;
        const top = [...lista].sort((a, b) => num(b.cantidad) - num(a.cantidad)).slice(0, 3)
            .map(m => `${nombreProd(m.productoId)} (${m.tipo} ${num(m.cantidad)}${m.motivo ? ' · ' + m.motivo : ''})`).join('; ');
        hall.push(hallazgo({
            id: `ajustes-${usuario}`, regla: 'ajustes_manuales', severidad: lista.length >= 8 ? 'alta' : 'media', categoria: 'inventario',
            titulo: `${lista.length} ajustes/salidas manuales de ${usuario}`,
            detalle: `Salidas o ajustes que no vienen de una venta ni de producción. Mayores: ${top}.`,
            responsable: usuario, refs: lista.slice(0, 20).map(m => ({ tipo: 'movimiento' as const, id: m.id, t: ts(m.fecha) })),
        }));
    }
    for (const it of (datos.inventario || []).filter(i => num(i.stockActual) < 0).slice(0, 10)) {
        hall.push(hallazgo({
            id: `stock-neg-${it.productoId}`, regla: 'stock_negativo', severidad: 'media', categoria: 'inventario',
            titulo: `Stock negativo: ${nombreProd(it.productoId)} (${num(it.stockActual)})`,
            detalle: 'Se vendió o sacó más de lo que había registrado. Falta una entrada o hay un faltante.',
        }));
    }
    // ¿El panadero registró producción? Se detecta por movimientos con motivo de producción/receta.
    const movsProduccion = movs.filter(m => /producci|receta/i.test(String(m.motivo || '')));
    if (ventas.length >= 10 && movsProduccion.length === 0) {
        hall.push(hallazgo({
            id: 'sin-produccion-periodo', regla: 'sin_registro_produccion', severidad: 'info', categoria: 'inventario',
            titulo: 'No hay producción registrada en el sistema este periodo',
            detalle: `Hay ${ventas.length} ventas, pero ningún movimiento de inventario con motivo de producción o receta. Pregunta: ¿el panadero anotó lo que horneó? Sin ese registro no se puede cruzar pan producido vs pan vendido.`,
        }));
    }

    // ── GASTOS ──────────────────────────────────────────────────────────────
    const gastos = (datos.gastos || []).filter(g => enRango(ts(g.fecha), desde, hasta));
    const vivos = gastos.filter(g => g.estado !== 'anulado');
    const clave = (g: any) => `${Math.round(num(g.monto))}|${String(g.descripcion || '').trim().toLowerCase()}`;
    const vistos = new Map<string, any>();
    for (const g of [...vivos].sort((a, b) => ts(a.fecha) - ts(b.fecha))) {
        const k = clave(g);
        const prev = vistos.get(k);
        if (prev && ts(g.fecha) - ts(prev.fecha) < 48 * 3600000 && num(g.monto) > 0) {
            hall.push(hallazgo({
                id: `gasto-dup-${g.id}`, regla: 'gasto_duplicado', severidad: num(g.monto) >= 100000 ? 'alta' : 'media', categoria: 'gastos',
                titulo: `Gasto repetido: ${g.descripcion || 'sin descripción'} por ${money(num(g.monto))}`,
                detalle: 'Mismo monto y descripción registrados dos veces en menos de 48 horas.',
                fecha: g.fecha, monto: num(g.monto), responsable: g.usuarioId, refs: [{ tipo: 'gasto', id: prev.id }, { tipo: 'gasto', id: g.id }],
            }));
        }
        vistos.set(k, g);
    }
    for (const g of vivos.filter(g => num(g.monto) >= umbralGasto && !g.comprobanteUrl && !g.esFactura && g.estado === 'pagado').slice(0, 10)) {
        hall.push(hallazgo({
            id: `gasto-sin-comp-${g.id}`, regla: 'gasto_sin_comprobante', severidad: 'media', categoria: 'gastos',
            titulo: `Gasto de ${money(num(g.monto))} sin comprobante`,
            detalle: `"${g.descripcion || 'Sin descripción'}" pagado sin foto de factura. Desde ${money(umbralGasto)} debería tenerla.`,
            fecha: g.fecha, monto: num(g.monto), responsable: g.usuarioId, refs: [{ tipo: 'gasto', id: g.id }],
        }));
    }
    const anuladosPor = new Map<string, any[]>();
    for (const g of gastos.filter(g => g.estado === 'anulado')) {
        const k = String(g.usuarioId || 'Sin nombre');
        if (!anuladosPor.has(k)) anuladosPor.set(k, []);
        anuladosPor.get(k)!.push(g);
    }
    for (const [u, l] of anuladosPor) {
        if (l.length >= 3) {
            hall.push(hallazgo({
                id: `gasto-anul-${u}`, regla: 'gastos_anulados', severidad: 'media', categoria: 'gastos',
                titulo: `${l.length} gastos anulados por ${u}`,
                detalle: `Suman ${money(l.reduce((s, g) => s + num(g.monto), 0))}. Anular y volver a registrar puede esconder dinero.`,
                monto: l.reduce((s, g) => s + num(g.monto), 0), responsable: u, refs: l.slice(0, 20).map(g => ({ tipo: 'gasto' as const, id: g.id })),
            }));
        }
    }
    for (const g of (datos.gastos || []).filter(g => g.estado === 'pendiente' && ahora - ts(g.fecha) > 30 * 86400000).slice(0, 5)) {
        hall.push(hallazgo({
            id: `gasto-pend-${g.id}`, regla: 'gasto_pendiente_viejo', severidad: 'info', categoria: 'gastos',
            titulo: `Gasto pendiente hace más de 30 días: ${money(num(g.monto))}`,
            detalle: `"${g.descripcion || 'Sin descripción'}" sigue sin pagar.`, fecha: g.fecha, monto: num(g.monto), refs: [{ tipo: 'gasto', id: g.id }],
        }));
    }

    // ── CINTAS ──────────────────────────────────────────────────────────────
    const cintas = (datos.sesionesGrabadas || []).filter(s => s.fin >= desde && s.inicio <= hasta);
    for (const s of cintas) {
        const sens = s.sensibles || [];
        if (sens.length >= 3) {
            hall.push(hallazgo({
                id: `cinta-sens-${s.id}`, regla: 'acciones_sensibles', severidad: sens.length >= 8 ? 'alta' : 'media', categoria: 'cinta',
                titulo: `${sens.length} acciones sensibles en una sesión de ${s.equipo || s.usuario || 'usuario'}`,
                detalle: `Toques como: ${[...new Set(sens.map(a => a.texto))].slice(0, 6).join(' · ')}. Míralas en la cinta.`,
                fecha: new Date(s.inicio).toISOString(), responsable: s.equipo || s.usuario,
                refs: sens.slice(0, 12).map(a => ({ tipo: 'sesion' as const, id: s.id, t: a.t })),
            }));
        }
        if (s.clics > 5) {
            const h = new Date(s.inicio).getHours();
            const hf = new Date(s.fin).getHours();
            if (h < hApertura || hf >= hCierre) {
                hall.push(hallazgo({
                    id: `cinta-noche-${s.id}`, regla: 'actividad_nocturna', severidad: 'media', categoria: 'cinta',
                    titulo: `Actividad en el sistema fuera de horario (${new Date(s.inicio).toLocaleString('es-CO')})`,
                    detalle: `${s.clics} clics de ${s.usuario || 'un usuario'} en ${s.dispositivo || 'un aparato'}.`,
                    fecha: new Date(s.inicio).toISOString(), responsable: s.usuario, refs: [{ tipo: 'sesion', id: s.id, t: s.inicio }],
                }));
            }
        }
        if (s.integridad === 'rota') {
            hall.push(hallazgo({
                id: `cinta-rota-${s.id}`, regla: 'integridad_rota', severidad: 'critica', categoria: 'cinta',
                titulo: 'Una cinta fue alterada',
                detalle: `La huella digital de la cinta del ${new Date(s.inicio).toLocaleString('es-CO')} no coincide con la guardada al grabarla.`,
                fecha: new Date(s.inicio).toISOString(), refs: [{ tipo: 'sesion', id: s.id }],
            }));
        }
    }
    // cobertura: ventas sin cinta
    if (ventas.length > 0) {
        if (cintas.length === 0) {
            hall.push(hallazgo({
                id: 'cinta-ninguna', regla: 'sin_cinta', severidad: 'alta', categoria: 'cinta',
                titulo: 'No hay ninguna cinta en este periodo',
                detalle: `Hay ${ventas.length} ventas pero ninguna sesión grabada. Si la grabación se cayó, no hay prueba de lo que pasó.`,
            }));
        } else {
            const sinCinta = ventas.filter(v => !ventaEnCinta(v.fecha, cintas));
            if (sinCinta.length / ventas.length > 0.2 && sinCinta.length >= 5) {
                hall.push(hallazgo({
                    id: 'cinta-huecos', regla: 'cinta_con_huecos', severidad: 'media', categoria: 'cinta',
                    titulo: `${sinCinta.length} de ${ventas.length} ventas no quedaron grabadas`,
                    detalle: 'Se hicieron cuando ninguna sesión estaba grabando (otro aparato o cinta ya podada).',
                    refs: sinCinta.slice(0, 20).map(v => ({ tipo: 'venta' as const, id: v.id, t: ts(v.fecha) })),
                }));
            }
        }
    }

    // ── VIDEO (cruce con Videovigilancia) ───────────────────────────────────
    const clips = (datos.clips || []).filter(c => enRango(ts(c.capturado_en), desde, hasta));
    hall.push(...hallazgosDeVideo(clips, ventas, datos.sesionesCaja || [], { desde, hasta, ahora }));

    // ── RESUMEN ─────────────────────────────────────────────────────────────
    hall.sort((a, b) => SEVERIDAD_ORDEN.indexOf(a.severidad) - SEVERIDAD_ORDEN.indexOf(b.severidad) || (b.monto ? Math.abs(b.monto) : 0) - (a.monto ? Math.abs(a.monto) : 0));
    // Puntaje por semana: con 30 o 90 días ya no sale rojo solo por sumar muchos días.
    const dias = Math.max(1, Math.round((hasta - desde) / 86400000));
    const score = Math.min(100, Math.round(hall.reduce((s, h) => s + h.puntos, 0) * 7 / Math.max(7, dias)));
    const porSeveridad: Record<Severidad, number> = { critica: 0, alta: 0, media: 0, info: 0 };
    hall.forEach(h => porSeveridad[h.severidad]++);

    const totalVentas = ventas.reduce((s, v) => s + num(v.total), 0);
    const porMetodo = (f: (m: string) => boolean) => ventas.filter(v => f(String(v.metodoPago))).reduce((s, v) => s + num(v.total), 0);
    const pct = (x: number) => (totalVentas > 0 ? Math.round((x / totalVentas) * 100) : 0);

    const personas: PersonaRiesgo[] = [];
    for (const [nombre, lista] of porPersona) {
        const total = lista.reduce((s, v) => s + num(v.total), 0);
        const cred = lista.filter(v => v.metodoPago === 'credito').reduce((s, v) => s + num(v.total), 0);
        const hs = hall.filter(h => h.responsable === nombre);
        const puntos = hs.reduce((s, h) => s + h.puntos, 0);
        personas.push({
            nombre, ventas: lista.length, total, ticketPromedio: lista.length ? total / lista.length : 0,
            descuentos: descPorPersona.get(nombre)?.n || 0, creditoPct: total > 0 ? Math.round((cred / total) * 100) : 0,
            fueraHorario: lista.filter(v => { const h = new Date(ts(v.fecha)).getHours(); return h < hApertura || h >= hCierre; }).length,
            hallazgos: hs.length, puntos, riesgo: Math.min(100, puntos * 2),
        });
    }
    for (const h of hall) { // responsables que no vendieron pero tienen hallazgos
        if (h.responsable && !porPersona.has(h.responsable) && !personas.find(p => p.nombre === h.responsable)) {
            const hs = hall.filter(x => x.responsable === h.responsable);
            const puntos = hs.reduce((s, x) => s + x.puntos, 0);
            personas.push({ nombre: h.responsable, ventas: 0, total: 0, ticketPromedio: 0, descuentos: 0, creditoPct: 0, fueraHorario: 0, hallazgos: hs.length, puntos, riesgo: Math.min(100, puntos * 2) });
        }
    }
    personas.sort((a, b) => b.riesgo - a.riesgo || b.total - a.total);

    return {
        hallazgos: hall, score, nivel: score >= 60 ? 'rojo' : score >= 30 ? 'amarillo' : 'verde',
        kpis: {
            nVentas: ventas.length, totalVentas, ticketPromedio: ventas.length ? totalVentas / ventas.length : 0,
            efectivoPct: pct(porMetodo(m => m === 'efectivo')), digitalPct: pct(porMetodo(m => ['nequi', 'tarjeta', 'transferencia'].includes(m))),
            creditoPct: pct(porMetodo(m => m === 'credito')), descuadreNeto, cajasAuditadas, porSeveridad,
            nClips: clips.length, clipsAlerta: clips.filter(esClipAlerta).length,
            nEntregas: entregas.filter(m => enRango(ts(m.fecha), desde, hasta)).length, cajasCruzadas, sinVentasPOS: ventas.length === 0,
        },
        personas,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cruce Videovigilancia ↔ Auditoría
// ─────────────────────────────────────────────────────────────────────────────
export const esClipAlerta = (c: ClipVideo): boolean =>
    !!c.alerta || (c.categorias_detectadas?.length || 0) > 0 || c.clasificacion === 'malo';

const SEV_CATEGORIA_VIDEO: Record<string, Severidad> = {
    robo: 'critica', devolucion_simulada: 'alta', consumo_no_registrado: 'alta', producto_regalado: 'alta', incumplimiento: 'media',
};
const ETIQUETA_VIDEO: Record<string, string> = {
    robo: 'posible robo', devolucion_simulada: 'posible devolución simulada', consumo_no_registrado: 'consumo sin registrar',
    producto_regalado: 'producto regalado sin autorización', incumplimiento: 'incumplimiento de tareas',
};

/** Ventas hechas cerca (±ventanaMs) de un instante. */
export function ventasCercanas(fechaISO: string, ventas: any[], ventanaMs = 180000): any[] {
    const t = ts(fechaISO);
    if (!Number.isFinite(t)) return [];
    return ventas.filter(v => Math.abs(ts(v.fecha) - t) <= ventanaMs);
}

/** Clip de cámara más cercano a un instante (para "ver el video de esta venta"). */
export function clipCercano(fechaISO: string, clips: ClipVideo[], ventanaMs = 120000): ClipVideo | null {
    const t = ts(fechaISO);
    if (!Number.isFinite(t)) return null;
    let mejor: ClipVideo | null = null; let dMejor = Infinity;
    for (const c of clips) {
        // el clip dura ~10 s desde capturado_en
        const d = Math.abs(ts(c.capturado_en) + 5000 - t);
        if (d <= ventanaMs && d < dMejor) { mejor = c; dMejor = d; }
    }
    return mejor;
}

/** Caja que estaba abierta en un instante (para saber quién era responsable). */
function cajaEn(t: number, cajas: any[]): any | null {
    for (const c of cajas) {
        const a = ts(c.fechaApertura);
        const f = c.fechaCierre ? ts(c.fechaCierre) : Infinity;
        if (Number.isFinite(a) && t >= a && t <= f) return c;
    }
    return null;
}

export function hallazgosDeVideo(
    clips: ClipVideo[], ventas: any[], cajas: any[], ctx: { desde: number; hasta: number; ahora: number },
): Hallazgo[] {
    const out: Hallazgo[] = [];

    // 1. Alertas que detectó la IA al ver el video
    const alertas = clips.filter(esClipAlerta).sort((a, b) => ts(b.capturado_en) - ts(a.capturado_en)).slice(0, 30);
    for (const c of alertas) {
        const cats = (c.categorias_detectadas || []).filter(Boolean);
        const sev: Severidad = cats.length
            ? (['critica', 'alta', 'media', 'info'] as Severidad[]).find(s => cats.some(k => SEV_CATEGORIA_VIDEO[k] === s)) || 'media'
            : 'media';
        const t = ts(c.capturado_en);
        const cerca = ventasCercanas(c.capturado_en, ventas);
        const caja = cajaEn(t, cajas);
        const resp = caja ? (responsableCaja(caja)) : undefined;
        const queVio = cats.length ? cats.map(k => ETIQUETA_VIDEO[k] || k).join(', ') : 'comportamiento clasificado como malo';
        const cruce = cerca.length === 0
            ? 'En esos minutos NO hay ninguna venta registrada.'
            : `En esos minutos hay ${cerca.length} venta(s) registradas (${cerca.slice(0, 3).map(v => money(num(v.total))).join(', ')}).`;
        out.push(hallazgo({
            id: `video-${c.id}`, regla: 'video_alerta', severidad: sev, categoria: 'video',
            titulo: `Cámara ${c.camara_nombre || ''}: ${queVio}`.trim(),
            detalle: `${c.descripcion_ia || 'Sin descripción.'} ${cruce} La IA puede equivocarse: confirma viendo el video.`,
            fecha: c.capturado_en, responsable: resp,
            refs: [{ tipo: 'clip', id: c.id, t }, ...cerca.slice(0, 3).map(v => ({ tipo: 'venta' as const, id: v.id, t: ts(v.fecha) }))],
        }));
    }

    // 2. Cajas abiertas sin video (la grabación no estaba encendida)
    if (clips.length > 0) {
        for (const c of cajas) {
            const a = ts(c.fechaApertura);
            const f = c.fechaCierre ? ts(c.fechaCierre) : ctx.ahora;
            if (!Number.isFinite(a) || a < ctx.desde || a > ctx.hasta) continue;
            if (f - a < 2 * 3600000) continue;
            const dentro = clips.filter(k => { const tk = ts(k.capturado_en); return tk >= a && tk <= f; }).length;
            if (dentro === 0) {
                out.push(hallazgo({
                    id: `video-hueco-${c.id}`, regla: 'video_sin_cobertura', severidad: 'media', categoria: 'video',
                    titulo: `Caja abierta ${Math.round((f - a) / 3600000)} h sin video`,
                    detalle: `${c.cajaNombre || 'Caja'} trabajó de ${new Date(a).toLocaleString('es-CO')} a ${c.fechaCierre ? new Date(f).toLocaleString('es-CO') : 'ahora'} y la Bitácora Visual no grabó nada. Si fuera necesario, no habría video que lo respalde.`,
                    fecha: c.fechaApertura, responsable: responsableCaja(c), refs: [{ tipo: 'caja', id: c.id }],
                }));
            }
        }
    } else if (cajas.some(c => { const a = ts(c.fechaApertura); return a >= ctx.desde && a <= ctx.hasta; })) {
        out.push(hallazgo({
            id: 'video-ninguno', regla: 'video_sin_cobertura', severidad: 'info', categoria: 'video',
            titulo: 'No hay video de cámaras en este periodo',
            detalle: 'Se trabajó con caja pero la Bitácora Visual no tiene clips. Activa «Grabación» en Videovigilancia para que la auditoría pueda cruzar ventas con video.',
        }));
    }
    return out;
}

/** Resumen de ventas/cajas del día, para que Videovigilancia lo cruce con lo que vio en cámara. */
export function resumenOperativoDia(ventas: any[], cajas: any[], fecha: Date = new Date()): string {
    const d = dia(fecha.getTime());
    const vs = ventas.filter(v => dia(ts(v.fecha)) === d);
    const total = vs.reduce((s, v) => s + num(v.total), 0);
    const porPers = new Map<string, number>();
    vs.forEach(v => porPers.set(quienVendio(v), (porPers.get(quienVendio(v)) || 0) + 1));
    const cs = cajas.filter(c => dia(ts(c.fechaApertura)) === d);
    const l = [`VENTAS DEL DÍA (sistema): ${vs.length} por ${money(total)}.`];
    if (porPers.size) l.push(`Por persona: ${[...porPers].map(([n, c]) => `${n} ${c}`).join(', ')}.`);
    l.push(`Cajas hoy: ${cs.length}${cs.length ? ' (' + cs.map(c => `${c.cajaNombre || 'caja'} ${c.estado}`).join(', ') + ')' : ''}.`);
    l.push('Cruza esto con los clips: si en video se ve gente cobrando o entregando producto y casi no hay ventas, o al revés, menciónalo como punto a verificar (sin acusar).');
    return l.join('\n');
}

/** ¿Qué cinta estaba grabando cuando se hizo esta venta, y en qué momento (ms desde el inicio)? */
export function ventaEnCinta(fechaISO: string, sesiones: SesionMeta[]): { sesionId: string; offsetMs: number } | null {
    const t = ts(fechaISO);
    if (!Number.isFinite(t)) return null;
    for (const s of sesiones) {
        if (t >= s.inicio - 60000 && t <= s.fin + 60000) return { sesionId: s.id, offsetMs: Math.max(0, t - s.inicio) };
    }
    return null;
}

/** Texto compacto para la IA (sin datos que no estén en la auditoría). */
export function contextoParaIA(r: ResultadoAuditoria, op: OpcionesAuditoria, sesiones: SesionMeta[], maxChars = 7000): string {
    const k = r.kpis;
    const l: string[] = [];
    l.push(`PERIODO: ${op.desde} a ${op.hasta}`);
    l.push(`RIESGO: ${r.score}/100 (${r.nivel}). Hallazgos: ${k.porSeveridad.critica} críticos, ${k.porSeveridad.alta} altos, ${k.porSeveridad.media} medios, ${k.porSeveridad.info} informativos.`);
    l.push(`VENTAS: ${k.nVentas} por ${money(k.totalVentas)}; ticket promedio ${money(k.ticketPromedio)}; efectivo ${k.efectivoPct}%, digital ${k.digitalPct}%, crédito ${k.creditoPct}%.`);
    l.push(`CAJAS AUDITADAS: ${k.cajasAuditadas}; descuadre neto estimado ${money(k.descuadreNeto)}.`);
    l.push(`BÓVEDA: ${k.nEntregas} entregas de turno; ${k.cajasCruzadas} cajas cruzadas con su entrega.${k.sinVentasPOS ? ' No hay ventas del POS en el periodo: lo de caja sale de cierres y Bóveda.' : ''}`);
    l.push(`CINTAS: ${sesiones.length} sesiones grabadas, ${sesiones.reduce((s, x) => s + (x.sensibles?.length || 0), 0)} acciones sensibles.`);
    l.push(`VIDEO (cámaras): ${k.nClips} clips analizados en el periodo, ${k.clipsAlerta} con alerta de la IA.`);
    l.push('PERSONAS (riesgo 0-100):');
    r.personas.slice(0, 8).forEach(p => l.push(`- ${p.nombre}: riesgo ${p.riesgo}, ${p.ventas} ventas (${money(p.total)}), ${p.descuentos} descuentos, crédito ${p.creditoPct}%, fuera de horario ${p.fueraHorario}, hallazgos ${p.hallazgos}`));
    l.push('HALLAZGOS:');
    for (const h of r.hallazgos.slice(0, 40)) {
        const linea = `- [${h.severidad.toUpperCase()}/${h.categoria}] ${h.titulo}${h.responsable ? ` (resp: ${h.responsable})` : ''}: ${h.detalle}`;
        if (l.join('\n').length + linea.length > maxChars) break;
        l.push(linea);
    }
    return l.join('\n');
}

/**
 * Guion de un video (cinta de pantalla o micro-video) para que la IA lo explique.
 * La IA NO ve los píxeles: recibe lo que la grabadora anotó (módulos, botones tocados, valores escritos)
 * y los hallazgos de ese rato. Así no inventa lo que no quedó registrado.
 */
export function guionVideo(
    s: SesionMeta, desde: number, hasta: number,
    extra: { eventos?: any[] | null; hallazgos?: Hallazgo[] } = {},
): string {
    const hora = (t: number) => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const l: string[] = [];
    const quien = s.equipo || s.usuario || 'usuario sin nombre';
    l.push(`VIDEO: pantalla de la app en ${s.dispositivo || 'un aparato'}, ${quien}${s.turno ? `, turno ${s.turno}` : ''}${s.rol ? ` (rol ${s.rol})` : ''}.`);
    l.push(`TRAMO: ${new Date(desde).toLocaleDateString('es-CO')} de ${hora(desde)} a ${hora(hasta)} (${Math.max(1, Math.round((hasta - desde) / 1000))} s).`);
    const mods = (s.modulos || []).filter(m => m.entra <= hasta && (m.sale ?? s.fin) >= desde);
    if (mods.length) l.push(`MÓDULOS: ${mods.map(m => `${m.vista}${m.critico ? ' (crítico)' : ''} ${hora(m.entra)}→${hora(m.sale ?? s.fin)}`).join('; ')}.`);
    const acc = (s.acciones || []).filter(a => a.t >= desde && a.t <= hasta);
    const sens = new Set((s.sensibles || []).map(a => `${a.t}|${a.texto}`));
    l.push(`ACCIONES (${acc.length}):`);
    acc.slice(0, 120).forEach(a => l.push(`- ${hora(a.t)} ${sens.has(`${a.t}|${a.texto}`) ? '⚠ ' : ''}${a.texto}`));
    if (acc.length === 0) l.push('- (no se tocó ningún botón en este tramo)');
    const ev = (extra.eventos || []).filter((e: any) => e?.timestamp >= desde && e?.timestamp <= hasta);
    if (ev.length) {
        const ultimos = new Map<number, { t: number; texto: string }>();
        let clics = 0;
        for (const e of ev) {
            if (e.type !== 3 || !e.data) continue;
            if (e.data.source === 2 && e.data.type === 2) clics++;
            if (e.data.source === 5 && typeof e.data.text === 'string') ultimos.set(e.data.id, { t: e.timestamp, texto: e.data.text });
        }
        const escritos = [...ultimos.values()].filter(x => x.texto.trim()).sort((a, b) => a.t - b.t).slice(0, 30);
        l.push(`CLICS: ${clics}. CAMPOS LLENADOS: ${escritos.length}${escritos.length ? ' → ' + escritos.map(x => `${hora(x.t)} «${x.texto.slice(0, 40)}»`).join(', ') : ''}. (Los campos con **** son claves/PIN ocultos a propósito.)`);
    }
    const hs = (extra.hallazgos || []).filter(h => { const t = h.fecha ? new Date(h.fecha).getTime() : NaN; return Number.isFinite(t) && t >= desde - 30 * 60000 && t <= hasta + 30 * 60000; });
    if (hs.length) {
        l.push('HALLAZGOS DE AUDITORÍA CERCA DE ESE MOMENTO:');
        hs.slice(0, 10).forEach(h => l.push(`- [${h.severidad}] ${h.titulo}: ${h.detalle}`));
    }
    return l.join('\n');
}

/** Instrucción para que la IA explique un video. */
export function promptExplicarVideo(tipo: 'cinta' | 'momento' | 'camara'): string {
    const que = tipo === 'camara' ? 'este video de la cámara' : tipo === 'momento' ? 'este micro-video de la pantalla' : 'esta cinta de la pantalla';
    return `Explícame ${que} para la dueña de la panadería. Usa SOLO los datos del guion; si algo no quedó registrado, dilo en vez de suponerlo. Formato, corto y claro:
1. **Qué pasó**: paso a paso, con la hora de cada cosa importante.
2. **Qué está pasando**: en qué quedó (qué se guardó, qué quedó abierto, qué no se hizo y debería).
3. **Qué puede pasar**: riesgos o consecuencias (plata, inventario, turnos) y qué revisar primero.
4. **Veredicto**: normal / revisar / grave, en una línea.
No acuses a nadie sin prueba; habla de hechos.`;
}

export function resumenWhatsApp(r: ResultadoAuditoria, op: OpcionesAuditoria): string {
    const k = r.kpis;
    const icono = r.nivel === 'rojo' ? '🔴' : r.nivel === 'amarillo' ? '🟡' : '🟢';
    const l = [
        `🛡️ *AUDITORÍA DULCE PLACER* ${op.desde} → ${op.hasta}`,
        `${icono} Riesgo ${r.score}/100 · ${k.porSeveridad.critica} críticos, ${k.porSeveridad.alta} altos, ${k.porSeveridad.media} medios`,
        `Ventas ${money(k.totalVentas)} (${k.nVentas}) · Descuadre neto ${money(k.descuadreNeto)}`,
    ];
    r.hallazgos.filter(h => h.severidad === 'critica' || h.severidad === 'alta').slice(0, 6).forEach(h => l.push(`• ${h.titulo}`));
    return l.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Nombres legibles de cintas + resumen de evento (JSON descargable)
// ─────────────────────────────────────────────────────────────────────────────

/** Detecta el tipo de evento dominante en una cinta (para el nombre que ve Gonzalo). */
export function tipoEventoCinta(s: Pick<SesionMeta, 'momentos' | 'acciones' | 'sensibles' | 'modulos'>): string {
    const textos = [
        ...(s.momentos || []).map(m => m.motivo),
        ...(s.sensibles || []).map(a => a.texto),
        ...(s.acciones || []).map(a => a.texto),
        ...(s.modulos || []).map(m => m.vista),
    ].join(' | ').toLowerCase();
    if (/cerrar caja|cierre de caja|entrega de turno/.test(textos)) return 'CierreCaja';
    if (/producci|receta|horno|panadero/.test(textos)) return 'Produccion';
    if (/boveda|entrega/.test(textos)) return 'Boveda';
    if (/anular|descuento|cr[eé]dito|fiado/.test(textos)) return 'AccionSensible';
    if ((s.modulos || []).some(m => m.critico || /caja|ventas|boveda/.test(m.vista))) return 'Operacion';
    return 'Sesion';
}

/** Título humano: "Cinta · CierreCaja · 18 oct, 14:31 · Tarde · María y Jessica". */
export function nombreLegibleCinta(
    s: Pick<SesionMeta, 'inicio' | 'turno' | 'equipo' | 'usuario' | 'momentos' | 'acciones' | 'sensibles' | 'modulos'> & { esActual?: boolean },
): string {
    const cuando = new Date(s.inicio).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const quien = s.equipo || s.usuario || 'Sin responsable';
    const turno = s.turno ? ` · ${s.turno}` : '';
    const vivo = s.esActual ? ' · EN VIVO' : '';
    return `Cinta · ${tipoEventoCinta(s)} · ${cuando}${turno} · ${quien}${vivo}`;
}

/**
 * Separa la sesión de quien entró (usuario + rol) del turno de caja.
 * Las cintas viejas no traen sello en cada clic: ahí no se puede afirmar de quién fue.
 */
export function certezaDeCinta(s: Pick<SesionMeta, 'usuario' | 'rol' | 'acciones' | 'sensibles'>): {
    sellada: boolean;
    nombres: string[];
    roles: string[];
    frase: string;
} {
    const marcas = [...(s.sensibles || []), ...(s.acciones || [])].filter(a => a.usuario || a.rol);
    const nombres = [...new Set(marcas.map(a => a.usuario).filter((x): x is string => !!x))];
    const roles = [...new Set(marcas.map(a => a.rol).filter((x): x is string => !!x))];
    if (marcas.length === 0) {
        return {
            sellada: false,
            nombres,
            roles,
            frase: 'Esta cinta es anterior al sello. No guarda quién hizo cada clic. El nombre puede ser el turno de caja, no la persona que entró. Con eso no se puede asegurar que una acción sensible fue de esa persona y no de gerencia o administración.',
        };
    }
    if (nombres.length === 1 && roles.length <= 1) {
        const rol = roles[0] || s.rol || 'sin rol';
        if (rol === 'ADMIN' || rol === 'GERENTE') {
            return {
                sellada: true,
                nombres,
                roles,
                frase: `Cada clic quedó sellado en la sesión de ${nombres[0]}, rol ${rol}. Esa sesión es de gerencia o administración.`,
            };
        }
        return {
            sellada: true,
            nombres,
            roles,
            frase: `Cada clic quedó sellado en la sesión de ${nombres[0]}, rol ${rol}. En estos clics no entró gerencia ni administración.`,
        };
    }
    const altos = roles.filter(r => r === 'ADMIN' || r === 'GERENTE');
    const caja = roles.filter(r => r !== 'ADMIN' && r !== 'GERENTE');
    const mezcla = altos.length > 0 && caja.length > 0 ? ' Hay clics de caja y clics de gerencia o administración.' : '';
    return {
        sellada: true,
        nombres,
        roles,
        frase: `En esta cinta hay más de una persona: ${nombres.join(', ')} (${roles.join(', ') || 'sin rol'}). Mira el sello de cada acción.${mezcla}`,
    };
}

/** Etiquetas cortas para badges (Cierre, Producción, Sensible…). */
export function etiquetasCinta(s: Pick<SesionMeta, 'momentos' | 'acciones' | 'sensibles' | 'modulos' | 'nube' | 'sinCinta' | 'integridad'>): string[] {
    const tags: string[] = [];
    const tipo = tipoEventoCinta(s);
    if (tipo === 'CierreCaja') tags.push('Cierre');
    if (tipo === 'Produccion') tags.push('Producción');
    if (tipo === 'Boveda') tags.push('Bóveda');
    if (tipo === 'AccionSensible' || (s.sensibles?.length || 0) > 0) tags.push('Sensible');
    if (s.nube) tags.push('Nube');
    if (s.sinCinta) tags.push('Solo resumen');
    if (s.integridad === 'ok') tags.push('Íntegra');
    if (s.integridad === 'rota') tags.push('Alterada');
    return tags;
}

/**
 * Resumen JSON de un evento de auditoría (cierre de caja / producción).
 * No es la cinta rrweb completa: es un archivo legible para Gonzalo (descarga / archivo).
 * Formato de nombre sugerido: AUD-{Tipo}-{YYYYMMDD}-{HHmm}-{Quien}.json
 */
export function construirResumenEventoAuditoria(input: {
    tipo: 'CierreCaja' | 'Produccion' | 'Boveda' | 'Otro';
    cuando: number | string;
    responsable?: string;
    turno?: string;
    equipo?: string;
    cajaNombre?: string;
    montoCierre?: number;
    detalle?: string;
    refs?: { tipo: string; id: string }[];
    sesionId?: string;
}): { nombreArchivo: string; payload: Record<string, unknown> } {
    const t = typeof input.cuando === 'number' ? input.cuando : new Date(input.cuando).getTime();
    const d = new Date(Number.isFinite(t) ? t : Date.now());
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const hm = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const quien = (input.equipo || input.responsable || 'SinNombre').replace(/[^\wáéíóúñÁÉÍÓÚÑ y-]/gi, '').trim().replace(/\s+/g, '_') || 'SinNombre';
    const nombreArchivo = `AUD-${input.tipo}-${ymd}-${hm}-${quien}.json`;
    const payload = {
        version: 1,
        tipo: input.tipo,
        titulo: `Auditoría · ${input.tipo} · ${d.toLocaleString('es-CO')}`,
        descripcion: input.detalle
            || (input.tipo === 'CierreCaja'
                ? `Cierre de caja ${input.cajaNombre || ''} por ${quien}. ¿Quedó registrada la Entrega de Turno?`
                : input.tipo === 'Produccion'
                    ? `Registro de producción por ${quien}. ¿El panadero anotó lo horneado en el sistema?`
                    : `Evento de auditoría ${input.tipo}`),
        cuando: d.toISOString(),
        responsable: input.responsable || null,
        turno: input.turno || null,
        equipo: input.equipo || null,
        cajaNombre: input.cajaNombre || null,
        montoCierre: input.montoCierre ?? null,
        sesionCintaId: input.sesionId || null,
        refs: input.refs || [],
    };
    return { nombreArchivo, payload };
}

// ─────────────────────────────────────────────────────────────────────────────
// Huella digital (cadena de hashes) — detecta cintas alteradas
// ─────────────────────────────────────────────────────────────────────────────
export async function hashTexto(texto: string): Promise<string> {
    try {
        const subtle = (globalThis as any).crypto?.subtle;
        if (subtle) {
            const buf = await subtle.digest('SHA-256', new TextEncoder().encode(texto));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch { /* cae al respaldo */ }
    // Respaldo (FNV-1a 32 bits ×2) cuando el aparato no tiene SubtleCrypto
    let h1 = 0x811c9dc5; let h2 = 0x01000193;
    for (let i = 0; i < texto.length; i++) {
        const c = texto.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    }
    return `f${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function encadenar(prev: string, chunk: any[]): Promise<string> {
    return hashTexto(`${prev}|${JSON.stringify(chunk)}`);
}

/** Recalcula la cadena de una cinta y la compara con la que se guardó al grabar. */
export async function verificarCadena(meta: Pick<SesionMeta, 'semilla' | 'chunks' | 'hashFinal'>, eventos: any[]): Promise<{ ok: boolean; chunksOk: number; total: number }> {
    let prev = meta.semilla || 'génesis';
    let pos = 0; let chunksOk = 0;
    for (const c of meta.chunks) {
        const h = await encadenar(prev, eventos.slice(pos, pos + c.n));
        if (h !== c.hash) return { ok: false, chunksOk, total: meta.chunks.length };
        prev = h; pos += c.n; chunksOk++;
    }
    return { ok: pos === eventos.length && (!meta.hashFinal || meta.hashFinal === prev), chunksOk, total: meta.chunks.length };
}
