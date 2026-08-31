import React, { useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, PieChart as PieIcon, BarChart3, Clock, Star, Crown } from 'lucide-react';
import { MotorPredictivo } from './MotorPredictivo';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];

export function DashboardGraficos({ gastos = [], ventasDiarias = [], ventasPOS = [] }: { gastos: any[], ventasDiarias: any[], ventasPOS: any[] }) {
    const [rango, setRango] = useState<'15d' | '30d' | '12m'>('15d');

    const data = useMemo(() => {
        const today = new Date();
        const map = new Map<string, { fecha: string; label: string; ingresos: number; gastos: number; order: string }>();

        if (rango === '15d' || rango === '30d') {
            const days = rango === '15d' ? 15 : 30;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const str = d.toISOString().slice(0, 10);
                map.set(str, { 
                    fecha: str, 
                    label: `${d.getDate()}/${d.getMonth()+1}`, 
                    ingresos: 0, 
                    gastos: 0, 
                    order: str 
                });
            }
        } else {
            // 12 meses
            for (let i = 11; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
                const label = d.toLocaleString('es', { month: 'short' });
                map.set(key, { 
                    fecha: key, 
                    label: `${label} ${d.getFullYear().toString().slice(2)}`, 
                    ingresos: 0, 
                    gastos: 0, 
                    order: key 
                });
            }
        }

        const fechasConPOS = new Set<string>();

        // Agregar ingresos (Ventas POS)
        ventasPOS.forEach(v => {
            const dateStr = (v.fecha || '').slice(0, 10);
            if (!dateStr) return;
            fechasConPOS.add(dateStr);
            const key = rango === '12m' ? dateStr.slice(0, 7) : dateStr;
            if (map.has(key)) {
                map.get(key)!.ingresos += Number(v.total) || 0;
            }
        });

        // Agregar ingresos (Ventas Diarias) - Solo si no hay POS ese día
        ventasDiarias.forEach(v => {
            const dateStr = (v.fecha || '').slice(0, 10);
            if (!dateStr) return;
            // Si el día ya tiene ventas POS, no sumamos el cierre manual para evitar conteo doble
            if (fechasConPOS.has(dateStr)) return;
            
            const key = rango === '12m' ? dateStr.slice(0, 7) : dateStr;
            if (map.has(key)) {
                map.get(key)!.ingresos += Number(v.total) || 0;
            }
        });

        // Agregar gastos
        gastos.forEach(g => {
            if (g.esIngreso) return; 
            const dateStr = (g.fecha || '').slice(0, 10);
            if (!dateStr) return;
            const key = rango === '12m' ? dateStr.slice(0, 7) : dateStr;
            if (map.has(key)) {
                map.get(key)!.gastos += Number(g.monto) || 0;
            }
        });

        return Array.from(map.values()).sort((a, b) => a.order.localeCompare(b.order));
    }, [gastos, ventasDiarias, ventasPOS, rango]);

    // Calcular distribución de gastos (Categorías)
    const gastosPorCategoria = useMemo(() => {
        const catMap = new Map<string, number>();
        let limitDate = new Date();
        if (rango === '15d') limitDate.setDate(limitDate.getDate() - 15);
        else if (rango === '30d') limitDate.setDate(limitDate.getDate() - 30);
        else limitDate.setMonth(limitDate.getMonth() - 12);
        
        const limitStr = limitDate.toISOString().slice(0, 10);

        gastos.forEach(g => {
            if (g.esIngreso) return;
            const dStr = (g.fecha || '').slice(0, 10);
            if (dStr >= limitStr) {
                const cat = g.categoria || 'otros';
                catMap.set(cat, (catMap.get(cat) || 0) + (Number(g.monto) || 0));
            }
        });

        return Array.from(catMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .filter(i => i.value > 0);
    }, [gastos, rango]);

    // Calcular Horas Pico (solo ventas POS)
    const horasPico = useMemo(() => {
        const hourMap = new Map<number, number>();
        for (let i = 6; i <= 21; i++) hourMap.set(i, 0);

        let limitDate = new Date();
        if (rango === '15d') limitDate.setDate(limitDate.getDate() - 15);
        else if (rango === '30d') limitDate.setDate(limitDate.getDate() - 30);
        else limitDate.setMonth(limitDate.getMonth() - 12);
        
        const limitStr = limitDate.toISOString().slice(0, 10);

        ventasPOS.forEach(v => {
            const dateStr = (v.fecha || '').slice(0, 10);
            if (dateStr >= limitStr) {
                const hour = new Date(v.fecha).getHours();
                if (hourMap.has(hour) || (hour >= 0 && hour <= 23)) {
                    hourMap.set(hour, (hourMap.get(hour) || 0) + (Number(v.total) || 0));
                }
            }
        });

        return Array.from(hourMap.entries())
            .map(([h, val]) => ({
                hora: h > 12 ? `${h-12} PM` : h === 12 ? '12 PM' : `${h} AM`,
                horaNum: h,
                ventas: val
            }))
            .sort((a, b) => a.horaNum - b.horaNum)
            .filter(h => h.ventas > 0 || (h.horaNum >= 6 && h.horaNum <= 21));
    }, [ventasPOS, rango]);

    // Calcular Productos Estrella
    const productosEstrella = useMemo(() => {
        const prodMap = new Map<string, { cantidad: number; ingresos: number }>();
        let limitDate = new Date();
        if (rango === '15d') limitDate.setDate(limitDate.getDate() - 15);
        else if (rango === '30d') limitDate.setDate(limitDate.getDate() - 30);
        else limitDate.setMonth(limitDate.getMonth() - 12);
        
        const limitStr = limitDate.toISOString().slice(0, 10);

        ventasPOS.forEach(v => {
            const dateStr = (v.fecha || '').slice(0, 10);
            if (dateStr >= limitStr && Array.isArray(v.items)) {
                v.items.forEach((item: any) => {
                    const name = item.producto || 'Desconocido';
                    const prev = prodMap.get(name) || { cantidad: 0, ingresos: 0 };
                    prodMap.set(name, {
                        cantidad: prev.cantidad + (Number(item.cantidad) || 0),
                        ingresos: prev.ingresos + ((Number(item.cantidad) || 0) * (Number(item.precio) || 0))
                    });
                });
            }
        });

        return Array.from(prodMap.entries())
            .map(([nombre, stats]) => ({ nombre, ...stats }))
            .sort((a, b) => b.ingresos - a.ingresos)
            .slice(0, 6);
    }, [ventasPOS, rango]);

    const totalIngresos = data.reduce((s, i) => s + i.ingresos, 0);
    const totalGastos = data.reduce((s, i) => s + i.gastos, 0);
    const rentabilidad = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        Análisis Financiero
                    </h2>
                    <p className="text-sm text-slate-500">Métricas y tendencias visuales</p>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
                    <button onClick={() => setRango('15d')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rango === '15d' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                        15 Días
                    </button>
                    <button onClick={() => setRango('30d')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rango === '30d' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                        1 Mes
                    </button>
                    <button onClick={() => setRango('12m')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rango === '12m' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                        1 Año
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-emerald-500/10 border-emerald-500/20 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Ingresos Totales</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{formatCurrency(totalIngresos)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-rose-500/10 border-rose-500/20 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">Gastos Totales</p>
                        <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{formatCurrency(totalGastos)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-500/10 border-indigo-500/20 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Rentabilidad Bruta</p>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{rentabilidad.toFixed(1)}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico Comparativo */}
            <Card className="border-slate-200 dark:border-white/10 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-500" />
                        Ingresos vs Gastos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-72 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="text-slate-500" />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10 }} 
                                    className="text-slate-500"
                                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                                />
                                <Tooltip 
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: number) => formatCurrency(val)}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tendencia de Ingresos */}
                <Card className="border-slate-200 dark:border-white/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Evolución de Ventas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-60 w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="text-slate-500" />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(val: number) => formatCurrency(val)}
                                    />
                                    <Area type="monotone" dataKey="ingresos" name="Ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Distribución de Gastos */}
                <Card className="border-slate-200 dark:border-white/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <PieIcon className="w-4 h-4 text-rose-500" />
                            Distribución de Gastos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                        <div className="h-60 w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={gastosPorCategoria}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {gastosPorCategoria.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(val: number) => formatCurrency(val)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Segunda Fila de Análisis de Inteligencia */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mapa de Calor de Horas Pico */}
                <Card className="border-slate-200 dark:border-white/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Horas Pico de Ventas (Mapa de Calor)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-60 w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={horasPico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                                    <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="text-slate-500" />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(val: number) => formatCurrency(val)}
                                    />
                                    <Bar dataKey="ventas" name="Ventas" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30}>
                                        {horasPico.map((entry, index) => {
                                            const max = Math.max(...horasPico.map(h => h.ventas));
                                            const opacity = max > 0 ? 0.3 + (0.7 * (entry.ventas / max)) : 1;
                                            return <Cell key={index} fill={`rgba(245, 158, 11, ${opacity})`} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-3 font-medium">Descubre a qué horas tienes más flujo de caja para reforzar el turno.</p>
                    </CardContent>
                </Card>

                {/* Productos Estrella */}
                <Card className="border-slate-200 dark:border-white/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <Star className="w-4 h-4 text-violet-500" />
                            Top 6 Productos Estrella
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 mt-2">
                            {productosEstrella.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-10">No hay datos de productos en este periodo.</p>
                            ) : (
                                productosEstrella.map((prod, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-black text-[10px]">
                                                {index === 0 ? <Crown className="w-3.5 h-3.5" /> : `#${index + 1}`}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">{prod.nombre}</p>
                                                <p className="text-[10px] text-muted-foreground">{prod.cantidad} vendidos</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(prod.ingresos)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Motor Predictivo IA */}
            <MotorPredictivo ventas={ventasPOS} />
        </div>
    );
}
