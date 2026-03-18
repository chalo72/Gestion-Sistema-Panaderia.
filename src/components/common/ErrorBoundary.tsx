import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>

                            <h1 className="text-xl font-bold">
                                Algo salió mal
                            </h1>

                            <p className="text-slate-400 text-sm">
                                La aplicación ha encontrado un error inesperado al renderizar.
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
                                Recargar página
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
