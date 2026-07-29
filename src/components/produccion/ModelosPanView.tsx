import { generateUUID } from '@/lib/safe-utils';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Croissant,
  Plus,
  Edit2,
  Trash2,
  Save,
  Search,
  Scale,
  Calculator,
  TrendingUp,
  DollarSign,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { ModeloPanModal } from './ModeloPanModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ModeloPan, FormulacionBase } from '@/types';
import { ARROBA_KG, ARROBA_GR } from '@/types';

interface ModelosPanViewProps {
  modelos: ModeloPan[];
  formulaciones: FormulacionBase[];
  onAddModelo: (modelo: ModeloPan) => Promise<void>;
  onUpdateModelo: (modelo: ModeloPan) => Promise<void>;
  onDeleteModelo: (id: string) => Promise<void>;
  formatCurrency: (value: number) => string;
}

export function ModelosPanView({
  modelos,
  formulaciones,
  onAddModelo,
  onUpdateModelo,
  onDeleteModelo,
  formatCurrency
}: ModelosPanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<ModeloPan | null>(null);

  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [formulacionId, setFormulacionId] = useState('');
  const [pesoUnitarioGr, setPesoUnitarioGr] = useState(80);
  const [precioVentaUnitario, setPrecioVentaUnitario] = useState(0);
  const [mermaEstimada, setMermaEstimada] = useState(5);
  const [piezasPorLata, setPiezasPorLata] = useState(12);

  // Calcular valores derivados
  const formulacionSeleccionada = useMemo(() =>
    formulaciones.find(f => f.id === formulacionId),
    [formulaciones, formulacionId]
  );

  // Panes por arroba (considerando merma)
  const panesPorArroba = useMemo(() => {
    if (!pesoUnitarioGr) return 0;
    const masaUtilGr = ARROBA_GR * (1 - (mermaEstimada / 100));
    return Math.floor(masaUtilGr / pesoUnitarioGr);
  }, [pesoUnitarioGr, mermaEstimada]);

  // Costo unitario
  const costoUnitario = useMemo(() => {
    if (!formulacionSeleccionada || !panesPorArroba) return 0;
    return formulacionSeleccionada.costoTotalArroba / panesPorArroba;
  }, [formulacionSeleccionada, panesPorArroba]);

  // Margen de ganancia
  const margenPorcentaje = useMemo(() => {
    if (!precioVentaUnitario || !costoUnitario) return 0;
    return costoUnitario > 0 ? ((precioVentaUnitario - costoUnitario) / costoUnitario) * 100 : 0;
  }, [precioVentaUnitario, costoUnitario]);

  // Filtrar modelos
  const modelosFiltrados = useMemo(() => {
    return modelos.filter(m =>
      m.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [modelos, searchTerm]);

  // Abrir diálogo para crear
  const handleOpenCreate = () => {
    setEditingModelo(null);
    setNombre('');
    setFormulacionId('');
    setPesoUnitarioGr(80);
    setPrecioVentaUnitario(0);
    setMermaEstimada(5);
    setPiezasPorLata(12);
    setIsDialogOpen(true);
  };

  // Abrir diálogo para editar
  const handleOpenEdit = (modelo: ModeloPan) => {
    setEditingModelo(modelo);
    setNombre(modelo.nombre);
    setFormulacionId(modelo.formulacionId);
    setPesoUnitarioGr(modelo.pesoUnitarioGr);
    setPrecioVentaUnitario(modelo.precioVentaUnitario);
    setMermaEstimada(modelo.mermaEstimada);
    setPiezasPorLata(modelo.piezasPorLata || 12);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    const editId = localStorage.getItem('dp_edit_modelo_id');
    const openAdd = localStorage.getItem('dp_open_add_modelo_dialog');
    
    if (editId) {
      localStorage.removeItem('dp_edit_modelo_id');
      const mod = modelos.find(m => m.id === editId);
      if (mod) {
        handleOpenEdit(mod);
      }
    } else if (openAdd === 'true') {
      localStorage.removeItem('dp_open_add_modelo_dialog');
      handleOpenCreate();
    }
  }, [modelos]);

  // Guardar modelo
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
      id: editingModelo?.id || generateUUID(),
      nombre: nombre.trim(),
      formulacionId,
      pesoUnitarioGr,
      panesPorArroba,
      precioVentaUnitario,
      // Conservar costo unitario avanzado si existe configuración de insumos/empaste
      costoUnitario: (editingModelo?.piqueEmpaste || (editingModelo?.ingredientesAdicionales && editingModelo.ingredientesAdicionales.length > 0)) 
        ? editingModelo.costoUnitario 
        : costoUnitario,
      margenPorcentaje,
      mermaEstimada,
      piezasPorLata,
      activo: true,
      createdAt: editingModelo?.createdAt || new Date().toISOString(),
      ...(editingModelo ? {
        ingredientesAdicionales: editingModelo.ingredientesAdicionales,
        piqueEmpaste: editingModelo.piqueEmpaste
      } : {})
    };

    try {
      if (editingModelo) {
        await onUpdateModelo(modelo);
        toast.success('Modelo actualizado');
      } else {
        await onAddModelo(modelo);
        toast.success('Modelo de pan creado');
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  // Eliminar
  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este modelo de pan?')) {
      await onDeleteModelo(id);
      toast.success('Modelo eliminado');
    }
  };

  // Obtener formulación por ID
  const getFormulacion = (id: string) => formulaciones.find(f => f.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
            <Croissant className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Modelos de Pan</h2>
            <p className="text-xs text-muted-foreground">Define tipos de pan con peso y rendimiento por arroba</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo..."
              className="pl-10 w-64 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={handleOpenCreate} className="bg-pink-600 hover:bg-pink-700 rounded-xl gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Modelo
          </Button>
        </div>
      </div>

      {/* Grid de Modelos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {modelosFiltrados.map((modelo) => {
          const formulacion = getFormulacion(modelo.formulacionId);

          return (
            <Card key={modelo.id} className="group overflow-hidden rounded-2xl border-border/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base group-hover:text-pink-600 transition-colors flex items-center gap-2">
                      <Croissant className="w-4 h-4 text-pink-500" />
                      {modelo.nombre}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formulacion?.nombre || 'Sin formulación'}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(modelo)} className="h-7 w-7 text-muted-foreground hover:text-pink-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(modelo.id)} className="h-7 w-7 text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* KPIs Principales */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-3 rounded-xl text-center">
                    <Scale className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-black text-blue-600">{modelo.pesoUnitarioGr}g</p>
                    <p className="text-[10px] text-blue-500/70 uppercase">Peso/Unidad</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-3 rounded-xl text-center">
                    <Package className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-black text-emerald-600">{modelo.panesPorArroba}</p>
                    <p className="text-[10px] text-emerald-500/70 uppercase">Panes/Arroba</p>
                  </div>
                </div>

                {/* Piezas por Lata */}
                <div className="flex justify-between items-center bg-muted/20 p-2 rounded-lg border border-border/50 text-sm">
                  <span className="text-muted-foreground">Piezas por lata:</span>
                  <span className="font-bold">{modelo.piezasPorLata || 12}</span>
                </div>

                {/* Costos y Precios */}
                <div className="bg-muted/30 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Costo unitario:</span>
                    <span className="font-bold text-orange-600">{formatCurrency(modelo.costoUnitario)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precio venta:</span>
                    <span className="font-bold text-foreground">{formatCurrency(modelo.precioVentaUnitario)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Margen:</span>
                    <Badge className={cn(
                      "font-bold",
                      modelo.margenPorcentaje >= 30 ? "bg-emerald-500" :
                        modelo.margenPorcentaje >= 15 ? "bg-amber-500" : "bg-red-500"
                    )}>
                      {modelo.margenPorcentaje.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {/* Merma */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Merma estimada:</span>
                  <Badge variant="outline">{modelo.mermaEstimada}%</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {modelosFiltrados.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 bg-muted/30 rounded-2xl border-2 border-dashed border-muted">
            <Croissant className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No hay modelos de pan configurados</p>
            <Button variant="link" onClick={handleOpenCreate} className="text-pink-600 mt-2">
              Crear primer modelo
            </Button>
          </div>
        )}
      </div>

      {/* Diálogo de Creación/Edición integrado con el Modal Global */}
      <ModeloPanModal 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        formulaciones={formulaciones}
        modeloBase={editingModelo || undefined}
        onSuccess={() => {
            // Trigger refresh since the DB was updated
            // For now, reload window is simplest since props come from parent, or trigger a parent refresh callback
            window.location.reload();
        }}
      />
    </div>
  );
}
