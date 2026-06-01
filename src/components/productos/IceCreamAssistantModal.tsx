import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check, X, Pencil, Trash2, Plus, TrendingUp, TrendingDown, AlertTriangle, Target, Minus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ExtraCopa {
    productoId: string;
    nombre: string;
    costo: number;
}

interface PerfilCopa {
    id: string;
    label: string;
    numBolas: number;
    pesoGramos: number;
    activo: boolean;
    extras: ExtraCopa[];
    precioVenta: string;
    margen: number;
}

interface IceCreamAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[];
    onAddProducto: (producto: any) => Promise<any>;
    formatCurrency: (val: number) => string;
}

// ─── Datos iniciales ──────────────────────────────────────────────────────────

const PERFILES_DEFAULT: PerfilCopa[] = [
    { id: 'c1', label: '1 Bola',  numBolas: 1, pesoGramos: 80, activo: true,  extras: [], precioVenta: '1600',  margen: 45 },
    { id: 'c2', label: '2 Bolas', numBolas: 2, pesoGramos: 80, activo: true,  extras: [], precioVenta: '2600',  margen: 45 },
    { id: 'c3', label: '3 Bolas', numBolas: 3, pesoGramos: 80, activo: true,  extras: [], precioVenta: '3600',  margen: 45 },
    { id: 'c4', label: '4 Bolas', numBolas: 4, pesoGramos: 80, activo: false, extras: [], precioVenta: '4600',  margen: 45 },
];

let _nextId = 10;
const nextId = () => `cp${_nextId++}`;

// ─── Componente principal ─────────────────────────────────────────────────────

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios, onAddProducto, formatCurrency
}: IceCreamAssistantModalProps) {
    const [step, setStep]       = useState(1);
    const [loading, setLoading] = useState(false);

    // Paso 1 — por cada sabor: cuántas cajas abiertas
    interface CajaSeleccionada { id: string; cajas: number; }
    const [cajasSeleccionadas, setCajasSeleccionadas] = useState<CajaSeleccionada[]>([]);
    const [mlPorCaja, setMlPorCaja] = useState('10000');

    const selectedIds = cajasSeleccionadas.map(c => c.id);

    const toggleCaja = (id: string) => {
        setCajasSeleccionadas(prev =>
            prev.some(c => c.id === id)
                ? prev.filter(c => c.id !== id)
                : [...prev, { id, cajas: 1 }]
        );
    };
    const setCajasCount = (id: string, delta: number) => {
        setCajasSeleccionadas(prev => prev.map(c =>
            c.id === id ? { ...c, cajas: Math.max(1, c.cajas + delta) } : c
        ));
    };

    // Paso 2 — perfiles
    const [perfiles, setPerfiles]               = useState<PerfilCopa[]>(PERFILES_DEFAULT);
    const [nombreBase, setNombreBase]           = useState('');
    const [editingId, setEditingId]             = useState<string | null>(null);
    const [editLabel, setEditLabel]             = useState('');
    const [editBolas, setEditBolas]             = useState('');
    const [editPeso, setEditPeso]               = useState('');

    // Paso 3 — ventas semanales por perfil
    const [ventasSemana, setVentasSemana] = useState<Record<string, string>>({});

    // ── Filtros ──────────────────────────────────────────────────────────────

    const insumosLista = useMemo(() => productos.filter(p => {
        const cat = (p.categoria || '').toLowerCase();
        const n   = p.nombre.toLowerCase();
        return (cat.includes('helado') || n.includes('helado')) && p.tipo !== 'elaborado';
    }), [productos]);

    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const kw = ['vaso', 'salsa', 'cono', 'cuchara', 'grajea', 'gragea', 'chispa', 'topping', 'bolsa', 'cucharita'];
        return (p.tipo === 'ingrediente' || p.tipo === 'insumo') && kw.some(k => n.includes(k));
    }), [productos]);

    // ── Cálculos paso 1 — promedio ponderado por cajas abiertas ─────────────

    const mlPorCajaNum = parseFloat(mlPorCaja) || 10000;

    const { totalCostoCajas, totalMlDisponible, promedioMaestro, totalCajas } = useMemo(() => {
        let totalCosto = 0, totalMl = 0, totalC = 0;
        cajasSeleccionadas.forEach(({ id, cajas }) => {
            const precio = parseFloat(precios.find(pr => pr.productoId === id)?.precioCosto?.toString() || '0');
            totalCosto += precio * cajas;
            totalMl    += cajas * mlPorCajaNum;
            totalC     += cajas;
        });
        return {
            totalCostoCajas:   totalCosto,
            totalMlDisponible: totalMl,
            promedioMaestro:   totalC > 0 ? totalCosto / totalC : 0,
            totalCajas:        totalC,
        };
    }, [cajasSeleccionadas, precios, mlPorCajaNum]);

    const costoPorMl = totalMlDisponible > 0 ? totalCostoCajas / totalMlDisponible : 0;

    // ── Cálculos por perfil ───────────────────────────────────────────────────

    const perfilesCalc = useMemo(() => perfiles.map(p => {
        const mlCopa        = p.numBolas * p.pesoGramos;
        const costoHelado   = mlCopa * costoPorMl;
        const costoExtras   = p.extras.reduce((s, e) => s + e.costo, 0);
        const costoTotal    = costoHelado + costoExtras;
        const multiplier    = 1 / (1 - p.margen / 100);
        const pvpCalculado  = costoTotal * multiplier;
        const pvpFinal      = p.precioVenta ? parseFloat(p.precioVenta) : pvpCalculado;
        const margenReal    = pvpFinal > 0 ? ((pvpFinal - costoTotal) / pvpFinal) * 100 : 0;
        const copasPosibles = mlCopa > 0 ? Math.floor(totalMlDisponible / mlCopa) : 0;
        return { ...p, costoHelado, costoExtras, costoTotal, pvpCalculado, pvpFinal, margenReal, copasPosibles };
    }), [perfiles, costoPorMl, totalMlDisponible]);

    // ── Cálculos semana ───────────────────────────────────────────────────────

    const analisisSemana = useMemo(() => {
        const activos = perfilesCalc.filter(p => p.activo);
        let totalIngresos = 0, totalCostos = 0;
        const porPerfil = activos.map(p => {
            const vendidas = parseInt(ventasSemana[p.id] || '0') || 0;
            const ingreso  = vendidas * p.pvpFinal;
            const costo    = vendidas * p.costoTotal;
            const ganancia = ingreso - costo;
            totalIngresos += ingreso;
            totalCostos   += costo;
            return { ...p, vendidas, ingreso, costo, ganancia };
        });
        const gananciaTotal = totalIngresos - totalCostos;
        // Copas necesarias para cubrir el costo de las cajas
        const costoCajasTotal = totalCostoCajas;
        // Promedio de ganancia por copa (activos con precio)
        const gananciaPorCopaPromedio = activos.length > 0
            ? activos.reduce((s, p) => s + (p.pvpFinal - p.costoTotal), 0) / activos.length
            : 0;
        const copasPuntoPequilibrio = gananciaPorCopaPromedio > 0
            ? Math.ceil(costoCajasTotal / gananciaPorCopaPromedio)
            : 0;
        const totalCopasVendidas = porPerfil.reduce((s, p) => s + p.vendidas, 0);
        return { porPerfil, totalIngresos, totalCostos, gananciaTotal, costoCajasTotal, copasPuntoPequilibrio, totalCopasVendidas };
    }, [perfilesCalc, ventasSemana, cajasDisponibles, promedioMaestro]);

    // ── Helpers CRUD perfiles ─────────────────────────────────────────────────

    const startEdit = (p: PerfilCopa) => {
        setEditingId(p.id);
        setEditLabel(p.label);
        setEditBolas(p.numBolas.toString());
        setEditPeso(p.pesoGramos.toString());
    };

    const saveEdit = () => {
        if (!editingId) return;
        setPerfiles(prev => prev.map(p => p.id === editingId
            ? { ...p, label: editLabel || p.label, numBolas: parseInt(editBolas) || p.numBolas, pesoGramos: parseInt(editPeso) || p.pesoGramos }
            : p
        ));
        setEditingId(null);
    };

    const cancelEdit = () => setEditingId(null);

    const deleteProfile = (id: string) => {
        setPerfiles(prev => prev.filter(p => p.id !== id));
        toast.success('Perfil eliminado');
    };

    const addProfile = () => {
        const n = perfiles.length + 1;
        setPerfiles(prev => [...prev, {
            id: nextId(), label: `${n} Bola${n !== 1 ? 's' : ''}`,
            numBolas: n, pesoGramos: 80, activo: true,
            extras: [], precioVenta: '', margen: 45,
        }]);
    };

    const addExtra = (profileId: string, productoId: string) => {
        const prod    = productos.find(p => p.id === productoId);
        const precObj = precios.find(pr => pr.productoId === productoId);
        if (!prod) return;
        const costo = parseFloat(precObj?.precioCosto?.toString() || '0');
        setPerfiles(prev => prev.map(p => p.id === profileId
            ? { ...p, extras: [...p.extras, { productoId, nombre: prod.nombre, costo }] }
            : p
        ));
    };

    const removeExtra = (profileId: string, idx: number) =>
        setPerfiles(prev => prev.map(p => p.id === profileId
            ? { ...p, extras: p.extras.filter((_, i) => i !== idx) }
            : p
        ));

    const updatePerfil = (id: string, updates: Partial<PerfilCopa>) =>
        setPerfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    // ── Guardar ───────────────────────────────────────────────────────────────

    const handleSave = async () => {
        const activos = perfilesCalc.filter(p => p.activo);
        if (activos.length === 0) { toast.error('Activa al menos un tamaño'); return; }
        setLoading(true);
        try {
            for (const p of activos) {
                const nombre = nombreBase ? `${nombreBase} ${p.label}` : `Copa Helado ${p.label}`;
                await onAddProducto({
                    nombre,
                    categoria:      'Helados',
                    descripcion:    `${p.numBolas} bola(s) × ${p.pesoGramos}g. Costo base: ${formatCurrency(p.costoTotal)}.`,
                    precioVenta:    Math.round(p.pvpFinal),
                    margenUtilidad: p.margenReal.toFixed(0),
                    tipo:           'elaborado',
                    unidadMedida:   'unidad',
                    costoBase:      p.costoTotal,
                });
            }
            toast.success(`${activos.length} producto(s) creados`);
            onOpenChange(false);
            reset();
        } catch {
            toast.error('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setCajasSeleccionadas([]);
        setMlPorCaja('10000');
        setPerfiles(PERFILES_DEFAULT);
        setNombreBase('');
        setEditingId(null);
        setVentasSemana({});
    };

    React.useEffect(() => { if (isOpen) reset(); }, [isOpen]);

    // ─────────────────────────────────────────────────────────────────────────

    const STEP_LABELS = ['Cajas', 'Perfiles', 'Rentabilidad', 'Guardar'];

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">

                {/* ── Header ── */}
                <DialogHeader className="p-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🍦</div>
                            <div>
                                <DialogTitle className="text-lg font-black text-white leading-tight">Asistente de Helados</DialogTitle>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none mt-0.5">
                                    Paso {step} — {STEP_LABELS[step - 1]}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', step >= s ? 'bg-white w-7' : 'bg-white/30 w-4')} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Contenido ── */}
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5">

                    {/* ══════════ PASO 1: CAJAS ══════════ */}
                    {step === 1 && (
                        <>
                            {/* Contenido por caja */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    Gramos (g) o mililitros (ml) por caja
                                </Label>
                                <p className="text-[9px] text-slate-400 font-medium mt-0.5 mb-2">
                                    Ejemplo: una caja de 10 kg → escribe <strong>10000</strong>. Una de 5 L → <strong>5000</strong>.
                                </p>
                                <Input
                                    type="number" min="100"
                                    value={mlPorCaja}
                                    onChange={e => setMlPorCaja(e.target.value)}
                                    className="h-9 font-bold text-sm w-40"
                                />
                            </div>

                            {/* Lista de sabores */}
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">
                                    Marca los sabores que tienes abiertos e indica cuántas cajas de cada uno
                                </p>
                                {insumosLista.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-1">
                                        <p className="text-sm font-black text-amber-700">No hay cajas de helado registradas</p>
                                        <p className="text-[11px] text-amber-600">
                                            Ve a <strong>Productos → Nuevo producto</strong> y registra tus cajas con categoría <strong>"Helados"</strong>. Pon el nombre del sabor y el precio de compra.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {insumosLista.map(p => {
                                            const isSel  = selectedIds.includes(p.id);
                                            const item   = cajasSeleccionadas.find(c => c.id === p.id);
                                            const pCosto = parseFloat(precios.find(pr => pr.productoId === p.id)?.precioCosto?.toString() || '0');
                                            return (
                                                <div key={p.id} className={cn(
                                                    'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                                                    isSel ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-slate-100 hover:border-cyan-200'
                                                )}>
                                                    <button
                                                        onClick={() => toggleCaja(p.id)}
                                                        className={cn(
                                                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all',
                                                            isSel ? 'bg-cyan-600 border-cyan-700 text-white' : 'border-slate-200 text-slate-300 hover:border-cyan-300'
                                                        )}
                                                    >
                                                        {isSel ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-slate-800 uppercase leading-tight truncate">{p.nombre}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatCurrency(pCosto)} / caja</p>
                                                    </div>
                                                    {isSel && item && (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[9px] font-black text-cyan-600 uppercase tracking-wide hidden sm:inline">cajas</span>
                                                            <button
                                                                onClick={() => setCajasCount(p.id, -1)}
                                                                disabled={item.cajas <= 1}
                                                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                                                            >
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="w-6 text-center font-black text-slate-800 text-sm">{item.cajas}</span>
                                                            <button
                                                                onClick={() => setCajasCount(p.id, 1)}
                                                                className="w-7 h-7 rounded-lg bg-cyan-600 text-white flex items-center justify-center hover:bg-cyan-700"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-[9px] font-black text-cyan-700 w-20 text-right">
                                                                = {formatCurrency(pCosto * item.cajas)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* KPIs resumen */}
                            {cajasSeleccionadas.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-cyan-600 rounded-2xl p-4 text-white text-center shadow-lg shadow-cyan-100">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Costo prom. / caja</p>
                                        <p className="text-xl font-black mt-1">{formatCurrency(promedioMaestro)}</p>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">{cajasSeleccionadas.length} sabor(es)</p>
                                    </div>
                                    <div className="bg-blue-600 rounded-2xl p-4 text-white text-center shadow-lg shadow-blue-100">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Stock total</p>
                                        <p className="text-xl font-black mt-1">{(totalMlDisponible / 1000).toFixed(1)} kg/L</p>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">{totalCajas} caja(s)</p>
                                    </div>
                                    <div className="bg-slate-800 rounded-2xl p-4 text-white text-center shadow-lg">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Costo total</p>
                                        <p className="text-xl font-black mt-1">{formatCurrency(totalCostoCajas)}</p>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">a recuperar</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ══════════ PASO 2: PERFILES ══════════ */}
                    {step === 2 && (
                        <>
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre base</Label>
                                    <Input value={nombreBase} onChange={e => setNombreBase(e.target.value)}
                                        placeholder="Ej: Copa, Sorbete…" className="mt-1.5 h-9 text-sm font-bold" />
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold pb-2 whitespace-nowrap">
                                    → "{nombreBase || 'Copa'} 2 Bolas"
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {perfilesCalc.map(p => {
                                    const isEditing = editingId === p.id;
                                    return (
                                        <div key={p.id} className={cn(
                                            'rounded-2xl border-2 overflow-hidden transition-all',
                                            p.activo ? 'border-cyan-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-55'
                                        )}>
                                            {/* Cabecera perfil */}
                                            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">
                                                {/* Toggle activo */}
                                                <button onClick={() => !isEditing && updatePerfil(p.id, { activo: !p.activo })}
                                                    className={cn('w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all shrink-0',
                                                        p.activo ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-200 text-slate-400'
                                                    )}>
                                                    {p.activo ? <Check className="w-4 h-4" /> : p.numBolas}
                                                </button>

                                                {isEditing ? (
                                                    /* Modo edición inline */
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                                                            placeholder="Nombre" className="h-7 w-24 text-xs font-black border-cyan-300" />
                                                        <div className="flex items-center gap-1">
                                                            <Input type="number" value={editBolas} onChange={e => setEditBolas(e.target.value)}
                                                                className="h-7 w-12 text-center text-xs font-black border-cyan-300" />
                                                            <span className="text-[9px] text-slate-400 font-bold">bolas</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Input type="number" value={editPeso} onChange={e => setEditPeso(e.target.value)}
                                                                className="h-7 w-14 text-center text-xs font-black border-cyan-300" />
                                                            <span className="text-[9px] text-slate-400 font-bold">g/bola</span>
                                                        </div>
                                                        <button onClick={saveEdit} className="h-7 px-3 bg-cyan-600 text-white rounded-lg text-[10px] font-black">Guardar</button>
                                                        <button onClick={cancelEdit} className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    /* Vista normal */
                                                    <>
                                                        <span className="font-black text-slate-800 text-sm flex-1">{p.label}</span>
                                                        {p.activo && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] text-slate-400 font-black uppercase">Peso/bola</span>
                                                                <Input type="number" value={p.pesoGramos}
                                                                    onChange={e => updatePerfil(p.id, { pesoGramos: parseInt(e.target.value) || 0 })}
                                                                    className="h-7 w-14 text-center text-xs font-black p-0 border border-slate-200 rounded-lg" />
                                                                <span className="text-[9px] text-slate-400">g</span>
                                                                <span className="text-[9px] font-black text-cyan-700 ml-1">{formatCurrency(p.costoHelado)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1 ml-1">
                                                            <button onClick={() => startEdit(p)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => deleteProfile(p.id)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Extras + precio (solo si activo y no editando) */}
                                            {p.activo && !isEditing && (
                                                <div className="p-3 grid grid-cols-2 gap-3">
                                                    {/* Insumos del vaso */}
                                                    <div className="space-y-1.5">
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                            Insumos del vaso
                                                        </p>
                                                        {p.extras.length === 0 && (
                                                            <p className="text-[9px] text-slate-300 italic">Sin insumos — agrega vaso, cuchara, gragea…</p>
                                                        )}
                                                        {p.extras.map((ex, i) => (
                                                            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                                                <span className="text-[10px] font-bold text-slate-700 flex-1 truncate">{ex.nombre}</span>
                                                                <span className="text-[10px] font-black text-cyan-700 shrink-0">{formatCurrency(ex.costo)}</span>
                                                                <button onClick={() => removeExtra(p.id, i)}
                                                                    className="text-slate-300 hover:text-rose-500 transition-colors ml-1 shrink-0">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <select value="" onChange={e => { if (e.target.value) addExtra(p.id, e.target.value); }}
                                                            className="w-full h-8 bg-white border border-dashed border-cyan-300 rounded-lg px-2 text-[9px] font-black uppercase text-slate-500 outline-none cursor-pointer">
                                                            <option value="">+ Agregar insumo del vaso…</option>
                                                            {extrasDisponibles.map(e => {
                                                                const c = parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0');
                                                                return <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(c)})</option>;
                                                            })}
                                                        </select>
                                                        {extrasDisponibles.length === 0 && (
                                                            <p className="text-[9px] text-amber-500 font-bold">
                                                                Registra vasos, cucharas y salsas en Productos para que aparezcan aquí
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Panel de precio */}
                                                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 space-y-2 border border-cyan-100">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500">Costo helado</span>
                                                            <span className="font-black text-slate-700">{formatCurrency(p.costoHelado)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500">Insumos vaso</span>
                                                            <span className="font-black text-slate-700">+{formatCurrency(p.costoExtras)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-black border-t border-cyan-100 pt-1.5">
                                                            <span className="text-slate-600">Costo total</span>
                                                            <span className="text-cyan-700">{formatCurrency(p.costoTotal)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Precio venta $</span>
                                                            <Input type="number" value={p.precioVenta}
                                                                onChange={e => updatePerfil(p.id, { precioVenta: e.target.value })}
                                                                placeholder={Math.round(p.pvpCalculado).toString()}
                                                                className="h-7 flex-1 text-right text-xs font-black border-cyan-200 bg-white" />
                                                        </div>
                                                        <div className={cn(
                                                            'flex justify-between text-[10px] font-black rounded-lg px-2.5 py-1.5',
                                                            p.margenReal >= 30 ? 'bg-emerald-600 text-white' : p.margenReal >= 15 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                                                        )}>
                                                            <span>Margen</span>
                                                            <span>{p.margenReal.toFixed(0)}%</span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-blue-500 text-center">
                                                            ~{p.copasPosibles} copas posibles con stock actual
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={addProfile}
                                className="w-full h-10 flex items-center justify-center gap-2 border-2 border-dashed border-cyan-300 rounded-2xl text-[11px] font-black uppercase text-cyan-600 hover:bg-cyan-50 transition-all">
                                <Plus className="w-4 h-4" /> Agregar nuevo tamaño de copa
                            </button>
                        </>
                    )}

                    {/* ══════════ PASO 3: RENTABILIDAD SEMANAL ══════════ */}
                    {step === 3 && (
                        <>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
                                <p className="text-xs font-black text-blue-800">¿Cuántas copas de cada tamaño vendiste esta semana?</p>
                                <p className="text-[10px] text-blue-500 font-medium">Esto te mostrará si estás ganando o perdiendo con los helados</p>
                            </div>

                            <div className="space-y-2">
                                {perfilesCalc.filter(p => p.activo).map(p => (
                                    <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3">
                                        <span className="text-sm font-black text-slate-700 w-20 shrink-0">{p.label}</span>
                                        <span className="text-[10px] font-bold text-slate-400 flex-1">
                                            Costo {formatCurrency(p.costoTotal)} → Venta {formatCurrency(p.pvpFinal)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Copas vendidas</Label>
                                            <Input type="number" min={0} value={ventasSemana[p.id] || ''}
                                                onChange={e => setVentasSemana(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                placeholder="0" className="h-8 w-16 text-center font-black text-sm border-slate-200" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Diagnóstico semana */}
                            {analisisSemana.totalCopasVendidas > 0 && (
                                <div className="space-y-3">
                                    {/* Resumen por tamaño */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {analisisSemana.porPerfil.filter(p => p.vendidas > 0).map(p => (
                                            <div key={p.id} className={cn(
                                                'rounded-xl p-3 border-2',
                                                p.ganancia > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                                            )}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-black text-slate-800">{p.label}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">{p.vendidas} copas</span>
                                                </div>
                                                <div className="space-y-0.5 text-[10px]">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Ingresos</span>
                                                        <span className="font-black text-slate-700">{formatCurrency(p.ingreso)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Costos</span>
                                                        <span className="font-black text-rose-600">-{formatCurrency(p.costo)}</span>
                                                    </div>
                                                    <div className={cn('flex justify-between font-black border-t pt-1', p.ganancia > 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                                        <span>Ganancia</span>
                                                        <span>{p.ganancia > 0 ? '+' : ''}{formatCurrency(p.ganancia)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Semáforo total */}
                                    <div className={cn(
                                        'rounded-2xl p-5 text-white space-y-3 shadow-lg',
                                        analisisSemana.gananciaTotal > 0 ? 'bg-emerald-600' : 'bg-rose-600'
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {analisisSemana.gananciaTotal > 0
                                                ? <TrendingUp className="w-5 h-5" />
                                                : <TrendingDown className="w-5 h-5" />
                                            }
                                            <span className="font-black uppercase text-sm">Ganancia real esta semana</span>
                                        </div>
                                        <p className="text-5xl font-black">
                                            {analisisSemana.gananciaTotal > 0 ? '+' : ''}{formatCurrency(analisisSemana.gananciaTotal)}
                                        </p>
                                        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-[11px] font-bold">
                                            <div className="flex justify-between">
                                                <span className="opacity-70">Total ingresos</span>
                                                <span>{formatCurrency(analisisSemana.totalIngresos)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="opacity-70">Total costos</span>
                                                <span>-{formatCurrency(analisisSemana.totalCostos)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Diagnóstico: por qué no queda ganancia */}
                                    {analisisSemana.gananciaTotal <= 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                <p className="text-xs font-black text-amber-800">¿Por qué no queda ganancia?</p>
                                            </div>
                                            <div className="space-y-1.5 text-[10px] text-amber-700 font-medium">
                                                {perfilesCalc.filter(p => p.activo && p.margenReal < 25).map(p => (
                                                    <p key={p.id}>• <strong>{p.label}:</strong> margen de solo {p.margenReal.toFixed(0)}% — precio de venta ({formatCurrency(p.pvpFinal)}) demasiado bajo vs costo ({formatCurrency(p.costoTotal)})</p>
                                                ))}
                                                {perfilesCalc.filter(p => p.activo).every(p => p.margenReal >= 25) && (
                                                    <p>• Los márgenes están bien, pero el volumen de ventas ({analisisSemana.totalCopasVendidas} copas) no es suficiente para cubrir los costos fijos de las cajas.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Punto de equilibrio */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="w-4 h-4 text-slate-600" />
                                            <p className="text-xs font-black text-slate-700">Punto de equilibrio semanal</p>
                                        </div>
                                        <p className="text-[11px] text-slate-600 font-medium">
                                            Para recuperar el costo de las {totalCajas} caja(s) ({formatCurrency(analisisSemana.costoCajasTotal)}), necesitas vender aproximadamente{' '}
                                            <strong className="text-slate-900">{analisisSemana.copasPuntoPequilibrio} copas en total</strong>.
                                        </p>
                                        <div className="mt-2 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all', analisisSemana.totalCopasVendidas >= analisisSemana.copasPuntoPequilibrio ? 'bg-emerald-500' : 'bg-amber-500')}
                                                style={{ width: `${Math.min(100, analisisSemana.copasPuntoPequilibrio > 0 ? (analisisSemana.totalCopasVendidas / analisisSemana.copasPuntoPequilibrio) * 100 : 0)}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold mt-1">
                                            {analisisSemana.totalCopasVendidas} de {analisisSemana.copasPuntoPequilibrio} copas
                                        </p>
                                    </div>
                                </div>
                            )}

                            {analisisSemana.totalCopasVendidas === 0 && (
                                <div className="text-center py-8 text-slate-300">
                                    <p className="text-5xl mb-3">🍦</p>
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Ingresa las ventas de la semana</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ══════════ PASO 4: GUARDAR ══════════ */}
                    {step === 4 && (
                        <>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                Se crearán {perfilesCalc.filter(p => p.activo).length} producto(s) en el catálogo
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {perfilesCalc.filter(p => p.activo).map(p => (
                                    <div key={p.id} className="bg-white rounded-2xl border-2 border-cyan-100 p-4 space-y-3 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-2xl">🍦</span>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{nombreBase || 'Copa'} {p.label}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{p.numBolas} bola(s) × {p.pesoGramos}g</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-[10px]">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Costo helado</span>
                                                <span className="font-black">{formatCurrency(p.costoHelado)}</span>
                                            </div>
                                            {p.costoExtras > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-bold">Insumos vaso</span>
                                                    <span className="font-black">+{formatCurrency(p.costoExtras)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-black border-t border-slate-100 pt-1">
                                                <span>Costo total</span>
                                                <span className="text-cyan-700">{formatCurrency(p.costoTotal)}</span>
                                            </div>
                                            <div className="flex justify-between font-black text-[11px]">
                                                <span>Precio venta</span>
                                                <span className="text-emerald-600">{formatCurrency(p.pvpFinal)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-bold">Margen</span>
                                                <span className={cn('font-black', p.margenReal >= 30 ? 'text-emerald-600' : p.margenReal >= 15 ? 'text-amber-600' : 'text-rose-600')}>
                                                    {p.margenReal.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-100 pt-1">
                                                <span className="text-slate-400 font-bold">Copas posibles</span>
                                                <span className="font-black text-blue-600">{p.copasPosibles} copas</span>
                                            </div>
                                        </div>
                                        {p.extras.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-2 space-y-0.5">
                                                {p.extras.map((ex, i) => (
                                                    <p key={i} className="text-[9px] text-slate-500 font-bold truncate">• {ex.nombre} — {formatCurrency(ex.costo)}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-11 px-5 rounded-xl text-xs font-black uppercase text-slate-400">
                        {step === 1 ? 'Cerrar' : <><ChevronLeft className="w-4 h-4 mr-1" />Atrás</>}
                    </Button>
                    {step < 4 ? (
                        <Button
                            disabled={step === 1 && selectedIds.length === 0}
                            onClick={() => setStep(step + 1)}
                            className="h-11 flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                            {step === 3 ? 'Ver resumen y guardar' : 'Siguiente'} <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button disabled={loading} onClick={handleSave}
                            className="h-11 flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                            {loading ? 'Guardando…' : `Guardar ${perfilesCalc.filter(p => p.activo).length} producto(s)`}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
