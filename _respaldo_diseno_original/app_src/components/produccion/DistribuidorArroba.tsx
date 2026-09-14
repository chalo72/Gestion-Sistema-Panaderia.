import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Wand2, AlertTriangle, Layers3, Trash2, Plus, ClipboardCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { FormulacionBase, ModeloPan, Venta, Producto } from '@/types';
import { ARROBA_KG } from '@/types';
import { resolverKgPorArrobaMasa } from '@/lib/arroba-masa';
import { resolverModelosDeMasa } from '@/lib/modelos-de-masa';

/** 1 arroba comercial ≈ 25 lb (convención panadería Dulce Placer). */
const LIBRAS_POR_ARROBA = 25;
const librasAArrobas = (libras: number): number =>
  Math.round((libras / LIBRAS_POR_ARROBA) * 100) / 100;

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
  onGuardarAuditoria?: (
    cortes: { modeloId: string; cantidad: number; pesoCrudoTotal: number; porcentajeArroba: number }[],
    formId: string,
    arrobas: number,
    masaTotalKg: number,
    masaConsumidaKg: number,
    masaLibreKg: number
  ) => void;
}

export function DistribuidorArroba({
  productos: _productos,
  formulaciones,
  modelos,
  ventas,
  onAñadirAlPlan,
  onSimulationChange,
  onGuardarAuditoria,
}: DistribuidorArrobaProps) {
  const [formId, setFormId] = useState<string>('');
  const [arrobas, setArrobas] = useState<number>(1);
  const [cortes, setCortes] = useState<Record<string, number>>({});
  const [showPanPicker, setShowPanPicker] = useState(false);
  const [buscarPan, setBuscarPan] = useState('');

  // Masas activas con nombre real, ordenadas como en PC
  const masasDisponibles = useMemo(() => {
    return formulaciones
      .filter((f) => f && f.id && f.nombre && f.activo !== false)
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [formulaciones]);

  const formulacion = masasDisponibles.find((f) => f.id === formId) || formulaciones.find((f) => f.id === formId);

  // Celular y PC pueden tener distinto UUID para la misma masa: unir id + mix + mismo nombre
  const { modelos: modelosHijos, origen: origenListaPanes } = useMemo(() => {
    if (!formId) return { modelos: [] as ModeloPan[], origen: 'vacio' as const };
    const formCorr = formulacion || { id: formId, nombre: undefined, mixProduccion: undefined };
    const r = resolverModelosDeMasa(formCorr, modelos, formulaciones);
    return { modelos: r.modelos as ModeloPan[], origen: r.origen };
  }, [modelos, formId, formulacion, formulaciones]);

  const panesDisponibles = useMemo(
    () => modelosHijos.filter((m) => cortes[m.id] === undefined),
    [modelosHijos, cortes],
  );

  const panesFiltrados = useMemo(() => {
    const q = buscarPan.trim().toLowerCase();
    if (!q) return panesDisponibles;
    return panesDisponibles.filter((m) => m.nombre.toLowerCase().includes(q));
  }, [panesDisponibles, buscarPan]);

  useEffect(() => {
    setCortes({});
  }, [formId]);

  useEffect(() => {
    if (onSimulationChange) {
      onSimulationChange(formId, arrobas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, arrobas]);

  // Si la masa elegida desapareció tras sync, limpiar selección
  useEffect(() => {
    if (formId && !masasDisponibles.some((f) => f.id === formId)) {
      setFormId('');
    }
  }, [masasDisponibles, formId]);

  const rendimientoMasaKg = formulacion
    ? resolverKgPorArrobaMasa(formulacion)
    : ARROBA_KG;
  const pesoTotalMasaKg = arrobas * rendimientoMasaKg;
  const pesoTotalMasaGr = pesoTotalMasaKg * 1000;

  const pesoUtilizadoGr = useMemo(() => {
    return Object.entries(cortes).reduce((acc, [modId, cant]) => {
      const mod = modelos.find((m) => m.id === modId);
      if (!mod || cant <= 0) return acc;
      const merma = mod.mermaEstimada || 0;
      const masaConsumida = (cant * mod.pesoUnitarioGr) / (1 - merma / 100);
      return acc + masaConsumida;
    }, 0);
  }, [cortes, modelos]);

  const pesoRestanteGr = pesoTotalMasaGr - pesoUtilizadoGr;
  const porcentajeUtilizado = Math.min(100, (pesoUtilizadoGr / pesoTotalMasaGr) * 100);
  const estaSobregirado = pesoUtilizadoGr > pesoTotalMasaGr;

  const setCorte = (modId: string, cantidad: number) => {
    setCortes((prev) => ({
      ...prev,
      [modId]: cantidad >= 0 ? cantidad : 0,
    }));
  };

  const sugerirCortes = () => {
    if (!formId || modelosHijos.length === 0) {
      toast.error('Selecciona una masa con panes asignados');
      return;
    }

    const ventasPorModelo: Record<string, number> = {};
    modelosHijos.forEach((m) => {
      ventasPorModelo[m.id] = 0;
    });

    ventas.forEach((v) => {
      v.items.forEach((item) => {
        if (ventasPorModelo[item.productoId] !== undefined) {
          ventasPorModelo[item.productoId] += item.cantidad;
        }
      });
    });

    const totalVentasHijos = Object.values(ventasPorModelo).reduce((a, b) => a + b, 0);
    const nuevosCortes: Record<string, number> = {};
    const masaDisponible = pesoTotalMasaGr;

    if (totalVentasHijos === 0) {
      const masaPorModelo = masaDisponible / modelosHijos.length;
      modelosHijos.forEach((m) => {
        nuevosCortes[m.id] = Math.floor(masaPorModelo / m.pesoUnitarioGr);
      });
    } else {
      modelosHijos.forEach((m) => {
        const proporcion = ventasPorModelo[m.id] / totalVentasHijos;
        const masaAsignada = masaDisponible * proporcion;
        nuevosCortes[m.id] = Math.floor(masaAsignada / m.pesoUnitarioGr);
      });
    }

    setCortes(nuevosCortes);
    toast.success('Masas balanceadas según demanda histórica');
  };

  const addModeloToList = (modeloId: string) => {
    if (cortes[modeloId] === undefined) {
      setCortes((prev) => ({ ...prev, [modeloId]: 0 }));
    }
  };

  const elegirPan = (modeloId: string) => {
    addModeloToList(modeloId);
    setShowPanPicker(false);
    setBuscarPan('');
  };

  const removeModeloFromList = (modeloId: string) => {
    setCortes((prev) => {
      const next = { ...prev };
      delete next[modeloId];
      return next;
    });
  };

  const handleConfirmar = () => {
    if (!onAñadirAlPlan) return;
    const arrayCortes = Object.entries(cortes)
      .filter(([, cant]) => cant > 0)
      .map(([modId, cant]) => {
        const mod = modelos.find((m) => m.id === modId);
        return {
          modeloId: modId,
          cantidad: cant,
          pesoCrudoTotal: cant * (mod?.pesoUnitarioGr || 0),
        };
      });

    onAñadirAlPlan(arrayCortes, formId, arrobas);
    setCortes({});
  };

  const handleAuditar = () => {
    if (pesoUtilizadoGr === 0) {
      toast.error('Debes asignar al menos un pan a la auditoría');
      return;
    }

    const payload = Object.entries(cortes)
      .filter(([, cant]) => cant > 0)
      .map(([modId, cant]) => {
        const m = modelos.find((x) => x.id === modId);
        const pesoTotalGramos = cant * (m?.pesoUnitarioGr || 0);
        return {
          modeloId: modId,
          cantidad: cant,
          pesoCrudoTotal: pesoTotalGramos,
          porcentajeArroba: (pesoTotalGramos / pesoTotalMasaGr) * 100,
        };
      });

    if (onGuardarAuditoria) {
      onGuardarAuditoria(
        payload,
        formId,
        arrobas,
        pesoTotalMasaKg,
        pesoUtilizadoGr / 1000,
        pesoRestanteGr / 1000,
      );
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
            <CardDescription>
              Elige la masa, las arrobas y cuántos panes salieron. Se guarda en el historial.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              1. ¿Qué masa vas a mojar?
            </Label>
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-slate-200">
                <SelectValue placeholder="Seleccionar masa (mismo listado que en PC)..." />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                {masasDisponibles.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="font-medium">
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {masasDisponibles.length === 0 && (
              <p className="text-xs text-amber-600 font-semibold px-1">
                No hay masas activas. Sincroniza con la PC o revisa Formulaciones.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              2. Cantidad (Arrobas)
            </Label>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={arrobas || ''}
              onChange={(e) => setArrobas(Number(e.target.value))}
              className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 font-black text-xl text-center"
            />
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(0.5)}>1/2 Arroba</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(1)}>1 Arroba</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(1.5)}>1.5 Arrobas</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(2.5)}>2.5 Arrobas</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(librasAArrobas(0.5))}>1/2 Libra</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(librasAArrobas(6))}>6 Libras</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 text-[10px] px-2.5 py-1" onClick={() => setArrobas(librasAArrobas(7))}>7 Libras</Badge>
              <Badge
                variant="outline"
                title="Hojaldre: media arroba + 6 lb (18 lb total)"
                className="cursor-pointer hover:bg-orange-50 hover:text-orange-700 border-orange-200 text-[10px] px-2.5 py-1 font-bold"
                onClick={() => setArrobas(0.5 + librasAArrobas(6))}
              >
                18 Libras
              </Badge>
            </div>
          </div>
        </div>

        {formId && modelosHijos.length > 0 && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn(
                    'h-full transition-all duration-700 ease-out',
                    estaSobregirado ? 'bg-rose-500' : porcentajeUtilizado > 95 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(100, porcentajeUtilizado)}%` }}
                />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">
                    Masa Total Disponible
                  </h4>
                  <p className="text-xs font-bold text-indigo-600 mb-1">{formulacion?.nombre}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">
                      {pesoTotalMasaKg.toFixed(2)}
                    </span>
                    <span className="text-lg font-bold text-slate-500">kg</span>
                  </div>
                  <div className="text-xs text-slate-500 font-bold mt-1 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md">
                    ({(pesoTotalMasaKg * 2.20462).toFixed(2)} lb | {pesoTotalMasaGr.toFixed(0)} g)
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-4 text-slate-200 dark:text-slate-700">
                  <ArrowRight className="w-8 h-8" />
                </div>

                <div className="text-right flex-1 w-full flex gap-4 md:gap-8 justify-between md:justify-end">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Utilizada
                    </h4>
                    <span
                      className={cn(
                        'text-2xl font-black',
                        estaSobregirado ? 'text-rose-500' : 'text-emerald-500',
                      )}
                    >
                      {(pesoUtilizadoGr / 1000).toFixed(2)} <span className="text-sm">kg</span>
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Sobrante
                    </h4>
                    <span
                      className={cn(
                        'text-2xl font-black',
                        pesoRestanteGr < 0 ? 'text-rose-500' : 'text-amber-500',
                      )}
                    >
                      {(pesoRestanteGr / 1000).toFixed(2)} <span className="text-sm">kg</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-indigo-500" /> 3. Asignar panes a fabricar
                  <span className="text-indigo-500 font-bold normal-case tracking-normal">
                    ({modelosHijos.length} de esta masa)
                  </span>
                  {origenListaPanes === 'todos' && (
                    <span className="text-amber-600 font-semibold normal-case tracking-normal text-[10px]">
                      Esta masa no tenía lazos: se muestran todos los modelos del celular.
                    </span>
                  )}
                </Label>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9 rounded-xl border-dashed border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 font-bold shadow-sm w-full sm:w-auto"
                    onClick={() => setShowPanPicker(true)}
                    disabled={panesDisponibles.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-2 shrink-0" /> Agregar Pan a Fabricar
                  </Button>
                  <Button
                    onClick={sugerirCortes}
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9 rounded-xl border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 font-bold w-full sm:w-auto"
                  >
                    <Wand2 className="w-4 h-4 mr-2 shrink-0" /> Auto-Balancear IA
                  </Button>
                </div>
              </div>

              {panesDisponibles.length > 0 && (
                <div className="space-y-2 md:hidden">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                    Toque rápido — panes de {formulacion?.nombre}
                  </p>
                  <div className="flex flex-wrap gap-2 pb-1">
                    {panesDisponibles.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => elegirPan(m.id)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50/80 text-indigo-800 font-bold text-sm hover:bg-indigo-100 active:scale-95 transition-all"
                      >
                        + {m.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Dialog
                open={showPanPicker}
                onOpenChange={(open) => {
                  setShowPanPicker(open);
                  if (!open) setBuscarPan('');
                }}
              >
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[min(92dvh,100%)] sm:max-h-[90vh] flex flex-col rounded-2xl p-0 gap-0 overflow-hidden top-3 translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
                  <DialogHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <DialogTitle className="text-lg font-black">Elige el pan a fabricar</DialogTitle>
                    <DialogDescription className="text-xs">
                      Masa: <strong>{formulacion?.nombre}</strong> — {modelosHijos.length} panes (PC y celular).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={buscarPan}
                        onChange={(e) => setBuscarPan(e.target.value)}
                        placeholder="Buscar pan..."
                        className="h-12 pl-10 rounded-xl text-base"
                        autoFocus={false}
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 min-h-[40dvh] max-h-[70dvh] sm:min-h-[200px] sm:max-h-[55vh]">
                    {panesFiltrados.length === 0 ? (
                      <p className="text-center text-sm text-slate-500 py-8">
                        {panesDisponibles.length === 0
                          ? 'Ya agregaste todos los panes de esta masa.'
                          : 'No hay panes con ese nombre.'}
                      </p>
                    ) : (
                      panesFiltrados.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => elegirPan(m.id)}
                          className="w-full flex items-center justify-between gap-3 p-4 min-h-[56px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 hover:bg-indigo-50/60 active:scale-[0.98] transition-all text-left"
                        >
                          <span className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                            {m.nombre}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                            {m.pesoUnitarioGr} g
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.keys(cortes).map((modId) => {
                  const m = modelosHijos.find((x) => x.id === modId) || modelos.find((x) => x.id === modId);
                  if (!m) return null;

                  const cant = cortes[m.id] || 0;
                  const pesoTotal = (cant * m.pesoUnitarioGr) / 1000;
                  const numLatas = m.piezasPorLata ? Math.ceil(cant / m.piezasPorLata) : 0;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all relative group',
                        cant > 0
                          ? 'bg-white dark:bg-slate-900 border-indigo-200 shadow-[0_4px_20px_-10px_rgba(99,102,241,0.2)]'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200',
                      )}
                    >
                      <button
                        onClick={() => removeModeloFromList(m.id)}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-sm z-10 sm:opacity-0 sm:group-hover:opacity-100"
                        type="button"
                        title="Quitar pan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 pr-2">
                          <h5 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                            {m.nombre}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {m.pesoUnitarioGr}g c/u
                          </p>
                        </div>
                        {m.ingredientesAdicionales && m.ingredientesAdicionales.length > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 shrink-0 text-[9px] px-1.5">
                            +Relleno
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-slate-400 mb-1">
                              Bandejas
                            </span>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              className="h-8 rounded-lg text-center text-xs font-bold border-slate-200"
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') return;
                                const bandejas = Number(v) || 0;
                                const pxb = m.piezasPorLata || 30;
                                setCorte(m.id, bandejas * pxb);
                              }}
                            />
                          </div>
                          <span className="text-slate-300 text-xs mt-4">×</span>
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-slate-400 mb-1">
                              x Bandeja
                            </span>
                            <Input
                              type="number"
                              min={0}
                              defaultValue={m.piezasPorLata || 30}
                              className="h-8 rounded-lg text-center text-xs font-bold border-slate-200 text-slate-500"
                              readOnly
                            />
                          </div>
                          <span className="text-slate-300 text-xs mt-4">=</span>
                          <div className="flex flex-col items-center w-1/3">
                            <span className="text-[8px] font-black uppercase text-indigo-400 mb-1">
                              Total Panes
                            </span>
                            <Input
                              type="number"
                              min={0}
                              value={cant === 0 ? '' : cant}
                              onChange={(e) => setCorte(m.id, Number(e.target.value))}
                              placeholder="0"
                              className="h-8 rounded-lg text-center font-black text-sm border-indigo-200 bg-indigo-50 text-indigo-700 focus:ring-indigo-500/20"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] font-bold flex-1 bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-100 rounded-lg"
                            onClick={() => {
                              const availablePanes = Math.floor(pesoRestanteGr / m.pesoUnitarioGr);
                              if (availablePanes > 0) setCorte(m.id, cant + availablePanes);
                            }}
                          >
                            Llenar Máx
                          </Button>
                          {m.piezasPorLata && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-bold flex-1 bg-white hover:bg-slate-100 text-slate-600 border-slate-200 rounded-lg"
                              onClick={() => setCorte(m.id, cant + m.piezasPorLata!)}
                            >
                              +1 Lata
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
                  <div className="col-span-full py-8 px-4 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-400 mb-2">
                      No has agregado ningún pan para fabricar.
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-4">
                      Toca un pan de esta masa
                    </p>
                    {panesDisponibles.length > 0 && (
                      <div className="flex flex-col gap-2 max-w-sm mx-auto md:hidden">
                        {panesDisponibles.slice(0, 8).map((m) => (
                          <Button
                            key={m.id}
                            variant="outline"
                            className="h-12 rounded-xl font-bold border-indigo-200 text-indigo-700 bg-white"
                            onClick={() => elegirPan(m.id)}
                          >
                            <Plus className="w-4 h-4 mr-2" /> {m.nombre}
                          </Button>
                        ))}
                        {panesDisponibles.length > 8 && (
                          <Button
                            variant="ghost"
                            className="h-10 text-indigo-600 font-bold"
                            onClick={() => setShowPanPicker(true)}
                          >
                            Ver los {panesDisponibles.length} panes...
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
              {onAñadirAlPlan && (
                <Button
                  onClick={handleConfirmar}
                  disabled={pesoUtilizadoGr === 0 || estaSobregirado}
                  variant="outline"
                  className={cn(
                    'h-14 px-8 rounded-2xl font-black text-base transition-all border-2',
                    estaSobregirado
                      ? 'opacity-50 pointer-events-none'
                      : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
                  )}
                >
                  Sumar al plan del día <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
              {onGuardarAuditoria && (
                <Button
                  onClick={handleAuditar}
                  disabled={pesoUtilizadoGr === 0}
                  className={cn(
                    'h-14 px-8 rounded-2xl font-black text-lg transition-all text-white border-b-4',
                    estaSobregirado
                      ? 'bg-slate-300 border-slate-400 opacity-50 pointer-events-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800 shadow-lg shadow-emerald-500/25',
                  )}
                >
                  <Wand2 className="w-5 h-5 mr-2" /> Guardar en Libreta
                </Button>
              )}
            </div>
          </div>
        )}

        {formId && modelosHijos.length === 0 && (
          <div className="p-8 text-center bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-black text-amber-700 dark:text-amber-400">
              Sin panes para esta masa
            </h3>
            <p className="text-sm text-amber-600/70 mt-1">
              «{formulacion?.nombre || 'Esta masa'}» no tiene modelos de pan vinculados. En la PC, ve a
              Recetas / Modelos y asigna los panes a esta formulación; luego sincroniza.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
