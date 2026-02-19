import { useState } from 'react';
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Check,
  Trash2,
  Filter,
  AlertTriangle,
  Package,
  Store,
  DollarSign,
  CheckCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { AlertaPrecio, Producto, Proveedor } from '@/types';

interface AlertasProps {
  alertas: AlertaPrecio[];
  productos: Producto[];
  proveedores: Proveedor[];
  onMarcarLeida: (id: string) => void;
  onMarcarTodasLeidas: () => void;
  onDeleteAlerta: (id: string) => void;
  onClearAll: () => void;
  getProductoById: (id: string) => Producto | undefined;
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

export function Alertas({
  alertas,
  productos: _productos,
  proveedores: _proveedores,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onDeleteAlerta,
  onClearAll,
  getProductoById,
  getProveedorById,
  formatCurrency,
}: AlertasProps) {
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const alertasLeidas = alertas.filter(a => a.leida);

  const handleMarcarTodas = () => {
    onMarcarTodasLeidas();
    toast.success('Todas las alertas marcadas como leídas');
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de eliminar todas las alertas?')) {
      onClearAll();
      toast.success('Todas las alertas eliminadas');
    }
  };

  const renderAlerta = (alerta: AlertaPrecio, showActions: boolean = true) => {
    const producto = getProductoById(alerta.productoId);
    const proveedor = getProveedorById(alerta.proveedorId);

    return (
      <div
        key={alerta.id}
        className={`p-4 rounded-lg border ${alerta.leida
            ? 'bg-gray-50 border-gray-200'
            : alerta.tipo === 'subida'
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {alerta.tipo === 'subida' ? (
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-green-600" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">
                  {alerta.tipo === 'subida' ? 'Subida de Precio' : 'Bajada de Precio'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(alerta.fecha).toLocaleDateString()} a las {new Date(alerta.fecha).toLocaleTimeString()}
                </p>
              </div>
              {!alerta.leida && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Nueva
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{producto?.nombre || 'Producto desconocido'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{proveedor?.nombre || 'Proveedor desconocido'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 p-3 bg-white rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-500">Precio Anterior</p>
                <p className="font-semibold text-gray-700">{formatCurrency(alerta.precioAnterior)}</p>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Precio Nuevo</p>
                <p className={`font-semibold ${alerta.tipo === 'subida' ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(alerta.precioNuevo)}
                </p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-gray-500">Diferencia</p>
                <p className={`font-bold ${alerta.tipo === 'subida' ? 'text-red-600' : 'text-green-600'}`}>
                  {alerta.tipo === 'subida' ? '+' : '-'}{formatCurrency(Math.abs(alerta.diferencia))}
                  <span className="text-sm ml-1">({alerta.porcentajeCambio.toFixed(1)}%)</span>
                </p>
              </div>
            </div>

            {producto && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Precio de venta actual: {formatCurrency(producto.precioVenta)}
                  {alerta.tipo === 'subida' && (
                    <span className="text-amber-600 ml-2">
                      (Revisar margen de utilidad)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {showActions && !alerta.leida && (
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onMarcarLeida(alerta.id);
                  toast.success('Alerta marcada como leída');
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                Marcar leída
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDeleteAlerta(alerta.id);
                  toast.success('Alerta eliminada');
                }}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Alertas</h2>
          <p className="text-gray-500 mt-1">Notificaciones de cambios de precios</p>
        </div>
        <div className="flex items-center gap-2">
          {alertasNoLeidas.length > 0 && (
            <Button variant="outline" onClick={handleMarcarTodas}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
          {alertas.length > 0 && (
            <Button variant="outline" onClick={handleClearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar todo
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filtrar por:</span>
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="subida">Subidas</SelectItem>
            <SelectItem value="bajada">Bajadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pendientes">
            Pendientes ({alertasNoLeidas.length})
          </TabsTrigger>
          <TabsTrigger value="historial">
            Historial ({alertasLeidas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alertas Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertasNoLeidas.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No hay alertas pendientes</p>
                  <p className="text-sm">Las alertas aparecerán cuando haya cambios de precios</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertasNoLeidas
                    .filter(alerta => filtroTipo === 'todas' || alerta.tipo === filtroTipo)
                    .map(alerta => renderAlerta(alerta))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-green-500" />
                Historial de Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertasLeidas.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No hay alertas en el historial</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertasLeidas
                    .filter(alerta => filtroTipo === 'todas' || alerta.tipo === filtroTipo)
                    .map(alerta => renderAlerta(alerta, false))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Alertas;
