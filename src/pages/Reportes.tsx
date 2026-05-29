import { useMemo, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area,
    Legend,
    ReferenceLine
} from 'recharts';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart as PieChartIcon,
    Layers,
    Activity,
    Package,
    Zap,
    Target,
    ShoppingBag,
    Percent,
    Brain,
    CalendarCheck,
    Plus,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    User,
    Shield,
    Flame,
    LifeBuoy,
    BadgeAlert,
    Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Venta, Gasto, ReporteFinanciero, Producto, Categoria, CompromisoFijo, GastoCategoria } from '@/types';
import { cn } from '@/lib/utils';
import { HistorialVentasCategoria } from '@/components/ventas/HistorialVentasCategoria';
import { exportCSV, getExportFilename } from '@/lib/exportUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    getCompromisos, saveCompromisos, addCompromiso, deleteCompromiso, updateCompromiso,
    getVentasDiarias, addVentaDiaria, deleteVentaDiaria,
    calcularProyeccionQuincena, generarConsejo
} from '@/lib/finanzas-personales';
import { getConfigSeguridad } from '@/lib/security-agent';
import type { VentaDiaria } from '@/types';

interface ReportesProps {
    ventas: Venta[];
    gastos: Gasto[];
    formatCurrency: (value: number) => string;
    generarReporte: (periodo: string) => ReporteFinanciero;
    productos?: Producto[];
    categorias?: Categoria[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];

export default function Reportes({
    ventas,
    gastos,
    formatCurrency,
    generarReporte,
    productos = [],
    categorias = []
}: ReportesProps) {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const reporteActual = useMemo(() => generarReporte(currentMonth), [ventas, gastos, currentMonth, generarReporte]);

    // Datos comparativos últimos 6 meses
    const comparativoData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const periodo = date.toISOString().slice(0, 7);
            const r = generarReporte(periodo);
            data.push({
                name: date.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
                ventas: r.totalVentas,
                gastos: r.totalGastos,
                utilidad: r.utilidadBruta
            });
        }
        return data;
    }, [ventas, gastos, generarReporte]);

    // Proyección del mes actual basada en días transcurridos
    const proyeccion = useMemo(() => {
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        if (diaActual === 0) return null;
        const ventasMesActual = reporteActual.totalVentas;
        const tasaDiaria = ventasMesActual / diaActual;
        return Math.round(tasaDiaria * diasDelMes);
    }, [reporteActual]);

    // Análisis de rentabilidad por producto
    const rentabilidadProductos = useMemo(() => {
        const mapaVentas: Record<string, { ingresos: number; unidades: number; nombre: string }> = {};
        ventas.forEach(v => {
            v.items?.forEach(item => {
                if (!mapaVentas[item.productoId]) {
                    const prod = productos.find(p => p.id === item.productoId);
                    mapaVentas[item.productoId] = { ingresos: 0, unidades: 0, nombre: prod?.nombre || item.productoId };
                }
                mapaVentas[item.productoId].ingresos += item.subtotal;
                mapaVentas[item.productoId].unidades += item.cantidad;
            });
        });
        return Object.values(mapaVentas)
            .sort((a, b) => b.ingresos - a.ingresos)
            .slice(0, 10);
    }, [ventas, productos]);

    const totalVentasProductos = rentabilidadProductos.reduce((s, p) => s + p.ingresos, 0);

    // Gastos por categoría (pie)
    const gastosData = useMemo(() => {
        return Object.entries(reporteActual.gastosPorCategoria)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
    }, [reporteActual]);

    // Ventas por método de pago (pie)
    const ventasMetodoData = useMemo(() => {
        return Object.entries(reporteActual.ventasPorMetodoPago)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name: name.toUpperCase(), value }));
    }, [reporteActual]);

    // Reporte mes anterior
    const prevPeriodo = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 7);
    }, []);

    const reporteMesAnterior = useMemo(() => generarReporte(prevPeriodo), [ventas, gastos, prevPeriodo, generarReporte]);

    const calcTrend = (actual: number, anterior: number): string => {
        if (anterior === 0) return actual > 0 ? 'Nuevo' : '—';
        const pct = ((actual - anterior) / anterior) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    };

    const margenActual = reporteActual.totalVentas > 0 ? (reporteActual.utilidadBruta / reporteActual.totalVentas) * 100 : 0;
    const margenAnterior = reporteMesAnterior.totalVentas > 0 ? (reporteMesAnterior.utilidadBruta / reporteMesAnterior.totalVentas) * 100 : 0;

    // Ticket promedio
    const ventasMes = ventas.filter(v => v.fecha.startsWith(currentMonth));
    const ticketPromedio = ventasMes.length > 0 ? reporteActual.totalVentas / ventasMes.length : 0;
    const ventasMesAnt = ventas.filter(v => v.fecha.startsWith(prevPeriodo));
    const ticketAnterior = ventasMesAnt.length > 0 ? reporteMesAnterior.totalVentas / ventasMesAnt.length : 0;

    // Ratio gasto/venta
    const ratioGasto = reporteActual.totalVentas > 0
        ? (reporteActual.totalGastos / reporteActual.totalVentas) * 100
        : 0;
    const ratioGastoAnt = reporteMesAnterior.totalVentas > 0
        ? (reporteMesAnterior.totalGastos / reporteMesAnterior.totalVentas) * 100
        : 0;

    // ── Estado: Compromisos y Ventas Diarias ──────────────────────
    const [compromisos, setCompromisos] = useState<CompromisoFijo[]>(() => getCompromisos());
    const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>(() => getVentasDiarias());
    const [pinModal, setPinModal] = useState<{ ventaId: string; pin: string; error: string } | null>(null);
    const [activeTab, setActiveTab] = useState('resumen');

    // ── Métricas de compromisos ──────────────────────────────────
    const totalCompromisosActivos = useMemo(
        () => compromisos.filter(c => c.activo).reduce((s, c) => s + c.monto, 0),
        [compromisos]
    );
    const ratioCompromisosVsVentas = reporteActual.totalVentas > 0
        ? (totalCompromisosActivos / reporteActual.totalVentas) * 100 : 0;
    const saludFinanciera = (() => {
        if (reporteActual.totalVentas === 0) return { label: 'Sin datos', color: 'text-slate-400', bg: 'bg-slate-400/10', barra: 'bg-slate-400', pct: 0 };
        const margen = (reporteActual.utilidadBruta / reporteActual.totalVentas) * 100;
        const cobertura = totalCompromisosActivos > 0 ? (reporteActual.totalVentas / totalCompromisosActivos) : 99;
        const score = Math.min(100, (margen * 0.5) + (Math.min(cobertura, 3) / 3 * 50));
        if (score >= 60) return { label: 'Saludable', color: 'text-emerald-500', bg: 'bg-emerald-500/10', barra: 'bg-emerald-500', pct: score };
        if (score >= 35) return { label: 'Moderado', color: 'text-amber-500', bg: 'bg-amber-500/10', barra: 'bg-amber-500', pct: score };
        return { label: 'Crítico', color: 'text-rose-500', bg: 'bg-rose-500/10', barra: 'bg-rose-500', pct: score };
    })();

    const [formCompromiso, setFormCompromiso] = useState({
        nombre: '', monto: '', categoria: 'Otros' as GastoCategoria,
        diaDeCobro: '', esPropietario: false, persona: ''
    });
    const [formVenta, setFormVenta] = useState({
        fecha: new Date().toISOString().slice(0, 10),
        totalEfectivo: '', totalNequi: '', totalTransferencia: '', totalCredito: '', notas: ''
    });

    const proyeccionQuincena = useMemo(() => calcularProyeccionQuincena({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria })),
        compromisos,
    }), [ventas, ventasDiarias, gastos, compromisos]);

    const consejo = useMemo(() => generarConsejo({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria, descripcion: g.descripcion })),
        compromisos,
    }), [ventas, ventasDiarias, gastos, compromisos]);

    // ── DATOS REALES DE LA QUINCENA ACTUAL ──────────────────────
    const quincenaReal = useMemo(() => {
        const hoy = new Date();
        const dia = hoy.getDate();
        const inicio = dia <= 15
            ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
            : new Date(hoy.getFullYear(), hoy.getMonth(), 16);
        const fin = dia <= 15
            ? new Date(hoy.getFullYear(), hoy.getMonth(), 15)
            : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        const inicioStr = inicio.toISOString().slice(0, 10);
        const finStr = fin.toISOString().slice(0, 10);
        const hoyStr = hoy.toISOString().slice(0, 10);

        const ventasPOS = ventas
            .filter(v => v.fecha.slice(0, 10) >= inicioStr && v.fecha.slice(0, 10) <= finStr)
            .reduce((s, v) => s + v.total, 0);

        const ventasManuales = ventasDiarias
            .filter(v => v.fecha >= inicioStr && v.fecha <= finStr)
            .reduce((s, v) => s + v.total, 0);

        const ventasTotalDia = ventasDiarias
            .filter(v => v.fecha === hoyStr)
            .reduce((s, v) => s + v.total, 0);

        const totalVentasManualesHistorico = ventasDiarias.reduce((s, v) => s + v.total, 0);

        return {
            inicioStr, finStr, hoyStr,
            ventasPOS,
            ventasManuales,
            ventasTotal: ventasPOS + ventasManuales,
            ventasTotalDia,
            totalVentasManualesHistorico,
            label: dia <= 15 ? '1ª quincena' : '2ª quincena',
        };
    }, [ventas, ventasDiarias]);

    // ── TABLERO DE OBLIGACIONES TOTALES ──────────────────────────
    const promedioGastosMensuales = useMemo(() => {
        const meses: Record<string, Record<string, number>> = {};
        gastos.forEach(g => {
            const mes = g.fecha.slice(0, 7);
            if (!meses[mes]) meses[mes] = {};
            meses[mes][g.categoria] = (meses[mes][g.categoria] || 0) + g.monto;
        });
        const numMeses = Math.max(1, Object.keys(meses).length);
        const totalesPorCat: Record<string, number> = {};
        Object.values(meses).forEach(mes => {
            Object.entries(mes).forEach(([cat, monto]) => {
                totalesPorCat[cat] = (totalesPorCat[cat] || 0) + monto;
            });
        });
        return Object.fromEntries(
            Object.entries(totalesPorCat).map(([cat, total]) => [cat, total / numMeses])
        );
    }, [gastos]);

    const promedioInsumos = useMemo(() =>
        Object.entries(promedioGastosMensuales)
            .filter(([cat]) => ['Materia Prima', 'Insumos'].includes(cat))
            .reduce((s, [, v]) => s + v, 0),
        [promedioGastosMensuales]
    );

    const promedioOtrosGastos = useMemo(() =>
        Object.entries(promedioGastosMensuales)
            .filter(([cat]) => !['Materia Prima', 'Insumos'].includes(cat))
            .reduce((s, [, v]) => s + v, 0),
        [promedioGastosMensuales]
    );

    const totalObligaciones = totalCompromisosActivos + promedioInsumos + promedioOtrosGastos;

    const coberturaActual = totalObligaciones > 0
        ? (reporteActual.totalVentas / totalObligaciones) * 100 : 100;

    const ventasNecesariasDiarias = (() => {
        const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        return totalObligaciones > 0 ? totalObligaciones / diasMes : 0;
    })();

    const obligacionesBreakdown = useMemo(() => {
        const items: { name: string; value: number; color: string }[] = [];
        if (totalCompromisosActivos > 0)
            items.push({ name: 'Compromisos fijos', value: totalCompromisosActivos, color: '#8b5cf6' });
        if (promedioInsumos > 0)
            items.push({ name: 'Insumos / MP', value: promedioInsumos, color: '#f59e0b' });
        if (promedioOtrosGastos > 0)
            items.push({ name: 'Otros gastos', value: promedioOtrosGastos, color: '#f43f5e' });
        return items;
    }, [totalCompromisosActivos, promedioInsumos, promedioOtrosGastos]);

    const alertasAutomaticas = useMemo(() => {
        const alerts: { nivel: 'critico' | 'advertencia' | 'ok'; icon: string; titulo: string; msg: string; accion: string }[] = [];
        if (totalObligaciones > 0 && coberturaActual < 80)
            alerts.push({ nivel: 'critico', icon: '🔴', titulo: 'Cobertura insuficiente', msg: `Tus ventas cubren solo el ${coberturaActual.toFixed(0)}% de tus obligaciones totales.`, accion: 'Necesitas vender más o reducir gastos urgentemente.' });
        else if (coberturaActual < 120)
            alerts.push({ nivel: 'advertencia', icon: '🟡', titulo: 'Margen de seguridad bajo', msg: `Cubres el ${coberturaActual.toFixed(0)}% — quedas ajustado sin colchón.`, accion: 'Intenta aumentar ventas un 20% o recortar un gasto fijo.' });
        else
            alerts.push({ nivel: 'ok', icon: '🟢', titulo: 'Cobertura saludable', msg: `Tus ventas cubren el ${coberturaActual.toFixed(0)}% de todas tus obligaciones.`, accion: 'Sigue así. Considera guardar el excedente.' });

        if (margenActual < 15 && reporteActual.totalVentas > 0)
            alerts.push({ nivel: 'critico', icon: '🔴', titulo: 'Margen peligrosamente bajo', msg: `Margen actual: ${margenActual.toFixed(1)}%. Menos del 15% pone en riesgo el negocio.`, accion: 'Revisa precios de venta o negocia insumos más baratos.' });
        else if (margenActual < 25 && reporteActual.totalVentas > 0)
            alerts.push({ nivel: 'advertencia', icon: '🟡', titulo: 'Margen por debajo del ideal', msg: `Margen: ${margenActual.toFixed(1)}%. El ideal para panadería es 25-40%.`, accion: 'Considera subir precios entre 5-10% para mejorar la rentabilidad.' });

        if (promedioInsumos > 0 && reporteActual.totalVentas > 0) {
            const pctInsumos = (promedioInsumos / reporteActual.totalVentas) * 100;
            if (pctInsumos > 50)
                alerts.push({ nivel: 'critico', icon: '🔴', titulo: 'Insumos consumen más del 50% de ventas', msg: `Gastas ${pctInsumos.toFixed(0)}% de tus ingresos en materia prima.`, accion: 'Busca proveedores alternativos o ajusta los precios de venta.' });
            else if (pctInsumos > 35)
                alerts.push({ nivel: 'advertencia', icon: '🟡', titulo: 'Costo de insumos elevado', msg: `Los insumos representan ${pctInsumos.toFixed(0)}% de tus ventas.`, accion: 'Revisa qué productos tienen menor margen y considera ajustar precios.' });
        }

        if (ratioCompromisosVsVentas > 60)
            alerts.push({ nivel: 'critico', icon: '🔴', titulo: 'Compromisos fijos muy altos', msg: `Tus compromisos fijos son el ${ratioCompromisosVsVentas.toFixed(0)}% de las ventas.`, accion: 'Evalúa renegociar arriendos o eliminar compromisos no esenciales.' });

        return alerts;
    }, [coberturaActual, margenActual, promedioInsumos, ratioCompromisosVsVentas, reporteActual.totalVentas, totalObligaciones]);

    const handleAddCompromiso = () => {
        const monto = parseFloat(formCompromiso.monto);
        const dia = parseInt(formCompromiso.diaDeCobro);
        if (!formCompromiso.nombre || isNaN(monto) || monto <= 0) {
            toast.error('Nombre y monto son obligatorios'); return;
        }
        const nuevo = addCompromiso({
            nombre: formCompromiso.nombre, monto,
            categoria: formCompromiso.categoria,
            diaDeCobro: isNaN(dia) ? 1 : Math.min(31, Math.max(1, dia)),
            activo: true,
            esPropietario: formCompromiso.esPropietario,
            persona: formCompromiso.persona || undefined,
        });
        setCompromisos(prev => [...prev, nuevo]);
        setFormCompromiso({ nombre: '', monto: '', categoria: 'Otros', diaDeCobro: '', esPropietario: false, persona: '' });
        toast.success('Compromiso guardado');
    };

    const handleToggleCompromiso = (id: string) => {
        updateCompromiso(id, { activo: !compromisos.find(c => c.id === id)?.activo });
        setCompromisos(getCompromisos());
    };

    const handleDeleteCompromiso = (id: string) => {
        deleteCompromiso(id);
        setCompromisos(getCompromisos());
    };

    const handleAddVentaDiaria = () => {
        const ef = parseFloat(formVenta.totalEfectivo) || 0;
        const nq = parseFloat(formVenta.totalNequi) || 0;
        const tr = parseFloat(formVenta.totalTransferencia) || 0;
        const cr = parseFloat(formVenta.totalCredito) || 0;
        if (ef + nq + tr + cr <= 0) { toast.error('Ingresa al menos un monto'); return; }
        const nueva = addVentaDiaria({
            fecha: formVenta.fecha, totalEfectivo: ef, totalNequi: nq,
            totalTransferencia: tr, totalCredito: cr, notas: formVenta.notas || undefined
        });
        setVentasDiarias(getVentasDiarias());
        setFormVenta({ fecha: new Date().toISOString().slice(0, 10), totalEfectivo: '', totalNequi: '', totalTransferencia: '', totalCredito: '', notas: '' });
        toast.success(`Venta del día registrada: ${formatCurrency(nueva.total)}`);
    };

    const handleDeleteVentaDiaria = (id: string) => {
        setPinModal({ ventaId: id, pin: '', error: '' });
    };

    const confirmarDeleteConPin = () => {
        if (!pinModal) return;
        const cfg = getConfigSeguridad();
        if (pinModal.pin !== cfg.pinGerente) {
            setPinModal(prev => prev ? { ...prev, error: 'PIN incorrecto' } : null);
            return;
        }
        deleteVentaDiaria(pinModal.ventaId);
        setVentasDiarias(getVentasDiarias());
        setPinModal(null);
        toast.success('Venta eliminada');
    };

    const cardsData = [
        {
            title: 'Ventas del Mes',
            value: reporteActual.totalVentas,
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            trend: calcTrend(reporteActual.totalVentas, reporteMesAnterior.totalVentas),
            sub: `${ventasMes.length} transacciones`
        },
        {
            title: 'Gastos del Mes',
            value: reporteActual.totalGastos,
            icon: TrendingDown,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            trend: calcTrend(reporteActual.totalGastos, reporteMesAnterior.totalGastos),
            sub: `${gastosData.length} categorías`
        },
        {
            title: 'Utilidad Bruta',
            value: reporteActual.utilidadBruta,
            icon: DollarSign,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            trend: calcTrend(reporteActual.utilidadBruta, reporteMesAnterior.utilidadBruta),
            sub: `Margen ${margenActual.toFixed(1)}%`
        },
        {
            title: 'Margen Neto',
            value: `${margenActual.toFixed(1)}%`,
            icon: Percent,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            trend: margenAnterior === 0 ? '—' : `${margenActual >= margenAnterior ? '+' : ''}${(margenActual - margenAnterior).toFixed(1)}pp`,
            sub: margenActual >= 30 ? 'Saludable ✓' : margenActual >= 15 ? 'Aceptable' : 'Revisar ⚠'
        },
        {
            title: 'Ticket Promedio',
            value: ticketPromedio,
            icon: ShoppingBag,
            color: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
            trend: calcTrend(ticketPromedio, ticketAnterior),
            sub: `${ventasMes.length} ventas este mes`
        },
        {
            title: 'Ratio Gasto/Venta',
            value: `${ratioGasto.toFixed(1)}%`,
            icon: Target,
            color: ratioGasto > 70 ? 'text-rose-500' : ratioGasto > 50 ? 'text-amber-500' : 'text-emerald-500',
            bg: ratioGasto > 70 ? 'bg-rose-500/10' : ratioGasto > 50 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
            trend: ratioGastoAnt === 0 ? '—' : `${ratioGasto <= ratioGastoAnt ? '' : '+'}${(ratioGasto - ratioGastoAnt).toFixed(1)}pp`,
            sub: ratioGasto > 70 ? 'Alto — revisar' : ratioGasto > 50 ? 'Moderado' : 'Eficiente ✓',
            onClick: undefined,
        },
        {
            title: 'Compromisos Fijos',
            value: totalCompromisosActivos,
            icon: CalendarCheck,
            color: ratioCompromisosVsVentas > 80 ? 'text-rose-500' : ratioCompromisosVsVentas > 50 ? 'text-amber-500' : 'text-violet-500',
            bg: ratioCompromisosVsVentas > 80 ? 'bg-rose-500/10' : ratioCompromisosVsVentas > 50 ? 'bg-amber-500/10' : 'bg-violet-500/10',
            trend: `${ratioCompromisosVsVentas.toFixed(0)}% de ventas`,
            sub: `${compromisos.filter(c => c.activo).length} activos — clic para ver`,
            onClick: () => setActiveTab('quincena'),
        },
    ];

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Análisis Financiero</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })} · Tiempo real
                            {proyeccion && proyeccion > 0 && (
                                <span className="ml-2 text-indigo-400">· Proyección mes: {formatCurrency(proyeccion)}</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-muted-foreground font-black uppercase text-[10px] cursor-pointer hover:bg-white/10 transition-all"
                        onClick={() => exportCSV(
                            ventas.map(v => ({
                                fecha: new Date(v.fecha).toLocaleDateString('es-CO'),
                                total: v.total,
                                metodo: v.metodoPago,
                                items: v.items?.length ?? 0,
                            })),
                            getExportFilename('reporte-ventas'),
                            { fecha: 'Fecha', total: 'Total', metodo: 'Método Pago', items: 'Productos' }
                        )}
                    >
                        CSV Ventas
                    </Badge>
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-indigo-600 border-none text-white font-black uppercase text-[10px] shadow-lg shadow-indigo-600/20 cursor-pointer hover:bg-indigo-700 transition-all"
                        onClick={() => exportCSV(
                            gastos.map(g => ({
                                fecha: new Date(g.fecha).toLocaleDateString('es-CO'),
                                descripcion: g.descripcion,
                                categoria: g.categoria,
                                monto: g.monto,
                                metodo: g.metodoPago,
                            })),
                            getExportFilename('reporte-gastos'),
                            { fecha: 'Fecha', descripcion: 'Descripción', categoria: 'Categoría', monto: 'Monto', metodo: 'Método' }
                        )}
                    >
                        CSV Gastos
                    </Badge>
                    <Badge
                        variant="outline"
                        className="h-10 px-4 rounded-xl bg-emerald-600 border-none text-white font-black uppercase text-[10px] shadow-lg shadow-emerald-600/20 cursor-pointer hover:bg-emerald-700 transition-all"
                        onClick={() => exportCSV(
                            rentabilidadProductos.map((p, i) => ({
                                ranking: i + 1,
                                producto: p.nombre,
                                ingresos: p.ingresos,
                                unidades: p.unidades,
                                participacion: totalVentasProductos > 0 ? ((p.ingresos / totalVentasProductos) * 100).toFixed(1) + '%' : '0%'
                            })),
                            getExportFilename('rentabilidad-productos'),
                            { ranking: '#', producto: 'Producto', ingresos: 'Ingresos', unidades: 'Unidades', participacion: 'Participación' }
                        )}
                    >
                        CSV Rentabilidad
                    </Badge>
                </div>
            </header>

            {/* ── PULSO FINANCIERO ── Banner siempre visible */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Ventas mes', val: reporteActual.totalVentas, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
                    { label: 'Gastos mes', val: reporteActual.totalGastos, color: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
                    { label: 'Utilidad bruta', val: reporteActual.utilidadBruta, color: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
                    { label: 'Total compromisos', val: totalCompromisosActivos, color: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', cta: true },
                ].map(item => (
                    <div
                        key={item.label}
                        onClick={item.cta ? () => setActiveTab('quincena') : undefined}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1",
                            item.border,
                            item.cta && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                        )}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                        <span className={cn("text-xl font-black tabular-nums", item.color)}>
                            {formatCurrency(item.val)}
                        </span>
                        {item.cta && (
                            <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">
                                {compromisos.filter(c => c.activo).length} activos · Ver →
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* ── SALUD FINANCIERA ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-5 py-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Salud financiera del mes</span>
                    </div>
                    <span className={cn("text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full", saludFinanciera.bg, saludFinanciera.color)}>
                        {saludFinanciera.label} · {saludFinanciera.pct.toFixed(0)}/100
                    </span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-1000", saludFinanciera.barra)}
                        style={{ width: `${saludFinanciera.pct}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-slate-400 font-bold">Crítico</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                        Compromisos: {formatCurrency(totalCompromisosActivos)} · Margen: {margenActual.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">Saludable</span>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-14 p-1 mb-6 flex items-center justify-start flex-wrap gap-1">
                    <TabsTrigger value="resumen" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Activity className="w-4 h-4 mr-2" />
                        Resumen
                    </TabsTrigger>
                    <TabsTrigger value="rentabilidad" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Package className="w-4 h-4 mr-2" />
                        Rentabilidad
                    </TabsTrigger>
                    <TabsTrigger value="historico-categorias" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Layers className="w-4 h-4 mr-2" />
                        Por Categoría
                    </TabsTrigger>
                    <TabsTrigger value="quincena" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
                        <CalendarCheck className="w-4 h-4" />
                        Mi Quincena
                        {totalCompromisosActivos > 0 && (
                            <span className="text-[9px] font-black bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full">
                                {compromisos.filter(c => c.activo).length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="consejero-ia" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                        <Brain className="w-4 h-4 mr-2" />
                        Consejero IA
                    </TabsTrigger>
                    <TabsTrigger value="tablero-total" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white gap-2">
                        <Shield className="w-4 h-4" />
                        Tablero Total
                        {alertasAutomaticas.filter(a => a.nivel === 'critico').length > 0 && (
                            <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                                {alertasAutomaticas.filter(a => a.nivel === 'critico').length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════════════
                    TAB 1: RESUMEN GENERAL
                ══════════════════════════════════════════════════ */}
                <TabsContent value="resumen" className="space-y-6 mt-0">
                    {/* KPI Grid — 7 tarjetas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                        {cardsData.map((card, i) => (
                            <Card
                                key={i}
                                onClick={(card as any).onClick}
                                className={cn(
                                    "rounded-2xl border-white/5 bg-card/30 backdrop-blur-md overflow-hidden group transition-all duration-300",
                                    (card as any).onClick
                                        ? "cursor-pointer hover:scale-[1.04] hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-700"
                                        : "hover:scale-[1.02]"
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={cn("p-2 rounded-xl transition-transform group-hover:rotate-12 duration-500", card.bg, card.color)}>
                                            <card.icon className="w-4 h-4" />
                                        </div>
                                        <Badge variant="outline" className={cn("text-[8px] font-black border-none px-1.5", card.color, card.bg)}>
                                            {card.trend}
                                        </Badge>
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.title}</p>
                                    <h3 className="text-lg font-black tracking-tighter text-foreground group-hover:text-indigo-400 transition-colors">
                                        {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                                    </h3>
                                    <p className="text-[8px] text-muted-foreground mt-0.5 truncate">{card.sub}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Gráfico de Evolución + Piecharts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-6 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Evolución de Flujo</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                            Ventas vs Gastos (6 meses)
                                            {proyeccion && proyeccion > 0 && <span className="ml-2 text-indigo-400">· Proyección: {formatCurrency(proyeccion)}</span>}
                                        </CardDescription>
                                    </div>
                                    <BarChart3 className="w-6 h-6 text-indigo-500/50" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={comparativoData}>
                                        <defs>
                                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            labelStyle={{ color: '#6366f1', marginBottom: '8px', fontWeight: 900 }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '10px' }}
                                            formatter={(value) => value === 'ventas' ? 'Ventas' : value === 'gastos' ? 'Gastos' : 'Utilidad'}
                                        />
                                        {proyeccion && proyeccion > 0 && (
                                            <ReferenceLine y={proyeccion} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.4}
                                                label={{ value: 'Proy.', fill: '#6366f1', fontSize: 9, fontWeight: 900 }} />
                                        )}
                                        <Area type="monotone" dataKey="ventas" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                                        <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorGastos)" />
                                        <Area type="monotone" dataKey="utilidad" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" fillOpacity={1} fill="url(#colorUtilidad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                                <CardHeader className="p-5">
                                    <CardTitle className="text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                                        <PieChartIcon className="w-4 h-4 text-rose-400" /> Gastos por Categoría
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 pt-0 h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={gastosData} innerRadius={55} outerRadius={75} paddingAngle={6} dataKey="value">
                                                {gastosData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                formatter={(value: number) => formatCurrency(value)}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {gastosData.map((d, i) => (
                                            <div key={i} className="flex items-center gap-1.5 overflow-hidden">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                <span className="text-[8px] font-black uppercase text-muted-foreground truncate">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                                <CardHeader className="p-5">
                                    <CardTitle className="text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400" /> Ventas por Método
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 pt-0 h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={ventasMetodoData} innerRadius={50} outerRadius={70} paddingAngle={6} dataKey="value">
                                                {ventasMetodoData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                formatter={(value: number) => formatCurrency(value)}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {ventasMetodoData.map((d, i) => (
                                            <div key={i} className="flex items-center gap-1.5 overflow-hidden">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                                                <span className="text-[8px] font-black uppercase text-muted-foreground truncate">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 2: RENTABILIDAD POR PRODUCTO
                ══════════════════════════════════════════════════ */}
                <TabsContent value="rentabilidad" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Gráfico de barras horizontal */}
                        <Card className="lg:col-span-2 rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-6 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Top Productos por Ingresos</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                            Acumulado total · {rentabilidadProductos.length} productos analizados
                                        </CardDescription>
                                    </div>
                                    <Package className="w-6 h-6 text-indigo-500/50" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-6" style={{ height: Math.max(300, rentabilidadProductos.length * 44 + 40) }}>
                                {rentabilidadProductos.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={rentabilidadProductos} layout="vertical" margin={{ left: 8, right: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : (v/1000).toFixed(0)+'k'}`} />
                                            <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} width={110} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                                                formatter={(value: number, name: string) => [
                                                    name === 'ingresos' ? formatCurrency(value) : value,
                                                    name === 'ingresos' ? 'Ingresos' : 'Unidades'
                                                ]}
                                            />
                                            <Bar dataKey="ingresos" radius={[0, 8, 8, 0]} maxBarSize={32}>
                                                {rentabilidadProductos.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm font-bold text-muted-foreground">Sin datos de ventas aún</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tabla de ranking con participación */}
                        <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                            <CardHeader className="p-5 border-b border-white/5">
                                <CardTitle className="text-xs font-black uppercase tracking-tighter">Participación en Ingresos</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 overflow-y-auto max-h-[500px]">
                                <div className="space-y-3">
                                    {rentabilidadProductos.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-8">Sin ventas registradas</p>
                                    ) : rentabilidadProductos.map((p, i) => {
                                        const participacion = totalVentasProductos > 0 ? (p.ingresos / totalVentasProductos) * 100 : 0;
                                        return (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-[9px] font-black text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                                                        <span className="text-xs font-bold text-foreground truncate">{p.nombre}</span>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <p className="text-xs font-black text-foreground">{formatCurrency(p.ingresos)}</p>
                                                        <p className="text-[9px] text-muted-foreground">{p.unidades} uds</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${participacion}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                                    />
                                                </div>
                                                <p className="text-[8px] font-black text-muted-foreground text-right">{participacion.toFixed(1)}% del total</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Métricas clave de rentabilidad */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            {
                                label: 'Productos vendidos',
                                value: rentabilidadProductos.length,
                                icon: Package,
                                color: 'text-indigo-500',
                                bg: 'bg-indigo-500/10'
                            },
                            {
                                label: 'Unidades totales',
                                value: rentabilidadProductos.reduce((s, p) => s + p.unidades, 0),
                                icon: Layers,
                                color: 'text-emerald-500',
                                bg: 'bg-emerald-500/10'
                            },
                            {
                                label: 'Ingreso top producto',
                                value: rentabilidadProductos[0] ? formatCurrency(rentabilidadProductos[0].ingresos) : '—',
                                icon: TrendingUp,
                                color: 'text-amber-500',
                                bg: 'bg-amber-500/10',
                                sub: rentabilidadProductos[0]?.nombre
                            },
                            {
                                label: 'Concentración top 3',
                                value: totalVentasProductos > 0
                                    ? `${((rentabilidadProductos.slice(0, 3).reduce((s, p) => s + p.ingresos, 0) / totalVentasProductos) * 100).toFixed(0)}%`
                                    : '—',
                                icon: Target,
                                color: 'text-cyan-500',
                                bg: 'bg-cyan-500/10',
                                sub: 'Del ingreso total'
                            },
                        ].map((m, i) => (
                            <Card key={i} className="rounded-3xl border-white/5 bg-card/30 backdrop-blur-md overflow-hidden">
                                <CardContent className="p-5">
                                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", m.bg, m.color)}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{m.label}</p>
                                    <h3 className="text-xl font-black tracking-tighter text-foreground">
                                        {typeof m.value === 'number' ? m.value.toLocaleString('es-CO') : m.value}
                                    </h3>
                                    {m.sub && <p className="text-[9px] text-muted-foreground mt-1 truncate">{m.sub}</p>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 3: VENTAS POR CATEGORÍA
                ══════════════════════════════════════════════════ */}
                <TabsContent value="historico-categorias" className="mt-0">
                    <HistorialVentasCategoria
                        ventas={ventas}
                        productos={productos || []}
                        categorias={categorias || []}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 4: MI QUINCENA
                ══════════════════════════════════════════════════ */}
                <TabsContent value="quincena" className="space-y-6 mt-0">

                    {/* ── RESUMEN REAL — 4 cajas prominentes ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: `Ventas POS ${quincenaReal.label}`,
                                val: quincenaReal.ventasPOS,
                                color: 'text-emerald-500',
                                border: 'border-emerald-200 dark:border-emerald-800',
                                sub: `${ventas.filter(v => v.fecha.slice(0, 10) >= quincenaReal.inicioStr && v.fecha.slice(0, 10) <= quincenaReal.finStr).length} transacciones`,
                            },
                            {
                                label: 'Ventas manuales',
                                val: quincenaReal.ventasManuales,
                                color: 'text-indigo-500',
                                border: 'border-indigo-200 dark:border-indigo-800',
                                sub: `${ventasDiarias.filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr).length} cierres de caja`,
                            },
                            {
                                label: 'Total ingresos reales',
                                val: quincenaReal.ventasTotal,
                                color: 'text-cyan-500',
                                border: 'border-cyan-200 dark:border-cyan-800',
                                sub: 'POS + cierre manual',
                                highlight: true,
                            },
                            {
                                label: 'Total compromisos activos',
                                val: totalCompromisosActivos,
                                color: totalCompromisosActivos > quincenaReal.ventasTotal ? 'text-rose-500' : 'text-violet-500',
                                border: totalCompromisosActivos > quincenaReal.ventasTotal ? 'border-rose-200 dark:border-rose-800' : 'border-violet-200 dark:border-violet-800',
                                sub: `${compromisos.filter(c => c.activo).length} compromisos activos`,
                            },
                        ].map(item => (
                            <div key={item.label} className={cn(
                                "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1",
                                item.border,
                                item.highlight && "ring-2 ring-cyan-400/30"
                            )}>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                                <span className={cn("text-xl font-black tabular-nums", item.color)}>
                                    {formatCurrency(item.val)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">{item.sub}</span>
                            </div>
                        ))}
                    </div>

                    {/* Saldo neto real */}
                    {(() => {
                        const saldo = quincenaReal.ventasTotal - totalCompromisosActivos;
                        return (
                            <div className={cn(
                                "rounded-2xl border-2 px-5 py-3 flex items-center justify-between gap-4 flex-wrap",
                                saldo >= 0 ? "border-emerald-400/40 bg-emerald-500/5" : "border-rose-400/40 bg-rose-500/5"
                            )}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo real de la quincena hasta hoy</p>
                                    <p className={cn("text-2xl font-black", saldo >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {saldo >= 0 ? `+${formatCurrency(saldo)}` : formatCurrency(saldo)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Ingresos reales {formatCurrency(quincenaReal.ventasTotal)} — Compromisos {formatCurrency(totalCompromisosActivos)}
                                    </p>
                                </div>
                                {quincenaReal.ventasTotalDia > 0 && (
                                    <div className="text-right bg-card/60 rounded-xl px-4 py-2 border border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ventas registradas hoy</p>
                                        <p className="text-xl font-black text-amber-400">{formatCurrency(quincenaReal.ventasTotalDia)}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Banner proyección */}
                    <Card className={cn(
                        "rounded-3xl border-2",
                        proyeccionQuincena.alcanza
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-rose-500/40 bg-rose-500/5"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl",
                                    proyeccionQuincena.alcanza ? "bg-emerald-500/20" : "bg-rose-500/20"
                                )}>
                                    {proyeccionQuincena.alcanza ? '✅' : '⚠️'}
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Proyección de quincena</p>
                                    <h3 className={cn("text-2xl font-black", proyeccionQuincena.alcanza ? "text-emerald-500" : "text-rose-500")}>
                                        {proyeccionQuincena.alcanza
                                            ? `Te alcanza — sobran ${formatCurrency(proyeccionQuincena.saldoProyectado)}`
                                            : `Déficit proyectado: ${formatCurrency(proyeccionQuincena.deficit)}`}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Promedio diario: {formatCurrency(proyeccionQuincena.promedioVentaDiaria)} ·
                                        Ingreso esperado: {formatCurrency(proyeccionQuincena.ingresoEsperado)} ·
                                        {proyeccionQuincena.diasRestantes} días restantes
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 shrink-0">
                                    <div className="text-center bg-card/60 rounded-2xl p-3 border border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Compromisos</p>
                                        <p className="text-lg font-black text-rose-400">{formatCurrency(proyeccionQuincena.totalCompromisos)}</p>
                                    </div>
                                    <div className="text-center bg-card/60 rounded-2xl p-3 border border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Salarios</p>
                                        <p className="text-lg font-black text-amber-400">{formatCurrency(proyeccionQuincena.totalSalarios)}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Columna izq — Compromisos fijos */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Compromisos Fijos</CardTitle>
                                <CardDescription className="text-xs">Arriendo, préstamos, servicios, salarios</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Formulario nuevo compromiso */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 border border-white/5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Nombre (Ej: Arriendo)" value={formCompromiso.nombre}
                                            onChange={e => setFormCompromiso(p => ({ ...p, nombre: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Monto ($)" type="number" value={formCompromiso.monto}
                                            onChange={e => setFormCompromiso(p => ({ ...p, monto: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input placeholder="Día cobro (1-31)" type="number" value={formCompromiso.diaDeCobro}
                                            onChange={e => setFormCompromiso(p => ({ ...p, diaDeCobro: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <select value={formCompromiso.categoria}
                                            onChange={e => setFormCompromiso(p => ({ ...p, categoria: e.target.value as GastoCategoria }))}
                                            className="h-9 text-sm rounded-xl border border-input bg-background px-2">
                                            {(['Arriendo','Servicios','Nómina','Materia Prima','Mantenimiento','Otros'] as GastoCategoria[]).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                                            <input type="checkbox" checked={formCompromiso.esPropietario}
                                                onChange={e => setFormCompromiso(p => ({ ...p, esPropietario: e.target.checked }))}
                                                className="rounded" />
                                            <User className="w-3.5 h-3.5 text-amber-500" /> Mi salario
                                        </label>
                                    </div>
                                    {formCompromiso.esPropietario && (
                                        <Input placeholder="Persona (Yo / Esposa / ...)" value={formCompromiso.persona}
                                            onChange={e => setFormCompromiso(p => ({ ...p, persona: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    )}
                                    <Button onClick={handleAddCompromiso} size="sm" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9">
                                        <Plus className="w-4 h-4 mr-1" /> Agregar compromiso
                                    </Button>
                                </div>

                                {/* Lista de compromisos */}
                                {compromisos.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin compromisos registrados aún</p>
                                )}
                                {compromisos.map(c => (
                                    <div key={c.id} className={cn(
                                        "flex items-center gap-3 rounded-2xl p-3 border transition-all",
                                        c.activo ? "bg-card/40 border-white/5" : "bg-slate-500/5 border-white/3 opacity-50"
                                    )}>
                                        <button onClick={() => handleToggleCompromiso(c.id)} className="shrink-0">
                                            {c.activo
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                : <XCircle className="w-4 h-4 text-slate-400" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                {c.esPropietario && <User className="w-3 h-3 text-amber-500 shrink-0" />}
                                                <p className="text-sm font-bold truncate">{c.nombre}</p>
                                                {c.persona && <span className="text-[10px] text-amber-500 font-black">({c.persona})</span>}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">Día {c.diaDeCobro} · {c.categoria}</p>
                                        </div>
                                        <p className="text-sm font-black text-rose-400 shrink-0">{formatCurrency(c.monto)}</p>
                                        <button onClick={() => handleDeleteCompromiso(c.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Columna der — Registro de ventas del día */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Ventas del Día</CardTitle>
                                <CardDescription className="text-xs">Registro manual mientras el POS arranca</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 border border-white/5">
                                    <Input type="date" value={formVenta.fecha}
                                        onChange={e => setFormVenta(p => ({ ...p, fecha: e.target.value }))}
                                        className="h-9 text-sm rounded-xl" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Efectivo ($)" type="number" value={formVenta.totalEfectivo}
                                            onChange={e => setFormVenta(p => ({ ...p, totalEfectivo: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Nequi ($)" type="number" value={formVenta.totalNequi}
                                            onChange={e => setFormVenta(p => ({ ...p, totalNequi: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Transferencia ($)" type="number" value={formVenta.totalTransferencia}
                                            onChange={e => setFormVenta(p => ({ ...p, totalTransferencia: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Crédito ($)" type="number" value={formVenta.totalCredito}
                                            onChange={e => setFormVenta(p => ({ ...p, totalCredito: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    </div>
                                    <Input placeholder="Notas (opcional)" value={formVenta.notas}
                                        onChange={e => setFormVenta(p => ({ ...p, notas: e.target.value }))}
                                        className="h-9 text-sm rounded-xl" />
                                    <Button onClick={handleAddVentaDiaria} size="sm" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9">
                                        <Plus className="w-4 h-4 mr-1" /> Registrar cierre del día
                                    </Button>
                                </div>

                                {ventasDiarias.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin ventas registradas manualmente aún</p>
                                )}
                                <div className="max-h-64 overflow-y-auto space-y-2">
                                    {ventasDiarias.slice(0, 30).map(v => (
                                        <div key={v.id} className="flex items-center gap-3 rounded-2xl p-3 bg-card/40 border border-white/5">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold">{new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Ef: {formatCurrency(v.totalEfectivo)} · Nequi: {formatCurrency(v.totalNequi)}
                                                    {v.totalTransferencia > 0 && ` · Transf: ${formatCurrency(v.totalTransferencia)}`}
                                                    {v.totalCredito > 0 && ` · Cred: ${formatCurrency(v.totalCredito)}`}
                                                </p>
                                            </div>
                                            <p className="text-sm font-black text-emerald-400 shrink-0">{formatCurrency(v.total)}</p>
                                            <button onClick={() => handleDeleteVentaDiaria(v.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 5: CONSEJERO IA
                ══════════════════════════════════════════════════ */}
                <TabsContent value="consejero-ia" className="space-y-4 mt-0">

                    {/* ── Diagnóstico principal ── */}
                    <Card className={cn(
                        "rounded-3xl border-2",
                        consejo.nivel === 'critico' ? "border-rose-500/50 bg-rose-500/5"
                        : consejo.nivel === 'alerta' ? "border-amber-500/50 bg-amber-500/5"
                        : "border-emerald-500/50 bg-emerald-500/5"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                                    consejo.nivel === 'critico' ? "bg-rose-500/20"
                                    : consejo.nivel === 'alerta' ? "bg-amber-500/20"
                                    : "bg-emerald-500/20"
                                )}>
                                    {consejo.nivel === 'critico'
                                        ? <XCircle className="w-6 h-6 text-rose-500" />
                                        : consejo.nivel === 'alerta'
                                        ? <AlertTriangle className="w-6 h-6 text-amber-500" />
                                        : <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Brain className="w-4 h-4 text-violet-400" />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Consejero IA · Quincena actual</p>
                                    </div>
                                    <h3 className={cn(
                                        "text-xl font-black mb-4",
                                        consejo.nivel === 'critico' ? "text-rose-400"
                                        : consejo.nivel === 'alerta' ? "text-amber-400"
                                        : "text-emerald-400"
                                    )}>{consejo.titulo}</h3>
                                    <div className="space-y-3">
                                        {consejo.puntos.map((p, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                                                <p className="text-sm text-foreground leading-relaxed">{p}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Panorama completo del negocio ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { label: 'Ventas reales quincena', val: quincenaReal.ventasTotal, color: 'text-emerald-400', icon: TrendingUp },
                            { label: 'Compromisos totales activos', val: totalCompromisosActivos, color: 'text-violet-400', icon: CalendarCheck },
                            { label: 'Prom. insumos/mes', val: promedioInsumos, color: 'text-amber-400', icon: Package },
                            { label: 'Total obligaciones mes', val: totalObligaciones, color: 'text-rose-400', icon: Shield },
                            { label: 'Saldo proyectado quincena', val: proyeccionQuincena.saldoProyectado, color: proyeccionQuincena.alcanza ? 'text-emerald-400' : 'text-rose-400', icon: DollarSign },
                            { label: 'Margen neto mes', val: null, strVal: `${margenActual.toFixed(1)}%`, color: margenActual >= 25 ? 'text-emerald-400' : margenActual >= 15 ? 'text-amber-400' : 'text-rose-400', icon: Percent },
                        ].map((item, i) => (
                            <div key={i} className="bg-card/40 rounded-2xl p-3 border border-white/5">
                                <item.icon className="w-3.5 h-3.5 text-muted-foreground mb-2" />
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1 leading-tight">{item.label}</p>
                                <p className={cn("text-base font-black tabular-nums", item.color)}>
                                    {item.val !== null ? formatCurrency(item.val) : item.strVal}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* ── Alertas activas del Tablero Total ── */}
                    {alertasAutomaticas.length > 0 && (
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-2 px-5 pt-5">
                                <CardTitle className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                    <BadgeAlert className="w-4 h-4 text-rose-400" />
                                    Alertas activas del negocio
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 space-y-2">
                                {alertasAutomaticas.map((a, i) => (
                                    <div key={i} className={cn(
                                        "rounded-xl p-3 flex gap-3 items-start border",
                                        a.nivel === 'critico' ? 'border-rose-500/20 bg-rose-500/5'
                                        : a.nivel === 'advertencia' ? 'border-amber-500/20 bg-amber-500/5'
                                        : 'border-emerald-500/20 bg-emerald-500/5'
                                    )}>
                                        <span className="text-base shrink-0">{a.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "text-xs font-black",
                                                a.nivel === 'critico' ? 'text-rose-400' : a.nivel === 'advertencia' ? 'text-amber-400' : 'text-emerald-400'
                                            )}>{a.titulo}</p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">{a.msg}</p>
                                            <p className="text-[11px] font-bold text-foreground mt-1">→ {a.accion}</p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* ── ¿Qué hacer esta semana? ── */}
                    <Card className="rounded-3xl border-white/5 bg-gradient-to-br from-violet-950/50 to-slate-900 overflow-hidden">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <CardTitle className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                <Flame className="w-4 h-4 text-orange-400" />
                                Acciones recomendadas esta semana
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="space-y-2">
                                {(() => {
                                    const acciones: { prioridad: 'alta' | 'media' | 'info'; texto: string }[] = [];

                                    if (!proyeccionQuincena.alcanza)
                                        acciones.push({ prioridad: 'alta', texto: `Necesitas ${formatCurrency(proyeccionQuincena.deficit)} más para cubrir la quincena — enfócate en ventas y no en gastos esta semana.` });

                                    if (coberturaActual < 100 && totalObligaciones > 0)
                                        acciones.push({ prioridad: 'alta', texto: `Tus ventas del mes solo cubren el ${coberturaActual.toFixed(0)}% de tus obligaciones totales. Meta diaria necesaria: ${formatCurrency(ventasNecesariasDiarias)}.` });

                                    if (margenActual < 20 && reporteActual.totalVentas > 0)
                                        acciones.push({ prioridad: 'alta', texto: `Margen del ${margenActual.toFixed(1)}% — revisa qué productos vendes a pérdida o con margen muy bajo y sube su precio entre 5-10%.` });

                                    if (compromisos.filter(c => c.activo).length === 0)
                                        acciones.push({ prioridad: 'alta', texto: 'Registra tus compromisos fijos en "Mi Quincena" — sin eso el sistema no puede calcular si el negocio te alcanza.' });

                                    if (compromisos.filter(c => c.activo && c.esPropietario).length === 0)
                                        acciones.push({ prioridad: 'media', texto: 'No tienes registrado tu salario ni el de tu esposa. Agrégalos como compromiso marcando "Mi salario" para que la proyección sea real.' });

                                    if (promedioInsumos === 0 && gastos.length === 0)
                                        acciones.push({ prioridad: 'media', texto: 'Registra tus gastos de materia prima en el módulo Finanzas — necesitas al menos 1 mes de historial para que el Tablero Total sea preciso.' });

                                    if (proyeccionQuincena.promedioVentaDiaria > 0 && coberturaActual >= 120)
                                        acciones.push({ prioridad: 'info', texto: `Buen ritmo — vendiendo ${formatCurrency(proyeccionQuincena.promedioVentaDiaria)}/día. Considera guardar el excedente de ${formatCurrency(reporteActual.totalVentas - totalObligaciones)} como fondo de emergencia.` });

                                    if (acciones.length === 0)
                                        acciones.push({ prioridad: 'info', texto: 'Ingresa más datos del negocio para que el consejero pueda darte recomendaciones personalizadas.' });

                                    return acciones.map((a, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black",
                                                a.prioridad === 'alta' ? 'bg-rose-500/20 text-rose-400' :
                                                a.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-violet-500/20 text-violet-400'
                                            )}>
                                                {i + 1}
                                            </div>
                                            <p className="text-[12px] text-foreground leading-relaxed">{a.texto}</p>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 6: TABLERO DE OBLIGACIONES TOTALES
                ══════════════════════════════════════════════════ */}
                <TabsContent value="tablero-total" className="space-y-6 mt-0">

                    {/* ── Fuente de datos — transparencia ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'Ventas del mes (POS)',
                                val: reporteActual.totalVentas,
                                sub: 'Fuente: transacciones reales del sistema',
                                color: 'text-emerald-500',
                                border: 'border-emerald-200 dark:border-emerald-800',
                                empty: reporteActual.totalVentas === 0,
                            },
                            {
                                label: 'Compromisos fijos activos',
                                val: totalCompromisosActivos,
                                sub: `${compromisos.filter(c=>c.activo).length} registrados · Fuente: tab Mi Quincena`,
                                color: 'text-violet-500',
                                border: 'border-violet-200 dark:border-violet-800',
                                empty: totalCompromisosActivos === 0,
                            },
                            {
                                label: 'Prom. insumos/mes',
                                val: promedioInsumos,
                                sub: `Basado en ${Object.keys(promedioGastosMensuales).length > 0 ? 'gastos históricos reales' : 'sin gastos registrados'}`,
                                color: 'text-amber-500',
                                border: 'border-amber-200 dark:border-amber-800',
                                empty: promedioInsumos === 0,
                            },
                            {
                                label: 'Total obligaciones',
                                val: totalObligaciones,
                                sub: 'Compromisos + Insumos + Otros gastos',
                                color: totalObligaciones > reporteActual.totalVentas ? 'text-rose-500' : 'text-cyan-500',
                                border: totalObligaciones > reporteActual.totalVentas ? 'border-rose-200 dark:border-rose-800' : 'border-cyan-200 dark:border-cyan-800',
                                empty: totalObligaciones === 0,
                            },
                        ].map(item => (
                            <div key={item.label} className={cn(
                                "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1",
                                item.border
                            )}>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                                {item.empty
                                    ? <span className="text-sm font-black text-slate-400">Sin datos aún</span>
                                    : <span className={cn("text-xl font-black tabular-nums", item.color)}>{formatCurrency(item.val)}</span>
                                }
                                <span className="text-[9px] text-slate-400 font-bold leading-tight">{item.sub}</span>
                            </div>
                        ))}
                    </div>

                    {/* Aviso si faltan datos clave */}
                    {(totalCompromisosActivos === 0 || totalObligaciones === 0) && (
                        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-amber-400">Completa tus datos para ver el tablero real</p>
                                <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5 list-disc ml-4">
                                    {totalCompromisosActivos === 0 && <li>Ve a <strong>Mi Quincena</strong> y registra tus compromisos fijos (arriendo, servicios, préstamos, salarios)</li>}
                                    {promedioInsumos === 0 && <li>Registra gastos de <strong>Materia Prima</strong> en el módulo Finanzas para que el promedio de insumos sea real</li>}
                                    {reporteActual.totalVentas === 0 && <li>Las ventas del mes aún no se han registrado en el POS</li>}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ── Cobertura gauge principal ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2 rounded-3xl border-white/5 bg-card/30 overflow-hidden">
                            <CardHeader className="pb-3 px-6 pt-5">
                                <div className="flex items-center gap-2">
                                    <Gauge className="w-5 h-5 text-rose-400" />
                                    <CardTitle className="text-base font-black uppercase tracking-tight">Cobertura de Obligaciones</CardTitle>
                                </div>
                                <CardDescription className="text-[11px]">¿Cuánto de tus obligaciones totales cubren las ventas de este mes?</CardDescription>
                            </CardHeader>
                            <CardContent className="px-6 pb-6 space-y-5">
                                {/* Barra de cobertura */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                                            Ventas: {formatCurrency(reporteActual.totalVentas)}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase",
                                            coberturaActual >= 120 ? 'text-emerald-400' : coberturaActual >= 80 ? 'text-amber-400' : 'text-rose-400'
                                        )}>
                                            {coberturaActual.toFixed(0)}% cubierto
                                        </span>
                                    </div>
                                    <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2",
                                                coberturaActual >= 120 ? 'bg-emerald-500' : coberturaActual >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                                            )}
                                            style={{ width: `${Math.min(100, coberturaActual)}%` }}
                                        >
                                            {coberturaActual >= 30 && (
                                                <span className="text-[9px] font-black text-white">{coberturaActual.toFixed(0)}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[9px] text-slate-400 font-bold">Crítico</span>
                                        <span className="text-[9px] text-slate-400 font-bold">Obligaciones: {formatCurrency(totalObligaciones)}</span>
                                        <span className="text-[9px] text-slate-400 font-bold">Saludable &gt;120%</span>
                                    </div>
                                </div>

                                {/* KPIs de obligaciones */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Compromisos fijos', val: totalCompromisosActivos, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                                        { label: 'Prom. insumos/mes', val: promedioInsumos, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                        { label: 'Prom. otros gastos', val: promedioOtrosGastos, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                                    ].map(item => (
                                        <div key={item.label} className={cn("rounded-2xl p-3 border border-white/5", item.bg)}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                                            <p className={cn("text-lg font-black", item.color)}>{formatCurrency(item.val)}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Ventas mínimas para sobrevivir */}
                                <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-4 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                                            <LifeBuoy className="w-5 h-5 text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ventas mínimas para sobrevivir</p>
                                            <p className="text-2xl font-black text-white">{formatCurrency(totalObligaciones)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Necesitas vender al día</p>
                                        <p className="text-xl font-black text-amber-400">{formatCurrency(ventasNecesariasDiarias)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Donut de breakdown */}
                        <Card className="rounded-3xl border-white/5 bg-card/30 overflow-hidden">
                            <CardHeader className="pb-2 px-5 pt-5">
                                <CardTitle className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4 text-violet-400" /> Distribución de obligaciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                {obligacionesBreakdown.length > 0 ? (
                                    <>
                                        <div className="h-[160px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={obligacionesBreakdown} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                        {obligacionesBreakdown.map((item, index) => (
                                                            <Cell key={index} fill={item.color} stroke="rgba(255,255,255,0.05)" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }}
                                                        itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                                                        formatter={(value: number) => formatCurrency(value)}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {obligacionesBreakdown.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="text-[10px] font-bold text-muted-foreground truncate">{item.name}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-foreground shrink-0">{formatCurrency(item.value)}</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">Total obligaciones</span>
                                                <span className="text-sm font-black text-foreground">{formatCurrency(totalObligaciones)}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center">
                                        <p className="text-xs text-muted-foreground text-center">Sin datos de obligaciones registrados aún.<br />Agrega compromisos o registra gastos.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Alertas automáticas ── */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BadgeAlert className="w-4 h-4 text-rose-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alertas del sistema</h3>
                            <div className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-full",
                                alertasAutomaticas.some(a => a.nivel === 'critico') ? 'bg-rose-500/20 text-rose-400' :
                                alertasAutomaticas.some(a => a.nivel === 'advertencia') ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                            )}>
                                {alertasAutomaticas.filter(a => a.nivel === 'critico').length} críticas · {alertasAutomaticas.filter(a => a.nivel === 'advertencia').length} advertencias
                            </div>
                        </div>
                        <div className="space-y-2">
                            {alertasAutomaticas.map((alerta, i) => (
                                <div key={i} className={cn(
                                    "rounded-2xl border p-4 flex gap-3",
                                    alerta.nivel === 'critico' ? 'border-rose-500/30 bg-rose-500/5' :
                                    alerta.nivel === 'advertencia' ? 'border-amber-500/30 bg-amber-500/5' :
                                    'border-emerald-500/30 bg-emerald-500/5'
                                )}>
                                    <span className="text-lg shrink-0 leading-none mt-0.5">{alerta.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={cn(
                                                "text-xs font-black",
                                                alerta.nivel === 'critico' ? 'text-rose-400' :
                                                alerta.nivel === 'advertencia' ? 'text-amber-400' :
                                                'text-emerald-400'
                                            )}>{alerta.titulo}</p>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{alerta.msg}</p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                                            <p className="text-[11px] font-bold text-foreground">{alerta.accion}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Resumen estratégico ── */}
                    <Card className="rounded-3xl border-white/5 bg-gradient-to-br from-violet-950/40 to-slate-900 overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-violet-400">Diagnóstico rápido</p>
                                    <p className="text-[10px] text-muted-foreground">Basado en datos reales de tu negocio</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    {
                                        label: 'Situación actual',
                                        valor: coberturaActual >= 120 ? 'Solvente' : coberturaActual >= 80 ? 'Ajustado' : 'En riesgo',
                                        desc: coberturaActual >= 120
                                            ? 'Tus ventas superan tus obligaciones. Tienes excedente.'
                                            : coberturaActual >= 80
                                            ? 'Cubres lo básico pero sin margen de seguridad.'
                                            : 'Las ventas actuales no alcanzan a cubrir todas las obligaciones.',
                                        color: coberturaActual >= 120 ? 'text-emerald-400' : coberturaActual >= 80 ? 'text-amber-400' : 'text-rose-400',
                                    },
                                    {
                                        label: 'Meta mensual recomendada',
                                        valor: formatCurrency(totalObligaciones * 1.3),
                                        desc: 'Obligaciones × 1.3 — el 30% extra es tu colchón de ahorro y emergencias.',
                                        color: 'text-indigo-400',
                                    },
                                    {
                                        label: 'Excedente / Déficit mes',
                                        valor: formatCurrency(reporteActual.totalVentas - totalObligaciones),
                                        desc: reporteActual.totalVentas >= totalObligaciones
                                            ? 'Tienes excedente este mes. Considera guardarlo como fondo de emergencia.'
                                            : 'Hay déficit. Cada peso que puedas ahorrar en gastos ayuda a cerrar esta brecha.',
                                        color: reporteActual.totalVentas >= totalObligaciones ? 'text-emerald-400' : 'text-rose-400',
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                                        <p className={cn("text-lg font-black mb-1", item.color)}>{item.valor}</p>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal PIN — Eliminar venta diaria */}
            {pinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
                        <div className="text-center space-y-1">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-2">
                                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Eliminar venta</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Ingresa el PIN de gerente para continuar</p>
                        </div>
                        <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="PIN gerente"
                            value={pinModal.pin}
                            onChange={e => setPinModal(prev => prev ? { ...prev, pin: e.target.value, error: '' } : null)}
                            onKeyDown={e => e.key === 'Enter' && confirmarDeleteConPin()}
                            className="text-center text-lg font-black tracking-[0.4em] h-12"
                            autoFocus
                        />
                        {pinModal.error && (
                            <p className="text-[11px] font-bold text-rose-500 text-center">{pinModal.error}</p>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => setPinModal(null)}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 h-10 text-sm bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmarDeleteConPin}>
                                Eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
