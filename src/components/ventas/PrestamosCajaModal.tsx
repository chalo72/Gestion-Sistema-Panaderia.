import { useState } from 'react';
import { ArrowRightLeft, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CajaSesion } from '@/types';

const EMOJIS_CAJA: Record<string, string> = {
    'Caja Principal':    '🏪',
    'Helados':           '🍦',
    'Fritos':            '🍟',
    'Micheladas':        '🍺',
    'Tortas':            '🎂',
    'Tinto/Capuchinos':  '☕',
    'Tortas Especiales': '🎁',
};

interface PrestamosCajaModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    cajasAbiertas: CajaSesion[];
    onSubmit: (params: {
        cajaOrigenId: string;
        cajaOrigenNombre: string;
        cajaDestinoId: string;
        cajaDestinoNombre: string;
        monto: number;
        motivo: string;
    }) => Promise<void>;
}

export function PrestamosCajaModal({
    isOpen, onOpenChange, cajasAbiertas, onSubmit,
}: PrestamosCajaModalProps) {
    const [monto,          setMonto]          = useState('');
    const [motivo,         setMotivo]         = useState('');
    const [origenId,       setOrigenId]       = useState('');
    const [destinoId,      setDestinoId]      = useState('');
    const [isSaving,       setIsSaving]       = useState(false);
    const [showOrigen,     setShowOrigen]     = useState(false);
    const [showDestino,    setShowDestino]    = useState(false);

    const cajaOrigen  = cajasAbiertas.find(c => c.id === origenId);
    const cajaDestino = cajasAbiertas.find(c => c.id === destinoId);
    const montoNum    = parseFloat(monto) || 0;
    const puedeGuardar = origenId && destinoId && origenId !== destinoId && montoNum > 0;

    const handleClose = () => {
        setMonto(''); setMotivo(''); setOrigenId(''); setDestinoId('');
        onOpenChange(false);
    };

    const handleGuardar = async () => {
        if (!puedeGuardar) return;
        setIsSaving(true);
        try {
            await onSubmit({
                cajaOrigenId:     origenId,
                cajaOrigenNombre: cajaOrigen?.cajaNombre || origenId,
                cajaDestinoId:    destinoId,
                cajaDestinoNombre: cajaDestino?.cajaNombre || destinoId,
                monto: montoNum,
                motivo: motivo.trim() || 'Préstamo entre cajas',
            });
            handleClose();
        } finally {
            setIsSaving(false);
        }
    };

    // Selector de caja reutilizable
    const SelectorCaja = ({
        valor, onSeleccionar, placeholder, show, setShow, excluirId,
    }: {
        valor: string;
        onSeleccionar: (id: string) => void;
        placeholder: string;
        show: boolean;
        setShow: (v: boolean) => void;
        excluirId?: string;
    }) => {
        const seleccionada = cajasAbiertas.find(c => c.id === valor);
        const opciones = cajasAbiertas.filter(c => c.id !== excluirId);
        return (
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 h-11 px-3 rounded-xl border-2 text-sm font-black transition-all",
                        show ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20" : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                    )}
                >
                    {seleccionada ? (
                        <span>
                            {EMOJIS_CAJA[seleccionada.cajaNombre || ''] || '📦'}{' '}
                            {seleccionada.cajaNombre || 'Caja'}
                            {seleccionada.vendedoraNombre ? ` · ${seleccionada.vendedoraNombre}` : ''}
                        </span>
                    ) : (
                        <span className="text-slate-400 font-bold">{placeholder}</span>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", show && "rotate-180")} />
                </button>
                {show && (
                    <div className="absolute z-50 top-12 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                        {opciones.length === 0 ? (
                            <p className="text-xs text-slate-400 font-bold px-3 py-3">Sin cajas disponibles</p>
                        ) : opciones.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => { onSeleccionar(c.id); setShow(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                            >
                                <span className="text-base">{EMOJIS_CAJA[c.cajaNombre || ''] || '📦'}</span>
                                <div>
                                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase">
                                        {c.cajaNombre || 'Caja'}
                                    </p>
                                    {c.vendedoraNombre && (
                                        <p className="text-[10px] text-slate-400 font-bold">{c.vendedoraNombre}</p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
                {/* Encabezado */}
                <DialogHeader className="bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-center">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
                        <ArrowRightLeft className="w-6 h-6 text-white" />
                    </div>
                    <DialogTitle className="text-lg font-black text-white uppercase tracking-wide">
                        Préstamo entre Cajas
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-[11px] font-bold uppercase tracking-widest mt-1">
                        Registra el movimiento de dinero entre cajas
                    </DialogDescription>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    {/* Caja origen */}
                    <div>
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            📤 Caja que presta (origen)
                        </Label>
                        <SelectorCaja
                            valor={origenId}
                            onSeleccionar={setOrigenId}
                            placeholder="Seleccionar caja origen..."
                            show={showOrigen}
                            setShow={setShowOrigen}
                            excluirId={destinoId}
                        />
                    </div>

                    {/* Flecha visual */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center border border-violet-200 dark:border-violet-700">
                            <ArrowRightLeft className="w-4 h-4 text-violet-600" />
                        </div>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>

                    {/* Caja destino */}
                    <div>
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            📥 Caja que recibe (destino)
                        </Label>
                        <SelectorCaja
                            valor={destinoId}
                            onSeleccionar={setDestinoId}
                            placeholder="Seleccionar caja destino..."
                            show={showDestino}
                            setShow={setShowDestino}
                            excluirId={origenId}
                        />
                    </div>

                    {/* Monto */}
                    <div>
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            💰 Monto a prestar
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">$</span>
                            <Input
                                type="number"
                                min={0}
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                placeholder="0"
                                className="pl-7 h-11 text-base font-black rounded-xl border-2 border-slate-200 dark:border-slate-600 focus:border-violet-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>

                    {/* Motivo */}
                    <div>
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                            📝 Motivo (opcional)
                        </Label>
                        <Input
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            placeholder="Ej: Falta cambio, apoyo turno..."
                            className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 focus:border-violet-400 outline-none font-bold text-sm"
                        />
                    </div>

                    {/* Resumen visual */}
                    {cajaOrigen && cajaDestino && montoNum > 0 && (
                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 border border-violet-200 dark:border-violet-700">
                            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">Resumen del préstamo</p>
                            <p className="text-sm font-black text-slate-800 dark:text-white">
                                {EMOJIS_CAJA[cajaOrigen.cajaNombre || ''] || '📦'} {cajaOrigen.cajaNombre}
                                {' '}<span className="text-violet-500">→</span>{' '}
                                {EMOJIS_CAJA[cajaDestino.cajaNombre || ''] || '📦'} {cajaDestino.cajaNombre}
                            </p>
                            <p className="text-lg font-black text-violet-700 dark:text-violet-300 mt-1">
                                ${montoNum.toLocaleString('es-CO')}
                            </p>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSaving}
                            className="flex-1 h-11 rounded-xl font-black text-xs uppercase"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGuardar}
                            disabled={!puedeGuardar || isSaving}
                            className="flex-1 h-11 rounded-xl font-black text-xs uppercase bg-violet-600 hover:bg-violet-700 text-white gap-2"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            {isSaving ? 'Registrando...' : 'Registrar Préstamo'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
