import { useState, useRef } from 'react';
import { TrendingDown, TrendingUp, ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GastoCategoria, MetodoPago } from '@/types';

const CATS_RAPIDAS = ['Materia Prima', 'Servicios', 'Nómina', 'Arriendo', 'Mantenimiento', 'Otros'];

interface QuickEntryBarProps {
    onSave: (data: { descripcion: string; monto: number; categoria: GastoCategoria; metodoPago: MetodoPago; esIngreso: boolean }) => Promise<void>;
}

export function QuickEntryBar({ onSave }: QuickEntryBarProps) {
    const [monto, setMonto]         = useState('');
    const [descripcion, setDesc]    = useState('');
    const [categoria, setCat]       = useState<GastoCategoria>('Otros');
    const [esIngreso, setEsIngreso] = useState(false);
    const [showCats, setShowCats]   = useState(false);
    const [saving, setSaving]       = useState(false);
    const montoRef = useRef<HTMLInputElement>(null);

    const listo = monto.length > 0 && parseFloat(monto) > 0;

    const handleSave = async () => {
        if (!listo || saving) return;
        setSaving(true);
        try {
            await onSave({
                descripcion: descripcion.trim() || (esIngreso ? 'Ingreso rápido' : 'Gasto rápido'),
                monto: parseFloat(monto),
                categoria,
                metodoPago: 'efectivo',
                esIngreso,
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

    return (
        <div className="fixed bottom-4 left-4 right-4 z-30 md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:right-auto">
            <div className={cn(
                'rounded-2xl border shadow-2xl bg-white dark:bg-slate-900 overflow-hidden transition-all',
                esIngreso
                    ? 'border-emerald-300 dark:border-emerald-700 shadow-emerald-100 dark:shadow-emerald-950'
                    : 'border-rose-200 dark:border-rose-800 shadow-rose-100 dark:shadow-rose-950'
            )}>
                {/* Barra principal */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                    {/* Toggle ingreso/gasto */}
                    <button
                        onClick={() => setEsIngreso(v => !v)}
                        className={cn(
                            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all',
                            esIngreso ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'
                        )}
                        title={esIngreso ? 'Cambiar a gasto' : 'Cambiar a ingreso'}
                    >
                        {esIngreso ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </button>

                    {/* Descripción */}
                    <input
                        value={descripcion}
                        onChange={e => setDesc(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && montoRef.current?.focus()}
                        placeholder={esIngreso ? 'Ingreso rápido...' : 'Descripción...'}
                        className="flex-1 bg-transparent text-sm font-bold text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 outline-none min-w-0"
                    />

                    {/* Categoría */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setShowCats(v => !v)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        >
                            {categoria.split(' ')[0]}
                            <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                        {showCats && (
                            <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 min-w-[140px]">
                                {CATS_RAPIDAS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { setCat(c as GastoCategoria); setShowCats(false); }}
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

                    {/* Monto */}
                    <div className="flex items-center shrink-0">
                        <span className={cn('text-sm font-black', esIngreso ? 'text-emerald-500' : 'text-rose-500')}>$</span>
                        <input
                            ref={montoRef}
                            type="number"
                            value={monto}
                            onChange={e => setMonto(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="0"
                            className="w-24 bg-transparent text-sm font-black tabular-nums text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 outline-none text-right"
                        />
                    </div>

                    {/* Botón guardar */}
                    <button
                        onClick={handleSave}
                        disabled={!listo || saving}
                        className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black transition-all',
                            listo && !saving
                                ? esIngreso
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        )}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                </div>

                {/* Indicador del tipo */}
                <div className={cn(
                    'h-0.5 w-full transition-all duration-300',
                    esIngreso ? 'bg-emerald-400' : 'bg-rose-400'
                )} />
            </div>
        </div>
    );
}
