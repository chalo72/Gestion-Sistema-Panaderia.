import { useMemo, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, Target,
  ChevronDown, ChevronUp, Lightbulb, ShieldCheck, Flame,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, MapPin,
  Truck, Info, Calendar, Clock, Bell, BellRing, Pencil, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Producto, PrecioProveedor } from '@/types';

// ── Reglas de negocio para panadería ──
const REGLAS = {
  BEBIDA_MARGEN_MIN: 50,
  REVENTA_MARGEN_MIN: 30,
  INSUMO_SIN_MARGEN: true,
  GANANCIA_BAJA_LIMITE: 500,  // COP - ganancia por unidad muy baja
  ESTRELLA_MARGEN: 60,        // % para ser producto "estrella"
  ALERTA_MARGEN: 25,          // % para alerta de margen bajo
};

interface ProductoAnalizado {
  nombre: string;
  categoria: string;
  destino: 'venta' | 'insumo';
  costoUnitario: number;
  precioVenta: number;
  gananciaPorUnidad: number;
  margenPorcentaje: number;
  cantidadEmbalaje: number;
  precioCosto: number;
}

interface Recomendacion {
  tipo: 'subir' | 'bajar' | 'mantener' | 'negociar' | 'evaluar';
  prioridad: 'alta' | 'media' | 'baja';
  producto: string;
  mensaje: string;
  explicacion: string;
  precioSugerido?: number;
  impacto?: string;
}

interface ScheduleData {
  frecuenciaDias: number;
  proximaVisita: string; // ISO date YYYY-MM-DD
  diasAviso: number;
}

interface AnalisisInteligenteProps {
  precios: PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  proveedorNombre: string;
  proveedorUbicacion?: string;
  proveedorId: string;
}

// ── Helpers de schedule ──
const SCHEDULE_KEY = (id: string) => `proveedor_visita_${id}`;

function loadSchedule(proveedorId: string): ScheduleData | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY(proveedorId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSchedule(proveedorId: string, data: ScheduleData) {
  try { localStorage.setItem(SCHEDULE_KEY(proveedorId), JSON.stringify(data)); } catch {}
}

function diasHastaFecha(isoDate: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(isoDate + 'T00:00:00');
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
}

function formatearFecha(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// ── Exportar función de utilidad para la página principal ──
export function getScheduleAlerta(proveedorId: string): { diasRestantes: number; proximaVisita: string } | null {
  const s = loadSchedule(proveedorId);
  if (!s?.proximaVisita) return null;
  const dias = diasHastaFecha(s.proximaVisita);
  if (dias <= s.diasAviso) return { diasRestantes: dias, proximaVisita: s.proximaVisita };
  return null;
}

export function AnalisisInteligente({
  precios, getProductoById, formatCurrency, proveedorNombre, proveedorUbicacion, proveedorId
}: AnalisisInteligenteProps) {
  const [expandido, setExpandido] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleData | null>(() => loadSchedule(proveedorId));
  const [editandoSchedule, setEditandoSchedule] = useState(false);
  const [tempFrecuencia, setTempFrecuencia] = useState('7');
  const [tempFecha, setTempFecha] = useState('');
  const [tempDiasAviso, setTempDiasAviso] = useState('2');

  const ubicacion = proveedorUbicacion?.trim() || '';

  // ── Análisis rentabilidad ──
  const analisis = useMemo(() => {
    const productosAnalizados: ProductoAnalizado[] = precios.map(precio => {
      const prod = getProductoById(precio.productoId);
      const cantEmb = precio.cantidadEmbalaje || 1;
      const costoU = precio.precioCosto / cantEmb;
      const pventa = prod?.precioVenta || 0;
      const ganancia = pventa - costoU;
      const margen = costoU > 0 && pventa > 0 ? ((pventa - costoU) / costoU) * 100 : 0;
      return {
        nombre: prod?.nombre || 'Producto',
        categoria: prod?.categoria || '',
        destino: precio.destino || 'insumo',
        costoUnitario: costoU,
        precioVenta: pventa,
        gananciaPorUnidad: ganancia,
        margenPorcentaje: margen,
        cantidadEmbalaje: cantEmb,
        precioCosto: precio.precioCosto,
      };
    });

    const ventas  = productosAnalizados.filter(p => p.destino === 'venta' && p.precioVenta > 0);
    const insumos = productosAnalizados.filter(p => p.destino === 'insumo');

    const margenPromedio = ventas.length > 0
      ? ventas.reduce((sum, p) => sum + p.margenPorcentaje, 0) / ventas.length : 0;

    const inversionTotal = productosAnalizados.reduce((s, p) => s + p.precioCosto, 0);

    // ✅ CORRECCIÓN: ganancia real del ciclo = ganancia/unidad × unidades en el pack
    const gananciaEstimadaTotal = ventas.reduce(
      (s, p) => s + (p.gananciaPorUnidad * p.cantidadEmbalaje), 0
    );

    const roiPorcentaje = inversionTotal > 0
      ? (gananciaEstimadaTotal / inversionTotal) * 100 : 0;

    const estrellas   = ventas.filter(p => p.margenPorcentaje >= REGLAS.ESTRELLA_MARGEN);
    const alertas     = ventas.filter(p => p.margenPorcentaje > 0 && p.margenPorcentaje < REGLAS.ALERTA_MARGEN);
    const gananciaBaja = ventas.filter(p => p.gananciaPorUnidad > 0 && p.gananciaPorUnidad < REGLAS.GANANCIA_BAJA_LIMITE);

    const recomendaciones: Recomendacion[] = [];
    const ubiLabel = ubicacion || 'tu zona';

    ventas.filter(p =>
      p.categoria.toLowerCase().includes('bebida') && p.margenPorcentaje < REGLAS.BEBIDA_MARGEN_MIN
    ).forEach(p => {
      const precioSugerido = Math.round(p.costoUnitario * 1.6 / 100) * 100;
      recomendaciones.push({
        tipo: 'subir', prioridad: 'alta', producto: p.nombre,
        mensaje: `Margen actual: ${p.margenPorcentaje.toFixed(0)}%. En una panadería de ${ubiLabel}, las bebidas frías se venden por impulso — el cliente las agarra del refrigerador sin comparar precio. Puedes cobrar más.`,
        explicacion: `Te cuesta ${formatCurrency(Math.round(p.costoUnitario / 100) * 100)} y lo vendes a ${formatCurrency(p.precioVenta)}. Solo ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por unidad. Si lo subes a ${formatCurrency(precioSugerido)}, ganas ${formatCurrency(precioSugerido - Math.round(p.costoUnitario / 100) * 100)} por cada uno — y el cliente igual lo lleva.`,
        precioSugerido, impacto: `+${formatCurrency(precioSugerido - p.precioVenta)}/unidad`,
      });
    });

    ventas.filter(p =>
      p.margenPorcentaje > 0 && p.margenPorcentaje < REGLAS.REVENTA_MARGEN_MIN &&
      !p.categoria.toLowerCase().includes('bebida')
    ).forEach(p => {
      const precioSugerido = Math.round(p.costoUnitario * 1.4 / 100) * 100;
      recomendaciones.push({
        tipo: 'subir', prioridad: 'media', producto: p.nombre,
        mensaje: `Margen de ${p.margenPorcentaje.toFixed(0)}% es insuficiente. En ${ubiLabel}, para que un producto de reventa valga la pena mantenerlo exhibido, necesitas al menos 30% de margen.`,
        explicacion: `Compras a ${formatCurrency(Math.round(p.costoUnitario / 100) * 100)} y vendes a ${formatCurrency(p.precioVenta)}. Con ${formatCurrency(precioSugerido)} tendrías ~40% de margen, un nivel saludable para cubrir costos fijos y generar ganancia real.`,
        precioSugerido, impacto: `+${formatCurrency(precioSugerido - p.precioVenta)}/unidad`,
      });
    });

    gananciaBaja.forEach(p => {
      recomendaciones.push({
        tipo: 'evaluar', prioridad: 'media', producto: p.nombre,
        mensaje: `Solo ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por cada ${p.nombre} vendido. En ${ubiLabel}, necesitas que cada producto deje por lo menos $500 por unidad para que sea sostenible.`,
        explicacion: `Pregúntate: ¿este producto rota rápido (vendes muchos al día) o es lento? Si rota lento, el espacio en la vitrina lo debería ocupar algo que deje más plata.`,
      });
    });

    insumos.filter(p => p.precioCosto > 50000).forEach(p => {
      recomendaciones.push({
        tipo: 'negociar', prioridad: 'baja', producto: p.nombre,
        mensaje: `Este insumo cuesta ${formatCurrency(p.precioCosto)}. Verifica si otro proveedor de un pueblo vecino o de la capital te ofrece mejor precio por volumen.`,
        explicacion: `Un ahorro del 5-10% en insumos costosos se traduce en ${formatCurrency(Math.round(p.precioCosto * 0.05 / 100) * 100)} a ${formatCurrency(Math.round(p.precioCosto * 0.10 / 100) * 100)} de ahorro por compra.`,
      });
    });

    estrellas.forEach(p => {
      recomendaciones.push({
        tipo: 'mantener', prioridad: 'baja', producto: p.nombre,
        mensaje: `¡Producto estrella con ${p.margenPorcentaje.toFixed(0)}% de margen! Ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por cada unidad vendida.`,
        explicacion: `Nunca te quedes sin stock de este producto. Si puedes negociar mayor volumen a menor costo, tu margen sube aún más.`,
      });
    });

    const prioridadOrden = { alta: 0, media: 1, baja: 2 };
    recomendaciones.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    let saludGeneral: 'excelente' | 'buena' | 'regular' | 'critica';
    if (margenPromedio >= 50) saludGeneral = 'excelente';
    else if (margenPromedio >= 35) saludGeneral = 'buena';
    else if (margenPromedio >= 20) saludGeneral = 'regular';
    else saludGeneral = 'critica';

    const totalProductos = productosAnalizados.length;
    const resumenParts: string[] = [];
    if (ubicacion) resumenParts.push(`📍 ${proveedorNombre} opera desde ${ubicacion}.`);
    resumenParts.push(`Te suministra ${totalProductos} producto${totalProductos > 1 ? 's' : ''}: ${ventas.length} para reventa directa y ${insumos.length} insumo${insumos.length !== 1 ? 's' : ''} de producción.`);

    if (ventas.length > 0) {
      if (saludGeneral === 'excelente') resumenParts.push(`Tu margen promedio es ${margenPromedio.toFixed(0)}% — excelente. Estás ganando bien con lo que compras a este aliado.`);
      else if (saludGeneral === 'buena') resumenParts.push(`Tu margen promedio es ${margenPromedio.toFixed(0)}% — aceptable, pero hay oportunidad de mejorar ajustando algunos precios.`);
      else if (saludGeneral === 'regular') resumenParts.push(`⚠️ Tu margen promedio es solo ${margenPromedio.toFixed(0)}%. Revisa las recomendaciones abajo.`);
      else resumenParts.push(`🚨 Margen promedio de ${margenPromedio.toFixed(0)}% es crítico. Necesitas subir precios o negociar mejores costos.`);
    }

    if (estrellas.length > 0) {
      resumenParts.push(`⭐ Estrellas: ${estrellas.slice(0, 3).map(e => e.nombre).join(', ')}${estrellas.length > 3 ? ` y ${estrellas.length - 3} más` : ''}.`);
    }
    if (alertas.length > 0) resumenParts.push(`⚠️ ${alertas.length} producto${alertas.length > 1 ? 's tienen' : ' tiene'} margen por debajo del 25%.`);

    if (inversionTotal > 0) {
      resumenParts.push(`💰 Inversión total por ciclo de compra: ${formatCurrency(Math.round(inversionTotal / 100) * 100)}.`);
      if (gananciaEstimadaTotal > 0) {
        resumenParts.push(`Si vendes todo, recuperas la inversión + ${formatCurrency(Math.round(gananciaEstimadaTotal / 100) * 100)} de ganancia bruta (ROI ${roiPorcentaje.toFixed(0)}%).`);
      }
    }

    return {
      productosAnalizados, ventas, insumos, margenPromedio,
      inversionTotal, gananciaEstimadaTotal, roiPorcentaje,
      estrellas, alertas, gananciaBaja, recomendaciones,
      saludGeneral, resumenEjecutivo: resumenParts.join(' '),
    };
  }, [precios, getProductoById, formatCurrency, ubicacion, proveedorNombre]);

  // ── Schedule helpers ──
  const diasRestantes = schedule?.proximaVisita ? diasHastaFecha(schedule.proximaVisita) : null;
  const alertaVisita = diasRestantes !== null && diasRestantes <= (schedule?.diasAviso ?? 2);

  const abrirEdicionSchedule = useCallback(() => {
    setTempFrecuencia(String(schedule?.frecuenciaDias ?? 7));
    setTempDiasAviso(String(schedule?.diasAviso ?? 2));
    if (schedule?.proximaVisita) {
      setTempFecha(schedule.proximaVisita);
    } else {
      // Sugerir próxima visita en X días
      const d = new Date();
      d.setDate(d.getDate() + (schedule?.frecuenciaDias ?? 7));
      setTempFecha(d.toISOString().slice(0, 10));
    }
    setEditandoSchedule(true);
  }, [schedule]);

  const guardarSchedule = useCallback(() => {
    const frec = parseInt(tempFrecuencia) || 7;
    const aviso = parseInt(tempDiasAviso) || 2;
    const data: ScheduleData = {
      frecuenciaDias: frec,
      proximaVisita: tempFecha,
      diasAviso: aviso,
    };
    saveSchedule(proveedorId, data);
    setSchedule(data);
    setEditandoSchedule(false);
  }, [tempFrecuencia, tempFecha, tempDiasAviso, proveedorId]);

  const avanzarVisita = useCallback(() => {
    if (!schedule) return;
    const base = schedule.proximaVisita
      ? new Date(schedule.proximaVisita + 'T00:00:00')
      : new Date();
    base.setDate(base.getDate() + schedule.frecuenciaDias);
    const data = { ...schedule, proximaVisita: base.toISOString().slice(0, 10) };
    saveSchedule(proveedorId, data);
    setSchedule(data);
  }, [schedule, proveedorId]);

  if (precios.length === 0) return null;

  const saludConfig = {
    excelente: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: ShieldCheck, label: 'Excelente', emoji: '🔥' },
    buena:     { color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: TrendingUp,  label: 'Buena',     emoji: '✅' },
    regular:   { color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: AlertTriangle, label: 'Regular', emoji: '⚠️' },
    critica:   { color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',         icon: TrendingDown, label: 'Crítica',  emoji: '🚨' },
  };
  const salud = saludConfig[analisis.saludGeneral];
  const SaludIcon = salud.icon;
  const recsAltas  = analisis.recomendaciones.filter(r => r.prioridad === 'alta');
  const recsMedias = analisis.recomendaciones.filter(r => r.prioridad === 'media');
  const recsBajas  = analisis.recomendaciones.filter(r => r.prioridad === 'baja');

  // Color de alerta de visita según días restantes
  const visitaColor = diasRestantes === null ? 'slate'
    : diasRestantes <= 0 ? 'red'
    : diasRestantes <= 1 ? 'red'
    : diasRestantes <= (schedule?.diasAviso ?? 2) ? 'amber'
    : diasRestantes <= 5 ? 'yellow'
    : 'emerald';

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

      {/* ── SECCIÓN PERMANENTE: Programación de Visita del Preventista ── */}
      <div className={cn(
        'px-5 py-3 border-b border-slate-100 dark:border-slate-800',
        alertaVisita
          ? 'bg-amber-50 dark:bg-amber-950/20'
          : 'bg-slate-50/60 dark:bg-slate-900/40'
      )}>
        {!editandoSchedule ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
              alertaVisita ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            )}>
              {alertaVisita ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                Visita del preventista
              </p>
              {schedule?.proximaVisita ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn(
                    'text-xs font-black',
                    visitaColor === 'red'    ? 'text-red-600' :
                    visitaColor === 'amber'  ? 'text-amber-600' :
                    visitaColor === 'yellow' ? 'text-yellow-600' :
                    'text-emerald-600'
                  )}>
                    {diasRestantes === 0 ? '🚨 ¡HOY llega el preventista!' :
                     diasRestantes === 1 ? '🔔 Mañana llega — prepara el pedido' :
                     diasRestantes !== null && diasRestantes < 0 ? `⏰ Venció hace ${Math.abs(diasRestantes)} día(s) — actualiza la fecha` :
                     `📅 ${formatearFecha(schedule.proximaVisita)}`}
                  </span>
                  {diasRestantes !== null && diasRestantes > 0 && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      ({diasRestantes} día{diasRestantes !== 1 ? 's' : ''} · cada {schedule.frecuenciaDias}d)
                    </span>
                  )}
                  {alertaVisita && diasRestantes !== null && diasRestantes >= 0 && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                      ¡Prepara el prepedido!
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Sin fecha programada — configura la visita para recibir alertas</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {schedule?.proximaVisita && diasRestantes !== null && diasRestantes <= 1 && (
                <button
                  onClick={avanzarVisita}
                  className="h-7 px-2.5 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-colors"
                  title="Marcar visita como realizada y programar la siguiente"
                >
                  <Check className="w-3 h-3" /> Visita realizada
                </button>
              )}
              <button
                onClick={abrirEdicionSchedule}
                className="h-7 w-7 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Configurar programación"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        ) : (
          /* ── Editor de schedule ── */
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Configurar visita del preventista</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Próxima visita</label>
                <input
                  type="date"
                  value={tempFecha}
                  onChange={e => setTempFecha(e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Frecuencia (días)</label>
                <input
                  type="number"
                  min={1} max={90}
                  value={tempFrecuencia}
                  onChange={e => setTempFrecuencia(e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="7 = semanal"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Avisar con (días)</label>
                <input
                  type="number"
                  min={1} max={7}
                  value={tempDiasAviso}
                  onChange={e => setTempDiasAviso(e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={guardarSchedule}
                className="h-8 px-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black transition-colors"
              >
                <Check className="w-3 h-3" /> Guardar
              </button>
              <button
                onClick={() => setEditandoSchedule(false)}
                className="h-8 px-3 flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg text-[10px] font-black transition-colors hover:bg-slate-50"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Header: click para expandir análisis ── */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 hover:from-indigo-100 hover:via-purple-100 hover:to-pink-100 dark:hover:from-indigo-900/40 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-800 dark:text-white">Asistente de Negocio</p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Análisis inteligente de rentabilidad</p>
              {ubicacion && (
                <span className="text-[9px] font-bold text-indigo-500 flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" /> {ubicacion}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl', salud.bg)}>
            <SaludIcon className={cn('w-4 h-4', salud.color)} />
            <span className={cn('text-xs font-black', salud.color)}>{salud.emoji} {salud.label}</span>
          </div>
          {recsAltas.length > 0 && (
            <Badge className="bg-red-100 text-red-600 border-none text-[10px] font-black">
              {recsAltas.length} urgente{recsAltas.length > 1 ? 's' : ''}
            </Badge>
          )}
          {expandido ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {/* ── Contenido expandido ── */}
      {expandido && (
        <div className="px-6 py-5 space-y-5 bg-white/50 dark:bg-slate-900/50">

          {/* Resumen ejecutivo */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-800/40 dark:to-blue-950/20 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1.5">
                  {ubicacion ? `📍 Proveedor en ${ubicacion}` : '📋 Resumen Ejecutivo'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{analisis.resumenEjecutivo}</p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={BarChart3}
              label="Margen Promedio"
              value={`${analisis.margenPromedio.toFixed(0)}%`}
              color={analisis.margenPromedio >= 40 ? 'emerald' : analisis.margenPromedio >= 25 ? 'amber' : 'red'}
              sub={`En ${analisis.ventas.length} producto${analisis.ventas.length !== 1 ? 's' : ''} de venta`}
              tooltip="Margen promedio de todos los productos de venta directa"
            />
            <KpiCard
              icon={DollarSign}
              label="Inversión x Ciclo"
              value={formatCurrency(analisis.inversionTotal)}
              color="blue"
              sub="Lo que pagas por todo el pedido"
              tooltip="Total invertido comprando todos los productos de este proveedor en una visita"
            />
            <KpiCard
              icon={TrendingUp}
              label="Ganancia x Ciclo"
              value={formatCurrency(Math.round(analisis.gananciaEstimadaTotal / 100) * 100)}
              color={analisis.gananciaEstimadaTotal > 0 ? 'emerald' : 'red'}
              sub={`ROI ${analisis.roiPorcentaje.toFixed(0)}% si vendes todo`}
              tooltip="Ganancia real si vendes TODAS las unidades compradas. Incluye cantidades por pack/paca."
            />
            <KpiCard
              icon={Flame}
              label="Estrellas / Alertas"
              value={`${analisis.estrellas.length} / ${analisis.alertas.length + analisis.gananciaBaja.length}`}
              color={analisis.alertas.length > 0 ? 'amber' : 'purple'}
              sub="Buenos / Requieren atención"
              tooltip="Estrellas: margen ≥60%. Alertas: margen <25% o ganancia <$500/unidad"
            />
          </div>

          {/* Tabla de rentabilidad */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Ranking de Rentabilidad</p>
            <p className="text-[10px] text-slate-400 mb-3">
              Ordenados de mayor a menor ganancia porcentual. Los de arriba son los que más plata dejan por unidad vendida.
            </p>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="col-span-4">Producto</div>
                <div className="col-span-1 text-center">Und</div>
                <div className="col-span-2 text-right">Costo/u</div>
                <div className="col-span-2 text-right">Venta/u</div>
                <div className="col-span-2 text-right">Gan. Ciclo</div>
                <div className="col-span-1 text-center">%</div>
              </div>
              {[...analisis.ventas]
                .sort((a, b) => b.margenPorcentaje - a.margenPorcentaje)
                .map((p, i) => {
                  const margenColor = p.margenPorcentaje >= 60 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                    p.margenPorcentaje >= 35 ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                    p.margenPorcentaje >= 20 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                    'text-red-600 bg-red-50 dark:bg-red-900/20';
                  const gananciaCiclo = p.gananciaPorUnidad * p.cantidadEmbalaje;
                  return (
                    <div key={i} className={cn(
                      'grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs',
                      i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30',
                    )}>
                      <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                        {p.margenPorcentaje >= REGLAS.ESTRELLA_MARGEN && <span>⭐</span>}
                        {p.margenPorcentaje < REGLAS.ALERTA_MARGEN && p.margenPorcentaje > 0 && <span>⚠️</span>}
                        {p.margenPorcentaje >= REGLAS.ALERTA_MARGEN && p.margenPorcentaje < REGLAS.ESTRELLA_MARGEN && <span>✅</span>}
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{p.nombre}</span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-[9px] font-black text-violet-500 bg-violet-50 dark:bg-violet-900/20 px-1 py-0.5 rounded">
                          ×{p.cantidadEmbalaje}
                        </span>
                      </div>
                      <div className="col-span-2 text-right font-bold text-slate-500 tabular-nums">
                        {formatCurrency(Math.round(p.costoUnitario / 100) * 100)}
                      </div>
                      <div className="col-span-2 text-right font-black text-emerald-600 tabular-nums">
                        {formatCurrency(p.precioVenta)}
                      </div>
                      <div className="col-span-2 text-right font-black text-amber-500 tabular-nums text-[10px]">
                        +{formatCurrency(Math.round(gananciaCiclo / 100) * 100)}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-lg', margenColor)}>
                          {p.margenPorcentaje.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              {analisis.ventas.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Sin productos de venta para analizar</p>
              )}
            </div>
            {/* Totales del ciclo */}
            {analisis.ventas.length > 0 && (
              <div className="mt-2 flex justify-end gap-6 px-4 py-2 bg-gradient-to-r from-slate-50 to-emerald-50/40 dark:from-slate-800 dark:to-emerald-900/10 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-400">Inversión total</p>
                  <p className="font-black text-blue-600 tabular-nums">{formatCurrency(Math.round(analisis.inversionTotal / 100) * 100)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-400">Ganancia si vendes todo</p>
                  <p className="font-black text-emerald-600 tabular-nums">+{formatCurrency(Math.round(analisis.gananciaEstimadaTotal / 100) * 100)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-400">ROI del ciclo</p>
                  <p className={cn('font-black tabular-nums', analisis.roiPorcentaje >= 30 ? 'text-emerald-600' : 'text-amber-600')}>
                    {analisis.roiPorcentaje.toFixed(0)}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Insumos */}
          {analisis.insumos.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">🏭 Insumos de Producción</p>
              <p className="text-[10px] text-slate-400 mb-3">
                Estos se usan para elaborar tus productos. Su costo impacta el precio final de lo que produces.
                {ubicacion ? ` Comprados a ${proveedorNombre} en ${ubicacion}.` : ''}
              </p>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                {analisis.insumos.map((p, i) => (
                  <div key={i} className={cn(
                    'flex items-center justify-between px-4 py-2.5 text-xs',
                    i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30',
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span>🏭</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{p.nombre}</span>
                      {p.cantidadEmbalaje > 1 && (
                        <span className="text-[9px] text-slate-400 font-bold">({p.cantidadEmbalaje} und)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-bold text-slate-500 tabular-nums">{formatCurrency(p.precioCosto)}</span>
                      {p.cantidadEmbalaje > 1 && (
                        <span className="text-[10px] text-indigo-500 font-black tabular-nums">
                          P.U. {formatCurrency(Math.round(p.costoUnitario / 100) * 100)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {analisis.recomendaciones.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                💡 Recomendaciones ({analisis.recomendaciones.length})
              </p>
              <p className="text-[10px] text-slate-400 mb-3">
                Sugerencias basadas en tus márgenes{ubicacion ? ` y la ubicación del proveedor en ${ubicacion}` : ''}.
              </p>
              <div className="space-y-2">
                {[...recsAltas, ...recsMedias, ...recsBajas].map((rec, i) => (
                  <RecCard key={i} rec={rec} formatCurrency={formatCurrency} />
                ))}
              </div>
            </div>
          )}

          {/* Reglas de negocio */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">📏 Reglas de negocio activas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <p>🥤 Bebidas: mínimo <b className="text-indigo-600">{REGLAS.BEBIDA_MARGEN_MIN}%</b></p>
              <p>🛒 Reventa: mínimo <b className="text-indigo-600">{REGLAS.REVENTA_MARGEN_MIN}%</b></p>
              <p>⭐ Estrella: desde <b className="text-indigo-600">{REGLAS.ESTRELLA_MARGEN}%</b></p>
              <p>🏭 Insumos: buscar <b className="text-indigo-600">menor precio</b></p>
            </div>
          </div>

          {ubicacion && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30">
              <Truck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                <b>{proveedorNombre}</b> opera desde <b>{ubicacion}</b>. Proveedores locales o cercanos reducen costos de transporte y permiten pedir con más frecuencia.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componentes internos ──

function KpiCard({ icon: Icon, label, value, color, sub, tooltip }: {
  icon: any; label: string; value: string; color: string; sub: string; tooltip?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    blue:    'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    purple:  'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    amber:   'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    red:     'text-red-600 bg-red-50 dark:bg-red-900/20',
    slate:   'text-slate-500 bg-slate-50 dark:bg-slate-800',
  };
  return (
    <div className={cn('rounded-xl p-3 border border-slate-100 dark:border-slate-800', colorMap[color] || colorMap.slate)} title={tooltip}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
      </div>
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="text-[9px] font-bold opacity-50">{sub}</p>
    </div>
  );
}

function RecCard({ rec, formatCurrency }: { rec: Recomendacion; formatCurrency: (v: number) => string }) {
  const [verMas, setVerMas] = useState(false);
  const tipoConfig = {
    subir:    { icon: ArrowUpRight,   bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30',       iconColor: 'text-red-500' },
    bajar:    { icon: ArrowDownRight, bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',    iconColor: 'text-blue-500' },
    mantener: { icon: ShieldCheck,    bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30', iconColor: 'text-emerald-500' },
    negociar: { icon: Target,         bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30', iconColor: 'text-amber-500' },
    evaluar:  { icon: Zap,            bg: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30', iconColor: 'text-purple-500' },
  };
  const config = tipoConfig[rec.tipo];
  const RecIcon = config.icon;
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border', config.bg)}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/60 dark:bg-slate-900/40">
        <RecIcon className={cn('w-4 h-4', config.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{rec.producto}</p>
          <Badge className={cn(
            'text-[8px] font-black border-none px-1.5',
            rec.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
            rec.prioridad === 'media' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
          )}>
            {rec.prioridad}
          </Badge>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{rec.mensaje}</p>
        {rec.explicacion && (
          <button onClick={() => setVerMas(!verMas)} className="text-[10px] font-black text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1">
            {verMas ? 'Ver menos' : '¿Por qué?'}
            {verMas ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        {verMas && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
            {rec.explicacion}
          </p>
        )}
        {rec.precioSugerido && (
          <p className="text-[10px] font-black text-indigo-600 mt-1">
            💰 Precio sugerido: {formatCurrency(rec.precioSugerido)} {rec.impacto && `(${rec.impacto})`}
          </p>
        )}
      </div>
    </div>
  );
}
