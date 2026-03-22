import React from 'react';
import { TrendingDown, TrendingUp, Download, CheckCircle, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InventoryReportsProps {
    reporteStats: {
        totalPerdida: number;
        totalGanancia: number;
        topPerdidas: { nombre: string; cantidad: number; valor: number }[];
        totalMovimientos: number;
    };
    onExportCSV: () => void;
    formatCurrency: (value: number) => string;
}

export function InventoryReports({
    reporteStats,
    onExportCSV,
    formatCurrency
}: InventoryReportsProps) {
    return (
        <div className="space-y-10 animate-ag-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-3xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 shadow-sm overflow-hidden relative">
                    <CardHeader className="p-10 pb-4">
                        <CardTitle className="text-2xl font-black flex items-center gap-4 text-rose-700 dark:text-rose-400 uppercase tracking-tight">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-xl">
                                <TrendingDown className="w-8 h-8 text-rose-600" />
                            </div>
                            Pérdidas Operativas
                        </CardTitle>
                        <CardDescription className="text-rose-600/70 font-bold uppercase text-[10px] ml-16 tracking-widest">Ajustes negativos identificados</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 pt-0">
                        <div className="text-6xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tighter mt-4">
                            {formatCurrency(reporteStats.totalPerdida)}
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-rose-600/50 mt-4 leading-relaxed max-w-xs">
                            Monto acumulado por desperdicios, robos o errores de digitación en auditorías.
                        </p>
                    </CardContent>
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-rose-600/5 rounded-full blur-3xl" />
                </Card>

                <Card className="rounded-3xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 shadow-sm overflow-hidden relative">
                    <CardHeader className="p-10 pb-4">
                        <CardTitle className="text-2xl font-black flex items-center gap-4 text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-xl">
                                <TrendingUp className="w-8 h-8 text-emerald-600" />
                            </div>
                            Recuperaciones Stock
                        </CardTitle>
                        <CardDescription className="text-emerald-600/70 font-bold uppercase text-[10px] ml-16 tracking-widest">Ajustes positivos identificados</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 pt-0">
                        <div className="text-6xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter mt-4">
                            {formatCurrency(reporteStats.totalGanancia)}
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600/50 mt-4 leading-relaxed max-w-xs">
                            Mercancía recuperada o sobrantes identificados durante conteos cíclicos.
                        </p>
                    </CardContent>
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-600/5 rounded-full blur-3xl" />
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                <Card className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <CardHeader className="p-8 border-b border-gray-100 dark:border-gray-800/50">
                        <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">🚨 Críticos de Desperdicio</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-50">Top 5 productos con mayores fugas de capital</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        {reporteStats.topPerdidas.length > 0 ? (
                            reporteStats.topPerdidas.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800/40 transition-all duration-200">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 font-black text-xl shadow-inner border border-rose-100/50">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.nombre}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mt-1">{item.cantidad} unidades perdidas</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-rose-600 tabular-nums tracking-tighter">{formatCurrency(item.valor)}</p>
                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter mt-1 bg-rose-50 text-rose-600 border-none px-2 rounded-md">Revision Sugerida</Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 opacity-30">
                                <CheckCircle className="w-20 h-20 text-emerald-500/50 mx-auto mb-6" />
                                <p className="font-black uppercase tracking-widest text-xs">Sin registros de fugas críticas</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    <Card className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Resumen Analítico</span>
                            <PieChart className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="space-y-6">
                            <div className="p-6 rounded-[2rem] bg-indigo-50 dark:bg-indigo-950/30 space-y-4 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700/60 dark:text-indigo-400">Auditorías Realizadas</span>
                                    <span className="font-black text-2xl text-indigo-700 dark:text-indigo-300">{reporteStats.totalMovimientos}</span>
                                </div>
                                <div className="w-full bg-indigo-200/50 dark:bg-indigo-800/30 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full w-4/5 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
                                </div>
                            </div>

                            <div className="p-6 rounded-[2rem] border-none bg-amber-50 dark:bg-amber-950/20 shadow-sm border border-amber-100 dark:border-amber-900/30">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg shrink-0">
                                        <TrendingDown className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="font-black text-xs text-amber-900 dark:text-amber-400 uppercase tracking-tight">Fuga Identificada</p>
                                        <p className="text-[10px] font-bold text-amber-800/70 dark:text-amber-500 mt-1 leading-tight">
                                            El {Math.round((reporteStats.totalPerdida / (reporteStats.totalGanancia + reporteStats.totalPerdida || 1)) * 100)}% de los ajustes son negativos. Se recomienda revisar procesos de merma.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Button
                        variant="outline"
                        onClick={onExportCSV}
                        className="w-full h-12 rounded-xl border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 gap-3 transition-all"
                    >
                        <Download className="w-5 h-5" />
                        Exportar Historial Completo
                    </Button>
                </div>
            </div>
        </div>
    );
}
