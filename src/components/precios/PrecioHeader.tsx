import React from 'react';
import { DollarSign, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PrecioHeaderProps {
    onAddPrecio: () => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    canEdit: boolean;
}

export function PrecioHeader({
    onAddPrecio,
    searchTerm,
    setSearchTerm,
    canEdit
}: PrecioHeaderProps) {
    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-5">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">Precios de Insumos</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Análisis comparativo · Dulce Placer</p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar producto o proveedor..."
                        className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 text-sm"
                    />
                </div>
                {canEdit && (
                    <Button
                        onClick={onAddPrecio}
                        className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 font-black uppercase tracking-widest text-xs shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Precio
                    </Button>
                )}
            </div>
        </header>
    );
}
