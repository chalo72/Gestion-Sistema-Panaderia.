/**
 * Centro de Mando del Director — “mano derecha” administradora.
 * Resume pulso del día, dinero (hoy + quincena), producción y hasta 3 decisiones.
 * Lee datos locales ya existentes; no toca la base ni archivos protegidos.
 */
import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Compass,
  Package,
  TrendingDown,
  TrendingUp,
  Wheat,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  calcularProyeccionQuincena,
  fechaLocalHoy,
  getCompromisos,
  getProducciones,
  getVentasDiarias,
  normalizarFechaYYYYMMDD,
  type RegistroProduccion,
} from '@/lib/finanzas-personales';

export type NivelPulso = 'verde' | 'ambar' | 'rojo';

export interface DecisionDirector {
  id: string;
  prioridad: 'urgente' | 'importante' | 'sugerencia';
  titulo: string;
  detalle: string;
  accionLabel: string;
  accion: () => void;
}

export interface VentaResumen {
  fecha?: string;
  total?: number;
  metodoPago?: string;
}

interface ManoDerechaDirectorProps {
  nombre?: string;
  ingresosHoy: number;
  gastosHoy: number;
  ventasHoy: number;
  itemsBajoStock: number;
  alertasNoLeidas: number;
  ventas: VentaResumen[];
  formatCurrency: (value: number) => string;
  onViewVentas: () => void;
  onViewInventario: () => void;
  onViewAlertas: () => void;
  onViewRecepciones: () => void;
}

const saludoPorHora = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const sumarArrobas = (p: RegistroProduccion): number => {
  if (p.masas && p.masas.length > 0) {
    return p.masas.reduce((s, m) => s + (Number(m.cantidadArrobas) || 0), 0);
  }
  return (
    (Number(p.masaDulce) || 0) +
    (Number(p.masaHojaldrado) || 0) +
    (Number(p.masaBatidoTorta) || 0) +
    (Number(p.masaBatidoGalleta) || 0)
  );
};

const sumarPanes = (p: RegistroProduccion): number =>
  (p.hornadas || []).reduce((s, h) => s + (Number(h.totalPanes) || 0), 0);

/** Construye hasta 3 decisiones priorizadas (puro — testeable). */
export const construirDecisionesDirector = (params: {
  itemsBajoStock: number;
  alertasNoLeidas: number;
  ingresosHoy: number;
  gastosHoy: number;
  ventasHoy: number;
  alcanzaQuincena: boolean;
  deficit: number;
  hayProduccionHoy: boolean;
  ultimaProduccionFecha: string | null;
  formatCurrency: (n: number) => string;
  onViewVentas: () => void;
  onViewInventario: () => void;
  onViewAlertas: () => void;
  avisarReportes: () => void;
}): DecisionDirector[] => {
  const lista: DecisionDirector[] = [];

  if (!params.alcanzaQuincena && params.deficit > 0) {
    lista.push({
      id: 'quincena-deficit',
      prioridad: 'urgente',
      titulo: 'La quincena no alcanza sola',
      detalle: `Faltan unos ${params.formatCurrency(params.deficit)} para cubrir lo comprometido. Revisa ventas, gastos o pagos en Reportes → Mi Quincena.`,
      accionLabel: 'Cómo revisar',
      accion: params.avisarReportes,
    });
  }

  if (params.itemsBajoStock > 0) {
    lista.push({
      id: 'stock-bajo',
      prioridad: 'urgente',
      titulo: `${params.itemsBajoStock} producto${params.itemsBajoStock === 1 ? '' : 's'} con poco stock`,
      detalle: 'Si se acaba un insumo clave, se frena la producción. Mira el inventario y pide a tiempo.',
      accionLabel: 'Ver inventario',
      accion: params.onViewInventario,
    });
  }

  if (params.alertasNoLeidas > 0) {
    lista.push({
      id: 'alertas',
      prioridad: 'importante',
      titulo: `${params.alertasNoLeidas} alerta${params.alertasNoLeidas === 1 ? '' : 's'} sin leer`,
      detalle: 'Hay avisos de precio o stock que aún no revisaste.',
      accionLabel: 'Ver alertas',
      accion: params.onViewAlertas,
    });
  }

  if (!params.hayProduccionHoy) {
    lista.push({
      id: 'sin-produccion',
      prioridad: 'importante',
      titulo: 'Hoy no hay producción registrada',
      detalle: params.ultimaProduccionFecha
        ? `El último lote fue el ${params.ultimaProduccionFecha}. Si ya hornearon, anótalo en Reportes → Producción.`
        : 'Aún no hay lotes guardados. Si ya se amasó, conviene anotar el cuadre del panadero.',
      accionLabel: 'Dónde anotar',
      accion: () =>
        toast.info('Abre el menú → Reportes → pestaña Producción / Cuadre para registrar el lote.'),
    });
  }

  if (params.gastosHoy > 0 && params.ingresosHoy > 0 && params.gastosHoy > params.ingresosHoy * 0.7) {
    lista.push({
      id: 'gastos-altos',
      prioridad: 'importante',
      titulo: 'Los gastos del día van altos',
      detalle: `Gastaste ${params.formatCurrency(params.gastosHoy)} frente a ${params.formatCurrency(params.ingresosHoy)} de ingreso. Revisa si hubo compras grandes o salidas de caja.`,
      accionLabel: 'Ver ventas / caja',
      accion: params.onViewVentas,
    });
  }

  if (params.ventasHoy === 0 && params.ingresosHoy === 0) {
    lista.push({
      id: 'sin-ventas',
      prioridad: 'sugerencia',
      titulo: 'Todavía no hay ventas registradas hoy',
      detalle: 'Si ya abrieron el mostrador, abre el POS y registra las primeras ventas para que el pulso sea real.',
      accionLabel: 'Abrir POS',
      accion: params.onViewVentas,
    });
  }

  if (lista.length === 0) {
    lista.push({
      id: 'dia-ok',
      prioridad: 'sugerencia',
      titulo: 'El día va en orden',
      detalle: 'Sin alertas urgentes. Enfócate en vender bien y en que el panadero deje el cuadre claro.',
      accionLabel: 'Ir a ventas',
      accion: params.onViewVentas,
    });
  }

  const orden: Record<DecisionDirector['prioridad'], number> = {
    urgente: 0,
    importante: 1,
    sugerencia: 2,
  };
  return lista.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]).slice(0, 3);
};

const calcularPulso = (params: {
  itemsBajoStock: number;
  alertasNoLeidas: number;
  alcanzaQuincena: boolean;
  deficit: number;
}): { nivel: NivelPulso; frase: string } => {
  if ((!params.alcanzaQuincena && params.deficit > 0) || params.itemsBajoStock >= 3) {
    return {
      nivel: 'rojo',
      frase: 'Hay cosas urgentes hoy. Atiende primero las 3 decisiones de abajo.',
    };
  }
  if (params.itemsBajoStock > 0 || params.alertasNoLeidas > 0 || !params.alcanzaQuincena) {
    return {
      nivel: 'ambar',
      frase: 'El día avanza, pero hay puntos a vigilar. No los dejes para mañana.',
    };
  }
  return {
    nivel: 'verde',
    frase: 'Pulso estable. Buen momento para vender y cuidar el cuadre del pan.',
  };
};

export function ManoDerechaDirector({
  nombre,
  ingresosHoy,
  gastosHoy,
  ventasHoy,
  itemsBajoStock,
  alertasNoLeidas,
  ventas,
  formatCurrency,
  onViewVentas,
  onViewInventario,
  onViewAlertas,
  onViewRecepciones,
}: ManoDerechaDirectorProps) {
  const hoy = fechaLocalHoy();
  const nombreCorto = (nombre || 'Director').split(' ')[0];

  const proyeccion = useMemo(() => {
    const ventasNorm = ventas.map((v) => ({
      fecha: normalizarFechaYYYYMMDD(v.fecha),
      total: Number(v.total) || 0,
      metodoPago: v.metodoPago,
    }));
    return calcularProyeccionQuincena({
      ventas: ventasNorm,
      ventasDiarias: getVentasDiarias(),
      gastos: [],
      compromisos: getCompromisos(),
    });
  }, [ventas]);

  const produccionHoy = useMemo(() => {
    const list = getProducciones();
    const deHoy = list.filter((p) => p.fecha === hoy);
    const ultima = list[0] ?? null;
    const loteRef = deHoy[0] ?? ultima;
    return {
      hayHoy: deHoy.length > 0,
      ultimaFecha: ultima?.fecha ?? null,
      lote: loteRef,
      arrobas: loteRef ? sumarArrobas(loteRef) : 0,
      panes: loteRef ? sumarPanes(loteRef) : 0,
      lotesHoy: deHoy.length,
    };
  }, [hoy, ingresosHoy, ventasHoy, itemsBajoStock]);

  const pulso = useMemo(
    () =>
      calcularPulso({
        itemsBajoStock,
        alertasNoLeidas,
        alcanzaQuincena: proyeccion.alcanza,
        deficit: proyeccion.deficit,
      }),
    [itemsBajoStock, alertasNoLeidas, proyeccion.alcanza, proyeccion.deficit]
  );

  const decisiones = useMemo(
    () =>
      construirDecisionesDirector({
        itemsBajoStock,
        alertasNoLeidas,
        ingresosHoy,
        gastosHoy,
        ventasHoy,
        alcanzaQuincena: proyeccion.alcanza,
        deficit: proyeccion.deficit,
        hayProduccionHoy: produccionHoy.hayHoy,
        ultimaProduccionFecha: produccionHoy.ultimaFecha,
        formatCurrency,
        onViewVentas,
        onViewInventario,
        onViewAlertas,
        avisarReportes: () =>
          toast.info('Abre el menú → Reportes → Mi Quincena para ver números honestos.'),
      }),
    [
      itemsBajoStock,
      alertasNoLeidas,
      ingresosHoy,
      gastosHoy,
      ventasHoy,
      proyeccion.alcanza,
      proyeccion.deficit,
      produccionHoy.hayHoy,
      produccionHoy.ultimaFecha,
      formatCurrency,
      onViewVentas,
      onViewInventario,
      onViewAlertas,
    ]
  );

  const netoHoy = ingresosHoy - gastosHoy;

  const pulsoStyles: Record<NivelPulso, string> = {
    verde: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    ambar: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    rojo: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  };

  const prioridadStyles: Record<DecisionDirector['prioridad'], string> = {
    urgente: 'border-l-red-500 bg-red-50/80 dark:bg-red-950/30',
    importante: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20',
    sugerencia: 'border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20',
  };

  return (
    <section
      className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-amber-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20 p-5 sm:p-7 shadow-xl shadow-slate-900/5 space-y-5"
      aria-label="Mano derecha del Director"
    >
      {/* Saludo + pulso */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-5 h-5 text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Mano derecha del Director
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {saludoPorHora()}, {nombreCorto}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Aquí te digo la verdad del día: dinero, pan y qué conviene atender primero.
          </p>
        </div>
        <div
          className={cn(
            'shrink-0 rounded-2xl border px-4 py-3 max-w-sm',
            pulsoStyles[pulso.nivel]
          )}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-1">
            Pulso del día · {pulso.nivel === 'verde' ? 'Estable' : pulso.nivel === 'ambar' ? 'Vigilancia' : 'Urgente'}
          </p>
          <p className="text-sm font-semibold leading-snug">{pulso.frase}</p>
        </div>
      </div>

      {/* Dinero + producción */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Dinero (verdad)</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Ingreso hoy</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(ingresosHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Gastos hoy</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(gastosHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Neto hoy</p>
              <p
                className={cn(
                  'text-lg font-black flex items-center gap-1',
                  netoHoy >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {netoHoy >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatCurrency(netoHoy)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Ventas hoy</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{ventasHoy}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Quincena · efectivo real</p>
              <p className="text-base font-bold">{formatCurrency(proyeccion.efectivoReal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Utilidad bruta (≈50%)</p>
              <p className="text-base font-bold">{formatCurrency(proyeccion.utilidadBruta)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">¿Alcanza compromisos?</p>
              <p
                className={cn(
                  'text-base font-black',
                  proyeccion.alcanza ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {proyeccion.alcanza
                  ? 'Sí, por ahora'
                  : `No · faltan ${formatCurrency(proyeccion.deficit)}`}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wheat className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Producción</h3>
          </div>
          {produccionHoy.lote ? (
            <>
              <p className="text-sm text-slate-500 mb-2">
                {produccionHoy.hayHoy
                  ? `${produccionHoy.lotesHoy} lote${produccionHoy.lotesHoy === 1 ? '' : 's'} hoy`
                  : `Último lote · ${produccionHoy.ultimaFecha}`}
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {produccionHoy.arrobas.toFixed(1)}{' '}
                <span className="text-sm font-bold text-slate-400">arrobas</span>
              </p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">
                {produccionHoy.panes} panes
              </p>
            </>
          ) : (
            <div className="py-4 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">Sin lotes registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* 3 decisiones */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
            3 decisiones del día
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {decisiones.map((d, i) => (
            <article
              key={d.id}
              className={cn(
                'rounded-2xl border border-transparent border-l-4 p-4 flex flex-col gap-2',
                prioridadStyles[d.prioridad]
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  #{i + 1} · {d.prioridad}
                </span>
                {d.prioridad === 'urgente' ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white leading-snug">{d.titulo}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">{d.detalle}</p>
              <button
                type="button"
                onClick={d.accion}
                className="mt-1 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wide bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                {d.accionLabel}
              </button>
            </article>
          ))}
        </div>
      </div>

      {/* Atajos */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'POS / Ventas', onClick: onViewVentas },
          { label: 'Inventario', onClick: onViewInventario },
          { label: 'Alertas', onClick: onViewAlertas },
          { label: 'Recepciones', onClick: onViewRecepciones },
          {
            label: 'Mi Quincena',
            onClick: () => toast.info('Abre el menú → Reportes → Mi Quincena.'),
          },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="px-3.5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
