import { LayoutDashboard, ShoppingCart, Wallet, ChefHat, Menu } from 'lucide-react';
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
      icon: Wallet,
      view: 'caja' as ViewType,
    },
    {
      id: 'produccion',
      label: role === 'PANADERO' ? 'Horno' : 'Producción',
      icon: ChefHat,
      view: 'produccion' as ViewType,
    },
  ];

  // Filtrar los items a los que el usuario tiene acceso
  const visibleItems = navItems.filter((item) =>
    puedeAccederVista(item.view, { isAdmin, role, check, puedeVer })
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/92 backdrop-blur-xl border-t border-slate-800/80 md:hidden flex items-center justify-around px-2 min-h-[68px] h-[calc(68px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.view;

        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.view)}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full py-1 transition-all duration-200 active:scale-95 select-none",
              isActive ? "text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200 font-medium"
            )}
          >
            {isActive && (
              <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
            )}
            <div className={cn(
              "p-1.5 rounded-xl transition-all duration-300",
              isActive
                ? "bg-amber-500/15 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-105"
                : "bg-transparent text-slate-400"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">
              {item.label}
            </span>
          </button>
        );
      })}

      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center w-full h-full py-1 transition-all duration-200 active:scale-95 select-none text-slate-400 hover:text-slate-200 font-medium"
        >
          <div className="p-1.5 rounded-xl transition-all duration-300 bg-transparent text-slate-400">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">
            Menú
          </span>
        </button>
      )}
    </div>
  );
}
