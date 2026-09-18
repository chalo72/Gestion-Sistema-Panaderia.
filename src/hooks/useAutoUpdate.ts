import { useEffect, useState, useCallback, useRef } from 'react';

// ── Constantes ────────────────────────────────────────────────────────────────
const CHECK_INTERVAL    = 45 * 1000;     // Polling cada 45 segundos
const STORAGE_KEY       = 'nexus_build_ts';
const BROADCAST_CHANNEL = 'nexus_update_v1';
const HIDDEN_THRESHOLD  = 15 * 1000;     // 15s oculto → verificar de inmediato al volver (desbloqueo de celular)

/**
 * HyperSync — actualización por 4 canales simultáneos:
 *
 *  Canal A — BroadcastChannel:  cuando una pestaña detecta nueva versión,
 *            avisa a TODAS las demás pestañas del mismo navegador al instante.
 *
 *  Canal B — StorageEvent:      doble seguro del Canal A usando localStorage
 *            (compatible con navegadores que bloquean BroadcastChannel).
 *
 *  Canal C — version.json polling cada 45s + forzar SW.update() simultáneo.
 *
 *  Canal D — "Modo Sombra":     si la app estuvo oculta >15s, verifica
 *            dentro de los primeros 1.5s al volver (desbloqueo de pantalla, cambio de app).
 *
 *  Ejecución: RECARGA NUCLEAR — desregistra SWs + limpia caches → va directo
 *             a Vercel sin intermediario, cargando la versión más nueva.
 */

// ── Recarga nuclear — borra caché del SW + desregistra + recarga ─────────────
// Garantiza que móviles con PWA instalada carguen la versión más nueva.
async function nuclearReload(): Promise<void> {
  try {
    // 1. Borrar todos los caches del Service Worker
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // 2. Desregistrar todos los Service Workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch { /* ignorar errores — recargar de todas formas */ }
  // 3. Forzar descarga fresca evitando caché del navegador
  const cleanUrl = window.location.href.split('?')[0];
  window.location.replace(`${cleanUrl}?_v=${Date.now()}`);
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

  // ── Notificar nueva versión — activa el banner de actualización
  const iniciarContadorYRecargar = useCallback((version: string) => {
    if (reloadingRef.current) return;
    setUpdateAvailable(true);
    setNewVersion(version);
  }, []);

  // ── Capa 1 (SW): controllerchange ─────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      if (hadController && !reloadingRef.current) {
        // SW nuevo tomó el control → avisar al usuario
        iniciarContadorYRecargar('');
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    forceSWUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [iniciarContadorYRecargar]);

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
      // Query param _t evita caché de disco y red en Android WebView / iOS Safari
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
      });
      if (!res.ok) return;

      const data: { timestamp?: number; version?: string } = await res.json();
      const serverTimestamp = data.timestamp ?? 0;
      const version         = data.version   ?? '';

      setCurrentVersion(version);

      if (serverTimestamp <= 0) return;

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
        hiddenSinceRef.current = null;
      }
    } catch {
      // Sin red — ignorar
    }
  }, [updateAvailable, iniciarContadorYRecargar, broadcastUpdate]);

  useEffect(() => {
    // Verificar al montar
    checkForUpdates();

    // Canal C: polling periódico
    const interval = setInterval(() => checkForUpdates(), CHECK_INTERVAL);

    // Canal D: Modo Sombra + Desbloqueo / Foco
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
      } else {
        const hiddenSince = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        const wasLongHidden = hiddenSince === null || (Date.now() - hiddenSince) >= HIDDEN_THRESHOLD;

        if (wasLongHidden) {
          // Despertó del bloqueo o cambio de app → verificar de inmediato
          setTimeout(() => checkForUpdates(true), 1200);
        }
      }
    };

    const handleFocus = () => {
      checkForUpdates(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', () => checkForUpdates(true));

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdates]);

  return { currentVersion, updateAvailable, newVersion, countdown, isUpdating, recargar };
}
