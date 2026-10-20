/**
 * Alertas de Videovigilancia al celular del dueño + "modo estación" (PC del local que vigila sin parar).
 *
 * WhatsApp: se usa CallMeBot (gratis). Se activa una sola vez mandando "I allow callmebot to send me messages"
 * al +34 644 51 95 23 y guardando la clave que responde. No hay confirmación de entrega (el navegador no la permite).
 */
const KEY_CFG = 'dp_alertas_vigilancia_v1';
const KEY_ESTACION = 'dp_estacion_vigilancia_v1';

export interface ConfigAlertas {
    whatsapp: string;       // con indicativo, ej. 573001234567
    apikey: string;         // clave de CallMeBot
    navegador: boolean;     // notificación del navegador + sonido
    soloCriticas: boolean;  // true = solo robo/devolución simulada/regalo/consumo
}

export const CONFIG_ALERTAS_DEFAULT: ConfigAlertas = { whatsapp: '', apikey: '', navegador: true, soloCriticas: true };

export function cargarConfigAlertas(): ConfigAlertas {
    try {
        const raw = localStorage.getItem(KEY_CFG);
        if (!raw) return { ...CONFIG_ALERTAS_DEFAULT };
        return { ...CONFIG_ALERTAS_DEFAULT, ...JSON.parse(raw) };
    } catch { return { ...CONFIG_ALERTAS_DEFAULT }; }
}

export function guardarConfigAlertas(c: ConfigAlertas) {
    try { localStorage.setItem(KEY_CFG, JSON.stringify(c)); } catch { /* sin almacenamiento */ }
}

export const estacionActiva = (): boolean => {
    try { return localStorage.getItem(KEY_ESTACION) === '1'; } catch { return false; }
};

export function setEstacionActiva(v: boolean) {
    try { localStorage.setItem(KEY_ESTACION, v ? '1' : '0'); } catch { /* sin almacenamiento */ }
    try { window.dispatchEvent(new Event('dp-estacion')); } catch { /* sin window */ }
}

const CRITICAS = ['robo', 'devolucion_simulada', 'producto_regalado', 'consumo_no_registrado'];
export const esCategoriaCritica = (cats: string[] = []): boolean => cats.some(c => CRITICAS.includes(c));

/** Deja solo dígitos; CallMeBot los quiere con "+". */
export const normalizarTelefono = (t: string): string => String(t || '').replace(/\D/g, '');

export function urlCallMeBot(cfg: Pick<ConfigAlertas, 'whatsapp' | 'apikey'>, texto: string): string | null {
    const tel = normalizarTelefono(cfg.whatsapp);
    if (tel.length < 10 || !cfg.apikey.trim()) return null;
    return `https://api.callmebot.com/whatsapp.php?phone=%2B${tel}&text=${encodeURIComponent(texto.slice(0, 900))}&apikey=${encodeURIComponent(cfg.apikey.trim())}`;
}

/** Anti-spam: la misma clave no vuelve a avisar antes de `ventanaMs`. */
export function pasaAntiSpam(ultimos: Map<string, number>, clave: string, ahora: number, ventanaMs = 5 * 60 * 1000): boolean {
    const u = ultimos.get(clave);
    if (u !== undefined && ahora - u < ventanaMs) return false;
    ultimos.set(clave, ahora);
    return true;
}

const ultimos = new Map<string, number>();

function sonar() {
    try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.15;
        o.start(); o.stop(ctx.currentTime + 0.5);
    } catch { /* sin audio */ }
}

export interface AlertaVigilancia { clave: string; titulo: string; detalle: string; critica: boolean }

export async function notificarAlertaVigilancia(
    a: AlertaVigilancia, cfg: ConfigAlertas = cargarConfigAlertas(), ahora = Date.now(),
): Promise<{ navegador: boolean; whatsapp: boolean; omitida?: boolean }> {
    const res = { navegador: false, whatsapp: false };
    if (cfg.soloCriticas && !a.critica) return { ...res, omitida: true };
    if (!pasaAntiSpam(ultimos, a.clave, ahora)) return { ...res, omitida: true };

    if (cfg.navegador && typeof Notification !== 'undefined') {
        try {
            if (Notification.permission === 'default') await Notification.requestPermission();
            if (Notification.permission === 'granted') {
                new Notification(`🚨 ${a.titulo}`, { body: a.detalle.slice(0, 200), tag: a.clave, requireInteraction: true });
                res.navegador = true;
            }
        } catch { /* sin notificaciones */ }
        sonar();
    }

    const url = urlCallMeBot(cfg, `🚨 DULCE PLACER · ${a.titulo}\n${a.detalle}\n${new Date(ahora).toLocaleString('es-CO')}`);
    if (url) {
        try { await fetch(url, { mode: 'no-cors' }); res.whatsapp = true; } catch { /* sin red */ }
    }
    return res;
}

/** Evita que la pantalla se apague en la estación de vigilancia. */
export async function mantenerPantallaEncendida(): Promise<() => void> {
    try {
        const nav: any = navigator;
        if (!nav.wakeLock?.request) return () => {};
        let lock: any = await nav.wakeLock.request('screen');
        const volver = async () => {
            if (document.visibilityState === 'visible') { try { lock = await nav.wakeLock.request('screen'); } catch { /* denegado */ } }
        };
        document.addEventListener('visibilitychange', volver);
        return () => { document.removeEventListener('visibilitychange', volver); try { lock?.release?.(); } catch { /* ya liberado */ } };
    } catch { return () => {}; }
}
