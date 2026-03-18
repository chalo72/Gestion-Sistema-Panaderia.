import { useState, useMemo } from 'react';
import { useCan } from '@/contexts/AuthContext';
import {
  DollarSign,
  Plus,
  Search,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Store,
  ArrowRightLeft,
  Check,
  History,
  Filter,
  Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor, HistorialPrecio } from '@/types';

// Componentes modulares
import { PrecioHeader } from '@/components/precios/PrecioHeader';
import { PrecioHistory } from '@/components/precios/PrecioHistory';
import { PrecioComparison } from '@/components/precios/PrecioComparison';
import { PrecioModal } from '@/components/precios/PrecioModal';

interface PreciosProps {
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  historial: HistorialPrecio[];
  onAddOrUpdatePrecio: (data: {
    productoId: string;
    proveedorId: string;
    precioCosto: number;
    notas?: string;
  }) => void;
  onDeletePrecio: (id: string) => void;
  getPrecioByIds: (productoId: string, proveedorId: string) => PrecioProveedor | undefined;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function Precios({
  productos,
  proveedores,
  precios,
  historial,
  onAddOrUpdatePrecio,
  onDeletePrecio,
  getProductoById,
  getProveedorById,
  formatCurrency,
}: PreciosProps) {
  const { check } = useCan();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrecio, setEditingPrecio] = useState<PrecioProveedor | null>(null);

  const [formData, setFormData] = useState({
    productoId: '',
    proveedorId: '',
    precioCosto: '',
    notas: '',
  });

  const filteredPrecios = precios.filter(p => {
    const producto = getProductoById(p.productoId);
    const proveedor = getProveedorById(p.proveedorId);
    return (
      producto?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenCreateModal = () => {
    setEditingPrecio(null);
    setFormData({ productoId: '', proveedorId: '', precioCosto: '', notas: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (precio: PrecioProveedor) => {
    if (!check('EDITAR_PRECIOS')) {
      toast.error('Privilegios insuficientes para esta operación');
      return;
    }
    setEditingPrecio(precio);
    setFormData({
      productoId: precio.productoId,
      proveedorId: precio.proveedorId,
      precioCosto: precio.precioCosto.toString(),
      notas: precio.notas || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!check('EDITAR_PRECIOS')) {
      toast.error('Privilegios insuficientes');
      return;
    }
    if (confirm('¿Expurgar este registro de precio permanentemente?')) {
      onDeletePrecio(id);
      toast.success('Registro de inteligencia eliminado');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productoId || !formData.proveedorId || !formData.precioCosto) {
      toast.error('Campos de inteligencia incompletos');
      return;
    }

    onAddOrUpdatePrecio({
      productoId: formData.productoId,
      proveedorId: formData.proveedorId,
      precioCosto: parseFloat(formData.precioCosto),
      notas: formData.notas,
    });

    toast.success(editingPrecio ? 'Datos de mercado actualizados' : 'Nuevos datos de mercado inyectados');
    setIsModalOpen(false);
  };

  const getMejorPrecioProducto = (productoId: string) => {
    const preciosProducto = precios.filter(p => p.productoId === productoId);
    if (preciosProducto.length === 0) return null;
    return preciosProducto.reduce((min, p) => p.precioCosto < min.precioCosto ? p : min);
  };

  return (
    <div className="space-y-8 animate-ag-fade-in p-2 md:p-6 bg-slate-50/50 dark:bg-black/20 rounded-[3rem]">
      <PrecioHeader
        onAddPrecio={handleOpenCreateModal}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        canEdit={check('EDITAR_PRECIOS')}
      />

      <Tabs defaultValue="lista" className="w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 px-4">
          <TabsList className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md p-1.5 rounded-[2.5rem] h-16 w-full md:w-auto grid grid-cols-3 gap-2">
            <TabsTrigger value="lista" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl px-10">Explorador</TabsTrigger>
            <TabsTrigger value="comparacion" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xl px-10">Análisis</TabsTrigger>
            <TabsTrigger value="historial" className="rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xl px-10 gap-2"><History className="w-3.5 h-3.5" /> Bitácora</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] border-blue-200 text-blue-600 bg-blue-50/50 flex gap-2 items-center">
              <Activity className="w-4 h-4" /> Market Feed Active
            </Badge>
          </div>
        </div>

        <TabsContent value="lista" className="mt-0 focus-visible:ring-0">
          <Card className="border-none bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800/10">
            <CardContent className="p-0">
              {filteredPrecios.length === 0 ? (
                <div className="py-40 text-center opacity-20">
                  <DollarSign className="w-24 h-24 mx-auto mb-6" />
                  <h3 className="text-xl font-black uppercase tracking-[0.3em]">Sin Registros de Mercado</h3>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-900 dark:bg-black">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16 pl-8">Producto / SKU</TableHead>
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16">Aliado Comercial</TableHead>
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16">Costo de Entrada</TableHead>
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16">PVP Mercado</TableHead>
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16">Rendimiento</TableHead>
                      <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-16 text-right pr-8">Operaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrecios.map((precio) => {
                      const product = getProductoById(precio.productoId);
                      const vendor = getProveedorById(precio.proveedorId);
                      if (!product || !vendor) return null;

                      const mejor = getMejorPrecioProducto(product.id)?.id === precio.id;
                      const markup = ((product.precioVenta - precio.precioCosto) / precio.precioCosto) * 100;

                      return (
                        <TableRow key={precio.id} className="group hover:bg-white/60 dark:hover:bg-white/5 transition-colors border-slate-100 dark:border-gray-800">
                          <TableCell className="pl-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center font-black text-blue-600">
                                {product.nombre.substring(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black uppercase text-xs tracking-tighter text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{product.nombre}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{product.categoria}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-blue-500 opacity-40" />
                              <span className="font-black uppercase text-[10px] tracking-tighter text-slate-600 dark:text-gray-400">{vendor.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-black text-lg tabular-nums tracking-tighter text-blue-600">{formatCurrency(precio.precioCosto)}</span>
                              {mejor && (
                                <Badge variant="outline" className="w-fit h-4 px-1.5 text-[7px] font-black uppercase bg-emerald-50 text-emerald-600 border-emerald-100">Costo Óptimo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-lg tabular-nums tracking-tighter text-emerald-600">{formatCurrency(product.precioVenta)}</span>
                          </TableCell>
                          <TableCell>
                            <div className={cn(
                              "flex items-center gap-1.5 font-black text-xs",
                              markup >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {markup >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {markup.toFixed(1)}%
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-blue-50 text-blue-600" onClick={() => handleEdit(precio)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-rose-50 text-rose-500" onClick={() => handleDelete(precio.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparacion" className="mt-0 focus-visible:ring-0">
          <PrecioComparison
            productos={productos}
            precios={precios}
            getProveedorById={getProveedorById}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-0 focus-visible:ring-0">
          <PrecioHistory
            historial={historial}
            productos={productos}
            proveedores={proveedores}
            getProductoById={getProductoById}
            getProveedorById={getProveedorById}
            formatCurrency={formatCurrency}
          />
        </TabsContent>
      </Tabs>

      <PrecioModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        productos={productos}
        proveedores={proveedores}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isEditing={!!editingPrecio}
      />
    </div>
  );
}

export default Precios;
