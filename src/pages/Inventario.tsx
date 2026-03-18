import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import { Search, X } from 'lucide-react';
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
    };

    return (
        <div className="space-y-4 animate-ag-fade-in">
            <InventoryHeader
                onHandleGenerarSugerencias={handleGenerarSugerencias}
                onExportCSV={handleExportCSV}
            />

            <Tabs defaultValue="lista" className="w-full h-full flex flex-col gap-8">
                <div className="flex items-center justify-between bg-white/40 dark:bg-gray-900/40 p-2 rounded-[2rem] backdrop-blur-md border border-white/20 shadow-xl w-fit self-center md:self-start">
                    <TabsList className="bg-transparent h-12 p-0 gap-2">
                        <TabsTrigger value="lista" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Vista General
                        </TabsTrigger>
                        <TabsTrigger value="auditoria" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Auditoría Cíclica
                        </TabsTrigger>
                        <TabsTrigger value="reportes" className="rounded-2xl px-8 h-10 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                            Analítica Diferencias
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="lista" className="space-y-10 mt-0 animate-ag-scale-in">
                    <InventoryKPIs
                        stats={stats}
                        filtroEstado={filtroEstado}
                        setFiltroEstado={setFiltroEstado}
                    />

                    <div className="relative group max-w-2xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
                        <Input
                            placeholder="Identificar producto por nombre o código..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-14 h-16 bg-white/60 dark:bg-gray-900/60 border-none rounded-[1.5rem] shadow-xl text-lg font-black tracking-tight focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                        />
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
            </Tabs>

            {/* Modal de ajuste manual */}
            {ajusteModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-ag-fade-in">
                    <Card className="w-full max-w-md rounded-[3rem] border-none shadow-3xl overflow-hidden bg-white dark:bg-gray-900 p-0">
                        <CardHeader className="bg-slate-900 text-white p-8 relative">
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
                                    className="h-16 text-3xl font-black text-center bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner"
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
