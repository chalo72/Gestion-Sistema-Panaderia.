import { useState, useEffect } from 'react';
import { 
  Shield, Brain, Zap, Lock, BookOpen, Save, X, 
  Settings2, Info, CheckCircle2, Loader2 
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

interface SoberaniaDashboardProps {
  agenteId: AgenteId;
  onClose: () => void;
}

export function SoberaniaDashboard({ agenteId, onClose }: SoberaniaDashboardProps) {
  const [config, setConfig] = useState<Partial<DBAgenteConfig>>({
    id: agenteId,
    directivaPrimaria: '',
    autonomia: 50,
    restricciones: [],
    habilidadesHabilitadas: ['lectura_precios'],
    conocimientoInyectado: ''
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [nuevaRestriccion, setNuevaRestriccion] = useState('');

  const agente = AGENTES_CONFIG[agenteId];

  useEffect(() => {
    cargarConfig();
  }, [agenteId]);

  const cargarConfig = async () => {
    try {
      const data = await db.getAgenteConfig(agenteId);
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error al cargar soberanía:', error);
    } finally {
      setCargando(false);
    }
  };

  const guardarConfig = async () => {
    setGuardando(true);
    try {
      const fullConfig: DBAgenteConfig = {
        id: agenteId,
        directivaPrimaria: config.directivaPrimaria || '',
        autonomia: config.autonomia || 50,
        restricciones: config.restricciones || [],
        habilidadesHabilitadas: config.habilidadesHabilitadas || [],
        conocimientoInyectado: config.conocimientoInyectado || '',
        ultimaActualizacion: new Date().toISOString()
      };
      await db.saveAgenteConfig(fullConfig);
      toast.success(`Soberanía actualizada para ${agente.nombre}`);
      onClose();
    } catch (error) {
      toast.error('Error al guardar la soberanía');
    } finally {
      setGuardando(false);
    }
  };

  const agregarRestriccion = () => {
    if (!nuevaRestriccion.trim()) return;
    setConfig(prev => ({
      ...prev,
      restricciones: [...(prev.restricciones || []), nuevaRestriccion.trim()]
    }));
    setNuevaRestriccion('');
  };

  const eliminarRestriccion = (index: number) => {
    setConfig(prev => ({
      ...prev,
      restricciones: prev.restricciones?.filter((_, i) => i !== index)
    }));
  };

  const toggleHabilidad = (hab: string) => {
    setConfig(prev => {
      const habs = prev.habilidadesHabilitadas || [];
      return {
        ...prev,
        habilidadesHabilitadas: habs.includes(hab) 
          ? habs.filter(h => h !== hab) 
          : [...habs, hab]
      };
    });
  };

  if (cargando) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-950 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col">
        
        {/* Header Táctico */}
        <div className={cn("p-8 border-b border-white/10 flex items-center justify-between", agente.bg)}>
          <div className="flex items-center gap-5">
            <div className={cn("p-4 rounded-2xl bg-black/40 border border-white/10", agente.shadow)}>
              <agente.icon className={cn("w-10 h-10", agente.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#DAA520]" />
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                  Mando de Soberanía: <span className={agente.color}>{agente.nombre}</span>
                </h2>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                Ajuste de Directivas Primarias y Cámara de Conocimiento
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="rounded-full w-12 h-12 p-0 hover:bg-white/10 text-white/50">
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar text-white">
          
          {/* Cámara de Conocimiento */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">Cámara de Conocimiento</h3>
              <Badge variant="outline" className="bg-indigo-500/5 text-indigo-400 border-indigo-500/20">INYECCIÓN DE DATOS</Badge>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
              Aquí puede "entrenar" al agente inyectando manuales, reglas de negocio o datos específicos de su panadería que desee que use como base de verdad absoluta.
            </p>
            <Textarea 
              value={config.conocimientoInyectado}
              onChange={e => setConfig(prev => ({ ...prev, conocimientoInyectado: e.target.value }))}
              placeholder="Ej: El pan de la casa siempre lleva 500g de harina de fuerza y se hornea a 180°C. Nuestra meta de ventas semanal es $5.000.000..."
              className="min-h-[200px] bg-slate-900/50 border-white/10 text-white rounded-2xl focus:border-indigo-500/50 transition-all text-sm leading-relaxed placeholder:text-slate-700"
            />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Directiva Primaria */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Directiva Primaria</h3>
              </div>
              <Textarea 
                value={config.directivaPrimaria}
                onChange={e => setConfig(prev => ({ ...prev, directivaPrimaria: e.target.value }))}
                placeholder="La orden suprema que el agente nunca debe ignorar..."
                className="min-h-[120px] bg-slate-900/50 border-white/10 text-white rounded-2xl focus:border-amber-500/50 transition-all text-sm"
              />
            </section>

            {/* Nivel de Autonomía */}
            <section className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Settings2 className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider">Autonomía Tactica</h3>
                </div>
                <span className="text-2xl font-black text-green-400">{config.autonomia}%</span>
              </div>
              <div className="px-2">
                <Slider 
                  value={[config.autonomia || 50]} 
                  onValueChange={([v]) => setConfig(prev => ({ ...prev, autonomia: v }))}
                  max={100}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mt-2 text-slate-500">
                  <span>Obediencia Ciega</span>
                  <span>Libertad Estratégica</span>
                </div>
              </div>
            </section>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Habilidades Tácticas */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <Brain className="w-5 h-5 text-sky-400" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Habilidades</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'lectura_precios', label: 'Consultar Catálogo Precios', desc: 'Acceso total a la base de costos' },
                  { id: 'analisis_merma', label: 'Analizar Mermas', desc: 'Capacidad de sugerir ahorros' },
                  { id: 'gen_reportes', label: 'Generar Reportes PDF', desc: 'Permiso para crear documentos' }
                ].map(hab => (
                  <div 
                    key={hab.id}
                    onClick={() => toggleHabilidad(hab.id)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group",
                      config.habilidadesHabilitadas?.includes(hab.id) 
                        ? "bg-sky-500/10 border-sky-500/30" 
                        : "bg-slate-900/30 border-white/5 hover:border-white/20"
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{hab.label}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tight">{hab.desc}</p>
                    </div>
                    {config.habilidadesHabilitadas?.includes(hab.id) ? (
                      <CheckCircle2 className="w-5 h-5 text-sky-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-white/10 group-hover:border-white/30" />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Restricciones Absolutas */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Lock className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Muro de Restricciones</h3>
              </div>
              <div className="flex gap-2">
                <Textarea 
                  value={nuevaRestriccion}
                  onChange={e => setNuevaRestriccion(e.target.value)}
                  placeholder="Ej: No hablar de despidos..."
                  className="min-h-[40px] bg-slate-900/50 border-white/10 text-white rounded-xl text-xs py-2"
                />
                <Button onClick={agregarRestriccion} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 h-auto px-4">
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.restricciones?.map((res, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className="bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1 flex items-center gap-2 group cursor-pointer hover:bg-red-500/20"
                    onClick={() => eliminarRestriccion(i)}
                  >
                    {res} <X className="w-3 h-3 text-red-500/50" />
                  </Badge>
                ))}
              </div>
            </section>

          </div>

        </div>

        {/* Footer con Botón de Guardado */}
        <div className="p-8 border-t border-white/10 bg-black/40 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 text-slate-500">
            <Info className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Los cambios se aplican inmediatamente al motor de IA</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">Cancelar</Button>
            <Button 
              onClick={guardarConfig}
              disabled={guardando}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black px-10 py-6 rounded-2xl shadow-xl transition-all hover:scale-[1.03] active:scale-95 gap-3"
            >
              {guardando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> SINCRONIZANDO...</>
              ) : (
                <><Save className="w-4 h-4 shadow-lg text-white" /> ESTABLECER SOBERANÍA</>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
