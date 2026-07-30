
import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area, ReferenceLine } from 'recharts';
import { Package, TrendingUp, TrendingDown, Target, Layers, DollarSign, Activity, ShoppingBag, Brain, CalendarCheck, Shield, Plus, Trash2, CalendarDays, Wallet, BadgeAlert, CheckCircle2, AlertTriangle, XCircle, User, Flame, LifeBuoy, Gauge, Snowflake, CalendarRange, List, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function GraficosEstadisticos({ data }: { data: any }) {
    const { role, currentMonth, reporteActual, comparativoData, date, periodo, r, proyeccion, hoy, diaActual, diasDelMes, ventasMesActual, tasaDiaria, rentabilidadProductos, prod, totalVentasProductos, gastosData, ventasMetodoData, prevPeriodo, d, reporteMesAnterior, calcTrend, pct, margenActual, margenAnterior, ventasMes, ticketPromedio, ventasMesAnt, ticketAnterior, ratioGasto, ratioGastoAnt, compromisos, setCompromisos, ventasDiarias, setVentasDiarias, detallesModal, setDetallesModal, producciones, setProducciones, formProd, setFormProd, masasPreparadas, setMasasPreparadas, hornadas, setHornadas, handleAddMasa, handleRemoveMasa, handleMasaChange, handleAddHornada, handleRemoveHornada, handleHornadaChange, isStringField, updated, handleSaveProduccion, validHornadas, masaTotal, nueva, pinModal, setPinModal, activeTab, setActiveTab, analisisIA, setAnalisisIA, pidiendoIA, setPidiendoIA, pedirConsejoIA, contextoData, prompt, temporadaBaja, setTemporadaBaja, presupuestosMinimos, setPresupuestosMinimos, editCompraId, setEditCompraId, handleStorage, sugerencias, loading, generarSugerencias, totalCompromisosActivos, ratioCompromisosVsVentas, saludFinanciera, margen, cobertura, score, formCompromiso, setFormCompromiso, formVenta, setFormVenta, proyeccionQuincena, consejo, periodoFiltro, setPeriodoFiltro, m, q, quincenaReal, year, month, pad, lastDayOfMonth, y1, m1, d1, y2, m2, d2, inicioDate, finDate, hoyDate, hoyStr, maxTranscurrido, transcurridoTime, diasTranscurridos, totalDiasPeriodo, f, ventasTotalDia, diagnosticoFinanciero, operativos, ingresos, fijos, getLimite, compras, limite, promedioGastosMensuales, mes, numMeses, promedioInsumos, promedioOtrosGastos, totalObligaciones, coberturaActual, ventasNecesariasDiarias, diasMes, obligacionesBreakdown, alertasAutomaticas, pctInsumos, handleAddCompromiso, monto, dia, cId, nuevo, handleToggleCompromiso, handleDeleteCompromiso, handleAddVentaDiaria, ef, nq, tr, cr, cajas, sumCajas, bovedasExistentes, syncToBoveda, handleDeleteVentaDiaria, confirmarDeleteConPin, cfg, cardsData, formatCurrency, ventas, gastos } = data;
    
    // Add COLORS if needed
    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];
    
    return (
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
                            <Card key={i} className="rounded-3xl border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-card/30 backdrop-blur-md overflow-hidden">
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

                    {/* Rendimiento de Eventos Especiales */}
                    {data.eventosStats && data.eventosStats.length > 0 && (
                        <div className="mt-8 space-y-4">
                            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-indigo-500" /> Rendimiento en Días de Subsidios / Eventos
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {data.eventosStats.map((evt: any, i: number) => (
                                    <Card key={i} className="rounded-[2rem] border-white/5 bg-card/40 backdrop-blur-md overflow-hidden shadow-lg hover:bg-card/60 transition-colors">
                                        <CardContent className="p-5 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex flex-col items-center justify-center shrink-0 border border-indigo-500/20">
                                                <CalendarDays className="w-5 h-5 text-indigo-500 mb-1" />
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">{evt.diasCount} {evt.diasCount === 1 ? 'día' : 'días'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground truncate">{evt.evento}</p>
                                                <p className="text-xl font-black text-foreground tabular-nums tracking-tighter">
                                                    {data.formatCurrency(evt.total)}
                                                </p>
                                                <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-0.5">
                                                    <TrendingUp className="w-3 h-3" /> Promedio: {data.formatCurrency(evt.promedioDiario)}/día
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>
    );
}
