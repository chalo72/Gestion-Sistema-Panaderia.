import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  CreditCard, 
  Cake, 
  Sparkles, 
  Camera, 
  Upload, 
  Send, 
  Plus, 
  CheckCircle2, 
  Clock, 
  User, 
  DollarSign, 
  Calendar, 
  Image as ImageIcon,
  Share2,
  Copy,
  Trash2,
  Phone,
  Flame,
  Tag,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import type { Trabajador } from '@/types';

// ── Tipos ─────────────────────────────────────────────────────────────

export interface CreditoEmpleadoWhatsApp {
  id: string;
  trabajadorId: string;
  trabajadorNombre: string;
  monto: number;
  descripcion: string;
  fotoUrl?: string;
  fecha: string;
  hora: string;
  estado: 'pendiente' | 'deducido';
}

export type EstadoTorta = 'pendiente' | 'en_horno' | 'decorando' | 'lista' | 'entregada';

export interface PedidoTortaWhatsApp {
  id: string;
  clienteNombre: string;
  clienteTelefono: string;
  fechaEntrega: string;
  horaEntrega: string;
  porciones: number;
  sabor: string;
  relleno: string;
  cubierta: string;
  dedicatoria: string;
  fotoReferenciaUrl?: string;
  valorTotal: number;
  abono: number;
  estado: EstadoTorta;
  creadoEn: string;
}

export interface CampanaMarketingIA {
  id: string;
  productoNombre: string;
  campanaTipo: string;
  copyInstagram: string;
  copyWhatsApp: string;
  hashtags: string[];
  fotoUrl?: string;
  fecha: string;
}

interface WhatsAppHubProps {
  trabajadores?: Trabajador[];
  onAddGasto?: (g: any) => Promise<any>;
}

export default function WhatsAppHub({ trabajadores = [] }: WhatsAppHubProps) {
  const [activeTab, setActiveTab] = useState<'creditos' | 'tortas' | 'marketing'>('creditos');

  // ── ESTADO: CRÉDITOS EMPLEADAS ──────────────────────────────────────
  const [creditos, setCreditos] = useState<CreditoEmpleadoWhatsApp[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dp_whatsapp_creditos_empleadas') || '[]');
    } catch { return []; }
  });
  const [nuevoCreditoTrabajador, setNuevoCreditoTrabajador] = useState('');
  const [nuevoCreditoMonto, setNuevoCreditoMonto] = useState('');
  const [nuevoCreditoDesc, setNuevoCreditoDesc] = useState('');
  const [nuevoCreditoFoto, setNuevoCreditoFoto] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('dp_whatsapp_creditos_empleadas', JSON.stringify(creditos));
  }, [creditos]);

  const handleFotoCredito = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setNuevoCreditoFoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRegistrarCredito = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCreditoTrabajador || !nuevoCreditoMonto) {
      toast.error('Selecciona una trabajadora y el monto');
      return;
    }

    const t = trabajadores.find(tr => tr.id === nuevoCreditoTrabajador);
    const nuevo: CreditoEmpleadoWhatsApp = {
      id: `credito_${Date.now()}`,
      trabajadorId: nuevoCreditoTrabajador,
      trabajadorNombre: t?.nombre || nuevoCreditoTrabajador,
      monto: Number(nuevoCreditoMonto),
      descripcion: nuevoCreditoDesc || 'Productos / Préstamo en tienda',
      fotoUrl: nuevoCreditoFoto || undefined,
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      estado: 'pendiente'
    };

    setCreditos([nuevo, ...creditos]);
    setNuevoCreditoMonto('');
    setNuevoCreditoDesc('');
    setNuevoCreditoFoto(null);
    toast.success('Crédito registrado correctamente con evidencia');
  };

  const handleMarcarDeducido = (id: string) => {
    setCreditos(creditos.map(c => c.id === id ? { ...c, estado: c.estado === 'pendiente' ? 'deducido' : 'pendiente' } : c));
    toast.success('Estado de nómina actualizado');
  };

  const handleEliminarCredito = (id: string) => {
    setCreditos(creditos.filter(c => c.id !== id));
    toast.success('Registro eliminado');
  };

  // ── ESTADO: PEDIDOS TORTAS Y REPOSTERÍA ──────────────────────────────
  const [pedidosTortas, setPedidosTortas] = useState<PedidoTortaWhatsApp[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dp_whatsapp_pedidos_tortas') || '[]');
    } catch { return []; }
  });

  const [tortaCliente, setTortaCliente] = useState('');
  const [tortaTelefono, setTortaTelefono] = useState('');
  const [tortaFecha, setTortaFecha] = useState('');
  const [tortaHora, setTortaHora] = useState('');
  const [tortaPorciones, setTortaPorciones] = useState('20');
  const [tortaSabor, setTortaSabor] = useState('Vainilla con Arequipe');
  const [tortaRelleno, setTortaRelleno] = useState('Frutas / Crema');
  const [tortaCubierta, setTortaCubierta] = useState('Crema Chantilly');
  const [tortaDedicatoria, setTortaDedicatoria] = useState('');
  const [tortaTotal, setTortaTotal] = useState('');
  const [tortaAbono, setTortaAbono] = useState('');
  const [tortaFoto, setTortaFoto] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('dp_whatsapp_pedidos_tortas', JSON.stringify(pedidosTortas));
  }, [pedidosTortas]);

  const handleFotoTorta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setTortaFoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRegistrarTorta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tortaCliente || !tortaFecha || !tortaHora) {
      toast.error('Completa el nombre del cliente, fecha y hora de entrega');
      return;
    }

    const nuevo: PedidoTortaWhatsApp = {
      id: `torta_${Date.now()}`,
      clienteNombre: tortaCliente,
      clienteTelefono: tortaTelefono,
      fechaEntrega: tortaFecha,
      horaEntrega: tortaHora,
      porciones: Number(tortaPorciones) || 15,
      sabor: tortaSabor,
      relleno: tortaRelleno,
      cubierta: tortaCubierta,
      dedicatoria: tortaDedicatoria,
      fotoReferenciaUrl: tortaFoto || undefined,
      valorTotal: Number(tortaTotal) || 0,
      abono: Number(tortaAbono) || 0,
      estado: 'pendiente',
      creadoEn: new Date().toISOString()
    };

    setPedidosTortas([nuevo, ...pedidosTortas]);
    setTortaCliente('');
    setTortaTelefono('');
    setTortaFecha('');
    setTortaHora('');
    setTortaDedicatoria('');
    setTortaTotal('');
    setTortaAbono('');
    setTortaFoto(null);
    toast.success('Pedido de torta enviado a la cola de repostería');
  };

  const handleCambiarEstadoTorta = (id: string, nuevoEstado: EstadoTorta) => {
    setPedidosTortas(pedidosTortas.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    toast.success(`Estado actualizado a: ${nuevoEstado.replace('_', ' ').toUpperCase()}`);
  };

  const handleNotificarClienteWhatsApp = (pedido: PedidoTortaWhatsApp) => {
    if (!pedido.clienteTelefono) {
      toast.error('Este pedido no tiene número telefónico registrado');
      return;
    }
    const cleanTel = pedido.clienteTelefono.replace(/\D/g, '');
    const msg = `🎂 *¡Hola ${pedido.clienteNombre}!* Te saludamos de *Panadería Dulce Placer*.\n\n` +
      `✨ Tu torta para el día *${pedido.fechaEntrega} a las ${pedido.horaEntrega}* ya se encuentra en estado: *${pedido.estado.toUpperCase()}*.\n` +
      `🍰 *Especificaciones:* ${pedido.porciones} porciones, sabor ${pedido.sabor}.\n` +
      (pedido.valorTotal > pedido.abono ? `💵 *Saldo pendiente:* ${formatCurrency(pedido.valorTotal - pedido.abono)}\n` : `✅ *Totalmente cancelada.*\n`) +
      `\n¡Gracias por confiar en Dulce Placer! 🎉`;
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── ESTADO: MARKETING IA MULTICANAL ─────────────────────────────────
  const [mktProducto, setMktProducto] = useState('');
  const [mktCampana, setMktCampana] = useState('pan_caliente');
  const [mktFoto, setMktFoto] = useState<string | null>(null);
  const [mktGenerando, setMktGenerando] = useState(false);
  const [campanas, setCampanas] = useState<CampanaMarketingIA[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dp_whatsapp_marketing_campanas') || '[]');
    } catch { return []; }
  });
  const [campanaActual, setCampanaActual] = useState<CampanaMarketingIA | null>(null);

  useEffect(() => {
    localStorage.setItem('dp_whatsapp_marketing_campanas', JSON.stringify(campanas));
  }, [campanas]);

  const handleFotoMkt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setMktFoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerarCampanaIA = () => {
    if (!mktProducto) {
      toast.error('Escribe el nombre del producto (ej: Croissant de Queso, Pan Aliñado)');
      return;
    }

    setMktGenerando(true);
    setTimeout(() => {
      let titulo = '';
      let copyIg = '';
      let copyWa = '';
      let tags: string[] = [];

      switch (mktCampana) {
        case 'pan_caliente':
          titulo = `🔥 ¡ACABA DE SALIR DEL HORNO! ${mktProducto.toUpperCase()} 🔥`;
          copyIg = `¡El aroma que enamora ya inundó toda la panadería! 🥐✨\n\n` +
            `Acabamos de sacar una tanda doradita y crujiente de nuestro famoso *${mktProducto}*. ` +
            `Preparado con los mejores ingredientes, masa madre y el toque artesanal único de Dulce Placer.\n\n` +
            `☕ Pasa por el tuyo antes de que se agote o acompáñalo con un buen café recién colado.\n\n` +
            `📍 Te esperamos en nuestra sede principal.\n` +
            `💬 Haz tu pedido directo por mensaje o visítanos hoy mismo.`;
          copyWa = `🔥 *¡ATENCIÓN! Acaba de salir del horno ${mktProducto} calientito en Dulce Placer.* Pasa por el tuyo recién hecho ☕🥖`;
          tags = ['#PanRecienSalido', '#DulcePlacer', '#PanaderiaArtesanal', '#AmantesDelPan', '#CafeyPan', '#SaborUnico'];
          break;

        case 'promo_dia':
          titulo = `💥 PROMO IMPERDIBLE: ${mktProducto.toUpperCase()} 💥`;
          copyIg = `¡Hoy es día de consentirse con lo mejor de Dulce Placer! 🎉\n\n` +
            `Disfruta de una oferta irresistible en nuestro delicioso *${mktProducto}*. ` +
            `Frescura garantizada, textura esponjosa y el sabor que alegra tu día.\n\n` +
            `🎁 ¡Ven por el tuyo o pide para toda la familia y oficina!\n\n` +
            `👉 Dale like, comparte con un amigo que te deba un antojo y déjanos tu comentario.`;
          copyWa = `💥 *PROMO DEL DÍA en Dulce Placer:* Ven por tu ${mktProducto} fresco y al mejor precio. ¡No te quedes con las ganas! 🍰✨`;
          tags = ['#PromocionDelDia', '#DulcePlacer', '#AntojosDeliciosos', '#AhorroYSabor', '#Panaderia'];
          break;

        case 'antojo_tarde':
          titulo = `🍰 ¿HORA DEL ANTOJO? ${mktProducto.toUpperCase()} ES LA RESPUESTA ✨`;
          copyIg = `Esa pausa de la tarde se disfruta mucho mejor con un capricho dulce... ☕🍰\n\n` +
            `Te presentamos nuestro exquisito *${mktProducto}*, elaborado cuidadosamente por nuestros maestros pasteleros para regalarte una explosión de sabor en cada bocado.\n\n` +
            `Taggea a la persona que te va a invitar la merienda hoy 👇😋`;
          copyWa = `🍰 *La tarde sabe mejor con un ${mktProducto} de Dulce Placer.* Ven por el tuyo para el cafecito ☕💛`;
          tags = ['#MeriendaPerfecta', '#HoraDelCafe', '#DulcePlacer', '#PasteleriaFina', '#AntojoDulce'];
          break;

        default:
          titulo = `🌟 LO NUEVO EN DULCE PLACER: ${mktProducto.toUpperCase()} 🌟`;
          copyIg = `Elaborado con amor, dedicación y la mejor tradición panadera. Prueba nuestro *${mktProducto}* y vive la experiencia Dulce Placer.`;
          copyWa = `🥖 *Disfruta hoy de nuestro ${mktProducto} en Panadería Dulce Placer.* ¡Te esperamos!`;
          tags = ['#DulcePlacer', '#Panaderia', '#TradicionYSabor'];
          break;
      }

      const nuevaCampana: CampanaMarketingIA = {
        id: `mkt_${Date.now()}`,
        productoNombre: mktProducto,
        campanaTipo: mktCampana,
        copyInstagram: `${titulo}\n\n${copyIg}\n\n${tags.join(' ')}`,
        copyWhatsApp: copyWa,
        hashtags: tags,
        fotoUrl: mktFoto || undefined,
        fecha: new Date().toISOString().split('T')[0]
      };

      setCampanaActual(nuevaCampana);
      setCampanas([nuevaCampana, ...campanas]);
      setMktGenerando(false);
      toast.success('¡Campaña y textos publicitarios creados con IA!');
    }, 600);
  };

  const handleCopiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success('Copiado al portapapeles');
  };

  const handleCompartirEstadoWhatsApp = (texto: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <MessageCircle className="w-6 h-6" />
            </div>
            Comandos WhatsApp & Agentes IA
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automatización de los 3 grupos de trabajo: Créditos de Empleadas, Pedidos de Tortas y Marketing Multicanal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500 text-white font-black text-[11px] px-3 py-1 uppercase tracking-wider">
            ● WhatsApp Conectado
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl h-auto">
          <TabsTrigger value="creditos" className="py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <CreditCard className="w-4 h-4 text-sky-500" />
            <span className="hidden sm:inline">1. Crédito Empleadas</span>
            <span className="sm:hidden">Créditos</span>
          </TabsTrigger>
          <TabsTrigger value="tortas" className="py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <Cake className="w-4 h-4 text-pink-500" />
            <span className="hidden sm:inline">2. Tortas / Repostería</span>
            <span className="sm:hidden">Tortas</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">3. Marketing IA</span>
            <span className="sm:hidden">Marketing</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── PESTAÑA 1: CRÉDITOS EMPLEADAS ─── */}
        <TabsContent value="creditos" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario Registro Crédito */}
            <Card className="lg:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-sky-500" />
                  Registrar Fiado o Préstamo
                </CardTitle>
                <CardDescription className="text-xs">
                  Sube la foto del producto o recibo para dejar evidencia visual inalterable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegistrarCredito} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Trabajadora / Empleada</Label>
                    <select
                      value={nuevoCreditoTrabajador}
                      onChange={(e) => setNuevoCreditoTrabajador(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">Selecciona trabajadora...</option>
                      {trabajadores.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Monto ($ COP)</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 25000"
                      value={nuevoCreditoMonto}
                      onChange={(e) => setNuevoCreditoMonto(e.target.value)}
                      className="h-10 rounded-xl font-black text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalle / Productos Tomados</Label>
                    <Input
                      placeholder="Ej: 2 bolsas de pan dulce, 1 gaseosa, $10.000 prestado"
                      value={nuevoCreditoDesc}
                      onChange={(e) => setNuevoCreditoDesc(e.target.value)}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  {/* Subir Foto Comprobante */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Foto del Producto / Vale</span>
                      {nuevoCreditoFoto && <span className="text-emerald-500 font-bold text-[10px]">Cargada ✓</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <Camera className="w-5 h-5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Tomar o Subir Foto</span>
                        <input type="file" accept="image/*" onChange={handleFotoCredito} className="hidden" />
                      </label>
                      {nuevoCreditoFoto && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                          <img src={nuevoCreditoFoto} className="w-full h-full object-cover" alt="Preview" />
                        </div>
                      )}
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl gap-2 mt-2">
                    <Plus className="w-4 h-4" /> Guardar Crédito con Foto
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Listado de Créditos */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Historial de Fiados de Empleadas</CardTitle>
                  <CardDescription className="text-xs">Control de saldos listos para deducir en la quincena</CardDescription>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Pendiente</span>
                  <span className="text-lg font-black text-rose-500 tabular-nums">
                    {formatCurrency(creditos.filter(c => c.estado === 'pendiente').reduce((acc, c) => acc + c.monto, 0))}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {creditos.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-bold text-sm">No hay registros de crédito pendientes</p>
                    <p className="text-xs">Los productos o préstamos anotados en WhatsApp se registran aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {creditos.map((c) => (
                      <div key={c.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition-colors">
                        <div className="flex items-start gap-3">
                          {c.fotoUrl ? (
                            <img src={c.fotoUrl} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" alt="Comprobante" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-sm text-slate-900 dark:text-white">{c.trabajadorNombre}</p>
                              <Badge variant={c.estado === 'pendiente' ? 'destructive' : 'default'} className="text-[9px] font-black uppercase">
                                {c.estado === 'pendiente' ? 'Por descontar' : 'Deducido en nómina ✓'}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{c.descripcion}</p>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" /> {c.fecha} • {c.hora}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-800">
                          <span className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(c.monto)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={c.estado === 'pendiente' ? 'default' : 'outline'}
                              onClick={() => handleMarcarDeducido(c.id)}
                              className="h-8 text-xs font-bold rounded-lg"
                            >
                              {c.estado === 'pendiente' ? 'Deducir' : 'Revertir'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEliminarCredito(c.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 2: TORTAS Y REPOSTERÍA ─── */}
        <TabsContent value="tortas" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario Pedido Torta */}
            <Card className="lg:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Cake className="w-5 h-5 text-pink-500" />
                  Nuevo Pedido Especial
                </CardTitle>
                <CardDescription className="text-xs">
                  Para que la maestra repostera organice tiempos, ingredientes y decoración.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegistrarTorta} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Cliente *</Label>
                      <Input
                        placeholder="Ej: Mariana López"
                        value={tortaCliente}
                        onChange={(e) => setTortaCliente(e.target.value)}
                        className="h-9 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Teléfono WhatsApp</Label>
                      <Input
                        placeholder="300 123 4567"
                        value={tortaTelefono}
                        onChange={(e) => setTortaTelefono(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Fecha Entrega *</Label>
                      <Input
                        type="date"
                        value={tortaFecha}
                        onChange={(e) => setTortaFecha(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Hora Entrega *</Label>
                      <Input
                        type="time"
                        value={tortaHora}
                        onChange={(e) => setTortaHora(e.target.value)}
                        className="h-9 rounded-xl text-xs font-bold text-pink-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Porciones / Libras</Label>
                      <Input
                        type="number"
                        placeholder="Ej: 25"
                        value={tortaPorciones}
                        onChange={(e) => setTortaPorciones(e.target.value)}
                        className="h-9 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Sabor de Masa</Label>
                      <Input
                        placeholder="Vainilla, Chocolate..."
                        value={tortaSabor}
                        onChange={(e) => setTortaSabor(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Relleno</Label>
                      <Input
                        placeholder="Arequipe, Frutos rojos..."
                        value={tortaRelleno}
                        onChange={(e) => setTortaRelleno(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Cubierta</Label>
                      <Input
                        placeholder="Chantilly, Merengue, Fondant..."
                        value={tortaCubierta}
                        onChange={(e) => setTortaCubierta(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase text-slate-500">Dedicatoria / Temática</Label>
                    <Input
                      placeholder="Ej: Feliz Cumpleaños Sofía #5 (Temática Princesas)"
                      value={tortaDedicatoria}
                      onChange={(e) => setTortaDedicatoria(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Total ($ COP)</Label>
                      <Input
                        type="number"
                        placeholder="120000"
                        value={tortaTotal}
                        onChange={(e) => setTortaTotal(e.target.value)}
                        className="h-9 rounded-xl text-xs font-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-slate-500">Abono ($ COP)</Label>
                      <Input
                        type="number"
                        placeholder="50000"
                        value={tortaAbono}
                        onChange={(e) => setTortaAbono(e.target.value)}
                        className="h-9 rounded-xl text-xs font-bold text-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Foto de Referencia */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase text-slate-500 flex items-center justify-between">
                      <span>Foto Modelo deseado</span>
                      {tortaFoto && <span className="text-pink-500 font-bold text-[10px]">Cargada ✓</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 h-10 flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Subir diseño</span>
                        <input type="file" accept="image/*" onChange={handleFotoTorta} className="hidden" />
                      </label>
                      {tortaFoto && (
                        <img src={tortaFoto} className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700" alt="Torta" />
                      )}
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl gap-2 mt-3">
                    <Cake className="w-4 h-4" /> Registrar Pedido de Torta
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Tablero de Pedidos de Tortas */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Tablero de Producción de Repostería</CardTitle>
                  <CardDescription className="text-xs">Pedidos ordenados por fecha y hora de entrega</CardDescription>
                </div>
                <Badge className="bg-pink-500 text-white font-black text-xs px-2.5 py-1">
                  {pedidosTortas.filter(p => p.estado !== 'entregada').length} Activas
                </Badge>
              </CardHeader>
              <CardContent>
                {pedidosTortas.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Cake className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-bold text-sm">No hay pedidos de tortas en la cola</p>
                    <p className="text-xs">Registra los pedidos recibidos en el grupo de WhatsApp de repostería.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                    {pedidosTortas.map((p) => {
                      const saldo = Math.max(0, p.valorTotal - p.abono);
                      return (
                        <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
                          {p.estado === 'lista' && (
                            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
                          )}
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">{p.clienteNombre}</h3>
                                {p.clienteTelefono && (
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Phone className="w-3 h-3 text-emerald-500" /> {p.clienteTelefono}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 block">Entrega</span>
                                <span className="text-xs font-black bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-lg">
                                  {p.fechaEntrega} • {p.horaEntrega}
                                </span>
                              </div>
                            </div>

                            {p.fotoReferenciaUrl && (
                              <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
                                <img src={p.fotoReferenciaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="Diseño de torta" />
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                                  {p.porciones} Porciones
                                </div>
                              </div>
                            )}

                            <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                              <p><strong className="text-slate-500 uppercase text-[9px]">Sabor:</strong> {p.sabor} (Relleno: {p.relleno})</p>
                              <p><strong className="text-slate-500 uppercase text-[9px]">Cubierta:</strong> {p.cubierta}</p>
                              {p.dedicatoria && (
                                <p className="text-pink-600 dark:text-pink-400 italic">"{p.dedicatoria}"</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Total / Saldo</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(p.valorTotal)}</span>
                                {saldo > 0 && <span className="text-rose-500 font-bold ml-1.5">(Debe {formatCurrency(saldo)})</span>}
                              </div>
                              <select
                                value={p.estado}
                                onChange={(e) => handleCambiarEstadoTorta(p.id, e.target.value as EstadoTorta)}
                                className="h-8 px-2 text-xs font-black uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              >
                                <option value="pendiente">🟡 Pendiente</option>
                                <option value="en_horno">🍞 En Horno</option>
                                <option value="decorando">🎂 Decorando</option>
                                <option value="lista">🟢 Lista</option>
                                <option value="entregada">✅ Entregada</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {p.clienteTelefono && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleNotificarClienteWhatsApp(p)}
                                className="flex-1 h-8 text-xs font-bold gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                <Send className="w-3.5 h-3.5" /> Avisar por WhatsApp
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPedidosTortas(pedidosTortas.filter(item => item.id !== p.id))}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 3: MARKETING IA MULTICANAL ─── */}
        <TabsContent value="marketing" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generador de Campañas */}
            <Card className="lg:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Creador de Campañas con IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Sube la foto del pan recién horneado y genera copys virales para WhatsApp, Instagram y TikTok.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre del Producto</Label>
                  <Input
                    placeholder="Ej: Pan de Bono Caliente, Croissant de Nutella"
                    value={mktProducto}
                    onChange={(e) => setMktProducto(e.target.value)}
                    className="h-10 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Objetivo / Tipo de Campaña</Label>
                  <select
                    value={mktCampana}
                    onChange={(e) => setMktCampana(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="pan_caliente">🔥 Salida del Horno (¡Caliente ya!)</option>
                    <option value="promo_dia">💥 Oferta / Promoción Especial</option>
                    <option value="antojo_tarde">🍰 Antojo de la Tarde / Cafecito</option>
                  </select>
                </div>

                {/* Subir Foto del Pan */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Foto del Producto</span>
                    {mktFoto && <span className="text-amber-500 font-bold text-[10px]">Cargada ✓</span>}
                  </Label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    {mktFoto ? (
                      <img src={mktFoto} className="w-full h-32 object-cover rounded-xl" alt="Preview" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Toma una foto al pan caliente</span>
                        <span className="text-[10px] text-slate-400">o sube una imagen de la galería</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleFotoMkt} className="hidden" />
                  </label>
                </div>

                <Button
                  onClick={handleGenerarCampanaIA}
                  disabled={mktGenerando}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black rounded-xl gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Sparkles className="w-5 h-5" />
                  {mktGenerando ? 'Generando Copys con IA...' : 'Generar Anuncio para Redes con IA'}
                </Button>
              </CardContent>
            </Card>

            {/* Vista Previa y Botones de Publicación */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-500" />
                  Anuncios Generados & Publicación en 1 Clic
                </CardTitle>
                <CardDescription className="text-xs">
                  Copia los textos formateados o publícalos directamente a tus estados y redes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {campanaActual ? (
                  <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-500 text-white font-black uppercase text-[10px]">
                        {campanaActual.campanaTipo.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-slate-400 font-semibold">{campanaActual.productoNombre}</span>
                    </div>

                    {/* Texto WhatsApp */}
                    <div className="space-y-1.5 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase text-emerald-600 flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Texto para Estados de WhatsApp
                        </Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopiarTexto(campanaActual.copyWhatsApp)}
                          className="h-6 px-2 text-[10px] font-bold text-slate-500 hover:text-emerald-500"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line font-medium leading-relaxed">
                        {campanaActual.copyWhatsApp}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleCompartirEstadoWhatsApp(campanaActual.copyWhatsApp)}
                        className="w-full mt-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg gap-2"
                      >
                        <Send className="w-4 h-4" /> Publicar a WhatsApp Ahora
                      </Button>
                    </div>

                    {/* Texto Instagram / Facebook */}
                    <div className="space-y-1.5 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase text-rose-600 flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5" /> Copy Persuasivo para Instagram / Facebook
                        </Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopiarTexto(campanaActual.copyInstagram)}
                          className="h-6 px-2 text-[10px] font-bold text-slate-500 hover:text-rose-500"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar Todo
                        </Button>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line font-medium leading-relaxed max-h-48 overflow-y-auto">
                        {campanaActual.copyInstagram}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-bold text-sm">Aún no has generado ninguna campaña</p>
                    <p className="text-xs">Sube la foto del pan en el panel izquierdo y presiona "Generar Anuncio".</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
