import { useState, useMemo } from 'react';
import { Clock, CheckCircle2, LogOut, Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BarChart3, Monitor, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Trabajador, RegistroAsistencia } from '@/types';

interface AsistenciaProps {
  trabajadores: Trabajador[];
  asistencia: RegistroAsistencia[];
  onAddRegistro: (r: Omit<RegistroAsistencia, 'id' | 'createdAt'>) => Promise<RegistroAsistencia>;
}

function horaActual() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}
function horaISO() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getWeekDays(offset: number): string[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function calcularMinutos(registros: RegistroAsistencia[]): number {
  const sorted = [...registros].sort((a, b) => a.hora.localeCompare(b.hora));
  let total = 0;
  let entrada: string | null = null;
  for (const r of sorted) {
    if (r.tipo === 'entrada') {
      entrada = r.hora;
    } else if (r.tipo === 'salida' && entrada) {
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

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const DIA_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Asistencia({ trabajadores, asistencia, onAddRegistro }: AsistenciaProps) {
  const [seleccionado, setSeleccionado] = useState<Trabajador | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [exito, setExito] = useState<{ tipo: 'entrada' | 'salida'; hora: string } | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [tab, setTab] = useState<'kiosko' | 'reportes'>('kiosko');
  const [weekOffset, setWeekOffset] = useState(0);

  const hoy = fechaHoy();

  const registrosHoy = useMemo(
    () => asistencia.filter(r => r.fecha === hoy).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [asistencia, hoy]
  );

  const ultimoRegistroPorTrabajador = useMemo(() => {
    const map = new Map<string, RegistroAsistencia>();
    for (const r of asistencia.filter(x => x.fecha === hoy)) {
      const prev = map.get(r.trabajadorId);
      if (!prev || r.createdAt > prev.createdAt) map.set(r.trabajadorId, r);
    }
    return map;
  }, [asistencia, hoy]);

  const trabajadoresActivos = trabajadores.filter(t => t.estado === 'activo');

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const reporteSemana = useMemo(() => {
    return trabajadoresActivos.map(t => {
      const porDia = weekDays.map(fecha => {
        const regs = asistencia.filter(r => r.trabajadorId === t.id && r.fecha === fecha);
        const mins = calcularMinutos(regs);
        const entrada = regs.find(r => r.tipo === 'entrada');
        const salida = [...regs].reverse().find(r => r.tipo === 'salida');
        return { fecha, regs, mins, entrada, salida };
      });
      const diasTrabajados = porDia.filter(d => d.regs.length > 0).length;
      const totalMins = porDia.reduce((s, d) => s + d.mins, 0);
      const valorDia = t.salarioBase / 30;
      const valorSemana = Math.round(valorDia * diasTrabajados);
      return { t, porDia, diasTrabajados, totalMins, valorSemana };
    });
  }, [trabajadoresActivos, asistencia, weekDays]);

  const weekLabel = useMemo(() => {
    const lunes = new Date(weekDays[0]);
    const dom = new Date(weekDays[6]);
    return `${lunes.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${dom.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [weekDays]);

  async function registrar(tipo: 'entrada' | 'salida') {
    if (!seleccionado) return;
    setConfirmando(true);
    try {
      const hora = horaISO();
      await onAddRegistro({
        trabajadorId: seleccionado.id,
        trabajadorNombre: seleccionado.nombre,
        tipo,
        fecha: hoy,
        hora,
      });
      setExito({ tipo, hora: horaActual() });
      toast.success(tipo === 'entrada'
        ? `¡Bienvenida, ${seleccionado.nombre.split(' ')[0]}! 🎉`
        : `¡Hasta luego, ${seleccionado.nombre.split(' ')[0]}! 👋`
      );
      setTimeout(() => {
        setExito(null);
        setSeleccionado(null);
      }, 3000);
    } catch {
      toast.error('Error al registrar asistencia');
    } finally {
      setConfirmando(false);
    }
  }

  function exportarReporteSemanal() {
    const filas = reporteSemana.map(r => {
      const diasHtml = r.porDia.map((d, i) => {
        if (d.regs.length === 0) return `<td style="padding:6px 4px;text-align:center;color:#94a3b8;font-size:11px">—</td>`;
        return `<td style="padding:6px 4px;text-align:center;font-size:11px">
          ${d.entrada ? `<div style="color:#059669;font-weight:600">${d.entrada.hora}</div>` : ''}
          ${d.salida ? `<div style="color:#dc2626">${d.salida.hora}</div>` : '<div style="color:#f59e0b;font-size:10px">sin salida</div>'}
          ${d.mins > 0 ? `<div style="color:#0284c7;font-weight:700">${formatHoras(d.mins)}</div>` : ''}
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:8px 6px;font-weight:700;font-size:12px;border-bottom:1px solid #f1f5f9">${r.t.nombre}</td>
        ${diasHtml}
        <td style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;border-bottom:1px solid #f1f5f9">${r.diasTrabajados}</td>
        <td style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;border-bottom:1px solid #f1f5f9">${formatHoras(r.totalMins)}</td>
        <td style="padding:8px 6px;text-align:right;font-weight:700;font-size:12px;border-bottom:1px solid #f1f5f9;color:#059669">${r.valorSemana > 0 ? formatCOP(r.valorSemana) : '—'}</td>
      </tr>`;
    }).join('');

    const totalDias = reporteSemana.reduce((s, r) => s + r.diasTrabajados, 0);
    const totalMins = reporteSemana.reduce((s, r) => s + r.totalMins, 0);
    const totalValor = reporteSemana.reduce((s, r) => s + r.valorSemana, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Reporte Asistencia</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1e293b;font-size:13px}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#64748b;font-size:12px;margin:0 0 20px}
      table{width:100%;border-collapse:collapse}
      th{background:#f8fafc;padding:8px 4px;font-size:11px;text-align:center;border-bottom:2px solid #e2e8f0;white-space:nowrap}
      th:first-child{text-align:left}
      tr:nth-child(even) td{background:#f8fafc}
      .tfoot td{background:#f0fdf4;font-weight:700;padding:8px 4px;font-size:12px}
      @media print{body{padding:12px}}
    </style>
    </head><body>
    <h1>Reporte de Asistencia</h1>
    <p class="sub">Panadería Dulce Placer · ${weekLabel}</p>
    <table>
      <thead><tr>
        <th style="text-align:left">Trabajadora</th>
        ${DIA_LABEL.map(d => `<th>${d}</th>`).join('')}
        <th>Días</th><th>Horas</th><th style="text-align:right">Valor estimado</th>
      </tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="tfoot">
        <td>TOTAL</td>
        ${weekDays.map(() => '<td></td>').join('')}
        <td style="text-align:center">${totalDias}</td>
        <td style="text-align:center">${formatHoras(totalMins)}</td>
        <td style="text-align:right;color:#059669">${formatCOP(totalValor)}</td>
      </tr></tfoot>
    </table>
    <p style="margin-top:16px;font-size:10px;color:#94a3b8">* Valor estimado = salario mensual ÷ 30 × días trabajados</p>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita las ventanas emergentes para exportar'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
        <CheckCircle2 className="w-32 h-32 text-white mb-6 animate-bounce" />
        <p className="text-4xl font-bold text-white mb-2">
          {exito.tipo === 'entrada' ? '¡Ya llegué!' : '¡Ya me voy!'}
        </p>
        <p className="text-2xl text-white/90 mb-1">{seleccionado?.nombre}</p>
        <p className="text-xl text-white/80">{exito.hora}</p>
      </div>
    );
  }

  // ── Modal de confirmación ──────────────────────────────────────────────────
  if (seleccionado) {
    const ultimoRegistro = ultimoRegistroPorTrabajador.get(seleccionado.id);
    const sigueTipo: 'entrada' | 'salida' = ultimoRegistro?.tipo === 'entrada' ? 'salida' : 'entrada';

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4 text-4xl font-bold text-amber-700 dark:text-amber-400">
            {seleccionado.nombre.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{seleccionado.nombre}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{horaActual()}</p>
          <div className="flex flex-col gap-3">
            {sigueTipo === 'entrada' ? (
              <button onClick={() => registrar('entrada')} disabled={confirmando}
                className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xl font-bold transition-all shadow-lg disabled:opacity-50">
                ✅ Ya llegué
              </button>
            ) : (
              <button onClick={() => registrar('salida')} disabled={confirmando}
                className="w-full py-5 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xl font-bold transition-all shadow-lg disabled:opacity-50">
                👋 Ya me voy
              </button>
            )}
            <button onClick={() => registrar(sigueTipo === 'entrada' ? 'salida' : 'entrada')} disabled={confirmando}
              className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium transition-all hover:bg-gray-50 dark:hover:bg-gray-800">
              {sigueTipo === 'entrada' ? 'Registrar salida' : 'Registrar entrada'}
            </button>
            <button onClick={() => setSeleccionado(null)} className="w-full py-3 rounded-2xl text-gray-400 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista principal ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900">

      {/* Header */}
      <div className="text-center pt-6 pb-2 px-4">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Asistencia</h1>
        </div>
        <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 justify-center mt-4 mb-6 px-4">
        <button onClick={() => setTab('kiosko')}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
            tab === 'kiosko'
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-amber-300'
          }`}>
          <Monitor className="w-4 h-4" /> Kiosko
        </button>
        <button onClick={() => setTab('reportes')}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
            tab === 'reportes'
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-amber-300'
          }`}>
          <BarChart3 className="w-4 h-4" /> Reportes
        </button>
      </div>

      {/* ── KIOSKO ────────────────────────────────────────────────────────── */}
      {tab === 'kiosko' && (
        <div className="px-4 pb-8">
          <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
            Toca tu nombre para registrar tu llegada o salida
          </p>

          {trabajadoresActivos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No hay trabajadoras activas registradas</p>
              <p className="text-sm mt-1">Ve al módulo Trabajadores para agregar personal</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {trabajadoresActivos.map(t => {
                const ultimo = ultimoRegistroPorTrabajador.get(t.id);
                const estaAdentro = ultimo?.tipo === 'entrada';
                return (
                  <button key={t.id} onClick={() => setSeleccionado(t)}
                    className="flex flex-col items-center p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl active:scale-95 transition-all border-2 border-transparent hover:border-amber-400 dark:hover:border-amber-500">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${
                      estaAdentro
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-2 ring-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {t.nombre.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-center leading-tight">
                      {t.nombre.split(' ').slice(0, 2).join(' ')}
                    </p>
                    {ultimo ? (
                      <span className={`mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                        estaAdentro
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {estaAdentro ? `Llegó ${ultimo.hora}` : `Salió ${ultimo.hora}`}
                      </span>
                    ) : (
                      <span className="mt-2 text-xs text-gray-400 dark:text-gray-500">Sin registro hoy</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Historial del día */}
          {registrosHoy.length > 0 && (
            <div className="max-w-4xl mx-auto mt-8">
              <button onClick={() => setVerHistorial(v => !v)}
                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium mx-auto">
                {verHistorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {verHistorial ? 'Ocultar' : 'Ver'} registros de hoy ({registrosHoy.length})
              </button>
              {verHistorial && (
                <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                  {registrosHoy.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          r.tipo === 'entrada'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {r.tipo === 'entrada' ? '✅' : <LogOut className="w-4 h-4" />}
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.trabajadorNombre}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${
                          r.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                        }`}>
                          {r.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{r.hora}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── REPORTES ──────────────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="px-4 pb-8 max-w-4xl mx-auto">

          {/* Navegador de semana */}
          <div className="flex items-center justify-between mb-5 bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-white">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)}
                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold underline underline-offset-2 mt-0.5">
                  Ir a esta semana
                </button>
              )}
            </div>
            <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
              disabled={weekOffset >= 0}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 disabled:opacity-20 disabled:pointer-events-none">
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {reporteSemana.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No hay trabajadoras activas</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Card por trabajadora */}
              {reporteSemana.map(({ t, porDia, diasTrabajados, totalMins, valorSemana }) => (
                <div key={t.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">

                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-lg text-amber-700 dark:text-amber-400 shrink-0">
                      {t.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{t.nombre}</p>
                      <p className="text-xs text-gray-400 capitalize">{t.rol}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Valor estimado</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {valorSemana > 0 ? formatCOP(valorSemana) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Grid 7 días */}
                  <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700/50">
                    {porDia.map((d, i) => {
                      const esHoy = d.fecha === hoy;
                      const esFuturo = d.fecha > hoy;
                      return (
                        <div key={d.fecha}
                          className={`px-1 py-2 text-center ${esHoy ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${
                            esHoy ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
                          }`}>{DIA_LABEL[i]}</p>
                          {esFuturo ? (
                            <p className="text-[10px] text-gray-200 dark:text-gray-700">·</p>
                          ) : d.regs.length === 0 ? (
                            <p className="text-gray-300 dark:text-gray-600 text-xs leading-none">—</p>
                          ) : (
                            <div className="space-y-0.5">
                              {d.entrada && (
                                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">{d.entrada.hora}</p>
                              )}
                              {d.salida ? (
                                <p className="text-[10px] text-rose-500 dark:text-rose-400 leading-tight">{d.salida.hora}</p>
                              ) : (
                                <p className="text-[9px] text-amber-500 dark:text-amber-400 leading-tight">activa</p>
                              )}
                              {d.mins > 0 && (
                                <p className="text-[10px] font-black text-sky-600 dark:text-sky-400 leading-tight">{formatHoras(d.mins)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer resumen */}
                  <div className="flex items-center justify-around px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-bold text-gray-800 dark:text-gray-100">{diasTrabajados}</span> días
                    </span>
                    <span className="text-gray-200 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-bold text-gray-800 dark:text-gray-100">{formatHoras(totalMins)}</span> trabajadas
                    </span>
                    <span className="text-gray-200 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Sal. base <span className="font-bold text-gray-800 dark:text-gray-100">{formatCOP(t.salarioBase)}</span>
                    </span>
                  </div>
                </div>
              ))}

              {/* Totales globales */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-0.5">Total semana</p>
                    <p className="font-black text-emerald-800 dark:text-emerald-300 text-base">
                      {reporteSemana.reduce((s, r) => s + r.diasTrabajados, 0)} días &middot;{' '}
                      {formatHoras(reporteSemana.reduce((s, r) => s + r.totalMins, 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-0.5">Valor a pagar</p>
                    <p className="font-black text-emerald-800 dark:text-emerald-300 text-xl">
                      {formatCOP(reporteSemana.reduce((s, r) => s + r.valorSemana, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón exportar */}
              <button onClick={exportarReporteSemanal}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm shadow-sm hover:shadow-md hover:border-amber-300 transition-all active:scale-95">
                <FileDown className="w-4 h-4 text-amber-600" />
                Exportar PDF de la semana
              </button>

              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 -mt-2">
                * Valor estimado = salario mensual ÷ 30 × días asistidos
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
