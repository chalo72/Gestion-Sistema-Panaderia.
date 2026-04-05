import { useState } from 'react';
import { 
  Pin, Send, Users, ShieldCheck, Activity, Terminal, Shield, Rocket,
  Loader2, X, MessageSquare as MsgIcon,
  TrendingUp, Wallet, Utensils, Package, Megaphone,
  Truck, CheckCircle, Wrench, MessageSquare, 
  Leaf, Scale, FileText, Target, Instagram, 
  Lightbulb, Clipboard, Brain, Building, ShieldAlert, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { 
  type AgenteId, AGENTES_CONFIG, consultarAgente 
} from '@/constants/agentes';

interface OficinaProps {
  publicAppUrl?: string;
  onViewChange: (view: any) => void;
}

const ROLE_CONFIG: Record<UserRole, { label: string; emoji: string; color: string; bg: string; borderColor: string; shadow: string }> = {
  ADMIN:     { label: 'ADMINISTRADOR', emoji: '👑', color: 'text-[#DAA520]', bg: 'bg-[#DAA520]/10', borderColor: 'border-[#DAA520]/30', shadow: 'shadow-[#DAA520]/20' },
  GERENTE:   { label: 'GERENTE',       emoji: '💼', color: 'text-[#60a5fa]', bg: 'bg-[#60a5fa]/10', borderColor: 'border-[#60a5fa]/30', shadow: 'shadow-[#60a5fa]/20' },
  COMPRADOR: { label: 'COMPRADOR',     emoji: '🛒', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', borderColor: 'border-[#10b981]/30', shadow: 'shadow-[#10b981]/20' },
  VENDEDOR:  { label: 'VENDEDOR',      emoji: '💰', color: 'text-[#f97316]', bg: 'bg-[#f97316]/10', borderColor: 'border-[#f97316]/30', shadow: 'shadow-[#f97316]/20' },
  PANADERO:  { label: 'PANADERO',      emoji: '🍞', color: 'text-[#F5DEB3]', bg: 'bg-[#F5DEB3]/10', borderColor: 'border-[#F5DEB3]/30', shadow: 'shadow-[#F5DEB3]/20' },
  AUXILIAR:  { label: 'AUXILIAR',      emoji: '🔧', color: 'text-[#94a3b8]', bg: 'bg-[#94a3b8]/10', borderColor: 'border-[#94a3b8]/30', shadow: 'shadow-[#94a3b8]/20' },
};

// ── IDs DE AGENTES POR DIVISIÓN (Vínculo con AGENTES_CONFIG) ────────────────
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

export default function Oficina({ publicAppUrl, onViewChange }: OficinaProps) {
  const { usuarios } = useAuth();
  const [anuncios, setAnuncios] = useState([{ id: 1, autor: 'Sistema', texto: 'Holding v8.0 Digitalizado al 100% 🎉', hora: 'Hoy' }]);
  const [nuevoAnuncio, setNuevoAnuncio] = useState('');
  const [onlineIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    usuarios.slice(0, 3).forEach(u => ids.add(u.id));
    return ids;
  });

  const appUrl = publicAppUrl || window.location.origin;

  // Estado para la Autonomía de Agentes
  const [agenteActivo, setAgenteActivo] = useState<AgenteId | null>(null);
  const [promptAgente, setPromptAgente] = useState('');
  const [respuestaAgente, setRespuestaAgente] = useState('');
  const [estaCargandoAgente, setEstaCargandoAgente] = useState(false);

  const handleShareWhatsApp = (nombre: string, email: string, rol: UserRole) => {
    const passwords = JSON.parse(localStorage.getItem('pricecontrol_role_passwords') || '{}');
    const password = passwords[rol] || 'Pendiente';
    const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
    const mensaje = `🌟 *DULCE PLACER - ACCESO* 🌟\n\nHola *${nombre}* ${config.emoji}, credenciales activas:\n\n🔗 *App:* ${appUrl}\n📧 *Usuario:* ${email}\n🔑 *Clave:* ${password}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
    toast.success(`Acceso enviado a ${nombre}`);
  };

  const handleAnuncioGeneral = () => {
    if (!nuevoAnuncio.trim()) return;
    setAnuncios(prev => [{ id: Date.now(), autor: 'Opc. Center', texto: nuevoAnuncio.trim(), hora: 'Ahora' }, ...prev]);
    setNuevoAnuncio('');
    toast.success('Pulsación de Mando Exitosa');
  };

  const handleConsultarAgente = async () => {
    if (!agenteActivo || !promptAgente.trim() || estaCargandoAgente) return;
    setEstaCargandoAgente(true);
    setRespuestaAgente('');
    try {
      await consultarAgente(agenteActivo, promptAgente, (chunk) => {
        setRespuestaAgente(prev => prev + chunk);
      });
      toast.success(`${AGENTES_CONFIG[agenteActivo].nombre} ha respondido.`);
    } catch (err: any) {
      toast.error(`Error de enlace: ${err.message}`);
    } finally {
      setEstaCargandoAgente(false);
    }
  };

  const RenderAgent = (id: AgenteId) => {
    const config = AGENTES_CONFIG[id];
    if (!config) return null; // Seguridad contra IDs inexistentes
    const Icon = ICON_MAP[id] || Brain;
    const borderClass = (config.bg || '').split(' ')[1] || 'border-white/10';

    return (
      <div 
        key={id} 
        onClick={() => {
          setAgenteActivo(id);
          setRespuestaAgente('');
          setPromptAgente('');
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-3 group bg-slate-900/40 backdrop-blur-xl transition-all hover:scale-[1.05] hover:border-white/20 cursor-pointer shadow-lg",
          borderClass
        )}
      >
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 mb-2 group-hover:bg-white/10 transition-colors">
            <Icon className={cn("w-4 h-4", config.color)} />
          </div>
          <h4 className="text-[10px] font-black text-white uppercase tracking-tighter leading-none mb-1 truncate w-full group-hover:text-indigo-400 transition-colors">{config.nombre}</h4>
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic mb-3">{config.cargo}</p>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
          <p className="text-[10px] text-slate-200 font-medium leading-relaxed px-2 text-center drop-shadow-sm group-hover:text-white transition-colors">
            {config.misionPanaderia}
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    );
  };

  // ── MODAL CONSOLA AGENTE AUTÓNOMO ──
  const modalAgente = agenteActivo ? AGENTES_CONFIG[agenteActivo] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#020617] text-slate-200">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 relative z-10 animate-ag-fade-in">
        
        {/* Header Táctico */}
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 bg-[#DAA520] rounded-full shadow-[0_0_12px_#DAA520]" />
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                   Centro de <span className="text-[#DAA520]">Mando de Élite</span>
                </h1>
              </div>
              <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
                Dulce Placer Holding v8.5 • Director General
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Estatus Corporativo</span>
                <span className="text-2xl font-black text-white">20 AGENTES IA <span className="text-indigo-500 text-xs">+ EQUIPO HUMANO</span></span>
              </div>
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl shadow-lg">
                 <ShieldCheck className="w-7 h-7 text-indigo-400" />
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* DIVISIÓN ESTRATÉGICA */}
               <section className="space-y-4">
                 <div className="flex items-center gap-3">
                   <Shield className="w-4 h-4 text-[#DAA520]" />
                   <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División <span className="text-[#DAA520]">Estratégica</span></h2>
                   <div className="h-px flex-1 bg-white/5" />
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                   {DIV_ESTRATEGICA.map(RenderAgent)}
                 </div>
               </section>

               {/* DIVISIÓN ADMINISTRATIVA/LEGAL */}
               <section className="space-y-4">
                 <div className="flex items-center gap-3">
                   <Scale className="w-4 h-4 text-red-500" />
                   <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División <span className="text-red-500">Legal & Fiscal</span></h2>
                   <div className="h-px flex-1 bg-white/5" />
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                   {DIV_ADMIN_LEGAL.map(RenderAgent)}
                 </div>
               </section>
            </div>

            {/* DIVISIÓN OPERATIVA */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División de <span className="text-indigo-400">Operaciones Tácticas</span></h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {DIV_OPERATIVA.map(RenderAgent)}
              </div>
            </section>

            {/* DIVISIÓN CRECIMIENTO */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Rocket className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División de <span className="text-rose-500">Crecimiento & PR</span></h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {DIV_CRECIMIENTO.map(RenderAgent)}
              </div>
            </section>

            {/* DIVISIÓN ADMIN & LEGAL */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-slate-400" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División <span className="text-slate-400">Administrativa & Legal</span></h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DIV_ADMIN_LEGAL.map(RenderAgent)}
              </div>
            </section>

            {/* DIVISIÓN SEGURIDAD AUTÓNOMA (CLAW) */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest italic">División de <span className="text-red-500">Seguridad Autónoma (CLAW)</span></h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DIV_SEGURIDAD.map(RenderAgent)}
              </div>
            </section>

            {/* FUERZA HUMANA */}
            <section className="space-y-5 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Fuerza de Trabajo <span className="text-slate-500">Humana (Terminales)</span></h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {usuarios.map((u) => {
                  const rol = (u.rol as UserRole) || 'AUXILIAR';
                  const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
                  const isOnline = onlineIds.has(u.id);
                  return (
                    <div key={u.id} className={cn("relative p-6 rounded-[2.5rem] border-2 bg-slate-900/60 backdrop-blur-xl transition-all hover:-translate-y-2", config.borderColor, config.shadow)}>
                       <div className="flex items-center justify-between mb-5">
                          <div className="text-4xl drop-shadow-lg">{config.emoji}</div>
                          <div className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-white/5", isOnline ? "text-green-400 bg-green-500/10" : "text-slate-500 bg-slate-800")}>
                             {isOnline ? 'Active' : 'Idle'}
                          </div>
                       </div>
                       <h3 className="font-black text-white text-sm uppercase mb-1">{u.nombre} {u.apellido}</h3>
                       <p className="text-[10px] text-slate-500 mb-6 lowercase italic truncate">{u.email}</p>
                       <Badge className={cn("mb-8 text-[8px] font-black px-3 py-1 rounded-xl border-none shadow-sm", config.bg, config.color)}>{config.label}</Badge>
                       <Button size="sm" className={cn("w-full rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest py-5 transition-all shadow-xl", isOnline ? "bg-green-600 hover:bg-green-500" : "bg-slate-700 hover:bg-slate-600")} onClick={() => handleShareWhatsApp(`${u.nombre} ${u.apellido}`, u.email, rol)}>Enviar Directiva</Button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Panel de Mando Lateral */}
          <div className="xl:col-span-4 space-y-8">
            <div className="group relative">
               <div className="absolute -inset-1 bg-gradient-to-r from-[#DAA520] to-orange-600 rounded-[2.5rem] opacity-10 blur-xl group-hover:opacity-30 transition duration-1000" />
               <div className="relative bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                   <Terminal className="w-5 h-5 text-[#DAA520]" />
                   <span className="font-black text-white text-[11px] uppercase tracking-[0.3em]">Directiva General</span>
                </div>
                <Textarea placeholder="Escriba instrucción táctica aquí..." value={nuevoAnuncio} onChange={e => setNuevoAnuncio(e.target.value)} className="bg-black/40 border-white/5 text-sm p-5 rounded-2xl min-h-[120px] mb-6 focus:ring-1 ring-[#DAA520]/30" />
                <Button onClick={handleAnuncioGeneral} className="w-full bg-[#DAA520] hover:bg-[#B8860B] text-black font-black py-8 rounded-2xl gap-3 transition-all hover:scale-[1.02] shadow-xl">
                  <Send className="w-5 h-5" /> TRANSMITIR AL EQUIPO
                </Button>
               </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <Pin className="w-5 h-5 text-indigo-400 rotate-45" />
                    <span className="font-black text-white text-[11px] uppercase tracking-[0.3em]">Registro Logístico</span>
                 </div>
                 <Badge variant="outline" className="text-[7px] border-white/10 text-slate-500">SYNC: OK</Badge>
              </div>
              <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {anuncios.map((a: any) => (
                  <div key={a.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl animate-ag-fade-in">
                    <p className="text-[12px] text-slate-300 font-bold leading-relaxed">{a.texto}</p>
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                      <span className="text-[9px] text-[#DAA520] font-black uppercase tracking-widest">{a.autor}</span>
                      <span className="text-[9px] text-slate-600 font-medium italic">{a.hora}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL CONSOLA AGENTE AUTÓNOMO ── */}
      {agenteActivo && modalAgente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-ag-fade-in">
          <div className={cn(
            "relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-2xl border-2 rounded-[3.5rem] overflow-hidden shadow-2xl transition-all duration-500",
            modalAgente.bg.split(' ')[1]
          )}>
            {/* Header Modal */}
            <div className="bg-white/5 px-10 py-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  {(() => {
                    const Icon = ICON_MAP[agenteActivo] || Brain;
                    return <Icon className={cn("w-6 h-6", modalAgente.color)} />;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                    {modalAgente.nombre}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                    Terminal de Enlace Directo • {modalAgente.cargo}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setAgenteActivo(null)}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cuerpo Modal */}
            <div className="p-10 space-y-8">
              <div className="min-h-[150px] max-h-[300px] overflow-y-auto bg-black/40 rounded-3xl p-6 border border-white/5">
                {respuestaAgente ? (
                  <p className="text-sm text-slate-300 font-medium leading-relaxed italic whitespace-pre-wrap">
                    {respuestaAgente}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 font-bold uppercase tracking-widest text-center mt-12 italic">
                    Esperando misión táctica...
                  </p>
                )}
              </div>

              {/* Botones de Plantilla (Preechos) */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block ml-2 mb-2">Misiones Tácticas (Plantillas)</span>
                <div className="flex flex-wrap gap-2">
                  {modalAgente.plantillas.map((plantilla, idx) => (
                    <Button 
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPromptAgente(plantilla);
                        // Ejecución automática inmediata
                        setTimeout(() => handleConsultarAgente(), 100);
                      }}
                      className="text-[9px] font-black uppercase bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/50 rounded-xl px-4 py-3 transition-all"
                    >
                      {plantilla}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <Textarea 
                    placeholder={`¿Cuál es su orden para ${modalAgente.nombre}?`}
                    value={promptAgente}
                    onChange={(e) => setPromptAgente(e.target.value)}
                    className="bg-white/5 border-white/10 text-lg p-6 rounded-3xl min-h-[100px] focus:ring-1 ring-indigo-500/30 resize-none outline-none"
                    disabled={estaCargandoAgente}
                  />
                  <div className="absolute top-4 right-4 animate-ag-pulse">
                    <MsgIcon className="w-5 h-5 text-indigo-500/40" />
                  </div>
                </div>

                <Button 
                  onClick={handleConsultarAgente}
                  disabled={!promptAgente.trim() || estaCargandoAgente}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-8 rounded-3xl gap-3 shadow-xl transition-all"
                >
                  {estaCargandoAgente ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> PROCESANDO INFORME...</>
                  ) : (
                    <><Send className="w-5 h-5" /> EJECUTAR ESPECIALIDAD</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
