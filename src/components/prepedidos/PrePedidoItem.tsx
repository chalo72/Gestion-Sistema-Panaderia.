import { Package, TrendingUp, Minus, Plus, Trash2, Zap, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Producto } from '@/types';

interface PrePedidoItemProps {
    item: any;
    producto: Producto | undefined;
    formatCurrency: (val: number) => string;
    onUpdateCantidad: (id: string, cant: number) => void;
    onRemove: (id: string) => void;
    isBorrador: boolean;
}

export function PrePedidoItem({
    item,
    producto,
    formatCurrency,
    onUpdateCantidad,
    onRemove,
    isBorrador
}: PrePedidoItemProps) {
    const margen = producto ? ((producto.precioVenta - item.precioUnitario) / item.precioUnitario) * 100 : 0;
    const isBuenMargen = margen > 30;

    return (
        <div className="relative group flex flex-col sm:flex-row items-center gap-5 p-5 bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
            <div className="absolute inset-x-0 h-[1px] bg-indigo-500/10 top-0 group-hover:top-full opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none" />
            
            <div className="shrink-0">
                <div className="relative w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    {producto?.imagen ? (
                        <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-8 h-8 text-slate-400 opacity-40 group-hover:scale-110 transition-transform" />
                    )}
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <h4 className="font-bold text-lg uppercase tracking-tight text-slate-800 dark:text-white truncate">
                        {producto?.nombre || 'Analizando SKU...'}
                    </h4>
                    <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-[0.15em] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-lg">
                        {producto?.categoria || 'Sin Categoría'}
                    </Badge>
                    {isBuenMargen && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                            <Zap className="w-3 h-3 fill-current" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">High Margin</span>
                         </div>
                    )}
                </div>
                
                <div className="flex items-center gap-6 text-slate-400">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-50">Costo Base</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-300 tabular-nums">{formatCurrency(item.precioUnitario)}</span>
                    </div>
                    
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-800" />
                    
                    {producto && (
                        <div className="flex flex-col">
                            <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-50">Rentabilidad</span>
                            <div className="flex items-center gap-1.5">
                                <span className={cn("text-sm font-bold tabular-nums tracking-tight", isBuenMargen ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600")}>
                                    {margen.toFixed(1)}% Yield
                                </span>
                                <TrendingUp className={cn("w-3 h-3", isBuenMargen ? "text-emerald-500" : "text-amber-500")} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8">
                {isBorrador ? (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all"
                            onClick={() => onUpdateCantidad(item.id, item.cantidad - 1)}
                            disabled={item.cantidad <= 1}
                        >
                            <Minus className="w-4 h-4" />
                        </Button>
                        <div className="flex flex-col items-center min-w-[40px]">
                            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">{item.cantidad}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 opacity-50">Vol.</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all"
                            onClick={() => onUpdateCantidad(item.id, item.cantidad + 1)}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-end px-6">
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-0.5">Volumen</p>
                        <p className="font-bold text-xl tabular-nums tracking-tight text-slate-900 dark:text-white">{item.cantidad} <span className="text-[10px] opacity-40 ml-1">UDS</span></p>
                    </div>
                )}

                <div className="flex flex-col items-end min-w-[120px] px-5 py-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/40">
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 mb-0.5 flex items-center gap-1.5">
                        <Activity className="w-2.5 h-2.5" /> Subtotal
                    </p>
                    <p className="font-bold text-xl tabular-nums tracking-tight text-indigo-600 dark:text-indigo-400">{formatCurrency(item.subtotal)}</p>
                </div>

                {isBorrador && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-300"
                        onClick={() => onRemove(item.id)}
                    >
                        <Trash2 className="w-4.5 h-4.5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
