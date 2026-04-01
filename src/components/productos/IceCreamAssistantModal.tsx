import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Zap, DollarSign, Store, Utensils, ArrowRight, Layers, Plus, Minus, Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Categoria } from '@/types';

interface Scoop {
    id: number;
    weight: number;
}

interface IceCreamAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[]; 
    categorias: Categoria[];
    onAddProducto: (producto: any) => Promise<any>;
    onAddOrUpdatePrecio: (data: any) => void;
    formatCurrency: (val: number) => string;
}

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios, categorias, 
    onAddProducto, onAddOrUpdatePrecio, formatCurrency
}: IceCreamAssistantModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // -- Estado Consolidado Nexus Style --
    const [calcData, setCalcData] = useState({
        insumoId: '',
        nombreCaja: '',
        costoCaja: '',
        cantidadTotalCaja: '5000', 
        useManualPrice: false,
        cupSize: '3', 
        scoops: [{ id: 1, weight: 60 }] as Scoop[],
        costoInsumos: '150', 
        costoSalsa: '80', 
        nombreProducto: '',
        categoria: 'Helados',
        targetPVP: '',
    });

    // Lógica de Filtrado Profesional
    const insumosLista = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const c = (p.categoria || '').toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('vainilla') || n.includes('choco') || c.includes('helado'));
    }), [productos]);
    
    const preciosInsumo = useMemo(() => precios.filter(pr => pr.productoId === calcData.insumoId), [precios, calcData.insumoId]);
    const promedioInsumo = useMemo(() => preciosInsumo.length > 0 
        ? preciosInsumo.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / preciosInsumo.length 
        : 0, [preciosInsumo]);

    const costoCajaNum  = calcData.useManualPrice ? (parseFloat(calcData.costoCaja) || 0) : (promedioInsumo || parseFloat(calcData.costoCaja) || 0);
    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 5000;
    const costoPorGramo = costoCajaNum / (totalCajaNum || 1);
    
    const costoBolasTotal = calcData.scoops.reduce((acc, s) => acc + (s.weight * costoPorGramo), 0);
    const costoOtros      = (parseFloat(calcData.costoInsumos) || 0) + (parseFloat(calcData.costoSalsa) || 0);
    const costoFinal      = costoBolasTotal + costoOtros;
    
    const targetPVPNum    = parseFloat(calcData.targetPVP) || (costoFinal * 1.6);
    const margenReal      = targetPVPNum > 1 ? ((targetPVPNum - costoFinal) / targetPVPNum) * 100 : 0;

    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    const handleUpdateScoop = (id: number, newWeight: number) => {
        setCalcData(prev => ({
            ...prev,
            scoops: prev.scoops.map(s => s.id === id ? { ...s, weight: Math.max(5, newWeight) } : s)
        }));
    };

    const handleSelectCup = (size: string) => {
        let numScoops = size === '3' ? 1 : size === '5' ? 2 : 3;
        const newScoops = Array.from({ length: numScoops }, (_, i) => ({ id: i + 1, weight: 60 }));
        setCalcData(prev => ({
            ...prev,
            cupSize: size,
            nombreProducto: `Vaso de ${size}oz`,
            scoops: newScoops
        }));
    };

    const handleFinish = async () => {
        if (!calcData.nombreProducto || !calcData.categoria) {
            toast.error('Completa los campos obligatorios');
            return;
        }
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto,
                categoria: calcData.categoria,
                descripcion: `${calcData.scoops.length} Bolas (${calcData.scoops.map(s => s.weight + 'g').join('+')}).`,
                precioVenta: targetPVPNum,
                margenUtilidad: margenReal.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoFinal
            });
            toast.success('Producto creado exitosamente');
            onOpenChange(false);
        } catch (e) {
            toast.error('Ocurrió un error al guardar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
                <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Asistente Pro de Heladería</DialogTitle>
                                <p className="text-xs text-slate-500 font-medium">Configuración de costos y rendimientos</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={cn("w-6 h-1.5 rounded-full", step >= s ? "bg-indigo-500" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[60vh] overflow-y-auto">
                    
                    {/* STEP 1: MATERIA PRIMA */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Caja de Helado (Insumo)</Label>
                                <select 
                                    value={calcData.insumoId}
                                    onChange={e => {
                                        if (e.target.value === 'manual') { setCalcData(prev => ({...prev, insumoId: 'manual', useManualPrice: true})); return; }
                                        const p = productos.find(prod => prod.id === e.target.value);
                                        const pr = precios.find(pr => pr.productoId === e.target.value)?.precioCosto || '';
                                        setCalcData(prev => ({...prev, insumoId: e.target.value, nombreCaja: p?.nombre || '', costoCaja: pr.toString(), useManualPrice: false}));
                                    }}
                                    className="w-full h-11 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">-- Buscar Sabor / Insumo --</option>
                                    {insumosLista.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                    <option value="manual">+ Costo manual</option>
                                </select>
                            </div>

                            {calcData.insumoId && (
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Costo de la Caja</span>
                                        <div className="text-4xl font-black text-slate-800 dark:text-white">{formatCurrency(costoCajaNum)}</div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="text-center">
                                                <Label className="text-[10px] text-slate-400 uppercase font-bold">Peso Total (gr)</Label>
                                                <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData(prev => ({...prev, cantidadTotalCaja: e.target.value}))} className="h-9 w-24 text-center text-sm font-bold mt-1" />
                                            </div>
                                            <div className="h-8 w-px bg-slate-200" />
                                            <div className="text-center">
                                                <Label className="text-[10px] text-slate-400 uppercase font-bold">Costo/g</Label>
                                                <div className="text-sm font-black mt-1">{formatCurrency(costoPorGramo)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {preciosInsumo.length > 1 && (
                                        <p className="text-[10px] text-center text-emerald-600 font-bold mt-4 uppercase">⭐ Precio detectado como promedio de lista</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: PERSONALIZACIÓN DE BOLAS */}
                    {step === 2 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center bg-slate-50 p-1 rounded-xl">
                                {['3', '5', '7', '9'].map(sz => (
                                    <button 
                                        key={sz} 
                                        onClick={() => handleSelectCup(sz)}
                                        className={cn(
                                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                            calcData.cupSize === sz ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
                                        )}
                                    >
                                        Vaso {sz}oz
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {calcData.scoops.map((scoop, idx) => (
                                    <div key={scoop.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center font-bold text-xs uppercase">B{idx+1}</div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white">Bola {idx+1} ({scoop.weight}g)</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Costo: {formatCurrency(scoop.weight * costoPorGramo)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handleUpdateScoop(scoop.id, scoop.weight - 5)} className="w-8 h-8 rounded-lg"><Minus className="w-3 h-3" /></Button>
                                            <Button variant="outline" size="icon" onClick={() => handleUpdateScoop(scoop.id, scoop.weight + 5)} className="w-8 h-8 rounded-lg border-indigo-200 text-indigo-600"><Plus className="w-3 h-3" /></Button>
                                        </div>
                                    </div>
                                ))}
                                {calcData.scoops.length < 4 && (
                                    <Button variant="ghost" size="sm" onClick={() => setCalcData(prev=> ({...prev, scoops: [...prev.scoops, { id: Date.now(), weight: 60 }]}))} className="w-full h-10 border border-dashed border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                                        + Agregar Bola Extra
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Vaso/Envase ($)</Label>
                                    <Input type="number" value={calcData.costoInsumos} onChange={e => setCalcData(prev => ({...prev, costoInsumos: e.target.value}))} className="h-10 text-sm font-bold" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Salsas/Extras ($)</Label>
                                    <Input type="number" value={calcData.costoSalsa} onChange={e => setCalcData(prev => ({...prev, costoSalsa: e.target.value}))} className="h-10 text-sm font-bold" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Nombre para el Menú</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData(prev => ({...prev, nombreProducto: e.target.value}))} className="h-11 text-sm font-bold" placeholder="Vaso de 5oz con 2 bolas..." />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PRECIO Y MARGEN */}
                    {step === 3 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl space-y-6">
                                <div className="text-center space-y-1">
                                    <Label className="text-xs font-black text-emerald-600 uppercase tracking-widest">Precio de Venta Final</Label>
                                    <Input 
                                        type="number" 
                                        value={calcData.targetPVP} 
                                        onChange={e => setCalcData(prev => ({...prev, targetPVP: e.target.value}))}
                                        placeholder={(costoFinal * 1.6).toFixed(0)}
                                        className="h-16 text-4xl text-center font-black text-emerald-700 bg-transparent border-none focus-visible:ring-0"
                                    />
                                    <div className="w-full h-px bg-emerald-200 dark:bg-emerald-800" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Costo Total</p>
                                        <p className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(costoFinal)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Margen Ganancia</p>
                                        <p className={cn("text-lg font-black", margenReal > 40 ? "text-indigo-600" : "text-orange-500")}>{margenReal.toFixed(0)}%</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Info className="w-4 h-4" />
                                <p className="text-[10px] font-bold uppercase tracking-tight">Utilidad proyectada: {formatCurrency(targetPVPNum - costoFinal)} por unidad</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
                    <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="px-6 h-11 text-xs font-bold uppercase tracking-widest">
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </Button>
                    <Button 
                        disabled={loading}
                        onClick={() => step < 3 ? setStep(step + 1) : handleFinish()}
                        className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest"
                    >
                        {loading ? 'Guardando...' : (step === 3 ? 'Finalizar y Crear' : 'Siguiente Paso')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
