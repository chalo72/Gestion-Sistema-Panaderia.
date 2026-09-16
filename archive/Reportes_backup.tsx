import { useMemo, useState, useEffect } from 'react';
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
    Snowflake,
    CalendarDays,
    CalendarRange,
    List,
    Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { Venta, Gasto, ReporteFinanciero, Producto, Categoria, CompromisoFijo, GastoCategoria } from '@/types';
import { cn } from '@/lib/utils';
import { HistorialVentasCategoria } from '@/components/ventas/HistorialVentasCategoria';
import { exportCSV, getExportFilename } from '@/lib/exportUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePredictiveStock } from '@/hooks/usePredictiveStock';
import { ArqueoCajas } from '@/components/reportes/ArqueoCajas';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCompromisos, saveCompromisos, addCompromiso, deleteCompromiso, updateCompromiso,
    getVentasDiarias, addVentaDiaria, deleteVentaDiaria,
    calcularProyeccionQuincena, generarConsejo,
    getProducciones, addProduccion, deleteProduccion
} from '@/lib/finanzas-personales';
import { getBovedas, addBoveda, addMovimientoBoveda } from '@/lib/boveda-store';
import type { HornadaDia, RegistroProduccion, MasaPreparadaDia } from '@/lib/finanzas-personales';
import { getConfigSeguridad } from '@/lib/security-agent';
import type { VentaDiaria } from '@/types';
import { consultarAgente } from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { Bot, Sparkles, Loader2 } from 'lucide-react';

interface ReportesProps {
    ventas: Venta[];
    gastos: Gasto[];
    formatCurrency: (value: number) => string;
    generarReporte: (periodo: string) => ReporteFinanciero;
    productos?: Producto[];
    categorias?: Categoria[];
    proveedores?: any[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];

export default function Reportes({
    ventas,
    gastos,
    formatCurrency,
    generarReporte,
    productos = [],
    categorias = [],
    proveedores = []
}: ReportesProps) {
    const { role } = useAuth();
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
    const [detallesModal, setDetallesModal] = useState<string | null>(null);

    // ── Producción del Día ────────────────────────────────────
    const [producciones, setProducciones] = useState<RegistroProduccion[]>(() => getProducciones());
    const [formProd, setFormProd] = useState({
        fecha: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10),
        masaDulce: '', // Mantenido por retrocompatibilidad temporal en UI, aunque ya no lo usemos
        masaHojaldrado: '',
        masaBatidoTorta: '',
        masaBatidoGalleta: '',
        notas: ''
    });
    const [masasPreparadas, setMasasPreparadas] = useState<MasaPreparadaDia[]>([]);
    const [hornadas, setHornadas] = useState<HornadaDia[]>([{ tipoPan: '', bandejas: 0, panesPorBandeja: 0, totalPanes: 0 }]);

    const handleAddMasa = () => setMasasPreparadas(m => [...m, { id: crypto.randomUUID(), nombre: '', cantidadArrobas: 0 }]);
    const handleRemoveMasa = (id: string) => setMasasPreparadas(m => m.filter(x => x.id !== id));
    const handleMasaChange = (id: string, field: keyof MasaPreparadaDia, value: string | number) => {
        setMasasPreparadas(prev => prev.map(m => {
            if (m.id !== id) return m;
            return { ...m, [field]: field === 'nombre' ? value : (parseFloat(String(value)) || 0) };
        }));
    };

    const handleAddHornada = () => setHornadas(h => [...h, { tipoPan: '', bandejas: 0, panesPorBandeja: 0, totalPanes: 0 }]);
    const handleRemoveHornada = (i: number) => setHornadas(h => h.filter((_, idx) => idx !== i));
    const handleHornadaChange = (i: number, field: keyof HornadaDia, value: string | number) => {
        setHornadas(prev => prev.map((h, idx) => {
            if (idx !== i) return h;
            const isStringField = field === 'tipoPan' || field === 'masaId';
            const updated = { ...h, [field]: isStringField ? value : (parseInt(String(value)) || 0) };
            updated.totalPanes = updated.bandejas * updated.panesPorBandeja;
            return updated;
        }));
    };

    const handleSaveProduccion = () => {
        const validHornadas = hornadas.filter(h => h.tipoPan.trim() && h.bandejas > 0);
        const data: Omit<RegistroProduccion, 'id'> = {
            fecha: formProd.fecha,
            masas: masasPreparadas,
            hornadas: validHornadas,
            notas: formProd.notas
        };
        const masaTotal = masasPreparadas.reduce((sum, m) => sum + m.cantidadArrobas, 0);
        if (masaTotal === 0 && validHornadas.length === 0) {
            toast.error('Ingresa al menos una masa o una hornada del día');
            return;
        }
        const nueva = addProduccion(data);
        setProducciones(getProducciones());
        setFormProd(p => ({ ...p, notas: '' }));
        setMasasPreparadas([]);
        setHornadas([{ tipoPan: '', bandejas: 0, panesPorBandeja: 0, totalPanes: 0 }]);
        toast.success(`✅ Producción del ${nueva.fecha} registrada`);
    };
    const [pinModal, setPinModal] = useState<{ ventaId: string; pin: string; error: string } | null>(null);
    const [activeTab, setActiveTab] = useState('resumen');
    
    // ── ESTADOS DE IA ──
    const [analisisIA, setAnalisisIA] = useState<string>('');
    const [pidiendoIA, setPidiendoIA] = useState<boolean>(false);

    const pedirConsejoIA = async (diagnosticoLocal: any, quincenaLocal: any) => {
        setPidiendoIA(true);
        setAnalisisIA('');
        try {
            const contextoData = {
                quincena: quincenaLocal,
                diagnostico: diagnosticoLocal
            };
            const prompt = `Analiza los siguientes datos financieros de mi panadería correspondientes a la ${quincenaLocal.label}. Ingresos: $${diagnosticoLocal.ingresos}, Fijos: $${diagnosticoLocal.fijos}, Proveedores: $${diagnosticoLocal.compras}, Gastos Diarios: $${diagnosticoLocal.operativos}. Ganancia Neta: $${diagnosticoLocal.gananciaNeta}. Dime qué estrategia tomar, en qué estoy fallando y cómo administrar mejor el dinero. Sé directo, profesional pero motivador. Formatea tu respuesta con emojis, viñetas y negritas para que sea fácil de leer en un dashboard.`;
            
            await consultarAgente(
                'pico-claw',
                prompt,
                (chunk) => {
                    setAnalisisIA(prev => prev + chunk);
                },
                undefined,
                JSON.stringify(contextoData)
            );
        } catch (error) {
            toast.error('Error al consultar a la IA');
            console.error(error);
        } finally {
            setPidiendoIA(false);
        }
    };

    const [temporadaBaja, setTemporadaBaja] = useState(() => localStorage.getItem('dp_temporada_baja') === 'true');
    // Actualizar localStorage cuando cambie temporadaBaja
    useEffect(() => { localStorage.setItem('dp_temporada_baja', String(temporadaBaja)); window.dispatchEvent(new Event('storage')); }, [temporadaBaja]);

    // Estado de presupuestos para evitar problemas con eventos de storage
    const [presupuestosMinimos, setPresupuestosMinimos] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('dp_compras_minimas') || '[]'); } catch { return []; }
    });
    const [editCompraId, setEditCompraId] = useState<string | null>(null);
    // Sincronizar estado local si cambia localStorage desde otra pestaña
    useEffect(() => {
        const handleStorage = () => {
            try { setPresupuestosMinimos(JSON.parse(localStorage.getItem('dp_compras_minimas') || '[]')); } catch {}
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Motor Predictivo de Inventario
    const { sugerencias: sugerenciasPedido, loading: loadingSugerencias, generarSugerencias } = usePredictiveStock();
    useEffect(() => {
        if (activeTab === 'compras-minimas') {
            generarSugerencias();
        }
    }, [activeTab, generarSugerencias]);


    // ── Métricas de compromisos ──────────────────────────────────
    const totalCompromisosActivos = useMemo(() => {
        const diaActual = new Date().getDate();
        return compromisos
            .filter(c => c.activo)
            .filter(c => {
                const d = typeof c.diaDeCobro === 'number' ? c.diaDeCobro : parseInt(c.diaDeCobro as string) || 1;
                return diaActual <= 15 ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
            })
            .reduce((s, c) => s + c.monto, 0);
    }, [compromisos]);
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
        nombre: '', monto: '', diaDeCobro: '1', categoria: 'Otros' as GastoCategoria, 
        esPropietario: false, persona: '',
        frecuencia: 'mensual' as 'quincenal' | 'mensual' | 'solo_q1' | 'solo_q2'
    });
    const [formVenta, setFormVenta] = useState({
        id: '' as string | undefined,
        fecha: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10),
        turno: 'Día Completo' as 'Mañana' | 'Tarde-Noche' | 'Día Completo',
        totalEfectivo: '', totalNequi: '', totalTransferencia: '', totalCredito: '', notas: ''
    });

    const proyeccionQuincena = useMemo(() => calcularProyeccionQuincena({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total, metodoPago: v.metodoPago })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria })),
        compromisos,
        temporadaBaja,
        margenCostoVariable: 0.5
    }), [ventas, ventasDiarias, gastos, compromisos, temporadaBaja]);

    const consejo = useMemo(() => generarConsejo({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total, metodoPago: v.metodoPago })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria, descripcion: g.descripcion })),
        compromisos,
        temporadaBaja,
        margenCostoVariable: 0.5
    }), [ventas, ventasDiarias, gastos, compromisos, temporadaBaja]);

    const [periodoFiltro, setPeriodoFiltro] = useState<{ mes: string, quincena: '1' | '2' | 'mes' }>(() => {
        const hoy = new Date();
        const m = hoy.toISOString().slice(0, 7);
        const q = hoy.getDate() <= 15 ? '1' : '2';
        return { mes: m, quincena: q };
    });

    // ── DATOS REALES DE LA QUINCENA ACTUAL ──────────────────────
    const quincenaReal = useMemo(() => {
        const [year, month] = periodoFiltro.mes.split('-').map(Number);
        
        let inicioStr, finStr, label;
        const pad = (n: number) => String(n).padStart(2, '0');
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        
        if (periodoFiltro.quincena === '1') {
            inicioStr = `${year}-${pad(month)}-01`;
            finStr = `${year}-${pad(month)}-15`;
            label = `1ª quincena (${periodoFiltro.mes})`;
        } else if (periodoFiltro.quincena === '2') {
            inicioStr = `${year}-${pad(month)}-16`;
            finStr = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`;
            label = `2ª quincena (${periodoFiltro.mes})`;
        } else {
            inicioStr = `${year}-${pad(month)}-01`;
            finStr = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`;
            label = `Mes Completo (${periodoFiltro.mes})`;
        }

        // Para calcular días transcurridos usamos fechas locales a medianoche
        const [y1, m1, d1] = inicioStr.split('-').map(Number);
        const [y2, m2, d2] = finStr.split('-').map(Number);
        const inicioDate = new Date(y1, m1 - 1, d1);
        const finDate = new Date(y2, m2 - 1, d2);
        
        const hoy = new Date();
        const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

        const maxTranscurrido = Math.min(hoyDate.getTime(), finDate.getTime());
        const transcurridoTime = maxTranscurrido - inicioDate.getTime();
        const diasTranscurridos = transcurridoTime >= 0 ? (transcurridoTime / (1000 * 3600 * 24)) + 1 : 0;
        const totalDiasPeriodo = (finDate.getTime() - inicioDate.getTime()) / (1000 * 3600 * 24) + 1;

        let ventasPOS = 0;
        let ventasPOSDia = 0;
        ventas.forEach(v => {
            const f = v.fecha.slice(0, 10);
            if (f >= inicioStr && f <= finStr) {
                ventasPOS += v.total;
                if (f === hoyStr) ventasPOSDia += v.total;
            }
        });
        
        let ventasManuales = 0;
        let ventasManualesDia = 0;
        let totalVentasManualesHistorico = 0;

        ventasDiarias.forEach(v => {
            totalVentasManualesHistorico += v.total;
            if (v.fecha >= inicioStr && v.fecha <= finStr) {
                ventasManuales += v.total;
                if (v.fecha === hoyStr) {
                    ventasManualesDia += v.total;
                }
            }
        });

        const ventasTotalDia = ventasPOSDia + ventasManualesDia;

        return {
            inicioStr,
            finStr,
            hoyStr,
            diasTranscurridos: Math.max(1, diasTranscurridos),
            totalDiasPeriodo,
            ventasPOS,
            ventasManuales,
            ventasTotal: ventasPOS + ventasManuales,
            ventasTotalDia,
            totalVentasManualesHistorico,
            label,
        };
    }, [ventas, ventasDiarias, periodoFiltro]);

    // ── DIAGNÓSTICO FINANCIERO (GANANCIAS Y PÉRDIDAS DE LA QUINCENA) ──
    const diagnosticoFinanciero = useMemo(() => {
        // Los gastos/salidas del turno ya vienen restados en el 'total' de ventasDiarias
        // por lo que ventasTotal = Ingreso Neto. Para el P&L, necesitamos el Ingreso Bruto.
        const operativos = ventasDiarias
            .filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr)
            .reduce((s, v) => s + ((v.cajas && v.cajas['Gastos/Salidas']) ? v.cajas['Gastos/Salidas'] : 0), 0);
            
        const ingresos = quincenaReal.ventasTotal + operativos;
        
        // Fijos de la quincena (solo los que se cobran en estos 15 días, o el mes completo si aplica)
        const fijos = compromisos
            .filter(c => c.activo)
            .filter(c => {
                if (periodoFiltro.quincena === 'mes') return true;
                
                if (c.frecuencia === 'quincenal') return true;
                if (c.frecuencia === 'solo_q1') return periodoFiltro.quincena === '1';
                if (c.frecuencia === 'solo_q2') return periodoFiltro.quincena === '2';
                if (c.frecuencia === 'mensual') {
                    const d = typeof c.diaDeCobro === 'number' ? c.diaDeCobro : parseInt(c.diaDeCobro as string) || 1;
                    return periodoFiltro.quincena === '1' ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
                }
                
                const d = typeof c.diaDeCobro === 'number' ? c.diaDeCobro : parseInt(c.diaDeCobro as string) || 1;
                return periodoFiltro.quincena === '1' ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
            })
            .reduce((s, c) => s + c.monto, 0);
        
        const getLimite = (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
        
        // El tope presupuestado de compras (proveedores) se calcula para el periodo seleccionado
        const compras = presupuestosMinimos.reduce((s: any, i: any) => {
            const limite = getLimite(i);
            let multiplicador = 1;
            
            if (periodoFiltro.quincena === 'mes') {
                if (i.frecuencia === 'Semanal') multiplicador = 4; // 4 semanas en un mes
                else if (i.frecuencia === 'Quincenal') multiplicador = 2; // 2 quincenas
                else multiplicador = 1; // Mensual
            } else {
                // Evaluando solo una quincena (1 o 2)
                if (i.frecuencia === 'Semanal') multiplicador = 2; // 2 semanas por quincena
                else if (i.frecuencia === 'Quincenal') multiplicador = 1; // 1 quincena
                else multiplicador = 0.5; // La mitad de la cuota mensual
            }
            
            return s + (limite * multiplicador);
        }, 0);
        
        return {
            ingresos,
            fijos,
            compras,
            operativos,
            // Si los proveedores se pagan de la caja diaria (operativos), sumarlos de nuevo causa doble contabilización.
            // Asumiremos que los Egresos Totales son los Gastos Fijos (Arriendo, Nómina) + Gastos Operativos (Caja diaria, que incluye pago a proveedores).
            totalEgresos: fijos + operativos,
            gananciaNeta: ingresos - (fijos + operativos)
        };
    }, [quincenaReal, compromisos, presupuestosMinimos, ventasDiarias, temporadaBaja, periodoFiltro]);

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
        
        const cId = (formCompromiso as any).id;
        if (cId) {
            updateCompromiso(cId, {
                nombre: formCompromiso.nombre,
                monto,
                categoria: formCompromiso.categoria,
                diaDeCobro: isNaN(dia) ? 1 : Math.min(31, Math.max(1, dia)),
                frecuencia: formCompromiso.frecuencia,
                esPropietario: formCompromiso.esPropietario,
                persona: formCompromiso.persona || undefined,
            });
            toast.success('Compromiso actualizado');
        } else {
            const nuevo = addCompromiso({
                nombre: formCompromiso.nombre, monto,
                categoria: formCompromiso.categoria,
                diaDeCobro: isNaN(dia) ? 1 : Math.min(31, Math.max(1, dia)),
                frecuencia: formCompromiso.frecuencia,
                activo: true,
                esPropietario: formCompromiso.esPropietario,
                persona: formCompromiso.persona || undefined,
            });
            toast.success('Compromiso guardado');
        }
        
        setCompromisos(getCompromisos());
        setFormCompromiso({ nombre: '', monto: '', categoria: 'Otros', diaDeCobro: '', esPropietario: false, persona: '' });
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
        const cajas = (formVenta as any).cajas || undefined;
        
        let totalVal = ef + nq + tr + cr;
        if (cajas) {
            const sumCajas = Object.values(cajas).reduce((s: number, x: any) => s + (parseFloat(x) || 0), 0);
            if (sumCajas > 0) totalVal = sumCajas + nq + tr + cr;
        }

        if (totalVal <= 0) { toast.error('Ingresa al menos un monto en cajas o métodos de pago'); return; }
        
        const nueva = addVentaDiaria({
            id: formVenta.id || undefined,
            fecha: formVenta.fecha,
            turno: formVenta.turno,
            totalEfectivo: ef, 
            totalNequi: nq,
            totalTransferencia: tr, 
            totalCredito: cr, 
            notas: formVenta.notas || undefined,
            cajas: cajas
        });

        // Sincronización automática con Bóvedas de Tesorería
        const bovedasExistentes = getBovedas();
        const syncToBoveda = (nombre: string, monto: number, tipo: any, metodoPago: string) => {
            if (monto <= 0) return;
            let boveda = bovedasExistentes.find(b => b.nombre.toLowerCase() === nombre.toLowerCase());
            if (!boveda) {
                boveda = addBoveda({ nombre, tipo });
                bovedasExistentes.push(boveda);
            }
            addMovimientoBoveda({
                bovedaDestinoId: boveda.id,
                monto: monto,
                motivo: `Arqueo de Caja - ${formVenta.turno} (${formVenta.fecha})`,
                tipo: 'Ingreso',
                usuarioResponsable: role || 'Admin',
                metodoPago: metodoPago
            });
        };

        if (cajas) {
            Object.entries(cajas).forEach(([nombreCaja, montoRaw]) => {
                syncToBoveda(nombreCaja, parseFloat(montoRaw as string) || 0, 'Caja Fuerte', 'Efectivo');
            });
        }
        
        // Sincronizar métodos digitales (opcional pero muy útil)
        syncToBoveda('Nequi', nq, 'Banco', 'Nequi');
        syncToBoveda('Transferencia', tr, 'Banco', 'Transferencia');
        
        setVentasDiarias(getVentasDiarias());
        setFormVenta({ 
            id: undefined,
            fecha: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10), 
            turno: 'Día Completo',
            totalEfectivo: '', 
            totalNequi: '', 
            totalTransferencia: '', 
            totalCredito: '', 
            notas: '' 
        });
        toast.success(`Venta del día registrada: ${formatCurrency(nueva.total)}`);
    };

    const handleDeleteVentaDiaria = (id: string) => {
        if (role === 'ADMIN') {
            deleteVentaDiaria(id);
            setVentasDiarias(getVentasDiarias());
            toast.success('Venta eliminada (Modo Admin)');
            return;
        }
        setPinModal({ ventaId: id, pin: '', error: '' });
    };

    const confirmarDeleteConPin = () => {
        if (!pinModal) return;
        const cfg = getConfigSeguridad();
        if (role !== 'ADMIN' && pinModal.pin !== cfg.pinGerente) {
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
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-14 p-1 mb-6 flex items-center justify-start gap-1 overflow-x-auto no-scrollbar w-full">
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
                    <TabsTrigger value="compras-minimas" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Presupuestos
                    </TabsTrigger>
                    <TabsTrigger value="arqueo-cajas" className="rounded-xl h-10 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-cyan-600 data-[state=active]:text-white gap-2">
                        <Wallet className="w-4 h-4" />
                        Arqueo Cajas
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
                            <Card key={i} className="rounded-3xl border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-card/30 backdrop-blur-md overflow-hidden">
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
                    
                    {/* ── SELECTORES DE PERIODO HISTÓRICO ── */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-card/50 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Analizar:</span>
                        </div>
                        <input 
                            type="month" 
                            className="bg-background border border-white/10 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={periodoFiltro.mes}
                            onChange={(e) => setPeriodoFiltro(p => ({ ...p, mes: e.target.value }))}
                        />
                        <div className="flex bg-background border border-white/10 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: '1' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === '1' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                1ª Quincena
                            </button>
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: '2' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === '2' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                2ª Quincena
                            </button>
                            <button
                                onClick={() => setPeriodoFiltro(p => ({ ...p, quincena: 'mes' }))}
                                className={cn("px-3 py-1.5 text-xs font-bold transition-colors", periodoFiltro.quincena === 'mes' ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-white/5")}
                            >
                                Mes Completo
                            </button>
                        </div>
                    </div>

                    {/* ── CONSEJERO IA INTEGRADO EN EL DASHBOARD ── */}
                    <Card className="rounded-3xl border-2 shadow-lg border-violet-500/50 bg-violet-500/5">
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-violet-500/20">
                                    <Sparkles className="w-6 h-6 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-violet-400" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Análisis Financiero IA · {quincenaReal.label}</p>
                                        </div>
                                    </div>
                                    
                                    {!analisisIA && !pidiendoIA ? (
                                        <div className="space-y-3">
                                            <h3 className="text-lg font-black text-violet-400">¿Necesitas ayuda con los números?</h3>
                                            <p className="text-sm text-muted-foreground">Pico-Claw, el agente financiero, puede analizar los datos de esta quincena y darte una estrategia personalizada.</p>
                                            <Button 
                                                onClick={() => pedirConsejoIA(diagnosticoFinanciero, quincenaReal)}
                                                className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2"
                                            >
                                                <Bot className="w-4 h-4" />
                                                Analizar Datos Ahora
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                                                {analisisIA ? (
                                                    <div className="whitespace-pre-wrap leading-relaxed text-sm">
                                                        {analisisIA}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-violet-400 animate-pulse font-medium">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Pico-Claw está analizando tus finanzas...
                                                    </div>
                                                )}
                                            </div>
                                            {analisisIA && !pidiendoIA && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => pedirConsejoIA(diagnosticoFinanciero, quincenaReal)}
                                                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                                                    Re-evaluar Estrategia
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── ESTADO FINANCIERO DEL NEGOCIO (P&L) ── */}
                    <Card className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/10 to-blue-950/5 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp className="w-24 h-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-black flex items-center gap-2 text-cyan-500">
                                📊 Estado General del Negocio
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Diagnóstico de pérdidas y ganancias de {quincenaReal.label}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                                <div onClick={() => setDetallesModal('ingresos')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">Total Ingresos</p>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(diagnosticoFinanciero.ingresos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('proveedores')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1">Proveedores (Topes)</p>
                                    <p className="text-base font-black text-amber-600 dark:text-amber-400">- {formatCurrency(diagnosticoFinanciero.compras)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('fijos')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-500 mb-1">Gastos Fijos/Nómina</p>
                                    <p className="text-base font-black text-violet-600 dark:text-violet-400">- {formatCurrency(diagnosticoFinanciero.fijos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('diarios')} className="bg-slate-50 dark:bg-card/40 rounded-2xl p-3 border border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-500 mb-1">Gastos Diarios</p>
                                    <p className="text-base font-black text-rose-600 dark:text-rose-400">- {formatCurrency(diagnosticoFinanciero.operativos)}</p>
                                </div>
                                <div onClick={() => setDetallesModal('neta')} className={cn(
                                    "rounded-2xl p-3 border md:col-span-1 col-span-2 flex flex-col justify-center cursor-pointer hover:brightness-110 transition-all",
                                    diagnosticoFinanciero.gananciaNeta >= 0 ? "bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/20" : "bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/20"
                                )}>
                                    <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                                        Ganancia Neta
                                    </p>
                                    <p className={cn("text-xl font-black", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-700 dark:text-emerald-500" : "text-rose-700 dark:text-rose-500")}>
                                        {formatCurrency(diagnosticoFinanciero.gananciaNeta)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Barra de progreso de rentabilidad */}
                            <div className="mt-4">
                                <div className="flex justify-between text-[10px] font-bold mb-1.5 px-1 text-muted-foreground">
                                    <span>Ingresos 100%</span>
                                    <span>Margen Neto: {diagnosticoFinanciero.ingresos > 0 ? ((diagnosticoFinanciero.gananciaNeta / diagnosticoFinanciero.ingresos) * 100).toFixed(1) : 0}%</span>
                                </div>
                                <div className="h-3 w-full bg-rose-500/20 rounded-full flex overflow-hidden">
                                    <div 
                                        className="h-full bg-amber-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.compras / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Proveedores: ${formatCurrency(diagnosticoFinanciero.compras)}`}
                                    />
                                    <div 
                                        className="h-full bg-violet-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.fijos / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Fijos: ${formatCurrency(diagnosticoFinanciero.fijos)}`}
                                    />
                                    <div 
                                        className="h-full bg-rose-400 transition-all duration-1000 border-r border-black/10" 
                                        style={{ width: `${diagnosticoFinanciero.ingresos > 0 ? (diagnosticoFinanciero.operativos / diagnosticoFinanciero.ingresos) * 100 : 0}%` }}
                                        title={`Operativos: ${formatCurrency(diagnosticoFinanciero.operativos)}`}
                                    />
                                    {diagnosticoFinanciero.gananciaNeta > 0 && (
                                        <div 
                                            className="h-full bg-emerald-500 transition-all duration-1000 relative"
                                            style={{ width: `${(diagnosticoFinanciero.gananciaNeta / diagnosticoFinanciero.ingresos) * 100}%` }}
                                            title={`Ganancia Neta: ${formatCurrency(diagnosticoFinanciero.gananciaNeta)}`}
                                        >
                                            <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── RESUMEN REAL — 4 cajas prominentes ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: `Ventas POS ${quincenaReal.label}`,
                                val: quincenaReal.ventasPOS,
                                color: 'text-emerald-500',
                                border: 'border-emerald-200 dark:border-emerald-800',
                                sub: `${ventas.filter(v => v.fecha.slice(0, 10) >= quincenaReal.inicioStr && v.fecha.slice(0, 10) <= quincenaReal.finStr).length} transacciones`,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Turnos Cerrados (Caja)',
                                val: quincenaReal.ventasManuales,
                                color: 'text-indigo-500',
                                border: 'border-indigo-200 dark:border-indigo-800',
                                sub: `${ventasDiarias.filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr).length} cierres de caja`,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Total ingresos reales',
                                val: quincenaReal.ventasTotal,
                                color: 'text-cyan-500',
                                border: 'border-cyan-200 dark:border-cyan-800',
                                sub: 'POS + Cierres (Neto)',
                                highlight: true,
                                modalKey: 'ingresos'
                            },
                            {
                                label: 'Compromisos de la Quincena',
                                val: diagnosticoFinanciero.fijos,
                                color: diagnosticoFinanciero.fijos > quincenaReal.ventasTotal ? 'text-rose-500' : 'text-violet-500',
                                border: diagnosticoFinanciero.fijos > quincenaReal.ventasTotal ? 'border-rose-200 dark:border-rose-800' : 'border-violet-200 dark:border-violet-800',
                                sub: `Fijos a pagar en estos 15 días`,
                                modalKey: 'fijos'
                            },
                        ].map(item => (
                            <div key={item.label} onClick={() => setDetallesModal(item.modalKey)} className={cn(
                                "bg-white dark:bg-slate-900 rounded-2xl border px-4 py-3 flex flex-col gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm",
                                item.border,
                                item.highlight && "ring-2 ring-cyan-400/30"
                            )}>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.label}</span>
                                <span className={cn("text-xl font-black tabular-nums", item.color)}>
                                    {formatCurrency(item.val)}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">{item.sub}</span>
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
                                    <div 
                                        onClick={() => setDetallesModal('ventas_hoy')}
                                        className="text-right bg-card/60 rounded-xl px-4 py-2 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ventas registradas hoy</p>
                                        <p className="text-xl font-black text-amber-400">{formatCurrency(quincenaReal.ventasTotalDia)}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── SEMÁFORO Y SOBRES (MI QUINCENA PRO) ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Semáforo de Utilidad - Rediseñado para Claridad */}
                        <Card className={cn(
                            "rounded-3xl border-2 overflow-hidden relative",
                            proyeccionQuincena.alcanza
                                ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-500/10"
                                : "border-rose-500/40 bg-gradient-to-b from-rose-500/5 to-transparent dark:from-rose-500/10"
                        )}>
                            <div className={cn(
                                "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16",
                                proyeccionQuincena.alcanza ? "bg-emerald-500/10 dark:bg-emerald-500/20" : "bg-rose-500/10 dark:bg-rose-500/20"
                            )} />
                            <CardContent className="p-5 relative z-10 flex flex-col h-full">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-lg",
                                        proyeccionQuincena.alcanza ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-rose-500 text-white shadow-rose-500/30"
                                    )}>
                                        {proyeccionQuincena.alcanza ? '💰' : '⚠️'}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Proyección de la Quincena</p>
                                        <h3 className={cn("text-2xl font-black", proyeccionQuincena.alcanza ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                            {proyeccionQuincena.alcanza
                                                ? `Ganancia Libre: ${formatCurrency(proyeccionQuincena.saldoProyectado)}`
                                                : `Faltan: ${formatCurrency(proyeccionQuincena.deficit)}`}
                                        </h3>
                                    </div>
                                </div>
                                
                                <div className="bg-slate-100 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-3 mt-auto">
                                    <div className="flex justify-between items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_ventas')}>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-dashed border-slate-400/50">Ventas Esperadas (Total)</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400/80 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_costos')}>
                                        <span className="text-xs font-bold border-b border-dashed border-amber-400/50">(-) Costos de Reposición (50%)</span>
                                        <span className="text-sm font-black">-{formatCurrency(proyeccionQuincena.ingresoEsperado - proyeccionQuincena.utilidadBrutaEsperada)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-400/80 pb-3 border-b border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors" onClick={() => setDetallesModal('proyeccion_compromisos')}>
                                        <span className="text-xs font-bold border-b border-dashed border-rose-400/50">(-) Compromisos y Salarios</span>
                                        <span className="text-sm font-black">-{formatCurrency(proyeccionQuincena.totalCompromisos + proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Plata que te Sobra</span>
                                        <span className={cn("text-lg font-black", proyeccionQuincena.alcanza ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                            {proyeccionQuincena.alcanza ? formatCurrency(proyeccionQuincena.saldoProyectado) : `-${formatCurrency(proyeccionQuincena.deficit)}`}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>


                        {/* Sobres de Ahorro */}
                        <Card className="rounded-3xl border-2 border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-transparent dark:from-violet-500/10">
                            <CardContent className="p-5 flex flex-col h-full justify-between">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center shrink-0 text-xl text-violet-600 dark:text-violet-400">
                                        💌
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">Sobres Inteligentes</p>
                                        <h3 className="text-xl font-black text-violet-700 dark:text-violet-300">
                                            Ahorra {formatCurrency(proyeccionQuincena.cuotaDiariaAhorro)} / día
                                        </h3>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Separa esta cantidad diaria de la caja para que no sientas el golpe al pagar arriendo o salarios.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <div className="bg-slate-100 dark:bg-card/60 rounded-xl p-2.5 border border-black/5 dark:border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Compromisos Fijos</p>
                                        <p className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(proyeccionQuincena.totalCompromisos)}</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-card/60 rounded-xl p-2.5 border border-black/5 dark:border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Salarios</p>
                                        <p className="text-sm font-black text-amber-600 dark:text-amber-400">{formatCurrency(proyeccionQuincena.totalSalarios)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Columna izq — Compromisos fijos */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Compromisos Fijos</CardTitle>
                                <CardDescription className="text-xs">Arriendo, préstamos, servicios, salarios</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Formulario nuevo/edición de compromiso */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 border border-white/5">
                                    {(formCompromiso as any).id && (
                                        <div className="flex items-center justify-between bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                            <span className="text-[10px] font-black text-amber-500 uppercase">Modo Edición Activo</span>
                                            <Button 
                                                variant="ghost" 
                                                className="h-5 text-[9px] font-black text-rose-500 hover:text-rose-700 px-1"
                                                onClick={() => setFormCompromiso({
                                                    nombre: '', monto: '', categoria: 'Otros' as GastoCategoria,
                                                    diaDeCobro: '', esPropietario: false, persona: ''
                                                })}
                                            >
                                                Cancelar
                                            </Button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Nombre (Ej: Arriendo)" value={formCompromiso.nombre}
                                            onChange={e => setFormCompromiso(p => ({ ...p, nombre: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                        <Input placeholder="Monto ($)" type="number" value={formCompromiso.monto}
                                            onChange={e => setFormCompromiso(p => ({ ...p, monto: e.target.value }))}
                                            className="h-9 text-sm rounded-xl" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <select value={formCompromiso.frecuencia}
                                            onChange={e => setFormCompromiso(p => ({ ...p, frecuencia: e.target.value as any }))}
                                            className="h-9 text-xs rounded-xl border border-input bg-background px-2 font-bold">
                                            <option value="quincenal">Ambas quincenas (Ej. Nómina)</option>
                                            <option value="solo_q1">1ra Quincena (Días 1-15, Ej. Luz)</option>
                                            <option value="solo_q2">2da Quincena (Días 16-31, Ej. Agua)</option>
                                            <option value="mensual">Mensual (Día exacto inamovible)</option>
                                        </select>
                                        <Input placeholder="Día (1-31)" type="number" value={formCompromiso.diaDeCobro}
                                            onChange={e => setFormCompromiso(p => ({ ...p, diaDeCobro: e.target.value }))}
                                            className="h-9 text-xs rounded-xl"
                                            disabled={formCompromiso.frecuencia !== 'mensual'} 
                                            title="Solo aplica para pagos mensuales en un día exacto" />
                                        <select value={formCompromiso.categoria}
                                            onChange={e => setFormCompromiso(p => ({ ...p, categoria: e.target.value as GastoCategoria }))}
                                            className="h-9 text-xs rounded-xl border border-input bg-background px-2">
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
                                        <Plus className="w-4 h-4 mr-1" /> {(formCompromiso as any).id ? 'Actualizar compromiso' : 'Agregar compromiso'}
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
                                            <p className="text-[10px] text-muted-foreground">
                                                {c.frecuencia === 'quincenal' ? 'Ambas quincenas' : 
                                                 c.frecuencia === 'solo_q1' ? '1ra Quincena (Días 1-15)' :
                                                 c.frecuencia === 'solo_q2' ? '2da Quincena (Días 16-31)' :
                                                 `Mensual (Día ${c.diaDeCobro})`} · {c.categoria}
                                            </p>
                                        </div>
                                        <p className="text-sm font-black text-rose-400 shrink-0">{formatCurrency(c.monto)}</p>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    setFormCompromiso({
                                                        id: c.id,
                                                        nombre: c.nombre,
                                                        monto: c.monto.toString(),
                                                        categoria: c.categoria,
                                                        diaDeCobro: c.diaDeCobro.toString(),
                                                        esPropietario: !!c.esPropietario,
                                                        persona: c.persona || '',
                                                        frecuencia: c.frecuencia || 'mensual',
                                                    } as any);
                                                    toast.info("Compromiso cargado en el formulario para editar.");
                                                }}
                                                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 hover:underline shrink-0"
                                            >
                                                Editar
                                            </button>
                                            <button onClick={() => handleDeleteCompromiso(c.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Columna der — Registro de ventas del día */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Ventas del Día</CardTitle>
                                <CardDescription className="text-xs">Registro manual detallado por caja (efectivo) y otros métodos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3 border border-white/5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha</Label>
                                            <Input type="date" value={formVenta.fecha}
                                                onChange={e => setFormVenta(p => ({ ...p, fecha: e.target.value }))}
                                                className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Turno</Label>
                                            <select 
                                                value={formVenta.turno}
                                                onChange={e => setFormVenta(p => ({ ...p, turno: e.target.value as any }))}
                                                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors mt-1"
                                            >
                                                <option value="Día Completo">Día Completo</option>
                                                <option value="Mañana">Mañana</option>
                                                <option value="Tarde-Noche">Tarde-Noche</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Cajas Dinámicas */}
                                    <div className="space-y-2 border-t border-b border-white/5 py-2">
                                        <Label className="text-[10px] font-black uppercase text-amber-500">Efectivo por Cajas</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Principal */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">💰 Principal</Label>
                                                <Input
                                                    placeholder="Ej: 150.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Principal'] ? String(formVenta.cajas['Principal']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (formVenta.totalEfectivo || '')}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            totalEfectivo: String(val),
                                                            cajas: { ...(p.cajas || {}), 'Principal': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Helados */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍦 Helados</Label>
                                                <Input
                                                    placeholder="Ej: 50.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Helados'] ? String(formVenta.cajas['Helados']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Helados': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Mecato */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍿 Mecato / Snacks</Label>
                                                <Input
                                                    placeholder="Ej: 30.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Mecato'] ? String(formVenta.cajas['Mecato']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Mecato': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Michelada */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🍺 Michelada / Bebidas</Label>
                                                <Input
                                                    placeholder="Ej: 80.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Michelada'] ? String(formVenta.cajas['Michelada']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Michelada': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Tinto */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">☕ Tinto</Label>
                                                <Input
                                                    placeholder="Ej: 10.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Tinto'] ? String(formVenta.cajas['Tinto']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Tinto': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Fritos */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🥟 Fritos</Label>
                                                <Input
                                                    placeholder="Ej: 15.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Fritos'] ? String(formVenta.cajas['Fritos']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Fritos': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Tortas */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎂 Tortas</Label>
                                                <Input
                                                    placeholder="Ej: 60.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Tortas'] ? String(formVenta.cajas['Tortas']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Tortas': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Juegos */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎮 Juegos</Label>
                                                <Input
                                                    placeholder="Ej: 5.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Juegos'] ? String(formVenta.cajas['Juegos']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Juegos': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* PIÑATERIA */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">🎈 PIÑATERIA</Label>
                                                <Input
                                                    placeholder="Ej: 5.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['PIÑATERIA'] ? String(formVenta.cajas['PIÑATERIA']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'PIÑATERIA': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                            {/* Gastos/Salidas */}
                                            <div>
                                                <Label className="text-[9px] font-bold text-muted-foreground">💸 Gastos/Salidas</Label>
                                                <Input
                                                    placeholder="Ej: 10.000"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formVenta.cajas?.['Gastos/Salidas'] ? String(formVenta.cajas['Gastos/Salidas']).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        const val = parseInt(raw) || 0;
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), 'Gastos/Salidas': val }
                                                        }));
                                                    }}
                                                    className="h-9 text-sm rounded-xl mt-0.5"
                                                />
                                            </div>
                                        </div>

                                        {/* Cajas Extras añadidas — mismo estilo */}
                                        {formVenta.cajas && Object.keys(formVenta.cajas).filter(k => !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(k)).map(key => (
                                            <div key={key} className="grid grid-cols-2 gap-2 mt-1">
                                                <div className="col-span-2">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground">☕ {key}</Label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormVenta(p => {
                                                                const copy = { ...(p.cajas || {}) };
                                                                delete copy[key];
                                                                return { ...p, cajas: copy };
                                                            })}
                                                            className="text-[9px] text-rose-400 hover:text-rose-600 font-black transition-colors"
                                                        >✕ quitar</button>
                                                    </div>
                                                    <Input
                                                        placeholder={`Ej: 25.000`}
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={formVenta.cajas?.[key] ? String(formVenta.cajas[key]).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            const val = parseInt(raw) || 0;
                                                            setFormVenta(p => ({
                                                                ...p,
                                                                cajas: { ...(p.cajas || {}), [key]: val }
                                                            }));
                                                        }}
                                                        className="h-9 text-sm rounded-xl mt-0.5"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {/* Añadir Caja Extra */}
                                        <div className="flex gap-1.5 mt-2">
                                            <Input
                                                id="nueva_caja_nombre"
                                                placeholder="Nombre nueva caja (Ej: Piñatería)"
                                                className="h-8 text-xs rounded-xl"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        const inputName = (e.target as HTMLInputElement).value.trim();
                                                        if (inputName && !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(inputName)) {
                                                            setFormVenta(p => ({
                                                                ...p,
                                                                cajas: { ...(p.cajas || {}), [inputName]: 0 }
                                                            }));
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-xl px-2 text-xs font-black uppercase"
                                                onClick={() => {
                                                    const input = document.getElementById('nueva_caja_nombre') as HTMLInputElement;
                                                    const name = input?.value.trim();
                                                    if (name && !['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'].includes(name)) {
                                                        setFormVenta(p => ({
                                                            ...p,
                                                            cajas: { ...(p.cajas || {}), [name]: 0 }
                                                        }));
                                                        input.value = '';
                                                    }
                                                }}
                                            >
                                                + Caja
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Otros Métodos de Pago */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500">Otros Medios de Pago</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Input placeholder="Nequi ($)" type="number" value={formVenta.totalNequi}
                                                onChange={e => setFormVenta(p => ({ ...p, totalNequi: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                            <Input placeholder="Transf. ($)" type="number" value={formVenta.totalTransferencia}
                                                onChange={e => setFormVenta(p => ({ ...p, totalTransferencia: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                            <Input placeholder="Crédito ($)" type="number" value={formVenta.totalCredito}
                                                onChange={e => setFormVenta(p => ({ ...p, totalCredito: e.target.value }))}
                                                className="h-9 text-sm rounded-xl" />
                                        </div>
                                    </div>

                                    <Input placeholder="Notas (opcional)" value={formVenta.notas}
                                        onChange={e => setFormVenta(p => ({ ...p, notas: e.target.value }))}
                                        className="h-9 text-sm rounded-xl" />
                                        
                                    {/* Resumen de Totales */}
                                    <div className="bg-card/50 rounded-xl p-3 border border-white/10 space-y-2 mt-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-semibold">Total Principal + Nequi (Bruto):</span>
                                            <span className="font-bold text-slate-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    return formatCurrency(princ + nequi);
                                                })()}
                                            </span>
                                        </div>
                                        {formVenta.cajas?.['Gastos/Salidas'] > 0 && (
                                            <div className="flex justify-between items-center text-xs text-rose-400">
                                                <span className="font-semibold">Menos Gastos / Salidas:</span>
                                                <span className="font-bold">- {formatCurrency(formVenta.cajas['Gastos/Salidas'])}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                            <span className="text-muted-foreground font-semibold">Subtotal Princ + Nequi (Neto):</span>
                                            <span className="font-black text-indigo-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    const gastos = parseInt(String(formVenta.cajas?.['Gastos/Salidas'] || '0')) || 0;
                                                    return formatCurrency(princ + nequi - gastos);
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pb-1 mt-2">
                                            <span className="text-muted-foreground font-semibold">Total Otras Cajas:</span>
                                            <span className="font-black text-emerald-400">
                                                {(() => {
                                                    let sum = 0;
                                                    if (formVenta.cajas) {
                                                        Object.entries(formVenta.cajas).forEach(([k, v]) => {
                                                            if (k !== 'Principal' && k !== 'Gastos/Salidas') {
                                                                sum += (parseInt(String(v)) || 0);
                                                            }
                                                        });
                                                    }
                                                    return formatCurrency(sum);
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pt-1">
                                            <span className="font-black uppercase tracking-wider text-slate-300">Total General:</span>
                                            <span className="font-black text-amber-400">
                                                {(() => {
                                                    const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                                                    const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                                                    let sumOtras = 0;
                                                    let gastos = 0;
                                                    if (formVenta.cajas) {
                                                        Object.entries(formVenta.cajas).forEach(([k, v]) => {
                                                            if (k === 'Gastos/Salidas') gastos += (parseInt(String(v)) || 0);
                                                            else if (k !== 'Principal') sumOtras += (parseInt(String(v)) || 0);
                                                        });
                                                    }
                                                    return formatCurrency(princ + nequi + sumOtras - gastos);
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <Button onClick={handleAddVentaDiaria} size="sm" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 shadow-lg shadow-indigo-600/10">
                                        <Plus className="w-4 h-4 mr-1" /> Registrar cierre del día
                                    </Button>
                                </div>

                                {ventasDiarias.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin ventas registradas manualmente aún</p>
                                )}
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {ventasDiarias.slice(0, 30).map(v => {
                                        // Cálculos para la vista del historial
                                        const princ = v.totalEfectivo || 0; // en cajas.Principal o el viejo totalEfectivo
                                        const nequi = v.totalNequi || 0;
                                        const princMasNequi = princ + nequi;

                                        let sumOtras = 0;
                                        let gastos = 0;
                                        if (v.cajas) {
                                            Object.entries(v.cajas).forEach(([k, val]) => {
                                                if (k === 'Gastos/Salidas') {
                                                    gastos += (val || 0);
                                                } else if (k !== 'Principal') {
                                                    sumOtras += (val || 0);
                                                }
                                            });
                                        }
                                        const totalGeneral = princMasNequi + sumOtras - gastos + (v.totalTransferencia || 0) + (v.totalCredito || 0);

                                        return (
                                        <div key={v.id} className="flex flex-col gap-1.5 rounded-2xl p-3 bg-card/40 border border-white/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black">{new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                        {v.turno && v.turno !== 'Día Completo' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-sm">
                                                                {v.turno}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {v.notas && <p className="text-[10px] italic text-muted-foreground truncate mt-0.5">"{v.notas}"</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-emerald-400 shrink-0">{formatCurrency(totalGeneral)}</p>
                                                    <button 
                                                        onClick={() => {
                                                            // Normalizar llaves para evitar duplicados en cajas
                                                            const normalizedCajas: any = {};
                                                            if (v.cajas) {
                                                                const keyMap: any = {
                                                                    'principal': 'Principal', 'helados': 'Helados', 'helado': 'Helados',
                                                                    'mecato': 'Mecato', 'michelada': 'Michelada', 'bebidas': 'Michelada',
                                                                    'tinto': 'Tinto', 'fritos': 'Fritos', 'tortas': 'Tortas', 'torta': 'Tortas',
                                                                    'juegos': 'Juegos', 'juego': 'Juegos', 'piñateria': 'PIÑATERIA',
                                                                    'gastos': 'Gastos/Salidas', 'salidas': 'Gastos/Salidas', 'gastos/salidas': 'Gastos/Salidas'
                                                                };
                                                                Object.entries(v.cajas).forEach(([k, val]) => {
                                                                    const lowerK = k.toLowerCase().trim();
                                                                    const mappedKey = keyMap[lowerK] || k;
                                                                    normalizedCajas[mappedKey] = val;
                                                                });
                                                            }

                                                            // Cargar en el form para edición fácil
                                                            setFormVenta({
                                                                id: v.id,
                                                                fecha: v.fecha,
                                                                turno: v.turno || 'Día Completo',
                                                                totalEfectivo: v.totalEfectivo.toString() || '',
                                                                totalNequi: v.totalNequi.toString() || '',
                                                                totalTransferencia: v.totalTransferencia.toString() || '',
                                                                totalCredito: v.totalCredito.toString() || '',
                                                                notas: v.notas || '',
                                                                cajas: normalizedCajas
                                                            });
                                                            toast.info("Venta cargada en el formulario para editar. Vuelve a guardar para sobrescribir.");
                                                        }} 
                                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 hover:underline"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button onClick={() => handleDeleteVentaDiaria(v.id)} className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground border-t border-white/5 pt-2 flex flex-col gap-2">
                                                
                                                {/* Detalle agrupado que solicitó el usuario */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded text-xs font-black text-indigo-500 dark:text-indigo-300">
                                                        Princ+Nequi (Neto): {formatCurrency(princMasNequi - gastos)}
                                                    </span>
                                                    {gastos > 0 && (
                                                        <span className="bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded text-xs font-black text-rose-600 dark:text-rose-300">
                                                            Gastos: - {formatCurrency(gastos)}
                                                        </span>
                                                    )}
                                                    {sumOtras > 0 && (
                                                        <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-xs font-black text-emerald-600 dark:text-emerald-300">
                                                            Otras Cajas: {formatCurrency(sumOtras)}
                                                        </span>
                                                    )}
                                                    {v.totalTransferencia > 0 && (
                                                        <span className="bg-blue-50 dark:bg-blue-950/20 px-2 py-1 rounded text-xs font-black text-blue-600 dark:text-blue-400">
                                                            Transf: {formatCurrency(v.totalTransferencia)}
                                                        </span>
                                                    )}
                                                    {v.totalCredito > 0 && (
                                                        <span className="bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded text-xs font-black text-amber-600 dark:text-amber-400">
                                                            Cred: {formatCurrency(v.totalCredito)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Desglose individual de cajas pequeñas */}
                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                    {v.cajas && Object.entries(v.cajas).map(([k, val]) => val > 0 && k !== 'Principal' && k !== 'Gastos/Salidas' && (
                                                        <span key={k} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                            {k}: {formatCurrency(val)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Producción del Día ─────────────────────────────── */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black flex items-center gap-2">🍞 Producción del Día</CardTitle>
                                <CardDescription className="text-xs">Masa preparada (arrobas) y hornadas del día</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-4 border border-white/5">

                                    {/* Fecha */}
                                    <div>
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha</Label>
                                        <Input type="date" value={formProd.fecha}
                                            onChange={e => setFormProd(p => ({ ...p, fecha: e.target.value }))}
                                            className="h-9 text-sm rounded-xl mt-0.5" />
                                    </div>

                                    {/* Masas */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase text-amber-500">Masa Preparada (arrobas)</Label>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {masasPreparadas.map((m) => (
                                                <div key={m.id} className="flex gap-2 items-center bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-black/5 dark:border-white/5">
                                                    <div className="flex-1">
                                                        <Label className="text-[9px] font-bold text-muted-foreground sr-only">Nombre de Masa</Label>
                                                        <Input placeholder="Ej: Masa de Sal Mixta" type="text"
                                                            value={m.nombre}
                                                            onChange={e => handleMasaChange(m.id, 'nombre', e.target.value)}
                                                            className="h-8 text-xs rounded-lg" />
                                                    </div>
                                                    <div className="w-24">
                                                        <Label className="text-[9px] font-bold text-muted-foreground sr-only">Arrobas</Label>
                                                        <Input placeholder="0.0" type="text" inputMode="decimal"
                                                            value={m.cantidadArrobas || ''}
                                                            onChange={e => handleMasaChange(m.id, 'cantidadArrobas', e.target.value.replace(/[^0-9.]/g, ''))}
                                                            className="h-8 text-xs rounded-lg" />
                                                    </div>
                                                    <button type="button" onClick={() => handleRemoveMasa(m.id)}
                                                        className="h-8 px-2 text-rose-400 hover:text-rose-600 hover:bg-rose-400/10 rounded-lg transition-colors">
                                                        <span className="sr-only">Eliminar</span>✕
                                                    </button>
                                                </div>
                                            ))}
                                            
                                            <button type="button" onClick={handleAddMasa}
                                                className="w-full h-8 rounded-xl border border-dashed border-amber-500/30 text-[10px] font-black text-amber-600 hover:bg-amber-500/5 transition-colors">
                                                + Agregar Masa
                                            </button>
                                        </div>

                                        {/* Resumen de masa */}
                                        {masasPreparadas.length > 0 && (
                                            <p className="text-[10px] font-black text-amber-500 text-right mt-2">
                                                Total masa: {masasPreparadas.reduce((sum, m) => sum + (m.cantidadArrobas || 0), 0).toFixed(2)} arrobas
                                            </p>
                                        )}
                                    </div>

                                    {/* Hornadas */}
                                    <div className="space-y-2 border-t border-white/5 pt-3">
                                        <Label className="text-[10px] font-black uppercase text-indigo-400">Hornadas del Día</Label>
                                        {hornadas.map((h, i) => (
                                            <div key={i} className="bg-black/10 dark:bg-white/5 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[9px] font-black text-muted-foreground">Hornada #{i + 1}</Label>
                                                    {hornadas.length > 1 && (
                                                        <button type="button" onClick={() => handleRemoveHornada(i)}
                                                            className="text-[9px] text-rose-400 hover:text-rose-600 font-black">✕ quitar</button>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input placeholder="Tipo de pan (Ej: Queso, Mantequilla)" type="text"
                                                        value={h.tipoPan}
                                                        onChange={e => handleHornadaChange(i, 'tipoPan', e.target.value)}
                                                        className="h-8 text-xs rounded-xl flex-1" />
                                                    {masasPreparadas.length > 0 && (
                                                        <select
                                                            className="h-8 text-xs rounded-xl border border-input bg-background px-3 flex-1"
                                                            value={h.masaId || ''}
                                                            onChange={e => handleHornadaChange(i, 'masaId', e.target.value)}
                                                        >
                                                            <option value="">(Sin masa vinculada)</option>
                                                            {masasPreparadas.map(m => (
                                                                <option key={m.id} value={m.id}>{m.nombre || 'Sin nombre'}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-[9px] font-bold text-muted-foreground">Bandejas</Label>
                                                        <Input placeholder="12" type="text" inputMode="numeric"
                                                            value={h.bandejas || ''}
                                                            onChange={e => handleHornadaChange(i, 'bandejas', e.target.value.replace(/[^0-9]/g,''))}
                                                            className="h-8 text-xs rounded-xl mt-0.5" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[9px] font-bold text-muted-foreground">Panes/bandeja</Label>
                                                        <Input placeholder="20" type="text" inputMode="numeric"
                                                            value={h.panesPorBandeja || ''}
                                                            onChange={e => handleHornadaChange(i, 'panesPorBandeja', e.target.value.replace(/[^0-9]/g,''))}
                                                            className="h-8 text-xs rounded-xl mt-0.5" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[9px] font-bold text-emerald-400">🍞 Total panes</Label>
                                                        <div className="h-8 mt-0.5 flex items-center px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                            <span className="text-xs font-black text-emerald-400">{h.bandejas * h.panesPorBandeja || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={handleAddHornada}
                                            className="w-full h-8 rounded-xl border border-dashed border-indigo-400/30 text-[10px] font-black text-indigo-400 hover:bg-indigo-500/5 transition-colors">
                                            + Agregar otra hornada
                                        </button>
                                        {/* Resumen total panes */}
                                        {hornadas.some(h => h.totalPanes > 0) && (
                                            <p className="text-[10px] font-black text-emerald-400 text-right">
                                                Total panes del día: {hornadas.reduce((s, h) => s + (h.bandejas * h.panesPorBandeja), 0).toLocaleString('es-CO')}
                                            </p>
                                        )}
                                    </div>

                                    <Input placeholder="Notas (opcional)" value={formProd.notas}
                                        onChange={e => setFormProd(p => ({ ...p, notas: e.target.value }))}
                                        className="h-9 text-sm rounded-xl" />

                                    <Button onClick={handleSaveProduccion} size="sm" className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs h-9 shadow-lg shadow-amber-500/20">
                                        <Plus className="w-4 h-4 mr-1" /> Registrar producción del día
                                    </Button>
                                </div>

                                {/* Historial */}
                                {producciones.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">Sin producción registrada aún</p>
                                )}
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {producciones.slice(0, 30).map(p => {
                                        const totalMasa = p.masaDulce + p.masaHojaldrado + p.masaBatidoTorta + p.masaBatidoGalleta;
                                        const totalPanes = (p.hornadas || []).reduce((s, h) => s + h.totalPanes, 0);
                                        return (
                                            <div key={p.id} className="flex flex-col gap-1.5 rounded-2xl px-3 py-2.5 bg-card/40 border border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-sm font-black">{new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                        {totalMasa > 0 && <span className="ml-2 text-[10px] font-bold text-amber-400">{totalMasa.toFixed(2)} arr.</span>}
                                                        {totalPanes > 0 && <span className="ml-2 text-[10px] font-bold text-emerald-400">{totalPanes.toLocaleString('es-CO')} 🍞</span>}
                                                    </div>
                                                    <button onClick={() => { deleteProduccion(p.id); setProducciones(getProducciones()); }}
                                                        className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {(p.hornadas || []).map((h, i) => (
                                                        <span key={i} className="bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded text-[8px] font-bold text-indigo-500">
                                                            {h.tipoPan}: {h.bandejas}×{h.panesPorBandeja}={h.totalPanes}🍞
                                                        </span>
                                                    ))}
                                                    {p.notas && <span className="text-[8px] italic text-muted-foreground">— {p.notas}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── PLAN DE COMPRAS A PROVEEDORES ── */}
                    {presupuestosMinimos.length > 0 && (() => {
                        const getLimite = (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                        const comprasSemana   = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Semanal');
                        const comprasQuincena = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Quincenal');
                        const comprasMes      = presupuestosMinimos.filter((i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal');
                        const totalSem  = comprasSemana.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalQuin = comprasQuincena.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalMes  = comprasMes.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalCiclo = totalSem + totalQuin + totalMes;
                        const yaComprado = presupuestosMinimos.filter((i: any) => i.estado === 'completado').reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalPendiente = totalCiclo - yaComprado;
                        return (
                            <Card className="rounded-3xl border border-amber-500/20 bg-amber-950/10">
                                <CardHeader className="pb-3 border-b border-amber-500/10">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <CardTitle className="text-base font-black flex items-center gap-2">🛒 Plan de Compras a Proveedores</CardTitle>
                                            <CardDescription className="text-xs mt-0.5">Configurado en Presupuestos · {temporadaBaja ? '❄️ Temporada Baja' : '🔥 Temporada Alta'}</CardDescription>
                                        </div>
                                        <button onClick={() => setActiveTab('compras-minimas')}
                                            className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-all">
                                            Gestionar →
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-xl p-2 bg-card/40 border border-white/5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Total Ciclo</p>
                                            <p className="text-base font-black">{formatCurrency(totalCiclo)}</p>
                                        </div>
                                        <div className="rounded-xl p-2 bg-emerald-950/20 border border-emerald-500/20">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">✓ Comprado</p>
                                            <p className="text-base font-black text-emerald-400">{formatCurrency(yaComprado)}</p>
                                        </div>
                                        <div className="rounded-xl p-2 bg-rose-950/20 border border-rose-500/20">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">⏳ Pendiente</p>
                                            <p className="text-base font-black text-rose-400">{formatCurrency(totalPendiente)}</p>
                                        </div>
                                    </div>
                                    {totalCiclo > 0 && (
                                        <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, (yaComprado / totalCiclo) * 100)}%` }} />
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    {[
                                        { label: '📅 Esta Semana', items: comprasSemana, total: totalSem, color: 'text-amber-400' },
                                        { label: '📆 Esta Quincena', items: comprasQuincena, total: totalQuin, color: 'text-violet-400' },
                                        { label: '🗓️ Este Mes', items: comprasMes, total: totalMes, color: 'text-blue-400' },
                                    ].filter(g => g.items.length > 0).map(grupo => (
                                        <div key={grupo.label}>
                                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", grupo.color)}>{grupo.label} — {formatCurrency(grupo.total)}</p>
                                            <div className="space-y-1.5">
                                                {grupo.items.map((item: any) => (
                                                    <div key={item.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2 border text-sm transition-all",
                                                        item.estado === 'completado' ? "border-emerald-500/20 bg-emerald-950/10 opacity-60" : "border-white/5 bg-card/30")}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("w-2 h-2 rounded-full shrink-0", item.estado === 'completado' ? "bg-emerald-500" : "bg-rose-500")} />
                                                            <span className="font-bold">{item.proveedor}</span>
                                                            {item.nota && <span className="text-[10px] text-muted-foreground hidden sm:inline">— {item.nota}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black">{formatCurrency(getLimite(item))}</span>
                                                            <button
                                                                onClick={() => {
                                                                    const updated = presupuestosMinimos.map((l: any) => l.id === item.id ? { ...l, estado: l.estado === 'completado' ? 'pendiente' : 'completado' } : l);
                                                                    setPresupuestosMinimos(updated);
                                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                }}
                                                                className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-lg transition-all",
                                                                    item.estado === 'completado' ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400" : "bg-rose-500/10 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-400")}
                                                            >{item.estado === 'completado' ? '✓ OK' : '⏳ Marcar'}</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        );
                    })()}
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB: PRESUPUESTOS (COMPRAS)
                ══════════════════════════════════════════════════ */}
                <TabsContent value="compras-minimas" className="space-y-6 mt-0">
                    {/* Header de Temporada */}
                    <Card className={cn("rounded-3xl border border-white/5 shadow-none", temporadaBaja ? "bg-cyan-950/40 border-cyan-500/20" : "bg-orange-950/40 border-orange-500/20")}>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    {temporadaBaja ? <Snowflake className="w-5 h-5 text-cyan-400" /> : <Flame className="w-5 h-5 text-orange-500" />}
                                    Temporada Actual: {temporadaBaja ? "Baja (Límites Estrictos)" : "Alta (Flujo Normal)"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Activar la temporada baja aplicará el presupuesto reducido en tus compras para cuidar la liquidez.
                                </p>
                            </div>
                            <Button 
                                onClick={() => setTemporadaBaja(!temporadaBaja)}
                                variant={temporadaBaja ? "default" : "outline"}
                                className={cn("rounded-2xl font-black h-12 px-6", temporadaBaja ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "border-orange-500/50 text-orange-500 hover:bg-orange-500/10")}
                            >
                                Cambiar a Temporada {temporadaBaja ? "Alta" : "Baja"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* ── PANEL RESUMEN DE INVERSIÓN ── */}
                    {presupuestosMinimos.length > 0 && (() => {
                        const getLimite = (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                        const getComprado = (item: any) => {
                            if (!item.proveedorId && !item.productoId) return item.estado === 'completado' ? getLimite(item) : 0;
                            const gastosRel = gastos.filter(g => 
                                (item.proveedorId && g.proveedorId === item.proveedorId) ||
                                (item.id && (g as any).presupuestoId === item.id)
                            );
                            const sumaGastos = gastosRel.reduce((sum, g) => sum + g.monto, 0);
                            return sumaGastos > 0 ? sumaGastos : (item.estado === 'completado' ? getLimite(item) : 0);
                        };

                        const semanales   = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Semanal');
                        const quincenales = presupuestosMinimos.filter((i: any) => i.frecuencia === 'Quincenal');
                        const mensuales   = presupuestosMinimos.filter((i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal');
                        const totalSem    = semanales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalQuin   = quincenales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalMen    = mensuales.reduce((s: number, i: any) => s + getLimite(i), 0);
                        const totalGeneral = totalSem + totalQuin + totalMen;
                        const compradoTotal = presupuestosMinimos.reduce((s: number, i: any) => s + getComprado(i), 0);
                        const pendienteTotal = Math.max(0, totalGeneral - compradoTotal);
                        const pctComprado = totalGeneral > 0 ? Math.min(100, (compradoTotal / totalGeneral) * 100) : 0;
                        return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2 rounded-2xl p-4 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">💼 Total Inversión en el Ciclo</p>
                                    <p className="text-2xl font-black text-foreground">{formatCurrency(totalGeneral)}</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctComprado}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-1 text-[9px] font-bold">
                                        <span className="text-emerald-400">✓ Ya comprado: {formatCurrency(compradoTotal)}</span>
                                        <span className="text-rose-400">⏳ Pendiente: {formatCurrency(pendienteTotal)}</span>
                                    </div>
                                </div>
                                {totalSem > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">📅 Semanal</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalSem)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{semanales.length} proveedor{semanales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                                {totalQuin > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">📆 Quincenal</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalQuin)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{quincenales.length} proveedor{quincenales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                                {totalMen > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/30 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">🗓️ Mensual</p>
                                        <p className="text-lg font-black text-foreground">{formatCurrency(totalMen)}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1">{mensuales.length} proveedor{mensuales.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Formulario */}
                        <Card className="rounded-3xl border-white/5 bg-card/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-black">Nuevo Presupuesto</CardTitle>
                                <CardDescription className="text-xs">Establece límites para no sobrecomprar</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Proveedor o Insumo</Label>
                                        <Input id="compra_proveedor" list="proveedores-insumos-list" placeholder="Ej: Postobón, Huevos..." className="h-9 text-sm rounded-xl mt-1" />
                                        <datalist id="proveedores-insumos-list">
                                            {proveedores?.map(p => <option key={`prov_${p.id}`} value={p.nombre}>Proveedor</option>)}
                                            {productos?.filter(p => p.tipo === 'ingrediente').map(p => <option key={`prod_${p.id}`} value={p.nombre}>Insumo</option>)}
                                        </datalist>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Presup. Base ($)</Label>
                                            <Input id="compra_monto" type="number" placeholder="Ej: 500000" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Presup. Baja ($)</Label>
                                            <Input id="compra_baja" type="number" placeholder="Opcional" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Frecuencia</Label>
                                            <select id="compra_frecuencia" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="Semanal">Semanal</option>
                                                <option value="Quincenal">Quincenal</option>
                                                <option value="Mensual">Mensual</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Día Preventa</Label>
                                            <select id="compra_dia_pedido" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="">No definido</option>
                                                {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Llega Pedido / Pago</Label>
                                            <select id="compra_dia_pago" className="h-9 text-sm rounded-xl border border-input bg-background px-2 w-full mt-1">
                                                <option value="">No definido</option>
                                                {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nota</Label>
                                            <Input id="compra_nota" placeholder="Opcional" className="h-9 text-sm rounded-xl mt-1" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <Button 
                                            onClick={() => {
                                                const prov = (document.getElementById('compra_proveedor') as HTMLInputElement)?.value.trim();
                                                const montoRaw = parseFloat((document.getElementById('compra_monto') as HTMLInputElement)?.value) || 0;
                                                const bajaVal = (document.getElementById('compra_baja') as HTMLInputElement)?.value;
                                                const bajaNum = bajaVal ? parseFloat(bajaVal) : 0;
                                                const monto = montoRaw > 0 ? montoRaw : bajaNum;
                                                const baja = bajaNum > 0 ? bajaNum : monto;
                                                const frec = (document.getElementById('compra_frecuencia') as HTMLSelectElement)?.value;
                                                const diaPed = (document.getElementById('compra_dia_pedido') as HTMLSelectElement)?.value;
                                                const diaPag = (document.getElementById('compra_dia_pago') as HTMLSelectElement)?.value;
                                                const nota = (document.getElementById('compra_nota') as HTMLInputElement)?.value.trim();

                                                if (!prov) {
                                                    toast.error('El nombre del proveedor o insumo es requerido');
                                                    return;
                                                }
                                                if (monto <= 0) {
                                                    toast.error('Ingresa al menos un valor de presupuesto (Base o Baja)');
                                                    return;
                                                }

                                                // Match IDs for advanced syncing
                                                const provLower = prov.toLowerCase();
                                                const proveedorId = proveedores?.find(p => p.nombre.toLowerCase() === provLower)?.id;
                                                const productoId = productos?.find(p => p.tipo === 'ingrediente' && p.nombre.toLowerCase() === provLower)?.id;

                                                if (editCompraId) {
                                                    const updated = presupuestosMinimos.map((l: any) => l.id === editCompraId ? {
                                                        ...l, proveedor: prov, proveedorId, productoId, monto, montoBaja: baja, frecuencia: frec, diaPedido: diaPed, diaPago: diaPag, nota
                                                    } : l);
                                                    setPresupuestosMinimos(updated);
                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                    setEditCompraId(null);
                                                    toast.success('Presupuesto actualizado');
                                                } else {
                                                    const nueva = {
                                                        id: Math.random().toString(36).substring(2, 9),
                                                        proveedor: prov,
                                                        proveedorId,
                                                        productoId,
                                                        monto,
                                                        montoBaja: baja,
                                                        frecuencia: frec,
                                                        diaPedido: diaPed,
                                                        diaPago: diaPag,
                                                        nota,
                                                        estado: 'pendiente'
                                                    };
                                                    const updated = [...presupuestosMinimos, nueva];
                                                    setPresupuestosMinimos(updated);
                                                    localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                    toast.success('Presupuesto registrado');
                                                }
                                                
                                                // Reset inputs
                                                (document.getElementById('compra_proveedor') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_monto') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_baja') as HTMLInputElement).value = '';
                                                (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = 'Semanal';
                                                (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = '';
                                                (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = '';
                                                (document.getElementById('compra_nota') as HTMLInputElement).value = '';
                                            }}
                                            size="sm" 
                                            className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-9"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> {editCompraId ? 'Actualizar' : 'Añadir'}
                                        </Button>
                                        {editCompraId && (
                                            <Button
                                                onClick={() => {
                                                    setEditCompraId(null);
                                                    (document.getElementById('compra_proveedor') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_monto') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_baja') as HTMLInputElement).value = '';
                                                    (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = 'Semanal';
                                                    (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = '';
                                                    (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = '';
                                                    (document.getElementById('compra_nota') as HTMLInputElement).value = '';
                                                }}
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-xl text-rose-500 font-black text-xs h-9"
                                            >
                                                Cancelar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Listas de control */}
                        <div className="lg:col-span-2 space-y-6">
                            {(() => {
                                const renderList = (title: string, icon: any, filterFn: (i: any) => boolean) => {
                                    const filtered = presupuestosMinimos.filter(filterFn);
                                    if (filtered.length === 0) return null;
                                    return (
                                        <Card className="rounded-3xl border-white/5 bg-card/30">
                                            <CardHeader className="pb-3 bg-white/5 rounded-t-3xl border-b border-white/5">
                                                <CardTitle className="text-sm font-black flex items-center gap-2">
                                                    {icon} {title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-3 space-y-2">
                                                {filtered.map((item: any) => {
                                                    const limiteActual = temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto;
                                                    return (
                                                        <div key={item.id} className={cn("flex items-center gap-3 rounded-2xl p-3 border transition-colors", item.estado === 'completado' ? "border-emerald-500/30 bg-emerald-950/10" : temporadaBaja ? "border-cyan-500/20 bg-cyan-950/10" : "border-white/5 bg-card/20")}>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-black text-foreground truncate">{item.proveedor}</span>
                                                                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full", item.frecuencia === 'Semanal' ? "bg-amber-500/20 text-amber-400" : item.frecuencia === 'Quincenal' ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400")}>{item.frecuencia}</span>
                                                                </div>
                                                                {(item.diaPedido || item.diaPago) && (
                                                                    <p className="text-[9px] text-muted-foreground mt-0.5 font-bold">
                                                                        {item.diaPedido && `📝 Preventa: ${item.diaPedido}`} {item.diaPedido && item.diaPago && ' | '} {item.diaPago && `🚚 Llega y Pago: ${item.diaPago}`}
                                                                    </p>
                                                                )}
                                                                {item.nota && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">"{item.nota}"</p>}
                                                            </div>
                                                            <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                                                <div className="flex items-center gap-2">
                                                                    {temporadaBaja && item.montoBaja !== undefined && item.montoBaja < item.monto && (
                                                                        <span className="text-[10px] line-through text-muted-foreground">{formatCurrency(item.monto)}</span>
                                                                    )}
                                                                    <p className={cn("text-sm font-black", temporadaBaja ? "text-cyan-500" : "text-foreground")}>
                                                                        {formatCurrency(limiteActual)}
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-2 items-center mt-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = presupuestosMinimos.map((l: any) => l.id === item.id ? { ...l, estado: l.estado === 'completado' ? 'pendiente' : 'completado' } : l);
                                                                            setPresupuestosMinimos(updated);
                                                                            localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                        }}
                                                                        className={cn("text-[9px] font-bold px-2 py-1 rounded-lg uppercase transition-all", 
                                                                            item.estado === 'completado' ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400" : "bg-rose-500/10 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-400")}
                                                                    >
                                                                        {item.estado === 'completado' ? '✓ Comprado' : '⏳ Pendiente'}
                                                                    </button>
                                                                    <button 
                                                                        className="text-indigo-400 hover:text-indigo-300 p-1 font-bold text-[9px] uppercase tracking-wider"
                                                                        onClick={() => {
                                                                            setEditCompraId(item.id);
                                                                            (document.getElementById('compra_proveedor') as HTMLInputElement).value = item.proveedor;
                                                                            (document.getElementById('compra_monto') as HTMLInputElement).value = item.monto.toString();
                                                                            (document.getElementById('compra_baja') as HTMLInputElement).value = item.montoBaja ? item.montoBaja.toString() : '';
                                                                            (document.getElementById('compra_frecuencia') as HTMLSelectElement).value = item.frecuencia;
                                                                            (document.getElementById('compra_dia_pedido') as HTMLSelectElement).value = item.diaPedido || '';
                                                                            (document.getElementById('compra_dia_pago') as HTMLSelectElement).value = item.diaPago || '';
                                                                            (document.getElementById('compra_nota') as HTMLInputElement).value = item.nota || '';
                                                                            // Scroll to top of tab
                                                                            document.getElementById('compra_proveedor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                            toast.info('Modificando presupuesto...');
                                                                        }}
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                    <button 
                                                                        className="text-rose-500 hover:text-rose-400 p-1"
                                                                        onClick={() => {
                                                                            const updated = presupuestosMinimos.filter((l: any) => l.id !== item.id);
                                                                            setPresupuestosMinimos(updated);
                                                                            localStorage.setItem('dp_compras_minimas', JSON.stringify(updated));
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    );
                                };

                                return (
                                    <>
                                        {renderList("Control Semanal", <CalendarDays className="w-4 h-4 text-amber-500" />, (i: any) => i.frecuencia === 'Semanal')}
                                        {renderList("Control Quincenal", <CalendarRange className="w-4 h-4 text-violet-500" />, (i: any) => i.frecuencia === 'Quincenal')}
                                        {renderList("Control Mensual / Otros", <List className="w-4 h-4 text-blue-500" />, (i: any) => i.frecuencia !== 'Semanal' && i.frecuencia !== 'Quincenal')}
                                        {presupuestosMinimos.length === 0 && (
                                            <div className="text-center py-12 border border-dashed rounded-3xl border-white/10 flex flex-col items-center gap-3">
                                                <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                                                <p className="text-sm font-medium text-muted-foreground">No hay presupuestos registrados.</p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Motor Predictivo de Inventario */}
                    <Card className="rounded-3xl border border-white/5 bg-card/30 mt-6">
                        <CardHeader className="pb-3 border-b border-white/5 bg-gradient-to-r from-blue-950/20 to-purple-950/20 rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-black flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-blue-400" />
                                        Asistente Predictivo de Pedidos
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Analiza la velocidad de ventas y sugiere cuánto pedir para no quedarte sin stock
                                    </CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="rounded-xl h-9 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => generarSugerencias()}
                                    disabled={loadingSugerencias}
                                >
                                    {loadingSugerencias ? 'Analizando...' : 'Recalcular'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            {loadingSugerencias ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                    <p className="text-sm text-muted-foreground">Calculando algoritmos de rotación...</p>
                                </div>
                            ) : sugerenciasPedido.length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No hay sugerencias de pedido. ¡Tu inventario está perfecto!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {sugerenciasPedido.map(sug => {
                                        let cantidadFinal = sug.cantidadSugeridaTotal;
                                        if (temporadaBaja) {
                                            // Reducimos 20% en temporada baja
                                            cantidadFinal = Math.max(0, Math.floor(cantidadFinal * 0.8));
                                        }

                                        let pacas = 0;
                                        let sueltas = cantidadFinal;
                                        if (sug.cantidadEmbalaje && sug.cantidadEmbalaje > 1) {
                                            pacas = Math.floor(cantidadFinal / sug.cantidadEmbalaje);
                                            sueltas = cantidadFinal % sug.cantidadEmbalaje;
                                        }

                                        return (
                                            <div key={sug.productoId} className={cn("p-4 rounded-2xl border transition-colors relative overflow-hidden", 
                                                sug.diasAgotado > 0 ? "border-rose-500/30 bg-rose-950/10" : "border-white/5 bg-card/40"
                                            )}>
                                                {sug.diasAgotado > 0 && (
                                                    <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">
                                                        Agotado hace {sug.diasAgotado} días
                                                    </div>
                                                )}
                                                
                                                <h4 className="text-sm font-black text-foreground mb-1 pr-16 truncate" title={sug.productoNombre}>
                                                    {sug.productoNombre}
                                                </h4>
                                                
                                                <div className="flex items-center justify-between mt-3 text-xs">
                                                    <div className="text-muted-foreground">
                                                        Stock: <span className="font-bold text-foreground">{sug.stockActual}</span>
                                                    </div>
                                                    <div className="text-muted-foreground text-right">
                                                        Venta D.: <span className="font-bold text-foreground">{sug.velocidadDiaria}/día</span>
                                                    </div>
                                                </div>

                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <p className="text-[10px] uppercase font-black text-blue-400 mb-1">
                                                        {temporadaBaja ? 'Sugerencia (Modo Baja)' : 'Sugerencia Ideal'}
                                                    </p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-foreground">{cantidadFinal}</span>
                                                        <span className="text-xs text-muted-foreground">unidades totales</span>
                                                    </div>
                                                    
                                                    {sug.cantidadEmbalaje && pacas > 0 && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-1 rounded-md w-fit">
                                                            <Package className="w-3.5 h-3.5" />
                                                            Pedir: {pacas} {sug.tipoEmbalaje || 'Paca'}{pacas !== 1 ? 's' : ''} {sueltas > 0 ? `+ ${sueltas} und` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 5.5: ARQUEO DE CAJAS
                ══════════════════════════════════════════════════ */}
                <TabsContent value="arqueo-cajas" className="space-y-6 mt-0">
                    <ArqueoCajas ventasDiarias={ventasDiarias} />
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

            {/* Modal Detalles Tarjetas */}
            <Dialog open={!!detallesModal} onOpenChange={(open) => !open && setDetallesModal(null)}>
                <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10 rounded-[2rem] p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            {detallesModal === 'ingresos' && 'Desglose de Ingresos'}
                            {detallesModal === 'proveedores' && 'Tope de Proveedores'}
                            {detallesModal === 'fijos' && 'Gastos Fijos y Nómina'}
                            {detallesModal === 'diarios' && 'Gastos Operativos (Diarios)'}
                            {detallesModal === 'neta' && 'Ganancia Neta'}
                            {detallesModal === 'ventas_hoy' && 'Detalle Ventas de Hoy'}
                            {detallesModal === 'proyeccion_ventas' && 'Proyección de Ventas'}
                            {detallesModal === 'proyeccion_costos' && 'Proyección de Costos'}
                            {detallesModal === 'proyeccion_compromisos' && 'Proyección de Compromisos'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                            {detallesModal === 'ingresos' && 'Suma total del efectivo de cajas y métodos digitales de las ventas de la quincena.'}
                            {detallesModal === 'proveedores' && 'Lista de todos los presupuestos activos proyectados como tope para esta quincena.'}
                            {detallesModal === 'fijos' && 'Compromisos fijos que tocan pago en esta quincena.'}
                            {detallesModal === 'diarios' && 'Salidas de caja diarias durante el turno.'}
                            {detallesModal === 'neta' && 'Cálculo final: Ingresos - (Proveedores + Fijos + Diarios).'}
                            {detallesModal === 'ventas_hoy' && 'Desglose exacto de las ventas registradas el día de hoy.'}
                            {detallesModal === 'proyeccion_ventas' && 'Cálculo estimado basado en tu promedio de ventas diarias y los días que faltan para terminar la quincena.'}
                            {detallesModal === 'proyeccion_costos' && 'Se asume que la mitad de lo vendido se reinvierte en materia prima para seguir produciendo.'}
                            {detallesModal === 'proyeccion_compromisos' && 'La suma de tus deudas, servicios y salarios programados para estos 15 días.'}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {detallesModal === 'ingresos' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <span className="text-sm font-bold text-emerald-400">Ingreso por Ventas POS</span>
                                    <span className="text-sm font-black text-emerald-500">{formatCurrency(quincenaReal.ventasTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                                    <span className="text-sm font-bold text-rose-400">Reintegro de Gastos Diarios</span>
                                    <span className="text-sm font-black text-rose-500">+{formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL INGRESOS BRUTOS</span>
                                    <span className="text-lg font-black text-emerald-400">{formatCurrency(diagnosticoFinanciero.ingresos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proveedores' && (
                            <div className="space-y-2">
                                {presupuestosMinimos.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay presupuestos activos</p>}
                                {presupuestosMinimos.map((p: any, i: number) => {
                                    const limite = temporadaBaja && p.montoBaja !== undefined ? p.montoBaja : p.monto;
                                    let multiplicador = 1;
                                    if (periodoFiltro.quincena === 'mes') {
                                        if (p.frecuencia === 'Semanal') multiplicador = 4;
                                        else if (p.frecuencia === 'Quincenal') multiplicador = 2;
                                    } else {
                                        if (p.frecuencia === 'Semanal') multiplicador = 2;
                                        else if (p.frecuencia === 'Mensual') multiplicador = 0.5;
                                    }
                                    const proyectado = limite * multiplicador;
                                    return (
                                        <div key={i} className="flex flex-col bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{p.proveedor} <span className="text-[9px] font-normal uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">{p.frecuencia}</span></p>
                                                <span className="text-sm font-black text-amber-500">{formatCurrency(limite)}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <p className="text-[10px] text-muted-foreground italic">Se paga al recibir pedido</p>
                                                <p className="text-[10px] text-slate-400">Total {periodoFiltro.quincena === 'mes' ? 'mes' : 'quincena'}: <strong className="text-slate-500 dark:text-slate-300">{formatCurrency(proyectado)}</strong></p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL TOPE PROVEEDORES</span>
                                    <span className="text-lg font-black text-amber-500">{formatCurrency(diagnosticoFinanciero.compras)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'fijos' && (
                            <div className="space-y-2">
                                {compromisos.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay compromisos fijos activos</p>}
                                {compromisos.filter(c => c.activo).map((c, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{c.nombre}</p>
                                            <p className="text-[10px] text-muted-foreground">{c.categoria} - Día {c.diaDeCobro}</p>
                                        </div>
                                        <span className="text-sm font-black text-violet-500">{formatCurrency(c.monto)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL GASTOS FIJOS</span>
                                    <span className="text-lg font-black text-violet-500">{formatCurrency(diagnosticoFinanciero.fijos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'diarios' && (
                            <div className="space-y-2">
                                {ventasDiarias.filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr && v.cajas && v.cajas['Gastos/Salidas']).length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay gastos diarios en este periodo</p>}
                                {ventasDiarias
                                    .filter(v => v.fecha >= quincenaReal.inicioStr && v.fecha <= quincenaReal.finStr && v.cajas && v.cajas['Gastos/Salidas'])
                                    .map((v, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-card/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white">{v.fecha}</p>
                                                <p className="text-[10px] text-muted-foreground">Turno: {v.turno}</p>
                                            </div>
                                            <span className="text-sm font-black text-rose-500">{formatCurrency(v.cajas!['Gastos/Salidas'])}</span>
                                        </div>
                                    ))}
                                <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL GASTOS DIARIOS</span>
                                    <span className="text-lg font-black text-rose-500">{formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'neta' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <span className="text-sm font-bold text-emerald-400">Total Ingresos</span>
                                    <span className="text-sm font-black text-emerald-500">{formatCurrency(diagnosticoFinanciero.ingresos)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                    <span className="text-sm font-bold text-amber-400">- Proveedores (Tope)</span>
                                    <span className="text-sm font-black text-amber-500">- {formatCurrency(diagnosticoFinanciero.compras)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-violet-500/10 p-3 rounded-xl border border-violet-500/20">
                                    <span className="text-sm font-bold text-violet-400">- Gastos Fijos</span>
                                    <span className="text-sm font-black text-violet-500">- {formatCurrency(diagnosticoFinanciero.fijos)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                                    <span className="text-sm font-bold text-rose-400">- Gastos Diarios</span>
                                    <span className="text-sm font-black text-rose-500">- {formatCurrency(diagnosticoFinanciero.operativos)}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-card/60 rounded-2xl border border-slate-200 dark:border-white/10 mt-4 shadow-lg">
                                    <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Ganancia Neta Real</span>
                                    <span className={cn("text-2xl font-black", diagnosticoFinanciero.gananciaNeta >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {formatCurrency(diagnosticoFinanciero.gananciaNeta)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'ventas_hoy' && (
                            <div className="space-y-4 pt-2">
                                {(() => {
                                    const ventasPOSHoy = ventas.filter(v => v.fecha.slice(0, 10) === quincenaReal.hoyStr);
                                    const totalPOSHoy = ventasPOSHoy.reduce((sum, v) => sum + v.total, 0);
                                    const ventasManualesHoy = ventasDiarias.filter(v => v.fecha === quincenaReal.hoyStr);
                                    const totalManualHoy = ventasManualesHoy.reduce((sum, v) => sum + v.total, 0);
                                    
                                    return (
                                        <>
                                            <div className="bg-card/40 rounded-xl p-4 border border-white/5">
                                                <h4 className="text-xs font-black uppercase text-amber-500 mb-3 flex justify-between">
                                                    <span>Cierres de Turno (Manual)</span>
                                                    <span>{formatCurrency(totalManualHoy)}</span>
                                                </h4>
                                                {ventasManualesHoy.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center italic">No hay cierres de caja hoy</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {ventasManualesHoy.map(v => (
                                                            <div key={v.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                                <div>
                                                                    <span className="font-bold">{v.turno || 'Turno'}</span>
                                                                    {v.hora && <span className="text-[10px] text-muted-foreground ml-2">({v.hora})</span>}
                                                                </div>
                                                                <span className="font-black text-amber-400">+{formatCurrency(v.total)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-card/40 rounded-xl p-4 border border-white/5">
                                                <h4 className="text-xs font-black uppercase text-emerald-500 mb-3 flex justify-between">
                                                    <span>Ventas Directas POS</span>
                                                    <span>{formatCurrency(totalPOSHoy)}</span>
                                                </h4>
                                                {ventasPOSHoy.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center italic">No hay ventas directas hoy</p>
                                                ) : (
                                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                                        {ventasPOSHoy.map(v => (
                                                            <div key={v.id} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                                                                <span className="truncate text-muted-foreground">{v.items?.map(i => i.cantidad + 'x ' + (productos?.find(p => p.id === i.productoId)?.nombre || 'Item')).join(', ')}</span>
                                                                <span className="font-black text-emerald-400 shrink-0 ml-2">+{formatCurrency(v.total)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center pt-2 px-2 border-t border-white/10">
                                                <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Total Día</span>
                                                <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalManualHoy + totalPOSHoy)}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {detallesModal === 'proyeccion_ventas' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Calculamos cuánto venderás en total esta quincena tomando tu promedio diario de ventas y multiplicándolo por los días que faltan.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Ventas reales hasta hoy:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(quincenaReal.ventasTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Promedio de venta diaria:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(quincenaReal.ventasTotal / quincenaReal.diasTranscurridos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Días restantes del periodo:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{Math.max(0, quincenaReal.totalDiasPeriodo - quincenaReal.diasTranscurridos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 font-black">
                                        <span>Total Proyectado:</span> 
                                        <span>{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proyeccion_costos' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Todo negocio de panadería tiene costos fijos de insumos (harina, huevos, etc). Por seguridad financiera, el sistema aparta automáticamente el 50% de las ventas como costo de reposición.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Ventas Proyectadas:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(proyeccionQuincena.ingresoEsperado)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-400 font-black">
                                        <span>Costo a reponer (50%):</span> 
                                        <span>-{formatCurrency(proyeccionQuincena.ingresoEsperado - proyeccionQuincena.utilidadBrutaEsperada)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {detallesModal === 'proyeccion_compromisos' && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Esta es la suma del dinero que debe salir obligatoriamente en esta quincena para cumplir tus obligaciones operativas y legales.
                                </p>
                                <div className="bg-slate-50 dark:bg-card/40 rounded-xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Compromisos Fijos (arriendos, servicios, etc):</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency(proyeccionQuincena.totalCompromisos)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Nómina y Salarios:</span> 
                                        <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency(proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10 text-rose-600 dark:text-rose-400 font-black">
                                        <span>Total Obligaciones:</span> 
                                        <span>-{formatCurrency(proyeccionQuincena.totalCompromisos + proyeccionQuincena.totalSalarios)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
