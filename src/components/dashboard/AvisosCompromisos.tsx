import { BellRing } from 'lucide-react';
import { avisosCompromisos, getCompromisos } from '@/lib/finanzas-personales';
import { cn } from '@/lib/utils';
import { useCan } from '@/contexts/AuthContext';

/** Aviso del centro de mando: un compromiso fijo cayó en su fecha aproximada.
 *  Solo lo ve el dueño. Los otros roles no deben ver lo que él tiene por pagar. */
export function AvisosCompromisos({ formatCurrency, onIr }: {
  formatCurrency: (n: number) => string;
  onIr?: () => void;
}) {
  const { isAdmin, role } = useCan();
  const veCompromisos = isAdmin || role === 'GERENTE';
  const avisos = avisosCompromisos(getCompromisos());
  if (!veCompromisos || avisos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
      <p className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <BellRing className="w-4 h-4" /> Compromisos por pagar
      </p>
      {avisos.slice(0, 4).map(a => (
        <button
          key={`${a.compromiso.id}-${a.diaObjetivo}`}
          type="button"
          onClick={onIr}
          className={cn(
            'w-full text-left rounded-xl px-3 py-2 border',
            a.estado === 'vencido' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' : 'bg-white/80 dark:bg-slate-900/50 border-amber-200/80 dark:border-amber-800/40'
          )}
        >
          <p className="text-sm font-black text-slate-900 dark:text-white">{a.compromiso.nombre} · {formatCurrency(a.compromiso.monto)}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">{a.mensaje}</p>
        </button>
      ))}
      <p className="text-[10px] text-amber-800/80 dark:text-amber-200/70">
        La fecha es aproximada (± días). Márcalo como pagado en Reportes → Compromiso fijo.
      </p>
    </div>
  );
}
