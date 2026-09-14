import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, RefreshCw, DollarSign, Activity, Smartphone, Server, CheckCircle2, TrendingDown, Clock, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getEventosLoginAuditoria, limpiarEventosLoginAntiguos, etiquetaTipoEventoLogin, type EventoLoginAuditoria } from '@/lib/login-auditoria';
import { getCuadres } from '@/lib/security-agent';
import { getDeviceId } from '@/lib/deviceId';
import { contarPendientesOutbox } from '@/lib/sync-outbox';
import type { CuadreTurno } from '@/types';

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;
const formatFecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function AuditoriaDigitalTab() {
  const [seccion, setSeccion] = useState<'ingresos' | 'cuadres' | 'telemetria'>('ingresos');
  const [eventosLogin, setEventosLogin] = useState<EventoLoginAuditoria[]>([]);
  const [cuadres, setCuadres] = useState<CuadreTurno[]>([]);
  const [expandedCuadre, setExpandedCuadre] = useState<string | null>(null);
  const [filtroLogin, setFiltroLogin] = useState<string>('todos');
  const [pendientesSync, setPendientesSync] = useState(0);

  const cargarDatos = useCallback(() => {
    setEventosLogin(getEventosLoginAuditoria());
    setCuadres(getCuadres());
    setPendientesSync(contarPendientesOutbox());
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleLimpiarAntiguos = () => {
    const removidos = limpiarEventosLoginAntiguos(90);
    cargarDatos();
    toast.success(removidos > 0 ? `Se limpiaron ${removidos} eventos antiguos` : 'Bitácora al día (cero eventos antiguos)');
  };

  const eventosFiltrados = filtroLogin === 'todos'
    ? eventosLogin
    : filtroLogin === 'fallos'
      ? eventosLogin.filter(e => e.tipo === 'login_fallo' || e.tipo === 'usuario_inactivo')
      : eventosLogin.filter(e => e.tipo === 'login_ok' || e.tipo === 'logout');

  return (
    <div className="space-y-6">
      {/* Subnavegación de Auditoría Digital */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-1.5">
        {[
          { id: 'ingresos', label: 'Ingresos al Sistema', Icon: LogIn, count: eventosLogin.length },
          { id: 'cuadres', label: 'Cuadres de Caja', Icon: DollarSign, count: cuadres.length },
          { id: 'telemetria', label: 'Telemetría y Sync', Icon: Activity, count: pendientesSync },
        ].map(({ id, label, Icon, count }) => (
          <button
            key={id}
            onClick={() => setSeccion(id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
              seccion === id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SECCIÓN 1: INGRESOS AL SISTEMA */}
      {seccion === 'ingresos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-white">
                Registro de Autenticación y Accesos
              </h4>
              <p className="text-[11px] text-slate-400">
                Auditoría local de logins exitosos, intentos fallidos y cierres de sesión
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroLogin}
                onChange={e => setFiltroLogin(e.target.value)}
                className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 font-bold"
              >
                <option value="todos">Todos los eventos</option>
                <option value="fallos">Solo Intentos Fallidos</option>
                <option value="exitos">Solo Exitosos / Cierres</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-[10px] font-black uppercase"
                onClick={handleLimpiarAntiguos}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Limpiar +90d
              </Button>
            </div>
          </div>

          {eventosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 opacity-50">
              <LogIn className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                Sin registros en este filtro
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {eventosFiltrados.map((ev) => {
                const ok = ev.tipo === 'login_ok' || ev.tipo === 'logout';
                const fallo = ev.tipo === 'login_fallo' || ev.tipo === 'usuario_inactivo';
                return (
                  <div
                    key={ev.id}
                    className={`rounded-2xl border px-4 py-3 flex items-start gap-3 transition-all ${
                      fallo
                        ? 'border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900'
                        : ok
                          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/60'
                          : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        fallo ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                    >
                      <LogIn className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-800 dark:text-white">
                          {ev.nombre || ev.email}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            fallo
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                          }`}
                        >
                          {etiquetaTipoEventoLogin(ev.tipo)}
                        </span>
                        {ev.rol && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {ev.rol}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatFecha(ev.fecha)}
                      </p>
                      {ev.motivo && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1">
                          {ev.motivo}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 font-mono mt-1 truncate" title={ev.userAgent}>
                        Dispositivo: {ev.deviceId.slice(0, 10)}… · {ev.email}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: CUADRES DE CAJA Y TURNOS */}
      {seccion === 'cuadres' && (
        <div className="space-y-3">
          {cuadres.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 opacity-50">
              <Clock className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                Sin cuadres registrados
              </p>
              <p className="text-xs text-slate-400">
                Los cuadres aparecen aquí cuando las vendedoras cierran su turno
              </p>
            </div>
          ) : (
            cuadres.map((c) => {
              const faltante = c.diferencia < 0;
              const sobrante = c.diferencia > 2000;
              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border overflow-hidden ${
                    faltante
                      ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900'
                      : sobrante
                        ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10'
                        : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900'
                  }`}
                >
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpandedCuadre(expandedCuadre === c.id ? null : c.id)}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        faltante ? 'bg-red-500' : sobrante ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    >
                      {faltante ? (
                        <TrendingDown className="w-4 h-4 text-white" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 dark:text-white">
                          {c.usuarioNombre}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            faltante
                              ? 'bg-red-100 text-red-700'
                              : sobrante
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {faltante
                            ? `Faltó ${formatCOP(Math.abs(c.diferencia))}`
                            : sobrante
                              ? `Sobró ${formatCOP(c.diferencia)}`
                              : 'Cuadró'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatFecha(c.fechaCierre)} · Total ventas: {formatCOP(c.totalVentas)}
                      </p>
                    </div>
                    {expandedCuadre === c.id ? (
                      <ChevronUp className="w-4 h-4 opacity-40 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 opacity-40 shrink-0" />
                    )}
                  </button>
                  {expandedCuadre === c.id && (
                    <div className="px-4 pb-4 pt-1 border-t border-current/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Apertura', val: c.montoApertura },
                        { label: 'Esperado en caja', val: c.montoEsperado },
                        { label: 'Declarado', val: c.montoDeclarado },
                        { label: 'Diferencia', val: c.diferencia },
                        { label: 'Ventas efectivo', val: c.ventasEfectivo },
                        { label: 'Ventas Nequi', val: c.ventasNequi },
                        { label: 'Ventas transferencia', val: c.ventasTransferencia },
                        { label: 'Créditos registrados', val: c.ventasCredito },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-2">
                          <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
                          <p
                            className={`text-sm font-black tabular-nums ${
                              label === 'Diferencia'
                                ? val < 0
                                  ? 'text-red-600'
                                  : 'text-emerald-600'
                                : 'text-slate-800 dark:text-white'
                            }`}
                          >
                            {formatCOP(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECCIÓN 3: TELEMETRÍA Y SYNC */}
      {seccion === 'telemetria' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-indigo-600">
                <Server className="w-4 h-4" />
                <span className="text-xs font-black uppercase">Daemon Telemetría</span>
              </div>
              <p className="text-xl font-black text-slate-800 dark:text-white">Puerto 3005</p>
              <p className="text-[10px] text-emerald-600 font-bold">● Recibiendo auditoría</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-indigo-600">
                <Smartphone className="w-4 h-4" />
                <span className="text-xs font-black uppercase">ID de Dispositivo</span>
              </div>
              <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                {getDeviceId()}
              </p>
              <p className="text-[10px] text-slate-400">Offline-first anclado en IndexedDB</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-indigo-600">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-black uppercase">Cola Outbox</span>
              </div>
              <p className="text-xl font-black text-slate-800 dark:text-white">
                {pendientesSync} pendientes
              </p>
              <p className="text-[10px] text-slate-400">Sincronización multi-dispositivo sin ecos</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
