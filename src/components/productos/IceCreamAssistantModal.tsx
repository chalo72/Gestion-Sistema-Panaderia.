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
    costoPackTotal: number;
    cantidadPack: number;
    unidad: string;
    cantidadPorCopa: number;
    costoPorCopa: number;
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

interface BaseConfig {
    perfiles: PerfilCopa[];
    mlPorCaja: string;
}

interface IceCreamAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[];
    onAddProducto: (producto: any) => Promise<any>;
    formatCurrency: (val: number) => string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const CONFIGS_KEY = 'ice_cream_base_configs_v2';

const getStoredConfigs = (): Record<string, BaseConfig> => {
    try { return JSON.parse(localStorage.getItem(CONFIGS_KEY) || '{}'); } catch { return {}; }
};

const saveConfig = (name: string, config: BaseConfig) => {
    const all = getStoredConfigs();
    all[name] = config;
    const keys = Object.keys(all);
    if (keys.length > 8) delete all[keys[0]];
    localStorage.setItem(CONFIGS_KEY, JSON.stringify(all));
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const PERFILES_DEFAULT: PerfilCopa[] = [
    { id: 'c1', label: '1 Bola',  numBolas: 1, pesoGramos: 80, activo: true,  extras: [], precioVenta: '1600', margen: 45 },
    { id: 'c2', label: '2 Bolas', numBolas: 2, pesoGramos: 80, activo: true,  extras: [], precioVenta: '2600', margen: 45 },
    { id: 'c3', label: '3 Bolas', numBolas: 3, pesoGramos: 80, activo: true,  extras: [], precioVenta: '3600', margen: 45 },
    { id: 'c4', label: '4 Bolas', numBolas: 4, pesoGramos: 80, activo: false, extras: [], precioVenta: '4600', margen: 45 },
];

const UNIDADES = ['und', 'g', 'ml', 'kg'];

let _nextId = 10;
const nextId = () => `cp${_nextId++}`;

// ─── Componente ───────────────────────────────────────────────────────────────

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios, onAddProducto, formatCurrency
}: IceCreamAssistantModalProps) {
    const [step, setStep]     = useState(1);
    const [loading, setLoading] = useState(false);

    // Paso 1
    interface CajaSeleccionada { id: string; cajas: number; }
    const [cajasSeleccionadas, setCajasSeleccionadas] = useState<CajaSeleccionada[]>([]);
    const [mlPorCaja, setMlPorCaja] = useState('10000');

    // Paso 2
    const [perfiles, setPerfiles]     = useState<PerfilCopa[]>(PERFILES_DEFAULT);
    const [nombreBase, setNombreBase] = useState('');
    const [editingId, setEditingId]   = useState<string | null>(null);
    const [editLabel, setEditLabel]   = useState('');
    const [editBolas, setEditBolas]   = useState('');
    const [editPeso, setEditPeso]     = useState('');
    const [configsGuardadas, setConfigsGuardadas] = useState<Record<string, BaseConfig>>({});
    const [addingExtraFor, setAddingExtraFor] = useState<string | null>(null);
    const [extraForm, setExtraForm] = useState({ productoId: '', cantidadPack: '', unidad: 'und', cantidadPorCopa: '1' });

    // Paso 3
    const [ventasSemana, setVentasSemana] = useState<Record<string, string>>({});

    // ── Filtros ───────────────────────────────────────────────────────────────

    const selectedIds = cajasSeleccionadas.map(c => c.id);

    const insumosLista = useMemo(() => productos.filter(p => {
        const cat = (p.categoria || '').toLowerCase();
        const n   = p.nombre.toLowerCase();
        return (cat.includes('helado') || n.includes('helado') || n.includes('caja') || n.includes('10l')) && p.tipo !== 'elaborado';
    }), [productos]);

    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n  = p.nombre.toLowerCase();
        const kw = ['vaso', 'salsa', 'cono', 'cuchara', 'grajea', 'gragea', 'chispa', 'topping', 'bolsa', 'cucharita'];
        return (p.tipo === 'ingrediente' || p.tipo === 'insumo') && kw.some(k => n.includes(k));
    }), [productos]);

    // ── Cálculos paso 1 ───────────────────────────────────────────────────────

    const mlPorCajaNum = parseFloat(mlPorCaja) || 10000;

    const { totalCostoCajas, totalMlDisponible, promedioMaestro, totalCajas } = useMemo(() => {
        let totalCostoInvertido = 0, totalC = 0;
        cajasSeleccionadas.forEach(({ id, cajas }) => {
            const precio = parseFloat(precios.find(pr => pr.productoId === id)?.precioCosto?.toString() || '0');
            totalCostoInvertido += precio * cajas;
            totalC += cajas;
        });
        let sumTodosPrecios = 0, countTodos = 0;
        cajasSeleccionadas.forEach(({ id }) => {
            precios.filter(pr => pr.productoId === id).forEach(pr => {
                const v = parseFloat(pr.precioCosto?.toString() || '0');
                if (v > 0) { sumTodosPrecios += v; countTodos++; }
            });
        });
        return {
            totalCostoCajas:   totalCostoInvertido,
            totalMlDisponible: totalC * mlPorCajaNum,
            promedioMaestro:   countTodos > 0 ? sumTodosPrecios / countTodos : 0,
            totalCajas:        totalC,
        };
    }, [cajasSeleccionadas, precios, mlPorCajaNum]);

    const costoPorMl    = mlPorCajaNum > 0 ? promedioMaestro / mlPorCajaNum : 0;
    const costoPor1000g = costoPorMl * 1000;

    // ── Cálculos por perfil ───────────────────────────────────────────────────

    const perfilesCalc = useMemo(() => perfiles.map(p => {
        const mlCopa       = p.numBolas * p.pesoGramos;
        const costoHelado  = mlCopa * costoPorMl;
        const costoExtras  = p.extras.reduce((s, e) => s + e.costoPorCopa, 0);
        const costoTotal   = costoHelado + costoExtras;
        const multiplier   = 1 / (1 - p.margen / 100);
        const pvpCalculado = costoTotal * multiplier;
        const pvpFinal     = p.precioVenta ? parseFloat(p.precioVenta) : pvpCalculado;
        const margenReal   = pvpFinal > 0 ? ((pvpFinal - costoTotal) / pvpFinal) * 100 : 0;
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
            totalIngresos += ingreso;
            totalCostos   += costo;
            return { ...p, vendidas, ingreso, costo, ganancia: ingreso - costo };
        });
        const gananciaTotal = totalIngresos - totalCostos;
        const gpPromedio = activos.length > 0
            ? activos.reduce((s, p) => s + (p.pvpFinal - p.costoTotal), 0) / activos.length : 0;
        const copasPuntoPequilibrio = gpPromedio > 0 ? Math.ceil(totalCostoCajas / gpPromedio) : 0;
        const totalCopasVendidas = porPerfil.reduce((s, p) => s + p.vendidas, 0);
        return { porPerfil, totalIngresos, totalCostos, gananciaTotal, costoCajasTotal: totalCostoCajas, copasPuntoPequilibrio, totalCopasVendidas };
    }, [perfilesCalc, ventasSemana, totalCostoCajas]);

    // ── Preview costo insumo ──────────────────────────────────────────────────

    const extraPreviewCosto = useMemo(() => {
        if (!extraForm.productoId || !extraForm.cantidadPack) return 0;
        const precObj = precios.find(pr => pr.productoId === extraForm.productoId);
        const costoTotal = parseFloat(precObj?.precioCosto?.toString() || '0');
        const pack = parseFloat(extraForm.cantidadPack) || 1;
        const porCopa = parseFloat(extraForm.cantidadPorCopa) || 1;
        return pack > 0 ? (costoTotal / pack) * porCopa : 0;
    }, [extraForm, precios]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const toggleCaja = (id: string) =>
        setCajasSeleccionadas(prev =>
            prev.some(c => c.id === id) ? prev.filter(c => c.id !== id) : [...prev, { id, cajas: 1 }]
        );

    const setCajasCount = (id: string, delta: number) =>
        setCajasSeleccionadas(prev => prev.map(c => c.id === id ? { ...c, cajas: Math.max(1, c.cajas + delta) } : c));

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

    const deleteProfile = (id: string) => { setPerfiles(prev => prev.filter(p => p.id !== id)); };

    const addProfile = () => {
        const n = perfiles.length + 1;
        setPerfiles(prev => [...prev, { id: nextId(), label: `${n} Bola${n !== 1 ? 's' : ''}`, numBolas: n, pesoGramos: 80, activo: true, extras: [], precioVenta: '', margen: 45 }]);
    };

    const updatePerfil = (id: string, updates: Partial<PerfilCopa>) =>
        setPerfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    const openAddExtra = (profileId: string) => {
        setAddingExtraFor(profileId);
        setExtraForm({ productoId: '', cantidadPack: '', unidad: 'und', cantidadPorCopa: '1' });
    };

    const confirmAddExtra = () => {
        if (!addingExtraFor || !extraForm.productoId || !extraForm.cantidadPack) return;
        const prod    = productos.find(p => p.id === extraForm.productoId);
        const precObj = precios.find(pr => pr.productoId === extraForm.productoId);
        if (!prod) return;
        const costoPackTotal  = parseFloat(precObj?.precioCosto?.toString() || '0');
        const cantidadPack    = parseFloat(extraForm.cantidadPack) || 1;
        const cantidadPorCopa = parseFloat(extraForm.cantidadPorCopa) || 1;
        const costoPorCopa    = cantidadPack > 0 ? (costoPackTotal / cantidadPack) * cantidadPorCopa : 0;
        setPerfiles(prev => prev.map(p => p.id === addingExtraFor
            ? { ...p, extras: [...p.extras, { productoId: prod.id, nombre: prod.nombre, costoPackTotal, cantidadPack, unidad: extraForm.unidad, cantidadPorCopa, costoPorCopa }] }
            : p
        ));
        setAddingExtraFor(null);
        toast.success(`${prod.nombre} añadido`);
    };

    const updateExtraCantidad = (profileId: string, idx: number, newVal: number) =>
        setPerfiles(prev => prev.map(p => {
            if (p.id !== profileId) return p;
            return { ...p, extras: p.extras.map((ex, i) => i !== idx ? ex : {
                ...ex,
                cantidadPorCopa: newVal,
                costoPorCopa: ex.cantidadPack > 0 ? (ex.costoPackTotal / ex.cantidadPack) * newVal : 0
            })};
        }));

    const removeExtra = (profileId: string, idx: number) =>
        setPerfiles(prev => prev.map(p => p.id === profileId
            ? { ...p, extras: p.extras.filter((_, i) => i !== idx) } : p
        ));

    const loadBaseConfig = (name: string) => {
        setNombreBase(name);
        const cfg = configsGuardadas[name];
        if (cfg) {
            setPerfiles(cfg.perfiles);
            setMlPorCaja(cfg.mlPorCaja);
            toast.success(`Configuración "${name}" cargada`);
        }
    };

    const handleSave = async () => {
        const activos = perfilesCalc.filter(p => p.activo);
        if (activos.length === 0) { toast.error('Activa al menos un tamaño'); return; }
        setLoading(true);
        const base = nombreBase.trim() || 'Copa';
        try {
            for (const p of activos) {
                await onAddProducto({
                    nombre:         `${base} ${p.label}`,
                    categoria:      'Helados',
                    descripcion:    `${p.numBolas} bola(s) × ${p.pesoGramos}g = ${p.numBolas * p.pesoGramos}g. Costo: ${formatCurrency(p.costoTotal)}.`,
                    precioVenta:    Math.round(p.pvpFinal),
                    margenUtilidad: p.margenReal.toFixed(0),
                    tipo:           'elaborado',
                    unidadMedida:   'unidad',
                    costoBase:      p.costoTotal,
                });
            }
            saveConfig(base, { perfiles, mlPorCaja });
            toast.success(`${activos.length} producto(s) creados ✓`);
            onOpenChange(false);
            reset();
        } catch { toast.error('Error al guardar'); }
        finally { setLoading(false); }
    };

    const reset = () => {
        setStep(1);
        setCajasSeleccionadas([]);
        setMlPorCaja('10000');
        setPerfiles(PERFILES_DEFAULT);
        setNombreBase('');
        setEditingId(null);
        setVentasSemana({});
        setAddingExtraFor(null);
    };

    React.useEffect(() => {
        if (isOpen) { reset(); setConfigsGuardadas(getStoredConfigs()); }
    }, [isOpen]);

    const STEP_LABELS = ['Cajas', 'Tamaños', 'Rentabilidad', 'Guardar'];

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">

                {/* ── Header ─────────────────────────────────────────────── */}
                <DialogHeader className="p-4 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">🍦</div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-black text-white leading-tight">Asistente de Helados</DialogTitle>
                                <p className="text-[9px] font-bold text-cyan-100/80 uppercase tracking-widest">
                                    Paso {step} de 4 — {STEP_LABELS[step - 1]}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {STEP_LABELS.map((lbl, i) => (
                                <React.Fragment key={i}>
                                    <div className={cn(
                                        'flex items-center justify-center rounded-full font-black transition-all',
                                        step === i + 1 ? 'w-7 h-7 bg-white text-cyan-700 text-[10px] shadow' :
                                        step > i + 1  ? 'w-6 h-6 bg-white/40 text-white text-[9px]' :
                                                        'w-5 h-5 bg-white/15 text-white/50 text-[9px]'
                                    )}>
                                        {step > i + 1 ? '✓' : i + 1}
                                    </div>
                                    {i < 3 && <div className={cn('h-0.5 w-4 rounded-full', step > i + 1 ? 'bg-white/60' : 'bg-white/20')} />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Contenido ──────────────────────────────────────────── */}
                <div className="p-5 max-h-[64vh] overflow-y-auto space-y-4">

                    {/* ════════ PASO 1 — CAJAS ════════ */}
                    {step === 1 && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-1">
                                        g o ml por caja
                                    </Label>
                                    <p className="text-[9px] text-slate-400 mb-2">10 kg → <strong>10000</strong> · 5 L → <strong>5000</strong></p>
                                    <Input type="number" min="100" value={mlPorCaja}
                                        onChange={e => setMlPorCaja(e.target.value)}
                                        className="h-10 font-black text-base w-32" />
                                </div>
                                {cajasSeleccionadas.length > 0 && (
                                    <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl p-4 text-white flex flex-col justify-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Costo / kg promedio</p>
                                        <p className="text-2xl font-black">{formatCurrency(costoPor1000g)}</p>
                                        <p className="text-[9px] opacity-70 mt-0.5">{cajasSeleccionadas.length} sabor(es) · {formatCurrency(promedioMaestro)}/caja</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">
                                    Selecciona los sabores que tienes abiertos
                                </p>
                                {insumosLista.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
                                        <p className="text-sm font-black text-amber-700">Sin cajas de helado registradas</p>
                                        <p className="text-[11px] text-amber-600">
                                            Ve a <strong>Productos → Nuevo producto</strong>, crea insumos con categoría <strong>"INS: Helados"</strong> o con la palabra "caja" en el nombre.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {insumosLista.map(p => {
                                            const isSel = selectedIds.includes(p.id);
                                            const item  = cajasSeleccionadas.find(c => c.id === p.id);
                                            const allP  = precios.filter(pr => pr.productoId === p.id);
                                            const pCosto = allP.length > 0
                                                ? allP.reduce((s, pr) => s + parseFloat(pr.precioCosto?.toString() || '0'), 0) / allP.length
                                                : 0;
                                            return (
                                                <div key={p.id} onClick={() => toggleCaja(p.id)}
                                                    className={cn(
                                                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer',
                                                        isSel ? 'bg-cyan-50 border-cyan-400 shadow-sm' : 'bg-white border-slate-100 hover:border-cyan-200'
                                                    )}>
                                                    <div className={cn(
                                                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all',
                                                        isSel ? 'bg-cyan-600 border-cyan-700 text-white' : 'border-slate-200 text-slate-300'
                                                    )}>
                                                        {isSel ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-slate-800 uppercase truncate">{p.nombre}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">
                                                            {pCosto > 0 ? formatCurrency(pCosto) : 'Sin precio'}
                                                            {allP.length > 1 && <span className="text-cyan-500 ml-1">({allP.length} proveedores, promedio)</span>}
                                                        </p>
                                                    </div>
                                                    {isSel && item && (
                                                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => setCajasCount(p.id, -1)} disabled={item.cajas <= 1}
                                                                className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                                                                <Minus className="w-2.5 h-2.5" />
                                                            </button>
                                                            <span className="w-4 text-center font-black text-slate-800 text-sm">{item.cajas}</span>
                                                            <button onClick={() => setCajasCount(p.id, 1)}
                                                                className="w-6 h-6 rounded-md bg-cyan-600 text-white flex items-center justify-center hover:bg-cyan-700">
                                                                <Plus className="w-2.5 h-2.5" />
                                                            </button>
                                                            <span className="text-[9px] font-black text-cyan-700 w-20 text-right">= {formatCurrency(pCosto * item.cajas)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {cajasSeleccionadas.length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                        <p className="text-[9px] font-black uppercase text-blue-500">Stock disponible</p>
                                        <p className="text-xl font-black text-blue-700 mt-0.5">{(totalMlDisponible/1000).toFixed(1)} kg/L</p>
                                        <p className="text-[9px] font-bold text-blue-400">{totalCajas} caja(s)</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                        <p className="text-[9px] font-black uppercase text-slate-500">Inversión total</p>
                                        <p className="text-xl font-black text-slate-700 mt-0.5">{formatCurrency(totalCostoCajas)}</p>
                                        <p className="text-[9px] font-bold text-slate-400">a recuperar</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ════════ PASO 2 — TAMAÑOS DE COPA ════════ */}
                    {step === 2 && (
                        <>
                            {/* Nombre base + historial */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">
                                            Nombre base del producto
                                        </Label>
                                        <Input value={nombreBase} onChange={e => setNombreBase(e.target.value)}
                                            placeholder="Ej: Copa, Sorbete, Paleta…"
                                            className="h-10 text-sm font-black" />
                                    </div>
                                    <div className="shrink-0 bg-white border-2 border-cyan-200 rounded-xl px-3 h-10 flex items-center text-[10px] font-black text-cyan-700 whitespace-nowrap">
                                        {nombreBase || 'Copa'} + tamaño
                                    </div>
                                </div>
                                {Object.keys(configsGuardadas).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Bases guardadas:</span>
                                        {Object.keys(configsGuardadas).map(n => (
                                            <button key={n} onClick={() => loadBaseConfig(n)}
                                                className={cn(
                                                    'px-2.5 py-1 rounded-lg text-[10px] font-black border-2 transition-all',
                                                    nombreBase === n
                                                        ? 'bg-cyan-600 text-white border-cyan-700'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-700'
                                                )}>
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Perfiles */}
                            <div className="space-y-3">
                                {perfilesCalc.map(p => {
                                    const isEditing     = editingId === p.id;
                                    const totalGramos   = p.numBolas * p.pesoGramos;
                                    const nombreCompleto = `${nombreBase || 'Copa'} ${p.label}`;

                                    return (
                                        <div key={p.id} className={cn(
                                            'rounded-2xl border-2 overflow-hidden transition-all',
                                            p.activo ? 'border-cyan-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/70 opacity-60'
                                        )}>
                                            {/* Cabecera */}
                                            <div className={cn(
                                                'flex items-center gap-2 px-3 py-2.5 border-b',
                                                p.activo ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-100' : 'bg-slate-50 border-slate-100'
                                            )}>
                                                <button onClick={() => !isEditing && updatePerfil(p.id, { activo: !p.activo })}
                                                    className={cn(
                                                        'w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0',
                                                        p.activo ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-500'
                                                    )}>
                                                    {p.activo ? <Check className="w-3.5 h-3.5" /> : '✗'}
                                                </button>

                                                {isEditing ? (
                                                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                                                        <span className="text-[9px] font-black text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-md uppercase shrink-0">
                                                            Editando: {nombreCompleto}
                                                        </span>
                                                        <Input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                                                            placeholder="Etiqueta" className="h-7 w-20 text-xs font-black border-cyan-300" />
                                                        <div className="flex items-center gap-1">
                                                            <Input type="number" min="1" max="10" value={editBolas} onChange={e => setEditBolas(e.target.value)}
                                                                className="h-7 w-10 text-center text-xs font-black border-cyan-300" />
                                                            <span className="text-[9px] text-slate-400">bolas</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Input type="number" min="10" value={editPeso} onChange={e => setEditPeso(e.target.value)}
                                                                className="h-7 w-14 text-center text-xs font-black border-cyan-300" />
                                                            <span className="text-[9px] text-slate-400">g/bola</span>
                                                        </div>
                                                        <button onClick={saveEdit}
                                                            className="h-7 px-3 bg-cyan-600 text-white rounded-lg text-[10px] font-black hover:bg-cyan-700">
                                                            ✓ Guardar
                                                        </button>
                                                        <button onClick={() => setEditingId(null)}
                                                            className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-slate-800 text-sm leading-tight">{nombreCompleto}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold">
                                                                {p.numBolas} bola{p.numBolas > 1 ? 's' : ''} × {p.pesoGramos}g ={' '}
                                                                <span className="text-cyan-600 font-black">{totalGramos}g total</span>
                                                                {costoPorMl > 0 && <span className="text-slate-500 ml-1">({formatCurrency(p.costoHelado)} helado)</span>}
                                                            </p>
                                                        </div>
                                                        {p.activo && (
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-[9px] font-black text-slate-400">g/bola</span>
                                                                <Input type="number" value={p.pesoGramos}
                                                                    onChange={e => updatePerfil(p.id, { pesoGramos: parseInt(e.target.value) || 0 })}
                                                                    className="h-7 w-14 text-center text-xs font-black border-slate-200 rounded-lg" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-0.5 ml-1 shrink-0">
                                                            <button onClick={() => startEdit(p)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => deleteProfile(p.id)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Cuerpo: insumos + precio */}
                                            {p.activo && !isEditing && (
                                                <div className="p-3 grid grid-cols-2 gap-3">

                                                    {/* ─ Insumos del vaso ─ */}
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Insumos del vaso</p>

                                                        {p.extras.map((ex, i) => (
                                                            <div key={i} className="bg-slate-50 rounded-lg border border-slate-100 p-2 space-y-1.5">
                                                                <div className="flex items-start gap-1.5">
                                                                    <p className="text-[10px] font-black text-slate-700 flex-1 leading-tight">{ex.nombre}</p>
                                                                    <button onClick={() => removeExtra(p.id, i)}
                                                                        className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 mt-0.5">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] text-slate-400 font-bold shrink-0">por copa:</span>
                                                                    <Input type="number" min="0.1" step="0.5"
                                                                        value={ex.cantidadPorCopa}
                                                                        onChange={e => updateExtraCantidad(p.id, i, parseFloat(e.target.value) || 0)}
                                                                        className="h-6 w-14 text-center text-[10px] font-black border-slate-200 p-0 rounded-md" />
                                                                    <span className="text-[9px] text-slate-400 font-bold">{ex.unidad}</span>
                                                                    <span className="text-[9px] font-black text-cyan-700 ml-auto">{formatCurrency(ex.costoPorCopa)}</span>
                                                                </div>
                                                                <p className="text-[8px] text-slate-300">
                                                                    {formatCurrency(ex.costoPackTotal)} ÷ {ex.cantidadPack}{ex.unidad} = {formatCurrency(ex.costoPackTotal / ex.cantidadPack)}/{ex.unidad}
                                                                </p>
                                                            </div>
                                                        ))}

                                                        {p.extras.length === 0 && (
                                                            <p className="text-[9px] text-slate-300 italic">Sin insumos — agrega vaso, cuchara, gragea…</p>
                                                        )}

                                                        {addingExtraFor === p.id ? (
                                                            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 space-y-2">
                                                                <p className="text-[9px] font-black uppercase text-cyan-700">Nuevo insumo</p>

                                                                <select value={extraForm.productoId}
                                                                    onChange={e => setExtraForm(f => ({ ...f, productoId: e.target.value, cantidadPack: '' }))}
                                                                    className="w-full h-8 bg-white border border-cyan-200 rounded-lg px-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer">
                                                                    <option value="">Seleccionar insumo…</option>
                                                                    {extrasDisponibles.map(e => {
                                                                        const c = parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0');
                                                                        return <option key={e.id} value={e.id}>{e.nombre} — {formatCurrency(c)}</option>;
                                                                    })}
                                                                </select>

                                                                {extrasDisponibles.length === 0 && (
                                                                    <p className="text-[9px] text-amber-600 font-bold">Registra vasos y cucharas en Productos para que aparezcan.</p>
                                                                )}

                                                                {extraForm.productoId && (
                                                                    <>
                                                                        <div className="grid grid-cols-3 gap-1.5">
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Empaque tiene</p>
                                                                                <Input type="number" min="1" placeholder="ej: 500"
                                                                                    value={extraForm.cantidadPack}
                                                                                    onChange={e => setExtraForm(f => ({ ...f, cantidadPack: e.target.value }))}
                                                                                    className="h-7 text-xs font-black text-center border-cyan-200" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Unidad</p>
                                                                                <select value={extraForm.unidad}
                                                                                    onChange={e => setExtraForm(f => ({ ...f, unidad: e.target.value }))}
                                                                                    className="w-full h-7 bg-white border border-cyan-200 rounded-lg px-1.5 text-[10px] font-bold outline-none cursor-pointer">
                                                                                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Por copa</p>
                                                                                <Input type="number" min="0.1" step="0.5" placeholder="ej: 3"
                                                                                    value={extraForm.cantidadPorCopa}
                                                                                    onChange={e => setExtraForm(f => ({ ...f, cantidadPorCopa: e.target.value }))}
                                                                                    className="h-7 text-xs font-black text-center border-cyan-200" />
                                                                            </div>
                                                                        </div>
                                                                        {extraPreviewCosto > 0 && (
                                                                            <div className="flex items-center justify-between bg-white rounded-lg border border-cyan-200 px-3 py-1.5">
                                                                                <span className="text-[9px] text-slate-500 font-bold">Costo por copa</span>
                                                                                <span className="text-sm font-black text-cyan-700">{formatCurrency(extraPreviewCosto)}</span>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}

                                                                <div className="flex gap-2">
                                                                    <button onClick={confirmAddExtra}
                                                                        disabled={!extraForm.productoId || !extraForm.cantidadPack}
                                                                        className="flex-1 h-8 bg-cyan-600 text-white rounded-lg text-[10px] font-black hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                                                        ✓ Agregar
                                                                    </button>
                                                                    <button onClick={() => setAddingExtraFor(null)}
                                                                        className="h-8 px-3 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-50">
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => openAddExtra(p.id)}
                                                                className="w-full h-8 flex items-center justify-center gap-1.5 border border-dashed border-cyan-300 rounded-lg text-[9px] font-black uppercase text-cyan-600 hover:bg-cyan-50 transition-all">
                                                                <Plus className="w-3 h-3" /> Agregar insumo
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* ─ Panel precio ─ */}
                                                    <div className="bg-gradient-to-br from-slate-50 to-cyan-50 rounded-xl p-3 space-y-2 border border-cyan-100">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-slate-500 font-bold">Helado {totalGramos}g</span>
                                                                <span className="font-black text-slate-700">{formatCurrency(p.costoHelado)}</span>
                                                            </div>
                                                            {p.extras.map((ex, i) => (
                                                                <div key={i} className="flex justify-between text-[10px]">
                                                                    <span className="text-slate-400 font-bold truncate max-w-[60%]">
                                                                        {ex.cantidadPorCopa}{ex.unidad} {ex.nombre.split(' ')[0]}
                                                                    </span>
                                                                    <span className="font-black text-slate-600 shrink-0">+{formatCurrency(ex.costoPorCopa)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between text-[10px] font-black border-t border-cyan-100 pt-1.5">
                                                                <span className="text-slate-600">Costo total</span>
                                                                <span className="text-cyan-700">{formatCurrency(p.costoTotal)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase shrink-0">Precio $</span>
                                                            <Input type="number" value={p.precioVenta}
                                                                onChange={e => updatePerfil(p.id, { precioVenta: e.target.value })}
                                                                placeholder={Math.round(p.pvpCalculado).toString()}
                                                                className="h-7 flex-1 text-right text-xs font-black border-cyan-200 bg-white" />
                                                        </div>

                                                        <div className={cn(
                                                            'flex justify-between text-[10px] font-black rounded-lg px-2.5 py-1.5',
                                                            p.margenReal >= 30 ? 'bg-emerald-600 text-white' :
                                                            p.margenReal >= 15 ? 'bg-amber-500 text-white' :
                                                                                 'bg-rose-600 text-white'
                                                        )}>
                                                            <span>Margen</span>
                                                            <span>{p.margenReal.toFixed(0)}%</span>
                                                        </div>

                                                        <p className="text-[9px] font-bold text-blue-500 text-center">
                                                            ~{p.copasPosibles} copas con stock actual
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

                    {/* ════════ PASO 3 — RENTABILIDAD ════════ */}
                    {step === 3 && (
                        <>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-xs font-black text-blue-800">¿Cuántas copas de cada tamaño vendiste esta semana?</p>
                                <p className="text-[10px] text-blue-500 font-medium mt-0.5">Esto muestra si estás ganando o perdiendo con los helados</p>
                            </div>

                            <div className="space-y-2">
                                {perfilesCalc.filter(p => p.activo).map(p => (
                                    <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3">
                                        <span className="text-sm font-black text-slate-700 w-24 shrink-0">{`${nombreBase || 'Copa'} ${p.label}`}</span>
                                        <span className="text-[10px] font-bold text-slate-400 flex-1">
                                            Costo {formatCurrency(p.costoTotal)} → Venta {formatCurrency(p.pvpFinal)}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase">Vendidas</Label>
                                            <Input type="number" min={0} value={ventasSemana[p.id] || ''}
                                                onChange={e => setVentasSemana(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                placeholder="0" className="h-8 w-16 text-center font-black text-sm border-slate-200" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {analisisSemana.totalCopasVendidas > 0 && (
                                <div className="space-y-3">
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

                                    <div className={cn('rounded-2xl p-5 text-white space-y-3', analisisSemana.gananciaTotal > 0 ? 'bg-emerald-600' : 'bg-rose-600')}>
                                        <div className="flex items-center gap-2">
                                            {analisisSemana.gananciaTotal > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            <span className="font-black uppercase text-sm">Ganancia real esta semana</span>
                                        </div>
                                        <p className="text-5xl font-black">
                                            {analisisSemana.gananciaTotal > 0 ? '+' : ''}{formatCurrency(analisisSemana.gananciaTotal)}
                                        </p>
                                        <div className="bg-white/10 rounded-xl p-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
                                            <div className="flex justify-between col-span-2">
                                                <span className="opacity-70">Total ingresos</span>
                                                <span>{formatCurrency(analisisSemana.totalIngresos)}</span>
                                            </div>
                                            <div className="flex justify-between col-span-2">
                                                <span className="opacity-70">Total costos</span>
                                                <span>-{formatCurrency(analisisSemana.totalCostos)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {analisisSemana.gananciaTotal <= 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                <p className="text-xs font-black text-amber-800">¿Por qué no queda ganancia?</p>
                                            </div>
                                            <div className="space-y-1 text-[10px] text-amber-700 font-medium">
                                                {perfilesCalc.filter(p => p.activo && p.margenReal < 25).map(p => (
                                                    <p key={p.id}>• <strong>{p.label}:</strong> margen de solo {p.margenReal.toFixed(0)}% — precio ({formatCurrency(p.pvpFinal)}) bajo vs costo ({formatCurrency(p.costoTotal)})</p>
                                                ))}
                                                {perfilesCalc.filter(p => p.activo).every(p => p.margenReal >= 25) && (
                                                    <p>• Los márgenes están bien. El volumen ({analisisSemana.totalCopasVendidas} copas) no es suficiente para cubrir costos fijos.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="w-4 h-4 text-slate-600" />
                                            <p className="text-xs font-black text-slate-700">Punto de equilibrio semanal</p>
                                        </div>
                                        <p className="text-[11px] text-slate-600 font-medium">
                                            Para recuperar {formatCurrency(analisisSemana.costoCajasTotal)} de las cajas necesitas vender{' '}
                                            <strong className="text-slate-900">{analisisSemana.copasPuntoPequilibrio} copas</strong>.
                                        </p>
                                        <div className="mt-2 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', analisisSemana.totalCopasVendidas >= analisisSemana.copasPuntoPequilibrio ? 'bg-emerald-500' : 'bg-amber-500')}
                                                style={{ width: `${Math.min(100, analisisSemana.copasPuntoPequilibrio > 0 ? (analisisSemana.totalCopasVendidas / analisisSemana.copasPuntoPequilibrio) * 100 : 0)}%` }} />
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold mt-1">
                                            {analisisSemana.totalCopasVendidas} de {analisisSemana.copasPuntoPequilibrio} copas
                                        </p>
                                    </div>
                                </div>
                            )}

                            {analisisSemana.totalCopasVendidas === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-5xl mb-3">🍦</p>
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-300">Ingresa las ventas de la semana</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ════════ PASO 4 — GUARDAR ════════ */}
                    {step === 4 && (
                        <>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                Se crearán {perfilesCalc.filter(p => p.activo).length} producto(s) en el catálogo como <strong>"{nombreBase || 'Copa'} [tamaño]"</strong>
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {perfilesCalc.filter(p => p.activo).map(p => (
                                    <div key={p.id} className="bg-white rounded-2xl border-2 border-cyan-100 p-4 space-y-3 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-2xl">🍦</span>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{nombreBase || 'Copa'} {p.label}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{p.numBolas} bola(s) × {p.pesoGramos}g = {p.numBolas * p.pesoGramos}g</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-[10px]">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Costo helado</span>
                                                <span className="font-black">{formatCurrency(p.costoHelado)}</span>
                                            </div>
                                            {p.extras.map((ex, i) => (
                                                <div key={i} className="flex justify-between">
                                                    <span className="text-slate-400 font-bold truncate max-w-[60%]">{ex.cantidadPorCopa}{ex.unidad} {ex.nombre}</span>
                                                    <span className="font-black text-slate-500 shrink-0">+{formatCurrency(ex.costoPorCopa)}</span>
                                                </div>
                                            ))}
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
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
                    <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-11 px-5 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-slate-600">
                        {step === 1 ? 'Cerrar' : <><ChevronLeft className="w-4 h-4 mr-1" />Atrás</>}
                    </Button>
                    {step < 4 ? (
                        <Button
                            disabled={step === 1 && selectedIds.length === 0}
                            onClick={() => setStep(step + 1)}
                            className="h-11 flex-1 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                            {step === 3 ? 'Ver resumen' : 'Siguiente'} <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button disabled={loading} onClick={handleSave}
                            className="h-11 flex-1 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                            {loading ? 'Guardando…' : `Guardar ${perfilesCalc.filter(p => p.activo).length} producto(s) ✓`}
                        </Button>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
}
