/**
 * CCTV Digital — grabadora de sesiones (rrweb).
 *
 * Qué cambió (2026-10-09):
 *  - Los guardados van en cola (antes el temporizador y el umbral de 300 eventos se pisaban y se perdían tramos).
 *  - Se graba un "checkpoint" completo cada 5 min, para que cualquier tramo se pueda reproducir solo.
 *  - Cada cinta lleva un resumen (quién, qué turno, clics, acciones sensibles) y una huella digital encadenada.
 *  - La nube ya no es Firestore (en producción nunca estuvo configurado): se usa la misma nube del resto de la app,
 *    con la cinta comprimida y recortada para que quepa.
 */
import * as rrweb from 'rrweb';
import localforage from 'localforage';
import { dbNube } from '@/lib/nube-kv';
import { supabase } from '@/lib/supabase';
import { leerEquipoLocal, nombreResponsable } from '@/lib/equipo-turno';
import { RE_SENSIBLE, encadenar, verificarCadena, type SesionMeta } from '@/lib/auditoria-profunda';

localforage.config({ name: 'PanaderiaDulcePlacer', storeName: 'auditoria_caja' });

const CHECKOUT_MS = 5 * 60 * 1000;
const FLUSH_MS = 30 * 1000;
const NUBE_CADA_MS = 2 * 60 * 1000;
const MAX_SESIONES_LOCALES = 10;
const MAX_METAS = 60;
const SLOTS_NUBE = 5;
const KEY_IDX = 'idx_sesiones';
const KEY_IDX_NUBE = 'auditoria_indice'; // índice viejo (solo lectura de cintas anteriores)
const BUCKET_CINTAS = 'auditoria-cintas';  // 2026-10-09: cada cinta = carpeta con tramos comprimidos
const TABLA_CINTAS = 'auditoria_cintas';   // índice por filas (ya no un JSON entero que se pisa)
let subidoHasta = 0;  // eventos de la cinta actual ya subidos a la nube
let partesSubidas = 0;
let subiendo = false;

let stopFn: (() => void) | null = null;
let buffer: any[] = [];
let sessionId = '';
let meta: SesionMeta | null = null;
let cola: Promise<void> = Promise.resolve();
let timer: ReturnType<typeof setInterval> | null = null;
let ultimaNube = 0;
let usuarioActual: { id?: string; nombre?: string; rol?: string } = {};
let vistaActual = '';

/**
 * Módulos donde se mueve plata, inventario o permisos (2026-10-09, AUTORIZO Gonzalo).
 * Al entrar se toma una foto completa de la pantalla (así el micro-video arranca limpio) y cada
 * acción ahí dentro queda como "momento crítico" (~30 s de cinta para ver qué hizo y qué no).
 */
export const MODULOS_CRITICOS = new Set([
    'ventas', 'caja', 'boveda', 'gastos', 'inventario', 'creditos', 'fiados-empleados', 'nomina', 'precios',
    'cargamasiva', 'control-merma', 'recepciones', 'configuracion', 'usuarios', 'roles', 'seguridad', 'historial-ventas',
]);
const MOMENTO_MIN_MS = 20_000; // no repetir momentos del mismo módulo en menos de 20 s

/** ¿La grabadora está corriendo de verdad en este aparato? */
export const grabadoraActiva = (): boolean => !!stopFn;

function marcarMomento(motivo: string, forzar = false) {
    if (!meta) return;
    const ahora = Date.now();
    meta.momentos = meta.momentos || [];
    const ult = meta.momentos[meta.momentos.length - 1];
    if (!forzar && ult && ult.vista === vistaActual && ahora - ult.t < MOMENTO_MIN_MS) return;
    meta.momentos.push({ t: ahora, motivo: motivo.slice(0, 80), vista: vistaActual || undefined });
    if (meta.momentos.length > 300) meta.momentos.splice(0, meta.momentos.length - 300);
}

function cambiarVista(vista: string, ahora: number) {
    if (!meta) return;
    meta.modulos = meta.modulos || [];
    const abierta = meta.modulos[meta.modulos.length - 1];
    if (abierta && abierta.vista === vista && !abierta.sale) return;
    if (abierta && !abierta.sale) abierta.sale = ahora;
    const critico = MODULOS_CRITICOS.has(vista);
    meta.modulos.push({ vista, entra: ahora, critico });
    if (meta.modulos.length > 200) meta.modulos.splice(0, meta.modulos.length - 200);
    vistaActual = vista;
    if (critico) {
        try { (rrweb as any).record.takeFullSnapshot?.(true); } catch { /* sin grabadora */ }
        marcarMomento(`Entró a ${vista}`, true);
    }
}

function mismaPersona(
    a: { id?: string; nombre?: string; rol?: string },
    b: { id?: string; nombre?: string; rol?: string },
) {
    return (a.id || '') === (b.id || '') && (a.rol || '') === (b.rol || '') && (a.nombre || '') === (b.nombre || '');
}

export function setAuditoriaUsuario(u: { id?: string; nombre?: string; rol?: string } | null) {
    const next = u || {};
    const antes = usuarioActual;
    const cambio = !mismaPersona(antes, next);
    const habiaAlguien = !!(antes.id || antes.nombre);
    usuarioActual = next;
    if (!meta) return;
    // Si entra otra persona, se cierra la cinta anterior. Así los clics de Erika no quedan con el nombre de gerencia.
    if (cambio && habiaAlguien && stopFn) {
        meta.usuario = antes.nombre || antes.id || meta.usuario;
        meta.rol = antes.rol || meta.rol;
        meta.usuarioId = antes.id;
        void guardarSesion(true).finally(() => {
            stopAuditoriaSession();
            startAuditoriaSession();
        });
        return;
    }
    meta.usuario = next.nombre || next.id || meta.usuario;
    meta.rol = next.rol || meta.rol;
    meta.usuarioId = next.id;
}

function dispositivo(): string {
    try {
        const ua = navigator.userAgent;
        const movil = /Android|iPhone|iPad/i.test(ua);
        const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Navegador';
        return `${movil ? 'Celular' : 'PC'} · ${nav}`;
    } catch { return 'Aparato'; }
}

function refrescarContexto() {
    if (!meta) return;
    try {
        const e = leerEquipoLocal();
        if (e) { meta.turno = e.turno; meta.equipo = nombreResponsable(e); }
    } catch { /* sin equipo */ }
}

/** Anota una acción legible en la cinta (clic en un botón, cambio de vista…). */
export function registrarAccionAuditoria(texto: string, vista = false) {
    if (!meta || !stopFn) return;
    const t = (texto || '').trim().slice(0, 80);
    if (!t) return;
    const ult = meta.acciones[meta.acciones.length - 1];
    if (ult && ult.texto === t && Date.now() - ult.t < 1000) return;
    const ahora = Date.now();
    const sello = {
        t: ahora,
        texto: t,
        usuario: usuarioActual.nombre || usuarioActual.id,
        rol: usuarioActual.rol,
        usuarioId: usuarioActual.id,
    };
    meta.acciones.push(sello);
    if (meta.acciones.length > 400) meta.acciones.splice(0, meta.acciones.length - 400);
    if (vista && !meta.vistas.includes(t)) meta.vistas.push(t);
    if (vista && t.startsWith('Vista: ')) cambiarVista(t.slice(7).trim(), ahora);
    const sensible = RE_SENSIBLE.test(t);
    if (sensible) {
        meta.sensibles.push({ ...sello });
        if (meta.sensibles.length > 200) meta.sensibles.shift();
        marcarMomento(`⚠ ${t}`, true);
    } else if (!vista && MODULOS_CRITICOS.has(vistaActual)) {
        marcarMomento(t);
    }
    try { (rrweb as any).record.addCustomEvent('accion', { texto: t, sensible, vista }); } catch { /* sin grabadora */ }
}

function alHacerClic(e: MouseEvent) {
    const el = (e.target as HTMLElement | null)?.closest?.('button, a, [role="button"], [role="tab"], [role="menuitem"], label, input[type="submit"]') as HTMLElement | null;
    if (!el) return;
    const txt = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt) registrarAccionAuditoria(txt);
}

const RE_CAMPO_SENSIBLE = /pin|clave|contrase|password|tarjeta|cvv|c[eé]dula|documento|token|secret/i;
function esCampoSensible(el: HTMLElement | null): boolean {
    try {
        if (!el) return false;
        const i = el as HTMLInputElement;
        if ((i.type || '').toLowerCase() === 'password') return true;
        const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
        if (ac.includes('one-time-code') || ac.startsWith('cc-') || ac.includes('password')) return true;
        const pistas = [el.getAttribute('name'), el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('data-sensible')].filter(Boolean).join(' ');
        return RE_CAMPO_SENSIBLE.test(pistas);
    } catch { return false; }
}

function contar(ev: any) {
    if (!meta) return;
    if (ev.type === 3 && ev.data) {
        if (ev.data.source === 2 && ev.data.type === 2) meta.clics++;
        else if (ev.data.source === 5) meta.entradas++;
    }
}

export function startAuditoriaSession() {
    if (stopFn || typeof window === 'undefined') return;
    const inicio = Date.now();
    sessionId = `sesion_${inicio}`;
    buffer = [];
    meta = {
        id: sessionId, inicio, fin: inicio, usuario: usuarioActual.nombre || usuarioActual.id, rol: usuarioActual.rol, usuarioId: usuarioActual.id,
        dispositivo: dispositivo(), eventos: 0, clics: 0, entradas: 0, vistas: [], sensibles: [], acciones: [], chunks: [],
        modulos: [], momentos: [],
    };
    vistaActual = '';
    subidoHasta = 0;
    partesSubidas = 0;
    refrescarContexto();

    stopFn = rrweb.record({
        emit(event: any) {
            buffer.push(event);
            contar(event);
            if (buffer.length >= 300) void guardarSesion();
        },
        checkoutEveryNms: CHECKOUT_MS,
        maskAllInputs: false,
        // Se revisa cada campo: los montos y cantidades se ven (sirven para auditar);
        // contraseñas, PIN, claves, tarjetas y cédulas se guardan como ****.
        maskInputOptions: { input: true, textarea: true, password: true } as any,
        maskInputFn: (texto: string, el: HTMLElement) => (esCampoSensible(el) ? '*'.repeat(Math.min(8, (texto || '').length)) : texto),
        sampling: { mousemove: 150, scroll: 200, input: 'last' },
    } as any) || null;

    document.addEventListener('click', alHacerClic, true);
    timer = setInterval(() => { void guardarSesion(); }, FLUSH_MS);
    const cierre = () => { void guardarSesion(true); };
    window.addEventListener('pagehide', cierre);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cierre(); });
}

export function stopAuditoriaSession() {
    try { stopFn?.(); } catch { /* ya parada */ }
    stopFn = null;
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('click', alHacerClic, true);
}

export function guardarSesion(forzarNube = false): Promise<void> {
    cola = cola.then(() => _guardar(forzarNube)).catch(e => { console.warn('[Auditoría] guardado falló:', e); });
    return cola;
}
/** Compatibilidad con el nombre anterior. */
export const saveCurrentSession = guardarSesion;

async function leerIndiceLocal(): Promise<SesionMeta[]> {
    try { return ((await localforage.getItem<SesionMeta[]>(KEY_IDX)) || []).filter(Boolean); } catch { return []; }
}

async function _guardar(forzarNube: boolean) {
    if (!meta) return;
    if (buffer.length > 0) {
        const chunk = buffer; buffer = [];
        const previos = ((await localforage.getItem<any[]>(sessionId)) || []);
        const todo = previos.concat(chunk);
        await localforage.setItem(sessionId, todo);

        if (meta.chunks.length === 0 && !meta.semilla) {
            const idx = await leerIndiceLocal();
            const anterior = idx.filter(m => m.id !== sessionId).sort((a, b) => b.inicio - a.inicio)[0];
            meta.semilla = anterior?.hashFinal || 'génesis';
        }
        const prev = meta.chunks.length ? meta.chunks[meta.chunks.length - 1].hash : (meta.semilla || 'génesis');
        const h = await encadenar(prev, chunk);
        meta.chunks.push({ n: chunk.length, hash: h });
        meta.hashFinal = h;
        meta.eventos = todo.length;
    }
    meta.fin = Date.now();
    refrescarContexto();

    // índice local (resumen de cada cinta)
    const idx = (await leerIndiceLocal()).filter(m => m.id !== meta!.id);
    idx.push({ ...meta });
    idx.sort((a, b) => b.inicio - a.inicio);
    await localforage.setItem(KEY_IDX, idx.slice(0, MAX_METAS));

    await podarLocal();

    if (forzarNube || Date.now() - ultimaNube >= NUBE_CADA_MS) {
        ultimaNube = Date.now();
        void subirNube().catch(() => {});
    }
}

async function podarLocal() {
    const keys = (await localforage.keys()).filter(k => k.startsWith('sesion_')).sort();
    if (keys.length <= MAX_SESIONES_LOCALES) return;
    const borrar = keys.slice(0, keys.length - MAX_SESIONES_LOCALES);
    for (const k of borrar) await localforage.removeItem(k);
    const idx = await leerIndiceLocal();
    await localforage.setItem(KEY_IDX, idx.map(m => (borrar.includes(m.id) ? { ...m, sinCinta: true } : m)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Nube
// ─────────────────────────────────────────────────────────────────────────────
function b64ABytes(s: string): Uint8Array {
    const bin = atob(s);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
}

async function descomprimir(b64: string): Promise<string> {
    const DS = (globalThis as any).DecompressionStream;
    const stream = new Blob([b64ABytes(b64) as BlobPart]).stream().pipeThrough(new DS('gzip'));
    return new Response(stream).text();
}

async function comprimirBytes(texto: string): Promise<Uint8Array | null> {
    const CS = (globalThis as any).CompressionStream;
    if (!CS) return null;
    const stream = new Blob([texto]).stream().pipeThrough(new CS('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Sube a la nube SOLO lo nuevo de la cinta (un tramo comprimido por vez) y actualiza su fila en el índice.
 * Antes: 5 casillas en `configuracion` que se pisaban al azar y reescribían cientos de KB cada 2 min.
 */
async function subirNube() {
    if (!meta || subiendo) return;
    subiendo = true;
    const m = meta;
    try {
        const eventos = (await localforage.getItem<any[]>(m.id)) || [];
        if (eventos.length > subidoHasta) {
            const nuevos = eventos.slice(subidoHasta);
            const texto = JSON.stringify(nuevos);
            const gz = await comprimirBytes(texto);
            const n = String(partesSubidas).padStart(4, '0');
            const ruta = gz ? `${m.id}/${n}.json.gz` : `${m.id}/${n}.json`;
            const cuerpo = gz ? new Blob([gz as BlobPart], { type: 'application/gzip' }) : new Blob([texto], { type: 'application/json' });
            const { error } = await supabase.storage.from(BUCKET_CINTAS).upload(ruta, cuerpo, { contentType: cuerpo.type, upsert: true });
            if (!error) { partesSubidas++; subidoHasta = eventos.length; }
            else console.warn('[Auditoría] no se pudo subir el tramo:', error.message);
        }
        const liviano: SesionMeta = {
            ...m, acciones: m.acciones.slice(-150), sensibles: m.sensibles.slice(-80),
            modulos: (m.modulos || []).slice(-120), momentos: (m.momentos || []).slice(-150), nube: true,
        };
        await supabase.from(TABLA_CINTAS).upsert({
            id: m.id, inicio: new Date(m.inicio).toISOString(), fin: new Date(m.fin).toISOString(),
            usuario: m.usuario || null, turno: m.turno || null, equipo: m.equipo || null, dispositivo: m.dispositivo || null,
            partes: partesSubidas, eventos: subidoHasta, meta: liviano, actualizado_en: new Date().toISOString(),
        });
    } catch (e) {
        console.warn('[Auditoría] subida a la nube falló:', e);
    } finally {
        subiendo = false;
    }
}

/** Baja una cinta de la nube juntando sus tramos en orden. */
async function eventosDesdeNube(id: string): Promise<any[] | null> {
    try {
        const { data: archivos, error } = await supabase.storage.from(BUCKET_CINTAS).list(id, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
        if (error || !archivos || archivos.length === 0) return null;
        const todos: any[] = [];
        for (const f of [...archivos].sort((x, y) => x.name.localeCompare(y.name))) {
            const { data: blob } = await supabase.storage.from(BUCKET_CINTAS).download(`${id}/${f.name}`);
            if (!blob) continue;
            let texto: string;
            if (f.name.endsWith('.gz')) {
                const DS = (globalThis as any).DecompressionStream;
                texto = await new Response(blob.stream().pipeThrough(new DS('gzip'))).text();
            } else texto = await blob.text();
            const parte = JSON.parse(texto);
            if (Array.isArray(parte)) todos.push(...parte);
        }
        return todos.length ? todos : null;
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura
// ─────────────────────────────────────────────────────────────────────────────
export interface SesionListada extends SesionMeta { date: Date; isCloud?: boolean; esActual?: boolean }

export async function getAuditoriaSessions(): Promise<SesionListada[]> {
    const mapa = new Map<string, SesionListada>();
    const claves = new Set((await localforage.keys()).filter(k => k.startsWith('sesion_')));

    for (const m of await leerIndiceLocal()) {
        mapa.set(m.id, { ...m, sinCinta: !claves.has(m.id), date: new Date(m.inicio), isCloud: false });
    }
    // cintas viejas (de antes del resumen): se listan con datos mínimos
    for (const k of claves) {
        if (mapa.has(k)) continue;
        const t = parseInt(k.split('_')[1]) || Date.now();
        mapa.set(k, { id: k, inicio: t, fin: t, eventos: 0, clics: 0, entradas: 0, vistas: [], sensibles: [], acciones: [], chunks: [], date: new Date(t), isCloud: false });
    }
    if (meta && !mapa.has(meta.id)) mapa.set(meta.id, { ...meta, date: new Date(meta.inicio) });
    // índice en la nube por filas (todas las cintas de todos los aparatos)
    try {
        const { data } = await supabase.from(TABLA_CINTAS).select('id, partes, meta').order('inicio', { ascending: false }).limit(300);
        for (const fila of (data || []) as any[]) {
            const m = fila.meta as SesionMeta;
            if (!m?.id) continue;
            const ya = mapa.get(m.id);
            if (ya) { ya.isCloud = true; if (ya.sinCinta && fila.partes > 0) ya.sinCinta = false; continue; }
            mapa.set(m.id, { ...m, sinCinta: !(fila.partes > 0), date: new Date(m.inicio), isCloud: true });
        }
    } catch { /* sin nube */ }
    // índice viejo (cintas de antes del 9 oct)
    try {
        const r = await dbNube.getBackup(KEY_IDX_NUBE);
        if (Array.isArray(r)) for (const m of r as SesionMeta[]) {
            if (!m?.id) continue;
            const ya = mapa.get(m.id);
            if (ya) { ya.isCloud = true; continue; }
            mapa.set(m.id, { ...m, sinCinta: true, date: new Date(m.inicio), isCloud: true });
        }
    } catch { /* sin nube */ }

    return [...mapa.values()]
        .map(s => ({ ...s, esActual: s.id === sessionId && !!stopFn }))
        .sort((a, b) => b.inicio - a.inicio);
}

export async function getSessionEvents(id: string): Promise<any[] | null> {
    try {
        const local = await localforage.getItem<any[]>(id);
        if (Array.isArray(local) && local.length > 0) return local;
    } catch { /* sigue con la nube */ }
    // la cinta viva aún no guardada
    if (id === sessionId && buffer.length > 0) return [...buffer];
    const nube = await eventosDesdeNube(id);
    if (nube) return nube;
    // casillas viejas (cintas de antes del 9 oct)
    for (let slot = 0; slot < SLOTS_NUBE; slot++) {
        try {
            const r = await dbNube.getBackup(`auditoria_cinta_${slot}`);
            const c = Array.isArray(r) ? r[0] : null;
            if (c?.id === id && c.gz) return JSON.parse(await descomprimir(c.gz));
        } catch { /* siguiente casilla */ }
    }
    return null;
}

/** Recalcula la huella de una cinta y la compara con la que se guardó al grabar. */
export async function verificarIntegridadSesion(id: string): Promise<'ok' | 'rota' | 'sin_verificar'> {
    const idx = await leerIndiceLocal();
    const m = idx.find(x => x.id === id);
    if (!m || m.chunks.length === 0) return 'sin_verificar';
    const eventos = await localforage.getItem<any[]>(id);
    if (!Array.isArray(eventos)) return 'sin_verificar';
    const r = await verificarCadena(m, eventos);
    return r.ok ? 'ok' : 'rota';
}

/** Borra los datos de una cinta (solo local). */
export async function borrarCintaLocal(id: string) {
    await localforage.removeItem(id);
}
