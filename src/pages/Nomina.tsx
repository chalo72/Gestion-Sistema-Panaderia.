import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, FileDown, Plus, Wallet, History, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  Trabajador, RegistroAsistencia, CreditoTrabajador,
  NominaQuincenal, NominaItem, NominaEstado
} from '@/types';

interface NominaProps {
  trabajadores: Trabajador[];
  asistencia: RegistroAsistencia[];
  creditosTrabajadores: CreditoTrabajador[];
  nominas: NominaQuincenal[];
  onAddNomina: (n: Omit<NominaQuincenal, 'id' | 'createdAt'>) => Promise<NominaQuincenal>;
  onUpdateNomina: (n: NominaQuincenal) => Promise<void>;
  onAddGasto: (g: any) => Promise<any>;
  onUpdateCreditoTrabajador: (c: CreditoTrabajador) => Promise<void>;
  formatCurrency: (n: number) => string;
  onBack: () => void;
}

// ── Helpers de período ─────────────────────────────────────────────────────

function quincenaActual(): { periodo: 'primera' | 'segunda'; mes: number; año: number } {
  const hoy = new Date();
  const dia = hoy.getDate();
  return {
    periodo: dia <= 15 ? 'primera' : 'segunda',
    mes: hoy.getMonth() + 1,
    año: hoy.getFullYear(),
  };
}

function rangoQuincena(periodo: 'primera' | 'segunda', mes: number, año: number) {
  if (periodo === 'primera') {
    return {
      inicio: `${año}-${String(mes).padStart(2, '0')}-01`,
      fin:    `${año}-${String(mes).padStart(2, '0')}-15`,
      dias:   15,
    };
  }
  const ultimoDia = new Date(año, mes, 0).getDate();
  return {
    inicio: `${año}-${String(mes).padStart(2, '0')}-16`,
    fin:    `${año}-${String(mes).padStart(2, '0')}-${ultimoDia}`,
    dias:   ultimoDia - 15,
  };
}

function diasEnRango(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  const cur = new Date(inicio + 'T00:00:00');
  const end = new Date(fin   + 'T00:00:00');
  while (cur <= end) {
    dias.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

function calcularMinutos(regs: RegistroAsistencia[]): number {
  const sorted = [...regs].sort((a, b) => a.hora.localeCompare(b.hora));
  let total = 0;
  let entrada: string | null = null;
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
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const MES_LABEL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function periodoLabel(n: NominaQuincenal) {
  return `${n.periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[n.mes]} ${n.año}`;
}

// ── Componente ─────────────────────────────────────────────────────────────

type Tab = 'liquidar' | 'historial';

export default function Nomina({
  trabajadores,
  asistencia,
  creditosTrabajadores,
  nominas,
  onAddNomina,
  onUpdateNomina,
  onAddGasto,
  onUpdateCreditoTrabajador,
  formatCurrency,
  onBack,
}: NominaProps) {
  const [tab, setTab] = useState<Tab>('liquidar');

  // Período seleccionado
  const hoy = quincenaActual();
  const [periodo, setPeriodo] = useState<'primera' | 'segunda'>(hoy.periodo);
  const [mes, setMes]   = useState(hoy.mes);
  const [año, setAño]   = useState(hoy.año);

  const [pagando, setPagando] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [obsModal, setObsModal] = useState<string | null>(null);
  const [obsText, setObsText]   = useState('');

  // Navegar períodos
  function anteriorQuincena() {
    if (periodo === 'segunda') {
      setPeriodo('primera');
    } else {
      setPeriodo('segunda');
      const prev = new Date(año, mes - 2, 1);
      setMes(prev.getMonth() + 1);
      setAño(prev.getFullYear());
    }
  }
  function siguienteQuincena() {
    const q = quincenaActual();
    const esActual = periodo === q.periodo && mes === q.mes && año === q.año;
    if (esActual) return;
    if (periodo === 'primera') {
      setPeriodo('segunda');
    } else {
      setPeriodo('primera');
      const next = new Date(año, mes, 1);
      setMes(next.getMonth() + 1);
      setAño(next.getFullYear());
    }
  }

  const rango = useMemo(() => rangoQuincena(periodo, mes, año), [periodo, mes, año]);
  const diasPeriodo = useMemo(() => diasEnRango(rango.inicio, rango.fin), [rango]);

  const nominaExistente = useMemo(() =>
    nominas.find(n => n.periodo === periodo && n.mes === mes && n.año === año),
    [nominas, periodo, mes, año]
  );

  const trabajadoresActivos = trabajadores.filter(t => t.estado === 'activo');

  // ── Cálculo de items ───────────────────────────────────────────────────
  const items: NominaItem[] = useMemo(() => {
    if (nominaExistente) return nominaExistente.items;

    return trabajadoresActivos.map(t => {
      // Días trabajados en el período
      const diasTrabajados = diasPeriodo.filter(fecha => {
        const regs = asistencia.filter(r => r.trabajadorId === t.id && r.fecha === fecha);
        return regs.length > 0;
      }).length;

      // Horas totales (para info)
      const totalMins = diasPeriodo.reduce((sum, fecha) => {
        const regs = asistencia.filter(r => r.trabajadorId === t.id && r.fecha === fecha);
        return sum + calcularMinutos(regs);
      }, 0);

      // Valor bruto proporcional (salario mensual / 2 * proporción de días)
      const valorBase = t.salarioBase / 2;
      const proporcion = diasPeriodo.length > 0 ? diasTrabajados / diasPeriodo.length : 0;
      const valorBruto = Math.round(valorBase * proporcion);

      // Descuentos: créditos activos marcados descontarDeSalario
      const credActivos = creditosTrabajadores.filter(
        c => c.trabajadorId === t.id && c.descontarDeSalario && c.estado === 'activo' && c.saldo > 0
      );
      const descuentos = credActivos.map(c => ({
        concepto: c.descripcion || 'Adelanto/crédito',
        monto: Math.min(c.saldo, c.monto),
        creditoId: c.id,
      }));
      const totalDescuentos = descuentos.reduce((s, d) => s + d.monto, 0);
      const ajuste = ajustes[t.id] ?? 0;

      return {
        trabajadorId: t.id,
        trabajadorNombre: t.nombre,
        salarioBase: t.salarioBase,
        diasTrabajados,
        totalDiasPeriodo: diasPeriodo.length,
        valorBruto: Math.max(0, valorBruto + ajuste),
        descuentos,
        totalDescuentos,
        valorNeto: Math.max(0, valorBruto + ajuste - totalDescuentos),
        _totalMins: totalMins, // extra info, no en tipo
      } as NominaItem & { _totalMins: number };
    });
  }, [trabajadoresActivos, asistencia, creditosTrabajadores, diasPeriodo, nominaExistente, ajustes]);

  const totalBruto = items.reduce((s, i) => s + i.valorBruto, 0);
  const totalDescuentos = items.reduce((s, i) => s + i.totalDescuentos, 0);
  const totalNeto = items.reduce((s, i) => s + i.valorNeto, 0);

  const esActual = periodo === hoy.periodo && mes === hoy.mes && año === hoy.año;

  // ── Pagar nómina ───────────────────────────────────────────────────────
  const pagarNomina = useCallback(async () => {
    setPagando(true);
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];

      // 1. Crear entrada en Gastos
      const gasto = await onAddGasto({
        id: crypto.randomUUID(),
        fecha: fechaHoy,
        categoria: 'nomina',
        descripcion: `Nómina ${periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[mes]} ${año}`,
        monto: totalNeto,
        metodoPago: 'efectivo',
        proveedor: '',
        notas: obsText || '',
        createdAt: new Date().toISOString(),
      });

      // 2. Marcar créditos descontados como 'descontado'
      for (const item of items) {
        for (const desc of item.descuentos) {
          if (desc.creditoId) {
            const cred = creditosTrabajadores.find(c => c.id === desc.creditoId);
            if (cred) {
              const nuevoSaldo = Math.max(0, cred.saldo - desc.monto);
              await onUpdateCreditoTrabajador({
                ...cred,
                saldo: nuevoSaldo,
                estado: nuevoSaldo <= 0 ? 'descontado' : 'activo',
              });
            }
          }
        }
      }

      // 3. Guardar o actualizar la NominaQuincenal
      const nominaData = {
        periodo,
        mes,
        año,
        fechaInicio: rango.inicio,
        fechaFin: rango.fin,
        fechaPago: fechaHoy,
        estado: 'pagada' as NominaEstado,
        items: items.map(({ ...i }) => { delete (i as any)._totalMins; return i; }),
        totalBruto,
        totalDescuentos,
        totalNeto,
        gastoId: gasto?.id,
        observaciones: obsText || undefined,
      };

      if (nominaExistente) {
        await onUpdateNomina({ ...nominaExistente, ...nominaData });
      } else {
        await onAddNomina(nominaData);
      }

      toast.success(`¡Nómina pagada! ${formatCurrency(totalNeto)}`);
      setObsModal(null);
      setObsText('');
    } catch (e) {
      console.error(e);
      toast.error('Error al procesar la nómina');
    } finally {
      setPagando(false);
    }
  }, [items, periodo, mes, año, rango, totalBruto, totalDescuentos, totalNeto,
      obsText, nominaExistente, creditosTrabajadores,
      onAddNomina, onUpdateNomina, onAddGasto, onUpdateCreditoTrabajador, formatCurrency]);

  function exportarPDF() {
    const titulo = `Nómina ${periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[mes]} ${año}`;
    const filas = items.map(item => {
      const descs = item.descuentos.map(d =>
        `<div style="font-size:10px;color:#dc2626">${d.concepto}: -${formatCurrency(d.monto)}</div>`
      ).join('');
      return `<tr>
        <td style="padding:8px 6px;font-size:12px;font-weight:700;border-bottom:1px solid #f1f5f9">${item.trabajadorNombre}</td>
        <td style="padding:8px 6px;font-size:11px;text-align:center;border-bottom:1px solid #f1f5f9">${item.diasTrabajados}/${item.totalDiasPeriodo}</td>
        <td style="padding:8px 6px;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9">${formatCurrency(item.valorBruto)}</td>
        <td style="padding:8px 6px;font-size:11px;text-align:right;border-bottom:1px solid #f1f5f9;color:#dc2626">${descs || '—'}</td>
        <td style="padding:8px 6px;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;color:#059669">${formatCurrency(item.valorNeto)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#64748b;font-size:12px;margin:0 0 20px}
      table{width:100%;border-collapse:collapse}
      th{background:#f8fafc;padding:8px 6px;font-size:11px;border-bottom:2px solid #e2e8f0;text-align:left}
      th:not(:first-child){text-align:right}
      .tfoot td{background:#f0fdf4;font-weight:700;padding:8px 6px;font-size:12px}
      @media print{body{padding:12px}}
    </style></head><body>
    <h1>${titulo}</h1>
    <p class="sub">Panadería Dulce Placer · ${rango.inicio} al ${rango.fin}${nominaExistente?.fechaPago ? ' · Pagada el ' + nominaExistente.fechaPago : ''}</p>
    <table>
      <thead><tr>
        <th>Trabajadora</th><th style="text-align:center">Días</th>
        <th style="text-align:right">Bruto</th>
        <th style="text-align:right">Descuentos</th>
        <th style="text-align:right">A pagar</th>
      </tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="tfoot">
        <td colspan="2">TOTAL</td>
        <td style="text-align:right">${formatCurrency(totalBruto)}</td>
        <td style="text-align:right;color:#dc2626">-${formatCurrency(totalDescuentos)}</td>
        <td style="text-align:right;color:#059669">${formatCurrency(totalNeto)}</td>
      </tr></tfoot>
    </table>
    <p style="margin-top:16px;font-size:10px;color:#94a3b8">* Bruto = salario mensual ÷ 2 × (días asistidos / días del período)</p>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita las ventanas emergentes'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h1 className="font-black text-gray-900 dark:text-white text-lg">Nómina</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setTab('liquidar')}
              className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${
                tab === 'liquidar'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              Liquidar
            </button>
            <button onClick={() => setTab('historial')}
              className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${
                tab === 'historial'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              <History className="w-4 h-4 inline mr-1" />Historial
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── TAB LIQUIDAR ─────────────────────────────────────────────── */}
        {tab === 'liquidar' && (
          <>
            {/* Selector de período */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex items-center justify-between">
              <button onClick={anteriorQuincena}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95">
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="text-center">
                <p className="font-black text-gray-900 dark:text-white">
                  {periodo === 'primera' ? '1ra' : '2da'} quincena {MES_LABEL[mes]} {año}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{rango.inicio} → {rango.fin} ({diasPeriodo.length} días)</p>
                {nominaExistente?.estado === 'pagada' && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pagada el {nominaExistente.fechaPago}
                  </span>
                )}
              </div>
              <button onClick={siguienteQuincena} disabled={esActual}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95 disabled:opacity-20 disabled:pointer-events-none">
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Aviso si no hay asistencia */}
            {items.every(i => i.diasTrabajados === 0) && (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  No hay registros de asistencia para este período. El valor bruto será $0.
                </p>
              </div>
            )}

            {/* Items por trabajadora */}
            <div className="space-y-3">
              {items.map(item => {
                const totalMins = (item as any)._totalMins as number ?? 0;
                return (
                  <div key={item.trabajadorId}
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">

                    {/* Header trabajadora */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-violet-700 dark:text-violet-300 text-lg shrink-0">
                        {item.trabajadorNombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.trabajadorNombre}</p>
                        <p className="text-xs text-gray-400">
                          {item.diasTrabajados}/{item.totalDiasPeriodo} días
                          {totalMins > 0 && ` · ${formatHoras(totalMins)}`}
                          {' · '}Sal. base {formatCurrency(item.salarioBase)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">A pagar</p>
                        <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {formatCurrency(item.valorNeto)}
                        </p>
                      </div>
                    </div>

                    {/* Desglose */}
                    <div className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Valor bruto</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(item.valorBruto)}</span>
                      </div>

                      {/* Ajuste manual si no está pagada */}
                      {nominaExistente?.estado !== 'pagada' && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 dark:text-gray-500 text-xs">Ajuste manual</span>
                          <input
                            type="number"
                            value={ajustes[item.trabajadorId] ?? ''}
                            onChange={e => setAjustes(prev => ({
                              ...prev,
                              [item.trabajadorId]: Number(e.target.value) || 0,
                            }))}
                            placeholder="0"
                            className="w-28 text-right text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                      )}

                      {item.descuentos.length > 0 && item.descuentos.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-rose-600 dark:text-rose-400 text-xs">
                            — {d.concepto}
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            -{formatCurrency(d.monto)}
                          </span>
                        </div>
                      ))}

                      <div className="border-t border-gray-100 dark:border-gray-800 pt-1.5 flex items-center justify-between font-bold">
                        <span className="text-sm text-gray-700 dark:text-gray-200">Neto a pagar</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totales globales */}
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">Bruto total</p>
                  <p className="font-black text-gray-900 dark:text-white">{formatCurrency(totalBruto)}</p>
                </div>
                <div>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuentos</p>
                  <p className="font-black text-rose-600 dark:text-rose-400">-{formatCurrency(totalDescuentos)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">A pagar</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(totalNeto)}</p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3">
              <button onClick={exportarPDF}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95">
                <FileDown className="w-4 h-4" />
                PDF
              </button>

              {nominaExistente?.estado === 'pagada' ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Nómina ya pagada
                </div>
              ) : (
                <button
                  onClick={() => setObsModal('pagar')}
                  disabled={pagando || totalNeto <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg shadow-violet-600/30 transition-all active:scale-95 disabled:opacity-40">
                  <Wallet className="w-4 h-4" />
                  {pagando ? 'Procesando…' : `Pagar ${formatCurrency(totalNeto)}`}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── TAB HISTORIAL ─────────────────────────────────────────────── */}
        {tab === 'historial' && (
          <>
            {nominas.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-semibold">Sin nóminas registradas</p>
                <p className="text-sm mt-1">Las nóminas pagadas aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...nominas]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map(n => (
                    <div key={n.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{periodoLabel(n)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.fechaInicio} → {n.fechaFin}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            n.estado === 'pagada'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {n.estado === 'pagada' ? '✓ Pagada' : 'Borrador'}
                          </span>
                          {n.fechaPago && <p className="text-xs text-gray-400 mt-1">{n.fechaPago}</p>}
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
                          <div>
                            <p className="text-gray-400 mb-0.5">Bruto</p>
                            <p className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(n.totalBruto)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-0.5">Descuentos</p>
                            <p className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(n.totalDescuentos)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-0.5">Pagado</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(n.totalNeto)}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {n.items.map(item => (
                            <div key={item.trabajadorId} className="flex items-center justify-between text-xs py-1 border-t border-gray-50 dark:border-gray-800">
                              <span className="text-gray-600 dark:text-gray-300">{item.trabajadorNombre}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">{item.diasTrabajados}d</span>
                                {item.totalDescuentos > 0 && (
                                  <span className="text-rose-500">-{formatCurrency(item.totalDescuentos)}</span>
                                )}
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal observaciones antes de pagar */}
      {obsModal === 'pagar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900 dark:text-white">Confirmar pago de nómina</h2>
              <button onClick={() => setObsModal(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Se registrará un gasto de <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(totalNeto)}</span> y se descontarán los créditos marcados.
            </p>
            <textarea
              value={obsText}
              onChange={e => setObsText(e.target.value)}
              placeholder="Observaciones opcionales…"
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setObsModal(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">
                Cancelar
              </button>
              <button onClick={pagarNomina} disabled={pagando}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg transition-all active:scale-95 disabled:opacity-40">
                {pagando ? 'Procesando…' : '✓ Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
