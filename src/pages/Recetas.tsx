import { generateUUID } from '@/lib/safe-utils';
import React, { useState, useMemo, useRef } from 'react';
import {
    Plus, Search, Edit2, Trash2, ChevronRight, Layers, ChefHat,
    UtensilsCrossed, Save, AlertCircle, Thermometer, Timer, Gauge, Clock,
    Scale, TrendingUp, Info, History as HistoryIcon, Camera, X, ArrowUp,
    ArrowDown, ListOrdered, Filter, Calculator, ChevronDown, ChevronUp,
    Package, Wheat, Percent, Tag, PieChart, Layers3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type {
    Producto, Receta, IngredienteReceta,
    FormulacionBase, ModeloPan, IngredienteFormulacion,
    MixItemProduccion, TipoLata
} from '@/types';
import { ARROBA_KG } from '@/types';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// gr → 0.001 (el precio de proveedores es $/kg), ml → 0.001 ($/l), el resto directo
function factorUnidad(unidad: string): number {
    if (unidad === 'gr') return 0.001;
    if (unidad === 'ml') return 0.001;
    return 1;
}

// ─── Props ───────────────────────────────────────────────────────────────────

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

// ─── Categorías de formulaciones ─────────────────────────────────────────────
const CATS_FORMULACION = [
    { id: 'panes', label: 'Panes' },
    { id: 'pasteleria', label: 'Pastelería' },
    { id: 'hojaldres', label: 'Hojaldres' },
    { id: 'dulces', label: 'Dulces' },
    { id: 'especiales', label: 'Especiales' },
] as const;

type CatFormulacion = typeof CATS_FORMULACION[number]['id'];

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

const Recetas: React.FC<RecetasProps> = ({
    productos, recetas, formulaciones, modelosPan,
    getMejorPrecio, getProductoById,
    addReceta, updateReceta, deleteReceta,
    addFormulacion, updateFormulacion, deleteFormulacion,
    addModeloPan, updateModeloPan, deleteModeloPan,
    formatCurrency
}) => {

    // ── Búsqueda global ───────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');

    // ── Estado modal RECETA TRADICIONAL ──────────────────────────────────
    const [isRecetaOpen, setIsRecetaOpen] = useState(false);
    const [editingReceta, setEditingReceta] = useState<Receta | null>(null);
    const [selectedProductoId, setSelectedProductoId] = useState('');
    const [recipeIngredients, setRecipeIngredients] = useState<Partial<IngredienteReceta>[]>([]);
    const [porciones, setPorciones] = useState(1);
    const [pasos, setPasos] = useState<PasoElaboracion[]>([]);
    const [temperatura, setTemperatura] = useState<number | undefined>();
    const [tHorneado, setTHorneado] = useState<number | undefined>();
    const [tFermentacion, setTFermentacion] = useState<number | undefined>();
    const [dificultad, setDificultad] = useState<'facil' | 'medio' | 'maestro'>('medio');
    const [categoriasInsumosFiltro, setCategoriasInsumosFiltro] = useState<string[]>([]);

    // ── Estado modal FORMULACIÓN MAESTRA ─────────────────────────────────
    const [isFormulacionOpen, setIsFormulacionOpen] = useState(false);
    const [editingFormulacion, setEditingFormulacion] = useState<FormulacionBase | null>(null);
    const [fNombre, setFNombre] = useState('');
    const [fDescripcion, setFDescripcion] = useState('');
    const [fCategoria, setFCategoria] = useState<CatFormulacion>('panes');
    const [fIngredientes, setFIngredientes] = useState<Partial<IngredienteFormulacion>[]>([]);
    const [fTemperatura, setFTemperatura] = useState<number | undefined>();
    const [fHorneado, setFHorneado] = useState<number | undefined>();
    const [fFermentacion, setFFermentacion] = useState<number | undefined>();
    const [fInstrucciones, setFInstrucciones] = useState('');
    const [fCategoriasInsumosF, setFCategoriasInsumosF] = useState<string[]>([]);

    // ── Estado modal MODELO DE PAN ────────────────────────────────────────
    const [isModeloOpen, setIsModeloOpen] = useState(false);
    const [editingModelo, setEditingModelo] = useState<ModeloPan | null>(null);
    const [mNombre, setMNombre] = useState('');
    const [mFormulacionId, setMFormulacionId] = useState('');
    const [mPeso, setMPeso] = useState(80);
    const [mPrecioVenta, setMPrecioVenta] = useState(0);
    const [mMerma, setMMerma] = useState(5);
    const [mPiezasLata, setMPiezasLata] = useState<number | undefined>();

    // ── Calculadora de producción ─────────────────────────────────────────
    const [calcFormulacionId, setCalcFormulacionId] = useState('');
    const [calcArrobas, setCalcArrobas] = useState(1);
    const [expandedFormulacion, setExpandedFormulacion] = useState<string | null>(null);

    // ── Modal DISTRIBUCIÓN POR ARROBA ─────────────────────────────────────
    const [isDistribucionOpen, setIsDistribucionOpen] = useState(false);
    const [distribucionFormulacion, setDistribucionFormulacion] = useState<FormulacionBase | null>(null);
    const [dMix, setDMix] = useState<Partial<MixItemProduccion>[]>([]);
    // Tipos de lata: configurados en Producción → Config (se guardan en localStorage)
    const tiposLata = useMemo<TipoLata[]>(() => {
        try { return JSON.parse(localStorage.getItem('dp_tipos_lata') || '[]'); } catch { return []; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDistribucionOpen]);

    // ── Listas derivadas ──────────────────────────────────────────────────
    const productosElaborados = useMemo(() => productos.filter(p => p.tipo !== 'ingrediente'), [productos]);
    const ingredientesDisponibles = useMemo(() => productos.filter(p => p.tipo === 'ingrediente'), [productos]);

    const categoriasDeInsumos = useMemo(() => {
        const cats = new Set(ingredientesDisponibles.map(p => p.categoria).filter(Boolean));
        return Array.from(cats).sort();
    }, [ingredientesDisponibles]);

    const ingredientesFiltrados = useMemo(() =>
        categoriasInsumosFiltro.length === 0
            ? ingredientesDisponibles
            : ingredientesDisponibles.filter(p => categoriasInsumosFiltro.includes(p.categoria))
        , [ingredientesDisponibles, categoriasInsumosFiltro]);

    const ingredientesFiltradosF = useMemo(() =>
        fCategoriasInsumosF.length === 0
            ? ingredientesDisponibles
            : ingredientesDisponibles.filter(p => fCategoriasInsumosF.includes(p.categoria))
        , [ingredientesDisponibles, fCategoriasInsumosF]);

    const filtradas = useMemo(() =>
        recetas.filter(r => getProductoById(r.productoId)?.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        , [recetas, searchTerm, getProductoById]);

    const filtradasFormulaciones = useMemo(() =>
        formulaciones.filter(f =>
            f.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.categoria.toLowerCase().includes(searchTerm.toLowerCase())
        ), [formulaciones, searchTerm]);

    // ─────────────────────────────────────────────────────────────────────
    // PASOS (Receta Tradicional)
    // ─────────────────────────────────────────────────────────────────────

    const parsePasos = (instrucciones?: string): PasoElaboracion[] => {
        if (!instrucciones) return [];
        try {
            const p = JSON.parse(instrucciones);
            if (Array.isArray(p) && p.length > 0 && 'descripcion' in p[0]) return p;
        } catch { }
        if (instrucciones.trim()) return [{ id: generateUUID(), titulo: 'Instrucciones', descripcion: instrucciones }];
        return [];
    };

    const serializePasos = (ps: PasoElaboracion[]) => ps.length === 0 ? '' : JSON.stringify(ps);

    const addPaso = () => setPasos(p => [...p, { id: generateUUID(), titulo: '', descripcion: '' }]);
    const removePaso = (id: string) => setPasos(p => p.filter(x => x.id !== id));
    const updatePaso = (id: string, field: keyof PasoElaboracion, value: string | undefined) =>
        setPasos(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
    const movePaso = (index: number, dir: -1 | 1) => {
        const n = index + dir;
        if (n < 0 || n >= pasos.length) return;
        const a = [...pasos]; [a[index], a[n]] = [a[n], a[index]]; setPasos(a);
    };
    const handlePasoImage = async (pasoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        try { updatePaso(pasoId, 'imagenBase64', await comprimirImagen(file)); }
        catch { toast.error('No se pudo cargar la imagen'); }
        e.target.value = '';
    };

    // ─────────────────────────────────────────────────────────────────────
    // RECETA TRADICIONAL — abrir / guardar
    // ─────────────────────────────────────────────────────────────────────

    const openCreateReceta = () => {
        setEditingReceta(null); setSelectedProductoId(''); setRecipeIngredients([]);
        setPorciones(1); setPasos([]); setTemperatura(undefined); setTHorneado(undefined);
        setTFermentacion(undefined); setDificultad('medio'); setCategoriasInsumosFiltro([]);
        setIsRecetaOpen(true);
    };
    const openEditReceta = (r: Receta) => {
        setEditingReceta(r); setSelectedProductoId(r.productoId); setRecipeIngredients(r.ingredientes);
        setPorciones(r.porcionesResultantes); setPasos(parsePasos(r.instrucciones));
        setTemperatura(r.temperaturaHorno); setTHorneado(r.tiempoHorneado);
        setTFermentacion(r.tiempoFermentacion); setDificultad(r.dificultad || 'medio');
        setCategoriasInsumosFiltro([]); setIsRecetaOpen(true);
    };

    const calcularCostoIng = (productoId: string, cantidad: number, unidad: string) => {
        const mp = getMejorPrecio(productoId);
        const cu = mp ? mp.precioCosto : (getProductoById(productoId)?.costoBase || 0);
        return cu * cantidad * factorUnidad(unidad);
    };

    const handleIngChange = (id: string, field: keyof IngredienteReceta, value: any) =>
        setRecipeIngredients(list => list.map(ing => {
            if (ing.id !== id) return ing;
            const u = { ...ing, [field]: value };
            if (['productoId', 'cantidad', 'unidad'].includes(field))
                u.costoCalculado = calcularCostoIng(u.productoId as string, u.cantidad || 0, u.unidad || 'gr');
            return u;
        }));

    const totalReceta = () => recipeIngredients.reduce((s, i) => s + (i.costoCalculado || 0), 0);

    const saveReceta = async () => {
        if (!selectedProductoId) { toast.error('Selecciona un producto'); return; }
        if (recipeIngredients.length === 0) { toast.error('Agrega al menos un insumo'); return; }
        const total = totalReceta();
        const r: Receta = {
            id: editingReceta?.id || generateUUID(),
            productoId: selectedProductoId,
            ingredientes: recipeIngredients as IngredienteReceta[],
            porcionesResultantes: porciones,
            costoTotal: total,
            costoPorPorcion: total / (porciones || 1),
            instrucciones: serializePasos(pasos),
            temperaturaHorno: temperatura, tiempoHorneado: tHorneado,
            tiempoFermentacion: tFermentacion, dificultad,
            fechaActualizacion: new Date().toISOString()
        };
        try {
            editingReceta ? await updateReceta(r) : await addReceta(r);
            toast.success(editingReceta ? 'Receta actualizada' : 'Receta creada');
            setIsRecetaOpen(false);
        } catch { toast.error('Error al guardar la receta'); }
    };

    // ─────────────────────────────────────────────────────────────────────
    // FORMULACIONES MAESTRAS — abrir / guardar
    // ─────────────────────────────────────────────────────────────────────

    const openCreateFormulacion = () => {
        setEditingFormulacion(null); setFNombre(''); setFDescripcion('');
        setFCategoria('panes'); setFIngredientes([]); setFTemperatura(undefined);
        setFHorneado(undefined); setFFermentacion(undefined); setFInstrucciones('');
        setFCategoriasInsumosF([]); setIsFormulacionOpen(true);
    };

    const openEditFormulacion = (f: FormulacionBase) => {
        setEditingFormulacion(f); setFNombre(f.nombre); setFDescripcion(f.descripcion || '');
        setFCategoria(f.categoria as CatFormulacion); setFIngredientes(f.ingredientes);
        setFTemperatura(f.temperaturaHorno); setFHorneado(f.tiempoHorneado);
        setFFermentacion(f.tiempoFermentacion); setFInstrucciones(f.instrucciones || '');
        setFCategoriasInsumosF([]); setIsFormulacionOpen(true);
    };

    const addIngFormulacion = () => setFIngredientes(p => [...p, {
        id: generateUUID(), formulacionId: editingFormulacion?.id || '',
        productoId: '', cantidadPorArroba: 0, unidad: 'kg',
        porcentajePanadero: undefined, costoUnitario: 0, costoTotalArroba: 0
    }]);

    const removeIngFormulacion = (id: string) => setFIngredientes(p => p.filter(i => i.id !== id));

    const updateIngFormulacion = (id: string, field: keyof IngredienteFormulacion, value: any) =>
        setFIngredientes(list => list.map(ing => {
            if (ing.id !== id) return ing;
            const u = { ...ing, [field]: value };
            if (['productoId', 'cantidadPorArroba', 'unidad'].includes(field)) {
                const mp = getMejorPrecio(u.productoId as string);
                const cu = mp ? mp.precioCosto : (getProductoById(u.productoId as string)?.costoBase || 0);
                u.costoUnitario = cu;
                u.costoTotalArroba = cu * (u.cantidadPorArroba || 0) * factorUnidad(u.unidad || 'kg');
            }
            return u;
        }));

    const totalFormulacion = () => fIngredientes.reduce((s, i) => s + (i.costoTotalArroba || 0), 0);
    const rendimientoMasa = () => {
        return fIngredientes.reduce((s, i) => {
            const kg = (i.cantidadPorArroba || 0) * factorUnidad(i.unidad || 'kg');
            return s + kg;
        }, 0);
    };

    const saveFormulacion = async () => {
        if (!fNombre.trim()) { toast.error('Escribe el nombre de la fórmula'); return; }
        if (fIngredientes.length === 0) { toast.error('Agrega al menos un ingrediente'); return; }
        const total = totalFormulacion();
        const rendimiento = rendimientoMasa();
        const f: FormulacionBase = {
            id: editingFormulacion?.id || generateUUID(),
            nombre: fNombre.trim(), descripcion: fDescripcion,
            categoria: fCategoria,
            ingredientes: fIngredientes as IngredienteFormulacion[],
            rendimientoBaseKg: rendimiento,
            costoTotalArroba: total,
            tiempoFermentacion: fFermentacion, tiempoHorneado: fHorneado,
            temperaturaHorno: fTemperatura, instrucciones: fInstrucciones,
            activo: true, fechaActualizacion: new Date().toISOString()
        };
        try {
            if (editingFormulacion) {
                await updateFormulacion(f.id, f);
                toast.success('Fórmula actualizada');
            } else {
                await addFormulacion(f);
                toast.success('Fórmula creada');
            }
            setIsFormulacionOpen(false);
        } catch { toast.error('Error al guardar la fórmula'); }
    };

    const deleteFormulacionHandler = async (id: string) => {
        const modelsCount = modelosPan.filter(m => m.formulacionId === id).length;
        const msg = modelsCount > 0
            ? `Esta fórmula tiene ${modelsCount} modelo(s) vinculado(s). ¿Eliminar igual?`
            : '¿Eliminar esta fórmula maestra?';
        if (!confirm(msg)) return;
        await deleteFormulacion(id);
        toast.success('Fórmula eliminada');
    };

    // ─────────────────────────────────────────────────────────────────────
    // MODELOS DE PAN — abrir / guardar
    // ─────────────────────────────────────────────────────────────────────

    const calcPanesPorArroba = (pesoGr: number, merma: number) =>
        pesoGr > 0 ? Math.floor((ARROBA_KG * 1000 * (1 - merma / 100)) / pesoGr) : 0;

    const openCreateModelo = (formulacionId?: string) => {
        setEditingModelo(null); setMNombre('');
        setMFormulacionId(formulacionId || (formulaciones[0]?.id || ''));
        setMPeso(80); setMPrecioVenta(0); setMMerma(5); setMPiezasLata(undefined);
        setIsModeloOpen(true);
    };

    const openEditModelo = (m: ModeloPan) => {
        setEditingModelo(m); setMNombre(m.nombre); setMFormulacionId(m.formulacionId);
        setMPeso(m.pesoUnitarioGr); setMPrecioVenta(m.precioVentaUnitario);
        setMMerma(m.mermaEstimada); setMPiezasLata(m.piezasPorLata);
        setIsModeloOpen(true);
    };

    const saveModelo = async () => {
        if (!mNombre.trim()) { toast.error('Escribe el nombre del modelo'); return; }
        if (!mFormulacionId) { toast.error('Selecciona una fórmula de masa'); return; }
        if (mPeso <= 0) { toast.error('El peso debe ser mayor a 0'); return; }
        const form = formulaciones.find(f => f.id === mFormulacionId);
        const panesPorArr = calcPanesPorArroba(mPeso, mMerma);
        const costoUnit = form && panesPorArr > 0 ? form.costoTotalArroba / panesPorArr : 0;
        const margen = mPrecioVenta > 0 && costoUnit > 0
            ? Math.round(((mPrecioVenta - costoUnit) / mPrecioVenta) * 100)
            : 0;
        const m: ModeloPan = {
            id: editingModelo?.id || generateUUID(),
            nombre: mNombre.trim(), formulacionId: mFormulacionId,
            pesoUnitarioGr: mPeso, panesPorArroba: panesPorArr,
            precioVentaUnitario: mPrecioVenta, costoUnitario: costoUnit,
            margenPorcentaje: margen, mermaEstimada: mMerma,
            piezasPorLata: mPiezasLata, activo: true, createdAt: new Date().toISOString()
        };
        try {
            if (editingModelo) {
                await updateModeloPan(m.id, m);
                toast.success('Modelo actualizado');
            } else {
                await addModeloPan(m);
                toast.success('Modelo creado');
            }
            setIsModeloOpen(false);
        } catch { toast.error('Error al guardar el modelo'); }
    };

    // ─────────────────────────────────────────────────────────────────────
    // CALCULADORA DE PRODUCCIÓN
    // ─────────────────────────────────────────────────────────────────────

    const calcFormulacion = useMemo(() =>
        formulaciones.find(f => f.id === calcFormulacionId) || formulaciones[0]
        , [formulaciones, calcFormulacionId]);

    const calcModelos = useMemo(() =>
        calcFormulacion ? modelosPan.filter(m => m.formulacionId === calcFormulacion.id) : []
        , [modelosPan, calcFormulacion]);

    // ─────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────
    return (
        <Tabs defaultValue="tradicional" className="space-y-8 animate-in fade-in duration-500">

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                            <ChefHat className="w-9 h-9 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">Recetas Técnicas</h1>
                            <p className="text-slate-500 text-sm font-medium">Fichas de producto y fórmulas maestras de producción por lote</p>
                        </div>
                    </div>
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl h-14 w-full md:w-auto">
                        <TabsTrigger value="tradicional" className="rounded-xl px-6 h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-widest">
                            <UtensilsCrossed className="w-4 h-4" /> Recetas
                        </TabsTrigger>
                        <TabsTrigger value="maestro" className="rounded-xl px-6 h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-widest">
                            <Scale className="w-4 h-4" /> Maestro Panadero
                        </TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input placeholder="Buscar..." className="pl-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl h-14 text-sm font-medium w-full"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                TAB 1: RECETAS TRADICIONALES
            ══════════════════════════════════════════════════════════ */}
            <TabsContent value="tradicional" className="m-0 space-y-8 animate-in fade-in">
                <div className="flex justify-end">
                    <Button onClick={openCreateReceta} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Nueva Receta
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtradas.map(receta => {
                        const producto = getProductoById(receta.productoId);
                        if (!producto) return null;
                        const ps = parsePasos(receta.instrucciones);
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
                                            <Button variant="ghost" size="icon" onClick={() => openEditReceta(receta)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Eliminar esta receta?')) { deleteReceta(receta.id); toast.success('Eliminada'); } }} className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Costo total</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(receta.costoTotal)}</p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                            <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Por unidad</p>
                                            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(receta.costoPorPorcion)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        {ps.length > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full"><ListOrdered className="w-3 h-3" /> {ps.length} pasos</span>}
                                        {ps.some(p => p.imagenBase64) && <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full"><Camera className="w-3 h-3" /> con fotos</span>}
                                    </div>
                                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                                        <div className="flex justify-between text-[11px]"><span className="text-slate-500 uppercase font-black tracking-widest">Insumos:</span><span className="font-black text-slate-900 dark:text-white">{receta.ingredientes.length} tipos</span></div>
                                        <div className="flex justify-between text-[11px]"><span className="text-slate-500 uppercase font-black tracking-widest">Produce:</span><span className="font-black text-slate-900 dark:text-white">{receta.porcionesResultantes} unidades</span></div>
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">Margen:</span>
                                            <Badge className={cn("text-[9px] font-black uppercase h-5", producto.precioVenta > receta.costoPorPorcion ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                                                {producto.precioVenta > 0 ? Math.round((1 - receta.costoPorPorcion / producto.precioVenta) * 100) : 0}%
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
                            <p className="text-slate-500">No hay recetas todavía</p>
                            <Button variant="link" onClick={openCreateReceta} className="text-blue-600 mt-2">Crear primera receta</Button>
                        </div>
                    )}
                </div>
            </TabsContent>

            {/* ══════════════════════════════════════════════════════════
                TAB 2: MAESTRO PANADERO
            ══════════════════════════════════════════════════════════ */}
            <TabsContent value="maestro" className="m-0 space-y-6 animate-in fade-in">

                {/* Explicación rápida */}
                <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex items-start gap-4">
                    <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-indigo-800 dark:text-indigo-300 font-medium leading-relaxed">
                        <b>¿Para qué sirve esto?</b> Trabajas con <b>1 Arroba = 11.5 kg de harina</b> como base.
                        Defines la proporción de cada ingrediente para esa base (la <b>Fórmula Maestra</b>).
                        Luego creas <b>Modelos de Pan</b> con distintos gramajes: de una misma masa puede salir
                        un pan de 40 gr o uno de 80 gr. La calculadora te dice cuánto ingrediente preparar
                        y cuántos panes salen según las arrobas que vayas a trabajar hoy.
                    </div>
                </div>

                {/* Acciones principales */}
                <div className="flex flex-wrap items-center gap-3 justify-end">
                    <Button onClick={openCreateFormulacion} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Nueva Fórmula Maestra
                    </Button>
                    <Button onClick={() => openCreateModelo()} variant="outline" className="rounded-2xl h-11 px-6 font-black uppercase text-xs tracking-widest flex items-center gap-2 border-slate-200">
                        <Package className="w-4 h-4" /> Nuevo Modelo de Pan
                    </Button>
                </div>

                {/* Lista de fórmulas con sus modelos */}
                {filtradasFormulaciones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Wheat className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-500 mb-2">No hay fórmulas maestras todavía</p>
                        <Button variant="link" onClick={openCreateFormulacion} className="text-indigo-600">Crear primera fórmula</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtradasFormulaciones.map(f => {
                            const modelos = modelosPan.filter(m => m.formulacionId === f.id);
                            const isExpanded = expandedFormulacion === f.id;
                            return (
                                <Card key={f.id} className="rounded-3xl border-slate-200 dark:border-slate-800 overflow-hidden">
                                    {/* Cabecera de fórmula */}
                                    <div className="p-6">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                                                    <Scale className="w-6 h-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight truncate">{f.nombre}</h3>
                                                        <Badge variant="outline" className="text-[9px] font-black capitalize shrink-0">{f.categoria}</Badge>
                                                    </div>
                                                    {f.descripcion && <p className="text-xs text-slate-400 mt-0.5 truncate">{f.descripcion}</p>}
                                                </div>
                                            </div>

                                            {/* Stats + acciones */}
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="hidden md:flex items-center gap-4 text-sm">
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Insumos</p>
                                                        <p className="font-black text-slate-800 dark:text-white">{f.ingredientes.length}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Costo/arroba</p>
                                                        <p className="font-black text-indigo-600">{formatCurrency(f.costoTotalArroba)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Modelos</p>
                                                        <p className="font-black text-slate-800 dark:text-white">{modelos.length}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditFormulacion(f)} className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteFormulacionHandler(f.id)} className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setExpandedFormulacion(isExpanded ? null : f.id)} className="h-9 w-9 text-slate-400 hover:text-slate-700 rounded-xl">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modelos expandibles */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                    <Package className="w-3.5 h-3.5" /> Modelos de Pan vinculados
                                                </h4>
                                                <Button size="sm" variant="outline" onClick={() => openCreateModelo(f.id)} className="rounded-xl h-8 px-3 text-[10px] font-black uppercase border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                                    <Plus className="w-3 h-3 mr-1" /> Agregar modelo
                                                </Button>
                                            </div>

                                            {modelos.length === 0 ? (
                                                <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                                                    <Package className="w-8 h-8 opacity-30" />
                                                    <span className="text-sm">Sin modelos. Agrega uno para ver cuántos panes salen por arroba.</span>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {modelos.map(m => (
                                                        <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 group hover:shadow-md transition-all">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <Badge className="bg-indigo-600 text-white text-[9px] font-black">{m.pesoUnitarioGr}g</Badge>
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button variant="ghost" size="icon" onClick={() => openEditModelo(m)} className="h-6 w-6 p-0 text-slate-400 hover:text-indigo-600"><Edit2 className="w-3 h-3" /></Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Eliminar este modelo?')) { deleteModeloPan(m.id); toast.success('Modelo eliminado'); } }} className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></Button>
                                                                </div>
                                                            </div>
                                                            <h5 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-tight mb-3 truncate">{m.nombre}</h5>
                                                            <div className="space-y-1.5 text-[10px]">
                                                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Produce/arroba</span><span className="font-black text-slate-800 dark:text-white">{m.panesPorArroba} und</span></div>
                                                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Costo unit.</span><span className="font-black text-slate-800 dark:text-white">{formatCurrency(m.costoUnitario)}</span></div>
                                                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Precio venta</span><span className="font-black text-emerald-600">{formatCurrency(m.precioVentaUnitario)}</span></div>
                                                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Margen</span>
                                                                    <Badge className={cn("text-[9px] font-black h-4", m.margenPorcentaje >= 30 ? "bg-emerald-500 text-white" : m.margenPorcentaje >= 0 ? "bg-amber-500 text-white" : "bg-rose-500 text-white")}>
                                                                        {m.margenPorcentaje}%
                                                                    </Badge>
                                                                </div>
                                                                {m.piezasPorLata && <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Por lata</span><span className="font-black text-slate-800 dark:text-white">{m.piezasPorLata} und</span></div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Calculadora de producción */}
                {formulaciones.length > 0 && (
                    <Card className="rounded-3xl border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-800">
                                    <Calculator className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Calculadora de Producción</h3>
                                    <p className="text-xs text-slate-400 font-medium">¿Cuántas arrobas voy a preparar hoy?</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Fórmula de masa</Label>
                                    <Select value={calcFormulacion?.id || ''} onValueChange={setCalcFormulacionId}>
                                        <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12"><SelectValue placeholder="Seleccionar fórmula..." /></SelectTrigger>
                                        <SelectContent>
                                            {formulaciones.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Arrobas a preparar</Label>
                                    <div className="flex items-center gap-3">
                                        <Input type="number" min={0.5} step={0.5} value={calcArrobas}
                                            onChange={e => setCalcArrobas(Math.max(0.5, Number(e.target.value)))}
                                            className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" />
                                        <div className="text-sm font-black text-slate-500 shrink-0">= {(calcArrobas * ARROBA_KG).toFixed(1)} kg</div>
                                    </div>
                                </div>
                            </div>

                            {calcFormulacion && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Ingredientes necesarios */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                            <Wheat className="w-3.5 h-3.5 text-amber-500" /> Ingredientes necesarios ({calcArrobas} arroba{calcArrobas !== 1 ? 's' : ''})
                                        </h4>
                                        <div className="space-y-2">
                                            {calcFormulacion.ingredientes.map(ing => {
                                                const prod = getProductoById(ing.productoId);
                                                const cantTotal = ing.cantidadPorArroba * calcArrobas;
                                                const unidadMostrar = ing.unidad;
                                                return (
                                                    <div key={ing.id} className="flex justify-between items-center text-sm">
                                                        <span className="font-medium text-slate-600 dark:text-slate-400 truncate mr-2">{prod?.nombre || '—'}</span>
                                                        <span className="font-black text-slate-900 dark:text-white shrink-0">
                                                            {cantTotal >= 1000 && unidadMostrar === 'gr'
                                                                ? `${(cantTotal / 1000).toFixed(2)} kg`
                                                                : cantTotal >= 1000 && unidadMostrar === 'ml'
                                                                    ? `${(cantTotal / 1000).toFixed(2)} l`
                                                                    : `${cantTotal.toFixed(1)} ${unidadMostrar}`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-slate-400">Costo total ingredientes</span>
                                            <span className="font-black text-indigo-600">{formatCurrency(calcFormulacion.costoTotalArroba * calcArrobas)}</span>
                                        </div>
                                    </div>

                                    {/* Producción esperada */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-indigo-500" /> Producción esperada
                                        </h4>
                                        {calcModelos.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Agrega modelos de pan para ver las unidades que producirías.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {calcModelos.map(m => {
                                                    const unidades = m.panesPorArroba * calcArrobas;
                                                    const ingresos = unidades * m.precioVentaUnitario;
                                                    return (
                                                        <div key={m.id} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-black text-slate-800 dark:text-white text-sm truncate mr-2">{m.nombre}</span>
                                                                <span className="font-black text-indigo-600 shrink-0">{unidades} und</span>
                                                            </div>
                                                            {m.precioVentaUnitario > 0 && (
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-slate-400 font-bold">Ingresos potenciales</span>
                                                                    <span className="font-black text-emerald-600">{formatCurrency(ingresos)}</span>
                                                                </div>
                                                            )}
                                                            {m.piezasPorLata && (
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-slate-400 font-bold">Latas necesarias</span>
                                                                    <span className="font-black text-slate-600">{Math.ceil(unidades / m.piezasPorLata)} latas</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </TabsContent>

            {/* ════════════════════════════════════════════════════════════
                MODAL RECETA TRADICIONAL
            ════════════════════════════════════════════════════════════ */}
            <Dialog open={isRecetaOpen} onOpenChange={setIsRecetaOpen}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 border-0 bg-white dark:bg-slate-900">
                    <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <ChefHat className="w-6 h-6 text-blue-600" />
                                <DialogTitle className="text-2xl font-bold">{editingReceta ? 'Editar Receta' : 'Nueva Receta'}</DialogTitle>
                            </div>
                            <DialogDescription>Define insumos, costos y el paso a paso de elaboración</DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="insumos" className="w-full">
                            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl grid grid-cols-2 w-full max-w-sm ml-auto mb-8">
                                <TabsTrigger value="insumos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2"><Layers className="w-4 h-4" /> Insumos</TabsTrigger>
                                <TabsTrigger value="tecnica" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm gap-2"><ChefHat className="w-4 h-4" /> Ficha Técnica</TabsTrigger>
                            </TabsList>

                            <TabsContent value="insumos" className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-1 space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Producto que se elabora</Label>
                                            <Select value={selectedProductoId} onValueChange={setSelectedProductoId} disabled={!!editingReceta}>
                                                <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                <SelectContent>{productosElaborados.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">¿Cuántas unidades produce esta receta?</Label>
                                            <Input type="number" min={1} value={porciones} onChange={e => setPorciones(Number(e.target.value))} className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" placeholder="Ej: 20 panes" />
                                        </div>
                                        <div className="p-6 rounded-[2rem] bg-slate-950 text-white relative overflow-hidden">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Costo total de insumos</Label>
                                            <div className="text-3xl font-black text-white mb-4">{formatCurrency(totalReceta())}</div>
                                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                                <span className="text-slate-500 text-[10px] font-black uppercase">Por unidad:</span>
                                                <span className="text-blue-400 text-sm font-black">{formatCurrency(totalReceta() / (porciones || 1))}</span>
                                            </div>
                                            {selectedProductoId && (() => {
                                                const prod = getProductoById(selectedProductoId);
                                                const cu = totalReceta() / (porciones || 1);
                                                if (prod?.precioVenta && cu > 0) {
                                                    const m = Math.round((1 - cu / prod.precioVenta) * 100);
                                                    return <div className="pt-3 border-t border-slate-800 flex justify-between items-center mt-3">
                                                        <span className="text-slate-500 text-[10px] font-black uppercase">Margen real:</span>
                                                        <span className={cn("text-sm font-black", m >= 30 ? "text-emerald-400" : m >= 0 ? "text-amber-400" : "text-rose-400")}>{m}%</span>
                                                    </div>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                                Insumos <Badge className="bg-blue-600/10 text-blue-500 border-blue-500/20 rounded-full h-5 text-[10px]">{recipeIngredients.length}</Badge>
                                            </h3>
                                            <Button variant="ghost" size="sm" onClick={() => setRecipeIngredients(p => [...p, { id: generateUUID(), productoId: '', cantidad: 0, unidad: 'gr', costoCalculado: 0 }])} className="rounded-xl text-blue-600 hover:bg-blue-600/10 font-black text-[10px] uppercase">
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                                            </Button>
                                        </div>

                                        {categoriasDeInsumos.length > 1 && (
                                            <div className="px-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por categoría:</span>
                                                    {categoriasInsumosFiltro.length > 0 && <button onClick={() => setCategoriasInsumosFiltro([])} className="text-[10px] text-rose-500 font-black ml-auto">Limpiar</button>}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {categoriasDeInsumos.map(cat => (
                                                        <button key={cat} onClick={() => setCategoriasInsumosFiltro(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat])}
                                                            className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all",
                                                                categoriasInsumosFiltro.includes(cat)
                                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 hover:border-indigo-400"
                                                            )}>
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                                            {recipeIngredients.map(ing => (
                                                <div key={ing.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                                                    <div className="col-span-12 md:col-span-5">
                                                        <Select value={ing.productoId} onValueChange={v => handleIngChange(ing.id!, 'productoId', v)}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl"><SelectValue placeholder="Insumo..." /></SelectTrigger>
                                                            <SelectContent>
                                                                {ingredientesFiltrados.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-4 md:col-span-2">
                                                        <Input type="number" value={ing.cantidad || ''} onChange={e => handleIngChange(ing.id!, 'cantidad', Number(e.target.value))} className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200" placeholder="Cant." />
                                                    </div>
                                                    <div className="col-span-4 md:col-span-2">
                                                        <Select value={ing.unidad} onValueChange={v => handleIngChange(ing.id!, 'unidad', v)}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {['gr', 'kg', 'ml', 'l', 'und'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-3 md:col-span-2 text-right">
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatCurrency(ing.costoCalculado || 0)}</span>
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Button onClick={() => setRecipeIngredients(p => p.filter(i => i.id !== ing.id))} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {recipeIngredients.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">Aún no hay insumos. Presiona "Agregar".</div>}
                                        </div>
                                        <div className="flex items-start gap-2 px-2 text-[10px] text-slate-400">
                                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                                            <span>Si el insumo tiene precio en $/kg y escribes en <b>gr</b>, el costo se convierte automáticamente. Igual para ml ↔ litros.</span>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="tecnica" className="space-y-8 animate-in fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Parámetros de Cocción</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Thermometer className="w-3 h-3" /> Temperatura</Label>
                                                <div className="relative"><Input type="number" placeholder="Ej: 180" value={temperatura || ''} onChange={e => setTemperatura(Number(e.target.value))} className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 text-lg font-black pr-10" /><span className="absolute right-4 top-4 text-slate-400 font-bold italic">°C</span></div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Timer className="w-3 h-3" /> Tiempo horno</Label>
                                                <div className="relative"><Input type="number" placeholder="Ej: 15" value={tHorneado || ''} onChange={e => setTHorneado(Number(e.target.value))} className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 text-lg font-black pr-12" /><span className="absolute right-4 top-4 text-slate-400 font-bold italic text-xs">min</span></div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Reposo / Fermentación</Label>
                                            <div className="relative"><Input type="number" placeholder="Tiempo (minutos)" value={tFermentacion || ''} onChange={e => setTFermentacion(Number(e.target.value))} className="rounded-2xl h-14 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" /><Clock className="absolute right-4 top-4 w-6 h-6 text-slate-200" /></div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Gauge className="w-3 h-3" /> Dificultad</Label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {[{ id: 'facil', label: 'Fácil', color: 'bg-emerald-500' }, { id: 'medio', label: 'Medio', color: 'bg-amber-500' }, { id: 'maestro', label: 'Maestro', color: 'bg-rose-600' }].map(l => (
                                                    <button key={l.id} onClick={() => setDificultad(l.id as any)} className={cn("h-12 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all", dificultad === l.id ? `${l.color} text-white shadow-lg` : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200")}>{l.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2"><ListOrdered className="w-4 h-4 text-indigo-500" /> Paso a paso</h3>
                                            <Button variant="ghost" size="sm" onClick={addPaso} className="rounded-xl text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase"><Plus className="w-3.5 h-3.5 mr-1" /> Paso</Button>
                                        </div>
                                        {pasos.length === 0 ? (
                                            <button onClick={addPaso} className="w-full flex flex-col items-center justify-center py-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all gap-3">
                                                <ListOrdered className="w-8 h-8" />
                                                <span className="text-sm font-black">Agrega el primer paso</span>
                                                <span className="text-[11px] text-center max-w-[200px]">Documenta el proceso con fotos para que el producto siempre quede igual.</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                                                {pasos.map((paso, idx) => (
                                                    <PasoEditor key={paso.id} paso={paso} index={idx} total={pasos.length} onUpdate={updatePaso} onRemove={removePaso} onMove={movePaso} onImage={handlePasoImage} />
                                                ))}
                                                <button onClick={addPaso} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all text-[11px] font-black uppercase">
                                                    <Plus className="w-4 h-4" /> Agregar otro paso
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <DialogFooter className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6 gap-4">
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-xl text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" /> Los costos usan el mejor precio de tus proveedores actuales.
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsRecetaOpen(false)} className="rounded-xl px-6">Cancelar</Button>
                                <Button onClick={saveReceta} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 flex items-center gap-2">
                                    <Save className="w-4 h-4" />{editingReceta ? 'Actualizar' : 'Guardar'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ════════════════════════════════════════════════════════════
                MODAL FÓRMULA MAESTRA
            ════════════════════════════════════════════════════════════ */}
            <Dialog open={isFormulacionOpen} onOpenChange={setIsFormulacionOpen}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 border-0 bg-white dark:bg-slate-900">
                    <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <Scale className="w-6 h-6 text-indigo-600" />
                                <DialogTitle className="text-2xl font-bold">{editingFormulacion ? 'Editar Fórmula Maestra' : 'Nueva Fórmula Maestra'}</DialogTitle>
                            </div>
                            <DialogDescription>Define la proporción de ingredientes por arroba (11.5 kg de harina)</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-8">
                            {/* Info básica */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-3 md:col-span-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Nombre de la fórmula</Label>
                                    <Input value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Ej: Masa Pan Francés, Masa Integral, Masa Croissant..." className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Categoría</Label>
                                    <Select value={fCategoria} onValueChange={v => setFCategoria(v as CatFormulacion)}>
                                        <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12"><SelectValue /></SelectTrigger>
                                        <SelectContent>{CATS_FORMULACION.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Descripción (opcional)</Label>
                                <Input value={fDescripcion} onChange={e => setFDescripcion(e.target.value)} placeholder="Descripción breve de esta fórmula..." className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                            </div>

                            {/* Ingredientes de la fórmula */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                        Ingredientes por arroba (11.5 kg)
                                        <Badge className="bg-indigo-600/10 text-indigo-500 border-indigo-500/20 rounded-full h-5 text-[10px]">{fIngredientes.length}</Badge>
                                    </h3>
                                    <Button variant="ghost" size="sm" onClick={addIngFormulacion} className="rounded-xl text-indigo-600 hover:bg-indigo-600/10 font-black text-[10px] uppercase">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                                    </Button>
                                </div>

                                {categoriasDeInsumos.length > 1 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                                        {categoriasDeInsumos.map(cat => (
                                            <button key={cat} onClick={() => setFCategoriasInsumosF(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat])}
                                                className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border transition-all",
                                                    fCategoriasInsumosF.includes(cat) ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400"
                                                )}>
                                                {cat}
                                            </button>
                                        ))}
                                        {fCategoriasInsumosF.length > 0 && <button onClick={() => setFCategoriasInsumosF([])} className="text-[10px] text-rose-500 font-black ml-2">Limpiar</button>}
                                    </div>
                                )}

                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                                    {fIngredientes.map(ing => (
                                        <div key={ing.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                                            <div className="col-span-12 md:col-span-5">
                                                <Select value={ing.productoId} onValueChange={v => updateIngFormulacion(ing.id!, 'productoId', v)}>
                                                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl"><SelectValue placeholder="Ingrediente..." /></SelectTrigger>
                                                    <SelectContent>{ingredientesFiltradosF.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-4 md:col-span-2">
                                                <Input type="number" value={ing.cantidadPorArroba || ''} onChange={e => updateIngFormulacion(ing.id!, 'cantidadPorArroba', Number(e.target.value))} className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200" placeholder="Cant." />
                                            </div>
                                            <div className="col-span-4 md:col-span-2">
                                                <Select value={ing.unidad} onValueChange={v => updateIngFormulacion(ing.id!, 'unidad', v)}>
                                                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{['gr', 'kg', 'ml', 'l', 'und'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-3 md:col-span-2 text-right">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatCurrency(ing.costoTotalArroba || 0)}</span>
                                            </div>
                                            <div className="col-span-1">
                                                <Button onClick={() => removeIngFormulacion(ing.id!)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                    {fIngredientes.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">Agrega los ingredientes para esta fórmula.</div>}
                                </div>

                                {fIngredientes.length > 0 && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl text-center border border-indigo-100 dark:border-indigo-800">
                                            <p className="text-[10px] font-black uppercase text-indigo-500 mb-1">Costo/arroba</p>
                                            <p className="font-black text-indigo-700 dark:text-indigo-300 text-lg">{formatCurrency(totalFormulacion())}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Masa resultante</p>
                                            <p className="font-black text-slate-800 dark:text-white text-lg">{rendimientoMasa().toFixed(2)} kg</p>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl text-center border border-emerald-100 dark:border-emerald-800">
                                            <p className="text-[10px] font-black uppercase text-emerald-500 mb-1">Ingredientes</p>
                                            <p className="font-black text-emerald-700 dark:text-emerald-300 text-lg">{fIngredientes.length} tipos</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Parámetros de cocción opcionales */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Thermometer className="w-3 h-3" /> Temperatura °C</Label>
                                    <Input type="number" placeholder="Ej: 180" value={fTemperatura || ''} onChange={e => setFTemperatura(Number(e.target.value))} className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Timer className="w-3 h-3" /> Horno (min)</Label>
                                    <Input type="number" placeholder="Ej: 15" value={fHorneado || ''} onChange={e => setFHorneado(Number(e.target.value))} className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Reposo (min)</Label>
                                    <Input type="number" placeholder="Ej: 60" value={fFermentacion || ''} onChange={e => setFFermentacion(Number(e.target.value))} className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-10 flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="outline" onClick={() => setIsFormulacionOpen(false)} className="rounded-xl px-6">Cancelar</Button>
                            <Button onClick={saveFormulacion} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 flex items-center gap-2">
                                <Save className="w-4 h-4" />{editingFormulacion ? 'Actualizar Fórmula' : 'Guardar Fórmula'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ════════════════════════════════════════════════════════════
                MODAL MODELO DE PAN
            ════════════════════════════════════════════════════════════ */}
            <Dialog open={isModeloOpen} onOpenChange={setIsModeloOpen}>
                <DialogContent className="max-w-lg rounded-3xl p-0 border-0 bg-white dark:bg-slate-900">
                    <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
                    <div className="p-8">
                        <DialogHeader className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Package className="w-6 h-6 text-amber-600" />
                                <DialogTitle className="text-xl font-bold">{editingModelo ? 'Editar Modelo de Pan' : 'Nuevo Modelo de Pan'}</DialogTitle>
                            </div>
                            <DialogDescription>Define el gramaje y precio de este modelo. Las unidades por arroba se calculan solas.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Nombre del modelo</Label>
                                <Input value={mNombre} onChange={e => setMNombre(e.target.value)} placeholder="Ej: Pan Francés 80gr, Mogolla 50gr, Roscón 120gr..." className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Fórmula de masa que usa</Label>
                                <Select value={mFormulacionId} onValueChange={setMFormulacionId}>
                                    <SelectTrigger className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 h-12"><SelectValue placeholder="Seleccionar fórmula..." /></SelectTrigger>
                                    <SelectContent>{formulaciones.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Peso por unidad (gr)</Label>
                                    <Input type="number" min={1} value={mPeso} onChange={e => setMPeso(Number(e.target.value))} className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Merma estimada (%)</Label>
                                    <Input type="number" min={0} max={30} value={mMerma} onChange={e => setMMerma(Number(e.target.value))} className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" />
                                </div>
                            </div>

                            {/* Cálculo automático */}
                            {mPeso > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl text-center border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase text-indigo-500">Produce/arroba</p>
                                        <p className="font-black text-indigo-700 dark:text-indigo-300 text-xl">{calcPanesPorArroba(mPeso, mMerma)}</p>
                                        <p className="text-[9px] text-indigo-400">unidades</p>
                                    </div>
                                    {mFormulacionId && (() => {
                                        const f = formulaciones.find(x => x.id === mFormulacionId);
                                        const ppa = calcPanesPorArroba(mPeso, mMerma);
                                        const cu = f && ppa > 0 ? f.costoTotalArroba / ppa : 0;
                                        return (
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-slate-100">
                                                <p className="text-[10px] font-black uppercase text-slate-400">Costo unit.</p>
                                                <p className="font-black text-slate-800 dark:text-white text-xl">{formatCurrency(cu)}</p>
                                                <p className="text-[9px] text-slate-400">por unidad</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Precio de venta (cop)</Label>
                                    <Input type="number" min={0} value={mPrecioVenta} onChange={e => setMPrecioVenta(Number(e.target.value))} className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Piezas por lata (opcional)</Label>
                                    <Input type="number" min={1} value={mPiezasLata || ''} onChange={e => setMPiezasLata(e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej: 12" className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-black text-lg" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-8 flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="outline" onClick={() => setIsModeloOpen(false)} className="rounded-xl px-6">Cancelar</Button>
                            <Button onClick={saveModelo} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-8 flex items-center gap-2">
                                <Save className="w-4 h-4" />{editingModelo ? 'Actualizar' : 'Guardar Modelo'}
                            </Button>
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
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{index + 1}</div>
            <div className="flex-1 space-y-2.5 min-w-0">
                <Input value={paso.titulo || ''} onChange={e => onUpdate(paso.id, 'titulo', e.target.value)} placeholder={`Título del paso ${index + 1} (opcional)`} className="h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 text-sm font-bold" />
                <textarea value={paso.descripcion} onChange={e => onUpdate(paso.id, 'descripcion', e.target.value)} placeholder="Describe qué hay que hacer..." rows={2} className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:outline-none placeholder:text-slate-400 resize-none" />
                {paso.imagenBase64 ? (
                    <div className="relative group/img">
                        <img src={paso.imagenBase64} alt={`Paso ${index + 1}`} className="w-full h-36 object-cover rounded-xl border border-slate-200" />
                        <button onClick={() => onUpdate(paso.id, 'imagenBase64', undefined)} className="absolute top-2 right-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity" title="Quitar imagen"><X className="w-3.5 h-3.5" /></button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-indigo-500 transition-colors px-1"><Camera className="w-3.5 h-3.5" /> Añadir foto</button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onImage(paso.id, e)} />
                    </>
                )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => onMove(index, -1)} disabled={index === 0} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => onRemove(paso.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all mt-1" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
}

export default Recetas;
