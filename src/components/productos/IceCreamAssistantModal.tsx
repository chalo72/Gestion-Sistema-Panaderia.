import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Layers, Plus, Minus, Info, Check, Search, Trash2, TrendingUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Categoria } from '@/types';

interface ExtraItem {
    id: string;
    nombre: string;
    costo: number;
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

    // -- Estado Maestro v8 --
    const [calcData, setCalcData] = useState({
        selectedInsumosIds: [] as string[],
        cantidadTotalCaja: '10000', 
        
        // Pesos de los 3 tipos de bolas
        pesoB1: 60,
        pesoB2: 80,
        pesoB3: 100,
        
        // Cantidades en el vaso
        cantB1: 0,
        cantB2: 0,
        cantB3: 0,
        
        selectedExtras: [] as ExtraItem[],
        nombreProducto: '',
        categoria: 'Helados',
        targetMargin: 40, // Porcentaje de ganancia objetivo
        targetPVP: '',
    });

    // Insumos elegibles (Solo Helados de 10L o Cajas)
    const insumosLista = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('10l') || n.includes('10 lt'));
    }), [productos]);

    // Insumos adicionales (Vasos, Salsas, etc.)
    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const c = (p.categoria || '').toLowerCase();
        const esInsumo = p.tipo === 'ingrediente' || p.tipo === 'insumo';
        const esRelacionado = n.includes('vaso') || n.includes('salsa') || n.includes('cono') || n.includes('topo') || n.includes('cuchara') || c.includes('envase') || c.includes('desechable');
        return esInsumo && esRelacionado && !insumosLista.find(i => i.id === p.id);
    }), [productos, insumosLista]);

    // Promedio Maestro
    const promedioMaestro = useMemo(() => {
        if (calcData.selectedInsumosIds.length === 0) return 0;
        let total = 0; let count = 0;
        calcData.selectedInsumosIds.forEach(id => {
            const listado = precios.filter(pr => pr.productoId === id);
            listado.forEach(pr => { total += (parseFloat(pr.precioCosto) || 0); count++; });
        });
        return count > 0 ? total / count : 0;
    }, [calcData.selectedInsumosIds, precios]);

    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 10000;
    const costoPorGramo = promedioMaestro / totalCajaNum;
    
    // Costos de las bolas visibles
    const costoB1_Unit = calcData.pesoB1 * costoPorGramo;
    const costoB2_Unit = calcData.pesoB2 * costoPorGramo;
    const costoB3_Unit = calcData.pesoB3 * costoPorGramo;
    
    const costoBolasTotal = (calcData.cantB1 * costoB1_Unit) + (calcData.cantB2 * costoB2_Unit) + (calcData.cantB3 * costoB3_Unit);
    const costoExtrasTotal = calcData.selectedExtras.reduce((acc, curr) => acc + curr.costo, 0);
    const costoBaseFinal   = costoBolasTotal + costoExtrasTotal;
    
    // Cálculo de PVP basado en MARGEN o MANUAL
    const profitMultiplier = 1 / (1 - (calcData.targetMargin / 100));
    const calculatedPVP    = costoBaseFinal * profitMultiplier;
    const displayPVP       = calcData.targetPVP ? parseFloat(calcData.targetPVP) : calculatedPVP;
    const actualMargin     = displayPVP > 0 ? ((displayPVP - costoBaseFinal) / displayPVP) * 100 : 0;

    useEffect(() => { if (isOpen) setStep(1); }, [isOpen]);

    const toggleInsumo = (id: string) => {
        setCalcData(prev => ({
            ...prev,
            selectedInsumosIds: prev.selectedInsumosIds.includes(id) 
                ? prev.selectedInsumosIds.filter(i => i !== id) 
                : [...prev.selectedInsumosIds, id]
        }));
    };

    const addExtra = (id: string) => {
        const prod = productos.find(p => p.id === id);
        const pCosto = precios.find(pr => pr.productoId === id)?.precioCosto || 0;
        if (prod) {
            setCalcData(prev => ({
                ...prev,
                selectedExtras: [...prev.selectedExtras, { id: prod.id, nombre: prod.nombre, costo: parseFloat(pCosto.toString()) }]
            }));
        }
    };

    const removeExtra = (idx: number) => {
        setCalcData(prev => ({
            ...prev,
            selectedExtras: prev.selectedExtras.filter((_, i) => i !== idx)
        }));
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto || 'Copa Personalizada',
                categoria: calcData.categoria,
                descripcion: `Personalizado v8. Promedio Caja: ${formatCurrency(promedioMaestro)}. Extras: ${calcData.selectedExtras.length}.`,
                precioVenta: displayPVP,
                margenUtilidad: actualMargin.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('Producto Helado creado con éxito!');
            onOpenChange(false);
        } catch (e) {
            toast.error('Error al guardar el producto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl">
                <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black">Nexus Heladería v8</DialogTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Sincronización Total - Laboratorio de Márgenes</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2].map(s => (
                                <div key={s} className={cn("w-16 h-1.5 rounded-full transition-all duration-300", step >= s ? "bg-indigo-600" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: MATERIA PRIMA (CAJAS) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">1. Promedio de Cajas (Insumo Base)</h3>
                                <div className="flex items-center gap-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Capacidad Caja (g/ml)</Label>
                                    <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-9 w-28 text-center font-black bg-slate-50 border-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {insumosLista.map(p => {
                                    const isSelected = calcData.selectedInsumosIds.includes(p.id);
                                    const preciosP = precios.filter(pr => pr.productoId === p.id);
                                    const avgP = preciosP.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / (preciosP.length || 1);
                                    return (
                                        <button key={p.id} onClick={() => toggleInsumo(p.id)} className={cn("flex flex-col gap-1 p-4 rounded-xl border text-left transition-all", isSelected ? "bg-indigo-50 border-indigo-500 shadow-md ring-2 ring-indigo-500/10" : "bg-white border-slate-100 hover:border-slate-200")}>
                                            <div className="flex justify-between items-start">
                                                <p className="text-[11px] font-black leading-tight text-slate-800 truncate w-32">{p.nombre}</p>
                                                {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400">{formatCurrency(avgP)}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-10 bg-indigo-600 rounded-[32px] text-white flex flex-col items-center gap-2 shadow-2xl shadow-indigo-100">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70">VALOR PROMEDIO MAESTRO</span>
                                <div className="text-6xl font-black tracking-tighter">{formatCurrency(promedioMaestro)}</div>
                                <div className="mt-4 px-6 py-2 bg-white/20 rounded-full text-xs font-black uppercase">{calcData.selectedInsumosIds.length} Sabores Vinculados</div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: BOLAS, EXTRAS Y GANANCIA */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            {/* Desglose de Bolas */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'B1', label: 'BOLA TIPO 1', weight: 'pesoB1', cant: 'cantB1', color: 'indigo', unit: costoB1_Unit },
                                    { key: 'B2', label: 'BOLA TIPO 2', weight: 'pesoB2', cant: 'cantB2', color: 'emerald', unit: costoB2_Unit },
                                    { key: 'B3', label: 'BOLA TIPO 3', weight: 'pesoB3', cant: 'cantB3', color: 'purple', unit: costoB3_Unit }
                                ].map(b => (
                                    <div key={b.key} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-50 border-${b.color}-100` : "bg-white border-slate-100")}>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{b.label}</p>
                                        <div className="text-center">
                                            <div className="flex items-center gap-1 justify-center">
                                                <Input type="number" value={(calcData as any)[b.weight]} onChange={e => setCalcData({...calcData, [b.weight]: parseInt(e.target.value) || 0})} className="h-7 w-12 text-center font-black p-0 border-none bg-slate-100 rounded-lg text-[10px]" />
                                                <span className="text-[9px] font-black text-slate-400">gr</span>
                                            </div>
                                            <p className={cn("text-[9px] font-black mt-1 uppercase", (calcData as any)[b.cant] > 0 ? `text-${b.color}-500` : "text-slate-300")}>COSTE: {formatCurrency(b.unit)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: Math.max(0, (calcData as any)[b.cant] - 1)})} className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold">-</button>
                                            <div className="text-3xl font-black">{(calcData as any)[b.cant]}</div>
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: (calcData as any)[b.cant] + 1})} className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg", `bg-${b.color}-600`)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Gestión de Extras (Inventario Real) */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Acondicionamiento / Extras</Label>
                                        <Badge className="bg-slate-100 text-slate-400 border-none text-[9px]">{calcData.selectedExtras.length} items</Badge>
                                    </div>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto px-1 pr-3">
                                        {calcData.selectedExtras.map((ex, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 animate-ag-scale-in">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-800 leading-none">{ex.nombre}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1">{formatCurrency(ex.costo)}</p>
                                                </div>
                                                <button onClick={() => removeExtra(i)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        {calcData.selectedExtras.length === 0 && <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-bold text-slate-300 uppercase tracking-tighter italic">No hay extras vinculados</div>}
                                    </div>
                                    <select 
                                        onChange={e => e.target.value && addExtra(e.target.value)}
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">+ Añadir Vaso/Salsa/Extras...</option>
                                        {extrasDisponibles.map(e => (
                                            <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0'))})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dash de Margen y PVP */}
                                <div className="p-8 bg-emerald-600 rounded-[32px] text-white flex flex-col items-center justify-center gap-6 shadow-2xl shadow-emerald-100 relative">
                                    <div className="text-center space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70">PRECIO DE VENTA FINAL</span>
                                        <div className="flex items-center gap-3 justify-center">
                                            <span className="text-2xl font-black opacity-30">$</span>
                                            <Input 
                                                type="number" 
                                                value={calcData.targetPVP} 
                                                onChange={e => setCalcData({...calcData, targetPVP: e.target.value})}
                                                placeholder={calculatedPVP.toFixed(0)}
                                                className="h-10 w-32 border-none bg-transparent text-center font-black text-4xl p-0 focus-visible:ring-0 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-white/20" />

                                    <div className="space-y-2 w-full">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-black uppercase opacity-70">Margen de Utilidad (%)</span>
                                            <span className="text-lg font-black">{actualMargin.toFixed(0)}%</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin - 5, targetPVP: ''})} className="h-8 w-8 bg-white/10 border-none text-white hover:bg-white/20"><Minus className="w-4 h-4" /></Button>
                                            <div className="h-2 flex-1 bg-white/20 rounded-full relative">
                                                <div className="h-full bg-white rounded-full" style={{ width: `${actualMargin}%` }}></div>
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin + 5, targetPVP: ''})} className="h-8 w-8 bg-white/10 border-none text-white hover:bg-white/20"><Plus className="w-4 h-4" /></Button>
                                        </div>
                                        <p className="text-[9px] font-black text-center opacity-60 uppercase mt-2">Costo Base Total: {formatCurrency(costoBaseFinal)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-widest">Nombre del Helado Pro</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})} placeholder="Ej: Super Copa Mixta..." className="h-14 text-lg font-black bg-slate-50 border-none rounded-2xl px-6" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-50">
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button 
                        disabled={loading || (step === 1 && calcData.selectedInsumosIds.length === 0)}
                        onClick={() => step < 2 ? setStep(step + 1) : handleFinish()}
                        className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all active:scale-95"
                    >
                        {loading ? 'Guardando...' : (step === 2 ? '¡FINALIZAR Y CREAR PRODUCTO!' : <div className="flex items-center gap-2">CONFIGURAR BOLAS Y EXTRAS <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
