import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import { dbNube } from '@/lib/nube-kv';
import { cargarDesdeNube, type Despacho } from '@/lib/rutas-reparto';
import {
  calcularEmpacados, cargarBasesLocal, guardarBasesLocal, CLAVE_NUBE_BASES,
  type ProductoEmpaque, type VentaLite,
} from '@/lib/empacados-hoy';

/** Tarjeta para el panadero: cuánto pan de empaque hacer hoy (2026-11-19). */
export function EmpacadosDeHoy({ productos, ventas, inventario }: {
  productos: ProductoEmpaque[];
  ventas: VentaLite[];
  inventario: { productoId: string; stockActual: number }[];
}) {
  const [abierto, setAbierto] = useState(true);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [bases, setBases] = useState<Record<string, number>>(() => cargarBasesLocal());
  const subir = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarDesdeNube(dbNube).then(r => { if (vivo) setDespachos(r.despachos); }).catch(() => {});
    dbNube.getBackup(CLAVE_NUBE_BASES).then((nube: any) => {
      if (!vivo || !nube || typeof nube !== 'object') return;
      setBases(prev => {
        const junto = { ...nube, ...prev };
        guardarBasesLocal(junto);
        return junto;
      });
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const stock = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of inventario || []) m[i.productoId] = (m[i.productoId] || 0) + (Number(i.stockActual) || 0);
    return m;
  }, [inventario]);

  const filas = useMemo(
    () => calcularEmpacados({ productos, ventas, despachos, stock, bases }),
    [productos, ventas, despachos, stock, bases],
  );

  if (filas.length === 0) return null;
  const total = filas.reduce((s, f) => s + f.hacer, 0);

  // Se guarda en el aparato al escribir y se sube a la nube un momento después
  const cambiarBase = (id: string, v: string) => {
    const n = Math.max(0, Math.round(parseFloat(v.replace(/[^\d]/g, '')) || 0));
    const nuevo = { ...bases, [id]: n };
    setBases(nuevo);
    guardarBasesLocal(nuevo);
    if (subir.current) clearTimeout(subir.current);
    subir.current = setTimeout(() => { dbNube.saveBackup(CLAVE_NUBE_BASES, nuevo).catch(() => {}); }, 1500);
  };

  return (
    <div className="rounded-3xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 max-w-5xl mx-auto">
      <button type="button" onClick={() => setAbierto(a => !a)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 flex-wrap">
          <Package className="w-5 h-5 text-amber-700" />
          <span className="text-base font-black text-slate-950 dark:text-white">Pan empacado: cuánto hacer hoy</span>
          <span className="rounded-full bg-amber-600 text-white text-sm font-black px-3 py-0.5">{total} en total</span>
        </span>
        {abierto ? <ChevronUp className="w-5 h-5 text-slate-700" /> : <ChevronDown className="w-5 h-5 text-slate-700" />}
      </button>

      {abierto && (
        <div className="mt-3 space-y-2">
          {filas.map(f => (
            <div key={f.productoId} className="rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-slate-950 dark:text-white">{f.nombre}</p>
                {f.porBase ? (
                  <label className="mt-1 flex items-center gap-2 flex-wrap text-sm font-bold text-slate-700 dark:text-slate-200">
                    ¿Cuántos se hacen normalmente?
                    <input
                      inputMode="numeric"
                      aria-label={`Cuántos se hacen normalmente de ${f.nombre}`}
                      className="w-20 h-10 rounded-xl border-2 border-amber-400 bg-white dark:bg-slate-950 text-center text-base font-black text-slate-950 dark:text-white"
                      value={f.base || ''}
                      placeholder="0"
                      onChange={e => cambiarBase(f.productoId, e.target.value)}
                    />
                  </label>
                ) : (
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Se venden unos {f.promTienda} aquí y {f.promRuta} en rutas
                  </p>
                )}
                {f.stock > 0 && (
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Ya hay {f.stock} empacados</p>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-200">Hacer</p>
                <p className="text-3xl font-black text-amber-700 dark:text-amber-300 leading-none">{f.hacer}</p>
              </div>
            </div>
          ))}
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Cuando estos panes se vendan en el Punto de Venta y salgan en las rutas, el número se calcula solo.
          </p>
        </div>
      )}
    </div>
  );
}
