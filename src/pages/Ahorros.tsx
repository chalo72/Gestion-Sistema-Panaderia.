import React, { useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Venta, Gasto } from '@/types';
import { db } from '@/lib/database';

interface AhorrosProps {
    ventas: Venta[];
    ahorros: any[];
    gastos?: Gasto[];
    formatCurrency: (value: number) => string;
}

interface MetaAhorro {
    id: string;
    nombre: string;
    monto: number;
    plazo: string;
    creadaEn: string;
}

export default function Ahorros({ ventas, ahorros, gastos = [], formatCurrency }: AhorrosProps) {
    const mesActualStr = new Date().toISOString().slice(0, 7);

    // Ventas y gastos del mes actual
    const ventasMesActual = useMemo(() =>
        ventas.filter(v => v.fecha?.startsWith(mesActualStr)).reduce((a, v) => a + v.total, 0),
    [ventas, mesActualStr]);

    const gastosMesActual = useMemo(() =>
        gastos.filter(g => (g.fecha || '').startsWith(mesActualStr)).reduce((a, g) => a + g.monto, 0),
    [gastos, mesActualStr]);

    // Utilidad neta del mes actual = base real para ahorro
    const utilidadNetaMes = Math.max(0, ventasMesActual - gastosMesActual);

    // Ahorro estimado = 15% de ventas brutas totales (acumulado histórico)
    const totalRecaudado = useMemo(() => ventas.reduce((acc, v) => acc + v.total, 0), [ventas]);
    const ahorroEstimado = totalRecaudado * 0.15;

    // Goteo diario dinámico basado en utilidad neta real del mes
    const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const goteoDiario = utilidadNetaMes > 0 ? (utilidadNetaMes * 0.15) / diasDelMes : totalRecaudado * 0.05;

    // Egresos fijos reales del mes: Servicios + Arriendo (de gastos reales)
    const gastosFijosReales = useMemo(() => {
        const categoriasFijas = ['Servicios', 'Arriendo', 'Nomina'];
        return gastos
            .filter(g => (g.fecha || '').startsWith(mesActualStr) && categoriasFijas.includes(g.categoria))
            .reduce((sum, g) => sum + g.monto, 0);
    }, [gastos, mesActualStr]);

    const gastosFijosPorCategoria = useMemo(() => {
        const mapa: Record<string, number> = {};
        gastos
            .filter(g => (g.fecha || '').startsWith(mesActualStr) && ['Servicios', 'Arriendo', 'Nomina'].includes(g.categoria))
            .forEach(g => { mapa[g.categoria] = (mapa[g.categoria] || 0) + g.monto; });
        return mapa;
    }, [gastos, mesActualStr]);

    const [showMetaModal, setShowMetaModal] = useState(false);
    const [metas, setMetas] = useState<MetaAhorro[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('dp_metas_ahorro') || '[]');
        } catch { return []; }
    });
    const [formMeta, setFormMeta] = useState({ nombre: '', monto: '', plazo: '' });

    React.useEffect(() => {
        db.getAllAhorros().then(all => {
            const metasRecord = all.find(r => r.id === 'metas_ahorro');
            if (metasRecord) {
                setMetas(metasRecord.data);
            } else if (metas.length > 0) {
                // Migrar de localStorage a IndexedDB
                db.updateAhorro({ id: 'metas_ahorro', data: metas });
            }
        }).catch(err => {
            console.error('Error al cargar metas de IndexedDB:', err);
        });
    }, []);

    // Meta principal: usa el monto de la primera meta creada, o $5M por defecto
    const metaAhorro = metas.length > 0 ? metas[0].monto : 5000000;
    const porcentajeMeta = Math.min((ahorroEstimado / metaAhorro) * 100, 100);

    // Crecimiento mensual real vs mes anterior
    const crecimientoMensual = useMemo(() => {
        const ahora = new Date();
        const mesActual = ahora.toISOString().slice(0, 7);
        const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString().slice(0, 7);
        const ventasMes = ventas.filter(v => v.fecha?.startsWith(mesActual)).reduce((a, v) => a + v.total, 0);
        const ventasAnterior = ventas.filter(v => v.fecha?.startsWith(mesAnterior)).reduce((a, v) => a + v.total, 0);
        if (ventasAnterior === 0) return ventasMes > 0 ? '+100%' : '—';
        const pct = ((ventasMes - ventasAnterior) / ventasAnterior) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }, [ventas]);

    const handleGuardarMeta = () => {
        if (!formMeta.nombre.trim() || !formMeta.monto) {
            toast.error('Completa el nombre y el monto objetivo');
            return;
        }
        const nueva: MetaAhorro = {
            id: crypto.randomUUID(),
            nombre: formMeta.nombre.trim(),
            monto: parseFloat(formMeta.monto),
            plazo: formMeta.plazo,
            creadaEn: new Date().toISOString(),
        };
        const actualizadas = [...metas, nueva];
        setMetas(actualizadas);
        
        // Guardar en IndexedDB y localStorage (fallback)
        db.updateAhorro({ id: 'metas_ahorro', data: actualizadas }).catch(err => {
            console.error('Error al guardar meta en IndexedDB:', err);
        });
        localStorage.setItem('dp_metas_ahorro', JSON.stringify(actualizadas));
        
        setFormMeta({ nombre: '', monto: '', plazo: '' });
        setShowMetaModal(false);
        toast.success(`Meta "${nueva.nombre}" creada por ${formatCurrency(nueva.monto)}`);
    };

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Mis Ahorros</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Proyección estratégica de capital · Dulce Placer</p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowMetaModal(true)}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-black uppercase tracking-widest text-xs"
                >
                    <Plus className="w-4 h-4" /> Nueva Meta
                </Button>
            </header>

            {/* Main Goal Card - High Visual Impact */}
            <Card className="bg-slate-900 text-white border-none shadow-3xl shadow-emerald-500/10 rounded-[3rem] overflow-hidden relative group min-h-[400px] flex items-center">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 opacity-90" />
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

                {/* Decorative floating elements */}
                <div className="absolute top-10 right-20 w-32 h-32 bg-emerald-400 opacity-10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-10 left-20 w-48 h-48 bg-indigo-500 opacity-5 rounded-full blur-3xl animate-pulse" />

                <CardContent className="p-4 sm:p-8 md:p-12 relative z-10 w-full">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
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

                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
                            {(() => {
                                const ahorroMensual = totalRecaudado > 0 ? (ventasMesActual * 0.15) : 0;
                                const faltante = Math.max(0, metaAhorro - ahorroEstimado);
                                const mesesRestantes = ahorroMensual > 0 ? Math.ceil(faltante / ahorroMensual) : null;
                                const proyLabel = mesesRestantes === null ? '—' : mesesRestantes <= 0 ? '¡Lograda!' : mesesRestantes <= 12 ? `${mesesRestantes} meses` : `${Math.ceil(mesesRestantes / 12)}+ años`;
                                return [
                                    { icon: TrendingUp, label: 'Crecimiento', value: crecimientoMensual, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                    { icon: DollarSign, label: 'Goteo Diario', value: formatCurrency(goteoDiario), color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                    { icon: ShieldCheck, label: 'Utilidad Neta', value: formatCurrency(utilidadNetaMes), color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                    { icon: Rocket, label: 'Meta en', value: proyLabel, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                                ];
                            })().map((stat, idx) => (
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
                        desc: 'Basado en utilidad neta real del mes.',
                        color: 'text-amber-500',
                        bg: 'bg-amber-500/10',
                        content: (
                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed opacity-70">
                                    Algoritmo Yimi destina el <span className="font-bold text-slate-900 dark:text-white">15%</span> de tu utilidad neta mensual.
                                </p>
                                <div className="p-4 bg-slate-50 dark:bg-gray-800/40 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-gray-700/50">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Goteo Diario Real</p>
                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(goteoDiario)}</p>
                                        <p className="text-[9px] text-muted-foreground">Base: utilidad neta {formatCurrency(utilidadNetaMes)}</p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {[
                                        { label: 'Ventas mes', value: ventasMesActual, color: 'text-emerald-600' },
                                        { label: 'Gastos mes', value: -gastosMesActual, color: 'text-rose-500' },
                                        { label: 'Utilidad neta', value: utilidadNetaMes, color: 'text-indigo-600', bold: true },
                                    ].map((row, i) => (
                                        <div key={i} className={cn('flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg', row.bold ? 'bg-indigo-50 dark:bg-indigo-950/20' : '')}>
                                            <span className="text-muted-foreground">{row.label}</span>
                                            <span className={row.color}>{row.value >= 0 ? '' : '-'}{formatCurrency(Math.abs(row.value))}</span>
                                        </div>
                                    ))}
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
                                {metas.length > 0 ? metas.map((meta, i) => {
                                    const colores = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                                    const color = colores[i % colores.length];
                                    const progreso = Math.min((ahorroEstimado / meta.monto) * 100, 100);
                                    const faltante = Math.max(0, meta.monto - ahorroEstimado);
                                    const ahorroMensual = ventasMesActual * 0.15;
                                    const mesesRestantes = ahorroMensual > 0 ? Math.ceil(faltante / ahorroMensual) : null;
                                    const esAlcanzable = mesesRestantes !== null && mesesRestantes <= 24;
                                    return (
                                        <div key={meta.id} className="group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/20 transition-all">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm shrink-0", color)} />
                                                    <span className="text-[10px] font-black uppercase tracking-tight text-slate-800 dark:text-gray-300 truncate">{meta.nombre}</span>
                                                </div>
                                                <Badge variant="outline" className={cn('text-[8px] font-black border-none px-2 py-0.5 rounded-md shrink-0 ml-1',
                                                    progreso >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600')}>
                                                    {progreso >= 100 ? 'LOGRADA ✓' : `${progreso.toFixed(0)}%`}
                                                </Badge>
                                            </div>
                                            <Progress value={progreso} className="h-1 bg-slate-100 dark:bg-gray-800" indicatorClassName={color} />
                                            {progreso < 100 && (
                                                <p className={cn('text-[8px] font-bold mt-1', esAlcanzable ? 'text-emerald-600' : 'text-amber-500')}>
                                                    {mesesRestantes === null ? 'Sin ventas este mes' :
                                                     mesesRestantes <= 0 ? '¡Meta alcanzada!' :
                                                     `~${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'} restantes · ${formatCurrency(faltante)} faltante`}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <p className="text-[10px] text-muted-foreground text-center py-4 opacity-60 font-bold uppercase tracking-widest">Sin metas. Crea una con "Nueva Meta".</p>
                                )}
                            </div>
                        )
                    },
                    {
                        icon: CreditCard,
                        title: 'Flujo de Egresos',
                        desc: 'Gastos fijos reales del mes actual.',
                        color: 'text-rose-500',
                        bg: 'bg-rose-500/10',
                        content: (
                            <div className="space-y-3">
                                {gastosFijosReales > 0 ? (
                                    <>
                                        <div className="space-y-2">
                                            {Object.entries(gastosFijosPorCategoria).map(([cat, monto]) => (
                                                <div key={cat} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/10">
                                                    <span className="text-rose-600/60">{cat}</span>
                                                    <span className="text-rose-600">-{formatCurrency(monto)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-rose-100/50 dark:bg-rose-950/30 border border-rose-200/50">
                                                <span className="text-rose-700">Total Egresos Fijos</span>
                                                <span className="text-rose-700">-{formatCurrency(gastosFijosReales)}</span>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground">
                                            {ventasMesActual > 0 ? `${((gastosFijosReales / ventasMesActual) * 100).toFixed(1)}% de las ventas del mes` : 'Sin ventas este mes'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground text-center py-4 opacity-60 font-bold uppercase tracking-widest">
                                        Sin egresos fijos registrados este mes.<br/>Registra Servicios, Arriendo o Nómina en Gastos.
                                    </p>
                                )}
                                <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest h-11 border-2 border-slate-100 dark:border-gray-800 rounded-2xl hover:bg-slate-50 gap-2">
                                    Ver Centro de Gastos <ArrowRight className="w-3 h-3" />
                                </Button>
                            </div>
                        )
                    }
                ].map((insight, idx) => (
                    <Card key={idx} className="border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden border border-white/20">
                        <CardHeader className="p-4 sm:p-8 pb-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-transform group-hover:rotate-12", insight.bg)}>
                                <insight.icon className={cn("w-6 h-6", insight.color)} />
                            </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">{insight.title}</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">{insight.desc}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-8 pt-4">
                            {insight.content}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal: Nueva Meta de Crecimiento */}
            <Dialog open={showMetaModal} onOpenChange={setShowMetaModal}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Nueva Meta de Ahorro</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Nombre de la meta *</Label>
                            <Input
                                placeholder="ej: Horno industrial, Vitrina nueva..."
                                value={formMeta.nombre}
                                onChange={e => setFormMeta(p => ({ ...p, nombre: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Monto objetivo *</Label>
                            <Input
                                type="number"
                                placeholder="ej: 3000000"
                                value={formMeta.monto}
                                onChange={e => setFormMeta(p => ({ ...p, monto: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Plazo (opcional)</Label>
                            <Input
                                placeholder="ej: Diciembre 2026"
                                value={formMeta.plazo}
                                onChange={e => setFormMeta(p => ({ ...p, plazo: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowMetaModal(false)}>Cancelar</Button>
                        <Button onClick={handleGuardarMeta} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Guardar Meta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

