import { useState, useRef } from 'react';
import { Send, Brain, Package, Utensils, Megaphone, Calculator, Loader2, ChevronRight, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ── Tipos ────────────────────────────────────────────────────────────────────
type AgenteId = 'gerente' | 'inventario' | 'produccion' | 'marketing' | 'contable';
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
}

// ── Config de agentes ────────────────────────────────────────────────────────
const AGENTES: Record<AgenteId, { nombre: string; emoji: string; color: string; bg: string; icon: typeof Brain }> = {
  gerente:    { nombre: 'Gerente General',    emoji: '🧠', color: 'text-purple-300', bg: 'bg-purple-900/30 border-purple-500/40', icon: Brain },
  inventario: { nombre: 'Agente Inventario',  emoji: '📦', color: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-500/40',   icon: Package },
  produccion: { nombre: 'Agente Producción',  emoji: '🍞', color: 'text-amber-300',  bg: 'bg-amber-900/30 border-amber-500/40', icon: Utensils },
  marketing:  { nombre: 'Agente Marketing',   emoji: '📢', color: 'text-pink-300',   bg: 'bg-pink-900/30 border-pink-500/40',   icon: Megaphone },
  contable:   { nombre: 'Agente Contable',    emoji: '🧮', color: 'text-green-300',  bg: 'bg-green-900/30 border-green-500/40', icon: Calculator },
};

// ── Función para llamar la Edge Function ────────────────────────────────────
async function llamarAgente(tipo: AgenteId, mensaje: string, onChunk: (text: string) => void): Promise<string> {
  const res = await fetch('/api/agente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, mensaje }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(chunk);
  }

  return fullText;
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function AgentesIA() {
  const [comando, setComando] = useState('');
  const [sesiones, setSesiones] = useState<SesionIA[]>([]);
  const [ejecutando, setEjecutando] = useState(false);
  const [textoGerente, setTextoGerente] = useState('');
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
      // 1. Llamar al Gerente para obtener el plan
      let respuestaGerente = '';
      await llamarAgente('gerente', comandoActual, chunk => {
        respuestaGerente += chunk;
        setTextoGerente(respuestaGerente);
      });

      // 2. Parsear el plan del Gerente
      let plan: { saludo: string; analisis: string; plan: { agente: AgenteId; tarea: string }[]; cierre: string };
      try {
        // Limpiar respuesta por si tiene markdown
        const jsonStr = respuestaGerente.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        plan = JSON.parse(jsonStr);
      } catch {
        toast.error('El Gerente no pudo estructurar el plan. Intenta de nuevo.');
        setEjecutando(false);
        return;
      }

      // 3. Crear las tareas en el estado
      const tareasIniciales: TareaAgente[] = plan.plan.map(t => ({
        agente: t.agente,
        tarea: t.tarea,
        estado: 'idle',
      }));

      setSesiones(prev => prev.map(s =>
        s.id === id ? { ...s, analisisGerente: plan.analisis, tareas: tareasIniciales } : s
      ));

      // 4. Ejecutar cada agente especialista en secuencia
      for (let i = 0; i < plan.plan.length; i++) {
        const { agente, tarea } = plan.plan[i];

        // Marcar como working
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
              tareas: s.tareas.map((t, idx) => idx === i ? { ...t, estado: 'error', respuesta: 'Error al contactar al agente.' } : t)
            } : s
          ));
        }
      }

      setSesiones(prev => prev.map(s => s.id === id ? { ...s, completado: true } : s));
      toast.success('Misión completada por el equipo IA');

    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
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
    <div className="min-h-screen bg-[#0a0f1e] text-white p-4 md:p-6 font-mono">

      {/* Header */}
      <div className="mb-6 border border-purple-500/30 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-500/40">
            <Zap className="w-6 h-6 text-purple-300" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest text-purple-100 uppercase">
              Centro de Operaciones IA
            </h1>
            <p className="text-xs text-purple-400 tracking-widest">PANADERÍA DULCE PLACER · SISTEMA MULTI-AGENTE</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">SISTEMA ACTIVO</span>
          </div>
        </div>

        {/* Agentes en el header */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.entries(AGENTES) as [AgenteId, typeof AGENTES.gerente][]).map(([id, cfg]) => (
            <div key={id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${cfg.bg} ${cfg.color}`}>
              <span>{cfg.emoji}</span>
              <span className="font-bold">{cfg.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal de comandos */}
      <div className="mb-6 border border-gray-700 rounded-xl bg-gray-900/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 bg-gray-800/50">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-xs text-green-400 font-bold">DIRECTOR GENERAL → GERENTE IA</span>
        </div>
        <div className="p-4 space-y-3">
          <Textarea
            value={comando}
            onChange={e => setComando(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Escribe tu orden al equipo IA...\n\nEjemplos:\n• "Necesito aumentar las ventas de panzerottis esta semana"\n• "¿Cómo está el inventario para el fin de semana?"\n• "Crea una promoción especial de buñuelos para hoy"\n\n[Ctrl+Enter para enviar]`}
            className="bg-black/40 border-gray-600 text-green-300 placeholder:text-gray-600 text-sm resize-none min-h-[100px] font-mono focus:border-purple-500"
            disabled={ejecutando}
          />
          <Button
            onClick={ejecutarComando}
            disabled={!comando.trim() || ejecutando}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 tracking-wider"
          >
            {ejecutando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> PROCESANDO...</>
            ) : (
              <><Send className="w-4 h-4" /> ENVIAR ORDEN AL EQUIPO</>
            )}
          </Button>
        </div>

        {/* Stream en vivo del Gerente */}
        {textoGerente && (
          <div className="mx-4 mb-4 p-3 rounded-lg border border-purple-500/30 bg-purple-900/10 text-xs text-purple-300 font-mono whitespace-pre-wrap">
            <span className="text-purple-400 font-bold">🧠 GERENTE → </span>
            {textoGerente}
          </div>
        )}
      </div>

      {/* Sesiones */}
      {sesiones.map(sesion => (
        <div key={sesion.id} className="mb-6 border border-gray-700 rounded-xl overflow-hidden">
          {/* Header de sesión */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/60 border-b border-gray-700">
            <ChevronRight className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold text-white flex-1">{sesion.comando}</span>
            <Badge className={sesion.completado
              ? 'bg-green-900/50 text-green-300 border-green-500/40'
              : 'bg-yellow-900/50 text-yellow-300 border-yellow-500/40'
            }>
              {sesion.completado ? '✓ Completado' : '⏳ En proceso'}
            </Badge>
          </div>

          {/* Análisis del Gerente */}
          {sesion.analisisGerente && (
            <div className="px-4 py-3 border-b border-gray-700/50 bg-purple-900/10">
              <p className="text-xs text-purple-400 font-bold mb-1">🧠 ANÁLISIS DEL GERENTE</p>
              <p className="text-sm text-purple-200">{sesion.analisisGerente}</p>
            </div>
          )}

          {/* Tareas de especialistas */}
          <div className="p-4 space-y-3">
            {sesion.tareas.map((tarea, idx) => {
              const cfg = AGENTES[tarea.agente];
              const Icon = cfg.icon;
              return (
                <div key={idx} className={`rounded-lg border p-3 ${cfg.bg}`}>
                  {/* Header tarea */}
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`text-xs font-black uppercase tracking-wider ${cfg.color}`}>
                      {cfg.emoji} {cfg.nombre}
                    </span>
                    <div className="ml-auto">
                      {tarea.estado === 'working' && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Procesando
                        </span>
                      )}
                      {tarea.estado === 'done' && (
                        <span className="text-xs text-green-400">✓ Listo</span>
                      )}
                      {tarea.estado === 'error' && (
                        <span className="text-xs text-red-400">✗ Error</span>
                      )}
                      {tarea.estado === 'idle' && (
                        <span className="text-xs text-gray-500">En espera</span>
                      )}
                    </div>
                  </div>

                  {/* Tarea asignada */}
                  <p className="text-xs text-gray-400 mb-2 border-l-2 border-gray-600 pl-2 italic">
                    Tarea: {tarea.tarea}
                  </p>

                  {/* Respuesta del agente */}
                  {tarea.respuesta && (
                    <div className="mt-2 text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {tarea.respuesta}
                    </div>
                  )}
                </div>
              );
            })}

            {sesion.tareas.length === 0 && !sesion.completado && (
              <div className="text-center py-4 text-gray-600 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                El Gerente está analizando tu orden...
              </div>
            )}
          </div>
        </div>
      ))}

      {sesiones.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Escribe una orden para activar al equipo IA</p>
          <p className="text-xs mt-1 text-gray-700">El Gerente coordinará automáticamente a los especialistas</p>
        </div>
      )}
    </div>
  );
}
