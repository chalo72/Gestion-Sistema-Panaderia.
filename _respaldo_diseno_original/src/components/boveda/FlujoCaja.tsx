import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertCircle, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { getCompromisos } from '@/lib/finanzas-personales';
import { type Boveda } from '@/lib/boveda-store';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db } from '@/lib/database';
import { Switch } from '@/components/ui/switch';

export function FlujoCajaProyector({ bovedas }: { bovedas: Boveda[] }) {
  const [compromisos, setCompromisos] = useState(getCompromisos());
  const [promedioVentas, setPromedioVentas] = useState(0);
  const [usarProyeccionVentas, setUsarProyeccionVentas] = useState(true);

  useEffect(() => {
    setCompromisos(getCompromisos());
    
    // Calcular promedio de ventas (Oráculo predictivo)
    db.getAllVentas().then(ventas => {
      if (!ventas || ventas.length === 0) return;
      const hoy = new Date();
      const hace7Dias = new Date(hoy);
      hace7Dias.setDate(hoy.getDate() - 7);
      
      const ventasRecientes = ventas.filter((v: any) => new Date(v.fecha) >= hace7Dias);
      const totalReciente = ventasRecientes.reduce((acc, v: any) => acc + (v.total || 0), 0);
      
      const diasConVentas = new Set(ventasRecientes.map((v: any) => v.fecha.substring(0, 10))).size || 1;
      setPromedioVentas(totalReciente / diasConVentas);
    }).catch(console.error);
  }, []);

  const totalCaja = bovedas
    .filter(b => b.tipo !== 'Provisión')
    .reduce((acc, b) => acc + (Number(b.saldo) || 0), 0);

  const totalProvisionado = bovedas
    .filter(b => b.tipo === 'Provisión')
    .reduce((acc, b) => acc + (Number(b.saldo) || 0), 0);

  // Proyección a 30 días
  const proyeccion = useMemo(() => {
    const data = [];
    let saldoSimulado = totalCaja;
    
    const hoy = new Date();
    
    for (let i = 0; i < 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const dia = fecha.getDate();
      
      const compromisosHoy = compromisos.filter(c => c.activo && c.diaDeCobro === dia);
      const totalCompromisosHoy = compromisosHoy.reduce((acc, c) => acc + c.monto, 0);

      // Ingresos proyectados (solo si el switch está encendido)
      const ingresosHoy = usarProyeccionVentas ? promedioVentas : 0;

      saldoSimulado += ingresosHoy;
      saldoSimulado -= totalCompromisosHoy;

      data.push({
        fecha: fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        saldo: saldoSimulado,
        salidas: totalCompromisosHoy,
        ingresos: ingresosHoy
      });
    }

    return data;
  }, [totalCaja, compromisos, promedioVentas, usarProyeccionVentas]);

  const diasHastaQuiebre = proyeccion.findIndex(p => p.saldo < 0);
  const estaEnPeligro = diasHastaQuiebre !== -1 && diasHastaQuiebre <= 15;

  const totalCompromisosActivos = compromisos.filter(c => c.activo).reduce((sum, c) => sum + c.monto, 0);
  const faltanteProvision = Math.max(0, totalCompromisosActivos - totalProvisionado);

  return (
    <div className="space-y-6">
      
      {estaEnPeligro ? (
        <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-800 font-bold">Peligro de Iliquidez en {diasHastaQuiebre} días</AlertTitle>
          <AlertDescription className="text-red-700 font-medium">
            Tus compromisos fijos consumirán tu caja libre. Considera separar dinero en Sobres de Provisión o acelerar ventas.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-800 font-bold">Liquidez Saludable</AlertTitle>
          <AlertDescription className="text-emerald-700 font-medium">
            Tienes suficiente dinero libre para cubrir tus compromisos fijos de los próximos 30 días.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center space-x-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
        <Switch 
          checked={usarProyeccionVentas} 
          onCheckedChange={setUsarProyeccionVentas} 
        />
        <div>
          <p className="text-sm font-bold text-blue-900">Proyector de Liquidez Predictivo (Oráculo)</p>
          <p className="text-xs text-blue-700">
            {usarProyeccionVentas 
              ? `Simulando con ingresos proyectados diarios de ${formatCurrency(promedioVentas)}` 
              : 'Escenario pesimista (cero ventas futuras)'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Efectivo Total Neto</p>
            <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalCaja + totalProvisionado)}</h3>
            <p className="text-xs text-slate-400 mt-1">Caja + Banco + Provisiones</p>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-50 shadow-sm border-indigo-100 relative overflow-hidden">
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-2">Sobres Virtuales</p>
            <h3 className="text-3xl font-black text-indigo-900">{formatCurrency(totalProvisionado)}</h3>
            <p className="text-xs text-indigo-500 mt-1">De los {formatCurrency(totalCompromisosActivos)} de carga fija</p>
            
            <div className="w-full bg-indigo-200/50 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (totalProvisionado / (totalCompromisosActivos || 1)) * 100)}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Caja Libre Real</p>
            <h3 className="text-3xl font-black text-slate-900">{formatCurrency(Math.max(0, totalCaja - faltanteProvision))}</h3>
            <p className="text-xs text-slate-500 mt-1">Si separas lo que falta para tus fijos</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Radar de Liquidez a 30 Días (Oráculo Financiero)</CardTitle>
          <CardDescription>
            {usarProyeccionVentas 
              ? 'Simulación basada en tus compromisos fijos menos tu promedio de ventas recientes.' 
              : 'Escenario "Valle de la Muerte": asume cero ventas para ver cuánto sobrevive tu caja.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={proyeccion} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}}
                  tickFormatter={(val) => `$${(val/1000)}k`} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={2} />
                
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="#4f46e5" 
                  fillOpacity={1} 
                  fill="url(#colorSaldo)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
