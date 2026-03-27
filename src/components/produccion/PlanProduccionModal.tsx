import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Scale, Hash, AlertTriangle, ChefHat, Info, TrendingUp
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';

import type { Producto, Receta, InventarioItem, FormulacionBase, ModeloPan } from '@/types';

interface PlanProduccionModalProps {
    isOpen: boolean;
    onClose: () => void;
    productos: Producto[];
    recetas: Receta[];
    formulaciones: FormulacionBase[];
    modelos: ModeloPan[];
    inventario: InventarioItem[];
    onConfirm: (data: any) => Promise<any>;
}

export function PlanProduccionModal({
    isOpen,
    onClose,
    productos,
    recetas,
    formulaciones,
    modelos,
    inventario,
    onConfirm
}: PlanProduccionModalProps) {
    const [selectedProductoId, setSelectedProductoId] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [lote, setLote] = useState('');
    const [notas, setNotas] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Identificar si hay Modelo de Pan asociado (Sistema Maestro)
    const modeloPan = useMemo(() => 
        modelos.find(m => m.id === selectedProductoId || m.nombre.toLowerCase().includes(productos.find(p=>p.id===selectedProductoId)?.nombre.toLowerCase() || '---')),
        [modelos, selectedProductoId, productos]);

    const formulacion = useMemo(() => 
        formulaciones.find(f => f.id === modeloPan?.formulacionId),
        [formulaciones, modeloPan]);

    // 2. Fallback a Receta clásica si no hay Modelo
    const receta = useMemo(() =>
        recetas.find(r => r.productoId === selectedProductoId),
        [recetas, selectedProductoId]);

    // 3. Cálculos Pro (Arrobas y Rendimiento)
    const statsProduccion = useMemo(() => {
        if (modeloPan && formulacion) {
            const arrobas = cantidad / modeloPan.panesPorArroba;
            return {
                usarFormulacion: true,
                arrobas: Math.ceil(arrobas * 100) / 100,
                costoEstimado: formulacion.costoTotalArroba * arrobas,
                ingredientes: formulacion.ingredientes.map(ing => ({
                    id: ing.productoId,
                    nombre: productos.find(p => p.id === ing.productoId)?.nombre || 'Insumo',
                    necesita: ing.cantidadPorArroba * arrobas,
                    unidad: ing.unidad,
                    disponible: inventario.find(i => i.productoId === ing.productoId)?.stockActual || 0,
                }))
            };
        }
        
        if (receta) {
            return {
                usarFormulacion: false,
                arrobas: 0,
                costoEstimado: receta.costoPorPorcion * cantidad,
                ingredientes: receta.ingredientes.map(ing => ({
                    id: ing.productoId,
                    nombre: productos.find(p => p.id === ing.productoId)?.nombre || 'Insumo',
                    necesita: (ing.cantidad / receta.porcionesResultantes) * cantidad,
                    unidad: ing.unidad,
                    disponible: inventario.find(i => i.productoId === ing.productoId)?.stockActual || 0,
                }))
            };
        }

        return null;
    }, [modeloPan, formulacion, receta, cantidad, productos, inventario]);

    const ingredientsPreview = useMemo(() => {
        if (!statsProduccion) return [];
        return statsProduccion.ingredientes.map(ing => ({
            ...ing,
            suficiente: ing.disponible >= ing.necesita
        }));
    }, [statsProduccion]);

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
                notas: notas,
                costoEstimadoTotal: statsProduccion?.costoEstimado || 0,
                usuarioId: crypto.randomUUID(),
                // Datos adicionales del sistema Maestro
                formulacionId: formulacion?.id,
                modeloPanId: modeloPan?.id,
                arrobasUsadas: statsProduccion?.arrobas || 0
            });
            toast.success('Lote de producción lanzado!');
            onClose();
            setSelectedProductoId('');
            setCantidad(1);
            setLote('');
            setNotas('');
        } catch (e) {
            toast.error('Error al crear la orden');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-slate-950 border-slate-800/80 backdrop-blur-3xl text-white rounded-[3rem] p-0 overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 max-h-[92vh] flex flex-col">
                <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex-none" />
                
                <div className="p-8 overflow-y-auto flex-1">
                    <DialogHeader className="mb-8 text-left">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                                <ChefHat className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                                    Lanzar Producción
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                    Control Maestro de Panadería • Dulce Placer
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
    
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Producto Maestro</Label>
                                    {modeloPan && <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[9px] font-black px-2 py-0.5">TÉCNICO OK</Badge>}
                                </div>
                                <Select value={selectedProductoId} onValueChange={setSelectedProductoId}>
                                    <SelectTrigger className="bg-slate-900/50 border-slate-800/50 h-16 rounded-[1.25rem] text-slate-200 focus:ring-indigo-500/50 transition-all shadow-inner text-lg font-bold">
                                        <SelectValue placeholder="Seleccionar producto..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-2xl overflow-hidden backdrop-blur-xl">
                                        {productos.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="rounded-xl m-1 focus:bg-indigo-600 focus:text-white py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{p.nombre}</span>
                                                    <span className="text-[9px] opacity-50 uppercase tracking-tighter">{p.categoria}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Cantidad Objetivo</Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger><Info className="w-4 h-4 text-slate-600" /></TooltipTrigger>
                                            <TooltipContent className="bg-slate-800 border-slate-700 text-xs">Unidades de pan resultantes</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="relative group">
                                    <Input
                                        type="number"
                                        value={cantidad}
                                        onChange={(e) => setCantidad(Number(e.target.value))}
                                        className="bg-slate-900/50 border-slate-800/50 h-16 rounded-[1.25rem] pl-14 focus:ring-indigo-500/50 transition-all text-2xl font-black text-indigo-400 tabular-nums shadow-inner"
                                    />
                                    <Scale className="w-6 h-6 absolute left-5 top-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* Stats Panel (Sólo si hay selección) */}
                        {statsProduccion && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Costo Est.</p>
                                    <p className="text-xl font-black text-white">${statsProduccion.costoEstimado.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 text-center overflow-hidden relative">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Masa Req.</p>
                                    <p className="text-xl font-black text-amber-500">{statsProduccion.arrobas} <span className="text-[10px] opacity-70">Arr</span></p>
                                    <TrendingUp className="absolute -bottom-2 -right-2 w-10 h-10 text-amber-500/5" />
                                </div>
                                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tiempo Est.</p>
                                    <p className="text-xl font-black text-white">{formulacion?.tiempoHorneado || 30} <span className="text-[10px] opacity-70">Min</span></p>
                                </div>
                            </div>
                        )}
    
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                    Explosión de Insumos
                                </h3>
                                {!receta && !formulacion && selectedProductoId && (
                                    <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-none animate-ag-shake text-[9px] font-black">SIN FICHA TÉCNICA</Badge>
                                )}
                            </div>
    
                            <div className="max-h-[250px] overflow-y-auto space-y-2.5 border border-white/5 rounded-[1.75rem] p-4 bg-slate-950/20 custom-scrollbar shadow-inner">
                                {ingredientsPreview.length === 0 && selectedProductoId ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-600">
                                        <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">
                                            No hay ingredientes configurados<br/>
                                            para este producto.
                                        </p>
                                    </div>
                                ) : ingredientsPreview.map(ing => (
                                    <div key={ing.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-white/5 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-300 uppercase tracking-tight">{ing.nombre}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px]", ing.suficiente ? "bg-emerald-500 shadow-emerald-500/40" : "bg-rose-500 shadow-rose-500/40")} />
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Stock: {ing.disponible.toFixed(1)} {ing.unidad}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-lg font-black tabular-nums", ing.suficiente ? "text-emerald-400" : "text-rose-500")}>
                                                {ing.necesita.toFixed(2)} <span className="text-[10px] opacity-70">{ing.unidad}</span>
                                            </div>
                                            <span className={cn("text-[9px] font-black uppercase tracking-widest", ing.suficiente ? "text-emerald-500/40" : "text-rose-500/60")}>
                                                {ing.suficiente ? 'DISPONIBLE' : 'FALTANTE'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
    
                            {hayFaltantes && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] p-5 flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
                                        <AlertTriangle className="h-7 w-7 text-rose-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-rose-400 uppercase tracking-[0.2em]">Insumos Insuficientes</h4>
                                        <p className="text-[10px] text-rose-500/60 font-bold uppercase tracking-tight">
                                            El stock actual no cubre la producción. Se generarán alertas de inventario.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.25rem] text-slate-600 ml-1">Configuración del Lote</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative group">
                                    <Input
                                        placeholder="Código Lote"
                                        value={lote}
                                        onChange={(e) => setLote(e.target.value)}
                                        className="bg-slate-900/50 border-slate-800/50 h-14 rounded-2xl pl-12 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                    />
                                    <Hash className="w-4 h-4 absolute left-5 top-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                                <Input
                                    placeholder="Notas adicionales..."
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                    className="bg-slate-900/50 border-slate-800/50 h-14 rounded-2xl focus:ring-indigo-500/50 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-8 bg-slate-950/80 border-t border-slate-900/50 backdrop-blur-xl gap-4 flex-none">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-[1.25rem] px-8 h-14 uppercase font-black text-[11px] tracking-[0.2em] transition-all flex-1"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!!selectedProductoId && !statsProduccion)}
                        className="bg-gradient-to-r from-indigo-600 to-indigo-400 hover:from-indigo-500 hover:to-indigo-300 text-white rounded-[1.25rem] px-12 h-14 shadow-2xl shadow-indigo-500/40 uppercase font-black text-[12px] tracking-[0.25em] transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale flex-1"
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Procesando...
                            </div>
                        ) : 'Lanzar Producción'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default PlanProduccionModal;
