import { Zap, LayoutGrid, X, Users, Plus, LogOut, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pestaña activa en el POS
export interface TabPOS {
    id: string; // 'venta-rapida' o mesaId
    label: string; // 'Venta Rápida' o 'Mesa 1'
    tipo: 'venta-rapida' | 'mesa';
    mesaId?: string;
}

interface POSHeaderProps {
    viewMode: 'pos' | 'mesas';
    setViewMode: (mode: 'pos' | 'mesas') => void;
    formatCurrency: (value: number) => string;
    // Props para pestañas
    tabs: TabPOS[];
    activeTabId: string;
    onSelectTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onAddVentaRapida: () => void;
    // Acciones de caja (opcionales)
    cajaActiva?: boolean;
    onCerrarCaja?: () => void;
    onMovimientoEntrada?: () => void;
    onMovimientoSalida?: () => void;
}

export function POSHeader({
    viewMode, setViewMode,
    tabs, activeTabId, onSelectTab, onCloseTab, onAddVentaRapida,
    cajaActiva, onCerrarCaja, onMovimientoEntrada, onMovimientoSalida
}: POSHeaderProps) {
    return (
        <div className="flex flex-col gap-1 py-1 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3">
            {/* Header de Operación Ultra-Compacto */}
            <div className="flex items-center gap-2 justify-between">
                {/* Botones de gestión de caja - primero */}
                {cajaActiva && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onMovimientoEntrada}
                            className="h-8 px-2 rounded-lg flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-all"
                            title="Entrada de caja"
                        >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Entrada</span>
                        </button>
                        <button
                            onClick={onMovimientoSalida}
                            className="h-8 px-2 rounded-lg flex items-center gap-1 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-all"
                            title="Salida de caja"
                        >
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Salida</span>
                        </button>
                        <button
                            onClick={onCerrarCaja}
                            className="h-8 px-2 rounded-lg flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                            title="Cerrar caja"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Cerrar Caja</span>
                        </button>
                    </div>
                )}

                {/* Separador vertical sutil */}
                {cajaActiva && <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />}

                {/* Botón de Mesas */}
                <button
                    onClick={() => setViewMode(viewMode === 'mesas' ? 'pos' : 'mesas')}
                    className={cn(
                        "h-8 px-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-sm border shrink-0",
                        viewMode === 'mesas'
                            ? "bg-indigo-600 text-white border-indigo-700 font-bold"
                            : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700"
                    )}
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tight">Mesas</span>
                </button>

                {/* Separador antes de pestañas */}
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

                {/* Cinta de Pestañas de Venta - Muy pequeña */}
                {tabs.length > 0 && (
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {tabs.map(tab => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <div key={tab.id} className="relative shrink-0 group">
                                    <button
                                        onClick={() => onSelectTab(tab.id)}
                                        className={cn(
                                            "flex items-center gap-2 h-8 px-3 rounded-lg transition-all active:scale-95 border-b-2",
                                            isActive
                                                ? tab.tipo === 'venta-rapida'
                                                    ? "bg-white dark:bg-slate-800 text-emerald-600 border-emerald-500 shadow-sm"
                                                    : "bg-white dark:bg-slate-800 text-blue-600 border-blue-500 shadow-sm"
                                                : "bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 border-transparent hover:bg-slate-100/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded flex items-center justify-center transition-all",
                                            isActive
                                                ? tab.tipo === 'venta-rapida' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                                                : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                                        )}>
                                            {tab.tipo === 'venta-rapida' ? <Zap className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                        </div>

                                        <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">
                                            {tab.label}
                                        </span>

                                        {/* Botón de Cerrar Pestaña siempre visible */}
                                        {((tab.id !== 'venta-rapida') || (tabs.filter(t => t.tipo === 'venta-rapida').length > 1)) && (
                                            <span
                                                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                                                className={cn(
                                                    "w-5 h-5 rounded-full flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-500 ml-1 shadow-sm active:scale-90"
                                                )}
                                            >
                                                <X className="w-3 h-3" />
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}

                        {/* Botón Nueva Venta (+) Pequeño */}
                        <button
                            onClick={onAddVentaRapida}
                            className="w-8 h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 hover:text-emerald-500 hover:border-emerald-500 active:bg-emerald-50 transition-all flex items-center justify-center shrink-0"
                            title="Nueva Venta Rápida"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
