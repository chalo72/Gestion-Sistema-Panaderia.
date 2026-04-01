import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Layers, Plus, Minus, Info, Check, Search, Trash2, TrendingUp, DollarSign
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

    // -- Estado Consolidado v9 (Incremental Multi-Scoop) --
    const [calcData, setCalcData] = useState({
        selectedInsumosIds: [] as string[],
        cantidadTotalCaja: '10000', 
        pesoB1: 60, pesoB2: 80, pesoB3: 100,
        cantB1: 0, cantB2: 0, cantB3: 0,
        selectedExtras: [] as ExtraItem[],
        nombreProducto: '',
        categoria: 'Helados',
        targetMargin: 40,
        targetPVP: '',
    });

    const insumosLista = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('10l') || n.includes('10 lt'));
    }), [productos]);

    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const c = (p.categoria || '').toLowerCase();
        const esInsumo = p.tipo === 'ingrediente' || p.tipo === 'insumo';
        const esRelacionado = n.includes('vaso') || n.includes('salsa') || n.includes('cono') || n.includes('topo') || n.includes('cuchara') || c.includes('envase') || c.includes('desechable');
        return esInsumo && esRelacionado && !insumosLista.find(i => i.id === p.id);
    }), [productos, insumosLista]);

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
    
    // Costos Unitarios
    const costU1 = calcData.pesoB1 * costoPorGramo;
    const costU2 = calcData.pesoB2 * costoPorGramo;
    const costU3 = calcData.pesoB3 * costoPorGramo;
    
    // Subtotales Incrementales (Lo que el usuario pidió)
    const subB1 = calcData.cantB1 * costU1;
    const subB2 = calcData.cantB2 * costU2;
    const subB3 = calcData.cantB3 * costU3;
    
    const costoBolasTotal = subB1 + subB2 + subB3;
    const costoExtrasTotal = calcData.selectedExtras.reduce((acc, curr) => acc + curr.costo, 0);
    const costoBaseFinal   = costoBolasTotal + costoExtrasTotal;
    
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
                descripcion: `Nexus v9 Multiplier. Promedio Insumo: ${formatCurrency(promedioMaestro)}.`,
                precioVenta: displayPVP,
                margenUtilidad: actualMargin.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('¡Producto Helado Creado!');
            onOpenChange(false);
        } catch (e) {
            toast.error('Error al guardar');
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
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black italic">Nexus Heladería v9</DialogTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Multiplicador de Costos Dinámico</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2].map(s => (
                                <div key={s} className={cn("w-20 h-1.5 rounded-full transition-all duration-300", step >= s ? "bg-indigo-600" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: SELECCIÓN DE CAJAS (PROMEDIO) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">1. Sincronizar Sabores y Promedios</h3>
                                <div className="text-right">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Total Caja (g/ml)</Label>
                                    <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-8 w-24 text-center font-bold bg-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {insumosLista.map(p => {
                                    const isSelected = calcData.selectedInsumosIds.includes(p.id);
                                    const preciosP = precios.filter(pr => pr.productoId === p.id);
                                    const avgP = preciosP.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / (preciosP.length || 1);
                                    return (
                                        <button key={p.id} onClick={() => toggleInsumo(p.id)} className={cn("flex flex-col p-3 rounded-lg border transition-all text-left", isSelected ? "bg-indigo-600 border-indigo-700 text-white shadow-lg" : "bg-white border-slate-100 hover:border-slate-200")}>
                                            <p className="text-[10px] font-black truncate leading-tight uppercase">{p.nombre}</p>
                                            <p className={cn("text-[8px] font-bold mt-1", isSelected ? "text-indigo-200" : "text-slate-400")}>{formatCurrency(avgP)}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-10 bg-indigo-600 rounded-[32px] text-white flex flex-col items-center gap-2 shadow-2xl shadow-indigo-100 relative overflow-hidden">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70">VALOR PROMEDIO MAESTRO DE CAJA</span>
                                <div className="text-6xl font-black tracking-tighter">{formatCurrency(promedioMaestro)}</div>
                                <div className="mt-4 px-6 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">{calcData.selectedInsumosIds.length} Sabores Conectados</div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: LABORATORIO DE PRECIOS E INCREMENTALES */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'B1', label: 'BOLA TIPO 1', weight: 'pesoB1', cant: 'cantB1', color: 'indigo', unit: costU1, sub: subB1 },
                                    { key: 'B2', label: 'BOLA TIPO 2', weight: 'pesoB2', cant: 'cantB2', color: 'emerald', unit: costU2, sub: subB2 },
                                    { key: 'B3', label: 'BOLA TIPO 3', weight: 'pesoB3', cant: 'cantB3', color: 'purple', unit: costU3, sub: subB3 }
                                ].map(b => (
                                    <div key={b.key} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-50 border-${b.color}-100` : "bg-white border-slate-100 shadow-sm")}>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{b.label}</p>
                                        
                                        <div className="flex items-center gap-1 mb-2">
                                            <Input type="number" value={(calcData as any)[b.weight]} onChange={e => setCalcData({...calcData, [b.weight]: parseInt(e.target.value) || 0})} className="h-6 w-10 text-center font-black p-0 border-none bg-slate-100 rounded text-[9px]" />
                                            <span className="text-[8px] font-black text-slate-400">gr</span>
                                        </div>

                                        <div className="flex items-center gap-3 mb-3">
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: Math.max(0, (calcData as any)[b.cant] - 1)})} className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center font-bold">-</button>
                                            <div className="text-3xl font-black">{(calcData as any)[b.cant]}</div>
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: (calcData as any)[b.cant] + 1})} className={cn("h-9 w-9 rounded-lg flex items-center justify-center font-black text-white shadow-md", `bg-${b.color}-600`)}>+</button>
                                        </div>

                                        {/* EL INCREMENTAL (LO QUE PEDISTE) */}
                                        <div className={cn("text-center py-1.5 px-3 rounded-lg w-full transition-all", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-600 text-white shadow-lg` : "bg-slate-50 text-slate-300")}>
                                            <p className="text-[8px] font-black uppercase tracking-widest flex justify-center gap-1">COSTO TOTAL BOLAS</p>
                                            <p className="text-sm font-black">{formatCurrency(b.sub)}</p>
                                            <p className="text-[7px] font-bold opacity-60 uppercase">({(calcData as any)[b.cant]} x {formatCurrency(b.unit)})</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Vasos y Acompañantes</Label>
                                        <Badge variant="outline" className="text-[9px] font-black italic">{calcData.selectedExtras.length} items</Badge>
                                    </div>
                                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-2">
                                        {calcData.selectedExtras.map((ex, i) => (
                                            <div key={i} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-100 animate-ag-scale-in">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center"><ShoppingCart className="w-3 h-3 text-slate-400" /></div>
                                                    <span className="text-[10px] font-bold text-slate-600">{ex.nombre}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-emerald-600">{formatCurrency(ex.costo)}</span>
                                                    <button onClick={() => removeExtra(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <select 
                                        onChange={e => e.target.value && addExtra(e.target.value)}
                                        className="w-full h-10 bg-slate-50 border-none rounded-xl px-4 text-[10px] font-black uppercase outline-none shadow-inner"
                                    >
                                        <option value="">+ Seleccionar Vaso/Salsa/Tapa...</option>
                                        {extrasDisponibles.map(e => (
                                            <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0'))})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-8 bg-emerald-600 rounded-[32px] text-white flex flex-col items-center justify-center gap-6 shadow-2xl shadow-emerald-100">
                                    <div className="text-center space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70">PRECIO DE VENTA CLIENTE</span>
                                        <div className="flex items-center gap-2 justify-center">
                                            <span className="text-3xl font-black opacity-30">$</span>
                                            <Input type="number" value={calcData.targetPVP} onChange={e => setCalcData({...calcData, targetPVP: e.target.value})} placeholder={calculatedPVP.toFixed(0)} className="h-10 w-36 border-none bg-transparent text-center font-black text-5xl p-0 focus-visible:ring-0 text-white" />
                                        </div>
                                    </div>

                                    <div className="w-full space-y-3 bg-white/10 p-5 rounded-2xl border border-white/10">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Utilidad (%)</span>
                                            <span className="text-xl font-black italic">{actualMargin.toFixed(0)}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin - 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Minus className="w-4 h-4" /></Button>
                                            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-white transition-all duration-700" style={{ width: `${actualMargin}%` }}></div>
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin + 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Plus className="w-4 h-4" /></Button>
                                        </div>
                                        <p className="text-[8px] font-black text-center opacity-70 uppercase mt-2 italic tracking-tighter">COSTE PRODUCTO FINAL: {formatCurrency(costoBaseFinal)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nombre Final del Helado</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})} placeholder="Ej: Copa Mixta v9..." className="h-12 text-sm font-bold bg-white border border-slate-100 rounded-xl px-5" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400">
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button 
                        disabled={loading || (step === 1 && calcData.selectedInsumosIds.length === 0)}
                        onClick={() => step < 2 ? setStep(step + 1) : handleFinish()}
                        className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all active:scale-95 shadow-indigo-100"
                    >
                        {loading ? 'Procesando...' : (step === 2 ? '¡GENERAR PRODUCTO COMPLETO!' : <div className="flex items-center gap-2">PASO 2: LABORATORIO DE PRECIOS <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
