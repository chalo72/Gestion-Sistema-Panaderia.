import { useMemo } from 'react';
import { CheckCircle2, Circle, CheckCheck, XCircle, Package, Users, Factory, DollarSign, Truck, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Producto, Trabajador, Gasto } from '@/types';

export type ItemSeleccionable = {
  id: string;
  etiqueta: string;
  detalle?: string;
  monto?: number;
  seleccionado: boolean;
};

export type SeleccionCrear = {
  productos: ItemSeleccionable[];
  competidores: ItemSeleccionable[];
  procesos: ItemSeleccionable[];
  equipo: ItemSeleccionable[];
  costosFijos: ItemSeleccionable[];
  inversiones: ItemSeleccionable[];
};

type GrupoKey = keyof SeleccionCrear;

const META_GRUPO: Record<
  GrupoKey,
  { titulo: string; ayuda: string; icon: typeof Package }
> = {
  productos: {
    titulo: '5. Productos o servicios',
    ayuda:
      'Marque las líneas del ERP o del plan que entran al expediente. El Excel pide máximo 3 productos principales: use esto para elegir cuáles respaldan esas tres líneas (nombre, unidad y presentación).',
    icon: Package,
  },
  competidores: {
    titulo: '3. Competencia',
    ayuda:
      'Incluya o quite competidores del expediente. Deben ser los mismos del punto 3 (nombre, fortalezas y debilidades) y alimentar Módulos 1-3.',
    icon: Factory,
  },
  procesos: {
    titulo: '6. Proceso técnico',
    ayuda:
      'Seleccione los pasos del proceso que quiere mostrar (insumos → horneado → venta/ruta). Deben cuadrar con productos y con la inversión pedida.',
    icon: Layers,
  },
  equipo: {
    titulo: '11. Equipo de trabajo',
    ayuda:
      'Elija cargos o trabajadores activos del ERP que entran al plan. Esto alimenta el indicador de empleos del Fondo Emprender.',
    icon: Users,
  },
  costosFijos: {
    titulo: '10. Costos fijos (desde gastos ERP)',
    ayuda:
      'Marque categorías de gasto reales que cuentan como costo fijo del plan. Solo lo marcado suma en el total del punto 10 y en el Modelo financiero.',
    icon: DollarSign,
  },
  inversiones: {
    titulo: '12–13. Necesidades / inversión',
    ayuda:
      'Seleccione rubros a solicitar al Fondo Emprender (horno, móvil, etc.). El total seleccionado es el valor de la iniciativa del punto 13.',
    icon: Truck,
  },
};

type Props = {
  seleccion: SeleccionCrear;
  onChange: (next: SeleccionCrear) => void;
  formatCurrency: (n: number) => string;
};

export function CrearSeleccionDatos({ seleccion, onChange, formatCurrency }: Props) {
  const toggle = (grupo: GrupoKey, id: string) => {
    onChange({
      ...seleccion,
      [grupo]: seleccion[grupo].map((item) =>
        item.id === id ? { ...item, seleccionado: !item.seleccionado } : item
      ),
    });
  };

  const setTodos = (grupo: GrupoKey, valor: boolean) => {
    onChange({
      ...seleccion,
      [grupo]: seleccion[grupo].map((item) => ({ ...item, seleccionado: valor })),
    });
  };

  const resumen = useMemo(() => {
    const contar = (g: GrupoKey) => seleccion[g].filter((i) => i.seleccionado).length;
    const sumar = (g: GrupoKey) =>
      seleccion[g].filter((i) => i.seleccionado).reduce((s, i) => s + (Number(i.monto) || 0), 0);
    return {
      productos: contar('productos'),
      competidores: contar('competidores'),
      procesos: contar('procesos'),
      equipo: contar('equipo'),
      costosFijos: contar('costosFijos'),
      inversiones: contar('inversiones'),
      montoInversion: sumar('inversiones'),
      montoCostos: sumar('costosFijos'),
    };
  }, [seleccion]);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-emerald-900 dark:text-emerald-200">
            Seleccionar / deseleccionar datos del plan
          </CardTitle>
          <CardDescription>
            Toca cada ítem para incluirlo o quitarlo del expediente. Solo lo marcado entra a los totales de costos (§10),
            inversión (§12–13) y al Generar Plan. Los productos salen del ERP; competidores y procesos del plan escrito arriba.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{resumen.productos}</p>
            <p className="text-muted-foreground">Productos</p>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{resumen.competidores}</p>
            <p className="text-muted-foreground">Competidores</p>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{resumen.procesos}</p>
            <p className="text-muted-foreground">Procesos</p>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{resumen.equipo}</p>
            <p className="text-muted-foreground">Equipo</p>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(resumen.montoCostos)}</p>
            <p className="text-muted-foreground">Costos fijos</p>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/50 p-2 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(resumen.montoInversion)}</p>
            <p className="text-muted-foreground">Inversión</p>
          </div>
        </CardContent>
      </Card>

      {(Object.keys(META_GRUPO) as GrupoKey[]).map((grupo) => {
        const meta = META_GRUPO[grupo];
        const Icon = meta.icon;
        const items = seleccion[grupo];
        const marcados = items.filter((i) => i.seleccionado).length;
        return (
          <Card key={grupo} className="border-slate-200 dark:border-white/10 bg-white dark:bg-card/40">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <Icon className="w-4 h-4 text-emerald-600" />
                    {meta.titulo}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">{meta.ayuda}</CardDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground mr-1">
                    {marcados}/{items.length}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] font-black uppercase gap-1"
                    onClick={() => setTodos(grupo, true)}
                    disabled={items.length === 0}
                  >
                    <CheckCheck className="w-3 h-3" /> Todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] font-black uppercase gap-1"
                    onClick={() => setTodos(grupo, false)}
                    disabled={items.length === 0}
                  >
                    <XCircle className="w-3 h-3" /> Ninguno
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Sin opciones en este bloque.</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(grupo, item.id)}
                    className={cn(
                      'w-full text-left rounded-xl border px-3 py-2.5 transition-colors flex items-start gap-2',
                      item.seleccionado
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-600'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
                    )}
                  >
                    {item.seleccionado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.etiqueta}</p>
                      {item.detalle ? (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.detalle}</p>
                      ) : null}
                    </div>
                    {typeof item.monto === 'number' && item.monto > 0 ? (
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                        {formatCurrency(item.monto)}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** Construye la selección inicial mezclando Excel/PDF + datos vivos del ERP. */
export const construirSeleccionCrear = (args: {
  productosErp: Producto[];
  trabajadores: Trabajador[];
  gastos: Gasto[];
  competidoresBase: Array<{ nombre: string; fortalezas?: string; debilidades?: string }>;
  procesosBase: string[];
  productosBase: Array<{ nombre: string; descripcion?: string }>;
  cotizaciones: Array<{ item: string; proveedor?: string; valor: string }>;
  previa?: SeleccionCrear | null;
}): SeleccionCrear => {
  const prevMap = (grupo: GrupoKey) => {
    const map = new Map<string, boolean>();
    (args.previa?.[grupo] ?? []).forEach((i) => map.set(i.id, i.seleccionado));
    return map;
  };

  const prevProd = prevMap('productos');
  const elaborados = (args.productosErp || []).filter((p) => p.tipo === 'elaborado');
  const productosErpItems: ItemSeleccionable[] = elaborados.slice(0, 40).map((p, idx) => ({
    id: `erp-prod-${p.id}`,
    etiqueta: p.nombre,
    detalle: `ERP · ${p.categoria || 'Sin categoría'} · venta ${Number(p.precioVenta) || 0}`,
    monto: Number(p.precioVenta) || 0,
    seleccionado: prevProd.has(`erp-prod-${p.id}`)
      ? Boolean(prevProd.get(`erp-prod-${p.id}`))
      : idx < 3,
  }));

  // Si no hay ERP, usa líneas del Excel/PDF
  const productos =
    productosErpItems.length > 0
      ? productosErpItems
      : args.productosBase.map((p, idx) => ({
          id: `base-prod-${idx}`,
          etiqueta: p.nombre,
          detalle: p.descripcion,
          seleccionado: prevMap('productos').has(`base-prod-${idx}`)
            ? Boolean(prevMap('productos').get(`base-prod-${idx}`))
            : true,
        }));

  const competidores = args.competidoresBase.map((c, idx) => {
    const id = `comp-${idx}-${c.nombre}`;
    return {
      id,
      etiqueta: c.nombre,
      detalle: c.debilidades || c.fortalezas,
      seleccionado: prevMap('competidores').has(id) ? Boolean(prevMap('competidores').get(id)) : true,
    };
  });

  const procesos = args.procesosBase.map((paso, idx) => {
    const id = `proc-${idx}`;
    return {
      id,
      etiqueta: `Paso ${idx + 1}`,
      detalle: paso,
      seleccionado: prevMap('procesos').has(id) ? Boolean(prevMap('procesos').get(id)) : true,
    };
  });

  const activos = (args.trabajadores || []).filter((t) => String(t.estado).toLowerCase() === 'activo');
  const equipo: ItemSeleccionable[] =
    activos.length > 0
      ? activos.map((t, idx) => {
          const id = `trab-${t.id}`;
          return {
            id,
            etiqueta: t.nombre,
            detalle: `${t.rol || 'Sin rol'}${t.salarioBase ? ` · salario base` : ''}`,
            monto: Number(t.salarioBase) || 0,
            seleccionado: prevMap('equipo').has(id) ? Boolean(prevMap('equipo').get(id)) : idx < 4,
          };
        })
      : [
          {
            id: 'equipo-admin',
            etiqueta: 'Administrador (Emprendedor)',
            detalle: 'Liderazgo y gestión',
            seleccionado: true,
          },
          {
            id: 'equipo-panadero-1',
            etiqueta: 'Panadero',
            detalle: 'Producción',
            seleccionado: true,
          },
          {
            id: 'equipo-panadero-2',
            etiqueta: 'Panadero',
            detalle: 'Producción',
            seleccionado: true,
          },
          {
            id: 'equipo-ruta',
            etiqueta: 'Conductor / Vendedor ruta',
            detalle: 'Panadería móvil',
            seleccionado: true,
          },
        ].map((i) => ({
          ...i,
          seleccionado: prevMap('equipo').has(i.id) ? Boolean(prevMap('equipo').get(i.id)) : i.seleccionado,
        }));

  // Agrupa gastos por categoría (últimos 90 días approx: todos los cargados)
  const porCat = new Map<string, number>();
  (args.gastos || []).forEach((g) => {
    if ((g as { estado?: string }).estado === 'anulado') return;
    const cat = (g.categoria || 'Otros').trim() || 'Otros';
    porCat.set(cat, (porCat.get(cat) || 0) + (Number(g.monto) || 0));
  });
  const costosFijos: ItemSeleccionable[] =
    porCat.size > 0
      ? Array.from(porCat.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([cat, monto]) => {
            const id = `gasto-${cat}`;
            return {
              id,
              etiqueta: cat,
              detalle: 'Acumulado en gastos del ERP',
              monto,
              seleccionado: prevMap('costosFijos').has(id)
                ? Boolean(prevMap('costosFijos').get(id))
                : true,
            };
          })
      : [];

  const inversiones = args.cotizaciones.map((c, idx) => {
    const id = `inv-${idx}-${c.item}`;
    return {
      id,
      etiqueta: c.item,
      detalle: c.proveedor || 'Proveedor',
      monto: parseFloat(c.valor) || 0,
      seleccionado: prevMap('inversiones').has(id) ? Boolean(prevMap('inversiones').get(id)) : true,
    };
  });

  return { productos, competidores, procesos, equipo, costosFijos, inversiones };
};
