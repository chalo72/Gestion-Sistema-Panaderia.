import { useState, useMemo, useEffect } from 'react';
import {
    Search, Bell, History, PlusCircle, Monitor, Shield,
    CheckCircle, User, BarChart3, Eye, Lock, Clock,
    Sun, DollarSign, AlertCircle, Package, ShoppingBag,
    ShoppingCart, TrendingUp, TrendingDown, ArrowUpCircle,
    ArrowDownCircle, Timer, Banknote, Coins, RefreshCw,
    CalendarDays, Wallet, Store, Users, Handshake, AlertTriangle
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
import type { CajaSesion, Venta, Categoria, Producto } from '@/types';

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

function EntregaTurnoModal({ caja, isOpen, onClose, onConfirmar, formatCurrency }: EntregaModalProps) {
    const [arqueo,  setArqueo]  = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const totalArqueo = useMemo(() =>
        [...BILLETES, ...MONEDAS].reduce((acc, d) => {
            const cant = parseInt(arqueo[String(d.valor)] || '0') || 0;
            return acc + cant * d.valor;
        }, 0),
    [arqueo]);

    if (!caja) return null;

    const entradas  = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
    const salidas   = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
    const esperado  = caja.montoApertura + caja.totalVentas + entradas - salidas;
    const diferencia = totalArqueo - esperado;
    const hayArqueo  = totalArqueo > 0;
    const esFaltante = diferencia < 0;
    const pct        = esperado > 0 ? Math.abs(diferencia) / esperado : 0;
    const hayAlerta  = diferencia < -5000 || pct > 0.02;
    const turnoEmoji = caja.turno === 'Mañana' ? '☀️' : caja.turno === 'Tarde' ? '🌆' : '🌙';

    const handleConfirmar = async () => {
        setLoading(true);
        await onConfirmar(caja.id, totalArqueo);
        setArqueo({});
        setLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl rounded-2xl p-0 border-none shadow-2xl bg-white dark:bg-slate-900 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <DialogHeader className="bg-slate-900 p-5 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                            <Handshake className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black text-white uppercase">
                                Entrega de Turno — {caja.cajaNombre || 'Caja'}
                            </DialogTitle>
                            <DialogDescription className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                {turnoEmoji} {caja.turno || '—'} · {caja.vendedoraNombre || 'Vendedora'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* Resumen esperado */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Apertura',      val: caja.montoApertura, cls: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/10' },
                            { label: 'Ventas',        val: caja.totalVentas,   cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                            { label: 'Sistema Espera', val: esperado,           cls: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
                        ].map(item => (
                            <div key={item.label} className={cn("p-3 rounded-xl text-center", item.bg)}>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                <p className={cn("text-base font-black tabular-nums", item.cls)}>{formatCurrency(item.val)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Conteo de denominaciones */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Arqueo Ciego — Cuenta el efectivo entregado</p>
                        <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="grid grid-cols-[1fr_90px_110px] bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Denominación</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase text-center">Cantidad</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase text-right">Subtotal</span>
                            </div>
                            {[...BILLETES, ...MONEDAS].map(d => {
                                const cant = parseInt(arqueo[String(d.valor)] || '0') || 0;
                                const sub  = cant * d.valor;
                                return (
                                    <div key={d.valor} className="grid grid-cols-[1fr_90px_110px] items-center px-4 py-2 border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                                        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg border font-black text-xs w-fit", d.color)}>{d.label}</span>
                                        <div className="flex justify-center">
                                            <input
                                                type="number" min="0"
                                                className="h-8 w-16 text-sm font-black text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-400 outline-none"
                                                placeholder="0"
                                                value={arqueo[String(d.valor)] || ''}
                                                onChange={e => setArqueo(prev => ({ ...prev, [String(d.valor)]: e.target.value }))}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <span className={cn("text-sm font-black tabular-nums", sub > 0 ? "text-indigo-600" : "text-slate-200")}>
                                                {sub > 0 ? formatCurrency(sub) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resultado diferencia */}
                    {hayArqueo && (
                        <div className={cn(
                            "p-4 rounded-2xl border-2 flex items-center justify-between",
                            !esFaltante ? "bg-emerald-50 border-emerald-200" : hayAlerta ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-200"
                        )}>
                            <div>
                                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1",
                                    !esFaltante ? "text-emerald-500" : hayAlerta ? "text-red-500" : "text-amber-500"
                                )}>
                                    {diferencia === 0 ? '✓ Cuadra exacto' : esFaltante ? (hayAlerta ? '⚠️ FALTANTE — Posible sustracción' : 'Pequeño faltante') : 'Sobrante'}
                                </p>
                                <p className={cn("text-3xl font-black tabular-nums",
                                    !esFaltante ? "text-emerald-700" : hayAlerta ? "text-red-700" : "text-amber-700"
                                )}>
                                    {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
                                </p>
                                <p className="text-xs font-bold text-slate-400 mt-1">
                                    Contado: {formatCurrency(totalArqueo)} · Esperado: {formatCurrency(esperado)}
                                </p>
                            </div>
                            {hayAlerta && <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />}
                        </div>
                    )}

                    {/* Total contado */}
                    <div className={cn(
                        "flex items-center justify-between p-3 rounded-xl border-2",
                        hayArqueo ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"
                    )}>
                        <span className="text-xs font-black text-slate-500 uppercase">Total Contado</span>
                        <span className={cn("text-xl font-black tabular-nums", hayArqueo ? "text-indigo-700" : "text-slate-300")}>
                            {hayArqueo ? formatCurrency(totalArqueo) : '—'}
                        </span>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-black text-xs uppercase" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            disabled={!hayArqueo || loading}
                            onClick={handleConfirmar}
                            className={cn(
                                "flex-1 h-12 rounded-xl font-black text-xs uppercase text-white gap-2",
                                hayAlerta ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-black"
                            )}
                        >
                            <Lock className="w-4 h-4" />
                            {loading ? 'Cerrando...' : 'Confirmar Entrega'}
                        </Button>
                    </div>
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
    registrarMovimientoCaja: (monto: number, tipo: 'entrada' | 'salida', motivo: string, usuarioId: string) => Promise<any>;
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
    const [cajaEntregando,    setCajaEntregando]    = useState<CajaSesion | null>(null);
    const [showEntregaModal,  setShowEntregaModal]  = useState(false);
    const [cierresLocales,    setCierresLocales]    = useState<Set<string>>(new Set());

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

    // Cerrar una caja específica por ID (entrega de turno)
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
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                        hayJornada ? "bg-emerald-500 shadow-emerald-200" : "bg-blue-600 shadow-blue-200"
                    )}>
                        <Monitor className="w-6 h-6 text-white" />
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
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase">Activa</span>
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
                        </div>
                    )}
                </TabsContent>

                {/* ── TAB: RESUMEN ── */}
                <TabsContent value="resumen" className="mt-4 space-y-4">
                    {/* Estado de caja */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* POS Principal */}
                        <div className={cn(
                            "px-4 py-3 rounded-xl border shadow-sm flex items-center gap-3",
                            cajaActiva
                                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40"
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        )}>
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cajaActiva ? "bg-emerald-100" : "bg-slate-200")}>
                                <Monitor className={cn("w-4 h-4", cajaActiva ? "text-emerald-600" : "text-slate-400")} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase">POS Principal</p>
                                    <Badge className={cn("text-[9px] font-black px-1.5 py-0", cajaActiva ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                                        {cajaActiva ? 'ACTIVO' : 'CERRADO'}
                                    </Badge>
                                </div>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Saldo en Sistema</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                                    {formatCurrency(balanceEsperado)}
                                </p>
                                {cajaActiva && (
                                    <button onClick={() => setShowTracesModal(true)}
                                        className="text-[9px] font-black text-blue-600 uppercase hover:underline tracking-wide">
                                        Ver trazas →
                                    </button>
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
                                    {formatCurrency(totalVentasHoy + totalEntradas)}
                                </p>
                                <p className="text-[9px] text-blue-400 font-bold">
                                    {ventasHoy.length} ventas · {(cajaActiva?.movimientos || []).filter(m => m.tipo === 'entrada').length} entradas
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
                                    -{formatCurrency(totalSalidas)}
                                </p>
                                <p className="text-[9px] text-rose-400 font-bold">
                                    {(cajaActiva?.movimientos || []).filter(m => m.tipo === 'salida').length} salidas registradas
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
                <TabsContent value="arqueo" className="mt-4">
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
                            {/* Desglose */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                    <BarChart3 className="w-4 h-4 text-blue-600" /> Conciliación Sistema
                                </h3>
                                {[
                                    { label: 'Monto Apertura', val: cajaActiva?.montoApertura || 0, cls: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800' },
                                    { label: 'Ventas del Día',  val: totalVentasHoy,                 cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                                    { label: 'Entradas',        val: totalEntradas,                  cls: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/10' },
                                    { label: 'Salidas',         val: -totalSalidas,                  cls: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/10' },
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
                                    <span className="text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums">{formatCurrency(balanceEsperado)}</span>
                                </div>
                            </div>

                            {/* Resultado diferencia */}
                            <div className={cn(
                                "p-5 rounded-2xl border-2 shadow-sm",
                                diferenciaColor === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700" :
                                diferenciaColor === 'amber'   ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700" :
                                                                "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                            )}>
                                {hayArqueo ? (
                                    <>
                                        <div className="flex items-center gap-3 mb-3">
                                            {diferenciaColor === 'emerald'
                                                ? <CheckCircle className="w-6 h-6 text-emerald-500" />
                                                : <AlertCircle className={cn("w-6 h-6", diferenciaColor === 'amber' ? "text-amber-500" : "text-red-500")} />
                                            }
                                            <p className={cn("text-sm font-black uppercase tracking-wide",
                                                diferenciaColor === 'emerald' ? "text-emerald-700" :
                                                diferenciaColor === 'amber'   ? "text-amber-700" : "text-red-700"
                                            )}>
                                                {diferencia === 0 ? 'Cuadra Exacto ✓' : diferencia > 0 ? `Sobrante` : `Faltante`}
                                            </p>
                                        </div>
                                        <p className={cn("text-3xl font-black tabular-nums",
                                            diferenciaColor === 'emerald' ? "text-emerald-700" :
                                            diferenciaColor === 'amber'   ? "text-amber-700" : "text-red-700"
                                        )}>
                                            {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
                                        </p>
                                        <p className={cn("text-xs font-bold mt-2",
                                            diferenciaColor === 'emerald' ? "text-emerald-500" :
                                            diferenciaColor === 'amber'   ? "text-amber-500" : "text-red-500"
                                        )}>
                                            {(pctDif * 100).toFixed(2)}% de diferencia · {diferenciaColor === 'red' ? 'Requiere auditoría' : diferenciaColor === 'amber' ? 'Revisar antes de cerrar' : 'Todo en orden'}
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
                <TabsContent value="movimientos" className="mt-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-600" /> Movimientos del Turno
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
                            {(cajaActiva?.movimientos || []).length > 0
                                ? [...(cajaActiva?.movimientos || [])].reverse().map((mov, i) => (
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
                        {(cajaActiva?.movimientos || []).length > 0 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Total entradas:</span>
                                <span className="text-sm font-black text-emerald-600">+{formatCurrency(totalEntradas)}</span>
                                <span className="text-slate-300 text-xs">|</span>
                                <span className="text-xs font-bold text-slate-500 uppercase">Total salidas:</span>
                                <span className="text-sm font-black text-rose-600">-{formatCurrency(totalSalidas)}</span>
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
                                                <td className="px-5 py-4 text-right text-sm font-black text-blue-600 tabular-nums">{formatCurrency(balance)}</td>
                                                <td className="px-5 py-4 text-center">
                                                    <Badge className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase", activo ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                                                        {activo ? 'Activo' : 'Cerrado'}
                                                    </Badge>
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
            </Tabs>

            {/* ══ MODALES ══ */}
            <CajaMovimientosModal
                isOpen={movementModal.isOpen}
                onOpenChange={open => setMovementModal(prev => ({ ...prev, isOpen: open }))}
                tipo={movementModal.tipo}
                onSubmit={async (monto, motivo) => {
                    await registrarMovimientoCaja(monto, movementModal.tipo, motivo, usuario?.id || 'anon');
                }}
            />
            <AperturaCajaModal isOpen={showAperturaModal} onClose={() => setShowAperturaModal(false)} onAbrir={onAbrirCaja} />
            <CierreCajaModal   isOpen={showCierreModal}   onClose={() => setShowCierreModal(false)}   onCerrar={onCerrarCaja} cajaActiva={cajaActiva} formatCurrency={formatCurrency} usuario={usuario} />
            <EntregaTurnoModal
                caja={cajaEntregando}
                isOpen={showEntregaModal}
                onClose={() => { setShowEntregaModal(false); setCajaEntregando(null); }}
                onConfirmar={handleEntregaTurno}
                formatCurrency={formatCurrency}
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
        </div>
    );
}
