import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    DollarSign, Calculator, CheckCircle, AlertTriangle,
    Banknote, Coins, User, Clock, Lock, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CajaSesion } from '@/types';

const BILLETES_CIERRE = [
    { valor: 100000, label: '$100.000', color: 'bg-purple-100 border-purple-200 text-purple-700' },
    { valor: 50000,  label: '$50.000',  color: 'bg-pink-100 border-pink-200 text-pink-700' },
    { valor: 20000,  label: '$20.000',  color: 'bg-blue-100 border-blue-200 text-blue-700' },
    { valor: 10000,  label: '$10.000',  color: 'bg-violet-100 border-violet-200 text-violet-700' },
    { valor: 5000,   label: '$5.000',   color: 'bg-orange-100 border-orange-200 text-orange-700' },
    { valor: 2000,   label: '$2.000',   color: 'bg-rose-100 border-rose-200 text-rose-700' },
    { valor: 1000,   label: '$1.000',   color: 'bg-amber-100 border-amber-200 text-amber-700' },
];
const MONEDAS_CIERRE = [
    { valor: 500, label: '$500', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 200, label: '$200', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 100, label: '$100', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 50,  label: '$50',  color: 'bg-slate-100 border-slate-200 text-slate-600' },
];

interface CierreCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCerrar: (monto: number) => Promise<any>;
    cajaActiva: CajaSesion | undefined;
    formatCurrency: (value: number) => string;
    usuario?: any;
}

export function CierreCajaModal({ isOpen, onClose, onCerrar, cajaActiva, formatCurrency, usuario }: CierreCajaModalProps) {
    const [desglose, setDesglose] = useState<Record<string, string>>({});
    const [observaciones, setObservaciones] = useState('');
    const [confirmando, setConfirmando] = useState(false);

    // Calcular duración del turno
    const duracionTurno = useMemo(() => {
        if (!cajaActiva?.fechaApertura) return '—';
        const diff = Date.now() - new Date(cajaActiva.fechaApertura).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${String(m).padStart(2, '0')}m`;
    }, [cajaActiva]);

    const totalDesglose = useMemo(() => {
        return [...BILLETES_CIERRE, ...MONEDAS_CIERRE].reduce((acc, d) => {
            const cant = parseInt(desglose[String(d.valor)] || '0') || 0;
            return acc + cant * d.valor;
        }, 0);
    }, [desglose]);

    const totalVentas  = cajaActiva?.totalVentas  || 0;
    const montoApertura = cajaActiva?.montoApertura || 0;
    const esperado      = totalVentas + montoApertura;
    const diferencia    = totalDesglose - esperado;
    const hayConteo     = totalDesglose > 0;

    const diferenciaColor = diferencia === 0
        ? 'emerald'
        : Math.abs(diferencia) / Math.max(esperado, 1) > 0.02
            ? 'red'
            : 'amber';

    const handleConfirm = async () => {
        setConfirmando(true);
        try {
            await onCerrar(totalDesglose);
            onClose();
        } finally {
            setConfirmando(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl rounded-3xl p-0 border-none shadow-2xl bg-white dark:bg-slate-950 overflow-hidden">

                {/* ── HEADER ── */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-24 -mt-24" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -ml-16 -mb-16" />
                    <div className="relative z-10">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/15 shadow-lg">
                                    <Calculator className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">Cierre de Turno</h2>
                                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1.5">Arqueo de Caja · Dulce Placer</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 border border-white/10">
                                    <User className="w-3 h-3 text-white/60" />
                                    <span className="text-[11px] font-black text-white/80 uppercase">{usuario?.nombre || cajaActiva?.usuarioId || 'Operador'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 border border-white/10">
                                    <Clock className="w-3 h-3 text-white/60" />
                                    <span className="text-[11px] font-black text-white/80">{duracionTurno} de turno</span>
                                </div>
                            </div>
                        </div>

                        {/* KPIs rápidos en header */}
                        <div className="grid grid-cols-3 gap-3 mt-5">
                            {[
                                { label: 'Apertura', value: formatCurrency(montoApertura), color: 'text-white/70' },
                                { label: 'Ventas', value: formatCurrency(totalVentas), color: 'text-emerald-400' },
                                { label: 'Balance Sistema', value: formatCurrency(esperado), color: 'text-blue-400' },
                            ].map(kpi => (
                                <div key={kpi.label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">{kpi.label}</p>
                                    <p className={cn("text-base font-black tabular-nums leading-none", kpi.color)}>{kpi.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CUERPO ── */}
                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

                    {/* Tabla de denominaciones */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Conteo de Efectivo</p>
                        <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                            {/* Encabezado */}
                            <div className="grid grid-cols-[1fr_90px_110px] bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Denominación</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</span>
                            </div>

                            {/* BILLETES */}
                            <div className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-2 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-900/10 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Banknote className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Billetes</span>
                                </div>
                                <div />
                                <div className="text-right text-[10px] font-black text-purple-400 tabular-nums">
                                    {formatCurrency(BILLETES_CIERRE.reduce((acc, d) => acc + (parseInt(desglose[String(d.valor)] || '0') || 0) * d.valor, 0))}
                                </div>
                            </div>
                            {BILLETES_CIERRE.map(d => {
                                const cant   = parseInt(desglose[String(d.valor)] || '0') || 0;
                                const subtot = cant * d.valor;
                                return (
                                    <div key={d.valor} className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                                        <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg border font-black text-xs w-fit", d.color)}>
                                            {d.label}
                                        </div>
                                        <div className="flex justify-center">
                                            <input
                                                type="number" min="0"
                                                className="h-9 w-[66px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-black text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/20 transition-all"
                                                placeholder="0"
                                                value={desglose[String(d.valor)] || ''}
                                                onChange={e => setDesglose(prev => ({ ...prev, [String(d.valor)]: e.target.value }))}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <span className={cn("text-sm font-black tabular-nums", subtot > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-200 dark:text-slate-700")}>
                                                {subtot > 0 ? formatCurrency(subtot) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* MONEDAS */}
                            <div className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-2 bg-gradient-to-r from-slate-50/80 to-transparent dark:from-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Coins className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monedas</span>
                                </div>
                                <div />
                                <div className="text-right text-[10px] font-black text-slate-400 tabular-nums">
                                    {formatCurrency(MONEDAS_CIERRE.reduce((acc, d) => acc + (parseInt(desglose[String(d.valor)] || '0') || 0) * d.valor, 0))}
                                </div>
                            </div>
                            {MONEDAS_CIERRE.map(d => {
                                const cant   = parseInt(desglose[String(d.valor)] || '0') || 0;
                                const subtot = cant * d.valor;
                                return (
                                    <div key={d.valor} className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                                        <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg border font-black text-xs w-fit", d.color)}>
                                            {d.label}
                                        </div>
                                        <div className="flex justify-center">
                                            <input
                                                type="number" min="0"
                                                className="h-9 w-[66px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-black text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/20 transition-all"
                                                placeholder="0"
                                                value={desglose[String(d.valor)] || ''}
                                                onChange={e => setDesglose(prev => ({ ...prev, [String(d.valor)]: e.target.value }))}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <span className={cn("text-sm font-black tabular-nums", subtot > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-200 dark:text-slate-700")}>
                                                {subtot > 0 ? formatCurrency(subtot) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Total contado */}
                            <div className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-3.5 bg-indigo-50 dark:bg-indigo-900/20 border-t-2 border-indigo-200 dark:border-indigo-700">
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Total Contado</span>
                                <div />
                                <div className="text-right">
                                    <span className={cn("text-xl font-black tabular-nums", hayConteo ? "text-indigo-700 dark:text-indigo-300" : "text-slate-300")}>
                                        {hayConteo ? formatCurrency(totalDesglose) : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de diferencia */}
                    <div className={cn(
                        "p-4 rounded-2xl border-2 transition-all",
                        !hayConteo
                            ? "bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800"
                            : diferenciaColor === 'emerald'
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700"
                                : diferenciaColor === 'amber'
                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                    )}>
                        {hayConteo ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md",
                                        diferenciaColor === 'emerald' ? "bg-emerald-500" :
                                        diferenciaColor === 'amber'   ? "bg-amber-500" : "bg-red-500"
                                    )}>
                                        {diferenciaColor === 'emerald'
                                            ? <CheckCircle className="w-5 h-5" />
                                            : <AlertTriangle className="w-5 h-5" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Diferencia Final</p>
                                        <p className={cn("text-xl font-black tabular-nums",
                                            diferenciaColor === 'emerald' ? "text-emerald-700 dark:text-emerald-400" :
                                            diferenciaColor === 'amber'   ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
                                        )}>
                                            {diferencia === 0 ? 'Caja Cuadrada ✓' : `${diferencia > 0 ? '+' : ''}${formatCurrency(diferencia)}`}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            {diferenciaColor === 'red' ? '⚠ Requiere auditoría' :
                                             diferenciaColor === 'amber' ? 'Revisar antes de confirmar' :
                                             'Todo en orden'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sistema esperaba</p>
                                    <p className="text-base font-black text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(esperado)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-center justify-center py-2">
                                <Banknote className="w-5 h-5 text-slate-300" />
                                <p className="text-xs text-slate-400 font-bold uppercase">Ingresa las cantidades para ver la diferencia</p>
                            </div>
                        )}
                    </div>

                    {/* Observaciones */}
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <FileText className="w-3.5 h-3.5" /> Observaciones del Cierre (opcional)
                        </label>
                        <textarea
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            placeholder="Ej: Se realizó cierre anticipado por mantenimiento..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/20 resize-none transition-all"
                        />
                    </div>
                </div>

                {/* ── FOOTER ACCIONES ── */}
                <div className="px-6 pb-6 pt-2 space-y-3">
                    <Button
                        onClick={handleConfirm}
                        disabled={confirmando}
                        className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-sm shadow-lg transition-all active:scale-[0.98] border-none gap-2.5 disabled:opacity-60"
                    >
                        <Lock className="w-4 h-4" />
                        {confirmando ? 'Cerrando turno...' : 'Confirmar Cierre de Turno'}
                    </Button>
                    <button
                        onClick={onClose}
                        className="w-full text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-1"
                    >
                        Cancelar — Continuar Turno
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
