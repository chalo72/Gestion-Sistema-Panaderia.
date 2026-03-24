// Componente de Vigilancia IA — Motor de análisis local de seguridad
// Panadería Dulce Placer · Sin envío de datos a servidores externos

import { useMemo } from 'react';
import {
  AlertTriangle,
  Shield,
  Eye,
  TrendingDown,
  TrendingUp,
  User,
  Clock,
  DollarSign,
  Zap,
  CheckCircle,
  XCircle,
  Activity,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CajaSesion, Venta, MovimientoCaja } from '@/types';

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface AlertaVigilancia {
  nivel: 'critica' | 'alta' | 'media' | 'info';
  tipo: 'robo' | 'vuelto' | 'no-registro' | 'patron' | 'anomalia' | 'ok';
  caja: string;
  vendedora: string;
  mensaje: string;
  detalle: string;
  monto?: number;
  icono: string;
}

interface MetricaSesion {
  sesionId: string;
  cajaNombre: string;
  vendedoraNombre: string;
  efectivoEsperado: number;
  montoCierre: number;
  diferencia: number;
  pctDescuadre: number;
  ventasEfectivo: number;
  totalEntradas: number;
  totalSalidas: number;
  cerrada: boolean;
}

interface ResumenVigilancia {
  totalSesiones: number;
  sesionesCriticas: number;
  totalFaltante: number;
  vendedoraConMasFaltantes: string;
  puntajeConfianza: number;
}

// ============================================================
// PROPS
// ============================================================

interface VigilianciaIAProps {
  sesiones: CajaSesion[];
  ventas: Venta[];
  formatCurrency: (v: number) => string;
}

// ============================================================
// HELPERS DE UI
// ============================================================

function colorNivel(nivel: AlertaVigilancia['nivel']): string {
  switch (nivel) {
    case 'critica': return 'border-red-500';
    case 'alta':    return 'border-orange-500';
    case 'media':   return 'border-yellow-500';
    case 'info':    return 'border-blue-400';
  }
}

function bgNivel(nivel: AlertaVigilancia['nivel']): string {
  switch (nivel) {
    case 'critica': return 'bg-red-50 dark:bg-red-950/30';
    case 'alta':    return 'bg-orange-50 dark:bg-orange-950/30';
    case 'media':   return 'bg-yellow-50 dark:bg-yellow-950/30';
    case 'info':    return 'bg-blue-50 dark:bg-blue-950/30';
  }
}

function badgeNivel(nivel: AlertaVigilancia['nivel']): string {
  switch (nivel) {
    case 'critica': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    case 'alta':    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
    case 'media':   return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'info':    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  }
}

function etiquetaNivel(nivel: AlertaVigilancia['nivel']): string {
  switch (nivel) {
    case 'critica': return 'CRÍTICA';
    case 'alta':    return 'ALTA';
    case 'media':   return 'MEDIA';
    case 'info':    return 'INFO';
  }
}

function colorPuntaje(puntaje: number): string {
  if (puntaje >= 80) return 'text-emerald-500';
  if (puntaje >= 60) return 'text-yellow-500';
  if (puntaje >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function ringPuntaje(puntaje: number): string {
  if (puntaje >= 80) return 'ring-emerald-400';
  if (puntaje >= 60) return 'ring-yellow-400';
  if (puntaje >= 40) return 'ring-orange-400';
  return 'ring-red-400';
}

function etiquetaPuntaje(puntaje: number): string {
  if (puntaje >= 80) return 'Todo en orden';
  if (puntaje >= 60) return 'Requiere atención';
  if (puntaje >= 40) return 'Alerta activa';
  return 'Estado crítico';
}

// ============================================================
// MOTOR DE ANÁLISIS
// ============================================================

function analizarVigilancia(
  sesiones: CajaSesion[],
  ventas: Venta[],
): { alertas: AlertaVigilancia[]; metricas: MetricaSesion[]; resumen: ResumenVigilancia } {

  // --- Calcular métricas por sesión ---
  const metricas: MetricaSesion[] = sesiones.map((sesion) => {
    const cajaNombre    = sesion.cajaNombre     ?? `Caja ${sesion.id.slice(0, 6)}`;
    const vendedoraNombre = sesion.vendedoraNombre ?? 'Sin asignar';

    // Ventas en efectivo para esta caja
    const ventasEfectivo = ventas
      .filter((v) => v.cajaId === sesion.id && v.metodoPago === 'efectivo')
      .reduce((acc, v) => acc + v.total, 0);

    // Movimientos de la sesión
    const movimientos: MovimientoCaja[] = sesion.movimientos ?? [];
    const totalEntradas = movimientos
      .filter((m) => m.tipo === 'entrada')
      .reduce((acc, m) => acc + m.monto, 0);
    const totalSalidas = movimientos
      .filter((m) => m.tipo === 'salida')
      .reduce((acc, m) => acc + m.monto, 0);

    const efectivoEsperado = sesion.montoApertura + ventasEfectivo + totalEntradas - totalSalidas;
    const cerrada          = sesion.estado === 'cerrada';
    const montoCierre      = sesion.montoCierre ?? 0;
    const diferencia       = cerrada ? montoCierre - efectivoEsperado : 0;
    const pctDescuadre     = efectivoEsperado !== 0
      ? (Math.abs(diferencia) / efectivoEsperado) * 100
      : 0;

    return {
      sesionId: sesion.id,
      cajaNombre,
      vendedoraNombre,
      efectivoEsperado,
      montoCierre,
      diferencia,
      pctDescuadre,
      ventasEfectivo,
      totalEntradas,
      totalSalidas,
      cerrada,
    };
  });

  // --- Mapa de faltantes por vendedora (para detección de patrón) ---
  const faltantesPorVendedora: Record<string, number> = {};
  for (const m of metricas) {
    if (!m.cerrada) continue;
    if (m.diferencia < -1000) {
      faltantesPorVendedora[m.vendedoraNombre] =
        (faltantesPorVendedora[m.vendedoraNombre] ?? 0) + 1;
    }
  }

  // --- Generar alertas ---
  const alertas: AlertaVigilancia[] = [];
  const patronesYaRegistrados = new Set<string>();

  for (const sesion of sesiones) {
    const m = metricas.find((x) => x.sesionId === sesion.id)!;

    // Alertas de descuadre (solo sesiones cerradas)
    if (m.cerrada) {
      if (m.diferencia < -10000) {
        alertas.push({
          nivel: 'critica',
          tipo: 'robo',
          caja: m.cajaNombre,
          vendedora: m.vendedoraNombre,
          mensaje: '⚠️ FALTANTE CRÍTICO — posible sustracción de efectivo',
          detalle: `Esperado: ${m.efectivoEsperado.toFixed(0)} · Cierre: ${m.montoCierre.toFixed(0)} · Descuadre: ${m.pctDescuadre.toFixed(1)}%`,
          monto: m.diferencia,
          icono: 'alert-triangle',
        });
      } else if (m.diferencia < -3000) {
        alertas.push({
          nivel: 'alta',
          tipo: 'vuelto',
          caja: m.cajaNombre,
          vendedora: m.vendedoraNombre,
          mensaje: 'Faltante significativo — posible vuelto incorrecto',
          detalle: `Diferencia de ${Math.abs(m.diferencia).toFixed(0)} · Descuadre: ${m.pctDescuadre.toFixed(1)}%`,
          monto: m.diferencia,
          icono: 'trending-down',
        });
      } else if (m.diferencia < -500) {
        alertas.push({
          nivel: 'media',
          tipo: 'anomalia',
          caja: m.cajaNombre,
          vendedora: m.vendedoraNombre,
          mensaje: 'Faltante menor — verificar vueltos dados',
          detalle: `Diferencia de ${Math.abs(m.diferencia).toFixed(0)} · Descuadre: ${m.pctDescuadre.toFixed(1)}%`,
          monto: m.diferencia,
          icono: 'eye',
        });
      } else if (m.diferencia > 5000) {
        alertas.push({
          nivel: 'media',
          tipo: 'no-registro',
          caja: m.cajaNombre,
          vendedora: m.vendedoraNombre,
          mensaje: 'Sobrante alto — posible no registro de venta',
          detalle: `Sobrante de ${m.diferencia.toFixed(0)} sobre lo esperado`,
          monto: m.diferencia,
          icono: 'trending-up',
        });
      } else {
        alertas.push({
          nivel: 'info',
          tipo: 'ok',
          caja: m.cajaNombre,
          vendedora: m.vendedoraNombre,
          mensaje: 'Sin anomalías detectadas',
          detalle: `Cuadre correcto · Diferencia: ${m.diferencia.toFixed(0)}`,
          monto: m.diferencia,
          icono: 'check-circle',
        });
      }

      // Patrón repetido por vendedora
      const conteo = faltantesPorVendedora[m.vendedoraNombre] ?? 0;
      if (conteo >= 2 && !patronesYaRegistrados.has(m.vendedoraNombre)) {
        patronesYaRegistrados.add(m.vendedoraNombre);
        alertas.push({
          nivel: 'alta',
          tipo: 'patron',
          caja: 'Múltiples cajas',
          vendedora: m.vendedoraNombre,
          mensaje: 'PATRÓN REPETIDO — misma vendedora con faltantes frecuentes',
          detalle: `${conteo} sesiones con faltante > $1.000 para ${m.vendedoraNombre}`,
          icono: 'activity',
        });
      }
    }

    // Salidas con motivo inusual (todas las sesiones)
    const movimientos: MovimientoCaja[] = sesion.movimientos ?? [];
    for (const mov of movimientos) {
      if (mov.tipo === 'salida') {
        const motivoLower = mov.motivo.toLowerCase();
        if (
          motivoLower.includes('personal') ||
          motivoLower.includes('préstamo') ||
          motivoLower.includes('prestamo')
        ) {
          alertas.push({
            nivel: 'media',
            tipo: 'anomalia',
            caja: m.cajaNombre,
            vendedora: m.vendedoraNombre,
            mensaje: 'Salida con motivo inusual',
            detalle: `Motivo registrado: "${mov.motivo}" · Monto: ${mov.monto.toFixed(0)}`,
            monto: -mov.monto,
            icono: 'zap',
          });
        }
      }
    }
  }

  // Si no hay sesiones o no hay alertas relevantes
  if (sesiones.length === 0) {
    alertas.push({
      nivel: 'info',
      tipo: 'ok',
      caja: '—',
      vendedora: '—',
      mensaje: 'Sin sesiones registradas para analizar',
      detalle: 'Abre una caja para comenzar el monitoreo',
      icono: 'shield',
    });
  }

  // --- Resumen estadístico ---
  const totalSesiones    = sesiones.length;
  const sesionesCriticas = alertas.filter((a) => a.nivel === 'critica').length;

  const totalFaltante = metricas
    .filter((m) => m.cerrada && m.diferencia < 0)
    .reduce((acc, m) => acc + m.diferencia, 0);

  // Vendedora con mayor cantidad de faltantes
  let vendedoraConMasFaltantes = '—';
  let maxFaltantes = 0;
  for (const [nombre, conteo] of Object.entries(faltantesPorVendedora)) {
    if (conteo > maxFaltantes) {
      maxFaltantes = conteo;
      vendedoraConMasFaltantes = nombre;
    }
  }

  const alertasCriticas = alertas.filter((a) => a.nivel === 'critica').length;
  const alertasAltas    = alertas.filter((a) => a.nivel === 'alta' && a.tipo !== 'patron').length;
  const alertasMedias   = alertas.filter((a) => a.nivel === 'media').length;
  const puntajeRaw      = 100 - (alertasCriticas * 30 + alertasAltas * 15 + alertasMedias * 5);
  const puntajeConfianza = Math.min(100, Math.max(0, puntajeRaw));

  return {
    alertas,
    metricas,
    resumen: {
      totalSesiones,
      sesionesCriticas,
      totalFaltante,
      vendedoraConMasFaltantes,
      puntajeConfianza,
    },
  };
}

// ============================================================
// ICONO DE ALERTA
// ============================================================

function IconoAlerta({ icono, nivel }: { icono: string; nivel: AlertaVigilancia['nivel'] }) {
  const clases = cn('w-5 h-5 flex-shrink-0', {
    'text-red-500':    nivel === 'critica',
    'text-orange-500': nivel === 'alta',
    'text-yellow-500': nivel === 'media',
    'text-blue-400':   nivel === 'info',
  });

  switch (icono) {
    case 'alert-triangle': return <AlertTriangle className={clases} />;
    case 'trending-down':  return <TrendingDown  className={clases} />;
    case 'trending-up':    return <TrendingUp    className={clases} />;
    case 'eye':            return <Eye           className={clases} />;
    case 'check-circle':   return <CheckCircle   className={clases} />;
    case 'x-circle':       return <XCircle       className={clases} />;
    case 'activity':       return <Activity      className={clases} />;
    case 'zap':            return <Zap           className={clases} />;
    case 'shield':         return <Shield        className={clases} />;
    default:               return <AlertTriangle className={clases} />;
  }
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function VigilianciaIA({ sesiones, ventas, formatCurrency }: VigilianciaIAProps) {
  const { alertas, resumen } = useMemo(
    () => analizarVigilancia(sesiones, ventas),
    [sesiones, ventas],
  );

  const { puntajeConfianza, totalSesiones, sesionesCriticas, totalFaltante, vendedoraConMasFaltantes } =
    resumen;

  // Ordenar alertas: crítica → alta → media → info
  const nivelOrden: Record<AlertaVigilancia['nivel'], number> = {
    critica: 0,
    alta: 1,
    media: 2,
    info: 3,
  };
  const alertasOrdenadas = [...alertas].sort(
    (a, b) => nivelOrden[a.nivel] - nivelOrden[b.nivel],
  );

  return (
    <div className="space-y-4 bg-slate-50 dark:bg-slate-950 min-h-full p-4 rounded-2xl">

      {/* ── HEADER ── */}
      <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 p-5 flex items-center gap-4 shadow-md border border-slate-700">
        <div className="p-3 rounded-xl bg-slate-700/60 border border-slate-600">
          <Brain className="w-7 h-7 text-violet-400 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">
            Asistente de Vigilancia IA
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Análisis inteligente de movimientos en tiempo real
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">Local · Seguro</span>
        </div>
      </div>

      {/* ── PUNTAJE DE CONFIANZA ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div
            className={cn(
              'w-28 h-28 rounded-full ring-4 flex flex-col items-center justify-center',
              ringPuntaje(puntajeConfianza),
            )}
          >
            <span className={cn('text-4xl font-extrabold tabular-nums', colorPuntaje(puntajeConfianza))}>
              {puntajeConfianza}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">/ 100</span>
          </div>
          <p className={cn('text-sm font-semibold', colorPuntaje(puntajeConfianza))}>
            {etiquetaPuntaje(puntajeConfianza)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Puntaje de confianza del turno</p>
        </div>

        {/* ── 4 KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Sesiones */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {totalSesiones}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Sesiones</span>
          </div>

          {/* Con faltante */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className={cn('text-xl font-bold tabular-nums', sesionesCriticas > 0 ? 'text-red-500' : 'text-slate-800 dark:text-slate-100')}>
              {sesionesCriticas}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Con Faltante</span>
          </div>

          {/* Faltante total */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <DollarSign className="w-4 h-4 text-orange-400" />
            <span className={cn('text-xl font-bold tabular-nums', totalFaltante < 0 ? 'text-red-500' : 'text-slate-800 dark:text-slate-100')}>
              {formatCurrency(Math.abs(totalFaltante))}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Faltante Total</span>
          </div>

          {/* Vendedora en alerta */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <User className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center leading-tight line-clamp-2">
              {vendedoraConMasFaltantes}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Vendedora en Alerta</span>
          </div>
        </div>
      </div>

      {/* ── LISTA DE ALERTAS ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <Eye className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Alertas detectadas
          </span>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {alertasOrdenadas.length}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {alertasOrdenadas.map((alerta, idx) => (
            <div
              key={idx}
              className={cn(
                'flex gap-3 px-5 py-4 border-l-4 transition-colors',
                colorNivel(alerta.nivel),
                bgNivel(alerta.nivel),
              )}
            >
              {/* Icono */}
              <div className="mt-0.5">
                <IconoAlerta icono={alerta.icono} nivel={alerta.nivel} />
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {/* Badge nivel */}
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', badgeNivel(alerta.nivel))}>
                    {etiquetaNivel(alerta.nivel)}
                  </span>
                  {/* Caja y vendedora */}
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {alerta.caja}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {alerta.vendedora}
                  </span>
                </div>

                {/* Mensaje principal */}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  {alerta.mensaje}
                </p>

                {/* Detalle */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {alerta.detalle}
                </p>
              </div>

              {/* Monto */}
              {alerta.monto !== undefined && alerta.monto !== 0 && (
                <div className="flex-shrink-0 self-start mt-0.5">
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      alerta.monto < 0 ? 'text-red-500' : 'text-emerald-500',
                    )}
                  >
                    {alerta.monto < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(alerta.monto))}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-2 flex items-center justify-center gap-1.5">
        <Shield className="w-3 h-3" />
        <span>
          🤖 Análisis generado localmente · Sin datos enviados a servidores externos
        </span>
      </div>

    </div>
  );
}
