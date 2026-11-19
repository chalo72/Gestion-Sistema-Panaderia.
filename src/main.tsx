import { generateUUID } from '@/lib/safe-utils';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { CentinelaProvider } from '@/components/providers/CentinelaProvider'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import './index.css'
import { NexusDiagnostics } from '@/lib/nexus-diagnostics'
import { marcarAparatoEnHtml, diagnosticoAparato } from '@/lib/aparato-lento'

// Exponer herramientas de diagnóstico Nexus
NexusDiagnostics.expose();

// [Rendimiento en celulares de baja gama] 2026-10-04, autorizado por Gonzalo.
// Marca el <html> con data-aparato="lento" o "normal" ANTES de dibujar, para que
// el CSS del final de index.css apague el desenfoque solo en aparatos lentos.
// Si el navegador no da datos del aparato, queda "normal" y nada cambia.
// Para ver que detecto:  diagnosticoAparato()  en la consola del navegador.
marcarAparatoEnHtml();
(window as any).diagnosticoAparato = diagnosticoAparato;

// [Polyfill Crítico para Celulares / Red Local]
// Safari/Chrome en iOS/Android deshabilitan generateUUID() cuando se accede por HTTP (no HTTPS).
// Esto causa que la app se quede cargando en dispositivos móviles en red local.
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    (window.crypto as any).randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
  }
}

// Antigravity Type-Safety Shield - Blindaje de Tipos
(function () {
  const originalError = console.error;
  console.error = function (...args) {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        if (arg instanceof Error) return arg.message + '\n' + arg.stack;
        return arg;
      } catch {
        return '[Objeto no imprimible]';
      }
    });
    originalError.apply(console, sanitizedArgs);
    // Enviar error a Nexus Core en segundo plano
    NexusDiagnostics.sendTelemetry('error', sanitizedArgs.join(' '));
  };
})();

// [Sin internet, 2026-11-18, AUTORIZO Gonzalo] Antes, si una parte de la app no cargaba, se
// borraba TODA la copia offline y se recargaba: sin internet la app quedaba muerta. Ahora:
// - sin internet: no se borra nada; se avisa que esa parte necesita internet.
// - con internet: se limpia y recarga UNA vez (no en bucle).
function avisarSinInternet() {
  try {
    if (document.getElementById('aviso-sin-internet')) return;
    const d = document.createElement('div');
    d.id = 'aviso-sin-internet';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#7c2d12;color:#fff;padding:12px 16px;border-radius:12px;font:600 15px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.3)';
    d.textContent = 'Sin internet: esta parte de la app no se pudo abrir. Lo demás sigue funcionando; vuelve a intentarlo cuando regrese el internet.';
    d.onclick = () => d.remove();
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 10000);
  } catch { /* sin aviso */ }
}
function limpiarYRecargarSiHayInternet() {
  if (navigator.onLine === false) { avisarSinInternet(); return; }
  try {
    const ultimo = Number(sessionStorage.getItem('nexus_purga_chunk') || 0);
    if (Date.now() - ultimo < 60000) { avisarSinInternet(); return; } // ya se intentó hace poco: no repetir
    sessionStorage.setItem('nexus_purga_chunk', String(Date.now()));
  } catch { /* sigue */ }
  if ('caches' in window) {
    caches.keys().then(keys => {
      Promise.all(
        keys
          .filter(k => !k.includes('data') && !k.includes('idb'))
          .map(k => caches.delete(k))
      ).then(() => window.location.reload());
    });
  } else {
    window.location.reload();
  }
}

// [Nexus-Shield] Interceptor Global de ChunkLoadError
// vite:preloadError se dispara ANTES de que React falle → evita que el ErrorBoundary lo capture
window.addEventListener('vite:preloadError', (event) => {
  (event as Event).preventDefault();
  console.warn('⚡ [Nexus-Shield] vite:preloadError');
  limpiarYRecargarSiHayInternet();
});

// [Nexus-Shield] Ignorar errores inofensivos de ResizeObserver de ReactFlow
window.addEventListener('error', (event) => {
  if (event.message && (event.message.includes('ResizeObserver loop limit exceeded') || event.message.includes('ResizeObserver loop completed'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn('⚡ [Nexus-Shield] Ignorando error inofensivo de ResizeObserver');
  }
});

// Fallback: unhandledrejection para casos donde vite:preloadError no aplica
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const msg = error?.message || String(error) || '';
  const isChunk =
    error?.name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('Loading chunk');

  if (isChunk) {
    console.warn('⚡ [Nexus-Shield] ChunkLoadError fallback');
    event.preventDefault();
    limpiarYRecargarSiHayInternet();
  }
});

// Registro de Service Worker para PWA
// onNeedRefresh no fuerza la activación — useAutoUpdate muestra el banner y el usuario decide
const updateSW = registerSW({
  // Registrar YA, sin esperar a que la página termine de cargar: en producción eso tardaba
  // 20–40 s y el protector offline llegaba tarde o nunca (2026-11-18, AUTORIZO Gonzalo).
  immediate: true,
  onNeedRefresh() { /* banner manejado por useAutoUpdate/CentinelaProvider */ },
  onOfflineReady() { /* sin aviso al usuario */ },
});
// Exponer para diagnóstico (ej: window.__updateSW(true) desde consola)
(window as any).__updateSW = updateSW;

import { db } from '@/lib/database'; // Nueva importación

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("❌ CRITICAL: No se encontró el elemento #root");
    return;
  }

  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
    }

    await db.init();
    
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <AuthProvider>
            <CentinelaProvider>
              <App />
            </CentinelaProvider>
          </AuthProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    console.error("❌ CRITICAL: Falló el inicio de la app:", err);
    document.body.innerHTML = '<div style="color:red;padding:2rem;text-align:center;"><h2>⚠️ Error Crítico de Inicio</h2><p>La base de datos local no pudo iniciar. Por favor, recarga la página.</p></div>';
  }
}

bootstrap();
