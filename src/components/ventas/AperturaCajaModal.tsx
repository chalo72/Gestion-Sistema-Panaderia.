import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AperturaCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAbrir: (monto: number) => Promise<any>;
}

export function AperturaCajaModal({ isOpen, onClose, onAbrir }: AperturaCajaModalProps) {
    const [monto, setMonto] = useState<number>(0);
    const [turno, setTurno] = useState<'Mañana' | 'Tarde'>('Mañana');

    const handleConfirm = async () => {
        // Podríamos enviar el turno como parte del motivo o en un campo extra si el API lo soporta
        await onAbrir(monto);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-3xl p-0 border-none shadow-3xl bg-white dark:bg-slate-950 overflow-hidden">
                {/* Header Estilo Stitch */}
                <div className="bg-[#135bec] p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-3 border border-white/20 shadow-lg">
                            <Clock className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Apertura de Turno</h2>
                        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2 opacity-80">Gestión de Turnos • Dulce Placer</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Selección de Turno */}
                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Seleccionar Horario</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setTurno('Mañana')}
                                className={cn(
                                    "h-12 rounded-xl border-2 font-black text-sm uppercase transition-all flex items-center justify-center gap-2",
                                    turno === 'Mañana' ? "border-blue-600 bg-blue-50 text-blue-600 shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200"
                                )}
                            >
                                <span className="text-xl">☀️</span> Mañana
                            </button>
                            <button
                                onClick={() => setTurno('Tarde')}
                                className={cn(
                                    "h-12 rounded-xl border-2 font-black text-sm uppercase transition-all flex items-center justify-center gap-2",
                                    turno === 'Tarde' ? "border-orange-500 bg-orange-50 text-orange-500 shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200"
                                )}
                            >
                                <span className="text-xl">🌙</span> Tarde
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Efectivo Inicial en Caja</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-50 text-blue-600 flex items-center justify-center group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <input
                                type="number"
                                value={monto}
                                onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                                className="w-full h-16 pl-16 pr-6 text-3xl font-black rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-600/20 focus:bg-white transition-all outline-none tabular-nums"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            onClick={handleConfirm}
                            className="w-full h-16 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95 border-none"
                        >
                            Confirmar Apertura
                        </Button>
                        <button onClick={onClose} className="text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2">
                            Cancelar
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
