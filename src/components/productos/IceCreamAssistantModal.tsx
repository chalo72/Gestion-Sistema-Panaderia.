import React, { useState, useEffect } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Zap, DollarSign, Store, Utensils, ArrowRight, Info, CheckCircle2
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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

    // -- Estado Maestro --
    const [calcData, setCalcData] = useState({
        // Paso 1: Insumo
        insumoId: '',
        nombreCaja: '',
        costoCaja: '',
        cantidadTotalCaja: '5000', 
        tamanoBola: '60', 
        useManualPrice: false,
        
        // Paso 2: Presentación
        cupSize: '3', 
        bolasPorProducto: '1',
        costoInsumos: '150', 
        costoSalsa: '80', 
        nombreProducto: '',
        categoria: 'Helados',
        
        // Paso 3: Precio
        targetPVP: '',
    });

    // Cálculos dinámicos (Filtro inteligente)
    const insumosLista = productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const c = (p.categoria || '').toLowerCase();
        return p.tipo === 'ingrediente' && (n.includes('helado') || n.includes('caja') || n.includes('vainilla') || n.includes('choco') || c.includes('helado') || c.includes('insumo'));
    });
    
    const preciosInsumo = precios.filter(pr => pr.productoId === calcData.insumoId);
    const promedioInsumo = preciosInsumo.length > 0 
        ? preciosInsumo.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / preciosInsumo.length 
        : 0;

    const costoCajaNum  = calcData.useManualPrice ? (parseFloat(calcData.costoCaja) || 0) : (promedioInsumo || parseFloat(calcData.costoCaja) || 0);
    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 5000;
    const tamanoBolaNum = parseFloat(calcData.tamanoBola) || 60;
    
    const bolasCajaNum  = Math.floor(totalCajaNum / tamanoBolaNum);
    const costoPorBola  = costoCajaNum / (bolasCajaNum || 1);
    
    const bolasProdNum  = parseFloat(calcData.bolasPorProducto) || 1;
    const costoFinal    = (costoPorBola * bolasProdNum) + (parseFloat(calcData.costoInsumos) || 0) + (parseFloat(calcData.costoSalsa) || 0);
    
    const targetPVPNum  = parseFloat(calcData.targetPVP) || (costoFinal * 1.6);
    const margenReal    = targetPVPNum > 1 ? ((targetPVPNum - costoFinal) / targetPVPNum) * 100 : 0;

    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

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
                descripcion: `Creado con Asistente: ${calcData.bolasPorProducto} bolas de ${calcData.nombreCaja || 'Helado'} (${calcData.tamanoBola}g/bola).`,
                precioVenta: targetPVPNum,
                margenUtilidad: margenReal.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoFinal
            });
            toast.success('¡Helado Pro creado con éxito!');
            onOpenChange(false);
        } catch (e) {
            toast.error('Error al crear el producto');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { id: 1, title: 'Insumo', sub: 'Caja y Costo', icon: Package },
        { id: 2, title: 'Rendimiento', sub: 'Bolas de 60g', icon: Zap },
        { id: 3, title: 'Presentación', sub: 'Vasos y Extras', icon: ShoppingCart },
        { id: 4, title: 'Precio', sub: 'Venta y Ganancia', icon: Calculator },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-none rounded-[32px] shadow-2xl">
                <DialogTitle className="sr-only">Asistente Heladería Pro</DialogTitle>
                
                {/* Header Premium */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 p-8 text-white relative">
                    <button onClick={() => onOpenChange(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                            <Store className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight leading-none mb-1">Heladería Maestro v4</h2>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Crea productos ganadores en pasos</p>
                        </div>
                    </div>

                    {/* Stepper Visual */}
                    <div className="flex items-center justify-between gap-2 px-2">
                        {steps.map((s) => (
                            <div key={s.id} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 font-black text-sm",
                                    step >= s.id ? "bg-white text-indigo-600 shadow-xl scale-110" : "bg-white/20 text-white/50"
                                )}>
                                    {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : s.id}
                                </div>
                                <span className={cn("text-[9px] font-black uppercase tracking-tighter transition-all", step >= s.id ? "text-white opacity-100" : "text-white/40")}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    
                    {/* PASO 1: LA CAJA (INSUMO) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">¿Cuál es el sabor base?</h3>
                                <p className="text-slate-500 text-sm font-medium">Selecciona la caja de helado que compraste.</p>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Insumos Registrados en Proveedores</Label>
                                    <select 
                                        value={calcData.insumoId}
                                        onChange={e => {
                                            if (e.target.value === 'manual') { setCalcData({...calcData, insumoId: 'manual', useManualPrice: true}); return; }
                                            const p = productos.find(prod => prod.id === e.target.value);
                                            const pr = precios.find(pr => pr.productoId === e.target.value)?.precioCosto || '';
                                            setCalcData({...calcData, insumoId: e.target.value, nombreCaja: p?.nombre || '', costoCaja: pr.toString(), useManualPrice: false});
                                        }}
                                        className="h-14 w-full bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-50 px-5 text-base font-black shadow-sm focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                                    >
                                        <option value="">-- Buscar Sabor / Caja --</option>
                                        {insumosLista.map(p => {
                                            const c = precios.filter(pr => pr.productoId === p.id).length;
                                            return <option key={p.id} value={p.id}>{p.nombre} ({c} {c === 1 ? 'precio' : 'precios'})</option>
                                        })}
                                        <option value="manual">+ Costo manual (Nuevo sabor)</option>
                                    </select>
                                </div>

                                {calcData.insumoId && calcData.insumoId !== 'manual' && (
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl border-2 border-indigo-100 flex flex-col items-center text-center gap-2 group hover:border-indigo-300 transition-all">
                                        <span className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest">Costo Detectado</span>
                                        <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(promedioInsumo || parseFloat(calcData.costoCaja) || 0)}</span>
                                        <p className="text-xs font-bold text-indigo-400">
                                            {preciosInsumo.length > 1 ? `✅ Promedio de ${preciosInsumo.length} proveedores` : '✅ Precio único registrado'}
                                        </p>
                                        <Button variant="ghost" size="sm" onClick={() => setCalcData({...calcData, useManualPrice: true})} className="text-indigo-500 font-bold hover:bg-white text-[10px]">¿El precio cambió? Ajustar aquí</Button>
                                    </div>
                                )}

                                {(calcData.insumoId === 'manual' || calcData.useManualPrice) && (
                                    <div className="p-6 bg-white rounded-3xl border-2 border-dashed border-slate-200 animate-ag-scale-in grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-indigo-500">Costo Caja ($)</Label>
                                            <Input type="number" value={calcData.costoCaja} onChange={e => setCalcData({...calcData, costoCaja: e.target.value, useManualPrice: true})} className="h-12 text-lg font-black bg-indigo-50/50 border-none rounded-xl" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Nombre Sabor</Label>
                                            <Input value={calcData.nombreCaja} onChange={e => setCalcData({...calcData, nombreCaja: e.target.value})} className="h-12 font-bold bg-slate-50 border-none rounded-xl" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PASO 2: RENDIMIENTO (LA BOLA) */}
                    {step === 2 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="space-y-1 text-center">
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">¿Cuánto rinde la caja?</h3>
                                <p className="text-slate-500 text-sm font-medium">💡 El estándar es una bola de 60g.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3 p-6 bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center">
                                    <Label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Peso de la Bola (gr/ml)</Label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setCalcData({...calcData, tamanoBola: (tamanoBolaNum - 5).toString()})} className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all">-</button>
                                        <div className="text-4xl font-black text-slate-800">{calcData.tamanoBola}</div>
                                        <button onClick={() => setCalcData({...calcData, tamanoBola: (tamanoBolaNum + 5).toString()})} className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl hover:bg-indigo-200 transition-all">+</button>
                                    </div>
                                </div>

                                <div className="space-y-3 p-6 bg-emerald-500 rounded-[40px] shadow-xl shadow-emerald-200/50 text-white flex flex-col items-center justify-center">
                                    <Label className="text-[10px] font-black uppercase text-white/70 tracking-widest">Bolas por Caja</Label>
                                    <div className="text-6xl font-black">{bolasCajaNum}</div>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Rendimiento Total</p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl flex justify-between items-center px-10">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Precio x Bola</p>
                                    <p className="text-3xl font-black text-slate-800 dark:text-white">{formatCurrency(costoPorBola)}</p>
                                </div>
                                <ArrowRight className="w-6 h-6 text-slate-300" />
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Caja</p>
                                    <Input 
                                        type="number" 
                                        value={calcData.cantidadTotalCaja} 
                                        onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value})}
                                        className="h-10 w-24 bg-transparent border-none text-right font-black text-xl p-0 focus-visible:ring-0"
                                    />
                                    <p className="text-[9px] text-slate-400 font-black">MILILITROS/GRAMOS</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: CONFIGURACIÓN (EL VASO) */}
                    {step === 3 && (
                        <div className="space-y-8 animate-ag-fade-in">
                            <div className="space-y-1 text-center">
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Armar Presentación</h3>
                                <p className="text-slate-500 text-sm font-medium italic">Selecciona el tipo de vaso y complementos.</p>
                            </div>

                            <div className="flex gap-2 p-2 bg-slate-200/50 rounded-3xl">
                                {['3', '5', '7', '9'].map(sz => (
                                    <button 
                                        key={sz}
                                        onClick={() => setCalcData({...calcData, cupSize: sz, nombreProducto: `Helado Vaso ${sz}oz`, bolasPorProducto: sz === '3' ? '1' : sz === '5' ? '2' : '3'})}
                                        className={cn(
                                            "flex-1 py-4 rounded-2xl text-xs font-black transition-all",
                                            calcData.cupSize === sz ? "bg-white text-indigo-600 shadow-lg scale-105" : "text-slate-400 hover:bg-white/50"
                                        )}
                                    >
                                        VASO {sz} OZ
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-white rounded-3xl border border-slate-100 space-y-4">
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">¿Cuántas Bolas?</Label>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setCalcData({...calcData, bolasPorProducto: (bolasProdNum - 1).toString()})} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black">-</button>
                                            <span className="text-3xl font-black text-slate-800">{calcData.bolasPorProducto}</span>
                                            <button onClick={() => setCalcData({...calcData, bolasPorProducto: (bolasProdNum + 1).toString()})} className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 bg-indigo-600 rounded-3xl flex flex-col items-center justify-center text-white shadow-xl shadow-indigo-200/50">
                                    <Label className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-1">Costo Otros</Label>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[10px] font-black">$</span>
                                        <Input 
                                            type="number" 
                                            value={(parseFloat(calcData.costoInsumos) + parseFloat(calcData.costoSalsa))}
                                            onChange={e => setCalcData({...calcData, costoInsumos: (parseFloat(e.target.value) - 80).toString()})}
                                            className="h-10 w-24 bg-transparent border-none text-center font-black text-3xl p-0 focus-visible:ring-0 text-white"
                                        />
                                    </div>
                                    <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mt-1">Vaso + Salsa + Extras</p>
                                </div>
                            </div>

                            {/* Nombre del Producto */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nombre Final (Para el Menú)</Label>
                                <Input 
                                    value={calcData.nombreProducto} 
                                    onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})}
                                    placeholder="Ej: Copa Especial 3oz Chocolate..." 
                                    className="h-14 text-lg font-black bg-white border-2 border-slate-100 rounded-2xl px-5"
                                />
                            </div>
                        </div>
                    )}

                    {/* PASO 4: PRECIO (ULTRA SIMPLE) */}
                    {step === 4 && (
                        <div className="space-y-10 animate-ag-fade-in">
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">¡Listo para Vender!</h3>
                                <p className="text-slate-500 text-sm font-medium">Ajusta el precio y mira tu ganancia real.</p>
                            </div>

                            <div className="p-10 bg-white dark:bg-slate-800 rounded-[48px] shadow-2xl border border-slate-100 space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                     <Badge className="bg-emerald-500 text-white font-black text-[10px] px-3 py-1">ULTRA PRO</Badge>
                                </div>
                                
                                <div className="space-y-4 text-center">
                                    <Label className="text-[11px] font-black uppercase text-indigo-500 flex items-center justify-center gap-2 tracking-[0.2em]">
                                        Precio de Venta Final ($)
                                    </Label>
                                    <div className="relative inline-block w-full">
                                        <Input 
                                            type="number" 
                                            value={calcData.targetPVP} 
                                            onChange={e => setCalcData({...calcData, targetPVP: e.target.value})}
                                            placeholder={(costoFinal * 1.6).toFixed(0)}
                                            className="h-28 text-7xl font-black text-emerald-600 rounded-[32px] bg-slate-50 border-none text-center focus:ring-emerald-500"
                                        />
                                        <div className="absolute bottom-4 left-0 right-0 text-[10px] font-black text-emerald-400 uppercase opacity-50 tracking-[0.3em]">PVP CLIENTE</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8 px-4">
                                    <div className="text-center group">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Margen de Ganancia</p>
                                        <p className={cn("text-4xl font-black", margenReal > 40 ? "text-indigo-600" : "text-orange-500")}>
                                            {margenReal.toFixed(0)}%
                                        </p>
                                    </div>
                                    <div className="text-center group">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Dinero Limpio</p>
                                        <p className="text-4xl font-black text-emerald-600">
                                            {formatCurrency(targetPVPNum - costoFinal)}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl flex justify-center gap-8">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><span className="text-[10px] font-black text-slate-500 uppercase">Costo Base: {formatCurrency(costoFinal)}</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-black text-slate-500 uppercase">Categoria: {calcData.categoria}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navegación */}
                <div className="p-8 pb-10 bg-white dark:bg-slate-900 flex justify-between gap-4 border-t border-slate-100">
                    <Button 
                        variant="ghost" 
                        onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-16 flex-1 rounded-2xl text-slate-400 font-black uppercase text-xs hover:bg-slate-50"
                    >
                        {step === 1 ? 'Cancelar' : <><ChevronLeft className="w-5 h-5 mr-2" /> Atrás</>}
                    </Button>
                    <Button 
                        disabled={loading}
                        onClick={() => step < 4 ? setStep(step + 1) : handleFinish()}
                        className="h-16 flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        {loading ? 'Creando PRODUCTO...' : (step === 4 ? '¡Crear Helado Final!' : <>{step === 1 ? 'Empezar Cálculos' : 'Siguiente Paso'} <ChevronRight className="w-5 h-5 ml-2" /></>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
