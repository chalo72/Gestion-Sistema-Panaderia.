import { useState, useMemo } from 'react';
import {
  Pin, Send, Users, ShieldCheck, Activity, Terminal, Shield, Rocket,
  Loader2, X, MessageSquare as MsgIcon,
  TrendingUp, Wallet, Utensils, Package, Megaphone,
  Truck, CheckCircle, Wrench, MessageSquare,
  Leaf, Scale, FileText, Target, Instagram,
  Lightbulb, Clipboard, Brain, Building, ShieldAlert, Eye,
  BarChart3, Zap, TrendingDown, AlertTriangle, CreditCard,
  ShoppingCart, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole, Venta, Producto, CajaSesion, CreditoCliente, Gasto } from '@/types';
import { cn } from '@/lib/utils';
import {
  type AgenteId, AGENTES_CONFIG, consultarAgente
} from '@/constants/agentes';
import { AccesoGlobalCard } from '@/components/layout/AccesoGlobalCard';

interface InventarioItem { productoId: string; stock: number; stockMinimo?: number; }

interface OficinaProps {
  publicAppUrl?: string;
  onViewChange: (view: any) => void;
  ventas?: Venta[];
  productos?: Producto[];
  inventario?: InventarioItem[];
  sesionesCaja?: CajaSesion[];
  creditosClientes?: CreditoCliente[];
  gastos?: Gasto[];
  formatCurrency?: (v: number) => string;
}

type Tab = 'hoy' | 'agentes' | 'equipo';

const ROLE_CONFIG: Record<UserRole, { label: string; emoji: string; color: string; bg: string; borderColor: string; shadow: string }> = {
  ADMIN:     { label: 'Administrador', emoji: '👑', color: 'text-[#DAA520]', bg: 'bg-[#DAA520]/10', borderColor: 'border-[#DAA520]/30', shadow: 'shadow-[#DAA520]/20' },
  GERENTE:   { label: 'Gerente',       emoji: '💼', color: 'text-[#60a5fa]', bg: 'bg-[#60a5fa]/10', borderColor: 'border-[#60a5fa]/30', shadow: 'shadow-[#60a5fa]/20' },
  COMPRADOR: { label: 'Comprador',     emoji: '🛒', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', borderColor: 'border-[#10b981]/30', shadow: 'shadow-[#10b981]/20' },
  VENDEDOR:  { label: 'Vendedor',      emoji: '💰', color: 'text-[#f97316]', bg: 'bg-[#f97316]/10', borderColor: 'border-[#f97316]/30', shadow: 'shadow-[#f97316]/20' },
  PANADERO:  { label: 'Panadero',      emoji: '🍞', color: 'text-[#F5DEB3]', bg: 'bg-[#F5DEB3]/10', borderColor: 'border-[#F5DEB3]/30', shadow: 'shadow-[#F5DEB3]/20' },
  AUXILIAR:  { label: 'Auxiliar',      emoji: '🔧', color: 'text-[#94a3b8]', bg: 'bg-[#94a3b8]/10', borderColor: 'border-[#94a3b8]/30', shadow: 'shadow-[#94a3b8]/20' },
};

// Agentes ordenados por importancia para el panadero
const AGENTES_ESTRELLA: AgenteId[] = ['gerente', 'ventas', 'inventario', 'contable', 'abogado'];
const DIV_ESTRATEGICA: AgenteId[] = ['gerente', 'inversion', 'contable', 'creditos', 'subvenciones'];
const DIV_OPERATIVA: AgenteId[]   = ['produccion', 'inventario', 'logistica', 'calidad', 'mantenimiento', 'sostenibilidad'];
const DIV_CRECIMIENTO: AgenteId[] = ['marketing', 'influencer', 'ventas', 'clientes', 'pitch'];
const DIV_ADMIN_LEGAL: AgenteId[] = ['abogado', 'tax', 'nomina', 'expansion'];
const DIV_SEGURIDAD: AgenteId[]   = ['pico-claw', 'open-claw', 'auto-claw'];

const ICON_MAP: Record<string, any> = {
  gerente: Brain, inversion: TrendingUp, contable: Wallet, creditos: Building, subvenciones: Clipboard,
  produccion: Utensils, inventario: Package, logistica: Truck, calidad: CheckCircle, mantenimiento: Wrench, sostenibilidad: Leaf,
  marketing: Megaphone, influencer: Instagram, ventas: Target, clientes: MessageSquare, pitch: Lightbulb,
  abogado: Scale, tax: FileText, nomina: Users, expansion: Rocket,
  'pico-claw': ShieldAlert, 'open-claw': Eye, 'auto-claw': Activity
};

export default function Oficina({ publicAppUrl, onViewChange, ventas = [], productos = [], inventario = [], sesionesCaja = [], creditosClientes = [], gastos = [], formatCurrency }: OficinaProps) {
  const { usuarios, usuario } = useAuth();
  const [tab, setTab] = useState<Tab>('hoy');
  const [anuncios, setAnuncios] = useState([{ id: 1, autor: 'Sistema', texto: 'Dulce Placer v8.5 — Digitalizado al 100% 🎉', hora: 'Hoy' }]);
  const [nuevoAnuncio, setNuevoAnuncio] = useState('');
  const [verTodosAgentes, setVerTodosAgentes] = useState(false);
  const [agenteActivo, setAgenteActivo] = useState<AgenteId | null>(null);
  const [promptAgente, setPromptAgente] = useState('');
  const [respuestaAgente, setRespuestaAgente] = useState('');
  const [estaCargandoAgente, setEstaCargandoAgente] = useState(false);
  const [ultimoBriefing, setUltimoBriefing] = useState<{ texto: string; hora: string } | null>(null);
  const [cargandoBriefing, setCargandoBriefing] = useState(false);

  const fmt = (v: number) => formatCurrency ? formatCurrency(v) : `$${v.toLocaleString('es-CO')}`;

  // ── KPIs REALES ──
  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const ventasHoy = ventas.filter(v => v.fecha?.startsWith(hoy));
    const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);

    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    const totalAyer = ventas.filter(v => v.fecha?.startsWith(ayerStr)).reduce((s, v) => s + v.total, 0);
    const diff = totalAyer > 0 ? ((totalHoy - totalAyer) / totalAyer * 100) : 0;

    const stockBajo = inventario.filter(i => i.stockMinimo !== undefined && i.stock <= i.stockMinimo);
    const creditosVencidos = creditosClientes.filter(c => c.estado === 'vencido');
    const totalCreditosVencidos = creditosVencidos.reduce((s, c) => s + (c.saldo || 0), 0);
    const cajaAbierta = sesionesCaja.find(s => s.estado === 'abierta');

    const conteoProductos: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    ventasHoy.forEach(v => v.items.forEach(item => {
      const prod = productos.find(p => p.id === item.productoId);
      const nombre = prod?.nombre || item.productoId;
      if (!conteoProductos[item.productoId]) conteoProductos[item.productoId] = { nombre, cantidad: 0, total: 0 };
      conteoProductos[item.productoId].cantidad += item.cantidad;
      conteoProductos[item.productoId].total += item.subtotal;
    }));
    const top3 = Object.values(conteoProductos).sort((a, b) => b.total - a.total).slice(0, 3);

    return {
      totalHoy, totalAyer, diff, txCount: ventasHoy.length,
      stockBajo: stockBajo.length, stockBajoItems: stockBajo,
      creditosVencidos: creditosVencidos.length, totalCreditosVencidos,
      cajaAbierta, top3
    };
  }, [ventas, productos, inventario, sesionesCaja, creditosClientes]);

  // ── Contexto para los agentes ──
  const contextoNegocio = useMemo(() => {
    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const mesActual = new Date().toISOString().substring(0, 7);
    const gastosMes = gastos.filter(g => g.fecha?.startsWith(mesActual));
    const totalGastosMes = gastosMes.reduce((s, g) => s + g.monto, 0);

    return `RESUMEN OPERATIVO — ${hoy.toUpperCase()}:

VENTAS HOY: ${fmt(kpis.totalHoy)} en ${kpis.txCount} transacciones
COMPARATIVO vs AYER: ${fmt(kpis.totalAyer)} (${kpis.diff > 0 ? '+' : ''}${kpis.diff.toFixed(1)}%)

PRODUCTOS MÁS VENDIDOS HOY:
${kpis.top3.length > 0 ? kpis.top3.map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} uds = ${fmt(p.total)}`).join('\n') : '- Sin ventas aún'}

CAJA: ${kpis.cajaAbierta ? `ABIERTA (apertura: ${fmt(kpis.cajaAbierta.montoApertura || 0)})` : 'Cerrada'}
STOCK BAJO: ${kpis.stockBajo} producto(s) con alerta
CRÉDITOS VENCIDOS: ${kpis.creditosVencidos} cliente(s) — ${fmt(kpis.totalCreditosVencidos)}
GASTOS DEL MES: ${fmt(totalGastosMes)} en ${gastosMes.length} registros
EQUIPO: ${usuarios.filter(u => u.activo !== false).length} personas activas`;
  }, [kpis, ventas, gastos, usuarios]);

  // ── Briefing ──
  const pedirBriefingGerente = async () => {
    setCargandoBriefing(true);
    try {
      let texto = '';
      await consultarAgente(
        'gerente',
        `Analiza los datos reales del negocio y dame un informe ejecutivo conciso (máximo 180 palabras): 1) Estado del negocio hoy, 2) Alertas críticas, 3) Una recomendación de acción para el dueño. Tono directo como gerente de confianza.`,
        (chunk) => { texto += chunk; },
        undefined,
        contextoNegocio
      );
      setUltimoBriefing({ texto, hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) });
    } catch (err: any) {
      toast.error(`Error en briefing: ${err.message}`);
    } finally {
      setCargandoBriefing(false);
    }
  };

  const handleConsultarAgente = async () => {
    if (!agenteActivo || !promptAgente.trim() || estaCargandoAgente) return;
    setEstaCargandoAgente(true);
    setRespuestaAgente('');
    try {
      await consultarAgente(agenteActivo, promptAgente, (chunk) => {
        setRespuestaAgente(prev => prev + chunk);
      }, undefined, contextoNegocio);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setEstaCargandoAgente(false);
    }
  };

  const handleAnuncioGeneral = () => {
    if (!nuevoAnuncio.trim()) return;
    setAnuncios(prev => [{ id: Date.now(), autor: usuario?.nombre || 'Dirección', texto: nuevoAnuncio.trim(), hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setNuevoAnuncio('');
    toast.success('Anuncio enviado al equipo');
  };

  const handleShareWhatsApp = (nombre: string, email: string, rol: UserRole) => {
    const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
    const appUrl = publicAppUrl || window.location.origin;
    const mensaje = `🌟 *DULCE PLACER* 🌟\n\nHola *${nombre}* ${config.emoji}, tus credenciales:\n\n🔗 *App:* ${appUrl}\n📧 *Usuario:* ${email}\n🔑 *PIN:* Solicítalo al administrador`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const abrirAgente = (id: AgenteId) => {
    setAgenteActivo(id);
    setRespuestaAgente('');
    setPromptAgente('');
  };

  // ── Render tarjeta de agente ──
  const AgentCard = ({ id }: { id: AgenteId }) => {
    const config = AGENTES_CONFIG[id];
    if (!config) return null;
    const Icon = ICON_MAP[id] || Brain;
    return (
      <div
        onClick={() => abrirAgente(id)}
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/30 cursor-pointer transition-all hover:scale-[1.04] active:scale-95 group"
      >
        <div className={cn('p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors', config.bg)}>
          <Icon className={cn('w-5 h-5', config.color)} />
        </div>
        <p className="text-[11px] font-black text-white uppercase tracking-tight text-center leading-tight">{config.nombre}</p>
        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center">{config.cargo}</p>
      </div>
    );
  };

  // ─── TABS ───
  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'hoy', label: 'Panel del Día', icon: '📊' },
    { id: 'agentes', label: 'Agentes IA', icon: '🤖' },
    { id: 'equipo', label: 'Equipo', icon: '👥' },
  ];

  const modalAgente = agenteActivo ? AGENTES_CONFIG[agenteActivo] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#020617] text-slate-200">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12 relative z-10">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-[#DAA520] rounded-full shadow-[0_0_12px_#DAA520]" />
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                Oficina <span className="text-[#DAA520]">Central</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Dulce Placer · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{Object.keys(AGENTES_CONFIG).length} Agentes IA</span>
          </div>
        </div>

        {/* ── PESTAÑAS ── */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-2xl border border-white/10">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all',
                tab === t.id
                  ? 'bg-[#DAA520] text-black shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            PESTAÑA 1: PANEL DEL DÍA
        ══════════════════════════════════════════ */}
        {tab === 'hoy' && (
          <div className="space-y-6 animate-ag-fade-in">

            {/* KPIs principales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Ventas Hoy',
                  value: fmt(kpis.totalHoy),
                  sub: `${kpis.txCount} transacciones`,
                  icon: ShoppingCart,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10 border-emerald-500/20',
                  trend: kpis.diff,
                },
                {
                  label: 'Caja',
                  value: kpis.cajaAbierta ? 'ABIERTA' : 'CERRADA',
                  sub: kpis.cajaAbierta ? fmt(kpis.cajaAbierta.montoApertura || 0) + ' apertura' : 'Sin sesión activa',
                  icon: Wallet,
                  color: kpis.cajaAbierta ? 'text-green-400' : 'text-slate-400',
                  bg: kpis.cajaAbierta ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800/50 border-white/10',
                },
                {
                  label: 'Stock Bajo',
                  value: String(kpis.stockBajo),
                  sub: kpis.stockBajo > 0 ? 'Requiere atención' : 'Todo OK',
                  icon: Package,
                  color: kpis.stockBajo > 0 ? 'text-orange-400' : 'text-slate-400',
                  bg: kpis.stockBajo > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-slate-800/50 border-white/10',
                },
                {
                  label: 'Créditos Vencidos',
                  value: String(kpis.creditosVencidos),
                  sub: kpis.creditosVencidos > 0 ? fmt(kpis.totalCreditosVencidos) : 'Sin vencidos',
                  icon: CreditCard,
                  color: kpis.creditosVencidos > 0 ? 'text-red-400' : 'text-slate-400',
                  bg: kpis.creditosVencidos > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/50 border-white/10',
                },
              ].map((kpi) => (
                <div key={kpi.label} className={cn('rounded-2xl border p-4 space-y-2', kpi.bg)}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{kpi.label}</p>
                    <kpi.icon className={cn('w-4 h-4', kpi.color)} />
                  </div>
                  <p className={cn('text-xl font-black', kpi.color)}>{kpi.value}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">{kpi.sub}</p>
                    {'trend' in kpi && (
                      <span className={cn('text-[10px] font-black flex items-center gap-0.5', kpi.trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {kpi.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(kpi.trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Top productos */}
            {kpis.top3.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">🏆 Más vendidos hoy</p>
                <div className="space-y-2">
                  {kpis.top3.map((p, i) => (
                    <div key={p.nombre} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#DAA520] w-4">{i + 1}.</span>
                        <span className="text-sm font-bold text-white">{p.nombre}</span>
                        <span className="text-[10px] text-slate-500">{p.cantidad} uds</span>
                      </div>
                      <span className="text-sm font-black text-emerald-400">{fmt(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock bajo alertas */}
            {kpis.stockBajo > 0 && (
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Stock Bajo — Requiere Reposición</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {kpis.stockBajoItems.slice(0, 6).map(item => {
                    const prod = productos.find(p => p.id === item.productoId);
                    return (
                      <span key={item.productoId} className="text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-300 px-2 py-1 rounded-lg font-bold">
                        {prod?.nombre || item.productoId} ({item.stock})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Briefing del Gerente IA */}
            <div className="rounded-2xl border border-[#DAA520]/30 bg-[#DAA520]/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 bg-[#DAA520] rounded-full shadow-[0_0_8px_#DAA520]" />
                  <div>
                    <p className="text-sm font-black text-white">Gerente IA</p>
                    <p className="text-[9px] text-[#DAA520] font-bold uppercase tracking-widest">Análisis con datos reales</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={pedirBriefingGerente}
                    disabled={cargandoBriefing}
                    className="flex items-center gap-1.5 bg-[#DAA520] hover:bg-[#B8860B] disabled:opacity-60 text-black font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all active:scale-95"
                  >
                    {cargandoBriefing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {cargandoBriefing ? 'Analizando...' : 'Briefing del Día'}
                  </button>
                  <button
                    onClick={() => abrirAgente('gerente')}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all border border-white/10"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-[#DAA520]" />
                    Consultar
                  </button>
                </div>
              </div>

              {ultimoBriefing ? (
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{ultimoBriefing.texto}</p>
                  <p className="text-[9px] text-[#DAA520] font-black uppercase tracking-widest mt-3">GERENTE IA · {ultimoBriefing.hora}</p>
                </div>
              ) : (
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-center">
                  <p className="text-xs text-slate-500">Pulsa <strong className="text-[#DAA520]">Briefing del Día</strong> para recibir un análisis automático con los datos reales del negocio.</p>
                </div>
              )}
            </div>

            {/* Tablón de anuncios */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-[#DAA520]" />
                <p className="text-sm font-black text-white uppercase tracking-widest">Tablón de Anuncios</p>
              </div>
              <Textarea
                placeholder="Escribe un anuncio para el equipo..."
                value={nuevoAnuncio}
                onChange={e => setNuevoAnuncio(e.target.value)}
                className="bg-black/30 border-white/10 text-sm p-4 rounded-xl min-h-[80px] mb-3 resize-none"
              />
              <button
                onClick={handleAnuncioGeneral}
                className="flex items-center gap-2 w-full justify-center bg-[#DAA520] hover:bg-[#B8860B] text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all"
              >
                <Send className="w-4 h-4" /> Publicar Anuncio
              </button>
              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto">
                {anuncios.map(a => (
                  <div key={a.id} className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-300">{a.texto}</p>
                    <div className="flex justify-between mt-2">
                      <span className="text-[9px] text-[#DAA520] font-black uppercase">{a.autor}</span>
                      <span className="text-[9px] text-slate-600">{a.hora}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PESTAÑA 2: AGENTES IA
        ══════════════════════════════════════════ */}
        {tab === 'agentes' && (
          <div className="space-y-6 animate-ag-fade-in">

            {/* Agentes estrella */}
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">⭐ Agentes más usados</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {AGENTES_ESTRELLA.map(id => <AgentCard key={id} id={id} />)}
              </div>
            </div>

            {/* Consulta rápida */}
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">💡 ¿Tienes una pregunta?</p>
              <p className="text-xs text-slate-400 mb-3">Selecciona un agente y escribe tu consulta. Usa los datos reales del negocio.</p>
              <div className="flex flex-wrap gap-2">
                {['¿Cuánto vendí hoy?', '¿Qué producir mañana?', '¿Cómo bajar gastos?', '¿Qué cobrar primero?'].map(q => (
                  <button
                    key={q}
                    onClick={() => { abrirAgente('gerente'); setPromptAgente(q); }}
                    className="text-[10px] bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg font-bold hover:bg-white/10 hover:border-indigo-500/30 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Todos los agentes */}
            <div>
              <button
                onClick={() => setVerTodosAgentes(v => !v)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white font-black uppercase tracking-widest transition-colors mb-3"
              >
                {verTodosAgentes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {verTodosAgentes ? 'Ocultar' : 'Ver todos los agentes'} ({Object.keys(AGENTES_CONFIG).length} en total)
              </button>

              {verTodosAgentes && (
                <div className="space-y-5">
                  {[
                    { label: '🧠 Estratégica', ids: DIV_ESTRATEGICA, color: 'text-[#DAA520]', icon: Shield },
                    { label: '⚙️ Operaciones', ids: DIV_OPERATIVA, color: 'text-indigo-400', icon: Activity },
                    { label: '📈 Crecimiento', ids: DIV_CRECIMIENTO, color: 'text-rose-400', icon: Rocket },
                    { label: '⚖️ Legal & Fiscal', ids: DIV_ADMIN_LEGAL, color: 'text-red-400', icon: Scale },
                    { label: '🛡️ Seguridad (CLAW)', ids: DIV_SEGURIDAD, color: 'text-slate-400', icon: ShieldAlert },
                  ].map(div => (
                    <div key={div.label}>
                      <div className="flex items-center gap-2 mb-3">
                        <div.icon className={cn('w-3.5 h-3.5', div.color)} />
                        <p className={cn('text-[10px] font-black uppercase tracking-widest', div.color)}>{div.label}</p>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {div.ids.map(id => <AgentCard key={id} id={id} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enlace de acceso externo */}
            <AccesoGlobalCard
              publicUrl={publicAppUrl}
              localIp="192.168.1.5"
              nombreNegocio="Dulce Placer"
            />
          </div>
        )}

        {/* ══════════════════════════════════════════
            PESTAÑA 3: EQUIPO
        ══════════════════════════════════════════ */}
        {tab === 'equipo' && (
          <div className="space-y-6 animate-ag-fade-in">

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Usuarios', value: String(usuarios.length), icon: Users, color: 'text-indigo-400' },
                { label: 'Activos', value: String(usuarios.filter(u => u.activo !== false).length), icon: Activity, color: 'text-green-400' },
                { label: 'Roles', value: String(new Set(usuarios.map(u => u.rol)).size), icon: ShieldCheck, color: 'text-[#DAA520]' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <s.icon className={cn('w-5 h-5 mx-auto mb-2', s.color)} />
                  <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Lista de usuarios */}
            <div className="space-y-3">
              {usuarios.map(u => {
                const rol = (u.rol as UserRole) || 'AUXILIAR';
                const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
                const activo = u.activo !== false;
                return (
                  <div key={u.id} className={cn('flex items-center justify-between p-4 rounded-2xl border bg-white/5 transition-all hover:bg-white/8', config.borderColor)}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2', config.bg, config.borderColor)}>
                        {config.emoji}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{u.nombre} {u.apellido}</p>
                        <p className="text-[10px] text-slate-500 italic">{u.email}</p>
                        <Badge className={cn('mt-1 text-[8px] font-black px-2 py-0 rounded-lg border-none', config.bg, config.color)}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full', activo ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500')}>
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => handleShareWhatsApp(`${u.nombre} ${u.apellido}`, u.email, rol)}
                        className="text-[9px] bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 text-green-400 px-3 py-1 rounded-lg font-black uppercase tracking-widest transition-all"
                      >
                        📲 Enviar Acceso
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL AGENTE ── */}
      {agenteActivo && modalAgente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-ag-fade-in">
          <div className={cn(
            'relative w-full max-w-2xl bg-slate-900/95 backdrop-blur-2xl border-2 rounded-3xl overflow-hidden shadow-2xl',
            (modalAgente.bg || '').split(' ')[1] || 'border-white/10'
          )}>
            {/* Header */}
            <div className="bg-white/5 px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  {(() => { const Icon = ICON_MAP[agenteActivo] || Brain; return <Icon className={cn('w-5 h-5', modalAgente.color)} />; })()}
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">{modalAgente.nombre}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{modalAgente.cargo}</p>
                </div>
              </div>
              <button onClick={() => setAgenteActivo(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="p-6 space-y-5">
              {/* Respuesta */}
              <div className="min-h-[120px] max-h-[260px] overflow-y-auto bg-black/40 rounded-2xl p-5 border border-white/5">
                {respuestaAgente ? (
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{respuestaAgente}</p>
                ) : (
                  <p className="text-sm text-slate-600 uppercase tracking-widest text-center mt-8 font-bold">Esperando tu consulta...</p>
                )}
              </div>

              {/* Plantillas */}
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Consultas rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {modalAgente.plantillas.map((plantilla, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setPromptAgente(plantilla); setTimeout(() => handleConsultarAgente(), 50); }}
                      className="text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/30 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {plantilla}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="space-y-3">
                <Textarea
                  placeholder={`Pregunta algo a ${modalAgente.nombre}...`}
                  value={promptAgente}
                  onChange={e => setPromptAgente(e.target.value)}
                  className="bg-white/5 border-white/10 text-sm p-4 rounded-2xl min-h-[80px] resize-none"
                  disabled={estaCargandoAgente}
                />
                <button
                  onClick={handleConsultarAgente}
                  disabled={!promptAgente.trim() || estaCargandoAgente}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all"
                >
                  {estaCargandoAgente ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><MsgIcon className="w-4 h-4" /> Enviar Consulta</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
