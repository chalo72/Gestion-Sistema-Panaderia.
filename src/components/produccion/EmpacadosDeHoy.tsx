import { useEffect, useMemo, useState } from 'react';
import { Package, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { dbNube } from '@/lib/nube-kv';
import { cargarDesdeNube, NOMBRES_DIA, type Despacho } from '@/lib/rutas-reparto';
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
  const [editando, setEditando] = useState(false);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [bases, setBases] = useState<Record<string, number>>(() => cargarBasesLocal());

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
  const dia = NOMBRES_DIA[new Date().getDay()];

  const cambiarBase = (id: string, v: string) => {
    const n = Math.max(0, Math.round(parseFloat(v.replace(/[^\d.]/g, '')) || 0));
    const nuevo = { ...bases, [id]: n };
    setBases(nuevo);
    guardarBasesLocal(nuevo);
  };

  const guardarBases = async () => {
    setEditando(false);
    try { await dbNube.saveBackup(CLAVE_NUBE_BASES, bases); toast.success('Números base guardados'); }
    catch { toast.info('Guardado en este aparato; se sube cuando haya internet.'); }
  };

  return (
    <div className="rounded-3xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 max-w-5xl mx-auto">
      <button type="button" onClick={() => setAbierto(a => !a)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-700" />
          <span className="text-base font-black text-slate-950 dark:text-white">Empacados de hoy</span>
          <span className="text-sm font-bold text-amber-800 dark:text-amber-200">· hacer {total} en total</span>
        </span>
        {abierto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {abierto && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Sale de lo que se vendió en la panadería y en las rutas los últimos {dia}, menos lo que ya hay empacado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-black text-slate-700 dark:text-slate-300">
                  <th className="py-1 pr-2">Pan</th>
                  <th className="py-1 px-1 text-center">Panadería</th>
                  <th className="py-1 px-1 text-center">Rutas</th>
                  <th className="py-1 px-1 text-center">Hay</th>
                  <th className="py-1 pl-1 text-center">Hacer</th>
                  {editando && <th className="py-1 pl-2 text-center">Base</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.productoId} className="border-t border-amber-200 dark:border-amber-900 font-bold text-slate-900 dark:text-slate-100">
                    <td className="py-1.5 pr-2">{f.nombre}</td>
                    <td className="py-1.5 px-1 text-center">{f.porBase ? '–' : f.promTienda}</td>
                    <td className="py-1.5 px-1 text-center">{f.porBase ? '–' : f.promRuta}</td>
                    <td className="py-1.5 px-1 text-center">{f.stock}</td>
                    <td className="py-1.5 pl-1 text-center">
                      <span className="inline-block min-w-[2.5rem] rounded-lg bg-amber-600 text-white font-black px-2 py-0.5">{f.hacer}</span>
                      {f.porBase && <span className="block text-[10px] text-amber-800 dark:text-amber-200">número base</span>}
                    </td>
                    {editando && (
                      <td className="py-1.5 pl-2 text-center">
                        <input
                          inputMode="numeric"
                          aria-label={`Número base ${f.nombre}`}
                          className="w-16 h-9 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 text-center font-black"
                          value={f.base || ''}
                          onChange={e => cambiarBase(f.productoId, e.target.value)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.some(f => f.porBase) && !editando && (
            <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
              Los panes sin ventas registradas todavía usan el número base. Póngalo en «Editar números base».
            </p>
          )}
          <button
            type="button"
            onClick={() => (editando ? guardarBases() : setEditando(true))}
            className="h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-amber-600 text-amber-800 dark:text-amber-200 text-sm font-black flex items-center gap-1"
          >
            <Pencil className="w-4 h-4" /> {editando ? 'Guardar números base' : 'Editar números base'}
          </button>
        </div>
      )}
    </div>
  );
}
