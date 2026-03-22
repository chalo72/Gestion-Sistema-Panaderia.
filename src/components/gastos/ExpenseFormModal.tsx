import React from 'react';
import { Plus, Camera, X, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import type { Gasto, GastoCategoria, MetodoPago } from '@/types';

interface ExpenseFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    formData: Partial<Gasto>;
    setFormData: (data: Partial<Gasto>) => void;
    onSubmit: () => Promise<void>;
    isScanning?: boolean;
    isSaving?: boolean;
}

export function ExpenseFormModal({
    isOpen,
    onOpenChange,
    formData,
    setFormData,
    onSubmit,
    isScanning,
    isSaving
}: ExpenseFormModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-950">
                <div className="bg-rose-600 p-5 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            {isScanning ? <Camera className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                {isScanning ? 'Confirmar Escaneo' : 'Nuevo Egreso'}
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                {isScanning ? 'Datos extraídos por IA' : 'Ingrese los detalles de la transacción'}
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

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 md:col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Descripción del Gasto</Label>
                            <Input
                                value={formData.descripcion || ''}
                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                placeholder="Ej: Pago de Luz local, Harina 50kg..."
                                className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 px-3"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Monto Total</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                                <Input
                                    type="number"
                                    value={formData.monto || ''}
                                    onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) })}
                                    className="h-10 pl-9 rounded-xl border border-slate-200 dark:border-slate-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Categoría</Label>
                            <Select
                                value={formData.categoria}
                                onValueChange={(val) => setFormData({ ...formData, categoria: val as GastoCategoria })}
                            >
                                <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <SelectValue placeholder="Otros" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                    <SelectItem value="Servicios">Servicios</SelectItem>
                                    <SelectItem value="Arriendo">Arriendo</SelectItem>
                                    <SelectItem value="Nómina">Nómina</SelectItem>
                                    <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                                    <SelectItem value="Otros">Otros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Fecha</Label>
                            <Input
                                type="date"
                                value={formData.fecha?.split('T')[0] || ''}
                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                className="h-10 rounded-xl border border-slate-200 dark:border-slate-700"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Método de Pago</Label>
                            <Select
                                value={formData.metodoPago}
                                onValueChange={(val) => setFormData({ ...formData, metodoPago: val as MetodoPago })}
                            >
                                <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <SelectValue placeholder="Efectivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">Efectivo</SelectItem>
                                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <Button
                            variant="ghost"
                            className="h-10 flex-1 rounded-xl font-bold text-sm"
                            onClick={() => onOpenChange(false)}
                        >
                            Descartar
                        </Button>
                        <Button
                            disabled={isSaving}
                            onClick={onSubmit}
                            className="h-10 flex-[2] bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Egreso'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
