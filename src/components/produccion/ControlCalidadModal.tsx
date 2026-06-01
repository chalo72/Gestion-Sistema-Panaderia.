import React, { useState, useMemo } from 'react';
import {
  Flame, Wind, Scissors, Snowflake, HelpCircle,
  CheckCircle2, AlertTriangle, ClipboardCheck, Minus, Plus, X
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { OrdenProduccion, RechazoCalidad, MotivoRechazo, InspeccionCalidad } from '@/types';

interface MotivoDef {
  id: MotivoRechazo;
  label: string;
  emoji: string;
  desc: string;
  color: string;
  bg: string;
}

const MOTIVOS: MotivoDef[] = [
  { id: 'quemado',   label: 'Quemados',    emoji: '🔥', desc: 'Corteza negra o carbonizada',   color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { id: 'amogañado', label: 'Con moho',    emoji: '🍄', desc: 'Manchas verdes, blancas o negras',color: 'text-green-700',  bg: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { id: 'deforme',   label: 'Deformes',    emoji: '💔', desc: 'Rotos, aplastados o mal formados', color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200 hover:bg-rose-100' },
  { id: 'crudo',     label: 'Crudos',      emoji: '❄️', desc: 'Sin cocción completa por dentro',  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { id: 'otro',      label: 'Otros',       emoji: '📦', desc: 'Otro defecto no clasificado',      color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200 hover:bg-slate-100' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orden: OrdenProduccion | null;
  modeloNombre: string;
  productoNombre: string;
  onGuardar: (data: Omit<InspeccionCalidad, 'id' | 'fechaInspeccion' | 'porcentajeRechazo' | 'cantidadAprobada'>) => InspeccionCalidad;
  onActualizarOrden: (id: string, updates: any) => Promise<void>;
  inspeccionExistente?: InspeccionCalidad;
}

export function ControlCalidadModal({
  open, onOpenChange, orden, modeloNombre, productoNombre,
  onGuardar, onActualizarOrden, inspeccionExistente
}: Props) {
  const cantidadBase = orden?.cantidadCompletada ?? orden?.cantidadPlaneada ?? 0;

  const [contado, setContado] = useState<string>(() =>
    inspeccionExistente ? String(inspeccionExistente.cantidadContada) : String(cantidadBase)
  );
  const [rechazos, setRechazos] = useState<Record<MotivoRechazo, number>>(() => {
    const base: Record<MotivoRechazo, number> = { quemado: 0, amogañado: 0, deforme: 0, crudo: 0, otro: 0 };
    if (inspeccionExistente) {
      inspeccionExistente.rechazos.forEach(r => { base[r.motivo] = r.cantidad; });
    }
    return base;
  });
  const [notas, setNotas] = useState(inspeccionExistente?.notas ?? '');
  const [guardando, setGuardando] = useState(false);

  const contadoNum = parseInt(contado, 10) || 0;
  const totalRechazados = Object.values(rechazos).reduce((s, n) => s + n, 0);
  const aprobados = Math.max(0, contadoNum - totalRechazados);
  const pctRechazo = contadoNum > 0 ? Math.round((totalRechazados / contadoNum) * 100) : 0;
  const hayCritico = pctRechazo >= 20;

  const ajustarRechazo = (motivo: MotivoRechazo, delta: number) => {
    setRechazos(prev => ({
      ...prev,
      [motivo]: Math.max(0, Math.min((prev[motivo] ?? 0) + delta, contadoNum)),
    }));
  };

  const handleGuardar = async () => {
    if (!orden) return;
    if (contadoNum <= 0) {
      toast.error('Ingresa el conteo real de piezas');
      return;
    }
    if (totalRechazados > contadoNum) {
      toast.error('Los rechazados no pueden superar el conteo total');
      return;
    }

    setGuardando(true);
    try {
      const rechazosArr: RechazoCalidad[] = MOTIVOS
        .filter(m => rechazos[m.id] > 0)
        .map(m => ({ motivo: m.id, cantidad: rechazos[m.id] }));

      const inspeccion = onGuardar({
        ordenProduccionId: orden.id,
        modeloNombre,
        productoNombre,
        cantidadProducida: cantidadBase,
        cantidadContada: contadoNum,
        rechazos: rechazosArr,
        notas: notas.trim() || undefined,
      });

      // Actualizar cantidad aprobada en la orden
      await onActualizarOrden(orden.id, { cantidadCompletada: inspeccion.cantidadAprobada });

      toast.success(`Lote aprobado: ${inspeccion.cantidadAprobada} piezas listas para venta`);
      if (totalRechazados > 0) {
        toast.warning(`${totalRechazados} piezas rechazadas registradas como merma`);
      }
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  };

  if (!orden) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white font-black text-base uppercase tracking-tight">
                  Control de Calidad
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-[11px] font-bold">
                  {modeloNombre} — Lote completado
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Indicadores de resumen */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-300">{cantidadBase}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Producidas</p>
            </div>
            <div className="text-center border-x border-slate-700">
              <p className={cn("text-2xl font-black", hayCritico ? "text-rose-400" : "text-amber-400")}>
                {totalRechazados}
              </p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Rechazadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{aprobados}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Aprobadas</p>
            </div>
          </div>

          {/* Barra de calidad */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tasa de aprobación</span>
              <span className={cn("text-[11px] font-black", hayCritico ? "text-rose-400" : "text-emerald-400")}>
                {100 - pctRechazo}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", hayCritico ? "bg-rose-500" : "bg-emerald-500")}
                style={{ width: `${100 - pctRechazo}%` }}
              />
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Conteo real */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
              Conteo físico real de piezas
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                value={contado}
                onChange={e => setContado(e.target.value)}
                className="h-12 text-2xl font-black text-center rounded-xl w-32"
              />
              <div className="text-xs text-slate-400 font-bold">
                piezas contadas<br />
                <span className="text-slate-300">Planeadas: {cantidadBase}</span>
              </div>
            </div>
          </div>

          {/* Rechazos por motivo */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">
              Piezas rechazadas — marcar por motivo
            </label>
            <div className="space-y-2">
              {MOTIVOS.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                    m.bg,
                    rechazos[m.id] > 0 ? 'ring-1 ring-inset ring-current/30' : ''
                  )}
                >
                  <span className="text-xl shrink-0">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-black text-sm leading-none", m.color)}>{m.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={() => ajustarRechazo(m.id, -1)}
                      disabled={rechazos[m.id] === 0}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className={cn(
                      "font-black text-lg w-8 text-center",
                      rechazos[m.id] > 0 ? m.color : "text-slate-300"
                    )}>
                      {rechazos[m.id]}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={() => ajustarRechazo(m.id, 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerta si rechazo alto */}
          {hayCritico && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-bold">
                Tasa de rechazo alta ({pctRechazo}%). Considera revisar temperatura del horno o tiempo de fermentación.
              </p>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
              Observaciones (opcional)
            </label>
            <Textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: horno muy caliente en la segunda horneada, se notó fermentación corta..."
              className="rounded-xl text-sm resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={guardando || contadoNum <= 0}
            className="flex-2 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprobar lote — {aprobados} piezas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
