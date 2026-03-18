import React, { useState, useMemo } from 'react';
import {
    ChefHat,
    Plus,
    Search,
    Edit2,
    Trash2,
    Info,
    ChevronRight,
    Layers,
    History,
    ArrowRight,
    UtensilsCrossed,
    Save,
    X,
    AlertCircle
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Producto, Receta, IngredienteReceta } from '@/types';
import { toast } from 'sonner';

interface RecetasProps {
    productos: Producto[];
    recetas: Receta[];
    getMejorPrecio: (productoId: string) => any;
    getProductoById: (id: string) => Producto | undefined;
    addReceta: (receta: Receta) => Promise<void>;
    updateReceta: (receta: Receta) => Promise<void>;
    deleteReceta: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
}

const Recetas: React.FC<RecetasProps> = ({
    productos,
    recetas,
    getMejorPrecio,
    getProductoById,
    addReceta,
    updateReceta,
    deleteReceta,
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header con Estética Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 kpi-blue rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ChefHat className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Escandallos y Recetas
                            <Badge variant="outline" className="ml-2 bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">BOM</Badge>
                        </h1>
                        <p className="text-slate-500 text-sm">Cálculo de costos de producción e ingredientes</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar receta..."
                            className="pl-10 w-full md:w-64 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20">
                        <Plus className="w-4 h-4" />
                        Nueva Receta
                    </Button>
                </div>
            </div>

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

                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Ingredientes:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{receta.ingredientes.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Rendimiento:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{receta.porcionesResultantes} unidades</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Margen Actual:</span>
                                        <Badge className={producto.precioVenta > receta.costoPorPorcion ? 'bg-emerald-500' : 'bg-red-500'}>
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

            {/* Diálogo de Creación/Edición */}
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Columna Izquierda: Info General */}
                            <div className="md:col-span-1 space-y-6">
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Producto Elaborado</label>
                                    <Select value={selectedProductoId} onValueChange={setSelectedProductoId} disabled={!!editingReceta}>
                                        <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800">
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
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Rendimiento (Unidades/Batch)</label>
                                    <Input
                                        type="number"
                                        value={porciones}
                                        onChange={(e) => setPorciones(Number(e.target.value))}
                                        className="rounded-xl bg-slate-50 dark:bg-slate-800"
                                    />
                                    <p className="text-[10px] text-slate-500">Ej: Cuántos panes salen con estas cantidades</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-4">
                                    <div className="flex justify-between items-center text-slate-400 text-xs">
                                        <span>COSTO TOTAL BATCH</span>
                                        <History className="w-3 h-3" />
                                    </div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {formatCurrency(calculateTotalCost())}
                                    </div>
                                    <div className="pt-4 border-t border-slate-800">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-slate-400 text-[10px]">COSTO POR UNIDAD</span>
                                            <span className="text-emerald-400 text-xs font-bold">{formatCurrency(calculateTotalCost() / (porciones || 1))}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Instrucciones Breves</label>
                                    <textarea
                                        className="w-full min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Pasos clave de preparación..."
                                        value={instrucciones}
                                        onChange={(e) => setInstrucciones(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Columna Derecha: Ingredientes */}
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold flex items-center gap-2">
                                        Ingredientes / Materia Prima
                                        <Badge variant="secondary" className="rounded-full">{recipeIngredients.length}</Badge>
                                    </h3>
                                    <Button variant="outline" size="sm" onClick={handleAddIngredient} className="rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50">
                                        <Plus className="w-3 h-3 mr-1" /> Añadir
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {recipeIngredients.map((ing, index) => (
                                        <div key={ing.id} className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group relative">
                                            <div className="flex-1">
                                                <Select
                                                    value={ing.productoId}
                                                    onValueChange={(val) => handleIngredientChange(ing.id!, 'productoId', val)}
                                                >
                                                    <SelectTrigger className="bg-white dark:bg-slate-900 rounded-xl border-slate-200 h-10">
                                                        <SelectValue placeholder="Ingrediente..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ingredientesDisponibles.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.nombre} ({formatCurrency(getMejorPrecio(p.id)?.precioCosto || p.costoBase || 0)})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <Input
                                                    type="number"
                                                    placeholder="Cant"
                                                    className="w-20 bg-white dark:bg-slate-900 rounded-xl border-slate-200 h-10"
                                                    value={ing.cantidad}
                                                    onChange={(e) => handleIngredientChange(ing.id!, 'cantidad', Number(e.target.value))}
                                                />
                                                <Select
                                                    value={ing.unidad}
                                                    onValueChange={(val) => handleIngredientChange(ing.id!, 'unidad', val)}
                                                >
                                                    <SelectTrigger className="w-20 bg-white dark:bg-slate-900 rounded-xl border-slate-200 h-10">
                                                        <SelectValue placeholder="Unid" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="gr">gr</SelectItem>
                                                        <SelectItem value="kg">kg</SelectItem>
                                                        <SelectItem value="ml">ml</SelectItem>
                                                        <SelectItem value="l">l</SelectItem>
                                                        <SelectItem value="und">und</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center px-2 bg-slate-200 dark:bg-slate-700 rounded-xl min-w-[80px] justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(ing.costoCalculado || 0)}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveIngredient(ing.id!)}
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {recipeIngredients.length === 0 && (
                                        <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-3xl">
                                            <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                                <ArrowRight className="w-5 h-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm text-slate-400">Haz clic en "Añadir" para empezar a costear</p>
                                        </div>
                                    )}
                                </div>
                            </div>
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
        </div>
    );
};

export default Recetas;
