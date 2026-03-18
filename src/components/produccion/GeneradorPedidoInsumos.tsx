import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  AlertTriangle,
  Package,
  Truck,
  Calculator,
  FileText,
  Send,
  ClipboardList,
  Scale,
  FlaskConical,
  Croissant,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  FormulacionBase,
  ModeloPan,
  Producto,
  InventarioItem,
  Proveedor,
  ProyeccionInsumo
} from '@/types';

interface GeneradorPedidoInsumosProps {
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  productos: Producto[];
  inventario: InventarioItem[];
  proveedores: Proveedor[];
  getProductoById: (id: string) => Producto | undefined;
  getMejorPrecio: (productoId: string) => any;
  formatCurrency: (value: number) => string;
  onGenerarPedido?: (items: ProyeccionInsumo[]) => void;
}

interface PlanificacionItem {
  id: string;
  tipo: 'formulacion' | 'modelo';
  formulacionId: string;
  modeloId?: string;
  arrobas: number;
}

const ARROBA_KG = 11.5;

export function GeneradorPedidoInsumos({
  formulaciones,
  modelos,
  productos,
  inventario,
  proveedores,
  getProductoById,
  getMejorPrecio,
  formatCurrency,
  onGenerarPedido
}: GeneradorPedidoInsumosProps) {
  // Estado: items de planificación
  const [planificacion, setPlanificacion] = useState<PlanificacionItem[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Agregar item de planificación
  const handleAddPlanificacion = () => {
    if (formulaciones.length === 0) {
      toast.error('Primero crea una formulación');
      return;
    }
    setPlanificacion([
      ...planificacion,
      {
        id: crypto.randomUUID(),
        tipo: 'formulacion',
        formulacionId: formulaciones[0]?.id || '',
        arrobas: 1
      }
    ]);
  };

  // Actualizar item
  const handleUpdateItem = (id: string, field: keyof PlanificacionItem, value: any) => {
    setPlanificacion(items =>
      items.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  // Eliminar item
  const handleRemoveItem = (id: string) => {
    setPlanificacion(items => items.filter(item => item.id !== id));
  };

  // Calcular necesidades de insumos
  const proyeccionInsumos = useMemo((): ProyeccionInsumo[] => {
    const insumosMap = new Map<string, ProyeccionInsumo>();

    planificacion.forEach(item => {
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      if (!formulacion) return;

      formulacion.ingredientes.forEach(ing => {
        const cantidadNecesaria = ing.cantidadPorArroba * item.arrobas;
        const producto = getProductoById(ing.productoId);
        const stockItem = inventario.find(inv => inv.productoId === ing.productoId);
        const mejorPrecio = getMejorPrecio(ing.productoId);

        if (insumosMap.has(ing.productoId)) {
          const existing = insumosMap.get(ing.productoId)!;
          existing.cantidadNecesaria += cantidadNecesaria;
          existing.deficit = Math.max(0, existing.cantidadNecesaria - existing.stockActual);
          existing.costoEstimado = existing.deficit * (mejorPrecio?.precioCosto || ing.costoUnitario);
        } else {
          const currentStock = stockItem?.stockActual || 0;
          const minStock = stockItem?.stockMinimo || 0;
          const deficit = Math.max(0, cantidadNecesaria - currentStock);

          insumosMap.set(ing.productoId, {
            productoId: ing.productoId,
            nombreProducto: producto?.nombre || 'Producto desconocido',
            cantidadNecesaria,
            unidad: ing.unidad,
            stockActual: currentStock,
            stockMinimo: minStock,
            deficit,
            costoEstimado: deficit * (mejorPrecio?.precioCosto || ing.costoUnitario),
            proveedorRecomendado: mejorPrecio?.proveedorId
          });
        }
      });
    });

    return Array.from(insumosMap.values()).sort((a, b) => b.deficit - a.deficit);
  }, [planificacion, formulaciones, inventario, getProductoById, getMejorPrecio]);

  // Resumen de la planificación
  const resumen = useMemo(() => {
    const totalArrobas = planificacion.reduce((sum, item) => sum + item.arrobas, 0);
    const totalPanes = planificacion.reduce((sum, item) => {
      if (item.modeloId) {
        const modelo = modelos.find(m => m.id === item.modeloId);
        return sum + (modelo?.panesPorArroba || 0) * item.arrobas;
      }
      return sum;
    }, 0);
    const costoFormulaciones = planificacion.reduce((sum, item) => {
      const formulacion = formulaciones.find(f => f.id === item.formulacionId);
      return sum + (formulacion?.costoTotalArroba || 0) * item.arrobas;
    }, 0);
    const insumosConDeficit = proyeccionInsumos.filter(p => p.deficit > 0);
    const costoTotalPedido = insumosConDeficit.reduce((sum, p) => sum + p.costoEstimado, 0);

    return {
      totalArrobas,
      totalPanes,
      costoFormulaciones,
      insumosConDeficit: insumosConDeficit.length,
      costoTotalPedido
    };
  }, [planificacion, modelos, formulaciones, proyeccionInsumos]);

  // Generar pedido
  const handleGenerarPedido = () => {
    const itemsConDeficit = proyeccionInsumos.filter(p => p.deficit > 0);
    if (itemsConDeficit.length === 0) {
      toast.info('No hay déficit de insumos. No es necesario generar pedido.');
      return;
    }
    onGenerarPedido?.(itemsConDeficit);
    toast.success(`Pedido generado con ${itemsConDeficit.length} insumos`);
  };

  // Obtener nombre de proveedor
  const getProveedorNombre = (id?: string) => {
    if (!id) return '-';
    return proveedores.find(p => p.id === id)?.nombre || '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Generador de Pedido de Insumos</h2>
            <p className="text-xs text-muted-foreground">Planifica tu producción y calcula los insumos necesarios</p>
          </div>
        </div>
        {planificacion.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlanificacion([])}
            className="gap-2 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Planificación */}
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-teal-500" />
                Planificación de Producción
              </CardTitle>
              <Button size="sm" onClick={handleAddPlanificacion} className="bg-teal-600 hover:bg-teal-700 rounded-lg gap-1">
                <Plus className="w-3 h-3" /> Agregar
              </Button>
            </div>
            <CardDescription>Define qué vas a producir y en qué cantidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planificacion.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
                <Scale className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Agrega items de producción para calcular insumos</p>
                <Button variant="link" onClick={handleAddPlanificacion} className="text-teal-600 mt-2">
                  + Agregar primer item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {planificacion.map((item, index) => {
                  const formulacion = formulaciones.find(f => f.id === item.formulacionId);
                  const modelosDisponibles = modelos.filter(m => m.formulacionId === item.formulacionId);

                  return (
                    <div key={item.id} className="flex flex-col md:flex-row gap-3 p-4 bg-muted/20 rounded-xl border group">
                      <div className="flex items-center gap-2 text-muted-foreground font-bold w-8">
                        #{index + 1}
                      </div>

                      {/* Formulación */}
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Formulación</label>
                        <Select
                          value={item.formulacionId}
                          onValueChange={(val) => handleUpdateItem(item.id, 'formulacionId', val)}
                        >
                          <SelectTrigger className="rounded-lg h-10">
                            <SelectValue />
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

                      {/* Modelo (opcional) */}
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Modelo (opcional)</label>
                        <Select
                          value={item.modeloId || 'none'}
                          onValueChange={(val) => handleUpdateItem(item.id, 'modeloId', val === 'none' ? undefined : val)}
                        >
                          <SelectTrigger className="rounded-lg h-10">
                            <SelectValue placeholder="Sin modelo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin modelo específico</SelectItem>
                            {modelosDisponibles.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                <div className="flex items-center gap-2">
                                  <Croissant className="w-3 h-3" />
                                  {m.nombre}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Arrobas */}
                      <div className="w-32">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Arrobas</label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-lg"
                            onClick={() => handleUpdateItem(item.id, 'arrobas', Math.max(0.5, item.arrobas - 0.5))}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.arrobas}
                            onChange={(e) => handleUpdateItem(item.id, 'arrobas', Number(e.target.value))}
                            className="text-center rounded-lg h-10 w-16"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-lg"
                            onClick={() => handleUpdateItem(item.id, 'arrobas', item.arrobas + 0.5)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Costo estimado */}
                      <div className="w-28 text-center">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Costo</label>
                        <p className="h-10 flex items-center justify-center font-bold text-orange-600">
                          {formatCurrency((formulacion?.costoTotalArroba || 0) * item.arrobas)}
                        </p>
                      </div>

                      {/* Eliminar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-muted-foreground hover:text-red-500 self-end"
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de Resumen */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-500" />
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPIs */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Total Arrobas</span>
                <span className="text-lg font-black text-blue-600">{resumen.totalArrobas}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Panes Estimados</span>
                <span className="text-lg font-black text-emerald-600">{resumen.totalPanes || '-'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Costo Formulaciones</span>
                <span className="text-lg font-black text-orange-600">{formatCurrency(resumen.costoFormulaciones)}</span>
              </div>
            </div>

            {/* Alerta de déficit */}
            {resumen.insumosConDeficit > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="font-bold text-red-700 dark:text-red-400">Déficit de Insumos</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {resumen.insumosConDeficit} insumos necesitan reposición
                </p>
                <p className="text-lg font-black text-red-600 mt-2">
                  {formatCurrency(resumen.costoTotalPedido)}
                </p>
              </div>
            )}

            {/* Botón de calcular */}
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 rounded-xl gap-2"
              disabled={planificacion.length === 0}
              onClick={() => setMostrarResultados(true)}
            >
              <FileText className="w-4 h-4" />
              Ver Detalle de Insumos
            </Button>

            {/* Botón de generar pedido */}
            {resumen.insumosConDeficit > 0 && (
              <Button
                variant="outline"
                className="w-full rounded-xl gap-2 border-teal-500 text-teal-600 hover:bg-teal-50"
                onClick={handleGenerarPedido}
              >
                <Send className="w-4 h-4" />
                Generar Pedido de Compra
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Detalle de Insumos */}
      {mostrarResultados && proyeccionInsumos.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-cyan-500" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-500" />
                Detalle de Insumos Necesarios
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMostrarResultados(false)}>
                Ocultar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-center">Necesario</TableHead>
                  <TableHead className="text-center">Stock Actual</TableHead>
                  <TableHead className="text-center">Déficit</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Proveedor Sugerido</TableHead>
                  <TableHead className="text-right">Costo Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyeccionInsumos.map((item) => {
                  const porcentajeStock = (item.stockActual / item.cantidadNecesaria) * 100;
                  const tieneDeficit = item.deficit > 0;

                  return (
                    <TableRow key={item.productoId} className={cn(tieneDeficit && "bg-red-50/50 dark:bg-red-950/10")}>
                      <TableCell className="font-medium">{item.nombreProducto}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.cantidadNecesaria.toFixed(0)} {item.unidad}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-bold",
                          item.stockActual < item.stockMinimo ? "text-red-500" :
                            item.stockActual < item.cantidadNecesaria ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {item.stockActual.toFixed(0)} {item.unidad}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {tieneDeficit ? (
                          <Badge className="bg-red-500">{item.deficit.toFixed(0)} {item.unidad}</Badge>
                        ) : (
                          <Badge className="bg-emerald-500">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="w-full max-w-[100px] mx-auto">
                          <Progress
                            value={Math.min(100, porcentajeStock)}
                            className={cn(
                              "h-2",
                              porcentajeStock >= 100 ? "[&>div]:bg-emerald-500" :
                                porcentajeStock >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Truck className="w-3 h-3" />
                          {getProveedorNombre(item.proveedorRecomendado)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-600">
                        {tieneDeficit ? formatCurrency(item.costoEstimado) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Costo total del pedido:</p>
                <p className="text-2xl font-black text-teal-600">
                  {formatCurrency(resumen.costoTotalPedido)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
