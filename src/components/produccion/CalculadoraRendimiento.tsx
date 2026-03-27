import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Scale,
  Package,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Croissant,
  FlaskConical,
  RefreshCw,
  Target,
  Percent
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormulacionBase, ModeloPan, Producto } from '@/types';

interface CalculadoraRendimientoProps {
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  getProductoById: (id: string) => Producto | undefined;
  formatCurrency: (value: number) => string;
}

const ARROBA_KG = 11.5;
const ARROBA_GR = ARROBA_KG * 1000;

export function CalculadoraRendimiento({
  formulaciones,
  modelos,
  getProductoById,
  formatCurrency
}: CalculadoraRendimientoProps) {
  // Estado de la calculadora
  const [modo, setModo] = useState<'arrobas' | 'panes' | 'peso'>('arrobas');
  const [formulacionId, setFormulacionId] = useState('');
  const [modeloId, setModeloId] = useState('');

  // Entradas según el modo
  const [arrobasInput, setArrobasInput] = useState(1);
  const [panesInput, setPanesInput] = useState(100);
  const [pesoInput, setPesoInput] = useState(80); // gramos

  // Obtener datos
  const formulacion = useMemo(() => formulaciones.find(f => f.id === formulacionId), [formulaciones, formulacionId]);
  const modelo = useMemo(() => modelos.find(m => m.id === modeloId), [modelos, modeloId]);

  // Cálculos
  const resultados = useMemo(() => {
    if (!formulacion) {
      return null;
    }

    const pesoUnitario = modelo?.pesoUnitarioGr || pesoInput;
    const merma = modelo?.mermaEstimada || 5;
    const masaUtilPorArroba = ARROBA_GR * (1 - merma / 100);
    const panesPorArroba = Math.floor(masaUtilPorArroba / pesoUnitario);

    let arrobas: number;
    let panes: number;

    switch (modo) {
      case 'arrobas':
        arrobas = arrobasInput;
        panes = panesPorArroba * arrobas;
        break;
      case 'panes':
        panes = panesInput;
        arrobas = panesInput / panesPorArroba;
        break;
      case 'peso':
        // Cuántos panes de X gramos salen de 1 arroba
        arrobas = 1;
        panes = panesPorArroba;
        break;
      default:
        arrobas = 1;
        panes = panesPorArroba;
    }

    const costoTotalFormulacion = formulacion.costoTotalArroba * arrobas;
    const costoUnitario = costoTotalFormulacion / panes;
    const precioVenta = modelo?.precioVentaUnitario || costoUnitario * 1.4;
    const ventaTotal = precioVenta * panes;
    const gananciaTotal = ventaTotal - costoTotalFormulacion;
    const margen = (gananciaTotal / ventaTotal) * 100;

    // Desglose de ingredientes necesarios
    const ingredientesNecesarios = formulacion.ingredientes.map(ing => ({
      ...ing,
      cantidadTotal: ing.cantidadPorArroba * arrobas,
      costoTotal: ing.costoTotalArroba * arrobas
    }));

    return {
      arrobas: Math.ceil(arrobas * 100) / 100,
      panes,
      panesPorArroba,
      pesoUnitario,
      masaTotalKg: arrobas * ARROBA_KG,
      masaUtilKg: arrobas * (ARROBA_KG * (1 - merma / 100)),
      mermaKg: arrobas * (ARROBA_KG * merma / 100),
      costoTotalFormulacion,
      costoUnitario,
      precioVenta,
      ventaTotal,
      gananciaTotal,
      margen,
      ingredientesNecesarios
    };
  }, [formulacion, modelo, modo, arrobasInput, panesInput, pesoInput]);

  // Reset
  const handleReset = () => {
    setArrobasInput(1);
    setPanesInput(100);
    setPesoInput(80);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Calculadora de Rendimiento</h2>
            <p className="text-xs text-muted-foreground">Calcula panes, costos y necesidades de insumos</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 rounded-xl">
          <RefreshCw className="w-4 h-4" />
          Reiniciar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Entrada */}
        <Card className="lg:col-span-1 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Seleccionar Formulación */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Formulación Base</label>
              <Select value={formulacionId} onValueChange={setFormulacionId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {formulaciones.filter(f => f.activo).map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-3 h-3" />
                        {f.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleccionar Modelo (opcional) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modelo de Pan (opcional)</label>
              <Select value={modeloId || 'none'} onValueChange={(val) => setModeloId(val === 'none' ? '' : val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Personalizado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personalizado</SelectItem>
                  {modelos.filter(m => m.formulacionId === formulacionId).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <Croissant className="w-3 h-3" />
                        {m.nombre} ({m.pesoUnitarioGr}g)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modo de Cálculo */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Calcular desde</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'arrobas', label: 'Arrobas', icon: Scale },
                  { value: 'panes', label: 'Panes', icon: Package },
                  { value: 'peso', label: 'Peso', icon: Percent },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={modo === value ? 'default' : 'outline'}
                    className={cn(
                      "flex flex-col gap-1 h-auto py-3 rounded-xl",
                      modo === value && "bg-indigo-600 hover:bg-indigo-700"
                    )}
                    onClick={() => setModo(value as any)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Input según modo */}
            <div className="space-y-3 pt-4 border-t">
              {modo === 'arrobas' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold">Cantidad de Arrobas</label>
                    <Badge variant="outline">{arrobasInput}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[arrobasInput]}
                      onValueChange={([v]) => setArrobasInput(v)}
                      min={0.5}
                      max={20}
                      step={0.5}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={arrobasInput}
                      onChange={(e) => setArrobasInput(Number(e.target.value))}
                      className="w-20 rounded-lg text-center"
                    />
                  </div>
                </div>
              )}

              {modo === 'panes' && (
                <div className="space-y-3">
                  <label className="text-sm font-bold">¿Cuántos panes necesitas?</label>
                  <Input
                    type="number"
                    value={panesInput}
                    onChange={(e) => setPanesInput(Number(e.target.value))}
                    className="rounded-xl text-center text-lg font-bold"
                    placeholder="100"
                  />
                  <p className="text-[10px] text-muted-foreground text-center">
                    Se calculará cuántas arrobas necesitas
                  </p>
                </div>
              )}

              {modo === 'peso' && !modeloId && (
                <div className="space-y-3">
                  <label className="text-sm font-bold">Peso por pan (gramos)</label>
                  <Input
                    type="number"
                    value={pesoInput}
                    onChange={(e) => setPesoInput(Number(e.target.value))}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Panel de Resultados */}
        <Card className="lg:col-span-2 rounded-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              Resultados de Producción
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!formulacion ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Selecciona una formulación para calcular</p>
              </div>
            ) : resultados && (
              <div className="space-y-6">
                {/* KPIs Principales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-xl text-center">
                    <Scale className="w-5 h-5 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-black text-blue-600">{resultados.arrobas}</p>
                    <p className="text-xs text-blue-500/70">Arrobas</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{resultados.masaTotalKg.toFixed(1)} kg masa</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-4 rounded-xl text-center">
                    <Package className="w-5 h-5 mx-auto text-emerald-500 mb-2" />
                    <p className="text-2xl font-black text-emerald-600">{resultados.panes}</p>
                    <p className="text-xs text-emerald-500/70">Panes Totales</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{resultados.panesPorArroba}/arroba</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 p-4 rounded-xl text-center">
                    <DollarSign className="w-5 h-5 mx-auto text-orange-500 mb-2" />
                    <p className="text-2xl font-black text-orange-600">{formatCurrency(resultados.costoTotalFormulacion)}</p>
                    <p className="text-xs text-orange-500/70">Costo Insumos</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatCurrency(resultados.costoUnitario)}/pan</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4 rounded-xl text-center">
                    <TrendingUp className="w-5 h-5 mx-auto text-purple-500 mb-2" />
                    <p className="text-2xl font-black text-purple-600">{formatCurrency(resultados.gananciaTotal)}</p>
                    <p className="text-xs text-purple-500/70">Ganancia Est.</p>
                    <Badge className={cn(
                      "mt-1 text-[10px]",
                      resultados.margen >= 30 ? "bg-emerald-500" :
                        resultados.margen >= 15 ? "bg-amber-500" : "bg-red-500"
                    )}>
                      {resultados.margen.toFixed(1)}% margen
                    </Badge>
                  </div>
                </div>

                {/* Flujo visual */}
                <div className="flex items-center justify-center gap-4 py-4 bg-muted/20 rounded-xl">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{resultados.arrobas}</p>
                    <p className="text-xs text-muted-foreground">arrobas</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-bold">{resultados.masaUtilKg.toFixed(1)} kg</p>
                    <p className="text-xs text-muted-foreground">masa útil</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{resultados.panes}</p>
                    <p className="text-xs text-muted-foreground">panes de {resultados.pesoUnitario}g</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{formatCurrency(resultados.ventaTotal)}</p>
                    <p className="text-xs text-muted-foreground">venta total</p>
                  </div>
                </div>

                {/* Lista de ingredientes necesarios */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-amber-500" />
                    Insumos Necesarios para {resultados.arrobas} arroba(s)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {resultados.ingredientesNecesarios.map((ing, index) => {
                      const producto = getProductoById(ing.productoId);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 text-sm">
                          <span className="font-medium truncate mr-2" title={producto?.nombre || ing.productoId}>
                            {producto?.nombre || 'Insumo'}
                          </span>
                          <Badge variant="secondary" className="font-black shrink-0">
                            {ing.cantidadTotal.toFixed(ing.unidad === 'und' ? 0 : 1)} {ing.unidad}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
