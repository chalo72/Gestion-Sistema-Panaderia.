import { useMemo, useState, useCallback } from 'react';
import {
  AlertOctagon, TrendingDown, Search, Minus, Plus, Undo2, Lightbulb, History, BarChart3, ClipboardList, PackageX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCan } from '@/contexts/AuthContext';
import type { Producto, InventarioItem, MovimientoInventario, Categoria } from '@/types';
import {
  CAUSAS_MERMA, extraerMermas, filtrarPorPeriodo, resumirMermas, generarToken,
  construirMotivoMerma, construirMotivoAnulacion, consejoParaCausa,
  type PeriodoMerma, type RegistroMerma, type ProductoValor, type ItemValor,
} from '@/lib/merma';

export interface ControlMermaProps {
  productos: Producto[];
  inventario: InventarioItem[];
  movimientos: MovimientoInventario[];
  categorias: Categoria[];
  onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => void | Promise<void>;
  formatCurrency: (v: number) => string;
  /** Nombre de quien registra (queda anotado en la merma) */
  usuarioNombre?: string;
}

type Tab = 'registrar' | 'historial' | 'analisis';
type Alcance = 'elaborado' | 'ingrediente';

const PERIODOS: { id: PeriodoMerma; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'todo', label: 'Todo' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function formatoFecha(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Barras({ items, formatCurrency, max = 6 }: { items: ItemValor[]; formatCurrency: (v: number) => string; max?: number }) {
  const lista = items.slice(0, max);
  const tope = Math.max(1, ...lista.map((i) => (i.costo > 0 ? i.costo : i.unidades)));
  const usaCosto = lista.some((i) => i.costo > 0);
  if (lista.length === 0) return <p className="text-sm text-slate-400">Sin datos en este periodo.</p>;
  return (
    <ul className="space-y-2">
      {lista.map((i) => {
        const valor = usaCosto ? i.costo : i.unidades;
        return (
          <li key={i.clave}>
            <div className="flex justify-between text-sm gap-2">
              <span className="font-semibold text-slate-700 truncate">{i.nombre}</span>
              <span className="text-slate-500 shrink-0">
                {i.unidades} uds{i.costo > 0 ? ` · ${formatCurrency(i.costo)}` : ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(4, (valor / tope) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ControlMerma({
  productos, inventario, movimientos, categorias, onAjustarStock, formatCurrency, usuarioNombre,
}: ControlMermaProps) {
  const { check } = useCan();
  const puedeAnular = check('GESTIONAR_INVENTARIO');

  const [tab, setTab] = useState<Tab>('registrar');
  const [periodo, setPeriodo] = useState<PeriodoMerma>('7d');
  const [alcance, setAlcance] = useState<Alcance>('elaborado');
  const [categoria, setCategoria] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [causa, setCausa] = useState(CAUSAS_MERMA[0].id);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  // historial
  const [filtroCausa, setFiltroCausa] = useState('todas');
  const [busquedaHist, setBusquedaHist] = useState('');

  const mapaProductos = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const mapaStock = useMemo(() => new Map(inventario.map((i) => [i.productoId, i.stockActual])), [inventario]);

  const getValor = useCallback((id: string): ProductoValor | undefined => {
    const p = mapaProductos.get(id);
    if (!p) return undefined;
    return {
      nombre: p.nombre,
      categoria: p.categoria || 'Sin categoría',
      costoUnitario: Number(p.costoBase ?? p.precioCompra ?? 0) || 0,
      ventaUnitaria: Number(p.precioVenta) || 0,
    };
  }, [mapaProductos]);

  // ---- Datos de mermas (salen de los movimientos reales de inventario) ----
  const todas = useMemo(() => extraerMermas(movimientos), [movimientos]);
  const delPeriodo = useMemo(() => filtrarPorPeriodo(todas, periodo), [todas, periodo]);
  const resumen = useMemo(() => resumirMermas(delPeriodo, getValor), [delPeriodo, getValor]);

  // Los que más se dañan (últimos 30 días): atajos rápidos
  const frecuentes = useMemo(() => {
    const r = resumirMermas(filtrarPorPeriodo(todas, '30d'), getValor);
    return r.porProducto
      .filter((i) => mapaProductos.has(i.clave))
      .sort((a, b) => b.registros - a.registros)
      .slice(0, 6);
  }, [todas, getValor, mapaProductos]);

  // ---- Lista de productos para registrar ----
  const productosAlcance = useMemo(
    () => productos.filter((p) => (alcance === 'elaborado' ? p.tipo !== 'ingrediente' : p.tipo === 'ingrediente')),
    [productos, alcance]
  );

  const categoriasConteo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of productosAlcance) m.set(p.categoria || 'Sin categoría', (m.get(p.categoria || 'Sin categoría') || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [productosAlcance]);

  const iconoCategoria = useCallback((nombre: string) => categorias.find((c) => c.nombre === nombre)?.icono || '', [categorias]);

  const productosVisibles = useMemo(() => {
    const q = norm(busqueda);
    return productosAlcance
      .filter((p) => categoria === 'todas' || (p.categoria || 'Sin categoría') === categoria)
      .filter((p) => !q || norm(p.nombre).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [productosAlcance, categoria, busqueda]);

  const seleccionado = seleccionadoId ? mapaProductos.get(seleccionadoId) : undefined;
  const stockSel = seleccionadoId ? mapaStock.get(seleccionadoId) : undefined;
  const valSel = seleccionadoId ? getValor(seleccionadoId) : undefined;

  const elegirProducto = (id: string) => {
    setSeleccionadoId(id);
    setCantidad(1);
    setNota('');
  };

  const cambiarAlcance = (a: Alcance) => {
    setAlcance(a); setCategoria('todas'); setSeleccionadoId(null);
  };

  const registrar = async () => {
    if (!seleccionado) { toast.error('Elige primero el producto dañado.'); return; }
    const cant = Math.floor(Number(cantidad));
    if (!cant || cant <= 0) { toast.error('Pon cuántas unidades se dañaron.'); return; }
    setGuardando(true);
    try {
      const token = generarToken();
      const motivo = construirMotivoMerma({ causa, nota, usuario: usuarioNombre, token });
      await Promise.resolve(onAjustarStock(seleccionado.id, cant, 'salida', motivo));
      toast.success(`Merma registrada: ${cant} × ${seleccionado.nombre}. Ya se descontó del inventario.`);
      setSeleccionadoId(null); setCantidad(1); setNota('');
    } catch {
      toast.error('No se pudo registrar la merma. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (r: RegistroMerma) => {
    if (!r.token) return;
    const nombre = mapaProductos.get(r.productoId)?.nombre || 'producto';
    if (!window.confirm(`¿Anular esta merma (${r.cantidad} × ${nombre})? El stock se devuelve al inventario.`)) return;
    try {
      await Promise.resolve(onAjustarStock(r.productoId, r.cantidad, 'entrada', construirMotivoAnulacion(r.token)));
      toast.success('Merma anulada. El stock fue devuelto al inventario.');
    } catch {
      toast.error('No se pudo anular la merma.');
    }
  };

  // ---- Historial filtrado ----
  const historial = useMemo(() => {
    const q = norm(busquedaHist);
    return delPeriodo
      .filter((r) => filtroCausa === 'todas' || r.causa === filtroCausa)
      .filter((r) => !q || norm(mapaProductos.get(r.productoId)?.nombre || '').includes(q) || norm(r.nota).includes(q));
  }, [delPeriodo, filtroCausa, busquedaHist, mapaProductos]);

  const causaTop = resumen.porCausa[0];
  const productoTop = resumen.porProducto[0];
  const sinCostos = resumen.registros > 0 && resumen.costo === 0;

  const tabBtn = (id: Tab, label: string, Icon: typeof History) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
        tab === id ? 'bg-red-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Control de Mermas</h1>
            <p className="text-sm text-slate-500">Lo que se daña se descuenta solo del inventario y queda guardado.</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${periodo === p.id ? 'bg-white text-red-600 shadow' : 'text-slate-500'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Unidades perdidas</p>
          <p className="text-2xl font-black text-red-600" data-testid="kpi-unidades">{resumen.unidades}</p>
          <p className="text-xs text-slate-400">{resumen.registros} registro{resumen.registros === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Dinero perdido (costo)</p>
          <p className="text-2xl font-black text-red-600" data-testid="kpi-costo">{formatCurrency(resumen.costo)}</p>
          <p className="text-xs text-slate-400">
            {resumen.venta > 0 ? `Vendido habría sido ${formatCurrency(resumen.venta)}` : 'Lo que costó hacerlo'}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Causa principal</p>
          <p className="text-base font-black text-slate-800 leading-tight">{causaTop ? causaTop.nombre : '—'}</p>
          <p className="text-xs text-slate-400">{causaTop ? `${causaTop.unidades} uds` : 'Sin mermas'}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Producto más afectado</p>
          <p className="text-base font-black text-slate-800 leading-tight">{productoTop ? productoTop.nombre : '—'}</p>
          <p className="text-xs text-slate-400">{productoTop ? `${productoTop.unidades} uds` : 'Sin mermas'}</p>
        </div>
      </div>
      {sinCostos && (
        <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
          Algunos productos no tienen costo registrado, por eso el dinero perdido sale en $0. Agrega el costo (receta o precio de compra) para ver la pérdida real.
        </p>
      )}

      {/* Pestañas */}
      <div className="flex gap-2">
        {tabBtn('registrar', 'Registrar merma', ClipboardList)}
        {tabBtn('historial', 'Historial', History)}
        {tabBtn('analisis', 'Análisis', BarChart3)}
      </div>

      {/* ============ REGISTRAR ============ */}
      {tab === 'registrar' && (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Paso 1: elegir producto */}
          <section className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">1 · ¿Qué se dañó?</h2>

            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              <button type="button" onClick={() => cambiarAlcance('elaborado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${alcance === 'elaborado' ? 'bg-white text-red-600 shadow' : 'text-slate-500'}`}>
                Productos (pan, tortas…)
              </button>
              <button type="button" onClick={() => cambiarAlcance('ingrediente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${alcance === 'ingrediente' ? 'bg-white text-red-600 shadow' : 'text-slate-500'}`}>
                Insumos (harina, huevos…)
              </button>
            </div>

            {frecuentes.length > 0 && alcance === 'elaborado' && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-1">Los que más se dañan</p>
                <div className="flex flex-wrap gap-2">
                  {frecuentes.map((f) => (
                    <button key={f.clave} type="button" onClick={() => elegirProducto(f.clave)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                      {f.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
              <button type="button" onClick={() => setCategoria('todas')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${categoria === 'todas' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                Todas ({productosAlcance.length})
              </button>
              {categoriasConteo.map(([nombre, n]) => (
                <button key={nombre} type="button" onClick={() => setCategoria(nombre)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${categoria === nombre ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {iconoCategoria(nombre)} {nombre} ({n})
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…" className="pl-9" aria-label="Buscar producto" />
            </div>

            {productosVisibles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
                <PackageX className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm font-semibold">No hay productos en esta lista.</p>
                <p className="text-xs">Agrégalos desde Catálogo y aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[28rem] overflow-y-auto pr-1">
                {productosVisibles.map((p) => {
                  const stock = mapaStock.get(p.id);
                  const activo = seleccionadoId === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => elegirProducto(p.id)} data-producto={p.id}
                      className={`text-left rounded-xl border p-3 transition-colors ${activo ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-slate-200 bg-white hover:border-red-300'}`}>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{p.nombre}</p>
                      <p className="text-[11px] text-slate-400">{p.categoria}</p>
                      <p className={`text-xs font-black mt-1 ${stock === undefined ? 'text-slate-300' : stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {stock === undefined ? 'Sin stock registrado' : `Hay ${stock}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Paso 2: cantidad y motivo */}
          <section className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">2 · ¿Cuánto y por qué?</h2>
            {!seleccionado ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
                Toca un producto de la lista para registrar su merma.
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-red-200 p-4 space-y-4 lg:sticky lg:top-4">
                <div>
                  <p className="text-lg font-black text-slate-800">{seleccionado.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {stockSel === undefined ? 'Sin stock registrado en inventario' : `En inventario: ${stockSel}`}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">Unidades dañadas</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label="Menos" onClick={() => setCantidad((c) => Math.max(1, Number(c) - 1))}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input type="number" inputMode="numeric" min={1} value={cantidad} aria-label="Cantidad"
                      onChange={(e) => setCantidad(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="text-center text-lg font-black w-24" />
                    <Button type="button" variant="outline" size="icon" aria-label="Más" onClick={() => setCantidad((c) => Number(c) + 1)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                    {[5, 10].map((n) => (
                      <button key={n} type="button" onClick={() => setCantidad((c) => Number(c) + n)}
                        className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">+{n}</button>
                    ))}
                  </div>
                  {stockSel !== undefined && Number(cantidad) > stockSel && (
                    <p className="text-xs text-amber-600 mt-1">Ojo: en inventario solo hay {stockSel}. El inventario quedará en 0.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">¿Por qué se dañó?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CAUSAS_MERMA.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCausa(c.id)} data-causa={c.id}
                        className={`text-left rounded-xl border px-3 py-2 text-xs font-bold leading-tight ${causa === c.id ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}>
                        <span className="mr-1">{c.icono}</span>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">Nota (opcional)</p>
                  <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: horno muy caliente, tanda de las 6am" />
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  Se descuentan <b>{Number(cantidad) || 0}</b> del inventario
                  {valSel && valSel.costoUnitario > 0 && (
                    <> · pérdida aprox. <b className="text-red-600">{formatCurrency(valSel.costoUnitario * (Number(cantidad) || 0))}</b></>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setSeleccionadoId(null)}>Cancelar</Button>
                  <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black" onClick={registrar} disabled={guardando}>
                    <TrendingDown className="w-4 h-4 mr-2" /> Registrar merma
                  </Button>
                </div>
              </div>
            )}

            {todas.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-1">Últimas registradas</p>
                <ul className="space-y-1">
                  {todas.filter((r) => !r.anulada).slice(0, 4).map((r) => (
                    <li key={r.id} className="text-xs flex justify-between gap-2 text-slate-600">
                      <span className="truncate">{r.cantidad} × {mapaProductos.get(r.productoId)?.nombre || 'Producto'} · {r.causa}</span>
                      <span className="text-slate-400 shrink-0">{formatoFecha(r.fecha)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ============ HISTORIAL ============ */}
      {tab === 'historial' && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={busquedaHist} onChange={(e) => setBusquedaHist(e.target.value)} placeholder="Buscar por producto o nota…" className="pl-9" aria-label="Buscar en historial" />
            </div>
            <select value={filtroCausa} onChange={(e) => setFiltroCausa(e.target.value)} aria-label="Filtrar por causa"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="todas">Todas las causas</option>
              {CAUSAS_MERMA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {historial.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
              No hay mermas en este periodo. ¡Buena señal!
            </div>
          ) : (
            <ul className="space-y-2">
              {historial.map((r) => {
                const p = mapaProductos.get(r.productoId);
                const v = getValor(r.productoId);
                const costo = (v?.costoUnitario || 0) * r.cantidad;
                return (
                  <li key={r.id} data-merma={r.id} className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${r.anulada ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold text-slate-800 ${r.anulada ? 'line-through' : ''}`}>
                        {r.cantidad} × {p?.nombre || 'Producto eliminado'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {CAUSAS_MERMA.find((c) => c.id === r.causa)?.icono || '📝'} {r.causa}
                        {r.nota ? ` · ${r.nota}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatoFecha(r.fecha)}{r.usuario ? ` · ${r.usuario}` : ''}{r.anulada ? ' · ANULADA' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {costo > 0 && !r.anulada && <p className="text-sm font-black text-red-600">{formatCurrency(costo)}</p>}
                      {puedeAnular && r.token && !r.anulada && (
                        <button type="button" onClick={() => anular(r)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600">
                          <Undo2 className="w-3 h-3" /> Anular
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ============ ANÁLISIS ============ */}
      {tab === 'analisis' && (
        <section className="space-y-4">
          {resumen.registros === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
              Aún no hay mermas en este periodo para analizar.
            </div>
          ) : (
            <>
              {causaTop && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-black">Lo que más te está costando: {causaTop.nombre}</p>
                    <p>{consejoParaCausa(causaTop.clave)}</p>
                  </div>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <h3 className="text-sm font-black text-slate-700 mb-3">Por causa</h3>
                  <Barras items={resumen.porCausa} formatCurrency={formatCurrency} />
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <h3 className="text-sm font-black text-slate-700 mb-3">Productos más afectados</h3>
                  <Barras items={resumen.porProducto} formatCurrency={formatCurrency} />
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <h3 className="text-sm font-black text-slate-700 mb-3">Por categoría</h3>
                  <Barras items={resumen.porCategoria} formatCurrency={formatCurrency} />
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
