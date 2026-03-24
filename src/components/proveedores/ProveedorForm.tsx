import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck, Plus, Edit2, Trash2, Phone, Mail, MapPin,
  Star, X, UserCheck, CheckCircle2, Tag, Store,
  Wrench, Building2, Search, FileText, Save, LayoutGrid,
  ShieldCheck, Info, Package
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-[2rem] p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
        
        {/* HEADER BLOCK (Basado en ProductFormModal) */}
        <div className="p-6 text-white relative bg-gradient-to-r from-emerald-500 to-teal-600">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10 shadow-sm">
                {editingProveedor ? <Edit2 className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
             </div>
             <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                  {editingProveedor ? 'Actualizar Proveedor' : 'Nuevo Proveedor'}
                </DialogTitle>
                <DialogDescription className="text-white/80 font-bold uppercase tracking-widest mt-0.5 text-xs">
                  Gestión Logística · Aliados Estratégicos
                </DialogDescription>
             </div>
          </div>
          <Button variant="ghost" size="icon" type="button" className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full" onClick={onClose}>
             <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">

            {/* ── INFORMACIÓN BÁSICA ── */}
            <div className="p-5 rounded-3xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Perfil Comercial</span>
                    </div>
                     <button
                        type="button"
                        className={cn(
                          "cursor-pointer flex items-center gap-2 transition-all p-1.5 pr-4 rounded-full border",
                          formData.activo 
                            ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10" 
                            : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-500 shadow-sm"
                        )}
                        onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                      >
                         <div className={cn(
                           "flex items-center justify-center w-7 h-7 rounded-full text-white shadow-sm transition-colors",
                           formData.activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                         )}>
                            {formData.activo ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest">
                           {formData.activo ? 'Empresa Activa' : 'Inactiva'}
                         </span>
                      </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Razón Social o Nombre <span className="text-rose-500">*</span></Label>
                         <div className="relative group">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input autoFocus required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} className="h-12 pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-base font-bold rounded-xl shadow-sm focus:border-emerald-400" placeholder="Ej: Trigos del Valle S.A." />
                         </div>
                    </div>
                    
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Rubro Principal</Label>
                        <Select value={formData.rubro} onValueChange={v => setFormData({ ...formData, rubro: v })}>
                            <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm font-medium shadow-sm transition-all focus:ring-emerald-400 focus:border-emerald-400">
                               <SelectValue placeholder="Seleccionar rubro..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl max-h-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl">
                               {RUBROS.map(r => (
                                 <SelectItem key={r} value={r} className="text-sm font-medium focus:bg-emerald-50 dark:focus:bg-emerald-900/30 focus:text-emerald-700 dark:focus:text-emerald-400 cursor-pointer rounded-lg mx-1">{r}</SelectItem>
                               ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Calificación Inicial</Label>
                        <div className="flex h-12 items-center justify-around bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4">
                           {[1,2,3,4,5].map(s => (
                             <button key={s} type="button" onClick={() => setFormData({ ...formData, calificacion: s })} className="hover:scale-150 transition-transform duration-300 p-1">
                               <Star className={cn('w-5 h-5', s <= formData.calificacion ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-800')} />
                             </button>
                           ))}
                        </div>
                    </div>
                    
                    <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Identidad Visual (Logo URL)</Label>
                        <div className="flex gap-4">
                          <Input value={formData.imagen} onChange={e => setFormData({ ...formData, imagen: e.target.value })} placeholder="https://ejemplo.com/logo.png" className="h-12 flex-1 rounded-xl shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:border-emerald-400" />
                          <div className={cn("w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0 border bg-white dark:bg-slate-900 flex items-center justify-center", formData.imagen ? "border-emerald-200" : "border-slate-200 border-dashed dark:border-slate-700 w-12")}>
                             {formData.imagen ? <img src={formData.imagen} alt="logo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <Building2 className="w-5 h-5 text-slate-300" />}
                          </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTACTO Y UBICACIÓN ── */}
            <div className="p-5 rounded-3xl bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-blue-100/50 dark:border-blue-900/30 pb-3">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Contacto y Ubicación</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Asesor / Representante</Label>
                         <div className="relative group">
                            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input value={formData.contacto} onChange={e => setFormData({ ...formData, contacto: e.target.value })} className="h-12 pl-10 bg-white dark:bg-slate-900 border-blue-100/60 dark:border-slate-800 rounded-xl text-sm shadow-sm focus:border-blue-400" placeholder="Opcional" />
                         </div>
                    </div>
                    <div className="space-y-1.5">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp / Teléfono</Label>
                         <div className="relative group">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} className="h-12 pl-10 bg-white dark:bg-slate-900 border-blue-100/60 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm focus:border-emerald-400" placeholder="Ej: +57 320 000 0000" />
                         </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correo Electrónico</Label>
                         <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-12 pl-10 bg-white dark:bg-slate-900 border-blue-100/60 dark:border-slate-800 rounded-xl text-sm shadow-sm focus:border-rose-400" placeholder="aliado@ejemplo.com" />
                         </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Dirección Física o Sede</Label>
                         <div className="relative group">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} className="h-12 pl-10 bg-white dark:bg-slate-900 border-blue-100/60 dark:border-slate-800 rounded-xl text-sm shadow-sm focus:border-indigo-400" placeholder="Dirección comercial completa" />
                         </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                         <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Condiciones y Notas Internas</Label>
                         <div className="relative group">
                             <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                             <Textarea value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} rows={2} className="pl-10 rounded-xl bg-white dark:bg-slate-900 border-blue-100/60 dark:border-slate-800 resize-none text-sm shadow-sm focus:border-amber-400 min-h-[4rem] py-3" placeholder="Horarios de entrega, créditos otorgados, pedidos mínimos..." />
                         </div>
                    </div>
                </div>
            </div>

            {/* ── CATÁLOGO / PRODUCTOS RELACIONADOS ── */}
            <div className="p-5 rounded-3xl bg-indigo-50/40 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-indigo-100/50 dark:border-indigo-900/30 pb-3">
                    <Package className="w-4 h-4 text-indigo-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Catálogo de Suministros Asociados</span>
                </div>
                
                <Card className="rounded-2xl border border-indigo-100/60 dark:border-indigo-900/40 bg-white/50 dark:bg-slate-900/50 shadow-none overflow-visible">
                  <CardContent className="p-4 space-y-4 overflow-visible">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-12 md:col-span-5 space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Producto o Insumo *</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                          <Input
                            value={buscarProd}
                            onChange={e => { setBuscarProd(e.target.value); setProdActual(prev => ({ ...prev, nombre: e.target.value, productoId: '' })); setShowDropdown(true); }}
                            placeholder="Buscar existente o crear nuevo..."
                            className="h-11 pl-9 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 text-sm focus:border-indigo-500 font-bold"
                          />
                          {showDropdown && filtradosBusqueda.length > 0 && (
                            <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden py-1">
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
                                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{p.nombre}</p>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{p.categoria}</p>
                                  </div>
                                  <Badge className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-none font-black uppercase">Click = Usar</Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-6 md:col-span-3 space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Presentación</Label>
                        <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40 p-1 h-11 items-center">
                          <select
                            value={prodActual.tipoEmbalaje}
                            onChange={e => setProdActual(prev => ({ ...prev, tipoEmbalaje: e.target.value as TipoEmbalaje, cantidadEmbalaje: e.target.value === 'unidad' ? 1 : prev.cantidadEmbalaje }))}
                            className="flex-1 px-1 bg-transparent text-[11px] font-bold uppercase outline-none text-slate-700 dark:text-slate-300"
                          >
                            {EMBALAJES.map(em => <option key={em.value} value={em.value}>{em.emoji} {em.label}</option>)}
                          </select>
                          {prodActual.tipoEmbalaje !== 'unidad' && (
                            <Input
                              type="number"
                              value={prodActual.cantidadEmbalaje}
                              onChange={e => setProdActual(prev => ({ ...prev, cantidadEmbalaje: parseInt(e.target.value) || 1 }))}
                              className="w-12 h-8 rounded-lg text-center font-bold bg-indigo-50 dark:bg-indigo-900/30 border-none text-indigo-600 focus:ring-0 text-sm px-1 py-0 mr-1"
                            />
                          )}
                        </div>
                      </div>

                      <div className="col-span-6 md:col-span-2 space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Costo *</Label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-black pb-[1px]">$</div>
                          <Input
                            type="number"
                            value={prodActual.precioCosto || ''}
                            onChange={e => setProdActual(prev => ({ ...prev, precioCosto: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="h-11 pl-8 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 font-bold text-indigo-600 focus:border-indigo-500 text-sm"
                          />
                        </div>
                      </div>

                      <div className="col-span-12 md:col-span-2">
                        <Button 
                          type="button" 
                          onClick={addProductoCatalogo} 
                          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {catalogoItems.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-slate-900 shadow-sm mt-4">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/30 border-b border-indigo-100/50 dark:border-indigo-900/30">
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Insumo</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Empaque</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Costo / U.</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Remover</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                        {catalogoItems.map((item) => (
                          <tr key={item.uid} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", item.destino === 'insumo' ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20")}>
                                  {item.destino === 'insumo' ? <Wrench className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{item.nombre}</p>
                                    <p className="text-[10px] text-slate-400 capitalize">{item.categoria}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">
                                {EMBALAJES.find(e => e.value === item.tipoEmbalaje)?.emoji} {item.cantidadEmbalaje} {item.tipoEmbalaje !== 'unidad' ? 'uds' : ''}
                              </span>
                            </td>
                              <td className="px-4 py-3 text-right">
                                <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(item.precioCosto)}</p>
                                {item.cantidadEmbalaje > 1 && <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">P.U: {formatCurrency(item.costoUnitario)}</p>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button type="button" onClick={() => setCatalogoItems(prev => prev.filter(i => i.uid !== item.uid))} className="w-8 h-8 mx-auto rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>

            {/* ── BOTONES ── */}
            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" className="h-14 flex-1 rounded-2xl text-sm font-black uppercase tracking-widest border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={onClose}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={guardando} className="h-14 flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 border-none transition-all flex items-center justify-center gap-2">
                    {guardando ? 'Guardando...' : (editingProveedor ? '✓ Guardar Cambios' : '+ Agregar Proveedor')}
                </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
