import { useState, useMemo, useEffect } from 'react';
import {
    Search, Bell, History, PlusCircle, Monitor, Shield,
    CheckCircle, User, BarChart3, Eye, Lock, Clock,
    Sun, DollarSign, AlertCircle, Package, ShoppingBag,
    ShoppingCart, TrendingUp, TrendingDown, ArrowUpCircle,
    ArrowDownCircle, Timer, Banknote, Coins, RefreshCw,
    CalendarDays, Wallet, Store, Users, Handshake, AlertTriangle,
    LogOut, CheckSquare, X, ArrowRightLeft, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { CajaMovimientosModal } from '@/components/ventas/CajaMovimientosModal';
import { AperturaCajaModal } from '@/components/ventas/AperturaCajaModal';
import { CierreCajaModal } from '@/components/ventas/CierreCajaModal';
import { VigilianciaIA } from '@/components/vigilancia/VigilianciaIA';
import { PrestamosCajaModal } from '@/components/ventas/PrestamosCajaModal';
import { ReporteZ } from '@/components/ventas/ReporteZ';
import { enviarReporteZWhatsApp } from '@/lib/whatsapp-reporting';
import type { CajaSesion, Venta, Categoria, Producto, PrestamoEntreCajas } from '@/types';

const BILLETES = [
    { valor: 100000, label: '$100.000', color: 'bg-purple-100 border-purple-200 text-purple-700' },
    { valor: 50000,  label: '$50.000',  color: 'bg-pink-100 border-pink-200 text-pink-700' },
    { valor: 20000,  label: '$20.000',  color: 'bg-blue-100 border-blue-200 text-blue-700' },
    { valor: 10000,  label: '$10.000',  color: 'bg-violet-100 border-violet-200 text-violet-700' },
    { valor: 5000,   label: '$5.000',   color: 'bg-orange-100 border-orange-200 text-orange-700' },
    { valor: 2000,   label: '$2.000',   color: 'bg-rose-100 border-rose-200 text-rose-700' },
    { valor: 1000,   label: '$1.000',   color: 'bg-amber-100 border-amber-200 text-amber-700' },
];
const MONEDAS = [
    { valor: 500, label: '$500', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 200, label: '$200', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 100, label: '$100', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    { valor: 50,  label: '$50',  color: 'bg-slate-100 border-slate-200 text-slate-600' },
];

// ─── MODAL ENTREGA DE TURNO (nivel módulo para evitar re-renders) ────────────
interface EntregaModalProps {
    caja: CajaSesion | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirmar: (cajaId: string, montoCierre: number) => Promise<void>;
    formatCurrency: (v: number) => string;
}

const CAJA_EMOJIS: Record<string, string> = {
    'Caja Principal':    '🏪',
    'Vitrina':           '🥨',
    'Pan Caliente':      '🥐',
    'Cafetería':         '☕',
    'Tortas':            '🎂',
    'Repostería':        '🧁',
    'Desechables':       '📦',
};

function EntregaTurnoModal({ caja, isOpen, onClose, onConfirmar, formatCurrency }: EntregaModalProps) {
    const [monto,   setMonto]   = useState<string>('');
    const [loading, setLoading] = useState(false);

    if (!caja) return null;

    const entradas   = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
    const salidas    = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
    // Usar solo ventas con pago efectivo real — los créditos NO entran al cajón
    const ventasEfectivo = caja.totalVentasEfectivo ?? caja.totalVentas;
    const creditosHoy    = caja.totalCreditos || 0;
    const esperado   = caja.montoApertura + ventasEfectivo + entradas - salidas;
    const entregado  = parseFloat(monto) || 0;
    const diferencia = entregado - esperado;
    const hayMonto   = monto !== '' && entregado >= 0;
    const esFaltante = diferencia < 0;
    const hayAlerta  = diferencia < -5000;
    const turnoEmoji = caja.turno === 'Mañana' ? '☀️' : caja.turno === 'Tarde' ? '🌆' : '🌙';
    const cajaEmoji  = CAJA_EMOJIS[caja.cajaNombre || ''] || '📦';

    const handleConfirmar = async () => {
        setLoading(true);
        await onConfirmar(caja.id, entregado);
        setMonto('');
        setLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={loading ? undefined : onClose}>
            <DialogContent className="max-w-md rounded-3xl p-0 border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">

                {/* ── Header con identidad de la caja ── */}
                <div className="bg-slate-900 px-6 pt-6 pb-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 text-3xl shrink-0">
                            {cajaEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-xl font-black text-white uppercase leading-none truncate">
                                {caja.cajaNombre || 'Caja'}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-sm">{turnoEmoji}</span>
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">
                                    Turno {caja.turno || '—'}
                                </span>
                                {caja.vendedoraNombre && (
                                    <>
                                        <span className="text-white/20">·</span>
                                        <span className="text-[11px] font-black text-white/50 uppercase truncate">
                                            {caja.vendedoraNombre}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <Handshake className="w-5 h-5 text-white/20 shrink-0" />
                    </div>
                    <DialogDescription className="sr-only">Entrega de turno para {caja.cajaNombre}</DialogDescription>
                </div>

                <div className="p-6 space-y-5">

                    {/* ── KPIs del sistema ── */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Apertura',       val: caja.montoApertura, cls: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/10'       },
                            { label: 'V. Efectivo',    val: ventasEfectivo,     cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                            { label: 'Sistema espera', val: esperado,           cls: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/10'   },
                        ].map(item => (
                            <div key={item.label} className={cn("p-3 rounded-2xl text-center", item.bg)}>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                <p className={cn("text-sm font-black tabular-nums", item.cls)}>{formatCurrency(item.val)}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Aviso de créditos (solo si hay ventas a crédito hoy) ── */}
                    {creditosHoy > 0 && (
                        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-amber-500 text-base">💳</span>
                                <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                                    Créditos del turno — no entran al cajón
                                </p>
                            </div>
                            <p className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                                {formatCurrency(creditosHoy)}
                            </p>
                        </div>
                    )}

                    {/* ── Input principal: efectivo entregado ── */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Banknote className="w-3.5 h-3.5" /> Efectivo que entrega la vendedora
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 group-focus-within:text-blue-500 transition-colors select-none">
                                $
                            </div>
                            <input
                                type="number"
                                min="0"
                                autoFocus
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                placeholder={String(esperado)}
                                className="w-full h-20 pl-10 pr-5 text-4xl font-black rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-400 outline-none tabular-nums transition-all"
                            />
                            {/* Botón auto-rellenar */}
                            <button
                                onClick={() => setMonto(String(esperado))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                Usar sistema
                            </button>
                        </div>
                    </div>

                    {/* ── Diferencia (aparece al escribir) ── */}
                    {hayMonto && (
                        <div className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border-2",
                            diferencia === 0 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                                : hayAlerta    ? "bg-red-50 border-red-300 dark:bg-red-900/10 dark:border-red-800"
                                : esFaltante   ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
                                               : "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                        )}>
                            <div>
                                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-0.5",
                                    diferencia === 0 ? "text-emerald-500"
                                        : hayAlerta  ? "text-red-500"
                                        : esFaltante ? "text-amber-500"
                                                     : "text-emerald-500"
                                )}>
                                    {diferencia === 0 ? '✓ Cuadra exacto'
                                        : hayAlerta   ? '⚠️ FALTANTE — Posible sustracción'
                                        : esFaltante  ? 'Pequeño faltante'
                                                      : 'Sobrante'}
                                </p>
                                <p className={cn("text-4xl font-black tabular-nums",
                                    diferencia === 0 ? "text-emerald-600"
                                        : hayAlerta  ? "text-red-600"
                                        : esFaltante ? "text-amber-600"
                                                     : "text-emerald-600"
                                )}>
                                    {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
                                </p>
                                <p className="text-xs text-slate-400 font-bold mt-1">
                                    Entregado: {formatCurrency(entregado)} · Esperado: {formatCurrency(esperado)}
                                </p>
                            </div>
                            {hayAlerta && <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />}
                        </div>
                    )}

                    {/* ── Botones ── */}
                    <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-black text-xs uppercase" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button
                            disabled={!hayMonto || loading}
                            onClick={handleConfirmar}
                            className={cn(
                                "flex-1 h-12 rounded-xl font-black text-xs uppercase text-white gap-2",
                                hayAlerta ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-black"
                            )}
                        >
                            <Lock className="w-4 h-4" />
                            {loading ? 'Guardando...' : 'Confirmar Entrega'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── MODAL CIERRE DE JORNADA COMPLETA ────────────────────────────────────────
interface CierreJornadaModalProps {
    cajas: CajaSesion[];
    isOpen: boolean;
    onClose: () => void;
    onConfirmar: (cierres: { cajaId: string; montoCierre: number }[]) => Promise<void>;
    formatCurrency: (v: number) => string;
    ventas?: Venta[];
}

// Denominaciones disponibles
const DENOM_BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const DENOM_MONEDAS  = [500, 200, 100, 50];

interface CajaExtra {
    id: string;
    nombre: string;
    vendedora: string;
}

function CierreJornadaModal({ cajas, isOpen, onClose, onConfirmar, formatCurrency, ventas = [] }: CierreJornadaModalProps) {
    const [montos,       setMontos]       = useState<Record<string, string>>({});
    const [loading,      setLoading]      = useState(false);
    const [progreso,     setProgreso]     = useState(0);
    // Denominaciones: cajaId -> valor -> cantidad
    const [denoms,       setDenoms]       = useState<Record<string, Record<number, string>>>({});
    // Qué cajas tienen expandido el panel de denominaciones
    const [expandedDenom,setExpandedDenom]= useState<Set<string>>(new Set());
    // Cajas extra manuales
    const [cajasExtra,   setCajasExtra]   = useState<CajaExtra[]>([]);
    const [editingIdx,   setEditingIdx]   = useState<number | null>(null);
    // Caja siendo editada (nombre/vendedora) dentro del sistema
    const [editingCajaId,setEditingCajaId]= useState<string | null>(null);
    const [editNombre,   setEditNombre]   = useState('');
    const [editVendedora,setEditVendedora]= useState('');

    // IDs unificados (cajas sistema + extras)
    const todasLasIds = [...cajas.map(c => c.id), ...cajasExtra.map(c => c.id)];

    // Calcular balance esperado por caja del sistema
    const getEsperado = (caja: CajaSesion) => {
        const ent = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
        const sal = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
        return caja.montoApertura + caja.totalVentas + ent - sal;
    };

    // Calcular total desde denominaciones de una caja
    const calcTotalDenom = (cajaId: string, nuevasDenoms?: Record<number, string>) => {
        const d = nuevasDenoms ?? (denoms[cajaId] || {});
        return [...DENOM_BILLETES, ...DENOM_MONEDAS].reduce((sum, v) => sum + v * (parseInt(d[v] || '0') || 0), 0);
    };

    // Actualizar una denominación y recalcular monto
    const updateDenom = (cajaId: string, valor: number, cantidad: string) => {
        const prev = denoms[cajaId] || {};
        const nuevas = { ...prev, [valor]: cantidad };
        setDenoms(d => ({ ...d, [cajaId]: nuevas }));
        const total = calcTotalDenom(cajaId, nuevas);
        setMontos(m => ({ ...m, [cajaId]: String(total) }));
    };

    // Toggle panel denominaciones
    const toggleDenom = (cajaId: string) => {
        setExpandedDenom(prev => {
            const next = new Set(prev);
            next.has(cajaId) ? next.delete(cajaId) : next.add(cajaId);
            return next;
        });
    };

    // Toggle panel movimientos
    const [expandedMovs, setExpandedMovs] = useState<Set<string>>(new Set());
    const toggleMovs = (cajaId: string) => {
        setExpandedMovs(prev => {
            const next = new Set(prev);
            next.has(cajaId) ? next.delete(cajaId) : next.add(cajaId);
            return next;
        });
    };

    // Auto-rellenar todos con el balance del sistema
    const autoRellenar = () => {
        const filled: Record<string, string> = {};
        cajas.forEach(c => { filled[c.id] = String(getEsperado(c)); });
        cajasExtra.forEach(c => { filled[c.id] = '0'; });
        setMontos(filled);
    };

    // Agregar caja extra
    const agregarCajaExtra = () => {
        const nueva: CajaExtra = { id: `extra-${Date.now()}`, nombre: 'Nueva Caja', vendedora: '' };
        setCajasExtra(prev => [...prev, nueva]);
        setEditingIdx(cajasExtra.length);
    };

    // Eliminar caja extra
    const eliminarCajaExtra = (id: string) => {
        setCajasExtra(prev => prev.filter(c => c.id !== id));
        setMontos(m => { const n = { ...m }; delete n[id]; return n; });
        setDenoms(d => { const n = { ...d }; delete n[id]; return n; });
    };

    const totalEsperado  = cajas.reduce((a, c) => a + getEsperado(c), 0);
    const totalEntregado = todasLasIds.reduce((a, id) => a + (parseFloat(montos[id] || '0') || 0), 0);
    const diferenciaNeta = totalEntregado - totalEsperado;
    const cajasConMonto  = todasLasIds.filter(id => montos[id] && parseFloat(montos[id]) >= 0).length;
    const turnoEmoji     = cajas[0]?.turno === 'Mañana' ? '☀️' : cajas[0]?.turno === 'Tarde' ? '🌆' : '🌙';
    const hayAlerta      = diferenciaNeta < -5000;
    const totalCajas     = cajas.length + cajasExtra.length;

    const handleConfirmar = async () => {
        setLoading(true);
        setProgreso(0);
        const cierres = cajas.map(c => ({
            cajaId: c.id,
            montoCierre: parseFloat(montos[c.id] || '0') || getEsperado(c),
        }));
        await onConfirmar(cierres);
        setMontos({});
        setDenoms({});
        setCajasExtra([]);
        setLoading(false);
        setProgreso(0);
    };

    // Renderiza el panel de denominaciones de una caja
    const renderDenomPanel = (cajaId: string) => (
        <div className="px-4 pb-3 space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Billetes</p>
            <div className="grid grid-cols-4 gap-1.5">
                {DENOM_BILLETES.map(v => (
                    <div key={v} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase">${(v/1000)}K</span>
                        <input
                            type="number" min="0" placeholder="0"
                            value={denoms[cajaId]?.[v] ?? ''}
                            onChange={e => updateDenom(cajaId, v, e.target.value)}
                            className="w-full h-8 text-center text-xs font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-indigo-400 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                ))}
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">Monedas</p>
            <div className="grid grid-cols-4 gap-1.5">
                {DENOM_MONEDAS.map(v => (
                    <div key={v} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase">${v}</span>
                        <input
                            type="number" min="0" placeholder="0"
                            value={denoms[cajaId]?.[v] ?? ''}
                            onChange={e => updateDenom(cajaId, v, e.target.value)}
                            className="w-full h-8 text-center text-xs font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-indigo-400 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[9px] font-black text-slate-400 uppercase">Total contado</span>
                <span className="text-sm font-black text-indigo-600 tabular-nums">{formatCurrency(calcTotalDenom(cajaId))}</span>
            </div>
        </div>
    );

    // Renderiza fila de input + diferencia compartida
    const renderMontoRow = (cajaId: string, esperado: number) => {
        const entregado  = parseFloat(montos[cajaId] || '0') || 0;
        const diff       = entregado - esperado;
        const hayDato    = montos[cajaId] !== undefined && montos[cajaId] !== '';
        const esFaltante = diff < 0;
        const esAlerta   = diff < -5000;
        const denomAbierto = expandedDenom.has(cajaId);

        return (
            <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo entregado</p>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">$</span>
                            <input
                                type="number" min="0"
                                placeholder={formatCurrency(esperado)}
                                value={montos[cajaId] ?? ''}
                                onChange={e => setMontos(prev => ({ ...prev, [cajaId]: e.target.value }))}
                                className="w-full h-11 pl-7 pr-3 text-lg font-black rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-indigo-400 tabular-nums transition-all"
                            />
                        </div>
                    </div>
                    {hayDato && (
                        <div className={cn(
                            "shrink-0 px-3 py-2 rounded-xl text-center min-w-[96px]",
                            !esFaltante ? "bg-emerald-50 dark:bg-emerald-900/20" : esAlerta ? "bg-red-50 dark:bg-red-900/20" : "bg-amber-50 dark:bg-amber-900/20"
                        )}>
                            <p className={cn("text-[9px] font-black uppercase tracking-widest",
                                !esFaltante ? "text-emerald-500" : esAlerta ? "text-red-500" : "text-amber-500"
                            )}>
                                {diff === 0 ? '✓ Cuadra' : esFaltante ? (esAlerta ? '⚠️ Faltante' : 'Faltante') : 'Sobrante'}
                            </p>
                            <p className={cn("text-base font-black tabular-nums",
                                !esFaltante ? "text-emerald-700" : esAlerta ? "text-red-700" : "text-amber-700"
                            )}>
                                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                            </p>
                        </div>
                    )}
                </div>
                {/* Botón toggle denominaciones */}
                <button
                    onClick={() => toggleDenom(cajaId)}
                    className="w-full h-8 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-black uppercase text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                >
                    <Coins className="w-3.5 h-3.5" />
                    {denomAbierto ? 'Ocultar denominaciones' : 'Contar billetes y monedas'}
                </button>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={loading ? undefined : onClose}>
            <DialogContent className="max-w-2xl rounded-2xl p-0 border-none shadow-2xl bg-white dark:bg-slate-900 max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <DialogHeader className="bg-slate-900 p-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                                <LogOut className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black text-white uppercase">
                                    Cerrar Jornada Completa
                                </DialogTitle>
                                <DialogDescription className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                    {turnoEmoji} Turno {cajas[0]?.turno || '—'} · {totalCajas} cajas
                                </DialogDescription>
                            </div>
                        </div>
                        <button
                            onClick={autoRellenar}
                            className="text-[10px] font-black uppercase text-white/50 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                        >
                            <CheckSquare className="w-3.5 h-3.5" /> Auto-rellenar sistema
                        </button>
                    </div>
                </DialogHeader>

                {/* Lista de cajas */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">

                    {/* ── Cajas del sistema ── */}
                    {cajas.map((caja, idx) => {
                        const esperado   = getEsperado(caja);
                        const cajaEmoji  = ['🏪','🍦','🍟','🍺','🎂','☕','🎁'][idx] || '📦';
                        const isEditing  = editingCajaId === caja.id;

                        return (
                            <div key={caja.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden">
                                {/* Cabecera caja */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                    {isEditing ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={editNombre}
                                                onChange={e => setEditNombre(e.target.value)}
                                                placeholder="Nombre caja"
                                                className="flex-1 h-8 px-2 text-xs font-black rounded-lg border border-indigo-400 bg-white dark:bg-slate-900 outline-none"
                                            />
                                            <input
                                                value={editVendedora}
                                                onChange={e => setEditVendedora(e.target.value)}
                                                placeholder="Vendedora"
                                                className="flex-1 h-8 px-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none"
                                            />
                                            <button
                                                onClick={() => setEditingCajaId(null)}
                                                className="h-8 px-3 bg-indigo-600 text-white text-[10px] font-black rounded-lg"
                                            >OK</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{cajaEmoji}</span>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none">
                                                        {editingCajaId === caja.id ? editNombre : (caja.cajaNombre || 'Caja')}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                                        {caja.vendedoraNombre || 'Sin asignar'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Sistema espera</p>
                                                    <p className="text-base font-black text-indigo-600 tabular-nums">{formatCurrency(esperado)}</p>
                                                </div>
                                                <button
                                                    onClick={() => { setEditingCajaId(caja.id); setEditNombre(caja.cajaNombre || ''); setEditVendedora(caja.vendedoraNombre || ''); }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                    title="Editar caja"
                                                >
                                                    <Search className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* ── Panel de Vigilancia ── */}
                                {(() => {
                                    const ventasCaja     = ventas.filter(v => v.cajaId === caja.id);
                                    const ventasEfectivo = ventasCaja.filter(v => v.metodoPago === 'efectivo').reduce((a, v) => a + v.total, 0);
                                    const ventasTarjeta  = ventasCaja.filter(v => v.metodoPago === 'tarjeta').reduce((a, v) => a + v.total, 0);
                                    const ventasNequi    = ventasCaja.filter(v => v.metodoPago === 'nequi' || v.metodoPago === 'transferencia').reduce((a, v) => a + v.total, 0);
                                    const ventasCredito  = ventasCaja.filter(v => v.metodoPago === 'credito').reduce((a, v) => a + v.total, 0);
                                    const entradas       = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
                                    const salidas        = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
                                    const efectivoTeorico = caja.montoApertura + ventasEfectivo + entradas - salidas;
                                    const entregado       = parseFloat(montos[caja.id] || '0') || 0;
                                    const diff            = entregado - efectivoTeorico;
                                    const hayEntregado    = montos[caja.id] !== undefined && montos[caja.id] !== '';
                                    const alerta = hayEntregado && Math.abs(diff) > 1000;
                                    return (
                                        <div className="mx-4 mb-2 space-y-1.5">
                                            {/* Fila 1: ventas por método */}
                                            <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-2.5">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Apertura</p>
                                                    <p className="text-xs font-black text-slate-600 dark:text-slate-300 tabular-nums">{formatCurrency(caja.montoApertura)}</p>
                                                </div>
                                                <div className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">💵 Efectivo</p>
                                                    <p className="text-xs font-black text-emerald-600 tabular-nums">{formatCurrency(ventasEfectivo)}</p>
                                                </div>
                                                <div className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">💳 Tarjeta</p>
                                                    <p className="text-xs font-black text-blue-500 tabular-nums">{formatCurrency(ventasTarjeta)}</p>
                                                </div>
                                                <div className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest leading-none mb-1">📱 Nequi</p>
                                                    <p className="text-xs font-black text-purple-500 tabular-nums">{formatCurrency(ventasNequi)}</p>
                                                </div>
                                            </div>

                                            {/* Fila 2: movimientos */}
                                            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-2.5">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">📥 Entradas</p>
                                                    <p className="text-xs font-black text-indigo-500 tabular-nums">+{formatCurrency(entradas)}</p>
                                                </div>
                                                <div className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">📤 Salidas</p>
                                                    <p className="text-xs font-black text-rose-500 tabular-nums">-{formatCurrency(salidas)}</p>
                                                </div>
                                                <div className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none mb-1">🎫 Crédito</p>
                                                    <p className="text-xs font-black text-amber-500 tabular-nums">{formatCurrency(ventasCredito)}</p>
                                                </div>
                                            </div>

                                            {/* Fila 3: análisis efectivo */}
                                            <div className={cn(
                                                "rounded-xl p-2.5 border-2",
                                                !hayEntregado ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                                : alerta && diff < 0 ? "bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700"
                                                : alerta && diff > 0 ? "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700"
                                                : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                                            )}>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="text-center">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Efectivo esperado</p>
                                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(efectivoTeorico)}</p>
                                                        <p className="text-[8px] text-slate-400 font-bold mt-0.5">Apertura + Ventas ef. + Entr - Sal</p>
                                                    </div>
                                                    <div className="text-center border-l border-r border-slate-200 dark:border-slate-600">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Entregado</p>
                                                        <p className="text-sm font-black text-indigo-600 tabular-nums">{hayEntregado ? formatCurrency(entregado) : '—'}</p>
                                                        <p className="text-[8px] text-slate-400 font-bold mt-0.5">Lo que cuenta la vendedora</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Diferencia</p>
                                                        {hayEntregado ? (
                                                            <>
                                                                <p className={cn("text-sm font-black tabular-nums",
                                                                    diff === 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-amber-600"
                                                                )}>
                                                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                                                </p>
                                                                <p className={cn("text-[8px] font-black mt-0.5",
                                                                    diff === 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-amber-500"
                                                                )}>
                                                                    {diff === 0 ? '✓ Cuadra perfecto'
                                                                    : diff < -5000 ? '🚨 POSIBLE ROBO / VUELTO MAL'
                                                                    : diff < 0 ? '⚠️ Faltante · revisar'
                                                                    : '↑ Sobrante · revisar'}
                                                                </p>
                                                            </>
                                                        ) : <p className="text-sm font-black text-slate-300">—</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {renderMontoRow(caja.id, esperado)}
                                {expandedDenom.has(caja.id) && renderDenomPanel(caja.id)}

                                {/* Movimientos de la caja */}
                                {(caja.movimientos || []).length > 0 && (
                                    <>
                                        <div className="px-4 pb-2">
                                            <button
                                                onClick={() => toggleMovs(caja.id)}
                                                className="w-full h-8 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                                            >
                                                <ArrowUpCircle className="w-3 h-3 text-emerald-500" />
                                                <ArrowDownCircle className="w-3 h-3 text-rose-500" />
                                                {expandedMovs.has(caja.id) ? 'Ocultar movimientos' : `Ver movimientos (${caja.movimientos.length})`}
                                            </button>
                                        </div>
                                        {expandedMovs.has(caja.id) && (
                                            <div className="px-4 pb-3 space-y-1.5">
                                                {[...(caja.movimientos || [])].reverse().map((mov, i) => (
                                                    <div key={i} className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-xl",
                                                        mov.tipo === 'entrada' ? "bg-emerald-50 dark:bg-emerald-900/10" : "bg-rose-50 dark:bg-rose-900/10"
                                                    )}>
                                                        <div className={cn("w-2 h-2 rounded-full shrink-0", mov.tipo === 'entrada' ? "bg-emerald-500" : "bg-rose-500")} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[10px] font-black uppercase truncate text-slate-700 dark:text-slate-300">
                                                                {mov.motivo || 'Sin descripción'}
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-bold">
                                                                {new Date(mov.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <p className={cn("text-sm font-black tabular-nums shrink-0", mov.tipo === 'entrada' ? "text-emerald-600" : "text-rose-600")}>
                                                            {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(mov.monto)}
                                                        </p>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700 px-1">
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase">
                                                        Entradas: +{formatCurrency((caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0))}
                                                    </span>
                                                    <span className="text-[9px] font-black text-rose-600 uppercase">
                                                        Salidas: -{formatCurrency((caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* ── Cajas extra manuales ── */}
                    {cajasExtra.map((caja, idx) => {
                        const isEditing = editingIdx === idx;
                        return (
                            <div key={caja.id} className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl overflow-hidden border border-indigo-200 dark:border-indigo-800">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 dark:border-indigo-800">
                                    {isEditing ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={caja.nombre}
                                                onChange={e => setCajasExtra(prev => prev.map((c, i) => i === idx ? { ...c, nombre: e.target.value } : c))}
                                                placeholder="Nombre caja"
                                                className="flex-1 h-8 px-2 text-xs font-black rounded-lg border border-indigo-400 bg-white dark:bg-slate-900 outline-none"
                                            />
                                            <input
                                                value={caja.vendedora}
                                                onChange={e => setCajasExtra(prev => prev.map((c, i) => i === idx ? { ...c, vendedora: e.target.value } : c))}
                                                placeholder="Vendedora"
                                                className="flex-1 h-8 px-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none"
                                            />
                                            <button onClick={() => setEditingIdx(null)} className="h-8 px-3 bg-indigo-600 text-white text-[10px] font-black rounded-lg">OK</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">➕</span>
                                                <div>
                                                    <p className="text-sm font-black text-indigo-700 dark:text-indigo-300 uppercase leading-none">{caja.nombre}</p>
                                                    <p className="text-[10px] text-indigo-400 font-bold uppercase mt-0.5">{caja.vendedora || 'Sin asignar'} · Manual</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setEditingIdx(idx)} className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 transition-colors" title="Editar">
                                                    <Search className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => eliminarCajaExtra(caja.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {renderMontoRow(caja.id, 0)}
                                {expandedDenom.has(caja.id) && renderDenomPanel(caja.id)}
                            </div>
                        );
                    })}

                    {/* ── Botón agregar caja ── */}
                    <button
                        onClick={agregarCajaExtra}
                        className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs font-black uppercase text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all"
                    >
                        <PlusCircle className="w-4 h-4" /> Agregar caja extra
                    </button>
                </div>

                {/* Footer — consolidado + botones */}
                <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
                    <div className={cn(
                        "grid grid-cols-3 gap-3 p-4 rounded-2xl border-2",
                        hayAlerta ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                                  : "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700"
                    )}>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sistema espera</p>
                            <p className="text-lg font-black text-indigo-600 tabular-nums">{formatCurrency(totalEsperado)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total entregado</p>
                            <p className="text-lg font-black text-slate-700 dark:text-white tabular-nums">{formatCurrency(totalEntregado)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diferencia neta</p>
                            <p className={cn("text-lg font-black tabular-nums",
                                diferenciaNeta === 0 ? "text-emerald-600" : hayAlerta ? "text-red-600" : "text-amber-600"
                            )}>
                                {diferenciaNeta > 0 ? '+' : ''}{formatCurrency(diferenciaNeta)}
                            </p>
                        </div>
                    </div>

                    {loading && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Cerrando cajas...</span><span>{progreso}/{cajas.length}</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-900 rounded-full transition-all duration-300"
                                    style={{ width: `${cajas.length > 0 ? (progreso / cajas.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-black text-xs uppercase" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => {
                                // Antes de confirmar, disparamos la impresión si se requiere
                                window.print();
                            }}
                            type="button"
                            variant="outline"
                            className="w-12 h-12 p-0 border-2 rounded-xl border-slate-200 hover:border-blue-500 hover:text-blue-600 shrink-0"
                            title="Imprimir Reporte Z"
                        >
                            <Monitor className="w-5 h-5" />
                        </Button>
                        <Button
                            onClick={() => enviarReporteZWhatsApp(cajas, ventas || [])}
                            type="button"
                            variant="outline"
                            className="w-12 h-12 p-0 border-2 rounded-xl border-slate-200 hover:border-emerald-500 hover:text-emerald-600 shrink-0"
                            title="Notificar por WhatsApp"
                        >
                            <MessageSquare className="w-5 h-5" />
                        </Button>
                        <Button
                            onClick={handleConfirmar}
                            disabled={loading || cajasConMonto === 0}
                            className={cn(
                                "flex-1 h-12 rounded-xl font-black text-xs uppercase text-white gap-2",
                                hayAlerta ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-black"
                            )}
                        >
                            <Lock className="w-4 h-4" />
                            {loading ? `Cerrando ${progreso}/${cajas.length}...` : `Cerrar ${cajas.length} Cajas`}
                        </Button>
                    </div>
                </div>
                
                {/* ── REPORTE Z IMPRIMIBLE (OCULTO EN PANTALLA) ── */}
                <div className="hidden print:block">
                    <ReporteZ cajas={cajas} ventas={ventas || []} formatCurrency={formatCurrency} isPrinting />
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
interface ControlCajaProps {
    sesiones: CajaSesion[];
    ventas: Venta[];
    cajaActiva?: CajaSesion;
    formatCurrency: (value: number) => string;
    getProductoById: (id: string) => any;
    registrarMovimientoCaja: (monto: number, tipo: 'entrada' | 'salida', motivo: string, usuarioId: string, cajaId?: string) => Promise<any>;
    usuario: any;
    categorias: Categoria[];
    productos: Producto[];
    onAbrirCaja: (monto: number) => Promise<any>;
    onCerrarCaja: (monto: number) => Promise<any>;
}

export function ControlCaja({
    sesiones, ventas, cajaActiva, formatCurrency,
    getProductoById, registrarMovimientoCaja, usuario,
    onAbrirCaja, onCerrarCaja
}: ControlCajaProps) {
    const [searchTerm,        setSearchTerm]        = useState('');
    const [arqueo,            setArqueo]            = useState<Record<string, string>>({});
    const [movementModal,     setMovementModal]     = useState<{ isOpen: boolean; tipo: 'entrada' | 'salida' }>({ isOpen: false, tipo: 'entrada' });
    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showCierreModal,   setShowCierreModal]   = useState(false);
    const [showTracesModal,   setShowTracesModal]   = useState(false);
    const [tiempoTurno,       setTiempoTurno]       = useState('');
    // Multi-caja
    const [cajaEntregando,       setCajaEntregando]       = useState<CajaSesion | null>(null);
    const [showEntregaModal,     setShowEntregaModal]     = useState(false);
    const [cierresLocales,       setCierresLocales]       = useState<Set<string>>(new Set());
    const [showCierreJornada,    setShowCierreJornada]    = useState(false);
    // Caja seleccionada para Resumen / Arqueo / Movimientos
    const [cajaSeleccionadaId,   setCajaSeleccionadaId]   = useState<string>('');

    // Préstamos entre cajas
    const [prestamos,          setPrestamos]          = useState<PrestamoEntreCajas[]>([]);
    const [showPrestamoModal,  setShowPrestamoModal]  = useState(false);
    const esAdmin = usuario?.rol === 'ADMIN';

    // Cargar préstamos al montar
    useEffect(() => {
        if (!esAdmin) return;
        db.getAllPrestamosCaja().then(data => setPrestamos(data as PrestamoEntreCajas[])).catch(() => {});
    }, [esAdmin]);

    const registrarPrestamo = async (params: {
        cajaOrigenId: string; cajaOrigenNombre: string;
        cajaDestinoId: string; cajaDestinoNombre: string;
        monto: number; motivo: string;
    }) => {
        const nuevo: PrestamoEntreCajas = {
            id: crypto.randomUUID(),
            ...params,
            estado: 'pendiente',
            fechaPrestamo: new Date().toISOString(),
            usuarioId: usuario?.id || 'admin',
            usuarioNombre: usuario?.nombre || 'Admin',
        };
        await db.addPrestamoCaja(nuevo);
        // Registrar movimientos en cada caja (salida en origen, entrada en destino)
        await registrarMovimientoCaja(params.monto, 'salida',
            `Préstamo a ${params.cajaDestinoNombre}`, usuario?.id || 'admin', params.cajaOrigenId);
        await registrarMovimientoCaja(params.monto, 'entrada',
            `Préstamo de ${params.cajaOrigenNombre}`, usuario?.id || 'admin', params.cajaDestinoId);
        setPrestamos(prev => [nuevo, ...prev]);
        toast.success(`✅ Préstamo de $${params.monto.toLocaleString('es-CO')} registrado`);
    };

    const marcarDevuelto = async (prestamo: PrestamoEntreCajas) => {
        const actualizado: PrestamoEntreCajas = {
            ...prestamo,
            estado: 'devuelto',
            fechaDevolucion: new Date().toISOString(),
        };
        await db.updatePrestamoCaja(actualizado);
        // Movimientos inversos: regresa el dinero
        await registrarMovimientoCaja(prestamo.monto, 'entrada',
            `Devolución de ${prestamo.cajaDestinoNombre}`, usuario?.id || 'admin', prestamo.cajaOrigenId);
        await registrarMovimientoCaja(prestamo.monto, 'salida',
            `Devolución a ${prestamo.cajaOrigenNombre}`, usuario?.id || 'admin', prestamo.cajaDestinoId);
        setPrestamos(prev => prev.map(p => p.id === prestamo.id ? actualizado : p));
        toast.success('✅ Préstamo marcado como devuelto');
    };

    // Editar / eliminar caja individual
    const [editandoCaja, setEditandoCaja] = useState<CajaSesion | null>(null);
    const [editNombreCaja, setEditNombreCaja] = useState('');
    const [editVendedoraCaja, setEditVendedoraCaja] = useState('');
    const [guardandoCaja, setGuardandoCaja] = useState(false);

    const abrirEditCaja = (caja: CajaSesion) => {
        setEditandoCaja(caja);
        setEditNombreCaja(caja.cajaNombre || '');
        setEditVendedoraCaja(caja.vendedoraNombre || '');
    };

    const guardarEditCaja = async () => {
        if (!editandoCaja) return;
        setGuardandoCaja(true);
        try {
            await db.updateSesionCaja({ ...editandoCaja, cajaNombre: editNombreCaja, vendedoraNombre: editVendedoraCaja } as any);
            toast.success(`✅ Caja "${editNombreCaja}" actualizada`);
            setEditandoCaja(null);
        } catch { toast.error('Error al guardar caja'); }
        setGuardandoCaja(false);
    };

    const eliminarCaja = async (caja: CajaSesion) => {
        if (!confirm(`¿Eliminar la caja "${caja.cajaNombre || 'Caja'}"? Se marcará como cerrada.`)) return;
        try {
            await db.updateSesionCaja({ ...caja, estado: 'cerrada', fechaCierre: new Date().toISOString(), montoCierre: 0 } as any);
            toast.success(`🗑️ Caja "${caja.cajaNombre || 'Caja'}" eliminada`);
        } catch { toast.error('Error al eliminar caja'); }
    };

    // Cajas activas para el panel multi-caja (excluye las entregadas localmente)
    const cajasAbiertas = useMemo(() =>
        sesiones.filter(s => s.estado === 'abierta' && !cierresLocales.has(s.id))
            .sort((a, b) => new Date(a.fechaApertura).getTime() - new Date(b.fechaApertura).getTime())
    , [sesiones, cierresLocales]);

    // Caja de referencia para cronómetro: primera caja abierta (o cajaActiva)
    const cajaReferencia = cajaActiva ?? cajasAbiertas[0];
    const turnoActual = cajasAbiertas[0]?.turno;
    const hayJornada = cajasAbiertas.length > 0;

    // Cronómetro de turno
    useEffect(() => {
        if (!cajaReferencia) { setTiempoTurno(''); return; }
        const calc = () => {
            const diff = Date.now() - new Date(cajaReferencia.fechaApertura).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setTiempoTurno(`${h}h ${String(m).padStart(2,'0')}m`);
        };
        calc();
        const id = setInterval(calc, 30000);
        return () => clearInterval(id);
    }, [cajaReferencia]);

    // Totales calculados
    const totalArqueo = useMemo(() => {
        return [...BILLETES, ...MONEDAS].reduce((acc, d) => {
            const cant = parseInt(arqueo[String(d.valor)] || '0') || 0;
            return acc + cant * d.valor;
        }, 0);
    }, [arqueo]);

    const ventasHoy = useMemo(() => {
        const hoy = new Date().toISOString().split('T')[0];
        return ventas.filter(v => v.fecha.startsWith(hoy));
    }, [ventas]);

    const totalVentasHoy = useMemo(() =>
        ventasHoy.reduce((acc, v) => acc + v.total, 0)
    , [ventasHoy]);

    const { totalEntradas, totalSalidas } = useMemo(() => {
        const movs = cajaActiva?.movimientos || [];
        return {
            totalEntradas: movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0),
            totalSalidas:  movs.filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0),
        };
    }, [cajaActiva]);

    // ── Caja seleccionada para Resumen / Arqueo / Movimientos ──────────────────
    const cajaVista = useMemo(() =>
        cajasAbiertas.find(c => c.id === cajaSeleccionadaId) ?? cajaActiva ?? cajasAbiertas[0]
    , [cajasAbiertas, cajaSeleccionadaId, cajaActiva]);

    // Sync automático al cambiar cajaActiva
    useEffect(() => {
        if (cajaActiva && !cajaSeleccionadaId) setCajaSeleccionadaId(cajaActiva.id);
    }, [cajaActiva]); // eslint-disable-line react-hooks/exhaustive-deps

    const ventasHoyCaja = useMemo(() =>
        ventasHoy.filter(v => cajaVista ? v.cajaId === cajaVista.id : true)
    , [ventasHoy, cajaVista]);

    const totalVentasHoyCaja = useMemo(() =>
        ventasHoyCaja.reduce((a, v) => a + v.total, 0)
    , [ventasHoyCaja]);

    const { totalEntradasVista, totalSalidasVista } = useMemo(() => {
        const movs = cajaVista?.movimientos || [];
        return {
            totalEntradasVista: movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0),
            totalSalidasVista:  movs.filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0),
        };
    }, [cajaVista]);

    const balanceEsperadoVista = (cajaVista?.montoApertura || 0) + totalVentasHoyCaja + totalEntradasVista - totalSalidasVista;
    const diferenciaVista      = totalArqueo - balanceEsperadoVista;
    const pctDifVista          = balanceEsperadoVista > 0 ? Math.abs(diferenciaVista) / balanceEsperadoVista : 0;
    const diferenciaColorVista = diferenciaVista === 0 ? 'emerald' : pctDifVista > 0.02 ? 'red' : 'amber';
    // ────────────────────────────────────────────────────────────────────────────

    const balanceEsperado  = (cajaActiva?.montoApertura || 0) + totalVentasHoy + totalEntradas - totalSalidas;
    const diferencia       = totalArqueo - balanceEsperado;
    const hayArqueo        = totalArqueo > 0;
    const pctDif           = balanceEsperado > 0 ? Math.abs(diferencia) / balanceEsperado : 0;
    const diferenciaColor  = diferencia === 0 ? 'emerald' : pctDif > 0.02 ? 'red' : 'amber';

    const filtradoSesiones = useMemo(() =>
        sesiones
            .filter(s => s.usuarioId.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime())
    , [sesiones, searchTerm]);

    // Cerrar una caja específica por ID (entrega de turno individual)
    const handleEntregaTurno = async (cajaId: string, montoCierre: number) => {
        const caja = sesiones.find(s => s.id === cajaId);
        if (!caja) return;
        const updated = { ...caja, estado: 'cerrada' as const, montoCierre, fechaCierre: new Date().toISOString() };
        try {
            await db.updateSesionCaja(updated);
            setCierresLocales(prev => new Set([...prev, cajaId]));
            setShowEntregaModal(false);
            setCajaEntregando(null);
            toast.success(`✅ Entrega de ${caja.cajaNombre || 'Caja'} registrada — ${caja.vendedoraNombre || 'Vendedora'}`);
        } catch (err) {
            toast.error('Error al registrar la entrega');
        }
    };

    // Cerrar TODAS las cajas de la jornada de una vez
    const handleCierreJornada = async (cierres: { cajaId: string; montoCierre: number }[]) => {
        const ahora = new Date().toISOString();
        let cerradas = 0;
        let alertas  = 0;

        for (const cierre of cierres) {
            const caja = sesiones.find(s => s.id === cierre.cajaId);
            if (!caja) continue;
            const ent = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
            const sal = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
            const esperado = caja.montoApertura + caja.totalVentas + ent - sal;
            const diff     = cierre.montoCierre - esperado;
            if (diff < -5000) alertas++;

            try {
                await db.updateSesionCaja({
                    ...caja,
                    estado: 'cerrada' as const,
                    montoCierre: cierre.montoCierre,
                    fechaCierre: ahora,
                });
                setCierresLocales(prev => new Set([...prev, cierre.cajaId]));
                cerradas++;
            } catch { /* continúa con las demás */ }
        }

        setShowCierreJornada(false);

        if (alertas > 0) {
            toast.warning(`⚠️ Jornada cerrada — ${cerradas} cajas · ${alertas} con faltante detectado`);
        } else {
            toast.success(`✅ Jornada cerrada — ${cerradas} de ${cierres.length} cajas registradas`);
        }
    };

    const resumenProductosHoy = useMemo(() => {
        const r: Record<string, { nombre: string; cantidad: number; total: number }> = {};
        ventasHoy.forEach(v => v.items.forEach(item => {
            if (!r[item.productoId]) {
                r[item.productoId] = { nombre: getProductoById(item.productoId)?.nombre || 'Producto', cantidad: 0, total: 0 };
            }
            r[item.productoId].cantidad += item.cantidad;
            r[item.productoId].total    += item.subtotal;
        }));
        return Object.values(r).sort((a, b) => b.total - a.total).slice(0, 6);
    }, [ventasHoy, getProductoById]);

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

            {/* ══ HEADER ══ */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        hayJornada ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                    )}>
                        <Monitor className={cn("w-5 h-5", hayJornada ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-none">Control de Caja</h2>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn("h-2 w-2 rounded-full", hayJornada ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                {hayJornada
                                    ? `${cajasAbiertas.length} cajas activas · Turno ${turnoActual || ''} · ${tiempoTurno}`
                                    : 'Sin jornada activa'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {hayJornada && cajaActiva && (
                        <>
                            <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'entrada' })}
                                className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase gap-1.5">
                                <ArrowUpCircle className="w-4 h-4" /> Entrada
                            </Button>
                            <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'salida' })}
                                className="h-10 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xs uppercase gap-1.5">
                                <ArrowDownCircle className="w-4 h-4" /> Salida
                            </Button>
                        </>
                    )}
                    {hayJornada && (
                        <Button onClick={() => setShowCierreJornada(true)}
                            className="h-10 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase gap-1.5 shadow-lg">
                            <LogOut className="w-4 h-4" /> Cerrar Jornada
                        </Button>
                    )}
                    {!hayJornada && (
                        <Button onClick={() => setShowAperturaModal(true)}
                            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase gap-2 shadow-lg shadow-blue-200">
                            <PlusCircle className="w-4 h-4" /> Iniciar Jornada
                        </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200">
                        <Bell className="w-4 h-4 text-slate-400" />
                    </Button>
                </div>
            </header>

            {/* ══ BANNER SIN JORNADA ══ */}
            {!hayJornada && (
                <section className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-2xl text-white relative overflow-hidden shadow-xl shadow-blue-200">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -mr-36 -mt-36" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full blur-2xl -ml-24 -mb-24" />
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
                                <Sun className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black">¡Buen turno! 👋</h3>
                                <p className="text-blue-200 text-sm mt-1">Abre la jornada y se crean <strong>todas las cajas</strong> automáticamente.</p>
                            </div>
                        </div>
                        <Button onClick={() => setShowAperturaModal(true)}
                            className="h-12 px-8 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-black text-sm uppercase gap-2 shrink-0">
                            <PlusCircle className="w-5 h-5" /> Iniciar Jornada
                        </Button>
                    </div>
                </section>
            )}

            {/* ══ KPIs CONSOLIDADOS DE LA JORNADA ══ */}
            {hayJornada && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        {
                            icon: <Store className="w-4 h-4" />,
                            label: 'Cajas Abiertas',
                            value: `${cajasAbiertas.length} / 7`,
                            sub: `Turno ${turnoActual || '—'} · ${tiempoTurno}`,
                            iconBg: 'bg-blue-100 text-blue-600',
                            valueCls: 'text-slate-900 dark:text-white',
                        },
                        {
                            icon: <TrendingUp className="w-4 h-4" />,
                            label: 'Ventas del Día',
                            value: formatCurrency(cajasAbiertas.reduce((a, c) => a + c.totalVentas, 0)),
                            sub: `${ventasHoy.length} transacciones`,
                            iconBg: 'bg-emerald-100 text-emerald-600',
                            valueCls: 'text-emerald-600',
                        },
                        {
                            icon: <Banknote className="w-4 h-4" />,
                            label: 'Apertura Total',
                            value: formatCurrency(cajasAbiertas.reduce((a, c) => a + c.montoApertura, 0)),
                            sub: `${cajasAbiertas.length} cajas`,
                            iconBg: 'bg-orange-100 text-orange-600',
                            valueCls: 'text-orange-600',
                        },
                        {
                            icon: <Wallet className="w-4 h-4" />,
                            label: 'Balance General',
                            value: formatCurrency(cajasAbiertas.reduce((a, c) => {
                                const ent = (c.movimientos || []).filter(m => m.tipo === 'entrada').reduce((x, m) => x + m.monto, 0);
                                const sal = (c.movimientos || []).filter(m => m.tipo === 'salida').reduce((x, m) => x + m.monto, 0);
                                return a + c.montoApertura + c.totalVentas + ent - sal;
                            }, 0)),
                            sub: 'Todas las cajas',
                            iconBg: 'bg-indigo-100 text-indigo-600',
                            valueCls: 'text-indigo-600',
                        },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", kpi.iconBg)}>{kpi.icon}</div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{kpi.label}</span>
                            </div>
                            <p className={cn("text-xl font-black tabular-nums leading-none", kpi.valueCls)}>{kpi.value}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1.5">{kpi.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ══ CONTENIDO PRINCIPAL CON TABS ══ */}
            <Tabs defaultValue="cajas" className="flex-1">
                <TabsList className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 h-auto gap-1 shadow-sm flex-wrap">
                    <TabsTrigger value="cajas"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm relative">
                        <Store className="w-3.5 h-3.5 mr-1.5" /> Cajas de Turno
                        {cajasAbiertas.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                {cajasAbiertas.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="resumen"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Resumen
                    </TabsTrigger>
                    <TabsTrigger value="arqueo"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Shield className="w-3.5 h-3.5 mr-1.5" /> Arqueo
                    </TabsTrigger>
                    <TabsTrigger value="movimientos"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Movimientos
                    </TabsTrigger>
                    <TabsTrigger value="historial"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <History className="w-3.5 h-3.5 mr-1.5" /> Historial
                    </TabsTrigger>
                    <TabsTrigger value="vigilancia"
                        className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm relative">
                        <Shield className="w-3.5 h-3.5 mr-1.5" /> Vigilancia IA
                    </TabsTrigger>
                    {esAdmin && (
                        <TabsTrigger value="prestamos"
                            className="flex-1 rounded-xl text-xs font-black uppercase tracking-wide py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm relative">
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Préstamos
                            {prestamos.filter(p => p.estado === 'pendiente').length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                    {prestamos.filter(p => p.estado === 'pendiente').length}
                                </span>
                            )}
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* ── TAB: CAJAS DE TURNO ── */}
                <TabsContent value="cajas" className="mt-4 space-y-4">
                    {/* Barra superior */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide">Cajas de la Jornada</h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">
                                {cajasAbiertas.length > 0
                                    ? `${cajasAbiertas.length} caja${cajasAbiertas.length !== 1 ? 's' : ''} activa${cajasAbiertas.length !== 1 ? 's' : ''} · Turno ${turnoActual || ''}`
                                    : 'Sin jornada activa · ' + new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
                                }
                            </p>
                        </div>
                        <Button onClick={() => setShowAperturaModal(true)}
                            className={cn(
                                "h-10 px-4 text-white rounded-xl font-black text-xs uppercase gap-2 shadow-lg",
                                hayJornada
                                    ? "bg-slate-700 hover:bg-slate-800 shadow-slate-200"
                                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                            )}>
                            <PlusCircle className="w-4 h-4" />
                            {hayJornada ? 'Agregar Caja' : 'Iniciar Jornada'}
                        </Button>
                    </div>

                    {/* Estado vacío */}
                    {cajasAbiertas.length === 0 && (
                        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <Store className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin jornada activa</p>
                            <p className="text-xs text-slate-300 font-bold mt-1">Al iniciar la jornada se abren <strong>todas las cajas</strong> automáticamente</p>
                            <Button onClick={() => setShowAperturaModal(true)}
                                className="mt-5 h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase gap-2">
                                <PlusCircle className="w-4 h-4" /> Iniciar Jornada
                            </Button>
                        </div>
                    )}

                    {/* Grilla de cajas */}
                    {cajasAbiertas.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {cajasAbiertas.map(caja => {
                                const diff = Date.now() - new Date(caja.fechaApertura).getTime();
                                const h = Math.floor(diff / 3600000);
                                const m = Math.floor((diff % 3600000) / 60000);
                                const tiempoActivo = `${h}h ${String(m).padStart(2, '0')}m`;
                                const ent = (caja.movimientos || []).filter(x => x.tipo === 'entrada').reduce((a, x) => a + x.monto, 0);
                                const sal = (caja.movimientos || []).filter(x => x.tipo === 'salida').reduce((a, x) => a + x.monto, 0);
                                const balance = caja.montoApertura + caja.totalVentas + ent - sal;
                                const turnoEmoji = caja.turno === 'Mañana' ? '☀️' : caja.turno === 'Tarde' ? '🌆' : '🌙';
                                const esPrincipal = caja.id === cajaActiva?.id;
                                return (
                                    <div key={caja.id} className={cn(
                                        "bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col",
                                        esPrincipal ? "border-blue-300 dark:border-blue-700 shadow-blue-100 dark:shadow-blue-900/20" : "border-slate-100 dark:border-slate-800"
                                    )}>
                                        {/* Banda de color */}
                                        <div className={cn("h-1.5", esPrincipal ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-gradient-to-r from-emerald-400 to-teal-400")} />

                                        <div className="p-4 space-y-3 flex-1">
                                            {/* Cabecera */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", esPrincipal ? "bg-blue-100" : "bg-slate-100 dark:bg-slate-800")}>
                                                        <Store className={cn("w-5 h-5", esPrincipal ? "text-blue-600" : "text-slate-500")} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">{caja.cajaNombre || 'Caja'}</p>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-sm">{turnoEmoji}</span>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">{caja.turno || '—'}</span>
                                                            {esPrincipal && <Badge className="text-[8px] font-black px-1.5 py-0 bg-blue-500 text-white">PRINCIPAL</Badge>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase">Activa</span>
                                                    <button onClick={() => abrirEditCaja(caja)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                        title="Editar caja">
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => eliminarCaja(caja)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Eliminar caja">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Vendedora + tiempo */}
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
                                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase flex-1 truncate">
                                                    {caja.vendedoraNombre || 'Sin asignar'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                                                    <Timer className="w-3 h-3" /> {tiempoActivo}
                                                </span>
                                            </div>

                                            {/* KPIs */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl">
                                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ventas</p>
                                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(caja.totalVentas)}</p>
                                                </div>
                                                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-xl">
                                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Balance</p>
                                                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 tabular-nums">{formatCurrency(balance)}</p>
                                                </div>
                                            </div>

                                            {/* Apertura info */}
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">
                                                Abierta: {new Date(caja.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Apertura: {formatCurrency(caja.montoApertura)}
                                            </p>

                                            {/* Botón entrega */}
                                            <Button
                                                onClick={() => { setCajaEntregando(caja); setShowEntregaModal(true); }}
                                                className="w-full h-11 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-black text-xs uppercase gap-2 mt-auto"
                                            >
                                                <Handshake className="w-4 h-4" /> Registrar Entrega de Turno
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Consolidado del turno */}
                    {cajasAbiertas.length > 1 && (
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" /> Consolidado del Turno — Todas las Cajas
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Cajas Activas', val: cajasAbiertas.length.toString(), cls: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800' },
                                    { label: 'Ventas Totales', val: formatCurrency(cajasAbiertas.reduce((a, c) => a + c.totalVentas, 0)), cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                                    { label: 'Apertura Total', val: formatCurrency(cajasAbiertas.reduce((a, c) => a + c.montoApertura, 0)), cls: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                                    {
                                        label: 'Balance General',
                                        val: formatCurrency(cajasAbiertas.reduce((a, c) => {
                                            const ent = (c.movimientos || []).filter(m => m.tipo === 'entrada').reduce((x, m) => x + m.monto, 0);
                                            const sal = (c.movimientos || []).filter(m => m.tipo === 'salida').reduce((x, m) => x + m.monto, 0);
                                            return a + c.montoApertura + c.totalVentas + ent - sal;
                                        }, 0)),
                                        cls: 'text-indigo-600',
                                        bg: 'bg-indigo-50 dark:bg-indigo-900/10'
                                    },
                                ].map(item => (
                                    <div key={item.label} className={cn("p-3 rounded-xl", item.bg)}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className={cn("text-xl font-black tabular-nums", item.cls)}>{item.val}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Botón cierre masivo */}
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                <p className="text-xs text-slate-400 font-bold">
                                    Cierra todas las cajas del turno de una sola vez y registra las entregas.
                                </p>
                                <Button
                                    onClick={() => setShowCierreJornada(true)}
                                    className="shrink-0 h-11 px-6 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase gap-2 shadow-lg"
                                >
                                    <LogOut className="w-4 h-4" /> Cerrar Jornada Completa
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ── TAB: RESUMEN ── */}
                <TabsContent value="resumen" className="mt-4 space-y-4">

                    {/* ── Selector de caja (CajaPicker) ── */}
                    {cajasAbiertas.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {cajasAbiertas.map((c, i) => {
                                const emojis = ['🏪','🍦','🍟','🍺','🎂','☕','🎁'];
                                const isSelected = c.id === cajaVista?.id;
                                return (
                                    <button key={c.id} onClick={() => setCajaSeleccionadaId(c.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black uppercase whitespace-nowrap transition-all shrink-0",
                                            isSelected
                                                ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                        )}>
                                        <span>{emojis[i] || '📦'}</span>
                                        <span>{c.cajaNombre || 'Caja'}</span>
                                        <span className={cn("text-[9px] tabular-nums", isSelected ? "text-white/60" : "text-slate-400")}>
                                            {formatCurrency(c.totalVentas)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Estado de caja */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Caja seleccionada */}
                        <div className={cn(
                            "px-4 py-3 rounded-xl border shadow-sm flex items-center gap-3",
                            cajaVista
                                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40"
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        )}>
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cajaVista ? "bg-emerald-100" : "bg-slate-200")}>
                                <Monitor className={cn("w-4 h-4", cajaVista ? "text-emerald-600" : "text-slate-400")} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase truncate">
                                        {cajaVista?.cajaNombre || 'Sin caja'}
                                    </p>
                                    <Badge className={cn("text-[9px] font-black px-1.5 py-0 shrink-0", cajaVista ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                                        {cajaVista ? 'ACTIVA' : 'CERRADA'}
                                    </Badge>
                                </div>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Saldo en Sistema</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                                    {formatCurrency(balanceEsperadoVista)}
                                </p>
                                {cajaVista?.vendedoraNombre && (
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">
                                        👤 {cajaVista.vendedoraNombre}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ingresos */}
                        <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 shadow-sm flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-blue-800 dark:text-blue-200 uppercase">Ingresos</p>
                                <p className="text-[9px] text-blue-500 font-bold">Ventas + Entradas</p>
                                <p className="text-xl font-black text-blue-700 dark:text-blue-300 tabular-nums leading-tight">
                                    {formatCurrency(totalVentasHoyCaja + totalEntradasVista)}
                                </p>
                                <p className="text-[9px] text-blue-400 font-bold">
                                    {ventasHoyCaja.length} ventas · {(cajaVista?.movimientos || []).filter(m => m.tipo === 'entrada').length} entradas
                                </p>
                            </div>
                        </div>

                        {/* Egresos */}
                        <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40 shadow-sm flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                                <TrendingDown className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-rose-800 dark:text-rose-200 uppercase">Egresos</p>
                                <p className="text-[9px] text-rose-500 font-bold">Salidas registradas</p>
                                <p className="text-xl font-black text-rose-600 tabular-nums leading-tight">
                                    -{formatCurrency(totalSalidasVista)}
                                </p>
                                <p className="text-[9px] text-rose-400 font-bold">
                                    {(cajaVista?.movimientos || []).filter(m => m.tipo === 'salida').length} salidas registradas
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Top Productos + Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Top Productos */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                    <Package className="w-4 h-4 text-blue-500" /> Top Productos Hoy
                                </h3>
                                <Badge variant="outline" className="text-[9px] font-black text-blue-600 border-blue-200 bg-blue-50">VENTAS BRUTAS</Badge>
                            </div>
                            <div className="space-y-1.5">
                                {resumenProductosHoy.length > 0 ? resumenProductosHoy.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 group transition-all">
                                        <span className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border flex-shrink-0",
                                            i === 0 ? "bg-yellow-100 border-yellow-200 text-yellow-700" :
                                            i === 1 ? "bg-slate-100 border-slate-200 text-slate-600" :
                                            i === 2 ? "bg-orange-100 border-orange-200 text-orange-600" :
                                            "bg-slate-50 border-slate-100 text-slate-400"
                                        )}>#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-800 dark:text-white truncate uppercase">{p.nombre}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{p.cantidad} unidades</p>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(p.total)}</span>
                                    </div>
                                )) : (
                                    <div className="py-8 text-center">
                                        <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Sin ventas hoy</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-widest mb-4">
                                <ShoppingBag className="w-4 h-4 text-emerald-500" /> Últimas Ventas
                            </h3>
                            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                                {ventasHoy.length > 0 ? ventasHoy.slice().reverse().flatMap(v =>
                                    v.items.map((item, idx) => (
                                        <div key={`${v.id}-${idx}`} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 dark:text-white truncate uppercase">
                                                    {getProductoById(item.productoId)?.nombre || 'Producto'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ×{item.cantidad}
                                                </p>
                                            </div>
                                            <span className="text-xs font-black text-emerald-600 tabular-nums">{formatCurrency(item.subtotal)}</span>
                                        </div>
                                    ))
                                ).slice(0, 10) : (
                                    <div className="py-8 text-center">
                                        <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Esperando operaciones...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ── TAB: ARQUEO ── */}
                <TabsContent value="arqueo" className="mt-4 space-y-3">
                    {/* CajaPicker */}
                    {cajasAbiertas.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {cajasAbiertas.map((c, i) => {
                                const emojis = ['🏪','🍦','🍟','🍺','🎂','☕','🎁'];
                                const isSelected = c.id === cajaVista?.id;
                                return (
                                    <button key={c.id} onClick={() => setCajaSeleccionadaId(c.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black uppercase whitespace-nowrap transition-all shrink-0",
                                            isSelected
                                                ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                        )}>
                                        <span>{emojis[i] || '📦'}</span>
                                        <span>{c.cajaNombre || 'Caja'}</span>
                                        <span className={cn("text-[9px] tabular-nums", isSelected ? "text-white/60" : "text-slate-400")}>
                                            {formatCurrency(c.totalVentas)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                        {/* Denominaciones */}
                        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                    <Shield className="w-4 h-4 text-blue-600" /> Arqueo Ciego
                                </h3>
                                <button
                                    onClick={() => setArqueo({})}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors"
                                >
                                    <RefreshCw className="w-3 h-3" /> Limpiar
                                </button>
                            </div>

                            {/* Tabla de denominaciones */}
                            <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                                {/* Encabezado de columnas */}
                                <div className="grid grid-cols-[1fr_100px_120px] bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Denominación</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</span>
                                </div>

                                {/* ── BILLETES ── */}
                                <div className="grid grid-cols-[1fr_100px_120px] items-center px-4 py-2 bg-gradient-to-r from-purple-50/60 to-transparent dark:from-purple-900/10 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Billetes</span>
                                    </div>
                                    <div />
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-purple-400 tabular-nums">
                                            {formatCurrency(BILLETES.reduce((acc, d) => acc + (parseInt(arqueo[String(d.valor)] || '0') || 0) * d.valor, 0))}
                                        </span>
                                    </div>
                                </div>

                                {BILLETES.map((d) => {
                                    const cant   = parseInt(arqueo[String(d.valor)] || '0') || 0;
                                    const subtot = cant * d.valor;
                                    return (
                                        <div key={d.valor} className="grid grid-cols-[1fr_100px_120px] items-center px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                                            <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg border font-black text-xs w-fit", d.color)}>
                                                {d.label}
                                            </div>
                                            <div className="flex justify-center">
                                                <Input
                                                    type="number" min="0"
                                                    className="h-9 w-[72px] bg-white dark:bg-slate-900 text-sm font-black border-slate-200 dark:border-slate-700 text-center rounded-xl focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20"
                                                    placeholder="0"
                                                    value={arqueo[String(d.valor)] || ''}
                                                    onChange={e => setArqueo(prev => ({ ...prev, [String(d.valor)]: e.target.value }))}
                                                />
                                            </div>
                                            <div className="text-right">
                                                <span className={cn("text-sm font-black tabular-nums", subtot > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-200 dark:text-slate-700")}>
                                                    {subtot > 0 ? formatCurrency(subtot) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* ── MONEDAS ── */}
                                <div className="grid grid-cols-[1fr_100px_120px] items-center px-4 py-2 bg-gradient-to-r from-slate-50/80 to-transparent dark:from-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Coins className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monedas</span>
                                    </div>
                                    <div />
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-slate-400 tabular-nums">
                                            {formatCurrency(MONEDAS.reduce((acc, d) => acc + (parseInt(arqueo[String(d.valor)] || '0') || 0) * d.valor, 0))}
                                        </span>
                                    </div>
                                </div>

                                {MONEDAS.map((d) => {
                                    const cant   = parseInt(arqueo[String(d.valor)] || '0') || 0;
                                    const subtot = cant * d.valor;
                                    return (
                                        <div key={d.valor} className="grid grid-cols-[1fr_100px_120px] items-center px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                                            <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg border font-black text-xs w-fit", d.color)}>
                                                {d.label}
                                            </div>
                                            <div className="flex justify-center">
                                                <Input
                                                    type="number" min="0"
                                                    className="h-9 w-[72px] bg-white dark:bg-slate-900 text-sm font-black border-slate-200 dark:border-slate-700 text-center rounded-xl focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20"
                                                    placeholder="0"
                                                    value={arqueo[String(d.valor)] || ''}
                                                    onChange={e => setArqueo(prev => ({ ...prev, [String(d.valor)]: e.target.value }))}
                                                />
                                            </div>
                                            <div className="text-right">
                                                <span className={cn("text-sm font-black tabular-nums", subtot > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-200 dark:text-slate-700")}>
                                                    {subtot > 0 ? formatCurrency(subtot) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total contado */}
                            <div className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border-2",
                                hayArqueo ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700" : "bg-slate-50 border-slate-200"
                            )}>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total Contado</p>
                                    <p className={cn("text-2xl font-black tabular-nums mt-0.5", hayArqueo ? "text-indigo-700 dark:text-indigo-300" : "text-slate-300")}>
                                        {hayArqueo ? formatCurrency(totalArqueo) : '—'}
                                    </p>
                                </div>
                                {hayArqueo && <Banknote className="w-8 h-8 text-indigo-300" />}
                            </div>

                            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <AlertCircle className="w-4 h-4 text-blue-500 flex-none mt-0.5" />
                                <p className="text-xs text-slate-500">
                                    Diferencias <strong className="text-blue-700 dark:text-blue-400">&gt; 2%</strong> activan auditoría automática.
                                </p>
                            </div>

                            <Button onClick={() => setShowCierreModal(true)}
                                className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest gap-2">
                                <Lock className="w-4 h-4" /> Finalizar Turno y Generar Reporte
                            </Button>
                        </div>

                        {/* Panel de conciliación */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Desglose — usa cajaVista */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                    <BarChart3 className="w-4 h-4 text-blue-600" /> Conciliación — {cajaVista?.cajaNombre || 'Caja'}
                                </h3>
                                {[
                                    { label: 'Monto Apertura', val: cajaVista?.montoApertura || 0,  cls: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800' },
                                    { label: 'Ventas del Día',  val: totalVentasHoyCaja,             cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                                    { label: 'Entradas',        val: totalEntradasVista,             cls: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/10' },
                                    { label: 'Salidas',         val: -totalSalidasVista,             cls: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/10' },
                                ].map(row => (
                                    <div key={row.label} className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl", row.bg)}>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{row.label}</span>
                                        <span className={cn("text-sm font-black tabular-nums", row.cls)}>
                                            {row.val < 0 ? '-' : ''}{formatCurrency(Math.abs(row.val))}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700">
                                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wide">Sistema Espera</span>
                                    <span className="text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums">{formatCurrency(balanceEsperadoVista)}</span>
                                </div>
                            </div>

                            {/* Resultado diferencia — usa cajaVista */}
                            <div className={cn(
                                "p-5 rounded-2xl border-2 shadow-sm",
                                diferenciaColorVista === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700" :
                                diferenciaColorVista === 'amber'   ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700" :
                                                                     "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                            )}>
                                {hayArqueo ? (
                                    <>
                                        <div className="flex items-center gap-3 mb-3">
                                            {diferenciaColorVista === 'emerald'
                                                ? <CheckCircle className="w-6 h-6 text-emerald-500" />
                                                : <AlertCircle className={cn("w-6 h-6", diferenciaColorVista === 'amber' ? "text-amber-500" : "text-red-500")} />
                                            }
                                            <p className={cn("text-sm font-black uppercase tracking-wide",
                                                diferenciaColorVista === 'emerald' ? "text-emerald-700" :
                                                diferenciaColorVista === 'amber'   ? "text-amber-700" : "text-red-700"
                                            )}>
                                                {diferenciaVista === 0 ? 'Cuadra Exacto ✓' : diferenciaVista > 0 ? 'Sobrante' : 'Faltante'}
                                            </p>
                                        </div>
                                        <p className={cn("text-3xl font-black tabular-nums",
                                            diferenciaColorVista === 'emerald' ? "text-emerald-700" :
                                            diferenciaColorVista === 'amber'   ? "text-amber-700" : "text-red-700"
                                        )}>
                                            {diferenciaVista > 0 ? '+' : ''}{formatCurrency(diferenciaVista)}
                                        </p>
                                        <p className={cn("text-xs font-bold mt-2",
                                            diferenciaColorVista === 'emerald' ? "text-emerald-500" :
                                            diferenciaColorVista === 'amber'   ? "text-amber-500" : "text-red-500"
                                        )}>
                                            {(pctDifVista * 100).toFixed(2)}% de diferencia · {diferenciaColorVista === 'red' ? 'Requiere auditoría' : diferenciaColorVista === 'amber' ? 'Revisar antes de cerrar' : 'Todo en orden'}
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <Banknote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Ingresa las denominaciones para ver la diferencia</p>
                                    </div>
                                )}
                            </div>

                            {/* Botones rápidos */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'entrada' })}
                                    className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase flex-col gap-1">
                                    <ArrowUpCircle className="w-5 h-5" /> Entrada
                                </Button>
                                <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'salida' })}
                                    className="h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xs uppercase flex-col gap-1">
                                    <ArrowDownCircle className="w-5 h-5" /> Salida
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ── TAB: MOVIMIENTOS ── */}
                <TabsContent value="movimientos" className="mt-4 space-y-3">
                    {/* CajaPicker */}
                    {cajasAbiertas.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {cajasAbiertas.map((c, i) => {
                                const emojis = ['🏪','🍦','🍟','🍺','🎂','☕','🎁'];
                                const isSelected = c.id === cajaVista?.id;
                                const movCount = (c.movimientos || []).length;
                                return (
                                    <button key={c.id} onClick={() => setCajaSeleccionadaId(c.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black uppercase whitespace-nowrap transition-all shrink-0",
                                            isSelected
                                                ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                        )}>
                                        <span>{emojis[i] || '📦'}</span>
                                        <span>{c.cajaNombre || 'Caja'}</span>
                                        {movCount > 0 && (
                                            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full", isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                                                {movCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-600" /> {cajaVista?.cajaNombre || 'Caja'} — Movimientos del Turno
                            </h3>
                            <div className="flex gap-2">
                                <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'entrada' })}
                                    className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase gap-1.5">
                                    <ArrowUpCircle className="w-3.5 h-3.5" /> Entrada
                                </Button>
                                <Button onClick={() => setMovementModal({ isOpen: true, tipo: 'salida' })}
                                    className="h-9 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xs uppercase gap-1.5">
                                    <ArrowDownCircle className="w-3.5 h-3.5" /> Salida
                                </Button>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                            {(cajaVista?.movimientos || []).length > 0
                                ? [...(cajaVista?.movimientos || [])].reverse().map((mov, i) => (
                                    <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                                            mov.tipo === 'entrada' ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-rose-100 dark:bg-rose-900/30"
                                        )}>
                                            {mov.tipo === 'entrada'
                                                ? <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                                                : <ArrowDownCircle className="w-5 h-5 text-rose-600" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{mov.motivo}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                {new Date(mov.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                        <Badge className={cn("font-black text-sm tabular-nums px-3 py-1",
                                            mov.tipo === 'entrada' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(mov.monto)}
                                        </Badge>
                                    </div>
                                ))
                                : (
                                    <div className="py-16 text-center">
                                        <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin movimientos en este turno</p>
                                        <p className="text-xs text-slate-300 font-bold mt-1">Registra entradas o salidas de efectivo aquí</p>
                                    </div>
                                )
                            }
                        </div>

                        {/* Resumen entradas/salidas */}
                        {(cajaVista?.movimientos || []).length > 0 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Total entradas:</span>
                                <span className="text-sm font-black text-emerald-600">+{formatCurrency(totalEntradasVista)}</span>
                                <span className="text-slate-300 text-xs">|</span>
                                <span className="text-xs font-bold text-slate-500 uppercase">Total salidas:</span>
                                <span className="text-sm font-black text-rose-600">-{formatCurrency(totalSalidasVista)}</span>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── TAB: HISTORIAL ── */}
                <TabsContent value="historial" className="mt-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-400" /> Auditoría de Turnos
                            </h3>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input
                                    placeholder="Buscar operador..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10 h-9 bg-slate-50 dark:bg-slate-800 text-xs rounded-xl border-slate-200 dark:border-slate-700"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="text-[11px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Operador</th>
                                        <th className="px-5 py-3 text-left">
                                            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Apertura</span>
                                        </th>
                                        <th className="px-5 py-3 text-right">Monto Inicial</th>
                                        <th className="px-5 py-3 text-right">Ventas</th>
                                        <th className="px-5 py-3 text-right">Balance</th>
                                        <th className="px-5 py-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {filtradoSesiones.length > 0 ? filtradoSesiones.map(sesion => {
                                        const ent     = (sesion.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
                                        const sal     = (sesion.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
                                        const balance = sesion.montoApertura + sesion.totalVentas + ent - sal;
                                        const activo  = sesion.id === cajaActiva?.id;
                                        return (
                                            <tr key={sesion.id} className={cn("hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors", activo ? "bg-blue-50/40 dark:bg-blue-900/10" : "")}>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", activo ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400")}>
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{sesion.usuarioId}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">ID: {sesion.id.substring(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-slate-500 font-bold">
                                                    {new Date(sesion.fechaApertura).toLocaleDateString()} {new Date(sesion.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-black text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(sesion.montoApertura)}</td>
                                                <td className="px-5 py-4 text-right text-xs font-black text-emerald-600 tabular-nums">{formatCurrency(sesion.totalVentas)}</td>
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Badge className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase", activo ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                                                            {activo ? 'Activo' : 'Cerrado'}
                                                        </Badge>
                                                        {!activo && (
                                                            <button 
                                                                onClick={() => {
                                                                    toast.promise(new Promise(resolve => setTimeout(resolve, 800)), {
                                                                        loading: 'Preparando Reporte Z Histórico...',
                                                                        success: 'Reporte Generado — Verificando Diferencias',
                                                                        error: 'Error al generar reporte'
                                                                    });
                                                                }}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                                                                title="Ver Auditoría"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-16 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                                                No hay turnos registrados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* ── TAB: VIGILANCIA IA ── */}
                <TabsContent value="vigilancia" className="mt-4">
                    <VigilianciaIA
                        sesiones={sesiones}
                        ventas={ventas}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* ── TAB: PRÉSTAMOS ENTRE CAJAS (solo ADMIN) ── */}
                {esAdmin && (
                    <TabsContent value="prestamos" className="mt-4 space-y-4">
                        {/* Encabezado */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                                    <ArrowRightLeft className="w-4 h-4 text-violet-500" />
                                    Préstamos entre Cajas
                                </h3>
                                <p className="text-xs text-slate-400 font-bold mt-0.5">
                                    {prestamos.filter(p => p.estado === 'pendiente').length} pendiente(s) · Solo visible para administrador
                                </p>
                            </div>
                            <Button
                                onClick={() => setShowPrestamoModal(true)}
                                disabled={cajasAbiertas.length < 2}
                                className="h-10 px-4 text-white rounded-xl font-black text-xs uppercase gap-2 shadow-lg bg-violet-600 hover:bg-violet-700"
                            >
                                <ArrowRightLeft className="w-4 h-4" />
                                Nuevo Préstamo
                            </Button>
                        </div>

                        {/* Aviso si no hay cajas */}
                        {cajasAbiertas.length < 2 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 text-center">
                                <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase">
                                    Se necesitan al menos 2 cajas abiertas para registrar un préstamo
                                </p>
                            </div>
                        )}

                        {/* Lista de préstamos */}
                        {prestamos.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-black uppercase">Sin préstamos registrados</p>
                                <p className="text-xs font-bold mt-1">Los movimientos de dinero entre cajas aparecerán aquí</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {prestamos.map(p => {
                                    const pendiente = p.estado === 'pendiente';
                                    return (
                                        <div key={p.id} className={cn(
                                            "rounded-2xl border-2 p-4 transition-all",
                                            pendiente
                                                ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700"
                                                : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-70"
                                        )}>
                                            {/* Fila superior: cajas */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">
                                                    {p.cajaOrigenNombre}
                                                </span>
                                                <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">
                                                    {p.cajaDestinoNombre}
                                                </span>
                                                <span className={cn(
                                                    "ml-auto text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                                                    pendiente
                                                        ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100"
                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                                )}>
                                                    {pendiente ? '⏳ Pendiente' : '✅ Devuelto'}
                                                </span>
                                            </div>

                                            {/* Fila: monto + datos */}
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-xl font-black text-violet-700 dark:text-violet-300 tabular-nums">
                                                        {formatCurrency(p.monto)}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                        {p.motivo && <span className="mr-2">· {p.motivo}</span>}
                                                        Por: {p.usuarioNombre} · {new Date(p.fechaPrestamo).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    {!pendiente && p.fechaDevolucion && (
                                                        <p className="text-[10px] text-emerald-500 font-black mt-0.5">
                                                            Devuelto: {new Date(p.fechaDevolucion).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    )}
                                                </div>
                                                {pendiente && (
                                                    <Button
                                                        onClick={() => marcarDevuelto(p)}
                                                        className="h-9 px-4 text-xs font-black uppercase rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow"
                                                    >
                                                        <CheckSquare className="w-3.5 h-3.5" />
                                                        Marcar devuelto
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>
                )}
            </Tabs>

            {/* ══ MODALES ══ */}
            <CajaMovimientosModal
                isOpen={movementModal.isOpen}
                onOpenChange={open => setMovementModal(prev => ({ ...prev, isOpen: open }))}
                tipo={movementModal.tipo}
                cajasAbiertas={cajasAbiertas}
                cajaActiva={cajaActiva}
                onSubmit={async (monto, motivo, cajaId) => {
                    await registrarMovimientoCaja(monto, movementModal.tipo, motivo, usuario?.id || 'anon', cajaId);
                }}
            />
            <AperturaCajaModal isOpen={showAperturaModal} onClose={() => setShowAperturaModal(false)} onAbrir={onAbrirCaja} />
            {esAdmin && (
                <PrestamosCajaModal
                    isOpen={showPrestamoModal}
                    onOpenChange={setShowPrestamoModal}
                    cajasAbiertas={cajasAbiertas}
                    onSubmit={registrarPrestamo}
                />
            )}
            <CierreCajaModal   isOpen={showCierreModal}   onClose={() => setShowCierreModal(false)}   onCerrar={onCerrarCaja} cajaActiva={cajaActiva} formatCurrency={formatCurrency} usuario={usuario} />
            <EntregaTurnoModal
                caja={cajaEntregando}
                isOpen={showEntregaModal}
                onClose={() => { setShowEntregaModal(false); setCajaEntregando(null); }}
                onConfirmar={handleEntregaTurno}
                formatCurrency={formatCurrency}
            />
            <CierreJornadaModal
                cajas={cajasAbiertas}
                isOpen={showCierreJornada}
                onClose={() => setShowCierreJornada(false)}
                onConfirmar={handleCierreJornada}
                formatCurrency={formatCurrency}
                ventas={ventasHoy}
            />

            {/* Modal Trazas */}
            <Dialog open={showTracesModal} onOpenChange={setShowTracesModal}>
                <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="bg-slate-900 p-5 flex flex-col items-center text-center">
                        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center mb-3 border border-white/10">
                            <Search className="w-5 h-5 text-white" />
                        </div>
                        <DialogTitle className="text-lg font-black text-white uppercase">Trazas del Turno</DialogTitle>
                        <DialogDescription className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">
                            Movimientos registrados en esta sesión
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                        {(cajaActiva?.movimientos || []).length > 0
                            ? [...(cajaActiva?.movimientos || [])].reverse().map((mov, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", mov.tipo === 'entrada' ? "bg-emerald-500" : "bg-rose-500")} />
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{mov.motivo}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">{new Date(mov.fecha).toLocaleString()}</p>
                                    </div>
                                    <span className={cn("text-sm font-black tabular-nums", mov.tipo === 'entrada' ? "text-emerald-600" : "text-rose-600")}>
                                        {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(mov.monto)}
                                    </span>
                                </div>
                            ))
                            : (
                                <div className="py-10 text-center">
                                    <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-bold uppercase">Sin movimientos aún</p>
                                </div>
                            )
                        }
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="ghost" className="w-full h-10 text-xs font-black text-slate-400 uppercase rounded-xl" onClick={() => setShowTracesModal(false)}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ══ MODAL EDITAR CAJA ══ */}
            <Dialog open={!!editandoCaja} onOpenChange={() => setEditandoCaja(null)}>
                <DialogContent className="max-w-sm rounded-2xl p-0 border-none shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="bg-slate-900 p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                                <Store className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black text-white uppercase">Editar Caja</DialogTitle>
                                <DialogDescription className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                    {editandoCaja?.cajaNombre || 'Caja'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la caja</label>
                            <input
                                value={editNombreCaja}
                                onChange={e => setEditNombreCaja(e.target.value)}
                                className="w-full h-10 px-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-indigo-400"
                                placeholder="Ej: Caja Principal"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre vendedora</label>
                            <input
                                value={editVendedoraCaja}
                                onChange={e => setEditVendedoraCaja(e.target.value)}
                                className="w-full h-10 px-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-indigo-400"
                                placeholder="Ej: María García"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 h-10 rounded-xl font-black text-xs uppercase" onClick={() => setEditandoCaja(null)}>
                                Cancelar
                            </Button>
                            <Button
                                disabled={guardandoCaja || !editNombreCaja.trim()}
                                onClick={guardarEditCaja}
                                className="flex-1 h-10 rounded-xl font-black text-xs uppercase bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {guardandoCaja ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
