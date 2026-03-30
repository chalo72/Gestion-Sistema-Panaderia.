import { useState, useCallback } from 'react';
import { Tag, Calendar, Folder, Briefcase, Wrench, Package, MoreHorizontal, AlertTriangle, TrendingDown, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Presupuestos por defecto (editables por el usuario, guardados en localStorage)
const PRESUPUESTOS_DEFAULT: Record<string, number> = {
    'Materia Prima': 0,
    'Servicios': 0,
    'Arriendo': 0,
    'Nomina': 0,
    'Mantenimiento': 0,
    'Otros': 0,
};

const CATEGORIAS_CONFIG = [
    { label: 'Materia Prima', key: 'Materia Prima', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-600/10', barra: 'bg-indigo-500' },
    { label: 'Servicios',     key: 'Servicios',     icon: Tag,       color: 'text-blue-600',   bg: 'bg-blue-600/10',   barra: 'bg-blue-500'   },
    { label: 'Arriendo',      key: 'Arriendo',      icon: Folder,    color: 'text-amber-600',  bg: 'bg-amber-500/10',  barra: 'bg-amber-500'  },
    { label: 'Nómina',        key: 'Nomina',        icon: Package,   color: 'text-violet-600', bg: 'bg-violet-500/10', barra: 'bg-violet-500' },
    { label: 'Mantenimiento', key: 'Mantenimiento', icon: Wrench,    color: 'text-cyan-600',   bg: 'bg-cyan-500/10',   barra: 'bg-cyan-500'   },
    { label: 'Otros',         key: 'Otros',         icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-500/10', barra: 'bg-slate-400' },
];

interface ExpenseKPIsProps {
    totalMensual: number;
    gastosPorCategoria: Record<string, number>;
    promedioMesAnterior?: number;
    gastosPorCategoriaAnterior?: Record<string, number>;
    formatCurrency: (val: number) => string;
}

function cargarPresupuestos(): Record<string, number> {
    try {
        const raw = localStorage.getItem('ag_presupuestos_gastos');
        return raw ? { ...PRESUPUESTOS_DEFAULT, ...JSON.parse(raw) } : { ...PRESUPUESTOS_DEFAULT };
    } catch { return { ...PRESUPUESTOS_DEFAULT }; }
}

function guardarPresupuestos(p: Record<string, number>) {
    try { localStorage.setItem('ag_presupuestos_gastos', JSON.stringify(p)); } catch {}
}

export function ExpenseKPIs({
    totalMensual,
    gastosPorCategoria,
    promedioMesAnterior = 0,
    gastosPorCategoriaAnterior = {},
    formatCurrency
}: ExpenseKPIsProps) {
    const [presupuestos, setPresupuestos] = useState<Record<string, number>>(cargarPresupuestos);
    const [editandoPres, setEditandoPres] = useState<string | null>(null);
    const [valorEditPres, setValorEditPres] = useState('');
    const [expandido, setExpandido] = useState(false);

    // Anomalía: gasto mes actual > 30% más que mes anterior
    const esAnomalia = promedioMesAnterior > 0 && totalMensual > promedioMesAnterior * 1.3;

    const guardarEditPresupuesto = useCallback((key: string) => {
        const valor = parseFloat(valorEditPres.replace(/[^0-9.]/g, '')) || 0;
        const nuevos = { ...presupuestos, [key]: valor };
        setPresupuestos(nuevos);
        guardarPresupuestos(nuevos);
        setEditandoPres(null);
    }, [presupuestos, valorEditPres]);

    const catVisibles = expandido ? CATEGORIAS_CONFIG : CATEGORIAS_CONFIG.slice(0, 3);

    return (
        <div className="space-y-4 mb-6">
            {/* Card principal de totales */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-2 rounded-[2.5rem] border-none bg-slate-900 text-white shadow-3xl overflow-hidden relative group">
                    <CardContent className="p-6 sm:p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Egreso Consolidado</span>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Este mes operativo</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {esAnomalia && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 rounded-xl border border-amber-500/30">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-[9px] font-black text-amber-400 uppercase">Gasto inusual</span>
                                    </div>
                                )}
                                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </div>

                        <div className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter">
                            {formatCurrency(totalMensual)}
                        </div>

                        {promedioMesAnterior > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                                <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400">
                                    Mes anterior: {formatCurrency(promedioMesAnterior)}
                                    <span className={cn('ml-2 font-black', esAnomalia ? 'text-amber-400' : 'text-emerald-400')}>
                                        {promedioMesAnterior > 0
                                            ? ` (${totalMensual >= promedioMesAnterior ? '+' : ''}${(((totalMensual - promedioMesAnterior) / promedioMesAnterior) * 100).toFixed(0)}%)`
                                            : ''}
                                    </span>
                                </span>
                            </div>
                        )}

                        {/* Barra de progreso vs presupuesto total */}
                        {(() => {
                            const presTotal = Object.values(presupuestos).reduce((s, v) => s + v, 0);
                            if (presTotal <= 0) return (
                                <p className="text-[9px] text-slate-500 mt-4">Define presupuestos por categoría → haz clic en ✏️</p>
                            );
                            const pct = Math.min((totalMensual / presTotal) * 100, 100);
                            const excede = totalMensual > presTotal;
                            return (
                                <div className="mt-5">
                                    <div className="flex justify-between mb-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Presupuesto total</span>
                                        <span className={cn('text-[9px] font-black uppercase', excede ? 'text-rose-400' : 'text-emerald-400')}>
                                            {pct.toFixed(0)}% {excede ? '⚠ excedido' : 'usado'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-700', excede ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]')}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-1 text-right">
                                        {excede ? `Excede ${formatCurrency(totalMensual - presTotal)}` : `Disponible: ${formatCurrency(presTotal - totalMensual)}`}
                                    </p>
                                </div>
                            );
                        })()}
                    </CardContent>
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl opacity-50" />
                </Card>

                {/* 3 categorías principales */}
                {CATEGORIAS_CONFIG.slice(0, 3).map((cat) => {
                    const gastado = gastosPorCategoria[cat.key] || 0;
                    const presupuesto = presupuestos[cat.key] || 0;
                    const pct = presupuesto > 0 ? Math.min((gastado / presupuesto) * 100, 100) : 0;
                    const excede = presupuesto > 0 && gastado > presupuesto;
                    const gastadoAnt = gastosPorCategoriaAnterior[cat.key] || 0;
                    const anomaliaCat = gastadoAnt > 0 && gastado > gastadoAnt * 1.5;

                    return (
                        <Card key={cat.key} className="rounded-[2.5rem] border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
                            <CardContent className="p-5 sm:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={cn('p-2.5 rounded-xl shadow-sm', cat.bg)}>
                                        <cat.icon className={cn('w-4 h-4', cat.color)} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {anomaliaCat && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</span>
                                    </div>
                                </div>

                                <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                    {formatCurrency(gastado)}
                                </div>

                                {/* Presupuesto editable */}
                                <div className="mt-3">
                                    {editandoPres === cat.key ? (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                className="w-full text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 outline-none border border-indigo-300 dark:border-indigo-700"
                                                value={valorEditPres}
                                                onChange={e => setValorEditPres(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && guardarEditPresupuesto(cat.key)}
                                                autoFocus
                                                placeholder="0"
                                            />
                                            <button onClick={() => guardarEditPresupuesto(cat.key)} className="text-emerald-500 hover:text-emerald-600">
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                {presupuesto > 0 ? `Pres: ${formatCurrency(presupuesto)}` : `Sin presupuesto`}
                                            </p>
                                            <button
                                                onClick={() => { setEditandoPres(cat.key); setValorEditPres(presupuesto.toString()); }}
                                                className="text-slate-300 hover:text-indigo-400 transition-colors"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}

                                    {presupuesto > 0 && (
                                        <div className="mt-1.5">
                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={cn('h-full rounded-full transition-all duration-700', excede ? 'bg-rose-500' : cat.barra)}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className={cn('text-[8px] font-black mt-1 text-right', excede ? 'text-rose-500' : 'text-slate-400')}>
                                                {pct.toFixed(0)}% {excede ? '⚠ excedido' : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Otras 3 categorías (expandibles) */}
            <div>
                <button
                    onClick={() => setExpandido(e => !e)}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {expandido ? 'Ocultar otras categorías' : 'Ver Nómina, Mantenimiento y Otros'}
                </button>

                {expandido && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-ag-fade-in">
                        {CATEGORIAS_CONFIG.slice(3).map((cat) => {
                            const gastado = gastosPorCategoria[cat.key] || 0;
                            const presupuesto = presupuestos[cat.key] || 0;
                            const pct = presupuesto > 0 ? Math.min((gastado / presupuesto) * 100, 100) : 0;
                            const excede = presupuesto > 0 && gastado > presupuesto;

                            return (
                                <Card key={cat.key} className="rounded-3xl border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-md shadow-lg border border-white/20">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={cn('p-2 rounded-xl', cat.bg)}>
                                                <cat.icon className={cn('w-4 h-4', cat.color)} />
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</span>
                                        </div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                                            {formatCurrency(gastado)}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            {editandoPres === cat.key ? (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <input
                                                        type="number"
                                                        className="w-full text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 outline-none border border-indigo-300 dark:border-indigo-700"
                                                        value={valorEditPres}
                                                        onChange={e => setValorEditPres(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && guardarEditPresupuesto(cat.key)}
                                                        autoFocus placeholder="0"
                                                    />
                                                    <button onClick={() => guardarEditPresupuesto(cat.key)} className="text-emerald-500">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {presupuesto > 0 ? `Pres: ${formatCurrency(presupuesto)}` : 'Sin presupuesto'}
                                                    </p>
                                                    <button onClick={() => { setEditandoPres(cat.key); setValorEditPres(presupuesto.toString()); }} className="text-slate-300 hover:text-indigo-400">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        {presupuesto > 0 && (
                                            <div className="mt-1.5">
                                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full transition-all duration-700', excede ? 'bg-rose-500' : cat.barra)} style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className={cn('text-[8px] font-black mt-1', excede ? 'text-rose-500' : 'text-slate-400')}>{pct.toFixed(0)}%{excede ? ' ⚠' : ''}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
