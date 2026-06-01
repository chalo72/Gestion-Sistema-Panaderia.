import { useState } from 'react';
import { Zap, LayoutGrid, X, Users, Plus, LogOut, ArrowUpCircle, ArrowDownCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendedoraQuickPicker, type VendedoraOption } from './VendedoraQuickPicker';

export interface TabPOS {
    id: string;
    label: string;
    tipo: 'venta-rapida' | 'mesa';
    mesaId?: string;
    abiertaPor?: string;
}

interface POSHeaderProps {
    viewMode: 'pos' | 'mesas';
    setViewMode: (mode: 'pos' | 'mesas') => void;
    formatCurrency: (value: number) => string;
    tabs: TabPOS[];
    activeTabId: string;
    onSelectTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onAddVentaRapida: () => void;
    cajaActiva?: boolean;
    onCerrarCaja?: () => void;
    onMovimientoEntrada?: () => void;
    onMovimientoSalida?: () => void;
    // Props para vendedora (solo en móvil)
    vendedoras?: VendedoraOption[];
    vendedoraActivaId?: string | null;
    onSelectVendedora?: (v: VendedoraOption | null) => void;
}

export function POSHeader({
    viewMode, setViewMode,
    tabs, activeTabId, onSelectTab, onCloseTab, onAddVentaRapida,
    cajaActiva, onCerrarCaja, onMovimientoEntrada, onMovimientoSalida,
    vendedoras = [], vendedoraActivaId = null, onSelectVendedora,
}: POSHeaderProps) {
    const [panelOpen, setPanelOpen] = useState(false);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeVendedora = vendedoras.find(v => v.id === vendedoraActivaId);

    const handleSelectTab = (tabId: string) => {
        onSelectTab(tabId);
        setPanelOpen(false);
    };

    const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        onCloseTab(tabId);
    };

    return (
        <>
            {/* ══════════════════════════════════════════
                DESKTOP — pestañas horizontales (≥ lg)
            ══════════════════════════════════════════ */}
            <div className="hidden lg:flex flex-col gap-1 py-1 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3">
                <div className="flex items-center gap-2 justify-between">
                    {cajaActiva && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={onMovimientoEntrada} className="h-8 px-2 rounded-lg flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-all" title="Entrada de caja">
                                <ArrowUpCircle className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Entrada</span>
                            </button>
                            <button onClick={onMovimientoSalida} className="h-8 px-2 rounded-lg flex items-center gap-1 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-all" title="Salida de caja">
                                <ArrowDownCircle className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Salida</span>
                            </button>
                            <button onClick={onCerrarCaja} className="h-8 px-2 rounded-lg flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all" title="Cerrar caja">
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Cerrar Caja</span>
                            </button>
                        </div>
                    )}
                    {cajaActiva && <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />}
                    <button
                        onClick={() => setViewMode(viewMode === 'mesas' ? 'pos' : 'mesas')}
                        className={cn("h-8 px-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-sm border shrink-0",
                            viewMode === 'mesas' ? "bg-indigo-600 text-white border-indigo-700 font-bold" : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700"
                        )}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Mesas</span>
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {tabs.map(tab => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <div key={tab.id} className="relative shrink-0 group">
                                    <button
                                        onClick={() => onSelectTab(tab.id)}
                                        className={cn("flex items-center gap-2 h-8 px-3 rounded-lg transition-all active:scale-95 border-b-2",
                                            isActive
                                                ? tab.tipo === 'venta-rapida' ? "bg-white dark:bg-slate-800 text-emerald-600 border-emerald-500 shadow-sm" : "bg-white dark:bg-slate-800 text-blue-600 border-blue-500 shadow-sm"
                                                : "bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 border-transparent hover:bg-slate-100/50"
                                        )}
                                    >
                                        <div className={cn("w-5 h-5 rounded flex items-center justify-center transition-all",
                                            isActive ? tab.tipo === 'venta-rapida' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                                        )}>
                                            {tab.tipo === 'venta-rapida' ? <Zap className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                        </div>
                                        <span className="flex flex-col leading-none">
                                            <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">{tab.label}</span>
                                            {tab.abiertaPor && <span className="text-[8px] font-semibold text-slate-400 whitespace-nowrap normal-case tracking-normal">{tab.abiertaPor}</span>}
                                        </span>
                                        {((tab.id !== 'venta-rapida') || (tabs.filter(t => t.tipo === 'venta-rapida').length > 1)) && (
                                            <span onClick={(e) => handleCloseTab(e, tab.id)} className="w-5 h-5 rounded-full flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-500 ml-1 shadow-sm active:scale-90">
                                                <X className="w-3 h-3" />
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                        <button onClick={onAddVentaRapida} className="w-8 h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 hover:text-emerald-500 hover:border-emerald-500 active:bg-emerald-50 transition-all flex items-center justify-center shrink-0" title="Nueva Venta Rápida">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                MÓVIL / TABLET — botón activo + panel
            ══════════════════════════════════════════ */}
            <div className="flex lg:hidden flex-col border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">

                {/* Fila principal */}
                <div className="flex items-center gap-2 px-3 py-2">
                    {/* Caja — iconos compactos */}
                    {cajaActiva && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={onMovimientoEntrada} className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 active:scale-95 transition-all" title="Entrada">
                                <ArrowUpCircle className="w-4 h-4" />
                            </button>
                            <button onClick={onMovimientoSalida} className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 active:scale-95 transition-all" title="Salida">
                                <ArrowDownCircle className="w-4 h-4" />
                            </button>
                            <button onClick={onCerrarCaja} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 active:scale-95 transition-all" title="Cerrar caja">
                                <LogOut className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                        </div>
                    )}

                    {/* Botón activo — toca para abrir panel */}
                    <button
                        onClick={() => setPanelOpen(true)}
                        className="flex-1 flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-all"
                    >
                        <div className={cn(
                            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white",
                            activeTab?.tipo === 'venta-rapida' ? "bg-emerald-500" : "bg-blue-500"
                        )}>
                            {activeTab?.tipo === 'venta-rapida' ? <Zap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-white truncate leading-tight">
                                {activeTab?.label ?? 'Venta Rápida'}
                            </p>
                            {activeVendedora ? (
                                <p className="text-[10px] font-bold text-orange-500 truncate leading-tight">
                                    {activeVendedora.nombre.split(' ')[0]} — asignada
                                </p>
                            ) : (
                                <p className="text-[10px] font-medium text-slate-400 truncate leading-tight">
                                    Por Venta (automático)
                                </p>
                            )}
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        {tabs.length > 1 && (
                            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                {tabs.length}
                            </span>
                        )}
                    </button>

                    {/* Mesas */}
                    <button
                        onClick={() => setViewMode(viewMode === 'mesas' ? 'pos' : 'mesas')}
                        className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all active:scale-95 shrink-0",
                            viewMode === 'mesas' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                        )}
                        title="Mesas"
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                PANEL DESLIZANTE (móvil)
            ══════════════════════════════════════════ */}
            {panelOpen && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                        onClick={() => setPanelOpen(false)}
                    />

                    {/* Panel desde abajo */}
                    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom duration-200">

                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        </div>

                        <div className="px-4 pb-6 pt-2 max-h-[80vh] overflow-y-auto">

                            {/* Título */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                                    Ventas activas
                                </h3>
                                <button onClick={() => setPanelOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 active:scale-95">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Nueva venta rápida */}
                            <button
                                onClick={() => { onAddVentaRapida(); setPanelOpen(false); }}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-[0.98] transition-all mb-3"
                            >
                                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-sm font-black">Nueva Venta Rápida</span>
                            </button>

                            {/* Lista de pestañas */}
                            <div className="space-y-2 mb-5">
                                {tabs.map(tab => {
                                    const isActive = tab.id === activeTabId;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleSelectTab(tab.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.98]",
                                                isActive
                                                    ? tab.tipo === 'venta-rapida'
                                                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                                        : "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                                    : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white",
                                                isActive
                                                    ? tab.tipo === 'venta-rapida' ? "bg-emerald-500" : "bg-blue-500"
                                                    : "bg-slate-300 dark:bg-slate-600"
                                            )}>
                                                {tab.tipo === 'venta-rapida' ? <Zap className="w-4.5 h-4.5" /> : <Users className="w-4.5 h-4.5" />}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className={cn("text-sm font-black", isActive ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
                                                    {tab.label}
                                                </p>
                                                {tab.abiertaPor && (
                                                    <p className="text-[11px] text-slate-400 font-medium">{tab.abiertaPor}</p>
                                                )}
                                            </div>
                                            {isActive && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                                                    activa
                                                </span>
                                            )}
                                            {((tab.id !== 'venta-rapida') || (tabs.filter(t => t.tipo === 'venta-rapida').length > 1)) && (
                                                <button
                                                    onClick={(e) => handleCloseTab(e, tab.id)}
                                                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 flex items-center justify-center transition-all active:scale-90 shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selector de trabajadora */}
                            {vendedoras.length > 0 && onSelectVendedora && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                        ¿Quién está vendiendo?
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {vendedoras.map(v => {
                                            const isActiva = v.id === vendedoraActivaId;
                                            const initials = v.nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
                                            const colors = ['bg-orange-500','bg-blue-500','bg-emerald-500','bg-violet-500','bg-rose-500','bg-amber-500','bg-teal-500','bg-pink-500'];
                                            let hash = 0;
                                            for (let i = 0; i < v.nombre.length; i++) hash = v.nombre.charCodeAt(i) + ((hash << 5) - hash);
                                            const color = colors[Math.abs(hash) % colors.length];

                                            return (
                                                <button
                                                    key={v.id}
                                                    onClick={() => { onSelectVendedora(isActiva ? null : v); }}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all active:scale-95",
                                                        isActiva
                                                            ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                                                            : "border-slate-100 dark:border-slate-800 hover:border-slate-300"
                                                    )}
                                                >
                                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm relative", color)}>
                                                        {initials}
                                                        {isActiva && (
                                                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-white animate-pulse" />
                                                        )}
                                                    </div>
                                                    <span className={cn("text-[11px] font-black truncate w-full text-center", isActiva ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-slate-400")}>
                                                        {v.nombre.split(' ')[0]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
