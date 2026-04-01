import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Layers, Plus, Minus, Info, Check, Search, Trash2, TrendingUp, DollarSign, Gift, Star
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
    isGift?: boolean; // Nueva propiedad para el "Plus" o "Regalo"
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

    // -- Estado Consolidado v10 (With Gift/Plus Support) --
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
        const esRelacionado = n.includes('vaso') || n.includes('salsa') || n.includes('cono') || n.includes('topo') || n.includes('cuchara') || c.includes('envase') || c.includes('desechable') || n.includes('grajea') || n.includes('chispa');
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
    
    // Subtotales Incrementales
    const subB1 = calcData.cantB1 * costU1;
    const subB2 = calcData.cantB2 * costU2;
    const subB3 = calcData.cantB3 * costU3;
    
    const costoBolasTotal = subB1 + subB2 + subB3;
    
    // FILTRADO DE COSTOS PARA EXTRAS (Si es "Gift", el costo es 0 para el cálculo)
    const costoExtrasTotal = calcData.selectedExtras.reduce((acc, curr) => {
        return acc + (curr.isGift ? 0 : curr.costo);
    }, 0);

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
                selectedExtras: [...prev.selectedExtras, { id: prod.id, nombre: prod.nombre, costo: parseFloat(pCosto.toString()), isGift: false }]
            }));
        }
    };

    const toggleExtraGift = (idx: number) => {
        setCalcData(prev => ({
            ...prev,
            selectedExtras: prev.selectedExtras.map((ex, i) => i === idx ? { ...ex, isGift: !ex.isGift } : ex)
        }));
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
            const extrasList = calcData.selectedExtras.map(e => `${e.nombre}${e.isGift ? ' (🎁 PLUS REGALO)' : ''}`).join(', ');
            await onAddProducto({
                nombre: calcData.nombreProducto || 'Copa Pro v10',
                categoria: calcData.categoria,
                descripcion: `Personalizado v10 Plus. Insumos: ${calcData.selectedInsumosIds.length}. Extras: ${extrasList}.`,
                precioVenta: displayPVP,
                margenUtilidad: actualMargin.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('¡Helado Maestro v10 guardado!');
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
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                                <Star className="w-5 h-5 fill-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight italic">Heladería Maestro v10</DialogTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Gestión de Costos + Opción Regalo (Plus)</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2].map(s => (
                                <div key={s} className={cn("w-20 h-1.5 rounded-full transition-all duration-300", step >= s ? "bg-indigo-600 scale-x-110" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: PROMEDIO DE CAJAS */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Paso 1: Sincronizar Insumos Base</h3>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Box Total (g/ml)</Label>
                                    <Input type="number" value={calcData.cantidadTotalCaja} onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})} className="h-8 w-20 text-center font-bold text-xs" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {insumosLista.map(p => {
                                    const isSelected = calcData.selectedInsumosIds.includes(p.id);
                                    const preciosP = precios.filter(pr => pr.productoId === p.id);
                                    const avgP = preciosP.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / (preciosP.length || 1);
                                    return (
                                        <button key={p.id} onClick={() => toggleInsumo(p.id)} className={cn("flex flex-col p-3 rounded-lg border text-left transition-all", isSelected ? "bg-indigo-600 border-indigo-700 text-white shadow-lg" : "bg-white border-slate-100 hover:border-slate-200")}>
                                            <p className="text-[10px] font-black truncate leading-tight uppercase mb-1">{p.nombre}</p>
                                            <p className={cn("text-[9px] font-bold", isSelected ? "text-indigo-200" : "text-slate-400")}>{formatCurrency(avgP)}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-10 bg-indigo-600 rounded-[32px] text-white flex flex-col items-center gap-2 shadow-2xl shadow-indigo-100 relative">
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-70">VALOR BASE PROMEDIO</span>
                                <div className="text-6xl font-black tracking-tighter">{formatCurrency(promedioMaestro)}</div>
                                <div className="mt-4 px-6 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">{calcData.selectedInsumosIds.length} Sabores Vinculados</div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: LABORATORIO + PLUS/REGALOS */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            {/* Desglose de Bolas */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'B1', label: 'BOLA TIPO 1', weight: 'pesoB1', cant: 'cantB1', color: 'indigo', unit: costU1, sub: subB1 },
                                    { key: 'B2', label: 'BOLA TIPO 2', weight: 'pesoB2', cant: 'cantB2', color: 'emerald', unit: costU2, sub: subB2 },
                                    { key: 'B3', label: 'BOLA TIPO 3', weight: 'pesoB3', cant: 'cantB3', color: 'purple', unit: costU3, sub: subB3 }
                                ].map(b => (
                                    <div key={b.key} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all shadow-sm", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-50 border-${b.color}-200` : "bg-white border-slate-100")}>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{b.label}</p>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Input type="number" value={(calcData as any)[b.weight]} onChange={e => setCalcData({...calcData, [b.weight]: parseInt(e.target.value) || 0})} className="h-6 w-10 text-center font-black p-0 border-none bg-slate-100 rounded text-[9px]" />
                                            <span className="text-[8px] font-black text-slate-400">gr</span>
                                        </div>

                                        <div className="flex items-center gap-3 mb-2">
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: Math.max(0, (calcData as any)[b.cant] - 1)})} className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold">-</button>
                                            <div className="text-3xl font-black">{(calcData as any)[b.cant]}</div>
                                            <button onClick={() => setCalcData({...calcData, [b.cant]: (calcData as any)[b.cant] + 1})} className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black text-white shadow-md", `bg-${b.color}-600`)}>+</button>
                                        </div>

                                        <div className={cn("text-center py-2 px-3 rounded-lg w-full", (calcData as any)[b.cant] > 0 ? `bg-${b.color}-600 text-white` : "bg-slate-50 text-slate-300")}>
                                            <p className="text-[8px] font-black uppercase opacity-70">Subtotal Dinero</p>
                                            <p className="text-sm font-black tracking-tight">{formatCurrency(b.sub)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">Extras e Incentivos <Gift className="w-3 h-3" /></Label>
                                        <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] font-black uppercase tracking-tighter">Plus Habilitado</Badge>
                                    </div>
                                    <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-2">
                                        {calcData.selectedExtras.map((ex, i) => (
                                            <div key={i} className={cn("flex justify-between items-center p-3 rounded-xl border transition-all animate-ag-scale-in", ex.isGift ? "bg-amber-50 border-amber-200 ring-2 ring-amber-500/10" : "bg-white border-slate-100")}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-[10px] font-black text-slate-800">{ex.nombre}</p>
                                                        {ex.isGift && <Badge className="bg-amber-600 text-white text-[7px] h-3 px-1 border-none font-black italic">🎁 PLUS</Badge>}
                                                    </div>
                                                    <p className={cn("text-[9px] font-bold", ex.isGift ? "text-amber-600/50 line-through" : "text-slate-400")}>{formatCurrency(ex.costo)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => toggleExtraGift(i)} className={cn("h-7 w-7 rounded-lg", ex.isGift ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-slate-300 bg-slate-50 hover:bg-slate-100")} title="Considerar como REGALO (Plus)">
                                                        <Gift className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <button onClick={() => removeExtra(i)} className="p-1 px-2 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <select onChange={e => e.target.value && addExtra(e.target.value)} className="w-full h-10 bg-slate-50 border-none rounded-xl px-4 text-[10px] font-black uppercase outline-none shadow-inner">
                                        <option value="">+ Seleccionar Vaso/Salsa/Grajea...</option>
                                        {extrasDisponibles.map(e => (
                                            <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0'))})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dash de Margen y PVP */}
                                <div className="p-8 bg-emerald-600 rounded-[32px] text-white shadow-2xl shadow-emerald-100 flex flex-col justify-between">
                                    <div className="text-center space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70">PRECIO VENTA AL PÚBLICO</span>
                                        <div className="flex items-center gap-3 justify-center">
                                            <span className="text-3xl font-black opacity-30">$</span>
                                            <Input type="number" value={calcData.targetPVP} onChange={e => setCalcData({...calcData, targetPVP: e.target.value})} placeholder={calculatedPVP.toFixed(0)} className="h-10 w-36 border-none bg-transparent text-center font-black text-5xl p-0 focus-visible:ring-0 text-white" />
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-white/10 p-5 rounded-2xl border border-white/10 mt-6">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Rendimiento (Utilidad %)</span>
                                            <span className="text-2xl font-black">{actualMargin.toFixed(0)}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin - 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Minus className="w-4 h-4" /></Button>
                                            <div className="h-2 flex-1 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-white transition-all duration-700" style={{ width: `${actualMargin}%` }}></div>
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin + 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Plus className="w-4 h-4" /></Button>
                                        </div>
                                        <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                                            <p className="text-[9px] font-bold uppercase opacity-60">Costo Base Real:</p>
                                            <p className="text-xs font-black">{formatCurrency(costoBaseFinal)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-widest italic">Nombre Final del Helado Maestro</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})} placeholder="Ej: Vaso 5oz Pro + Salsa Plus..." className="h-12 text-sm font-bold bg-white border border-slate-100 rounded-xl px-5" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400">
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button disabled={loading || (step === 1 && calcData.selectedInsumosIds.length === 0)} onClick={() => step < 2 ? setStep(step + 1) : handleFinish()} className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all active:scale-95 shadow-indigo-100" >
                        {loading ? 'Calculando...' : (step === 2 ? '¡FINALIZAR Y CREAR HELADO PRO!' : <div className="flex items-center gap-2">PASO 2: LABORATORIO Y PLUS <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
