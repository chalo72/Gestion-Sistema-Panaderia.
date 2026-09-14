import { 
  Plus, 
  X, 
  DollarSign, 
  Store, 
  Fingerprint, 
  AlignLeft, 
  ShieldCheck, 
  Target,
  FileText,
  Activity
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Proveedor } from '@/types';

interface PrePedidoModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    nuevoPedido: any;
    setNuevoPedido: (val: any) => void;
    proveedores: Proveedor[];
    onSubmit: (e: React.FormEvent) => void;
}

export function PrePedidoModal({
    isOpen,
    onOpenChange,
    nuevoPedido,
    setNuevoPedido,
    proveedores,
    onSubmit
}: PrePedidoModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl rounded-[1.5rem] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl animate-ag-scale-in outline-none">
                {/* Header Refinado Nexus */}
                <div className="bg-slate-950 p-7 text-white relative overflow-hidden border-b border-white/5">
                    {/* Subtle Gradient Accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
                    
                    <div className="relative flex items-center gap-4">
                        <div className="flex items-center justify-center p-3.5 bg-white/5 rounded-xl backdrop-blur-xl border border-white/10 shadow-lg group">
                            <Plus className="w-6 h-6 text-indigo-400 group-hover:rotate-90 transition-transform duration-300" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-bold uppercase tracking-tight leading-none">
                                Crear Nuevo Pedido
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.3em] flex items-center gap-2">
                                <Activity className="w-3 h-3 text-indigo-500" /> Paso 1: Datos principales
                            </DialogDescription>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-6 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <form onSubmit={onSubmit} className="p-7 space-y-6">
                    {/* Input Nombre Pedido */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 px-1">
                            <Target className="w-3.5 h-3.5 text-indigo-500" /> ¿Cómo se llama este pedido? *
                        </Label>
                        <div className="relative group">
                            <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                value={nuevoPedido.nombre}
                                onChange={(e) => setNuevoPedido({ ...nuevoPedido, nombre: e.target.value })}
                                placeholder="Ej: Pedido de Harina o Compra de Hoy"
                                className="h-12 pl-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-semibold text-slate-900 dark:text-white text-sm"
                            />
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium px-1 italic leading-tight">Pon un nombre fácil para recordar este pedido.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Selector de Proveedor */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 px-1">
                                <Store className="w-3.5 h-3.5 text-indigo-500" /> Elegir el Proveedor *
                            </Label>
                            <Select
                                value={nuevoPedido.proveedorId}
                                onValueChange={(val) => setNuevoPedido({ ...nuevoPedido, proveedorId: val })}
                            >
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-4 font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 text-sm">
                                    <SelectValue placeholder="Elegir quién te vende..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1 shadow-2xl">
                                    {proveedores.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="py-2.5 px-3 font-semibold uppercase text-[10px] tracking-wider rounded-lg focus:bg-indigo-600 focus:text-white cursor-pointer mb-0.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-focus:bg-white/20">
                                                    <Store className="w-3.5 h-3.5 text-indigo-500" />
                                                </div>
                                                {p.nombre}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[9px] text-slate-400 font-medium px-1 italic leading-tight">Selecciona a quién vas a comprarle.</p>
                        </div>

                        {/* Input Presupuesto */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 px-1">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Presupuesto (¿Cuánto vas a gastar?)
                            </Label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={nuevoPedido.presupuestoMaximo}
                                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, presupuestoMaximo: parseFloat(e.target.value) || 0 })}
                                    className="h-12 pl-9 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all font-bold text-slate-900 dark:text-white tabular-nums text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium px-1 italic leading-tight">Opcional. Te avisaremos si te pasas de este monto.</p>
                        </div>
                    </div>

                    {/* Notas / Bitácora */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 px-1">
                            <AlignLeft className="w-3.5 h-3.5 text-indigo-500" /> Notas o Recordatorios
                        </Label>
                        <div className="relative group">
                            <FileText className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <textarea
                                value={nuevoPedido.notas}
                                onChange={(e) => setNuevoPedido({ ...nuevoPedido, notas: e.target.value })}
                                placeholder="Ej: Pedir que traigan el bulto más grande..."
                                className="w-full min-h-[90px] pl-10 pt-3 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 text-sm resize-none outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            className="h-12 flex-1 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" 
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            className="h-12 flex-[1.5] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <ShieldCheck className="w-4 h-4" /> Empezar este Pedido
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
