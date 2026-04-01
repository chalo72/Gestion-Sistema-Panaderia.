import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Zap, DollarSign, Store, Utensils, ArrowRight, Info, CheckCircle2,
    Layers, Plus, Minus
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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

    // -- Estado Maestro v5 --
    const [calcData, setCalcData] = useState({
        // Insumo
        insumoId: '',
        nombreCaja: '',
        costoCaja: '',
        cantidadTotalCaja: '5000', 
        useManualPrice: false,
        
        // Presentación
        cupSize: '3', 
        scoops: [{ id: 1, weight: 60 }] as Scoop[],
        costoInsumos: '150', 
        costoSalsa: '80', 
        nombreProducto: '',
        categoria: 'Helados',
        
        // Precio
        targetPVP: '',
    });

    // Insumos inteligentes
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
    
    // Cálculo de costo por GRAMO base
    const costoPorGramo = costoCajaNum / (totalCajaNum || 1);
    
    // Costo total de todas las bolas configuradas independientemente
    const costoBolasTotal = calcData.scoops.reduce((acc, s) => acc + (s.weight * costoPorGramo), 0);
    const costoFinal      = costoBolasTotal + (parseFloat(calcData.costoInsumos) || 0) + (parseFloat(calcData.costoSalsa) || 0);
    
    const targetPVPNum    = parseFloat(calcData.targetPVP) || (costoFinal * 1.6);
    const margenReal      = targetPVPNum > 1 ? ((targetPVPNum - costoFinal) / targetPVPNum) * 100 : 0;

    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    const handleUpdateScoop = (id: number, newWeight: number) => {
        setCalcData({
            ...calcData,
            scoops: calcData.scoops.map(s => s.id === id ? { ...s, weight: Math.max(5, newWeight) } : s)
        });
    };

    const handleSelectCup = (size: string) => {
        let numScoops = 1;
        if (size === '5') numScoops = 2;
        if (size === '7' || size === '9') numScoops = 3;
        
        const newScoops = Array.from({ length: numScoops }, (_, i) => ({ id: i + 1, weight: 60 }));
        setCalcData({
            ...calcData,
            cupSize: size,
            nombreProducto: `Helado Vaso ${size}oz`,
            scoops: newScoops
        });
    };

    const handleFinish = async () => {
        if (!calcData.nombreProducto || !calcData.categoria) {
            toast.error('Nombre y Categoría son obligatorios');
            return;
        }
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto,
                categoria: calcData.categoria,
                descripcion: `Personalizado: ${calcData.scoops.length} bolas (${calcData.scoops.map(s => s.weight + 'g').join('+')}) de ${calcData.nombreCaja || 'Helado'}.`,
                precioVenta: targetPVPNum,
                margenUtilidad: margenReal.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoFinal
            });
            toast.success('¡Helado Maestro v5 creado!');
            onOpenChange(false);
        } catch (e) {
            toast.error('Error al crear el producto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-930 border-none rounded-[40px] shadow-2xl">
                <DialogTitle className="sr-only">Heladería Maestro v5</DialogTitle>
                
                {/* Header Premium Estilo Tablero */}
                <div className="bg-indigo-600 p-8 text-white relative">
                    <button onClick={() => onOpenChange(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-inner shadow-white/20">
                            <Layers className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black italic tracking-tighter leading-none mb-1">MAESTRO v5</h2>
                            <p className="text-indigo-200 text-xs font-black uppercase tracking-widest">Calculadora de Bolas Mixtas</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={cn(
                                "h-2 flex-1 rounded-full transition-all duration-500",
                                step >= s ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]" : "bg-indigo-800"
                            )} />
                        ))}
                    </div>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: EL INSUMO */}
                    {step === 1 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">¿Qué helado usaremos?</h3>
                                <p className="text-slate-400 font-bold text-sm">Elige el sabor base registrado en tus proveedores.</p>
                            </div>

                            <select 
                                value={calcData.insumoId}
                                onChange={e => {
                                    if (e.target.value === 'manual') { setCalcData({...calcData, insumoId: 'manual', useManualPrice: true}); return; }
                                    const p = productos.find(prod => prod.id === e.target.value);
                                    const pr = precios.find(pr => pr.productoId === e.target.value)?.precioCosto || '';
                                    setCalcData({...calcData, insumoId: e.target.value, nombreCaja: p?.nombre || '', costoCaja: pr.toString(), useManualPrice: false});
                                }}
                                className="h-20 w-full bg-white rounded-3xl border-4 border-slate-100 px-8 text-xl font-black shadow-lg focus:border-indigo-400 outline-none transition-all flex items-center justify-between"
                            >
                                <option value="">-- Buscar Sabor / Caja --</option>
                                {insumosLista.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                                <option value="manual">+ Costo manual personalizado</option>
                            </select>

                            {calcData.insumoId && (
                                <div className="p-10 bg-indigo-50 rounded-[40px] border-4 border-indigo-100 flex flex-col items-center text-center gap-4 animate-ag-scale-in">
                                    <span className="px-6 py-2 bg-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-widest">Costo por Caja</span>
                                    <span className="text-6xl font-black text-indigo-600 tracking-tighter">{formatCurrency(costoCajaNum)}</span>
                                    <p className="text-sm font-black text-indigo-400 opacity-80 uppercase tracking-widest">
                                        {preciosInsumo.length > 1 ? `⭐ Promediado de ${preciosInsumo.length} precios` : '⭐ Precio actual de lista'}
                                    </p>
                                    <div className="flex gap-4 mt-2">
                                        <div className="text-center">
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Total Caja (g/ml)</Label>
                                            <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-10 w-28 bg-white border-2 border-slate-100 rounded-xl text-center font-black" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 2: BOLAS MIXTAS (ESTRELLA) */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Armar Combinación</h3>
                                    <p className="text-slate-400 font-bold text-sm">Ajusta el gramaje de cada bola por separado.</p>
                                </div>
                                <div className="p-4 bg-indigo-600 rounded-2xl text-white text-right">
                                    <p className="text-[9px] font-black uppercase opacity-60">Costo Bolas</p>
                                    <p className="text-2xl font-black">{formatCurrency(costoBolasTotal)}</p>
                                </div>
                            </div>

                            <div className="flex gap-2 p-2 bg-slate-100 rounded-3xl mb-4">
                                {['3', '5', '7', '9'].map(sz => (
                                    <button 
                                        key={sz}
                                        onClick={() => handleSelectCup(sz)}
                                        className={cn(
                                            "flex-1 py-4 rounded-2xl text-[10px] font-bold transition-all uppercase tracking-widest",
                                            calcData.cupSize === sz ? "bg-white text-indigo-600 shadow-xl scale-105" : "text-slate-400 hover:bg-white/40"
                                        )}
                                    >
                                        Vaso {sz}oz
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-6">
                                {calcData.scoops.map((scoop, idx) => (
                                    <div key={scoop.id} className="p-6 bg-white rounded-3xl border-2 border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all shadow-sm">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-slate-400">
                                                <Utensils className="w-6 h-6 mb-1" />
                                                <span className="text-[9px] font-black">BOLA {idx + 1}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-4xl font-black text-slate-800 tracking-tighter">{scoop.weight} <span className="text-sm text-slate-300">gr</span></div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Costo: +{formatCurrency(scoop.weight * costoPorGramo)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleUpdateScoop(scoop.id, scoop.weight - 5)} className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-2xl hover:bg-slate-200 transition-all">-</button>
                                            <button onClick={() => handleUpdateScoop(scoop.id, scoop.weight + 5)} className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg">+</button>
                                        </div>
                                    </div>
                                ))}
                                
                                {calcData.scoops.length < 4 && (
                                    <button 
                                        onClick={() => setCalcData({...calcData, scoops: [...calcData.scoops, { id: Date.now(), weight: 60 }]})}
                                        className="py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Agregar otra bola
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-white rounded-3xl border border-slate-100">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Vaso + Extras ($)</Label>
                                    <Input 
                                        type="number" 
                                        value={calcData.costoInsumos} 
                                        onChange={e => setCalcData({...calcData, costoInsumos: e.target.value})}
                                        className="h-10 text-xl font-black border-none bg-slate-50 rounded-xl px-4"
                                    />
                                </div>
                                <div className="p-5 bg-white rounded-3xl border border-slate-100">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Salsa ($)</Label>
                                    <Input 
                                        type="number" 
                                        value={calcData.costoSalsa} 
                                        onChange={e => setCalcData({...calcData, costoSalsa: e.target.value})}
                                        className="h-10 text-xl font-black border-none bg-slate-50 rounded-xl px-4"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-widest">Nombre del Helado</Label>
                                <Input 
                                    value={calcData.nombreProducto} 
                                    onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})}
                                    placeholder="Ej: Copa Especial 3-Bolas..." 
                                    className="h-14 text-lg font-black bg-white rounded-2xl px-6 border-2 border-slate-100"
                                />
                            </div>
                        </div>
                    )}

                    {/* PASO 3: PRECIO FINAL */}
                    {step === 3 && (
                        <div className="space-y-8 animate-ag-fade-in text-center">
                            <div className="space-y-2">
                                <h3 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Venta y Ganancia</h3>
                                <p className="text-slate-400 font-bold">Ajusta el precio para este helado personalizado.</p>
                            </div>

                            <div className="p-12 bg-white rounded-[60px] shadow-2xl border-2 border-slate-100 space-y-10 relative">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.5em]">PVP CLIENTE FINAL</Label>
                                    <div className="relative">
                                        <span className="absolute left-10 top-1/2 -translate-y-1/2 text-4xl font-black text-slate-300">$</span>
                                        <Input 
                                            type="number" 
                                            value={calcData.targetPVP} 
                                            onChange={e => setCalcData({...calcData, targetPVP: e.target.value})}
                                            placeholder={(costoFinal * 1.6).toFixed(0)}
                                            className="h-32 text-8xl font-black text-emerald-600 rounded-[40px] bg-slate-50 border-none text-center focus:ring-emerald-500 pl-16"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-10">
                                    <div className="p-8 bg-indigo-50 rounded-3xl">
                                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-2">Utilidad (%)</p>
                                        <p className={cn("text-5xl font-black", margenReal > 45 ? "text-indigo-600" : "text-orange-500")}>
                                            {margenReal.toFixed(0)}%
                                        </p>
                                    </div>
                                    <div className="p-8 bg-emerald-50 rounded-3xl">
                                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-2">Ganancia ($)</p>
                                        <p className="text-5xl font-black text-emerald-600">
                                            {formatCurrency(targetPVPNum - costoFinal)}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex justify-center gap-10 opacity-50">
                                    <div className="text-[10px] font-black tracking-widest uppercase">Costo Base: {formatCurrency(costoFinal)}</div>
                                    <div className="text-[10px] font-black tracking-widest uppercase">Categoría: {calcData.categoria}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navegación Pro */}
                <div className="p-10 bg-white border-t-4 border-slate-50 flex justify-between gap-6">
                    <Button 
                        variant="ghost" 
                        onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-20 flex-1 rounded-3xl text-slate-400 font-black uppercase text-xs hover:bg-slate-100"
                    >
                        {step === 1 ? 'Cancelar' : <ChevronLeft className="w-6 h-6" />}
                    </Button>
                    <Button 
                        disabled={loading}
                        onClick={() => step < 3 ? setStep(step + 1) : handleFinish()}
                        className="h-20 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl shadow-indigo-200 transition-all active:scale-95"
                    >
                        {loading ? 'Sincronizando...' : (step === 3 ? '¡GUARDAR PRODUCTO!' : <div className="flex items-center gap-3">SIGUIENTE PASO <ChevronRight className="w-6 h-6" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
