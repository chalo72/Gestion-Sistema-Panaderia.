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
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/dashboard/GlassCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { cn } from '@/lib/utils';
import type { Producto, AlertaPrecio, PrePedido } from '@/types';
import { FindingsFeed } from '@/components/agentes/FindingsFeed';

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

      {/* ═══ KPI Cards Grid ═══ */}
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
              {/* Indicador ping para alertas críticas */}
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

      {/* ═══ Sección Mixta: Inteligencia CLAW & Alertas ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

        {/* Panel Izquierdo: Inteligencia Artificial (3 cols) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Inteligencia de Agentes</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Patrullaje autónomo de PICO-CLAW en tiempo real</p>
              </div>
            </div>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-50/50 hidden sm:flex font-black">NEXUS SOVEREIGN ACTIVE</Badge>
          </div>

          <FindingsFeed />

          {/* Otros Paneles debajo del Feed si es necesario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
             {/* Panel: Ahorro */}
            <GlassCard onClick={onViewAhorros} className="border-l-4 border-l-purple-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <PiggyBank className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Proyección Ahorro</p>
              </div>
              <h3 className="text-2xl font-bold">{formatCurrency(Number(estadisticas.ingresosHoy || 0) * 0.15)}</h3>
              <p className="text-xs text-slate-400 mt-1">15% sugerido del día</p>
            </GlassCard>

            {/* Panel: Recepciones */}
            <GlassCard onClick={onViewRecepciones} className="border-l-4 border-l-blue-500">
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
          </div>
        </div>

        {/* Panel Derecho: Alertas Tradicionales & Accesos (1 col) */}
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
                  const barWidth = Math.max(stockRiesgoPct, 8) - idx * 4;
                  return (
                    <div key={alerta.id} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold truncate max-w-[70%]">
                          {producto?.nombre || 'Producto'}
                        </p>
                        <span className="text-xs text-red-600 font-bold shrink-0 ml-2 uppercase">
                           Bajo
                        </span>
                      </div>
                      <button
                        onClick={() => onMarcarAlertaLeida(alerta.id)}
                        className="w-full mt-2 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-black rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all uppercase tracking-wide"
                      >
                        Marcar leída
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Accesos rápidos */}
          <div className="bg-slate-900 dark:bg-slate-800 p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <h4 className="text-xs font-black text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Accesos Tácticos
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Inventario', icon: Warehouse, onClick: onViewInventario },
                { label: 'Proveedores', icon: Truck, onClick: onViewProveedores },
                { label: 'Carga Masiva', icon: LayoutList, onClick: () => {} },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-300 hover:bg-white/10 hover:text-white transition-all text-xs font-bold uppercase tracking-tighter"
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

// Helper icons missing or renamed
const LayoutList = Package; // Fallback
