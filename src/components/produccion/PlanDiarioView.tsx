import { generateUUID } from '@/lib/safe-utils';
import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  Printer,
  Calculator,
  Scale,
  Package,
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormulacionBase, ModeloPan, Producto, Configuracion, InventarioItem } from '@/types';

interface PlanDiarioViewProps {
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  getProductoById: (id: string) => Producto | undefined;
  inventario: InventarioItem[];
  configuracion: Configuracion;
  formatCurrency: (value: number) => string;
}

interface PlanItem {
  id: string;
  formulacionId: string;
  modeloId: string;
  arrobas: number;
}

export function PlanDiarioView({
  formulaciones,
  modelos,
  getProductoById,
  inventario,
  configuracion,
  formatCurrency
}: PlanDiarioViewProps) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const ARROBA_KG = configuracion.pesoArrobaKg || 11.5;
  const ARROBA_GR = ARROBA_KG * 1000;
  const CAPACIDAD_HORNO = configuracion.latasPorHorno || 4;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: generateUUID(),
        formulacionId: '',
        modeloId: '',
        arrobas: 1
      }
    ]);
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
      const masaUtilPorArroba = ARROBA_GR * (1 - merma / 100);
      const panesPorArroba = Math.floor(masaUtilPorArroba / pesoUnitario);
      const panes = panesPorArroba * item.arrobas;
      
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

    return {
      rows,
      latasTotales,
      horneadasTotales,
      panesTotales,
      costoTotal,
      insumosAlertas
    };
  }, [items, formulaciones, modelos, ARROBA_GR, CAPACIDAD_HORNO, getProductoById, inventario]);

  const handlePrint = () => {
    window.print();
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
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Printer className="w-4 h-4" />
            Imprimir Plan
          </Button>
          <Button onClick={handleAddItem} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Añadir Masa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 print:bg-transparent print:border-b-2">
              <CardTitle className="text-lg">Masas a procesar</CardTitle>
              <CardDescription>
                Horno actual: <strong className="text-foreground">{CAPACIDAD_HORNO} latas</strong> por ciclo | 
                Arroba: <strong className="text-foreground">{ARROBA_KG} Kg</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground print:hidden">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Agrega masas para comenzar a planificar el día</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {items.map((item, idx) => {
                    const rowResult = resultados.rows.find(r => r?.id === item.id);
                    return (
                      <div key={item.id} className="p-4 flex flex-col md:flex-row gap-4 items-center group transition-colors hover:bg-muted/10">
                        {/* Selector de Arrobas */}
                        <div className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-xl min-w-[100px] border border-border/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Arrobas</span>
                          <Input
                            type="number"
                            step="0.25"
                            min="0"
                            className="h-10 text-center font-bold text-lg border-none shadow-none bg-transparent w-20 p-0 focus-visible:ring-0"
                            value={item.arrobas}
                            onChange={e => handleUpdateItem(item.id, 'arrobas', Number(e.target.value))}
                          />
                        </div>

                        {/* Selectores */}
                        <div className="flex-1 space-y-3 w-full">
                          <Select value={item.formulacionId} onValueChange={v => handleUpdateItem(item.id, 'formulacionId', v)}>
                            <SelectTrigger className="h-10 rounded-xl">
                              <SelectValue placeholder="Tipo de masa (Formulación)" />
                            </SelectTrigger>
                            <SelectContent>
                              {formulaciones.filter(f => f.activo).map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={item.modeloId} onValueChange={v => handleUpdateItem(item.id, 'modeloId', v)} disabled={!item.formulacionId}>
                            <SelectTrigger className="h-10 rounded-xl">
                              <SelectValue placeholder="Producto a fabricar" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelos.filter(m => m.formulacionId === item.formulacionId && m.activo).map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.nombre} ({m.piezasPorLata || 12} pz/lata)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Resultados Individuales */}
                        <div className="w-full md:w-auto flex flex-row md:flex-col gap-2 justify-end min-w-[140px]">
                          {rowResult ? (
                            <>
                              <div className="flex flex-col items-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex-1">
                                <span className="font-black text-lg leading-none">{rowResult.panes}</span>
                                <span className="text-[9px] uppercase font-bold tracking-widest mt-1">Piezas</span>
                              </div>
                              <div className="flex gap-2 flex-1">
                                <div className="flex flex-col items-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900 flex-1">
                                  <span className="font-black text-lg leading-none">{rowResult.latas}</span>
                                  <span className="text-[9px] uppercase font-bold tracking-widest mt-1">Latas</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex-1">
                                  <span className="font-black text-lg leading-none">{rowResult.horneadas}</span>
                                  <span className="text-[9px] uppercase font-bold tracking-widest mt-1">Hornos</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex items-center justify-center p-4 text-xs text-muted-foreground border border-dashed rounded-xl">
                              Completa campos
                            </div>
                          )}
                        </div>

                        {/* Borrar */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                <FlaskConical className="w-4 h-4 text-primary" />
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
