import { useState, useEffect } from 'react';
import { 
  Bell, Check, Info, AlertTriangle, 
  TrendingUp, ShieldCheck, Sparkles
} from 'lucide-react';
import { db } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AGENTES_CONFIG } from '@/constants/agentes';
import type { DBHallazgoAgente } from '@/lib/database';

/**
 * FindingsFeed — muro de hallazgos IA.
 * Engancha IndexedDB real; botones con acción (sin teatro).
 */
export function FindingsFeed() {
  const [hallazgos, setHallazgos] = useState<DBHallazgoAgente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  useEffect(() => {
    cargarHallazgos();
    const interval = setInterval(cargarHallazgos, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarHallazgos = async () => {
    try {
      const data = await db.getAgenteHallazgos();
      const ordenados = [...(data || [])].sort((a, b) => {
        const ta = new Date(a.fecha || a.createdAt || 0).getTime();
        const tb = new Date(b.fecha || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setHallazgos(ordenados.slice(0, 40));
    } catch (error) {
      console.error('Error al cargar hallazgos IA:', error);
    } finally {
      setCargando(false);
    }
  };

  const marcarLeido = async (id: string) => {
    try {
      const actual = hallazgos.find((h) => h.id === id);
      if (!actual) return;
      await db.saveAgenteHallazgo({ ...actual, revisado: true });
      setHallazgos(prev => prev.map(h => h.id === id ? { ...h, revisado: true } : h));
      toast.success('Reporte archivado');
    } catch {
      toast.error('Error al archivar reporte');
    }
  };

  const getGravedadIcon = (gravedad: string) => {
    switch (gravedad) {
      case 'critica': return <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />;
      case 'alta': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'media': return <TrendingUp className="w-5 h-5 text-sky-500" />;
      case 'baja': return <Info className="w-5 h-5 text-indigo-500" />;
      default: return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getGravedadColor = (gravedad: string) => {
    switch (gravedad) {
      case 'critica': return 'border-l-rose-500 bg-rose-500/5 text-rose-700 dark:text-rose-400';
      case 'alta': return 'border-l-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-400';
      case 'media': return 'border-l-sky-500 bg-sky-500/5 text-sky-700 dark:text-sky-400';
      case 'baja': return 'border-l-indigo-500 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400';
      default: return 'border-l-slate-300 bg-slate-50 text-slate-600 dark:text-slate-400';
    }
  };

  const visibles = mostrarHistorial
    ? hallazgos.filter((h) => h.revisado)
    : hallazgos.filter((h) => !h.revisado);

  if (cargando && hallazgos.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Escaneando red de agentes...</p>
      </div>
    );
  }

  if (visibles.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
        <ShieldCheck className="w-12 h-12 text-emerald-500/50" />
        <div className="space-y-1">
          <p className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
            {mostrarHistorial ? 'Sin reportes archivados' : 'Todo bajo vigilancia'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            {mostrarHistorial
              ? 'Los hallazgos que archives aparecerán aquí.'
              : 'Sin anomalías críticas detectadas por PICO-CLAW.'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500"
          onClick={() => setMostrarHistorial((v) => !v)}
        >
          {mostrarHistorial ? 'Ver pendientes' : 'Ver historial archivado'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide">
      {visibles.map((h, i) => {
        const agente = AGENTES_CONFIG[h.agenteId] || { nombre: 'Agente Desconocido', color: 'text-slate-500', icon: Bell };
        const expandido = expandidoId === h.id;
        return (
          <div 
            key={h.id}
            className={cn(
              "p-5 rounded-[2rem] border-2 border-l-8 transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-sm",
              h.revisado ? "opacity-60 bg-transparent border-slate-100 dark:border-slate-800" : getGravedadColor(h.gravedad)
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                  "p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800",
                   !h.revisado && "animate-pulse"
              )}>
                {getGravedadIcon(h.gravedad)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", agente.color)}>
                       {agente.nombre}
                    </Badge>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      {new Date(h.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!h.revisado && (
                    <Button 
                        size="icon" variant="ghost" 
                        onClick={(e) => { e.stopPropagation(); marcarLeido(h.id); }}
                        className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-slate-800"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                    </Button>
                  )}
                </div>
                
                <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase leading-tight mb-2 truncate">
                  {h.titulo}
                </h4>
                
                <p className={cn(
                  "text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed",
                  !expandido && "line-clamp-3"
                )}>
                  {h.descripcion}
                </p>

                <div className="mt-4 flex gap-2 flex-wrap">
                  <Badge
                    className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[9px] font-black hover:bg-indigo-500/20 cursor-pointer"
                    onClick={() => setExpandidoId(expandido ? null : h.id)}
                  >
                    {expandido ? 'OCULTAR DETALLES' : 'VER DETALLES'}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] font-black opacity-40 uppercase">
                    Patrulla: {h.tipo}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      <div className="pt-8 text-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500"
          onClick={() => setMostrarHistorial((v) => !v)}
        >
          {mostrarHistorial ? 'Ver pendientes' : 'Ver historial archivado'}
        </Button>
      </div>
    </div>
  );
}
