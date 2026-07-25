import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Save, Calculator, Croissant } from 'lucide-react';
import { toast } from 'sonner';
import { generateUUID } from '@/lib/safe-utils';
import type { ModeloPan, FormulacionBase } from '@/types';
import { db } from '@/lib/database';

const ARROBA_GR = 12500; // 1 arroba = 12.5 kg = 12500 gr

interface ModeloPanModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaciones: FormulacionBase[];
  modeloBase?: Partial<ModeloPan>;
  onSuccess?: () => void;
}

export function ModeloPanModal({ isOpen, onClose, formulaciones, modeloBase, onSuccess }: ModeloPanModalProps) {
  const [nombre, setNombre] = useState('');
  const [formulacionId, setFormulacionId] = useState('');
  const [pesoUnitarioGr, setPesoUnitarioGr] = useState(80);
  const [precioVentaUnitario, setPrecioVentaUnitario] = useState(0);
  const [mermaEstimada, setMermaEstimada] = useState(5);
  const [piezasPorLata, setPiezasPorLata] = useState(12);

  useEffect(() => {
    if (isOpen) {
      if (modeloBase?.nombre) setNombre(modeloBase.nombre);
      else setNombre('');
      
      setFormulacionId(modeloBase?.formulacionId || '');
      setPesoUnitarioGr(modeloBase?.pesoUnitarioGr || 80);
      setPrecioVentaUnitario(modeloBase?.precioVentaUnitario || 0);
      setMermaEstimada(modeloBase?.mermaEstimada || 5);
      setPiezasPorLata(modeloBase?.piezasPorLata || 12);
    }
  }, [isOpen, modeloBase]);

  const formulacion = formulaciones.find(f => f.id === formulacionId);
  const costoArroba = formulacion?.costoTotalArroba || 0;
  
  // Cálculos reactivos
  const masaUtilArroba = ARROBA_GR * (1 - (mermaEstimada / 100));
  const panesPorArroba = pesoUnitarioGr > 0 ? Math.floor(masaUtilArroba / pesoUnitarioGr) : 0;
  const costoUnitario = panesPorArroba > 0 ? (costoArroba / panesPorArroba) : 0;
  const margenPorcentaje = precioVentaUnitario > 0 
    ? ((precioVentaUnitario - costoUnitario) / precioVentaUnitario) * 100 
    : 0;

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!formulacionId) {
      toast.error('Selecciona una formulación');
      return;
    }
    if (!pesoUnitarioGr || pesoUnitarioGr <= 0) {
      toast.error('El peso debe ser mayor a 0');
      return;
    }

    const modelo: ModeloPan = {
      id: modeloBase?.id || generateUUID(),
      nombre: nombre.trim(),
      formulacionId,
      pesoUnitarioGr,
      panesPorArroba,
      precioVentaUnitario,
      costoUnitario,
      margenPorcentaje,
      mermaEstimada,
      piezasPorLata,
      activo: true,
      createdAt: modeloBase?.createdAt || new Date().toISOString(),
    };

    try {
      if (modeloBase?.id) {
        await db.updateModeloPan(modelo.id, modelo);
        toast.success('Modelo actualizado correctamente');
      } else {
        await db.addModeloPan(modelo);
        toast.success('Modelo de pan creado correctamente');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error al guardar modelo');
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] bg-slate-50 dark:bg-slate-900 border-none p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
              <Croissant className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {modeloBase?.id ? 'Editar Modelo de Pan' : 'Nuevo Modelo de Pan'}
              </DialogTitle>
              <DialogDescription>
                Define las características, peso y piezas por lata para estandarizar la producción.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">Nombre del Modelo</label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pan Francés 80gr" className="rounded-xl" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold">Formulación Base (Receta Técnica)</label>
              <Select value={formulacionId} onValueChange={setFormulacionId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar receta técnica..." />
                </SelectTrigger>
                <SelectContent>
                  {formulaciones.filter(f => f.activo).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Peso por Unidad (gramos)</label>
              <Input type="number" value={pesoUnitarioGr} onChange={e => setPesoUnitarioGr(Number(e.target.value))} className="rounded-xl" />
              <p className="text-[10px] text-muted-foreground">Peso final del pan horneado</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold">Precio Venta</label>
                <Input type="number" value={precioVentaUnitario} onChange={e => setPrecioVentaUnitario(Number(e.target.value))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Merma (%)</label>
                <Input type="number" value={mermaEstimada} onChange={e => setMermaEstimada(Number(e.target.value))} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Piezas por Lata / Bandeja</label>
              <Input type="number" value={piezasPorLata} onChange={e => setPiezasPorLata(Number(e.target.value))} className="rounded-xl" />
              <p className="text-[10px] text-muted-foreground">Cantidad de panes que caben en una lata estándar</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">Rendimiento Técnico</span>
              <Calculator className="w-5 h-5 text-pink-400" />
            </div>

            <div className="text-center py-4 border-y border-slate-700">
              <p className="text-4xl font-black text-pink-400">{panesPorArroba}</p>
              <p className="text-sm text-slate-400">panes por arroba</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Masa por arroba:</span>
                <span className="font-bold">{ARROBA_GR.toLocaleString()}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Merma ({mermaEstimada}%):</span>
                <span className="font-bold text-red-400">-{((ARROBA_GR * mermaEstimada) / 100).toFixed(0)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Masa útil:</span>
                <span className="font-bold text-emerald-400">{(ARROBA_GR * (1 - mermaEstimada / 100)).toFixed(0)}g</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-400">Costo Unitario:</span>
                <span className="font-bold text-orange-400">${costoUnitario.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Margen Bruto:</span>
                <span className="font-bold text-emerald-400">{margenPorcentaje.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 flex justify-end gap-3 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl gap-2 shadow-lg shadow-pink-500/20">
            <Save className="w-4 h-4" /> Guardar Modelo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
