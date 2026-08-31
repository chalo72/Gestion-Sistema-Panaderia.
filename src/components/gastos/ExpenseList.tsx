import { useState } from 'react';
import {
    Search, Tag, Trash2, Calendar, FileText, Clock, Folder,
    Briefcase, Users, Settings, Plus, Pencil, TrendingDown,
    TrendingUp, Banknote, CreditCard, Smartphone, Building2,
    AlertTriangle, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Gasto, Proveedor } from '@/types';
import { normalizarCategoriaGasto } from '@/lib/gasto-categoria-inferencia';
import {
  agruparGastosPorDiaYProveedor,
  idGastoAccion,
  parseDescripcionLineaGasto,
  etiquetaUnidades,
  type GastoLineaLista,
} from '@/lib/gastos-agrupacion';

// ── Configuración de categorías ──────────────────────────────────────────────
const CATEGORIAS_GASTOS = [
    { value: 'Servicios',     label: 'Servicios',     icon: Clock,     color: 'blue'   },
    { value: 'Materia Prima', label: 'Insumos',       icon: Briefcase, color: 'indigo' },
    { value: 'Arriendo',      label: 'Local',         icon: Folder,    color: 'amber'  },
    { value: 'Nómina',        label: 'Nómina',        icon: Users,     color: 'violet' },
    { value: 'Mantenimiento', label: 'Mantenim.',     icon: Settings,  color: 'cyan'   },
    { value: 'Otros',         label: 'Otros',         icon: Plus,      color: 'slate'  },
];

const CAT_COLOR_MAP: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
};

// ── Método de pago ────────────────────────────────────────────────────────────
const METODO_CONFIG: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
    efectivo:      { icon: Banknote,    label: 'Efectivo',      cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
    tarjeta:       { icon: CreditCard,  label: 'Datáfono',      cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'             },
    transferencia: { icon: Building2,   label: 'Transferencia', cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'     },
    nequi:         { icon: Smartphone,  label: 'Nequi',         cls: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300' },
    daviplata:     { icon: Smartphone,  label: 'Daviplata',     cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'     },
};
const metodoFallback = { icon: Banknote, label: 'Efectivo', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDayLabel(fechaStr: string): string {
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    const d = new Date(fechaStr + 'T12:00:00');
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExpenseListProps {
    gastos: (Gasto & { esIngreso?: boolean })[];
    searchTerm: string;
    setSearchTerm: (t: string) => void;
    selectedCategory: string | null;
    setSelectedCategory: (c: string | null) => void;
    onDeleteGasto: (id: string) => void;
    onEditGasto: (g: Gasto & { esIngreso?: boolean }) => void;
    formatCurrency: (v: number) => string;
    proveedores?: Proveedor[];
}

export function ExpenseList({
    gastos,
    searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory,
    onDeleteGasto, onEditGasto,
    formatCurrency,
    proveedores = [],
}: ExpenseListProps) {
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const toggleDay = (fecha: string) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(fecha)) next.delete(fecha);
            else next.add(fecha);
            return next;
        });
    };

    const grupos = agruparGastosPorDiaYProveedor(
        gastos,
        (g) => (g.esIngreso ? 1 : -1)
    );

    const provNombre = (id?: string) =>
        id ? (proveedores.find(p => p.id === id)?.nombre ?? null) : null;

    return (
        <div className="space-y-5">
            {/* ── Barra de búsqueda + filtros ── */}
            <div className="space-y-3">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                    <Input
                        placeholder="Buscar por descripción, proveedor o ítem..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                            'shrink-0 h-8 px-4 rounded-xl font-black uppercase tracking-widest text-[9px] border transition-all',
                            selectedCategory === null
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600'
                        )}
                    >
                        Todos
                    </button>
                    {CATEGORIAS_GASTOS.map(cat => {
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}
                                className={cn(
                                    'shrink-0 h-8 px-3 rounded-xl font-black uppercase tracking-widest text-[9px] border transition-all flex items-center gap-1.5',
                                    selectedCategory === cat.value
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600'
                                )}
                            >
                                <Icon className="w-3 h-3" />
                                {cat.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Timeline agrupado por día ── */}
            {grupos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700">
                    <Tag className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin registros en este período</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grupos.map((grupo) => {
                        const { fecha, proveedores: provsDia, sinProveedor, totalDia } = grupo;
                        const label = formatDayLabel(fecha);
                        const numLineas =
                            provsDia.reduce((n, p) => n + p.lineas.length, 0) + sinProveedor.length;

                        const renderGasto = (gasto: GastoLineaLista) => {
                            const accionId = idGastoAccion(gasto);
                            const catNorm = normalizarCategoriaGasto(gasto.categoria as string);
                            const catInfo = CATEGORIAS_GASTOS.find(c => c.value === catNorm) ?? CATEGORIAS_GASTOS[5];
                            const Icon = catInfo.icon;
                            const metodo = METODO_CONFIG[gasto.metodoPago as string] ?? metodoFallback;
                            const MetIcon = metodo.icon;
                            const prov = provNombre(gasto.proveedorId);
                            const esIngreso = !!gasto.esIngreso;

                            const { cantidad, nombre: descClean } = parseDescripcionLineaGasto(gasto.descripcion);
                            const etiquetaQty = etiquetaUnidades(cantidad);

                            return (
                                <div
                                    key={gasto.id}
                                    className={cn(
                                        'group relative bg-white dark:bg-slate-900 rounded-xl border shadow-sm mb-2',
                                        'hover:shadow-md transition-all duration-200',
                                        esIngreso
                                            ? 'border-l-4 border-l-emerald-400 border-slate-100 dark:border-slate-800'
                                            : 'border-l-4 border-l-rose-400 border-slate-100 dark:border-slate-800'
                                    )}
                                >
                                    <div className="flex items-center gap-3 p-3.5">
                                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', CAT_COLOR_MAP[catInfo.color])}>
                                            {esIngreso ? <TrendingUp className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <p className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">
                                                    {descClean}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {esIngreso ? 'Ingreso' : catInfo.label}
                                                </span>
                                                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider', metodo.cls)}>
                                                    <MetIcon className="w-2.5 h-2.5" />
                                                    {metodo.label}
                                                </span>
                                                {prov && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                                        <FileText className="w-2.5 h-2.5" />
                                                        {prov}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {etiquetaQty && (
                                                <span
                                                    className="min-w-[58px] text-center shrink-0 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-1.5 rounded-lg uppercase tracking-wider border border-indigo-200/80 dark:border-indigo-700/50"
                                                    title="Unidades compradas"
                                                >
                                                    {etiquetaQty}
                                                </span>
                                            )}
                                            <div className="flex flex-col items-end">
                                                <p className={cn('text-base font-black tabular-nums leading-none',
                                                    esIngreso ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                                                    {esIngreso ? '+' : '-'}{formatCurrency(gasto.monto)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditGasto({ ...gasto, id: accionId }); }}
                                                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(gasto.id); }}
                                                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    {confirmDelete === gasto.id && (
                                        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl flex items-center justify-between px-4 z-10 border border-rose-200 dark:border-rose-800">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                                    {gasto.esLineaFactura ? '¿Eliminar factura completa?' : '¿Eliminar este registro?'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all uppercase tracking-widest">
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => { onDeleteGasto(accionId); setConfirmDelete(null); }}
                                                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-[10px] font-black text-white hover:bg-rose-700 transition-all uppercase tracking-widest"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        return (
                            <div key={fecha} className="space-y-2">
                                <div
                                    onClick={() => toggleDay(fecha)}
                                    className="flex items-center justify-between px-3 py-2 mb-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Calendar className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-400" />
                                        <span className="text-xs shrink-0 font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 capitalize">
                                            {label}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400 shrink-0 text-[10px] ml-1">
                                            {expandedDays.has(fecha) ? '▼' : '▶'} · {numLineas} gastos
                                        </span>
                                    </div>
                                    <span className={cn(
                                        'text-[10px] font-black tabular-nums',
                                        totalDia >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    )}>
                                        {totalDia >= 0 ? '+' : ''}{formatCurrency(totalDia)}
                                    </span>
                                </div>

                                {expandedDays.has(fecha) && (
                                    <div className="space-y-4 mt-4">
                                        {provsDia.map((bloque) => {
                                            const provName = provNombre(bloque.proveedorId) || 'Proveedor';
                                            return (
                                                <div key={bloque.proveedorId} className="mb-4 last:mb-0">
                                                    <div className="flex items-center justify-between mb-2 pl-2 border-l-2 border-indigo-400">
                                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                                            <Briefcase className="w-3.5 h-3.5" /> {provName}
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            {bloque.lineas.length} ítem{bloque.lineas.length !== 1 ? 's' : ''} · {formatCurrency(bloque.total)}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {bloque.lineas.map((gasto) => renderGasto(gasto))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {sinProveedor.length > 0 && (
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between mb-2 pl-2 border-l-2 border-rose-400">
                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                        <Tag className="w-3.5 h-3.5 text-rose-500" /> Sin proveedor
                                                    </h4>
                                                </div>
                                                <div className="space-y-2">
                                                    {sinProveedor.map((gasto) => renderGasto(gasto))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 flex justify-end">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl flex flex-col items-end">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total del día</span>
                                                <span className={cn('text-lg font-black tabular-nums', totalDia >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                                                    {totalDia >= 0 ? '+' : ''}{formatCurrency(totalDia)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}



