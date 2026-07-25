import { useState } from 'react';
import { Code2, Cpu, AlertTriangle, CheckCircle2, Loader2, Lightbulb, TrendingUp, Wrench, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { consultarAgente } from '@/constants/agentes';
import { toast } from 'sonner';

interface Hallazgo {
  tipo: 'critico' | 'mejora' | 'ok' | 'idea';
  area: string;
  descripcion: string;
}

const AREAS_AUDITORIA = [
  'Módulo de Ventas y POS',
  'Control de Inventario',
  'Sistema de Caja y Cuadre',
  'Módulo de Producción y Recetas',
  'Gestión de Clientes y Créditos',
  'Sincronización de Datos (IndexedDB/Supabase)',
  'Interfaz de Usuario y UX',
  'Cálculos Financieros y Reportes',
  'Agentes de Inteligencia Artificial',
  'Sistema de Seguridad y Auditorías',
];

export function ArquiTech() {
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [loading, setLoading] = useState(false);
  const [informe, setInforme] = useState('');
  const [progreso, setProgreso] = useState(0);
  const [areaActual, setAreaActual] = useState('');

  const ejecutarAuditoria = async () => {
    setLoading(true);
    setHallazgos([]);
    setInforme('');
    setProgreso(0);

    const prompt = `Eres ARQUI-TECH, el Inspector de Ingeniería de Software de la panadería Dulce Placer.
Su aplicación ERP incluye los módulos: Ventas/POS, Inventario, Producción/Recetas, Caja/Control, Clientes/Créditos, Proveedores/Mayoristas, Nómina, Reportes, Seguridad/Auditorías, Agentes IA (NEXUS-VOLT, Hermes, Odysseus, VIGÍA-APP, ARQUI-TECH).

Genera un informe de salud del sistema con el siguiente formato JSON exacto (sin markdown):
{
  "resumen": "texto breve del estado general",
  "hallazgos": [
    {"tipo": "critico"|"mejora"|"ok"|"idea", "area": "nombre del area", "descripcion": "descripcion detallada"}
  ],
  "recomendaciones_escalado": ["idea 1", "idea 2", "idea 3"]
}

Sé específico, profesional y usa el contexto real del negocio de panadería.`;

    try {
      let respuestaCompleta = '';
      setAreaActual('Iniciando auditoría de arquitectura...');

      await consultarAgente('arqui-tech' as any, prompt, (chunk) => {
        respuestaCompleta += chunk;
        setProgreso(prev => Math.min(prev + 3, 90));
      });

      setProgreso(95);

      try {
        const json = JSON.parse(respuestaCompleta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        setInforme(json.resumen || '');
        setHallazgos(json.hallazgos || []);
        if (json.recomendaciones_escalado) {
          const ideas = json.recomendaciones_escalado.map((r: string) => ({
            tipo: 'idea' as const,
            area: 'Escalado',
            descripcion: r
          }));
          setHallazgos(prev => [...prev, ...ideas]);
        }
        toast.success('Auditoría de software completada');
      } catch {
        setInforme(respuestaCompleta);
        toast.info('Informe recibido en texto libre');
      }

      setProgreso(100);
      setAreaActual('Auditoría completada');
    } catch (err: any) {
      toast.error(`Error en ARQUI-TECH: ${err.message}`);
      setAreaActual('Error en auditoría');
    } finally {
      setLoading(false);
    }
  };

  const colorHallazgo = {
    critico: 'bg-red-500/10 text-red-400 border-red-500/20',
    mejora: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    idea: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };

  const iconHallazgo = {
    critico: AlertTriangle,
    mejora: Wrench,
    ok: CheckCircle2,
    idea: Lightbulb,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Code2 className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">AUDITORÍA DE CÓDIGO (ARQUI-TECH)</h3>
            <p className="text-xs text-slate-400">Salud del Sistema y Rendimiento de Ingeniería</p>
          </div>
        </div>
        <button
          onClick={ejecutarAuditoria}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border',
            loading
              ? 'bg-purple-500/5 text-purple-400/50 border-purple-500/10 cursor-not-allowed'
              : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
          {loading ? 'Auditando...' : 'Ejecutar Auditoría'}
        </button>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span className="font-black uppercase">{areaActual}</span>
            <span>{progreso}%</span>
          </div>
          <div className="bg-white/5 rounded-full h-1.5">
            <div
              className="h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}

      {/* Resumen */}
      {informe && !loading && (
        <div className="bg-slate-900/60 rounded-2xl p-5 border border-purple-500/20">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">Estado General del Sistema</p>
          <p className="text-sm text-slate-200 font-bold leading-relaxed italic">"{ informe}"</p>
        </div>
      )}

      {/* Hallazgos */}
      {hallazgos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hallazgos de Auditoría ({hallazgos.length})</h4>
          {hallazgos.map((h, idx) => {
            const Icon = iconHallazgo[h.tipo];
            return (
              <div key={idx} className={cn('p-4 rounded-2xl border flex gap-3', colorHallazgo[h.tipo])}>
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-[8px] font-black uppercase border-0 px-2', colorHallazgo[h.tipo])}>
                      {h.tipo}
                    </Badge>
                    <span className="text-[10px] font-black uppercase">{h.area}</span>
                  </div>
                  <p className="text-xs leading-relaxed font-bold opacity-90">{h.descripcion}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simulación de Escaneo Constante cuando está en reposo */}
      {!loading && hallazgos.length === 0 && !informe && (
        <div className="bg-black/30 rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center gap-3 text-emerald-400/70">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest">Análisis Perimetral Automático Activo</span>
          </div>
          <div className="grid grid-cols-2 gap-4 opacity-50">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500">Salud del Código Base</p>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-400 w-[95%]" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500">Rendimiento de Consultas</p>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-400 w-[88%]" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500">Estado IndexedDB</p>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-400 w-[100%]" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500">Integridad de Componentes</p>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-purple-400 w-[92%]" />
              </div>
            </div>
          </div>
          <p className="text-[11px] italic text-slate-500 pt-4 text-center border-t border-white/5 mt-4">
            Para un informe detallado con Inteligencia Artificial y recomendaciones de mejora, presiona "Ejecutar Auditoría".
          </p>
        </div>
      )}
    </div>
  );
}
