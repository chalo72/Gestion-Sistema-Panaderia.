import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calculator, PieChart, ArrowRight, Wand2, PlusCircle, CheckCircle2, AlertTriangle, Layers3, Flame, Trash2, Plus, ClipboardCheck, ChevronDown, Search, ChevronUp, Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormulacionBase, ModeloPan, Venta, Producto } from '@/types';
import { ARROBA_KG } from '@/types';

interface DistribuidorArrobaProps {
  productos?: Producto[];
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  ventas: Venta[];
  onAñadirAlPlan?: (
    cortes: { modeloId: string; cantidad: number; pesoCrudoTotal: number }[], 
    formId: string, 
    arrobas: number,
    vitinaData?: { totalGr: number; porCorteGr: number; masaFinalCorteKg: number; numCortes: number }
  ) => void;
  onSimulationChange?: (formId: string, arrobas: number) => void;
  onGuardarAuditoria?: (cortes: { modeloId: string; cantidad: number; pesoCrudoTotal: number; porcentajeArroba: number }[], formId: string, arrobas: number, masaTotalKg: number, masaConsumidaKg: number, masaLibreKg: number) => void;
}

export function DistribuidorArroba({ productos, formulaciones, modelos, ventas, onAñadirAlPlan, onSimulationChange, onGuardarAuditoria }: DistribuidorArrobaProps) {
  const [formId, setFormId] = useState<string>('');
  const [arrobas, setArrobas] = useState<number>(1);
  const [cortes, setCortes] = useState<Record<string, number>>({});
  const [breadSearch, setBreadSearch] = useState<string>('');
  const [showInsumosPesaje, setShowInsumosPesaje] = useState<boolean>(false);

  // Masa disponible en la base
  const formulacion = formulaciones.find(f => f.id === formId);
  const modelosHijos = useMemo(() => modelos.filter(m => m.formulacionId === formId), [modelos, formId]);

  // Si cambia la lista de formulaciones y solo hay una (o formId no está seteado), auto-seleccionar
  useEffect(() => {
    if (!formId && formulaciones.length > 0) {
      setFormId(formulaciones[0].id);
    } else if (formId && !formulaciones.some(f => f.id === formId) && formulaciones.length > 0) {
      setFormId(formulaciones[0].id);
    }
  }, [formulaciones, formId]);

  // Si cambia la formulación o arrobas, notificar al padre
  useEffect(() => {
    setCortes({});
  }, [formId]);

  useEffect(() => {
    if (onSimulationChange) {
      onSimulationChange(formId, arrobas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, arrobas]);

  // Cálculos de masa
  const rendimientoMasaKg = formulacion?.rendimientoBaseKg || ARROBA_KG;
  const pesoTotalMasaKg = arrobas * rendimientoMasaKg;
  const pesoTotalMasaGr = pesoTotalMasaKg * 1000;

  const pesoUtilizadoGr = useMemo(() => {
    return Object.entries(cortes).reduce((acc, [modId, cant]) => {
      const mod = modelos.find(m => m.id === modId);
      if (!mod || cant <= 0) return acc;
      const merma = mod.mermaEstimada || 0;
      const masaConsumida = (cant * mod.pesoUnitarioGr) / (1 - (merma / 100));
      return acc + masaConsumida;
    }, 0);
  }, [cortes, modelos]);

  const pesoRestanteGr = pesoTotalMasaGr - pesoUtilizadoGr;
  const porcentajeUtilizado = Math.min(100, (pesoUtilizadoGr / pesoTotalMasaGr) * 100);
  const estaSobregirado = pesoUtilizadoGr > pesoTotalMasaGr;

  // Actualizar corte
  const setCorte = (modId: string, cantidad: number) => {
    setCortes(prev => ({
      ...prev,
      [modId]: cantidad >= 0 ? cantidad : 0
    }));
  };

  // Sugerencia Inteligente (IA Básica usando historial de ventas)
  const sugerirCortes = () => {
    if (!formId || modelosHijos.length === 0) {
      toast.error('Selecciona una masa con modelos asignados');
      return;
    }
    
    // Contar cuántos panes se han vendido de cada modelo
    const ventasPorModelo: Record<string, number> = {};
    modelosHijos.forEach(m => ventasPorModelo[m.id] = 0);
    
    ventas.forEach(v => {
      v.items.forEach(item => {
        if (ventasPorModelo[item.productoId] !== undefined) {
          ventasPorModelo[item.productoId] += item.cantidad;
        }
      });
    });

    const totalVentasHijos = Object.values(ventasPorModelo).reduce((a, b) => a + b, 0);
    
    let nuevosCortes: Record<string, number> = {};
    let masaDisponible = pesoTotalMasaGr;

    // Si no hay ventas, dividir equitativamente
    if (totalVentasHijos === 0) {
       const masaPorModelo = masaDisponible / modelosHijos.length;
       modelosHijos.forEach(m => {
           nuevosCortes[m.id] = Math.floor(masaPorModelo / m.pesoUnitarioGr);
       });
    } else {
       // Distribuir proporcional a las ventas
       modelosHijos.forEach(m => {
           const proporcion = ventasPorModelo[m.id] / totalVentasHijos;
           const masaAsignada = masaDisponible * proporcion;
           nuevosCortes[m.id] = Math.floor(masaAsignada / m.pesoUnitarioGr);
       });
    }
    
    setCortes(nuevosCortes);
    toast.success('Masas balanceadas según demanda histórica');
  };

  const addModeloToList = (modeloId: string) => {
    if (!cortes[modeloId] && cortes[modeloId] !== 0) {
      setCortes(prev => ({ ...prev, [modeloId]: 0 }));
    }
  };

  const addAllModelosToList = () => {
    if (modelosHijos.length === 0) return;
    setCortes(prev => {
      const next = { ...prev };
      modelosHijos.forEach(m => {
        if (next[m.id] === undefined) {
          next[m.id] = 0;
        }
      });
      return next;
    });
    toast.success(`Se agregaron todos los ${modelosHijos.length} panes de esta masa`);
  };

  const removeModeloFromList = (modeloId: string) => {
    setCortes(prev => {
      const next = { ...prev };
      delete next[modeloId];
      return next;
    });
  };

  const handleConfirmar = () => {
    if (!onAñadirAlPlan) return;
    const arrayCortes = Object.entries(cortes)
      .filter(([_, cant]) => cant > 0)
      .map(([modId, cant]) => {
        const mod = modelos.find(m => m.id === modId);
        return {
          modeloId: modId,
          cantidad: cant,
          pesoCrudoTotal: cant * (mod?.pesoUnitarioGr || 0)
        };
      });

    onAñadirAlPlan(arrayCortes, formId, arrobas);
    
    // Resetear cortes después de añadir
    setCortes({});
  };

  const handleAuditar = () => {
    if (pesoUtilizadoGr === 0) {
      toast.error('Debes asignar al menos un pan a la auditoría');
      return;
    }
    if (estaSobregirado) {
      toast.info(`Guardando producción con masa extra (+${((pesoUtilizadoGr - pesoTotalMasaGr) / 1000).toFixed(2)} kg sobre lo estimado)`);
    }

    const payload = Object.entries(cortes)
      .filter(([_, cant]) => cant > 0)
      .map(([modId, cant]) => {
        const m = modelos.find(x => x.id === modId);
        const pesoTotalGramos = cant * (m?.pesoUnitarioGr || 0);
        return {
          modeloId: modId,
          cantidad: cant,
          pesoCrudoTotal: pesoTotalGramos,
          porcentajeArroba: (pesoTotalGramos / pesoTotalMasaGr) * 100
        };
      });

    if (onGuardarAuditoria) {
      onGuardarAuditoria(payload, formId, arrobas, pesoTotalMasaKg, pesoUtilizadoGr / 1000, pesoRestanteGr / 1000);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl">Anotar en Libreta del Horno</CardTitle>
            <CardDescription>Elige la masa, las arrobas y cuántos panes salieron. Se guarda en el historial.</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-0 space-y-6">
        {/* Paso 1: Seleccionar Masa y Cantidad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">1. ¿Qué masa vas a mojar?</Label>
              {formulaciones.length === 0 && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Sin fórmulas registradas</span>
              )}
            </div>

            {/* Selector nativo táctil de alto rendimiento para móviles + Radix Select para escritorio */}
            <div className="relative">
              {/* Selector nativo para móvil */}
              <div className="md:hidden relative">
                <select
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 pr-10 text-sm font-bold text-slate-900 dark:text-white shadow-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="" disabled>Seleccionar Fórmula Maestra...</option>
                  {formulaciones.map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>

              {/* Selector Radix estilizado para tablets y pantallas medianas/grandes */}
              <div className="hidden md:block">
                <Select value={formId} onValueChange={setFormId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-slate-200">
                    <SelectValue placeholder="Seleccionar Fórmula Maestra..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[9999] max-h-72">
                    {formulaciones.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">2. Cantidad (Arrobas)</Label>
            <Input 
              type="number" min={0.01} step={0.01} 
              value={arrobas || ''} onChange={e => setArrobas(Number(e.target.value))} 
              className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 font-black text-xl text-center" 
            />
            <div className="flex flex-wrap gap-1 mt-2 justify-center">
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px]" onClick={() => setArrobas(0.5)}>1/2 Arroba</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px]" onClick={() => setArrobas(1)}>1 Arroba</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px]" onClick={() => setArrobas(1.5)}>1.5 Arrobas</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px]" onClick={() => setArrobas(2.5)}>2.5 Arrobas</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px]" onClick={() => setArrobas(0.02)}>1/2 Libra</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px]" onClick={() => setArrobas(0.24)}>6 Libras</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px]" onClick={() => setArrobas(0.28)}>7 Libras</Badge>
            </div>
          </div>
        </div>

        {formId && modelosHijos.length > 0 && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in space-y-6">
            
            {/* Termómetro de Masa */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-800">
                <div 
                  className={cn("h-full transition-all duration-700 ease-out", 
                    estaSobregirado 
                      ? "bg-amber-500" 
                      : (porcentajeUtilizado >= 95 ? "bg-emerald-500" : "bg-rose-500")
                  )} 
                  style={{ width: `${Math.min(100, porcentajeUtilizado)}%` }} 
                />
              </div>
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Masa Total Disponible</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">{pesoTotalMasaKg.toFixed(2)}</span>
                    <span className="text-lg font-bold text-slate-500">kg</span>
                  </div>
                  <div className="text-xs text-slate-500 font-bold mt-1 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md">
                    ({(pesoTotalMasaKg * 2.20462).toFixed(2)} lb | {pesoTotalMasaGr.toFixed(0)} g)
                  </div>
                </div>
                
                <div className="flex items-center gap-4 hidden md:flex text-slate-200 dark:text-slate-700">
                  <ArrowRight className="w-8 h-8" />
                </div>

                <div className="text-right flex-1 w-full flex gap-4 md:gap-8 justify-between md:justify-end">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Utilizada</h4>
                    <span className={cn("text-2xl font-black", estaSobregirado ? "text-amber-500" : (porcentajeUtilizado >= 95 ? "text-emerald-500" : "text-slate-700 dark:text-slate-200"))}>
                      {(pesoUtilizadoGr / 1000).toFixed(2)} <span className="text-sm">kg</span>
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {estaSobregirado ? 'Masa de Más' : (pesoRestanteGr === 0 ? 'Balance' : 'Falta Repartir')}
                    </h4>
                    <span className={cn("text-2xl font-black", 
                      estaSobregirado 
                        ? "text-amber-500" 
                        : (pesoRestanteGr === 0 ? "text-emerald-500" : "text-rose-500")
                    )}>
                      {estaSobregirado ? `+${(Math.abs(pesoRestanteGr) / 1000).toFixed(2)}` : (pesoRestanteGr / 1000).toFixed(2)} <span className="text-sm">kg</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón y Sección de Pesaje de Insumos para la mesa */}
              {formulacion?.ingredientes && formulacion.ingredientes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowInsumosPesaje(!showInsumosPesaje)}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Wheat className="w-3.5 h-3.5 text-amber-500" />
                      {showInsumosPesaje ? 'Ocultar pesaje de insumos' : `Ver pesaje para la mesa (${arrobas} arrobas)`}
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showInsumosPesaje && "rotate-180")} />
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {formulacion.ingredientes.length} ingredientes calculados
                    </span>
                  </div>

                  {showInsumosPesaje && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {formulacion.ingredientes.map((ing, iIdx) => {
                        const prod = productos?.find(p => p.id === ing.productoId);
                        const nombreInsumo = prod?.nombre || ing.productoId;
                        const cantBase = Number(ing.cantidadPorArroba ?? (ing as any).cantidadKg ?? 0);
                        const cantTotal = (cantBase * arrobas);
                        const unidad = ing.unidad || (ing as any).unidadMedida || 'kg';
                        return (
                          <div
                            key={iIdx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs"
                          >
                            <span className="truncate text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                              {nombreInsumo}
                            </span>
                            <span className="shrink-0 ml-1.5 font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg text-[11px]">
                              {Number.isInteger(cantTotal) ? cantTotal : cantTotal.toFixed(1)} {unidad}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Configurar Cortes */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-indigo-500" /> 3. Asignar panes a fabricar
                </Label>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Botón rápido para agregar todos los panes de la masa */}
                  {modelosHijos.length > 1 && (
                    <Button
                      onClick={addAllModelosToList}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-slate-200 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold text-xs"
                      title="Agregar todos los panes de esta fórmula a la lista"
                    >
                      <Layers3 className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Cargar todos ({modelosHijos.length})
                    </Button>
                  )}

                  {/* Menú desplegable deslizable (subir y bajar) con buscador/scroll suave */}
                  <DropdownMenu onOpenChange={(open) => { if (!open) setBreadSearch(''); }}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl border-dashed border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 font-bold shadow-sm">
                        <Plus className="w-3.5 h-3.5 mr-2" /> Agregar Pan a Fabricar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-72 max-h-80 overflow-hidden flex flex-col rounded-2xl p-1.5 shadow-2xl z-[9999] border-slate-200 dark:border-slate-800"
                    >
                      {/* Buscador en tiempo real de panes */}
                      <div className="p-1 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <div className="relative flex items-center">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="Buscar pan..."
                            value={breadSearch}
                            onChange={(e) => setBreadSearch(e.target.value)}
                            className="h-8 pl-8 pr-2 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium focus-visible:ring-indigo-500/20"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto overscroll-contain flex-1 max-h-60 custom-scrollbar pr-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between items-center">
                          <span>Panes disponibles</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-black">
                            {modelosHijos.filter(m => cortes[m.id] === undefined && (breadSearch.trim() === '' || m.nombre.toLowerCase().includes(breadSearch.toLowerCase()))).length}
                          </Badge>
                        </div>
                        {modelosHijos
                          .filter(m => cortes[m.id] === undefined && (breadSearch.trim() === '' || m.nombre.toLowerCase().includes(breadSearch.toLowerCase())))
                          .map(m => (
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => {
                                addModeloToList(m.id);
                                setBreadSearch('');
                              }}
                              className="flex items-center justify-between p-2 rounded-xl font-bold cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            >
                              <span className="truncate text-slate-800 dark:text-slate-100 text-xs">{m.nombre}</span>
                              <span className="shrink-0 ml-2 text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                                {m.pesoUnitarioGr}g
                              </span>
                            </DropdownMenuItem>
                          ))}
                        {modelosHijos.filter(m => cortes[m.id] === undefined && (breadSearch.trim() === '' || m.nombre.toLowerCase().includes(breadSearch.toLowerCase()))).length === 0 && (
                          <div className="px-3 py-6 text-xs text-center text-slate-500 font-medium">
                            {breadSearch.trim() !== '' ? 'No se encontraron panes con ese nombre' : 'Todos los panes de esta masa ya están agregados'}
                          </div>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button onClick={sugerirCortes} variant="outline" size="sm" className="h-9 rounded-xl border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 font-bold">
                    <Wand2 className="w-3.5 h-3.5 mr-2" /> Auto-Balancear IA
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.keys(cortes).map(modId => {
                  const m = modelosHijos.find(x => x.id === modId);
                  if (!m) return null;

                  const cant = cortes[m.id] || 0;
                  const pesoTotal = (cant * m.pesoUnitarioGr) / 1000; // en kg
                  const numLatas = m.piezasPorLata ? Math.ceil(cant / m.piezasPorLata) : 0;
                  const piezasPorLataEfectiva = m.piezasPorLata || 30;
                  
                  return (
                    <div key={m.id} className={cn(
                      "p-4 rounded-2xl border transition-all relative group",
                      cant > 0 ? "bg-white dark:bg-slate-900 border-indigo-200 shadow-[0_4px_20px_-10px_rgba(99,102,241,0.2)]" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200"
                    )}>
                      <button 
                        onClick={() => removeModeloFromList(m.id)}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 pr-2">
                          <h5 className="font-black text-sm text-slate-900 dark:text-white leading-tight">{m.nombre}</h5>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {m.pesoUnitarioGr}g c/u · {piezasPorLataEfectiva} u/lata
                          </p>
                        </div>
                        {m.ingredientesAdicionales && m.ingredientesAdicionales.length > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 shrink-0 text-[9px] px-1.5">+Relleno</Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-slate-400 mb-1">Bandejas</span>
                            <Input 
                              type="number" min={0} placeholder="0"
                              value={cant > 0 ? (cant / piezasPorLataEfectiva).toFixed(1).replace(/\.0$/, '') : ''}
                              className="h-8 rounded-lg text-center text-xs font-bold border-slate-200"
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') {
                                  setCorte(m.id, 0);
                                  return;
                                }
                                const bandejas = Number(v) || 0;
                                setCorte(m.id, Math.round(bandejas * piezasPorLataEfectiva));
                              }}
                            />
                          </div>
                          <span className="text-slate-300 text-xs mt-4">×</span>
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-slate-400 mb-1">x Bandeja</span>
                            <Input 
                              type="number" min={1} defaultValue={piezasPorLataEfectiva}
                              className="h-8 rounded-lg text-center text-xs font-bold border-slate-200 text-slate-500"
                              onChange={(e) => {
                                const nuevoPorLata = Number(e.target.value) || piezasPorLataEfectiva;
                                m.piezasPorLata = nuevoPorLata;
                                setCorte(m.id, cant);
                              }}
                            />
                          </div>
                          <span className="text-slate-300 text-xs mt-4">=</span>
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-indigo-400 mb-1">Total Panes</span>
                            <Input 
                              type="number" min={0} 
                              value={cant === 0 ? '' : cant} 
                              onChange={e => setCorte(m.id, Number(e.target.value))}
                              placeholder="0"
                              className="h-8 rounded-lg text-center font-black text-sm border-indigo-200 bg-indigo-50 text-indigo-700 focus:ring-indigo-500/20"
                            />
                          </div>
                        </div>
                        
                        {/* Botones táctiles rápidos para panadería (sin teclear en móvil) */}
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            type="button"
                            className="h-7 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 active:scale-95 transition-all flex items-center justify-center"
                            onClick={() => {
                              const nuevo = Math.max(0, cant - piezasPorLataEfectiva);
                              setCorte(m.id, nuevo);
                            }}
                            title="Restar 1 lata"
                          >
                            -1 Lata
                          </button>
                          <button
                            type="button"
                            className="h-7 text-[10px] font-black rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 active:scale-95 transition-all flex items-center justify-center"
                            onClick={() => {
                              setCorte(m.id, cant + piezasPorLataEfectiva);
                            }}
                            title="Sumar 1 lata"
                          >
                            +1 Lata
                          </button>
                          <button
                            type="button"
                            className="h-7 text-[10px] font-black rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 active:scale-95 transition-all flex items-center justify-center"
                            onClick={() => {
                              setCorte(m.id, cant + (piezasPorLataEfectiva * 2));
                            }}
                            title="Sumar 2 latas"
                          >
                            +2 Latas
                          </button>
                          <button
                            type="button"
                            className="h-7 text-[10px] font-black rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 active:scale-95 transition-all flex items-center justify-center"
                            onClick={() => {
                              setCorte(m.id, cant + (piezasPorLataEfectiva * 5));
                            }}
                            title="Sumar 5 latas"
                          >
                            +5 Latas
                          </button>
                        </div>

                        <div className="flex gap-2 mt-0.5">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] font-bold flex-1 bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-100 rounded-lg"
                            onClick={() => {
                               const availablePanes = Math.floor(pesoRestanteGr / m.pesoUnitarioGr);
                               if (availablePanes > 0) setCorte(m.id, cant + availablePanes);
                            }}
                          >
                            Llenar Masa Restante
                          </Button>
                          {cant > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] font-bold px-2 text-slate-400 hover:text-rose-500 rounded-lg"
                              onClick={() => setCorte(m.id, 0)}
                            >
                              Poner 0
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>{pesoTotal.toFixed(2)} kg de masa</span>
                        {m.piezasPorLata && cant > 0 && (
                          <span className="text-indigo-500">~{numLatas} latas</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {Object.keys(cortes).length === 0 && (
                  <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-400 mb-2">No has agregado ningún pan para fabricar.</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Usa "Agregar pan" o dale a "Auto-Balancear IA"</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Submit */}
            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
              {onAñadirAlPlan && (
                <Button 
                  onClick={handleConfirmar} 
                  disabled={pesoUtilizadoGr === 0}
                  variant="outline"
                  className={cn(
                    "h-14 px-8 rounded-2xl font-black text-base transition-all border-2",
                    estaSobregirado 
                      ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300" 
                      : "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  )}
                >
                  {estaSobregirado ? 'Sumar al plan (Masa Extra)' : 'Sumar al plan del día'} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
              {onGuardarAuditoria && (
                <Button 
                  onClick={handleAuditar} 
                  disabled={pesoUtilizadoGr === 0}
                  className={cn(
                    "h-14 px-8 rounded-2xl font-black text-lg transition-all text-white border-b-4",
                    estaSobregirado 
                      ? "bg-amber-500 hover:bg-amber-600 border-amber-700 shadow-lg shadow-amber-500/25" 
                      : "bg-emerald-600 hover:bg-emerald-700 border-emerald-800 shadow-lg shadow-emerald-500/25"
                  )}
                >
                  <Wand2 className="w-5 h-5 mr-2" /> 
                  {estaSobregirado ? 'Guardar en Libreta (Masa de Más)' : 'Guardar en Libreta'}
                </Button>
              )}
            </div>

          </div>
        )}

        {formId && modelosHijos.length === 0 && (
          <div className="p-8 text-center bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-black text-amber-700 dark:text-amber-400">Sin modelos de pan</h3>
            <p className="text-sm text-amber-600/70 mt-1">Esta fórmula no tiene ningún pan asignado. Ve a "Recetas" y crea un modelo de pan (ej: Croissant) que use esta fórmula.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
