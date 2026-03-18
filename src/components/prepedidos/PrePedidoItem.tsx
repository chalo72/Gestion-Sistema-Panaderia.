import React from 'react';
import { Package, TrendingUp, Minus, Plus, Trash2 } from 'lucide-react';
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

    return (
        <div className="flex items-center gap-6 p-6 bg-white/40 dark:bg-gray-900/40 rounded-[2rem] border border-white/20 dark:border-gray-800/20 group hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                {producto?.imagen ? (
                    <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                    <Package className="w-7 h-7 text-indigo-400 opacity-60" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-white truncate">{producto?.nombre || 'Producto Desconocido'}</h4>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-indigo-100 text-indigo-500 bg-indigo-50/50">
                        {producto?.categoria}
                    </Badge>
                </div>
                <div className="flex items-center gap-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Costo Unitario: <span className="text-slate-900 dark:text-white">{formatCurrency(item.precioUnitario)}</span>
                    </p>
                    {producto && (
                        <div className="flex items-center gap-1">
                            <TrendingUp className="w-3w-3 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase text-emerald-600">Margen: {margen.toFixed(0)}%</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-12">
                {isBorrador ? (
                    <div className="flex items-center bg-white dark:bg-gray-950 p-1.5 rounded-2xl shadow-inner border border-slate-100 dark:border-gray-800">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-slate-50 text-slate-400"
                            onClick={() => onUpdateCantidad(item.id, item.cantidad - 1)}
                            disabled={item.cantidad <= 1}
                        >
                            <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center font-black text-lg tabular-nums tracking-tighter">{item.cantidad}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-slate-50 text-slate-400"
                            onClick={() => onUpdateCantidad(item.id, item.cantidad + 1)}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-0.5">Volumen</p>
                        <p className="font-black text-xl tabular-nums tracking-tighter">{item.cantidad} uds.</p>
                    </div>
                )}

                <div className="text-right min-w-[120px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-0.5">Subtotal Bruto</p>
                    <p className="font-black text-2xl tabular-nums tracking-tighter text-indigo-600">{formatCurrency(item.subtotal)}</p>
                </div>

                {isBorrador && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-rose-100"
                        onClick={() => onRemove(item.id)}
                    >
                        <Trash2 className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
