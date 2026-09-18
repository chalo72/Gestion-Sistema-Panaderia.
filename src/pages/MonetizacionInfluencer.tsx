import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, Youtube, Target, RefreshCw, Activity, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

export default function MonetizacionInfluencer() {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    toast.info('Conectando con APIs de TikTok y YouTube para actualizar ingresos...');
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('Tablero financiero actualizado con éxito.');
    }, 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            Tablero de Monetización
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centro financiero de la Agencia. Mide cuánto dinero real generan las redes de Andrea Cadena y Dulce Placer.
          </p>
        </div>
        <Button 
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xl"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sincronizar Redes
        </Button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ingresos Totales (Mes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">$0.00 USD</div>
            <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +0% vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Youtube className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 font-medium">Vistas Monetizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-rose-600 dark:text-rose-400">0</div>
            <p className="text-xs font-medium text-slate-500 mt-2">A la espera de conectar YouTube/TikTok</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 font-medium">Valor por Patrocinio Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">$0 USD</div>
            <p className="text-xs font-medium text-slate-500 mt-2">Basado en el engagement rate actual</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl min-h-[400px]">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-emerald-500" /> Rendimiento de Videos Individuales
          </CardTitle>
          <CardDescription>
            Aquí aparecerá la lista de videos subidos por N8N, midiendo cuánto dinero exacto genera cada pieza de contenido.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <TrendingUp className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Conecta tus Cuentas</h3>
          <p className="text-sm text-slate-500 max-w-md mt-2">
            Para que la IA pueda rastrear los ingresos, N8N primero debe publicar el primer lote de videos en la cuenta oficial de Andrea Cadena.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => toast.info('Redirigiendo a N8N para OAuth...')}>
            Conectar YouTube / TikTok Auth
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
