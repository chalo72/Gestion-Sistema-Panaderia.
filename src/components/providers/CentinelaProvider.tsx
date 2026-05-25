import { generateUUID } from '@/lib/safe-utils';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/database';
import type { DBMisionAgent, DBHallazgoAgente } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { applySyncPatch } from '@/lib/supabase-sync-bridge';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

interface CentinelaContextType {
  misionesActivas: DBMisionAgent[];
  hallazgos: DBHallazgoAgente[];
  ejecutarMisionManual: (mision: DBMisionAgent) => Promise<void>;
  isVigilando: boolean;
}

const CentinelaContext = createContext<CentinelaContextType | undefined>(undefined);

// Activar el puente de espejo local→Supabase UNA VEZ al iniciar (fuera del componente)
applySyncPatch();

export const CentinelaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [misionesActivas, setMisionesActivas] = useState<DBMisionAgent[]>([]);
  const [hallazgos, setHallazgos] = useState<DBHallazgoAgente[]>([]);
  const [isVigilando, setIsVigilando] = useState(false);
  const timerRef = useRef<any>(null);

  // ── Polling de versiones — detecta deploy nuevo y recarga automático ──
  const { countdown, updateAvailable, recargar } = useAutoUpdate();

  // ── Sincronización Realtime bidireccional ─────────────────────────────────
  const { pendingChanges, dismissAll } = useRealtimeSync();
  const [syncCountdown, setSyncCountdown] = useState<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const IDLE_THRESHOLD_MS = 30_000; // 30s sin actividad → auto-recarga

  // Rastrear actividad del usuario
  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', touch, { passive: true });
    window.addEventListener('keydown', touch, { passive: true });
    window.addEventListener('touchstart', touch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('touchstart', touch);
    };
  }, []);

  // Cuando llegan cambios remotos: iniciar cuenta regresiva si el usuario está inactivo
  useEffect(() => {
    if (pendingChanges.length === 0) {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      setSyncCountdown(null);
      return;
    }

    const isIdle = Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
    const initialSecs = isIdle ? 5 : 15;
    setSyncCountdown(initialSecs);

    let segs = initialSecs;
    syncTimerRef.current = setInterval(() => {
      segs -= 1;
      setSyncCountdown(segs);
      if (segs <= 0) {
        if (syncTimerRef.current) clearInterval(syncTimerRef.current);
        window.location.reload();
      }
    }, 1000);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [pendingChanges.length]);

  const aplicarSincronizacion = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    window.location.reload();
  }, []);

  const postergarSincronizacion = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    setSyncCountdown(null);
    dismissAll();
  }, [dismissAll]);

  // Cargar misiones y hallazgos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      const m = await db.getAgenteMisiones();
      const h = await db.getAgenteHallazgos(20);
      setMisionesActivas(m);
      setHallazgos(h);
    };
    cargarDatos();
  }, []);

  // Bucle de Vigilancia (Sentinel Loop)
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

    // Revisar cada 1 minuto
    timerRef.current = setInterval(loop, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const ejecutarMision = async (mision: DBMisionAgent) => {
    console.log(`🛡️ Centinela: Ejecutando misión [${mision.misionExplicita}] para ${mision.agenteId}`);
    
    try {
      // 1. Marcar como ejecutando
      await db.saveAgenteMision({ ...mision, estado: 'ejecutando' });
      const ahora = new Date().toISOString();

      // 2. Ejecutar lógica según tipo de misión
      // En una implementación real, esto consultaría a Claude Vision o analizaría la DB
      const contexto = await prepararContextoMision(mision);
      const respuesta = await consultarAgente(mision.agenteId, `EJECUTA MISIÓN CRÍTICA: ${mision.misionExplicita}. CONTEXTO ACTUAL: ${contexto}`, () => {});

      // 3. Registrar Hallazgo si la IA detecta algo importante
      if (respuesta.toLowerCase().includes('hallazgo') || respuesta.toLowerCase().includes('alerta')) {
        const nuevoHallazgo: DBHallazgoAgente = {
          id: generateUUID(),
          agenteId: mision.agenteId,
          misionId: mision.id,
          tipo: 'operativo',
          gravedad: 'media',
          titulo: `Resultado de Misión: ${mision.misionExplicita.substring(0, 30)}...`,
          descripcion: respuesta,
          fecha: new Date().toISOString(),
          revisado: false
        };
        await db.saveAgenteHallazgo(nuevoHallazgo);
        setHallazgos(prev => [nuevoHallazgo, ...prev]);
      }

      // 4. Calcular próxima ejecución
      const proxima = calcularProximaEjecucion(mision.frecuencia);
      await db.saveAgenteMision({ 
        ...mision, 
        estado: 'espera', 
        ultimaEjecucion: ahora, 
        proximaEjecucion: proxima 
      });

    } catch (error) {
      console.error("❌ Falla en misión Centinela:", error);
      await db.saveAgenteMision({ ...mision, estado: 'espera' });
    }
  };

  const prepararContextoMision = async (_mision: DBMisionAgent) => {
    // Aquí el Centinela recolecta datos reales para que el Agente decida
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
    else d.setMinutes(d.getMinutes() + 15); // Default
    return d.toISOString();
  };

  return (
    <CentinelaContext.Provider value={{
      misionesActivas,
      hallazgos,
      ejecutarMisionManual: ejecutarMision,
      isVigilando
    }}>
      {children}
      {/* ── Banner de sincronización de datos remotos ──────────────────────── */}
      {pendingChanges.length > 0 && syncCountdown !== null && (
        <div
          style={{
            position: 'fixed', bottom: updateAvailable ? 80 : 16, right: 16,
            zIndex: 9998, maxWidth: 340,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
            color: '#e2e8f0', borderRadius: 14,
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(56,189,248,0.25)',
            fontSize: 13, fontWeight: 600,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📡</span>
            <span style={{ flex: 1 }}>
              <span style={{ color: '#38bdf8' }}>Datos nuevos</span>{' '}
              <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}>
                ({pendingChanges.map(c => c.label).join(', ')})
              </span>
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400 }}>
            Recargando en <span style={{ color: '#f8fafc', fontWeight: 700 }}>{syncCountdown}s</span> para mostrar la información más reciente
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={aplicarSincronizacion}
              style={{
                flex: 1, background: '#0ea5e9', color: '#fff', border: 'none',
                borderRadius: 8, padding: '5px 10px', fontSize: 12,
                fontWeight: 800, cursor: 'pointer',
              }}
            >
              Aplicar ya
            </button>
            <button
              onClick={postergarSincronizacion}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Más tarde
            </button>
          </div>
        </div>
      )}

      {/* Banner de actualización disponible */}
      {updateAvailable && (
        <div
          style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12,
            background: '#4f46e5', color: '#fff', borderRadius: 16,
            padding: '12px 20px', boxShadow: '0 8px 32px rgba(79,70,229,0.4)',
            fontSize: 13, fontWeight: 800
          }}
        >
          <span>🔄 Nueva versión disponible{countdown !== null ? ` — recargando en ${countdown}s` : ''}</span>
          <button
            onClick={recargar}
            style={{
              background: '#fff', color: '#4f46e5', border: 'none', borderRadius: 10,
              padding: '4px 14px', fontSize: 12, fontWeight: 900, cursor: 'pointer'
            }}
          >
            Actualizar ya
          </button>
        </div>
      )}
    </CentinelaContext.Provider>
  );
};

export const useCentinela = () => {
  const context = useContext(CentinelaContext);
  if (!context) throw new Error('useCentinela debe usarse dentro de CentinelaProvider');
  return context;
};
