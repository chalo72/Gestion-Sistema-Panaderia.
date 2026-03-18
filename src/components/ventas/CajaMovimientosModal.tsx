import React, { useState } from 'react';
import {
    Plus,
    Minus,
    X,
    DollarSign,
    Loader2,
    MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CajaMovimientosModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    tipo: 'entrada' | 'salida';
    onSubmit: (monto: number, motivo: string) => Promise<void>;
}

export function CajaMovimientosModal({
    isOpen,
    onOpenChange,
    tipo,
    onSubmit
}: CajaMovimientosModalProps) {
    const [monto, setMonto] = useState<string>('');
    const [motivo, setMotivo] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = async () => {
        if (!monto || parseFloat(monto) <= 0 || !motivo) return;

        setIsSaving(true);
        try {
            await onSubmit(parseFloat(monto), motivo);
            setMonto('');
            setMotivo('');
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
                <div className={cn(
                    "p-8 text-white relative",
                    tipo === 'entrada' ? "bg-emerald-600" : "bg-rose-600"
                )}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            {tipo === 'entrada' ? <Plus className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                {tipo === 'entrada' ? 'Entrada de Caja' : 'Salida de Caja'}
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                {tipo === 'entrada' ? 'Ingreso de efectivo externo' : 'Retiro de efectivo del cajón'}
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-6 top-6 text-white/40 hover:text-white"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Monto de la Operación</Label>
                        <div className="relative">
                            <DollarSign className={cn(
                                "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                                tipo === 'entrada' ? "text-emerald-500" : "text-rose-500"
                            )} />
                            <Input
                                type="number"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                placeholder="0.00"
                                className="h-16 pl-12 text-2xl font-black rounded-2xl bg-slate-50 dark:bg-gray-800 border-none shadow-inner"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Motivo / Concepto</Label>
                        <div className="relative">
                            <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                            <textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Ej: Pago a repartidor, Base inicial extra..."
                                className="w-full h-24 pl-12 pt-4 rounded-2xl bg-slate-50 dark:bg-gray-800 border-none shadow-inner font-bold text-sm resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            variant="ghost"
                            className="h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-50"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            disabled={isSaving || !monto || !motivo}
                            onClick={handleConfirm}
                            className={cn(
                                "h-14 flex-[2] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl border-none",
                                tipo === 'entrada'
                                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                            )}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Operación'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
