import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Desinstalar Service Workers para romper el cach terco (causa de los Chunk Errors)
  private clearCacheAndWorkers = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.error('Error limpiando cach:', e);
    }
  };

  private safeReload = async () => {
    const lastReload = sessionStorage.getItem('dp_last_reload_time');
    const now = Date.now();
    
    // ANTI-BAN VERCEL: Prevenir que el usuario recargue ms de 1 vez cada 5 segundos
    if (lastReload && (now - parseInt(lastReload)) < 5000) {
        console.warn('Recarga bloqueada por seguridad (Anti-Ban Vercel)');
        return;
    }
    
    sessionStorage.setItem('dp_last_reload_time', now.toString());
    await this.clearCacheAndWorkers();
    
    // Forzar bypass de cach agregando un timestamp a la URL
    const url = new URL(window.location.href);
    url.searchParams.set('_v', now.toString());
    window.location.replace(url.toString());
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary en', this.props.moduleName, ':', error, errorInfo);
    
    const msg = error.message || '';
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes("reading 'default'") ||
      msg.includes('posible cach PWA');

    if (isChunkError) {
      const key = 'dp_chunk_reload_once';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        this.safeReload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || '';
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes("reading 'default'") ||
        msg.includes('posible cach PWA');
      
      return (
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md border-red-200 dark:border-red-900 shadow-xl">
            <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Error en el módulo {this.props.moduleName || 'Desconocido'}
              </CardTitle>
              <CardDescription className="text-red-800/70 dark:text-red-300/70">
                {isChunkError 
                  ? 'Hay una nueva versin del sistema y el navegador se atasc con la versin vieja.'
                  : 'El sistema de proteccin intercept un error para evitar que la app colapse.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isChunkError
                  ? 'Esto suele pasar tras una actualizacin. Ya limpiamos la red por ti. Pulsa el botn de abajo una sola vez para continuar.'
                  : 'Puedes intentar cargar este mdulo de nuevo. Tu informacin est segura.'}
              </p>
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-xs font-mono overflow-auto max-h-32 text-red-500">
                {this.state.error?.message}
              </div>
              <Button 
                onClick={() => {
                  if (isChunkError) {
                    this.safeReload();
                  } else {
                    this.setState({ hasError: false, error: null });
                  }
                }} 
                className="w-full gap-2 bg-red-600 hover:bg-red-700 active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                {isChunkError ? 'Descargar Versin Sólida (Seguro)' : 'Intentar cargar de nuevo'}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
