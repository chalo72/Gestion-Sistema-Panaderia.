/**
 * Pedidos de Tortas — lógica pura (sin React) + almacenamiento local/nube.
 * Un pedido lo toma la vendedora y lo ve la repostera en el tablero (comanda).
 */
import { mezclarPorId } from '@/lib/rutas-reparto';

export type EstadoPedido = 'pendiente' | 'en_preparacion' | 'lista' | 'entregada' | 'cancelada';

export interface AdicionalPedido {
    id: string;
    productoId?: string; // enlace con el catálogo (vacío si es un adicional libre)
    nombre: string;
    cantidad: number;
    precio: number;
}

export interface EventoPedido { estado: EstadoPedido; por: string; en: number }

export interface PedidoTorta {
    id: string;
    cliente: string;
    telefono: string;
    fechaEntrega: string; // YYYY-MM-DD
    horaEntrega: string;  // HH:mm o ''
    sabor: string;
    porciones: string;
    diseno: string;       // modelo / descripción del diseño
    dedicatoria: string;  // texto que va escrito en la torta
    notas: string;
    precioBase: number;
    abono: number;
    adicionales: AdicionalPedido[];
    fotos: string[];      // data URLs comprimidas (modelo de referencia)
    estado: EstadoPedido;
    responsable: string;  // repostera
    creadoPor: string;    // quién tomó el pedido
    creadoEn: number;
    actualizadoEn: number;
    historial: EventoPedido[];
    /** Plata ya registrada en caja (el resto de `abono` está pendiente de registrar). */
    registradoCaja?: number;
    /** Los adicionales del catálogo ya se descontaron del inventario. */
    stockDescontado?: boolean;
}

export type MetodoCobroTorta = 'efectivo' | 'nequi' | 'transferencia' | 'tarjeta';

/** Plata recibida que todavía no está en caja. */
export const pendienteCaja = (p: Pick<PedidoTorta, 'abono' | 'registradoCaja'>): number =>
    Math.max(0, (Number(p.abono) || 0) - (Number(p.registradoCaja) || 0));

/** Lo que falta por recibir para entregar: saldo + lo recibido antes que no está en caja. */
export const aCobrarEnEntrega = (p: PedidoTorta): number => saldoPedido(p) + pendienteCaja(p);

/** Cobro en caja como una línea de servicio (no toca inventario). */
export function ventaCobroPedido(p: PedidoTorta, monto: number, metodoPago: MetodoCobroTorta, usuarioId: string, vendedoraNombre?: string, fecha?: string) {
    const concepto = `Pedido de torta · ${p.cliente}${p.sabor ? ' · ' + p.sabor : ''}`;
    return {
        items: [{ id: `cobro-${p.id}-${Date.now()}`, productoId: `servicio:pedido-torta:${p.id}`, cantidad: 1, precioUnitario: monto, subtotal: monto }],
        total: monto,
        metodoPago,
        usuarioId,
        vendedoraNombre,
        cliente: p.cliente,
        notas: `${concepto}${fecha ? ' · entrega ' + fecha : ''}`,
    };
}

/** Salidas de inventario de los adicionales que vienen del catálogo. */
export function ajustesStockPedido(p: PedidoTorta) {
    return p.adicionales.filter(a => a.productoId && a.cantidad > 0).map(a => ({
        productoId: a.productoId as string, cantidad: a.cantidad, tipo: 'salida' as const, motivo: `Pedido de torta: ${p.cliente}`,
    }));
}

export const ESTADOS_ACTIVOS: EstadoPedido[] = ['pendiente', 'en_preparacion', 'lista'];

export const ESTADO_INFO: Record<EstadoPedido, { label: string; siguiente?: EstadoPedido; accion?: string }> = {
    pendiente:      { label: 'Por hacer',        siguiente: 'en_preparacion', accion: 'Empezar' },
    en_preparacion: { label: 'En preparación',   siguiente: 'lista',          accion: 'Marcar lista' },
    lista:          { label: 'Lista para entregar', siguiente: 'entregada',   accion: 'Entregada' },
    entregada:      { label: 'Entregada' },
    cancelada:      { label: 'Cancelada' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fechas
// ─────────────────────────────────────────────────────────────────────────────
export function fechaLocal(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aUTC(f: string): number {
    const [y, m, d] = (f || '').split('-').map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
}

/** Días desde `hoy` hasta la fecha (negativo = ya pasó). NaN si no hay fecha. */
export function diasHasta(fecha: string, hoy: string = fechaLocal()): number {
    return Math.round((aUTC(fecha) - aUTC(hoy)) / 86400000);
}

export function fechaBonita(fecha: string): string {
    const t = aUTC(fecha);
    if (isNaN(t)) return 'Sin fecha';
    const d = new Date(t);
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function horaBonita(h: string): string {
    const m = /^(\d{1,2}):(\d{2})$/.exec(h || '');
    if (!m) return '';
    const hh = Number(m[1]);
    return `${hh % 12 === 0 ? 12 : hh % 12}:${m[2]} ${hh >= 12 ? 'pm' : 'am'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Urgencia / orden / totales
// ─────────────────────────────────────────────────────────────────────────────
export type NivelUrgencia = 'cerrada' | 'atrasada' | 'hoy' | 'manana' | 'semana' | 'normal';

export function nivelUrgencia(p: PedidoTorta, hoy: string = fechaLocal()): NivelUrgencia {
    if (!ESTADOS_ACTIVOS.includes(p.estado)) return 'cerrada';
    const d = diasHasta(p.fechaEntrega, hoy);
    if (isNaN(d)) return 'normal';
    if (d < 0) return 'atrasada';
    if (d === 0) return 'hoy';
    if (d === 1) return 'manana';
    if (d <= 7) return 'semana';
    return 'normal';
}

export function etiquetaUrgencia(p: PedidoTorta, hoy: string = fechaLocal()): string {
    const n = nivelUrgencia(p, hoy);
    const d = diasHasta(p.fechaEntrega, hoy);
    if (n === 'atrasada') return `ATRASADA ${Math.abs(d)} d`;
    if (n === 'hoy') return 'HOY';
    if (n === 'manana') return 'MAÑANA';
    if (n === 'semana') return `en ${d} días`;
    if (n === 'normal' && !isNaN(d)) return `en ${d} días`;
    return '';
}

export function ordenarPedidos(lista: PedidoTorta[]): PedidoTorta[] {
    return [...lista].sort((a, b) =>
        (a.fechaEntrega || '9999').localeCompare(b.fechaEntrega || '9999')
        || (a.horaEntrega || '99:99').localeCompare(b.horaEntrega || '99:99')
        || a.creadoEn - b.creadoEn);
}

export const totalAdicionales = (p: Pick<PedidoTorta, 'adicionales'>): number =>
    p.adicionales.reduce((s, a) => s + (Number(a.precio) || 0) * (Number(a.cantidad) || 0), 0);

export const totalPedido = (p: Pick<PedidoTorta, 'adicionales' | 'precioBase'>): number =>
    (Number(p.precioBase) || 0) + totalAdicionales(p);

export const saldoPedido = (p: Pick<PedidoTorta, 'adicionales' | 'precioBase' | 'abono'>): number =>
    Math.max(0, totalPedido(p) - (Number(p.abono) || 0));

export interface Recordatorios { atrasadas: PedidoTorta[]; hoy: PedidoTorta[]; manana: PedidoTorta[] }

export function recordatorios(lista: PedidoTorta[], hoy: string = fechaLocal()): Recordatorios {
    const r: Recordatorios = { atrasadas: [], hoy: [], manana: [] };
    for (const p of ordenarPedidos(lista)) {
        const n = nivelUrgencia(p, hoy);
        if (n === 'atrasada') r.atrasadas.push(p);
        else if (n === 'hoy') r.hoy.push(p);
        else if (n === 'manana') r.manana.push(p);
    }
    return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creación / cambio de estado
// ─────────────────────────────────────────────────────────────────────────────
export function nuevoPedido(por: string, id: string, ahora: number = Date.now()): PedidoTorta {
    return {
        id, cliente: '', telefono: '', fechaEntrega: '', horaEntrega: '', sabor: '', porciones: '',
        diseno: '', dedicatoria: '', notas: '', precioBase: 0, abono: 0, adicionales: [], fotos: [],
        estado: 'pendiente', responsable: '', creadoPor: por, creadoEn: ahora, actualizadoEn: ahora,
        historial: [{ estado: 'pendiente', por, en: ahora }],
    };
}

export function cambiarEstado(p: PedidoTorta, estado: EstadoPedido, por: string, ahora: number = Date.now()): PedidoTorta {
    if (p.estado === estado) return p;
    return { ...p, estado, actualizadoEn: ahora, historial: [...(p.historial || []), { estado, por, en: ahora }] };
}

/** Validación mínima antes de guardar. Devuelve el mensaje de error o null. */
export function validarPedido(p: PedidoTorta): string | null {
    if (!p.cliente.trim()) return 'Falta el nombre del cliente';
    if (!p.fechaEntrega) return 'Falta la fecha de entrega';
    if (!p.sabor.trim() && !p.diseno.trim()) return 'Escribe el sabor o el diseño de la torta';
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo (enlace con Productos)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductoRef { id: string; nombre: string; categoria?: string; precioVenta?: number; tipo?: string; imagen?: string }

const RE_PINATERIA = /pi[ñn]ater|pi[ñn]ata|fiesta|decoraci|globo|vejiga|topper/i;

export function esPinateria(p: ProductoRef): boolean {
    return RE_PINATERIA.test(`${p.categoria || ''}`);
}

/** Productos ofrecibles como adicional. Solo Piñatería por defecto; `todo` = catálogo completo vendible. */
export function opcionesCatalogo(productos: ProductoRef[], busqueda: string, todo: boolean): ProductoRef[] {
    const q = busqueda.trim().toLowerCase();
    return productos
        .filter(p => p.tipo !== 'ingrediente' && (Number(p.precioVenta) || 0) > 0)
        .filter(p => todo || esPinateria(p))
        .filter(p => !q || `${p.nombre} ${p.categoria || ''}`.toLowerCase().includes(q))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function agregarAdicional(lista: AdicionalPedido[], a: Omit<AdicionalPedido, 'cantidad' | 'id'> & { id?: string }): AdicionalPedido[] {
    const idx = a.productoId ? lista.findIndex(x => x.productoId === a.productoId) : -1;
    if (idx >= 0) return lista.map((x, i) => (i === idx ? { ...x, cantidad: x.cantidad + 1 } : x));
    return [...lista, { id: a.id || `ad-${Date.now()}-${lista.length}`, productoId: a.productoId, nombre: a.nombre, precio: a.precio, cantidad: 1 }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto para WhatsApp y comanda impresa
// ─────────────────────────────────────────────────────────────────────────────
type Fmt = (n: number) => string;

export function textoPedido(p: PedidoTorta, fmt: Fmt): string {
    const l: string[] = [];
    l.push(`🎂 *PEDIDO DE TORTA* — ${fechaBonita(p.fechaEntrega)}${p.horaEntrega ? ' ' + horaBonita(p.horaEntrega) : ''}`);
    l.push(`Cliente: ${p.cliente}${p.telefono ? ' · ' + p.telefono : ''}`);
    l.push(`Torta: ${[p.sabor, p.porciones ? p.porciones + ' porciones' : ''].filter(Boolean).join(' · ')}`);
    if (p.diseno) l.push(`Diseño: ${p.diseno}`);
    if (p.dedicatoria) l.push(`Dice: "${p.dedicatoria}"`);
    if (p.adicionales.length) l.push(`Adicionales: ${p.adicionales.map(a => `${a.cantidad}x ${a.nombre}`).join(', ')}`);
    if (p.notas) l.push(`Notas: ${p.notas}`);
    l.push(`Total ${fmt(totalPedido(p))} · Abono ${fmt(p.abono)} · Saldo ${fmt(saldoPedido(p))}`);
    if (p.responsable) l.push(`Repostera: ${p.responsable}`);
    return l.join('\n');
}

export function enlaceWhatsApp(texto: string, telefono?: string): string {
    let tel = (telefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = '57' + tel; // celular colombiano
    return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

const esc = (s: string) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function htmlComanda(p: PedidoTorta, fmt: Fmt): string {
    const filas = p.adicionales.map(a => `<tr><td>${a.cantidad}x ${esc(a.nombre)}</td><td class="r">${fmt(a.precio * a.cantidad)}</td></tr>`).join('');
    const fotos = p.fotos.slice(0, 2).map(f => `<img src="${f}" />`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Comanda torta</title>
<style>
 @page{size:80mm auto;margin:3mm}
 body{font-family:Arial,sans-serif;width:74mm;font-size:12px;color:#000}
 h1{font-size:15px;margin:0 0 4px;text-align:center}
 .f{font-size:20px;font-weight:900;text-align:center;border:2px solid #000;padding:4px;margin:6px 0}
 .b{font-weight:700} hr{border:0;border-top:1px dashed #000;margin:6px 0}
 table{width:100%;border-collapse:collapse} .r{text-align:right}
 .ded{font-size:15px;font-weight:900;border:1px solid #000;padding:4px;margin:4px 0;text-align:center}
 img{width:100%;margin-top:4px}
</style></head><body>
<h1>🎂 COMANDA · TORTA</h1>
<div class="f">${esc(fechaBonita(p.fechaEntrega))}${p.horaEntrega ? ' · ' + esc(horaBonita(p.horaEntrega)) : ''}</div>
<div class="b">${esc(p.cliente)}${p.telefono ? ' · ' + esc(p.telefono) : ''}</div>
<hr>
<div><span class="b">Sabor:</span> ${esc(p.sabor) || '—'}</div>
<div><span class="b">Porciones:</span> ${esc(p.porciones) || '—'}</div>
${p.diseno ? `<div><span class="b">Diseño:</span> ${esc(p.diseno)}</div>` : ''}
${p.dedicatoria ? `<div class="ded">"${esc(p.dedicatoria)}"</div>` : ''}
${p.notas ? `<div><span class="b">Notas:</span> ${esc(p.notas)}</div>` : ''}
${filas ? `<hr><div class="b">Adicionales</div><table>${filas}</table>` : ''}
<hr>
<table>
 <tr><td>Total</td><td class="r b">${fmt(totalPedido(p))}</td></tr>
 <tr><td>Abono</td><td class="r">${fmt(p.abono)}</td></tr>
 <tr><td class="b">Saldo a cobrar</td><td class="r b">${fmt(saldoPedido(p))}</td></tr>
</table>
${p.responsable ? `<div>Repostera: ${esc(p.responsable)}</div>` : ''}
<div style="font-size:10px">Tomó: ${esc(p.creadoPor)}</div>
${fotos}
</body></html>`;
}

/** Imprime la comanda en un iframe oculto (sin ventanas emergentes). */
export function imprimirComanda(p: PedidoTorta, fmt: Fmt): void {
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow!.document;
    doc.open(); doc.write(htmlComanda(p, fmt)); doc.close();
    const imprimir = () => {
        try { ifr.contentWindow!.focus(); ifr.contentWindow!.print(); } finally {
            setTimeout(() => ifr.remove(), 2000);
        }
    };
    // espera a que carguen las fotos
    setTimeout(imprimir, p.fotos.length ? 400 : 50);
}

/** Comparte por WhatsApp con la foto si el dispositivo lo permite; si no, abre wa.me con el texto. */
export async function compartirPedido(p: PedidoTorta, fmt: Fmt, telefono?: string): Promise<'archivo' | 'enlace'> {
    const texto = textoPedido(p, fmt);
    try {
        const nav: any = navigator;
        if (p.fotos.length && nav.share && nav.canShare) {
            const files: File[] = [];
            for (let i = 0; i < p.fotos.length; i++) {
                const blob = await (await fetch(p.fotos[i])).blob();
                files.push(new File([blob], `modelo-${i + 1}.jpg`, { type: 'image/jpeg' }));
            }
            if (nav.canShare({ files })) {
                await nav.share({ files, text: texto, title: 'Pedido de torta' });
                return 'archivo';
            }
        }
    } catch { /* cancelado o sin soporte → enlace */ }
    window.open(enlaceWhatsApp(texto, telefono), '_blank');
    return 'enlace';
}

// ─────────────────────────────────────────────────────────────────────────────
// Fotos
// ─────────────────────────────────────────────────────────────────────────────
export function comprimirImagen(file: File, max = 1000, calidad = 0.65): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error('No se pudo leer la foto'));
        fr.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Foto no válida'));
            img.onload = () => {
                const k = Math.min(1, max / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * k);
                c.height = Math.round(img.height * k);
                c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', calidad));
            };
            img.src = String(fr.result);
        };
        fr.readAsDataURL(file);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Almacenamiento (local + nube)
// ─────────────────────────────────────────────────────────────────────────────
const LS_PEDIDOS = 'dp_pedidos_tortas';
const CLOUD_PEDIDOS = 'pedidos_tortas';
const LS_AVISADOS = 'dp_tortas_avisados';

export interface DbRespaldo {
    getBackup(key: string): Promise<any>;
    saveBackup(key: string, val: any): Promise<void>;
}

export function cargarPedidosLocal(): PedidoTorta[] {
    try {
        const v = JSON.parse(localStorage.getItem(LS_PEDIDOS) || '[]');
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

export async function cargarPedidosDesdeNube(dbx: DbRespaldo): Promise<PedidoTorta[]> {
    let lista = cargarPedidosLocal();
    try {
        const c = await dbx.getBackup(CLOUD_PEDIDOS);
        if (Array.isArray(c)) lista = mezclarPorId(lista, c);
    } catch { /* sin nube */ }
    try { localStorage.setItem(LS_PEDIDOS, JSON.stringify(lista)); } catch { /* lleno */ }
    return lista;
}

export function guardarPedidos(dbx: DbRespaldo | null, lista: PedidoTorta[]) {
    try { localStorage.setItem(LS_PEDIDOS, JSON.stringify(lista)); } catch { /* lleno */ }
    if (dbx && lista.length > 0) dbx.saveBackup(CLOUD_PEDIDOS, lista).catch(() => {});
}

/** Avisos del navegador: un solo aviso por pedido y por día. */
export function yaAvisado(id: string, hoy: string = fechaLocal()): boolean {
    try { return (JSON.parse(localStorage.getItem(LS_AVISADOS) || '{}') as Record<string, string>)[id] === hoy; } catch { return false; }
}
export function marcarAvisado(id: string, hoy: string = fechaLocal()) {
    try {
        const m = JSON.parse(localStorage.getItem(LS_AVISADOS) || '{}') as Record<string, string>;
        m[id] = hoy;
        for (const k of Object.keys(m)) if (m[k] !== hoy) delete m[k];
        localStorage.setItem(LS_AVISADOS, JSON.stringify(m));
    } catch { /* nada */ }
}
