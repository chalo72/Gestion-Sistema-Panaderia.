import React, { useMemo, useState } from 'react';
import { TrendingDown, User, ShoppingBag, Building2, AlertTriangle, DollarSign, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InspeccionCalidad, ResponsableRechazo } from '@/types';

const MOTIVO_LABEL: Record<string, string> = {
  quemado: '🔥 Quemados', amogañado: '🍄 Con moho',
  deforme: '💔 Deformes', crudo: '❄️ Crudos', otro: '📦 Otros',
};
const RESP_CONFIG = {
  panadero:  { label: 'Panadero/Obrero', icon: User,        color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', badge: 'border-amber-300 text-amber-700 bg-amber-50' },
  vendedora: { label: 'Vendedora',       icon: ShoppingBag, color: 'text-rose-700',  bg: 'bg-rose-50 border-rose-200',   badge: 'border-rose-300 text-rose-700 bg-rose-50' },
  panaderia: { label: 'Panadería',       icon: Building2,   color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', badge: 'border-slate-300 text-slate-600 bg-slate-50' },
};

type Periodo = '7d' | '30d' | 'todo';

interface Props {
  inspecciones: InspeccionCalidad[];
  formatCurrency: (v: number) => string;
}

export function MermasDashboard({ inspecciones, formatCurrency }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('30d');

  const inspeccionesFiltradas = useMemo(() => {
    const ahora = Date.now();
    const limites: Record<Periodo, number> = {
      '7d':  ahora - 7  * 24 * 3600 * 1000,
      '30d': ahora - 30 * 24 * 3600 * 1000,
      'todo': 0,
    };
    return inspecciones.filter(i => new Date(i.fechaInspeccion).getTime() >= limites[periodo]);
  }, [inspecciones, periodo]);

  // Agrupar rechazos por responsable
  const porResponsable = useMemo(() => {
    const map: Record<ResponsableRechazo, { cantidad: number; valor: number; trabajadores: Record<string, { cantidad: number; valor: number }> }> = {
      panadero:  { cantidad: 0, valor: 0, trabajadores: {} },
      vendedora: { cantidad: 0, valor: 0, trabajadores: {} },
      panaderia: { cantidad: 0, valor: 0, trabajadores: {} },
    };
    inspeccionesFiltradas.forEach(insp => {
      insp.rechazos.forEach(r => {
        const grp = map[r.responsable];
        grp.cantidad += r.cantidad;
        grp.valor += r.cantidad * insp.precioUnitario;
        const nombre = r.nombreResponsable?.trim() || 'Sin nombre';
        if (r.responsable !== 'panaderia') {
          grp.trabajadores[nombre] = grp.trabajadores[nombre] ?? { cantidad: 0, valor: 0 };
          grp.trabajadores[nombre].cantidad += r.cantidad;
          grp.trabajadores[nombre].valor += r.cantidad * insp.precioUnitario;
        }
      });
    });
    return map;
  }, [inspeccionesFiltradas]);

  // Agrupar por motivo
  const porMotivo = useMemo(() => {
    const map: Record<string, number> = {};
    inspeccionesFiltradas.forEach(insp => {
      insp.rechazos.forEach(r => {
        map[r.motivo] = (map[r.motivo] ?? 0) + r.cantidad;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [inspeccionesFiltradas]);

  const totalRechazados = Object.values(porResponsable).reduce((s, p) => s + p.cantidad, 0);
  const totalValor = Object.values(porResponsable).reduce((s, p) => s + p.valor, 0);
  const totalTrabajadores = (porResponsable.panadero.valor + porResponsable.vendedora.valor);
  const totalPanaderia = porResponsable.panaderia.valor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registro de Mermas</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Pérdidas por responsable · Valor monetario · Historial</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([['7d', '7 días'], ['30d', '30 días'], ['todo', 'Todo']] as [Periodo, string][]).map(([id, label]) => (
            <Button key={id} size="sm" variant={periodo === id ? 'default' : 'outline'}
              onClick={() => setPeriodo(id)}
              className={cn("h-8 rounded-xl text-xs font-black", periodo === id ? "bg-slate-900 text-white" : "")}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {totalRechazados === 0 ? (
        <Card className="border-dashed border-2 rounded-2xl">
          <CardContent className="py-16 text-center">
            <TrendingDown className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Sin mermas registradas</p>
            <p className="text-xs text-slate-400 mt-1">Haz el Control de Calidad al completar una orden de producción</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="rounded-2xl border-none shadow-md bg-rose-600 text-white">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black">{totalRechazados}</p>
                <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest mt-1">Piezas Perdidas</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-md bg-slate-900 text-white">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-rose-400">{formatCurrency(totalValor)}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Valor Total Perdido</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-md bg-amber-50 border border-amber-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-amber-700">{formatCurrency(totalTrabajadores)}</p>
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1">Cargo a Trabajadores</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-md bg-slate-50 border border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-slate-700">{formatCurrency(totalPanaderia)}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Absorbe Panadería</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por responsable */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsabilidad</h3>
              {(['panadero', 'vendedora', 'panaderia'] as ResponsableRechazo[]).map(resp => {
                const cfg = RESP_CONFIG[resp];
                const data = porResponsable[resp];
                if (data.cantidad === 0) return null;
                const Icon = cfg.icon;
                return (
                  <Card key={resp} className={cn("rounded-2xl border shadow-sm", cfg.bg)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", cfg.bg)}>
                            <Icon className={cn("w-4 h-4", cfg.color)} />
                          </div>
                          <div>
                            <p className={cn("font-black text-sm", cfg.color)}>{cfg.label}</p>
                            <p className="text-[10px] text-slate-500">{data.cantidad} piezas perdidas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-black text-lg", cfg.color)}>{formatCurrency(data.valor)}</p>
                          {resp !== 'panaderia' && (
                            <Badge variant="outline" className={cn("text-[8px] font-black", cfg.badge)}>
                              A descontar
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Desglose por nombre */}
                      {Object.entries(data.trabajadores).length > 0 && (
                        <div className="space-y-1.5 border-t border-current/10 pt-2.5">
                          {Object.entries(data.trabajadores)
                            .sort((a, b) => b[1].valor - a[1].valor)
                            .map(([nombre, d]) => (
                              <div key={nombre} className="flex justify-between items-center text-xs">
                                <span className={cn("font-bold", cfg.color)}>{nombre}</span>
                                <span className={cn("font-black", cfg.color)}>
                                  {d.cantidad} pzas · {formatCurrency(d.valor)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-3">
              {/* Por motivo */}
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Por tipo de defecto</h3>
              <Card className="rounded-2xl border-none shadow-md">
                <CardContent className="p-4 space-y-3">
                  {porMotivo.map(([motivo, cantidad]) => {
                    const pct = totalRechazados > 0 ? Math.round((cantidad / totalRechazados) * 100) : 0;
                    return (
                      <div key={motivo}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-700">{MOTIVO_LABEL[motivo] ?? motivo}</span>
                          <span className="text-xs font-black text-slate-500">{cantidad} pzas ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Historial */}
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Historial de inspecciones</h3>
              <Card className="rounded-2xl border-none shadow-md">
                <CardContent className="p-0 divide-y divide-slate-100">
                  {inspeccionesFiltradas.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Sin datos en este período</p>
                  ) : (
                    inspeccionesFiltradas.slice(0, 10).map(insp => {
                      const totalPerdido = insp.rechazos.reduce((s, r) => s + r.cantidad, 0);
                      return (
                        <div key={insp.id} className="px-4 py-3 flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            insp.porcentajeRechazo >= 20 ? "bg-rose-500" :
                            insp.porcentajeRechazo >= 10 ? "bg-amber-500" : "bg-emerald-500"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{insp.modeloNombre}</p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(insp.fechaInspeccion).toLocaleDateString('es-CO')} ·
                              {insp.cantidadAprobada} aprobadas · {totalPerdido} rechazadas
                            </p>
                          </div>
                          {totalPerdido > 0 && (
                            <span className="text-xs font-black text-rose-600 shrink-0">
                              -{formatCurrency(insp.valorPerdidaTotal)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
