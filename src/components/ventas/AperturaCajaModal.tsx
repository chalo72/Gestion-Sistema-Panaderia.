import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    DollarSign, Clock, Store, User, CheckCircle,
    ChevronDown, ChevronUp, Plus, Trash2, Pencil, Save, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Cajas por defecto ────────────────────────────────────────────────────────
const CAJAS_DEFAULT = [
    { nombre: 'Caja Principal',    emoji: '🏪', descripcion: 'Panes, dulces, bebidas' },
    { nombre: 'Helados',           emoji: '🍦', descripcion: 'Helados y postres fríos' },
    { nombre: 'Fritos',            emoji: '🍟', descripcion: 'Empanadas, fritos varios' },
    { nombre: 'Micheladas',        emoji: '🍺', descripcion: 'Micheladas y cervezas' },
    { nombre: 'Tortas',            emoji: '🎂', descripcion: 'Tortas del día' },
    { nombre: 'Tinto/Capuchinos',  emoji: '☕', descripcion: 'Bebidas calientes' },
    { nombre: 'Tortas Especiales', emoji: '🎁', descripcion: 'Tortas por encargo' },
];

const LS_KEY = 'dp_cajas_config';

interface CajaDefinicion { nombre: string; emoji: string; descripcion: string; }

// Carga cajas desde localStorage (o usa las por defecto)
function cargarCajasGuardadas(): CajaDefinicion[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw) as CajaDefinicion[];
    } catch { /* ignorar */ }
    return CAJAS_DEFAULT;
}

function guardarCajas(cajas: CajaDefinicion[]) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cajas)); } catch { /* ignorar */ }
}

const TURNOS = [
    { id: 'Mañana' as const, emoji: '☀️', hora: '6am – 2pm',  color: 'border-amber-400   bg-amber-50   text-amber-700   dark:bg-amber-900/20 dark:text-amber-300' },
    { id: 'Tarde'  as const, emoji: '🌆', hora: '2pm – 10pm', color: 'border-orange-400  bg-orange-50  text-orange-700  dark:bg-orange-900/20 dark:text-orange-300' },
    { id: 'Noche'  as const, emoji: '🌙', hora: '10pm – 6am', color: 'border-indigo-400  bg-indigo-50  text-indigo-700  dark:bg-indigo-900/20 dark:text-indigo-300' },
];

const EMOJIS_RAPIDOS = ['🏪','🍦','🍟','🍺','🎂','☕','🎁','🛒','💰','🍕','🥤','🍰','🧁','🛍️','🏬'];

interface CajaConfig { vendedoraNombre: string; montoApertura: number; incluida: boolean; }

interface AperturaCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAbrir: (monto: number) => Promise<any>;
}

export function AperturaCajaModal({ isOpen, onClose, onAbrir }: AperturaCajaModalProps) {
    const [turno,           setTurno]           = useState<'Mañana' | 'Tarde' | 'Noche'>('Mañana');
    const [montoGlobal,     setMontoGlobal]     = useState<number>(0);
    const [usarMontoGlobal, setUsarMontoGlobal] = useState<boolean>(true);
    const [loading,         setLoading]         = useState(false);
    const [progreso,        setProgreso]        = useState<number>(0);
    const [expandida,       setExpandida]       = useState<string | null>(null);

    // Lista de cajas (editable y persistida)
    const [cajasLista,  setCajasLista]  = useState<CajaDefinicion[]>(cargarCajasGuardadas);
    const [modoGestion, setModoGestion] = useState(false);

    // Estado para editar/crear caja
    const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
    const [editNombre,  setEditNombre]  = useState('');
    const [editEmoji,   setEditEmoji]   = useState('🏪');
    const [editDesc,    setEditDesc]    = useState('');
    const [showEmojis,  setShowEmojis]  = useState(false);

    // Config de apertura por caja
    const [configs, setConfigs] = useState<Record<string, CajaConfig>>(() =>
        Object.fromEntries(cajasLista.map(c => [c.nombre, { vendedoraNombre: '', montoApertura: 0, incluida: true }]))
    );

    const cajasIncluidas = cajasLista.filter(c => configs[c.nombre]?.incluida);
    const totalEfectivo  = usarMontoGlobal
        ? cajasIncluidas.length * montoGlobal
        : cajasIncluidas.reduce((sum, c) => sum + (configs[c.nombre]?.montoApertura || 0), 0);

    const toggleCaja  = (nombre: string) => setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], incluida: !prev[nombre]?.incluida } }));
    const setVendedora = (nombre: string, val: string) => setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], vendedoraNombre: val } }));
    const setMontoCaja = (nombre: string, val: number)  => setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], montoApertura: val } }));

    // ── Gestión de cajas ──
    const abrirNueva = () => {
        setEditandoIdx(-1); // -1 = nueva
        setEditNombre('');
        setEditEmoji('🏪');
        setEditDesc('');
        setShowEmojis(false);
    };

    const abrirEditar = (idx: number) => {
        const c = cajasLista[idx];
        setEditandoIdx(idx);
        setEditNombre(c.nombre);
        setEditEmoji(c.emoji);
        setEditDesc(c.descripcion);
        setShowEmojis(false);
    };

    const guardarEdicion = () => {
        if (!editNombre.trim()) return;
        const nueva: CajaDefinicion = { nombre: editNombre.trim(), emoji: editEmoji, descripcion: editDesc.trim() };
        let nuevaLista: CajaDefinicion[];
        if (editandoIdx === -1) {
            // Agregar
            nuevaLista = [...cajasLista, nueva];
            setConfigs(prev => ({ ...prev, [nueva.nombre]: { vendedoraNombre: '', montoApertura: 0, incluida: true } }));
        } else {
            // Editar existente
            const nombreViejo = cajasLista[editandoIdx!].nombre;
            nuevaLista = cajasLista.map((c, i) => i === editandoIdx ? nueva : c);
            // Migrar config
            setConfigs(prev => {
                const vieja = prev[nombreViejo];
                const next = { ...prev };
                delete next[nombreViejo];
                next[nueva.nombre] = vieja || { vendedoraNombre: '', montoApertura: 0, incluida: true };
                return next;
            });
        }
        setCajasLista(nuevaLista);
        guardarCajas(nuevaLista);
        setEditandoIdx(null);
    };

    const eliminarCaja = (idx: number) => {
        const nombre = cajasLista[idx].nombre;
        const nuevaLista = cajasLista.filter((_, i) => i !== idx);
        setCajasLista(nuevaLista);
        guardarCajas(nuevaLista);
        setConfigs(prev => { const n = { ...prev }; delete n[nombre]; return n; });
    };

    const resetearPorDefecto = () => {
        if (!confirm('¿Restaurar la lista de cajas por defecto? Se perderán tus cambios.')) return;
        guardarCajas(CAJAS_DEFAULT);
        setCajasLista(CAJAS_DEFAULT);
        setConfigs(Object.fromEntries(CAJAS_DEFAULT.map(c => [c.nombre, { vendedoraNombre: '', montoApertura: 0, incluida: true }])));
    };

    // ── Iniciar jornada ──
    const handleIniciarJornada = async () => {
        if (cajasIncluidas.length === 0) return;
        setLoading(true);
        setProgreso(0);
        for (let i = 0; i < cajasIncluidas.length; i++) {
            const caja = cajasIncluidas[i];
            const cfg  = configs[caja.nombre] || { vendedoraNombre: '', montoApertura: 0, incluida: true };
            const monto = usarMontoGlobal ? montoGlobal : (cfg.montoApertura || 0);
            try {
                localStorage.setItem('dp_caja_extras', JSON.stringify({
                    cajaNombre:      caja.nombre,
                    turno,
                    vendedoraNombre: cfg.vendedoraNombre.trim() || undefined,
                }));
            } catch { /* ignorar */ }
            await onAbrir(monto);
            setProgreso(i + 1);
        }
        setLoading(false);
        setProgreso(0);
        setMontoGlobal(0);
        setConfigs(Object.fromEntries(cajasLista.map(c => [c.nombre, { vendedoraNombre: '', montoApertura: 0, incluida: true }])));
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={loading ? undefined : onClose}>
            <DialogContent className="max-w-lg rounded-3xl p-0 border-none shadow-2xl bg-white dark:bg-slate-950 overflow-hidden max-h-[95vh] flex flex-col">

                {/* ── Header ── */}
                <div className="bg-[#135bec] px-6 pt-6 pb-5 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg shrink-0">
                                <Clock className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
                                    {modoGestion ? 'Gestionar Cajas' : 'Iniciar Jornada'}
                                </h2>
                                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">
                                    {modoGestion ? `${cajasLista.length} cajas configuradas` : `Dulce Placer · ${cajasIncluidas.length} cajas · ${turno}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setModoGestion(v => !v); setEditandoIdx(null); }}
                            className={cn(
                                "h-9 px-3 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-1.5",
                                modoGestion
                                    ? "bg-white text-blue-700 border-white"
                                    : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            )}
                        >
                            {modoGestion ? <><X className="w-3.5 h-3.5" /> Volver</> : <><Pencil className="w-3.5 h-3.5" /> Gestionar</>}
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">

                    {/* ════════════════════════════════════════════
                        MODO GESTIÓN DE CAJAS
                    ════════════════════════════════════════════ */}
                    {modoGestion ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Lista de cajas</p>
                                <button onClick={resetearPorDefecto} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all">
                                    Restaurar defecto
                                </button>
                            </div>

                            {/* Lista con edición */}
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                                {cajasLista.map((caja, idx) => {
                                    const editandoEsta = editandoIdx === idx;
                                    return (
                                        <div key={idx} className="bg-white dark:bg-slate-900">
                                            {editandoEsta ? (
                                                /* Formulario inline de edición */
                                                <div className="p-3 space-y-2 bg-indigo-50 dark:bg-indigo-900/10">
                                                    <div className="flex gap-2">
                                                        {/* Selector emoji */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setShowEmojis(v => !v)}
                                                                className="w-11 h-10 rounded-xl border-2 border-indigo-300 bg-white dark:bg-slate-800 text-xl flex items-center justify-center"
                                                            >{editEmoji}</button>
                                                            {showEmojis && (
                                                                <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-xl grid grid-cols-5 gap-1">
                                                                    {EMOJIS_RAPIDOS.map(e => (
                                                                        <button key={e} onClick={() => { setEditEmoji(e); setShowEmojis(false); }}
                                                                            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-lg flex items-center justify-center transition-colors">
                                                                            {e}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Nombre */}
                                                        <input
                                                            autoFocus
                                                            value={editNombre}
                                                            onChange={e => setEditNombre(e.target.value)}
                                                            placeholder="Nombre de la caja"
                                                            className="flex-1 h-10 px-3 text-sm font-black rounded-xl border-2 border-indigo-300 bg-white dark:bg-slate-800 outline-none"
                                                        />
                                                    </div>
                                                    <input
                                                        value={editDesc}
                                                        onChange={e => setEditDesc(e.target.value)}
                                                        placeholder="Descripción (opcional)"
                                                        className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditandoIdx(null)} className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 transition-all">
                                                            Cancelar
                                                        </button>
                                                        <button onClick={guardarEdicion} disabled={!editNombre.trim()}
                                                            className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                            <Save className="w-3.5 h-3.5" /> Guardar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Fila normal */
                                                <div className="flex items-center gap-3 px-4 py-3">
                                                    <span className="text-xl shrink-0">{caja.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none truncate">{caja.nombre}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold truncate">{caja.descripcion || '—'}</p>
                                                    </div>
                                                    <button onClick={() => abrirEditar(idx)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => eliminarCaja(idx)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Formulario de nueva caja */}
                            {editandoIdx === -1 ? (
                                <div className="p-3 space-y-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 dark:bg-indigo-900/10">
                                    <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Nueva caja</p>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <button onClick={() => setShowEmojis(v => !v)}
                                                className="w-11 h-10 rounded-xl border-2 border-indigo-300 bg-white dark:bg-slate-800 text-xl flex items-center justify-center">
                                                {editEmoji}
                                            </button>
                                            {showEmojis && (
                                                <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-xl grid grid-cols-5 gap-1">
                                                    {EMOJIS_RAPIDOS.map(e => (
                                                        <button key={e} onClick={() => { setEditEmoji(e); setShowEmojis(false); }}
                                                            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-lg flex items-center justify-center">
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <input autoFocus value={editNombre} onChange={e => setEditNombre(e.target.value)}
                                            placeholder="Nombre de la caja"
                                            className="flex-1 h-10 px-3 text-sm font-black rounded-xl border-2 border-indigo-300 bg-white dark:bg-slate-800 outline-none" />
                                    </div>
                                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                        placeholder="Descripción (opcional)"
                                        className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none" />
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditandoIdx(null)} className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 transition-all">
                                            Cancelar
                                        </button>
                                        <button onClick={guardarEdicion} disabled={!editNombre.trim()}
                                            className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-50">
                                            <Save className="w-3.5 h-3.5" /> Crear Caja
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={abrirNueva}
                                    className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs font-black uppercase text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all">
                                    <Plus className="w-4 h-4" /> Agregar nueva caja
                                </button>
                            )}
                        </div>
                    ) : (
                    /* ════════════════════════════════════════════
                        MODO NORMAL — INICIAR JORNADA
                    ════════════════════════════════════════════ */
                    <>
                        {/* Turno */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Turno de trabajo</label>
                            <div className="grid grid-cols-3 gap-2">
                                {TURNOS.map(t => (
                                    <button key={t.id} onClick={() => setTurno(t.id)}
                                        className={cn(
                                            "h-14 rounded-xl border-2 font-black text-sm uppercase transition-all flex flex-col items-center justify-center gap-0.5",
                                            turno === t.id ? t.color + ' shadow-sm' : "border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200"
                                        )}>
                                        <span className="text-lg">{t.emoji}</span>
                                        <span className="text-[10px]">{t.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Efectivo inicial */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Efectivo inicial por caja</label>
                                <button onClick={() => setUsarMontoGlobal(v => !v)}
                                    className={cn(
                                        "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all",
                                        usarMontoGlobal
                                            ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                            : "border-slate-200 text-slate-400"
                                    )}>
                                    {usarMontoGlobal ? 'Monto único ✓' : 'Monto único'}
                                </button>
                            </div>
                            {usarMontoGlobal && (
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-blue-600 flex items-center justify-center group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <input type="number" value={montoGlobal || ''} onChange={e => setMontoGlobal(parseFloat(e.target.value) || 0)}
                                        className="w-full h-14 pl-16 pr-5 text-2xl font-black rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-600/30 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none tabular-nums"
                                        placeholder="0" />
                                </div>
                            )}
                        </div>

                        {/* Lista de cajas */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5" /> Puntos de venta ({cajasIncluidas.length}/{cajasLista.length})
                                </label>
                                <div className="flex gap-1.5">
                                    <button onClick={() => setConfigs(p => Object.fromEntries(cajasLista.map(c => [c.nombre, { ...(p[c.nombre] || { vendedoraNombre: '', montoApertura: 0 }), incluida: true }])))}
                                        className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all">Todas</button>
                                    <button onClick={() => setConfigs(p => Object.fromEntries(cajasLista.map(c => [c.nombre, { ...(p[c.nombre] || { vendedoraNombre: '', montoApertura: 0 }), incluida: false }])))}
                                        className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all">Ninguna</button>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                                {cajasLista.map((caja) => {
                                    const cfg     = configs[caja.nombre] || { vendedoraNombre: '', montoApertura: 0, incluida: true };
                                    const incluida = cfg.incluida;
                                    const abierta  = expandida === caja.nombre;
                                    return (
                                        <div key={caja.nombre} className={cn("transition-all", !incluida && "opacity-40")}>
                                            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900">
                                                <button onClick={() => toggleCaja(caja.nombre)}
                                                    className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                        incluida ? "border-emerald-500 bg-emerald-500" : "border-slate-200 dark:border-slate-700")}>
                                                    {incluida && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                </button>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-xl shrink-0">{caja.emoji}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none truncate">{caja.nombre}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">{caja.descripcion}</p>
                                                    </div>
                                                </div>
                                                {!usarMontoGlobal && incluida && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-[10px] text-slate-400 font-bold">$</span>
                                                        <input type="number" value={cfg.montoApertura || ''} onChange={e => setMontoCaja(caja.nombre, parseFloat(e.target.value) || 0)}
                                                            className="w-20 h-8 px-2 text-sm font-black text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-blue-300 tabular-nums"
                                                            placeholder="0" />
                                                    </div>
                                                )}
                                                {incluida && (
                                                    <button onClick={() => setExpandida(abierta ? null : caja.nombre)}
                                                        className="w-8 h-8 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                                        {abierta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                    </button>
                                                )}
                                            </div>
                                            {abierta && incluida && (
                                                <div className="px-4 pb-3 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <input type="text" value={cfg.vendedoraNombre} onChange={e => setVendedora(caja.nombre, e.target.value)}
                                                        placeholder="Nombre de la vendedora (opcional)" autoFocus
                                                        className="flex-1 h-9 px-3 text-sm font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-300 outline-none uppercase placeholder:normal-case placeholder:font-normal transition-all" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Resumen */}
                        {cajasIncluidas.length > 0 && (
                            <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-800 px-5 py-3 rounded-2xl">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total efectivo a distribuir</p>
                                    <p className="text-xl font-black text-white tabular-nums">${totalEfectivo.toLocaleString('es-CO')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cajas</p>
                                    <p className="text-xl font-black text-emerald-400">{cajasIncluidas.length}</p>
                                </div>
                            </div>
                        )}
                    </>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 px-5 pb-5 pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                    {loading && (
                        <div className="space-y-1 mb-3">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Abriendo cajas...</span><span>{progreso}/{cajasIncluidas.length}</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${cajasIncluidas.length > 0 ? (progreso / cajasIncluidas.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}
                    {modoGestion ? (
                        <Button onClick={() => { setModoGestion(false); setEditandoIdx(null); }}
                            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.15em] text-sm">
                            <Save className="w-4 h-4 mr-2" /> Listo — Guardar cambios
                        </Button>
                    ) : (
                        <Button onClick={handleIniciarJornada} disabled={loading || cajasIncluidas.length === 0}
                            className="w-full h-14 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-black uppercase tracking-[0.15em] text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95 border-none disabled:opacity-50">
                            {loading
                                ? `Abriendo ${progreso}/${cajasIncluidas.length}...`
                                : `Iniciar Jornada ${TURNOS.find(t => t.id === turno)?.emoji} · ${cajasIncluidas.length} Cajas`}
                        </Button>
                    )}
                    <button onClick={onClose} disabled={loading}
                        className="w-full text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2 disabled:opacity-30">
                        Cancelar
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
