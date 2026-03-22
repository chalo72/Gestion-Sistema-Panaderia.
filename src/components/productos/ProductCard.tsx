import React from 'react';
import { ChefHat, TrendingUp, Edit2, Trash2, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Producto, PrecioProveedor } from '@/types';

interface ProductCardProps {
    producto: Producto;
    mejorPrecio: PrecioProveedor | null;
    utilidad: number;
    categoriaColor: string;
    formatCurrency: (val: number) => string;
    onEdit: (p: Producto) => void;
    onDelete: (id: string) => void;
    onExpand: (id: string) => void;
    checkPermission: (perm: string) => boolean;
}

export function ProductCard({
    producto,
    mejorPrecio,
    utilidad,
    categoriaColor,
    formatCurrency,
    onEdit,
    onDelete,
    onExpand,
    checkPermission
}: ProductCardProps) {
    return (
        <Card
            className="group relative overflow-hidden border-none bg-white/40 dark:bg-gray-950/40 backdrop-blur-2xl rounded-[2.5rem] shadow-xl hover:shadow-3xl transition-all duration-700 hover:-translate-y-4 cursor-pointer border border-white/40 dark:border-gray-800/20 active:scale-95"
            onClick={() => onExpand(producto.id)}
        >
            <div className="h-36 sm:h-48 bg-slate-100 dark:bg-gray-900 relative overflow-hidden">
                {producto.imagen ? (
                    <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-indigo-50 to-orange-50 dark:from-indigo-950/10 dark:to-orange-900/10">
                        <div className="p-6 bg-white/30 rounded-3xl backdrop-blur-md shadow-2xl border border-white/50">
                            <ChefHat className="h-14 w-14 text-orange-600 dark:text-orange-400 opacity-60" />
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="absolute top-4 left-4">
                    <Badge
                        variant="outline"
                        className="text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border-none shadow-glass backdrop-blur-xl"
                        style={{ backgroundColor: `${categoriaColor}aa`, color: '#fff' }}
                    >
                        {producto.categoria}
                    </Badge>
                </div>
            </div>

            <CardContent className="p-5 sm:p-10 pt-5 sm:pt-8">
                <div className="flex items-start justify-between mb-8">
                    <div className="space-y-3">
                        <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-800 dark:text-white line-clamp-1 group-hover:text-amber-600 transition-colors duration-500">{producto.nombre}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50 flex items-center gap-2">
                            ID: {producto.id.slice(0, 8)}
                        </p>
                    </div>
                    <div className="flex gap-2 sm:translate-x-4 sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-500">
                        {checkPermission('EDITAR_PRODUCTOS') && (
                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-gray-800/80 hover:bg-indigo-600 hover:text-white text-indigo-600 transition-all shadow-lg" onClick={(e) => { e.stopPropagation(); onEdit(producto); }}>
                                <Edit2 className="w-4 h-4" />
                            </Button>
                        )}
                        {checkPermission('ELIMINAR_PRODUCTOS') && (
                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-gray-800/80 hover:bg-rose-600 hover:text-white text-rose-500 transition-all shadow-lg" onClick={(e) => { e.stopPropagation(); onDelete(producto.id); }}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="p-5 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/20 shadow-inner group/val">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-2">PVP Actual</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tighter block group-hover/val:scale-105 transition-transform">{formatCurrency(producto.precioVenta)}</span>
                    </div>
                    <div className="p-5 rounded-[2rem] bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100/50 dark:border-orange-800/20 shadow-inner group/val">
                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block mb-2">Mejor Costo</span>
                        <span className="text-2xl font-black text-orange-600 dark:text-orange-400 tabular-nums tracking-tighter block group-hover/val:scale-105 transition-transform">{mejorPrecio ? formatCurrency(mejorPrecio.precioCosto) : '---'}</span>
                    </div>
                </div>

                {mejorPrecio && (
                    <div className="mt-8 flex items-center justify-between p-6 rounded-[2rem] bg-slate-900 dark:bg-black/40 text-white shadow-2xl relative overflow-hidden group/rent">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-transparent opacity-0 group-hover/rent:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className={cn(
                                "p-2.5 rounded-xl shadow-lg",
                                utilidad >= 30 ? "bg-emerald-500" : utilidad >= 15 ? "bg-amber-500" : "bg-rose-500"
                            )}>
                                <TrendingUp className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Rentabilidad</span>
                        </div>
                        <span className={cn(
                            "font-black text-2xl tracking-tighter relative z-10 tabular-nums",
                            utilidad >= 30 ? "text-emerald-400" : utilidad >= 15 ? "text-amber-400" : "text-rose-400"
                        )}>
                            {utilidad.toFixed(1)}%
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
