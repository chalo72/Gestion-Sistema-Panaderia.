import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL = 30_000;       // Verifica cada 30 segundos
const STORAGE_KEY    = 'dp_build_timestamp';

/**
 * Actualización automática real — sin clic del usuario.
 *
 * Mecanismo dual:
 *   1. Service Worker controllerchange:
 *      Cuando el nuevo SW toma el control (skipWaiting ya activo en vite.config),
 *      el evento 'controllerchange' se dispara y recargamos la página en ese instante.
 *      Esto garantiza que cada build nuevo se aplique automáticamente.
 *
 *   2. Polling de version.json (respaldo):
 *      Por si el SW no está disponible (modo web normal), compara timestamps
 *      y recarga al detectar versión nueva + 2 minutos de inactividad o tab oculto.
 */
export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion]           = useState<string | null>(null);
  const [currentVersion, setCurrentVersion]   = useState<string | null>(null);
  const [isUpdating, setIsUpdating]           = useState(false);

  const savedTimestampRef = useRef(parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  const pendingUpdateRef  = useRef(false);
  const idleTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadingRef      = useRef(false); // Evitar recargas dobles

  // ── Recarga limpia ────────────────────────────────────────────────
  const recargar = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    window.location.reload();
  }, []);

  // ── 1. Service Worker controllerchange (mecanismo principal) ──────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Registrar el listener ANTES de que cambie el controller
    const handleControllerChange = () => {
      // El nuevo SW tomó el control — recargar para usar los nuevos archivos
      recargar();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // También forzar update del SW registrado para que detecte nuevas versiones
    navigator.serviceWorker.ready.then(reg => {
      // Verificar actualizaciones cada CHECK_INTERVAL ms
      const interval = setInterval(() => reg.update(), CHECK_INTERVAL);
      return () => clearInterval(interval);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [recargar]);

  // ── 2. Polling version.json (respaldo para modo web sin SW) ───────
  const aplicarActualizacion = useCallback(() => {
    if (!pendingUpdateRef.current) return;
    recargar();
  }, [recargar]);

  const resetIdleTimer = useCallback(() => {
    if (!pendingUpdateRef.current) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(aplicarActualizacion, 2 * 60_000);
  }, [aplicarActualizacion]);

  const activarModoPendiente = useCallback((version: string) => {
    pendingUpdateRef.current = true;
    setUpdateAvailable(true);
    setNewVersion(version);

    // Tab oculto → recargar de inmediato
    const handleVisibility = () => {
      if (document.hidden) aplicarActualizacion();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Inactividad 2 min → recargar
    const eventos: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    eventos.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      eventos.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [aplicarActualizacion, resetIdleTimer]);

  const checkForUpdates = useCallback(async () => {
    if (pendingUpdateRef.current) return;
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
