import React from 'react';
import { Trash2, TrendingUp, TrendingDown, Store, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PrecioProveedor, Proveedor } from '@/types';

interface ProductPriceItemProps {
    precio: PrecioProveedor;
    proveedor: Proveedor | undefined;
    utilidad: number;
    esMejorPrecio: boolean;
    onDelete: (id: string) => void;
    formatCurrency: (val: number) => string;
}

export function ProductPriceItem({
    precio,
    proveedor,
    utilidad,
    esMejorPrecio,
    onDelete,
    formatCurrency
}: ProductPriceItemProps) {
    return (
        <div className={cn(
            "flex items-center justify-between p-6 rounded-3xl transition-all border",
            esMejorPrecio
                ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 shadow-md"
                : "bg-white dark:bg-gray-900/60 border-slate-100 dark:border-gray-800"
        )}>
            <div className="flex-1 flex items-center gap-6">
                <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs",
                    esMejorPrecio ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 dark:bg-gray-800 text-slate-400"
                )}>
                    <Store className="w-6 h-6" />
                </div>
                <div>
                    <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg leading-none">{proveedor?.nombre || 'Aliado Desconocido'}</p>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">ID: {precio.proveedorId.substring(0, 8)}</span>
                        {precio.notas && (
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-slate-200 text-slate-400">
                                {precio.notas}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-10">
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-0.5">Precio Costo</p>
                    <p className={cn("text-xl font-black tabular-nums tracking-tighter", esMejorPrecio ? "text-blue-600" : "text-slate-600 dark:text-gray-400")}>
                        {formatCurrency(precio.precioCosto)}
                    </p>
                </div>

                <div className="text-right min-w-[100px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-0.5">Rentabilidad</p>
                    <div className="flex items-center justify-end gap-2">
                        {utilidad >= 20 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
                        <span className={cn(
                            "font-black text-lg tracking-tighter",
                            utilidad >= 30 ? "text-emerald-500" : utilidad >= 15 ? "text-indigo-500" : "text-rose-500"
                        )}>
                            {utilidad.toFixed(0)}%
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-gray-800 text-rose-600 hover:bg-rose-100 transition-all border border-transparent hover:border-rose-200"
                    onClick={() => onDelete(precio.id)}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
