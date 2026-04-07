import { useState, useEffect } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, Activity, Globe, DollarSign, Eye, EyeOff, KeyRound, CloudDownload } from 'lucide-react';
import { db } from '@/lib/database';
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
      await onUpdateConfiguracion({
        nombreNegocio: nombreNegocio,
        moneda: monedaSeleccionada,
        margenUtilidadDefault: margenNum,
        impuestoPorcentaje: parseFloat(impuesto) || 0,
        ajusteAutomatico: autoAjuste,
        notificarSubidas: notificaciones,
        presupuestoMensual: parseFloat(presupuesto) || 0,
        publicUrl: publicUrl.trim(),
        aiMode: aiMode,
      });
      toast.success('✨ Configuración actualizada y protegida');
    } catch (error) {
      toast.error('Error de seguridad al guardar: ' + (error as Error).message);
    }
  };

  const handleLimpiarDatos = () => {
    onClearAllData();
    setShowConfirmClear(false);
    toast.success('♻️ Sistema restablecido correctamente');
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

                <div className="group">
                  <Label htmlFor="publicUrl" className="text-secondary font-bold flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> URL Pública del Sistema (Vercel)
                  </Label>
                  <Input
                    id="publicUrl"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    placeholder="https://tu-app.vercel.app"
                    className="mt-2 h-12 border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 transition-all font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2 italic px-1">
                    Esta es la dirección que se enviará por WhatsApp a los trabajadores para que entren desde su celular.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sincronización en la Nube */}
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-500" />
                Sincronización Cloud
              </CardTitle>
              <CardDescription>Respalda tus datos locales en la base de datos central de Supabase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <span className="text-sm font-semibold text-indigo-400 block">Base de Datos Híbrida</span>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Sincroniza productos, proveedores, precios, inventario y configuración.
                    Útil después de crear las tablas o al cambiar de dispositivo.
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

          {/* Recuperar datos desde la nube */}
          <div className="pt-4 border-t border-border/40">
            <Button
              variant="outline"
              disabled={isRecovering}
              onClick={async () => {
                setIsRecovering(true);
                try {
                  const r = await (db as any).recoverFromCloud();
                  toast.success(`Recuperados: ${r.productos} productos, ${r.proveedores} proveedores, ${r.precios} precios`);
                  window.location.reload();
                } catch (e: any) {
                  toast.error('Error al recuperar: ' + (e?.message || e));
                } finally {
                  setIsRecovering(false);
                }
              }}
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
            >
              {isRecovering
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Recuperando desde la nube...</>
                : <><CloudDownload className="w-4 h-4 mr-2" />Recuperar datos desde la nube</>
              }
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Restaura productos, proveedores y precios perdidos desde Supabase
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
