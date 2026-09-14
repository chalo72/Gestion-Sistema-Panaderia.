import React from 'react';
import { ShoppingCart, Package, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
    onViewVentas: () => void;
    onViewProductos: () => void;
    onViewRecepciones: () => void;
}

export function DashboardHeader({ onViewVentas, onViewProductos, onViewRecepciones }: DashboardHeaderProps) {
    return (
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    Centro de Mando
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                    Panel principal de Panadería Dulce Placer. Gestión en tiempo real.
                </p>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
                <Button
                    onClick={onViewVentas}
                    className="flex items-center gap-2 bg-primary hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all h-11"
                >
                    <ShoppingCart className="w-4 h-4" />
                    Nueva Venta / POS
                </Button>
                <Button
                    onClick={onViewProductos}
                    variant="outline"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-all h-11"
                >
                    <Package className="w-4 h-4" />
                    Catálogo
                </Button>
                <Button
                    onClick={onViewRecepciones}
                    variant="outline"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-all h-11"
                >
                    <ClipboardCheck className="w-4 h-4" />
                    Recepciones
                </Button>
            </div>
        </header>
    );
}
