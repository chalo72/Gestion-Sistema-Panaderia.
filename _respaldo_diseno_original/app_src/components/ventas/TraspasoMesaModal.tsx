import React from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Users, CheckCircle2 } from 'lucide-react';
import type { Mesa } from '@/types';

interface TraspasoMesaModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mesaActual: Mesa | null;
    vendedoras: any[];
    onConfirmTransfer: (mesa: Mesa, nuevaVendedora: any) => void;
}

export function TraspasoMesaModal({
    open,
    onOpenChange,
    mesaActual,
    vendedoras,
    onConfirmTransfer
}: TraspasoMesaModalProps) {
    if (!mesaActual) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-xl">
                <div className="bg-slate-900 text-white p-5 rounded-t-2xl">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        Traspasar Mesa {mesaActual.numero}
                    </h3>
                    <DialogDescription className="text-xs text-slate-400 mt-1">
                        Selecciona a quién le quieres asignar esta mesa.
                    </DialogDescription>
                </div>
                <div className="p-5">
                    <p className="text-sm font-semibold text-slate-500 mb-3">Meseras Disponibles:</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                        {vendedoras.map((vendedora) => {
                            const isCurrent = mesaActual.abiertaPorId === vendedora.id || mesaActual.abiertaPor === vendedora.nombre;
                            
                            return (
                                <button
                                    key={vendedora.id}
                                    onClick={() => onConfirmTransfer(mesaActual, vendedora)}
                                    disabled={isCurrent}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        isCurrent 
                                        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-md active:scale-95'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                            {vendedora.nombre.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{vendedora.nombre}</p>
                                            {isCurrent && <p className="text-[10px] text-slate-500">Atendiendo actualmente</p>}
                                        </div>
                                    </div>
                                    {!isCurrent && <CheckCircle2 className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
                                </button>
                            );
                        })}
                        {vendedoras.length === 0 && (
                            <p className="text-sm text-center text-slate-500 py-4">No hay más meseras disponibles.</p>
                        )}
                    </div>
                    
                    <div className="mt-5">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}
                            className="w-full h-12 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <X className="w-4 h-4 mr-2" /> Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
