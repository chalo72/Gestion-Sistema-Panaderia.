import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, Store, User, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Cajas fijas de Dulce Placer ────────────────────────────────────────────
const CAJAS_PANADERIA = [
    { nombre: 'Caja Principal',    emoji: '🏪', descripcion: 'Panes, dulces, bebidas' },
    { nombre: 'Helados',           emoji: '🍦', descripcion: 'Helados y postres fríos' },
    { nombre: 'Fritos',            emoji: '🍟', descripcion: 'Empanadas, fritos varios' },
    { nombre: 'Micheladas',        emoji: '🍺', descripcion: 'Micheladas y cervezas' },
    { nombre: 'Tortas',            emoji: '🎂', descripcion: 'Tortas del día' },
    { nombre: 'Tinto/Capuchinos',  emoji: '☕', descripcion: 'Bebidas calientes' },
    { nombre: 'Tortas Especiales', emoji: '🎁', descripcion: 'Tortas por encargo' },
];

const TURNOS = [
    { id: 'Mañana' as const, emoji: '☀️', hora: '6am – 2pm',  color: 'border-amber-400   bg-amber-50   text-amber-700   dark:bg-amber-900/20 dark:text-amber-300' },
    { id: 'Tarde'  as const, emoji: '🌆', hora: '2pm – 10pm', color: 'border-orange-400  bg-orange-50  text-orange-700  dark:bg-orange-900/20 dark:text-orange-300' },
    { id: 'Noche'  as const, emoji: '🌙', hora: '10pm – 6am', color: 'border-indigo-400  bg-indigo-50  text-indigo-700  dark:bg-indigo-900/20 dark:text-indigo-300' },
];

// Configuración por caja (vendedora + monto apertura)
interface CajaConfig {
    vendedoraNombre: string;
    montoApertura: number;
    incluida: boolean;
}

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

    // Config individual por caja
    const [configs, setConfigs] = useState<Record<string, CajaConfig>>(() =>
        Object.fromEntries(
            CAJAS_PANADERIA.map(c => [c.nombre, { vendedoraNombre: '', montoApertura: 0, incluida: true }])
        )
    );

    const cajasIncluidas = CAJAS_PANADERIA.filter(c => configs[c.nombre]?.incluida);
    const totalEfectivo  = usarMontoGlobal
        ? cajasIncluidas.length * montoGlobal
        : cajasIncluidas.reduce((sum, c) => sum + (configs[c.nombre]?.montoApertura || 0), 0);

    const toggleCaja = (nombre: string) => {
        setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], incluida: !prev[nombre].incluida } }));
    };

    const setVendedora = (nombre: string, val: string) => {
        setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], vendedoraNombre: val } }));
    };

    const setMontoCaja = (nombre: string, val: number) => {
        setConfigs(prev => ({ ...prev, [nombre]: { ...prev[nombre], montoApertura: val } }));
    };

    const handleIniciarJornada = async () => {
        if (cajasIncluidas.length === 0) return;
        setLoading(true);
        setProgreso(0);

        for (let i = 0; i < cajasIncluidas.length; i++) {
            const caja = cajasIncluidas[i];
            const cfg  = configs[caja.nombre];
            const monto = usarMontoGlobal ? montoGlobal : (cfg.montoApertura || 0);

            // Guardar extras para que usePriceControl los lea al crear la sesión
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

        // Resetear estado
        setLoading(false);
        setProgreso(0);
        setMontoGlobal(0);
        setConfigs(Object.fromEntries(
            CAJAS_PANADERIA.map(c => [c.nombre, { vendedoraNombre: '', montoApertura: 0, incluida: true }])
        ));
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={loading ? undefined : onClose}>
            <DialogContent className="max-w-lg rounded-3xl p-0 border-none shadow-2xl bg-white dark:bg-slate-950 overflow-hidden max-h-[95vh] flex flex-col">

                {/* ── Header ── */}
                <div className="bg-[#135bec] px-6 pt-6 pb-5 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg shrink-0">
                            <Clock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Iniciar Jornada</h2>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">Dulce Placer · {cajasIncluidas.length} cajas · {turno}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">

                    {/* ── Selección de turno ── */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Turno de trabajo</label>
                        <div className="grid grid-cols-3 gap-2">
                            {TURNOS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTurno(t.id)}
                                    className={cn(
                                        "h-14 rounded-xl border-2 font-black text-sm uppercase transition-all flex flex-col items-center justify-center gap-0.5",
                                        turno === t.id ? t.color + ' shadow-sm' : "border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200"
                                    )}
                                >
                                    <span className="text-lg">{t.emoji}</span>
                                    <span className="text-[10px]">{t.id}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Efectivo inicial ── */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Efectivo inicial por caja</label>
                            <button
                                onClick={() => setUsarMontoGlobal(v => !v)}
                                className={cn(
                                    "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all",
                                    usarMontoGlobal
                                        ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                        : "border-slate-200 text-slate-400"
                                )}
                            >
                                {usarMontoGlobal ? 'Monto único ✓' : 'Monto único'}
                            </button>
                        </div>

                        {usarMontoGlobal && (
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-blue-600 flex items-center justify-center group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <input
                                    type="number"
                                    value={montoGlobal || ''}
                                    onChange={e => setMontoGlobal(parseFloat(e.target.value) || 0)}
                                    className="w-full h-14 pl-16 pr-5 text-2xl font-black rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-600/30 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none tabular-nums"
                                    placeholder="0"
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Lista de cajas ── */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5" /> Puntos de venta ({cajasIncluidas.length}/{CAJAS_PANADERIA.length})
                            </label>
                            <div className="flex gap-1.5">
                                <button onClick={() => setConfigs(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, incluida: true }])))}
                                    className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all">
                                    Todas
                                </button>
                                <button onClick={() => setConfigs(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, incluida: false }])))}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all">
                                    Ninguna
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                            {CAJAS_PANADERIA.map((caja) => {
                                const cfg = configs[caja.nombre];
                                const incluida = cfg.incluida;
                                const abierta = expandida === caja.nombre;

                                return (
                                    <div key={caja.nombre} className={cn(
                                        "transition-all",
                                        !incluida && "opacity-40"
                                    )}>
                                        {/* Fila principal */}
                                        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900">
                                            {/* Toggle incluir */}
                                            <button
                                                onClick={() => toggleCaja(caja.nombre)}
                                                className={cn(
                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                    incluida ? "border-emerald-500 bg-emerald-500" : "border-slate-200 dark:border-slate-700"
                                                )}
                                            >
                                                {incluida && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </button>

                                            {/* Emoji + nombre */}
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-xl shrink-0">{caja.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none truncate">{caja.nombre}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{caja.descripcion}</p>
                                                </div>
                                            </div>

                                            {/* Monto si es individual */}
                                            {!usarMontoGlobal && incluida && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={cfg.montoApertura || ''}
                                                        onChange={e => setMontoCaja(caja.nombre, parseFloat(e.target.value) || 0)}
                                                        className="w-20 h-8 px-2 text-sm font-black text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-blue-300 tabular-nums"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            )}

                                            {/* Expandir vendedora */}
                                            {incluida && (
                                                <button
                                                    onClick={() => setExpandida(abierta ? null : caja.nombre)}
                                                    className="w-8 h-8 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                                >
                                                    {abierta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                </button>
                                            )}
                                        </div>

                                        {/* Expandido: nombre vendedora */}
                                        {abierta && incluida && (
                                            <div className="px-4 pb-3 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    value={cfg.vendedoraNombre}
                                                    onChange={e => setVendedora(caja.nombre, e.target.value)}
                                                    placeholder="Nombre de la vendedora (opcional)"
                                                    autoFocus
                                                    className="flex-1 h-9 px-3 text-sm font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-300 outline-none uppercase placeholder:normal-case placeholder:font-normal transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Resumen total ── */}
                    {cajasIncluidas.length > 0 && (
                        <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-800 px-5 py-3 rounded-2xl">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total efectivo a distribuir</p>
                                <p className="text-xl font-black text-white tabular-nums">
                                    ${totalEfectivo.toLocaleString('es-CO')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cajas</p>
                                <p className="text-xl font-black text-emerald-400">{cajasIncluidas.length}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer fijo ── */}
                <div className="shrink-0 px-5 pb-5 pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">

                    {/* Barra de progreso durante apertura */}
                    {loading && (
                        <div className="space-y-1 mb-3">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Abriendo cajas...</span>
                                <span>{progreso}/{cajasIncluidas.length}</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${cajasIncluidas.length > 0 ? (progreso / cajasIncluidas.length) * 100 : 0}%` }}
                                />
                            </div>
                            {progreso > 0 && progreso <= cajasIncluidas.length && (
                                <p className="text-[10px] font-bold text-slate-500 text-center">
                                    {CAJAS_PANADERIA.find(c => c.nombre === cajasIncluidas[progreso - 1]?.nombre)?.emoji} {cajasIncluidas[progreso - 1]?.nombre} ✓
                                </p>
                            )}
                        </div>
                    )}

                    <Button
                        onClick={handleIniciarJornada}
                        disabled={loading || cajasIncluidas.length === 0}
                        className="w-full h-14 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-black uppercase tracking-[0.15em] text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95 border-none disabled:opacity-50"
                    >
                        {loading
                            ? `Abriendo ${progreso}/${cajasIncluidas.length}...`
                            : `Iniciar Jornada ${TURNOS.find(t => t.id === turno)?.emoji} · ${cajasIncluidas.length} Cajas`
                        }
                    </Button>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-full text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2 disabled:opacity-30"
                    >
                        Cancelar
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
