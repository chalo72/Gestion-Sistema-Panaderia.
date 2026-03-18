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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 p-8 glass-card rounded-[2.5rem] bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30">
                    <ShoppingCart className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
                        Suministros <span className="text-indigo-600 dark:text-indigo-400">& Estrategia</span>
                    </h1>
                    <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">Control de aprovisionamiento activo • {pedidosCount} Pre-pedidos</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 relative z-10">
                <Button
                    variant="outline"
                    onClick={onGenerarSugerencias}
                    className="h-14 px-6 glass-card border-indigo-200/50 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400 rounded-2xl gap-3 font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                >
                    <Wand2 className="w-4 h-4" /> Inteligencia Stock
                </Button>
                <Button
                    onClick={onAddPrePedido}
                    className="h-14 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-500/20 gap-3 font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 border-none"
                >
                    <Plus className="w-5 h-5" /> Nueva Planificación
                </Button>
            </div>

            <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-400/5 rounded-full blur-3xl" />
        </div>
    );
}
