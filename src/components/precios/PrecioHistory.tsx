import React, { useState } from 'react';
import { History, Filter, TrendingUp, TrendingDown, Clock, Package, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { HistorialPrecio, Producto, Proveedor } from '@/types';

interface PrecioHistoryProps {
    historial: HistorialPrecio[];
    productos: Producto[];
    proveedores: Proveedor[];
    getProductoById: (id: string) => Producto | undefined;
    getProveedorById: (id: string) => Proveedor | undefined;
    formatCurrency: (val: number) => string;
}

export function PrecioHistory({
    historial,
    productos,
    proveedores,
    getProductoById,
    getProveedorById,
    formatCurrency
}: PrecioHistoryProps) {
    const [filtroProducto, setFiltroProducto] = useState<string>('todos');

    const historialFiltrado = filtroProducto === 'todos'
        ? historial
        : historial.filter(h => h.productoId === filtroProducto);

    const subidas = historialFiltrado.filter(h => h.precioNuevo > h.precioAnterior);
    const bajadas = historialFiltrado.filter(h => h.precioNuevo < h.precioAnterior);

    const promedioSubida = subidas.length > 0
        ? subidas.reduce((sum, h) => sum + ((h.precioNuevo - h.precioAnterior) / h.precioAnterior * 100), 0) / subidas.length
        : 0;

    return (
        <div className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1 border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[3rem] p-8 shadow-xl">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-6 flex items-center gap-2">
                        <Filter className="w-4 h-4" /> Filtro Maestro
                    </h4>
                    <select
                        className="w-full p-4 rounded-2xl bg-white/60 dark:bg-black/20 border-none font-bold text-xs uppercase tracking-widest shadow-inner mb-10"
                        value={filtroProducto}
                        onChange={(e) => setFiltroProducto(e.target.value)}
                    >
                        <option value="todos">Todos los SKU</option>
                        {productos.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>

                    <div className="space-y-6">
                        <div className="p-5 rounded-[2rem] bg-slate-50 dark:bg-gray-800/40 shadow-inner">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Impactos Totales</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter">{historialFiltrado.length}</p>
                        </div>
                        <div className="p-5 rounded-[2rem] bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1">Inflación Detectada</p>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-rose-500" />
                                <p className="text-2xl font-black text-rose-600 tabular-nums tracking-tighter">{subidas.length}</p>
                            </div>
                        </div>
                        <div className="p-5 rounded-[2rem] bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Optimización (Bajas)</p>
                            <div className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-emerald-500" />
                                <p className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">{bajadas.length}</p>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="lg:col-span-3 border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-xl p-0">
                    <div className="p-8 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Bitácora Temporal de Volatilidad
                        </h4>
                        <Badge className="bg-blue-600 text-white border-none rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-widest">Live Feed</Badge>
                    </div>

                    <ScrollArea className="h-[600px] p-8">
                        {historialFiltrado.length === 0 ? (
                            <div className="py-40 text-center opacity-20">
                                <History className="w-20 h-20 mx-auto mb-4" />
                                <p className="font-black uppercase text-[10px] tracking-widest">Sin fluctuaciones registradas</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {[...historialFiltrado]
                                    .sort((a, b) => new Date(b.fechaCambio).getTime() - new Date(a.fechaCambio).getTime())
                                    .map((entry) => {
                                        const isSubida = entry.precioNuevo > entry.precioAnterior;
                                        const pct = ((entry.precioNuevo - entry.precioAnterior) / entry.precioAnterior) * 100;
                                        const p = getProductoById(entry.productoId);
                                        const prov = getProveedorById(entry.proveedorId);

                                        return (
                                            <div key={entry.id} className="group flex gap-6 p-6 rounded-[2.5rem] bg-white/60 dark:bg-black/20 border border-white/20 dark:border-gray-800/30 hover:shadow-lg transition-all">
                                                <div className={cn(
                                                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                                                    isSubida ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                                                )}>
                                                    {isSubida ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="font-black text-lg uppercase tracking-tight truncate">{p?.nombre}</h5>
                                                        <span className="text-[8px] font-black text-muted-foreground opacity-40 uppercase tracking-widest">
                                                            {new Date(entry.fechaCambio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(entry.fechaCambio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2 opacity-60">
                                                            <Store className="w-3.5 h-3.5 text-blue-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest truncate">{prov?.nombre}</span>
                                                        </div>
                                                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-bold text-muted-foreground line-through opacity-40">{formatCurrency(entry.precioAnterior)}</span>
                                                            <span className="text-[10px] font-black opacity-20">→</span>
                                                            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{formatCurrency(entry.precioNuevo)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={cn(
                                                    "px-4 py-2 rounded-xl h-fit font-black text-[10px] uppercase tracking-widest",
                                                    isSubida ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                                )}>
                                                    {isSubida ? '+' : ''}{pct.toFixed(1)}%
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}
