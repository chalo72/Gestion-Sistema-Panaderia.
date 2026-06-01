import React, { useMemo, useEffect } from 'react';
import {
  CalendarDays, Plus, Trash2, ChefHat, AlertTriangle,
  CheckCircle2, SkipForward, RotateCcw, Settings, Clock
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
import { generateUUID } from '@/lib/safe-utils';
import type {
  FormulacionBase, ModeloPan, Configuracion, OrdenProduccion, PlanSemanaItem
} from '@/types';

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

  const ARROBA_GR = (configuracion.pesoArrobaKg || 11.5) * 1000;
  const CAPACIDAD_HORNO = configuracion.latasPorHorno || 4;
  const masaUtil = ARROBA_GR * (1 - (modelo.mermaEstimada || 0) / 100);
  const panesPorArroba = Math.floor(masaUtil / modelo.pesoUnitarioGr);
  const panes = panesPorArroba * item.arrobas;
  const piezasPorLata = modelo.piezasPorLata || 12;
  const latas = Math.ceil(panes / piezasPorLata);
  const horneadas = Math.ceil(latas / CAPACIDAD_HORNO);

  return {
    formulacionNombre: formulacion.nombre,
    modeloNombre: modelo.nombre,
    panes,
    latas,
    horneadas,
  };
}

// ─────────────────────────────────────────────
// Vista Panadero: "Hoy toca esto"
// ─────────────────────────────────────────────
function VistaPanadero({
  formulaciones, modelos, configuracion, produccion, onLanzarPlanHoy
}: PlanSemanaViewProps) {
  const { plan, diasPerdidos, registrarDiaPerdido, resolverDiaPerdido } = usePlanSemana();
  const hoy = new Date();
  const diaHoy = hoy.getDay(); // 0=domingo
  const fechaHoy = hoy.toISOString().split('T')[0];
  const itemsHoy = plan.dias[diaHoy] ?? [];

  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const diaAyer = ayer.getDay();
  const fechaAyer = ayer.toISOString().split('T')[0];
  const itemsAyer = plan.dias[diaAyer] ?? [];

  // Detectar si ayer hubo plan pero 0 órdenes → día perdido
  const ordenesAyer = produccion.filter(o => {
    const fechaOrden = new Date(o.fechaInicio).toISOString().split('T')[0];
    return fechaOrden === fechaAyer;
  });
  const diaPerdidoAyer = diasPerdidos.find(d => d.fecha === fechaAyer);
  const hayDiaPerdido = itemsAyer.length > 0 && ordenesAyer.length === 0 && !diaPerdidoAyer;

  // Auto-registrar día perdido detectado (silencioso, sin toast)
  useEffect(() => {
    if (hayDiaPerdido) {
      registrarDiaPerdido(diaAyer, fechaAyer, itemsAyer);
    }
  }, [hayDiaPerdido]); // eslint-disable-line react-hooks/exhaustive-deps

  const diaPerdidoPendiente = diasPerdidos.find(d => d.fecha === fechaAyer && d.estado === 'pendiente');

  const resumenesHoy = itemsHoy
    .map(item => ({ item, res: calcularResumenItem(item, formulaciones, modelos, configuracion) }))
    .filter(({ res }) => !!res);

  const totalArrobas = itemsHoy.reduce((s, i) => s + i.arrobas, 0);
  const totalPanes = resumenesHoy.reduce((s, { res }) => s + (res?.panes ?? 0), 0);
  const totalLatas = resumenesHoy.reduce((s, { res }) => s + (res?.latas ?? 0), 0);

  const handlePostergar = () => {
    resolverDiaPerdido(fechaAyer, 'postergar');
    toast.success(`Plan del ${NOMBRES_DIAS[diaAyer]} añadido a las tareas de hoy`);
  };

  const handleIgnorar = () => {
    resolverDiaPerdido(fechaAyer, 'ignorar');
    toast.info('Día anterior marcado como omitido');
  };

  // Items a mostrar: los de hoy + los postergados de ayer
  const itemsPostergados = diaPerdidoPendiente?.estado === 'pendiente'
    ? []
    : diasPerdidos
        .filter(d => d.estado === 'postergar' && d.fecha === fechaAyer)
        .flatMap(d => d.items);

  return (
    <div className="space-y-6">
      {/* Banner día perdido */}
      {diaPerdidoPendiente && (
        <Card className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-2xl shadow-md">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-black text-amber-800 text-sm uppercase tracking-wide">
                    No se registró producción el {NOMBRES_DIAS[diaAyer]}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Había {diaPerdidoPendiente.items.length} producto{diaPerdidoPendiente.items.length !== 1 ? 's' : ''} planificados.
                    ¿Qué hacemos?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePostergar}
                  className="gap-1.5 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 font-black text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Agregar a hoy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleIgnorar}
                  className="gap-1.5 rounded-xl text-amber-600 hover:bg-amber-100 font-black text-xs"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Omitir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {itemsHoy.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent">
          <CardContent className="py-16 text-center">
            <ChefHat className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-sm">
              Sin producción para hoy
            </p>
            <p className="text-xs text-slate-400 mt-1">El administrador no configuró tareas para el {NOMBRES_DIAS[diaHoy].toLowerCase()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Totales del día */}
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

          {/* Lista de tareas */}
          <div className="space-y-3">
            {resumenesHoy.map(({ item, res }, idx) => (
              <Card key={item.id} className="rounded-2xl border-none shadow-md bg-white dark:bg-slate-900">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-black text-indigo-600 text-lg shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight truncate">
                        {res!.modeloNombre}
                      </p>
                      <p className="text-xs text-slate-400 font-bold truncate">{res!.formulacionNombre}</p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <div className="text-center">
                        <p className="text-2xl font-black text-indigo-600 leading-none">
                          {item.arrobas.toFixed(item.arrobas % 1 === 0 ? 0 : 2)}
                        </p>
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
        </div>
      )}

      {/* Postergados de ayer */}
      {itemsPostergados.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" /> Postergados del {NOMBRES_DIAS[diaAyer]}
          </p>
          {itemsPostergados.map(item => {
            const res = calcularResumenItem(item, formulaciones, modelos, configuracion);
            if (!res) return null;
            return (
              <Card key={item.id} className="rounded-xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-black text-sm text-amber-800">{res.modeloNombre}</p>
                    <p className="text-xs text-amber-600">{item.arrobas} arrobas · {res.panes} piezas</p>
                  </div>
                  <Badge variant="outline" className="border-amber-300 text-amber-700 text-[9px] font-black">POSTERGADO</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Fila de item en el configurador de un día
// ─────────────────────────────────────────────
interface FilaItemProps {
  item: PlanSemanaItem;
  diaSemana: number;
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  onUpdate: (diaSemana: number, itemId: string, cambios: Partial<PlanSemanaItem>) => void;
  onDelete: (diaSemana: number, itemId: string) => void;
}

function FilaItem({ item, diaSemana, formulaciones, modelos, onUpdate, onDelete }: FilaItemProps) {
  const modelosFiltrados = modelos.filter(m => m.formulacionId === item.formulacionId && m.activo);

  return (
    <div className="flex items-center gap-2 py-2">
      <Select
        value={item.formulacionId}
        onValueChange={v => onUpdate(diaSemana, item.id, { formulacionId: v, modeloId: '' })}
      >
        <SelectTrigger className="h-9 rounded-xl text-xs flex-1">
          <SelectValue placeholder="Masa..." />
        </SelectTrigger>
        <SelectContent>
          {formulaciones.filter(f => f.activo).map(f => (
            <SelectItem key={f.id} value={f.id} className="text-xs">{f.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        key={`modelo-${item.formulacionId}`}
        value={item.modeloId}
        onValueChange={v => onUpdate(diaSemana, item.id, { modeloId: v })}
        disabled={!item.formulacionId}
      >
        <SelectTrigger className="h-9 rounded-xl text-xs flex-1">
          <SelectValue placeholder="Producto..." />
        </SelectTrigger>
        <SelectContent>
          {modelosFiltrados.map(m => (
            <SelectItem key={m.id} value={m.id} className="text-xs">{m.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          step="0.25"
          min="0.25"
          value={item.arrobas}
          onChange={e => onUpdate(diaSemana, item.id, { arrobas: Number(e.target.value) })}
          className="h-9 w-16 rounded-xl text-xs text-center font-black"
        />
        <span className="text-[9px] text-slate-400 font-bold uppercase">arr</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"
        onClick={() => onDelete(diaSemana, item.id)}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Vista Admin: configurar semana
// ─────────────────────────────────────────────
function VistaAdmin({ formulaciones, modelos }: Pick<PlanSemanaViewProps, 'formulaciones' | 'modelos'>) {
  const { plan, agregarItem, actualizarItem, eliminarItem } = usePlanSemana();
  const hoy = new Date().getDay();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-slate-100 dark:border-slate-800">
        <Settings className="w-3.5 h-3.5" />
        Los cambios se guardan automáticamente en este dispositivo.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {NOMBRES_DIAS.map((nombre, diaIdx) => {
          const items = plan.dias[diaIdx] ?? [];
          const esHoy = diaIdx === hoy;

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
                    <span className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-black border',
                      COLORES_DIA[diaIdx]
                    )}>
                      {NOMBRES_DIAS_CORTO[diaIdx]}
                    </span>
                    <CardTitle className="text-sm font-black text-slate-800 dark:text-white">
                      {nombre}
                    </CardTitle>
                    {esHoy && (
                      <Badge className="h-4 px-1.5 text-[8px] font-black bg-indigo-600 text-white border-0">HOY</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black">
                    {items.length} {items.length === 1 ? 'masa' : 'masas'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center italic">Sin producción</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map(item => (
                      <FilaItem
                        key={item.id}
                        item={item}
                        diaSemana={diaIdx}
                        formulaciones={formulaciones}
                        modelos={modelos}
                        onUpdate={actualizarItem}
                        onDelete={eliminarItem}
                      />
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => agregarItem(diaIdx, { formulacionId: '', modeloId: '', arrobas: 1 })}
                  className="w-full mt-2 h-8 rounded-xl text-xs font-black text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agregar masa
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente raíz exportado
// ─────────────────────────────────────────────
export function PlanSemanaView(props: PlanSemanaViewProps) {
  const { check } = useCan();
  const esAdmin = check('EDITAR_PRECIOS'); // ADMIN y GERENTE tienen este permiso

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
            Configura la semana · El panadero ve su tarea del día
          </p>
        </div>
      </div>

      {esAdmin ? (
        <Tabs defaultValue="hoy" className="space-y-4">
          <TabsList className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-2xl p-1 h-12">
            <TabsTrigger
              value="hoy"
              className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Vista Panadero
            </TabsTrigger>
            <TabsTrigger
              value="semana"
              className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white px-6"
            >
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
