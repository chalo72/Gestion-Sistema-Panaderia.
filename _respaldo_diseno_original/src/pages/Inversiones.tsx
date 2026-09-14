import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Target, PlusCircle, BrainCircuit, Rocket, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  getMetasInversion, addMetaInversion, aportarAMeta, deleteMetaInversion, type MetaInversion 
} from '@/lib/inversiones-store';
import { getBovedas, addMovimientoBoveda, type Boveda } from '@/lib/boveda-store';
import { consultarAgente } from '@/constants/agentes';

export default function InversionesPage() {
  const [metas, setMetas] = useState<MetaInversion[]>([]);
  const [bovedas, setBovedas] = useState<Boveda[]>([]);
  
  // Modals
  const [showNuevaMeta, setShowNuevaMeta] = useState(false);
  const [showAportar, setShowAportar] = useState(false);
  const [showAuditoria, setShowAuditoria] = useState(false);
  
  // States IA
  const [pidiendoIA, setPidiendoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState('');

  // Forms
  const [nuevaMetaForm, setNuevaMetaForm] = useState({ nombre: '', objetivo: '' });
  const [aporteForm, setAporteForm] = useState({ metaId: '', bovedaOrigen: '', monto: '' });

  const loadData = () => {
    setMetas(getMetasInversion());
    setBovedas(getBovedas());
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInvertido = useMemo(() => metas.reduce((acc, m) => acc + m.acumulado, 0), [metas]);
  const totalObjetivos = useMemo(() => metas.reduce((acc, m) => acc + m.objetivo, 0), [metas]);
  const porcentajeGlobal = totalObjetivos > 0 ? (totalInvertido / totalObjetivos) * 100 : 0;

  const handleCrearMeta = () => {
    if (!nuevaMetaForm.nombre.trim()) return toast.error('El nombre es requerido');
    const obj = parseFloat(nuevaMetaForm.objetivo);
    if (!obj || obj <= 0) return toast.error('Objetivo inválido');

    addMetaInversion({ nombre: nuevaMetaForm.nombre, objetivo: obj });
    setShowNuevaMeta(false);
    setNuevaMetaForm({ nombre: '', objetivo: '' });
    loadData();
    toast.success('Meta de crecimiento creada');
  };

  const handleAportar = () => {
    const monto = parseFloat(aporteForm.monto);
    if (!monto || monto <= 0) return toast.error('Monto inválido');
    if (!aporteForm.metaId || !aporteForm.bovedaOrigen) return toast.error('Seleccione meta y origen');

    const bOrigen = bovedas.find(b => b.id === aporteForm.bovedaOrigen);
    if (!bOrigen || bOrigen.saldo < monto) return toast.error('Fondos insuficientes en la bóveda');

    // 1. Descontar de la bóveda (Registrar egreso)
    addMovimientoBoveda({
      bovedaOrigenId: bOrigen.id,
      monto,
      motivo: `Aporte a meta de inversión: ${metas.find(m => m.id === aporteForm.metaId)?.nombre}`,
      tipo: 'Egreso',
      usuarioResponsable: 'Sistema de Inversión',
      metodoPago: 'Transferencia'
    });

    // 2. Sumar a la meta
    aportarAMeta(aporteForm.metaId, monto);

    setShowAportar(false);
    setAporteForm({ metaId: '', bovedaOrigen: '', monto: '' });
    loadData();
    toast.success('Aporte realizado con éxito. ¡Vamos creciendo!');
  };

  const pedirAsesoriaIA = async () => {
    setShowAuditoria(true);
    setPidiendoIA(true);
    setAnalisisIA('');
    try {
      const contexto = JSON.stringify({
        totalInvertido,
        totalObjetivos,
        metas: metas.map(m => ({ nombre: m.nombre, progreso: `${((m.acumulado/m.objetivo)*100).toFixed(1)}%`, faltante: m.objetivo - m.acumulado })),
        bovedasLiquidez: bovedas.map(b => ({ nombre: b.nombre, saldo: b.saldo }))
      });
      const prompt = `Eres NEXUS-INVERSIÓN, el asesor de crecimiento. El portafolio tiene $${totalInvertido} invertidos de un objetivo de $${totalObjetivos}. Revisa las metas y el flujo de liquidez actual en el contexto. Dame consejos directos, agresivos pero seguros sobre si deberíamos acelerar una inversión, pausar y ahorrar liquidez, o si ya podemos ejecutar una de las metas (si llegó al 100%). Usa viñetas y emojis.`;
      
      await consultarAgente(
        'inversion',
        prompt,
        (chunk) => {
            setAnalisisIA(prev => prev + chunk);
        },
        undefined,
        contexto
      );
    } catch (error) {
        toast.error('Error al consultar a la IA de inversión');
    } finally {
        setPidiendoIA(false);
    }
  };

  const pedirEstrategiaMeta = async (meta: MetaInversion) => {
    setShowAuditoria(true);
    setPidiendoIA(true);
    setAnalisisIA('');
    try {
      const faltante = meta.objetivo - meta.acumulado;
      const prompt = `Eres NEXUS-INVERSIÓN, en MODO ESTRICTO. La meta '${meta.nombre}' necesita $${meta.objetivo}, pero apenas tenemos $${meta.acumulado} (faltan $${faltante}). 
      NO me digas que ahorre más. Dime CÓMO generar esos $${faltante} en la panadería esta misma semana.
      Ejemplo: 'Sube $200 el pan de bono', 'Crea una promo de desayuno que cueste $5,000 y vende 50 diarias', etc.
      Dame un plan de guerra agresivo en 3 pasos con viñetas y números claros para la panadería.`;
      
      await consultarAgente(
        'inversion',
        prompt,
        (chunk) => {
            setAnalisisIA(prev => prev + chunk);
        }
      );
    } catch (error) {
        toast.error('Error al consultar a la IA de inversión');
    } finally {
        setPidiendoIA(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 animate-ag-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-none">Inversión y Crecimiento</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">El motor de riqueza y expansión de tu negocio</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={pedirAsesoriaIA} className="rounded-xl font-black text-xs uppercase h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <BrainCircuit className="w-4 h-4" /> Asesoría IA
            </Button>
            <Button onClick={() => setShowAportar(true)} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2">
              <Rocket className="w-4 h-4" /> Aportar a Meta
            </Button>
            <Button onClick={() => setShowNuevaMeta(true)} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-slate-200 hover:bg-slate-50">
              <PlusCircle className="w-4 h-4 mr-2" /> Nueva Meta
            </Button>
          </div>
        </div>

        {/* DASHBOARD PRINCIPAL */}
        <Card className="border-0 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl overflow-hidden relative shadow-xl shadow-emerald-200 dark:shadow-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:w-1/2">
              <p className="text-emerald-200 font-black uppercase tracking-widest text-xs mb-2">Total en Fondo de Crecimiento</p>
              <h2 className="text-5xl font-black tracking-tight">{formatCurrency(totalInvertido)}</h2>
              <div className="mt-4 flex items-center gap-4 text-emerald-100 text-sm font-bold">
                <span>Objetivo Global: {formatCurrency(totalObjetivos)}</span>
                <span className="flex-1 h-2 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${porcentajeGlobal}%` }} />
                </span>
                <span>{porcentajeGlobal.toFixed(0)}%</span>
              </div>
            </div>
            <div className="w-full md:w-auto bg-black/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h3 className="font-black text-sm uppercase mb-2 flex items-center gap-2"><Target className="w-4 h-4"/> Regla de Oro</h3>
              <p className="text-xs text-emerald-100 font-medium leading-relaxed max-w-xs">
                Acostúmbrate a separar el <strong>10% al 15%</strong> de tu Ganancia Neta cada mes y transfiérelo aquí. Este dinero es intocable y solo se usará para expandir la capacidad del negocio.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* METAS */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">Portafolio de Metas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metas.map(meta => {
              const porcentaje = Math.min((meta.acumulado / meta.objetivo) * 100, 100);
              const completada = meta.acumulado >= meta.objetivo;
              
              return (
                <Card key={meta.id} className={`rounded-3xl border shadow-sm transition-all ${completada ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-800'}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                          {meta.nombre}
                          {completada && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        </h4>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Creada: {new Date(meta.fechaCreacion).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteMetaInversion(meta.id)} className="text-slate-400 hover:text-rose-500 -mt-2 -mr-2"><span className="sr-only">Borrar</span>×</Button>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-sm mb-2 font-black">
                        <span className={completada ? 'text-emerald-600' : 'text-indigo-600'}>{formatCurrency(meta.acumulado)}</span>
                        <span className="text-slate-400">{formatCurrency(meta.objetivo)}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${completada ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                          style={{ width: `${porcentaje}%` }} 
                        />
                      </div>
                      
                      {!completada && (
                        <Button 
                          onClick={() => pedirEstrategiaMeta(meta)}
                          variant="outline" 
                          className="w-full mt-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 text-xs font-black uppercase tracking-widest gap-2"
                        >
                          <BrainCircuit className="w-4 h-4" /> ¿Cómo consigo lo que falta?
                        </Button>
                      )}

                      {completada && (
                        <p className="text-xs text-emerald-600 font-bold mt-3 bg-emerald-100 p-2 rounded-lg text-center animate-pulse">
                          🎉 ¡Meta alcanzada! Lista para ejecutar.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            
            {metas.length === 0 && (
              <div className="col-span-1 md:col-span-2 p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">No tienes metas de crecimiento</h3>
                <p className="text-sm font-bold text-slate-500 max-w-md mx-auto">Crea tu primera meta (ej. Nuevo Horno, Apertura Sede 2) y empieza a separar capital para el futuro.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL NUEVA META */}
      <Dialog open={showNuevaMeta} onOpenChange={setShowNuevaMeta}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nueva Meta de Crecimiento</DialogTitle>
            <DialogDescription>¿En qué vamos a invertir el próximo capital?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Nombre del Proyecto / Inversión</Label>
              <Input value={nuevaMetaForm.nombre} onChange={e => setNuevaMetaForm(p => ({...p, nombre: e.target.value}))} placeholder="Ej: Nuevo Horno Industrial, Sede 2" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Costo Estimado (Objetivo)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <Input type="number" min="0" value={nuevaMetaForm.objetivo} onChange={e => setNuevaMetaForm(p => ({...p, objetivo: e.target.value}))} placeholder="0" className="h-12 rounded-xl pl-8 text-lg font-black" />
              </div>
            </div>
            <Button onClick={handleCrearMeta} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase mt-4">Crear Meta</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL APORTAR */}
      <Dialog open={showAportar} onOpenChange={setShowAportar}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Mover capital al crecimiento</DialogTitle>
            <DialogDescription>Toma dinero de tus bóvedas y guárdalo intocable para una meta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-rose-500">¿De dónde sale la plata?</Label>
              <Select value={aporteForm.bovedaOrigen} onValueChange={v => setAporteForm(p => ({...p, bovedaOrigen: v}))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione bóveda de origen" /></SelectTrigger>
                <SelectContent>
                  {bovedas.filter(b => b.saldo > 0).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre} (Disp: {formatCurrency(b.saldo)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-center py-2"><ArrowRight className="text-slate-300" /></div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-emerald-500">¿A qué meta va?</Label>
              <Select value={aporteForm.metaId} onValueChange={v => setAporteForm(p => ({...p, metaId: v}))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione la meta" /></SelectTrigger>
                <SelectContent>
                  {metas.filter(m => m.acumulado < m.objetivo).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nombre} (Falta {formatCurrency(m.objetivo - m.acumulado)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 mt-4">
              <Label className="text-xs font-black uppercase">Monto a retener</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <Input type="number" min="0" value={aporteForm.monto} onChange={e => setAporteForm(p => ({...p, monto: e.target.value}))} placeholder="0" className="h-12 rounded-xl pl-8 text-lg font-black" />
              </div>
            </div>
            <Button onClick={handleAportar} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase mt-4">Transferir a Inversión</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL IA */}
      <Dialog open={showAuditoria} onOpenChange={setShowAuditoria}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="shrink-0 border-b border-slate-800 pb-4">
            <DialogTitle className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="w-6 h-6"/> NEXUS-INVERSIÓN
            </DialogTitle>
            <DialogDescription className="text-slate-400">Tu socio estratégico de crecimiento</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6 px-1">
            {pidiendoIA ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold animate-pulse">Analizando portafolio y proyecciones...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-indigo max-w-none text-sm font-medium leading-relaxed whitespace-pre-wrap">
                {analisisIA}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
