import React from 'react';
import { Package, CheckCircle, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

export function InventoryKPIs({
    stats,
    filtroEstado,
    setFiltroEstado
}: InventoryKPIsProps) {
    const kpis = [
        { id: 'todos', label: 'Total Sku', value: stats.total, icon: Package, color: 'bg-indigo-600 shadow-indigo-200' },
        { id: 'ok', label: 'En Salud', value: stats.ok, icon: CheckCircle, color: 'bg-emerald-600 shadow-emerald-200' },
        { id: 'bajo', label: 'Crítico', value: stats.bajo, icon: TrendingDown, color: 'bg-amber-500 shadow-amber-200' },
        { id: 'agotado', label: 'Agotados', value: stats.agotado, icon: AlertTriangle, color: 'bg-rose-600 shadow-rose-200' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpis.map((kpi) => (
                <Card
                    key={kpi.id}
                    className={cn(
                        "group cursor-pointer transition-all duration-500 hover:scale-[1.05] active:scale-[0.98] rounded-[2.5rem] border-none shadow-xl relative overflow-hidden",
                        filtroEstado === kpi.id
                            ? "bg-white dark:bg-gray-800 ring-2 ring-indigo-500 shadow-indigo-500/20"
                            : "bg-white/40 dark:bg-gray-900/40 backdrop-blur-md hover:bg-white dark:hover:bg-gray-800"
                    )}
                    onClick={() => setFiltroEstado(kpi.id as any)}
                >
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className={cn("p-4 rounded-2xl text-white shadow-2xl transition-transform group-hover:rotate-12", kpi.color)}>
                                <kpi.icon className="w-6 h-6" />
                            </div>
                            <div className={cn(
                                "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl",
                                filtroEstado === kpi.id ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50"
                            )}>
                                {filtroEstado === kpi.id ? 'Filtrado' : 'Ver Todos'}
                            </div>
                        </div>
                        <div>
                            <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">
                                {kpi.value.toString().padStart(2, '0')}
                            </p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase mt-2 tracking-widest opacity-60">
                                {kpi.label}
                            </p>
                        </div>

                        {/* Background design element */}
                        <div className={cn(
                            "absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-opacity",
                            filtroEstado === kpi.id ? "opacity-30" : "group-hover:opacity-20",
                            kpi.color
                        )} />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
