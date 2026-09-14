import { DollarSign, Plus, Camera, TrendingDown, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpenseHeaderProps {
    onAddGasto: () => void;
    onAddIngreso: () => void;
    onScanReceipt: () => void;
    totalMensual: number;
    totalIngresos: number;
    formatCurrency: (v: number) => string;
    isOnline?: boolean;
}

export function ExpenseHeader({
    onAddGasto,
    onAddIngreso,
    onScanReceipt,
    totalMensual,
    totalIngresos,
    formatCurrency,
    isOnline = true,
}: ExpenseHeaderProps) {
    const resultado = totalIngresos - totalMensual;
    const positivo = resultado >= 0;
    const semaforo =
        resultado > totalIngresos * 0.3 ? 'excelente'
        : resultado >= 0               ? 'ok'
        : totalMensual > totalIngresos * 1.1 ? 'critico'
        : 'alerta';

    const SEMAFORO = {
        excelente: { label: 'Mes controlado ✓',       cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30' },
        ok:        { label: 'Balance estable',          cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30' },
        alerta:    { label: '⚠ Gastos cerca del límite',cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30' },
        critico:   { label: '🔴 Gastos superan ingresos',cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30' },
    };

    const { label, cls } = SEMAFORO[semaforo];

    return (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* Fila superior */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white leading-none">
                            Libro de Caja
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Ingresos · Egresos · Balance
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Indicador offline */}
                    <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest',
                        isOnline
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600'
                    )}>
                        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isOnline ? 'En línea' : 'Sin conexión — guardado local'}
                    </div>

                    <Button variant="outline" onClick={onScanReceipt}
                        className="h-9 px-3 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl gap-1.5 font-black uppercase tracking-widest text-[9px] hover:bg-slate-50 dark:hover:bg-slate-800">
                        <Camera className="w-3.5 h-3.5" />
                        Escanear
                    </Button>
                    <Button onClick={onAddIngreso}
                        className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 font-black uppercase tracking-widest text-[9px] border-none">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Ingreso
                    </Button>
                    <Button onClick={onAddGasto}
                        className="h-9 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-1.5 font-black uppercase tracking-widest text-[9px] border-none">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Gasto
                    </Button>
                </div>
            </div>

            {/* Barra de semáforo + P&L resumen */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2.5 flex flex-wrap items-center gap-4">
                <span className={cn('px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest', cls)}>
                    {label}
                </span>

                <div className="flex items-center gap-6 ml-auto flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos</span>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 ml-1">
                            +{formatCurrency(totalIngresos)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Egresos</span>
                        <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 ml-1">
                            -{formatCurrency(totalMensual)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resultado</span>
                        <span className={cn('text-[13px] font-black ml-1 tabular-nums', positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                            {positivo ? '+' : ''}{formatCurrency(resultado)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
