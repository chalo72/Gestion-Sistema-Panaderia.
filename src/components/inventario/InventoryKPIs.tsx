import React from 'react';
import { Package, CheckCircle, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryKPIsProps {
    stats: {
        total: number;
        ok: number;
        bajo: number;
        agotado: number;
    };
    filtroEstado: string;
    setFiltroEstado: (estado: any) => void;
}

export function InventoryKPIs({ stats, filtroEstado, setFiltroEstado }: InventoryKPIsProps) {
    const kpis = [
        {
            id: 'todos',
            label: 'Total SKUs',
            value: stats.total,
            icon: Package,
            iconBg: 'bg-indigo-500/10',
            iconColor: 'text-indigo-600',
            activeRing: 'ring-indigo-400',
            textColor: 'text-indigo-600',
        },
        {
            id: 'ok',
            label: 'En Salud',
            value: stats.ok,
            icon: CheckCircle,
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-600',
            activeRing: 'ring-emerald-400',
            textColor: 'text-emerald-600',
        },
        {
            id: 'bajo',
            label: 'Stock Bajo',
            value: stats.bajo,
            icon: TrendingDown,
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-600',
            activeRing: 'ring-amber-400',
            textColor: 'text-amber-600',
        },
        {
            id: 'agotado',
            label: 'Agotados',
            value: stats.agotado,
            icon: AlertTriangle,
            iconBg: 'bg-rose-500/10',
            iconColor: 'text-rose-600',
            activeRing: 'ring-rose-400',
            textColor: 'text-rose-600',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            {kpis.map((kpi) => {
                const activo = filtroEstado === kpi.id;
                return (
                    <button
                        key={kpi.id}
                        onClick={() => setFiltroEstado(kpi.id as any)}
                        className={cn(
                            'text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer',
                            activo
                                ? `border-transparent ring-2 ${kpi.activeRing} shadow-md`
                                : 'border-slate-100 dark:border-slate-800'
                        )}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', kpi.iconBg)}>
                                <kpi.icon className={cn('w-5 h-5', kpi.iconColor)} />
                            </div>
                            {activo && (
                                <span className={cn(
                                    'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                                    kpi.iconBg, kpi.iconColor
                                )}>
                                    Filtrado
                                </span>
                            )}
                        </div>
                        <p className={cn('text-3xl font-black tabular-nums tracking-tighter', kpi.textColor)}>
                            {kpi.value.toString().padStart(2, '0')}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {kpi.label}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}
