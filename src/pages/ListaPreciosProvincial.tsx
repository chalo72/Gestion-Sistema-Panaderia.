import { useState, useMemo } from 'react';
import {
    DollarSign, Search, Package, Download, Plus, X,
    Percent, BarChart3, ArrowUpDown, Check,
    LayoutGrid, List, Filter, AlertCircle, CheckCircle2,
    ShoppingBag, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Producto, Categoria } from '@/types';

interface ListaPreciosProvincialProps {
    productos?: Producto[];
    inventario?: any[];
    categorias?: (string | Categoria)[];
    formatCurrency?: (value: number) => string;
    onAddProducto?: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type SortKey = 'nombre' | 'categoria' | 'precioVenta' | 'margenUtilidad' | 'stock';
type SortDir = 'asc' | 'desc';

const FORM_VACIO = {
    nombre: '',
    categoria: '',
    descripcion: '',
    precioVenta: 0,
    precioCompra: 0,
    margenUtilidad: 30,
    tipo: 'elaborado' as const,
};

export default function ListaPreciosProvincial({
    productos = [],
    inventario = [],
    categorias = [],
    formatCurrency = (v: number) => '$\u00a0' + (Math.round(v / 100) * 100).toLocaleString('es-CO'),
    onAddProducto,
}: ListaPreciosProvincialProps) {

    // ── Normalizar categorías ─────────────────────────────────────────────
    const categoriasObj = useMemo<Categoria[]>(() =>
        categorias.map(c =>
            typeof c === 'string'
                ? { id: c, nombre: c, color: '#6366f1' }
                : c
        ), [categorias]);

    const colorDeCat = (nombre: string) =>
        categoriasObj.find(c => c.nombre === nombre)?.color ?? '#6366f1';

    // ── Estado ────────────────────────────────────────────────────────────
    const [busqueda,     setBusqueda]     = useState('');
    const [catFiltro,    setCatFiltro]    = useState<string | null>(null);
    const [vista,        setVista]        = useState<'tabla' | 'tarjetas'>('tabla');
    const [sortKey,      setSortKey]      = useState<SortKey>('nombre');
    const [sortDir,      setSortDir]      = useState<SortDir>('asc');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [form,         setForm]         = useState(FORM_VACIO);
    const [guardando,    setGuardando]    = useState(false);

    // ── Productos con stock ───────────────────────────────────────────────
    const productosConStock = useMemo(() => {
        const mapa = new Map((inventario ?? []).map((i: any) => [i.producto_id, i.stock_actual ?? 0]));
        return (productos ?? []).map(p => ({ ...p, stock: mapa.get(p.id) ?? 0 }));
    }, [productos, inventario]);

    // ── Categorías únicas desde productos reales ─────────────────────────
    const catsUnicas = useMemo(() =>
        Array.from(new Set(productosConStock.map(p => p.categoria).filter(Boolean))),
        [productosConStock]);

    // ── Filtrado + ordenamiento ───────────────────────────────────────────
    const filtrados = useMemo(() => {
        let lista = productosConStock.filter(p => {
            const q = busqueda.toLowerCase();
            const ok = !q || p.nombre.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q);
            const okCat = !catFiltro || p.categoria === catFiltro;
            return ok && okCat;
        });
        lista.sort((a, b) => {
            let cmp = 0;
            if      (sortKey === 'nombre')          cmp = a.nombre.localeCompare(b.nombre);
            else if (sortKey === 'categoria')        cmp = (a.categoria ?? '').localeCompare(b.categoria ?? '');
            else if (sortKey === 'precioVenta')      cmp = a.precioVenta - b.precioVenta;
            else if (sortKey === 'margenUtilidad')   cmp = a.margenUtilidad - b.margenUtilidad;
            else if (sortKey === 'stock')            cmp = (a.stock ?? 0) - (b.stock ?? 0);
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return lista;
    }, [productosConStock, busqueda, catFiltro, sortKey, sortDir]);

    // ── KPIs ──────────────────────────────────────────────────────────────
    const kpis = useMemo(() => ({
        total:          filtrados.length,
        precioPromedio: filtrados.length ? filtrados.reduce((s, p) => s + p.precioVenta, 0) / filtrados.length : 0,
        margenPromedio: filtrados.length ? filtrados.reduce((s, p) => s + p.margenUtilidad, 0) / filtrados.length : 0,
        valorCatalogo:  filtrados.reduce((s, p) => s + p.precioVenta, 0),
    }), [filtrados]);

    // ── Ordenar columna ───────────────────────────────────────────────────
    const ordenar = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const iconOrden = (key: SortKey) => (
        <ArrowUpDown className={cn('w-3 h-3 ml-1 inline', sortKey === key ? 'text-indigo-500' : 'text-slate-300')} />
    );

    // ── Color por margen ──────────────────────────────────────────────────
    const colorMargen = (m: number) => {
        if (m >= 30) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (m >= 15) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    };

    // ── Exportar CSV ──────────────────────────────────────────────────────
    const exportarCSV = () => {
        const filas = [
            ['Producto', 'Categoría', 'Descripción', 'Precio Venta', 'Stock', 'Margen %'],
            ...filtrados.map(p => [
                `"${p.nombre}"`, `"${p.categoria}"`, `"${p.descripcion ?? ''}"`,
                p.precioVenta, p.stock ?? 0, `${p.margenUtilidad}%`
            ])
        ].map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([filas], { type: 'text/csv' }));
        a.download = `lista-precios-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Lista exportada como CSV');
    };

    // ── Crear producto ────────────────────────────────────────────────────
    const handleCrear = async () => {
        if (!form.nombre.trim())   { toast.error('El nombre es obligatorio'); return; }
        if (form.precioVenta <= 0) { toast.error('El precio de venta debe ser mayor a 0'); return; }
        if (!onAddProducto)        return;
        setGuardando(true);
        try {
            onAddProducto({
                ...form,
                // [Nexus-Shield] Redondear siempre al 100 más cercano (COP)
                precioVenta:    Math.round(Number(form.precioVenta) / 100) * 100,
                precioCompra:   Number(form.precioCompra),
                margenUtilidad: Number(form.margenUtilidad),
            });
            toast.success(`Producto "${form.nombre}" creado`);
            setModalAbierto(false);
            setForm(FORM_VACIO);
        } finally {
            setGuardando(false);
        }
    };

    // ── RENDER ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 h-full flex flex-col p-4 md:p-8 animate-ag-fade-in bg-[#f8fafc] dark:bg-[#0f172a] overflow-y-auto">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4
                               bg-white dark:bg-slate-900 p-6 rounded-[2.5rem]
                               border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl -mr-36 -mt-36 pointer-events-none" />
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700
                                    rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 animate-ag-float shrink-0">
                        <DollarSign className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                            Lista de Precios
                        </h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-black uppercase tracking-widest border-indigo-200 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">
                                Catálogo Dulce Placer
                            </Badge>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {filtrados.length} productos
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 relative z-10 flex-wrap">
                    {onAddProducto && (
                        <Button
                            onClick={() => setModalAbierto(true)}
                            className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest
                                       bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Producto
                        </Button>
                    )}
                    <Button onClick={exportarCSV} variant="outline"
                        className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest
                                   border-slate-200 hover:border-indigo-300 hover:text-indigo-600 gap-2">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </Button>
                </div>
            </header>

            {/* ── KPIs ───────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                {([
                    { label: 'Productos',       valor: kpis.total,           icon: Package,    color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  fmt: (v: number) => String(v) },
                    { label: 'Precio Promedio', valor: kpis.precioPromedio,  icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10', fmt: formatCurrency },
                    { label: 'Margen Promedio', valor: kpis.margenPromedio,  icon: Percent,    color: 'text-amber-600',   bg: 'bg-amber-500/10',   fmt: (v: number) => `${v.toFixed(1)}%` },
                    { label: 'Valor Catálogo',  valor: kpis.valorCatalogo,   icon: BarChart3,  color: 'text-purple-600',  bg: 'bg-purple-500/10',  fmt: formatCurrency },
                ] as const).map(({ label, valor, icon: Icon, color, bg, fmt }) => (
                    <div key={label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
                                <Icon className={cn('w-5 h-5', color)} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
                                <p className={cn('text-lg font-black tabular-nums', color)}>{fmt(valor)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── FILTROS ────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 space-y-4">
                <div className="flex gap-3 flex-wrap items-center">
                    {/* Búsqueda */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-10 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {/* Toggle vista */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                        {(['tabla', 'tarjetas'] as const).map(v => (
                            <button key={v} onClick={() => setVista(v)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all',
                                    vista === v
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}>
                                {v === 'tabla' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                                {v === 'tabla' ? 'Tabla' : 'Tarjetas'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chips de categoría */}
                {catsUnicas.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <button
                            onClick={() => setCatFiltro(null)}
                            className={cn(
                                'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border',
                                !catFiltro
                                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                            )}>
                            Todos
                        </button>
                        {catsUnicas.map(cat => {
                            const color = colorDeCat(cat);
                            const activa = catFiltro === cat;
                            return (
                                <button key={cat} onClick={() => setCatFiltro(activa ? null : cat)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border',
                                        activa
                                            ? 'text-white border-transparent'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    )}
                                    style={activa ? { backgroundColor: color, borderColor: color } : {}}>
                                    <span className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: activa ? 'rgba(255,255,255,0.8)' : color }} />
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── CONTENIDO ──────────────────────────────────────────────────── */}
            {filtrados.length === 0 ? (

                /* Estado vacío */
                <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900
                                rounded-3xl border border-slate-100 dark:border-slate-800 shrink-0 py-20">
                    <div className="text-center px-8">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-black text-slate-400 uppercase text-xs tracking-widest">Sin resultados</p>
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="mt-3 text-xs text-indigo-500 font-bold hover:underline">
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                </div>

            ) : vista === 'tabla' ? (

                /* ── TABLA ──────────────────────────────────────────────────── */
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {filtrados.length} productos
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold hidden md:block">
                            Clic en columna para ordenar
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                    <th className="px-4 py-3 text-left">
                                        <button onClick={() => ordenar('nombre')}
                                            className="flex items-center font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                                            Producto {iconOrden('nombre')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        <button onClick={() => ordenar('categoria')}
                                            className="flex items-center font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                                            Categoría {iconOrden('categoria')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">
                                        Descripción
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button onClick={() => ordenar('precioVenta')}
                                            className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                                            Precio {iconOrden('precioVenta')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-center">
                                        <button onClick={() => ordenar('stock')}
                                            className="flex items-center mx-auto font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                                            Stock {iconOrden('stock')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button onClick={() => ordenar('margenUtilidad')}
                                            className="flex items-center ml-auto font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                                            Margen {iconOrden('margenUtilidad')}
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {filtrados.map(p => {
                                    const cat = colorDeCat(p.categoria);
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                            {/* Producto */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {p.imagen ? (
                                                        <img src={p.imagen} alt={p.nombre}
                                                            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100"
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                            style={{ backgroundColor: cat + '20' }}>
                                                            <ShoppingBag className="w-4 h-4" style={{ color: cat }} />
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-slate-800 dark:text-white">{p.nombre}</span>
                                                </div>
                                            </td>
                                            {/* Categoría */}
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                                    style={{ backgroundColor: cat + '18', color: cat }}>
                                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat }} />
                                                    {p.categoria || '—'}
                                                </span>
                                            </td>
                                            {/* Descripción */}
                                            <td className="px-4 py-3 max-w-[200px]">
                                                <span className="text-slate-500 dark:text-slate-400 truncate block">
                                                    {p.descripcion || '—'}
                                                </span>
                                            </td>
                                            {/* Precio */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-black text-indigo-600 tabular-nums text-sm">
                                                    {formatCurrency(p.precioVenta)}
                                                </span>
                                            </td>
                                            {/* Stock */}
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn(
                                                    'px-2.5 py-1 rounded-full text-[10px] font-black tabular-nums',
                                                    (p.stock ?? 0) > 10
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : (p.stock ?? 0) > 0
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                                )}>
                                                    {p.stock ?? 0}
                                                </span>
                                            </td>
                                            {/* Margen */}
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black', colorMargen(p.margenUtilidad))}>
                                                    {p.margenUtilidad}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            ) : (

                /* ── TARJETAS ────────────────────────────────────────────────── */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtrados.map(p => {
                        const cat = colorDeCat(p.categoria);
                        return (
                            <div key={p.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800
                                           shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                                {/* Barra de color superior */}
                                <div className="h-1 w-full" style={{ backgroundColor: cat }} />

                                <div className="p-4 space-y-3">
                                    {/* Cabecera */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {p.imagen ? (
                                                <img src={p.imagen} alt={p.nombre}
                                                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-100"
                                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: cat + '20' }}>
                                                    <ShoppingBag className="w-5 h-5" style={{ color: cat }} />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">{p.nombre}</p>
                                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase mt-0.5" style={{ color: cat }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat }} />
                                                    {p.categoria || '—'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Stock */}
                                        <span className={cn(
                                            'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums',
                                            (p.stock ?? 0) > 10
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : (p.stock ?? 0) > 0
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                        )}>
                                            {p.stock ?? 0} u.
                                        </span>
                                    </div>

                                    {/* Descripción */}
                                    {p.descripcion && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                                            {p.descripcion}
                                        </p>
                                    )}

                                    {/* Precio + Margen */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio</p>
                                            <p className="text-xl font-black text-indigo-600 tabular-nums leading-tight">
                                                {formatCurrency(p.precioVenta)}
                                            </p>
                                        </div>
                                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black', colorMargen(p.margenUtilidad))}>
                                            {p.margenUtilidad}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODAL NUEVO PRODUCTO ────────────────────────────────────────── */}
            <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
                <DialogContent className="max-w-lg rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white relative">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Plus className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black">Nuevo Producto</DialogTitle>
                                <DialogDescription className="text-white/70 text-xs font-semibold uppercase tracking-widest mt-0.5">
                                    Agregar al catálogo
                                </DialogDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon"
                            className="absolute right-4 top-4 text-white/60 hover:text-white hover:bg-white/10"
                            onClick={() => setModalAbierto(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Nombre <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej: Pan Integral, Café Americano..."
                                className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Categoría */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Categoría</Label>
                                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {categoriasObj.map(c => (
                                            <SelectItem key={c.id} value={c.nombre} className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                    {c.nombre}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Tipo */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo</Label>
                                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as any })}>
                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="elaborado" className="text-sm">Para Venta</SelectItem>
                                        <SelectItem value="ingrediente" className="text-sm">Insumo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Descripción</Label>
                            <Input
                                value={form.descripcion}
                                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                placeholder="Características del producto..."
                                className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                            />
                        </div>

                        {/* Precios */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Precio Costo</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input type="number" step="0.01" min="0"
                                        value={form.precioCompra || ''}
                                        onChange={e => setForm({ ...form, precioCompra: parseFloat(e.target.value) || 0 })}
                                        className="h-11 pl-9 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                        placeholder="0.00" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Precio Venta <span className="text-red-400">*</span>
                                </Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <Input type="number" step="0.01" min="0.01"
                                        value={form.precioVenta || ''}
                                        onChange={e => setForm({ ...form, precioVenta: parseFloat(e.target.value) || 0 })}
                                        className="h-11 pl-9 rounded-xl border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-900/10 text-sm font-black text-indigo-700"
                                        placeholder="0.00" />
                                </div>
                            </div>
                        </div>

                        {/* Margen */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Margen de Utilidad (%)</Label>
                            <div className="relative">
                                <Input type="number" step="1" min="0"
                                    value={form.margenUtilidad || ''}
                                    onChange={e => setForm({ ...form, margenUtilidad: parseFloat(e.target.value) || 0 })}
                                    className="h-11 pr-10 text-center rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-black"
                                    placeholder="30" />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                            {form.margenUtilidad > 0 && (
                                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold', colorMargen(form.margenUtilidad))}>
                                    {form.margenUtilidad >= 30
                                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                    {form.margenUtilidad >= 30 ? 'Margen rentable' : form.margenUtilidad >= 15 ? 'Margen bajo — revisar' : 'Margen en riesgo'}
                                </div>
                            )}
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="outline" onClick={() => setModalAbierto(false)}
                                className="flex-1 h-12 rounded-xl text-sm font-semibold">
                                Cancelar
                            </Button>
                            <Button onClick={handleCrear} disabled={guardando}
                                className="flex-[2] h-12 rounded-xl text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 gap-2">
                                <Check className="w-4 h-4" />
                                {guardando ? 'Creando...' : 'Crear Producto'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
