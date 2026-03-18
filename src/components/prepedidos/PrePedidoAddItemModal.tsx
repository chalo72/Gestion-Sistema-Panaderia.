import React, { useState } from 'react';
import { Package, Plus, Minus, X, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
                <div className="bg-slate-900 p-8 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Vincular Producto</DialogTitle>
                            <p className="text-white/40 font-bold text-[10px] uppercase tracking-widest mt-1">Selecciona ítems del catálogo del aliado</p>
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

                <div className="p-10 space-y-8">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Catálogo de Ofertas del Proveedor</Label>
                        <ScrollArea className="h-64 border rounded-[2rem] bg-slate-50 dark:bg-gray-900/50 p-2 border-slate-100 dark:border-gray-800 shadow-inner">
                            <div className="space-y-2 p-2">
                                {productosDisponibles.length === 0 ? (
                                    <div className="py-20 text-center opacity-20">
                                        <Info className="w-12 h-12 mx-auto mb-2" />
                                        <p className="font-black uppercase text-[10px] tracking-widest">Sin productos vinculados</p>
                                    </div>
                                ) : (
                                    productosDisponibles.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedProductoId(p.id)}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                                                selectedProductoId === p.id
                                                    ? "bg-indigo-600 text-white border-indigo-500 shadow-xl scale-[1.02]"
                                                    : "bg-white dark:bg-gray-800/40 border-transparent hover:border-indigo-200 dark:hover:border-indigo-900"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs", selectedProductoId === p.id ? "bg-white/20" : "bg-slate-100 dark:bg-gray-700")}>
                                                    {p.nombre.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black uppercase text-xs tracking-tighter">{p.nombre}</p>
                                                    <p className={cn("text-[8px] font-bold uppercase tracking-widest", selectedProductoId === p.id ? "text-white/60" : "text-muted-foreground")}>{p.categoria}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("font-black text-sm tabular-nums", selectedProductoId === p.id ? "text-white" : "text-indigo-600")}>{formatCurrency(p.precioCosto)}</p>
                                                <p className={cn("text-[8px] font-black uppercase", selectedProductoId === p.id ? "text-white/40" : "text-muted-foreground/40")}>p.u.</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {selectedProductoId && (
                        <div className="animate-ag-slide-up space-y-8">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                                <div className="space-y-4 w-full md:w-auto">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Volumen de Compra</Label>
                                    <div className="flex items-center bg-white dark:bg-gray-950 p-2 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/20 shadow-sm">
                                        <Button
                                            disabled={cantidad <= 1}
                                            onClick={() => setCantidad(cantidad - 1)}
                                            variant="ghost"
                                            className="h-12 w-12 rounded-xl text-indigo-600"
                                        >
                                            <Minus className="w-5 h-5" />
                                        </Button>
                                        <Input
                                            type="number"
                                            value={cantidad}
                                            onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                                            className="h-12 w-20 text-center font-black text-xl bg-transparent border-none shadow-none"
                                        />
                                        <Button
                                            onClick={() => setCantidad(cantidad + 1)}
                                            variant="ghost"
                                            className="h-12 w-12 rounded-xl text-indigo-600"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600/40 mb-1">Impacto Bruto</p>
                                    <p className="text-4xl font-black text-indigo-600 tabular-nums tracking-tighter">
                                        {formatCurrency((selectedProducto?.precioCosto || 0) * cantidad)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button variant="ghost" className="h-16 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest opacity-40" onClick={() => onOpenChange(false)}>Descartar</Button>
                                <Button onClick={onAdd} className="h-16 flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-600/30 border-none">
                                    Confirmar Inserción
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
