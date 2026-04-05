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
  BarChart3,
  History,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon,
  Upload,
  CreditCard,
  UserCircle2,
  Store,
  Building2
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  permission: string;
}

interface MenuGroup {
  section: string;
  emoji: string;
  items: MenuItem[];
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
  formatCurrency,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const { check, role } = useCan();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const allMenuGroups: MenuGroup[] = [
    {
      section: 'Inicio',
      emoji: '🏛️', // Icono de oficina central/gobierno
      items: [
        { id: 'dashboard',   label: 'Centro de Mando', icon: LayoutDashboard, permission: 'VER_DASHBOARD' },
        { id: 'agentes-ia',  label: 'Mando Superior (IA)', icon: Shield,    permission: 'VER_DASHBOARD' }, // Usamos Shield para denotar control y seguridad
      ],
    },
    {
      section: 'Operación Diaria',
      emoji: '💰',
      items: [
        { id: 'ventas',          label: 'Ventas / POS',         icon: ShoppingCart, permission: 'VER_VENTAS' },
        { id: 'historial-ventas',label: 'Historial de Ventas',  icon: History,      permission: 'VER_VENTAS' },
        { id: 'caja',            label: 'Control de Caja',      icon: Wallet,       permission: 'ABRIR_CERRAR_CAJA' },
        { id: 'creditos',        label: 'Créditos a Clientes',  icon: CreditCard,   permission: 'VER_FINANZAS' },
      ],
    },
    {
      section: 'Producción',
      emoji: '🍞',
      items: [
        { id: 'produccion', label: 'Producción de Pan',  icon: Utensils,  permission: 'VER_PRODUCTOS' },
        { id: 'recetas',    label: 'Recetas Técnicas',   icon: ChefHat,   permission: 'VER_PRODUCTOS' },
        { id: 'inventario', label: 'Inventario',         icon: Warehouse, permission: 'VER_INVENTARIO' },
      ],
    },
    {
      section: 'Compras',
      emoji: '🛒',
      items: [
        { id: 'proveedores',  label: 'Gestión de Proveedores', icon: Truck,          permission: 'VER_PROVEEDORES' },
        { id: 'prepedidos',   label: 'Órdenes de Compra',      icon: ShoppingCart,   permission: 'VER_PREPEDIDOS' },
        { id: 'recepciones',  label: 'Entrada de Mercancía',   icon: ClipboardCheck, permission: 'VER_RECEPCIONES' },
      ],
    },
    {
      section: 'Costos y Finanzas',
      emoji: '📊',
      items: [
        { id: 'precios',   label: 'Historial de Costos',  icon: DollarSign, permission: 'VER_PRECIOS' },
        { id: 'alertas',   label: 'Alertas de Costos',    icon: Bell,       permission: 'VER_ALERTAS' },
        { id: 'gastos',    label: 'Egresos y Facturas',   icon: DollarSign, permission: 'VER_FINANZAS' },
        { id: 'reportes',  label: 'Análisis Financiero',  icon: BarChart3,  permission: 'VER_FINANZAS' },
        { id: 'ahorro',      label: 'Mis Ahorros',          icon: PiggyBank,  permission: 'VER_FINANZAS' },
        { id: 'mayoristas',  label: 'Ventas al Mayor',      icon: Store,      permission: 'VER_FINANZAS' },
      ],
    },
    {
      section: 'Catálogo',
      emoji: '🗂️',
      items: [
        { id: 'productos',   label: 'Productos',    icon: Package, permission: 'VER_PRODUCTOS' },
        { id: 'cargamasiva', label: 'Carga Masiva', icon: Upload,  permission: 'CREAR_PRODUCTOS' },
      ],
    },
    {
      section: 'Administración',
      emoji: '👥',
      items: [
        { id: 'oficina',       label: 'Oficina del Equipo', icon: Building2,   permission: 'VER_USUARIOS' },
        { id: 'trabajadores',  label: 'Trabajadores',       icon: UserCircle2, permission: 'VER_USUARIOS' },
        { id: 'usuarios',      label: 'Equipo de Trabajo',  icon: Users,       permission: 'VER_USUARIOS' },
        { id: 'roles',         label: 'Seguridad y Roles',  icon: Shield,      permission: 'VER_USUARIOS' },
        { id: 'configuracion', label: 'Configuración',      icon: Settings,    permission: 'VER_CONFIGURACION' },
      ],
    },
  ];

  // Filtrar por permisos — omitir secciones vacías
  const menuGroups = allMenuGroups
    .map(g => ({ ...g, items: g.items.filter(i => check(i.permission as any)) }))
    .filter(g => g.items.length > 0);

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full w-full bg-[#0f172a] text-white overflow-hidden">
      {/* Logo Section */}
      <div className={cn(
        "flex-none p-6 border-b border-white/[0.06] transition-all duration-300",
        isCollapsed && !isMobile ? "p-4 flex flex-col items-center" : ""
      )}>
        <div className="flex items-center gap-3">
          {/* Logo con anillos orbitales */}
          <div className={cn(
            "relative flex-none transition-all",
            isCollapsed && !isMobile ? "w-10 h-10" : "w-12 h-12"
          )}>
            {/* Anillo exterior — 4s horario, rosa */}
            <div
              className="absolute inset-0 rounded-full border border-transparent animate-spin"
              style={{ animationDuration: '4s', borderTopColor: 'rgba(255,0,127,0.7)', borderRightColor: 'rgba(255,0,127,0.15)' }}
            />
            {/* Anillo interior — 2.4s antihorario, indigo */}
            <div
              className="absolute inset-[3px] rounded-full border border-transparent animate-spin"
              style={{ animationDuration: '2.4s', animationDirection: 'reverse', borderTopColor: 'rgba(99,102,241,0.8)', borderRightColor: 'rgba(99,102,241,0.15)' }}
            />
            {/* Logo centrado flotando */}
            <div className="absolute inset-0 flex items-center justify-center animate-ag-float">
              <img src="/logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain drop-shadow-[0_0_8px_rgba(255,0,127,0.5)]" />
            </div>
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="flex-1 min-w-0 animate-ag-fade-in">
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Gestion Panaderia</h1>
              <h1 className="text-sm font-extrabold text-[#ff007f] tracking-tight leading-tight">Dulce Placer</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">v5.1-NEXUS • {role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle Button (Desktop only) */}
      {!isMobile && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-[#ff007f] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-[60] border-2 border-[#0f172a]"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </button>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-4 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent overflow-x-hidden">
        {(!isCollapsed || isMobile) && (
          <div className="animate-ag-fade-in">
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
          </div>
        )}

        {/* Menu por secciones */}
        <nav className="space-y-2">
          {menuGroups.map((group, gi) => (
            <div key={group.section}>
              {/* Etiqueta de sección — oculta cuando está colapsado */}
              {(!isCollapsed || isMobile) && (
                <div className="flex items-center gap-2 px-1 pt-1 pb-1.5 select-none">
                  <span className="text-base leading-none">{group.emoji}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    {group.section}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.08]" />
                </div>
              )}

              {/* Items del grupo — dentro de tarjeta */}
              <div className={cn(
                "rounded-xl border border-white/[0.07] overflow-hidden",
                (!isCollapsed || isMobile) ? "bg-white/[0.03]" : "bg-transparent border-transparent"
              )}>
                <ul className="p-1 space-y-0.5">
                  {group.items.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <li key={item.id} style={{ animationDelay: `${(gi * 5 + index) * 30}ms` }}>
                        <button
                          type="button"
                          title={isCollapsed && !isMobile ? item.label : undefined}
                          onClick={() => { onViewChange(item.id); if (isMobile) setOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                            isCollapsed && !isMobile ? "px-2 justify-center" : "",
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
                              : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0",
                            isActive ? "bg-white/20" : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                          )}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          {(!isCollapsed || isMobile) && (
                            <span className="font-medium text-[13px] truncate">{item.label}</span>
                          )}
                          {(!isCollapsed || isMobile) && item.id === 'alertas' && alertasNoLeidas > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-ag-pulse-glow">
                              {alertasNoLeidas}
                            </span>
                          )}
                          {isActive && (!isCollapsed || isMobile) && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-l-full" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className={cn(
        "flex-none p-4 border-t border-white/[0.06] bg-[#0f172a] transition-all",
        isCollapsed && !isMobile ? "p-2 items-center" : ""
      )}>
        {(!isCollapsed || isMobile) ? (
          <div className="text-xs text-slate-500 text-center space-y-1 animate-ag-fade-in">
            <p className="font-semibold text-[#ff007f]/80">Panaderia Dulce Placer</p>
            <p>v5.1-NEXUS • {role}</p>
          </div>
        ) : (
          <div className="flex justify-center text-[8px] font-bold text-[#ff007f]">DP</div>
        )}
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
    <aside className={cn(
      "fixed left-0 top-0 h-full border-r border-white/10 bg-[#0f172a] z-50 hidden md:block transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {renderSidebarContent()}
    </aside>
  );
}
