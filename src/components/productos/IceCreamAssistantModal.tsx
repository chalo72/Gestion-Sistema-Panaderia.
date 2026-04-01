import { useState, useEffect } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Zap, DollarSign
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
    
    // -- Estado del Asistente --
    const [calcData, setCalcData] = useState({
        // Paso 1: El Bulto/Caja
        insumoId: '',
        nombreCaja: '',
        costoCaja: '',
        unidadesMedidaCaja: 'ml', // ml o gr
        cantidadTotalCaja: '5000', // Ej: 5000ml (5 Litros)
        tamanoBola: '60', // Ej: 60ml o 60gr
        bolasPorCaja: '83',
        proveedorId: '',
        useManualPrice: false,
        
        // Paso 2: La Presentación (Vaso 3oz, etc.)
        nombreProducto: '',
        cupSize: '3', // 3, 5, 7, 9
        bolasPorProducto: '1',
        costoInsumos: '150', // Vaso + Cuchara
        costoSalsa: '80', // Salsa/Toppings
        categoria: 'Helados',
        
        // Paso 3: Precio
        margen: '40',
        targetPVP: '',
    });

    const [loading, setLoading] = useState(false);

    // Cálculos dinámicos (Filtro más inteligente para encontrar las cajas)
    const insumosLista  = productos.filter(p => {
        const nombreValido = p.nombre.toLowerCase().includes('helado') || p.nombre.toLowerCase().includes('caja') || p.nombre.toLowerCase().includes('vainilla') || p.nombre.toLowerCase().includes('choco');
        const catValida = p.categoria?.toLowerCase().includes('helado') || p.categoria?.toLowerCase().includes('insumo') || p.categoria?.toLowerCase().includes('materia');
        return p.tipo === 'ingrediente' && (nombreValido || catValida);
    });
    
    // Obtener promedio del insumo seleccionado de forma robusta
    const preciosInsumo = precios.filter(pr => pr.productoId === calcData.insumoId);
    const promedioInsumo = preciosInsumo.length > 0 
        ? preciosInsumo.reduce((acc, curr) => acc + (parseFloat(curr.precioCosto) || 0), 0) / preciosInsumo.length 
        : 0;

    const costoCajaNum  = calcData.useManualPrice ? (parseFloat(calcData.costoCaja) || 0) : (promedioInsumo || parseFloat(calcData.costoCaja) || 0);
    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 1;
    const tamanoBolaNum = parseFloat(calcData.tamanoBola) || 1;
    
    const rendAuto      = Math.floor(totalCajaNum / tamanoBolaNum);
    const bolasCajaNum  = parseFloat(calcData.bolasPorCaja) || rendAuto || 1;
    const costoPorBola  = costoCajaNum / bolasCajaNum;
    
    const bolasProdNum  = parseFloat(calcData.bolasPorProducto) || 1;
    const insumosNum    = parseFloat(calcData.costoInsumos) || 0;
    const salsaNum      = parseFloat(calcData.costoSalsa) || 0;
    const costoFinal    = (costoPorBola * bolasProdNum) + insumosNum + salsaNum;
    
    const margenNum     = parseFloat(calcData.margen) || 1;
    const pvpCalculado  = costoFinal * (1 + margenNum / 100);
    const targetPVPNum  = parseFloat(calcData.targetPVP) || pvpCalculado;
    const margenReal    = targetPVPNum > 1 ? ((targetPVPNum - costoFinal) / targetPVPNum) * 100 : 0;

    // Reiniciar si se abre
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            // Intentar pre-seleccionar categoría Helados si existe
            const catHelados = categorias.find(c => c.nombre.toLowerCase().includes('helado'));
            if (catHelados) setCalcData(prev => ({ ...prev, categoria: catHelados.nombre }));
        }
    }, [isOpen]);

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const handleFinish = async () => {
        if (!calcData.nombreProducto || !calcData.categoria) {
            toast.error('Completa los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const pvp = parseFloat(calcData.targetPVP) || pvpCalculado;
            
            const nuevoProd = await onAddProducto({
                nombre: calcData.nombreProducto,
                categoria: calcData.categoria,
                descripcion: `Helado calculado: ${calcData.bolasPorProducto} bola(s) de ${calcData.nombreCaja || 'Helado'}.`,
                precioVenta: pvp,
                margenUtilidad: margenReal.toFixed(0),
                tipo: 'elaborado',
                unidadMedida: 'unidad',
                costoBase: costoFinal
            });

            if (calcData.proveedorId && calcData.costoCaja) {
                // Registramos el precio del bulto/caja para referencia histórica o futura
                onAddOrUpdatePrecio({
                    productoId: nuevoProd.id,
                    proveedorId: calcData.proveedorId,
                    precioCosto: costoFinal, // Guardamos el costo unitario derivado
                    notas: `Calculado desde bulto de $${calcData.costoCaja} / ${calcData.bolasPorCaja} bolas`
                });
            }

            toast.success('Producto de heladería creado exitosamente');
            onOpenChange(false);
        } catch (error) {
            toast.error('Error al crear el producto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-slate-50 dark:bg-slate-900 animate-ag-scale-in">
                
                {/* Header Wizard */}
                <div className="bg-indigo-600 p-6 text-white">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-200 fill-indigo-200" />
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Asistente Heladería Pro</DialogTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Progress Bar Simple */}
                    <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={cn(
                                "h-1.5 flex-1 rounded-full transition-all duration-500",
                                step >= i ? "bg-white" : "bg-white/20"
                            )} />
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* STEP 1: LA MATERIA PRIMA (CAJA) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Package className="w-5 h-5 text-indigo-500" /> Paso 1: Datos de la Caja/Bulto
                                </h3>
                                <p className="text-xs text-slate-500 font-medium italic">Define cuánto pagas por el helado al por mayor y cuánto rinde.</p>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Seleccionar Caja / Bulto (Desde Proveedores)</Label>
                                    <select 
                                        value={calcData.insumoId}
                                        onChange={e => {
                                            if (e.target.value === 'manual') {
                                                setCalcData({...calcData, insumoId: 'manual', useManualPrice: true});
                                                return;
                                            }
                                            const p = productos.find(prod => prod.id === e.target.value);
                                            // Al seleccionar, intentamos extraer el precio costo actual si no hay promedios
                                            const mejorPrecio = precios.find(pr => pr.productoId === e.target.value)?.precioCosto || '';
                                            setCalcData({
                                                ...calcData, 
                                                insumoId: e.target.value, 
                                                nombreCaja: p?.nombre || '', 
                                                costoCaja: mejorPrecio.toString(),
                                                useManualPrice: false
                                            });
                                        }}
                                        className="w-full h-12 text-base font-black rounded-2xl bg-white border-2 border-indigo-100 px-4 focus:ring-indigo-500 shadow-sm"
                                    >
                                        <option value="">-- Elige un Insumo Registrado --</option>
                                        {insumosLista.map(p => {
                                            const count = precios.filter(pr => pr.productoId === p.id).length;
                                            return <option key={p.id} value={p.id}>{p.nombre} ({count} precios listados)</option>
                                        })}
                                        <option value="manual">+ Ingresar costo manual</option>
                                    </select>
                                </div>

                                {calcData.insumoId && calcData.insumoId !== 'manual' && (
                                    <div className="p-4 rounded-2xl bg-indigo-600 dark:bg-indigo-900 border border-indigo-500 flex justify-between items-center animate-ag-fade-in shadow-xl">
                                        <div className="text-white">
                                            <p className="text-[10px] font-black opacity-70 uppercase tracking-tighter">Costo Base Detectado</p>
                                            <p className="text-xl font-black">{formatCurrency(promedioInsumo || parseFloat(calcData.costoCaja) || 0)}</p>
                                            <p className="text-[9px] font-bold opacity-80">
                                                {preciosInsumo.length > 1 
                                                    ? `⭐ Promediado entre ${preciosInsumo.length} proveedores` 
                                                    : `📍 Precio único registrado`}
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setCalcData({...calcData, useManualPrice: true})} className="text-[10px] uppercase font-black bg-white/10 border-white/20 text-white hover:bg-white/20">
                                            Ajustar Precio
                                        </Button>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase text-slate-400">Total Caja (ml/gr)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.cantidadTotalCaja} 
                                            onChange={e => setCalcData({...calcData, cantidadTotalCaja: e.target.value, bolasPorCaja: Math.floor(parseFloat(e.target.value)/parseFloat(calcData.tamanoBola)).toString()})}
                                            className="h-11 font-black rounded-xl bg-white border-slate-200 text-center"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase text-slate-400">Bola (ml/gr)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.tamanoBola} 
                                            onChange={e => setCalcData({...calcData, tamanoBola: e.target.value, bolasPorCaja: Math.floor(parseFloat(calcData.cantidadTotalCaja)/parseFloat(e.target.value)).toString()})}
                                            className="h-11 font-black rounded-xl bg-white border-slate-200 text-center"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase text-indigo-600">Rendimiento (Bolas)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.bolasPorCaja} 
                                            onChange={e => setCalcData({...calcData, bolasPorCaja: e.target.value})}
                                            className="h-11 font-black rounded-xl bg-indigo-50 border-indigo-200 text-center text-indigo-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Live Result Step 1 */}
                            {costoCajaNum > 0 && (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-700">Costo aproximado por bola:</span>
                                    <span className="text-xl font-black text-indigo-600">{formatCurrency(costoPorBola)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: EL PRODUCTO FINAL (PRESENTACIÓN INTERACTIVA) */}
                    {step === 2 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-indigo-500" /> Paso 2: Configurar Helado
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Personaliza el tamaño y complementos</p>
                            </div>

                            {/* Preset Buttons */}
                            <div className="flex gap-2">
                                {['3', '5', '7', '9'].map(size => (
                                    <button 
                                        key={size}
                                        onClick={() => setCalcData({...calcData, cupSize: size, nombreProducto: `Vaso de ${size} OZ`, bolasPorProducto: size === '3' ? '1' : size === '5' ? '2' : '3'})}
                                        className={cn(
                                            "flex-1 py-3 rounded-2xl text-xs font-black transition-all border-2",
                                            calcData.cupSize === size 
                                                ? "bg-indigo-600 border-indigo-200 text-white shadow-lg shadow-indigo-100" 
                                                : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                                        )}
                                    >
                                        {size} OZ
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Nombre del Helado</Label>
                                    <Input 
                                        value={calcData.nombreProducto} 
                                        onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})}
                                        placeholder="Ej: Copa Especial 3oz..." 
                                        className="h-12 text-base font-bold rounded-2xl bg-white border-slate-200"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500">Gramos/Bola</Label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCalcData({...calcData, tamanoBola: (tamanoBolaNum - 5).toString()})} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold">-</button>
                                            <Input 
                                                type="number" 
                                                value={calcData.tamanoBola} 
                                                onChange={e => setCalcData({...calcData, tamanoBola: e.target.value})}
                                                className="border-none text-xl font-black text-center p-0 h-8 focus-visible:ring-0"
                                            />
                                            <button onClick={() => setCalcData({...calcData, tamanoBola: (tamanoBolaNum + 5).toString()})} className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">+</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500">Cantidad Bolas</Label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCalcData({...calcData, bolasPorProducto: (bolasProdNum - 1).toString()})} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold">-</button>
                                            <Input 
                                                type="number" 
                                                value={calcData.bolasPorProducto} 
                                                onChange={e => setCalcData({...calcData, bolasPorProducto: e.target.value})}
                                                className="border-none text-xl font-black text-center p-0 h-8 focus-visible:ring-0"
                                            />
                                            <button onClick={() => setCalcData({...calcData, bolasPorProducto: (bolasProdNum + 1).toString()})} className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Vaso/Cuchara ($)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.costoInsumos} 
                                            onChange={e => setCalcData({...calcData, costoInsumos: e.target.value})}
                                            className="h-10 font-bold rounded-xl bg-white border-slate-100 text-center"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Salsa/Extras ($)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.costoSalsa} 
                                            onChange={e => setCalcData({...calcData, costoSalsa: e.target.value})}
                                            className="h-10 font-bold rounded-xl bg-white border-slate-100 text-center"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Indicator */}
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-l-4 border-emerald-500 flex justify-between items-center animate-ag-scale-in">
                                <div>
                                    <p className="text-[9px] font-black text-emerald-700 uppercase">Costo Final Unitario</p>
                                    <p className="text-2xl font-black text-emerald-600">{formatCurrency(costoFinal)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-emerald-700 uppercase">Utilidad Proyectada</p>
                                    <p className="text-lg font-black text-emerald-500">~{formatCurrency(pvpCalculado - costoFinal)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PRECIO Y MARGEN (TARGET PVP) */}
                    {step === 3 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-indigo-500" /> Paso 3: Definir Precio y Ganancia
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold italic">Ajusta el precio hasta que llegues a la utilidad que quieres.</p>
                            </div>

                            <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" /> Precio al que quieres vender (PVP)
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={calcData.targetPVP} 
                                        onChange={e => setCalcData({...calcData, targetPVP: e.target.value})}
                                        placeholder={pvpCalculado.toFixed(0)}
                                        className="h-20 text-5xl font-black text-emerald-600 rounded-2xl bg-slate-50 border-none text-center focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-indigo-50 rounded-2xl text-center">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase">Margen Real</p>
                                        <p className={cn(
                                            "text-2xl font-black",
                                            margenReal > 30 ? "text-indigo-600" : "text-orange-500"
                                        )}>
                                            {margenReal.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-2xl text-center">
                                        <p className="text-[9px] font-black text-emerald-400 uppercase">Ganancia Limpia</p>
                                        <p className="text-2xl font-black text-emerald-600">
                                            {formatCurrency(targetPVPNum - costoFinal)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Categoría Final</Label>
                                <div className="flex flex-wrap gap-2">
                                    {categorias.filter(c => c.tipo !== 'insumo').slice(0, 4).map(c => (
                                        <button 
                                            key={c.id}
                                            onClick={() => setCalcData({...calcData, categoria: c.nombre})}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                                                calcData.categoria === c.nombre 
                                                    ? "bg-indigo-600 text-white shadow-md" 
                                                    : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
                                            )}
                                        >
                                            {c.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex gap-3 mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                        {step > 1 && (
                            <Button variant="outline" onClick={handlePrev} className="h-12 flex-1 rounded-2xl font-bold uppercase tracking-tight">
                                <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
                            </Button>
                        )}
                        
                        {step < 3 ? (
                            <Button 
                                onClick={handleNext} 
                                disabled={step === 1 && !calcData.costoCaja}
                                className="h-12 flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg shadow-indigo-200"
                            >
                                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleFinish} 
                                disabled={loading || !calcData.nombreProducto}
                                className="h-12 flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg shadow-emerald-200"
                            >
                                {loading ? 'Creando...' : '✓ Crear Producto Final'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Corner Info Badge */}
                <div className="absolute top-24 right-4 animate-ag-bounce">
                    <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-indigo-200 text-indigo-600 font-black text-[9px] uppercase px-3 py-1 rounded-full shadow-sm">
                        Modo Pro
                    </Badge>
                </div>
            </DialogContent>
        </Dialog>
    );
}
