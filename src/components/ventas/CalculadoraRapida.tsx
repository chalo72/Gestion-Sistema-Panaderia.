import React, { useState } from 'react';
import { Delete, Zap, ShoppingCart } from 'lucide-react';
import { safeNumber } from '@/lib/safe-utils';

interface CalculadoraRapidaProps {
    onAddMonto: (monto: number) => void;
    formatCurrency: (value: number) => string;
}

export function CalculadoraRapida({ onAddMonto, formatCurrency }: CalculadoraRapidaProps) {
    const [monto, setMonto] = useState<string>('');

    const handlePress = (val: string) => {
        if (monto === '0' && val !== '00') {
            setMonto(val);
        } else {
            setMonto(prev => (prev.length < 9 ? prev + val : prev));
        }
    };

    const handleClear = () => setMonto('');
    const handleDelete = () => setMonto(prev => prev.slice(0, -1));

    const handleAdd = () => {
        const num = safeNumber(monto);
        if (num > 0) {
            onAddMonto(num);
            setMonto('');
        }
    };

    const num = safeNumber(monto);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Display Gigante */}
            <div className="p-6 md:p-10 flex flex-col items-end justify-center min-h-[160px] md:min-h-[220px]">
                <span className="text-sm font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Zap className="w-4 h-4" /> Modo Hora Pico
                </span>
                <span className={`font-black truncate w-full text-right ${monto ? 'text-slate-800 dark:text-slate-100 text-7xl md:text-8xl' : 'text-slate-300 dark:text-slate-700 text-6xl md:text-7xl'}`}>
                    {monto ? formatCurrency(num) : formatCurrency(0)}
                </span>
            </div>
            
            {/* Teclado */}
            <div className="flex-1 px-4 pb-6 pt-2 grid grid-cols-3 gap-3 md:gap-5 max-w-md mx-auto w-full content-start">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                    <button
                        key={n}
                        onClick={() => handlePress(n.toString())}
                        className="h-20 md:h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-4xl md:text-5xl font-black shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-700 dark:text-slate-200"
                    >
                        {n}
                    </button>
                ))}
                
                <button
                    onClick={handleClear}
                    className="h-20 md:h-24 rounded-3xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xl font-black uppercase text-slate-500 hover:bg-slate-300 active:scale-95 transition-all"
                >
                    C
                </button>
                
                <button
                    onClick={() => handlePress('0')}
                    className="h-20 md:h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-4xl md:text-5xl font-black shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-700 dark:text-slate-200"
                >
                    0
                </button>
                
                <button
                    onClick={() => handlePress('00')}
                    className="h-20 md:h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-3xl md:text-4xl font-black shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-700 dark:text-slate-200"
                >
                    00
                </button>

                <div className="col-span-3 flex gap-3 mt-2">
                    <button
                        onClick={handleDelete}
                        disabled={!monto}
                        className="flex-[1] h-20 md:h-24 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-500 flex items-center justify-center disabled:opacity-50 hover:bg-rose-100 active:scale-95 transition-all"
                    >
                        <Delete className="w-10 h-10" />
                    </button>
                    
                    <button
                        onClick={handleAdd}
                        disabled={num <= 0}
                        className="flex-[2] h-20 md:h-24 rounded-3xl bg-emerald-500 border border-emerald-600 text-white flex items-center justify-center gap-3 text-2xl font-black uppercase shadow-xl shadow-emerald-500/30 disabled:opacity-50 hover:bg-emerald-400 active:scale-95 transition-all"
                    >
                        <ShoppingCart className="w-8 h-8" />
                        Cobrar {monto ? formatCurrency(num) : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
