import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area,
    Legend,
    ReferenceLine
} from 'recharts';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    PieChart as PieChartIcon,
    Layers,
    Activity,
    Package,
    Zap,
    Target,
    ShoppingBag,
    Percent
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Venta, Gasto, ReporteFinanciero, Producto, Categoria } from '@/types';
import { cn } from '@/lib/utils';
import { HistorialVentasCategoria } from '@/components/ventas/HistorialVentasCategoria';
import { exportCSV, getExportFilename } from '@/lib/exportUtils';

interface ReportesProps {
    ventas: Venta[];
    gastos: Gasto[];
    formatCurrency: (value: number) => string;
    generarReporte: (periodo: string) => ReporteFinanciero;
    productos?: Producto[];
    categorias?: Categoria[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];

export default function Reportes({
    ventas,
    gastos,
    formatCurrency,
    generarReporte,
    productos = [],
    categorias = []
}: ReportesProps) {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const reporteActual = useMemo(() => generarReporte(currentMonth), [ventas, gastos, currentMonth, generarReporte]);

    // Datos comparativos últimos 6 meses
    const comparativoData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const periodo = date.toISOString().slice(0, 7);
            const r = generarReporte(periodo);
            data.push({
                name: date.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
                ventas: r.totalVentas,
                gastos: r.totalGastos,
                utilidad: r.utilidadBruta
            });
        }
        return data;
    }, [ventas, gastos, generarReporte]);

    // Proyección del mes actual basada en días transcurridos
    const proyeccion = useMemo(() => {
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        if (diaActual === 0) return null;
        const ventasMesActual = reporteActual.totalVentas;
        const tasaDiaria = ventasMesActual / diaActual;
        return Math.round(tasaDiaria * diasDelMes);
    }, [reporteActual]);

    // Análisis de rentabilidad por producto
    const rentabilidadProductos = useMemo(() => {
        const mapaVentas: Record<string, { ingresos: number; unidades: number; nombre: string }> = {};
        ventas.forEach(v => {
            v.items?.forEach(item => {
                if (!mapaVentas[item.productoId]) {
                    const prod = productos.find(p => p.id === item.productoId);
                    mapaVentas[item.productoId] = { ingresos: 0, unidades: 0, nombre: prod?.nombre || item.productoId };
                }
                mapaVentas[item.productoId].ingresos += item.subtotal;
                mapaVentas[item.productoId].unidades += item.cantidad;
            });
        });
        return Object.values(mapaVentas)
            .sort((a, b) => b.ingresos - a.ingresos)
            .slice(0, 10);
    }, [ventas, productos]);

    const totalVentasProductos = rentabilidadProductos.reduce((s, p) => s + p.ingresos, 0);

    // Gastos por categoría (pie)
    const gastosData = useMemo(() => {
        return Object.entries(reporteActual.gastosPorCategoria)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
    }, [reporteActual]);

    // Ventas por método de pago (pie)
    const ventasMetodoData = useMemo(() => {
        return Object.entries(reporteActual.ventasPorMetodoPago)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name: name.toUpperCase(), value }));
    }, [reporteActual]);

    // Reporte mes anterior
    const prevPeriodo = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 7);
    }, []);

    const reporteMesAnterior = useMemo(() => generarReporte(prevPeriodo), [ventas, gastos, prevPeriodo, generarReporte]);

    const calcTrend = (actual: number, anterior: number): string => {
        if (anterior === 0) return actual > 0 ? 'Nuevo' : '—';
        const pct = ((actual - anterior) / anterior) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    };

    const margenActual = reporteActual.totalVentas > 0 ? (reporteActual.utilidadBruta / reporteActual.totalVentas) * 100 : 0;
    const margenAnterior = reporteMesAnterior.totalVentas > 0 ? (reporteMesAnterior.utilidadBruta / reporteMesAnterior.totalVentas) * 100 : 0;

    // Ticket promedio
    const ventasMes = ventas.filter(v => v.fecha.startsWith(currentMonth));
    const ticketPromedio = ventasMes.length > 0 ? reporteActual.totalVentas / ventasMes.length : 0;
    const ventasMesAnt = ventas.filter(v => v.fecha.startsWith(prevPeriodo));
    const ticketAnterior = ventasMesAnt.length > 0 ? reporteMesAnterior.totalVentas / ventasMesAnt.length : 0;

    // Ratio gasto/venta
    const ratioGasto = reporteActual.totalVentas > 0
        ? (reporteActual.totalGastos / reporteActual.totalVentas) * 100
        : 0;
    const ratioGastoAnt = reporteMesAnterior.totalVentas > 0
        ? (reporteMesAnterior.totalGastos / reporteMesAnterior.totalVentas) * 100
        : 0;

    const cardsData = [
        {
            title: 'Ventas del Mes',
            value: reporteActual.totalVentas,
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            trend: calcTrend(reporteActual.totalVentas, reporteMesAnterior.totalVentas),
            sub: `${ventasMes.length} transacciones`
        },
        {
            title: 'Gastos del Mes',
            value: reporteActual.totalGastos,
            icon: TrendingDown,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            trend: calcTrend(reporteActual.totalGastos, reporteMesAnterior.totalGastos),
            sub: `${gastosData.length} categorías`
        },
        {
            title: 'Utilidad Bruta',
            value: reporteActual.utilidadBruta,
            icon: DollarSign,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            trend: calcTrend(reporteActual.utilidadBruta, reporteMesAnterior.utilidadBruta),
            sub: `Margen ${margenActual.toFixed(1)}%`
        },
        {
            title: 'Margen Neto',
            value: `${margenActual.toFixed(1)}%`,
            icon: Percent,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            trend: margenAnterior === 0 ? '—' : `${margenActual >= margenAnterior ? '+' : ''}${(margenActual - margenAnterior).toFixed(1)}pp`,
            sub: margenActual >= 30 ? 'Saludable ✓' : margenActual >= 15 ? 'Aceptable' : 'Revisar ⚠'
        },
        {
            title: 'Ticket Promedio',
            value: ticketPromedio,
            icon: ShoppingBag,
            color: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
            trend: calcTrend(ticketPromedio, ticketAnterior),
            sub: `${ventasMes.length} ventas este mes`
        },
        {
            title: 'Ratio Gasto/Venta',
            value: `${ratioGasto.toFixed(1)}%`,
            icon: Target,
            color: ratioGasto > 70 ? 'text-rose-500' : ratioGasto > 50 ? 'text-amber-500' : 'text-emerald-500',
            bg: ratioGasto > 70 ? 'bg-rose-500/10' : ratioGasto > 50 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
            trend: ratioGastoAnt === 0 ? '—' : `${ratioGasto <= ratioGastoAnt ? '' : '+'}${(ratioGasto - ratioGastoAnt).toFixed(1)}pp`,
            sub: ratioGasto > 70 ? 'Alto — revisar' : ratioGasto > 50 ? 'Moderado' : 'Eficiente ✓'
        },
    ];

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Análisis Financiero</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })} · Tiempo real
                            {proyeccion && proyeccion > 0 && (
                                <span className="ml-2 text-indigo-400">· Proyección mes: {formatCurrency(proyeccion)}</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-muted-foreground font-black uppercase text-[10px] cursor-pointer hover:bg-white/10 transition-all"
                        onClick={() => exportCSV(
                            ventas.map(v => ({
                                fecha: new Date(v.fecha).toLocaleDateString('es-CO'),
                                total: v.total,
                                metodo: v.metodoPago,
                                items: v.items?.length ?? 0,
                            })),
                            getExportFilename('reporte-ventas'),
                            { fecha: 'Fecha', total: 'Total', metodo: 'Método Pago', items: 'Productos' }
                        )}
                    >
                        CSV Ventas
                    </Badge>
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-indigo-600 border-none text-white font-black uppercase text-[10px] shadow-lg shadow-indigo-600/20 cursor-pointer hover:bg-indigo-700 transition-all"
                        onClick={() => exportCSV(
                            gastos.map(g => ({
                                fecha: new Date(g.fecha).toLocaleDateString('es-CO'),
                                descripcion: g.descripcion,
                                categoria: g.categoria,
                                monto: g.monto,
                                metodo: g.metodoPago,
                            })),
                            getExportFilename('reporte-gastos'),
                            { fecha: 'Fecha', descripcion: 'Descripción', categoria: 'Categoría', monto: 'Monto', metodo: 'Método' }
                        )}
                    >
                        CSV Gastos
                    </Badge>
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-emerald-600 border-none text-white font-black uppercase text-[10px] shadow-lg shadow-emerald-600/20 cursor-pointer hover:bg-emerald-700 transition-all"
                        onClick={() => exportCSV(
                            rentabilidadProductos.map((p, i) => ({
                                ranking: i + 1,
                                producto: p.nombre,
                                ingresos: p.ingresos,
                                unidades: p.unidades,
                                participacion: totalVentasProductos > 0 ? ((p.ingresos / totalVentasProductos) * 100).toFixed(1) + '%' : '0%'
                            })),
                            getExportFilename('rentabilidad-productos'),
                            { ranking: '#', producto: 'Producto', ingresos: 'Ingresos', unidades: 'Unidades', participacion: 'Participación' }
                        )}
                    >
                        CSV Rentabilidad
                    </Badge>
                </div>
            </header>

            <Tabs defaultValue="resumen" className="w-full">
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-14 p-1 mb-6 flex items-center justify-start flex-wrap gap-1">
                    <TabsTrigger value="resumen" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Activity className="w-4 h-4 mr-2" />
                        Resumen
                    </TabsTrigger>
                    <TabsTrigger value="rentabilidad" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Package className="w-4 h-4 mr-2" />
                        Rentabilidad
                    </TabsTrigger>
                    <TabsTrigger value="historico-categorias" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Layers className="w-4 h-4 mr-2" />
                        Por Categoría
                    </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════════════
                    TAB 1: RESUMEN GENERAL
                ══════════════════════════════════════════════════ */}
                <TabsContent value="resumen" className="space-y-6 mt-0">
                    {/* KPI Grid — 6 tarjetas */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        {cardsData.map((card, i) => (
                            <Card key={i} className="rounded-3xl border-white/5 bg-card/30 backdrop-blur-md overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={cn("p-2.5 rounded-xl transition-transform group-hover:rotate-12 duration-500", card.bg, card.color)}>
                                            <card.icon className="w-5 h-5" />
                                        </div>
                                        <Badge variant="outline" className={cn("text-[8px] font-black border-none px-1.5", card.color, card.bg)}>
                                            {card.trend}
                                        </Badge>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.title}</p>
                                    <h3 className="text-xl font-black tracking-tighter text-foreground group-hover:text-indigo-400 transition-colors">
                                        {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                                    </h3>
                                    <p className="text-[9px] text-muted-foreground mt-1 truncate">{card.sub}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Gráfico de Evolución + Piecharts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-6 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Evolución de Flujo</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                            Ventas vs Gastos (6 meses)
                                            {proyeccion && proyeccion > 0 && <span className="ml-2 text-indigo-400">· Proyección: {formatCurrency(proyeccion)}</span>}
                                        </CardDescription>
                                    </div>
                                    <BarChart3 className="w-6 h-6 text-indigo-500/50" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={comparativoData}>
                                        <defs>
                                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            labelStyle={{ color: '#6366f1', marginBottom: '8px', fontWeight: 900 }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '10px' }}
                                            formatter={(value) => value === 'ventas' ? 'Ventas' : value === 'gastos' ? 'Gastos' : 'Utilidad'}
                                        />
                                        {proyeccion && proyeccion > 0 && (
                                            <ReferenceLine y={proyeccion} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.4}
                                                label={{ value: 'Proy.', fill: '#6366f1', fontSize: 9, fontWeight: 900 }} />
                                        )}
                                        <Area type="monotone" dataKey="ventas" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                                        <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorGastos)" />
                                        <Area type="monotone" dataKey="utilidad" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" fillOpacity={1} fill="url(#colorUtilidad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                                <CardHeader className="p-5">
                                    <CardTitle className="text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                                        <PieChartIcon className="w-4 h-4 text-rose-400" /> Gastos por Categoría
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 pt-0 h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={gastosData} innerRadius={55} outerRadius={75} paddingAngle={6} dataKey="value">
                                                {gastosData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                formatter={(value: number) => formatCurrency(value)}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {gastosData.map((d, i) => (
                                            <div key={i} className="flex items-center gap-1.5 overflow-hidden">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                <span className="text-[8px] font-black uppercase text-muted-foreground truncate">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                                <CardHeader className="p-5">
                                    <CardTitle className="text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400" /> Ventas por Método
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 pt-0 h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={ventasMetodoData} innerRadius={50} outerRadius={70} paddingAngle={6} dataKey="value">
                                                {ventasMetodoData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                formatter={(value: number) => formatCurrency(value)}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {ventasMetodoData.map((d, i) => (
                                            <div key={i} className="flex items-center gap-1.5 overflow-hidden">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                                                <span className="text-[8px] font-black uppercase text-muted-foreground truncate">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 2: RENTABILIDAD POR PRODUCTO
                ══════════════════════════════════════════════════ */}
                <TabsContent value="rentabilidad" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Gráfico de barras horizontal */}
                        <Card className="lg:col-span-2 rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-6 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Top Productos por Ingresos</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                            Acumulado total · {rentabilidadProductos.length} productos analizados
                                        </CardDescription>
                                    </div>
                                    <Package className="w-6 h-6 text-indigo-500/50" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-6" style={{ height: Math.max(300, rentabilidadProductos.length * 44 + 40) }}>
                                {rentabilidadProductos.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={rentabilidadProductos} layout="vertical" margin={{ left: 8, right: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : (v/1000).toFixed(0)+'k'}`} />
                                            <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} width={110} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                                                formatter={(value: number, name: string) => [
                                                    name === 'ingresos' ? formatCurrency(value) : value,
                                                    name === 'ingresos' ? 'Ingresos' : 'Unidades'
                                                ]}
                                            />
                                            <Bar dataKey="ingresos" radius={[0, 8, 8, 0]} maxBarSize={32}>
                                                {rentabilidadProductos.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm font-bold text-muted-foreground">Sin datos de ventas aún</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tabla de ranking con participación */}
                        <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                            <CardHeader className="p-5 border-b border-white/5">
                                <CardTitle className="text-xs font-black uppercase tracking-tighter">Participación en Ingresos</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 overflow-y-auto max-h-[500px]">
                                <div className="space-y-3">
                                    {rentabilidadProductos.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-8">Sin ventas registradas</p>
                                    ) : rentabilidadProductos.map((p, i) => {
                                        const participacion = totalVentasProductos > 0 ? (p.ingresos / totalVentasProductos) * 100 : 0;
                                        return (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-[9px] font-black text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                                                        <span className="text-xs font-bold text-foreground truncate">{p.nombre}</span>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <p className="text-xs font-black text-foreground">{formatCurrency(p.ingresos)}</p>
                                                        <p className="text-[9px] text-muted-foreground">{p.unidades} uds</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${participacion}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                                    />
                                                </div>
                                                <p className="text-[8px] font-black text-muted-foreground text-right">{participacion.toFixed(1)}% del total</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Métricas clave de rentabilidad */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            {
                                label: 'Productos vendidos',
                                value: rentabilidadProductos.length,
                                icon: Package,
                                color: 'text-indigo-500',
                                bg: 'bg-indigo-500/10'
                            },
                            {
                                label: 'Unidades totales',
                                value: rentabilidadProductos.reduce((s, p) => s + p.unidades, 0),
                                icon: Layers,
                                color: 'text-emerald-500',
                                bg: 'bg-emerald-500/10'
                            },
                            {
                                label: 'Ingreso top producto',
                                value: rentabilidadProductos[0] ? formatCurrency(rentabilidadProductos[0].ingresos) : '—',
                                icon: TrendingUp,
                                color: 'text-amber-500',
                                bg: 'bg-amber-500/10',
                                sub: rentabilidadProductos[0]?.nombre
                            },
                            {
                                label: 'Concentración top 3',
                                value: totalVentasProductos > 0
                                    ? `${((rentabilidadProductos.slice(0, 3).reduce((s, p) => s + p.ingresos, 0) / totalVentasProductos) * 100).toFixed(0)}%`
                                    : '—',
                                icon: Target,
                                color: 'text-cyan-500',
                                bg: 'bg-cyan-500/10',
                                sub: 'Del ingreso total'
                            },
                        ].map((m, i) => (
                            <Card key={i} className="rounded-3xl border-white/5 bg-card/30 backdrop-blur-md overflow-hidden">
                                <CardContent className="p-5">
                                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", m.bg, m.color)}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{m.label}</p>
                                    <h3 className="text-xl font-black tracking-tighter text-foreground">
                                        {typeof m.value === 'number' ? m.value.toLocaleString('es-CO') : m.value}
                                    </h3>
                                    {m.sub && <p className="text-[9px] text-muted-foreground mt-1 truncate">{m.sub}</p>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 3: VENTAS POR CATEGORÍA
                ══════════════════════════════════════════════════ */}
                <TabsContent value="historico-categorias" className="mt-0">
                    <HistorialVentasCategoria
                        ventas={ventas}
                        productos={productos || []}
                        categorias={categorias || []}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
