import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, ClipboardCheck,
  Minus, Plus, DollarSign, User, Building2, ShoppingBag
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
import type {
  OrdenProduccion, RechazoCalidad, MotivoRechazo,
  InspeccionCalidad, ResponsableRechazo
} from '@/types';

interface MotivoDef {
  id: MotivoRechazo;
  label: string;
  emoji: string;
  desc: string;
  color: string;
  bg: string;
  responsableDefault: ResponsableRechazo;
}

const MOTIVOS: MotivoDef[] = [
  { id: 'quemado',   label: 'Quemados',   emoji: '🔥', desc: 'Corteza negra o carbonizada',    color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200',  responsableDefault: 'panadero' },
  { id: 'amogañado', label: 'Con moho',   emoji: '🍄', desc: 'Manchas verdes, blancas o negras', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',    responsableDefault: 'vendedora' },
  { id: 'deforme',   label: 'Deformes',   emoji: '💔', desc: 'Rotos, aplastados o mal formados',  color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200',      responsableDefault: 'panadero' },
  { id: 'crudo',     label: 'Crudos',     emoji: '❄️', desc: 'Sin cocción completa por dentro',   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',      responsableDefault: 'panadero' },
  { id: 'otro',      label: 'Otros',      emoji: '📦', desc: 'Otro defecto no clasificado',       color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',    responsableDefault: 'panaderia' },
];

const RESPONSABLES: { id: ResponsableRechazo; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'panadero',   label: 'Panadero / Obrero', icon: <User className="w-3 h-3" />,        color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'vendedora',  label: 'Vendedora',          icon: <ShoppingBag className="w-3 h-3" />, color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'panaderia',  label: 'Panadería absorbe',  icon: <Building2 className="w-3 h-3" />,   color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

interface RechazoState {
  cantidad: number;
  responsable: ResponsableRechazo;
  nombreResponsable: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orden: OrdenProduccion | null;
  modeloNombre: string;
  productoNombre: string;
  precioUnitario: number;
  costoUnitario: number;
  onGuardar: (data: Omit<InspeccionCalidad, 'id' | 'fechaInspeccion'>) => InspeccionCalidad;
  onActualizarOrden: (id: string, updates: any) => Promise<void>;
  onCrearLote?: (loteData: any) => void;
  inspeccionExistente?: InspeccionCalidad;
}

export function ControlCalidadModal({
  open, onOpenChange, orden, modeloNombre, productoNombre,
  precioUnitario, costoUnitario,
  onGuardar, onActualizarOrden, onCrearLote, inspeccionExistente
}: Props) {
  const cantidadBase = orden?.cantidadCompletada ?? orden?.cantidadPlaneada ?? 0;

  const [contado, setContado] = useState<string>(() =>
    inspeccionExistente ? String(inspeccionExistente.cantidadContada) : String(cantidadBase)
  );

  const [rechazos, setRechazos] = useState<Record<MotivoRechazo, RechazoState>>(() => {
    const base: Record<MotivoRechazo, RechazoState> = {
      quemado:   { cantidad: 0, responsable: 'panadero',   nombreResponsable: '' },
      amogañado: { cantidad: 0, responsable: 'vendedora',  nombreResponsable: '' },
      deforme:   { cantidad: 0, responsable: 'panadero',   nombreResponsable: '' },
      crudo:     { cantidad: 0, responsable: 'panadero',   nombreResponsable: '' },
      otro:      { cantidad: 0, responsable: 'panaderia',  nombreResponsable: '' },
    };
    if (inspeccionExistente) {
      inspeccionExistente.rechazos.forEach(r => {
        base[r.motivo] = {
          cantidad: r.cantidad,
          responsable: r.responsable,
          nombreResponsable: r.nombreResponsable ?? '',
        };
      });
    }
    return base;
  });

  const [notas, setNotas] = useState(inspeccionExistente?.notas ?? '');
  const [guardando, setGuardando] = useState(false);

  const contadoNum = parseInt(contado, 10) || 0;
  const totalRechazados = Object.values(rechazos).reduce((s, r) => s + r.cantidad, 0);
  const aprobados = Math.max(0, contadoNum - totalRechazados);
  const pctRechazo = contadoNum > 0 ? Math.round((totalRechazados / contadoNum) * 100) : 0;
  const hayCritico = pctRechazo >= 20;

  // Calcular pérdidas por responsable
  const perdidaPorResponsable = (['panadero', 'vendedora', 'panaderia'] as ResponsableRechazo[]).map(resp => {
    const total = Object.values(rechazos)
      .filter(r => r.responsable === resp)
      .reduce((s, r) => s + r.cantidad, 0);
    return { resp, total, valor: total * precioUnitario };
  });

  const valorPerdidaTotal = totalRechazados * precioUnitario;

  const ajustarRechazo = (motivo: MotivoRechazo, delta: number) => {
    setRechazos(prev => ({
      ...prev,
      [motivo]: { ...prev[motivo], cantidad: Math.max(0, Math.min(prev[motivo].cantidad + delta, contadoNum)) },
    }));
  };

  const setResponsable = (motivo: MotivoRechazo, resp: ResponsableRechazo) => {
    setRechazos(prev => ({ ...prev, [motivo]: { ...prev[motivo], responsable: resp } }));
  };

  const setNombreResponsable = (motivo: MotivoRechazo, nombre: string) => {
    setRechazos(prev => ({ ...prev, [motivo]: { ...prev[motivo], nombreResponsable: nombre } }));
  };

  const handleGuardar = async () => {
    if (!orden) return;
    if (contadoNum <= 0) { toast.error('Ingresa el conteo real de piezas'); return; }
    if (totalRechazados > contadoNum) { toast.error('Los rechazados no pueden superar el conteo'); return; }

    setGuardando(true);
    try {
      const rechazosArr: RechazoCalidad[] = MOTIVOS
        .filter(m => rechazos[m.id].cantidad > 0)
        .map(m => ({
          motivo: m.id,
          cantidad: rechazos[m.id].cantidad,
          responsable: rechazos[m.id].responsable,
          nombreResponsable: rechazos[m.id].nombreResponsable || undefined,
        }));

      const inspeccion = onGuardar({
        ordenProduccionId: orden.id,
        modeloNombre,
        productoNombre,
        cantidadProducida: cantidadBase,
        cantidadContada: contadoNum,
        rechazos: rechazosArr,
        cantidadAprobada: aprobados,
        porcentajeRechazo: pctRechazo,
        precioUnitario,
        valorPerdidaTotal,
        notas: notas.trim() || undefined,
      });

      await onActualizarOrden(orden.id, { cantidadCompletada: aprobados });

      // Crear lote en stock para rotación FIFO
      onCrearLote?.({
        ordenProduccionId: orden.id,
        modeloNombre,
        productoNombre,
        fechaProduccion: new Date().toISOString(),
        cantidadInicial: aprobados,
        cantidadDisponible: aprobados,
        precioUnitario,
        costoUnitario,
      });

      toast.success(`✅ Lote aprobado: ${aprobados} piezas listas para venta`);
      if (totalRechazados > 0) {
        const resp = perdidaPorResponsable.filter(p => p.total > 0);
        resp.forEach(p => {
          if (p.resp !== 'panaderia') {
            toast.warning(`${p.total} rechazadas → ${p.resp === 'panadero' ? 'Panadero' : 'Vendedora'} (${formatPrice(p.valor)})`);
          }
        });
      }
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  };

  if (!orden) return null;

  const formatPrice = (v: number) =>
    v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white font-black text-base uppercase tracking-tight">
                  Control de Calidad
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-[11px] font-bold">
                  {modeloNombre} — Precio de venta: {formatPrice(precioUnitario)} / pieza
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Producidas', value: cantidadBase, color: 'text-slate-300' },
              { label: 'Contadas', value: contadoNum, color: 'text-white' },
              { label: 'Rechazadas', value: totalRechazados, color: hayCritico ? 'text-rose-400' : 'text-amber-400' },
              { label: 'Aprobadas', value: aprobados, color: 'text-emerald-400' },
            ].map((item, i) => (
              <div key={i} className={cn("text-center", i > 0 && "border-l border-slate-700")}>
                <p className={cn("text-2xl font-black", item.color)}>{item.value}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Barra de calidad */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between items-center">
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

          {/* Pérdidas por responsable */}
          {totalRechazados > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {perdidaPorResponsable.filter(p => p.total > 0).map(p => (
                <div key={p.resp} className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black",
                  p.resp === 'panadero'  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                  p.resp === 'vendedora' ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                                          "bg-slate-600/40 text-slate-300 border border-slate-600"
                )}>
                  {p.resp === 'panadero' ? '👨‍🍳' : p.resp === 'vendedora' ? '🛍️' : '🏢'}
                  {p.total} pzas · {formatPrice(p.valor)}
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-white/5 text-slate-300 border border-slate-700">
                <DollarSign className="w-3 h-3" /> Total perdida: {formatPrice(valorPerdidaTotal)}
              </div>
            </div>
          )}
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-5 max-h-[55vh] overflow-y-auto">
          {/* Conteo real */}
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                Conteo físico real
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min="0" value={contado}
                  onChange={e => setContado(e.target.value)}
                  className="h-11 text-xl font-black text-center rounded-xl w-28"
                />
                <span className="text-xs text-slate-400 font-bold">piezas<br />(planeado: {cantidadBase})</span>
              </div>
            </div>
          </div>

          {/* Rechazos con responsable */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">
              Rechazos — asignar responsable
            </label>
            <div className="space-y-3">
              {MOTIVOS.map(m => {
                const r = rechazos[m.id];
                const tieneRechazos = r.cantidad > 0;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-2xl border transition-all",
                      m.bg,
                      tieneRechazos ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                    )}
                  >
                    {/* Fila superior: emoji + nombre + contador */}
                    <div className="flex items-center gap-3 p-3">
                      <span className="text-xl shrink-0">{m.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-black text-sm leading-none", m.color)}>{m.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
                          onClick={() => ajustarRechazo(m.id, -1)} disabled={r.cantidad === 0}>
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <span className={cn("font-black text-lg w-8 text-center", tieneRechazos ? m.color : "text-slate-300")}>
                          {r.cantidad}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
                          onClick={() => ajustarRechazo(m.id, 1)}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Fila inferior: responsable (solo si hay rechazos) */}
                    {tieneRechazos && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {RESPONSABLES.map(resp => (
                            <button
                              key={resp.id}
                              onClick={() => setResponsable(m.id, resp.id)}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all",
                                r.responsable === resp.id
                                  ? resp.color + ' ring-1 ring-current/30'
                                  : 'bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300'
                              )}
                            >
                              {resp.icon} {resp.label}
                            </button>
                          ))}
                        </div>
                        {r.responsable !== 'panaderia' && (
                          <Input
                            placeholder={`Nombre del ${r.responsable === 'panadero' ? 'panadero/obrero' : 'vendedora'}...`}
                            value={r.nombreResponsable}
                            onChange={e => setNombreResponsable(m.id, e.target.value)}
                            className="h-8 text-xs rounded-xl"
                          />
                        )}
                        <p className={cn("text-[10px] font-black", m.color)}>
                          Pérdida: {formatPrice(r.cantidad * precioUnitario)}
                          {r.responsable !== 'panaderia' && ' — a cargo del trabajador'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {hayCritico && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-bold">
                Rechazo alto ({pctRechazo}%). Revisar temperatura del horno y tiempo de fermentación.
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
              Observaciones (opcional)
            </label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: horno demasiado caliente en segunda hornada, fermentación corta..."
              className="rounded-xl text-sm resize-none" rows={2} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline"
            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]"
            onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={guardando || contadoNum <= 0}
            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Aprobar — {aprobados} piezas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
