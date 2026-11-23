import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, Printer, MessageCircle, Check, RotateCcw, ChevronDown, ChevronUp, Undo2, Loader2, X, Sparkles, Lightbulb, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { InputPesos } from '@/components/ui/input-pesos';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normTexto } from '@/lib/busqueda-productos';
import { consultarAgente } from '@/constants/agentes';
import { db } from '@/lib/database';
import type { Producto } from '@/types';
import {
  armarFilas, agruparPorCategoria, cambiosParaAplicar, textoWhatsApp, htmlImpresion,
  cargarAjustes, guardarAjustes, cargarRespaldo, guardarRespaldo, borrarRespaldo,
  sugerenciaBase, contextoCategoria, preguntaCategoria, leerAnalisisIA, verificarGuardado,
  AJUSTES_VACIOS, SIN_CATEGORIA, moverEnLista, type AjustesLista, type Respaldo, type Sugerencia, type ModoLista, type Papel,
} from '@/lib/lista-precios';

/**
 * Lista de precios interactiva (2026-11-21, pedido de Gonzalo): subir o bajar por categoría con %,
 * cambiar a mano, quitar de la lista, imprimir / WhatsApp, y pasar los precios a la app con deshacer.
 * 2026-11-22: análisis por categoría (sugerencia de la app + análisis con la IA real de /api/agente),
 * vista previa antes de imprimir y confirmación verificada de que los precios quedaron guardados.
 */
interface Props {
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  productos: Producto[];
  onUpdateProducto: (id: string, updates: Partial<Producto>) => unknown;
  categorias?: { nombre: string }[];
  nombreNegocio?: string;
}

type EstadoIA = { estado: 'cargando' } | { estado: 'listo'; sug: Sugerencia | null; texto: string } | { estado: 'error'; mensaje: string };
type Resultado = { ok: number; total: number; fallaron: string[]; ejemplos: { nombre: string; antes: number; ahora: number }[]; verificado: boolean };

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

function CajaAnalisis({ titulo, icono, sug, onUsar, tono }: { titulo: string; icono: ReactNode; sug: Sugerencia; onUsar: () => void; tono: 'app' | 'ia' }) {
  return (
    <div className={cn('rounded-xl border p-3 space-y-1.5 text-sm',
      tono === 'ia' ? 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30')}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('font-black flex items-center gap-1.5', tono === 'ia' ? 'text-violet-900 dark:text-violet-200' : 'text-amber-900 dark:text-amber-200')}>
          {icono}{titulo}: {sug.pct > 0 ? `subir ${sug.pct}%` : 'no subir'}
        </p>
        <button type="button" onClick={onUsar}
          className={cn('shrink-0 h-8 px-3 rounded-lg text-xs font-black text-white', tono === 'ia' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-amber-600 hover:bg-amber-700')}>
          Usar {sug.pct}%
        </button>
      </div>
      {sug.porque && <p className="text-slate-700 dark:text-slate-200"><b>¿Por qué?</b> {sug.porque}</p>}
      {sug.paraQue && <p className="text-slate-700 dark:text-slate-200"><b>¿Para qué?</b> {sug.paraQue}</p>}
      {sug.razon && <p className="text-slate-700 dark:text-slate-200"><b>La razón:</b> {sug.razon}</p>}
    </div>
  );
}

export function ListaPreciosModal({ isOpen, onOpenChange, productos, onUpdateProducto, categorias = [], nombreNegocio = 'Dulce Placer' }: Props) {
  const [modo, setModo] = useState<ModoLista>('venta');
  const [papel, setPapel] = useState<Papel>('oficio');
  const esVenta = modo === 'venta';
  const [aj, setAj] = useState<AjustesLista>(() => cargarAjustes());
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [pctTodo, setPctTodo] = useState(0);
  const [confirmar, setConfirmar] = useState<'aplicar' | 'deshacer' | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [respaldo, setRespaldo] = useState<Respaldo | null>(() => cargarRespaldo());
  const [analisis, setAnalisis] = useState<Record<string, EstadoIA>>({});
  const [vista, setVista] = useState<'lista' | 'previa'>('lista');
  const [ordenAbierto, setOrdenAbierto] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const previaRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { guardarAjustes(aj); }, [aj]);
  useEffect(() => { if (!isOpen) { setVista('lista'); setResultado(null); } }, [isOpen]);

  // Solo las categorías que Gonzalo creó (2026-11-22): un producto con una categoría ya borrada
  // sale en «Sin categoría» en vez de revivir la borrada en la hoja impresa.
  const opcionesCategoria = useMemo(() => {
    const s = new Set<string>(categorias.map(c => (c.nombre || '').trim()));
    s.delete('');
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }, [categorias]);
  const filas = useMemo(
    () => armarFilas(productos, aj, modo, opcionesCategoria.length ? opcionesCategoria : undefined),
    [productos, aj, modo, opcionesCategoria]);
  const cambios = useMemo(() => (esVenta ? cambiosParaAplicar(filas) : []), [filas, esVenta]);
  const moverCategoria = async (id: string, nombre: string, categoria: string) => {
    if (!categoria) return;
    try { await onUpdateProducto(id, { categoria }); toast.success(`«${nombre}» quedó en ${categoria}.`); }
    catch { toast.error('No se pudo cambiar la categoría. Intente otra vez.'); }
  };
  const costos = useMemo(() => Object.fromEntries(productos.map(p => [p.id, Number(p.costoBase) || 0])), [productos]);
  const grupos = useMemo(() => {
    const q = normTexto(busqueda);
    const visibles = q ? filas.filter(f => normTexto(f.nombre).includes(q) || normTexto(f.categoria).includes(q)) : filas;
    return agruparPorCategoria(visibles);
  }, [filas, busqueda]);
  const todasCategorias = useMemo(() => Array.from(new Set(filas.map(f => f.categoria))), [filas]);
  // Las que salen en la hoja (al menos un producto marcado para imprimir), en su orden
  const categoriasImpresas = useMemo(() => Array.from(new Set(filas.filter(f => !f.oculto).map(f => f.categoria))), [filas]);
  const ocultos = filas.filter(f => f.oculto).length;
  const fechaLista = 'Precios desde el ' + new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const htmlPrevia = useMemo(
    () => (vista === 'previa' ? htmlImpresion(filas, nombreNegocio, esVenta ? fechaLista : 'Costo de compra · ' + new Date().toLocaleDateString('es-CO'), papel, esVenta ? 'Lista de precios' : 'Lista de insumos') : ''),
    [vista, filas, nombreNegocio, fechaLista, papel, esVenta]);

  const ponerPctCategoria = (cat: string, n: number) =>
    setAj(a => ({ ...a, pctPorCategoria: { ...a.pctPorCategoria, [cat]: n } }));
  const ponerPctTodo = (n: number) => {
    setPctTodo(n);
    setAj(a => ({ ...a, pctPorCategoria: Object.fromEntries(todasCategorias.map(c => [c, n])) }));
  };
  const usarSugerenciasEnTodas = () => {
    setPctTodo(0);
    setAj(a => ({ ...a, protegerHasta: 1000, pctPorCategoria: Object.fromEntries(todasCategorias.map(c => [c, sugerenciaBase(c).pct])) }));
    toast.success('Se pusieron los % sugeridos. El pan de $1.000 o menos no sube.');
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
  // Imprimir o no una categoría entera (2026-11-22): si todos están puestos los quita, si no los pone todos
  const alternarImprimirCategoria = (cat: string) => {
    const ids = filas.filter(f => f.categoria === cat).map(f => f.id);
    const todosPuestos = filas.filter(f => f.categoria === cat).every(f => !f.oculto);
    setAj(a => {
      const resto = a.ocultos.filter(x => !ids.includes(x));
      return { ...a, ocultos: todosPuestos ? [...resto, ...ids] : resto };
    });
  };
  const ponerTodosEnLista = (poner: boolean) =>
    setAj(a => {
      const ids = filas.map(f => f.id);
      const resto = a.ocultos.filter(x => !ids.includes(x));
      return { ...a, ocultos: poner ? resto : [...resto, ...ids] };
    });
  // Mover de posición (2026-11-22): categorías completas o productos dentro de su categoría
  const moverCategoriaPos = (cat: string, dir: -1 | 1) =>
    setAj(a => ({ ...a, ordenCategorias: moverEnLista(todasCategorias, cat, dir) }));
  // En la vista previa: cambia de lugar con la vecina que SÍ sale en la hoja (no con una quitada)
  const moverCategoriaImpresa = (cat: string, dir: -1 | 1) => {
    const vecina = categoriasImpresas[categoriasImpresas.indexOf(cat) + dir];
    if (!vecina) return;
    const orden = [...todasCategorias];
    const i = orden.indexOf(cat), j = orden.indexOf(vecina);
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setAj(a => ({ ...a, ordenCategorias: orden }));
  };
  const moverProductoPos = (cat: string, id: string, dir: -1 | 1) => {
    const ids = filas.filter(f => f.categoria === cat).map(f => f.id);
    setAj(a => ({ ...a, ordenProductos: { ...a.ordenProductos, [cat]: moverEnLista(ids, id, dir) } }));
  };
  const alternarCategoria = (cat: string) =>
    setAbiertas(s => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });

  // Análisis con la IA real del negocio (/api/agente, agente PICO-CLAW de márgenes)
  const analizarConIA = async (categoria: string, filasCat: typeof filas) => {
    setAnalisis(a => ({ ...a, [categoria]: { estado: 'cargando' } }));
    try {
      const texto = await consultarAgente('pico-claw', preguntaCategoria(categoria), () => {}, undefined, contextoCategoria(categoria, filasCat, costos));
      setAnalisis(a => ({ ...a, [categoria]: { estado: 'listo', sug: leerAnalisisIA(texto), texto } }));
    } catch (e) {
      const crudo = e instanceof Error ? e.message : '';
      const mensaje = /proveedores|AI_DISABLED|Failed to fetch|NetworkError|50\d/i.test(crudo)
        ? 'revise que haya internet y que la IA esté prendida (Configuración → Modo IA: Híbrido). Mientras tanto puede usar la sugerencia de la app.'
        : /401|403|clave/i.test(crudo)
          ? 'este aparato no tiene la clave del negocio (Configuración → Clave del negocio).'
          : 'intente otra vez en un momento.';
      setAnalisis(a => ({ ...a, [categoria]: { estado: 'error', mensaje } }));
    }
  };

  const imprimirAhora = () => {
    const w = previaRef.current?.contentWindow;
    if (!w) { toast.error('No se pudo abrir la impresión. Intente otra vez.'); return; }
    w.focus(); w.print();
  };

  const copiarWhatsApp = async () => {
    const texto = textoWhatsApp(filas, cambios.length > 0);
    try { await navigator.clipboard.writeText(texto); toast.success('Lista copiada. Péguela en el WhatsApp de las vendedoras.'); }
    catch { toast.error('No se pudo copiar. Intente de nuevo.'); }
  };

  const aplicar = async () => {
    setTrabajando(true);
    const lote = cambios.map(f => ({ id: f.id, nombre: f.nombre, antes: f.actual, nuevo: f.nuevo }));
    const r: Respaldo = { fecha: new Date().toISOString(), precios: lote.map(f => ({ id: f.id, nombre: f.nombre, precio: f.antes })) };
    guardarRespaldo(r);
    let enviados = 0;
    try {
      for (const f of lote) { await onUpdateProducto(f.id, { precioVenta: f.nuevo }); enviados++; }
    } catch { /* se informa abajo con la verificación */ }
    // Releer lo guardado en el aparato para confirmar de verdad
    let v = { ok: enviados, total: lote.length, fallaron: lote.slice(enviados).map(f => f.id) };
    let verificado = false;
    try {
      const guardados = await db.getAllProductos();
      v = verificarGuardado(lote, guardados as any);
      verificado = true;
    } catch { /* sin lectura: se usa el conteo de envíos */ }
    setRespaldo(r);
    setResultado({ ...v, verificado, ejemplos: lote.slice(0, 6).map(f => ({ nombre: f.nombre, antes: f.antes, ahora: f.nuevo })) });
    if (v.ok === v.total) {
      setAj(a => ({ ...a, pctPorCategoria: {}, manuales: {} }));
      setPctTodo(0);
    }
    setTrabajando(false); setConfirmar(null);
  };

  const deshacer = async () => {
    if (!respaldo) return;
    setTrabajando(true);
    try {
      for (const p of respaldo.precios) await onUpdateProducto(p.id, { precioVenta: p.precio });
      toast.success(`Volvieron los ${respaldo.precios.length} precios anteriores.`);
      borrarRespaldo(); setRespaldo(null); setResultado(null);
    } catch { toast.error('No se pudieron devolver todos los precios. Intente otra vez.'); }
    finally { setTrabajando(false); setConfirmar(null); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 w-full max-w-full sm:max-w-4xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        {vista === 'previa' ? (
          <>
            <div className="p-4 pr-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">Vista previa de la lista</DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">Así sale en la hoja. Si algo no le gusta, vuelva y cámbielo.</DialogDescription>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200">Hoja:</span>
                {(['oficio', 'carta'] as Papel[]).map(p => (
                  <button key={p} type="button" onClick={() => setPapel(p)} aria-pressed={papel === p}
                    className={cn('h-8 px-3 rounded-lg border font-bold capitalize', papel === p ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200')}>{p}</button>
                ))}
                <span className="text-xs text-slate-500 dark:text-slate-400">En la ventana de imprimir elija el mismo tamaño.</span>
              </div>
              {/* Ordenar categorías completas mirando la hoja (pedido de Gonzalo, 2026-11-22) */}
              <button type="button" onClick={() => setOrdenAbierto(v => !v)} aria-expanded={ordenAbierto}
                className="mt-2 h-9 px-3 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 text-sm font-bold flex items-center gap-1.5">
                <ChevronDown className={cn('w-4 h-4 transition-transform', ordenAbierto && 'rotate-180')} /> Ordenar categorías ({categoriasImpresas.length})
              </button>
              {ordenAbierto && (
                <ol className="mt-2 max-h-[38vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {categoriasImpresas.map((cat, i) => (
                    <li key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900">
                      <span className="w-6 text-right text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{i + 1}.</span>
                      <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{cat}</span>
                      <button type="button" disabled={i === 0} onClick={() => moverCategoriaImpresa(cat, -1)} aria-label={`Subir ${cat}`}
                        className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" disabled={i === categoriasImpresas.length - 1} onClick={() => moverCategoriaImpresa(cat, 1)} aria-label={`Bajar ${cat}`}
                        className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-800 p-3">
              <iframe ref={previaRef} title="Vista previa de la lista de precios" srcDoc={htmlPrevia}
                className="block mx-auto w-full max-w-[816px] h-full min-h-[600px] bg-white rounded shadow-lg border-0" />
            </div>
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => setVista('lista')} className="h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Volver</button>
              <button type="button" onClick={imprimirAhora} className="h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Imprimir ahora</button>
            </div>
          </>
        ) : (
          <>
            {/* Encabezado */}
            <div className="p-4 pr-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0">
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">Lista de precios</DialogTitle>
                <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
                  Suba o baje por categoría, cambie el precio que quiera y quite lo que no va. Nada cambia en Ventas hasta que toque «Pasar a la app».
                </DialogDescription>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist" aria-label="Qué lista ver">
                {([['venta', 'Para venta'], ['insumos', 'Insumos']] as [ModoLista, string][]).map(([m, txt]) => (
                  <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => { setModo(m); setResultado(null); setConfirmar(null); }}
                    className={cn('h-9 rounded-lg text-sm font-black', modo === m ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300')}>{txt}</button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto o categoría…" aria-label="Buscar"
                  className="w-full h-11 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-orange-400" />
                {busqueda && <button type="button" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"><X className="w-4 h-4" /></button>}
              </div>
              {!esVenta && (
                <p className="text-sm text-slate-600 dark:text-slate-300">Insumos con su costo de compra, para ver e imprimir. Aquí no se cambian precios; sí puede cambiarles la categoría.</p>
              )}
              {esVenta && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Subir todo</span>
                  <Porcentaje valor={pctTodo} onCambio={ponerPctTodo} etiqueta="todo" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={aj.protegerHasta > 0} onChange={e => setAj(a => ({ ...a, protegerHasta: e.target.checked ? 1000 : 0 }))} className="w-4 h-4 accent-orange-600" />
                  No subir lo de $1.000 o menos
                </label>
                <button type="button" onClick={usarSugerenciasEnTodas} className="h-9 px-3 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-sm font-bold flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> Usar % sugeridos en todo
                </button>
              </div>}
            </div>

            {/* Lista por categoría */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {grupos.length === 0 && <p className="text-center text-slate-500 py-10">No hay productos con ese nombre.</p>}
              {grupos.map(g => {
                const abierta = !!busqueda || abiertas.has(g.categoria);
                const suben = g.filas.filter(f => f.nuevo !== f.actual).length;
                const pct = aj.pctPorCategoria[g.categoria] || 0;
                const base = sugerenciaBase(g.categoria);
                const ia = analisis[g.categoria];
                const filasCat = filas.filter(f => f.categoria === g.categoria);
                const puestos = filasCat.filter(f => !f.oculto).length;
                const posCat = todasCategorias.indexOf(g.categoria);
                return (
                  <section key={g.categoria} className={cn('rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden', puestos === 0 && 'opacity-60')}>
                    <div role="button" tabIndex={0} onClick={() => alternarCategoria(g.categoria)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarCategoria(g.categoria); } }}
                      className="flex items-center gap-2 sm:gap-3 p-3 cursor-pointer select-none">
                      <input type="checkbox" checked={puestos > 0} onClick={e => e.stopPropagation()} onChange={() => alternarImprimirCategoria(g.categoria)}
                        ref={el => { if (el) el.indeterminate = puestos > 0 && puestos < filasCat.length; }}
                        aria-label={`Imprimir la categoría ${g.categoria}`} title="Imprimir o no toda la categoría" className="w-5 h-5 accent-orange-600 shrink-0" />
                      <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                        <button type="button" disabled={!!busqueda || posCat <= 0} onClick={() => moverCategoriaPos(g.categoria, -1)} aria-label={`Subir la categoría ${g.categoria}`} title="Subir categoría"
                          className="p-0.5 rounded text-slate-500 hover:text-orange-600 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
                        <button type="button" disabled={!!busqueda || posCat < 0 || posCat >= todasCategorias.length - 1} onClick={() => moverCategoriaPos(g.categoria, 1)} aria-label={`Bajar la categoría ${g.categoria}`} title="Bajar categoría"
                          className="p-0.5 rounded text-slate-500 hover:text-orange-600 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
                      </div>
                      <ChevronDown className={cn('w-5 h-5 text-slate-400 transition-transform shrink-0', abierta && 'rotate-180')} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 dark:text-white truncate">{g.categoria}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {g.filas.length} productos{puestos < filasCat.length ? ` · ${puestos} se imprimen` : ''}{esVenta && suben ? ` · ${suben} cambian` : ''}{esVenta ? ` · sugerido ${base.pct}%` : ''}
                        </p>
                      </div>
                      {esVenta && <Porcentaje valor={pct} onCambio={n => ponerPctCategoria(g.categoria, n)} etiqueta={g.categoria} />}
                    </div>
                    {abierta && (
                      <div className="border-t border-slate-100 dark:border-slate-800">
                        {esVenta && <div className="p-3 space-y-2 bg-slate-50/60 dark:bg-slate-950/40">
                          <CajaAnalisis titulo="Sugerencia de la app" icono={<Lightbulb className="w-4 h-4" />} sug={base} tono="app" onUsar={() => ponerPctCategoria(g.categoria, base.pct)} />
                          {!ia && (
                            <button type="button" onClick={() => analizarConIA(g.categoria, g.filas)}
                              className="w-full h-10 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200 font-bold text-sm flex items-center justify-center gap-2">
                              <Sparkles className="w-4 h-4" /> Pedir análisis a la IA
                            </button>
                          )}
                          {ia?.estado === 'cargando' && (
                            <p className="text-sm text-violet-800 dark:text-violet-200 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> La IA está revisando {g.categoria}…</p>
                          )}
                          {ia?.estado === 'listo' && ia.sug && (
                            <CajaAnalisis titulo="Análisis de la IA" icono={<Sparkles className="w-4 h-4" />} sug={ia.sug} tono="ia" onUsar={() => ponerPctCategoria(g.categoria, ia.sug!.pct)} />
                          )}
                          {ia?.estado === 'listo' && !ia.sug && (
                            <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              <p className="font-black text-violet-900 dark:text-violet-200 mb-1">Respuesta de la IA</p>{ia.texto.slice(0, 1200)}
                            </div>
                          )}
                          {ia?.estado === 'error' && (
                            <div className="text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                              <span>La IA no respondió: {ia.mensaje} <button type="button" className="underline font-bold" onClick={() => analizarConIA(g.categoria, g.filas)}>Intentar otra vez</button></span>
                            </div>
                          )}
                        </div>}
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {g.filas.map(f => {
                            const cambia = f.nuevo !== f.actual;
                            const pos = filasCat.findIndex(x => x.id === f.id);
                            return (
                              <div key={f.id} className={cn('flex items-center gap-2 px-3 py-2', f.oculto && 'opacity-50')}>
                                <input type="checkbox" checked={!f.oculto} onChange={() => alternarOculto(f.id)} aria-label={`Mostrar ${f.nombre} en la lista`}
                                  title="Quitar o poner en la lista impresa" className="w-4 h-4 accent-orange-600 shrink-0" />
                                <div className="flex flex-col shrink-0">
                                  <button type="button" disabled={!!busqueda || pos <= 0} onClick={() => moverProductoPos(g.categoria, f.id, -1)} aria-label={`Subir ${f.nombre}`} title="Subir"
                                    className="p-0.5 rounded text-slate-500 hover:text-orange-600 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
                                  <button type="button" disabled={!!busqueda || pos < 0 || pos >= filasCat.length - 1} onClick={() => moverProductoPos(g.categoria, f.id, 1)} aria-label={`Bajar ${f.nombre}`} title="Bajar"
                                    className="p-0.5 rounded text-slate-500 hover:text-orange-600 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-semibold text-slate-800 dark:text-slate-100 break-words', f.oculto && 'line-through')}>{f.nombre}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                    {esVenta ? 'Ahora' : 'Costo'} {pesos(f.actual)}
                                    {cambia && <span className={cn('ml-1 font-bold', f.nuevo > f.actual ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                                      {f.nuevo > f.actual ? '+' : '−'}{pesos(Math.abs(f.nuevo - f.actual))}
                                    </span>}
                                  </p>
                                  <select value={opcionesCategoria.includes(f.categoria) ? f.categoria : ''} onChange={e => moverCategoria(f.id, f.nombre, e.target.value)} aria-label={`Categoría de ${f.nombre}`}
                                    className="mt-1 max-w-full h-7 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                                    {!opcionesCategoria.includes(f.categoria) && <option value="">{f.categoria === SIN_CATEGORIA ? 'Sin categoría — elegir…' : f.categoria}</option>}
                                    {opcionesCategoria.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                                {!esVenta ? <span className="w-24 text-right font-black tabular-nums text-slate-900 dark:text-white shrink-0">{pesos(f.actual)}</span> : <InputPesos value={f.nuevo} onValor={n => ponerManual(f.id, n, f.actual)} aria-label={`Precio nuevo ${f.nombre}`}
                                  className={cn('w-24 h-10 px-2 text-right rounded-lg border font-black tabular-nums outline-none bg-white dark:bg-slate-800 focus:border-orange-400',
                                    cambia ? 'border-emerald-400 text-emerald-800 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white')} />}
                                {f.manual
                                  ? <button type="button" onClick={() => quitarManual(f.id)} aria-label={`Volver al cálculo para ${f.nombre}`} title="Volver al cálculo con %" className="p-1.5 text-slate-400 hover:text-orange-600 shrink-0"><RotateCcw className="w-4 h-4" /></button>
                                  : <span className="w-7 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Pie con acciones */}
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {resultado ? (
                <div role="status" className={cn('rounded-xl border p-3 space-y-2',
                  resultado.ok === resultado.total ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800')}>
                  <p className={cn('font-black flex items-center gap-2', resultado.ok === resultado.total ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200')}>
                    {resultado.ok === resultado.total ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {resultado.ok === resultado.total
                      ? `Listo: se guardaron los ${resultado.total} precios nuevos.`
                      : `Se guardaron ${resultado.ok} de ${resultado.total}. Faltan ${resultado.total - resultado.ok}: toque «Pasar a la app» otra vez.`}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {resultado.verificado ? 'Revisé cada producto después de guardar y ya tiene el precio nuevo. ' : ''}Ventas ya cobra estos precios en este aparato; los otros celulares los reciben al sincronizar.
                  </p>
                  <ul className="text-sm text-slate-700 dark:text-slate-200 tabular-nums">
                    {resultado.ejemplos.map(e => <li key={e.nombre}>• {e.nombre}: {pesos(e.antes)} → <b>{pesos(e.ahora)}</b></li>)}
                    {resultado.total > resultado.ejemplos.length && <li className="text-slate-500">…y {resultado.total - resultado.ejemplos.length} más</li>}
                  </ul>
                  <button type="button" onClick={() => setResultado(null)} className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">Entendido</button>
                </div>
              ) : confirmar ? (
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
                      {trabajando ? 'Guardando…' : confirmar === 'aplicar' ? 'Sí, cambiar precios' : 'Sí, devolver precios'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <b>{cambios.length}</b> precios cambian · <b>{filas.length - ocultos}</b> en la lista{ocultos ? ` · ${ocultos} quitados` : ''}
                    {(Object.keys(aj.manuales).length > 0 || Object.values(aj.pctPorCategoria).some(Boolean) || ocultos > 0) && (
                      // El orden elegido se conserva al empezar de nuevo
                      <button type="button" onClick={() => { setAj({ ...AJUSTES_VACIOS, protegerHasta: aj.protegerHasta, ordenCategorias: aj.ordenCategorias, ordenProductos: aj.ordenProductos }); setPctTodo(0); }} className="ml-2 underline text-slate-500">Empezar de nuevo</button>
                    )}
                    <span className="ml-2 whitespace-nowrap">
                      <button type="button" onClick={() => ponerTodosEnLista(true)} className="underline font-bold text-slate-700 dark:text-slate-200">Marcar todo</button>
                      {' · '}
                      <button type="button" onClick={() => ponerTodosEnLista(false)} className="underline font-bold text-slate-700 dark:text-slate-200">Quitar todo</button>
                    </span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button type="button" onClick={() => setVista('previa')} className="h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Ver e imprimir</button>
                    <button type="button" onClick={copiarWhatsApp} className="h-11 rounded-xl border border-emerald-300 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
                    {esVenta && <button type="button" disabled={!cambios.length} onClick={() => setConfirmar('aplicar')}
                      className="col-span-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white font-black flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Pasar a la app{cambios.length ? ` (${cambios.length})` : ''}
                    </button>}
                  </div>
                  {respaldo && (
                    <button type="button" onClick={() => setConfirmar('deshacer')} className="w-full text-sm text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1 py-1">
                      <Undo2 className="w-4 h-4" /> Deshacer la última subida ({new Date(respaldo.fecha).toLocaleDateString('es-CO')}, {respaldo.precios.length} productos)
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
