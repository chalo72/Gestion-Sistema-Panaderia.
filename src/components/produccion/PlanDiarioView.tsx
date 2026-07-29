import { generateUUID } from '@/lib/safe-utils';
import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  Printer,
  Calculator,
  Scale,
  Package,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  CalendarRange,
  Flame,
  ChevronDown,
  Bot,
  BrainCircuit,
  ClipboardList,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DistribuidorArroba } from './DistribuidorArroba';
import { IaAnalysisModal } from './IaAnalysisModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormulacionBase, ModeloPan, Producto, Configuracion, InventarioItem } from '@/types';
import { ARROBA_KG as ARROBA_KG_DEFAULT } from '@/types';

interface PlanDiarioViewProps {
  productos: Producto[];
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  getProductoById: (id: string) => Producto | undefined;
  inventario: InventarioItem[];
  configuracion: Configuracion;
  formatCurrency: (value: number) => string;
  onLanzarPlan?: (planItems: any[]) => void;
  onGuardarComoPlantilla?: (items: any[]) => void;
  ventas?: any[];
  planesDiarios?: any[];
  addPlanDiario?: (data: any) => Promise<any>;
  deletePlanDiario?: (id: string) => Promise<void>;
}

interface PlanItem {
  id: string;
  formulacionId: string;
  modeloId: string;
  arrobas: number;
  piezas?: number;
  piqueGr?: number;
}

export function PlanDiarioView({
  productos,
  formulaciones,
  modelos,
  getProductoById,
  inventario,
  configuracion,
  formatCurrency,
  onLanzarPlan,
  onGuardarComoPlantilla,
  ventas = [],
  planesDiarios = [],
  addPlanDiario,
  deletePlanDiario
}: PlanDiarioViewProps) {
  const [items, setItems] = useState<PlanItem[]>(() => {
    const saved = localStorage.getItem('draft_plan_diario');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [isSimuladorOpen, setIsSimuladorOpen] = useState(false);
  const [fechaPlan, setFechaPlan] = useState<string>(() => new Date().toISOString().split('T')[0]);
  // Estado local para editar el campo PIQUE (G) sin que React lo sobreescriba mientras se tipea
  const [editingPique, setEditingPique] = useState<Record<string, string>>({});
  // Grupos abiertos del acordeón (por formulacionId)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [masasObjetivo, setMasasObjetivo] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('draft_masas_objetivo');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [sobranteFisico, setSobranteFisico] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('draft_sobrante_fisico');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Estado local para editar el sobrante
  const [editingSobrante, setEditingSobrante] = useState<Record<string, string>>({});
  const [isIaModalOpen, setIsIaModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('draft_plan_diario', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('draft_masas_objetivo', JSON.stringify(masasObjetivo));
  }, [masasObjetivo]);

  useEffect(() => {
    localStorage.setItem('draft_sobrante_fisico', JSON.stringify(sobranteFisico));
  }, [sobranteFisico]);
  const ARROBA_KG = configuracion.pesoArrobaKg || ARROBA_KG_DEFAULT;

  // Estado para el modal del Análisis IA
  const [analisisIaItem, setAnalisisIaItem] = useState<any>(null);

  // Helper para identificar arrobas fácilmente (IA Experta Visual)
  const formatArrobaEspanol = (grs: number) => {
    const arr = grs / (ARROBA_KG * 1000);
    const lbs = (grs / 1000) * 2.20462;

    if (arr === 0) return '';
    if (Math.abs(arr - 0.25) < 0.03) return 'Cuarto de Arroba (¼)';
    if (Math.abs(arr - 0.5) < 0.03) return 'Media Arroba (½)';
    if (Math.abs(arr - 0.75) < 0.03) return 'Tres cuartos de Arroba (¾)';
    if (Math.abs(arr - 1) < 0.05) return '1 Arroba';
    if (Math.abs(arr - 1.5) < 0.05) return 'Arroba y media (1½)';
    if (Math.abs(arr - 2) < 0.05) return '2 Arrobas';
    if (Math.abs(arr - 2.5) < 0.05) return '2 Arrobas y media (2½)';
    if (Math.abs(arr - 3) < 0.05) return '3 Arrobas';
    
    if (arr < 0.5) {
      return `${Math.round(lbs)} Libras (lb)`;
    }
    
    return `${arr.toFixed(1)} Arrobas`;
  };
  const ARROBA_GR = ARROBA_KG * 1000;
  const CAPACIDAD_HORNO = configuracion.latasPorHorno || 4;

  const handleAddItem = () => {
    setIsSimuladorOpen(true);
  };

  const handleAñadirDesdeSimulador = (
    cortes: any[], 
    formId: string, 
    arrobasTotal: number
  ) => {
    setMasasObjetivo(prev => {
      const current = prev[formId] || 0;
      return { 
        ...prev, 
        [formId]: current + arrobasTotal
      };
    });

    // Calculamos el peso crudo total de todos los cortes
    const pesoCrudoTotalCortes = cortes.reduce((sum, c) => sum + c.pesoCrudoTotal, 0);
    
    if (pesoCrudoTotalCortes === 0) {
      setIsSimuladorOpen(false);
      return;
    }

    const nuevosItems: PlanItem[] = cortes.map(corte => {
      const formulacion = formulaciones.find(f => f.id === formId);
      const modelo = modelos.find(m => m.id === corte.modeloId);
      
      let arrobasReales = 0;
      if (formulacion && modelo) {
        const merma = modelo.mermaEstimada;
        const rendimientoBaseGr = (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000;
        const masaUtilPorArroba = rendimientoBaseGr * (1 - merma / 100);
        arrobasReales = corte.pesoCrudoTotal / masaUtilPorArroba;
      } else {
        const arrobasProporcional = (corte.pesoCrudoTotal / pesoCrudoTotalCortes) * arrobasTotal;
        arrobasReales = arrobasProporcional;
      }

      return {
        id: generateUUID(),
        formulacionId: formId,
        modeloId: corte.modeloId,
        arrobas: Number(arrobasReales.toFixed(3)),
        piezas: corte.cantidad,
        piqueGr: corte.pesoCrudoTotal
      };
    });

    setItems([...items, ...nuevosItems]);
    setIsSimuladorOpen(false);
  };

  const handleUpdateItem = (id: string, field: keyof PlanItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Si cambia la formulación, resetear el modelo
        if (field === 'formulacionId') {
          updated.modeloId = '';
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdatePiezas = (id: string, piezas: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      const modelo = modelos.find(m => m.id === item.modeloId);
      if (!formulacion || !modelo) return item;

      const oldPiezas = item.piezas || Math.round((item.arrobas * (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000 * (1 - (modelo.mermaEstimada || 0) / 100)) / modelo.pesoUnitarioGr) || 1;
      const customPesoUnitario = item.piqueGr ? item.piqueGr / oldPiezas : modelo.pesoUnitarioGr;
      
      const merma = modelo.mermaEstimada;
      const rendimientoBaseGr = (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000;
      const masaUtilPorArroba = rendimientoBaseGr * (1 - merma / 100);
      
      let nuevasArrobas = (piezas * customPesoUnitario) / masaUtilPorArroba;
      const nuevoPiqueGr = item.piqueGr ? Math.round(piezas * customPesoUnitario) : undefined;

      return { 
        ...item, 
        arrobas: Number(nuevasArrobas.toFixed(3)) || 0, 
        piezas,
        ...(nuevoPiqueGr ? { piqueGr: nuevoPiqueGr } : {})
      };
    }));
  };

  const handleUpdateLatas = (id: string, latas: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      const modelo = modelos.find(m => m.id === item.modeloId);
      if (!formulacion || !modelo) return item;

      const piezasPorLata = modelo.piezasPorLata || 12;
      const piezas = latas * piezasPorLata;
      
      const oldPiezas = item.piezas || Math.round((item.arrobas * (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000 * (1 - (modelo.mermaEstimada || 0) / 100)) / modelo.pesoUnitarioGr) || 1;
      const customPesoUnitario = item.piqueGr ? item.piqueGr / oldPiezas : modelo.pesoUnitarioGr;
      
      const merma = modelo.mermaEstimada;
      const rendimientoBaseGr = (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000;
      const masaUtilPorArroba = rendimientoBaseGr * (1 - merma / 100);
      
      let nuevasArrobas = (piezas * customPesoUnitario) / masaUtilPorArroba;
      const nuevoPiqueGr = item.piqueGr ? Math.round(piezas * customPesoUnitario) : undefined;

      return { 
        ...item, 
        arrobas: Number(nuevasArrobas.toFixed(3)) || 0, 
        piezas,
        ...(nuevoPiqueGr ? { piqueGr: nuevoPiqueGr } : {})
      };
    }));
  };

  const handleUpdatePique = (id: string, piqueGr: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      const modelo = modelos.find(m => m.id === item.modeloId);
      if (formulacion && modelo) {
        const merma = modelo.mermaEstimada;
        const rendimientoBaseGr = (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000;
        const masaUtilPorArroba = rendimientoBaseGr * (1 - merma / 100);
        let nuevasArrobas = piqueGr / masaUtilPorArroba;
        return { ...item, piqueGr, arrobas: Number(nuevasArrobas.toFixed(3)) || 0 };
      }
      return { ...item, piqueGr };
    }));
  };




  const resultados = useMemo(() => {
    let latasTotales = 0;
    let horneadasTotales = 0;
    let panesTotales = 0;
    let costoTotal = 0;

    const insumosMap = new Map<string, { cantidad: number, unidad: string, nombre: string }>();

    const rows = items.map(item => {
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      const modelo = modelos.find(m => m.id === item.modeloId);

      if (!formulacion || !modelo) return null;

      const pesoUnitario = modelo.pesoUnitarioGr;
      const merma = modelo.mermaEstimada;
      const rendimientoBaseGr = (formulacion.rendimientoBaseKg || ARROBA_KG) * 1000;
      const masaUtilPorArroba = rendimientoBaseGr * (1 - merma / 100);
      const masaUtilTotal = masaUtilPorArroba * item.arrobas;
      const panes = item.piezas !== undefined ? item.piezas : Math.round(masaUtilTotal / pesoUnitario);
      
      const piezasPorLata = modelo.piezasPorLata || 12;
      const latas = Math.ceil(panes / piezasPorLata);
      const horneadas = Math.ceil(latas / CAPACIDAD_HORNO);

      latasTotales += latas;
      horneadasTotales += horneadas;
      panesTotales += panes;
      costoTotal += formulacion.costoTotalArroba * item.arrobas;

      // Acumular insumos
      formulacion.ingredientes.forEach(ing => {
        const prod = getProductoById(ing.productoId);
        const current = insumosMap.get(ing.productoId) || {
          cantidad: 0,
          unidad: ing.unidad,
          nombre: prod?.nombre || 'Insumo desconocido'
        };
        current.cantidad += ing.cantidadPorArroba * item.arrobas;
        insumosMap.set(ing.productoId, current);
      });

      return {
        ...item,
        formulacionNombre: formulacion.nombre,
        modeloNombre: modelo.nombre,
        panes,
        piqueGr: item.piqueGr !== undefined ? item.piqueGr : panes * pesoUnitario,
        latas,
        piezasPorLata,
        horneadas
      };
    }).filter(Boolean);

    // Calcular sinergia de inventario
    const insumosAlertas = Array.from(insumosMap.entries()).map(([id, data]) => {
      const inv = inventario.find(i => i.productoId === id);
      const stockActual = inv?.stockActual || 0;
      const falta = data.cantidad > stockActual;
      return { ...data, id, stockActual, falta };
    });

    // Resumen de masas objetivo
    const resumenMasas = Object.entries(masasObjetivo)
      .filter(([k]) => !k.includes('_vitina'))
      .map(([formId, targetArrobas]) => {
      const formulacion = formulaciones.find(f => f.id === formId);
      const groupRows = rows.filter(r => r.formulacionId === formId);
      const usedArrobas = groupRows.reduce((sum, r) => sum + r.arrobas, 0);
      
      const targetKg = targetArrobas * ARROBA_KG;
      const usedKg = groupRows.reduce((sum, r) => sum + (r.piqueGr ? r.piqueGr / 1000 : r.arrobas * ARROBA_KG), 0);
      
      return {
        formulacionId: formId,
        nombre: formulacion?.nombre || 'Masa Desconocida',
        targetArrobas,
        usedArrobas,
        targetKg,
        usedKg,
        porcentaje: Math.min(100, Math.max(0, (usedKg / targetKg) * 100))
      };
    }).filter(r => r.targetArrobas > 0);

    return {
      rows,
      latasTotales,
      horneadasTotales,
      panesTotales,
      costoTotal,
      insumosAlertas,
      resumenMasas
    };
  }, [items, formulaciones, modelos, ARROBA_GR, CAPACIDAD_HORNO, getProductoById, inventario, masasObjetivo]);

  // Agrupar items por formulación para el acordeón
  const groupedItems = useMemo(() => {
    const groups: Record<string, PlanItem[]> = {};
    items.forEach(item => {
      if (!item.formulacionId) return;
      if (!groups[item.formulacionId]) groups[item.formulacionId] = [];
      groups[item.formulacionId].push(item);
    });
    return groups;
  }, [items]);

  // Auto-abrir nuevos grupos cuando se agregan masas
  useEffect(() => {
    const ids = items.map(i => i.formulacionId).filter(Boolean);
    setOpenGroups(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handlePrint = () => {
    window.print();
  };

  const formatArrobasToCommon = (val: number) => {
    if (val === 0.25) return '1/4 Arroba';
    if (val === 0.5) return 'Media Arroba';
    if (val === 0.75) return '3/4 Arroba';
    if (val === 1) return '1 Arroba';
    if (val === 1.5) return 'Arroba y media';
    if (val === 2) return '2 Arrobas';
    if (val === 2.5) return '2 Arrobas y media';
    return `${val.toFixed(2)} Arrobas`;
  };

  return (
    <div className="space-y-6">
      {/* Ocultar en impresión */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-500" />
            Plan de Producción Diario
          </h2>
          <p className="text-muted-foreground">Planifica las arrobas a procesar y obtén latas y horneadas exactas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && (
            <Button onClick={() => setIsIaModalOpen(true)} variant="outline" className="gap-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 font-black tracking-widest text-[10px]">
              <BrainCircuit className="w-4 h-4" />
              ✨ Análisis de IA
            </Button>
          )}
          {items.length > 0 && onGuardarComoPlantilla && (
            <Button
              onClick={() => onGuardarComoPlantilla(resultados.rows)}
              variant="outline"
              className="gap-2 rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/20 font-black uppercase tracking-widest text-[10px]"
            >
              <CalendarRange className="w-4 h-4" />
              Guardar como plantilla semanal
            </Button>
          )}
          {items.length > 0 && onLanzarPlan && (
            <Button
              onClick={async () => {
                try {
                  await onLanzarPlan(resultados.rows);
                  setItems([]);
                  localStorage.removeItem('draft_plan_diario');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 animate-pulse"
            >
              🚀 Lanzar a Producción
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
            <Button onClick={handleAddItem} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-[11px] h-10 px-6 uppercase tracking-wider shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" />
            Registrar Producción
          </Button>
        </div>
      </div>

      {/* Modal Simulador */}
      <Dialog open={isSimuladorOpen} onOpenChange={setIsSimuladorOpen}>
        <DialogContent className="sm:max-w-[1000px] bg-slate-50 dark:bg-slate-900 p-0 overflow-hidden border-0">
          <div className="max-h-[90vh] overflow-y-auto custom-scrollbar p-6">
            <DistribuidorArroba
              productos={productos}
              formulaciones={formulaciones}
              modelos={modelos}
              ventas={ventas || []}
              onAñadirAlPlan={handleAñadirDesdeSimulador}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Análisis IA */}
      <IaAnalysisModal
        isOpen={isIaModalOpen}
        onClose={() => setIsIaModalOpen(false)}
        formulaciones={formulaciones}
        modelos={modelos}
        resumenMasas={resultados.resumenMasas}
        sobranteFisico={sobranteFisico}
        groupedItems={groupedItems}
      />

      {/* Modal Análisis IA Especialista */}
      {analisisIaItem && (() => {
        const rowResult = resultados.rows.find(r => r?.id === analisisIaItem.id);
        const modelo = modelos.find(m => m.id === analisisIaItem.modeloId);
        const form = formulaciones.find(f => f.id === analisisIaItem.formulacionId);
        if (!rowResult || !modelo) return null;

        return (
          <Dialog open={!!analisisIaItem} onOpenChange={(open) => !open && setAnalisisIaItem(null)}>
            <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/30 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
              <DialogHeader className="px-6 py-5 border-b border-indigo-500/20 bg-indigo-950/50 flex flex-row items-center gap-4 space-y-0">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                  <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white leading-tight">Análisis Especialista</DialogTitle>
                  <p className="text-xs text-indigo-300 font-medium">Asistente de Producción (IA)</p>
                </div>
              </DialogHeader>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Interpretación de Masas</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Para producir <strong className="text-white">{rowResult.panes} unidades</strong> de <strong className="text-white">{modelo.nombre}</strong>, vas a necesitar un pique exacto de <strong className="text-white">{(rowResult.piqueGr / 1000).toFixed(2)} kg</strong> de masa cruda. 
                    <br/><br/>
                    A simple vista, esto equivale a <strong className="text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded text-base">{formatArrobaEspanol(rowResult.piqueGr)}</strong>, lo que facilita el cálculo rápido al panadero.
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Eficiencia de Horneado</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Las <strong className="text-white">{rowResult.panes} piezas</strong> ocuparán <strong className="text-white">{rowResult.latas} latas</strong> (a razón de {modelo.piezasPorLata || 12} unidades por lata). 
                    Esto requerirá un total de <strong className="text-white">{rowResult.horneadas} pasadas por el horno</strong> (horneadas) aprovechando la capacidad de {CAPACIDAD_HORNO} latas por ciclo.
                  </p>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start mt-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-100/80 leading-relaxed">
                    <strong className="text-emerald-300 block mb-1">Recomendación Óptima:</strong>
                    Asegúrate de preparar los empastes de esta formulación ({form?.nombre}) usando exactamente el número de cortes indicados en la tabla general de amasijo.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 print:bg-transparent print:border-b-2">
              <CardTitle className="text-lg">Masas a procesar</CardTitle>
              <CardDescription className="flex items-center gap-4 text-xs mt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <strong className="text-emerald-700 dark:text-emerald-400 font-black">{resultados.panesTotales}</strong> Piezas totales
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <strong className="text-orange-700 dark:text-orange-400 font-black">{resultados.latasTotales}</strong> Latas en total
                </span>
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border/50 rounded-md p-1 shadow-sm">
                  <Input 
                    type="date" 
                    value={fechaPlan}
                    onChange={(e) => setFechaPlan(e.target.value)}
                    className="h-7 w-36 text-xs border-none focus-visible:ring-0 px-2"
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (addPlanDiario) {
                      const masasObj = Object.entries(masasObjetivo)
                        .filter(([k]) => !k.includes('_vitina'))
                        .map(([fId, arr]) => ({
                          formulacionId: fId,
                          nombre: formulaciones.find(f => f.id === fId)?.nombre || 'Desconocida',
                          arrobas: arr as number,
                        }));
                      addPlanDiario({
                        fecha: fechaPlan,
                        masasObjetivo: masasObj,
                        items: items.map(i => ({
                          id: i.id,
                          formulacionId: i.formulacionId,
                          modeloId: i.modeloId,
                          arrobas: i.arrobas,
                          piezas: resultados.rows.find(r => r?.id === i.id)?.panes || 0,
                          piqueGr: i.piqueGr !== undefined ? i.piqueGr : (resultados.rows.find(r => r?.id === i.id)?.piqueGr)
                        }))
                      }).then(() => {
                        setItems([]);
                        setMasasObjetivo({});
                      });
                    }
                  }}
                  disabled={items.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Guardar Plan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItems([]);
                    setMasasObjetivo({});
                  }}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
            {false && resultados.resumenMasas.length > 0 && (
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/50 flex flex-col gap-4">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-500" />
                  Control de Masas a Mojar
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {resultados.resumenMasas.map(masa => {
                    const estaSobregirado = masa.porcentaje > 100;
                    const form = formulaciones.find(f => f.id === masa.formulacionId);
                    const empaste = form?.empasteConfig;
                    
                    return (
                      <div key={masa.formulacionId} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                          onClick={() => {
                            setMasasObjetivo(prev => {
                              const next = { ...prev };
                              delete next[masa.formulacionId];
                              return next;
                            });
                          }}
                          title="Quitar medidor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>

                        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-800">
                          <div 
                            className={cn("h-full transition-all duration-700 ease-out", 
                              estaSobregirado ? "bg-rose-500" : (masa.porcentaje > 95 ? "bg-amber-500" : "bg-emerald-500")
                            )} 
                            style={{ width: `${Math.min(100, masa.porcentaje)}%` }} 
                          />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-2">
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">{masa.nombre}</h4>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Masa Total Disponible</h4>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-slate-900 dark:text-white">{masa.targetKg.toFixed(2)}</span>
                              <span className="text-lg font-bold text-slate-500">kg</span>
                            </div>
                            <div className="text-xs text-slate-500 font-bold mt-1 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md">
                              ({(masa.targetKg * 2.20462).toFixed(2)} lb | {(masa.targetKg * 1000).toFixed(0)} g)
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 hidden md:flex text-slate-200 dark:text-slate-700">
                            <ArrowRight className="w-8 h-8" />
                          </div>
          
                          <div className="text-right flex-1 w-full flex gap-4 md:gap-8 justify-between md:justify-end">
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Utilizada</h4>
                              <span className={cn("text-2xl font-black", estaSobregirado ? "text-rose-500" : "text-emerald-500")}>
                                {masa.usedKg.toFixed(2)} <span className="text-sm">kg</span>
                              </span>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sobrante</h4>
                              <span className={cn("text-2xl font-black", (masa.targetKg - masa.usedKg) < 0 ? "text-rose-500" : "text-amber-500")}>
                                {(masa.targetKg - masa.usedKg).toFixed(2)} <span className="text-sm">kg</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Guía de Empaste (Dinámica o Manual) */}
                        {(() => {

                          if (empaste && empaste.porcentajeVitina > 0 && empaste.cortesPorArroba > 0) {
                            return (
                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-2xl">
                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                  <Flame className="w-4 h-4" />
                                  <span className="text-[11px] font-bold uppercase tracking-widest">Empaste ({empaste.porcentajeVitina}%)</span>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                  <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">{empaste.cortesPorArroba} Cortes/Arroba</span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                      {masa.targetKg > 0 ? (masa.targetKg / (masasObjetivo[masa.formulacionId] * empaste.cortesPorArroba || empaste.cortesPorArroba)).toFixed(2) : 0} kg c/u
                                    </span>
                                  </div>
                                  <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800" />
                                  <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Vitina por Corte</span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                      {masa.targetKg > 0 ? ((masa.targetKg * 1000 * (empaste.porcentajeVitina / 100)) / (masasObjetivo[masa.formulacionId] * empaste.cortesPorArroba || empaste.cortesPorArroba)).toFixed(0) : 0} g
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground print:hidden">
                <Calculator className="w-14 h-14 mx-auto mb-4 opacity-10" />
                <p className="font-bold text-slate-400">Agrega masas para comenzar a planificar el día</p>
                <p className="text-xs text-slate-300 mt-1">Usá el botón <strong>+ Agregar</strong> o el Registro de Producción</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {Object.entries(groupedItems).map(([formulacionId, groupItems]) => {
                  const formulacion = formulaciones.find(f => f.id === formulacionId);
                  const isOpen = openGroups.has(formulacionId);
                  const groupRows = groupItems
                    .map(item => resultados.rows.find(r => r?.id === item.id))
                    .filter((r): r is NonNullable<typeof r> => !!r);
                  const totalPanes = groupRows.reduce((s, r) => s + r.panes, 0);
                  const totalLatas = groupRows.reduce((s, r) => s + r.latas, 0);
                  const totalArrobas = groupItems.reduce((s, i) => s + i.arrobas, 0);
                  const vitinasDeModelos = groupItems.map(item => {
                    const mod = modelos.find(m => m.id === item.modeloId);
                    const rRow = resultados.rows.find(r => r?.id === item.id);
                    const piezas = rRow?.panes || 0;
                    
                    if (mod?.piqueEmpaste && mod.piqueEmpaste.cantidadInsumo) {
                      const merma = mod.mermaEstimada || 0;
                      const pesoTotalMasaParaPanes = (piezas * mod.pesoUnitarioGr) / (1 - merma / 100);
                      const numPiques = pesoTotalMasaParaPanes / mod.piqueEmpaste.pesoMasaGr;
                      
                      const unit = mod.piqueEmpaste.unidadInsumo;
                      const cant = mod.piqueEmpaste.cantidadInsumo * numPiques;
                      const vitinaGr = unit === 'kg' ? cant * 1000 : unit === 'lb' ? cant * 453.592 : cant;
                      
                      return {
                        cortes: mod.piqueEmpaste.cortes * numPiques,
                        vitinaGr: vitinaGr
                      };
                    }
                    return null;
                  }).filter(Boolean);

                  const numCortes = Math.round(vitinasDeModelos.reduce((sum, v) => sum + (v?.cortes || 0), 0));
                  const totalVitinaGr = vitinasDeModelos.reduce((sum, v) => sum + (v?.vitinaGr || 0), 0);
                  const isMasaSalMixta = formulacion?.nombre.toLowerCase().includes('mixta') || false;
                  const hasEmpaste = numCortes > 0 && totalVitinaGr > 0 && !isMasaSalMixta;
                  // Datos de objetivo vs utilizado
                  const masaData = resultados.resumenMasas.find(m => m.formulacionId === formulacionId);
                  const utilizadaKg = masaData?.usedKg || 0;
                  const disponibleKg = masaData?.targetKg ?? 0;
                  const sobranteKg = disponibleKg - utilizadaKg;
                  const progreso = disponibleKg > 0 ? Math.min(100, (utilizadaKg / disponibleKg) * 100) : 0;
                  const sobregirado = progreso >= 100 && disponibleKg > 0;

                  // Lógica de auditoría
                  const sobFisicoValue = sobranteFisico[formulacionId];
                  const isAuditing = editingSobrante[formulacionId] !== undefined;
                  const sobFisicoNum = parseFloat(sobFisicoValue || '0');
                  const hasFisico = sobFisicoValue !== undefined && sobFisicoValue !== '';
                  const desviacionKg = hasFisico ? (sobranteKg - sobFisicoNum) : 0;
                  // Tolerancia de 0.20 kg (200 gramos)
                  const hasDesperdicioAnormal = hasFisico && desviacionKg > 0.2;
                  const hasExcesoAnormal = hasFisico && desviacionKg < -0.2;

                  return (
                    <div key={formulacionId} className="last:border-b-0">
                      {/* ─── Cabecera del acordeón (Tipo de Masa) ─── */}
                      <button
                        className="w-full flex flex-col px-5 py-3 hover:bg-muted/20 transition-colors text-left relative"
                        onClick={() => toggleGroup(formulacionId)}
                      >
                        {/* Barra de progreso */}
                        {disponibleKg > 0 && (
                          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn("h-full transition-all duration-700", sobregirado ? "bg-rose-500" : progreso > 85 ? "bg-amber-400" : "bg-emerald-400")}
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                        )}

                        {/* Contenido principal */}
                        <div className="flex flex-col w-full gap-2">
                          {/* Fila superior: Chevron + Título */}
                          <div className="flex items-center gap-3 w-full">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                              isOpen ? "bg-indigo-100 dark:bg-indigo-900/50" : "bg-muted/50"
                            )}>
                              <ChevronDown className={cn(
                                "w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform duration-300",
                                isOpen && "rotate-180"
                              )} />
                            </div>
                            
                            {/* Título horizontal sin salto de línea */}
                            <div className="flex items-center flex-wrap gap-2">
                              <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white uppercase tracking-wide whitespace-nowrap">
                                {formulacion?.nombre || 'Masa sin nombre'}
                              </h3>
                              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                                ({groupItems.length} {groupItems.length === 1 ? 'producto' : 'productos'})
                              </span>
                            </div>
                          </div>

                          {/* Fila inferior: Stats compactos */}
                          <div className="flex items-center gap-2 flex-wrap justify-between w-full sm:pl-11">
                            {/* Masa Disponible / Utilizada / Sobrante */}
                            {disponibleKg > 0 && (
                              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Disponible:</span>
                                    <span className="text-slate-700 dark:text-slate-300 text-sm">{disponibleKg.toFixed(2)} kg</span>
                                  </div>
                                  <span className="text-[9px] text-slate-400/80 font-medium leading-none mt-0.5">{(disponibleKg * 1000).toFixed(0)}g | {(disponibleKg * 2.20462).toFixed(2)}lb</span>
                                </div>
                                <span className="text-slate-200 dark:text-slate-700 mx-2">|</span>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Gastado:</span>
                                    <span className={cn(sobregirado ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400", "text-sm")}>{utilizadaKg.toFixed(2)} kg</span>
                                  </div>
                                  <span className="text-[9px] text-slate-400/80 font-medium leading-none mt-0.5">{(utilizadaKg * 1000).toFixed(0)}g | {(utilizadaKg * 2.20462).toFixed(2)}lb</span>
                                </div>
                                <span className="text-slate-200 dark:text-slate-700 mx-2">|</span>
                                
                                {/* Auditoría de Sobrante */}
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 gap-2">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">Sobrante:</span>
                                      <span className={cn(sobranteKg < 0 ? "text-rose-500" : "text-amber-500", "text-sm mr-1")}>{Math.abs(sobranteKg).toFixed(2)} kg</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400/80 font-medium leading-none mt-0.5">{(Math.abs(sobranteKg) * 1000).toFixed(0)}g | {(Math.abs(sobranteKg) * 2.20462).toFixed(2)}lb</span>
                                  </div>
                                  
                                  {isAuditing ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number" step="0.1" min="0" autoFocus
                                        className="h-6 w-16 text-xs px-1 py-0 text-center border-indigo-200 dark:border-indigo-800"
                                        placeholder="kg real"
                                        value={editingSobrante[formulacionId] || ''}
                                        onChange={e => setEditingSobrante(prev => ({ ...prev, [formulacionId]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            setSobranteFisico(prev => ({ ...prev, [formulacionId]: editingSobrante[formulacionId] }));
                                            setEditingSobrante(prev => { const next = { ...prev }; delete next[formulacionId]; return next; });
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingSobrante(prev => { const next = { ...prev }; delete next[formulacionId]; return next; });
                                          }
                                        }}
                                        onBlur={() => {
                                          setSobranteFisico(prev => ({ ...prev, [formulacionId]: editingSobrante[formulacionId] }));
                                          setEditingSobrante(prev => { const next = { ...prev }; delete next[formulacionId]; return next; });
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSobrante(prev => ({ ...prev, [formulacionId]: sobranteFisico[formulacionId] || '' }));
                                      }}
                                      className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
                                        hasFisico ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400" : "bg-white dark:bg-slate-700 text-slate-500 hover:bg-slate-200"
                                      )}
                                      title="Auditar Sobrante Físico"
                                    >
                                      <Scale className="w-3 h-3" />
                                      {hasFisico ? `${sobFisicoNum.toFixed(2)} kg` : 'Físico'}
                                    </button>
                                  )}

                                  {/* Alertas de Desviación */}
                                  {hasDesperdicioAnormal && (
                                    <div className="flex items-center gap-1 text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-400 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                                      <AlertTriangle className="w-3 h-3" />
                                      Faltan {desviacionKg.toFixed(2)}kg
                                    </div>
                                  )}
                                  {hasExcesoAnormal && (
                                    <div className="flex items-center gap-1 text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px]">
                                      <AlertTriangle className="w-3 h-3" />
                                      Sobran {Math.abs(desviacionKg).toFixed(2)}kg
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {!disponibleKg && (
                              <span className="hidden sm:inline text-xs font-bold text-slate-400">{totalArrobas.toFixed(2)} arrobas</span>
                            )}
                            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg px-2.5 py-1.5 ml-2">
                              <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">{totalPanes}</span>
                              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-500">pzas</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-lg px-2.5 py-1.5">
                              <span className="font-black text-orange-700 dark:text-orange-400 text-sm">{totalLatas}</span>
                              <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-500">latas</span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* ─── Cuerpo del acordeón ─── */}
                      {isOpen && (
                        <div className="bg-slate-50/60 dark:bg-slate-900/30 border-t border-border/30 px-4 pb-5 pt-3 space-y-4">

                          {/* Guía de Empaste (Vitina) */}
                          {hasEmpaste && (
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <Flame className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest">Guía de Empaste (Vitina)</span>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-2">
                                <div className="bg-white dark:bg-slate-800 rounded-xl px-3 py-1.5 border border-indigo-100 dark:border-indigo-800 text-center">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Cortes</span>
                                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">{numCortes}</span>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl px-3 py-1.5 border border-indigo-100 dark:border-indigo-800 text-center">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Vitina total</span>
                                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {totalVitinaGr >= 1000 ? `${(totalVitinaGr / 1000).toFixed(2)} kg` : `${Math.round(totalVitinaGr)} g`}
                                  </span>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl px-3 py-1.5 border border-indigo-100 dark:border-indigo-800 text-center">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Por corte</span>
                                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                    {numCortes > 0
                                      ? (totalVitinaGr / numCortes >= 1000
                                        ? `${((totalVitinaGr / numCortes) / 1000).toFixed(2)} kg`
                                        : `${Math.round(totalVitinaGr / numCortes)} g`)
                                      : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ─── Filas de productos ─── */}
                          <div className="space-y-2">
                            {groupItems.map((item) => {
                              const rowResult = resultados.rows.find(r => r?.id === item.id);
                              return (
                                <div key={item.id} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-border/50 flex flex-col md:flex-row gap-3 items-center group transition-all hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md shadow-sm">

                                  {/* Pique editable (Izquierda) */}
                                  {rowResult && (
                                      <div 
                                        className="flex flex-col items-center justify-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900 w-24 group/edit shrink-0 cursor-text transition-all hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                        onClick={() => {
                                          if (editingPique[item.id] === undefined) {
                                            setEditingPique(prev => ({ ...prev, [item.id]: String(rowResult.piqueGr) }));
                                          }
                                        }}
                                        title="Clic → escribí gramos → Enter para confirmar"
                                      >
                                        {editingPique[item.id] !== undefined ? (
                                          <Input
                                            type="number" min="0" autoFocus
                                            className="h-8 text-center font-black text-base border-none shadow-none bg-transparent w-full p-0 focus-visible:ring-1 focus-visible:ring-blue-500 text-blue-700 dark:text-blue-400"
                                            value={editingPique[item.id]}
                                            onChange={e => setEditingPique(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            onBlur={() => {
                                              const val = parseInt(editingPique[item.id]) || 0;
                                              handleUpdatePique(item.id, val);
                                              setEditingPique(prev => { const next = { ...prev }; delete next[item.id]; return next; });
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                              if (e.key === 'Escape') {
                                                setEditingPique(prev => { const next = { ...prev }; delete next[item.id]; return next; });
                                              }
                                            }}
                                          />
                                        ) : (
                                          <div className="flex flex-col items-center mt-1">
                                            <span className="font-black text-base text-blue-700 dark:text-blue-400 leading-none">{rowResult.piqueGr} g</span>
                                            {rowResult.piqueGr >= 1000 && (
                                              <span className="text-[10px] font-bold text-blue-600 mt-0.5">{(rowResult.piqueGr/1000).toFixed(2)} kg</span>
                                            )}
                                            {rowResult.piqueGr > 0 && (
                                              <span className="text-[9px] mt-1 font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-md text-center leading-tight">
                                                {formatArrobaEspanol(rowResult.piqueGr)}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        <span className="text-[8px] uppercase font-black tracking-widest mt-1 text-blue-600 opacity-60 group-hover/edit:opacity-100">Pique ✎</span>
                                      </div>
                                  )}

                                  {/* Selector de producto */}
                                  <div className="flex-1 w-full min-w-[160px]">
                                    <Select value={item.modeloId} onValueChange={v => handleUpdateItem(item.id, 'modeloId', v)}>
                                      <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Seleccioná el producto" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {modelos.filter(m => m.formulacionId === formulacionId && m.activo).map(m => (
                                          <SelectItem key={m.id} value={m.id}>
                                            {m.nombre} ({m.piezasPorLata || 12} pz/lata)
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Resultados editables (Derecha) */}
                                  {rowResult ? (
                                    <div className="flex flex-row gap-2 shrink-0">
                                      {/* Piezas */}
                                      <div className="flex flex-col items-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900 w-16 group/edit">
                                        <Input
                                          type="number" min="0"
                                          className="h-6 text-center font-black text-sm border-none shadow-none bg-transparent w-full p-0 focus-visible:ring-1 focus-visible:ring-emerald-500 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                                          value={rowResult.panes}
                                          onChange={e => handleUpdatePiezas(item.id, parseInt(e.target.value) || 0)}
                                          title="Editar Piezas"
                                        />
                                        <span className="text-[7px] uppercase font-black tracking-widest mt-0.5 text-emerald-600 opacity-60 group-hover/edit:opacity-100">Pzas ✎</span>
                                      </div>
                                      {/* Latas */}
                                      <div className="flex flex-col items-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-900 w-16 group/edit">
                                        <Input
                                          type="number" min="0"
                                          className="h-6 text-center font-black text-sm border-none shadow-none bg-transparent w-full p-0 focus-visible:ring-1 focus-visible:ring-orange-500 text-orange-700 dark:text-orange-400 cursor-pointer"
                                          value={rowResult.latas}
                                          onChange={e => handleUpdateLatas(item.id, parseInt(e.target.value) || 0)}
                                          title="Editar Latas"
                                        />
                                        <span className="text-[7px] uppercase font-black tracking-widest mt-0.5 text-orange-600 opacity-60 group-hover/edit:opacity-100">Latas ✎</span>
                                      </div>
                                      {/* Hornos */}
                                      <div className="flex flex-col items-center justify-center p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 w-14">
                                        <span className="font-black text-sm leading-none h-6 flex items-center text-indigo-700 dark:text-indigo-400">{rowResult.horneadas}</span>
                                        <span className="text-[7px] uppercase font-black tracking-widest mt-0.5 text-indigo-600">Hornos</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground border border-dashed rounded-xl px-3 py-2 shrink-0">
                                      Seleccioná producto
                                    </div>
                                  )}

                                  {/* Análisis IA */}
                                  <Button
                                    variant="ghost" size="icon"
                                    className="text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors shrink-0 h-8 w-8"
                                    onClick={() => setAnalisisIaItem(item)}
                                    title="Análisis IA Especialista"
                                  >
                                    <Bot className="w-5 h-5" />
                                  </Button>

                                  {/* Eliminar */}
                                  <Button
                                    variant="ghost" size="icon"
                                    className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0 h-8 w-8"
                                    onClick={() => handleRemoveItem(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </CardContent>
          </Card>
        </div>

        {/* Panel Lateral: Totales y Alertas */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-4 border-b border-slate-700 print:border-black print:text-black">
              <CardTitle className="text-lg">Resumen Diario</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-black text-emerald-400">{resultados.panesTotales}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Piezas Totales</p>
                </div>
                <div className="text-center border-l border-slate-700">
                  <p className="text-3xl font-black text-orange-400">{resultados.latasTotales}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Latas Totales</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Ciclos de Horno</p>
                  <p className="text-xl font-black text-indigo-100">{resultados.horneadasTotales} Horneadas</p>
                </div>
                <Package className="w-8 h-8 text-indigo-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Sinergia con Inventario */}
          <Card className="rounded-2xl shadow-md border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                Insumos Requeridos
              </CardTitle>
              <CardDescription>Cantidades consolidadas para la producción del día</CardDescription>
            </CardHeader>
            <CardContent>
              {resultados.insumosAlertas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No hay insumos calculados aún</p>
              ) : (
                <div className="space-y-3">
                  {resultados.insumosAlertas.map((ins, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 bg-muted/30 rounded-lg border border-border/50 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold truncate pr-2">{ins.nombre}</span>
                        <Badge variant={ins.falta ? "destructive" : "secondary"} className="shrink-0">
                          Req: {ins.cantidad.toFixed(2)} {ins.unidad}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          Stock actual: {ins.stockActual.toFixed(2)} {ins.unidad}
                        </span>
                        {ins.falta && (
                          <span className="text-red-500 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Faltan {(ins.cantidad - ins.stockActual).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Historial de Planes Guardados */}
      <div className="mt-8">
        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Historial de Planes Guardados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(!planesDiarios || planesDiarios.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay planes guardados aún.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...planesDiarios]
                  .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((plan) => {
                    const totalPiezas = plan.items?.reduce((acc: number, item: any) => acc + (item.piezas || 0), 0) || 0;
                    return (
                      <div key={plan.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-300 transition-colors group relative">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            {plan.fecha}
                          </h4>
                          {deletePlanDiario && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (window.confirm('¿Seguro que deseas eliminar este plan guardado?')) {
                                  deletePlanDiario(plan.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1 mt-3">
                          <p className="text-xs text-slate-500">
                            <strong className="text-slate-700 dark:text-slate-300">{plan.masasObjetivo?.length || 0}</strong> masas planificadas
                          </p>
                          <p className="text-xs text-slate-500">
                            <strong className="text-slate-700 dark:text-slate-300">{plan.items?.length || 0}</strong> modelos diferentes
                          </p>
                          <p className="text-xs text-slate-500">
                            <strong className="text-emerald-600 dark:text-emerald-400">{totalPiezas}</strong> piezas estimadas
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .shadow-lg, .shadow-md { box-shadow: none !important; }
          .bg-slate-900 { background-color: white !important; color: black !important; border: 2px solid black !important; }
          .text-slate-400 { color: #666 !important; }
          .text-emerald-400, .text-orange-400, .text-indigo-100 { color: black !important; }
        }
      `}</style>
    </div>
  );
}
