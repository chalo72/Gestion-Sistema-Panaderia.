import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Filter, ShoppingCart, DollarSign, Calendar } from 'lucide-react';
import type { Venta, Producto, Categoria } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { safeNumber } from '@/lib/safe-utils';

interface HistorialVentasCategoriaProps {
    ventas: Venta[];
    productos: Producto[];
    categorias: Categoria[];
    formatCurrency: (value: number) => string;
}

export function HistorialVentasCategoria({
    ventas,
    productos,
    categorias,
    formatCurrency
}: HistorialVentasCategoriaProps) {
    const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const toggleCategoria = (catId: string) => {
        setSelectedCategorias(prev =>
            prev.includes(catId)
                ? prev.filter(c => c !== catId)
                : [...prev, catId]
        );
    };

    const toggleAll = () => {
        if (selectedCategorias.length === categorias.length) {
            setSelectedCategorias([]);
        } else {
            setSelectedCategorias(categorias.map(c => c.id));
        }
    };

    // Procesar las ventas para aplanar los ítems con sus productos y categorías
    const ventasItemsProcessed = useMemo(() => {
        const itemsList: { ventaId: string; fecha: string; productoId: string; nombreProducto: string; categoriaId: string; cantidad: number; subtotal: number }[] = [];

        ventas.forEach(venta => {
            venta.items.forEach(item => {
                const prod = productos.find(p => p.id === item.productoId);
                const descProducto = prod?.nombre || 'Producto Desconocido';
                const catId = prod?.categoria || 'sin-categoria';

                itemsList.push({
                    ventaId: venta.id,
                    fecha: venta.fecha,
                    productoId: item.productoId,
                    nombreProducto: descProducto,
                    categoriaId: catId,
                    cantidad: item.cantidad,
                    subtotal: item.subtotal
                });
            });
        });

        return itemsList;
    }, [ventas, productos]);

    // Filtrar los items por categoría y búsqueda
    const filteredItems = useMemo(() => {
        return ventasItemsProcessed.filter(item => {
            const matchesCategoria = selectedCategorias.length === 0 || selectedCategorias.includes(item.categoriaId);
            const matchesSearch = item.nombreProducto.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategoria && matchesSearch;
        });
    }, [ventasItemsProcessed, selectedCategorias, searchTerm]);

    // Agrupar los filtrados por categoría para mostrar resúmenes
    const resumenPorCategoria = useMemo(() => {
        const resumen: Record<string, { id: string; nombre: string; totalVentas: number; totalCantidad: number }> = {};

        filteredItems.forEach(item => {
            if (!resumen[item.categoriaId]) {
                const catInfo = categorias.find(c => c.id === item.categoriaId);
                resumen[item.categoriaId] = {
                    id: item.categoriaId,
                    nombre: catInfo ? catInfo.nombre : 'Otra Categoría',
                    totalVentas: 0,
                    totalCantidad: 0
                };
            }
            resumen[item.categoriaId].totalVentas += item.subtotal;
            resumen[item.categoriaId].totalCantidad += item.cantidad;
        });

        // Convertir a array y ordenar por monto
        return Object.values(resumen).sort((a, b) => b.totalVentas - a.totalVentas);
    }, [filteredItems, categorias]);

    // Gran Total
    const grandTotal = useMemo(() => {
        return filteredItems.reduce((acc, item) => acc + item.subtotal, 0);
    }, [filteredItems]);

    return (
        <div className="space-y-6">
            {/* Header + Selector de Categorías */}
            <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-sm">
                <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                        <div>
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter">Filtro por Categorías</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60 mt-1">
                                Selecciona las categorías que deseas sumar y analizar
                            </CardDescription>
                        </div>

                        <div className="relative group w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar producto en el historial..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-12 bg-white/5 border-white/10 rounded-2xl"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant="outline"
                            onClick={toggleAll}
                            className={cn(
                                "px-4 py-2 text-xs font-black uppercase tracking-widest cursor-pointer transition-all border",
                                selectedCategorias.length === categorias.length || selectedCategorias.length === 0
                                    ? "bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-600/30"
                                    : "bg-transparent text-muted-foreground border-white/10 hover:border-indigo-500/50 hover:text-indigo-400"
                            )}>
                            <Filter className="w-3 h-3 mr-2" />
                            Todas las Categorías
                        </Badge>

                        {categorias.map(cat => {
                            const isSelected = selectedCategorias.includes(cat.id);
                            return (
                                <Badge
                                    key={cat.id}
                                    variant="outline"
                                    onClick={() => toggleCategoria(cat.id)}
                                    className={cn(
                                        "px-4 py-2 text-xs font-black uppercase tracking-widest cursor-pointer transition-all border",
                                        isSelected
                                            ? "bg-slate-800 text-white border-slate-600 shadow-lg"
                                            : "bg-transparent text-muted-foreground border-white/10 hover:border-slate-500/50 hover:text-slate-300"
                                    )}>
                                    {cat.nombre}
                                </Badge>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Resumen de Totales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 rounded-[2.5rem] border-transparent bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl shadow-indigo-600/20 overflow-hidden relative group">
                    <CardContent className="p-8 relative z-10 flex flex-col justify-center h-full">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2 drop-shadow-md">Gran Total (Selección)</span>
                        <div className="text-4xl md:text-5xl font-black tabular-nums tracking-tighter drop-shadow-xl">
                            {formatCurrency(grandTotal)}
                        </div>
                        <div className="mt-4 flex items-center gap-2 opacity-80 text-xs font-bold">
                            <ShoppingCart className="w-4 h-4" />
                            {filteredItems.length} productos vendidos
                        </div>
                    </CardContent>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                </Card>

                <Card className="md:col-span-2 rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-sm">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-tighter text-muted-foreground">Desglose de la Selección</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {resumenPorCategoria.length > 0 ? resumenPorCategoria.map(res => (
                                <div key={res.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all group">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-indigo-400 truncate mb-2">{res.nombre}</h4>
                                    <div className="text-xl font-black tabular-nums">{formatCurrency(res.totalVentas)}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1 font-bold">{res.totalCantidad} items</div>
                                </div>
                            )) : (
                                <div className="col-span-full py-8 text-center text-muted-foreground text-sm font-bold uppercase tracking-widest">
                                    No hay ventas para la selección
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla Detallada */}
            <Card className="rounded-[3rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden shadow-sm">
                <CardHeader className="p-8 border-b border-white/5">
                    <CardTitle className="text-lg font-black uppercase tracking-tighter">Historial Detallado</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5">
                                <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <th className="px-8 py-5">Fecha / Hora</th>
                                    <th className="px-8 py-5">Producto</th>
                                    <th className="px-8 py-5">Categoría</th>
                                    <th className="px-8 py-5 text-center">Cantidad</th>
                                    <th className="px-8 py-5 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredItems.slice(0, 100).map((item, idx) => {
                                    const date = parseISO(item.fecha);
                                    const validDate = isValid(date) ? date : new Date();
                                    const isLast = idx === Math.min(filteredItems.length, 100) - 1;
                                    return (
                                        <tr key={`${item.ventaId}-${item.productoId}-${idx}`} className="hover:bg-white/5 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                                    <Calendar className="w-3 h-3 text-indigo-400" />
                                                    {format(validDate, "dd MMM yyyy", { locale: es })}
                                                    <span className="opacity-50 ml-1">{format(validDate, "HH:mm")}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="text-sm font-black uppercase tracking-tight">{item.nombreProducto}</div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <Badge variant="outline" className="text-[9px] uppercase tracking-widest bg-white/5 border-white/10">
                                                    {categorias.find(c => c.id === item.categoriaId)?.nombre || 'S/C'}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <span className="text-sm font-black tabular-nums">{item.cantidad}</span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className="text-sm font-black text-emerald-500 tabular-nums">{formatCurrency(item.subtotal)}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-16 text-center text-muted-foreground font-bold uppercase tracking-widest text-xs">
                                            No hay registros encontrados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {filteredItems.length > 100 && (
                            <div className="px-8 py-4 text-center bg-white/5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Mostrando los primeros 100 resultados de {filteredItems.length}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
