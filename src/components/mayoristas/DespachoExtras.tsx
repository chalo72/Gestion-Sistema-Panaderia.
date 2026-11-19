import { useMemo, useState } from 'react';
import { Home, Plus, Trash2, MessageCircle, Store, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/safe-utils';
import {
  horaLocal, resumenDespacho, analizarCasaEnCasa,
  type Despacho, type MetodoCobro, type VentaCasa, type CatalogoLinea,
} from '@/lib/rutas-reparto';
import { enlaceWhatsapp, type DatosTienda } from '@/lib/despachos-nube';

/** Piezas del Despacho agregadas el 2026-11-19 (pedido de Gonzalo). */

const campo = 'h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-base font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500';
const soloNumero = (v: string) => { const x = parseFloat(v.replace(/[^\d.]/g, '')); return Number.isFinite(x) && x > 0 ? x : 0; };

// ── Crear pan nuevo desde el despacho ──────────────────────────────────────────
export function CrearPanRapido({ nombreInicial, onCrear, onCancelar }: {
  nombreInicial: string;
  onCrear: (d: { nombre: string; precioPublico: number; precioMayorista: number }) => Promise<CatalogoLinea | null>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [publico, setPublico] = useState('');
  const [mayor, setMayor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const pPub = soloNumero(publico);
  const pMay = soloNumero(mayor);
  const listo = nombre.trim().length >= 2 && pPub > 0 && pMay > 0;
  return (
    <div className="rounded-2xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 p-3 space-y-2">
      <p className="text-sm font-black text-indigo-900 dark:text-indigo-100">Pan nuevo (queda en Gestión de Productos, categoría Panes)</p>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Nombre del pan
        <input className={cn(campo, 'w-full mt-1')} value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Precio al público (unidad)
          <input className={cn(campo, 'w-full mt-1')} inputMode="numeric" placeholder="Ej: 500" value={publico} onChange={e => setPublico(e.target.value)} />
        </label>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Precio por mayor (tienda)
          <input className={cn(campo, 'w-full mt-1')} inputMode="numeric" placeholder="Ej: 400" value={mayor} onChange={e => setMayor(e.target.value)} />
        </label>
      </div>
      {pPub > 0 && pMay > pPub && <p className="text-xs font-bold text-rose-700">El precio por mayor no puede ser más alto que el del público.</p>}
      <div className="flex gap-2">
        <button type="button" disabled={!listo || pMay > pPub || guardando}
          onClick={async () => {
            setGuardando(true);
            try { await onCrear({ nombre: nombre.trim(), precioPublico: pPub, precioMayorista: pMay }); }
            finally { setGuardando(false); }
          }}
          className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm disabled:opacity-40">
          {guardando ? 'Creando…' : 'Crear y cargar al carro'}
        </button>
        <button type="button" onClick={onCancelar} className="h-11 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
      </div>
    </div>
  );
}

// ── Ventas casa en casa durante la ruta ────────────────────────────────────────
export function VentasCasaEnCasa({ d, bloqueado, formatCurrency, onCambiar }: {
  d: Despacho; bloqueado: boolean; formatCurrency: (v: number) => string; onCambiar: (d: Despacho) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');
  const [metodo, setMetodo] = useState<MetodoCobro>('efectivo');
  const r = useMemo(() => resumenDespacho(d), [d]);
  const ventas = d.ventasCasa || [];
  const linea = d.carga.find(c => c.productoId === productoId);
  const precioSugerido = linea ? Math.round(linea.precioPublico || linea.precioUnit) : 0;
  const quedan = productoId ? (r.filas.find(f => f.productoId === productoId)?.esperadoRegreso ?? 0) : 0;

  const elegir = (id: string) => {
    setProductoId(id);
    const l = d.carga.find(c => c.productoId === id);
    setPrecio(l ? String(Math.round(l.precioPublico || l.precioUnit)) : '');
  };

  const guardar = () => {
    const cant = soloNumero(cantidad);
    const p = soloNumero(precio) || precioSugerido;
    if (!linea || cant <= 0 || p <= 0) { toast.error('Escoge el pan, la cantidad y el precio.'); return; }
    if (cant > quedan) { toast.error(`En el carro solo quedan ${quedan} de ${linea.nombre}.`); return; }
    const v: VentaCasa = {
      id: generateUUID(), hora: horaLocal(), productoId: linea.productoId, nombre: linea.nombre,
      cantidad: cant, precioUnit: p, costoUnit: linea.costoUnit, metodo,
    };
    onCambiar({ ...d, ventasCasa: [...ventas, v] });
    toast.success(`Venta casa en casa: ${cant} ${linea.nombre} · ${formatCurrency(cant * p)}`);
    setCantidad('1');
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-600 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-2">
          <Home className="w-4 h-4 text-emerald-700" /> Casa en casa
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {r.ventasCasaCount} ventas · {r.totalVendidoCasa} panes · {formatCurrency(r.ventaCasa)}
          </span>
        </p>
        {!bloqueado && !abierto && (
          <button type="button" onClick={() => setAbierto(true)}
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Venta casa en casa
          </button>
        )}
      </div>
      {abierto && !bloqueado && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100">No hace falta el nombre del cliente. Se guarda la hora sola.</p>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Pan
            <select className={cn(campo, 'w-full mt-1')} value={productoId} onChange={e => elegir(e.target.value)}>
              <option value="">Escoge el pan del carro…</option>
              {d.carga.map(c => <option key={c.productoId} value={c.productoId}>{c.nombre}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Cantidad
              <input className={cn(campo, 'w-full mt-1 text-center')} inputMode="numeric" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Precio c/u
              <input className={cn(campo, 'w-full mt-1 text-center')} inputMode="numeric" value={precio} placeholder={precioSugerido ? String(precioSugerido) : ''} onChange={e => setPrecio(e.target.value)} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Pagó con
              <select className={cn(campo, 'w-full mt-1 px-1')} value={metodo} onChange={e => setMetodo(e.target.value as MetodoCobro)}>
                <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option>
              </select>
            </label>
          </div>
          {productoId && <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Quedan en el carro: {quedan}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={guardar} className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm">Guardar venta</button>
            <button type="button" onClick={() => setAbierto(false)} className="h-11 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300">Cerrar</button>
          </div>
        </div>
      )}
      {ventas.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...ventas].reverse().map(v => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="font-bold text-slate-800 dark:text-slate-100">{v.hora} · {v.cantidad} {v.nombre}</span>
              <span className="flex items-center gap-2">
                <span className="font-black">{formatCurrency(v.cantidad * v.precioUnit)}</span>
                <span className="text-[10px] font-bold uppercase text-slate-500">{v.metodo}</span>
                {!bloqueado && (
                  <button type="button" aria-label={`Quitar venta de las ${v.hora}`} className="p-1 text-slate-400 hover:text-rose-600"
                    onClick={() => onCambiar({ ...d, ventasCasa: ventas.filter(x => x.id !== v.id) })}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Datos de la tienda: dueño, WhatsApp, barrio ────────────────────────────────
export function DatosTiendaParada({ clienteId, nombreTienda, telefono, direccion, datos, onGuardar }: {
  clienteId: string; nombreTienda: string; telefono?: string; direccion?: string;
  datos?: DatosTienda; onGuardar: (t: DatosTienda) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [dueno, setDueno] = useState(datos?.dueno || '');
  const [whatsapp, setWhatsapp] = useState(datos?.whatsapp || telefono || '');
  const [barrio, setBarrio] = useState(datos?.barrio || '');
  const wa = enlaceWhatsapp(datos?.whatsapp || telefono, `Hola, le habla Dulce Placer.`);
  if (!editando) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-700 dark:text-slate-200">
        <Store className="w-3.5 h-3.5" />
        <span>{datos?.dueno ? `Dueño: ${datos.dueno}` : 'Sin dueño anotado'}</span>
        {datos?.barrio && <span>· {datos.barrio}</span>}
        {direccion && <span>· {direccion}</span>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="text-emerald-700 underline flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
        <button type="button" onClick={() => setEditando(true)} className="text-indigo-700 underline">Editar datos de la tienda</button>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2 space-y-2">
      <p className="text-xs font-black text-slate-800 dark:text-slate-100">Datos de {nombreTienda}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className={campo} aria-label="Dueño de la tienda" placeholder="Dueño" value={dueno} onChange={e => setDueno(e.target.value)} />
        <input className={campo} aria-label="WhatsApp" inputMode="tel" placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
        <input className={campo} aria-label="Barrio" placeholder="Barrio" value={barrio} onChange={e => setBarrio(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center gap-1"
          onClick={async () => {
            try {
              await onGuardar({ clienteId, dueno: dueno.trim(), whatsapp: whatsapp.trim(), barrio: barrio.trim(), actualizadoEn: Date.now() });
              toast.success('Datos de la tienda guardados');
              setEditando(false);
            } catch { toast.error('Se guardó en este aparato; se sube cuando haya internet.'); setEditando(false); }
          }}><Save className="w-4 h-4" /> Guardar</button>
        <button type="button" onClick={() => setEditando(false)} className="h-10 px-3 text-sm font-bold text-slate-600">Cancelar</button>
      </div>
    </div>
  );
}

// ── Análisis: casa en casa vs. tiendas ─────────────────────────────────────────
export function SeccionCasaEnCasa({ despachos, formatCurrency }: { despachos: Despacho[]; formatCurrency: (v: number) => string }) {
  const [dias, setDias] = useState(30);
  const desde = useMemo(() => { const x = new Date(); x.setDate(x.getDate() - dias); return x.toISOString().slice(0, 10); }, [dias]);
  const a = useMemo(() => analizarCasaEnCasa(despachos.filter(d => d.fecha >= desde)), [despachos, desde]);
  const total = a.valorCasa + a.valorTiendas;
  const pctCasa = total > 0 ? (a.valorCasa / total) * 100 : 0;
  const maxDia = Math.max(1, ...a.porDia.map(x => x.valorCasa + x.valorTiendas));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {[7, 30, 90].map(n => (
          <button key={n} type="button" onClick={() => setDias(n)}
            className={cn('h-10 px-4 rounded-full text-sm font-bold border-2', dias === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200')}>
            Últimos {n} días
          </button>
        ))}
      </div>
      {a.despachos === 0 ? (
        <Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center text-slate-500 font-bold">No hay despachos en este periodo.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Vendido en tiendas', v: formatCurrency(a.valorTiendas) },
              { l: 'Vendido casa en casa', v: formatCurrency(a.valorCasa) },
              { l: 'Casa en casa del total', v: `${pctCasa.toFixed(0)}%` },
              { l: 'Ventas casa en casa', v: `${a.ventasCasa} (${a.unidadesCasa} panes)` },
            ].map(k => (
              <Card key={k.l} className="rounded-2xl"><CardContent className="p-3">
                <p className="text-[11px] font-bold uppercase text-slate-500">{k.l}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{k.v}</p>
              </CardContent></Card>
            ))}
          </div>
          <Card className="rounded-2xl"><CardContent className="p-3 space-y-2">
            <p className="text-sm font-black text-slate-900 dark:text-white">Por ruta</p>
            {a.porRuta.map(r => (
              <div key={r.ruta} className="flex justify-between gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-1">
                <span>{r.ruta}</span>
                <span>Tiendas {formatCurrency(r.valorTiendas)} · Casa en casa {formatCurrency(r.valorCasa)} ({r.unidadesCasa} panes)</span>
              </div>
            ))}
          </CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3 space-y-1.5">
            <p className="text-sm font-black text-slate-900 dark:text-white">Por día de la semana</p>
            {a.porDia.map(x => (
              <div key={x.dia} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="w-8">{x.dia}</span>
                <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden flex" aria-hidden>
                  <div className="bg-indigo-500 h-full" style={{ width: `${(x.valorTiendas / maxDia) * 100}%` }} />
                  <div className="bg-emerald-500 h-full" style={{ width: `${(x.valorCasa / maxDia) * 100}%` }} />
                </div>
                <span className="w-40 text-right">{formatCurrency(x.valorTiendas)} / {formatCurrency(x.valorCasa)}</span>
              </div>
            ))}
            <p className="text-[11px] font-bold text-slate-500">Morado: tiendas · Verde: casa en casa</p>
          </CardContent></Card>
          {a.porPan.length > 0 && (
            <Card className="rounded-2xl"><CardContent className="p-3 space-y-1">
              <p className="text-sm font-black text-slate-900 dark:text-white">Panes más vendidos casa en casa</p>
              {a.porPan.slice(0, 10).map(p => (
                <div key={p.productoId} className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-1">
                  <span>{p.nombre}</span><span>{p.unidades} panes · {formatCurrency(p.valor)}</span>
                </div>
              ))}
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
