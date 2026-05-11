import { useState, useMemo } from 'react';
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
  CheckCheck,
  Zap,
  ShieldAlert,
  Info,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Calcula la prioridad según porcentaje de cambio
function calcPrioridad(pct: number, tipo: 'subida' | 'bajada'): 'CRÍTICA' | 'ALTA' | 'NORMAL' {
  if (tipo === 'subida') {
    if (pct >= 20) return 'CRÍTICA';
    if (pct >= 8) return 'ALTA';
  }
  return 'NORMAL';
}

const PRIORIDAD_CONFIG = {
  'CRÍTICA': { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-l-rose-500', badge: 'bg-rose-500/20 text-rose-500', icon: ShieldAlert },
  'ALTA':    { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-l-amber-500', badge: 'bg-amber-500/20 text-amber-600', icon: AlertTriangle },
  'NORMAL':  { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-l-slate-400', badge: 'bg-slate-500/10 text-slate-500', icon: Info },
};

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
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todas');

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const alertasLeidas = alertas.filter(a => a.leida);

  // Enriquecer alertas con prioridad, ordenar por: no leídas primero + prioridad
  const alertasEnriquecidas = useMemo(() => {
    const ordenPrioridad = { 'CRÍTICA': 0, 'ALTA': 1, 'NORMAL': 2 };
    return [...alertas]
      .map(a => ({
        ...a,
        prioridad: calcPrioridad(a.porcentajeCambio, a.tipo),
      }))
      .sort((a, b) => {
        if (a.leida !== b.leida) return a.leida ? 1 : -1;
        return ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad];
      });
  }, [alertas]);

  // KPIs de impacto financiero global
  const impactoStats = useMemo(() => {
    const subidas = alertas.filter(a => a.tipo === 'subida' && !a.leida);
    const bajadas = alertas.filter(a => a.tipo === 'bajada' && !a.leida);
    const impactoNegativo = subidas.reduce((s, a) => s + Math.abs(a.diferencia), 0);
    const impactoPositivo = bajadas.reduce((s, a) => s + Math.abs(a.diferencia), 0);
    const criticas = alertas.filter(a => calcPrioridad(a.porcentajeCambio, a.tipo) === 'CRÍTICA' && !a.leida).length;
    const altas = alertas.filter(a => calcPrioridad(a.porcentajeCambio, a.tipo) === 'ALTA' && !a.leida).length;
    return { impactoNegativo, impactoPositivo, criticas, altas };
  }, [alertas]);

  const alertasFiltradas = useMemo(() => {
    let base = filtroTipo === 'todas'
      ? (alertasNoLeidas.length > 0 ? alertasEnriquecidas.filter(a => !a.leida) : alertasEnriquecidas.filter(a => a.leida))
      : alertasEnriquecidas.filter(a => a.tipo === filtroTipo);
      
    if (filtroPrioridad !== 'todas') {
      base = base.filter(a => a.prioridad === filtroPrioridad);
    }
    return base;
  }, [alertasEnriquecidas, alertasNoLeidas.length, filtroTipo, filtroPrioridad]);

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Alertas de Inteligencia
          </h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary animate-pulse" />
            Vigilancia en tiempo real · Prioridad automática por impacto
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {alertasNoLeidas.length > 0 && (
            <Button variant="outline" onClick={handleMarcarTodas} className="glass-card hover:bg-primary/10 border-primary/20 transition-ag shadow-sm">
              <CheckCheck className="w-4 h-4 mr-2 text-primary" />
              <span className="hidden sm:inline">Marcar todas leídas</span>
              <span className="sm:hidden">Todo leído</span>
            </Button>
          )}
          {alertas.length > 0 && (
            <Button variant="outline" onClick={handleClearAll} className="glass-card hover:bg-destructive/10 border-destructive/20 text-destructive transition-ag">
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Panel de impacto financiero global */}
      {alertasNoLeidas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'Alertas pendientes',
              value: alertasNoLeidas.length,
              icon: Bell,
              color: 'text-indigo-500', bg: 'bg-indigo-500/10'
            },
            {
              label: 'Impacto negativo',
              value: formatCurrency(impactoStats.impactoNegativo),
              icon: TrendingUp,
              color: 'text-rose-500', bg: 'bg-rose-500/10',
              sub: 'Subidas de precio'
            },
            {
              label: 'Oportunidad',
              value: formatCurrency(impactoStats.impactoPositivo),
              icon: TrendingDown,
              color: 'text-emerald-500', bg: 'bg-emerald-500/10',
              sub: 'Bajadas detectadas'
            },
            {
              label: 'Críticas / Altas',
              value: `${impactoStats.criticas} / ${impactoStats.altas}`,
              icon: ShieldAlert,
              color: impactoStats.criticas > 0 ? 'text-rose-500' : 'text-amber-500',
              bg: impactoStats.criticas > 0 ? 'bg-rose-500/10' : 'bg-amber-500/10',
              sub: impactoStats.criticas > 0 ? 'Requieren atención inmediata' : 'Bajo control'
            },
          ].map((kpi, i) => (
            <div key={i} className="glass-layer-2 rounded-2xl p-4 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', kpi.bg, kpi.color)}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">{kpi.label}</p>
                <p className={cn('text-lg font-black leading-tight', kpi.color)}>{kpi.value}</p>
                {kpi.sub && <p className="text-[9px] text-muted-foreground truncate">{kpi.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6 bg-white/40 dark:bg-black/20 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-sm flex-wrap">
        <div className="flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar:</span>
        </div>
        <Tabs defaultValue="pendientes" className="flex-1">
          <TabsList className="bg-transparent h-9 p-0 gap-1">
            <TabsTrigger value="pendientes" className="rounded-xl px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-ag">
              Pendientes ({alertasNoLeidas.length})
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground transition-ag">
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
        <div className="h-4 w-px bg-border/50 mx-2" />
        <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
          <SelectTrigger className="w-32 border-none bg-transparent focus:ring-0 shadow-none h-8 font-medium">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent className="glass-layer-2 border-white/20">
            <SelectItem value="todas" className="rounded-lg">Todas</SelectItem>
            <SelectItem value="CRÍTICA" className="rounded-lg text-rose-500">Crítica</SelectItem>
            <SelectItem value="ALTA" className="rounded-lg text-amber-500">Alta</SelectItem>
            <SelectItem value="NORMAL" className="rounded-lg text-slate-500">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de alertas */}
      <div className="animate-ag-fade-in">
        {alertasFiltradas.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {alertasFiltradas.map((alerta, index) => {
              const producto = getProductoById(alerta.productoId);
              const proveedor = getProveedorById(alerta.proveedorId);
              const isSubida = alerta.tipo === 'subida';
              const prioridad = alerta.prioridad;
              const pConfig = PRIORIDAD_CONFIG[prioridad];
              const PriorityIcon = pConfig.icon;

              // Impacto en margen: si tenemos precio de venta, calculamos
              const precioVenta = producto?.precioVenta || 0;
              const margenAnterior = precioVenta > 0 && alerta.precioAnterior > 0
                ? ((precioVenta - alerta.precioAnterior) / precioVenta) * 100
                : null;
              const margenNuevo = precioVenta > 0 && alerta.precioNuevo > 0
                ? ((precioVenta - alerta.precioNuevo) / precioVenta) * 100
                : null;
              const deltaMargen = margenAnterior !== null && margenNuevo !== null
                ? margenNuevo - margenAnterior
                : null;

              return (
                <div
                  key={alerta.id}
                  className={cn(
                    'glass-layer-2 p-5 border-l-4 transition-ag group',
                    `stagger-${(index % 6) + 1}`,
                    !alerta.leida ? pConfig.border : 'border-l-muted',
                    !alerta.leida ? '' : 'opacity-70'
                  )}
                >
                  <div className="flex flex-col md:flex-row gap-5">
                    {/* Ícono y estado */}
                    <div className="flex items-center md:flex-col md:justify-start md:items-center gap-3 shrink-0">
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110', pConfig.bg, pConfig.color)}>
                        {isSubida ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        {!alerta.leida && (
                          <Badge className={cn('px-2 py-0 h-5 text-[9px] uppercase font-black tracking-wider', pConfig.badge)}>
                            {prioridad}
                          </Badge>
                        )}
                        {!alerta.leida && prioridad !== 'NORMAL' && (
                          <div className={cn('flex items-center gap-1', pConfig.color)}>
                            <PriorityIcon className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Información principal */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-lg text-foreground flex items-center gap-2 flex-wrap">
                            <span className="truncate">{producto?.nombre || 'Producto Desconocido'}</span>
                            {producto?.categoria && (
                              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                                {producto.categoria}
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Store className="w-3.5 h-3.5 shrink-0" />
                            {proveedor?.nombre || 'Proveedor Desconocido'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-primary" />
                            Variación precio
                          </p>
                          <p className={cn('text-xl font-black', isSubida ? 'text-destructive' : 'text-emerald-500')}>
                            {isSubida ? '+' : '-'}{formatCurrency(Math.abs(alerta.diferencia))}
                            <span className="text-sm ml-1 opacity-70">({alerta.porcentajeCambio.toFixed(1)}%)</span>
                          </p>
                        </div>
                      </div>

                      {/* Grilla de datos */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/40">
                          <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Precio Anterior</p>
                          <p className="text-sm font-mono font-bold">{formatCurrency(alerta.precioAnterior)}</p>
                        </div>
                        <div className={cn('p-3 rounded-xl border', isSubida ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-50/50 border-emerald-200/50')}>
                          <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Precio Nuevo</p>
                          <p className={cn('text-sm font-mono font-bold', isSubida ? 'text-destructive' : 'text-emerald-600')}>
                            {formatCurrency(alerta.precioNuevo)}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                          <p className="text-[9px] uppercase text-primary font-bold mb-1">P. Venta Actual</p>
                          <p className="text-sm font-semibold text-foreground">
                            {precioVenta > 0 ? formatCurrency(precioVenta) : '—'}
                          </p>
                        </div>
                        {/* Impacto en margen */}
                        <div className={cn('p-3 rounded-xl border relative overflow-hidden',
                          deltaMargen !== null && deltaMargen < -3 ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50' :
                          deltaMargen !== null && deltaMargen > 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50' :
                          'bg-white/40 dark:bg-white/5 border-white/40'
                        )}>
                          <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> Impacto Margen
                          </p>
                          {deltaMargen !== null ? (
                            <p className={cn('text-sm font-black',
                              deltaMargen < -3 ? 'text-rose-500' :
                              deltaMargen < 0 ? 'text-amber-500' :
                              'text-emerald-500'
                            )}>
                              {deltaMargen >= 0 ? '+' : ''}{deltaMargen.toFixed(1)}pp
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sin P.V.</p>
                          )}
                          {deltaMargen !== null && deltaMargen < -3 && isSubida && (
                            <AlertTriangle className="absolute top-1 right-1 w-3 h-3 text-rose-400 opacity-60" />
                          )}
                        </div>
                      </div>

                      {/* Acción sugerida para alertas críticas */}
                      {!alerta.leida && prioridad === 'CRÍTICA' && isSubida && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50">
                          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            Subida ≥20% — Revisar precio de venta o buscar proveedor alternativo urgente
                          </p>
                          <ArrowRight className="w-4 h-4 text-rose-400 shrink-0 ml-auto" />
                        </div>
                      )}
                      {!alerta.leida && !isSubida && prioridad !== 'NORMAL' && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50">
                          <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Bajada detectada — Oportunidad para comprar más stock a mejor precio
                          </p>
                        </div>
                      )}

                      {/* Footer: fecha + acciones */}
                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {new Date(alerta.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-2">
                          {!alerta.leida && (
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-ag" onClick={() => onMarcarLeida(alerta.id)}>
                              <Check className="w-4 h-4 mr-1.5" />
                              Entendido
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-ag" onClick={() => onDeleteAlerta(alerta.id)}>
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
              No hay alertas pendientes. Te avisaremos cuando detectemos cambios de precios.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
