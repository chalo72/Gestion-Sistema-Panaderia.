import React, { useState, useMemo } from 'react';
import {
    Plus,
    ChefHat,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Flame,
    ClipboardList,
    ArrowRight,
    Package,
    Layers,
    FlaskConical,
    Croissant,
    Calculator,
    ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlanProduccionModal } from '@/components/produccion/PlanProduccionModal';
import { FormulacionesView } from '@/components/produccion/FormulacionesView';
import { ModelosPanView } from '@/components/produccion/ModelosPanView';
import { CalculadoraRendimiento } from '@/components/produccion/CalculadoraRendimiento';
import { GeneradorPedidoInsumos } from '@/components/produccion/GeneradorPedidoInsumos';

import type {
    Producto,
    OrdenProduccion,
    Receta,
    ProduccionEstado,
    InventarioItem,
    FormulacionBase,
    ModeloPan,
    Proveedor,
    ProyeccionInsumo
} from '@/types';

interface ProduccionProps {
    produccion: OrdenProduccion[];
    productos: Producto[];
    recetas: Receta[];
    inventario: InventarioItem[];
    proveedores: Proveedor[];
    formulaciones: FormulacionBase[];
    modelosPan: ModeloPan[];
    addOrdenProduccion: (data: any) => Promise<OrdenProduccion>;
    updateOrdenProduccion: (id: string, updates: any) => Promise<void>;
    finalizarProduccion: (id: string, cantidad: number) => Promise<void>;
    addFormulacion: (data: Omit<FormulacionBase, 'id'>) => Promise<FormulacionBase>;
    updateFormulacion: (id: string, data: Partial<FormulacionBase>) => Promise<void>;
    deleteFormulacion: (id: string) => Promise<void>;
    addModeloPan: (data: Omit<ModeloPan, 'id'>) => Promise<ModeloPan>;
    updateModeloPan: (id: string, data: Partial<ModeloPan>) => Promise<void>;
    deleteModeloPan: (id: string) => Promise<void>;
    getProductoById: (id: string) => Producto | undefined;
    getMejorPrecio: (productoId: string) => any;
    formatCurrency: (val: number) => string;
    onNavigateTo?: (view: string) => void;
}

export function Produccion({
    produccion,
    productos,
    recetas,
    inventario,
    proveedores,
    formulaciones,
    modelosPan,
    addOrdenProduccion,
    updateOrdenProduccion,
    finalizarProduccion,
    addFormulacion,
    updateFormulacion,
    deleteFormulacion,
    addModeloPan,
    updateModeloPan,
    deleteModeloPan,
    getProductoById,
    getMejorPrecio,
    formatCurrency,
    onNavigateTo
}: ProduccionProps) {
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [activeTab, setActiveTab] = useState('ordenes');

    // Filtrar órdenes por estado
    const columns: { title: string; estado: ProduccionEstado; icon: any; color: string }[] = [
        { title: 'Planeado', estado: 'planeado', icon: ClipboardList, color: 'text-blue-400' },
        { title: 'En Proceso', estado: 'en_proceso', icon: Clock, color: 'text-amber-400' },
        { title: 'Completado', estado: 'completado', icon: CheckCircle2, color: 'text-emerald-400' }
    ];

    const getOrdenesByEstado = (estado: ProduccionEstado) => {
        return produccion.filter(o => o.estado === estado).sort((a, b) =>
            new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()
        );
    };

    const handleCompletarOrden = async (orden: OrdenProduccion) => {
        try {
            await finalizarProduccion(orden.id, orden.cantidadPlaneada);
        } catch (error) {
            toast.error('Error al finalizar la producción');
        }
    };

    const handleIniciarOrden = async (id: string) => {
        await updateOrdenProduccion(id, { estado: 'en_proceso' });
        toast.info('Orden iniciada. ¡A hornear!');
    };

    return (
        <div className="space-y-6 animate-ag-fade-in pb-10">
            {/* Header Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-foreground flex items-center gap-4 tracking-tight">
                        <div className="w-12 h-12 kpi-violet rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 rotate-3">
                            <ChefHat className="w-7 h-7 text-white" />
                        </div>
                        Centro de Producción
                    </h1>
                    <p className="text-muted-foreground font-medium flex items-center gap-2 pl-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Gestión artesanal de lotes, formulaciones y materias primas
                    </p>
                </div>
                {activeTab === 'ordenes' && (
                    <Button
                        onClick={() => setShowPlanModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Planificar Producción
                    </Button>
                )}
            </div>

            {/* Tabs de Navegación */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/40 p-1 rounded-2xl grid grid-cols-5 w-full max-w-3xl mx-auto">
                    <TabsTrigger value="ordenes" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <ClipboardList className="w-4 h-4" />
                        <span className="hidden sm:inline">Órdenes</span>
                    </TabsTrigger>
                    <TabsTrigger value="formulaciones" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <FlaskConical className="w-4 h-4" />
                        <span className="hidden sm:inline">Recetas</span>
                    </TabsTrigger>
                    <TabsTrigger value="modelos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <Croissant className="w-4 h-4" />
                        <span className="hidden sm:inline">Modelos</span>
                    </TabsTrigger>
                    <TabsTrigger value="calculadora" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <Calculator className="w-4 h-4" />
                        <span className="hidden sm:inline">Calculadora</span>
                    </TabsTrigger>
                    <TabsTrigger value="pedidos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span className="hidden sm:inline">Pedidos</span>
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Órdenes de Producción (Kanban) */}
                <TabsContent value="ordenes" className="space-y-6">
                    {/* Kanban Board */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {columns.map((col) => (
                    <div key={col.estado} className="flex flex-col gap-5">
                        <div className="flex items-center justify-between px-2">
                            <h2 className={cn("font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2", col.color)}>
                                <div className={cn("p-1.5 rounded-lg bg-current opacity-10")}>
                                    <col.icon className="w-4 h-4" />
                                </div>
                                {col.title}
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-[10px]">
                                    {getOrdenesByEstado(col.estado).length}
                                </span>
                            </h2>
                        </div>

                        <div className="flex flex-col gap-4 p-4 rounded-[2rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/50 min-h-[600px] shadow-xl shadow-slate-200/50 dark:shadow-none">
                            {getOrdenesByEstado(col.estado).map((orden) => {
                                const producto = productos.find(p => p.id === orden.productoId);
                                const isEnProceso = orden.estado === 'en_proceso';

                                return (
                                    <Card key={orden.id} className="bg-white/80 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/80 hover:border-indigo-500/50 transition-all duration-500 group overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 rounded-2xl">
                                        <div className={cn(
                                            "absolute top-0 left-0 w-1.5 h-full transition-all duration-500",
                                            orden.estado === 'planeado' ? "bg-blue-400" :
                                                orden.estado === 'en_proceso' ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
                                        )} />

                                        <CardHeader className="p-5 pb-3">
                                            <div className="flex justify-between items-start gap-3">
                                                <CardTitle className="text-sm font-black text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                                                    {producto?.nombre || 'Producto Desconocido'}
                                                </CardTitle>
                                                {orden.lote && (
                                                    <Badge className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none font-bold uppercase tracking-tighter">
                                                        #{orden.lote}
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(orden.fechaInicio).toLocaleDateString()} · {new Date(orden.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="p-5 pt-0 space-y-4">
                                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 flex items-center justify-between border border-slate-100 dark:border-slate-800/50">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Packs / Cant.</span>
                                                <span className="font-black text-indigo-600 dark:text-indigo-400 text-lg">
                                                    {orden.cantidadPlaneada}
                                                </span>
                                            </div>

                                            {isEnProceso && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] uppercase font-black tracking-widest">
                                                        <span className="text-amber-500 flex items-center gap-1">
                                                            <Flame className="w-3 h-3 animate-bounce" /> Horneando
                                                        </span>
                                                        <span className="text-slate-400">50%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 w-1/2 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-2">
                                                {orden.estado === 'planeado' && (
                                                    <Button
                                                        className="w-full text-[10px] font-black uppercase tracking-widest h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
                                                        onClick={() => handleIniciarOrden(orden.id)}
                                                    >
                                                        <Flame className="w-4 h-4 mr-2" /> Iniciar Horno
                                                    </Button>
                                                )}
                                                {orden.estado === 'en_proceso' && (
                                                    <Button
                                                        className="w-full text-[10px] font-black uppercase tracking-widest h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
                                                        onClick={() => handleCompletarOrden(orden)}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar Producción
                                                    </Button>
                                                )}
                                                {orden.estado === 'completado' && (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-500 py-2">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Lote Completado</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {getOrdenesByEstado(col.estado).length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-4 border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        <Package className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                                        Vacio
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                    </div>
                </TabsContent>

                {/* Tab: Formulaciones (Recetas) */}
                <TabsContent value="formulaciones">
                    <FormulacionesView
                        formulaciones={formulaciones}
                        productos={productos}
                        onAddFormulacion={addFormulacion}
                        onUpdateFormulacion={updateFormulacion}
                        onDeleteFormulacion={deleteFormulacion}
                        getProductoById={getProductoById}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* Tab: Modelos de Pan */}
                <TabsContent value="modelos">
                    <ModelosPanView
                        modelos={modelosPan}
                        formulaciones={formulaciones}
                        onAddModelo={addModeloPan}
                        onUpdateModelo={updateModeloPan}
                        onDeleteModelo={deleteModeloPan}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* Tab: Calculadora de Rendimiento */}
                <TabsContent value="calculadora">
                    <CalculadoraRendimiento
                        formulaciones={formulaciones}
                        modelos={modelosPan}
                        getProductoById={getProductoById}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* Tab: Generador de Pedido de Insumos */}
                <TabsContent value="pedidos">
                    <GeneradorPedidoInsumos
                        formulaciones={formulaciones}
                        modelos={modelosPan}
                        productos={productos}
                        inventario={inventario}
                        proveedores={proveedores}
                        getProductoById={getProductoById}
                        getMejorPrecio={getMejorPrecio}
                        formatCurrency={formatCurrency}
                        onGenerarPedido={(items) => {
                            toast.success(`Pedido generado con ${items.length} insumos`);
                            if (onNavigateTo) onNavigateTo('prepedidos');
                        }}
                    />
                </TabsContent>
            </Tabs>

            <PlanProduccionModal
                isOpen={showPlanModal}
                onClose={() => setShowPlanModal(false)}
                productos={productos.filter(p => p.tipo === 'elaborado')}
                recetas={recetas}
                inventario={inventario}
                onConfirm={addOrdenProduccion}
            />
        </div>
    );
}

export default Produccion;
