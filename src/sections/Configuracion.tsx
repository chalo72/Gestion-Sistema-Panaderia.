import { useState, useEffect } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, DollarSign, Activity, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Configuracion, MonedaCode } from '@/types';
import { MONEDAS } from '@/types';

interface ConfiguracionProps {
  configuracion: Configuracion;
  onUpdateConfiguracion: (updates: Partial<Configuracion>) => void;
  onClearAllData: () => void;
  formatCurrency: (value: number) => string;
}

function Configuracion({
  configuracion,
  onUpdateConfiguracion,
  onClearAllData,
  formatCurrency,
}: ConfiguracionProps) {
  const [nombreNegocio, setNombreNegocio] = useState('Mi Negocio');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<MonedaCode>('EUR');
  const [margen, setMargen] = useState('30');
  const [impuesto, setImpuesto] = useState('0');
  const [autoAjuste, setAutoAjuste] = useState(true);
  const [notificaciones, setNotificaciones] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (configuracion) {
      setNombreNegocio(configuracion.nombreNegocio || 'Mi Negocio');
      setMonedaSeleccionada(configuracion.moneda || 'EUR');
      setMargen((configuracion.margenUtilidadDefault || 30).toString());
      setImpuesto((configuracion.impuestoPorcentaje || 0).toString());
      setAutoAjuste(configuracion.ajusteAutomatico !== false);
      setNotificaciones(configuracion.notificarSubidas !== false);
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
        <Button variant="outline" onClick={() => window.location.reload()} className="gap-2 border-primary/20 hover:bg-primary/5 transition-all hover:scale-105">
          <RefreshCw className="w-4 h-4" />
          Reiniciar Sistema
        </Button>
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
              </div>
            </CardContent>
          </Card>

          {/* Configuración Financiera (Moneda) */}
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Divisa Base
              </CardTitle>
              <CardDescription>Moneda principal para transacciones y reportes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {MONEDAS.map((m) => (
                  <button
                    key={m.code}
                    onClick={() => setMonedaSeleccionada(m.code)}
                    className={`
                        relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300
                        ${monedaSeleccionada === m.code
                        ? 'border-primary bg-primary/5 shadow-md scale-105 ring-2 ring-primary/20'
                        : 'border-border/50 hover:border-primary/50 hover:bg-card/80 hover:scale-105'
                      }
                    `}
                  >
                    <div className={`text-3xl font-bold mb-1 ${monedaSeleccionada === m.code ? 'text-primary' : 'text-muted-foreground'}`}>
                      {m.simbolo}
                    </div>
                    <div className="text-sm font-medium">{m.code}</div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vista previa de formato:</span>
                <div className="flex gap-4 font-mono text-sm">
                  <span className="bg-background px-3 py-1 rounded border shadow-sm">{formatCurrency(1234567.89)}</span>
                </div>
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
                Reglas de Negocio
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

          {/* Botón Guardar Flotante */}
          <Button
            onClick={handleGuardar}
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30 text-lg h-14 transition-all hover:scale-[1.02]"
          >
            <Save className="w-5 h-5 mr-2" />
            Aplicar Cambios
          </Button>

          {/* Zona de Peligro */}
          <div className="pt-8 border-t border-border/40">
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
