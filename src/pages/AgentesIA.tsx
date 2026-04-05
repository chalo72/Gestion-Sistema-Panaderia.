import { useState, useRef } from 'react';
import { 
  BrainCircuit, ShieldCheck, Settings2, Info, AlertTriangle, 
  CheckCircle2, Loader2, Scale, FileText, Instagram, Shield,
  Terminal, Zap, Rocket, Brain, Package, Utensils, Megaphone,
  Eye, ShieldAlert, History, Camera as CameraIcon, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { 
  AGENTES_CONFIG as AGENTES, consultarAgente as llamarAgente 
} from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { SoberaniaDashboard } from '@/components/SoberaniaDashboard';
import { useCentinela } from '@/components/providers/CentinelaProvider';
import { MCPCameraBridge } from '@/components/agentes/MCPCameraBridge';

type EstadoAgente = 'idle' | 'working' | 'done' | 'error';

interface TareaAgente {
  agente: AgenteId;
  tarea: string;
  respuesta?: string;
  estado: EstadoAgente;
  dato?: string;
}

interface SesionIA {
  id: number;
  comando: string;
  analisisGerente?: string;
  tareas: TareaAgente[];
  completado: boolean;
}

export default function AgentesIA() {
  const [comando, setComando] = useState('');
  const [sesiones, setSesiones] = useState<SesionIA[]>([]);
  const [ejecutando, setEjecutando] = useState(false);
  const [textoGerente, setTextoGerente] = useState('');
  const [agenteEnMando, setAgenteEnMando] = useState<AgenteId | null>(null);
  const { misionesActivas, hallazgos, isVigilando } = useCentinela();
  const [showVigilancia, setShowVigilancia] = useState(false);
  const sesionIdRef = useRef(0);

  const ejecutarComando = async () => {
    if (!comando.trim() || ejecutando) return;

    const id = ++sesionIdRef.current;
    const comandoActual = comando.trim();
    setComando('');
    setEjecutando(true);
    setTextoGerente('');

    const nuevaSesion: SesionIA = { id, comando: comandoActual, tareas: [], completado: false };
    setSesiones(prev => [nuevaSesion, ...prev]);

    try {
      let respuestaGerente = '';
      await llamarAgente('gerente', comandoActual, chunk => {
        respuestaGerente += chunk;
        setTextoGerente(respuestaGerente);
      });

      let plan: { saludo: string; analisis: string; plan: { agente: AgenteId; tarea: string }[]; cierre: string };
      try {
        const jsonStr = respuestaGerente.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        plan = JSON.parse(jsonStr);
      } catch {
        toast.error('Error de comunicación con el Gerente.');
        setEjecutando(false);
        return;
      }

      const tareasIniciales: TareaAgente[] = plan.plan.map(t => ({
        agente: t.agente,
        tarea: t.tarea,
        estado: 'idle',
      }));

      setSesiones(prev => prev.map(s =>
        s.id === id ? { ...s, analisisGerente: plan.analisis, tareas: tareasIniciales } : s
      ));

      for (let i = 0; i < plan.plan.length; i++) {
        const { agente, tarea } = plan.plan[i];

        setSesiones(prev => prev.map(s =>
          s.id === id ? {
            ...s,
            tareas: s.tareas.map((t, idx) => idx === i ? { ...t, estado: 'working' } : t)
          } : s
        ));

        try {
          let respuestaAgente = '';
          await llamarAgente(agente, tarea, chunk => {
            respuestaAgente += chunk;
            setSesiones(prev => prev.map(s =>
              s.id === id ? {
                ...s,
                tareas: s.tareas.map((t, idx) => idx === i ? { ...t, respuesta: respuestaAgente } : t)
              } : s
            ));
          });

          setSesiones(prev => prev.map(s =>
            s.id === id ? {
              ...s,
              tareas: s.tareas.map((t, idx) => idx === i ? { ...t, estado: 'done' } : t)
            } : s
          ));
        } catch {
          setSesiones(prev => prev.map(s =>
            s.id === id ? {
              ...s,
              tareas: s.tareas.map((t, idx) => idx === i ? { ...t, estado: 'error', respuesta: 'Error técnico de enlace.' } : t)
            } : s
          ));
        }
      }

      setSesiones(prev => prev.map(s => s.id === id ? { ...s, completado: true } : s));
      toast.success('Capacidad Estratégica Desplegada');

    } catch (err: any) {
      toast.error(`Fallo en el sistema: ${err.message}`);
    } finally {
      setEjecutando(false);
      setTextoGerente('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      ejecutarComando();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* ── Background Grid ── */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 relative z-10 animate-ag-fade-in">
        
        {/* Banner - Director General Role */}
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <ShieldCheck className="w-48 h-48 text-indigo-500" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 bg-[#DAA520] rounded-full shadow-[0_0_10px_#DAA520]" />
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                   Holding <span className="text-[#DAA520]">Corporativo v10.0</span>
                </h1>
              </div>
              <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                Centro de Inteligencia del Director General · Alianza Dulce Placer
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowVigilancia(!showVigilancia)}
                className={cn(
                  "px-5 py-3 rounded-2xl border transition-all flex items-center gap-3 group",
                  showVigilancia 
                    ? "bg-red-500/20 border-red-500/40 text-red-500" 
                    : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20"
                )}
              >
                <div className="flex flex-col text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Sistema Centinela</p>
                  <span className="text-xs font-black text-white">{isVigilando ? 'VIGILANDO' : 'MODO PASIVO'}</span>
                </div>
                <div className={cn(
                  "p-2 rounded-xl backdrop-blur-md",
                  isVigilando ? "bg-red-500/40 animate-pulse" : "bg-indigo-500/20"
                )}>
                  {showVigilancia ? <Eye className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* ── Dashboard de Vigilancia Centinela (Opcional) ── */}
        {showVigilancia && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-ag-slide-up">
            {/* Cámara del Director */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <CameraIcon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Cámara del Director (MCP Bridge)</span>
              </div>
              <MCPCameraBridge />
            </div>

            {/* Feed de Hallazgos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Hallazgos Tácticos Recientes</span>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 h-[300px] overflow-y-auto space-y-4 custom-scrollbar">
                {hallazgos.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center opacity-30 italic text-xs">
                    No se han detectado anomalías operativas hasta el momento.
                  </div>
                ) : (
                  hallazgos.map(h => (
                    <div key={h.id} className="p-3 bg-white/5 border-l-2 border-indigo-500 rounded-lg hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                          {h.agenteId} · {new Date(h.fecha).toLocaleTimeString()}
                        </span>
                        <Badge variant="outline" className="text-[8px] bg-indigo-500/10 border-indigo-500/20">
                          {h.gravedad}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-white font-bold mb-1 leading-tight">{h.titulo}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-2 italic">{h.descripcion}</p>
                    </div>
                  ))
                )}
              </div>
              
              <div className="bg-[#DAA520]/10 border border-[#DAA520]/20 rounded-2xl p-4">
                <h4 className="text-[9px] font-black text-[#DAA520] uppercase mb-2">Misiones Activas: {misionesActivas.length}</h4>
                <div className="space-y-2">
                  {misionesActivas.slice(0, 2).map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-[10px] text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#DAA520] animate-pulse" />
                      <span className="truncate">{m.misionExplicita}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Spatial Layout (The Command Room) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Dashboard Central (Gerente & Console) */}
          <div className="lg:col-span-12 space-y-10">
            
            {/* The Gerente Hologram */}
            <div className="relative group perspective-1000">
              <div className="absolute -inset-2 bg-gradient-to-b from-[#DAA520]/20 to-transparent rounded-full blur-3xl opacity-30 animate-pulse" />
              <div className={cn(
                "relative bg-slate-900/60 backdrop-blur-3xl border-2 border-[#DAA520]/30 rounded-[3.5rem] p-12 text-center shadow-2xl transition-all duration-700 hover:border-[#DAA520]/60",
                ejecutando ? "scale-[0.98] rotate-x-6" : "scale-100"
              )}>
                <div className="mb-8 inline-flex p-6 rounded-full bg-[#DAA520]/20 border border-[#DAA520]/30 shadow-[0_0_50px_rgba(218,165,32,0.4)] animate-ag-float">
                  <BrainCircuit className="w-20 h-20 text-[#DAA520]" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-widest uppercase mb-1"> NEXUS-VOLT </h2>
                <p className="text-[#DAA520] text-xs font-black uppercase tracking-[0.4em] mb-6 italic">Gran Orquestador de Operaciones</p>
                
                <div className="bg-black/50 rounded-3xl p-6 border border-white/10 inline-flex items-center gap-6 max-w-3xl">
                  <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_#22c55e]" />
                  <p className="text-base text-slate-300 font-bold italic tracking-wide leading-relaxed">
                    {textoGerente || "En espera de nuevas órdenes estratégicas globales del Director..."}
                  </p>
                </div>

                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Button variant="outline" className="rounded-2xl border-red-500/30 text-red-500 hover:bg-red-500/20 font-black text-[10px] uppercase tracking-widest px-8 py-7">
                    Auditoría Legal <Scale className="ml-2 w-4 h-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-sky-500/30 text-sky-500 hover:bg-sky-500/20 font-black text-[10px] uppercase tracking-widest px-8 py-7">
                    Cierre Fiscal <FileText className="ml-2 w-4 h-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-purple-500/30 text-purple-500 hover:bg-purple-500/20 font-black text-[10px] uppercase tracking-widest px-8 py-7">
                    Gestión Influencers <Instagram className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tactical Console */}
            <section className="group relative max-w-5xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#DAA520] to-orange-600 rounded-[2.5rem] opacity-20 blur-xl transition duration-1000 group-hover:opacity-50" />
              <div className="relative bg-[#020617]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="bg-white/5 px-8 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#DAA520]">
                    <Terminal className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Enlace de Mando de Élite</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 font-bold text-[10px] px-3 py-1">
                    CANAL SEGURO ACTIVO
                  </Badge>
                </div>
                
                <div className="p-10 space-y-6">
                  <Textarea
                    value={comando}
                    onChange={e => setComando(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`¿Qué misión desea desplegar hoy, Director?`}
                    className="bg-transparent border-none text-3xl text-white placeholder:text-slate-800 focus-visible:ring-0 resize-none min-h-[100px] font-black p-0 leading-tight"
                    disabled={ejecutando}
                  />
                  <div className="flex items-center justify-between pt-8 border-t border-white/10">
                    <div className="flex gap-3">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-lg animate-ag-pulse">
                          <Rocket className="w-6 h-6" />
                       </div>
                    </div>
                    <Button
                      onClick={ejecutarComando}
                      disabled={!comando.trim() || ejecutando}
                      className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-black font-black px-16 py-8 rounded-[1.5rem] shadow-2xl transition-all hover:scale-[1.03] active:scale-95 gap-4"
                    >
                      {ejecutando ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> PROCESANDO ESTADO...</>
                      ) : (
                        <><Zap className="w-6 h-6 fill-black" /> DESPLEGAR HOLDING TOTAL</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>

        </div>

        {/* ── Status de los Agentes ── */}
        <div className="pt-8">
           <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 text-center">Matriz de Capacidad (20 Especialistas)</h3>
           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-4">
              {Object.keys(AGENTES).map(id => {
                const cfg = AGENTES[id as AgenteId];
                return (
                  <div 
                    key={id} 
                    onClick={() => setAgenteEnMando(id as AgenteId)}
                    className={cn(
                      "p-4 rounded-2xl border bg-slate-900/60 backdrop-blur-xl flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:border-white/20 cursor-pointer group relative overflow-hidden",
                      cfg.bg.split(' ')[1],
                      cfg.shadow
                    )}
                  >
                     <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Shield className="w-3 h-3 text-[#DAA520]" />
                     </div>
                     <cfg.icon className={cn("w-6 h-6 mb-3 group-hover:scale-110 transition-transform", cfg.color)} />
                     <span className="text-[9px] font-black uppercase text-white truncate w-full tracking-tight">{cfg.nombre}</span>
                  </div>
                );
              })}
           </div>
        </div>

        {/* ── Dashboard de Soberanía (Modal) ── */}
        {agenteEnMando && (
          <SoberaniaDashboard 
            agenteId={agenteEnMando} 
            onClose={() => setAgenteEnMando(null)} 
          />
        )}

      </div>
    </div>
  );
}
