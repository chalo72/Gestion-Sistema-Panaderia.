import { Clock, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENTES_CONFIG } from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db } from '@/lib/database';

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

interface EntradaPatrulla {
  id: string;
  agenteId: string;
  accion: string;
  detalle: string;
  nivel: string;
  createdAt: string;
}

interface BitacoraIAProps {
  sesiones: SesionIA[];
}

function esEntradaPatrulla(raw: unknown): raw is EntradaPatrulla {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.accion === 'string';
}

export function BitacoraIA({ sesiones }: BitacoraIAProps) {
  const [patrulla, setPatrulla] = useState<EntradaPatrulla[]>([]);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const rows = await db.getBitacoraIA();
        if (!vivo) return;
        const list = (Array.isArray(rows) ? rows : [])
          .filter(esEntradaPatrulla)
          .slice(0, 30);
        setPatrulla(list);
      } catch {
        /* IndexedDB puede fallar offline breve */
      }
    };
    void cargar();
    const t = setInterval(cargar, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  // Mostramos las sesiones que tengan tareas, o que aún estén procesándose (NEXUS-VOLT analizando)
  const sesionesRelevantes = sesiones.filter(s => !s.completado || (s.tareas && s.tareas.length > 0)).reverse();

  if (sesionesRelevantes.length === 0 && patrulla.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
        <Clock className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-medium">La bitácora está limpia.</p>
        <p className="text-xs mt-1">Chat y patrulla automática aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      {patrulla.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Patrulla automática
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              {patrulla.length}
            </span>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
            {patrulla.map((e) => {
              const cfg = AGENTES_CONFIG[e.agenteId as AgenteId];
              const timeStr = e.createdAt
                ? new Date(e.createdAt).toLocaleString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
              return (
                <div
                  key={e.id}
                  className="p-3 rounded-xl border border-white/5 bg-slate-900/50 text-left"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase text-slate-300">
                      {cfg?.nombre || e.agenteId || 'Agente'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold">{timeStr}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-200">{e.accion}</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-3">{e.detalle}</p>
                  {e.nivel && e.nivel !== 'info' && (
                    <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest text-amber-400">
                      {e.nivel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sesionesRelevantes.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Chat · Línea de tiempo</h3>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">En Vivo</span>
          </div>

          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            {sesionesRelevantes.map(sesion => (
              <SesionCard key={sesion.id} sesion={sesion} />
            ))}
          </div>
        </section>
      )}
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
  if (estado === 'working') return <Loader2 className="w-3 h-3 animate-spin text-[#DAA520]" />;
  if (estado === 'done') return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
  if (estado === 'error') return <AlertTriangle className="w-3 h-3 text-rose-400" />;
  return <Clock className="w-3 h-3 text-slate-500" />;
}
