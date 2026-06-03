import { generateUUID } from '@/lib/safe-utils';
import { db } from '@/lib/database';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Store, Users, TrendingUp, DollarSign, Package, AlertTriangle,
    CheckCircle2, XCircle, ChevronDown, ChevronUp, Plus, Trash2,
    Download, Pencil, Check, X, Phone, FileText, BarChart3, Info,
    ShieldCheck, Percent, ArrowRight, ShoppingCart, ArrowLeft, Search, UserCheck,
    Minus, Receipt, Banknote, Clock, PlayCircle, Camera, History, ImageIcon,
    Smartphone, CreditCard, PlusCircle, ChevronRight, Folder, Building2, Edit2,
    MessageCircle, StickyNote, Send, ChevronLeft, Star, Printer
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
import type { Producto, PrecioProveedor, Cliente } from '@/types';
import { ProductAvatar } from '@/components/ui/ProductAvatar';
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

type MetodoPago = 'efectivo' | 'nequi' | 'transferencia' | 'credito';

interface Abono {
    id: string;
    monto: number;
    fecha: number;
    metodoPago: MetodoPago;
}

interface TicketPendiente {
    id: string;
    clienteId: string;
    clienteNombre: string;
    items: { productoId: string; nombre: string; precio: number; cantidad: number }[];
    guardadoEn: number;
}

interface HistorialMayorista {
    id: string;
    clienteId: string;
    clienteNombre: string;
    items: { productoId: string; nombre: string; precio: number; cantidad: number }[];
    total: number;
    fecha: number;
    fotoFactura?: string;
    metodoPago?: MetodoPago;
    abonos?: Abono[];
}

interface MayoristasProps {
    productos: Producto[];
    precios: PrecioProveedor[];
    clientes: Cliente[];
    addCliente: (c: any) => Promise<any>;
    updateCliente: (id: string, updates: any) => Promise<void>;
    deleteCliente: (id: string) => Promise<void>;
    getMejorPrecio: (productoId: string) => PrecioProveedor | null;
    formatCurrency: (value: number) => string;
    onNavigateTo?: (view: string) => void;
    cajaActiva?: any;
    registrarVenta?: (v: any) => Promise<any>;
    creditosClientes?: any[];
    addCreditoCliente?: (c: any) => Promise<void>;
    updateCreditoCliente?: (id: string, updates: any) => Promise<void>;
    deleteCreditoCliente?: (id: string) => Promise<void>;
    registrarPagoCredito?: (id: string, pago: any) => Promise<void>;
}

// Clientes se manejan por props ahora

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
export default function Mayoristas({ productos, precios, clientes: allClientes, addCliente, updateCliente, deleteCliente, getMejorPrecio, formatCurrency, onNavigateTo, cajaActiva, registrarVenta, creditosClientes, addCreditoCliente, updateCreditoCliente, deleteCreditoCliente, registrarPagoCredito }: MayoristasProps) {
    // Config de márgenes
    const [config, setConfig] = useState(cargarConfig);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [configTemp, setConfigTemp] = useState(config);
    const [panelView, setPanelView] = useState<'ticket' | 'cuenta'>('ticket');
    const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<Set<string>>(new Set());
    const [showMobilePOSCart, setShowMobilePOSCart] = useState(false);

    // ── Rescate de Historial Local a BD Real ──
    useEffect(() => {
        const historialLocal = localStorage.getItem('ag_historial_mayoristas');
        if (!historialLocal || !addCreditoCliente) return;

        const rescued = localStorage.getItem('ag_mayoristas_rescued');
        if (rescued) return;

        try {
            const parsed = JSON.parse(historialLocal) as HistorialMayorista[];
            if (parsed.length === 0) return;

            const rescatar = async () => {
                let rescatados = 0;
                for (const h of parsed) {
                    if (h.metodoPago === 'credito') {
                        const abonado = (h.abonos || []).reduce((acc, a) => acc + a.monto, 0);
                        const saldo = h.total - abonado;
                        await addCreditoCliente({
                            clienteId: h.clienteId,
                            clienteNombre: h.clienteNombre,
                            monto: h.total,
                            saldo: saldo,
                            descripcion: 'Venta Mayorista (Rescate Histórico)',
                            items: h.items,
                            usuarioId: 'admin',
                            estado: saldo <= 0 ? 'pagado' : 'activo',
                            pagos: (h.abonos || []).map(a => ({
                                id: a.id,
                                monto: a.monto,
                                fecha: new Date(a.fecha).toISOString(),
                                metodoPago: a.metodoPago,
                                registradoPor: 'admin'
                            }))
                        });
                        rescatados++;
                    }
                }
                if (rescatados > 0) {
                    // rescatados créditos migrados a DB central
                }
                localStorage.setItem('ag_mayoristas_rescued', 'true');
            };
            rescatar();
        } catch (e) {
            console.error('Error rescatando historial', e);
        }
    }, [addCreditoCliente]);

    // Estado de Pestañas
    const [activeTab, setActiveTab] = useState('precios');

    // Clientes mayoristas — Filtrados de la DB Maestra
    const clientes = useMemo(() => {
        return allClientes.filter(c => c.tipo === 'mayorista');
    }, [allClientes]);

    const [showModalCliente, setShowModalCliente] = useState(false);
    const [editandoCliente, setEditandoCliente] = useState<Cliente | null>(null);
    const [formCliente, setFormCliente] = useState<Partial<Cliente>>({ tipo: 'mayorista' });
    const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
    const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
    const [viendoPerfilCliente, setViendoPerfilCliente] = useState<Cliente | null>(null);

    // Persistir cliente visto en sessionStorage para sobrevivir recarga de página
    useEffect(() => {
        if (viendoPerfilCliente) sessionStorage.setItem('ag_viewing_client', viendoPerfilCliente.id);
        else sessionStorage.removeItem('ag_viewing_client');
        setBusquedaTicket('');
    }, [viendoPerfilCliente?.id]);

    // Restaurar cliente tras recarga cuando allClientes ya cargó
    useEffect(() => {
        if (viendoPerfilCliente) return;
        const savedId = sessionStorage.getItem('ag_viewing_client');
        if (!savedId) return;
        const found = allClientes.find(c => c.id === savedId);
        if (found) setViendoPerfilCliente(found);
    }, [allClientes]);

    // Carga tombstones al montar — capa defensiva anti-productos-fantasma
    useEffect(() => {
        db.getTombstones('productos').then(ids => setTombstoneIds(new Set(ids))).catch(() => {});
    }, []);

    const [busquedaPerfil, setBusquedaPerfil] = useState('');
    const [categoriaPerfil, setCategoriaPerfil] = useState('');
    const [tombstoneIds, setTombstoneIds] = useState<Set<string>>(new Set());
    const [carritoPos, setCarritoPos] = useState<{ productoId: string; nombre: string; precio: number; cantidad: number }[]>([]);

    const agregarAlCarrito = (productoId: string, nombre: string, precio: number) => {
        setCarritoPos(prev => {
            const existe = prev.find(i => i.productoId === productoId);
            if (existe) return prev.map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + 1 } : i);
            return [...prev, { productoId, nombre, precio, cantidad: 1 }];
        });
    };

    const actualizarCantidadPos = (productoId: string, delta: number) => {
        setCarritoPos(prev => {
            const item = prev.find(i => i.productoId === productoId);
            if (item && item.cantidad + delta <= 0) return prev.filter(i => i.productoId !== productoId);
            return prev.map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i);
        });
    };

    const eliminarDelCarrito = (productoId: string) => {
        setCarritoPos(prev => prev.filter(i => i.productoId !== productoId));
    };

    // ── Monto libre (ítems sin producto del catálogo) ────────────────────────
    const [montoLibreOpen, setMontoLibreOpen] = useState(false);
    const [montoLibreDesc, setMontoLibreDesc] = useState('');
    const [montoLibreMonto, setMontoLibreMonto] = useState('');

    const agregarMontoLibre = () => {
        const monto = parseFloat(montoLibreMonto.replace(/[^0-9.]/g, ''));
        if (isNaN(monto) || monto <= 0) return;
        const desc = montoLibreDesc.trim() || 'Pedido sin detallar';
        setCarritoPos(prev => [...prev, {
            productoId: `__libre__-${generateUUID()}`,
            nombre: desc,
            precio: monto,
            cantidad: 1,
        }]);
        setMontoLibreDesc('');
        setMontoLibreMonto('');
        setMontoLibreOpen(false);
    };

    // ── Tickets pendientes (guardados sin cobrar) ────────────────────────────
    const [ticketsPendientes, setTicketsPendientes] = useState<TicketPendiente[]>(() => {
        try { return JSON.parse(localStorage.getItem('ag_tickets_pendientes') || '[]'); } catch { return []; }
    });

    const actualizarTicketsPersistidos = (nuevos: TicketPendiente[]) => {
        setTicketsPendientes(nuevos);
        localStorage.setItem('ag_tickets_pendientes', JSON.stringify(nuevos));
    };

    const guardarTicketPendiente = () => {
        if (!viendoPerfilCliente || carritoPos.length === 0) return;
        const nuevo: TicketPendiente = {
            id: generateUUID(),
            clienteId: viendoPerfilCliente.id,
            clienteNombre: viendoPerfilCliente.nombre,
            items: [...carritoPos],
            guardadoEn: Date.now(),
        };
        actualizarTicketsPersistidos([...ticketsPendientes, nuevo]);
        setCarritoPos([]);
        toast.success('Ticket guardado — retómalo cuando quieras');
    };

    // ID del ticket pendiente que fue retomado al carrito actual
    const [ticketRetomadoId, setTicketRetomadoId] = useState<string | null>(null);
    const [ticketEditandoEnPOS, setTicketEditandoEnPOS] = useState<{ id: string; esCentral: boolean; fechaLabel: string } | null>(null);

    const editarTicketEnPOS = (h: { id: string; items: any[]; total: number; fecha: number | string }) => {
        const esCentral = !!(creditosClientes?.find(c => c.id === h.id));
        if (carritoPos.length > 0 && !window.confirm('¿Reemplazar el carrito actual para editar este ticket?')) return;
        const d = new Date(h.fecha);
        const fechaLabel = isNaN(d.getTime()) ? 'ticket' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
        setCarritoPos(h.items.map((i: any) => ({ productoId: i.productoId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })));
        setTicketEditandoEnPOS({ id: h.id, esCentral, fechaLabel });
        setTicketRetomadoId(null);
        setPanelView('ticket');
        toast('✏️ Ticket cargado — modifica los productos y toca Guardar cambios');
    };

    const guardarEdicionEnPOS = async () => {
        if (!ticketEditandoEnPOS || carritoPos.length === 0) return;
        const { id, esCentral } = ticketEditandoEnPOS;
        const nuevoTotal = carritoPos.reduce((s, i) => s + i.precio * i.cantidad, 0);
        if (esCentral) {
            if (!updateCreditoCliente) {
                toast.error('No se puede guardar: función de actualización no disponible');
                return;
            }
            try {
                await updateCreditoCliente(id, { items: [...carritoPos], monto: nuevoTotal });
                // Respaldo local — igual que W-008 para fechas
                const existeLocal = historialMayoristas.find(h => h.id === id);
                if (existeLocal) {
                    persistirHistorial(historialMayoristas.map(h => h.id !== id ? h : { ...h, items: [...carritoPos], total: nuevoTotal }));
                }
                toast.success('Ticket actualizado');
            } catch (e) {
                toast.error('Error al guardar cambios');
                return;
            }
        } else {
            const existeLocal = historialMayoristas.find(h => h.id === id);
            if (!existeLocal) {
                toast.error('Ticket no encontrado en historial local');
                return;
            }
            persistirHistorial(historialMayoristas.map(h => h.id !== id ? h : { ...h, items: [...carritoPos], total: nuevoTotal }));
            toast.success('Ticket actualizado');
        }
        setCarritoPos([]);
        setTicketEditandoEnPOS(null);
    };

    const retomarTicket = (ticket: TicketPendiente) => {
        if (carritoPos.length > 0 && !window.confirm('¿Reemplazar el ticket actual con el guardado?')) return;
        setCarritoPos(ticket.items);
        setTicketRetomadoId(ticket.id);
        actualizarTicketsPersistidos(ticketsPendientes.filter(t => t.id !== ticket.id));
        toast.success('Ticket retomado');
    };

    const retomarTicketsSeleccionados = () => {
        const seleccionados = Array.from(ticketsSeleccionados);
        const pendientesSel = ticketsPendientes.filter(t => seleccionados.includes(t.id));
        if (pendientesSel.length === 0) return;
        const todosItems = pendientesSel.flatMap(t => t.items);
        if (carritoPos.length > 0 && !window.confirm('¿Reemplazar el ticket actual con los seleccionados?')) return;
        setCarritoPos(todosItems);
        // quitar los tickets retomados de persistidos
        const restantes = ticketsPendientes.filter(t => !seleccionados.includes(t.id));
        actualizarTicketsPersistidos(restantes);
        // limpiar selección
        setTicketsSeleccionados(new Set());
        toast.success('Tickets seleccionados retomados al carrito');
    };

    // Limpiar carrito: si vino de un ticket guardado, lo devuelve a pendientes
    const limpiarCarrito = () => {
        if (ticketRetomadoId && viendoPerfilCliente && carritoPos.length > 0) {
            const devuelto: TicketPendiente = {
                id: ticketRetomadoId,
                clienteId: viendoPerfilCliente.id,
                clienteNombre: viendoPerfilCliente.nombre,
                items: [...carritoPos],
                guardadoEn: Date.now(),
            };
            actualizarTicketsPersistidos([...ticketsPendientes, devuelto]);
            toast('Ticket devuelto a guardados');
        }
        setCarritoPos([]);
        setTicketRetomadoId(null);
    };

    const cancelarTicketPendiente = (ticketId: string) => {
        if (editandoPendienteId === ticketId) setEditandoPendienteId(null);
        actualizarTicketsPersistidos(ticketsPendientes.filter(t => t.id !== ticketId));
        toast.success('Ticket descartado');
    };

    // ── Historial de ventas mayoristas ───────────────────────────────────────
    const [historialMayoristas, setHistorialMayoristas] = useState<HistorialMayorista[]>(() => {
        try { return JSON.parse(localStorage.getItem('ag_historial_mayoristas') || '[]'); } catch { return []; }
    });

    const [isGuardandoTicket, setIsGuardandoTicket] = useState(false);

    const guardarEnHistorial = async (items: typeof carritoPos, total: number, foto?: string, metodo?: MetodoPago) => {
        if (!viendoPerfilCliente) return;
        if (isGuardandoTicket) return; // anti-doble-clic
        setIsGuardandoTicket(true);

        const nuevo: HistorialMayorista = {
            id: generateUUID(),
            clienteId: viendoPerfilCliente.id,
            clienteNombre: viendoPerfilCliente.nombre,
            items: [...items],
            total,
            fecha: Date.now(),
            fotoFactura: foto,
            metodoPago: metodo ?? 'efectivo',
            abonos: metodo === 'credito' ? [] : undefined,
        };

        // 1. Guardar en Base de Datos Centralizada
        let creditoGuardadoEnNube = false;
        try {
            if (metodo === 'credito') {
                if (addCreditoCliente) {
                    await addCreditoCliente({
                        id: nuevo.id,
                        clienteId: nuevo.clienteId,
                        clienteNombre: nuevo.clienteNombre,
                        monto: nuevo.total,
                        saldo: nuevo.total,
                        descripcion: 'Venta Mayorista',
                        fecha: new Date().toISOString(),
                        items: nuevo.items,
                        usuarioId: 'admin',
                        estado: 'activo',
                        pagos: []
                    });
                    creditoGuardadoEnNube = true;
                }
            } else {
                if (registrarVenta) {
                    if (!cajaActiva) {
                        toast.error('Atención: La venta se guardó localmente, pero NO en la base de datos central porque no hay una caja abierta.');
                    } else {
                        await registrarVenta({
                            items: nuevo.items,
                            total: nuevo.total,
                            metodoPago: metodo ?? 'efectivo',
                            clienteId: nuevo.clienteId,
                            clienteNombre: nuevo.clienteNombre,
                            tipoVenta: 'mayorista'
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error al registrar en BD central', e);
            toast.error('Error al sincronizar con la base de datos principal');
        }

        // Descontar del inventario siempre (con o sin caja, efectivo o crédito)
        try {
            await db.batchAjustarStock(items.map(item => ({
                productoId: item.productoId,
                cantidad: item.cantidad,
                tipo: 'salida',
                motivo: `Venta mayorista: ${viendoPerfilCliente.nombre}`,
            })));
            const agotados: string[] = [];
            for (const item of items) {
                const inv = await db.getInventarioItemByProducto(item.productoId);
                if (inv && inv.stockActual <= 0) agotados.push(item.nombre);
            }
            if (agotados.length > 0) {
                toast.warning(`Stock agotado: ${agotados.join(', ')}`, { duration: 5000 });
            }
        } catch (e) {
            console.warn('[Mayoristas] No se pudo actualizar inventario:', e);
        }

        // Persistir en IndexedDB como respaldo
        try {
            await db.addHistorial({ ...nuevo, tipo: 'mayorista' });
        } catch (e) {
            console.warn('[Mayoristas] No se pudo guardar historial en IndexedDB:', e);
        }

        // Para créditos guardados en nube: NO duplicar en localStorage.
        // creditosClientes ya los mostrará via historialUnificado.
        // Solo se guarda en localStorage si la nube falló (modo offline/fallback).
        if (metodo === 'credito' && creditoGuardadoEnNube) {
            setIsGuardandoTicket(false);
            return;
        }

        const nuevos = [nuevo, ...historialMayoristas];
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        setIsGuardandoTicket(false);
    };

    // Foto temporal adjunta al carrito actual
    const [fotoFactura, setFotoFactura] = useState<string | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edición inline de ticket pendiente
    const [editandoPendienteId, setEditandoPendienteId] = useState<string | null>(null);

    const actualizarItemEnPendiente = (ticketId: string, productoId: string, delta: number) => {
        setTicketsPendientes(prev => {
            const nuevos = prev.map(t => {
                if (t.id !== ticketId) return t;
                const items = t.items
                    .map(i => i.productoId === productoId ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i);
                return { ...t, items };
            });
            localStorage.setItem('ag_tickets_pendientes', JSON.stringify(nuevos));
            return nuevos;
        });
    };

    // Dialog de historial
    const [verHistorial, setVerHistorial] = useState(false);

    // Forma de pago seleccionada en el mini-POS
    const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState<MetodoPago>('efectivo');

    // Abonos en historial
    const [abonandoId, setAbonandoId] = useState<string | null>(null);
    const [montoAbono, setMontoAbono] = useState('');
    const [ticketsSeleccionados, setTicketsSeleccionados] = useState<Set<string>>(new Set());
    const [montoAbonoMultiple, setMontoAbonoMultiple] = useState('');
    const [metodoAbonoMultiple, setMetodoAbonoMultiple] = useState<MetodoPago>('efectivo');
    
    // Categoría expandida para el estilo acordeón
    const [categoriaExpandida, setCategoriaExpandida] = useState<string | null>(null);

    // Acordeón de tickets de crédito en panel izquierdo
    const [expandedCreditos, setExpandedCreditos] = useState<Set<string>>(new Set());
    const toggleCreditoExpand = (id: string) => setExpandedCreditos(prev => {
        const s = new Set(prev);
        s.has(id) ? s.delete(id) : s.add(id);
        return s;
    });

    // Edición inline de abono existente
    const [editandoAbonoInfo, setEditandoAbonoInfo] = useState<{
        histId: string; abonoId?: string; idx: number; monto: string; metodo: MetodoPago;
    } | null>(null);

    const editarAbono = async () => {
        if (!editandoAbonoInfo) return;
        const { histId, abonoId, idx, monto: montoStr, metodo } = editandoAbonoInfo;
        const monto = parseFloat(montoStr);
        if (isNaN(monto) || monto <= 0) return toast.error('Monto inválido');
        if (updateCreditoCliente) {
            const esCentral = creditosClientes?.find(c => c.id === histId);
            if (esCentral) {
                try {
                    const nuevosPagos = (esCentral.pagos || []).map((p: any, i: number) =>
                        (abonoId ? p.id === abonoId : i === idx) ? { ...p, monto, metodoPago: metodo } : p
                    );
                    await updateCreditoCliente(histId, { pagos: nuevosPagos });
                } catch (e) { console.error('Error editando abono central', e); }
            }
        }
        const nuevos = historialMayoristas.map(h => {
            if (h.id !== histId) return h;
            const abonos = (h.abonos || []).map((a, i) =>
                (abonoId ? a.id === abonoId : i === idx) ? { ...a, monto, metodoPago: metodo } : a
            );
            return { ...h, abonos };
        });
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        setEditandoAbonoInfo(null);
        toast.success('Abono actualizado');
    };

    // WhatsApp cobro
    const [mensajesWA, setMensajesWA] = useState<Record<string, number>>(() => {
        try { return JSON.parse(localStorage.getItem('ag_mensajes_wa') || '{}'); } catch { return {}; }
    });
    const enviarWhatsApp = (cliente: Cliente, _saldo: number, tickets: typeof historialMayoristas) => {
        const tel = (cliente as any).telefono?.replace(/\D/g, '') || '';
        const fechaHoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
        const totalCompras = tickets.reduce((s, h) => s + h.total, 0);
        const totalAbonado = tickets.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0);
        const saldoTotal = totalCompras - totalAbonado;
        const metodoLabel: Record<string, string> = { efectivo: 'Efectivo', nequi: 'Nequi', transferencia: 'Transferencia', credito: 'Crédito' };

        const lineas: string[] = [
            '🥐 *DULCE PLACER*',
            '━━━━━━━━━━━━━━━━━━',
            '📋 *ESTADO DE CUENTA*',
            `👤 ${cliente.nombre}`,
            `📅 ${fechaHoy}`,
            '',
        ];

        tickets.forEach((h, idx) => {
            const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            const saldoTicket = h.total - abonado;
            const d = new Date(h.fecha);
            const fechaTicket = isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

            lineas.push('━━━━━━━━━━━━━━━━━━');
            lineas.push(`📌 *Ticket ${idx + 1}* — ${fechaTicket}`);
            h.items.forEach(item => {
                const nombre = item.nombre.length > 22 ? item.nombre.slice(0, 20) + '..' : item.nombre;
                lineas.push(`  • ${nombre} ×${item.cantidad}  ${formatCurrency(item.precio * item.cantidad)}`);
            });
            lineas.push(`  💵 *Total:* ${formatCurrency(h.total)}`);
            if ((h.abonos ?? []).length > 0) {
                lineas.push('  💳 *Abonos recibidos:*');
                (h.abonos ?? []).forEach(a => {
                    const fa = new Date(a.fecha);
                    const faStr = isNaN(fa.getTime()) ? '' : fa.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                    lineas.push(`    ✓ ${faStr} · ${metodoLabel[a.metodoPago] || a.metodoPago} · ${formatCurrency(a.monto)}`);
                });
            }
            lineas.push(saldoTicket <= 0 ? '  ✅ *SALDADO*' : `  ⚠️ *Pendiente: ${formatCurrency(saldoTicket)}*`);
            lineas.push('');
        });

        lineas.push('━━━━━━━━━━━━━━━━━━');
        if (tickets.length > 1) {
            lineas.push('📊 *RESUMEN*');
            lineas.push(`  Total compras:  ${formatCurrency(totalCompras)}`);
            if (totalAbonado > 0) lineas.push(`  Total abonado:  ${formatCurrency(totalAbonado)}`);
            lineas.push('');
        }
        if (saldoTotal <= 0) {
            lineas.push('✅ *¡Todo al día! Sin saldo pendiente.* 🎉');
        } else {
            lineas.push(`🔴 *TOTAL A PAGAR: ${formatCurrency(saldoTotal)}*`);
            lineas.push('');
            lineas.push('_Puedes abonar por:_');
            lineas.push('💵 Efectivo  |  📲 Nequi  |  🏦 Transferencia');
        }
        lineas.push('');
        lineas.push('_¡Gracias por tu preferencia! 🥐_');

        const msg = lineas.join('\n');
        const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        const nuevo = { ...mensajesWA, [cliente.id]: Date.now() };
        setMensajesWA(nuevo);
        localStorage.setItem('ag_mensajes_wa', JSON.stringify(nuevo));
    };

    // Notas por cliente
    const [notasClientes, setNotasClientes] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem('ag_notas_clientes') || '{}'); } catch { return {}; }
    });
    const [editandoNotaClienteId, setEditandoNotaClienteId] = useState<string | null>(null);
    const [notaTemp, setNotaTemp] = useState('');
    const guardarNotaCliente = (clienteId: string, nota: string) => {
        const nuevo = { ...notasClientes, [clienteId]: nota };
        setNotasClientes(nuevo);
        localStorage.setItem('ag_notas_clientes', JSON.stringify(nuevo));
        setEditandoNotaClienteId(null);
        toast.success('Nota guardada');
    };

    // Fichas del historial del cliente: créditos pendientes / tickets pagados
    const [perfilTab, setPerfilTab] = useState<'creditos' | 'pagados'>('creditos');
    const [busquedaTicket, setBusquedaTicket] = useState('');

    const registrarAbono = async (historialId: string, metodo: MetodoPago, montoEspecifico?: number) => {
        const monto = montoEspecifico ?? parseFloat(montoAbono);
        if (isNaN(monto) || monto <= 0) return toast.error('Monto inválido');

        // Respaldo en central (nube)
        if (registrarPagoCredito) {
            const esCentral = creditosClientes?.find(c => c.id === historialId);
            if (esCentral) {
                try {
                    await registrarPagoCredito(historialId, {
                        id: generateUUID(),
                        monto,
                        fecha: new Date().toISOString(),
                        metodoPago: metodo
                    });
                } catch (e) {
                    console.error('Error registrando abono en DB', e);
                }
            }
        }

        const nuevos = historialMayoristas.map(h => {
            if (h.id !== historialId) return h;
            const abonos: Abono[] = [...(h.abonos ?? []), { id: generateUUID(), monto, fecha: Date.now(), metodoPago: metodo }];
            return { ...h, abonos };
        });
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        
        setAbonandoId(null);
        setMontoAbono('');
        toast.success(`Abono de ${formatCurrency(monto)} registrado`);
    };

    const eliminarAbono = async (historialId: string, abonoId: string | undefined, abonoIndex: number) => {
        if (!confirm('¿Seguro que quieres eliminar este abono?')) return;

        // Respaldo en central (nube)
        if (updateCreditoCliente) {
            const esCentral = creditosClientes?.find(c => c.id === historialId);
            if (esCentral) {
                try {
                    // Si tiene ID, lo filtramos por ID, si no, intentamos por índice (aunque en BD central siempre deberían tener ID ahora)
                    const nuevosPagos = (esCentral.pagos || []).filter((p: any, idx: number) => abonoId ? p.id !== abonoId : idx !== abonoIndex);
                    await updateCreditoCliente(historialId, { pagos: nuevosPagos });
                } catch (e) {
                    console.error('Error eliminando abono en DB central', e);
                }
            }
        }

        // Actualización local
        const nuevos = historialMayoristas.map(h => {
            if (h.id !== historialId) return h;
            const abonos = (h.abonos || []).filter((a, idx) => abonoId ? a.id !== abonoId : idx !== abonoIndex);
            return { ...h, abonos };
        });
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        toast.success('Abono eliminado con éxito');
    };

    const procesarAbonoMultiple = async () => {
        if (!viendoPerfilCliente) return;
        const monto = parseFloat(montoAbonoMultiple);
        if (isNaN(monto) || monto <= 0) {
            toast.error('Ingresa un monto válido');
            return;
        }

        // Buscar tickets con saldo pendiente del cliente actual
        const tickets = historialMayoristas
            .filter(h => h.clienteId === viendoPerfilCliente.id && h.metodoPago === 'credito')
            .sort((a, b) => a.fecha - b.fecha); // Pagar los más antiguos primero

        let procesados = 0;
        let abonoRestante = monto;

        for (const item of tickets) {
            if (abonoRestante <= 0) break;
            const abonado = (item.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            const saldo = item.total - abonado;
            if (saldo <= 0) continue;

            const aPagar = Math.min(saldo, abonoRestante);
            if (aPagar > 0) {
                await registrarAbono(item.id, metodoAbonoMultiple, aPagar);
                abonoRestante -= aPagar;
                procesados++;
            }
        }

        // Si es abono para prepedidos / tickets pendientes
        const ticketsPendientesCliente = ticketsPendientes.filter(t => t.clienteId === viendoPerfilCliente.id);
        for (const tp of ticketsPendientesCliente) {
            if (abonoRestante <= 0) break;
            const saldo = tp.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
            if (saldo <= 0) continue;

            const aPagar = Math.min(saldo, abonoRestante);
            if (aPagar > 0) {
                // ticket pendiente: si se paga completo -> registrar venta; si es parcial -> crear crédito con abono inicial
                if (aPagar >= saldo) {
                    // pago completo: registrar y eliminar de pendientes
                    await registrarVenta({ items: tp.items, total: saldo, metodoPago: metodoAbonoMultiple as MetodoPago, notas: 'Ticket pendiente pagado', cliente: viendoPerfilCliente.nombre });
                    await guardarEnHistorial(tp.items, saldo, tp.fotoFactura, metodoAbonoMultiple as MetodoPago);
                    
                    // eliminar pendiente
                    actualizarTicketsPersistidos(ticketsPendientes.filter(t => t.id !== tp.id));
                    abonoRestante -= aPagar;
                    procesados++;
                } else {
                    // pago parcial: mover a historial como crédito y registrar abono
                    const nuevoHist: HistorialMayorista = {
                        id: generateUUID(),
                        clienteId: viendoPerfilCliente.id,
                        clienteNombre: viendoPerfilCliente.nombre,
                        items: tp.items,
                        total: saldo,
                        fecha: Date.now(),
                        fotoFactura: tp.fotoFactura,
                        metodoPago: 'credito',
                        abonos: [{ id: generateUUID(), monto: aPagar, fecha: Date.now(), metodoPago: metodoAbonoMultiple as MetodoPago }]
                    };
                    setHistorialMayoristas(prev => [nuevoHist, ...prev]);
                    
                    // Conectar con finanzas globales
                    if (addCreditoCliente) {
                        try {
                            await addCreditoCliente({
                                clienteId: viendoPerfilCliente.id,
                                clienteNombre: viendoPerfilCliente.nombre,
                                monto: saldo,
                                descripcion: 'Crédito generado desde ticket pendiente con abono parcial',
                                fecha: new Date().toISOString(),
                                items: tp.items.map(i => ({ productoId: i.productoId, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precio, subtotal: i.cantidad * i.precio })),
                                pagos: [{ id: nuevoHist.abonos![0].id, monto: aPagar, fecha: new Date(nuevoHist.abonos![0].fecha).toISOString(), metodoPago: nuevoHist.abonos![0].metodoPago }]
                            } as any);
                        } catch (e) {
                            console.error('Error registrando crédito global', e);
                        }
                    }

                    // eliminar pendiente
                    actualizarTicketsPersistidos(ticketsPendientes.filter(t => t.id !== tp.id));
                    abonoRestante -= aPagar;
                    procesados++;
                }
            }
        }

        if (procesados === 0) {
            toast.info('No hay deudas pendientes para abonar');
            return;
        }

        toast.success(`Abono aplicado a ${procesados} ticket(s). ${abonoRestante > 0 ? `Sobró ${formatCurrency(abonoRestante)}` : ''}`);
        setTicketsSeleccionados(new Set());
        setMontoAbonoMultiple('');
    };

    // Foto adjunta a entrada del historial (después de guardar)
    const historialFileInputRef = useRef<HTMLInputElement>(null);
    const [adjuntandoFotoHistorialId, setAdjuntandoFotoHistorialId] = useState<string | null>(null);

    const adjuntarFotoHistorial = (historialId: string, foto: string) => {
        const nuevos = historialMayoristas.map(h => h.id === historialId ? { ...h, fotoFactura: foto } : h);
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        toast.success('Foto adjuntada');
    };

    // Edición de ítems en entrada del historial (crédito)
    const [editandoHistorialId, setEditandoHistorialId] = useState<string | null>(null);
    const [busquedaEditTicket, setBusquedaEditTicket] = useState('');

    const persistirHistorial = (nuevos: HistorialMayorista[]) => {
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
    };

    const actualizarItemEnHistorial = async (historialId: string, productoId: string, delta: number) => {
        // Crédito central
        const esCentral = creditosClientes?.find(c => c.id === historialId);
        if (esCentral && updateCreditoCliente) {
            const items = ((esCentral.items || []) as any[])
                .map((i: any) => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
                .filter((i: any) => i.cantidad > 0);
            const monto = items.reduce((s: number, i: any) => s + i.precio * i.cantidad, 0);
            try { await updateCreditoCliente(historialId, { items, monto }); }
            catch (e) { console.error('Error actualizando item central', e); toast.error('Error al actualizar ticket'); }
            return;
        }
        // Local
        const nuevos = historialMayoristas.map(h => {
            if (h.id !== historialId) return h;
            const items = h.items
                .map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
                .filter(i => i.cantidad > 0);
            const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
            return { ...h, items, total };
        }).filter(h => h.items.length > 0);
        persistirHistorial(nuevos);
    };

    const agregarProductoAHistorial = async (historialId: string, productoId: string, nombre: string, precio: number) => {
        // Crédito central
        const esCentral = creditosClientes?.find(c => c.id === historialId);
        if (esCentral && updateCreditoCliente) {
            const itemsActuales = (esCentral.items || []) as any[];
            const existe = itemsActuales.find((i: any) => i.productoId === productoId);
            const items = existe
                ? itemsActuales.map((i: any) => i.productoId === productoId ? { ...i, cantidad: i.cantidad + 1 } : i)
                : [...itemsActuales, { productoId, nombre, precio, cantidad: 1 }];
            const monto = items.reduce((s: number, i: any) => s + i.precio * i.cantidad, 0);
            try {
                await updateCreditoCliente(historialId, { items, monto });
                toast.success(`${nombre} agregado al ticket`);
            } catch (e) { console.error('Error agregando producto central', e); toast.error('Error al actualizar ticket'); }
            return;
        }
        // Local
        const nuevos = historialMayoristas.map(h => {
            if (h.id !== historialId) return h;
            const existe = h.items.find(i => i.productoId === productoId);
            const items = existe
                ? h.items.map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + 1 } : i)
                : [...h.items, { productoId, nombre, precio, cantidad: 1 }];
            const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
            return { ...h, items, total };
        });
        persistirHistorial(nuevos);
        toast.success(`${nombre} agregado al ticket`);
    };

    // Override local de fechas para reflejar cambios inmediatamente sin esperar re-render del padre
    const [dateOverrides, setDateOverrides] = useState<Record<string, number>>({});

    // Cambiar fecha de una entrada del historial
    const [editandoFechaHistorialId, setEditandoFechaHistorialId] = useState<string | null>(null);
    const [fechaHistorialTemp, setFechaHistorialTemp] = useState('');

    const guardarFechaHistorial = async (historialId: string) => {
        if (!fechaHistorialTemp) return;

        // Evitar desplazamiento de zona horaria: crear la fecha local al mediodía
        const [y, m, d] = fechaHistorialTemp.split('-');
        const nuevaFecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0).getTime();

        if (isNaN(nuevaFecha)) { toast.error('Fecha inválida'); return; }

        const fechaISO = new Date(nuevaFecha).toISOString();

        // Intentar guardar en BD central si es un crédito registrado allí
        if (updateCreditoCliente) {
            const esCentral = creditosClientes?.find(c => c.id === historialId);
            if (esCentral) {
                try {
                    // Incluir updatedAt para que el smart-sync sepa que es dato nuevo
                    await updateCreditoCliente(historialId, {
                        fecha: fechaISO,
                        updatedAt: new Date().toISOString(),
                    } as any);
                } catch (e) {
                    console.error('Error al actualizar fecha en central', e);
                    toast.error('No se pudo guardar en la base de datos, se guardó solo localmente');
                }
            }
        }

        // Siempre actualizar en localStorage también (respaldo doble)
        const nuevos = historialMayoristas.map(h =>
            h.id === historialId ? { ...h, fecha: nuevaFecha } : h
        );
        // Si el ticket NO estaba en historialMayoristas (era solo central), agregarlo como respaldo
        const yaExisteLocal = nuevos.some(h => h.id === historialId);
        if (!yaExisteLocal) {
            const enUnificado = historialUnificado.find(h => h.id === historialId);
            if (enUnificado) {
                nuevos.unshift({ ...enUnificado, fecha: nuevaFecha } as any);
            }
        }
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));

        // Override inmediato en UI
        setDateOverrides(prev => ({ ...prev, [historialId]: nuevaFecha }));
        setEditandoFechaHistorialId(null);
        toast.success('Fecha guardada');
    };

    const eliminarHistorial = async (historialId: string) => {
        if (!confirm('¿Seguro que quieres eliminar este registro?')) return;
        const esCentral = creditosClientes?.find(c => c.id === historialId);
        if (esCentral) {
            if (deleteCreditoCliente) {
                try { await deleteCreditoCliente(historialId); }
                catch (e) { console.error('Error al eliminar crédito central', e); toast.error('Error al eliminar de la base de datos'); return; }
            } else {
                toast.error('No se puede eliminar este registro del servidor');
                return;
            }
        }
        const nuevos = historialMayoristas.filter(h => h.id !== historialId);
        setHistorialMayoristas(nuevos);
        localStorage.setItem('ag_historial_mayoristas', JSON.stringify(nuevos));
        toast.success('Registro eliminado');
    };

    const subirFotoHistorial = (historialId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => adjuntarFotoHistorial(historialId, ev.target?.result as string);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ── Overrides de precio mayorista por producto ───────────────────────────
    const [preciosOverride, setPreciosOverride] = useState<Record<string, number>>(() => {
        try { return JSON.parse(localStorage.getItem('ag_precios_mayorista_override') || '{}'); } catch { return {}; }
    });

    const setOverridePrecio = (productoId: string, precio: number | null) => {
        const nuevos = { ...preciosOverride };
        if (precio === null) delete nuevos[productoId];
        else nuevos[productoId] = precio;
        setPreciosOverride(nuevos);
        localStorage.setItem('ag_precios_mayorista_override', JSON.stringify(nuevos));
    };

    const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
    const [tempPrecio, setTempPrecio] = useState('');

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
            .filter(p => {
                // 🔥 No ocultaremos NADA en Mayorista. 
                // Permite ver insumos (si venden insumos al por mayor) y productos sin precio.
                return true;
            })
            .filter(p => !busqueda ||
                p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                (p.categoria || '').toLowerCase().includes(busqueda.toLowerCase())
            )
            .map(p => {
                const mejorPrecio = getMejorPrecio(p.id);
                let costo = calcularCosto(p, mejorPrecio);
                if (costo <= 0 && p.precioVenta > 0) costo = p.precioVenta / 1.30;
                
                // Aunque no se pueda calcular costo, no ocultaremos el producto
                // Para que el usuario lo vea y pueda fijarle precio manualmente

                // Precio mínimo al que la panadería puede vender sin perder
                const precioMinPanaderia = costo; // sin margen = break-even

                // Precio mayorista: usa override manual si existe, sino calcula con margen
                let precioMayoristaAuto = costo * (1 + config.margenNegocio / 100);
                if ((p as any).descuentoMayorista !== undefined && (p as any).descuentoMayorista > 0) {
                    precioMayoristaAuto = p.precioVenta * (1 - (p as any).descuentoMayorista / 100);
                }
                const precioMayorista = preciosOverride[p.id] ?? precioMayoristaAuto;
                const tieneOverride = preciosOverride[p.id] !== undefined;

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

                // Comparativa vs precio detal (PVP)
                const descuentoMonto = pvp - precioMayorista;
                const descuentoPct = pvp > 0 ? (descuentoMonto / pvp) * 100 : 0;

                return {
                    producto: p,
                    costo,
                    precioMinPanaderia,
                    precioMayorista,
                    precioMayoristaAuto,
                    precioReventa,
                    pvp,
                    margenPanaderiaReal,
                    margenRevendedorReal,
                    gananciaPanaderiaPorUnidad,
                    gananciRevendedorPorUnidad,
                    viabilidad,
                    reventaMenorQuePVP,
                    tieneOverride,
                    descuentoMonto,
                    descuentoPct,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .sort((a, b) => {
                const orden = { excelente: 0, viable: 1, ajustado: 2, inviable: 3 };
                return orden[a.viabilidad] - orden[b.viabilidad];
            });
    }, [productos, getMejorPrecio, config.margenNegocio, margenRevendedorEfectivo, busqueda, preciosOverride]);

    // Helper: normaliza categoría para comparaciones sin importar tildes/mayúsculas
    const normCat = (c: string | undefined) => (c || 'Sin categoría').toLowerCase().trim();

    // Mismo cálculo pero SIN filtro de busqueda — usado en catálogo de perfil cliente
    // para que la búsqueda principal no oculte productos en el mini-POS
    // tombstoneIds NO se aplica aquí: si el producto está en state, es porque no fue borrado.
    // El tombstone solo guarda contra sync; filtrar por él aquí causa inconsistencias.
    const tablaDatosTodos = useMemo(() => {
        const mapped = productos.map(p => {
                const mejorPrecio = getMejorPrecio(p.id);
                let costo = calcularCosto(p, mejorPrecio);
                if (costo <= 0 && p.precioVenta > 0) costo = p.precioVenta / 1.30;
                const precioMinPanaderia = costo;
                let precioMayoristaAuto = costo * (1 + config.margenNegocio / 100);
                if ((p as any).descuentoMayorista !== undefined && (p as any).descuentoMayorista > 0) {
                    precioMayoristaAuto = p.precioVenta * (1 - (p as any).descuentoMayorista / 100);
                }
                const precioMayorista = preciosOverride[p.id] ?? precioMayoristaAuto;
                const tieneOverride = preciosOverride[p.id] !== undefined;
                const precioReventa = precioMayorista * (1 + margenRevendedorEfectivo / 100);
                const pvp = p.precioVenta;
                const margenPanaderiaReal = costo > 0 ? ((precioMayorista - costo) / costo) * 100 : 0;
                const margenRevendedorReal = precioMayorista > 0 ? ((precioReventa - precioMayorista) / precioMayorista) * 100 : 0;
                const gananciaPanaderiaPorUnidad = precioMayorista - costo;
                const gananciRevendedorPorUnidad = precioReventa - precioMayorista;
                const reventaMenorQuePVP = precioReventa <= pvp * 1.05;
                const panaderiaGana = precioMayorista > costo * 1.05;
                const revendedorGana = gananciRevendedorPorUnidad > 0;
                let viabilidad: 'excelente' | 'viable' | 'ajustado' | 'inviable';
                if (panaderiaGana && revendedorGana && reventaMenorQuePVP) viabilidad = 'excelente';
                else if (panaderiaGana && revendedorGana) viabilidad = 'viable';
                else if (panaderiaGana) viabilidad = 'ajustado';
                else viabilidad = 'inviable';
                const descuentoMonto = pvp - precioMayorista;
                const descuentoPct = pvp > 0 ? (descuentoMonto / pvp) * 100 : 0;
                return { producto: p, costo, precioMinPanaderia, precioMayoristaAuto, precioMayorista, tieneOverride, precioReventa, pvp, margenPanaderiaReal, margenRevendedorReal, gananciaPanaderiaPorUnidad, gananciRevendedorPorUnidad, reventaMenorQuePVP, panaderiaGana, revendedorGana, viabilidad, descuentoMonto, descuentoPct };
            });

        // Cuando varios proveedores venden el mismo producto, mostrar solo el de mayor rentabilidad
        const normNombre = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
        const mejores = new Map<string, typeof mapped[0]>();
        mapped.forEach(d => {
            const key = normNombre(d.producto.nombre);
            const prev = mejores.get(key);
            if (!prev || d.margenPanaderiaReal > prev.margenPanaderiaReal) mejores.set(key, d);
        });

        return Array.from(mejores.values()).sort((a, b) => {
                const orden = { excelente: 0, viable: 1, ajustado: 2, inviable: 3 };
                return orden[a.viabilidad] - orden[b.viabilidad];
            });
    }, [productos, getMejorPrecio, config.margenNegocio, margenRevendedorEfectivo, preciosOverride]);

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

    const handleGuardarCliente = async () => {
        if (!formCliente.nombre?.trim()) { toast.error('El nombre es obligatorio'); return; }
        
        try {
            if (editandoCliente) {
                await updateCliente(editandoCliente.id, formCliente);
                toast.success('Cliente actualizado');
            } else {
                await addCliente({
                    ...formCliente,
                    tipo: 'mayorista' // Forzar tipo mayorista al crear desde aquí
                });
                toast.success(`"${formCliente.nombre}" agregado`);
            }
            setShowModalCliente(false);
        } catch (error) {
            toast.error('Error al guardar cliente');
        }
    };

    const eliminarCliente = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar este cliente?')) return;
        try {
            await deleteCliente(id);
            if (clienteSeleccionado?.id === id) setClienteSeleccionado(null);
            toast.success('Cliente eliminado');
        } catch (error) {
            toast.error('Error al eliminar cliente');
        }
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

    // ── Exportar historial del cliente a PDF ──────────────────────────────────
    const exportarHistorialPDF = (nombreCliente: string, tickets: typeof historialUnificado) => {
        const fmt = (n: number) => formatCurrency(n);
        const fmtFecha = (ms: number) => new Date(ms).toLocaleDateString('es', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const totalGeneral = tickets.reduce((s, t) => s + t.total, 0);
        const totalAbonado = tickets.reduce((s, t) => s + (t.abonos ?? []).reduce((a, b) => a + b.monto, 0), 0);
        const totalPendiente = totalGeneral - totalAbonado;
        const metodoBadgeLabel: Record<string, string> = { efectivo: 'Efectivo', nequi: 'Nequi', credito: 'Crédito' };
        const filas = tickets.map(h => {
            const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            const saldo = h.total - abonado;
            const metodo = metodoBadgeLabel[h.metodoPago ?? 'efectivo'] ?? (h.metodoPago ?? '');
            const items = h.items.map(i => `${i.cantidad}× ${i.nombre} &mdash; ${fmt(i.precio * i.cantidad)}`).join('<br>');
            const estadoCred = h.metodoPago === 'credito'
                ? (saldo > 0
                    ? `<span style="color:#dc2626;font-weight:700">Debe: ${fmt(saldo)}</span>`
                    : `<span style="color:#16a34a;font-weight:700">✓ Pagado</span>`)
                : `<span style="color:#16a34a;font-weight:700">Pagado</span>`;
            return `<tr>
              <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;white-space:nowrap">${fmtFecha(h.fecha)}</td>
              <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;line-height:1.5">${items || '—'}</td>
              <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:900;white-space:nowrap">${fmt(h.total)}</td>
              <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;white-space:nowrap">${metodo}</td>
              <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;white-space:nowrap">${estadoCred}</td>
            </tr>`;
        }).join('');
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Historial — ${nombreCliente}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin:0}
  .sub{font-size:11px;color:#64748b;margin-top:2px}
  .kpi-row{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;flex:1;min-width:120px}
  .kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em}
  .kpi-value{font-size:18px;font-weight:900;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:14px}
  th{background:#1e293b;color:white;padding:8px 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left}
  tr:nth-child(even) td{background:#f8fafc}
  @media print{body{margin:10px}button{display:none}}
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>Historial de Cliente</h1>
    <p class="sub">Panadería Dulce Placer &middot; Módulo Mayoristas</p>
  </div>
  <button onclick="window.print()" style="background:#4f46e5;color:white;border:none;border-radius:8px;padding:8px 18px;font-weight:700;font-size:12px;cursor:pointer">Imprimir / PDF</button>
</div>
<h2 style="font-size:16px;margin:14px 0 2px">${nombreCliente}</h2>
<p class="sub">Generado el ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">Total facturado</div><div class="kpi-value">${fmt(totalGeneral)}</div></div>
  <div class="kpi"><div class="kpi-label">Total abonado</div><div class="kpi-value" style="color:#16a34a">${fmt(totalAbonado)}</div></div>
  <div class="kpi"><div class="kpi-label">Saldo pendiente</div><div class="kpi-value" style="color:${totalPendiente > 0 ? '#dc2626' : '#16a34a'}">${fmt(totalPendiente)}</div></div>
  <div class="kpi"><div class="kpi-label">Tickets</div><div class="kpi-value">${tickets.length}</div></div>
</div>
<table>
  <thead><tr>
    <th>Fecha</th><th>Productos</th>
    <th style="text-align:right">Total</th>
    <th style="text-align:center">Método</th>
    <th style="text-align:right">Estado</th>
  </tr></thead>
  <tbody>${filas}</tbody>
</table>
</body>
</html>`;
        const win = window.open('', '_blank', 'width=860,height=680');
        if (!win) { toast.error('Habilita ventanas emergentes para exportar PDF'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    };

    // ── Consolidar Historial Local y Centralizado para la UI ──
    const historialUnificado = useMemo(() => {
        // Normaliza cualquier fecha (number | ISO string | legacy) a timestamp ms
        const toMs = (f: number | string | undefined): number => {
            if (!f) return 0;
            if (typeof f === 'number') return f;
            const t = new Date(f).getTime();
            return isNaN(t) ? 0 : t;
        };

        // 1. Efectivo / otros métodos — siempre vienen de localStorage
        const localCash = historialMayoristas.filter(h => h.metodoPago !== 'credito').map(h => ({
            ...h,
            fecha: dateOverrides[h.id] ?? toMs(h.fecha),
        }));

        // 2. Créditos de la BD central (Supabase / IndexedDB) — fuente autoritativa
        const centralCredits = (creditosClientes ?? []).map(c => ({
            id: c.id,
            clienteId: c.clienteId,
            clienteNombre: c.clienteNombre,
            fecha: dateOverrides[c.id] ?? toMs(c.fecha || c.createdAt),
            total: c.monto,
            items: c.items || [],
            metodoPago: 'credito' as MetodoPago,
            abonos: (c.pagos || []).map((p: any) => ({
                id: p.id,
                monto: p.monto,
                fecha: toMs(p.fecha),
                metodoPago: (p.metodoPago || 'efectivo') as MetodoPago
            })),
            fotoFactura: undefined
        }));

        // 3. Créditos HUÉRFANOS: solo en localStorage, no llegaron a la BD
        //    (creados offline, fallo de red, etc.) — se muestran como fallback
        const centralIds = new Set(centralCredits.map(c => c.id));
        const localCreditHuerfanos = historialMayoristas
            .filter(h => h.metodoPago === 'credito' && !centralIds.has(h.id))
            .map(h => ({
                ...h,
                fecha: dateOverrides[h.id] ?? toMs(h.fecha),
            }));

        // 4. Deduplicar por ID — centralCredits > localCreditHuerfanos > localCash
        const seen = new Set<string>();
        const deduped = [...centralCredits, ...localCash, ...localCreditHuerfanos].filter(h => {
            if (seen.has(h.id)) return false;
            seen.add(h.id);
            return true;
        });
        // Siempre más reciente primero — toMs garantiza que no haya NaN
        return deduped.sort((a, b) => b.fecha - a.fecha);
    }, [historialMayoristas, creditosClientes, dateOverrides]);

    // Confirmar pago completo de un ticket de crédito (registra abono por el saldo restante)
    const marcarComoPagado = async (historialId: string, metodo: MetodoPago) => {
        const h = historialUnificado.find(x => x.id === historialId);
        if (!h) return;
        const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
        const saldo = h.total - abonado;
        if (saldo <= 0) { toast.info('Ticket ya está pagado'); return; }
        await registrarAbono(historialId, metodo, saldo);
        toast.success(`✓ Pagado · ${formatCurrency(saldo)} vía ${metodo}`);
        setPerfilTab('pagados');
    };

    // Confirmar pago de todos los créditos pendientes del cliente activo
    const marcarTodosPagados = async (metodo: MetodoPago) => {
        if (!viendoPerfilCliente) return;
        const pendientes = historialUnificado.filter(h => {
            if (h.clienteId !== viendoPerfilCliente.id || h.metodoPago !== 'credito') return false;
            const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            return h.total - ab > 0;
        });
        if (pendientes.length === 0) { toast.info('No hay créditos pendientes'); return; }
        for (const h of pendientes) {
            const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            await registrarAbono(h.id, metodo, h.total - ab);
        }
        toast.success(`✓ ${pendientes.length} ticket(s) marcados como pagados`);
        setPerfilTab('pagados');
    };

    // ── Mini-POS del Cliente ─────────────────────────────────────────────────
    if (viendoPerfilCliente) {
        const cliente = viendoPerfilCliente;
        const tConf = TIPO_CONFIG[cliente.tipo] || TIPO_CONFIG.mayorista;
        // Deduplica categorías normalizando mayúsculas/tildes para evitar "Postobon" y "Postobón" como dos botones separados
        const catMapPerfil = new Map<string, string>();
        tablaDatosTodos.forEach(d => {
            const cat = d.producto.categoria || 'Sin categoría';
            const key = normCat(cat);
            if (!catMapPerfil.has(key)) catMapPerfil.set(key, cat);
        });
        const categoriasPerfil = Array.from(catMapPerfil.values()).sort();
        const productosPerfil = tablaDatosTodos
            .filter(d => !busquedaPerfil || d.producto.nombre.toLowerCase().includes(busquedaPerfil.toLowerCase()))
            .filter(d => !categoriaPerfil || normCat(d.producto.categoria) === normCat(categoriaPerfil));

        // Créditos pendientes del cliente (para botón WA del header)
        const creditosPendientesHeader = historialUnificado.filter(h => {
            if (h.clienteId !== cliente.id || h.metodoPago !== 'credito') return false;
            const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
            return h.total - ab > 0;
        });
        const totalDeudaHeader = creditosPendientesHeader.reduce((s, h) => {
            const ab = (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0);
            return s + (h.total - ab);
        }, 0);

        return (
            <div className="min-h-screen flex flex-col gap-0 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => { setViendoPerfilCliente(null); setBusquedaPerfil(''); setCarritoPos([]); setCategoriaPerfil(''); }}
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
                    <div className="flex items-center gap-2">
                        {/* Buscador movido al panel de productos para más espacio */}
                        <button
                            onClick={() => setVerHistorial(true)}
                            className="relative w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                            title="Ver historial"
                        >
                            <History className="w-4 h-4" />
                            {historialUnificado.filter(h => h.clienteId === cliente.id).length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                    {historialUnificado.filter(h => h.clienteId === cliente.id).length}
                                </span>
                            )}
                        </button>
                        {creditosPendientesHeader.length > 0 && (
                            <button
                                onClick={() => enviarWhatsApp(cliente, totalDeudaHeader, creditosPendientesHeader)}
                                title={`Enviar estado de cuenta por WhatsApp · Debe ${formatCurrency(totalDeudaHeader)}`}
                                className="relative h-10 px-3 rounded-xl bg-[#25D366] text-white text-[10px] font-black uppercase hover:bg-[#1da851] flex items-center gap-1.5 shadow-sm transition-colors"
                            >
                                <MessageCircle className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Cobrar</span>
                                <span className="hidden sm:inline font-black">{formatCurrency(totalDeudaHeader)}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── CUENTA DEL CLIENTE: Créditos / Pagados ── */}
                {(() => {
                    const byDateDesc = (a: {fecha: number}, b: {fecha: number}) => b.fecha - a.fecha;
                    const histCliente = historialUnificado.filter(h => h.clienteId === cliente.id);
                    const creditosPendientes = histCliente.filter(h => {
                        if (h.metodoPago !== 'credito') return false;
                        const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                        return h.total - ab > 0;
                    }).sort(byDateDesc);
                    const ticketsPagados = histCliente.filter(h => {
                        if (h.metodoPago !== 'credito') return true;
                        const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                        return h.total - ab <= 0;
                    }).sort(byDateDesc);

                    // ── Filtro de búsqueda ──
                    const q = busquedaTicket.trim().toLowerCase();
                    const matchTicket = (h: typeof histCliente[0]) => {
                        if (!q) return true;
                        const d = new Date(h.fecha);
                        const fechaTexto = isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
                        const productosTexto = h.items.map(i => i.nombre).join(' ').toLowerCase();
                        const totalTexto = h.total.toString();
                        return (
                            fechaTexto.toLowerCase().includes(q) ||
                            productosTexto.includes(q) ||
                            totalTexto.includes(q) ||
                            (h.metodoPago ?? '').toLowerCase().includes(q) ||
                            (notasClientes[h.id] ?? '').toLowerCase().includes(q)
                        );
                    };
                    const creditosFiltrados = creditosPendientes.filter(matchTicket);
                    const pagadosFiltrados = ticketsPagados.filter(matchTicket);

                    const totalDeuda = creditosPendientes.reduce((s, h) => {
                        const ab = (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0);
                        return s + (h.total - ab);
                    }, 0);
                    const hasPendientes = totalDeuda > 0;
                    return (
                        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                            {/* Fichas de navegación */}
                            <div className="flex border-b border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setPerfilTab('creditos')}
                                    className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 px-6 font-black text-sm uppercase tracking-wider transition-colors ${perfilTab === 'creditos' ? 'text-rose-600 bg-rose-50/70 dark:bg-rose-950/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    {perfilTab === 'creditos' && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-rose-400 to-rose-600 rounded-t-full" />}
                                    <CreditCard className="w-4 h-4" />
                                    Créditos
                                    {creditosPendientes.length > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none transition-colors ${perfilTab === 'creditos' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                            {creditosPendientes.length}
                                        </span>
                                    )}
                                    {hasPendientes && (
                                        <span className={`text-xs font-black tabular-nums ml-1 hidden sm:inline ${perfilTab === 'creditos' ? 'text-rose-600' : 'text-slate-400'}`}>{formatCurrency(totalDeuda)}</span>
                                    )}
                                </button>
                                <div className="w-px bg-slate-200 dark:bg-slate-700 my-2" />
                                <button
                                    onClick={() => setPerfilTab('pagados')}
                                    className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 px-6 font-black text-sm uppercase tracking-wider transition-colors ${perfilTab === 'pagados' ? 'text-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    {perfilTab === 'pagados' && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-t-full" />}
                                    <CheckCircle2 className="w-4 h-4" />
                                    Pagados
                                    {ticketsPagados.length > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none transition-colors ${perfilTab === 'pagados' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {ticketsPagados.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Buscador de tickets */}
                            {histCliente.length > 2 && (
                                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={busquedaTicket}
                                            onChange={e => setBusquedaTicket(e.target.value)}
                                            placeholder="Buscar por fecha, producto o monto…"
                                            className="w-full h-8 pl-9 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all"
                                        />
                                        {busquedaTicket && (
                                            <button onClick={() => setBusquedaTicket('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {busquedaTicket && (
                                        <p className="text-[9px] text-slate-400 font-bold mt-1.5">
                                            {creditosFiltrados.length + pagadosFiltrados.length} resultado(s) de {histCliente.length} tickets
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Contenido de la ficha activa */}
                            <div className="p-4 max-h-80 overflow-y-auto">
                                {perfilTab === 'creditos' ? (
                                    <div className="space-y-3">
                                        {/* Resumen de deuda + Pagar todo */}
                                        {creditosPendientes.length > 0 && (
                                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total pendiente</p>
                                                    <p className="text-2xl font-black text-rose-600 tabular-nums leading-none">{formatCurrency(totalDeuda)}</p>
                                                </div>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {(['efectivo','nequi','transferencia'] as MetodoPago[]).map(m => (
                                                        <button key={m} onClick={() => marcarTodosPagados(m)}
                                                            className={`h-8 px-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm ${m==='efectivo'?'bg-emerald-100 text-emerald-700 hover:bg-emerald-200':m==='nequi'?'bg-violet-100 text-violet-700 hover:bg-violet-200':'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                                                            <CheckCircle2 className="w-3 h-3"/>Pagar todo · {m==='transferencia'?'Cta':m==='efectivo'?'Efec':'Neq'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Lista de créditos pendientes */}
                                        {creditosFiltrados.length === 0 ? (
                                            <div className="py-8 flex flex-col items-center gap-2 opacity-50">
                                                {busquedaTicket ? (
                                                    <>
                                                        <Search className="w-8 h-8 text-slate-300"/>
                                                        <p className="text-xs text-slate-400 font-black uppercase">Sin resultados para "{busquedaTicket}"</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-10 h-10 text-emerald-500"/>
                                                        <p className="text-xs text-slate-400 font-black uppercase">Sin créditos pendientes · Cliente al día</p>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {creditosFiltrados.map(h => {
                                                    const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                    const saldo = h.total - abonado;
                                                    const expanded = expandedCreditos.has(h.id);
                                                    const clienteObj = allClientes.find(c => c.id === h.clienteId);
                                                    const metodoBadgeCls: Record<string,string> = { efectivo:'bg-emerald-100 text-emerald-700', nequi:'bg-violet-100 text-violet-700', transferencia:'bg-blue-100 text-blue-700', credito:'bg-rose-100 text-rose-700' };
                                                    return (
                                                        <div key={h.id} className="rounded-2xl overflow-hidden shadow-sm border border-indigo-200 dark:border-indigo-800 transition-all duration-200">
                                                            <button className="w-full text-left px-3 py-2.5 flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 hover:from-indigo-100/70 transition-colors" onClick={() => toggleCreditoExpand(h.id)}>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-[11px] font-black text-slate-800 dark:text-white">
                                                                            {(() => { const d = new Date(h.fecha); return isNaN(d.getTime()) ? 'Sin Fecha' : d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                        </span>
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">Debe {formatCurrency(saldo)}</span>
                                                                    </div>
                                                                    <div className="flex gap-2 mt-0.5">
                                                                        <span className="text-[8px] text-slate-500">Compra: <b className="text-slate-700 dark:text-slate-300">{formatCurrency(h.total)}</b></span>
                                                                        {abonado > 0 && <span className="text-[8px] text-emerald-600">Abonado: <b>{formatCurrency(abonado)}</b></span>}
                                                                    </div>
                                                                    <p className="text-[9px] text-slate-500 truncate mt-0.5">
                                                                        {h.items.slice(0,3).map(i=>`${i.nombre}×${i.cantidad}`).join(' · ')}{h.items.length>3?` +${h.items.length-3} más`:''}
                                                                    </p>
                                                                </div>
                                                                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${expanded?'rotate-180 text-indigo-500':'text-slate-400'}`}/>
                                                            </button>
                                                            {/* Botones de acción — siempre visibles */}
                                                            <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-1.5">
                                                                <button onClick={(e)=>{e.stopPropagation();editarTicketEnPOS(h);}} className="h-7 px-3 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[9px] font-black uppercase flex items-center justify-center gap-1 transition-colors shrink-0">
                                                                    <Pencil className="w-3 h-3"/>Editar
                                                                </button>
                                                                {clienteObj && (
                                                                    <button onClick={() => enviarWhatsApp(clienteObj, saldo, [h])} className="flex-1 h-7 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors">
                                                                        <MessageCircle className="w-3.5 h-3.5"/>WhatsApp · {formatCurrency(saldo)}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {expanded && (
                                                                <div className="bg-white dark:bg-slate-900 px-3 pb-3 pt-2 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
                                                                    <div className="flex items-start gap-2">
                                                                        {h.fotoFactura ? (
                                                                            <button onClick={() => window.open(h.fotoFactura,'_blank')} className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-indigo-100 shadow-sm hover:opacity-90 transition-opacity">
                                                                                <img src={h.fotoFactura} alt="Factura" className="w-full h-full object-cover"/>
                                                                            </button>
                                                                        ) : (
                                                                            <label className="shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-indigo-300 transition-colors bg-slate-50 dark:bg-slate-800">
                                                                                <Camera className="w-4 h-4 text-slate-300"/>
                                                                                <span className="text-[7px] font-black uppercase text-slate-300">Foto</span>
                                                                                <input type="file" accept="image/*" className="hidden" onChange={e=>subirFotoHistorial(h.id,e)}/>
                                                                            </label>
                                                                        )}
                                                                        <div className="flex-1 min-w-0 space-y-1">
                                                                            {editandoFechaHistorialId===h.id ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <Input type="date" value={fechaHistorialTemp} onChange={e=>setFechaHistorialTemp(e.target.value)} className="h-6 text-[10px] bg-white dark:bg-slate-800 flex-1"/>
                                                                                    <button onClick={()=>guardarFechaHistorial(h.id)} className="text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5"/></button>
                                                                                    <button onClick={()=>setEditandoFechaHistorialId(null)} className="text-rose-500"><X className="w-3.5 h-3.5"/></button>
                                                                                </div>
                                                                            ) : (
                                                                                <button onClick={()=>{const d=new Date(h.fecha);const s=isNaN(d.getTime())?new Date():d;setEditandoFechaHistorialId(h.id);const yy=s.getFullYear(),mo=String(s.getMonth()+1).padStart(2,'0'),dd=String(s.getDate()).padStart(2,'0');setFechaHistorialTemp(`${yy}-${mo}-${dd}`);}} className="flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-700">
                                                                                    <Edit2 className="w-2.5 h-2.5"/>{(() => { const d=new Date(h.fecha); return isNaN(d.getTime())?'Sin Fecha':d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                                </button>
                                                                            )}
                                                                            <div className="space-y-0.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2 mt-1">
                                                                                {h.items.map(item=>(
                                                                                    <div key={item.productoId} className="flex items-center gap-2 text-[9px]">
                                                                                        <span className="text-slate-600 dark:text-slate-400 truncate flex-1">{item.nombre}</span>
                                                                                        {editandoHistorialId===h.id ? (
                                                                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 px-1 py-0.5 shrink-0">
                                                                                                <button onClick={()=>actualizarItemEnHistorial(h.id,item.productoId,-1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-rose-500"><Minus className="w-2.5 h-2.5"/></button>
                                                                                                <span className="font-black w-4 text-center tabular-nums">{item.cantidad}</span>
                                                                                                <button onClick={()=>actualizarItemEnHistorial(h.id,item.productoId,1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-indigo-500"><Plus className="w-2.5 h-2.5"/></button>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-slate-500 shrink-0">×{item.cantidad}</span>
                                                                                        )}
                                                                                        <span className="shrink-0 font-black text-slate-700 dark:text-slate-300"><span className="text-indigo-600">{formatCurrency(item.precio*item.cantidad)}</span></span>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                                                                                    <button onClick={()=>setEditandoHistorialId(editandoHistorialId===h.id?null:h.id)} className={`text-[9px] font-black uppercase tracking-wide flex items-center gap-1 transition-colors ${editandoHistorialId===h.id?'text-indigo-600':'text-slate-400 hover:text-indigo-500'}`}>
                                                                                        <Pencil className="w-2.5 h-2.5"/>{editandoHistorialId===h.id?'Listo':'Editar ticket'}
                                                                                    </button>
                                                                                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 tabular-nums">Total: {formatCurrency(h.total)}</span>
                                                                                </div>
                                                                                {editandoHistorialId===h.id && (
                                                                                    <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800 space-y-1.5">
                                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3"/>Agregar producto</p>
                                                                                        <input type="text" placeholder="Buscar producto..." value={busquedaEditTicket} onChange={e=>setBusquedaEditTicket(e.target.value)} className="w-full h-7 rounded-lg border border-indigo-200 bg-white dark:bg-slate-800 px-2 text-[10px] outline-none focus:border-indigo-400"/>
                                                                                        {busquedaEditTicket.length>=2 && (
                                                                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                                                                                {tablaDatosTodos.filter(d=>d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase())).slice(0,8).map(d=>(
                                                                                                    <button key={d.producto.id} onClick={()=>{agregarProductoAHistorial(h.id,d.producto.id,d.producto.nombre,d.precioMayorista);setBusquedaEditTicket('');}} className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left">
                                                                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{d.producto.nombre}</span>
                                                                                                        <span className="text-[9px] font-black text-indigo-600 shrink-0 ml-2">{formatCurrency(d.precioMayorista)}</span>
                                                                                                    </button>
                                                                                                ))}
                                                                                                {tablaDatosTodos.filter(d=>d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase())).length===0 && <p className="text-[10px] text-slate-400 text-center py-1">Sin resultados</p>}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {h.fotoFactura && (
                                                                                <label className="inline-flex items-center gap-1 text-[8px] text-slate-400 hover:text-indigo-500 cursor-pointer mt-0.5">
                                                                                    <Camera className="w-2.5 h-2.5"/>Cambiar foto
                                                                                    <input type="file" accept="image/*" className="hidden" onChange={e=>subirFotoHistorial(h.id,e)}/>
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {(h.abonos??[]).length>0 && (
                                                                        <div className="space-y-1">
                                                                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Abonos recibidos</p>
                                                                            {(h.abonos??[]).map((a,idx)=>(
                                                                                <div key={a.id||idx}>
                                                                                    {editandoAbonoInfo?.histId===h.id&&(editandoAbonoInfo.abonoId===a.id||editandoAbonoInfo.idx===idx) ? (
                                                                                        <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 p-1.5 rounded-lg">
                                                                                            <input type="number" value={editandoAbonoInfo.monto} onChange={e=>setEditandoAbonoInfo(p=>p?{...p,monto:e.target.value}:null)} className="w-16 h-6 text-[10px] rounded border border-indigo-200 bg-white px-1.5 outline-none" autoFocus/>
                                                                                            <select value={editandoAbonoInfo.metodo} onChange={e=>setEditandoAbonoInfo(p=>p?{...p,metodo:e.target.value as MetodoPago}:null)} className="h-6 text-[9px] rounded border border-indigo-200 bg-white px-1 outline-none">
                                                                                                <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="transferencia">Cuenta</option><option value="credito">Crédito</option>
                                                                                            </select>
                                                                                            <button onClick={editarAbono} className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center"><Check className="w-2.5 h-2.5"/></button>
                                                                                            <button onClick={()=>setEditandoAbonoInfo(null)} className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center"><X className="w-2.5 h-2.5"/></button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 px-2 py-1 rounded-lg">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded-sm ${metodoBadgeCls[a.metodoPago]??'bg-slate-100 text-slate-600'}`}>{a.metodoPago}</span>
                                                                                                <span className="text-[8px] text-slate-500">{new Date(a.fecha).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                                                                                                <span className="text-[10px] font-black text-emerald-700">+{formatCurrency(a.monto)}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-0.5">
                                                                                                <button onClick={e=>{e.stopPropagation();setEditandoAbonoInfo({histId:h.id,abonoId:a.id,idx,monto:String(a.monto),metodo:a.metodoPago});}} className="w-4 h-4 rounded bg-indigo-50 text-indigo-500 hover:bg-indigo-100 flex items-center justify-center"><Edit2 className="w-2 h-2"/></button>
                                                                                                <button onClick={e=>{e.stopPropagation();eliminarAbono(h.id,a.id,idx);}} className="w-4 h-4 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center"><Trash2 className="w-2 h-2"/></button>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {abonandoId===h.id ? (
                                                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2 space-y-1.5">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <input type="number" value={montoAbono} onChange={e=>setMontoAbono(e.target.value)} placeholder="Monto" autoFocus className="flex-1 h-7 rounded-lg border border-indigo-200 bg-white dark:bg-slate-800 px-2 text-xs outline-none focus:border-indigo-400"/>
                                                                                <button onClick={()=>{setAbonandoId(null);setMontoAbono('');}} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-300"><X className="w-3 h-3"/></button>
                                                                            </div>
                                                                            <div className="flex gap-1">
                                                                                <button onClick={()=>registrarAbono(h.id,'efectivo')} className="flex-1 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black hover:bg-emerald-200">Efectivo</button>
                                                                                <button onClick={()=>registrarAbono(h.id,'nequi')} className="flex-1 h-7 rounded-lg bg-violet-100 text-violet-700 text-[9px] font-black hover:bg-violet-200">Nequi</button>
                                                                                <button onClick={()=>registrarAbono(h.id,'transferencia')} className="flex-1 h-7 rounded-lg bg-blue-100 text-blue-700 text-[9px] font-black hover:bg-blue-200">Cuenta</button>
                                                                                <button onClick={()=>registrarAbono(h.id,'credito')} className="flex-1 h-7 rounded-lg bg-rose-100 text-rose-700 text-[9px] font-black hover:bg-rose-200">Cred.</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={()=>{setAbonandoId(h.id);setMontoAbono('');}} className="w-full h-7 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase hover:bg-indigo-700 flex items-center justify-center gap-1">
                                                                            <Plus className="w-3 h-3"/> Registrar abono
                                                                        </button>
                                                                    )}

                                                                    <div>
                                                                        <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1">Confirmar pago completo · saldo {formatCurrency(saldo)}</p>
                                                                        <div className="flex gap-1">
                                                                            <button onClick={()=>marcarComoPagado(h.id,'efectivo')} className="flex-1 h-7 rounded-lg bg-emerald-500 text-white text-[8px] font-black hover:bg-emerald-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Efectivo</button>
                                                                            <button onClick={()=>marcarComoPagado(h.id,'nequi')} className="flex-1 h-7 rounded-lg bg-violet-500 text-white text-[8px] font-black hover:bg-violet-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Nequi</button>
                                                                            <button onClick={()=>marcarComoPagado(h.id,'transferencia')} className="flex-1 h-7 rounded-lg bg-blue-500 text-white text-[8px] font-black hover:bg-blue-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Cuenta</button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1.5">
                                                                        {clienteObj && (
                                                                            <button onClick={()=>enviarWhatsApp(clienteObj,saldo,[h])}
                                                                                title={mensajesWA[clienteObj.id]?`Último: ${new Date(mensajesWA[clienteObj.id]).toLocaleDateString('es-CO')}`:'Enviar este ticket por WhatsApp'}
                                                                                className="flex-1 h-7 rounded-xl bg-[#25D366] text-white text-[9px] font-black uppercase hover:bg-[#1da851] flex items-center justify-center gap-1">
                                                                                <MessageCircle className="w-3 h-3"/>WA Ticket
                                                                            </button>
                                                                        )}
                                                                        {editandoNotaClienteId===h.id ? (
                                                                            <div className="flex-1 flex items-center gap-1">
                                                                                <input value={notaTemp} onChange={e=>setNotaTemp(e.target.value)} placeholder="Nota..." autoFocus className="flex-1 h-7 rounded-lg border border-indigo-200 bg-white px-2 text-[9px] outline-none"/>
                                                                                <button onClick={()=>guardarNotaCliente(h.id,notaTemp)} className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center"><Check className="w-3 h-3"/></button>
                                                                                <button onClick={()=>setEditandoNotaClienteId(null)} className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center"><X className="w-3 h-3"/></button>
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={()=>{setEditandoNotaClienteId(h.id);setNotaTemp(notasClientes[h.id]||'');}} className="flex-1 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black hover:bg-slate-200 flex items-center justify-center gap-1 truncate">
                                                                                <StickyNote className="w-3 h-3 shrink-0"/><span className="truncate">{notasClientes[h.id]||'Nota'}</span>
                                                                            </button>
                                                                        )}
                                                                        <button onClick={()=>eliminarHistorial(h.id)} className="w-7 h-7 rounded-xl border border-dashed border-red-300 text-red-500 hover:bg-red-50 flex items-center justify-center" title="Eliminar ticket">
                                                                            <Trash2 className="w-3 h-3"/>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* ── Ficha: Pagados ── */
                                    <div className="space-y-2">
                                        {ticketsPagados.length === 0 ? (
                                            <div className="py-8 flex flex-col items-center gap-2 opacity-50">
                                                <Receipt className="w-8 h-8 text-slate-300"/>
                                                <p className="text-xs text-slate-400 font-black uppercase">Sin tickets pagados aún</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {ticketsPagados.map(h => {
                                                    const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                    const metodoLabel: Record<string,string> = { efectivo:'Efectivo', nequi:'Nequi', transferencia:'Cuenta', credito:'Crédito' };
                                                    const metodoCls: Record<string,string> = { efectivo:'bg-emerald-100 text-emerald-700', nequi:'bg-violet-100 text-violet-700', transferencia:'bg-blue-100 text-blue-700', credito:'bg-indigo-100 text-indigo-700' };
                                                    return (
                                                        <div key={h.id} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                                                        {(() => { const d=new Date(h.fecha); return isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                    </span>
                                                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">✓ Pagado</span>
                                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${metodoCls[h.metodoPago??'efectivo']??'bg-slate-100 text-slate-600'}`}>
                                                                        {metodoLabel[h.metodoPago??'efectivo']??h.metodoPago}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 truncate">
                                                                    {h.items.slice(0,3).map(i=>`${i.nombre}×${i.cantidad}`).join(' · ')}{h.items.length>3?` +${h.items.length-3} más`:''}
                                                                </p>
                                                                {h.metodoPago === 'credito' && abonado > 0 && (
                                                                    <p className="text-[8px] text-emerald-600 mt-0.5">Abonado: {formatCurrency(abonado)}</p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-[12px] font-black text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(h.total)}</p>
                                                                {h.fotoFactura && (
                                                                    <button onClick={()=>window.open(h.fotoFactura,'_blank')} className="mt-1 w-8 h-8 rounded-lg overflow-hidden border border-emerald-200 hover:opacity-80 block ml-auto">
                                                                        <img src={h.fotoFactura} alt="Foto" className="w-full h-full object-cover"/>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Layout dos columnas */}
                <div className="flex flex-col lg:flex-row flex-1 gap-0 min-h-0 overflow-hidden">

                    {/* ── PANEL IZQUIERDO: Productos ── */}
                    <div className={cn("flex-1 p-4 space-y-4 overflow-y-auto", showMobilePOSCart && "hidden lg:block")}>
                        {/* Buscador siempre visible + filtro categoría compacto */}
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar producto por nombre..."
                                    value={busquedaPerfil}
                                    onChange={e => { setBusquedaPerfil(e.target.value); setCategoriaPerfil(''); }}
                                    className="h-10 pl-9 rounded-xl border-slate-200 bg-white text-xs font-bold"
                                />
                            </div>

                            {/* Filtro por categoría — scroll horizontal, sin wrap */}
                            {categoriasPerfil.length > 1 && (
                                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                    <button
                                        onClick={() => { setCategoriaPerfil(''); setBusquedaPerfil(''); }}
                                        className={cn(
                                            'shrink-0 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors whitespace-nowrap',
                                            !categoriaPerfil
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                        )}
                                    >
                                        Todas
                                    </button>
                                    {categoriasPerfil.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setCategoriaPerfil(cat === categoriaPerfil ? '' : cat); setBusquedaPerfil(''); }}
                                            className={cn(
                                                'shrink-0 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors whitespace-nowrap',
                                                categoriaPerfil === cat
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cuenta del cliente — ver sección superior */}
                        {false && (() => {
                            const histCliente = historialUnificado.filter(h => h.clienteId === cliente.id);
                            const creditosPendientes = histCliente.filter(h => {
                                if (h.metodoPago !== 'credito') return false;
                                const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                return h.total - ab > 0;
                            });
                            const ticketsPagados = histCliente.filter(h => {
                                if (h.metodoPago !== 'credito') return true;
                                const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                return h.total - ab <= 0;
                            });
                            const totalDeuda = creditosPendientes.reduce((s, h) => {
                                const ab = (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0);
                                return s + (h.total - ab);
                            }, 0);
                            const hasPendientes = totalDeuda > 0;
                            return (
                                <div className={`rounded-2xl border overflow-hidden shadow-sm ${hasPendientes ? 'border-rose-200 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                    {/* Header resumen */}
                                    <div className={`px-4 py-3 flex items-center justify-between ${hasPendientes ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-emerald-50 dark:bg-emerald-950/10'}`}>
                                        <div className="flex items-center gap-2">
                                            <Banknote className={`w-4 h-4 ${hasPendientes ? 'text-rose-600' : 'text-emerald-500'}`} />
                                            <p className={`text-xs font-black uppercase tracking-widest ${hasPendientes ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-600'}`}>
                                                Cuenta del Cliente
                                            </p>
                                        </div>
                                        {hasPendientes
                                            ? <p className="text-sm font-black text-rose-600 tabular-nums">Debe: {formatCurrency(totalDeuda)}</p>
                                            : <span className="text-[10px] font-black text-emerald-600 uppercase">✓ Al día</span>
                                        }
                                    </div>

                                    {/* Tabs Créditos / Pagados */}
                                    <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                        <button
                                            onClick={() => setPerfilTab('creditos')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 flex items-center justify-center gap-1 ${perfilTab === 'creditos' ? 'border-rose-500 text-rose-600 bg-rose-50/50 dark:bg-rose-950/10' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Créditos
                                            {creditosPendientes.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[8px] leading-none">{creditosPendientes.length}</span>}
                                        </button>
                                        <button
                                            onClick={() => setPerfilTab('pagados')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 flex items-center justify-center gap-1 ${perfilTab === 'pagados' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Pagados
                                            {ticketsPagados.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] leading-none">{ticketsPagados.length}</span>}
                                        </button>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-2 space-y-2">
                                        {perfilTab === 'creditos' ? (
                                            <>
                                                {/* Botones pagar todo */}
                                                {creditosPendientes.length > 0 && (
                                                    <div className="flex gap-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                                                        {(['efectivo','nequi','transferencia'] as MetodoPago[]).map(m => (
                                                            <button key={m} onClick={() => marcarTodosPagados(m)}
                                                                className={`flex-1 h-7 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-0.5 ${m==='efectivo'?'bg-emerald-100 text-emerald-700 hover:bg-emerald-200':m==='nequi'?'bg-violet-100 text-violet-700 hover:bg-violet-200':'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                                                                <CheckCircle2 className="w-2.5 h-2.5"/>Todo · {m==='transferencia'?'Cta':m==='efectivo'?'Efec':'Neq'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {creditosPendientes.length === 0 ? (
                                                    <div className="py-8 flex flex-col items-center gap-2 opacity-50">
                                                        <CheckCircle2 className="w-8 h-8 text-emerald-500"/>
                                                        <p className="text-[10px] text-slate-400 font-black uppercase">Sin créditos pendientes</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {creditosPendientes.map(h => {
                                                            const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                            const saldo = h.total - abonado;
                                                            const expanded = expandedCreditos.has(h.id);
                                                            const clienteObj = allClientes.find(c => c.id === h.clienteId);
                                                            const metodoBadgeCls: Record<string,string> = { efectivo:'bg-emerald-100 text-emerald-700', nequi:'bg-violet-100 text-violet-700', transferencia:'bg-blue-100 text-blue-700', credito:'bg-rose-100 text-rose-700' };
                                                            return (
                                                                <div key={h.id} className="rounded-2xl overflow-hidden shadow-sm border border-indigo-200 dark:border-indigo-800 transition-all duration-200">
                                                                    {/* Cabecera */}
                                                                    <button className="w-full text-left px-3 py-2.5 flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 hover:from-indigo-100/70 transition-colors" onClick={() => toggleCreditoExpand(h.id)}>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="text-[11px] font-black text-slate-800 dark:text-white">
                                                                                    {(() => { const d = new Date(h.fecha); return isNaN(d.getTime()) ? 'Sin Fecha' : d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">Debe {formatCurrency(saldo)}</span>
                                                                            </div>
                                                                            {/* Desglose Compra / Abonado */}
                                                                            <div className="flex gap-2 mt-0.5">
                                                                                <span className="text-[8px] text-slate-500">Compra: <b className="text-slate-700 dark:text-slate-300">{formatCurrency(h.total)}</b></span>
                                                                                {abonado > 0 && <span className="text-[8px] text-emerald-600">Abonado: <b>{formatCurrency(abonado)}</b></span>}
                                                                            </div>
                                                                            <p className="text-[9px] text-slate-500 truncate mt-0.5">
                                                                                {h.items.slice(0,3).map(i=>`${i.nombre}×${i.cantidad}`).join(' · ')}{h.items.length>3?` +${h.items.length-3} más`:''}
                                                                            </p>
                                                                        </div>
                                                                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${expanded?'rotate-180 text-indigo-500':'text-slate-400'}`}/>
                                                                    </button>
                                                                    {/* Botones de acción — siempre visibles */}
                                                                    <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-1.5">
                                                                        <button onClick={(e)=>{e.stopPropagation();editarTicketEnPOS(h);}} className="h-7 px-3 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[9px] font-black uppercase flex items-center justify-center gap-1 transition-colors shrink-0">
                                                                            <Pencil className="w-3 h-3"/>Editar
                                                                        </button>
                                                                        {clienteObj && (
                                                                            <button onClick={() => enviarWhatsApp(clienteObj, saldo, [h])} className="flex-1 h-7 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors">
                                                                                <MessageCircle className="w-3.5 h-3.5"/>WhatsApp · {formatCurrency(saldo)}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Detalle expandible */}
                                                                    {expanded && (
                                                                        <div className="bg-white dark:bg-slate-900 px-3 pb-3 pt-2 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
                                                                            {/* Foto + items + fecha */}
                                                                            <div className="flex items-start gap-2">
                                                                                {h.fotoFactura ? (
                                                                                    <button onClick={() => window.open(h.fotoFactura,'_blank')} className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-indigo-100 shadow-sm hover:opacity-90 transition-opacity">
                                                                                        <img src={h.fotoFactura} alt="Factura" className="w-full h-full object-cover"/>
                                                                                    </button>
                                                                                ) : (
                                                                                    <label className="shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-indigo-300 transition-colors bg-slate-50 dark:bg-slate-800">
                                                                                        <Camera className="w-4 h-4 text-slate-300"/>
                                                                                        <span className="text-[7px] font-black uppercase text-slate-300">Foto</span>
                                                                                        <input type="file" accept="image/*" className="hidden" onChange={e=>subirFotoHistorial(h.id,e)}/>
                                                                                    </label>
                                                                                )}
                                                                                <div className="flex-1 min-w-0 space-y-1">
                                                                                    {editandoFechaHistorialId===h.id ? (
                                                                                        <div className="flex items-center gap-1">
                                                                                            <Input type="date" value={fechaHistorialTemp} onChange={e=>setFechaHistorialTemp(e.target.value)} className="h-6 text-[10px] bg-white dark:bg-slate-800 flex-1"/>
                                                                                            <button onClick={()=>guardarFechaHistorial(h.id)} className="text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5"/></button>
                                                                                            <button onClick={()=>setEditandoFechaHistorialId(null)} className="text-rose-500"><X className="w-3.5 h-3.5"/></button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <button onClick={()=>{const d=new Date(h.fecha);const s=isNaN(d.getTime())?new Date():d;setEditandoFechaHistorialId(h.id);const yy=s.getFullYear(),mo=String(s.getMonth()+1).padStart(2,'0'),dd=String(s.getDate()).padStart(2,'0');setFechaHistorialTemp(`${yy}-${mo}-${dd}`);}} className="flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-700">
                                                                                            <Edit2 className="w-2.5 h-2.5"/>{(() => { const d=new Date(h.fecha); return isNaN(d.getTime())?'Sin Fecha':d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                                        </button>
                                                                                    )}
                                                                                    <div className="space-y-0.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2 mt-1">
                                                                                        {h.items.map(item=>(
                                                                                            <div key={item.productoId} className="flex items-center gap-2 text-[9px]">
                                                                                                <span className="text-slate-600 dark:text-slate-400 truncate flex-1">{item.nombre}</span>
                                                                                                {editandoHistorialId===h.id ? (
                                                                                                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 px-1 py-0.5 shrink-0">
                                                                                                        <button onClick={()=>actualizarItemEnHistorial(h.id,item.productoId,-1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-rose-500"><Minus className="w-2.5 h-2.5"/></button>
                                                                                                        <span className="font-black w-4 text-center tabular-nums">{item.cantidad}</span>
                                                                                                        <button onClick={()=>actualizarItemEnHistorial(h.id,item.productoId,1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-indigo-500"><Plus className="w-2.5 h-2.5"/></button>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-slate-500 shrink-0">×{item.cantidad}</span>
                                                                                                )}
                                                                                                <span className="shrink-0 font-black text-slate-700 dark:text-slate-300"><span className="text-indigo-600">{formatCurrency(item.precio*item.cantidad)}</span></span>
                                                                                            </div>
                                                                                        ))}
                                                                                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                                                                                            <button onClick={()=>setEditandoHistorialId(editandoHistorialId===h.id?null:h.id)} className={`text-[9px] font-black uppercase tracking-wide flex items-center gap-1 transition-colors ${editandoHistorialId===h.id?'text-indigo-600':'text-slate-400 hover:text-indigo-500'}`}>
                                                                                                <Pencil className="w-2.5 h-2.5"/>{editandoHistorialId===h.id?'Listo':'Editar ticket'}
                                                                                            </button>
                                                                                            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 tabular-nums">Total: {formatCurrency(h.total)}</span>
                                                                                        </div>
                                                                                        {editandoHistorialId===h.id && (
                                                                                            <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800 space-y-1.5">
                                                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3"/>Agregar producto</p>
                                                                                                <input type="text" placeholder="Buscar producto..." value={busquedaEditTicket} onChange={e=>setBusquedaEditTicket(e.target.value)} className="w-full h-7 rounded-lg border border-indigo-200 bg-white dark:bg-slate-800 px-2 text-[10px] outline-none focus:border-indigo-400"/>
                                                                                                {busquedaEditTicket.length>=2 && (
                                                                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                                                                        {tablaDatosTodos.filter(d=>d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase())).slice(0,8).map(d=>(
                                                                                                            <button key={d.producto.id} onClick={()=>{agregarProductoAHistorial(h.id,d.producto.id,d.producto.nombre,d.precioMayorista);setBusquedaEditTicket('');}} className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left">
                                                                                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{d.producto.nombre}</span>
                                                                                                                <span className="text-[9px] font-black text-indigo-600 shrink-0 ml-2">{formatCurrency(d.precioMayorista)}</span>
                                                                                                            </button>
                                                                                                        ))}
                                                                                                        {tablaDatosTodos.filter(d=>d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase())).length===0 && <p className="text-[10px] text-slate-400 text-center py-1">Sin resultados</p>}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {h.fotoFactura && (
                                                                                        <label className="inline-flex items-center gap-1 text-[8px] text-slate-400 hover:text-indigo-500 cursor-pointer mt-0.5">
                                                                                            <Camera className="w-2.5 h-2.5"/>Cambiar foto
                                                                                            <input type="file" accept="image/*" className="hidden" onChange={e=>subirFotoHistorial(h.id,e)}/>
                                                                                        </label>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Abonos recibidos */}
                                                                            {(h.abonos??[]).length>0 && (
                                                                                <div className="space-y-1">
                                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Abonos recibidos</p>
                                                                                    {(h.abonos??[]).map((a,idx)=>(
                                                                                        <div key={a.id||idx}>
                                                                                            {editandoAbonoInfo?.histId===h.id&&(editandoAbonoInfo.abonoId===a.id||editandoAbonoInfo.idx===idx) ? (
                                                                                                <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 p-1.5 rounded-lg">
                                                                                                    <input type="number" value={editandoAbonoInfo.monto} onChange={e=>setEditandoAbonoInfo(p=>p?{...p,monto:e.target.value}:null)} className="w-16 h-6 text-[10px] rounded border border-indigo-200 bg-white px-1.5 outline-none" autoFocus/>
                                                                                                    <select value={editandoAbonoInfo.metodo} onChange={e=>setEditandoAbonoInfo(p=>p?{...p,metodo:e.target.value as MetodoPago}:null)} className="h-6 text-[9px] rounded border border-indigo-200 bg-white px-1 outline-none">
                                                                                                        <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="transferencia">Cuenta</option><option value="credito">Crédito</option>
                                                                                                    </select>
                                                                                                    <button onClick={editarAbono} className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center"><Check className="w-2.5 h-2.5"/></button>
                                                                                                    <button onClick={()=>setEditandoAbonoInfo(null)} className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center"><X className="w-2.5 h-2.5"/></button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 px-2 py-1 rounded-lg">
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded-sm ${metodoBadgeCls[a.metodoPago]??'bg-slate-100 text-slate-600'}`}>{a.metodoPago}</span>
                                                                                                        <span className="text-[8px] text-slate-500">{new Date(a.fecha).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                                                                                                        <span className="text-[10px] font-black text-emerald-700">+{formatCurrency(a.monto)}</span>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-0.5">
                                                                                                        <button onClick={e=>{e.stopPropagation();setEditandoAbonoInfo({histId:h.id,abonoId:a.id,idx,monto:String(a.monto),metodo:a.metodoPago});}} className="w-4 h-4 rounded bg-indigo-50 text-indigo-500 hover:bg-indigo-100 flex items-center justify-center"><Edit2 className="w-2 h-2"/></button>
                                                                                                        <button onClick={e=>{e.stopPropagation();eliminarAbono(h.id,a.id,idx);}} className="w-4 h-4 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center"><Trash2 className="w-2 h-2"/></button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}

                                                                            {/* Form abono compacto */}
                                                                            {abonandoId===h.id ? (
                                                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2 space-y-1.5">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <input type="number" value={montoAbono} onChange={e=>setMontoAbono(e.target.value)} placeholder="Monto" autoFocus className="flex-1 h-7 rounded-lg border border-indigo-200 bg-white dark:bg-slate-800 px-2 text-xs outline-none focus:border-indigo-400"/>
                                                                                        <button onClick={()=>{setAbonandoId(null);setMontoAbono('');}} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-300"><X className="w-3 h-3"/></button>
                                                                                    </div>
                                                                                    <div className="flex gap-1">
                                                                                        <button onClick={()=>registrarAbono(h.id,'efectivo')} className="flex-1 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black hover:bg-emerald-200">Efectivo</button>
                                                                                        <button onClick={()=>registrarAbono(h.id,'nequi')} className="flex-1 h-7 rounded-lg bg-violet-100 text-violet-700 text-[9px] font-black hover:bg-violet-200">Nequi</button>
                                                                                        <button onClick={()=>registrarAbono(h.id,'transferencia')} className="flex-1 h-7 rounded-lg bg-blue-100 text-blue-700 text-[9px] font-black hover:bg-blue-200">Cuenta</button>
                                                                                        <button onClick={()=>registrarAbono(h.id,'credito')} className="flex-1 h-7 rounded-lg bg-rose-100 text-rose-700 text-[9px] font-black hover:bg-rose-200">Cred.</button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <button onClick={()=>{setAbonandoId(h.id);setMontoAbono('');}} className="w-full h-7 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase hover:bg-indigo-700 flex items-center justify-center gap-1">
                                                                                    <Plus className="w-3 h-3"/> Registrar abono
                                                                                </button>
                                                                            )}

                                                                            {/* Confirmar pago completo */}
                                                                            <div>
                                                                                <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1">Confirmar pago completo · saldo {formatCurrency(saldo)}</p>
                                                                                <div className="flex gap-1">
                                                                                    <button onClick={()=>marcarComoPagado(h.id,'efectivo')} className="flex-1 h-7 rounded-lg bg-emerald-500 text-white text-[8px] font-black hover:bg-emerald-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Efectivo</button>
                                                                                    <button onClick={()=>marcarComoPagado(h.id,'nequi')} className="flex-1 h-7 rounded-lg bg-violet-500 text-white text-[8px] font-black hover:bg-violet-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Nequi</button>
                                                                                    <button onClick={()=>marcarComoPagado(h.id,'transferencia')} className="flex-1 h-7 rounded-lg bg-blue-500 text-white text-[8px] font-black hover:bg-blue-600 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3"/>Cuenta</button>
                                                                                </div>
                                                                            </div>

                                                                            {/* WA + Nota + Eliminar */}
                                                                            <div className="flex items-center gap-1.5">
                                                                                {clienteObj && (
                                                                                    <button onClick={()=>enviarWhatsApp(clienteObj,saldo,[h])}
                                                                                        title={mensajesWA[clienteObj.id]?`Último: ${new Date(mensajesWA[clienteObj.id]).toLocaleDateString('es-CO')}`:'Enviar este ticket por WhatsApp'}
                                                                                        className="flex-1 h-7 rounded-xl bg-[#25D366] text-white text-[9px] font-black uppercase hover:bg-[#1da851] flex items-center justify-center gap-1">
                                                                                        <MessageCircle className="w-3 h-3"/>WA Ticket
                                                                                    </button>
                                                                                )}
                                                                                {editandoNotaClienteId===h.id ? (
                                                                                    <div className="flex-1 flex items-center gap-1">
                                                                                        <input value={notaTemp} onChange={e=>setNotaTemp(e.target.value)} placeholder="Nota..." autoFocus className="flex-1 h-7 rounded-lg border border-indigo-200 bg-white px-2 text-[9px] outline-none"/>
                                                                                        <button onClick={()=>guardarNotaCliente(h.id,notaTemp)} className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center"><Check className="w-3 h-3"/></button>
                                                                                        <button onClick={()=>setEditandoNotaClienteId(null)} className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center"><X className="w-3 h-3"/></button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button onClick={()=>{setEditandoNotaClienteId(h.id);setNotaTemp(notasClientes[h.id]||'');}} className="flex-1 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black hover:bg-slate-200 flex items-center justify-center gap-1 truncate">
                                                                                        <StickyNote className="w-3 h-3 shrink-0"/><span className="truncate">{notasClientes[h.id]||'Nota'}</span>
                                                                                    </button>
                                                                                )}
                                                                                <button onClick={()=>eliminarHistorial(h.id)} className="w-7 h-7 rounded-xl border border-dashed border-red-300 text-red-500 hover:bg-red-50 flex items-center justify-center" title="Eliminar ticket">
                                                                                    <Trash2 className="w-3 h-3"/>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* ── Ficha: Pagados ── */
                                            <>
                                                {pagadosFiltrados.length === 0 ? (
                                                    <div className="py-8 flex flex-col items-center gap-2 opacity-50">
                                                        {busquedaTicket ? (
                                                            <>
                                                                <Search className="w-8 h-8 text-slate-300"/>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase">Sin resultados para "{busquedaTicket}"</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Receipt className="w-8 h-8 text-slate-300"/>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase">Sin tickets pagados aún</p>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {pagadosFiltrados.map(h => {
                                                            const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                            const metodoLabel: Record<string,string> = { efectivo:'Efectivo', nequi:'Nequi', transferencia:'Cuenta', credito:'Crédito' };
                                                            const metodoCls: Record<string,string> = { efectivo:'bg-emerald-100 text-emerald-700', nequi:'bg-violet-100 text-violet-700', transferencia:'bg-blue-100 text-blue-700', credito:'bg-indigo-100 text-indigo-700' };
                                                            return (
                                                                <div key={h.id} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 flex items-center justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                                                                {(() => { const d=new Date(h.fecha); return isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}); })()}
                                                                            </span>
                                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">✓ Pagado</span>
                                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${metodoCls[h.metodoPago??'efectivo']??'bg-slate-100 text-slate-600'}`}>
                                                                                {metodoLabel[h.metodoPago??'efectivo']??h.metodoPago}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-500 truncate">
                                                                            {h.items.slice(0,3).map(i=>`${i.nombre}×${i.cantidad}`).join(' · ')}{h.items.length>3?` +${h.items.length-3} más`:''}
                                                                        </p>
                                                                        {h.metodoPago === 'credito' && abonado > 0 && (
                                                                            <p className="text-[8px] text-emerald-600 mt-0.5">Abonado: {formatCurrency(abonado)}</p>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-[12px] font-black text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(h.total)}</p>
                                                                        {h.fotoFactura && (
                                                                            <button onClick={()=>window.open(h.fotoFactura,'_blank')} className="mt-1 w-8 h-8 rounded-lg overflow-hidden border border-emerald-200 hover:opacity-80 block ml-auto">
                                                                                <img src={h.fotoFactura} alt="Foto" className="w-full h-full object-cover"/>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {productosPerfil.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <Package className="w-12 h-12 text-slate-200 mb-3" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin productos disponibles</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(
                                    productosPerfil.reduce((acc, d) => {
                                        const cat = d.producto.categoria || 'Sin categoría';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(d);
                                        return acc;
                                    }, {} as Record<string, typeof productosPerfil>)
                                ).map(([categoria, items]) => (
                                        <div key={categoria} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all">
                                            <button
                                                onClick={() => setCategoriaExpandida(categoriaExpandida === categoria ? null : categoria)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                        <Folder className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                                                            {categoria}
                                                        </h3>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{items.length} productos</p>
                                                    </div>
                                                </div>
                                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${categoriaExpandida === categoria ? 'rotate-180 text-indigo-600' : ''}`} />
                                            </button>
                                            
                                            {categoriaExpandida === categoria && (
                                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {items.map(d => {
                                    const enCarrito = carritoPos.find(i => i.productoId === d.producto.id);
                                    return (
                                        <div
                                            key={d.producto.id}
                                            onClick={() => !enCarrito && agregarAlCarrito(d.producto.id, d.producto.nombre, d.precioMayorista)}
                                            className={cn(
                                                'group rounded-xl border cursor-pointer transition-all hover:shadow-lg active:scale-[0.97] flex flex-col overflow-hidden',
                                                enCarrito ? 'border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-300/50'
                                            )}
                                        >
                                            {/* Imagen compacta */}
                                            <div className="h-20 relative shrink-0 overflow-hidden">
                                                <ProductAvatar
                                                    imagen={(d.producto as any).imagen}
                                                    nombre={d.producto.nombre}
                                                    categoria={d.producto.categoria || ''}
                                                    className="w-full h-full"
                                                />
                                                {enCarrito && (
                                                    <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white font-black text-[7px] px-1.5 py-0.5 rounded-md z-10 shadow">
                                                        EN TICKET
                                                    </div>
                                                )}
                                                {(d.producto as any).descuentoMayorista > 0 && (
                                                    <div className="absolute top-1.5 left-1.5 bg-rose-500 text-white font-black text-[7px] px-1.5 py-0.5 rounded-md z-10 shadow">
                                                        -{(d.producto as any).descuentoMayorista}%
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info compacta */}
                                            <div className="px-2 py-1.5 flex flex-col border-t border-slate-50 dark:border-slate-700">
                                                <h4 className="font-black text-[10px] uppercase tracking-tight text-slate-800 dark:text-slate-100 leading-tight line-clamp-1">
                                                    {d.producto.nombre}
                                                </h4>
                                                {d.producto.descripcion && (
                                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 line-clamp-1 mt-0.5 leading-tight transition-colors">
                                                        {d.producto.descripcion}
                                                    </p>
                                                )}
                                                <div className="mt-1 flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-1">
                                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                        {formatCurrency(d.precioMayorista)}
                                                    </span>
                                                    {enCarrito ? (
                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                            <button onClick={e => { e.preventDefault(); e.stopPropagation(); actualizarCantidadPos(d.producto.id, -1); }}
                                                                className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all">
                                                                <Minus className="w-2.5 h-2.5" />
                                                            </button>
                                                            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 tabular-nums w-4 text-center">{enCarrito.cantidad}</span>
                                                            <button onClick={e => { e.preventDefault(); e.stopPropagation(); actualizarCantidadPos(d.producto.id, 1); }}
                                                                className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all">
                                                                <Plus className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-md bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                            <Plus className="w-2.5 h-2.5" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── PANEL DERECHO: Ticket / Créditos ── */}
                    <div className={cn(
                        "w-full lg:w-[360px] bg-slate-50 dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shrink-0",
                        !showMobilePOSCart && "hidden lg:flex"
                    )}>
                        {/* TABS DEL PANEL DERECHO */}
                        <div className="flex bg-[#1a1c2e] p-2 gap-2 shrink-0 z-30 relative">
                            <button
                                onClick={() => setPanelView('ticket')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                                    ${panelView === 'ticket' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                🛒 TICKET
                            </button>
                            <button
                                onClick={() => setPanelView('cuenta')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                                    ${panelView === 'cuenta' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                💰 CUENTA
                            </button>
                        </div>

                        {panelView === 'ticket' ? (
                            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-slate-900 shadow-2xl">
                                {/* Ticket header estio Venta Rápida */}
                        <div className="bg-[#1a1c2e] p-5 text-white shadow-lg z-20 flex flex-col gap-4">
                             <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                  <Receipt className="w-6 h-6 text-indigo-300" />
                                </div>
                                <div>
                                  <h3 className="font-black text-sm uppercase tracking-widest text-indigo-100">Ticket</h3>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                     {cliente.nombre}
                                  </p>
                                </div>
                             </div>
                             <div className="bg-white/5 rounded-xl px-4 py-2 flex items-center justify-between border border-white/10">
                                <span className="text-[10px] font-black uppercase text-slate-300">Items agregados</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setMontoLibreOpen(o => !o)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 text-[9px] font-black uppercase tracking-wide transition-colors"
                                        title="Agregar monto sin producto del catálogo"
                                    >
                                        <Plus className="w-3 h-3" /> Monto libre
                                    </button>
                                    <span className="text-xs font-black text-white bg-indigo-600 px-2.5 py-0.5 rounded-lg shadow-inner">{carritoPos.length}</span>
                                </div>
                             </div>
                             {/* Formulario monto libre */}
                             {montoLibreOpen && (
                                 <div className="bg-white/5 rounded-xl p-3 border border-amber-400/30 flex flex-col gap-2">
                                     <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Agregar monto libre</p>
                                     <input
                                         type="text"
                                         placeholder="Descripción (ej: Pedido sin detallar)"
                                         value={montoLibreDesc}
                                         onChange={e => setMontoLibreDesc(e.target.value)}
                                         className="w-full text-xs bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400/60"
                                     />
                                     <div className="flex gap-2">
                                         <input
                                             type="number"
                                             placeholder="Monto $"
                                             value={montoLibreMonto}
                                             onChange={e => setMontoLibreMonto(e.target.value)}
                                             onKeyDown={e => e.key === 'Enter' && agregarMontoLibre()}
                                             className="flex-1 text-xs bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400/60"
                                         />
                                         <button
                                             onClick={agregarMontoLibre}
                                             className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wide transition-colors"
                                         >
                                             Agregar
                                         </button>
                                         <button
                                             onClick={() => { setMontoLibreOpen(false); setMontoLibreDesc(''); setMontoLibreMonto(''); }}
                                             className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                         >
                                             <X className="w-4 h-4" />
                                         </button>
                                     </div>
                                 </div>
                             )}
                        </div>

                        {/* Tickets pendientes de este cliente */}
                        {ticketsPendientes.filter(t => t.clienteId === cliente.id).length > 0 && (
                            <div className="border-b border-slate-100 dark:border-slate-800 shrink-0">
                                <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                                        Guardados ({ticketsPendientes.filter(t => t.clienteId === cliente.id).length})
                                    </p>
                                </div>
                                    {ticketsPendientes.filter(t => t.clienteId === cliente.id).map(ticket => (
                                    <div key={ticket.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                        {/* Fila principal */}
                                        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                    {ticket.items.length} item{ticket.items.length !== 1 ? 's' : ''} · {formatCurrency(ticket.items.reduce((s, i) => s + i.precio * i.cantidad, 0))}
                                                </p>
                                                <p className="text-[9px] text-slate-400">
                                                    {new Date(ticket.guardadoEn).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {new Date(ticket.guardadoEn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1.5 items-center shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={ticketsSeleccionados.has(ticket.id)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(ticketsSeleccionados);
                                                        if (e.target.checked) newSet.add(ticket.id);
                                                        else newSet.delete(ticket.id);
                                                        setTicketsSeleccionados(newSet);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer mr-2"
                                                    title="Seleccionar ticket"
                                                />
                                                <button
                                                    onClick={() => setEditandoPendienteId(editandoPendienteId === ticket.id ? null : ticket.id)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-colors ${editandoPendienteId === ticket.id ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <Pencil className="w-3 h-3" /> Editar
                                                </button>
                                                <button
                                                    onClick={() => retomarTicket(ticket)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[9px] font-black uppercase tracking-wide transition-colors"
                                                >
                                                    <PlayCircle className="w-3 h-3" /> Retomar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (editandoPendienteId === ticket.id) {
                                                            setEditandoPendienteId(null);
                                                        } else {
                                                            cancelarTicketPendiente(ticket.id);
                                                        }
                                                    }}
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                    title={editandoPendienteId === ticket.id ? "Cerrar edición" : "Eliminar ticket"}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Modo edición inline */}
                                        {editandoPendienteId === ticket.id && (
                                            <div className="px-4 pb-3 space-y-1.5 bg-slate-50 dark:bg-slate-800/30">
                                                {ticket.items.map(item => (
                                                    <div key={item.productoId} className="flex items-center gap-2">
                                                        <p className="flex-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{item.nombre}</p>
                                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 px-1 py-0.5">
                                                            <button onClick={() => actualizarItemEnPendiente(ticket.id, item.productoId, -1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-500">
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-xs font-black w-4 text-center tabular-nums">{item.cantidad}</span>
                                                            <button onClick={() => actualizarItemEnPendiente(ticket.id, item.productoId, 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-500">
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <p className="text-[11px] font-black text-indigo-600 w-14 text-right tabular-nums">{formatCurrency(item.precio * item.cantidad)}</p>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] font-black text-right text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                                                    Total: {formatCurrency(ticket.items.reduce((s, i) => s + i.precio * i.cantidad, 0))}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Lista del carrito */}
                        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
                            {carritoPos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 opacity-30">
                                    <ShoppingCart className="w-12 h-12 text-indigo-300 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                                        Toca un producto para agregar
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 space-y-2">
                                    {carritoPos.map(item => {
                                        const esLibre = item.productoId.startsWith('__libre__');
                                        const descCarrito = esLibre ? null : tablaDatosTodos.find(d => d.producto.id === item.productoId)?.producto.descripcion;
                                        return (
                                        <div key={item.productoId} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${esLibre ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-700/40' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-[10px] font-black text-slate-900 dark:text-white truncate">{item.nombre}</p>
                                                    {esLibre && <span className="text-[8px] font-black uppercase tracking-wide bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded shrink-0">libre</span>}
                                                </div>
                                                {descCarrito && (
                                                    <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 truncate leading-tight">{descCarrito}</p>
                                                )}
                                                {!esLibre && <p className="text-[9px] font-bold text-slate-400">{formatCurrency(item.precio)} c/u</p>}
                                            </div>
                                            {/* Controles de cantidad */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => actualizarCantidadPos(item.productoId, -1)}
                                                    className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-90"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="text-xs font-black text-slate-800 dark:text-white w-5 text-center tabular-nums">{item.cantidad}</span>
                                                <button
                                                    onClick={() => actualizarCantidadPos(item.productoId, 1)}
                                                    className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <p className="text-xs font-black text-indigo-600 tabular-nums shrink-0 w-16 text-right">{formatCurrency(item.precio * item.cantidad)}</p>
                                            <button
                                                onClick={() => eliminarDelCarrito(item.productoId)}
                                                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ); })}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Total + Acciones */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0 overflow-y-auto max-h-[50vh]">
                            {/* Input cámara para historial existente */}
                            <input
                                ref={historialFileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file || !adjuntandoFotoHistorialId) return;
                                    const reader = new FileReader();
                                    reader.onload = ev => {
                                        adjuntarFotoHistorial(adjuntandoFotoHistorialId, ev.target?.result as string);
                                        setAdjuntandoFotoHistorialId(null);
                                    };
                                    reader.readAsDataURL(file);
                                    e.target.value = '';
                                }}
                            />
                            {/* Input de cámara oculto */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = ev => setFotoFactura(ev.target?.result as string);
                                    reader.readAsDataURL(file);
                                    e.target.value = '';
                                }}
                            />
                            {/* Banner modo edición */}
                            {ticketEditandoEnPOS && (
                                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Editando ticket</p>
                                            <p className="text-[10px] font-bold text-amber-600">{ticketEditandoEnPOS.fechaLabel}</p>
                                        </div>
                                    </div>
                                    <button onClick={()=>{setTicketEditandoEnPOS(null);setCarritoPos([]);}} className="text-amber-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4"/></button>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalCarrito)}</span>
                            </div>
                            {/* Foto de factura */}
                            {fotoFactura ? (
                                <div className="relative">
                                    <img src={fotoFactura} alt="Factura" className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                                    <button
                                        onClick={() => setFotoFactura(undefined)}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <div className="absolute bottom-1.5 left-2 flex items-center gap-1 bg-black/50 rounded-md px-1.5 py-0.5">
                                        <ImageIcon className="w-2.5 h-2.5 text-white" />
                                        <span className="text-[9px] text-white font-bold">Factura adjunta</span>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-9 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                    <Camera className="w-3.5 h-3.5" /> Tomar foto de factura
                                </button>
                            )}
                            {!ticketEditandoEnPOS && (
                                <Button
                                    disabled={carritoPos.length === 0}
                                    onClick={guardarTicketPendiente}
                                    variant="outline"
                                    className="w-full h-10 rounded-xl font-black uppercase text-xs tracking-widest gap-2 border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                                >
                                    <Clock className="w-4 h-4" /> Guardar para después
                                </Button>
                            )}
                            {ticketEditandoEnPOS ? (
                                <Button
                                    disabled={carritoPos.length === 0}
                                    onClick={guardarEdicionEnPOS}
                                    className="w-full h-12 text-white rounded-xl font-black uppercase text-xs tracking-widest gap-2 shadow-lg bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Guardar cambios
                                </Button>
                            ) : (
                                <>
                                    {/* Selector de método de pago */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Forma de pago</p>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {([
                                                { id: 'efectivo', label: 'Efectivo', Icon: Banknote, color: 'emerald' },
                                                { id: 'nequi',    label: 'Nequi',    Icon: Smartphone, color: 'violet' },
                                                { id: 'transferencia', label: 'Cuenta', Icon: Building2, color: 'blue' },
                                                { id: 'credito',  label: 'Crédito',  Icon: CreditCard,  color: 'rose' },
                                            ] as const).map(({ id, label, Icon, color }) => (
                                                <button
                                                    key={id}
                                                    onClick={() => setMetodoPagoSeleccionado(id as MetodoPago)}
                                                    className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-wide transition-all ${metodoPagoSeleccionado === id
                                                        ? color === 'emerald' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400'
                                                        : color === 'violet'  ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-950/30 dark:border-violet-700 dark:text-violet-400'
                                                        : color === 'blue'    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400'
                                                        :                       'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/30 dark:border-rose-700 dark:text-rose-400'
                                                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 dark:bg-slate-800/40 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {metodoPagoSeleccionado === 'credito' && (
                                            <p className="text-[9px] text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" /> Se registrará como cuenta por cobrar — podrás abonar después
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        disabled={carritoPos.length === 0 || isGuardandoTicket}
                                        onClick={async () => {
                                            // Verificar stock antes de confirmar
                                            const sinStock: string[] = [];
                                            for (const item of carritoPos) {
                                                const inv = await db.getInventarioItemByProducto(item.productoId);
                                                if (inv && inv.stockActual > 0 && item.cantidad > inv.stockActual) {
                                                    sinStock.push(`${item.nombre} (disponible: ${inv.stockActual})`);
                                                }
                                            }
                                            if (sinStock.length > 0) {
                                                const continuar = window.confirm(`Stock insuficiente:\n${sinStock.join('\n')}\n\n¿Deseas confirmar la venta de todas formas?`);
                                                if (!continuar) return;
                                            }
                                            await guardarEnHistorial(carritoPos, totalCarrito, fotoFactura, metodoPagoSeleccionado);
                                            toast.success(`Venta registrada para ${cliente.nombre}: ${formatCurrency(totalCarrito)}`);
                                            setCarritoPos([]);
                                            setFotoFactura(undefined);
                                            setMetodoPagoSeleccionado('efectivo');
                                            setTicketRetomadoId(null);
                                        }}
                                        className={`w-full h-12 text-white rounded-xl font-black uppercase text-xs tracking-widest gap-2 shadow-lg transition-colors ${
                                            metodoPagoSeleccionado === 'nequi'   ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' :
                                            metodoPagoSeleccionado === 'transferencia' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' :
                                            metodoPagoSeleccionado === 'credito' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' :
                                            'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                                        }`}
                                    >
                                        {metodoPagoSeleccionado === 'efectivo' && <Banknote className="w-4 h-4" />}
                                        {metodoPagoSeleccionado === 'nequi'    && <Smartphone className="w-4 h-4" />}
                                        {metodoPagoSeleccionado === 'transferencia' && <Building2 className="w-4 h-4" />}
                                        {metodoPagoSeleccionado === 'credito'  && <CreditCard className="w-4 h-4" />}
                                        {metodoPagoSeleccionado === 'credito' ? 'Registrar a Crédito' : `Confirmar — ${metodoPagoSeleccionado === 'nequi' ? 'Nequi' : metodoPagoSeleccionado === 'transferencia' ? 'Cuenta' : 'Efectivo'}`}
                                    </Button>
                                </>
                            )}
                            {carritoPos.length > 0 && (
                                <Button
                                    onClick={limpiarCarrito}
                                    variant="ghost"
                                    className="w-full h-9 text-xs font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    {ticketRetomadoId ? 'Guardar y limpiar' : 'Limpiar ticket'}
                                </Button>
                            )}
                        </div>
                            </div>
                        ) : (
                            /* ═══ VISTA CUENTA: Facturas + Abonos ═══ */
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
                                <ScrollArea className="flex-1">
                                    <div className="p-4 space-y-3">
                                        {(() => {
                                            const histProv = historialUnificado.filter(h => h.clienteId === cliente.id);
                                            if (histProv.length === 0) return (
                                                <div className="flex flex-col items-center justify-center py-16 opacity-40">
                                                    <Receipt className="w-12 h-12 text-slate-300 mb-3" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Sin facturas registradas</p>
                                                    <p className="text-[9px] text-slate-400 mt-1">Registra ventas para verlas aquí</p>
                                                </div>
                                            );

                                            const selAll = histProv.every(h => facturasSeleccionadas.has(h.id));
                                            const toggleAll = () => {
                                                if (selAll) setFacturasSeleccionadas(new Set());
                                                else setFacturasSeleccionadas(new Set(histProv.map(h => h.id)));
                                            };
                                            const toggleOne = (id: string) => {
                                                setFacturasSeleccionadas(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(id)) next.delete(id); else next.add(id);
                                                    return next;
                                                });
                                            };

                                            return (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={toggleAll} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selAll ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}>
                                                                {selAll && <Check className="w-3 h-3" />}
                                                            </button>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Seleccionar todas ({histProv.length})</span>
                                                        </div>
                                                    </div>

                                                    {histProv.map(h => {
                                                        const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                        const saldo = h.total - abonado;
                                                        const checked = facturasSeleccionadas.has(h.id);
                                                        const metodoBadge = {
                                                            efectivo: { label: 'Efectivo', cls: 'bg-emerald-100 text-emerald-700' },
                                                            nequi:    { label: 'Nequi',    cls: 'bg-violet-100 text-violet-700' },
                                                            credito:  { label: 'Crédito',  cls: 'bg-rose-100 text-rose-700' },
                                                            transferencia: { label: 'Cuenta', cls: 'bg-blue-100 text-blue-700' }
                                                        }[h.metodoPago ?? 'efectivo'] || { label: 'Otro', cls: 'bg-slate-100 text-slate-700' };

                                                        return (
                                                            <div key={h.id} className={`rounded-xl border p-3 space-y-2 transition-all ${checked ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                                                                <div className="flex items-start gap-2">
                                                                    <button onClick={() => toggleOne(h.id)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}>
                                                                        {checked && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1 mb-0.5">
                                                                            {editandoFechaHistorialId === h.id ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <Input type="date" value={fechaHistorialTemp} onChange={e => setFechaHistorialTemp(e.target.value)} className="h-6 w-32 text-[10px] bg-white dark:bg-slate-900 border-indigo-200" />
                                                                                    <button onClick={() => guardarFechaHistorial(h.id)} className="text-emerald-600 hover:text-emerald-700 p-1"><CheckCircle2 className="w-3 h-3" /></button>
                                                                                    <button onClick={() => setEditandoFechaHistorialId(null)} className="text-rose-600 hover:text-rose-700 p-1"><X className="w-3 h-3" /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1 group/date cursor-pointer">
                                                                                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                                                                                        {(() => {
                                                                                            const d = new Date(h.fecha);
                                                                                            return isNaN(d.getTime()) ? 'Sin Fecha' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
                                                                                        })()}
                                                                                    </p>
                                                                                    <button onClick={() => { 
                                                                                        const d = new Date(h.fecha);
                                                                                        const safeDate = isNaN(d.getTime()) ? new Date() : d;
                                                                                        setEditandoFechaHistorialId(h.id);
                                                                                        const yy = safeDate.getFullYear(), mo = String(safeDate.getMonth()+1).padStart(2,'0'), dd = String(safeDate.getDate()).padStart(2,'0');
                                                                                        setFechaHistorialTemp(`${yy}-${mo}-${dd}`);
                                                                                    }} className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 dark:bg-indigo-900/30 rounded">
                                                                                        <Edit2 className="w-2.5 h-2.5" />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[11px] font-black uppercase text-indigo-600 truncate">{h.items.length} productos</p>
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <span className={`inline-block text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${metodoBadge.cls}`}>
                                                                              {metodoBadge.label}
                                                                            </span>
                                                                            {/* Herramientas extra (foto y eliminar) */}
                                                                            {h.fotoFactura && (
                                                                                <button onClick={() => window.open(h.fotoFactura, '_blank')} className="w-5 h-5 rounded flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100" title="Ver foto">
                                                                                    <ImageIcon className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                            <label className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer" title="Subir evidencia">
                                                                                <Camera className="w-3 h-3" />
                                                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => subirFotoHistorial(h.id, e)} />
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-sm font-black text-indigo-600 tabular-nums">{formatCurrency(h.total)}</p>
                                                                        {abonado > 0 && <p className="text-[9px] text-emerald-600 font-bold">Abonado: {formatCurrency(abonado)}</p>}
                                                                        {saldo > 0 && <p className="text-[9px] text-rose-600 font-bold">Debe: {formatCurrency(saldo)}</p>}
                                                                        {saldo <= 0 && abonado > 0 && <p className="text-[9px] text-emerald-600 font-bold">✓ Pagado</p>}
                                                                    </div>
                                                                </div>

                                                                {/* Abonos */}
                                                                {(h.abonos ?? []).length > 0 && (
                                                                    <div className="pl-7 space-y-1 mt-1">
                                                                        {(h.abonos ?? []).map((a, idx) => {
                                                                            const aBadge = {
                                                                                efectivo: 'bg-emerald-100 text-emerald-700',
                                                                                nequi:    'bg-violet-100 text-violet-700',
                                                                                transferencia: 'bg-blue-100 text-blue-700',
                                                                                credito:  'bg-rose-100 text-rose-700'
                                                                            }[a.metodoPago] ?? 'bg-slate-100 text-slate-600';
                                                                            
                                                                            return (
                                                                            <div key={a.id || idx} className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 rounded-md px-2 py-1.5 group/abono">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${aBadge}`}>
                                                                                        {{ efectivo: 'Efectivo', nequi: 'Nequi', credito: 'Crédito', transferencia: 'Cuenta' }[a.metodoPago] || a.metodoPago}
                                                                                    </span>
                                                                                    <span className="text-[9px] font-medium text-slate-500">
                                                                                        {new Date(a.fecha).toLocaleDateString('es-CO')}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                                                                        +{formatCurrency(a.monto)}
                                                                                    </span>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setEditandoAbonoInfo({ histId: h.id, abonoId: a.id, idx, monto: String(a.monto), metodo: a.metodoPago }); }} className="text-indigo-500 hover:text-indigo-700 p-1 rounded-sm bg-indigo-50 hover:bg-indigo-100 transition-all" title="Editar abono">
                                                                                        <Edit2 className="w-3 h-3" />
                                                                                    </button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); eliminarAbono(h.id, a.id, idx); }} className="text-rose-500 hover:text-rose-700 p-1 rounded-sm bg-rose-100/50 hover:bg-rose-200 transition-all" title="Eliminar abono">
                                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )})}
                                                                    </div>
                                                                )}

                                                                {/* Modal editar abono (en tab CUENTA) */}
                                                                {editandoAbonoInfo?.histId === h.id && (
                                                                    <div className="pl-7 mt-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2 space-y-1.5">
                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Editar abono</p>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="number"
                                                                                value={editandoAbonoInfo.monto}
                                                                                onChange={e => setEditandoAbonoInfo(prev => prev ? { ...prev, monto: e.target.value } : null)}
                                                                                className="flex-1 h-7 text-xs rounded-lg border border-indigo-200 bg-white px-2 outline-none"
                                                                                autoFocus
                                                                            />
                                                                            <select
                                                                                value={editandoAbonoInfo.metodo}
                                                                                onChange={e => setEditandoAbonoInfo(prev => prev ? { ...prev, metodo: e.target.value as MetodoPago } : null)}
                                                                                className="h-7 text-[9px] rounded-lg border border-indigo-200 bg-white px-1 outline-none"
                                                                            >
                                                                                <option value="efectivo">Efectivo</option>
                                                                                <option value="nequi">Nequi</option>
                                                                                <option value="transferencia">Cuenta</option>
                                                                                <option value="credito">Crédito</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="flex gap-1.5">
                                                                            <button onClick={editarAbono} className="flex-1 h-7 rounded-lg bg-emerald-500 text-white text-[9px] font-black hover:bg-emerald-600 flex items-center justify-center gap-1"><Check className="w-3 h-3" />Guardar</button>
                                                                            <button onClick={() => setEditandoAbonoInfo(null)} className="flex-1 h-7 rounded-lg bg-slate-200 text-slate-600 text-[9px] font-black hover:bg-slate-300 flex items-center justify-center gap-1"><X className="w-3 h-3" />Cancelar</button>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Botón de abono */}
                                                                {saldo > 0 && (
                                                                    <div className="pl-7 mt-1">
                                                                        {abonandoId === h.id ? (
                                                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800 space-y-2 mt-2">
                                                                                <div className="flex gap-2">
                                                                                    <input type="number" placeholder="Monto" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} className="h-7 text-xs bg-white rounded-md px-2 border border-indigo-200 outline-none flex-1" autoFocus />
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                                    <Button size="sm" onClick={() => registrarAbono(h.id, 'efectivo')} className="h-7 text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-700 shadow-none border-none">Efectivo</Button>
                                                                                    <Button size="sm" onClick={() => registrarAbono(h.id, 'nequi')} className="h-7 text-[9px] bg-violet-100 hover:bg-violet-200 text-violet-700 shadow-none border-none">Nequi</Button>
                                                                                    <Button size="sm" onClick={() => registrarAbono(h.id, 'transferencia')} className="h-7 text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 shadow-none border-none">Cuenta</Button>
                                                                                    <Button size="sm" onClick={() => registrarAbono(h.id, 'credito')} className="h-7 text-[9px] bg-rose-100 hover:bg-rose-200 text-rose-700 shadow-none border-none">Crédito</Button>
                                                                                    <Button size="sm" onClick={() => { setAbonandoId(null); setMontoAbono(''); }} variant="outline" className="h-7 text-[9px] text-slate-500 shadow-none col-span-2">Cancelar</Button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={() => { setAbonandoId(h.id); setMontoAbono(''); }} className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded w-full flex justify-center items-center gap-1 transition-colors">
                                                                                <Plus className="w-3 h-3" /> Abonar a esta factura
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Eliminar ticket completo — separado y diferenciado de eliminar abono */}
                                                                <button
                                                                    onClick={() => eliminarHistorial(h.id)}
                                                                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-red-300 text-red-500 hover:bg-red-50 text-[9px] font-black uppercase tracking-widest transition-colors"
                                                                    title="Eliminar este ticket completo"
                                                                >
                                                                    <Trash2 className="w-3 h-3" /> Eliminar ticket completo
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </ScrollArea>
                                
                                {/* FOOTER TOTALES SELECCIONADOS */}
                                <div className="p-4 bg-[#1a1c2e] text-white shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-20">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionado ({facturasSeleccionadas.size})</span>
                                        <span className="text-sm font-black tabular-nums">{(() => {
                                            const sel = historialUnificado.filter(p => p.clienteId === cliente.id && facturasSeleccionadas.has(p.id));
                                            return formatCurrency(sel.reduce((s, h) => s + h.total, 0));
                                        })()}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Abonado</span>
                                        <span className="text-sm font-black tabular-nums text-emerald-400">{(() => {
                                            const sel = historialUnificado.filter(p => p.clienteId === cliente.id && facturasSeleccionadas.has(p.id));
                                            return formatCurrency(sel.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0));
                                        })()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400/70">Saldo Pendiente</span>
                                        <span className="text-xl font-black tabular-nums text-rose-400">{(() => {
                                            const sel = historialUnificado.filter(p => p.clienteId === cliente.id && facturasSeleccionadas.has(p.id));
                                            const tot = sel.reduce((s, h) => s + h.total, 0);
                                            const ab = sel.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0);
                                            return formatCurrency(tot - ab);
                                        })()}</span>
                                    </div>
                                    {/* Enviar tickets seleccionados por WhatsApp */}
                                    {facturasSeleccionadas.size > 0 && (() => {
                                        const sel = historialUnificado.filter(p => p.clienteId === cliente.id && facturasSeleccionadas.has(p.id));
                                        if (sel.length === 0) return null;
                                        const saldoWA = sel.reduce((s, h) => {
                                            const ab = (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0);
                                            return s + Math.max(0, h.total - ab);
                                        }, 0);
                                        return (
                                            <div className="mt-2 pt-2 border-t border-white/10">
                                                <button
                                                    onClick={() => enviarWhatsApp(cliente, saldoWA, sel)}
                                                    className="w-full h-9 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5"/>
                                                    Enviar {sel.length} ticket{sel.length > 1 ? 's' : ''} por WhatsApp
                                                </button>
                                            </div>
                                        );
                                    })()}
                                    {/* Abono parcial a tickets seleccionados */}
                                    {facturasSeleccionadas.size > 0 && (() => {
                                        const sel = historialUnificado.filter(p =>
                                            p.clienteId === cliente.id &&
                                            facturasSeleccionadas.has(p.id) &&
                                            p.metodoPago === 'credito' &&
                                            (p.total - (p.abonos ?? []).reduce((s, a) => s + a.monto, 0)) > 0
                                        );
                                        if (sel.length === 0) return null;
                                        const aplicarAbono = async (metodo: MetodoPago) => {
                                            const monto = parseFloat(montoAbonoMultiple);
                                            if (isNaN(monto) || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
                                            const ordenados = [...sel].sort((a, b) => a.fecha - b.fecha);
                                            let restante = monto;
                                            let procesados = 0;
                                            for (const h of ordenados) {
                                                if (restante <= 0) break;
                                                const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                const saldo = h.total - ab;
                                                if (saldo <= 0) continue;
                                                const aPagar = Math.min(saldo, restante);
                                                await registrarAbono(h.id, metodo, aPagar);
                                                restante -= aPagar;
                                                procesados++;
                                            }
                                            setMontoAbonoMultiple('');
                                            toast.success(`Abono de ${formatCurrency(monto)} distribuido en ${procesados} ticket(s)${restante > 0 ? `. Sobraron ${formatCurrency(restante)}` : ''}`);
                                        };
                                        return (
                                            <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-indigo-300/80">Abono parcial · {sel.length} crédito(s)</p>
                                                <input
                                                    type="number"
                                                    placeholder="Monto a abonar..."
                                                    value={montoAbonoMultiple}
                                                    onChange={e => setMontoAbonoMultiple(e.target.value)}
                                                    className="w-full h-8 rounded-xl bg-white/10 text-white text-xs px-3 outline-none border border-white/20 focus:border-indigo-400 placeholder:text-white/30"
                                                />
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => aplicarAbono('efectivo')} className="flex-1 h-8 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-colors">
                                                        <Banknote className="w-3 h-3"/>Efectivo
                                                    </button>
                                                    <button onClick={() => aplicarAbono('nequi')} className="flex-1 h-8 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-colors">
                                                        <Smartphone className="w-3 h-3"/>Nequi
                                                    </button>
                                                    <button onClick={() => aplicarAbono('transferencia')} className="flex-1 h-8 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-colors">
                                                        <Building2 className="w-3 h-3"/>Cuenta
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Confirmar pago completo de créditos seleccionados */}
                                    {facturasSeleccionadas.size > 0 && (() => {
                                        const sel = historialUnificado.filter(p => p.clienteId === cliente.id && facturasSeleccionadas.has(p.id) && p.metodoPago === 'credito');
                                        const saldoTotal = sel.reduce((s, h) => { const ab = (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0); return s + Math.max(0, h.total - ab); }, 0);
                                        if (sel.length === 0 || saldoTotal <= 0) return null;
                                        const confirmarPago = async (metodo: MetodoPago) => {
                                            for (const h of sel) {
                                                const ab = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                                const sd = h.total - ab;
                                                if (sd > 0) await registrarAbono(h.id, metodo, sd);
                                            }
                                            setFacturasSeleccionadas(new Set());
                                            toast.success(`✓ ${sel.length} crédito(s) confirmados como pagados`);
                                        };
                                        return (
                                            <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-300/80">Pago completo · {sel.length} crédito(s) · {formatCurrency(saldoTotal)}</p>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => confirmarPago('efectivo')} className="flex-1 h-8 rounded-xl bg-emerald-500 text-white text-[8px] font-black uppercase hover:bg-emerald-600 flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3"/>Efectivo
                                                    </button>
                                                    <button onClick={() => confirmarPago('nequi')} className="flex-1 h-8 rounded-xl bg-violet-500 text-white text-[8px] font-black uppercase hover:bg-violet-600 flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3"/>Nequi
                                                    </button>
                                                    <button onClick={() => confirmarPago('transferencia')} className="flex-1 h-8 rounded-xl bg-blue-500 text-white text-[8px] font-black uppercase hover:bg-blue-600 flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3"/>Cuenta
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Navegación móvil mini-POS: dos botones siempre visibles ── */}
                <div className="lg:hidden shrink-0 flex border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {/* Productos */}
                    <button
                        onClick={() => setShowMobilePOSCart(false)}
                        className={cn(
                            'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors',
                            !showMobilePOSCart
                                ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/10'
                                : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <ShoppingCart className="w-5 h-5" />
                        Productos
                    </button>

                    <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

                    {/* Ticket */}
                    <button
                        onClick={() => setShowMobilePOSCart(true)}
                        className={cn(
                            'flex-[2] flex items-center justify-center gap-2 py-3 transition-all',
                            showMobilePOSCart || carritoPos.length > 0
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400'
                        )}
                    >
                        {carritoPos.length > 0 ? (
                            <>
                                <span className="w-6 h-6 rounded-full bg-white/25 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                    {carritoPos.reduce((s, i) => s + i.cantidad, 0)}
                                </span>
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[11px] font-black">{formatCurrency(totalCarrito)}</span>
                                    <span className="text-[9px] opacity-70 font-bold uppercase">Ver ticket</span>
                                </div>
                            </>
                        ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest">Ticket vacío</span>
                        )}
                    </button>
                </div>

            {/* ── Tabs Superiores ── */}
            <Dialog open={verHistorial} onOpenChange={v => { setVerHistorial(v); if (!v) { setAbonandoId(null); setMontoAbono(''); } }}>
                <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600" />
                                Historial — {cliente.nombre}
                            </DialogTitle>
                            {historialUnificado.filter(h => h.clienteId === cliente.id).length > 0 && (
                                <button
                                    onClick={() => exportarHistorialPDF(cliente.nombre, historialUnificado.filter(h => h.clienteId === cliente.id))}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest transition-colors shrink-0"
                                    title="Exportar a PDF"
                                >
                                    <Printer className="w-3.5 h-3.5" /> PDF
                                </button>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 space-y-3 py-2 pr-1">
                        {historialUnificado.filter(h => h.clienteId === cliente.id).length === 0 ? (
                            <div className="flex flex-col items-center py-12 text-center">
                                <History className="w-10 h-10 text-slate-200 mb-3" />
                                <p className="text-sm font-bold text-slate-400">Sin ventas registradas</p>
                                <p className="text-xs text-slate-400 mt-1">Las ventas confirmadas aparecerán aquí con fecha, foto y abonos</p>
                            </div>
                        ) : (
                            historialUnificado.filter(h => h.clienteId === cliente.id).map(h => {
                                const totalAbonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                const saldoPendiente = h.total - totalAbonado;
                                const esCreditoPendiente = h.metodoPago === 'credito' && saldoPendiente > 0;
                                const metodoBadge = {
                                    efectivo: { label: 'Efectivo', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
                                    nequi:    { label: 'Nequi',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' },
                                    credito:  { label: 'Crédito',  cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
                                }[h.metodoPago ?? 'efectivo'];
                                return (
                                <Card key={h.id} className={`rounded-2xl overflow-hidden ${esCreditoPendiente ? 'border-rose-200 dark:border-rose-800' : 'border-slate-100 dark:border-slate-700'}`}>
                                    <CardContent className="p-4 space-y-3">
                                        {/* Encabezado: fecha editable + método + total */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                {editandoFechaHistorialId === h.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="datetime-local"
                                                            value={fechaHistorialTemp}
                                                            onChange={e => setFechaHistorialTemp(e.target.value)}
                                                            className="flex-1 h-8 rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 px-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                                                            autoFocus
                                                        />
                                                        <button onClick={() => guardarFechaHistorial(h.id)} className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => setEditandoFechaHistorialId(null)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900 dark:text-white">
                                                            {new Date(h.fecha).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            {new Date(h.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                const d = new Date(h.fecha);
                                                                const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                                setFechaHistorialTemp(local);
                                                                setEditandoFechaHistorialId(h.id);
                                                            }}
                                                            className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <Pencil className="w-2.5 h-2.5" /> Cambiar fecha
                                                        </button>
                                                    </div>
                                                )}
                                                <span className={`inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${metodoBadge.cls}`}>
                                                    {metodoBadge.label}
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-black text-indigo-600 tabular-nums">{formatCurrency(h.total)}</p>
                                                {h.metodoPago === 'credito' && (
                                                    <p className={`text-[10px] font-black tabular-nums ${saldoPendiente > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {saldoPendiente > 0 ? `Debe: ${formatCurrency(saldoPendiente)}` : '✓ Pagado'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ítems (editables) */}
                                        <div className="space-y-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
                                            {h.items.map(item => (
                                                <div key={item.productoId} className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-600 dark:text-slate-400 truncate flex-1">{item.nombre}</span>
                                                    {editandoHistorialId === h.id ? (
                                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 px-1 py-0.5 shrink-0">
                                                            <button onClick={() => actualizarItemEnHistorial(h.id, item.productoId, -1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-500">
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="font-black w-4 text-center tabular-nums">{item.cantidad}</span>
                                                            <button onClick={() => actualizarItemEnHistorial(h.id, item.productoId, 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-500">
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 shrink-0">× {item.cantidad}</span>
                                                    )}
                                                    <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0">{formatCurrency(item.precio * item.cantidad)}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                                                <button
                                                    onClick={() => setEditandoHistorialId(editandoHistorialId === h.id ? null : h.id)}
                                                    className={`text-[9px] font-black uppercase tracking-wide flex items-center gap-1 transition-colors ${editandoHistorialId === h.id ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
                                                >
                                                    <Pencil className="w-2.5 h-2.5" />
                                                    {editandoHistorialId === h.id ? 'Listo' : 'Editar ticket'}
                                                </button>
                                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 tabular-nums">Total: {formatCurrency(h.total)}</span>
                                            </div>

                                            {/* Buscador para agregar productos al ticket */}
                                            {editandoHistorialId === h.id && (
                                                <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800 space-y-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3" />Agregar producto al ticket</p>
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar producto..."
                                                        value={busquedaEditTicket}
                                                        onChange={e => setBusquedaEditTicket(e.target.value)}
                                                        className="w-full h-8 rounded-lg border border-indigo-200 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:border-indigo-400"
                                                    />
                                                    {busquedaEditTicket.length >= 2 && (
                                                        <div className="max-h-36 overflow-y-auto space-y-1">
                                                            {tablaDatosTodos
                                                                .filter(d => d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase()))
                                                                .slice(0, 8)
                                                                .map(d => (
                                                                    <button
                                                                        key={d.producto.id}
                                                                        onClick={() => { agregarProductoAHistorial(h.id, d.producto.id, d.producto.nombre, d.precioMayorista); setBusquedaEditTicket(''); }}
                                                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                                                                    >
                                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{d.producto.nombre}</span>
                                                                        <span className="text-[10px] font-black text-indigo-600 shrink-0 ml-2">{formatCurrency(d.precioMayorista)}</span>
                                                                    </button>
                                                                ))
                                                            }
                                                            {tablaDatosTodos.filter(d => d.producto.nombre.toLowerCase().includes(busquedaEditTicket.toLowerCase())).length === 0 && (
                                                                <p className="text-[10px] text-slate-400 text-center py-2">Sin resultados</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Abonos registrados */}
                                        {(h.abonos ?? []).length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                    <ChevronRight className="w-3 h-3" /> Abonos recibidos
                                                </p>
                                                {(h.abonos ?? []).map((a, idx) => {
                                                    const aBadge = {
                                                        efectivo: 'bg-emerald-100 text-emerald-700',
                                                        nequi:    'bg-violet-100 text-violet-700',
                                                        credito:  'bg-rose-100 text-rose-700',
                                                    }[a.metodoPago] ?? 'bg-slate-100 text-slate-600';
                                                    return (
                                                        <div key={a.id || idx} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-1.5 group/abono">
                                                            <div>
                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full mr-2 ${aBadge}`}>
                                                                    {{ efectivo: 'Efectivo', nequi: 'Nequi', credito: 'Crédito' }[a.metodoPago]}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {new Date(a.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {new Date(a.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-emerald-600 tabular-nums">+{formatCurrency(a.monto)}</span>
                                                                <button onClick={(e) => { e.stopPropagation(); eliminarAbono(h.id, a.id, idx); }} className="opacity-0 group-hover/abono:opacity-100 text-rose-500 hover:text-rose-700 p-0.5 rounded-sm hover:bg-rose-100 transition-all" title="Eliminar abono">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex justify-between px-3 pt-1 border-t border-slate-200 dark:border-slate-700">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">Saldo pendiente</span>
                                                    <span className={`text-sm font-black tabular-nums ${saldoPendiente > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {saldoPendiente > 0 ? formatCurrency(saldoPendiente) : '✓ Pagado'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Registrar abono — disponible en CUALQUIER factura */}
                                        {saldoPendiente > 0 && (
                                            abonandoId === h.id ? (
                                                <div className="space-y-2 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">Registrar abono — saldo: {formatCurrency(saldoPendiente)}</p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            value={montoAbono}
                                                            onChange={e => setMontoAbono(e.target.value)}
                                                            placeholder="Monto del abono"
                                                            className="flex-1 h-9 rounded-xl border border-rose-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold focus:outline-none focus:border-indigo-400"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        <button onClick={() => registrarAbono(h.id, 'efectivo')} className="h-9 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase hover:bg-emerald-200 transition-colors flex items-center justify-center gap-1">
                                                            <Banknote className="w-3.5 h-3.5" /> Efectivo
                                                        </button>
                                                        <button onClick={() => registrarAbono(h.id, 'nequi')} className="h-9 rounded-xl bg-violet-100 text-violet-700 text-[10px] font-black uppercase hover:bg-violet-200 transition-colors flex items-center justify-center gap-1">
                                                            <Smartphone className="w-3.5 h-3.5" /> Nequi
                                                        </button>
                                                        <button onClick={() => { setAbonandoId(null); setMontoAbono(''); }} className="h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex items-center justify-center">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setAbonandoId(h.id); setMontoAbono(''); }}
                                                    className="w-full h-9 rounded-xl border border-dashed border-rose-300 text-rose-500 hover:bg-rose-50 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" /> Registrar abono · debe {formatCurrency(saldoPendiente)}
                                                </button>
                                            )
                                        )}

                                        {/* Foto de factura */}
                                        {h.fotoFactura ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <ImageIcon className="w-3 h-3" /> Factura adjunta
                                                    </p>
                                                    <button
                                                        onClick={() => { setAdjuntandoFotoHistorialId(h.id); historialFileInputRef.current?.click(); }}
                                                        className="text-[9px] font-black text-slate-400 hover:text-indigo-500 uppercase transition-colors"
                                                    >
                                                        Cambiar
                                                    </button>
                                                </div>
                                                <img
                                                    src={h.fotoFactura}
                                                    alt="Factura"
                                                    className="w-full h-44 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => window.open(h.fotoFactura)}
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setAdjuntandoFotoHistorialId(h.id); historialFileInputRef.current?.click(); }}
                                                className="w-full h-8 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Adjuntar foto de factura
                                            </button>
                                        )}
                                    </CardContent>
                                </Card>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>
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
                        <div className="space-y-6">
                            {(() => {
                                // Agrupar por categoría manteniendo el orden
                                const grupos: Record<string, typeof tablaDatos> = {};
                                tablaDatos.filter(d => !soloViables || d.viabilidad !== 'inviable').forEach(d => {
                                    const cat = d.producto.categoria || 'Sin categoría';
                                    if (!grupos[cat]) grupos[cat] = [];
                                    grupos[cat].push(d);
                                });
                                return Object.entries(grupos).map(([categoria, items]) => (
                                    <div key={categoria}>
                                        {/* Encabezado de categoría */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                                <Package className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{categoria}</span>
                                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 rounded-full">{items.length}</span>
                                            </div>
                                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                                        </div>
                                        <div className="space-y-3">
                                        {items.map(d => {
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
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1 justify-center">
                                                        Mayorista {d.tieneOverride && <span className="text-amber-500 text-[10px]">✎</span>}
                                                    </p>
                                                    {editandoPrecioId === d.producto.id ? (
                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={tempPrecio}
                                                                onChange={e => setTempPrecio(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') { procesarInputPrecio(tempPrecio, d.pvp, d.producto.id); }
                                                                    if (e.key === 'Escape') setEditandoPrecioId(null);
                                                                }}
                                                                autoFocus
                                                                className="w-20 h-7 text-xs font-black text-center border border-indigo-400 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                step="0.01" min="0"
                                                            />
                                                            <button onClick={e => { e.stopPropagation(); const v = parseFloat(tempPrecio); if (!isNaN(v) && v > 0) setOverridePrecio(d.producto.id, v); setEditandoPrecioId(null); }} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                                                            <button onClick={e => { e.stopPropagation(); setEditandoPrecioId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <p className={`text-sm font-black tabular-nums ${d.tieneOverride ? 'text-amber-600' : 'text-indigo-600'}`}>{formatCurrency(d.precioMayorista)}</p>
                                                            <button onClick={e => { e.stopPropagation(); setEditandoPrecioId(d.producto.id); setTempPrecio(String(d.precioMayorista)); }} className="text-slate-300 hover:text-indigo-500 transition-colors"><Pencil className="w-3 h-3" /></button>
                                                        </div>
                                                    )}
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

                                                {/* Comparativa Detal vs Mayor */}
                                                <div className="mt-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                                                        📊 Comparativa Detal vs Mayor
                                                    </p>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="text-center px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <p className="text-[8px] font-black text-slate-400 uppercase">PVP (Detal)</p>
                                                            <p className="text-lg font-black text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(d.pvp)}</p>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                                                        <div className={`text-center px-4 py-2 rounded-xl border ${d.tieneOverride ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'}`}>
                                                            <p className={`text-[8px] font-black uppercase ${d.tieneOverride ? 'text-amber-500' : 'text-indigo-500'}`}>Al Mayor</p>
                                                            <p className={`text-lg font-black tabular-nums ${d.tieneOverride ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{formatCurrency(d.precioMayorista)}</p>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                                                        <div className={`text-center px-4 py-2 rounded-xl border ${d.descuentoMonto > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'}`}>
                                                            <p className={`text-[8px] font-black uppercase ${d.descuentoMonto > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Descuento</p>
                                                            <p className={`text-lg font-black tabular-nums ${d.descuentoMonto > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {d.descuentoMonto > 0 ? '-' : '+'}{formatCurrency(Math.abs(d.descuentoMonto))}
                                                            </p>
                                                            <p className={`text-[9px] font-black ${d.descuentoMonto > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                ({Math.abs(d.descuentoPct).toFixed(1)}% {d.descuentoMonto > 0 ? 'dto' : 'por encima'})
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {d.tieneOverride && (
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <p className="text-[9px] text-amber-600 font-bold">✎ Precio manual (auto: {formatCurrency(d.precioMayoristaAuto)})</p>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setOverridePrecio(d.producto.id, null); }}
                                                                className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase transition-colors"
                                                            >
                                                                Restablecer auto
                                                            </button>
                                                        </div>
                                                    )}
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
                                    </div>
                                ));
                            })()}
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
                                                    <FileText className="w-4 h-4" /> Ver Créditos
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
                <DialogContent className="max-w-md rounded-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="font-black uppercase tracking-tight">
                            {editandoCliente ? 'Editar Cliente' : 'Nuevo Cliente Mayorista'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
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
                    <DialogFooter className="shrink-0 pt-2 border-t border-slate-100">
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


