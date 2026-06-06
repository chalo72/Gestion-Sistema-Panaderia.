import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
  ShieldCheck,
  Database,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

import { usePriceControl } from '@/hooks/usePriceControl';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/layout/PageTransition';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ViewType } from '@/types';

// Carga inmediata — pantallas críticas del flujo de entrada
import Dashboard from '@/pages/Dashboard';
import { Login } from '@/pages/Login';

// Lazy — se cargan solo cuando el usuario navega a esa sección
const Productos          = lazy(() => import('@/pages/Productos'));
const Ventas             = lazy(() => import('@/pages/Ventas').then(m => ({ default: m.Ventas })));
const Inventario         = lazy(() => import('@/pages/Inventario'));
const PrePedidos         = lazy(() => import('@/pages/PrePedidos'));
const Recepciones        = lazy(() => import('@/pages/Recepciones'));
const Alertas            = lazy(() => import('@/pages/Alertas').then(m => ({ default: m.Alertas })));
const Produccion         = lazy(() => import('@/pages/Produccion').then(m => ({ default: m.Produccion })));
const Recetas            = lazy(() => import('@/pages/Recetas'));
const Configuracion      = lazy(() => import('@/pages/Configuracion'));
const Usuarios           = lazy(() => import('@/pages/Usuarios').then(m => ({ default: m.Usuarios })));
const RoleManager        = lazy(() => import('@/pages/RoleManager'));
const ControlCaja        = lazy(() => import('@/pages/ControlCaja').then(m => ({ default: m.ControlCaja })));
const Ahorros            = lazy(() => import('@/pages/Ahorros'));
const CreditosClientes   = lazy(() => import('@/pages/CreditosClientes'));
const AgentesIA          = lazy(() => import('@/pages/AgentesIA'));
const HistorialVentas    = lazy(() => import('@/pages/HistorialVentas'));
const Oficina            = lazy(() => import('@/pages/Oficina'));
const Trabajadores       = lazy(() => import('@/pages/Trabajadores'));
const Asistencia         = lazy(() => import('@/pages/Asistencia'));
const Nomina             = lazy(() => import('@/pages/Nomina'));
const Gastos             = lazy(() => import('@/pages/Gastos'));
const Proveedores        = lazy(() => import('@/pages/Proveedores'));
const Mayoristas         = lazy(() => import('@/pages/Mayoristas'));
const Reportes           = lazy(() => import('@/pages/Reportes'));
const Precios            = lazy(() => import('@/pages/Precios'));
const CargaMasiva        = lazy(() => import('@/pages/CargaMasiva'));
const ListaPreciosProvincial = lazy(() => import('@/pages/ListaPreciosProvincial'));
const Clientes           = lazy(() => import('@/pages/Clientes'));
const Seguridad          = lazy(() => import('@/pages/Seguridad'));
const Comunicaciones     = lazy(() => import('@/pages/Comunicaciones'));

// Fallback de carga entre páginas
const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-10 h-10 rounded-full border-2 border-t-indigo-500 border-slate-200 animate-spin" />
  </div>
);

const App = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { theme, setTheme } = useTheme();
  const { usuario: user, logout, isLoading: isAuthLoading } = useAuth();
  const { 
    productos, 
    proveedores, 
    precios,
    historial: historialPrecios,
    alertas,
    estadisticas,
    configuracion,
    loaded,
    addProducto,
    updateProducto,
    deleteProducto,
    getMejorPrecio,
    getPreciosByProducto,
    getProveedorById,
    getProductoById,
    formatCurrency,
    marcarAlertaLeida,
    marcarTodasAlertasLeidas,
    deleteAlerta,
    clearAllAlertas,
    syncWithCloud,
    clearAllData,
    addProveedor,
    updateProveedor,
    deleteProveedor,
    addCategoria,
    deleteCategoria,
    updateCategoria,
    addOrUpdatePrecio,
    deletePrecio,
    updateConfiguracion,
    // De useInventario
    recetas,
    produccion,
    formulaciones,
    modelosPan,
    addReceta,
    updateReceta,
    deleteReceta,
    addOrdenProduccion,
    updateOrdenProduccion,
    finalizarProduccion,
    addFormulacion,
    updateFormulacion,
    deleteFormulacion,
    addModeloPan,
    updateModeloPan,
    deleteModeloPan,
    inventario,
    movimientos,
    recepciones,
    onAjustarStock,
    generarSugerenciasPedido: onGenerarSugerencias,
    addRecepcion: onAddRecepcion,
    confirmarRecepcion: onConfirmarRecepcion,
    updateRecepcion: onUpdateRecepcion,
    // De useVentas
    ventas,
    sesionesCaja,
    pedidosActivos,
    ahorros,
    cajaActiva,
    registrarVenta,
    abrirCaja,
    cerrarCaja,
    registrarMovimientoCaja,
    mesas,
    addMesa,
    updateMesa,
    deleteMesa,
    addPedidoActivo: onAddPedidoActivo,
    updatePedidoActivo: onUpdatePedidoActivo,
    deletePedidoActivo: onDeletePedidoActivo,
    prepedidos,
    addPrePedido,
    updatePrePedido,
    deletePrePedido,
    addItemToPrePedido,
    removeItemFromPrePedido,
    updateItemCantidad,
    // De useFinanzas
    creditosClientes,
    creditosTrabajadores,
    addCreditoCliente,
    updateCreditoCliente,
    deleteCreditoCliente,
    registrarPagoCredito,
    addCreditoTrabajador,
    updateCreditoTrabajador,
    deleteCreditoTrabajador,
    registrarPagoCreditoTrabajador,
    trabajadores,
    gastos,
    addGasto,
    updateGasto,
    deleteGasto,
    addTrabajador,
    updateTrabajador,
    deleteTrabajador,
    generarReporte,
    clientes,
    addCliente,
    updateCliente,
    deleteCliente,
    asistencia,
    addRegistroAsistencia,
    nominas,
    addNomina,
    updateNomina,
  } = usePriceControl();

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [cajaActionTrigger, setCajaActionTrigger] = useState<{ tipo: 'entrada' | 'salida' | 'cierre'; ts: number } | null>(null);



  // 🔒 Iron-Clad: wrapper de sync con estado + alerta si cierran mientras sincroniza
  const syncWithCloudTracked = async () => {
    setIsSyncing(true);
    try { await syncWithCloud(); } finally { setIsSyncing(false); }
  };

  useEffect(() => {
    if (!isSyncing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Hay una sincronización en curso. ¿Seguro que quieres cerrar?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSyncing]);

  // Efecto para redirigir si no hay usuario
  useEffect(() => {
    if (!isAuthLoading && !user && currentView !== 'login') {
      setCurrentView('login');
    } else if (!isAuthLoading && user && currentView === 'login') {
      setCurrentView('dashboard');
    }
  }, [user, isAuthLoading, currentView]);

  if (isAuthLoading || !loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-t-2 border-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/logo.png" className="w-12 h-12 object-contain" alt="Logo" />
          </div>
        </div>
        <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando Dulce Placer</p>
      </div>
    );
  }

  const renderView = () => {
    // Si hay usuario activo pero la vista es login → redirigir inmediatamente al dashboard
    if (user && currentView === 'login') return null;
    if (!user && currentView !== 'login') return <Login onLoginSuccess={() => setCurrentView('dashboard')} />;

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            estadisticas={estadisticas}
            alertas={alertas}
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
            nombre={user?.nombre}
          />
        );
      case 'proveedores':
        return (
          <Proveedores
            proveedores={proveedores}
            productos={productos}
            precios={precios}
            categorias={configuracion.categorias}
            onAddProveedor={addProveedor}
            onUpdateProveedor={updateProveedor}
            onDeleteProveedor={deleteProveedor}
            onAddProducto={addProducto}
            onUpdateProducto={updateProducto}
            onDeleteProducto={deleteProducto}
            onAddOrUpdatePrecio={addOrUpdatePrecio}
            onDeletePrecio={deletePrecio}
            onAjustarStock={onAjustarStock}
            getPreciosByProveedor={(id) => precios.filter(p => p.proveedorId === id)}
            getProductoById={getProductoById}
            formatCurrency={formatCurrency}
            prepedidos={prepedidos}
            inventario={inventario}
            produccion={produccion}
            recetas={recetas}
            onAddPrePedido={addPrePedido}
            onUpdatePrePedido={updatePrePedido}
            onAddItem={addItemToPrePedido}
            onRemoveItem={removeItemFromPrePedido}
            onUpdateItemCantidad={updateItemCantidad}
            getProveedorById={getProveedorById}
            getMejorPrecioByProveedor={(prod, prov) => precios.find(p => p.productoId === prod && p.proveedorId === prov)}
          />
        );
      case 'historial-ventas':
        return (
          <HistorialVentas 
            ventas={ventas}
            productos={productos}
            sesionesCaja={sesionesCaja}
            proveedores={proveedores}
            precios={precios}
            formatCurrency={formatCurrency}
            getProductoById={getProductoById}
          />
        );
      case 'roles':
        return <RoleManager />;
      case 'oficina':
        return (
          <Oficina
            onViewChange={setCurrentView}
            publicAppUrl={configuracion.publicUrl}
            ventas={ventas}
            productos={productos}
            inventario={inventario as any}
            sesionesCaja={sesionesCaja}
            creditosClientes={creditosClientes}
            gastos={gastos}
            formatCurrency={formatCurrency}
          />
        );
      case 'listapreciosproincial':
        return (
          <ListaPreciosProvincial 
            productos={productos}
            inventario={inventario as any}
            categorias={configuracion.categorias}
            formatCurrency={formatCurrency}
          />
        );
      case 'productos':
        return (
          <Productos 
            productos={productos}
            proveedores={proveedores}
            precios={precios}
            categorias={configuracion.categorias}
            inventario={inventario}
            onAddProducto={addProducto}
            onUpdateProducto={updateProducto}
            onDeleteProducto={deleteProducto}
            onAddCategoria={addCategoria}
            onDeleteCategoria={deleteCategoria}
            onUpdateCategoria={updateCategoria}
            onAddOrUpdatePrecio={addOrUpdatePrecio}
            onDeletePrecio={deletePrecio}
            getMejorPrecio={getMejorPrecio}
            getPreciosByProducto={getPreciosByProducto}
            getProveedorById={getProveedorById}
            formatCurrency={formatCurrency}
          />
        );
      case 'ventas':
        return (
          <Ventas 
            productos={productos}
            inventario={inventario}
            ventas={ventas}
            cajaActiva={cajaActiva}
            onCerrarCaja={cerrarCaja}
            onAbrirCaja={(monto) => abrirCaja(user?.id || '', Number(monto))}
            onFinalizarTurno={cerrarCaja}
            onRegistrarVenta={registrarVenta}
            onAddCreditoCliente={addCreditoCliente}
            creditosClientes={creditosClientes}
            formatCurrency={formatCurrency}
            usuario={user}
            clientes={clientes}
            categorias={configuracion.categorias}
            onRegistrarMovimientoCaja={registrarMovimientoCaja}
            mesas={mesas}
            pedidosActivos={pedidosActivos}
            onUpdateMesa={updateMesa}
            onAddMesa={addMesa}
            onDeleteMesa={deleteMesa}
            onAddPedidoActivo={onAddPedidoActivo}
            onUpdatePedidoActivo={onUpdatePedidoActivo}
            onDeletePedidoActivo={onDeletePedidoActivo}
            onUpdateProducto={updateProducto}
            onAjustarStock={onAjustarStock}
            cajaActionTrigger={cajaActionTrigger}
            onCajaActionConsumed={() => setCajaActionTrigger(null)}
          />
        );
      case 'caja':
        return (
          <ControlCaja 
            sesiones={sesionesCaja}
            cajaActiva={cajaActiva}
            ventas={ventas}
            onAbrirCaja={(monto) => abrirCaja(user?.id || '', Number(monto))}
            onCerrarCaja={cerrarCaja}
            onRegistrarMovimiento={registrarMovimientoCaja}
            formatCurrency={formatCurrency}
          />
        );
      case 'inventario':
        return (
          <Inventario 
            productos={productos}
            inventario={inventario}
            movimientos={movimientos}
            categorias={configuracion.categorias}
            precios={precios}
            onAjustarStock={onAjustarStock}
            getProductoById={getProductoById}
            formatCurrency={formatCurrency}
            onGenerarSugerencias={onGenerarSugerencias}
            onViewPrePedidos={() => setCurrentView('prepedidos')}
          />
        );
      case 'produccion':
        return (
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
            onNavigateTo={(view: any) => setCurrentView(view)}
            configuracion={configuracion}
          />
        );
      case 'recetas':
        return (
          <Recetas 
            productos={productos}
            recetas={recetas}
            formulaciones={formulaciones}
            modelosPan={modelosPan}
            getMejorPrecio={getMejorPrecio}
            getProductoById={getProductoById}
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
          />
        );
      case 'ahorro':
        return <Ahorros ahorros={ahorros} ventas={ventas} formatCurrency={formatCurrency} />;
      case 'creditos':
        return (
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
            usuario={user!}
            productos={productos}
            trabajadores={trabajadores}
            clientes={clientes}
            ventas={ventas}
            onAddCliente={addCliente}
          />
        );
      case 'trabajadores':
        return (
          <Trabajadores
            trabajadores={trabajadores}
            onAddTrabajador={addTrabajador}
            onUpdateTrabajador={updateTrabajador}
            onDeleteTrabajador={deleteTrabajador}
            creditosTrabajadores={creditosTrabajadores}
            onAddCreditoTrabajador={addCreditoTrabajador}
            onUpdateCreditoTrabajador={updateCreditoTrabajador}
            onDeleteCreditoTrabajador={deleteCreditoTrabajador}
            onRegistrarPagoCreditoTrabajador={registrarPagoCreditoTrabajador}
            usuario={user!}
            formatCurrency={formatCurrency}
          />
        );
      case 'asistencia':
        return (
          <Asistencia
            trabajadores={trabajadores}
            asistencia={asistencia}
            onAddRegistro={addRegistroAsistencia}
          />
        );
      case 'nomina':
        return (
          <Nomina
            trabajadores={trabajadores}
            asistencia={asistencia}
            creditosTrabajadores={creditosTrabajadores as any}
            nominas={nominas}
            onAddNomina={addNomina}
            onUpdateNomina={updateNomina}
            onAddGasto={addGasto}
            onAddCreditoTrabajador={addCreditoTrabajador as any}
            onUpdateCreditoTrabajador={updateCreditoTrabajador as any}
            onDeleteCreditoTrabajador={deleteCreditoTrabajador}
            formatCurrency={formatCurrency}
            onBack={() => setCurrentView('trabajadores')}
          />
        );
      case 'gastos':
        return (
          <Gastos 
            gastos={gastos}
            proveedores={proveedores}
            cajaActiva={cajaActiva}
            onAddGasto={addGasto}
            onDeleteGasto={deleteGasto}
            onUpdateGasto={updateGasto}
            formatCurrency={formatCurrency}
            usuario={user!}
          />
        );
      case 'mayoristas':
        return <Mayoristas 
          productos={productos} 
          precios={precios} 
          clientes={clientes} 
          addCliente={addCliente}
          updateCliente={updateCliente}
          deleteCliente={deleteCliente}
          getMejorPrecio={getMejorPrecio} 
          formatCurrency={formatCurrency} 
          onNavigateTo={(view: any) => setCurrentView(view)} 
          cajaActiva={cajaActiva}
          registrarVenta={registrarVenta}
          creditosClientes={creditosClientes}
          addCreditoCliente={addCreditoCliente}
          updateCreditoCliente={updateCreditoCliente}
          deleteCreditoCliente={deleteCreditoCliente}
          registrarPagoCredito={registrarPagoCredito}
        />;
      case 'reportes':
        return (
          <Reportes 
            ventas={ventas}
            gastos={gastos}
            productos={productos}
            generarReporte={generarReporte}
            formatCurrency={formatCurrency}
          />
        );
      case 'precios':
        return (
          <Precios 
            productos={productos}
            precios={precios}
            proveedores={proveedores}
            historial={historialPrecios}
            onAddOrUpdatePrecio={addOrUpdatePrecio}
            onDeletePrecio={deletePrecio}
            getPrecioByIds={(prodId, provId) => precios.find(p => p.productoId === prodId && p.proveedorId === provId)}
            getProductoById={getProductoById}
            getProveedorById={getProveedorById}
            formatCurrency={formatCurrency}
          />
        );
      case 'cargamasiva':
        return (
          <CargaMasiva 
            productos={productos}
            proveedores={proveedores}
            categorias={configuracion.categorias}
            onAddProducto={addProducto}
            onAddProveedor={addProveedor}
            onAddCategoria={addCategoria}
            onAddOrUpdatePrecio={addOrUpdatePrecio}
            formatCurrency={formatCurrency}
          />
        );
      case 'alertas':
        return (
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
        );
      case 'prepedidos':
        return (
          <PrePedidos 
            prepedidos={prepedidos}
            proveedores={proveedores}
            productos={productos}
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
            getMejorPrecioByProveedor={(prod, prov) => precios.find(p => p.productoId === prod && p.proveedorId === prov)}
            getPreciosByProveedor={(id) => precios.filter(p => p.proveedorId === id)}
            formatCurrency={formatCurrency}
            onAjustarStock={onAjustarStock}
            onGenerarSugerencias={() => Promise.resolve(0)}
          />
        );
      case 'recepciones':
        return (
          <Recepciones
            recepciones={recepciones}
            prepedidos={prepedidos}
            proveedores={proveedores}
            productos={productos}
            precios={precios}
            categorias={configuracion.categorias}
            onAddRecepcion={onAddRecepcion}
            onConfirmarRecepcion={async (recepcion) => {
              const pedidoVinculado = prepedidos.find(p => p.id === recepcion.prePedidoId);
              await onConfirmarRecepcion(recepcion, pedidoVinculado);
            }}
            onAddProducto={addProducto}
            onUpdateProducto={updateProducto}
            getProductoById={getProductoById}
            getProveedorById={getProveedorById}
            formatCurrency={formatCurrency}
          />
        );
      case 'configuracion':
        return (
          <Configuracion 
            configuracion={configuracion}
            onUpdateConfiguracion={updateConfiguracion}
            onSyncWithCloud={syncWithCloudTracked}
            onClearAllData={async () => {
              if (confirm('¿Estás seguro de que deseas borrar TODOS los datos? Esta acción es irreversible.')) {
                await clearAllData();
                window.location.reload();
              }
            }}
          />
        );
      case 'usuarios':
        return <Usuarios />;
      case 'agentes-ia':
        return <AgentesIA />;
      case 'clientes':
        return <Clientes
          clientesExternos={clientes}
          onAddCliente={addCliente}
          onUpdateCliente={updateCliente}
          onDeleteCliente={deleteCliente}
        />;
      case 'comunicaciones':
        return <Comunicaciones />;
      case 'seguridad':
        return <Seguridad userRole={user?.rol} ventas={ventas} />;
      case 'login':
        return <Login onLoginSuccess={() => setCurrentView('dashboard')} />;
      default:
        return (
          <Dashboard 
            estadisticas={estadisticas}
            alertas={alertas}
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
            nombre={user?.nombre}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      {user && (
        <Sidebar 
          currentView={currentView}
          onViewChange={setCurrentView}
          alertasNoLeidas={alertas.filter(a => !a.leida).length}
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
      )}

      <main className={cn(
        "transition-all duration-300",
        user ? (isSidebarCollapsed ? "md:pl-20" : "md:pl-64") : "pl-0",
        currentView === 'ventas' ? 'h-screen overflow-hidden' : ''
      )}>
        {/* Header Superior (Solo si hay usuario) */}
        {user && (
          <header className="sticky top-0 z-40 w-full h-16 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 pl-16 pr-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
               {/* Breadcrumbs dinámicos */}
               <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">/</span >
                  <span className="text-slate-900 dark:text-white text-xs font-black uppercase tracking-widest capitalize">
                    {currentView.replace('-', ' ')}
                  </span>
               </div>
            </div>

            <div className="flex items-center gap-4">
               {/* 🚀 Mando Superior (IA) — Acceso Rápido Premium */}
               {check('VER_DASHBOARD') && (
                 <button
                   onClick={() => setCurrentView('agentes-ia')}
                   className={cn(
                     "relative h-10 px-4 rounded-xl flex items-center gap-2.5 transition-all group overflow-hidden border",
                     currentView === 'agentes-ia'
                       ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                       : "bg-slate-900/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-indigo-400/50"
                   )}
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="relative flex items-center gap-2">
                     <BrainCircuit className={cn("w-4 h-4", currentView === 'agentes-ia' ? "text-white" : "text-indigo-500")} />
                     <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Mando Superior</span>
                   </div>
                   {/* Indicador de actividad IA */}
                   <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                 </button>
               )}

               <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block" />

               {/* Botones de Caja — solo visibles en POS con caja abierta */}
               {currentView === 'ventas' && cajaActiva && (
                 <div className="flex items-center gap-1">
                   <button
                     onClick={() => setCajaActionTrigger({ tipo: 'entrada', ts: Date.now() })}
                     className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-all"
                     title="Entrada de caja"
                   >
                     <ArrowUpCircle className="w-3.5 h-3.5" />
                     <span className="text-[9px] font-black uppercase tracking-tight">Entrada</span>
                   </button>
                   <button
                     onClick={() => setCajaActionTrigger({ tipo: 'salida', ts: Date.now() })}
                     className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-all"
                     title="Salida de caja"
                   >
                     <ArrowDownCircle className="w-3.5 h-3.5" />
                     <span className="text-[9px] font-black uppercase tracking-tight">Salida</span>
                   </button>
                   <button
                     onClick={() => setCajaActionTrigger({ tipo: 'cierre', ts: Date.now() })}
                     className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                     title="Cerrar caja"
                   >
                     <LogOut className="w-3.5 h-3.5" />
                     <span className="text-[9px] font-black uppercase tracking-tight">Cerrar Caja</span>
                   </button>
                 </div>
               )}
               {/* Modo Oscuro */}
               <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
               >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
               </button>

               {/* info Usuario */}
               <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
                  <div className="text-right flex flex-col justify-center">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1">{user.nombre}</p>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter leading-none">{user.rol}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20">
                    {user.nombre.charAt(0)}
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
               </div>
            </div>
          </header>
        )}

        <div className={currentView === 'ventas' ? 'h-[calc(100vh-4rem)] overflow-hidden' : 'p-4 md:p-8'}>
          <ErrorBoundary moduleName={currentView}>
            <Suspense fallback={<PageLoader />}>
              <PageTransition viewKey={currentView} className={currentView === 'ventas' ? 'h-full min-h-0' : ''}>
                {renderView()}
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Footer Táctico — oculto en POS para máximo espacio */}
        {user && currentView !== 'ventas' && (
          <footer className="min-h-10 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-2 text-[9px] text-slate-400 uppercase tracking-widest font-black shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3" />
                <span>Nexus-Vault: <span className="text-indigo-600">READY</span></span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-4">
                <ShieldCheck className="w-3 h-3" />
                <span>Integridad: <span className="text-emerald-500">VERIFIED</span></span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isSyncing ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-amber-600 font-black">SINCRONIZANDO...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-emerald-600 font-black">SYNC ACTIVE</span>
                </div>
              )}
              <span className="opacity-50">NEXUS-ARMAGEDDON v5.4.0 | © 2026 Antigravity Systems</span>
            </div>
          </footer>
        )}
      </main>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
};

export default App;
