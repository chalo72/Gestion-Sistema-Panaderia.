import { useState, useEffect } from 'react';
import { 
  LogOut, 
  Sun, 
  Moon,
  LayoutDashboard,
  ShieldCheck,
  Database
} from 'lucide-react';

import { usePriceControl } from '@/hooks/usePriceControl';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/layout/PageTransition';
import type { ViewType } from '@/types';

// Páginas
import Dashboard from '@/pages/Dashboard';
import Productos from '@/pages/Productos';
import { Ventas } from '@/pages/Ventas';
import Inventario from '@/pages/Inventario';
import PrePedidos from '@/pages/PrePedidos';
import Recepciones from '@/pages/Recepciones';
import { Alertas } from '@/pages/Alertas';
import { Produccion } from '@/pages/Produccion';
import Recetas from '@/pages/Recetas';
import Configuracion from '@/pages/Configuracion';
import { Usuarios } from '@/pages/Usuarios';
import RoleManager from '@/pages/RoleManager';
import { ControlCaja } from '@/pages/ControlCaja';
import Ahorros from '@/pages/Ahorros';
import CreditosClientes from '@/pages/CreditosClientes';
import { Login } from '@/pages/Login';
import AgentesIA from '@/pages/AgentesIA';
import HistorialVentas from '@/pages/HistorialVentas';
import Oficina from '@/pages/Oficina';
import Trabajadores from '@/pages/Trabajadores';
import Gastos from '@/pages/Gastos';
import Proveedores from '@/pages/Proveedores';
import Mayoristas from '@/pages/Mayoristas';
import Reportes from '@/pages/Reportes';
import Precios from '@/pages/Precios';
import CargaMasiva from '@/pages/CargaMasiva';
import ListaPreciosProvincial from '@/pages/ListaPreciosProvincial';

const App = () => {
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
    generarReporte
  } = usePriceControl();

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        return <Oficina onViewChange={setCurrentView} publicAppUrl={configuracion.publicUrl} />;
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
            formatCurrency={formatCurrency}
            usuario={user}
            categorias={configuracion.categorias}
            onRegistrarMovimientoCaja={registrarMovimientoCaja}
            mesas={[]} // placeholder
            pedidosActivos={pedidosActivos}
            onUpdateMesa={async (m) => {}} // Placeholder
            onAddPedidoActivo={onAddPedidoActivo}
            onUpdatePedidoActivo={onUpdatePedidoActivo}
            onDeletePedidoActivo={onDeletePedidoActivo}
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
        return <Mayoristas productos={productos} precios={precios} getMejorPrecio={getMejorPrecio} formatCurrency={formatCurrency} />;
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
            categorias={configuracion.categorias}
            onAddRecepcion={onAddRecepcion}
            onConfirmarRecepcion={async (r) => {}} // Placeholder si no hay hook
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
            onSyncWithCloud={syncWithCloud}
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
        user ? (isSidebarCollapsed ? "pl-20" : "pl-64") : "pl-0"
      )}>
        {/* Header Superior (Solo si hay usuario) */}
        {user && (
          <header className="sticky top-0 z-40 w-full h-16 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between">
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

            <div className="flex items-center gap-6">
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

        <div className="p-8">
          <PageTransition viewKey={currentView}>
            {renderView()}
          </PageTransition>
        </div>

        {/* Footer Táctico */}
        {user && (
          <footer className="h-10 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-8 flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-widest font-black shrink-0">
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
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-600 font-black">SYNC ACTIVE</span>
              </div>
              <span className="opacity-50">© 2026 Antigravity Systems</span>
            </div>
          </footer>
        )}
      </main>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
};

export default App;
