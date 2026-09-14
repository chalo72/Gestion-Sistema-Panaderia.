import React, { useState } from 'react';
import {
    Plus,
    Minus,
    X,
    DollarSign,
    Loader2,
    MessageSquare,
    Store,
    ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CajaSesion } from '@/types';

interface CajaMovimientosModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    tipo: 'entrada' | 'salida';
    onSubmit: (monto: number, motivo: string, cajaId?: string) => Promise<void>;
    // Lista de cajas abiertas para seleccionar
    cajasAbiertas?: CajaSesion[];
    cajaActiva?: CajaSesion;
}

const EMOJIS_CAJA: Record<string, string> = {
    'Caja Principal':    '🏪',
    'Helados':           '🍦',
    'Fritos':            '🍟',
    'Micheladas':        '🍺',
    'Tortas':            '🎂',
    'Tinto/Capuchinos':  '☕',
    'Tortas Especiales': '🎁',
};

export function CajaMovimientosModal({
    isOpen,
    onOpenChange,
    tipo,
    onSubmit,
    cajasAbiertas = [],
    cajaActiva,
}: CajaMovimientosModalProps) {
    const [monto,       setMonto]       = useState<string>('');
    const [motivo,      setMotivo]      = useState<string>('');
    const [isSaving,    setIsSaving]    = useState(false);
    const [cajaId,      setCajaId]      = useState<string>(cajaActiva?.id || '');
    const [showCajas,   setShowCajas]   = useState(false);

    // Sincronizar caja seleccionada cuando cambie cajaActiva
    React.useEffect(() => {
        if (isOpen) setCajaId(cajaActiva?.id || cajasAbiertas[0]?.id || '');
    }, [isOpen, cajaActiva]);

    const cajaSeleccionada = cajasAbiertas.find(c => c.id === cajaId) ?? cajaActiva;

    const handleConfirm = async () => {
        if (!monto || parseFloat(monto) <= 0 || !motivo) return;
        setIsSaving(true);
        try {
            await onSubmit(parseFloat(monto), motivo, cajaId || undefined);
            setMonto('');
            setMotivo('');
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    const esEntrada = tipo === 'entrada';
    const color = esEntrada ? 'emerald' : 'rose';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
                {/* Header */}
                <div className={cn(
                    "p-5 text-white relative",
                    esEntrada ? "bg-emerald-600" : "bg-rose-600"
                )}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/20">
                            {esEntrada ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black uppercase tracking-tight">
                                {esEntrada ? 'Entrada de Caja' : 'Salida de Caja'}
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                {esEntrada ? 'Ingreso de efectivo' : 'Retiro de efectivo'}
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost" size="icon"
                        className="absolute right-4 top-4 text-white/40 hover:text-white"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-5 space-y-4">

                    {/* Selector de caja */}
                    {cajasAbiertas.length > 1 && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Seleccionar Caja
                            </Label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowCajas(!showCajas)}
                                    className="w-full h-11 px-3 flex items-center gap-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 transition-all"
                                >
                                    <Store className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="flex-1 text-left text-sm font-black text-slate-800 dark:text-white truncate">
                                        {EMOJIS_CAJA[cajaSeleccionada?.cajaNombre || ''] || '📦'} {cajaSeleccionada?.cajaNombre || 'Seleccionar caja'}
                                    </span>
                                    {cajaSeleccionada?.vendedoraNombre && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[100px]">
                                            {cajaSeleccionada.vendedoraNombre}
                                        </span>
                                    )}
                                    <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform", showCajas && "rotate-180")} />
                                </button>

                                {showCajas && (
                                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                        {cajasAbiertas.map(caja => (
                                            <button
                                                key={caja.id}
                                                onClick={() => { setCajaId(caja.id); setShowCajas(false); }}
                                                className={cn(
                                                    "w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left",
                                                    cajaId === caja.id && "bg-indigo-50 dark:bg-indigo-900/20"
                                                )}
                                            >
                                                <span className="text-lg">{EMOJIS_CAJA[caja.cajaNombre || ''] || '📦'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{caja.cajaNombre || 'Caja'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 truncate">{caja.vendedoraNombre || 'Sin asignar'}</p>
                                                </div>
                                                {cajaId === caja.id && (
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Monto */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monto</Label>
                        <div className="relative">
                            <DollarSign className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                                esEntrada ? "text-emerald-500" : "text-rose-500"
                            )} />
                            <input
                                type="number"
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                placeholder="0"
                                autoFocus
                                className="w-full h-12 pl-9 pr-3 text-xl font-black rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-indigo-400 tabular-nums transition-all"
                            />
                        </div>
                    </div>

                    {/* Motivo */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción / Motivo</Label>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <textarea
                                value={motivo}
                                onChange={e => setMotivo(e.target.value)}
                                placeholder="Ej: Pago proveedor, Base inicial, Retiro administrativo..."
                                className="w-full h-20 pl-9 pt-3 pr-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-indigo-400 font-bold text-sm resize-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 h-10 rounded-xl font-black uppercase text-xs"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            disabled={isSaving || !monto || !motivo}
                            onClick={handleConfirm}
                            className={cn(
                                "flex-[2] h-10 text-white rounded-xl font-black uppercase text-xs",
                                esEntrada
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-rose-600 hover:bg-rose-700"
                            )}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirmar ${esEntrada ? 'Entrada' : 'Salida'}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
