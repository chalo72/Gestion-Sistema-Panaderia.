import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    sectionName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    isDynamicImportError: boolean;
    reloaded: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        isDynamicImportError: false,
        reloaded: false
    };

    public static getDerivedStateFromError(error: Error): State {
        const isDynamicImportError = 
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed') ||
            error.message.includes('error loading dynamically imported module');
            
        return { 
            hasError: true, 
            error, 
            isDynamicImportError,
            reloaded: false
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`🚨 [Shield] Error detectado en sección ${this.props.sectionName}:`, error, errorInfo);
        
        // Auto-recuperación: Si es un error de importación, intentar recargar una vez automáticamente
        if (this.state.isDynamicImportError && !sessionStorage.getItem('last_reload_attempt')) {
            console.warn("🔄 [Nexus-Volt] Detectado fallo de módulo. Intentando auto-recuperación...");
            sessionStorage.setItem('last_reload_attempt', Date.now().toString());
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null, isDynamicImportError: false });
    };

    private handleHardReload = () => {
        console.log("🧹 [Shield] Ejecutando purga de caché y reinicio forzado...");
        
        // Limpiar Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                for(let reg of regs) reg.unregister();
            });
        }
        
        // Limpiar Caches
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }

        // Limpiar rastro de recarga
        sessionStorage.removeItem('last_reload_attempt');
        
        // Recargar desde servidor bypass cache
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            const isImportError = this.state.isDynamicImportError;

            return (
                <div className="h-full w-full min-h-[400px] flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50/50 to-rose-50/50 dark:from-slate-950 dark:to-slate-900 rounded-[3rem] border border-white/20 backdrop-blur-3xl shadow-2xl animate-ag-fade-in relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />

                    <div className="text-center space-y-8 max-w-lg relative z-10 px-4">
                        <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl rotate-3 group hover:rotate-0 transition-transform duration-700">
                            <div className={`w-16 h-16 bg-gradient-to-tr ${isImportError ? 'from-amber-200 to-amber-100 dark:from-amber-700 dark:to-amber-600' : 'from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600'} rounded-2xl flex items-center justify-center`}>
                                {isImportError ? (
                                    <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-pulse" />
                                ) : (
                                    <AlertTriangle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">
                                {isImportError ? 'Desincronización Detectada' : `${this.props.sectionName || 'Módulo'} en Mantenimiento`}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                                {isImportError 
                                    ? "El sistema ha detectado una versión nueva del módulo. Es necesario refrescar la caché para continuar con seguridad."
                                    : "Hemos detectado una inconsistencia técnica. El sistema ha aislado este módulo para proteger la integridad de tus datos."}
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-[2rem] border-2 border-dashed border-red-200 dark:border-red-900/50 text-left overflow-hidden shadow-2xl animate-ag-shake">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[12px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Error Crítico Detectado</span>
                                </div>
                                <code className="text-[12px] font-bold text-red-700 dark:text-red-300 block break-all whitespace-pre-wrap leading-tight font-mono p-4 bg-white/50 dark:bg-black/30 rounded-xl mb-3">
                                    {this.state.error?.message}
                                </code>
                                {isImportError && (
                                    <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                                        <RefreshCcw className="w-3 h-3 animate-spin" />
                                        Recomendación: Reinicio de Sistema Requerido
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                onClick={this.handleRetry}
                                variant="outline"
                                className="h-14 px-8 rounded-2xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 transition-all hover:scale-105 active:scale-95"
                            >
                                <RotateCcw className="w-4 h-4 mr-3" />
                                Reintentar Carga
                            </Button>

                            <Button
                                onClick={this.handleHardReload}
                                className={`h-14 px-10 rounded-2xl ${isImportError ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'} text-white font-black uppercase text-xs tracking-widest shadow-xl border-none transition-all hover:scale-105 active:scale-95`}
                            >
                                <RefreshCcw className="w-4 h-4 mr-3" />
                                Reiniciar Sistema
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
