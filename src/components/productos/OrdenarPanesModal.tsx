import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Producto, ModeloPan, Categoria, FormulacionBase } from '@/types';
import {
  CATEGORIAS_PAN_OPCIONES, sugerirCategoriaPan, planOrdenPanes, type FilaModelo,
} from '@/lib/clasificar-panes';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  productos: Producto[];
  modelosPan: ModeloPan[];
  formulaciones: FormulacionBase[];
  categorias: Categoria[];
  categoriaGeneral?: string;
  onAddCategoria: (nombre: string, color: string, tipo: 'venta' | 'insumo') => Promise<unknown> | void;
  onAddProducto: (p: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
  onUpdateProducto: (id: string, updates: Partial<Producto>) => void | Promise<void>;
  onUpdateModelo?: (id: string, updates: Partial<ModeloPan>) => void | Promise<void>;
}

const norm = (s: string) => (s || '').toLowerCase().trim();

const TEXTO_ESTADO: Record<FilaModelo['estado'], string> = {
  ok: 'Ya está en su categoría',
  mover: 'Se mueve de categoría',
  vincular: 'Se vincula con el producto existente',
  crear: 'No está en el catálogo: se creará',
};

export function OrdenarPanesModal({
  isOpen, onOpenChange, productos, modelosPan, formulaciones, categorias, categoriaGeneral = 'Panes',
  onAddCategoria, onAddProducto, onUpdateProducto, onUpdateModelo,
}: Props) {
  const plan = useMemo(
    () => planOrdenPanes(productos, modelosPan, formulaciones, categoriaGeneral),
    [productos, modelosPan, formulaciones, categoriaGeneral]
  );
  const pendientes = useMemo(() => plan.filas.filter((f) => f.estado !== 'ok'), [plan]);
  const yaOk = useMemo(() => plan.filas.filter((f) => f.estado === 'ok'), [plan]);

  // Elección por fila: clave 'm:<modeloId>' o 'p:<productoId>' → categoría ('' = no tocar)
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [incluir, setIncluir] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const cat: Record<string, string> = {};
    const inc: Record<string, boolean> = {};
    for (const f of plan.filas) {
      const k = `m:${f.modelo.id}`;
      cat[k] = f.sugerencia?.categoria || '';
      inc[k] = f.estado !== 'ok' && !!f.sugerencia;
    }
    for (const p of plan.huerfanos) {
      const k = `p:${p.id}`;
      const s = sugerirCategoriaPan(p, modelosPan);
      cat[k] = s?.categoria || '';
      inc[k] = !!s;
    }
    setElegidas(cat);
    setIncluir(inc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const opciones = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of CATEGORIAS_PAN_OPCIONES) m.set(norm(o.nombre), o.nombre);
    for (const c of categorias) if (c.tipo !== 'insumo' && norm(c.nombre) !== norm(categoriaGeneral)) m.set(norm(c.nombre), c.nombre);
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [categorias, categoriaGeneral]);

  const seleccionadas = Object.keys(incluir).filter((k) => incluir[k] && elegidas[k]);

  const guardar = async () => {
    if (seleccionadas.length === 0) { toast.info('No marcaste ningún cambio.'); return; }
    setGuardando(true);
    try {
      // 1) Categorías que falten
      const nombres = [...new Set(seleccionadas.map((k) => elegidas[k]))];
      for (const nombre of nombres) {
        if (!categorias.some((c) => norm(c.nombre) === norm(nombre))) {
          const def = CATEGORIAS_PAN_OPCIONES.find((o) => norm(o.nombre) === norm(nombre));
          await Promise.resolve(onAddCategoria(nombre, def?.color || '#d97706', 'venta'));
        }
      }
      // 2) Modelos
      let creados = 0, movidos = 0, vinculados = 0;
      for (const f of plan.filas) {
        const k = `m:${f.modelo.id}`;
        if (!incluir[k] || !elegidas[k]) continue;
        const categoria = elegidas[k];
        const m = f.modelo;
        if (f.estado === 'crear' || !f.producto) {
          const nuevo = await onAddProducto({
            nombre: m.nombre,
            categoria,
            descripcion: '',
            precioVenta: Number(m.precioVentaUnitario) || 0,
            margenUtilidad: Number(m.margenPorcentaje) || 0,
            tipo: 'elaborado',
            costoBase: Number(m.costoUnitario) || 0,
          });
          if (nuevo?.id && onUpdateModelo) await Promise.resolve(onUpdateModelo(m.id, { productoId: nuevo.id }));
          creados++;
        } else {
          await Promise.resolve(onUpdateProducto(f.producto.id, { categoria }));
          if (!m.productoId && onUpdateModelo) {
            await Promise.resolve(onUpdateModelo(m.id, { productoId: f.producto.id }));
            vinculados++;
          }
          movidos++;
        }
      }
      // 3) Productos sueltos en «Panes»
      for (const p of plan.huerfanos) {
        const k = `p:${p.id}`;
        if (!incluir[k] || !elegidas[k]) continue;
        await Promise.resolve(onUpdateProducto(p.id, { categoria: elegidas[k] }));
        movidos++;
      }
      toast.dismiss();
      toast.success(
        `Listo: ${movidos} movido${movidos === 1 ? '' : 's'}, ${creados} creado${creados === 1 ? '' : 's'} en el catálogo` +
        (vinculados ? `, ${vinculados} vinculado${vinculados === 1 ? '' : 's'} al modelo.` : '.')
      );
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar todo. Revisa y vuelve a intentar.');
    } finally {
      setGuardando(false);
    }
  };

  const selector = (k: string, etiqueta: string) => (
    <select
      aria-label={`Categoría de ${etiqueta}`}
      value={elegidas[k] || ''}
      onChange={(e) => {
        const v = e.target.value;
        setElegidas((prev) => ({ ...prev, [k]: v }));
        setIncluir((prev) => ({ ...prev, [k]: !!v }));
      }}
      className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm sm:w-48"
    >
      <option value="">Elegir…</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordenar los panes por categoría</DialogTitle>
          <DialogDescription>
            Esta lista sale de <b>Recetas Técnicas → Modelos de pan</b> ({plan.filas.length} modelos). La categoría se toma de la masa de cada pan
            (masa de sal → Pan de sal, masa de dulce → Pan de dulce…). Lo que apruebes aquí se ve igual en Ventas (POS), Inventario y Mermas.
          </DialogDescription>
        </DialogHeader>

        {plan.filas.length === 0 && plan.huerfanos.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No hay modelos de pan ni productos pendientes.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">{pendientes.length} modelo{pendientes.length === 1 ? '' : 's'} por ordenar · {yaOk.length} ya listos</span>
              <button type="button" className="font-bold text-blue-600 hover:underline"
                onClick={() => setIncluir((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, !!elegidas[k]])))}>
                Marcar todos los que tienen categoría
              </button>
            </div>

            <ul className="space-y-2">
              {pendientes.map((f) => {
                const k = `m:${f.modelo.id}`;
                return (
                  <li key={f.modelo.id} data-modelo={f.modelo.id}
                    className="rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <label className="flex items-start gap-2 min-w-0 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!incluir[k]} disabled={!elegidas[k]}
                        onChange={(e) => setIncluir((prev) => ({ ...prev, [k]: e.target.checked }))}
                        aria-label={`Incluir ${f.modelo.nombre}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 truncate">{f.modelo.nombre}</span>
                        <span className="block text-[11px] text-slate-400">
                          {f.sugerencia ? `${f.sugerencia.confianza === 'alta' ? '✓' : '≈'} ${f.sugerencia.motivo}` : `Masa: ${f.masa} · sin pista, elige tú`}
                        </span>
                        <span className="block text-[11px] text-amber-700">
                          {TEXTO_ESTADO[f.estado]}
                          {f.producto ? ` · «${f.producto.nombre}» hoy en ${f.producto.categoria || 'sin categoría'}` : ''}
                        </span>
                      </span>
                    </label>
                    {selector(k, f.modelo.nombre)}
                  </li>
                );
              })}
              {plan.huerfanos.map((p) => {
                const k = `p:${p.id}`;
                return (
                  <li key={p.id} data-prod={p.id}
                    className="rounded-xl border border-dashed border-slate-300 p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <label className="flex items-start gap-2 min-w-0 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!incluir[k]} disabled={!elegidas[k]}
                        onChange={(e) => setIncluir((prev) => ({ ...prev, [k]: e.target.checked }))}
                        aria-label={`Incluir ${p.nombre}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 truncate">{p.nombre}</span>
                        <span className="block text-[11px] text-slate-400">Producto suelto en «{categoriaGeneral}» (no tiene modelo de pan)</span>
                      </span>
                    </label>
                    {selector(k, p.nombre)}
                  </li>
                );
              })}
            </ul>

            {yaOk.length > 0 && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-bold">Ya ordenados ({yaOk.length})</summary>
                <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  {yaOk.map((f) => (
                    <li key={f.modelo.id} className="truncate">✓ {f.modelo.nombre} → {f.producto?.categoria}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {(plan.filas.length > 0 || plan.huerfanos.length > 0) && (
            <Button type="button" onClick={guardar} disabled={guardando || seleccionadas.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              Aplicar {seleccionadas.length} cambio{seleccionadas.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
