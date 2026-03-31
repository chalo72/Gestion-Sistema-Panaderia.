import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Plus,
    Minus,
    Trash2,
    Users,
    CheckCircle,
    AlertCircle,
    Store,
    CreditCard,
    BarChart3,
    ShoppingCart
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { safeNumber, safeString } from '@/lib/safe-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Componentes modulares
import { POSHeader } from '@/components/ventas/POSHeader';
import type { TabPOS } from '@/components/ventas/POSHeader';
import { ProductCatalog } from '@/components/ventas/ProductCatalog';
import { CartDetail } from '@/components/ventas/CartDetail';
import { MuroPedidos } from '@/components/ventas/MuroPedidos';
import { AperturaCajaModal } from '@/components/ventas/AperturaCajaModal';
import { CierreCajaModal } from '@/components/ventas/CierreCajaModal';
import { CajaMovimientosModal } from '@/components/ventas/CajaMovimientosModal';

import type {
    Producto,
    InventarioItem,
    Venta,
    CajaSesion,
    MetodoPago,
    Categoria,
    Mesa,
    PedidoActivo,
    VentaItem
} from '@/types';

// Estado del carrito por pestaña
interface TabCartState {
    cart: { producto: Producto; cantidad: number }[];
    cliente: string;
}

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
    onRegistrarMovimientoCaja: (monto: number, tipo: 'entrada' | 'salida', motivo: string, usuarioId: string) => Promise<any>;
    mesas: Mesa[];
    pedidosActivos: PedidoActivo[];
    onUpdateMesa: (mesa: Mesa) => Promise<void>;
    onAddPedidoActivo: (pedido: PedidoActivo) => Promise<void>;
    onUpdatePedidoActivo: (pedido: PedidoActivo) => Promise<void>;
    onDeletePedidoActivo: (id: string) => Promise<void>;
    onUpdateProducto?: (id: string, updates: Partial<Producto>) => Promise<void>;
    onAjustarStock?: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => Promise<void>;
    onAddMesa?: (mesa: Mesa) => Promise<void>;
    onDeleteMesa?: (id: string) => Promise<void>;
}

// ID constante para la pestaña de Venta Rápida
const VENTA_RAPIDA_ID = 'venta-rapida';

export function Ventas(props: VentasProps) {
    const {
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
        onRegistrarMovimientoCaja,
        mesas,
        pedidosActivos,
        onUpdateMesa,
        onAddPedidoActivo,
        onUpdatePedidoActivo,
        onDeletePedidoActivo,
        onUpdateProducto,
        onAjustarStock,
        onAddMesa,
        onDeleteMesa
    } = props;

    const [viewMode, setViewMode] = useState<'pos' | 'mesas'>('pos');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [dineroRecibido, setDineroRecibido] = useState<number>(0);
    const [tipoTransaccion, setTipoTransaccion] = useState<'efectivo' | 'credito'>('efectivo');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastVenta, setLastVenta] = useState<Venta | null>(null);
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [movimientoCaja, setMovimientoCaja] = useState<{ tipo: 'entrada' | 'salida' } | null>(null);

    // ==========================================
    // SISTEMA DE PESTAÑAS MÚLTIPLES
    // ==========================================
    const [tabs, setTabs] = useState<TabPOS[]>([
        { id: VENTA_RAPIDA_ID, label: 'Venta Rápida', tipo: 'venta-rapida' }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>(VENTA_RAPIDA_ID);

    // Estado del carrito por pestaña (Map: tabId -> { cart, cliente })
    const [tabCarts, setTabCarts] = useState<Record<string, TabCartState>>({
        [VENTA_RAPIDA_ID]: { cart: [], cliente: '' }
    });

    // Obtener el estado actual del carrito/cliente de la pestaña activa
    const currentTabState = tabCarts[activeTabId] || { cart: [], cliente: '' };
    const cart = currentTabState.cart;
    const cliente = currentTabState.cliente;

    // Función auxiliar para actualizar el carrito de la pestaña activa
    const updateActiveCart = useCallback((updater: (prev: { producto: Producto; cantidad: number }[]) => { producto: Producto; cantidad: number }[]) => {
        setTabCarts(prev => {
            const currentState = prev[activeTabId] || { cart: [], cliente: '' };
            return {
                ...prev,
                [activeTabId]: {
                    ...currentState,
                    cart: updater(currentState.cart)
                }
            };
        });
    }, [activeTabId]);

    const setCliente = useCallback((c: string) => {
        setTabCarts(prev => {
            const currentState = prev[activeTabId] || { cart: [], cliente: '' };
            return {
                ...prev,
                [activeTabId]: { ...currentState, cliente: c }
            };
        });
    }, [activeTabId]);

    // ==========================================
    // FILTRO DE PRODUCTOS
    // ==========================================
    const productosVenta = useMemo(() => {
        return productos.filter(p => {
            const matchesSearch = safeString(p.nombre).toLowerCase().includes(searchTerm.toLowerCase());
            
            // 🔥 Filtro de Seguridad: Ocultar si pertenece a categoría de Insumos
            const categoriaLower = safeString(p.categoria).toLowerCase().trim();
            const isNotInsumo = !categoriaLower.startsWith('ins:') && 
                               !categoriaLower.startsWith('insumos');

            // Comparación insensible a mayúsculas y espacios para evitar invisibilidad por variaciones de nombre
            const matchesCategory = !selectedCategory ||
                categoriaLower === selectedCategory.toLowerCase().trim();
                
            const precio = safeNumber(p.precioVenta);
            
            return matchesSearch && matchesCategory && precio > 0 && isNotInsumo;
        });
    }, [productos, searchTerm, selectedCategory]);

    const totalCart = useMemo(() => {
        return cart.reduce((sum, item) => {
            const precio = safeNumber(item.producto?.precioVenta);
            return sum + (precio * (item.cantidad || 0));
        }, 0);
    }, [cart]);

    // ==========================================
    // ACCIONES DEL CARRITO
    // ==========================================
    const addToCart = (producto: Producto) => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de realizar ventas');
            setShowAperturaModal(true);
            return;
        }
        // Validar stock disponible antes de agregar
        const itemEnInventario = inventario.find(i => i.productoId === producto.id);
        const cantidadEnCarrito = cart.find(i => i.producto.id === producto.id)?.cantidad || 0;
        if (itemEnInventario && itemEnInventario.stockActual <= cantidadEnCarrito) {
            toast.warning(`Stock insuficiente: solo ${itemEnInventario.stockActual} unidades disponibles`);
            return;
        }
        updateActiveCart(prev => {
            const existing = prev.find(item => item.producto.id === producto.id);
            if (existing) {
                return prev.map(item =>
                    item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
                );
            }
            return [...prev, { producto, cantidad: 1 }];
        });
    };

    const updateQuantity = (productoId: string, delta: number) => {
        updateActiveCart(prev => {
            const existing = prev.find(item => item.producto.id === productoId);
            if (!existing) return prev;
            const newQuantity = existing.cantidad + delta;
            if (newQuantity <= 0) return prev.filter(item => item.producto.id !== productoId);
            return prev.map(item =>
                item.producto.id === productoId ? { ...item, cantidad: newQuantity } : item
            );
        });
    };

    const removeFromCart = (productoId: string) => {
        updateActiveCart(prev => prev.filter(item => item.producto.id !== productoId));
    };

    const clearCart = () => {
        updateActiveCart(() => []);
    };

    // ==========================================
    // GESTIÓN DE PESTAÑAS
    // ==========================================
    const handleAddVentaRapida = useCallback(() => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de realizar ventas');
            setShowAperturaModal(true);
            return;
        }
        const numVentasRapidas = tabs.filter(t => t.tipo === 'venta-rapida').length;
        const newId = `venta-rapida-${Date.now()}`;

        setTabs(prev => [...prev, {
            id: newId,
            label: `Venta Rápida ${numVentasRapidas + 1}`,
            tipo: 'venta-rapida'
        }]);
        setTabCarts(prev => ({
            ...prev,
            [newId]: { cart: [], cliente: '' }
        }));
        setActiveTabId(newId);
        setViewMode('pos');
    }, [tabs, cajaActiva]);

    const handleSelectTab = useCallback((tabId: string) => {
        setActiveTabId(tabId);
        // Siempre mostrar el catálogo al cambiar de pestaña
        setViewMode('pos');
    }, []);

    const handleCloseTab = useCallback((tabId: string) => {
        const tabToClose = tabs.find(t => t.id === tabId);
        if (!tabToClose) return;

        // No permitir cerrar si es la única pestaña de Venta Rápida
        if (tabToClose.tipo === 'venta-rapida') {
            const ventasRapidas = tabs.filter(t => t.tipo === 'venta-rapida');
            if (ventasRapidas.length <= 1) {
                toast.error('No puedes cerrar la última pestaña de Venta Rápida');
                return;
            }
        }

        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        setTabCarts(prev => {
            const next = { ...prev };
            delete next[tabId];
            return next;
        });

        // Si la pestaña cerrada era la activa, apuntar a la última disponible
        if (activeTabId === tabId) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }

        if (tabToClose) {
            toast.info(`Pestaña "${tabToClose.label}" cerrada`);
        }
    }, [tabs, activeTabId]);

    // Sincronizar carrito de mesa con PedidoActivo en DB
    useEffect(() => {
        const mesaTabs = tabs.filter(t => t.tipo === 'mesa' && t.mesaId);
        mesaTabs.forEach(tab => {
            const mesa = mesas.find(m => m.id === tab.mesaId);
            if (!mesa?.pedidoActivoId) return;
            const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
            if (!pedido) return;
            const tabState = tabCarts[tab.id];
            if (!tabState) return;

            const nuevosItems = tabState.cart.map(item => ({
                id: `${pedido.id}-${item.producto.id}`,
                productoId: item.producto.id,
                cantidad: item.cantidad,
                precioUnitario: item.producto.precioVenta,
                subtotal: safeNumber(item.producto.precioVenta) * safeNumber(item.cantidad, 1)
            }));
            const nuevoTotal = nuevosItems.reduce((s, i) => s + i.subtotal, 0);

            // Solo actualizar si hay cambios reales
            const itemsIguales = JSON.stringify(pedido.items) === JSON.stringify(nuevosItems);
            if (!itemsIguales) {
                onUpdatePedidoActivo({
                    ...pedido,
                    items: nuevosItems,
                    total: nuevoTotal,
                    cliente: tabState.cliente || pedido.cliente,
                    ultimoCambio: new Date().toISOString()
                });
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabCarts]);

    // ==========================================
    // ACCIONES DE MESAS
    // ==========================================
    const handleSelectMesa = (mesa: Mesa) => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de gestionar mesas');
            setShowAperturaModal(true);
            return;
        }

        const mesaTabId = `mesa-${mesa.id}`;

        if (mesa.estado === 'disponible') {
            // Crear pedido nuevo para la mesa
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
                return onUpdateMesa({ ...mesa, estado: 'ocupada', pedidoActivoId: nuevoPedido.id });
            }).then(() => {
                // Crear pestaña nueva si no existe
                const existingTab = tabs.find(t => t.id === mesaTabId);
                if (!existingTab) {
                    setTabs(prev => [...prev, {
                        id: mesaTabId,
                        label: `Mesa ${mesa.numero}`,
                        tipo: 'mesa',
                        mesaId: mesa.id
                    }]);
                    setTabCarts(prev => ({
                        ...prev,
                        [mesaTabId]: { cart: [], cliente: `Mesa ${mesa.numero}` }
                    }));
                }
                // Activar la pestaña de la mesa
                setActiveTabId(mesaTabId);
                setViewMode('pos');
                toast.success(`Mesa ${mesa.numero} abierta — pestaña creada`);
            }).catch(() => {
                toast.error(`Error al abrir la mesa ${mesa.numero}`);
            });
        } else {
            // Mesa ocupada: abrir la pestaña existente o crear una con los datos del pedido
            const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);

            const existingTab = tabs.find(t => t.id === mesaTabId);
            if (!existingTab) {
                // Crear pestaña y cargar productos del pedido
                const cartItems = pedido ? pedido.items.map(item => {
                    const prod = productos.find(p => p.id === item.productoId);
                    return prod ? { producto: prod, cantidad: item.cantidad } : null;
                }).filter(Boolean) as { producto: Producto; cantidad: number }[] : [];

                setTabs(prev => [...prev, {
                    id: mesaTabId,
                    label: `Mesa ${mesa.numero}`,
                    tipo: 'mesa',
                    mesaId: mesa.id
                }]);
                setTabCarts(prev => ({
                    ...prev,
                    [mesaTabId]: { cart: cartItems, cliente: pedido?.cliente || `Mesa ${mesa.numero}` }
                }));
            }

            // Activar la pestaña
            setActiveTabId(mesaTabId);
            setViewMode('pos');
        }
    };

    // ==========================================
    // PROCESO DE PAGO
    // ==========================================
    const handleProcessPayment = (tipo: MetodoPago, trans: 'efectivo' | 'credito') => {
        setMetodoPago(tipo);
        setTipoTransaccion(trans);
        setDineroRecibido(0);
        setShowPagoModal(true);
    };

    const handleFinalizarVenta = async () => {
        if (cart.length === 0) return;
        // Validación de dinero suficiente (segunda barrera además del disabled)
        if (tipoTransaccion !== 'credito' && metodoPago === 'efectivo' && safeNumber(dineroRecibido) < totalCart) {
            toast.error('El dinero recibido es insuficiente');
            return;
        }
        // Validar nombre de cliente para crédito
        if (tipoTransaccion === 'credito' && !cliente.trim()) {
            toast.error('Ingresa el nombre del cliente para el fiado');
            return;
        }
        try {
            setIsProcessing(true);
            const totalToPay = totalCart;
            const ventaData = {
                items: cart.map(item => ({
                    productoId: item.producto.id,
                    cantidad: item.cantidad,
                    precioUnitario: safeNumber(item.producto.precioVenta),
                    subtotal: safeNumber(item.producto.precioVenta) * safeNumber(item.cantidad, 1)
                })),
                metodoPago: tipoTransaccion === 'credito' ? 'credito' as MetodoPago : metodoPago,
                cliente: cliente.trim() || 'Cliente Anónimo',
                usuarioId: usuario?.id || 'anon',
                tipoTransaccion,
                dineroRecibido: tipoTransaccion === 'credito' ? totalToPay : safeNumber(dineroRecibido),
                vueltas: tipoTransaccion === 'credito' ? 0 : Math.max(0, safeNumber(dineroRecibido) - totalToPay),
                fecha: new Date().toISOString()
            };

            const result = await onRegistrarVenta(ventaData);
            setLastVenta(result);
            setShowPagoModal(false);
            setShowSuccessModal(true);

            // Si era una mesa, liberarla y cerrar la pestaña
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab?.tipo === 'mesa' && activeTab.mesaId) {
                const mesa = mesas.find(m => m.id === activeTab.mesaId);
                if (mesa && mesa.pedidoActivoId) {
                    await onDeletePedidoActivo(mesa.pedidoActivoId);
                    await onUpdateMesa({ ...mesa, estado: 'disponible', pedidoActivoId: undefined });
                }
                // Cerrar la pestaña de la mesa usando handleCloseTab
                handleCloseTab(activeTabId);
            } else if (activeTab?.tipo === 'venta-rapida') {
                // Venta Rápida: limpiar carrito o cerrar si hay más de una
                const ventasRapidas = tabs.filter(t => t.tipo === 'venta-rapida');
                if (ventasRapidas.length > 1) {
                    handleCloseTab(activeTabId);
                } else {
                    clearCart();
                    setCliente('');
                }
            }

            toast.success('Venta registrada con éxito');
        } catch (error) {
            toast.error('Error al procesar la venta');
        } finally {
            setIsProcessing(false);
        }
    };

    // Liberar mesa sin procesar venta (carrito vacío o salida sin consumo)
    const handleLiberarMesa = async () => {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (!currentTab?.mesaId) return;
        const mesa = mesas.find(m => m.id === currentTab.mesaId);
        if (!mesa) return;
        try {
            if (mesa.pedidoActivoId) {
                await onDeletePedidoActivo(mesa.pedidoActivoId);
            }
            await onUpdateMesa({ ...mesa, estado: 'disponible', pedidoActivoId: undefined });
            handleCloseTab(activeTabId);
            toast.success(`Mesa ${mesa.numero} liberada`);
        } catch {
            toast.error('Error al liberar la mesa');
        }
    };

    // Encontrar la pestaña activa para pasarle info al CartDetail
    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Cabecera de Pestañas Compacta - Restaurada */}
            <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10">
                <POSHeader
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    formatCurrency={formatCurrency}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onSelectTab={handleSelectTab}
                    onCloseTab={handleCloseTab}
                    onAddVentaRapida={handleAddVentaRapida}
                    cajaActiva={!!cajaActiva}
                    onCerrarCaja={() => setShowCierreModal(true)}
                    onMovimientoEntrada={() => setMovimientoCaja({ tipo: 'entrada' })}
                    onMovimientoSalida={() => setMovimientoCaja({ tipo: 'salida' })}
                />
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-2 overflow-hidden p-2">
                {/* Panel izquierdo: Catálogo o Mesas */}
                <div className="flex-1 flex flex-col min-h-0 bg-card rounded-xl border shadow-sm overflow-hidden min-h-[200px]">
                    {viewMode === 'pos' ? (
                        <ProductCatalog
                            productos={productosVenta}
                            inventario={inventario}
                            onAddToCart={addToCart}
                            formatCurrency={formatCurrency}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={setSelectedCategory}
                            categorias={categorias}
                            onEditProduct={onUpdateProducto}
                            onAjustarStock={onAjustarStock}
                        />
                    ) : (
                        <MuroPedidos
                            mesas={mesas}
                            pedidosActivos={pedidosActivos}
                            onSelectMesa={handleSelectMesa}
                            formatCurrency={formatCurrency}
                            onUpdateMesa={onUpdateMesa}
                            onAddMesa={onAddMesa}
                            onDeleteMesa={onDeleteMesa}
                        />
                    )}
                </div>

                {/* Panel derecho: Carrito / Orden */}
                <div className="w-full lg:w-[400px] max-h-[50vh] lg:max-h-none shrink-0 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <CartDetail
                        cart={cart}
                        onUpdateQuantity={updateQuantity}
                        onRemoveFromCart={removeFromCart}
                        onClearCart={clearCart}
                        onProcessPayment={handleProcessPayment}
                        formatCurrency={formatCurrency}
                        cajaActiva={cajaActiva}
                        usuario={usuario}
                        cliente={cliente}
                        setCliente={setCliente}
                        activeTabLabel={activeTab?.label}
                        activeTabTipo={activeTab?.tipo}
                        onLiberarMesa={handleLiberarMesa}
                    />
                </div>
            </div>

            {/* Modal de Pago Profesional */}
            <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
                    {/* Header con total */}
                    <div className="bg-slate-900 text-white p-6">
                        <span className="text-xs font-semibold text-slate-400 block mb-1">Total a Cobrar</span>
                        <h2 className="text-4xl font-extrabold text-emerald-400">{formatCurrency(totalCart)}</h2>
                        <DialogDescription className="text-xs text-slate-500 mt-1">
                            {activeTab?.tipo === 'mesa' ? `Cobro de ${activeTab.label}` : 'Venta Rápida — Selecciona el método de pago'}
                        </DialogDescription>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Métodos de pago */}
                        <div className="space-y-2">
                            <span className="text-sm font-bold text-slate-500">Método de Pago</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setMetodoPago('efectivo'); setTipoTransaccion('efectivo'); }}
                                    className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                        metodoPago === 'efectivo' && tipoTransaccion !== 'credito' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                                    )}>
                                    <span className="text-2xl block mb-1">💵</span>
                                    <span className="text-sm font-bold block">Efectivo</span>
                                    <span className="text-xs text-slate-400">Billetes y monedas</span>
                                </button>
                                <button onClick={() => { setMetodoPago('tarjeta'); setTipoTransaccion('efectivo'); }}
                                    className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                        metodoPago === 'tarjeta' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                                    )}>
                                    <span className="text-2xl block mb-1">💳</span>
                                    <span className="text-sm font-bold block">Tarjeta</span>
                                    <span className="text-xs text-slate-400">Datáfono / POS</span>
                                </button>
                                <button onClick={() => { setMetodoPago('nequi'); setTipoTransaccion('efectivo'); }}
                                    className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                        metodoPago === 'nequi' ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-slate-300"
                                    )}>
                                    <span className="text-2xl block mb-1">📱</span>
                                    <span className="text-sm font-bold block">Nequi</span>
                                    <span className="text-xs text-slate-400">Pago digital</span>
                                </button>
                                <button onClick={() => { setTipoTransaccion('credito'); }}
                                    className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                        tipoTransaccion === 'credito' ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"
                                    )}>
                                    <span className="text-2xl block mb-1">📋</span>
                                    <span className="text-sm font-bold block">Crédito / Fiado</span>
                                    <span className="text-xs text-slate-400">Cuenta por cobrar</span>
                                </button>
                            </div>
                        </div>

                        {/* Sección según método */}
                        {tipoTransaccion !== 'credito' ? (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-sm font-bold text-slate-500 block mb-2">Monto Recibido</Label>
                                    <Input type="number" autoFocus value={dineroRecibido}
                                        onChange={e => setDineroRecibido(parseFloat(e.target.value) || 0)}
                                        className="h-14 text-3xl font-extrabold text-right rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200" />
                                </div>
                                {/* Billetes rápidos */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[1000, 2000, 5000, 10000, 20000, 50000].map(b => (
                                        <button key={b} onClick={() => setDineroRecibido(b)}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors">
                                            {formatCurrency(b)}
                                        </button>
                                    ))}
                                    <button onClick={() => setDineroRecibido(totalCart)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-200 transition-colors">
                                        Exacto
                                    </button>
                                </div>
                                {/* Cambio */}
                                <div className={cn("p-4 rounded-xl text-center",
                                    dineroRecibido >= totalCart ? "bg-emerald-50" : "bg-red-50"
                                )}>
                                    <span className="text-xs font-semibold text-slate-500 block mb-1">
                                        {dineroRecibido >= totalCart ? '💰 Cambio / Vueltas' : '⚠️ Falta dinero'}
                                    </span>
                                    <span className={cn("text-3xl font-extrabold",
                                        dineroRecibido >= totalCart ? "text-emerald-600" : "text-red-600"
                                    )}>
                                        {formatCurrency(Math.abs(dineroRecibido - totalCart))}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                                    <h4 className="text-sm font-bold text-amber-700 mb-1">Venta a Crédito</h4>
                                    <p className="text-xs text-amber-600">Se registrará como deuda del cliente</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-bold text-slate-500 block mb-2">Nombre del Cliente *</Label>
                                    <Input value={cliente} onChange={e => setCliente(e.target.value)}
                                        placeholder="¿A quién se le fía?" className="h-12 text-base rounded-xl border-slate-200" />
                                </div>
                            </div>
                        )}

                        {/* Botones */}
                        <div className="flex gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setShowPagoModal(false)}
                                className="h-14 flex-1 rounded-xl text-sm font-bold text-slate-400">Cancelar</Button>
                            <Button disabled={(tipoTransaccion !== 'credito' && dineroRecibido < totalCart) || (tipoTransaccion === 'credito' && !cliente.trim())}
                                onClick={() => handleFinalizarVenta()}
                                className="h-14 flex-[2] rounded-xl bg-primary hover:bg-orange-600 text-white text-base font-bold shadow-lg">
                                {tipoTransaccion === 'credito' ? '📋 Registrar Fiado' : '✅ Confirmar Pago'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Éxito */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="max-w-md rounded-[3rem] p-10 text-center border-none shadow-3xl">
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-ag-pulse">
                            <CheckCircle className="w-12 h-12 text-emerald-600" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight mb-2">¡Venta Exitosa!</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Operación completada con maestría</p>
                        <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-[2rem] p-8 mb-8 text-left border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between text-[10px] font-black uppercase mb-3 opacity-40">
                                <span>Total:</span>
                                <span>Método:</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-3xl font-black text-emerald-600 tabular-nums">{formatCurrency(lastVenta?.total || 0)}</span>
                                <span className="text-xs font-black uppercase bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-lg">{lastVenta?.metodoPago}</span>
                            </div>
                        </div>
                        <Button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white dark:text-black text-white font-black uppercase text-xs shadow-xl"
                        >Siguiente Venta</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Cierre de Caja */}
            <CierreCajaModal
                isOpen={showCierreModal}
                onClose={() => setShowCierreModal(false)}
                onCerrar={async (monto) => {
                    await onCerrarCaja(monto);
                    setShowCierreModal(false);
                }}
                cajaActiva={cajaActiva}
                formatCurrency={formatCurrency}
            />

            {/* Modal de Movimientos de Caja (Entrada/Salida) */}
            <CajaMovimientosModal
                isOpen={!!movimientoCaja}
                onOpenChange={(open) => { if (!open) setMovimientoCaja(null); }}
                tipo={movimientoCaja?.tipo || 'entrada'}
                onSubmit={async (monto, motivo) => {
                    await onRegistrarMovimientoCaja(monto, movimientoCaja!.tipo, motivo, usuario?.id || 'anon');
                    setMovimientoCaja(null);
                }}
            />

            {/* Modal de Apertura de Caja — CRÍTICO: faltaba renderizarse */}
            <AperturaCajaModal
                isOpen={showAperturaModal}
                onClose={() => setShowAperturaModal(false)}
                onAbrir={async (montoApertura: number) => {
                    await onAbrirCaja(usuario?.id || 'anon', montoApertura);
                    setShowAperturaModal(false);
                }}
            />

            {/* Modal de Resumen Diario */}
            <Dialog open={showDailyReport} onOpenChange={setShowDailyReport}>
                <DialogContent className="max-w-2xl rounded-[2.5rem] p-8 bg-white dark:bg-slate-900 border-none shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <BarChart3 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Ventas del Día</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Resumen por categorías · {format(new Date(), 'dd MMMM yyyy', { locale: es })}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {categorias.map(cat => {
                            const hoy = new Date().toISOString().split('T')[0];
                            const ventasHoy = ventas.filter(v => v.fecha.startsWith(hoy));
                            const totalCat = ventasHoy.reduce((acc, v) => {
                                return acc + v.items.reduce((accI, item) => {
                                    const prod = productos.find(p => p.id === item.productoId);
                                    return prod?.categoria === cat.nombre ? accI + (item.precioUnitario * item.cantidad) : accI;
                                }, 0);
                            }, 0);

                            return (totalCat > 0 || true) && (
                                <div key={cat.id} className="p-5 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group hover:shadow-xl transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-2xl">{cat.icono || '📦'}</span>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat.nombre}</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                        {formatCurrency(totalCat)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-slate-900 dark:bg-white text-white dark:text-black p-8 rounded-[2rem] flex justify-between items-center shadow-xl">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Total Ventas Bruto</p>
                            <p className="text-4xl font-black tabular-nums">
                                {formatCurrency(ventas.filter(v => v.fecha.startsWith(new Date().toISOString().split('T')[0])).reduce((acc, v) => acc + v.total, 0))}
                            </p>
                        </div>
                        <Button onClick={() => setShowDailyReport(false)} className="h-14 px-8 rounded-2xl bg-white/20 dark:bg-black/10 hover:bg-white/30 dark:hover:bg-black/20 text-white dark:text-black font-black uppercase text-xs tracking-widest border border-white/10 dark:border-black/5">Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
