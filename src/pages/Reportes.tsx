
import { useMemo, useState, useEffect } from 'react';
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
    PieChart as PieChartIcon,
    Layers,
    Activity,
    Package,
    Zap,
    Target,
    ShoppingBag,
    Percent,
    Brain,
    CalendarCheck,
    Plus,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    User,
    Shield,
    Flame,
    LifeBuoy,
    BadgeAlert,
    Gauge,
    Snowflake,
    CalendarDays,
    CalendarRange,
    List,
    Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { Venta, Gasto, ReporteFinanciero, Producto, Categoria, CompromisoFijo, GastoCategoria } from '@/types';
import { cn } from '@/lib/utils';
import { HistorialVentasCategoria } from '@/components/ventas/HistorialVentasCategoria';
import { exportCSV, getExportFilename } from '@/lib/exportUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePredictiveStock } from '@/hooks/usePredictiveStock';
import { ArqueoCajas } from '@/components/reportes/ArqueoCajas';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCompromisos, saveCompromisos, addCompromiso, deleteCompromiso, updateCompromiso,
    getVentasDiarias, addVentaDiaria, deleteVentaDiaria,
    calcularProyeccionQuincena, generarConsejo,
    getProducciones, addProduccion, deleteProduccion
} from '@/lib/finanzas-personales';
import { getBovedas, addBoveda, addMovimientoBoveda } from '@/lib/boveda-store';
import type { HornadaDia, RegistroProduccion, MasaPreparadaDia } from '@/lib/finanzas-personales';
import { getConfigSeguridad } from '@/lib/security-agent';
import type { VentaDiaria } from '@/types';
import { consultarAgente } from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { Bot, Sparkles, Loader2 } from 'lucide-react';

interface ReportesProps {
    ventas: Venta[];
    gastos: Gasto[];
    formatCurrency: (value: number) => string;
    generarReporte: (periodo: string) => ReporteFinanciero;
    productos?: Producto[];
    categorias?: Categoria[];
    proveedores?: any[];
    formulaciones?: any[];
    modelosPan?: any[];
    onNavigateTo?: (view: string) => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];


import { useReportesData } from '@/hooks/useReportesData';
import { GraficosEstadisticos } from '@/components/reportes/GraficosEstadisticos';
import { DiagnosticoFinanciero } from '@/components/reportes/DiagnosticoFinanciero';
import { TablaFlujoCaja } from '@/components/reportes/TablaFlujoCaja';

export default function Reportes(props: ReportesProps) {
    const reportesData = useReportesData(props);
    const { role, currentMonth, reporteActual, comparativoData, date, periodo, r, proyeccion, hoy, diaActual, diasDelMes, ventasMesActual, tasaDiaria, rentabilidadProductos, prod, totalVentasProductos, gastosData, ventasMetodoData, prevPeriodo, d, reporteMesAnterior, calcTrend, pct, margenActual, margenAnterior, ventasMes, ticketPromedio, ventasMesAnt, ticketAnterior, ratioGasto, ratioGastoAnt, compromisos, setCompromisos, ventasDiarias, setVentasDiarias, detallesModal, setDetallesModal, producciones, setProducciones, formProd, setFormProd, masasPreparadas, setMasasPreparadas, hornadas, setHornadas, handleAddMasa, handleRemoveMasa, handleMasaChange, handleAddHornada, handleRemoveHornada, handleHornadaChange, isStringField, updated, handleSaveProduccion, validHornadas, masaTotal, nueva, pinModal, setPinModal, activeTab, setActiveTab, analisisIA, setAnalisisIA, pidiendoIA, setPidiendoIA, pedirConsejoIA, contextoData, prompt, temporadaBaja, setTemporadaBaja, presupuestosMinimos, setPresupuestosMinimos, editCompraId, setEditCompraId, handleStorage, sugerencias, loading, generarSugerencias, totalCompromisosActivos, ratioCompromisosVsVentas, saludFinanciera, margen, cobertura, score, formCompromiso, setFormCompromiso, formVenta, setFormVenta, proyeccionQuincena, consejo, periodoFiltro, setPeriodoFiltro, m, q, quincenaReal, year, month, pad, lastDayOfMonth, y1, m1, d1, y2, m2, d2, inicioDate, finDate, hoyDate, hoyStr, maxTranscurrido, transcurridoTime, diasTranscurridos, totalDiasPeriodo, f, ventasTotalDia, diagnosticoFinanciero, operativos, ingresos, fijos, getLimite, compras, limite, promedioGastosMensuales, mes, numMeses, promedioInsumos, promedioOtrosGastos, totalObligaciones, coberturaActual, ventasNecesariasDiarias, diasMes, obligacionesBreakdown, alertasAutomaticas, pctInsumos, handleAddCompromiso, monto, dia, cId, nuevo, handleToggleCompromiso, handleDeleteCompromiso, handleAddVentaDiaria, ef, nq, tr, cr, cajas, sumCajas, bovedasExistentes, syncToBoveda, handleDeleteVentaDiaria, confirmarDeleteConPin, cfg, cardsData } = reportesData;
    const { formatCurrency, ventas, gastos, productos, categorias, proveedores } = props;
    


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

            {/* ── PULSO FINANCIERO ── Banner siempre visible */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Ventas mes', val: reporteActual.totalVentas, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
                    { label: 'Gastos mes', val: reporteActual.totalGastos, color: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
                    { label: 'Utilidad bruta', val: reporteActual.utilidadBruta, color: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
                    { label: 'Total compromisos', val: totalCompromisosActivos, color: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', cta: true },
                ].map(item => (
                    <div
                        key={item.label}
                        onClick={item.cta ? () => setActiveTab('quincena') : undefined}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1",
                            item.border,
                            item.cta && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                        )}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                        <span className={cn("text-xl font-black tabular-nums", item.color)}>
                            {formatCurrency(item.val)}
                        </span>
                        {item.cta && (
                            <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">
                                {compromisos.filter(c => c.activo).length} activos · Ver →
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* ── SALUD FINANCIERA ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-5 py-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Salud financiera del mes</span>
                    </div>
                    <span className={cn("text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full", saludFinanciera.bg, saludFinanciera.color)}>
                        {saludFinanciera.label} · {saludFinanciera.pct.toFixed(0)}/100
                    </span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-1000", saludFinanciera.barra)}
                        style={{ width: `${saludFinanciera.pct}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-slate-400 font-bold">Crítico</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                        Compromisos: {formatCurrency(totalCompromisosActivos)} · Margen: {margenActual.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">Saludable</span>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-14 p-1 mb-6 flex items-center justify-start gap-1 overflow-x-auto no-scrollbar w-full">
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
                    <TabsTrigger value="quincena" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
                        <CalendarCheck className="w-4 h-4" />
                        Mi Quincena
                        {totalCompromisosActivos > 0 && (
                            <span className="text-[9px] font-black bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full">
                                {compromisos.filter(c => c.activo).length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="compras-minimas" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Presupuestos
                    </TabsTrigger>
                    <TabsTrigger value="arqueo-cajas" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-cyan-600 data-[state=active]:text-white gap-2">
                        <Wallet className="w-4 h-4" />
                        Arqueo Cajas
                    </TabsTrigger>
                    <TabsTrigger value="consejero-ia" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                        <Brain className="w-4 h-4 mr-2" />
                        Consejero IA
                    </TabsTrigger>
                    <TabsTrigger value="tablero-total" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white gap-2">
                        <Shield className="w-4 h-4" />
                        Tablero Total
                        {alertasAutomaticas.filter(a => a.nivel === 'critico').length > 0 && (
                            <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                                {alertasAutomaticas.filter(a => a.nivel === 'critico').length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════════════
                    TAB 1: RESUMEN GENERAL
                ══════════════════════════════════════════════════ */}
                <TabsContent value="resumen" className="space-y-6 mt-0">
                    {/* KPI Grid — 7 tarjetas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                        {cardsData.map((card, i) => (
                            <Card
                                key={i}
                                onClick={(card as any).onClick}
                                className={cn(
                                    "rounded-2xl border-white/5 bg-card/30 backdrop-blur-md overflow-hidden group transition-all duration-300",
                                    (card as any).onClick
                                        ? "cursor-pointer hover:scale-[1.04] hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-700"
                                        : "hover:scale-[1.02]"
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={cn("p-2 rounded-xl transition-transform group-hover:rotate-12 duration-500", card.bg, card.color)}>
                                            <card.icon className="w-4 h-4" />
                                        </div>
                                        <Badge variant="outline" className={cn("text-[8px] font-black border-none px-1.5", card.color, card.bg)}>
                                            {card.trend}
                                        </Badge>
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.title}</p>
                                    <h3 className="text-lg font-black tracking-tighter text-foreground group-hover:text-indigo-400 transition-colors">
                                        {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                                    </h3>
                                    <p className="text-[8px] text-muted-foreground mt-0.5 truncate">{card.sub}</p>
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
                <GraficosEstadisticos data={{...reportesData, formatCurrency, ventas, gastos}} />

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

                {/* ══════════════════════════════════════════════════
                    TAB 4: MI QUINCENA
                ══════════════════════════════════════════════════ */}
                <DiagnosticoFinanciero data={{...reportesData, formatCurrency, ventas, gastos, formulaciones: props.formulaciones, modelosPan: props.modelosPan, onNavigateTo: props.onNavigateTo}} />

                {/* ══════════════════════════════════════════════════
                    TAB: PRESUPUESTOS (COMPRAS)
                ══════════════════════════════════════════════════ */}
                <TabsContent value="compras-minimas" className="space-y-6 mt-0">
                    {/* Header de Temporada */}
                    <Card className={cn("rounded-3xl border border-white/5 shadow-none", temporadaBaja ? "bg-cyan-950/40 border-cyan-500/20" : "bg-orange-950/40 border-orange-500/20")}>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    {temporadaBaja ? <Snowflake className="w-5 h-5 text-cyan-400" /> : <Flame className="w-5 h-5 text-orange-500" />}
                                    Temporada Actual: {temporadaBaja ? "Baja (Límites Estrictos)" : "Alta (Flujo Normal)"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Activar la temporada baja aplicará el presupuesto reducido en tus compras para cuidar la liquidez.
                                </p>
                            </div>
                            <Button 
                                onClick={() => setTemporadaBaja(!temporadaBaja)}
                                variant={temporadaBaja ? "default" : "outline"}
                                className={cn("rounded-2xl font-black h-12 px-6", temporadaBaja ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "border-orange-500/50 text-orange-500 hover:bg-orange-500/10")}
                            >
                                Cambiar a Temporada {temporadaBaja ? "Alta" : "Baja"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* ── PANEL RESUMEN DE INVERSIÓN ── */}
                    {presupuestosMinimos.length > 0 && (() => {
                        const getLimite = (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                        const getComprado = (item: any) => {
                            if (!item.proveedorId && !item.productoId) return item.estado === 'completado' ? getLimite(item) : 0;
                            const gastosRel = gastos.filter(g => 
                                (item.proveedorId && g.proveedorId === item.proveedorId) ||
                                (item.id && (g as any).presupuestoId === item.id)
                            );
                            const sumaGastos = gastosRel.reduce((sum, g) => sum + g.monto, 0);
                            return sumaGastos > 0 ? sumaGastos : (item.estado === 'completado' ? getLimite(item) : 0);
                        };

                        const semanales   = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Semanal');
                        const quincenales = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Quincenal');
                        const mensuales   = presupuestosMinimos.filter((i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal');
                        const totalSem    = semanales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalQuin   = quincenales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalMen    = mensuales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalGeneral = totalSem + totalQuin + totalMen;
                        const compradoTotal = presupuestosMinimos.reduce((s: number, i: any) => s + getComprado(i), 0);
                        const pendienteTotal = Math.max(0, totalGeneral - compradoTotal);
                        const pctComprado = totalGeneral > 0 ? Math.min(100, (compradoTotal / totalGeneral) * 100) : 0;
                        return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2 rounded-2xl p-4 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">💼 Total Inversión en el Ciclo</p>
                                    <p className="text-2xl font-black text-foreground">{formatCurrency(totalGeneral)}</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctComprado}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-1 text-[9px] font-bold">
                                        <span className="text-emerald-400">✓ Ya comprado: {formatCurrency(compradoTotal)}</span>
                                        <span className="text-rose-400">⏳ Pendiente: {formatCurrency(pendienteTotal)}</span>
                                    </div>
                                </div>
                                {totalSem > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">📅 Semanal</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalSem)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{semanales.length} proveedor{semanales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                                {totalQuin > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">📆 Quincenal</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalQuin)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{quincenales.length} proveedor{quincenales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                                {totalMen > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">🗓️ Mensual</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalMen)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{mensuales.length} proveedor{mensuales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Formulario */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Nuevo Presupuesto</CardTitle>
                                <CardDescription className="text-xs">Establece límites para no sobrecomprar</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Proveedor o Insumo</Label>
                                        <Input id="compra_proveedor" list="proveedores-insumos-list" placeholder="Ej: Postobón, Huevos..." className="h-9 text-sm rounded-xl mt-1" />
                                        <datalist id="proveedores-insumos-list">
                                            {proveedores?.map(p => <option key={`prov_${p.id}`} value={p.nombre}>Proveedor</option>)}
                                            {productos?.filter(p => p.tipo === 'ingrediente').map(p => <option key={`prod_${p.id}`} value={p.nombre}>Insumo</option>)}
                                        </datalist>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Presup. Base ($)</Label>
                                            <Input id="compra_monto" type="number" placeholder="Ej: 500000" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Presup. Baja ($)</Label>
                                            <Input id="compra_baja" type="number" placeholder="Opcional" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Frecuencia</Label>
                                            <select id="compra_frecuencia" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="Semanal">Semanal</option>
                                                <option value="Quincenal">Quincenal</option>
                                                <option value="Mensual">Mensual</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Día Preventa</Label>
                                            <select id="compra_dia_pedido" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="">No definido</option>
                                                {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Llega Pedido / Pago</Label>
                                            <select id="compra_dia_pago" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="">No definido</option>
                                                {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nota</Label>
                                            <Input id="compra_nota" placeholder="Opcional" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <Button 
                                            onClick={() => {
                                                const prov = (document.getElementById('compra_proveedor') as HTMLInputElement)?.value.trim();
                                                const montoRaw = parseFloat((document.getElementById('compra_monto') as HTMLInputElement)?.value) || 0;
                                                const bajaVal = (document.getElementById('compra_baja') as HTMLInputElement)?.value;
                                                const bajaNum = bajaVal ? parseFloat(bajaVal) : 0;
                                                const monto = montoRaw > 0 ? montoRaw : bajaNum;
                                                const baja = bajaNum > 0 ? bajaNum : monto;
                                                const frec = (document.getElementById('compra_frecuencia') as HTMLSelectElement)?.value;
                                                const diaPed = (document.getElementById('compra_dia_pedido') as HTMLSelectElement)?.value;
                                                const diaPag = (document.getElementById('compra_dia_pago') as HTMLSelectElement)?.value;
                                                const nota = (document.getElementById('compra_nota') as HTMLInputElement)?.value.trim();

                                                if (!prov) {
                                                    toast.error('El nombre del proveedor o insumo es requerido');
                                                    return;
                                                }
                                                if (monto <= 0) {
                                                    toast.error('Ingresa al menos un valor de presupuesto (Base o Baja)');
                                                    return;
                                                }

                                                // Match IDs for advanced syncing
                                                const provLower = prov.toLowerCase();
                                                const proveedorId = proveedores?.find(p => p.nombre.toLowerCase() === provLower)?.id;
                                                const productoId = productos?.find(p => p.tipo === 'ingrediente' && p.nombre.toLowerCase() === provLower)?.id;

                                                if (editCompraId) {
                                                    const updated = presupuestosMinimos.map((l: any) => l.id === editCompraId ? {
                                                        ...l, proveedor: prov, proveedorId, productoId, monto, montoBaja: baja, frecuencia: frec, diaPedido: diaPed, diaPago: diaPag, nota
                                                    } : l);
                                                    setPresupuestosMinimos(updated);
                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                    setEditCompraId(null);
                                                    toast.success('Presupuesto actualizado');
                                                } else {
                                                    const nueva = {
                                                        id: Math.random().toString(36).substring(2, 9),
                                                        proveedor: prov,
                                                        proveedorId,
                                                        productoId,
                                                        monto,
                                                        montoBaja: baja,
                                                        frecuencia: frec,
                                                        diaPedido: diaPed,
                                                        diaPago: diaPag,
                                                        nota,
                                                        estado: 'pendiente'
                                                    };
                                                    const updated = [...presupuestosMinimos, nueva];
                                                    setPresupuestosMinimos(updated);
                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                    toast.success('Presupuesto registrado');
                                                }
                                                
                                                // Reset inputs
                                                (document.getElementById('compra_proveedor') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_monto') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_baja') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = 'Semanal';
                                                (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = '';
                                                (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = '';
                                                (document.getElementById('compra_nota') as HTMLInputElement).value = '';
                                            }}
                                            size="sm" 
                                            className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-9"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> {editCompraId ? 'Actualizar' : 'Añadir'}
                                        </Button>
                                        {editCompraId && (
                                            <Button
                                                onClick={() => {
                                                    setEditCompraId(null);
                                                    (document.getElementById('compra_proveedor') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_monto') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_baja') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = 'Semanal';
                                                    (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = '';
                                                    (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = '';
                                                    (document.getElementById('compra_nota') as HTMLInputElement).value = '';
                                                }}
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-xl text-rose-500 font-black text-xs h-9"
                                            >
                                                Cancelar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Listas de control */}
                        <div className="lg:col-span-2 space-y-6">
                            {(() => {
                                const renderList = (title: string, icon: any, filterFn: (i: any) => boolean) => {
                                    const filtered = presupuestosMinimos.filter(filterFn);
                                    if (filtered.length === 0) return null;
                                    return (
                                        <Card className="rounded-3xl border-white/5 bg-card/30">
                                            <CardHeader className="pb-3 bg-white/5 rounded-t-3xl border-b border-white/5">
                                                <CardTitle className="text-sm font-black flex items-center gap-2">
                                                    {icon} {title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-3 space-y-2">
                                                {filtered.map((item: any) => {
                                                    const limiteActual = temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                                                    return (
                                                        <div key={item.id} className={cn("flex items-center gap-3 rounded-2xl p-3 border transition-colors", item.estado === 'completado' ? "border-emerald-500/30 bg-emerald-950/10" : temporadaBaja ? "border-cyan-500/20 bg-cyan-950/10" : "border-white/5 bg-card/20")}>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-black text-foreground truncate">{item.proveedor}</span>
                                                                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full", item.frecuencia === 'Semanal' ? "bg-amber-500/20 text-amber-400" : item.frecuencia === 'Quincenal' ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400")}>{item.frecuencia}</span>
                                                                </div>
                                                                {(item.diaPedido || item.diaPago) && (
                                                                    <p className="text-[9px] text-muted-foreground mt-0.5 font-bold">
                                                                        {item.diaPedido && `📝 Preventa: ${item.diaPedido}`} {item.diaPedido && item.diaPago && ' | '} {item.diaPago && `🚚 Llega y Pago: ${item.diaPago}`}
                                                                    </p>
                                                                )}
                                                                {item.nota && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">"{item.nota}"</p>}
                                                            </div>
                                                            <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                                                <div className="flex items-center gap-2">
                                                                    {temporadaBaja && item.montoBaja !== undefined && item.montoBaja < item.monto && (
                                                                        <span className="text-[10px] line-through text-muted-foreground">{formatCurrency(item.monto)}</span>
                                                                    )}
                                                                    <p className={cn("text-sm font-black", temporadaBaja ? "text-cyan-500" : "text-foreground")}>
                                                                        {formatCurrency(limiteActual)}
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-2 items-center mt-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = presupuestosMinimos.map((l: any) => l.id === item.id ? { ...l, estado: l.estado === 'completado' ? 'pendiente' : 'completado' } : l);
                                                                            setPresupuestosMinimos(updated);
                                                                            localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                        }}
                                                                        className={cn("text-[9px] font-bold px-2 py-1 rounded-lg uppercase transition-all", 
                                                                            item.estado === 'completado' ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400" : "bg-rose-500/10 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-400")}
                                                                    >
                                                                        {item.estado === 'completado' ? '✓ Comprado' : '⏳ Pendiente'}
                                                                    </button>
                                                                    <button 
                                                                        className="text-indigo-400 hover:text-indigo-300 p-1 font-bold text-[9px] uppercase tracking-wider"
                                                                        onClick={() => {
                                                                            setEditCompraId(item.id);
                                                                            (document.getElementById('compra_proveedor') as HTMLInputElement).value = item.proveedor;
                                                                            (document.getElementById('compra_monto') as HTMLInputElement).value = item.monto.toString();
                                                                            (document.getElementById('compra_baja') as HTMLInputElement).value = item.montoBaja ? item.montoBaja.toString() : '';
                                                                            (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = item.frecuencia;
                                                                            (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = item.diaPedido || '';
                                                                            (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = item.diaPago || '';
                                                                            (document.getElementById('compra_nota') as HTMLInputElement).value = item.nota || '';
                                                                            // Scroll to top of tab
                                                                            document.getElementById('compra_proveedor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                            toast.info('Modificando presupuesto...');
                                                                        }}
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                    <button 
                                                                        className="text-rose-500 hover:text-rose-400 p-1"
                                                                        onClick={() => {
                                                                            const updated = presupuestosMinimos.filter((l: any) => l.id !== item.id);
                                                                            setPresupuestosMinimos(updated);
                                                                            localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    );
                                };

                                return (
                                    <>
                                        {renderList("Control Semanal", <CalendarDays className="w-4 h-4 text-amber-500" />, (i: any) => i.frecuencia === 'Semanal')}
                                        {renderList("Control Quincenal", <CalendarRange className="w-4 h-4 text-violet-500" />, (i: any) => i.frecuencia === 'Quincenal')}
                                        {renderList("Control Mensual / Otros", <List className="w-4 h-4 text-blue-500" />, (i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal')}
                                        {presupuestosMinimos.length === 0 && (
                                            <div className="text-center py-12 border border-dashed rounded-3xl border-white/10 flex flex-col items-center gap-3">
                                                <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                                                <p className="text-sm font-medium text-muted-foreground">No hay presupuestos registrados.</p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Motor Predictivo de Inventario */}
                    <Card className="rounded-3xl border border-white/5 bg-card/30 mt-6">
                        <CardHeader className="pb-3 border-b border-white/5 bg-gradient-to-r from-blue-950/20 to-purple-950/20 rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-black flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-blue-400" />
                                        Asistente Predictivo de Pedidos
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Analiza la velocidad de ventas y sugiere cuánto pedir para no quedarte sin stock
                                    </CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="rounded-xl h-9 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => generarSugerencias()}
                                    disabled={loading}
                                >
                                    {loading ? 'Analizando...' : 'Recalcular'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                    <p className="text-sm text-muted-foreground">Calculando algoritmos de rotación...</p>
                                </div>
                            ) : sugerencias.length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No hay sugerencias de pedido. ¡Tu inventario está perfecto!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {sugerencias.map(sug => {
                                        let cantidadFinal = sug.cantidadSugeridaTotal;
                                        if (temporadaBaja) {
                                            // Reducimos 20% en temporada baja
                                            cantidadFinal = Math.max(0, Math.floor(cantidadFinal * 0.8));
                                        }

                                        let pacas = 0;
                                        let sueltas = cantidadFinal;
                                        if (sug.cantidadEmbalaje && sug.cantidadEmbalaje > 1) {
                                            pacas = Math.floor(cantidadFinal / sug.cantidadEmbalaje);
                                            sueltas = cantidadFinal % sug.cantidadEmbalaje;
                                        }

                                        return (
                                            <div key={sug.productoId} className={cn("p-4 rounded-2xl border transition-colors relative overflow-hidden", 
                                                sug.diasAgotado > 0 ? "border-rose-500/30 bg-rose-950/10" : "border-white/5 bg-card/40"
                                            )}>
                                                {sug.diasAgotado > 0 && (
                                                    <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">
                                                        Agotado hace {sug.diasAgotado} días
                                                    </div>
                                                )}
                                                
                                                <h4 className="text-sm font-black text-foreground mb-1 pr-16 truncate" title={sug.productoNombre}>
                                                    {sug.productoNombre}
                                                </h4>
                                                
                                                <div className="flex items-center justify-between mt-3 text-xs">
                                                    <div className="text-muted-foreground">
                                                        Stock: <span className="font-bold text-foreground">{sug.stockActual}</span>
                                                    </div>
                                                    <div className="text-muted-foreground text-right">
                                                        Venta D.: <span className="font-bold text-foreground">{sug.velocidadDiaria}/día</span>
                                                    </div>
                                                </div>

                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <p className="text-[10px] uppercase font-black text-blue-400 mb-1">
                                                        {temporadaBaja ? 'Sugerencia (Modo Baja)' : 'Sugerencia Ideal'}
                                                    </p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-foreground">{cantidadFinal}</span>
                                                        <span className="text-xs text-muted-foreground">unidades totales</span>
                                                    </div>
                                                    
                                                    {sug.cantidadEmbalaje && pacas > 0 && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-1 rounded-md w-fit">
                                                            <Package className="w-3.5 h-3.5" />
                                                            Pedir: {pacas} {sug.tipoEmbalaje || 'Paca'}{pacas !== 1 ? 's' : ''} {sueltas > 0 ? `+ ${sueltas} und` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 5.5: ARQUEO DE CAJAS
                ══════════════════════════════════════════════════ */}
                <TabsContent value="arqueo-cajas" className="space-y-6 mt-0">
                    <ArqueoCajas ventasDiarias={ventasDiarias} />
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 6: TABLERO DE OBLIGACIONES TOTALES
                ══════════════════════════════════════════════════ */}
                <TablaFlujoCaja data={{...reportesData, formatCurrency, ventas, gastos}} />
            </Tabs>

            {/* Modal PIN — Eliminar venta diaria */}
            {pinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
                        <div className="text-center space-y-1">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-2">
                                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Eliminar venta</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Ingresa el PIN de gerente para continuar</p>
                        </div>
                        <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="PIN gerente"
                            value={pinModal.pin}
                            onChange={e => setPinModal(prev => prev ? { ...prev, pin: e.target.value, error: '' } : null)}
                            onKeyDown={e => e.key === 'Enter' && confirmarDeleteConPin()}
                            className="text-center text-lg font-black tracking-[0.4em] h-12"
                            autoFocus
                        />
                        {pinModal.error && (
                            <p className="text-[11px] font-bold text-rose-500 text-center">{pinModal.error}</p>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => setPinModal(null)}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 h-10 text-sm bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmarDeleteConPin}>
                                Eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalles Tarjetas */}
            <Dialog open={!!detallesModal} onOpenChange={(open) => !open && setDetallesModal(null)}>
                <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10 rounded-[2rem] p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            {detallesModal === 'ingresos' && 'Desglose de Ingresos'}
                            {detallesModal === 'proveedores' && 'Tope de Proveedores'}
                            {detallesModal === 'fijos' && 'Gastos Fijos y Nómina'}
                            {detallesModal === 'diarios' && 'Gastos Operativos (Diarios)'}
                            {detallesModal === 'neta' && 'Ganancia Neta'}
                            {detallesModal === 'ventas_hoy' && 'Detalle Ventas de Hoy'}
                            {detallesModal === 'proyeccion_ventas' && 'Proyección de Ventas'}
                            {detallesModal === 'proyeccion_costos' && 'Proyección de Costos'}
                            {detallesModal === 'proyeccion_compromisos' && 'Proyección de Compromisos'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                            {detallesModal === 'ingresos' && 'Suma total del efectivo de cajas y métodos digitales de las ventas de la quincena.'}
                            {detallesModal === 'proveedores' && 'Lista de todos los presupuestos activos proyectados como tope para esta quincena.'}
                            {detallesModal === 'fijos' && 'Compromisos fijos que tocan pago en esta quincena.'}
                            {detallesModal === 'diarios' && 'Salidas de caja diarias durante el turno.'}
                            {detallesModal === 'neta' && 'Cálculo final: Ingresos - (Proveedores + Fijos + Diarios).'}
                            {detallesModal === 'ventas_hoy' && 'Desglose exacto de las ventas registradas el día de hoy.'}
                            {detallesModal === 'proyeccion_ventas' && 'Cálculo estimado basado en tu promedio de ventas diarias y los días que faltan para terminar la quincena.'}
                            {detallesModal === 'proyeccion_costos' && 'Se asume que la mitad de lo vendido se reinvierte en materia prima para seguir produciendo.'}
                            {detallesModal === 'proyeccion_compromisos' && 'La suma de tus deudas, servicios y salarios programados para estos 15 días.'}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {detallesModal === 'ingresos' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <span className="text-sm font-bold text-emerald-400">Ingreso por Ventas POS</span>
                                    <span className="text-sm font-black text-emerald-500">{formatCurrency(quincenaReal.ventasTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                                    <span className="text-sm font-bold text-rose-400">Reintegro de Gastos Diarios</span>
                                    <span className="text-sm font-black text-rose-500">+{formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL INGRESOS BRUTOS</span>
                                    <span className="text-lg font-black text-emerald-400">{formatCurrency(diagnosticoFinanciero.ingresos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proveedores' && (
                            <div className="space-y-2">
                                {presupuestosMinimos.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay presupuestos activos</p>}
                                {presupuestosMinimos.map((p: any, i: number) => {
                                    const limite = temporadaBaja && p.montoBaja !== undefined ? p.montoBaja : p.monto;
                                    let multiplicador = 1;
                                    if (periodoFiltro.quincena === 'mes') {
                                        if (p.frecuencia === 'Semanal') multiplicador = 4;
                                        else if (p.frecuencia === 'Quincenal') multiplicador = 2;
                                    } else {
                                        if (p.frecuencia === 'Semanal') multiplicador = 2;
                                        else if (p.frecuencia === 'Mensual') multiplicador = 0.5;
                                    }
                                    const proyectado = limite * multiplicador;
                                    return (
                                        <div key={i} className="flex flex-col bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{p.proveedor} <span className="text-[9px] font-normal uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">{p.frecuencia}</span></p>
                                                <span className="text-sm font-black text-amber-500">{formatCurrency(limite)}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <p className="text-[10px] text-muted-foreground italic">Se paga al recibir pedido</p>
                                                <p className="text-[10px] text-slate-400">Total {periodoFiltro.quincena === 'mes' ? 'mes' : 'quincena'}: <strong className="text-slate-500 dark:text-slate-300">{formatCurrency(proyectado)}</strong></p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL TOPE PROVEEDORES</span>
                                    <span className="text-lg font-black text-amber-500">{formatCurrency(diagnosticoFinanciero.compras)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'fijos' && (
                            <div className="space-y-2">
                                {compromisos.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay compromisos fijos activos</p>}
                                {compromisos.filter(c => c.activo).map((c, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{c.nombre}</p>
                                            <p className="text-[10px] text-muted-foreground">{c.categoria} - Día {c.diaDeCobro}</p>
                                        </div>
                                        <span className="text-sm font-black text-violet-500">{formatCurrency(c.monto)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL GASTOS FIJOS</span>
                                    <span className="text-lg font-black text-violet-500">{formatCurrency(diagnosticoFinanciero.fijos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'diarios' && (
                            <div className="space-y-2">
                                {ventasDiarias.filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr && v.cajas && v.cajas['Gastos/Salidas']).length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay gastos diarios en este periodo</p>}
                                {ventasDiarias
                                    .filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr && v.cajas && v.cajas['Gastos/Salidas'])
                                    .map((v, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white">{v.fecha}</p>
                                                <p className="text-[10px] text-muted-foreground">Turno: {v.turno}</p>
                                            </div>
                                            <span className="text-sm font-black text-rose-500">{formatCurrency(v.cajas!['Gastos/Salidas'])}</span>
                                        </div>
                                    ))}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL GASTOS DIARIOS</span>
                                    <span className="text-lg font-black text-rose-500">{formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'neta' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <span className="text-sm font-bold text-emerald-400">Total Ingresos</span>
                                    <span className="text-sm font-black text-emerald-500">{formatCurrency(diagnosticoFinanciero.ingresos)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                    <span className="text-sm font-bold text-amber-400">- Proveedores (Tope)</span>
                                    <span className="text-sm font-black text-amber-500">- {formatCurrency(diagnosticoFinanciero.compras)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-violet-500/10 p-3 rounded-xl border border-violet-500/20">
                                    <span className="text-sm font-bold text-violet-400">- Gastos Fijos</span>
                                    <span className="text-sm font-black text-violet-500">- {formatCurrency(diagnosticoFinanciero.fijos)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                                    <span className="text-sm font-bold text-rose-400">- Gastos Diarios</span>
                                    <span className="text-sm font-black text-rose-500">- {formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-card/60 rounded-2xl border border-slate-200 dark:border-white/10 mt-4 shadow-lg">
                                    <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Ganancia Neta Real</span>
                                    <span className={cn("text-2xl font-black", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {formatCurrency(diagnosticoFinanciero.gananciaNeta)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'ventas_hoy' && (
                            <div className="space-y-4 pt-2">
                                {(() => {
                                    const ventasPOSHoy = ventas.filter(v => v.fecha.slice(0, 10) === quincenaReal.hoyStr);
                                    const totalPOSHoy = ventasPOSHoy.reduce((sum, v) => sum + v.total, 0);
                                    const ventasManualesHoy = ventasDiarias.filter(v => v.fecha === quincenaReal.hoyStr);
                                    const totalManualHoy = ventasManualesHoy.reduce((sum, v) => sum + v.total, 0);
                                    
                                    return (
                                        <>
                                            <div className="bg-card/40 rounded-xl p-4 border border-white/5">
                                                <h4 className="text-xs font-black uppercase text-amber-500 mb-3 flex justify-between">
                                                    <span>Cierres de Turno (Manual)</span>
                                                    <span>{formatCurrency(totalManualHoy)}</span>
                                                </h4>
                                                {ventasManualesHoy.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center italic">No hay cierres de caja hoy</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {ventasManualesHoy.map(v => (
                                                            <div key={v.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                                <div>
                                                                    <span className="font-bold">{v.turno || 'Turno'}</span>
                                                                    {v.hora && <span className="text-[10px] text-muted-foreground ml-2">({v.hora})</span>}
                                                                </div>
                                                                <span className="font-black text-amber-400">+{formatCurrency(v.total)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-card/40 rounded-xl p-4 border border-white/5">
                                                <h4 className="text-xs font-black uppercase text-emerald-500 mb-3 flex justify-between">
                                                    <span>Ventas Directas POS</span>
                                                    <span>{formatCurrency(totalPOSHoy)}</span>
                                                </h4>
                                                {ventasPOSHoy.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center italic">No hay ventas directas hoy</p>
                                                ) : (
                                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                                        {ventasPOSHoy.map(v => (
                                                            <div key={v.id} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                                                                <span className="truncate text-muted-foreground">{v.items?.map(i => i.cantidad + 'x ' + (productos?.find(p => p.id === i.productoId)?.nombre || 'Item')).join(', ')}</span>
                                                                <span className="font-black text-emerald-400 shrink-0 ml-2">+{formatCurrency(v.total)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center pt-2 px-2 border-t border-white/10">
                                                <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Total Día</span>
                                                <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalManualHoy + totalPOSHoy)}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {detallesModal === 'proyeccion_ventas' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Calculamos cuánto venderás en total esta quincena tomando tu promedio diario de ventas y multiplicándolo por los días que faltan.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Ventas reales hasta hoy:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(quincenaReal.ventasTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Promedio de venta diaria:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(quincenaReal.ventasTotal / quincenaReal.diasTranscurridos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Días restantes del periodo:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{Math.max(0, quincenaReal.totalDiasPeriodo - quincenaReal.diasTranscurridos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 font-black">
                                        <span>Total Proyectado:</span> 
                                        <span>{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proyeccion_costos' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Todo negocio de panadería tiene costos fijos de insumos (harina, huevos, etc). Por seguridad financiera, el sistema aparta automáticamente el 50% de las ventas como costo de reposición.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Ventas Proyectadas:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-400 font-black">
                                        <span>Costo a reponer (50%):</span> 
                                        <span>-{formatCurrency(proyeccionQuincena.ingresoEsperado - proyeccionQuincena.utilidadBrutaEsperada)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proyeccion_compromisos' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Esta es la suma del dinero que debe salir obligatoriamente en esta quincena para cumplir tus obligaciones operativas y legales.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Compromisos Fijos (arriendos, servicios, etc):</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency(proyeccionQuincena.totalCompromisos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Nómina y Salarios:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency(proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-rose-600 dark:text-rose-400 font-black">
                                        <span>Total Obligaciones:</span> 
                                        <span>-{formatCurrency(proyeccionQuincena.totalCompromisos + proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}

