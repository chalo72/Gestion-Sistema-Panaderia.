import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check, X, Plus, Trash2, Minus, Pencil } from 'lucide-react';
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
    unidadesEnPack: number;
    costoUnitario: number;
    unidad: string;
    cantidadPorCopa: number;
    costoPorCopa: number;
}

interface BolaItem {
    id: string;
    pesoGramos: number;
}

interface BaseConfig {
    bolasLista: BolaItem[];
    extrasProducto: ExtraCopa[];
    margenVenta: number;
    precioVentaManual: string;
    mlPorCaja: string;
}

interface IceCreamAssistantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productos: any[];
    precios: any[];
    onAddProducto: (producto: any) => Promise<any>;
    onUpdateProducto?: (id: string, updates: any) => void;
    onDeleteProducto?: (id: string) => void;
    formatCurrency: (val: number) => string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const CONFIGS_KEY = 'ice_cream_base_configs_v3';

const getStoredConfigs = (): Record<string, BaseConfig> => {
    try { return JSON.parse(localStorage.getItem(CONFIGS_KEY) || '{}'); } catch { return {}; }
};

const saveConfig = (name: string, config: BaseConfig) => {
    const all = getStoredConfigs();
    all[name] = config;
    const keys = Object.keys(all);
    if (keys.length > 12) delete all[keys[0]];
    localStorage.setItem(CONFIGS_KEY, JSON.stringify(all));
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIDADES = ['und', 'g', 'ml', 'kg'];

let _nextId = 10;
const nextId = () => `b${_nextId++}`;

// ─── Componente ───────────────────────────────────────────────────────────────

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios,
    onAddProducto, onUpdateProducto, onDeleteProducto,
    formatCurrency
}: IceCreamAssistantModalProps) {
    const [mode, setMode]                         = useState<'wizard' | 'history'>('wizard');
    const [step, setStep]                         = useState(1);
    const [loading, setLoading]                   = useState(false);
    const [editingProductoId, setEditingProductoId] = useState<string | null>(null);

    // Paso 1
    interface CajaSeleccionada { id: string; cajas: number; }
    const [cajasSeleccionadas, setCajasSeleccionadas] = useState<CajaSeleccionada[]>([]);
    const [mlPorCaja, setMlPorCaja] = useState('10000');

    // Paso 2
    const [nombreBase, setNombreBase]             = useState('');
    const [showSuggestions, setShowSuggestions]   = useState(false);
    const [bolasLista, setBolasLista]             = useState<BolaItem[]>([{ id: 'b1', pesoGramos: 80 }]);
    const [extrasProducto, setExtrasProducto]     = useState<ExtraCopa[]>([]);
    const [margenVenta, setMargenVenta]           = useState(45);
    const [precioVentaManual, setPrecioVentaManual] = useState('');
    const [configsGuardadas, setConfigsGuardadas] = useState<Record<string, BaseConfig>>({});
    const [addingExtra, setAddingExtra]           = useState(false);
    const [editingExtraIdx, setEditingExtraIdx]   = useState<number | null>(null);
    const [extraForm, setExtraForm]               = useState({ productoId: '', precioPack: '', unidadesEnPack: '', unidad: 'und', cantidadPorCopa: '1' });

    // ── Filtros ───────────────────────────────────────────────────────────────

    const selectedIds = cajasSeleccionadas.map(c => c.id);

    const insumosLista = useMemo(() => productos.filter(p => {
        const cat = (p.categoria || '').toLowerCase();
        const n   = p.nombre.toLowerCase();
        return (cat.includes('helado') || n.includes('helado') || n.includes('10l') || n.includes('litro'))
            && p.tipo !== 'elaborado';
    }), [productos]);

    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n  = p.nombre.toLowerCase();
        const kw = ['vaso', 'salsa', 'cono', 'cuchara', 'grajea', 'gragea', 'chispa', 'topping', 'bolsa', 'cucharita'];
        return (p.tipo === 'ingrediente' || p.tipo === 'insumo') && kw.some(k => n.includes(k));
    }), [productos]);

    // ── Helados existentes (historial) ───────────────────────────────────────
    const heladosProductos = useMemo(() =>
        productos
            .filter(p => (p.categoria || '').trim().toLowerCase() === 'helados pre')
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
    , [productos]);

    // Categorías únicas para diagnóstico (solo cuando lista vacía)
    const todasCategorias = useMemo(() =>
        [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort()
    , [productos]);

    // ── Sugerencias de nombre ─────────────────────────────────────────────────

    const sugerenciasNombre = useMemo(() => {
        const fromConfigs   = Object.keys(configsGuardadas);
        const fromProductos = productos
            .filter(p => (p.categoria || '').toLowerCase().includes('helado') || p.tipo === 'elaborado')
            .map(p => p.nombre);
        const all = [...new Set([...fromConfigs, ...fromProductos])];
        if (!nombreBase.trim()) return all;
        const q = nombreBase.toLowerCase();
        return all.filter(n => n.toLowerCase().includes(q));
    }, [configsGuardadas, productos, nombreBase]);

    // ── Cálculos paso 1 ───────────────────────────────────────────────────────

    const mlPorCajaNum = parseFloat(mlPorCaja) || 10000;

    const { totalCostoCajas, totalMlDisponible, promedioMaestro, totalCajas } = useMemo(() => {
        let totalCosto = 0, totalC = 0;
        cajasSeleccionadas.forEach(({ id, cajas }) => {
            const vals = precios
                .filter(pr => pr.productoId === id)
                .map(pr => parseFloat(pr.precioCosto?.toString() || '0'))
                .filter(v => v > 0);
            const precioPromCaja = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            totalCosto += precioPromCaja * cajas;
            totalC     += cajas;
        });
        return {
            totalCostoCajas:   totalCosto,
            totalMlDisponible: totalC * mlPorCajaNum,
            promedioMaestro:   totalC > 0 ? totalCosto / totalC : 0,
            totalCajas:        totalC,
        };
    }, [cajasSeleccionadas, precios, mlPorCajaNum]);

    const costoPorMl    = mlPorCajaNum > 0 ? promedioMaestro / mlPorCajaNum : 0;
    const costoPor1000g = costoPorMl * 1000;

    // ── Cálculos paso 2 ───────────────────────────────────────────────────────

    const { totalGramos, costoHeladoTotal, costoTotal, precioVentaCalculado, precioFinal, margenReal, copasPosibles } = useMemo(() => {
        const totalG  = bolasLista.reduce((s, b) => s + b.pesoGramos, 0);
        const costoH  = totalG * costoPorMl;
        const costoE  = extrasProducto.reduce((s, e) => s + e.costoPorCopa, 0);
        const costoT  = costoH + costoE;
        const pvpCalc = margenVenta < 100 ? costoT / (1 - margenVenta / 100) : costoT * 2;
        const pvpFin  = precioVentaManual ? (parseFloat(precioVentaManual) || pvpCalc) : pvpCalc;
        const mReal   = pvpFin > 0 ? ((pvpFin - costoT) / pvpFin) * 100 : 0;
        const copas   = totalG > 0 ? Math.floor(totalMlDisponible / totalG) : 0;
        return {
            totalGramos:          totalG,
            costoHeladoTotal:     costoH,
            costoTotal:           costoT,
            precioVentaCalculado: pvpCalc,
            precioFinal:          pvpFin,
            margenReal:           mReal,
            copasPosibles:        copas,
        };
    }, [bolasLista, extrasProducto, margenVenta, precioVentaManual, costoPorMl, totalMlDisponible]);

    // ── Preview costo insumo ──────────────────────────────────────────────────

    const extraPackCosto = useMemo(() => {
        // Campo manual tiene prioridad
        if (extraForm.precioPack) return parseFloat(extraForm.precioPack) || 0;
        if (!extraForm.productoId) return 0;
        // Buscar en tabla de precios
        const precObj = precios.find(pr => pr.productoId === extraForm.productoId);
        const desdePrecio = parseFloat(precObj?.precioCosto?.toString() || '0');
        if (desdePrecio > 0) return desdePrecio;
        // Fallback a costoBase del producto
        const prod = productos.find(p => p.id === extraForm.productoId);
        return parseFloat(prod?.costoBase?.toString() || prod?.precioVenta?.toString() || '0');
    }, [extraForm.productoId, extraForm.precioPack, precios, productos]);

    const extraUnitarioCosto = useMemo(() => {
        const pack = parseFloat(extraForm.unidadesEnPack) || 0;
        return pack > 0 ? extraPackCosto / pack : extraPackCosto;
    }, [extraPackCosto, extraForm.unidadesEnPack]);

    const extraPreviewCosto = useMemo(() => {
        const porCopa = parseFloat(extraForm.cantidadPorCopa) || 1;
        return extraUnitarioCosto * porCopa;
    }, [extraUnitarioCosto, extraForm.cantidadPorCopa]);

    // ── Handlers paso 1 ──────────────────────────────────────────────────────

    const toggleCaja = (id: string) =>
        setCajasSeleccionadas(prev =>
            prev.some(c => c.id === id) ? prev.filter(c => c.id !== id) : [...prev, { id, cajas: 1 }]
        );

    const setCajasCount = (id: string, delta: number) =>
        setCajasSeleccionadas(prev => prev.map(c => c.id === id ? { ...c, cajas: Math.max(1, c.cajas + delta) } : c));

    // ── Handlers paso 2 ──────────────────────────────────────────────────────

    const loadConfig = (name: string) => {
        setNombreBase(name);
        setShowSuggestions(false);
        const cfg = configsGuardadas[name];
        if (cfg) {
            setBolasLista(cfg.bolasLista?.length ? cfg.bolasLista : [{ id: 'b1', pesoGramos: 80 }]);
            setExtrasProducto(cfg.extrasProducto || []);
            setMargenVenta(cfg.margenVenta ?? 45);
            setPrecioVentaManual(cfg.precioVentaManual || '');
            if (cfg.mlPorCaja) setMlPorCaja(cfg.mlPorCaja);
            toast.success(`Config "${name}" cargada`);
        }
    };

    const addBola = () =>
        setBolasLista(prev => [...prev, { id: nextId(), pesoGramos: 80 }]);

    const updateBola = (id: string, pesoGramos: number) =>
        setBolasLista(prev => prev.map(b => b.id === id ? { ...b, pesoGramos } : b));

    const removeBola = (id: string) =>
        setBolasLista(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev);

    const openAddExtra = () => {
        setEditingExtraIdx(null);
        setAddingExtra(true);
        setExtraForm({ productoId: '', precioPack: '', unidadesEnPack: '', unidad: 'und', cantidadPorCopa: '1' });
    };

    const openEditExtra = (idx: number) => {
        const ex = extrasProducto[idx];
        setEditingExtraIdx(idx);
        setAddingExtra(true);
        setExtraForm({
            productoId:      ex.productoId,
            precioPack:      ex.costoPackTotal > 0 ? ex.costoPackTotal.toString() : '',
            unidadesEnPack:  ex.unidadesEnPack.toString(),
            unidad:          ex.unidad,
            cantidadPorCopa: ex.cantidadPorCopa.toString(),
        });
    };

    const confirmAddExtra = () => {
        if (!extraForm.productoId || !extraForm.unidadesEnPack || !extraForm.precioPack) return;
        const prod = productos.find(p => p.id === extraForm.productoId);
        if (!prod) return;
        const costoPackTotal  = extraPackCosto;
        const unidadesEnPack  = parseFloat(extraForm.unidadesEnPack) || 1;
        const costoUnitario   = costoPackTotal / unidadesEnPack;
        const cantidadPorCopa = parseFloat(extraForm.cantidadPorCopa) || 1;
        const costoPorCopa    = costoUnitario * cantidadPorCopa;
        const item = { productoId: prod.id, nombre: prod.nombre, costoPackTotal, unidadesEnPack, costoUnitario, unidad: extraForm.unidad, cantidadPorCopa, costoPorCopa };
        if (editingExtraIdx !== null) {
            setExtrasProducto(prev => prev.map((ex, i) => i === editingExtraIdx ? item : ex));
            toast.success(`${prod.nombre} actualizado`);
        } else {
            setExtrasProducto(prev => [...prev, item]);
            toast.success(`${prod.nombre} añadido — ${formatCurrency(costoUnitario)} c/u`);
        }
        setAddingExtra(false);
        setEditingExtraIdx(null);
    };

    const updateExtraCantidad = (idx: number, newVal: number) =>
        setExtrasProducto(prev => prev.map((ex, i) => i !== idx ? ex : {
            ...ex,
            cantidadPorCopa: newVal,
            costoPorCopa: ex.costoUnitario * newVal,
        }));

    const removeExtra = (idx: number) =>
        setExtrasProducto(prev => prev.filter((_, i) => i !== idx));

    // ── openForEdit ──────────────────────────────────────────────────────────

    const openForEdit = (producto: any) => {
        const cfg = configsGuardadas[producto.nombre];
        if (cfg) {
            setBolasLista(cfg.bolasLista?.length ? cfg.bolasLista : [{ id: 'b1', pesoGramos: 80 }]);
            setExtrasProducto(cfg.extrasProducto || []);
            setMargenVenta(cfg.margenVenta ?? 45);
            setPrecioVentaManual(cfg.precioVentaManual || '');
            if (cfg.mlPorCaja) setMlPorCaja(cfg.mlPorCaja);
        } else {
            setBolasLista([{ id: 'b1', pesoGramos: 80 }]);
            setExtrasProducto([]);
            setMargenVenta(producto.margenUtilidad ? parseInt(producto.margenUtilidad) : 45);
            setPrecioVentaManual(producto.precioVenta?.toString() || '');
        }
        setNombreBase(producto.nombre);
        setEditingProductoId(producto.id);
        setMode('wizard');
        setStep(2);
    };

    // ── Save ─────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        const nombre = nombreBase.trim();
        if (!nombre) { toast.error('Escribe el nombre del producto'); return; }
        setLoading(true);
        const datos = {
            nombre,
            categoria:      'HELADOS PRE',
            descripcion:    `${bolasLista.length} bola(s) × ${bolasLista.map(b => b.pesoGramos + 'g').join(' + ')} = ${totalGramos}g. Costo: ${formatCurrency(costoTotal)}.`,
            precioVenta:    Math.round(precioFinal),
            margenUtilidad: margenReal.toFixed(0),
            tipo:           'elaborado',
            unidadMedida:   'unidad',
            costoBase:      costoTotal,
        };
        try {
            if (editingProductoId && onUpdateProducto) {
                onUpdateProducto(editingProductoId, datos);
                toast.success(`"${nombre}" actualizado ✓`);
            } else {
                await onAddProducto(datos);
                toast.success(`"${nombre}" creado ✓`);
            }
            saveConfig(nombre, { bolasLista, extrasProducto, margenVenta, precioVentaManual, mlPorCaja });
            setMode('history');
            resetWizard();
        } catch { toast.error('Error al guardar'); }
        finally { setLoading(false); }
    };

    const resetWizard = () => {
        setStep(1);
        setCajasSeleccionadas([]);
        setMlPorCaja('10000');
        setNombreBase('');
        setShowSuggestions(false);
        setBolasLista([{ id: 'b1', pesoGramos: 80 }]);
        setExtrasProducto([]);
        setMargenVenta(45);
        setPrecioVentaManual('');
        setAddingExtra(false);
        setEditingExtraIdx(null);
        setEditingProductoId(null);
        setExtraForm({ productoId: '', precioPack: '', unidadesEnPack: '', unidad: 'und', cantidadPorCopa: '1' });
    };

    const reset = () => {
        setMode('wizard');
        resetWizard();
    };

    React.useEffect(() => {
        if (!isOpen) return;
        reset();
        const v3 = getStoredConfigs();
        // Migrar configs v2 (perfiles múltiples) → v3 (producto único por perfil)
        try {
            const v2Raw = localStorage.getItem('ice_cream_base_configs_v2');
            if (v2Raw) {
                const v2 = JSON.parse(v2Raw) as Record<string, any>;
                let changed = false;
                for (const [baseName, cfg] of Object.entries(v2)) {
                    const perfiles: any[] = cfg.perfiles || [];
                    for (const p of perfiles) {
                        if (!p.activo) continue;
                        const nombre = `${baseName} ${p.label}`;
                        if (!v3[nombre]) {
                            v3[nombre] = {
                                bolasLista: Array.from({ length: p.numBolas || 1 }, (_, i) => ({ id: `lg${i}`, pesoGramos: p.pesoGramos || 80 })),
                                extrasProducto: (p.extras || []).map((ex: any) => ({
                                    productoId:    ex.productoId || '',
                                    nombre:        ex.nombre || '',
                                    costoPackTotal: ex.costoPackTotal || 0,
                                    unidadesEnPack: ex.cantidadPack || 1,
                                    costoUnitario: (ex.cantidadPack || 1) > 0 ? (ex.costoPackTotal || 0) / (ex.cantidadPack || 1) : 0,
                                    unidad:        ex.unidad || 'und',
                                    cantidadPorCopa: ex.cantidadPorCopa || 1,
                                    costoPorCopa:  ex.costoPorCopa || 0,
                                })),
                                margenVenta:        p.margen || 45,
                                precioVentaManual:  p.precioVenta || '',
                                mlPorCaja:          cfg.mlPorCaja || '10000',
                            };
                            changed = true;
                        }
                    }
                }
                if (changed) localStorage.setItem(CONFIGS_KEY, JSON.stringify(v3));
            }
        } catch {}
        setConfigsGuardadas(v3);
    }, [isOpen]);

    const STEP_LABELS = ['Cajas', 'Configurar', 'Guardar'];

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">

                {/* ── Header ─────────────────────────────────────────────── */}
                <DialogHeader className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
                    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">🍦</div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-black text-white leading-tight">Asistente de Helados</DialogTitle>
                                <p className="text-[9px] font-bold text-cyan-100/80 uppercase tracking-widest">
                                    {mode === 'history'
                                        ? `${heladosProductos.length} producto(s) registrado(s)`
                                        : `Paso ${step} de 3 — ${STEP_LABELS[step - 1]}`}
                                </p>
                            </div>
                        </div>
                        {mode === 'wizard' && (
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
                                        {i < 2 && <div className={cn('h-0.5 w-4 rounded-full', step > i + 1 ? 'bg-white/60' : 'bg-white/20')} />}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Pestañas */}
                    <div className="flex border-t border-white/20">
                        <button
                            onClick={() => { setMode('wizard'); resetWizard(); }}
                            className={cn(
                                'flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                                mode === 'wizard' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                            )}>
                            + Crear nuevo
                        </button>
                        <button
                            onClick={() => setMode('history')}
                            className={cn(
                                'flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                                mode === 'history' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                            )}>
                            Mis Helados {heladosProductos.length > 0 && `(${heladosProductos.length})`}
                        </button>
                    </div>
                </DialogHeader>

                {/* ── Contenido ──────────────────────────────────────────── */}
                <div className="p-5 max-h-[64vh] overflow-y-auto space-y-4">

                    {/* ════════ HISTORIAL — MIS HELADOS ════════ */}
                    {mode === 'history' && (
                        <>
                            {heladosProductos.length === 0 ? (
                                <div className="space-y-4">
                                    <div className="text-center py-6">
                                        <p className="text-4xl mb-2">🍦</p>
                                        <p className="text-sm font-black uppercase tracking-widest text-slate-300">Sin productos en "HELADOS PRE"</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                                        <p className="text-[9px] font-black uppercase text-amber-700 tracking-widest">Categorías encontradas en el sistema ({todasCategorias.length})</p>
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                            {todasCategorias.map(cat => (
                                                <button key={cat} onClick={() => {/* diagnóstico */}}
                                                    className="text-[9px] font-bold bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-100">
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[8px] text-amber-500">Dime cuál de estas es la categoría de tus vasos/bolas</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {heladosProductos.map(p => {
                                        const cfg = configsGuardadas[p.nombre];
                                        const allPr = precios.filter(pr => pr.productoId === p.id);
                                        const costoReg = allPr.length > 0
                                            ? allPr.reduce((s, pr) => s + parseFloat(pr.precioCosto?.toString() || '0'), 0) / allPr.length
                                            : p.costoBase || 0;
                                        const precioV = parseFloat(p.precioVenta?.toString() || '0');
                                        const margen  = precioV > 0 ? ((precioV - costoReg) / precioV * 100) : parseFloat(p.margenUtilidad?.toString() || '0');
                                        return (
                                            <div key={p.id} className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm">
                                                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-slate-100">
                                                    <span className="text-2xl shrink-0">🍦</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-slate-800 text-sm truncate">{p.nombre}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold">
                                                            {cfg ? `${cfg.bolasLista?.length || '?'} bola(s) · ${cfg.bolasLista?.reduce((s: number, b: any) => s + b.pesoGramos, 0) || '?'}g` : 'Sin config guardada'}
                                                            {cfg && <span className="text-cyan-500 ml-1">· Config ✓</span>}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(precioV)}</p>
                                                        <p className={cn(
                                                            'text-[9px] font-black',
                                                            margen >= 30 ? 'text-emerald-500' : margen >= 15 ? 'text-amber-500' : 'text-rose-500'
                                                        )}>{margen.toFixed(0)}% margen</p>
                                                    </div>
                                                </div>
                                                {cfg && cfg.extrasProducto?.length > 0 && (
                                                    <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-slate-50">
                                                        {cfg.extrasProducto.map((ex: ExtraCopa, i: number) => (
                                                            <span key={i} className="text-[8px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                                {ex.cantidadPorCopa}{ex.unidad} {ex.nombre.split(' ')[0]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex">
                                                    <button
                                                        onClick={() => openForEdit(p)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black text-cyan-600 hover:bg-cyan-50 transition-colors border-r border-slate-100">
                                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                                    </button>
                                                    {onDeleteProducto ? (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`¿Eliminar "${p.nombre}"?`)) {
                                                                    onDeleteProducto(p.id);
                                                                    toast.success(`"${p.nombre}" eliminado`);
                                                                }
                                                            }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black text-rose-500 hover:bg-rose-50 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                        </button>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center py-2.5 text-[9px] text-slate-300">
                                                            Eliminar desde Productos
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ════════ PASO 1 — CAJAS ════════ */}
                    {mode === 'wizard' && step === 1 && (
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
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                        Selecciona los sabores que tienes abiertos
                                    </p>
                                    {insumosLista.length > 0 && (
                                        <button
                                            onClick={() => {
                                                if (cajasSeleccionadas.length === insumosLista.length) {
                                                    setCajasSeleccionadas([]);
                                                } else {
                                                    setCajasSeleccionadas(insumosLista.map(p => ({
                                                        id: p.id,
                                                        cajas: cajasSeleccionadas.find(c => c.id === p.id)?.cajas ?? 1,
                                                    })));
                                                }
                                            }}
                                            className="text-[9px] font-black text-cyan-600 hover:text-cyan-800 underline underline-offset-2 transition-colors">
                                            {cajasSeleccionadas.length === insumosLista.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                        </button>
                                    )}
                                </div>
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

                    {/* ════════ PASO 2 — CONFIGURAR PRODUCTO ════════ */}
                    {mode === 'wizard' && step === 2 && (
                        <>
                            {/* ─ Nombre con autocompletado ─ */}
                            <div className="relative">
                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">
                                    Nombre del producto
                                </Label>
                                <Input
                                    value={nombreBase}
                                    onChange={e => { setNombreBase(e.target.value); setShowSuggestions(true); }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                    placeholder="Ej: Vaso 7 onzas, Copa Fruttare, Paleta…"
                                    className="h-11 text-sm font-black"
                                />
                                {showSuggestions && sugerenciasNombre.length > 0 && (
                                    <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                                        {sugerenciasNombre.map(name => (
                                            <button key={name}
                                                onMouseDown={() => loadConfig(name)}
                                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 flex items-center gap-2 border-b border-slate-50 last:border-0">
                                                {configsGuardadas[name] ? (
                                                    <span className="text-[8px] font-black bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-md uppercase shrink-0">Config</span>
                                                ) : (
                                                    <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase shrink-0">Producto</span>
                                                )}
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ─ Bolas de helado ─ */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bolas de helado</p>
                                    <span className="text-[9px] font-black text-cyan-600">{totalGramos}g total</span>
                                </div>

                                {bolasLista.map((b, idx) => {
                                    const costoBola = b.pesoGramos * costoPorMl;
                                    return (
                                        <div key={b.id} className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5">
                                            <span className="text-[11px] font-black text-cyan-600 w-14 shrink-0">Bola {idx + 1}</span>
                                            <Input
                                                type="number" min="10" max="500"
                                                value={b.pesoGramos}
                                                onChange={e => updateBola(b.id, parseInt(e.target.value) || 0)}
                                                className="h-8 w-20 text-center font-black text-sm border-slate-200"
                                            />
                                            <span className="text-[9px] text-slate-400 font-bold">gramos</span>
                                            {costoPorMl > 0 && (
                                                <span className="text-[10px] font-black text-cyan-700 ml-auto">{formatCurrency(costoBola)}</span>
                                            )}
                                            {bolasLista.length > 1 && (
                                                <button onClick={() => removeBola(b.id)}
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}

                                <button onClick={addBola}
                                    className="w-full h-8 flex items-center justify-center gap-1.5 border border-dashed border-cyan-300 rounded-xl text-[9px] font-black uppercase text-cyan-600 hover:bg-cyan-50 transition-all">
                                    <Plus className="w-3 h-3" /> Agregar bola
                                </button>
                            </div>

                            {/* ─ Insumos del vaso ─ */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Insumos del vaso <span className="font-normal normal-case">(vaso, cuchara, gragea…)</span></p>

                                {extrasProducto.map((ex, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg border border-slate-100 p-2.5 flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-700 truncate">{ex.nombre}</p>
                                            <p className="text-[8px] text-slate-400">
                                                {formatCurrency(ex.costoPackTotal)} ÷ {ex.unidadesEnPack} = {formatCurrency(ex.costoUnitario)} c/u · {ex.cantidadPorCopa}{ex.unidad} por copa
                                            </p>
                                        </div>
                                        <span className="text-[11px] font-black text-cyan-700 shrink-0">{formatCurrency(ex.costoPorCopa)}</span>
                                        <button onClick={() => openEditExtra(i)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-cyan-600 hover:bg-cyan-50 transition-colors shrink-0">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => removeExtra(i)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}

                                {addingExtra ? (
                                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 space-y-2.5">
                                        <p className="text-[9px] font-black uppercase text-cyan-700">
                                            {editingExtraIdx !== null ? `✏️ Editar insumo #${editingExtraIdx + 1}` : 'Nuevo insumo'}
                                        </p>

                                        {/* 1. Seleccionar producto */}
                                        <select value={extraForm.productoId}
                                            onChange={e => {
                                                const pid = e.target.value;
                                                const precObj = precios.find(pr => pr.productoId === pid);
                                                const desdePrecio = parseFloat(precObj?.precioCosto?.toString() || '0');
                                                let autoPrice = '';
                                                if (desdePrecio > 0) {
                                                    autoPrice = desdePrecio.toString();
                                                } else if (pid) {
                                                    const prod = productos.find(p => p.id === pid);
                                                    const fallback = parseFloat(prod?.costoBase?.toString() || prod?.precioVenta?.toString() || '0');
                                                    if (fallback > 0) autoPrice = fallback.toString();
                                                }
                                                setExtraForm(f => ({ ...f, productoId: pid, precioPack: autoPrice, unidadesEnPack: '' }));
                                            }}
                                            className="w-full h-8 bg-white border border-cyan-200 rounded-lg px-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer">
                                            <option value="">① Seleccionar insumo…</option>
                                            {extrasDisponibles.map(e => {
                                                const c = parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0');
                                                return <option key={e.id} value={e.id}>{e.nombre}{c > 0 ? ` — ${formatCurrency(c)}/paquete` : ''}</option>;
                                            })}
                                        </select>

                                        {extrasDisponibles.length === 0 && (
                                            <p className="text-[9px] text-amber-600 font-bold">Registra vasos y cucharas en Productos para que aparezcan.</p>
                                        )}

                                        {extraForm.productoId && (
                                            <>
                                                {/* Precio del paquete — editable */}
                                                <div>
                                                    <p className="text-[8px] font-black text-slate-600 mb-1">
                                                        ① ¿Cuánto costó el paquete?
                                                        <span className="font-normal text-slate-400 ml-1">(precio total que pagaste)</span>
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] text-slate-400 font-bold">$</span>
                                                        <Input type="number" min="0" placeholder="ej: 3000"
                                                            value={extraForm.precioPack}
                                                            onChange={e => setExtraForm(f => ({ ...f, precioPack: e.target.value }))}
                                                            className="h-8 w-32 text-center font-black text-sm border-cyan-300 bg-white" />
                                                        {extraForm.precioPack && parseFloat(extraForm.precioPack) > 0 && (
                                                            <span className="text-[9px] font-bold text-emerald-600">✓ {formatCurrency(parseFloat(extraForm.precioPack))}</span>
                                                        )}
                                                        {!extraForm.precioPack && (
                                                            <span className="text-[9px] text-amber-500 font-bold">Ingresa el precio del paquete</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 2. Unidades en el paquete */}
                                                <div>
                                                    <p className="text-[8px] font-black text-slate-600 mb-1">
                                                        ② ¿Cuántas unidades trae ese paquete?
                                                        <span className="font-normal text-slate-400 ml-1">(ej: 100 cucharitas, 50 vasos)</span>
                                                    </p>

                                                    <div className="flex items-center gap-2">
                                                        <Input type="number" min="1" placeholder="ej: 100"
                                                            value={extraForm.unidadesEnPack}
                                                            onChange={e => setExtraForm(f => ({ ...f, unidadesEnPack: e.target.value }))}
                                                            className="h-8 w-24 text-center font-black text-sm border-cyan-300 bg-white" />
                                                        <select value={extraForm.unidad}
                                                            onChange={e => setExtraForm(f => ({ ...f, unidad: e.target.value }))}
                                                            className="h-8 bg-white border border-cyan-200 rounded-lg px-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer">
                                                            {UNIDADES.map(u => <option key={u}>{u}</option>)}
                                                        </select>
                                                        {extraForm.unidadesEnPack && parseFloat(extraForm.unidadesEnPack) > 0 && (
                                                            <span className="text-[9px] font-black text-slate-500">
                                                                = <span className="text-cyan-700">{formatCurrency(extraUnitarioCosto)}</span> c/u
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 3. Cantidad por copa */}
                                                {extraForm.unidadesEnPack && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-600 mb-1">
                                                            ③ ¿Cuántas usas por copa?
                                                        </p>
                                                        <Input type="number" min="0.1" step="1" placeholder="1"
                                                            value={extraForm.cantidadPorCopa}
                                                            onChange={e => setExtraForm(f => ({ ...f, cantidadPorCopa: e.target.value }))}
                                                            className="h-8 w-24 text-center font-black text-sm border-cyan-300 bg-white" />
                                                    </div>
                                                )}

                                                {/* Resultado */}
                                                {extraForm.unidadesEnPack && parseFloat(extraForm.unidadesEnPack) > 0 && (
                                                    <div className="flex items-center justify-between bg-cyan-600 rounded-lg px-3 py-2">
                                                        <span className="text-[9px] text-white/80 font-bold">Costo por copa</span>
                                                        <span className="text-base font-black text-white">{formatCurrency(extraPreviewCosto)}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        <div className="flex gap-2">
                                            <button onClick={confirmAddExtra}
                                                disabled={!extraForm.productoId || !extraForm.precioPack || !extraForm.unidadesEnPack}
                                                className="flex-1 h-8 bg-cyan-700 text-white rounded-lg text-[10px] font-black hover:bg-cyan-800 disabled:opacity-40 disabled:cursor-not-allowed">
                                                {editingExtraIdx !== null ? '✓ Guardar cambios' : '✓ Agregar'}
                                            </button>
                                            <button onClick={() => { setAddingExtra(false); setEditingExtraIdx(null); }}
                                                className="h-8 px-3 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-50">
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={openAddExtra}
                                        className="w-full h-8 flex items-center justify-center gap-1.5 border border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-cyan-600 hover:border-cyan-300 hover:bg-cyan-50 transition-all">
                                        <Plus className="w-3 h-3" /> Agregar insumo
                                    </button>
                                )}
                            </div>

                            {/* ─ Panel de precio (oscuro) ─ */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 space-y-3 text-white">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Costo y precio de venta</p>

                                <div className="space-y-1.5 text-[10px]">
                                    {bolasLista.map((b, idx) => (
                                        <div key={b.id} className="flex justify-between">
                                            <span className="text-white/50">Bola {idx + 1} ({b.pesoGramos}g)</span>
                                            <span className="font-black text-white/80">
                                                {costoPorMl > 0 ? formatCurrency(b.pesoGramos * costoPorMl) : '—'}
                                            </span>
                                        </div>
                                    ))}
                                    {extrasProducto.map((ex, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span className="text-white/50 truncate max-w-[60%]">{ex.cantidadPorCopa}{ex.unidad} {ex.nombre.split(' ')[0]}</span>
                                            <span className="font-black text-white/80">+{formatCurrency(ex.costoPorCopa)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-black border-t border-white/10 pt-2 text-[11px]">
                                        <span className="text-white/70">Costo total</span>
                                        <span className="text-cyan-400">{formatCurrency(costoTotal)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-white/50 uppercase shrink-0 w-16">Margen %</span>
                                    <input
                                        type="range" min="5" max="80" step="5"
                                        value={margenVenta}
                                        onChange={e => { setMargenVenta(parseInt(e.target.value)); setPrecioVentaManual(''); }}
                                        className="flex-1 accent-cyan-400"
                                    />
                                    <span className="text-sm font-black text-cyan-400 w-10 text-right">{margenVenta}%</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-white/50 uppercase shrink-0 w-16">Precio $</span>
                                    <Input
                                        type="number"
                                        value={precioVentaManual}
                                        onChange={e => setPrecioVentaManual(e.target.value)}
                                        placeholder={Math.round(precioVentaCalculado).toString()}
                                        className="h-9 flex-1 text-right font-black bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:bg-white/15"
                                    />
                                    {precioVentaManual && (
                                        <button onClick={() => setPrecioVentaManual('')}
                                            className="text-white/30 hover:text-white/70 shrink-0 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className={cn(
                                    'flex justify-between items-center rounded-xl px-3 py-2 text-[11px] font-black',
                                    margenReal >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                    margenReal >= 15 ? 'bg-amber-500/20 text-amber-400' :
                                                       'bg-rose-500/20 text-rose-400'
                                )}>
                                    <span>Margen real sobre venta</span>
                                    <span className="text-base">{margenReal.toFixed(0)}%</span>
                                </div>

                                {copasPosibles > 0 && (
                                    <p className="text-[9px] font-black text-white/30 text-center">
                                        ~{copasPosibles} copas posibles con el stock actual
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* ════════ PASO 3 — CONFIRMAR Y GUARDAR ════════ */}
                    {mode === 'wizard' && step === 3 && (
                        <>
                            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                                <p className="text-xs font-black text-cyan-800">Confirma el producto antes de guardarlo en el catálogo</p>
                                <p className="text-[10px] text-cyan-600 mt-0.5 font-medium">Se creará 1 producto en "Helados" con precio de venta {formatCurrency(precioFinal)}</p>
                            </div>

                            <div className="bg-white rounded-2xl border-2 border-cyan-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🍦</span>
                                    <div>
                                        <p className="text-lg font-black text-slate-800">{nombreBase || 'Sin nombre'}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">
                                            {bolasLista.length} bola(s) · {totalGramos}g total · Categoría: Helados
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-[10px]">
                                    {bolasLista.map((b, idx) => (
                                        <div key={b.id} className="flex justify-between">
                                            <span className="text-slate-500 font-bold">Bola {idx + 1} ({b.pesoGramos}g)</span>
                                            <span className="font-black text-slate-700">
                                                {costoPorMl > 0 ? formatCurrency(b.pesoGramos * costoPorMl) : '—'}
                                            </span>
                                        </div>
                                    ))}
                                    {extrasProducto.map((ex, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span className="text-slate-400 font-bold truncate max-w-[60%]">{ex.cantidadPorCopa}{ex.unidad} {ex.nombre}</span>
                                            <span className="font-black text-slate-500">+{formatCurrency(ex.costoPorCopa)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-black border-t border-slate-100 pt-2">
                                        <span className="text-slate-600">Costo total</span>
                                        <span className="text-cyan-700">{formatCurrency(costoTotal)}</span>
                                    </div>
                                    <div className="flex justify-between font-black text-[12px]">
                                        <span className="text-slate-700">Precio de venta</span>
                                        <span className="text-emerald-600">{formatCurrency(precioFinal)}</span>
                                    </div>
                                    <div className={cn(
                                        'flex justify-between font-black rounded-lg px-3 py-2 mt-1',
                                        margenReal >= 30 ? 'bg-emerald-100 text-emerald-700' :
                                        margenReal >= 15 ? 'bg-amber-100 text-amber-700' :
                                                           'bg-rose-100 text-rose-700'
                                    )}>
                                        <span>Margen</span>
                                        <span>{margenReal.toFixed(0)}%</span>
                                    </div>
                                </div>

                                {copasPosibles > 0 && (
                                    <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                                        <p className="text-[9px] font-black uppercase text-blue-500">Stock actual alcanza para</p>
                                        <p className="text-2xl font-black text-blue-700">{copasPosibles} copas</p>
                                        <p className="text-[9px] text-blue-400 font-bold">{totalGramos}g por copa</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
                    {mode === 'history' ? (
                        <Button variant="ghost" onClick={() => onOpenChange(false)}
                            className="h-11 px-5 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-slate-600">
                            Cerrar
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost"
                                onClick={() => {
                                    if (step > 1) setStep(step - 1);
                                    else if (editingProductoId) { setMode('history'); resetWizard(); }
                                    else onOpenChange(false);
                                }}
                                className="h-11 px-5 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-slate-600">
                                {step === 1 && !editingProductoId ? 'Cerrar' : <><ChevronLeft className="w-4 h-4 mr-1" />Atrás</>}
                            </Button>
                            {step < 3 ? (
                                <Button
                                    disabled={step === 1 && selectedIds.length === 0 && !editingProductoId}
                                    onClick={() => setStep(step + 1)}
                                    className="h-11 flex-1 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                                    Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button disabled={loading || !nombreBase.trim()} onClick={handleSave}
                                    className="h-11 flex-1 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                                    {loading ? 'Guardando…' : editingProductoId ? 'Actualizar producto ✓' : 'Guardar producto ✓'}
                                </Button>
                            )}
                        </>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
}
