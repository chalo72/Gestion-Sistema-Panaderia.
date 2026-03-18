import React from 'react';
import { ShoppingCart, Plus, X, DollarSign, Store, Info, AlignLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
            <DialogContent className="max-w-xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
                <div className="bg-indigo-600 p-8 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                Plan Maestro de Compra
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                Definición estratégica de aprovisionamiento
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-6 top-6 text-white/40 hover:text-white"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                <form onSubmit={onSubmit} className="p-10 space-y-8">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Campaña / Nombre del Pedido *</Label>
                        <div className="relative group">
                            <Info className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 opacity-50 group-focus-within:opacity-100" />
                            <Input
                                value={nuevoPedido.nombre}
                                onChange={(e) => setNuevoPedido({ ...nuevoPedido, nombre: e.target.value })}
                                placeholder="Ej: Reabastecimiento Crítico Febrero"
                                className="h-16 pl-12 text-lg font-black bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner uppercase tracking-tight"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Aliado / Proveedor *</Label>
                            <Select
                                value={nuevoPedido.proveedorId}
                                onValueChange={(val) => setNuevoPedido({ ...nuevoPedido, proveedorId: val })}
                            >
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-gray-800 border-none font-black text-[10px] uppercase tracking-widest">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    {proveedores.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold uppercase text-[10px] tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Store className="w-4 h-4 text-indigo-500" />
                                                {p.nombre}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Presupuesto Límite (€) *</Label>
                            <div className="relative group">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 opacity-50" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={nuevoPedido.presupuestoMaximo}
                                    onChange={(e) => setNuevoPedido({ ...nuevoPedido, presupuestoMaximo: e.target.value })}
                                    className="h-14 pl-12 text-xl font-black bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Bitácora / Notas de Gestión</Label>
                        <div className="relative group">
                            <AlignLeft className="absolute left-4 top-4 w-4 h-4 text-slate-400 opacity-50 group-focus-within:opacity-100" />
                            <Input
                                value={nuevoPedido.notas}
                                onChange={(e) => setNuevoPedido({ ...nuevoPedido, notas: e.target.value })}
                                placeholder="Detalles sobre envíos, plazos, condiciones..."
                                className="h-14 pl-12 font-bold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <Button type="button" variant="ghost" className="h-16 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-40 hover:opacity-100" onClick={() => onOpenChange(false)}>
                            Abstenerse
                        </Button>
                        <Button type="submit" className="h-16 flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/30 border-none">
                            Inicializar Plan
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
