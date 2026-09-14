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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCan } from '@/contexts/AuthContext';
import { usePlanSemana } from '@/hooks/usePlanSemana';
import {
  useProgramacionSemanal,
  diaJsToIdx,
} from '@/hooks/useProgramacionSemanal';
import { generateUUID } from '@/lib/safe-utils';
import type {
  FormulacionBase, ModeloPan, Configuracion, OrdenProduccion, PlanSemanaItem,
  CategoriaProduccion, AsignacionCategoria,
} from '@/types';
import { ARROBA_KG } from '@/types';
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
// Vista Admin — Configurador de Semana Flexible
// ─────────────────────────────────────────────────────────
function VistaAdmin({ formulaciones, modelos }: Pick<PlanSemanaViewProps, 'formulaciones' | 'modelos'>) {
  const { plan, agregarItem, actualizarItem, eliminarItem } = usePlanSemana();
  const {
    programacion,
    setCapacidadDia,
    setAsignacionCategoria,
    eliminarCategoriaDia,
    setNotasDia,
  } = useProgramacionSemanal();
  const hoy = diaJsToIdx(new Date().getDay());

  // Días ordenados Mon→Sun (nuestra convención)
  const diasOrdenados = [1, 2, 3, 4, 5, 6, 0]; // JS day index Mon→Sun

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-slate-100 dark:border-slate-800">
        <Settings className="w-3.5 h-3.5" />
        Programa cuántas arrobas de cada categoría se producen cada día. Los cambios se guardan automáticamente.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {diasOrdenados.map(diaJs => {
          const diaIdx = diaJsToIdx(diaJs);
          const esHoy = diaIdx === hoy;
          const progDia = programacion.dias[diaIdx];
          const capacidad = progDia?.capacidadReferencia ?? 3;
          const categoriasAsignadas = progDia?.categorias ?? [];
          const totalAsignado = categoriasAsignadas.reduce((s, c) => s + c.arrobas, 0);
          const excede = totalAsignado > capacidad;

          return (
            <Card
              key={diaIdx}
              className={cn(
                'rounded-2xl border shadow-sm transition-all',
                esHoy ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-indigo-100 dark:shadow-none' : ''
              )}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-black border', COLORES_DIA[diaJs])}>
                      {NOMBRES_DIAS_CORTO[diaJs]}
                    </span>
                    <CardTitle className="text-sm font-black text-slate-800 dark:text-white">
                      {NOMBRES_DIAS[diaJs]}
                    </CardTitle>
                    {esHoy && <Badge className="h-4 px-1.5 text-[8px] font-black bg-indigo-600 text-white border-0">HOY</Badge>}
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] font-black", excede ? "border-rose-300 text-rose-600 bg-rose-50" : "")}>
                    {totalAsignado.toFixed(2)} / {capacidad} arr
                  </Badge>
                </div>

                {/* Barra de capacidad */}
                <div className="mt-2 space-y-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", excede ? "bg-rose-500" : "bg-emerald-500")}
                      style={{ width: `${Math.min(100, capacidad > 0 ? (totalAsignado / capacidad) * 100 : 0)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] text-slate-400 font-bold flex-1">Referencia:</p>
                    <Input
                      type="number"
                      step="0.25"
                      min="0.5"
                      value={capacidad}
                      onChange={e => setCapacidadDia(diaIdx, Number(e.target.value))}
                      className="h-6 w-16 rounded-lg text-[10px] text-center font-black border-slate-200"
                    />
                    <span className="text-[9px] text-slate-400 font-bold">arr</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-2">
                {/* Categorías asignadas */}
                {categoriasAsignadas.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center italic">Sin categorías asignadas</p>
                ) : (
                  <div className="space-y-1.5">
                    {categoriasAsignadas.map(asig => {
                      const cfg = CATEGORIAS_CONFIG[asig.categoria];
                      return (
                        <div key={asig.categoria} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-xl border", cfg.bg)}>
                          <span className="text-sm">{cfg.emoji}</span>
                          <p className={cn("text-[10px] font-black flex-1 uppercase tracking-tight", cfg.color)}>{cfg.label}</p>
                          <Input
                            type="number"
                            step="0.25"
                            min="0.25"
                            value={asig.arrobas}
                            onChange={e => setAsignacionCategoria(diaIdx, asig.categoria, Number(e.target.value))}
                            className="h-7 w-14 rounded-lg text-[10px] text-center font-black border-slate-200 bg-white"
                          />
                          <span className="text-[9px] text-slate-400 font-bold">arr</span>
                          <button
                            onClick={() => eliminarCategoriaDia(diaIdx, asig.categoria)}
                            className="w-6 h-6 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Agregar categoría */}
                <AddCategoriaRow
                  diaIdx={diaIdx}
                  categoriasExistentes={categoriasAsignadas.map(c => c.categoria)}
                  onAdd={(cat, arr) => setAsignacionCategoria(diaIdx, cat, arr)}
                />

                {/* Notas del día */}
                {progDia?.notas !== undefined && (
                  <input
                    type="text"
                    value={progDia.notas ?? ''}
                    onChange={e => setNotasDia(diaIdx, e.target.value)}
                    placeholder="Notas del día (ej: quincena, festivo...)"
                    className="w-full text-[10px] text-slate-500 bg-transparent border-0 border-b border-dashed border-slate-200 py-1 focus:outline-none focus:border-indigo-300"
                  />
                )}
                <button
                  onClick={() => setNotasDia(diaIdx, progDia?.notas ?? '')}
                  className="text-[9px] text-slate-400 hover:text-indigo-500 transition-colors font-bold"
                >
                  {progDia?.notas !== undefined ? '' : '+ Agregar nota'}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini-form para agregar categoría a un día ───────────
function AddCategoriaRow({
  diaIdx,
  categoriasExistentes,
  onAdd,
}: {
  diaIdx: number;
  categoriasExistentes: CategoriaProduccion[];
  onAdd: (cat: CategoriaProduccion, arrobas: number) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<CategoriaProduccion | ''>('');
  const [arrobas, setArrobas] = useState(1);

  const disponibles = TODAS_CATEGORIAS.filter(c => !categoriasExistentes.includes(c));
  if (disponibles.length === 0) return null;

  const handleAdd = () => {
    if (!selectedCat) return;
    onAdd(selectedCat, arrobas);
    setSelectedCat('');
    setArrobas(1);
  };

  return (
    <div className="flex items-center gap-1.5 pt-1">
      <Select value={selectedCat} onValueChange={v => setSelectedCat(v as CategoriaProduccion)}>
        <SelectTrigger className="h-8 rounded-xl text-[10px] flex-1 border-dashed border-slate-300">
          <SelectValue placeholder="+ Categoría..." />
        </SelectTrigger>
        <SelectContent>
          {disponibles.map(cat => {
            const cfg = CATEGORIAS_CONFIG[cat];
            return (
              <SelectItem key={cat} value={cat} className="text-xs">
                {cfg.emoji} {cfg.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Input
        type="number"
        step="0.25"
        min="0.25"
        value={arrobas}
        onChange={e => setArrobas(Number(e.target.value))}
        className="h-8 w-14 rounded-xl text-[10px] text-center font-black border-dashed border-slate-300"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={handleAdd}
        disabled={!selectedCat}
        className="h-8 w-8 rounded-xl p-0 text-indigo-600 hover:bg-indigo-50 disabled:opacity-30"
      >
        <Plus className="w-4 h-4" />
      </Button>
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <CalendarDays className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Planificación Semanal
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            Reparte las arrobas por categoría · El panadero ve su tarea del día
          </p>
        </div>
      </div>

      {esAdmin ? (
        <Tabs defaultValue="hoy" className="space-y-4">
          <TabsList className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-2xl p-1 h-12">
            <TabsTrigger value="hoy" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Vista Panadero
            </TabsTrigger>
            <TabsTrigger value="semana" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white px-6">
              <Settings className="w-3.5 h-3.5 mr-1.5" /> Configurar Semana
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
