import { useState, useRef } from 'react';
import { TrendingDown, TrendingUp, ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GastoCategoria, MetodoPago } from '@/types';

const CATS_RAPIDAS = ['Materia Prima', 'Servicios', 'Nómina', 'Arriendo', 'Mantenimiento', 'Otros'];

interface QuickEntryBarProps {
    onSave: (data: {
        descripcion: string;
        monto: number;
        categoria: GastoCategoria;
        metodoPago: MetodoPago;
        esIngreso: boolean;
    }) => Promise<void>;
    /** fixed = flotante abajo (pantalla Gastos). inline = embebido y bien visible (Mi Quincena). */
    variant?: 'fixed' | 'inline';
    /** En Mi Quincena solo se registran gastos (no ingresos). */
    soloGasto?: boolean;
}

export function QuickEntryBar({ onSave, variant = 'fixed', soloGasto = false }: QuickEntryBarProps) {
    const [monto, setMonto] = useState('');
    const [descripcion, setDesc] = useState('');
    const [categoria, setCat] = useState<GastoCategoria>('Otros');
    const [esIngreso, setEsIngreso] = useState(false);
    const [showCats, setShowCats] = useState(false);
    const [saving, setSaving] = useState(false);
    const montoRef = useRef<HTMLInputElement>(null);

    const esIngresoActivo = soloGasto ? false : esIngreso;
    const listo = monto.length > 0 && parseFloat(monto) > 0;
    const esInline = variant === 'inline';

    const handleSave = async () => {
        if (!listo || saving) return;
        setSaving(true);
        try {
            await onSave({
                descripcion: descripcion.trim() || (esIngresoActivo ? 'Ingreso rápido' : 'Gasto rápido'),
                monto: parseFloat(monto),
                categoria,
                metodoPago: 'efectivo',
                esIngreso: esIngresoActivo,
            });
            setMonto('');
            setDesc('');
            setCat('Otros');
            setEsIngreso(false);
            montoRef.current?.focus();
        } finally {
            setSaving(false);
        }
    };

    const barra = (
        <div
            className={cn(
                'rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-all',
                esInline
                    ? 'border-2 border-rose-400 dark:border-rose-500 shadow-lg shadow-rose-500/20 ring-2 ring-rose-400/30'
                    : 'shadow-2xl',
                !esInline &&
                    (esIngresoActivo
                        ? 'border-emerald-300 dark:border-emerald-700 shadow-emerald-100 dark:shadow-emerald-950'
                        : 'border-rose-200 dark:border-rose-800 shadow-rose-100 dark:shadow-rose-950')
            )}
        >
            {esInline && (
                <div className="px-4 py-2.5 bg-rose-500 text-white flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest">
                        Escribe aquí el gasto de hoy
                    </p>
                </div>
            )}

            <div
                className={cn(
                    'flex gap-2 px-3',
                    esInline ? 'flex-col sm:flex-row sm:items-center py-3' : 'items-center py-2.5'
                )}
            >
                {!soloGasto && (
                    <button
                        type="button"
                        onClick={() => setEsIngreso((v) => !v)}
                        className={cn(
                            'rounded-xl flex items-center justify-center shrink-0 transition-all',
                            esInline ? 'w-12 h-12' : 'w-8 h-8',
                            esIngresoActivo
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'
                        )}
                        title={esIngresoActivo ? 'Cambiar a gasto' : 'Cambiar a ingreso'}
                    >
                        {esIngresoActivo ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </button>
                )}

                <input
                    value={descripcion}
                    onChange={(e) => setDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && montoRef.current?.focus()}
                    placeholder={esIngresoActivo ? 'Ingreso rápido...' : '¿En qué gastaste? (ej. gas, huevos…)'}
                    className={cn(
                        'flex-1 bg-transparent font-bold text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none min-w-0',
                        esInline
                            ? 'h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-base'
                            : 'text-sm'
                    )}
                />

                <div className={cn('flex items-center gap-2', esInline && 'w-full sm:w-auto')}>
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowCats((v) => !v)}
                            className={cn(
                                'flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all',
                                esInline ? 'h-12 px-3 text-[10px]' : 'px-2 py-1 text-[9px]'
                            )}
                        >
                            {categoria.split(' ')[0]}
                            <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                        {showCats && (
                            <div
                                className={cn(
                                    'absolute right-0 mb-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 min-w-[140px]',
                                    esInline ? 'top-full mt-1' : 'bottom-full'
                                )}
                            >
                                {CATS_RAPIDAS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => {
                                            setCat(c as GastoCategoria);
                                            setShowCats(false);
                                        }}
                                        className={cn(
                                            'w-full text-left px-3 py-1.5 text-xs font-bold transition-colors',
                                            c === categoria
                                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        className={cn(
                            'flex items-center shrink-0',
                            esInline &&
                                'flex-1 h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
                        )}
                    >
                        <span
                            className={cn(
                                'font-black',
                                esInline ? 'text-lg' : 'text-sm',
                                esIngresoActivo ? 'text-emerald-500' : 'text-rose-500'
                            )}
                        >
                            $
                        </span>
                        <input
                            ref={montoRef}
                            type="number"
                            inputMode="decimal"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            placeholder="0"
                            className={cn(
                                'bg-transparent font-black tabular-nums text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-right',
                                esInline ? 'w-full text-lg' : 'w-24 text-sm'
                            )}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!listo || saving}
                        className={cn(
                            'rounded-xl flex items-center justify-center shrink-0 font-black transition-all',
                            esInline ? 'h-12 px-4 gap-2 min-w-[7.5rem] text-sm' : 'w-9 h-9',
                            listo && !saving
                                ? esIngresoActivo
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        )}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : esInline ? (
                            <>
                                <Check className="w-4 h-4" />
                                Guardar
                            </>
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            <div
                className={cn(
                    'h-0.5 w-full transition-all duration-300',
                    esIngresoActivo ? 'bg-emerald-400' : 'bg-rose-400'
                )}
            />
        </div>
    );

    if (esInline) {
        return <div className="w-full relative z-10">{barra}</div>;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-30 md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:right-auto">
            {barra}
        </div>
    );
}
