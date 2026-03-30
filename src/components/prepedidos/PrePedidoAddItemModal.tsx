import { Package, Plus, Minus, X, Zap, Calculator, Activity, LayoutGrid, DollarSign, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Producto } from '@/types';

interface PrePedidoAddItemModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productosDisponibles: (Producto & { precioCosto: number })[];
    selectedProductoId: string;
    setSelectedProductoId: (id: string) => void;
    cantidad: number;
    setCantidad: (c: number) => void;
    onAdd: () => void;
    formatCurrency: (val: number) => string;
}

export function PrePedidoAddItemModal({
    isOpen,
    onOpenChange,
    productosDisponibles,
    selectedProductoId,
    setSelectedProductoId,
    cantidad,
    setCantidad,
    onAdd,
    formatCurrency
}: PrePedidoAddItemModalProps) {
    const selectedProducto = productosDisponibles.find(p => p.id === selectedProductoId);

    const setToggleAmount = (val: number) => {
        const newCant = Math.max(1, cantidad + val);
        setCantidad(newCant);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-[1.5rem] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl animate-ag-scale-in outline-none">
                {/* Header Refinado Nexus */}
                <div className="bg-slate-950 p-8 text-white relative overflow-hidden border-b border-white/5">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
                    
                    <div className="relative flex items-center gap-5">
                        <div className="flex items-center justify-center p-4 bg-white/5 rounded-xl backdrop-blur-xl border border-white/10 shadow-lg">
                            <Package className="w-7 h-7 text-cyan-400" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-2xl font-bold uppercase tracking-tight leading-none">
                                Lista de Productos Disponibles
                            </DialogTitle>
                            <p className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.3em] flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-500" /> Selecciona los productos para esta orden
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-8 space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" /> Ofertas Vinculadas al Alíado
                            </Label>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 tabular-nums">{productosDisponibles.length} Skus Detectados</span>
                        </div>
                        
                        <ScrollArea className="h-[320px] border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-black/20 p-4 shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {productosDisponibles.length === 0 ? (
                                    <div className="col-span-full py-20 text-center opacity-30 select-none">
                                        <Zap className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-20" />
                                        <h4 className="font-bold uppercase text-xs tracking-[0.2em]">Sin Registros</h4>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1">No hay ítems en este canal</p>
                                    </div>
                                ) : (
                                    productosDisponibles.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProductoId(p.id);
                                                if (cantidad < 1) setCantidad(1);
                                            }}
                                            className={cn(
                                                "group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 border relative overflow-hidden",
                                                selectedProductoId === p.id
                                                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg scale-[1.01]"
                                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-400/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner", selectedProductoId === p.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800")}>
                                                {p.nombre.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold uppercase text-[11px] leading-tight tracking-tight truncate">{p.nombre}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className={cn("text-[8px] font-bold uppercase tracking-widest opacity-60", selectedProductoId === p.id ? "text-indigo-100" : "text-slate-400")}>
                                                        {p.categoria}
                                                    </span>
                                                    <span className={cn("text-[10px] font-bold tabular-nums", selectedProductoId === p.id ? "text-white" : "text-indigo-500")}>
                                                        {formatCurrency(p.precioCosto)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {selectedProductoId && (
                        <div className="animate-ag-slide-up space-y-6 pt-2">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 relative overflow-hidden group/panel">
                                <Calculator className="absolute -bottom-6 -right-6 w-24 h-24 text-slate-500/5 group-hover/panel:text-indigo-500/10 transition-colors duration-700" />
                                
                                <div className="space-y-2 w-full md:w-auto z-10">
                                    <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Volumen de Suministro</Label>
                                    <div className="flex items-center bg-white dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <Button
                                            disabled={cantidad <= 1}
                                            onClick={() => setToggleAmount(-1)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-slate-500 hover:text-indigo-500"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={cantidad === 0 ? '' : cantidad}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                setCantidad(val);
                                            }}
                                            className="h-10 w-16 text-center font-bold text-lg bg-transparent border-none shadow-none text-slate-900 dark:text-white tabular-nums"
                                        />
                                        <Button
                                            onClick={() => setToggleAmount(1)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-slate-500 hover:text-indigo-500"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="text-right z-10">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center justify-end gap-1.5">
                                        <DollarSign className="w-3 h-3 text-emerald-500" /> Impacto Bruto
                                    </p>
                                    <p className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                        {formatCurrency((selectedProducto?.precioCosto || 0) * cantidad)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button 
                                    variant="ghost" 
                                    className="h-12 flex-1 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" 
                                    onClick={() => onOpenChange(false)}
                                >
                                    Descartar
                                </Button>
                                <Button 
                                    onClick={onAdd} 
                                    className="h-12 flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Confirmar Vinculación
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
