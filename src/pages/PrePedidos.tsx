import { useState, useMemo, useEffect } from 'react';
import {
  Package,
  ShoppingCart,
  ArrowLeft,
  Calculator,
  AlertTriangle,
  Store,
  Check,
  X,
  History,
  FileText,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor, PrePedido } from '@/types';

// Componentes modulares
import { PrePedidoHeader } from '@/components/prepedidos/PrePedidoHeader';
import { PrePedidoCard } from '@/components/prepedidos/PrePedidoCard';
import { PrePedidoModal } from '@/components/prepedidos/PrePedidoModal';
import { PrePedidoItem } from '@/components/prepedidos/PrePedidoItem';
import { PrePedidoAddItemModal } from '@/components/prepedidos/PrePedidoAddItemModal';

interface PrePedidosProps {
  prepedidos: PrePedido[];
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  onAddPrePedido: (data: Omit<PrePedido, 'id' | 'fechaCreacion' | 'fechaActualizacion'>) => Promise<PrePedido>;
  onUpdatePrePedido: (id: string, updates: Partial<PrePedido>) => void;
  onDeletePrePedido: (id: string) => void;
  onAddItem: (prePedidoId: string, item: { productoId: string; proveedorId: string; cantidad: number; precioUnitario: number }) => void;
  onRemoveItem: (prePedidoId: string, itemId: string) => void;
  onUpdateItemCantidad: (prePedidoId: string, itemId: string, cantidad: number) => void;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  getMejorPrecioByProveedor: (productoId: string, proveedorId: string) => PrecioProveedor | undefined;
  getPreciosByProveedor: (proveedorId: string) => PrecioProveedor[];
  formatCurrency: (value: number) => string;
  onGenerarSugerencias: () => Promise<number>;
}

export default function PrePedidos({
  prepedidos,
  productos,
  proveedores,
  precios,
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
  onGenerarSugerencias,
}: PrePedidosProps) {
  const [selectedPrePedido, setSelectedPrePedido] = useState<PrePedido | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  const [nuevoPedido, setNuevoPedido] = useState({
    nombre: '',
    proveedorId: '',
    presupuestoMaximo: '',
    notas: '',
  });

  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);

  // Mantener selectedPrePedido sincronizado con cambios en la prop prepedidos
  useEffect(() => {
    if (selectedPrePedido) {
      const updated = prepedidos.find(p => p.id === selectedPrePedido.id);
      if (updated) setSelectedPrePedido(updated);
    }
  }, [prepedidos]);

  const totalActual = useMemo(() => {
    if (!selectedPrePedido) return 0;
    return selectedPrePedido.items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedPrePedido]);

  const porcentajeUsado = useMemo(() => {
    if (!selectedPrePedido || !selectedPrePedido.presupuestoMaximo) return 0;
    return (totalActual / selectedPrePedido.presupuestoMaximo) * 100;
  }, [totalActual, selectedPrePedido]);

  const handleCrearPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoPedido.nombre || !nuevoPedido.proveedorId || !nuevoPedido.presupuestoMaximo) {
      toast.error('Nombre, proveedor y presupuesto son esenciales');
      return;
    }

    try {
      const pedido = await onAddPrePedido({
        nombre: nuevoPedido.nombre,
        proveedorId: nuevoPedido.proveedorId,
        items: [],
        total: 0,
        presupuestoMaximo: parseFloat(nuevoPedido.presupuestoMaximo),
        estado: 'borrador',
        notas: nuevoPedido.notas,
      });

      toast.success('Estrategia de pedido inicializada');
      setNuevoPedido({ nombre: '', proveedorId: '', presupuestoMaximo: '', notas: '' });
      setIsCreateModalOpen(false);
      setSelectedPrePedido(pedido);
    } catch (error) {
      toast.error('Error al crear el pre-pedido');
    }
  };

  const handleAgregarItem = async () => {
    if (!selectedPrePedido || !selectedProductoId || cantidad < 1) {
      toast.error('Selección inválida');
      return;
    }

    const precio = getMejorPrecioByProveedor(selectedProductoId, selectedPrePedido.proveedorId);
    if (!precio) {
      toast.error('El proveedor no oferta este ítem');
      return;
    }

    onAddItem(selectedPrePedido.id, {
      productoId: selectedProductoId,
      proveedorId: selectedPrePedido.proveedorId,
      cantidad: cantidad,
      precioUnitario: precio.precioCosto,
    });

    toast.success('Ítem vinculado al plan');
    setSelectedProductoId('');
    setCantidad(1);
    setIsAddItemModalOpen(false);
  };

  const handleUpdateItemCantidad = (itemId: string, nuevaCantidad: number) => {
    if (!selectedPrePedido || nuevaCantidad < 1) return;
    onUpdateItemCantidad(selectedPrePedido.id, itemId, nuevaCantidad);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!selectedPrePedido) return;
    onRemoveItem(selectedPrePedido.id, itemId);
    toast.success('Ítem descartado del plan');
  };

  const handleConfirmarPedido = () => {
    if (!selectedPrePedido) return;
    onUpdatePrePedido(selectedPrePedido.id, { estado: 'confirmado' });
    toast.success('Plan de compra confirmado y ejecutado');
    setSelectedPrePedido(null);
  };

  const handleRechazarPedido = () => {
    if (!selectedPrePedido) return;
    onUpdatePrePedido(selectedPrePedido.id, { estado: 'rechazado' });
    toast.success('Plan de compra archivado');
    setSelectedPrePedido(null);
  };

  const handleDeletePedido = (id: string) => {
    if (confirm('¿Expurgar este registro de pre-pedido permanentemente?')) {
      onDeletePrePedido(id);
      toast.success('Registro eliminado');
      if (selectedPrePedido?.id === id) setSelectedPrePedido(null);
    }
  };

  const getProductosDisponibles = (proveedorId: string) => {
    const preciosProveedor = getPreciosByProveedor(proveedorId);
    return preciosProveedor
      .map(p => {
        const producto = getProductoById(p.productoId);
        return producto ? { ...producto, precioCosto: p.precioCosto } : null;
      })
      .filter(Boolean) as (Producto & { precioCosto: number })[];
  };

  const pedidosBorrador = prepedidos.filter(p => p.estado === 'borrador');
  const pedidosConfirmados = prepedidos.filter(p => p.estado === 'confirmado');
  const pedidosRechazados = prepedidos.filter(p => p.estado === 'rechazado');

  // Vista de Detalle Expandido
  if (selectedPrePedido) {
    const proveedor = getProveedorById(selectedPrePedido.proveedorId);
    const excede = totalActual > selectedPrePedido.presupuestoMaximo;
    const isBorrador = selectedPrePedido.estado === 'borrador';

    return (
      <div className="space-y-8 animate-ag-fade-in relative pb-20">
        <div className="flex items-center justify-between mb-8 p-6 glass-card rounded-[2.5rem] bg-indigo-900 text-white shadow-2xl">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedPrePedido(null)}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">{selectedPrePedido.nombre}</h2>
              <p className="text-indigo-200/60 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mt-1">
                <Store className="w-3.5 h-3.5" /> Alianza Comercial: {proveedor?.nombre}
              </p>
            </div>
          </div>
          <Badge className={cn("h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest border-none shadow-lg", isBorrador ? "bg-amber-500" : selectedPrePedido.estado === 'confirmado' ? "bg-emerald-500" : "bg-rose-500")}>
            {selectedPrePedido.estado}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Budget Scorecard */}
          <Card className={cn(
            "lg:col-span-1 rounded-[3rem] border-none shadow-2xl overflow-hidden relative",
            excede ? "bg-rose-50 dark:bg-rose-950/20" : "bg-emerald-50 dark:bg-emerald-950/20"
          )}>
            <CardContent className="p-10 space-y-10 relative z-10">
              <div className="flex items-center justify-between">
                <div className={cn("p-4 rounded-2xl shadow-lg", excede ? "bg-rose-500 text-white" : "bg-emerald-500 text-white")}>
                  <Calculator className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Presupuesto Límite</p>
                  <p className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(selectedPrePedido.presupuestoMaximo)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50">Impacto Total Estimado</h4>
                  <p className={cn("text-5xl font-black tabular-nums tracking-tighter", excede ? "text-rose-600" : "text-emerald-600")}>
                    {formatCurrency(totalActual)}
                  </p>
                </div>
                <div className="h-4 w-full bg-white dark:bg-gray-800 rounded-full overflow-hidden p-1 shadow-inner border border-white/50">
                  <Progress value={Math.min(porcentajeUsado, 100)} className={cn("h-full rounded-full transition-all duration-1000", excede ? "bg-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]")} />
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", excede ? "text-rose-600" : "text-emerald-600")}>
                    {excede ? `Exceso: ${formatCurrency(totalActual - selectedPrePedido.presupuestoMaximo)}` : `Disponible: ${formatCurrency(selectedPrePedido.presupuestoMaximo - totalActual)}`}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{porcentajeUsado.toFixed(1)}% Consumido</span>
                </div>
              </div>

              {isBorrador && excede && (
                <div className="p-6 rounded-[2rem] bg-white/60 dark:bg-black/20 border border-rose-200 flex items-center gap-4 animate-ag-pulse">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-800 leading-relaxed">
                    Alerta: El monto excede el presupuesto estratégico. Ajuste el volumen antes de confirmar.
                  </p>
                </div>
              )}
            </CardContent>
            <FileText className="absolute -bottom-10 -right-10 w-48 h-48 opacity-[0.03] rotate-12" />
          </Card>

          {/* Items List */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                <Package className="w-5 h-5" /> Componentes del Pedido
              </h4>
              {isBorrador && (
                <Button onClick={() => setIsAddItemModalOpen(true)} className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 border-none hover:scale-105 transition-all">
                  <Plus className="w-4 h-4 mr-2" /> Vincular Oferta
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {selectedPrePedido.items.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center glass-card rounded-[3rem] border-2 border-dashed border-indigo-200 opacity-30">
                  <Package className="w-16 h-16 mb-4 text-indigo-300" />
                  <p className="font-black uppercase text-[10px] tracking-widest">Sin ítems registrados</p>
                </div>
              ) : (
                selectedPrePedido.items.map((item) => (
                  <PrePedidoItem
                    key={item.id}
                    item={item}
                    producto={getProductoById(item.productoId)}
                    formatCurrency={formatCurrency}
                    onUpdateCantidad={handleUpdateItemCantidad}
                    onRemove={handleRemoveItem}
                    isBorrador={isBorrador}
                  />
                ))
              )}
            </div>

            {isBorrador && selectedPrePedido.items.length > 0 && (
              <div className="flex justify-end gap-4 pt-10 border-t border-slate-100 dark:border-gray-800">
                <Button variant="ghost" onClick={() => setSelectedPrePedido(null)} className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest opacity-40">
                  Preservar Borrador
                </Button>
                <Button variant="outline" onClick={handleRechazarPedido} className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest border-rose-200 text-rose-500 hover:bg-rose-50">
                  <X className="w-4 h-4 mr-2" /> Archivar Plan
                </Button>
                <Button
                  disabled={excede}
                  onClick={handleConfirmarPedido}
                  className="h-14 px-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-emerald-500/30 border-none"
                >
                  <Check className="w-4 h-4 mr-2" /> Confirmar & Ejecutar
                </Button>
              </div>
            )}
          </div>
        </div>

        <PrePedidoAddItemModal
          isOpen={isAddItemModalOpen}
          onOpenChange={setIsAddItemModalOpen}
          productosDisponibles={getProductosDisponibles(selectedPrePedido.proveedorId)}
          selectedProductoId={selectedProductoId}
          setSelectedProductoId={setSelectedProductoId}
          cantidad={cantidad}
          setCantidad={setCantidad}
          onAdd={handleAgregarItem}
          formatCurrency={formatCurrency}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
      <PrePedidoHeader
        onAddPrePedido={() => { setIsCreateModalOpen(true); }}
        onGenerarSugerencias={async () => {
          const count = await onGenerarSugerencias();
          if (count > 0) toast.success(`${count} Borradores inteligentes generados 🪄`);
          else toast.info('Stock óptimo, no se requieren pedidos urgentes.');
        }}
        pedidosCount={prepedidos.length}
      />

      <Tabs defaultValue="borrador" className="w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 px-4">
          <TabsList className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md p-1.5 rounded-[2.5rem] h-16 w-full md:w-auto grid grid-cols-3 gap-2">
            <TabsTrigger value="borrador" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xl px-8">Borradores <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-none">{pedidosBorrador.length}</Badge></TabsTrigger>
            <TabsTrigger value="confirmados" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-xl px-8">Confirmados</TabsTrigger>
            <TabsTrigger value="rechazados" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-xl px-8">Archivados</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl bg-white/60 dark:bg-gray-950/40 shadow-lg text-slate-400">
              <History className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <TabsContent value="borrador" className="mt-0 focus-visible:ring-0">
          {pedidosBorrador.length === 0 ? (
            <div className="py-40 flex flex-col items-center justify-center opacity-30 text-center">
              <ShoppingCart className="w-32 h-32 mb-8 text-indigo-500 animate-ag-float" />
              <h3 className="text-2xl font-black uppercase tracking-[0.3em]">Mesa de Trabajo Limpia</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-4">No hay planes de compra en curso.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
              {pedidosBorrador.map((p) => (
                <PrePedidoCard
                  key={p.id}
                  pedido={p}
                  proveedor={getProveedorById(p.proveedorId)}
                  formatCurrency={formatCurrency}
                  onClick={() => setSelectedPrePedido(p)}
                  onDelete={handleDeletePedido}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="confirmados" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 opacity-70">
            {pedidosConfirmados.map((p) => (
              <PrePedidoCard
                key={p.id}
                pedido={p}
                proveedor={getProveedorById(p.proveedorId)}
                formatCurrency={formatCurrency}
                onClick={() => setSelectedPrePedido(p)}
                onDelete={handleDeletePedido}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rechazados" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 opacity-60 grayscale">
            {pedidosRechazados.map((p) => (
              <PrePedidoCard
                key={p.id}
                pedido={p}
                proveedor={getProveedorById(p.proveedorId)}
                formatCurrency={formatCurrency}
                onClick={() => setSelectedPrePedido(p)}
                onDelete={handleDeletePedido}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <PrePedidoModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        nuevoPedido={nuevoPedido}
        setNuevoPedido={setNuevoPedido}
        proveedores={proveedores}
        onSubmit={handleCrearPedido}
      />
    </div>
  );
}

// Export default for consistency with other sections
export { PrePedidos };
