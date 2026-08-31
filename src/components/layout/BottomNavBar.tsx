import { LayoutDashboard, ShoppingCart, DollarSign, Bell } from 'lucide-react';
import type { ViewType } from '@/types';
import { cn } from '@/lib/utils';
import { useCan } from '@/contexts/AuthContext';
import { usePermisosModulos } from '@/hooks/usePermisosModulos';
import { puedeAccederVista } from '@/lib/view-guards';

interface BottomNavBarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  alertasNoLeidas: number;
  onOpenMenu?: () => void;
}

export function BottomNavBar({ currentView, onViewChange, alertasNoLeidas, onOpenMenu }: BottomNavBarProps) {
  const { isAdmin, role, check } = useCan();
  const { puedeVer } = usePermisosModulos();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Inicio',
      icon: LayoutDashboard,
      view: 'dashboard' as ViewType,
    },
    {
      id: 'ventas',
      label: 'Ventas',
      icon: ShoppingCart,
      view: 'ventas' as ViewType,
    },
    {
      id: 'caja',
      label: 'Caja',
      icon: DollarSign,
      view: 'caja' as ViewType,
    },
    {
      id: 'alertas',
      label: 'Alertas',
      icon: Bell,
      view: 'alertas' as ViewType,
      badge: alertasNoLeidas > 0 ? alertasNoLeidas : undefined,
    },
  ];

  // Filtrar los items a los que el usuario tiene acceso
  const visibleItems = navItems.filter((item) =>
    puedeAccederVista(item.view, { isAdmin, role, check, puedeVer })
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800/50 md:hidden flex items-center justify-around pb-safe pt-2 px-2 h-[72px]">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.view;

        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.view)}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200",
              isActive ? "text-indigo-400" : "text-slate-400 hover:text-slate-300"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-all duration-300",
              isActive ? "bg-indigo-500/20 scale-110" : "bg-transparent"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={cn(
              "text-[10px] font-medium transition-all duration-300",
              isActive ? "font-bold" : ""
            )}>
              {item.label}
            </span>

            {/* Badge para Alertas */}
            {item.badge !== undefined && (
              <span className="absolute top-1 right-[20%] flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        );
      })}

      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 text-slate-400 hover:text-slate-300"
        >
          <div className="p-1.5 rounded-xl transition-all duration-300 bg-transparent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </div>
          <span className="text-[10px] font-medium transition-all duration-300">
            Menú
          </span>
        </button>
      )}
    </div>
  );
}
