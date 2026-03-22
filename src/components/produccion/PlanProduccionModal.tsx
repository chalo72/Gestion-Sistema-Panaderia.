import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    FileText,
    Layers,
    Hash,
    AlertTriangle,
    CheckCircle2,
    Scale
} from 'lucide-react';
import { toast } from 'sonner';

import type { Producto, Receta, InventarioItem } from '@/types';

interface PlanProduccionModalProps {
    isOpen: boolean;
    onClose: () => void;
    productos: Producto[];
    recetas: Receta[];
    inventario: InventarioItem[];
    onConfirm: (data: any) => Promise<any>;
}

export function PlanProduccionModal({
    isOpen,
    onClose,
    productos,
    recetas,
    inventario,
    onConfirm
}: PlanProduccionModalProps) {
    const [selectedProductoId, setSelectedProductoId] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [lote, setLote] = useState('');
    const [notaS, setNotas] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const receta = useMemo(() =>
        recetas.find(r => r.productoId === selectedProductoId),
        [recetas, selectedProductoId]);

    const ingredientsPreview = useMemo(() => {
        if (!receta) return [];
        return receta.ingredientes.map(ing => {
            const prodIng = productos.find(p => p.id === ing.productoId);
            const stockItem = inventario.find(i => i.productoId === ing.productoId);
            const stockActual = stockItem?.stockActual || 0;
            const necesita = (ing.cantidad / receta.porcionesResultantes) * cantidad;
            return {
                id: ing.productoId,
                nombre: prodIng?.nombre || 'Ingrediente',
                necesita,
                unidad: ing.unidad,
                disponible: stockActual,
                suficiente: stockActual >= necesita
            };
        });
    }, [receta, cantidad, productos, inventario]);

    const hayFaltantes = ingredientsPreview.some(i => !i.suficiente);

    const handleSubmit = async () => {
        if (!selectedProductoId || cantidad <= 0) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        setIsSubmitting(true);
        try {
            await onConfirm({
                productoId: selectedProductoId,
                cantidadPlaneada: cantidad,
                cantidadCompletada: 0,
                lote: lote || `L-${Date.now().toString().slice(-6)}`,
                notas: notaS,
                costoEstimadoTotal: (receta?.costoPorPorcion || 0) * cantidad,
                usuarioId: crypto.randomUUID() // ID generado por sesión
            });
            toast.success('Orden de producción creada!');
            onClose();
            // Reset
            setSelectedProductoId('');
            setCantidad(1);
            setLote('');
        } catch (e) {
            toast.error('Error al crear la orden');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl bg-[#0f172a]/95 border-slate-800 backdrop-blur-xl text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                        <Layers className="w-6 h-6 text-indigo-400" />
                        Planificar Producción
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Crea un lote de productos elaborados y verifica insumos
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Producto a Elaborar</Label>
                            <Select value={selectedProductoId} onValueChange={setSelectedProductoId}>
                                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-slate-200">
                                    <SelectValue placeholder="Seleccionar pan/torta" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                    {productos.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Cantidad a producir</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(Number(e.target.value))}
                                    className="bg-slate-900/50 border-slate-700 pl-10"
                                />
                                <Scale className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-slate-300 text-xs flex items-center gap-2">
                            <Hash className="w-3 h-3 text-indigo-400" /> Código de Lote (Opcional)
                        </Label>
                        <Input
                            placeholder="Ej: PAN-H-001"
                            value={lote}
                            onChange={(e) => setLote(e.target.value)}
                            className="bg-slate-900/50 border-slate-700"
                        />
                    </div>

                    {/* Ingredientes Preview */}
                    {selectedProductoId && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                Cálculo de Insumos Requeridos
                                {!receta && <Badge variant="destructive" className="text-[10px]">Sin Receta</Badge>}
                            </h3>

                            <div className="max-h-[200px] overflow-y-auto space-y-2 border border-slate-800/50 rounded-lg p-3 bg-slate-950/50">
                                {!receta && (
                                    <p className="text-center text-slate-500 text-xs py-4 italic">
                                        Debes definir una receta para este producto para ver el cálculo de insumos.
                                    </p>
                                )}
                                {ingredientsPreview.map(ing => (
                                    <div key={ing.id} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{ing.nombre}</span>
                                            <span className="text-[10px] text-slate-500">Disponible: {ing.disponible} {ing.unidad}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={cn("font-mono", ing.suficiente ? "text-emerald-400" : "text-rose-500")}>
                                                {ing.necesita.toFixed(2)} {ing.unidad}
                                            </span>
                                            {ing.suficiente ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hayFaltantes && (
                                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>¡Insumos Insuficientes!</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        No tienes suficiente materia prima para este lote. La producción podría fallar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!!selectedProductoId && !receta)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[140px]"
                    >
                        {isSubmitting ? 'Creando...' : 'Lanzar Producción'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
