import { useState } from 'react';
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Check,
  Trash2,
  Filter,
  AlertTriangle,
  Store,
  DollarSign,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { AlertaPrecio, Producto, Proveedor } from '@/types';

interface AlertasProps {
  alertas: AlertaPrecio[];
  productos: Producto[];
  proveedores: Proveedor[];
  onMarcarLeida: (id: string) => void;
  onMarcarTodasLeidas: () => void;
  onDeleteAlerta: (id: string) => void;
  onClearAll: () => void;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function Alertas({
  alertas,
  productos: _productos,
  proveedores: _proveedores,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onDeleteAlerta,
  onClearAll,
  getProductoById,
  getProveedorById,
  formatCurrency,
}: AlertasProps) {
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const alertasLeidas = alertas.filter(a => a.leida);

  const handleMarcarTodas = () => {
    onMarcarTodasLeidas();
    toast.success('Todas las alertas marcadas como leídas');
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de eliminar todas las alertas?')) {
      onClearAll();
      toast.success('Todas las alertas eliminadas');
    }
  };


  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Alertas de Inteligencia
          </h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary animate-pulse" />
            Vigilancia en tiempo real de cambios en el mercado
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {alertasNoLeidas.length > 0 && (
            <Button
              variant="outline"
              onClick={handleMarcarTodas}
              className="glass-card hover:bg-primary/10 border-primary/20 transition-ag shadow-sm"
            >
              <CheckCheck className="w-4 h-4 mr-2 text-primary" />
              <span className="hidden sm:inline">Marcar todas leídas</span>
              <span className="sm:hidden">Todo leída</span>
            </Button>
          )}
          {alertas.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="glass-card hover:bg-destructive/10 border-destructive/20 text-destructive transition-ag"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 bg-white/40 dark:bg-black/20 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-sm w-fit">
        <div className="flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar:</span>
        </div>
        <Tabs defaultValue="pendientes" className="flex-1">
          <TabsList className="bg-transparent h-9 p-0 gap-1">
            <TabsTrigger
              value="pendientes"
              className="rounded-xl px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-ag"
            >
              Pendientes ({alertasNoLeidas.length})
            </TabsTrigger>
            <TabsTrigger
              value="historial"
              className="rounded-xl px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground transition-ag"
            >
              Historial ({alertasLeidas.length})
            </TabsTrigger>
          </TabsList>

          <div className="hidden">
            <TabsContent value="pendientes" />
            <TabsContent value="historial" />
          </div>
        </Tabs>

        <div className="h-4 w-px bg-border/50 mx-2" />

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-32 border-none bg-transparent focus:ring-0 shadow-none h-8 font-medium">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="glass-layer-2 border-white/20">
            <SelectItem value="todas" className="rounded-lg">Todas</SelectItem>
            <SelectItem value="subida" className="rounded-lg text-destructive">Subidas</SelectItem>
            <SelectItem value="bajada" className="rounded-lg text-ag-success">Bajadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="animate-ag-fade-in">
        {filtroTipo !== 'todas' || alertas.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {(filtroTipo === 'todas'
              ? (alertasNoLeidas.length > 0 ? alertasNoLeidas : alertasLeidas)
              : alertas.filter(a => a.tipo === filtroTipo)
            ).map((alerta, index) => {
              const producto = getProductoById(alerta.productoId);
              const proveedor = getProveedorById(alerta.proveedorId);
              const isSubida = alerta.tipo === 'subida';

              return (
                <div
                  key={alerta.id}
                  className={`glass-layer-2 p-5 border-l-4 transition-ag group stagger-${(index % 6) + 1} ${!alerta.leida
                    ? isSubida ? 'border-l-destructive bg-destructive/5' : 'border-l-emerald-500 bg-emerald-50/30'
                    : 'border-l-muted bg-white/40 opacity-80'
                    }`}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Icono y Estado */}
                    <div className="flex items-center md:flex-col md:justify-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isSubida ? 'bg-destructive/10 text-destructive shadow-destructive/10' : 'bg-emerald-100 text-emerald-600 shadow-emerald-100/10'
                        }`}>
                        {isSubida ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      </div>
                      {!alerta.leida && (
                        <Badge className={`md:mt-2 px-2 py-0 h-5 text-[10px] uppercase font-bold tracking-wider ${isSubida ? 'bg-destructive/20 text-destructive' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          Nueva
                        </Badge>
                      )}
                    </div>

                    {/* Información Principal */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                            {producto?.nombre || 'Producto Desconocido'}
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {producto?.categoria}
                            </span>
                          </h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Store className="w-3.5 h-3.5" />
                            {proveedor?.nombre || 'Proveedor Desconocido'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-primary" />
                            Diferencia
                          </p>
                          <p className={`text-xl font-black ${isSubida ? 'text-destructive' : 'text-emerald-500'}`}>
                            {isSubida ? '+' : '-'}{formatCurrency(Math.abs(alerta.diferencia))}
                            <span className="text-sm ml-1 opacity-70">({alerta.porcentajeCambio.toFixed(1)}%)</span>
                          </p>
                        </div>
                      </div>

                      {/* Comparativa de Precios */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/40">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold">Precio Anterior</p>
                          <p className="text-base font-mono font-medium">{formatCurrency(alerta.precioAnterior)}</p>
                        </div>
                        <div className={`p-3 rounded-xl border ${isSubida ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-50/50 border-emerald-200/50'
                          }`}>
                          <p className="text-[10px] uppercase text-muted-foreground font-bold">Precio Nuevo</p>
                          <p className={`text-base font-mono font-bold ${isSubida ? 'text-destructive' : 'text-emerald-600'}`}>
                            {formatCurrency(alerta.precioNuevo)}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 md:col-span-2 relative overflow-hidden group/venta">
                          <p className="text-[10px] uppercase text-primary font-bold">Resumen de Venta</p>
                          <p className="text-base font-semibold text-foreground">
                            {formatCurrency(producto?.precioVenta || 0)}
                            <span className="text-xs font-normal text-muted-foreground ml-2">P. Venta</span>
                          </p>
                          {isSubida && (
                            <div className="absolute top-0 right-0 p-2 opacity-30 group-hover/venta:opacity-100 transition-opacity">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {new Date(alerta.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <div className="flex items-center gap-2">
                          {!alerta.leida && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-ag"
                              onClick={() => onMarcarLeida(alerta.id)}
                            >
                              <Check className="w-4 h-4 mr-1.5" />
                              Entendido
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-ag"
                            onClick={() => onDeleteAlerta(alerta.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center glass-layer-1 border-dashed">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 animate-ag-float">
              <Bell className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold">Todo bajo control</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mt-2">
              No hay alertas pendientes en este momento. Te avisaremos cuando detectemos cambios de precios.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default Alertas;
