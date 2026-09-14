import { CalendarDays, CalendarRange, Calendar, Store, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PeriodoPreset, TotalesPeriodo, TotalProveedor } from '@/lib/gastos-totales';

interface ExpenseResumenProps {
  hoy: TotalesPeriodo;
  semana: TotalesPeriodo;
  mes: TotalesPeriodo;
  anio: TotalesPeriodo;
  proveedores: TotalProveedor[];
  periodoActivo: PeriodoPreset;
  proveedorActivo: string | null;
  formatCurrency: (v: number) => string;
  onSeleccionarPeriodo: (p: PeriodoPreset) => void;
  onSeleccionarProveedor: (id: string | null) => void;
}

const LABEL_PERIODO: Partial<Record<PeriodoPreset, string>> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  anio: 'Este año',
  todo: 'Todos los gastos',
  rango: 'Rango personalizado',
};

export function ExpenseResumen({
  hoy,
  semana,
  mes,
  anio,
  proveedores,
  periodoActivo,
  proveedorActivo,
  formatCurrency,
  onSeleccionarPeriodo,
  onSeleccionarProveedor,
}: ExpenseResumenProps) {
  const totalDelPeriodoActivo =
    periodoActivo === 'hoy' ? hoy.egresos
    : periodoActivo === 'semana' ? semana.egresos
    : periodoActivo === 'anio' ? anio.egresos
    : periodoActivo === 'todo' || periodoActivo === 'rango'
      ? proveedores.reduce((s, p) => s + p.total, 0)
      : mes.egresos;

  const top = proveedores[0];
  const pctTop = totalDelPeriodoActivo > 0 && top
    ? Math.round((top.total / totalDelPeriodoActivo) * 100)
    : 0;

  const cards = [
    {
      key: 'hoy' as const,
      titulo: 'Hoy',
      sub: 'Gastos del día',
      valor: hoy.egresos,
      regs: hoy.registros,
      icon: Sun,
      tono: 'from-emerald-500/15 to-emerald-500/5 border-emerald-400/30 text-emerald-700 dark:text-emerald-300',
    },
    {
      key: 'semana' as const,
      titulo: 'Esta semana',
      sub: 'Lunes a domingo',
      valor: semana.egresos,
      regs: semana.registros,
      icon: CalendarDays,
      tono: 'from-sky-500/15 to-sky-500/5 border-sky-400/30 text-sky-700 dark:text-sky-300',
    },
    {
      key: 'mes' as const,
      titulo: 'Este mes',
      sub: 'Mes en curso',
      valor: mes.egresos,
      regs: mes.registros,
      icon: Calendar,
      tono: 'from-rose-500/15 to-rose-500/5 border-rose-400/30 text-rose-700 dark:text-rose-300',
    },
    {
      key: 'anio' as const,
      titulo: 'Este año',
      sub: 'Enero a hoy',
      valor: anio.egresos,
      regs: anio.registros,
      icon: CalendarRange,
      tono: 'from-violet-500/15 to-violet-500/5 border-violet-400/30 text-violet-700 dark:text-violet-300',
    },
  ];

  const etiquetaActiva = LABEL_PERIODO[periodoActivo] || 'Periodo';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const activo = periodoActivo === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSeleccionarPeriodo(c.key)}
              className={cn(
                'text-left rounded-2xl border bg-gradient-to-br p-4 min-h-[96px] transition-all',
                c.tono,
                activo ? 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 ring-current' : 'opacity-90 hover:opacity-100',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{c.titulo}</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                {formatCurrency(c.valor)}
              </p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                {c.sub} · {c.regs} reg.
              </p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (top) onSeleccionarProveedor(proveedorActivo === top.proveedorId ? null : top.proveedorId);
          }}
          className={cn(
            'text-left rounded-2xl border bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-400/30 text-amber-800 dark:text-amber-300 p-4 min-h-[96px]',
            proveedorActivo && top && proveedorActivo === top.proveedorId
              ? 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 ring-amber-500'
              : '',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Top proveedor</span>
          </div>
          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
            {top ? top.nombre : 'Sin compras'}
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            {top
              ? `${formatCurrency(top.total)} · ${pctTop}% de ${etiquetaActiva.toLowerCase()}`
              : 'Toca una ficha de periodo'}
          </p>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          Detalle: <span className="text-rose-600 dark:text-rose-400">{etiquetaActiva}</span>
          {' · '}
          {formatCurrency(totalDelPeriodoActivo)}
        </p>
        <button
          type="button"
          onClick={() => {
            onSeleccionarPeriodo('todo');
            onSeleccionarProveedor(null);
          }}
          className={cn(
            'h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border',
            periodoActivo === 'todo' && !proveedorActivo
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700',
          )}
        >
          Ver todo el listado
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Gasto por proveedor · {etiquetaActiva}
          </p>
          <p className="text-xs font-medium text-slate-400 mt-0.5">Toca una fila para filtrar el detalle abajo</p>
        </div>
        {proveedores.length === 0 ? (
          <p className="px-4 py-6 text-sm font-bold text-slate-400">No hay egresos en este periodo.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {proveedores.map((p) => {
              const activo = proveedorActivo === p.proveedorId;
              const pct = totalDelPeriodoActivo > 0
                ? Math.round((p.total / totalDelPeriodoActivo) * 100)
                : 0;
              return (
                <li key={p.proveedorId}>
                  <button
                    type="button"
                    onClick={() => onSeleccionarProveedor(activo ? null : p.proveedorId)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      activo && 'bg-amber-50 dark:bg-amber-950/30',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{p.nombre}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {p.registros} {p.registros === 1 ? 'registro' : 'registros'} · {pct}%
                      </p>
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white shrink-0">
                      {formatCurrency(p.total)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
