import { useState, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Pencil, Check, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS_CONFIG = [
    { key: 'Materia Prima', label: 'Materia Prima', color: '#6366f1', bg: 'bg-indigo-500/10',   text: 'text-indigo-600 dark:text-indigo-400'  },
    { key: 'Servicios',     label: 'Servicios',     color: '#3b82f6', bg: 'bg-blue-500/10',     text: 'text-blue-600 dark:text-blue-400'      },
    { key: 'Arriendo',      label: 'Arriendo',      color: '#f59e0b', bg: 'bg-amber-500/10',    text: 'text-amber-600 dark:text-amber-400'    },
    { key: 'Nómina',        label: 'Nómina',        color: '#8b5cf6', bg: 'bg-violet-500/10',   text: 'text-violet-600 dark:text-violet-400'  },
    { key: 'Mantenimiento', label: 'Mantenimiento', color: '#06b6d4', bg: 'bg-cyan-500/10',     text: 'text-cyan-600 dark:text-cyan-400'      },
    { key: 'Otros',         label: 'Otros',         color: '#94a3b8', bg: 'bg-slate-500/10',    text: 'text-slate-500'                        },
];

const PRESUPUESTOS_DEFAULT: Record<string, number> = {
    'Materia Prima': 0, 'Servicios': 0, 'Arriendo': 0,
    'Nómina': 0, 'Mantenimiento': 0, 'Otros': 0,
};

function cargarPresupuestos(): Record<string, number> {
    try {
        const raw = localStorage.getItem('ag_presupuestos_gastos');
        return raw ? { ...PRESUPUESTOS_DEFAULT, ...JSON.parse(raw) } : { ...PRESUPUESTOS_DEFAULT };
    } catch { return { ...PRESUPUESTOS_DEFAULT }; }
}
function guardarPresupuestos(p: Record<string, number>) {
    try { localStorage.setItem('ag_presupuestos_gastos', JSON.stringify(p)); } catch {}
}

interface ExpenseKPIsProps {
    totalMensual: number;
    totalIngresos: number;
    gastosPorCategoria: Record<string, number>;
    promedioMesAnterior?: number;
    formatCurrency: (v: number) => string;
    onFilterCategoria?: (cat: string | null) => void;
    filtroActivo?: string | null;
}

const CustomTooltip = ({ active, payload, formatCurrency }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{d.label}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(d.value)}</p>
            <p className="text-[10px] font-bold text-slate-400">{d.pct.toFixed(1)}%</p>
        </div>
    );
};

export function ExpenseKPIs({
    totalMensual,
    totalIngresos,
    gastosPorCategoria,
    promedioMesAnterior = 0,
    formatCurrency,
    onFilterCategoria,
    filtroActivo,
}: ExpenseKPIsProps) {
    const [presupuestos, setPresupuestos] = useState<Record<string, number>>(cargarPresupuestos);
    const [editandoPres, setEditandoPres] = useState<string | null>(null);
    const [valorEditPres, setValorEditPres] = useState('');
    const [expandido, setExpandido] = useState(false);

    const esAnomalia = promedioMesAnterior > 0 && totalMensual > promedioMesAnterior * 1.3;

    const guardarEditPresupuesto = useCallback((key: string) => {
        const valor = parseFloat(valorEditPres.replace(/[^0-9.]/g, '')) || 0;
        const nuevos = { ...presupuestos, [key]: valor };
        setPresupuestos(nuevos);
        guardarPresupuestos(nuevos);
        setEditandoPres(null);
    }, [presupuestos, valorEditPres]);

    // Datos para el donut
    const donutData = CATEGORIAS_CONFIG
        .map(cat => ({
            ...cat,
            value: gastosPorCategoria[cat.key] || 0,
            pct: totalMensual > 0 ? ((gastosPorCategoria[cat.key] || 0) / totalMensual) * 100 : 0,
        }))
        .filter(d => d.value > 0);

    const presTotal = Object.values(presupuestos).reduce((s, v) => s + v, 0);
    const pctPresupuesto = presTotal > 0 ? Math.min((totalMensual / presTotal) * 100, 100) : 0;
    const excedePres = presTotal > 0 && totalMensual > presTotal;
    const resultado = totalIngresos - totalMensual;

    return (
        <div className="space-y-4">
            {/* Fila principal: Donut + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Donut Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 flex flex-col items-center justify-center min-h-[220px]">
                    {donutData.length > 0 ? (
                        <>
                            <div className="relative w-full" style={{ height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                            onClick={(d) => onFilterCategoria?.(filtroActivo === d.key ? null : d.key)}
                                            cursor="pointer"
                                        >
                                            {donutData.map((entry) => (
                                                <Cell
                                                    key={entry.key}
                                                    fill={entry.color}
                                                    opacity={filtroActivo && filtroActivo !== entry.key ? 0.3 : 1}
                                                    stroke={filtroActivo === entry.key ? entry.color : 'transparent'}
                                                    strokeWidth={3}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Centro del donut */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</span>
                                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                                        {formatCurrency(totalMensual)}
                                    </span>
                                </div>
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                                Toca una porción para filtrar
                            </p>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30">
                            <div className="w-20 h-20 rounded-full border-8 border-slate-200 dark:border-slate-700" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sin gastos este mes</p>
                        </div>
                    )}
                </div>

                {/* Cards de categorías */}
                <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(expandido ? CATEGORIAS_CONFIG : CATEGORIAS_CONFIG.slice(0, 6)).map(cat => {
                        const gastado = gastosPorCategoria[cat.key] || 0;
                        const pres = presupuestos[cat.key] || 0;
                        const pct = pres > 0 ? Math.min((gastado / pres) * 100, 100) : 0;
                        const excede = pres > 0 && gastado > pres;
                        const activa = filtroActivo === cat.key;

                        return (
                            <button
                                key={cat.key}
                                onClick={() => onFilterCategoria?.(activa ? null : cat.key)}
                                className={cn(
                                    'text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.97]',
                                    activa
                                        ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-sm'
                                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                                )}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className={cn('text-[8px] font-black uppercase tracking-widest truncate', cat.text)}>
                                        {cat.label}
                                    </span>
                                    {excede && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                                </div>
                                <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums leading-none">
                                    {formatCurrency(gastado)}
                                </p>

                                {/* Presupuesto editable */}
                                <div className="mt-2" onClick={e => e.stopPropagation()}>
                                    {editandoPres === cat.key ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                className="w-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 rounded-md px-1.5 py-0.5 outline-none border border-indigo-300 dark:border-indigo-700"
                                                value={valorEditPres}
                                                onChange={e => setValorEditPres(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && guardarEditPresupuesto(cat.key)}
                                                autoFocus placeholder="0"
                                            />
                                            <button onClick={() => guardarEditPresupuesto(cat.key)} className="text-emerald-500 shrink-0">
                                                <Check className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[8px] font-bold text-slate-400 truncate">
                                                {pres > 0 ? `Pres: ${formatCurrency(pres)}` : 'Sin presupuesto'}
                                            </span>
                                            <button
                                                onClick={() => { setEditandoPres(cat.key); setValorEditPres(pres.toString()); }}
                                                className="text-slate-300 hover:text-indigo-400 transition-colors shrink-0"
                                            >
                                                <Pencil className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    )}
                                    {pres > 0 && (
                                        <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all duration-500', excede ? 'bg-rose-500' : '')}
                                                style={{ width: `${pct}%`, backgroundColor: excede ? undefined : cat.color }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Barra de presupuesto total + resultado mes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Presupuesto total */}
                {presTotal > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Presupuesto total del mes
                            </span>
                            <span className={cn('text-[9px] font-black uppercase', excedePres ? 'text-rose-500' : 'text-emerald-600')}>
                                {pctPresupuesto.toFixed(0)}% {excedePres ? '⚠ excedido' : 'usado'}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all duration-700',
                                    excedePres ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]')}
                                style={{ width: `${pctPresupuesto}%` }}
                            />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1.5 text-right">
                            {excedePres
                                ? `Excede ${formatCurrency(totalMensual - presTotal)}`
                                : `Disponible: ${formatCurrency(presTotal - totalMensual)}`}
                        </p>
                        {esAnomalia && (
                            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400">
                                    Gasto inusual — 30% sobre el mes anterior
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Resultado operativo */}
                <div className={cn(
                    'rounded-2xl border shadow-sm p-4 flex items-center justify-between',
                    resultado >= 0
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                )}>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Resultado operativo</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Ingresos menos Egresos del mes</p>
                    </div>
                    <div className="text-right">
                        <p className={cn('text-2xl font-black tabular-nums leading-none',
                            resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                            {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
                        </p>
                        {promedioMesAnterior > 0 && (
                            <p className="text-[9px] text-slate-400 mt-1">
                                Mes anterior: {formatCurrency(promedioMesAnterior)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Toggle ver más categorías */}
            <button
                onClick={() => setExpandido(e => !e)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
                {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expandido ? 'Mostrar menos' : 'Ver todas las categorías'}
            </button>
        </div>
    );
}
