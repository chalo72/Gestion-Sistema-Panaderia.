import React from 'react';
import { DollarSign, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExpenseHeaderProps {
    onAddManual: () => void;
    onScanReceipt: () => void;
}

export function ExpenseHeader({
    onAddManual,
    onScanReceipt
}: ExpenseHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 p-8 glass-card rounded-[2.5rem] bg-rose-50/30 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-rose-600/30">
                    <DollarSign className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
                        Centro de <span className="text-rose-600 dark:text-rose-400">Gastos</span>
                    </h1>
                    <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">Control inteligente de egresos e inversiones</p>
                </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
                <Button
                    variant="outline"
                    onClick={onScanReceipt}
                    className="h-14 px-8 glass-card border-rose-200/50 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 rounded-[1.5rem] gap-3 font-black uppercase tracking-widest text-[10px] transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                    <Camera className="w-5 h-5" />
                    Escanear Comprobante
                </Button>
                <Button
                    onClick={onAddManual}
                    className="h-14 px-8 bg-rose-600 hover:bg-rose-700 text-white rounded-[1.5rem] shadow-xl shadow-rose-500/20 gap-3 font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 border-none"
                >
                    <Plus className="w-5 h-5" />
                    Registrar Gasto
                </Button>
            </div>

            <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-400/5 rounded-full blur-3xl" />
        </div>
    );
}
