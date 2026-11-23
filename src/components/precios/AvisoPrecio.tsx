import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tieneProblemaGrave, type ProblemaPrecio } from '@/lib/precio-inconsistente';

/**
 * Aviso de precio de venta para revisar (2026-11-23). Rojo si puede hacer perder plata,
 * ámbar si es para revisar. Muestra el primer motivo y, al pasar el dedo/mouse, todos.
 */
export function AvisoPrecio({ problemas, className }: { problemas: ProblemaPrecio[]; className?: string }) {
  if (problemas.length === 0) return null;
  const grave = tieneProblemaGrave(problemas);
  const todos = problemas.map(p => p.texto).join(' · ');
  return (
    <span title={todos} aria-label={`Revisar precio: ${todos}`}
      className={cn('inline-flex items-center gap-1 max-w-full rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight',
        grave ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
        className)}>
      <AlertTriangle className="w-3 h-3 shrink-0" />
      <span className="truncate">{problemas[0].texto}</span>
      {problemas.length > 1 && <span className="shrink-0">+{problemas.length - 1}</span>}
    </span>
  );
}
