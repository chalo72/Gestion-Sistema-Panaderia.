import { useState } from 'react';
import {
    Plus, ChefHat, Clock, CheckCircle2, Flame, ClipboardList, Package, FlaskConical, Croissant, Calculator, ShoppingCart, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlanProduccionModal } from '@/components/produccion/PlanProduccionModal';
import { FormulacionesView } from '@/components/produccion/FormulacionesView';
import { ModelosPanView } from '@/components/produccion/ModelosPanView';
import { CalculadoraRendimiento } from '@/components/produccion/CalculadoraRendimiento';
import { GeneradorPedidoInsumos } from '@/components/produccion/GeneradorPedidoInsumos';

import type {
    Producto, OrdenProduccion, Receta, ProduccionEstado, InventarioItem, FormulacionBase, ModeloPan, Proveedor
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

    const guiasProduccion = [
        {
            nombre: 'Pan de Queso Tradicional',
            dificultad: 'Media',
            tiempo: '45 min',
            horno: '180°C',
            instrucciones: [
                'Mezclar la harina con el queso rallado hasta homogeneizar.',
                'Añadir huevos uno a uno manteniendo el amasado suave.',
                'Formar bolitas de 40g (usar báscula de precisión).',
                'Hornear hasta que el dorado sea uniforme en la base.'
            ],
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            nombre: 'Bolsa x6 (Mojicones)',
            dificultad: 'Alta',
            tiempo: '120 min',
            horno: '170°C',
            instrucciones: [
                'Activar la levadura en agua tibia por 10 minutos.',
                'Primer leudado: 60 minutos en zona sin corrientes de aire.',
                'División manual: piezas exactas para que pesen 350g por bolsa.',
                'Barnizar con huevo para el brillo característico antes de hornear.'
            ],
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        {
            nombre: 'Pan de Sal (Aliñado)',
            dificultad: 'Baja',
            tiempo: '60 min',
            horno: '190°C',
            instrucciones: [
                'Incorporar la manteca al final del proceso de amasado.',
                'Hacer cortes transversales profundos para permitir la expansión.',
                'Vaporizar el horno al inicio para una corteza crujiente.',
                'Dejar enfriar en rejilla 15 minutos antes de empacar.'
            ],
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        }
    ];

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
    
            {/* Guía Rápida: La Ruta del Maestro Panadero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-y border-slate-200 dark:border-slate-800/50 py-8 bg-slate-50/20 dark:bg-slate-900/10 backdrop-blur-sm -mx-2 px-4 rounded-3xl mb-4">
                {[
                    { step: '01', title: 'RECETAS (DNA)', desc: 'Crea tu masa base por arroba.', icon: FlaskConical, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                    { step: '02', title: 'MODELOS', desc: 'Define los panes y sus pesos.', icon: Croissant, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { step: '03', title: 'LANZAR', desc: '¡Hornea tus lotes del día!', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' }
                ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 group">
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 tracking-tighter mb-1.5">{item.step}</span>
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500 border border-white dark:border-slate-800", item.bg, item.color)}>
                                <item.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="space-y-1 pt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/90">{item.title}</h4>
                            <p className="text-[11px] text-muted-foreground font-medium leading-relaxed max-w-[160px]">{item.desc}</p>
                        </div>
                        {idx < 2 && <ArrowRight className="hidden md:block w-5 h-5 text-slate-200 dark:text-slate-800 mt-8 ml-auto animate-pulse" />}
                    </div>
                ))}
            </div>

            {/* Tabs de Navegación */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/40 p-1 rounded-2xl grid grid-cols-6 w-full max-w-4xl mx-auto">
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
                    <TabsTrigger value="guias" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow gap-2">
                        <Package className="w-4 h-4" />
                        <span className="hidden sm:inline">Guías</span>
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
                            <h2 className={cn("font-black uppercase tracking-[0.25em] text-[10px] flex items-center gap-2.5", col.color)}>
                                <div className={cn("p-2 rounded-xl bg-current/10 border border-current/20 backdrop-blur-md shadow-sm")}>
                                    <col.icon className="w-4 h-4" />
                                </div>
                                <span className="drop-shadow-sm">{col.title}</span>
                                <Badge variant="outline" className="ml-auto text-[9px] font-black bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-inner">
                                    {getOrdenesByEstado(col.estado).length}
                                </Badge>
                            </h2>
                        </div>

                        <div className="flex flex-col gap-4 p-5 rounded-[2.5rem] bg-white/30 dark:bg-slate-900/30 backdrop-blur-2xl border border-white/40 dark:border-slate-800/40 min-h-[650px] shadow-2xl shadow-slate-200/40 dark:shadow-none ring-1 ring-white/20">
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
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug uppercase tracking-tight">
                                                        {producto?.nombre || 'Producto Desconocido'}
                                                    </CardTitle>
                                                    <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 uppercase tracking-[0.1em]">
                                                        {orden.estado === 'planeado' ? <ClipboardList className="w-3 h-3" /> : <Clock className="w-3 h-3 text-amber-500 animate-spin-slow" />}
                                                        {new Date(orden.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                {orden.lote && (
                                                    <div className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-widest shadow-inner">
                                                        LOT: {orden.lote.slice(-4)}
                                                    </div>
                                                )}
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-5 pt-0 space-y-4">
                                            <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-4 flex items-center justify-between border border-slate-100/50 dark:border-slate-800/30 shadow-inner">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Cantidad Lote</span>
                                                    <span className="text-xs font-black text-slate-500 uppercase">Unidades / Packs</span>
                                                </div>
                                                <span className="font-black text-amber-600 dark:text-amber-400 text-2xl drop-shadow-sm">
                                                    {orden.cantidadPlaneada}
                                                </span>
                                            </div>

                                            {isEnProceso && (
                                                <div className="space-y-2.5 p-1">
                                                    <div className="flex justify-between text-[9px] uppercase font-black tracking-[0.2em]">
                                                        <span className="text-amber-600 flex items-center gap-1.5">
                                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                                            HORNEANDO...
                                                        </span>
                                                        <span className="text-slate-400">En marcha</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner border border-slate-200/10">
                                                        <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 w-2/3 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
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
                        onAddFormulacion={async (f) => { await addFormulacion(f); }}
                        onUpdateFormulacion={async (f) => { await updateFormulacion(f.id, f); }}
                        onDeleteFormulacion={deleteFormulacion}
                        getProductoById={getProductoById}
                        getMejorPrecio={getMejorPrecio}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* Tab: Modelos de Pan */}
                <TabsContent value="modelos">
                    <ModelosPanView
                        modelos={modelosPan}
                        formulaciones={formulaciones}
                        onAddModelo={async (m) => { await addModeloPan(m); }}
                        onUpdateModelo={async (m) => { await updateModeloPan(m.id, m); }}
                        onDeleteModelo={deleteModeloPan}
                        formatCurrency={formatCurrency}
                    />
                </TabsContent>

                {/* Tab: Guías de Elaboración (Instructivos) */}
                <TabsContent value="guias" className="animate-ag-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {guiasProduccion.map((guia, idx) => (
                            <Card key={idx} className="border-none shadow-xl bg-white dark:bg-slate-900/50 overflow-hidden group">
                                <div className={cn("h-2 w-full", guia.bg.replace('/10', ''))}></div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className={cn("text-[9px] font-black tracking-widest uppercase", guia.color)}>
                                            {guia.dificultad}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Flame className="w-3 h-3" />
                                            <span className="text-[10px] font-bold">{guia.horno}</span>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-black uppercase tracking-tight pt-2">
                                        {guia.nombre}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <Clock className="w-3 h-3" /> LISTO EN {guia.tiempo}
                                    </div>
                                    <div className="space-y-3">
                                        {guia.instrucciones.map((paso, pIdx) => (
                                            <div key={pIdx} className="flex gap-3">
                                                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", guia.bg, guia.color)}>
                                                    {pIdx + 1}
                                                </div>
                                                <p className="text-[11px] leading-relaxed font-medium text-foreground/80">
                                                    {paso}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <Button className="w-full mt-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border-none rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        Imprimir Ficha Técnica
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
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
                formulaciones={formulaciones}
                modelos={modelosPan}
                inventario={inventario}
                onConfirm={addOrdenProduccion}
            />
        </div>
    );
}

export default Produccion;
