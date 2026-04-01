import { List, LayoutGrid, Tag, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductHeaderProps {
    vistaActual: 'lista' | 'cuadricula';
    setVistaActual: (vista: 'lista' | 'cuadricula') => void;
    onManageCategories: () => void;
    onAddProduct: () => void;
    onAddInsumo: () => void;
    onOpenIceCreamAssistant: () => void;
    onOpenBeverageAssistant: () => void;
    checkPermission: (perm: string) => boolean;
}

export function ProductHeader({
    vistaActual,
    setVistaActual,
    onManageCategories,
    onAddProduct,
    onAddInsumo,
    onOpenIceCreamAssistant,
    onOpenBeverageAssistant,
    checkPermission
}: ProductHeaderProps) {
    return (
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 animate-ag-fade-in">
            <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    Gestión de Productos
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                    Catálogo completo de artículos de Panadería Dulce Placer.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Vista toggle */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                        onClick={() => setVistaActual('lista')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            vistaActual === 'lista'
                                ? "bg-primary text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                    >
                        <List className="w-4 h-4 inline mr-1.5" /> Lista
                    </button>
                    <button
                        onClick={() => setVistaActual('cuadricula')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            vistaActual === 'cuadricula'
                                ? "bg-primary text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4 inline mr-1.5" /> Cuadrícula
                    </button>
                </div>

                {checkPermission('CREAR_PRODUCTOS') && (
                    <>
                        <button
                            onClick={onOpenIceCreamAssistant}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 transition-all h-11 text-sm shadow-sm"
                        >
                            🍦 Helados
                        </button>
                        <button
                            onClick={onOpenBeverageAssistant}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition-all h-11 text-sm shadow-sm"
                        >
                            ☕ Bebidas / 🍺
                        </button>
                        <button
                            onClick={onManageCategories}
                            style={{ color: '#475569' }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-orange-400 hover:text-orange-500 transition-all h-11 text-sm"
                        >
                            <Tag className="w-4 h-4" /> Categorías
                        </button>
                        <Button
                            onClick={onAddProduct}
                            className="flex items-center gap-2 bg-primary hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all h-11 text-sm"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Producto
                        </Button>
                    </>
                )}
            </div>
        </header>
    );
}
