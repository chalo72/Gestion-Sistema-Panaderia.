import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    sectionName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Error in section ${this.props.sectionName}:`, error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full min-h-[400px] flex items-center justify-center p-6 border-2 border-dashed border-red-500/20 bg-red-500/5 rounded-3xl">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                                {this.props.sectionName || 'Sección'} no disponible
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Ha ocurrido un error inesperado en este módulo.
                                El resto del sistema sigue funcionando correctamente.
                            </p>
                        </div>

                        <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-red-200 dark:border-red-900/50 text-left overflow-auto max-h-32 text-xs font-mono">
                            <span className="text-red-500 select-all">
                                {this.state.error?.toString()}
                            </span>
                        </div>

                        <Button
                            onClick={this.handleRetry}
                            variant="outline"
                            className="mt-4 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-900/20"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Intentar Recargar Módulo
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
