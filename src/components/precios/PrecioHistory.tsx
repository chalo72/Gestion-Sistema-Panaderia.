import { useState, useMemo } from 'react';
import { History, Filter, TrendingUp, TrendingDown, Clock, Store, Activity, ShieldAlert, BarChart2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
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

// Calcula desviación estándar
function desviacionEstandar(valores: number[]): number {
    if (valores.length < 2) return 0;
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const varianza = valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / valores.length;
    return Math.sqrt(varianza);
}

// Clasifica volatilidad según coeficiente de variación
function clasificarVolatilidad(cv: number): { label: string; color: string; bg: string } {
    if (cv < 5) return { label: 'Estable', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (cv < 15) return { label: 'Moderada', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (cv < 30) return { label: 'Alta', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { label: 'Crítica', color: 'text-rose-500', bg: 'bg-rose-500/10' };
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
    const [vistaMode, setVistaMode] = useState<'bitacora' | 'volatilidad'>('bitacora');

    const historialFiltrado = filtroProducto === 'todos'
        ? historial
        : historial.filter(h => h.productoId === filtroProducto);

    const subidas = historialFiltrado.filter(h => h.precioNuevo > h.precioAnterior);
    const bajadas = historialFiltrado.filter(h => h.precioNuevo < h.precioAnterior);

    // Análisis de volatilidad por producto
    const analisisVolatilidad = useMemo(() => {
        const mapaProductos: Record<string, number[]> = {};
        historial.forEach(h => {
            if (!mapaProductos[h.productoId]) mapaProductos[h.productoId] = [];
            mapaProductos[h.productoId].push(h.precioNuevo);
            if (mapaProductos[h.productoId].length === 1) {
                mapaProductos[h.productoId].unshift(h.precioAnterior);
            }
        });

        return Object.entries(mapaProductos)
            .map(([productoId, precios]) => {
                const media = precios.reduce((s, v) => s + v, 0) / precios.length;
                const desv = desviacionEstandar(precios);
                const cv = media > 0 ? (desv / media) * 100 : 0; // coeficiente de variación %
                const min = Math.min(...precios);
                const max = Math.max(...precios);
                const rango = max - min;
                const producto = getProductoById(productoId);
                const cambios = historial.filter(h => h.productoId === productoId).length;
                return {
                    productoId,
                    nombre: producto?.nombre || productoId.slice(0, 8),
                    media,
                    desv,
                    cv,
                    min,
                    max,
                    rango,
                    cambios,
                    volatilidad: clasificarVolatilidad(cv),
                };
            })
            .filter(a => a.cambios > 0)
            .sort((a, b) => b.cv - a.cv)
            .slice(0, 12);
    }, [historial, getProductoById]);

    // Promedio de subidas
    const promedioSubida = subidas.length > 0
        ? subidas.reduce((sum, h) => sum + ((h.precioNuevo - h.precioAnterior) / h.precioAnterior * 100), 0) / subidas.length
        : 0;

    // Índice de estabilidad global (0-100, 100=perfecto)
    const indiceEstabilidad = historial.length === 0 ? 100 :
        Math.max(0, Math.round(100 - (subidas.length / historial.length) * 100 - (promedioSubida / 2)));

    return (
        <div className="space-y-6 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Panel lateral de stats + filtro */}
                <Card className="lg:col-span-1 border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[3rem] p-6 shadow-xl">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-5 flex items-center gap-2">
                        <Filter className="w-4 h-4" /> Filtro Maestro
                    </h4>
                    <select
                        className="w-full p-3 rounded-2xl bg-white/60 dark:bg-black/20 border-none font-bold text-xs uppercase tracking-widest shadow-inner mb-6"
                        value={filtroProducto}
                        onChange={(e) => setFiltroProducto(e.target.value)}
                    >
                        <option value="todos">Todos los SKU</option>
                        {productos.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>

                    <div className="space-y-4">
                        <div className="p-4 rounded-[2rem] bg-slate-50 dark:bg-gray-800/40 shadow-inner">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Cambios Totales</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter">{historialFiltrado.length}</p>
                        </div>

                        <div className="p-4 rounded-[2rem] bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1">Inflación Detectada</p>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-rose-500" />
                                <p className="text-2xl font-black text-rose-600 tabular-nums tracking-tighter">{subidas.length}</p>
                                {promedioSubida > 0 && <span className="text-[9px] font-black text-rose-400">+{promedioSubida.toFixed(1)}% prom.</span>}
                            </div>
                        </div>

                        <div className="p-4 rounded-[2rem] bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Oportunidades (Bajas)</p>
                            <div className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-emerald-500" />
                                <p className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">{bajadas.length}</p>
                            </div>
                        </div>

                        {/* Índice de estabilidad */}
                        <div className="p-4 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Índice Estabilidad
                            </p>
                            <div className="flex items-end gap-2 mb-2">
                                <p className={cn('text-2xl font-black tabular-nums tracking-tighter',
                                    indiceEstabilidad >= 70 ? 'text-emerald-600' :
                                    indiceEstabilidad >= 40 ? 'text-amber-600' : 'text-rose-600'
                                )}>{indiceEstabilidad}</p>
                                <p className="text-[9px] text-muted-foreground mb-1">/100</p>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-700',
                                        indiceEstabilidad >= 70 ? 'bg-emerald-500' :
                                        indiceEstabilidad >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                    )}
                                    style={{ width: `${indiceEstabilidad}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Panel principal con 2 modos de vista */}
                <Card className="lg:col-span-3 border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-xl p-0">
                    <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {vistaMode === 'bitacora' ? 'Bitácora de Cambios' : 'Análisis de Volatilidad'}
                        </h4>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-600 text-white border-none rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-widest">Live Feed</Badge>
                            <button
                                onClick={() => setVistaMode(v => v === 'bitacora' ? 'volatilidad' : 'bitacora')}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
                                    vistaMode === 'volatilidad'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 hover:bg-indigo-100'
                                )}
                            >
                                {vistaMode === 'bitacora' ? <><BarChart2 className="w-3 h-3" /> Volatilidad</> : <><Clock className="w-3 h-3" /> Bitácora</>}
                            </button>
                        </div>
                    </div>

                    {/* VISTA BITÁCORA */}
                    {vistaMode === 'bitacora' && (
                        <ScrollArea className="h-[360px] sm:h-[500px] lg:h-[580px] p-6">
                            {historialFiltrado.length === 0 ? (
                                <div className="py-40 text-center opacity-20">
                                    <History className="w-20 h-20 mx-auto mb-4" />
                                    <p className="font-black uppercase text-[10px] tracking-widest">Sin fluctuaciones registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {[...historialFiltrado]
                                        .sort((a, b) => new Date(b.fechaCambio).getTime() - new Date(a.fechaCambio).getTime())
                                        .map((entry) => {
                                            const isSubida = entry.precioNuevo > entry.precioAnterior;
                                            const pct = ((entry.precioNuevo - entry.precioAnterior) / entry.precioAnterior) * 100;
                                            const esCritico = isSubida && pct >= 20;
                                            const p = getProductoById(entry.productoId);
                                            const prov = getProveedorById(entry.proveedorId);

                                            return (
                                                <div key={entry.id} className={cn(
                                                    'group flex gap-4 p-5 rounded-[2rem] bg-white/60 dark:bg-black/20 border hover:shadow-lg transition-all',
                                                    esCritico ? 'border-rose-200 dark:border-rose-900/40' : 'border-white/20 dark:border-gray-800/30'
                                                )}>
                                                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0', isSubida ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white')}>
                                                        {isSubida ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <h5 className="font-black text-base uppercase tracking-tight truncate">{p?.nombre}</h5>
                                                                {esCritico && <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />}
                                                            </div>
                                                            <span className="text-[8px] font-black text-muted-foreground opacity-40 uppercase tracking-widest shrink-0">
                                                                {new Date(entry.fechaCambio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <div className="flex items-center gap-1.5 opacity-60">
                                                                <Store className="w-3 h-3 text-blue-500" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest truncate">{prov?.nombre}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-muted-foreground line-through opacity-40">{formatCurrency(entry.precioAnterior)}</span>
                                                                <span className="text-[9px] font-black opacity-20">→</span>
                                                                <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(entry.precioNuevo)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={cn('px-3 py-1.5 rounded-xl h-fit font-black text-[10px] uppercase tracking-widest shrink-0', isSubida ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30')}>
                                                        {isSubida ? '+' : ''}{pct.toFixed(1)}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </ScrollArea>
                    )}

                    {/* VISTA VOLATILIDAD */}
                    {vistaMode === 'volatilidad' && (
                        <div className="p-6 space-y-6">
                            {analisisVolatilidad.length === 0 ? (
                                <div className="py-20 text-center opacity-20">
                                    <Activity className="w-16 h-16 mx-auto mb-4" />
                                    <p className="font-black uppercase text-[10px] tracking-widest">Sin datos suficientes</p>
                                </div>
                            ) : (
                                <>
                                    {/* Gráfico de barras de volatilidad */}
                                    <div style={{ height: Math.max(220, analisisVolatilidad.length * 36) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analisisVolatilidad} layout="vertical" margin={{ left: 8, right: 50 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff06" />
                                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} tickFormatter={v => `${v.toFixed(0)}%`} />
                                                <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} width={100} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Coef. Variación']}
                                                />
                                                <ReferenceLine x={5} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: 'Estable', fill: '#10b981', fontSize: 8, fontWeight: 900 }} />
                                                <ReferenceLine x={15} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: 'Alta', fill: '#f59e0b', fontSize: 8, fontWeight: 900 }} />
                                                <Bar dataKey="cv" radius={[0, 6, 6, 0]} maxBarSize={24}>
                                                    {analisisVolatilidad.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.cv < 5 ? '#10b981' : entry.cv < 15 ? '#f59e0b' : entry.cv < 30 ? '#f97316' : '#f43f5e'}
                                                            fillOpacity={0.85}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Tabla de resumen */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Detalle por producto</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="text-left pb-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Producto</th>
                                                        <th className="text-right pb-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Min</th>
                                                        <th className="text-right pb-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Max</th>
                                                        <th className="text-right pb-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Variación</th>
                                                        <th className="text-center pb-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {analisisVolatilidad.map((a) => (
                                                        <tr key={a.productoId} className="hover:bg-white/5 transition-colors">
                                                            <td className="py-2 font-bold text-foreground truncate max-w-[120px]">{a.nombre}</td>
                                                            <td className="py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(a.min)}</td>
                                                            <td className="py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(a.max)}</td>
                                                            <td className={cn('py-2 text-right font-black tabular-nums', a.volatilidad.color)}>{a.cv.toFixed(1)}%</td>
                                                            <td className="py-2 text-center">
                                                                <span className={cn('px-2 py-0.5 rounded-lg text-[8px] font-black uppercase', a.volatilidad.bg, a.volatilidad.color)}>
                                                                    {a.volatilidad.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
