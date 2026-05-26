import { useEffect, useState, useCallback, useRef } from 'react';

// ── Constantes ────────────────────────────────────────────────────────────────
const CHECK_INTERVAL    = 30 * 1000;   // Polling cada 30s
const STORAGE_KEY       = 'nexus_build_ts';
const BROADCAST_CHANNEL = 'nexus_update_v1';
const RELOAD_DELAY_MS   = 3_000;
const HIDDEN_THRESHOLD  = 5 * 60 * 1000; // 5 min oculto → verificar al volver

/**
 * HyperSync — actualización por 4 canales simultáneos:
 *
 *  Canal A — BroadcastChannel:  cuando una pestaña detecta nueva versión,
 *            avisa a TODAS las demás pestañas del mismo navegador al instante.
 *
 *  Canal B — StorageEvent:      doble seguro del Canal A usando localStorage
 *            (compatible con navegadores que bloquean BroadcastChannel).
 *
 *  Canal C — version.json polling cada 30s + forzar SW.update() simultáneo.
 *
 *  Canal D — "Modo Sombra":     si la app estuvo oculta >5 min, verifica
 *            dentro de los primeros 2s al volver (bloqueo de pantalla, cambio de tab).
 *
 *  Ejecución: RECARGA NUCLEAR — desregistra SWs + limpia caches → va directo
 *             a Vercel sin intermediario, cargando la versión más nueva.
 */

// ── Recarga nuclear (desregistra SW + limpia caches) ─────────────────────────
async function nuclearReload(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    } catch { /* continúa igual */ }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch { /* continúa igual */ }
  }
  window.location.reload();
}

// ── Forzar descarga del SW nuevo ─────────────────────────────────────────────
function forceSWUpdate() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {});
}

// ── BroadcastChannel seguro (no todos los browsers lo soportan) ──────────────
function createBC(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;
  } catch { return null; }
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion]           = useState<string | null>(null);
  const [currentVersion, setCurrentVersion]   = useState<string | null>(null);
  const [countdown, setCountdown]             = useState<number | null>(null);
  const [isUpdating, setIsUpdating]           = useState(false);

  const savedTimestampRef  = useRef(parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  const reloadingRef       = useRef(false);
  const countdownRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenSinceRef     = useRef<number | null>(null);
  const bcRef              = useRef<BroadcastChannel | null>(null);

  // ── Recarga nuclear ───────────────────────────────────────────────────────
  const recargar = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    nuclearReload();
  }, []);

  // ── Broadcast: avisar a todas las pestañas hermanas ───────────────────────
  const broadcastUpdate = useCallback((version: string, ts: number) => {
    // Canal A: BroadcastChannel
    try { bcRef.current?.postMessage({ type: 'NEW_VERSION', version, ts }); } catch { /**/ }
    // Canal B: StorageEvent (dispara en otras pestañas)
    try { localStorage.setItem('nexus_update_signal', `${ts}:${version}:${Date.now()}`); } catch { /**/ }
  }, []);

  // ── Notificar nueva versión — SIN auto-recarga, el usuario decide ────────
  const iniciarContadorYRecargar = useCallback((version: string) => {
    if (reloadingRef.current) return;
    setUpdateAvailable(true);
    setNewVersion(version);
    setCountdown(null); // sin cuenta regresiva automática
  }, []);

  // ── Capa 1 (SW): controllerchange ─────────────────────────────────────────
  // Solo muestra el banner si ya había un controller activo (es decir,
  // hay un SW anterior que fue REEMPLAZADO por uno nuevo). Si no había
  // controller previo es la primera instalación — no hay nada nuevo.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      if (hadController) {
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    forceSWUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [recargar]);

  // ── Canal A + B: recibir señales de otras pestañas ────────────────────────
  useEffect(() => {
    // Canal A: BroadcastChannel
    const bc = createBC();
    bcRef.current = bc;

    if (bc) {
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'NEW_VERSION' && !reloadingRef.current) {
          const { version, ts } = ev.data;
          if (ts > savedTimestampRef.current) {
            savedTimestampRef.current = ts;
            iniciarContadorYRecargar(version);
          }
        }
      };
    }

    // Canal B: StorageEvent (otra pestaña escribió nexus_update_signal)
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'nexus_update_signal' || !e.newValue || reloadingRef.current) return;
      const [tsStr, version] = e.newValue.split(':');
      const ts = parseInt(tsStr, 10);
      if (ts > savedTimestampRef.current) {
        savedTimestampRef.current = ts;
        iniciarContadorYRecargar(version);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      bc?.close();
      bcRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, [iniciarContadorYRecargar]);

  // ── Canal C: polling + Canal D: Modo Sombra ───────────────────────────────
  const checkForUpdates = useCallback(async (isWakeUp = false) => {
    if (reloadingRef.current || updateAvailable) return;

    forceSWUpdate();

    try {
      const res = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
      });
      if (!res.ok) return;

      const data: { timestamp?: number; version?: string } = await res.json();
      const serverTimestamp = data.timestamp ?? 0;
      const version         = data.version   ?? '';

      setCurrentVersion(version);

      if (savedTimestampRef.current === 0) {
        savedTimestampRef.current = serverTimestamp;
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        return;
      }

      if (serverTimestamp > savedTimestampRef.current) {
        // Guardar timestamp y avisar a todas las pestañas hermanas
        localStorage.setItem(STORAGE_KEY, String(serverTimestamp));
        savedTimestampRef.current = serverTimestamp;
        broadcastUpdate(version, serverTimestamp);
        iniciarContadorYRecargar(version);
      } else if (isWakeUp) {
        // Wake-up sin cambio de versión → solo resetear el modo sombra
        hiddenSinceRef.current = null;
      }
    } catch {
      // Sin red — ignorar
    }
  }, [updateAvailable, iniciarContadorYRecargar, broadcastUpdate]);

  useEffect(() => {
    // Verificar al montar
    checkForUpdates();

    // Canal C: polling cada 30s
    const interval = setInterval(() => checkForUpdates(), CHECK_INTERVAL);

    // Canal D: Modo Sombra — detectar cuando el dispositivo vuelve después de >5 min oculto
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
      } else {
        const hiddenSince = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        const wasLongHidden = hiddenSince !== null && (Date.now() - hiddenSince) >= HIDDEN_THRESHOLD;

        if (wasLongHidden) {
          // Estaba oculto >5 min → verificar rápido al despertar (bloqueo de pantalla, multi-tarea)
          setTimeout(() => checkForUpdates(true), 1500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  return { currentVersion, updateAvailable, newVersion, countdown, isUpdating, recargar };
}
