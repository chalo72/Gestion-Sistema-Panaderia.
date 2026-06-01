import { generateUUID } from '@/lib/safe-utils';
import React, { useState, useMemo, useRef } from 'react';
import {
    Plus, Search, Edit2, Trash2, ChevronRight, Layers, ChefHat,
    UtensilsCrossed, Save, AlertCircle, Thermometer, Timer, Gauge, Clock,
    Scale, TrendingUp, Info, History as HistoryIcon, Camera, X, ArrowUp,
    ArrowDown, ListOrdered, Filter
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
import type { Producto, Receta, IngredienteReceta, FormulacionBase, ModeloPan } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Tipo local para pasos de elaboración ────────────────────────────────────
interface PasoElaboracion {
    id: string;
    titulo?: string;
    descripcion: string;
    imagenBase64?: string;
}

// Comprime imagen a JPEG ≤ 800px, ~70% calidad (~150–250 KB)
async function comprimirImagen(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX = 800;
                let { width, height } = img;
                if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
                if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target!.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Factor de conversión para normalizar la cantidad a la unidad base del precio ($/kg o $/l)
function factorUnidad(unidad: string): number {
    if (unidad === 'gr') return 0.001;   // gr → kg
    if (unidad === 'ml') return 0.001;   // ml → l
    return 1;                             // kg, l, und — sin conversión
}

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
    productos, recetas, formulaciones, modelosPan,
    getMejorPrecio, getProductoById,
    addReceta, updateReceta, deleteReceta,
    addFormulacion, updateFormulacion, deleteFormulacion,
    addModeloPan, updateModeloPan, deleteModeloPan,
    formatCurrency
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReceta, setEditingReceta] = useState<Receta | null>(null);
    const [selectedProductoId, setSelectedProductoId] = useState<string>('');
    const [recipeIngredients, setRecipeIngredients] = useState<Partial<IngredienteReceta>[]>([]);
    const [porciones, setPorciones] = useState(1);

    // Pasos de elaboración (reemplazan el campo libre "instrucciones")
    const [pasos, setPasos] = useState<PasoElaboracion[]>([]);

    // Filtro de categorías para insumos
    const [categoriasInsumosFiltro, setCategoriasInsumosFiltro] = useState<string[]>([]);

    const [temperatura, setTemperatura] = useState<number | undefined>(undefined);
    const [tHorneado, setTHorneado] = useState<number | undefined>(undefined);
    const [tFermentacion, setTFermentacion] = useState<number | undefined>(undefined);
    const [dificultad, setDificultad] = useState<'facil' | 'medio' | 'maestro'>('medio');

    // ── Listas derivadas ────────────────────────────────────────────────────

    const productosElaborados = useMemo(() =>
        productos.filter(p => p.tipo !== 'ingrediente'), [productos]);

    const ingredientesDisponibles = useMemo(() =>
        productos.filter(p => p.tipo === 'ingrediente'), [productos]);

    // Categorías únicas de los insumos disponibles
    const categoriasDeInsumos = useMemo(() => {
        const cats = new Set(ingredientesDisponibles.map(p => p.categoria).filter(Boolean));
        return Array.from(cats).sort();
    }, [ingredientesDisponibles]);

    // Insumos filtrados por categorías seleccionadas (vacío = todos)
    const ingredientesFiltrados = useMemo(() => {
        if (categoriasInsumosFiltro.length === 0) return ingredientesDisponibles;
        return ingredientesDisponibles.filter(p =>
            categoriasInsumosFiltro.includes(p.categoria)
        );
    }, [ingredientesDisponibles, categoriasInsumosFiltro]);

    const filtradas = useMemo(() =>
        recetas.filter(r => {
            const p = getProductoById(r.productoId);
            return p?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        }), [recetas, searchTerm, getProductoById]);

    const filtradasFormulaciones = useMemo(() =>
        formulaciones.filter(f =>
            f.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.categoria.toLowerCase().includes(searchTerm.toLowerCase())
        ), [formulaciones, searchTerm]);

    const filtradasModelos = useMemo(() =>
        modelosPan.filter(m => m.nombre.toLowerCase().includes(searchTerm.toLowerCase())),
        [modelosPan, searchTerm]);

    // ── Helpers para pasos ──────────────────────────────────────────────────

    const parsePasos = (instrucciones?: string): PasoElaboracion[] => {
        if (!instrucciones) return [];
        try {
            const parsed = JSON.parse(instrucciones);
            if (Array.isArray(parsed) && parsed.length > 0 && 'descripcion' in parsed[0]) {
                return parsed as PasoElaboracion[];
            }
        } catch { /* texto libre legacy */ }
        // Texto libre → un solo paso de migración
        if (instrucciones.trim()) {
            return [{ id: generateUUID(), titulo: 'Instrucciones', descripcion: instrucciones }];
        }
        return [];
    };

    const serializePasos = (ps: PasoElaboracion[]): string => {
        if (ps.length === 0) return '';
        return JSON.stringify(ps);
    };

    const addPaso = () => {
        setPasos(prev => [...prev, { id: generateUUID(), titulo: '', descripcion: '' }]);
    };

    const removePaso = (id: string) => {
        setPasos(prev => prev.filter(p => p.id !== id));
    };

    const updatePaso = (id: string, field: keyof PasoElaboracion, value: string | undefined) => {
        setPasos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const movePaso = (index: number, dir: -1 | 1) => {
        const next = index + dir;
        if (next < 0 || next >= pasos.length) return;
        const arr = [...pasos];
        [arr[index], arr[next]] = [arr[next], arr[index]];
        setPasos(arr);
    };

    const handlePasoImage = async (pasoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await comprimirImagen(file);
            updatePaso(pasoId, 'imagenBase64', base64);
        } catch {
            toast.error('No se pudo cargar la imagen');
        }
        e.target.value = '';
    };

    // ── Abrir / cerrar modal ────────────────────────────────────────────────

    const handleOpenCreate = () => {
        setEditingReceta(null);
        setSelectedProductoId('');
        setRecipeIngredients([]);
        setPorciones(1);
        setPasos([]);
        setTemperatura(undefined);
        setTHorneado(undefined);
        setTFermentacion(undefined);
        setDificultad('medio');
        setCategoriasInsumosFiltro([]);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (receta: Receta) => {
        setEditingReceta(receta);
        setSelectedProductoId(receta.productoId);
        setRecipeIngredients(receta.ingredientes);
        setPorciones(receta.porcionesResultantes);
        setPasos(parsePasos(receta.instrucciones));
        setTemperatura(receta.temperaturaHorno);
        setTHorneado(receta.tiempoHorneado);
        setTFermentacion(receta.tiempoFermentacion);
        setDificultad(receta.dificultad || 'medio');
        setCategoriasInsumosFiltro([]);
        setIsDialogOpen(true);
    };

    // ── Ingredientes ────────────────────────────────────────────────────────

    const handleAddIngredient = () => {
        setRecipeIngredients([...recipeIngredients, {
            id: generateUUID(), productoId: '', cantidad: 0, unidad: 'gr', costoCalculado: 0
        }]);
    };

    const handleRemoveIngredient = (id: string) => {
        setRecipeIngredients(recipeIngredients.filter(i => i.id !== id));
    };

    const calcularCosto = (productoId: string, cantidad: number, unidad: string): number => {
        const mejorPrecio = getMejorPrecio(productoId);
        const costoUnitario = mejorPrecio
            ? mejorPrecio.precioCosto
            : (getProductoById(productoId)?.costoBase || 0);
        // Conversión: gr → kg, ml → l (los precios de proveedor son por kg/l/und)
        return costoUnitario * cantidad * factorUnidad(unidad);
    };

    const handleIngredientChange = (id: string, field: keyof IngredienteReceta, value: any) => {
        setRecipeIngredients(recipeIngredients.map(ing => {
            if (ing.id !== id) return ing;
            const updated = { ...ing, [field]: value };
            if (field === 'productoId' || field === 'cantidad' || field === 'unidad') {
                updated.costoCalculado = calcularCosto(
                    updated.productoId as string,
                    updated.cantidad || 0,
                    updated.unidad || 'gr'
                );
            }
            return updated;
        }));
    };

    const calculateTotalCost = () =>
        recipeIngredients.reduce((sum, ing) => sum + (ing.costoCalculado || 0), 0);

    // ── Guardar ─────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!selectedProductoId) { toast.error('Selecciona un producto'); return; }
        if (recipeIngredients.length === 0) { toast.error('Agrega al menos un insumo'); return; }

        const total = calculateTotalCost();
        const nuevaReceta: Receta = {
            id: editingReceta?.id || generateUUID(),
            productoId: selectedProductoId,
            ingredientes: recipeIngredients as IngredienteReceta[],
            porcionesResultantes: porciones,
            costoTotal: total,
            costoPorPorcion: total / (porciones || 1),
            instrucciones: serializePasos(pasos),
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
        } catch {
            toast.error('Error al guardar la receta');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Eliminar esta receta?')) {
            await deleteReceta(id);
            toast.success('Receta eliminada');
        }
    };

    // ── Chip de categoría para filtro ───────────────────────────────────────
    const toggleCategoria = (cat: string) => {
        setCategoriasInsumosFiltro(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    // ── Etiqueta visual de unidad ───────────────────────────────────────────
    const labelUnidad = (unidad: string) => {
        if (unidad === 'gr') return 'precio/kg — ingresa en gramos';
        if (unidad === 'ml') return 'precio/l — ingresa en mililitros';
        if (unidad === 'kg') return 'precio/kg';
        if (unidad === 'l') return 'precio/l';
        return 'por unidad';
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <Tabs defaultValue="tradicional" className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                            <ChefHat className="w-9 h-9 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                                Recetas Técnicas
                            </h1>
                            <p className="text-slate-500 text-sm font-medium">Insumos, costos y paso a paso de elaboración</p>
                        </div>
                    </div>

                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl h-14 w-full md:w-auto self-start md:self-center">
                        <TabsTrigger value="tradicional" className="rounded-xl px-6 h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-widest transition-all">
                            <UtensilsCrossed className="w-4 h-4" /> Recetas
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
                            placeholder="Buscar recetas..."
                            className="pl-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl h-14 text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={handleOpenCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-8 flex items-center gap-3 shadow-lg shadow-blue-500/20 font-black uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Nueva Receta
                    </Button>
                </div>
            </div>

            {/* ── Tab: Recetas Tradicionales ────────────────────────────────── */}
            <TabsContent value="tradicional" className="m-0 space-y-8 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtradas.map((receta) => {
                        const producto = getProductoById(receta.productoId);
                        if (!producto) return null;
                        const pasosCargados = parsePasos(receta.instrucciones);
                        const tieneImagenes = pasosCargados.some(p => p.imagenBase64);

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
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Costo Total</p>
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

                                        {/* Indicadores de pasos e imágenes */}
                                        <div className="flex items-center gap-2">
                                            {pasosCargados.length > 0 && (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                                                    <ListOrdered className="w-3 h-3" /> {pasosCargados.length} pasos
                                                </span>
                                            )}
                                            {tieneImagenes && (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                                    <Camera className="w-3 h-3" /> con fotos
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">Insumos:</span>
                                            <span className="font-black text-slate-900 dark:text-white uppercase">{receta.ingredientes.length} tipos</span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">Produce:</span>
                                            <span className="font-black text-slate-900 dark:text-white uppercase">{receta.porcionesResultantes} unidades</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">Margen:</span>
                                            <Badge className={cn("text-[9px] font-black uppercase h-5", producto.precioVenta > receta.costoPorPorcion ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                                                {producto.precioVenta > 0
                                                    ? Math.round((1 - receta.costoPorPorcion / producto.precioVenta) * 100)
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
                            <p className="text-slate-500">No hay recetas creadas todavía</p>
                            <Button variant="link" onClick={handleOpenCreate} className="text-blue-600 mt-2">Crear primera receta</Button>
                        </div>
                    )}
                </div>

                <div className="mt-12 p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 border border-indigo-100 dark:border-indigo-700 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                            <UtensilsCrossed className="w-10 h-10 text-indigo-600" />
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">💡 ¿Cómo crear productos compuestos?</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                {[
                                    { paso: '1', titulo: 'Insumos', desc: 'Crea los ingredientes base como "Insumos" en Productos.' },
                                    { paso: '2', titulo: 'Producto de venta', desc: 'Crea el producto terminado con su precio de venta.' },
                                    { paso: '3', titulo: 'Receta', desc: 'Aquí en Recetas, vincula el producto con sus insumos y agrega el paso a paso con fotos.' },
                                ].map(({ paso, titulo, desc }) => (
                                    <div key={paso} className="bg-white/60 dark:bg-slate-950/40 p-4 rounded-2xl border border-white dark:border-slate-700">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase block mb-1">Paso {paso}: {titulo}</span>
                                        <p className="text-[11px] font-bold text-slate-500">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </TabsContent>

            {/* ── Tab: Maestro Panadero ─────────────────────────────────────── */}
            <TabsContent value="maestro" className="m-0 space-y-8 animate-in fade-in">
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
                                <Button variant="outline" onClick={() => toast.info('Historial en desarrollo')} className="rounded-xl h-10 px-4 border-slate-200 dark:border-slate-800 text-slate-500 flex items-center gap-2">
                                    <HistoryIcon className="w-4 h-4" /> Historial
                                </Button>
                                <Button onClick={() => toast.info('Usa el botón "Nueva Receta" en la pestaña Recetas')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Crear Fórmula
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nombre</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Insumos</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Produce por arroba</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Costo arroba</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Modelos</th>
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
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{f.categoria}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-500 font-black border-slate-200">
                                                    {f.ingredientes.length} tipos
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <Badge className="rounded-lg bg-emerald-500 text-white font-black hover:bg-emerald-600">
                                                    {f.rendimientoBaseKg} kg masa
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
                                                                        <p className="text-[10px]">Produce: {m.panesPorArroba} unidades</p>
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
                            Formulaciones calculadas sobre 1 Arroba = 11.5 kg / 25 lb de Harina de Trigo.
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="md:col-span-4 p-6 rounded-3xl border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Producción por Modelo de Pan</h3>
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
                                    <p className="text-[10px] text-slate-500 font-bold mb-3">{formulaciones.find(f => f.id === m.formulacionId)?.nombre || 'Fórmula'}</p>
                                    <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-indigo-600">PRODUCE:</span>
                                        <span className="text-xs font-black text-slate-900 dark:text-white">{m.panesPorArroba} und/arr</span>
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

            {/* ════════════════════════════════════════════════════════════
                MODAL — Crear / Editar Receta
            ════════════════════════════════════════════════════════════ */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 border-0 bg-white dark:bg-slate-900">
                    <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <ChefHat className="w-6 h-6 text-blue-600" />
                                <DialogTitle className="text-2xl font-bold">
                                    {editingReceta ? 'Editar Receta' : 'Nueva Receta de Producción'}
                                </DialogTitle>
                            </div>
                            <DialogDescription>
                                Define los insumos, cantidades y pasos de elaboración del producto
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-8">
                            <Tabs defaultValue="insumos" className="w-full">
                                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl grid grid-cols-2 w-full max-w-sm ml-auto mb-8">
                                    <TabsTrigger value="insumos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2">
                                        <Layers className="w-4 h-4" /> Insumos y Costos
                                    </TabsTrigger>
                                    <TabsTrigger value="tecnica" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2">
                                        <ChefHat className="w-4 h-4" /> Ficha Técnica
                                    </TabsTrigger>
                                </TabsList>

                                {/* ── Pestaña: Insumos y Costos ───────────────────────── */}
                                <TabsContent value="insumos" className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Columna izquierda */}
                                        <div className="md:col-span-1 space-y-6">
                                            <div className="space-y-4">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Producto que se elabora</Label>
                                                <Select value={selectedProductoId} onValueChange={setSelectedProductoId} disabled={!!editingReceta}>
                                                    <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12">
                                                        <SelectValue placeholder="Seleccionar producto..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {productosElaborados.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-4">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                                    ¿Cuántas unidades produce esta receta?
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={porciones}
                                                    onChange={(e) => setPorciones(Number(e.target.value))}
                                                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg"
                                                    placeholder="Ej: 20 panes"
                                                />
                                                <p className="text-[10px] text-slate-400 font-medium px-1">
                                                    Escribe cuántos panes, tortas o unidades resultan de esta preparación completa.
                                                </p>
                                            </div>

                                            <div className="p-6 rounded-[2rem] bg-slate-950 text-white relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-3xl rounded-full translate-x-12 -translate-y-12" />
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Costo total de insumos</Label>
                                                <div className="text-3xl font-black text-white mb-4 group-hover:scale-110 transition-transform origin-left">
                                                    {formatCurrency(calculateTotalCost())}
                                                </div>
                                                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                                    <span className="text-slate-500 text-[10px] font-black uppercase">Costo por unidad:</span>
                                                    <span className="text-blue-400 text-sm font-black">
                                                        {formatCurrency(calculateTotalCost() / (porciones || 1))}
                                                    </span>
                                                </div>
                                                {selectedProductoId && (() => {
                                                    const prod = getProductoById(selectedProductoId);
                                                    const costUnit = calculateTotalCost() / (porciones || 1);
                                                    if (prod?.precioVenta && costUnit > 0) {
                                                        const margen = Math.round((1 - costUnit / prod.precioVenta) * 100);
                                                        return (
                                                            <div className="pt-3 border-t border-slate-800 flex justify-between items-center mt-3">
                                                                <span className="text-slate-500 text-[10px] font-black uppercase">Margen real:</span>
                                                                <span className={cn("text-sm font-black", margen >= 30 ? "text-emerald-400" : margen >= 0 ? "text-amber-400" : "text-rose-400")}>
                                                                    {margen}%
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Columna derecha: lista de insumos */}
                                        <div className="md:col-span-2 space-y-4">
                                            <div className="flex items-center justify-between mb-2 px-2">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                                    Insumos Requeridos
                                                    <Badge className="bg-blue-600/10 text-blue-500 border-blue-500/20 rounded-full h-5 text-[10px]">
                                                        {recipeIngredients.length}
                                                    </Badge>
                                                </h3>
                                                <Button variant="ghost" size="sm" onClick={handleAddIngredient} className="rounded-xl text-blue-600 hover:bg-blue-600/10 font-black text-[10px] uppercase">
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> Agregar insumo
                                                </Button>
                                            </div>

                                            {/* Filtro de categorías */}
                                            {categoriasDeInsumos.length > 1 && (
                                                <div className="px-2 pb-2">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Mostrar solo:
                                                        </span>
                                                        {categoriasInsumosFiltro.length > 0 && (
                                                            <button
                                                                onClick={() => setCategoriasInsumosFiltro([])}
                                                                className="text-[10px] text-rose-500 font-black hover:text-rose-600 ml-auto"
                                                            >
                                                                Limpiar filtro
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {categoriasDeInsumos.map(cat => {
                                                            const activa = categoriasInsumosFiltro.includes(cat);
                                                            return (
                                                                <button
                                                                    key={cat}
                                                                    onClick={() => toggleCategoria(cat)}
                                                                    className={cn(
                                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95",
                                                                        activa
                                                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                                                                    )}
                                                                >
                                                                    {cat}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {categoriasInsumosFiltro.length > 0 && (
                                                        <p className="text-[10px] text-indigo-500 font-medium mt-1.5 px-1">
                                                            Mostrando {ingredientesFiltrados.length} de {ingredientesDisponibles.length} insumos
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                                                {recipeIngredients.map((ing) => (
                                                    <div key={ing.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                                                        <div className="col-span-12 md:col-span-5">
                                                            <Select
                                                                value={ing.productoId}
                                                                onValueChange={(val) => handleIngredientChange(ing.id!, 'productoId', val)}
                                                            >
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl">
                                                                    <SelectValue placeholder="Seleccionar insumo..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {ingredientesFiltrados.map(p => (
                                                                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                                                    ))}
                                                                    {ingredientesFiltrados.length === 0 && (
                                                                        <div className="px-3 py-2 text-xs text-slate-400">Sin insumos en esta categoría</div>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-4 md:col-span-2">
                                                            <Input
                                                                type="number"
                                                                value={ing.cantidad || ''}
                                                                onChange={(e) => handleIngredientChange(ing.id!, 'cantidad', Number(e.target.value))}
                                                                className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200"
                                                                placeholder="Cant."
                                                            />
                                                        </div>
                                                        <div className="col-span-4 md:col-span-2">
                                                            <Select
                                                                value={ing.unidad}
                                                                onValueChange={(val) => handleIngredientChange(ing.id!, 'unidad', val)}
                                                            >
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
                                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                                {formatCurrency(ing.costoCalculado || 0)}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <Button
                                                                onClick={() => handleRemoveIngredient(ing.id!)}
                                                                variant="ghost" size="icon"
                                                                className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {recipeIngredients.length === 0 && (
                                                    <div className="text-center py-8 text-slate-400 text-sm">
                                                        Aún no hay insumos. Presiona "Agregar insumo".
                                                    </div>
                                                )}
                                            </div>

                                            {/* Nota sobre conversión de unidades */}
                                            <div className="flex items-start gap-2 px-2 text-[10px] text-slate-400">
                                                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                                                <span>
                                                    <b>Unidades:</b> Si el insumo tiene precio por kg en proveedores, ingresa la cantidad en <b>gr</b> y el cálculo convierte automáticamente. Mismo para ml ↔ litros.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ── Pestaña: Ficha Técnica ───────────────────────────── */}
                                <TabsContent value="tecnica" className="space-y-8 animate-in fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Parámetros de cocción */}
                                        <div className="space-y-6">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Parámetros de Cocción</h3>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Thermometer className="w-3 h-3" /> Temperatura
                                                    </Label>
                                                    <div className="relative">
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
                                                        <Timer className="w-3 h-3" /> Tiempo en horno
                                                    </Label>
                                                    <div className="relative">
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
                                                        placeholder="Tiempo de reposo (minutos)"
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

                                        {/* Pasos de elaboración */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                                    <ListOrdered className="w-4 h-4 text-indigo-500" />
                                                    Paso a paso de elaboración
                                                </h3>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    onClick={addPaso}
                                                    className="rounded-xl text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase"
                                                >
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> Paso
                                                </Button>
                                            </div>

                                            {pasos.length === 0 ? (
                                                <button
                                                    onClick={addPaso}
                                                    className="w-full flex flex-col items-center justify-center py-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all gap-3"
                                                >
                                                    <ListOrdered className="w-8 h-8" />
                                                    <span className="text-sm font-black">Agrega el primer paso</span>
                                                    <span className="text-[11px] font-medium text-slate-400 max-w-[200px] text-center">
                                                        Cada paso puede tener descripción y foto. Si cambia el panadero, la receta queda documentada.
                                                    </span>
                                                </button>
                                            ) : (
                                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {pasos.map((paso, idx) => (
                                                        <PasoEditor
                                                            key={paso.id}
                                                            paso={paso}
                                                            index={idx}
                                                            total={pasos.length}
                                                            onUpdate={updatePaso}
                                                            onRemove={removePaso}
                                                            onMove={movePaso}
                                                            onImage={handlePasoImage}
                                                        />
                                                    ))}
                                                    <button
                                                        onClick={addPaso}
                                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all text-[11px] font-black uppercase tracking-wider"
                                                    >
                                                        <Plus className="w-4 h-4" /> Agregar otro paso
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <DialogFooter className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6 gap-4">
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-xl text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Los costos se calculan con el mejor precio de tus proveedores actuales.
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl px-6">Cancelar</Button>
                                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {editingReceta ? 'Actualizar Receta' : 'Guardar Receta'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
};

// ─── Componente de un paso individual ─────────────────────────────────────────
interface PasoEditorProps {
    paso: PasoElaboracion;
    index: number;
    total: number;
    onUpdate: (id: string, field: keyof PasoElaboracion, value: string | undefined) => void;
    onRemove: (id: string) => void;
    onMove: (index: number, dir: -1 | 1) => void;
    onImage: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}

function PasoEditor({ paso, index, total, onUpdate, onRemove, onMove, onImage }: PasoEditorProps) {
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            {/* Número del paso */}
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {index + 1}
            </div>

            <div className="flex-1 space-y-2.5 min-w-0">
                {/* Título opcional */}
                <Input
                    value={paso.titulo || ''}
                    onChange={e => onUpdate(paso.id, 'titulo', e.target.value)}
                    placeholder={`Título del paso ${index + 1} (opcional)`}
                    className="h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 text-sm font-bold"
                />
                {/* Descripción */}
                <textarea
                    value={paso.descripcion}
                    onChange={e => onUpdate(paso.id, 'descripcion', e.target.value)}
                    placeholder="Describe qué hay que hacer en este paso..."
                    rows={2}
                    className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:outline-none placeholder:text-slate-400 resize-none custom-scrollbar"
                />

                {/* Imagen */}
                {paso.imagenBase64 ? (
                    <div className="relative group/img">
                        <img
                            src={paso.imagenBase64}
                            alt={`Paso ${index + 1}`}
                            className="w-full h-36 object-cover rounded-xl border border-slate-200"
                        />
                        <button
                            onClick={() => onUpdate(paso.id, 'imagenBase64', undefined)}
                            className="absolute top-2 right-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                            title="Quitar imagen"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-indigo-500 transition-colors px-1"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            Añadir foto a este paso
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => onImage(paso.id, e)}
                        />
                    </>
                )}
            </div>

            {/* Controles */}
            <div className="flex flex-col gap-1 shrink-0">
                <button
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                    title="Subir paso"
                >
                    <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => onMove(index, 1)}
                    disabled={index === total - 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                    title="Bajar paso"
                >
                    <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => onRemove(paso.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all mt-1"
                    title="Eliminar paso"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export default Recetas;
