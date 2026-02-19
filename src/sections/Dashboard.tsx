import {
  Package,
  Truck,
  Bell,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Percent,
  ShoppingCart,
  CheckCircle,
  Clock,
  Sparkles,
  Warehouse,
  ClipboardCheck,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Producto, AlertaPrecio, PrePedido } from '@/types';

interface DashboardProps {
  estadisticas: {
    totalProductos: number;
    totalProveedores: number;
    alertasNoLeidas: number;
    utilidadPromedio: number;
    productosSinPrecio: number;
    totalPrePedidos: number;
    prePedidosConfirmados: number;
    totalEnPrePedidos: number;
    totalItemsInventario: number;
    itemsBajoStock: number;
    totalRecepciones: number;
    recepcionesPendientes: number;
    totalCambiosPrecios: number;
  };
  alertas: AlertaPrecio[];
  productos: Producto[];
  prepedidos: PrePedido[];
  onMarcarAlertaLeida: (id: string) => void;
  onViewAlertas: () => void;
  onViewProductos: () => void;
  onViewPrePedidos: () => void;
  onViewProveedores: () => void;
  onViewRecepciones: () => void;
  onViewInventario: () => void;
  getProveedorById: (id: string) => { nombre: string } | undefined;
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
}

const kpiCards = [
  { key: 'productos', label: 'Total Productos', icon: Package, gradient: 'kpi-blue', shadowColor: 'shadow-blue-600/20', subKey: 'productosSinPrecio', subLabel: 'sin precio de proveedor' },
  { key: 'proveedores', label: 'Proveedores', icon: Truck, gradient: 'kpi-emerald', shadowColor: 'shadow-emerald-600/20', subKey: null, subLabel: 'Activos' },
  { key: 'alertas', label: 'Alertas', icon: Bell, gradient: 'kpi-amber', shadowColor: 'shadow-amber-600/20', subKey: null, subLabel: 'Sin leer' },
  { key: 'utilidad', label: 'Utilidad Promedio', icon: TrendingUp, gradient: 'kpi-violet', shadowColor: 'shadow-violet-600/20', subKey: null, subLabel: 'Margen de ganancia' },
  { key: 'inventario', label: 'Inventario', icon: Warehouse, gradient: 'kpi-cyan', shadowColor: 'shadow-cyan-600/20', subKey: 'itemsBajoStock', subLabel: 'con stock bajo' },
  { key: 'historial', label: 'Cambios Precio', icon: History, gradient: 'kpi-rose', shadowColor: 'shadow-rose-600/20', subKey: null, subLabel: 'Registrados' },
] as const;

export function Dashboard({
  estadisticas,
  alertas,
  productos,
  prepedidos,
  onMarcarAlertaLeida,
  onViewAlertas,
  onViewProductos,
  onViewPrePedidos,
  onViewProveedores,
  onViewRecepciones,
  onViewInventario,
  getProveedorById,
  getProductoById,
  formatCurrency
}: DashboardProps) {
  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const prepedidosBorrador = prepedidos.filter(p => p.estado === 'borrador');

  const getKpiValue = (key: string) => {
    switch (key) {
      case 'productos': return estadisticas.totalProductos;
      case 'proveedores': return estadisticas.totalProveedores;
      case 'alertas': return estadisticas.alertasNoLeidas;
      case 'utilidad': return `${estadisticas.utilidadPromedio.toFixed(1)}%`;
      case 'inventario': return estadisticas.totalItemsInventario;
      case 'historial': return estadisticas.totalCambiosPrecios;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-ag-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 kpi-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground mt-0.5">Resumen general de tu negocio</p>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button variant="outline" size="sm" onClick={onViewProductos} className="bg-card hover:bg-accent border-dashed shadow-sm">
            <Package className="w-4 h-4 mr-2 text-blue-500" />
            + Producto
          </Button>
          <Button variant="outline" size="sm" onClick={onViewProveedores} className="bg-card hover:bg-accent border-dashed shadow-sm">
            <Truck className="w-4 h-4 mr-2 text-emerald-500" />
            + Proveedor
          </Button>
          <Button variant="outline" size="sm" onClick={onViewRecepciones} className="bg-card hover:bg-accent border-dashed shadow-sm">
            <ClipboardCheck className="w-4 h-4 mr-2 text-amber-500" />
            Recibir Info
          </Button>
          <Button variant="outline" size="sm" onClick={onViewInventario} className="bg-card hover:bg-accent border-dashed shadow-sm">
            <Warehouse className="w-4 h-4 mr-2 text-cyan-500" />
            Inventario
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          const value = getKpiValue(kpi.key);

          return (
            <Card
              key={kpi.key}
              className={`${kpi.gradient} text-white border-0 shadow-xl ${kpi.shadowColor} overflow-hidden relative animate-ag-slide-up stagger-${index + 1}`}
            >
              {/* Decorative circle */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute -right-2 -bottom-6 w-16 h-16 bg-white/[0.06] rounded-full" />

              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight">{value}</div>
                <p className="text-white/70 text-sm mt-1">
                  {kpi.subKey ? `${(estadisticas as any)[kpi.subKey]} ${kpi.subLabel}` : kpi.subLabel}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pre-pedidos destacados */}
      {prepedidosBorrador.length > 0 && (
        <Card className="kpi-cyan text-white border-0 shadow-xl shadow-cyan-600/15 overflow-hidden relative animate-ag-slide-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/[0.06] rounded-full" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative z-10">
            <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
              Pre-Pedidos Activos
            </CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={onViewPrePedidos}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Ver todos
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">{prepedidosBorrador.length}</div>
                <p className="text-white/70 text-sm">En borrador</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(estadisticas.totalEnPrePedidos)}</div>
                <p className="text-white/70 text-sm">Total en pedidos</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{estadisticas.prePedidosConfirmados}</div>
                <p className="text-white/70 text-sm">Confirmados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado Operativo */}
      <Card className="border border-border/50 shadow-lg animate-ag-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Estado Operativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-2xl font-bold text-blue-600">{estadisticas.totalItemsInventario}</p>
              <p className="text-xs text-muted-foreground">Items en Inventario</p>
            </div>
            <div className={`text-center p-3 rounded-xl border ${estadisticas.itemsBajoStock > 0 ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
              <p className={`text-2xl font-bold ${estadisticas.itemsBajoStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{estadisticas.itemsBajoStock}</p>
              <p className="text-xs text-muted-foreground">Stock Bajo</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
              <p className="text-2xl font-bold text-cyan-600">{estadisticas.totalRecepciones}</p>
              <p className="text-xs text-muted-foreground">Recepciones</p>
            </div>
            <div className={`text-center p-3 rounded-xl border ${estadisticas.recepcionesPendientes > 0 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
              <p className={`text-2xl font-bold ${estadisticas.recepcionesPendientes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{estadisticas.recepcionesPendientes}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas Recientes */}
        <Card className="shadow-lg border border-border/50 animate-ag-fade-in stagger-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <div className="w-8 h-8 kpi-amber rounded-lg flex items-center justify-center shadow-md shadow-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              Alertas Recientes
            </CardTitle>
            {alertasNoLeidas.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onViewAlertas} className="text-muted-foreground hover:text-foreground">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {alertasNoLeidas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p>No hay alertas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertasNoLeidas.slice(0, 5).map((alerta, i) => {
                  const producto = getProductoById(alerta.productoId);
                  const proveedor = getProveedorById(alerta.proveedorId);

                  return (
                    <div
                      key={alerta.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-ag animate-ag-fade-in stagger-${i + 1}`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 ${alerta.tipo === 'subida' ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-emerald-500 shadow-lg shadow-emerald-500/30'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {producto?.nombre || 'Producto desconocido'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {proveedor?.nombre || 'Proveedor desconocido'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant={alerta.tipo === 'subida' ? 'destructive' : 'default'}
                            className="text-xs rounded-full px-2"
                          >
                            {alerta.tipo === 'subida' ? '↑ Subida' : '↓ Bajada'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(alerta.precioAnterior)} → {formatCurrency(alerta.precioNuevo)}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            ({alerta.porcentajeCambio.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarcarAlertaLeida(alerta.id)}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Marcar leída
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productos Recientes */}
        <Card className="shadow-lg border border-border/50 animate-ag-fade-in stagger-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <div className="w-8 h-8 kpi-blue rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                <Package className="w-4 h-4 text-white" />
              </div>
              Productos Recientes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onViewProductos} className="text-muted-foreground hover:text-foreground">
              Ver todos
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {productos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p>No hay productos registrados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {productos.map((producto, i) => (
                  <div
                    key={producto.id}
                    className={`flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-ag animate-ag-fade-in stagger-${i + 1}`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{producto.nombre}</p>
                      <p className="text-xs text-muted-foreground">{producto.categoria}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-emerald-500 font-semibold">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(producto.precioVenta)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Percent className="w-3 h-3" />
                        {producto.margenUtilidad}% margen
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pre-pedidos recientes */}
      {prepedidos.length > 0 && (
        <Card className="shadow-lg border border-border/50 animate-ag-fade-in">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <div className="w-8 h-8 kpi-cyan rounded-lg flex items-center justify-center shadow-md shadow-cyan-500/20">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              Pre-Pedidos Recientes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onViewPrePedidos} className="text-muted-foreground hover:text-foreground">
              Ver todos
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prepedidos.slice(0, 3).map((pedido, i) => {
                const proveedor = getProveedorById(pedido.proveedorId);
                const porcentajeUsado = (pedido.total / pedido.presupuestoMaximo) * 100;

                return (
                  <div
                    key={pedido.id}
                    className={`p-4 rounded-xl border transition-ag animate-ag-fade-in stagger-${i + 1} ${pedido.estado === 'confirmado' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      pedido.estado === 'rechazado' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-card border-border/50'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground">{pedido.nombre}</p>
                      {pedido.estado === 'confirmado' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {pedido.estado === 'borrador' && <Clock className="w-4 h-4 text-amber-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{proveedor?.nombre}</p>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold text-foreground">{formatCurrency(pedido.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Presupuesto:</span>
                      <span className="text-foreground">{formatCurrency(pedido.presupuestoMaximo)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${porcentajeUsado > 100 ? 'bg-red-500' :
                          porcentajeUsado > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Dashboard;
