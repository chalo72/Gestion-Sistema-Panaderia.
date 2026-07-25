import { generateUUID } from '@/lib/safe-utils';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/database';
import type { DBMisionAgent, DBHallazgoAgente } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { applySyncPatch } from '@/lib/supabase-sync-bridge';
import { initDeviceId } from '@/lib/deviceId';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

interface CentinelaContextType {
  misionesActivas: DBMisionAgent[];
  hallazgos: DBHallazgoAgente[];
  ejecutarMisionManual: (mision: DBMisionAgent) => Promise<void>;
  isVigilando: boolean;
}

const CentinelaContext = createContext<CentinelaContextType | undefined>(undefined);

// Barra de versión — cuenta 5s y ejecuta la recarga automáticamente.
function VersionBar({ onDismiss, recargar }: { onDismiss: () => void; recargar: () => void }) {
  const [secs, setSecs] = React.useState(5);
  const [flash, setFlash] = React.useState(false);
  React.useEffect(() => {
    const t = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(t);
          setFlash(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: flash ? 'rgba(16,185,129,0.9)' : 'linear-gradient(90deg,#312e81,#4f46e5,#312e81)',
      color: '#e0e7ff', padding: '4px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 11, fontWeight: 600,
      boxShadow: '0 1px 6px rgba(79,70,229,0.3)',
      animation: flash ? 'vbFlash 0.3s ease 2' : 'vbSlide 0.3s ease',
      transition: 'background 0.2s',
    }}>
      <style>{`
        @keyframes vbSlide{from{transform:translateY(-100%)}to{transform:translateY(0)}}
        @keyframes vbFlash{0%,100%{opacity:1}50%{opacity:0.15}}
      `}</style>
      <span>&#128260; Nueva versión detectada — {secs > 0 ? `recargando en ${secs}s` : 'Actualizando...'}</span>
      <button onClick={recargar} style={{
        background:'rgba(255,255,255,0.18)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',
        borderRadius:6,padding:'1px 10px',fontSize:10,fontWeight:700,cursor:'pointer',
      }}>Aplicar ya</button>
    </div>
  );
}

// Activar el puente de espejo local->Supabase UNA VEZ al iniciar (fuera del componente)
applySyncPatch();
// Anclar device ID en IndexedDB (sobrevive limpieza de caché HTTP)
initDeviceId().catch(() => {});

export const CentinelaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [misionesActivas, setMisionesActivas] = useState<DBMisionAgent[]>([]);
  const [hallazgos, setHallazgos] = useState<DBHallazgoAgente[]>([]);
  const [isVigilando, setIsVigilando] = useState(false);
  const timerRef = useRef<any>(null);

  const { countdown, updateAvailable, recargar } = useAutoUpdate();

  const { pendingChanges, dismissAll, syncConnected, syncNow } = useRealtimeSync();
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState<number | null>(null);
  const hasSyncedOnMount = useRef(false);

  // Sync automatico al arrancar: en cuanto Supabase Realtime confirma conexion,
  // hace un merge completo UNA VEZ: sube datos locales y baja los del resto.
  // Si encuentra datos nuevos, recarga UNA VEZ más para mostrarlos
  // (sessionStorage evita el loop: la segunda carga no hace syncNow).
  useEffect(() => {
    if (!syncConnected || hasSyncedOnMount.current) return;
    hasSyncedOnMount.current = true;

    const alreadyReloaded = sessionStorage.getItem('nexus_post_sync_reload');
    if (alreadyReloaded) {
      sessionStorage.removeItem('nexus_post_sync_reload');
      return; // ya sincronizamos y recargamos — no volver a hacerlo
    }

    syncNow().catch(() => {});
  }, [syncConnected, syncNow]);

  // Si syncNow encontró datos nuevos (MANUAL), el banner ya los muestra.
  // NO recargamos automáticamente — los datos se ven al navegar entre páginas.
  // Esto evita interrumpir al usuario en medio de una venta o formulario.
  useEffect(() => {
    const tieneNuevos = pendingChanges.some(c => c.eventType === 'MANUAL');
    if (!tieneNuevos) return;
    // Solo marcar como sincronizado, sin recargar
    sessionStorage.removeItem('nexus_post_sync_reload');
  }, [pendingChanges]);

  const autoReloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chipFlash, setChipFlash] = useState(false);

  const hasRealtimeChanges = pendingChanges.some(c => c.eventType !== 'MANUAL');

  // Cuenta regresiva 3→0, titila al llegar a 0, desaparece sola. Sin recarga.
  useEffect(() => {
    if (!hasRealtimeChanges) { setSyncCountdown(null); return; }
    if (syncCountdown !== null) return; // ya corriendo
    let secs = 3;
    setSyncCountdown(secs);
    if (autoReloadTimerRef.current) clearInterval(autoReloadTimerRef.current);
    autoReloadTimerRef.current = setInterval(() => {
      secs -= 1;
      setSyncCountdown(secs);
      if (secs <= 0) {
        clearInterval(autoReloadTimerRef.current!);
        setChipFlash(true);
        setTimeout(() => { setChipFlash(false); dismissAll(); setSyncCountdown(null); }, 800);
      }
    }, 1000);
    return () => { if (autoReloadTimerRef.current) clearInterval(autoReloadTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealtimeChanges]);

  const aplicarSincronizacion = useCallback(() => {
    if (autoReloadTimerRef.current) clearInterval(autoReloadTimerRef.current);
    setSyncCountdown(null); setChipFlash(false); dismissAll();
  }, [dismissAll]);

  const postergarSincronizacion = aplicarSincronizacion;

  const handleSyncNow = useCallback(async () => {
    setIsSyncingManual(true);
    // Timeout de 25s para que el botón nunca quede pegado
    await Promise.race([
      syncNow().catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 25000)),
    ]);
    setIsSyncingManual(false);
  }, [syncNow]);

  useEffect(() => {
    const cargarDatos = async () => {
      await db.init();
      const m = await db.getAgenteMisiones();
      const h = await db.getAgenteHallazgos(20);
      setMisionesActivas(m);
      setHallazgos(h);
      // ── Sembrar misiones autónomas si no existen ──
      if (m.length === 0) {
        const misionesBase: DBMisionAgent[] = [
          {
            id: 'mision-pico-claw-ventas',
            agenteId: 'pico-claw',
            misionExplicita: 'Analiza las ventas del día y detecta anomalías, tendencias o alertas críticas en los ingresos de la Panadería Dulce Placer.',
            frecuencia: '1h',
            estado: 'espera',
            ultimaEjecucion: '',
            proximaEjecucion: new Date().toISOString(), // ejecutar inmediatamente
          },
          {
            id: 'mision-inventario-stock',
            agenteId: 'inventario',
            misionExplicita: 'Revisa el inventario completo. Identifica insumos bajo el stock mínimo, alertas de caducidad y necesidades urgentes de reabastecimiento.',
            frecuencia: '1h',
            estado: 'espera',
            ultimaEjecucion: '',
            proximaEjecucion: new Date(Date.now() + 2 * 60000).toISOString(), // en 2 minutos
          },
          {
            id: 'mision-gerente-estrategia',
            agenteId: 'gerente',
            misionExplicita: 'Genera un resumen ejecutivo del estado actual del negocio: ventas, caja, inventario y personal. Indica el semaforo general (verde/amarillo/rojo).',
            frecuencia: '1h',
            estado: 'espera',
            ultimaEjecucion: '',
            proximaEjecucion: new Date(Date.now() + 4 * 60000).toISOString(), // en 4 minutos
          },
          {
            id: 'mision-calidad-produccion',
            agenteId: 'calidad',
            misionExplicita: 'Realiza auditoría automática de calidad y produccion. Verifica que los estándares de higiene y recetas se estén cumpliendo. Reporta cualquier desviación.',
            frecuencia: 'diaria',
            estado: 'espera',
            ultimaEjecucion: '',
            proximaEjecucion: new Date(Date.now() + 6 * 60000).toISOString(),
          },
          {
            id: 'mision-odysseus-seguridad',
            agenteId: 'odysseus',
            misionExplicita: 'Revisa el estado de seguridad del sistema. Detecta accesos inusuales, patrones sospechosos o incidentes de fraude en caja o inventario.',
            frecuencia: '1h',
            estado: 'espera',
            ultimaEjecucion: '',
            proximaEjecucion: new Date(Date.now() + 8 * 60000).toISOString(),
          },
        ];
        for (const mision of misionesBase) {
          await db.saveAgenteMision(mision);
        }
        console.log('[Centinela] ✅ Misiones autónomas sembradas:', misionesBase.length);
        setMisionesActivas(misionesBase);
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    const loop = async () => {
      setIsVigilando(true);
      const misiones = await db.getAgenteMisiones();
      const ahora = new Date().toISOString();
      for (const mision of misiones) {
        if (mision.estado === 'espera' && ahora >= mision.proximaEjecucion) {
          await ejecutarMision(mision);
        }
      }
      setIsVigilando(false);
    };
    // Ejecutar inmediatamente al montar (primer ciclo)
    loop();
    // Luego cada 5 minutos
    timerRef.current = setInterval(loop, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ejecutarMision = async (mision: DBMisionAgent) => {
    console.log('[Centinela] 🤖 Ejecutando mision:', mision.agenteId, '-', mision.misionExplicita.substring(0, 40));
    try {
      await db.saveAgenteMision({ ...mision, estado: 'ejecutando' });
      const ahora = new Date().toISOString();
      const contexto = await prepararContextoMision(mision);
      let respuesta = '';
      await consultarAgente(
        mision.agenteId,
        'MISION AUTONOMA: ' + mision.misionExplicita + '.\nCONTEXTO REAL: ' + contexto + '\nResponde en máximo 3 oraciones concisas y directas. Usa datos concretos si están disponibles.',
        (chunk) => { respuesta += chunk; }
      );

      // ── Escribir en la Bitácora IA ──
      const nivel = respuesta.toLowerCase().includes('crítico') || respuesta.toLowerCase().includes('alerta') ? 'warning'
                  : respuesta.toLowerCase().includes('grave') || respuesta.toLowerCase().includes('urgente') ? 'critical'
                  : 'info';
      await db.addBitacoraIA({
        agenteId: mision.agenteId,
        accion: 'Misión Autónoma: ' + mision.misionExplicita.substring(0, 40),
        detalle: respuesta.trim() || 'Ciclo completado sin novedades.',
        nivel,
      });
      console.log('[Centinela] ✅ Bitácora actualizada por', mision.agenteId);

      // ── Registrar hallazgo si el agente detectó algo relevante ──
      if (nivel !== 'info') {
        const nuevoHallazgo: DBHallazgoAgente = {
          id: generateUUID(),
          agenteId: mision.agenteId,
          misionId: mision.id,
          tipo: 'operativo',
          gravedad: nivel === 'critical' ? 'alta' : 'media',
          titulo: 'Alerta de ' + mision.agenteId.toUpperCase() + ': ' + mision.misionExplicita.substring(0, 30) + '...',
          descripcion: respuesta,
          fecha: new Date().toISOString(),
          revisado: false
        };
        await db.saveAgenteHallazgo(nuevoHallazgo);
        setHallazgos(prev => [nuevoHallazgo, ...prev]);
      }

      const proxima = calcularProximaEjecucion(mision.frecuencia);
      await db.saveAgenteMision({ ...mision, estado: 'espera', ultimaEjecucion: ahora, proximaEjecucion: proxima });
    } catch (error) {
      console.error('[Centinela] ❌ Falla en mision:', mision.agenteId, error);
      // Escribir error en Bitácora
      try {
        await db.addBitacoraIA({
          agenteId: mision.agenteId,
          accion: 'Error en Misión Autónoma',
          detalle: `Fallo temporal en la misión de ${mision.agenteId}. Se reintentara en el próximo ciclo.`,
          nivel: 'warning',
        });
      } catch {}
      await db.saveAgenteMision({ ...mision, estado: 'espera', proximaEjecucion: calcularProximaEjecucion(mision.frecuencia) });
    }
  };

  const prepararContextoMision = async (_mision: DBMisionAgent) => {
    const ventasRecientes = await db.getAllVentas();
    const inventarioBajo = (await db.getAllInventario()).filter((i: any) => i.stockActual < i.stockMinimo);
    return JSON.stringify({
      ventas_hoy: ventasRecientes.length,
      alertas_inventario: inventarioBajo.length,
      hora_actual: new Date().toLocaleTimeString()
    });
  };

  const calcularProximaEjecucion = (frecuencia: string): string => {
    const d = new Date();
    if (frecuencia === '5min') d.setMinutes(d.getMinutes() + 5);
    else if (frecuencia === '1h') d.setHours(d.getHours() + 1);
    else if (frecuencia === 'diaria') d.setDate(d.getDate() + 1);
    else d.setMinutes(d.getMinutes() + 15);
    return d.toISOString();
  };

  return (
    <CentinelaContext.Provider value={{ misionesActivas, hallazgos, ejecutarMisionManual: ejecutarMision, isVigilando }}>
      {children}

      {/* Boton flotante NexusSync — parpadea cuando hay cambios en curso */}
      <button
        onClick={handleSyncNow}
        disabled={isSyncingManual}
        title={syncConnected ? 'Realtime conectado - clic para sincronizar ahora' : 'Clic para sincronizar ahora'}
        className="nexus-sync-fab"
        style={{
          position: 'fixed',
          bottom: 16, right: 16,
          zIndex: 9997,
          background: syncConnected ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.85)',
          border: '1px solid ' + (syncConnected ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.2)'),
          borderRadius: 20, padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: isSyncingManual ? 'wait' : 'pointer',
          color: syncConnected ? '#6ee7b7' : '#94a3b8',
          fontSize: 11, fontWeight: 600,
          backdropFilter: 'blur(8px)', transition: 'all 0.2s',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isSyncingManual || (syncCountdown !== null && syncCountdown > 0)
            ? '#f59e0b' : syncConnected ? '#10b981' : '#64748b',
          display: 'inline-block',
          animation: isSyncingManual || (syncCountdown !== null && syncCountdown > 0)
            ? 'pulse 0.8s infinite' : 'none',
        }} />
        <style>{`
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
          @media (max-width: 1023px) {
            .nexus-sync-fab { bottom: 72px !important; }
          }
        `}</style>
        {isSyncingManual ? 'Sincronizando...' : 'NexusSync'}
      </button>

      {/* Barra de nueva versión — delgada, cuenta 5s, parpadea x2 y se cierra sola. Sin recarga. */}
      {updateAvailable && (
        <VersionBar onDismiss={() => { /* solo cierra */ }} recargar={recargar} />
      )}
    </CentinelaContext.Provider>
  );
};

export const useCentinela = () => {
  const context = useContext(CentinelaContext);
  if (!context) throw new Error('useCentinela debe usarse dentro de CentinelaProvider');
  return context;
};
