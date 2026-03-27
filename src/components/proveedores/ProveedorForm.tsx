import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Truck, Plus, Edit2, Trash2, Phone, Mail, MapPin,
  Star, X, UserCheck, CheckCircle2, Tag, Store,
  Wrench, Building2, Search, FileText, Save, Scan, Camera,
  ShieldCheck, Info, ImageIcon, ShoppingCart,
  Zap,
  Bot,
  ScanLine,
  Fingerprint,
  Activity,
  Cpu,
  Layers,
  Database,
  History
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { procesarImagenFactura, sugerirCategoria, normalizarTexto, type ResultadoOCR, type ProductoDetectado } from '@/lib/ocr-service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  stockRecibido: number;
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
  'Harinas', 'Lácteos', 'Azúcares', 'Huevos', 'Aceites', 
  'Frutas y Verduras', 'Chocolates', 'Levaduras', 'Esencias', 
  'Empaques', 'Limpieza', 'Rellenos y Cárnicos', 
  'Decoración y Coberturas', 'Frutos Secos y Semillas', 
  'Aditivos y Conservantes', 'Utensilios y Despacho', 
  'Servicios/Varios', 'Otro'
];

const PROD_INIT: Omit<ProductoCatalogo, 'uid' | 'costoUnitario' | 'precioVenta' | 'precioVentaPack'> = {
  productoId: '', nombre: '', categoria: CATEGORIAS_PROD[0],
  precioCosto: 0, margenVenta: 30, cantidadEmbalaje: 1,
  tipoEmbalaje: 'unidad', destino: 'insumo', notas: '',
  stockRecibido: 0,
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
  const [isAnalizando, setIsAnalizando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', contacto: '', telefono: '', email: '',
    direccion: '', imagen: '', calificacion: 5,
    activo: true, rubro: '', notas: '',
  });

  const [catalogoItems, setCatalogoItems] = useState<ProductoCatalogo[]>([]);
  const [prodActual, setProdActual] = useState(PROD_INIT);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [buscarProd, setBuscarProd] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<ResultadoOCR | null>(null);
  const [activeItemsScan, setActiveItemsScan] = useState<ProductoDetectado[]>([]);
  const [isCategoriaIA, setIsCategoriaIA] = useState(false);

  const fileInputUploadRef = useRef<HTMLInputElement>(null);
  const fileInputCameraRef = useRef<HTMLInputElement>(null);

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

  const costUnit = useMemo(() => {
    const cost = Number(prodActual.precioCosto || 0);
    const packQty = Number(prodActual.cantidadEmbalaje || 1) || 1;
    return cost / packQty;
  }, [prodActual.precioCosto, prodActual.cantidadEmbalaje]);

  const sellPrice = useMemo(() => {
    // Si no hay margen, el precio de venta es igual al costo unitario
    if (!prodActual.margenVenta) return costUnit;
    return costUnit * (1 + Number(prodActual.margenVenta) / 100);
  }, [costUnit, prodActual.margenVenta]);

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

    const itemData: ProductoCatalogo = {
      ...prodActual,
      uid: editingUid || crypto.randomUUID(),
      costoUnitario: costUnit, // Ya calculado por el useMemo
      precioVenta: Math.round(sellPrice), // Precio por UNIDAD basado en margen
      precioVentaPack: Math.round(sellPrice * (prodActual.cantidadEmbalaje || 1)), 
      stockRecibido: prodActual.stockRecibido
    };

    if (editingUid) {
      setCatalogoItems(prev => prev.map(item => item.uid === editingUid ? itemData : item));
      toast.success('Producto actualizado en el catálogo');
    } else {
      setCatalogoItems(prev => [itemData, ...prev]);
      toast.success('Producto añadido al catálogo');
    }
    setProdActual(PROD_INIT);
    setEditingUid(null);
    setBuscarProd('');
  };

  // --- IA VISION: EXTRACTOR DE DATOS ---
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setFotoCapturada(base64);
        setIsAnalizando(true);
        setOcrProgress(0);
        setOcrResult(null);
        
        // Protocolo AI-Forensic-Analyzer (Integración OCR Real)
        toast.promise(
          procesarImagenFactura(base64, (p) => setOcrProgress(p)),
          {
            loading: (
              <div className="flex flex-col gap-1">
                <span className="font-black text-xs uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Scanner Forense Nexus
                </span>
                <span className="text-[10px] text-slate-500">Mapeando estructura de datos... {ocrProgress}%</span>
              </div>
            ),
            success: (result: ResultadoOCR) => {
              setIsAnalizando(false);
              setOcrResult(result);
              
              if (result.errores.length > 0 && result.productos.length === 0) {
                return result.errores[0];
              }

              // Mapeo Inteligente del Proveedor (Si no tiene nombre)
              if (result.proveedor && !formData.nombre) {
                setFormData(prev => ({
                  ...prev,
                  nombre: result.proveedor?.nombre || prev.nombre,
                  telefono: result.proveedor?.telefono || prev.telefono,
                  notas: result.proveedor?.nit ? `NIT: ${result.proveedor.nit}\n${prev.notas}` : prev.notas
                }));
              }

              // Mapeo Inteligente de Productos
              if (result.productos.length > 0) {
                setActiveItemsScan(result.productos);
                const first = result.productos[0];
                const catSug = sugerirCategoria(first.nombre);
                
                setProdActual(curr => ({
                  ...curr,
                  nombre: first.nombre,
                  precioCosto: first.precioUnitario || first.costoTotal,
                  categoria: catSug !== 'General' ? catSug : curr.categoria,
                  cantidadEmbalaje: first.cantidad || 1,
                  notas: `Detectado vía Scanner Forense (Confianza: ${first.confianza}%)`
                }));
                setBuscarProd(first.nombre);
                if (catSug !== 'General') setIsCategoriaIA(true);
                return `Análisis completado: ${result.productos.length} items detectados`;
              }
              
              return "Factura analizada (Sin productos detectados)";
            },
            error: () => {
              setIsAnalizando(false);
              return 'Error crítico en el motor forense. Intenta con una imagen más clara.';
            }
          }
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditItem = (item: ProductoCatalogo) => {
    setProdActual({ ...item });
    setBuscarProd(item.nombre);
    setEditingUid(item.uid);
    toast.info(`Editando: ${item.nombre}`);
  };

  const cancelEdit = () => {
    setProdActual(PROD_INIT);
    setEditingUid(null);
    setBuscarProd('');
    setIsCategoriaIA(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 scrollbar-hide">
        
        {/* ── HEADER PREMIUM ── */}
        <div className="p-8 text-white relative bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700">
          <div className="flex items-center gap-4">
             <div className="p-3.5 bg-white/20 rounded-[1.5rem] backdrop-blur-md border border-white/10 shadow-lg animate-ag-float">
                {editingProveedor ? <Edit2 className="w-7 h-7" /> : <Building2 className="w-7 h-7" />}
             </div>
             <div>
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">
                  {editingProveedor ? 'Actualizar Perfil' : 'Registro de Aliado'}
                </DialogTitle>
                <DialogDescription className="text-white/70 font-bold uppercase tracking-[0.2em] mt-1.5 text-[10px] flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-blue-200" />
                  Ecosistema Logístico · Dulce Placer v5.1
                </DialogDescription>
             </div>
          </div>
          <Button 
            variant="ghost" size="icon" type="button" 
            className="absolute right-6 top-6 text-white/50 hover:text-white hover:bg-white/20 rounded-2xl transition-all" 
            onClick={onClose}
          >
             <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">

            {/* ── SECCIÓN 1: IDENTIDAD ── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Identidad Corporativa</span>
                    </div>
                    
                    <button
                        type="button"
                        className={cn(
                          "cursor-pointer flex items-center gap-3 transition-all p-2 pr-5 rounded-2xl border-2",
                          formData.activo 
                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10" 
                            : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-500 shadow-sm"
                        )}
                        onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                    >
                         <div className={cn(
                           "flex items-center justify-center w-8 h-8 rounded-xl text-white shadow-md transition-all",
                           formData.activo ? "bg-emerald-500 rotate-0" : "bg-slate-300 dark:bg-slate-700 -rotate-90"
                         )}>
                            {formData.activo ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                         </div>
                         <span className="text-[11px] font-black uppercase tracking-widest">
                           {formData.activo ? 'Empresa Operativa' : 'Cuenta Suspendida'}
                         </span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Nombre */}
                    <div className="space-y-2 md:col-span-8">
                         <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Razón Social <span className="text-rose-500">*</span></Label>
                         <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input 
                                autoFocus required 
                                value={formData.nombre} 
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })} 
                                className="h-14 pl-12 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg font-black rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                                placeholder="Nombre comercial de la empresa..." 
                            />
                         </div>
                    </div>
                    
                    {/* Rubro */}
                    <div className="space-y-2 md:col-span-4">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Rubro</Label>
                        <Select value={formData.rubro} onValueChange={v => setFormData({ ...formData, rubro: v })}>
                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10">
                               <SelectValue placeholder="Categoría..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 p-2">
                               {RUBROS.map(r => (
                                 <SelectItem key={r} value={r} className="rounded-xl font-bold py-3 px-4 focus:bg-blue-50 dark:focus:bg-blue-900/20">{r}</SelectItem>
                               ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Calificación */}
                    <div className="space-y-2 md:col-span-4">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Clasificación de Calidad</Label>
                        <div className="flex h-14 items-center justify-around bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800 px-6 shadow-inner">
                           {[1,2,3,4,5].map(s => (
                             <button key={s} type="button" onClick={() => setFormData({ ...formData, calificacion: s })} className="hover:scale-125 transition-transform duration-200">
                               <Star className={cn('w-6 h-6 transition-all', s <= formData.calificacion ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-200 dark:text-slate-800')} />
                             </button>
                           ))}
                        </div>
                    </div>

                    {/* Logo URL */}
                    <div className="space-y-2 md:col-span-8">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Identidad Visual (URL Logo)</Label>
                        <div className="flex gap-4">
                          <div className="relative flex-1 group">
                             <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                             <Input 
                                value={formData.imagen} 
                                onChange={e => setFormData({ ...formData, imagen: e.target.value })} 
                                placeholder="https://logo-empresa.png" 
                                className="h-14 pl-12 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-mono text-[10px] focus:ring-4 focus:ring-violet-500/10" 
                             />
                          </div>
                          <div className={cn(
                            "w-14 h-14 rounded-2xl overflow-hidden shadow-lg shrink-0 border-2 bg-slate-100 dark:bg-slate-900 flex items-center justify-center transition-all", 
                            formData.imagen ? "border-blue-400 scale-105" : "border-slate-200 border-dashed dark:border-slate-800"
                          )}>
                             {formData.imagen ? (
                               <img src={formData.imagen} alt="logo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                             ) : (
                               <Info className="w-6 h-6 text-slate-300" />
                             )}
                          </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 2: LOGÍSTICA ── */}
            <div className="p-8 rounded-[2rem] bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                       <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Detalles de Enlace y Logística</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asesor Designado</Label>
                         <div className="relative group">
                            <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input value={formData.contacto} onChange={e => setFormData({ ...formData, contacto: e.target.value })} className="h-12 pl-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10" placeholder="Nombre del contacto..." />
                         </div>
                    </div>
                    <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Línea de Pedidos (WhatsApp)</Label>
                         <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} className="h-12 pl-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-black text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/10" placeholder="+57 --- --- ----" />
                         </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correo Electrónico Corporativo</Label>
                         <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-12 pl-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-rose-500/10" placeholder="empresa@ejemplo.com" />
                         </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección de Suministro</Label>
                         <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} className="h-12 pl-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10" placeholder="Sede principal o bodega..." />
                         </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notas y Condiciones Comerciales</Label>
                         <div className="relative group">
                             <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                             <Textarea value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} rows={2} className="pl-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none text-sm font-medium focus:ring-4 focus:ring-amber-500/10 min-h-[5rem] py-4" placeholder="Ej: Pedido mínimo 50k, crédito 15 días, entregas lunes y jueves..." />
                         </div>
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 3: CATÁLOGO DE PRODUCTOS / INSUMOS ── */}
            <div className="space-y-6 relative overflow-visible">
                {/* IA FORENSIC SCANNER OVERLAY (Volt & Pixel) */}
                {isAnalizando && (
                  <div className="absolute inset-0 z-[200] rounded-[2rem] bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-ag-fade-in border-4 border border-indigo-500/30 overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.2)]">
                      {/* Scanning Beam Animation */}
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-[scan-beam_2s_ease-in-out_infinite] z-10" />
                      
                      {/* Matrix Grid Surface (Simulation) */}
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]" />

                      <div className="relative mb-8 scale-150">
                          <Cpu className="w-16 h-16 text-cyan-400 animate-ag-float" />
                          <div className="absolute inset-0 flex items-center justify-center">
                              <Activity className="w-6 h-6 text-indigo-500 animate-pulse" />
                          </div>
                          {/* Satellite Data Nodes */}
                          <div className="absolute -top-4 -right-4 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-75" />
                          <div className="absolute -bottom-4 -left-4 w-3 h-3 bg-amber-500 rounded-full animate-ping opacity-50 delay-700" />
                      </div>
                      
                      <div className="space-y-4 w-full max-w-xs z-20">
                          <div className="flex justify-between items-end mb-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 flex items-center gap-2">
                                <Fingerprint className="w-3 h-3" />
                                Mapeo Forense
                              </span>
                              <span className="text-xl font-black text-white tabular-nums">{ocrProgress}%</span>
                          </div>
                          <Progress value={ocrProgress} className="h-2 bg-slate-800" />
                          
                          <div className="grid grid-cols-2 gap-2 mt-4">
                              <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-400 h-3 w-3" />
                                  <div className="flex flex-col text-left">
                                      <span className="text-[8px] font-black text-slate-500">OCR CORE</span>
                                      <span className="text-[10px] font-bold text-slate-300">Tesseract Engine</span>
                                  </div>
                              </div>
                              <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                                  <Database className="w-4 h-4 text-emerald-400 h-3 w-3" />
                                  <div className="flex flex-col text-left">
                                      <span className="text-[8px] font-black text-slate-500">ESTRUCTURA</span>
                                      <span className="text-[10px] font-bold text-slate-300">Analizando...</span>
                                  </div>
                              </div>
                          </div>

                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] pt-4 animate-pulse">
                            Buscando descriptores y precios unitarios...
                          </p>
                      </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Catálogo de Productos</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputUploadRef.current?.click()}
                          className="h-8 rounded-full border-dashed border-indigo-300 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-white dark:hover:bg-indigo-900/40 text-[9px] font-black uppercase tracking-widest px-3 flex items-center gap-1.5 transition-all"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Subir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputCameraRef.current?.click()}
                          className="h-8 rounded-full border-dashed border-indigo-300 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-white dark:hover:bg-indigo-900/40 text-[9px] font-black uppercase tracking-widest px-3 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Camera className="w-3 h-3" />
                          Tomar Foto
                        </Button>
                      </div>

                      <input
                        type="file"
                        ref={fileInputUploadRef}
                        onChange={handleCapture}
                        accept="image/*"
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={fileInputCameraRef}
                        onChange={handleCapture}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                    </div>
                    <Badge variant="outline" className="rounded-full bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 uppercase font-black text-[9px] px-3 py-1">
                      {catalogoItems.length} Registrados
                    </Badge>
                </div>
                
                <Card className="rounded-[2rem] border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-slate-900/20 shadow-none overflow-visible">
                  <CardContent className="p-6 space-y-6 overflow-visible">
                    <div className="flex flex-col gap-6">
                      
                      {/* FILA 1: IDENTIFICACIÓN */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Buscador de Producto (7 Cols) */}
                        <div className="md:col-span-7 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-1">Producto / Insumo *</Label>
                          <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 group-focus-within:text-indigo-600" />
                            <Input
                              value={buscarProd}
                              onChange={e => { 
                                setBuscarProd(e.target.value); 
                                setProdActual(prev => ({ ...prev, nombre: e.target.value, productoId: '' })); 
                                setShowDropdown(true);
                                setIsCategoriaIA(false); 
                              }}
                              placeholder="Nombre del producto..."
                              className="h-12 pl-11 rounded-xl bg-white dark:bg-slate-950 border-indigo-100 dark:border-indigo-900/40 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 text-foreground"
                            />
                            {showDropdown && filtradosBusqueda.length > 0 && (
                              <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden py-1">
                                {filtradosBusqueda.map(p => (
                                  <button
                                    key={p.id} type="button"
                                    onClick={() => {
                                      setProdActual(prev => ({ ...prev, productoId: p.id, nombre: p.nombre, categoria: p.categoria, margenVenta: p.margenUtilidad || 30, destino: p.tipo === 'ingrediente' ? 'insumo' : 'venta' }));
                                      setBuscarProd(p.nombre); setShowDropdown(false);
                                      setIsCategoriaIA(false);
                                    }}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors"
                                  >
                                    <div>
                                      <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{p.nombre}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.categoria}</p>
                                    </div>
                                    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-black text-[9px] uppercase">Usar</Badge>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Categoría (5 Cols) */}
                        <div className="md:col-span-5 space-y-2 relative">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-1 flex items-center gap-1">
                            Categoría
                            {isCategoriaIA && <Badge className="bg-cyan-100 text-cyan-700 py-0 px-1 text-[7px] border-cyan-200 animate-pulse">AUTO-IA</Badge>}
                          </Label>
                          <Select 
                            value={prodActual.categoria} 
                            onValueChange={v => {
                              setProdActual({ ...prodActual, categoria: v });
                              setIsCategoriaIA(false);
                            }}
                          >
                            <SelectTrigger className={cn(
                              "h-12 rounded-xl bg-white dark:bg-slate-950 border-indigo-100 dark:border-indigo-900/40 text-[11px] font-black uppercase tracking-tighter transition-all",
                              isCategoriaIA && "ring-4 ring-cyan-500/20 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                            )}>
                               <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 p-1 max-h-60 overflow-y-auto">
                               {CATEGORIAS_PROD.map(c => (
                                 <SelectItem key={c} value={c} className="rounded-lg font-black uppercase text-[10px] tracking-tight">{c}</SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* FILA 2: ESPECIFICACIONES FINANCIERAS */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        
                        {/* Presentación (3 Cols) */}
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-1">Unidad / Pack</Label>
                          <div className="flex bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-900/40 p-1.5 h-12 items-center">
                            <select
                              value={prodActual.tipoEmbalaje}
                              onChange={e => setProdActual(prev => ({ ...prev, tipoEmbalaje: e.target.value as TipoEmbalaje, cantidadEmbalaje: e.target.value === 'unidad' ? 1 : prev.cantidadEmbalaje }))}
                              className="flex-1 px-2 bg-transparent text-[10px] font-black uppercase outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              {EMBALAJES.map(em => (
                                <option key={em.value} value={em.value} className="bg-white text-slate-900 font-bold p-2">
                                  {em.emoji} {em.label}
                                </option>
                              ))}
                            </select>
                            {/* [Nexus-Volt] Habilitar selector siempre para ajustar unidades o packs */}
                            <input
                              type="number"
                              min="1"
                              value={prodActual.cantidadEmbalaje}
                              onChange={e => setProdActual(prev => ({ ...prev, cantidadEmbalaje: parseInt(e.target.value) || 1 }))}
                              className="w-12 h-8 rounded-lg text-center font-black bg-indigo-50 dark:bg-indigo-900/30 border-none text-indigo-600 outline-none text-[11px] hover:bg-indigo-100 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Uso (2 Cols) */}
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-1">Uso Destino</Label>
                          <div className="flex bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-900/40 p-1 h-12 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setProdActual(prev => ({ ...prev, destino: 'insumo' }))}
                              className={cn(
                                "flex-1 h-full rounded-lg flex items-center justify-center transition-all",
                                prodActual.destino === 'insumo' ? "bg-amber-100 text-amber-600 shadow-sm" : "text-slate-300 hover:text-slate-400"
                              )}
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-black ml-1 uppercase">Insumo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setProdActual(prev => ({ ...prev, destino: 'venta' }))}
                              className={cn(
                                "flex-1 h-full rounded-lg flex items-center justify-center transition-all",
                                prodActual.destino === 'venta' ? "bg-emerald-100 text-emerald-600 shadow-sm" : "text-slate-300 hover:text-slate-400"
                              )}
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-black ml-1 uppercase">Venta</span>
                            </button>
                          </div>
                        </div>

                        {/* Valor Paca (2 Cols) */}
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-1">Valor Paca *</Label>
                          <div className="relative group/cost">
                              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400" />
                              <Input
                                  type="number"
                                  value={prodActual.precioCosto || ''}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setProdActual(prev => ({ 
                                      ...prev, 
                                      precioCosto: val
                                    }));
                                  }}
                                  className={cn(
                                    "h-12 pl-8 rounded-xl bg-white dark:bg-slate-950 font-black text-xs transition-all",
                                    "border-indigo-100 dark:border-indigo-900/40 text-blue-600 focus:ring-4 focus:ring-indigo-500/10"
                                  )}
                                  placeholder="0"
                              />
                          </div>
                        </div>

                        {/* Costo Unitario (2 Cols) - AHORA EDITABLE */}
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Costo Unitario</Label>
                          <div className="relative group">
                              <Input 
                                type="number"
                                value={costUnit > 0 ? Math.round(costUnit) : ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  // [Nexus-Volt] Si cambia el unitario, recalculamos el total de la paca (precioCosto)
                                  setProdActual(prev => ({ 
                                    ...prev, 
                                    precioCosto: val * (prev.cantidadEmbalaje || 1) 
                                  }));
                                }}
                                className="h-12 px-4 bg-blue-50/50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-500/40 rounded-xl text-blue-700 dark:text-blue-400 font-black text-xs tabular-nums focus:ring-4 focus:ring-blue-500/10 transition-all"
                                placeholder="0"
                              />
                          </div>
                        </div>

                        {/* Margen (2 Cols) */}
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-1">Ganancia %</Label>
                          <div className="relative group">
                            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                            <Input 
                              type="number"
                              value={prodActual.margenVenta}
                              onChange={(e) => setProdActual({ ...prodActual, margenVenta: Number(e.target.value) })}
                              className="h-12 pl-9 rounded-xl bg-white dark:bg-slate-950 border-emerald-100 dark:border-emerald-900/40 font-black text-xs text-emerald-600 focus:ring-4 focus:ring-emerald-500/10"
                              placeholder="30"
                            />
                          </div>
                        </div>

                        {/* Venta (3 Cols) */}
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Precio Venta Final</Label>
                          <div className="relative group flex gap-2">
                            <div className="relative flex-1">
                              <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                              <Input 
                                type="number"
                                value={sellPrice > 0 ? Math.round(sellPrice) : ''}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  if (costUnit > 0) {
                                    const newMargin = ((newPrice / costUnit) - 1) * 100;
                                    setProdActual(prev => ({ ...prev, margenVenta: Math.round(newMargin) }));
                                  }
                                }}
                                className="h-12 pl-9 rounded-xl bg-white dark:bg-slate-950 border-emerald-100 dark:border-emerald-900/40 font-black text-xs text-emerald-700 focus:ring-4 focus:ring-emerald-500/10"
                                placeholder="0"
                              />
                            </div>
                            {editingUid && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={cancelEdit}
                                  className="w-10 h-10 p-0 text-rose-500 hover:bg-rose-50 rounded-xl"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* FILA 3: ACCIÓN */}
                      <div className="pt-2 flex justify-end border-t border-indigo-100/50 dark:border-indigo-900/20">
                          <Button 
                            type="button" 
                            onClick={addProductoCatalogo} 
                            className={cn(
                              "w-full md:w-auto min-w-[200px] h-12 text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 px-8",
                              editingUid ? "bg-amber-500 shadow-amber-500/20" : "bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700"
                            )}
                          >
                            {editingUid ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            <span className="text-[11px] font-black uppercase tracking-widest">
                              {editingUid ? 'Guardar Cambios' : 'Añadir al Catálogo'}
                            </span>
                          </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {fotoCapturada && (
                  <div className="relative group rounded-3xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 animate-ag-scale-in max-h-48 group">
                    <img src={fotoCapturada} alt="Captura" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                    
                    {/* Data Markers Overlays (Simulated visual feedback of detection) */}
                    {!isAnalizando && ocrResult?.productos.map((p, idx) => (
                      <div 
                        key={idx}
                        className="absolute bg-emerald-500/80 backdrop-blur-sm text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg border border-white/20 animate-ag-fade-in"
                        style={{ top: `${20 + idx * 15}%`, left: `${30 + (idx % 2) * 20}%` }}
                      >
                        {p.nombre} - Detectado ({p.confianza}%)
                      </div>
                    ))}

                    <div className={cn(
                      "absolute inset-0 flex flex-col items-center justify-center p-4 transition-all duration-500",
                      isAnalizando ? "bg-indigo-950/60 backdrop-blur-md" : "bg-transparent group-hover:bg-slate-950/40 backdrop-blur-none group-hover:backdrop-blur-[2px]"
                    )}>
                       {isAnalizando ? (
                         <>
                           <Activity className="w-8 h-8 text-cyan-400 animate-pulse mb-2" />
                           <p className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Escaneo Forense en Curso</p>
                         </>
                       ) : (
                         <div className="opacity-0 group-hover:opacity-100 flex flex-col items-center gap-2">
                           <History className="w-6 h-6 text-white" />
                           <p className="text-white text-[9px] font-black uppercase tracking-[0.2em]">Vista Previa de Factura</p>
                           <Button 
                             variant="ghost" size="sm" 
                             className="h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[9px] font-black"
                             onClick={() => setFotoCapturada(null)}
                           >
                             Descartar y Re-escanear
                           </Button>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {catalogoItems.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 animate-ag-slide-up">
                        <div className="flex-1 flex gap-6">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Insumos</span>
                                <span className="text-sm font-black text-amber-600 tabular-nums">{catalogoItems.filter(i => i.destino === 'insumo').length}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Productos Venta</span>
                                <span className="text-sm font-black text-emerald-600 tabular-nums">{catalogoItems.filter(i => i.destino === 'venta').length}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inversión Estimada</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inversión Total</span>
                                <span className="text-sm font-black text-indigo-600 tabular-nums">
                                    {formatCurrency(catalogoItems.reduce((acc, curr) => acc + curr.precioCosto, 0))}
                                </span>
                            </div>
                        </div>
                        <Badge className="bg-indigo-600/10 text-indigo-600 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 font-black text-[9px] uppercase px-3 py-1 rounded-lg">Portfolio Live</Badge>
                    </div>

                    {/* Tabla de Suministros (Optimización Volt) */}
                    <div className="overflow-hidden rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Producto / Insumo</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Und/Pack</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Costo Aliado</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 text-center">Ganancia %</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 text-right">Precio Venta</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {catalogoItems.map((item) => (
                            <TableRow 
                              key={item.uid} 
                              item={item} 
                              isEditing={editingUid === item.uid}
                              onEdit={() => handleEditItem(item)}
                              onDelete={() => setCatalogoItems(prev => prev.filter(i => i.uid !== item.uid))}
                              formatCurrency={formatCurrency}
                              embalajes={EMBALAJES}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>

            {/* ── PIE DE FORMULARIO ── */}
            <div className="flex gap-4 pt-8 sticky bottom-0 bg-white dark:bg-slate-950 bg-opacity-90 backdrop-blur-sm">
                <Button 
                    type="button" variant="outline" 
                    className="h-16 flex-1 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all" 
                    onClick={onClose}
                >
                    Cancelar
                </Button>
                <Button 
                    type="submit" disabled={guardando} 
                    className="h-16 flex-[2] bg-indigo-600 hover:bg-blue-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/30 border-none transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    {guardando ? (
                       <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Procesando...
                       </span>
                    ) : (
                       <>
                          {editingProveedor ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                          {editingProveedor ? 'Actualizar Aliado' : 'Confirmar Registro'}
                       </>
                    )}
                </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── COMPONENTE MEMORIZADO PARA FILAS (OPTIMIZACIÓN VOLT) ── */
const TableRow = React.memo(({ 
  item, isEditing, onEdit, onDelete, formatCurrency, embalajes 
}: { 
  item: ProductoCatalogo; isEditing: boolean; onEdit: () => void; onDelete: () => void; formatCurrency: any; embalajes: any[] 
}) => (
  <tr className={cn(
    "transition-all group",
    isEditing ? "bg-indigo-500/10 border-l-4 border-indigo-500 shadow-inner" : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border-l-4 border-transparent"
  )}>
    <td className="px-6 py-4">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110", 
          item.destino === 'insumo' ? "bg-amber-50 text-amber-500 border-amber-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"
        )}>
          {item.destino === 'insumo' ? <Wrench className="w-5 h-5" /> : <Store className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight truncate">{item.nombre}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.categoria}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-4 text-center">
      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">
        {embalajes.find(e => e.value === item.tipoEmbalaje)?.emoji} {item.cantidadEmbalaje}
      </Badge>
    </td>
    <td className="px-4 py-4 text-right">
      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatCurrency(item.precioCosto)}</p>
      {item.cantidadEmbalaje > 1 && <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">P.U: {formatCurrency(item.costoUnitario)}</p>}
    </td>
    <td className="px-4 py-4 text-center font-black text-[10px] text-emerald-600">
      {item.margenVenta}%
    </td>
    <td className="px-4 py-4 text-right">
      <p className="text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(item.precioVenta)}</p>
    </td>
    <td className="px-6 py-4 text-center">
      <div className={cn(
        "flex items-center justify-center gap-1 transition-opacity",
        isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <button
          type="button"
          onClick={onEdit}
          disabled={isEditing}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 border",
            isEditing ? "text-slate-300 cursor-not-allowed" : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          )}
          title="Editar"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-9 h-9 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center justify-center transition-all bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 border"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
));

TableRow.displayName = 'TableRow';
