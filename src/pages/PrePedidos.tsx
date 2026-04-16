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
  onRemoveItem: (itemId: string, pedidoId: string) => void;
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
  const [showSupplierGrid, setShowSupplierGrid] = useState(true); // INICIAR EN TABLERO POR DEFECTO
  const [activeProveedorId, setActiveProveedorId] = useState<string | null>(null);

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

          {/* Grid de pedidos */}
          {prepedidos.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase text-sm tracking-widest">Sin pedidos aún</p>
              <p className="text-xs mt-1">Crea tu primer pedido desde el panel</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prepedidos.map(p => {
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
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gap-8 px-4 md:px-4 py-8 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10 overflow-hidden">
         <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-indigo-500/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 space-y-8">
        <PrePedidoHeader
          onAddPrePedido={() => setIsCreateModalOpen(true)}
          onGenerarSugerencias={async () => {
            const count = await onGenerarSugerencias();
            if (count > 0) toast.success(`${count} Borradores inteligentes generados 🪄`);
            else toast.info('Stock equilibrado.');
          }}
          pedidosCount={prepedidos.length}
        />

        {showSupplierGrid ? (
          <div className="animate-ag-fade-in space-y-8 pb-40">
            <div className="flex items-center justify-between">
               <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Panel de Aliados</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Toca un proveedor para iniciar pedido rápido</p>
               </div>
               <Button onClick={() => setShowSupplierGrid(false)} variant="outline" className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-3">
                 <ShoppingCart className="w-4 h-4" /> VOLVER AL TICKET
               </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {proveedores.map(prov => {
                const isSelected = selectedPrePedido?.proveedorId === prov.id;
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
                      setShowSupplierGrid(false);
                    }}
                    className={cn(
                      "rounded-2xl border border-slate-200 transition-all cursor-pointer group relative overflow-hidden h-[180px] flex flex-col hover:shadow-lg hover:border-indigo-400",
                      isSelected ? "bg-indigo-50/30 border-indigo-600" : "bg-white"
                    )}
                  >
                    {criticalCount > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-rose-500 text-white border-none font-black text-[8px] px-1.5 py-0.5 animate-pulse">
                          {criticalCount} ALERTA
                        </Badge>
                      </div>
                    )}

                    <div className="p-4 flex-1">
                       <div className={cn(
                         "w-12 h-12 rounded-xl flex items-center justify-center border transition-all mb-3 text-slate-400",
                         isSelected ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-50 border-slate-100"
                       )}>
                          <Store className="w-6 h-6" />
                       </div>
                       
                       <div className="space-y-0.5">
                          <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">{prov.nombre}</h3>
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">CATÁLOGO</span>
                             {tieneBorrador && <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[7px] uppercase h-4">ACTIVO</Badge>}
                          </div>
                       </div>
                    </div>
                    
                    <div className={cn(
                      "mt-auto p-2 border-t flex items-center justify-between text-slate-300",
                      isSelected ? "bg-indigo-600/5 border-indigo-100" : "bg-slate-50/50 border-slate-100"
                    )}>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">ABRIR</span>
                       <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-8 min-h-[75vh]">
            <div className="flex-1 space-y-8 animate-ag-fade-in pb-20">
               <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => setShowSupplierGrid(true)} className="rounded-xl border-slate-200 font-black h-12 uppercase text-[10px] tracking-widest gap-2">
                    <LayoutGrid className="w-4 h-4" /> SELECCIONAR PROVEEDOR
                  </Button>
               </div>
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
                  onShowBoard={() => { setShowSupplierGrid(true); setActiveProveedorId(null); }} // Nueva prop para volver
                />
            </div>

            <div className="w-full lg:w-[380px] lg:sticky lg:top-8 h-fit animate-ag-slide-up">
              <Card className="rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border-slate-200 dark:border-slate-800 overflow-hidden border-b-8 border-b-indigo-600">
                 <div className="bg-slate-50 dark:bg-slate-950 p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShoppingCart className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-white">Ticket</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumen</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-black tabular-nums bg-white dark:bg-slate-800 border-indigo-100 text-indigo-600 px-3 py-1 rounded-full">
                      {activeDraft?.items.length || 0} ITEMS
                    </Badge>
                 </div>

                 <CardContent className="p-0">
                    <ScrollArea className="h-[450px] p-6">
                      {!activeDraft || activeDraft.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-24 opacity-30 grayscale">
                          <Package className="w-16 h-16 mb-6 text-indigo-300" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-center text-slate-500">Carrito vacío</p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="flex items-center gap-2 mb-4">
                             <Store className="w-3.5 h-3.5 text-indigo-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 truncate">Aliado: {getProveedorById(activeDraft?.proveedorId || '')?.nombre}</span>
                          </div>
                          {activeDraft?.items.map((item) => {
                            const prod = getProductoById(item.productoId);
                            const bestPrice = activeDraft ? getMejorPrecioByProveedor(item.productoId, activeDraft.proveedorId) : undefined;
                            
                            // Lógica HEURÍSTICA: Si no hay valor oficial, deducir por el nombre (Kola PQÑ, Roman 250, etc)
                            const nombreUpper = (prod?.nombre || '').toUpperCase();
                            const detectado12 = (nombreUpper.includes('PQÑ') || nombreUpper.includes('400') || nombreUpper.includes('250')) ? 12 : 1;
                            
                            const bulkAmount = Number(bestPrice?.cantidadEmbalaje || (prod as any)?.cantidadEmbalaje || detectado12);
                            const isBulk = bulkAmount > 1;
                            const embalajeNombre = bestPrice?.tipoEmbalaje || (prod as any)?.tipoEmbalaje || (bulkAmount === 12 ? 'PACA' : 'CUID');
                            
                            return (
                              <div key={item.id} className="group animate-ag-fade-in border-b border-slate-100 dark:border-slate-800/50 pb-4 last:border-none">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <h5 className="font-black uppercase text-[11px] tracking-tight truncate w-32 text-slate-800 dark:text-slate-200">{prod?.nombre}</h5>
                                    <div className="flex items-center gap-2">
                                      {/* CONTROLES DE EDICIÓN EN TICKET - FILA ÚNICA COMPACTA (OPTIMIZADA) */}
                                      <div className="flex items-center gap-1 mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                                        {/* UNIDADES (CHICO PERO CLARO) */}
                                        <div className="flex items-center bg-slate-100/80 dark:bg-slate-800 rounded-md p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm">
                                          <button 
                                            onClick={() => {
                                              const newQty = Math.max(1, item.cantidad - 1);
                                              debounceUpdate(item.id, () => activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty), 50);
                                              // Actualización visual inmediata (Optimistic UI)
                                              item.cantidad = newQty;
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-all active:scale-95"
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <div className="px-2 min-w-[28px] flex items-center justify-center">
                                            <span className="text-[11px] font-black tabular-nums text-slate-800 dark:text-slate-100">{item.cantidad}</span>
                                          </div>
                                          <button 
                                            onClick={() => {
                                              const newQty = item.cantidad + 1;
                                              debounceUpdate(item.id, () => activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty), 50);
                                              item.cantidad = newQty;
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-white rounded transition-all active:scale-95"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* SEPARADOR */}
                                        {isBulk && <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700/50 mx-1" />}

                                        {/* PACAS (COMPACTO) */}
                                        {isBulk && (
                                          <div className="flex items-center bg-indigo-50 dark:bg-indigo-950/30 rounded-md p-0.5 border border-indigo-100 dark:border-indigo-900 shadow-sm">
                                            <button 
                                              onClick={() => {
                                                const newQty = Math.max(1, item.cantidad - bulkAmount);
                                                debounceUpdate(item.id, () => activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty), 50);
                                                item.cantidad = newQty;
                                              }}
                                              className="px-1.5 h-6 flex items-center justify-center text-rose-600 hover:bg-rose-500 hover:text-white rounded text-[9px] font-black transition-all active:scale-95"
                                            >
                                              -{embalajeNombre[0]}
                                            </button>
                                            <div className="px-2 min-w-[35px] flex items-center justify-center">
                                              <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                                                {(item.cantidad / bulkAmount).toFixed(1).replace('.0', '')}
                                              </span>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                const newQty = item.cantidad + bulkAmount;
                                                debounceUpdate(item.id, () => activeDraft && onUpdateItemCantidad(activeDraft.id, item.id, newQty), 50);
                                                item.cantidad = newQty;
                                              }}
                                              className="px-1.5 h-6 flex items-center justify-center text-emerald-600 hover:bg-emerald-500 hover:text-white rounded text-[9px] font-black transition-all active:scale-95"
                                            >
                                              +{embalajeNombre[0]}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-bold tabular-nums">
                                        x {formatCurrency(item.precioUnitario)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-1">
                                    <span className="font-black text-[12px] tabular-nums text-indigo-600">{formatCurrency(item.cantidad * item.precioUnitario)}</span>
                                    <Button variant="ghost" size="icon" onClick={() => activeDraft && onRemoveItem(item.id, activeDraft.id)} className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 transition-all opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>

                    <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 space-y-5">
                      <div className="space-y-3">
                         <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span className="tabular-nums font-bold">{formatCurrency(activeDraft?.total || 0)}</span>
                         </div>
                         <div className="flex justify-between items-center text-slate-900 dark:text-white pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                            <span className="text-[12px] font-black uppercase tracking-tighter">TOTAL COMPRA</span>
                            <span className="text-3xl font-black tabular-nums tracking-tighter text-indigo-600">{formatCurrency(activeDraft?.total || 0)}</span>
                         </div>
                      </div>

                      {/* Fecha de entrega esperada */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Entrega esperada (opcional)
                        </label>
                        <input
                          type="date"
                          value={fechaEntrega}
                          onChange={e => setFechaEntrega(e.target.value)}
                          className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>

                      <div className="flex gap-2">
                         <Button variant="outline" onClick={() => setActiveTab('gestion')} className="h-14 w-14 rounded-2xl border-slate-200 text-slate-500 hover:bg-slate-100"><LayoutGrid className="w-5 h-5" /></Button>
                         <Button
                            variant="outline"
                            disabled={!activeDraft || activeDraft.items.length === 0}
                            onClick={handleShareWhatsApp}
                            className="h-14 w-14 rounded-2xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 shadow-sm"
                            title="Compartir por WhatsApp"
                          >
                            <Share2 className="w-5 h-5" />
                          </Button>
                          <Button
                            disabled={!activeDraft || activeDraft.items.length === 0}
                            onClick={() => {
                               if (activeDraft) {
                                  onUpdatePrePedido(activeDraft.id, {
                                    estado: 'confirmado',
                                    ...(fechaEntrega ? { fechaEntregaEsperada: new Date(fechaEntrega).toISOString() } : {}),
                                  });
                                  setFechaEntrega('');
                                  toast.success('Pedido confirmado. Puedes marcarlo como Enviado cuando salga.');
                               }
                            }}
                            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-500/30 font-black uppercase text-[12px] tracking-[0.2em] gap-3 active:scale-95 transition-all group"
                          >
                            <Zap className="w-5 h-5 text-amber-300 group-hover:animate-pulse" /> Confirmar Pedido
                          </Button>
                      </div>
                    </div>
                 </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <PrePedidoModal isOpen={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} nuevoPedido={nuevoPedido} setNuevoPedido={setNuevoPedido} proveedores={proveedores} onSubmit={handleCrearPedido} />
      <PrePedidoAddItemModal isOpen={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen} productosDisponibles={[]} selectedProductoId={selectedProductoId} setSelectedProductoId={setSelectedProductoId} cantidad={cantidad} setCantidad={setCantidad} onAdd={() => {}} formatCurrency={formatCurrency} />
    </div>
  );
}
