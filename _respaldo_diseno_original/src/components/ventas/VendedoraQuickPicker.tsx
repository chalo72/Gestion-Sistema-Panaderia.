/**
 * VendedoraQuickPicker — Selector rápido de vendedora activa
 * Un toque = asigna. Toca de nuevo = deselecciona (vuelve a Por Venta).
 * Solo muestra trabajadoras con rol VENDEDOR.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { UserCheck } from 'lucide-react';

export interface VendedoraOption {
  id: string;
  nombre: string;
  rol?: string;
}

interface VendedoraQuickPickerProps {
  vendedoras: VendedoraOption[];
  activaId: string | null;
  onSelect: (vendedora: VendedoraOption | null) => void;
  tabLabel?: string;
  compact?: boolean;
  className?: string;
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

const CHIP_COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-pink-500',
];
function getColor(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}

export function VendedoraQuickPicker({
  vendedoras, activaId, onSelect, tabLabel, compact = false, className
}: VendedoraQuickPickerProps) {
  if (vendedoras.length === 0) return null;

  const activaNombre = vendedoras.find(v => v.id === activaId)?.nombre ?? null;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {/* Fila de chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {!compact && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
            <UserCheck className="w-3.5 h-3.5" /> Vendiendo:
          </span>
        )}
        {vendedoras.map(v => {
          const isActiva = v.id === activaId;
          const color = getColor(v.nombre);
          const initials = getInitials(v.nombre);
          const firstName = v.nombre.split(' ')[0];

          return (
            <button
              key={v.id}
              onClick={() => onSelect(isActiva ? null : v)}
              title={isActiva ? `Deseleccionar a ${v.nombre}` : `Asignar venta a ${v.nombre}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full transition-all active:scale-95 select-none',
                compact
                  ? 'h-8 px-3 text-xs font-black'
                  : 'h-9 px-3 text-[11px] font-black',
                isActiva
                  ? 'ring-2 ring-offset-1 ring-orange-400 shadow-lg shadow-orange-500/20 scale-105 bg-white dark:bg-slate-800 text-slate-800 dark:text-white'
                  : 'opacity-60 hover:opacity-90 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              )}
            >
              <span className={cn(
                'rounded-full flex items-center justify-center text-white font-black shrink-0',
                color,
                compact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
              )}>
                {initials}
              </span>
              <span className="truncate max-w-[80px]">{firstName}</span>
              {isActiva && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Indicador de estado — solo visible cuando hay vendedora asignada */}
      {activaId && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          {activaNombre?.split(' ')[0]} — asignada a {tabLabel || 'esta venta'}
        </div>
      )}
    </div>
  );
}

// ─── Modal rápido para seleccionar vendedora al abrir mesa ──────────────────

interface VendedoraMesaModalProps {
  vendedoras: VendedoraOption[];
  onSelect: (vendedora: VendedoraOption | null) => void;
  mesaNumero?: string;
}

export function VendedoraMesaModal({ vendedoras, onSelect, mesaNumero }: VendedoraMesaModalProps) {
  if (vendedoras.length <= 1) {
    React.useEffect(() => { onSelect(vendedoras[0] || null); }, []);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 w-80 mx-4 animate-in zoom-in-95 duration-150">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-6 h-6 text-orange-500" />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-white">
            ¿Quién atiende{mesaNumero ? ` la Mesa ${mesaNumero}` : ''}?
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Toca tu nombre para continuar</p>
        </div>

        <div className="space-y-2">
          {vendedoras.map(v => {
            const color = getColor(v.nombre);
            const initials = getInitials(v.nombre);
            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-[0.98] group"
              >
                <span className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0',
                  color
                )}>
                  {initials}
                </span>
                <span className="text-sm font-black text-slate-800 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {v.nombre}
                </span>
                <span className="ml-auto text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg">→</span>
              </button>
            );
          })}

          <button
            onClick={() => onSelect(null)}
            className="w-full py-3 rounded-2xl text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Continuar sin asignar (Por Venta)
          </button>
        </div>
      </div>
    </div>
  );
}
