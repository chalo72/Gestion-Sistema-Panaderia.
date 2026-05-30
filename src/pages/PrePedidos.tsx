import { generateUUID } from '@/lib/safe-utils';
import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Minus,
  ShoppingCart,
  Package,
  Store,
  Zap,
  ChevronRight,
  LayoutGrid,
  X,
  Trash2,
  ChevronLeft,
  Share2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Check,
  Search,
  Receipt,
  ArrowLeft,
  Send,
  PackageCheck,
  Edit3,
  Save,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PrePedidoHeader } from '@/components/prepedidos/PrePedidoHeader';
import { PrePedidoModal } from '@/components/prepedidos/PrePedidoModal';
import { PrePedidoAddItemModal } from '@/components/prepedidos/PrePedidoAddItemModal';
import { ProveedorCatalogoTactico } from '@/components/prepedidos/ProveedorCatalogoTactico';
import { ComparadorPrecios } from '@/components/prepedidos/ComparadorPrecios';
import type { PrePedido, Producto, Proveedor, PrecioProveedor, InventarioItem, OrdenProduccion, Receta } from '@/types';

// Convierte cualquier fecha (string ISO, timestamp numérico, Date) a string legible sin lanzar excepción
const safeDate = (val: string | number | undefined | null, opts?: Intl.DateTimeFormatOptions): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('es-CO', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
};

// [Nexus-Volt] Speed Booster Utils
const debounceMap = new Map<string, any>();
const debounceUpdate = (id: string, fn: Function, ms: number) => {
  if (debounceMap.has(id)) clearTimeout(debounceMap.get(id));
  debounceMap.set(id, setTimeout(() => { fn(); debounceMap.delete(id); }, ms));
};

interface PrePedidosProps {
  prepedidos: PrePedido[];
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  inventario: InventarioItem[];
  produccion: OrdenProduccion[];
  recetas: Receta[];
  onAddPrePedido: (pedido: Omit<PrePedido, 'id'>) => Promise<PrePedido>;
  onUpdatePrePedido: (id: string, updates: Partial<PrePedido>) => void;
  onDeletePrePedido: (id: string) => void;
  onAddItem: (pedidoId: string, item: any) => void;
  onRemoveItem: (pedidoId: string, itemId: string) => void;
  onUpdateItemCantidad: (pedidoId: string, itemId: string, cantidad: number) => void;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  getMejorPrecioByProveedor: (productoId: string, proveedorId: string) => PrecioProveedor | undefined;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  formatCurrency: (amount: number) => string;
  onAjustarStock: (productoId: string, cantidad: number, motivo: string) => void;
  onGenerarSugerencias: () => Promise<number>;
}

export default function PrePedidos({
  prepedidos,
  productos,
  proveedores,
  precios,
  inventario,
  produccion,
  recetas,
  onAddPrePedido,
  onUpdatePrePedido,
  onDeletePrePedido,
  onAddItem,
  onRemoveItem,
  onUpdateItemCantidad,
  getProductoById,
  getProveedorById,
  getMejorPrecioByProveedor,
  getPreciosByProveedor,
  formatCurrency,
  onAjustarStock,
  onGenerarSugerencias
}: PrePedidosProps) {
  const [activeTab, setActiveTab] = useState<'creacion' | 'gestion' | 'comparador'>('creacion');
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | PrePedido['estado']>('todos');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedPrePedido, setSelectedPrePedido] = useState<PrePedido | null>(null);
  const [nuevoPedido, setNuevoPedido] = useState<Omit<PrePedido, 'id'>>({
    nombre: '',
    proveedorId: '',
    items: [],
    total: 0,
    presupuestoMaximo: 0,
    estado: 'borrador',
    notas: '',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString()
  });

  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [showSupplierGrid, setShowSupplierGrid] = useState(true); // ✅ INICIAR EN GRID SIEMPRE
  const [activeProveedorId, setActiveProveedorId] = useState<string | null>(null);
  const [showProveedorPanel, setShowProveedorPanel] = useState(false); // ✅ NUEVO: Panel de proveedor abierto
  const [searchProveedorText, setSearchProveedorText] = useState(''); // ✅ NUEVO: Buscador de proveedores

  // Estados para la vista de Cuenta
  const [panelView, setPanelView] = useState<'ticket' | 'cuenta'>('ticket');
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<Set<string>>(new Set());
  const [abonandoId, setAbonandoId] = useState<string | null>(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [fechaAbono, setFechaAbono] = useState(() => {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [metodoAbono, setMetodoAbono] = useState<'efectivo' | 'nequi' | 'transferencia' | 'credito'>('efectivo');
  
  // Para ver detalles en historial
  const [verDetallePedido, setVerDetallePedido] = useState<PrePedido | null>(null);

  // Proveedores filtrados por búsqueda
  const proveedoresFiltrados = useMemo(() => {
    if (!searchProveedorText.trim()) return proveedores;
    return proveedores.filter(p => p.nombre?.toLowerCase().includes(searchProveedorText.toLowerCase()));
  }, [proveedores, searchProveedorText]);

  // Pedidos en borrador para el ticket rápido
  const pedidosBorrador = useMemo(() => 
    prepedidos.filter(p => p.estado === 'borrador').sort((a,b) => b.total - a.total)
  , [prepedidos]);

  // Borrador activo del proveedor actual mostrado
  const activeDraft = useMemo(() => {
    if (activeProveedorId) {
      return prepedidos.find(p => p.proveedorId === activeProveedorId && p.estado === 'borrador');
    }
    return pedidosBorrador.length > 0 ? pedidosBorrador[0] : undefined;
  }, [prepedidos, activeProveedorId, pedidosBorrador]);

  // Sincronizar el pedido seleccionado si cambia la lista
  useEffect(() => {
    if (selectedPrePedido) {
      const updated = prepedidos.find(p => p.id === selectedPrePedido.id);
      if (updated) setSelectedPrePedido(updated);
    } else if (pedidosBorrador.length > 0) {
      // Por defecto seleccionar el borrador más reciente
      setSelectedPrePedido(pedidosBorrador[0]);
    }
  }, [prepedidos, pedidosBorrador]);

  const handleCrearPedido = async () => {
    if (!nuevoPedido.nombre || !nuevoPedido.proveedorId) {
      toast.error('Nombre y Proveedor son obligatorios');
      return;
    }
    const created = await onAddPrePedido(nuevoPedido);
    setIsCreateModalOpen(false);
    setSelectedPrePedido(created);
    toast.success('Orden de planificación creada');
  };

  const handleMarcarRecibido = (pedido: PrePedido) => {
    if (confirm(`¿El proveedor envió las cantidades exactas pedidas? Si es así, se ajustará automáticamente el inventario.`)) {
      // Ajustar inventario para cada item
      pedido.items.forEach(item => {
        onAjustarStock(item.productoId, item.cantidad, `Recepcion OC: ${pedido.nombre}`);
      });
      onUpdatePrePedido(pedido.id, { estado: 'recibido' });
      toast.success('Pedido marcado como recibido e inventario actualizado');
    } else {
      toast.info('Ve al módulo de "Recepciones" para detallar diferencias de inventario.');
    }
  };

  const handleRegistrarAbono = (pedidoId: string) => {
    if (!montoAbono || isNaN(Number(montoAbono)) || Number(montoAbono) <= 0) {
        toast.error('Ingresa un monto válido');
        return;
    }
    const pedido = prepedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    const abono = {
        id: generateUUID(),
        creditoId: pedido.id,
        monto: Number(montoAbono),
        fecha: new Date(fechaAbono).toISOString(),
        metodoPago: metodoAbono as any
    };

    const nuevosAbonos = [...(pedido.abonos || []), abono];
    onUpdatePrePedido(pedido.id, { abonos: nuevosAbonos });
    
    setAbonandoId(null);
    setMontoAbono('');
    const d = new Date();
    setFechaAbono(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    toast.success('Abono registrado');
  };

  const sharePedidoWhatsApp = (pedido: PrePedido) => {
    const prov = getProveedorById(pedido.proveedorId);
    let msg = `📦 *ORDEN DE COMPRA - DULCE PLACER* 🍞\n\n`;
    if (pedido.numeroOrden) msg += `*Orden:* ${pedido.numeroOrden}\n`;
    msg += `*Fecha:* ${new Date().toLocaleDateString('es-CO')}\n`;
    if (pedido.fechaEntregaEsperada) msg += `*Entrega esperada:* ${safeDate(pedido.fechaEntregaEsperada)}\n`;
    msg += `\n*Detalle de Productos:*\n`;
    pedido.items.forEach(item => {
      const p = getProductoById(item.productoId);
      msg += `▪ ${item.cantidad} x ${p?.nombre || 'Producto'}\n`;
    });
    if (pedido.notas) msg += `\n*Notas:* ${pedido.notas}\n`;
    msg += `\nPor favor confirmar recepción. ¡Gracias!`;

    const encoded = encodeURIComponent(msg);
    const phone = prov?.telefono ? prov.telefono.replace(/\D/g,'') : '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleMarcarEnviado = (pedidoId: string) => {
    onUpdatePrePedido(pedidoId, { estado: 'enviado' });
    toast.success('Orden marcada como enviada');
  };

  const handleAddItemToDraft = async (productoId: string, proveedorId: string, cantidad: number, precio: number) => {
    if (productoId) {
      toast.success('¡Agregando al ticket!', {
        duration: 800,
        icon: <ShoppingCart className="w-4 h-4 text-emerald-500 animate-bounce" />
      });
    }

    let borrador = prepedidos.find(p => p.proveedorId === proveedorId && p.estado === 'borrador');
    
    if (!borrador) {
       const prov = getProveedorById(proveedorId);
       try {
         borrador = await onAddPrePedido({
           nombre: `Pedido: ${prov?.nombre || 'Proveedor'}`,
           proveedorId,
           items: [],
           total: 0,
           presupuestoMaximo: 1000000,
           estado: 'borrador',
           notas: 'Generado desde el Panel',
           fechaCreacion: new Date().toISOString(),
           fechaActualizacion: new Date().toISOString()
         });
       } catch (error) {
         toast.error('Error al iniciar');
         return;
       }
    }

    if (productoId) {
      // [Nexus-Volt] Smart Auto-Merge: Verificar si el producto ya existe en el borrador
      const itemExistente = borrador.items.find(i => i.productoId === productoId);
      
      if (itemExistente) {
        // Si ya existe, sumamos la cantidad (Ej: 12 + 12 = 24 / 2 Pacas)
        onUpdateItemCantidad(borrador.id, itemExistente.id, itemExistente.cantidad + Math.max(1, cantidad));
      } else {
        // Si no existe, lo agregamos normal
        onAddItem(borrador.id, {
          productoId,
          proveedorId,
          cantidad: Math.max(1, cantidad),
          precioUnitario: precio
        });
      }
    }
  };

  const handleShareWhatsApp = () => {
    const draft = activeDraft;
    if (!draft || draft.items.length === 0) {
      toast.error('No hay productos en el ticket para enviar');
      return;
    }

    const prov = getProveedorById(draft.proveedorId);
    if (!prov) return;

    let message = `📦 *ORDEN DE COMPRA - DULCE PLACER* 🍞\n\n`;
    message += `Hola *${prov.contacto || prov.nombre}*, quisiera realizar el siguiente pedido:\n\n`;

    draft.items.forEach((item, index) => {
      const prod = getProductoById(item.productoId);
      const bestPrice = getMejorPrecioByProveedor(item.productoId, draft.proveedorId);
      const bulkAmount = Number(bestPrice?.cantidadEmbalaje || 1);
      const embalajeNombre = bestPrice?.tipoEmbalaje || 'UND';
      
      const pacas = item.cantidad / bulkAmount;
      const esEntero = pacas % 1 === 0;
      
      message += `${index + 1}. *${prod?.nombre}*\n`;
      message += `   🔹 Cantidad: ${item.cantidad} unidades`;
      
      if (bulkAmount > 1) {
        message += ` (${esEntero ? pacas : pacas.toFixed(1)} ${embalajeNombre})`;
      }
      
      message += `\n   💰 Ref: ${formatCurrency(item.precioUnitario)} c/u\n\n`;
    });

    message += `*TOTAL ESTIMADO:* ${formatCurrency(draft.total)}\n\n`;
    message += `_Generado automáticamente desde Dulce Placer ERP_ 🚀`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = prov.telefono 
      ? `https://wa.me/${prov.telefono.replace(/\D/g, '')}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
    toast.success('Abriendo WhatsApp para enviar pedido...');
  };

  // Helper: color y label por estado
  const estadoConfig = (estado: PrePedido['estado']) => {
    switch (estado) {
      case 'borrador':    return { label: 'BORRADOR',   color: 'bg-slate-100 text-slate-600',     icon: <Package className="w-3 h-3" /> };
      case 'confirmado':  return { label: 'CONFIRMADO', color: 'bg-indigo-100 text-indigo-700',   icon: <CheckCircle2 className="w-3 h-3" /> };
      case 'enviado':     return { label: 'ENVIADO',    color: 'bg-amber-100 text-amber-700',     icon: <Truck className="w-3 h-3" /> };
      case 'recibido':    return { label: 'RECIBIDO',   color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> };
      case 'rechazado':   return { label: 'RECHAZADO',  color: 'bg-rose-100 text-rose-700',       icon: <AlertTriangle className="w-3 h-3" /> };
    }
  };

  if (activeTab === 'comparador') {
    return (
      <ComparadorPrecios 
        proveedores={proveedores} 
        productos={productos} 
        precios={precios} 
        formatCurrency={formatCurrency} 
        onVolver={() => setActiveTab('creacion')} 
      />
    );
  }

  if (activeTab === 'gestion') {
    return (
      <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setActiveTab('creacion')} className="gap-2 font-black">
                <ChevronLeft className="w-4 h-4" /> VOLVER
              </Button>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Historial de Pedidos</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{prepedidos.length} pedido{prepedidos.length !== 1 ? 's' : ''} en total</p>
              </div>
            </div>

            {/* Boton limpiar todos */}
            {prepedidos.length > 0 && (
              confirmarLimpiar ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2">
                  <span className="text-xs font-black text-rose-700 uppercase">¿Eliminar TODOS?</span>
                  <Button size="sm" variant="destructive" className="h-8 text-xs font-black"
                    onClick={async () => {
                      for (const p of prepedidos) await onDeletePrePedido(p.id);
                      setConfirmarLimpiar(false);
                      toast.success('Todos los pedidos eliminados. Listo para empezar.');
                    }}>
                    SÍ, LIMPIAR TODO
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmarLimpiar(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setConfirmarLimpiar(true)}
                  className="gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-xs uppercase">
                  <Trash2 className="w-4 h-4" /> Limpiar Todos
                </Button>
              )
            )}
          </div>

          {/* Pestañas de filtro por estado */}
          {prepedidos.length > 0 && (() => {
            const tabs: { key: 'todos' | PrePedido['estado']; label: string; color: string }[] = [
              { key: 'todos',      label: 'Todos',      color: 'bg-slate-900 text-white' },
              { key: 'borrador',   label: 'Borradores', color: 'bg-slate-200 text-slate-700' },
              { key: 'confirmado', label: 'Confirmados', color: 'bg-indigo-600 text-white' },
              { key: 'enviado',    label: 'Enviados',   color: 'bg-amber-500 text-white' },
              { key: 'recibido',   label: 'Recibidos',  color: 'bg-emerald-600 text-white' },
              { key: 'rechazado',  label: 'Rechazados', color: 'bg-rose-500 text-white' },
            ];
            const contar = (key: typeof tabs[number]['key']) =>
              key === 'todos' ? prepedidos.length : prepedidos.filter(p => p.estado === key).length;

            return (
              <div className="flex flex-wrap gap-2">
                {tabs.map(t => {
                  const count = contar(t.key);
                  if (t.key !== 'todos' && count === 0) return null;
                  const isActive = filtroEstado === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setFiltroEstado(t.key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
                        ${isActive ? `${t.color} shadow-md border-transparent` : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                    >
                      {t.label}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Grid de pedidos */}
          {(() => {
            const pedidosFiltrados = filtroEstado === 'todos'
              ? prepedidos
              : prepedidos.filter(p => p.estado === filtroEstado);

            return pedidosFiltrados.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase text-sm tracking-widest">Sin pedidos aún</p>
              <p className="text-xs mt-1">Crea tu primer pedido desde el panel</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pedidosFiltrados.map(p => {
                const cfg = estadoConfig(p.estado);
                const proveedor = getProveedorById(p.proveedorId);
                return (
                  <Card key={p.id} onClick={() => { setVerDetallePedido(p); setActiveTab('creacion'); }} className="cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-all">
                    {/* Franja de color por estado */}
                    <div className={`h-1.5 w-full ${p.estado === 'recibido' ? 'bg-emerald-500' : p.estado === 'enviado' ? 'bg-amber-500' : p.estado === 'confirmado' ? 'bg-indigo-500' : p.estado === 'rechazado' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                    <div className="p-5 space-y-4">
                      {/* Numero de orden + estado */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {p.numeroOrden || 'ORD'} • {safeDate(p.fechaCreacion || new Date().toISOString(), { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <h3 className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white mt-0.5">{p.nombre}</h3>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{proveedor?.nombre || 'Sin proveedor'}</p>
                        </div>
                        <Badge className={`${cfg.color} border-none font-black text-[9px] uppercase flex items-center gap-1 px-2`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </div>

                      {/* Total y items */}
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                          <p className="text-2xl font-black text-indigo-600 tabular-nums">{formatCurrency(p.total)}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{p.items.length} productos</span>
                      </div>

                      {/* Fecha entrega esperada */}
                      {p.fechaEntregaEsperada && (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2 border border-amber-100">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[10px] font-black text-amber-700 uppercase">
                            Entrega: {(() => { try { const d = new Date(p.fechaEntregaEsperada!); return isNaN(d.getTime()) ? p.fechaEntregaEsperada : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return p.fechaEntregaEsperada; } })()}
                          </span>
                        </div>
                      )}

                      {/* Cambiar estado */}
                      {(p.estado === 'confirmado' || p.estado === 'enviado') && (
                        <div className="flex gap-2">
                          {p.estado === 'confirmado' && (
                            <>
                              <Button size="sm" variant="outline"
                                className="flex-1 h-8 text-[10px] font-black uppercase border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 gap-1"
                                onClick={(e) => { e.stopPropagation(); sharePedidoWhatsApp(p); }}>
                                <Share2 className="w-3.5 h-3.5" /> Enviar WhatsApp
                              </Button>
                              <Button size="sm"
                                className="flex-1 h-8 text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                onClick={(e) => { e.stopPropagation(); handleMarcarEnviado(p.id); }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Enviado
                              </Button>
                            </>
                          )}
                          {p.estado === 'enviado' && (
                            <Button size="sm"
                              className="flex-1 h-8 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={(e) => { e.stopPropagation(); handleMarcarRecibido(p); }}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Recibido
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {p.estado === 'borrador' && (
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] font-black uppercase"
                            onClick={() => { setSelectedPrePedido(p); setActiveTab('creacion'); }}>
                            Editar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => onDeletePrePedido(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* ═══ PANEL PRINCIPAL (IZQUIERDA) ═══ */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 z-10 relative min-w-0">

        {verDetallePedido ? (
          <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden min-h-0">
             {/* HEADER */}
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shrink-0 flex flex-wrap items-center gap-4">
                <Button variant="ghost" onClick={() => setVerDetallePedido(null)} className="h-12 w-12 rounded-full text-slate-500 hover:text-indigo-600 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 shrink-0">
                   <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-[200px]">
                   <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-black uppercase text-slate-900 dark:text-white tracking-tight">{verDetallePedido.nombre}</h2>
                      <Badge className="bg-indigo-100 text-indigo-700 border-none px-3 font-bold uppercase tracking-widest">{verDetallePedido.estado}</Badge>
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                         {getProveedorById(verDetallePedido.proveedorId)?.nombre} • ORDEN {verDetallePedido.numeroOrden || '#000'} • 
                      </p>
                      <Input
                         type="datetime-local"
                         value={(() => { try { const d = new Date(verDetallePedido.fechaCreacion); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } catch { return ''; } })()}
                         onChange={(e) => {
                             const localDate = new Date(e.target.value);
                             if (isNaN(localDate.getTime())) return;
                             onUpdatePrePedido(verDetallePedido.id, { fechaCreacion: localDate.toISOString() });
                             setVerDetallePedido({ ...verDetallePedido, fechaCreacion: localDate.toISOString() });
                             toast.success('Fecha actualizada');
                         }}
                         className="h-7 w-40 text-[10px] font-black bg-white dark:bg-slate-900 border-slate-200"
                      />
                   </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                   {(verDetallePedido.estado === 'borrador' || verDetallePedido.estado === 'confirmado') && (
                      <Button onClick={() => {
                          onUpdatePrePedido(verDetallePedido.id, { estado: 'borrador' });
                          setActiveProveedorId(verDetallePedido.proveedorId);
                          setShowProveedorPanel(true);
                          setPanelView('ticket');
                          setVerDetallePedido(null);
                      }} variant="outline" className="h-12 px-6 rounded-xl font-bold uppercase tracking-widest border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex gap-2 items-center flex-1 sm:flex-none">
                         <Edit3 className="w-4 h-4" /> Editar
                      </Button>
                   )}
                   <Button onClick={(e) => { e.stopPropagation(); sharePedidoWhatsApp(verDetallePedido); }} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest bg-[#25D366] hover:bg-[#1DA851] text-white flex gap-2 items-center shadow-lg shadow-emerald-500/20 flex-1 sm:flex-none">
                      <Send className="w-4 h-4" /> WhatsApp
                   </Button>
                   {verDetallePedido.estado === 'confirmado' && (
                     <Button onClick={() => handleMarcarEnviado(verDetallePedido.id)} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white flex gap-2 items-center shadow-lg shadow-blue-500/20 flex-1 sm:flex-none">
                        <CheckCircle2 className="w-4 h-4" /> Marcar Enviado
                     </Button>
                   )}
                </div>
             </div>
             
             {/* BODY */}
             <div className="flex-1 overflow-auto p-4 lg:p-10 flex flex-col items-center">
                <div className="w-full max-w-4xl space-y-6 pb-20">
                   {/* ACCIONES DE ESTADO DE ENVÍO */}
                   {(verDetallePedido.estado === 'confirmado' || verDetallePedido.estado === 'enviado') && (
                     <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                        <div>
                           <h4 className="font-black text-indigo-900 dark:text-indigo-200 text-lg uppercase tracking-tight">¿La mercancía ya viene en camino o ya llegó?</h4>
                           <p className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold mt-1">Actualiza el estado para controlar tu inventario.</p>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                           {verDetallePedido.estado === 'confirmado' && (
                             <Button onClick={() => onUpdatePrePedido(verDetallePedido.id, { estado: 'enviado' })} className="h-12 flex-1 md:flex-none px-6 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl shadow-lg flex gap-2 items-center uppercase tracking-widest text-[10px]">
                                <Truck className="w-4 h-4" /> En Camino
                             </Button>
                           )}
                           <Button onClick={() => handleMarcarRecibido(verDetallePedido)} className="h-12 flex-1 md:flex-none px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 flex gap-2 items-center uppercase tracking-widest text-[10px]">
                              <PackageCheck className="w-4 h-4" /> Recibir e Ingresar
                           </Button>
                        </div>
                     </div>
                   )}
                   
                   {/* DETALLE ITEMS */}
                   <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                      <div className="bg-slate-50 dark:bg-slate-950 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                         </div>
                         <h3 className="font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 text-xs">Productos Solicitados</h3>
                      </div>
                      <div className="p-0 overflow-x-auto">
                         <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                               <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 bg-white dark:bg-slate-900">
                                  <th className="px-6 py-4 font-bold">Producto</th>
                                  <th className="px-6 py-4 font-bold text-center">Cant.</th>
                                  <th className="px-6 py-4 font-bold text-right">Precio Ud.</th>
                                  <th className="px-6 py-4 font-bold text-right">Subtotal</th>
                               </tr>
                            </thead>
                            <tbody>
                               {verDetallePedido.items.map(item => {
                                   const prod = getProductoById(item.productoId);
                                   return (
                                       <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-black text-slate-400 text-xs">
                                                   {prod?.nombre?.charAt(0) || 'P'}
                                                </div>
                                                {prod?.nombre}
                                             </div>
                                          </td>
                                          <td className="px-6 py-4 font-black text-slate-900 dark:text-white text-center tabular-nums text-base">{item.cantidad}</td>
                                          <td className="px-6 py-4 font-semibold text-slate-500 text-right text-xs tabular-nums">{formatCurrency(item.precioUnitario)}</td>
                                          <td className="px-6 py-4 font-black text-indigo-600 text-right tabular-nums text-base">{formatCurrency(item.cantidad * item.precioUnitario)}</td>
                                       </tr>
                                   );
                               })}
                            </tbody>
                         </table>
                      </div>
                      
                      {/* TOTALES */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 border-t border-slate-200 dark:border-slate-800">
                         <div className="flex justify-between items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                             <span>Total de la Orden</span>
                             <span className="text-3xl text-slate-900 dark:text-white">{formatCurrency(verDetallePedido.total)}</span>
                         </div>
                         {(() => {
                             const abonado = (verDetallePedido.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                             if (abonado > 0) {
                                 return (
                                     <>
                                         <div className="flex justify-between items-center text-xs font-bold text-emerald-600 mt-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                                             <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> ABONADO HASTA AHORA</span>
                                             <span className="text-base">-{formatCurrency(abonado)}</span>
                                         </div>
                                         <div className="flex justify-between items-center text-sm font-black text-rose-600 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                             <span>SALDO PENDIENTE (DEUDA)</span>
                                             <span className="text-2xl">{formatCurrency(verDetallePedido.total - abonado)}</span>
                                         </div>
                                     </>
                                 )
                             }
                             return null;
                         })()}
                      </div>
                   </Card>
                </div>
             </div>
          </div>
        ) : activeProveedorId && showProveedorPanel ? (
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 min-h-0">
            <ProveedorCatalogoTactico
              proveedores={proveedores}
              productos={productos}
              precios={precios}
              inventario={inventario}
              produccion={produccion}
              recetas={recetas}
              formatCurrency={formatCurrency}
              onAddItemToDraft={handleAddItemToDraft}
              getProductoById={getProductoById}
              activeProveedorId={activeProveedorId}
              onShowBoard={() => setShowProveedorPanel(false)}
              draftItems={activeDraft?.items?.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })) ?? []}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-6 lg:p-8 min-h-0">
             {/* Header y Buscador estilo POS */}
             <div className="flex items-center gap-4 mb-6">
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" onClick={() => setActiveTab('gestion')} className="gap-2 font-black rounded-2xl text-slate-500 hover:bg-slate-100 px-4 h-14 bg-slate-50 border border-slate-100">
                     <LayoutGrid className="w-5 h-5" /> HISTORIAL
                  </Button>
                  <Button variant="ghost" onClick={() => setActiveTab('comparador')} className="gap-2 font-black rounded-2xl text-indigo-500 hover:bg-indigo-100 px-4 h-14 bg-indigo-50 border border-indigo-100">
                     <TrendingDown className="w-5 h-5" /> COMPARAR PRECIOS
                  </Button>
                </div>
                <div className="relative flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center px-5 h-14 border border-slate-100 dark:border-slate-700 transition-all focus-within:bg-white focus-within:shadow-md focus-within:border-indigo-200">
                   <Search className="w-5 h-5 text-slate-400" />
                   <input 
                     value={searchProveedorText}
                     onChange={(e) => setSearchProveedorText(e.target.value)}
                     placeholder="Busca un proveedor por nombre para iniciar un pedido..." 
                     className="bg-transparent border-none outline-none flex-1 px-4 text-sm font-bold placeholder:text-slate-400 text-slate-900 dark:text-white h-full"
                   />
                </div>
             </div>

             {/* Metadatos */}
             <div className="flex items-center justify-between px-2 mb-6 border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                   SELECCIONA UN PROVEEDOR PARA EMPEZAR
                </div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {proveedoresFiltrados.length} PROVEEDORES ENCONTRADOS
                </div>
             </div>

             {/* GRID ESTILO POS */}
             <ScrollArea className="flex-1 -mx-2 px-2 min-h-0">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 pb-20">
                  {proveedoresFiltrados.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center opacity-50 text-center">
                       <Search className="w-12 h-12 mb-3 text-slate-400" />
                       <p className="text-sm font-black uppercase tracking-widest text-slate-500">No hay proveedores que coincidan con "{searchProveedorText}"</p>
                    </div>
                  ) : proveedoresFiltrados.map(prov => {
                    const tieneBorrador = prepedidos.some(p => p.proveedorId === prov.id && p.estado === 'borrador');
                    const colorClasses = [
                      "bg-amber-100/50 text-amber-600", "bg-rose-100/50 text-rose-600", 
                      "bg-indigo-100/50 text-indigo-600", "bg-emerald-100/50 text-emerald-600", 
                      "bg-sky-100/50 text-sky-600", "bg-fuchsia-100/50 text-fuchsia-600"
                    ];
                    const charCode = prov.nombre ? prov.nombre.charCodeAt(0) : 0;
                    const colorClass = colorClasses[charCode % colorClasses.length];

                    return (
                      <button 
                        key={prov.id}
                        onClick={() => {
                          setActiveProveedorId(prov.id);
                          setShowProveedorPanel(true);
                        }}
                        className="flex flex-col items-center justify-start p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 group gap-3 relative h-full"
                      >
                         <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-inner shrink-0", colorClass)}>
                            {prov.nombre ? prov.nombre.charAt(0) : 'P'}
                         </div>
                         <div className="text-center w-full flex flex-col flex-1">
                            <h3 className="font-black text-[11px] uppercase tracking-tight text-[#1a1c2e] dark:text-slate-200 px-1 leading-snug line-clamp-3 mb-2 break-words">
                               {prov.nombre}
                            </h3>
                            <div className="mt-auto">
                               <Badge className="bg-slate-50 text-slate-400 border border-slate-100 shadow-sm text-[9px] uppercase font-black px-3 py-1 rounded-full tracking-widest">
                                 {tieneBorrador ? 'TICKET ACTIVO' : 'NUEVO PEDIDO'}
                               </Badge>
                            </div>
                         </div>
                      </button>
                    );
                  })}
                </div>
             </ScrollArea>
          </div>
        )}
      </div>

      {/* ═══ PANEL DERECHO (TICKET / CUENTA) ═══ */}
      <div className="w-[320px] lg:w-[380px] xl:w-[420px] h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shrink-0">
          
          {/* TABS DEL PANEL DERECHO */}
          <div className="flex bg-[#1a1c2e] p-2 gap-2 shrink-0 z-30 relative">
            <button
              onClick={() => setPanelView('ticket')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${panelView === 'ticket' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              📝 Pedido
            </button>
            <button
              onClick={() => setPanelView('cuenta')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${panelView === 'cuenta' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              💰 Cuenta Prov.
            </button>
          </div>

          {panelView === 'ticket' ? (
            <>
              {/* HEADER DEL TICKET ESTILO "VENTA RÁPIDA" */}
              <div className="bg-[#1a1c2e] p-5 text-white shadow-lg z-20 flex flex-col gap-4 border-t border-white/5">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                      <ShoppingCart className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-widest text-indigo-100">Nuevo Pedido</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                         {activeProveedorId ? getProveedorById(activeProveedorId)?.nombre : 'Selecciona proveedor'}
                      </p>
                    </div>
                 </div>
                 {activeDraft && (
                   <div className="bg-white/5 rounded-xl px-4 py-2.5 border border-white/10 flex items-center gap-2">
                     <Store className="w-4 h-4 text-indigo-400" />
                     <span className="text-xs font-black text-slate-200 truncate flex-1 uppercase tracking-wider">{activeDraft.nombre}</span>
                   </div>
                 )}
              </div>

          {/* LISTADO DE ITEMS DEL TICKET */}
          <div className="flex-1 overflow-hidden relative bg-white dark:bg-slate-900 min-h-0">
            <ScrollArea className="h-full p-4 lg:p-6 min-h-0">
              {!activeDraft || activeDraft.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 pt-32">
                  <ShoppingCart className="w-32 h-32 mb-6 text-slate-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {activeDraft?.items.map((item) => {
                    const prod = getProductoById(item.productoId);
                    return (
                      <div key={item.id} className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-none group">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-snug pr-2">
                            {prod?.nombre}
                          </h5>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => activeDraft && onRemoveItem(activeDraft.id, item.id)} 
                            className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100">
                            <button 
                              onClick={() => {
                                const newQty = Math.max(1, item.cantidad - 1);
                                activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors shadow-sm bg-slate-100"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-black min-w-[28px] text-center text-slate-900 dark:text-slate-100">
                              {item.cantidad}
                            </span>
                            <button 
                              onClick={() => {
                                const newQty = item.cantidad + 1;
                                activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-white rounded-lg transition-colors shadow-sm bg-slate-100"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-black text-sm text-indigo-600 tabular-nums">
                            {formatCurrency(item.cantidad * item.precioUnitario)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* FOOTER DEL TICKET */}
          <div className="p-5 lg:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-20">
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total</span>
              <span className="text-3xl font-black text-[#1a1c2e] dark:text-white tabular-nums tracking-tighter">
                {formatCurrency(activeDraft?.total || 0)}
              </span>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                disabled={!activeDraft || activeDraft.items.length === 0}
                onClick={() => {
                  toast.success('Borrador guardado');
                  setActiveProveedorId(null);
                  setShowProveedorPanel(false);
                }}
                title="Guardar para después"
                className="w-14 h-14 rounded-2xl p-0 shrink-0 text-indigo-600 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:border-indigo-200 transition-colors"
              >
                <Save className="w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                disabled={!activeDraft || activeDraft.items.length === 0}
                onClick={handleShareWhatsApp}
                title="Enviar cotización por WhatsApp"
                className="w-14 h-14 rounded-2xl p-0 shrink-0 text-emerald-600 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 hover:border-emerald-200 transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                disabled={!activeDraft || activeDraft.items.length === 0}
                onClick={() => {
                  if (activeDraft) {
                    onUpdatePrePedido(activeDraft.id, { estado: 'confirmado' });
                    toast.success('Pedido confirmado ✓');
                  }
                }}
                className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
              >
                Confirmar <Check className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
          </>
          ) : (
            /* ═══ VISTA CUENTA: Órdenes de Compra + Abonos ═══ */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                        {(() => {
                            if (!activeProveedorId) return (
                                <div className="flex flex-col items-center justify-center py-16 opacity-40">
                                    <Store className="w-12 h-12 text-slate-300 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Selecciona un proveedor</p>
                                </div>
                            );

                            // Mostrar pedidos confirmados, enviados o recibidos
                            const histProv = prepedidos.filter(p => p.proveedorId === activeProveedorId && p.estado !== 'borrador' && p.estado !== 'rechazado').sort((a,b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

                            if (histProv.length === 0) return (
                                <div className="flex flex-col items-center justify-center py-16 opacity-40">
                                    <Receipt className="w-12 h-12 text-slate-300 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Sin órdenes registradas</p>
                                    <p className="text-[9px] text-slate-400 mt-1">Crea un pedido y confírmalo para verlo aquí</p>
                                </div>
                            );

                            const selAll = histProv.every(h => pedidosSeleccionados.has(h.id));
                            const toggleAll = () => {
                                if (selAll) {
                                    setPedidosSeleccionados(new Set());
                                } else {
                                    setPedidosSeleccionados(new Set(histProv.map(h => h.id)));
                                }
                            };
                            const toggleOne = (id: string) => {
                                setPedidosSeleccionados(prev => {
                                    const next = new Set(prev);
                                    if (next.has(id)) next.delete(id); else next.add(id);
                                    return next;
                                });
                            };

                            // Calcular totales
                            const seleccionados = histProv.filter(h => pedidosSeleccionados.has(h.id));
                            const totalSeleccionado = seleccionados.reduce((s, h) => s + h.total, 0);
                            const totalAbonadoSel = seleccionados.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0);
                            const saldoSeleccionado = totalSeleccionado - totalAbonadoSel;

                            return (
                                <>
                                    {/* Seleccionar todos */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <button onClick={toggleAll} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selAll ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400'}`}>
                                            {selAll && <Check className="w-3 h-3" />}
                                        </button>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Seleccionar todos ({histProv.length})</span>
                                    </div>

                                    {/* Lista de órdenes */}
                                    {histProv.map(h => {
                                        const abonado = (h.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                                        const saldo = h.total - abonado;
                                        const checked = pedidosSeleccionados.has(h.id);
                                        const cfg = estadoConfig(h.estado);
                                        return (
                                            <div key={h.id} className={`rounded-xl border p-3 space-y-2 transition-all ${checked ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                                <div className="flex items-start gap-2">
                                                    <button onClick={() => toggleOne(h.id)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400'}`}>
                                                        {checked && <Check className="w-3 h-3" />}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1 mb-0.5">
                                                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                                                              {safeDate(h.fechaCreacion, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                          </p>
                                                        </div>
                                                        <p className="text-[11px] font-black uppercase text-indigo-600 truncate">{h.nombre}</p>
                                                        <p className="text-[9px] font-bold text-slate-500 truncate">{h.numeroOrden || 'Sin número'}</p>
                                                        
                                                        {/* Estado Badge */}
                                                        <div className="mt-1">
                                                          <Badge className={`${cfg.color} border-none font-black text-[8px] uppercase px-1.5 py-0`}>
                                                            {cfg.label}
                                                          </Badge>
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
                                                    <div className="pl-7 space-y-0.5">
                                                        {(h.abonos ?? []).map(a => (
                                                            <div key={a.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded p-1">
                                                                <span className="text-[8px] text-slate-400">{safeDate(a.fecha)}</span>
                                                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">{formatCurrency(a.monto)} <span className="uppercase text-[8px] opacity-60">({a.metodoPago})</span></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Botón de abono */}
                                                {saldo > 0 && (
                                                    <div className="pl-7 mt-1">
                                                        {abonandoId === h.id ? (
                                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800 space-y-2 mt-2">
                                                                <Input type="number" placeholder="Monto" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} className="h-7 text-xs bg-white" />
                                                                <Input type="datetime-local" value={fechaAbono} onChange={e => setFechaAbono(e.target.value)} className="h-7 text-xs bg-white" />
                                                                <select value={metodoAbono} onChange={e => setMetodoAbono(e.target.value as any)} className="w-full h-7 text-xs rounded-md border border-slate-200 px-2 outline-none">
                                                                    <option value="efectivo">Efectivo</option>
                                                                    <option value="nequi">Nequi</option>
                                                                    <option value="transferencia">Transferencia</option>
                                                                    <option value="credito">Crédito</option>
                                                                </select>
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" onClick={() => setAbonandoId(null)} variant="outline" className="flex-1 h-7 text-[10px]">Cancelar</Button>
                                                                    <Button size="sm" onClick={() => handleRegistrarAbono(h.id)} className="flex-1 h-7 text-[10px] bg-indigo-600 text-white">Guardar</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setAbonandoId(h.id)} className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded w-full flex justify-center items-center gap-1 transition-colors">
                                                                <Plus className="w-3 h-3" /> Abonar a esta orden
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
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
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionado ({pedidosSeleccionados.size})</span>
                        <span className="text-sm font-black tabular-nums">{(() => {
                            if (!activeProveedorId) return formatCurrency(0);
                            const sel = prepedidos.filter(p => p.proveedorId === activeProveedorId && pedidosSeleccionados.has(p.id));
                            return formatCurrency(sel.reduce((s, h) => s + h.total, 0));
                        })()}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Abonado</span>
                        <span className="text-sm font-black tabular-nums text-emerald-400">{(() => {
                            if (!activeProveedorId) return formatCurrency(0);
                            const sel = prepedidos.filter(p => p.proveedorId === activeProveedorId && pedidosSeleccionados.has(p.id));
                            return formatCurrency(sel.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0));
                        })()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400/70">Saldo Pendiente</span>
                        <span className="text-xl font-black tabular-nums text-rose-400">{(() => {
                            if (!activeProveedorId) return formatCurrency(0);
                            const sel = prepedidos.filter(p => p.proveedorId === activeProveedorId && pedidosSeleccionados.has(p.id));
                            const tot = sel.reduce((s, h) => s + h.total, 0);
                            const ab = sel.reduce((s, h) => s + (h.abonos ?? []).reduce((sa, a) => sa + a.monto, 0), 0);
                            return formatCurrency(tot - ab);
                        })()}</span>
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* Modal Historial de Pedidos (ELIMINADO - Ahora es vista central) */}

      <PrePedidoModal isOpen={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} nuevoPedido={nuevoPedido} setNuevoPedido={setNuevoPedido} proveedores={proveedores} onSubmit={handleCrearPedido} />
    </div>
  );
}
