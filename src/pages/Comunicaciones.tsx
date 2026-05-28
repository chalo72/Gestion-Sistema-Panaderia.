import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, CheckSquare, Clock, Send, Plus, Trash2,
  Coffee, Brush, ShoppingBag, DollarSign, Users, ChevronDown,
  ChevronUp, AlertCircle, CheckCircle2, LogIn, LogOut, Calendar,
  Megaphone, Star, Flame, X, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Anuncio {
  id: string;
  autorId: string;
  autorNombre: string;
  autorRol: string;
  texto: string;
  urgencia: 'normal' | 'importante' | 'urgente';
  destinatarios: 'todos' | 'vendedoras' | 'panaderos';
  timestamp: string;
}

interface TareaCheck {
  id: string;
  texto: string;
  icono: string;
  roles: UserRole[];
  momento: 'apertura' | 'cierre' | 'todo_el_dia';
}

interface CompletadaKey {
  tareaId: string;
  usuarioId: string;
  fecha: string;
}

interface RegistroAsistencia {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: string;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  fecha: string;
}

// ─── Datos del checklist por rol ─────────────────────────────────────────────

const TAREAS_DEFAULT: TareaCheck[] = [
  // APERTURA — Vendedoras / Auxiliares
  { id: 'v1', texto: 'Prender la cafetera (¡lo primero! se demora calentando)', icono: '☕', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v2', texto: 'Barrer el local completo', icono: '🧹', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v3', texto: 'Trapear el piso', icono: '🪣', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v4', texto: 'Surtir las vitrinas con el pan', icono: '🥖', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v5', texto: 'Abrir caja y contar el dinero inicial', icono: '💰', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v6', texto: 'Organizar sillas y mesas', icono: '🪑', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v7', texto: 'Limpiar mostrador y vitrinas (sin huellas)', icono: '✨', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v8', texto: 'Surtir gaseosas y bebidas en la nevera', icono: '🥤', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },

  // TODO EL DÍA — Vendedoras
  { id: 'v9',  texto: 'Atender a cada cliente con saludo cordial', icono: '👋', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'todo_el_dia' },
  { id: 'v10', texto: 'Registrar TODAS las ventas en el sistema', icono: '📱', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'todo_el_dia' },
  { id: 'v11', texto: 'Reponer pan cuando se esté acabando', icono: '🍞', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'todo_el_dia' },

  // CIERRE — Vendedoras
  { id: 'v12', texto: 'Cuadrar caja y entregar dinero', icono: '💳', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'cierre' },
  { id: 'v13', texto: 'Guardar el pan sobrante correctamente', icono: '📦', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v14', texto: 'Barrer y trapear al cerrar', icono: '🧹', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v15', texto: 'Recoger y organizar las sillas', icono: '🪑', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v16', texto: 'Apagar cafetera y equipos eléctricos', icono: '🔌', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },

  // PANADEROS
  { id: 'p1', texto: 'Encender los hornos (precalentar)', icono: '🔥', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p2', texto: 'Revisar recetas del día y cantidades', icono: '📋', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p3', texto: 'Pesar y preparar los ingredientes', icono: '⚖️', roles: ['PANADERO', 'ADMIN'], momento: 'apertura' },
  { id: 'p4', texto: 'Conteo del pan del día anterior (sobrante)', icono: '🔢', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p5', texto: 'Aseo del área de producción al iniciar', icono: '🧼', roles: ['PANADERO', 'ADMIN'], momento: 'apertura' },
  { id: 'p6', texto: 'Mantener área limpia durante producción', icono: '✅', roles: ['PANADERO', 'ADMIN'], momento: 'todo_el_dia' },
  { id: 'p7', texto: 'Llevar los panes terminados a la vitrina', icono: '🥐', roles: ['PANADERO', 'ADMIN'], momento: 'todo_el_dia' },
  { id: 'p8', texto: 'Apagar hornos y limpiar al cierre', icono: '🧹', roles: ['PANADERO', 'ADMIN'], momento: 'cierre' },
  { id: 'p9', texto: 'Inventario de insumos para el día siguiente', icono: '📦', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'cierre' },
];

// ─── Helpers de persistencia (localStorage) ──────────────────────────────────

const HOY = () => new Date().toISOString().split('T')[0];

const getAnuncios = (): Anuncio[] => {
  try { return JSON.parse(localStorage.getItem('dp_anuncios') || '[]'); } catch { return []; }
};
const saveAnuncios = (a: Anuncio[]) => localStorage.setItem('dp_anuncios', JSON.stringify(a.slice(0, 50)));

const getCompletadas = (): CompletadaKey[] => {
  try { return JSON.parse(localStorage.getItem('dp_checklist_completadas') || '[]'); } catch { return []; }
};
const saveCompletadas = (c: CompletadaKey[]) => localStorage.setItem('dp_checklist_completadas', JSON.stringify(c));

const getAsistencias = (): RegistroAsistencia[] => {
  try { return JSON.parse(localStorage.getItem('dp_asistencias') || '[]'); } catch { return []; }
};
const saveAsistencias = (a: RegistroAsistencia[]) => localStorage.setItem('dp_asistencias', JSON.stringify(a.slice(0, 200)));

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = 'anuncios' | 'checklist' | 'asistencia';
type Momento = 'apertura' | 'todo_el_dia' | 'cierre' | 'todos';

export default function Comunicaciones() {
  const { usuario, usuarios } = useAuth();
  const [tab, setTab] = useState<Tab>('anuncios');

  // ── Anuncios ──
  const [anuncios, setAnuncios] = useState<Anuncio[]>(getAnuncios);
  const [textoAnuncio, setTextoAnuncio] = useState('');
  const [urgencia, setUrgencia] = useState<Anuncio['urgencia']>('normal');
  const [destinatarios, setDestinatarios] = useState<Anuncio['destinatarios']>('todos');

  // ── Checklist ──
  const [completadas, setCompletadas] = useState<CompletadaKey[]>(getCompletadas);
  const [momento, setMomento] = useState<Momento>('apertura');

  // ── Asistencia ──
  const [asistencias, setAsistencias] = useState<RegistroAsistencia[]>(getAsistencias);

  const rol = (usuario?.rol as UserRole) || 'AUXILIAR';
  const esAdmin = rol === 'ADMIN' || rol === 'GERENTE';

  // Refresca checklist al inicio de cada día
  useEffect(() => {
    const hoy = HOY();
    const limpias = completadas.filter(c => c.fecha === hoy);
    if (limpias.length !== completadas.length) {
      setCompletadas(limpias);
      saveCompletadas(limpias);
    }
  }, []);

  // ── Anuncios filtrados por rol ──
  const anunciosFiltrados = useMemo(() => {
    return anuncios.filter(a => {
      if (a.destinatarios === 'todos') return true;
      if (a.destinatarios === 'vendedoras') return ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'].includes(rol);
      if (a.destinatarios === 'panaderos') return ['PANADERO', 'ADMIN', 'GERENTE'].includes(rol);
      return true;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [anuncios, rol]);

  const publicarAnuncio = () => {
    if (!textoAnuncio.trim() || !usuario) return;
    const nuevo: Anuncio = {
      id: Date.now().toString(),
      autorId: usuario.id,
      autorNombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
      autorRol: rol,
      texto: textoAnuncio.trim(),
      urgencia,
      destinatarios,
      timestamp: new Date().toISOString(),
    };
    const updated = [nuevo, ...anuncios];
    setAnuncios(updated);
    saveAnuncios(updated);
    setTextoAnuncio('');
    toast.success('Anuncio publicado al equipo');
  };

  const eliminarAnuncio = (id: string) => {
    const updated = anuncios.filter(a => a.id !== id);
    setAnuncios(updated);
    saveAnuncios(updated);
  };

  // ── Checklist ──
  const tareasDelRol = useMemo(() => {
    return TAREAS_DEFAULT.filter(t => t.roles.includes(rol) && (momento === 'todos' || t.momento === momento));
  }, [rol, momento]);

  const estaCompletada = (tareaId: string) =>
    completadas.some(c => c.tareaId === tareaId && c.usuarioId === usuario?.id && c.fecha === HOY());

  const toggleTarea = (tareaId: string) => {
    if (!usuario) return;
    const hoy = HOY();
    const yaCompletada = estaCompletada(tareaId);
    let updated: CompletadaKey[];
    if (yaCompletada) {
      updated = completadas.filter(c => !(c.tareaId === tareaId && c.usuarioId === usuario.id && c.fecha === hoy));
    } else {
      updated = [...completadas, { tareaId, usuarioId: usuario.id, fecha: hoy }];
      toast.success('¡Tarea completada!', { duration: 1500 });
    }
    setCompletadas(updated);
    saveCompletadas(updated);
  };

  const progreso = tareasDelRol.length > 0
    ? Math.round((tareasDelRol.filter(t => estaCompletada(t.id)).length / tareasDelRol.length) * 100)
    : 0;

  // ── Asistencia ──
  const miUltimoRegistroHoy = useMemo(() => {
    const hoy = HOY();
    return asistencias.filter(a => a.usuarioId === usuario?.id && a.fecha === hoy).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  }, [asistencias, usuario]);

  const registrarAsistencia = (tipo: 'entrada' | 'salida') => {
    if (!usuario) return;
    const nuevo: RegistroAsistencia = {
      id: Date.now().toString(),
      usuarioId: usuario.id,
      usuarioNombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
      usuarioRol: rol,
      tipo,
      timestamp: new Date().toISOString(),
      fecha: HOY(),
    };
    const updated = [nuevo, ...asistencias];
    setAsistencias(updated);
    saveAsistencias(updated);
    toast.success(tipo === 'entrada' ? '✅ Llegada registrada' : '👋 Salida registrada');
  };

  const asistenciasHoy = useMemo(() => {
    const hoy = HOY();
    return asistencias.filter(a => a.fecha === hoy).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [asistencias]);

  const fmtHora = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); } catch { return '--:--'; }
  };
  const fmtFecha = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
  };

  const urgenciaConfig = {
    normal:     { label: 'Normal',     color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-400' },
    importante: { label: 'Importante', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',  dot: 'bg-amber-500' },
    urgente:    { label: 'Urgente',    color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',      dot: 'bg-rose-500 animate-pulse' },
  };

  const momentoLabels: Record<Momento, string> = {
    apertura: '🌅 Apertura', todo_el_dia: '☀️ Turno', cierre: '🌙 Cierre', todos: '📋 Todos'
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Equipo Dulce Placer</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            {usuario?.nombre} · {rol}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {([
          { id: 'anuncios',   label: 'Anuncios',  icon: Megaphone },
          { id: 'checklist',  label: 'Mi Lista',   icon: CheckSquare },
          { id: 'asistencia', label: 'Asistencia', icon: Clock },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              tab === id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'anuncios' && anunciosFiltrados.filter(a => a.urgencia === 'urgente').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
            {id === 'checklist' && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-black",
                progreso === 100 ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {progreso}%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ═══════ TAB: ANUNCIOS ═══════ */}
        {tab === 'anuncios' && (
          <>
            {/* Formulario solo para admin/gerente */}
            {esAdmin && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" /> Nuevo anuncio al equipo
                </p>
                <Textarea
                  placeholder="Escribe la instrucción o aviso para el equipo..."
                  value={textoAnuncio}
                  onChange={e => setTextoAnuncio(e.target.value)}
                  className="min-h-[80px] text-sm resize-none rounded-xl border-slate-200 dark:border-slate-700"
                />
                <div className="flex flex-wrap gap-2">
                  {/* Urgencia */}
                  {(['normal', 'importante', 'urgente'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setUrgencia(u)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all",
                        urgencia === u ? urgenciaConfig[u].color + ' border-current' : 'border-slate-200 dark:border-slate-700 text-slate-400'
                      )}
                    >
                      <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", urgenciaConfig[u].dot)} />
                      {urgenciaConfig[u].label}
                    </button>
                  ))}
                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center" />
                  {/* Destinatarios */}
                  {(['todos', 'vendedoras', 'panaderos'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDestinatarios(d)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all",
                        destinatarios === d
                          ? "bg-indigo-600 text-white border-indigo-700"
                          : "border-slate-200 dark:border-slate-700 text-slate-400"
                      )}
                    >
                      {d === 'todos' ? '👥 Todos' : d === 'vendedoras' ? '💰 Vendedoras' : '🥖 Panaderos'}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={publicarAnuncio}
                  disabled={!textoAnuncio.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl h-10 gap-2"
                >
                  <Send className="w-4 h-4" /> Publicar anuncio
                </Button>
              </div>
            )}

            {/* Lista de anuncios */}
            {anunciosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Megaphone className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-bold">No hay anuncios todavía</p>
                {esAdmin && <p className="text-xs mt-1">Sé el primero en publicar una instrucción</p>}
              </div>
            ) : (
              anunciosFiltrados.map(anuncio => {
                const cfg = urgenciaConfig[anuncio.urgencia];
                return (
                  <div
                    key={anuncio.id}
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-2xl border-l-4 p-4 shadow-sm",
                      anuncio.urgencia === 'urgente' ? 'border-rose-500' :
                      anuncio.urgencia === 'importante' ? 'border-amber-500' : 'border-slate-300 dark:border-slate-700'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">
                          {anuncio.texto}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full border", cfg.color)}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", cfg.dot)} />
                            {cfg.label}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            Para: {anuncio.destinatarios === 'todos' ? 'Todo el equipo' : anuncio.destinatarios === 'vendedoras' ? 'Vendedoras' : 'Panaderos'}
                          </span>
                        </div>
                      </div>
                      {esAdmin && (
                        <button
                          onClick={() => eliminarAnuncio(anuncio.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 mt-0.5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{anuncio.autorNombre}</span>
                      <span className="text-[9px] text-slate-400">·</span>
                      <span className="text-[9px] text-slate-400">
                        {fmtFecha(anuncio.timestamp)} {fmtHora(anuncio.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ═══════ TAB: CHECKLIST ═══════ */}
        {tab === 'checklist' && (
          <>
            {/* Barra de progreso */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-widest">
                  Progreso del turno
                </p>
                <span className={cn("text-lg font-black tabular-nums", progreso === 100 ? 'text-emerald-600' : 'text-indigo-600')}>
                  {progreso}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", progreso === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                  style={{ width: `${progreso}%` }}
                />
              </div>
              {progreso === 100 && (
                <p className="text-xs font-black text-emerald-600 mt-2 text-center animate-ag-fade-in">
                  ✅ ¡Todas las tareas completadas! Excelente trabajo.
                </p>
              )}
            </div>

            {/* Selector de momento */}
            <div className="flex gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              {(['apertura', 'todo_el_dia', 'cierre', 'todos'] as Momento[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMomento(m)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all text-center",
                    momento === m
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {momentoLabels[m].split(' ')[0]}
                  <span className="hidden sm:inline"> {momentoLabels[m].split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>

            {/* Tareas */}
            {tareasDelRol.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">No hay tareas para este momento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tareasDelRol.map((tarea, idx) => {
                  const done = estaCompletada(tarea.id);
                  return (
                    <button
                      key={tarea.id}
                      onClick={() => toggleTarea(tarea.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98]",
                        done
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-300"
                      )}
                    >
                      <span className="text-2xl shrink-0">{tarea.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-bold leading-snug",
                          done ? "line-through text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-white"
                        )}>
                          {tarea.texto}
                        </p>
                        {tarea.id === 'v1' && !done && (
                          <p className="text-[10px] text-amber-600 font-black mt-0.5 animate-pulse">
                            ⚠️ ¡Prender primero que todo!
                          </p>
                        )}
                      </div>
                      <div className={cn(
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        done ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-slate-600"
                      )}>
                        {done && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════ TAB: ASISTENCIA ═══════ */}
        {tab === 'asistencia' && (
          <>
            {/* Botones de registro */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                Mi registro de hoy
              </p>

              {miUltimoRegistroHoy && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-xl mb-4 text-xs font-black",
                  miUltimoRegistroHoy.tipo === 'entrada'
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                )}>
                  {miUltimoRegistroHoy.tipo === 'entrada' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  Último registro: {miUltimoRegistroHoy.tipo === 'entrada' ? 'Llegada' : 'Salida'} a las {fmtHora(miUltimoRegistroHoy.timestamp)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => registrarAsistencia('entrada')}
                  className="flex flex-col items-center gap-2 p-5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl transition-all shadow-lg shadow-emerald-600/20"
                >
                  <LogIn className="w-8 h-8" />
                  <span className="font-black text-sm uppercase">Llegué</span>
                  <span className="text-[10px] opacity-70">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                <button
                  onClick={() => registrarAsistencia('salida')}
                  className="flex flex-col items-center gap-2 p-5 bg-slate-600 hover:bg-slate-700 active:scale-95 text-white rounded-2xl transition-all shadow-lg shadow-slate-600/20"
                >
                  <LogOut className="w-8 h-8" />
                  <span className="font-black text-sm uppercase">Me voy</span>
                  <span className="text-[10px] opacity-70">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              </div>
            </div>

            {/* Panel de admin: asistencias de hoy */}
            {esAdmin && asistenciasHoy.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Asistencia hoy — {asistenciasHoy.length} registros</span>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {asistenciasHoy.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        a.tipo === 'entrada' ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-100 dark:bg-slate-800"
                      )}>
                        {a.tipo === 'entrada'
                          ? <LogIn className="w-4 h-4 text-emerald-600" />
                          : <LogOut className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-white truncate">{a.usuarioNombre}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{a.usuarioRol}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-xs font-black", a.tipo === 'entrada' ? 'text-emerald-600' : 'text-slate-500')}>
                          {a.tipo === 'entrada' ? 'Llegó' : 'Salió'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold tabular-nums">{fmtHora(a.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mi historial de hoy */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mi historial de hoy</p>
              </div>
              {asistenciasHoy.filter(a => a.usuarioId === usuario?.id).length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-xs font-bold">Sin registros hoy</div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {asistenciasHoy.filter(a => a.usuarioId === usuario?.id).map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-lg">{a.tipo === 'entrada' ? '✅' : '👋'}</span>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-1">
                        {a.tipo === 'entrada' ? 'Registré llegada' : 'Registré salida'}
                      </p>
                      <span className="text-xs font-black text-slate-400 tabular-nums">{fmtHora(a.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
