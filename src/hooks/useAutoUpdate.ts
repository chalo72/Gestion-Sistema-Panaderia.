import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL  = 90 * 1000;   // Cada 90 segundos — cache de Anthropic dura 5min, esto es seguro
const STORAGE_KEY     = 'nexus_build_ts';
const RELOAD_DELAY_MS = 4_000;       // 4 segundos de aviso antes de recargar

/**
 * Auto-actualización triple capa:
 *
 *  1. Service Worker controllerchange — cuando nuevo SW toma control, recarga en 1s
 *  2. Polling version.json — cada 90s compara timestamps; si hay cambio, recarga en 4s
 *  3. reg.update() en cada check — fuerza al navegador a descargar SW nuevo sin esperar
 *
 * La combinación garantiza que cualquier dispositivo que tenga la app abierta
 * detecte una nueva versión en ≤90 segundos, sin importar si el usuario refresca o no.
 */

function forceSWUpdate() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {});
}

export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion]           = useState<string | null>(null);
  const [currentVersion, setCurrentVersion]   = useState<string | null>(null);
  const [countdown, setCountdown]             = useState<number | null>(null);
  const [isUpdating, setIsUpdating]           = useState(false);

  const savedTimestampRef = useRef(parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  const reloadingRef      = useRef(false);
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Recarga limpia ────────────────────────────────────────────────────────
  const recargar = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    window.location.reload();
  }, []);

  // ── Cuenta regresiva → recarga ────────────────────────────────────────────
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

  // ── Capa 1: Service Worker controllerchange ───────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // Nuevo SW tomó control → recargar en 1s (reducido de 3s para respuesta más ágil)
      setTimeout(() => recargar(), 1000);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Forzar comprobación de SW inmediatamente al montar
    forceSWUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [recargar]);

  // ── Capa 2 + 3: Polling version.json + reg.update() simultáneo ───────────
  const checkForUpdates = useCallback(async () => {
    if (reloadingRef.current || updateAvailable) return;

    // Siempre forzar comprobación del SW junto con el polling de version.json
    // Esto garantiza que si hay un SW nuevo en Vercel, el navegador lo descargue
    forceSWUpdate();

    try {
      const res = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' }
      });
      if (!res.ok) return;

      const data                    = await res.json();
      const serverTimestamp: number = data.timestamp ?? 0;
      const version: string         = data.version   ?? '';

      setCurrentVersion(version);

      if (savedTimestampRef.current === 0) {
        // Primera visita — guardar sin recargar
        savedTimestampRef.current = serverTimestamp;
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        return;
      }

      if (serverTimestamp > savedTimestampRef.current) {
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        savedTimestampRef.current = serverTimestamp;
        iniciarContadorYRecargar(version);
      }
    } catch {
      // Sin red — ignorar
    }
  }, [updateAvailable, iniciarContadorYRecargar]);

  useEffect(() => {
    // Verificar inmediatamente al cargar la página
    checkForUpdates();

    // Polling cada 90 segundos
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    // Verificar al volver al tab / desbloquear pantalla / traer app al frente
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };
    // Verificar también en foco de ventana (escritorio)
    const handleFocus = () => checkForUpdates();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdates]);

  return { currentVersion, updateAvailable, newVersion, countdown, isUpdating, recargar };
}
