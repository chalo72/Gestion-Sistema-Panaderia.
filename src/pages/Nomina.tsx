import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, FileDown,
  Wallet, History, AlertCircle, X, Pencil, Trash2, Plus,
  ShoppingBag, Eye, UserX, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { escapeHtml } from '@/lib/utils';
import { parseHorario, minutosEntre, diaSemana, fechaLocalHoy, NOMBRE_DIA_CORTO } from '@/lib/horario-trabajo';
import { ymdLocal } from '@/lib/fecha-local';
import { useCan } from '@/contexts/AuthContext';
import { db } from '@/lib/database';
import { getBovedas, addMovimientoBoveda } from '@/lib/boveda-store';
import type {
  Trabajador, RegistroAsistencia, CreditoTrabajador, PagoCredito,
  NominaQuincenal, NominaItem, NominaEstado, NominaOrigenPago,
  CajaSesion, MovimientoCaja
} from '@/types';

function esCajaPrincipal(nombre?: string) {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return n.includes('principal');
}

function plataEnCaja(caja: CajaSesion) {
  const entradas = (caja.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const salidas = (caja.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const ventas = caja.totalVentasEfectivo ?? caja.totalVentas ?? 0;
  return Math.max(0, Math.round((Number(caja.montoApertura) || 0) + ventas + entradas - salidas));
}

function textoOrigenes(partes: NominaOrigenPago[]) {
  return partes.map(p => `${p.tipo === 'caja' ? 'Caja' : 'Bóveda'} ${p.nombre} ${p.monto}`).join(' · ');
}

interface NominaProps {
  trabajadores: Trabajador[];
  asistencia: RegistroAsistencia[];
  creditosTrabajadores: CreditoTrabajador[];
  nominas: NominaQuincenal[];
  /** Guarda un registro en Control de turno (para dejar anotados los días marcados a mano y las salidas olvidadas). */
  onAddAsistencia?: (r: Omit<RegistroAsistencia, 'id' | 'createdAt'>) => Promise<RegistroAsistencia>;
  onAddNomina: (n: Omit<NominaQuincenal, 'id' | 'createdAt'>) => Promise<NominaQuincenal>;
  onUpdateNomina: (n: NominaQuincenal) => Promise<void>;
  onAddGasto: (g: any) => Promise<any>;
  onAddCreditoTrabajador: (c: Omit<CreditoTrabajador, 'id' | 'createdAt'>) => Promise<CreditoTrabajador>;
  onUpdateCreditoTrabajador: (c: CreditoTrabajador) => Promise<void>;
  onDeleteCreditoTrabajador: (id: string) => Promise<void>;
  formatCurrency: (n: number) => string;
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function quincenaActual() {
  const hoy = new Date();
  return { periodo: hoy.getDate() <= 15 ? 'primera' : 'segunda' as 'primera' | 'segunda',
           mes: hoy.getMonth() + 1, año: hoy.getFullYear() };
}

function rangoQuincena(periodo: 'primera' | 'segunda', mes: number, año: number) {
  const mm = String(mes).padStart(2, '0');
  if (periodo === 'primera') return { inicio: `${año}-${mm}-01`, fin: `${año}-${mm}-15`, dias: 15 };
  const ultimo = new Date(año, mes, 0).getDate();
  return { inicio: `${año}-${mm}-16`, fin: `${año}-${mm}-${ultimo}`, dias: ultimo - 15 };
}

function diasEnRango(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  const cur = new Date(inicio + 'T00:00:00');
  const end = new Date(fin   + 'T00:00:00');
  while (cur <= end) { dias.push(ymdLocal(cur)); cur.setDate(cur.getDate() + 1); }
  return dias;
}

function calcularMinutos(regs: RegistroAsistencia[]): number {
  const sorted = [...regs].sort((a, b) => a.hora.localeCompare(b.hora));
  let total = 0; let entrada: string | null = null;
  for (const r of sorted) {
    if (r.tipo === 'entrada') { entrada = r.hora; }
    else if (r.tipo === 'salida' && entrada) {
      const [eh, em] = entrada.split(':').map(Number);
      const [sh, sm] = r.hora.split(':').map(Number);
      total += (sh * 60 + sm) - (eh * 60 + em);
      entrada = null;
    }
  }
  return Math.max(0, total);
}

function formatHoras(min: number): string {
  if (min === 0) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const MES_LABEL = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoLabel(n: NominaQuincenal) {
  return `${n.periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[n.mes]} ${n.año}`;
}

/** Cruza la fecha de la deuda con los pagos de nómina ya guardados. */
function cruzarDeuda(c: CreditoTrabajador, nominas: NominaQuincenal[]) {
  const fecha = fechaDeCredito(c);
  const [añoS, mesS, diaS] = fecha.split('-');
  const dia = Number(diaS) || 1;
  const mes = Number(mesS) || 1;
  const año = Number(añoS) || 1970;
  const periodoDeuda: 'primera' | 'segunda' = dia <= 15 ? 'primera' : 'segunda';
  const quincena = `${periodoDeuda === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[mes] || ''} ${año}`.trim();
  const pagos = nominas.flatMap(n =>
    (n.items || [])
      .filter(i => i.trabajadorId === c.trabajadorId && (i.fechaPago || n.fechaPago || n.estado === 'pagada'))
      .map(i => ({ n, i, fechaPago: i.fechaPago || n.fechaPago || '' }))
  );
  let cobrado = 0;
  let donde = '';
  let dejo = '';
  for (const p of pagos) {
    for (const d of p.i.descuentos || []) {
      if (d.creditoId === c.id && d.monto > 0) {
        cobrado += d.monto;
        donde = `${periodoLabel(p.n)}${p.fechaPago ? `, pagada el ${p.fechaPago}` : ''}`;
      }
    }
    for (const pend of p.i.pendientes || []) {
      if (pend.creditoId === c.id && pend.saldo > 0) dejo = periodoLabel(p.n);
    }
  }
  const salto = pagosSinMetaCuota(c).some(a => (Number(a.monto) || 0) <= 0 && /no se cobr/i.test(String(a.nota || '')));
  if (salto && !dejo) dejo = 'ese pago';
  const misma = pagos.some(p => p.n.periodo === periodoDeuda && p.n.mes === mes && p.n.año === año);
  const otro = pagos.find(p => !(p.n.periodo === periodoDeuda && p.n.mes === mes && p.n.año === año));
  const falta = cobrado > 0 ? Math.max(0, Math.min(c.saldo, c.monto - cobrado)) : c.saldo;
  return { quincena, falta, cobrado, donde, dejo, misma, otro: otro ? periodoLabel(otro.n) : '' };
}

const esConsumoProductos = (c: CreditoTrabajador) =>
  Array.isArray(c.items) && c.items.some(i => !!i.productoId);

const NOTA_CUOTA = 'cuota:';

/** Cuota acordada. Si la nube no trae el campo, se lee de una nota guardada en los pagos. */
const cuotaDe = (c: CreditoTrabajador): number => {
  const directa = Number(c.cuota) || 0;
  if (directa > 0) return directa;
  const meta = (c.pagos || []).find(p => String(p.nota || '').startsWith(NOTA_CUOTA));
  const n = meta ? Number(String(meta.nota).slice(NOTA_CUOTA.length)) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pagosSinMetaCuota = (c: CreditoTrabajador): PagoCredito[] =>
  (Array.isArray(c.pagos) ? c.pagos : []).filter(p => !String(p.nota || '').startsWith(NOTA_CUOTA));

const pagosConCuota = (c: CreditoTrabajador, cuota: number): PagoCredito[] => {
  const limpios = pagosSinMetaCuota(c);
  if (cuota <= 0) return limpios;
  return [...limpios, {
    id: `meta-cuota-${c.id}`,
    creditoId: c.id,
    monto: 0,
    fecha: c.fecha,
    metodoPago: 'otro',
    nota: `${NOTA_CUOTA}${cuota}`,
  }];
};

const mesesDesde = (fecha: string): number => {
  const inicio = new Date(fecha);
  if (Number.isNaN(inicio.getTime())) return 0;
  const hoy = new Date();
  return Math.max(0, (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth()));
};

/** Día en que se anotó el préstamo o el consumo. Si no trae fecha, se trata como anterior. */
const fechaDeCredito = (c: CreditoTrabajador): string => {
  const y = ymdLocal(c.fecha || c.createdAt);
  return y || '1970-01-01';
};

/** Entra en esta quincena si se anotó el último día de ella o antes.
 *  Lo del 16 en adelante no entra en la primera (que cierra el 15). */
const entraEnQuincena = (c: CreditoTrabajador, fin: string): boolean => fechaDeCredito(c) <= fin;

// Cuánto se descuenta hoy: un número escrito a mano, o la cuota acordada, o todo el saldo si no hay cuota.
// Un cero guardado ya no apaga el cobro: "hoy no se descuenta" quedó deshabilitado.
const montoACobrar = (c: CreditoTrabajador, parciales: Record<string, number>): number => {
  const manual = parciales[c.id];
  if (typeof manual === 'number' && manual > 0) return Math.min(manual, c.saldo);
  if (!c.descontarDeSalario) return 0;
  const cuota = esConsumoProductos(c) ? 0 : cuotaDe(c);
  if (cuota > 0) return Math.min(c.saldo, cuota);
  return Math.min(c.saldo, c.monto > 0 ? c.monto : c.saldo);
};

// ── Asistencia por día (control de turno + marcas manuales + horario habitual) ──
interface DiaInfo {
  fecha: string;
  dow: number;                 // 0 = domingo
  conRegistro: boolean;        // presionó "Llegué" ese día
  marcado: boolean;            // se marcó "sí vino" a mano en Nómina
  vino: boolean;
  esperado: boolean;           // le toca trabajar según su horario (true si no se pudo leer el horario)
  futuro: boolean;
  entrada?: string;
  salida?: string;
  salidaOlvidada: boolean;     // llegó pero no presionó "Me voy" (día ya pasado)
  mins: number;
}
interface HorarioUsado { dias: number[] | null; entrada: string | null; salida: string | null; deTrabajadores: boolean }

function analizarDias(
  t: Trabajador, diasPeriodo: string[], mapa: Map<string, RegistroAsistencia[]>,
  marcados: string[], habituales: { entrada: string; salida: string } | undefined, hoy: string,
): { dias: DiaInfo[]; horario: HorarioUsado } {
  const p = parseHorario(t.horario);
  const horario: HorarioUsado = {
    dias: p.dias,
    entrada: p.entrada ?? (habituales?.entrada || null),
    salida: p.salida ?? (habituales?.salida || null),
    deTrabajadores: p.entrada !== null,
  };
  const dias = diasPeriodo.map((fecha): DiaInfo => {
    const regs = mapa.get(`${t.id}_${fecha}`) ?? [];
    const conRegistro = regs.length > 0;
    const marcado = !conRegistro && marcados.includes(fecha);
    const dow = diaSemana(fecha);
    const esperado = horario.dias ? horario.dias.includes(dow) : true;
    let mins = 0; let abierta: string | null = null;
    for (const r of regs) {
      if (r.tipo === 'entrada') abierta = r.hora;
      else if (r.tipo === 'salida' && abierta) { mins += minutosEntre(abierta, r.hora); abierta = null; }
    }
    const futuro = fecha > hoy;
    const salidaOlvidada = abierta !== null && fecha < hoy;
    if (salidaOlvidada && horario.salida) mins += minutosEntre(abierta!, horario.salida);
    if (marcado && horario.entrada && horario.salida) mins = minutosEntre(horario.entrada, horario.salida);
    return {
      fecha, dow, conRegistro, marcado, vino: conRegistro || marcado, esperado, futuro, salidaOlvidada, mins,
      entrada: regs.find(r => r.tipo === 'entrada')?.hora ?? (marcado ? horario.entrada ?? undefined : undefined),
      salida: [...regs].reverse().find(r => r.tipo === 'salida')?.hora ?? (marcado ? horario.salida ?? undefined : undefined),
    };
  });
  return { dias, horario };
}

const MOTIVOS: Record<string, string> = {
  retiro_voluntario:    'Retiro voluntario',
  mutuo_acuerdo:        'Mutuo acuerdo',
  despido_justa_causa:  'Despido con justa causa',
  despido_sin_justa:    'Despido sin justa causa',
  terminacion_contrato: 'Terminación del contrato',
  otro:                 'Otro',
};

// ── CreditCard ─────────────────────────────────────────────────────────────

interface CreditCardProps {
  c: CreditoTrabajador;
  parciales: Record<string, number>;
  setParciales: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  estaPageada: boolean;
  descuentoGuardado?: { monto: number };
  onEditar?: () => void;
  onEliminar?: () => void;
  onGuardarCuota?: (cuota: number) => void;
  formatCurrency: (n: number) => string;
}

function CreditCard({ c, parciales, setParciales, estaPageada, descuentoGuardado, onEditar, onEliminar, formatCurrency }: CreditCardProps) {
  const saldo = c.saldo;
  const montoActual  = montoACobrar(c, parciales);
  const quedaDespues = Math.max(0, saldo - montoActual);
  const cuota        = esConsumoProductos(c) ? 0 : cuotaDe(c);
  const cuotaHoy     = Math.min(saldo, cuota);
  const cobraCuota   = cuotaHoy > 0 && montoActual === cuotaHoy && montoActual < saldo;
  const cobraTodo    = montoActual >= saldo && montoActual > 0;
  const noCobra      = montoActual <= 0;
  const cobraParte   = !noCobra && !cobraTodo && !cobraCuota;
  const isProducto   = esConsumoProductos(c);
  const movimientos  = pagosSinMetaCuota(c);
  const cobradas     = movimientos.filter(p => (Number(p.monto) || 0) > 0);
  const saltadas     = movimientos.filter(p => (Number(p.monto) || 0) <= 0);
  const pagado       = Math.max(0, (Number(c.monto) || 0) - saldo);
  const cuotasDelPrestamo = cuota > 0 ? Math.ceil((Number(c.monto) || 0) / cuota) : 0;
  const elegir = (monto: number) => setParciales(prev => ({ ...prev, [c.id]: Math.max(0, Math.min(monto, saldo)) }));
  const btnBase = 'flex-1 px-2 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-50';
  const btnOff  = 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300';

  if (!isProducto) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-white dark:bg-gray-900 p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Préstamo</p>
            <p className="text-sm font-black text-gray-900 dark:text-white">{c.descripcion || 'Sin motivo'}</p>
          </div>
          {!estaPageada && (onEditar || onEliminar) && (
            <div className="flex items-center gap-1 shrink-0">
              {onEditar && <button onClick={onEditar} title="Corregir el total o la cuota" className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-400"><Pencil className="w-3.5 h-3.5" /></button>}
              {onEliminar && <button onClick={onEliminar} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
            <p className="text-[10px] font-bold text-slate-500">Se le prestó</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(c.monto)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2">
            <p className="text-[10px] font-bold text-emerald-700">Ya pagó</p>
            <p className="text-sm font-black text-emerald-700">{formatCurrency(pagado)}</p>
          </div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2">
            <p className="text-[10px] font-bold text-rose-700">Todavía debe</p>
            <p className="text-sm font-black text-rose-700">{formatCurrency(saldo)}</p>
          </div>
        </div>

        {estaPageada && (
          <p className="text-xs font-semibold">
            {descuentoGuardado
              ? <span className="text-rose-600">Esta quincena se le descontó {formatCurrency(descuentoGuardado.monto)}</span>
              : <span className="text-amber-700">Esta quincena no se le descontó nada</span>}
          </p>
        )}

        {movimientos.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lo que ya pasó</p>
            <ul className="max-h-32 overflow-auto space-y-0.5">
              {[...movimientos].reverse().map(p => (
                <li key={p.id} className={`flex justify-between gap-2 text-[11px] ${(Number(p.monto) || 0) > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <span className="truncate">{p.nota || p.fecha}</span>
                  <span className="font-bold shrink-0">{(Number(p.monto) || 0) > 0 ? `-${formatCurrency(p.monto)}` : 'No se cobró'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-3 py-2 ${isProducto ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isProducto && <ShoppingBag className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {c.descripcion || (isProducto ? 'Consumo de productos' : 'Préstamo')}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Prestado {formatCurrency(c.monto)} · Lleva pagado {formatCurrency(pagado)} · Falta <span className="font-bold">{formatCurrency(saldo)}</span>
          </p>
          {!isProducto && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {mesesDesde(c.fecha)} {mesesDesde(c.fecha) === 1 ? 'mes' : 'meses'} desde el préstamo
              {cuota > 0 && <> · Cuota {formatCurrency(cuota)} · {cobradas.length}{cuotasDelPrestamo > 0 ? ` de ~${cuotasDelPrestamo}` : ''} cobradas · {saltadas.length} sin cobrar</>}
            </p>
          )}
          {isProducto && (
            <div className="mt-1.5 space-y-0.5">
              {c.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{item.nombre} × {item.cantidad}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!estaPageada && (onEditar || onEliminar) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEditar && <button onClick={onEditar} className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-400 hover:text-rose-600"><Pencil className="w-3.5 h-3.5" /></button>}
            {onEliminar && <button onClick={onEliminar} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        )}
      </div>
      {estaPageada ? (
        <div className="mt-2 text-xs font-semibold">
          {descuentoGuardado
            ? <span className="text-rose-600 dark:text-rose-400">Se descontó {formatCurrency(descuentoGuardado.monto)} en esta quincena</span>
            : <span className="text-gray-500 dark:text-gray-400">No se cobró en esta quincena</span>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            ¿Cuánto cobrar en esta quincena?
          </p>
          <div className="flex gap-2">
            {cuotaHoy > 0 && cuotaHoy < saldo && (
              <button type="button" onClick={() => elegir(cuotaHoy)}
                className={`${btnBase} ${cobraCuota ? 'bg-violet-600 border-violet-600 text-white shadow' : btnOff}`}>
                Descontar cuota
                <span className="block text-[11px] font-black">{formatCurrency(cuotaHoy)}</span>
              </button>
            )}
            <button type="button" onClick={() => elegir(saldo)}
              className={`${btnBase} ${cobraTodo ? 'bg-emerald-600 border-emerald-600 text-white shadow' : btnOff}`}>
              {cuotaHoy > 0 && cuotaHoy >= saldo ? 'Descontar lo que falta' : 'Cobrar todo'}
              <span className="block text-[11px] font-black">{formatCurrency(saldo)}</span>
            </button>
          </div>
          <div className={`rounded-lg px-3 py-2 text-xs font-semibold
            ${noCobra ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                      : cobraTodo ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300'}`}>
            {noCobra && <>Escribe el número de esta quincena. Sigue debiendo {formatCurrency(saldo)}.</>}
            {cobraTodo && <>Se descuenta {formatCurrency(montoActual)} y el préstamo queda pagado.</>}
            {cobraCuota && <>Hoy se descuenta la cuota de {formatCurrency(montoActual)}. Quedará debiendo {formatCurrency(quedaDespues)}.</>}
            {cobraParte && <>Hoy se descuenta {formatCurrency(montoActual)}. Quedará debiendo {formatCurrency(quedaDespues)}.</>}
          </div>
          {!isProducto && movimientos.length > 0 && (
            <ul className="max-h-28 overflow-auto space-y-0.5 border-t border-black/5 pt-1">
              {[...movimientos].reverse().slice(0, 8).map(p => (
                <li key={p.id} className={`flex justify-between gap-2 text-[11px] ${(Number(p.monto) || 0) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                  <span className="truncate">{p.nota || p.fecha}</span>
                  <span className="font-bold shrink-0">{(Number(p.monto) || 0) > 0 ? `-${formatCurrency(p.monto)}` : 'No se cobró'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal de préstamo ──────────────────────────────────────────────────────

const ESTADO_CREDITO_VACÍO = { descripcion: '', monto: 0, saldo: 0, cuota: 0, descontarDeSalario: true, estado: 'activo' as const };

interface LoanModal { trabajadorId: string; trabajadorNombre: string; credito?: CreditoTrabajador; }

// ── Componente principal ───────────────────────────────────────────────────

type Tab = 'liquidar' | 'historial' | 'deudas' | 'liquidacion' | 'acuerdos';

export default function Nomina({
  trabajadores, asistencia, creditosTrabajadores, nominas,
  onAddNomina, onUpdateNomina, onAddGasto, onAddAsistencia,
  onAddCreditoTrabajador, onUpdateCreditoTrabajador, onDeleteCreditoTrabajador,
  formatCurrency, onBack,
}: NominaProps) {

  const [tab, setTab] = useState<Tab>('liquidar');
  const hoy = quincenaActual();
  const [periodo, setPeriodo] = useState<'primera' | 'segunda'>(hoy.periodo);
  const [mes, setMes] = useState(hoy.mes);
  const [año, setAño] = useState(hoy.año);
  const [pagando, setPagando] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  // Cobro de más, solo esta quincena. No toca el préstamo ni la cuota.
  const [cobroExtra, setCobroExtra] = useState<Record<string, { texto: string; monto: string }>>({});
  // Días a restar (no vino) / sumar (día extra, doble turno, reemplazo) y valor de cada día, por trabajadora
  const [diasMenos, setDiasMenos] = useState<Record<string, number>>({});
  const [diasExtra, setDiasExtra] = useState<Record<string, number>>({});
  const [valorDiaEdit, setValorDiaEdit] = useState<Record<string, number>>({});
  // Días que se marcaron "sí vino" a mano (no presionó "Llegué"), por trabajadora. Se guardan al guardar el pago.
  const [diasVino, setDiasVino] = useState<Record<string, string[]>>({});
  // Hora de entrada/salida habitual cuando el horario escrito en Trabajadores no se puede leer
  const [horasHabituales, setHorasHabituales] = useState<Record<string, { entrada: string; salida: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('nomina_horas_habituales') || '{}'); } catch { return {}; }
  });
  const [guardandoSalidas, setGuardandoSalidas] = useState(false);
  const [parciales, setParciales] = useState<Record<string, number>>({});
  const [obsModal, setObsModal] = useState(false);
  const [pagoObjetivo, setPagoObjetivo] = useState<string>('todos'); // id de la trabajadora a pagar, o 'todos'
  const [obsText, setObsText]   = useState('');
  const [loanModal, setLoanModal] = useState<LoanModal | null>(null);
  const [loanForm, setLoanForm]   = useState(ESTADO_CREDITO_VACÍO);
  const [loanSaving, setLoanSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CreditoTrabajador | null>(null);
  const [selectedNomina, setSelectedNomina] = useState<NominaQuincenal | null>(null);
  const { isAdmin, role, usuario } = useCan();
  const puedeEditarNomina = isAdmin || role === 'GERENTE';
  const [buscaHist, setBuscaHist] = useState('');
  const [filtroQuincena, setFiltroQuincena] = useState<'todas' | 'primera' | 'segunda'>('todas');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [editPago, setEditPago] = useState<{
    nominaId: string;
    trabajadorId: string;
    nombre: string;
    bruto: string;
    descuentos: { concepto: string; monto: string }[];
    nota: string;
    bovedas: { id: string; nombre: string; monto: string }[];
  } | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [fondos, setFondos] = useState<{ clave: string; tipo: 'caja' | 'boveda'; id: string; nombre: string; disponible: number }[]>([]);
  const [montosFondo, setMontosFondo] = useState<Record<string, string>>({});
  const [cargandoFondos, setCargandoFondos] = useState(false);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  // 'estricto_asistencia' descuenta automáticamente los días no asistidos; 'quincena_completa' asume quincena completa salvo ajustes
  const [modoCalculo, setModoCalculo] = useState<'quincena_completa' | 'estricto_asistencia'>('quincena_completa');

  // ── Estado acuerdo de confidencialidad ────────────────────────────────
  const [acTrabId, setAcTrabId]       = useState('');
  const [acFecha, setAcFecha]         = useState(fechaLocalHoy());
  const [acRecetasExtra, setAcRecetasExtra] = useState('');

  // ── Estado liquidación ──────────────────────────────────────────────────
  const hoyStr = fechaLocalHoy();
  const [liqTrabId, setLiqTrabId]     = useState('');
  const [liqFecha, setLiqFecha]       = useState(hoyStr);
  const [liqMotivo, setLiqMotivo]     = useState('retiro_voluntario');
  const [liqMotivoOtro, setLiqMotivoOtro] = useState('');
  const [liqDiasManual, setLiqDiasManual] = useState<number | ''>('');
  const [liqAjuste, setLiqAjuste]     = useState<number>(0);
  const [liqAjusteLabel, setLiqAjusteLabel] = useState('');
  const [liqObs, setLiqObs]           = useState('');
  const [liqParciales, setLiqParciales] = useState<Record<string, number | false>>({}); // false = no descontar

  // ── Período nav ────────────────────────────────────────────────────────
  function limpiarEdicionesDeDias() {
    setAjustes({}); setDiasMenos({}); setDiasExtra({}); setValorDiaEdit({}); setDiasVino({}); setExpandedWorker(null);
  }
  function anteriorQuincena() {
    limpiarEdicionesDeDias();
    if (periodo === 'segunda') { setPeriodo('primera'); }
    else { setPeriodo('segunda'); const prev = new Date(año, mes - 2, 1); setMes(prev.getMonth() + 1); setAño(prev.getFullYear()); }
  }
  function siguienteQuincena() {
    const q = quincenaActual();
    if (periodo === q.periodo && mes === q.mes && año === q.año) return;
    limpiarEdicionesDeDias();
    if (periodo === 'primera') { setPeriodo('segunda'); }
    else { setPeriodo('primera'); const next = new Date(año, mes, 1); setMes(next.getMonth() + 1); setAño(next.getFullYear()); }
  }

  const rango       = useMemo(() => rangoQuincena(periodo, mes, año), [periodo, mes, año]);
  const diasPeriodo = useMemo(() => diasEnRango(rango.inicio, rango.fin), [rango]);
  const esActual    = periodo === hoy.periodo && mes === hoy.mes && año === hoy.año;

  const nominaExistente = useMemo(() =>
    nominas.find(n => n.periodo === periodo && n.mes === mes && n.año === año),
    [nominas, periodo, mes, año]
  );

  const trabajadoresActivos = trabajadores.filter(t => t.estado === 'activo');

  const asistenciaMap = useMemo(() => {
    const map = new Map<string, RegistroAsistencia[]>();
    for (const r of asistencia) {
      const key = `${r.trabajadorId}_${r.fecha}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Ordenamos previamente para no hacerlo en cada render
    for (const regs of map.values()) {
      regs.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    return map;
  }, [asistencia]);

  const hoyLocal = fechaLocalHoy();

  // ── Cálculo items nómina ───────────────────────────────────────────────
  const itemsVivos = useMemo((): (NominaItem & { _totalMins: number; _diasFaltados: number })[] => {
    return trabajadoresActivos.map(t => {
      // Asistencia real + días marcados "sí vino" a mano + salidas olvidadas completadas con su horario
      const an = analizarDias(t, diasPeriodo, asistenciaMap, diasVino[t.id] ?? [], horasHabituales[t.id], hoyLocal);
      const diasTrabajados = an.dias.filter(d => d.vino).length;
      const totalMins = an.dias.reduce((s, d) => s + d.mins, 0);

      // Si tiene horario legible (ej. "Lun-Sáb 7am-3pm") solo cuentan los días que le tocan;
      // si no, se cuentan todos los días de la quincena como antes.
      const conHorario = an.horario.dias !== null;
      const diasEsperados = conHorario ? an.dias.filter(d => d.esperado).length : diasPeriodo.length;
      const diasCumplidos = conHorario ? an.dias.filter(d => d.esperado && d.vino).length : diasTrabajados;
      const diasFaltados = Math.max(0, diasEsperados - diasCumplidos);
      const valorBase  = t.salarioBase / 2;
      
      // Si el modo es 'estricto_asistencia', descuenta los días que no asistió:
      // Si el modo es 'quincena_completa', paga la quincena base y permite ajustes manuales o alertas
      let valorBrutoCalculado = valorBase;
      if (modoCalculo === 'estricto_asistencia') {
        const proporcion = diasEsperados > 0 ? Math.min(1, diasCumplidos / diasEsperados) : 0;
        valorBrutoCalculado = Math.round(valorBase * proporcion);
      }

      // Valor de un día = lo que la trabajadora gana por día (salario mensual ÷ 30), editable.
      const valorDia = Math.max(0, valorDiaEdit[t.id] ?? Math.round(t.salarioBase / 30));
      // En modo "estricto" las faltas ya se descuentan solas por proporción de asistencia.
      // En modo "quincena_completa": si el usuario NO editó manualmente el campo, se auto-aplican
      // los días faltados detectados (diasFaltados). El usuario puede sobrescribir poniendo 0 u otro número.
      const diasMenosAplicados = modoCalculo === 'estricto_asistencia'
        ? 0
        : Math.max(0, diasMenos[t.id] !== undefined ? diasMenos[t.id] : diasFaltados);
      const diasExtraAplicados = Math.max(0, diasExtra[t.id] ?? 0);
      const montoDiasMenos = Math.round(diasMenosAplicados * valorDia);
      const montoDiasExtra = Math.round(diasExtraAplicados * valorDia);
      const valorBruto = Math.max(0, valorBrutoCalculado - montoDiasMenos + montoDiasExtra + (ajustes[t.id] ?? 0));
      const credActivos = creditosTrabajadores.filter(
        c => c.trabajadorId === t.id && c.estado === 'activo' && c.saldo > 0 && entraEnQuincena(c, rango.fin)
      );
      const descuentos = credActivos
        .map(c => {
          const monto = montoACobrar(c, parciales);
          return {
            concepto: c.descripcion || (esConsumoProductos(c) ? 'Consumo' : 'Préstamo'),
            monto,
            creditoId: c.id,
            saldoRestante: Math.max(0, c.saldo - monto),
          };
        })
        .filter(d => d.monto > 0);
      const extra = cobroExtra[t.id];
      const montoExtra = Math.max(0, Number(extra?.monto) || 0);
      const descuentosConExtra = montoExtra > 0
        ? [...descuentos, { concepto: (extra?.texto || '').trim() || 'Cobro adicional', monto: montoExtra }]
        : descuentos;
      const pendientes = credActivos
        .map(c => ({
          creditoId: c.id,
          concepto: c.descripcion || (esConsumoProductos(c) ? 'Consumo' : 'Préstamo'),
          saldo: Math.max(0, c.saldo - montoACobrar(c, parciales)),
        }))
        .filter(p => p.saldo > 0);
      const totalDescuentos = descuentosConExtra.reduce((s, d) => s + d.monto, 0);
      return {
        pendientes,
        valorBase: valorBrutoCalculado, valorDia,
        diasMenos: diasMenosAplicados, diasExtra: diasExtraAplicados,
        diasVinoManual: an.dias.filter(d => d.marcado).map(d => d.fecha),
        trabajadorId: t.id, trabajadorNombre: t.nombre, salarioBase: t.salarioBase,
        diasTrabajados, totalDiasPeriodo: diasPeriodo.length, valorBruto,
        descuentos: descuentosConExtra, totalDescuentos, valorNeto: Math.max(0, valorBruto - totalDescuentos),
        _totalMins: totalMins,
        _diasFaltados: diasFaltados,
      };
    });
  }, [trabajadoresActivos, asistenciaMap, creditosTrabajadores, diasPeriodo, rango.fin, ajustes, cobroExtra, diasMenos, diasExtra, valorDiaEdit, diasVino, horasHabituales, hoyLocal, parciales, modoCalculo]);

  // Cada trabajadora se paga por separado: las ya pagadas quedan "congeladas" tal como se guardaron;
  // las demás siguen calculándose en vivo.
  type ItemNomina = NominaItem & { _totalMins: number; _diasFaltados: number; _pagado: boolean };
  const items = useMemo((): ItemNomina[] => {
    const guardados = new Map<string, NominaItem>(
      (Array.isArray(nominaExistente?.items) ? nominaExistente!.items : []).map(i => [i.trabajadorId, i])
    );
    const vivosIds = new Set(itemsVivos.map(v => v.trabajadorId));
    const mezclados: ItemNomina[] = itemsVivos.map(v => {
      const g = guardados.get(v.trabajadorId);
      return g
        ? { ...g, _totalMins: v._totalMins, _diasFaltados: v._diasFaltados, _pagado: true }
        : { ...v, _pagado: false };
    });
    const extras: ItemNomina[] = [...guardados.values()]
      .filter(g => !vivosIds.has(g.trabajadorId))
      .map(g => ({ ...g, _totalMins: 0, _diasFaltados: 0, _pagado: true }));
    return [...mezclados, ...extras];
  }, [itemsVivos, nominaExistente]);

  // Líneas "− N días que no vino" / "+ N días de más" / ajuste, para mostrarlas en la cuenta de cada trabajadora
  const lineasDias = (i: NominaItem) => {
    const vDia = i.valorDia ?? Math.round(i.salarioBase / 30);
    const mMenos = Math.round((i.diasMenos ?? 0) * vDia);
    const mExtra = Math.round((i.diasExtra ?? 0) * vDia);
    const base = i.valorBase ?? i.valorBruto;
    const otro = i.valorBruto - (base - mMenos + mExtra);
    return (<>
      {mMenos > 0 && (
        <div className="flex justify-between text-rose-600 dark:text-rose-400">
          <span>− {i.diasMenos} {i.diasMenos === 1 ? 'día' : 'días'} que no vino ({formatCurrency(vDia)} c/u)</span>
          <span className="font-semibold">-{formatCurrency(mMenos)}</span>
        </div>
      )}
      {mExtra > 0 && (
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
          <span>+ {i.diasExtra} {i.diasExtra === 1 ? 'día' : 'días'} de más ({formatCurrency(vDia)} c/u)</span>
          <span className="font-semibold">+{formatCurrency(mExtra)}</span>
        </div>
      )}
      {otro !== 0 && (
        <div className={`flex justify-between ${otro > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          <span>{otro > 0 ? '+' : '−'} Ajuste manual</span>
          <span className="font-semibold">{otro > 0 ? '+' : '-'}{formatCurrency(Math.abs(otro))}</span>
        </div>
      )}
      {(i.diasVinoManual?.length ?? 0) > 0 && (
        <div className="text-[11px] text-violet-600 dark:text-violet-400">
          Días marcados a mano como "sí vino": {i.diasVinoManual!.map(f => `${NOMBRE_DIA_CORTO[diaSemana(f)]} ${Number(f.slice(8, 10))}`).join(', ')}
        </div>
      )}
    </>);
  };

  const itemsPorPagar = items.filter(i => !i._pagado);
  const totalDescuentos = itemsPorPagar.reduce((s, i) => s + i.totalDescuentos, 0);
  const totalNeto       = itemsPorPagar.reduce((s, i) => s + i.valorNeto, 0);

  const pendientesProxima = useMemo(() => {
    const pagadosIds = new Set(items.filter(i => i._pagado).map(i => i.trabajadorId));
    const ids = new Set(trabajadoresActivos.filter(t => !pagadosIds.has(t.id)).map(t => t.id));
    return creditosTrabajadores
      .filter(c => ids.has(c.trabajadorId) && c.estado === 'activo' && c.saldo > 0 && entraEnQuincena(c, rango.fin))
      .map(c => ({
        id: c.id,
        trabajadorId: c.trabajadorId,
        nombre: c.trabajadorNombre || trabajadoresActivos.find(t => t.id === c.trabajadorId)?.nombre || '',
        concepto: c.descripcion || (esConsumoProductos(c) ? 'Consumo de productos' : 'Préstamo'),
        queda: c.saldo - montoACobrar(c, parciales),
      }))
      .filter(p => p.queda > 0);
  }, [creditosTrabajadores, trabajadoresActivos, parciales, items, rango.fin]);

  // ── Cálculo liquidación ────────────────────────────────────────────────
  const trabajadorLiq = trabajadores.find(t => t.id === liqTrabId);

  const liqDiasAuto = useMemo(() => {
    if (!liqTrabId || !liqFecha) return 0;
    // Última nómina pagada de este trabajador
    const ultimaNomina = [...nominas]
      .filter(n => n.estado === 'pagada' && n.items.some(i => i.trabajadorId === liqTrabId))
      .sort((a, b) => (b.fechaPago || '').localeCompare(a.fechaPago || ''))
      [0];
    const desde = ultimaNomina?.fechaFin
      ? (() => { const d = new Date(ultimaNomina.fechaFin + 'T00:00:00'); d.setDate(d.getDate() + 1); return ymdLocal(d); })()
      : trabajadorLiq?.fechaIngreso || hoyStr;
    const rAngoDias = diasEnRango(desde, liqFecha);
    
    // Usar el asistenciaMap para O(1)
    let count = 0;
    for (const fecha of rAngoDias) {
      if (asistenciaMap.has(`${liqTrabId}_${fecha}`)) count++;
    }
    return count;
  }, [liqTrabId, liqFecha, nominas, asistenciaMap, trabajadorLiq, hoyStr]);

  const liqDias        = liqDiasManual !== '' ? Number(liqDiasManual) : liqDiasAuto;
  const liqValorDias   = trabajadorLiq ? Math.round(trabajadorLiq.salarioBase / 30 * liqDias) : 0;
  const credLiq        = creditosTrabajadores.filter(
    c => c.trabajadorId === liqTrabId && c.estado === 'activo' && c.saldo > 0
  );
  const liqTotalDesc   = credLiq.reduce((sum, c) => {
    const val = liqParciales[c.id];
    if (val === false || val === undefined) return sum;
    const monto = typeof val === 'number' ? Math.min(val, c.saldo) : c.saldo;
    return sum + monto;
  }, 0);
  const liqNeto = Math.max(0, liqValorDias + liqAjuste - liqTotalDesc);

  // ── Control de turno: dejar anotado lo marcado a mano y las salidas olvidadas ──────
  const registrosACrear = (t: Trabajador) => {
    const an = analizarDias(t, diasPeriodo, asistenciaMap, diasVino[t.id] ?? [], horasHabituales[t.id], hoyLocal);
    const lista: Omit<RegistroAsistencia, 'id' | 'createdAt'>[] = [];
    const base = { trabajadorId: t.id, trabajadorNombre: t.nombre };
    for (const d of an.dias) {
      if (d.marcado && an.horario.entrada && an.horario.salida) {
        lista.push({ ...base, tipo: 'entrada', fecha: d.fecha, hora: an.horario.entrada, origen: 'manual' });
        lista.push({ ...base, tipo: 'salida', fecha: d.fecha, hora: an.horario.salida, origen: 'manual' });
      } else if (d.salidaOlvidada && an.horario.salida && (d.entrada ?? '') < an.horario.salida) {
        lista.push({ ...base, tipo: 'salida', fecha: d.fecha, hora: an.horario.salida, origen: 'salida-automatica' });
      }
    }
    return lista;
  };
  const guardarRegistros = async (t: Trabajador): Promise<number> => {
    if (!onAddAsistencia) return 0;
    const lista = registrosACrear(t);
    for (const r of lista) await onAddAsistencia(r);
    return lista.length;
  };
  async function guardarEnControlDeTurno(t: Trabajador) {
    setGuardandoSalidas(true);
    try {
      const n = await guardarRegistros(t);
      setDiasVino(prev => ({ ...prev, [t.id]: [] }));
      toast.success(n > 0 ? `Listo: se anotaron ${n} registros de ${t.nombre} en Control de turno` : 'No había nada que anotar');
    } catch (e) { console.error(e); toast.error('No se pudo guardar en Control de turno'); }
    finally { setGuardandoSalidas(false); }
  }

  // ── Pagar nómina ───────────────────────────────────────────────────────
  // Se paga a UNA trabajadora (pagoObjetivo = su id) o a todas las pendientes (pagoObjetivo = 'todos').
  const itemsDelPago = pagoObjetivo === 'todos'
    ? itemsPorPagar
    : itemsPorPagar.filter(i => i.trabajadorId === pagoObjetivo);
  const pagoNeto       = itemsDelPago.reduce((s, i) => s + i.valorNeto, 0);
  const pagoDescuentos = itemsDelPago.reduce((s, i) => s + i.totalDescuentos, 0);
  const partesFondo: { tipo: 'caja' | 'boveda'; id: string; nombre: string; monto: number }[] = fondos
    .map(f => ({ tipo: f.tipo, id: f.id, nombre: f.nombre, monto: Math.max(0, Math.round(Number(montosFondo[f.clave]) || 0)) }))
    .filter(p => p.monto > 0);
  const sumaFondos = partesFondo.reduce((s, p) => s + p.monto, 0);
  const fondosCuadran = pagoNeto <= 0 || sumaFondos === Math.round(pagoNeto);

  useEffect(() => {
    if (!obsModal) return;
    let vivo = true;
    setCargandoFondos(true);
    db.getAllSesionesCaja().then(lista => {
      if (!vivo) return;
      const abiertas = (lista as CajaSesion[]).filter(s => s.estado === 'abierta' && esCajaPrincipal(s.cajaNombre));
      const deHoy = abiertas.map(s => ({
        clave: `caja:${s.id}`,
        tipo: 'caja' as const,
        id: s.id,
        nombre: s.cajaNombre || 'Caja Principal',
        disponible: plataEnCaja(s),
      }));
      const guardadas = getBovedas().map(b => ({
        clave: `boveda:${b.id}`,
        tipo: 'boveda' as const,
        id: b.id,
        nombre: b.nombre,
        disponible: Math.max(0, Math.round(Number(b.saldo) || 0)),
      }));
      setFondos([...deHoy, ...guardadas]);
      setMontosFondo({});
    }).catch(() => {
      if (!vivo) return;
      setFondos(getBovedas().map(b => ({
        clave: `boveda:${b.id}`,
        tipo: 'boveda' as const,
        id: b.id,
        nombre: b.nombre,
        disponible: Math.max(0, Math.round(Number(b.saldo) || 0)),
      })));
    }).finally(() => { if (vivo) setCargandoFondos(false); });
    return () => { vivo = false; };
  }, [obsModal]);

  const pagarNomina = useCallback(async () => {
    if (itemsDelPago.length === 0) return;
    const neto = Math.round(itemsDelPago.reduce((s, i) => s + i.valorNeto, 0));
    const partes = partesFondo;
    if (neto > 0 && partes.reduce((s, p) => s + p.monto, 0) !== neto) {
      toast.error('La plata de la Caja Principal y de las bóvedas tiene que sumar exactamente el pago');
      return;
    }
    setPagando(true);
    try {
      const fechaHoy = fechaLocalHoy();
      const etiquetaQuincena = `${periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[mes]} ${año}`;
      const motivo = `Nómina ${etiquetaQuincena} · ${itemsDelPago.map(i => i.trabajadorNombre).join(', ')}`;
      for (const parte of partes) {
        if (parte.tipo === 'boveda') {
          addMovimientoBoveda({
            bovedaOrigenId: parte.id,
            monto: parte.monto,
            motivo,
            tipo: 'Egreso',
            usuarioResponsable: usuario?.nombre || 'Dueño',
            metodoPago: 'Efectivo',
          });
        } else {
          const lista = await db.getAllSesionesCaja() as CajaSesion[];
          const sesion = lista.find(s => s.id === parte.id && s.estado === 'abierta');
          if (!sesion) throw new Error('La Caja Principal ya no está abierta');
          const mov: MovimientoCaja = {
            id: crypto.randomUUID(),
            cajaId: parte.id,
            tipo: 'salida',
            monto: parte.monto,
            motivo,
            fecha: new Date().toISOString(),
            usuarioId: usuario?.id || 'dueño',
          };
          const updated = { ...sesion, movimientos: [...(sesion.movimientos || []), mov] };
          await db.updateSesionCaja(updated);
          const { supabaseDB } = await import('@/lib/supabase-sync-bridge');
          supabaseDB.updateSesionCaja(updated as any).catch(() => {});
          window.dispatchEvent(new Event('dp_sesiones_caja_changed'));
        }
      }
      const origenes: NominaOrigenPago[] = partes.map(p => ({ tipo: p.tipo, nombre: p.nombre, monto: p.monto }));
      const notaFondos = origenes.length > 0 ? `Salió de ${textoOrigenes(origenes)}` : '';
      const guardados: NominaItem[] = [];
      for (const item of itemsDelPago) {
        let gastoId: string | undefined;
        if (item.valorNeto > 0) {
          const gasto = await onAddGasto({
            id: crypto.randomUUID(), fecha: fechaHoy, categoria: 'nomina',
            descripcion: `Nómina ${etiquetaQuincena} · ${item.trabajadorNombre}`,
            monto: item.valorNeto, metodoPago: 'efectivo', proveedor: '',
            notas: [obsText, itemsDelPago.length === 1 ? notaFondos : ''].filter(Boolean).join(' · '),
            createdAt: new Date().toISOString(),
          });
          gastoId = gasto?.id;
        }
        const credsDeEsta = creditosTrabajadores.filter(c =>
          c.trabajadorId === item.trabajadorId && c.estado === 'activo' && c.saldo > 0 && entraEnQuincena(c, rango.fin)
        );
        for (const cred of credsDeEsta) {
          const desc = item.descuentos.find(d => d.creditoId === cred.id);
          const monto = desc?.monto || 0;
          const esPrestamo = !esConsumoProductos(cred);
          if (!esPrestamo && monto <= 0) continue;
          if (esPrestamo && monto <= 0 && parciales[cred.id] !== 0 && cuotaDe(cred) <= 0) continue;
          const nota = monto > 0
            ? `Cuota cobrada · ${etiquetaQuincena}`
            : `No se cobró cuota · ${etiquetaQuincena}`;
          const movimiento: PagoCredito = {
            id: crypto.randomUUID(), creditoId: cred.id, monto, fecha: fechaHoy,
            metodoPago: 'descuento_nomina', nota, cobrada: monto > 0,
          };
          const nuevoSaldo = Math.max(0, cred.saldo - monto);
          const cuota = cuotaDe(cred);
          await onUpdateCreditoTrabajador({
            ...cred,
            cuota: cuota || undefined,
            saldo: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? 'descontado' : 'activo',
            pagos: pagosConCuota({ ...cred, pagos: [...pagosSinMetaCuota(cred), movimiento] }, cuota),
          });
        }
        const { _totalMins, _pagado, ...limpio } = item;
        guardados.push({
          ...limpio,
          gastoId,
          fechaPago: fechaHoy,
          ...(itemsDelPago.length === 1 && origenes.length > 0 ? { origenesPago: origenes } : {}),
        });
        // Deja en Control de turno los días marcados a mano y las salidas olvidadas (no frena el pago si falla)
        const trab = trabajadoresActivos.find(t => t.id === item.trabajadorId);
        if (trab) { try { await guardarRegistros(trab); } catch (e) { console.warn('[Nómina] no se pudo anotar asistencia', e); } }
      }

      // Se suma a lo ya pagado antes en esta misma quincena (pagos individuales anteriores)
      const idsNuevos = new Set(guardados.map(g => g.trabajadorId));
      const previos = (Array.isArray(nominaExistente?.items) ? nominaExistente!.items : [])
        .filter(p => !idsNuevos.has(p.trabajadorId));
      const todosItems = [...previos, ...guardados];
      const completa = trabajadoresActivos.every(t => todosItems.some(i => i.trabajadorId === t.id));
      const obsTodas = [nominaExistente?.observaciones, obsText, notaFondos].filter(Boolean).join(' · ');
      const eventoFondos = origenes.length > 0 ? [{
        fecha: fechaHoy,
        nombres: guardados.map(g => g.trabajadorNombre),
        partes: origenes,
      }] : [];
      const nominaData = {
        periodo, mes, año, fechaInicio: rango.inicio, fechaFin: rango.fin, fechaPago: fechaHoy,
        estado: (completa ? 'pagada' : 'borrador') as NominaEstado, items: todosItems,
        totalBruto:      todosItems.reduce((s, i) => s + i.valorBruto, 0),
        totalDescuentos: todosItems.reduce((s, i) => s + i.totalDescuentos, 0),
        totalNeto:       todosItems.reduce((s, i) => s + i.valorNeto, 0),
        gastoId: nominaExistente?.gastoId ?? guardados.find(g => g.gastoId)?.gastoId,
        observaciones: obsTodas || undefined,
        fondosPagos: [...(nominaExistente?.fondosPagos || []), ...eventoFondos],
      };
      if (nominaExistente) await onUpdateNomina({ ...nominaExistente, ...nominaData });
      else await onAddNomina(nominaData);

      // Limpia las elecciones de cobro de los créditos ya procesados (no arrastrarlas a la próxima quincena)
      const idsCreditos = new Set(guardados.flatMap(g => g.descuentos.map(d => d.creditoId)).filter(Boolean) as string[]);
      const idsPend = new Set(guardados.flatMap(g => (g.pendientes ?? []).map(p => p.creditoId)).filter(Boolean) as string[]);
      setParciales(prev => {
        const p = { ...prev };
        idsCreditos.forEach(id => delete p[id]);
        idsPend.forEach(id => delete p[id]);
        return p;
      });
      const sinPagadas = (prev: Record<string, number>) => {
        const p = { ...prev };
        guardados.forEach(g => delete p[g.trabajadorId]);
        return p;
      };
      setAjustes(sinPagadas); setDiasMenos(sinPagadas); setDiasExtra(sinPagadas); setValorDiaEdit(sinPagadas);
      setDiasVino(prev => { const p = { ...prev }; guardados.forEach(g => delete p[g.trabajadorId]); return p; });
      const nombres = guardados.map(g => g.trabajadorNombre).join(', ');
      toast.success(`¡Pago guardado! ${nombres}: ${formatCurrency(guardados.reduce((s, g) => s + g.valorNeto, 0))}. Míralo en "Historial"; lo no cobrado queda en "Deudas".`);
      setObsModal(false); setObsText(''); setMontosFondo({});
    } catch (e) { console.error(e); toast.error('Error al procesar la nómina'); }
    finally { setPagando(false); }
  }, [itemsDelPago, periodo, mes, año, rango, obsText, nominaExistente, creditosTrabajadores, trabajadoresActivos,
      onAddAsistencia, diasVino, horasHabituales, asistenciaMap, diasPeriodo, hoyLocal,
      onAddNomina, onUpdateNomina, onAddGasto, onUpdateCreditoTrabajador, formatCurrency, parciales,
      partesFondo, usuario]);

  // ── Gestión préstamos ──────────────────────────────────────────────────
  function abrirNuevoPrestamo(t: Trabajador) { setLoanModal({ trabajadorId: t.id, trabajadorNombre: t.nombre }); setLoanForm({ ...ESTADO_CREDITO_VACÍO }); }
  function abrirEditarPrestamo(t: Trabajador, c: CreditoTrabajador) {
    setLoanModal({ trabajadorId: t.id, trabajadorNombre: t.nombre, credito: c });
    setLoanForm({ descripcion: c.descripcion || '', monto: c.monto, saldo: c.saldo, cuota: cuotaDe(c), descontarDeSalario: c.descontarDeSalario, estado: c.estado });
  }

  const guardarPrestamo = useCallback(async () => {
    if (!loanModal) return;
    if (!loanForm.descripcion.trim()) { toast.error('Escribe una descripción'); return; }
    if (loanForm.monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    setLoanSaving(true);
    try {
      const cuota = Math.max(0, Number(loanForm.cuota) || 0);
      if (loanModal.credito) {
        const actualizado = { ...loanModal.credito, descripcion: loanForm.descripcion.trim(),
          monto: loanForm.monto, saldo: loanForm.saldo, cuota, descontarDeSalario: loanForm.descontarDeSalario, estado: loanForm.estado };
        await onUpdateCreditoTrabajador({ ...actualizado, pagos: pagosConCuota(actualizado, cuota) });
        toast.success('Préstamo actualizado');
      } else {
        await onAddCreditoTrabajador({
          trabajadorId: loanModal.trabajadorId, trabajadorNombre: loanModal.trabajadorNombre,
          descripcion: loanForm.descripcion.trim(), monto: loanForm.monto, saldo: loanForm.monto,
          cuota, tipo: 'prestamo',
          descontarDeSalario: loanForm.descontarDeSalario, estado: 'activo',
          fecha: fechaLocalHoy(), items: [],
          pagos: cuota > 0 ? [{
            id: crypto.randomUUID(), creditoId: '', monto: 0, fecha: fechaLocalHoy(),
            metodoPago: 'otro', nota: `${NOTA_CUOTA}${cuota}`,
          }] : [],
          usuarioId: 'nomina',
        });
        toast.success('Préstamo registrado');
      }
      setLoanModal(null);
    } catch { toast.error('Error al guardar'); }
    finally { setLoanSaving(false); }
  }, [loanModal, loanForm, onAddCreditoTrabajador, onUpdateCreditoTrabajador]);

  const eliminarPrestamo = useCallback(async (c: CreditoTrabajador) => {
    try { await onDeleteCreditoTrabajador(c.id); toast.success('Préstamo eliminado'); }
    catch { toast.error('Error al eliminar'); }
    finally { setConfirmDelete(null); }
  }, [onDeleteCreditoTrabajador]);

  // ── PDF Acuerdo de Confidencialidad ────────────────────────────────────
  function exportarAcuerdoPDF() {
    const trab = trabajadores.find(t => t.id === acTrabId);
    if (!trab) return;
    const recetasClausula = acRecetasExtra.trim()
      ? `<p>Entre las informaciones consideradas confidenciales se incluyen, de manera enunciativa más no limitativa: fórmulas de masas, proporciones de ingredientes, tiempos de fermentación, temperaturas de horneado, procesos de decoración, y especialmente: <em>${escapeHtml(acRecetasExtra.trim())}</em>.</p>`
      : `<p>Entre las informaciones consideradas confidenciales se incluyen, de manera enunciativa más no limitativa: fórmulas de masas, proporciones de ingredientes, tiempos de fermentación, temperaturas de horneado, procesos de decoración, y cualquier método, técnica o proceso productivo propio del establecimiento.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Acuerdo de Confidencialidad — ${escapeHtml(trab.nombre)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', serif; padding: 40px 48px; color: #1e293b; font-size: 13px; line-height: 1.7; }
  .header { text-align: center; border-bottom: 3px double #1e293b; padding-bottom: 14px; margin-bottom: 20px; }
  .header h1 { font-size: 18px; font-weight: 900; letter-spacing: 1px; margin: 0 0 3px; text-transform: uppercase; }
  .header h2 { font-size: 12px; font-weight: normal; color: #64748b; margin: 0; }
  .title { text-align: center; font-size: 14px; font-weight: 900; text-transform: uppercase;
           letter-spacing: 2px; border: 2px solid #1e293b; padding: 10px 16px; margin-bottom: 22px; }
  .subtitle { text-align: center; font-size: 11px; color: #475569; margin: -14px 0 22px; letter-spacing: 1px; }
  .partes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 14px 16px; margin-bottom: 18px; }
  .partes p { margin: 4px 0; font-size: 13px; }
  .partes strong { font-weight: 900; }
  h3 { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;
       color: #475569; margin: 16px 0 6px; }
  p { margin: 0 0 10px; text-align: justify; }
  .clausula { margin-bottom: 14px; }
  .clausula-num { font-weight: 900; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; }
  .firma-box { text-align: center; }
  .firma-linea { border-top: 1px solid #1e293b; padding-top: 6px; margin-top: 56px; }
  .firma-label { font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .firma-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
  .huella { border: 1px dashed #cbd5e1; width: 64px; height: 80px; margin: 8px auto;
            display: flex; align-items: center; justify-content: center;
            font-size: 9px; color: #94a3b8; text-align: center; }
  .nota-final { margin-top: 28px; padding: 10px 14px; background: #fefce8; border: 1px solid #fde68a;
                border-radius: 4px; font-size: 11px; color: #78350f; }
  @media print { body { padding: 20px 28px; } }
</style>
</head><body>

<div class="header">
  <h1>Panadería Dulce Placer</h1>
  <h2>Canalete, Córdoba · Establecimiento de Panadería Artesanal</h2>
</div>

<div class="title">Acuerdo de Confidencialidad y No Divulgación</div>
<div class="subtitle">Protección de Recetas, Fórmulas y Procesos Productivos</div>

<div class="partes">
  <p>En <strong>Canalete, Córdoba</strong>, el día <strong>${acFecha}</strong>, entre las partes:</p>
  <p><strong>EL ESTABLECIMIENTO:</strong> Panadería Dulce Placer, establecimiento de panadería artesanal ubicado en Canalete, Córdoba, en adelante <em>"El Establecimiento"</em>.</p>
  <p><strong>EL TRABAJADOR(A):</strong> <strong>${escapeHtml(trab.nombre)}</strong>${trab.cedula ? `, identificado(a) con C.C. N° ${escapeHtml(trab.cedula)}` : ''}, quien se desempeña como <strong>${trab.rol}</strong>, en adelante <em>"El Trabajador"</em>.</p>
</div>

<h3>Antecedentes</h3>
<p>El Establecimiento ha desarrollado a lo largo de su trayectoria un conjunto de recetas, fórmulas, procesos y métodos de producción artesanal que constituyen su ventaja competitiva y representan un activo de gran valor. En virtud de la relación laboral, El Trabajador tiene o tendrá acceso a dicha información confidencial.</p>

<div class="clausula">
  <p><span class="clausula-num">PRIMERA — OBJETO.</span> El presente acuerdo tiene por objeto establecer las obligaciones de El Trabajador en materia de confidencialidad y reserva respecto de toda la información privilegiada, técnica y comercial de Panadería Dulce Placer a la que tenga acceso con ocasión de su trabajo.</p>
</div>

<div class="clausula">
  <p><span class="clausula-num">SEGUNDA — INFORMACIÓN CONFIDENCIAL.</span> ${recetasClausula}</p>
</div>

<div class="clausula">
  <p><span class="clausula-num">TERCERA — OBLIGACIONES DEL TRABAJADOR.</span> El Trabajador se obliga a:</p>
  <p>a) Mantener en estricta reserva toda la información confidencial del Establecimiento.<br>
  b) No reproducir, copiar, transmitir ni divulgar dicha información por ningún medio.<br>
  c) No utilizar las recetas, fórmulas o procesos del Establecimiento en beneficio propio o de terceros, ni en otros establecimientos de panadería o similares.<br>
  d) No enseñar, capacitar ni instruir a terceras personas utilizando el conocimiento adquirido en el Establecimiento.<br>
  e) Devolver o destruir cualquier material físico o digital que contenga información confidencial, al finalizar la relación laboral.</p>
</div>

<div class="clausula">
  <p><span class="clausula-num">CUARTA — VIGENCIA.</span> Las obligaciones de confidencialidad establecidas en el presente acuerdo son indefinidas y permanecerán vigentes incluso una vez terminada la relación laboral entre las partes, sin limitación de tiempo.</p>
</div>

<div class="clausula">
  <p><span class="clausula-num">QUINTA — CONSECUENCIAS DEL INCUMPLIMIENTO.</span> En caso de incumplimiento de las obligaciones aquí pactadas, El Trabajador será responsable de los perjuicios económicos, morales y reputacionales que se causen a Panadería Dulce Placer, y el Establecimiento podrá ejercer las acciones legales que estime pertinentes para la protección de sus derechos.</p>
</div>

<div class="clausula">
  <p><span class="clausula-num">SEXTA — DECLARACIÓN DE COMPRENSIÓN.</span> El Trabajador declara haber leído y comprendido íntegramente el contenido del presente acuerdo, haberlo firmado de manera libre, voluntaria y sin presión alguna, y estar de acuerdo con cada una de las cláusulas aquí contenidas.</p>
</div>

<div class="firmas">
  <div class="firma-box">
    <div class="huella">Huella dactilar</div>
    <div class="firma-linea">
      <div class="firma-label">${escapeHtml(trab.nombre)}</div>
      <div class="firma-sub">El Trabajador(a)</div>
      <div class="firma-sub">C.C. ${escapeHtml(trab.cedula || '___________________')}</div>
      <div class="firma-sub" style="margin-top:6px">Firma: _______________________</div>
    </div>
  </div>
  <div class="firma-box">
    <div class="huella">Huella dactilar</div>
    <div class="firma-linea">
      <div class="firma-label">Representante Legal</div>
      <div class="firma-sub">Panadería Dulce Placer</div>
      <div class="firma-sub">C.C. ___________________</div>
      <div class="firma-sub" style="margin-top:6px">Firma: _______________________</div>
    </div>
  </div>
</div>

<div class="nota-final">
  ⚠️ Este documento ha sido firmado en dos (2) ejemplares del mismo tenor y valor, uno para cada parte. Fecha de suscripción: ${acFecha} · Canalete, Córdoba.
</div>

</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita ventanas emergentes'); return; }
    win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500);
  }

  const nominasFiltradas = useMemo(() => {
    const q = buscaHist.trim().toLowerCase();
    return [...nominas]
      .filter(n => filtroQuincena === 'todas' || n.periodo === filtroQuincena)
      .filter(n => {
        if (!filtroFecha) return true;
        if (n.fechaPago === filtroFecha) return true;
        return n.fechaInicio <= filtroFecha && filtroFecha <= n.fechaFin;
      })
      .filter(n => {
        if (!q) return true;
        const texto = [
          periodoLabel(n), n.fechaInicio, n.fechaFin, n.fechaPago || '', n.observaciones || '',
          ...n.items.flatMap(i => [
            i.trabajadorNombre,
            ...i.descuentos.map(d => `${d.concepto} ${d.monto}`),
            ...(i.pendientes || []).map(p => p.concepto),
          ]),
        ].join(' ').toLowerCase();
        return texto.includes(q);
      })
      .sort((a, b) => (b.fechaPago || b.fechaFin || b.createdAt).localeCompare(a.fechaPago || a.fechaFin || a.createdAt));
  }, [nominas, buscaHist, filtroQuincena, filtroFecha]);

  function itemsVisibles(n: NominaQuincenal) {
    const q = buscaHist.trim().toLowerCase();
    if (!q) return n.items;
    const dePersona = n.items.filter(i =>
      i.trabajadorNombre.toLowerCase().includes(q) ||
      i.descuentos.some(d => d.concepto.toLowerCase().includes(q))
    );
    return dePersona.length > 0 ? dePersona : n.items;
  }

  function imprimirPagoTrabajador(n: NominaQuincenal, item: NominaItem) {
    const titulo = `Pago de ${item.trabajadorNombre}`;
    const descs = item.descuentos.map(d =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(d.concepto)}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#b91c1c">-${formatCurrency(d.monto)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#020617}h1{font-size:22px;margin:0 0 4px}
    .sub{font-size:14px;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:15px}
    .neto{margin-top:14px;font-size:20px;font-weight:900}@media print{body{padding:12px}}</style></head><body>
    <h1>Panadería Dulce Placer</h1>
    <p class="sub">${escapeHtml(periodoLabel(n))}<br>${escapeHtml(n.fechaInicio)} al ${escapeHtml(n.fechaFin)}${n.fechaPago ? ' · Pagada ' + escapeHtml(n.fechaPago) : ''}</p>
    <p style="font-size:18px;font-weight:900;margin:0 0 12px">${escapeHtml(item.trabajadorNombre)}</p>
    <table>
      <tr><td style="padding:6px 8px">Días</td><td style="padding:6px 8px;text-align:right">${item.diasTrabajados}/${item.totalDiasPeriodo}</td></tr>
      <tr><td style="padding:6px 8px">Sueldo a recibir</td><td style="padding:6px 8px;text-align:right">${formatCurrency(item.valorBruto)}</td></tr>
      ${descs}
      <tr><td style="padding:8px;font-weight:900">Le pagamos</td><td style="padding:8px;text-align:right;font-weight:900;font-size:18px">${formatCurrency(item.valorNeto)}</td></tr>
    </table>
    ${(item.origenesPago?.length ?? 0) > 0 ? `<p style="font-size:14px;font-weight:700">Salió de: ${escapeHtml(item.origenesPago!.map(p => p.nombre + ' ' + formatCurrency(p.monto)).join(' · '))}</p>` : ''}
    ${(item.pendientes?.length ?? 0) > 0 ? `<p>Quedó pendiente: ${formatCurrency(item.pendientes!.reduce((s, p) => s + p.saldo, 0))}</p>` : ''}
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita ventanas emergentes'); return; }
    win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400);
  }

  function abrirEdicionPago(n: NominaQuincenal, item: NominaItem) {
    const previas = item.origenesPago || [];
    setEditPago({
      nominaId: n.id,
      trabajadorId: item.trabajadorId,
      nombre: item.trabajadorNombre,
      bruto: String(Math.round(item.valorBruto)),
      descuentos: item.descuentos.map(d => ({ concepto: d.concepto, monto: String(Math.round(d.monto)) })),
      nota: '',
      bovedas: getBovedas().map(b => {
        const ya = previas.find(p => p.tipo === 'boveda' && (p.id === b.id || p.nombre === b.nombre));
        return { id: b.id, nombre: b.nombre, monto: ya ? String(Math.round(ya.monto)) : '' };
      }),
    });
  }

  async function guardarEdicionPago() {
    if (!editPago || !puedeEditarNomina) return;
    const n = nominas.find(x => x.id === editPago.nominaId);
    const original = n?.items.find(i => i.trabajadorId === editPago.trabajadorId);
    if (!n || !original) return;
    const bruto = Math.max(0, Number(editPago.bruto) || 0);
    const descuentos = editPago.descuentos
      .map((d, idx) => ({
        concepto: d.concepto.trim() || 'Corrección',
        monto: Math.max(0, Number(d.monto) || 0),
        creditoId: original.descuentos[idx]?.creditoId,
        saldoRestante: original.descuentos[idx]?.saldoRestante,
      }))
      .filter(d => d.monto > 0);
    const totalDescuentos = descuentos.reduce((s, d) => s + d.monto, 0);
    const valorNeto = Math.max(0, bruto - totalDescuentos);
    const bovedasNuevas = editPago.bovedas
      .map(b => ({ id: b.id, nombre: b.nombre, monto: Math.max(0, Math.round(Number(b.monto) || 0)) }))
      .filter(b => b.monto > 0);
    const sumaBovedas = bovedasNuevas.reduce((s, b) => s + b.monto, 0);
    if (sumaBovedas > valorNeto) {
      toast.error('De las bóvedas no puede salir más de lo que le pagaste');
      return;
    }
    const anteriores = (original.origenesPago || []).filter(o => o.tipo === 'boveda');
    for (const b of editPago.bovedas) {
      const nuevo = Math.max(0, Math.round(Number(b.monto) || 0));
      const antes = anteriores.find(a => a.id === b.id || a.nombre === b.nombre)?.monto || 0;
      const delta = nuevo - antes;
      if (delta > 0) {
        addMovimientoBoveda({
          tipo: 'Egreso', bovedaOrigenId: b.id, monto: delta,
          motivo: `Nómina ${original.trabajadorNombre}`,
          usuarioResponsable: usuario?.nombre || 'Dueño', metodoPago: 'Efectivo',
        });
      } else if (delta < 0) {
        addMovimientoBoveda({
          tipo: 'Ingreso', bovedaDestinoId: b.id, monto: -delta,
          motivo: `Devolución nómina ${original.trabajadorNombre}`,
          usuarioResponsable: usuario?.nombre || 'Dueño', metodoPago: 'Efectivo',
        });
      }
    }
    const origenes: NominaOrigenPago[] = [
      ...(original.origenesPago || []).filter(o => o.tipo === 'caja'),
      ...bovedasNuevas.map(b => ({ tipo: 'boveda' as const, id: b.id, nombre: b.nombre, monto: b.monto })),
    ];
    const items = n.items.map(i => i.trabajadorId === editPago.trabajadorId
      ? { ...i, valorBruto: bruto, descuentos, totalDescuentos, valorNeto, origenesPago: origenes.length > 0 ? origenes : undefined }
      : i);
    const nota = editPago.nota.trim();
    const textoBovedas = bovedasNuevas.length > 0
      ? `Salió de ${bovedasNuevas.map(b => `${b.nombre} ${b.monto}`).join(' · ')}`
      : '';
    const actualizada: NominaQuincenal = {
      ...n,
      items,
      totalBruto: items.reduce((s, i) => s + i.valorBruto, 0),
      totalDescuentos: items.reduce((s, i) => s + i.totalDescuentos, 0),
      totalNeto: items.reduce((s, i) => s + i.valorNeto, 0),
      observaciones: [n.observaciones, nota ? `Corrección ${original.trabajadorNombre}: ${nota}` : '', textoBovedas].filter(Boolean).join(' · ') || undefined,
      fondosPagos: textoBovedas
        ? [...(n.fondosPagos || []), { fecha: fechaLocalHoy(), nombres: [original.trabajadorNombre], partes: origenes }]
        : n.fondosPagos,
    };
    setGuardandoEdicion(true);
    try {
      await onUpdateNomina(actualizada);
      setSelectedNomina(prev => prev && prev.id === actualizada.id ? actualizada : prev);
      setEditPago(null);
      toast.success('Pago corregido en el historial');
    } catch (e) {
      toast.error('No se pudo guardar la corrección: ' + String(e));
    } finally {
      setGuardandoEdicion(false);
    }
  }

  // ── PDF nómina ─────────────────────────────────────────────────────────
  function exportarPDF(n?: NominaQuincenal) {
    const src = n ?? { items,
      totalBruto: items.reduce((s, i) => s + i.valorBruto, 0),
      totalDescuentos: items.reduce((s, i) => s + i.totalDescuentos, 0),
      totalNeto: items.reduce((s, i) => s + i.valorNeto, 0),
      periodo, mes, año, fechaInicio: rango.inicio, fechaFin: rango.fin,
      fechaPago: nominaExistente?.fechaPago, observaciones: obsText || undefined } as any;
    const titulo = `Nómina ${src.periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[src.mes]} ${src.año}`;
    const filas = src.items.map((item: NominaItem) => {
      const descs = item.descuentos.map(d => `<div>${escapeHtml(d.concepto)}: -${formatCurrency(d.monto)}</div>`).join('');
      const notaDias = [
        item.diasMenos ? `−${item.diasMenos} día(s) que no vino` : '',
        item.diasExtra ? `+${item.diasExtra} día(s) de más` : '',
      ].filter(Boolean).join(' · ');
      return `<tr>
        <td style="padding:7px 6px;font-weight:700;border-bottom:1px solid #f1f5f9">${escapeHtml(item.trabajadorNombre)}${notaDias ? `<div style="font-weight:400;font-size:10px;color:#64748b">${notaDias}</div>` : ''}</td>
        <td style="padding:7px 6px;text-align:center;border-bottom:1px solid #f1f5f9">${item.diasTrabajados}/${item.totalDiasPeriodo}</td>
        <td style="padding:7px 6px;text-align:right;border-bottom:1px solid #f1f5f9">${formatCurrency(item.valorBruto)}</td>
        <td style="padding:7px 6px;font-size:11px;text-align:right;border-bottom:1px solid #f1f5f9;color:#dc2626">${descs||'—'}</td>
        <td style="padding:7px 6px;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;color:#059669">${formatCurrency(item.valorNeto)}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>body{font-family:Arial;padding:24px;color:#1e293b}h1{font-size:18px;margin:0 0 4px}
    .sub{color:#64748b;font-size:12px;margin:0 0 16px}table{width:100%;border-collapse:collapse}
    th{background:#f8fafc;padding:7px 6px;font-size:11px;border-bottom:2px solid #e2e8f0;text-align:left}
    th:not(:first-child){text-align:right}.tfoot td{background:#f0fdf4;font-weight:700;padding:7px 6px}
    .obs{margin-top:12px;font-size:11px;color:#64748b}@media print{body{padding:12px}}</style></head><body>
    <h1>${titulo}</h1>
    <p class="sub">Panadería Dulce Placer · ${src.fechaInicio} al ${src.fechaFin}${src.fechaPago?' · Pagada '+src.fechaPago:''}</p>
    <table><thead><tr><th>Trabajadora</th><th style="text-align:center">Días</th>
    <th style="text-align:right">Bruto</th><th style="text-align:right">Descuentos</th>
    <th style="text-align:right">A pagar</th></tr></thead><tbody>${filas}</tbody>
    <tfoot><tr class="tfoot"><td colspan="2">TOTAL</td>
    <td style="text-align:right">${formatCurrency(src.totalBruto)}</td>
    <td style="text-align:right;color:#dc2626">-${formatCurrency(src.totalDescuentos)}</td>
    <td style="text-align:right;color:#059669">${formatCurrency(src.totalNeto)}</td>
    </tr></tfoot></table>
    ${src.observaciones?`<p class="obs">Obs: ${escapeHtml(src.observaciones)}</p>`:''}
    <p style="margin-top:14px;font-size:10px;color:#94a3b8">* Bruto = salario mensual ÷ 2 × (días asistidos / días del período)</p>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita ventanas emergentes'); return; }
    win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400);
  }

  // ── PDF Liquidación ─────────────────────────────────────────────────────
  function exportarLiquidacionPDF() {
    if (!trabajadorLiq) return;
    const motivoTexto = liqMotivo === 'otro' ? (liqMotivoOtro || 'Otro') : MOTIVOS[liqMotivo];
    const descFilas = credLiq.map(c => {
      const val = liqParciales[c.id];
      if (val === false || val === undefined) return '';
      const monto = typeof val === 'number' ? Math.min(val, c.saldo) : c.saldo;
      const tipo = esConsumoProductos(c) ? 'Consumo de productos' : 'Préstamo/adelanto';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${tipo}: ${escapeHtml(c.descripcion || '')}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;color:#dc2626">-${formatCurrency(monto)}</td>
      </tr>`;
    }).join('');

    const itemsProductos = credLiq
      .filter(c => esConsumoProductos(c))
      .flatMap(c => c.items.map(i => `<li style="font-size:11px;color:#64748b">${escapeHtml(i.nombre)} × ${i.cantidad} = ${formatCurrency(i.subtotal)}</li>`))
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Liquidación — ${escapeHtml(trabajadorLiq.nombre)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 32px 40px; color: #1e293b; font-size: 13px; }
  .header { text-align: center; border-bottom: 3px double #1e293b; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; margin: 0 0 2px; text-transform: uppercase; }
  .header h2 { font-size: 13px; font-weight: normal; color: #64748b; margin: 0; }
  .title { text-align: center; font-size: 15px; font-weight: 900; text-transform: uppercase;
           letter-spacing: 2px; border: 2px solid #1e293b; padding: 8px; margin-bottom: 18px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;
                   color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .field { margin-bottom: 4px; }
  .field label { font-size: 10px; color: #94a3b8; text-transform: uppercase; display: block; }
  .field span { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #f8fafc; padding: 6px 8px; font-size: 11px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  th.r { text-align: right; }
  .subtotal { font-weight: 700; padding: 6px 8px; background: #fef9c3; }
  .total-row td { font-weight: 900; font-size: 14px; padding: 10px 8px;
                  background: #f0fdf4; border-top: 2px solid #1e293b; }
  .total-row td.amount { color: #059669; }
  .paz-salvo { margin: 18px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;
               font-size: 12px; color: #475569; line-height: 1.6; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
  .firma-box { text-align: center; }
  .firma-linea { border-top: 1px solid #1e293b; padding-top: 6px; margin-top: 48px; }
  .firma-label { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .firma-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .recibo { margin-top: 20px; border: 2px dashed #94a3b8; padding: 12px; border-radius: 4px; }
  .recibo-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;
                   color: #475569; margin-bottom: 8px; }
  .recibo-firma { border-top: 1px solid #1e293b; margin-top: 40px; padding-top: 6px;
                  font-size: 11px; font-weight: 700; text-align: center; }
  @media print { body { padding: 16px 24px; } }
</style>
</head><body>

<div class="header">
  <h1>Panadería Dulce Placer</h1>
  <h2>Canalete, Córdoba · NIT: _____________</h2>
</div>

<div class="title">Comprobante de Liquidación de Contrato de Trabajo</div>

<div class="section">
  <div class="section-title">Datos del Trabajador</div>
  <div class="grid2">
    <div class="field"><label>Nombre completo</label><span>${escapeHtml(trabajadorLiq.nombre)}</span></div>
    <div class="field"><label>Cédula / Documento</label><span>${escapeHtml(trabajadorLiq.cedula || '_______________')}</span></div>
    <div class="field"><label>Cargo / Rol</label><span>${trabajadorLiq.rol}</span></div>
    <div class="field"><label>Teléfono</label><span>${escapeHtml(trabajadorLiq.telefono || '_______________')}</span></div>
    <div class="field"><label>Fecha de ingreso</label><span>${trabajadorLiq.fechaIngreso}</span></div>
    <div class="field"><label>Fecha de retiro</label><span>${liqFecha}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Información del Retiro</div>
  <div class="field"><label>Motivo</label><span>${escapeHtml(motivoTexto)}</span></div>
  <div class="field" style="margin-top:4px"><label>Salario mensual pactado</label><span>${formatCurrency(trabajadorLiq.salarioBase)}</span></div>
  ${liqObs ? `<div class="field" style="margin-top:4px"><label>Acuerdo / Observaciones</label><span>${escapeHtml(liqObs)}</span></div>` : ''}
</div>

<div class="section">
  <div class="section-title">Liquidación</div>
  <table>
    <thead><tr><th>Concepto</th><th class="r">Valor</th></tr></thead>
    <tbody>
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">
          Días de salario pendientes (${liqDias} días × ${formatCurrency(Math.round(trabajadorLiq.salarioBase/30))}/día)
        </td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:700">${formatCurrency(liqValorDias)}</td>
      </tr>
      ${liqAjuste !== 0 ? `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${escapeHtml(liqAjusteLabel || (liqAjuste > 0 ? 'Bonificación / ajuste a favor' : 'Descuento adicional'))}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;color:${liqAjuste>0?'#059669':'#dc2626'};font-weight:700">${liqAjuste>0?'+':''}${formatCurrency(liqAjuste)}</td>
      </tr>` : ''}
      ${descFilas}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL NETO A PAGAR</td>
        <td class="amount" style="text-align:right">${formatCurrency(liqNeto)}</td>
      </tr>
    </tfoot>
  </table>
  ${itemsProductos ? `<p style="font-size:11px;color:#64748b;margin-top:6px">Detalle consumo de productos:</p><ul style="margin:0;padding-left:16px">${itemsProductos}</ul>` : ''}
</div>

<div class="paz-salvo">
  Con la firma del presente documento, el trabajador <strong>${escapeHtml(trabajadorLiq.nombre)}</strong> y la
  Panadería Dulce Placer declaran haber llegado a un acuerdo de mutua satisfacción sobre la
  liquidación del contrato de trabajo. El trabajador declara que ha recibido el pago de todos
  los conceptos acordados y que no tiene ninguna reclamación pendiente de carácter laboral
  frente al establecimiento.
  <br><br>
  Este documento se suscribe en Canalete, Córdoba, el día ${liqFecha}.
</div>

<div class="firmas">
  <div class="firma-box">
    <div class="firma-linea">
      <div class="firma-label">Empleador / Representante</div>
      <div class="firma-sub">Panadería Dulce Placer</div>
      <div class="firma-sub">C.C. ___________________</div>
    </div>
  </div>
  <div class="firma-box">
    <div class="firma-linea">
      <div class="firma-label">${escapeHtml(trabajadorLiq.nombre)}</div>
      <div class="firma-sub">Trabajador(a)</div>
      <div class="firma-sub">C.C. ${escapeHtml(trabajadorLiq.cedula || '___________________')}</div>
    </div>
  </div>
</div>

<div class="recibo">
  <div class="recibo-title">✂ Recibí a satisfacción</div>
  <p style="font-size:12px;color:#475569;margin:0">
    Yo, <strong>${escapeHtml(trabajadorLiq.nombre)}</strong>, declaro haber recibido la suma de
    <strong>${formatCurrency(liqNeto)}</strong> como pago total de mi liquidación, quedando
    a paz y salvo con Panadería Dulce Placer por todo concepto laboral.
  </p>
  <div class="recibo-firma">Firma del trabajador: _________________________________ Fecha: ___________</div>
</div>

</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita ventanas emergentes'); return; }
    win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h1 className="font-black text-gray-900 dark:text-white text-lg">Nómina</h1>
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => setTab('liquidar')}
              className={`px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'liquidar' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              Liquidar
            </button>
            <button onClick={() => setTab('historial')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'historial' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <History className="w-4 h-4" /><span>Historial</span>
            </button>
            <button onClick={() => setTab('deudas')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'deudas' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <AlertCircle className="w-4 h-4" /><span className="hidden sm:inline">Deudas</span>
            </button>
            <button onClick={() => setTab('liquidacion')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'liquidacion' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <UserX className="w-4 h-4" /><span className="hidden sm:inline">Liquidación</span>
            </button>
            <button onClick={() => setTab('acuerdos')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'acuerdos' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <ShieldCheck className="w-4 h-4" /><span className="hidden sm:inline">Acuerdos</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── TAB LIQUIDAR ─────────────────────────────────────────────── */}
        {tab === 'liquidar' && (<>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex items-center justify-between">
            <button onClick={anteriorQuincena} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center">
              <p className="font-black text-gray-900 dark:text-white">
                {periodo === 'primera' ? '1ra' : '2da'} quincena {MES_LABEL[mes]} {año}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{rango.inicio} → {rango.fin} ({diasPeriodo.length} días)</p>
              {nominaExistente?.estado === 'pagada' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Todas pagadas · último pago {nominaExistente.fechaPago}
                </span>
              )}
              {nominaExistente && nominaExistente.estado !== 'pagada' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pagadas {items.filter(i => i._pagado).length} de {items.length} · faltan {itemsPorPagar.length}
                </span>
              )}
            </div>
            <button onClick={siguienteQuincena} disabled={esActual}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 disabled:opacity-20 disabled:pointer-events-none">
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {periodo === 'primera' && (
            <div className="rounded-2xl border-2 border-slate-950 bg-white p-4 space-y-1">
              <p className="text-lg font-black text-slate-950">Este cobro es solo hasta el día 15.</p>
              <p className="text-base font-bold text-slate-950">Los préstamos y los consumos que anoten el 16 o después no se cobran aquí. Esos empiezan en la segunda quincena. Lo anotado hasta el 15 sigue en esta cuenta. No se borra nada.</p>
            </div>
          )}
          {periodo === 'segunda' && (
            <div className="rounded-2xl border-2 border-emerald-800 bg-white p-4 space-y-2">
              <p className="text-lg font-black text-emerald-800">Esta es la segunda quincena, desde el 16.</p>
              <p className="text-base font-bold text-slate-950">Aquí sí entran los préstamos y consumos anotados el 16 o después.</p>
              {nominas.find(n => n.periodo === 'primera' && n.mes === mes && n.año === año)?.estado !== 'pagada' && (
                <button type="button" onClick={() => { limpiarEdicionesDeDias(); setPeriodo('primera'); }}
                  className="w-full rounded-2xl bg-slate-950 text-white text-lg font-black py-3 px-4">
                  Cobrar la primera quincena, solo hasta el 15
                </button>
              )}
            </div>
          )}

          {/* Selector de modo de asistencia / deducción */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Control de Ausencias y Asistencia
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {modoCalculo === 'estricto_asistencia' 
                  ? '⚠️ Descontando automáticamente días sin registro de asistencia.' 
                  : '✅ Pagando quincena estándar (puedes activar descuento automático si faltaron).'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModoCalculo('quincena_completa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                  modoCalculo === 'quincena_completa'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Quincena Completa
              </button>
              <button
                type="button"
                onClick={() => setModoCalculo('estricto_asistencia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                  modoCalculo === 'estricto_asistencia'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Descontar Faltas
              </button>
            </div>
          </div>

          {items.every(i => i.diasTrabajados === 0) && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {modoCalculo === 'estricto_asistencia'
                  ? 'Sin registros de asistencia en el período — el valor bruto será $0 porque el modo de descuento por faltas está activado.'
                  : 'Sin registros de asistencia registrados, pero se está calculando el salario quincenal completo acordado.'}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {items.map(item => {
              const trabajadora = trabajadores.find(t => t.id === item.trabajadorId);
              const credActivos = creditosTrabajadores.filter(c => c.trabajadorId === item.trabajadorId && c.estado === 'activo');
              const credDeEsta = credActivos.filter(c => entraEnQuincena(c, rango.fin));
              const credDespues = credActivos.filter(c => !entraEnQuincena(c, rango.fin) && c.saldo > 0);
              const prestamosActivos = credDeEsta.filter(c => !esConsumoProductos(c));
              const consumoActivos   = credDeEsta.filter(c => esConsumoProductos(c));
              const estaPageada = item._pagado;
              const seleccionada = expandedWorker === item.trabajadorId;

              return (
                <div key={item.trabajadorId} className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden border-2 transition-colors ${seleccionada ? 'border-violet-500' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}>
                  <div 
                    onClick={() => setExpandedWorker(prev => prev === item.trabajadorId ? null : item.trabajadorId)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-violet-700 dark:text-violet-300 text-lg shrink-0 transition-transform group-hover:scale-105">
                      {item.trabajadorNombre.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.trabajadorNombre}</p>
                        {estaPageada && (
                          <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            ✓ PAGADA
                          </span>
                        )}
                        {item._diasFaltados > 0 && (
                          <span className="text-[10px] font-black bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                            {item._diasFaltados} {item._diasFaltados === 1 ? 'falta' : 'faltas'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {item.diasTrabajados}/{item.totalDiasPeriodo} días asistidos
                        {(item as any)._totalMins > 0 && ` · ${formatHoras((item as any)._totalMins)}`}
                        {' · '}Sal. {formatCurrency(item.salarioBase)}
                      </p>
                      {!estaPageada && credDeEsta.some(c => c.saldo > 0) && (() => {
                        const debe = credDeEsta.reduce((s, c) => s + c.saldo, 0);
                        const hoyCobra = credDeEsta.reduce((s, c) => s + montoACobrar(c, parciales), 0);
                        return (
                          <div className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold
                            ${hoyCobra > 0
                              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                            {hoyCobra > 0 ? '💳 Descuento' : '⏳ Deuda pendiente'}:&nbsp;
                            {hoyCobra > 0
                              ? <><span className="line-through opacity-60">{formatCurrency(debe)}</span> → −{formatCurrency(hoyCobra)} hoy</>
                              : <>{formatCurrency(debe)} (toca y escribe cuánto se resta)</>}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-right shrink-0 pr-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{estaPageada ? 'Pagado' : 'A pagar'}</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(item.valorNeto)}</p>
                    </div>
                    <div className="shrink-0 text-gray-400 group-hover:text-violet-500 transition-colors">
                      {expandedWorker === item.trabajadorId ? <ChevronLeft className="w-5 h-5 -rotate-90 transition-transform" /> : <ChevronLeft className="w-5 h-5 -rotate-180 transition-transform" />}
                    </div>
                  </div>
                  
                  {/* Detalle de una trabajadora YA PAGADA (solo lectura) */}
                  {seleccionada && estaPageada && (
                    <div className="px-4 py-4 space-y-2 border-t border-gray-100 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-900/10 text-sm">
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                        Pago guardado{item.fechaPago ? ` el ${item.fechaPago}` : ''}
                      </p>
                      <div className="flex justify-between"><span className="text-gray-500">Sueldo base de la quincena</span><span className="font-semibold">{formatCurrency(item.valorBase ?? item.valorBruto)}</span></div>
                      {lineasDias(item)}
                      <div className="flex justify-between font-bold border-t border-dashed border-emerald-200 dark:border-emerald-800 pt-1"><span>Sueldo a recibir</span><span>{formatCurrency(item.valorBruto)}</span></div>
                      {item.descuentos.map((d, idx) => (
                        <div key={idx} className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>− {d.concepto}</span><span className="font-semibold">-{formatCurrency(d.monto)}</span>
                        </div>
                      ))}
                      {(item.pendientes ?? []).map((p, idx) => (
                        <div key={idx} className="flex justify-between text-amber-600 dark:text-amber-400 text-xs">
                          <span>Quedó pendiente: {p.concepto}</span><span className="font-bold">{formatCurrency(p.saldo)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t border-emerald-200 dark:border-emerald-800 font-black">
                        <span>Total pagado</span><span className="text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(item.valorNeto)}</span>
                      </div>
                    </div>
                  )}

                  {/* Detalle desplegable (trabajadora pendiente de pago) */}
                  {seleccionada && !estaPageada && (
                    <div className="px-4 py-4 space-y-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                      <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Sueldo de la quincena (base)</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(item.valorBase ?? item.valorBruto)}</span>
                    </div>
                    {!estaPageada && trabajadora && (() => {
                      const an = analizarDias(trabajadora, diasPeriodo, asistenciaMap, diasVino[trabajadora.id] ?? [], horasHabituales[trabajadora.id], hoyLocal);
                      const sinMarcar = an.dias.filter(d => d.esperado && !d.vino && !d.futuro);
                      const fuera = an.dias.filter(d => d.vino && !d.esperado);
                      const olvidadas = an.dias.filter(d => d.salidaOlvidada);
                      const porAnotar = registrosACrear(trabajadora).length;
                      const hayHorasHabituales = !!(an.horario.entrada && an.horario.salida);
                      const hora12 = (h?: string | null) => {
                        if (!h) return '';
                        const [hh, mm] = h.split(':').map(Number);
                        return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`;
                      };
                      const alternar = (fecha: string) => setDiasVino(prev => {
                        const a = prev[trabajadora.id] ?? [];
                        return { ...prev, [trabajadora.id]: a.includes(fecha) ? a.filter(f => f !== fecha) : [...a, fecha] };
                      });
                      const setHoras = (campo: 'entrada' | 'salida', valor: string) => setHorasHabituales(prev => {
                        const n = { ...prev, [trabajadora.id]: { entrada: prev[trabajadora.id]?.entrada ?? '', salida: prev[trabajadora.id]?.salida ?? '', [campo]: valor } };
                        try { localStorage.setItem('nomina_horas_habituales', JSON.stringify(n)); } catch { /* sin almacenamiento */ }
                        return n;
                      });
                      return (
                        <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-3 space-y-2.5">
                          <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                            Asistencia de la quincena (Control de turno)
                          </p>
                          <div className="grid grid-cols-8 gap-1">
                            {an.dias.map(d => {
                              const dia = Number(d.fecha.slice(8, 10));
                              const clickable = !d.futuro && !d.conRegistro;
                              const estilo = d.conRegistro
                                ? 'bg-emerald-500 text-white'
                                : d.marcado
                                  ? 'bg-violet-500 text-white ring-2 ring-violet-300'
                                  : d.futuro
                                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                                    : d.esperado
                                      ? 'border-2 border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400';
                              const titulo = d.conRegistro
                                ? `Llegó ${d.entrada ?? ''}${d.salida ? ` · salió ${d.salida}` : ' · sin hora de salida'}`
                                : d.marcado ? 'Marcado a mano: sí vino (toca para quitar)'
                                : d.futuro ? 'Aún no llega este día'
                                : d.esperado ? 'Sin marcar "Llegué". Toca si SÍ vino'
                                : 'Día de descanso. Toca si vino (reemplazo / día extra)';
                              return (
                                <button key={d.fecha} type="button" title={titulo} disabled={!clickable}
                                  onClick={() => alternar(d.fecha)}
                                  className={`relative rounded-lg py-1 text-center leading-tight transition-all active:scale-95 ${estilo} ${clickable ? '' : 'cursor-default'}`}>
                                  <span className="block text-[9px] font-bold uppercase opacity-80">{NOMBRE_DIA_CORTO[d.dow]}</span>
                                  <span className="block text-sm font-black">{dia}</span>
                                  {d.salidaOlvidada && <span className="absolute -top-1 -right-1 text-[9px]" title="No marcó 'Me voy'">⚠️</span>}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                            <span><b className="inline-block w-2.5 h-2.5 rounded bg-emerald-500 align-middle" /> Marcó "Llegué"</span>
                            <span><b className="inline-block w-2.5 h-2.5 rounded bg-violet-500 align-middle" /> Marcado a mano: sí vino</span>
                            <span><b className="inline-block w-2.5 h-2.5 rounded border-2 border-rose-400 align-middle" /> Sin marcar</span>
                            <span><b className="inline-block w-2.5 h-2.5 rounded bg-gray-200 align-middle" /> Descanso / aún no</span>
                          </div>

                          {sinMarcar.length > 0 && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                              {sinMarcar.length} {sinMarcar.length === 1 ? 'día sin marcar' : 'días sin marcar'}. Toca el día en que SÍ vino para pagárselo.
                              <span className="block font-normal text-gray-500 dark:text-gray-400">
                                {modoCalculo === 'estricto_asistencia'
                                  ? 'Los días sin marcar se están restando del pago (pago por asistencia activado).'
                                  : 'Ahora se paga la quincena completa. Si quieres que los días sin marcar se resten, activa el pago por asistencia.'}
                              </span>
                              {modoCalculo !== 'estricto_asistencia' && (
                                <button type="button" onClick={() => setModoCalculo('estricto_asistencia')}
                                  className="mt-1 px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[11px] font-black active:scale-95">
                                  Activar pago por asistencia
                                </button>
                              )}
                            </p>
                          )}

                          {fuera.length > 0 && (diasExtra[trabajadora.id] ?? 0) !== fuera.length && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                              Vino {fuera.length} {fuera.length === 1 ? 'día' : 'días'} fuera de su horario ({fuera.map(d => `${NOMBRE_DIA_CORTO[d.dow]} ${Number(d.fecha.slice(8, 10))}`).join(', ')}).
                              <button type="button" onClick={() => setDiasExtra(prev => ({ ...prev, [trabajadora.id]: fuera.length }))}
                                className="ml-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-black active:scale-95">
                                Sumar como días de más
                              </button>
                            </p>
                          )}

                          {an.horario.dias !== null || hayHorasHabituales ? (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              Horario: {trabajadora.horario || 'del cuadro de abajo'}
                              {hayHorasHabituales && <> → entra {hora12(an.horario.entrada)}, sale {hora12(an.horario.salida)}</>}
                            </p>
                          ) : null}

                          {!an.horario.deTrabajadores && (
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2 py-2 space-y-1.5">
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                                No se pudo leer su horario ({trabajadora.horario ? `"${trabajadora.horario}"` : 'está vacío'}). Escribe a qué hora entra y sale normalmente
                                para completar las salidas olvidadas (o, en Trabajadores, escribe por ejemplo "Lun-Sáb 7am-3pm").
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <label className="flex items-center gap-1">Entra
                                  <input type="time" value={horasHabituales[trabajadora.id]?.entrada ?? ''}
                                    onChange={e => setHoras('entrada', e.target.value)}
                                    className="border border-amber-300 dark:border-amber-700 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100" />
                                </label>
                                <label className="flex items-center gap-1">Sale
                                  <input type="time" value={horasHabituales[trabajadora.id]?.salida ?? ''}
                                    onChange={e => setHoras('salida', e.target.value)}
                                    className="border border-amber-300 dark:border-amber-700 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100" />
                                </label>
                              </div>
                            </div>
                          )}

                          {olvidadas.length > 0 && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                              ⚠️ {olvidadas.length} {olvidadas.length === 1 ? 'día' : 'días'} sin marcar "Me voy".
                              {an.horario.salida
                                ? <> Se completa con su hora normal de salida ({hora12(an.horario.salida)}).</>
                                : <> Pon su horario para completarlas solas.</>}
                            </p>
                          )}

                          {porAnotar > 0 && onAddAsistencia && (
                            <button type="button" disabled={guardandoSalidas} onClick={() => guardarEnControlDeTurno(trabajadora)}
                              className="w-full py-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-black active:scale-95 disabled:opacity-50">
                              {guardandoSalidas ? 'Guardando…' : `Anotar ahora en Control de turno (${porAnotar} registros)`}
                              <span className="block text-[10px] font-normal">También se anotan solos al guardar el pago.</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    {!estaPageada && (() => {
                      const vDia = item.valorDia ?? Math.round(item.salarioBase / 30);
                      const mMenos = Math.round((item.diasMenos ?? 0) * vDia);
                      const mExtra = Math.round((item.diasExtra ?? 0) * vDia);
                      const campo = 'w-20 text-right text-sm font-bold border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2';
                      const setNum = (set: React.Dispatch<React.SetStateAction<Record<string, number>>>) =>
                        (e: React.ChangeEvent<HTMLInputElement>) =>
                          set(prev => ({ ...prev, [item.trabajadorId]: Math.max(0, Number(e.target.value) || 0) }));
                      return (
                        <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-3 space-y-2.5">
                          <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">Días trabajados de más o de menos</p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Valor de cada día
                              <span className="block text-[10px] text-gray-400">Sueldo mensual ÷ 30 (puedes cambiarlo)</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">$</span>
                              <input type="number" inputMode="numeric" min={0}
                                value={valorDiaEdit[item.trabajadorId] ?? ''}
                                placeholder={String(Math.round(item.salarioBase / 30))}
                                onChange={setNum(setValorDiaEdit)}
                                className={`${campo} w-28 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 focus:ring-violet-400`} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                              Días que NO vino (se restan)
                              {modoCalculo === 'estricto_asistencia' && (
                                <span className="block text-[10px] font-normal text-gray-400">Con "descuento por asistencia" activado, las faltas se restan solas.</span>
                              )}
                              {modoCalculo !== 'estricto_asistencia' && item._diasFaltados > 0 && diasMenos[item.trabajadorId] === undefined && (
                                <span className="block text-[10px] font-bold text-rose-500">
                                  ⚠️ Detectamos {item._diasFaltados} {item._diasFaltados === 1 ? 'falta' : 'faltas'} — aplicadas automáticamente. Escribe 0 para no descontar.
                                </span>
                              )}
                            </span>
                            <input type="number" inputMode="decimal" min={0} step={0.5}
                              disabled={modoCalculo === 'estricto_asistencia'}
                              value={diasMenos[item.trabajadorId] ?? ''}
                              placeholder={modoCalculo !== 'estricto_asistencia' && item._diasFaltados > 0 ? String(item._diasFaltados) : '0'}
                              onChange={setNum(setDiasMenos)}
                              className={`${campo} border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 focus:ring-rose-400 disabled:opacity-40`} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Días de MÁS (doble turno, reemplazo)
                              <span className="block text-[10px] font-normal text-gray-400">Se suman. Medio día = 0.5</span>
                            </span>
                            <input type="number" inputMode="decimal" min={0} step={0.5}
                              value={diasExtra[item.trabajadorId] ?? ''} placeholder="0"
                              onChange={setNum(setDiasExtra)}
                              className={`${campo} border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 focus:ring-emerald-400`} />
                          </div>
                          {(mMenos > 0 || mExtra > 0) && (
                            <div className="text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5 space-y-0.5">
                              {mMenos > 0 && <div className="flex justify-between text-rose-600 dark:text-rose-400"><span>− {item.diasMenos} {item.diasMenos === 1 ? 'día' : 'días'} × {formatCurrency(vDia)}</span><span>-{formatCurrency(mMenos)}</span></div>}
                              {mExtra > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>+ {item.diasExtra} {item.diasExtra === 1 ? 'día' : 'días'} × {formatCurrency(vDia)}</span><span>+{formatCurrency(mExtra)}</span></div>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {!estaPageada && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs text-gray-400">+ Ajuste manual ($, otro motivo)</span>
                        <input type="number"
                          value={ajustes[item.trabajadorId] ?? ''}
                          onChange={e => setAjustes(prev => ({ ...prev, [item.trabajadorId]: Number(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-28 text-right text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                    )}
                    {prestamosActivos.length > 0 && (
                      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Préstamos: plata que se le prestó y se va cobrando por cuotas</p>
                        {prestamosActivos.map(c => (
                          <CreditCard key={c.id} c={c} parciales={parciales} setParciales={setParciales}
                            estaPageada={estaPageada}
                            descuentoGuardado={estaPageada ? item.descuentos.find(d => d.creditoId === c.id) : undefined}
                            onEditar={!estaPageada && trabajadora ? () => abrirEditarPrestamo(trabajadora, c) : undefined}
                            onEliminar={!estaPageada ? () => setConfirmDelete(c) : undefined}
                            onGuardarCuota={!estaPageada ? (cuota) => {
                              onUpdateCreditoTrabajador({ ...c, cuota, descontarDeSalario: true, pagos: pagosConCuota({ ...c, cuota }, cuota) });
                            } : undefined}
                            formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}
                    {consumoActivos.length > 0 && (
                      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-orange-500" />Consumo de productos (lo que tomó de la panadería)
                        </p>
                        {consumoActivos.map(c => (
                          <CreditCard key={c.id} c={c} parciales={parciales} setParciales={setParciales}
                            estaPageada={estaPageada}
                            descuentoGuardado={estaPageada ? item.descuentos.find(d => d.creditoId === c.id) : undefined}
                            onEditar={!estaPageada && trabajadora ? () => abrirEditarPrestamo(trabajadora, c) : undefined}
                            onEliminar={!estaPageada ? () => setConfirmDelete(c) : undefined}
                            formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}
                    {!estaPageada && trabajadora && (
                      <button onClick={() => abrirNuevoPrestamo(trabajadora)}
                        className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline mt-1">
                        <Plus className="w-3.5 h-3.5" /> Anotar un préstamo nuevo (total prestado y cuota de cada quincena)
                      </button>
                    )}
                    {credDespues.length > 0 && (
                      <div className="rounded-xl border-2 border-emerald-800 bg-white px-3 py-3 space-y-1">
                        <p className="text-base font-black text-emerald-800">Esto empieza en la otra quincena. No se cobra ahora.</p>
                        {credDespues.map(c => (
                          <p key={c.id} className="text-base font-bold text-slate-950">
                            {c.descripcion || (esConsumoProductos(c) ? 'Consumo' : 'Préstamo')} · {formatCurrency(c.saldo)} · anotado el {fechaDeCredito(c)}
                          </p>
                        ))}
                      </div>
                    )}
                    {!estaPageada && (
                      <div className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 space-y-2">
                        <p className="text-lg font-black text-slate-950">Cobro adicional</p>
                        <p className="text-sm font-bold text-slate-950">Se resta del total de esta quincena. No cambia el préstamo ni la cuota.</p>
                        <input
                          type="text"
                          placeholder="Qué se cobra. Ej. adelanto, daño, mercado"
                          value={cobroExtra[item.trabajadorId]?.texto ?? ''}
                          onChange={e => setCobroExtra(prev => ({
                            ...prev,
                            [item.trabajadorId]: { texto: e.target.value, monto: prev[item.trabajadorId]?.monto ?? '' },
                          }))}
                          className="w-full h-12 rounded-xl border-2 border-slate-950 bg-white px-3 text-lg font-black text-slate-950"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Cuánto. Ej. 100000"
                          value={cobroExtra[item.trabajadorId]?.monto ?? ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setCobroExtra(prev => ({
                              ...prev,
                              [item.trabajadorId]: { texto: prev[item.trabajadorId]?.texto ?? '', monto: raw },
                            }));
                          }}
                          className="w-full h-14 rounded-xl border-2 border-emerald-800 bg-white px-3 text-2xl font-black text-slate-950"
                        />
                      </div>
                    )}
                    <div className="rounded-xl bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-800/50 px-3 py-3 space-y-1.5 text-sm">
                      <p className="text-[11px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-widest">
                        Cuenta de {item.trabajadorNombre}
                      </p>
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Sueldo base de la quincena</span>
                        <span className="font-semibold">{formatCurrency(item.valorBase ?? item.valorBruto)}</span>
                      </div>
                      {lineasDias(item)}
                      <div className="flex justify-between text-gray-800 dark:text-gray-100 font-bold border-t border-dashed border-gray-200 dark:border-gray-700 pt-1">
                        <span>Sueldo a recibir</span><span>{formatCurrency(item.valorBruto)}</span>
                      </div>
                      {item.descuentos.length === 0 && (
                        <div className="flex justify-between text-gray-400 text-xs"><span>Sin descuentos de préstamos ni consumos</span><span>$ 0</span></div>
                      )}
                      {item.descuentos.map((d, idx) => (
                        <div key={idx} className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span className="truncate pr-2">− {d.concepto}</span>
                          <span className="font-semibold shrink-0">-{formatCurrency(d.monto)}</span>
                        </div>
                      ))}
                      {(item.pendientes ?? []).map((p, idx) => (
                        <div key={idx} className="flex justify-between text-amber-600 dark:text-amber-400 text-xs">
                          <span className="truncate pr-2">Después de esta quincena todavía debe: {p.concepto}</span>
                          <span className="font-bold shrink-0">{formatCurrency(p.saldo)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex items-center justify-between font-black">
                        <span className="text-gray-800 dark:text-gray-100">TOTAL A PAGARLE A {item.trabajadorNombre.toUpperCase()}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-lg">{formatCurrency(item.valorNeto)}</span>
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-3 pb-4 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 space-y-3">
          {(() => {
            const sel = items.find(i => i.trabajadorId === expandedWorker);
            const selPendiente = sel ? (sel.pendientes ?? []).reduce((s, p) => s + p.saldo, 0) : 0;
            return (<>
              {sel ? (
                <div className={`rounded-2xl px-5 py-4 border ${sel._pagado ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40'}`}>
                  <p className="text-[11px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-widest text-center mb-2">
                    Pago de {sel.trabajadorNombre}{sel._pagado ? ' · ya pagado' : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">Sueldo</p><p className="font-black text-gray-900 dark:text-white">{formatCurrency(sel.valorBruto)}</p></div>
                    <div><p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuento</p><p className="font-black text-rose-600 dark:text-rose-400">-{formatCurrency(sel.totalDescuentos)}</p></div>
                    <div><p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">TOTAL A PAGAR</p><p className="font-black text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(sel.valorNeto)}</p></div>
                  </div>
                  {selPendiente > 0 && (
                    <p className="mt-2 text-center text-xs font-bold text-amber-700 dark:text-amber-300">
                      Sigue debiendo (pasa a la próxima quincena): {formatCurrency(selPendiente)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-3 text-center">
                  <p className="text-sm font-black text-violet-700 dark:text-violet-300">Toca una trabajadora para ver su cuenta y guardar SU pago</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Faltan por pagar {itemsPorPagar.length} · Total pendiente {formatCurrency(totalNeto)}
                    {totalDescuentos > 0 && ` (ya descontando ${formatCurrency(totalDescuentos)})`}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => exportarPDF()}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95">
                  <FileDown className="w-4 h-4" /> PDF
                </button>
                {sel && !sel._pagado ? (
                  <button onClick={() => { setPagoObjetivo(sel.trabajadorId); setObsModal(true); }}
                    disabled={pagando || sel.valorNeto <= 0}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-base shadow-lg shadow-violet-600/30 transition-all active:scale-95 disabled:opacity-40">
                    <Wallet className="w-5 h-5" />
                    {pagando ? 'Guardando…' : `GUARDAR PAGO DE ${sel.trabajadorNombre.toUpperCase()} · ${formatCurrency(sel.valorNeto)}`}
                  </button>
                ) : sel && sel._pagado ? (
                  <button onClick={() => setTab('historial')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> {sel.trabajadorNombre} ya está pagada · Ver en Historial
                  </button>
                ) : itemsPorPagar.length === 0 ? (
                  <button onClick={() => setTab('historial')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Todas pagadas · Ver en Historial
                  </button>
                ) : (
                  <button onClick={() => { setPagoObjetivo('todos'); setObsModal(true); }}
                    disabled={pagando || totalNeto <= 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-gray-900 border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-black text-sm active:scale-95 disabled:opacity-40">
                    <Wallet className="w-4 h-4" />
                    Pagar a todas las pendientes ({itemsPorPagar.length}) · {formatCurrency(totalNeto)}
                  </button>
                )}
              </div>
            </>);
          })()}
          </div>
        </>)}

        {/* ── TAB HISTORIAL ─────────────────────────────────────────────── */}
        {tab === 'historial' && (<>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 space-y-3">
            <p className="font-black text-gray-900 dark:text-white text-base">Buscar un pago</p>
            <input
              value={buscaHist}
              onChange={e => setBuscaHist(e.target.value)}
              placeholder="Nombre, descuento o detalle"
              className="w-full rounded-xl border-2 border-black bg-white px-3 py-3 text-base font-bold text-black placeholder:text-slate-700"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={filtroQuincena}
                onChange={e => setFiltroQuincena(e.target.value as 'todas' | 'primera' | 'segunda')}
                className="rounded-xl border-2 border-black bg-white px-3 py-3 text-base font-bold text-black"
              >
                <option value="todas">Las dos quincenas</option>
                <option value="primera">Primera quincena</option>
                <option value="segunda">Segunda quincena</option>
              </select>
              <input
                type="date"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                className="rounded-xl border-2 border-black bg-white px-3 py-3 text-base font-bold text-black"
              />
            </div>
            {(buscaHist || filtroQuincena !== 'todas' || filtroFecha) && (
              <button
                onClick={() => { setBuscaHist(''); setFiltroQuincena('todas'); setFiltroFecha(''); }}
                className="text-sm font-black text-black underline"
              >
                Ver todos los pagos
              </button>
            )}
          </div>
          {nominas.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">Sin nóminas registradas</p>
              <p className="text-sm mt-1">Las nóminas pagadas aparecerán aquí</p>
            </div>
          ) : nominasFiltradas.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-black text-black">No hay pagos con esa búsqueda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nominasFiltradas.map(n => (
                <div key={n.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{periodoLabel(n)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.fechaInicio} → {n.fechaFin}</p>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${n.estado === 'pagada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'}`}>
                      {n.estado === 'pagada' ? '✓ Pagada' : 'Pagos parciales'}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
                      <div><p className="text-gray-400 mb-0.5">Bruto</p><p className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(n.totalBruto)}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Descuentos</p><p className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(n.totalDescuentos)}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Pagado</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(n.totalNeto)}</p></div>
                    </div>
                    <div className="space-y-1 mb-3">
                      {itemsVisibles(n).map(item => (
                        <div key={item.trabajadorId} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1 border-t border-gray-50 dark:border-gray-800">
                          <span className="text-gray-900 dark:text-gray-100 font-bold">{item.trabajadorNombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 dark:text-gray-200">{item.diasTrabajados}d</span>
                            {item.totalDescuentos > 0 && <span className="text-rose-700 dark:text-rose-300 font-bold">-{formatCurrency(item.totalDescuentos)}</span>}
                            <span className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(item.valorNeto)}</span>
                            <button onClick={() => imprimirPagoTrabajador(n, item)}
                              className="px-2 py-1 rounded-lg bg-black text-white font-black text-[11px]">
                              Imprimir
                            </button>
                            {puedeEditarNomina && (
                              <button onClick={() => abrirEdicionPago(n, item)}
                                className="px-2 py-1 rounded-lg border-2 border-black text-black font-black text-[11px]">
                                Editar
                              </button>
                            )}
                          </div>
                          {(item.origenesPago?.length ?? 0) > 0 && (
                            <div className="basis-full text-[11px] font-bold text-black">
                              Salió de: {item.origenesPago!.map(p => `${p.nombre} ${formatCurrency(p.monto)}`).join(' · ')}
                            </div>
                          )}
                          {(item.pendientes?.length ?? 0) > 0 && (
                            <div className="basis-full text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              Quedó pendiente: {formatCurrency(item.pendientes!.reduce((s, p) => s + p.saldo, 0))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {(n.fondosPagos || []).filter(f => f.nombres.length > 1).map((f, idx) => (
                      <p key={idx} className="text-xs font-bold text-black mb-2">
                        {f.fecha} · {f.nombres.join(', ')} salió de {f.partes.map(p => `${p.nombre} ${formatCurrency(p.monto)}`).join(' · ')}
                      </p>
                    ))}
                    <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <button onClick={() => setSelectedNomina(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-bold text-xs hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Ver detalle
                      </button>
                      <button onClick={() => exportarPDF(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── TAB DEUDAS (lo que se acumula y no se ha cobrado) ─────────── */}
        {tab === 'deudas' && (() => {
          const filas = creditosTrabajadores
            .filter(c => c.estado === 'activo' && c.saldo > 0)
            .map(c => ({ c, cruce: cruzarDeuda(c, nominas) }));
          const porPersona = trabajadoresActivos
            .map(t => ({ t, filas: filas.filter(f => f.c.trabajadorId === t.id) }))
            .filter(x => x.filas.length > 0);
          const granTotal = porPersona.reduce((s, x) => s + x.filas.reduce((a, f) => a + f.cruce.falta, 0), 0);
          return (<>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-4 text-center">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest">Lo que sigue pendiente</p>
              <p className="font-black text-amber-700 dark:text-amber-300 text-2xl mt-1">{formatCurrency(granTotal)}</p>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">
                Se cruza la fecha de la deuda con el pago de esa quincena. Lo ya descontado no se vuelve a contar.
              </p>
            </div>
            {porPersona.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle2 className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-semibold">Nadie debe nada</p>
              </div>
            ) : porPersona.map(({ t, filas: deudas }) => (
              <div key={t.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{t.nombre}</p>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase">Sigue debiendo</p>
                    <p className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(deudas.reduce((s, f) => s + f.cruce.falta, 0))}</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {deudas.map(({ c, cruce }) => (
                    <div key={c.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {c.descripcion || (esConsumoProductos(c) ? 'Consumo de productos' : 'Préstamo')}
                          <span className="ml-1 text-xs font-normal text-gray-500">({c.fecha})</span>
                        </span>
                        <span className={`font-bold shrink-0 ${cruce.falta > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700'}`}>
                          {cruce.falta > 0 ? formatCurrency(cruce.falta) : 'Ya cruzada'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                        {cruce.cobrado > 0 && cruce.falta <= 0 && <>Ya se descontó {formatCurrency(cruce.cobrado)} en {cruce.donde}. Es de {cruce.quincena} y no sigue pendiente.</>}
                        {cruce.cobrado > 0 && cruce.falta > 0 && <>En {cruce.donde} se descontó {formatCurrency(cruce.cobrado)}. Sigue {formatCurrency(cruce.falta)} de {cruce.quincena}.{cruce.dejo ? ` El resto se dejó en ${cruce.dejo} para la otra quincena.` : ''}</>}
                        {cruce.cobrado <= 0 && cruce.dejo && <>Es de {cruce.quincena}. Se dejó sin cobrar en {cruce.dejo} para la otra quincena.</>}
                        {cruce.cobrado <= 0 && !cruce.dejo && cruce.misma && <>Es de {cruce.quincena}. Ese pago ya está guardado y este valor no se descontó ni se dejó para después.</>}
                        {cruce.cobrado <= 0 && !cruce.dejo && !cruce.misma && cruce.otro && <>Es de {cruce.quincena}. El pago de {cruce.otro} es otra quincena y no la incluye.</>}
                        {cruce.cobrado <= 0 && !cruce.dejo && !cruce.misma && !cruce.otro && <>Es de {cruce.quincena}. Todavía no hay un pago de nómina de esa fecha.</>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>);
        })()}

        {/* ── TAB LIQUIDACIÓN ───────────────────────────────────────────── */}
        {tab === 'liquidacion' && (<>

          {/* Aviso */}
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl px-4 py-3">
            <UserX className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-300">Documento de liquidación final</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Para trabajadores que se retiran o son despedidos. Genera el comprobante con firma y paz y salvo.</p>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5 space-y-4">

            {/* Trabajador */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Trabajador(a)</label>
              <select value={liqTrabId} onChange={e => { setLiqTrabId(e.target.value); setLiqParciales({}); setLiqDiasManual(''); }}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400">
                <option value="">— Seleccionar trabajador(a) —</option>
                {trabajadores.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} {t.estado !== 'activo' ? `(${t.estado})` : ''}</option>
                ))}
              </select>
            </div>

            {trabajadorLiq && (<>

              {/* Fecha y motivo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Fecha de retiro</label>
                  <input type="date" value={liqFecha} onChange={e => setLiqFecha(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Motivo</label>
                  <select value={liqMotivo} onChange={e => setLiqMotivo(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400">
                    {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {liqMotivo === 'otro' && (
                <input type="text" value={liqMotivoOtro} onChange={e => setLiqMotivoOtro(e.target.value)}
                  placeholder="Describe el motivo…"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400" />
              )}

              {/* Días pendientes */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Días de salario pendientes</p>
                    <p className="text-xs text-gray-400">
                      Auto-calculado: {liqDiasAuto} días con asistencia desde el último pago
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase">Valor/día</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatCurrency(Math.round(trabajadorLiq.salarioBase / 30))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Ajustar días:</span>
                  <input type="number" min={0}
                    value={liqDiasManual}
                    onChange={e => setLiqDiasManual(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={String(liqDiasAuto)}
                    className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-center font-bold bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">= {formatCurrency(liqValorDias)}</span>
                </div>
              </div>

              {/* Ajuste adicional */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Concepto ajuste (opcional)</label>
                  <input type="text" value={liqAjusteLabel} onChange={e => setLiqAjusteLabel(e.target.value)}
                    placeholder="Ej: Bonificación por acuerdo"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Monto ajuste (+ o -)</label>
                  <input type="number" value={liqAjuste || ''}
                    onChange={e => setLiqAjuste(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>

              {/* Créditos pendientes */}
              {credLiq.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Deudas pendientes</p>
                  {credLiq.map(c => {
                    const isProducto = esConsumoProductos(c);
                    const val = liqParciales[c.id];
                    const activo = val !== false;
                    const montoActual = activo ? (typeof val === 'number' ? val : c.saldo) : 0;
                    return (
                      <div key={c.id} className={`rounded-xl px-3 py-2.5 ${isProducto ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {isProducto && <ShoppingBag className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {c.descripcion || (isProducto ? 'Consumo de productos' : 'Préstamo')}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                            Saldo: {formatCurrency(c.saldo)}
                          </span>
                        </div>
                        {isProducto && (
                          <div className="mb-1.5 space-y-0.5 pl-5">
                            {c.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-gray-400">
                                <span>{item.nombre} × {item.cantidad}</span>
                                <span>{formatCurrency(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={activo}
                              onChange={e => setLiqParciales(prev => ({
                                ...prev, [c.id]: e.target.checked ? c.saldo : false
                              }))}
                              className={`w-4 h-4 ${isProducto ? 'accent-orange-500' : 'accent-rose-500'}`} />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Descontar</span>
                          </label>
                          {activo && (
                            <>
                              <span className="text-xs text-gray-400">Monto:</span>
                              <input type="number" min={0} max={c.saldo}
                                value={montoActual}
                                onChange={e => setLiqParciales(prev => ({
                                  ...prev, [c.id]: Math.min(Number(e.target.value) || 0, c.saldo)
                                }))}
                                className={`w-28 text-right text-sm font-bold border rounded-lg px-2 py-1 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2
                                  ${isProducto ? 'border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 focus:ring-orange-400'
                                               : 'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 focus:ring-rose-400'}`} />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Observaciones / acuerdo */}
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Observaciones / acuerdo</label>
                <textarea value={liqObs} onChange={e => setLiqObs(e.target.value)}
                  placeholder="Ej: Se acuerda pago en efectivo el día de hoy. Trabajador entrega dotación."
                  rows={2}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>

              {/* Resumen final */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl px-5 py-4">
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-1">Días · Salario</p>
                    <p className="font-black text-gray-900 dark:text-white">{formatCurrency(liqValorDias)}</p>
                    <p className="text-[10px] text-gray-400">{liqDias} días</p>
                  </div>
                  <div>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuentos</p>
                    <p className="font-black text-rose-600 dark:text-rose-400">-{formatCurrency(liqTotalDesc)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">Total a pagar</p>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(liqNeto)}</p>
                  </div>
                </div>
                {liqAjuste !== 0 && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {liqAjusteLabel || 'Ajuste'}: {liqAjuste > 0 ? '+' : ''}{formatCurrency(liqAjuste)} incluido
                  </p>
                )}
              </div>

              {/* Botón generar */}
              <button onClick={exportarLiquidacionPDF}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-lg shadow-red-600/30 transition-all active:scale-95">
                <FileDown className="w-5 h-5" /> Generar documento de liquidación
              </button>
            </>)}
          </div>
        </>)}
      </div>

        {/* ── TAB ACUERDOS ─────────────────────────────────────────────── */}
        {tab === 'acuerdos' && (<>

          <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-4 py-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Acuerdo de Confidencialidad de Recetas</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">El trabajador se compromete a no divulgar recetas, fórmulas ni procesos a otras panaderías. El documento no genera obligaciones para el establecimiento.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5 space-y-4">

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Trabajador(a)</label>
              <select value={acTrabId} onChange={e => setAcTrabId(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">— Seleccionar trabajador(a) —</option>
                {trabajadores.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} — {t.rol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Fecha del acuerdo</label>
              <input type="date" value={acFecha} onChange={e => setAcFecha(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                Recetas o productos específicos a mencionar <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </label>
              <textarea value={acRecetasExtra} onChange={e => setAcRecetasExtra(e.target.value)}
                placeholder="Ej: pan de queso, buñuelos, mogolla especial, bizcocho de cuajada… (se incluyen en la cláusula segunda)"
                rows={2}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <p className="text-[11px] text-gray-400 mt-1">Si lo dejas vacío, el documento menciona todas las recetas y procesos del establecimiento de forma general.</p>
            </div>

            {/* Vista previa */}
            {acTrabId && (
              <div className="border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-2 text-sm">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide">Vista previa del documento</p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{trabajadores.find(t=>t.id===acTrabId)?.nombre}</span> firma el compromiso de no divulgar las recetas y procesos de <span className="font-semibold">Panadería Dulce Placer</span>.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-none">
                  <li>✓ Cláusula de confidencialidad indefinida (también post-empleo)</li>
                  <li>✓ Prohibición de uso en otras panaderías o negocios similares</li>
                  <li>✓ Prohibición de enseñar/transmitir a terceros</li>
                  <li>✓ Responsabilidad por daños en caso de incumplimiento</li>
                  <li>✓ Espacio para firma y huella dactilar de ambas partes</li>
                  {acRecetasExtra.trim() && <li>✓ Recetas específicas incluidas en cláusula segunda</li>}
                </ul>
              </div>
            )}

            <button
              onClick={exportarAcuerdoPDF}
              disabled={!acTrabId}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
              <FileDown className="w-5 h-5" /> Generar acuerdo de confidencialidad
            </button>
          </div>
        </>)}

      {/* ── Modal detalle nómina ──────────────────────────────────────────── */}
      {selectedNomina && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl my-4">
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-lg">{periodoLabel(selectedNomina)}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedNomina.fechaInicio} → {selectedNomina.fechaFin}</p>
                {selectedNomina.fechaPago && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pagada el {selectedNomina.fechaPago}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedNomina(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 mt-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {selectedNomina.items.map(item => (
                <div key={item.trabajadorId} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-violet-700 dark:text-violet-300 text-sm">
                        {item.trabajadorNombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{item.trabajadorNombre}</p>
                        <p className="text-xs text-gray-400">{item.diasTrabajados}/{item.totalDiasPeriodo} días · Sal. {formatCurrency(item.salarioBase)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Neto</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</p>
                      <div className="flex gap-1 justify-end mt-1">
                        <button onClick={() => imprimirPagoTrabajador(selectedNomina, item)}
                          className="px-2 py-1 rounded-lg bg-black text-white font-black text-[11px]">
                          Imprimir
                        </button>
                        {puedeEditarNomina && (
                          <button onClick={() => abrirEdicionPago(selectedNomina, item)}
                            className="px-2 py-1 rounded-lg border-2 border-black text-black font-black text-[11px]">
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                      <span>Sueldo base</span><span className="font-semibold">{formatCurrency(item.valorBase ?? item.valorBruto)}</span>
                    </div>
                    {lineasDias(item)}
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-300 font-bold">
                      <span>Sueldo a recibir</span><span>{formatCurrency(item.valorBruto)}</span>
                    </div>
                    {item.descuentos.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descuentos</p>
                        {item.descuentos.map((d, idx) => (
                          <div key={idx} className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                            <span className="text-xs">{d.concepto}</span>
                            <span className="text-xs font-bold">-{formatCurrency(d.monto)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300 pt-0.5">
                          <span>Total descuentos</span><span>-{formatCurrency(item.totalDescuentos)}</span>
                        </div>
                      </div>
                    )}
                    {(item.pendientes?.length ?? 0) > 0 && (
                      <div className="mt-1 pt-1 border-t border-dashed border-amber-200 dark:border-amber-800 space-y-1">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Quedó pendiente (no se cobró)</p>
                        {item.pendientes!.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                            <span className="text-xs">{p.concepto}</span>
                            <span className="text-xs font-bold">{formatCurrency(p.saldo)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 font-bold text-gray-900 dark:text-white">
                      <span>Neto a pagar</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</span>
                    </div>
                    {(item.origenesPago?.length ?? 0) > 0 && (
                      <p className="text-xs font-bold text-black">
                        Salió de: {item.origenesPago!.map(p => `${p.nombre} ${formatCurrency(p.monto)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-6 mb-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">Bruto</p><p className="font-black text-gray-900 dark:text-white text-sm">{formatCurrency(selectedNomina.totalBruto)}</p></div>
                <div><p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuentos</p><p className="font-black text-rose-600 dark:text-rose-400 text-sm">-{formatCurrency(selectedNomina.totalDescuentos)}</p></div>
                <div><p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">Pagado</p><p className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedNomina.totalNeto)}</p></div>
              </div>
            </div>
            {selectedNomina.observaciones && (
              <div className="mx-6 mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observaciones</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNomina.observaciones}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setSelectedNomina(null)} className="px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cerrar</button>
              <button onClick={() => exportarPDF(selectedNomina)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-lg transition-all active:scale-95">
                <FileDown className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {editPago && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-4 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-black text-lg">Corregir el pago de {editPago.nombre}</h2>
                <p className="text-sm font-bold text-black mt-1">Esto cambia el historial. No mueve el saldo del préstamo.</p>
              </div>
              <button onClick={() => setEditPago(null)} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-black" />
              </button>
            </div>
            <label className="block">
              <span className="text-sm font-black text-black">Sueldo a recibir</span>
              <input
                inputMode="numeric"
                value={editPago.bruto}
                onChange={e => setEditPago({ ...editPago, bruto: e.target.value.replace(/[^\d]/g, '') })}
                className="mt-1 w-full rounded-xl border-2 border-black px-3 py-3 text-lg font-black text-black"
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm font-black text-black">Descuentos</p>
              {editPago.descuentos.map((d, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_8rem] gap-2">
                  <input
                    value={d.concepto}
                    onChange={e => {
                      const descuentos = editPago.descuentos.slice();
                      descuentos[idx] = { ...d, concepto: e.target.value };
                      setEditPago({ ...editPago, descuentos });
                    }}
                    className="rounded-xl border-2 border-black px-3 py-2 text-base font-bold text-black"
                  />
                  <input
                    inputMode="numeric"
                    value={d.monto}
                    onChange={e => {
                      const descuentos = editPago.descuentos.slice();
                      descuentos[idx] = { ...d, monto: e.target.value.replace(/[^\d]/g, '') };
                      setEditPago({ ...editPago, descuentos });
                    }}
                    className="rounded-xl border-2 border-black px-3 py-2 text-base font-black text-black"
                  />
                </div>
              ))}
              <button
                onClick={() => setEditPago({ ...editPago, descuentos: [...editPago.descuentos, { concepto: 'Corrección', monto: '' }] })}
                className="text-sm font-black text-black underline"
              >
                Agregar un descuento
              </button>
            </div>
            <p className="text-base font-black text-black">
              Le queda: {formatCurrency(Math.max(0, (Number(editPago.bruto) || 0) - editPago.descuentos.reduce((s, d) => s + (Number(d.monto) || 0), 0)))}
            </p>
            <div className="space-y-2">
              <p className="text-sm font-black text-black">De qué bóveda salió la plata</p>
              {editPago.bovedas.length === 0 ? (
                <p className="text-sm font-bold text-black">Todavía no hay bóvedas creadas.</p>
              ) : editPago.bovedas.map(b => (
                <label key={b.id} className="grid grid-cols-[1fr_8rem] gap-2 items-center">
                  <span className="text-sm font-black text-black">{b.nombre}</span>
                  <input
                    inputMode="numeric"
                    value={b.monto}
                    onChange={e => setEditPago({
                      ...editPago,
                      bovedas: editPago.bovedas.map(x => x.id === b.id ? { ...x, monto: e.target.value.replace(/[^\d]/g, '') } : x),
                    })}
                    placeholder="0"
                    className="rounded-xl border-2 border-black px-3 py-2 text-base font-black text-black"
                  />
                </label>
              ))}
              <p className="text-sm font-black text-black">
                De las bóvedas: {formatCurrency(editPago.bovedas.reduce((s, b) => s + (Number(b.monto) || 0), 0))}
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-black text-black">Por qué lo corriges</span>
              <input
                value={editPago.nota}
                onChange={e => setEditPago({ ...editPago, nota: e.target.value })}
                placeholder="Ejemplo: el descuento estaba de más"
                className="mt-1 w-full rounded-xl border-2 border-black px-3 py-3 text-base font-bold text-black placeholder:text-slate-700"
              />
            </label>
            <button
              onClick={guardarEdicionPago}
              disabled={guardandoEdicion}
              className="w-full py-3.5 rounded-2xl bg-black text-white font-black text-base disabled:opacity-50"
            >
              {guardandoEdicion ? 'Guardando…' : 'Guardar corrección'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal confirmar pago ──────────────────────────────────────────── */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-md w-full my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900 dark:text-white">Guardar pago de nómina</h2>
              <button onClick={() => setObsModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {pagoObjetivo === 'todos'
                ? <>A <span className="font-bold text-gray-800 dark:text-white">{itemsDelPago.length} trabajadoras</span> se les pagará </>
                : <>A <span className="font-bold text-gray-800 dark:text-white">{itemsDelPago[0]?.trabajadorNombre}</span> se le pagará </>}
              <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(pagoNeto)}</span>
              {pagoDescuentos > 0
                ? <> y se descontarán <span className="font-bold text-rose-600">{formatCurrency(pagoDescuentos)}</span> de préstamos y consumos.</>
                : <>. No se descuenta ningún préstamo ni consumo en esta quincena.</>}
            </p>
            {pendientesProxima.filter(p => pagoObjetivo === 'todos' || p.trabajadorId === pagoObjetivo).length > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                  Quedan pendientes para la próxima quincena
                </p>
                <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                  {pendientesProxima.filter(p => pagoObjetivo === 'todos' || p.trabajadorId === pagoObjetivo).map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                      <span className="truncate">{p.nombre} · {p.concepto}</span>
                      <span className="font-bold shrink-0">{formatCurrency(p.queda)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pagoNeto > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-base font-black text-gray-950 dark:text-white">De dónde sale la plata</p>
                <p className="text-sm font-bold text-gray-950 dark:text-white">La Caja Principal es la de hoy. Las bóvedas son la plata ya guardada de helados, piñatería y las demás.</p>
                {cargandoFondos ? (
                  <p className="text-sm font-bold text-black">Cargando cajas…</p>
                ) : fondos.length === 0 ? (
                  <p className="text-sm font-black text-black">No hay Caja Principal abierta ni bóvedas guardadas.</p>
                ) : fondos.map(f => (
                  <div key={f.clave} className="rounded-xl border-2 border-black bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-black">
                        {f.tipo === 'caja' ? 'Caja de hoy' : 'Bóveda'} · {f.nombre}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const otros = fondos.reduce((s, x) => s + (x.clave === f.clave ? 0 : Math.round(Number(montosFondo[x.clave]) || 0)), 0);
                          setMontosFondo(prev => ({ ...prev, [f.clave]: String(Math.max(0, Math.round(pagoNeto) - otros)) }));
                        }}
                        className="text-xs font-black text-black underline"
                      >
                        El resto
                      </button>
                    </div>
                    <p className="text-xs font-bold text-black">Hay {formatCurrency(f.disponible)}</p>
                    <input
                      inputMode="numeric"
                      value={montosFondo[f.clave] || ''}
                      onChange={e => setMontosFondo(prev => ({ ...prev, [f.clave]: e.target.value.replace(/[^\d]/g, '') }))}
                      placeholder="Cuánto coges de aquí"
                      className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2 text-base font-black text-black"
                    />
                  </div>
                ))}
                <p className={`text-sm font-black ${fondosCuadran ? 'text-gray-950 dark:text-white' : 'text-rose-700'}`}>
                  Llevas {formatCurrency(sumaFondos)} de {formatCurrency(pagoNeto)}
                  {sumaFondos < Math.round(pagoNeto) ? ` · faltan ${formatCurrency(Math.round(pagoNeto) - sumaFondos)}` : ''}
                  {sumaFondos > Math.round(pagoNeto) ? ` · sobran ${formatCurrency(sumaFondos - Math.round(pagoNeto))}` : ''}
                </p>
              </div>
            )}
            <textarea value={obsText} onChange={e => setObsText(e.target.value)}
              placeholder="Observaciones opcionales…" rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setObsModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
              <button onClick={pagarNomina} disabled={pagando || cargandoFondos || !fondosCuadran}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg transition-all active:scale-95 disabled:opacity-40">
                {pagando ? 'Guardando…' : '✓ Guardar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal gestionar préstamo ──────────────────────────────────────── */}
      {loanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base">{loanModal.credito ? 'Editar préstamo' : 'Nuevo préstamo'}</h2>
                <p className="text-xs text-gray-400">{loanModal.trabajadorNombre}</p>
              </div>
              <button onClick={() => setLoanModal(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">¿Para qué fue?</label>
                <input type="text" value={loanForm.descripcion}
                  onChange={e => setLoanForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej. préstamo para la casa, arreglo de la moto…"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">¿Cuánta plata le prestaste en total?</label>
                <input type="number" min={0} value={loanForm.monto || ''}
                  onChange={e => { const m = Number(e.target.value) || 0; setLoanForm(f => ({ ...f, monto: m, saldo: loanModal.credito ? f.saldo : m })); }}
                  placeholder="500000, 1000000 o 2000000"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">¿Cuánto le descuentas cada quincena?</label>
                <input type="number" min={0} value={loanForm.cuota || ''}
                  onChange={e => setLoanForm(f => ({ ...f, cuota: Number(e.target.value) || 0 }))}
                  placeholder="Ej. 100000"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <p className="text-[11px] text-gray-400 mt-1">Ejemplo: le prestaste 1.500.000 y cada quincena le quitas 100.000, para que le quede sueldo.</p>
              </div>
              {loanModal.credito && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saldo pendiente</label>
                  <input type="number" min={0} max={loanForm.monto} value={loanForm.saldo || ''}
                    onChange={e => setLoanForm(f => ({ ...f, saldo: Math.min(Number(e.target.value) || 0, f.monto) }))}
                    className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={loanForm.descontarDeSalario}
                  onChange={e => setLoanForm(f => ({ ...f, descontarDeSalario: e.target.checked }))}
                  className="accent-violet-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                  Cada quincena se descuenta la cuota del sueldo
                  <span className="block text-sm font-bold text-slate-950">En la trabajadora puedes escribir otro número solo para esa quincena.</span>
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setLoanModal(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
              <button onClick={guardarPrestamo} disabled={loanSaving}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg transition-all active:scale-95 disabled:opacity-40">
                {loanSaving ? 'Guardando…' : loanModal.credito ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ──────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="font-black text-gray-900 dark:text-white mb-1">¿Eliminar préstamo?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              "<span className="font-semibold">{confirmDelete.descripcion}</span>" — saldo {formatCurrency(confirmDelete.saldo)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 font-bold text-sm">Cancelar</button>
              <button onClick={() => eliminarPrestamo(confirmDelete)}
                className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-lg transition-all active:scale-95">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
