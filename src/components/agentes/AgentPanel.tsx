import { useState, useEffect, useCallback } from 'react';
import {
  X, Save, Loader2, ChevronRight, Settings, BookOpen,
  Lock, Shield, Activity, Sliders, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import type { DBAgenteConfig } from '@/lib/database';
import type { AgenteId } from '@/constants/agentes';
import { AGENTES_CONFIG } from '@/constants/agentes';

interface AgentPanelProps {
  agenteId: AgenteId;
  onClose: () => void;
}

const CACHE_KEY = (id: string) => `dp_agent_config_cache_${id}`;

/**
 * Borradores iniciales de directiva/conocimiento para agentes que TODAVÍA no
 * tienen configuración guardada en la base de datos. Son solo un punto de
 * partida editable en el panel — no se aplican de verdad a las respuestas
 * de la IA hasta que el usuario los revisa (y ajusta si quiere) y presiona
 * "Guardar", lo cual los persiste vía db.saveAgenteConfig. Si el agente ya
 * tiene config guardada, esta se ignora por completo (ver useEffect abajo).
 */
const DEFAULTS_POR_AGENTE: Partial<Record<AgenteId, { directivaPrimaria: string; conocimientoInyectado: string }>> = {
  influencer: {
    directivaPrimaria: `Actúa como una estratega de contenido viral para redes sociales de una panadería de barrio. Escribe siempre en español colombiano, cercano y cálido, como si fueras Andrea Cadena hablándole directo a un vecino. El primer segundo (o la primera línea) de cualquier guion o caption debe ser un gancho real — nunca empieces con "Hola a todos" ni presentaciones largas. Cada pieza debe tener un gancho, un motivo para quedarse hasta el final, y un llamado a la acción único y claro. Nunca inventes cifras de ventas, testimonios o reseñas: si falta un dato real, deja un espacio marcado como [DATO REAL PENDIENTE] en vez de inventarlo.`,
    conocimientoInyectado: `PERSONA DULCE PLACER — Ganchos virales para redes (borrador inicial, editable)

Esta guía adapta técnicas de creadores con millones de vistas (ganchos, títulos, ritmo, miniaturas) a la voz y los productos de Dulce Placer. Úsala como base de cada guion, caption o idea que generes.

1) GANCHO (primeros 3 segundos / primera línea)
- Nunca arranques con "Hola" o "Bienvenidos". Arranca con una promesa, una pregunta o una imagen fuerte.
- Ejemplos: "Nadie en Montería hace esto con el pandebono...", "Esto cuesta $X y la gente hace fila por él", "Grabé lo que pasa a las 4am en el horno de Dulce Placer".
- Usa números y cosas concretas (precios, cantidades, horas) en vez de frases genéricas.

2) ESTRUCTURA Y RITMO
- Abre una pregunta o promesa al inicio y ciérrala solo al final, para que la gente se quede viendo.
- Nada de explicaciones largas al comienzo. Eso va al final o a otra pieza.
- Cambia de idea o de plano cada pocos segundos: de la masa, al horno, a la cara de un cliente feliz, al precio.
- Cierra siempre con un motivo real para actuar hoy: "quedan 12 hoy", "solo los martes", "pídelo por WhatsApp antes de las 6pm".

3) TÍTULOS Y TEXTOS DE PORTADA
- Cortos (menos de 60 caracteres), con el gancho al principio.
- Usa contraste o sorpresa, pero la promesa del título se debe cumplir en el contenido — nada de clickbait vacío.

4) IMAGEN DE PORTADA
- Máximo 2-3 elementos: el producto, una cara con expresión clara, y opcionalmente un precio o número grande.
- Alto contraste, buena luz, sin fondos que distraigan del producto.

5) VOZ DE MARCA
- Cercana, de barrio, orgullosa del oficio artesanal. Habla en primera persona del negocio o como Andrea Cadena cuando el formato lo pida.
- Todo ligado a lo local: el barrio, los vecinos, los domicilios, Montería.
- Nunca inventar testimonios, cifras de ventas o reseñas — usar [DATO REAL PENDIENTE] si falta el dato.

6) LLAMADO A LA ACCIÓN
- Uno solo, claro, con urgencia real (no fabricada): pedir por WhatsApp, pasar hoy, comentar, etiquetar a un amigo.

Nota: esto es un borrador inicial — ajústalo con la voz real de Andrea antes de usarlo en piezas públicas.`
  }
};

function loadCached(id: AgenteId): Partial<DBAgenteConfig> {
  try {
    const raw = localStorage.getItem(CACHE_KEY(id));
    if (raw) return JSON.parse(raw);
  } catch {}
  const base = DEFAULTS_POR_AGENTE[id];
  return {
    id,
    directivaPrimaria: base?.directivaPrimaria || '',
    autonomia: 50,
    restricciones: [],
    habilidadesHabilitadas: ['lectura_precios'],
    conocimientoInyectado: base?.conocimientoInyectado || ''
  };
}

type Tab = 'identidad' | 'directiva' | 'conocimiento';

export function AgentPanel({ agenteId, onClose }: AgentPanelProps) {
  const agente = AGENTES_CONFIG[agenteId];
  const [config, setConfig] = useState<Partial<DBAgenteConfig>>(loadCached(agenteId));
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState<Tab>('identidad');
  const [nuevaRestriccion, setNuevaRestriccion] = useState('');

  // Load from DB in background — no blocking spinner
  useEffect(() => {
    setConfig(loadCached(agenteId));
    db.getAgenteConfig(agenteId).then(data => {
      if (data) {
        setConfig(data);
        localStorage.setItem(CACHE_KEY(agenteId), JSON.stringify(data));
      }
    }).catch(() => {});
  }, [agenteId]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const full: DBAgenteConfig = {
        id: agenteId,
        directivaPrimaria: config.directivaPrimaria || '',
        autonomia: config.autonomia ?? 50,
        restricciones: config.restricciones || [],
        habilidadesHabilitadas: config.habilidadesHabilitadas || [],
        conocimientoInyectado: config.conocimientoInyectado || '',
      };
      await db.saveAgenteConfig(full);
      localStorage.setItem(CACHE_KEY(agenteId), JSON.stringify(full));
      toast.success(`✅ ${agente.nombre} actualizado`);
      onClose();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const addRestriccion = () => {
    if (!nuevaRestriccion.trim()) return;
    setConfig(p => ({ ...p, restricciones: [...(p.restricciones || []), nuevaRestriccion.trim()] }));
    setNuevaRestriccion('');
  };

  const removeRestriccion = (idx: number) => {
    setConfig(p => ({ ...p, restricciones: (p.restricciones || []).filter((_, i) => i !== idx) }));
  };

  const autonomiaLabel = (v: number) => {
    if (v < 30) return 'Supervisado';
    if (v < 60) return 'Asistido';
    if (v < 80) return 'Autónomo';
    return 'Elite';
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'identidad', label: 'Perfil', icon: Shield },
    { id: 'directiva', label: 'Directiva', icon: Settings },
    { id: 'conocimiento', label: 'Conocimiento', icon: BookOpen },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in Panel */}
      <div className="relative w-full max-w-md bg-[#0a0f1e] border-l border-white/10 flex flex-col shadow-2xl animate-slide-in-right">

        {/* Panel Header */}
        <div className="shrink-0 px-6 py-4 border-b border-white/10 flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl shrink-0", agente.bg)}>
            <agente.icon className={cn("w-5 h-5", agente.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-white uppercase tracking-tight truncate">
              Panel de Control · {agente.nombre}
            </h2>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">{agente.cargo}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/5 bg-slate-900/50">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2',
                tab === id ? 'border-[#DAA520] text-[#DAA520] bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

          {/* ── TAB: IDENTIDAD ── */}
          {tab === 'identidad' && (
            <div className="space-y-6">
              <div className={cn("p-5 rounded-2xl border text-center", agente.bg)}>
                <div className="text-5xl mb-3">{agente.emoji}</div>
                <h3 className={cn("text-lg font-black uppercase", agente.color)}>{agente.nombre}</h3>
                <p className="text-slate-400 text-xs mt-1">{agente.cargo}</p>
              </div>

              <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/5 space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  Misión Panadería Dulce Placer
                </h4>
                <p className="text-sm text-slate-300 font-bold leading-relaxed">{agente.misionPanaderia}</p>
              </div>

              <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/5 space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5" />
                  Nivel de Autonomía
                </h4>
                <div className="flex items-center gap-4">
                  <Slider
                    min={0} max={100} step={5}
                    value={[config.autonomia ?? 50]}
                    onValueChange={([v]) => setConfig(p => ({ ...p, autonomia: v }))}
                    className="flex-1"
                  />
                  <Badge variant="outline" className={cn("text-[10px] font-black uppercase px-3 whitespace-nowrap", agente.color)}>
                    {autonomiaLabel(config.autonomia ?? 50)} ({config.autonomia ?? 50}%)
                  </Badge>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/5 space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Restricciones Activas
                </h4>
                {(config.restricciones || []).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-xs text-slate-300 font-bold">{r}</span>
                    <button onClick={() => removeRestriccion(i)} className="text-red-500 hover:text-red-400 text-xs font-black px-2">×</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={nuevaRestriccion}
                    onChange={e => setNuevaRestriccion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRestriccion()}
                    placeholder="Nueva restricción..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
                  />
                  <button onClick={addRestriccion} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-black hover:bg-white/20 transition-all">
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: DIRECTIVA ── */}
          {tab === 'directiva' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  La <strong className="text-indigo-400">Directiva Principal</strong> es la instrucción maestra que define el comportamiento y la personalidad de este agente en cada respuesta.
                </p>
              </div>
              <Textarea
                value={config.directivaPrimaria || ''}
                onChange={e => setConfig(p => ({ ...p, directivaPrimaria: e.target.value }))}
                placeholder={`Define la directiva principal de ${agente.nombre}. Ej: "Prioriza siempre la rentabilidad del negocio y sé directo en los análisis..."`}
                className="bg-black/40 border-white/10 text-white placeholder:text-slate-700 resize-none min-h-[220px] text-sm leading-relaxed font-medium rounded-2xl"
              />
            </div>
          )}

          {/* ── TAB: CONOCIMIENTO ── */}
          {tab === 'conocimiento' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <BookOpen className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  El <strong className="text-emerald-400">Conocimiento Inyectado</strong> son datos específicos de tu negocio que este agente usará en cada análisis: precios, proveedores, recetas, clientes VIP, etc.
                </p>
              </div>
              <Textarea
                value={config.conocimientoInyectado || ''}
                onChange={e => setConfig(p => ({ ...p, conocimientoInyectado: e.target.value }))}
                placeholder={`Datos del negocio para ${agente.nombre}. Ej: "Proveedor principal de harina: Molino XYZ, precio $85.000/bulto. Receta especial de pandebono: confidencial..."`}
                className="bg-black/40 border-white/10 text-white placeholder:text-slate-700 resize-none min-h-[280px] text-sm leading-relaxed font-medium rounded-2xl"
              />

              {agente.plantillas && agente.plantillas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plantillas disponibles</p>
                  {agente.plantillas.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setConfig(prev => ({ ...prev, conocimientoInyectado: p }))}
                      className="w-full text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-bold flex items-center gap-2 transition-all border border-white/5"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/10 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-white/10 text-slate-400 hover:text-white rounded-xl h-11">
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-black font-black uppercase tracking-widest rounded-xl h-11"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
