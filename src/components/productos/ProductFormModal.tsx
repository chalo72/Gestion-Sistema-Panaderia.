import React from 'react';
import { Plus, Edit2, X, DollarSign, Store, Info, ShoppingCart, Warehouse } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Categoria, Proveedor } from '@/types';

interface ProductFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingProducto: any;
    categorias: Categoria[];
    proveedores: Proveedor[];
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    formatCurrency: (val: number) => string;
}

export function ProductFormModal({
    isOpen, onOpenChange, editingProducto, categorias, proveedores,
    formData, setFormData, onSubmit, formatCurrency
}: ProductFormModalProps) {
    const tipoActual = formData.tipo || 'elaborado';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
                {/* Header */}
                <div className="bg-primary p-6 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            {editingProducto ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">
                                {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
                            </DialogTitle>
                            <DialogDescription className="text-white/70 text-sm">
                                Completa los datos del producto
                            </DialogDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white/60 hover:text-white"
                        onClick={() => onOpenChange(false)}><X className="w-5 h-5" /></Button>
                </div>

                <form onSubmit={onSubmit} className="p-6 space-y-6">
                    {/* Selector de TIPO: Para Venta o Insumo */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de Producto *</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button"
                                onClick={() => setFormData({ ...formData, tipo: 'elaborado' })}
                                className={cn("flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                                    tipoActual === 'elaborado' ? "border-primary bg-orange-50 dark:bg-orange-900/20" : "border-slate-200 dark:border-slate-700 hover:border-orange-300"
                                )}>
                                <div className={cn("p-2 rounded-lg", tipoActual === 'elaborado' ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                                    <ShoppingCart className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-base font-bold">Para Venta</p>
                                    <p className="text-xs text-slate-400">Pan, bebidas, postres, micheladas</p>
                                </div>
                            </button>
                            <button type="button"
                                onClick={() => setFormData({ ...formData, tipo: 'ingrediente' })}
                                className={cn("flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                                    tipoActual === 'ingrediente' ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                                )}>
                                <div className={cn("p-2 rounded-lg", tipoActual === 'ingrediente' ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400")}>
                                    <Warehouse className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-base font-bold">Insumo</p>
                                    <p className="text-xs text-slate-400">Harina, azúcar, huevos, lácteos</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Nombre */}
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Producto *</Label>
                            <Input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Pan Francés, Café Americano, Harina de Trigo..."
                                className="h-12 text-base font-medium rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4" />
                        </div>

                        {/* Categoría */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Categoría *</Label>
                            <Select value={formData.categoria} onValueChange={v => setFormData({ ...formData, categoria: v })}>
                                <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium">
                                    <SelectValue placeholder="Seleccionar categoría..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {categorias.map(c => (
                                        <SelectItem key={c.id} value={c.nombre} className="text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                                {c.nombre}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</Label>
                            <Input value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                placeholder="Descripción breve..."
                                className="h-12 text-sm font-medium rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4" />
                        </div>

                        {/* Precio Venta (solo si es para venta) */}
                        {tipoActual === 'elaborado' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Precio de Venta</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input type="number" step="0.01" value={formData.precioVenta}
                                        onChange={e => setFormData({ ...formData, precioVenta: e.target.value })}
                                        className="h-12 pl-10 text-lg font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                        placeholder="0.00" />
                                </div>
                            </div>
                        )}

                        {/* Margen */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Margen Utilidad (%)</Label>
                            <Input type="number" value={formData.margenUtilidad}
                                onChange={e => setFormData({ ...formData, margenUtilidad: e.target.value })}
                                className="h-12 text-base font-bold text-center rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                placeholder="30" />
                        </div>
                    </div>

                    {/* Proveedor y Costo */}
                    <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Proveedor y Costo</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Proveedor</Label>
                                <Select value={formData.proveedorId} onValueChange={v => setFormData({ ...formData, proveedorId: v })}>
                                    <SelectTrigger className="h-11 rounded-lg bg-white dark:bg-slate-900 text-sm">
                                        <SelectValue placeholder="Seleccionar proveedor..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {proveedores.map(p => <SelectItem key={p.id} value={p.id} className="text-sm">{p.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Precio de Costo</Label>
                                <Input type="number" step="0.01" value={formData.precioCosto}
                                    onChange={e => setFormData({ ...formData, precioCosto: e.target.value })}
                                    className="h-11 text-base font-bold rounded-lg bg-white dark:bg-slate-900" placeholder="0.00" />
                            </div>
                        </div>
                    </div>

                    {/* Imagen */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">URL Imagen (opcional)</Label>
                        <Input value={formData.imagen} onChange={e => setFormData({ ...formData, imagen: e.target.value })}
                            placeholder="https://ejemplo.com/imagen.jpg"
                            className="h-11 text-sm rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4" />
                    </div>

                    {/* PVP Sugerido */}
                    {formData.precioCosto && formData.margenUtilidad && !formData.precioVenta && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border border-emerald-200">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-bold">
                                PVP Sugerido: <span className="text-lg">{formatCurrency(parseFloat(formData.precioCosto) * (1 + parseFloat(formData.margenUtilidad) / 100))}</span>
                            </p>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl text-sm font-semibold"
                            onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" className="h-12 flex-[2] bg-primary hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20">
                            {editingProducto ? 'Guardar Cambios' : 'Crear Producto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
