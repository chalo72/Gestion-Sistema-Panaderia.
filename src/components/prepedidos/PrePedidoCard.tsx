import React from 'react';
import { ShoppingCart, Store, Package, Calculator, ArrowRight, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PrePedido, Proveedor } from '@/types';

interface PrePedidoCardProps {
    pedido: PrePedido;
    proveedor: Proveedor | undefined;
    formatCurrency: (val: number) => string;
    onClick: () => void;
    onDelete: (id: string) => void;
}

export function PrePedidoCard({
    pedido,
    proveedor,
    formatCurrency,
    onClick,
    onDelete
}: PrePedidoCardProps) {
    const porcentaje = (pedido.total / (pedido.presupuestoMaximo || 1)) * 100;
    const excede = pedido.total > pedido.presupuestoMaximo;

    const getStatusColor = () => {
        switch (pedido.estado) {
            case 'confirmado': return 'bg-emerald-500 text-white';
            case 'rechazado': return 'bg-rose-500 text-white';
            default: return 'bg-amber-500 text-white';
        }
    };

    return (
        <Card
            className="group relative overflow-hidden border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 cursor-pointer border border-white/20 dark:border-gray-800/30"
            onClick={onClick}
        >
            <div className="absolute top-6 right-6 z-10">
                <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border-none shadow-lg", getStatusColor())}>
                    {pedido.estado}
                </Badge>
            </div>

            <CardContent className="p-8 pt-10">
                <div className="flex items-start gap-5 mb-8">
                    <div className="w-14 h-14 bg-white/60 dark:bg-gray-800/60 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Store className="w-7 h-7 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-xl uppercase tracking-tighter text-slate-800 dark:text-white line-clamp-1 mb-1">{pedido.nombre}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Store className="w-3.5 h-3.5" /> {proveedor?.nombre || 'Proveedor Desconocido'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-gray-900/50 shadow-inner">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ítems</span>
                        <span className="text-xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter">{pedido.items.length} Sku</span>
                    </div>
                    <div className="p-4 rounded-3xl bg-indigo-50/50 dark:bg-indigo-900/20 shadow-inner">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Total</span>
                        <span className="text-xl font-black text-indigo-600 tabular-nums tracking-tighter">{formatCurrency(pedido.total)}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">Presupuesto Ejecutado</p>
                            <p className={cn("text-lg font-black tracking-tighter", excede ? "text-rose-500" : "text-emerald-500")}>
                                {porcentaje.toFixed(1)}%
                            </p>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Max: {formatCurrency(pedido.presupuestoMaximo)}</p>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <Progress
                            value={Math.min(porcentaje, 100)}
                            className={cn("h-full transition-all duration-1000", excede ? "bg-rose-500" : "bg-emerald-500")}
                        />
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex gap-2">
                        {pedido.estado === 'rechazado' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50"
                                onClick={(e) => { e.stopPropagation(); onDelete(pedido.id); }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 group-hover:gap-3 transition-all">
                        Detallar Gestión <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </CardContent>

            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-indigo-400/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
    );
}
