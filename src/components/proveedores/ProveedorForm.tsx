import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Star,
  X,
  UserCheck,
  CheckCircle2,
  Tag,
  Store,
  Wrench,
  ShieldCheck,
  Building2,
  Search,
  FileText,
  Save,
  ChevronRight,
  LayoutGrid
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor } from '@/types';

/* ── Tipos y Constantes ── */
type TipoEmbalaje =
  | 'unidad' | 'paca'   | 'sipak'  | 'saco'   | 'caja'   | 'bolsa'
  | 'bandeja'| 'bulto'  | 'bloque' | 'tarro'  | 'costal' | 'garrafa'
  | 'caneca' | 'arroba' | 'docena' | 'rollo'  | 'atado'  | 'otro';
type DestinoUso   = 'venta' | 'insumo';

export interface ProductoCatalogo {
  uid: string;
  productoId: string;
  nombre: string;
  categoria: string;
  precioCosto: number;
  margenVenta: number;
  cantidadEmbalaje: number;
  tipoEmbalaje: TipoEmbalaje;
  destino: DestinoUso;
  notas: string;
  costoUnitario: number;
  precioVenta: number;
  precioVentaPack: number;
}

const EMBALAJES: { value: TipoEmbalaje; label: string; emoji: string; desc: string }[] = [
  { value: 'unidad',  label: 'Unidad',   emoji: '🔹', desc: 'Producto individual'        },
  { value: 'paca',    label: 'Paca',     emoji: '📦', desc: 'Paquete de unidades'        },
  { value: 'sipak',   label: 'Sipak',    emoji: '🛍️', desc: 'Six-pack / multipack'       },
  { value: 'bloque',  label: 'Bloque',   emoji: '🧱', desc: 'Bloque compacto'            },
  { value: 'bulto',   label: 'Bulto',    emoji: '🎁', desc: 'Bulto o fardo'              },
  { value: 'tarro',   label: 'Tarro',    emoji: '🫙', desc: 'Tarro, lata o frasco'       },
  { value: 'saco',    label: 'Saco',     emoji: '🌾', desc: 'Saco o costal pequeño'      },
  { value: 'costal',  label: 'Costal',   emoji: '⛽', desc: 'Costal grande (50 kg+)'     },
  { value: 'caja',    label: 'Caja',     emoji: '📫', desc: 'Caja de cartón o madera'    },
  { value: 'bolsa',   label: 'Bolsa',    emoji: '🛒', desc: 'Bolsa plástica o de tela'   },
  { value: 'garrafa', label: 'Garrafa',  emoji: '🧴', desc: 'Garrafa o bidón de líquido' },
  { value: 'caneca',  label: 'Caneca',   emoji: '🪣', desc: 'Caneca o tambor'            },
  { value: 'bandeja', label: 'Bandeja',  emoji: '🍱', desc: 'Bandeja o charola'          },
  { value: 'arroba',  label: 'Arroba',   emoji: '⚖️', desc: 'Arroba (11.5 kg)'           },
  { value: 'docena',  label: 'Docena',   emoji: '🔢', desc: '12 unidades'                },
  { value: 'rollo',   label: 'Rollo',    emoji: '🧻', desc: 'Rollo o bobina'             },
  { value: 'atado',   label: 'Atado',    emoji: '🪢', desc: 'Atado o manojo'             },
  { value: 'otro',    label: 'Otro',     emoji: '🔖', desc: 'Tipo personalizado'         },
];

const RUBROS = [
  'Panadería / Pastelería', 'Lácteos', 'Aceites y Grasas', 'Harinas y Cereales',
  'Azúcar y Edulcorantes', 'Empaques / Packaging', 'Frutas y Verduras',
  'Carnes y Proteínas', 'Bebidas', 'Limpieza e Higiene', 'Equipamiento', 'Otro',
];

const CATEGORIAS_PROD = [
  'Harinas y Materia Prima', 'Azúcares y Endulzantes', 'Lácteos y Huevos',
  'Levaduras y Aditivos', 'Aceites y Grasas', 'Frutas y Verduras',
  'Carnes y Embutidos', 'Bebidas', 'Empaques y Desechables',
  'Condimentos y Salsas', 'Granos y Semillas', 'Otro',
];

const PROD_INIT: Omit<ProductoCatalogo, 'uid' | 'costoUnitario' | 'precioVenta' | 'precioVentaPack'> = {
  productoId: '', nombre: '', categoria: CATEGORIAS_PROD[0],
  precioCosto: 0, margenVenta: 30, cantidadEmbalaje: 1,
  tipoEmbalaje: 'unidad', destino: 'insumo', notas: '',
};

interface ProveedorFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (provData: any, catalogo: ProductoCatalogo[]) => Promise<void>;
  editingProveedor: Proveedor | null;
  productosExistentes: Producto[];
  initialCatalogo: ProductoCatalogo[];
  formatCurrency: (v: number) => string;
}

export function ProveedorForm({
  isOpen,
  onClose,
  onSubmit,
  editingProveedor,
  productosExistentes,
  initialCatalogo,
  formatCurrency,
}: ProveedorFormProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', contacto: '', telefono: '', email: '',
    direccion: '', imagen: '', calificacion: 5,
    activo: true, rubro: '', notas: '',
  });

  const [catalogoItems, setCatalogoItems] = useState<ProductoCatalogo[]>([]);
  const [prodActual, setProdActual] = useState(PROD_INIT);
  const [buscarProd, setBuscarProd] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Inicializar formulario al abrir/editar
  useEffect(() => {
    if (isOpen) {
      if (editingProveedor) {
        setFormData({
          nombre: editingProveedor.nombre,
          contacto: editingProveedor.contacto || '',
          telefono: editingProveedor.telefono || '',
          email: editingProveedor.email || '',
          direccion: editingProveedor.direccion || '',
          imagen: editingProveedor.imagen || '',
          calificacion: editingProveedor.calificacion || 5,
          activo: (editingProveedor as any).activo !== false,
          rubro: (editingProveedor as any).rubro || '',
          notas: (editingProveedor as any).notas || '',
        });
        setCatalogoItems(initialCatalogo || []);
      } else {
        setFormData({
          nombre: '', contacto: '', telefono: '', email: '',
          direccion: '', imagen: '', calificacion: 5,
          activo: true, rubro: '', notas: '',
        });
        setCatalogoItems([]);
      }
      setActiveStep(1);
    }
  }, [isOpen, editingProveedor, initialCatalogo]);

  const costUnit = useMemo(() => 
    prodActual.cantidadEmbalaje > 0 ? prodActual.precioCosto / prodActual.cantidadEmbalaje : 0
  , [prodActual.precioCosto, prodActual.cantidadEmbalaje]);

  const sellPrice = useMemo(() => 
    costUnit * (1 + prodActual.margenVenta / 100)
  , [costUnit, prodActual.margenVenta]);

  const filtradosBusqueda = useMemo(() =>
    buscarProd.length >= 1
      ? productosExistentes.filter(p => p.nombre.toLowerCase().includes(buscarProd.toLowerCase())).slice(0, 5)
      : [],
    [productosExistentes, buscarProd]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      await onSubmit(formData, catalogoItems);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el proveedor');
    } finally {
      setGuardando(false);
    }
  };

  const addProductoCatalogo = () => {
    if (!prodActual.nombre.trim()) { toast.error('Nombre de producto requerido'); return; }
    if (prodActual.precioCosto <= 0) { toast.error('Costo debe ser mayor a 0'); return; }
    
    const newItem: ProductoCatalogo = {
      ...prodActual,
      uid: crypto.randomUUID(),
      costoUnitario: costUnit,
      precioVenta: sellPrice,
      precioVentaPack: sellPrice * prodActual.cantidadEmbalaje
    };
    
    setCatalogoItems(prev => [newItem, ...prev]);
    setProdActual(PROD_INIT);
    setBuscarProd('');
    toast.success(`"${newItem.nombre}" añadido al catálogo`);
  };

  const nextStep = () => {
    if (activeStep === 1 && !formData.nombre.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    setActiveStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => setActiveStep(prev => Math.max(prev - 1, 1));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[1000px] w-[95vw] md:w-[90vw] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white dark:bg-slate-950">
        <form onSubmit={handleSave}>
          <div className="bg-slate-900 border-b border-slate-800 p-8 text-white relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
                  {editingProveedor ? <Edit2 className="w-6 h-6 text-blue-400" /> : <Truck className="w-6 h-6 text-emerald-400" />}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                    {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 font-bold text-xs mt-1">
                    Gestión Logística · Dulce Placer
                  </DialogDescription>
                </div>
              </div>
              
              <Button type="button" variant="ghost" size="icon" className="text-white/40 hover:text-white hover:bg-white/10 rounded-full w-12 h-12" onClick={onClose}>
                <X className="w-8 h-8" />
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-4 relative z-10">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <div 
                    className={cn(
                      "flex items-center gap-3 transition-all duration-500",
                      activeStep === step ? "opacity-100 scale-105" : "opacity-40 scale-100"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border-2 transition-all duration-500",
                      activeStep === step 
                        ? "bg-white text-blue-900 border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                        : "bg-transparent text-white border-white/20"
                    )}>
                      {activeStep > step ? <CheckCircle2 className="w-6 h-6" /> : step}
                    </div>
                    <span className="hidden md:block text-[10px] font-black uppercase tracking-widest">
                      {step === 1 ? 'Identidad' : step === 2 ? 'Conexión' : 'Catálogo'}
                    </span>
                  </div>
                  {step < 3 && <div className="h-[2px] w-12 bg-white/10 rounded-full" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide bg-slate-50/50 dark:bg-slate-900/20">
            {activeStep === 1 && (
              <div className="space-y-8 animate-ag-entry-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Razón Social o Nombre *</Label>
                    <Input
                      autoFocus
                      value={formData.nombre}
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Trigos del Valle S.A."
                      className="h-14 xl font-bold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-0 px-5 shadow-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Rubro Principal</Label>
                    <div className="grid grid-cols-2 gap-2">
                       {RUBROS.slice(0, 4).map(r => (
                         <button
                           key={r}
                           type="button"
                           onClick={() => setFormData({ ...formData, rubro: r })}
                           className={cn(
                             "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border",
                             formData.rubro === r 
                               ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                               : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-200"
                           )}
                         >
                           {r}
                         </button>
                       ))}
                       <select
                         value={RUBROS.includes(formData.rubro) && RUBROS.indexOf(formData.rubro) < 4 ? "" : formData.rubro}
                         onChange={e => setFormData({ ...formData, rubro: e.target.value })}
                         className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 outline-none"
                       >
                         <option value="">Más Rubros...</option>
                         {RUBROS.slice(4).map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Nivel de Confianza</Label>
                    <div className="flex h-14 items-center justify-around bg-white dark:bg-slate-900 rounded-2xl px-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} type="button" onClick={() => setFormData({ ...formData, calificacion: s })} className="hover:scale-150 transition-transform duration-300">
                          <Star className={cn('w-6 h-6', s <= formData.calificacion ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-800')} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Identidad Visual (URL Logo)</Label>
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Input
                          value={formData.imagen}
                          onChange={e => setFormData({ ...formData, imagen: e.target.value })}
                          placeholder="https://servidor.com/logo.png"
                          className="h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 font-mono text-xs"
                        />
                      </div>
                      <div className={cn(
                        "w-14 h-14 rounded-xl overflow-hidden border flex items-center justify-center bg-white dark:bg-slate-900 transition-all",
                        formData.imagen ? "border-blue-200 shadow-md" : "border-dashed border-slate-300"
                      )}>
                        {formData.imagen ? (
                          <img src={formData.imagen} className="w-full h-full object-cover" alt="preview" />
                        ) : (
                          <Building2 className="w-6 h-6 text-slate-200" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div 
                  className={cn(
                    "p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer",
                    formData.activo 
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/30" 
                      : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                  )}
                  onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                      formData.activo ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-200 text-slate-500"
                    )}>
                      {formData.activo ? <ShieldCheck className="w-7 h-7" /> : <X className="w-7 h-7" />}
                    </div>
                    <div>
                      <p className={cn("text-sm font-bold uppercase tracking-tight", formData.activo ? "text-emerald-700 dark:text-emerald-400" : "text-slate-600")}>
                        {formData.activo ? 'Proveedor Activo' : 'Proveedor Inactivo'}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">Disponibilidad en el sistema</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-11 h-6 rounded-full p-1 transition-all duration-300",
                    formData.activo ? "bg-emerald-500" : "bg-slate-300"
                  )}>
                    <div className={cn("w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm", formData.activo ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-8 animate-ag-entry-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Contacto Comercial</Label>
                    <div className="relative group">
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 transition-transform group-focus-within:scale-110" />
                      <Input
                        value={formData.contacto}
                        onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                        placeholder="Nombre del asesor"
                        className="h-14 pl-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 px-5 shadow-sm font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono (WhatsApp)</Label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500 transition-transform group-focus-within:scale-110" />
                      <Input
                        value={formData.telefono}
                        onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Celular / Teléfono"
                        className="h-14 pl-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 px-5 shadow-sm font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Correo Electrónico</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500 transition-transform group-focus-within:scale-110" />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="correo@proveedor.com"
                        className="h-14 pl-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-rose-500 px-5 shadow-sm font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección</Label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 transition-transform group-focus-within:scale-110" />
                      <Input
                        value={formData.direccion}
                        onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Dirección comercial"
                        className="h-14 pl-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 px-5 shadow-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Notas y Condiciones</Label>
                  <div className="relative group">
                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-300 transition-colors group-focus-within:text-blue-500" />
                    <textarea
                      value={formData.notas}
                      onChange={e => setFormData({ ...formData, notas: e.target.value })}
                      rows={3}
                      placeholder="Días de crédito, mínimos de pedido, horarios..."
                      className="w-full pl-11 pr-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 outline-none resize-none text-sm font-medium shadow-sm transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-8 animate-ag-entry-right">
                <Card className="rounded-3xl border border-blue-50 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm overflow-visible">
                  <CardContent className="p-6 space-y-5 overflow-visible">
                    <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/30 pb-3">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-blue-600" />
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Vincular Producto</h4>
                       </div>
                    </div>

                    <div className="grid grid-cols-12 gap-5 items-end">
                      <div className="col-span-12 lg:col-span-5 space-y-2">
                        <Label className="text-[9px] font-black text-slate-500 uppercase ml-1">Referencia o Nombre</Label>
                        <div className="relative">
                          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                          <Input
                            value={buscarProd}
                            onChange={e => { setBuscarProd(e.target.value); setProdActual(prev => ({ ...prev, nombre: e.target.value, productoId: '' })); setShowDropdown(true); }}
                            placeholder="Buscar en inventario..."
                            className="h-12 pl-10 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 text-xs focus:border-blue-500 transition-all font-medium"
                          />
                          {showDropdown && filtradosBusqueda.length > 0 && (
                            <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                              {filtradosBusqueda.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setProdActual(prev => ({
                                      ...prev,
                                      productoId: p.id,
                                      nombre: p.nombre,
                                      categoria: p.categoria,
                                      margenVenta: p.margenUtilidad || 30,
                                      destino: p.tipo === 'ingrediente' ? 'insumo' : 'venta'
                                    }));
                                    setBuscarProd(p.nombre);
                                    setShowDropdown(false);
                                  }}
                                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left"
                                >
                                  <div>
                                    <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none">{p.nombre}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{p.categoria}</p>
                                  </div>
                                  <Badge className="text-[8px] bg-blue-100 text-blue-700 border-none font-black">EXISTENTE</Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-6 lg:col-span-3 space-y-2">
                        <Label className="text-[9px] font-black text-slate-500 uppercase ml-1">Presentación</Label>
                        <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50 p-1">
                          <select
                            value={prodActual.tipoEmbalaje}
                            onChange={e => setProdActual(prev => ({ ...prev, tipoEmbalaje: e.target.value as TipoEmbalaje, cantidadEmbalaje: e.target.value === 'unidad' ? 1 : prev.cantidadEmbalaje }))}
                            className="flex-1 h-10 px-2 bg-transparent text-[10px] font-bold uppercase outline-none"
                          >
                            {EMBALAJES.map(em => <option key={em.value} value={em.value}>{em.emoji} {em.label}</option>)}
                          </select>
                          {prodActual.tipoEmbalaje !== 'unidad' && (
                            <Input
                              type="number"
                              value={prodActual.cantidadEmbalaje}
                              onChange={e => setProdActual(prev => ({ ...prev, cantidadEmbalaje: parseInt(e.target.value) || 1 }))}
                              className="w-12 h-10 rounded-lg text-center font-bold bg-blue-50 dark:bg-blue-900/30 border-none text-blue-600 focus:ring-0"
                            />
                          )}
                        </div>
                      </div>

                      <div className="col-span-6 lg:col-span-2 space-y-2">
                        <Label className="text-[9px] font-black text-slate-500 uppercase ml-1">Costo Pack</Label>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                          <Input
                            type="number"
                            value={prodActual.precioCosto || ''}
                            onChange={e => setProdActual(prev => ({ ...prev, precioCosto: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                            className="h-12 pl-9 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 font-bold text-blue-600 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="col-span-12 lg:col-span-2">
                        <Button 
                          type="button" 
                          onClick={addProductoCatalogo} 
                          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center p-0"
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-5">
                  <div className="flex items-center justify-between px-2">
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Catálogo de Productos ({catalogoItems.length})</h5>
                  </div>

                  {catalogoItems.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] opacity-30">
                      <LayoutGrid className="w-14 h-14 text-slate-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">El catálogo está vacío actualmente</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Item / Categoría</th>
                            <th className="px-2 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Empaque</th>
                            <th className="px-2 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Costo</th>
                            <th className="px-2 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">% Mg.</th>
                            <th className="px-2 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">P. Venta</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {catalogoItems.map((item) => (
                            <tr key={item.uid} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors animate-ag-entry-bottom">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                    item.destino === 'insumo' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500"
                                  )}>
                                    {item.destino === 'insumo' ? <Wrench className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{item.nombre}</p>
                                      <p className="text-[9px] text-slate-500 uppercase">{item.categoria}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-center">
                                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                  {EMBALAJES.find(e => e.value === item.tipoEmbalaje)?.emoji} {item.cantidadEmbalaje} uds
                                </span>
                              </td>
                                <td className="px-2 py-3 text-right">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(item.precioCosto)}</p>
                                  <p className="text-[8px] text-slate-400">{formatCurrency(item.costoUnitario)}/u</p>
                                </td>
                                <td className="px-2 py-3 text-center">
                                  <Badge className={cn(
                                    "text-[9px] border-none",
                                  item.margenVenta >= 30 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                )}>
                                  {item.margenVenta}%
                                </Badge>
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <p className="text-xs font-bold text-emerald-600 tabular-nums">{formatCurrency(item.precioVenta)}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setCatalogoItems(prev => prev.filter(i => i.uid !== item.uid))}
                                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all flex items-center justify-center ml-auto"
                                  >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950">
            <div className="flex justify-between items-center w-full gap-4">
              <div className="hidden sm:flex lg:flex gap-1.5">
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={cn(
                      "h-1.5 transition-all duration-500 rounded-full",
                      activeStep === s ? "w-8 bg-blue-600" : activeStep > s ? "w-4 bg-emerald-500" : "w-4 bg-slate-100 dark:bg-slate-800"
                    )} />
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paso {activeStep} de 3</p>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <Button type="button" variant="ghost" className="px-6 rounded-xl font-bold uppercase text-xs text-slate-500 hover:text-slate-800" onClick={onClose}>
                  Cancelar
                </Button>
                
                {activeStep > 1 && (
                  <Button type="button" onClick={prevStep} variant="outline" className="px-6 rounded-xl border-slate-200 dark:border-slate-800 font-bold uppercase text-xs hover:bg-slate-50">
                    Atrás
                  </Button>
                )}

                {activeStep < 3 ? (
                  <Button 
                    type="button" 
                    onClick={nextStep}
                    className="px-8 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    Siguiente <ChevronRight className="w-4 h-4 -mr-1" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={guardando} 
                    className="px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {guardando ? 'Guardando...' : (editingProveedor ? 'Actualizar Proveedor' : 'Guardar Proveedor')}
                    <Save className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
