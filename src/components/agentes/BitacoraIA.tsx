import { Clock, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENTES_CONFIG } from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type EstadoAgente = 'idle' | 'working' | 'done' | 'error';

interface TareaAgente {
  agente: AgenteId;
  tarea: string;
  respuesta?: string;
  estado: EstadoAgente;
}

interface SesionIA {
  id: number;
  comando: string;
  analisisGerente?: string;
  tareas: TareaAgente[];
  completado: boolean;
  timestamp: Date;
}

interface BitacoraIAProps {
  sesiones: SesionIA[];
}

export function BitacoraIA({ sesiones }: BitacoraIAProps) {
  // Mostramos las sesiones que tengan tareas, o que aún estén procesándose (NEXUS-VOLT analizando)
  const sesionesRelevantes = sesiones.filter(s => !s.completado || (s.tareas && s.tareas.length > 0)).reverse();

  if (sesionesRelevantes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
        <Clock className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-medium">La bitácora está limpia.</p>
        <p className="text-xs mt-1">Los agentes registrarán aquí sus operaciones.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Línea de Tiempo Operativa</h3>
        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">En Vivo</span>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
        {sesionesRelevantes.map(sesion => (
          <SesionCard key={sesion.id} sesion={sesion} />
        ))}
      </div>
    </div>
  );
}

function SesionCard({ sesion }: { sesion: SesionIA }) {
  const timeStr = new Date(sesion.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="relative flex items-center justify-between group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#020617] bg-slate-800 text-slate-400 shrink-0 shadow-xl z-10">
        {sesion.completado ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Loader2 className="w-4 h-4 animate-spin text-[#DAA520]" />}
      </div>
      <div className="w-[calc(100%-4rem)] p-4 rounded-2xl border border-white/5 bg-slate-900/50 hover:bg-slate-900/80 transition-all shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 bg-black/50 px-2 py-0.5 rounded-md">{timeStr}</span>
            <span className="text-xs font-semibold text-white line-clamp-1">{sesion.comando}</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
        
        {expanded && (
          <div className="space-y-3 mt-3 pt-3 border-t border-white/5">
            {sesion.tareas.map((tarea, idx) => (
              <TareaItem key={idx} tarea={tarea} />
            ))}
            {!sesion.completado && sesion.tareas.length === 0 && (
              <div className="text-[11px] text-slate-400 flex items-center gap-2 p-2 bg-black/20 rounded-lg border border-white/5">
                <Loader2 className="w-3 h-3 animate-spin text-[#DAA520]" />
                <span className="italic">NEXUS-VOLT analizando parámetros...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TareaItem({ tarea }: { tarea: TareaAgente }) {
  const cfg = AGENTES_CONFIG[tarea.agente];
  if (!cfg) return null;

  return (
    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", cfg.bg)}>
          <cfg.icon className={cn("w-3.5 h-3.5", cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">{cfg.nombre}</p>
            <StatusBadge estado={tarea.estado} />
          </div>
          <p className="text-xs text-slate-400 mb-2">{tarea.tarea}</p>
          
          {tarea.respuesta && (
            <div className="mt-2 bg-slate-950/50 rounded-lg p-3 text-xs text-slate-300 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar prose prose-invert prose-p:leading-snug prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tarea.respuesta}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ estado }: { estado: EstadoAgente }) {
  if (estado === 'working') return <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded"><Loader2 className="w-3 h-3 animate-spin" /> Procesando</span>;
  if (estado === 'done') return <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase bg-emerald-400/10 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3" /> Hecho</span>;
  if (estado === 'error') return <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase bg-red-400/10 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" /> Error</span>;
  return <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase bg-slate-500/10 px-1.5 py-0.5 rounded">En espera</span>;
}
