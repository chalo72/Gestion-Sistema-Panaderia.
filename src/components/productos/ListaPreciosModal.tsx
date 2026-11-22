import { useEffect, useMemo, useState } from 'react';
import { Search, Printer, MessageCircle, Check, RotateCcw, ChevronDown, Undo2, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { InputPesos } from '@/components/ui/input-pesos';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normTexto } from '@/lib/busqueda-productos';
import type { Producto } from '@/types';
import {
  armarFilas, agruparPorCategoria, cambiosParaAplicar, textoWhatsApp, htmlImpresion,
  cargarAjustes, guardarAjustes, cargarRespaldo, guardarRespaldo, borrarRespaldo,
  AJUSTES_VACIOS, type AjustesLista, type Respaldo,
} from '@/lib/lista-precios';

/**
 * Lista de precios interactiva (2026-11-21, pedido de Gonzalo): subir o bajar por categoría con %,
 * cambiar a mano, quitar de la lista, imprimir / WhatsApp, y pasar los precios a la app con deshacer.
 */
interface Props {
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  productos: Producto[];
  onUpdateProducto: (id: string, updates: Partial<Producto>) => unknown;
  nombreNegocio?: string;
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

function Porcentaje({ valor, onCambio, etiqueta }: { valor: number; onCambio: (n: number) => void; etiqueta: string }) {
  const limitar = (n: number) => Math.max(-50, Math.min(50, n));
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" aria-label={`Bajar ${etiqueta}`} onClick={() => onCambio(limitar(valor - 1))}
        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-black text-slate-700 dark:text-slate-200">−</button>
      <div className="relative">
        <input aria-label={`% ${etiqueta}`} inputMode="numeric" value={valor || ''} placeholder="0"
          onChange={e => { const s = e.target.value.replace(/[^\d-]/g, ''); onCambio(limitar(parseInt(s, 10) || 0)); }}
          className="w-14 h-9 pr-5 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-slate-900 dark:text-white outline-none focus:border-orange-400" />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
      </div>
      <button type="button" aria-label={`Subir ${etiqueta}`} onClick={() => onCambio(limitar(valor + 1))}
        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-black text-slate-700 dark:text-slate-200">+</button>
    </div>
  );
}

export function ListaPreciosModal({ isOpen, onOpenChange, productos, onUpdateProducto, nombreNegocio = 'Dulce Placer' }: Props) {
  const [aj, setAj] = useState<AjustesLista>(() => cargarAjustes());
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [pctTodo, setPctTodo] = useState(0);
  const [confirmar, setConfirmar] = useState<'aplicar' | 'deshacer' | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [respaldo, setRespaldo] = useState<Respaldo | null>(() => cargarRespaldo());

  useEffect(() => { guardarAjustes(aj); }, [aj]);

  const filas = useMemo(() => armarFilas(productos, aj), [productos, aj]);
  const cambios = useMemo(() => cambiosParaAplicar(filas), [filas]);
  const grupos = useMemo(() => {
    const q = normTexto(busqueda);
    const visibles = q ? filas.filter(f => normTexto(f.nombre).includes(q) || normTexto(f.categoria).includes(q)) : filas;
    return agruparPorCategoria(visibles);
  }, [filas, busqueda]);
  const ocultos = filas.filter(f => f.oculto).length;

  const ponerPctCategoria = (cat: string, n: number) =>
    setAj(a => ({ ...a, pctPorCategoria: { ...a.pctPorCategoria, [cat]: n } }));
  const ponerPctTodo = (n: number) => {
    setPctTodo(n);
    const todas = Object.fromEntries(Array.from(new Set(filas.map(f => f.categoria))).map(c => [c, n]));
    setAj(a => ({ ...a, pctPorCategoria: todas }));
  };
  const ponerManual = (id: string, n: number, actual: number) =>
    setAj(a => {
      const manuales = { ...a.manuales };
      if (n > 0 && n !== actual) manuales[id] = n; else delete manuales[id];
      return { ...a, manuales };
    });
  const quitarManual = (id: string) => setAj(a => { const m = { ...a.manuales }; delete m[id]; return { ...a, manuales: m }; });
  const alternarOculto = (id: string) =>
    setAj(a => ({ ...a, ocultos: a.ocultos.includes(id) ? a.ocultos.filter(x => x !== id) : [...a.ocultos, id] }));
  const alternarCategoria = (cat: string) =>
    setAbiertas(s => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });

  const imprimir = () => {
    const fecha = 'Precios desde el ' + new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const w = window.open('', '_blank');
    if (!w) { toast.error('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes.'); return; }
    w.document.write(htmlImpresion(filas, nombreNegocio, fecha));
    w.document.close();
  };

  const copiarWhatsApp = async () => {
    const texto = textoWhatsApp(filas, cambios.length > 0);
    try { await navigator.clipboard.writeText(texto); toast.success('Lista copiada. Péguela en el WhatsApp de las vendedoras.'); }
    catch { toast.error('No se pudo copiar. Intente de nuevo.'); }
  };

  const aplicar = async () => {
    setTrabajando(true);
    const r: Respaldo = { fecha: new Date().toISOString(), precios: cambios.map(f => ({ id: f.id, nombre: f.nombre, precio: f.actual })) };
    guardarRespaldo(r);
    let ok = 0;
    try {
      for (const f of cambios) { await onUpdateProducto(f.id, { precioVenta: f.nuevo }); ok++; }
      toast.success(`${ok} precios cambiados. Ya cobran así en Ventas.`);
      setRespaldo(r);
      setAj(a => ({ ...a, pctPorCategoria: {}, manuales: {} }));
      setPctTodo(0);
    } catch {
      toast.error(`Se cambiaron ${ok} de ${cambios.length}. Revise la conexión e intente otra vez.`);
    } finally { setTrabajando(false); setConfirmar(null); }
  };

  const deshacer = async () => {
    if (!respaldo) return;
    setTrabajando(true);
    try {
      for (const p of respaldo.precios) await onUpdateProducto(p.id, { precioVenta: p.precio });
      toast.success(`Volvieron los ${respaldo.precios.length} precios anteriores.`);
      borrarRespaldo(); setRespaldo(null);
    } catch { toast.error('No se pudieron devolver todos los precios. Intente otra vez.'); }
    finally { setTrabajando(false); setConfirmar(null); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 w-full max-w-full sm:max-w-4xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Encabezado */}
        <div className="p-4 pr-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0">
          <div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">Lista de precios</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
              Suba o baje por categoría, cambie el precio que quiera y quite lo que no va. Nada cambia en Ventas hasta que toque «Pasar a la app».
            </DialogDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto o categoría…" aria-label="Buscar"
              className="w-full h-11 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-orange-400" />
            {busqueda && <button type="button" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Subir todo</span>
              <Porcentaje valor={pctTodo} onCambio={ponerPctTodo} etiqueta="todo" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={aj.protegerHasta > 0} onChange={e => setAj(a => ({ ...a, protegerHasta: e.target.checked ? 1000 : 0 }))} className="w-4 h-4 accent-orange-600" />
              No subir lo de $1.000 o menos
            </label>
          </div>
        </div>

        {/* Lista por categoría */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {grupos.length === 0 && <p className="text-center text-slate-500 py-10">No hay productos con ese nombre.</p>}
          {grupos.map(g => {
            const abierta = !!busqueda || abiertas.has(g.categoria);
            const suben = g.filas.filter(f => f.nuevo !== f.actual).length;
            const pct = aj.pctPorCategoria[g.categoria] || 0;
            return (
              <section key={g.categoria} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div role="button" tabIndex={0} onClick={() => alternarCategoria(g.categoria)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarCategoria(g.categoria); } }}
                  className="flex items-center gap-3 p-3 cursor-pointer select-none">
                  <ChevronDown className={cn('w-5 h-5 text-slate-400 transition-transform shrink-0', abierta && 'rotate-180')} />
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate">{g.categoria}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{g.filas.length} productos{suben ? ` · ${suben} cambian` : ''}</p>
                  </div>
                  <Porcentaje valor={pct} onCambio={n => ponerPctCategoria(g.categoria, n)} etiqueta={g.categoria} />
                </div>
                {abierta && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {g.filas.map(f => {
                      const cambia = f.nuevo !== f.actual;
                      return (
                        <div key={f.id} className={cn('flex items-center gap-2 px-3 py-2', f.oculto && 'opacity-50')}>
                          <input type="checkbox" checked={!f.oculto} onChange={() => alternarOculto(f.id)} aria-label={`Mostrar ${f.nombre} en la lista`}
                            title="Quitar o poner en la lista impresa" className="w-4 h-4 accent-orange-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-semibold text-slate-800 dark:text-slate-100 break-words', f.oculto && 'line-through')}>{f.nombre}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              Ahora {pesos(f.actual)}
                              {cambia && <span className={cn('ml-1 font-bold', f.nuevo > f.actual ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                                {f.nuevo > f.actual ? '+' : '−'}{pesos(Math.abs(f.nuevo - f.actual))}
                              </span>}
                            </p>
                          </div>
                          <InputPesos value={f.nuevo} onValor={n => ponerManual(f.id, n, f.actual)} aria-label={`Precio nuevo ${f.nombre}`}
                            className={cn('w-24 h-10 px-2 text-right rounded-lg border font-black tabular-nums outline-none bg-white dark:bg-slate-800 focus:border-orange-400',
                              cambia ? 'border-emerald-400 text-emerald-800 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white')} />
                          {f.manual
                            ? <button type="button" onClick={() => quitarManual(f.id)} aria-label={`Volver al cálculo para ${f.nombre}`} title="Volver al cálculo con %" className="p-1.5 text-slate-400 hover:text-orange-600 shrink-0"><RotateCcw className="w-4 h-4" /></button>
                            : <span className="w-7 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Pie con acciones */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {confirmar ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {confirmar === 'aplicar'
                  ? `Se van a cambiar ${cambios.length} precios en la app. Desde ese momento Ventas cobra los precios nuevos. Se guarda una copia para deshacer.`
                  : `Se devuelven ${respaldo?.precios.length ?? 0} productos al precio que tenían antes de la última subida.`}
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={trabajando} onClick={() => setConfirmar(null)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200">Cancelar</button>
                <button type="button" disabled={trabajando} onClick={confirmar === 'aplicar' ? aplicar : deshacer}
                  className="flex-[2] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2">
                  {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {confirmar === 'aplicar' ? 'Sí, cambiar precios' : 'Sí, devolver precios'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <b>{cambios.length}</b> precios cambian · <b>{filas.length - ocultos}</b> en la lista{ocultos ? ` · ${ocultos} quitados` : ''}
                {(Object.keys(aj.manuales).length > 0 || Object.values(aj.pctPorCategoria).some(Boolean) || ocultos > 0) && (
                  <button type="button" onClick={() => { setAj({ ...AJUSTES_VACIOS, protegerHasta: aj.protegerHasta }); setPctTodo(0); }} className="ml-2 underline text-slate-500">Empezar de nuevo</button>
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button type="button" onClick={imprimir} className="h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Imprimir</button>
                <button type="button" onClick={copiarWhatsApp} className="h-11 rounded-xl border border-emerald-300 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
                <button type="button" disabled={!cambios.length} onClick={() => setConfirmar('aplicar')}
                  className="col-span-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white font-black flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Pasar a la app{cambios.length ? ` (${cambios.length})` : ''}
                </button>
              </div>
              {respaldo && (
                <button type="button" onClick={() => setConfirmar('deshacer')} className="w-full text-sm text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1 py-1">
                  <Undo2 className="w-4 h-4" /> Deshacer la última subida ({new Date(respaldo.fecha).toLocaleDateString('es-CO')}, {respaldo.precios.length} productos)
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
