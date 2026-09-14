import React from 'react';
import { DollarSign, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PrecioHeaderProps {
    onAddPrecio: () => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    canEdit: boolean;
    resultCount?: number;
    totalCount?: number;
}

export function PrecioHeader({
    onAddPrecio,
    searchTerm,
    setSearchTerm,
    canEdit,
    resultCount,
    totalCount,
}: PrecioHeaderProps) {
    const hayFiltro = searchTerm.trim().length > 0;
    const tokens = searchTerm.trim().split(/\s+/).filter(Boolean);

    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-5">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">Precios de Insumos</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {hayFiltro && resultCount !== undefined
                            ? <span className="text-blue-600">{resultCount} resultado{resultCount !== 1 ? 's' : ''} de {totalCount}</span>
                            : 'Análisis comparativo · Dulce Placer'
                        }
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    {/* Buscador inteligente */}
                    <div className="relative flex-1 sm:w-72 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Ej: nectar, Postobon 1.5, azucar..."
                            className="pl-9 pr-8 h-10 rounded-xl border-slate-200 dark:border-slate-700 text-sm"
                        />
                        {hayFiltro && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="Limpiar búsqueda"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
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

                {/* Chips de tokens activos */}
                {tokens.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Filtrando por:</span>
                        {tokens.map((token, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {token}
                            </span>
                        ))}
                        <span className="text-[9px] text-slate-400 font-bold">(todos deben coincidir)</span>
                    </div>
                )}
            </div>
        </header>
    );
}
