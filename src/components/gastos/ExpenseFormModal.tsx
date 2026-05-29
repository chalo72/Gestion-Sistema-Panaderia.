import React, { useEffect } from 'react';
import {
    TrendingDown, TrendingUp, Camera, X, DollarSign, Loader2,
    Banknote, CreditCard, Building2, Smartphone, Pencil
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Gasto, GastoCategoria, MetodoPago, Proveedor } from '@/types';

// ── Métodos de pago visuales ──────────────────────────────────────────────────
const METODOS = [
    { value: 'efectivo',      label: 'Efectivo',       icon: Banknote,   cls: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' },
    { value: 'tarjeta',       label: 'Datáfono',        icon: CreditCard, cls: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' },
    { value: 'transferencia', label: 'Transferencia',   icon: Building2,  cls: 'border-violet-300 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300' },
    { value: 'nequi',         label: 'Nequi',           icon: Smartphone, cls: 'border-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300' },
    { value: 'daviplata',     label: 'Daviplata',       icon: Smartphone, cls: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300' },
];

// ── Categorías ────────────────────────────────────────────────────────────────
const CATS_GASTO = ['Materia Prima', 'Servicios', 'Arriendo', 'Nómina', 'Mantenimiento', 'Otros'];
const CATS_INGRESO = ['Venta', 'Anticipo', 'Préstamo recibido', 'Aporte socio', 'Otro ingreso'];

interface ExpenseFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    formData: Partial<Gasto & { esIngreso?: boolean }>;
    setFormData: (data: Partial<Gasto & { esIngreso?: boolean }>) => void;
    onSubmit: () => Promise<void>;
    isScanning?: boolean;
    isSaving?: boolean;
    isEditMode?: boolean;
    proveedores?: Proveedor[];
}

export function ExpenseFormModal({
    isOpen,
    onOpenChange,
    formData,
    setFormData,
    onSubmit,
    isScanning,
    isSaving,
    isEditMode = false,
    proveedores = [],
}: ExpenseFormModalProps) {
    const esIngreso = !!formData.esIngreso;
    const cats = esIngreso ? CATS_INGRESO : CATS_GASTO;

    // Cuando cambia el modo Ingreso/Gasto, resetear la categoría si no aplica
    useEffect(() => {
        if (formData.categoria && !cats.includes(formData.categoria)) {
            setFormData({ ...formData, categoria: (cats[0] as GastoCategoria) });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [esIngreso]);

    const accentColor = esIngreso ? 'emerald' : 'rose';
    const headerCls   = esIngreso
        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
        : 'bg-gradient-to-r from-rose-600 to-rose-500';

    const metodoActivo = METODOS.find(m => m.value === formData.metodoPago) ?? METODOS[0];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-950">
                {/* Header con color según modo */}
                <div className={cn('p-5 text-white relative', headerCls)}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            {isScanning
                                ? <Camera className="w-6 h-6" />
                                : isEditMode
                                    ? <Pencil className="w-6 h-6" />
                                    : esIngreso
                                        ? <TrendingUp className="w-6 h-6" />
                                        : <TrendingDown className="w-6 h-6" />
                            }
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                {isScanning
                                    ? 'Confirmar Escaneo'
                                    : isEditMode
                                        ? 'Editar Registro'
                                        : esIngreso
                                            ? 'Nuevo Ingreso'
                                            : 'Nuevo Egreso'
                                }
                            </DialogTitle>
                            <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest">
                                {isScanning
                                    ? 'Datos extraídos por IA — verifica antes de confirmar'
                                    : isEditMode
                                        ? 'Modifica los datos del registro'
                                        : 'Ingresa los detalles de la transacción'
                                }
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 text-white/40 hover:text-white hover:bg-white/10 rounded-xl"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Toggle Gasto / Ingreso (solo en modo nuevo, no en edición ni escaneo) */}
                    {!isEditMode && !isScanning && (
                        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <button
                                onClick={() => setFormData({ ...formData, esIngreso: false, categoria: 'Otros' as GastoCategoria })}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all',
                                    !esIngreso
                                        ? 'bg-rose-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                )}
                            >
                                <TrendingDown className="w-4 h-4" />
                                Egreso
                            </button>
                            <button
                                onClick={() => setFormData({ ...formData, esIngreso: true, categoria: 'Venta' as GastoCategoria })}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all',
                                    esIngreso
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                )}
                            >
                                <TrendingUp className="w-4 h-4" />
                                Ingreso
                            </button>
                        </div>
                    )}

                    {/* Descripción */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción</Label>
                        <Input
                            value={formData.descripcion || ''}
                            onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                            placeholder={esIngreso ? 'Ej: Ventas del día, Abono cliente...' : 'Ej: Pago de luz, Harina 50kg...'}
                            className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 font-bold"
                        />
                    </div>

                    {/* Monto + Fecha */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monto</Label>
                            <div className="relative">
                                <DollarSign className={cn(
                                    'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4',
                                    esIngreso ? 'text-emerald-500' : 'text-rose-500'
                                )} />
                                <Input
                                    type="number"
                                    value={formData.monto || ''}
                                    onChange={e => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
                                    className="h-11 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 font-black tabular-nums text-base"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha</Label>
                            <Input
                                type="date"
                                value={formData.fecha?.split('T')[0] || ''}
                                onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                                className="h-11 rounded-xl border border-slate-200 dark:border-slate-700"
                            />
                        </div>
                    </div>

                    {/* Categoría */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoría</Label>
                        <Select
                            value={formData.categoria}
                            onValueChange={val => setFormData({ ...formData, categoria: val as GastoCategoria })}
                        >
                            <SelectTrigger className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                                <SelectValue placeholder={cats[0]} />
                            </SelectTrigger>
                            <SelectContent>
                                {cats.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Proveedor (solo egresos) */}
                    {!esIngreso && proveedores.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Proveedor (opcional)</Label>
                            <Select
                                value={formData.proveedorId ?? '__ninguno__'}
                                onValueChange={val => setFormData({ ...formData, proveedorId: val === '__ninguno__' ? undefined : val })}
                            >
                                <SelectTrigger className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                                    <SelectValue placeholder="Sin proveedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__ninguno__">Sin proveedor</SelectItem>
                                    {proveedores.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Método de pago — botones visuales */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Método de pago</Label>
                        <div className="flex flex-wrap gap-2">
                            {METODOS.map(m => {
                                const Icon = m.icon;
                                const activo = formData.metodoPago === m.value;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, metodoPago: m.value as MetodoPago })}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all',
                                            activo ? m.cls : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                                        )}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="ghost"
                            className="h-11 flex-1 rounded-xl font-bold text-sm"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            disabled={isSaving}
                            onClick={onSubmit}
                            className={cn(
                                'h-11 flex-[2] text-white rounded-xl font-black text-sm',
                                esIngreso ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                            )}
                        >
                            {isSaving
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : isEditMode
                                    ? 'Guardar cambios'
                                    : esIngreso
                                        ? 'Confirmar Ingreso'
                                        : 'Confirmar Egreso'
                            }
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
