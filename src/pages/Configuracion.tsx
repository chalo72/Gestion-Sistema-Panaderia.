import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, Activity, Globe, DollarSign, Coins, Eye, EyeOff, KeyRound, Shield, Download, Upload, Clock, Zap, CloudUpload, MessageCircle, Phone, Database } from 'lucide-react';
import { db } from '@/lib/database';
import { SupabaseDatabase } from '@/lib/supabase-db';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type Configuracion, type MonedaCode, MONEDAS } from '@/types';
import { ARROBA_KG } from '@/types';

interface ConfiguracionProps {
  configuracion: Configuracion;
  onUpdateConfiguracion: (updates: Partial<Configuracion>) => void;
  onSyncWithCloud: () => Promise<void>;
  onClearAllData: () => void;
}

// ── MIGRACIÓN COMPLETA DE BASE DE DATOS ──
// Lista completa y real de colecciones de 'dulce-placer-db'
const STORES_MIGRACION = [
  'productos','proveedores','precios','clientes','tombstones','configuracion',
  'ventas','inventario','movimientos','recepciones','historial','sesiones_caja',
  'backups','pre_pedidos','prepedidos','alertas','gastos','mesas','ahorros',
  'creditos_clientes','creditos_trabajadores','trabajadores','pedidos_activos',
  'recetas','formulaciones','modelosPan','produccion','agente_misiones',
  'agente_hallazgos','agente_config','bitacora_ia','asistencia','nominas',
  'auditorias_produccion','planes_diarios','workflows','camaras_cctv',
  'facturas_escaneadas','caja',
];

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
  const [latasPorHorno, setLatasPorHorno] = useState('4');
  const [pesoArrobaKg, setPesoArrobaKg] = useState('12.5');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const migracionInputRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recuento en vivo de la base de datos local
  const [conteoStores, setConteoStores] = useState<{
    formulaciones: number;
    modelosPan: number;
    recetas: number;
    productos: number;
    total: number;
    cargando: boolean;
  }>({ formulaciones: 0, modelosPan: 0, recetas: 0, productos: 0, total: 0, cargando: true });

  const cargarConteoStores = useCallback(async () => {
    try {
      const idb: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('dulce-placer-db');
        r.onsuccess = () => res(r.result);
        r.onerror   = () => rej(r.error);
      });
      const disponibles = [...idb.objectStoreNames];
      const contar = async (store: string): Promise<number> => {
        if (!disponibles.includes(store)) return 0;
        return new Promise((res) => {
          try {
            const tx = idb.transaction(store, 'readonly');
            const req = tx.objectStore(store).count();
            req.onsuccess = () => res(req.result || 0);
            req.onerror = () => res(0);
          } catch {
            res(0);
          }
        });
      };
      const [formulaciones, modelosPan, recetas, productos] = await Promise.all([
        contar('formulaciones'),
        contar('modelosPan'),
        contar('recetas'),
        contar('productos'),
      ]);
      let total = 0;
      for (const s of STORES_MIGRACION) {
        total += await contar(s);
      }
      setConteoStores({ formulaciones, modelosPan, recetas, productos, total, cargando: false });
    } catch {
      setConteoStores(prev => ({ ...prev, cargando: false }));
    }
  }, []);

  useEffect(() => {
    cargarConteoStores();
  }, [cargarConteoStores]);

  // Cargar snapshots al abrir
  useEffect(() => { setSnapshots(leerTodos()); }, [showSnapshots]);

  const [publicUrl, setPublicUrl] = useState('');
  const [aiMode, setAiMode] = useState<'local' | 'hybrid' | 'off'>('hybrid');
  const [telefonoNegocio, setTelefonoNegocio] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [showWaKey, setShowWaKey] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');

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
      setTelefonoNegocio(configuracion.telefonoNegocio || '');
      setWhatsappApiKey(configuracion.whatsappApiKey || '');
      setLatasPorHorno((configuracion.latasPorHorno || 4).toString());
      setPesoArrobaKg((configuracion.pesoArrobaKg || ARROBA_KG).toString());
      setN8nWebhookUrl(configuracion.n8nWebhookUrl || localStorage.getItem('N8N_WEBHOOK_URL') || '');
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
      if (n8nWebhookUrl) {
        localStorage.setItem('N8N_WEBHOOK_URL', n8nWebhookUrl.trim());
      } else {
        localStorage.removeItem('N8N_WEBHOOK_URL');
      }

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
        latasPorHorno: parseInt(latasPorHorno) || 4,
        pesoArrobaKg: parseFloat(pesoArrobaKg) || ARROBA_KG,
        telefonoNegocio: telefonoNegocio.trim(),
        whatsappApiKey: whatsappApiKey.trim(),
        n8nWebhookUrl: n8nWebhookUrl.trim(),
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

  const handleExportarDB = async () => {
    setMigrando(true);
    try {
      const idb: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('dulce-placer-db');
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
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Base de datos exportada — ${total} registros`);
      void cargarConteoStores();
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
        const r = indexedDB.open('dulce-placer-db');
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

      {/* ── COPIA DE SEGURIDAD Y TRASPASO DIRECTO (PC ↔ CELULAR) ── */}
      <Card className="border-2 border-blue-500/40 bg-gradient-to-br from-blue-50/80 via-card to-indigo-50/40 dark:from-blue-950/30 dark:via-card dark:to-indigo-950/20 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  Copias de Seguridad y Traspaso (PC ↔ Celular)
                  <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold">
                    Sin Depender de la Nube
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Exporta todas tus masas, panes, recetas e inventario a un archivo para transferirlo directamente entre tu PC y tu celular.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={cargarConteoStores}
              className="text-xs text-blue-600 hover:text-blue-800 gap-1 self-start sm:self-auto"
              title="Actualizar recuento de datos locales"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", conteoStores.cargando && "animate-spin")} />
              Actualizar datos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Indicadores de datos locales detectados */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-200/60 dark:border-blue-900/40 backdrop-blur-sm">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Masas / Formulac.</span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {conteoStores.cargando ? '...' : `${conteoStores.formulaciones} masas`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Modelos de Pan</span>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                {conteoStores.cargando ? '...' : `${conteoStores.modelosPan} panes`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Recetas Técnicas</span>
              <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                {conteoStores.cargando ? '...' : `${conteoStores.recetas} recetas`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Insumos y Catálogo</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {conteoStores.cargando ? '...' : `${conteoStores.productos} productos`}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-blue-200 dark:border-blue-900 sm:pl-2.5 pt-1 sm:pt-0">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Total Registros</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                {conteoStores.cargando ? '...' : `${conteoStores.total} datos`}
              </span>
            </div>
          </div>

          {/* Botones de acción principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Button
              onClick={handleExportarDB}
              disabled={migrando}
              size="lg"
              className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-600/20 text-sm hover:scale-[1.01] transition-transform"
            >
              <Download className="w-5 h-5" />
              <div className="text-left">
                <p className="leading-tight">{migrando ? 'Exportando base de datos...' : 'Exportar todos los datos (.json)'}</p>
                <p className="text-[10px] font-normal text-blue-100 opacity-90">Descarga masas, panes y recetas para enviar al celular</p>
              </div>
            </Button>
            <Button
              onClick={() => migracionInputRef.current?.click()}
              disabled={migrando}
              variant="outline"
              size="lg"
              className="h-14 border-2 border-blue-500/50 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-bold gap-2 text-sm hover:scale-[1.01] transition-transform"
            >
              <Upload className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="leading-tight">{migrando ? 'Importando base de datos...' : 'Importar datos (.json)'}</p>
                <p className="text-[10px] font-normal text-muted-foreground">Carga el archivo descargado en este dispositivo</p>
              </div>
            </Button>
            <input
              ref={migracionInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportarDB(f); e.target.value = ''; }}
            />
          </div>
        </CardContent>
      </Card>

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

          {/* Configuración de Moneda y Divisa */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-50/40 to-card dark:from-indigo-950/10 dark:to-card backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-500" />
                Moneda del Negocio
              </CardTitle>
              <CardDescription>
                Selecciona la divisa principal para toda la aplicación (Ventas, Precios, Gastos, Caja y Reportes). Por defecto: Pesos Colombianos (COP).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                  <Coins className="w-4 h-4 text-indigo-500" />
                  Divisa Principal
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {MONEDAS.map((m) => {
                    const isSelected = monedaSeleccionada === m.code;
                    return (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => setMonedaSeleccionada(m.code)}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 text-slate-700 dark:text-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0",
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                          )}>
                            {m.simbolo}
                          </span>
                          <div>
                            <p className="font-bold text-xs leading-tight">{m.nombre}</p>
                            <p className={cn("text-[10px] uppercase tracking-wider font-semibold mt-0.5", isSelected ? "text-indigo-200" : "text-muted-foreground")}>
                              {m.code} · {m.locale}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Badge className="bg-white text-indigo-700 border-none font-black text-[9px]">ACTIVA</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vista previa en tiempo real */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ejemplo de formato en vivo:</p>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    {new Intl.NumberFormat(
                      MONEDAS.find(m => m.code === monedaSeleccionada)?.locale || 'es-CO',
                      {
                        style: 'currency',
                        currency: monedaSeleccionada,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }
                    ).format(150000)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono py-1 px-2.5">
                  Código: {monedaSeleccionada}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Automático */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-50/40 to-card dark:from-emerald-950/10 dark:to-card backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                WhatsApp Automático
              </CardTitle>
              <CardDescription>
                Recibe alertas de proveedores directo en WhatsApp — sin tocar nada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Teléfono */}
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Tu número de WhatsApp
                </Label>
                <Input
                  value={telefonoNegocio}
                  onChange={e => setTelefonoNegocio(e.target.value)}
                  placeholder="573001234567 (con código de país, sin +)"
                  className="h-11 rounded-xl font-mono border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ejemplo Colombia: <code className="bg-muted px-1 rounded">573001234567</code> · Sin espacios ni guiones
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-2 text-sm">
                  <KeyRound className="w-4 h-4 text-emerald-500" />
                  API Key de CallMeBot
                </Label>
                <div className="relative">
                  <Input
                    type={showWaKey ? 'text' : 'password'}
                    value={whatsappApiKey}
                    onChange={e => setWhatsappApiKey(e.target.value)}
                    placeholder="Tu API key de callmebot.com"
                    className="h-11 pr-10 rounded-xl font-mono border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Instructivo */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  ¿Cómo obtener el API key? (gratis, 1 vez)
                </p>
                <ol className="space-y-1.5">
                  {[
                    'Abrí WhatsApp y buscá el contacto: +34 644 61 77 78',
                    'Enviale exactamente este mensaje: I allow callmebot to send me messages',
                    'En segundos te responde con tu API key personal',
                    'Pegá ese número aquí arriba y guardá',
                  ].map((paso, i) => (
                    <li key={i} className="flex gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {paso}
                    </li>
                  ))}
                </ol>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">
                  Una vez configurado, la app envía automáticamente cuando abrís Proveedores y hay alertas pendientes. Si llegan 2 o 3 proveedores el mismo día, llega un solo mensaje con todos.
                </p>
              </div>

              {whatsappApiKey && telefonoNegocio && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-300 dark:border-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    WhatsApp automático activo
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marketing y AutomatizaciÃ³n N8N */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-fuchsia-50/40 to-card dark:from-fuchsia-950/10 dark:to-card backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-fuchsia-500" />
                AutomatizaciÃ³n de Marketing (N8N)
              </CardTitle>
              <CardDescription>
                Conecta tu instancia open-source de n8n para auto-publicar guiones y escanear TikTok/YouTube en Marketing Studio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                  <CloudUpload className="w-4 h-4 text-fuchsia-500" />
                  Webhook URL (n8n)
                </Label>
                <Input
                  value={n8nWebhookUrl}
                  onChange={e => setN8nWebhookUrl(e.target.value)}
                  placeholder="http://localhost:5678/webhook/..."
                  className="h-11 rounded-xl font-mono border-fuchsia-200 focus:border-fuchsia-500 focus:ring-fuchsia-500/20 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Este endpoint recibirÃ¡ las publicaciones automÃ¡ticas hacia Instagram, TikTok y Avatar.
                </p>
              </div>

              {n8nWebhookUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-300 dark:border-fuchsia-700">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse shrink-0" />
                  <p className="text-[11px] font-black text-fuchsia-700 dark:text-fuchsia-400 uppercase tracking-wide">
                    Enlace de marketing preparado
                  </p>
                </div>
              )}
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
                    const id = toast.loading('Sincronización bidireccional en curso...');
                    try {
                      // Paso 1: Subir local → Firebase (desde este dispositivo)
                      await db.syncLocalToCloud?.();
                      // Paso 2: Descargar Firebase → local (recibe de todos los dispositivos)
                      await db.syncCloudToLocal?.();
                      // Paso 3: Refrescar estado React sin recargar página
                      ['productos', 'proveedores', 'precios'].forEach(table =>
                        window.dispatchEvent(new CustomEvent('nexus-realtime-change', { detail: { table, eventType: 'INSERT', id: '' } }))
                      );
                      toast.success('✨ Sincronización completa — productos actualizados', { id });
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

              {/* SUBIR DATOS LOCALES A SUPABASE */}
              <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-tighter">
                  <CloudUpload className="w-4 h-4" />
                  Subir datos de este dispositivo a la nube
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Si usas la app en <strong>otro navegador o dispositivo</strong> y no ves tus productos,
                  primero pulsa este botón en el dispositivo donde <em>sí</em> aparecen.
                  Sube todos tus productos, proveedores y precios a Supabase para que los demás puedan descargarlos.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10 font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] transition-transform border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  onClick={async () => {
                    if (!confirm('¿Subir todos los productos, proveedores y precios de este dispositivo a la nube?\n\nEsto no borra nada — solo sube lo que tienes aquí para que otros navegadores puedan descargarlo.')) return;
                    const id = toast.loading('Subiendo datos locales a Supabase...');
                    try {
                      const supaDB = new SupabaseDatabase();
                      const [productos, proveedores, precios] = await Promise.all([
                        db.getAllProductos(),
                        db.getAllProveedores(),
                        db.getAllPrecios(),
                      ]);
                      let ok = 0;
                      let fail = 0;
                      for (const p of productos) {
                        try { await supaDB.addProducto(p as any); ok++; } catch { fail++; }
                      }
                      for (const p of proveedores) {
                        try { await supaDB.addProveedor(p as any); ok++; } catch { fail++; }
                      }
                      for (const p of precios) {
                        try { await supaDB.addPrecio(p as any); ok++; } catch { fail++; }
                      }
                      if (fail === 0) {
                        toast.success(`¡Listo! ${ok} registros subidos a la nube. Ahora en el otro navegador pulsa "Sincronizar Ahora".`, { id });
                      } else {
                        toast.warning(`${ok} subidos, ${fail} con error. Revisa tu conexión a Supabase.`, { id });
                      }
                    } catch (e) {
                      toast.error('Error al subir: ' + (e as Error).message, { id });
                    }
                  }}
                >
                  Subir este dispositivo a la nube
                </Button>
              </div>

              {/* PROTOCOLO ARMAGEDÓN (BOTÓN DE EMERGENCIA) */}
              <div className="mt-4 p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5 space-y-3">
                <div className="flex items-center gap-2 text-red-600 font-black text-xs uppercase tracking-tighter">
                  <Zap className="w-4 h-4 animate-pulse" />
                  Protocolo Armagedón: Rescate Crítico
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Si tras refrescar no ves tus productos, usa este botón para <strong>extraer todo de Supabase</strong> y moverlo al nuevo sistema. Úsalo solo en emergencias.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-10 font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] transition-transform"
                  onClick={async () => {
                    if (!confirm('🚨 ¿INICIAR RESCATE CRÍTICO?\n\nEsto buscará todos tus datos en el servidor de respaldo (Supabase) y los volcará en este dispositivo. No borra nada, solo suma lo que falte.')) return;
                    const id = toast.loading('INICIANDO PROTOCOLO DE RESCATE...');
                    try {
                      await db.rescueFromSupabase();
                      toast.success('🏁 ¡RESCATE COMPLETADO! Tus datos han vuelto.', { id });
                      setTimeout(() => window.location.reload(), 2000);
                    } catch (e) {
                      toast.error('Fallo en el rescate: ' + (e as Error).message, { id });
                    }
                  }}
                >
                  Iniciar Rescate desde Supabase
                </Button>
              </div>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latasPorHorno" className="text-sm">Capacidad del Horno (Latas)</Label>
                      <Input
                        id="latasPorHorno"
                        type="number"
                        value={latasPorHorno}
                        onChange={(e) => setLatasPorHorno(e.target.value)}
                        className="border-primary/10 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pesoArrobaKg" className="text-sm">Peso Arroba (Kg)</Label>
                      <Input
                        id="pesoArrobaKg"
                        type="number"
                        step="0.5"
                        value={pesoArrobaKg}
                        onChange={(e) => setPesoArrobaKg(e.target.value)}
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
          {/* Inicializar Inventario */}
          <div className="pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="lg"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 font-bold"
              onClick={async () => {
                if (!confirm('¿Establecer 100 unidades de stock actual y 10 unidades de stock mínimo para TODOS los productos que estén en 0 o no tengan registro? Esto no afectará el stock actual que sea mayor a 0.')) return;
                
                try {
                  const todosProductos = await db.getAllProductos();
                  const todosPrecios = await db.getAllPrecios();
                  let count = 0;
                  
                  for (const prod of todosProductos) {
                    // Buscar si tiene precio registrado
                    const precioExistente = todosPrecios.find(p => p.productoId === prod.id);
                    const stockActual = precioExistente?.stockActual ?? 0;
                    
                    if (stockActual === 0) {
                      // Si no tiene precio o está en 0
                      const nuevoPrecio = {
                        productoId: prod.id,
                        costoBase: precioExistente?.costoBase ?? prod.precioVenta * 0.7, // fallback estimado
                        precioVenta: precioExistente?.precioVenta ?? prod.precioVenta,
                        stockActual: 100,
                        stockMinimo: 10,
                        ultimaModificacion: new Date().toISOString()
                      };
                      await db.addPrecio(nuevoPrecio).catch(async () => {
                        // Si ya existe en BD pero está en 0, actualizarlo
                        if (precioExistente) {
                          await db.addPrecio({
                            ...precioExistente,
                            stockActual: 100,
                            stockMinimo: 10,
                            ultimaModificacion: new Date().toISOString()
                          });
                        }
                      });
                      count++;
                    }
                  }
                  toast.success(`✨ Se inicializó el inventario de ${count} productos a 100 unidades.`);
                  setTimeout(() => window.location.reload(), 1500);
                } catch (err: any) {
                  toast.error(`Error al inicializar inventario: ${err.message}`);
                }
              }}
            >
              <Zap className="w-5 h-5 mr-2 text-amber-500 animate-pulse" />
              Inicializar Inventario (100 und.)
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Establece 100 unidades de stock y 10 unidades de stock mínimo para productos sin stock.
            </p>
          </div>

          {/* Exportación Maestra Excel */}
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

      </div>
    </div>
  );
}

export default Configuracion;
