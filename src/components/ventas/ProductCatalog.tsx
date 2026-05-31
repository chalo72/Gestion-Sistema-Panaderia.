import React, { useMemo, useState } from 'react';
import { Search, Plus, Package, ArrowLeft, Edit2, X, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Producto, InventarioItem, Categoria } from '@/types';
import { safeNumber } from '@/lib/safe-utils';
import { toast } from 'sonner';
import { ProductAvatar, CategoriaAvatar } from '@/components/ui/ProductAvatar';

interface ProductCatalogProps {
    productos: Producto[];
    inventario: InventarioItem[];
    categorias: Categoria[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory: string | null;
    setSelectedCategory: (cat: string | null) => void;
    onAddToCart: (producto: Producto) => void;
    formatCurrency: (value: number) => string;
    onEditProduct?: (id: string, updates: Partial<Producto>) => Promise<void>;
    onAjustarStock?: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => Promise<void>;
    onOpenAdHoc?: () => void;
    cart?: { producto: { id: string }; cantidad: number }[];
}

export function ProductCatalog({
    productos, inventario, categorias, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, onAddToCart, formatCurrency, onEditProduct, onAjustarStock, onOpenAdHoc, cart
}: ProductCatalogProps) {

    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
    const [editForm, setEditForm] = useState({ nombre: '', precioVenta: 0, descripcion: '', stock: 0 });
    const [multiplier, setMultiplier] = useState(1);

    const handleAddToCart = (producto: Producto) => {
        for (let i = 0; i < multiplier; i++) onAddToCart(producto);
        if (multiplier > 1) toast.success(`×${multiplier} ${producto.nombre}`);
        setMultiplier(1);
    };

    // Contar productos por categoría (normalizado: lowercase+trim para agrupar variantes)
    const productosPorCategoria = useMemo(() => {
        const counts: Record<string, number> = {};
        productos.forEach(p => {
            const key = (p.categoria || '').toLowerCase().trim();
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [productos]);

    const categoriasConProductos = useMemo(() => {
        // Busca categorías conocidas con comparación insensible a mayúsculas/espacios
        const conocidas = categorias.filter(c =>
            (productosPorCategoria[c.nombre.toLowerCase().trim()] || 0) > 0
        );
        // Mostrar también categorías "huérfanas" (productos cuya categoría no está registrada en el sistema)
        const nombresConocidosNorm = new Set(categorias.map(c => c.nombre.toLowerCase().trim()));
        const huerfanas = Object.keys(productosPorCategoria)
            .filter(key => !nombresConocidosNorm.has(key) && (productosPorCategoria[key] || 0) > 0)
            .map(key => ({ id: `huerfana-${key}`, nombre: key, color: '#6b7280', icono: '📦' } as Categoria));
        return [...conocidas, ...huerfanas];
    }, [categorias, productosPorCategoria]);

    const getCategoryIcon = (catNombre: string) => categorias.find(c => c.nombre === catNombre)?.icono || '📦';
    const getCategoryColor = (catNombre: string) => categorias.find(c => c.nombre === catNombre)?.color || '#3b82f6';

    const isSearching = searchTerm.trim().length > 0;

    const openEditModal = (producto: Producto, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProduct(producto);
        const itemInv = inventario.find(i => i.productoId === producto.id);
        setEditForm({
            nombre: producto.nombre,
            precioVenta: safeNumber(producto.precioVenta),
            descripcion: producto.descripcion || '',
            stock: itemInv?.stockActual || 0,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingProduct || !onEditProduct) return;
        try {
            await onEditProduct(editingProduct.id, {
                nombre: editForm.nombre,
                precioVenta: editForm.precioVenta,
                descripcion: editForm.descripcion,
            });
            // Ajustar stock si cambió
            if (onAjustarStock) {
                const itemInv = inventario.find(i => i.productoId === editingProduct.id);
                const stockActual = itemInv?.stockActual || 0;
                const nuevoStock = Math.max(0, editForm.stock);
                if (nuevoStock !== stockActual) {
                    const delta = nuevoStock - stockActual;
                    // Usar 'entrada' si sube el stock, 'salida' si baja — onAjustarStock requiere valor positivo
                    if (delta > 0) {
                        await onAjustarStock(editingProduct.id, delta, 'entrada', 'Ajuste manual desde POS');
                    } else {
                        await onAjustarStock(editingProduct.id, Math.abs(delta), 'salida', 'Ajuste manual desde POS');
                    }
                }
            }
            toast.success('Producto actualizado');
            setEditingProduct(null);
        } catch {
            toast.error('Error al guardar');
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-slate-900">
            {/* Header Pro: Búsqueda Stitch */}
            <div className="shrink-0 p-5 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md relative z-10">
                <div className="flex gap-3 items-center">
                    {selectedCategory && (
                        <button onClick={() => setSelectedCategory(null)}
                            className="shrink-0 w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-90 shadow-sm">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                    )}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            placeholder="Buscar producto por nombre o código..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                        />
                    </div>
                    {/* Multiplicador de cantidad */}
                    <div title="Multiplicador: el próximo producto se agregará esta cantidad de veces"
                        className={cn(
                            "shrink-0 flex items-center gap-1 h-12 rounded-2xl px-3 transition-all",
                            multiplier > 1 ? "bg-amber-500 shadow-lg shadow-amber-500/30" : "bg-slate-100 dark:bg-slate-800"
                        )}>
                        {multiplier > 1 && <span className="text-white text-xs font-black">×</span>}
                        <input
                            type="number" min={1} max={99} value={multiplier}
                            onChange={e => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                            className={cn(
                                "w-8 text-center text-sm font-black bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                multiplier > 1 ? "text-white" : "text-slate-500 dark:text-slate-400"
                            )}
                        />
                        {multiplier > 1 && (
                            <button onClick={() => setMultiplier(1)} className="text-white/70 hover:text-white transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    {/* Botón producto ad-hoc */}
                    {onOpenAdHoc && (
                        <button
                            onClick={onOpenAdHoc}
                            title="Agregar producto no listado"
                            className="shrink-0 w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 flex items-center justify-center hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-all active:scale-90"
                        >
                            <Plus className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </button>
                    )}
                </div>

                {/* Stats & Breadcrumb */}
                <div className="flex items-center justify-between mt-3 px-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {selectedCategory
                            ? <><span className="text-emerald-600 dark:text-emerald-400">{selectedCategory}</span> • {productos.length} items</>
                            : <>{categoriasConProductos.length} categorías • {productos.length} productos</>
                        }
                    </p>
                    {!selectedCategory && !isSearching && (
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest hidden sm:block">Explore el catálogo</span>
                    )}
                </div>
            </div>

            {/* Contenido con SCROLL */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">

                {isSearching ? (
                    productos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <span className="text-4xl mb-2">🔍</span>
                            <p className="text-sm font-bold text-slate-400">No se encontró "{searchTerm}"</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {productos.map(producto => (
                                <ProductCard key={producto.id} producto={producto} inventario={inventario}
                                    categorias={categorias} onAddToCart={handleAddToCart} formatCurrency={formatCurrency}
                                    onEdit={onEditProduct ? (e) => openEditModal(producto, e) : undefined}
                                    cantidadEnCarrito={cart?.find(i => i.producto.id === producto.id)?.cantidad ?? 0} />
                            ))}
                        </div>
                    )

                ) : !selectedCategory ? (
                    /* ═══ NIVEL 1: Categorías Estilo Premium Stitch ═══ */
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {categoriasConProductos.map(cat => {
                                const count = productosPorCategoria[cat.nombre.toLowerCase().trim()] || 0;
                                return (
                                    <CategoriaAvatar
                                        key={cat.id}
                                        nombre={cat.nombre}
                                        emoji={cat.icono}
                                        color={cat.color}
                                        count={count}
                                        className="h-[120px]"
                                        onClick={() => setSelectedCategory(cat.nombre)}
                                    />
                                );
                            })}
                        </div>

                        {categoriasConProductos.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center h-48 text-center">
                                <Package className="w-12 h-12 text-slate-200 mb-2" />
                                <p className="text-sm font-bold text-slate-400">Sin categorías con productos</p>
                            </div>
                        )}
                    </>

                ) : (
                    /* ═══ NIVEL 2: Productos de la categoría seleccionada ═══ */
                    productos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <span className="text-4xl mb-2">📦</span>
                            <p className="text-sm font-bold text-slate-400">Sin productos en esta categoría</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {productos.map(producto => (
                                <ProductCard key={producto.id} producto={producto} inventario={inventario}
                                    categorias={categorias} onAddToCart={handleAddToCart} formatCurrency={formatCurrency}
                                    onEdit={onEditProduct ? (e) => openEditModal(producto, e) : undefined}
                                    cantidadEnCarrito={cart?.find(i => i.producto.id === producto.id)?.cantidad ?? 0} />
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Modal de Edición Rápida */}
            <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogContent className="max-w-sm rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-xl">
                    <div className="bg-slate-900 text-white p-5 rounded-t-2xl">
                        <h3 className="text-lg font-bold">Editar Producto</h3>
                        <DialogDescription className="text-xs text-slate-400 mt-0.5">Modifica nombre, precio o descripción</DialogDescription>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Nombre</Label>
                            <Input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                                className="h-11 text-sm rounded-xl border-slate-200" />
                        </div>
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Precio de Venta</Label>
                            <Input type="number" value={editForm.precioVenta}
                                onChange={e => setEditForm(f => ({ ...f, precioVenta: parseFloat(e.target.value) || 0 }))}
                                className="h-11 text-lg font-bold text-right rounded-xl border-slate-200" />
                        </div>
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Descripción</Label>
                            <Input value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                                placeholder="Opcional" className="h-11 text-sm rounded-xl border-slate-200" />
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">📦 Control de Existencias</Label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                <Input type="number" value={editForm.stock}
                                    onChange={e => setEditForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                                    className="h-12 pl-10 text-xl font-black text-right rounded-xl border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 italic">Ajusta la cantidad física real para sincronizar el inventario.</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEditingProduct(null)}
                                className="flex-1 h-11 rounded-xl text-sm font-bold">Cancelar</Button>
                            <Button onClick={handleSaveEdit}
                                className="flex-[2] h-11 rounded-xl bg-primary hover:bg-orange-600 text-white text-sm font-bold">
                                <Save className="w-4 h-4 mr-1" /> Guardar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}

/* Card de producto individual - Estética Premium Stitch */
function ProductCard({ producto, inventario, categorias, onAddToCart, formatCurrency, onEdit, cantidadEnCarrito }: {
    producto: Producto; inventario: InventarioItem[]; categorias: Categoria[];
    onAddToCart: (p: Producto) => void; formatCurrency: (v: number) => string;
    onEdit?: (e: React.MouseEvent) => void;
    cantidadEnCarrito?: number;
}) {
    const itemInv = inventario.find(i => i.productoId === producto.id);
    const stock = itemInv?.stockActual || 0;
    const categoria = categorias.find(c => c.nombre === producto.categoria);
    const catIcon = categoria?.icono || '📦';
    const catColor = categoria?.color || '#10b981';

    const enCarrito = (cantidadEnCarrito ?? 0) > 0;

    return (
        <div className={cn(
            "group bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer active:scale-[0.97] overflow-hidden flex flex-col",
            enCarrito
                ? "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/40 shadow-md shadow-emerald-500/10"
                : "border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-900/5"
        )}
            onClick={() => onAddToCart(producto)}>
            {/* Imagen compacta */}
            <div className="h-20 overflow-hidden relative shrink-0">
                <ProductAvatar
                    imagen={producto.imagen}
                    nombre={producto.nombre}
                    categoria={producto.categoria || ''}
                    emoji={catIcon !== '📦' ? catIcon : undefined}
                    color={catColor}
                    hover={false}
                    className="w-full h-full"
                />

                {/* Badge de Stock — top-right */}
                <div className="absolute top-1.5 right-1.5 z-10">
                    <div className={cn(
                        "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wide text-white shadow",
                        stock <= 0 ? "bg-rose-500" : stock < 5 ? "bg-amber-500" : "bg-emerald-500"
                    )}>
                        {stock <= 0 ? 'Agotado' : stock}
                    </div>
                </div>

                {/* Botón Editar — top-left */}
                {onEdit && (
                    <button onClick={onEdit}
                        className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg bg-white/90 dark:bg-slate-800/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-500 hover:text-white z-20">
                        <Edit2 className="w-3 h-3" />
                    </button>
                )}

                {/* Overlay + */}
                <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl scale-50 group-hover:scale-100 transition-transform">
                        <Plus className="w-4 h-4 text-white" />
                    </div>
                </div>
            </div>

            {/* Info compacta */}
            <div className="px-2 py-1.5 flex flex-col bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
                <h4 className="text-[10px] font-black leading-tight text-slate-800 dark:text-slate-100 uppercase tracking-tighter line-clamp-1">
                    {producto.nombre}
                </h4>
                {producto.descripcion && (
                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 line-clamp-1 mt-0.5 leading-tight transition-colors">
                        {producto.descripcion}
                    </p>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-slate-50 dark:border-white/5 pt-1">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(safeNumber(producto.precioVenta))}
                    </span>
                    {/* Cantidad en ticket — visible en celular sin ir al carrito */}
                    {enCarrito ? (
                        <span className="min-w-[22px] h-[22px] bg-emerald-500 text-white text-[11px] font-black rounded-full flex items-center justify-center px-1.5 shadow-sm">
                            ×{cantidadEnCarrito}
                        </span>
                    ) : (
                        <div className="w-5 h-5 rounded-md bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Plus className="w-2.5 h-2.5" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
