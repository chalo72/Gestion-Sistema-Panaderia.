import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { PageTransition } from '@/components/PageTransition';
import { Login } from '@/sections/Login';
import type { ViewType } from '@/types';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { LogOut, User, TrendingUp, AlertTriangle } from 'lucide-react';
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
  console.log("AppContent mounting...");
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const { isAuthenticated, isLoading: authLoading, logout, usuario, hasPermission } = useAuth();

  const {
    // Datos
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

    // Acciones y utilidades
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

    // Getters
    getMejorPrecio,
    getPreciosByProducto,
    getPreciosByProveedor,
    getMejorPrecioByProveedor,
    getProductoById,
    getProveedorById,
    getAlertasNoLeidas,
    getEstadisticas,
    getPrecioByIds,
  } = usePriceControl();

  const isLoading = authLoading || !dataLoaded;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="text-center animate-ag-fade-in">
          <div className="w-16 h-16 kpi-blue rounded-2xl flex items-center justify-center mx-auto mb-4 animate-ag-float shadow-2xl shadow-blue-600/30">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400 font-medium">Cargando PriceControl Pro...</p>
        </div>
      </div>
    );
  }

  // Login
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
              getProveedorById={getProveedorById}
              getProductoById={getProductoById}
              formatCurrency={formatCurrency}
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
      default:
        return hasPermission('VER_DASHBOARD') ? (
          <Dashboard
            estadisticas={getEstadisticas()}
            alertas={[]}
            prepedidos={[]}
            onMarcarAlertaLeida={marcarAlertaLeida}
            onViewAlertas={() => { }}
            onViewProductos={() => { }}
            onViewPrePedidos={() => { }}
            onViewProveedores={() => { }}
            onViewRecepciones={() => { }}
            onViewInventario={() => { }}
            getProveedorById={getProveedorById}
            getProductoById={getProductoById}
            formatCurrency={formatCurrency}
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
              <p className="text-sm font-semibold text-foreground">{usuario?.nombre} {usuario?.apellido}</p>
              <p className="text-xs text-muted-foreground">{usuario?.rol}</p>
            </div>
          </div>
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
