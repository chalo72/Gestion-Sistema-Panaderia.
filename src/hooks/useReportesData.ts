
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
    getProducciones, addProduccion, deleteProduccion, saveProducciones, fechaLocalHoy, normalizarFechaYYYYMMDD
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
    modelosPan?: { nombre: string; piezasPorLata?: number }[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];



/** Costo de lo vendido (COGS) = Σ costoBase × cantidad de ítems del periodo. */
const calcCostoVendidos = (
    ventasLista: ReportesProps['ventas'],
    productosLista: NonNullable<ReportesProps['productos']>,
    periodo: string
): number => {
    const ventasPeriodo = ventasLista.filter(v => v.fecha.startsWith(periodo));
    const costo = ventasPeriodo.reduce((sum, v) => {
        return sum + (v.items ?? []).reduce((s, item) => {
            const prod = productosLista.find(p => p.id === item.productoId);
            const costoUnit = Number(prod?.costoBase) || 0;
            const qty = Number(item.cantidad) || 0;
            return s + costoUnit * qty;
        }, 0);
    }, 0);
    return Math.round(costo * 100) / 100;
};

/** Utilidad bruta = ventas − COGS (no resta gastos operativos). */
const aplicarCogsAlReporte = <T extends { totalVentas: number; totalGastos: number; utilidadBruta: number }>(
    base: T,
    costoVendidos: number
): T & { costoVendidos: number; utilidadNeta: number } => {
    const utilidadBruta = Math.round((base.totalVentas - costoVendidos) * 100) / 100;
    const utilidadNeta = Math.round((utilidadBruta - base.totalGastos) * 100) / 100;
    return { ...base, costoVendidos, utilidadBruta, utilidadNeta };
};

export function useReportesData(props: ReportesProps) {
    const { ventas, sesionesCaja = [], gastos, formatCurrency, generarReporte, productos = [], categorias = [], proveedores = [] } = props;
    
    
    const { role } = useAuth();
    const currentMonth = new Date().toISOString().slice(0, 7);

    const reporteActual = useMemo(() => {
        const base = generarReporte(currentMonth);
        return aplicarCogsAlReporte(base, calcCostoVendidos(ventas, productos, currentMonth));
    }, [ventas, gastos, productos, currentMonth, generarReporte]);

    // Datos comparativos últimos 6 meses
    const comparativoData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const periodo = date.toISOString().slice(0, 7);
            const r = aplicarCogsAlReporte(
                generarReporte(periodo),
                calcCostoVendidos(ventas, productos, periodo)
            );
            data.push({
                name: date.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
                ventas: r.totalVentas,
                gastos: r.totalGastos,
                utilidad: r.utilidadBruta
            });
        }
        return data;
    }, [ventas, gastos, productos, generarReporte]);

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

    const reporteMesAnterior = useMemo(() => {
        const base = generarReporte(prevPeriodo);
        return aplicarCogsAlReporte(base, calcCostoVendidos(ventas, productos, prevPeriodo));
    }, [ventas, gastos, productos, prevPeriodo, generarReporte]);

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
        fecha: fechaLocalHoy(),
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
            const val = isStringField ? value : (parseFloat(String(value)) || 0);
            
            const updated = { ...h, [field]: val };
            
            if (field === 'tipoPan') {
                const modelo = props.modelosPan?.find(m => m.nombre === value);
                if (modelo && modelo.piezasPorLata) {
                    updated.panesPorBandeja = modelo.piezasPorLata;
                    updated.totalPanes = Math.round(updated.bandejas * updated.panesPorBandeja);
                }
            } else if (field === 'bandejas') {
                updated.totalPanes = Math.round(updated.bandejas * updated.panesPorBandeja);
            } else if (field === 'panesPorBandeja') {
                if (updated.totalPanes > 0 && updated.bandejas === 0) {
                    updated.bandejas = Math.ceil(updated.totalPanes / updated.panesPorBandeja);
                } else {
                    updated.totalPanes = Math.round(updated.bandejas * updated.panesPorBandeja);
                }
            } else if (field === 'totalPanes' && updated.panesPorBandeja > 0) {
                updated.bandejas = Math.ceil(updated.totalPanes / updated.panesPorBandeja);
            }
            return updated;
        }));
    };

    const [editProduccionId, setEditProduccionId] = useState<string | null>(null);

    const handleSaveProduccion = () => {
        const validHornadas = hornadas.filter(h => h.tipoPan.trim() && (h.bandejas > 0 || h.totalPanes > 0));
        const data: Omit<RegistroProduccion, 'id'> = {
            // Fecha local YYYY-MM-DD (nunca toISOString: en Colombia de noche salta al día siguiente)
            fecha: normalizarFechaYYYYMMDD(formProd.fecha),
            masas: masasPreparadas,
            hornadas: validHornadas,
            notas: formProd.notas
        };
        const masaTotal = masasPreparadas.reduce((sum, m) => sum + m.cantidadArrobas, 0);
        if (masaTotal === 0 && validHornadas.length === 0) {
            toast.error('Ingresa al menos una masa o una hornada del día');
            return;
        }

        if (editProduccionId) {
            const existentes = getProducciones();
            const actualizados = existentes.map(p => p.id === editProduccionId ? { ...p, ...data } : p);
            saveProducciones(actualizados);
            setProducciones(actualizados);
            setEditProduccionId(null);
            toast.success(`✅ Producción del ${data.fecha} actualizada`);
        } else {
            const nueva = addProduccion(data);
            setProducciones(getProducciones());
            toast.success(`✅ Producción del ${nueva.fecha} registrada`);
        }
        
        setFormProd(p => ({ ...p, notas: '' }));
        setMasasPreparadas([]);
        setHornadas([{ tipoPan: '', bandejas: 0, panesPorBandeja: 0, totalPanes: 0 }]);
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
        evento: '',
        totalEfectivo: '', totalNequi: '', totalTransferencia: '', totalCredito: '', notas: ''
    });

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
        const fechasConPOS = new Set<string>();
        ventas.forEach(v => {
            const f = v.fecha.slice(0, 10);
            if (f >= inicioStr && f <= finStr) {
                ventasPOS += v.total;
                fechasConPOS.add(f);
                if (f === hoyStr) ventasPOSDia += v.total;
            }
        });
        
        let ventasManuales = 0;
        let ventasManualesDia = 0;
        let totalVentasManualesHistorico = 0;

        // POS gana: si ese día ya hay tickets POS, el cierre manual no se suma otra vez
        ventasDiarias.forEach(v => {
            totalVentasManualesHistorico += v.total;
            if (v.fecha >= inicioStr && v.fecha <= finStr && !fechasConPOS.has(v.fecha)) {
                ventasManuales += v.total;
                if (v.fecha === hoyStr) {
                    ventasManualesDia += v.total;
                }
            }
        });

        const ventasTotalDia = ventasPOSDia + (fechasConPOS.has(hoyStr) ? 0 : ventasManualesDia);

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
            fechasConPOS: Array.from(fechasConPOS),
        };
    }, [ventas, ventasDiarias, periodoFiltro]);

    // ── DIAGNÓSTICO FINANCIERO (GANANCIAS Y PÉRDIDAS DE LA QUINCENA) ──
    const diagnosticoFinanciero = useMemo(() => {
        // Los gastos/salidas del turno ya vienen restados en el 'total' de ventasDiarias
        // por lo que ventasTotal = Ingreso Neto. Para el P&L, necesitamos el Ingreso Bruto.
        // Las salidas se leen de TODOS los cierres (aunque el día tenga POS): son plata que salió.
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

        // Saldo operativo: no resta topes de compra (son presupuesto, no gasto real;
        // si se pagó proveedor desde caja, ya está en "operativos").
        const gananciaNeta = Math.round((ingresos - (fijos + operativos)) * 100) / 100;
        // Estimado si se consumiera el tope completo de proveedores (solo referencia).
        const estimadoTrasTopes = Math.round((ingresos - compras - fijos - operativos) * 100) / 100;
        
        return {
            ingresos,
            fijos,
            compras,
            operativos,
            totalEgresos: fijos + operativos,
            gananciaNeta,
            estimadoTrasTopes,
        };
    }, [quincenaReal, compromisos, presupuestosMinimos, ventasDiarias, temporadaBaja, periodoFiltro]);

    const proyeccionQuincena = useMemo(() => calcularProyeccionQuincena({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total, metodoPago: v.metodoPago })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria })),
        compromisos,
        temporadaBaja,
        margenCostoVariable: 0.5,
        periodo: {
            inicioStr: quincenaReal.inicioStr,
            finStr: quincenaReal.finStr,
            quincena: periodoFiltro.quincena,
        },
    }), [ventas, ventasDiarias, gastos, compromisos, temporadaBaja, quincenaReal.inicioStr, quincenaReal.finStr, periodoFiltro.quincena]);

    const consejo = useMemo(() => generarConsejo({
        ventas: ventas.map(v => ({ fecha: v.fecha.slice(0, 10), total: v.total, metodoPago: v.metodoPago })),
        ventasDiarias,
        gastos: gastos.map(g => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria, descripcion: g.descripcion })),
        compromisos,
        temporadaBaja,
        margenCostoVariable: 0.5,
        periodo: {
            inicioStr: quincenaReal.inicioStr,
            finStr: quincenaReal.finStr,
            quincena: periodoFiltro.quincena,
        },
    }), [ventas, ventasDiarias, gastos, compromisos, temporadaBaja, quincenaReal.inicioStr, quincenaReal.finStr, periodoFiltro.quincena]);

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
            evento: formVenta.evento || undefined,
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
    
    // --- ESTADÍSTICAS DE EVENTOS MASIVOS ---
    const eventosStats = useMemo(() => {
        const stats: Record<string, { total: number, dias: Set<string> }> = {};
        
        // Sumar ventas asociadas a cajas con eventos (modo POS moderno)
        sesionesCaja.forEach(c => {
            if (c.eventoEspecial && c.eventoEspecial !== 'Ninguno') {
                if (!stats[c.eventoEspecial]) stats[c.eventoEspecial] = { total: 0, dias: new Set() };
                stats[c.eventoEspecial].total += (c.totalVentasEfectivo || 0) + (c.totalCreditos || 0);
                stats[c.eventoEspecial].dias.add(c.fechaApertura.slice(0, 10));
            }
        });
        
        // Sumar ventas manuales del pasado
        ventasDiarias.forEach(v => {
            if (v.evento && v.evento !== 'Ninguno') {
                if (!stats[v.evento]) stats[v.evento] = { total: 0, dias: new Set() };
                stats[v.evento].total += v.total;
                stats[v.evento].dias.add(v.fecha);
            }
        });

        return Object.entries(stats)
            .map(([evento, data]) => ({
                evento,
                total: data.total,
                diasCount: data.dias.size,
                promedioDiario: data.dias.size > 0 ? data.total / data.dias.size : 0
            }))
            .sort((a, b) => b.total - a.total); // Mayor a menor
    }, [sesionesCaja, ventasDiarias]);
    
    return {
        role,
        currentMonth,
        reporteActual,
        comparativoData,
        proyeccion,
        eventosStats,
        hoy: new Date(),
        diaActual: new Date().getDate(),
        diasDelMes: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
        ventasMesActual: reporteActual.totalVentas,
        tasaDiaria: reporteActual.totalVentas / (new Date().getDate() || 1),
        rentabilidadProductos,
        totalVentasProductos,
        gastosData,
        ventasMetodoData,
        prevPeriodo,
        reporteMesAnterior,
        calcTrend,
        pct: 0,
        margenActual,
        margenAnterior,
        ventasMes,
        ticketPromedio,
        ventasMesAnt,
        ticketAnterior,
        ratioGasto,
        ratioGastoAnt,
        compromisos,
        setCompromisos,
        ventasDiarias,
        setVentasDiarias,
        detallesModal,
        setDetallesModal,
        producciones,
        setProducciones,
        formProd,
        setFormProd,
        setEditProduccionId,

        masasPreparadas,
        setMasasPreparadas,
        hornadas,
        setHornadas,
        handleAddMasa,
        handleRemoveMasa,
        handleMasaChange,
        handleAddHornada,
        handleRemoveHornada,
        handleHornadaChange,
        isStringField: (f: string) => f === 'tipoPan' || f === 'masaId',
        updated: null,
        handleSaveProduccion,
        validHornadas: hornadas.filter(h => h.tipoPan?.trim() && h.bandejas > 0),
        masaTotal: masasPreparadas.reduce((sum, m) => sum + m.cantidadArrobas, 0),
        nueva: null,
        pinModal,
        setPinModal,
        activeTab,
        setActiveTab,
        analisisIA,
        setAnalisisIA,
        pidiendoIA,
        setPidiendoIA,
        pedirConsejoIA,
        contextoData: null,
        prompt: '',
        temporadaBaja,
        setTemporadaBaja,
        presupuestosMinimos,
        setPresupuestosMinimos,
        editCompraId,
        setEditCompraId,
        handleStorage: () => {},
        sugerencias: sugerenciasPedido,
        loading: loadingSugerencias,
        generarSugerencias,
        totalCompromisosActivos,
        ratioCompromisosVsVentas,
        saludFinanciera,
        margen: margenActual,
        cobertura: totalCompromisosActivos > 0 ? (reporteActual.totalVentas / totalCompromisosActivos) : 99,
        score: Math.min(100, (margenActual * 0.5) + (Math.min(totalCompromisosActivos > 0 ? (reporteActual.totalVentas / totalCompromisosActivos) : 99, 3) / 3 * 50)),
        formCompromiso,
        setFormCompromiso,
        formVenta,
        setFormVenta,
        proyeccionQuincena,
        consejo,
        periodoFiltro,
        setPeriodoFiltro,
        m: periodoFiltro.mes,
        q: periodoFiltro.quincena,
        quincenaReal,
        year: parseInt(periodoFiltro.mes.split('-')[0]),
        month: parseInt(periodoFiltro.mes.split('-')[1]),
        pad: (n: number) => String(n).padStart(2, '0'),
        lastDayOfMonth: new Date(parseInt(periodoFiltro.mes.split('-')[0]), parseInt(periodoFiltro.mes.split('-')[1]), 0).getDate(),
        y1: parseInt((quincenaReal?.inicioStr || '2024-01-01').split('-')[0]),
        m1: parseInt((quincenaReal?.inicioStr || '2024-01-01').split('-')[1]),
        d1: parseInt((quincenaReal?.inicioStr || '2024-01-01').split('-')[2]),
        y2: parseInt((quincenaReal?.finStr || '2024-01-31').split('-')[0]),
        m2: parseInt((quincenaReal?.finStr || '2024-01-31').split('-')[1]),
        d2: parseInt((quincenaReal?.finStr || '2024-01-31').split('-')[2]),
        inicioDate: quincenaReal ? new Date(parseInt(quincenaReal.inicioStr.split('-')[0]), parseInt(quincenaReal.inicioStr.split('-')[1]) - 1, parseInt(quincenaReal.inicioStr.split('-')[2])) : new Date(),
        finDate: quincenaReal ? new Date(parseInt(quincenaReal.finStr.split('-')[0]), parseInt(quincenaReal.finStr.split('-')[1]) - 1, parseInt(quincenaReal.finStr.split('-')[2])) : new Date(),
        hoyDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
        hoyStr: quincenaReal?.hoyStr || '',
        maxTranscurrido: 0,
        transcurridoTime: 0,
        diasTranscurridos: quincenaReal?.diasTranscurridos || 0,
        totalDiasPeriodo: quincenaReal?.totalDiasPeriodo || 0,
        f: '',
        ventasTotalDia: quincenaReal?.ventasTotalDia || 0,
        diagnosticoFinanciero,
        operativos: diagnosticoFinanciero?.operativos || 0,
        ingresos: diagnosticoFinanciero?.ingresos || 0,
        fijos: diagnosticoFinanciero?.fijos || 0,
        getLimite: (item: any) => temporadaBaja && item.montoBaja !== undefined ? item.montoBaja : item.monto,
        compras: diagnosticoFinanciero?.compras || 0,
        limite: 0,
        promedioGastosMensuales,
        mes: periodoFiltro.mes,
        numMeses: 1,
        promedioInsumos,
        promedioOtrosGastos,
        totalObligaciones,
        coberturaActual,
        ventasNecesariasDiarias,
        diasMes: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
        obligacionesBreakdown,
        alertasAutomaticas,
        pctInsumos: promedioInsumos > 0 && reporteActual.totalVentas > 0 ? (promedioInsumos / reporteActual.totalVentas) * 100 : 0,
        handleAddCompromiso,
        monto: 0,
        dia: 0,
        cId: '',
        nuevo: null,
        handleToggleCompromiso,
        handleDeleteCompromiso,
        handleAddVentaDiaria,
        ef: 0,
        nq: 0,
        tr: 0,
        cr: 0,
        cajas: undefined,
        sumCajas: 0,
        bovedasExistentes: [],
        syncToBoveda: undefined,
        handleDeleteVentaDiaria,
        confirmarDeleteConPin,
        cfg: null,
        cardsData,
        addMovimientoBoveda,
        addBoveda
    };
}
