import { useState, useEffect } from 'react';
import { 
    X, Calculator, ShoppingCart, 
    ChevronRight, ChevronLeft, Package, 
    Zap, DollarSign, Percent
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
        tipoEnvase: 'Vaso',
        bolasPorProducto: '1',
        costoInsumos: '200', // Vaso + Cuchara
        categoria: 'Helados',
        
        // Paso 3: Precio
        margen: '40',
        precioVenta: '',
    });

    const [loading, setLoading] = useState(false);

    // Cálculos dinámicos
    const insumosLista  = productos.filter(p => p.tipo === 'ingrediente' && (p.categoria?.toLowerCase().includes('helado') || p.nombre.toLowerCase().includes('helado') || p.nombre.toLowerCase().includes('caja')));
    
    // Obtener promedio del insumo seleccionado
    const preciosInsumo = precios.filter(pr => pr.productoId === calcData.insumoId);
    const promedioInsumo = preciosInsumo.length > 0 
        ? preciosInsumo.reduce((acc, curr) => acc + curr.precioCosto, 0) / preciosInsumo.length 
        : 0;

    const costoCajaNum  = calcData.useManualPrice ? (parseFloat(calcData.costoCaja) || 0) : promedioInsumo;
    const totalCajaNum  = parseFloat(calcData.cantidadTotalCaja) || 1;
    const tamanoBolaNum = parseFloat(calcData.tamanoBola) || 1;
    
    // Si el usuario cambia el tamaño de bola, recalculamos rendimiento
    const rendAuto      = Math.floor(totalCajaNum / tamanoBolaNum);
    const bolasCajaNum  = parseFloat(calcData.bolasPorCaja) || rendAuto || 1;
    const costoPorBola  = costoCajaNum / bolasCajaNum;
    
    const bolasProdNum  = parseFloat(calcData.bolasPorProducto) || 1;
    const insumosNum    = parseFloat(calcData.costoInsumos) || 0;
    const costoFinal    = (costoPorBola * bolasProdNum) + insumosNum;
    
    const margenNum     = parseFloat(calcData.margen) || 1;
    const pvpCalculado  = costoFinal * (1 + margenNum / 100);

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
            const pvp = parseFloat(calcData.precioVenta) || pvpCalculado;
            
            const nuevoProd = await onAddProducto({
                nombre: calcData.nombreProducto,
                categoria: calcData.categoria,
                descripcion: `Helado calculado: ${calcData.bolasPorProducto} bola(s) de ${calcData.nombreCaja || 'Helado'}.`,
                precioVenta: pvp,
                margenUtilidad: calcData.margen,
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
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Seleccionar Caja de Helado (Insumo)</Label>
                                    <select 
                                        value={calcData.insumoId}
                                        onChange={e => {
                                            const p = productos.find(prod => prod.id === e.target.value);
                                            setCalcData({...calcData, insumoId: e.target.value, nombreCaja: p?.nombre || '', useManualPrice: false});
                                        }}
                                        className="w-full h-12 text-base font-bold rounded-2xl bg-white border-slate-200 px-4 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Selecciona un Insumo --</option>
                                        {insumosLista.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                        <option value="manual">+ Ingresar costo manual</option>
                                    </select>
                                </div>

                                {(calcData.insumoId === 'manual' || calcData.useManualPrice) && (
                                    <div className="animate-ag-fade-in space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase text-indigo-500">Costo Manual de la Caja ($)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={calcData.costoCaja} 
                                                    onChange={e => setCalcData({...calcData, costoCaja: e.target.value, useManualPrice: true})}
                                                    placeholder="90000" 
                                                    className="h-12 text-lg font-black text-indigo-600 rounded-2xl bg-white border-indigo-100"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase text-slate-400">Nombre del Sabor</Label>
                                                <Input 
                                                    value={calcData.nombreCaja} 
                                                    onChange={e => setCalcData({...calcData, nombreCaja: e.target.value})}
                                                    placeholder="Ej: Chocolate..." 
                                                    className="h-12 text-base font-bold rounded-2xl bg-white border-slate-200"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {calcData.insumoId && calcData.insumoId !== 'manual' && (
                                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 flex justify-between items-center animate-ag-fade-in">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Precio Promedio de Lista</p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(promedioInsumo)}</p>
                                            <p className="text-[9px] text-slate-400 font-bold">Basado en {preciosInsumo.length} proveedores</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setCalcData({...calcData, useManualPrice: true})} className="text-[10px] uppercase font-black text-indigo-600">
                                            Editar Precio
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

                    {/* STEP 2: EL PRODUCTO FINAL (PRESENTACIÓN) */}
                    {step === 2 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-indigo-500" /> Paso 2: Producto de Venta
                                </h3>
                                <p className="text-xs text-slate-500 font-medium italic">¿Qué vas a vender? (Vaso de 1 bola, Cono, etc.)</p>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Nombre de Venta</Label>
                                    <Input 
                                        value={calcData.nombreProducto} 
                                        onChange={e => setCalcData({...calcData, nombreProducto: e.target.value})}
                                        placeholder="Ej: Vaso de 3 OZ..." 
                                        className="h-12 text-base font-bold rounded-2xl bg-white border-slate-200"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Bolas por envase</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.bolasPorProducto} 
                                            onChange={e => setCalcData({...calcData, bolasPorProducto: e.target.value})}
                                            className="h-12 font-black rounded-2xl bg-white border-slate-200 text-center"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Costo Otros (Vaso/Cuchara)</Label>
                                        <Input 
                                            type="number" 
                                            value={calcData.costoInsumos} 
                                            onChange={e => setCalcData({...calcData, costoInsumos: e.target.value})}
                                            className="h-12 font-black rounded-2xl bg-white border-slate-200 text-center"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Live Result Step 2 */}
                            <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800 flex flex-col gap-1 items-center text-center">
                                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Costo Bruto por Porción</span>
                                <span className="text-3xl font-black text-emerald-600">{formatCurrency(costoFinal)}</span>
                                <p className="text-[10px] text-emerald-500 font-bold mt-1">
                                    ({calcData.bolasPorProducto} x {formatCurrency(costoPorBola)}) + {formatCurrency(insumosNum)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PRECIO Y MARGEN */}
                    {step === 3 && (
                        <div className="space-y-6 animate-ag-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-indigo-500" /> Paso 3: Precio de Venta
                                </h3>
                                <p className="text-xs text-slate-500 font-medium italic">Define cuánto quieres ganar con este producto.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                                        <Percent className="w-3 h-3" /> Margen de Utilidad (%)
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={calcData.margen} 
                                        onChange={e => setCalcData({...calcData, margen: e.target.value})}
                                        className="h-14 text-2xl font-black rounded-2xl bg-white border-slate-200 text-center"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Precio Sugerido</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-white">{formatCurrency(pvpCalculado)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Precio de Venta Final
                                </Label>
                                <Input 
                                    type="number" 
                                    value={calcData.precioVenta} 
                                    onChange={e => setCalcData({...calcData, precioVenta: e.target.value})}
                                    placeholder={pvpCalculado.toFixed(0)}
                                    className="h-16 text-4xl font-black text-emerald-600 rounded-2xl bg-white border-emerald-200 focus:ring-emerald-500 shadow-xl shadow-emerald-100/50"
                                />
                                <p className="text-[10px] text-slate-400 font-medium pl-1 italic">Si lo dejas vacío, se usará el sugerido.</p>
                            </div>

                            {/* Category Selector Quick */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Categoría del Producto</Label>
                                <div className="flex flex-wrap gap-2">
                                    {categorias.filter(c => c.tipo !== 'insumo').slice(0, 6).map(c => (
                                        <button 
                                            key={c.id}
                                            onClick={() => setCalcData({...calcData, categoria: c.nombre})}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                                calcData.categoria === c.nombre 
                                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
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
