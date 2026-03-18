import React, { useMemo } from 'react';
import {
    PiggyBank,
    TrendingUp,
    Target,
    ArrowUpRight,
    ShieldCheck,
    Zap,
    DollarSign,
    Calendar,
    BarChart3,
    CreditCard,
    Plus,
    Rocket,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Venta } from '@/types';

interface AhorrosProps {
    ventas: Venta[];
    ahorros: any[];
    formatCurrency: (value: number) => string;
}

export default function Ahorros({ ventas, ahorros, formatCurrency }: AhorrosProps) {
    const totalRecaudado = useMemo(() => ventas.reduce((acc, v) => acc + v.total, 0), [ventas]);
    const ahorroEstimado = totalRecaudado * 0.15;
    const metaAhorro = 5000000;
    const porcentajeMeta = Math.min((ahorroEstimado / metaAhorro) * 100, 100);

    return (
        <div className="space-y-8 h-full flex flex-col animate-ag-fade-in p-2 md:p-6 bg-slate-50/50 dark:bg-black/20 rounded-[3rem]">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 p-8 glass-card rounded-[2.5rem] bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-600/30">
                        <PiggyBank className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
                            Mis <span className="text-emerald-600 dark:text-emerald-400">Ahorros</span>
                        </h1>
                        <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">Proyección estratégica de capital nutritivo</p>
                    </div>
                </div>

                <Button className="h-14 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] shadow-xl shadow-emerald-500/20 gap-3 font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 border-none relative z-10">
                    <Plus className="w-5 h-5" /> Nueva Meta de Crecimiento
                </Button>

                <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-400/5 rounded-full blur-3xl" />
            </div>

            {/* Main Goal Card - High Visual Impact */}
            <Card className="bg-slate-900 text-white border-none shadow-3xl shadow-emerald-500/10 rounded-[3rem] overflow-hidden relative group min-h-[400px] flex items-center">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 opacity-90" />
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

                {/* Decorative floating elements */}
                <div className="absolute top-10 right-20 w-32 h-32 bg-emerald-400 opacity-10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-10 left-20 w-48 h-48 bg-indigo-500 opacity-5 rounded-full blur-3xl animate-pulse" />

                <CardContent className="p-12 relative z-10 w-full">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="space-y-8 text-center md:text-left flex-1">
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 backdrop-blur-md border border-emerald-500/30 shadow-lg">
                                    <Target className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 opacity-70 block">Objetivo Prioritario</span>
                                    <span className="text-lg font-black uppercase tracking-tighter text-white">Mejora Maquinaria Dulce Placer</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-5xl md:text-7xl font-black tracking-tighter tabular-nums text-white">
                                    {formatCurrency(ahorroEstimado)}
                                </h2>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">de una meta de</span>
                                    <span className="text-xl font-black text-slate-300">{formatCurrency(metaAhorro)}</span>
                                </div>
                            </div>

                            <div className="space-y-4 max-w-lg">
                                <div className="flex justify-between items-end">
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">Progreso Operativo</span>
                                    <span className="text-4xl font-black text-emerald-400 tracking-tighter">{porcentajeMeta.toFixed(1)}<span className="text-xl">%</span></span>
                                </div>
                                <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
                                        style={{ width: `${porcentajeMeta}%` }}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-shimmer opacity-20" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full md:w-auto shrink-0">
                            {[
                                { icon: TrendingUp, label: 'Mensual', value: '+12.5%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { icon: ShieldCheck, label: 'Reserva', value: '100%', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                { icon: Sparkles, label: 'Capital', value: 'Activo', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                { icon: Rocket, label: 'Proy.', value: 'Q4', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 rounded-[2rem] text-center shadow-xl hover:scale-110 transition-transform duration-500">
                                    <div className={cn("p-2 rounded-xl inline-block mb-3", stat.bg)}>
                                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-xl font-black text-white">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grid of details - Secondary insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
                {[
                    {
                        icon: Zap,
                        title: 'Ahorro Inteligente',
                        desc: 'Basado en márgenes de utilidad reales vs teóricos.',
                        color: 'text-amber-500',
                        bg: 'bg-amber-500/10',
                        content: (
                            <div className="space-y-4">
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed opacity-70">
                                    Algoritmo Yimi sugiere destinar el <span className="font-bold text-slate-900 dark:text-white">15%</span> de ventas brutas para expansión de sede.
                                </p>
                                <div className="p-4 bg-slate-50 dark:bg-gray-800/40 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-gray-700/50">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Goteo Diario Sugerido</p>
                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(totalRecaudado * 0.05)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    },
                    {
                        icon: Rocket,
                        title: 'Metas Activas',
                        desc: 'Seguimiento de proyectos de expansión de capital.',
                        color: 'text-indigo-500',
                        bg: 'bg-indigo-500/10',
                        content: (
                            <div className="space-y-4">
                                {(ahorros?.length > 0 ? ahorros : [
                                    { nombre: 'Nuevo Horno Turbo', progreso: 70, color: 'bg-indigo-500' },
                                    { nombre: 'Batidora Industrial', progreso: 100, color: 'bg-emerald-500' }
                                ]).map((meta: any, i: number) => (
                                    <div key={i} className="group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/20 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm", meta.color || 'bg-indigo-500')} />
                                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-800 dark:text-gray-300">{meta.nombre}</span>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] font-black border-none bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 px-2 py-0.5 rounded-md">
                                                {meta.progreso === 100 ? 'SUCCESS' : `${meta.progreso}%`}
                                            </Badge>
                                        </div>
                                        <Progress value={meta.progreso} className="h-1 bg-slate-100 dark:bg-gray-800" indicatorClassName={meta.color || 'bg-indigo-500'} />
                                    </div>
                                ))}
                            </div>
                        )
                    },
                    {
                        icon: CreditCard,
                        title: 'Flujo de Egresos',
                        desc: 'Monitorización de pasivos y gastos fijos críticos.',
                        color: 'text-rose-500',
                        bg: 'bg-rose-500/10',
                        content: (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/10">
                                        <span className="text-rose-600/60">Servicios Públicos</span>
                                        <span className="text-rose-600">-$450k</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/10">
                                        <span className="text-rose-600/60">Arriendo Operativo</span>
                                        <span className="text-rose-600">-$1.2M</span>
                                    </div>
                                </div>
                                <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest h-11 border-2 border-slate-100 dark:border-gray-800 rounded-2xl hover:bg-slate-50 gap-2">
                                    Ver Centro de Gastos <ArrowRight className="w-3 h-3" />
                                </Button>
                            </div>
                        )
                    }
                ].map((insight, idx) => (
                    <Card key={idx} className="border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden border border-white/20">
                        <CardHeader className="p-8 pb-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-transform group-hover:rotate-12", insight.bg)}>
                                <insight.icon className={cn("w-6 h-6", insight.color)} />
                            </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">{insight.title}</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">{insight.desc}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            {insight.content}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

