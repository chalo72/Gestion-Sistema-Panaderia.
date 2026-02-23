import React from 'react';
import {
  Package,
  Truck,
  Bell,
  TrendingUp,
  ArrowRight,
  ShoppingCart,
  CheckCircle,
  Sparkles,
  Warehouse,
  ClipboardCheck,
  History,
  AlertTriangle,
  PiggyBank,
  Utensils,
  Activity,
  Zap,
  Target,
  BarChart3,
  TrendingDown,
  Clock,
  Eye
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
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  mesas: any[];
}

const kpiCardsConfig = [
  { key: 'productos', label: 'Artículos Totales', icon: Package, gradient: 'kpi-blue', shadowColor: 'shadow-blue-600/30', subKey: 'productosSinPrecio', subLabel: 'sin costo base' },
  { key: 'proveedores', label: 'Ecosistema de Socios', icon: Truck, gradient: 'kpi-emerald', shadowColor: 'shadow-emerald-600/30', subKey: null, subLabel: 'Proveedores Activos' },
  { key: 'riesgo', label: 'Predicción de Riesgo', icon: AlertTriangle, gradient: 'kpi-amber', shadowColor: 'shadow-amber-600/30', subKey: 'itemsEnRiesgo', subLabel: 'en riesgo de quiebre' },
  { key: 'utilidad', label: 'Rendimiento Neto', icon: TrendingUp, gradient: 'kpi-violet', shadowColor: 'shadow-violet-600/30', subKey: 'totalRecetas', subLabel: 'recetas calculadas' },
  { key: 'inventario', label: 'Reserva de Stock', icon: Warehouse, gradient: 'kpi-cyan', shadowColor: 'shadow-cyan-600/30', subKey: 'itemsBajoStock', subLabel: 'en niveles críticos' },
  { key: 'ventas', label: 'Actividad Comercial', icon: ShoppingCart, gradient: 'kpi-rose', shadowColor: 'shadow-rose-600/30', subKey: 'ventasHoy', subLabel: 'ventas hoy' },
  { key: 'mesas', label: 'Estado del Local', icon: Utensils, gradient: 'kpi-violet', shadowColor: 'shadow-violet-600/30', subKey: null, subLabel: 'mesas ocupadas' },
  { key: 'ahorros', label: 'Mis Ahorros', icon: PiggyBank, gradient: 'kpi-emerald', shadowColor: 'shadow-emerald-600/30', subKey: null, subLabel: 'Metas activas' },
] as const;

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

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const prepedidosBorrador = prepedidos.filter(p => p.estado === 'borrador');

  const getKpiValue = (key: string) => {
    switch (key) {
      case 'productos': return estadisticas.totalProductos;
      case 'proveedores': return estadisticas.totalProveedores;
      case 'riesgo': return estadisticas.itemsEnRiesgo;
      case 'utilidad': return `${estadisticas.utilidadPromedio.toFixed(1)}%`;
      case 'inventario': return estadisticas.totalItemsInventario;
      case 'totalRecetas': return estadisticas.totalRecetas;
      case 'ventas': return formatCurrency(estadisticas.ingresosHoy);
      case 'ahorros': return formatCurrency(estadisticas.ingresosHoy * 0.15); // Simulado
      case 'mesas': return props.mesas.filter(m => m.estado !== 'disponible').length;
      default: return 0;
    }
  };

  const getSubKpiValue = (kpi: any) => {
    if (kpi.key === 'utilidad') return estadisticas.totalRecetas;
    if (kpi.key === 'ahorros') return '1 meta';
    if (kpi.key === 'mesas') return `${props.mesas.length} mesas totales`;
    return (estadisticas as any)[kpi.subKey];
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-ag-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 kpi-blue rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-ag-float">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-foreground tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Centro de Mando
            </h1>
            <p className="text-muted-foreground font-medium">Panadería Dulce Placer • Visión General</p>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Button
            onClick={onViewVentas}
            className="bg-gradient-to-r from-[#ff007f] to-[#e1006a] text-white shadow-lg shadow-pink-600/20 whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Nueva Venta / POS
          </Button>
          <Button
            onClick={onViewProductos}
            className="btn-gradient-primary shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <Package className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
          <Button
            variant="outline"
            onClick={onViewRecepciones}
            className="glass-card border-slate-200/50 hover:bg-slate-50 transition-all duration-300"
          >
            <ClipboardCheck className="w-4 h-4 mr-2 text-amber-500" />
            Recepciones
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCardsConfig.map((kpi, index) => {
          const Icon = kpi.icon;
          const value = getKpiValue(kpi.key);

          return (
            <Card
              key={kpi.key}
              className={`${kpi.gradient} text-white border-0 shadow-2xl ${kpi.shadowColor} overflow-hidden group hover:-translate-y-2 transition-all duration-500 ease-out animate-ag-slide-up cursor-pointer`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => {
                if (kpi.key === 'productos') onViewProductos();
                if (kpi.key === 'alertas') onViewAlertas();
                if (kpi.key === 'inventario') onViewInventario();
                if (kpi.key === 'ventas' || kpi.key === 'mesas') onViewVentas();
                if (kpi.key === 'ahorros') onViewAhorros();
              }}
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <CardHeader className="pb-1 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest uppercase text-white/60">{kpi.label}</span>
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:rotate-12 transition-transform duration-500">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4">
                <div className="text-4xl font-black tracking-tighter mb-1">{value}</div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                    {kpi.subKey ? `${getSubKpiValue(kpi)} ${kpi.subLabel}` : kpi.subLabel}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sección: Monitor de Alertas & Pre-Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alertas de Precios */}
        <Card className="glass-card border-slate-200/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/50 pb-4 border-b border-amber-100/30">
            <CardTitle className="text-lg font-bold flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <span>Alertas Críticas</span>
                <p className="text-xs font-normal text-slate-500">{alertasNoLeidas.length} sin revisar</p>
              </div>
            </CardTitle>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {alertasNoLeidas.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {alertasNoLeidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <CheckCircle className="w-12 h-12 text-emerald-300 mb-4" />
                <p className="font-semibold">Sistema Estable ✓</p>
                <p className="text-xs text-slate-400 mt-1">No hay fluctuaciones críticas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {alertasNoLeidas.slice(0, 8).map((alerta, idx) => (
                  <div key={alerta.id} className="flex items-center gap-4 p-4 hover:bg-amber-50/40 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 text-sm truncate">{getProductoById(alerta.productoId)?.nombre}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{getProveedorById(alerta.proveedorId)?.nombre}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onMarcarAlertaLeida(alerta.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {alertasNoLeidas.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Button onClick={onViewAlertas} className="w-full text-xs font-semibold" variant="outline">
                  Ver todas las alertas <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pre-Pedidos Pendientes */}
        <Card className="glass-card border-slate-200/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50 pb-4 border-b border-blue-100/30">
            <CardTitle className="text-lg font-bold flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span>Pre-Pedidos</span>
                <p className="text-xs font-normal text-slate-500">{prepedidosBorrador.length} en borrador</p>
              </div>
            </CardTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {prepedidosBorrador.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {prepedidosBorrador.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <CheckCircle className="w-12 h-12 text-emerald-300 mb-4" />
                <p className="font-semibold">Todo Sincronizado ✓</p>
                <p className="text-xs text-slate-400 mt-1">No hay pedidos pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {prepedidosBorrador.slice(0, 8).map((pedido) => (
                  <div key={pedido.id} className="flex items-center gap-4 p-4 hover:bg-blue-50/40 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 text-sm truncate">Pedido #{pedido.id?.slice(-6)}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{pedido.items?.length || 0} artículos</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={onViewPrePedidos} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {prepedidosBorrador.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Button onClick={onViewPrePedidos} className="w-full text-xs font-semibold" variant="outline">
                  Gestionar pre-pedidos <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sección: Análisis Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Performance Diario */}
        <Card className="glass-card border-slate-200/50 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 pb-3 border-b border-emerald-100/30">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Performance Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Utilidad Neta</span>
                  <span className="text-lg font-black text-emerald-600">{estadisticas.utilidadPromedio.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${Math.min(estadisticas.utilidadPromedio, 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center pt-2">
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500">Ingresos</p>
                  <p className="font-bold text-sm text-emerald-600">{formatCurrency(estadisticas.ingresosHoy)}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500">Ticket Prom</p>
                  <p className="font-bold text-sm text-blue-600">{formatCurrency(estadisticas.ticketPromedio)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventario */}
        <Card className="glass-card border-slate-200/50 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-cyan-50/50 to-blue-50/50 pb-3 border-b border-cyan-100/30">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-cyan-600" />
              Estado Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Disponibilidad</span>
                  <span className="text-lg font-black text-cyan-600">{Math.round((estadisticas.totalItemsInventario / (estadisticas.totalItemsInventario + estadisticas.itemsBajoStock)) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.round((estadisticas.totalItemsInventario / (estadisticas.totalItemsInventario + estadisticas.itemsBajoStock)) * 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center pt-2">
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500">Total Items</p>
                  <p className="font-bold text-sm text-cyan-600">{estadisticas.totalItemsInventario}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-50">
                  <p className="text-xs text-slate-500">Bajo Stock</p>
                  <p className="font-bold text-sm text-red-600">{estadisticas.itemsBajoStock}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recepciones */}
        <Card className="glass-card border-slate-200/50 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-violet-50/50 to-purple-50/50 pb-3 border-b border-violet-100/30">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-violet-600" />
              Recepciones Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Progreso</span>
                  <span className="text-lg font-black text-violet-600">{Math.round((estadisticas.totalRecepciones / (estadisticas.totalRecepciones + estadisticas.recepcionesPendientes)) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${Math.round((estadisticas.totalRecepciones / (estadisticas.totalRecepciones + estadisticas.recepcionesPendientes)) * 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center pt-2">
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500">Completas</p>
                  <p className="font-bold text-sm text-emerald-600">{estadisticas.totalRecepciones}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500">Pendientes</p>
                  <p className="font-bold text-sm text-amber-600">{estadisticas.recepcionesPendientes}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sección: Acciones Rápidas */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-slate-200/50 hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={onViewProductos}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Productos</p>
            <p className="text-xs text-slate-500 mt-1">Gestionar catálogo</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200/50 hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={onViewProveedores}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Truck className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Proveedores</p>
            <p className="text-xs text-slate-500 mt-1">{estadisticas.totalProveedores} activos</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200/50 hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={onViewInventario}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Warehouse className="w-6 h-6 text-cyan-600" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Inventario</p>
            <p className="text-xs text-slate-500 mt-1">Stock disponible</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200/50 hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={onViewAhorros}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-6 h-6 text-rose-600" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Ahorros</p>
            <p className="text-xs text-slate-500 mt-1">Análisis financiero</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
