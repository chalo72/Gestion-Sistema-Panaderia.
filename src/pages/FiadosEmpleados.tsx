import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Camera, 
  Upload, 
  Trash2,
  Coffee,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import type { Trabajador } from '@/types';

export interface CreditoEmpleado {
  id: string;
  trabajadorId: string;
  trabajadorNombre: string;
  monto: number;
  descripcion: string;
  fotoUrl?: string;
  fecha: string;
  hora: string;
  estado: 'pendiente' | 'deducido';
}

interface FiadosEmpleadosProps {
  trabajadores?: Trabajador[];
  onAddGasto?: (g: any) => Promise<any>;
}

export default function FiadosEmpleados({ trabajadores = [] }: FiadosEmpleadosProps) {
  const [creditos, setCreditos] = useState<CreditoEmpleado[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dp_whatsapp_creditos_empleadas') || '[]');
    } catch { return []; }
  });
  const [nuevoCreditoTrabajador, setNuevoCreditoTrabajador] = useState('');
  const [nuevoCreditoMonto, setNuevoCreditoMonto] = useState('');
  const [nuevoCreditoDesc, setNuevoCreditoDesc] = useState('');
  const [nuevoCreditoFoto, setNuevoCreditoFoto] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('dp_whatsapp_creditos_empleadas', JSON.stringify(creditos));
  }, [creditos]);

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen debe pesar menos de 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNuevoCreditoFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCredito = () => {
    if (!nuevoCreditoTrabajador || !nuevoCreditoMonto) {
      toast.error('Selecciona la empleada y el monto.');
      return;
    }

    const t = trabajadores.find(tr => tr.id === nuevoCreditoTrabajador);
    const montoNum = parseFloat(nuevoCreditoMonto);

    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Monto inválido.');
      return;
    }

    const nuevo: CreditoEmpleado = {
      id: Date.now().toString(),
      trabajadorId: nuevoCreditoTrabajador,
      trabajadorNombre: t?.nombre || 'Desconocido',
      monto: montoNum,
      descripcion: nuevoCreditoDesc || 'Consumo interno',
      fotoUrl: nuevoCreditoFoto || undefined,
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      estado: 'pendiente'
    };

    setCreditos([nuevo, ...creditos]);
    setNuevoCreditoTrabajador('');
    setNuevoCreditoMonto('');
    setNuevoCreditoDesc('');
    setNuevoCreditoFoto(null);
    toast.success('Fiado/Consumo registrado con éxito.');
  };

  const marcarComoDeducido = (id: string) => {
    setCreditos(creditos.map(c => 
      c.id === id ? { ...c, estado: 'deducido' } : c
    ));
    toast.success('Marcado como deducido de la nómina.');
  };

  const eliminarCredito = (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este registro?')) {
      setCreditos(creditos.filter(c => c.id !== id));
      toast.success('Registro eliminado.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in zoom-in-95 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
              <Coffee className="w-6 h-6" />
            </div>
            Consumo y Fiados (Empleados)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registro rápido de consumos internos o préstamos para descontar en la próxima nómina.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO: REGISTRO */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="w-5 h-5" /> Registrar Fiado o Préstamo
              </CardTitle>
              <CardDescription>
                Puedes subir una foto del producto como evidencia.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Trabajadora / Empleada</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-800"
                  value={nuevoCreditoTrabajador}
                  onChange={e => setNuevoCreditoTrabajador(e.target.value)}
                >
                  <option value="">Selecciona empleada...</option>
                  {trabajadores.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Monto ($ COP)</Label>
                <Input 
                  type="number" 
                  placeholder="Ej: 25000" 
                  value={nuevoCreditoMonto}
                  onChange={e => setNuevoCreditoMonto(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Descripción (Producto)</Label>
                <Input 
                  placeholder="Ej: 2 Panes de Queso y 1 Gaseosa" 
                  value={nuevoCreditoDesc}
                  onChange={e => setNuevoCreditoDesc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Evidencia Fotográfica (Opcional)</Label>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors w-full">
                    <Camera className="w-4 h-4" /> 
                    {nuevoCreditoFoto ? 'Cambiar Foto' : 'Tomar / Subir Foto'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} />
                  </label>
                  {nuevoCreditoFoto && (
                    <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={nuevoCreditoFoto} alt="Evidencia" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleAddCredito} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-bold">
                Guardar Consumo Interno
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* PANEL DERECHO: HISTORIAL */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl h-full">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Historial de Consumos Activos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {creditos.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No hay consumos registrados pendientes.
                  </div>
                ) : (
                  creditos.map(c => (
                    <div key={c.id} className={\p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row gap-4 \\}>
                      {c.fotoUrl && (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img src={c.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {c.trabajadorNombre}
                            {c.estado === 'pendiente' ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pendiente</Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Deducido</Badge>
                            )}
                          </h4>
                          <span className="font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(c.monto)}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{c.descripcion}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
                          <span>{c.fecha} {c.hora}</span>
                          <div className="flex items-center gap-2 ml-auto">
                            {c.estado === 'pendiente' && (
                              <button onClick={() => marcarComoDeducido(c.id)} className="text-emerald-500 hover:text-emerald-600 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Saldar
                              </button>
                            )}
                            <button onClick={() => eliminarCredito(c.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
