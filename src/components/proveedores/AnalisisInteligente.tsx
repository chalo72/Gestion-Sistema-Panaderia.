import { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, Target,
  ChevronDown, ChevronUp, Lightbulb, ShieldCheck, Flame,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, MapPin,
  Truck, Info,
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

interface AnalisisInteligenteProps {
  precios: PrecioProveedor[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
  proveedorNombre: string;
  proveedorUbicacion?: string;
}

export function AnalisisInteligente({ precios, getProductoById, formatCurrency, proveedorNombre, proveedorUbicacion }: AnalisisInteligenteProps) {
  const [expandido, setExpandido] = useState(false);

  const ubicacion = proveedorUbicacion?.trim() || '';

  // ── Analizar todos los productos ──
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

    const ventas = productosAnalizados.filter(p => p.destino === 'venta' && p.precioVenta > 0);
    const insumos = productosAnalizados.filter(p => p.destino === 'insumo');

    // ── KPIs generales ──
    const margenPromedio = ventas.length > 0
      ? ventas.reduce((sum, p) => sum + p.margenPorcentaje, 0) / ventas.length
      : 0;
    const inversionTotal = productosAnalizados.reduce((s, p) => s + p.precioCosto, 0);
    const gananciaEstimadaTotal = ventas.reduce((s, p) => s + p.gananciaPorUnidad, 0);

    // ── Clasificar productos ──
    const estrellas = ventas.filter(p => p.margenPorcentaje >= REGLAS.ESTRELLA_MARGEN);
    const alertas = ventas.filter(p => p.margenPorcentaje > 0 && p.margenPorcentaje < REGLAS.ALERTA_MARGEN);
    const gananciaBaja = ventas.filter(p => p.gananciaPorUnidad > 0 && p.gananciaPorUnidad < REGLAS.GANANCIA_BAJA_LIMITE);

    // ── Generar recomendaciones ──
    const recomendaciones: Recomendacion[] = [];
    const ubiLabel = ubicacion || 'tu zona';

    // Bebidas con margen bajo
    ventas.filter(p =>
      p.categoria.toLowerCase().includes('bebida') && p.margenPorcentaje < REGLAS.BEBIDA_MARGEN_MIN
    ).forEach(p => {
      const precioSugerido = Math.round(p.costoUnitario * 1.6 / 100) * 100;
      recomendaciones.push({
        tipo: 'subir',
        prioridad: 'alta',
        producto: p.nombre,
        mensaje: `Margen actual: ${p.margenPorcentaje.toFixed(0)}%. En una panadería de ${ubiLabel}, las bebidas frías se venden por impulso — el cliente las agarra del refrigerador sin comparar precio. Puedes cobrar más.`,
        explicacion: `Te cuesta ${formatCurrency(Math.round(p.costoUnitario / 100) * 100)} y lo vendes a ${formatCurrency(p.precioVenta)}. Solo ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por unidad. Si lo subes a ${formatCurrency(precioSugerido)}, ganas ${formatCurrency(precioSugerido - Math.round(p.costoUnitario / 100) * 100)} por cada uno — y el cliente igual lo lleva.`,
        precioSugerido,
        impacto: `+${formatCurrency(precioSugerido - p.precioVenta)}/unidad`,
      });
    });

    // Productos con margen menor a 30%
    ventas.filter(p =>
      p.margenPorcentaje > 0 && p.margenPorcentaje < REGLAS.REVENTA_MARGEN_MIN &&
      !p.categoria.toLowerCase().includes('bebida')
    ).forEach(p => {
      const precioSugerido = Math.round(p.costoUnitario * 1.4 / 100) * 100;
      recomendaciones.push({
        tipo: 'subir',
        prioridad: 'media',
        producto: p.nombre,
        mensaje: `Margen de ${p.margenPorcentaje.toFixed(0)}% es insuficiente. En ${ubiLabel}, para que un producto de reventa valga la pena mantenerlo exhibido, necesitas al menos 30% de margen — de lo contrario el espacio lo puede ocupar algo más rentable.`,
        explicacion: `Compras a ${formatCurrency(Math.round(p.costoUnitario / 100) * 100)} y vendes a ${formatCurrency(p.precioVenta)}. Con ${formatCurrency(precioSugerido)} tendrías ~40% de margen, un nivel saludable para cubrir costos fijos y generar ganancia real.`,
        precioSugerido,
        impacto: `+${formatCurrency(precioSugerido - p.precioVenta)}/unidad`,
      });
    });

    // Ganancia por unidad muy baja (< $500 COP)
    gananciaBaja.forEach(p => {
      recomendaciones.push({
        tipo: 'evaluar',
        prioridad: 'media',
        producto: p.nombre,
        mensaje: `Solo ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por cada ${p.nombre} vendido. En ${ubiLabel}, con costos de arriendo, servicios y personal, necesitas que cada producto deje por lo menos $500 por unidad para que sea sostenible.`,
        explicacion: `Pregúntate: ¿este producto rota rápido (vendes muchos al día) o es lento? Si rota rápido, puede funcionar con ganancia baja. Si rota lento, el espacio en la vitrina lo debería ocupar algo que deje más plata.`,
      });
    });

    // Insumos caros — negociar
    insumos.filter(p => p.precioCosto > 50000).forEach(p => {
      recomendaciones.push({
        tipo: 'negociar',
        prioridad: 'baja',
        producto: p.nombre,
        mensaje: `Este insumo cuesta ${formatCurrency(p.precioCosto)}. Si este proveedor está en ${ubiLabel}, el costo del flete es menor — pero verifica si otro proveedor de un pueblo vecino o de la capital te ofrece mejor precio por volumen.`,
        explicacion: `Un ahorro del 5-10% en insumos costosos se traduce en ${formatCurrency(Math.round(p.precioCosto * 0.05 / 100) * 100)} a ${formatCurrency(Math.round(p.precioCosto * 0.10 / 100) * 100)} de ahorro por compra. Saca la cuenta al mes y verás el impacto.`,
      });
    });

    // Productos estrella — mantener
    estrellas.forEach(p => {
      recomendaciones.push({
        tipo: 'mantener',
        prioridad: 'baja',
        producto: p.nombre,
        mensaje: `¡Producto estrella con ${p.margenPorcentaje.toFixed(0)}% de margen! Este es tu aliado de rentabilidad en ${ubiLabel}. Ganas ${formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)} por cada unidad vendida.`,
        explicacion: `Nunca te quedes sin stock de este producto. Si el proveedor llega desde ${ubiLabel}, asegura pedido recurrente. Si puedes negociar mayor volumen a menor costo, tu margen sube aún más.`,
      });
    });

    // Ordenar por prioridad
    const prioridadOrden = { alta: 0, media: 1, baja: 2 };
    recomendaciones.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    // ── Salud general ──
    let saludGeneral: 'excelente' | 'buena' | 'regular' | 'critica';
    if (margenPromedio >= 50) saludGeneral = 'excelente';
    else if (margenPromedio >= 35) saludGeneral = 'buena';
    else if (margenPromedio >= 20) saludGeneral = 'regular';
    else saludGeneral = 'critica';

    // ── Resumen ejecutivo en lenguaje natural ──
    const totalProductos = productosAnalizados.length;
    const resumenParts: string[] = [];

    if (ubicacion) {
      resumenParts.push(`📍 ${proveedorNombre} opera desde ${ubicacion}.`);
    }
    resumenParts.push(`Te suministra ${totalProductos} producto${totalProductos > 1 ? 's' : ''}: ${ventas.length} para reventa directa y ${insumos.length} insumo${insumos.length !== 1 ? 's' : ''} de producción.`);

    if (ventas.length > 0) {
      if (saludGeneral === 'excelente') {
        resumenParts.push(`Tu margen promedio es ${margenPromedio.toFixed(0)}% — excelente para una microempresa. Estás ganando bien con lo que compras a este aliado.`);
      } else if (saludGeneral === 'buena') {
        resumenParts.push(`Tu margen promedio es ${margenPromedio.toFixed(0)}% — es aceptable, pero hay oportunidad de mejorar ajustando algunos precios de venta.`);
      } else if (saludGeneral === 'regular') {
        resumenParts.push(`⚠️ Tu margen promedio es solo ${margenPromedio.toFixed(0)}%. Algunos productos no están dejando suficiente ganancia. Revisa las recomendaciones abajo.`);
      } else {
        resumenParts.push(`🚨 Margen promedio de ${margenPromedio.toFixed(0)}% es crítico. Estás vendiendo casi al costo. Necesitas subir precios o negociar mejores costos con urgencia.`);
      }
    }

    if (estrellas.length > 0) {
      const nombresEstrellas = estrellas.slice(0, 3).map(e => e.nombre).join(', ');
      resumenParts.push(`⭐ Tus estrellas: ${nombresEstrellas}${estrellas.length > 3 ? ` y ${estrellas.length - 3} más` : ''} — estos son los que más plata te dejan.`);
    }
    if (alertas.length > 0) {
      resumenParts.push(`⚠️ ${alertas.length} producto${alertas.length > 1 ? 's tienen' : ' tiene'} margen por debajo del 25%. Necesitan ajuste de precio.`);
    }
    if (inversionTotal > 0) {
      resumenParts.push(`💰 Tu inversión total con este proveedor es ${formatCurrency(inversionTotal)}.`);
      if (gananciaEstimadaTotal > 0) {
        resumenParts.push(`Si vendes todo una vez, recuperas la inversión + ${formatCurrency(Math.round(gananciaEstimadaTotal / 100) * 100)} de ganancia.`);
      }
    }

    const resumenEjecutivo = resumenParts.join(' ');

    return {
      productosAnalizados,
      ventas,
      insumos,
      margenPromedio,
      inversionTotal,
      gananciaEstimadaTotal,
      estrellas,
      alertas,
      gananciaBaja,
      recomendaciones,
      saludGeneral,
      resumenEjecutivo,
    };
  }, [precios, getProductoById, formatCurrency, ubicacion, proveedorNombre]);

  if (precios.length === 0) return null;

  const saludConfig = {
    excelente: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: ShieldCheck, label: 'Excelente', emoji: '🔥' },
    buena:     { color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: TrendingUp, label: 'Buena',     emoji: '✅' },
    regular:   { color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: AlertTriangle, label: 'Regular', emoji: '⚠️' },
    critica:   { color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',         icon: TrendingDown, label: 'Crítica',  emoji: '🚨' },
  };

  const salud = saludConfig[analisis.saludGeneral];
  const SaludIcon = salud.icon;
  const recsAltas = analisis.recomendaciones.filter(r => r.prioridad === 'alta');
  const recsMedias = analisis.recomendaciones.filter(r => r.prioridad === 'media');
  const recsBajas = analisis.recomendaciones.filter(r => r.prioridad === 'baja');

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* ── Header: click para expandir ── */}
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
          {/* Mini KPIs en header */}
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

          {/* ── Resumen ejecutivo ── */}
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

          {/* ── KPIs de rentabilidad ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={BarChart3}
              label="Margen Promedio"
              value={`${analisis.margenPromedio.toFixed(0)}%`}
              color={analisis.margenPromedio >= 40 ? 'emerald' : analisis.margenPromedio >= 25 ? 'amber' : 'red'}
              sub={`En ${analisis.ventas.length} producto${analisis.ventas.length !== 1 ? 's' : ''} de venta`}
              tooltip={analisis.margenPromedio >= 40
                ? 'Buen margen. Estás ganando suficiente para cubrir costos fijos y crecer.'
                : analisis.margenPromedio >= 25
                ? 'Margen aceptable, pero se puede mejorar subiendo algunos precios.'
                : 'Margen bajo. Revisa las recomendaciones para subir precios.'}
            />
            <KpiCard
              icon={DollarSign}
              label="Inversión Total"
              value={formatCurrency(analisis.inversionTotal)}
              color="blue"
              sub={`${analisis.productosAnalizados.length} productos en catálogo`}
              tooltip="Lo que inviertes comprando a este proveedor. Incluye pacas/bultos completos."
            />
            <KpiCard
              icon={Flame}
              label="Estrellas"
              value={`${analisis.estrellas.length}`}
              color="purple"
              sub={`Margen ≥ ${REGLAS.ESTRELLA_MARGEN}%`}
              tooltip="Productos que te dejan MÁS ganancia. Nunca te quedes sin stock de estos."
            />
            <KpiCard
              icon={AlertTriangle}
              label="Alertas"
              value={`${analisis.alertas.length + analisis.gananciaBaja.length}`}
              color={analisis.alertas.length > 0 ? 'amber' : 'slate'}
              sub="Requieren atención"
              tooltip="Productos con margen bajo o ganancia insuficiente. Revisa si vale la pena mantenerlos o subir precio."
            />
          </div>

          {/* ── Tabla de rentabilidad ── */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Ranking de Rentabilidad</p>
            <p className="text-[10px] text-slate-400 mb-3">Ordenados de mayor a menor ganancia porcentual. Los de arriba son los que más plata dejan.</p>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="col-span-4">Producto</div>
                <div className="col-span-2 text-right">Costo/u</div>
                <div className="col-span-2 text-right">Venta</div>
                <div className="col-span-2 text-right">Ganancia</div>
                <div className="col-span-2 text-center">Margen</div>
              </div>
              {[...analisis.ventas]
                .sort((a, b) => b.margenPorcentaje - a.margenPorcentaje)
                .map((p, i) => {
                  const margenColor = p.margenPorcentaje >= 60 ? 'text-emerald-600 bg-emerald-50' :
                    p.margenPorcentaje >= 35 ? 'text-blue-600 bg-blue-50' :
                    p.margenPorcentaje >= 20 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

                  return (
                    <div key={i} className={cn(
                      'grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs',
                      i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30',
                    )}>
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        {p.margenPorcentaje >= REGLAS.ESTRELLA_MARGEN && <span className="text-sm">⭐</span>}
                        {p.margenPorcentaje < REGLAS.ALERTA_MARGEN && p.margenPorcentaje > 0 && <span className="text-sm">⚠️</span>}
                        {p.margenPorcentaje >= REGLAS.ALERTA_MARGEN && p.margenPorcentaje < REGLAS.ESTRELLA_MARGEN && <span className="text-sm">✅</span>}
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{p.nombre}</span>
                      </div>
                      <div className="col-span-2 text-right font-bold text-slate-500 tabular-nums">
                        {formatCurrency(Math.round(p.costoUnitario / 100) * 100)}
                      </div>
                      <div className="col-span-2 text-right font-black text-emerald-600 tabular-nums">
                        {formatCurrency(p.precioVenta)}
                      </div>
                      <div className="col-span-2 text-right font-black text-amber-500 tabular-nums">
                        +{formatCurrency(Math.round(p.gananciaPorUnidad / 100) * 100)}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg', margenColor)}>
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
          </div>

          {/* ── Insumos (si hay) ── */}
          {analisis.insumos.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">🏭 Insumos de Producción</p>
              <p className="text-[10px] text-slate-400 mb-3">
                Estos se usan para elaborar tus productos. No tienen precio de venta directo — su costo impacta el precio final de lo que produces.
                {ubicacion ? ` Comprados a ${proveedorNombre} en ${ubicacion}.` : ''}
              </p>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                {analisis.insumos.map((p, i) => (
                  <div key={i} className={cn(
                    'flex items-center justify-between px-4 py-2.5 text-xs',
                    i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30',
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">🏭</span>
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

          {/* ── Recomendaciones ── */}
          {analisis.recomendaciones.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                💡 Recomendaciones ({analisis.recomendaciones.length})
              </p>
              <p className="text-[10px] text-slate-400 mb-3">
                Sugerencias basadas en tus márgenes{ubicacion ? ` y la ubicación del proveedor en ${ubicacion}` : ''}. No son obligatorias — son puntos para que evalúes.
              </p>
              <div className="space-y-2">
                {recsAltas.length > 0 && (
                  <div className="space-y-2">
                    {recsAltas.map((rec, i) => (
                      <RecCard key={`alta-${i}`} rec={rec} formatCurrency={formatCurrency} />
                    ))}
                  </div>
                )}
                {recsMedias.length > 0 && (
                  <div className="space-y-2">
                    {recsMedias.map((rec, i) => (
                      <RecCard key={`media-${i}`} rec={rec} formatCurrency={formatCurrency} />
                    ))}
                  </div>
                )}
                {recsBajas.length > 0 && (
                  <div className="space-y-2">
                    {recsBajas.map((rec, i) => (
                      <RecCard key={`baja-${i}`} rec={rec} formatCurrency={formatCurrency} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Reglas de negocio ── */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">📏 Reglas de negocio activas</p>
            <p className="text-[9px] text-indigo-400/70 mb-2">Estos son los mínimos recomendados para que tu negocio sea rentable y sostenible.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <p>🥤 Bebidas: mínimo <b className="text-indigo-600">{REGLAS.BEBIDA_MARGEN_MIN}%</b> — se venden por impulso, el cliente no compara</p>
              <p>🛒 Reventa: mínimo <b className="text-indigo-600">{REGLAS.REVENTA_MARGEN_MIN}%</b> — para cubrir costos fijos y dejar ganancia</p>
              <p>⭐ Estrella: desde <b className="text-indigo-600">{REGLAS.ESTRELLA_MARGEN}%</b> — estos son tus mejores productos, nunca sin stock</p>
              <p>🏭 Insumos: buscar <b className="text-indigo-600">menor precio</b> — compara proveedores{ubicacion ? ` en ${ubicacion} y alrededores` : ''}</p>
            </div>
          </div>

          {/* ── Nota sobre ubicación ── */}
          {ubicacion && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30">
              <Truck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                <b>{proveedorNombre}</b> opera desde <b>{ubicacion}</b>. Tener proveedores locales o cercanos reduce costos de transporte y te permite pedir con más frecuencia sin afectar tu flujo de caja.
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
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    slate: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
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
    subir:    { icon: ArrowUpRight,  bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30',       iconColor: 'text-red-500' },
    bajar:    { icon: ArrowDownRight,bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',    iconColor: 'text-blue-500' },
    mantener: { icon: ShieldCheck,   bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30', iconColor: 'text-emerald-500' },
    negociar: { icon: Target,        bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30', iconColor: 'text-amber-500' },
    evaluar:  { icon: Zap,           bg: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30', iconColor: 'text-purple-500' },
  };

  const config = tipoConfig[rec.tipo];
  const RecIcon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border', config.bg)}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/60 dark:bg-slate-900/40')}>
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
          <button
            onClick={() => setVerMas(!verMas)}
            className="text-[10px] font-black text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1 transition-colors"
          >
            {verMas ? 'Ver menos' : '¿Por qué?'}
            {verMas ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        {verMas && rec.explicacion && (
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
