import React from 'react';
import { Package, Store, ArrowRightLeft, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Producto, PrecioProveedor, Proveedor } from '@/types';

interface PrecioComparisonProps {
    productos: Producto[];
    precios: PrecioProveedor[];
    getProveedorById: (id: string) => Proveedor | undefined;
    formatCurrency: (val: number) => string;
}

export function PrecioComparison({
    productos,
    precios,
    getProveedorById,
    formatCurrency
}: PrecioComparisonProps) {
    const getComparacion = (productoId: string) => {
        const preciosProducto = precios.filter(p => p.productoId === productoId);
        if (preciosProducto.length < 2) return null;

        const ordenados = [...preciosProducto].sort((a, b) => a.precioCosto - b.precioCosto);
        const masBarato = ordenados[0];
        const masCaro = ordenados[ordenados.length - 1];
        const diferencia = masCaro.precioCosto - masBarato.precioCosto;
        const porcentaje = (diferencia / masBarato.precioCosto) * 100;

        return {
            masBarato,
            masCaro,
            diferencia,
            porcentaje,
            totalProveedores: preciosProducto.length,
        };
    };

    const productosConMultiplesPrecios = productos.filter(p =>
        precios.filter(pr => pr.productoId === p.id).length >= 2
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
            {productosConMultiplesPrecios.length === 0 ? (
                <div className="col-span-full py-40 flex flex-col items-center justify-center opacity-20 text-center">
                    <ArrowRightLeft className="w-24 h-24 mb-6" />
                    <h3 className="text-xl font-black uppercase tracking-[0.3em]">Sin Datos Comparativos</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Registra precios de múltiples proveedores para activar el análisis.</p>
                </div>
            ) : (
                productosConMultiplesPrecios.map((producto) => {
                    const comp = getComparacion(producto.id);
                    if (!comp) return null;

                    const pBarato = getProveedorById(comp.masBarato.proveedorId);
                    const pCaro = getProveedorById(comp.masCaro.proveedorId);

                    return (
                        <Card key={producto.id} className="group relative overflow-hidden border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[3rem] shadow-xl hover:shadow-3xl transition-all duration-500 border border-white/20 dark:border-gray-800/20">
                            <CardContent className="p-8">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                        <Package className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-white truncate">{producto.nombre}</h3>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{producto.categoria}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="p-5 rounded-[2rem] bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center group-hover:scale-[1.02] transition-transform">
                                        <div>
                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Costo Óptimo</span>
                                            <span className="font-black text-xs uppercase text-slate-700 dark:text-emerald-200">{pBarato?.nombre}</span>
                                        </div>
                                        <span className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">{formatCurrency(comp.masBarato.precioCosto)}</span>
                                    </div>

                                    <div className="p-5 rounded-[2rem] bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex justify-between items-center opacity-60">
                                        <div>
                                            <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest block mb-1">Costo Techo</span>
                                            <span className="font-black text-xs uppercase text-slate-700 dark:text-rose-200">{pCaro?.nombre}</span>
                                        </div>
                                        <span className="text-xl font-black text-rose-600 tabular-nums tracking-tighter">{formatCurrency(comp.masCaro.precioCosto)}</span>
                                    </div>
                                </div>

                                <div className="p-6 rounded-[2.5rem] bg-slate-900 dark:bg-black text-white relative overflow-hidden">
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
                                                <ArrowRightLeft className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Brecha de Eficiencia</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-blue-400">{formatCurrency(comp.diferencia)}</p>
                                            <div className="flex items-center justify-end gap-1 text-emerald-400">
                                                <TrendingDown className="w-3 h-3" />
                                                <span className="text-[10px] font-black">Ahorro: {comp.porcentaje.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                </div>

                                <div className="mt-6 flex items-center justify-center gap-2">
                                    <Info className="w-3.5 h-3.5 text-muted-foreground opacity-40" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Muestra: {comp.totalProveedores} Aliados registrados</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            )}
        </div>
    );
}
