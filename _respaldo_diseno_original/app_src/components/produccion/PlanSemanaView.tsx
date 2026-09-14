import React, { useMemo, useEffect, useState } from 'react';
import {
  CalendarDays, Plus, Trash2, ChefHat, AlertTriangle,
  CheckCircle2, SkipForward, RotateCcw, Settings, Clock,
  Sparkles, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCan } from '@/contexts/AuthContext';
import { usePlanSemana } from '@/hooks/usePlanSemana';
import {
  useProgramacionSemanal,
  diaJsToIdx,
} from '@/hooks/useProgramacionSemanal';
import type {
  FormulacionBase, ModeloPan, Configuracion, OrdenProduccion, PlanSemanaItem,
  CategoriaProduccion, AsignacionCategoria,
} from '@/types';
import { resolverKgPorArrobaMasa } from '@/lib/arroba-masa';

// ─── Config de categorías ────────────────────────────────
export const CATEGORIAS_CONFIG: Record<CategoriaProduccion, { label: string; emoji: string; color: string; bg: string; badge: string }> = {
  pan_sal:        { label: 'Pan Sal',          emoji: '🍞', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   badge: 'border-amber-300 text-amber-700 bg-amber-50' },
  pan_dulce:      { label: 'Pan Dulce',         emoji: '🍬', color: 'text-pink-700',    bg: 'bg-pink-50 border-pink-200',     badge: 'border-pink-300 text-pink-700 bg-pink-50' },
  empacado_sal:   { label: 'Empacado Sal',      emoji: '📦', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     badge: 'border-blue-300 text-blue-700 bg-blue-50' },
  empacado_dulce: { label: 'Empacado Dulce',    emoji: '📦', color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', badge: 'border-violet-300 text-violet-700 bg-violet-50' },
  hojaldrado:     { label: 'Hojaldrado',        emoji: '🥐', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', badge: 'border-orange-300 text-orange-700 bg-orange-50' },
  torta:          { label: 'Torta',             emoji: '🎂', color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',     badge: 'border-rose-300 text-rose-700 bg-rose-50' },
  galleta:        { label: 'Galleta',           emoji: '🍪', color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', badge: 'border-yellow-300 text-yellow-700 bg-yellow-50' },
  otro:           { label: 'Otro',              emoji: '📌', color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',   badge: 'border-slate-300 text-slate-600 bg-slate-50' },
};

const TODAS_CATEGORIAS = Object.keys(CATEGORIAS_CONFIG) as CategoriaProduccion[];
const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const NOMBRES_DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLORES_DIA = [
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
  'bg-violet-50 border-violet-200 text-violet-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-orange-50 border-orange-200 text-orange-700',
];

interface PlanSemanaViewProps {
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  configuracion: Configuracion;
  produccion: OrdenProduccion[];
  onLanzarPlanHoy?: (items: PlanSemanaItem[]) => void;
}

function calcularResumenItem(
  item: PlanSemanaItem,
  formulaciones: FormulacionBase[],
  modelos: ModeloPan[],
  configuracion: Configuracion
) {
  const formulacion = formulaciones.find(f => f.id === item.formulacionId);
  const modelo = modelos.find(m => m.id === item.modeloId);
  if (!formulacion || !modelo) return null;
  const kgRealMasa = resolverKgPorArrobaMasa(formulacion);
  const CAPACIDAD_HORNO = configuracion.latasPorHorno || 4;
  const masaUtil = kgRealMasa * 1000 * (1 - (modelo.mermaEstimada || 0) / 100);
  const panesPorArroba = Math.floor(masaUtil / modelo.pesoUnitarioGr);
  const panes = panesPorArroba * item.arrobas;
  const piezasPorLata = modelo.piezasPorLata || 12;
  const latas = Math.ceil(panes / piezasPorLata);
  const horneadas = Math.ceil(latas / CAPACIDAD_HORNO);
  return { formulacionNombre: formulacion.nombre, modeloNombre: modelo.nombre, panes, latas, horneadas };
}

// ─────────────────────────────────────────────────────────
// Banner de Recuperación Inteligente
// ─────────────────────────────────────────────────────────
function BannerRecuperacion({
  modelos,
  diasPerdidosPendientes,
  resolverDiaPerdido,
  sugerirRecuperacion,
  totalArrobasHoy,
  capacidadHoy,
}: {
  modelos: ModeloPan[];
  diasPerdidosPendientes: ReturnType<typeof useProgramacionSemanal>['diasPerdidosPendientes'];
  resolverDiaPerdido: ReturnType<typeof useProgramacionSemanal>['resolverDiaPerdido'];
  sugerirRecuperacion: ReturnType<typeof useProgramacionSemanal>['sugerirRecuperacion'];
  totalArrobasHoy: number;
  capacidadHoy: number;
}) {
  if (diasPerdidosPendientes.length === 0) return null;

  return (
    <div className="space-y-3">
      {diasPerdidosPendientes.map(dia => {
        const fechaDia = new Date(dia.fecha + 'T12:00:00');
        const hoy = new Date();
        const diasTranscurridos = Math.floor((hoy.getTime() - fechaDia.getTime()) / (1000 * 60 * 60 * 24));
        const capacidadLibre = Math.max(0, capacidadHoy - totalArrobasHoy);
        const sugerencia = sugerirRecuperacion(dia.categoriasPerdidas, modelos, diasTranscurridos);

        return (
          <Card key={dia.id} className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-2xl shadow-md">
            <CardContent className="p-5 space-y-4">
              {/* Cabecera */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-amber-800 text-sm uppercase tracking-wide">
                    Sin producción el {NOMBRES_DIAS[dia.diaSemana]} · {new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {dia.categoriasPerdidas.length} categoría{dia.categoriasPerdidas.length !== 1 ? 's' : ''} sin producir ·{' '}
                    {diasTranscurridos === 0 ? 'Fue ayer' : `Hace ${diasTranscurridos} día${diasTranscurridos !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Sugerencia IA */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-amber-200 space-y-2">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Sugerencia IA
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{sugerencia.motivo}</p>
                {capacidadLibre > 0 && sugerencia.recuperar.length > 0 && (
                  <p className="text-xs text-emerald-700 font-bold">
                    ✅ Tienes {capacidadLibre.toFixed(2)} arrobas libres hoy para recuperar.
                  </p>
                )}
                {sugerencia.recuperar.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[10px] font-black text-emerald-700 uppercase">Recuperar:</span>
                    {sugerencia.recuperar.map(a => {
                      const cfg = CATEGORIAS_CONFIG[a.categoria];
                      return (
                        <Badge key={a.categoria} variant="outline" className={cn("text-[9px] font-black", cfg.badge)}>
                          {cfg.emoji} {cfg.label} · {a.arrobas} arr
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {sugerencia.cancelar.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-black text-rose-600 uppercase">Cancelar:</span>
                    {sugerencia.cancelar.map(a => {
                      const cfg = CATEGORIAS_CONFIG[a.categoria];
                      return (
                        <Badge key={a.categoria} variant="outline" className="text-[9px] font-black border-rose-200 text-rose-600 bg-rose-50">
                          {cfg.emoji} {cfg.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => { resolverDiaPerdido(dia.id, 'recuperar_hoy'); toast.success('Plan marcado para recuperar hoy'); }}
                  className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Recuperar hoy
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => { resolverDiaPerdido(dia.id, 'postergar'); toast.success('Producción postergada para el próximo turno'); }}
                  className="gap-1.5 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 font-black text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Posponer
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { resolverDiaPerdido(dia.id, 'cancelar'); toast.info('Producción cancelada, secuencia continúa normal'); }}
                  className="gap-1.5 rounded-xl text-slate-500 hover:bg-slate-100 font-black text-xs"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Cancelar y seguir
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Vista Panadero (lo que ve el panadero hoy)
// ─────────────────────────────────────────────────────────
function VistaPanadero({
  formulaciones, modelos, configuracion, produccion, onLanzarPlanHoy
}: PlanSemanaViewProps) {
  const { plan, diasPerdidos, registrarDiaPerdido, resolverDiaPerdido } = usePlanSemana();
  const {
    programacionHoy,
    totalArrobasHoy,
    diasPerdidosPendientes,
    resolverDiaPerdido: resolverPerdidoNuevo,
    sugerirRecuperacion,
    registrarDiaPerdido: registrarPerdidoNuevo,
  } = useProgramacionSemanal();

  const hoy = new Date();
  const diaHoy = hoy.getDay();
  const fechaHoy = hoy.toISOString().split('T')[0];
  const itemsHoy = plan.dias[diaHoy] ?? [];

  // Detección y registro de día perdido (producción = 0 con plan activo)
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const diaAyer = ayer.getDay();
  const fechaAyer = ayer.toISOString().split('T')[0];
  const itemsAyer = plan.dias[diaAyer] ?? [];
  const ordenesAyer = produccion.filter(o =>
    new Date(o.fechaInicio).toISOString().split('T')[0] === fechaAyer
  );
  const diaPerdidoAyer = diasPerdidos.find(d => d.fecha === fechaAyer);
  const hayDiaPerdidoAyer = itemsAyer.length > 0 && ordenesAyer.length === 0 && !diaPerdidoAyer;

  useEffect(() => {
    if (hayDiaPerdidoAyer) {
      registrarDiaPerdido(diaAyer, fechaAyer, itemsAyer);
      // También registrar en el nuevo sistema con categorías
      const categoriasPerdidas = programacionHoy.categorias; // aproximación con el día actual
      if (categoriasPerdidas.length > 0) {
        registrarPerdidoNuevo(fechaAyer, diaAyer, categoriasPerdidas);
      }
    }
  }, [hayDiaPerdidoAyer]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumenesHoy = itemsHoy
    .map(item => ({ item, res: calcularResumenItem(item, formulaciones, modelos, configuracion) }))
    .filter(({ res }) => !!res);

  const totalArrobas = itemsHoy.reduce((s, i) => s + i.arrobas, 0);
  const totalPanes = resumenesHoy.reduce((s, { res }) => s + (res?.panes ?? 0), 0);
  const totalLatas = resumenesHoy.reduce((s, { res }) => s + (res?.latas ?? 0), 0);

  const capacidadRef = programacionHoy.capacidadReferencia || 3;
  const pctCapacidad = capacidadRef > 0 ? Math.min(100, (totalArrobasHoy / capacidadRef) * 100) : 0;
  const estadoCapacidad = pctCapacidad >= 100 ? 'critico' : pctCapacidad >= 85 ? 'alto' : 'normal';

  // Agrupar items de hoy por categoría de producción
  const porCategoria = useMemo(() => {
    const grupos: Record<string, { asig: AsignacionCategoria; items: typeof resumenesHoy }> = {};
    for (const asig of programacionHoy.categorias) {
      const modelosCat = resumenesHoy.filter(({ item }) => {
        const modelo = modelos.find(m => m.id === item.modeloId);
        return modelo?.categoriaProduccion === asig.categoria;
      });
      grupos[asig.categoria] = { asig, items: modelosCat };
    }
    return Object.values(grupos);
  }, [programacionHoy, resumenesHoy, modelos]);

  return (
    <div className="space-y-6">
      {/* Banner Recuperación Inteligente */}
      <BannerRecuperacion
        modelos={modelos}
        diasPerdidosPendientes={diasPerdidosPendientes}
        resolverDiaPerdido={resolverPerdidoNuevo}
        sugerirRecuperacion={sugerirRecuperacion}
        totalArrobasHoy={totalArrobasHoy}
        capacidadHoy={capacidadRef}
      />

      {/* Cabecera del día */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-[9px] uppercase tracking-widest opacity-80">Hoy</span>
            <span className="text-white font-black text-xl leading-none">{NOMBRES_DIAS_CORTO[diaHoy]}</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {NOMBRES_DIAS[diaHoy]}
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              {hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {itemsHoy.length > 0 && onLanzarPlanHoy && (
          <Button
            onClick={() => onLanzarPlanHoy(itemsHoy)}
            className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
          >
            🚀 Lanzar a Producción
          </Button>
        )}
      </div>

      {/* Barra de capacidad del día */}
      {programacionHoy.categorias.length > 0 && (
        <Card className="rounded-2xl border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Capacidad del día
              </p>
              <p className={cn("text-xs font-black",
                estadoCapacidad === 'critico' ? 'text-rose-600' :
                estadoCapacidad === 'alto' ? 'text-amber-600' : 'text-emerald-600'
              )}>
                {totalArrobasHoy.toFixed(2)} / {capacidadRef} arrobas
              </p>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500",
                  estadoCapacidad === 'critico' ? 'bg-rose-500' :
                  estadoCapacidad === 'alto' ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${pctCapacidad}%` }}
              />
            </div>
            {/* Categorías del día */}
            <div className="flex flex-wrap gap-2 mt-3">
              {programacionHoy.categorias.map(asig => {
                const cfg = CATEGORIAS_CONFIG[asig.categoria];
                return (
                  <Badge key={asig.categoria} variant="outline" className={cn("text-[9px] font-black gap-1", cfg.badge)}>
                    {cfg.emoji} {cfg.label} · {asig.arrobas} arr
                  </Badge>
                );
              })}
              {programacionHoy.categorias.length === 0 && (
                <p className="text-xs text-slate-400 italic">El director no configuró categorías para hoy</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de tareas por categoría */}
      {itemsHoy.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent">
          <CardContent className="py-16 text-center">
            <ChefHat className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Sin producción para hoy</p>
            <p className="text-xs text-slate-400 mt-1">
              El administrador no configuró tareas para el {NOMBRES_DIAS[diaHoy].toLowerCase()}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs totales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-600 rounded-2xl p-4 text-center shadow-lg shadow-indigo-500/20">
              <p className="text-3xl font-black text-white">{totalArrobas.toFixed(totalArrobas % 1 === 0 ? 0 : 2)}</p>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Arrobas</p>
            </div>
            <div className="bg-emerald-600 rounded-2xl p-4 text-center shadow-lg shadow-emerald-500/20">
              <p className="text-3xl font-black text-white">{totalPanes}</p>
              <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mt-1">Piezas</p>
            </div>
            <div className="bg-orange-500 rounded-2xl p-4 text-center shadow-lg shadow-orange-500/20">
              <p className="text-3xl font-black text-white">{totalLatas}</p>
              <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest mt-1">Latas</p>
            </div>
          </div>

          {/* Por categoría si hay programación */}
          {porCategoria.length > 0 ? (
            <div className="space-y-4">
              {porCategoria.map(({ asig, items: catItems }) => {
                const cfg = CATEGORIAS_CONFIG[asig.categoria];
                return (
                  <div key={asig.categoria} className="space-y-2">
                    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", cfg.bg)}>
                      <span className="text-base">{cfg.emoji}</span>
                      <p className={cn("font-black text-sm uppercase tracking-tight flex-1", cfg.color)}>{cfg.label}</p>
                      <Badge variant="outline" className={cn("text-[9px] font-black", cfg.badge)}>
                        {asig.arrobas} arrobas programadas
                      </Badge>
                    </div>
                    {catItems.length === 0 ? (
                      <p className="text-xs text-slate-400 pl-3 italic">Sin modelos asignados a esta categoría hoy</p>
                    ) : (
                      catItems.map(({ item, res }, idx) => (
                        <Card key={item.id} className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-sm shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate">{res!.modeloNombre}</p>
                                <p className="text-xs text-slate-400 font-bold truncate">{res!.formulacionNombre}</p>
                              </div>
                              <div className="flex gap-3 shrink-0">
                                <div className="text-center">
                                  <p className="text-xl font-black text-indigo-600 leading-none">{item.arrobas.toFixed(item.arrobas % 1 === 0 ? 0 : 2)}</p>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Arr</p>
                                </div>
                                <div className="w-px bg-slate-100 dark:bg-slate-800" />
                                <div className="text-center">
                                  <p className="text-xl font-black text-emerald-600 leading-none">{res!.panes}</p>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Pzas</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xl font-black text-orange-500 leading-none">{res!.latas}</p>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Latas</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Lista plana cuando no hay categorías configuradas */
            <div className="space-y-3">
              {resumenesHoy.map(({ item, res }, idx) => (
                <Card key={item.id} className="rounded-2xl border-none shadow-md bg-white dark:bg-slate-900">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-black text-indigo-600 text-lg shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight truncate">{res!.modeloNombre}</p>
                        <p className="text-xs text-slate-400 font-bold truncate">{res!.formulacionNombre}</p>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <div className="text-center">
                          <p className="text-2xl font-black text-indigo-600 leading-none">{item.arrobas.toFixed(item.arrobas % 1 === 0 ? 0 : 2)}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Arrobas</p>
                        </div>
                        <div className="w-px bg-slate-100 dark:bg-slate-800" />
                        <div className="text-center">
                          <p className="text-2xl font-black text-emerald-600 leading-none">{res!.panes}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Piezas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-orange-500 leading-none">{res!.latas}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Latas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-violet-600 leading-none">{res!.horneadas}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Hornos</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Vista Admin — Configurador de Semana (PC + celular fácil)
// ─────────────────────────────────────────────────────────
function VistaAdmin({ formulaciones: _formulaciones, modelos: _modelos }: Pick<PlanSemanaViewProps, 'formulaciones' | 'modelos'>) {
  const {
    programacion,
    setCapacidadDia,
    setAsignacionCategoria,
    eliminarCategoriaDia,
    setNotasDia,
  } = useProgramacionSemanal();
  const hoy = diaJsToIdx(new Date().getDay());
  const diasOrdenados = [1, 2, 3, 4, 5, 6, 0]; // Lun → Dom
  // En celular: un día a la vez (evita scroll horizontal y dedos pequeños)
  const [diaActivoJs, setDiaActivoJs] = useState(() => new Date().getDay());

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 dark:bg-indigo-950/30 dark:border-indigo-800 px-4 py-3">
        <Settings className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-black text-indigo-900 dark:text-indigo-100">
            Cómo programar (fácil)
          </p>
          <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 mt-1 font-medium leading-snug">
            1) Elige el día · 2) Pon la meta de arrobas · 3) Toca las categorías (pan sal, dulce…).
            Se guarda solo. El panadero ve su tarea en «Vista Panadero».
          </p>
        </div>
      </div>

      {/* Chips de día — sticky en celular */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm sm:static sm:bg-transparent sm:backdrop-blur-none">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 sm:hidden">
          Elige el día
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible">
          {diasOrdenados.map((diaJs) => {
            const diaIdx = diaJsToIdx(diaJs);
            const esHoy = diaIdx === hoy;
            const activo = diaJs === diaActivoJs;
            const prog = programacion.dias[diaIdx];
            const nCat = prog?.categorias?.length ?? 0;
            return (
              <button
                key={diaJs}
                type="button"
                onClick={() => setDiaActivoJs(diaJs)}
                className={cn(
                  'shrink-0 min-h-[48px] min-w-[64px] sm:min-w-[72px] rounded-2xl border-2 px-3 py-2 text-center transition-all active:scale-95',
                  activo
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200',
                  esHoy && !activo && 'ring-2 ring-indigo-300 ring-offset-1',
                )}
              >
                <span className="block text-[11px] font-black uppercase tracking-wide">
                  {NOMBRES_DIAS_CORTO[diaJs]}
                </span>
                <span className={cn('block text-[9px] font-bold mt-0.5', activo ? 'text-indigo-100' : 'text-slate-400')}>
                  {nCat > 0 ? `${nCat} cat.` : 'vacío'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Un día grande (móvil) + grid en pantallas anchas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {diasOrdenados.map((diaJs) => {
          const diaIdx = diaJsToIdx(diaJs);
          const esHoy = diaIdx === hoy;
          const progDia = programacion.dias[diaIdx];
          const capacidad = progDia?.capacidadReferencia ?? 3;
          const categoriasAsignadas = progDia?.categorias ?? [];
          const totalAsignado = categoriasAsignadas.reduce((s, c) => s + c.arrobas, 0);
          const excede = totalAsignado > capacidad;
          const visibleEnMovil = diaJs === diaActivoJs;

          return (
            <Card
              key={diaIdx}
              className={cn(
                'rounded-3xl border-2 shadow-sm transition-all',
                visibleEnMovil ? 'block' : 'hidden xl:block',
                esHoy ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-800',
              )}
            >
              <CardHeader className="pb-3 pt-5 px-4 sm:px-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      'inline-flex items-center justify-center w-11 h-11 rounded-2xl text-xs font-black border-2',
                      COLORES_DIA[diaJs],
                    )}>
                      {NOMBRES_DIAS_CORTO[diaJs]}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-black text-slate-800 dark:text-white truncate">
                        {NOMBRES_DIAS[diaJs]}
                      </CardTitle>
                      {esHoy && (
                        <Badge className="mt-1 h-5 px-2 text-[9px] font-black bg-indigo-600 text-white border-0">
                          HOY
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    'text-right shrink-0 rounded-xl px-3 py-2 border',
                    excede ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
                  )}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Asignado</p>
                    <p className="text-base font-black leading-none mt-0.5">
                      {totalAsignado.toFixed(totalAsignado % 1 ? 2 : 0)}
                      <span className="text-[10px] font-bold opacity-70"> / {capacidad} arr</span>
                    </p>
                  </div>
                </div>

                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', excede ? 'bg-rose-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, capacidad > 0 ? (totalAsignado / capacidad) * 100 : 0)}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Meta del día (arrobas)
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">Lo máximo que quieres hornear ese día</p>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min="0.5"
                    value={capacidad}
                    onChange={(e) => setCapacidadDia(diaIdx, Number(e.target.value))}
                    className="h-12 w-20 rounded-xl text-base text-center font-black border-slate-200 dark:border-slate-700"
                  />
                </div>
              </CardHeader>

              <CardContent className="px-4 sm:px-5 pb-5 space-y-3">
                {categoriasAsignadas.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-6 px-4 text-center">
                    <p className="text-sm font-black text-slate-500">Aún no hay categorías</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Abajo toca Pan Sal, Dulce, etc. y se agrega solo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categoriasAsignadas.map((asig) => {
                      const cfg = CATEGORIAS_CONFIG[asig.categoria];
                      return (
                        <div
                          key={asig.categoria}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 min-h-[56px]',
                            cfg.bg,
                          )}
                        >
                          <span className="text-xl shrink-0" aria-hidden>{cfg.emoji}</span>
                          <p className={cn('text-sm font-black flex-1 uppercase tracking-tight min-w-0 truncate', cfg.color)}>
                            {cfg.label}
                          </p>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            min="0.25"
                            value={asig.arrobas}
                            onChange={(e) => setAsignacionCategoria(diaIdx, asig.categoria, Number(e.target.value))}
                            className="h-11 w-16 rounded-xl text-base text-center font-black border-slate-200 bg-white dark:bg-slate-950"
                          />
                          <span className="text-[10px] text-slate-500 font-black shrink-0">arr</span>
                          <button
                            type="button"
                            aria-label={`Quitar ${cfg.label}`}
                            onClick={() => eliminarCategoriaDia(diaIdx, asig.categoria)}
                            className="h-11 w-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <AddCategoriaRow
                  diaIdx={diaIdx}
                  categoriasExistentes={categoriasAsignadas.map((c) => c.categoria)}
                  onAdd={(cat, arr) => setAsignacionCategoria(diaIdx, cat, arr)}
                />

                <div className="pt-1 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Nota del día (opcional)
                    </label>
                    <Input
                      type="text"
                      value={progDia?.notas ?? ''}
                      onChange={(e) => setNotasDia(diaIdx, e.target.value)}
                      placeholder="Ej: quincena, festivo, menos producción…"
                      className="h-11 rounded-xl text-sm font-medium border-slate-200 dark:border-slate-700"
                    />
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen semanal compacto en móvil */}
      <div className="xl:hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Semana de un vistazo
        </p>
        <div className="grid grid-cols-7 gap-1">
          {diasOrdenados.map((diaJs) => {
            const diaIdx = diaJsToIdx(diaJs);
            const cats = programacion.dias[diaIdx]?.categorias ?? [];
            const total = cats.reduce((s, c) => s + c.arrobas, 0);
            return (
              <button
                key={`sum-${diaJs}`}
                type="button"
                onClick={() => setDiaActivoJs(diaJs)}
                className={cn(
                  'rounded-xl py-2 px-0.5 text-center border transition-all',
                  diaJs === diaActivoJs ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-transparent bg-slate-50 dark:bg-slate-800/50',
                )}
              >
                <span className="block text-[9px] font-black text-slate-500">{NOMBRES_DIAS_CORTO[diaJs]}</span>
                <span className="block text-[11px] font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {total > 0 ? total.toFixed(total % 1 ? 1 : 0) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Agregar categoría: chips grandes (dedo) + cantidad ───
function AddCategoriaRow({
  diaIdx: _diaIdx,
  categoriasExistentes,
  onAdd,
}: {
  diaIdx: number;
  categoriasExistentes: CategoriaProduccion[];
  onAdd: (cat: CategoriaProduccion, arrobas: number) => void;
}) {
  const [arrobas, setArrobas] = useState(1);
  const disponibles = TODAS_CATEGORIAS.filter((c) => !categoriasExistentes.includes(c));
  if (disponibles.length === 0) {
    return (
      <p className="text-xs text-center text-emerald-700 font-bold py-2">
        ✓ Todas las categorías ya están en este día
      </p>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
          Agregar categoría
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500">Arrobas</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            value={arrobas}
            onChange={(e) => setArrobas(Number(e.target.value) || 0.25)}
            className="h-10 w-16 rounded-xl text-sm text-center font-black border-indigo-200 bg-white"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {disponibles.map((cat) => {
          const cfg = CATEGORIAS_CONFIG[cat];
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                onAdd(cat, arrobas > 0 ? arrobas : 1);
                toast.success(`${cfg.label}: ${arrobas || 1} arr`);
              }}
              className={cn(
                'min-h-[52px] rounded-2xl border-2 px-2 py-2.5 flex items-center gap-2 text-left transition-all active:scale-[0.97] hover:shadow-md',
                cfg.bg,
              )}
            >
              <span className="text-lg shrink-0">{cfg.emoji}</span>
              <span className={cn('text-[11px] font-black uppercase leading-tight', cfg.color)}>
                {cfg.label}
              </span>
              <Plus className={cn('w-4 h-4 ml-auto shrink-0 opacity-60', cfg.color)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Componente raíz exportado
// ─────────────────────────────────────────────────────────
export function PlanSemanaView(props: PlanSemanaViewProps) {
  const { check } = useCan();
  const esAdmin = check('EDITAR_PRECIOS');

  return (
    <div className="space-y-5 sm:space-y-6 pb-8">
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
          <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
            Planificación Semanal
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 leading-snug">
            Reparte arrobas por día · El panadero ve su tarea
          </p>
        </div>
      </div>

      {esAdmin ? (
        <Tabs defaultValue="semana" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 h-auto min-h-[52px] gap-1">
            <TabsTrigger
              value="hoy"
              className="rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md py-3 gap-1.5"
            >
              <Clock className="w-4 h-4" />
              <span>Vista Panadero</span>
            </TabsTrigger>
            <TabsTrigger
              value="semana"
              className="rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md py-3 gap-1.5"
            >
              <Settings className="w-4 h-4" />
              <span>Configurar</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hoy" className="mt-0">
            <VistaPanadero {...props} />
          </TabsContent>
          <TabsContent value="semana" className="mt-0">
            <VistaAdmin formulaciones={props.formulaciones} modelos={props.modelos} />
          </TabsContent>
        </Tabs>
      ) : (
        <VistaPanadero {...props} />
      )}
    </div>
  );
}
