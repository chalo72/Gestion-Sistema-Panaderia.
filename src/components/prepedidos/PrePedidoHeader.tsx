import React from 'react';
import { ShoppingCart, Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PrePedidoHeaderProps {
    onAddPrePedido: () => void;
    onGenerarSugerencias: () => void;
    pedidosCount: number;
}

export function PrePedidoHeader({
    onAddPrePedido,
    onGenerarSugerencias,
    pedidosCount
}: PrePedidoHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">
                        Suministros & Estrategia
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control de aprovisionamiento activo • {pedidosCount} Pre-pedidos</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    onClick={onGenerarSugerencias}
                    className="h-10 px-4 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-xl gap-2 font-black uppercase tracking-widest text-[10px] hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                    <Wand2 className="w-4 h-4" /> Inteligencia Stock
                </Button>
                <Button
                    onClick={onAddPrePedido}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm gap-2 font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 border-none"
                >
                    <Plus className="w-4 h-4" /> Nueva Planificación
                </Button>
            </div>
        </div>
    );
}
