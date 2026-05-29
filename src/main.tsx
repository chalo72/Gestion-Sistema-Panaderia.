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

// Exponer herramientas de diagnóstico Nexus
NexusDiagnostics.expose();

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
  };
})();

// [Nexus-Shield] Interceptor Global de ChunkLoadError
// vite:preloadError se dispara ANTES de que React falle → evita que el ErrorBoundary lo capture
window.addEventListener('vite:preloadError', (event) => {
  (event as Event).preventDefault();
  console.warn('⚡ [Nexus-Shield] vite:preloadError — purgando caché SW y recargando...');
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
    console.warn('⚡ [Nexus-Shield] ChunkLoadError fallback — purgando caché y recargando...');
    event.preventDefault();
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
});

// Registro de Service Worker para PWA — recargar SOLO después de confirmar datos guardados
const updateSW = registerSW({
  onNeedRefresh() {
    // Esperar 3 segundos para que operaciones pendientes de IndexedDB se completen
    setTimeout(() => updateSW(true), 3000);
  },
  onOfflineReady() {
    // App lista para uso offline — sin aviso al usuario
  },
})

console.log("⚙️ main.tsx: Iniciando montaje de React...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("❌ CRITICAL: No se encontró el elemento #root");
} else {
  try {
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
    console.log("✅ main.tsx: Renderizado inicial ejecutado exitosamente");
  } catch (err) {
    console.error("❌ CRITICAL: Falló el renderizado inicial de React:", err);
  }
}
