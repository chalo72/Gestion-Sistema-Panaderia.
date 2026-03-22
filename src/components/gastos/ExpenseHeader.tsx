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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">
                        Centro de Gastos
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control inteligente de egresos e inversiones</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    onClick={onScanReceipt}
                    className="h-10 px-4 border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 rounded-xl gap-2 font-black uppercase tracking-widest text-[10px] transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                    <Camera className="w-4 h-4" />
                    Escanear Comprobante
                </Button>
                <Button
                    onClick={onAddManual}
                    className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm gap-2 font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 border-none"
                >
                    <Plus className="w-4 h-4" />
                    Registrar Gasto
                </Button>
            </div>
        </div>
    );
}
