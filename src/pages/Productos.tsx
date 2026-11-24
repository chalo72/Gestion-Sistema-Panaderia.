import React, { useState, useMemo, useEffect } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
    Package, Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp,
    DollarSign, Info, Store, ChefHat, Building2, ShoppingCart, Warehouse, Database, AlertTriangle, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { esCategoriaDeReceta, categoriaVigente, normalizarNombreCat, SIN_CATEGORIA_TXT } from '@/lib/limpiar-categorias';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
import { AvatarConfigurator } from '@/components/ui/AvatarConfigurator';
import type { Producto, Proveedor, PrecioProveedor, Categoria, InventarioItem, ModeloPan, FormulacionBase } from '@/types';
import { OrdenarPanesModal } from '@/components/productos/OrdenarPanesModal';
import { planOrdenPanes } from '@/lib/clasificar-panes';
import { ProductHeader } from '@/components/productos/ProductHeader';
import { ProductCard } from '@/components/productos/ProductCard';
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import { ProductCategoryManager } from '@/components/productos/ProductCategoryManager';
import { ProductPriceItem } from '@/components/productos/ProductPriceItem';
import { IceCreamAssistantModal } from '@/components/productos/IceCreamAssistantModal';
import { BeverageAssistantModal } from '@/components/productos/BeverageAssistantModal';
import { ListaPreciosModal } from '@/components/productos/ListaPreciosModal';
import { db } from '@/lib/database';
import { empaqueDesdeFormulario, precioProveedorDesdeEmpaque, camposEmpaqueParaEditar, numeroFormulario } from '@/lib/empaque-producto';
import { revisarPrecio, indiceRepetidos, type ProblemaPrecio } from '@/lib/precio-inconsistente';
import { AvisoPrecio } from '@/components/precios/AvisoPrecio';
import { buscarDuplicados, ordenarPorNombreYTamano, type GrupoDuplicado } from '@/lib/productos-duplicados';
import { tipoDeDuplicado } from '@/lib/duplicado-por-proveedor';

interface ProductosProps {
    productos: Producto[];
    proveedores: Proveedor[];
    precios: PrecioProveedor[];
    categorias: Categoria[];
    inventario: InventarioItem[];
    onAddProducto: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'> & { stockActual?: number, stockMinimo?: number }) => Promise<Producto>;
    onUpdateProducto: (id: string, updates: Partial<Producto> & { stockActual?: number, stockMinimo?: number }) => void;
    onDeleteProducto: (id: string) => void;
    onAddCategoria: (nombre: string, color: string, tipo: 'venta' | 'insumo') => Promise<Categoria>;
    onDeleteCategoria: (id: string) => void;
    onUpdateCategoria: (id: string, nombre: string, color: string, tipo?: 'venta' | 'insumo') => void;
    onAddOrUpdatePrecio: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string }) => void;
    onDeletePrecio: (id: string) => void;
    getMejorPrecio: (productoId: string) => PrecioProveedor | null;
    getPreciosByProducto: (productoId: string) => PrecioProveedor[];
    getProveedorById: (id: string) => Proveedor | undefined;
    formatCurrency: (value: number) => string;
    /** Modelos de pan (Recetas / Libreta de horno): ayudan a sugerir Pan de sal vs Pan de dulce */
    modelosPan?: ModeloPan[];
    formulaciones?: FormulacionBase[];
    onUpdateModeloPan?: (id: string, updates: Partial<ModeloPan>) => void | Promise<void>;
    sesionesCaja?: any[];
    gastos?: any[];
}

const COLORES_PRESET = [
    '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#6b7280',
    '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#1e293b',
];

export default function Productos({
    productos, proveedores, precios: _precios, categorias: categoriasProp, inventario,
    onAddProducto, onUpdateProducto, onDeleteProducto,
    onAddCategoria, onDeleteCategoria, onUpdateCategoria, onAddOrUpdatePrecio, onDeletePrecio,
    getMejorPrecio, getPreciosByProducto, getProveedorById, formatCurrency, modelosPan = [], formulaciones = [], onUpdateModeloPan,
    sesionesCaja = [], gastos = [],
}: ProductosProps) {
    // 2026-11-23: recetas de pan que se colaron como categoría (traen fórmula) no se muestran; orden alfabético.
    const categorias = useMemo(() => (categoriasProp || [])
        .filter(c => !esCategoriaDeReceta(c))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })), [categoriasProp]);
    const cuentaPorCategoria = useMemo(() => {
        const m = new Map<string, number>();
        for (const p of productos) { const c = categoriaVigente(p.categoria, categorias); m.set(c, (m.get(c) || 0) + 1); }
        return m;
    }, [productos, categorias]);
    const [isOrdenarPanesOpen, setIsOrdenarPanesOpen] = useState(false);
    // Historial de cambios de costo del producto que se está editando (2026-11-23)
    const [historialEditado, setHistorialEditado] = useState<{ proveedor: string; antes: number; despues: number; fecha: string }[]>([]);
    const [isListaPreciosOpen, setIsListaPreciosOpen] = useState(false); // 2026-11-21: subir/bajar precios e imprimir
    const panesPorOrdenar = useMemo(
        () => planOrdenPanes(productos, modelosPan, formulaciones).pendientes,
        [productos, modelosPan, formulaciones]
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'elaborado' | 'ingrediente'>('todos');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
    const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
    useEffect(() => {
        if (!editingProducto?.id) { setHistorialEditado([]); return; }
        let vivo = true;
        db.getAllHistorial().then((todos: any[]) => {
            if (!vivo) return;
            setHistorialEditado((todos || [])
                .filter(h => h?.productoId === editingProducto.id)
                .sort((a, b) => String(b.fechaCambio || '').localeCompare(String(a.fechaCambio || '')))
                .slice(0, 12)
                .map(h => ({
                    proveedor: getProveedorById(h.proveedorId)?.nombre || 'Proveedor borrado',
                    antes: Number(h.precioAnterior) || 0,
                    despues: Number(h.precioNuevo) || 0,
                    fecha: h.fechaCambio,
                })));
        }).catch(() => { if (vivo) setHistorialEditado([]); });
        return () => { vivo = false; };
    }, [editingProducto?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const [expandedProducto, setExpandedProducto] = useState<string | null>(null);
    const [vistaActual, setVistaActual] = useState<'lista' | 'cuadricula'>('lista');
    const [isIceCreamAssistantOpen, setIsIceCreamAssistantOpen] = useState(false);
    const [isBeverageAssistantOpen, setIsBeverageAssistantOpen] = useState(false);
    const [isAvatarConfiguratorOpen, setIsAvatarConfiguratorOpen] = useState(false);
    const { check } = useCan();
    const canVerCosto = check('VER_PRECIO_COSTO');
    const canVerMargen = check('VER_MARGEN');
    const canVerPVP = check('VER_PRECIO_VENTA');
    const [addingPrecioForProducto, setAddingPrecioForProducto] = useState<string | null>(null);
    const [selectedProveedorId, setSelectedProveedorId] = useState('');
    const [precioCosto, setPrecioCosto] = useState('');
    const [notasPrecio, setNotasPrecio] = useState('');
    const [formData, setFormData] = useState({
        nombre: '', categoria: '', descripcion: '', precioVenta: '',
        margenUtilidad: '30', proveedorId: '', precioCosto: '', notasPrecio: '', imagen: '', tipo: 'elaborado' as 'elaborado' | 'ingrediente', unidadMedida: '',
        // [Nexus-Volt] Heladería Smart Fields
        useHeladeriaCalc: false, costoCaja: '', unidadesPorCaja: '', costoInsumoExtra: '',
        // [Nexus-Volt] Stock Fields
        stockActual: '', stockMinimo: '5', descuentoMayorista: '',
        // Compra por paquete (paca x24 → costo por unidad)
        tipoEmbalaje: 'unidad', unidadesPaquete: '1', precioPaquete: '', precioVentaPaquete: ''
    });
    const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', color: COLORES_PRESET[0], tipo: 'venta' as 'venta' | 'insumo' });

    // [Nexus-Volt] Note: categorasUnicas removed - using categories from props directly

    // Precios de venta para revisar (2026-11-23): mismo costo unitario que muestra la tabla
    const [soloRevisarPrecio, setSoloRevisarPrecio] = useState(false);
    const problemasPrecio = useMemo(() => {
        const repetidos = indiceRepetidos(productos);
        const m = new Map<string, ProblemaPrecio[]>();
        for (const p of productos) {
            const mp = getMejorPrecio(p.id);
            const costo = Number(p.costoBase || (mp ? mp.precioCosto / (mp.cantidadEmbalaje || 1) : 0));
            const ps = revisarPrecio(p, { costoUnitario: costo, repetidos });
            if (ps.length) m.set(p.id, ps);
        }
        return m;
    }, [productos, getMejorPrecio]);

    // Posibles duplicados y orden por tamaño (2026-11-23): solo marca, nunca une ni borra
    const gruposDuplicados = useMemo(() => buscarDuplicados(productos), [productos]);
    const grupoDe = useMemo(() => {
        const m = new Map<string, GrupoDuplicado<Producto>>();
        for (const g of gruposDuplicados) for (const p of g.productos) m.set(p.id, g);
        return m;
    }, [gruposDuplicados]);
    const [verDuplicados, setVerDuplicados] = useState(false);
    const [grupoVisto, setGrupoVisto] = useState<GrupoDuplicado<Producto> | null>(null);
    const [ordenLista, setOrdenLista] = useState<'nombre' | 'tamano'>('nombre');
    const verGrupo = (g: GrupoDuplicado<Producto>) => {
        setGrupoVisto(g); setVerDuplicados(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredProductos = useMemo(() => {
        // Viendo un grupo de posibles duplicados: solo esos productos, del más pequeño al más grande
        if (grupoVisto) {
            const ids = new Set(grupoVisto.productos.map(p => p.id));
            return ordenarPorNombreYTamano(productos.filter(p => ids.has(p.id)));
        }
        const ordenTamano = ordenLista === 'tamano'
            ? new Map(ordenarPorNombreYTamano(productos).map((p, i) => [p.id, i] as const))
            : null;
        return productos.filter(p => {
            const q = searchTerm.toLowerCase().trim();
            
            // Buscar proveedores asociados a este producto
            const pPrecios = _precios.filter(pr => pr.productoId === p.id);
            const pProveedoresStr = pPrecios.map(pr => {
                const prov = getProveedorById(pr.proveedorId);
                return prov ? prov.nombre.toLowerCase() : '';
            }).join(' ');

            // 🔍 Búsqueda inclusiva: nombre, categoría o proveedor
            const matchSearch = !q
                || p.nombre.toLowerCase().includes(q)
                || (p.categoria && p.categoria.toLowerCase().includes(q))
                || pProveedoresStr.includes(q);
                
            const matchCat = filtroCategoria === 'Todos' || categoriaVigente(p.categoria, categorias) === filtroCategoria;
            const matchTipo = filtroTipo === 'todos' || (p.tipo || 'elaborado') === filtroTipo;
            const matchRevisar = !soloRevisarPrecio || problemasPrecio.has(p.id);
            return matchSearch && matchCat && matchTipo && matchRevisar;
        }).sort((a, b) => {
            const tipoA = a.tipo === 'ingrediente' ? 'ingrediente' : 'elaborado';
            const tipoB = b.tipo === 'ingrediente' ? 'ingrediente' : 'elaborado';
            if (tipoA !== tipoB) return tipoA.localeCompare(tipoB);
            if (ordenTamano) return (ordenTamano.get(a.id) ?? 0) - (ordenTamano.get(b.id) ?? 0);
            return (a.nombre || '').localeCompare(b.nombre || '');
        });
    }, [productos, _precios, searchTerm, filtroCategoria, filtroTipo, getProveedorById, soloRevisarPrecio, problemasPrecio, grupoVisto, ordenLista, categorias]);

    // Filtros activos: siempre se pueden quitar y volver a ver todo (2026-11-23)
    const hayFiltros = soloRevisarPrecio || !!grupoVisto || filtroCategoria !== 'Todos' || filtroTipo !== 'todos' || !!searchTerm.trim();
    const verTodo = () => { setSoloRevisarPrecio(false); setGrupoVisto(null); setVerDuplicados(false); setFiltroCategoria('Todos'); setFiltroTipo('todos'); setSearchTerm(''); };
    const elegirCategoria = (v: string) => { setFiltroCategoria(v); setGrupoVisto(null); };

    const countVenta = productos.filter(p => p.tipo !== 'ingrediente').length;
    const countInsumo = productos.filter(p => p.tipo === 'ingrediente').length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre || !formData.categoria) { toast.error('Nombre y categoría son obligatorios'); return; }
        const parseSafe = (val: any) => parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
        let precioVenta = parseSafe(formData.precioVenta);
        const margen = parseSafe(formData.margenUtilidad) || 30;
        // Compra por paquete: el costo del producto es el de UNA unidad; al proveedor va la paca (2026-11-18)
        const empaque = empaqueDesdeFormulario(formData);
        const costo = empaque.porPaquete ? empaque.costoUnidad : parseSafe(formData.precioCosto);
        const precioProv = precioProveedorDesdeEmpaque({ ...empaque, costoUnidad: costo });
        if (costo > 0 && precioVenta === 0) precioVenta = Math.round(costo * (1 + margen / 100) / 100) * 100;
        // Redondear siempre al múltiplo de 100 más cercano (moneda COP)
        if (precioVenta > 0) precioVenta = Math.round(precioVenta / 100) * 100;
        
        const stockActualNum = formData.stockActual === '' ? 0 : parseInt(formData.stockActual) || 0;
        const stockMinimoNum = parseInt(formData.stockMinimo) || 5;

        const data: any = { 
            nombre: formData.nombre, 
            categoria: formData.categoria, 
            descripcion: formData.descripcion, 
            precioVenta, 
            margenUtilidad: margen, 
            imagen: formData.imagen, 
            tipo: formData.tipo || 'elaborado', 
            unidadMedida: formData.unidadMedida || 'unidad', 
            costoBase: costo,
            unidadesPaquete: empaque.unidades,
            precioVentaPaquete: empaqueDesdeFormulario(formData).porPaquete && numeroFormulario(formData.precioVentaPaquete) > 0 ? numeroFormulario(formData.precioVentaPaquete) : null,
            stockActual: stockActualNum,
            stockMinimo: stockMinimoNum,
            descuentoMayorista: formData.descuentoMayorista === '' ? undefined : parseFloat(String(formData.descuentoMayorista).replace(',', '.')) || 0
        };

        if (isSaving) return; // Bloquear doble clic
        setIsSaving(true);
        try {
            if (editingProducto) {
                await onUpdateProducto(editingProducto.id, data);
                if (formData.proveedorId && precioProv.precioCosto > 0) await onAddOrUpdatePrecio({ productoId: editingProducto.id, proveedorId: formData.proveedorId, ...precioProv, notas: formData.notasPrecio });
                toast.success('✅ Producto actualizado correctamente');
            } else {
                const np = await onAddProducto(data);
                if (formData.proveedorId && precioProv.precioCosto > 0) await onAddOrUpdatePrecio({ productoId: np.id, proveedorId: formData.proveedorId, ...precioProv, notas: formData.notasPrecio });
                toast.success('✅ Producto creado correctamente');
            }
            setIsDialogOpen(false); resetForm();
        } catch (err: any) { 
            console.error('[Productos] Error al guardar:', err);
            toast.error('Error al guardar: ' + (err?.message || 'intenta de nuevo')); 
        } finally {
            setIsSaving(false);
        }
    };

    const handleHandleAddCategoria = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevaCategoria.nombre) { toast.error('Nombre obligatorio'); return; }
        onAddCategoria(nuevaCategoria.nombre, nuevaCategoria.color, nuevaCategoria.tipo);
        toast.success('Categoría agregada');
        setNuevaCategoria({ nombre: '', color: COLORES_PRESET[0], tipo: 'venta' });
        setIsCategoriaDialogOpen(false);
    };

    const resetForm = () => {
        setFormData({
            nombre: '', categoria: '', descripcion: '', precioVenta: '', margenUtilidad: '30',
            proveedorId: '', precioCosto: '', notasPrecio: '', imagen: '', tipo: 'elaborado', unidadMedida: '',
            useHeladeriaCalc: false, costoCaja: '', unidadesPorCaja: '', costoInsumoExtra: '',
            stockActual: '', stockMinimo: '5', descuentoMayorista: '',
            tipoEmbalaje: 'unidad', unidadesPaquete: '1', precioPaquete: '', precioVentaPaquete: ''
        });
        setEditingProducto(null);
    };

    const handleEdit = (producto: Producto) => {
        try {
            setEditingProducto(producto);
            // Obtener el precio configurado. Preferimos el último precio actualizado si hay varios, para reflejar ediciones recientes.
            const preciosDelProd = _precios.filter(p => p.productoId === producto.id);
            const mp = preciosDelProd.length > 0 ? preciosDelProd.sort((a, b) => new Date(b.fechaActualizacion || 0).getTime() - new Date(a.fechaActualizacion || 0).getTime())[0] : null;
            
            const itemInv = inventario.find(i => i.productoId === producto.id);

            // Normalizar categoría: buscar coincidencia exacta primero, luego insensible a mayúsculas
            const catGuardada = producto.categoria || '';
            const catMatch = categorias.find(c => c.nombre === catGuardada)
                || categorias.find(c => c.nombre.toLowerCase().trim() === catGuardada.toLowerCase().trim());
            const categoriaFinal = catMatch ? catMatch.nombre : catGuardada;
            
            setFormData({
                nombre: producto.nombre,
                categoria: categoriaFinal,
                descripcion: producto.descripcion || '',
                precioVenta: producto.precioVenta.toString(),
                margenUtilidad: producto.margenUtilidad.toString(),
                imagen: producto.imagen || '',
                proveedorId: mp?.proveedorId || '',
                // Si el proveedor lo vende por paca, se muestra la paca aparte y el costo por unidad
                // (antes la paca de $12.300 quedaba como costo de UNA unidad).
                ...camposEmpaqueParaEditar(mp, producto),
                precioVentaPaquete: producto.precioVentaPaquete ? String(producto.precioVentaPaquete) : '',
                notasPrecio: mp?.notas || '',
                tipo: producto.tipo || 'elaborado',
                unidadMedida: (producto as any).unidadMedida || '',
                useHeladeriaCalc: false, costoCaja: '', unidadesPorCaja: '', costoInsumoExtra: '',
                stockActual: itemInv?.stockActual?.toString() || '0',
                stockMinimo: itemInv?.stockMinimo?.toString() || '5',
                descuentoMayorista: producto.descuentoMayorista?.toString() || ''
            });
            setIsDialogOpen(true);
        } catch (error: any) {
            console.error(error);
            toast.error('Error al editar: ' + error.message);
        }
    };

    const handleAddInsumo = () => {
        resetForm();
        setFormData(prev => ({ ...prev, tipo: 'ingrediente' as any }));
        setIsDialogOpen(true);
    };

    // 2026-11-23: confirm() del navegador no sale en el celular (PWA) y el botón no hacía nada.
    // Ahora la confirmación es dentro de la app.
    const [porEliminar, setPorEliminar] = useState<Producto | null>(null);
    const handleDelete = (id: string) => {
        const p = productos.find(x => x.id === id);
        if (p) setPorEliminar(p);
    };
    const confirmarEliminar = async () => {
        if (!porEliminar) return;
        const nombre = porEliminar.nombre;
        try {
            await onDeleteProducto(porEliminar.id);
            toast.success(`«${nombre}» eliminado`);
            if (editingProducto?.id === porEliminar.id) { setIsDialogOpen(false); setEditingProducto(null); }
        } catch {
            toast.error('No se pudo eliminar. Intenta de nuevo.');
        }
        setPorEliminar(null);
    };

    const handleAgregarPrecio = (productoId: string) => {
        if (!selectedProveedorId || !precioCosto) { toast.error('Completa los campos'); return; }
        onAddOrUpdatePrecio({ productoId, proveedorId: selectedProveedorId, precioCosto: parseFloat(precioCosto), notas: notasPrecio });
        toast.success('Proveedor registrado');
        setAddingPrecioForProducto(null); setSelectedProveedorId(''); setPrecioCosto(''); setNotasPrecio('');
    };

    const getCategoriaColor = (n: string) => categorias.find(c => c.nombre === n)?.color || '#3b82f6';
    const getProveedoresSinPrecio = (pid: string) => {
        const ids = getPreciosByProducto(pid).map(p => p.proveedorId);
        return proveedores.filter(p => !ids.includes(p.id));
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-12">
            <ProductHeader vistaActual={vistaActual} setVistaActual={setVistaActual}
                onManageCategories={() => setIsCategoriaDialogOpen(true)}
                onAddProduct={() => { resetForm(); setIsDialogOpen(true); }}
                onAddInsumo={handleAddInsumo}
                onOpenIceCreamAssistant={() => setIsIceCreamAssistantOpen(true)}
                onOpenBeverageAssistant={() => setIsBeverageAssistantOpen(true)}
                checkPermission={(p: any) => check(p)} />

            {/* Panes sin ordenar: separar en Pan de sal / Pan de dulce / Croissant… */}
            {panesPorOrdenar > 0 && (
                <button
                    type="button"
                    onClick={() => setIsOrdenarPanesOpen(true)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-50 transition-all text-left"
                >
                    <span className="text-2xl">🥖</span>
                    <div>
                        <p className="text-sm font-black text-amber-800">Ordenar los panes por categoría</p>
                        <p className="text-xs text-amber-600 mt-0.5">{panesPorOrdenar} pan{panesPorOrdenar === 1 ? '' : 'es'} de tus Modelos de pan (Recetas) sin su categoría en el catálogo. Sepáralos en Pan de sal, Pan de dulce, Croissant…</p>
                    </div>
                    <span className="ml-auto text-xs font-black text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl">Ordenar →</span>
                </button>
            )}

            {/* Lista de precios: subir o bajar por %, imprimir para las vendedoras (2026-11-21) */}
            {check('EDITAR_PRECIOS') && (
                <button
                    type="button"
                    onClick={() => setIsListaPreciosOpen(true)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left"
                >
                    <span className="text-2xl">🏷️</span>
                    <div>
                        <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">Lista de precios</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Subir o bajar precios por categoría, cambiarlos a mano e imprimir la lista para las vendedoras</p>
                    </div>
                    <span className="ml-auto text-xs font-black text-emerald-800 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-200 px-3 py-1.5 rounded-xl">Abrir →</span>
                </button>
            )}

            {/* Botón acceso al Configurador de Avatares */}
            <button
                onClick={() => setIsAvatarConfiguratorOpen(true)}
                className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
            >
                <span className="text-2xl group-hover:scale-110 transition-transform">🎨</span>
                <div className="text-left">
                    <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">Personalizar avatares de productos</p>
                    <p className="text-xs text-indigo-400 mt-0.5">Elige entre 3 diseños (Bokeh · Cristal · Noche) o agrega una imagen desde URL</p>
                </div>
                <span className="ml-auto text-xs font-black text-indigo-500 bg-indigo-100 dark:bg-indigo-900 px-3 py-1.5 rounded-xl">Abrir catálogo →</span>
            </button>

            {/* KPI Cards Ultra Compactas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-slate-50 dark:bg-slate-700"><Package className="w-3.5 h-3.5 text-slate-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Total</p>
                        <h3 className="text-lg font-black leading-none">{productos.length}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-orange-500 transition-colors flex items-center gap-3"
                    onClick={() => setFiltroTipo(filtroTipo === 'elaborado' ? 'todos' : 'elaborado')}>
                    <div className="p-1.5 rounded-md bg-orange-50 dark:bg-orange-900/20"><ShoppingCart className="w-3.5 h-3.5 text-orange-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Para Venta</p>
                        <h3 className="text-lg font-black text-orange-600 leading-none">{countVenta}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-blue-500 transition-colors flex items-center gap-3"
                    onClick={() => setFiltroTipo(filtroTipo === 'ingrediente' ? 'todos' : 'ingrediente')}>
                    <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20"><Warehouse className="w-3.5 h-3.5 text-blue-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Insumos</p>
                        <h3 className="text-lg font-black text-blue-600 leading-none">{countInsumo}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm relative flex items-center gap-3">
                    {productos.filter(p => !getMejorPrecio(p.id)).length > 0 && (
                        <div className="absolute top-1 right-1"><span className="flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative rounded-full h-1.5 w-1.5 bg-red-500" /></span></div>
                    )}
                    <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20"><DollarSign className="w-3.5 h-3.5 text-amber-500" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Sin Precio</p>
                        <h3 className="text-lg font-black text-amber-600 leading-none">{productos.filter(p => !getMejorPrecio(p.id)).length}</h3>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
            {/* Precios de venta para revisar (2026-11-23) */}
            {problemasPrecio.size > 0 && (
                <button type="button" onClick={() => setSoloRevisarPrecio(v => !v)} aria-pressed={soloRevisarPrecio}
                    className={cn('w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-4 rounded-xl border-2 text-sm font-black transition-colors',
                        soloRevisarPrecio
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/40 dark:text-rose-200')}>
                    <AlertTriangle className="w-4 h-4" />
                    {soloRevisarPrecio ? `Viendo ${problemasPrecio.size} precios para revisar · Ver todos` : `Precios para revisar (${problemasPrecio.size})`}
                </button>
            )}
            {/* Posibles duplicados (2026-11-23) */}
            {gruposDuplicados.length > 0 && (
                <button type="button" onClick={() => setVerDuplicados(v => !v)} aria-expanded={verDuplicados}
                    className={cn('w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-4 rounded-xl border-2 text-sm font-black transition-colors',
                        verDuplicados
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-500/10 dark:border-violet-500/40 dark:text-violet-200')}>
                    <Copy className="w-4 h-4" /> Posibles duplicados ({gruposDuplicados.length})
                </button>
            )}
            {/* Orden de la lista: por nombre o por tamaño (250, 400, 1.5 l…) */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-full sm:w-auto" role="group" aria-label="Ordenar la lista">
                <span className="px-2 text-xs font-bold text-slate-600 dark:text-slate-300">Ordenar:</span>
                {([['nombre', 'Nombre (A-Z)'], ['tamano', 'Tamaño (menor a mayor)']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setOrdenLista(v)} aria-pressed={ordenLista === v}
                        className={cn('h-9 px-3 rounded-lg text-sm font-bold flex-1 sm:flex-none', ordenLista === v ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300')}>{t}</button>
                ))}
            </div>
            </div>

            {/* Grupo de posibles duplicados que se está viendo */}
            {grupoVisto && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-2">
                    <Copy className="w-4 h-4 text-violet-700 dark:text-violet-300" />
                    <span className="text-sm font-bold text-violet-900 dark:text-violet-100">Viendo posible duplicado: {grupoVisto.texto}</span>
                    <button type="button" onClick={() => setGrupoVisto(null)} className="ml-auto text-sm font-black underline text-violet-800 dark:text-violet-200">Ver todos</button>
                </div>
            )}

            {/* Lista de grupos de posibles duplicados */}
            {verDuplicados && (
                <div className="rounded-2xl border border-violet-200 dark:border-violet-500/40 bg-white dark:bg-slate-900 p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                        Productos con nombre parecido. <b>Mira el proveedor antes de borrar:</b> si son de proveedores distintos, cada uno tiene su precio y <b>no se borra</b>. Nada se une ni se borra solo.
                    </p>
                    {gruposDuplicados.map(g => {
                        // De qué proveedor es cada uno (2026-11-23)
                        const provsDe = (id: string) => getPreciosByProducto(id).map(pr => ({
                            nombre: getProveedorById(pr.proveedorId)?.nombre || 'Proveedor borrado',
                            texto: (pr.cantidadEmbalaje || 1) > 1
                                ? `${pr.tipoEmbalaje && pr.tipoEmbalaje !== 'unidad' ? pr.tipoEmbalaje : 'paca'} x${pr.cantidadEmbalaje} a ${formatCurrency(pr.precioCosto)}`
                                : `unidad a ${formatCurrency(pr.precioCosto)}`,
                        }));
                        const tipo = tipoDeDuplicado(g.productos.map(p => provsDe(p.id).map(x => x.nombre)));
                        const aviso = tipo === 'mismo-proveedor'
                            ? { t: '🔴 Mismo proveedor: es copia, deja uno solo', c: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100' }
                            : tipo === 'sin-proveedor'
                                ? { t: '🟡 Uno no tiene proveedor: ese suele ser la copia', c: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100' }
                                : { t: '🔵 Proveedores distintos: NO borrar, cada uno tiene su precio', c: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100' };
                        return (
                        <div key={g.clave + g.productos[0].id} className={cn('rounded-xl border-2 p-3', aviso.c)}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                    <p className="text-sm font-black">{aviso.t}</p>
                                    <p className="text-xs opacity-90">{g.texto}</p>
                                </div>
                                <button type="button" onClick={() => verGrupo(g)} className="shrink-0 h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-black">Ver</button>
                            </div>
                            <ul className="space-y-1.5">
                                {g.productos.map(p => {
                                    const provs = provsDe(p.id);
                                    return (
                                    <li key={p.id} className="rounded-lg bg-white/80 dark:bg-slate-900/60 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold truncate">{p.nombre}</span>
                                            <span className="shrink-0 tabular-nums font-bold">
                                                {p.tipo === 'ingrediente' ? 'Insumo · ' : ''}{Number(p.precioVenta) > 0 ? formatCurrency(Number(p.precioVenta)) : 'sin precio'}
                                            </span>
                                        </div>
                                        {provs.length > 0
                                            ? provs.map((x, i) => <p key={i} className="text-xs text-slate-700 dark:text-slate-300">🏪 <b>{x.nombre}</b> · {x.texto}</p>)
                                            : <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Sin proveedor</p>}
                                    </li>
                                    );
                                })}
                            </ul>
                        </div>
                        );
                    })}
                </div>
            )}

            {/* Filtro activo de tipo */}
            {filtroTipo !== 'todos' && (
                <div className="flex items-center gap-2">
                    <span className={cn("px-3 py-1.5 rounded-full text-sm font-bold", filtroTipo === 'elaborado' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}>
                        Filtro: {filtroTipo === 'elaborado' ? '🛒 Para Venta' : '📦 Insumos'}
                    </span>
                    <button onClick={() => setFiltroTipo('todos')} className="text-sm text-slate-400 hover:text-slate-600 underline">Limpiar</button>
                </div>
            )}

            {/* Búsqueda + Dropdown Categoría */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input placeholder="Buscar producto por nombre o categoría..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setGrupoVisto(null); }}
                        className="w-full pl-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-12 text-base" />
                </div>
                <Select value={filtroCategoria} onValueChange={elegirCategoria}>
                    <SelectTrigger className="w-full md:w-64 h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-80">
                        <SelectItem value="Todos" className="text-base py-2.5 font-semibold">Todas las categorías ({productos.length})</SelectItem>
                        {([['venta', '🛒 Para venta'], ['insumo', '📦 Insumos']] as const).map(([tipo, titulo]) => {
                            const lista = categorias.filter(c => (c.tipo === 'insumo' || normalizarNombreCat(c.nombre).startsWith('ins')) === (tipo === 'insumo'));
                            if (lista.length === 0) return null;
                            return (
                                <SelectGroup key={tipo}>
                                    <SelectLabel className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{titulo}</SelectLabel>
                                    {lista.map(cat => (
                                        <SelectItem key={cat.id} value={cat.nombre} className="text-base py-2.5">
                                            <div className="flex items-center gap-2 w-full">
                                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                                <span className="truncate">{cat.nombre}</span>
                                                <span className="text-xs text-slate-600 dark:text-slate-300 ml-auto tabular-nums">({cuentaPorCategoria.get(cat.nombre) || 0})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            );
                        })}
                        {(cuentaPorCategoria.get(SIN_CATEGORIA_TXT) || 0) > 0 && (
                            <SelectItem value={SIN_CATEGORIA_TXT} className="text-base py-2.5 italic">
                                {SIN_CATEGORIA_TXT} ({cuentaPorCategoria.get(SIN_CATEGORIA_TXT)})
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>

            {/* Filtros activos: se ven y se quitan con un toque (2026-11-23) */}
            {hayFiltros && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Mostrando {filteredProductos.length} de {productos.length}:</span>
                    {soloRevisarPrecio && <button type="button" onClick={() => setSoloRevisarPrecio(false)} className="h-8 px-3 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100 text-sm font-bold">Precios para revisar ✕</button>}
                    {grupoVisto && <button type="button" onClick={() => setGrupoVisto(null)} className="h-8 px-3 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100 text-sm font-bold">Posible duplicado ✕</button>}
                    {filtroCategoria !== 'Todos' && !grupoVisto && <button type="button" onClick={() => setFiltroCategoria('Todos')} className="h-8 px-3 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100 text-sm font-bold">{filtroCategoria} ✕</button>}
                    {filtroTipo !== 'todos' && <button type="button" onClick={() => setFiltroTipo('todos')} className="h-8 px-3 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-100 text-sm font-bold">{filtroTipo === 'elaborado' ? 'Para venta' : 'Insumos'} ✕</button>}
                    {searchTerm.trim() && !grupoVisto && <button type="button" onClick={() => setSearchTerm('')} className="h-8 px-3 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 text-sm font-bold">«{searchTerm.trim()}» ✕</button>}
                    <button type="button" onClick={verTodo} className="ml-auto h-9 px-4 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-black">Ver todos los productos</button>
                </div>
            )}

            {/* Contenido */}
            <div className="pb-10">
                {filteredProductos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-6 rounded-full bg-slate-100 mb-4"><Package className="w-12 h-12 text-slate-300" /></div>
                        <h3 className="text-xl font-bold text-slate-400">Sin productos</h3>
                        {hayFiltros
                            ? <button type="button" onClick={verTodo} className="mt-3 h-11 px-5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-base font-black">Quitar filtros y ver todos</button>
                            : <p className="text-base text-slate-400 mt-1 mb-6">Agrega tu primer producto para comenzar.</p>}

                    </div>
                ) : vistaActual === 'cuadricula' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-6">
                        {filteredProductos.map(producto => {
                            const mp = getMejorPrecio(producto.id);
                            // Costo unitario: preferir costoBase del producto; si no, calcular desde proveedor
                            const cb = Number(producto.costoBase || (mp ? mp.precioCosto / (mp.cantidadEmbalaje || 1) : 0));
                            const pv = Number(producto.precioVenta || 0);
                            const ut = pv > 0 ? ((pv - cb) / pv) * 100 : 0;
                            return <ProductCard key={producto.id} producto={producto} mejorPrecio={mp} utilidad={ut}
                                categoriaColor={getCategoriaColor(producto.categoria)} formatCurrency={formatCurrency}
                                onEdit={handleEdit} onDelete={handleDelete}
                                onExpand={id => setExpandedProducto(expandedProducto === id ? null : id)} checkPermission={(p: any) => check(p)}
                                problemasPrecio={problemasPrecio.get(producto.id)} />;
                        })}
                    </div>
                ) : (
                    /* TABLA VISTA LISTA — TEXTO GRANDE */
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-sm font-bold uppercase tracking-wider">
                                    <th className="px-5 py-4">Producto</th>
                                    <th className="px-5 py-4">Tipo</th>
                                    <th className="px-5 py-4">Categoría</th>
                                    {canVerCosto && <th className="px-5 py-4">Costo</th>}
                                    {canVerPVP && <th className="px-5 py-4">Precio Venta</th>}
                                    {canVerMargen && <th className="px-5 py-4">Margen</th>}
                                    <th className="px-5 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredProductos.map(producto => {
                                    const mp = getMejorPrecio(producto.id);
                                    // Costo unitario: preferir costoBase del producto; si no, calcular desde proveedor
                                    const cb = Number(producto.costoBase || (mp ? mp.precioCosto / (mp.cantidadEmbalaje || 1) : 0));
                                    const pv = Number(producto.precioVenta || 0);
                                    const ut = pv > 0 ? ((pv - cb) / pv) * 100 : 0;
                                    const cc = getCategoriaColor(producto.categoria);
                                    const isExp = expandedProducto === producto.id;
                                    const pp = getPreciosByProducto(producto.id);
                                    const isAP = addingPrecioForProducto === producto.id;
                                    const pd = getProveedoresSinPrecio(producto.id);
                                    const esInsumo = producto.tipo === 'ingrediente';

                                    return (
                                        <React.Fragment key={producto.id}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                                onClick={() => setExpandedProducto(isExp ? null : producto.id)}>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                                                            <ProductAvatar
                                                                imagen={producto.imagen}
                                                                nombre={producto.nombre}
                                                                categoria={producto.categoria || ''}
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-base font-bold text-slate-900 dark:text-white block">{producto.nombre}</span>
                                                            {producto.descripcion && <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{producto.descripcion}</span>}
                                                            {problemasPrecio.has(producto.id) && <AvisoPrecio problemas={problemasPrecio.get(producto.id)!} className="mt-1" />}
                                                            {grupoDe.has(producto.id) && !grupoVisto && (
                                                                <button type="button" onClick={e => { e.stopPropagation(); verGrupo(grupoDe.get(producto.id)!); }}
                                                                    title={grupoDe.get(producto.id)!.texto}
                                                                    className="mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
                                                                    <Copy className="w-3 h-3" /> Posible duplicado
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={cn("text-xs font-bold px-2.5 py-1.5 rounded-full", esInsumo ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600")}>
                                                        {esInsumo ? '📦 Insumo' : '🛒 Venta'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4"><span className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${cc}15`, color: cc }}>{producto.categoria}</span></td>
                                                {canVerCosto && (
                                                <td className="px-5 py-4 text-base">
                                                    {cb > 0 ? <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(cb)}</span> : <span className="text-slate-400">—</span>}
                                                    {/* Cómo se compra (2026-11-23): paca/unidad, precio del proveedor y a quién */}
                                                    {mp ? (
                                                        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 whitespace-nowrap">
                                                            {(mp.cantidadEmbalaje || 1) > 1
                                                                ? <>{mp.tipoEmbalaje && mp.tipoEmbalaje !== 'unidad' ? mp.tipoEmbalaje : 'Paca'} x{mp.cantidadEmbalaje} · {formatCurrency(mp.precioCosto)}</>
                                                                : <>Por unidad · {formatCurrency(mp.precioCosto)}</>}
                                                            {/* 2026-11-23: costo de paca guardado como «1 unidad» → falta cuántas trae */}
                                                            {(mp.cantidadEmbalaje || 1) <= 1 && pv > 0 && mp.precioCosto >= pv * 3 && (
                                                                <span className="block mt-0.5 w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">⚠️ Pendiente: cuántas trae la paca</span>
                                                            )}
                                                            <span className="block font-normal text-slate-500 dark:text-slate-400 truncate max-w-[12rem]">{getProveedorById(mp.proveedorId)?.nombre || 'Proveedor borrado'}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="block text-xs font-bold text-amber-700 dark:text-amber-300 mt-0.5">Sin proveedor</span>
                                                    )}
                                                </td>
                                                )}
                                                {canVerPVP && (
                                                <td className="px-5 py-4 text-base font-bold text-emerald-600">{pv > 0 ? formatCurrency(pv) : <span className="text-slate-300">—</span>}</td>
                                                )}
                                                {canVerMargen && (
                                                <td className="px-5 py-4">{cb > 0 ? <span className={cn("text-sm font-bold px-2.5 py-1 rounded-full", ut >= 30 ? "bg-emerald-50 text-emerald-600" : ut >= 15 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}>{ut.toFixed(1)}%</span> : <span className="text-slate-300">—</span>}</td>
                                                )}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={e => { e.stopPropagation(); handleEdit(producto); }} className="p-2.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={e => { e.stopPropagation(); handleDelete(producto.id); }} className="p-2.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        <div className="p-2.5 text-slate-300">{isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExp && (
                                                <tr><td colSpan={7} className="px-5 pt-3 pb-6 bg-slate-50/50 dark:bg-slate-900/30 animate-ag-fade-in">
                                                    <div className="flex justify-end mb-3">
                                                        <button onClick={e => { e.stopPropagation(); setExpandedProducto(null); }}
                                                            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95">
                                                            <ChevronUp className="w-3.5 h-3.5" /> Cerrar
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2"><Info className="w-4 h-4" /> Descripción</h4>
                                                            <p className="text-base text-slate-600 leading-relaxed">{producto.descripcion || 'Sin descripción.'}</p>
                                                            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                <p className="text-sm font-semibold text-slate-500 mb-2">Margen</p>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-3xl font-extrabold text-emerald-600">{ut.toFixed(1)}%</span>
                                                                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(ut, 100)}%` }} /></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="lg:col-span-2 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2"><Store className="w-4 h-4" /> Proveedores ({pp.length})</h4>
                                                                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setAddingPrecioForProducto(isAP ? null : producto.id); }}
                                                                    className="rounded-xl font-semibold text-sm border-blue-200 text-blue-600 hover:bg-blue-50"><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
                                                            </div>
                                                            {isAP && (
                                                                <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 animate-ag-fade-in">
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                        <div><Label className="text-sm font-semibold text-slate-500 mb-1 block">Proveedor</Label>
                                                                            <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                                                                                <SelectTrigger className="h-11 rounded-lg bg-white text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                                                <SelectContent>{pd.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                                                                            </Select></div>
                                                                        <div><Label className="text-sm font-semibold text-slate-500 mb-1 block">Precio</Label>
                                                                            <Input type="number" step="0.01" value={precioCosto} onChange={e => setPrecioCosto(e.target.value)} className="h-11 rounded-lg bg-white text-base" placeholder="0.00" /></div>
                                                                        <div><Label className="text-sm font-semibold text-slate-500 mb-1 block">Notas</Label>
                                                                            <Input value={notasPrecio} onChange={e => setNotasPrecio(e.target.value)} className="h-11 rounded-lg bg-white text-sm" placeholder="Condiciones..." /></div>
                                                                    </div>
                                                                    <div className="flex gap-3">
                                                                        <Button variant="ghost" size="sm" onClick={() => setAddingPrecioForProducto(null)} className="text-sm">Cancelar</Button>
                                                                        <Button size="sm" onClick={() => handleAgregarPrecio(producto.id)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Registrar</Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pp.length === 0 ? (
                                                                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200"><Building2 className="w-8 h-8 mx-auto mb-2 text-slate-200" /><p className="text-sm font-semibold text-slate-300">Sin proveedores vinculados</p></div>
                                                            ) : (
                                                                <div className="space-y-2">{pp.map(precio => <ProductPriceItem key={precio.id} precio={precio} proveedor={getProveedorById(precio.proveedorId)}
                                                                    utilidad={Number(producto.precioVenta) > 0 ? ((Number(producto.precioVenta) - Number(precio.precioCosto)) / Number(producto.precioVenta)) * 100 : 0}
                                                                    esMejorPrecio={mp?.id === precio.id} onDelete={onDeletePrecio} formatCurrency={formatCurrency} />)}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <p className="text-sm font-semibold text-slate-500">Mostrando {filteredProductos.length} de {productos.length} productos</p>
                            <div className="flex gap-2 text-sm text-slate-400">
                                <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded font-bold">{countVenta} venta</span>
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded font-bold">{countInsumo} insumos</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ProductFormModal isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} editingProducto={editingProducto}
                categorias={categorias} proveedores={proveedores} formData={formData} setFormData={setFormData}
                onSubmit={handleSubmit} formatCurrency={formatCurrency} onAddCategoria={onAddCategoria}
                isSubmitting={isSaving}
                comprasProveedor={editingProducto ? getPreciosByProducto(editingProducto.id)
                    .slice().sort((a, b) => String(b.fechaActualizacion || '').localeCompare(String(a.fechaActualizacion || '')))
                    .map(pr => ({
                        proveedor: getProveedorById(pr.proveedorId)?.nombre || 'Proveedor borrado',
                        tipo: pr.tipoEmbalaje || 'unidad',
                        cantidad: Number(pr.cantidadEmbalaje) || 1,
                        costo: Number(pr.precioCosto) || 0,
                        fecha: pr.fechaActualizacion,
                    })) : []}
                historialPrecios={historialEditado}
                onDelete={editingProducto && check('ELIMINAR_PRODUCTOS') ? () => handleDelete(editingProducto.id) : undefined} />
            {/* Confirmar eliminar (2026-11-23) */}
            <Dialog open={!!porEliminar} onOpenChange={o => { if (!o) setPorEliminar(null); }}>
                <DialogContent className="max-w-sm rounded-2xl">
                    <DialogTitle className="text-lg font-black">¿Eliminar este producto?</DialogTitle>
                    <DialogDescription className="text-base text-slate-700 dark:text-slate-200">
                        <b>{porEliminar?.nombre}</b> se quita de la lista, de los catálogos de proveedores y de todos los aparatos. No vuelve a aparecer.
                    </DialogDescription>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold" onClick={() => setPorEliminar(null)}>Cancelar</Button>
                        <Button type="button" className="h-12 flex-1 rounded-xl text-base font-black bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmarEliminar}>Sí, eliminar</Button>
                    </div>
                </DialogContent>
            </Dialog>
            <ProductCategoryManager isOpen={isCategoriaDialogOpen} onOpenChange={setIsCategoriaDialogOpen}
                categorias={categorias} onDeleteCategoria={onDeleteCategoria} onUpdateCategoria={onUpdateCategoria}
                onAddCategoria={handleHandleAddCategoria}
                nuevaCategoria={nuevaCategoria} setNuevaCategoria={setNuevaCategoria} coloresPreset={COLORES_PRESET} />

            <OrdenarPanesModal
                isOpen={isOrdenarPanesOpen}
                onOpenChange={setIsOrdenarPanesOpen}
                productos={productos}
                modelosPan={modelosPan}
                formulaciones={formulaciones}
                categorias={categorias}
                onAddCategoria={onAddCategoria}
                onAddProducto={onAddProducto}
                onUpdateProducto={onUpdateProducto}
                onUpdateModelo={onUpdateModeloPan}
            />

            <IceCreamAssistantModal
                isOpen={isIceCreamAssistantOpen}
                onOpenChange={setIsIceCreamAssistantOpen}
                productos={productos}
                precios={_precios}
                onAddProducto={onAddProducto}
                onUpdateProducto={onUpdateProducto}
                onDeleteProducto={onDeleteProducto}
                formatCurrency={formatCurrency}
                sesionesCaja={sesionesCaja}
                gastos={gastos}
            />

            <ListaPreciosModal
                isOpen={isListaPreciosOpen}
                onOpenChange={setIsListaPreciosOpen}
                productos={productos}
                onUpdateProducto={onUpdateProducto}
                categorias={categorias}
            />

            <BeverageAssistantModal
                isOpen={isBeverageAssistantOpen}
                onOpenChange={setIsBeverageAssistantOpen}
                productos={productos}
                precios={_precios}
                onAddProducto={onAddProducto}
                formatCurrency={formatCurrency}
            />

            {/* ── Configurador de avatares ── */}
            <AvatarConfigurator
                open={isAvatarConfiguratorOpen}
                onClose={() => setIsAvatarConfiguratorOpen(false)}
                productos={productos}
            />
        </div>
    );
}
