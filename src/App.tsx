import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/layout/PageTransition';
import { Login } from '@/pages/Login';
import type { ViewType } from '@/types';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { LogOut, User, AlertTriangle, ShoppingCart, Settings, Unlock, Lock, Plus, Minus } from 'lucide-react';
import { usePriceControl } from '@/hooks/usePriceControl';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary';
import { GlobalActionSystem } from '@/components/GlobalActionSystem';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Modales de Caja (Movidos al global)
import { AperturaCajaModal } from '@/components/ventas/AperturaCajaModal';
import { CierreCajaModal } from '@/components/ventas/CierreCajaModal';
import { CajaMovimientosModal } from '@/components/ventas/CajaMovimientosModal';


import Dashboard from '@/pages/Dashboard';
import Productos from '@/pages/Productos';
import { Ventas } from '@/pages/Ventas';
import { ControlCaja } from '@/pages/ControlCaja';
import Produccion from '@/pages/Produccion';
import Usuarios from '@/pages/Usuarios';
import Reportes from '@/pages/Reportes';

const Inventario = lazy(() => import('@/pages/Inventario'));
const Configuracion = lazy(() => import('@/pages/Configuracion'));
const Proveedores = lazy(() => import('@/pages/Proveedores'));
const Precios = lazy(() => import('@/pages/Precios'));
const Recepciones = lazy(() => import('@/pages/Recepciones'));
const Alertas = lazy(() => import('@/pages/Alertas'));
const PrePedidos = lazy(() => import('@/pages/PrePedidos'));
const RoleManager = lazy(() => import('@/pages/RoleManager'));
const Recetas = lazy(() => import('@/pages/Recetas'));
const Ahorros = lazy(() => import('@/pages/Ahorros'));
const Gastos = lazy(() => import('@/pages/Gastos'));
const HistorialVentas = lazy(() => import('@/pages/HistorialVentas'));
const CargaMasiva = lazy(() => import('@/pages/CargaMasiva'));
const ListaPreciosProvincial = lazy(() => import('@/pages/ListaPreciosProvincial'));
const CreditosClientes = lazy(() => import('@/pages/CreditosClientes'));
const Trabajadores = lazy(() => import('@/pages/Trabajadores'));

// Skeleton para durante la carga de secciones
function SectionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-32 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

// Componente interno que usa el contexto de auth
function UnauthorizedState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[60vh]">
      <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-yellow-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso No Autorizado</h2>
      <p className="text-gray-500 max-w-md">
        No tienes permisos suficientes para ver esta sección. Contacta al administrador si crees que es un error.
      </p>
    </div>
  );
}

// Componente interno que usa el contexto de auth
function AppContent() {
  // 1. Estados iniciales (Hooks)
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [movementModal, setMovementModal] = useState<{ isOpen: boolean; tipo: 'entrada' | 'salida' }>({
    isOpen: false,
    tipo: 'entrada'
  });

  // 2. Contextos y Hooks de Control (Hooks)
  const auth = useAuth();
  const { isAuthenticated, isLoading: authLoading, logout, usuario, hasPermission } = auth;
  
  // ✅ Auto-actualización del sistema
  const { currentVersion, updateAvailable, newVersion, isUpdating, aplicarActualizacion } = useAutoUpdate();

  const priceControl = usePriceControl();
  const {
    productos,
    proveedores,
    precios,
    alertas,
    configuracion,
    prepedidos,
    loaded: dataLoaded,
    inventario,
    movimientos,
    recepciones,
    historial,
    addProducto,
    updateProducto,
    deleteProducto,
    addProveedor,
    updateProveedor,
    deleteProveedor,
    addOrUpdatePrecio,
    deletePrecio,
    addPrePedido,
    updatePrePedido,
    deletePrePedido,
    addItemToPrePedido,
    removeItemFromPrePedido,
    updateItemCantidad,
    marcarAlertaLeida,
    marcarTodasAlertasLeidas,
    deleteAlerta,
    clearAllAlertas,
    addCategoria,
    deleteCategoria,
    updateConfiguracion,
    onAjustarStock,
    addRecepcion,
    confirmarRecepcion,
    clearAllData,
    formatCurrency,
    generarSugerenciasPedido,
    syncWithCloud,
    getMejorPrecio,
    getPreciosByProducto,
    getPreciosByProveedor,
    getMejorPrecioByProveedor,
    getProductoById,
    getProveedorById,
    getAlertasNoLeidas,
    getEstadisticas,
    getPrecioByIds,
    recetas,
    addReceta,
    updateReceta,
    deleteReceta,
    ventas,
    sesionesCaja,
    cajaActiva,
    registrarVenta,
    abrirCaja,
    cerrarCaja,
    ahorros,
    mesas,
    pedidosActivos,
    gastos,
    addGasto,
    generarReporte,
    produccion,
    addOrdenProduccion,
    updateOrdenProduccion,
    finalizarProduccion,
    formulaciones,
    modelosPan,
    addFormulacion,
    updateFormulacion,
    deleteFormulacion,
    addModeloPan,
    updateModeloPan,
    deleteModeloPan,
    updateMesa,
    addMesa,
    deleteMesa,
    addPedidoActivo,
    updatePedidoActivo,
    deletePedidoActivo,
    registrarMovimientoCaja,
    creditosClientes,
    addCreditoCliente,
    updateCreditoCliente,
    deleteCreditoCliente,
    registrarPagoCredito,
    creditosTrabajadores,
    addCreditoTrabajador,
    updateCreditoTrabajador,
    deleteCreditoTrabajador,
    registrarPagoCreditoTrabajador,
    trabajadores,
    addTrabajador,
    updateTrabajador,
    deleteTrabajador,
  } = priceControl;

  // 3. Efectos de Sincronización (Hooks)
  useEffect(() => {
    // Solo en desarrollo
    if (import.meta.env.DEV && isAuthenticated) {
      console.log('📱 App Ready - View:', currentView);
    }
  }, [isAuthenticated, currentView]);

  useEffect(() => {
    if (import.meta.env.DEV && isAuthenticated && dataLoaded) {
      console.log("⚡ Modo Local de Alta Velocidad Activo");
    }
  }, [isAuthenticated, dataLoaded]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 4. Lógica de UI - Fail-Safe Antigravity
  const [showForceLoad, setShowForceLoad] = useState(false);
  const [isForceLoaded, setIsForceLoaded] = useState(false);
  const isLoading = (authLoading || !dataLoaded) && !isForceLoaded;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isLoading && !isForceLoaded) {
      timer = setTimeout(() => {
        setShowForceLoad(true);
        console.warn("⚠️ [Nexus-Volt] Carga demorada. Activando modo de emergencia.");
      }, 5000); // 5 segundos de cortesía
    }
    return () => clearTimeout(timer);
  }, [isLoading, isForceLoaded]);

  // 5. Retornos Condicionales
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="text-center animate-ag-fade-in">
          <div className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 bg-transparent drop-shadow-[0_0_20px_rgba(255,0,127,0.5)] animate-ag-float">
            <img src="logo_panaderia.png" alt="Loading" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-4">
            <p className="text-[#ff007f] font-black uppercase tracking-[0.4em] animate-pulse italic text-sm">Dulce Placer...</p>
            <div className="w-48 h-1 bg-white/5 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-ag-shimmer w-1/2" />
            </div>

            {showForceLoad && (
              <div className="pt-8 flex flex-col items-center gap-4 animate-ag-fade-in">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest max-w-xs opacity-60">Sincronización demorada en el Nexus. ¿Quieres forzar la entrada?</p>
                <Button
                  onClick={() => setIsForceLoaded(true)}
                  variant="outline"
                  className="h-10 px-8 rounded-xl border-[#ff007f]/30 text-[#ff007f] hover:bg-[#ff007f]/10 font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  Forzar Entrada al Sistema
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setCurrentView('dashboard')} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return hasPermission('VER_DASHBOARD') ? (
          <SectionErrorBoundary sectionName="Dashboard">
            <Dashboard
              estadisticas={getEstadisticas()}
              alertas={alertas.slice(0, 5)}
              prepedidos={prepedidos.slice(0, 3)}
              onMarcarAlertaLeida={marcarAlertaLeida}
              onViewAlertas={() => setCurrentView('alertas')}
              onViewProductos={() => setCurrentView('productos')}
              onViewPrePedidos={() => setCurrentView('prepedidos')}
              onViewProveedores={() => setCurrentView('proveedores')}
              onViewRecepciones={() => setCurrentView('recepciones')}
              onViewInventario={() => setCurrentView('inventario')}
              onViewVentas={() => setCurrentView('ventas')}
              onViewAhorros={() => setCurrentView('ahorro')}
              getProveedorById={getProveedorById}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
              mesas={mesas}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'productos':
        return hasPermission('VER_PRODUCTOS') ? (
          <SectionErrorBoundary sectionName="Productos">
            <Productos
              productos={productos}
              proveedores={proveedores}
              precios={precios}
              categorias={configuracion.categorias}
              onAddProducto={addProducto}
              onUpdateProducto={updateProducto}
              onDeleteProducto={deleteProducto}
              onAddCategoria={addCategoria}
              onDeleteCategoria={deleteCategoria}
              onAddOrUpdatePrecio={addOrUpdatePrecio}
              onDeletePrecio={deletePrecio}
              getMejorPrecio={getMejorPrecio}
              getPreciosByProducto={getPreciosByProducto}
              getProveedorById={getProveedorById}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'proveedores':
        return hasPermission('VER_PROVEEDORES') ? (
          <SectionErrorBoundary sectionName="Proveedores">
            <Proveedores
              proveedores={proveedores}
              productos={productos}
              precios={precios}
              onAddProveedor={addProveedor}
              onUpdateProveedor={updateProveedor}
              onDeleteProveedor={deleteProveedor}
              onAddProducto={addProducto}
              onAddOrUpdatePrecio={addOrUpdatePrecio}
              getPreciosByProveedor={getPreciosByProveedor}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
              onUpdateProducto={updateProducto}
              onNavigateTo={setCurrentView}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'alertas':
        return hasPermission('VER_ALERTAS') ? (
          <SectionErrorBoundary sectionName="Alertas">
            <Alertas
              alertas={alertas}
              productos={productos}
              proveedores={proveedores}
              onMarcarLeida={marcarAlertaLeida}
              onMarcarTodasLeidas={marcarTodasAlertasLeidas}
              onDeleteAlerta={deleteAlerta}
              onClearAll={clearAllAlertas}
              getProductoById={getProductoById}
              getProveedorById={getProveedorById}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'prepedidos':
        return hasPermission('VER_PREPEDIDOS') ? (
          <SectionErrorBoundary sectionName="Pre-Pedidos">
            <PrePedidos
              prepedidos={prepedidos}
              productos={productos}
              proveedores={proveedores}
              precios={precios}
              inventario={inventario}
              produccion={produccion}
              recetas={recetas}
              onAddPrePedido={addPrePedido}
              onUpdatePrePedido={updatePrePedido}
              onDeletePrePedido={deletePrePedido}
              onAddItem={addItemToPrePedido}
              onRemoveItem={removeItemFromPrePedido}
              onUpdateItemCantidad={updateItemCantidad}
              getProductoById={getProductoById}
              getProveedorById={getProveedorById}
              getMejorPrecioByProveedor={getMejorPrecioByProveedor}
              getPreciosByProveedor={getPreciosByProveedor}
              formatCurrency={formatCurrency}
              onGenerarSugerencias={generarSugerenciasPedido}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'precios':
        return hasPermission('VER_PRECIOS') ? (
          <SectionErrorBoundary sectionName="Precios">
            <Precios
              productos={productos}
              proveedores={proveedores}
              precios={precios}
              historial={historial}
              onAddOrUpdatePrecio={addOrUpdatePrecio}
              onDeletePrecio={deletePrecio}
              getPrecioByIds={getPrecioByIds}
              getProductoById={getProductoById}
              getProveedorById={getProveedorById}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'inventario':
        return hasPermission('VER_INVENTARIO') ? (
          <SectionErrorBoundary sectionName="Inventario">
            <Inventario
              productos={productos}
              inventario={inventario}
              movimientos={movimientos}
              categorias={configuracion.categorias}
              precios={precios}
              onAjustarStock={onAjustarStock}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
              onGenerarSugerencias={generarSugerenciasPedido}
              onViewPrePedidos={() => setCurrentView('prepedidos')}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'recepciones':
        return hasPermission('VER_RECEPCIONES') ? (
          <SectionErrorBoundary sectionName="Recepciones">
            <Recepciones
              recepciones={recepciones}
              proveedores={proveedores}
              productos={productos}
              prepedidos={prepedidos}
              onAddRecepcion={addRecepcion}
              onConfirmarRecepcion={confirmarRecepcion}
              getProveedorById={getProveedorById}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'configuracion':
        return hasPermission('VER_CONFIGURACION') ? (
          <SectionErrorBoundary sectionName="Configuración">
            <Configuracion
              configuracion={configuracion}
              onUpdateConfiguracion={updateConfiguracion}
              onSyncWithCloud={syncWithCloud}
              onClearAllData={clearAllData}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'usuarios':
        return hasPermission('VER_USUARIOS') ? (
          <SectionErrorBoundary sectionName="Usuarios">
            <Usuarios />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'roles':
        return hasPermission('VER_USUARIOS') ? (
          <SectionErrorBoundary sectionName="Gestión de Roles">
            <RoleManager />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'recetas':
        return hasPermission('VER_PRODUCTOS') ? (
          <SectionErrorBoundary sectionName="Escandallos / Recetas">
            <Recetas
              productos={productos}
              recetas={recetas}
              formulaciones={formulaciones}
              modelosPan={modelosPan}
              getMejorPrecio={getMejorPrecio}
              addReceta={addReceta}
              updateReceta={updateReceta}
              deleteReceta={deleteReceta}
              addFormulacion={addFormulacion}
              updateFormulacion={updateFormulacion}
              deleteFormulacion={deleteFormulacion}
              addModeloPan={addModeloPan}
              updateModeloPan={updateModeloPan}
              deleteModeloPan={deleteModeloPan}
              formatCurrency={formatCurrency}
              getProductoById={getProductoById}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'ventas':
        return hasPermission('VER_VENTAS') ? (
          <SectionErrorBoundary sectionName="Ventas / POS">
            <Ventas
              productos={productos}
              inventario={inventario}
              ventas={ventas}
              cajaActiva={cajaActiva}
              onRegistrarVenta={registrarVenta}
              onAbrirCaja={abrirCaja}
              onCerrarCaja={cerrarCaja}
              formatCurrency={formatCurrency}
              usuario={usuario}
              categorias={Array.isArray(configuracion.categorias) ? configuracion.categorias : []}
              onRegistrarMovimientoCaja={registrarMovimientoCaja}
              mesas={mesas}
              pedidosActivos={pedidosActivos}
              onUpdateMesa={updateMesa}
              onAddPedidoActivo={addPedidoActivo}
              onUpdatePedidoActivo={updatePedidoActivo}
              onDeletePedidoActivo={deletePedidoActivo}
              onUpdateProducto={updateProducto}
              onAjustarStock={onAjustarStock}
              onAddMesa={addMesa}
              onDeleteMesa={deleteMesa}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'caja':
        return hasPermission('ABRIR_CERRAR_CAJA') ? (
          <SectionErrorBoundary sectionName="Control de Caja">
            <ControlCaja
              sesiones={sesionesCaja}
              ventas={ventas}
              cajaActiva={cajaActiva}
              formatCurrency={formatCurrency}
              getProductoById={getProductoById}
              registrarMovimientoCaja={registrarMovimientoCaja}
              usuario={usuario}
              productos={productos}
              categorias={Array.isArray(configuracion.categorias) ? configuracion.categorias : []}
              onAbrirCaja={(monto) => abrirCaja(usuario?.id || 'admin', monto)}
              onCerrarCaja={cerrarCaja}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'ahorro':
        return hasPermission('VER_FINANZAS') ? (
          <SectionErrorBoundary sectionName="Mis Ahorros">
            <Ahorros
              ventas={ventas}
              ahorros={ahorros}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'gastos':
        return hasPermission('VER_FINANZAS') ? (
          <SectionErrorBoundary sectionName="Egresos y Facturas">
            <Gastos
              gastos={gastos}
              proveedores={proveedores}
              cajaActiva={cajaActiva}
              onAddGasto={priceControl.addGasto}
              onUpdateGasto={priceControl.updateGasto}
              onDeleteGasto={priceControl.deleteGasto}
              formatCurrency={formatCurrency}
              usuario={usuario!}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'reportes':
        return hasPermission('VER_FINANZAS') ? (
          <SectionErrorBoundary sectionName="Análisis Financiero">
            <Reportes
              ventas={ventas}
              gastos={gastos}
              formatCurrency={formatCurrency}
              generarReporte={generarReporte}
              productos={productos}
              categorias={Array.isArray(configuracion.categorias) ? configuracion.categorias : []}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'produccion': // Added new case for Produccion
        return hasPermission('VER_PRODUCCION') ? (
          <SectionErrorBoundary sectionName="Producción">
            <Produccion
              produccion={produccion}
              productos={productos}
              recetas={recetas}
              inventario={inventario}
              proveedores={proveedores}
              formulaciones={formulaciones}
              modelosPan={modelosPan}
              addOrdenProduccion={addOrdenProduccion}
              updateOrdenProduccion={updateOrdenProduccion}
              finalizarProduccion={finalizarProduccion}
              addFormulacion={addFormulacion}
              updateFormulacion={updateFormulacion}
              deleteFormulacion={deleteFormulacion}
              addModeloPan={addModeloPan}
              updateModeloPan={updateModeloPan}
              deleteModeloPan={deleteModeloPan}
              getProductoById={getProductoById}
              getMejorPrecio={getMejorPrecio}
              formatCurrency={formatCurrency}
              onNavigateTo={setCurrentView}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'historial-ventas':
        return hasPermission('VER_VENTAS') ? (
          <SectionErrorBoundary sectionName="Historial de Ventas">
            <HistorialVentas
              ventas={ventas}
              productos={productos}
              sesionesCaja={sesionesCaja}
              proveedores={proveedores}
              precios={precios}
              formatCurrency={formatCurrency}
              getProductoById={getProductoById}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'cargamasiva':
        return hasPermission('CREAR_PRODUCTOS') ? (
          <SectionErrorBoundary sectionName="Carga Masiva">
            <CargaMasiva
              productos={productos}
              proveedores={proveedores}
              categorias={configuracion.categorias}
              onAddProducto={addProducto}
              onAddProveedor={addProveedor}
              onAddCategoria={addCategoria}
              formatCurrency={formatCurrency}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'listapreciosproincial':
        // Ruta absorbida por Inventario (tab Precios + Stock)
        return null;
      case 'creditos':
        return hasPermission('VER_FINANZAS') ? (
          <SectionErrorBoundary sectionName="Créditos">
            <Suspense fallback={<SectionSkeleton />}>
              <CreditosClientes
                creditosClientes={creditosClientes}
                onAddCreditoCliente={addCreditoCliente}
                onUpdateCreditoCliente={updateCreditoCliente}
                onDeleteCreditoCliente={deleteCreditoCliente}
                onRegistrarPagoCredito={registrarPagoCredito}
                creditosTrabajadores={creditosTrabajadores}
                onAddCreditoTrabajador={addCreditoTrabajador}
                onUpdateCreditoTrabajador={updateCreditoTrabajador}
                onDeleteCreditoTrabajador={deleteCreditoTrabajador}
                onRegistrarPagoCreditoTrabajador={registrarPagoCreditoTrabajador}
                formatCurrency={formatCurrency}
                usuario={usuario!}
                productos={productos}
                trabajadores={trabajadores}
                onGoToTrabajadores={() => setCurrentView('trabajadores')}
              />
            </Suspense>
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      case 'trabajadores':
        return hasPermission('VER_USUARIOS') ? (
          <SectionErrorBoundary sectionName="Trabajadores">
            <Suspense fallback={<SectionSkeleton />}>
              <Trabajadores
                trabajadores={trabajadores}
                onAddTrabajador={addTrabajador}
                onUpdateTrabajador={updateTrabajador}
                onDeleteTrabajador={deleteTrabajador}
                formatCurrency={formatCurrency}
                creditosTrabajadores={creditosTrabajadores}
                onAddCreditoTrabajador={addCreditoTrabajador}
                onUpdateCreditoTrabajador={updateCreditoTrabajador}
                onDeleteCreditoTrabajador={deleteCreditoTrabajador}
                onRegistrarPagoCreditoTrabajador={registrarPagoCreditoTrabajador}
                usuario={usuario!}
              />
            </Suspense>
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      default:
        return hasPermission('VER_DASHBOARD') ? (
          <SectionErrorBoundary sectionName="Dashboard">
            <Dashboard
              estadisticas={getEstadisticas()}
              alertas={alertas.slice(0, 5)}
              prepedidos={prepedidos.slice(0, 3)}
              onMarcarAlertaLeida={marcarAlertaLeida}
              onViewAlertas={() => setCurrentView('alertas')}
              onViewProductos={() => setCurrentView('productos')}
              onViewPrePedidos={() => setCurrentView('prepedidos')}
              onViewProveedores={() => setCurrentView('proveedores')}
              onViewRecepciones={() => setCurrentView('recepciones')}
              onViewInventario={() => setCurrentView('inventario')}
              onViewVentas={() => setCurrentView('ventas')}
              onViewAhorros={() => setCurrentView('ahorro')}
              getProveedorById={getProveedorById}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
              mesas={mesas}
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        alertasNoLeidas={Array.isArray(getAlertasNoLeidas()) ? getAlertasNoLeidas().length : 0}
        productos={productos}
        proveedores={proveedores}
        precios={precios}
        getMejorPrecio={getMejorPrecio}
        getPreciosByProducto={getPreciosByProducto}
        getProveedorById={getProveedorById}
        formatCurrency={formatCurrency}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className={cn(
        "flex-1 w-full md:w-auto transition-all duration-300 h-screen flex flex-col bg-background overflow-hidden",
        isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
      )}>
        {/* Banner de actualización — no interrumpe, solo avisa */}
        {updateAvailable && (
          <div className="flex-none bg-emerald-600 text-white px-4 py-2 flex items-center justify-between gap-4 z-50">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-bold">Nueva versión disponible {newVersion ? `(v${newVersion})` : ''}</span>
              <span className="text-emerald-100 hidden sm:inline">— Actualiza cuando termines lo que estás haciendo</span>
            </div>
            <button
              onClick={aplicarActualizacion}
              disabled={isUpdating}
              className="flex-none bg-white text-emerald-700 text-xs font-black px-3 py-1 rounded-lg hover:bg-emerald-50 active:scale-95 transition-all"
            >
              {isUpdating ? 'Actualizando...' : 'Actualizar ahora'}
            </button>
          </div>
        )}

        {/* Header (Restaurado) */}
        <header className="flex-none bg-white dark:bg-slate-900 border-b border-border px-4 md:px-8 py-4 flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-border">
              <User className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-foreground">{usuario?.nombre} {usuario?.apellido}</p>
                <div className="flex gap-2">
                  {isOnline ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-50/50">Online</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-50/50 grayscale">Offline</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-50/50 animate-pulse">Nexus v3.1-FIX</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{usuario?.rol}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Control de Caja Antigravity Premium */}
            <div className="hidden lg:flex items-center gap-3 mr-4 pr-4 border-r border-slate-200/50 dark:border-slate-800/50">
              {cajaActiva ? (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                  {/* Píldora de Estado */}
                  <div
                    onClick={() => setShowCierreModal(true)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all group shadow-sm active:scale-95"
                  >
                    <div className="relative flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500/40 animate-ping" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">Caja Activa</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white leading-none mt-1 uppercase">
                        {formatCurrency(cajaActiva.totalVentas)}
                      </span>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors ml-1" />
                  </div>

                  {/* Botones de Movimiento Rápidos */}
                  <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMovementModal({ isOpen: true, tipo: 'entrada' })}
                      title="Registrar Entrada"
                      className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all active:scale-90"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMovementModal({ isOpen: true, tipo: 'salida' })}
                      title="Registrar Salida"
                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all active:scale-90"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowAperturaModal(true)}
                  className="h-10 px-5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl gap-2 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  <Unlock className="w-4 h-4" />
                  Abrir Turno
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('ventas')}
              className="hidden sm:flex gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold text-xs px-5 h-10 rounded-xl"
            >
              <ShoppingCart className="w-4 h-4" />
              Ver POS
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-destructive font-bold text-xs h-10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className={cn(
          "flex-1 w-full overflow-x-hidden",
          currentView === 'ventas' ? "overflow-hidden" : "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
        )}>
          <div className={cn(
            "w-full h-full",
            currentView === 'ventas' ? "" : "px-4 md:px-8 py-6"
          )}>
            <PageTransition viewKey={currentView} className="h-full w-full">
              <Suspense fallback={<SectionSkeleton />}>
                <div className="w-full h-full">
                  {renderView()}
                </div>
              </Suspense>
            </PageTransition>
          </div>
        </div>
      </main>

      {/* Botón flotante de accesos directos eliminado a petición del usuario */}
      {/* 
      {isAuthenticated && dataLoaded && (
        <GlobalActionSystem
          onViewChange={setCurrentView}
          categorias={configuracion.categorias || []}
          proveedores={proveedores}
          onAddProducto={addProducto}
          onAddGasto={addGasto}
          recetas={recetas}
          inventario={inventario}
          productos={productos}
          onAddOrdenProduccion={addOrdenProduccion}
          formatCurrency={formatCurrency}
          usuarioId={usuario?.id || 'anon'}
        />
      )}
      */}

      {/* Modales de Caja Globales */}
      <AperturaCajaModal
        isOpen={showAperturaModal}
        onClose={() => setShowAperturaModal(false)}
        onAbrir={(monto) => abrirCaja(usuario?.id || 'admin', monto)}
      />

      <CierreCajaModal
        isOpen={showCierreModal}
        onClose={() => setShowCierreModal(false)}
        onCerrar={cerrarCaja}
        cajaActiva={cajaActiva}
        formatCurrency={formatCurrency}
      />

      <CajaMovimientosModal
        isOpen={movementModal.isOpen}
        onOpenChange={(open) => setMovementModal(prev => ({ ...prev, isOpen: open }))}
        tipo={movementModal.tipo}
        onSubmit={async (monto, motivo) => {
          await registrarMovimientoCaja(monto, movementModal.tipo, motivo, usuario?.id || 'anon');
        }}
      />

      <Toaster />
    </div>
  );
}

// App principal con Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
