import React from 'react';
import { ClipboardList, MapPin, CheckCircle, TrendingDown, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InventarioItem, MovimientoInventario } from '@/types';

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
    checkPermission
}: InventoryTableProps) {
    const statusConfig = {
        ok: { label: 'Saludable', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle },
        bajo: { label: 'Bajo Stock', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: TrendingDown },
        agotado: { label: 'Agotado', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400', icon: AlertTriangle },
    };

    return (
        <Card className="glass-card border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/20">
            <CardHeader className="bg-white/30 dark:bg-gray-800/40 p-8 border-b border-white/10 dark:border-gray-700/30">
                <CardTitle className="text-2xl font-black flex items-center gap-4 text-gray-900 dark:text-white uppercase tracking-tight">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    Gestión Operativa
                    <Badge variant="secondary" className="ml-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-black px-3 py-1 rounded-lg">
                        {items.length} skus
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-950/20 text-left text-muted-foreground uppercase text-[10px] font-black tracking-[0.2em]">
                                <th className="px-8 py-5">Producto</th>
                                <th className="px-8 py-5">Categoría</th>
                                <th className="px-8 py-5 text-center">Existencias</th>
                                <th className="px-8 py-5 text-center">Estado Crítico</th>
                                {checkPermission('GESTIONAR_INVENTARIO') && <th className="px-8 py-5 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                            {items.map((item, idx) => {
                                const conf = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.ok;
                                const Icon = conf.icon;

                                // Lógica predictiva simplificada para visualización
                                const movs = movimientos.filter(m => m.productoId === item.productoId && m.tipo === 'salida');
                                const consumoPromedio = movs.length >= 3 ? movs.reduce((a, b) => a + b.cantidad, 0) / 30 : 0;
                                const diasRestantes = consumoPromedio > 0 ? item.stockActual / consumoPromedio : Infinity;
                                const enRiesgoPredictivo = diasRestantes < 7 && item.status === 'ok';

                                return (
                                    <tr key={item.id} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors animate-ag-fade-in">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-gray-900 dark:text-white text-base group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                                        {item.producto!.nombre}
                                                    </span>
                                                    {enRiesgoPredictivo && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black animate-pulse uppercase tracking-widest">
                                                            <AlertTriangle className="w-3 h-3" /> Reponer Pronto
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground mt-1.5 opacity-60">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">{item.ubicacion || 'Bodega Principal'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border-indigo-200/50 dark:border-indigo-800/30 text-indigo-600/70 dark:text-indigo-400/70">
                                                {item.producto!.categoria}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn(
                                                    "text-2xl font-black tabular-nums tracking-tighter",
                                                    item.status === 'ok' ? 'text-gray-900 dark:text-white' : item.status === 'bajo' ? 'text-amber-500' : 'text-rose-600'
                                                )}>
                                                    {item.stockActual}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest mt-0.5">Mín: {item.stockMinimo}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                                                    conf.color
                                                )}>
                                                    <Icon className="w-3.5 h-3.5" /> {conf.label}
                                                </div>
                                                {consumoPromedio > 0 && item.stockActual > 0 && (
                                                    <span className="text-[10px] font-bold text-muted-foreground italic opacity-50">
                                                        Aprox. {Math.round(diasRestantes)} días
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {checkPermission('GESTIONAR_INVENTARIO') && (
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-10 w-10 rounded-xl border-emerald-200/50 dark:border-emerald-800/30 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-lg hover:shadow-emerald-500/20"
                                                        onClick={() => onAjustarStock(item.productoId, 'entrada')}
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-10 w-10 rounded-xl border-rose-200/50 dark:border-rose-800/30 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-lg hover:shadow-rose-500/20"
                                                        onClick={() => onAjustarStock(item.productoId, 'salida')}
                                                    >
                                                        <Minus className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-24 text-center">
                                        <div className="flex flex-col items-center opacity-30">
                                            <ClipboardList className="w-16 h-16 mb-4" />
                                            <p className="font-black uppercase tracking-[0.2em] text-xs">Sin registros que coincidan</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
