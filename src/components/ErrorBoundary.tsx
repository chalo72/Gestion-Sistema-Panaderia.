import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary en', this.props.moduleName, ':', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md border-red-200 dark:border-red-900 shadow-xl">
            <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Error en el módulo {this.props.moduleName || 'Desconocido'}
              </CardTitle>
              <CardDescription className="text-red-800/70 dark:text-red-300/70">
                El sistema de protección interceptó un error para evitar que toda la aplicación colapse.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Puedes intentar recargar este módulo o volver al menú principal. Tu información en otras secciones sigue estando segura.
              </p>
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-xs font-mono overflow-auto max-h-32 text-red-500">
                {this.state.error?.message}
              </div>
              <Button 
                onClick={() => this.setState({ hasError: false, error: null })} 
                className="w-full gap-2 bg-red-600 hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Intentar cargar de nuevo
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
