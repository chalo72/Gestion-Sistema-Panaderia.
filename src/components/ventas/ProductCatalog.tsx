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
}

export function ProductCatalog({
    productos, inventario, categorias, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, onAddToCart, formatCurrency, onEditProduct, onAjustarStock
}: ProductCatalogProps) {

    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
    const [editForm, setEditForm] = useState({ nombre: '', precioVenta: 0, descripcion: '', stock: 0 });

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
                if (editForm.stock !== stockActual) {
                    const delta = editForm.stock - stockActual;
                    await onAjustarStock(editingProduct.id, delta, 'ajuste', 'Ajuste desde POS');
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
                                    categorias={categorias} onAddToCart={onAddToCart} formatCurrency={formatCurrency}
                                    onEdit={onEditProduct ? (e) => openEditModal(producto, e) : undefined} />
                            ))}
                        </div>
                    )

                ) : !selectedCategory ? (
                    /* ═══ NIVEL 1: Categorías Estilo Premium Stitch ═══ */
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {categoriasConProductos.map(cat => {
                                const count = productosPorCategoria[cat.nombre.toLowerCase().trim()] || 0;
                                return (
                                    <div key={cat.id}
                                        onClick={() => setSelectedCategory(cat.nombre)}
                                        className="group cursor-pointer bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-900/10 transition-all active:scale-95 overflow-hidden flex flex-col items-center p-4">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:rotate-3 shadow-inner"
                                            style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                                            <span className="text-3xl">{cat.icono || '📦'}</span>
                                        </div>
                                        <div className="text-center space-y-1">
                                            <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight line-clamp-2">
                                                {cat.nombre}
                                            </h3>
                                            <div className="inline-flex px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-900 text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-slate-800">
                                                {count} {count === 1 ? 'Prod' : 'Prods'}
                                            </div>
                                        </div>
                                    </div>
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
                                    categorias={categorias} onAddToCart={onAddToCart} formatCurrency={formatCurrency}
                                    onEdit={onEditProduct ? (e) => openEditModal(producto, e) : undefined} />
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
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">📦 Stock / Cantidad</Label>
                            <Input type="number" value={editForm.stock}
                                onChange={e => setEditForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                                className="h-11 text-lg font-bold text-right rounded-xl border-slate-200" />
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
function ProductCard({ producto, inventario, categorias, onAddToCart, formatCurrency, onEdit }: {
    producto: Producto; inventario: InventarioItem[]; categorias: Categoria[];
    onAddToCart: (p: Producto) => void; formatCurrency: (v: number) => string;
    onEdit?: (e: React.MouseEvent) => void;
}) {
    const itemInv = inventario.find(i => i.productoId === producto.id);
    const stock = itemInv?.stockActual || 0;
    const categoria = categorias.find(c => c.nombre === producto.categoria);
    const catIcon = categoria?.icono || '📦';
    const catColor = categoria?.color || '#10b981';

    return (
        <div className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-900/5 transition-all cursor-pointer active:scale-[0.97] overflow-hidden flex flex-col"
            onClick={() => onAddToCart(producto)}>
            {/* Imagen Estilo Stitch */}
            <div className="aspect-square bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
                {producto.imagen ? (
                    <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                        <span className="text-4xl group-hover:scale-125 transition-transform duration-500">{catIcon}</span>
                    </div>
                )}

                {/* Badge de Stock Premium */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <div className={cn(
                        "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-lg",
                        stock <= 0 ? "bg-rose-500" : stock < 5 ? "bg-amber-500" : "bg-emerald-500"
                    )}>
                        {stock <= 0 ? 'Agotado' : `Stock: ${stock}`}
                    </div>
                </div>

                {/* Botón Editar Flotante */}
                {onEdit && (
                    <button onClick={onEdit}
                        className="absolute top-2 left-2 w-8 h-8 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-500 hover:text-white translate-x-[-10px] group-hover:translate-x-0">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Overlay Hover + */}
                <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl scale-50 group-hover:scale-100 transition-transform">
                        <Plus className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>

            {/* Info Refinada */}
            <div className="p-3 flex flex-col gap-1 flex-1 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5 block truncate">
                    {producto.categoria}
                </span>
                <h4 className="text-[11px] font-black leading-tight text-slate-800 dark:text-slate-100 uppercase tracking-tighter line-clamp-2 h-7">
                    {producto.nombre}
                </h4>
                <div className="mt-2 flex items-center justify-between border-t border-slate-50 dark:border-white/5 pt-2">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(safeNumber(producto.precioVenta))}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                    </div>
                </div>
            </div>
        </div>
    );
}
