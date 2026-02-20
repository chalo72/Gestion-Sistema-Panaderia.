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
  { key: 'productos', label: 'Artículos Totales', icon: Package, gradient: 'kpi-blue', shadowColor: 'shadow-blue-600/30', subKey: 'productosSinPrecio', subLabel: 'sin costo base' },
  { key: 'proveedores', label: 'Ecosistema de Socios', icon: Truck, gradient: 'kpi-emerald', shadowColor: 'shadow-emerald-600/30', subKey: null, subLabel: 'Proveedores Activos' },
  { key: 'alertas', label: 'Centro de Notificaciones', icon: Bell, gradient: 'kpi-amber', shadowColor: 'shadow-amber-600/30', subKey: null, subLabel: 'Alertas Inteligentes' },
  { key: 'utilidad', label: 'Rendimiento Neto', icon: TrendingUp, gradient: 'kpi-violet', shadowColor: 'shadow-violet-600/30', subKey: null, subLabel: 'Margen Global' },
  { key: 'inventario', label: 'Reserva de Stock', icon: Warehouse, gradient: 'kpi-cyan', shadowColor: 'shadow-cyan-600/30', subKey: 'itemsBajoStock', subLabel: 'en niveles críticos' },
  { key: 'historial', label: 'Dinámica de Precios', icon: History, gradient: 'kpi-rose', shadowColor: 'shadow-rose-600/30', subKey: null, subLabel: 'Modificaciones Recientes' },
] as const;

export function Dashboard({
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

        {/* Accesos Rápidos Premium */}
        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Button
            onClick={onViewProductos}
            className="btn-gradient-primary shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <Package className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
          <Button
            variant="outline"
            onClick={onViewProveedores}
            className="glass-card border-slate-200/50 hover:bg-slate-50 transition-all duration-300"
          >
            <Truck className="w-4 h-4 mr-2 text-emerald-500" />
            Proveedores
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
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          const value = getKpiValue(kpi.key);

          return (
            <Card
              key={kpi.key}
              className={`${kpi.gradient} text-white border-0 shadow-2xl ${kpi.shadowColor} overflow-hidden group hover:-translate-y-2 transition-all duration-500 ease-out animate-ag-slide-up cursor-pointer`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => {
                if (kpi.key === 'productos') onViewProductos();
                if (kpi.key === 'proveedores') onViewProveedores();
                if (kpi.key === 'alertas') onViewAlertas();
                if (kpi.key === 'inventario') onViewInventario();
              }}
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/5 rounded-full blur-xl" />

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
                    {kpi.subKey ? `${(estadisticas as any)[kpi.subKey]} ${kpi.subLabel}` : kpi.subLabel}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Alertas Inteligentes */}
        <Card className="glass-card overflow-hidden border-slate-200/50 shadow-xl animate-ag-fade-in">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100/50 bg-slate-50/30 pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 kpi-amber rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Bell className="w-5 h-5 text-white" />
              </div>
              Monitor de Alertas
            </CardTitle>
            {alertasNoLeidas.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onViewAlertas} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold">
                Historial completo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {alertasNoLeidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-slate-200" />
                </div>
                <p className="font-medium">No se detectaron fluctuaciones críticas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/50 max-h-[400px] overflow-y-auto">
                {alertasNoLeidas.slice(0, 6).map((alerta) => {
                  const producto = getProductoById(alerta.productoId);
                  const proveedor = getProveedorById(alerta.proveedorId);

                  return (
                    <div
                      key={alerta.id}
                      className="group flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-all duration-300"
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${alerta.tipo === 'subida' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {alerta.tipo === 'subida' ? <TrendingUp className="w-6 h-6 rotate-45" /> : <TrendingUp className="w-6 h-6 rotate-[135deg]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate">{producto?.nombre}</h4>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{proveedor?.nombre}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm font-black text-slate-700">
                            {formatCurrency(alerta.precioNuevo)}
                          </span>
                          <Badge
                            className={`text-[10px] h-5 px-2 font-black ${alerta.tipo === 'subida' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}
                            variant="outline"
                          >
                            {alerta.tipo === 'subida' ? `+${alerta.porcentajeCambio.toFixed(1)}%` : `${alerta.porcentajeCambio.toFixed(1)}%`}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onMarcarAlertaLeida(alerta.id)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock & Operativa */}
        <div className="space-y-6">
          <Card className="glass-card border-slate-200/50 shadow-xl animate-ag-fade-in overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-cyan-600" />
                Salud del Inventario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-center group hover:bg-blue-50 transition-colors duration-300">
                  <p className="text-3xl font-black text-blue-600 mb-1 leading-none">{estadisticas.totalItemsInventario}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKUs Registrados</p>
                </div>
                <div className={`p-4 rounded-2xl border text-center transition-all duration-300 ${estadisticas.itemsBajoStock > 0 ? 'bg-red-50 border-red-100 group hover:bg-red-100/50' : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50'}`}>
                  <p className={`text-3xl font-black mb-1 leading-none ${estadisticas.itemsBajoStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {estadisticas.itemsBajoStock}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Puntos Críticos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-200/50 shadow-xl animate-ag-fade-in overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-600" />
                  Pre-Pedidos Activos
                </CardTitle>
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-4xl font-black text-slate-800 tabular-nums leading-none">
                      {formatCurrency(estadisticas.totalEnPrePedidos).split(',')[0]}
                    </span>
                    <span className="text-lg font-bold text-slate-400">,00</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-right">Monto Estimado</p>
                    <Badge className="bg-indigo-600 text-white border-0 font-black">{prepedidosBorrador.length} Pedidos</Badge>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 animate-ag-gradient-shift"
                    style={{ width: '65%' }}
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={onViewPrePedidos}
                  className="w-full bg-slate-50 hover:bg-indigo-50 text-indigo-600 font-bold justify-between group"
                >
                  Gestionar Logística de Compras
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
