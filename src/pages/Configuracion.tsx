import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, Activity, Globe, DollarSign, Eye, EyeOff, KeyRound, CloudDownload, Shield, Download, Upload, Clock } from 'lucide-react';
import { db } from '@/lib/database';
import {
  guardarSnapshot, leerTodos, eliminarSnapshot,
  exportarSnapshotJSON, importarSnapshotJSON,
  formatearFechaSnapshot, type ConfigSnapshot,
} from '@/lib/config-backup';
import { exportToExcel } from '@/lib/export-utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Configuracion, MonedaCode } from '@/types';

interface ConfiguracionProps {
  configuracion: Configuracion;
  onUpdateConfiguracion: (updates: Partial<Configuracion>) => void;
  onSyncWithCloud: () => Promise<void>;
  onClearAllData: () => void;
}

function Configuracion(props: ConfiguracionProps) {
  const {
    configuracion,
    onUpdateConfiguracion,
    onSyncWithCloud,
    onClearAllData,
  } = props;
  const [nombreNegocio, setNombreNegocio] = useState('Mi Negocio');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<MonedaCode>('COP');
  const [margen, setMargen] = useState('30');
  const [impuesto, setImpuesto] = useState('0');
  const [autoAjuste, setAutoAjuste] = useState(true);
  const [notificaciones, setNotificaciones] = useState(true);
  const [presupuesto, setPresupuesto] = useState('0');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const migracionInputRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar snapshots al abrir
  useEffect(() => { setSnapshots(leerTodos()); }, [showSnapshots]);
  const [showRolePass, setShowRolePass] = useState(false);
  const [passGerente, setPassGerente] = useState('');
  const [passComprador, setPassComprador] = useState('');
  const [passVendedor, setPassVendedor] = useState('');
  const [passPanadero, setPassPanadero] = useState('');
  const [passAuxiliar, setPassAuxiliar] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [aiMode, setAiMode] = useState<'local' | 'hybrid' | 'off'>('hybrid');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('pricecontrol_role_passwords') || '{}');
    setPassGerente(saved.GERENTE || '');
    setPassComprador(saved.COMPRADOR || '');
    setPassVendedor(saved.VENDEDOR || '');
    setPassPanadero(saved.PANADERO || '');
    setPassAuxiliar(saved.AUXILIAR || '');
  }, []);

  const handleGuardarPassRoles = () => {
    if (!passGerente || !passComprador || !passVendedor || !passPanadero || !passAuxiliar) {
      toast.error('Completa todas las contraseñas antes de guardar.');
      return;
    }
    const passwords = {
      GERENTE: passGerente,
      COMPRADOR: passComprador,
      VENDEDOR: passVendedor,
      PANADERO: passPanadero,
      AUXILIAR: passAuxiliar,
    };
    localStorage.setItem('pricecontrol_role_passwords', JSON.stringify(passwords));
    toast.success('Contraseñas por rol guardadas ☁️');
  };

  useEffect(() => {
    if (configuracion) {
      setNombreNegocio(configuracion.nombreNegocio || 'Mi Negocio');
      setMonedaSeleccionada(configuracion.moneda || 'COP');
      setMargen((configuracion.margenUtilidadDefault || 30).toString());
      setImpuesto((configuracion.impuestoPorcentaje || 0).toString());
      setAutoAjuste(configuracion.ajusteAutomatico !== false);
      setNotificaciones(configuracion.notificarSubidas !== false);
      setPresupuesto((configuracion.presupuestoMensual || 0).toString());
      setPublicUrl(configuracion.publicUrl || '');
      setAiMode(configuracion.aiMode || 'hybrid');
    }
  }, [configuracion]);

  const handleGuardar = async () => {
    // Cyber Fortress: Validation Layer
    if (!nombreNegocio.trim()) {
      toast.error('El nombre del negocio es requerido');
      return;
    }
    const margenNum = parseFloat(margen);
    if (isNaN(margenNum) || margenNum < 0 || margenNum > 100) {
      toast.error('El margen debe ser un porcentaje válido (0-100)');
      return;
    }

    try {
      const nuevaConfig = {
        nombreNegocio,
        moneda: monedaSeleccionada,
        margenUtilidadDefault: margenNum,
        impuestoPorcentaje: parseFloat(impuesto) || 0,
        ajusteAutomatico: autoAjuste,
        notificarSubidas: notificaciones,
        presupuestoMensual: parseFloat(presupuesto) || 0,
        publicUrl: publicUrl.trim(),
        aiMode: aiMode,
      };
      await onUpdateConfiguracion(nuevaConfig);

      // NIVEL 2: Snapshot automático completo al guardar config
      const [productos, proveedores, precios] = await Promise.all([
        db.getAllProductos().catch(() => []),
        db.getAllProveedores().catch(() => []),
        db.getAllPrecios().catch(() => []),
      ]);
      guardarSnapshot(`Config guardada — ${nombreNegocio}`, {
        configuracion: nuevaConfig,
        productos,
        proveedores,
        precios,
      }, 'auto');

      toast.success('✨ Configuración guardada y respaldo automático creado');
    } catch (error) {
      toast.error('Error de seguridad al guardar: ' + (error as Error).message);
    }
  };

  const handleLimpiarDatos = () => {
    onClearAllData();
    setShowConfirmClear(false);
    toast.success('♻️ Sistema restablecido correctamente');
  };

  // ── MIGRACIÓN COMPLETA DE BASE DE DATOS ──
  const STORES_MIGRACION = [
    'productos','proveedores','precios','recepciones','prepedidos',
    'inventario','movimientos','ventas','caja','gastos','recetas',
    'produccion','alertas','ahorros','facturas_escaneadas','configuracion',
  ];

  const handleExportarDB = async () => {
    setMigrando(true);
    try {
      const idb: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('PriceControlDB');
        r.onsuccess = () => res(r.result);
        r.onerror   = () => rej(r.error);
      });
      const disponibles = [...idb.objectStoreNames];
      const data: Record<string, any[]> = {};
      for (const store of STORES_MIGRACION) {
        if (!disponibles.includes(store)) continue;
        data[store] = await new Promise((res, rej) => {
          const tx = idb.transaction(store, 'readonly');
          const r  = tx.objectStore(store).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror   = () => rej(r.error);
        });
      }
      const total = Object.values(data).reduce((s, a) => s + a.length, 0);
      const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = `dulce-placer-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Base de datos exportada — ${total} registros`);
    } catch (e) {
      toast.error('Error al exportar la base de datos');
      console.error(e);
    } finally {
      setMigrando(false);
    }
  };

  const handleImportarDB = async (file: File) => {
    setMigrando(true);
    try {
      const data: Record<string, any[]> = JSON.parse(await file.text());
      const idb: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('PriceControlDB');
        r.onsuccess = () => res(r.result);
        r.onerror   = () => rej(r.error);
      });
      const disponibles = [...idb.objectStoreNames];
      let total = 0;
      for (const [store, registros] of Object.entries(data)) {
        if (!disponibles.includes(store) || !Array.isArray(registros) || registros.length === 0) continue;
        await new Promise<void>((res, rej) => {
          const tx = idb.transaction(store, 'readwrite');
          const os = tx.objectStore(store);
          registros.forEach(r => os.put(r));
          tx.oncomplete = () => res();
          tx.onerror    = () => rej(tx.error);
        });
        total += registros.length;
      }
      toast.success(`Datos importados — ${total} registros. Recargando...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error('Error al importar. Verifica que el archivo sea válido.');
      console.error(e);
    } finally {
      setMigrando(false);
    }
  };

  const handleManualPurge = async () => {
    const id = toast.loading('Ejecutando limpieza nuclear de caché...');
    
    try {
      // 1. Eliminar todos los cachés registrados
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 2. Desregistrar todos los Service Workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for(let reg of regs) {
          await reg.unregister();
        }
      }

      // 3. Forzar recarga desde red
      toast.success('✨ Caché purgada. Reiniciando...', { id });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      toast.error('Error al purgar caché: ' + (e as Error).message, { id });
    }
  };


  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-ag-fade-in pb-12">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            Configuración del Sistema
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Personaliza la inteligencia y los parámetros financieros de tu agente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleManualPurge} className="gap-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/10 transition-all hover:scale-105">
            <RefreshCw className="w-4 h-4" />
            Limpiar Caché (NUEVO)
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2 border-primary/20 hover:bg-primary/5 transition-all hover:scale-105">
            <RefreshCw className="w-4 h-4" />
            Reiniciar App
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Identidad y Moneda */}
        <div className="space-y-8 lg:col-span-2">

          {/* Identidad del Negocio */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Identidad Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="group">
                  <Label htmlFor="nombre" className="text-primary font-semibold">Nombre de la Organización</Label>
                  <Input
                    id="nombre"
                    value={nombreNegocio}
                    onChange={(e) => setNombreNegocio(e.target.value)}
                    placeholder="Ej. Comercializadora Global"
                    className="mt-2 text-lg py-6 border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Visible en reportes y encabezados.
                  </p>
                </div>

                <div className="group space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="publicUrl" className="text-secondary font-bold flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" /> URL Pública (Acceso Global)
                    </Label>
                    <Badge variant="outline" className="text-[8px] bg-indigo-500/10 border-indigo-500/20 text-indigo-500">GRATIS EN VERCEL</Badge>
                  </div>
                  <div className="relative group/input">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors" />
                    <Input
                      id="publicUrl"
                      value={publicUrl}
                      onChange={(e) => setPublicUrl(e.target.value)}
                      placeholder="https://tu-panaderia.vercel.app"
                      className="pl-10 h-12 border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 transition-all font-mono text-sm rounded-xl shadow-inner"
                    />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                      💡 <strong>¿Cómo obtenerla?</strong> Si ya desplegaste en Vercel, pega aquí el link (ej: <code>app-six.vercel.app</code>). 
                      Este es el enlace que se les enviará por WhatsApp a tus trabajadores para que entren desde su casa o el bus.
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-[9px] font-black uppercase text-slate-400">Acceso WiFi Local:</span>
                      <code className="text-[9px] font-mono bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded">npm run host</code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sincronización en la Nube */}
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-500" />
                  Sincronización Cloud
                </CardTitle>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Nexus-Vault Activo</span>
                </div>
              </div>
              <CardDescription>Respalda tus datos locales en la base de datos central de Supabase e IndexedDB</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <span className="text-sm font-semibold text-indigo-400 block">Base de Datos Híbrida</span>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Sincronización bidireccional local-nube con redundancia en disco JSON.
                    Status: <span className="text-emerald-500 font-bold">Protegido (Automático)</span>
                  </p>
                </div>

                <Button
                  onClick={async () => {
                    const id = toast.loading('Sincronizando con Supabase...');
                    try {
                      if (onSyncWithCloud) {
                        await onSyncWithCloud();
                        toast.success('✨ Datos sincronizados correctamente', { id });
                      } else {
                        toast.error('Función de sincronización no disponible', { id });
                      }
                    } catch (e) {
                      toast.error('Error al sincronizar: ' + (e as Error).message, { id });
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 transition-all hover:scale-105 shadow-lg shadow-indigo-600/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar Ahora
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Contraseñas por Rol */}
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-pink-500" />
                Contraseñas por Rol
              </CardTitle>
              <CardDescription>Define la contraseña que usará cada tipo de usuario para entrar al sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Mostrar contraseñas</span>
                <button type="button" onClick={() => setShowRolePass(p => !p)} className="text-slate-400 hover:text-slate-600">
                  {showRolePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {[
                { label: '👔 Gerente', value: passGerente, setter: setPassGerente },
                { label: '🍞 Panadero', value: passPanadero, setter: setPassPanadero },
                { label: '🛒 Comprador', value: passComprador, setter: setPassComprador },
                { label: '💰 Vendedor/a', value: passVendedor, setter: setPassVendedor },
                { label: '🔧 Auxiliar', value: passAuxiliar, setter: setPassAuxiliar },
              ].map(({ label, value, setter }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-70">{label}</Label>
                  <Input
                    type={showRolePass ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="Contraseña para este rol"
                    className="h-10 rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                </div>
              ))}
              <Button onClick={handleGuardarPassRoles} className="w-full h-10 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold mt-2">
                <Save className="w-4 h-4 mr-2" />
                Guardar Contraseñas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Parámetros y Peligro */}
        <div className="space-y-8">

          {/* Parámetros Operativos */}
          <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Activity className="w-5 h-5" />
                Reglas y Presupuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground font-bold">Márgenes</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="margen" className="text-sm">Utilidad Default (%)</Label>
                      <Input
                        id="margen"
                        type="number"
                        value={margen}
                        onChange={(e) => setMargen(e.target.value)}
                        className="border-primary/10 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="impuesto" className="text-sm">Impuesto (%)</Label>
                      <Input
                        id="impuesto"
                        type="number"
                        value={impuesto}
                        onChange={(e) => setImpuesto(e.target.value)}
                        className="border-primary/10 focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presupuesto" className="text-sm font-bold text-indigo-600">Presupuesto Mensual de Gastos</Label>
                    <div className="relative group">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                      <Input
                        id="presupuesto"
                        type="number"
                        value={presupuesto}
                        onChange={(e) => setPresupuesto(e.target.value)}
                        placeholder="Ej. 5000"
                        className="pl-10 border-indigo-200 focus:border-indigo-500 bg-indigo-50/30"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">El sistema te alertará si los gastos del mes superan este monto.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground font-bold">Automatización</Label>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto-Precios</Label>
                      <p className="text-xs text-muted-foreground">Recalcular venta al cambiar costo</p>
                    </div>
                    <Switch checked={autoAjuste} onCheckedChange={setAutoAjuste} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-base">Alertas Smart</Label>
                      <p className="text-xs text-muted-foreground">Notificar cambios de mercado</p>
                    </div>
                    <Switch checked={notificaciones} onCheckedChange={setNotificaciones} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* INTERRUPTOR DE EMERGENCIA IA */}
          <Card className={cn(
            "border-2 transition-all duration-500 overflow-hidden shadow-2xl",
            aiMode === 'off' ? "border-red-600 bg-red-950/20" : 
            aiMode === 'local' ? "border-emerald-500 bg-emerald-950/10" : "border-primary/20"
          )}>
            <CardHeader className={cn(
              "border-b transition-colors",
              aiMode === 'off' ? "bg-red-600/20" : "bg-primary/5"
            )}>
              <CardTitle className={cn(
                "flex items-center gap-2",
                aiMode === 'off' ? "text-red-500" : "text-primary"
              )}>
                <Activity className={cn("w-5 h-5", aiMode === 'off' && "animate-pulse")} />
                Estado de Inteligencia
              </CardTitle>
              <CardDescription className={aiMode === 'off' ? "text-red-400" : ""}>
                Control maestro de soberanía y emergencia
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setAiMode('hybrid')}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                    aiMode === 'hybrid' 
                      ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                      : "bg-background/40 border-border/50 hover:border-primary/40"
                  )}
                >
                  <div className="text-left">
                    <span className="text-sm font-black block">MODO HÍBRIDO</span>
                    <span className="text-[10px] opacity-70">Llama (Local) + Claude (Nube)</span>
                  </div>
                  <div className={cn("w-3 h-3 rounded-full", aiMode === 'hybrid' ? "bg-primary animate-pulse" : "bg-slate-500")} />
                </button>

                <button
                  type="button"
                  onClick={() => setAiMode('local')}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                    aiMode === 'local' 
                      ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                      : "bg-background/40 border-border/50 hover:border-emerald-500/40"
                  )}
                >
                  <div className="text-left">
                    <span className="text-sm font-black block text-emerald-500">SOBERANÍA TOTAL</span>
                    <span className="text-[10px] opacity-70">100% Local (Sólo Ollama)</span>
                  </div>
                  <div className={cn("w-3 h-3 rounded-full", aiMode === 'local' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-slate-500")} />
                </button>

                <button
                  type="button"
                  onClick={() => setAiMode('off')}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                    aiMode === 'off' 
                      ? "bg-red-600/20 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]" 
                      : "bg-background/40 border-border/50 hover:border-red-600/40"
                  )}
                >
                  <div className="text-left">
                    <span className="text-sm font-black block text-red-500">KILL SWITCH</span>
                    <span className="text-[10px] opacity-70 font-bold uppercase">Apagado de Emergencia</span>
                  </div>
                  <div className={cn("w-3 h-3 rounded-full", aiMode === 'off' ? "bg-red-600 animate-ping" : "bg-slate-500")} />
                </button>
              </div>
              
              {aiMode === 'off' && (
                <div className="p-2 bg-red-600/10 border border-red-600/30 rounded-lg animate-ag-shake">
                  <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-tighter">
                    ⚠️ TODA LA INTELIGENCIA ESTÁ DESACTIVADA
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botón Guardar Flotante */}
          <Button
            onClick={handleGuardar}
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30 text-lg h-14 transition-all hover:scale-[1.02]"
          >
            <Save className="w-5 h-5 mr-2" />
            Aplicar Cambios
          </Button>

          {/* ── NIVEL 2 & 3: Snapshots de Respaldo ─────────────────────── */}
          <div className="pt-4 border-t border-border/40 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Respaldos de Configuración</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{snapshots.length} guardados</span>
            </div>

            {/* Botones de acción de snapshots */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={async () => {
                  const [productos, proveedores, precios] = await Promise.all([
                    db.getAllProductos().catch(() => []),
                    db.getAllProveedores().catch(() => []),
                    db.getAllPrecios().catch(() => []),
                  ]);
                  guardarSnapshot(`Respaldo manual — ${new Date().toLocaleDateString('es-CO')}`, {
                    configuracion: configuracion as any,
                    productos,
                    proveedores,
                    precios,
                  }, 'manual');
                  setSnapshots(leerTodos());
                  toast.success(`Respaldo creado: ${productos.length} productos, ${proveedores.length} proveedores`);
                }}
              >
                <Save className="w-3 h-3 mr-1" /> Guardar respaldo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setShowSnapshots(s => !s)}
              >
                <Clock className="w-3 h-3 mr-1" />
                {showSnapshots ? 'Ocultar' : 'Ver historial'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2"
                title="Importar respaldo desde archivo JSON"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const data = await importarSnapshotJSON(file);
                    if (data.configuracion) await onUpdateConfiguracion(data.configuracion as any);
                    if (data.productos?.length) for (const p of data.productos) await (db as any).local.updateProducto(p).catch(() => (db as any).local.addProducto(p).catch(() => {}));
                    if (data.proveedores?.length) for (const p of data.proveedores) await db.addProveedor(p).catch(() => {});
                    if (data.precios?.length) for (const p of data.precios) await db.addPrecio(p).catch(() => {});
                    toast.success(`Importado: ${data.productos?.length ?? 0} productos, ${data.proveedores?.length ?? 0} proveedores, ${data.precios?.length ?? 0} precios`);
                    setTimeout(() => window.location.reload(), 1500);
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {/* Lista de snapshots */}
            {showSnapshots && snapshots.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2 bg-slate-50 dark:bg-slate-900">
                {snapshots.map(snap => (
                  <div key={snap.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${snap.tipo === 'manual' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{snap.label}</p>
                      <p className="text-muted-foreground">{formatearFechaSnapshot(snap.fecha)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                      title="Restaurar este respaldo"
                      onClick={async () => {
                        if (!confirm(`¿Restaurar respaldo "${snap.label}"?\n\nEsto restaurará: ${snap.data.productos?.length ?? 0} productos, ${snap.data.proveedores?.length ?? 0} proveedores, ${snap.data.precios?.length ?? 0} precios.`)) return;
                        if (snap.data.configuracion) await onUpdateConfiguracion(snap.data.configuracion as any);
                        if (snap.data.productos?.length) for (const p of snap.data.productos) await (db as any).local.updateProducto(p).catch(() => (db as any).local.addProducto(p).catch(() => {}));
                        if (snap.data.proveedores?.length) for (const p of snap.data.proveedores) await db.addProveedor(p).catch(() => {});
                        if (snap.data.precios?.length) for (const p of snap.data.precios) await db.addPrecio(p).catch(() => {});
                        toast.success(`Restaurado: ${snap.data.productos?.length ?? 0} productos, ${snap.data.proveedores?.length ?? 0} proveedores`);
                        setTimeout(() => window.location.reload(), 1200);
                      }}
                    >
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-slate-400 hover:text-slate-600"
                      title="Exportar como archivo JSON"
                      onClick={() => exportarSnapshotJSON(snap)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-red-400 hover:text-red-600"
                      onClick={() => { eliminarSnapshot(snap.id); setSnapshots(leerTodos()); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {showSnapshots && snapshots.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No hay respaldos todavía. Guarda la configuración para crear el primero.
              </p>
            )}
          </div>
          {/* Exportación Maestra */}
          <div className="pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="lg"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 font-bold"
              onClick={async () => {
                const results = await Promise.all([
                   db.getAllProductos(),
                   db.getAllProveedores(),
                   db.getAllPrecios()
                ]);
                exportToExcel(results[0], 'Productos_DulcePlacer');
                exportToExcel(results[1], 'Proveedores_DulcePlacer');
                toast.success('📊 Exportación maestra completada. Revisa tus descargas.');
              }}
            >
              <Download className="w-5 h-5 mr-2" />
              Exportar Inventario a Excel
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Descarga tus productos y proveedores en formato CSV compatible con Excel
            </p>
          </div>



          {/* Zona de Peligro */}
          <div className="pt-4 border-t border-border/40">
            {!showConfirmClear ? (
              <Button
                variant="ghost"
                onClick={() => setShowConfirmClear(true)}
                className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Zona de Peligro
              </Button>
            ) : (
              <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-900/10 animate-in fade-in slide-in-from-bottom-2">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="space-y-3 w-full">
                      <div>
                        <h4 className="font-bold text-red-700 dark:text-red-400">¿Resetear Sistema?</h4>
                        <p className="text-xs text-red-600/80 mt-1">
                          Esta acción es irreversible. Se eliminará toda la base de datos local.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowConfirmClear(false)}>Cancelar</Button>
                        <Button size="sm" variant="destructive" className="flex-1" onClick={handleLimpiarDatos}>Confirmar</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>

        {/* ── MIGRACIÓN DE BASE DE DATOS ── */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Download className="w-5 h-5" />
              Migración de Base de Datos
            </CardTitle>
            <CardDescription>
              Exporta todos los datos e impórtalos en otra instancia (ej: pasar de :4173 a :5173)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExportarDB}
              disabled={migrando}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Download className="w-4 h-4" />
              {migrando ? 'Exportando...' : 'Exportar todos los datos (.json)'}
            </Button>
            <Button
              onClick={() => migracionInputRef.current?.click()}
              disabled={migrando}
              variant="outline"
              className="flex-1 border-blue-400 text-blue-700 hover:bg-blue-50 gap-2"
            >
              <Upload className="w-4 h-4" />
              {migrando ? 'Importando...' : 'Importar datos (.json)'}
            </Button>
            <input
              ref={migracionInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportarDB(f); e.target.value = ''; }}
            />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default Configuracion;
