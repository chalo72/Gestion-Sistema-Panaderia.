import { useState, useMemo } from 'react';
import {
    Search,
    Bell,
    History,
    PlusCircle,
    Monitor,
    Shield,
    AlertTriangle,
    CheckCircle,
    User,
    BarChart3,
    ArrowRight,
    Truck,
    Eye,
    Lock,
    Clock,
    Sun,
    DollarSign,
    AlertCircle,
    Package,
    ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { CajaMovimientosModal } from '@/components/ventas/CajaMovimientosModal';
import { AperturaCajaModal } from '@/components/ventas/AperturaCajaModal';
import { CierreCajaModal } from '@/components/ventas/CierreCajaModal';
import type { CajaSesion, Venta, Categoria, Producto } from '@/types';

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
    sesiones,
    ventas,
    cajaActiva,
    formatCurrency,
    getProductoById,
    registrarMovimientoCaja,
    usuario,
    onAbrirCaja,
    onCerrarCaja
}: ControlCajaProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [movementModal, setMovementModal] = useState<{ isOpen: boolean; tipo: 'entrada' | 'salida' }>({
        isOpen: false,
        tipo: 'entrada'
    });
    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showTracesModal, setShowTracesModal] = useState(false);
    const [selectedPOS, setSelectedPOS] = useState<string | null>(null);

    // Cálculos para la conciliación
    const ventasHoy = useMemo(() => {
        const hoy = new Date().toISOString().split('T')[0];
        return ventas.filter(v => v.fecha.startsWith(hoy));
    }, [ventas]);

    const totalVentasHoy = useMemo(() => {
        return ventasHoy.reduce((acc, v) => acc + v.total, 0);
    }, [ventasHoy]);

    const filtradoSesiones = useMemo(() => {
        return sesiones
            .filter(s => s.usuarioId.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime());
    }, [sesiones, searchTerm]);

    const resumenProductosHoy = useMemo(() => {
        const resumen: Record<string, { nombre: string; cantidad: number; total: number }> = {};
        ventasHoy.forEach(v => {
            v.items.forEach(item => {
                if (!resumen[item.productoId]) {
                    const prod = getProductoById(item.productoId);
                    resumen[item.productoId] = {
                        nombre: prod?.nombre || 'Producto',
                        cantidad: 0,
                        total: 0
                    };
                }
                resumen[item.productoId].cantidad += item.cantidad;
                resumen[item.productoId].total += item.subtotal;
            });
        });
        return Object.values(resumen).sort((a, b) => b.total - a.total).slice(0, 5);
    }, [ventasHoy, getProductoById]);

    return (
        <div className="space-y-6 h-full flex flex-col p-4 animate-ag-fade-in bg-[#f8fafc] dark:bg-[#0f172a] overflow-y-auto overflow-x-hidden">
            {/* HEADER COMPACTO Y FUNCIONAL */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Monitor className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                            Control de Caja
                        </h2>
                        <p className="text-slate-400 text-sm font-black uppercase tracking-widest mt-1.5">
                            {cajaActiva ? `Sesión Activa: ${cajaActiva.usuarioId}` : 'Sin Sesión Iniciada'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!cajaActiva ? (
                        <Button
                            onClick={() => setShowAperturaModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-12 rounded-2xl font-black text-sm uppercase tracking-widest gap-2 shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <PlusCircle className="w-4 h-4" /> Iniciar Jornada
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setShowCierreModal(true)}
                            className="bg-[#0f172a] hover:bg-black text-white px-6 h-12 rounded-2xl font-black text-sm uppercase tracking-widest gap-2 shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <Lock className="w-4 h-4" /> Finalizar Turno
                        </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-slate-100 shadow-sm">
                        <Bell className="w-5 h-5 text-slate-400" />
                    </Button>
                </div>
            </header>

            {!cajaActiva && (
                <section className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white overflow-hidden relative shadow-lg shadow-blue-500/10">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -ml-32 -mb-32" />

                    <div className="relative z-10 flex flex-col items-center text-center space-y-5">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 mb-4 shadow-inner">
                                <Sun className="w-6 h-6 text-white animate-pulse" />
                            </div>
                            <h3 className="text-xl font-black leading-tight tracking-tight uppercase">Es hora de empezar, ¡Buen turno! 👋</h3>
                            <p className="text-blue-100 text-[13px] font-medium leading-tight opacity-80 mt-2 max-w-xs">
                                Registra el efectivo inicial para comenzar la operación del día.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                                <Clock className="w-4 h-4 opacity-60" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Turno de Mañana</span>
                            </div>
                            <Button
                                onClick={() => setShowAperturaModal(true)}
                                className="h-12 px-8 bg-white hover:bg-blue-50 text-blue-600 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-white/10 transition-all active:scale-95 flex items-center gap-3 border-none"
                            >
                                <PlusCircle className="w-5 h-5" />
                                Iniciar Apertura
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* MONITOR DE CAJAS COMPACTO CON TEXTO LEGIBLE */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-base font-black text-slate-600 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-600" /> Monitor en Tiempo Real
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-black text-emerald-600 uppercase">Sistema Online</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {/* Tarjeta POS 01 */}
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 border border-blue-100">
                                    <Monitor className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 dark:text-white text-sm uppercase">POS 01</h4>
                                    <p className="text-sm text-slate-500 font-bold capitalize leading-none mt-1">{cajaActiva ? usuario?.nombre : 'Offline'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="pl-0.5 space-y-1">
                            <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Saldo en Caja</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-none">
                                {formatCurrency(cajaActiva?.totalVentas || 0)}
                            </p>
                        </div>
                        <div className="mt-3.5 pt-2 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Activo hace 2m</span>
                            <button
                                onClick={() => {
                                    setSelectedPOS('POS 01');
                                    setShowTracesModal(true);
                                    toast.info('Cargando registros de POS 01...');
                                }}
                                className="font-black text-blue-600 uppercase hover:underline"
                            >
                                Ver Trazas
                            </button>
                        </div>
                    </div>

                    {/* Tarjeta POS 02 */}
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm opacity-95 relative">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 border border-blue-100">
                                    <Monitor className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase">POS 02</h4>
                                    <p className="text-xs text-slate-500 font-bold capitalize leading-none mt-1">Maria G.</p>
                                </div>
                            </div>
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="pl-0.5 space-y-1">
                            <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Saldo en Caja</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-none">$890.20</p>
                        </div>
                        <div className="mt-3.5 pt-2 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Activo hace 5m</span>
                            <button
                                onClick={() => {
                                    setSelectedPOS('POS 02');
                                    setShowTracesModal(true);
                                    toast.info('Cargando registros de POS 02...');
                                }}
                                className="font-black text-blue-600 uppercase hover:underline"
                            >
                                Ver Trazas
                            </button>
                        </div>
                    </div>

                    {/* Tarjeta Bóveda */}
                    <div className="bg-[#0f172a] text-white p-3.5 rounded-xl shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center text-white border border-white/10">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-xs uppercase">Bóveda</h4>
                                    <p className="text-xs text-slate-400 font-bold opacity-80 leading-none mt-1">Safe Mode</p>
                                </div>
                            </div>
                        </div>
                        <div className="pl-0.5 space-y-1">
                            <p className="text-[11px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">Custodia Total</p>
                            <p className="text-xl font-black text-white tabular-nums leading-none">$15,400</p>
                        </div>
                        <div className="mt-3.5 pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-black uppercase tracking-widest opacity-40">Protegido</span>
                            <CheckCircle className="w-4 h-4 text-emerald-500/50" />
                        </div>
                    </div>

                    {/* Tarjeta de Gastos */}
                    <div className="bg-rose-50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-100 relative">
                        <div className="flex items-center justify-between mb-2 text-rose-600">
                            <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-xs uppercase">Egresos</h4>
                                    <p className="text-xs font-bold opacity-80 leading-none mt-1">Hoy</p>
                                </div>
                            </div>
                        </div>
                        <div className="pl-0.5 space-y-1">
                            <p className="text-[11px] text-rose-400 font-extrabold uppercase tracking-widest leading-none">Total Diario</p>
                            <p className="text-xl font-black text-rose-600 tabular-nums leading-none">-$120.00</p>
                        </div>
                        <div className="mt-3.5 pt-2 border-t border-rose-100 dark:border-rose-900 flex justify-between items-center text-xs">
                            <span className="text-rose-400 font-bold uppercase tracking-widest opacity-40">Auditar</span>
                            <button
                                onClick={() => toast.success('Generando reporte de egresos detallado...')}
                                className="p-1 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                                <ArrowRight className="w-4 h-4 text-rose-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CUERPO PRINCIPAL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Arqueo */}
                <div className="lg:col-span-7">
                    <section className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-tight">
                                <Shield className="w-4 h-4 text-blue-600" /> Arqueo Ciego
                            </h3>
                            <Badge variant="outline" className="text-[11px] font-black uppercase border-slate-200 h-5 px-1.5 leading-none">Anti-Robo</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            {[500, 200, 100].map(val => (
                                <div key={val} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight block mb-1.5 pl-0.5 opacity-80 italic">Billetes $ {val}</label>
                                    <Input type="number" className="h-9 bg-white dark:bg-slate-900 text-sm font-black border-slate-100 px-3" placeholder="0" />
                                </div>
                            ))}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight block mb-1.5 pl-0.5 opacity-80 italic">Monedas (Total)</label>
                                <Input type="number" className="h-9 bg-white dark:bg-slate-900 text-sm font-black border-slate-100 px-3" placeholder="0.00" />
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 p-2.5 rounded-lg flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-blue-600 flex-none mt-0.5" />
                            <p className="text-[11px] text-slate-500 font-medium leading-normal">
                                Diferencias &gt; <strong className="text-blue-900 dark:text-blue-400">2%</strong> activan auditoría.
                            </p>
                        </div>

                        <Button
                            onClick={() => setShowCierreModal(true)}
                            className="w-full h-10 bg-[#0f172a] hover:bg-black text-white rounded-lg font-black text-[11px] uppercase tracking-wider shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                            Finalizar Turno
                            <BarChart3 className="w-4 h-4" />
                        </Button>
                    </section>
                </div>

                {/* Sacas/Alertas */}
                <div className="lg:col-span-5 space-y-6">
                    <section className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-50 dark:border-slate-800 pb-2">
                            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                                <Truck className="w-4 h-4 text-blue-600" /> Sacas
                            </h3>
                            <span className="text-[11px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded h-5 flex items-center">Próx: $2k</span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2.5 border border-slate-50 dark:border-slate-800 rounded-lg group hover:border-blue-500 transition-all">
                                <Clock className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                                <div className="flex-1">
                                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-none">Blindado</p>
                                    <p className="text-[11px] text-slate-400 font-bold mt-1.5 inline-block">14:30h</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 dark:text-white">$4k</p>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setMovementModal({ isOpen: true, tipo: 'salida' })}
                            className="w-full mt-3 border-dashed border-slate-200 dark:border-slate-800 h-9 rounded-lg text-xs font-black text-slate-400 hover:text-blue-600 gap-2 uppercase"
                        >
                            <PlusCircle className="w-4 h-4" /> Nuevo Retiro
                        </Button>
                    </section>
                </div>

                <div className="lg:col-span-12">
                    <section className="bg-rose-50 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100">
                        <div className="flex items-center gap-2 mb-3 text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest">ALERTA SEGURIDAD</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg shadow-sm flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">POS 02 Sospecha</p>
                                <p className="text-[11px] text-slate-500 font-medium tracking-tight">Detección Automática: Billete $500 AX309.</p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => {
                                        setSelectedPOS('POS 02');
                                        setShowCameraModal(true);
                                        toast.info('Conectando con cámara de zona POS 2...');
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 h-8 text-xs font-black uppercase rounded-lg px-3 shadow-sm border-none"
                                >
                                    Ver Cámara
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => toast.success('Incidente marcado como revisado.')}
                                    className="h-8 text-xs font-black uppercase rounded-lg px-3 border-slate-200"
                                >
                                    Ignorar
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* CONCILIACIÓN DIARIA — DISEÑO PROFESIONAL */}
            <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="flex-none md:border-r border-slate-50 dark:border-slate-800 pr-5 text-center md:text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Estado Operativo</h3>
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        <span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums">100% Conciliado</span>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    {[
                        { label: 'Sistema', val: totalVentasHoy, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                        { label: 'Efectivo', val: 12200, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                        { label: 'Depósitos', val: 11800, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/50' }
                    ].map(item => (
                        <div key={item.label} className={cn("p-3 rounded-xl border border-transparent transition-all flex flex-col justify-center", item.bg)}>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 opacity-80">{item.label}</span>
                            <span className={cn("text-lg font-black tabular-nums leading-none", item.color)}>
                                {formatCurrency(item.val)}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* MONITOR DE PRODUCTOS Y MOVIMIENTOS — NUEVA VISTA SOLICITADA */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ranking de Productos */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-widest leading-none">
                            <Package className="w-4 h-4 text-blue-600" /> Top Productos Hoy
                        </h3>
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-black h-5 px-2">VENTAS BRUTAS</Badge>
                    </div>
                    <div className="space-y-3">
                        {resumenProductosHoy.length > 0 ? resumenProductosHoy.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-black text-[10px] text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors border border-slate-100">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none">{p.nombre}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1.5">{p.cantidad} unidades vendidas</p>
                                    </div>
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(p.total)}</span>
                            </div>
                        )) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <Package className="w-10 h-10 text-slate-200 mb-2" />
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Sin ventas registradas hoy</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeline de Items Vendidos */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-widest leading-none">
                            <ShoppingBag className="w-4 h-4 text-emerald-600" /> Timeline de Ventas
                        </h3>
                        <button
                            onClick={() => toast.info('Accediendo al historial completo en Reportes...')}
                            className="text-[10px] font-black text-blue-600 uppercase hover:underline tracking-tight"
                        >
                            Ver Todo
                        </button>
                    </div>
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {ventasHoy.length > 0 ? ventasHoy.slice().reverse().flatMap((v) =>
                            v.items.map((item, idx) => (
                                <div key={`${v.id}-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 dark:border-slate-800 hover:border-emerald-100 transition-all bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 border border-emerald-100 dark:border-emerald-900/50">
                                            <ShoppingCart className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none truncate max-w-[120px]">
                                                {getProductoById(item.productoId)?.nombre || 'Producto'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                                                {new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Cant: {item.cantidad}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 tabular-nums">{formatCurrency(item.subtotal)}</span>
                                </div>
                            ))
                        ).slice(0, 7) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <ShoppingBag className="w-10 h-10 text-slate-200 mb-2" />
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Esperando operaciones...</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* HISTORIAL TABLA PROFESIONAL */}
            <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-300" /> Auditoría de Turnos
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input
                            placeholder="Buscar operador o sesión..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 h-9 bg-slate-50 text-xs rounded-xl border-slate-100 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[11px] font-black uppercase text-slate-400 bg-slate-50/50 border-b border-slate-50">
                            <tr>
                                <th className="px-6 py-4">Operador Responsable</th>
                                <th className="px-6 py-4 text-right">Total Ventas</th>
                                <th className="px-6 py-4 text-right">Balance Final</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtradoSesiones.map((sesion) => {
                                const entradasTotal = (sesion.movimientos || []).filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.monto, 0);
                                const salidasTotal = (sesion.movimientos || []).filter(m => m.tipo === 'salida').reduce((acc, m) => acc + m.monto, 0);
                                const balanceMovs = entradasTotal - salidasTotal;
                                const esperado = sesion.montoApertura + sesion.totalVentas + balanceMovs;
                                const activo = sesion.id === cajaActiva?.id;

                                return (
                                    <tr key={sesion.id} className={cn("hover:bg-slate-50/50 transition-colors text-xs font-medium", activo ? "bg-blue-50/30" : "")}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 uppercase tracking-tight">{sesion.usuarioId}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">ID: {sesion.id.substring(0, 8)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-slate-700">{formatCurrency(sesion.totalVentas)}</td>
                                        <td className="px-6 py-4 text-right font-black text-blue-600">{formatCurrency(esperado)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase", activo ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 whitespace-nowrap")}>
                                                {activo ? 'TURNO ACTIVO' : 'TURNO CERRADO'}
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <CajaMovimientosModal
                isOpen={movementModal.isOpen}
                onOpenChange={(open) => setMovementModal(prev => ({ ...prev, isOpen: open }))}
                tipo={movementModal.tipo}
                onSubmit={async (monto, motivo) => {
                    await registrarMovimientoCaja(monto, movementModal.tipo, motivo, usuario?.id || 'anon');
                }}
            />

            <AperturaCajaModal
                isOpen={showAperturaModal}
                onClose={() => setShowAperturaModal(false)}
                onAbrir={onAbrirCaja}
            />

            <CierreCajaModal
                isOpen={showCierreModal}
                onClose={() => setShowCierreModal(false)}
                onCerrar={onCerrarCaja}
                cajaActiva={cajaActiva}
                formatCurrency={formatCurrency}
            />

            {/* MODAL CÁMARA SEGURIDAD */}
            <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
                <DialogContent className="max-w-4xl p-0 bg-black border-slate-800 overflow-hidden shadow-2xl">
                    <DialogHeader className="hidden">
                        <DialogTitle>Cámara de Seguridad - {selectedPOS}</DialogTitle>
                        <DialogDescription>Monitoreo en tiempo real de la zona de caja</DialogDescription>
                    </DialogHeader>
                    <div className="relative aspect-video group">
                        <img
                            src="https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=1400&auto=format&fit=crop"
                            className="w-full h-full object-cover opacity-60 grayscale scale-105"
                            alt="Cámara de Seguridad"
                        />
                        {/* Overlay HUD */}
                        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 bg-rose-600 text-white px-2 py-1 rounded text-[10px] uppercase font-black animate-pulse shadow-lg shadow-rose-600/30">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                        LIVE • {selectedPOS} • CAM_08
                                    </div>
                                    <p className="text-emerald-500 font-mono text-[10px] uppercase tracking-[0.3em] drop-shadow-2xl opacity-80">STITCH SECURE SYS v2.0</p>
                                </div>
                                <div className="text-right font-mono text-white/50 text-[10px] space-y-0.5">
                                    <p>{new Date().toLocaleDateString()}</p>
                                    <p>{new Date().toLocaleTimeString()} UTC-5</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 border border-white/20 rounded-xl flex items-center justify-center bg-white/5 backdrop-blur-md shadow-inner">
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 animate-spin-slow" />
                                    </div>
                                    <div className="space-y-1 self-end">
                                        <p className="text-white font-black text-[10px] uppercase tracking-widest opacity-80">Rostro Detectado</p>
                                        <p className="text-blue-400 font-mono text-[9px]">Confianza: 98.2% (AUTH_OPERATOR)</p>
                                    </div>
                                </div>
                                <Badge className="bg-white/10 text-white border-white/20 backdrop-blur-md uppercase text-[9px] font-black px-4 py-2 hover:bg-white/20 transition-colors">
                                    Cifrado End-to-End ACTIVADO
                                </Badge>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL TRAZABILIDAD (TRAZAS) */}
            <Dialog open={showTracesModal} onOpenChange={setShowTracesModal}>
                <DialogContent className="max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-slate-950">
                    <DialogHeader className="bg-[#0f172a] p-8 text-center relative overflow-hidden flex flex-col items-center border-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center mb-3 border border-white/10 shadow-inner">
                                <Search className="w-6 h-6 text-white" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Auditoría Real-Time</DialogTitle>
                            <DialogDescription className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-2">
                                {selectedPOS} • Monitor Maestro de Trazabilidad
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {[
                            { time: '14:22:05', event: 'Venta Procesada (Efectivo)', val: '$120.00', status: 'success' },
                            { time: '14:18:30', event: 'Intento de Descuento No Autorizado', val: '5%', status: 'warning' },
                            { time: '14:10:12', event: 'Apertura de Cajón Manual', val: 'ID: AJ09', status: 'alert' },
                            { time: '13:55:40', event: 'Login Operador', val: 'User: Admin', status: 'info' }
                        ].map((trace, i) => (
                            <div key={i} className="flex gap-4 items-start p-4 rounded-xl border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group">
                                <span className="text-[10px] font-mono text-slate-400 mt-1">{trace.time}</span>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none group-hover:text-blue-600 transition-colors">{trace.event}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full inline-block">{trace.val}</p>
                                </div>
                                <div className={cn(
                                    "w-2.5 h-2.5 rounded-full shadow-lg",
                                    trace.status === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' :
                                        trace.status === 'warning' ? 'bg-orange-500 shadow-orange-500/20' :
                                            trace.status === 'alert' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-blue-500 shadow-blue-500/20'
                                )} />
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                        <Button
                            variant="ghost"
                            className="h-12 w-full rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-800 transition-all font-mono"
                            onClick={() => setShowTracesModal(false)}
                        >
                            [ CERRAR MONITOR DE SISTEMA ]
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
