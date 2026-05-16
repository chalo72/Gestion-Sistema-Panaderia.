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
// Captura errores de imports dinámicos fallidos ANTES de que lleguen al ErrorBoundary
// Esto protege casos donde el error ocurre fuera del árbol de React
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
    console.warn('⚡ [Nexus-Shield] ChunkLoadError global detectado — purgando caché y recargando...');
    event.preventDefault(); // No mostrar en consola como error no manejado
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys
          .filter(k => !k.includes('data') && !k.includes('idb'))
          .forEach(k => caches.delete(k));
        setTimeout(() => window.location.reload(), 600);
      });
    } else {
      setTimeout(() => window.location.reload(), 600);
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
