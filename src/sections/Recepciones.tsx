import { useState, useMemo, useRef } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
    Upload, CheckCircle, X, Plus, Calendar,
    Search, Eye, Download, Image as ImageIcon,
    ArrowLeft, Package, GitCompareArrows, AlertTriangle,
    TrendingUp, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Producto, Proveedor, Recepcion, RecepcionItem, PrePedido } from '@/types';

interface RecepcionesProps {
    recepciones: Recepcion[];
    proveedores: Proveedor[];
    productos: Producto[];
    prepedidos: PrePedido[];
    onAddRecepcion: (data: Omit<Recepcion, 'id'>) => Promise<Recepcion>;
    onConfirmarRecepcion: (recepcion: Recepcion) => Promise<void>;
    getProveedorById: (id: string) => Proveedor | undefined;
    getProductoById: (id: string) => Producto | undefined;
    formatCurrency: (value: number) => string;
}

export default function Recepciones({
    recepciones,
    proveedores,
    productos,
    prepedidos,
    onAddRecepcion,
    onConfirmarRecepcion,
    getProveedorById,
    getProductoById,
    formatCurrency
}: RecepcionesProps) {
    const { check } = useCan();
    const [view, setView] = useState<'list' | 'new' | 'details'>('list');
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos');
    const [prePedidoSeleccionado, setPrePedidoSeleccionado] = useState<string>('');

    // Pre-pedidos confirmados disponibles para vincular
    const prepedidosConfirmados = useMemo(() =>
        prepedidos.filter(p => p.estado === 'confirmado'),
        [prepedidos]);

    // Estado para nueva recepción
    const [newRecepcion, setNewRecepcion] = useState<{
        proveedorId: string;
        prePedidoId?: string;
        numeroFactura: string;
        fechaFactura: string;
        imagenFactura: string | null;
        items: RecepcionItem[];
        observaciones: string;
    }>({
        proveedorId: '',
        prePedidoId: undefined,
        numeroFactura: '',
        fechaFactura: new Date().toISOString().split('T')[0],
        imagenFactura: null,
        items: [],
        observaciones: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Vincular pre-pedido: auto-rellena items esperados
    const handleVincularPrePedido = (pedidoId: string) => {
        setPrePedidoSeleccionado(pedidoId);
        if (!pedidoId) {
            setNewRecepcion(prev => ({ ...prev, prePedidoId: undefined, proveedorId: '', items: [] }));
            return;
        }
        const pedido = prepedidos.find(p => p.id === pedidoId);
        if (!pedido) return;

        const itemsDesdePrePedido: RecepcionItem[] = pedido.items.map(item => ({
            id: crypto.randomUUID(),
            productoId: item.productoId,
            cantidadEsperada: item.cantidad,
            cantidadRecibida: item.cantidad, // Pre-rellenado con lo esperado
            precioEsperado: item.precioUnitario,
            precioFacturado: item.precioUnitario, // Pre-rellenado
            embalajeOk: true,
            productoOk: true,
            cantidadOk: true,
            modeloOk: true,
            defectuosos: 0,
            observaciones: ''
        }));

        setNewRecepcion(prev => ({
            ...prev,
            prePedidoId: pedidoId,
            proveedorId: pedido.proveedorId,
            items: itemsDesdePrePedido
        }));
        toast.success(`Pre-pedido vinculado: ${pedido.items.length} productos cargados`);
    };

    // Filtrar recepciones
    const filteredRecepciones = useMemo(() => {
        return recepciones.filter(r => {
            const matchesSearch = r.numeroFactura.toLowerCase().includes(busqueda.toLowerCase()) ||
                getProveedorById(r.proveedorId)?.nombre.toLowerCase().includes(busqueda.toLowerCase());
            const matchesProveedor = proveedorFiltro === 'todos' || r.proveedorId === proveedorFiltro;
            return matchesSearch && matchesProveedor;
        }).sort((a, b) => new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime());
    }, [recepciones, busqueda, proveedorFiltro, getProveedorById]);

    // Manejar subida de imagen
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewRecepcion(prev => ({ ...prev, imagenFactura: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    // Agregar Item a la recepción
    const handleAddItem = (productoId: string) => {
        const producto = getProductoById(productoId);
        if (!producto) return;

        const newItem: RecepcionItem = {
            id: crypto.randomUUID(),
            productoId,
            cantidadEsperada: 0,
            cantidadRecibida: 1,
            precioEsperado: 0,
            precioFacturado: 0,
            embalajeOk: true,
            productoOk: true,
            cantidadOk: true,
            modeloOk: true,
            defectuosos: 0,
            observaciones: ''
        };

        setNewRecepcion(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    // Actualizar Item
    const handleUpdateItem = (id: string, updates: Partial<RecepcionItem>) => {
        setNewRecepcion(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i)
        }));
    };

    // Guardar Recepción
    const handleSave = async () => {
        if (!newRecepcion.proveedorId || !newRecepcion.numeroFactura || newRecepcion.items.length === 0) {
            toast.error('Por favor completa los campos obligatorios y agrega al menos un producto.');
            return;
        }

        try {
            const total = newRecepcion.items.reduce((sum, item) => sum + (item.cantidadRecibida * item.precioFacturado), 0);

            const recepcionData: Omit<Recepcion, 'id'> = {
                prePedidoId: newRecepcion.prePedidoId,
                proveedorId: newRecepcion.proveedorId,
                numeroFactura: newRecepcion.numeroFactura,
                fechaFactura: new Date(newRecepcion.fechaFactura).toISOString(),
                totalFactura: total,
                items: newRecepcion.items,
                estado: 'en_proceso',
                recibidoPor: 'Usuario Actual',
                fechaRecepcion: new Date().toISOString(),
                imagenFactura: newRecepcion.imagenFactura || undefined,
                observaciones: newRecepcion.observaciones
            };

            const saved = await onAddRecepcion(recepcionData);
            await onConfirmarRecepcion(saved);

            toast.success('Recepción guardada y procesada correctamente');
            setView('list');
            setPrePedidoSeleccionado('');
            setNewRecepcion({
                proveedorId: '',
                prePedidoId: undefined,
                numeroFactura: '',
                fechaFactura: new Date().toISOString().split('T')[0],
                imagenFactura: null,
                items: [],
                observaciones: ''
            });
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la recepción');
        }
    };

    if (view === 'new') {
        return (
            <div className="space-y-6 animate-ag-fade-in pb-12">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => setView('list')} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <h1 className="text-2xl font-bold">Nueva Recepción</h1>
                </div>

                {/* Selector de Pre-Pedido */}
                {prepedidosConfirmados.length > 0 && (
                    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <GitCompareArrows className="w-5 h-5 text-primary" />
                                <div className="flex-1">
                                    <Label className="text-sm font-semibold">Vincular a Pre-Pedido</Label>
                                    <p className="text-xs text-muted-foreground">Selecciona un pedido para comparar lo pedido vs lo recibido</p>
                                </div>
                                <select
                                    className="w-64 p-2 rounded-md border bg-background text-sm"
                                    value={prePedidoSeleccionado}
                                    onChange={(e) => handleVincularPrePedido(e.target.value)}
                                >
                                    <option value="">Sin vincular (recepción libre)</option>
                                    {prepedidosConfirmados.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre} — {getProveedorById(p.proveedorId)?.nombre} ({formatCurrency(p.total)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Datos Generales */}
                    <Card className="lg:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle>Datos de Factura</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newRecepcion.proveedorId}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, proveedorId: e.target.value }))}
                                >
                                    <option value="">Seleccionar Proveedor</option>
                                    {proveedores.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Nº Factura</Label>
                                <Input
                                    value={newRecepcion.numeroFactura}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, numeroFactura: e.target.value }))}
                                    placeholder="F-12345"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha Factura</Label>
                                <Input
                                    type="date"
                                    value={newRecepcion.fechaFactura}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, fechaFactura: e.target.value }))}
                                />
                            </div>

                            {/* Carga de Imagen */}
                            <div className="space-y-2 pt-4 border-t">
                                <Label>Escaneo / Foto de Factura</Label>
                                <div
                                    className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {newRecepcion.imagenFactura ? (
                                        <div className="relative">
                                            <img
                                                src={newRecepcion.imagenFactura}
                                                alt="Factura"
                                                className="max-h-48 mx-auto rounded-md shadow-sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="absolute top-2 right-2 h-6 w-6 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNewRecepcion(prev => ({ ...prev, imagenFactura: null }));
                                                }}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Upload className="w-5 h-5 text-primary" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">Click para subir o tomar foto</p>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Checklist de Productos */}
                    <Card className="lg:col-span-2 shadow-2xl border-white/10 glass-card">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100/50">
                            <div>
                                <CardTitle>Checklist de Recepción</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">Verifica el estado físico de cada producto</p>
                            </div>
                            <div className="flex gap-2">
                                {newRecepcion.items.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[10px] font-black h-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                        onClick={() => {
                                            setNewRecepcion(prev => ({
                                                ...prev,
                                                items: prev.items.map(i => ({ ...i, productoOk: true, embalajeOk: true, cantidadOk: true }))
                                            }));
                                            toast.success('Todos los items marcados como OK');
                                        }}
                                    >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        MARCAR TODO OK
                                    </Button>
                                )}
                                <select
                                    className="text-sm p-2 rounded-md border bg-background w-48 h-8"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleAddItem(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                >
                                    <option value="">+ Agregar Producto</option>
                                    {productos.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {newRecepcion.items.length === 0 ? (
                                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl bg-slate-50/50">
                                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20 text-blue-500" />
                                        <p className="font-medium">No hay productos en la lista</p>
                                        <p className="text-xs">Usa el buscador o vincula un pre-pedido para comenzar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {newRecepcion.items.map((item) => (
                                            <div key={item.id} className="p-4 border rounded-2xl bg-white/50 hover:bg-white transition-all shadow-sm hover:shadow-md border-white/20">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800">{getProductoById(item.productoId)?.nombre}</h4>
                                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">SKU: {item.productoId.slice(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-red-50 hover:text-red-500" onClick={() => setNewRecepcion(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Recibido</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={item.cantidadRecibida}
                                                            onChange={e => handleUpdateItem(item.id, { cantidadRecibida: parseInt(e.target.value) })}
                                                            className="h-10 rounded-xl font-bold bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Costo Factura</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.precioFacturado}
                                                            onChange={e => handleUpdateItem(item.id, { precioFacturado: parseFloat(e.target.value) })}
                                                            className="h-10 rounded-xl font-bold bg-white"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex items-end gap-2">
                                                        <div
                                                            className={`flex-1 h-10 flex items-center justify-center rounded-xl text-[10px] font-black border cursor-pointer transition-all ${item.embalajeOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-200/50' : 'bg-red-50 border-red-200 text-red-700'}`}
                                                            onClick={() => handleUpdateItem(item.id, { embalajeOk: !item.embalajeOk })}
                                                        >
                                                            {item.embalajeOk ? '✓ EMBALAJE OK' : '✗ EMBALAJE MAL'}
                                                        </div>
                                                        <div
                                                            className={`flex-1 h-10 flex items-center justify-center rounded-xl text-[10px] font-black border cursor-pointer transition-all ${item.productoOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-200/50' : 'bg-red-50 border-red-200 text-red-700'}`}
                                                            onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })}
                                                        >
                                                            {item.productoOk ? '✓ ESTADO OK' : '✗ ESTADO MAL'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {(!item.embalajeOk || !item.productoOk) && (
                                                    <Input
                                                        placeholder="Describe la incidencia detalladamente..."
                                                        value={item.observaciones || ''}
                                                        onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                        className="h-10 mt-3 text-xs border-red-200 bg-red-50 placeholder:text-red-300 rounded-xl"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="fixed bottom-0 left-64 right-0 p-4 bg-white/80 backdrop-blur-xl border-t flex justify-end gap-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="mr-auto text-sm text-muted-foreground flex items-center gap-4">
                        <InfoBadge label="Items" value={newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0).toString()} />
                        <InfoBadge label="Total" value={formatCurrency(newRecepcion.items.reduce((s, i) => s + (i.cantidadRecibida * i.precioFacturado), 0))} />
                    </div>
                    <Button variant="ghost" onClick={() => setView('list')} className="rounded-xl font-bold">Cancelar</Button>
                    <Button onClick={handleSave} className="gap-2 btn-gradient-primary shadow-lg shadow-blue-600/20 px-8 rounded-xl font-bold">
                        <CheckCircle className="w-5 h-5" /> Finalizar Recepción
                    </Button>
                </div>
            </div>
        );
    }


    if (view === 'details' && selectedRecepcion) {
        // Buscar pre-pedido vinculado
        const pedidoVinculado = selectedRecepcion.prePedidoId
            ? prepedidos.find(p => p.id === selectedRecepcion.prePedidoId)
            : null;

        // Calcular resumen de comparación
        const resumenComparacion = pedidoVinculado ? (() => {
            const totalEsperado = pedidoVinculado.total;
            const totalRecibido = selectedRecepcion.totalFactura;
            const diffTotal = totalRecibido - totalEsperado;
            const itemsFaltantes = pedidoVinculado.items.filter(
                pi => !selectedRecepcion.items.some(ri => ri.productoId === pi.productoId)
            );
            const itemsConDiferencia = selectedRecepcion.items.filter(
                ri => ri.cantidadEsperada > 0 && ri.cantidadRecibida !== ri.cantidadEsperada
            );
            const itemsConPrecioDiferente = selectedRecepcion.items.filter(
                ri => ri.precioEsperado > 0 && ri.precioFacturado !== ri.precioEsperado
            );
            return { totalEsperado, totalRecibido, diffTotal, itemsFaltantes, itemsConDiferencia, itemsConPrecioDiferente };
        })() : null;

        return (
            <div className="space-y-6 animate-ag-fade-in">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => { setView('list'); setSelectedRecepcion(null); }} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <h1 className="text-2xl font-bold">Detalle de Recepción</h1>
                    <Badge variant={selectedRecepcion.estado === 'completada' ? 'default' : 'secondary'}>
                        {selectedRecepcion.estado.toUpperCase().replace('_', ' ')}
                    </Badge>
                    {pedidoVinculado && (
                        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <GitCompareArrows className="w-3 h-3" /> Vinculado a: {pedidoVinculado.nombre}
                        </Badge>
                    )}
                </div>

                {/* Panel de Comparación Pedido vs Recibido */}
                {pedidoVinculado && resumenComparacion && (
                    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <GitCompareArrows className="w-5 h-5 text-blue-600" />
                                Comparación: Pre-Pedido vs Recepción
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Resumen KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-3 rounded-lg bg-white/80 border text-center">
                                    <p className="text-xs text-muted-foreground">Total Esperado</p>
                                    <p className="text-lg font-bold">{formatCurrency(resumenComparacion.totalEsperado)}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/80 border text-center">
                                    <p className="text-xs text-muted-foreground">Total Facturado</p>
                                    <p className="text-lg font-bold">{formatCurrency(resumenComparacion.totalRecibido)}</p>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${resumenComparacion.diffTotal === 0 ? 'bg-emerald-50 border-emerald-200' :
                                    resumenComparacion.diffTotal > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    <p className="text-xs text-muted-foreground">Diferencia</p>
                                    <p className={`text-lg font-bold flex items-center justify-center gap-1 ${resumenComparacion.diffTotal === 0 ? 'text-emerald-700' :
                                        resumenComparacion.diffTotal > 0 ? 'text-red-700' : 'text-amber-700'
                                        }`}>
                                        {resumenComparacion.diffTotal === 0 ? <CheckCircle className="w-4 h-4" /> :
                                            resumenComparacion.diffTotal > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {resumenComparacion.diffTotal === 0 ? 'Exacto' : formatCurrency(Math.abs(resumenComparacion.diffTotal))}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${(resumenComparacion.itemsConDiferencia.length + resumenComparacion.itemsFaltantes.length) === 0
                                    ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    <p className="text-xs text-muted-foreground">Incidencias</p>
                                    <p className="text-lg font-bold">
                                        {resumenComparacion.itemsConDiferencia.length + resumenComparacion.itemsFaltantes.length + resumenComparacion.itemsConPrecioDiferente.length}
                                    </p>
                                </div>
                            </div>

                            {/* Tabla de comparación item por item */}
                            <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold">Producto</th>
                                            <th className="text-center p-3 font-semibold">Cant. Pedida</th>
                                            <th className="text-center p-3 font-semibold">Cant. Recibida</th>
                                            <th className="text-center p-3 font-semibold">Precio Esperado</th>
                                            <th className="text-center p-3 font-semibold">Precio Real</th>
                                            <th className="text-center p-3 font-semibold">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRecepcion.items.map(item => {
                                            const diffCant = item.cantidadRecibida - item.cantidadEsperada;
                                            const diffPrecio = item.precioFacturado - item.precioEsperado;
                                            const cantOk = item.cantidadEsperada === 0 || diffCant === 0;
                                            const precioOk = item.precioEsperado === 0 || diffPrecio === 0;
                                            const todoOk = cantOk && precioOk;

                                            return (
                                                <tr key={item.id} className={`border-t ${!todoOk ? 'bg-amber-50/50' : 'hover:bg-muted/30'
                                                    }`}>
                                                    <td className="p-3 font-medium">
                                                        {getProductoById(item.productoId)?.nombre || 'Desconocido'}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {item.cantidadEsperada > 0 ? item.cantidadEsperada : '—'}
                                                    </td>
                                                    <td className={`p-3 text-center font-bold ${!cantOk ? (diffCant < 0 ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'
                                                        }`}>
                                                        {item.cantidadRecibida}
                                                        {!cantOk && (
                                                            <span className="text-xs ml-1">({diffCant > 0 ? '+' : ''}{diffCant})</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center text-muted-foreground">
                                                        {item.precioEsperado > 0 ? formatCurrency(item.precioEsperado) : '—'}
                                                    </td>
                                                    <td className={`p-3 text-center font-bold ${!precioOk ? (diffPrecio > 0 ? 'text-red-600' : 'text-emerald-600') : ''
                                                        }`}>
                                                        {formatCurrency(item.precioFacturado)}
                                                        {!precioOk && (
                                                            <span className="text-xs ml-1">
                                                                ({diffPrecio > 0 ? '+' : ''}{formatCurrency(diffPrecio)})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {todoOk ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ OK</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> Diferencia
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Items faltantes (pedidos pero no recibidos) */}
                                        {resumenComparacion.itemsFaltantes.map(pi => (
                                            <tr key={pi.id} className="border-t bg-red-50/50">
                                                <td className="p-3 font-medium text-red-700">
                                                    {getProductoById(pi.productoId)?.nombre || 'Desconocido'}
                                                </td>
                                                <td className="p-3 text-center">{pi.cantidad}</td>
                                                <td className="p-3 text-center font-bold text-red-600">0 <span className="text-xs">(-{pi.cantidad})</span></td>
                                                <td className="p-3 text-center text-muted-foreground">{formatCurrency(pi.precioUnitario)}</td>
                                                <td className="p-3 text-center">—</td>
                                                <td className="p-3 text-center">
                                                    <Badge variant="destructive" className="text-xs">Faltante</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Factura {selectedRecepcion.numeroFactura}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Proveedor</Label>
                                    <p className="font-medium">{getProveedorById(selectedRecepcion.proveedorId)?.nombre}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Fecha Recepción</Label>
                                    <p className="font-medium">{new Date(selectedRecepcion.fechaRecepcion).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Fecha Factura</Label>
                                    <p className="font-medium">{new Date(selectedRecepcion.fechaFactura).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Total</Label>
                                    <p className="font-medium text-primary">{formatCurrency(selectedRecepcion.totalFactura)}</p>
                                </div>
                            </div>

                            {selectedRecepcion.imagenFactura ? (
                                <div className="mt-4 border rounded-lg overflow-hidden">
                                    <img src={selectedRecepcion.imagenFactura} alt="Factura escaneada" className="w-full object-contain bg-slate-100" />
                                    <div className="p-2 bg-muted/50 flex justify-end">
                                        <Button variant="ghost" size="sm" className="gap-2 h-8" onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = selectedRecepcion.imagenFactura!;
                                            link.download = `${selectedRecepcion.fechaFactura}_${getProveedorById(selectedRecepcion.proveedorId)?.nombre}_Factura.jpg`;
                                            link.click();
                                        }}>
                                            <Download className="w-4 h-4" /> Descargar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                    Sin imagen adjunta
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Items Recibidos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {selectedRecepcion.items.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{getProductoById(item.productoId)?.nombre}</p>
                                            <div className="flex gap-2 mt-1">
                                                {!item.embalajeOk && <Badge variant="destructive" className="text-[10px] h-5">Mal Embalaje</Badge>}
                                                {!item.productoOk && <Badge variant="destructive" className="text-[10px] h-5">Producto Dañado</Badge>}
                                                {item.defectuosos > 0 && <Badge variant="destructive" className="text-[10px] h-5">{item.defectuosos} Defectuoso(s)</Badge>}
                                            </div>
                                            {item.observaciones && <p className="text-xs text-red-500 mt-1">{item.observaciones}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{item.cantidadRecibida} uds</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.precioFacturado)}/ud</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-ag-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">📥 Recepción de Mercancía</h1>
                    <p className="text-muted-foreground">Digitaliza facturas y verifica el stock entrante</p>
                </div>
                {check('CREAR_RECEPCIONES') && (
                    <Button onClick={() => setView('new')} className="gap-2 shadow-lg hover:shadow-primary/20">
                        <Plus className="w-4 h-4" /> Nueva Recepción
                    </Button>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por factura o proveedor..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <select
                        className="w-full p-2 h-10 rounded-md border bg-background text-sm"
                        value={proveedorFiltro}
                        onChange={e => setProveedorFiltro(e.target.value)}
                    >
                        <option value="todos">Todos los Proveedores</option>
                        {proveedores.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRecepciones.map(recepcion => {
                    const proveedor = getProveedorById(recepcion.proveedorId);
                    const itemsCount = recepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
                    const hasIssues = recepcion.items.some(i => !i.productoOk || !i.embalajeOk || i.defectuosos > 0);

                    return (
                        <Card
                            key={recepcion.id}
                            className="group hover:scale-[1.02] transition-all cursor-pointer overflow-hidden border-l-4 border-l-primary"
                            onClick={() => { setSelectedRecepcion(recepcion); setView('details'); }}
                        >
                            <CardContent className="p-0">
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="bg-background/50">
                                            {recepcion.numeroFactura}
                                        </Badge>
                                        <Badge className={`${hasIssues ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} hover:bg-white`}>
                                            {hasIssues ? 'Incidencias' : 'OK'}
                                        </Badge>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-lg line-clamp-1">{proveedor?.nombre || 'Desconocido'}</h3>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(recepcion.fechaRecepcion).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {recepcion.imagenFactura && (
                                        <div className="relative h-24 bg-muted/30 rounded-lg overflow-hidden group-hover:bg-muted/50 transition-colors flex items-center justify-center">
                                            <img src={recepcion.imagenFactura} className="w-full h-full object-cover opacity-50 blur-[1px] group-hover:blur-0 transition-all" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Eye className="w-6 h-6 text-foreground drop-shadow-md" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 border-t flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{itemsCount} items</span>
                                        <span className="font-bold text-primary">{formatCurrency(recepcion.totalFactura)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {filteredRecepciones.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                        No se encontraron recepciones
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoBadge({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex flex-col bg-muted/50 px-3 py-1 rounded-md border text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className="font-bold text-sm">{value}</span>
        </div>
    )
}
