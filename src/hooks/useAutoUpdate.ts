import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL  = 20_000; // Verifica cada 20 segundos
const STORAGE_KEY     = 'dp_build_timestamp';
const RELOAD_DELAY_MS = 5_000;  // 5 segundos de aviso antes de recargar

/**
 * Auto-actualización completamente automática — sin interacción del usuario.
 *
 * Mecanismo dual:
 *   1. Service Worker controllerchange:
 *      Cuando el nuevo SW toma el control (skipWaiting en vite.config),
 *      recargamos inmediatamente. Aplica siempre que haya SW activo.
 *
 *   2. Polling de version.json (respaldo para red local sin SW):
 *      Compara timestamps cada 20 segundos. Si detecta versión nueva,
 *      muestra aviso de 5 segundos y recarga sin requerir acción del usuario.
 */
export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion]           = useState<string | null>(null);
  const [currentVersion, setCurrentVersion]   = useState<string | null>(null);
  const [countdown, setCountdown]             = useState<number | null>(null);
  const [isUpdating, setIsUpdating]           = useState(false);

  const savedTimestampRef = useRef(parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  const reloadingRef      = useRef(false);
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Recarga limpia ────────────────────────────────────────────────
  const recargar = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    window.location.reload();
  }, []);

  // ── Iniciar cuenta regresiva y recargar automáticamente ───────────
  const iniciarContadorYRecargar = useCallback((version: string) => {
    if (reloadingRef.current) return;
    setUpdateAvailable(true);
    setNewVersion(version);
    setCountdown(Math.round(RELOAD_DELAY_MS / 1000));

    let segs = Math.round(RELOAD_DELAY_MS / 1000);
    countdownRef.current = setInterval(() => {
      segs -= 1;
      setCountdown(segs);
      if (segs <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        recargar();
      }
    }, 1000);
  }, [recargar]);

  // ── 1. Service Worker controllerchange (mecanismo principal) ──────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // Nuevo SW tomó control — recargar de inmediato
      recargar();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Verificar actualizaciones de SW cada CHECK_INTERVAL
    let swUpdateInterval: ReturnType<typeof setInterval> | null = null;
    navigator.serviceWorker.ready.then(reg => {
      swUpdateInterval = setInterval(() => reg.update(), CHECK_INTERVAL);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (swUpdateInterval) clearInterval(swUpdateInterval);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [recargar]);

  // ── 2. Polling version.json (respaldo para modo red local sin SW) ─
  const checkForUpdates = useCallback(async () => {
    if (reloadingRef.current || updateAvailable) return;
    try {
      const res = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (!res.ok) return;

      const data             = await res.json();
      const serverTimestamp: number = data.timestamp ?? 0;
      const version: string         = data.version   ?? '';

      setCurrentVersion(version);

      if (savedTimestampRef.current === 0) {
        // Primera visita — guardar timestamp actual sin recargar
        savedTimestampRef.current = serverTimestamp;
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        return;
      }

      if (serverTimestamp > savedTimestampRef.current) {
        // Nueva versión detectada — actualizar storage e iniciar cuenta regresiva
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        savedTimestampRef.current = serverTimestamp;
        iniciarContadorYRecargar(version);
      }
    } catch {
      // Servidor offline — ignorar silenciosamente
    }
  }, [updateAvailable, iniciarContadorYRecargar]);

  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return { currentVersion, updateAvailable, newVersion, countdown, isUpdating, recargar };
}
