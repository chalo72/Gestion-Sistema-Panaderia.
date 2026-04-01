import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronRight, ChevronLeft, Package, 
    Plus, Minus, Trash2, MousePointer2
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
    type: 'fixed' | 'gift' | 'optional'; // Tri-state: Base, Regalo, Opcional
}

interface IceCreamAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[]; 
    onAddProducto: (producto: any) => Promise<any>;
    formatCurrency: (val: number) => string;
}

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios, 
    onAddProducto, formatCurrency
}: IceCreamAssistantModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // -- Estado Consolidado v11 (Optional & Plus System) --
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
        simulateOptional: false, // Simulador para ver el precio final con opcionales
    });

    const insumosLista = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('10l'));
    }), [productos]);

    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const esInsumo = p.tipo === 'ingrediente' || p.tipo === 'insumo';
        const keywords = ['vaso', 'salsa', 'cono', 'topo', 'cuchara', 'grajea', 'chispa', 'bolsa'];
        return esInsumo && keywords.some(k => n.includes(k)) && !insumosLista.some(i => i.id === p.id);
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

    const costoPorGramo = promedioMaestro / (parseFloat(calcData.cantidadTotalCaja) || 10000);
    
    // Costos base (Solo fijos y opcionales si se simulan)
    const costoBolasTotal = (calcData.cantB1 * calcData.pesoB1 * costoPorGramo) + 
                             (calcData.cantB2 * calcData.pesoB2 * costoPorGramo) + 
                             (calcData.cantB3 * calcData.pesoB3 * costoPorGramo);
    
    const costoExtrasFijos = calcData.selectedExtras.reduce((acc, curr) => {
        if (curr.type === 'gift') return acc;
        if (curr.type === 'optional' && !calcData.simulateOptional) return acc;
        return acc + curr.costo;
    }, 0);

    const costoBaseFinal = costoBolasTotal + costoExtrasFijos;
    
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
                selectedExtras: [...prev.selectedExtras, { id: prod.id, nombre: prod.nombre, costo: parseFloat(pCosto.toString()), type: 'fixed' }]
            }));
        }
    };

    const setExtraType = (idx: number, type: 'fixed' | 'gift' | 'optional') => {
        setCalcData(prev => ({
            ...prev,
            selectedExtras: prev.selectedExtras.map((ex, i) => i === idx ? { ...ex, type } : ex)
        }));
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto || 'Copa Nexus v11',
                categoria: calcData.categoria,
                descripcion: `Nexus v11. Opcionales configurados. Base: ${formatCurrency(costoBaseFinal)}.`,
                precioVenta: displayPVP,
                margenUtilidad: actualMargin.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('Producto con opcionales configurado!');
            onOpenChange(false);
        } catch (e) { toast.error('Error al guardar'); } finally { setLoading(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">
                <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg transform -rotate-3">
                                <MousePointer2 className="w-5 h-5 fill-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight italic">Nexus Heladería v11</DialogTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Arquitectura de Opcionales e Incentivos</p>
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
                    {/* PASO 1: PROMEDIO DE CAJAS */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest italic">1. Sincronizar Insumos Master</h3>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Total g/ml</Label>
                                    <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-8 w-20 text-center font-bold text-xs" />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {insumosLista.map(p => {
                                    const isSelected = calcData.selectedInsumosIds.includes(p.id);
                                    const pCosto = precios.find(pr => pr.productoId === p.id)?.precioCosto || 0;
                                    return (
                                        <button key={p.id} onClick={() => toggleInsumo(p.id)} className={cn("flex flex-col p-3 rounded-lg border text-left", isSelected ? "bg-indigo-600 text-white shadow-lg border-indigo-700" : "bg-white border-slate-100 hover:border-slate-200")}>
                                            <p className="text-[10px] font-black truncate leading-tight uppercase">{p.nombre}</p>
                                            <p className={cn("text-[9px] font-bold mt-1", isSelected ? "text-indigo-200" : "text-slate-400")}>{formatCurrency(parseFloat(pCosto.toString()))}</p>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-10 bg-indigo-600 rounded-[32px] text-white flex flex-col items-center gap-2 shadow-2xl shadow-indigo-100 text-center relative overflow-hidden">
                                <Package className="absolute bottom-[-10px] right-[-10px] w-32 h-32 opacity-10 rotate-12" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">PROMEDIO VINCULADO</span>
                                <div className="text-6xl font-black tracking-tighter">{formatCurrency(promedioMaestro)}</div>
                                <div className="mt-4 px-6 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">{calcData.selectedInsumosIds.length} Sabores Conectados</div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: LABORATORIO Y MODIFICADORES */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'B1', label: 'BOLA TIPO 1', weight: 'pesoB1', cant: 'cantB1', color: 'indigo', unit: (calcData.pesoB1 * costoPorGramo) },
                                    { key: 'B2', label: 'BOLA TIPO 2', weight: 'pesoB2', cant: 'cantB2', color: 'emerald', unit: (calcData.pesoB2 * costoPorGramo) },
                                    { key: 'B3', label: 'BOLA TIPO 3', weight: 'pesoB3', cant: 'cantB3', color: 'purple', unit: (calcData.pesoB3 * costoPorGramo) }
                                ].map(b => (
                                    <div key={b.key} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-50 border-${b.color}-200` : "bg-white border-slate-100")}>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{b.label}</p>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Input type="number" value={(calcData as any)[b.weight]} onChange={e => setCalcData({...calcData, [b.weight]: parseInt(e.target.value) || 0})} className="h-6 w-10 text-center font-black p-0 border-none bg-slate-100 rounded text-[9px]" />
                                            <span className="text-[8px] font-black text-slate-400">gr</span>
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: Math.max(0, (calcData as any)[b.cant] - 1)})} className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold font-mono">-</button>
                                            <div className="text-3xl font-black">{(calcData as any)[b.cant]}</div>
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: (calcData as any)[b.cant] + 1})} className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black text-white", `bg-${b.color}-600`)}>+</button>
                                        </div>
                                        <div className={cn("text-center py-2 px-3 rounded-lg w-full", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-600 text-white shadow-md shadow-${b.color}-200` : "bg-slate-50 text-slate-300")}>
                                            <p className="text-[8px] font-black uppercase opacity-70">Total Subcosto</p>
                                            <p className="text-sm font-black tracking-tight">{formatCurrency((calcData as any)[b.cant] * b.unit)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[11px] font-black uppercase text-slate-400 italic">Extras y Opcionales</Label>
                                        <div className="flex items-center gap-1.5 p-1 px-2 border border-slate-100 rounded-lg bg-slate-50">
                                            <Label className="text-[8px] font-black text-indigo-500 uppercase cursor-pointer" htmlFor="sim">Simular Opcionales</Label>
                                            <input id="sim" type="checkbox" checked={calcData.simulateOptional} onChange={e => setCalcData({...calcData, simulateOptional: e.target.checked})} className="w-3 h-3 cursor-pointer" />
                                        </div>
                                    </div>
                                    <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                        {calcData.selectedExtras.map((ex, i) => (
                                            <div key={i} className={cn("p-3 rounded-xl border flex flex-col gap-2 transition-all", ex.type === 'gift' ? "bg-amber-50 border-amber-200 shadow-inner" : ex.type === 'optional' ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100")}>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-800 leading-none">{ex.nombre}</span>
                                                        <span className={cn("text-[9px] font-bold mt-1", ex.type === 'gift' ? "text-amber-600 line-through" : "text-slate-400")}>{formatCurrency(ex.costo)}</span>
                                                    </div>
                                                    <button onClick={() => setCalcData(prev => ({...prev, selectedExtras: prev.selectedExtras.filter((_, idx) => idx !== i)})) } className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => setExtraType(i, 'fixed')} className={cn("flex-1 h-6 text-[8px] font-black uppercase rounded-md border", ex.type === 'fixed' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-400 border-slate-100")}>Base</button>
                                                    <button onClick={() => setExtraType(i, 'gift')} className={cn("flex-1 h-6 text-[8px] font-black uppercase rounded-md border", ex.type === 'gift' ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-400 border-slate-100")}>Plus 🎁</button>
                                                    <button onClick={() => setExtraType(i, 'optional')} className={cn("flex-1 h-6 text-[8px] font-black uppercase rounded-md border", ex.type === 'optional' ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-400 border-slate-100")}>Opcional</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <select onChange={e => e.target.value && addExtra(e.target.value)} className="w-full h-10 bg-slate-50 border-none rounded-xl px-4 text-[10px] font-black uppercase outline-none">
                                        <option value="">Añadir Extras (Vasos, Salsas, etc)...</option>
                                        {extrasDisponibles.map(e => (
                                            <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0'))})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-8 bg-emerald-600 rounded-[32px] text-white flex flex-col justify-between shadow-2xl shadow-emerald-100">
                                    <div className="text-center space-y-1">
                                        <Badge className="bg-white/20 text-white border-none py-2 px-4 text-[9px] mb-2">{calcData.simulateOptional ? 'SIMULACIÓN CON OPCIONALES' : 'PVP PRODUCTO ESTÁNDAR'}</Badge>
                                        <div className="flex items-center gap-2 justify-center">
                                            <span className="text-xl font-black opacity-30">$</span>
                                            <Input type="number" value={calcData.targetPVP} onChange={e => setCalcData({...calcData, targetPVP: e.target.value})} placeholder={calculatedPVP.toFixed(0)} className="h-10 w-36 border-none bg-transparent text-center font-black text-5xl p-0 focus-visible:ring-0 text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-3 bg-white/10 p-5 rounded-2xl border border-white/5 mt-4">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-70">Utilidad (%)</span><span className="text-2xl font-black">{actualMargin.toFixed(0)}%</span></div>
                                        <div className="flex items-center gap-3">
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin - 2, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Minus className="w-3 h-3" /></Button>
                                            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-700" style={{ width: `${actualMargin}%` }}></div></div>
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin + 2, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Plus className="w-3 h-3" /></Button>
                                        </div>
                                        <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter opacity-80 italic">Costo Base {calcData.simulateOptional ? 'Full' : 'Base'}: {formatCurrency(costoBaseFinal)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-widest">Nombre Final del Helado Maestro</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})} placeholder="Ej: Copa Boss v11..." className="h-12 text-sm font-bold bg-white border border-slate-100 rounded-xl px-5" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400">
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button disabled={loading || (step === 1 && calcData.selectedInsumosIds.length === 0)} onClick={() => step < 2 ? setStep(step + 1) : handleFinish()} className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all active:scale-95 shadow-xl shadow-indigo-100" >
                        {loading ? 'Calculando...' : (step === 2 ? '¡GUARDAR CONFIGURACIÓN!' : <div className="flex items-center gap-2 italic tracking-tighter">SIGUIENTE PASO <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
