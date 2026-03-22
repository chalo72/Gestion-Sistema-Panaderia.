import React from 'react';
import { Warehouse, Wand2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface InventoryHeaderProps {
    onHandleGenerarSugerencias: () => void;
    onExportCSV: () => void;
}

export function InventoryHeader({
    onHandleGenerarSugerencias,
    onExportCSV,
}: InventoryHeaderProps) {
    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
            {/* Título */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                    <Warehouse className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Inventario</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control de stock · Dulce Placer</p>
                </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3 relative z-10 flex-wrap">
                <Button
                    onClick={onHandleGenerarSugerencias}
                    className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest
                               bg-gradient-to-r from-amber-500 to-orange-600 text-white
                               shadow-lg shadow-amber-500/20 border-none hover:opacity-90 transition-all gap-2"
                >
                    <Wand2 className="w-4 h-4 shrink-0" />
                    Reponer con IA
                </Button>
                <Button
                    variant="outline"
                    onClick={onExportCSV}
                    className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest
                               border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600
                               dark:text-slate-300 transition-all gap-2"
                >
                    <Download className="w-4 h-4 shrink-0 text-indigo-500" />
                    Exportar Reporte
                </Button>
            </div>
        </header>
    );
}
