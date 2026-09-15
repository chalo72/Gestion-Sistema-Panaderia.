import React, { useState } from 'react';
import { Cake, Plus, FileText, Check, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Piñatería Escorpioncito Inventory
const PINATERIA_ITEMS = [
  { id: 't1', nombre: 'Topper Personalizado', precio: 15000 },
  { id: 'v1', nombre: 'Vejigas Individuales (x1)', precio: 500 },
  { id: 'p1', nombre: 'Paca de Vejigas', precio: 12000 },
  { id: 'm1', nombre: 'Mantel Decorativo', precio: 8000 },
  { id: 'c1', nombre: 'Cortina Brillante', precio: 10000 },
  { id: 'vl1', nombre: 'Velas Mágicas (Paq)', precio: 3000 },
  { id: 'vc1', nombre: 'Volcán', precio: 2500 },
  { id: 'nv1', nombre: 'Número en Vela', precio: 4000 },
  { id: 'ni1', nombre: 'Número Inflable', precio: 7000 },
];

export default function PedidosTortas() {
  const [cliente, setCliente] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [tortaBase, setTortaBase] = useState({ sabor: '', porciones: '', precio: '' });
  const [adicionales, setAdicionales] = useState<{id: string, nombre: string, cantidad: number, precio: number}[]>([]);

  const totalBase = parseFloat(tortaBase.precio) || 0;
  const totalAdicionales = adicionales.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const granTotal = totalBase + totalAdicionales;

  const addAdicional = (itemId: string) => {
    const item = PINATERIA_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    
    setAdicionales(prev => {
      const exists = prev.find(p => p.id === itemId);
      if (exists) {
        return prev.map(p => p.id === itemId ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { ...item, cantidad: 1 }];
    });
  };

  const removeAdicional = (itemId: string) => {
    setAdicionales(prev => prev.filter(p => p.id !== itemId));
  };

  const handleImprimirTicket = () => {
    if (!cliente || !tortaBase.sabor || !tortaBase.precio) {
      toast.error('Faltan datos clave (Cliente, Sabor o Precio Base)');
      return;
    }
    toast.success('Ticket enviado a impresión para la pastelera.');
    // En una app real, aquí se dispara window.print() o API a ticketera térmica
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
            <Cake className="w-6 h-6" />
          </div>
          Cotizador y Pedidos de Tortas
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Crea cotizaciones exactas incluyendo adornos de Piñatería Escorpioncito y genera tickets para producción.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lado Izquierdo: Formulario */}
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-sm text-orange-500 flex items-center gap-2">
                1. Datos Básicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente / WhatsApp</Label>
                  <Input placeholder="Ej. Maria 310..." value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Entrega</Label>
                  <Input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="space-y-2 col-span-2">
                  <Label>Sabor / Diseño Base</Label>
                  <Input placeholder="Torta 3 Leches, diseño Paw Patrol..." value={tortaBase.sabor} onChange={e => setTortaBase({...tortaBase, sabor: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Precio Base</Label>
                  <Input type="number" placeholder="" value={tortaBase.precio} onChange={e => setTortaBase({...tortaBase, precio: e.target.value})} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-sm text-indigo-500 flex items-center gap-2">
                2. Adicionales (Piñatería Escorpioncito)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PINATERIA_ITEMS.map(item => (
                  <Button 
                    key={item.id} 
                    variant="outline" 
                    size="sm"
                    className="h-auto py-2 flex flex-col items-start text-left border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 dark:border-slate-800 dark:hover:border-indigo-500"
                    onClick={() => addAdicional(item.id)}
                  >
                    <span className="font-bold text-xs truncate w-full">{item.nombre}</span>
                    <span className="text-[10px] text-slate-500"></span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lado Derecho: Resumen y Ticket */}
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-yellow-50/50 dark:bg-yellow-900/10">
            <CardHeader className="bg-yellow-100/50 dark:bg-yellow-900/30 border-b border-yellow-200/50 dark:border-yellow-800/50">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-800 dark:text-yellow-500">
                <FileText className="w-4 h-4" /> Resumen de Cotización
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{tortaBase.sabor || 'Torta Base'}</p>
                  <p className="text-xs text-slate-500">Cliente: {cliente || '---'}</p>
                </div>
                <p className="font-black"></p>
              </div>

              {adicionales.length > 0 && (
                <div className="space-y-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adicionales</p>
                  {adicionales.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 rounded text-xs font-bold">{item.cantidad}x</span>
                        <span>{item.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span></span>
                        <button onClick={() => removeAdicional(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <p className="text-lg font-black text-slate-800 dark:text-slate-200">GRAN TOTAL</p>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-500"></p>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-800 gap-3">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={handleImprimirTicket}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Comanda
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
