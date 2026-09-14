import { useState, useMemo } from 'react';
import {
  Bell, TrendingUp, TrendingDown, Check, Trash2,
  AlertTriangle, Store, CheckCheck, Zap, ShieldAlert,
  ArrowRight, Clock, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { AlertaPrecio, Producto, Proveedor } from '@/types';
import { cn } from '@/lib/utils';

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

function calcPrioridad(pct: number, tipo: 'subida' | 'bajada'): 'CRÍTICA' | 'ALTA' | 'NORMAL' {
  if (tipo === 'subida') {
    if (pct >= 20) return 'CRÍTICA';
    if (pct >= 8) return 'ALTA';
  }
  return 'NORMAL';
}

function timeAgo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `hace ${days}d`;
  if (hrs > 0) return `hace ${hrs}h`;
  if (mins > 0) return `hace ${mins}m`;
  return 'ahora';
}

const PRIORIDAD_CONFIG = {
  CRÍTICA: {
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    borderLeft: 'border-l-rose-500',
    topBar: 'bg-rose-500/10',
    badge: 'bg-rose-500 text-white',
    icon: ShieldAlert,
  },
  ALTA: {
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    borderLeft: 'border-l-amber-500',
    topBar: 'bg-amber-500/10',
    badge: 'bg-amber-500 text-white',
    icon: AlertTriangle,
  },
  NORMAL: {
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    borderLeft: 'border-l-slate-400',
    topBar: 'bg-muted/30',
    badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    icon: Bell,
  },
};

type TabActiva = 'pendientes' | 'historial';
type FiltroTipo = 'todas' | 'subida' | 'bajada';
type FiltroPrioridad = 'todas' | 'CRÍTICA' | 'ALTA' | 'NORMAL';

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
  const [tabActiva, setTabActiva] = useState<TabActiva>('pendientes');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>('todas');

  const alertasNoLeidas = useMemo(() => alertas.filter(a => !a.leida), [alertas]);
  const alertasLeidas   = useMemo(() => alertas.filter(a => a.leida), [alertas]);

  const alertasEnriquecidas = useMemo(() => {
    const orden = { CRÍTICA: 0, ALTA: 1, NORMAL: 2 } as const;
    return [...alertas]
      .map(a => ({ ...a, prioridad: calcPrioridad(a.porcentajeCambio, a.tipo) }))
      .sort((a, b) => {
        if (a.leida !== b.leida) return a.leida ? 1 : -1;
        return orden[a.prioridad] - orden[b.prioridad];
      });
  }, [alertas]);

  const alertasFiltradas = useMemo(() => {
    const base = tabActiva === 'pendientes'
      ? alertasEnriquecidas.filter(a => !a.leida)
      : alertasEnriquecidas.filter(a => a.leida);
    return base
      .filter(a => filtroTipo === 'todas' || a.tipo === filtroTipo)
      .filter(a => filtroPrioridad === 'todas' || a.prioridad === filtroPrioridad);
  }, [alertasEnriquecidas, tabActiva, filtroTipo, filtroPrioridad]);

  const stats = useMemo(() => {
    const noLeidas = alertas.filter(a => !a.leida);
    const subidas  = noLeidas.filter(a => a.tipo === 'subida');
    const bajadas  = noLeidas.filter(a => a.tipo === 'bajada');
    return {
      total:           noLeidas.length,
      criticas:        noLeidas.filter(a => calcPrioridad(a.porcentajeCambio, a.tipo) === 'CRÍTICA').length,
      altas:           noLeidas.filter(a => calcPrioridad(a.porcentajeCambio, a.tipo) === 'ALTA').length,
      impactoNegativo: subidas.reduce((s, a) => s + Math.abs(a.diferencia), 0),
      impactoPositivo: bajadas.reduce((s, a) => s + Math.abs(a.diferencia), 0),
    };
  }, [alertas]);

  const switchTab = (tab: TabActiva) => {
    setTabActiva(tab);
    setFiltroTipo('todas');
    setFiltroPrioridad('todas');
  };

  const handleMarcarTodas = () => {
    onMarcarTodasLeidas();
    toast.success('Todas las alertas marcadas como leídas');
  };

  const handleClearAll = () => {
    if (confirm('¿Eliminar todas las alertas del historial?')) {
      onClearAll();
      toast.success('Alertas eliminadas');
    }
  };

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Alertas
            </h2>
            {stats.total > 0 && (
              <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full bg-rose-500 text-white text-sm font-black shadow-lg">
                {stats.total}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vigilancia de precios · Prioridad automática por impacto
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {alertasNoLeidas.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleMarcarTodas}
              className="h-9 glass-card hover:bg-primary/10 border-primary/20 text-xs font-bold">
              <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />
              <span className="hidden sm:inline">Marcar leídas</span>
              <span className="sm:hidden">Leídas</span>
            </Button>
          )}
          {alertas.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleClearAll}
              className="h-9 w-9 p-0 glass-card hover:bg-destructive/10 border-destructive/20 text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── KPIs (solo si hay pendientes) ────────────────── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Pendientes */}
          <div className="glass-layer-2 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Pendientes</p>
              <p className="text-2xl font-black text-indigo-500 leading-none mt-0.5">{stats.total}</p>
            </div>
          </div>

          {/* Críticas */}
          <div className="glass-layer-2 rounded-2xl p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              stats.criticas > 0 ? 'bg-rose-500/10' : 'bg-amber-500/10')}>
              <ShieldAlert className={cn('w-5 h-5', stats.criticas > 0 ? 'text-rose-500' : 'text-amber-500')} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Críticas</p>
              <p className={cn('text-2xl font-black leading-none mt-0.5',
                stats.criticas > 0 ? 'text-rose-500' : 'text-amber-500')}>
                {stats.criticas}
              </p>
            </div>
          </div>

          {/* Subidas (impacto) */}
          <div className="glass-layer-2 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-rose-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Subidas</p>
              <p className="text-sm font-black text-rose-500 leading-none mt-0.5 truncate">
                {formatCurrency(stats.impactoNegativo)}
              </p>
              <p className="text-[9px] text-muted-foreground">impacto total</p>
            </div>
          </div>

          {/* Bajadas (oportunidad) */}
          <div className="glass-layer-2 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Bajadas</p>
              <p className="text-sm font-black text-emerald-500 leading-none mt-0.5 truncate">
                {formatCurrency(stats.impactoPositivo)}
              </p>
              <p className="text-[9px] text-muted-foreground">oportunidad</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs + Filtros chip ───────────────────────────── */}
      <div className="space-y-3">
        {/* Tab selector */}
        <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
          <button
            onClick={() => switchTab('pendientes')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
              tabActiva === 'pendientes'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bell className="w-4 h-4" />
            Pendientes
            {alertasNoLeidas.length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                {alertasNoLeidas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => switchTab('historial')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
              tabActiva === 'historial'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCheck className="w-4 h-4" />
            Historial
            {alertasLeidas.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {alertasLeidas.length}
              </span>
            )}
          </button>
        </div>

        {/* Chips de filtro: Tipo */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            {(['todas', 'subida', 'bajada'] as const).map(t => (
              <button key={t}
                onClick={() => setFiltroTipo(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                  filtroTipo === t
                    ? t === 'subida' ? 'bg-rose-500 text-white shadow-sm'
                      : t === 'bajada' ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                {t === 'todas' ? 'Todos' : t === 'subida' ? '↑ Subidas' : '↓ Bajadas'}
              </button>
            ))}
          </div>

          {/* Chips de filtro: Prioridad */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            {(['todas', 'CRÍTICA', 'ALTA', 'NORMAL'] as const).map(p => (
              <button key={p}
                onClick={() => setFiltroPrioridad(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                  filtroPrioridad === p
                    ? p === 'CRÍTICA' ? 'bg-rose-500 text-white shadow-sm'
                      : p === 'ALTA' ? 'bg-amber-500 text-white shadow-sm'
                      : p === 'NORMAL' ? 'bg-slate-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                {p === 'todas' ? 'Todas' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lista de alertas ─────────────────────────────── */}
      <div className="space-y-3">
        {alertasFiltradas.length > 0 ? alertasFiltradas.map((alerta, index) => {
          const producto  = getProductoById(alerta.productoId);
          const proveedor = getProveedorById(alerta.proveedorId);
          const isSubida  = alerta.tipo === 'subida';
          const pConfig   = PRIORIDAD_CONFIG[alerta.prioridad];
          const PriorityIcon = pConfig.icon;

          const precioVenta    = producto?.precioVenta || 0;
          const margenAnterior = precioVenta > 0 && alerta.precioAnterior > 0
            ? ((precioVenta - alerta.precioAnterior) / precioVenta) * 100 : null;
          const margenNuevo    = precioVenta > 0 && alerta.precioNuevo > 0
            ? ((precioVenta - alerta.precioNuevo) / precioVenta) * 100 : null;
          const deltaMargen    = margenAnterior !== null && margenNuevo !== null
            ? margenNuevo - margenAnterior : null;

          return (
            <div key={alerta.id}
              className={cn(
                'glass-layer-2 rounded-2xl border-l-4 overflow-hidden transition-ag',
                `stagger-${(index % 6) + 1}`,
                !alerta.leida ? pConfig.borderLeft : 'border-l-slate-300 dark:border-l-slate-700',
                alerta.leida && 'opacity-60'
              )}>

              {/* ── Barra superior: prioridad · tipo · tiempo ── */}
              <div className={cn(
                'px-4 py-2 flex items-center justify-between gap-2',
                !alerta.leida ? pConfig.topBar : 'bg-muted/20'
              )}>
                <div className="flex items-center gap-2 flex-wrap">
                  {!alerta.leida ? (
                    <Badge className={cn('text-[9px] font-black uppercase tracking-wider h-5 px-2', pConfig.badge)}>
                      <PriorityIcon className="w-2.5 h-2.5 mr-1" />
                      {alerta.prioridad}
                    </Badge>
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                      <Check className="w-3 h-3" /> Revisada
                    </span>
                  )}
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    isSubida
                      ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  )}>
                    {isSubida ? '↑ Subida de precio' : '↓ Bajada de precio'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(alerta.fecha)}
                  </span>
                  <button
                    onClick={() => onDeleteAlerta(alerta.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-ag">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* ── Cuerpo ────────────────────────────────────── */}
              <div className="p-4 space-y-4">

                {/* Producto + proveedor + % cambio destacado */}
                <div className="flex items-start gap-3">
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5', pConfig.bg)}>
                    <Package className={cn('w-5 h-5', pConfig.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-base text-foreground truncate leading-tight">
                      {producto?.nombre || 'Producto Desconocido'}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Store className="w-3.5 h-3.5 shrink-0" />
                      {proveedor?.nombre || 'Proveedor Desconocido'}
                    </p>
                    {producto?.categoria && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-block mt-1">
                        {producto.categoria}
                      </span>
                    )}
                  </div>
                  {/* Porcentaje: dato más importante, bien visible */}
                  <div className={cn(
                    'shrink-0 text-center px-3 py-2 rounded-xl',
                    isSubida ? 'bg-rose-500/10' : 'bg-emerald-500/10'
                  )}>
                    <p className={cn('text-2xl font-black leading-none', isSubida ? 'text-rose-500' : 'text-emerald-500')}>
                      {isSubida ? '+' : '-'}{alerta.porcentajeCambio.toFixed(1)}%
                    </p>
                    <p className={cn('text-[10px] font-bold mt-0.5', isSubida ? 'text-rose-400' : 'text-emerald-400')}>
                      {isSubida ? 'más caro' : 'más barato'}
                    </p>
                  </div>
                </div>

                {/* Comparador Antes → Ahora */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Antes</p>
                    <p className="font-mono font-black text-sm text-foreground">{formatCurrency(alerta.precioAnterior)}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center',
                      isSubida ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
                    )}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className={cn(
                    'rounded-xl p-3 text-center border',
                    isSubida ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
                  )}>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Ahora</p>
                    <p className={cn('font-mono font-black text-sm', isSubida ? 'text-rose-500' : 'text-emerald-500')}>
                      {formatCurrency(alerta.precioNuevo)}
                    </p>
                  </div>
                </div>

                {/* Diferencia + Impacto en margen */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Diferencia</p>
                    <p className={cn('font-mono font-bold text-sm', isSubida ? 'text-rose-500' : 'text-emerald-500')}>
                      {isSubida ? '+' : '-'}{formatCurrency(Math.abs(alerta.diferencia))}
                    </p>
                  </div>
                  <div className={cn(
                    'rounded-xl p-3 border',
                    deltaMargen === null        ? 'bg-muted/30 border-transparent' :
                    deltaMargen < -3            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50' :
                    deltaMargen < 0             ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50' :
                    'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50'
                  )}>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> Impacto margen
                    </p>
                    {deltaMargen !== null ? (
                      <p className={cn('font-bold text-sm',
                        deltaMargen < -3 ? 'text-rose-500' :
                        deltaMargen < 0  ? 'text-amber-500' : 'text-emerald-500'
                      )}>
                        {margenAnterior!.toFixed(0)}% → {margenNuevo!.toFixed(0)}%
                        <span className="text-xs ml-1 opacity-75">
                          ({deltaMargen >= 0 ? '+' : ''}{deltaMargen.toFixed(1)}pp)
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin precio de venta</p>
                    )}
                  </div>
                </div>

                {/* Sugerencia de acción */}
                {!alerta.leida && alerta.prioridad === 'CRÍTICA' && isSubida && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Subida mayor al 20% — Revisa tu precio de venta o busca proveedor alternativo urgente
                    </p>
                  </div>
                )}
                {!alerta.leida && !isSubida && alerta.prioridad !== 'NORMAL' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60">
                    <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Precio bajó — Buena oportunidad para comprar mas stock a mejor precio
                    </p>
                  </div>
                )}

                {/* Botón principal: marcar como leída */}
                {!alerta.leida && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onMarcarLeida(alerta.id);
                      toast.success('Alerta marcada como leída');
                    }}
                    className="w-full h-10 rounded-xl bg-primary/8 hover:bg-primary/15 text-primary font-bold text-sm transition-ag">
                    <Check className="w-4 h-4 mr-2" />
                    Entendido, marcar como leída
                  </Button>
                )}
              </div>
            </div>
          );
        }) : (
          /* Estado vacío */
          <div className="flex flex-col items-center justify-center py-20 text-center glass-layer-1 border-dashed rounded-2xl">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 animate-ag-float">
              {tabActiva === 'pendientes'
                ? <Bell className="w-8 h-8 text-muted-foreground/30" />
                : <CheckCheck className="w-8 h-8 text-muted-foreground/30" />
              }
            </div>
            <h3 className="text-lg font-bold">
              {tabActiva === 'pendientes' ? 'Todo bajo control' : 'Sin historial aún'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              {tabActiva === 'pendientes'
                ? 'No hay alertas pendientes. Te avisaremos cuando detectemos cambios de precio.'
                : 'Aquí aparecerán las alertas que ya revisaste.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
