import React, { useState, useEffect } from 'react';
import {
    Plus, Edit2, X, DollarSign, Store, Info,
    ShoppingCart, Warehouse, Check, Percent,
    Package, ImageIcon, Tag, TrendingUp,
    AlertCircle, CheckCircle2
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Categoria, Proveedor } from '@/types';

const COLORES_RAPIDOS = [
    '#f97316', '#3b82f6', '#10b981', '#8b5cf6',
    '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
    '#84cc16', '#6366f1',
];

const UNIDADES = [
    { value: 'unidad',  label: 'Unidad' },
    { value: 'kg',      label: 'Kilogramo (kg)' },
    { value: 'g',       label: 'Gramo (g)' },
    { value: 'lt',      label: 'Litro (lt)' },
    { value: 'ml',      label: 'Mililitro (ml)' },
    { value: 'lb',      label: 'Libra (lb)' },
    { value: 'arroba',  label: 'Arroba' },
    { value: 'docena',  label: 'Docena' },
    { value: 'caja',    label: 'Caja' },
    { value: 'bolsa',   label: 'Bolsa' },
];

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
    onAddCategoria?: (nombre: string, color: string) => Promise<Categoria>;
}

export function ProductFormModal({
    isOpen, onOpenChange, editingProducto, categorias, proveedores,
    formData, setFormData, onSubmit, formatCurrency, onAddCategoria
}: ProductFormModalProps) {
    const tipoActual = formData.tipo || 'elaborado';

    // Estado mini-formulario de nueva categoría inline
    const [showNueva,    setShowNueva]    = useState(false);
    const [miniNombre,   setMiniNombre]   = useState('');
    const [miniColor,    setMiniColor]    = useState(COLORES_RAPIDOS[0]);
    const [guardandoCat, setGuardandoCat] = useState(false);

    // Preview de imagen
    const [imgError, setImgError] = useState(false);
    useEffect(() => { setImgError(false); }, [formData.imagen]);

    // Cálculos de rentabilidad
    const costo       = parseFloat(formData.precioCosto)    || 0;
    const margen      = parseFloat(formData.margenUtilidad) || 0;
    const pvpManual   = parseFloat(formData.precioVenta)    || 0;
    const pvpSugerido = costo > 0 && margen > 0 ? costo * (1 + margen / 100) : null;
    const margenReal  = pvpManual > 0 && costo > 0
        ? ((pvpManual - costo) / costo) * 100
        : null;

    const imagenUrl      = formData.imagen?.trim();
    const mostrarPreview = imagenUrl && imagenUrl.startsWith('http') && !imgError;

    const handleCrearCategoria = async () => {
        if (!miniNombre.trim() || !onAddCategoria) return;
        setGuardandoCat(true);
        try {
            await onAddCategoria(miniNombre.trim(), miniColor);
            setFormData({ ...formData, categoria: miniNombre.trim() });
            setMiniNombre('');
            setMiniColor(COLORES_RAPIDOS[0]);
            setShowNueva(false);
        } finally {
            setGuardandoCat(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">

                {/* ── HEADER con color dinámico por tipo ── */}
                <div className={cn(
                    "p-6 text-white relative",
                    tipoActual === 'elaborado'
                        ? "bg-gradient-to-r from-orange-500 to-orange-600"
                        : "bg-gradient-to-r from-blue-500 to-blue-600"
                )}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                            {editingProducto ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black">
                                {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
                            </DialogTitle>
                            <DialogDescription className="text-white/70 text-xs font-semibold uppercase tracking-wider mt-0.5">
                                {tipoActual === 'elaborado' ? 'Producto para venta' : 'Insumo / Materia prima'}
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost" size="icon"
                        className="absolute right-4 top-4 text-white/60 hover:text-white hover:bg-white/10"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={onSubmit} className="p-6 space-y-6">

                    {/* ── TIPO ── */}
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Tipo de Producto <span className="text-red-400">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Para Venta */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, tipo: 'elaborado' })}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
                                    tipoActual === 'elaborado'
                                        ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 shadow-sm"
                                        : "border-slate-200 dark:border-slate-700 hover:border-orange-300 hover:bg-orange-50/50"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg transition-all",
                                    tipoActual === 'elaborado'
                                        ? "bg-orange-500 text-white"
                                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500"
                                )}>
                                    <ShoppingCart className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-bold", tipoActual === 'elaborado' ? "text-orange-700 dark:text-orange-400" : "text-slate-700 dark:text-slate-300")}>
                                        Para Venta
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">Pan, bebidas, postres</p>
                                </div>
                                {tipoActual === 'elaborado' && <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                            </button>

                            {/* Insumo */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, tipo: 'ingrediente' })}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
                                    tipoActual === 'ingrediente'
                                        ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                        : "border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg transition-all",
                                    tipoActual === 'ingrediente'
                                        ? "bg-blue-500 text-white"
                                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500"
                                )}>
                                    <Warehouse className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-bold", tipoActual === 'ingrediente' ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300")}>
                                        Insumo
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">Harina, azúcar, huevos</p>
                                </div>
                                {tipoActual === 'ingrediente' && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                            </button>
                        </div>
                    </div>

                    {/* ── INFORMACIÓN BÁSICA ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Información Básica</span>
                        </div>

                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Nombre del Producto <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Pan Francés, Café Americano, Harina de Trigo..."
                                required
                                className="h-12 text-base font-medium rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Categoría */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Categoría <span className="text-red-400">*</span>
                                    </Label>
                                    {onAddCategoria && (
                                        <button
                                            type="button"
                                            onClick={() => setShowNueva(v => !v)}
                                            className={cn(
                                                "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all",
                                                showNueva
                                                    ? "bg-slate-200 text-slate-600 dark:bg-slate-700"
                                                    : "text-primary hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                            )}
                                        >
                                            <Plus className="w-3 h-3" /> Nueva
                                        </button>
                                    )}
                                </div>

                                <Select value={formData.categoria} onValueChange={v => setFormData({ ...formData, categoria: v })}>
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium">
                                        <SelectValue placeholder="Seleccionar categoría..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {/* Si la categoría guardada no existe en la lista, mostrarla como opción para que sea visible */}
                                        {formData.categoria && !categorias.find(c => c.nombre === formData.categoria) && (
                                            <SelectItem value={formData.categoria} className="text-sm text-amber-600 font-bold">
                                                <div className="flex items-center gap-2">
                                                    <span>⚠️</span>
                                                    {formData.categoria} (sin registrar — cambia aquí)
                                                </div>
                                            </SelectItem>
                                        )}
                                        {categorias.map(c => (
                                            <SelectItem key={c.id} value={c.nombre} className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                                                    {c.nombre}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {/* Aviso si la categoría no está registrada en el sistema */}
                                {formData.categoria && !categorias.find(c => c.nombre === formData.categoria) && (
                                    <p className="text-xs text-amber-600 font-semibold mt-1 pl-1">
                                        ⚠️ Categoría "{formData.categoria}" no está registrada. Selecciona una de la lista.
                                    </p>
                                )}

                                {/* Mini-formulario inline para nueva categoría */}
                                {showNueva && (
                                    <div className="mt-2 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-orange-50/50 dark:bg-orange-900/10 space-y-3 animate-ag-fade-in">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Nueva Categoría</p>
                                        <Input
                                            value={miniNombre}
                                            onChange={e => setMiniNombre(e.target.value)}
                                            placeholder="Ej: Repostería Fina"
                                            className="h-10 text-sm font-bold rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCrearCategoria(); } }}
                                            autoFocus
                                        />
                                        <div className="flex gap-2 flex-wrap">
                                            {COLORES_RAPIDOS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setMiniColor(color)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-lg transition-all",
                                                        miniColor === color ? "ring-2 ring-offset-1 ring-slate-700 scale-110" : "hover:scale-105"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button" size="sm"
                                                onClick={handleCrearCategoria}
                                                disabled={!miniNombre.trim() || guardandoCat}
                                                className="flex-1 h-9 bg-primary hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" />
                                                {guardandoCat ? 'Creando...' : 'Crear y Seleccionar'}
                                            </Button>
                                            <Button
                                                type="button" size="sm" variant="outline"
                                                onClick={() => setShowNueva(false)}
                                                className="h-9 rounded-lg text-xs"
                                            >
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Unidad de medida */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Unidad de Medida</Label>
                                <Select
                                    value={formData.unidadMedida || 'unidad'}
                                    onValueChange={v => setFormData({ ...formData, unidadMedida: v })}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium">
                                        <SelectValue placeholder="Unidad..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {UNIDADES.map(u => (
                                            <SelectItem key={u.value} value={u.value} className="text-sm">
                                                {u.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Descripción como Textarea */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</Label>
                            <Textarea
                                value={formData.descripcion}
                                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                placeholder="Descripción del producto, ingredientes destacados, presentación..."
                                rows={2}
                                className="text-sm rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
                            />
                        </div>
                    </div>

                    {/* ── PROVEEDOR Y COSTO ── */}
                    <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Proveedor y Costo</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Proveedor */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500">Proveedor</Label>
                                <Select value={formData.proveedorId} onValueChange={v => setFormData({ ...formData, proveedorId: v })}>
                                    <SelectTrigger className="h-11 rounded-lg bg-white dark:bg-slate-900 text-sm border-slate-200 dark:border-slate-700">
                                        <SelectValue placeholder="Sin proveedor..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {proveedores.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="text-sm">{p.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Precio de costo con ícono $ */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500">Precio de Costo</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="number" step="0.01" min="0"
                                        value={formData.precioCosto}
                                        onChange={e => setFormData({ ...formData, precioCosto: e.target.value })}
                                        className="h-11 pl-9 text-base font-bold rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── PRECIO DE VENTA Y MARGEN (solo Para Venta) ── */}
                    {tipoActual === 'elaborado' && (
                        <div className="p-5 rounded-xl bg-orange-50/60 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 space-y-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Precio de Venta y Margen</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Precio de Venta */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio de Venta</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                        <Input
                                            type="number" step="0.01" min="0"
                                            value={formData.precioVenta}
                                            onChange={e => setFormData({ ...formData, precioVenta: e.target.value })}
                                            className="h-12 pl-9 text-lg font-bold rounded-xl border-orange-200 dark:border-orange-800/40 bg-white dark:bg-slate-900 focus:border-orange-400"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Margen con ícono % */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Margen Utilidad</Label>
                                    <div className="relative">
                                        <Input
                                            type="number" min="0" max="999"
                                            value={formData.margenUtilidad}
                                            onChange={e => setFormData({ ...formData, margenUtilidad: e.target.value })}
                                            className="h-12 pr-9 text-base font-bold text-center rounded-xl border-orange-200 dark:border-orange-800/40 bg-white dark:bg-slate-900 focus:border-orange-400"
                                            placeholder="30"
                                        />
                                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Panel de rentabilidad */}
                            {costo > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {pvpSugerido && (
                                        <div className={cn(
                                            "flex items-start gap-2 p-3 rounded-xl border text-sm",
                                            pvpManual > 0 && pvpManual >= pvpSugerido
                                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
                                                : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400"
                                        )}>
                                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-[10px] uppercase tracking-wide">PVP Sugerido</p>
                                                <p className="text-base font-black">{formatCurrency(pvpSugerido)}</p>
                                                <p className="text-[10px] opacity-70">con {margen}% de margen</p>
                                            </div>
                                        </div>
                                    )}
                                    {margenReal !== null && (
                                        <div className={cn(
                                            "flex items-start gap-2 p-3 rounded-xl border text-sm",
                                            margenReal >= 20
                                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
                                                : margenReal >= 10
                                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400"
                                                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
                                        )}>
                                            {margenReal >= 10
                                                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            }
                                            <div>
                                                <p className="font-semibold text-[10px] uppercase tracking-wide">Margen Real</p>
                                                <p className="text-base font-black">{margenReal.toFixed(1)}%</p>
                                                <p className="text-[10px] opacity-70">
                                                    {margenReal >= 20 ? 'Rentable' : margenReal >= 10 ? 'Bajo' : 'Riesgo'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STOCK MÍNIMO (solo Insumos) ── */}
                    {tipoActual === 'ingrediente' && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Stock Mínimo de Alerta</Label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="number" min="0" step="0.01"
                                    value={formData.stockMinimo || ''}
                                    onChange={e => setFormData({ ...formData, stockMinimo: e.target.value })}
                                    className="h-11 pl-9 text-base font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    placeholder="Ej: 5"
                                />
                            </div>
                            <p className="text-xs text-slate-400 pl-1">Se activará una alerta cuando el stock baje de este valor.</p>
                        </div>
                    )}

                    {/* ── IMAGEN CON PREVIEW ── */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Imagen del Producto</Label>
                            <Badge variant="outline" className="text-[10px] font-bold ml-auto">Opcional</Badge>
                        </div>
                        <Input
                            value={formData.imagen}
                            onChange={e => setFormData({ ...formData, imagen: e.target.value })}
                            placeholder="https://ejemplo.com/imagen.jpg"
                            className="h-11 text-sm rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4"
                        />
                        {imagenUrl && (
                            mostrarPreview ? (
                                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <img
                                        src={imagenUrl}
                                        alt="Preview"
                                        className="w-16 h-16 object-cover rounded-xl shadow"
                                        onError={() => setImgError(true)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Vista previa</p>
                                        <p className="text-xs text-slate-400 truncate">{imagenUrl}</p>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 text-red-600">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <p className="text-xs font-medium">URL inválida o imagen no disponible.</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* ── BOTONES ── */}
                    <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            type="button" variant="outline"
                            className="h-12 flex-1 rounded-xl text-sm font-semibold border-slate-200 dark:border-slate-700"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className={cn(
                                "h-12 flex-[2] text-white rounded-xl text-sm font-black shadow-lg",
                                tipoActual === 'elaborado'
                                    ? "bg-orange-500 hover:bg-orange-600 shadow-orange-200"
                                    : "bg-blue-500 hover:bg-blue-600 shadow-blue-200"
                            )}
                        >
                            {editingProducto ? '✓ Guardar Cambios' : '+ Crear Producto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
