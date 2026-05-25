import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL  = 60 * 1000;   // Cada 60 segundos
const STORAGE_KEY     = 'nexus_build_ts';
const RELOAD_DELAY_MS = 3_000;       // 3 segundos de aviso antes de recargar

/**
 * Auto-actualización con recarga nuclear:
 *
 *  1. version.json polling — cada 60s; si hay cambio de timestamp, recarga NUCLEAR
 *  2. Service Worker controllerchange — cuando nuevo SW toma control, recarga NUCLEAR
 *  3. reg.update() en cada check — fuerza descarga del SW nuevo
 *  4. visibilitychange + focus — detecta cuando el usuario vuelve al tab/app
 *
 * RECARGA NUCLEAR: desregistra todos los SWs ANTES de recargar.
 * Esto garantiza que el navegador vaya directo a Vercel sin intermediario,
 * resolviendo el problema donde Chrome/Safari servían la versión vieja del cache
 * aunque ya existiera una nueva versión desplegada.
 */

async function nuclearReload(): Promise<void> {
  // Paso 1: desregistrar todos los service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    } catch {
      // Si falla el desregistro, igual recargamos
    }
  }
  // Paso 2: limpiar caches del navegador
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {
      // Si falla la limpieza, igual recargamos
    }
  }
  // Paso 3: recarga forzada (va directo a red, sin SW que intercepte)
  window.location.reload();
}

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

  // ── Recarga nuclear ───────────────────────────────────────────────────────
  const recargar = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    nuclearReload();
  }, []);

  // ── Cuenta regresiva → recarga nuclear ───────────────────────────────────
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
      // Nuevo SW tomó control → recarga nuclear en 1s
      setTimeout(() => recargar(), 1000);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    forceSWUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [recargar]);

  // ── Capa 2 + 3: Polling version.json + reg.update() ──────────────────────
  const checkForUpdates = useCallback(async () => {
    if (reloadingRef.current || updateAvailable) return;

    forceSWUpdate();

    try {
      const res = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
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
    checkForUpdates();

    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };
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
