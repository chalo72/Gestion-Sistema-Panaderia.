import React, { useMemo } from 'react';
import { Bot, TrendingDown, AlertTriangle, Lightbulb, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Gasto } from '@/types';

interface TesoreroIAProps {
    gastos: Gasto[];
    formatCurrency: (v: number) => string;
}

export function TesoreroIA({ gastos, formatCurrency }: TesoreroIAProps) {
    const insights = useMemo(() => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const gastosMes = gastos.filter(g => g.fecha >= startOfMonth);

        const totalMes = gastosMes.reduce((acc, g) => acc + g.monto, 0);
        
        // Gastos personales / salidas manuales para la familia
        const gastosPersonales = gastosMes.filter(g => 
            g.categoria === 'Gastos Personales' || 
            g.categoria === 'Otros' || 
            g.descripcion.toLowerCase().includes('personal') || 
            g.descripcion.toLowerCase().includes('familia') ||
            g.descripcion.toLowerCase().includes('socio')
        );
        const totalPersonal = gastosPersonales.reduce((acc, g) => acc + g.monto, 0);

        // Proveedores / Materia Prima
        const gastosOperativos = gastosMes.filter(g => g.categoria === 'Materia Prima' || g.categoria === 'Inventario' || g.categoria === 'Mantenimiento');
        const totalOperativo = gastosOperativos.reduce((acc, g) => acc + g.monto, 0);

        const messages = [];

        if (totalPersonal > 0) {
            const porcentaje = totalMes > 0 ? ((totalPersonal / totalMes) * 100).toFixed(1) : '0';
            messages.push({
                type: 'warning',
                icon: AlertTriangle,
                title: 'Alerta de Fugas Personales',
                text: "Has retirado " + formatCurrency(totalPersonal) + " para gastos extra-operativos este mes (" + porcentaje + "% de tus salidas). Trata de ponerte un sueldo fijo para proteger la liquidez de las cajas."
            });
        }

        if (totalOperativo > 0) {
            messages.push({
                type: 'info',
                icon: TrendingDown,
                title: 'Optimización de Proveedores',
                text: "Tus compras de insumos suman " + formatCurrency(totalOperativo) + ". Te sugiero negociar con mayoristas o comparar facturas de la 36 si esto supera tu margen esperado."
            });
        }

        if (messages.length === 0) {
            messages.push({
                type: 'success',
                icon: PiggyBank,
                title: 'Caja Hermética',
                text: '"Aún no detecto fugas ni sobrecostos este mes. Sigue registrando cada recibo manual y yo cruzaré los datos por ti."'
            });
        }

        return messages;

    }, [gastos, formatCurrency]);

    return (
        <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-xl shadow-indigo-900/20 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-md opacity-40 rounded-full animate-pulse" />
                        <div className="relative w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/50">
                            <Bot className="w-5 h-5 text-indigo-300" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-indigo-100 flex items-center gap-2 tracking-tight">
                            Tesorero IA 
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] text-indigo-300 uppercase tracking-widest font-bold">Auditando</span>
                        </h3>
                        <p className="text-[10px] text-indigo-300/70 font-medium tracking-wide">Análisis automático de fugas de efectivo</p>
                    </div>
                </div>
                <Lightbulb className="w-5 h-5 text-amber-400/50" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((insight, idx) => {
                    const Icon = insight.icon;
                    return (
                        <div key={idx} className={cn(
                            "p-3.5 rounded-xl border flex gap-3 items-start transition-all hover:scale-[1.02]",
                            insight.type === 'warning' ? "bg-amber-950/40 border-amber-500/30 text-amber-200" :
                            insight.type === 'info' ? "bg-blue-950/40 border-blue-500/30 text-blue-200" :
                            "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                        )}>
                            <div className={cn(
                                "p-2 rounded-lg mt-0.5 shrink-0 shadow-inner",
                                insight.type === 'warning' ? "bg-amber-500/20 text-amber-400" :
                                insight.type === 'info' ? "bg-blue-500/20 text-blue-400" :
                                "bg-emerald-500/20 text-emerald-400"
                            )}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black mb-1 uppercase tracking-wider">{insight.title}</h4>
                                <p className="text-[11px] opacity-90 leading-relaxed font-medium">{insight.text.replace(/"/g, '')}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
