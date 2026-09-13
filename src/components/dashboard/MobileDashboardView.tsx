import { useState } from 'react';
import {
  ShoppingCart,
  Banknote,
  Scale,
  Package,
  Eye,
  EyeOff,
  TrendingUp,
  AlertTriangle,
  Truck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Bell,
  ArrowUpRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AlertaPrecio } from '@/types';
import { FindingsFeed } from '@/components/agentes/FindingsFeed';

interface MobileDashboardViewProps {
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
    gastosHoy?: number;
    ticketPromedio: number;
  };
  alertas: AlertaPrecio[];
  ingresosHoyReal: number;
  ingresosEsManual: boolean;
  nombre?: string;
  formatCurrency: (value: number) => string;
  canVerTotales: boolean;
  canVerMargen: boolean;
  onViewVentas: () => void;
  onViewCaja?: () => void;
  onViewProduccion?: () => void;
  onViewInventario: () => void;
  onViewProductos: () => void;
  onViewProveedores: () => void;
  onViewRecepciones?: () => void;
  onViewPrePedidos?: () => void;
  onViewAlertas: () => void;
  onViewRecetas?: () => void;
  onViewReportes?: () => void;
}

export function MobileDashboardView({
  estadisticas,
  alertas,
  ingresosHoyReal,
  ingresosEsManual,
  nombre,
  formatCurrency,
  canVerTotales,
  canVerMargen,
  onViewVentas,
  onViewCaja,
  onViewProduccion,
  onViewInventario,
  onViewProductos,
  onViewProveedores,
  onViewRecepciones,
  onViewPrePedidos,
  onViewAlertas,
  onViewRecetas,
  onViewReportes,
}: MobileDashboardViewProps) {
  const [saldoOculto, setSaldoOculto] = useState<boolean>(() => {
    return localStorage.getItem('dp_saldo_oculto_mobile') === 'true';
  });
  const [mostrarInteligencia, setMostrarInteligencia] = useState(false);

  const toggleSaldoOculto = () => {
    const nuevo = !saldoOculto;
    setSaldoOculto(nuevo);
    localStorage.setItem('dp_saldo_oculto_mobile', String(nuevo));
  };

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const itemsBajoStock = Number(estadisticas.itemsBajoStock || 0);

  // Fecha bonita en español
  const fechaHoy = new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  return (
    <div className="space-y-4 pb-24 md:hidden">
      {/* ── HEADER SALUDO MÓVIL ── */}
      <div className="flex items-center justify-between pt-1 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 text-lg">
            🥖
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider capitalize">
                {fechaHoy}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Hola, {nombre || 'Maestro Panadero'}
            </h2>
          </div>
        </div>

        {/* Botón de alertas con badge */}
        <button
          onClick={onViewAlertas}
          className="relative w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm active:scale-95 transition-transform"
          aria-label="Ver alertas"
        >
          <Bell className="w-5 h-5" />
          {alertasNoLeidas.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-600 text-[9px] font-black text-white">
                {alertasNoLeidas.length > 9 ? '9+' : alertasNoLeidas.length}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ── TARJETA HERO: SALDO / INGRESOS DE HOY ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white p-5 shadow-xl shadow-orange-600/20">
        {/* Adorno visual de fondo */}
        <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-6 -top-6 w-28 h-28 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-200" />
              Ingresos de Hoy
            </span>
            <button
              onClick={toggleSaldoOculto}
              className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-amber-100"
              title={saldoOculto ? 'Mostrar saldo' : 'Ocultar saldo'}
            >
              {saldoOculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <p className="text-3xl font-black tracking-tight drop-shadow-sm tabular-nums">
              {saldoOculto ? '$ • • • • • •' : (canVerTotales ? formatCurrency(ingresosHoyReal) : '$ •••••')}
            </p>
          </div>

          {/* Mini-píldoras informativas del día */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="bg-black/20 backdrop-blur-md rounded-xl px-2.5 py-1 text-[11px] font-bold text-amber-100 flex items-center gap-1">
              <span>🛒</span>
              <span>{estadisticas.ventasHoy || 0} ventas</span>
            </div>
            {canVerTotales && Number(estadisticas.ticketPromedio || 0) > 0 && (
              <div className="bg-black/20 backdrop-blur-md rounded-xl px-2.5 py-1 text-[11px] font-bold text-amber-100 flex items-center gap-1">
                <span>🎟️</span>
                <span>Ticket: {formatCurrency(estadisticas.ticketPromedio)}</span>
              </div>
            )}
            <div className="bg-black/20 backdrop-blur-md rounded-xl px-2.5 py-1 text-[10px] font-bold text-amber-200">
              {ingresosEsManual ? 'Cierre manual' : 'POS en vivo'}
            </div>
          </div>
        </div>
      </div>

      {/* ── MUELLE DE ACCIONES RÁPIDAS (1 TOQUE CON EL PULGAR) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
          Acciones Rápidas
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {/* Vender */}
          <button
            onClick={onViewVentas}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-orange-50 dark:hover:bg-orange-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
              Vender
            </span>
          </button>

          {/* Caja */}
          <button
            onClick={onViewCaja || onViewVentas}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25 flex items-center justify-center">
              <Banknote className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
              Caja
            </span>
          </button>

          {/* Horno / Maestro Panadero */}
          <button
            onClick={onViewProduccion || onViewRecetas}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 flex items-center justify-center">
              <Scale className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
              Hornear
            </span>
          </button>

          {/* Inventario */}
          <button
            onClick={onViewInventario}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-blue-50 dark:hover:bg-blue-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 flex items-center justify-center relative">
              <Package className="w-6 h-6" />
              {itemsBajoStock > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
              Stock
            </span>
          </button>

          {/* Recepciones (Recibir Proveedor) */}
          <button
            onClick={onViewRecepciones || onViewProveedores} 
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-rose-50 dark:hover:bg-rose-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight leading-tight">
              Recibir
            </span>
          </button>

          {/* Pedidos (Hacer Pedido) */}
          <button
            onClick={onViewPrePedidos || onViewProveedores}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-all group hover:bg-violet-50 dark:hover:bg-violet-950/20"
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight leading-tight">
              Pedidos
            </span>
          </button>
        </div>
      </div>

      {/* ── CUADRÍCULA OPERATIVA TÁCTIL 2x2 ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bajo Stock */}
        <button
          onClick={onViewInventario}
          className={cn(
            'p-4 rounded-3xl text-left border transition-all active:scale-[0.98] relative overflow-hidden',
            itemsBajoStock > 0
              ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                itemsBajoStock > 0
                  ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                  : 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400'
              )}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            {itemsBajoStock > 0 && (
              <Badge variant="destructive" className="text-[10px] font-black h-5 px-1.5">
                ¡Alerta!
              </Badge>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Bajo Stock
          </p>
          <p
            className={cn(
              'text-xl font-black mt-0.5',
              itemsBajoStock > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-white'
            )}
          >
            {itemsBajoStock > 0 ? `${itemsBajoStock} ítems` : 'Óptimo'}
          </p>
        </button>

        {/* Artículos en Catálogo */}
        <button
          onClick={onViewProductos}
          className="p-4 rounded-3xl bg-white dark:bg-slate-900 text-left border border-slate-200/80 dark:border-slate-800 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Catálogo
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
            {estadisticas.totalProductos || 0} prods
          </p>
        </button>

        {/* Proveedores */}
        <button
          onClick={onViewProveedores}
          className="p-4 rounded-3xl bg-white dark:bg-slate-900 text-left border border-slate-200/80 dark:border-slate-800 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Proveedores
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
            {estadisticas.totalProveedores || 0} activos
          </p>
        </button>

        {/* Fórmulas & Margen */}
        <button
          onClick={onViewRecetas || onViewReportes}
          className="p-4 rounded-3xl bg-white dark:bg-slate-900 text-left border border-slate-200/80 dark:border-slate-800 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {canVerMargen ? 'Margen Utilidad' : 'Fórmulas'}
          </p>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {canVerMargen
              ? `${Number(estadisticas.utilidadPromedio || 0).toFixed(1)}%`
              : `${estadisticas.totalRecetas || 0} recetas`}
          </p>
        </button>
      </div>

      {/* ── ACORDEÓN PLEGABLE: INTELIGENCIA PICO-CLAW Y REPORTES ── */}
      <div className="rounded-3xl border border-indigo-200/60 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/40 dark:from-indigo-950/20 dark:to-purple-950/20 overflow-hidden">
        <button
          onClick={() => setMostrarInteligencia(!mostrarInteligencia)}
          className="w-full p-4 flex items-center justify-between text-left active:bg-indigo-100/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Inteligencia y Vigilancia
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Patrullaje PICO-CLAW en tiempo real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] font-black border-indigo-300 text-indigo-700 bg-indigo-100/60">
              ACTIVO
            </Badge>
            {mostrarInteligencia ? (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-indigo-600" />
            )}
          </div>
        </button>

        {mostrarInteligencia && (
          <div className="p-4 pt-0 border-t border-indigo-100 dark:border-indigo-900/40 space-y-4 animate-in fade-in">
            <FindingsFeed />
          </div>
        )}
      </div>

      {/* ── ACCESO A INFORMES COMPLETOS ── */}
      {onViewReportes && (
        <Button
          onClick={onViewReportes}
          variant="outline"
          className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-wider border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          Ver Reporte Financiero Completo
          <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
        </Button>
      )}
    </div>
  );
}
