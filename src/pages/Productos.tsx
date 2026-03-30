import React, { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
    Package, Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp,
    DollarSign, Info, Store, ChefHat, Building2, Tag, ShoppingCart, Warehouse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor, Categoria } from '@/types';
import { ProductHeader } from '@/components/productos/ProductHeader';
import { ProductCard } from '@/components/productos/ProductCard';
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import { ProductCategoryManager } from '@/components/productos/ProductCategoryManager';
import { ProductPriceItem } from '@/components/productos/ProductPriceItem';

interface ProductosProps {
    productos: Producto[];
    proveedores: Proveedor[];
    precios: PrecioProveedor[];
    categorias: Categoria[];
    onAddProducto: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
    onUpdateProducto: (id: string, updates: Partial<Producto>) => void;
    onDeleteProducto: (id: string) => void;
    onAddCategoria: (nombre: string, color: string) => Promise<Categoria>;
    onDeleteCategoria: (id: string) => void;
    onUpdateCategoria: (id: string, nombre: string, color: string) => void;
    onAddOrUpdatePrecio: (data: { productoId: string; proveedorId: string; precioCosto: number; notas?: string }) => void;
    onDeletePrecio: (id: string) => void;
    getMejorPrecio: (productoId: string) => PrecioProveedor | null;
    getPreciosByProducto: (productoId: string) => PrecioProveedor[];
    getProveedorById: (id: string) => Proveedor | undefined;
    formatCurrency: (value: number) => string;
}

const COLORES_PRESET = [
    '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#6b7280',
    '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#1e293b',
];

export default function Productos({
    productos, proveedores, precios: _precios, categorias,
    onAddProducto, onUpdateProducto, onDeleteProducto,
    onAddCategoria, onDeleteCategoria, onUpdateCategoria, onAddOrUpdatePrecio, onDeletePrecio,
    getMejorPrecio, getPreciosByProducto, getProveedorById, formatCurrency,
}: ProductosProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'elaborado' | 'ingrediente'>('todos');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
    const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
    const [expandedProducto, setExpandedProducto] = useState<string | null>(null);
    const [vistaActual, setVistaActual] = useState<'lista' | 'cuadricula'>('lista');
    const { check } = useCan();
    const [addingPrecioForProducto, setAddingPrecioForProducto] = useState<string | null>(null);
    const [selectedProveedorId, setSelectedProveedorId] = useState('');
    const [precioCosto, setPrecioCosto] = useState('');
    const [notasPrecio, setNotasPrecio] = useState('');
    const [formData, setFormData] = useState({
        nombre: '', categoria: '', descripcion: '', precioVenta: '',
        margenUtilidad: '30', proveedorId: '', precioCosto: '', notasPrecio: '', imagen: '', tipo: 'elaborado', unidadMedida: '',
    });
    const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', color: COLORES_PRESET[0] });

    const categoriasUnicas = useMemo(() => {
        const normalizadas = productos
            .map(p => p.categoria?.trim())
            .filter((c): c is string => !!c);
        const unicas = [...new Set(normalizadas.map(c => c.toLowerCase()))].map(cLower =>
            normalizadas.find(c => c.toLowerCase() === cLower) || cLower
        );
        return ['Todos', ...unicas];
    }, [productos]);

    const filteredProductos = useMemo(() => {
        return productos.filter(p => {
            const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.categoria.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = filtroCategoria === 'Todos' || p.categoria === filtroCategoria;
            const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
            return matchSearch && matchCat && matchTipo;
        });
    }, [productos, searchTerm, filtroCategoria, filtroTipo]);

    const countVenta = productos.filter(p => p.tipo === 'elaborado').length;
    const countInsumo = productos.filter(p => p.tipo === 'ingrediente').length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre || !formData.categoria) { toast.error('Nombre y categoría son obligatorios'); return; }
        let precioVenta = parseFloat(formData.precioVenta) || 0;
        const margen = parseFloat(formData.margenUtilidad) || 30;
        const costo = parseFloat(formData.precioCosto) || 0;
        if (costo > 0 && precioVenta === 0) precioVenta = costo * (1 + margen / 100);
        const data: any = { nombre: formData.nombre, categoria: formData.categoria, descripcion: formData.descripcion, precioVenta, margenUtilidad: margen, imagen: formData.imagen, tipo: formData.tipo || 'elaborado', unidadMedida: formData.unidadMedida || 'unidad', ...(costo > 0 && { costoBase: costo }) };
        try {
            if (editingProducto) {
                onUpdateProducto(editingProducto.id, data);
                if (formData.proveedorId && formData.precioCosto) onAddOrUpdatePrecio({ productoId: editingProducto.id, proveedorId: formData.proveedorId, precioCosto: parseFloat(formData.precioCosto), notas: formData.notasPrecio });
                toast.success('Producto actualizado');
            } else {
                const np = await onAddProducto(data);
                if (formData.proveedorId && formData.precioCosto) onAddOrUpdatePrecio({ productoId: np.id, proveedorId: formData.proveedorId, precioCosto: parseFloat(formData.precioCosto), notas: formData.notasPrecio });
                toast.success('Producto creado');
            }
            setIsDialogOpen(false); resetForm();
        } catch { toast.error('Error al procesar'); }
    };

    const handleHandleAddCategoria = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevaCategoria.nombre) { toast.error('Nombre obligatorio'); return; }
        onAddCategoria(nuevaCategoria.nombre, nuevaCategoria.color);
        toast.success('Categoría agregada');
        setNuevaCategoria({ nombre: '', color: COLORES_PRESET[0] });
        setIsCategoriaDialogOpen(false);
    };

    const resetForm = () => {
        setFormData({ nombre: '', categoria: '', descripcion: '', precioVenta: '', margenUtilidad: '30', proveedorId: '', precioCosto: '', notasPrecio: '', imagen: '', tipo: 'elaborado', unidadMedida: '' });
        setEditingProducto(null);
    };

    const handleEdit = (producto: Producto) => {
        setEditingProducto(producto);
        const mp = getMejorPrecio(producto.id);
        // Normalizar categoría: buscar coincidencia exacta primero, luego insensible a mayúsculas
        const catGuardada = producto.categoria || '';
        const catMatch = categorias.find(c => c.nombre === catGuardada)
            || categorias.find(c => c.nombre.toLowerCase().trim() === catGuardada.toLowerCase().trim());
        const categoriaFinal = catMatch ? catMatch.nombre : catGuardada;
        setFormData({ nombre: producto.nombre, categoria: categoriaFinal, descripcion: producto.descripcion || '', precioVenta: producto.precioVenta.toString(), margenUtilidad: producto.margenUtilidad.toString(), imagen: producto.imagen || '', proveedorId: mp?.proveedorId || '', precioCosto: mp?.precioCosto.toString() || '', notasPrecio: mp?.notas || '', tipo: producto.tipo || 'elaborado', unidadMedida: (producto as any).unidadMedida || '' });
        setIsDialogOpen(true);
    };

    const handleAddInsumo = () => {
        resetForm();
        setFormData((prev: any) => ({ ...prev, tipo: 'ingrediente' }));
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Eliminar este producto?')) { onDeleteProducto(id); toast.success('Producto eliminado'); }
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
        <div className="space-y-6 pb-12">
            <ProductHeader vistaActual={vistaActual} setVistaActual={setVistaActual}
                onManageCategories={() => setIsCategoriaDialogOpen(true)}
                onAddProduct={() => { resetForm(); setIsDialogOpen(true); }}
                onAddInsumo={handleAddInsumo}
                checkPermission={check} />

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
                    <Input placeholder="Buscar producto por nombre o categoría..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-12 text-base" />
                </div>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-full md:w-64 h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-80">
                        <SelectItem value="Todos" className="text-base py-2.5 font-semibold">Todas las categorías</SelectItem>
                        {categorias.map(cat => (
                            <SelectItem key={cat.id} value={cat.nombre} className="text-base py-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                    {cat.nombre}
                                    <span className="text-xs text-slate-400 ml-auto">({productos.filter(p => p.categoria === cat.nombre).length})</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Contenido */}
            <div className="pb-10">
                {filteredProductos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-6 rounded-full bg-slate-100 mb-4"><Package className="w-12 h-12 text-slate-300" /></div>
                        <h3 className="text-xl font-bold text-slate-400">Sin productos</h3>
                        <p className="text-base text-slate-400 mt-1">Agrega tu primer producto para comenzar.</p>
                    </div>
                ) : vistaActual === 'cuadricula' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredProductos.map(producto => {
                            const mp = getMejorPrecio(producto.id);
                            // Costo unitario: preferir costoBase del producto; si no, calcular desde proveedor
                            const cb = Number(producto.costoBase || (mp ? mp.precioCosto / (mp.cantidadEmbalaje || 1) : 0));
                            const pv = Number(producto.precioVenta || 0);
                            const ut = cb > 0 ? ((pv - cb) / cb) * 100 : 0;
                            return <ProductCard key={producto.id} producto={producto} mejorPrecio={mp} utilidad={ut}
                                categoriaColor={getCategoriaColor(producto.categoria)} formatCurrency={formatCurrency}
                                onEdit={handleEdit} onDelete={handleDelete}
                                onExpand={id => setExpandedProducto(expandedProducto === id ? null : id)} checkPermission={check} />;
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
                                    <th className="px-5 py-4">Costo</th>
                                    <th className="px-5 py-4">Precio Venta</th>
                                    <th className="px-5 py-4">Margen</th>
                                    <th className="px-5 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredProductos.map(producto => {
                                    const mp = getMejorPrecio(producto.id);
                                    // Costo unitario: preferir costoBase del producto; si no, calcular desde proveedor
                                    const cb = Number(producto.costoBase || (mp ? mp.precioCosto / (mp.cantidadEmbalaje || 1) : 0));
                                    const pv = Number(producto.precioVenta || 0);
                                    const ut = cb > 0 ? ((pv - cb) / cb) * 100 : 0;
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
                                                        {producto.imagen ? <img src={producto.imagen} alt="" className="w-11 h-11 rounded-xl object-cover" /> :
                                                            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", esInsumo ? "bg-blue-50 dark:bg-blue-900/20" : "bg-orange-50 dark:bg-orange-900/20")}>
                                                                {esInsumo ? <Warehouse className="w-5 h-5 text-blue-600" /> : <ChefHat className="w-5 h-5 text-orange-600" />}
                                                            </div>}
                                                        <div>
                                                            <span className="text-base font-bold block">{producto.nombre}</span>
                                                            {producto.descripcion && <span className="text-sm text-slate-400 line-clamp-1">{producto.descripcion}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={cn("text-xs font-bold px-2.5 py-1.5 rounded-full", esInsumo ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600")}>
                                                        {esInsumo ? '📦 Insumo' : '🛒 Venta'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4"><span className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${cc}15`, color: cc }}>{producto.categoria}</span></td>
                                                <td className="px-5 py-4 text-base">{cb > 0 ? <span className="font-bold">{formatCurrency(cb)}</span> : <span className="text-slate-300">—</span>}</td>
                                                <td className="px-5 py-4 text-base font-bold text-emerald-600">{pv > 0 ? formatCurrency(pv) : <span className="text-slate-300">—</span>}</td>
                                                <td className="px-5 py-4">{cb > 0 ? <span className={cn("text-sm font-bold px-2.5 py-1 rounded-full", ut >= 30 ? "bg-emerald-50 text-emerald-600" : ut >= 15 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}>{ut.toFixed(1)}%</span> : <span className="text-slate-300">—</span>}</td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={e => { e.stopPropagation(); handleEdit(producto); }} className="p-2.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={e => { e.stopPropagation(); handleDelete(producto.id); }} className="p-2.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        <div className="p-2.5 text-slate-300">{isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExp && (
                                                <tr><td colSpan={7} className="px-5 py-6 bg-slate-50/50 dark:bg-slate-900/30 animate-ag-fade-in">
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
                                                                    utilidad={Number(precio.precioCosto) > 0 ? ((Number(producto.precioVenta) - Number(precio.precioCosto)) / Number(precio.precioCosto)) * 100 : 0}
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
                onSubmit={handleSubmit} formatCurrency={formatCurrency} onAddCategoria={onAddCategoria} />
            <ProductCategoryManager isOpen={isCategoriaDialogOpen} onOpenChange={setIsCategoriaDialogOpen}
                categorias={categorias} onDeleteCategoria={onDeleteCategoria} onUpdateCategoria={onUpdateCategoria}
                onAddCategoria={handleHandleAddCategoria}
                nuevaCategoria={nuevaCategoria} setNuevaCategoria={setNuevaCategoria} coloresPreset={COLORES_PRESET} />
        </div>
    );
}
