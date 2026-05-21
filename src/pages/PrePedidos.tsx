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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PrePedidoHeader } from '@/components/prepedidos/PrePedidoHeader';
import { PrePedidoModal } from '@/components/prepedidos/PrePedidoModal';
import { PrePedidoAddItemModal } from '@/components/prepedidos/PrePedidoAddItemModal';
import { ProveedorCatalogoTactico } from '@/components/prepedidos/ProveedorCatalogoTactico';
import type { PrePedido, Producto, Proveedor, PrecioProveedor, InventarioItem, OrdenProduccion, Receta } from '@/types';

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
  onGenerarSugerencias
}: PrePedidosProps) {
  const [activeTab, setActiveTab] = useState<'creacion' | 'gestion'>('creacion');
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
                  <Card key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-all">
                    {/* Franja de color por estado */}
                    <div className={`h-1.5 w-full ${p.estado === 'recibido' ? 'bg-emerald-500' : p.estado === 'enviado' ? 'bg-amber-500' : p.estado === 'confirmado' ? 'bg-indigo-500' : p.estado === 'rechazado' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                    <div className="p-5 space-y-4">
                      {/* Numero de orden + estado */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{p.numeroOrden || '—'}</span>
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
                            Entrega: {new Date(p.fechaEntregaEsperada).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      )}

                      {/* Cambiar estado */}
                      {(p.estado === 'confirmado' || p.estado === 'enviado') && (
                        <div className="flex gap-2">
                          {p.estado === 'confirmado' && (
                            <Button size="sm" variant="outline"
                              className="flex-1 h-8 text-[10px] font-black uppercase border-amber-200 text-amber-700 hover:bg-amber-50 gap-1"
                              onClick={() => onUpdatePrePedido(p.id, { estado: 'enviado' })}>
                              <Truck className="w-3.5 h-3.5" /> Marcar Enviado
                            </Button>
                          )}
                          {p.estado === 'enviado' && (
                            <Button size="sm"
                              className="flex-1 h-8 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={() => onUpdatePrePedido(p.id, { estado: 'recibido' })}>
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
    <div className="min-h-screen flex flex-col gap-6 px-4 md:px-6 py-8 bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-950 dark:to-slate-900/50">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* HEADER */}
        <PrePedidoHeader
          onAddPrePedido={() => setIsCreateModalOpen(true)}
          onGenerarSugerencias={async () => {
            const count = await onGenerarSugerencias();
            if (count > 0) toast.success(`${count} Borradores inteligentes generados 🪄`);
            else toast.info('Stock equilibrado.');
          }}
          onVerHistorial={() => setActiveTab('gestion')}
          pedidosCount={prepedidos.length}
        />

        {/* MAIN LAYOUT: GRID DE PROVEEDORES + PANEL LATERAL CON PRODUCTOS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[70vh]">
          
          {/* ═══ PARTE IZQUIERDA: GRILLA DE PROVEEDORES ═══ */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Proveedores</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Toca uno para empezar</p>
            </div>
            
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {proveedores.map(prov => {
                  const isSelected = activeProveedorId === prov.id;
                  const tieneBorrador = prepedidos.some(p => p.proveedorId === prov.id && p.estado === 'borrador');
                  const criticalCount = productos.filter(p => {
                    const precio = precios.find(pr => pr.productoId === p.id && pr.proveedorId === prov.id);
                    const inv = inventario.find(i => i.productoId === p.id);
                    return precio && inv && inv.stockActual < inv.stockMinimo;
                  }).length;
                  
                  return (
                    <Card 
                      key={prov.id}
                      onClick={() => {
                        setActiveProveedorId(prov.id);
                        setShowProveedorPanel(true);
                      }}
                      className={cn(
                        "rounded-2xl border cursor-pointer transition-all group relative p-4 hover:shadow-lg",
                        isSelected 
                          ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white" 
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all text-lg font-black",
                          isSelected ? "bg-white/20 border-white/30 text-white" : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 border-indigo-200"
                        )}>
                          {prov.nombre.charAt(0)}
                        </div>
                        {criticalCount > 0 && (
                          <Badge className="bg-rose-500 text-white border-none font-black text-[8px] px-1.5 py-0.5 animate-pulse">
                            {criticalCount}!
                          </Badge>
                        )}
                      </div>
                      <h3 className={cn(
                        "font-black text-sm uppercase tracking-tight truncate",
                        isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"
                      )}>
                        {prov.nombre}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          isSelected ? "text-indigo-100" : "text-slate-400"
                        )}>
                          CATÁLOGO
                        </span>
                        {tieneBorrador && (
                          <Badge className={isSelected ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600"} style={{fontSize: "7px"}}>
                            ACTIVO
                          </Badge>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* ═══ PARTE CENTRAL: CATÁLOGO DEL PROVEEDOR ═══ */}
          <div className="lg:col-span-2">
            {activeProveedorId && showProveedorPanel ? (
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
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                <Store className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-black uppercase text-sm tracking-widest">Selecciona un proveedor</p>
                <p className="text-xs mt-2">para ver su catálogo</p>
              </div>
            )}
          </div>

          {/* ═══ PARTE DERECHA: TICKET/CARRITO ═══ */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 h-fit">
              <Card className="rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-6 text-white">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-sm tracking-tight">Ticket</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Resumen</p>
                    </div>
                  </div>
                </div>

                <CardContent className="p-0">
                  <ScrollArea className="h-[350px] p-6">
                    {!activeDraft || activeDraft.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center py-16 opacity-40">
                        <Package className="w-12 h-12 mb-4 text-slate-300" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Carrito vacío</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeDraft?.items.map((item) => {
                          const prod = getProductoById(item.productoId);
                          return (
                            <div key={item.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-none">
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 flex-1">
                                  {prod?.nombre}
                                </h5>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => activeDraft && onRemoveItem(activeDraft.id, item.id)} 
                                  className="h-6 w-6 text-rose-500 hover:bg-rose-50"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                  <button 
                                    onClick={() => {
                                      const newQty = Math.max(1, item.cantidad - 1);
                                      activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs font-black min-w-[20px] text-center text-slate-900 dark:text-slate-100">
                                    {item.cantidad}
                                  </span>
                                  <button 
                                    onClick={() => {
                                      const newQty = item.cantidad + 1;
                                      activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="font-black text-xs text-indigo-600 tabular-nums">
                                  {formatCurrency(item.cantidad * item.precioUnitario)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Total</span>
                      <span className="text-2xl font-black text-indigo-600 tabular-nums">
                        {formatCurrency(activeDraft?.total || 0)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        disabled={!activeDraft || activeDraft.items.length === 0}
                        onClick={handleShareWhatsApp}
                        className="flex-1 h-10 rounded-xl font-black text-xs uppercase gap-2"
                      >
                        <Share2 className="w-4 h-4" /> WhatsApp
                      </Button>
                      <Button
                        disabled={!activeDraft || activeDraft.items.length === 0}
                        onClick={() => {
                          if (activeDraft) {
                            onUpdatePrePedido(activeDraft.id, { estado: 'confirmado' });
                            toast.success('Pedido confirmado ✓');
                          }
                        }}
                        className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase"
                      >
                        <Check className="w-4 h-4" /> Confirmar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>

      </div>

      <PrePedidoModal isOpen={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} nuevoPedido={nuevoPedido} setNuevoPedido={setNuevoPedido} proveedores={proveedores} onSubmit={handleCrearPedido} />
    </div>
  );
}
