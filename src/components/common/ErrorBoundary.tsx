import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    isChunkError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * [Nexus-Shield] Anti-ChunkLoadError Guard
 * Detecta cuando un chunk JS dinámico no se puede cargar (por deploy nuevo en Vercel)
 * y recarga automáticamente sin mostrar pantalla de error al usuario.
 */
function isChunkLoadError(error: Error): boolean {
    const msg = error?.message || '';
    const name = error?.name || '';
    return (
        name === 'ChunkLoadError' ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Unable to preload CSS') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk')
    );
}

export class ErrorBoundary extends Component<Props, State> {
    private reloadAttempts = 0;
    private readonly MAX_RELOAD_ATTEMPTS = 2;

    public state: State = {
        hasError: false,
        isChunkError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        const chunkError = isChunkLoadError(error);
        return { hasError: true, isChunkError: chunkError, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        // [Nexus-Shield] Si es un ChunkLoadError: limpiar cache SW y recargar automáticamente
        if (isChunkLoadError(error)) {
            console.warn('⚡ [Nexus-Shield] ChunkLoadError detectado — recargando para obtener assets frescos...');
            this.reloadAttempts++;

            if (this.reloadAttempts <= this.MAX_RELOAD_ATTEMPTS) {
                // Limpiar cache del Service Worker antes de recargar
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        // Solo purgar caches de assets (no datos)
                        if ('caches' in window) {
                            caches.keys().then(keys => {
                                keys
                                    .filter(k => !k.includes('data') && !k.includes('idb'))
                                    .forEach(k => caches.delete(k));
                            });
                        }
                        // Recargar tras breve pausa (permite que IndexedDB termine ops pendientes)
                        setTimeout(() => window.location.reload(), 800);
                    });
                } else {
                    setTimeout(() => window.location.reload(), 800);
                }
            } else {
                console.error('❌ [Nexus-Shield] Demasiados intentos de recarga. Mostrando error al usuario.');
            }
        } else {
            console.error('Uncaught error:', error, errorInfo);
        }
    }

    private handleReload = () => {
        // Hard reload para limpiar caché del navegador
        if ('caches' in window) {
            caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
        }
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            // Si es ChunkLoadError y aún no superó intentos: mostrar spinner de recarga
            if (this.state.isChunkError && this.reloadAttempts <= this.MAX_RELOAD_ATTEMPTS) {
                return (
                    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-t-2 border-indigo-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-indigo-400" />
                                </div>
                            </div>
                            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                                Actualizando módulos...
                            </p>
                            <p className="text-slate-500 text-xs text-center max-w-xs">
                                Nueva versión detectada. Recargando assets...
                            </p>
                        </div>
                    </div>
                );
            }

            // Error genuino — mostrar pantalla de error
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>

                            <h1 className="text-xl font-bold">
                                Error Crítico
                            </h1>

                            <p className="text-slate-400 text-sm">
                                La aplicación encontró un error que no pudo resolverse automáticamente.
                            </p>

                            <div className="w-full bg-slate-950 rounded-lg p-4 text-left overflow-auto max-h-48 border border-slate-800 font-mono text-xs">
                                <p className="text-red-400 break-all mb-2">
                                    {this.state.error?.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-slate-500 overflow-x-auto whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>

                            <Button
                                onClick={this.handleReload}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Limpiar caché y recargar
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
