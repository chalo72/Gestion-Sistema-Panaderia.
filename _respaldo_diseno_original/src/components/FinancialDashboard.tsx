import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, AlertCircle, Calendar } from 'lucide-react';
// Card component
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardMetric {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

interface FinancialDashboardProps {
  totalSales?: number;
  totalRevenue?: number;
  totalExpenses?: number;
  activeOrders?: number;
  totalCustomers?: number;
  creditPending?: number;
  averageOrderValue?: number;
  ventas?: any[]; // Reales
  getProductoById?: (id: string) => any;
}

/**
 * 📊 Dashboard Financiero Yimi-Style
 * Métricas en tiempo real con glassmorphism premium
 */
export function FinancialDashboard({
  totalSales = 0,
  totalRevenue = 0,
  totalExpenses = 0,
  activeOrders = 0,
  totalCustomers = 0,
  creditPending = 0,
  averageOrderValue = 0,
  ventas = [],
  getProductoById,
}: FinancialDashboardProps) {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('month');

  // Filtrar ventas según el rango (simplificado, para escalar después)
  const ventasFiltradas = useMemo(() => {
    // Si tuviéramos fechas, filtraríamos aquí. Por ahora, usamos el array que llega.
    return Array.isArray(ventas) ? ventas : [];
  }, [ventas, timeRange]);

  // Órdenes recientes: Las últimas 5
  const ordenesRecientes = useMemo(() => {
    const sorted = [...ventasFiltradas].sort((a, b) => {
      const timeA = a?.fecha ? new Date(a.fecha).getTime() : 0;
      const timeB = b?.fecha ? new Date(b.fecha).getTime() : 0;
      return timeB - timeA;
    });
    return sorted.slice(0, 5).map(v => ({
      id: v?.id?.substring(0, 6)?.toUpperCase() || 'N/A',
      customer: v?.cliente || v?.vendedoraNombre || 'Cliente Local',
      amount: v?.total || 0,
      status: 'completed'
    }));
  }, [ventasFiltradas]);

  // Productos Top: Agrupar por productoId y sumar subtotal
  const topProductos = useMemo(() => {
    const mapa: Record<string, { name: string; sales: number; revenue: number }> = {};
    
    ventasFiltradas.forEach(v => {
      if (!v || !Array.isArray(v.items)) return;
      v.items.forEach((item: any) => {
        if (!item || !item.productoId) return;
        if (!mapa[item.productoId]) {
          const prodInfo = getProductoById ? getProductoById(item.productoId) : null;
          mapa[item.productoId] = {
            name: prodInfo?.nombre || 'Desconocido',
            sales: 0,
            revenue: 0
          };
        }
        mapa[item.productoId].sales += (Number(item.cantidad) || 0);
        mapa[item.productoId].revenue += (Number(item.subtotal) || 0);
      });
    });

    return Object.values(mapa)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // top 5
  }, [ventasFiltradas, getProductoById]);

  // Tendencia de Ventas (Real)
  const chartData = useMemo(() => {
    if (ventasFiltradas.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    // Agrupar ventas por fecha (ignorando hora)
    const ventasPorDia: Record<string, number> = {};
    ventasFiltradas.forEach(v => {
        if (!v?.fecha) return;
        const dia = new Date(v.fecha).toLocaleDateString();
        ventasPorDia[dia] = (ventasPorDia[dia] || 0) + (Number(v.total) || 0);
    });
    // Extraer los valores
    const valores = Object.values(ventasPorDia);
    // Limitar a los ultimos 12 puntos
    const ultimos = valores.slice(-12);
    // Calcular maximo para porcentajes
    const max = Math.max(...ultimos, 1); // evitar div by 0
    // Mapear a porcentajes (altura 0 a 100)
    let heights = ultimos.map(val => Math.floor((val / max) * 100));
    // Rellenar si hay muy pocos datos para que se vea bien el grafico
    while (heights.length < 5) {
        heights.unshift(0);
    }
    return heights;
  }, [ventasFiltradas]);

  const safeTotalRevenue = Number(totalRevenue) || 0;
  const safeTotalExpenses = Number(totalExpenses) || 0;
  const netProfit = safeTotalRevenue - safeTotalExpenses;

  const metrics: DashboardMetric[] = [
    {
      title: 'Ventas Totales',
      value: Number(totalSales) || 0,
      change: 12.5,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue',
    },
    {
      title: 'Ingresos',
      value: `$${safeTotalRevenue.toFixed(2)}`,
      change: 8.2,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green',
    },
    {
      title: 'Gastos',
      value: `$${safeTotalExpenses.toFixed(2)}`,
      change: -2.4,
      icon: <TrendingDown className="w-6 h-6" />,
      color: 'red',
    },
    {
      title: 'Utilidad Neta',
      value: `$${netProfit.toFixed(2)}`,
      change: 15.3,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'purple',
    },
    {
      title: 'Clientes Atendidos',
      value: Number(totalSales) || 0, // Como proxy si no hay clientes únicos
      change: 5.7,
      icon: <Users className="w-6 h-6" />,
      color: 'orange',
    },
    {
      title: 'Proveedores',
      value: Number(totalCustomers) || 0,
      change: 2.1,
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'red',
    },
    {
      title: 'Ticket Promedio',
      value: `$${(Number(averageOrderValue) || 0).toFixed(2)}`,
      change: 4.3,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'blue',
    },
  ];

  const colorClasses = {
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-600 dark:text-green-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-600 dark:text-purple-400',
    orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400',
    red: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-600 dark:text-red-400',
  };

  return (
    <div className="w-full space-y-8">
      {/* Header con Selector de Rango */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard Financiero
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Resumen de ventas y métricas clave
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur border border-white/20 dark:border-gray-700/20 rounded-xl p-1">
          {(['day', 'week', 'month', 'year'] as const).map((range) => (
            <Button
              key={range}
              onClick={() => setTimeRange(range)}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'text-xs font-medium capitalize',
                timeRange === range && 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              )}
            >
              {range === 'day' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : 'Año'}
            </Button>
          ))}
        </div>
      </div>

      {/* Metricas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className={cn(
              'backdrop-blur-xl bg-gradient-to-br border border-white/20 dark:border-gray-700/20',
              'rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300',
              colorClasses[metric.color]
            )}
          >
            {/* Icon */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/30 dark:bg-gray-700/30 flex items-center justify-center">
                {metric.icon}
              </div>
              <div className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
                metric.change > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              )}>
                {metric.change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(metric.change)}%
              </div>
            </div>

            {/* Título y Valor */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {metric.title}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metric.value}
            </p>

            {/* Timeline */}
            <div className="mt-4 pt-4 border-t border-white/10 dark:border-gray-700/10">
              <p className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Calendar size={12} />
                La última: {timeRange === 'day' ? '24h' : timeRange === 'week' ? '7d' : timeRange === 'month' ? '30d' : '1año'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Placeholder: Gráfico de Ventas */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/50 to-white/30 dark:from-gray-900/50 dark:to-gray-800/30 border border-white/20 dark:border-gray-700/20 rounded-2xl p-8 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Tendencia de Ventas
        </h2>

        {/* Chart */}
        <div className="h-64 bg-gradient-to-b from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 rounded-xl p-6 flex flex-col justify-end gap-2">
          {chartData.map((height, idx) => (
            <div
              key={idx}
              className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-sm hover:from-blue-500 hover:to-cyan-300 transition-all opacity-70 hover:opacity-100 cursor-pointer"
              style={{ height: `${height}%` }}
              title={`${height}%`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Antiguo</span>
          <span className="text-blue-500 font-semibold">Tendencia Reciente</span>
          <span>Actual</span>
        </div>
      </div>

      {/* Resumen Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Órdenes Recientes */}
        <div className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Órdenes Recientes
          </h3>
          <div className="space-y-3">
            {ordenesRecientes.length > 0 ? (
              ordenesRecientes.map((order, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">#{order.id}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">${order.amount.toFixed(2)}</p>
                    <span className={cn(
                      'text-xs font-semibold px-2 py-1 rounded-full',
                      order.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      order.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                      order.status === 'processing' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    )}>
                      {order.status === 'completed' ? '✓ Completada' : order.status === 'pending' ? '⏳ Pendiente' : '🔄 Procesando'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center">No hay órdenes en este periodo.</p>
            )}
          </div>
        </div>

        {/* Top Productos */}
        <div className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Productos Top
          </h3>
          <div className="space-y-3">
            {topProductos.length > 0 ? (
              topProductos.map((product, idx) => {
                const maxRevenue = Math.max(...topProductos.map(p => p.revenue), 1); // para el % de la barra
                return (
                  <div key={idx} className="p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">${product.revenue.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-white/30 dark:bg-gray-700/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                        style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {product.sales} ventas
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center">No hay datos suficientes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
