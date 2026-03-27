import React, { useState, useMemo } from 'react';
import { 
    Plus, Search, Edit2, Trash2, ChevronRight, Layers, ChefHat,
    UtensilsCrossed, Save, AlertCircle, Thermometer, Timer, Gauge, Clock,
    Scale, TrendingUp, Info, History as HistoryIcon
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Producto, Receta, IngredienteReceta, FormulacionBase, ModeloPan, IngredienteFormulacion } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RecetasProps {
    productos: Producto[];
    recetas: Receta[];
    formulaciones: FormulacionBase[];
    modelosPan: ModeloPan[];
    getMejorPrecio: (productoId: string) => any;
    getProductoById: (id: string) => Producto | undefined;
    addReceta: (receta: Receta) => Promise<void>;
    updateReceta: (receta: Receta) => Promise<void>;
    deleteReceta: (id: string) => Promise<void>;
    addFormulacion: (formulacion: any) => Promise<void>;
    updateFormulacion: (id: string, formulacion: any) => Promise<void>;
    deleteFormulacion: (id: string) => Promise<void>;
    addModeloPan: (modelo: any) => Promise<void>;
    updateModeloPan: (id: string, modelo: any) => Promise<void>;
    deleteModeloPan: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
}

const Recetas: React.FC<RecetasProps> = ({
    productos,
    recetas,
    formulaciones,
    modelosPan,
    getMejorPrecio,
    getProductoById,
    addReceta,
    updateReceta,
    deleteReceta,
    addFormulacion,
    updateFormulacion,
    deleteFormulacion,
    addModeloPan,
    updateModeloPan,
    deleteModeloPan,
    formatCurrency
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReceta, setEditingReceta] = useState<Receta | null>(null);
    const [selectedProductoId, setSelectedProductoId] = useState<string>('');
    const [recipeIngredients, setRecipeIngredients] = useState<Partial<IngredienteReceta>[]>([]);
    const [porciones, setPorciones] = useState(1);
    const [instrucciones, setInstrucciones] = useState('');

    // Filtrar productos elaborados que ya tienen o no tienen receta
    const productosElaborados = useMemo(() =>
        productos.filter(p => p.tipo === 'elaborado'),
        [productos]);

    const ingredientesDisponibles = useMemo(() =>
        productos.filter(p => p.tipo === 'ingrediente'),
        [productos]);

    const filtradas = useMemo(() => {
        return recetas.filter(r => {
            const p = getProductoById(r.productoId);
            return p?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [recetas, searchTerm, getProductoById]);

    const filtradasFormulaciones = useMemo(() => {
        return formulaciones.filter(f => 
            f.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.categoria.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [formulaciones, searchTerm]);

    const filtradasModelos = useMemo(() => {
        return modelosPan.filter(m => 
            m.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [modelosPan, searchTerm]);

    const handleOpenCreate = () => {
        setEditingReceta(null);
        setSelectedProductoId('');
        setRecipeIngredients([]);
        setPorciones(1);
        setInstrucciones('');
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (receta: Receta) => {
        setEditingReceta(receta);
        setSelectedProductoId(receta.productoId);
        setRecipeIngredients(receta.ingredientes);
        setPorciones(receta.porcionesResultantes);
        setInstrucciones(receta.instrucciones || '');
        setTemperatura(receta.temperaturaHorno);
        setTHorneado(receta.tiempoHorneado);
        setTFermentacion(receta.tiempoFermentacion);
        setDificultad(receta.dificultad || 'medio');
        setIsDialogOpen(true);
    };

    const handleAddIngredient = () => {
        setRecipeIngredients([...recipeIngredients, {
            id: crypto.randomUUID(),
            productoId: '',
            cantidad: 0,
            unidad: 'gr',
            costoCalculado: 0
        }]);
    };

    const handleRemoveIngredient = (id: string) => {
        setRecipeIngredients(recipeIngredients.filter(i => i.id !== id));
    };

    const handleIngredientChange = (id: string, field: keyof IngredienteReceta, value: any) => {
        setRecipeIngredients(recipeIngredients.map(ing => {
            if (ing.id === id) {
                const updated = { ...ing, [field]: value };
                // Recalcular costo si cambia el producto o cantidad
                if (field === 'productoId' || field === 'cantidad') {
                    const mejorPrecio = getMejorPrecio(updated.productoId as string);
                    const costoUnitario = mejorPrecio ? mejorPrecio.precioCosto : (getProductoById(updated.productoId as string)?.costoBase || 0);
                    updated.costoCalculado = costoUnitario * (updated.cantidad || 0);
                }
                return updated;
            }
            return ing;
        }));
    };

    const [temperatura, setTemperatura] = useState<number | undefined>(undefined);
    const [tHorneado, setTHorneado] = useState<number | undefined>(undefined);
    const [tFermentacion, setTFermentacion] = useState<number | undefined>(undefined);
    const [dificultad, setDificultad] = useState<'facil' | 'medio' | 'maestro'>('medio');

    const calculateTotalCost = () => {
        return recipeIngredients.reduce((sum, ing) => sum + (ing.costoCalculado || 0), 0);
    };

    const handleSave = async () => {
        if (!selectedProductoId) {
            toast.error('Selecciona un producto');
            return;
        }

        if (recipeIngredients.length === 0) {
            toast.error('Agrega al menos un ingrediente');
            return;
        }

        const total = calculateTotalCost();
        const nuevaReceta: Receta = {
            id: editingReceta?.id || crypto.randomUUID(),
            productoId: selectedProductoId,
            ingredientes: recipeIngredients as IngredienteReceta[],
            porcionesResultantes: porciones,
            costoTotal: total,
            costoPorPorcion: total / porciones,
            instrucciones,
            temperaturaHorno: temperatura,
            tiempoHorneado: tHorneado,
            tiempoFermentacion: tFermentacion,
            dificultad,
            fechaActualizacion: new Date().toISOString()
        };

        try {
            if (editingReceta) {
                await updateReceta(nuevaReceta);
                toast.success('Receta actualizada');
            } else {
                await addReceta(nuevaReceta);
                toast.success('Receta creada');
            }
            setIsDialogOpen(false);
        } catch (error) {
            toast.error('Error al guardar la receta');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Eliminar esta receta?')) {
            await deleteReceta(id);
            toast.success('Receta eliminada');
        }
    };

    return (
        <Tabs defaultValue="tradicional" className="space-y-8 animate-in fade-in duration-500">
            {/* Header con Estética Premium y Tabs Principales */}
            <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                            <ChefHat className="w-9 h-9 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                                Gestión de Fórmulas
                            </h1>
                            <p className="text-slate-500 text-sm font-medium">Control técnico de ingredientes y costos de producción</p>
                        </div>
                    </div>

                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl h-14 w-full md:w-auto self-start md:self-center">
                        <TabsTrigger value="tradicional" className="rounded-xl px-6 h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-widest transition-all">
                            <UtensilsCrossed className="w-4 h-4" /> Receta Tradicional
                        </TabsTrigger>
                        <TabsTrigger value="maestro" className="rounded-xl px-6 h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-widest transition-all">
                            <Scale className="w-4 h-4" /> Maestro Panadero (Lotes)
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Buscar fórmulas, recetas o modelos..."
                            className="pl-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl h-14 text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={handleOpenCreate} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-8 flex items-center gap-3 shadow-lg shadow-blue-500/20 font-black uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Nueva Fórmula
                        </Button>
                    </div>
                </div>
            </div>

            <TabsContent value="tradicional" className="m-0 space-y-8 animate-ag-fade-in">

            {/* Grid de Recetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtradas.map((receta) => {
                    const producto = getProductoById(receta.productoId);
                    if (!producto) return null;

                    return (
                        <Card key={receta.id} className="group overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                                            <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{producto.nombre}</h3>
                                            <p className="text-xs text-slate-500">{producto.categoria}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(receta)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(receta.id)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Costo Batch</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(receta.costoTotal)}</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Por Unidad</p>
                                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(receta.costoPorPorcion)}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Timer className="w-3.5 h-3.5 text-blue-500" />
                                            <span>{receta.tiempoHorneado || '--'} min</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                                            <span>{receta.temperaturaHorno || '--'} °C</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Gauge className="w-3.5 h-3.5 text-violet-500" />
                                            <span className="capitalize">{receta.dificultad || 'medio'}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 italic truncate max-w-[200px]">
                                            {receta.instrucciones ? receta.instrucciones.substring(0, 40) + '...' : 'Sin instrucciones'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-500 uppercase font-black tracking-widest">Insumos:</span>
                                        <span className="font-black text-slate-900 dark:text-white uppercase">{receta.ingredientes.length} TIPOS</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-500 uppercase font-black tracking-widest">Rinde:</span>
                                        <span className="font-black text-slate-900 dark:text-white uppercase">{receta.porcionesResultantes} UNIDADES</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500 uppercase font-black tracking-widest">Margen:</span>
                                        <Badge className={cn("text-[9px] font-black uppercase h-5", producto.precioVenta > receta.costoPorPorcion ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                                            {producto.precioVenta > 0
                                                ? (Math.round((1 - receta.costoPorPorcion / producto.precioVenta) * 100))
                                                : 0}%
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between">
                                <span>Actualizado: {new Date(receta.fechaActualizacion).toLocaleDateString()}</span>
                                <ChevronRight className="w-3 h-3" />
                            </div>
                        </Card>
                    );
                })}

                {filtradas.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Layers className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-500">No hay recetas configuradas para estos productos</p>
                        <Button variant="link" onClick={handleOpenCreate} className="text-blue-600 mt-2">Crear mi primera receta</Button>
                    </div>
                )}
            </div>
        </TabsContent>

            <TabsContent value="maestro" className="m-0 space-y-8 animate-ag-fade-in">
                {/* Tabla de Formulaciones Técnicas */}
                <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xl">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Fórmulas Maestras (Por Arroba)
                                    <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-200 h-6">v1.0</Badge>
                                </h2>
                                <p className="text-slate-500 text-xs font-medium">Parámetros técnicos basados en 11.5 kg de harina base</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => toast.info('Historial en desarrollo')}
                                    className="rounded-xl h-10 px-4 border-slate-200 dark:border-slate-800 text-slate-500 flex items-center gap-2"
                                >
                                    <HistoryIcon className="w-4 h-4" /> Historial
                                </Button>
                                <Button 
                                    onClick={() => toast.info('Formulario técnico en desarrollo - Usa el botón superior')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Crear Fórmula
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nombre / ID</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Insumos</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Rendimiento Arroba</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Costo Est. Arroba</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Modelos Vinculados</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filtradasFormulaciones.map((f) => {
                                    const mPan = modelosPan.filter(m => m.formulacionId === f.id);
                                    return (
                                        <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                                                        <Scale className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{f.nombre}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{f.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-500 font-black border-slate-200">
                                                    {f.ingredientes.length} TIPOS
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <Badge className="rounded-lg bg-emerald-500 text-white font-black hover:bg-emerald-600">
                                                    {f.rendimientoBaseKg} KG MASA
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className="font-black text-slate-900 dark:text-white">{formatCurrency(f.costoTotalArroba)}</span>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {mPan.map(m => (
                                                        <TooltipProvider key={m.id}>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 cursor-help">
                                                                        {m.nombre}
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                                                    <div className="p-2 space-y-1">
                                                                        <p className="font-bold">{m.nombre}</p>
                                                                        <p className="text-[10px]">Peso: {m.pesoUnitarioGr}g</p>
                                                                        <p className="text-[10px]">Rinde: {m.panesPorArroba} und</p>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ))}
                                                    {mPan.length === 0 && <span className="text-[10px] text-slate-400 italic">Sin modelos</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-900 rounded-xl">
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium italic">
                            <Info className="w-4 h-4 text-indigo-500" />
                            <span>Las formulaciones maestras se calculan sobre una base estándar de 1 Arroba (11.5 kg / 25 lb de Harina de Trigo).</span>
                        </div>
                    </div>
                </Card>

                {/* Grid de Modelos de Pan (Rendimientos) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="md:col-span-4 p-6 rounded-3xl border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Rendimientos por Modelo de Pan</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {filtradasModelos.map(m => (
                                <div key={m.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <Badge className="bg-indigo-600 text-white text-[9px] font-black px-2">{m.pesoUnitarioGr}G</Badge>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-slate-400 hover:text-indigo-600">
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1 truncate">{m.nombre}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold mb-3">{modelosPan.length > 0 ? formulaciones.find(f => f.id === m.formulacionId)?.nombre : 'Fórmula'}</p>
                                    <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-indigo-600">RINDE:</span>
                                        <span className="text-xs font-black text-slate-900 dark:text-white">{m.panesPorArroba} UND/ARR</span>
                                    </div>
                                </div>
                            ))}
                            <button className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all gap-2 group">
                                <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Modelo</span>
                            </button>
                        </div>
                    </Card>
                </div>
            </TabsContent>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-0 bg-white dark:bg-slate-900">
                    <div className="h-2 w-full kpi-blue" />
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <ChefHat className="w-6 h-6 text-blue-600" />
                                <DialogTitle className="text-2xl font-bold">{editingReceta ? 'Editar Escandallo' : 'Nuevo Escandallo de Producción'}</DialogTitle>
                            </div>
                            <DialogDescription>Define los ingredientes y cantidades para calcular el costo exacto de tu producto</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-8">
                            <Tabs defaultValue="escandallo" className="w-full">
                                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl grid grid-cols-2 w-full max-w-sm ml-auto mb-8">
                                    <TabsTrigger value="escandallo" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2">
                                        <Layers className="w-4 h-4" /> Costos e Insumos
                                    </TabsTrigger>
                                    <TabsTrigger value="tecnica" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2">
                                        <ChefHat className="w-4 h-4" /> Ficha Técnica
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="escandallo" className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Columna Izquierda: Info General en Escandallo */}
                                        <div className="md:col-span-1 space-y-6">
                                            <div className="space-y-4">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Producto Elaborado</Label>
                                                <Select value={selectedProductoId} onValueChange={setSelectedProductoId} disabled={!!editingReceta}>
                                                    <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12">
                                                        <SelectValue placeholder="Seleccionar..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {productosElaborados.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-4">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Rendimiento Batch (Und)</Label>
                                                <Input
                                                    type="number"
                                                    value={porciones}
                                                    onChange={(e) => setPorciones(Number(e.target.value))}
                                                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg"
                                                />
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-slate-950 text-white relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-3xl rounded-full translate-x-12 -translate-y-12" />
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Total Insumos</Label>
                                                <div className="text-3xl font-black text-white mb-4 group-hover:scale-110 transition-transform origin-left">
                                                    {formatCurrency(calculateTotalCost())}
                                                </div>
                                                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                                    <span className="text-slate-500 text-[10px] font-black uppercase">Por Unidad:</span>
                                                    <span className="text-blue-400 text-sm font-black">{formatCurrency(calculateTotalCost() / (porciones || 1))}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Columna Derecha: Tabla Ingredientes en Escandallo */}
                                        <div className="md:col-span-2 space-y-4">
                                            <div className="flex items-center justify-between mb-2 px-2">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                                    Insumos Requeridos
                                                    <Badge className="bg-blue-600/10 text-blue-500 border-blue-500/20 rounded-full h-5 text-[10px]">{recipeIngredients.length}</Badge>
                                                </h3>
                                                <Button variant="ghost" size="sm" onClick={handleAddIngredient} className="rounded-xl text-blue-600 hover:bg-blue-600/10 font-black text-[10px] uppercase">
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo Insumo
                                                </Button>
                                            </div>
    
                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {recipeIngredients.map((ing) => (
                                                    <div key={ing.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                                                        <div className="col-span-12 md:col-span-5">
                                                            <Select value={ing.productoId} onValueChange={(val) => handleIngredientChange(ing.id!, 'productoId', val)}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl">
                                                                    <SelectValue placeholder="Producto..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {ingredientesDisponibles.map(p => (
                                                                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-4 md:col-span-2">
                                                            <Input
                                                                type="number"
                                                                value={ing.cantidad}
                                                                onChange={(e) => handleIngredientChange(ing.id!, 'cantidad', Number(e.target.value))}
                                                                className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200"
                                                            />
                                                        </div>
                                                        <div className="col-span-4 md:col-span-2">
                                                            <Select value={ing.unidad} onValueChange={(val) => handleIngredientChange(ing.id!, 'unidad', val)}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="gr">gr</SelectItem>
                                                                    <SelectItem value="kg">kg</SelectItem>
                                                                    <SelectItem value="ml">ml</SelectItem>
                                                                    <SelectItem value="l">l</SelectItem>
                                                                    <SelectItem value="und">und</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-3 md:col-span-2 text-right">
                                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatCurrency(ing.costoCalculado || 0)}</span>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <Button onClick={() => handleRemoveIngredient(ing.id!)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="tecnica" className="space-y-8 animate-ag-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Parámetros de Cocción</h3>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Thermometer className="w-3 h-3" /> Temperatura
                                                    </Label>
                                                    <div className="relative group">
                                                        <Input 
                                                            type="number" 
                                                            placeholder="Ej: 180" 
                                                            value={temperatura || ''}
                                                            onChange={e => setTemperatura(Number(e.target.value))}
                                                            className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 text-lg font-black pr-10"
                                                        />
                                                        <span className="absolute right-4 top-4 text-slate-400 font-bold italic">°C</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Timer className="w-3 h-3" /> Tiempo Horno
                                                    </Label>
                                                    <div className="relative group">
                                                        <Input 
                                                            type="number" 
                                                            placeholder="Ej: 15" 
                                                            value={tHorneado || ''}
                                                            onChange={e => setTHorneado(Number(e.target.value))}
                                                            className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 text-lg font-black pr-12"
                                                        />
                                                        <span className="absolute right-4 top-4 text-slate-400 font-bold italic text-xs">min</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Clock className="w-3 h-3" /> Reposo / Fermentación
                                                </Label>
                                                <div className="relative">
                                                    <Input 
                                                        type="number" 
                                                        placeholder="Tiempo total de reposo (minutos)" 
                                                        value={tFermentacion || ''}
                                                        onChange={e => setTFermentacion(Number(e.target.value))}
                                                        className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg"
                                                    />
                                                    <Clock className="absolute right-4 top-4 w-6 h-6 text-slate-200" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Gauge className="w-3 h-3" /> Nivel de Dificultad
                                                </Label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[
                                                        { id: 'facil', label: 'Fácil', color: 'bg-emerald-500' },
                                                        { id: 'medio', label: 'Medio', color: 'bg-amber-500' },
                                                        { id: 'maestro', label: 'Maestro', color: 'bg-rose-600' }
                                                    ].map(level => (
                                                        <button
                                                            key={level.id}
                                                            onClick={() => setDificultad(level.id as any)}
                                                            className={cn(
                                                                "h-12 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all",
                                                                dificultad === level.id 
                                                                    ? `${level.color} text-white shadow-lg` 
                                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-800 hover:scale-95"
                                                            )}
                                                        >
                                                            {level.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Instrucciones de Elaboración</h3>
                                            <textarea
                                                className="w-full min-h-[320px] rounded-[2rem] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 p-6 text-sm font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:outline-none placeholder:text-slate-400 custom-scrollbar"
                                                placeholder="Describe el proceso paso a paso (amasado, división, formado, horneado)..."
                                                value={instrucciones}
                                                onChange={(e) => setInstrucciones(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <DialogFooter className="mt-12 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-xl text-xs">
                                <AlertCircle className="w-4 h-4" />
                                Los costos se calculan basándose en el MEJOR PRECIO de tus proveedores actuales.
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl px-6">Cancelar</Button>
                                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {editingReceta ? 'Actualizar Escandallo' : 'Guardar Escandallo'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
};

export default Recetas;
