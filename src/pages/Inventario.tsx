import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import { Search, X, ArrowUpDown, ShoppingBag, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Componentes modulares
import { InventoryHeader } from '@/components/inventario/InventoryHeader';
import { InventoryKPIs } from '@/components/inventario/InventoryKPIs';
import { InventoryTable } from '@/components/inventario/InventoryTable';
import { InventoryAudit } from '@/components/inventario/InventoryAudit';
import { InventoryReports } from '@/components/inventario/InventoryReports';

import type { Producto, InventarioItem, MovimientoInventario, Categoria, PrecioProveedor } from '@/types';

// ── Componente interno: Precios + Stock ──────────────────────────────────────
function PreciosStockTab({
    productos,
    inventario,
    categorias,
    formatCurrency,
}: {
    productos: Producto[];
    inventario: InventarioItem[];
    categorias: Categoria[];
    formatCurrency: (v: number) => string;
}) {
    const [busqueda,  setBusqueda]  = useState('');
    const [catFiltro, setCatFiltro] = useState<string | null>(null);
    const [sortKey,   setSortKey]   = useState<'nombre' | 'precioVenta' | 'stock' | 'margenUtilidad'>('nombre');
    const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc');

    const colorDeCat = (nombre: string) =>
        categorias.find(c => c.nombre === nombre)?.color ?? '#6366f1';

    const stockMap = useMemo(() =>
        new Map(inventario.map(i => [i.productoId, i.stockActual ?? 0])),
        [inventario]);

    const catsUnicas = useMemo(() =>
        Array.from(new Set(productos.map(p => p.categoria).filter(Boolean))),
        [productos]);

    const filas = useMemo(() => {
        let lista = productos
            .filter(p => p.tipo === 'elaborado')
            .map(p => ({ ...p, stock: stockMap.get(p.id) ?? 0 }))
            .filter(p => {
                const q = busqueda.toLowerCase();
                const okQ  = !q || p.nombre.toLowerCase().includes(q);
                const okCat = !catFiltro || p.categoria === catFiltro;
                return okQ && okCat;
            });

        lista.sort((a, b) => {
            let cmp = 0;
            if      (sortKey === 'nombre')          cmp = a.nombre.localeCompare(b.nombre);
            else if (sortKey === 'precioVenta')      cmp = a.precioVenta - b.precioVenta;
            else if (sortKey === 'stock')            cmp = a.stock - b.stock;
            else if (sortKey === 'margenUtilidad')   cmp = a.margenUtilidad - b.margenUtilidad;
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

    const colorMargen = (m: number) => {
        if (m >= 30) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (m >= 15) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    };

    const exportarCSV = () => {
        const csv = [
            ['Producto', 'Categoría', 'Precio Venta', 'Stock', 'Margen %'].join(','),
            ...filas.map(p => [`"${p.nombre}"`, `"${p.categoria}"`, p.precioVenta, p.stock, `${p.margenUtilidad}%`].join(','))
        ].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `precios-stock-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4">
            {/* KPIs rápidos */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Productos Venta', valor: filas.length,                                            color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                    { label: 'Precio Promedio',  valor: filas.length ? formatCurrency(filas.reduce((s,p) => s + p.precioVenta, 0) / filas.length) : '$0', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
                    { label: 'Margen Promedio',  valor: filas.length ? `${(filas.reduce((s,p) => s + p.margenUtilidad, 0) / filas.length).toFixed(1)}%` : '0%', color: 'text-amber-600', bg: 'bg-amber-500/10' },
                ].map(({ label, valor, color, bg }) => (
                    <div key={label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                        <p className={`text-xl font-black tabular-nums mt-1 ${color}`}>{valor}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex gap-3 flex-wrap items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-10 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <Button onClick={exportarCSV} variant="outline"
                        className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:border-emerald-300 hover:text-emerald-600 gap-2 shrink-0">
                        <Download className="w-4 h-4" /> CSV
                    </Button>
                </div>
                {catsUnicas.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <button onClick={() => setCatFiltro(null)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                !catFiltro ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 hover:border-slate-400'
                            }`}>
                            Todos
                        </button>
                        {catsUnicas.map(cat => {
                            const color = colorDeCat(cat);
                            const activa = catFiltro === cat;
                            return (
                                <button key={cat} onClick={() => setCatFiltro(activa ? null : cat)}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all"
                                    style={activa
                                        ? { backgroundColor: color, borderColor: color, color: '#fff' }
                                        : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#475569' }
                                    }>
                                    <span className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: activa ? 'rgba(255,255,255,0.8)' : color }} />
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                <th className="px-4 py-3 text-left">
                                    <button onClick={() => ordenar('nombre')} className="flex items-center font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">
                                        Producto {iconO('nombre')}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">Categoría</th>
                                <th className="px-4 py-3 text-right">
                                    <button onClick={() => ordenar('precioVenta')} className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">
                                        Precio {iconO('precioVenta')}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-center">
                                    <button onClick={() => ordenar('stock')} className="flex items-center mx-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">
                                        Stock {iconO('stock')}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button onClick={() => ordenar('margenUtilidad')} className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">
                                        Margen {iconO('margenUtilidad')}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filas.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sin productos</p>
                                    </td>
                                </tr>
                            ) : filas.map(p => {
                                const cat = colorDeCat(p.categoria);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: cat + '20' }}>
                                                    <ShoppingBag className="w-3.5 h-3.5" style={{ color: cat }} />
                                                </div>
                                                <span className="font-bold text-slate-800 dark:text-white">{p.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                                style={{ backgroundColor: cat + '18', color: cat }}>
                                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat }} />
                                                {p.categoria || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-emerald-600 tabular-nums text-sm">
                                                {formatCurrency(p.precioVenta)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tabular-nums ${
                                                p.stock > 10 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : p.stock > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                            }`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${colorMargen(p.margenUtilidad)}`}>
                                                {p.margenUtilidad}%
                                            </span>
                                        </td>
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

export function Inventario({
    productos,
    inventario,
    movimientos,
    categorias,
    precios,
    onAjustarStock,
    getProductoById,
    formatCurrency,
    onGenerarSugerencias,
    onViewPrePedidos,
}: InventarioProps) {
    const { check } = useCan();
    const [busqueda, setBusqueda] = useState('');
    const [ajusteModal, setAjusteModal] = useState<{ productoId: string; tipo: 'entrada' | 'salida' | 'ajuste' } | null>(null);
    const [ajusteCantidad, setAjusteCantidad] = useState('');
    const [ajusteMotivo, setAjusteMotivo] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'ok' | 'bajo' | 'agotado'>('todos');

    // Estado para Auditoría
    const [categoriaAuditoria, setCategoriaAuditoria] = useState<string>('todas');
    const [auditValues, setAuditValues] = useState<Record<string, number>>({});

    const getStockStatus = (item: InventarioItem) => {
        if (item.stockActual <= 0) return 'agotado';
        if (item.stockActual <= item.stockMinimo) return 'bajo';
        return 'ok';
    };

    const inventarioConProducto = useMemo(() => {
        return inventario
            .map(item => {
                const producto = getProductoById(item.productoId);
                return { ...item, producto, status: getStockStatus(item) };
            })
            .filter(item => item.producto)
            .filter(item => {
                if (filtroEstado !== 'todos' && item.status !== filtroEstado) return false;
                if (busqueda) {
                    const search = busqueda.toLowerCase();
                    return item.producto!.nombre.toLowerCase().includes(search) ||
                        item.producto!.categoria.toLowerCase().includes(search);
                }
                return true;
            });
    }, [inventario, productos, busqueda, filtroEstado, getProductoById]);

    const itemsAuditoria = useMemo(() => {
        return inventario
            .map(item => ({ ...item, producto: getProductoById(item.productoId) }))
            .filter(item => item.producto)
            .filter(item => categoriaAuditoria === 'todas' || item.producto!.categoria === categoriaAuditoria);
    }, [inventario, categoriaAuditoria, getProductoById]);

    const reporteStats = useMemo(() => {
        const movimientosAuditoría = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') || m.tipo === 'ajuste'
        );

        let totalPerdida = 0;
        let totalGanancia = 0;
        const productosAfectados = new Map<string, { nombre: string, cantidad: number, valor: number }>();

        movimientosAuditoría.forEach(m => {
            const producto = getProductoById(m.productoId);
            if (!producto) return;
            const precioCosto = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0;
            const valor = m.cantidad * precioCosto;

            if (m.tipo === 'salida') {
                totalPerdida += valor;
                const current = productosAfectados.get(m.productoId) || { nombre: producto.nombre, cantidad: 0, valor: 0 };
                productosAfectados.set(m.productoId, { ...current, cantidad: current.cantidad + m.cantidad, valor: current.valor + valor });
            } else if (m.tipo === 'entrada') {
                totalGanancia += valor;
            }
        });

        const topPerdidas = Array.from(productosAfectados.values())
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5);

        return { totalPerdida, totalGanancia, topPerdidas, totalMovimientos: movimientosAuditoría.length };
    }, [movimientos, precios, getProductoById]);

    const stats = useMemo(() => ({
        total: inventario.length,
        ok: inventario.filter(i => getStockStatus(i) === 'ok').length,
        bajo: inventario.filter(i => getStockStatus(i) === 'bajo').length,
        agotado: inventario.filter(i => getStockStatus(i) === 'agotado').length,
    }), [inventario]);

    const handleAjuste = () => {
        if (!ajusteModal || !ajusteCantidad || !ajusteMotivo) {
            toast.error('Completa todos los campos');
            return;
        }
        const cantidad = parseInt(ajusteCantidad);
        if (isNaN(cantidad) || cantidad <= 0) {
            toast.error('Cantidad inválida');
            return;
        }
        onAjustarStock(ajusteModal.productoId, cantidad, ajusteModal.tipo, ajusteMotivo);
        setAjusteModal(null);
        setAjusteCantidad('');
        setAjusteMotivo('');
        toast.success('Ajuste aplicado');
    };

    const handleQuickAudit = (item: InventarioItem, nuevoStock: number) => {
        const diff = nuevoStock - item.stockActual;
        if (diff === 0) return;
        const tipo = diff > 0 ? 'entrada' : 'salida';
        onAjustarStock(item.productoId, Math.abs(diff), tipo, 'Auditoría Rápida');
        setAuditValues(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
        });
        toast.success('Auditoría sincronizada');
    };

    const handleExportCSV = () => {
        const movimientosAuditoría = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') || m.tipo === 'ajuste'
        );
        if (movimientosAuditoría.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }
        const csvContent = [
            ['ID', 'Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Valor'].join(','),
            ...movimientosAuditoría.map(m => {
                const prod = getProductoById(m.productoId);
                const costo = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0;
                return [m.id, m.fecha, prod?.nombre || 'N/A', m.tipo, m.cantidad, m.motivo, (m.cantidad * costo).toFixed(2)].join(',');
            })
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleGenerarSugerencias = () => {
        toast.info('IA Yimi analizando consumos...', { description: 'Generando sugerencias de reposición basadas en el historial de ventas.' });
        onGenerarSugerencias?.();
        if (onViewPrePedidos) setTimeout(() => onViewPrePedidos(), 500);
    };

    return (
        <div className="space-y-6 h-full flex flex-col p-4 md:p-8 animate-ag-fade-in bg-[#f8fafc] dark:bg-[#0f172a] overflow-y-auto">
            <InventoryHeader
                onHandleGenerarSugerencias={handleGenerarSugerencias}
                onExportCSV={handleExportCSV}
            />

            <Tabs defaultValue="lista" className="w-full flex flex-col gap-6">
                <div className="overflow-x-auto pb-1">
                <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-fit self-start min-w-max">
                    <TabsList className="bg-transparent h-auto p-0 gap-1">
                        <TabsTrigger value="lista" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Vista General
                        </TabsTrigger>
                        <TabsTrigger value="auditoria" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Auditoría Cíclica
                        </TabsTrigger>
                        <TabsTrigger value="reportes" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Analítica Diferencias
                        </TabsTrigger>
                        <TabsTrigger value="precios" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all">
                            Precios + Stock
                        </TabsTrigger>
                    </TabsList>
                </div>
                </div>

                <TabsContent value="lista" className="space-y-10 mt-0 animate-ag-scale-in">
                    <InventoryKPIs
                        stats={stats}
                        filtroEstado={filtroEstado}
                        setFiltroEstado={setFiltroEstado}
                    />

                    <div className="relative max-w-xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre o categoría..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-11 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <InventoryTable
                        items={inventarioConProducto}
                        movimientos={movimientos}
                        onAjustarStock={(id, tipo) => setAjusteModal({ productoId: id, tipo })}
                        checkPermission={check}
                    />
                </TabsContent>

                <TabsContent value="auditoria" className="mt-0 animate-ag-slide-up">
                    <InventoryAudit
                        items={itemsAuditoria}
                        categorias={categorias}
                        categoriaAuditoria={categoriaAuditoria}
                        setCategoriaAuditoria={setCategoriaAuditoria}
                        auditValues={auditValues}
                        setAuditValues={setAuditValues}
                        handleQuickAudit={handleQuickAudit}
                    />
                </TabsContent>

                <TabsContent value="reportes" className="mt-0 animate-ag-pop-in">
                    <InventoryReports
                        reporteStats={reporteStats}
                        onExportCSV={handleExportCSV}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* ── TAB PRECIOS + STOCK ───────────────────────────────── */}
                <TabsContent value="precios" className="mt-0 animate-ag-fade-in">
                    <PreciosStockTab
                        productos={productos}
                        inventario={inventario}
                        categorias={categorias}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>
            </Tabs>

            {/* Modal de ajuste manual */}
            {ajusteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-ag-fade-in">
                    <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900 p-0">
                        <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-8 relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-6 top-6 text-white/40 hover:text-white"
                                onClick={() => setAjusteModal(null)}
                            >
                                <X className="w-6 h-6" />
                            </Button>
                            <CardTitle className="text-2xl font-black uppercase tracking-tight">
                                {ajusteModal.tipo === 'entrada' ? 'Recepción Stock' : ajusteModal.tipo === 'salida' ? 'Retiro Stock' : 'Ajuste Manual'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 space-y-8">
                            <div className="flex flex-col items-center text-center">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Producto Seleccionado</span>
                                <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">{getProductoById(ajusteModal.productoId)?.nombre}</h4>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Cantidad Unidades</Label>
                                <Input
                                    type="number"
                                    autoFocus
                                    value={ajusteCantidad}
                                    onChange={e => setAjusteCantidad(e.target.value)}
                                    className="h-16 text-2xl sm:text-3xl font-black text-center bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner"
                                    placeholder="00"
                                />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Justificación / Motivo</Label>
                                <Input
                                    value={ajusteMotivo}
                                    onChange={e => setAjusteMotivo(e.target.value)}
                                    className="h-14 font-bold bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                                    placeholder="Ej: Auditoría física, vencimiento..."
                                />
                            </div>

                            <div className="flex gap-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setAjusteModal(null)}
                                    className="h-14 flex-1 font-black uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAjuste}
                                    className="h-14 flex-[2] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30 border-none"
                                >
                                    Confirmar Operación
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default Inventario;
