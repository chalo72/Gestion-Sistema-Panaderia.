import React from 'react';
import { ClipboardList, MapPin, CheckCircle, TrendingDown, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MovimientoInventario } from '@/types';

interface InventoryTableProps {
    items: any[];
    movimientos: MovimientoInventario[];
    onAjustarStock: (id: string, tipo: 'entrada' | 'salida') => void;
    checkPermission: (perm: string) => boolean;
}

export function InventoryTable({
    items,
    movimientos,
    onAjustarStock,
    checkPermission,
}: InventoryTableProps) {
    const statusConfig = {
        ok:      { label: 'Saludable',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle  },
        bajo:    { label: 'Bajo Stock', color: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',  icon: TrendingDown  },
        agotado: { label: 'Agotado',    color: 'bg-rose-100   text-rose-700   dark:bg-rose-900/30   dark:text-rose-400',   icon: AlertTriangle },
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
            {/* Header de la tabla */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                    <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Gestión Operativa
                </h3>
                <Badge className="ml-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-[10px] px-2.5 py-0.5 rounded-lg border-none">
                    {items.length} SKUs
                </Badge>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <th className="px-6 py-3 text-left font-black uppercase tracking-widest text-slate-500">Producto</th>
                            <th className="px-6 py-3 text-left font-black uppercase tracking-widest text-slate-500">Categoría</th>
                            <th className="px-6 py-3 text-center font-black uppercase tracking-widest text-slate-500">Existencias</th>
                            <th className="px-6 py-3 text-center font-black uppercase tracking-widest text-slate-500">Estado</th>
                            {checkPermission('GESTIONAR_INVENTARIO') && (
                                <th className="px-6 py-3 text-right font-black uppercase tracking-widest text-slate-500">Acciones</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {items.map((item) => {
                            const conf = statusConfig[item.status as keyof typeof statusConfig] ?? statusConfig.ok;
                            const Icon = conf.icon;

                            // Predicción de días restantes
                            const movs = movimientos.filter(m => m.productoId === item.productoId && m.tipo === 'salida');
                            const consumoPromedio = movs.length >= 3 ? movs.reduce((a, b) => a + b.cantidad, 0) / 30 : 0;
                            const diasRestantes = consumoPromedio > 0 ? item.stockActual / consumoPromedio : Infinity;
                            const enRiesgo = diasRestantes < 7 && item.status === 'ok';

                            return (
                                <tr
                                    key={item.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                                >
                                    {/* Producto */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">
                                                    {item.producto!.nombre}
                                                </span>
                                                {enRiesgo && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black animate-pulse uppercase tracking-widest">
                                                        <AlertTriangle className="w-2.5 h-2.5" /> Reponer pronto
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <MapPin className="w-3 h-3 shrink-0" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                                    {item.ubicacion || 'Bodega Principal'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Categoría */}
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-indigo-200/60 dark:border-indigo-800/40 text-indigo-600/80 dark:text-indigo-400/80">
                                            {item.producto!.categoria}
                                        </Badge>
                                    </td>

                                    {/* Existencias */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={cn(
                                                'text-2xl font-black tabular-nums tracking-tighter',
                                                item.status === 'ok'      ? 'text-slate-900 dark:text-white'
                                                : item.status === 'bajo'  ? 'text-amber-500'
                                                :                           'text-rose-600'
                                            )}>
                                                {item.stockActual}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Mín: {item.stockMinimo}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Estado */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className={cn(
                                                'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest',
                                                conf.color
                                            )}>
                                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                                {conf.label}
                                            </div>
                                            {consumoPromedio > 0 && item.stockActual > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400 italic">
                                                    ~{Math.round(diasRestantes)} días
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Acciones */}
                                    {checkPermission('GESTIONAR_INVENTARIO') && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-9 w-9 rounded-xl border-emerald-200 dark:border-emerald-800/40 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                                                    onClick={() => onAjustarStock(item.productoId, 'entrada')}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-9 w-9 rounded-xl border-rose-200 dark:border-rose-800/40 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all"
                                                    onClick={() => onAjustarStock(item.productoId, 'salida')}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-16 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <ClipboardList className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="font-black uppercase tracking-widest text-xs text-slate-400">
                                            Sin registros que coincidan
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
