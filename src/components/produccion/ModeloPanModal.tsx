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
import { Save, Calculator, Package, Plus, Trash2 } from 'lucide-react';
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
  const [piezasPorLata, setPiezasPorLata] = useState(15);
  const [latasSimulador, setLatasSimulador] = useState(1);
  const [ingredientes, setIngredientes] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setNombre(modeloBase?.nombre || '');
      setFormulacionId(modeloBase?.formulacionId || '');
      setPesoUnitarioGr(modeloBase?.pesoUnitarioGr || 80);
      setPrecioVentaUnitario(modeloBase?.precioVentaUnitario || 0);
      setMermaEstimada(modeloBase?.mermaEstimada || 5);
      setPiezasPorLata(modeloBase?.piezasPorLata || 15);
      setIngredientes(modeloBase?.ingredientesAdicionales || []);
      setLatasSimulador(1);
    }
  }, [isOpen, modeloBase]);

  const formulacion = formulaciones.find(f => f.id === formulacionId);
  const costoArroba = formulacion?.costoTotalArroba || 0;
  
  // Cálculos reactivos
  const masaUtilArroba = ARROBA_GR * (1 - (mermaEstimada / 100));
  const panesPorArroba = pesoUnitarioGr > 0 ? Math.floor(masaUtilArroba / pesoUnitarioGr) : 0;
  
  // Costo Insumos
  const costoInsumosPorPan = ingredientes.reduce((sum, ing) => sum + (ing.costo || 0), 0);
  
  const costoUnitarioBase = panesPorArroba > 0 ? (costoArroba / panesPorArroba) : 0;
  const costoUnitarioTotal = costoUnitarioBase + costoInsumosPorPan;
  
  const margenPorcentaje = precioVentaUnitario > 0 
    ? ((precioVentaUnitario - costoUnitarioTotal) / precioVentaUnitario) * 100 
    : 0;

  const panesTotales = latasSimulador * piezasPorLata;
  const piqueTotalGr = panesTotales * pesoUnitarioGr;

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
      costoUnitario: costoUnitarioTotal,
      margenPorcentaje,
      mermaEstimada,
      piezasPorLata,
      ingredientesAdicionales: ingredientes,
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

  const addInsumo = () => {
    setIngredientes([...ingredientes, { productoId: generateUUID(), nombre: '', cantidad: 0, unidad: 'gr', costo: 0 }]);
  };

  const updateInsumo = (index: number, field: string, value: any) => {
    const newIng = [...ingredientes];
    newIng[index] = { ...newIng[index], [field]: value };
    setIngredientes(newIng);
  };

  const removeInsumo = (index: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] bg-white dark:bg-slate-900 border-none p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {modeloBase?.id ? 'Editar Modelo de Pan' : 'Nuevo Modelo de Pan'}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Define el gramaje y precio de este modelo. Las unidades por arroba se calculan solas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0 bg-white dark:bg-slate-900 h-[65vh] md:h-auto overflow-y-auto">
          {/* Columna Izquierda: Formulario (Estilo Imagen 1) */}
          <div className="p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Nombre del Modelo</label>
              <Input 
                value={nombre} 
                onChange={e => setNombre(e.target.value)} 
                placeholder="Pan corbatin(2000)" 
                className="rounded-xl h-12 bg-slate-50/50 border-slate-200" 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Fórmula de masa que usa</label>
              <Select value={formulacionId} onValueChange={setFormulacionId}>
                <SelectTrigger className="rounded-xl h-12 bg-slate-50/50 border-slate-200">
                  <SelectValue placeholder="Seleccionar receta técnica..." />
                </SelectTrigger>
                <SelectContent>
                  {formulaciones.filter(f => f.activo).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fila de 5 columnas */}
            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase truncate">Peso Unid. (gr)</label>
                <Input type="number" value={pesoUnitarioGr || ''} onChange={e => setPesoUnitarioGr(Number(e.target.value))} className="rounded-xl h-12 text-center font-black text-lg bg-slate-50/50 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase truncate">Cortes x Lata</label>
                <Input type="number" value={piezasPorLata || ''} onChange={e => setPiezasPorLata(Number(e.target.value))} className="rounded-xl h-12 text-center font-black text-lg bg-slate-50/50 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase truncate">Latas <span className="text-[9px] lowercase font-normal">(simulador)</span></label>
                <Input type="number" value={latasSimulador || ''} onChange={e => setLatasSimulador(Number(e.target.value))} className="rounded-xl h-12 text-center font-black text-lg bg-slate-50/50 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-wider text-indigo-600 uppercase truncate">Panes Totales</label>
                <div className="rounded-xl h-12 flex items-center justify-center font-black text-lg bg-indigo-50/50 border border-indigo-100 text-indigo-700">
                  {panesTotales}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-wider text-emerald-600 uppercase truncate">Pique Total (gr)</label>
                <div className="rounded-xl h-12 flex items-center justify-center font-black text-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-inner">
                  {piqueTotalGr}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Precio Venta ($)</label>
                <Input type="number" value={precioVentaUnitario || ''} onChange={e => setPrecioVentaUnitario(Number(e.target.value))} className="rounded-xl h-12 font-black text-lg bg-slate-50/50 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Merma de Horneo (%)</label>
                <Input type="number" value={mermaEstimada || ''} onChange={e => setMermaEstimada(Number(e.target.value))} className="rounded-xl h-12 font-black text-lg bg-slate-50/50 border-slate-200" />
              </div>
            </div>

            {/* Insumos */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Insumos (Rellenos/Decoración por pan)</label>
                <Button variant="outline" size="sm" onClick={addInsumo} className="h-8 text-xs rounded-lg bg-white">
                  <Plus className="w-3 h-3 mr-1" /> Agregar Insumo
                </Button>
              </div>
              
              {ingredientes.length > 0 && (
                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                      <Input placeholder="Nombre insumo" value={ing.nombre} onChange={e => updateInsumo(idx, 'nombre', e.target.value)} className="h-9 flex-1" />
                      <Input type="number" placeholder="Costo $" value={ing.costo || ''} onChange={e => updateInsumo(idx, 'costo', Number(e.target.value))} className="h-9 w-24" />
                      <Button variant="ghost" size="icon" onClick={() => removeInsumo(idx)} className="h-9 w-9 text-rose-500 hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Calculadora (Estilo Imagen 2) */}
          <div className="p-6 bg-[#1e2330] text-white flex flex-col h-full border-l border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Rendimiento Técnico</span>
              <Calculator className="w-4 h-4 text-pink-400" />
            </div>

            <div className="text-center pb-8 border-b border-slate-700/50">
              <p className="text-6xl font-black text-pink-400 tracking-tighter">{panesPorArroba}</p>
              <p className="text-sm text-slate-400 mt-2 font-medium">panes por arroba</p>
            </div>

            <div className="space-y-4 text-sm mt-8 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Masa por arroba:</span>
                <span className="font-bold text-base">{ARROBA_GR.toLocaleString('es-CO')}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Merma ({mermaEstimada}%):</span>
                <span className="font-bold text-rose-400 text-base">-{((ARROBA_GR * mermaEstimada) / 100).toFixed(0)}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Masa útil:</span>
                <span className="font-bold text-emerald-400 text-base">{(ARROBA_GR * (1 - mermaEstimada / 100)).toFixed(0)}g</span>
              </div>
              
              <div className="pt-6 mt-6 border-t border-slate-700/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Costo Unitario:</span>
                  <span className="font-bold text-orange-400 text-base">${costoUnitarioTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Margen Bruto:</span>
                  <span className="font-bold text-emerald-400 text-base">{margenPorcentaje.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose} className="rounded-xl h-11 px-6 font-bold text-slate-600">Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11 px-8 font-bold gap-2 shadow-lg shadow-orange-500/20 transition-all">
            <Save className="w-4 h-4" /> Actualizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
