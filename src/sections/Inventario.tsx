import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
    Package, AlertTriangle, MapPin, Plus, Minus, Search,
    TrendingDown, TrendingUp, CheckCircle, ClipboardList, Filter, PieChart, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Producto, InventarioItem, MovimientoInventario, Categoria, PrecioProveedor } from '@/types';

interface InventarioProps {
    productos: Producto[];
    inventario: InventarioItem[];
    movimientos: MovimientoInventario[];
    categorias: Categoria[];
    precios: PrecioProveedor[];
    onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => void;
    formatCurrency: (value: number) => string;
    getProductoById: (id: string) => Producto | undefined;
}

export function Inventario({
    productos,
    inventario,
    movimientos,
    categorias,
    precios,
    onAjustarStock,
    getProductoById,
    formatCurrency
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

    // Lógica del Reporte de Diferencias
    const reporteStats = useMemo(() => {
        const ajustes = movimientos.filter(m => m.tipo === 'ajuste');
        let totalPerdida = 0;
        let totalGanancia = 0;
        const productosAfectados = new Map<string, { nombre: string, cantidad: number, valor: number }>();

        ajustes.forEach(m => {
            const producto = getProductoById(m.productoId);
            if (!producto) return;

            // Buscar costo promedio o último costo
            // const precioCosto = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0; // Unused
            // const valorMovimiento = m.cantidad * precioCosto; // Unused

            // En un ajuste, si el motivo empieza con "Auditoría", asumimos corrección.
            // PERO la API de movimientos no dice si fue positivo o negativo el ajuste explícitamente en el tipo 'ajuste'
            // A menos que usemos 'entrada'/'salida' generado por la auditoría.
            // Revisando `handleQuickAudit`, genera 'entrada' o 'salida' con motivo 'Auditoría Rápida'.
            // Entonces filtramos movimientos con ese motivo.
        });

        // Mejor aproximación: Usar todos los movimientos de tipo 'entrada'/'salida' con motivo 'Auditoría Rápida'
        // O cualquier 'ajuste' manual.
        const movimientosAuditoría = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') || m.tipo === 'ajuste'
        );

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
        toast.success(`Stock ${ajusteModal.tipo === 'entrada' ? 'aumentado' : ajusteModal.tipo === 'salida' ? 'reducido' : 'ajustado'} correctamente`);
        setAjusteModal(null);
        setAjusteCantidad('');
        setAjusteMotivo('');
    };

    const handleQuickAudit = (item: InventarioItem, nuevoStock: number) => {
        const diff = nuevoStock - item.stockActual;
        if (diff === 0) return;

        const tipo = diff > 0 ? 'entrada' : 'salida';
        onAjustarStock(item.productoId, Math.abs(diff), tipo, 'Auditoría Rápida');
        toast.success(`Stock actualizado a ${nuevoStock}`);

        // Limpiar el valor manual para mostrar el valor del sistema actualizado
        setAuditValues(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
        });
    };

    const handleExportCSV = () => {
        const movimientosAuditoría = movimientos.filter(m =>
            m.motivo.toLowerCase().includes('auditoría') || m.tipo === 'ajuste'
        );

        if (movimientosAuditoría.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }

        const escapeCsv = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

        const headers = ['ID', 'Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Costo Unitario Est.', 'Valor Total'];
        const rows = movimientosAuditoría.map(m => {
            const producto = getProductoById(m.productoId);
            const precioCosto = precios.find(p => p.productoId === m.productoId)?.precioCosto || 0;
            return [
                m.id,
                new Date(m.fecha).toLocaleDateString() + ' ' + new Date(m.fecha).toLocaleTimeString(),
                producto?.nombre || 'Producto Eliminado',
                m.tipo,
                m.cantidad,
                m.motivo,
                precioCosto.toFixed(2),
                (m.cantidad * precioCosto).toFixed(2)
            ].map(escapeCsv).join(',');
        });

        const csvContent = [
            headers.join(','),
            ...rows
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_diferencias_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Reporte descargado correctamente');
    };

    const statusConfig = {
        ok: { label: 'OK', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
        bajo: { label: 'Bajo', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: TrendingDown },
        agotado: { label: 'Agotado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
    };

    return (
        <div className="space-y-6 animate-ag-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary animate-ag-gradient-shift">
                        Centro de Inventario
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        Control total de existencias y flujo de mercancía
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="glass-card gap-2 transition-ag" onClick={handleExportCSV}>
                        <Download className="w-4 h-4 text-primary" />
                        Exportar Reporte
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="lista" className="w-full space-y-8">
                <div className="flex items-center justify-between bg-white/40 dark:bg-black/20 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-sm w-fit">
                    <TabsList className="bg-transparent h-10 p-0 gap-1">
                        <TabsTrigger value="lista" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-ag">
                            Vista General
                        </TabsTrigger>
                        <TabsTrigger value="auditoria" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-ag">
                            Auditoría Cíclica
                        </TabsTrigger>
                        <TabsTrigger value="reportes" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-ag">
                            Analítica de Diferencias
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="lista" className="space-y-8 animate-ag-fade-in">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { label: 'Total Sku', value: stats.total, icon: Package, color: 'kpi-blue', onClick: () => setFiltroEstado('todos'), active: filtroEstado === 'todos' },
                            { label: 'En Salud', value: stats.ok, icon: CheckCircle, color: 'kpi-emerald', onClick: () => setFiltroEstado('ok'), active: filtroEstado === 'ok' },
                            { label: 'Crítico (Bajo)', value: stats.bajo, icon: TrendingDown, color: 'kpi-amber', onClick: () => setFiltroEstado('bajo'), active: filtroEstado === 'bajo' },
                            { label: 'Agotados', value: stats.agotado, icon: AlertTriangle, color: 'kpi-rose', onClick: () => setFiltroEstado('agotado'), active: filtroEstado === 'agotado' },
                        ].map((kpi) => (
                            <Card
                                key={kpi.label}
                                className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] glass-layer-2 border-white/10 ${kpi.active ? 'ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/5' : ''}`}
                                onClick={kpi.onClick}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className={`p-3 rounded-2xl ${kpi.color} text-white shadow-lg`}>
                                            <kpi.icon className="w-5 h-5" />
                                        </div>
                                        <div className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${kpi.active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground opacity-50'}`}>
                                            {kpi.active ? 'Activo' : 'Ver'}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-black text-foreground">{kpi.value.toString().padStart(2, '0')}</p>
                                        <p className="text-xs font-bold text-muted-foreground uppercase mt-1">{kpi.label}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Búsqueda y Filtros */}
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 group w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Buscar en el inventario activo..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="pl-11 h-12 glass-input rounded-2xl border-white/20 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Tabla principal */}
                    <Card className="glass-card border-white/10 overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-4 border-b">
                            <CardTitle className="text-xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                Gestión de Stock
                                <Badge variant="secondary" className="ml-2 font-mono">{inventarioConProducto.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/20 text-left text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                                            <th className="px-6 py-4 font-bold">Producto</th>
                                            <th className="px-6 py-4 font-bold">Categoría</th>
                                            <th className="px-6 py-4 font-bold text-center">Stock Real</th>
                                            <th className="px-6 py-4 font-bold text-center">Nivel Mínimo</th>
                                            <th className="px-6 py-4 font-bold text-center">Estado</th>
                                            {check('GESTIONAR_INVENTARIO') && <th className="px-6 py-4 font-bold text-right">Ajuste</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {inventarioConProducto.map((item, idx) => {
                                            const conf = statusConfig[item.status as keyof typeof statusConfig];
                                            const Icon = conf.icon;
                                            return (
                                                <tr key={item.id} className={`group hover:bg-primary/5 transition-colors stagger-${(idx % 6) + 1} animate-ag-fade-in`}>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{item.producto!.nombre}</span>
                                                            <span className="text-[10px] flex items-center gap-1 text-muted-foreground mt-0.5"><MapPin className="w-3 h-3" />{item.ubicacion || 'Sin ubicación'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="secondary" className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground border-none">
                                                            {item.producto!.categoria}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-base font-black ${item.status === 'ok' ? 'text-foreground' : item.status === 'bajo' ? 'text-amber-600' : 'text-destructive'}`}>
                                                            {item.stockActual}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-medium text-muted-foreground/60 font-mono">{item.stockMinimo}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${conf.color}`}>
                                                            <Icon className="w-3 h-3" /> {conf.label}
                                                        </div>
                                                    </td>
                                                    {check('GESTIONAR_INVENTARIO') && (
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex gap-1 justify-end">
                                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-primary/20 hover:bg-primary hover:text-white transition-ag"
                                                                    onClick={() => setAjusteModal({ productoId: item.productoId, tipo: 'entrada' })}>
                                                                    <Plus className="w-4 h-4" />
                                                                </Button>
                                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-destructive/20 hover:bg-destructive hover:text-white transition-ag"
                                                                    onClick={() => setAjusteModal({ productoId: item.productoId, tipo: 'salida' })}>
                                                                    <Minus className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {inventarioConProducto.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                                                    No hay productos en inventario con este filtro
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Últimos movimientos */}
                    {movimientos.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">📋 Últimos Movimientos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {movimientos.slice(0, 10).map(mov => {
                                        const producto = getProductoById(mov.productoId);
                                        return (
                                            <div key={mov.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={mov.tipo === 'entrada' ? 'default' : mov.tipo === 'salida' ? 'destructive' : 'secondary'} className="text-xs">
                                                        {mov.tipo === 'entrada' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                        {mov.tipo}
                                                    </Badge>
                                                    <div>
                                                        <p className="text-sm font-medium">{producto?.nombre || 'Desconocido'}</p>
                                                        <p className="text-xs text-muted-foreground">{mov.motivo}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold">{mov.tipo === 'salida' ? '-' : '+'}{mov.cantidad} uds</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(mov.fecha).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* --- MODO AUDITORÍA RÁPIDA --- */}
                <TabsContent value="auditoria" className="mt-6 animate-ag-slide-up">
                    <Card className="border-l-4 border-l-blue-500 mb-6 bg-blue-500/5">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <ClipboardList className="w-6 h-6 text-blue-600 mt-1" />
                                <div>
                                    <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">Modo Auditoría Cíclica</h3>
                                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                                        Realiza conteos rápidos por categoría sin detener la operación.
                                        Los ajustes se guardan automáticamente al confirmar.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-full max-w-xs">
                            <Label className="mb-2 block">Filtrar por Categoría</Label>
                            <Select value={categoriaAuditoria} onValueChange={setCategoriaAuditoria}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas las categorías</SelectItem>
                                    {(categorias || []).map(cat => (
                                        <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 text-right text-sm text-muted-foreground self-end pb-2">
                            Mostrando {itemsAuditoria.length} items para auditar
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {itemsAuditoria.map((item) => (
                            <Card key={item.id} className="overflow-hidden border-t-4 border-t-transparent hover:border-t-primary transition-all shadow-sm hover:shadow-md">
                                <CardContent className="p-4">
                                    <div className="mb-4">
                                        <Badge variant="outline" className="mb-2 text-xs">{item.producto!.categoria}</Badge>
                                        <h3 className="font-bold text-lg leading-tight truncate px-1" title={item.producto!.nombre}>
                                            {item.producto!.nombre}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 px-1">
                                            Sistema: <span className="font-mono font-medium text-foreground">{item.stockActual}</span> uds
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-10 w-10 rounded-full shrink-0"
                                            onClick={() => setAuditValues(prev => ({ ...prev, [item.id]: (prev[item.id] ?? item.stockActual) - 1 }))}
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>

                                        <div className="flex-1 relative">
                                            <Input
                                                type="number"
                                                className="text-center font-bold text-lg h-10"
                                                value={auditValues[item.id] ?? ''}
                                                placeholder={item.stockActual.toString()}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setAuditValues(prev => ({ ...prev, [item.id]: isNaN(val) ? 0 : val }));
                                                }}
                                            />
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-10 w-10 rounded-full shrink-0"
                                            onClick={() => setAuditValues(prev => ({ ...prev, [item.id]: (prev[item.id] ?? item.stockActual) + 1 }))}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <Button
                                        className="w-full mt-4 bg-primary/90 hover:bg-primary"
                                        disabled={auditValues[item.id] === undefined || auditValues[item.id] === item.stockActual}
                                        onClick={() => handleQuickAudit(item, auditValues[item.id]!)}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Confirmar Ajuste
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {itemsAuditoria.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                            <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No hay items en esta categoría para auditar</p>
                        </div>
                    )}
                </TabsContent>

                {/* --- REPORTE DE DIFERENCIAS --- */}
                <TabsContent value="reportes" className="mt-6 animate-ag-scale-in">
                    <div className="flex justify-end mb-4">
                        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                            <Download className="w-4 h-4" />
                            Exportar CSV
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
                                    <TrendingDown className="w-6 h-6" />
                                    Pérdida por Ajustes
                                </CardTitle>
                                <CardDescription>Valor total de stock ajustado negativamente</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold text-red-600 dark:text-red-400">
                                    {formatCurrency(reporteStats.totalPerdida)}
                                </p>
                                <p className="text-sm text-red-600/60 mt-2">
                                    Detectado en auditorías y salidas manuales
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                    <TrendingUp className="w-6 h-6" />
                                    Recuperación / Entradas
                                </CardTitle>
                                <CardDescription>Valor de stock ajustado positivamente</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(reporteStats.totalGanancia)}
                                </p>
                                <p className="text-sm text-emerald-600/60 mt-2">
                                    Productos encontrados o entradas manuales
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>⚠️ Top 5 Productos con más Pérdidas</CardTitle>
                                <CardDescription>Productos que más valor han perdido por ajustes de inventario</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {reporteStats.topPerdidas.length > 0 ? (
                                        reporteStats.topPerdidas.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-foreground">{item.nombre}</p>
                                                        <p className="text-xs text-muted-foreground">{item.cantidad} unidades perdidas</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-red-600">{formatCurrency(item.valor)}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-2" />
                                            <p>¡Excelente! No hay registros de pérdidas significativas.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen Operativo</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Movimientos Analizados</span>
                                        <span className="font-bold">{reporteStats.totalMovimientos}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full w-full"></div>
                                    </div>
                                </div>

                                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10">
                                    <div className="flex items-start gap-3">
                                        <PieChart className="w-5 h-5 text-blue-600" />
                                        <div>
                                            <p className="font-semibold text-blue-800 dark:text-blue-300">Tip de Control</p>
                                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                                Revisa semanalmente el Top 5 de pérdidas para identificar patrones de robo o desperdicio.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal de ajuste (General) */}
            {ajusteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                {ajusteModal.tipo === 'entrada' ? '📥 Entrada de Stock' :
                                    ajusteModal.tipo === 'salida' ? '📤 Salida de Stock' :
                                        '🔄 Ajuste de Stock'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Producto: <strong>{getProductoById(ajusteModal.productoId)?.nombre}</strong>
                            </p>
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <Input type="number" min="1" value={ajusteCantidad} onChange={e => setAjusteCantidad(e.target.value)} placeholder="Ej: 10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Motivo</Label>
                                <Input value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)}
                                    placeholder={ajusteModal.tipo === 'entrada' ? 'Ej: Recepción de mercancía' :
                                        ajusteModal.tipo === 'salida' ? 'Ej: Venta' : 'Ej: Conteo físico'} />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => { setAjusteModal(null); setAjusteCantidad(''); setAjusteMotivo(''); }}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleAjuste}>Confirmar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default Inventario;
