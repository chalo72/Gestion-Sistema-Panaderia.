import React, { useState } from 'react';
import {
  ArrowDownUp, AlertTriangle, Clock, CheckCircle2,
  SkipForward, Truck, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLotesStock, calcularEstadoLote, calcularEdadHoras } from '@/hooks/useLotesStock';
import type { LoteStock } from '@/types';

type EstadoLoteColor = 'fresco' | 'alerta' | 'urgente' | 'vencido';

const ESTADO_CONFIG: Record<EstadoLoteColor, { label: string; color: string; bg: string; borde: string; icono: string }> = {
  fresco:   { label: 'Fresco',         color: 'text-emerald-700', bg: 'bg-emerald-50',  borde: 'border-emerald-200', icono: '✅' },
  alerta:   { label: 'Vender pronto',  color: 'text-amber-700',   bg: 'bg-amber-50',    borde: 'border-amber-300',   icono: '⚠️' },
  urgente:  { label: 'Urgente',        color: 'text-orange-700',  bg: 'bg-orange-50',   borde: 'border-orange-400',  icono: '🔴' },
  vencido:  { label: 'Vencido',        color: 'text-rose-700',    bg: 'bg-rose-50',     borde: 'border-rose-500',    icono: '❌' },
};

function formatHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${Math.round(horas)}h`;
  return `${Math.floor(horas / 24)}d ${Math.round(horas % 24)}h`;
}

interface TarjetaLoteProps {
  lote: LoteStock;
  onDespachar: (loteId: string, cantidad: number, nombre: string) => void;
  onMarcarVencido: (loteId: string) => void;
  formatCurrency: (v: number) => string;
}

function TarjetaLote({ lote, onDespachar, onMarcarVencido, formatCurrency }: TarjetaLoteProps) {
  const [cantidad, setCantidad] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [expandido, setExpandido] = useState(false);

  const estado = calcularEstadoLote(lote);
  const cfg = ESTADO_CONFIG[estado];
  const horas = calcularEdadHoras(lote.fechaProduccion);
  const pctDisponible = Math.round((lote.cantidadDisponible / lote.cantidadInicial) * 100);

  const handleDespachar = () => {
    const cant = parseInt(cantidad, 10);
    if (!cant || cant <= 0 || cant > lote.cantidadDisponible) {
      toast.error('Cantidad inválida');
      return;
    }
    if (!nombre.trim()) {
      toast.error('Ingresa el nombre de quien despacha');
      return;
    }
    onDespachar(lote.id, cant, nombre.trim());
    setCantidad('');
    toast.success(`✅ ${cant} piezas despachadas a venta`);
  };

  return (
    <Card className={cn(
      'rounded-2xl border-2 transition-all shadow-sm',
      cfg.borde, cfg.bg,
      estado === 'urgente' && 'animate-pulse-border',
      estado === 'vencido' && 'opacity-75'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{cfg.icono}</span>
              <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">
                {lote.modeloNombre}
              </p>
              <Badge className={cn("text-[8px] font-black border", cfg.color, cfg.bg, cfg.borde)}>
                {cfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatHoras(horas)} en vitrina
              </span>
              <span>·</span>
              <span>{lote.cantidadDisponible} / {lote.cantidadInicial} disponibles</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-lg text-slate-900 dark:text-white">{lote.cantidadDisponible}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">piezas</p>
          </div>
        </div>

        {/* Barra de progreso disponible */}
        <div className="space-y-1">
          <div className="h-2 bg-white/60 rounded-full overflow-hidden border border-current/10">
            <div
              className={cn("h-full rounded-full transition-all", cfg.color.replace('text-', 'bg-').replace('-700', '-500').replace('-600', '-500'))}
              style={{ width: `${pctDisponible}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-black text-slate-400">
            <span>Producción: {new Date(lote.fechaProduccion).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
            <span>{pctDisponible}% sin despachar</span>
          </div>
        </div>

        {/* Advertencia FIFO si no es el más viejo */}
        {estado === 'vencido' ? (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-100 border border-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="text-xs text-rose-700 font-bold">Lote vencido — registrar como pérdida</p>
            <Button size="sm" variant="outline"
              onClick={() => onMarcarVencido(lote.id)}
              className="ml-auto h-7 text-[9px] font-black rounded-lg border-rose-300 text-rose-600 hover:bg-rose-100">
              Registrar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(estado === 'alerta' || estado === 'urgente') && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-amber-100 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-bold">
                  Verificar que este lote esté <strong>adelante en vitrina</strong> y el más nuevo atrás (FIFO).
                  {estado === 'urgente' && ' ¡Debe venderse hoy!'}
                </p>
              </div>
            )}

            {/* Despacho */}
            <div className="flex gap-2 items-center">
              <Input
                type="number" min="1" max={lote.cantidadDisponible}
                placeholder="Cant."
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="h-9 w-20 rounded-xl text-sm text-center font-black"
              />
              <Input
                placeholder="Quien despacha..."
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-9 flex-1 rounded-xl text-sm"
              />
              <Button size="sm" onClick={handleDespachar}
                className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1 shrink-0">
                <Truck className="w-3.5 h-3.5" /> Despachar
              </Button>
            </div>
          </div>
        )}

        {/* Historial de despachos (colapsable) */}
        {lote.despachos.length > 0 && (
          <div>
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-[10px] font-black text-slate-400 uppercase tracking-wider hover:text-slate-600"
            >
              {expandido ? '▲' : '▼'} {lote.despachos.length} despacho{lote.despachos.length !== 1 ? 's' : ''}
            </button>
            {expandido && (
              <div className="mt-2 space-y-1">
                {lote.despachos.map(d => (
                  <div key={d.id} className="flex justify-between text-[10px] text-slate-500">
                    <span>{new Date(d.fecha).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} · {d.usuarioNombre}</span>
                    <span className="font-black">{d.cantidad} pzas</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Props {
  formatCurrency: (v: number) => string;
}

export function RotacionBreadView({ formatCurrency }: Props) {
  const { lotes, lotesDisponibles, lotesConProblema, despacharLote, marcarVencido } = useLotesStock();

  const lotesVencidos = lotes.filter(l => l.estado === 'vencido' ||
    (l.estado === 'disponible' && calcularEstadoLote(l) === 'vencido'));
  const lotesDespachados = lotes.filter(l => l.estado === 'despachado');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <ArrowDownUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Rotación FIFO</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            Lo más viejo, adelante · Lo más nuevo, atrás · Controla el moho antes de que llegue
          </p>
        </div>
      </div>

      {/* Alerta general si hay lotes con problema */}
      {lotesConProblema.length > 0 && (
        <Card className="rounded-2xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/20 shadow-md">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-rose-800 text-sm uppercase tracking-wide">
                ⚠️ {lotesConProblema.length} lote{lotesConProblema.length !== 1 ? 's' : ''} requiere atención inmediata
              </p>
              <p className="text-xs text-rose-700 mt-1">
                Verificar que están adelante en vitrina. Si no se venden hoy, se generará moho y la responsabilidad recae en la vendedora de turno.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-2xl font-black text-indigo-600">{lotesDisponibles.length}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lotes en vitrina</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center border border-rose-200 shadow-sm">
          <p className="text-2xl font-black text-rose-600">{lotesConProblema.length}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Requieren atención</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-2xl font-black text-emerald-600">{lotesDespachados.length}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Despachados hoy</p>
        </div>
      </div>

      {/* Regla FIFO */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
        <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-black text-indigo-800 dark:text-indigo-300 text-sm">Regla de Vitrina: Primero en entrar, primero en salir</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
            Los panes más viejos deben estar siempre <strong>al frente de la vitrina</strong>. Los nuevos, atrás.
            Si se encuentra pan viejo atrás y pan nuevo adelante, la vendedora es responsable del pan que se dañe.
          </p>
        </div>
      </div>

      {/* Lista de lotes disponibles */}
      {lotesDisponibles.length === 0 ? (
        <Card className="border-dashed border-2 rounded-2xl">
          <CardContent className="py-16 text-center">
            <ArrowDownUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-sm">No hay lotes en vitrina</p>
            <p className="text-xs text-slate-400 mt-1">
              Los lotes aparecen aquí después de hacer el Control de Calidad
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Ordenados por antigüedad — el primero es el más viejo (debe estar al frente)
          </p>
          {lotesDisponibles.map((lote, idx) => (
            <div key={lote.id} className="flex gap-3 items-start">
              <div className={cn(
                "w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-1",
                idx === 0 ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {idx + 1}
              </div>
              <div className="flex-1">
                <TarjetaLote
                  lote={lote}
                  onDespachar={despacharLote}
                  onMarcarVencido={marcarVencido}
                  formatCurrency={formatCurrency}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
