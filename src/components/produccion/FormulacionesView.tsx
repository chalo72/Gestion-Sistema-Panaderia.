import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronRight,
  Search,
  Beaker,
  Scale,
  Clock,
  Thermometer,
  AlertCircle,
  Copy,
  CheckCircle2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  Producto,
  FormulacionBase,
  IngredienteFormulacion
} from '@/types';

interface FormulacionesViewProps {
  formulaciones: FormulacionBase[];
  productos: Producto[];
  getMejorPrecio: (productoId: string) => { precioCosto: number } | null;
  getProductoById: (id: string) => Producto | undefined;
  onAddFormulacion: (formulacion: FormulacionBase) => Promise<void>;
  onUpdateFormulacion: (formulacion: FormulacionBase) => Promise<void>;
  onDeleteFormulacion: (id: string) => Promise<void>;
  formatCurrency: (value: number) => string;
}

const ARROBA_KG_VALUE = 11.5;

const CATEGORIAS_FORMULACION = [
  { value: 'panes', label: 'Panes', color: 'bg-amber-500' },
  { value: 'pasteleria', label: 'Pastelería', color: 'bg-pink-500' },
  { value: 'hojaldres', label: 'Hojaldres', color: 'bg-orange-500' },
  { value: 'dulces', label: 'Dulces', color: 'bg-purple-500' },
  { value: 'especiales', label: 'Especiales', color: 'bg-blue-500' },
];

export function FormulacionesView({
  formulaciones,
  productos,
  getMejorPrecio,
  getProductoById,
  onAddFormulacion,
  onUpdateFormulacion,
  onDeleteFormulacion,
  formatCurrency
}: FormulacionesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormulacion, setEditingFormulacion] = useState<FormulacionBase | null>(null);

  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<FormulacionBase['categoria']>('panes');
  const [ingredientes, setIngredientes] = useState<Partial<IngredienteFormulacion>[]>([]);
  const [tiempoFermentacion, setTiempoFermentacion] = useState<number>(0);
  const [tiempoHorneado, setTiempoHorneado] = useState<number>(0);
  const [temperaturaHorno, setTemperaturaHorno] = useState<number>(180);
  const [instrucciones, setInstrucciones] = useState('');

  // Filtrar ingredientes disponibles (tipo 'ingrediente')
  const ingredientesDisponibles = useMemo(() =>
    productos.filter(p => p.tipo === 'ingrediente'),
    [productos]);

  // Filtrar formulaciones por búsqueda
  const formulacionesFiltradas = useMemo(() => {
    return formulaciones.filter(f =>
      f.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [formulaciones, searchTerm]);

  // Calcular costo total de la formulación
  const calcularCostoTotal = () => {
    return ingredientes.reduce((sum, ing) => sum + (ing.costoTotalArroba || 0), 0);
  };

  // Abrir diálogo para crear
  const handleOpenCreate = () => {
    setEditingFormulacion(null);
    setNombre('');
    setDescripcion('');
    setCategoria('panes');
    setIngredientes([]);
    setTiempoFermentacion(0);
    setTiempoHorneado(0);
    setTemperaturaHorno(180);
    setInstrucciones('');
    setIsDialogOpen(true);
  };

  // Abrir diálogo para editar
  const handleOpenEdit = (formulacion: FormulacionBase) => {
    setEditingFormulacion(formulacion);
    setNombre(formulacion.nombre);
    setDescripcion(formulacion.descripcion || '');
    setCategoria(formulacion.categoria);
    setIngredientes(formulacion.ingredientes);
    setTiempoFermentacion(formulacion.tiempoFermentacion || 0);
    setTiempoHorneado(formulacion.tiempoHorneado || 0);
    setTemperaturaHorno(formulacion.temperaturaHorno || 180);
    setInstrucciones(formulacion.instrucciones || '');
    setIsDialogOpen(true);
  };

  // Duplicar formulación
  const handleDuplicar = (formulacion: FormulacionBase) => {
    setEditingFormulacion(null);
    setNombre(`${formulacion.nombre} (Copia)`);
    setDescripcion(formulacion.descripcion || '');
    setCategoria(formulacion.categoria);
    setIngredientes(formulacion.ingredientes.map(ing => ({ ...ing, id: crypto.randomUUID() })));
    setTiempoFermentacion(formulacion.tiempoFermentacion || 0);
    setTiempoHorneado(formulacion.tiempoHorneado || 0);
    setTemperaturaHorno(formulacion.temperaturaHorno || 180);
    setInstrucciones(formulacion.instrucciones || '');
    setIsDialogOpen(true);
  };

  // Agregar ingrediente
  const handleAddIngredient = () => {
    setIngredientes([...ingredientes, {
      id: crypto.randomUUID(),
      formulacionId: editingFormulacion?.id || '',
      productoId: '',
      cantidadPorArroba: 0,
      unidad: 'gr',
      porcentajePanadero: 0,
      costoUnitario: 0,
      costoTotalArroba: 0
    }]);
  };

  // Eliminar ingrediente
  const handleRemoveIngredient = (id: string) => {
    setIngredientes(ingredientes.filter(i => i.id !== id));
  };

  // Actualizar ingrediente
  const handleIngredientChange = (id: string, field: keyof IngredienteFormulacion, value: string | number) => {
    setIngredientes(ingredientes.map(ing => {
      if (ing.id === id) {
        const updated = { ...ing, [field]: value };

        // Recalcular costo si cambia producto o cantidad
        if (field === 'productoId' || field === 'cantidadPorArroba') {
          const productoId = field === 'productoId' ? value : updated.productoId;
          const cantidad = field === 'cantidadPorArroba' ? value : updated.cantidadPorArroba;
          const mejorPrecio = getMejorPrecio(productoId);
          const producto = getProductoById(productoId);
          const costoUnitario = mejorPrecio?.precioCosto || producto?.costoBase || 0;

          // Convertir a costo por unidad según la unidad seleccionada
          let costoAjustado = costoUnitario;
          if (updated.unidad === 'kg') {
            costoAjustado = costoUnitario; // Asumimos costo por kg
          } else if (updated.unidad === 'gr') {
            costoAjustado = costoUnitario / 1000; // Costo por gramo
          }

          updated.costoUnitario = costoUnitario;
          updated.costoTotalArroba = costoAjustado * (cantidad || 0);
        }

        return updated;
      }
      return ing;
    }));
  };

  // Guardar formulación
  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (ingredientes.length === 0) {
      toast.error('Agrega al menos un ingrediente');
      return;
    }

    const costoTotal = calcularCostoTotal();

    const formulacion: FormulacionBase = {
      id: editingFormulacion?.id || crypto.randomUUID(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      categoria,
      ingredientes: ingredientes as IngredienteFormulacion[],
      rendimientoBaseKg: ARROBA_KG_VALUE,
      costoTotalArroba: costoTotal,
      tiempoFermentacion: tiempoFermentacion || undefined,
      tiempoHorneado: tiempoHorneado || undefined,
      temperaturaHorno: temperaturaHorno || undefined,
      instrucciones: instrucciones.trim() || undefined,
      activo: true,
      fechaActualizacion: new Date().toISOString()
    };

    try {
      if (editingFormulacion) {
        await onUpdateFormulacion(formulacion);
        toast.success('Formulación actualizada');
      } else {
        await onAddFormulacion(formulacion);
        toast.success('Formulación creada');
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Error al guardar la formulación');
    }
  };

  // Eliminar formulación
  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta formulación? Los modelos de pan que la usen quedarán huérfanos.')) {
      await onDeleteFormulacion(id);
      toast.success('Formulación eliminada');
    }
  };

  const getCategoriaInfo = (cat: string) => {
    return CATEGORIAS_FORMULACION.find(c => c.value === cat) || CATEGORIAS_FORMULACION[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Formulaciones por Arroba</h2>
            <p className="text-xs text-muted-foreground">1 arroba = {ARROBA_KG_VALUE} kg de masa base</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar formulación..."
              className="pl-10 w-64 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={handleOpenCreate} className="bg-amber-600 hover:bg-amber-700 rounded-xl gap-2">
            <Plus className="w-4 h-4" />
            Nueva Formulación
          </Button>
        </div>
      </div>

      {/* Grid de Formulaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formulacionesFiltradas.map((formulacion) => {
          const catInfo = getCategoriaInfo(formulacion.categoria);

          return (
            <Card key={formulacion.id} className="group overflow-hidden rounded-2xl border-border/50 hover:shadow-xl transition-all duration-300">
              <div className={cn("h-1 w-full", catInfo.color)} />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-2 uppercase">
                      {catInfo.label}
                    </Badge>
                    <CardTitle className="text-base group-hover:text-amber-600 transition-colors">
                      {formulacion.nombre}
                    </CardTitle>
                    {formulacion.descripcion && (
                      <p className="text-xs text-muted-foreground mt-1">{formulacion.descripcion}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicar(formulacion)} className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(formulacion)} className="h-8 w-8 text-muted-foreground hover:text-amber-600">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(formulacion.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Costo por Arroba */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      Costo por Arroba
                    </span>
                    <Scale className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {formatCurrency(formulacion.costoTotalArroba)}
                  </p>
                  <p className="text-[10px] text-amber-600/70 mt-1">
                    {formatCurrency(formulacion.costoTotalArroba / ARROBA_KG_VALUE)} por kg de masa
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <Beaker className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <span className="text-xs font-bold">{formulacion.ingredientes.length}</span>
                    <p className="text-[10px] text-muted-foreground">Insumos</p>
                  </div>
                  {formulacion.tiempoFermentacion && (
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-xs font-bold">{formulacion.tiempoFermentacion}</span>
                      <p className="text-[10px] text-muted-foreground">Min Ferm.</p>
                    </div>
                  )}
                  {formulacion.temperaturaHorno && (
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <Thermometer className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-xs font-bold">{formulacion.temperaturaHorno}°</span>
                      <p className="text-[10px] text-muted-foreground">Horno</p>
                    </div>
                  )}
                </div>

                {/* Lista de ingredientes resumida */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ingredientes principales:</p>
                  <div className="flex flex-wrap gap-1">
                    {formulacion.ingredientes.slice(0, 4).map((ing) => {
                      const producto = getProductoById(ing.productoId);
                      return (
                        <Badge key={ing.id} variant="secondary" className="text-[10px]">
                          {producto?.nombre?.substring(0, 15) || 'N/A'}
                        </Badge>
                      );
                    })}
                    {formulacion.ingredientes.length > 4 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{formulacion.ingredientes.length - 4} más
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {formulacionesFiltradas.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 bg-muted/30 rounded-2xl border-2 border-dashed border-muted">
            <FlaskConical className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No hay formulaciones configuradas</p>
            <Button variant="link" onClick={handleOpenCreate} className="text-amber-600 mt-2">
              Crear primera formulación
            </Button>
          </div>
        )}
      </div>

      {/* Diálogo de Creación/Edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-0">
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <FlaskConical className="w-6 h-6 text-amber-600" />
                <DialogTitle className="text-xl font-bold">
                  {editingFormulacion ? 'Editar Formulación' : 'Nueva Formulación por Arroba'}
                </DialogTitle>
              </div>
              <DialogDescription>
                Define los ingredientes y cantidades necesarias para producir 1 arroba ({ARROBA_KG_VALUE} kg) de masa
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Columna Izquierda: Info General */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold">Nombre de la Formulación</label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Masa Pan Francés"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">Categoría</label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaFormulacion)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_FORMULACION.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">Descripción (opcional)</label>
                  <Input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Notas sobre esta formulación..."
                    className="rounded-xl"
                  />
                </div>

                {/* Tiempos y Temperatura */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground">Fermentación (min)</label>
                    <Input
                      type="number"
                      value={tiempoFermentacion || ''}
                      onChange={(e) => setTiempoFermentacion(Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground">Horneado (min)</label>
                    <Input
                      type="number"
                      value={tiempoHorneado || ''}
                      onChange={(e) => setTiempoHorneado(Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Temperatura Horno (°C)</label>
                  <Input
                    type="number"
                    value={temperaturaHorno || ''}
                    onChange={(e) => setTemperaturaHorno(Number(e.target.value))}
                    className="rounded-xl"
                  />
                </div>

                {/* Resumen de Costos */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3">
                  <div className="flex justify-between items-center text-slate-400 text-xs">
                    <span>COSTO TOTAL / ARROBA</span>
                    <Scale className="w-3 h-3" />
                  </div>
                  <div className="text-3xl font-black text-amber-400">
                    {formatCurrency(calcularCostoTotal())}
                  </div>
                  <div className="pt-3 border-t border-slate-700 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Por kg de masa:</span>
                      <span className="text-emerald-400 font-bold">
                        {formatCurrency(calcularCostoTotal() / ARROBA_KG_VALUE)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Por 100gr:</span>
                      <span className="text-blue-400 font-bold">
                        {formatCurrency(calcularCostoTotal() / ARROBA_KG_VALUE / 10)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Ingredientes */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    Ingredientes por Arroba
                    <Badge variant="secondary" className="rounded-full">{ingredientes.length}</Badge>
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleAddIngredient} className="rounded-lg gap-1">
                    <Plus className="w-3 h-3" /> Añadir Ingrediente
                  </Button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {ingredientes.map((ing) => {
                    const _producto = getProductoById(ing.productoId || '');
                    return (
                      <div key={ing.id} className="flex flex-col md:flex-row gap-3 p-4 bg-muted/30 rounded-xl border group">
                        <div className="flex-1">
                          <Select
                            value={ing.productoId}
                            onValueChange={(val) => handleIngredientChange(ing.id!, 'productoId', val)}
                          >
                            <SelectTrigger className="bg-background rounded-lg h-10">
                              <SelectValue placeholder="Seleccionar ingrediente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredientesDisponibles.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Cant"
                            className="w-24 rounded-lg h-10"
                            value={ing.cantidadPorArroba || ''}
                            onChange={(e) => handleIngredientChange(ing.id!, 'cantidadPorArroba', Number(e.target.value))}
                          />
                          <Select
                            value={ing.unidad}
                            onValueChange={(val) => handleIngredientChange(ing.id!, 'unidad', val)}
                          >
                            <SelectTrigger className="w-20 rounded-lg h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gr">gr</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="l">l</SelectItem>
                              <SelectItem value="und">und</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center px-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg min-w-[90px] justify-center text-sm font-bold text-amber-700 dark:text-amber-400">
                            {formatCurrency(ing.costoTotalArroba || 0)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveIngredient(ing.id!)}
                            className="text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {ingredientes.length === 0 && (
                    <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
                      <Beaker className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Agrega los ingredientes para 1 arroba de masa</p>
                    </div>
                  )}
                </div>

                {/* Instrucciones */}
                <div className="space-y-2 pt-4">
                  <label className="text-sm font-bold">Instrucciones de Preparación</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-xl bg-muted/30 border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Pasos clave: mezclar, amasar, reposar, dividir, hornear..."
                    value={instrucciones}
                    onChange={(e) => setInstrucciones(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 flex items-center justify-between border-t pt-6">
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4" />
                Los costos se calculan con el mejor precio de proveedores
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl px-6">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700 rounded-xl px-8 gap-2">
                  <Save className="w-4 h-4" />
                  {editingFormulacion ? 'Actualizar' : 'Guardar Formulación'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
