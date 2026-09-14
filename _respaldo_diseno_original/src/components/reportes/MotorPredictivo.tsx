import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, AlertTriangle, ArrowRight, Zap, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface Venta {
    fecha: string;
    total: number;
    items: any[];
}

export function MotorPredictivo({ ventas = [] }: { ventas: Venta[] }) {
    const prediccion = useMemo(() => {
        if (!ventas || ventas.length === 0) return null;

        const hoy = new Date();
        const diasHistorial = 30;
        
        // 1. Agrupar ventas por día
        const ventasPorDia = new Map<string, number>();
        const productosPorDia = new Map<number, Map<string, number>>(); // 0=Dom, 1=Lun...
        
        for (let i = 0; i < 7; i++) productosPorDia.set(i, new Map());

        const limiteFecha = new Date();
        limiteFecha.setDate(limiteFecha.getDate() - diasHistorial);
        const limiteStr = limiteFecha.toISOString().slice(0, 10);

        ventas.forEach(v => {
            const dateStr = (v.fecha || '').slice(0, 10);
            if (dateStr >= limiteStr) {
                ventasPorDia.set(dateStr, (ventasPorDia.get(dateStr) || 0) + (Number(v.total) || 0));
                
                // Productos
                if (v.items && Array.isArray(v.items)) {
                    const diaSemana = new Date(v.fecha).getDay();
                    const prodMap = productosPorDia.get(diaSemana)!;
                    v.items.forEach(item => {
                        const nombre = item.producto || 'Pan';
                        prodMap.set(nombre, (prodMap.get(nombre) || 0) + (Number(item.cantidad) || 0));
                    });
                }
            }
        });

        if (ventasPorDia.size < 3) return null; // No hay suficientes datos

        // 2. Calcular Multiplicadores de Día de la Semana
        const sumasDiaSemana = [0,0,0,0,0,0,0];
        const conteoDiaSemana = [0,0,0,0,0,0,0];
        
        ventasPorDia.forEach((total, fechaStr) => {
            const d = new Date(fechaStr).getDay();
            sumasDiaSemana[d] += total;
            conteoDiaSemana[d]++;
        });

        let totalGlobal = 0;
        ventasPorDia.forEach(v => totalGlobal += v);
        const promedioDiarioGlobal = totalGlobal / ventasPorDia.size;

        const multiplicadores = sumasDiaSemana.map((suma, idx) => {
            if (conteoDiaSemana[idx] === 0) return 1;
            const promDia = suma / conteoDiaSemana[idx];
            return promDia / promedioDiarioGlobal;
        });

        // 3. Regresión Lineal Simple (Tendencia)
        const xy: number[] = [];
        let xSum = 0, ySum = 0, xxSum = 0, xySum = 0;
        let count = 0;
        
        // Ordenar cronológicamente
        const diasOrdenados = Array.from(ventasPorDia.keys()).sort();
        
        diasOrdenados.forEach((fecha, idx) => {
            const y = ventasPorDia.get(fecha)!;
            const x = idx;
            xSum += x;
            ySum += y;
            xxSum += x * x;
            xySum += x * y;
            count++;
        });

        const slope = (count * xySum - xSum * ySum) / (count * xxSum - xSum * xSum);
        const intercept = (ySum - slope * xSum) / count;

        // 4. Predecir próximos 3 días
        const proyeccionGrafico: any[] = [];
        // Llenar últimos 7 días reales para el gráfico
        const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        const ultimos7 = diasOrdenados.slice(-7);
        ultimos7.forEach((fecha) => {
            const fechaObj = new Date(fecha);
            // Corrige la fecha a hora local sumando el offset
            fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
            proyeccionGrafico.push({
                nombre: diasNombres[fechaObj.getDay()],
                real: ventasPorDia.get(fecha),
                prediccion: ventasPorDia.get(fecha),
                esFuturo: false
            });
        });

        const mananaDate = new Date();
        mananaDate.setDate(mananaDate.getDate() + 1);
        const mananaSemana = mananaDate.getDay();

        let prediccionMananaBase = slope * count + intercept; 
        if (prediccionMananaBase < 0) prediccionMananaBase = promedioDiarioGlobal;
        const prediccionMananaAjustada = prediccionMananaBase * multiplicadores[mananaSemana];

        proyeccionGrafico.push({
            nombre: 'Mañana',
            real: null,
            prediccion: prediccionMananaAjustada,
            esFuturo: true
        });

        const pasadoDate = new Date();
        pasadoDate.setDate(pasadoDate.getDate() + 2);
        const pasadoSemana = pasadoDate.getDay();
        const prediccionPasado = (slope * (count+1) + intercept) * multiplicadores[pasadoSemana];

        proyeccionGrafico.push({
            nombre: diasNombres[pasadoSemana],
            real: null,
            prediccion: prediccionPasado,
            esFuturo: true
        });

        // 5. Productos recomendados para Mañana
        const mapProductosManana = productosPorDia.get(mananaSemana)!;
        const topProductos = Array.from(mapProductosManana.entries())
            .map(([nombre, cantidad]) => ({ nombre, promedio: Math.ceil(cantidad / (conteoDiaSemana[mananaSemana] || 1)) }))
            .sort((a, b) => b.promedio - a.promedio)
            .slice(0, 3);

        const tendencia = slope > 0 ? 'creciente' : 'decreciente';
        const pctCambio = (prediccionMananaAjustada - (ultimos7.length ? ventasPorDia.get(ultimos7[ultimos7.length-1])! : 0)) / (ultimos7.length ? ventasPorDia.get(ultimos7[ultimos7.length-1])! : 1) * 100;

        return {
            proyeccionGrafico,
            prediccionManana: prediccionMananaAjustada,
            topProductos,
            tendencia,
            pctCambio,
            diaNombre: diasNombres[mananaSemana]
        };

    }, [ventas]);

    if (!prediccion) {
        return (
            <Card className="border-dashed border-2 border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/10 shadow-none mt-6">
                <CardContent className="p-8 text-center">
                    <Brain className="w-12 h-12 text-indigo-300 mx-auto mb-3 opacity-50 animate-pulse" />
                    <p className="text-sm font-bold text-indigo-400">Motor Predictivo Recopilando Datos...</p>
                    <p className="text-xs text-indigo-400/70 mt-1">Se necesitan al menos 3 días de ventas registradas para activar la IA.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white shadow-2xl overflow-hidden relative mt-6">
            {/* Efectos de fondo */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-fuchsia-500/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
            
            <CardHeader className="pb-2 relative z-10 border-b border-white/5">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-300 uppercase tracking-widest">
                            <Brain className="w-4 h-4" />
                            Motor Predictivo IA
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Análisis heurístico de {prediccion.proyeccionGrafico.length} días de comportamiento</p>
                    </div>
                    <div className="bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Activo</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Panel Izquierdo: Cifras */}
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Proyección para Mañana ({prediccion.diaNombre})</p>
                            <h2 className="text-4xl font-black text-white tracking-tighter">
                                {formatCurrency(prediccion.prediccionManana)}
                            </h2>
                            <div className="flex items-center gap-2 mt-2">
                                {prediccion.pctCambio > 0 ? (
                                    <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                                        <TrendingUp className="w-3 h-3 mr-1" /> +{prediccion.pctCambio.toFixed(1)}% vs Hoy
                                    </span>
                                ) : (
                                    <span className="flex items-center text-xs font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md">
                                        <TrendingUp className="w-3 h-3 mr-1 rotate-180" /> {Math.abs(prediccion.pctCambio).toFixed(1)}% vs Hoy
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-1">
                                <Target className="w-3.5 h-3.5" /> Producción Sugerida
                            </p>
                            <div className="space-y-2">
                                {prediccion.topProductos.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                        <span className="text-sm text-slate-300 truncate max-w-[120px]">{p.nombre}</span>
                                        <span className="text-sm font-black text-white bg-white/10 px-2 py-0.5 rounded-md">~{p.promedio} und</span>
                                    </div>
                                ))}
                                {prediccion.topProductos.length === 0 && (
                                    <p className="text-xs text-slate-500">Sin datos suficientes de productos.</p>
                                )}
                            </div>
                            <p className="text-[9px] text-slate-500 mt-3 leading-tight">
                                Basado en el comportamiento de compra de los clientes en días similares ({prediccion.diaNombre}).
                            </p>
                        </div>
                    </div>

                    {/* Panel Derecho: Gráfico */}
                    <div className="lg:col-span-2 h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={prediccion.proyeccionGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', color: '#fff' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(val: number, name: string) => [formatCurrency(val), name === 'real' ? 'Venta Real' : 'Proyección IA']}
                                    labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="real" stroke="#818cf8" strokeWidth={3} fill="url(#colorReal)" />
                                <Area type="monotone" dataKey="prediccion" stroke="#34d399" strokeWidth={3} strokeDasharray="5 5" fill="url(#colorPred)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
