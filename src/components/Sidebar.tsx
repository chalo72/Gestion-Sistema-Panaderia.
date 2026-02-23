import {
  LayoutDashboard,
  Package,
  Truck,
  Bell,
  Settings,
  ShoppingCart,
  Users,
  DollarSign,
  Warehouse,
  ClipboardCheck,
  Menu,
  Shield,
  ChefHat,
  Utensils,
  Wallet,
  PiggyBank,
  BarChart3
} from 'lucide-react';
import { BusquedaRapida } from './BusquedaRapida';
import { useCan } from '@/contexts/AuthContext';
import type { ViewType } from '@/types';
import { cn } from '@/lib/utils';
import type { Producto, Proveedor, PrecioProveedor } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  alertasNoLeidas: number;
  productos: Producto[];
  proveedores: Proveedor[];
  precios: PrecioProveedor[];
  getMejorPrecio: (productoId: string) => PrecioProveedor | null;
  getPreciosByProducto: (productoId: string) => PrecioProveedor[];
  getProveedorById: (id: string) => Proveedor | undefined;
  formatCurrency: (value: number) => string;
}

interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  permission: string;
}

export function Sidebar({
  currentView,
  onViewChange,
  alertasNoLeidas,
  productos,
  proveedores,
  precios,
  getMejorPrecio,
  getPreciosByProducto,
  getProveedorById,
  formatCurrency
}: SidebarProps) {
  const { check, role } = useCan();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const allMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Centro de Mando', icon: LayoutDashboard, permission: 'VER_DASHBOARD' },
    { id: 'ventas', label: 'Ventas / POS', icon: ShoppingCart, permission: 'VER_VENTAS' },
    { id: 'caja', label: 'Control de Caja', icon: Wallet, permission: 'ABRIR_CERRAR_CAJA' },
    { id: 'gastos', label: 'Egresos y Facturas', icon: DollarSign, permission: 'VER_FINANZAS' },
    { id: 'reportes', label: 'Análisis Financiero', icon: BarChart3, permission: 'VER_FINANZAS' },
    { id: 'ahorro', label: 'Mis Ahorros', icon: PiggyBank, permission: 'VER_FINANZAS' },
    { id: 'productos', label: 'Catálogo de Productos', icon: Package, permission: 'VER_PRODUCTOS' },
    { id: 'inventario', label: 'Inventario de Materias', icon: Warehouse, permission: 'VER_INVENTARIO' },
    { id: 'recetas', label: 'Recetas y Escandallos', icon: ChefHat, permission: 'VER_PRODUCTOS' },
    { id: 'prepedidos', label: 'Órdenes de Compra', icon: ShoppingCart, permission: 'VER_PREPEDIDOS' },
    { id: 'proveedores', label: 'Mis Proveedores', icon: Truck, permission: 'VER_PROVEEDORES' },
    { id: 'precios', label: 'Historial de Precios', icon: DollarSign, permission: 'VER_PRECIOS' },
    { id: 'recepciones', label: 'Entrada de Mercancía', icon: ClipboardCheck, permission: 'VER_RECEPCIONES' },
    { id: 'alertas', label: 'Alertas de Costos', icon: Bell, permission: 'VER_ALERTAS' },
    { id: 'usuarios', label: 'Equipo de Trabajo', icon: Users, permission: 'VER_USUARIOS' },
    { id: 'roles', label: 'Seguridad y Roles', icon: Shield, permission: 'VER_USUARIOS' },
    { id: 'configuracion', label: 'Configuración', icon: Settings, permission: 'VER_CONFIGURACION' },
  ];

  const menuItems = allMenuItems.filter(item => check(item.permission as any));

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full w-full bg-[#0f172a] text-white">
      {/* Logo */}
      <div className="flex-none p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-transparent drop-shadow-[0_0_10px_rgba(255,0,127,0.3)] animate-ag-float">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Gestion Panaderia</h1>
            <h1 className="text-sm font-extrabold text-[#ff007f] tracking-tight leading-tight">Dulce Placer</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">v5.0 • {role}</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-4 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <BusquedaRapida
          productos={productos}
          proveedores={proveedores}
          precios={precios}
          getMejorPrecio={getMejorPrecio}
          getPreciosByProducto={getPreciosByProducto}
          getProveedorById={getProveedorById}
          formatCurrency={formatCurrency}
        />

        <div className="border-t border-white/[0.06] my-3"></div>

        {/* Menu Items */}
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id} className={`animate-ag-fade-in stagger-${index + 1}`}>
                <button
                  type="button"
                  onClick={() => {
                    onViewChange(item.id);
                    if (isMobile) setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-ag group relative",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-ag",
                    isActive
                      ? "bg-white/20"
                      : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.id === 'alertas' && alertasNoLeidas > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-ag-pulse-glow">
                      {alertasNoLeidas}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-l-full" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="flex-none p-4 border-t border-white/[0.06] bg-[#0f172a]">
        <div className="text-xs text-slate-500 text-center space-y-1">
          <p className="font-semibold text-[#ff007f]/80">Panaderia Dulce Placer</p>
          <p>Ctrl+K para buscar</p>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-md border shadow-sm">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 border-r border-white/10 bg-[#0f172a] flex flex-col">
          {renderSidebarContent()}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/10 bg-[#0f172a] z-50 hidden md:block">
      {renderSidebarContent()}
    </aside>
  );
}
