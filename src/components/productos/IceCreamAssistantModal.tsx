import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

const PERFILES_DEFAULT: PerfilCopa[] = [
    { id: 'c1', label: '1 Bola',  numBolas: 1, pesoGramos: 80, activo: true,  extras: [], precioVenta: '', margen: 45 },
    { id: 'c2', label: '2 Bolas', numBolas: 2, pesoGramos: 80, activo: true,  extras: [], precioVenta: '', margen: 45 },
    { id: 'c3', label: '3 Bolas', numBolas: 3, pesoGramos: 80, activo: true,  extras: [], precioVenta: '', margen: 45 },
    { id: 'c4', label: '4 Bolas', numBolas: 4, pesoGramos: 80, activo: false, extras: [], precioVenta: '', margen: 45 },
];

export function IceCreamAssistantModal({
    isOpen, onOpenChange, productos, precios, onAddProducto, formatCurrency
}: IceCreamAssistantModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Paso 1
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [mlPorCaja, setMlPorCaja] = useState('10000');
    const [cajasDisponibles, setCajasDisponibles] = useState('1');

    // Paso 2
    const [perfiles, setPerfiles] = useState<PerfilCopa[]>(PERFILES_DEFAULT);
    const [nombreBase, setNombreBase] = useState('');

    // ── Filtros ──────────────────────────────────────────────────────────────
    // Cajas de helado: filtrar por categoría "helado" y excluir elaborados
    const insumosLista = useMemo(() => productos.filter(p => {
        const cat = (p.categoria || '').toLowerCase();
        const n   = p.nombre.toLowerCase();
        const esHelado = cat.includes('helado') || n.includes('helado');
        return esHelado && p.tipo !== 'elaborado';
    }), [productos]);

    // Extras: vaso, cuchara, gragea, salsa, cono…
    const extrasDisponibles = useMemo(() => productos.filter(p => {
        const n = p.nombre.toLowerCase();
        const keywords = ['vaso', 'salsa', 'cono', 'cuchara', 'grajea', 'gragea', 'chispa', 'topping', 'bolsa', 'cucharita'];
        return (p.tipo === 'ingrediente' || p.tipo === 'insumo') && keywords.some(k => n.includes(k));
    }), [productos]);

    // ── Cálculos paso 1 ───────────────────────────────────────────────────────
    const promedioMaestro = useMemo(() => {
        if (selectedIds.length === 0) return 0;
        let total = 0; let count = 0;
        selectedIds.forEach(id => {
            precios.filter(pr => pr.productoId === id).forEach(pr => {
                total += parseFloat(pr.precioCosto) || 0;
                count++;
            });
        });
        return count > 0 ? total / count : 0;
    }, [selectedIds, precios]);

    const mlTotal            = parseFloat(mlPorCaja) || 10000;
    const costoPorMl         = promedioMaestro / mlTotal;
    const totalMlDisponible  = (parseFloat(cajasDisponibles) || 1) * mlTotal;

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

    // ── Helpers ───────────────────────────────────────────────────────────────
    const reset = () => {
        setStep(1);
        setSelectedIds([]);
        setMlPorCaja('10000');
        setCajasDisponibles('1');
        setPerfiles(PERFILES_DEFAULT);
        setNombreBase('');
    };

    const updatePerfil = (id: string, updates: Partial<PerfilCopa>) =>
        setPerfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

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

    const handleSave = async () => {
        const activos = perfilesCalc.filter(p => p.activo);
        if (activos.length === 0) { toast.error('Activa al menos un tamaño de copa'); return; }
        setLoading(true);
        try {
            for (const p of activos) {
                const nombre = nombreBase
                    ? `${nombreBase} ${p.label}`
                    : `Copa Helado ${p.label}`;
                await onAddProducto({
                    nombre,
                    categoria: 'Helados',
                    descripcion: `${p.numBolas} bola(s) × ${p.pesoGramos}g. Costo base: ${formatCurrency(p.costoTotal)}.`,
                    precioVenta:    Math.round(p.pvpFinal),
                    margenUtilidad: p.margenReal.toFixed(0),
                    tipo:           'elaborado',
                    unidadMedida:   'unidad',
                    costoBase:      p.costoTotal,
                });
            }
            toast.success(`${activos.length} producto(s) creados correctamente`);
            onOpenChange(false);
            reset();
        } catch {
            toast.error('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { if (isOpen) reset(); }, [isOpen]);

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
                                    {step === 1 ? 'Paso 1 — Cajas e insumos' : step === 2 ? 'Paso 2 — Tamaños de copa' : 'Paso 3 — Resumen y guardar'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', step >= s ? 'bg-white w-8' : 'bg-white/30 w-4')} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Contenido ── */}
                <div className="p-6 max-h-[62vh] overflow-y-auto space-y-5">

                    {/* ════════════ PASO 1 ════════════ */}
                    {step === 1 && (
                        <>
                            <div className="flex gap-3">
                                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ml / g por caja</Label>
                                    <Input type="number" value={mlPorCaja} onChange={e => setMlPorCaja(e.target.value)} className="mt-1.5 h-9 font-bold text-sm" />
                                </div>
                                <div className="flex-1 bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <Label className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Cajas disponibles</Label>
                                    <Input type="number" value={cajasDisponibles} onChange={e => setCajasDisponibles(e.target.value)} className="mt-1.5 h-9 font-bold text-sm bg-white border-blue-200" />
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Selecciona las cajas de helado</p>
                                {insumosLista.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                                        <p className="text-sm font-black text-amber-700">No hay cajas de helado registradas</p>
                                        <p className="text-[11px] text-amber-500 mt-1">
                                            Registra primero los productos de tu proveedor con categoría <strong>"Helados"</strong>
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {insumosLista.map(p => {
                                            const isSelected = selectedIds.includes(p.id);
                                            const pCosto = parseFloat(precios.find(pr => pr.productoId === p.id)?.precioCosto?.toString() || '0');
                                            return (
                                                <button key={p.id} onClick={() => setSelectedIds(prev =>
                                                    prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id]
                                                )} className={cn(
                                                    'flex flex-col p-3 rounded-xl border-2 text-left transition-all active:scale-95',
                                                    isSelected ? 'bg-cyan-600 text-white border-cyan-700 shadow-md' : 'bg-white border-slate-100 hover:border-cyan-300'
                                                )}>
                                                    <p className="text-[10px] font-black truncate uppercase leading-tight">{p.nombre}</p>
                                                    <p className={cn('text-[10px] font-bold mt-1', isSelected ? 'text-cyan-200' : 'text-slate-400')}>
                                                        {formatCurrency(pCosto)}
                                                    </p>
                                                    {isSelected && <Check className="w-3.5 h-3.5 mt-1.5 self-end" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {selectedIds.length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-cyan-600 rounded-2xl p-5 text-white text-center shadow-lg shadow-cyan-100">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-70">Costo promedio caja</p>
                                        <p className="text-4xl font-black mt-1">{formatCurrency(promedioMaestro)}</p>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">{selectedIds.length} sabor(es) seleccionado(s)</p>
                                    </div>
                                    <div className="bg-blue-600 rounded-2xl p-5 text-white text-center shadow-lg shadow-blue-100">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-70">Stock total disponible</p>
                                        <p className="text-4xl font-black mt-1">{(totalMlDisponible / 1000).toFixed(1)} L</p>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">
                                            {cajasDisponibles} caja(s) × {(mlTotal / 1000).toFixed(1)} L
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ════════════ PASO 2 ════════════ */}
                    {step === 2 && (
                        <>
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre base del producto</Label>
                                    <Input value={nombreBase} onChange={e => setNombreBase(e.target.value)}
                                        placeholder="Ej: Copa, Sorbete, Sundae…" className="mt-1.5 h-9 text-sm font-bold" />
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold pb-2 whitespace-nowrap">
                                    → "{nombreBase || 'Copa'} 2 Bolas"
                                </span>
                            </div>

                            {perfilesCalc.map(p => (
                                <div key={p.id} className={cn(
                                    'rounded-2xl border-2 overflow-hidden transition-all',
                                    p.activo ? 'border-cyan-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-55'
                                )}>
                                    {/* Cabecera del perfil */}
                                    <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">
                                        <button onClick={() => updatePerfil(p.id, { activo: !p.activo })}
                                            className={cn('w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all shrink-0',
                                                p.activo ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-200 text-slate-400'
                                            )}>
                                            {p.activo ? <Check className="w-4 h-4" /> : p.numBolas}
                                        </button>
                                        <span className="font-black text-slate-800 text-sm">{p.label}</span>

                                        {p.activo && (
                                            <>
                                                <div className="flex items-center gap-1.5 ml-2">
                                                    <span className="text-[9px] text-slate-400 font-black uppercase">Peso/bola</span>
                                                    <Input type="number" value={p.pesoGramos}
                                                        onChange={e => updatePerfil(p.id, { pesoGramos: parseInt(e.target.value) || 0 })}
                                                        className="h-7 w-14 text-center text-xs font-black p-0 border border-slate-200 rounded-lg" />
                                                    <span className="text-[9px] text-slate-400">g</span>
                                                </div>
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Costo helado</span>
                                                    <span className="text-sm font-black text-cyan-700">{formatCurrency(p.costoHelado)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {p.activo && (
                                        <div className="p-3 grid grid-cols-2 gap-3">
                                            {/* Insumos del vaso */}
                                            <div className="space-y-1.5">
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                    Insumos del vaso (vaso, cuchara, gragea, salsa…)
                                                </p>
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
                                                    <option value="">+ Agregar vaso / gragea / salsa / cuchara…</option>
                                                    {extrasDisponibles.map(e => {
                                                        const c = parseFloat(precios.find(pr => pr.productoId === e.id)?.precioCosto?.toString() || '0');
                                                        return <option key={e.id} value={e.id}>{e.nombre} ({formatCurrency(c)})</option>;
                                                    })}
                                                </select>
                                                {extrasDisponibles.length === 0 && (
                                                    <p className="text-[9px] text-slate-400 italic">
                                                        Registra vasos y otros insumos con ese nombre para que aparezcan aquí
                                                    </p>
                                                )}
                                            </div>

                                            {/* Precio y margen */}
                                            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 space-y-2 border border-cyan-100">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="font-bold text-slate-500">Insumos del vaso</span>
                                                    <span className="font-black text-slate-700">+{formatCurrency(p.costoExtras)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-black border-t border-cyan-100 pt-1.5">
                                                    <span className="text-slate-600">Costo total copa</span>
                                                    <span className="text-cyan-700">{formatCurrency(p.costoTotal)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 pt-0.5">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Precio venta $</span>
                                                    <Input type="number" value={p.precioVenta}
                                                        onChange={e => updatePerfil(p.id, { precioVenta: e.target.value })}
                                                        placeholder={Math.round(p.pvpCalculado).toString()}
                                                        className="h-7 flex-1 text-right text-xs font-black border-cyan-200 bg-white" />
                                                </div>
                                                <div className="flex justify-between text-[10px] font-black bg-cyan-600 text-white rounded-lg px-2.5 py-1.5">
                                                    <span>Margen</span>
                                                    <span>{p.margenReal.toFixed(0)}%</span>
                                                </div>
                                                <p className="text-[9px] font-bold text-blue-500 text-center">
                                                    ~{p.copasPosibles} copas con el stock actual
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {/* ════════════ PASO 3 ════════════ */}
                    {step === 3 && (
                        <>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                Se crearán {perfilesCalc.filter(p => p.activo).length} producto(s)
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
                                                <span className="font-black text-slate-700">{formatCurrency(p.costoHelado)}</span>
                                            </div>
                                            {p.costoExtras > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-bold">Insumos vaso</span>
                                                    <span className="font-black text-slate-700">{formatCurrency(p.costoExtras)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-black border-t border-slate-100 pt-1">
                                                <span className="text-slate-600">Costo total</span>
                                                <span className="text-cyan-700">{formatCurrency(p.costoTotal)}</span>
                                            </div>
                                            <div className="flex justify-between font-black text-[11px]">
                                                <span className="text-slate-600">Precio venta</span>
                                                <span className="text-emerald-600">{formatCurrency(p.pvpFinal)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Margen real</span>
                                                <span className="font-black text-slate-700">{p.margenReal.toFixed(0)}%</span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-100 pt-1">
                                                <span className="text-slate-400 font-bold">Copas posibles</span>
                                                <span className="font-black text-blue-600">{p.copasPosibles} copas</span>
                                            </div>
                                        </div>
                                        {p.extras.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-2 space-y-0.5">
                                                {p.extras.map((ex, i) => (
                                                    <p key={i} className="text-[9px] text-slate-500 font-bold truncate">
                                                        • {ex.nombre} — {formatCurrency(ex.costo)}
                                                    </p>
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
                    {step < 3 ? (
                        <Button
                            disabled={step === 1 && selectedIds.length === 0}
                            onClick={() => setStep(step + 1)}
                            className="h-11 flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-cyan-100">
                            Siguiente <ChevronRight className="w-4 h-4 ml-1" />
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
