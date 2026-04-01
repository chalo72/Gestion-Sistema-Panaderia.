import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Layers, Plus, Minus, Info, Check, CheckSquare, Square
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Categoria } from '@/types';

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

    // -- Estado Simplificado Nexus v7 --
    const [calcData, setCalcData] = useState({
        selectedInsumosIds: [] as string[],
        manualAverage: '',
        useManualAverage: false,
        cantidadTotalCaja: '10000', // 10 Litros es estándar según foto
        
        // Pesos de los 3 tipos de bolas (Personalizables)
        pesoB1: 60,
        pesoB2: 80,
        pesoB3: 100,
        
        // Cantidades en el vaso actual
        cantB1: 0,
        cantB2: 0,
        cantB3: 0,
        
        costoEnvase: '250', 
        costoExtras: '150', 
        nombreProducto: '',
        categoria: 'Helados',
        targetPVP: '',
    });

    // Insumos elegibles
    const insumosLista = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('10l') || n.includes('10 lt'));
    }), [productos]);

    // Cálculo del promedio de los insumos seleccionados
    const promedioMaestro = useMemo(() => {
        if (calcData.useManualAverage) return parseFloat(calcData.manualAverage) || 0;
        if (calcData.selectedInsumosIds.length === 0) return 0;
        
        let total = 0;
        let count = 0;
        
        calcData.selectedInsumosIds.forEach(id => {
            const listado = precios.filter(pr => pr.productoId === id);
            listado.forEach(pr => {
                total += (parseFloat(pr.precioCosto) || 0);
                count++;
            });
        });
        
        return count > 0 ? total / count : 0;
    }, [calcData.selectedInsumosIds, calcData.manualAverage, calcData.useManualAverage, precios]);

    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 10000;
    const costoPorGramo = promedioMaestro / totalCajaNum;
    
    // Costo basado en los 3 tipos de bolas
    const costoB1 = calcData.cantB1 * calcData.pesoB1 * costoPorGramo;
    const costoB2 = calcData.cantB2 * calcData.pesoB2 * costoPorGramo;
    const costoB3 = calcData.cantB3 * calcData.pesoB3 * costoPorGramo;
    
    const costoTotalBolas = costoB1 + costoB2 + costoB3;
    const costoOtros      = (parseFloat(calcData.costoEnvase) || 0) + (parseFloat(calcData.costoExtras) || 0);
    const costoBaseFinal  = costoTotalBolas + costoOtros;
    
    const targetPVPNum    = parseFloat(calcData.targetPVP) || (costoBaseFinal * 1.6);
    const margenReal      = targetPVPNum > 1 ? ((targetPVPNum - costoBaseFinal) / targetPVPNum) * 100 : 0;

    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    const toggleInsumo = (id: string) => {
        setCalcData(prev => ({
            ...prev,
            selectedInsumosIds: prev.selectedInsumosIds.includes(id) 
                ? prev.selectedInsumosIds.filter(i => i !== id) 
                : [...prev.selectedInsumosIds, id]
        }));
    };

    const handleFinish = async () => {
        if (!calcData.nombreProducto) { toast.error('Escribe un nombre para el producto'); return; }
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto,
                categoria: calcData.categoria,
                descripcion: `Promedio base: ${formatCurrency(promedioMaestro)}. Composición: ${calcData.cantB1} B1(${calcData.pesoB1}g), ${calcData.cantB2} B2(${calcData.pesoB2}g), ${calcData.cantB3} B3(${calcData.pesoB3}g).`,
                precioVenta: targetPVPNum,
                margenUtilidad: margenReal.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('¡Helado registrado en el menú!');
            onOpenChange(false);
        } catch (e) {
            toast.error('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl">
                <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg transform -rotate-2">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight">Nexus Heladería v7</DialogTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sincronizador de Precios Masivo</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2].map(s => (
                                <div key={s} className={cn("w-12 h-1.5 rounded-full transition-all duration-300", step >= s ? "bg-indigo-600 shadow-sm" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: PROMEDIO DE CAJAS (LO QUE PEDISTE) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">1. Selección de Cajas</h3>
                                    <p className="text-xs text-slate-500 font-medium">Marca los sabores para sacar el promedio base.</p>
                                </div>
                                <div className="text-right">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Total g/ml Caja</Label>
                                    <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-9 w-24 text-center font-bold" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {insumosLista.map(p => {
                                    const isSelected = calcData.selectedInsumosIds.includes(p.id);
                                    const preciosP = precios.filter(pr => pr.productoId === p.id);
                                    const avgP = preciosP.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / (preciosP.length || 1);
                                    
                                    return (
                                        <button 
                                            key={p.id}
                                            onClick={() => toggleInsumo(p.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                                isSelected ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors", isSelected ? "bg-indigo-600 text-white" : "bg-slate-100")}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none mb-1">{p.nombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{formatCurrency(avgP)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* RESULTADO DEL PROMEDIO (VALOR BASE) */}
                            <div className="p-8 bg-indigo-600 rounded-3xl text-white flex flex-col items-center gap-2 shadow-2xl shadow-indigo-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Package className="w-24 h-24 rotate-12" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">Promedio Base Detectado</span>
                                <div className="text-5xl font-black tracking-tighter">{formatCurrency(promedioMaestro)}</div>
                                <div className="flex gap-4 mt-2">
                                    <Badge className="bg-indigo-500 text-white border-none text-[10px] uppercase font-black px-4">{calcData.selectedInsumosIds.length} Sabores elegidos</Badge>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: LOS 3 TIPOS DE BOLAS Y PRECIO */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'B1', label: 'Bola Tipo 1', weight: 'pesoB1', cant: 'cantB1', color: 'indigo' },
                                    { key: 'B2', label: 'Bola Tipo 2', weight: 'pesoB2', cant: 'cantB2', color: 'emerald' },
                                    { key: 'B3', label: 'Bola Tipo 3', weight: 'pesoB3', cant: 'cantB3', color: 'purple' }
                                ].map(b => (
                                    <div key={b.key} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-50 border-${b.color}-100` : "bg-white border-slate-50")}>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{b.label}</p>
                                            <div className="flex items-center gap-1">
                                                <Input 
                                                    type="number" 
                                                    value={(calcData as any)[b.weight]} 
                                                    onChange={e => setCalcData({...calcData, [b.weight]: parseInt(e.target.value) || 0})}
                                                    className="h-8 w-14 text-center font-black p-0 border-none bg-slate-100 rounded-lg text-xs"
                                                />
                                                <span className="text-[9px] font-black text-slate-400">gr</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: Math.max(0, (calcData as any)[b.cant] - 1)})} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black hover:bg-slate-200">-</button>
                                            <div className={cn("text-3xl font-black", (calcData as any)[b.cant] > 0 ? `text-${b.color}-600` : "text-slate-300")}>{(calcData as any)[b.cant]}</div>
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: (calcData as any)[b.cant] + 1})} className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-md transition-all active:scale-95", `bg-${b.color}-600`)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center px-8 border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Costo Base Insumo</p>
                                        <p className="text-2xl font-black text-slate-800">{formatCurrency(costoBaseFinal)}</p>
                                    </div>
                                    <div className="h-8 w-px bg-slate-200" />
                                    <div className="text-right space-y-1">
                                        <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Envase:</span><Input type="number" value={calcData.costoEnvase} onChange={e => setCalcData({...calcData, costoEnvase: e.target.value})} className="h-6 w-16 text-right font-bold text-[10px]" /></div>
                                        <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Salsas:</span><Input type="number" value={calcData.costoExtras} onChange={e => setCalcData({...calcData, costoExtras: e.target.value})} className="h-6 w-16 text-right font-bold text-[10px]" /></div>
                                    </div>
                                </div>

                                <div className="p-6 bg-emerald-600 rounded-2xl text-white shadow-xl shadow-emerald-100 flex flex-col items-center justify-center relative overflow-hidden group">
                                    <Label className="text-[10px] font-black uppercase text-white/70 tracking-widest mb-1">Precio de Venta Final</Label>
                                    <div className="relative">
                                        <span className="absolute -left-6 top-1/2 -translate-y-1/2 text-white/30 font-black text-xl">$</span>
                                        <Input 
                                            type="number" 
                                            value={calcData.targetPVP} 
                                            onChange={e => setCalcData({...calcData, targetPVP: e.target.value})}
                                            placeholder={(costoBaseFinal * 1.6).toFixed(0)}
                                            className="h-10 w-32 border-none bg-transparent text-center font-black text-3xl p-0 focus-visible:ring-0 text-white placeholder:text-white/30"
                                        />
                                    </div>
                                    <div className="mt-2 py-1 px-3 bg-white/20 rounded-full text-[10px] font-black">GANANCIA: {margenReal.toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nombre Final (Para Boss Venta)</Label>
                                <Input 
                                    value={calcData.nombreProducto} 
                                    onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})}
                                    placeholder="Ej: Copa Mixta 3 Bolas..." 
                                    className="h-12 text-sm font-bold bg-white border-2 border-slate-100 rounded-xl px-5"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button 
                        variant="ghost" 
                        onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-50"
                    >
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button 
                        disabled={loading || (step === 1 && calcData.selectedInsumosIds.length === 0)}
                        onClick={() => step < 2 ? setStep(step + 1) : handleFinish()}
                        className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all active:scale-95"
                    >
                        {loading ? 'Sincronizando...' : (step === 2 ? '¡FINALIZAR Y CREAR!' : <div className="flex items-center gap-2">PASO 2: CONFIGURAR BOLAS <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
