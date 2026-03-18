import React from 'react';
import { Tag, Calendar, Folder, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Gasto, GastoCategoria } from '@/types';

interface ExpenseKPIsProps {
    totalMensual: number;
    gastosPorCategoria: Record<string, number>;
    formatCurrency: (val: number) => string;
}

export function ExpenseKPIs({
    totalMensual,
    gastosPorCategoria,
    formatCurrency
}: ExpenseKPIsProps) {
    const categories = [
        { label: 'Materia Prima', key: 'Materia Prima', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-600/10' },
        { label: 'Servicios', key: 'Servicios', icon: Tag, color: 'text-blue-600', bg: 'bg-blue-600/10' },
        { label: 'Fijos/Arriendo', key: 'Arriendo', icon: Folder, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
            <Card className="lg:col-span-2 rounded-[2.5rem] border-none bg-slate-900 text-white shadow-3xl overflow-hidden relative group">
                <CardContent className="p-10 relative z-10">
                    <div className="flex justify-between items-start mb-10">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Egreso Consolidado</span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Este período operativo</p>
                        </div>
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    <div className="text-6xl font-black tabular-nums tracking-tighter">
                        {formatCurrency(totalMensual)}
                    </div>

                    <div className="mt-8 flex items-center gap-3">
                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 w-[65%] rounded-full shadow-[0_0_15px_rgba(244,63,94,0.4)]" />
                        </div>
                        <span className="text-[10px] font-black text-rose-400">65% de Proy.</span>
                    </div>
                </CardContent>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl opacity-50" />
            </Card>

            {categories.map((cat, idx) => (
                <Card key={idx} className="rounded-[2.5rem] border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className={cn("p-3 rounded-2xl shadow-sm", cat.bg)}>
                                <cat.icon className={cn("w-5 h-5", cat.color)} />
                            </div>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                            {formatCurrency(gastosPorCategoria[cat.key] || 0)}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{((gastosPorCategoria[cat.key] || 0) / (totalMensual || 1) * 100).toFixed(0)}% del total</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
