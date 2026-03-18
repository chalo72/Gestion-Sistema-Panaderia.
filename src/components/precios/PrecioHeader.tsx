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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 p-8 glass-card rounded-[2.5rem] bg-blue-50/30 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30">
                    <DollarSign className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
                        Market <span className="text-blue-600 dark:text-blue-400">Intelligence</span>
                    </h1>
                    <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">Análisis comparativo & Seguimiento de volatilidad</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 relative z-10">
                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 opacity-40 group-focus-within:opacity-100 transition-opacity" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rastrear producto o aliado..."
                        className="h-14 pl-12 bg-white/60 dark:bg-gray-900/40 border-none rounded-2xl shadow-inner font-bold text-xs uppercase tracking-widest placeholder:opacity-40"
                    />
                </div>
                {canEdit && (
                    <Button
                        onClick={onAddPrecio}
                        className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-600/20 gap-3 font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 border-none"
                    >
                        <Plus className="w-5 h-5" /> Inyectar Precio
                    </Button>
                )}
            </div>

            <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-400/5 rounded-full blur-3xl" />
        </div>
    );
}
