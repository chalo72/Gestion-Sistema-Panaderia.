import { generateUUID } from '@/lib/safe-utils';
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
    ShoppingCart,
    MessageCircle,
    Package,
    Save,
    Mic,
    Volume2,
    ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { VendedoraQuickPicker, VendedoraMesaModal, type VendedoraOption } from '@/components/ventas/VendedoraQuickPicker';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { registrarLogActividad, getDeudores, marcarDeudorRecuperado, registrarIncidente } from '@/lib/security-agent';

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
    VentaItem,
    Cliente,
    OrdenProduccion
} from '@/types';

// Estado del carrito por pestaña
interface TabCartState {
    cart: { producto: Producto; cantidad: number }[];
    cliente: string;
    vendedoraId?: string;
    vendedoraNombre?: string;
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
    onAddCreditoCliente?: (credito: any) => Promise<any>;
    creditosClientes?: any[];
    clientes: Cliente[];
    cajaActionTrigger?: { tipo: 'entrada' | 'salida' | 'cierre'; ts: number } | null;
    onCajaActionConsumed?: () => void;
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
        onDeleteMesa,
        clientes: masterClientes,
        cajaActionTrigger,
        onCajaActionConsumed,
    } = props;

    // ==========================================
    // VENDEDORA ACTIVA — Lista disponible
    // ==========================================
    const { usuarios } = useAuth();
    const vendedorasDisponibles = useMemo<VendedoraOption[]>(() => {
        if (!usuarios || usuarios.length === 0) return [];
        return usuarios
            .filter(u => u.activo !== false && u.rol === 'VENDEDOR')
            .map(u => ({ id: u.id, nombre: u.nombre, rol: u.rol }));
    }, [usuarios]);

    const [viewMode, setViewMode] = useState<'pos' | 'mesas'>('pos');
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
    const [nequiComprobante, setNequiComprobante] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [dineroRecibido, setDineroRecibido] = useState<number>(0);
    const [tipoTransaccion, setTipoTransaccion] = useState<'efectivo' | 'credito'>('efectivo');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastVenta, setLastVenta] = useState<Venta | null>(null);
    const [descuento, setDescuento] = useState(0);

    const handleSetDescuento = (newDesc: number) => {
        setDescuento(newDesc);
        if (newDesc > 0 && totalCart > 0 && (newDesc / totalCart) > 0.15) {
             import('@/lib/ojo-bionico').then(m => {
                 m.OjoBionico.capturarAnomalia(
                     'odysseus', 
                     `Se aplicó un descuento de $${newDesc} sobre un total de $${totalCart}`,
                     'Monitor de facturación en segundo plano',
                     'Posible manipulación de precios detectada.',
                     'No aplica, captura estática.',
                     'warning'
                 );
             });
        }
    };
    const [showAdHocModal, setShowAdHocModal] = useState(false);
    const [adHocNombre, setAdHocNombre] = useState('');
    const [adHocPrecio, setAdHocPrecio] = useState('');
    const [adHocGuardar, setAdHocGuardar] = useState(false);
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [movimientoCaja, setMovimientoCaja] = useState<{ tipo: 'entrada' | 'salida' } | null>(null);

    // Reacciona a triggers del header global (botones Entrada/Salida/Cerrar Caja)
    useEffect(() => {
        if (!cajaActionTrigger) return;
        if (cajaActionTrigger.tipo === 'cierre') setShowCierreModal(true);
        else setMovimientoCaja({ tipo: cajaActionTrigger.tipo });
        onCajaActionConsumed?.();
    }, [cajaActionTrigger]);

    // Mesa esperando selección de vendedora (multi-vendedora)
    const [mesaPendienteVendedora, setMesaPendienteVendedora] = useState<Mesa | null>(null);

    // ── Ecosistema de Inteligencia Hermes & Odysseus ──
    const [showHermesMic, setShowHermesMic] = useState(false);
    const [hermesAudioText, setHermesAudioText] = useState('');
    const [hermesSuggestions, setHermesSuggestions] = useState<{ producto: Producto; cantidad: number }[]>([]);
    const [isHermesProcessing, setIsHermesProcessing] = useState(false);
    const [activeDeudorAlert, setActiveDeudorAlert] = useState<any | null>(null);

    // Registrar log de actividad al ingresar al POS
    useEffect(() => {
        if (usuario?.id) {
            registrarLogActividad(usuario.id, usuario.nombre || 'Vendedor', 'Ventas', 'abrir_pos', 'Ingreso a terminal POS');
        }
    }, [usuario]);

    // (El useEffect de deudor se movió más abajo para evitar TDZ error 'G')

    // ==========================================
    // SISTEMA DE PESTAÑAS MÚLTIPLES (PERSISTENTE)
    // ==========================================
    const [tabs, setTabs] = useState<TabPOS[]>(() => {
        try {
            const saved = localStorage.getItem('dp_pos_tabs');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return [{ id: VENTA_RAPIDA_ID, label: 'Venta Rápida', tipo: 'venta-rapida' }];
    });
    
    const [activeTabId, setActiveTabId] = useState<string>(() => {
        return localStorage.getItem('dp_pos_active_tab') || VENTA_RAPIDA_ID;
    });

    // Estado del carrito por pestaña (Map: tabId -> { cart, cliente })
    const [tabCarts, setTabCarts] = useState<Record<string, TabCartState>>(() => {
        try {
            const saved = localStorage.getItem('dp_pos_carts');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return { [VENTA_RAPIDA_ID]: { cart: [], cliente: '' } };
    });

    // Persistir estado en localStorage para evitar pérdida de contexto
    useEffect(() => { localStorage.setItem('dp_pos_tabs', JSON.stringify(tabs)); }, [tabs]);
    useEffect(() => { localStorage.setItem('dp_pos_active_tab', activeTabId); }, [activeTabId]);
    useEffect(() => { localStorage.setItem('dp_pos_carts', JSON.stringify(tabCarts)); }, [tabCarts]);

    // Vendedora de la pestaña activa — null cuando no hay selección explícita
    const vendedoraActiva = useMemo<VendedoraOption | null>(() => {
        const tab = tabCarts[activeTabId];
        if (tab?.vendedoraId && tab?.vendedoraNombre) {
            return { id: tab.vendedoraId, nombre: tab.vendedoraNombre };
        }
        return null;
    }, [tabCarts, activeTabId]);

    const setVendedoraActiva = useCallback((v: VendedoraOption | null) => {
        setTabCarts(prev => {
            const current = prev[activeTabId] || { cart: [], cliente: '' };
            return {
                ...prev,
                [activeTabId]: { ...current, vendedoraId: v?.id, vendedoraNombre: v?.nombre }
            };
        });
    }, [activeTabId]);

    // Obtener el estado actual del carrito/cliente de la pestaña activa
    const currentTabState = tabCarts[activeTabId] || { cart: [], cliente: '' };
    const cart = currentTabState.cart;
    const cliente = currentTabState.cliente;

    // Verificar deudor cuando cambia el nombre de cliente
    useEffect(() => {
        if (!cliente || cliente.trim().toLowerCase() === 'cliente anónimo' || cliente.trim().toLowerCase() === 'general') {
            setActiveDeudorAlert(null);
            return;
        }
        const deudores = getDeudores();
        const encontrado = deudores.find(d => 
            d.clienteNombre.toLowerCase().trim() === cliente.toLowerCase().trim() && 
            d.estado === 'pendiente'
        );
        if (encontrado) {
            setActiveDeudorAlert(encontrado);
        } else {
            setActiveDeudorAlert(null);
        }
    }, [cliente]);

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

    const handleHermesVoiceParse = async (textoDictado: string) => {
        if (!textoDictado.trim()) return;
        setIsHermesProcessing(true);
        try {
            const res = await fetch('/api/agente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'hermes',
                    mensaje: `Analiza esta comanda por voz y extrae los productos y cantidades. Devuelve ÚNICAMENTE un array JSON plano de objetos con campos "nombre" (string) y "cantidad" (número). Ejemplo: [{"nombre": "pan de queso", "cantidad": 2}]. Comanda: "${textoDictado}"`,
                    aiMode: 'hybrid'
                })
            });

            if (!res.ok) throw new Error('Error al procesar audio por Hermes');
            
            const rawText = await res.text();
            
            let parsedItems: { nombre: string; cantidad: number }[] = [];
            try {
                const jsonMatch = rawText.match(/\[\s*\{.*\}\s*\]/s);
                const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
                parsedItems = JSON.parse(jsonStr);
            } catch (jsonErr) {
                console.warn('Hermes no retornó JSON perfecto, intentando parse manual básico:', rawText);
                productos.forEach(p => {
                    const regex = new RegExp(`(\\d+)\\s*(?:unidades de\\s*)?(${p.nombre.toLowerCase()})`, 'i');
                    const match = rawText.toLowerCase().match(regex);
                    if (match) {
                        parsedItems.push({ nombre: p.nombre, cantidad: parseInt(match[1] || '1') });
                    }
                });
            }

            const sugerencias: { producto: Producto; cantidad: number }[] = [];
            for (const item of parsedItems) {
                const prod = productos.find(p => p.nombre.toLowerCase().trim() === item.nombre.toLowerCase().trim() ||
                    p.nombre.toLowerCase().includes(item.nombre.toLowerCase().trim()) ||
                    item.nombre.toLowerCase().includes(p.nombre.toLowerCase().trim())
                );
                if (prod) {
                    sugerencias.push({ producto: prod, cantidad: Math.max(1, item.cantidad) });
                }
            }

            if (sugerencias.length > 0) {
                setHermesSuggestions(sugerencias);
                toast.success(`Hermes interpretó ${sugerencias.length} sugerencias de productos.`);
            } else {
                toast.error('Hermes no pudo asociar los productos dictados a productos del catálogo.');
            }
        } catch (err) {
            toast.error('Error de enlace con el Copiloto Hermes.');
        } finally {
            setIsHermesProcessing(false);
            setShowHermesMic(false);
        }
    };

    // ==========================================
    // FILTRO DE PRODUCTOS
    // ==========================================
    const productosVenta = useMemo(() => {
        const normBusqueda = (s: string | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const searchNormalized = normBusqueda(searchTerm);

        const filtered = productos.filter(p => {
            const matchesSearch = normBusqueda(p.nombre).includes(searchNormalized);

            // 🔥 Filtro de Seguridad: Ocultar si pertenece a categoría de Insumos
            const categoriaLower = safeString(p.categoria).toLowerCase().trim();
            const isNotInsumo = !categoriaLower.startsWith('ins:') &&
                               !categoriaLower.startsWith('insumos');

            // Comparación insensible a mayúsculas y espacios para evitar invisibilidad por variaciones de nombre
            const matchesCategory = !selectedCategory ||
                categoriaLower === selectedCategory.toLowerCase().trim();

            const precio = safeNumber(p.precioVenta);
            // Mostrar cualquier producto que no sea insumo/ingrediente. Excluir explícitamente tipo='ingrediente'
            const isVentaType = p.tipo !== 'ingrediente';
            return matchesSearch && matchesCategory && precio >= 0 && isNotInsumo && isVentaType;
        });

        // Cuando varios proveedores venden el mismo producto, mostrar solo el de mayor rentabilidad
        const norm = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
        const mejores = new Map<string, Producto>();
        filtered.forEach(p => {
            const key = norm(p.nombre);
            const prev = mejores.get(key);
            if (!prev) { mejores.set(key, p); return; }
            const costo = p.costoBase || 0;
            const costoPrev = prev.costoBase || 0;
            const margen = costo > 0 ? (p.precioVenta - costo) / costo : -1;
            const margenPrev = costoPrev > 0 ? (prev.precioVenta - costoPrev) / costoPrev : -1;
            if (margen > margenPrev) mejores.set(key, p);
        });
        return Array.from(mejores.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
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
        setDescuento(0);
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
        setTabCarts(prev => {
            // La nueva pestaña hereda la vendedora de la pestaña actual
            const current = prev[activeTabId] || { cart: [], cliente: '' };
            return {
                ...prev,
                [newId]: {
                    cart: [],
                    cliente: '',
                    vendedoraId: current.vendedoraId,
                    vendedoraNombre: current.vendedoraNombre,
                }
            };
        });
        setActiveTabId(newId);
        setViewMode('pos');
    }, [tabs, cajaActiva, activeTabId, usuario]);

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
    // Abre la mesa con una vendedora específica asignada
    const abrirMesaConVendedora = useCallback((mesa: Mesa, vendedora: VendedoraOption | null) => {
        const mesaTabId = `mesa-${mesa.id}`;
        const nombreVendedora = vendedora?.nombre || vendedoraActiva?.nombre || usuario?.nombre || 'Usuario';
        const idVendedora = vendedora?.id || vendedoraActiva?.id || usuario?.id;

        const nuevoPedido: PedidoActivo = {
            id: generateUUID(),
            mesaId: mesa.id,
            items: [],
            total: 0,
            estado: 'abierto',
            fechaInicio: new Date().toISOString(),
            ultimoCambio: new Date().toISOString()
        };
        onAddPedidoActivo(nuevoPedido).then(() => {
            return onUpdateMesa({
                ...mesa,
                estado: 'ocupada',
                pedidoActivoId: nuevoPedido.id,
                abiertaPor: nombreVendedora,
                abiertaPorId: idVendedora,
                fechaApertura: new Date().toISOString(),
            });
        }).then(() => {
            const existingTab = tabs.find(t => t.id === mesaTabId);
            if (!existingTab) {
                setTabs(prev => [...prev, {
                    id: mesaTabId,
                    label: `Mesa ${mesa.numero}`,
                    tipo: 'mesa',
                    mesaId: mesa.id,
                    abiertaPor: nombreVendedora,
                }]);
                setTabCarts(prev => ({
                    ...prev,
                    [mesaTabId]: {
                        cart: [],
                        cliente: `Mesa ${mesa.numero}`,
                        vendedoraId: idVendedora,
                        vendedoraNombre: nombreVendedora,
                    }
                }));
            }
            setActiveTabId(mesaTabId);
            setViewMode('pos');
            toast.success(`Mesa ${mesa.numero} — ${nombreVendedora}`);
        }).catch(() => {
            toast.error(`Error al abrir la mesa ${mesa.numero}`);
        });
    }, [tabs, vendedoraActiva, usuario, onAddPedidoActivo, onUpdateMesa]);

    const handleSelectMesa = (mesa: Mesa) => {
        if (!cajaActiva) {
            toast.error('Debe abrir caja antes de gestionar mesas');
            setShowAperturaModal(true);
            return;
        }

        const mesaTabId = `mesa-${mesa.id}`;

        if (mesa.estado === 'disponible') {
            // Si hay vendedoras disponibles, preguntar quién atiende
            if (vendedorasDisponibles.length >= 1) {
                setMesaPendienteVendedora(mesa);
                return;
            }
            abrirMesaConVendedora(mesa, null);
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
                    mesaId: mesa.id,
                    abiertaPor: mesa.abiertaPor,
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
        if (tipoTransaccion === 'credito') {
            if (!cliente.trim()) {
                toast.error('Ingresa el nombre del cliente para el fiado');
                return;
            }
            // Validación de Cliente Moroso
            const clientNameLower = cliente.trim().toLowerCase();
            const clienteMoroso = props.creditosClientes?.find(c => 
                c.clienteNombre.toLowerCase() === clientNameLower && 
                c.saldo > 0 && 
                c.estado === 'vencido'
            );
            if (clienteMoroso) {
                toast.error(`❌ Venta Bloqueada: Cliente Moroso`, {
                    description: `El cliente ${cliente.trim()} tiene deudas vencidas. No se permiten más fiados hasta que ponga su cuenta al día.`
                });
                return;
            }
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
                usuarioId: vendedoraActiva?.id || usuario?.id || 'anon',
                vendedoraNombre: vendedoraActiva?.nombre || usuario?.nombre || '',
                tipoTransaccion,
                dineroRecibido: tipoTransaccion === 'credito' ? totalToPay : safeNumber(dineroRecibido),
                vueltas: tipoTransaccion === 'credito' ? 0 : Math.max(0, safeNumber(dineroRecibido) - totalToPay),
                fecha: new Date().toISOString()
            };

            const result = await onRegistrarVenta(ventaData);
            setLastVenta(result);
            
            // Sincronización con el módulo de Créditos a Clientes
            if (tipoTransaccion === 'credito' && props.onAddCreditoCliente) {
                const existingClient = props.creditosClientes?.find(c => c.clienteNombre.toLowerCase() === cliente.trim().toLowerCase());
                
                await props.onAddCreditoCliente({
                    clienteNombre: cliente.trim(),
                    categoriaCliente: existingClient?.categoriaCliente || '',
                    monto: totalToPay,
                    saldo: totalToPay,
                    descripcion: 'Crédito generado automáticamente desde POS',
                    fecha: new Date().toISOString().split('T')[0],
                    estado: 'activo',
                    items: cart.map(item => ({
                        productoId: item.producto.id,
                        nombre: item.producto.nombre,
                        cantidad: item.cantidad,
                        precioVenta: safeNumber(item.producto.precioVenta),
                        subtotal: safeNumber(item.producto.precioVenta) * safeNumber(item.cantidad, 1)
                    })),
                    pagos: [],
                    usuarioId: usuario?.id || 'anon'
                });
            }

            setShowPagoModal(false);
            setShowSuccessModal(true);
            setNequiComprobante(null);
            setShowMobileCart(false); // volver al catálogo en móvil tras cobrar

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
            await onUpdateMesa({ ...mesa, estado: 'disponible', pedidoActivoId: undefined, abiertaPor: undefined, abiertaPorId: undefined, fechaApertura: undefined });
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
                    setViewMode={(mode) => {
                        setViewMode(mode);
                        // Al cambiar a mesas en móvil, asegurar que el panel izquierdo sea visible
                        if (mode === 'mesas') setShowMobileCart(false);
                    }}
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
                    vendedoras={vendedorasDisponibles}
                    vendedoraActivaId={vendedoraActiva?.id ?? null}
                    onSelectVendedora={setVendedoraActiva}
                />
                {/* ── Selector Rápido de Vendedora — solo desktop (en móvil está en el panel) ── */}
                {vendedorasDisponibles.length >= 1 && (
                    <div className="hidden lg:flex items-center gap-3 px-4 pb-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <VendedoraQuickPicker
                            vendedoras={vendedorasDisponibles}
                            activaId={vendedoraActiva?.id ?? null}
                            onSelect={setVendedoraActiva}
                            tabLabel={activeTab?.label}
                            compact
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden p-3 pb-[68px] lg:pb-3">
                {/* Panel izquierdo: Catálogo o Mesas — pantalla completa en móvil */}
                <div className={cn(
                    "flex-1 flex-col min-h-0 bg-card rounded-2xl border shadow-sm overflow-hidden",
                    showMobileCart ? "hidden lg:flex" : "flex"
                )} style={{ minHeight: '0' }}>
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
                            onOpenAdHoc={() => { setAdHocNombre(''); setAdHocPrecio(''); setAdHocGuardar(false); setShowAdHocModal(true); }}
                            cart={cart}
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

                {/* Panel derecho: Carrito — pantalla completa en móvil cuando showMobileCart */}
                <div className={cn(
                    "w-full lg:w-[440px] xl:w-[480px] shrink-0 flex-col min-h-0 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden transition-all duration-300",
                    showMobileCart ? "flex" : "hidden lg:flex"
                )} style={{ minHeight: '0' }}>
                    {/* Hermes Copiloto Panel de Dictado y Sugerencias */}
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 p-3 flex flex-col gap-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-200">Hermes Copiloto</span>
                            </div>
                            <button
                                onClick={() => {
                                    setHermesAudioText('');
                                    setShowHermesMic(true);
                                }}
                                className="h-7 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Dictar Orden
                            </button>
                        </div>

                        {/* Sugerencias pendientes de agregar */}
                        {hermesSuggestions.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 shadow-sm space-y-2">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                    <span className="text-[10px] font-black uppercase text-indigo-600">Borrador de Hermes:</span>
                                    <button onClick={() => setHermesSuggestions([])} className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase">Limpiar</button>
                                </div>
                                <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                    {hermesSuggestions.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                            <span>{item.producto.nombre}</span>
                                            <span>x{item.cantidad}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        hermesSuggestions.forEach(item => {
                                            addToCart(item.producto);
                                            updateQuantity(item.producto.id, item.cantidad);
                                        });
                                        setHermesSuggestions([]);
                                        toast.success('Productos sugeridos agregados al carrito');
                                    }}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all"
                                >
                                    Agregar todo al carrito
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Alerta de Deudor Pendiente */}
                    {activeDeudorAlert && (
                        <div className="bg-red-50 dark:bg-red-955/20 border-b border-red-200 dark:border-red-900/30 p-3 flex flex-col gap-2 shrink-0 animate-pulse">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-900 dark:text-red-200">DEUDOR EN LISTA NEGRA</p>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">El cliente {activeDeudorAlert.clienteNombre} tiene una deuda registrada.</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-3 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 space-y-1.5">
                                <p><span className="text-slate-400 uppercase text-[9px] block font-black">Descripción física:</span> {activeDeudorAlert.descripcionFisica}</p>
                                <p><span className="text-slate-400 uppercase text-[9px] block font-black">Monto de la deuda:</span> {formatCurrency(activeDeudorAlert.montoDeuda)}</p>
                                {activeDeudorAlert.fotoCctv && (
                                    <div className="mt-1.5 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video relative bg-black">
                                        <img src={activeDeudorAlert.fotoCctv} className="w-full h-full object-cover" alt="Evidencia de fuga" />
                                        <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] text-white">EVIDENCIA CCTV</span>
                                    </div>
                                )}
                                <div className="flex gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1.5">
                                    <button
                                        onClick={() => {
                                            const adHocItem: Producto = {
                                                id: `deuda-${activeDeudorAlert.id}`,
                                                nombre: `Saldo Pendiente (${activeDeudorAlert.clienteNombre})`,
                                                precioVenta: activeDeudorAlert.montoDeuda,
                                                categoria: 'Otros',
                                                tipo: 'elaborado',
                                                activo: true,
                                                margenUtilidad: 0
                                            };
                                            addToCart(adHocItem);
                                            marcarDeudorRecuperado(activeDeudorAlert.id);
                                            setActiveDeudorAlert(null);
                                            toast.success('Saldo adeudado agregado al carrito de cobro');
                                        }}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all"
                                    >
                                        Cobrar saldo adeudado
                                    </button>
                                    <button
                                        onClick={() => setActiveDeudorAlert(null)}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 rounded-lg text-[10px] font-black uppercase"
                                    >
                                        Ignorar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                        clientesNombres={Array.from(new Set([
                            ...(masterClientes || []).map(c => c.nombre),
                            ...(props.creditosClientes || []).map((c: any) => c.clienteNombre),
                        ])).filter(Boolean)}
                        activeTabLabel={activeTab?.label}
                        activeTabTipo={activeTab?.tipo}
                        onLiberarMesa={handleLiberarMesa}
                        descuento={descuento}
                        setDescuento={handleSetDescuento}
                        rolUsuario={usuario?.rol}
                    />
                </div>
            </div>

            {/* ── Navegación móvil: floating pill ── */}
            <div className="lg:hidden fixed bottom-4 left-4 right-4 rounded-3xl overflow-hidden flex border border-slate-200/60 dark:border-slate-700/60 shadow-2xl shadow-indigo-900/10 dark:shadow-black/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl z-40" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}>
                {/* Catálogo */}
                <button
                    onClick={() => setShowMobileCart(false)}
                    className={cn(
                        'flex-1 flex flex-col items-center justify-center gap-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors',
                        !showMobileCart
                            ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/10'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    )}
                >
                    <ShoppingCart className="w-6 h-6" />
                    Catálogo
                </button>

                {/* Divisor */}
                <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

                {/* Ticket */}
                <button
                    onClick={() => setShowMobileCart(true)}
                    className={cn(
                        'flex-[2] flex items-center justify-center gap-2 py-4 transition-all relative pr-28',
                        showMobileCart
                            ? 'bg-indigo-600 text-white'
                            : cart.length > 0
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500'
                    )}
                >
                    {cart.length > 0 ? (
                        <>
                            <span className="w-6 h-6 rounded-full bg-white/25 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                {cart.reduce((s, i) => s + i.cantidad, 0)}
                            </span>
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[11px] font-black">
                                    {formatCurrency(Math.max(0, totalCart - descuento))}
                                </span>
                                <span className="text-[9px] opacity-70 font-bold uppercase">Ver ticket</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <ShoppingCart className="w-5 h-5 opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Ver Ticket</span>
                        </>
                    )}
                </button>
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

                        {/* Foto comprobante Nequi */}
                        {metodoPago === 'nequi' && tipoTransaccion !== 'credito' && (
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-slate-600">Comprobante Nequi</p>
                                {nequiComprobante ? (
                                    <div className="relative">
                                        <img src={nequiComprobante} alt="Comprobante Nequi" className="w-full max-h-48 object-contain rounded-xl border border-purple-200 bg-purple-50" />
                                        <button onClick={() => setNequiComprobante(null)}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-black shadow">
                                            ✕
                                        </button>
                                        <p className="text-xs text-emerald-600 font-bold mt-1 text-center">✅ Foto guardada</p>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 cursor-pointer active:bg-purple-100 transition-colors">
                                        <span className="text-2xl">📸</span>
                                        <span className="text-sm font-bold text-purple-700">Tomar foto del comprobante</span>
                                        <span className="text-xs text-slate-400">Opcional — abre la cámara</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setNequiComprobante(ev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        )}

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
                                    <p className="text-xs text-amber-600">Se registrará como deuda del cliente en el módulo de Créditos</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-bold text-slate-500 block mb-2">Nombre del Cliente *</Label>
                                    <Input 
                                        value={cliente} 
                                        onChange={e => setCliente(e.target.value)}
                                        list="clientes-pos-list"
                                        placeholder="¿A quién se le fía?" 
                                        className="h-12 text-base rounded-xl border-slate-200" 
                                    />
                                    <datalist id="clientes-pos-list">
                                        {/* Combinar nombres de créditos previos y nombres de la DB maestra */}
                                        {Array.from(new Set([
                                            ...(props.creditosClientes || []).map(c => c.clienteNombre),
                                            ...(masterClientes || []).map(c => c.nombre)
                                        ])).map(nombre => (
                                            <option key={nombre} value={nombre} />
                                        ))}
                                    </datalist>
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
                        <div className="flex gap-3 w-full">
                            {lastVenta && (
                                <button
                                    onClick={() => {
                                        const lineas = (lastVenta as any).items?.map((i: any) =>
                                            `• ${i.nombre} x${i.cantidad} — ${formatCurrency(i.subtotal ?? (i.precioUnitario * i.cantidad))}`
                                        ).join('%0A') ?? '';
                                        const texto = `🍞 *Dulce Placer*%0A*Ticket #${(lastVenta.id || '').slice(-6).toUpperCase()}*%0A%0A${lineas}%0A%0A*Total: ${formatCurrency(lastVenta.total)}*%0A${lastVenta.metodoPago?.toUpperCase?.() ?? ''}`;
                                        window.open(`https://wa.me/?text=${texto}`, '_blank');
                                    }}
                                    className="flex-1 h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white flex items-center justify-center gap-2 font-black text-xs uppercase shadow-lg shadow-emerald-500/20"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    WhatsApp
                                </button>
                            )}
                            <Button
                                onClick={() => setShowSuccessModal(false)}
                                className="flex-[2] h-16 rounded-2xl bg-slate-900 dark:bg-white dark:text-black text-white font-black uppercase text-xs shadow-xl"
                            >Siguiente Venta</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Producto Ad-hoc — producto no listado, temporal */}
            <Dialog open={showAdHocModal} onOpenChange={setShowAdHocModal}>
                <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="bg-violet-600 text-white px-6 py-5">
                        <div className="flex items-center gap-3 mb-1">
                            <Package className="w-5 h-5 opacity-80" />
                            <h3 className="font-black text-base uppercase tracking-tight">Producto no listado</h3>
                        </div>
                        <p className="text-xs text-violet-200">Agrega un producto temporal al ticket</p>
                        <DialogDescription className="sr-only">Agregar producto ad-hoc al carrito</DialogDescription>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre</Label>
                            <input
                                autoFocus
                                placeholder="Ej: Torta especial pedido"
                                value={adHocNombre}
                                onChange={e => setAdHocNombre(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500/30"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Precio</Label>
                            <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={adHocPrecio}
                                onChange={e => setAdHocPrecio(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        {onUpdateProducto && (
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div
                                    onClick={() => setAdHocGuardar(v => !v)}
                                    className={cn(
                                        "w-10 h-5 rounded-full transition-colors relative",
                                        adHocGuardar ? "bg-violet-500" : "bg-slate-200 dark:bg-slate-700"
                                    )}
                                >
                                    <span className={cn(
                                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                                        adHocGuardar ? "left-5" : "left-0.5"
                                    )} />
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                    <Save className="w-3.5 h-3.5" />
                                    Guardar en el catálogo
                                </span>
                            </label>
                        )}
                        <div className="flex gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setShowAdHocModal(false)} className="flex-1 h-11 rounded-xl text-sm text-slate-400">Cancelar</Button>
                            <Button
                                disabled={!adHocNombre.trim() || !adHocPrecio || parseFloat(adHocPrecio) <= 0}
                                onClick={() => {
                                    const precio = parseFloat(adHocPrecio);
                                    const productoTemp: Producto = {
                                        id: `adhoc-${Date.now()}`,
                                        nombre: adHocNombre.trim(),
                                        precioVenta: precio,
                                        categoria: 'Otros',
                                        tipo: 'elaborado',
                                        activo: true,
                                    } as Producto;
                                    addToCart(productoTemp);
                                    if (adHocGuardar && onUpdateProducto) {
                                        toast.promise(
                                            onUpdateProducto(productoTemp.id, { nombre: productoTemp.nombre, precioVenta: precio, categoria: 'Otros' }),
                                            { loading: 'Guardando...', success: 'Guardado en catálogo', error: 'No se pudo guardar' }
                                        );
                                    }
                                    setShowAdHocModal(false);
                                    toast.success(`${adHocNombre.trim()} agregado al ticket`);
                                }}
                                className="flex-[2] h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm"
                            >
                                Agregar al ticket
                            </Button>
                        </div>
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
                open={!!movimientoCaja}
                onOpenChange={(open) => !open && setMovimientoCaja(null)}
                tipo={movimientoCaja?.tipo || 'entrada'}
                onSave={async (monto, motivo) => {
                    await onRegistrarMovimientoCaja(monto, movimientoCaja!.tipo, motivo, usuario?.id || '');
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

            {/* ── Modal rápido: ¿Quién atiende esta mesa? ── */}
            {mesaPendienteVendedora && (
                <VendedoraMesaModal
                    vendedoras={vendedorasDisponibles}
                    mesaNumero={mesaPendienteVendedora.numero}
                    onSelect={(vendedora) => {
                        const mesa = mesaPendienteVendedora;
                        setMesaPendienteVendedora(null);
                        abrirMesaConVendedora(mesa, vendedora);
                    }}
                />
            )}

            {/* Modal de Dictado de Voz Hermes */}
            <Dialog open={showHermesMic} onOpenChange={setShowHermesMic}>
                <DialogContent className="bg-slate-900 border border-indigo-500/30 text-white rounded-[2rem] p-6 max-w-md">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse shadow-lg shadow-indigo-500/50">
                            <Mic className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-indigo-400">Hermes Copiloto</h3>
                            <p className="text-xs text-slate-400">Dicta los pedidos de mesas o caja rápida. Hermes los agregará al borrador.</p>
                        </div>
                        <textarea
                            value={hermesAudioText}
                            onChange={e => setHermesAudioText(e.target.value)}
                            placeholder='Ej: "Mesa 3 lleva dos panes de queso y una Coca-Cola. Mesa 5 pide un helado doble."'
                            className="w-full min-h-[100px] p-4 bg-black/40 border border-white/10 rounded-2xl text-sm outline-none focus:ring-1 ring-indigo-500/50 text-white placeholder-slate-600 resize-none"
                        />
                        <div className="w-full text-left space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Simular Dictados Rápidos:</span>
                            {[
                                'Mesa 3 lleva dos panes de queso y una Coca-Cola',
                                'Mesa 5 pide un helado',
                                'Una torta en caja rápida'
                            ].map(phrase => (
                                <button
                                    key={phrase}
                                    type="button"
                                    onClick={() => setHermesAudioText(phrase)}
                                    className="w-full text-left p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs text-slate-300 font-bold truncate transition-colors"
                                >
                                    "{phrase}"
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 w-full pt-2">
                            <Button variant="ghost" onClick={() => setShowHermesMic(false)} className="flex-1 h-11 rounded-xl text-xs text-slate-400">Cancelar</Button>
                            <Button
                                onClick={() => handleHermesVoiceParse(hermesAudioText)}
                                disabled={isHermesProcessing || !hermesAudioText.trim()}
                                className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl"
                            >
                                {isHermesProcessing ? 'Interpretando...' : 'Procesar Comanda'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
