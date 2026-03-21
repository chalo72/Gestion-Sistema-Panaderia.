import {
  Package,
  Truck,
  Bell,
  TrendingUp,
  ArrowRight,
  ShoppingCart,
  CheckCircle,
  Warehouse,
  ClipboardCheck,
  AlertTriangle,
  PiggyBank,
  Utensils,
  Activity,
  Star,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/dashboard/GlassCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { cn } from '@/lib/utils';
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
    itemsEnRiesgo: number;
    totalRecetas: number;
    ventasHoy: number;
    ingresosHoy: number;
    ticketPromedio: number;
  };
  alertas: AlertaPrecio[];
  prepedidos: PrePedido[];
  onMarcarAlertaLeida: (id: string) => void;
  onViewAlertas: () => void;
  onViewProductos: () => void;
  onViewPrePedidos: () => void;
  onViewProveedores: () => void;
  onViewRecepciones: () => void;
  onViewInventario: () => void;
  onViewVentas: () => void;
  onViewAhorros: () => void;
  getProveedorById: (id: string) => { nombre: string } | undefined;
  nombre?: string;
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  mesas?: unknown[]; // Reservado para uso futuro (mesas activas en POS)
}

export default function Dashboard(props: DashboardProps) {
  const {
    estadisticas,
    alertas,
    prepedidos,
    onMarcarAlertaLeida,
    onViewAlertas,
    onViewProductos,
    onViewPrePedidos,
    onViewProveedores,
    onViewRecepciones,
    onViewInventario,
    onViewVentas,
    onViewAhorros,
    getProveedorById,
    getProductoById,
    formatCurrency
  } = props;

  // Calcula el porcentaje de riesgo de stock dinamicamente
  const stockRiesgoPct = estadisticas.totalItemsInventario > 0
    ? Math.min(Math.round((estadisticas.itemsBajoStock / estadisticas.totalItemsInventario) * 100), 90)
    : 0;

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const prepedidosBorrador = prepedidos.filter(p => p.estado === 'borrador');

  // KPI Cards config al estilo Stitch
  const kpiCards = [
    {
      label: 'Ingresos del Día',
      value: formatCurrency(Number(estadisticas.ingresosHoy || 0)),
      icon: TrendingUp,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      badge: estadisticas.ventasHoy > 0 ? `${estadisticas.ventasHoy} ventas` : null,
      badgeColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
      onClick: onViewVentas,
    },
    {
      label: 'Artículos en Catálogo',
      value: String(Number(estadisticas.totalProductos || 0)),
      icon: Package,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badge: estadisticas.productosSinPrecio > 0 ? `${estadisticas.productosSinPrecio} sin precio` : null,
      badgeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
      onClick: onViewProductos,
    },
    {
      label: 'Proveedores Activos',
      value: String(Number(estadisticas.totalProveedores || 0)),
      icon: Truck,
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      badge: null,
      badgeColor: '',
      onClick: onViewProveedores,
    },
    {
      label: 'Margen de Utilidad',
      value: `${Number(estadisticas.utilidadPromedio || 0).toFixed(1)}%`,
      icon: BarChart3,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      badge: estadisticas.totalRecetas > 0 ? `${estadisticas.totalRecetas} recetas` : 'Estable',
      badgeColor: 'text-slate-400 bg-slate-50 dark:bg-slate-900/20',
      onClick: undefined,
    },
    {
      label: 'Stock Disponible',
      value: String(Number(estadisticas.totalItemsInventario || 0)),
      icon: Warehouse,
      iconBg: estadisticas.itemsBajoStock > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: estadisticas.itemsBajoStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-teal-600 dark:text-teal-400',
      badge: estadisticas.itemsBajoStock > 0 ? `${estadisticas.itemsBajoStock} bajo stock` : 'Óptimo',
      badgeColor: estadisticas.itemsBajoStock > 0
        ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
        : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
      onClick: onViewInventario,
      hasPing: estadisticas.itemsBajoStock > 0,
    },
    {
      label: 'Ticket Promedio',
      value: formatCurrency(Number(estadisticas.ticketPromedio || 0)),
      icon: Star,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badge: null,
      badgeColor: '',
      onClick: onViewVentas,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Stitch Style */}
      <DashboardHeader
        onViewVentas={onViewVentas}
        onViewProductos={onViewProductos}
        onViewRecepciones={onViewRecepciones}
      />

      {/* ═══ KPI Cards Grid (Estilo Stitch: fondo blanco, ícono con color pastel, texto legible) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <GlassCard
              key={kpi.label}
              delay={index * 60}
              onClick={kpi.onClick}
              className={cn(
                "relative overflow-hidden",
                (kpi as any).hasPing && "border-red-200 dark:border-red-900/30"
              )}
            >
              {/* Indicador ping para alertas críticas (ej: stock bajo) */}
              {(kpi as any).hasPing && (
                <div className="absolute top-3 right-3">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-xl", kpi.iconBg)}>
                  <Icon className={cn("w-5 h-5", kpi.iconColor)} />
                </div>
                {kpi.badge && (
                  <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", kpi.badgeColor)}>
                    {kpi.badge}
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{kpi.label}</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{kpi.value}</h3>
            </GlassCard>
          );
        })}
      </div>

      {/* ═══ Sección: Alertas & Pre-Pedidos (Estilo Stitch: tarjetas blancas, tabla limpia) ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

        {/* Panel principal: Alertas */}
        <div className="xl:col-span-3 space-y-6">
          {/* Sección Performance rápida */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Panel: Performance */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Activity className={cn("w-5 h-5 text-emerald-600 dark:text-emerald-400")} />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Utilidad Neta</p>
              </div>
              <h3 className="text-2xl font-bold mb-3">{Number(estadisticas.utilidadPromedio || 0).toFixed(1)}%</h3>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(Number(estadisticas.utilidadPromedio || 0), 100)}%` }}
                />
              </div>
            </GlassCard>

            {/* Panel: Recepciones */}
            <GlassCard onClick={onViewRecepciones}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Recepciones</p>
              </div>
              <h3 className="text-2xl font-bold">{estadisticas.totalRecepciones || 0}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {estadisticas.recepcionesPendientes > 0
                  ? `${estadisticas.recepcionesPendientes} pendientes`
                  : 'Todo al día'}
              </p>
            </GlassCard>

            {/* Panel: Ahorro */}
            <GlassCard onClick={onViewAhorros}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <PiggyBank className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Proyección Ahorro</p>
              </div>
              <h3 className="text-2xl font-bold">{formatCurrency(Number(estadisticas.ingresosHoy || 0) * 0.15)}</h3>
              <p className="text-xs text-slate-400 mt-1">15% sugerido del día</p>
            </GlassCard>
          </div>

          {/* Panel: Pre-Pedidos en borrador */}
          <GlassCard className="overflow-hidden p-0">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Pre-Pedidos Pendientes</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{prepedidosBorrador.length} órdenes en borrador</p>
              </div>
              <Button
                onClick={onViewPrePedidos}
                variant="ghost"
                className="text-primary text-sm font-semibold hover:underline"
              >
                Ver Todo
              </Button>
            </div>
            {prepedidosBorrador.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle className="w-10 h-10 mb-3 text-emerald-400" />
                <p className="text-sm font-semibold">Sin pedidos pendientes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-3">Orden</th>
                      <th className="px-6 py-3">Artículos</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {prepedidosBorrador.map((pedido) => (
                      <tr key={pedido.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold">#{pedido.id?.slice(-6)}</span>
                        </td>
                        <td className="px-6 py-4 text-sm">{pedido.items?.length || 0} artículos</td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-bold">
                            Borrador
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onViewPrePedidos}
                            className="text-slate-400 hover:text-primary transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Panel lateral: Alertas de Stock (Estilo Stitch sidebar) */}
        <div className="space-y-6">
          <GlassCard className={cn(
            "border-l-4 overflow-hidden",
            alertasNoLeidas.length > 0 ? "border-l-red-500" : "border-l-emerald-500"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Alertas de Stock</h3>
              {alertasNoLeidas.length > 0 ? (
                <Bell className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              )}
            </div>

            {alertasNoLeidas.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">Sistema estable</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertasNoLeidas.slice(0, 3).map((alerta, idx) => {
                  const producto = getProductoById(alerta.productoId);
                  // Porcentaje visual escalonado por severidad: primera alerta = mas critica
                  const barWidth = Math.max(stockRiesgoPct, 8) - idx * 4;
                  return (
                    <div key={alerta.id} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold truncate max-w-[70%]">
                          {producto?.nombre || 'Producto sin nombre'}
                        </p>
                        <span className="text-xs text-red-600 font-bold shrink-0 ml-2">
                          {alerta.tipo || 'Alerta'}
                        </span>
                      </div>
                      <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-1.5 mb-3">
                        <div
                          className="bg-red-500 h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(barWidth, 8)}%` }}
                          title={`${estadisticas.itemsBajoStock} item(s) con stock bajo`}
                        />
                      </div>
                      <button
                        onClick={() => onMarcarAlertaLeida(alerta.id)}
                        className="w-full py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all uppercase tracking-wide"
                      >
                        Marcar leída
                      </button>
                    </div>
                  );
                })}
                {alertasNoLeidas.length > 3 && (
                  <Button
                    onClick={onViewAlertas}
                    variant="ghost"
                    className="w-full text-primary text-xs font-bold hover:underline"
                  >
                    Ver todas ({alertasNoLeidas.length}) <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </GlassCard>

          {/* Consejo / Accesos rápidos */}
          <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20">
            <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Accesos Rápidos
            </h4>
            <div className="space-y-2 mt-3">
              {[
                { label: 'Inventario', icon: Warehouse, onClick: onViewInventario },
                { label: 'Proveedores', icon: Truck, onClick: onViewProveedores },
                { label: 'Mesas / POS', icon: Utensils, onClick: onViewVentas },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-primary transition-colors text-sm font-medium"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
