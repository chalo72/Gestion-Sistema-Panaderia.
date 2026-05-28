import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, Bell, Settings, CheckCircle2, Eye, Trash2, RefreshCw, Lock, TrendingDown, Clock, DollarSign, ChevronDown, ChevronUp, MessageSquare, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  getAlertas, saveAlertas, getCuadres, getConfigSeguridad, saveConfigSeguridad,
  marcarAlertaLeida, marcarTodasLeidas, generarMensajeAgente,
  CONFIG_SEGURIDAD_DEFAULT,
} from '@/lib/security-agent';
import type { AlertaSeguridad, CuadreTurno, ConfigSeguridad } from '@/types';

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;
const formatFecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const NIVEL_STYLE: Record<string, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  alta:    'bg-orange-100 text-orange-800 border-orange-200',
  media:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  info:    'bg-blue-100 text-blue-800 border-blue-200',
};
const NIVEL_DOT: Record<string, string> = {
  critica: 'bg-red-500',
  alta:    'bg-orange-500',
  media:   'bg-yellow-500',
  info:    'bg-blue-500',
};

interface Props {
  userRole?: string;
  ventas?: any[];
}

export default function Seguridad({ userRole, ventas = [] }: Props) {
  const [tab, setTab] = useState<'canal' | 'cuadres' | 'config'>('canal');
  const [alertas, setAlertas] = useState<AlertaSeguridad[]>([]);
  const [cuadres, setCuadres] = useState<CuadreTurno[]>([]);
  const [config, setConfig] = useState<ConfigSeguridad>(CONFIG_SEGURIDAD_DEFAULT);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [expandedCuadre, setExpandedCuadre] = useState<string | null>(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [mensajeAgente, setMensajeAgente] = useState('');
  const [filtroNivel, setFiltroNivel] = useState<string>('todos');

  const esAdmin = userRole === 'ADMIN' || userRole === 'GERENTE';

  const cargar = useCallback(() => {
    const a = getAlertas();
    const c = getCuadres();
    const cfg = getConfigSeguridad();
    setAlertas(a);
    setCuadres(c);
    setConfig(cfg);
    setMensajeAgente(generarMensajeAgente(a, c));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLeer = (id: string) => {
    marcarAlertaLeida(id);
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a));
  };

  const handleLeerTodas = () => {
    marcarTodasLeidas();
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
    toast.success('Todas las alertas marcadas como leídas');
  };

  const handleBorrarLeidas = () => {
    const nuevas = alertas.filter(a => !a.leida);
    saveAlertas(nuevas);
    setAlertas(nuevas);
    toast.success('Alertas leídas eliminadas');
  };

  const handleGuardarConfig = () => {
    saveConfigSeguridad(config);
    toast.success('Configuración de seguridad guardada');
  };

  const alertasFiltradas = filtroNivel === 'todos' ? alertas : alertas.filter(a => a.nivel === filtroNivel);
  const noLeidas = alertas.filter(a => !a.leida).length;
  const criticas = alertas.filter(a => !a.leida && a.nivel === 'critica').length;

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 opacity-60">
        <Lock className="w-16 h-16 text-slate-300" />
        <p className="text-lg font-black uppercase tracking-widest text-slate-500">Acceso restringido</p>
        <p className="text-sm text-slate-400">Solo Admin y Gerente pueden ver el panel de seguridad.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Control de Seguridad</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Agente IA anti-fraude activo</p>
          </div>
        </div>
        <button onClick={cargar} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mensaje del Agente IA */}
      <div className={`rounded-2xl p-4 border flex items-start gap-3 ${criticas > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : noLeidas > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'}`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${criticas > 0 ? 'bg-red-600' : noLeidas > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Agente de Seguridad IA</p>
          <p className="text-sm font-bold text-slate-800 dark:text-white">{mensajeAgente}</p>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-center">
          <p className={`text-2xl font-black tabular-nums ${noLeidas > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{noLeidas}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Sin leer</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-center">
          <p className="text-2xl font-black tabular-nums text-slate-700 dark:text-white">{cuadres.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Cuadres</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-center">
          <p className={`text-2xl font-black tabular-nums ${cuadres[0]?.diferencia < -5000 ? 'text-red-600' : 'text-emerald-600'}`}>
            {cuadres[0] ? formatCOP(cuadres[0].diferencia) : '—'}
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Último Δ caja</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-1">
        {[
          { id: 'canal', label: 'Canal de alertas', Icon: MessageSquare, badge: noLeidas },
          { id: 'cuadres', label: 'Cuadres de turno', Icon: DollarSign, badge: 0 },
          { id: 'config', label: 'Configuración', Icon: Settings, badge: 0 },
        ].map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all relative ${tab === id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
          </button>
        ))}
      </div>

      {/* ── CANAL DE ALERTAS ── */}
      {tab === 'canal' && (
        <div className="space-y-3">
          {/* Controles */}
          <div className="flex items-center gap-2">
            <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 font-bold">
              <option value="todos">Todas</option>
              <option value="critica">Críticas</option>
              <option value="alta">Altas</option>
              <option value="media">Medias</option>
              <option value="info">Info</option>
            </select>
            {noLeidas > 0 && (
              <button onClick={handleLeerTodas} className="h-8 px-3 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-black uppercase flex items-center gap-1">
                <Eye className="w-3 h-3" /> Leer todas
              </button>
            )}
            <button onClick={handleBorrarLeidas} className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase flex items-center gap-1 ml-auto">
              <Trash2 className="w-3 h-3" /> Limpiar leídas
            </button>
          </div>

          {alertasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 opacity-50">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Sin alertas activas</p>
              <p className="text-xs text-slate-400">El agente de seguridad está monitoreando en tiempo real</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertasFiltradas.map(a => (
                <div
                  key={a.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${a.leida ? 'opacity-60' : ''} ${NIVEL_STYLE[a.nivel]}`}
                >
                  <button
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                    onClick={() => setExpandedAlert(expandedAlert === a.id ? null : a.id)}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.leida ? 'bg-slate-300' : NIVEL_DOT[a.nivel]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black">{a.titulo}</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-white/60">{a.nivel}</span>
                      </div>
                      <p className="text-[10px] mt-0.5 opacity-80 truncate">{a.descripcion}</p>
                      <p className="text-[9px] opacity-60 mt-0.5">{formatFecha(a.fecha)}{a.vendedora ? ` · ${a.vendedora}` : ''}</p>
                    </div>
                    {expandedAlert === a.id ? <ChevronUp className="w-4 h-4 shrink-0 mt-0.5 opacity-60" /> : <ChevronDown className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />}
                  </button>
                  {expandedAlert === a.id && (
                    <div className="px-4 pb-3 pt-1 border-t border-current/10 space-y-2">
                      <p className="text-xs">{a.descripcion}</p>
                      {a.datos && Object.keys(a.datos).length > 0 && (
                        <div className="bg-white/50 rounded-xl p-2 space-y-1">
                          {Object.entries(a.datos).map(([k, v]) => (
                            <p key={k} className="text-[10px]"><span className="font-black">{k}:</span> {typeof v === 'number' ? formatCOP(v) : String(v)}</p>
                          ))}
                        </div>
                      )}
                      {!a.leida && (
                        <button onClick={() => handleLeer(a.id)} className="h-7 px-3 rounded-lg bg-white/70 hover:bg-white text-[10px] font-black uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Marcar como revisada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CUADRES DE TURNO ── */}
      {tab === 'cuadres' && (
        <div className="space-y-3">
          {cuadres.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 opacity-50">
              <Clock className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Sin cuadres registrados</p>
              <p className="text-xs text-slate-400">Los cuadres aparecen aquí cuando las vendedoras cierran su turno</p>
            </div>
          ) : cuadres.map(c => {
            const faltante = c.diferencia < 0;
            const sobrante = c.diferencia > 2000;
            return (
              <div key={c.id} className={`rounded-2xl border overflow-hidden ${faltante ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900' : sobrante ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900'}`}>
                <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpandedCuadre(expandedCuadre === c.id ? null : c.id)}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${faltante ? 'bg-red-500' : sobrante ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {faltante ? <TrendingDown className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-white">{c.usuarioNombre}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${faltante ? 'bg-red-100 text-red-700' : sobrante ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {faltante ? `Faltó ${formatCOP(Math.abs(c.diferencia))}` : sobrante ? `Sobró ${formatCOP(c.diferencia)}` : 'Cuadró'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatFecha(c.fechaCierre)} · Total ventas: {formatCOP(c.totalVentas)}</p>
                  </div>
                  {expandedCuadre === c.id ? <ChevronUp className="w-4 h-4 opacity-40 shrink-0" /> : <ChevronDown className="w-4 h-4 opacity-40 shrink-0" />}
                </button>
                {expandedCuadre === c.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-current/10 grid grid-cols-2 gap-2">
                    {[
                      { label: 'Apertura', val: c.montoApertura },
                      { label: 'Esperado en caja', val: c.montoEsperado },
                      { label: 'Declarado', val: c.montoDeclarado },
                      { label: 'Diferencia', val: c.diferencia },
                      { label: 'Ventas efectivo', val: c.ventasEfectivo },
                      { label: 'Ventas Nequi', val: c.ventasNequi },
                      { label: 'Ventas transferencia', val: c.ventasTransferencia },
                      { label: 'Créditos registrados', val: c.ventasCredito },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-2">
                        <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
                        <p className={`text-sm font-black tabular-nums ${label === 'Diferencia' ? (val < 0 ? 'text-red-600' : 'text-emerald-600') : 'text-slate-800 dark:text-white'}`}>
                          {formatCOP(val)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Estado del agente</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-white">Agente de seguridad IA</p>
                <p className="text-[11px] text-slate-500">Activa/desactiva todo el sistema de monitoreo</p>
              </div>
              <button
                onClick={() => setConfig(p => ({ ...p, activado: !p.activado }))}
                className={`w-12 h-6 rounded-full transition-colors ${config.activado ? 'bg-emerald-500' : 'bg-slate-300'} relative`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${config.activado ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Control de caja</p>
            <div>
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wide">Tolerancia de faltante (COP)</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Diferencia máxima aceptada sin generar alerta</p>
              <Input type="number" value={config.toleranciaFaltanteCaja} onChange={e => setConfig(p => ({ ...p, toleranciaFaltanteCaja: Number(e.target.value) }))} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wide">Horas para alerta de turno abierto</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Si la caja lleva más de X horas sin cerrar, se genera alerta</p>
              <Input type="number" value={config.horasParaAlertaTurnoAbierto} onChange={e => setConfig(p => ({ ...p, horasParaAlertaTurnoAbierto: Number(e.target.value) }))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Control de precios y descuentos</p>
            <div>
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wide">Descuento máximo sin PIN (%)</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Si la vendedora intenta hacer un descuento mayor, pide PIN de gerente</p>
              <Input type="number" min="0" max="100" value={config.descuentoMaxSinPin} onChange={e => setConfig(p => ({ ...p, descuentoMaxSinPin: Number(e.target.value) }))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Autorización</p>
            <div>
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wide">PIN de gerente</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Para autorizar descuentos, cancelaciones y acciones sensibles</p>
              <div className="flex gap-2">
                <Input
                  type={pinVisible ? 'text' : 'password'}
                  value={config.pinGerente}
                  onChange={e => setConfig(p => ({ ...p, pinGerente: e.target.value }))}
                  className="h-9 text-sm flex-1"
                  maxLength={8}
                  placeholder="4-8 dígitos"
                />
                <button onClick={() => setPinVisible(p => !p)} className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 text-xs font-bold">
                  {pinVisible ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wide">WhatsApp del admin (alertas críticas)</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Número colombiano sin +57, ej: 3001234567</p>
              <Input type="tel" value={config.whatsappAdmin} onChange={e => setConfig(p => ({ ...p, whatsappAdmin: e.target.value }))} className="h-9 text-sm" placeholder="3001234567" />
            </div>
          </div>

          <Button onClick={handleGuardarConfig} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest rounded-xl">
            <Shield className="w-4 h-4 mr-2" /> Guardar configuración de seguridad
          </Button>
        </div>
      )}
    </div>
  );
}
