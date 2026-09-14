import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Package, ShoppingBag, Percent, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import type { Venta, Producto, Categoria } from '@/types';
import { format, parseISO, isValid, startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HistorialVentasCategoriaProps {
    ventas: Venta[];
    productos: Producto[];
    categorias: Categoria[];
    formatCurrency: (value: number) => string;
}

const PERIOD_OPTIONS = [
    { label: 'Hoy',        value: 'today' },
    { label: 'Semana',     value: 'week' },
    { label: 'Mes',        value: 'month' },
    { label: 'Mes ant.',   value: 'prev_month' },
    { label: '3 meses',    value: '3months' },
    { label: 'Todo',       value: 'all' },
];

const PALETTE = [
    'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
    'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-orange-500',
];

function getPeriodStart(period: string): Date | null {
    const now = new Date();
    switch (period) {
        case 'today':     return startOfDay(now);
        case 'week':      return startOfWeek(now, { weekStartsOn: 1 });
        case 'month':     return startOfMonth(now);
        case 'prev_month': return startOfMonth(subMonths(now, 1));
        case '3months':   return startOfMonth(subMonths(now, 3));
        default:          return null;
    }
}

function getPeriodEnd(period: string): Date | null {
    if (period === 'prev_month') {
        return startOfMonth(new Date()); // exclusive upper bound
    }
    return null;
}

export function HistorialVentasCategoria({
    ventas,
    productos,
    categorias,
    formatCurrency,
}: HistorialVentasCategoriaProps) {
    const [period, setPeriod]               = useState<string>('month');
    const [searchTerm, setSearchTerm]       = useState('');
    const [selectedCat, setSelectedCat]     = useState<string | null>(null);
    const [expandedCat, setExpandedCat]     = useState<string | null>(null);

    // Filtrar ventas por período
    const ventasFiltradas = useMemo(() => {
        const desde = getPeriodStart(period);
        const hasta = getPeriodEnd(period);
        return ventas.filter(v => {
            const d = parseISO(v.fecha);
            if (!isValid(d)) return false;
            if (desde && d < desde) return false;
            if (hasta && d >= hasta) return false;
            return true;
        });
    }, [ventas, period]);

    // Mapa rápido de productos
    const productoMap = useMemo(() => {
        const m: Record<string, Producto> = {};
        productos.forEach(p => { m[p.id] = p; });
        return m;
    }, [productos]);

    // Aplanar ítems con categoría
    const itemsPlanos = useMemo(() => {
        const list: {
            ventaId: string; fecha: string;
            productoId: string; nombre: string;
            catId: string; catNombre: string;
            cantidad: number; subtotal: number; costoEst: number;
        }[] = [];

        ventasFiltradas.forEach(venta => {
            venta.items.forEach(item => {
                const prod   = productoMap[item.productoId];
                const nombre = prod?.nombre ?? 'Desconocido';
                const catId  = prod?.categoria ?? 'sin-categoria';
                const catObj = categorias.find(c => c.id === catId || c.nombre === catId);
                const catNombre = catObj?.nombre ?? catId ?? 'Sin categoría';
                const costoUnit = prod?.costoBase ?? 0;
                list.push({
                    ventaId: venta.id,
                    fecha: venta.fecha,
                    productoId: item.productoId,
                    nombre,
                    catId,
                    catNombre,
                    cantidad: item.cantidad,
                    subtotal: item.subtotal,
                    costoEst: costoUnit * item.cantidad,
                });
            });
        });
        return list;
    }, [ventasFiltradas, productoMap, categorias]);

    // Filtrar por búsqueda y categoría seleccionada
    const itemsFiltrados = useMemo(() => {
        return itemsPlanos.filter(i => {
            const matchSearch = !searchTerm || i.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat    = !selectedCat || i.catId === selectedCat;
            return matchSearch && matchCat;
        });
    }, [itemsPlanos, searchTerm, selectedCat]);

    // Resumen por categoría
    const resumenCats = useMemo(() => {
        const acc: Record<string, {
            catId: string; catNombre: string; color: string;
            ventas: number; cantidad: number; costoEst: number;
            productos: Record<string, { nombre: string; ventas: number; cantidad: number }>;
        }> = {};

        itemsPlanos.forEach(i => {  // usar itemsPlanos (sin filtro de cat) para totales globales
            if (!acc[i.catId]) {
                const idx = Object.keys(acc).length;
                acc[i.catId] = {
                    catId: i.catId,
                    catNombre: i.catNombre,
                    color: PALETTE[idx % PALETTE.length],
                    ventas: 0, cantidad: 0, costoEst: 0,
                    productos: {},
                };
            }
            acc[i.catId].ventas   += i.subtotal;
            acc[i.catId].cantidad += i.cantidad;
            acc[i.catId].costoEst += i.costoEst;
            if (!acc[i.catId].productos[i.productoId]) {
                acc[i.catId].productos[i.productoId] = { nombre: i.nombre, ventas: 0, cantidad: 0 };
            }
            acc[i.catId].productos[i.productoId].ventas   += i.subtotal;
            acc[i.catId].productos[i.productoId].cantidad += i.cantidad;
        });

        return Object.values(acc).sort((a, b) => b.ventas - a.ventas);
    }, [itemsPlanos]);

    const totalGlobal  = resumenCats.reduce((s, c) => s + c.ventas, 0);
    const costoGlobal  = resumenCats.reduce((s, c) => s + c.costoEst, 0);
    const margenGlobal = totalGlobal > 0 ? ((totalGlobal - costoGlobal) / totalGlobal) * 100 : 0;
    const maxVentas    = resumenCats[0]?.ventas ?? 1;

    return (
        <div className="space-y-5">

            {/* ── Controles ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Selector de período */}
                <div className="flex gap-1 flex-wrap">
                    {PERIOD_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt.value)}
                            className={cn(
                                'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                                period === opt.value
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'bg-white/5 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {/* Buscador */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                </div>
            </div>

            {/* ── KPIs globales ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total ventas',   value: formatCurrency(totalGlobal),   icon: ShoppingBag,  color: 'text-indigo-600' },
                    { label: 'Categorías',     value: resumenCats.length,             icon: Package,      color: 'text-violet-600' },
                    { label: 'Costo estimado', value: formatCurrency(costoGlobal),   icon: TrendingUp,   color: 'text-rose-500'   },
                    { label: 'Margen promedio',value: `${margenGlobal.toFixed(1)}%`,  icon: Percent,      color: 'text-emerald-600' },
                ].map(k => (
                    <Card key={k.label} className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <k.icon className={cn('w-8 h-8 shrink-0', k.color)} />
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{k.label}</p>
                                <p className="text-base font-black tabular-nums text-slate-900 dark:text-white truncate">{k.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Chips de categoría ─────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedCat(null)}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                        !selectedCat
                            ? 'bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-600/20'
                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    )}
                >
                    Todas
                </button>
                {resumenCats.map((c, i) => (
                    <button
                        key={c.catId}
                        onClick={() => setSelectedCat(selectedCat === c.catId ? null : c.catId)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                            selectedCat === c.catId
                                ? `${PALETTE[i % PALETTE.length]} text-white border-transparent shadow-lg`
                                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        )}
                    >
                        <span className={cn('w-2 h-2 rounded-full shrink-0', PALETTE[i % PALETTE.length])} />
                        {c.catNombre}
                    </button>
                ))}
            </div>

            {/* ── Tarjetas de categoría con barra y top productos ────── */}
            {resumenCats.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                    Sin ventas en el período seleccionado
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {resumenCats.map((cat, i) => {
                        const pct        = totalGlobal > 0 ? (cat.ventas / totalGlobal) * 100 : 0;
                        const barPct     = maxVentas > 0 ? (cat.ventas / maxVentas) * 100 : 0;
                        const margen     = cat.costoEst > 0 ? ((cat.ventas - cat.costoEst) / cat.ventas) * 100 : null;
                        const topProds   = Object.values(cat.productos)
                            .sort((a, b) => b.ventas - a.ventas)
                            .slice(0, 3);
                        const isExpanded = expandedCat === cat.catId;
                        const dimmed     = !!selectedCat && selectedCat !== cat.catId;

                        return (
                            <Card
                                key={cat.catId}
                                className={cn(
                                    'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all cursor-pointer hover:shadow-md',
                                    dimmed && 'opacity-40'
                                )}
                                onClick={() => setExpandedCat(isExpanded ? null : cat.catId)}
                            >
                                <CardContent className="p-5 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={cn('w-3 h-3 rounded-full shrink-0', PALETTE[i % PALETTE.length])} />
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white truncate">
                                                {cat.catNombre}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">
                                                {pct.toFixed(1)}%
                                            </span>
                                            {isExpanded
                                                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                        </div>
                                    </div>

                                    {/* Monto principal */}
                                    <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                                        {formatCurrency(cat.ventas)}
                                    </p>

                                    {/* Barra de proporción */}
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-500', PALETTE[i % PALETTE.length])}
                                            style={{ width: `${barPct}%` }}
                                        />
                                    </div>

                                    {/* Stats secundarios */}
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                        <span>{cat.cantidad} unidades</span>
                                        {margen !== null && (
                                            <span className={cn('font-black', margen >= 30 ? 'text-emerald-500' : margen >= 15 ? 'text-amber-500' : 'text-rose-500')}>
                                                {margen.toFixed(0)}% margen
                                            </span>
                                        )}
                                    </div>

                                    {/* Top productos (expandible) */}
                                    {isExpanded && topProds.length > 0 && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top productos</p>
                                            {topProds.map(p => (
                                                <div key={p.nombre} className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1">{p.nombre}</span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="text-[9px] text-slate-400">{p.cantidad}u</span>
                                                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                            {formatCurrency(p.ventas)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Tabla detallada (filtros aplicados) ────────────────── */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Detalle de ventas
                        <span className="text-xs font-bold text-slate-400 normal-case tracking-normal">
                            ({itemsFiltrados.length} registros)
                        </span>
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-5 py-3">Fecha</th>
                                <th className="px-5 py-3">Producto</th>
                                <th className="px-5 py-3">Categoría</th>
                                <th className="px-5 py-3 text-center">Cant.</th>
                                <th className="px-5 py-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {itemsFiltrados.slice(0, 150).map((item, idx) => {
                                const d = parseISO(item.fecha);
                                const dateStr = isValid(d) ? format(d, 'dd MMM', { locale: es }) : '—';
                                return (
                                    <tr key={`${item.ventaId}-${item.productoId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{dateStr}</td>
                                        <td className="px-5 py-3 text-xs font-bold text-slate-800 dark:text-white">{item.nombre}</td>
                                        <td className="px-5 py-3">
                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg px-2 py-0.5">
                                                {item.catNombre}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3 text-center text-xs font-black text-slate-700 dark:text-slate-300">{item.cantidad}</td>
                                        <td className="px-5 py-3 text-right text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                );
                            })}
                            {itemsFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                        Sin registros para esta selección
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {itemsFiltrados.length > 150 && (
                        <p className="px-5 py-3 text-center text-[10px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/40">
                            Mostrando 150 de {itemsFiltrados.length} registros
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
