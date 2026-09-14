import { useState, useEffect, useRef } from 'react';
import { Activity, BarChart3, Clock, Eye, TrendingUp, Zap, MapPin, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getLogsActividad, registrarLogActividad } from '@/lib/security-agent';

interface ModuloStats {
  nombre: string;
  visitas: number;
  ultimaVisita: string;
  color: string;
  ruta: string;
}

const MODULOS_APP: ModuloStats[] = [
  { nombre: 'Ventas', ruta: '/ventas', visitas: 0, ultimaVisita: '', color: 'text-emerald-400' },
  { nombre: 'Inventario', ruta: '/inventario', visitas: 0, ultimaVisita: '', color: 'text-blue-400' },
  { nombre: 'Producción', ruta: '/produccion', visitas: 0, ultimaVisita: '', color: 'text-orange-400' },
  { nombre: 'Caja', ruta: '/caja', visitas: 0, ultimaVisita: '', color: 'text-yellow-400' },
  { nombre: 'Clientes', ruta: '/clientes', visitas: 0, ultimaVisita: '', color: 'text-pink-400' },
  { nombre: 'Proveedores', ruta: '/proveedores', visitas: 0, ultimaVisita: '', color: 'text-purple-400' },
  { nombre: 'Nómina', ruta: '/nomina', visitas: 0, ultimaVisita: '', color: 'text-cyan-400' },
  { nombre: 'Reportes', ruta: '/reportes', visitas: 0, ultimaVisita: '', color: 'text-indigo-400' },
  { nombre: 'Agentes IA', ruta: '/agentes-ia', visitas: 0, ultimaVisita: '', color: 'text-[#DAA520]' },
  { nombre: 'Mayoristas', ruta: '/mayoristas', visitas: 0, ultimaVisita: '', color: 'text-red-400' },
];

const STORAGE_KEY = 'dp_vigia_stats';

function getStats(): ModuloStats[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MODULOS_APP;
    const saved = JSON.parse(raw);
    return MODULOS_APP.map(m => ({
      ...m,
      ...saved[m.ruta]
    }));
  } catch { return MODULOS_APP; }
}

export function registrarVisitaModulo(ruta: string, nombre: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const prev = saved[ruta] || { visitas: 0 };
    saved[ruta] = { visitas: prev.visitas + 1, ultimaVisita: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    registrarLogActividad('vigia-app', `VIGÍA-APP`, nombre, `visita_modulo`, `Módulo ${nombre} visitado`);
  } catch {}
}

interface VigiAppProps {
  compact?: boolean;
}

export function VigiApp({ compact = false }: VigiAppProps) {
  const [stats, setStats] = useState<ModuloStats[]>(getStats());
  const [totalEventos, setTotalEventos] = useState(0);
  const [analisis, setAnalisis] = useState<string>('');
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStats = () => {
    const s = getStats();
    setStats(s);
    const logs = getLogsActividad();
    setTotalEventos(logs.length);
  };

  useEffect(() => {
    refreshStats();
    intervalRef.current = setInterval(refreshStats, 15000);
    // Autogenerar análisis inicial si no lo hay
    generarAnalisis();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const generarAnalisis = async () => {
    setLoadingAnalisis(true);
    const topModulos = [...stats].sort((a, b) => b.visitas - a.visitas).slice(0, 3);
    const sinUso = stats.filter(s => s.visitas === 0);
    const resumen = `Módulos más visitados: ${topModulos.map(m => m.nombre).join(', ')}. Módulos sin uso detectado: ${sinUso.map(m => m.nombre).join(', ') || 'ninguno'}. Total eventos registrados: ${totalEventos}.`;
    setAnalisis(resumen);
    setLoadingAnalisis(false);
  };

  const modulosOrdenados = [...stats].sort((a, b) => b.visitas - a.visitas);
  const maxVisitas = Math.max(...stats.map(s => s.visitas), 1);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest">
          <Eye className="w-3 h-3 text-indigo-400" />
          <span>Actividad de Módulos</span>
          <span className="ml-auto text-indigo-400">{totalEventos} eventos</span>
        </div>
        <div className="space-y-2">
          {modulosOrdenados.slice(0, 5).map(m => (
            <div key={m.ruta} className="flex items-center gap-2">
              <span className={cn('text-[10px] font-black w-20 shrink-0 truncate', m.color)}>{m.nombre}</span>
              <div className="flex-1 bg-white/5 rounded-full h-1.5">
                <div
                  className={cn('h-1.5 rounded-full transition-all', m.color.replace('text-', 'bg-'))}
                  style={{ width: `${Math.round((m.visitas / maxVisitas) * 100)}%`, opacity: m.visitas > 0 ? 1 : 0.2 }}
                />
              </div>
              <span className="text-[9px] text-slate-500 w-6 text-right shrink-0">{m.visitas}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Eye className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">MAPA TÉRMICO Y MONITOREO</h3>
            <p className="text-xs text-slate-400">Actividad en vivo de todos los módulos del sistema</p>
          </div>
        </div>
        <button
          onClick={refreshStats}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-black text-indigo-400">{totalEventos}</p>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Eventos totales</p>
        </div>
        <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-black text-emerald-400">{stats.filter(s => s.visitas > 0).length}</p>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Módulos activos</p>
        </div>
        <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-black text-red-400">{stats.filter(s => s.visitas === 0).length}</p>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sin actividad</p>
        </div>
      </div>

      {/* Mapa de Calor de Módulos */}
      <div className="bg-slate-900/60 rounded-2xl p-6 border border-white/5">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          Mapa de Calor · Uso por Módulo
        </h4>
        <div className="space-y-3">
          {modulosOrdenados.map(m => (
            <div key={m.ruta} className="flex items-center gap-3">
              <MapPin className={cn('w-3 h-3 shrink-0', m.color)} />
              <span className={cn('text-[10px] font-black w-24 shrink-0', m.color)}>{m.nombre}</span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all duration-700', m.color.replace('text-', 'bg-'))}
                  style={{ width: `${Math.round((m.visitas / maxVisitas) * 100)}%`, opacity: m.visitas > 0 ? 1 : 0.15 }}
                />
              </div>
              <Badge variant="outline" className={cn('text-[8px] font-black border-0 px-2', m.color)}>
                {m.visitas} visitas
              </Badge>
              {m.ultimaVisita && (
                <span className="text-[8px] text-slate-600 shrink-0">
                  {new Date(m.ultimaVisita).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Análisis IA */}
      <div className="bg-slate-900/60 rounded-2xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#DAA520]" />
            Análisis de Comportamiento
          </h4>
          <button
            onClick={generarAnalisis}
            disabled={loadingAnalisis}
            className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
          >
            {loadingAnalisis ? 'Analizando...' : 'Generar Análisis'}
          </button>
        </div>
        {analisis ? (
          <p className="text-sm text-slate-300 font-bold italic leading-relaxed">{analisis}</p>
        ) : (
          <p className="text-xs text-slate-600 italic">Presiona "Generar Análisis" para que VIGÍA-APP evalúe los patrones de uso y genere recomendaciones.</p>
        )}
      </div>
    </div>
  );
}
