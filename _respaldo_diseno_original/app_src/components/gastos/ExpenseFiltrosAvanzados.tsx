import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Proveedor } from '@/types';
import {
  CATEGORIAS_FILTRO,
  FILTROS_GASTOS_VACIOS,
  ID_SIN_PROVEEDOR,
  METODOS_FILTRO,
  type FiltrosGastos,
  type PeriodoPreset,
} from '@/lib/gastos-totales';

interface ExpenseFiltrosAvanzadosProps {
  filtros: FiltrosGastos;
  onChange: (f: FiltrosGastos) => void;
  proveedores: Proveedor[];
}

const PERIODOS: { value: PeriodoPreset; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
  { value: 'rango', label: 'Rango' },
  { value: 'todo', label: 'Todo' },
];

function hayFiltrosActivos(f: FiltrosGastos): boolean {
  return Boolean(
    f.proveedorId ||
    f.categoria ||
    f.metodoPago ||
    f.estado ||
    (f.tipo && f.tipo !== 'ambos') ||
    (f.busqueda && f.busqueda.trim()) ||
    f.periodo !== 'todo',
  );
}

export function ExpenseFiltrosAvanzados({ filtros, onChange, proveedores }: ExpenseFiltrosAvanzadosProps) {
  const [abierto, setAbierto] = useState(false);
  const activos = hayFiltrosActivos(filtros);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
          <Filter className="w-4 h-4 text-rose-500" />
          Filtros avanzados
          {activos && (
            <span className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600">
              Activos
            </span>
          )}
        </span>
        {abierto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Periodo</p>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onChange({ ...filtros, periodo: p.value })}
                  className={cn(
                    'h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border',
                    filtros.periodo === p.value
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {filtros.periodo === 'rango' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Desde
                <input
                  type="date"
                  value={filtros.fechaDesde || ''}
                  onChange={(e) => onChange({ ...filtros, fechaDesde: e.target.value, periodo: 'rango' })}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
                />
              </label>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Hasta
                <input
                  type="date"
                  value={filtros.fechaHasta || ''}
                  onChange={(e) => onChange({ ...filtros, fechaHasta: e.target.value, periodo: 'rango' })}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Proveedor
              <select
                value={filtros.proveedorId || ''}
                onChange={(e) => onChange({ ...filtros, proveedorId: e.target.value || null })}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
              >
                <option value="">Todos</option>
                <option value={ID_SIN_PROVEEDOR}>Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Categoría
              <select
                value={filtros.categoria || ''}
                onChange={(e) => onChange({ ...filtros, categoria: e.target.value || null })}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
              >
                <option value="">Todas</option>
                {CATEGORIAS_FILTRO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Método de pago
              <select
                value={filtros.metodoPago || ''}
                onChange={(e) => onChange({ ...filtros, metodoPago: e.target.value || null })}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
              >
                <option value="">Todos</option>
                {METODOS_FILTRO.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Estado
              <select
                value={filtros.estado || ''}
                onChange={(e) => onChange({
                  ...filtros,
                  estado: (e.target.value || null) as FiltrosGastos['estado'],
                })}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
              >
                <option value="">Pagados y pendientes</option>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulado">Anulado</option>
              </select>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 sm:col-span-2">
              Tipo
              <select
                value={filtros.tipo || 'ambos'}
                onChange={(e) => onChange({
                  ...filtros,
                  tipo: e.target.value as FiltrosGastos['tipo'],
                })}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-bold"
              >
                <option value="ambos">Egresos e ingresos</option>
                <option value="egresos">Solo egresos</option>
                <option value="ingresos">Solo ingresos</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...FILTROS_GASTOS_VACIOS })}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
