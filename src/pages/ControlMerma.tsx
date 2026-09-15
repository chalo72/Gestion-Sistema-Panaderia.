import React, { useState } from 'react';
import { AlertOctagon, TrendingDown, Save, FileText, Check, MessageCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const MOTIVOS = [
  'Quemado en horno',
  'Mala formulación / Masa',
  'Sobrante del día anterior',
  'Caída / Accidente',
  'Vencido / Moho'
];

const PRODUCTOS_COMUNES = ['Pan de Queso', 'Pan Francés', 'Croissant', 'Torta Pequeña', 'Pan de Coco'];

export default function ControlMerma() {
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [notas, setNotas] = useState('');
  
  // Estado local para simular la tabla de registros
  const [registros, setRegistros] = useState<{
    id: string;
    producto: string;
    cantidad: number;
    motivo: string;
    fecha: string;
    notas: string;
  }[]>([
    { id: '1', producto: 'Pan de Queso', cantidad: 5, motivo: 'Quemado en horno', fecha: new Date().toISOString(), notas: 'Temperatura muy alta' }
  ]);

  const handleGuardar = () => {
    if (!producto || !cantidad || !motivo) {
      toast.error('Llena todos los campos obligatorios.');
      return;
    }
    
    const nuevoRegistro = {
      id: Date.now().toString(),
      producto,
      cantidad: parseInt(cantidad),
      motivo,
      fecha: new Date().toISOString(),
      notas
    };

    setRegistros([nuevoRegistro, ...registros]);
    toast.success('Merma registrada exitosamente.');
    
    // Limpiar formulario
    setProducto('');
    setCantidad('');
    setNotas('');
  };

  const hablarConSostenibilidad = () => {
    toast.success('Iniciando chat con IA de Sostenibilidad...', {
      description: 'Analizando patrones: 5 Panes de queso quemados. Sugerencia: Calibrar horno a 180°C.'
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
              <AlertOctagon className="w-6 h-6" />
            </div>
            Control de Mermas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registra los productos dañados o sobrantes para auditar el inventario y corregir fugas de dinero.
          </p>
        </div>
        <Button onClick={hablarConSostenibilidad} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg shadow-emerald-500/25">
          <MessageCircle className="w-4 h-4" />
          Consultar IA Sostenibilidad
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lado Izquierdo: Formulario de Registro */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm text-red-500 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Registrar Pérdida
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 pt-6">
              
              <div className="space-y-2">
                <Label>Producto Dañado *</Label>
                <Input 
                  placeholder="Ej. Pan de Queso" 
                  value={producto} 
                  onChange={e => setProducto(e.target.value)}
                  list="productos-comunes"
                />
                <datalist id="productos-comunes">
                  {PRODUCTOS_COMUNES.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad *</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={cantidad} 
                    onChange={e => setCantidad(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motivo *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-800"
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                  >
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas o Causa (Opcional)</Label>
                <Input 
                  placeholder="Ej. Se quemaron por descuido del hornero" 
                  value={notas} 
                  onChange={e => setNotas(e.target.value)} 
                />
              </div>

              <Button onClick={handleGuardar} className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-bold gap-2">
                <Save className="w-4 h-4" /> Guardar y Descontar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Lado Derecho: Historial y Estadísticas */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <Card className="bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-red-600/80 dark:text-red-400 uppercase">Pérdida Total (Semana)</p>
                   <p className="text-2xl font-black text-red-700 dark:text-red-500">
                     {registros.reduce((acc, r) => acc + r.cantidad, 0)} unid.
                   </p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                   <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/50">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-orange-600/80 dark:text-orange-400 uppercase">Causa Principal</p>
                   <p className="text-lg font-black text-orange-700 dark:text-orange-500 truncate max-w-[120px]">
                     {registros.length > 0 ? registros[0].motivo : 'N/A'}
                   </p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                   <AlertOctagon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                 </div>
               </CardContent>
             </Card>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" /> Historial de Fugas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-right">Cant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {registros.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors">
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(r.fecha).toLocaleDateString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{r.producto}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {r.motivo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                          -{r.cantidad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
