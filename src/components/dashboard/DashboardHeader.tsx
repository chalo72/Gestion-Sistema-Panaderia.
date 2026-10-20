import React from 'react';
import { ShoppingCart, Package, ClipboardCheck, Users, Warehouse, Banknote, Receipt, ClipboardList, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
    onViewVentas: () => void;
    onViewProductos: () => void;
    onViewRecepciones: () => void;
    onViewNomina?: () => void;
    onViewBoveda?: () => void;
    onViewCaja?: () => void;
    onViewGastos?: () => void;
    onViewPrePedidos?: () => void;
    onViewMayoristas?: () => void;
}

export function DashboardHeader({ onViewVentas, onViewProductos, onViewRecepciones, onViewNomina, onViewBoveda, onViewCaja, onViewGastos, onViewPrePedidos, onViewMayoristas }: DashboardHeaderProps) {
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
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <Button
                    onClick={onViewVentas}
                    className="flex items-center gap-2 bg-primary hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all h-11"
                >
                    <ShoppingCart className="w-4 h-4" />
                    Nueva Venta / POS
                </Button>
                {onViewPrePedidos && (
                    <Button
                        onClick={onViewPrePedidos}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-violet-500 hover:text-violet-600 transition-all h-11"
                    >
                        <ClipboardList className="w-4 h-4" />
                        Preventa
                    </Button>
                )}
                {onViewMayoristas && (
                    <Button
                        onClick={onViewMayoristas}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:text-amber-600 transition-all h-11"
                    >
                        <Store className="w-4 h-4" />
                        Venta al por mayor
                    </Button>
                )}
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
                {onViewNomina && (
                    <Button
                        onClick={onViewNomina}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500 transition-all h-11"
                    >
                        <Users className="w-4 h-4" />
                        Nómina
                    </Button>
                )}
                {onViewGastos && (
                    <Button
                        onClick={onViewGastos}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-red-500 hover:text-red-500 transition-all h-11"
                    >
                        <Receipt className="w-4 h-4" />
                        Gastos / Salidas
                    </Button>
                )}
                {onViewCaja && (
                    <Button
                        onClick={onViewCaja}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:text-teal-500 transition-all h-11"
                    >
                        <Banknote className="w-4 h-4" />
                        Caja
                    </Button>
                )}
                {onViewBoveda && (
                    <Button
                        onClick={onViewBoveda}
                        variant="outline"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-500 transition-all h-11"
                    >
                        <Warehouse className="w-4 h-4" />
                        Bóveda
                    </Button>
                )}
            </div>
        </header>
    );
}



