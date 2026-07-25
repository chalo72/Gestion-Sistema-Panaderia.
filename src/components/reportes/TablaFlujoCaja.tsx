
import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area, ReferenceLine } from 'recharts';
import { Package, TrendingUp, TrendingDown, Target, Layers, DollarSign, Activity, ShoppingBag, Brain, CalendarCheck, Shield, Plus, Trash2, CalendarDays, Wallet, BadgeAlert, CheckCircle2, AlertTriangle, XCircle, User, Flame, LifeBuoy, Gauge, Snowflake, CalendarRange, List, Percent, PieChart as PieChartIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function TablaFlujoCaja({ data }: { data: any }) {
    const { role, currentMonth, reporteActual, comparativoData, date, periodo, r, proyeccion, hoy, diaActual, diasDelMes, ventasMesActual, tasaDiaria, rentabilidadProductos, prod, totalVentasProductos, gastosData, ventasMetodoData, prevPeriodo, d, reporteMesAnterior, calcTrend, pct, margenActual, margenAnterior, ventasMes, ticketPromedio, ventasMesAnt, ticketAnterior, ratioGasto, ratioGastoAnt, compromisos, setCompromisos, ventasDiarias, setVentasDiarias, detallesModal, setDetallesModal, producciones, setProducciones, formProd, setFormProd, masasPreparadas, setMasasPreparadas, hornadas, setHornadas, handleAddMasa, handleRemoveMasa, handleMasaChange, handleAddHornada, handleRemoveHornada, handleHornadaChange, isStringField, updated, handleSaveProduccion, validHornadas, masaTotal, nueva, pinModal, setPinModal, activeTab, setActiveTab, analisisIA, setAnalisisIA, pidiendoIA, setPidiendoIA, pedirConsejoIA, contextoData, prompt, temporadaBaja, setTemporadaBaja, presupuestosMinimos, setPresupuestosMinimos, editCompraId, setEditCompraId, handleStorage, sugerencias, loading, generarSugerencias, totalCompromisosActivos, ratioCompromisosVsVentas, saludFinanciera, margen, cobertura, score, formCompromiso, setFormCompromiso, formVenta, setFormVenta, proyeccionQuincena, consejo, periodoFiltro, setPeriodoFiltro, m, q, quincenaReal, year, month, pad, lastDayOfMonth, y1, m1, d1, y2, m2, d2, inicioDate, finDate, hoyDate, hoyStr, maxTranscurrido, transcurridoTime, diasTranscurridos, totalDiasPeriodo, f, ventasTotalDia, diagnosticoFinanciero, operativos, ingresos, fijos, getLimite, compras, limite, promedioGastosMensuales, mes, numMeses, promedioInsumos, promedioOtrosGastos, totalObligaciones, coberturaActual, ventasNecesariasDiarias, diasMes, obligacionesBreakdown, alertasAutomaticas, pctInsumos, handleAddCompromiso, monto, dia, cId, nuevo, handleToggleCompromiso, handleDeleteCompromiso, handleAddVentaDiaria, ef, nq, tr, cr, cajas, sumCajas, bovedasExistentes, syncToBoveda, handleDeleteVentaDiaria, confirmarDeleteConPin, cfg, cardsData, formatCurrency, ventas, gastos } = data;
    
    // Add COLORS if needed
    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];
    
    return (
        <TabsContent value="tablero-total" className="space-y-6 mt-0">

                    {/* ── Fuente de datos — transparencia ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'Ventas del mes (POS)',
                                val: reporteActual.totalVentas,
                                sub: 'Fuente: transacciones reales del sistema',
                                color: 'text-emerald-500',
                                border: 'border-emerald-200 dark:border-emerald-800',
                                empty: reporteActual.totalVentas === 0,
                            },
                            {
                                label: 'Compromisos fijos activos',
                                val: totalCompromisosActivos,
                                sub: `${compromisos.filter(c=>c.activo).length} registrados · Fuente: tab Mi Quincena`,
                                color: 'text-violet-500',
                                border: 'border-violet-200 dark:border-violet-800',
                                empty: totalCompromisosActivos === 0,
                            },
                            {
                                label: 'Prom. insumos/mes',
                                val: promedioInsumos,
                                sub: `Basado en ${Object.keys(promedioGastosMensuales).length > 0 ? 'gastos históricos reales' : 'sin gastos registrados'}`,
                                color: 'text-amber-500',
                                border: 'border-amber-200 dark:border-amber-800',
                                empty: promedioInsumos === 0,
                            },
                            {
                                label: 'Total obligaciones',
                                val: totalObligaciones,
                                sub: 'Compromisos + Insumos + Otros gastos',
                                color: totalObligaciones > reporteActual.totalVentas ? 'text-rose-500' : 'text-cyan-500',
                                border: totalObligaciones > reporteActual.totalVentas ? 'border-rose-200 dark:border-rose-800' : 'border-cyan-200 dark:border-cyan-800',
                                empty: totalObligaciones === 0,
                            },
                        ].map(item => (
                            <div key={item.label} className={cn(
                                "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1",
                                item.border
                            )}>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                                {item.empty
                                    ? <span className="text-sm font-black text-slate-400">Sin datos aún</span>
                                    : <span className={cn("text-xl font-black tabular-nums", item.color)}>{formatCurrency(item.val)}</span>
                                }
                                <span className="text-[9px] text-slate-400 font-bold leading-tight">{item.sub}</span>
                            </div>
                        ))}
                    </div>

                    {/* Aviso si faltan datos clave */}
                    {(totalCompromisosActivos === 0 || totalObligaciones === 0) && (
                        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-amber-400">Completa tus datos para ver el tablero real</p>
                                <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5 list-disc ml-4">
                                    {totalCompromisosActivos === 0 && <li>Ve a <strong>Mi Quincena</strong> y registra tus compromisos fijos (arriendo, servicios, préstamos, salarios)</li>}
                                    {promedioInsumos === 0 && <li>Registra gastos de <strong>Materia Prima</strong> en el módulo Finanzas para que el promedio de insumos sea real</li>}
                                    {reporteActual.totalVentas === 0 && <li>Las ventas del mes aún no se han registrado en el POS</li>}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ── Cobertura gauge principal ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2 rounded-3xl border-white/5 bg-card/30 overflow-hidden">
                            <CardHeader className="pb-3 px-6 pt-5">
                                <div className="flex items-center gap-2">
                                    <Gauge className="w-5 h-5 text-rose-400" />
                                    <CardTitle className="text-base font-black uppercase tracking-tight">Cobertura de Obligaciones</CardTitle>
                                </div>
                                <CardDescription className="text-[11px]">¿Cuánto de tus obligaciones totales cubren las ventas de este mes?</CardDescription>
                            </CardHeader>
                            <CardContent className="px-6 pb-6 space-y-5">
                                {/* Barra de cobertura */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                                            Ventas: {formatCurrency(reporteActual.totalVentas)}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase",
                                            coberturaActual >= 120 ? 'text-emerald-400' : coberturaActual >= 80 ? 'text-amber-400' : 'text-rose-400'
                                        )}>
                                            {coberturaActual.toFixed(0)}% cubierto
                                        </span>
                                    </div>
                                    <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2",
                                                coberturaActual >= 120 ? 'bg-emerald-500' : coberturaActual >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                                            )}
                                            style={{ width: `${Math.min(100, coberturaActual)}%` }}
                                        >
                                            {coberturaActual >= 30 && (
                                                <span className="text-[9px] font-black text-white">{coberturaActual.toFixed(0)}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[9px] text-slate-400 font-bold">Crítico</span>
                                        <span className="text-[9px] text-slate-400 font-bold">Obligaciones: {formatCurrency(totalObligaciones)}</span>
                                        <span className="text-[9px] text-slate-400 font-bold">Saludable &gt;120%</span>
                                    </div>
                                </div>

                                {/* KPIs de obligaciones */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Compromisos fijos', val: totalCompromisosActivos, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                                        { label: 'Prom. insumos/mes', val: promedioInsumos, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                        { label: 'Prom. otros gastos', val: promedioOtrosGastos, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                                    ].map(item => (
                                        <div key={item.label} className={cn("rounded-2xl p-3 border border-white/5", item.bg)}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                                            <p className={cn("text-lg font-black", item.color)}>{formatCurrency(item.val)}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Ventas mínimas para sobrevivir */}
                                <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-4 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                                            <LifeBuoy className="w-5 h-5 text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ventas mínimas para sobrevivir</p>
                                            <p className="text-2xl font-black text-white">{formatCurrency(totalObligaciones)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Necesitas vender al día</p>
                                        <p className="text-xl font-black text-amber-400">{formatCurrency(ventasNecesariasDiarias)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Donut de breakdown */}
                        <Card className="rounded-3xl border-white/5 bg-card/30 overflow-hidden">
                            <CardHeader className="pb-2 px-5 pt-5">
                                <CardTitle className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4 text-violet-400" /> Distribución de obligaciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                {obligacionesBreakdown.length > 0 ? (
                                    <>
                                        <div className="h-[160px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={obligacionesBreakdown} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                        {obligacionesBreakdown.map((item, index) => (
                                                            <Cell key={index} fill={item.color} stroke="rgba(255,255,255,0.05)" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                        itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                        formatter={(value: number) => formatCurrency(value)}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {obligacionesBreakdown.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="text-[10px] font-bold text-muted-foreground truncate">{item.name}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-foreground shrink-0">{formatCurrency(item.value)}</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">Total obligaciones</span>
                                                <span className="text-sm font-black text-foreground">{formatCurrency(totalObligaciones)}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center">
                                        <p className="text-xs text-muted-foreground text-center">Sin datos de obligaciones registrados aún.<br />Agrega compromisos o registra gastos.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Alertas automáticas ── */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BadgeAlert className="w-4 h-4 text-rose-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alertas del sistema</h3>
                            <div className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-full",
                                alertasAutomaticas.some(a => a.nivel === 'critico') ? 'bg-rose-500/20 text-rose-400' :
                                alertasAutomaticas.some(a => a.nivel === 'advertencia') ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                            )}>
                                {alertasAutomaticas.filter(a => a.nivel === 'critico').length} críticas · {alertasAutomaticas.filter(a => a.nivel === 'advertencia').length} advertencias
                            </div>
                        </div>
                        <div className="space-y-2">
                            {alertasAutomaticas.map((alerta, i) => (
                                <div key={i} className={cn(
                                    "rounded-2xl border p-4 flex gap-3",
                                    alerta.nivel === 'critico' ? 'border-rose-500/30 bg-rose-500/5' :
                                    alerta.nivel === 'advertencia' ? 'border-amber-500/30 bg-amber-500/5' :
                                    'border-emerald-500/30 bg-emerald-500/5'
                                )}>
                                    <span className="text-lg shrink-0 leading-none mt-0.5">{alerta.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={cn(
                                                "text-xs font-black",
                                                alerta.nivel === 'critico' ? 'text-rose-400' :
                                                alerta.nivel === 'advertencia' ? 'text-amber-400' :
                                                'text-emerald-400'
                                            )}>{alerta.titulo}</p>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{alerta.msg}</p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                                            <p className="text-[11px] font-bold text-foreground">{alerta.accion}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Resumen estratégico ── */}
                    <Card className="rounded-3xl border-white/5 bg-gradient-to-br from-violet-950/40 to-slate-900 overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-violet-400">Diagnóstico rápido</p>
                                    <p className="text-[10px] text-muted-foreground">Basado en datos reales de tu negocio</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    {
                                        label: 'Situación actual',
                                        valor: coberturaActual >= 120 ? 'Solvente' : coberturaActual >= 80 ? 'Ajustado' : 'En riesgo',
                                        desc: coberturaActual >= 120
                                            ? 'Tus ventas superan tus obligaciones. Tienes excedente.'
                                            : coberturaActual >= 80
                                            ? 'Cubres lo básico pero sin margen de seguridad.'
                                            : 'Las ventas actuales no alcanzan a cubrir todas las obligaciones.',
                                        color: coberturaActual >= 120 ? 'text-emerald-400' : coberturaActual >= 80 ? 'text-amber-400' : 'text-rose-400',
                                    },
                                    {
                                        label: 'Meta mensual recomendada',
                                        valor: formatCurrency(totalObligaciones * 1.3),
                                        desc: 'Obligaciones × 1.3 — el 30% extra es tu colchón de ahorro y emergencias.',
                                        color: 'text-indigo-400',
                                    },
                                    {
                                        label: 'Excedente / Déficit mes',
                                        valor: formatCurrency(reporteActual.totalVentas - totalObligaciones),
                                        desc: reporteActual.totalVentas >= totalObligaciones
                                            ? 'Tienes excedente este mes. Considera guardarlo como fondo de emergencia.'
                                            : 'Hay déficit. Cada peso que puedas ahorrar en gastos ayuda a cerrar esta brecha.',
                                        color: reporteActual.totalVentas >= totalObligaciones ? 'text-emerald-400' : 'text-rose-400',
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                                        <p className={cn("text-lg font-black mb-1", item.color)}>{item.valor}</p>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
    );
}
