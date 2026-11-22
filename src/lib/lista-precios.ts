/**
 * Lista de precios interactiva (2026-11-21, pedido de Gonzalo).
 *
 * Subió la luz y el gas: Gonzalo quiere subir (o bajar) precios por categoría con un %, cambiar
 * a mano el que quiera, quitar de la lista lo que no va, imprimir para las vendedoras y, cuando
 * esté seguro, pasar los precios nuevos a los productos.
 */
import { escapeHtml } from '@/lib/utils';
import { esNombreBasura } from '@/lib/busqueda-productos';

export interface ProductoLista {
  id: string;
  nombre: string;
  categoria?: string;
  precioVenta: number;
  tipo?: string;
}

export interface FilaPrecio {
  id: string;
  nombre: string;
  categoria: string;
  actual: number;
  nuevo: number;
  manual: boolean; // el precio nuevo lo escribió Gonzalo a mano
  oculto: boolean; // quitado de la lista impresa
}

export interface AjustesLista {
  pctPorCategoria: Record<string, number>;
  manuales: Record<string, number>; // id → precio escrito a mano
  ocultos: string[];                // ids quitados de la lista
  protegerHasta: number;            // no subir lo que vale esto o menos (0 = subir todo)
}

export const AJUSTES_VACIOS: AjustesLista = { pctPorCategoria: {}, manuales: {}, ocultos: [], protegerHasta: 0 };

/** Precio de venta, no insumo, no basura de prueba. */
export function entraEnLista(p: ProductoLista): boolean {
  const pv = Number(p.precioVenta) || 0;
  return pv > 0 && pv < 1_000_000 && p.tipo !== 'ingrediente' && !esNombreBasura(p.nombre);
}

/** Tortas y precios grandes de 1.000 en 1.000; desde $1.000 de 100 en 100; menos de $1.000 de 50 en 50. */
export function pasoRedondeo(precio: number): number {
  if (precio >= 20000) return 1000;
  if (precio >= 1000) return 100;
  return 50;
}

/** Sube (o baja, con % negativo) y redondea. Nunca deja un precio en $0. */
export function precioConPorcentaje(actual: number, pct: number, protegerHasta = 0): number {
  if (!pct || !actual) return actual;
  if (pct > 0 && protegerHasta > 0 && actual <= protegerHasta) return actual;
  const paso = pasoRedondeo(actual);
  const r = Math.round((actual * (1 + pct / 100)) / paso) * paso;
  return Math.max(paso, r);
}

export const categoriaDe = (p: { categoria?: string }) => (p.categoria || '').trim() || 'Sin categoría';

export function armarFilas(productos: ProductoLista[], aj: AjustesLista): FilaPrecio[] {
  const ocultos = new Set(aj.ocultos);
  return productos
    .filter(entraEnLista)
    .map(p => {
      const categoria = categoriaDe(p);
      const actual = Math.round(Number(p.precioVenta));
      const manual = aj.manuales[p.id];
      const tieneManual = typeof manual === 'number' && manual > 0;
      return {
        id: p.id,
        nombre: p.nombre.trim().replace(/\s+/g, ' '),
        categoria,
        actual,
        nuevo: tieneManual ? manual : precioConPorcentaje(actual, aj.pctPorCategoria[categoria] || 0, aj.protegerHasta),
        manual: tieneManual,
        oculto: ocultos.has(p.id),
      };
    })
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}

export function agruparPorCategoria(filas: FilaPrecio[]): { categoria: string; filas: FilaPrecio[] }[] {
  const m = new Map<string, FilaPrecio[]>();
  for (const f of filas) { if (!m.has(f.categoria)) m.set(f.categoria, []); m.get(f.categoria)!.push(f); }
  return Array.from(m, ([categoria, fs]) => ({ categoria, filas: fs }));
}

/** Los que de verdad cambian de precio (para "Aplicar"). */
export const cambiosParaAplicar = (filas: FilaPrecio[]) => filas.filter(f => f.nuevo !== f.actual && f.nuevo > 0);

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function textoWhatsApp(filas: FilaPrecio[], soloCambios: boolean): string {
  const lineas = [soloCambios ? '*Dulce Placer · Precios nuevos*' : '*Dulce Placer · Lista de precios*', ''];
  for (const g of agruparPorCategoria(filas.filter(f => !f.oculto && (!soloCambios || f.nuevo !== f.actual)))) {
    lineas.push(`*${g.categoria}*`);
    for (const f of g.filas) lineas.push(`${capital(f.nombre)}: ${pesos(f.nuevo)}${f.nuevo !== f.actual ? ` (antes ${pesos(f.actual)})` : ''}`);
    lineas.push('');
  }
  return lineas.join('\n').trim();
}

/** Hoja para imprimir: precio nuevo grande, dos columnas, por categoría. Todo el texto va escapado. */
export function htmlImpresion(filas: FilaPrecio[], negocio: string, fecha: string): string {
  const grupos = agruparPorCategoria(filas.filter(f => !f.oculto)).map(g => `
    <section><h2>${escapeHtml(g.categoria)}</h2>
      ${g.filas.map(f => `<div class="f"><span>${escapeHtml(capital(f.nombre))}</span><b>${pesos(f.nuevo)}</b></div>`).join('')}
    </section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Lista de precios</title>
<style>
  @page { size: letter; margin: 12mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; font-size: 12.5px; }
  h1 { font-size: 20px; margin: 0; } .fecha { color: #555; margin: 2px 0 12px; }
  .cols { columns: 2; column-gap: 24px; }
  section { break-inside: avoid; margin-bottom: 12px; }
  h2 { font-size: 14px; margin: 0 0 4px; padding-bottom: 2px; border-bottom: 2px solid #111; }
  .f { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px dotted #bbb; }
  .f b { white-space: nowrap; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>${escapeHtml(negocio)} · Lista de precios</h1><p class="fecha">${escapeHtml(fecha)}</p>
<div class="cols">${grupos}</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`;
}

// ── Borrador guardado en este aparato y respaldo antes de aplicar ──
const LS_AJUSTES = 'dp_lista_precios_ajustes';
const LS_RESPALDO = 'dp_lista_precios_respaldo';

export function cargarAjustes(): AjustesLista {
  try {
    const v = JSON.parse(localStorage.getItem(LS_AJUSTES) || 'null');
    return v && typeof v === 'object' ? { ...AJUSTES_VACIOS, ...v } : { ...AJUSTES_VACIOS };
  } catch { return { ...AJUSTES_VACIOS }; }
}
export function guardarAjustes(a: AjustesLista) { try { localStorage.setItem(LS_AJUSTES, JSON.stringify(a)); } catch { /* lleno */ } }

export interface Respaldo { fecha: string; precios: { id: string; nombre: string; precio: number }[] }
export function guardarRespaldo(r: Respaldo) { try { localStorage.setItem(LS_RESPALDO, JSON.stringify(r)); } catch { /* lleno */ } }
export function cargarRespaldo(): Respaldo | null {
  try { const v = JSON.parse(localStorage.getItem(LS_RESPALDO) || 'null'); return v?.precios?.length ? v : null; } catch { return null; }
}
export function borrarRespaldo() { try { localStorage.removeItem(LS_RESPALDO); } catch { /* nada */ } }
