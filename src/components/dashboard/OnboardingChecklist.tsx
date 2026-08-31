import { CheckCircle2, ChevronRight, CircleDashed, ClipboardCheck, Package, Percent, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface OnboardingChecklistProps {
  estadisticas: {
    totalProductos: number;
    totalProveedores: number;
    totalRecetas: number;
    productosSinPrecio: number;
    totalItemsInventario: number;
  };
  onNavigateTo: (view: string) => void;
}

export function OnboardingChecklist({ estadisticas, onNavigateTo }: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('dp_onboarding_dismissed') === 'true';
  });

  const hytos = [
    {
      id: 'productos',
      title: 'Catálogo de Productos',
      description: 'Registra al menos 1 producto en el sistema.',
      isCompleted: estadisticas.totalProductos > 0,
      icon: Package,
      action: 'Crear Productos',
      view: 'productos'
    },
    {
      id: 'proveedores',
      title: 'Red de Proveedores',
      description: 'Agrega a tus proveedores clave.',
      isCompleted: estadisticas.totalProveedores > 0,
      icon: Truck,
      action: 'Ir a Proveedores',
      view: 'proveedores'
    },
    {
      id: 'recetas',
      title: 'Fórmulas y Recetas',
      description: 'Configura cómo se prepara tu pan.',
      isCompleted: estadisticas.totalRecetas > 0,
      icon: ClipboardCheck,
      action: 'Crear Recetas',
      view: 'recetas'
    },
    {
      id: 'precios',
      title: 'Estructura de Costos',
      description: 'Verifica que todo producto (ej. Pan Aliñado, Queso) tenga un Precio de Venta asignado mayor a $0 para poder calcular ganancias.',
      isCompleted: estadisticas.totalProductos > 0 && estadisticas.productosSinPrecio === 0,
      icon: Percent,
      action: 'Revisar Precios',
      view: 'productos'
    }
  ];

  const completedCount = hytos.filter(h => h.isCompleted).length;
  const totalCount = hytos.length;
  const isAllCompleted = completedCount === totalCount;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  if (isDismissed || isAllCompleted) {
    return null; // Ocultamos si ya terminó o si lo cerró (opcional). En este caso, si todo 100%, se oculta.
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-[2.5rem] p-6 sm:p-8 mb-8 border border-white/10 shadow-2xl relative overflow-hidden animate-ag-fade-in">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400">
                Puesta en Marcha
              </span>
              🚀
            </h2>
            <p className="text-sm font-medium text-slate-400 max-w-xl leading-relaxed">
              Faltan algunos datos importantes para que la aplicación funcione en su totalidad. 
              Completa esta lista de información pendiente para desatar todo el potencial del sistema.
            </p>
          </div>
          
          <div className="w-full md:w-auto min-w-[200px] flex flex-col items-end gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              {progressPercent}% Completado
            </span>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hytos.map((hito) => {
            const Icon = hito.icon;
            return (
              <div 
                key={hito.id} 
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden flex flex-col h-full",
                  hito.isCompleted 
                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "bg-white/5 border-white/10 hover:border-indigo-500/40 hover:bg-white/10"
                )}
              >
                {hito.isCompleted && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/20 rounded-bl-full pointer-events-none" />
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "p-2.5 rounded-xl flex items-center justify-center shrink-0",
                    hito.isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {hito.isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <CircleDashed className="w-6 h-6 text-slate-600" />
                  )}
                </div>

                <div className="flex-1">
                  <h3 className={cn(
                    "font-bold text-sm mb-1.5",
                    hito.isCompleted ? "text-emerald-50" : "text-white"
                  )}>
                    {hito.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-4">
                    {hito.description}
                  </p>
                </div>

                {!hito.isCompleted && (
                  <button
                    onClick={() => onNavigateTo(hito.view)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest transition-all group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] mt-auto"
                  >
                    {hito.action}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                
                {hito.isCompleted && (
                  <div className="w-full mt-auto py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Completado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
