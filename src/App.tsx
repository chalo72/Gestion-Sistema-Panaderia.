import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { PageTransition } from '@/components/PageTransition';
import { Login } from '@/sections/Login';
import type { ViewType } from '@/types';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { LogOut, User, AlertTriangle, ShoppingCart } from 'lucide-react';
import { usePriceControl } from '@/hooks/usePriceControl';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

// Lazy loading de secciones (below-the-fold)
const Dashboard = lazy(() => import('@/sections/Dashboard'));
const Productos = lazy(() => import('@/sections/Productos'));
const Proveedores = lazy(() => import('@/sections/Proveedores'));
const Precios = lazy(() => import('@/sections/Precios'));
const Inventario = lazy(() => import('@/sections/Inventario'));
const Recepciones = lazy(() => import('@/sections/Recepciones'));
const Alertas = lazy(() => import('@/sections/Alertas'));
const Configuracion = lazy(() => import('@/sections/Configuracion'));
const PrePedidos = lazy(() => import('@/sections/PrePedidos'));
const Usuarios = lazy(() => import('@/sections/Usuarios'));
const RoleManager = lazy(() => import('@/sections/RoleManager'));
const Recetas = lazy(() => import('@/sections/Recetas'));
const Ventas = lazy(() => import('@/sections/Ventas'));
const ControlCaja = lazy(() => import('@/sections/ControlCaja'));
const Ahorros = lazy(() => import('@/sections/Ahorros'));
const Gastos = lazy(() => import('@/sections/Gastos'));
const Reportes = lazy(() => import('@/sections/Reportes'));

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

  // 2. Contextos y Hooks de Control (Hooks)
  const auth = useAuth();
  const { isAuthenticated, isLoading: authLoading, logout, usuario, hasPermission } = auth;

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
    getRecetaByProducto,
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
    updateGasto,
    deleteGasto,
    generarReporte,
    loadAllData,
  } = priceControl;

  // 3. Efectos de Sincronización y Registro (Hooks) - SIEMPRE ANTES DE RETORNOS CONDICIONALES
  useEffect(() => {
    console.log('📱 AppState Update:', {
      isAuthenticated,
      authLoading,
      dataLoaded,
      usuario: usuario?.email,
      view: currentView,
      online: isOnline
    });
  }, [isAuthenticated, authLoading, dataLoaded, usuario, currentView, isOnline]);

  useEffect(() => {
    if (isAuthenticated && dataLoaded) {
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

  // 4. Lógica de UI
  const isLoading = authLoading || !dataLoaded;

  // 5. Retornos Condicionales (NO LLAMAR HOOKS DESPUÉS DE ESTE PUNTO)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="text-center animate-ag-fade-in">
          <div className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 bg-transparent drop-shadow-[0_0_15px_rgba(255,0,127,0.4)] animate-ag-float">
            <img src="logo_panaderia.png" alt="Loading" className="w-full h-full object-contain" />
          </div>
          <p className="text-[#ff007f] font-black uppercase tracking-[0.3em] opacity-80 italic text-sm">Dulce Placer...</p>
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
              getPreciosByProveedor={getPreciosByProveedor}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
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
              getMejorPrecio={getMejorPrecio}
              addReceta={addReceta}
              updateReceta={updateReceta}
              deleteReceta={deleteReceta}
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
              categorias={configuracion.categorias}
              mesas={mesas}
              pedidosActivos={pedidosActivos}
              onUpdateMesa={priceControl.updateMesa}
              onAddPedidoActivo={priceControl.addPedidoActivo}
              onUpdatePedidoActivo={priceControl.updatePedidoActivo}
              onDeletePedidoActivo={priceControl.deletePedidoActivo}
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
              usuario={usuario}
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
            />
          </SectionErrorBoundary>
        ) : <UnauthorizedState />;
      default:
        return hasPermission('VER_DASHBOARD') ? (
          <Dashboard
            estadisticas={getEstadisticas()}
            alertas={alertas}
            prepedidos={prepedidos}
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
        ) : <UnauthorizedState />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        alertasNoLeidas={getAlertasNoLeidas().length}
        productos={productos}
        proveedores={proveedores}
        precios={precios}
        getMejorPrecio={getMejorPrecio}
        getPreciosByProducto={getPreciosByProducto}
        getProveedorById={getProveedorById}
        formatCurrency={formatCurrency}
      />
      <main className="flex-1 w-full md:w-auto md:ml-64 transition-all duration-300">
        {/* Header Premium */}
        <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-40 pl-14 md:pl-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 kpi-violet rounded-xl flex items-center justify-center shadow-md shadow-violet-500/20">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{usuario?.nombre} {usuario?.apellido}</p>
                {isOnline ? (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Nube</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md animate-pulse">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">Local</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{usuario?.rol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('ventas')}
              className="gap-2 border-[#ff007f]/30 text-[#ff007f] hover:bg-[#ff007f]/10 shadow-sm shadow-[#ff007f]/5 font-bold animate-ag-fade-in"
            >
              <ShoppingCart className="w-4 h-4" />
              POS / Ventas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-destructive transition-ag"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
        <div className="p-4 md:p-8">
          <PageTransition viewKey={currentView}>
            <Suspense fallback={<SectionSkeleton />}>
              {renderView()}
            </Suspense>
          </PageTransition>
        </div>
      </main>
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
