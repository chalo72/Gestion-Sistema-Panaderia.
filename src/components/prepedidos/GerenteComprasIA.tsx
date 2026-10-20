import React, { useEffect, useMemo, useState } from 'react';
import { Bot, TrendingUp, AlertTriangle, PackageSearch, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GerenteComprasIAProps {
    ventas: any[];
    prepedidos: any[];
    formatCurrency: (v: number) => string;
    /** Vista ultra-compacta (p. ej. con catálogo abierto) */
    compactDefault?: boolean;
}

export function GerenteComprasIA({ ventas, prepedidos, formatCurrency, compactDefault = false }: GerenteComprasIAProps) {
    const [temporada, setTemporada] = useState<'baja' | 'normal' | 'alta'>('normal');
    const [expanded, setExpanded] = useState(!compactDefault);

    // Al abrir el catálogo de un proveedor, colapsar para liberar altura útil
    useEffect(() => {
        if (compactDefault) setExpanded(false);
    }, [compactDefault]);

    const analisis = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;

        const ventasRecientes = ventas.filter(v => new Date(v.fecha).getTime() >= startOfToday - sieteDiasMs);
        const ventasAnteriores = ventas.filter(v => {
            const t = new Date(v.fecha).getTime();
            return t >= startOfToday - (2 * sieteDiasMs) && t < startOfToday - sieteDiasMs;
        });

        const totalReciente = ventasRecientes.reduce((acc, v) => acc + (v.total || 0), 0);
        const totalAnterior = ventasAnteriores.reduce((acc, v) => acc + (v.total || 0), 0);

        let crecimiento = 0;
        if (totalAnterior > 0) {
            crecimiento = ((totalReciente - totalAnterior) / totalAnterior) * 100;
        }

        const factorTemporada = temporada === 'alta' ? 1.3 : temporada === 'baja' ? 0.8 : 1;
        const tendencia = crecimiento > 0 ? (1 + (crecimiento / 100)) : 1;

        const presupuestoBaseSemanal = totalReciente * 0.35;
        let presupuestoSugerido = presupuestoBaseSemanal * factorTemporada * tendencia;

        if (presupuestoSugerido === 0) presupuestoSugerido = 1500000;

        const totalPidiendo = prepedidos.reduce((acc, p) => {
            if (p.estado === 'recibido' || p.estado === 'cancelado') return acc;
            const sub = (p.items || []).reduce((sum: number, i: any) => sum + ((i.cantidad || 0) * (i.precioUnitario || 0)), 0);
            return acc + sub;
        }, 0);

        const porcentajeUsado = (totalPidiendo / presupuestoSugerido) * 100;
        const disponible = Math.max(0, presupuestoSugerido - totalPidiendo);

        const messages: { type: string; icon: typeof AlertTriangle; title: string; text: string }[] = [];

        if (crecimiento > 5) {
            messages.push({
                type: 'success',
                icon: TrendingUp,
                title: 'Negocio en Crecimiento',
                text: "¡Tus ventas han subido un " + crecimiento.toFixed(1) + "%! He ajustado tu tope de compras hacia arriba para que no te quedes sin stock en este buen momento."
            });
        } else if (crecimiento < -5) {
            messages.push({
                type: 'warning',
                icon: TrendingUp,
                title: 'Ventas en Desaceleración',
                text: "Las ventas bajaron un " + Math.abs(crecimiento).toFixed(1) + "% comparado a la semana anterior. Compra lo estrictamente necesario."
            });
        }

        if (porcentajeUsado > 90) {
            messages.push({
                type: 'danger',
                icon: AlertTriangle,
                title: 'Límite de Presupuesto',
                text: "Estás al " + porcentajeUsado.toFixed(1) + "% del presupuesto inteligente. Revisa si hay algo que puedas aplazar para la otra semana."
            });
        } else {
            messages.push({
                type: 'info',
                icon: PackageSearch,
                title: 'Espacio en Presupuesto',
                text: 'Aún tienes liquidez para surtir según la tendencia actual. Selecciona tus proveedores y yo vigilaré los montos.'
            });
        }

        return { presupuestoSugerido, totalPidiendo, disponible, porcentajeUsado, messages, crecimiento };
    }, [ventas, prepedidos, temporada]);

    const primaryMsg = analisis.messages.find(m => m.type === 'danger') || analisis.messages[analisis.messages.length - 1];
    const PrimaryIcon = primaryMsg.icon;
    const isDanger = primaryMsg.type === 'danger' || analisis.porcentajeUsado > 100;
    const isWarn = primaryMsg.type === 'warning' || (!isDanger && analisis.porcentajeUsado > 90);

    return (
        <div className={cn(
            "border shadow-sm",
            isDanger
                ? "bg-slate-900 border-rose-500/40"
                : isWarn
                    ? "bg-slate-900 border-amber-500/40"
                    : "bg-gradient-to-br from-slate-900 to-indigo-950/90 border-indigo-500/30",
            expanded ? "rounded-2xl p-3 sm:p-4 mb-3" : "rounded-xl px-3 py-2 mb-2"
        )}>
            {/* Barra compacta siempre visible */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-2.5 text-left min-w-0"
                aria-expanded={expanded}
            >
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                    isDanger ? "bg-rose-500/20 border-rose-400/40 text-rose-300" :
                    isWarn ? "bg-amber-500/20 border-amber-400/40 text-amber-300" :
                    "bg-blue-500/20 border-blue-400/40 text-blue-300"
                )}>
                    {expanded ? <Bot className="w-4 h-4" /> : <PrimaryIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                            "text-[11px] font-black uppercase tracking-wider truncate",
                            isDanger ? "text-rose-200" : isWarn ? "text-amber-200" : "text-blue-100"
                        )}>
                            {primaryMsg.title}
                        </span>
                        <span className={cn(
                            "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md shrink-0",
                            isDanger ? "bg-rose-500/25 text-rose-100" :
                            isWarn ? "bg-amber-500/25 text-amber-100" :
                            "bg-blue-500/20 text-blue-100"
                        )}>
                            {analisis.porcentajeUsado.toFixed(0)}%
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 tabular-nums hidden sm:inline">
                            Disp. {formatCurrency(analisis.disponible)}
                        </span>
                    </div>
                    {!expanded && (
                        <p className="text-[10px] text-slate-300 font-medium truncate mt-0.5 leading-tight">
                            {primaryMsg.text}
                        </p>
                    )}
                </div>
                {expanded
                    ? <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />}
            </button>

            {expanded && (
                <div className="mt-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-[10px] text-blue-200/80 font-medium tracking-wide">
                            Comprador IA · tendencias de compras
                        </p>
                        <div className="flex bg-slate-950/50 p-0.5 rounded-lg border border-slate-800 self-start">
                            <button type="button" onClick={() => setTemporada('baja')} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", temporada === 'baja' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white')}>Baja</button>
                            <button type="button" onClick={() => setTemporada('normal')} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", temporada === 'normal' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white')}>Normal</button>
                            <button type="button" onClick={() => setTemporada('alta')} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", temporada === 'alta' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white')}>Alta</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-2">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mb-0.5">Tope</p>
                            <p className="text-sm font-black text-slate-100 tabular-nums">{formatCurrency(analisis.presupuestoSugerido)}</p>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-2">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mb-0.5">Carrito</p>
                            <p className={cn("text-sm font-black tabular-nums", analisis.porcentajeUsado > 100 ? "text-rose-300" : "text-amber-300")}>{formatCurrency(analisis.totalPidiendo)}</p>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-2">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mb-0.5">Disponible</p>
                            <p className="text-sm font-black text-emerald-300 tabular-nums">{formatCurrency(analisis.disponible)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {analisis.messages.map((insight, idx) => {
                            const Icon = insight.icon;
                            return (
                                <div key={idx} className={cn(
                                    "p-2.5 rounded-xl border flex gap-2.5 items-start",
                                    insight.type === 'danger' ? "bg-rose-950/40 border-rose-500/30 text-rose-100" :
                                    insight.type === 'warning' ? "bg-amber-950/40 border-amber-500/30 text-amber-100" :
                                    insight.type === 'info' ? "bg-blue-950/40 border-blue-500/30 text-blue-100" :
                                    "bg-emerald-950/40 border-emerald-500/30 text-emerald-100"
                                )}>
                                    <div className={cn(
                                        "p-1.5 rounded-lg shrink-0",
                                        insight.type === 'danger' ? "bg-rose-500/20 text-rose-300" :
                                        insight.type === 'warning' ? "bg-amber-500/20 text-amber-300" :
                                        insight.type === 'info' ? "bg-blue-500/20 text-blue-300" :
                                        "bg-emerald-500/20 text-emerald-300"
                                    )}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[10px] font-black mb-0.5 uppercase tracking-wider">{insight.title}</h4>
                                        <p className="text-[10px] text-inherit/95 leading-relaxed font-medium opacity-95">{insight.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
