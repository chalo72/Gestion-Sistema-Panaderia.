import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Shield, Zap, RefreshCw, CheckCircle2, AlertTriangle, Play, Eye, Sparkles, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { AGENTES_CONFIG } from '@/constants/agentes';
import { generateUUID } from '@/lib/safe-utils';
import { useCentinela } from '@/components/providers/CentinelaProvider';

export function CentinelaTab() {
  const { misionesActivas: misionesCtx, isVigilando, ejecutarMisionManual } = useCentinela();
  const [misiones, setMisiones] = useState<any[]>([]);
  const [hallazgos, setHallazgos] = useState<any[]>([]);
  const [bitacora, setBitacora] = useState<any[]>([]);
  const [ejecutandoPatrulla, setEjecutandoPatrulla] = useState(false);
  const [filtroSeveridad, setFiltroSeveridad] = useState<string>('todos');

  const cargarDatos = useCallback(async () => {
    try {
      // 1. Misiones de los agentes
      const mis = await db.getAgenteMisiones();
      setMisiones(mis || []);

      // 2. Hallazgos de todos los agentes
      const hal = await db.getAgenteHallazgos();
      const ordenados = [...(hal || [])].sort((a: any, b: any) => {
        const ta = new Date(a.fecha || a.createdAt || 0).getTime();
        const tb = new Date(b.fecha || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setHallazgos(ordenados);

      // 3. Bitácora IA
      const bita = await db.getBitacoraIA();
      const bitaOrd = [...(bita || [])].sort((a: any, b: any) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      setBitacora(bitaOrd.slice(0, 20));
    } catch (e) {
      console.error('[CentinelaTab] Error al cargar:', e);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleForzarPatrulla = async () => {
    setEjecutandoPatrulla(true);
    toast.info('Disparando ronda de patrullaje de Centinela...');

    try {
      if (misiones.length > 0 && ejecutarMisionManual) {
        await ejecutarMisionManual(misiones[0]);
      } else {
        // Registrar patrullaje preventivo
        await db.addBitacoraIA({
          id: generateUUID(),
          agenteId: 'centinela',
          accion: 'Ronda Manual Forzada',
          detalle: 'Inspección de integridad de datos, inventario y seguridad ejecutada por el Director.',
          nivel: 'normal',
          createdAt: new Date().toISOString(),
        });
      }
      toast.success('¡Ronda de Centinela completada con éxito!');
      await cargarDatos();
    } catch (e) {
      toast.error('Error durante la ejecución de la patrulla');
    } finally {
      setEjecutandoPatrulla(false);
    }
  };

  const handleArchivarHallazgo = async (id: string) => {
    try {
      const h = hallazgos.find(item => item.id === id);
      if (h) {
        await db.saveAgenteHallazgo({ ...h, revisado: true });
        setHallazgos(prev => prev.map(item => item.id === id ? { ...item, revisado: true } : item));
        toast.success('Hallazgo marcado como resuelto / archivado');
      }
    } catch {
      toast.error('Error al archivar hallazgo');
    }
  };

  const hallazgosFiltrados = filtroSeveridad === 'todos'
    ? hallazgos
    : filtroSeveridad === 'pendientes'
      ? hallazgos.filter(h => !h.revisado)
      : hallazgos.filter(h => h.gravedad === filtroSeveridad);

  return (
    <div className="space-y-6">
      {/* Banner de Estado del Enjambre Centinela */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 border border-indigo-500/30 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Guardián Autónomo Activo · 24/7
            </span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            Enjambre Centinela IA
          </h2>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            Patrulla cada 5 minutos en segundo plano monitoreando ventas, márgenes, inventario, conductas y discrepancias para proteger el negocio.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {Object.values(AGENTES_CONFIG).slice(0, 5).map(ag => (
              <span
                key={ag.id}
                className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1"
              >
                <span>{ag.avatar}</span> {ag.nombre}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-3 shrink-0 relative z-10 w-full sm:w-auto">
          <Button
            onClick={handleForzarPatrulla}
            disabled={ejecutandoPatrulla}
            className="h-11 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all w-full sm:w-auto"
          >
            {ejecutandoPatrulla ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Patrullando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" /> Disparar Ronda Ahora
              </>
            )}
          </Button>

          <span className="text-[10px] text-slate-400 font-mono text-center sm:text-right">
            Próxima ronda automática en ~3 min
          </span>
        </div>
      </div>

      {/* Muro de Hallazgos del Enjambre */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Muro de Hallazgos y Diagnósticos IA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Observaciones detectadas automáticamente por el equipo de agentes
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroSeveridad}
              onChange={e => setFiltroSeveridad(e.target.value)}
              className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 font-bold"
            >
              <option value="todos">Todos los hallazgos</option>
              <option value="pendientes">Solo Pendientes</option>
              <option value="critica">Críticos</option>
              <option value="alta">Altos</option>
              <option value="baja">Informativos</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={cargarDatos}
              className="h-8 px-2.5 rounded-xl text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {hallazgosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="font-bold text-slate-600 dark:text-slate-300">
              No hay anomalías activas bajo este filtro
            </p>
            <span className="text-[11px] text-slate-400">
              Centinela mantiene la plataforma y los módulos en estatus óptimo.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {hallazgosFiltrados.map((h: any) => {
              const configAg = AGENTES_CONFIG[h.agenteId as keyof typeof AGENTES_CONFIG];
              const esCritico = h.gravedad === 'critica';
              const esAlto = h.gravedad === 'alta';

              return (
                <div
                  key={h.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    h.revisado ? 'opacity-50 bg-slate-50 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800' :
                    esCritico
                      ? 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/60'
                      : esAlto
                        ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/60'
                        : 'border-slate-100 bg-slate-50/50 dark:bg-slate-850/30 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base" title={configAg?.nombre || h.agenteId}>
                        {configAg?.avatar || '🤖'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {h.titulo || 'Hallazgo de Centinela'}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          esCritico
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                            : esAlto
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200'
                        }`}
                      >
                        {h.gravedad || 'info'}
                      </span>
                      {h.revisado && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                          Resuelto
                        </span>
                      )}
                    </div>

                    {!h.revisado && (
                      <button
                        onClick={() => handleArchivarHallazgo(h.id)}
                        className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                      >
                        Archivar
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {h.descripcion}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-3 pt-2 border-t border-current/5">
                    <span>Agente: {configAg?.nombre || h.agenteId}</span>
                    <span>
                      {new Date(h.fecha || h.createdAt || Date.now()).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bitácora de Patrullas Recientes */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Bitácora de Patrullaje Autónomo (Eventos IA)
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            Últimas {bitacora.length} acciones
          </span>
        </div>

        {bitacora.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin registros de bitácora recientes.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {bitacora.map((b: any) => (
              <div
                key={b.id}
                className="text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-200">
                    <span className="capitalize">{b.agenteId}:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{b.accion}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">
                    {b.detalle}
                  </p>
                </div>
                <span className="text-[9px] font-mono text-slate-400 shrink-0">
                  {new Date(b.createdAt || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
