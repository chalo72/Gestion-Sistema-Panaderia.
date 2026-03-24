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
    Legend
} from 'recharts';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    PieChart as PieChartIcon,
    Layers,
    Activity,
    CalendarDays
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

    const reporteActual = useMemo(() => {
        return generarReporte(currentMonth);
    }, [ventas, gastos, currentMonth, generarReporte]);

    // Datos para gráfico de Barras Comparativo
    const comparativoData = useMemo(() => {
        // Tomar los últimos 6 meses
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

    // Datos para gráfico de Pastilla de Gastos
    const gastosData = useMemo(() => {
        return Object.entries(reporteActual.gastosPorCategoria).map(([name, value]) => ({
            name,
            value
        }));
    }, [reporteActual]);

    // Datos para gráfico de Pastilla de Ventas
    const ventasMetodoData = useMemo(() => {
        return Object.entries(reporteActual.ventasPorMetodoPago).map(([name, value]) => ({
            name: name.toUpperCase(),
            value
        }));
    }, [reporteActual]);

    // Reporte del mes anterior para calcular tendencias reales
    const prevPeriodo = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 7);
    }, []);

    const reporteMesAnterior = useMemo(() => generarReporte(prevPeriodo), [ventas, gastos, prevPeriodo, generarReporte]);

    // Calcula % cambio real entre dos valores
    const calcTrend = (actual: number, anterior: number): string => {
        if (anterior === 0) return actual > 0 ? 'Nuevo' : '—';
        const pct = ((actual - anterior) / anterior) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    };

    const margenActual = reporteActual.totalVentas > 0 ? (reporteActual.utilidadBruta / reporteActual.totalVentas) * 100 : 0;
    const margenAnterior = reporteMesAnterior.totalVentas > 0 ? (reporteMesAnterior.utilidadBruta / reporteMesAnterior.totalVentas) * 100 : 0;

    const cardsData = [
        {
            title: 'Ventas del Mes',
            value: reporteActual.totalVentas,
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            trend: calcTrend(reporteActual.totalVentas, reporteMesAnterior.totalVentas)
        },
        {
            title: 'Gastos del Mes',
            value: reporteActual.totalGastos,
            icon: TrendingDown,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            trend: calcTrend(reporteActual.totalGastos, reporteMesAnterior.totalGastos)
        },
        {
            title: 'Utilidad Bruta',
            value: reporteActual.utilidadBruta,
            icon: DollarSign,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            trend: calcTrend(reporteActual.utilidadBruta, reporteMesAnterior.utilidadBruta)
        },
        {
            title: 'Margen Neto',
            value: `${margenActual.toFixed(1)}%`,
            icon: Activity,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            trend: margenAnterior === 0 ? '—' : `${margenActual >= margenAnterior ? '+' : ''}${(margenActual - margenAnterior).toFixed(1)}pp`
        }
    ];

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <BarChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Análisis Financiero</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Reporte de {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })} · Tiempo real</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge
                        variant="outline"
                        className="h-12 px-6 rounded-2xl bg-white/5 border-white/10 text-muted-foreground font-black uppercase text-[10px] cursor-pointer hover:bg-white/10 transition-all"
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
                        Exportar CSV Ventas
                    </Badge>
                    <Badge
                        variant="outline"
                        className="h-12 px-6 rounded-2xl bg-indigo-600 border-none text-white font-black uppercase text-[10px] shadow-lg shadow-indigo-600/20 cursor-pointer hover:bg-indigo-700 transition-all"
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
                        Exportar CSV Gastos
                    </Badge>
                </div>
            </header>

            <Tabs defaultValue="resumen" className="w-full">
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-14 p-1 mb-6 flex items-center justify-start max-w-fit">
                    <TabsTrigger value="resumen" className="rounded-xl h-10 px-6 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Activity className="w-4 h-4 mr-2" />
                        Resumen General
                    </TabsTrigger>
                    <TabsTrigger value="historico-categorias" className="rounded-xl h-10 px-6 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Layers className="w-4 h-4 mr-2" />
                        Ventas por Categoría
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {cardsData.map((card, i) => (
                            <Card key={i} className="rounded-[2.5rem] border-white/5 bg-card/30 backdrop-blur-md overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={cn("p-3 rounded-2xl transition-transform group-hover:rotate-12 duration-500", card.bg, card.color)}>
                                            <card.icon className="w-6 h-6" />
                                        </div>
                                        <Badge variant="outline" className={cn("text-[8px] font-black border-none", card.color, card.bg)}>
                                            {card.trend} {card.trend.includes('+') ? <ArrowUpRight className="w-2.5 h-2.5 ml-1" /> : <ArrowDownRight className="w-2.5 h-2.5 ml-1" />}
                                        </Badge>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.title}</p>
                                    <h3 className="text-2xl font-black tracking-tighter text-foreground group-hover:text-indigo-400 transition-colors">
                                        {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                                    </h3>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-8 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-black uppercase tracking-tighter italic">Evolución de Flujo</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Balance mensual comparativo (Ventas vs Gastos)</CardDescription>
                                    </div>
                                    <BarChart3 className="w-8 h-8 text-indigo-500/50" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 h-[400px]">
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
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                                            tickFormatter={(v) => `$${v / 1000}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            labelStyle={{ color: '#6366f1', marginBottom: '8px', fontWeight: 900 }}
                                        />
                                        <Area type="monotone" dataKey="ventas" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorVentas)" />
                                        <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorGastos)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                                <CardHeader className="p-6">
                                    <CardTitle className="text-sm font-black uppercase tracking-tighter">Gastos por Categoría</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 pt-0 h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={gastosData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={8}
                                                dataKey="value"
                                            >
                                                {gastosData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
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
                                <CardHeader className="p-6">
                                    <CardTitle className="text-sm font-black uppercase tracking-tighter">Ventas por Método</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 pt-0 h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={ventasMetodoData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={8}
                                                dataKey="value"
                                            >
                                                {ventasMetodoData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
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
