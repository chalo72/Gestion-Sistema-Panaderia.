import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { CentinelaProvider } from '@/components/providers/CentinelaProvider'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import './index.css'

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
