import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import {
    Video, Play, AlertTriangle, ShieldCheck, ShieldAlert, Clock, RefreshCw, Bot, Send, MessageCircle, Users, FileSearch,
    Fingerprint, Sparkles, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    getAuditoriaSessions, getSessionEvents, verificarIntegridadSesion, guardarSesion, grabadoraActiva, MODULOS_CRITICOS, type SesionListada,
} from '@/lib/auditoria-rrweb';
import { getMovimientosBoveda } from '@/lib/boveda-store';
import {
    ejecutarAuditoria, ventaEnCinta, contextoParaIA, resumenWhatsApp, clipCercano, guionVideo, promptExplicarVideo, ventasCercanas, certezaDeCinta,
    type Hallazgo, type Severidad, type RefHallazgo, type ClipVideo,
} from '@/lib/auditoria-profunda';
import { clipsEnRango, urlFirmadaClip } from '@/lib/bitacora-visual';
import { consultarAgente } from '@/constants/agentes';

interface Props {
    ventas?: any[];
    sesionesCaja?: any[];
    gastos?: any[];
    movimientos?: any[];
    productos?: any[];
    inventario?: any[];
}

type Tab = 'hallazgos' | 'cintas' | 'personas' | 'ia';
type Periodo = 1 | 7 | 30 | 90;

const SEV_CLS: Record<Severidad, string> = {
    critica: 'bg-red-600 text-white',
    alta: 'bg-orange-500 text-white',
    media: 'bg-amber-300 text-amber-950',
    info: 'bg-slate-200 text-slate-700',
};
const SEV_LABEL: Record<Severidad, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', info: 'Info' };
const CAT_LABEL: Record<string, string> = { caja: 'Caja', ventas: 'Ventas', inventario: 'Inventario', gastos: 'Gastos', cinta: 'Cinta', video: 'Cámaras' };

const fechaCorta = (d: Date) => d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const duracion = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function CCTVDigital({ ventas = [], sesionesCaja = [], gastos = [], movimientos = [], productos = [], inventario = [] }: Props) {
    const [tab, setTab] = useState<Tab>('hallazgos');
    const [periodo, setPeriodo] = useState<Periodo>(7);
    const [sesiones, setSesiones] = useState<SesionListada[]>([]);
    const [integridad, setIntegridad] = useState<Record<string, 'ok' | 'rota' | 'sin_verificar'>>({});
    const [filtroSev, setFiltroSev] = useState<Severidad | 'todas'>('todas');
    const [sesionActiva, setSesionActiva] = useState<string | null>(null);
    const [eventos, setEventos] = useState<any[] | null>(null);
    const [cargando, setCargando] = useState(false);
    const [saltar, setSaltar] = useState<{ ms: number; n: number; pausarEnMs?: number } | null>(null);
    const [grabando, setGrabando] = useState<boolean>(() => grabadoraActiva());
    useEffect(() => { const t = setInterval(() => setGrabando(grabadoraActiva()), 10000); return () => clearInterval(t); }, []);

    const [clips, setClips] = useState<ClipVideo[]>([]);
    const [videoUrl, setVideoUrl] = useState<{ url: string; titulo: string; clip?: ClipVideo } | null>(null);
    // Explicación de un video por la IA (cinta, micro-video o cámara)
    const [explicacion, setExplicacion] = useState<{ titulo: string; texto: string; cargando: boolean; donde: 'cinta' | 'camara' } | null>(null);

    const playerEl = useRef<HTMLDivElement>(null);
    const playerInst = useRef<any>(null);

    // ── cintas ──────────────────────────────────────────────────────────────
    const cargarSesiones = useCallback(async () => {
        await guardarSesion().catch(() => {}); // incluye lo que se está grabando ahora
        const data = await getAuditoriaSessions();
        setSesiones(data);
        // verifica la huella de las cintas terminadas que tengan datos
        const res: Record<string, 'ok' | 'rota' | 'sin_verificar'> = {};
        for (const s of data.filter(x => !x.sinCinta && !x.esActual && x.chunks?.length).slice(0, 12)) {
            res[s.id] = await verificarIntegridadSesion(s.id).catch(() => 'sin_verificar' as const);
        }
        setIntegridad(res);
    }, []);

    useEffect(() => { void cargarSesiones(); }, [cargarSesiones]);

    const abrirCinta = useCallback(async (id: string, offsetMs?: number) => {
        setTab('cintas');
        setSesionActiva(id);
        setCargando(true);
        setEventos(null);
        const ev = await getSessionEvents(id).catch(() => null);
        setEventos(ev);
        setCargando(false);
        if (!ev || ev.length < 3) { toast.error('Esta cinta ya no está disponible en este aparato ni en la nube.'); return; }
        if (offsetMs != null) setSaltar({ ms: offsetMs, n: Date.now() });
    }, []);

    // El reproductor se crea cuando YA hay eventos y el contenedor existe (antes se creaba antes de que React lo pintara y nunca arrancaba).
    useEffect(() => {
        const el = playerEl.current;
        if (!el) return;
        try { playerInst.current?.$destroy?.(); } catch { /* ya destruido */ }
        playerInst.current = null;
        el.innerHTML = '';
        if (!eventos || eventos.length < 3 || tab !== 'cintas') return;
        try {
            playerInst.current = new rrwebPlayer({
                target: el,
                props: { events: eventos, width: el.clientWidth || 800, height: 430, autoPlay: true, showController: true, speedOption: [1, 2, 4, 8] },
            } as any);
        } catch (e) {
            console.error('Error reproduciendo cinta:', e);
            toast.error('No se pudo reproducir esta cinta.');
        }
        return () => { try { playerInst.current?.$destroy?.(); } catch { /* nada */ } playerInst.current = null; };
    }, [eventos, tab]);

    useEffect(() => {
        if (!saltar || !playerInst.current) return;
        const t = setTimeout(() => { try { playerInst.current?.goto?.(saltar.ms, true); } catch { /* sin reproductor */ } }, 250);
        // Micro-video: se detiene solo después de ~30 s de cinta.
        const p = saltar.pausarEnMs ? setTimeout(() => { try { playerInst.current?.pause?.(); } catch { /* nada */ } }, 250 + saltar.pausarEnMs) : null;
        return () => { clearTimeout(t); if (p) clearTimeout(p); };
    }, [saltar, eventos]);

    // ── auditoría ───────────────────────────────────────────────────────────
    const op = useMemo(() => {
        const hasta = new Date();
        const desde = new Date(Date.now() - (periodo - 1) * 86400000);
        return { desde: iso(desde), hasta: iso(hasta) };
    }, [periodo]);

    // Entregas de Turno y cierres automáticos de la Bóveda (lo que sí se registra en caja).
    const bovedaMovs = useMemo(() => { try { return getMovimientosBoveda(); } catch { return []; } }, [op, sesionesCaja]); // eslint-disable-line react-hooks/exhaustive-deps

    const resultado = useMemo(() => {
        const conIntegridad = sesiones.map(s => ({ ...s, integridad: integridad[s.id] || s.integridad }));
        return ejecutarAuditoria({ ventas, sesionesCaja, gastos, movimientos, productos, inventario, sesionesGrabadas: conIntegridad, clips, bovedaMovs }, op);
    }, [ventas, sesionesCaja, gastos, movimientos, productos, inventario, sesiones, integridad, op, clips, bovedaMovs]);

    // clips de Videovigilancia del periodo
    useEffect(() => {
        let vivo = true;
        void clipsEnRango(op.desde, op.hasta).then(c => { if (vivo) setClips(c as unknown as ClipVideo[]); }).catch(() => {});
        return () => { vivo = false; };
    }, [op]);

    const hallazgosVisibles = useMemo(
        () => resultado.hallazgos.filter(h => filtroSev === 'todas' || h.severidad === filtroSev),
        [resultado, filtroSev],
    );

    const verVideo = async (clip: ClipVideo | null) => {
        if (!clip?.url_clip) { toast.info('No hay video de cámara para ese momento.'); return; }
        const url = await urlFirmadaClip(clip.url_clip);
        if (!url) { toast.error('No se pudo abrir el video.'); return; }
        setExplicacion(null);
        setVideoUrl({ url, titulo: `${clip.camara_nombre || 'Cámara'} · ${fechaCorta(new Date(clip.capturado_en))}`, clip });
    };

    const verRef = (r: RefHallazgo) => {
        if (r.tipo === 'clip') { void verVideo(clips.find(c => c.id === r.id) || null); return; }
        if (r.tipo === 'sesion') {
            const s = sesiones.find(x => x.id === r.id);
            void abrirCinta(r.id, r.t && s ? Math.max(0, r.t - s.inicio - 3000) : undefined);
        } else if (r.tipo === 'venta') {
            const v = ventas.find(x => x.id === r.id);
            const c = v ? ventaEnCinta(v.fecha, sesiones) : null;
            if (c) void abrirCinta(c.sesionId, Math.max(0, c.offsetMs - 5000));
            else toast.info('Esa venta no quedó grabada en ninguna cinta.');
        }
    };

    // ── IA ──────────────────────────────────────────────────────────────────
    const [chat, setChat] = useState<{ rol: 'yo' | 'ia'; texto: string }[]>([]);
    const [pregunta, setPregunta] = useState('');
    const [pensando, setPensando] = useState(false);

    const preguntarIA = useCallback(async (texto: string) => {
        const t = texto.trim();
        if (!t || pensando) return;
        setTab('ia');
        setPensando(true);
        setChat(c => [...c, { rol: 'yo', texto: t }, { rol: 'ia', texto: '' }]);
        const contexto = contextoParaIA(resultado, op, sesiones);
        try {
            await consultarAgente('auditor-digital' as any, t, chunk => {
                setChat(c => { const copia = [...c]; copia[copia.length - 1] = { rol: 'ia', texto: copia[copia.length - 1].texto + chunk }; return copia; });
            }, undefined, contexto);
        } catch (e: any) {
            setChat(c => { const copia = [...c]; copia[copia.length - 1] = { rol: 'ia', texto: `⚠️ No pude consultar la IA: ${e?.message || 'sin conexión'}. El análisis de reglas de arriba sigue funcionando sin internet.` }; return copia; });
        } finally { setPensando(false); }
    }, [pensando, resultado, op, sesiones]);

    // ── IA explica un video ─────────────────────────────────────────────────
    const explicarVideo = useCallback(async (titulo: string, tipo: 'cinta' | 'momento' | 'camara', guion: string) => {
        if (explicacion?.cargando) return;
        setExplicacion({ titulo, texto: '', cargando: true, donde: tipo === 'camara' ? 'camara' : 'cinta' });
        try {
            await consultarAgente('auditor-digital' as any, promptExplicarVideo(tipo), chunk => {
                setExplicacion(e => (e ? { ...e, texto: e.texto + chunk } : e));
            }, undefined, guion);
        } catch (e: any) {
            setExplicacion(x => (x ? { ...x, texto: `⚠️ No pude consultar la IA: ${e?.message || 'sin conexión'}.` } : x));
        } finally {
            setExplicacion(x => (x ? { ...x, cargando: false } : x));
        }
    }, [explicacion]);

    const explicarCinta = (desde?: number, hasta?: number, titulo?: string) => {
        if (!activa) return;
        const a = desde ?? activa.inicio; const b = hasta ?? activa.fin;
        void explicarVideo(titulo || `Cinta ${fechaCorta(activa.date)}`, desde != null ? 'momento' : 'cinta',
            guionVideo(activa, a, b, { eventos, hallazgos: resultado.hallazgos }));
    };

    const explicarClip = (clip: ClipVideo) => {
        const t = new Date(clip.capturado_en).getTime();
        const cerca = ventasCercanas(clip.capturado_en, ventas);
        const caja = sesionesCaja.find((c: any) => { const a = new Date(c.fechaApertura).getTime(); const f = c.fechaCierre ? new Date(c.fechaCierre).getTime() : Date.now(); return t >= a && t <= f; });
        const hs = resultado.hallazgos.filter(h => h.fecha && Math.abs(new Date(h.fecha).getTime() - t) <= 30 * 60000).slice(0, 8);
        const guion = [
            `VIDEO DE CÁMARA: ${clip.camara_nombre || 'cámara'}, ${new Date(t).toLocaleString('es-CO')}, ~10 s.`,
            `LO QUE LA IA VIO AL GRABARLO: ${clip.descripcion_ia || 'sin análisis todavía'}.`,
            `CLASIFICACIÓN: ${clip.clasificacion || '—'}; ALERTAS: ${(clip.categorias_detectadas || []).join(', ') || 'ninguna'}.`,
            `CAJA ABIERTA EN ESE MOMENTO: ${caja ? `${caja.cajaNombre || 'Caja'} (${caja.turno || '—'}, ${caja.vendedoraNombre || 'sin nombre'})` : 'ninguna'}.`,
            `VENTAS ±3 MIN: ${cerca.length ? cerca.map((v: any) => `$${Math.round(Number(v.total) || 0).toLocaleString('es-CO')}`).join(', ') : 'ninguna registrada'}.`,
            ...(hs.length ? ['HALLAZGOS CERCANOS:', ...hs.map(h => `- [${h.severidad}] ${h.titulo}`)] : []),
        ].join('\n');
        void explicarVideo(`Cámara ${clip.camara_nombre || ''} · ${fechaCorta(new Date(t))}`, 'camara', guion);
    };

    const explicar = (h: Hallazgo) => void preguntarIA(`Explícame este hallazgo como si fuera para la dueña de la panadería, dime qué pudo pasar (sin acusar a nadie sin pruebas), qué verificar primero y cómo evitarlo: "${h.titulo}". ${h.detalle}`);

    const compartirWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(resumenWhatsApp(resultado, op))}`, '_blank');

    const activa = sesiones.find(s => s.id === sesionActiva) || null;
    const k = resultado.kpis;
    const nivelCls = resultado.nivel === 'rojo' ? 'text-red-600' : resultado.nivel === 'amarillo' ? 'text-amber-500' : 'text-emerald-600';

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Encabezado */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                        <Video className="w-8 h-8 text-rose-500" /> Auditoría Digital
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                        Cruza ventas, cajas, gastos e inventario con las cintas grabadas de lo que se hizo en la app, y la IA te explica lo que no cuadra.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {grabando ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200" data-grabando="si">
                            <span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" /></span>
                            Grabando en este aparato
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300" data-grabando="no">Grabación apagada en este aparato</Badge>
                    )}
                    {([1, 7, 30, 90] as Periodo[]).map(p => (
                        <button key={p} onClick={() => setPeriodo(p)} data-periodo={p}
                            className={cn('h-8 px-3 rounded-full text-xs font-black border-2', periodo === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500')}>
                            {p === 1 ? 'Hoy' : `${p} días`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-resumen>
                <Card className="col-span-2 lg:col-span-1 border-2">
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Riesgo</p>
                        <p className={cn('text-5xl font-black leading-none mt-1', nivelCls)} data-score>{resultado.score}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">de 100 · {resultado.nivel === 'rojo' ? 'atención ya' : resultado.nivel === 'amarillo' ? 'revisar' : 'tranquilo'}</p>
                        {resultado.hallazgos[0] && <p className="text-[10px] text-slate-500 mt-2 leading-tight" data-porque>Por qué: {resultado.hallazgos[0].titulo}</p>}
                    </CardContent>
                </Card>
                <Dato titulo="Ventas" valor={`$${Math.round(k.totalVentas).toLocaleString('es-CO')}`} sub={`${k.nVentas} tickets`} />
                <Dato titulo="Cajas vs Bóveda" valor={`${k.cajasCruzadas}`} sub={`cajas cruzadas con su entrega · ${k.nEntregas} entregas`} alerta={resultado.hallazgos.some(h => h.categoria === 'caja' && (h.severidad === 'critica' || h.severidad === 'alta'))} />
                <Dato titulo="Hallazgos" valor={`${resultado.hallazgos.length}`} sub={`${k.porSeveridad.critica} críticos · ${k.porSeveridad.alta} altos`} alerta={k.porSeveridad.critica > 0} />
                <Dato titulo="Cintas · Cámaras" valor={`${sesiones.length} · ${k.nClips}`} sub={`${k.clipsAlerta} alertas de video · ${sesiones.reduce((s, x) => s + (x.sensibles?.length || 0), 0)} acciones sensibles`} alerta={k.clipsAlerta > 0} />
            </div>

            {k.sinVentasPOS && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300" data-aviso-sin-ventas>
                    No hay ventas registradas en la caja de la app en este periodo. La revisión de caja se basa en aperturas, cierres y entregas a Bóveda; las reglas de ventas no tienen datos.
                </div>
            )}

            {/* Pestañas */}
            <div className="flex items-center gap-2 flex-wrap">
                {([['hallazgos', 'Hallazgos', FileSearch], ['cintas', 'Cintas', Video], ['personas', 'Personas', Users], ['ia', 'IA Auditora', Bot]] as const).map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setTab(id)} data-tab={id}
                        className={cn('h-10 px-4 rounded-xl text-sm font-black flex items-center gap-2 border-2', tab === id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500')}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl font-black text-xs" onClick={compartirWhatsApp}><MessageCircle className="w-4 h-4 mr-1.5" /> Resumen por WhatsApp</Button>
                    <Button size="sm" className="rounded-xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white" data-analisis-ia
                        onClick={() => void preguntarIA('Haz un análisis ejecutivo de esta auditoría: lo más grave primero, qué pudo causarlo, qué debo revisar hoy y un plan de 3 acciones. Sé directo y no acuses a nadie sin pruebas.')}>
                        <Sparkles className="w-4 h-4 mr-1.5" /> Análisis con IA
                    </Button>
                </div>
            </div>

            {/* ── HALLAZGOS ── */}
            {tab === 'hallazgos' && (
                <div className="space-y-3" data-panel="hallazgos">
                    <div className="flex gap-2 flex-wrap">
                        {(['todas', 'critica', 'alta', 'media', 'info'] as const).map(s => (
                            <button key={s} onClick={() => setFiltroSev(s)}
                                className={cn('h-8 px-3 rounded-full text-xs font-black border-2', filtroSev === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500')}>
                                {s === 'todas' ? `Todas (${resultado.hallazgos.length})` : `${SEV_LABEL[s]} (${k.porSeveridad[s]})`}
                            </button>
                        ))}
                    </div>
                    {hallazgosVisibles.length === 0 ? (
                        <Card><CardContent className="p-10 text-center text-slate-500">
                            <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                            <p className="font-black">Sin hallazgos en este periodo</p>
                            <p className="text-xs mt-1">Las reglas revisaron {k.nVentas} ventas y {k.cajasAuditadas} cajas cerradas y no encontraron nada raro.</p>
                        </CardContent></Card>
                    ) : hallazgosVisibles.map(h => (
                        <Card key={h.id} data-hallazgo={h.regla} className="border-slate-200 dark:border-white/10">
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start gap-3">
                                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0', SEV_CLS[h.severidad])}>{SEV_LABEL[h.severidad]}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-sm">{h.titulo}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{h.detalle}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {CAT_LABEL[h.categoria]}{h.responsable ? ` · ${h.responsable}` : ''}{h.fecha ? ` · ${fechaCorta(new Date(h.fecha))}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {h.refs.filter(r => r.tipo === 'sesion' || r.tipo === 'venta' || r.tipo === 'clip').slice(0, 3).map((r, i) => (
                                        <Button key={i} size="sm" variant="outline" className="rounded-lg h-8 text-xs font-black" onClick={() => verRef(r)}>
                                            <Eye className="w-3.5 h-3.5 mr-1" /> {r.tipo === 'clip' ? 'Ver video de la cámara' : 'Ver en cinta'}
                                        </Button>
                                    ))}
                                    {h.refs.some(r => r.tipo === 'venta') && !h.refs.some(r => r.tipo === 'clip') && clipCercano(h.fecha || '', clips) && (
                                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs font-black" onClick={() => void verVideo(clipCercano(h.fecha || '', clips))}>
                                            <Video className="w-3.5 h-3.5 mr-1" /> Ver cámara en ese momento
                                        </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="rounded-lg h-8 text-xs font-black text-indigo-600" onClick={() => explicar(h)}>
                                        <Bot className="w-3.5 h-3.5 mr-1" /> Que la IA lo explique
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ── CINTAS ── (el contenedor del reproductor SIEMPRE existe) */}
            <div className={cn('grid grid-cols-1 lg:grid-cols-4 gap-5', tab !== 'cintas' && 'hidden')} data-panel="cintas">
                <Card className="lg:col-span-1 border-slate-200 shadow-sm overflow-hidden flex flex-col h-[640px]">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b py-3 flex flex-row justify-between items-center">
                        <CardTitle className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Cintas</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => void cargarSesiones()} className="h-6 w-6"><RefreshCw className="w-3 h-3" /></Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto flex-1 divide-y">
                        {sesiones.length === 0 && (
                            <div className="p-8 text-center text-slate-500 text-xs">
                                <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                Aún no hay cintas. Se guardan solas cada 30 segundos mientras usas la app.
                            </div>
                        )}
                        {sesiones.map(s => {
                            const integ = integridad[s.id];
                            return (
                                <button key={s.id} data-sesion={s.id} onClick={() => void abrirCinta(s.id)}
                                    className={cn('w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-start justify-between gap-2', sesionActiva === s.id && 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black">{fechaCorta(s.date)}{s.esActual && <span className="ml-1.5 text-[9px] text-rose-600 font-black">● EN VIVO</span>}</p>
                                        <p className="text-[12px] font-black text-slate-900 dark:text-white truncate">Sesión de {s.usuario || 'sin nombre'}{s.rol ? ` · ${s.rol}` : ' · sin rol'}</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{s.equipo ? `Turno de caja: ${s.turno || ''} ${s.equipo}` : 'Sin turno de caja'} · {s.dispositivo || ''}</p>
                                        <p className="text-[10px] text-slate-400">{duracion(s.fin - s.inicio)} · {s.clics} clics{s.sensibles?.length ? ` · ⚠ ${s.sensibles.length} sensibles` : ''}{s.momentos?.length ? ` · ▶ ${s.momentos.length} momentos` : ''}</p>
                                        <div className="flex gap-1 mt-1">
                                            {s.isCloud && <span className="text-[9px] px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded font-black uppercase">Nube</span>}
                                            {s.sinCinta && !s.isCloud && <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black uppercase">Solo resumen</span>}
                                            {integ === 'ok' && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-black uppercase flex items-center gap-0.5"><Fingerprint className="w-2.5 h-2.5" /> Íntegra</span>}
                                            {integ === 'rota' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-black uppercase flex items-center gap-0.5"><ShieldAlert className="w-2.5 h-2.5" /> Alterada</span>}
                                        </div>
                                    </div>
                                    <Play className={cn('w-4 h-4 mt-1 shrink-0', sesionActiva === s.id ? 'text-indigo-500' : 'text-slate-300')} />
                                </button>
                            );
                        })}
                    </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-4">
                    <Card className="border-slate-200 shadow-sm bg-slate-100 dark:bg-slate-950 overflow-hidden min-h-[520px] relative">
                        <div ref={playerEl} data-player className="w-full flex justify-center p-2" />
                        {!sesionActiva && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center pointer-events-none">
                                <ShieldCheck className="w-14 h-14 mb-3 opacity-20" />
                                <p className="font-bold text-slate-600">Elige una cinta para reproducirla</p>
                                <p className="text-xs mt-1 max-w-sm">Verás el mouse, los clics y lo que había en pantalla. Desde "Hallazgos" también puedes ir directo al momento exacto.</p>
                            </div>
                        )}
                        {sesionActiva && cargando && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-white/70 dark:bg-black/50">
                                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" /> <p className="text-sm font-medium">Cargando cinta…</p>
                            </div>
                        )}
                        {sesionActiva && !cargando && !eventos && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                                <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
                                <p className="font-bold">Cinta no disponible</p>
                                <p className="text-xs mt-1 max-w-sm">Solo se conservan las últimas 10 cintas en cada aparato y un tramo reciente en la nube. Aquí queda el resumen de lo que se hizo.</p>
                            </div>
                        )}
                    </Card>

                    {activa && (
                        <Card className="border-slate-900 dark:border-white">
                            <CardContent className="p-4">
                                <p className="text-sm font-black text-slate-950 dark:text-white">Quién entró a la app: {activa.usuario || 'sin nombre'}{activa.rol ? ` · rol ${activa.rol}` : ' · sin rol'}</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{activa.equipo ? `Turno de caja (no es la sesión): ${activa.turno || ''} ${activa.equipo}` : 'No hay turno de caja marcado en esta cinta.'}</p>
                                <p className="text-sm font-bold text-slate-950 dark:text-white mt-2">{certezaDeCinta(activa).frase}</p>
                            </CardContent>
                        </Card>
                    )}

                    {activa && (
                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" className="rounded-xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white" data-explicar-cinta
                                disabled={!!explicacion?.cargando} onClick={() => explicarCinta()}>
                                <Bot className="w-4 h-4 mr-1.5" /> Que la IA explique esta cinta
                            </Button>
                        </div>
                    )}

                    {explicacion && explicacion.donde === 'cinta' && <Explicacion e={explicacion} onCerrar={() => setExplicacion(null)} />}

                    {activa && (activa.momentos?.length || 0) > 0 && (
                        <Card className="border-rose-200" data-momentos>
                            <CardHeader className="py-3"><CardTitle className="text-sm font-bold">Momentos críticos · micro-videos de 30 s ({activa.momentos!.length})</CardTitle></CardHeader>
                            <CardContent className="p-0 max-h-64 overflow-y-auto divide-y">
                                {[...activa.momentos!].reverse().map((m, i) => (
                                    <div key={i} className="flex items-center hover:bg-rose-50 dark:hover:bg-rose-900/10">
                                        <button onClick={() => setSaltar({ ms: Math.max(0, m.t - activa.inicio - 10000), n: Date.now(), pausarEnMs: 30000 })}
                                            className="flex-1 min-w-0 text-left px-4 py-1.5 text-xs flex items-center gap-3">
                                            <Play className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                            <span className="font-mono text-slate-400 w-12 shrink-0">{mmss(m.t - activa.inicio)}</span>
                                            <span className="truncate"><b>{m.vista || '—'}</b> · {m.motivo}</span>
                                        </button>
                                        <button data-explicar-momento onClick={() => explicarCinta(m.t - 10000, m.t + 20000, `Micro-video ${mmss(m.t - activa.inicio)} · ${m.vista || ''}`)}
                                            disabled={!!explicacion?.cargando}
                                            className="shrink-0 mr-2 px-2 h-7 rounded-lg text-[11px] font-black text-indigo-600 hover:bg-indigo-50 flex items-center gap-1">
                                            <Bot className="w-3.5 h-3.5" /> Explicar
                                        </button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {activa && (activa.modulos?.length || 0) > 0 && (
                        <Card className="border-slate-200" data-recorrido>
                            <CardHeader className="py-3"><CardTitle className="text-sm font-bold">Recorrido: dónde entró, cuánto estuvo y cuándo salió</CardTitle></CardHeader>
                            <CardContent className="p-0 max-h-56 overflow-y-auto divide-y">
                                {activa.modulos!.map((m, i) => (
                                    <button key={i} onClick={() => setSaltar({ ms: Math.max(0, m.entra - activa.inicio), n: Date.now() })}
                                        className={cn('w-full text-left px-4 py-1.5 text-xs flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50', (m.critico || MODULOS_CRITICOS.has(m.vista)) && 'bg-rose-50/60 dark:bg-rose-900/10')}>
                                        <span className="font-mono text-slate-400 w-12 shrink-0">{mmss(m.entra - activa.inicio)}</span>
                                        <span className="truncate flex-1"><b>{m.vista}</b>{(m.critico || MODULOS_CRITICOS.has(m.vista)) ? ' · crítico' : ''}</span>
                                        <span className="text-slate-500 shrink-0">{duracion((m.sale ?? activa.fin) - m.entra)}</span>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {activa && activa.acciones?.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="py-3"><CardTitle className="text-sm font-bold">Línea de tiempo de acciones</CardTitle></CardHeader>
                            <CardContent className="p-0 max-h-64 overflow-y-auto divide-y" data-timeline>
                                {activa.acciones.map((a, i) => {
                                    const sens = activa.sensibles?.some(x => x.t === a.t && x.texto === a.texto);
                                    return (
                                        <button key={i} onClick={() => setSaltar({ ms: Math.max(0, a.t - activa.inicio - 2000), n: Date.now() })}
                                            className={cn('w-full text-left px-4 py-1.5 text-xs flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50', sens && 'bg-amber-50 dark:bg-amber-900/10')}>
                                            <span className="font-mono text-slate-400 w-12 shrink-0">{mmss(a.t - activa.inicio)}</span>
                                            <span className={cn('truncate', sens && 'font-black text-amber-950 dark:text-amber-200')}>{sens ? '⚠ ' : ''}{a.texto}{a.usuario ? ` · ${a.usuario}${a.rol ? ` (${a.rol})` : ''}` : ''}</span>
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* ── PERSONAS ── */}
            {tab === 'personas' && (
                <div className="space-y-3" data-panel="personas">
                    {resultado.personas.length === 0 && <Card><CardContent className="p-8 text-center text-slate-500 text-sm">Sin ventas ni hallazgos en este periodo.</CardContent></Card>}
                    {resultado.personas.map(p => (
                        <Card key={p.nombre}>
                            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg text-white shrink-0"
                                    style={{ background: p.riesgo >= 60 ? '#dc2626' : p.riesgo >= 30 ? '#f59e0b' : '#10b981' }}>{p.riesgo}</div>
                                <div className="flex-1 min-w-[180px]">
                                    <p className="font-black">{p.nombre}</p>
                                    <p className="text-xs text-slate-500">{p.ventas} ventas · ${Math.round(p.total).toLocaleString('es-CO')} · ticket ${Math.round(p.ticketPromedio).toLocaleString('es-CO')}</p>
                                </div>
                                <div className="text-xs text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
                                    <span>Descuentos: <b>{p.descuentos}</b></span>
                                    <span>Crédito: <b>{p.creditoPct}%</b></span>
                                    <span>Fuera de horario: <b>{p.fueraHorario}</b></span>
                                    <span>Hallazgos: <b>{p.hallazgos}</b></span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    <p className="text-[11px] text-slate-400">El puntaje solo suma señales (descuentos, descuadres, ajustes…); no prueba que alguien haya hecho algo mal. Verifica siempre en la cinta.</p>
                </div>
            )}

            {/* ── IA ── */}
            {tab === 'ia' && (
                <Card data-panel="ia">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex gap-2 flex-wrap">
                            {[
                                'Dame el resumen de riesgos de la semana',
                                '¿Qué cajas debo revisar primero y por qué?',
                                '¿Quién necesita una conversación y de qué?',
                                'Haz un plan de 3 controles para evitar esto',
                            ].map(s => (
                                <button key={s} onClick={() => void preguntarIA(s)} disabled={pensando} className="text-xs font-bold px-3 py-1.5 rounded-full border-2 border-slate-200 hover:border-indigo-400">{s}</button>
                            ))}
                        </div>
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-3 min-h-[240px] max-h-[460px] overflow-y-auto space-y-3" data-chat>
                            {chat.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Pregúntale a la IA auditora. Responde solo con los datos de esta auditoría y no inventa cifras.</p>}
                            {chat.map((m, i) => (
                                <div key={i} className={cn('text-sm whitespace-pre-wrap rounded-2xl px-3 py-2 max-w-[92%]', m.rol === 'yo' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border')}>
                                    {m.texto || (pensando ? 'Analizando…' : '')}
                                </div>
                            ))}
                        </div>
                        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const t = pregunta; setPregunta(''); void preguntarIA(t); }}>
                            <input value={pregunta} onChange={e => setPregunta(e.target.value)} placeholder="Ej: ¿por qué falta plata en la caja del turno de tarde?" data-pregunta
                                className="flex-1 h-11 rounded-xl border-2 border-slate-200 px-4 text-sm outline-none focus:border-indigo-400 dark:bg-slate-900" />
                            <Button type="submit" disabled={pensando || !pregunta.trim()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white h-11"><Send className="w-4 h-4" /></Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {videoUrl && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setVideoUrl(null)} data-video-modal>
                    <div className="bg-slate-900 rounded-2xl p-4 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <p className="text-white text-sm font-black mb-2">{videoUrl.titulo}</p>
                        <video src={videoUrl.url} controls autoPlay className="w-full rounded-xl bg-black" />
                        {videoUrl.clip && (
                            <Button className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!!explicacion?.cargando} data-explicar-camara
                                onClick={() => explicarClip(videoUrl.clip!)}>
                                <Bot className="w-4 h-4 mr-1.5" /> Que la IA explique este video
                            </Button>
                        )}
                        {explicacion && explicacion.donde === 'camara' && <div className="mt-3 max-h-72 overflow-y-auto"><Explicacion e={explicacion} onCerrar={() => setExplicacion(null)} /></div>}
                        <Button className="mt-3 w-full" variant="outline" onClick={() => { setVideoUrl(null); setExplicacion(null); }}>Cerrar</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Explicacion({ e, onCerrar }: { e: { titulo: string; texto: string; cargando: boolean }; onCerrar: () => void }) {
    return (
        <Card className="border-indigo-200" data-explicacion>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-600" /> {e.titulo}</CardTitle>
                <button onClick={onCerrar} className="text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
            </CardHeader>
            <CardContent className="pt-0 text-sm whitespace-pre-wrap leading-relaxed">
                {e.texto || (e.cargando ? 'La IA está revisando el video…' : '')}
                <p className="text-[10px] text-slate-400 mt-3">La IA explica con lo que quedó registrado (pantallas, botones, valores escritos y hallazgos). Confírmalo viendo el video.</p>
            </CardContent>
        </Card>
    );
}

function Dato({ titulo, valor, sub, alerta }: { titulo: string; valor: string; sub: string; alerta?: boolean }) {
    return (
        <Card className={cn(alerta && 'border-red-300')}>
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{titulo}</p>
                <p className={cn('text-2xl font-black mt-1', alerta && 'text-red-600')}>{valor}</p>
                <p className="text-[11px] text-slate-500">{sub}</p>
            </CardContent>
        </Card>
    );
}

export default CCTVDigital;
