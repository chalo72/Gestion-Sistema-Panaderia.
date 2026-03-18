import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DollarSign, Calculator, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CajaSesion } from '@/types';

interface CierreCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCerrar: (monto: number) => Promise<any>;
    cajaActiva: CajaSesion | undefined;
    formatCurrency: (value: number) => string;
}

export function CierreCajaModal({ isOpen, onClose, onCerrar, cajaActiva, formatCurrency }: CierreCajaModalProps) {
    const [montoManual, setMontoManual] = useState<string>('');
    const [desglose, setDesglose] = useState<{ [key: number]: number }>({
        500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
    });
    const [showDesglose, setShowDesglose] = useState(false);

    const totalDesglose = Object.entries(desglose).reduce((acc, [denom, cant]) => acc + (Number(denom) * cant), 0);
    const montoFinal = showDesglose ? totalDesglose : (parseFloat(montoManual) || 0);

    const handleConfirm = async () => {
        await onCerrar(montoFinal);
        onClose();
    };

    const totalVentas = cajaActiva?.totalVentas || 0;
    const montoApertura = cajaActiva?.montoApertura || 0;
    const esperado = totalVentas + montoApertura;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl rounded-3xl p-0 border-none shadow-3xl bg-white dark:bg-slate-950 overflow-hidden">
                {/* Header Auditoría Estilo Stitch */}
                <div className="bg-[#0f172a] p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center mb-3 border border-white/10 shadow-lg">
                            <Calculator className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Cierre de Caja</h2>
                        <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-2 opacity-70">Arqueo Profesional • Dulce Placer</p>
                    </div>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Panel de Resumen */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">Ventas Turno</span>
                            <span className="text-xl font-black text-blue-600 tabular-nums">{formatCurrency(totalVentas)}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">Esperado</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(esperado)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Efectivo Contado</label>
                            <button
                                onClick={() => setShowDesglose(!showDesglose)}
                                className="text-xs font-black text-blue-600 uppercase hover:underline flex items-center gap-1.5"
                            >
                                {showDesglose ? 'Cambiar a Manual' : 'Usar Desglose'}
                            </button>
                        </div>

                        {showDesglose ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
                                {Object.keys(desglose).sort((a, b) => Number(b) - Number(a)).map(denom => (
                                    <div key={denom} className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-black text-slate-400 w-12">$ {denom}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={desglose[Number(denom)] || ''}
                                            placeholder="0"
                                            onChange={(e) => setDesglose({ ...desglose, [Number(denom)]: parseInt(e.target.value) || 0 })}
                                            className="w-16 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-black text-sm focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                ))}
                                <div className="col-span-2 pt-4 mt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-400 uppercase">Total Contado:</span>
                                    <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalDesglose)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <input
                                    type="number"
                                    value={montoManual}
                                    onChange={(e) => setMontoManual(e.target.value)}
                                    className="w-full h-16 pl-16 pr-8 text-3xl font-black rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500/20 transition-all outline-none tabular-nums"
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>

                    {/* Resultado */}
                    <div className={cn(
                        "p-4 rounded-xl flex justify-between items-center transition-all border-2",
                        montoFinal === esperado ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900" :
                            Math.abs(montoFinal - esperado) < 5 ? "bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900" : "bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md",
                                montoFinal === esperado ? "bg-emerald-500" : "bg-rose-500"
                            )}>
                                {montoFinal === esperado ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                            </div>
                            <div className="leading-tight">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Diferencia Final</span>
                                <span className={cn(
                                    "text-xl font-black",
                                    montoFinal === esperado ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                                )}>
                                    {montoFinal === esperado ? 'Caja Cuadrada' : formatCurrency(montoFinal - esperado)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                        <Button
                            onClick={handleConfirm}
                            className="w-full h-16 rounded-xl bg-[#0f172a] hover:bg-black text-white font-black uppercase tracking-[0.2em] text-sm shadow-lg transition-all active:scale-95 border-none"
                        >
                            Finalizar y Cerrar Turno
                        </Button>
                        <button onClick={onClose} className="text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2">
                            Cancelar Arqueo
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
