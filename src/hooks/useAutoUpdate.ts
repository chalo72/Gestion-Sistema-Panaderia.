import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL = 60_000;       // Verifica cada 60 segundos
const IDLE_TIMEOUT   = 2 * 60_000;   // 2 minutos sin actividad → actualiza
const STORAGE_KEY    = 'dp_build_timestamp';

function recargar() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      Promise.all(regs.map(r => r.update())).finally(() => window.location.reload());
    });
  } else {
    window.location.reload();
  }
}

/**
 * Actualización automática no-disruptiva.
 *
 * Cuando detecta una nueva versión espera el momento oportuno:
 *   1. Si el usuario minimiza la app o cambia de pestaña → recarga inmediata.
 *   2. Si lleva 2 minutos sin tocar nada → recarga silenciosa.
 *
 * Nunca interrumpe una venta, un arqueo ni ningún flujo activo.
 */
export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable]   = useState(false);
  const [newVersion, setNewVersion]             = useState<string | null>(null);
  const [currentVersion, setCurrentVersion]     = useState<string | null>(null);
  const [isUpdating, setIsUpdating]             = useState(false);

  const savedTimestampRef  = useRef(parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  const pendingUpdateRef   = useRef(false);   // ¿hay update esperando?
  const idleTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Aplicar la actualización ────────────────────────────────────
  const aplicarActualizacion = useCallback(() => {
    if (!pendingUpdateRef.current) return;
    setIsUpdating(true);
    recargar();
  }, []);

  // ── Reiniciar el temporizador de inactividad ────────────────────
  const resetIdleTimer = useCallback(() => {
    if (!pendingUpdateRef.current) return;           // Sin update pendiente → no hacer nada
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      aplicarActualizacion();                        // 2 min sin actividad → actualiza
    }, IDLE_TIMEOUT);
  }, [aplicarActualizacion]);

  // ── Cuando llega una nueva versión → armar los disparadores ────
  const activarModoPendiente = useCallback((version: string) => {
    pendingUpdateRef.current = true;
    setUpdateAvailable(true);
    setNewVersion(version);

    // Disparador 1: app en background (minimizada o pestaña oculta)
    const handleVisibility = () => {
      if (document.hidden) aplicarActualizacion();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Disparador 2: inactividad del usuario
    const eventos: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    eventos.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));

    // Arrancar el timer de inactividad desde ya
    resetIdleTimer();

    // Cleanup al desmontar
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      eventos.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [aplicarActualizacion, resetIdleTimer]);

  // ── Verificar si hay nueva versión en el servidor ───────────────
  const checkForUpdates = useCallback(async () => {
    if (pendingUpdateRef.current) return;   // Ya hay una pendiente, no verificar de nuevo
    try {
      const res = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return;

      const data = await res.json();
      const serverTimestamp: number = data.timestamp ?? 0;
      const version: string         = data.version   ?? '';

      setCurrentVersion(version);

      if (savedTimestampRef.current === 0) {
        savedTimestampRef.current = serverTimestamp;
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        return;
      }

      if (serverTimestamp > savedTimestampRef.current) {
        console.log(`[AutoUpdate] Nueva versión: ${version} — esperando momento oportuno`);
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        savedTimestampRef.current = serverTimestamp;
        activarModoPendiente(version);
      }
    } catch {
      // Servidor offline — ignorar
    }
  }, [activarModoPendiente]);

  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return { currentVersion, updateAvailable, newVersion, isUpdating, aplicarActualizacion };
}
