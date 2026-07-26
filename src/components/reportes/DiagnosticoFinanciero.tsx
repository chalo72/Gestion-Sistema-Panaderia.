
import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area, ReferenceLine } from 'recharts';
import { Package, TrendingUp, TrendingDown, Target, Layers, DollarSign, Activity, ShoppingBag, Brain, CalendarCheck, Shield, Plus, Trash2, CalendarDays, Wallet, BadgeAlert, CheckCircle2, AlertTriangle, XCircle, User, Flame, LifeBuoy, Gauge, Snowflake, CalendarRange, List, Percent, Sparkles, Bot, Loader2, ClipboardCheck, BellRing, Scale, CheckCheck, Save, ClipboardList, History, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModeloPanModal } from '@/components/produccion/ModeloPanModal';
import { Button } from '@/components/ui/button';
import { deleteProduccion, getProducciones } from '@/lib/finanzas-personales';
import { toast } from 'sonner';

export function DiagnosticoFinanciero({ data, addMovimientoBoveda }: { data: any, addMovimientoBoveda: any }) {
    const { role, currentMonth, reporteActual, comparativoData, date, periodo, r, proyeccion, hoy, diaActual, diasDelMes, ventasMesActual, tasaDiaria, rentabilidadProductos, prod, totalVentasProductos, gastosData, ventasMetodoData, prevPeriodo, d, reporteMesAnterior, calcTrend, pct, margenActual, margenAnterior, ventasMes, ticketPromedio, ventasMesAnt, ticketAnterior, ratioGasto, ratioGastoAnt, compromisos, setCompromisos, ventasDiarias, setVentasDiarias, detallesModal, setDetallesModal, producciones, setProducciones, formProd, setFormProd, editProduccionId, setEditProduccionId, masasPreparadas, setMasasPreparadas, hornadas, setHornadas, handleAddMasa, handleRemoveMasa, handleMasaChange, handleAddHornada, handleRemoveHornada, handleHornadaChange, isStringField, updated, handleSaveProduccion, validHornadas, masaTotal, nueva, pinModal, setPinModal, activeTab, setActiveTab, analisisIA, setAnalisisIA, pidiendoIA, setPidiendoIA, pedirConsejoIA, contextoData, prompt, temporadaBaja, setTemporadaBaja, presupuestosMinimos, setPresupuestosMinimos, editCompraId, setEditCompraId, handleStorage, sugerencias, loading, generarSugerencias, totalCompromisosActivos, ratioCompromisosVsVentas, saludFinanciera, margen, cobertura, score, formCompromiso, setFormCompromiso, formVenta, setFormVenta, proyeccionQuincena, consejo, periodoFiltro, setPeriodoFiltro, m, q, quincenaReal, year, month, pad, lastDayOfMonth, y1, m1, d1, y2, m2, d2, inicioDate, finDate, hoyDate, hoyStr, maxTranscurrido, transcurridoTime, diasTranscurridos, totalDiasPeriodo, f, ventasTotalDia, diagnosticoFinanciero, operativos, ingresos, fijos, getLimite, compras, limite, promedioGastosMensuales, mes, numMeses, promedioInsumos, promedioOtrosGastos, totalObligaciones, coberturaActual, ventasNecesariasDiarias, diasMes, obligacionesBreakdown, alertasAutomaticas, pctInsumos, handleAddCompromiso, monto, dia, cId, nuevo, handleToggleCompromiso, handleDeleteCompromiso, handleAddVentaDiaria, ef, nq, tr, cr, cajas, sumCajas, bovedasExistentes, syncToBoveda, handleDeleteVentaDiaria, confirmarDeleteConPin, cfg, cardsData, formatCurrency, ventas, gastos, formulaciones, modelosPan, onNavigateTo } = data;


    
    // Add COLORS if needed
    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];
    const [pctCrecimiento, setPctCrecimiento] = React.useState(5);
    const [isModeloModalOpen, setIsModeloModalOpen] = React.useState(false);

    const opcionesArrobas = [
        { label: "1 Libra (~500g)", val: 0.04 },
        { label: "2 Libras (~1kg)", val: 0.08 },
        { label: "3 Libras (~1.5kg)", val: 0.12 },
        { label: "4 Libras (~2kg)", val: 0.16 },
        { label: "5 Libras (~2.5kg)", val: 0.2 },
        { label: "Cuarto de Arroba (¼)", val: 0.25 },
        { label: "Media Arroba (½)", val: 0.5 },
        { label: "Tres cuartos de Arroba (¾)", val: 0.75 },
        { label: "1 Arroba", val: 1.0 },
        { label: "1 Arroba y cuarto (1¼)", val: 1.25 },
        { label: "1 Arroba y media (1½)", val: 1.5 },
        { label: "1 Arroba y 3/4 (1¾)", val: 1.75 },
        { label: "2 Arrobas", val: 2.0 },
        { label: "2 Arrobas y media (2½)", val: 2.5 },
        { label: "3 Arrobas", val: 3.0 },
        { label: "3 Arrobas y media (3½)", val: 3.5 },
        { label: "4 Arrobas", val: 4.0 },
        { label: "5 Arrobas", val: 5.0 },
        { label: "6 Arrobas", val: 6.0 },
        { label: "7 Arrobas", val: 7.0 },
        { label: "8 Arrobas", val: 8.0 },
        { label: "9 Arrobas", val: 9.0 },
        { label: "10 Arrobas", val: 10.0 }
    ];
    
    return (
        <TabsContent value="quincena" className="space-y-6 mt-0">
            {(() => {
                // Modo Supervivencia: Cálculo de Cajas Sagradas vs Fondo Común
                let totalTortas = 0;
                let totalHelados = 0;
                let totalFondoComun = 0;
                
                const ventasHoy = ventasDiarias?.filter((v: any) => v.fecha === hoyStr) || [];
                ventasHoy.forEach((v: any) => {
                    Object.entries(v.cajas || {}).forEach(([caja, valor]) => {
                        const val = Number(valor) || 0;
                        if (caja.toLowerCase().includes('tortas')) {
                            totalTortas += val;
                        } else if (caja.toLowerCase().includes('helados')) {
                            totalHelados += val;
                        } else {
                            totalFondoComun += val;
                        }
                    });
                });

                const cutTortas = totalTortas * (pctCrecimiento / 100);
                const cutHelados = totalHelados * (pctCrecimiento / 100);
                const cutComun = totalFondoComun * (pctCrecimiento / 100);
                const totalCrecimiento = cutTortas + cutHelados + cutComun;

                const remTortas = totalTortas - cutTortas;
                const remHelados = totalHelados - cutHelados;
                const remComun = totalFondoComun - cutComun;

                return (
                    <>
                    
                    {/* ── SELECTORES DE PERIODO HISTÓRICO ── */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-card/50 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Analizar:</span>
                        </div>
                        <input 
                            type="month" 
                            className="bg-background border border-white/10 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={periodoFiltro.mes}
                            onChange={(e) => setPeriodoFiltro(p => ({ ...p, mes: e.target.value }))}
                        />
                        <div className="flex bg-background border border-white/10 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: '1' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === '1' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                1ª Quincena
                            </button>
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: '2' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === '2' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                2ª Quincena
                            </button>
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: 'mes' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === 'mes' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                Mes Completo
                            </button>
                        </div>
                    </div>

                    {/* ── CONSEJERO IA INTEGRADO EN EL DASHBOARD ── */}
                    <Card className="rounded-3xl border-2 shadow-lg border-violet-500/50 bg-violet-500/5">
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-violet-500/20">
                                    <Sparkles className="w-6 h-6 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-violet-400" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Análisis Financiero IA · {quincenaReal.label}</p>
                                        </div>
                                    </div>
                                    
                                    {!analisisIA && !pidiendoIA ? (
                                        <div className="space-y-3">
                                            <h3 className="text-lg font-black text-violet-400">¿Necesitas ayuda con los números?</h3>
                                            <p className="text-sm text-muted-foreground">Pico-Claw, el agente financiero, puede analizar los datos de esta quincena y darte una estrategia personalizada.</p>
                                            <Button 
                                                onClick={() => pedirConsejoIA(diagnosticoFinanciero, quincenaReal)}
                                                className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2"
                                            >
                                                <Bot className="w-4 h-4" />
                                                Analizar Datos Ahora
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                                                {analisisIA ? (
                                                    <div className="whitespace-pre-wrap leading-relaxed text-sm">
                                                        {analisisIA}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-violet-400 animate-pulse font-medium">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Pico-Claw está analizando tus finanzas...
                                                    </div>
                                                )}
                                            </div>
                                            {analisisIA && !pidiendoIA && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => pedirConsejoIA(diagnosticoFinanciero, quincenaReal)}
                                                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                                                    Re-evaluar Estrategia
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── ESTADO FINANCIERO DEL NEGOCIO (P&L) ── */}
                    <Card className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/10 to-blue-950/5 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp className="w-24 h-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-black flex items-center gap-2 text-cyan-500">
                                📊 Estado General del Negocio
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Diagnóstico de pérdidas y ganancias de {quincenaReal.label}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                                <div onClick={() => setDetallesModal('ingresos')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">Total Ingresos</p>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(diagnosticoFinanciero.ingresos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('proveedores')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1">Proveedores (Topes)</p>
                                    <p className="text-base font-black text-amber-600 dark:text-amber-400">- {formatCurrency(diagnosticoFinanciero.compras)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('fijos')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-500 mb-1">Gastos Fijos/Nómina</p>
                                    <p className="text-base font-black text-violet-600 dark:text-violet-400">- {formatCurrency(diagnosticoFinanciero.fijos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('diarios')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-500 mb-1">Gastos Diarios</p>
                                    <p className="text-base font-black text-rose-600 dark:text-rose-400">- {formatCurrency(diagnosticoFinanciero.operativos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('neta')} className={cn(
                                    "rounded-2xl p-3 border md:col-span-1 col-span-2 flex flex-col justify-center cursor-pointer hover:brightness-110 transition-all",
                                    diagnosticoFinanciero.gananciaNeta >= 0 ? "bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/20" : "bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/20"
                                )}>
                                    <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                                        Ganancia Neta
                                    </p>
                                    <p className={cn("text-xl font-black", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-700 dark:text-emerald-500" : "text-rose-700 dark:text-rose-500")}>
                                        {formatCurrency(diagnosticoFinanciero.gananciaNeta)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Barra de progreso de rentabilidad */}
                            <div className="mt-4">
                                <div className="flex justify-between text-[10px] font-bold mb-1.5 px-1 text-muted-foreground">
                                    <span>Ingresos 100%</span>
                                    <span>Margen Neto: {diagnosticoFinanciero.ingresos > 0 ? ((diagnosticoFinanciero.gananciaNeta / diagnosticoFinanciero.ingresos) * 100).toFixed(1) : 0}%</span>
                                </div>
                                <div className="h-3 w-full bg-rose-500/20 rounded-full flex overflow-hidden">
                                    <div 
                                        className="h-full bg-amber-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.compras / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Proveedores: ${formatCurrency(diagnosticoFinanciero.compras)}`}
                                    />
                                    <div 
                                        className="h-full bg-violet-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.fijos / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Fijos: ${formatCurrency(diagnosticoFinanciero.fijos)}`}
                                    />
                                    <div 
                                        className="h-full bg-rose-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.operativos / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Operativos: ${formatCurrency(diagnosticoFinanciero.operativos)}`}
                                    />
                                    {diagnosticoFinanciero.gananciaNeta > 0 && (
                                        <div 
                                            className="h-full bg-emerald-500 transition-all duration-1000 relative"
                                            style={{ width: `${(diagnosticoFinanciero.gananciaNeta / diagnosticoFinanciero.ingresos) * 100}%` }}
                                            title={`Ganancia Neta: ${formatCurrency(diagnosticoFinanciero.gananciaNeta)}`}
                                        >
                                            <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── RESUMEN REAL — 4 cajas prominentes ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: `Ventas POS ${quincenaReal.label}`,
                                val: quincenaReal.ventasPOS,
                                color: 'text-emerald-500',
                                border: 'border-emerald-200 dark:border-emerald-800',
                                sub: `${ventas.filter(v => v.fecha.slice(0, 10) >= quincenaReal.inicioStr && v.fecha.slice(0, 10) <= quincenaReal.finStr).length} transacciones`,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Turnos Cerrados (Caja)',
                                val: quincenaReal.ventasManuales,
                                color: 'text-indigo-500',
                                border: 'border-indigo-200 dark:border-indigo-800',
                                sub: `${ventasDiarias.filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr).length} cierres de caja`,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Total ingresos reales',
                                val: quincenaReal.ventasTotal,
                                color: 'text-cyan-500',
                                border: 'border-cyan-200 dark:border-cyan-800',
                                sub: 'POS + Cierres (Neto)',
                                highlight: true,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Compromisos de la Quincena',
                                val: diagnosticoFinanciero.fijos,
                                color: diagnosticoFinanciero.fijos > quincenaReal.ventasTotal ? 'text-rose-500' : 'text-violet-500',
                                border: diagnosticoFinanciero.fijos > quincenaReal.ventasTotal ? 'border-rose-200 dark:border-rose-800' : 'border-violet-200 dark:border-violet-800',
                                sub: `Fijos a pagar en estos 15 días`,
                                modalKey: 'fijos'
                            },
                        ].map(item => (
                            <div key={item.label} onClick={() => setDetallesModal(item.modalKey)} className={cn(
                                "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm",
                                item.border,
                                item.highlight && "ring-2 ring-cyan-400/30"
                            )}>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.label}</span>
                                <span className={cn("text-xl font-black tabular-nums", item.color)}>
                                    {formatCurrency(item.val)}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">{item.sub}</span>
                            </div>
                        ))}
                    </div>

                    {/* Saldo neto real */}
                    {(() => {
                        const saldo = (Number(quincenaReal.ventasTotal) || 0) - (Number(totalCompromisosActivos) || 0);
                        return (
                            <div className={cn(
                                "rounded-2xl border-2 px-5 py-3 flex items-center justify-between gap-4 flex-wrap",
                                saldo >= 0 ? "border-emerald-400/40 bg-emerald-500/5" : "border-rose-400/40 bg-rose-500/5"
                            )}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo real de la quincena hasta hoy</p>
                                    <p className={cn("text-2xl font-black", saldo >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {saldo >= 0 ? `+${formatCurrency(saldo)}` : formatCurrency(saldo)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Ingresos reales {formatCurrency(quincenaReal.ventasTotal)} — Compromisos {formatCurrency(totalCompromisosActivos)}
                                    </p>
                                </div>
                                {quincenaReal.ventasTotalDia > 0 && (
                                    <div 
                                        onClick={() => setDetallesModal('ventas_hoy')}
                                        className="text-right bg-card/60 rounded-xl px-4 py-2 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ventas registradas hoy</p>
                                        <p className="text-xl font-black text-amber-400">{formatCurrency(quincenaReal.ventasTotalDia)}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── SEMÁFORO Y SOBRES (MI QUINCENA PRO) ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Semáforo de Utilidad - Rediseñado para Claridad */}
                        <Card className={cn(
                            "rounded-3xl border-2 overflow-hidden relative",
                            proyeccionQuincena.alcanza
                                ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-500/10"
                                : "border-rose-500/40 bg-gradient-to-b from-rose-500/5 to-transparent dark:from-rose-500/10"
                        )}>
                            <div className={cn(
                                "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16",
                                proyeccionQuincena.alcanza ? "bg-emerald-500/10 dark:bg-emerald-500/20" : "bg-rose-500/10 dark:bg-rose-500/20"
                            )} />
                            <CardContent className="p-5 relative z-10 flex flex-col h-full">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-lg",
                                        proyeccionQuincena.alcanza ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-rose-500 text-white shadow-rose-500/30"
                                    )}>
                                        {proyeccionQuincena.alcanza ? '💰' : '⚠️'}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Proyección de la Quincena</p>
                                        <h3 className={cn("text-2xl font-black", proyeccionQuincena.alcanza ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                            {proyeccionQuincena.alcanza
                                                ? `Ganancia Libre: ${formatCurrency(proyeccionQuincena.saldoProyectado)}`
                                                : `Faltan: ${formatCurrency(proyeccionQuincena.deficit)}`}
                                        </h3>
                                    </div>
                                </div>
                                
                                <div className="bg-slate-100 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-3 mt-auto">
                                    <div className="flex justify-between items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_ventas')}>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-dashed border-slate-400/50">Ventas Esperadas (Total)</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400/80 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_costos')}>
                                        <span className="text-xs font-bold border-b border-dashed border-amber-400/50">(-) Costos de Reposición (50%)</span>
                                        <span className="text-sm font-black">-{formatCurrency(proyeccionQuincena.ingresoEsperado - proyeccionQuincena.utilidadBrutaEsperada)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-400/80 pb-3 border-b border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_compromisos')}>
                                        <span className="text-xs font-bold border-b border-dashed border-rose-400/50">(-) Compromisos y Salarios</span>
                                        <span className="text-sm font-black">-{formatCurrency(proyeccionQuincena.totalCompromisos + proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Plata que te Sobra</span>
                                        <span className={cn("text-lg font-black", proyeccionQuincena.alcanza ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                            {proyeccionQuincena.alcanza ? formatCurrency(proyeccionQuincena.saldoProyectado) : `-${formatCurrency(proyeccionQuincena.deficit)}`}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>


                        {/* Sobres de Ahorro */}
                        <Card className="rounded-3xl border-2 border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-transparent dark:from-violet-500/10">
                            <CardContent className="p-5 flex flex-col h-full justify-between">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center shrink-0 text-xl text-violet-600 dark:text-violet-400">
                                        💌
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">Sobres Inteligentes</p>
                                        <h3 className="text-xl font-black text-violet-700 dark:text-violet-300">
                                            Ahorra {formatCurrency(proyeccionQuincena.cuotaDiariaAhorro)} / día
                                        </h3>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Separa esta cantidad diaria de la caja para que no sientas el golpe al pagar arriendo o salarios.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <div className="bg-slate-100 dark:bg-card/60 rounded-xl p-2.5 border border-black/5 dark:border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Compromisos Fijos</p>
                                        <p className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(proyeccionQuincena.totalCompromisos)}</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-card/60 rounded-xl p-2.5 border border-black/5 dark:border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Salarios</p>
                                        <p className="text-sm font-black text-amber-600 dark:text-amber-400">{formatCurrency(proyeccionQuincena.totalSalarios)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    
                    {/* ── MODO SUPERVIVENCIA: CAJAS SAGRADAS VS FONDO COMÚN ── */}
                    {quincenaReal.ventasTotalDia > 0 && (
                        <div className="space-y-4">
                            {/* BÓVEDA DE CRECIMIENTO */}
                            <Card className="rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent dark:from-yellow-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 bg-yellow-500/20" />
                                <CardContent className="p-5 relative z-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center shrink-0 text-2xl text-yellow-600 dark:text-yellow-400 shadow-inner">
                                                🚀
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-400">Impuesto de Crecimiento (Ahorro Total)</p>
                                                <h3 className="text-2xl font-black text-yellow-700 dark:text-yellow-300">
                                                    {formatCurrency(totalCrecimiento)}
                                                </h3>
                                                <p className="text-[10px] font-medium text-yellow-600/80 mt-1 max-w-[280px]">
                                                    Fondo supremo para máquinas e inversiones. Se descuenta automáticamente de TODAS las cajas antes del reparto.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col items-center gap-2 bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-yellow-500/20 shadow-sm backdrop-blur-md">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-400">Retención:</span>
                                                <span className="text-sm font-black text-yellow-700 dark:text-yellow-400 bg-white dark:bg-black/40 px-2 py-0.5 rounded-lg border border-yellow-500/30 shadow-inner">{pctCrecimiento}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="1" max="15" 
                                                value={pctCrecimiento} 
                                                onChange={e => setPctCrecimiento(Number(e.target.value))} 
                                                className="w-24 accent-yellow-500 cursor-pointer"
                                            />
                                        </div>
                                        
                                        <button 
                                            onClick={() => {
                                                if(data.addMovimientoBoveda && data.addBoveda) {
                                                    let target = data.bovedasExistentes?.find((b: any) => b.nombre === 'Crecimiento / Expansión');
                                                    if(!target) {
                                                        target = data.addBoveda({ nombre: 'Crecimiento / Expansión', saldo: 0, color: 'bg-yellow-500', icono: '🚀', objetivo: 5000000, descripcion: 'Fondo supremo para máquinas e inversiones' });
                                                    }
                                                    data.addMovimientoBoveda({
                                                        bovedaDestinoId: target.id, monto: totalCrecimiento, motivo: `Cierre Caja: Ahorro Total al ${pctCrecimiento}% (${hoyStr})`, tipo: 'Ingreso', usuarioResponsable: 'Sistema', metodoPago: 'Efectivo'
                                                    });
                                                }
                                            }}
                                            className="w-full md:w-auto bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-yellow-950 font-black py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_0_rgba(234,179,8,0.39)] hover:shadow-[0_6px_20px_rgba(234,179,8,0.23)] uppercase tracking-widest text-xs"
                                        >
                                            Ahorrar para el Futuro
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* FONDO COMÚN */}
                                <Card className="rounded-3xl border-2 border-slate-500/30 bg-gradient-to-b from-slate-500/5 to-transparent dark:from-slate-500/10">
                                    <CardContent className="p-4 flex flex-col h-full justify-between">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 flex items-center justify-center shrink-0 text-xl text-slate-600 dark:text-slate-400">
                                                💼
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Fondo Común</p>
                                                <h3 className="text-lg font-black text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(remComun)}
                                                </h3>
                                                <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                                    Restante para pagar deudas
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if(data.addMovimientoBoveda && data.addBoveda) {
                                                    let target = data.bovedasExistentes?.find((b: any) => b.nombre === 'Fondo Común');
                                                    if(!target) {
                                                        target = data.addBoveda({ nombre: 'Fondo Común', saldo: 0, color: 'bg-slate-500', icono: '💼', objetivo: 0, descripcion: 'Fondo común para pagos generales' });
                                                    }
                                                    data.addMovimientoBoveda({
                                                        bovedaDestinoId: target.id, monto: remComun, motivo: `Cierre Caja: Fondo Común (Después del ${pctCrecimiento}% Crecimiento)`, tipo: 'Ingreso', usuarioResponsable: 'Sistema', metodoPago: 'Efectivo'
                                                    });
                                                }
                                            }}
                                            className="mt-2 w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black py-2 rounded-xl transition-colors uppercase tracking-widest border border-black/5 dark:border-white/5 shadow-sm"
                                        >
                                            Mandar a Bóveda
                                        </button>
                                    </CardContent>
                                </Card>

                                {/* CAJA SAGRADA: TORTAS */}
                                <Card className="rounded-3xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent dark:from-amber-500/10">
                                    <CardContent className="p-4 flex flex-col h-full justify-between">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center shrink-0 text-xl text-amber-600 dark:text-amber-400">
                                                🎂
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Caja Intocable</p>
                                                <h3 className="text-lg font-black text-amber-700 dark:text-amber-300">
                                                    {formatCurrency(remTortas)}
                                                </h3>
                                                <p className="text-[9px] font-medium text-amber-600/70 mt-0.5 leading-snug">
                                                    Tortas (Saldo protegido)
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if(data.addMovimientoBoveda && data.addBoveda) {
                                                    let target = data.bovedasExistentes?.find((b: any) => b.nombre === 'Fondo Tortas');
                                                    if(!target) {
                                                        target = data.addBoveda({ nombre: 'Fondo Tortas', saldo: 0, color: 'bg-amber-500', icono: '🎂', objetivo: 0, descripcion: 'Caja sagrada de Tortas' });
                                                    }
                                                    data.addMovimientoBoveda({
                                                        bovedaDestinoId: target.id, monto: remTortas, motivo: `Cierre Caja: Tortas (Después del ${pctCrecimiento}% Crecimiento)`, tipo: 'Ingreso', usuarioResponsable: 'Sistema', metodoPago: 'Efectivo'
                                                    });
                                                }
                                            }}
                                            className="mt-2 w-full bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-black py-2 rounded-xl transition-colors uppercase tracking-widest border border-amber-500/10 shadow-sm"
                                        >
                                            Proteger Saldo
                                        </button>
                                    </CardContent>
                                </Card>

                                {/* CAJA SAGRADA: HELADOS */}
                                <Card className="rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-transparent dark:from-cyan-500/10">
                                    <CardContent className="p-4 flex flex-col h-full justify-between">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center shrink-0 text-xl text-cyan-600 dark:text-cyan-400">
                                                🍦
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Caja Intocable</p>
                                                <h3 className="text-lg font-black text-cyan-700 dark:text-cyan-300">
                                                    {formatCurrency(remHelados)}
                                                </h3>
                                                <p className="text-[9px] font-medium text-cyan-600/70 mt-0.5 leading-snug">
                                                    Helados (Saldo protegido)
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                            if(data.addMovimientoBoveda && data.addBoveda) {
                                                let target = data.bovedasExistentes?.find((b: any) => b.nombre === 'Fondo Helados');
                                                if(!target) {
                                                    target = data.addBoveda({ nombre: 'Fondo Helados', saldo: 0, color: 'bg-cyan-500', icono: '🍦', objetivo: 0, descripcion: 'Caja sagrada de Helados' });
                                                }
                                                data.addMovimientoBoveda({
                                                    bovedaDestinoId: target.id, monto: remHelados, motivo: `Cierre Caja: Helados (Después del ${pctCrecimiento}% Crecimiento)`, tipo: 'Ingreso', usuarioResponsable: 'Sistema', metodoPago: 'Efectivo'
                                                });
                                            }
                                        }}
                                        className="mt-2 w-full bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-[10px] font-black py-2 rounded-xl transition-colors uppercase tracking-widest border border-cyan-500/10 shadow-sm"
                                    >
                                        Proteger Saldo
                                    </button>
                                </CardContent>
                            </Card>
                        </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Columna izq — Compromisos fijos */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Compromisos Fijos</CardTitle>
                                <CardDescription className="text-xs">Arriendo, préstamos, servicios, salarios</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Formulario nuevo/edición de compromiso */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 border border-white/5">
                                    {(formCompromiso as any).id && (
                                        <div className="flex items-center justify-between bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                            <span className="text-[10px] font-black text-amber-500 uppercase">Modo Edición Activo</span>
                                            <Button 
                                                variant="ghost" 
                                                className="h-5 text-[9px] font-black text-rose-500 hover:text-rose-700 px-1"
                                                onClick={() => setFormCompromiso({
                                                    nombre: '', monto: '', categoria: 'Otros' as GastoCategoria,
                                                    diaDeCobro: '', esPropietario: false, persona: ''
                                                })}
                                            >
                                                Cancelar
                                            </Button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Nombre (Ej: Arriendo)" value={formCompromiso.nombre}
                                            onChange={e => setFormCompromiso(p => ({ ...p, nombre: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Monto ($)" type="number" value={formCompromiso.monto}
                                            onChange={e => setFormCompromiso(p => ({ ...p, monto: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <select value={formCompromiso.frecuencia}
                                            onChange={e => setFormCompromiso(p => ({ ...p, frecuencia: e.target.value as any }))}
                                            className="h-9 text-xs rounded-xl border border-input bg-background px-2 font-bold">
                                            <option value="quincenal">Ambas quincenas (Ej. Nómina)</option>
                                            <option value="solo_q1">1ra Quincena (Días 1-15, Ej. Luz)</option>
                                            <option value="solo_q2">2da Quincena (Días 16-31, Ej. Agua)</option>
                                            <option value="mensual">Mensual (Día exacto inamovible)</option>
                                        </select>
                                        <Input placeholder="Día (1-31)" type="number" value={formCompromiso.diaDeCobro}
                                            onChange={e => setFormCompromiso(p => ({ ...p, diaDeCobro: e.target.value }))}
                                            className="h-9 text-xs rounded-xl"
                                            disabled={formCompromiso.frecuencia !== 'mensual'} 
                                            title="Solo aplica para pagos mensuales en un día exacto" />
                                        <select value={formCompromiso.categoria}
                                            onChange={e => setFormCompromiso(p => ({ ...p, categoria: e.target.value as GastoCategoria }))}
                                            className="h-9 text-xs rounded-xl border border-input bg-background px-2">
                                            {(['Arriendo','Servicios','Nómina','Materia Prima','Mantenimiento','Otros'] as GastoCategoria[]).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                                            <input type="checkbox" checked={formCompromiso.esPropietario}
                                                onChange={e => setFormCompromiso(p => ({ ...p, esPropietario: e.target.checked }))}
                                                className="rounded" />
                                            <User className="w-3.5 h-3.5 text-amber-500" /> Mi salario
                                        </label>
                                    </div>
                                    {formCompromiso.esPropietario && (
                                        <Input placeholder="Persona (Yo / Esposa / ...)" value={formCompromiso.persona}
                                            onChange={e => setFormCompromiso(p => ({ ...p, persona: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    )}
                                    <Button onClick={handleAddCompromiso} size="sm" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9">
                                        <Plus className="w-4 h-4 mr-1" /> {(formCompromiso as any).id ? 'Actualizar compromiso' : 'Agregar compromiso'}
                                    </Button>
                                </div>

                                {/* Lista de compromisos */}
                                {compromisos.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin compromisos registrados aún</p>
                                )}
                                {compromisos.map(c => (
                                    <div key={c.id} className={cn(
                                        "flex items-center gap-3 rounded-2xl p-3 border transition-all",
                                        c.activo ? "bg-card/40 border-white/5" : "bg-slate-500/5 border-white/3 opacity-50"
                                    )}>
                                        <button onClick={() => handleToggleCompromiso(c.id)} className="shrink-0">
                                            {c.activo
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                : <XCircle className="w-4 h-4 text-slate-400" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                {c.esPropietario && <User className="w-3 h-3 text-amber-500 shrink-0" />}
                                                <p className="text-sm font-bold truncate">{c.nombre}</p>
                                                {c.persona && <span className="text-[10px] text-amber-500 font-black">({c.persona})</span>}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                {c.frecuencia === 'quincenal' ? 'Ambas quincenas' : 
                                                 c.frecuencia === 'solo_q1' ? '1ra Quincena (Días 1-15)' :
                                                 c.frecuencia === 'solo_q2' ? '2da Quincena (Días 16-31)' :
                                                 `Mensual (Día ${c.diaDeCobro})`} · {c.categoria}
                                            </p>
                                        </div>
                                        <p className="text-sm font-black text-rose-400 shrink-0">{formatCurrency(c.monto)}</p>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    setFormCompromiso({
                                                        id: c.id,
                                                        nombre: c.nombre,
                                                        monto: c.monto.toString(),
                                                        categoria: c.categoria,
                                                        diaDeCobro: c.diaDeCobro.toString(),
                                                        esPropietario: !!c.esPropietario,
                                                        persona: c.persona || '',
                                                        frecuencia: c.frecuencia || 'mensual',
                                                    } as any);
                                                    toast.info("Compromiso cargado en el formulario para editar.");
                                                }}
                                                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 hover:underline shrink-0"
                                            >
                                                Editar
                                            </button>
                                            <button onClick={() => handleDeleteCompromiso(c.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Columna der — Registro de ventas del día */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Ventas del Día</CardTitle>
                                <CardDescription className="text-xs">Registro manual detallado por caja (efectivo) y otros métodos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3 border border-white/5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha</Label>
                                            <Input type="date" value={formVenta.fecha}
                                                onChange={e => setFormVenta(p => ({ ...p, fecha: e.target.value }))}
                                                className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Turno</Label>
                                            <select 
                                                value={formVenta.turno}
                                                onChange={e => setFormVenta(p => ({ ...p, turno: e.target.value as any }))}
                                                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors mt-1"
                                            >
                                                <option value="Día Completo">Día Completo</option>
                                                <option value="Mañana">Mañana</option>
                                                <option value="Tarde-Noche">Tarde-Noche</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Cajas Dinámicas */}
                                    <div className="space-y-2 border-t border-b border-white/5 py-2">
                                        <Label className="text-[10px] font-black uppercase text-amber-500">Efectivo por Cajas</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Principal */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">💰 Principal</Label>
                                                <Input
                                                    placeholder="Ej: 150.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Principal'] ? String(formVenta.cajas['Principal']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (formVenta.totalEfectivo || '')}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            totalEfectivo: String(val),
                                                            cajas: { ...(p.cajas || {}), 'Principal': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Helados */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍦 Helados</Label>
                                                <Input
                                                    placeholder="Ej: 50.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Helados'] ? String(formVenta.cajas['Helados']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Helados': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Mecato */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍿 Mecato / Snacks</Label>
                                                <Input
                                                    placeholder="Ej: 30.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Mecato'] ? String(formVenta.cajas['Mecato']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Mecato': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Michelada */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍺 Michelada / Bebidas</Label>
                                                <Input
                                                    placeholder="Ej: 80.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Michelada'] ? String(formVenta.cajas['Michelada']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Michelada': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Tinto */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">☕ Tinto</Label>
                                                <Input
                                                    placeholder="Ej: 10.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Tinto'] ? String(formVenta.cajas['Tinto']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Tinto': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Fritos */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🥟 Fritos</Label>
                                                <Input
                                                    placeholder="Ej: 15.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Fritos'] ? String(formVenta.cajas['Fritos']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Fritos': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Tortas */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎂 Tortas</Label>
                                                <Input
                                                    placeholder="Ej: 60.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Tortas'] ? String(formVenta.cajas['Tortas']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Tortas': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Juegos */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎮 Juegos</Label>
                                                <Input
                                                    placeholder="Ej: 5.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Juegos'] ? String(formVenta.cajas['Juegos']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Juegos': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* PIÑATERIA */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎈 PIÑATERIA</Label>
                                                <Input
                                                    placeholder="Ej: 5.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['PIÑATERIA'] ? String(formVenta.cajas['PIÑATERIA']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'PIÑATERIA': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Gastos/Salidas */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">💸 Gastos/Salidas</Label>
                                                <Input
                                                    placeholder="Ej: 10.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Gastos/Salidas'] ? String(formVenta.cajas['Gastos/Salidas']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Gastos/Salidas': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                        </div>

                                        {/* Cajas Extras añadidas — mismo estilo */}
                                        {formVenta.cajas && Object.keys(formVenta.cajas).filter(k => !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(k)).map(key => (
                                            <div key={key} className="grid grid-cols-2 gap-2 mt-1">
                                                <div className="col-span-2">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground">☕ {key}</Label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormVenta(p => {
                                                                const copy = { ...(p.cajas || {}) };
                                                                delete copy[key];
                                                                return { ...p, cajas: copy };
                                                            })}
                                                            className="text-[9px] text-rose-400 hover:text-rose-600 font-black transition-colors"
                                                        >✕ quitar</button>
                                                    </div>
                                                    <Input
                                                        placeholder={`Ej: 25.000`}
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={formVenta.cajas?.[key] ? String(formVenta.cajas[key]).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            const val = parseInt(raw) || 0;
                                                            setFormVenta(p => ({
                                                                ...p,
                                                                cajas: { ...(p.cajas || {}), [key]: val }
                                                            }));
                                                        }}
                                                        className="h-9 text-sm rounded-xl mt-0.5"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {/* Añadir Caja Extra */}
                                        <div className="flex gap-1.5 mt-2">
                                            <Input
                                                id="nueva_caja_nombre"
                                                placeholder="Nombre nueva caja (Ej: Piñatería)"
                                                className="h-8 text-xs rounded-xl"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        const inputName = (e.target as HTMLInputElement).value.trim();
                                                        if (inputName && !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(inputName)) {
                                                            setFormVenta(p => ({
                                                                ...p,
                                                                cajas: { ...(p.cajas || {}), [inputName]: 0 }
                                                            }));
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-xl px-2 text-xs font-black uppercase"
                                                onClick={() => {
                                                    const input = document.getElementById('nueva_caja_nombre') as HTMLInputElement;
                                                    const name = input?.value.trim();
                                                    if (name && !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(name)) {
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), [name]: 0 }
                                                        }));
                                                        input.value = '';
                                                    }
                                                }}
                                            >
                                                + Caja
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Otros Métodos de Pago */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500">Otros Medios de Pago</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Input placeholder="Nequi ($)" type="number" value={formVenta.totalNequi}
                                                onChange={e => setFormVenta(p => ({ ...p, totalNequi: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                            <Input placeholder="Transf. ($)" type="number" value={formVenta.totalTransferencia}
                                                onChange={e => setFormVenta(p => ({ ...p, totalTransferencia: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                            <Input placeholder="Crédito ($)" type="number" value={formVenta.totalCredito}
                                                onChange={e => setFormVenta(p => ({ ...p, totalCredito: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                        </div>
                                    </div>

                                    <Input placeholder="Notas (opcional)" value={formVenta.notas}
                                        onChange={e => setFormVenta(p => ({ ...p, notas: e.target.value }))}
                                        className="h-9 text-sm rounded-xl" />
                                        
                                    {/* Resumen de Totales */}
                                    <div className="bg-card/50 rounded-xl p-3 border border-white/10 space-y-2 mt-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-semibold">Total Principal + Nequi (Bruto):</span>
                                            <span className="font-bold text-slate-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    return formatCurrency(princ + nequi);
                                                })()}
                                            </span>
                                        </div>
                                        {formVenta.cajas?.['Gastos/Salidas'] > 0 && (
                                            <div className="flex justify-between items-center text-xs text-rose-400">
                                                <span className="font-semibold">Menos Gastos / Salidas:</span>
                                                <span className="font-bold">- {formatCurrency(formVenta.cajas['Gastos/Salidas'])}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                            <span className="text-muted-foreground font-semibold">Subtotal Princ + Nequi (Neto):</span>
                                            <span className="font-black text-indigo-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    const gastos = parseInt(String(formVenta.cajas?.['Gastos/Salidas'] || '0')) || 0;
                                                    return formatCurrency(princ + nequi - gastos);
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pb-1 mt-2">
                                            <span className="text-muted-foreground font-semibold">Total Otras Cajas:</span>
                                            <span className="font-black text-emerald-400">
                                                {(() => {
                                                    let sum = 0;
                                                    if (formVenta.cajas) {
                                                        Object.entries(formVenta.cajas).forEach(([k, v]) => {
                                                            if (k !== 'Principal' && k !== 'Gastos/Salidas') {
                                                                sum += (parseInt(String(v)) || 0);
                                                            }
                                                        });
                                                    }
                                                    return formatCurrency(sum);
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pt-1">
                                            <span className="font-black uppercase tracking-wider text-slate-300">Total General:</span>
                                            <span className="font-black text-amber-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    let sumOtras = 0;
                                                    let gastos = 0;
                                                    if (formVenta.cajas) {
                                                        Object.entries(formVenta.cajas).forEach(([k, v]) => {
                                                            if (k === 'Gastos/Salidas') gastos += (parseInt(String(v)) || 0);
                                                            else if (k !== 'Principal') sumOtras += (parseInt(String(v)) || 0);
                                                        });
                                                    }
                                                    return formatCurrency(princ + nequi + sumOtras - gastos);
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <Button onClick={handleAddVentaDiaria} size="sm" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 shadow-lg shadow-indigo-600/10">
                                        <Plus className="w-4 h-4 mr-1" /> Registrar cierre del día
                                    </Button>
                                </div>

                                {ventasDiarias.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin ventas registradas manualmente aún</p>
                                )}
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {ventasDiarias.slice(0, 30).map(v => {
                                        // Cálculos para la vista del historial
                                        const princ = v.totalEfectivo || 0; // en cajas.Principal o el viejo totalEfectivo
                                        const nequi = v.totalNequi || 0;
                                        const princMasNequi = princ + nequi;

                                        let sumOtras = 0;
                                        let gastos = 0;
                                        if (v.cajas) {
                                            Object.entries(v.cajas).forEach(([k, val]) => {
                                                if (k === 'Gastos/Salidas') {
                                                    gastos += (val || 0);
                                                } else if (k !== 'Principal') {
                                                    sumOtras += (val || 0);
                                                }
                                            });
                                        }
                                        const totalGeneral = princMasNequi + sumOtras - gastos + (v.totalTransferencia || 0) + (v.totalCredito || 0);

                                        return (
                                        <div key={v.id} className="flex flex-col gap-1.5 rounded-2xl p-3 bg-card/40 border border-white/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black">{new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                        {v.turno && v.turno !== 'Día Completo' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-sm">
                                                                {v.turno}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {v.notas && <p className="text-[10px] italic text-muted-foreground truncate mt-0.5">"{v.notas}"</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-emerald-400 shrink-0">{formatCurrency(totalGeneral)}</p>
                                                    <button 
                                                        onClick={() => {
                                                            // Normalizar llaves para evitar duplicados en cajas
                                                            const normalizedCajas: any = {};
                                                            if (v.cajas) {
                                                                const keyMap: any = {
                                                                    'principal': 'Principal', 'helados': 'Helados', 'helado': 'Helados',
                                                                    'mecato': 'Mecato', 'michelada': 'Michelada', 'bebidas': 'Michelada',
                                                                    'tinto': 'Tinto', 'fritos': 'Fritos', 'tortas': 'Tortas', 'torta': 'Tortas',
                                                                    'juegos': 'Juegos', 'juego': 'Juegos', 'piñateria': 'PIÑATERIA',
                                                                    'gastos': 'Gastos/Salidas', 'salidas': 'Gastos/Salidas', 'gastos/salidas': 'Gastos/Salidas'
                                                                };
                                                                Object.entries(v.cajas).forEach(([k, val]) => {
                                                                    const lowerK = k.toLowerCase().trim();
                                                                    const mappedKey = keyMap[lowerK] || k;
                                                                    normalizedCajas[mappedKey] = val;
                                                                });
                                                            }

                                                            // Cargar en el form para edición fácil
                                                            setFormVenta({
                                                                id: v.id,
                                                                fecha: v.fecha,
                                                                turno: v.turno || 'Día Completo',
                                                                totalEfectivo: v.totalEfectivo.toString() || '',
                                                                totalNequi: v.totalNequi.toString() || '',
                                                                totalTransferencia: v.totalTransferencia.toString() || '',
                                                                totalCredito: v.totalCredito.toString() || '',
                                                                notas: v.notas || '',
                                                                cajas: normalizedCajas
                                                            });
                                                            toast.info("Venta cargada en el formulario para editar. Vuelve a guardar para sobrescribir.");
                                                        }} 
                                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 hover:underline"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button onClick={() => handleDeleteVentaDiaria(v.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground border-t border-white/5 pt-2 flex flex-col gap-2">
                                                
                                                {/* Detalle agrupado que solicitó el usuario */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded text-xs font-black text-indigo-500 dark:text-indigo-300">
                                                        Princ+Nequi (Neto): {formatCurrency(princMasNequi - gastos)}
                                                    </span>
                                                    {gastos > 0 && (
                                                        <span className="bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded text-xs font-black text-rose-600 dark:text-rose-300">
                                                            Gastos: - {formatCurrency(gastos)}
                                                        </span>
                                                    )}
                                                    {sumOtras > 0 && (
                                                        <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-xs font-black text-emerald-600 dark:text-emerald-300">
                                                            Otras Cajas: {formatCurrency(sumOtras)}
                                                        </span>
                                                    )}
                                                    {v.totalTransferencia > 0 && (
                                                        <span className="bg-blue-50 dark:bg-blue-950/20 px-2 py-1 rounded text-xs font-black text-blue-600 dark:text-blue-400">
                                                            Transf: {formatCurrency(v.totalTransferencia)}
                                                        </span>
                                                    )}
                                                    {v.totalCredito > 0 && (
                                                        <span className="bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded text-xs font-black text-amber-600 dark:text-amber-400">
                                                            Cred: {formatCurrency(v.totalCredito)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Desglose individual de cajas pequeñas */}
                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                    {v.cajas && Object.entries(v.cajas).map(([k, val]) => val > 0 && k !== 'Principal' && k !== 'Gastos/Salidas' && (
                                                <span key={k} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                            {k}: {formatCurrency(val)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Auditoría de Producción ─────────────────────────────── */}
                        <Card className="rounded-3xl border-slate-200 dark:border-white/5 bg-white dark:bg-card/30 shadow-xl overflow-hidden">
                            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
                            <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-white/5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                                <ClipboardCheck className="w-5 h-5 text-amber-500" />
                                            </div>
                                            Auditoría de Producción
                                        </CardTitle>
                                        <CardDescription className="text-xs font-medium mt-1">Control estricto de entrada de masa vs. salida de pan</CardDescription>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground mb-1">Fecha de Auditoría</Label>
                                        <Input type="date" value={formProd.fecha}
                                            onChange={e => setFormProd(p => ({ ...p, fecha: e.target.value }))}
                                            className="h-9 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10" />
                                    </div>
                                </div>
                            </CardHeader>
                            
                            <CardContent className="p-0">
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-0">
                                    {/* PANEL IZQUIERDO: REGISTRO */}
                                    <div className="xl:col-span-8 p-4 sm:p-6 space-y-6">
                                        
                                        {/* ENTRADA DE MASAS */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                                                <Layers className="w-4 h-4 text-indigo-500" />
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Declaración de Masa (Entrada)</h3>
                                            </div>
                                            
                                            <div className="grid gap-2">
                                                {masasPreparadas.map((m) => (
                                                    <div key={m.id} className="flex gap-2 items-center bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-200 dark:border-white/5">
                                                        <div className="flex-1">
                                                            <select
                                                                value={m.nombre}
                                                                onChange={e => handleMasaChange(m.id, 'nombre', e.target.value)}
                                                                className="h-9 text-xs font-bold rounded-lg w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3"
                                                            >
                                                                <option value="">Selecciona Masa Declarada...</option>
                                                                {formulaciones?.filter((f: any) => f.activo).map((f: any) => (
                                                                    <option key={f.id} value={f.nombre}>{f.nombre}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="w-32 relative">
                                                            <select
                                                                value={m.cantidadArrobas || ''}
                                                                onChange={e => handleMasaChange(m.id, 'cantidadArrobas', e.target.value)}
                                                                className="h-9 text-xs font-bold rounded-lg w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 pr-8"
                                                            >
                                                                <option value="">Arrobas...</option>
                                                                {opcionesArrobas.map(op => (
                                                                    <option key={op.val} value={op.val}>{op.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-muted-foreground uppercase">Arr.</div>
                                                        </div>
                                                        <button type="button" onClick={() => handleRemoveMasa(m.id)}
                                                            className="h-9 w-9 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={handleAddMasa}
                                                    className="w-full h-10 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Registrar Masa
                                                </button>
                                            </div>
                                        </div>

                                        {/* SALIDA DE PANES (HORNADAS) */}
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Flame className="w-4 h-4 text-amber-500" />
                                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Panes Producidos (Salida)</h3>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsModeloModalOpen(true)}
                                                    className="text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 shadow-sm"
                                                >
                                                    🥖 + Modelo de Pan →
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                {hornadas.map((h, i) => {
                                                    const masaVinculada = masasPreparadas.find((x: any) => x.id === h.masaId);
                                                    const formCorr = masaVinculada ? formulaciones?.find((f: any) => f.nombre === masaVinculada.nombre) : null;
                                                    const modelosDisponibles = formCorr ? modelosPan?.filter((mod: any) => mod.formulacionId === formCorr.id) : modelosPan;
                                                    const panSeleccionado = (modelosDisponibles || modelosPan)?.find((m: any) => m.nombre === h.tipoPan);
                                                    const faltaConfiguracion = h.tipoPan && panSeleccionado && !panSeleccionado.piezasPorLata;

                                                    return (
                                                        <div key={i} className={cn("relative p-3 sm:p-4 rounded-2xl border transition-all duration-300", 
                                                            faltaConfiguracion ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50" : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-white/5")}>
                                                            
                                                            {/* Header de la Hornada */}
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <Badge variant="outline" className="text-[9px] font-black bg-white dark:bg-black/20">LOTE #{i + 1}</Badge>
                                                                    {faltaConfiguracion && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                localStorage.setItem('dp_produccion_active_tab', 'modelos');
                                                                                if (panSeleccionado) {
                                                                                    localStorage.setItem('dp_edit_modelo_id', panSeleccionado.id);
                                                                                } else {
                                                                                    localStorage.setItem('dp_open_add_modelo_dialog', 'true');
                                                                                }
                                                                                if (onNavigateTo) onNavigateTo('produccion');
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-md border border-rose-200 dark:border-rose-500/30 animate-pulse transition-all cursor-pointer"
                                                                        >
                                                                            <BellRing className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                                                            <span className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">¡Falta conf. bandejas! Configurar ahora →</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {hornadas.length > 1 && (
                                                                    <button type="button" onClick={() => handleRemoveHornada(i)} className="text-rose-400 hover:text-rose-600 p-1">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                                <div>
                                                                    <Label className="text-[9px] font-black uppercase text-slate-500 mb-1">Modelo de Pan</Label>
                                                                    <select
                                                                        className={cn("h-9 text-xs font-bold rounded-xl w-full border bg-white dark:bg-slate-900 px-3", faltaConfiguracion ? "border-rose-300 dark:border-rose-700/50 ring-1 ring-rose-500/20 text-rose-700 dark:text-rose-300" : "border-slate-200 dark:border-white/10")}
                                                                        value={h.tipoPan}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            handleHornadaChange(i, 'tipoPan', val);
                                                                            const mod = (modelosDisponibles || modelosPan)?.find((m: any) => m.nombre === val);
                                                                            if (mod) {
                                                                                if (mod.piezasPorLata) {
                                                                                    handleHornadaChange(i, 'panesPorBandeja', mod.piezasPorLata);
                                                                                } else {
                                                                                    handleHornadaChange(i, 'panesPorBandeja', 0);
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">Seleccionar pan...</option>
                                                                        {(modelosDisponibles || modelosPan)?.map((mod: any) => (
                                                                            <option key={mod.id} value={mod.nombre}>{mod.nombre}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                {masasPreparadas.length > 0 && (
                                                                    <div>
                                                                        <Label className="text-[9px] font-black uppercase text-slate-500 mb-1">Masa Origen (Opcional)</Label>
                                                                        <select
                                                                            className="h-9 text-xs rounded-xl w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3"
                                                                            value={h.masaId || ''}
                                                                            onChange={e => handleHornadaChange(i, 'masaId', e.target.value)}
                                                                        >
                                                                            <option value="">(Sin masa vinculada)</option>
                                                                            {masasPreparadas.map(m => (
                                                                                <option key={m.id} value={m.id}>{m.nombre || 'Sin nombre'}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Inputs numéricos con estilo claro */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <div>
                                                                    <Label className="text-[9px] font-black uppercase text-slate-500 flex justify-between">Bandejas / Latas</Label>
                                                                    <div className="relative mt-1">
                                                                        <Input placeholder="0" type="text" inputMode="numeric"
                                                                            value={h.bandejas || ''}
                                                                            onChange={e => handleHornadaChange(i, 'bandejas', e.target.value.replace(/[^0-9.]/g,''))}
                                                                            className="h-10 text-center font-black text-lg rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[9px] font-black uppercase text-slate-500 flex justify-between">
                                                                        Panes/lata
                                                                        {faltaConfiguracion && <span className="text-rose-500 font-bold">*Falta</span>}
                                                                    </Label>
                                                                    <div className="relative mt-1">
                                                                        <Input placeholder="0" type="text" inputMode="numeric"
                                                                            value={h.panesPorBandeja || ''}
                                                                            onChange={e => handleHornadaChange(i, 'panesPorBandeja', e.target.value.replace(/[^0-9]/g,''))}
                                                                            className={cn("h-10 text-center font-black text-lg rounded-xl focus-visible:ring-indigo-500", faltaConfiguracion ? "border-rose-300 dark:border-rose-700/50 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400" : "border-slate-200 dark:border-slate-800")} />
                                                                    </div>
                                                                </div>
                                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-2 flex flex-col justify-center items-center border border-emerald-200 dark:border-emerald-500/20 shadow-inner">
                                                                    <Label className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Total Panes (Escribir)</Label>
                                                                    <Input placeholder="0" type="text" inputMode="numeric"
                                                                        value={h.totalPanes || ''}
                                                                        onChange={e => handleHornadaChange(i, 'totalPanes', e.target.value.replace(/[^0-9]/g,''))}
                                                                        className="h-10 text-center font-black text-xl rounded-xl border-emerald-200 bg-white text-emerald-700 shadow-sm focus-visible:ring-emerald-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <button type="button" onClick={handleAddHornada}
                                                    className="w-full h-10 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-colors flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Agregar Lote de Pan
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-500">Observaciones (Opcional)</Label>
                                            <Input placeholder="Ej. Se quemó una lata, la masa estaba muy hidratada..." value={formProd.notas}
                                                onChange={e => setFormProd(p => ({ ...p, notas: e.target.value }))}
                                                className="h-10 text-sm rounded-xl mt-1 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/10" />
                                        </div>

                                        <Button onClick={handleSaveProduccion} className={cn("w-full rounded-xl text-white font-black uppercase tracking-widest text-[11px] h-12 shadow-xl transition-all hover:scale-[1.02]", editProduccionId ? "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/20" : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/20")}>
                                            {editProduccionId ? (
                                                <><Edit2 className="w-4 h-4 mr-2" /> Actualizar Auditoría</>
                                            ) : (
                                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Guardar Auditoría</>
                                            )}
                                        </Button>
                                        {editProduccionId && (
                                            <Button variant="outline" onClick={() => {
                                                if (setEditProduccionId) setEditProduccionId(null);
                                                setFormProd({ fecha: new Date().toISOString().slice(0, 10), notas: '' });
                                                setMasasPreparadas([]);
                                                setHornadas([{ tipoPan: '', bandejas: 0, panesPorBandeja: 0, totalPanes: 0 }]);
                                            }} className="w-full mt-2 rounded-xl border-dashed border-2 h-10 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800">
                                                Cancelar Edición
                                            </Button>
                                        )}

                                    </div>

                                    {/* PANEL DERECHO: CUADRE EN TIEMPO REAL */}
                                    <div className="xl:col-span-4 bg-slate-100/50 dark:bg-black/40 border-l border-slate-200 dark:border-white/5 p-4 sm:p-6">
                                        <div className="sticky top-6 space-y-4">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Target className="w-5 h-5 text-purple-500" />
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Cuadre en Tiempo Real</h3>
                                            </div>

                                            {(() => {
                                                const totalMasaRegistrada = masasPreparadas.reduce((s, m) => s + (m.cantidadArrobas || 0), 0);
                                                const totalPanesCalculados = hornadas.reduce((s, h) => s + (Number(h.bandejas || 0) * Number(h.panesPorBandeja || 0)), 0);
                                                const totalPanesInput = hornadas.reduce((s, h) => s + Number(h.totalPanes || 0), 0);
                                                const finalPanes = Math.max(totalPanesCalculados, totalPanesInput);
                                                
                                                let arrobasEquivalentes = 0;
                                                hornadas.forEach(h => {
                                                    const panCant = Number(h.totalPanes || (Number(h.bandejas || 0) * Number(h.panesPorBandeja || 0)));
                                                    if (panCant > 0 && h.tipoPan) {
                                                        const mod = modelosPan?.find((m: any) => m.nombre === h.tipoPan);
                                                        if (mod && mod.panesPorArroba > 0) {
                                                            arrobasEquivalentes += (panCant / mod.panesPorArroba);
                                                        }
                                                    }
                                                });

                                                const diferencia = arrobasEquivalentes - totalMasaRegistrada;
                                                const hasData = totalMasaRegistrada > 0 || arrobasEquivalentes > 0;

                                                return (
                                                    <div className="space-y-4">
                                                        {/* KPIs Básicos */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Masa (Entrada)</p>
                                                                <p className="text-xl font-black text-indigo-500">{totalMasaRegistrada.toFixed(2)}<span className="text-[10px] ml-1">arr</span></p>
                                                            </div>
                                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Panes (Salida)</p>
                                                                <p className="text-xl font-black text-emerald-500">{finalPanes.toLocaleString('es-CO')}<span className="text-[10px] ml-1">und</span></p>
                                                                <p className="text-[9px] font-bold text-slate-400 mt-1">≈ {arrobasEquivalentes.toFixed(2)} arr</p>
                                                            </div>
                                                        </div>

                                                        {/* Veredicto de Auditoría */}
                                                        {hasData && (
                                                            <div className={cn("rounded-2xl p-4 sm:p-5 border shadow-sm transition-all duration-500", 
                                                                diferencia < -0.1 ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30" :
                                                                diferencia > 0.1 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30" :
                                                                "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30"
                                                            )}>
                                                                {diferencia < -0.1 ? (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                                                            <AlertTriangle className="w-5 h-5 animate-pulse shrink-0" />
                                                                            <h4 className="text-sm font-black uppercase tracking-tight">Faltante de Producción</h4>
                                                                        </div>
                                                                        <div className="bg-white/50 dark:bg-black/20 p-2 rounded-xl text-center">
                                                                            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                                                                                Faltan panes equivalentes a <br/><span className="text-lg font-black">{Math.abs(diferencia).toFixed(2)} arrobas</span>
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 leading-snug font-medium">Revisa si el panadero olvidó registrar latas o si hay una merma injustificada (masa perdida).</p>
                                                                    </div>
                                                                ) : diferencia > 0.1 ? (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                                            <BadgeAlert className="w-5 h-5 shrink-0" />
                                                                            <h4 className="text-sm font-black uppercase tracking-tight">Exceso de Producción</h4>
                                                                        </div>
                                                                        <div className="bg-white/50 dark:bg-black/20 p-2 rounded-xl text-center">
                                                                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                                                                                Hay panes de más equivalentes a <br/><span className="text-lg font-black">{diferencia.toFixed(2)} arrobas</span>
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-snug font-medium">Esto suele indicar que los panes se están armando más pequeños o livianos que lo configurado en la receta.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                                            </div>
                                                                            <h4 className="text-sm font-black uppercase tracking-tight">Cuadre Perfecto</h4>
                                                                        </div>
                                                                        <div className="bg-white/50 dark:bg-black/20 p-2 rounded-xl text-center">
                                                                            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                                                                La masa declarada y los panes producidos coinciden.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {!hasData && (
                                                            <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl opacity-50">
                                                                <Scale className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Esperando datos...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* ──────────────────────────────────────────────────────────── */}

                        {/* Historial de Producción Grouped */}
                        <Card className="rounded-3xl border-slate-200 dark:border-white/5 bg-white dark:bg-card/30 shadow-xl overflow-hidden">
                            <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-white/5">
                                <CardTitle className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                        <ClipboardList className="w-4 h-4 text-indigo-500" />
                                    </div>
                                    Historial de Producción y Auditorías
                                </CardTitle>
                                <CardDescription className="text-xs font-medium">Lotes guardados clasificados por fecha de producción</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-5">
                                {(() => {
                                    const renderCard = (p: any) => {
                                        const totalMasa = (p.masas || []).reduce((s: number, m: any) => s + (m.cantidadArrobas || 0), 0);
                                        const totalPanes = (p.hornadas || []).reduce((s: number, h: any) => s + h.totalPanes, 0);
                                        
                                        let arrobasEquivalentes = 0;
                                        (p.hornadas || []).forEach((h: any) => {
                                            const panCant = Number(h.totalPanes || (Number(h.bandejas || 0) * Number(h.panesPorBandeja || 0)));
                                            if (panCant > 0 && h.tipoPan) {
                                                const mod = modelosPan?.find((m: any) => m.nombre === h.tipoPan);
                                                if (mod && mod.panesPorArroba > 0) {
                                                    arrobasEquivalentes += (panCant / mod.panesPorArroba);
                                                }
                                            }
                                        });
                                        const diferencia = arrobasEquivalentes - totalMasa;
                                        const hasData = totalMasa > 0 || arrobasEquivalentes > 0;

                                        return (
                                            <div key={p.id} className="relative overflow-hidden bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                                                {/* VEREDICTO HEADER */}
                                                {hasData && (
                                                    <div className={cn("px-4 py-2 border-b flex items-center justify-between",
                                                        diferencia < -0.1 ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50" :
                                                        diferencia > 0.1 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50" :
                                                        "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                                                    )}>
                                                        <div className="flex items-center gap-2">
                                                            {diferencia < -0.1 ? <AlertTriangle className="w-4 h-4 text-rose-500" /> :
                                                             diferencia > 0.1 ? <BadgeAlert className="w-4 h-4 text-amber-500" /> :
                                                             <CheckCheck className="w-4 h-4 text-emerald-500" />}
                                                            <span className={cn("text-[10px] font-black uppercase tracking-widest",
                                                                diferencia < -0.1 ? "text-rose-700 dark:text-rose-400" :
                                                                diferencia > 0.1 ? "text-amber-700 dark:text-amber-400" :
                                                                "text-emerald-700 dark:text-emerald-400"
                                                            )}>
                                                                {diferencia < -0.1 ? `FALTANTE: ${Math.abs(diferencia).toFixed(2)} arr` :
                                                                 diferencia > 0.1 ? `EXCESO: ${diferencia.toFixed(2)} arr` :
                                                                 "CUADRE EXACTO"}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                            <CalendarDays className="w-3 h-3" />
                                                            {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="p-4 flex flex-col gap-4">
                                                    {/* MASAS */}
                                                    {(p.masas?.length > 0) && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Entrada (Masa)</p>
                                                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{totalMasa.toFixed(2)} arr.</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {p.masas.map((m: any, i: number) => (
                                                                    <div key={`m-${i}`} className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-lg p-2 flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{m.nombre}</span>
                                                                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{m.cantidadArrobas} arr.</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* HORNADAS */}
                                                    {(p.hornadas?.length > 0) && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Salida (Pan)</p>
                                                                <div className="text-right">
                                                                    <span className="block text-[10px] font-black text-slate-700 dark:text-slate-300">{totalPanes.toLocaleString('es-CO')} und.</span>
                                                                    <span className="block text-[9px] font-bold text-slate-400">≈ {arrobasEquivalentes.toFixed(2)} arr.</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                {p.hornadas.map((h: any, i: number) => (
                                                                    <div key={`h-${i}`} className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-3 py-2 rounded-lg">
                                                                        <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-100">{h.tipoPan}</span>
                                                                        <div className="text-right flex items-center gap-3">
                                                                            <span className="text-[9px] text-slate-500 dark:text-slate-400">{h.bandejas} latas × {h.panesPorBandeja} c/u</span>
                                                                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{h.totalPanes} und</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                                        <p className="text-[10px] text-slate-500 italic line-clamp-1 flex-1 pr-4">{p.notas || "Sin observaciones"}</p>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button onClick={() => {
                                                                if (setEditProduccionId) {
                                                                    setEditProduccionId(p.id);
                                                                    setFormProd({ fecha: p.fecha, notas: p.notas || '' });
                                                                    setMasasPreparadas(p.masas || []);
                                                                    setHornadas(p.hornadas || []);
                                                                    toast.success(`Editando auditoría del ${p.fecha}`);
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }
                                                            }}
                                                                className="text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => { deleteProduccion(p.id); setProducciones(getProducciones()); toast.success('Auditoría eliminada'); }}
                                                                className="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    };

                                    const produccionesHoy = producciones.filter(p => p.fecha === formProd.fecha);
                                    const produccionesAnteriores = producciones.filter(p => p.fecha !== formProd.fecha);

                                    return (
                                        <div className="space-y-6">
                                            {/* SECCIÓN 1: PRODUCCIÓN DEL DÍA / SELECCIONADO */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between bg-indigo-50/80 dark:bg-indigo-950/40 px-3.5 py-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                                    <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                                        Producción del Día ({new Date(formProd.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })})
                                                    </span>
                                                    <Badge variant="outline" className="bg-white dark:bg-slate-900 text-[10px] font-bold text-indigo-600 border-indigo-200">
                                                        {produccionesHoy.length} lotes
                                                    </Badge>
                                                </div>

                                                {produccionesHoy.length === 0 ? (
                                                    <div className="text-center py-8 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                                                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                        <p className="text-xs font-bold text-slate-500">Sin lotes para la fecha {formProd.fecha}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Llenando el formulario de arriba y pulsando Guardar se asignará a este día.</p>
                                                    </div>
                                                ) : (
                                                    <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                                                        {produccionesHoy.map(renderCard)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* SECCIÓN 2: OTRAS FECHAS / HISTORIAL ANTERIOR */}
                                            {produccionesAnteriores.length > 0 && (
                                                <div className="space-y-3 pt-4 border-t-2 border-dashed border-slate-200 dark:border-white/10">
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <History className="w-4 h-4 text-slate-400" />
                                                            Historial de Otros Días
                                                        </span>
                                                        <Badge variant="secondary" className="text-[10px] font-bold">
                                                            {produccionesAnteriores.length} registros
                                                        </Badge>
                                                    </div>

                                                    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 opacity-90 hover:opacity-100 transition-opacity">
                                                        {produccionesAnteriores.slice(0, 30).map(renderCard)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── PLAN DE COMPRAS A PROVEEDORES ── */}
                    {presupuestosMinimos.length > 0 && (() => {
                        const getLimite = (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                        const comprasSemana   = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Semanal');
                        const comprasQuincena = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Quincenal');
                        const comprasMes      = presupuestosMinimos.filter((i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal');
                        const totalSem  = comprasSemana.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalQuin = comprasQuincena.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalMes  = comprasMes.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalCiclo = totalSem + totalQuin + totalMes;
                        const yaComprado = presupuestosMinimos.filter((i: any) => i.estado === 'completado').reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalPendiente = totalCiclo - yaComprado;
                        return (
                            <Card className="rounded-3xl border border-amber-500/20 bg-amber-950/10">
                                <CardHeader className="pb-3 border-b border-amber-500/10">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <CardTitle className="text-base font-black flex items-center gap-2">🛒 Plan de Compras a Proveedores</CardTitle>
                                            <CardDescription className="text-xs mt-0.5">Configurado en Presupuestos · {temporadaBaja ? '❄️ Temporada Baja' : '🔥 Temporada Alta'}</CardDescription>
                                        </div>
                                        <button onClick={() => setActiveTab('compras-minimas')}
                                            className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-all">
                                            Gestionar →
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-xl p-2 bg-card/40 border border-white/5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Total Ciclo</p>
                                            <p className="text-base font-black">{formatCurrency(totalCiclo)}</p>
                                        </div>
                                        <div className="rounded-xl p-2 bg-emerald-950/20 border border-emerald-500/20">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">✓ Comprado</p>
                                            <p className="text-base font-black text-emerald-400">{formatCurrency(yaComprado)}</p>
                                        </div>
                                        <div className="rounded-xl p-2 bg-rose-950/20 border border-rose-500/20">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">⏳ Pendiente</p>
                                            <p className="text-base font-black text-rose-400">{formatCurrency(totalPendiente)}</p>
                                        </div>
                                    </div>
                                    {totalCiclo > 0 && (
                                        <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, (yaComprado / totalCiclo) * 100)}%` }} />
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    {[
                                        { label: '📅 Esta Semana', items: comprasSemana, total: totalSem, color: 'text-amber-400' },
                                        { label: '📆 Esta Quincena', items: comprasQuincena, total: totalQuin, color: 'text-violet-400' },
                                        { label: '🗓️ Este Mes', items: comprasMes, total: totalMes, color: 'text-blue-400' },
                                    ].filter(g => g.items.length > 0).map(grupo => (
                                        <div key={grupo.label}>
                                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", grupo.color)}>{grupo.label} — {formatCurrency(grupo.total)}</p>
                                            <div className="space-y-1.5">
                                                {grupo.items.map((item: any) => (
                                                    <div key={item.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2 border text-sm transition-all",
                                                        item.estado === 'completado' ? "border-emerald-500/20 bg-emerald-950/10 opacity-60" : "border-white/5 bg-card/30")}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("w-2 h-2 rounded-full shrink-0", item.estado === 'completado' ? "bg-emerald-500" : "bg-rose-500")} />
                                                            <span className="font-bold">{item.proveedor}</span>
                                                            {item.nota && <span className="text-[10px] text-muted-foreground hidden sm:inline">— {item.nota}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black">{formatCurrency(getLimite(item))}</span>
                                                            <button
                                                                onClick={() => {
                                                                    const updated = presupuestosMinimos.map((l: any) => l.id === item.id ? { ...l, estado: l.estado === 'completado' ? 'pendiente' : 'completado' } : l);
                                                                    setPresupuestosMinimos(updated);
                                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                }}
                                                                className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-lg transition-all",
                                                                    item.estado === 'completado' ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400" : "bg-rose-500/10 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-400")}
                                                            >{item.estado === 'completado' ? '✓ OK' : '⏳ Marcar'}</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        );
                    })()}
                    </>
                );
            })()}
                {/* Modal para Crear Modelos de Pan Rápidamente */}
                <ModeloPanModal 
                    isOpen={isModeloModalOpen} 
                    onClose={() => setIsModeloModalOpen(false)} 
                    formulaciones={formulaciones || []}
                    onSuccess={() => {
                        toast.success("Modelo creado exitosamente.");
                    }}
                />
        </TabsContent>
    );
}
