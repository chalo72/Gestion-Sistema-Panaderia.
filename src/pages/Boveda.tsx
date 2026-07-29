import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, ArrowRightLeft, TrendingDown, TrendingUp, PiggyBank, Building2, PlusCircle, History, AlertCircle, CheckCircle, BrainCircuit, Bot, Download, Upload } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getBovedas, addBoveda,
  getMovimientosBoveda, addMovimientoBoveda,
  exportBovedaBackup, importBovedaBackup,
  type Boveda, type MovimientoBoveda, type TipoMovimientoBoveda 
} from '@/lib/boveda-store';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { consultarAgente } from '@/constants/agentes';

export default function BovedaPage() {
  const { usuario } = useAuth();
  const [bovedas, setBovedas] = useState<Boveda[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoBoveda[]>([]);
  
  // Modal states
  const [showNuevaBoveda, setShowNuevaBoveda] = useState(false);
  const [showMovimiento, setShowMovimiento] = useState(false);
  const [tipoMov, setTipoMov] = useState<TipoMovimientoBoveda>('Ingreso');

  // Form states
  const [nuevaBovedaNombre, setNuevaBovedaNombre] = useState('');
  const [nuevaBovedaTipo, setNuevaBovedaTipo] = useState<'Base' | 'Banco' | 'Caja Fuerte' | 'Otro'>('Base');

  const [movForm, setMovForm] = useState({
    origen: '',
    destino: '',
    monto: '',
    motivo: '',
    metodoPago: 'Efectivo'
  });

  // Auditoria IA
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [pidiendoIA, setPidiendoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState('');

  // Conciliación
  const [showConciliacion, setShowConciliacion] = useState(false);
  const [conciliarBoveda, setConciliarBoveda] = useState('');
  const [saldoFisico, setSaldoFisico] = useState('');

  // Cargar datos
  const loadData = () => {
    setBovedas(getBovedas());
    setMovimientos(getMovimientosBoveda());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportarRespaldo = () => {
    try {
      const json = exportBovedaBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boveda-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Respaldo descargado — guárdalo en otro lugar seguro');
    } catch {
      toast.error('No se pudo exportar el respaldo');
    }
  };

  const handleImportarRespaldo = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = importBovedaBackup(text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      loadData();
      toast.success('Respaldo restaurado en este aparato');
    };
    reader.onerror = () => toast.error('No se pudo leer el archivo');
    reader.readAsText(file);
  };

  const totalGlobal = useMemo(() => bovedas.reduce((acc, b) => acc + b.saldo, 0), [bovedas]);

  // Gráfico de flujo de caja (últimos 7 días)
  const chartData = useMemo(() => {
    const data: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      
      const movsDia = movimientos.filter(m => {
        const mDate = new Date(m.fecha);
        return mDate.getDate() === d.getDate() && mDate.getMonth() === d.getMonth();
      });

      const ingresos = movsDia.filter(m => m.tipo === 'Ingreso').reduce((sum, m) => sum + m.monto, 0);
      const egresos = movsDia.filter(m => m.tipo === 'Egreso').reduce((sum, m) => sum + m.monto, 0);

      data.push({
        fecha: dateStr,
        Ingresos: ingresos,
        Egresos: egresos
      });
    }
    return data;
  }, [movimientos]);

  const handleCrearBoveda = () => {
    if (!nuevaBovedaNombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    addBoveda({ nombre: nuevaBovedaNombre, tipo: nuevaBovedaTipo });
    setShowNuevaBoveda(false);
    setNuevaBovedaNombre('');
    loadData();
    toast.success('Nueva bóveda creada exitosamente');
  };

  const handleRegistrarMovimiento = () => {
    const m = parseFloat(movForm.monto);
    if (!m || m <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    if (!movForm.motivo.trim()) {
      toast.error('El motivo es obligatorio');
      return;
    }

    if (tipoMov === 'Transferencia' && (!movForm.origen || !movForm.destino)) {
      toast.error('Seleccione origen y destino');
      return;
    }
    if (tipoMov === 'Egreso' && !movForm.origen) {
      toast.error('Seleccione la bóveda de origen');
      return;
    }
    if (tipoMov === 'Ingreso' && !movForm.destino) {
      toast.error('Seleccione la bóveda de destino');
      return;
    }

    // Validar fondos
    if (tipoMov === 'Transferencia' || tipoMov === 'Egreso') {
      const bOrigen = bovedas.find(b => b.id === movForm.origen);
      if (bOrigen && bOrigen.saldo < m) {
        toast.error(`Fondos insuficientes en ${bOrigen.nombre}`);
        return;
      }
    }

    addMovimientoBoveda({
      bovedaOrigenId: movForm.origen || undefined,
      bovedaDestinoId: movForm.destino || undefined,
      monto: m,
      motivo: movForm.motivo,
      tipo: tipoMov,
      usuarioResponsable: usuario?.nombre || 'Administrador',
      metodoPago: movForm.metodoPago
    });

    setShowMovimiento(false);
    setMovForm({ origen: '', destino: '', monto: '', motivo: '', metodoPago: 'Efectivo' });
    loadData();
    toast.success(`${tipoMov} registrado exitosamente`);
  };

  const pedirAuditoriaIA = async () => {
    setShowAuditoria(true);
    setPidiendoIA(true);
    setAnalisisIA('');
    try {
      const contexto = JSON.stringify({
        saldoTotal: totalGlobal,
        bovedas: bovedas.map(b => ({ nombre: b.nombre, saldo: b.saldo, tipo: b.tipo })),
        ultimosMovimientos: movimientos.slice(0, 15).map(m => ({ 
          tipo: m.tipo, 
          monto: m.monto, 
          motivo: m.motivo, 
          fecha: new Date(m.fecha).toLocaleDateString() 
        }))
      });
      const prompt = `Actúa como el Auditor Contable (Banco Interno). Analiza la bóveda y tesorería actual. Saldo total disponible: $${totalGlobal}. Tenemos ${bovedas.length} cuentas/cajas activas. Te envié el historial de movimientos recientes en tu contexto. Dame un análisis financiero breve y contundente sobre nuestra liquidez, alerta sobre gastos sospechosos o altos, y sugiere cómo proteger el dinero. Usa viñetas, emojis y negritas para una lectura rápida por el Gerente.`;
      
      await consultarAgente(
        'contable',
        prompt,
        (chunk) => {
            setAnalisisIA(prev => prev + chunk);
        },
        undefined,
        contexto
      );
    } catch (error) {
        toast.error('Error al consultar a la IA contable');
        console.error(error);
    } finally {
        setPidiendoIA(false);
    }
  };

  const handleConciliar = () => {
    const fisico = parseFloat(saldoFisico);
    if (isNaN(fisico) || fisico < 0) {
      toast.error('Ingrese un saldo físico válido');
      return;
    }
    if (!conciliarBoveda) {
      toast.error('Seleccione una bóveda a conciliar');
      return;
    }
    
    const bOrigen = bovedas.find(b => b.id === conciliarBoveda);
    if (!bOrigen) return;

    const diferencia = fisico - bOrigen.saldo;
    
    if (diferencia === 0) {
      toast.success('¡Perfecto! La caja está cuadrada a cero.');
      setShowConciliacion(false);
      return;
    }

    const tipo = diferencia > 0 ? 'Ingreso' : 'Egreso';
    const monto = Math.abs(diferencia);
    const motivo = diferencia > 0 ? 'Sobrante en Arqueo/Conciliación' : 'Faltante en Arqueo/Conciliación';

    addMovimientoBoveda({
      bovedaDestinoId: tipo === 'Ingreso' ? conciliarBoveda : undefined,
      bovedaOrigenId: tipo === 'Egreso' ? conciliarBoveda : undefined,
      monto,
      motivo,
      tipo,
      usuarioResponsable: usuario?.nombre || 'Auditor',
      metodoPago: 'Ajuste'
    });

    setShowConciliacion(false);
    setSaldoFisico('');
    setConciliarBoveda('');
    loadData();
    toast.info(`Conciliación realizada: ${tipo} de ${formatCurrency(monto)}`);
  };

  const getIcon = (tipo: string) => {
    switch(tipo) {
      case 'Caja Fuerte': return <Lock className="w-5 h-5" />;
      case 'Banco': return <Building2 className="w-5 h-5" />;
      default: return <PiggyBank className="w-5 h-5" />;
    }
  };

  const getBovedaNombre = (id?: string) => {
    if (!id) return '---';
    return bovedas.find(b => b.id === id)?.nombre || 'Bóveda Eliminada';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 animate-ag-fade-in">
      
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
              <Lock className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-none">Bóveda y Tesorería</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">Gestión del dinero físico y cuentas bancarias</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExportarRespaldo} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
              <Download className="w-4 h-4" /> Exportar
            </Button>
            <Button
              variant="outline"
              className="rounded-xl font-black text-xs uppercase h-11 border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
              onClick={() => document.getElementById('boveda-import-file')?.click()}
            >
              <Upload className="w-4 h-4" /> Importar
            </Button>
            <input
              id="boveda-import-file"
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                handleImportarRespaldo(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <Button onClick={pedirAuditoriaIA} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-2">
              <BrainCircuit className="w-4 h-4" /> Auditoría IA
            </Button>
            <Button onClick={() => setShowConciliacion(true)} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2">
              <CheckCircle className="w-4 h-4" /> Conciliar
            </Button>
            <Button onClick={() => setShowNuevaBoveda(true)} variant="outline" className="rounded-xl font-black text-xs uppercase h-11 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              <PlusCircle className="w-4 h-4 mr-2" /> Nueva Bóveda
            </Button>
            <Button onClick={() => { setTipoMov('Transferencia'); setShowMovimiento(true); }} className="rounded-xl font-black text-xs uppercase h-11 bg-indigo-600 hover:bg-indigo-700 text-white">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Transferir
            </Button>
          </div>
        </div>

        {/* Aviso: datos solo en este aparato */}
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-black text-amber-800 dark:text-amber-200">Solo en este celular o PC</p>
            <p className="text-xs font-medium text-amber-700/90 dark:text-amber-300/80 mt-0.5">
              La bóveda aún no se copia sola a la nube. Si cambias de aparato, usa Exportar aquí e Importar allá (como pasar la libreta de saldos).
            </p>
          </div>
        </div>

        {/* SALDO TOTAL */}
        <Card className="border-0 bg-gradient-to-br from-indigo-600 to-violet-800 text-white rounded-3xl overflow-hidden relative shadow-xl shadow-indigo-200 dark:shadow-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-indigo-200 font-black uppercase tracking-widest text-xs mb-2">Total Capital Disponible</p>
              <h2 className="text-5xl font-black tracking-tight">{formatCurrency(totalGlobal)}</h2>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button onClick={() => { setTipoMov('Ingreso'); setShowMovimiento(true); }} className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl font-black">
                <TrendingUp className="w-4 h-4 mr-2" /> Ingreso Extra
              </Button>
              <Button onClick={() => { setTipoMov('Egreso'); setShowMovimiento(true); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0 rounded-xl font-black">
                <TrendingDown className="w-4 h-4 mr-2" /> Registrar Gasto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GRILLA DE BÓVEDAS */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">Cuentas Internas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bovedas.map(boveda => (
              <Card key={boveda.id} className="rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center relative",
                        boveda.tipo === 'Caja Fuerte' ? "bg-amber-100 text-amber-600" :
                        boveda.tipo === 'Banco' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {boveda.saldo < 100000 && boveda.tipo === 'Base' && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900"></span>
                        )}
                        {getIcon(boveda.tipo)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white leading-tight">{boveda.nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          {boveda.tipo} 
                          {boveda.saldo < 100000 && boveda.tipo === 'Base' && <span className="text-rose-500">- Alerta Liquidez</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(boveda.saldo)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* GRÁFICO FLUJO DE CAJA */}
        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8 overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 bg-slate-50/50 dark:bg-slate-900/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" /> Flujo de Caja (Últimos 7 Días)
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest">Ingresos vs Egresos</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val/1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                  <Area type="monotone" dataKey="Egresos" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorEgresos)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* HISTORIAL DE MOVIMIENTOS */}
        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-black">Historial de Bóveda</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Registro inalterable de movimientos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {movimientos.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold">
                No hay movimientos registrados aún.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {movimientos.map(mov => (
                  <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        mov.tipo === 'Ingreso' ? "bg-emerald-100 text-emerald-600" :
                        mov.tipo === 'Egreso' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                      )}>
                        {mov.tipo === 'Ingreso' ? <TrendingUp className="w-4 h-4" /> :
                         mov.tipo === 'Egreso' ? <TrendingDown className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{mov.motivo}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {mov.tipo === 'Transferencia' 
                            ? `${getBovedaNombre(mov.bovedaOrigenId)} ➔ ${getBovedaNombre(mov.bovedaDestinoId)}`
                            : getBovedaNombre(mov.tipo === 'Ingreso' ? mov.bovedaDestinoId : mov.bovedaOrigenId)}
                          {' · '}{new Date(mov.fecha).toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-base font-black tabular-nums", 
                        mov.tipo === 'Ingreso' ? "text-emerald-600 dark:text-emerald-400" : 
                        mov.tipo === 'Egreso' ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                      )}>
                        {mov.tipo === 'Egreso' ? '-' : '+'}{formatCurrency(mov.monto)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{mov.usuarioResponsable}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* MODAL NUEVA BOVEDA */}
      <Dialog open={showNuevaBoveda} onOpenChange={setShowNuevaBoveda}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nueva Bóveda o Caja Fuerte</DialogTitle>
            <DialogDescription>Crea un nuevo espacio físico o virtual para guardar dinero.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Nombre de la Bóveda</Label>
              <Input value={nuevaBovedaNombre} onChange={e => setNuevaBovedaNombre(e.target.value)} placeholder="Ej: Base Tortas, Nequi Negocio..." className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Tipo</Label>
              <Select value={nuevaBovedaTipo} onValueChange={(v: any) => setNuevaBovedaTipo(v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Base">Base Física (Monedas/Billetes)</SelectItem>
                  <SelectItem value="Caja Fuerte">Caja Fuerte (Ahorro principal)</SelectItem>
                  <SelectItem value="Banco">Cuenta Bancaria (Nequi, Daviplata)</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCrearBoveda} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase mt-4">
              Crear Bóveda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL MOVIMIENTO (Ingreso/Egreso/Transferencia) */}
      <Dialog open={showMovimiento} onOpenChange={setShowMovimiento}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{tipoMov === 'Transferencia' ? 'Transferir Fondos' : tipoMov === 'Ingreso' ? 'Ingresar Dinero Extra' : 'Registrar Gasto de Bóveda'}</DialogTitle>
            <DialogDescription>
              {tipoMov === 'Transferencia' ? 'Mueve plata entre cajas fuertes sin alterar el total global.' : 
               tipoMov === 'Ingreso' ? 'Registra un dinero que entra directo a la bóveda (Ej: inyección de capital).' : 
               'Registra pagos o préstamos que salen del dinero guardado en la bóveda.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            {(tipoMov === 'Egreso' || tipoMov === 'Transferencia') && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-rose-500">¿De dónde sale la plata?</Label>
                <Select value={movForm.origen} onValueChange={v => setMovForm(p => ({...p, origen: v}))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione bóveda origen" /></SelectTrigger>
                  <SelectContent>
                    {bovedas.filter(b => b.saldo > 0 || tipoMov === 'Egreso').map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.nombre} ({formatCurrency(b.saldo)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(tipoMov === 'Ingreso' || tipoMov === 'Transferencia') && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-emerald-500">¿A dónde entra la plata?</Label>
                <Select value={movForm.destino} onValueChange={v => setMovForm(p => ({...p, destino: v}))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione bóveda destino" /></SelectTrigger>
                  <SelectContent>
                    {bovedas.filter(b => b.id !== movForm.origen).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <Input 
                  type="number" min="0" 
                  value={movForm.monto} 
                  onChange={e => setMovForm(p => ({...p, monto: e.target.value}))} 
                  placeholder="0" 
                  className="h-12 rounded-xl pl-8 text-lg font-black" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">Motivo o Concepto</Label>
              <Input 
                value={movForm.motivo} 
                onChange={e => setMovForm(p => ({...p, motivo: e.target.value}))} 
                placeholder={tipoMov === 'Transferencia' ? "Ej: Para tener base" : "Ej: Pago proveedor / Préstamo empleado"} 
                className="h-11 rounded-xl" 
              />
            </div>

            <Button onClick={handleRegistrarMovimiento} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase mt-4">
              Confirmar {tipoMov}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL CONCILIACIÓN */}
      <Dialog open={showConciliacion} onOpenChange={setShowConciliacion}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle className="w-5 h-5"/> Conciliación / Arqueo</DialogTitle>
            <DialogDescription>Verifica que el saldo en el sistema sea igual al dinero real físico o en el banco.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">¿Qué bóveda vas a contar?</Label>
              <Select value={conciliarBoveda} onValueChange={setConciliarBoveda}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione bóveda" /></SelectTrigger>
                <SelectContent>
                  {bovedas.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre} (Sistema: {formatCurrency(b.saldo)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">¿Cuánto dinero hay en realidad?</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <Input 
                  type="number" min="0" 
                  value={saldoFisico} 
                  onChange={e => setSaldoFisico(e.target.value)} 
                  placeholder="0" 
                  className="h-12 rounded-xl pl-8 text-lg font-black" 
                />
              </div>
              <p className="text-[10px] text-slate-500 font-bold px-1">Si hay descuadre, se creará un movimiento automático de "Ajuste".</p>
            </div>

            <Button onClick={handleConciliar} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase mt-4">
              Realizar Conciliación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL AUDITORÍA IA */}
      <Dialog open={showAuditoria} onOpenChange={setShowAuditoria}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="shrink-0 border-b border-slate-800 pb-4">
            <DialogTitle className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="w-6 h-6"/> NEXUS-VOLT (Banco Interno)
            </DialogTitle>
            <DialogDescription className="text-slate-400">Auditoría financiera automatizada</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-6 px-1">
            {pidiendoIA ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold animate-pulse">Analizando flujos y comisiones...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-indigo max-w-none text-sm font-medium leading-relaxed whitespace-pre-wrap">
                {analisisIA}
              </div>
            )}
          </div>
          
          {!pidiendoIA && (
            <div className="shrink-0 pt-4 border-t border-slate-800 flex justify-end">
              <Button onClick={() => setShowAuditoria(false)} className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white">
                Entendido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
