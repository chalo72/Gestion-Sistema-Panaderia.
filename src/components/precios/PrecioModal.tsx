import React from 'react';
import { DollarSign, X, Package, Store, Info, AlignLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Producto, Proveedor } from '@/types';

interface PrecioModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: Producto[];
    proveedores: Proveedor[];
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEditing: boolean;
}

export function PrecioModal({
    isOpen,
    onOpenChange,
    productos,
    proveedores,
    formData,
    setFormData,
    onSubmit,
    isEditing
}: PrecioModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
                <div className="bg-blue-600 p-8 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                {isEditing ? 'Ajuste de Inteligencia' : 'Registro de Mercado'}
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                Entrada masiva de datos de costos de aliados
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Producto / SKU *</Label>
                            <Select
                                value={formData.productoId}
                                onValueChange={(val) => setFormData({ ...formData, productoId: val })}
                                disabled={isEditing}
                            >
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-gray-800 border-none font-black text-[10px] uppercase tracking-widest">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    {productos.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold uppercase text-[10px] tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-blue-500" />
                                                {p.nombre}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Aliado / Proveedor *</Label>
                            <Select
                                value={formData.proveedorId}
                                onValueChange={(val) => setFormData({ ...formData, proveedorId: val })}
                                disabled={isEditing}
                            >
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-gray-800 border-none font-black text-[10px] uppercase tracking-widest">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    {proveedores.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold uppercase text-[10px] tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Store className="w-4 h-4 text-blue-500" />
                                                {p.nombre}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Precio de Costo de Entrada (€) *</Label>
                        <div className="relative group">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 opacity-50" />
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.precioCosto}
                                onChange={(e) => setFormData({ ...formData, precioCosto: e.target.value })}
                                placeholder="0.00"
                                className="h-16 pl-12 text-2xl font-black bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Contexto / Observaciones</Label>
                        <div className="relative group">
                            <AlignLeft className="absolute left-4 top-4 w-4 h-4 text-slate-400 opacity-50" />
                            <Input
                                value={formData.notas}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Ej: Precio por volumen bajo, promoción temporal..."
                                className="h-14 pl-12 font-bold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <Button type="button" variant="ghost" className="h-16 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-40 hover:opacity-100" onClick={() => onOpenChange(false)}>
                            Descartar
                        </Button>
                        <Button type="submit" className="h-16 flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-600/30 border-none">
                            {isEditing ? 'Actualizar Registro' : 'Inyectar Datos'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
