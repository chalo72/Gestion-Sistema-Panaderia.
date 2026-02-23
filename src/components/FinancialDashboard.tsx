import { useState } from 'react';
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
  activeOrders?: number;
  totalCustomers?: number;
  creditPending?: number;
  averageOrderValue?: number;
}

/**
 * 📊 Dashboard Financiero Yimi-Style
 * Métricas en tiempo real con glassmorphism premium
 */
export function FinancialDashboard({
  totalSales = 0,
  totalRevenue = 0,
  activeOrders = 0,
  totalCustomers = 0,
  creditPending = 0,
  averageOrderValue = 0,
}: FinancialDashboardProps) {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const metrics: DashboardMetric[] = [
    {
      title: 'Ventas Totales',
      value: totalSales,
      change: 12.5,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue',
    },
    {
      title: 'Ingresos',
      value: `$${totalRevenue.toFixed(2)}`,
      change: 8.2,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green',
    },
    {
      title: 'Órdenes Activas',
      value: activeOrders,
      change: -3.4,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'purple',
    },
    {
      title: 'Clientes',
      value: totalCustomers,
      change: 5.7,
      icon: <Users className="w-6 h-6" />,
      color: 'orange',
    },
    {
      title: 'Crédito Pendiente',
      value: `$${creditPending.toFixed(2)}`,
      change: 2.1,
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'red',
    },
    {
      title: 'Ticket Promedio',
      value: `$${averageOrderValue.toFixed(2)}`,
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

        {/* Simple Chart Mock */}
        <div className="h-64 bg-gradient-to-b from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 rounded-xl p-6 flex flex-col justify-end gap-2">
          {[45, 52, 48, 75, 82, 68, 90, 78, 85, 92, 88, 95].map((height, idx) => (
            <div
              key={idx}
              className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-sm hover:from-blue-500 hover:to-cyan-300 transition-all opacity-70 hover:opacity-100 cursor-pointer"
              style={{ height: `${height}%` }}
              title={`${height}%`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Enero</span>
          <span>Febrero</span>
          <span>Marzo</span>
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
            {[
              { id: '#001', customer: 'Juan Pérez', amount: 125.50, status: 'completed' },
              { id: '#002', customer: 'María García', amount: 89.99, status: 'pending' },
              { id: '#003', customer: 'Carlos López', amount: 250.00, status: 'processing' },
            ].map((order, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{order.id}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{order.customer}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">${order.amount}</p>
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
            ))}
          </div>
        </div>

        {/* Top Productos */}
        <div className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Productos Top
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Camiseta Premium', sales: 245, revenue: 4900 },
              { name: 'Pantalón Casual', sales: 189, revenue: 5670 },
              { name: 'Chaqueta Sport', sales: 124, revenue: 6200 },
            ].map((product, idx) => (
              <div key={idx} className="p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">${product.revenue}</span>
                </div>
                <div className="w-full bg-white/30 dark:bg-gray-700/30 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                    style={{ width: `${(product.sales / 245) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {product.sales} ventas
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
