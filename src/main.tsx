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
import { describirErrorInicio, AVISO_NO_BORRAR_DATOS } from '@/lib/error-inicio'
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
    mostrarErrorInicio(err);
  }
}

// Pantalla de error de inicio: muestra la causa real, qué hacer y un botón Reintentar.
// Se arma con textContent (no innerHTML) porque el mensaje de error es texto externo.
function mostrarErrorInicio(err: unknown) {
  const { causa, consejo } = describirErrorInicio(err);

  const contenedor = document.createElement('div');
  contenedor.style.cssText = 'max-width:34rem;margin:0 auto;padding:2rem 1.25rem;text-align:center;font-family:system-ui,sans-serif;color:#f1f5f9;';

  const crear = (etiqueta: string, texto: string, estilo: string) => {
    const el = document.createElement(etiqueta);
    el.textContent = texto;
    el.style.cssText = estilo;
    contenedor.appendChild(el);
    return el;
  };

  crear('h2', '⚠️ La app no pudo iniciar', 'color:#f87171;font-size:1.25rem;margin:0 0 0.75rem;');
  crear('p', 'La base de datos local de este navegador no se pudo abrir.', 'margin:0 0 0.75rem;');
  crear('p', consejo, 'margin:0 0 0.75rem;');
  crear('p', AVISO_NO_BORRAR_DATOS, 'margin:0 0 1rem;font-size:0.85rem;color:#fbbf24;');

  const boton = crear('button', 'Reintentar', 'background:#4f46e5;color:#fff;border:0;border-radius:0.5rem;padding:0.75rem 1.5rem;font-size:1rem;font-weight:700;cursor:pointer;');
  boton.addEventListener('click', () => window.location.reload());

  crear('p', `Detalle técnico: ${causa}`, 'margin:1.25rem 0 0;font-size:0.75rem;color:#94a3b8;word-break:break-word;');

  document.body.replaceChildren(contenedor);
}

bootstrap();
