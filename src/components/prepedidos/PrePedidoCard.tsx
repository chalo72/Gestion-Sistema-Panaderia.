import { Store, Package, ArrowRight, Trash2, Fingerprint, Activity, TrendingUp, History, ShoppingCart } from 'lucide-react';
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

    const theme = (() => {
        switch (pedido.estado) {
            case 'confirmado': return {
                bg: 'bg-emerald-50 dark:bg-emerald-950/20',
                border: 'border-emerald-200 dark:border-emerald-900/40',
                text: 'text-emerald-600 dark:text-emerald-400',
                badge: 'bg-emerald-600 text-white',
            };
            case 'rechazado': return {
                bg: 'bg-rose-50 dark:bg-rose-950/20',
                border: 'border-rose-200 dark:border-rose-900/40',
                text: 'text-rose-600 dark:text-rose-400',
                badge: 'bg-rose-600 text-white',
            };
            default: return {
                bg: 'bg-amber-50 dark:bg-amber-950/20',
                border: 'border-amber-200 dark:border-amber-900/40',
                text: 'text-amber-600 dark:text-amber-400',
                badge: 'bg-amber-600 text-white',
            };
        }
    })();

    return (
        <Card
            className={cn(
                "group relative overflow-hidden border bg-white dark:bg-slate-900 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer",
                theme.border
            )}
            onClick={onClick}
        >
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:rotate-12 transition-transform duration-700">
                <ShoppingCart className="w-24 h-24" />
            </div>

            <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="relative shrink-0">
                            <div className={cn("absolute inset-0 blur-lg opacity-20", theme.badge)} />
                            <div className="relative w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                <Store className={cn("w-6 h-6", theme.text)} />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-lg uppercase tracking-tight text-slate-800 dark:text-white truncate">{pedido.nombre}</h3>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                    {proveedor?.nombre || 'Alianza sin definir'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Badge className={cn("text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border-none", theme.badge)}>
                        {pedido.estado}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 transition-colors">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Volumen de Compra</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{pedido.items.length}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Skus</span>
                        </div>
                    </div>
                    <div className={cn("p-3.5 rounded-xl border transition-all", theme.bg, theme.border)}>
                        <span className={cn("text-[8px] font-bold uppercase tracking-widest block mb-1 opacity-60", theme.text)}>Inversión Total</span>
                        <span className={cn("text-xl font-bold tabular-nums tracking-tight block truncate", theme.text)}>{formatCurrency(pedido.total)}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-end px-0.5">
                        <div className="space-y-0.5">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Techo Operativo</p>
                            <p className={cn("text-lg font-bold tabular-nums", excede ? "text-rose-500" : "text-emerald-500")}>
                                {porcentaje.toFixed(1)}% <span className="text-[8px] font-semibold opacity-40 ml-1">CAPACIDAD</span>
                            </p>
                        </div>
                        <div className="text-right">
                             <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formatCurrency(pedido.presupuestoMaximo)}</span>
                        </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                        <Progress
                            value={Math.min(porcentaje, 100)}
                            className={cn(
                                "h-full transition-all duration-700",
                                excede ? "bg-rose-500" : "bg-indigo-500"
                            )}
                        />
                    </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-2">
                        {pedido.estado === 'rechazado' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                onClick={(e) => { e.stopPropagation(); onDelete(pedido.id); }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        {pedido.estado === 'confirmado' && (
                             <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                                 <History className="w-3.5 h-3.5" />
                                 <span className="text-[8px] font-bold uppercase tracking-widest">Ejecutado</span>
                             </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                        Ver Detalles <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
