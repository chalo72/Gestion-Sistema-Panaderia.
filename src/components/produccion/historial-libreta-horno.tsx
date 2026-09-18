/**
 * Historial de la Libreta del Horno — misma fuente que Reportes (dp_producciones_diarias).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChefHat, RefreshCw, Search, X, Sparkles, Wheat, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  fechaLocalHoy,
  getProducciones,
  normalizarFechaYYYYMMDD,
  sincronizarProduccionesConNube,
  type RegistroProduccion,
} from '@/lib/finanzas-personales';
import { cn } from '@/lib/utils';

const formatFechaEs = (yyyyMmDd: string): string => {
  const [y, m, d] = normalizarFechaYYYYMMDD(yyyyMmDd).split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const fecha = new Date(y, m - 1, d, 12, 0, 0);
  return fecha.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const totalPanes = (p: RegistroProduccion): number =>
  (p.hornadas || []).reduce((s, h) => s + (Number(h.totalPanes) || 0), 0);

const totalArrobas = (p: RegistroProduccion): number =>
  (p.masas || []).reduce((s, m) => s + (Number(m.cantidadArrobas) || 0), 0);

type RangoFecha = 'hoy' | 'ayer' | 'semana' | 'todos' | 'personalizado';

type Props = {
  /** Máximo de días a mostrar cuando no hay filtro específico */
  limite?: number;
  className?: string;
};

/**
 * Lista el historial de panes ya guardado (Reportes / Libreta) dentro de Producción
 * con buscador en tiempo real, filtro rápido por fecha y totalizadores estadísticos.
 */
export function HistorialLibretaHorno({ limite = 40, className }: Props) {
  const [items, setItems] = useState<RegistroProduccion[]>(() => getProducciones());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroFecha, setFiltroFecha] = useState<RangoFecha>('todos');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [sincronizando, setSincronizando] = useState(false);

  const refrescar = useCallback(() => {
    setItems(getProducciones());
  }, []);

  const sincronizarManual = useCallback(async () => {
    setSincronizando(true);
    try {
      const data = await sincronizarProduccionesConNube();
      setItems(data);
    } finally {
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
    sincronizarProduccionesConNube().then(data => setItems(data)).catch(() => {});
    const onChange = () => refrescar();
    window.addEventListener('dp_producciones_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('dp_producciones_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refrescar]);

  // Fechas de referencia
  const hoyStr = fechaLocalHoy();
  const ayerStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }, []);

  const hace7DiasStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }, []);

  // Filtrado reactivo por término y fecha
  const itemsFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return items.filter((p) => {
      const fechaNorm = normalizarFechaYYYYMMDD(p.fecha);

      // Filtro por fecha
      if (filtroFecha === 'hoy' && fechaNorm !== hoyStr) return false;
      if (filtroFecha === 'ayer' && fechaNorm !== ayerStr) return false;
      if (filtroFecha === 'semana' && fechaNorm < hace7DiasStr) return false;
      if (filtroFecha === 'personalizado') {
        if (fechaInicio && fechaNorm < fechaInicio) return false;
        if (fechaFin && fechaNorm > fechaFin) return false;
      }

      // Filtro por buscador (nombre de pan, masa o notas)
      if (q) {
        const masaMatch = (p.masas || []).some((m) =>
          (m.nombre || '').toLowerCase().includes(q)
        );
        const panMatch = (p.hornadas || []).some((h) =>
          (h.tipoPan || '').toLowerCase().includes(q)
        );
        const notasMatch = (p.notas || '').toLowerCase().includes(q);
        const fechaMatch = (p.fecha || '').toLowerCase().includes(q);

        if (!masaMatch && !panMatch && !notasMatch && !fechaMatch) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchTerm, filtroFecha, hoyStr, ayerStr, hace7DiasStr, fechaInicio, fechaFin]);

  // Resumen totalizador en el rango y término filtrado
  const totales = useMemo(() => {
    let arrobas = 0;
    let panes = 0;
    let hornadasCount = 0;

    for (const p of itemsFiltrados) {
      arrobas += totalArrobas(p);
      panes += totalPanes(p);
      hornadasCount += (p.hornadas || []).filter((h) => (Number(h.totalPanes) || 0) > 0).length;
    }

    return {
      arrobas: Math.round(arrobas * 10) / 10,
      panes,
      hornadasCount,
      registros: itemsFiltrados.length,
    };
  }, [itemsFiltrados]);

  // Limitar visualmente si hay demasiados registros y no hay filtro activo
  const itemsAMostrar = useMemo(() => {
    if (searchTerm.trim() || filtroFecha !== 'todos') {
      return itemsFiltrados;
    }
    return itemsFiltrados.slice(0, limite);
  }, [itemsFiltrados, searchTerm, filtroFecha, limite]);

  return (
    <Card className={cn('rounded-2xl border-amber-500/20 shadow-lg overflow-hidden', className)}>
      <CardHeader className="bg-amber-500/5 border-b border-amber-500/15 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <ChefHat className="w-5 h-5 text-amber-600" />
              Historial de Libreta del Horno
            </CardTitle>
            <CardDescription className="text-xs font-medium mt-1">
              Registro histórico y métricas de producción unificadas con Reportes.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={sincronizarManual}
            disabled={sincronizando}
            className="shrink-0 h-9 w-9 rounded-xl text-amber-700 hover:bg-amber-500/10"
            title="Sincronizar con la nube (Supabase)"
          >
            <RefreshCw className={cn("w-4 h-4", sincronizando && "animate-spin text-amber-500")} />
          </Button>
        </div>

        {/* Barra de Búsqueda y Filtro de Fechas */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por pan, masa o fecha (ej: hojaldre, francés)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-white dark:bg-slate-900 border-amber-500/30 rounded-xl focus-visible:ring-amber-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Botones de rango rápido */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <Button
              type="button"
              variant={filtroFecha === 'hoy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFecha('hoy')}
              className={cn(
                'h-7 px-2.5 text-xs rounded-lg font-bold shrink-0',
                filtroFecha === 'hoy'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-amber-500/10 border-slate-300 dark:border-slate-700'
              )}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant={filtroFecha === 'ayer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFecha('ayer')}
              className={cn(
                'h-7 px-2.5 text-xs rounded-lg font-bold shrink-0',
                filtroFecha === 'ayer'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-amber-500/10 border-slate-300 dark:border-slate-700'
              )}
            >
              Ayer
            </Button>
            <Button
              type="button"
              variant={filtroFecha === 'semana' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFecha('semana')}
              className={cn(
                'h-7 px-2.5 text-xs rounded-lg font-bold shrink-0',
                filtroFecha === 'semana'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-amber-500/10 border-slate-300 dark:border-slate-700'
              )}
            >
              Esta Semana
            </Button>
            <Button
              type="button"
              variant={filtroFecha === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFecha('todos')}
              className={cn(
                'h-7 px-2.5 text-xs rounded-lg font-bold shrink-0',
                filtroFecha === 'todos'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-amber-500/10 border-slate-300 dark:border-slate-700'
              )}
            >
              Todos ({items.length})
            </Button>
            <Button
              type="button"
              variant={filtroFecha === 'personalizado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFecha('personalizado')}
              className={cn(
                'h-7 px-2.5 text-xs rounded-lg font-bold shrink-0',
                filtroFecha === 'personalizado'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-amber-500/10 border-slate-300 dark:border-slate-700'
              )}
            >
              Rango...
            </Button>
          </div>
          {filtroFecha === 'personalizado' && (
            <div className="flex items-center gap-2 pt-2 animate-in slide-in-from-top-1 fade-in duration-200">
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-500/30"
                title="Fecha inicial"
              />
              <span className="text-slate-400 text-xs font-bold">a</span>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-500/30"
                title="Fecha final"
              />
            </div>
          )}
        </div>

        {/* Tarjetas de Resumen Totalizador */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 rounded-xl p-2 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Wheat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Arrobas</span>
            </div>
            <p className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 mt-0.5">
              {totales.arrobas} <span className="text-xs font-semibold">@</span>
            </p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 rounded-xl p-2 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Panes</span>
            </div>
            <p className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
              {totales.panes.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 border border-orange-500/20 rounded-xl p-2 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-orange-800 dark:text-orange-300">
              <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>Hornadas</span>
            </div>
            <p className="text-base sm:text-lg font-black text-orange-950 dark:text-orange-100 mt-0.5">
              {totales.hornadasCount} <span className="text-xs font-normal text-muted-foreground">({totales.registros} d)</span>
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 space-y-2 max-h-[460px] overflow-y-auto">
        {itemsFiltrados.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-bold text-slate-500">
              {searchTerm || filtroFecha !== 'todos'
                ? 'No se encontraron registros con los filtros seleccionados'
                : 'Aún no hay registros en la libreta'}
            </p>
            <p className="text-xs text-muted-foreground px-4">
              {searchTerm || filtroFecha !== 'todos' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFiltroFecha('todos');
                  }}
                  className="text-amber-600 hover:underline font-bold"
                >
                  Restablecer filtros de búsqueda
                </button>
              ) : (
                <>
                  Usa <strong>Anotar en Libreta</strong> y luego <strong>Guardar en Libreta</strong>.
                  También verás aquí lo que anotes en Historial de Panes.
                </>
              )}
            </p>
          </div>
        ) : (
          itemsAMostrar.map((p) => {
            const panes = totalPanes(p);
            const arrobas = totalArrobas(p);
            const masas = (p.masas || []).map((m) => m.nombre).filter(Boolean).join(', ');
            const panesResumen = (p.hornadas || [])
              .filter((h) => (Number(h.totalPanes) || 0) > 0)
              .map((h) => `${h.tipoPan || 'Pan'}: ${h.totalPanes}`)
              .slice(0, 4)
              .join(' · ');

            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 px-3 py-3 space-y-1.5 transition-colors hover:border-amber-500/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate capitalize">
                      {formatFechaEs(p.fecha)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {arrobas > 0 && (
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 border-amber-500/30">
                        {arrobas} @
                      </Badge>
                    )}
                    <Badge className="bg-emerald-600 text-white text-[10px] font-black border-none">
                      {panes} panes
                    </Badge>
                  </div>
                </div>
                {masas && (
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                    Masa: <span className="text-amber-700 dark:text-amber-400">{masas}</span>
                  </p>
                )}
                {panesResumen && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {panesResumen}
                    {(p.hornadas || []).filter((h) => (Number(h.totalPanes) || 0) > 0).length > 4 && '…'}
                  </p>
                )}
                {p.notas && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 italic">“{p.notas}”</p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
