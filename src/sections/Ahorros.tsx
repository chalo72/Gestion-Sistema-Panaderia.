import React, { useState, useMemo } from 'react';
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
    Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { Venta } from '@/types';

interface AhorrosProps {
    ventas: Venta[];
    ahorros: any[];
    formatCurrency: (value: number) => string;
}

export default function Ahorros({ ventas, ahorros, formatCurrency }: AhorrosProps) {
    // Simulación de cálculos de ahorro (e.g. margen de utilidad destinado a ahorro)
    const totalRecaudado = useMemo(() => ventas.reduce((acc, v) => acc + v.total, 0), [ventas]);
    const ahorroEstimado = totalRecaudado * 0.15; // Suponiendo un 15% de ahorro sugerido
    const metaAhorro = 5000000; // Meta de ejemplo (e.g. 5 millones COP)
    const porcentajeMeta = Math.min((ahorroEstimado / metaAhorro) * 100, 100);

    return (
        <div className="space-y-6 animate-ag-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        Mis Ahorros
                    </h1>
                    <p className="text-muted-foreground">Gestión financiera y metas de crecimiento para Dulce Placer.</p>
                </div>

                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 gap-2 h-11">
                    <Plus className="w-5 h-5" /> Nueva Meta de Ahorro
                </Button>
            </div>

            {/* Main Goal Card */}
            <Card className="bg-slate-900 text-white border-0 shadow-2xl shadow-emerald-500/10 overflow-hidden relative group">
                <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/20 to-transparent pointer-events-none" />
                <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />

                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                    <Target className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Meta: Mejora de Maquinaria</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">
                                {formatCurrency(ahorroEstimado)}
                                <span className="text-slate-500 text-2xl ml-3">/ {formatCurrency(metaAhorro)}</span>
                            </h2>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-slate-400">Progreso actual</span>
                                    <span className="text-emerald-400">{porcentajeMeta.toFixed(1)}%</span>
                                </div>
                                <Progress value={porcentajeMeta} className="h-3 bg-slate-800" indicatorClassName="bg-emerald-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl text-center">
                                <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                                <p className="text-xs text-slate-400 mb-1">Crecimiento Mensual</p>
                                <p className="text-lg font-bold">+12.5%</p>
                            </div>
                            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl text-center">
                                <ShieldCheck className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                <p className="text-xs text-slate-400 mb-1">Fondo Emergencia</p>
                                <p className="text-lg font-bold">Protegido</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grid of details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-border/50 shadow-xl bg-card/50">
                    <CardHeader className="pb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-3">
                            <Zap className="w-6 h-6" />
                        </div>
                        <CardTitle>Ahorro Inteligente</CardTitle>
                        <CardDescription>Basado en márgenes de utilidad.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            El sistema ha calculado que puedes ahorrar un 15% de tus ventas brutas sin comprometer la operación de los próximos pedidos.
                        </p>
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Sugerencia Diaria</p>
                                <p className="text-sm font-bold">{formatCurrency(totalRecaudado * 0.05)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 shadow-xl bg-card/50">
                    <CardHeader className="pb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3">
                            <Rocket className="w-6 h-6" />
                        </div>
                        <CardTitle>Inversiones de Capital</CardTitle>
                        <CardDescription>Dinero destinado a expansión.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            {ahorros?.length > 0 ? (
                                ahorros.map((meta: any) => (
                                    <div key={meta.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${meta.completado ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                            <span className="text-sm font-medium">{meta.nombre}</span>
                                        </div>
                                        <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {meta.progreso || 0}%
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <span className="text-sm font-medium">Nuevo Horno Turbo</span>
                                        </div>
                                        <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">70%</Badge>
                                    </div>
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-sm font-medium">Batidora Industrial</span>
                                        </div>
                                        <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">COMPLETO</Badge>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 shadow-xl bg-card/50">
                    <CardHeader className="pb-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 mb-3">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <CardTitle>Gastos Operativos</CardTitle>
                        <CardDescription>Visibilidad de egresos fijos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Servicios Públicos:</span>
                            <span className="font-bold text-rose-600">-$450,000</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Arriendo:</span>
                            <span className="font-bold text-rose-600">-$1,200,000</span>
                        </div>
                        <div className="pt-2">
                            <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider h-9">
                                Ver Reporte de Gastos
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
