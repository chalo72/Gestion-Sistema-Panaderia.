import { useState, useMemo, useEffect, useRef } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
    Search, X, ArrowUpDown, ShoppingBag, Filter, Download,
    Play, StopCircle, CheckCircle2, AlertTriangle, Package,
    BarChart3, Zap, Target, TrendingDown, Clock, RefreshCw,
    ClipboardList, Activity, Layers, Eye, TrendingUp, Flame,
    Turtle, ListOrdered, PlusCircle, MinusCircle, Save
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Producto, InventarioItem, MovimientoInventario, Categoria, PrecioProveedor } from '@/types';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface RondaConteo {
    id: string;
    numero: number;
    inicio: string;
    snapshot: Record<string, number>; // productoId → stock al inicio
}

type FreshnessLevel = 'hoy' | 'reciente' | 'viejo' | 'nunca';
type TabInventario = 'dashboard' | 'ronda' | 'stock' | 'analitica' | 'rotacion';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getFreshness = (lastCounted?: string): FreshnessLevel => {
    if (!lastCounted) return 'nunca';
    const days = (Date.now() - new Date(lastCounted).getTime()) / 86_400_000;
    if (days < 1) return 'hoy';
    if (days <= 3) return 'reciente';
    return 'viejo';
};

const FRESH: Record<FreshnessLevel, { label: string; color: string; bg: string; ring: string; icon: string }> = {
    hoy:      { label: 'Contado hoy',   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20',  ring: 'ring-emerald-300', icon: '🟢' },
    reciente: { label: '1-3 días',      color: 'text-amber-700 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/20',      ring: 'ring-amber-300',   icon: '🟡' },
    viejo:    { label: '+3 días',       color: 'text-red-700 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-900/20',          ring: 'ring-red-300',     icon: '🔴' },
    nunca:    { label: 'Sin contar',    color: 'text-slate-500 dark:text-slate-400',    bg: 'bg-slate-100 dark:bg-slate-800',        ring: 'ring-slate-300',   icon: '⚫' },
};

const FRESH_ORDER: Record<FreshnessLevel, number> = { nunca: 0, viejo: 1, reciente: 2, hoy: 3 };

// ─── Subcomponente: Precios + Stock ──────────────────────────────────────────

function PreciosStockTab({ productos, inventario, categorias, formatCurrency }: {
    productos: Producto[]; inventario: InventarioItem[]; categorias: Categoria[]; formatCurrency: (v: number) => string;
}) {
    const [busqueda, setBusqueda] = useState('');
    const [catFiltro, setCatFiltro] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<'nombre' | 'precioVenta' | 'stock' | 'margenUtilidad'>('nombre');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const colorDeCat = (nombre: string) => categorias.find(c => c.nombre === nombre)?.color ?? '#6366f1';
    const stockMap = useMemo(() => new Map(inventario.map(i => [i.productoId, i.stockActual ?? 0])), [inventario]);
    const catsUnicas = useMemo(() => Array.from(new Set(productos.map(p => p.categoria).filter(Boolean))), [productos]);

    const filas = useMemo(() => {
        let lista = productos.filter(p => p.tipo === 'elaborado')
            .map(p => ({ ...p, stock: stockMap.get(p.id) ?? 0 }))
            .filter(p => {
                const q = busqueda.toLowerCase();
                return (!q || p.nombre.toLowerCase().includes(q)) && (!catFiltro || p.categoria === catFiltro);
            });
        lista.sort((a, b) => {
            let cmp = 0;
            if      (sortKey === 'nombre')        cmp = a.nombre.localeCompare(b.nombre);
            else if (sortKey === 'precioVenta')   cmp = a.precioVenta - b.precioVenta;
            else if (sortKey === 'stock')         cmp = a.stock - b.stock;
            else if (sortKey === 'margenUtilidad') cmp = a.margenUtilidad - b.margenUtilidad;
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return lista;
    }, [productos, stockMap, busqueda, catFiltro, sortKey, sortDir]);

    const ordenar = (key: typeof sortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };
    const iconO = (key: typeof sortKey) => (
        <ArrowUpDown className={`w-3 h-3 ml-1 inline ${sortKey === key ? 'text-emerald-500' : 'text-slate-300'}`} />
    );
    const colorMargen = (m: number) =>
        m >= 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : m >= 15 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

    const exportarCSV = () => {
        const csv = [['Producto', 'Categoría', 'Precio Venta', 'Stock', 'Margen %'].join(','),
            ...filas.map(p => [`"${p.nombre}"`, `"${p.categoria}"`, p.precioVenta, p.stock, `${p.margenUtilidad}%`].join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `precios-stock-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Productos Venta', valor: filas.length, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                    { label: 'Precio Promedio', valor: filas.length ? formatCurrency(filas.reduce((s, p) => s + p.precioVenta, 0) / filas.length) : '$0', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
                    { label: 'Margen Promedio', valor: filas.length ? `${(filas.reduce((s, p) => s + p.margenUtilidad, 0) / filas.length).toFixed(1)}%` : '0%', color: 'text-amber-600', bg: 'bg-amber-500/10' },
                ].map(({ label, valor, color, bg }) => (
                    <div key={label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                        <p className={`text-xl font-black tabular-nums mt-1 ${color}`}>{valor}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex gap-3 flex-wrap items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            className="pl-10 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                        {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
                    </div>
                    <Button onClick={exportarCSV} variant="outline"
                        className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:border-emerald-300 hover:text-emerald-600 gap-2 shrink-0">
                        <Download className="w-4 h-4" /> CSV
                    </Button>
                </div>
                {catsUnicas.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <button onClick={() => setCatFiltro(null)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${!catFiltro ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 hover:border-slate-400'}`}>Todos</button>
                        {catsUnicas.map(cat => {
                            const color = colorDeCat(cat);
                            const activa = catFiltro === cat;
                            return (
                                <button key={cat} onClick={() => setCatFiltro(activa ? null : cat)}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all"
                                    style={activa ? { backgroundColor: color, borderColor: color, color: '#fff' } : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#475569' }}>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activa ? 'rgba(255,255,255,0.8)' : color }} />
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                <th className="px-4 py-3 text-left"><button onClick={() => ordenar('nombre')} className="flex items-center font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">Producto {iconO('nombre')}</button></th>
                                <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">Categoría</th>
                                <th className="px-4 py-3 text-right"><button onClick={() => ordenar('precioVenta')} className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">Precio {iconO('precioVenta')}</button></th>
                                <th className="px-4 py-3 text-center"><button onClick={() => ordenar('stock')} className="flex items-center mx-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">Stock {iconO('stock')}</button></th>
                                <th className="px-4 py-3 text-right"><button onClick={() => ordenar('margenUtilidad')} className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">Margen {iconO('margenUtilidad')}</button></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filas.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center"><ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sin productos</p></td></tr>
                            ) : filas.map(p => {
                                const cat = colorDeCat(p.categoria);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat + '20' }}><ShoppingBag className="w-3.5 h-3.5" style={{ color: cat }} /></div><span className="font-bold text-slate-800 dark:text-white">{p.nombre}</span></div></td>
                                        <td className="px-4 py-3"><span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: cat + '18', color: cat }}><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat }} />{p.categoria || '—'}</span></td>
                                        <td className="px-4 py-3 text-right"><span className="font-black text-emerald-600 tabular-nums text-sm">{formatCurrency(p.precioVenta)}</span></td>
                                        <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black tabular-nums ${p.stock > 10 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : p.stock > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{p.stock}</span></td>
                                        <td className="px-4 py-3 text-right"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${colorMargen(p.margenUtilidad)}`}>{p.margenUtilidad}%</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Props principales ────────────────────────────────────────────────────────

interface InventarioProps {
    productos: Producto[];
    inventario: InventarioItem[];
    movimientos: MovimientoInventario[];
    categorias: Categoria[];
    precios: PrecioProveedor[];
    onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => void;
    formatCurrency: (value: number) => string;
    getProductoById: (id: string) => Producto | undefined;
    onGenerarSugerencias?: () => void;
    onViewPrePedidos?: () => void;
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export function Inventario({
    productos, inventario, movimientos, categorias, precios,
    onAjustarStock, formatCurrency, getProductoById,
    onGenerarSugerencias, onViewPrePedidos,
}: InventarioProps) {
    const { check } = useCan();
    const canEdit = check('GESTIONAR_INVENTARIO');

    // ── Tab ──────────────────────────────────────────────────────────────────
    const [tab, setTab] = useState<TabInventario>('dashboard');

    // ── Ronda de Conteo ──────────────────────────────────────────────────────
    const [rondaActiva, setRondaActiva] = useState<RondaConteo | null>(null);
    const [conteoValues, setConteoValues] = useState<Record<string, string>>({});
    const [rondaNumero, setRondaNumero] = useState(1);
    const [soloEsenciales, setSoloEsenciales] = useState(false);
    const [busquedaRonda, setBusquedaRonda] = useState('');
    const [timerTick, setTimerTick] = useState(0);

    // ── Semáforo de frescura (localStorage) ──────────────────────────────────
    const [lastCounted, setLastCounted] = useState<Record<string, string>>({});

    // ── Stock general ────────────────────────────────────────────────────────
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'ok' | 'bajo' | 'agotado'>('todos');
    const [ajusteModal, setAjusteModal] = useState<{ productoId: string; tipo: 'entrada' | 'salida' | 'ajuste' } | null>(null);
    const [ajusteCantidad, setAjusteCantidad] = useState('');
    const [ajusteMotivo, setAjusteMotivo] = useState('');

    // ── Historial por producto ───────────────────────────────────────────────
    const [historialProductoId, setHistorialProductoId] = useState<string | null>(null);

    // ── Ajuste masivo ────────────────────────────────────────────────────────
    const [showAjusteMasivo, setShowAjusteMasivo] = useState(false);
    const [ajusteMasivo, setAjusteMasivo] = useState<Record<string, string>>({});
    const [motivoMasivo, setMotivoMasivo] = useState('');

    // ── Filtro por categoría ─────────────────────────────────────────────────
    const [catFiltroStock, setCatFiltroStock] = useState<string | null>(null);
    const [catFiltroRonda, setCatFiltroRonda] = useState<string | null>(null);

    // Cargar localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('inv_lastCounted');
            if (saved) setLastCounted(JSON.parse(saved));
            const savedNum = localStorage.getItem('inv_rondaNumero');
            if (savedNum) setRondaNumero(parseInt(savedNum) || 1);
        } catch {}
    }, []);

    // Timer para mostrar duración de ronda en vivo
    useEffect(() => {
        if (!rondaActiva) return;
        const interval = setInterval(() => setTimerTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [rondaActiva]);

    const saveLastCounted = (updated: Record<string, string>) => {
        setLastCounted(updated);
        localStorage.setItem('inv_lastCounted', JSON.stringify(updated));
    };

    // ── Helpers de stock ─────────────────────────────────────────────────────
    const getStockStatus = (item: InventarioItem) => {
        if (item.stockActual <= 0) return 'agotado';
        if (item.stockActual <= item.stockMinimo) return 'bajo';
        return 'ok';
    };

    // ── Inventario enriquecido ───────────────────────────────────────────────
    const inventarioConProducto = useMemo(() => {
        return inventario
            .map(item => ({ ...item, producto: getProductoById(item.productoId), status: getStockStatus(item) }))
            .filter(item => item.producto);
    }, [inventario, productos]);

    // ── Stats dashboard ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = inventarioConProducto.length;
        const ok = inventarioConProducto.filter(i => i.status === 'ok').length;
        const bajo = inventarioConProducto.filter(i => i.status === 'bajo').length;
        const agotado = inventarioConProducto.filter(i => i.status === 'agotado').length;
        const sinContar = inventarioConProducto.filter(i => getFreshness(lastCounted[i.productoId]) === 'nunca').length;
        const viejos = inventarioConProducto.filter(i => getFreshness(lastCounted[i.productoId]) === 'viejo').length;
        const saludPct = total > 0 ? Math.round((ok / total) * 100) : 0;
        const valorTotal = inventarioConProducto.reduce((s, i) => s + (i.stockActual * (i.producto?.precioVenta || 0)), 0);
        const urgentes = bajo + agotado + sinContar + viejos;
        return { total, ok, bajo, agotado, sinContar, viejos, saludPct, valorTotal, urgentes };
    }, [inventarioConProducto, lastCounted]);

    // ── Ventas durante la ronda activa ───────────────────────────────────────
    const ventasDuranteRonda = useMemo(() => {
        if (!rondaActiva) return {} as Record<string, number>;
        const result: Record<string, number> = {};
        movimientos
            .filter(m => m.fecha >= rondaActiva.inicio && m.tipo === 'salida')
            .forEach(m => { result[m.productoId] = (result[m.productoId] || 0) + m.cantidad; });
        return result;
    }, [movimientos, rondaActiva, timerTick]);

    // ── Duración de la ronda ─────────────────────────────────────────────────
    const rondaDuracion = useMemo(() => {
        if (!rondaActiva) return '0:00';
        const ms = Date.now() - new Date(rondaActiva.inicio).getTime();
        const min = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }, [rondaActiva, timerTick]);

    // ── Productos para ronda (ordenados por urgencia) ────────────────────────
    const productosParaRonda = useMemo(() => {
        let lista = [...inventarioConProducto];
        if (catFiltroRonda) {
            lista = lista.filter(i => i.producto?.categoria === catFiltroRonda);
        }
        if (soloEsenciales) {
            lista = lista.filter(i =>
                i.status !== 'ok' ||
                getFreshness(lastCounted[i.productoId]) === 'viejo' ||
                getFreshness(lastCounted[i.productoId]) === 'nunca'
            );
        }
        if (busquedaRonda.trim()) {
            const q = busquedaRonda.toLowerCase();
            lista = lista.filter(i => i.producto?.nombre.toLowerCase().includes(q));
        }
        return lista.sort((a, b) => {
            const fa = getFreshness(lastCounted[a.productoId]);
            const fb = getFreshness(lastCounted[b.productoId]);
            const orderFresh = FRESH_ORDER[fa] - FRESH_ORDER[fb];
            if (orderFresh !== 0) return orderFresh;
            const orderStatus = { agotado: 0, bajo: 1, ok: 2 };
            return (orderStatus[a.status] || 0) - (orderStatus[b.status] || 0);
        });
    }, [inventarioConProducto, lastCounted, soloEsenciales, busquedaRonda, catFiltroRonda]);

    // ── Filtro stock general ─────────────────────────────────────────────────
    const inventarioFiltrado = useMemo(() => {
        return inventarioConProducto.filter(item => {
            if (filtroEstado !== 'todos' && item.status !== filtroEstado) return false;
            if (catFiltroStock && item.producto?.categoria !== catFiltroStock) return false;
            if (busqueda) {
                const q = busqueda.toLowerCase();
                return item.producto!.nombre.toLowerCase().includes(q) ||
                    item.producto!.categoria.toLowerCase().includes(q);
            }
            return true;
        });
    }, [inventarioConProducto, filtroEstado, busqueda, catFiltroStock]);

    // ── Estadísticas de analítica ────────────────────────────────────────────
    const reporteStats = useMemo(() => {
        const movsAudit = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') ||
            m.motivo.toLowerCase().includes('ronda') ||
            m.tipo === 'ajuste'
        );
        let totalPerdida = 0, totalGanancia = 0;
        const map = new Map<string, { nombre: string; cantidad: number; valor: number }>();
        movsAudit.forEach(m => {
            const prod = getProductoById(m.productoId);
            if (!prod) return;
            const costo = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0;
            const valor = m.cantidad * costo;
            if (m.tipo === 'salida') {
                totalPerdida += valor;
                const cur = map.get(m.productoId) || { nombre: prod.nombre, cantidad: 0, valor: 0 };
                map.set(m.productoId, { ...cur, cantidad: cur.cantidad + m.cantidad, valor: cur.valor + valor });
            } else if (m.tipo === 'entrada') totalGanancia += valor;
        });
        const topPerdidas = Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 5);
        return { totalPerdida, totalGanancia, topPerdidas, total: movsAudit.length };
    }, [movimientos, precios, getProductoById]);

    // ── Rotación de productos (ventas de últimos 30 días) ────────────────────
    const rotacion = useMemo(() => {
        const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const ventas30: Record<string, number> = {};
        movimientos
            .filter(m => m.tipo === 'salida' && m.fecha >= hace30 && !m.motivo.toLowerCase().includes('ronda') && !m.motivo.toLowerCase().includes('ajuste'))
            .forEach(m => { ventas30[m.productoId] = (ventas30[m.productoId] || 0) + m.cantidad; });

        return inventarioConProducto
            .map(item => ({
                ...item,
                vendidos30: ventas30[item.productoId] || 0,
                rotacionDiaria: ((ventas30[item.productoId] || 0) / 30),
                diasStock: item.stockActual > 0 && (ventas30[item.productoId] || 0) > 0
                    ? Math.round(item.stockActual / ((ventas30[item.productoId] || 0) / 30))
                    : item.stockActual > 0 ? 999 : 0,
            }))
            .sort((a, b) => b.vendidos30 - a.vendidos30);
    }, [inventarioConProducto, movimientos]);

    const topRapidos = rotacion.filter(r => r.vendidos30 > 0).slice(0, 5);
    const topLentos  = rotacion.filter(r => r.vendidos30 === 0 && r.stockActual > 0).slice(0, 5);

    // ── Alertas de stock mínimo ───────────────────────────────────────────────
    const bajoMinimo = useMemo(() =>
        inventarioConProducto.filter(i => i.stockActual > 0 && i.stockActual <= i.stockMinimo),
    [inventarioConProducto]);

    // ── Acciones ─────────────────────────────────────────────────────────────

    const iniciarRonda = () => {
        const snapshot: Record<string, number> = {};
        inventario.forEach(item => { snapshot[item.productoId] = item.stockActual; });
        setRondaActiva({ id: crypto.randomUUID(), numero: rondaNumero, inicio: new Date().toISOString(), snapshot });
        setConteoValues({});
        setTab('ronda');
        toast.success(`▶ Ronda #${rondaNumero} iniciada — puedes seguir vendiendo mientras cuentas`);
    };

    const finalizarRonda = () => {
        if (!rondaActiva) return;
        let ajustesAplicados = 0;
        const ahora = new Date().toISOString();
        const newLastCounted = { ...lastCounted };

        Object.entries(conteoValues).forEach(([productoId, valorStr]) => {
            const fisico = parseFloat(valorStr);
            if (isNaN(fisico) || fisico < 0) return;
            const stockAlInicio = rondaActiva.snapshot[productoId] ?? 0;
            const ventasDurante = ventasDuranteRonda[productoId] ?? 0;
            const stockEsperado = Math.max(0, stockAlInicio - ventasDurante);
            const diferencia = fisico - stockEsperado;
            if (Math.abs(diferencia) >= 1) {
                onAjustarStock(productoId, Math.abs(Math.round(diferencia)),
                    diferencia > 0 ? 'entrada' : 'salida',
                    `Ronda de Conteo #${rondaActiva.numero}`);
                ajustesAplicados++;
            }
            newLastCounted[productoId] = ahora;
        });

        saveLastCounted(newLastCounted);
        const newNum = rondaNumero + 1;
        setRondaNumero(newNum);
        localStorage.setItem('inv_rondaNumero', String(newNum));
        setRondaActiva(null);
        setConteoValues({});
        toast.success(`✅ Ronda #${rondaActiva.numero} completada — ${ajustesAplicados} ajuste(s) aplicado(s)`);
    };

    const cancelarRonda = () => {
        setRondaActiva(null);
        setConteoValues({});
        toast.info('Ronda cancelada sin guardar cambios');
    };

    const handleAjuste = () => {
        if (!ajusteModal || !ajusteCantidad || !ajusteMotivo) { toast.error('Completa todos los campos'); return; }
        const cantidad = parseInt(ajusteCantidad);
        if (isNaN(cantidad) || cantidad <= 0) { toast.error('Cantidad inválida'); return; }
        onAjustarStock(ajusteModal.productoId, cantidad, ajusteModal.tipo, ajusteMotivo);
        setAjusteModal(null); setAjusteCantidad(''); setAjusteMotivo('');
        toast.success('Ajuste aplicado');
    };

    const handleAjusteMasivo = () => {
        if (!motivoMasivo.trim()) { toast.error('Escribe un motivo para el ajuste'); return; }
        let count = 0;
        Object.entries(ajusteMasivo).forEach(([productoId, val]) => {
            const n = parseInt(val);
            if (!isNaN(n) && n !== 0) {
                onAjustarStock(productoId, Math.abs(n), n > 0 ? 'entrada' : 'salida', motivoMasivo);
                count++;
            }
        });
        if (count === 0) { toast.error('Ingresa al menos un ajuste'); return; }
        setAjusteMasivo({});
        setMotivoMasivo('');
        setShowAjusteMasivo(false);
        toast.success(`✅ ${count} ajuste(s) aplicados`);
    };

    const handleExportCSV = () => {
        const movsAudit = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') || m.motivo.toLowerCase().includes('ronda') || m.tipo === 'ajuste'
        );
        if (movsAudit.length === 0) { toast.error('No hay datos de rondas para exportar'); return; }
        const csv = [['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Valor'].join(','),
            ...movsAudit.map(m => {
                const prod = getProductoById(m.productoId);
                const costo = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0;
                return [m.fecha, `"${prod?.nombre || 'N/A'}"`, m.tipo, m.cantidad, `"${m.motivo}"`, (m.cantidad * costo).toFixed(2)].join(',');
            })].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `rondas-inventario-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // ── Cálculo por producto en ronda ────────────────────────────────────────
    const getDiferenciaRonda = (productoId: string, valorStr: string) => {
        if (!rondaActiva || !valorStr.trim()) return null;
        const fisico = parseFloat(valorStr);
        if (isNaN(fisico)) return null;
        const stockAlInicio = rondaActiva.snapshot[productoId] ?? 0;
        const ventasDurante = ventasDuranteRonda[productoId] ?? 0;
        const stockEsperado = Math.max(0, stockAlInicio - ventasDurante);
        return { fisico, stockEsperado, diferencia: fisico - stockEsperado, ventasDurante };
    };

    const productosContados = Object.keys(conteoValues).filter(k => conteoValues[k].trim() !== '').length;

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

            {/* ── BANNER RONDA ACTIVA ── */}
            {rondaActiva && (
                <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 animate-pulse-subtle">
                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Ronda #{rondaActiva.numero} en progreso</p>
                        <p className="text-sm font-black">{productosContados} de {productosParaRonda.length} contados · {rondaDuracion} transcurrido</p>
                    </div>
                    <Button onClick={() => setTab('ronda')} className="h-8 px-4 bg-white/20 hover:bg-white/30 text-white border-none text-xs font-black uppercase tracking-widest rounded-xl shrink-0">
                        Ver ronda
                    </Button>
                    <Button onClick={cancelarRonda} variant="ghost" className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl shrink-0">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Inventario</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Salud: <span className={stats.saludPct >= 80 ? 'text-emerald-500' : stats.saludPct >= 50 ? 'text-amber-500' : 'text-red-500'}>{stats.saludPct}%</span>
                            {' · '}{stats.total} productos
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {!rondaActiva ? (
                        <Button onClick={iniciarRonda} disabled={!canEdit}
                            className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none">
                            <Play className="w-4 h-4" /> Iniciar Ronda #{rondaNumero}
                        </Button>
                    ) : (
                        <Button onClick={() => setTab('ronda')}
                            className="h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 font-black uppercase tracking-widest text-xs border-none animate-pulse">
                            <ClipboardList className="w-4 h-4" /> Continuar Ronda
                        </Button>
                    )}
                    <Button onClick={() => { onGenerarSugerencias?.(); onViewPrePedidos && setTimeout(onViewPrePedidos, 500); }}
                        variant="outline" className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
                        <Zap className="w-4 h-4 text-amber-500" /> Reponer con IA
                    </Button>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-x-auto">
                {([
                    { id: 'dashboard', label: 'Dashboard',       icon: Activity },
                    { id: 'ronda',     label: 'Ronda de Conteo', icon: ClipboardList, badge: rondaActiva ? '●' : undefined },
                    { id: 'stock',     label: 'Stock en Vivo',   icon: Layers },
                    { id: 'rotacion',  label: 'Rotación',        icon: TrendingUp, badge: topLentos.length > 0 ? String(topLentos.length) : undefined },
                    { id: 'analitica', label: 'Analítica',       icon: BarChart3 },
                ] as const).map(({ id, label, icon: Icon, badge }) => (
                    <button key={id} onClick={() => setTab(id as TabInventario)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            tab === id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                        {badge && <span className="text-amber-300 animate-pulse">{badge}</span>}
                    </button>
                ))}
                <button onClick={() => setTab('analitica' as TabInventario)}
                    className="hidden" />
                {/* Tab extra: Precios+Stock */}
                <button onClick={() => setTab('stock' as any)}
                    className="hidden" />
            </div>

            {/* ════════════════════════════════════════════════════════
                TAB — DASHBOARD
            ════════════════════════════════════════════════════════ */}
            {tab === 'dashboard' && (
                <div className="space-y-5 animate-ag-fade-in">
                    {/* KPIs principales */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Total SKUs',      value: stats.total,                     color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-950/30',   icon: Package },
                            { label: 'Saludables',      value: stats.ok,                        color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: CheckCircle2 },
                            { label: 'Stock Bajo',      value: stats.bajo,                      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/30',     icon: AlertTriangle },
                            { label: 'Agotados',        value: stats.agotado,                   color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/30',         icon: TrendingDown },
                        ].map(kpi => (
                            <Card key={kpi.label} className={`${kpi.bg} border-none shadow-sm rounded-2xl`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <kpi.icon className={`w-5 h-5 ${kpi.color} opacity-70`} />
                                        <div>
                                            <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Alerta stock bajo mínimo */}
                    {bajoMinimo.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <p className="text-sm font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                                    {bajoMinimo.length} producto{bajoMinimo.length > 1 ? 's' : ''} bajo el mínimo
                                </p>
                            </div>
                            <div className="space-y-2">
                                {bajoMinimo.slice(0, 6).map(item => (
                                    <div key={item.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                            <span className="text-xs font-black text-slate-800 dark:text-white truncate">{item.producto?.nombre}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs font-black text-amber-700 dark:text-amber-300 tabular-nums">
                                                {item.stockActual} / mín {item.stockMinimo}
                                            </span>
                                            <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full bg-amber-500 rounded-full"
                                                    style={{ width: `${Math.min(100, (item.stockActual / item.stockMinimo) * 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {bajoMinimo.length > 6 && (
                                <p className="text-[10px] text-amber-600 font-black mt-2 text-center">+{bajoMinimo.length - 6} más...</p>
                            )}
                        </div>
                    )}

                    {/* Barra de salud */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Salud del inventario</p>
                            <span className={`text-xl font-black ${stats.saludPct >= 80 ? 'text-emerald-600' : stats.saludPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {stats.saludPct}%
                            </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${stats.saludPct >= 80 ? 'bg-emerald-500' : stats.saludPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${stats.saludPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">
                            <span>Crítico</span><span>Moderado</span><span>Óptimo</span>
                        </div>
                    </div>

                    {/* Semáforo de frescura */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm font-black text-slate-900 dark:text-white">Semáforo de Conteo Físico</p>
                                <p className="text-xs text-muted-foreground mt-0.5">¿Cuándo se contó cada producto por última vez?</p>
                            </div>
                            {stats.urgentes > 0 && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-none font-black text-xs">
                                    {stats.urgentes} urgentes
                                </Badge>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            {(['hoy', 'reciente', 'viejo', 'nunca'] as FreshnessLevel[]).map(level => {
                                const count = inventarioConProducto.filter(i => getFreshness(lastCounted[i.productoId]) === level).length;
                                const cfg = FRESH[level];
                                return (
                                    <div key={level} className={`${cfg.bg} rounded-xl p-3 text-center`}>
                                        <p className="text-2xl mb-1">{cfg.icon}</p>
                                        <p className={`text-xl font-black ${cfg.color}`}>{count}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{cfg.label}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top urgentes para contar */}
                        {(stats.sinContar > 0 || stats.viejos > 0) && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Prioridad de conteo</p>
                                <div className="space-y-1.5">
                                    {inventarioConProducto
                                        .filter(i => ['nunca', 'viejo'].includes(getFreshness(lastCounted[i.productoId])))
                                        .slice(0, 5)
                                        .map(i => {
                                            const fr = getFreshness(lastCounted[i.productoId]);
                                            const cfg = FRESH[fr];
                                            return (
                                                <div key={i.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                                                    <span className="text-sm">{cfg.icon}</span>
                                                    <span className="flex-1 font-bold text-xs text-slate-800 dark:text-white truncate">{i.producto?.nombre}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${i.status === 'agotado' ? 'bg-red-100 text-red-600' : i.status === 'bajo' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {i.stockActual} uds
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                                <Button onClick={iniciarRonda} disabled={!canEdit}
                                    className="mt-3 w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs border-none gap-2">
                                    <Play className="w-3.5 h-3.5" /> Contar ahora ({stats.sinContar + stats.viejos} pendientes)
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Valor del inventario */}
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                        <p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-1">Valor total del inventario</p>
                        <p className="text-3xl font-black">{formatCurrency(stats.valorTotal)}</p>
                        <p className="text-xs text-indigo-300 mt-1">Basado en precios de venta × stock actual</p>
                    </div>

                    {/* Rotación rápida */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Top más vendidos */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Flame className="w-4 h-4 text-orange-500" />
                                <p className="text-sm font-black text-slate-900 dark:text-white">Más vendidos — 30 días</p>
                            </div>
                            {topRapidos.length === 0 ? (
                                <p className="text-xs text-slate-400 font-bold text-center py-4">Sin datos de ventas</p>
                            ) : (
                                <div className="space-y-2">
                                    {topRapidos.map((item, i) => (
                                        <div key={item.id} className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${i === 0 ? 'bg-orange-500' : i === 1 ? 'bg-orange-400' : 'bg-amber-400'}`}>{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-xs text-slate-800 dark:text-white truncate">{item.producto?.nombre}</p>
                                                <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, (item.vendidos30 / (topRapidos[0]?.vendidos30 || 1)) * 100)}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-orange-600 tabular-nums shrink-0">{item.vendidos30} uds</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sin movimiento */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Turtle className="w-4 h-4 text-slate-400" />
                                <p className="text-sm font-black text-slate-900 dark:text-white">Sin rotación — 30 días</p>
                            </div>
                            {topLentos.length === 0 ? (
                                <p className="text-xs text-emerald-600 font-bold text-center py-4">✅ Todo tiene movimiento</p>
                            ) : (
                                <div className="space-y-2">
                                    {topLentos.map(item => (
                                        <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <span className="font-black text-xs text-slate-700 dark:text-slate-300 truncate">{item.producto?.nombre}</span>
                                            <span className="text-[10px] font-black text-slate-400 shrink-0 tabular-nums">{item.stockActual} en stock</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB — RONDA DE CONTEO
            ════════════════════════════════════════════════════════ */}
            {tab === 'ronda' && (
                <div className="space-y-4 animate-ag-fade-in">

                    {/* Estado de la ronda */}
                    {!rondaActiva ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto">
                                <ClipboardList className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-slate-900 dark:text-white">Sin ronda activa</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                                    Inicia una ronda para contar el inventario mientras la panadería sigue abierta.
                                    El sistema descuenta automáticamente las ventas que ocurran mientras cuentas.
                                </p>
                            </div>
                            <Button onClick={iniciarRonda} disabled={!canEdit}
                                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-sm border-none">
                                <Play className="w-5 h-5" /> Iniciar Ronda #{rondaNumero}
                            </Button>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                Rondas completadas: {rondaNumero - 1}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Panel de ronda activa */}
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Ronda #{rondaActiva.numero} en progreso</p>
                                        </div>
                                        <p className="text-2xl font-black">{rondaDuracion} <span className="text-sm font-bold text-indigo-300">transcurrido</span></p>
                                        <p className="text-sm text-indigo-200 mt-0.5">
                                            {productosContados} contados · {productosParaRonda.length - productosContados} pendientes
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={cancelarRonda} variant="ghost"
                                            className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest border-none">
                                            <X className="w-4 h-4 mr-1" /> Cancelar
                                        </Button>
                                        <Button onClick={finalizarRonda} disabled={productosContados === 0}
                                            className="h-9 px-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xs uppercase tracking-widest border-none shadow-lg gap-2">
                                            <CheckCircle2 className="w-4 h-4" /> Finalizar y Aplicar
                                        </Button>
                                    </div>
                                </div>

                                {/* Barra de progreso */}
                                <div className="mt-4">
                                    <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                                        <div className="h-full rounded-full bg-white transition-all duration-500"
                                            style={{ width: productosParaRonda.length > 0 ? `${(productosContados / productosParaRonda.length) * 100}%` : '0%' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Info: ventas durante ronda */}
                            {Object.keys(ventasDuranteRonda).length > 0 && (
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                    <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                                        {Object.keys(ventasDuranteRonda).length} producto(s) vendido(s) durante esta ronda —
                                        se descontarán automáticamente al calcular las diferencias.
                                    </p>
                                </div>
                            )}

                            {/* Filtros */}
                            <div className="flex gap-3 flex-wrap">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input placeholder="Buscar producto..." value={busquedaRonda}
                                        onChange={e => setBusquedaRonda(e.target.value)}
                                        autoComplete="off"
                                        className="pl-9 rounded-xl" />
                                </div>
                                <button
                                    onClick={() => setSoloEsenciales(!soloEsenciales)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                                        soloEsenciales
                                            ? 'bg-amber-600 text-white border-amber-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                    }`}>
                                    <Target className="w-3.5 h-3.5" />
                                    Solo críticos ({stats.urgentes})
                                </button>
                            </div>

                            {/* Chips de categoría para ronda */}
                            {categorias.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setCatFiltroRonda(null)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                                            catFiltroRonda === null
                                                ? 'bg-indigo-600 text-white border-transparent'
                                                : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                        }`}>
                                        Todas las categorías
                                    </button>
                                    {categorias.map(cat => {
                                        const count = inventarioConProducto.filter(i => i.producto?.categoria === cat.nombre).length;
                                        if (count === 0) return null;
                                        return (
                                            <button key={cat.id}
                                                onClick={() => setCatFiltroRonda(catFiltroRonda === cat.nombre ? null : cat.nombre)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                    catFiltroRonda === cat.nombre
                                                        ? 'text-white border-transparent'
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                                }`}
                                                style={catFiltroRonda === cat.nombre ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                                                {cat.nombre} <span className="opacity-70">({count})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Leyenda de columnas */}
                            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <div className="col-span-4">Producto</div>
                                <div className="col-span-2 text-center">Sistema</div>
                                <div className="col-span-2 text-center text-amber-600">Vendido</div>
                                <div className="col-span-2 text-center text-indigo-600">Esperado</div>
                                <div className="col-span-2 text-center text-emerald-600">Contar físico</div>
                            </div>

                            {/* Lista de productos para contar */}
                            <div className="space-y-2">
                                {productosParaRonda.map(item => {
                                    const fr = getFreshness(lastCounted[item.productoId]);
                                    const cfg = FRESH[fr];
                                    const valorStr = conteoValues[item.productoId] || '';
                                    const diff = getDiferenciaRonda(item.productoId, valorStr);
                                    const vendidoDurante = ventasDuranteRonda[item.productoId] || 0;
                                    const stockEsperado = Math.max(0, (rondaActiva.snapshot[item.productoId] ?? item.stockActual) - vendidoDurante);
                                    const contado = valorStr.trim() !== '';

                                    return (
                                        <div key={item.id}
                                            className={`grid grid-cols-12 gap-2 items-center px-4 py-3 rounded-2xl border-2 transition-all ${
                                                contado
                                                    ? diff && Math.abs(diff.diferencia) >= 1
                                                        ? diff.diferencia > 0
                                                            ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'
                                                            : 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
                                                        : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'
                                                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                                            }`}>
                                            {/* Nombre */}
                                            <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                <span className="text-sm shrink-0">{cfg.icon}</span>
                                                <div className="min-w-0">
                                                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">{item.producto?.nombre}</p>
                                                    <p className="text-[9px] text-muted-foreground truncate">{item.producto?.categoria}</p>
                                                </div>
                                            </div>

                                            {/* Sistema (snapshot) */}
                                            <div className="col-span-2 text-center">
                                                <p className="font-black text-sm text-slate-700 dark:text-slate-300">
                                                    {rondaActiva.snapshot[item.productoId] ?? item.stockActual}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground">sistema</p>
                                            </div>

                                            {/* Vendido durante */}
                                            <div className="col-span-2 text-center">
                                                <p className={`font-black text-sm ${vendidoDurante > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {vendidoDurante > 0 ? `-${vendidoDurante}` : '—'}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground">vendido</p>
                                            </div>

                                            {/* Esperado */}
                                            <div className="col-span-2 text-center">
                                                <p className="font-black text-sm text-indigo-600">{stockEsperado}</p>
                                                <p className="text-[9px] text-muted-foreground">esperado</p>
                                            </div>

                                            {/* Input físico + diferencia */}
                                            <div className="col-span-2 flex flex-col items-center gap-1">
                                                <Input
                                                    type="number" min="0"
                                                    placeholder="0"
                                                    value={valorStr}
                                                    onChange={e => setConteoValues(prev => ({ ...prev, [item.productoId]: e.target.value }))}
                                                    className="h-8 text-center font-black text-sm rounded-xl border-2 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 bg-white dark:bg-slate-800 w-full"
                                                />
                                                {diff && (
                                                    <span className={`text-[9px] font-black ${
                                                        Math.abs(diff.diferencia) < 1 ? 'text-emerald-600'
                                                        : diff.diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                                                    }`}>
                                                        {Math.abs(diff.diferencia) < 1 ? '✓ OK'
                                                            : diff.diferencia > 0 ? `+${diff.diferencia.toFixed(0)} sobrante`
                                                            : `${diff.diferencia.toFixed(0)} faltante`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Botón finalizar abajo */}
                            {productosContados > 0 && (
                                <div className="sticky bottom-4">
                                    <Button onClick={finalizarRonda}
                                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm border-none shadow-2xl shadow-emerald-600/30 gap-3">
                                        <CheckCircle2 className="w-5 h-5" />
                                        Finalizar Ronda #{rondaActiva.numero} · {productosContados} productos contados
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB — STOCK EN VIVO
            ════════════════════════════════════════════════════════ */}
            {tab === 'stock' && (
                <div className="space-y-4 animate-ag-fade-in">
                    {/* Filtros */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre o categoría..."
                                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                autoComplete="off"
                                className="pl-9 rounded-xl" />
                            {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"><X className="w-4 h-4" /></button>}
                        </div>
                        {canEdit && (
                            <Button onClick={() => setShowAjusteMasivo(true)} variant="outline"
                                className="h-10 px-4 rounded-xl font-black text-xs uppercase gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 shrink-0">
                                <ListOrdered className="w-4 h-4" /> Ajuste Masivo
                            </Button>
                        )}
                        <div className="flex gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                            {(['todos', 'ok', 'bajo', 'agotado'] as const).map(f => (
                                <button key={f} onClick={() => setFiltroEstado(f)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        filtroEstado === f
                                            ? f === 'todos' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                            : f === 'ok' ? 'bg-emerald-600 text-white'
                                            : f === 'bajo' ? 'bg-amber-600 text-white'
                                            : 'bg-red-600 text-white'
                                            : 'text-slate-400 hover:text-slate-700'
                                    }`}>
                                    {f === 'todos' ? `Todos (${stats.total})` : f === 'ok' ? `OK (${stats.ok})` : f === 'bajo' ? `Bajo (${stats.bajo})` : `Agotado (${stats.agotado})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chips de categoría */}
                    {categorias.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setCatFiltroStock(null)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    catFiltroStock === null
                                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-transparent'
                                        : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                }`}>
                                Todas
                            </button>
                            {categorias.map(cat => {
                                const count = inventarioConProducto.filter(i => i.producto?.categoria === cat.nombre).length;
                                if (count === 0) return null;
                                return (
                                    <button key={cat.id}
                                        onClick={() => setCatFiltroStock(catFiltroStock === cat.nombre ? null : cat.nombre)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                                            catFiltroStock === cat.nombre
                                                ? 'text-white border-transparent'
                                                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                        style={catFiltroStock === cat.nombre ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                                        {cat.nombre} <span className="opacity-70">({count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Lista de stock */}
                    <div className="space-y-2">
                        {inventarioFiltrado.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="font-bold uppercase tracking-widest text-xs">Sin resultados</p>
                            </div>
                        ) : inventarioFiltrado.map(item => {
                            const fr = getFreshness(lastCounted[item.productoId]);
                            const cfg = FRESH[fr];
                            const pct = item.stockMinimo > 0 ? Math.min(100, (item.stockActual / (item.stockMinimo * 3)) * 100) : 100;
                            return (
                                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {/* Indicador estado */}
                                        <div className={`w-2 h-10 rounded-full shrink-0 ${
                                            item.status === 'ok' ? 'bg-emerald-500' :
                                            item.status === 'bajo' ? 'bg-amber-500' : 'bg-red-500'
                                        }`} />
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-sm text-slate-900 dark:text-white truncate">{item.producto?.nombre}</span>
                                                <span className="text-[9px] font-black uppercase">{cfg.icon}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">{item.producto?.categoria}</p>
                                            {/* Barra de stock */}
                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden w-full max-w-xs">
                                                <div className={`h-full rounded-full transition-all ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        {/* Stock + mínimo */}
                                        <div className="text-right shrink-0">
                                            <p className="text-xl font-black text-slate-900 dark:text-white">{item.stockActual}</p>
                                            <p className="text-[9px] text-muted-foreground">mín: {item.stockMinimo}</p>
                                        </div>
                                        {/* Ajuste rápido + historial */}
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => setHistorialProductoId(item.productoId)}
                                                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors" title="Ver historial">
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            {canEdit && (
                                                <>
                                                    <button
                                                        onClick={() => setAjusteModal({ productoId: item.productoId, tipo: 'salida' })}
                                                        className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 flex items-center justify-center font-black text-lg transition-colors">-</button>
                                                    <button
                                                        onClick={() => setAjusteModal({ productoId: item.productoId, tipo: 'entrada' })}
                                                        className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center font-black text-lg transition-colors">+</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB — ROTACIÓN
            ════════════════════════════════════════════════════════ */}
            {tab === 'rotacion' && (
                <div className="space-y-4 animate-ag-fade-in">
                    {/* KPIs rotación */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Alta rotación', value: rotacion.filter(r => r.vendidos30 >= 10).length, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', icon: Flame },
                            { label: 'Rotación media', value: rotacion.filter(r => r.vendidos30 > 0 && r.vendidos30 < 10).length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', icon: TrendingUp },
                            { label: 'Sin movimiento', value: topLentos.length, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', icon: Turtle },
                        ].map(kpi => (
                            <div key={kpi.label} className={`${kpi.bg} rounded-2xl p-4 border border-transparent`}>
                                <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2 opacity-80`} />
                                <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{kpi.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabla completa de rotación */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <p className="text-sm font-black text-slate-900 dark:text-white">Rotación por Producto — Últimos 30 días</p>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{rotacion.length} productos</span>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {rotacion.map((item, i) => {
                                const pct = rotacion[0]?.vendidos30 > 0
                                    ? (item.vendidos30 / rotacion[0].vendidos30) * 100
                                    : 0;
                                const barColor = item.vendidos30 >= 10 ? 'bg-orange-500'
                                    : item.vendidos30 > 0 ? 'bg-amber-400'
                                    : 'bg-slate-200 dark:bg-slate-700';
                                return (
                                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <span className="text-[10px] font-black text-slate-300 w-5 text-right shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs text-slate-800 dark:text-white truncate">{item.producto?.nombre}</span>
                                                <span className="text-[9px] text-slate-400 font-bold shrink-0">{item.producto?.categoria}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 w-20">
                                            <p className={`text-sm font-black tabular-nums ${item.vendidos30 > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                                {item.vendidos30} uds
                                            </p>
                                            <p className="text-[9px] text-slate-400 font-bold">
                                                {item.diasStock < 999 && item.diasStock > 0
                                                    ? `${item.diasStock}d stock`
                                                    : item.stockActual > 0 ? 'sin ventas' : 'agotado'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB — ANALÍTICA
            ════════════════════════════════════════════════════════ */}
            {tab === 'analitica' && (
                <div className="space-y-4 animate-ag-fade-in">
                    {/* KPIs analítica */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-5 border border-red-100 dark:border-red-900/40">
                            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">Pérdidas Operativas</p>
                            <p className="text-2xl font-black text-red-700 dark:text-red-400">{formatCurrency(reporteStats.totalPerdida)}</p>
                            <p className="text-xs text-red-500 mt-1">en ajustes y rondas</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/40">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-2">Recuperaciones</p>
                            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(reporteStats.totalGanancia)}</p>
                            <p className="text-xs text-emerald-500 mt-1">stock encontrado de más</p>
                        </div>
                    </div>

                    {/* Top pérdidas */}
                    {reporteStats.topPerdidas.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                            <p className="text-sm font-black text-slate-900 dark:text-white mb-4">Top productos con más diferencias</p>
                            <div className="space-y-3">
                                {reporteStats.topPerdidas.map((p, i) => (
                                    <div key={p.nombre} className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-amber-500'}`}>{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-xs text-slate-800 dark:text-white truncate">{p.nombre}</p>
                                            <p className="text-[9px] text-muted-foreground">{p.cantidad} unidades</p>
                                        </div>
                                        <p className="text-sm font-black text-red-600 tabular-nums shrink-0">{formatCurrency(p.valor)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Precios + Stock */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-black text-slate-900 dark:text-white">Precios y Stock — Productos de Venta</p>
                            <Button onClick={handleExportCSV} variant="outline" className="h-8 px-3 rounded-xl font-black text-xs gap-1.5">
                                <Download className="w-3.5 h-3.5" /> Exportar
                            </Button>
                        </div>
                        <PreciosStockTab productos={productos} inventario={inventario} categorias={categorias} formatCurrency={formatCurrency} />
                    </div>
                </div>
            )}

            {/* ── MODAL HISTORIAL POR PRODUCTO ── */}
            {historialProductoId && (() => {
                const prod = getProductoById(historialProductoId);
                const movsProd = movimientos
                    .filter(m => m.productoId === historialProductoId)
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                    .slice(0, 40);
                return (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-ag-fade-in">
                        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="bg-indigo-600 p-5 flex items-center justify-between shrink-0">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Historial de movimientos</p>
                                    <p className="text-base font-black text-white mt-0.5">{prod?.nombre}</p>
                                </div>
                                <button onClick={() => setHistorialProductoId(null)} className="text-white/60 hover:text-white p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-4 space-y-2">
                                {movsProd.length === 0 ? (
                                    <p className="text-center text-slate-400 font-bold text-sm py-8">Sin movimientos registrados</p>
                                ) : movsProd.map(m => (
                                    <div key={m.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${m.tipo === 'entrada' ? 'bg-emerald-50 dark:bg-emerald-950/20' : m.tipo === 'salida' ? 'bg-red-50 dark:bg-red-950/20' : 'bg-indigo-50 dark:bg-indigo-950/20'}`}>
                                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.tipo === 'entrada' ? 'bg-emerald-500' : m.tipo === 'salida' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-xs font-black uppercase tracking-widest ${m.tipo === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : m.tipo === 'salida' ? 'text-red-700 dark:text-red-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
                                                    {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad} uds
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold shrink-0">
                                                    {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 truncate">{m.motivo || 'Sin motivo'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                                <Button onClick={() => setHistorialProductoId(null)} className="w-full h-10 rounded-xl font-black text-xs uppercase bg-slate-900 text-white hover:bg-black">
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── MODAL AJUSTE MASIVO ── */}
            {showAjusteMasivo && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-ag-fade-in">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-5 flex items-center justify-between shrink-0">
                            <div>
                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Inventario</p>
                                <p className="text-base font-black text-white mt-0.5">Ajuste Masivo de Stock</p>
                            </div>
                            <button onClick={() => setShowAjusteMasivo(false)} className="text-white/60 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Motivo del ajuste</p>
                            <input
                                value={motivoMasivo}
                                onChange={e => setMotivoMasivo(e.target.value)}
                                placeholder="ej: Inventario físico mensual, merma, recuento..."
                                className="w-full h-10 px-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-indigo-400"
                            />
                        </div>
                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Ingresa la diferencia (+entrada / -salida). Deja en blanco si no cambia.
                            </p>
                            {inventarioConProducto.map(item => (
                                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <div className={`w-2 h-6 rounded-full shrink-0 ${item.status === 'ok' ? 'bg-emerald-400' : item.status === 'bajo' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-xs text-slate-800 dark:text-white truncate">{item.producto?.nombre}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">Stock actual: {item.stockActual}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => setAjusteMasivo(p => ({ ...p, [item.productoId]: String((parseInt(p[item.productoId] || '0') || 0) - 1) }))}
                                            className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/30 text-red-500 hover:bg-red-200 flex items-center justify-center font-black text-base transition-colors">-</button>
                                        <input
                                            type="number"
                                            value={ajusteMasivo[item.productoId] || ''}
                                            onChange={e => setAjusteMasivo(p => ({ ...p, [item.productoId]: e.target.value }))}
                                            placeholder="0"
                                            className={`w-14 h-7 text-center text-xs font-black rounded-lg border-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors ${ajusteMasivo[item.productoId] && parseInt(ajusteMasivo[item.productoId]) !== 0 ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900'}`}
                                        />
                                        <button onClick={() => setAjusteMasivo(p => ({ ...p, [item.productoId]: String((parseInt(p[item.productoId] || '0') || 0) + 1) }))}
                                            className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center font-black text-base transition-colors">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                            <Button variant="ghost" onClick={() => { setShowAjusteMasivo(false); setAjusteMasivo({}); setMotivoMasivo(''); }}
                                className="flex-1 h-11 rounded-xl font-black uppercase text-xs">Cancelar</Button>
                            <Button onClick={handleAjusteMasivo}
                                className="flex-[2] h-11 rounded-xl font-black uppercase text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                <Save className="w-4 h-4" />
                                Aplicar {Object.values(ajusteMasivo).filter(v => v && parseInt(v) !== 0).length} cambios
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL AJUSTE MANUAL ── */}
            {ajusteModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-ag-fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
                        <div className={`p-6 ${ajusteModal.tipo === 'entrada' ? 'bg-emerald-600' : ajusteModal.tipo === 'salida' ? 'bg-red-600' : 'bg-indigo-600'} text-white`}>
                            <div className="flex items-center justify-between">
                                <p className="font-black uppercase tracking-widest text-sm">
                                    {ajusteModal.tipo === 'entrada' ? 'Entrada de Stock' : ajusteModal.tipo === 'salida' ? 'Salida de Stock' : 'Ajuste Manual'}
                                </p>
                                <button onClick={() => setAjusteModal(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <p className="text-lg font-black mt-2">{getProductoById(ajusteModal.productoId)?.nombre}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Cantidad</p>
                                <Input type="number" autoFocus value={ajusteCantidad} onChange={e => setAjusteCantidad(e.target.value)}
                                    placeholder="0" className="h-14 text-2xl font-black text-center rounded-xl" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Motivo</p>
                                <Input value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)}
                                    placeholder="ej: Vencimiento, daño, conteo físico..." className="h-11 rounded-xl" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setAjusteModal(null)} className="flex-1 h-11 rounded-xl font-black uppercase tracking-widest text-xs">Cancelar</Button>
                                <Button onClick={handleAjuste}
                                    className={`flex-[2] h-11 rounded-xl font-black uppercase tracking-widest text-xs text-white border-none shadow-lg ${
                                        ajusteModal.tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                        ajusteModal.tipo === 'salida' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                    Confirmar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inventario;
