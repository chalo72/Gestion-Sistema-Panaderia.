import React from 'react';
import { Package, Wand2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryHeaderProps {
    onHandleGenerarSugerencias: () => void;
    onExportCSV: () => void;
}

export function InventoryHeader({
    onHandleGenerarSugerencias,
    onExportCSV
}: InventoryHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 p-8 glass-card rounded-[2.5rem] bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30 shadow-xl">
            <div className="flex items-center gap-5">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Package className="h-8 w-8 text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
                        Control <span className="text-indigo-600 dark:text-indigo-400">Stock</span>
                    </h1>
                    <p className="text-muted-foreground font-medium text-sm mt-1 tracking-wide opacity-70">
                        Inteligencia Yimi aplicada al flujo de inventario
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Button
                    onClick={onHandleGenerarSugerencias}
                    className="h-12 px-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl gap-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-500/20 border-none hover:scale-105 transition-all"
                >
                    <Wand2 className="w-4 h-4" />
                    Reponer con IA
                </Button>
                <Button
                    variant="outline"
                    className="h-12 px-6 glass-card border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-lg"
                    onClick={onExportCSV}
                >
                    <Download className="w-4 h-4 text-indigo-500" />
                    Exportar Reporte
                </Button>
            </div>
        </div>
    );
}
