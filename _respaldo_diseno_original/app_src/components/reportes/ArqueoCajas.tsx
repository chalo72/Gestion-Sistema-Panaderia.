import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Wallet, CalendarDays, BarChart3, Info } from 'lucide-react';
import type { VentaDiaria } from '@/types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface ArqueoCajasProps {
    ventasDiarias: VentaDiaria[];
}

type PeriodoFiltro = 'hoy' | 'semana' | 'quincena' | 'mes' | 'año' | 'libre';

const CAJAS_COLORS: Record<string, string> = {
    'Principal': '#8b5cf6', // Violet
    'Helados': '#ec4899',   // Pink
    'Tortas': '#f59e0b',    // Amber
    'Mecato': '#f43f5e',    // Rose
    'Michelada': '#0ea5e9', // Sky
    'Tinto': '#a8a29e',     // Stone
    'Fritos': '#eab308',    // Yellow
    'Juegos': '#10b981',    // Emerald
    'PIÑATERIA': '#ef4444', // Red
    'Gastos/Salidas': '#64748b', // Slate
};

export function ArqueoCajas({ ventasDiarias }: ArqueoCajasProps) {
    const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
    const [fechaInicio, setFechaInicio] = useState<string>(() => {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [fechaFin, setFechaFin] = useState<string>(() => {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    });

    const setRangoPredefinido = (tipo: PeriodoFiltro) => {
        setPeriodo(tipo);
        const hoy = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

        if (tipo === 'hoy') {
            setFechaInicio(hoyStr);
            setFechaFin(hoyStr);
        } else if (tipo === 'semana') {
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1)); // Lunes
            setFechaInicio(`${inicioSemana.getFullYear()}-${pad(inicioSemana.getMonth() + 1)}-${pad(inicioSemana.getDate())}`);
            setFechaFin(hoyStr);
        } else if (tipo === 'quincena') {
            if (hoy.getDate() <= 15) {
                setFechaInicio(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`);
                setFechaFin(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-15`);
            } else {
                setFechaInicio(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-16`);
                const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
                setFechaFin(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(ultimoDia)}`);
            }
        } else if (tipo === 'mes') {
            setFechaInicio(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`);
            const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
            setFechaFin(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(ultimoDia)}`);
        } else if (tipo === 'año') {
            setFechaInicio(`${hoy.getFullYear()}-01-01`);
            setFechaFin(`${hoy.getFullYear()}-12-31`);
        }
    };

    const datosAgregados = useMemo(() => {
        let totalRecaudado = 0;
        let totalSalidas = 0;
        const cajasAcumuladas: Record<string, number> = {};

        // Filtrar por rango de fechas
        const filtradas = ventasDiarias.filter(v => v.fecha >= fechaInicio && v.fecha <= fechaFin);

        filtradas.forEach(v => {
            if (v.cajas) {
                Object.entries(v.cajas).forEach(([cajaNombre, monto]) => {
                    const montoNum = Number(monto);
                    if (montoNum > 0) {
                        cajasAcumuladas[cajaNombre] = (cajasAcumuladas[cajaNombre] || 0) + montoNum;
                        if (cajaNombre === 'Gastos/Salidas' || cajaNombre === 'Salidas' || cajaNombre === 'gastos') {
                            totalSalidas += montoNum;
                        } else {
                            totalRecaudado += montoNum;
                        }
                    }
                });
            }
        });

        const totalNeto = totalRecaudado - totalSalidas;

        // Convertir a array y ordenar (Gastos al final)
        const arrayCajas = Object.entries(cajasAcumuladas)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const ingresos = arrayCajas.filter(c => c.name !== 'Gastos/Salidas' && c.name !== 'Salidas' && c.name !== 'gastos');
        const salidas = arrayCajas.filter(c => c.name === 'Gastos/Salidas' || c.name === 'Salidas' || c.name === 'gastos');

        return {
            totalRecaudado,
            totalSalidas,
            totalNeto,
            cajasFiltradas: [...ingresos, ...salidas],
            numDias: filtradas.length
        };
    }, [ventasDiarias, fechaInicio, fechaFin]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-cyan-400" /> Arqueo Detallado por Cajas
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Análisis profesional de liquidez: entradas, salidas y efectivo neto por cada caja.</p>
                </div>
            </div>

            {/* Panel de Filtros */}
            <Card className="border border-white/5 bg-card/30 rounded-3xl">
                <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button 
                            variant={periodo === 'hoy' ? 'default' : 'outline'}
                            onClick={() => setRangoPredefinido('hoy')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'hoy' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            Hoy
                        </Button>
                        <Button 
                            variant={periodo === 'semana' ? 'default' : 'outline'}
                            onClick={() => setRangoPredefinido('semana')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'semana' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            Esta Semana
                        </Button>
                        <Button 
                            variant={periodo === 'quincena' ? 'default' : 'outline'}
                            onClick={() => setRangoPredefinido('quincena')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'quincena' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            Esta Quincena
                        </Button>
                        <Button 
                            variant={periodo === 'mes' ? 'default' : 'outline'}
                            onClick={() => setRangoPredefinido('mes')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'mes' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            Este Mes
                        </Button>
                        <Button 
                            variant={periodo === 'año' ? 'default' : 'outline'}
                            onClick={() => setRangoPredefinido('año')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'año' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            Este Año
                        </Button>
                        <Button 
                            variant={periodo === 'libre' ? 'default' : 'outline'}
                            onClick={() => setPeriodo('libre')}
                            className={cn("rounded-xl h-9 text-xs font-bold transition-all", periodo === 'libre' ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "border-white/10 hover:bg-white/5")}
                        >
                            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                            Rango Libre
                        </Button>
                    </div>

                    {periodo === 'libre' && (
                        <div className="flex items-end gap-3 pt-2">
                            <div>
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Desde</Label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-9 text-sm rounded-xl" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Hasta</Label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-9 text-sm rounded-xl" />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tarjetas de Resumen Financiero */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 rounded-3xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-500/20" />
                    <CardContent className="p-6 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Entradas Brutas</p>
                        <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-50">{formatCurrency(datosAgregados.totalRecaudado)}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-muted-foreground mt-2 uppercase font-bold flex items-center gap-1.5">
                            <Info className="w-3 h-3" /> Todo el efectivo que entró a las cajas
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent dark:from-rose-500/10 rounded-3xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-rose-500/20" />
                    <CardContent className="p-6 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">Salidas / Gastos</p>
                        <h3 className="text-3xl font-black text-rose-700 dark:text-rose-50">-{formatCurrency(datosAgregados.totalSalidas)}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-muted-foreground mt-2 uppercase font-bold flex items-center gap-1.5">
                            <Info className="w-3 h-3" /> Dinero extraído para pagos
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-indigo-500/20 rounded-3xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-500/30" />
                    <CardContent className="p-6 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Efectivo Neto Real</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(datosAgregados.totalNeto)}</h3>
                        <p className="text-[10px] text-indigo-500/70 dark:text-indigo-200/50 mt-2 uppercase font-bold flex items-center gap-1.5">
                            <Info className="w-3 h-3" /> El dinero que realmente queda en mano
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Tendencias */}
            <Card className="border border-white/5 bg-card/30 rounded-3xl">
                <CardContent className="p-6 h-[300px]">
                    <div className="mb-4">
                        <h4 className="text-sm font-black text-muted-foreground">Distribución de Ingresos por Caja</h4>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosAgregados.cajasFiltradas}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} tickMargin={12} />
                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickFormatter={(v) => `$${(v/1000)}k`} width={55} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{ borderRadius: '1.2rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.95)', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
                                itemStyle={{ fontWeight: 900, fontSize: '1.1rem' }}
                                formatter={(v: number) => formatCurrency(v)}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                {datosAgregados.cajasFiltradas.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CAJAS_COLORS[entry.name] || '#94a3b8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {datosAgregados.cajasFiltradas.map(c => (
                    <Card key={c.name} className="border border-white/5 bg-card/20 rounded-2xl overflow-hidden hover:bg-card/40 transition-colors">
                        <div className="h-1.5 w-full" style={{ backgroundColor: CAJAS_COLORS[c.name] || '#94a3b8' }} />
                        <CardContent className="p-4">
                            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">{c.name}</p>
                            <p className="text-xl font-black">{formatCurrency(c.value)}</p>
                        </CardContent>
                    </Card>
                ))}
                
                {datosAgregados.cajasFiltradas.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-bold">No hay registros de cajas para el periodo seleccionado.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
