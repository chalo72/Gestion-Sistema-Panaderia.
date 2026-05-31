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

// Barra de versión — cuenta 5s, parpadea x2, se cierra sola. Sin recarga forzada.
function VersionBar({ onDismiss, recargar }: { onDismiss: () => void; recargar: () => void }) {
  const [secs, setSecs] = React.useState(5);
  const [flash, setFlash] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    const t = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(t);
          setFlash(true);
          setTimeout(() => { setFlash(false); setTimeout(() => setHidden(true), 200); }, 600);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  if (hidden) return null;
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
      <span>&#128260; Nueva versión lista — {secs > 0 ? `cierra en ${secs}s` : '✓'}</span>
      <button onClick={recargar} style={{
        background:'rgba(255,255,255,0.18)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',
        borderRadius:6,padding:'1px 10px',fontSize:10,fontWeight:700,cursor:'pointer',
      }}>Aplicar</button>
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
      const m = await db.getAgenteMisiones();
      const h = await db.getAgenteHallazgos(20);
      setMisionesActivas(m);
      setHallazgos(h);
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
    timerRef.current = setInterval(loop, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const ejecutarMision = async (mision: DBMisionAgent) => {
    console.log('[Centinela] Ejecutando mision para ' + mision.agenteId);
    try {
      await db.saveAgenteMision({ ...mision, estado: 'ejecutando' });
      const ahora = new Date().toISOString();
      const contexto = await prepararContextoMision(mision);
      const respuesta = await consultarAgente(mision.agenteId, 'EJECUTA MISION CRITICA: ' + mision.misionExplicita + '. CONTEXTO: ' + contexto, () => {});
      if (respuesta.toLowerCase().includes('hallazgo') || respuesta.toLowerCase().includes('alerta')) {
        const nuevoHallazgo: DBHallazgoAgente = {
          id: generateUUID(),
          agenteId: mision.agenteId,
          misionId: mision.id,
          tipo: 'operativo',
          gravedad: 'media',
          titulo: 'Resultado de Mision: ' + mision.misionExplicita.substring(0, 30) + '...',
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
      console.error('Falla en mision Centinela:', error);
      await db.saveAgenteMision({ ...mision, estado: 'espera' });
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
