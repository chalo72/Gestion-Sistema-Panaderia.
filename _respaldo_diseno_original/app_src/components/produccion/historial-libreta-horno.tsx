/**
 * Historial de la Libreta del Horno — misma fuente que Reportes (dp_producciones_diarias).
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChefHat, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getProducciones,
  normalizarFechaYYYYMMDD,
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

type Props = {
  /** Máximo de días a mostrar (por defecto 14) */
  limite?: number;
  className?: string;
};

/**
 * Lista el historial de panes ya guardado (Reportes / Libreta) dentro de Producción.
 */
export function HistorialLibretaHorno({ limite = 14, className }: Props) {
  const [items, setItems] = useState<RegistroProduccion[]>(() => getProducciones().slice(0, limite));

  const refrescar = useCallback(() => {
    setItems(getProducciones().slice(0, limite));
  }, [limite]);

  useEffect(() => {
    refrescar();
    const onChange = () => refrescar();
    window.addEventListener('dp_producciones_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('dp_producciones_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refrescar]);

  return (
    <Card className={cn('rounded-2xl border-amber-500/20 shadow-lg overflow-hidden', className)}>
      <CardHeader className="bg-amber-500/5 border-b border-amber-500/15 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <ChefHat className="w-5 h-5 text-amber-600" />
              Historial de panes (misma libreta)
            </CardTitle>
            <CardDescription className="text-xs font-medium mt-1">
              Lo que ya está en Reportes → Historial de Panes también aparece aquí. No son dos libretas distintas.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={refrescar}
            className="shrink-0 h-9 w-9 rounded-xl"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-2 max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-bold text-slate-500">Aún no hay registros en la libreta</p>
            <p className="text-xs text-muted-foreground px-4">
              Usa <strong>Anotar en Libreta</strong> y luego <strong>Guardar en Libreta</strong>.
              También verás aquí lo que anotes en Historial de Panes.
            </p>
          </div>
        ) : (
          items.map((p) => {
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
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 px-3 py-3 space-y-1.5"
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
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">
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
                    Masa: {masas}
                  </p>
                )}
                {panesResumen && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {panesResumen}
                    {(p.hornadas || []).filter((h) => (Number(h.totalPanes) || 0) > 0).length > 4 && '…'}
                  </p>
                )}
                {p.notas && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{p.notas}</p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
