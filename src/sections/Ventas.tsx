import React, { useState, useMemo, useEffect } from 'react';
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    Trash2,
    CheckCircle,
    CreditCard,
    Banknote,
    Smartphone,
    History,
    Tag,
    Store,
    Lock,
    Unlock,
    AlertCircle,
    X,
    Printer,
    ChevronRight,
    LayoutGrid,
    Coffee,
    Users,
    StickyNote,
    MoreVertical,
    Package,
    User,
    DollarSign,
    TrendingUp,
    Clock,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PaymentProcessor } from '@/components/PaymentProcessor';
import type {
    Producto,
    InventarioItem,
    Venta,
    CajaSesion,
    MetodoPago,
    Categoria,
    Mesa,
    PedidoActivo
} from '@/types';

interface VentasProps {
    productos: Producto[];
    inventario: InventarioItem[];
    ventas: Venta[];
    cajaActiva: CajaSesion | undefined;
    onRegistrarVenta: (data: any) => Promise<Venta>;
    onAbrirCaja: (usuarioId: string, montoApertura: number) => Promise<CajaSesion>;
    onCerrarCaja: (montoCierre: number) => Promise<CajaSesion | undefined>;
    formatCurrency: (value: number) => string;
    usuario: any;
    categorias: Categoria[];
    mesas: Mesa[];
    pedidosActivos: PedidoActivo[];
    onUpdateMesa: (mesa: Mesa) => Promise<void>;
    onAddPedidoActivo: (pedido: PedidoActivo) => Promise<void>;
    onUpdatePedidoActivo: (pedido: PedidoActivo) => Promise<void>;
    onDeletePedidoActivo: (id: string) => Promise<void>;
}

export function Ventas({
    productos,
    inventario,
    ventas,
    cajaActiva,
    onRegistrarVenta,
    onAbrirCaja,
    onCerrarCaja,
    formatCurrency,
    usuario,
    categorias,
    mesas,
    pedidosActivos,
    onUpdateMesa,
    onAddPedidoActivo,
    onUpdatePedidoActivo,
    onDeletePedidoActivo
}: VentasProps) {
    // Estados de UI
    const [viewMode, setViewMode] = useState<'pos' | 'mesas'>('pos');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<{ producto: Producto; cantidad: number }[]>([]);
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [montoApertura, setMontoApertura] = useState<number>(0);
    const [montoCierre, setMontoCierre] = useState<number>(0);
    const [cliente, setCliente] = useState('');
    const [splitMode, setSplitMode] = useState(false);
    const [splitItems, setSplitItems] = useState<{ productId: string; cantidad: number }[]>([]); // Items marcados para cobrar
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [dineroRecibido, setDineroRecibido] = useState<number>(0);
    const [tipoTransaccion, setTipoTransaccion] = useState<'efectivo' | 'credito'>('efectivo');
    
    // Nuevas funcionalidades de Yimi
    const [showClientesModal, setShowClientesModal] = useState(false);
    const [showProductoCustomModal, setShowProductoCustomModal] = useState(false);
    const [showAccionesMenu, setShowAccionesMenu] = useState(false);
    const [showTurnoCajaPanel, setShowTurnoCajaPanel] = useState(false);
    const [clienteSearch, setClienteSearch] = useState('');
    const [productoCustomNombre, setProductoCustomNombre] = useState('');
    const [productoCustomPrecio, setProductoCustomPrecio] = useState<number>(0);
    const [depExtraModal, setDepExtraModal] = useState(false);
    const [retiroExtra, setRetiroExtra] = useState(false);
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [notasVenta, setNotasVenta] = useState('');
    const [clientesRecentesCache, setClientesRecentesCache] = useState<string[]>(['Cliente Frecuente', 'Empresa X', 'Merienda Local']);

    // Filtrar productos aptos para la venta
    const productosVenta = useMemo(() => {
        return productos.filter(p => {
            const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || p.categoria === selectedCategory;
            return matchesSearch && matchesCategory && p.precioVenta > 0;
        });
    }, [productos, searchTerm, selectedCategory]);

    const totalCart = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.producto.precioVenta * item.cantidad), 0);
    }, [cart]);

    // Handlers del Carrito
    const addToCart = (producto: Producto) => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de realizar ventas');
            setShowAperturaModal(true);
            return;
        }

        const itemInventario = inventario.find(i => i.productoId === producto.id);
        const stockActual = itemInventario?.stockActual || 0;

        setCart(prev => {
            const existing = prev.find(item => item.producto.id === producto.id);
            if (existing) {
                if (producto.tipo === 'ingrediente' && existing.cantidad >= stockActual) {
                    toast.warning(`Stock insuficiente para ${producto.nombre}`);
                    return prev;
                }
                return prev.map(item =>
                    item.producto.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            return [...prev, { producto, cantidad: 1 }];
        });
    };

    const updateQuantity = (productoId: string, delta: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.producto.id === productoId);
            if (!existing) return prev;

            const newQuantity = existing.cantidad + delta;
            if (newQuantity <= 0) return prev.filter(item => item.producto.id !== productoId);

            // Verificar stock
            if (delta > 0 && existing.producto.tipo === 'ingrediente') {
                const itemInv = inventario.find(i => i.productoId === productoId);
                if (itemInv && existing.cantidad >= itemInv.stockActual) {
                    toast.warning(`Límite de stock alcanzado`);
                    return prev;
                }
            }

            return prev.map(item =>
                item.producto.id === productoId ? { ...item, cantidad: newQuantity } : item
            );
        });
    };

    const removeFromCart = (productoId: string) => {
        setCart(prev => prev.filter(item => item.producto.id !== productoId));
    };

    // Handlers de Pedidos (Mesas)
    const handleSelectMesa = (mesa: Mesa) => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de gestionar mesas');
            setShowAperturaModal(true);
            return;
        }

        if (mesa.estado === 'disponible') {
            const nuevoPedido: PedidoActivo = {
                id: crypto.randomUUID(),
                mesaId: mesa.id,
                items: [],
                total: 0,
                estado: 'abierto',
                fechaInicio: new Date().toISOString(),
                ultimoCambio: new Date().toISOString()
            };
            onAddPedidoActivo(nuevoPedido).then(() => {
                onUpdateMesa({ ...mesa, estado: 'ocupada', pedidoActivoId: nuevoPedido.id });
                setCart([]);
                setCliente(`Mesa ${mesa.numero}`);
                setViewMode('pos');
                toast.success(`Mesa ${mesa.numero} abierta`);
            });
        } else {
            const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
            if (pedido) {
                const cartItems = pedido.items.map(item => {
                    const prod = productos.find(p => p.id === item.productoId);
                    return prod ? { producto: prod, cantidad: item.cantidad } : null;
                }).filter(Boolean) as { producto: Producto; cantidad: number }[];

                setCart(cartItems);
                setCliente(pedido.cliente || `Mesa ${mesa.numero}`);
                setViewMode('pos');
            }
        }
    };

    const handleGuardarEnMesa = async () => {
        const mesa = mesas.find(m => `Mesa ${m.numero}` === cliente);
        if (!mesa) {
            toast.info('Para guardar en mesa, selecciona una del Muro de Pedidos');
            setViewMode('mesas');
            return;
        }

        const pedidoExistente = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
        if (pedidoExistente) {
            const updatedPedido: PedidoActivo = {
                ...pedidoExistente,
                items: cart.map(item => ({
                    id: crypto.randomUUID(),
                    productoId: item.producto.id,
                    cantidad: item.cantidad,
                    precioUnitario: item.producto.precioVenta,
                    subtotal: item.producto.precioVenta * item.cantidad
                })),
                total: totalCart,
                ultimoCambio: new Date().toISOString()
            };
            await onUpdatePedidoActivo(updatedPedido);
            toast.success('Pedido actualizado en mesa');
            setCart([]);
            setCliente('');
            setViewMode('mesas');
        }
    };

    const handleFinalizarVenta = async (itemsToPay = cart) => {
        if (itemsToPay.length === 0) return;
        if (!cajaActiva) {
            toast.error('La caja no está abierta');
            setShowAperturaModal(true);
            return;
        }

        try {
            setIsProcessing(true);
            const totalToPay = itemsToPay.reduce((sum, item) => sum + (item.producto.precioVenta * item.cantidad), 0);

            const ventaData = {
                items: itemsToPay.map(item => ({
                    productoId: item.producto.id,
                    cantidad: item.cantidad,
                    precioUnitario: item.producto.precioVenta,
                    subtotal: item.producto.precioVenta * item.cantidad
                })),
                metodoPago: tipoTransaccion === 'credito' ? 'credito' : metodoPago,
                cliente,
                usuarioId: usuario.id,
                tipoTransaccion: tipoTransaccion,
                dineroRecibido: tipoTransaccion === 'credito' ? totalToPay : dineroRecibido,
                vueltas: tipoTransaccion === 'credito' ? 0 : (dineroRecibido - totalToPay),
                notas: `Venta POS - ${new Date().toLocaleTimeString()} - ${tipoTransaccion === 'credito' ? 'CRÉDITO' : 'EFECTIVO'}${splitMode ? ' (Pago Parcial)' : ''}`
            };

            await onRegistrarVenta(ventaData);

            toast.success('Venta registrada con éxito', {
                description: `Venta cobrada: ${formatCurrency(totalToPay)}`,
                icon: <CheckCircle className="w-5 h-5 text-emerald-500" />
            });

            // Lógica de Mesa y Split
            if (cliente.startsWith('Mesa ')) {
                const mesaNum = cliente.replace('Mesa ', '');
                const mesa = mesas.find(m => m.numero === mesaNum);

                if (mesa && mesa.pedidoActivoId) {
                    const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
                    if (pedido) {
                        // Restar cantidades cobradas de los items del pedido
                        const newItems = pedido.items.map(pi => {
                            const paidItem = itemsToPay.find(pay => pay.producto.id === pi.productoId);
                            if (paidItem) {
                                const newCant = pi.cantidad - paidItem.cantidad;
                                return newCant > 0 ? { ...pi, cantidad: newCant, subtotal: newCant * pi.precioUnitario } : null;
                            }
                            return pi;
                        }).filter(Boolean) as VentaItem[];

                        if (newItems.length === 0) {
                            await onDeletePedidoActivo(pedido.id);
                            await onUpdateMesa({ ...mesa, estado: 'disponible', pedidoActivoId: undefined });
                            setViewMode('mesas');
                            setCart([]);
                            setCliente('');
                        } else {
                            const newTotal = newItems.reduce((s, i) => s + i.subtotal, 0);
                            await onUpdatePedidoActivo({
                                ...pedido,
                                items: newItems,
                                total: newTotal,
                                ultimoCambio: new Date().toISOString()
                            });
                            // Actualizar carrito local con remanente
                            const updatedCartItems = newItems.map(ni => {
                                const prod = productos.find(p => p.id === ni.productoId);
                                return prod ? { producto: prod, cantidad: ni.cantidad } : null;
                            }).filter(Boolean) as { producto: Producto; cantidad: number }[];
                            setCart(updatedCartItems);
                        }
                    }
                }
            } else {
                if (splitItems.length > 0) { // If splitMode is active for non-table sales
                    const remainingCart = cart.map(item => {
                        const paid = itemsToPay.find(p => p.producto.id === item.producto.id);
                        if (paid) {
                            const newC = item.cantidad - paid.cantidad;
                            return newC > 0 ? { ...item, cantidad: newC } : null;
                        }
                        return item;
                    }).filter(Boolean) as { producto: Producto; cantidad: number }[];
                    setCart(remainingCart);
                } else {
                    setCart([]);
                    setCliente('');
                }
            }

            setSplitItems([]);
            setSearchTerm(''); // Clear search term after sale
        } catch (error) {
            console.error('Error al registrar venta:', error);
            toast.error('Error al procesar la venta');
        } finally {
            setIsProcessing(false);
        }
    };

    const updateSplitQuantity = (productoId: string, delta: number) => {
        setSplitItems(prev => {
            const existing = prev.find(i => i.productId === productoId);
            const cartItem = cart.find(i => i.producto.id === productoId);
            if (!cartItem) return prev;

            if (existing) {
                const newCant = Math.max(0, Math.min(cartItem.cantidad, existing.cantidad + delta));
                if (newCant === 0) return prev.filter(i => i.productId !== productoId);
                return prev.map(i => i.productId === productoId ? { ...i, cantidad: newCant } : i);
            } else if (delta > 0) {
                return [...prev, { productId: productoId, cantidad: 1 }];
            }
            return prev;
        });
    };

    const handlePaySplit = () => {
        const itemsToPay = splitItems.map(si => {
            const prod = productos.find(p => p.id === si.productId);
            return prod ? { producto: prod, cantidad: si.cantidad } : null;
        }).filter(Boolean) as { producto: Producto; cantidad: number }[];

        if (itemsToPay.length === 0) {
            toast.info('Selecciona qué cobrar de esta mesa');
            return;
        }
        handleFinalizarVenta(itemsToPay);
    };

    const handleAbrirCaja = async () => {
        try {
            await onAbrirCaja(usuario.id, montoApertura);
            toast.success('Caja abierta correctamente');
            setShowAperturaModal(false);
        } catch (error) {
            toast.error('Error al abrir caja');
        }
    };

    const handleCerrarCaja = async () => {
        try {
            await onCerrarCaja(montoCierre);
            toast.success('Caja cerrada con éxito');
            setShowCierreModal(false);
        } catch (error) {
            toast.error('Error al cerrar caja');
        }
    };

    // Inicializar mesas si no hay
    useEffect(() => {
        if (loadedDefaultMesas.current) return;
        if (mesas.length === 0) {
            const defaultMesas: Mesa[] = [
                { id: 'm1', numero: '1', capacidad: 4, estado: 'disponible' },
                { id: 'm2', numero: '2', capacidad: 2, estado: 'disponible' },
                { id: 'm3', numero: '3', capacidad: 4, estado: 'disponible' },
                { id: 'm4', numero: '4', capacidad: 6, estado: 'disponible' },
                { id: 'm5', numero: '5', capacidad: 2, estado: 'disponible' },
                { id: 'm6', numero: '6', capacidad: 4, estado: 'disponible' },
            ];
            Promise.all(defaultMesas.map(m => onUpdateMesa(m)));
            loadedDefaultMesas.current = true;
        }
    }, [mesas.length, onUpdateMesa]);

    const loadedDefaultMesas = React.useRef(false);

    return (
        <div className="space-y-6 h-full flex flex-col animate-ag-fade-in">
            {/* Header / Selector de Vista */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 bg-muted/30 p-1.5 rounded-2xl w-fit">
                    <Button
                        variant={viewMode === 'pos' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('pos')}
                        className={cn(
                            "rounded-xl gap-2 transition-all duration-300",
                            viewMode === 'pos' && "shadow-lg shadow-violet-500/20 bg-indigo-600 text-white"
                        )}
                    >
                        <Coffee className="w-4 h-4" />
                        Venta Rápida
                    </Button>
                    <Button
                        variant={viewMode === 'mesas' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('mesas')}
                        className={cn(
                            "rounded-xl gap-2 transition-all duration-300",
                            viewMode === 'mesas' && "shadow-lg shadow-[#ff007f]/20 bg-[#ff007f] text-white"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Muro de Pedidos
                    </Button>
                </div>

                <div className="flex gap-2">
                    {!cajaActiva ? (
                        <Button
                            onClick={() => setShowAperturaModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold shadow-lg shadow-emerald-500/20"
                        >
                            <Unlock className="w-4 h-4" />
                            Abrir Caja
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowCierreModal(true)}
                            className="border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl gap-2 font-bold"
                        >
                            <Lock className="w-4 h-4" />
                            Cerrar Caja ({formatCurrency(cajaActiva.totalVentas)})
                        </Button>
                    )}
                </div>
            </div>

            {/* Contenido Principal */}
            {viewMode === 'mesas' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {mesas.map(mesa => {
                        const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
                        return (
                            <Card
                                key={mesa.id}
                                className={cn(
                                    "cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-none overflow-hidden group",
                                    mesa.estado === 'disponible'
                                        ? "bg-card/50 hover:bg-card shadow-sm hover:shadow-md"
                                        : "bg-gradient-to-br from-violet-600 to-indigo-700 shadow-xl shadow-violet-500/30"
                                )}
                                onClick={() => handleSelectMesa(mesa)}
                            >
                                <CardContent className="p-6 text-center relative">
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:rotate-12",
                                        mesa.estado === 'disponible' ? "bg-muted text-muted-foreground" : "bg-white/20 text-white"
                                    )}>
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <h3 className={cn(
                                        "font-black text-xl mb-1",
                                        mesa.estado === 'disponible' ? "text-foreground" : "text-white"
                                    )}>Mesa {mesa.numero}</h3>
                                    <p className={cn(
                                        "text-[10px] font-black uppercase tracking-widest",
                                        mesa.estado === 'disponible' ? "text-muted-foreground/60" : "text-white/60"
                                    )}>
                                        {mesa.estado === 'disponible' ? `Libre • ${mesa.capacidad}p` : `Ocupada • ${formatCurrency(pedido?.total || 0)}`}
                                    </p>
                                    {pedido && (
                                        <div className="mt-4 flex flex-wrap justify-center gap-1">
                                            <Badge variant="secondary" className="bg-white/10 text-white border-none text-[8px] uppercase font-black">
                                                {pedido.items.length} items
                                            </Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Catálogo */}
                    <Card className="lg:col-span-2 flex flex-col border-none bg-card/40 backdrop-blur-md overflow-hidden rounded-3xl shadow-lg border border-white/10">
                        <CardHeader className="pb-2 bg-muted/20">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-72 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                                    <Input
                                        placeholder="Buscar delicias..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-background/50 border-border/40 focus:border-indigo-500 transition-all rounded-xl h-10 shadow-inner"
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar scroll-smooth">
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all min-w-[80px]",
                                            !selectedCategory
                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                                                : "bg-background/80 text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        <LayoutGrid className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Todos</span>
                                    </button>
                                    {categorias.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.nombre)}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all min-w-[80px] border border-transparent",
                                                selectedCategory === cat.nombre
                                                    ? "text-white shadow-lg scale-105"
                                                    : "bg-background/80 text-muted-foreground hover:bg-muted"
                                            )}
                                            style={{
                                                backgroundColor: selectedCategory === cat.nombre ? cat.color : undefined,
                                                boxShadow: selectedCategory === cat.nombre ? `0 8px 16px ${cat.color}40` : 'none',
                                                borderColor: selectedCategory !== cat.nombre ? `${cat.color}20` : 'transparent'
                                            }}
                                        >
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                {cat.nombre.toLowerCase().includes('cafe') || cat.nombre.toLowerCase().includes('bebida') ? <Coffee className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-tighter truncate w-full text-center">{cat.nombre}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1 pb-10">
                                    {productosVenta.map(producto => {
                                        const itemInv = inventario.find(i => i.productoId === producto.id);
                                        const stock = itemInv?.stockActual || 0;

                                        return (
                                            <div
                                                key={producto.id}
                                                className="group relative bg-card/60 backdrop-blur-sm border border-white/10 rounded-[2rem] p-3 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 hover:-translate-y-1 active:scale-95"
                                                onClick={() => addToCart(producto)}
                                            >
                                                <div className="aspect-square bg-muted/20 rounded-[1.5rem] overflow-hidden relative mb-3">
                                                    {producto.imagen ? (
                                                        <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/5 to-violet-500/5">
                                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                                <Tag className="w-6 h-6 text-indigo-500/40" />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                                                        <Badge className={cn(
                                                            "text-[8px] px-2 py-0.5 font-black uppercase rounded-full backdrop-blur-md border-none",
                                                            stock < 5 ? "bg-red-500/80 text-white" : "bg-emerald-500/80 text-white"
                                                        )}>
                                                            {stock} disp.
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 px-1 text-center">
                                                    <h4 className="font-black text-[11px] leading-tight truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{producto.nombre}</h4>
                                                    <p className="text-indigo-600 font-extrabold text-sm drop-shadow-sm">{formatCurrency(producto.precioVenta)}</p>
                                                </div>
                                                <div className="absolute bottom-2 right-4 opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/40">
                                                        <Plus className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Carrito */}
                    <Card className="flex flex-col border-none bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl relative">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-900 text-white rounded-t-3xl">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-[#ff007f]" />
                                <span className="font-black text-sm uppercase tracking-widest italic">Detalle Venta</span>
                            </div>
                            <Badge variant="secondary" className="bg-[#ff007f] text-white border-none rounded-xl px-2 font-black italic">{cart.length}</Badge>
                        </CardHeader>

                        <CardContent className="flex-1 overflow-hidden px-4 pt-6">
                            <div className="space-y-4 mb-6">
                                <div className="relative group">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-[#ff007f] transition-colors" />
                                    <Input
                                        placeholder="Nombre cliente / Mesa..."
                                        value={cliente}
                                        onChange={(e) => setCliente(e.target.value)}
                                        className="pl-9 bg-muted/40 border-none focus:ring-1 focus:ring-[#ff007f] rounded-xl h-10 font-bold"
                                    />
                                </div>
                            </div>

                            <ScrollArea className="h-[calc(100vh-580px)] md:h-[calc(100vh-500px)]">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-30 grayscale">
                                        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 rotate-6">
                                            <ShoppingCart className="w-8 h-8" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Carrito Vacío</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pr-2">
                                        {cart.map(item => {
                                            const splitItem = splitItems.find(si => si.productId === item.producto.id);
                                            const isSelectedInSplit = !!splitItem;

                                            return (
                                                <div
                                                    key={item.producto.id}
                                                    className={cn(
                                                        "group flex flex-col p-3 rounded-2xl transition-all border",
                                                        splitMode
                                                            ? isSelectedInSplit
                                                                ? "bg-indigo-50 border-indigo-500/50 shadow-md"
                                                                : "bg-muted/10 border-transparent opacity-60"
                                                            : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-indigo-500/10"
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black uppercase leading-tight truncate group-hover:text-indigo-600 transition-colors">
                                                                {item.producto.nombre}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.producto.precioVenta)}</p>
                                                        </div>
                                                        <span className="text-sm font-black text-foreground tabular-nums opacity-80">{formatCurrency(item.producto.precioVenta * item.cantidad)}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        {splitMode ? (
                                                            <div className="flex items-center bg-white/50 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-indigo-200/50 w-full justify-between">
                                                                <span className="text-[9px] font-black uppercase text-indigo-600 ml-2 tracking-tighter">Cobrar parte:</span>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="w-7 h-7 rounded-lg hover:bg-indigo-100 text-indigo-600"
                                                                        onClick={() => updateSplitQuantity(item.producto.id, -1)}
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </Button>
                                                                    <span className="w-6 text-center font-black text-xs text-indigo-700">{splitItem?.cantidad || 0}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="w-7 h-7 rounded-lg hover:bg-indigo-100 text-indigo-600"
                                                                        onClick={() => updateSplitQuantity(item.producto.id, 1)}
                                                                    >
                                                                        <Plus className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center bg-background p-1 rounded-xl shadow-sm border border-border/10">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="w-7 h-7 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 shadow-none border-none"
                                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.producto.id, -1); }}
                                                                    >
                                                                        <Minus className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <span className="w-8 text-center font-black text-xs">{item.cantidad}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="w-7 h-7 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 shadow-none border-none"
                                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.producto.id, 1); }}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="w-8 h-8 text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 rounded-lg group-hover:opacity-100 transition-opacity"
                                                                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.producto.id); }}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-4 p-6 pt-4 bg-gradient-to-t from-muted/30 to-transparent border-t border-border/40">
                            {/* Acciones Rápidas */}
                            <div className="grid grid-cols-4 gap-2 w-full">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-[9px] font-black uppercase rounded-xl hover:bg-indigo-50 border-indigo-200/50 gap-1"
                                    onClick={() => setShowClientesModal(true)}
                                >
                                    <User className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Cliente</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-[9px] font-black uppercase rounded-xl hover:bg-amber-50 border-amber-200/50 gap-1"
                                    onClick={() => setShowProductoCustomModal(true)}
                                >
                                    <Package className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Producto</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-[9px] font-black uppercase rounded-xl hover:bg-purple-50 border-purple-200/50 gap-1 relative group"
                                    onClick={() => setShowAccionesMenu(!showAccionesMenu)}
                                >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Acciones</span>
                                    {showAccionesMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden animate-ag-pop-in">
                                            <Button variant="ghost" className="w-full justify-start text-left h-10 text-xs font-bold hover:bg-slate-100 rounded-none gap-2">
                                                <Lock className="w-3 h-3" /> Cambiar Mesa
                                            </Button>
                                            <Button variant="ghost" className="w-full justify-start text-left h-10 text-xs font-bold hover:bg-slate-100 rounded-none gap-2">
                                                <Tag className="w-3 h-3" /> Tipo Pedido
                                            </Button>
                                            <Button variant="ghost" className="w-full justify-start text-left h-10 text-xs font-bold hover:bg-slate-100 rounded-none gap-2">
                                                <Printer className="w-3 h-3" /> Imprimir
                                            </Button>
                                            <Button variant="ghost" className="w-full justify-start text-left h-10 text-xs font-bold hover:bg-red-50 text-red-600 rounded-none gap-2">
                                                <Trash2 className="w-3 h-3" /> Eliminar
                                            </Button>
                                            <Button variant="ghost" className="w-full justify-start text-left h-10 text-xs font-bold hover:bg-orange-50 text-orange-600 rounded-none gap-2">
                                                <AlertCircle className="w-3 h-3" /> Sin Impuestos
                                            </Button>
                                        </div>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-[9px] font-black uppercase rounded-xl hover:bg-emerald-50 border-emerald-200/50 gap-1"
                                    onClick={() => setShowTurnoCajaPanel(!showTurnoCajaPanel)}
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Turno</span>
                                </Button>
                            </div>

                            {/* Panel Turno de Caja */}
                            {showTurnoCajaPanel && cajaActiva && (
                                <div className="w-full bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200/30 animate-ag-pop-in">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-white rounded-lg p-3 border border-emerald-100/50 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-emerald-700/60 tracking-widest mb-1">Inicial</p>
                                            <p className="text-lg font-black text-emerald-700">{formatCurrency(cajaActiva.montoApertura)}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-blue-100/50 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-blue-700/60 tracking-widest mb-1">Ventas</p>
                                            <p className="text-lg font-black text-blue-700">{formatCurrency(cajaActiva.totalVentas)}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-orange-100/50 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-orange-700/60 tracking-widest mb-1">Depósitos</p>
                                            <p className="text-lg font-black text-orange-700">{formatCurrency(cajaActiva.depositos || 0)}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-red-100/50 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-red-700/60 tracking-widest mb-1">Retiros</p>
                                            <p className="text-lg font-black text-red-700">{formatCurrency(cajaActiva.retiros || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 text-[9px] font-black uppercase rounded-lg hover:bg-orange-50 border-orange-200 gap-1"
                                            onClick={() => setDepExtraModal(true)}
                                        >
                                            <ArrowDownLeft className="w-3.5 h-3.5" />
                                            Depósito
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 text-[9px] font-black uppercase rounded-lg hover:bg-red-50 border-red-200 text-red-600 gap-1"
                                            onClick={() => setRetiroExtra(true)}
                                        >
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                            Retiro
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="w-full space-y-4">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Método de Pago</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant={tipoTransaccion === 'efectivo' ? 'default' : 'outline'}
                                            className={cn(
                                                "h-12 gap-2 rounded-xl border-none shadow-sm font-bold uppercase italic tracking-wider transition-all",
                                                tipoTransaccion === 'efectivo'
                                                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-105"
                                                    : "bg-background hover:bg-muted"
                                            )}
                                            onClick={() => setTipoTransaccion('efectivo')}
                                        >
                                            <Banknote className="w-5 h-5" />
                                            <span className="text-xs">Efectivo</span>
                                        </Button>
                                        <Button
                                            variant={tipoTransaccion === 'credito' ? 'default' : 'outline'}
                                            className={cn(
                                                "h-12 gap-2 rounded-xl border-none shadow-sm font-bold uppercase italic tracking-wider transition-all",
                                                tipoTransaccion === 'credito'
                                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 scale-105"
                                                    : "bg-background hover:bg-muted"
                                            )}
                                            onClick={() => setTipoTransaccion('credito')}
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            <span className="text-xs">Crédito</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-border/20">
                                    <div className="flex items-center justify-between bp-3 bg-muted/30 rounded-xl p-4">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                                            Subtotal
                                        </span>
                                        <span className="text-lg font-black text-foreground">{formatCurrency(totalCart)}</span>
                                    </div>

                                    <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-2xl p-4 border border-indigo-200/30">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-black uppercase italic tracking-[0.15em] text-foreground/60">
                                                Total a Pagar
                                            </span>
                                            <span className="text-4xl font-black text-indigo-600 tabular-nums drop-shadow-sm">
                                                {formatCurrency(splitMode ? splitItems.reduce((s, i) => s + ((productos.find(p => p.id === i.productId)?.precioVenta || 0) * i.cantidad), 0) : totalCart)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {splitMode ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="h-12 font-black uppercase italic tracking-[0.1em] text-[11px] gap-2 rounded-xl transition-all border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => { setSplitMode(false); setSplitItems([]); }}
                                            >
                                                <X className="w-4 h-4" />
                                                Cancelar
                                            </Button>
                                            <Button
                                                className="h-12 font-black uppercase italic tracking-[0.1em] text-[11px] gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20"
                                                onClick={handlePaySplit}
                                                disabled={splitItems.length === 0 || isProcessing}
                                            >
                                                {isProcessing ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Cobrar Parte'}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-2 col-span-1">
                                                <Button
                                                    variant="outline"
                                                    className="h-12 font-black uppercase italic tracking-[0.1em] text-[9px] gap-1.5 rounded-xl hover:bg-indigo-50 border-indigo-200"
                                                    onClick={handleGuardarEnMesa}
                                                    disabled={cart.length === 0}
                                                >
                                                    <StickyNote className="w-3.5 h-3.5" />
                                                    Guardar
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-12 font-black uppercase italic tracking-[0.1em] text-[9px] gap-1.5 rounded-xl hover:bg-emerald-50 border-emerald-200 text-emerald-700"
                                                    onClick={() => { setSplitMode(true); setSplitItems([]); }}
                                                    disabled={cart.length === 0}
                                                >
                                                    <Users className="w-3.5 h-3.5" />
                                                    Dividir
                                                </Button>
                                            </div>
                                            <Button
                                                className={cn(
                                                    "h-12 font-black uppercase italic tracking-[0.1em] text-[11px] gap-2 rounded-xl text-white shadow-xl col-span-1 transition-all",
                                                    tipoTransaccion === 'credito'
                                                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/20"
                                                        : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20"
                                                )}
                                                onClick={() => {
                                                    if (tipoTransaccion === 'credito') {
                                                        handleFinalizarVenta();
                                                    } else {
                                                        setShowPagoModal(true);
                                                        setDineroRecibido(0);
                                                    }
                                                }}
                                                disabled={cart.length === 0 || isProcessing || !cajaActiva}
                                            >
                                                {isProcessing ? (
                                                    <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Banknote className="w-5 h-5" />
                                                        {tipoTransaccion === 'credito' ? 'Registrar Crédito' : 'Pagar'}
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Modal de Pago Mejorado */}
            {showPagoModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-gradient-to-b from-card to-card/80 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="text-center pb-2 bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-8">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <Banknote className="w-10 h-10 text-emerald-400" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Confirmar Pago</CardTitle>
                            <p className="text-emerald-100/60 text-xs font-bold uppercase tracking-widest mt-1">Efectivo en caja</p>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            {/* Total a Pagar */}
                            <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-200/30">
                                <p className="text-xs font-black uppercase text-emerald-700/60 tracking-widest mb-2">Total a Pagar</p>
                                <p className="text-5xl font-black text-emerald-600 tabular-nums">{formatCurrency(totalCart)}</p>
                            </div>

                            {/* Dinero Recibido */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Dinero Recibido</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-2xl group-focus-within:scale-125 transition-transform">$</div>
                                    <Input
                                        type="number"
                                        value={dineroRecibido}
                                        onChange={(e) => setDineroRecibido(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="pl-12 h-20 text-4xl font-black bg-emerald-50/30 border-emerald-200 focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-2xl shadow-inner text-emerald-700"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Cálculo de Vueltas */}
                            <div className="space-y-4 bg-slate-50/30 rounded-2xl p-5 border border-slate-200/30">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200/50">
                                    <span className="text-xs font-bold uppercase text-slate-600 tracking-widest">Desglose de Pago</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 font-semibold">Monto Solicitado</span>
                                    <span className="text-xl font-black text-slate-800">{formatCurrency(totalCart)}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 font-semibold">Dinero Entregado</span>
                                    <span className="text-xl font-black text-emerald-700">{formatCurrency(dineroRecibido)}</span>
                                </div>

                                <div className={cn(
                                    "flex items-center justify-between pt-3 border-t-2 transition-all",
                                    dineroRecibido >= totalCart
                                        ? "border-emerald-200/50"
                                        : "border-red-200/50"
                                )}>
                                    <span className={cn(
                                        "text-sm font-black uppercase tracking-widest",
                                        dineroRecibido >= totalCart
                                            ? "text-emerald-700"
                                            : "text-red-700"
                                    )}>
                                        {dineroRecibido >= totalCart ? '✓ Vueltas a Dar' : '⚠ Falta Dinero'}
                                    </span>
                                    <span className={cn(
                                        "text-2xl font-black tabular-nums",
                                        dineroRecibido >= totalCart
                                            ? "text-emerald-600"
                                            : "text-red-600"
                                    )}>
                                        {formatCurrency(Math.abs(dineroRecibido - totalCart))}
                                    </span>
                                </div>
                            </div>

                            {/* Estado de Pago */}
                            {dineroRecibido < totalCart && (
                                <div className="bg-red-500/10 rounded-xl p-4 border border-red-200/30 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase text-red-700 tracking-widest mb-1">Dinero insuficiente</p>
                                        <p className="text-xs text-red-600">Falta {formatCurrency(totalCart - dineroRecibido)} para completar el pago</p>
                                    </div>
                                </div>
                            )}

                            {/* Botones de Acción */}
                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    className={cn(
                                        "w-full h-14 font-black uppercase italic tracking-wider rounded-2xl shadow-lg transition-all",
                                        dineroRecibido >= totalCart
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                                            : "bg-slate-300 text-slate-600 cursor-not-allowed"
                                    )}
                                    onClick={() => {
                                        if (dineroRecibido >= totalCart) {
                                            handleFinalizarVenta();
                                            setShowPagoModal(false);
                                        }
                                    }}
                                    disabled={dineroRecibido < totalCart || isProcessing}
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Confirmar Pago
                                        </>
                                    )}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-12 font-bold text-slate-600 rounded-xl" 
                                    onClick={() => setShowPagoModal(false)}
                                    disabled={isProcessing}
                                >
                                    Volver
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Apertura */}
            {showAperturaModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="text-center pb-2 bg-slate-900 text-white p-8">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 rotate-6">
                                <Unlock className="w-10 h-10 text-emerald-500" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Apertura de Caja</CardTitle>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Inicia la jornada operativa</p>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Monto inicial en caja</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-500 text-xl group-focus-within:scale-110 transition-transform">$</div>
                                    <Input
                                        type="number"
                                        value={montoApertura}
                                        onChange={(e) => setMontoApertura(Number(e.target.value))}
                                        className="pl-10 h-16 text-2xl font-black bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-2xl shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase italic tracking-wider rounded-2xl shadow-lg shadow-emerald-500/20" onClick={handleAbrirCaja}>Sincronizar Apertura</Button>
                                <Button variant="ghost" className="w-full font-bold text-muted-foreground" onClick={() => setShowAperturaModal(false)}>Cancelar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {showCierreModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="text-center pb-2 bg-red-950 text-white p-8">
                            <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 -rotate-6">
                                <Lock className="w-10 h-10 text-red-500" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Arqueo de Cierre</CardTitle>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Finaliza la jornada y cuadra caja</p>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            {cajaActiva && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Ventas</p>
                                        <p className="text-lg font-black tabular-nums">{formatCurrency(cajaActiva.totalVentas)}</p>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Fondo Base</p>
                                        <p className="text-lg font-black tabular-nums">{formatCurrency(cajaActiva.montoApertura)}</p>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Dinero físico contado</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-red-500 text-xl">$</div>
                                    <Input
                                        type="number"
                                        value={montoCierre}
                                        onChange={(e) => setMontoCierre(Number(e.target.value))}
                                        className="pl-10 h-16 text-2xl font-black bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-red-500 rounded-2xl shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-wider rounded-2xl shadow-lg shadow-red-500/20" onClick={handleCerrarCaja}>Finalizar Jornada</Button>
                                <Button variant="ghost" className="w-full font-bold text-muted-foreground" onClick={() => setShowCierreModal(false)}>Volver a Ventas</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal de Clientes */}
            {showClientesModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="pb-6 bg-gradient-to-r from-indigo-900 to-violet-900 text-white p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                                    <User className="w-8 h-8 text-indigo-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase italic">Clientes</CardTitle>
                                    <p className="text-indigo-100/60 text-xs font-bold">Selecciona o agrega</p>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300/50" />
                                <Input
                                    placeholder="Buscar cliente..."
                                    value={clienteSearch}
                                    onChange={(e) => setClienteSearch(e.target.value)}
                                    className="pl-9 bg-indigo-500/20 border-indigo-300/30 text-white placeholder:text-indigo-200/40 rounded-xl h-10"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-3 max-h-80 overflow-y-auto">
                            <div className="space-y-2">
                                {['Cliente Frecuente', 'Empresa X', 'Merienda Local', 'Otro...'].map((c) => (
                                    <Button
                                        key={c}
                                        variant="ghost"
                                        className="w-full justify-start h-12 hover:bg-indigo-50 text-left font-bold rounded-xl group border border-indigo-100/20"
                                        onClick={() => {
                                            setCliente(c);
                                            setShowClientesModal(false);
                                            toast.success(`Cliente: ${c}`);
                                        }}
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-indigo-200 transition">
                                            <span className="text-indigo-700 font-black text-sm">{c.charAt(0)}</span>
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">{c}</p>
                                            <p className="text-[10px] text-muted-foreground">Seleccionar</p>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="border-t p-4 gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowClientesModal(false)}>Cancelar</Button>
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl" onClick={() => setShowClientesModal(false)}>Confirmar</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Modal Producto Sin Registrar */}
            {showProductoCustomModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="pb-6 bg-gradient-to-r from-amber-900 to-orange-900 text-white p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                                    <Package className="w-8 h-8 text-amber-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase italic">Vender Producto Nuevo</CardTitle>
                                    <p className="text-amber-100/60 text-xs font-bold">Rápido sin stock</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Nombre del producto</label>
                                <Input
                                    placeholder="Ej: Café Premium"
                                    value={productoCustomNombre}
                                    onChange={(e) => setProductoCustomNombre(e.target.value)}
                                    className="h-12 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded-xl"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Precio</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-amber-600">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={productoCustomPrecio}
                                        onChange={(e) => setProductoCustomPrecio(Number(e.target.value))}
                                        className="pl-10 h-12 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded-xl text-lg font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase rounded-xl"
                                    onClick={() => {
                                        if (productoCustomNombre && productoCustomPrecio > 0) {
                                            const customProducto: Producto = {
                                                id: `custom-${Date.now()}`,
                                                nombre: productoCustomNombre,
                                                precioVenta: productoCustomPrecio,
                                                precioCompra: 0,
                                                categoria: 'Otros',
                                                tipo: 'servicio',
                                                descripcion: 'Producto creado en punto de venta'
                                            };
                                            addToCart(customProducto);
                                            setProductoCustomNombre('');
                                            setProductoCustomPrecio(0);
                                            setShowProductoCustomModal(false);
                                            toast.success(`${productoCustomNombre} añadido al carrito`);
                                        } else {
                                            toast.error('Completa nombre y precio');
                                        }
                                    }}
                                >
                                    Agregar al Carrito
                                </Button>
                                <Button variant="ghost" onClick={() => setShowProductoCustomModal(false)}>Cancelar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Depósito Extra */}
            {depExtraModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="pb-6 bg-gradient-to-r from-green-900 to-emerald-900 text-white p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                                    <ArrowDownLeft className="w-8 h-8 text-green-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase italic">Depósito</CardTitle>
                                    <p className="text-green-100/60 text-xs font-bold">Dinero ingresa a caja</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Monto a depositar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-green-600">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="pl-10 h-12 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-green-500 rounded-xl text-lg font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-black uppercase rounded-xl"
                                    onClick={() => {
                                        toast.success('Depósito registrado');
                                        setDepExtraModal(false);
                                    }}
                                >
                                    Confirmar Depósito
                                </Button>
                                <Button variant="ghost" onClick={() => setDepExtraModal(false)}>Cancelar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Retiro Extra */}
            {retiroExtra && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-ag-fade-in">
                    <Card className="w-full max-w-md bg-card/90 border-none shadow-2xl rounded-3xl animate-ag-pop-in overflow-hidden border border-white/5">
                        <CardHeader className="pb-6 bg-gradient-to-r from-red-900 to-orange-900 text-white p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center">
                                    <ArrowUpRight className="w-8 h-8 text-red-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase italic">Retiro</CardTitle>
                                    <p className="text-red-100/60 text-xs font-bold">Dinero sale de caja</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Monto a retirar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-red-600">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="pl-10 h-12 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-red-500 rounded-xl text-lg font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Motivo</label>
                                <Input
                                    placeholder="Ej: Compra de insumos, uso personal..."
                                    className="h-10 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-red-500 rounded-xl text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black uppercase rounded-xl"
                                    onClick={() => {
                                        toast.success('Retiro registrado');
                                        setRetiroExtra(false);
                                    }}
                                >
                                    Confirmar Retiro
                                </Button>
                                <Button variant="ghost" onClick={() => setRetiroExtra(false)}>Cancelar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default Ventas;
