import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronRight, ChevronLeft, Coffee, Beer, 
    Plus, Minus, Trash2, MousePointer2, Star, TrendingUp, Info, Package, CupSoda, Droplet, Thermometer
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExtraItem {
    id: string;
    nombre: string;
    costo: number;
    type: 'fixed' | 'gift' | 'optional';
}

interface BeverageAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[]; 
    onAddProducto: (producto: any) => Promise<any>;
    formatCurrency: (val: number) => string;
}

export function BeverageAssistantModal({
    isOpen, onOpenChange, productos, precios, 
    onAddProducto, formatCurrency
}: BeverageAssistantModalProps) {
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<'hot' | 'michelada'>('hot');
    const [loading, setLoading] = useState(false);

    // -- Estado Consolidado Barista v1 --
    const [calcData, setCalcData] = useState({
        // Calientes
        cafeGramos: '10',         // 10g para un expresso/tinto
        lecheMl: '150',          // 150ml para capuchino
        chocGramos: '25',        // 25g para chocolate
        
        // Micheladas
        precioCervezaUnit: 0,
        cervezaId: '',
        nombreCerveza: '',
        adicionalesMichelada: 800, // Limón, Sal, Chile (Promedio)
        
        selectedExtras: [] as ExtraItem[],
        nombreProducto: '',
        categoria: 'Bebidas',
        targetMargin: 40,
        targetPVP: '',
        simulateOptional: false,
    });

    // Insumos Maestros (Café, Leche, Chocolate)
    const insumosBarista = useMemo(() => {
        return productos.filter(p => {
            const n = p.nombre.toLowerCase();
            return p.tipo === 'ingrediente' && (n.includes('cafe') || n.includes('leche') || n.includes('chocolat') || n.includes('capuchino'));
        });
    }, [productos]);

    const cervezasLista = useMemo(() => {
        return productos.filter(p => {
            const n = p.nombre.toLowerCase();
            const c = (p.categoria || '').toLowerCase();
            return n.includes('cerveza') || c.includes('cerveza') || n.includes('poker') || n.includes('aguila') || n.includes('club');
        });
    }, [productos]);

    const extrasLista = useMemo(() => {
        return productos.filter(p => {
            const n = p.nombre.toLowerCase();
            const esExtra = n.includes('vaso') || n.includes('pitillo') || n.includes('servilleta') || n.includes('tapa') || n.includes('bolsa');
            return esExtra && p.tipo === 'ingrediente';
        });
    }, [productos]);

    // Lógica de Costeo Calientes
    const getCostoInsumo = (key: string) => {
        const item = insumosBarista.find(i => i.nombre.toLowerCase().includes(key));
        if (!item) return 0;
        const pCosto = precios.find(pr => pr.productoId === item.id)?.precioCosto || 0;
        // Asumiendo bolsas de 500g o 1000ml estándares si no hay unidad
        const divisor = key.includes('cafe') ? 500 : 1000; 
        return parseFloat(pCosto.toString()) / divisor;
    };

    const costHot = useMemo(() => {
        const cCafe = (parseFloat(calcData.cafeGramos) || 0) * getCostoInsumo('cafe');
        const cLeche = (parseFloat(calcData.lecheMl) || 0) * getCostoInsumo('leche');
        const cChoc = (parseFloat(calcData.chocGramos) || 0) * getCostoInsumo('choc');
        return cCafe + cLeche + cChoc;
    }, [calcData.cafeGramos, calcData.lecheMl, calcData.chocGramos, insumosBarista, precios]);

    const costMichelada = useMemo(() => {
        return calcData.precioCervezaUnit + calcData.adicionalesMichelada;
    }, [calcData.precioCervezaUnit, calcData.adicionalesMichelada]);

    const costoInsumoBase = mode === 'hot' ? costHot : costMichelada;
    
    // Extras fijos y opcionales
    const costoExtrasTotal = calcData.selectedExtras.reduce((acc, curr) => {
        if (curr.type === 'gift') return acc;
        if (curr.type === 'optional' && !calcData.simulateOptional) return acc;
        return acc + curr.costo;
    }, 0);

    const costoBaseFinal = costoInsumoBase + costoExtrasTotal;
    const profitMultiplier = 1 / (1 - (calcData.targetMargin / 100));
    const calculatedPVP = costoBaseFinal * profitMultiplier;
    const displayPVP = calcData.targetPVP ? parseFloat(calcData.targetPVP) : calculatedPVP;
    const actualMargin = displayPVP > 0 ? ((displayPVP - costoBaseFinal) / displayPVP) * 100 : 0;

    useEffect(() => { if (isOpen) { setStep(1); setMode('hot'); } }, [isOpen]);

    const selectCerveza = (id: string) => {
        const p = productos.find(x => x.id === id);
        const pc = precios.find(pr => pr.productoId === id)?.precioCosto || 0;
        if (p) setCalcData({...calcData, cervezaId: id, nombreCerveza: p.nombre, precioCervezaUnit: parseFloat(pc.toString())});
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

    const handleFinish = async () => {
        setLoading(true);
        try {
            await onAddProducto({
                nombre: calcData.nombreProducto || (mode === 'hot' ? 'Café Pro' : `Michelada ${calcData.nombreCerveza}`),
                categoria: mode === 'hot' ? 'Bebidas Calientes' : 'Cervezas',
                descripcion: `${mode === 'hot' ? 'Barista v1' : 'Michelada v1'}. Costo Base: ${formatCurrency(costoBaseFinal)}`,
                precioVenta: displayPVP,
                margenUtilidad: actualMargin.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoBaseFinal
            });
            toast.success('Bebida registrada con éxito!');
            onOpenChange(false);
        } catch (e) { toast.error('Error al guardar'); } finally { setLoading(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">
                <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg">
                                {mode === 'hot' ? <Coffee className="w-5 h-5" /> : <Beer className="w-5 h-5" />}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight">{mode === 'hot' ? 'Nexus Barista Assistant' : 'Nexus Michelada Master'}</DialogTitle>
                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest leading-none">Laboratorio de Bebidas Inteligente</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2].map(s => (
                                <div key={s} className={cn("w-16 h-1.2 rounded-full transition-all", step >= s ? "bg-indigo-500" : "bg-white/10")} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 max-h-[70vh] overflow-y-auto">
                    {/* PASO 1: MODO Y BASE */}
                    {step === 1 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setMode('hot')} className={cn("p-6 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3", mode === 'hot' ? "bg-indigo-50 border-indigo-500 shadow-md" : "bg-white border-slate-100 hover:border-slate-200")}>
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", mode === 'hot' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}><Coffee className="w-6 h-6" /></div>
                                    <span className="font-black text-sm uppercase tracking-tighter">Bebidas Calientes</span>
                                </button>
                                <button onClick={() => setMode('michelada')} className={cn("p-6 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3", mode === 'michelada' ? "bg-indigo-50 border-indigo-500 shadow-md" : "bg-white border-slate-100 hover:border-slate-200")}>
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", mode === 'michelada' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}><Beer className="w-6 h-6" /></div>
                                    <span className="font-black text-sm uppercase tracking-tighter">Micheladas Master</span>
                                </button>
                            </div>

                            <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                                {mode === 'hot' ? (
                                    <div className="grid grid-cols-3 gap-8">
                                        <div className="space-y-4 text-center">
                                            <div className="w-full flex justify-center"><Droplet className="w-6 h-6 text-indigo-500" /></div>
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Café (Gramos)</Label>
                                            <Input type="number" value={calcData.cafeGramos} onChange={e => setCalcData({...calcData, cafeGramos: e.target.value})} className="h-10 text-center font-black text-lg p-0" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Costo: {formatCurrency((parseFloat(calcData.cafeGramos) || 0) * getCostoInsumo('cafe'))}</p>
                                        </div>
                                        <div className="space-y-4 text-center">
                                            <div className="w-full flex justify-center"><Thermometer className="w-6 h-6 text-indigo-400" /></div>
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Leche (ml)</Label>
                                            <Input type="number" value={calcData.lecheMl} onChange={e => setCalcData({...calcData, lecheMl: e.target.value})} className="h-10 text-center font-black text-lg p-0" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Costo: {formatCurrency((parseFloat(calcData.lecheMl) || 0) * getCostoInsumo('leche'))}</p>
                                        </div>
                                        <div className="space-y-4 text-center">
                                            <div className="w-full flex justify-center"><div className="w-6 h-6 bg-slate-200 rounded-full" /></div>
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Chocolate (gr)</Label>
                                            <Input type="number" value={calcData.chocGramos} onChange={e => setCalcData({...calcData, chocGramos: e.target.value})} className="h-10 text-center font-black text-lg p-0" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Costo: {formatCurrency((parseFloat(calcData.chocGramos) || 0) * getCostoInsumo('choc'))}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400">1. Seleccionar Cerveza</Label>
                                                <select onChange={e => selectCerveza(e.target.value)} className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black uppercase shadow-sm">
                                                    <option value="">Buscar Cerveza...</option>
                                                    {cervezasLista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400">2. Lemon/Salt/Ice Cost</Label>
                                                <Input type="number" value={calcData.adicionalesMichelada} onChange={e => setCalcData({...calcData, adicionalesMichelada: parseFloat(e.target.value) || 0})} className="h-11 font-black" />
                                            </div>
                                        </div>
                                        {calcData.cervezaId && (
                                            <div className="p-4 bg-indigo-600 text-white rounded-2xl flex justify-between items-center animate-ag-scale-in">
                                                <div><p className="text-[10px] font-bold uppercase opacity-80">Precio Pola Seleccionada</p><p className="text-xl font-black">{calcData.nombreCerveza}</p></div>
                                                <div className="text-right font-black text-2xl">{formatCurrency(calcData.precioCervezaUnit)}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="text-center p-6 bg-slate-900 rounded-[32px] text-white flex flex-col gap-1 shadow-xl shadow-slate-100">
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Costo Base Liquid Maestro</span>
                                <div className="text-5xl font-black">{formatCurrency(costoInsumoBase)}</div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: EXTRAS (VASOS) Y MARGEN */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[11px] font-black uppercase text-slate-400 pl-1 italic">Extras (Vaso, Pitillo, Tapa)</Label>
                                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-2">
                                        {calcData.selectedExtras.map((ex, i) => (
                                            <div key={i} className={cn("p-2.5 rounded-xl border flex justify-between items-center transition-all animate-ag-slide-up", ex.type === 'gift' ? "bg-amber-50 border-amber-100" : "bg-white border-slate-100")}>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-800 leading-none mb-1">{ex.nombre}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">{formatCurrency(ex.costo)}</p>
                                                </div>
                                                <button onClick={() => setCalcData(p => ({...p, selectedExtras: p.selectedExtras.filter((_, idx) => idx !== i)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <select onChange={e => e.target.value && addExtra(e.target.value)} className="w-full h-10 bg-slate-50 border-none rounded-xl px-4 text-[10px] font-black uppercase shadow-inner">
                                        <option value="">Añadir Extras...</option>
                                        {extrasLista.map(e => <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(parseFloat(precios.find(p => p.productoId === e.id)?.precioCosto?.toString() || '0'))})</option>)}
                                    </select>
                                </div>

                                <div className="p-8 bg-emerald-600 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-emerald-50">
                                    <div className="text-center">
                                        <Badge className="bg-white/20 text-white border-none py-1.5 mb-3">RESULTADO FINANCIERO</Badge>
                                        <div className="flex items-center gap-2 justify-center">
                                            <span className="text-2xl font-black opacity-30">$</span>
                                            <Input type="number" value={calcData.targetPVP} onChange={e => setCalcData({...calcData, targetPVP: e.target.value})} placeholder={calculatedPVP.toFixed(0)} className="h-10 w-36 border-none bg-transparent text-center font-black text-5xl p-0 focus-visible:ring-0 text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-3 mt-6">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-black"><span>Márgen</span><span>{actualMargin.toFixed(0)}%</span></div>
                                        <div className="flex items-center gap-4">
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin - 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Minus className="w-4 h-4" /></Button>
                                            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white" style={{ width: `${actualMargin}%` }}></div></div>
                                            <Button variant="outline" size="icon" onClick={() => setCalcData({...calcData, targetMargin: calcData.targetMargin + 5, targetPVP: ''})} className="h-7 w-7 bg-white/20 border-none text-white"><Plus className="w-4 h-4" /></Button>
                                        </div>
                                        <div className="text-center text-[9px] font-black opacity-60 uppercase">Costo Final Bebida: {formatCurrency(costoBaseFinal)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-widest italic">Nombre Final de la Bebida</Label>
                                <Input value={calcData.nombreProducto} onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})} placeholder={mode === 'hot' ? "Ej: Capuchino Supremo..." : "Ej: Michelada Poker 600ml..."} className="h-12 text-sm font-bold bg-slate-50 border-none rounded-xl px-5" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-between gap-4">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} className="h-12 flex-1 rounded-xl text-xs font-black uppercase text-slate-400">
                        {step === 1 ? 'Cerrar' : <ChevronLeft className="w-5 h-5 mr-1" />}
                    </Button>
                    <Button disabled={loading} onClick={() => step < 2 ? setStep(step + 1) : handleFinish()} className="h-12 flex-[3] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all active:scale-95 shadow-xl shadow-indigo-100" >
                        {loading ? 'Preparando...' : (step === 2 ? '¡GENERAR BEBIDA!' : <div className="flex items-center gap-2">CONFIGURAR RECETA <ChevronRight className="w-4 h-4" /></div>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
