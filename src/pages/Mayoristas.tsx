import { useState, useMemo, useCallback } from 'react';
import {
    Store, Users, TrendingUp, DollarSign, Package, AlertTriangle,
    CheckCircle2, XCircle, ChevronDown, ChevronUp, Plus, Trash2,
    Download, Pencil, Check, X, Phone, FileText, BarChart3, Info,
    ShieldCheck, Percent, ArrowRight, ShoppingCart, ArrowLeft, Search, UserCheck,
    Minus, Receipt, Banknote
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Producto, PrecioProveedor } from '@/types';
import { exportCSV, getExportFilename } from '@/lib/exportUtils';

// ─── Tipos locales ───────────────────────────────────────────────────────────
interface ClienteMayorista {
    id: string;
    nombre: string;
    tipo: 'mayorista' | 'detal' | 'trabajador';
    telefono?: string;
    margenPersonalizado?: number; // override del margen revendedor global
    notas?: string;
    creadoEn: string;
}

interface MayoristasProps {
    productos: Producto[];
    precios: PrecioProveedor[];
    getMejorPrecio: (productoId: string) => PrecioProveedor | null;
    formatCurrency: (value: number) => string;
    onNavigateTo?: (view: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cargarClientes(): ClienteMayorista[] {
    try { return JSON.parse(localStorage.getItem('ag_clientes_mayoristas') || '[]'); }
    catch { return []; }
}

function guardarClientes(cs: ClienteMayorista[]) {
    try { localStorage.setItem('ag_clientes_mayoristas', JSON.stringify(cs)); } catch {}
}

function cargarConfig(): { margenNegocio: number; margenRevendedor: number } {
    try { return JSON.parse(localStorage.getItem('ag_mayoristas_config') || '{"margenNegocio":20,"margenRevendedor":25}'); }
    catch { return { margenNegocio: 20, margenRevendedor: 25 }; }
}

function guardarConfig(c: { margenNegocio: number; margenRevendedor: number }) {
    try { localStorage.setItem('ag_mayoristas_config', JSON.stringify(c)); } catch {}
}

/** Calcula el costo real de un producto */
function calcularCosto(producto: Producto, mejorPrecio: PrecioProveedor | null): number {
    if (mejorPrecio?.precioCosto && mejorPrecio.precioCosto > 0) return mejorPrecio.precioCosto;
    if (producto.costoBase && producto.costoBase > 0) return producto.costoBase;
    if (producto.margenUtilidad > 0 && producto.precioVenta > 0) {
        return producto.precioVenta / (1 + producto.margenUtilidad / 100);
    }
    return 0;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    mayorista:  { label: 'Al por Mayor',  color: 'text-indigo-600',  bg: 'bg-indigo-50  dark:bg-indigo-950/20' },
    detal:      { label: 'Detal',         color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
    trabajador: { label: 'Trabajador',    color: 'text-amber-600',   bg: 'bg-amber-50   dark:bg-amber-950/20'  },
    // Compatibilidad con tipos anteriores
    tienda:       { label: 'Tienda',          color: 'text-indigo-600',  bg: 'bg-indigo-50  dark:bg-indigo-950/20' },
    vendedor:     { label: 'Vendedor Indep.', color: 'text-amber-600',   bg: 'bg-amber-50   dark:bg-amber-950/20'  },
    distribuidor: { label: 'Distribuidor',    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
};

// ─── Componente principal ────────────────────────────────────────────────────
export default function Mayoristas({ productos, precios, getMejorPrecio, formatCurrency, onNavigateTo }: MayoristasProps) {
    // Config de márgenes
    const [config, setConfig] = useState(cargarConfig);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [configTemp, setConfigTemp] = useState(config);

    // Estado de Pestañas
    const [activeTab, setActiveTab] = useState('precios');

    // Clientes mayoristas
    const [clientes, setClientes] = useState<ClienteMayorista[]>(cargarClientes);
    const [showModalCliente, setShowModalCliente] = useState(false);
    const [editandoCliente, setEditandoCliente] = useState<ClienteMayorista | null>(null);
    const [formCliente, setFormCliente] = useState<Partial<ClienteMayorista>>({ tipo: 'tienda' });
    const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteMayorista | null>(null);
    const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
    const [viendoPerfilCliente, setViendoPerfilCliente] = useState<ClienteMayorista | null>(null);
    const [busquedaPerfil, setBusquedaPerfil] = useState('');
    const [carritoPos, setCarritoPos] = useState<{ productoId: string; nombre: string; precio: number; cantidad: number }[]>([]);

    const agregarAlCarrito = (productoId: string, nombre: string, precio: number) => {
        setCarritoPos(prev => {
            const existe = prev.find(i => i.productoId === productoId);
            if (existe) return prev.map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + 1 } : i);
            return [...prev, { productoId, nombre, precio, cantidad: 1 }];
        });
    };

    const actualizarCantidadPos = (productoId: string, delta: number) => {
        setCarritoPos(prev =>
            prev.map(i => i.productoId === productoId ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
        );
    };

    const eliminarDelCarrito = (productoId: string) => {
        setCarritoPos(prev => prev.filter(i => i.productoId !== productoId));
    };

    const totalCarrito = carritoPos.reduce((s, i) => s + i.precio * i.cantidad, 0);

    // Filtros de tabla
    const [busqueda, setBusqueda] = useState('');
    const [soloViables, setSoloViables] = useState(false);
    const [expandido, setExpandido] = useState<string | null>(null);

    // Margen efectivo del revendedor (usa personalizado si hay cliente seleccionado)
    const margenRevendedorEfectivo = clienteSeleccionado?.margenPersonalizado ?? config.margenRevendedor;

    // ── Cálculo de precios por producto ──────────────────────────────────────
    const tablaDatos = useMemo(() => {
        return productos
            .filter(p => p.tipo === 'elaborado' || p.costoBase)
            .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            .map(p => {
                const mejorPrecio = getMejorPrecio(p.id);
                const costo = calcularCosto(p, mejorPrecio);
                if (costo <= 0) return null;

                // Precio mínimo al que la panadería puede vender sin perder
                const precioMinPanaderia = costo; // sin margen = break-even

                // Precio mayorista con el margen configurado del negocio
                const precioMayorista = costo * (1 + config.margenNegocio / 100);

                // Precio de reventa que el cliente puede usar (su margen sobre el mayorista)
                const precioReventa = precioMayorista * (1 + margenRevendedorEfectivo / 100);

                // Precio de venta al consumidor final actual
                const pvp = p.precioVenta;

                // ¿Tiene sentido? El precio de reventa debe ser ≤ PVP del mercado
                // (si el revendedor vende más caro que la panadería al público, no tiene sentido)
                const margenPanaderiaReal = costo > 0 ? ((precioMayorista - costo) / costo) * 100 : 0;
                const margenRevendedorReal = precioMayorista > 0 ? ((precioReventa - precioMayorista) / precioMayorista) * 100 : 0;
                const gananciaPanaderiaPorUnidad = precioMayorista - costo;
                const gananciRevendedorPorUnidad = precioReventa - precioMayorista;

                // Semáforo: ¿Es viable para ambas partes?
                const reventaMenorQuePVP = precioReventa <= pvp * 1.05; // permite 5% por encima del PVP
                const panaderiaGana = precioMayorista > costo * 1.05; // al menos 5% sobre costo
                const revendedorGana = gananciRevendedorPorUnidad > 0;

                let viabilidad: 'excelente' | 'viable' | 'ajustado' | 'inviable';
                if (panaderiaGana && revendedorGana && reventaMenorQuePVP) viabilidad = 'excelente';
                else if (panaderiaGana && revendedorGana) viabilidad = 'viable';
                else if (panaderiaGana) viabilidad = 'ajustado';
                else viabilidad = 'inviable';

                return {
                    producto: p,
                    costo,
                    precioMinPanaderia,
                    precioMayorista,
                    precioReventa,
                    pvp,
                    margenPanaderiaReal,
                    margenRevendedorReal,
                    gananciaPanaderiaPorUnidad,
                    gananciRevendedorPorUnidad,
                    viabilidad,
                    reventaMenorQuePVP,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .filter(d => !soloViables || d.viabilidad !== 'inviable')
            .sort((a, b) => {
                const orden = { excelente: 0, viable: 1, ajustado: 2, inviable: 3 };
                return orden[a.viabilidad] - orden[b.viabilidad];
            });
    }, [productos, getMejorPrecio, config.margenNegocio, margenRevendedorEfectivo, busqueda, soloViables]);

    // Stats del resumen
    const stats = useMemo(() => {
        const total = tablaDatos.length;
        const excelentes = tablaDatos.filter(d => d.viabilidad === 'excelente').length;
        const viables = tablaDatos.filter(d => d.viabilidad === 'viable').length;
        const inviables = tablaDatos.filter(d => d.viabilidad === 'inviable').length;
        const promedioMargenNegocio = total > 0
            ? tablaDatos.reduce((s, d) => s + d.margenPanaderiaReal, 0) / total : 0;
        return { total, excelentes, viables, inviables, promedioMargenNegocio };
    }, [tablaDatos]);

    const VIABILIDAD_CONFIG = {
        excelente: { label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-l-emerald-500', icon: CheckCircle2 },
        viable:    { label: 'Viable',    color: 'text-indigo-600',  bg: 'bg-indigo-50  dark:bg-indigo-950/20',  border: 'border-l-indigo-500',  icon: CheckCircle2 },
        ajustado:  { label: 'Ajustado',  color: 'text-amber-600',   bg: 'bg-amber-50   dark:bg-amber-950/20',   border: 'border-l-amber-500',   icon: AlertTriangle },
        inviable:  { label: 'Inviable',  color: 'text-rose-600',    bg: 'bg-rose-50    dark:bg-rose-950/20',    border: 'border-l-rose-500',    icon: XCircle },
    };

    // ── Handlers de clientes ─────────────────────────────────────────────────
    const abrirNuevoCliente = () => {
        setEditandoCliente(null);
        setFormCliente({ tipo: 'mayorista' });
        setShowModalCliente(true);
    };

    const abrirEditarCliente = (c: ClienteMayorista) => {
        setEditandoCliente(c);
        setFormCliente({ ...c });
        setShowModalCliente(true);
    };

    const handleGuardarCliente = () => {
        if (!formCliente.nombre?.trim()) { toast.error('El nombre es obligatorio'); return; }
        const lista = editandoCliente
            ? clientes.map(c => c.id === editandoCliente.id ? { ...c, ...formCliente } as ClienteMayorista : c)
            : [...clientes, { id: crypto.randomUUID(), creadoEn: new Date().toISOString(), tipo: 'tienda', ...formCliente } as ClienteMayorista];
        setClientes(lista);
        guardarClientes(lista);
        setShowModalCliente(false);
        toast.success(editandoCliente ? 'Cliente actualizado' : `"${formCliente.nombre}" agregado`);
    };

    const eliminarCliente = (id: string) => {
        const nuevos = clientes.filter(c => c.id !== id);
        setClientes(nuevos);
        guardarClientes(nuevos);
        if (clienteSeleccionado?.id === id) setClienteSeleccionado(null);
        toast.success('Cliente eliminado');
    };

    // ── Guardar config de márgenes ───────────────────────────────────────────
    const handleGuardarConfig = () => {
        const nueva = {
            margenNegocio: Math.max(0, Math.min(200, configTemp.margenNegocio)),
            margenRevendedor: Math.max(0, Math.min(200, configTemp.margenRevendedor)),
        };
        setConfig(nueva);
        guardarConfig(nueva);
        setEditandoConfig(false);
        toast.success('Márgenes actualizados');
    };

    // ── Exportar lista de precios ────────────────────────────────────────────
    const exportarListaPrecios = () => {
        const nombreCliente = clienteSeleccionado?.nombre || 'General';
        exportCSV(
            tablaDatos.filter(d => d.viabilidad !== 'inviable').map(d => ({
                producto: d.producto.nombre,
                costo: d.costo,
                precio_mayorista: d.precioMayorista,
                precio_reventa_sugerido: d.precioReventa,
                pvp_mercado: d.pvp,
                ganancia_revendedor: d.gananciRevendedorPorUnidad,
                viabilidad: VIABILIDAD_CONFIG[d.viabilidad].label,
            })),
            getExportFilename(`lista-mayorista-${nombreCliente.toLowerCase().replace(/\s+/g, '-')}`),
            {
                producto: 'Producto',
                costo: 'Costo',
                precio_mayorista: 'Precio Mayorista',
                precio_reventa_sugerido: 'P. Reventa Sugerido',
                pvp_mercado: 'PVP Mercado',
                ganancia_revendedor: 'Ganancia Revendedor',
                viabilidad: 'Viabilidad',
            }
        );
        toast.success(`Lista de precios exportada${clienteSeleccionado ? ` para ${clienteSeleccionado.nombre}` : ''}`);
    };

    // ── Mini-POS del Cliente ─────────────────────────────────────────────────
    if (viendoPerfilCliente) {
        const cliente = viendoPerfilCliente;
        const tConf = TIPO_CONFIG[cliente.tipo] || TIPO_CONFIG.mayorista;
        const productosPerfil = tablaDatos
            .filter(d => !busquedaPerfil || d.producto.nombre.toLowerCase().includes(busquedaPerfil.toLowerCase()))
            .filter(d => d.viabilidad !== 'inviable');

        return (
            <div className="min-h-screen flex flex-col gap-0 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => { setViendoPerfilCliente(null); setBusquedaPerfil(''); setCarritoPos([]); }}
                            variant="outline"
                            className="w-10 h-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tConf.bg)}>
                            <UserCheck className={cn('w-5 h-5', tConf.color)} />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">{cliente.nombre}</h2>
                            <Badge className={cn('text-[8px] font-black border-none px-2 py-0.5 uppercase mt-0.5', tConf.bg, tConf.color)}>
                                {tConf.label}
                            </Badge>
                        </div>
                    </div>
                    <div className="relative w-56 hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto..."
                            value={busquedaPerfil}
                            onChange={e => setBusquedaPerfil(e.target.value)}
                            className="h-9 pl-9 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold"
                        />
                    </div>
                </div>

                {/* Layout dos columnas */}
                <div className="flex flex-col lg:flex-row flex-1 gap-0 min-h-[calc(100vh-72px)]">

                    {/* ── PANEL IZQUIERDO: Productos ── */}
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {/* Búsqueda mobile */}
                        <div className="relative sm:hidden">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar producto..."
                                value={busquedaPerfil}
                                onChange={e => setBusquedaPerfil(e.target.value)}
                                className="h-9 pl-9 rounded-xl border-slate-200 bg-white text-xs font-bold"
                            />
                        </div>

                        {productosPerfil.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <Package className="w-12 h-12 text-slate-200 mb-3" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin productos disponibles</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                {productosPerfil.map(d => {
                                    const enCarrito = carritoPos.find(i => i.productoId === d.producto.id);
                                    return (
                                        <Card
                                            key={d.producto.id}
                                            onClick={() => agregarAlCarrito(d.producto.id, d.producto.nombre, d.precioMayorista)}
                                            className={cn(
                                                'rounded-2xl border cursor-pointer transition-all hover:shadow-md active:scale-95 flex flex-col',
                                                enCarrito ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100 bg-white'
                                            )}
                                        >
                                            <CardContent className="p-3 flex flex-col gap-2">
                                                <h4 className="font-black text-xs uppercase tracking-tight text-slate-900 leading-tight line-clamp-2 min-h-[32px]">
                                                    {d.producto.nombre}
                                                </h4>
                                                <div className="bg-indigo-50 rounded-xl p-2 border border-indigo-100">
                                                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Precio {tConf.label}</p>
                                                    <p className="text-lg font-black text-slate-900 tabular-nums leading-none mt-0.5">{formatCurrency(d.precioMayorista)}</p>
                                                </div>
                                                <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase">
                                                    <span>Ganancia</span>
                                                    <span className="text-emerald-600">+{formatCurrency(d.gananciaPanaderiaPorUnidad)}</span>
                                                </div>
                                                {enCarrito ? (
                                                    <div className="flex items-center justify-between bg-indigo-600 rounded-xl px-2 py-1.5">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); actualizarCantidadPos(d.producto.id, -1); }}
                                                            className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="text-sm font-black text-white tabular-nums">{enCarrito.cantidad}</span>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); actualizarCantidadPos(d.producto.id, 1); }}
                                                            className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1 text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                                                        <Plus className="w-3 h-3" /> Toca para agregar
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── PANEL DERECHO: Ticket ── */}
                    <div className="w-full lg:w-[360px] bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 flex flex-col shadow-2xl">
                        {/* Ticket header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
                                    <Receipt className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Ticket</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{cliente.nombre}</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="font-black text-indigo-600 border-indigo-100 bg-white px-3 rounded-full">
                                {carritoPos.length} items
                            </Badge>
                        </div>

                        {/* Lista del carrito */}
                        <ScrollArea className="flex-1 max-h-[40vh] lg:max-h-none">
                            {carritoPos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 opacity-30">
                                    <ShoppingCart className="w-12 h-12 text-indigo-300 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                                        Toca un producto para agregar
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {carritoPos.map(item => (
                                        <div key={item.productoId} className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{item.nombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{formatCurrency(item.precio)} × {item.cantidad}</p>
                                            </div>
                                            <p className="text-sm font-black text-indigo-600 tabular-nums shrink-0">{formatCurrency(item.precio * item.cantidad)}</p>
                                            <button
                                                onClick={() => eliminarDelCarrito(item.productoId)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Total + Acciones */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalCarrito)}</span>
                            </div>
                            <Button
                                disabled={carritoPos.length === 0}
                                onClick={() => {
                                    toast.success(`Venta registrada para ${cliente.nombre}: ${formatCurrency(totalCarrito)}`);
                                    setCarritoPos([]);
                                }}
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                <Banknote className="w-4 h-4" /> Confirmar Venta
                            </Button>
                            {carritoPos.length > 0 && (
                                <Button
                                    onClick={() => setCarritoPos([])}
                                    variant="ghost"
                                    className="w-full h-9 text-xs font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpiar ticket
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Ventas al Mayor</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Precios para tiendas y vendedores · Sin perder, con ganancia para todos
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={abrirNuevoCliente} className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-black uppercase tracking-widest text-xs">
                        <Plus className="w-4 h-4" /> Agregar cliente
                    </Button>
                    <Button onClick={exportarListaPrecios} variant="outline" className="h-10 px-4 rounded-xl gap-2 font-black uppercase tracking-widest text-xs border-indigo-200 text-indigo-600">
                        <Download className="w-4 h-4" /> Exportar lista
                    </Button>
                </div>
            </header>

            {/* ── Config de márgenes ──────────────────────────────────────── */}
            <Card className="rounded-2xl border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10">
                <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 flex items-center justify-center">
                                <Percent className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-900 dark:text-white">Configuración de Márgenes</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                    Negocio: <span className="text-indigo-600">{config.margenNegocio}%</span> ·
                                    Revendedor: <span className="text-emerald-600"> {config.margenRevendedor}%</span>
                                    {clienteSeleccionado?.margenPersonalizado && (
                                        <span className="text-amber-600"> (personalizado: {clienteSeleccionado.margenPersonalizado}%)</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {editandoConfig ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Margen negocio %</Label>
                                    <Input
                                        type="number" min={0} max={200}
                                        value={configTemp.margenNegocio}
                                        onChange={e => setConfigTemp(c => ({ ...c, margenNegocio: parseFloat(e.target.value) || 0 }))}
                                        className="w-20 h-8 text-xs font-bold"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Margen revendedor %</Label>
                                    <Input
                                        type="number" min={0} max={200}
                                        value={configTemp.margenRevendedor}
                                        onChange={e => setConfigTemp(c => ({ ...c, margenRevendedor: parseFloat(e.target.value) || 0 }))}
                                        className="w-20 h-8 text-xs font-bold"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleGuardarConfig} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black gap-1">
                                        <Check className="w-3 h-3" /> Guardar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditandoConfig(false)} className="h-8 text-xs">
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => { setConfigTemp(config); setEditandoConfig(true); }} className="h-8 gap-1.5 text-xs font-black border-indigo-200 text-indigo-600">
                                <Pencil className="w-3 h-3" /> Editar márgenes
                            </Button>
                        )}
                    </div>

                    {/* Explicación visual de la cadena de precios */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <DollarSign className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-600 dark:text-slate-400">Costo</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                            <TrendingUp className="w-3 h-3 text-indigo-600" />
                            <span className="text-indigo-600">+{config.margenNegocio}% = Precio Mayorista</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                            <Store className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">+{margenRevendedorEfectivo}% = P. Reventa Recomendado</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500">PVP Mercado</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-card/40 border border-white/5 rounded-2xl h-12 p-1 mb-5 flex items-center gap-1">
                    <TabsTrigger value="precios" className="rounded-xl h-9 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <BarChart3 className="w-4 h-4 mr-2" /> Lista de Precios
                    </TabsTrigger>
                    <TabsTrigger value="clientes" className="rounded-xl h-9 px-4 font-black uppercase text-xs tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Users className="w-4 h-4 mr-2" /> Clientes ({clientes.length})
                    </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════════════
                    TAB 1: LISTA DE PRECIOS
                ══════════════════════════════════════════════════ */}
                <TabsContent value="precios" className="space-y-5 mt-0">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Productos viables', value: stats.excelentes + stats.viables, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', sub: 'Se pueden vender al mayor' },
                            { label: 'Excelentes', value: stats.excelentes, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-500/10', sub: 'Ganan todos bien' },
                            { label: 'Inviables', value: stats.inviables, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-500/10', sub: 'Sin margen suficiente' },
                            { label: 'Margen promedio', value: `${stats.promedioMargenNegocio.toFixed(1)}%`, icon: Percent, color: 'text-amber-600', bg: 'bg-amber-500/10', sub: 'Del negocio en mayoreo' },
                        ].map((k, i) => (
                            <Card key={i} className="rounded-2xl border-white/5 bg-card/30 backdrop-blur-md">
                                <CardContent className="p-4">
                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', k.bg, k.color)}>
                                        <k.icon className="w-4 h-4" />
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
                                    <p className="text-2xl font-black tracking-tighter text-foreground">{k.value}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">{k.sub}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filtros y cliente activo */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar producto..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setSoloViables(v => !v)}
                            className={cn('flex items-center gap-2 px-4 h-10 rounded-xl text-xs font-black uppercase tracking-widest border transition-all',
                                soloViables ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-emerald-300'
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Solo viables
                        </button>
                        {clienteSeleccionado && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200">
                                <Store className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-black text-indigo-700">{clienteSeleccionado.nombre}</span>
                                {clienteSeleccionado.margenPersonalizado && (
                                    <span className="text-[9px] text-indigo-500">({clienteSeleccionado.margenPersonalizado}%)</span>
                                )}
                                <button onClick={() => setClienteSeleccionado(null)} className="text-indigo-400 hover:text-indigo-600">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        {clientes.length > 0 && !clienteSeleccionado && (
                            <select
                                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold uppercase tracking-widest outline-none focus:border-indigo-400"
                                value=""
                                onChange={e => {
                                    const c = clientes.find(cl => cl.id === e.target.value);
                                    if (c) setClienteSeleccionado(c);
                                }}
                            >
                                <option value="">Ver precios para cliente...</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                    </div>

                    {/* Tabla de productos */}
                    {tablaDatos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No hay productos con costo definido</p>
                            <p className="text-xs text-muted-foreground mt-1">Agrega costos en el catálogo de Productos o registra precios de proveedores</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tablaDatos.map(d => {
                                const vConf = VIABILIDAD_CONFIG[d.viabilidad];
                                const VIcon = vConf.icon;
                                const isOpen = expandido === d.producto.id;

                                return (
                                    <Card key={d.producto.id} className={cn('rounded-2xl overflow-hidden border-l-4 transition-all', vConf.border)}>
                                        {/* Fila principal */}
                                        <div
                                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                            onClick={() => setExpandido(isOpen ? null : d.producto.id)}
                                        >
                                            {/* Nombre + badge viabilidad */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', vConf.bg, vConf.color)}>
                                                    <VIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{d.producto.nombre}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{d.producto.categoria}</p>
                                                </div>
                                            </div>

                                            {/* Precios clave */}
                                            <div className="flex flex-wrap items-center gap-3 sm:gap-6 shrink-0">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Costo</p>
                                                    <p className="text-xs font-black text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(d.costo)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500">Mayorista</p>
                                                    <p className="text-sm font-black text-indigo-600 tabular-nums">{formatCurrency(d.precioMayorista)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Reventa</p>
                                                    <p className="text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(d.precioReventa)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">PVP</p>
                                                    <p className="text-xs font-black text-slate-500 tabular-nums">{formatCurrency(d.pvp)}</p>
                                                </div>
                                                <Badge className={cn('text-[9px] font-black border-none', vConf.bg, vConf.color)}>
                                                    {vConf.label}
                                                </Badge>
                                                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                            </div>
                                        </div>

                                        {/* Detalle expandido */}
                                        {isOpen && (
                                            <div className={cn('p-4 pt-0 border-t border-slate-100 dark:border-slate-800 animate-ag-fade-in', vConf.bg)}>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                                                    <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-white/50">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Costo unitario</p>
                                                        <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(d.costo)}</p>
                                                        <p className="text-[8px] text-muted-foreground">Precio de producción</p>
                                                    </div>
                                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-1">Precio Mayorista</p>
                                                        <p className="text-base font-black text-indigo-700 dark:text-indigo-400 tabular-nums">{formatCurrency(d.precioMayorista)}</p>
                                                        <p className="text-[8px] text-indigo-500">Ganancia: {formatCurrency(d.gananciaPanaderiaPorUnidad)} ({d.margenPanaderiaReal.toFixed(1)}%)</p>
                                                    </div>
                                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-1">Reventa Sugerida</p>
                                                        <p className="text-base font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(d.precioReventa)}</p>
                                                        <p className="text-[8px] text-emerald-600">Ganancia cliente: {formatCurrency(d.gananciRevendedorPorUnidad)} ({d.margenRevendedorReal.toFixed(1)}%)</p>
                                                    </div>
                                                    <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-white/50">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">PVP del Mercado</p>
                                                        <p className="text-base font-black text-slate-700 dark:text-slate-400 tabular-nums">{formatCurrency(d.pvp)}</p>
                                                        <p className={cn('text-[8px] font-bold', d.reventaMenorQuePVP ? 'text-emerald-600' : 'text-amber-600')}>
                                                            {d.reventaMenorQuePVP ? '✓ Competitivo vs PVP' : '⚠ Cerca del PVP'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Mensaje de viabilidad */}
                                                <div className={cn('mt-3 flex items-start gap-2 p-3 rounded-xl', vConf.bg)}>
                                                    <Info className={cn('w-4 h-4 shrink-0 mt-0.5', vConf.color)} />
                                                    <p className={cn('text-xs font-bold', vConf.color)}>
                                                        {d.viabilidad === 'excelente' && `Perfecto para mayoreo: vendés a ${formatCurrency(d.precioMayorista)}, ganás ${formatCurrency(d.gananciaPanaderiaPorUnidad)}/ud. El cliente puede revender a ${formatCurrency(d.precioReventa)} y le queda ${formatCurrency(d.gananciRevendedorPorUnidad)}/ud.`}
                                                        {d.viabilidad === 'viable' && `Viable: la panadería gana ${formatCurrency(d.gananciaPanaderiaPorUnidad)}/ud. El precio de reventa ${d.reventaMenorQuePVP ? 'es competitivo' : 'supera el PVP — considerar bajar el margen del revendedor'}.`}
                                                        {d.viabilidad === 'ajustado' && `Margen ajustado: la panadería gana solo ${formatCurrency(d.gananciaPanaderiaPorUnidad)}/ud. El revendedor no tendría margen suficiente. Subir el precio mayorista o revisar el costo.`}
                                                        {d.viabilidad === 'inviable' && `No recomendado para mayoreo a este costo. El precio mayorista de ${formatCurrency(d.precioMayorista)} no genera ganancia para la panadería.`}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ══════════════════════════════════════════════════
                    TAB 2: CLIENTES MAYORISTAS
                ══════════════════════════════════════════════════ */}
                <TabsContent value="clientes" className="space-y-4 mt-0">
                    {clientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">Sin clientes mayoristas</p>
                            <p className="text-xs text-muted-foreground mt-1 mb-4">Agrega tiendas o vendedores independientes para gestionar sus precios</p>
                            <Button onClick={abrirNuevoCliente} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black gap-2">
                                <Plus className="w-3 h-3" /> Agregar primer cliente
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clientes.map(c => {
                                const tConf = TIPO_CONFIG[c.tipo];
                                return (
                                    <Card key={c.id} className="rounded-2xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all overflow-hidden">
                                        <div 
                                            className="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                            onClick={() => setExpandedClienteId(expandedClienteId === c.id ? null : c.id)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tConf.bg)}>
                                                        <Store className={cn('w-5 h-5', tConf.color)} />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm text-slate-900 dark:text-white">{c.nombre}</p>
                                                        <Badge className={cn('text-[8px] font-black border-none mt-0.5', tConf.bg, tConf.color)}>
                                                            {tConf.label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 items-center">
                                                    <button onClick={(e) => { e.stopPropagation(); abrirEditarCliente(c); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); eliminarCliente(c.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="w-8 h-8 ml-2 rounded-lg flex items-center justify-center text-slate-400">
                                                        {expandedClienteId === c.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {c.telefono && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Phone className="w-3 h-3" />
                                                        {c.telefono}
                                                    </div>
                                                )}
                                                {c.margenPersonalizado !== undefined && (
                                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                                        <Percent className="w-3 h-3" />
                                                        Margen personalizado: {c.margenPersonalizado}%
                                                    </div>
                                                )}
                                                {c.notas && (
                                                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                                        <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                                        <span className="line-clamp-2">{c.notas}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {expandedClienteId === c.id && (
                                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 animate-ag-fade-in flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    onClick={() => {
                                                        setClienteSeleccionado(c);
                                                        setViendoPerfilCliente(c);
                                                        setBusquedaPerfil('');
                                                        setCarritoPos([]);
                                                    }}
                                                    className="flex-1 h-10 text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                                                >
                                                    <ShoppingCart className="w-4 h-4" /> Mini-POS
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        if (onNavigateTo) onNavigateTo('creditos');
                                                    }}
                                                    variant="outline"
                                                    className="flex-1 h-10 text-xs font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-50 gap-2"
                                                >
                                                    <FileText className="w-4 h-4" /> Ver Cr\u00e9ditos
                                                </Button>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Modal: Nuevo / Editar Cliente ───────────────────────────── */}
            <Dialog open={showModalCliente} onOpenChange={setShowModalCliente}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">
                            {editandoCliente ? 'Editar Cliente' : 'Nuevo Cliente Mayorista'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest">Nombre *</Label>
                            <Input
                                value={formCliente.nombre || ''}
                                onChange={e => setFormCliente(f => ({ ...f, nombre: e.target.value }))}
                                placeholder="Ej: Tienda Don Carlos"
                                className="mt-1 rounded-xl"
                            />
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest">Tipo de cliente</Label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                {(['mayorista', 'detal', 'trabajador'] as const).map(tipo => {
                                    const tc = TIPO_CONFIG[tipo];
                                    const isSelected = (formCliente.tipo || 'mayorista') === tipo;
                                    return (
                                        <button
                                            key={tipo}
                                            type="button"
                                            onClick={() => setFormCliente(f => ({ ...f, tipo }))}
                                            className={cn(
                                                'h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all',
                                                isSelected
                                                    ? `${tc.bg} ${tc.color} border-current`
                                                    : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'
                                            )}
                                        >
                                            <Store className="w-4 h-4" />
                                            {tc.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                            <Input
                                value={formCliente.telefono || ''}
                                onChange={e => setFormCliente(f => ({ ...f, telefono: e.target.value }))}
                                placeholder="3001234567"
                                className="mt-1 rounded-xl"
                            />
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest">
                                Margen personalizado del revendedor % <span className="normal-case text-muted-foreground">(opcional, override del global)</span>
                            </Label>
                            <Input
                                type="number" min={0} max={200}
                                value={formCliente.margenPersonalizado ?? ''}
                                onChange={e => setFormCliente(f => ({ ...f, margenPersonalizado: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                placeholder={`Default: ${config.margenRevendedor}%`}
                                className="mt-1 rounded-xl"
                            />
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest">Notas</Label>
                            <Input
                                value={formCliente.notas || ''}
                                onChange={e => setFormCliente(f => ({ ...f, notas: e.target.value }))}
                                placeholder="Observaciones..."
                                className="mt-1 rounded-xl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowModalCliente(false)}>Cancelar</Button>
                        <Button onClick={handleGuardarCliente} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black">
                            {editandoCliente ? 'Guardar cambios' : 'Agregar cliente'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
