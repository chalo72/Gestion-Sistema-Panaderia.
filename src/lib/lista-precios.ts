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
  costoBase?: number;
}

/** Qué lista se arma: lo de venta (con precios editables) o los insumos (solo para ver e imprimir su costo). */
export type ModoLista = 'venta' | 'insumos';

/** Categorías de pan que Gonzalo quiere separar (2026-11-22). */
export const CATEGORIAS_PAN = ['Pan de dulce', 'Pan de sal', 'Pan hojaldrado'];

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

/** Insumo con algún valor (costo o precio) para la lista de insumos. */
export function entraEnInsumos(p: ProductoLista): boolean {
  const v = (Number(p.costoBase) || 0) || (Number(p.precioVenta) || 0);
  return p.tipo === 'ingrediente' && v > 0 && v < 10_000_000 && !esNombreBasura(p.nombre);
}

export function armarFilas(productos: ProductoLista[], aj: AjustesLista, modo: ModoLista = 'venta'): FilaPrecio[] {
  const ocultos = new Set(aj.ocultos);
  if (modo === 'insumos') {
    return productos.filter(entraEnInsumos).map(p => {
      const v = Math.round((Number(p.costoBase) || 0) || Number(p.precioVenta));
      return { id: p.id, nombre: p.nombre.trim().replace(/\s+/g, ' '), categoria: categoriaDe(p), actual: v, nuevo: v, manual: false, oculto: ocultos.has(p.id) };
    }).sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  }
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

/**
 * Hoja para imprimir: precio nuevo grande, dos columnas, por categoría. Todo el texto va escapado.
 * Sin script: la vista previa la muestra dentro de la app y el botón Imprimir llama a print().
 */
export type Papel = 'oficio' | 'carta';
export const MEDIDAS_PAPEL: Record<Papel, string> = { oficio: '216mm 330mm', carta: '216mm 279mm' };

export function htmlImpresion(filas: FilaPrecio[], negocio: string, fecha: string, papel: Papel = 'oficio', titulo = 'Lista de precios'): string {
  // Cada categoría va entera (no se parte entre columnas ni hojas); las columnas se llenan en orden,
  // así una categoría corta entra debajo de una larga en la misma hoja.
  const grupos = agruparPorCategoria(filas.filter(f => !f.oculto)).map(g => `
    <section><h2>${escapeHtml(g.categoria)}</h2>
      ${g.filas.map(f => `<div class="f"><strong>${escapeHtml(capital(f.nombre))}</strong><b>${pesos(f.nuevo)}</b></div>`).join('')}
    </section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>
  @page { size: ${MEDIDAS_PAPEL[papel]}; margin: 10mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; font-size: 12.5px; }
  h1 { font-size: 20px; margin: 0; } .fecha { color: #555; margin: 2px 0 10px; }
  .cols { columns: 2; column-gap: 22px; column-fill: auto; }
  section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
  h2 { font-size: 17px; font-weight: 800; color: #c1121f; text-decoration: underline; text-underline-offset: 3px; margin: 0 0 4px; }
  .f { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px dotted #bbb; }
  .f strong { font-weight: 700; }
  .f b { white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media screen { body { padding: 14px; } .cols { column-fill: balance; } }
</style></head><body>
<h1>${escapeHtml(negocio)} · ${escapeHtml(titulo)}</h1><p class="fecha">${escapeHtml(fecha)}</p>
<div class="cols">${grupos}</div>
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

// ── Sugerencia y análisis por categoría (2026-11-22) ──

/**
 * Números reales del negocio para la subida de noviembre 2026 (ver CORE_MEMORY):
 * luz 700.000 → 1.300.000 y gas 240.000 → 280.000 al mes (lo dijo Gonzalo);
 * venta diaria de julio 2026 = $46,5M en 28 días; Libreta del Horno sep–oct 2026.
 */
export const DATOS_NEGOCIO_PRECIOS = [
  'Panadería Dulce Placer, Canalete (Córdoba, Colombia). Pueblo: la gente es sensible a los precios.',
  'Luz (casa + local): antes $700.000, ahora $1.300.000 al mes (+$600.000).',
  'Gas: antes $240.000, ahora $280.000 (+$40.000). Total a recuperar ≈ $640.000 al mes.',
  'Ventas registradas julio 2026: $46.539.471 en 28 días. Caja Principal $30.857.100, Helados $4.939.800, Tortas $3.829.500.',
  'Libreta del Horno sep–oct 2026: el horno trabaja 25–27 días al mes, 800 a 1.100 panes por día; vale ≈ $25.000.000 al mes a precio público; el 44% de esa plata es pan de $1.000 o menos.',
].join('\n');

export type FamiliaPrecio = 'horno' | 'tortas' | 'helados' | 'reventa';

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function familiaDeCategoria(categoria: string): FamiliaPrecio {
  const c = sinTildes(categoria);
  if (/torta|pasteler/.test(c)) return 'tortas';
  if (/helad/.test(c)) return 'helados';
  if (/(^|\s)pan(es)?(\s|$)|pan empacado|frito|hojaldr|hoijas|hojas|reposter|palito|empanad|bunuel/.test(c)) return 'horno';
  return 'reventa';
}

export interface Sugerencia { pct: number; porque: string; paraQue: string; razon: string }

/** Sugerencia de la app (cálculo fijo con los datos de arriba, NO es IA). */
export function sugerenciaBase(categoria: string): Sugerencia {
  switch (familiaDeCategoria(categoria)) {
    case 'horno': return {
      pct: 7,
      porque: 'El horno gasta gas y luz casi todos los días (25 a 27 días al mes).',
      paraQue: 'Recuperar parte de los $640.000 al mes que subieron la luz y el gas.',
      razon: 'Es lo que más plata mueve. Con 7% en el pan de más de $1.000 entran unos $800.000 al mes sin tocar el pan barato.',
    };
    case 'tortas': return {
      pct: 5,
      porque: 'Las tortas usan horno y nevera.',
      paraQue: 'Cubrir luz y gas sin espantar al cliente de encargo.',
      razon: 'Con 5% una torta media pasa de $30.000 a $32.000. Tortas vendió $3,8 millones en julio: son unos $190.000 al mes.',
    };
    case 'helados': return {
      pct: 5,
      porque: 'Los congeladores están prendidos día y noche: es pura luz.',
      paraQue: 'Que el helado pague la luz que gasta.',
      razon: 'Helados vendió $4,9 millones en julio; 5% son unos $240.000 al mes.',
    };
    default: return {
      pct: 0,
      porque: 'Este precio lo pone la fábrica y la gente lo compara con la tienda de al lado.',
      paraQue: 'No perder clientes por una gaseosa o un mecato más caro.',
      razon: 'Súbalo solo cuando le suba el proveedor (Recepción avisa cuando cambia el costo).',
    };
  }
}

/** Datos que se le mandan a la IA para una categoría: solo cifras reales de la app. */
export function contextoCategoria(categoria: string, filas: FilaPrecio[], costos: Record<string, number>): string {
  const lista = filas.slice(0, 40).map(f => {
    const c = costos[f.id];
    return `- ${f.nombre}: $${f.actual}${c > 0 ? ` (costo $${Math.round(c)})` : ''}`;
  }).join('\n');
  return `${DATOS_NEGOCIO_PRECIOS}\n\nCategoría: ${categoria} (${filas.length} productos)\n${lista}`;
}

export function preguntaCategoria(categoria: string): string {
  return `Analiza la categoría «${categoria}» para la subida de precios por la luz y el gas.
Responde SOLO un JSON, sin texto extra, así:
{"pct": número entero de 0 a 15, "porque": "por qué subir (o no) esta categoría", "paraQue": "para qué sirve subirla", "razon": "la razón con números de los datos"}
Reglas: frases cortas en español sencillo para el dueño; usa solo los números de los datos; si no conviene subir, pct = 0 y explica por qué.`;
}

/** Lee la respuesta de la IA. Si no trae el JSON esperado devuelve null (se muestra el texto tal cual). */
export function leerAnalisisIA(texto: string): Sugerencia | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const pct = Math.round(Number(o.pct));
    if (!Number.isFinite(pct) || pct < 0 || pct > 30) return null;
    const t = (v: unknown) => String(v ?? '').trim();
    if (!t(o.porque) && !t(o.razon)) return null;
    return { pct, porque: t(o.porque), paraQue: t(o.paraQue), razon: t(o.razon) };
  } catch { return null; }
}

/** Después de «Pasar a la app»: cuántos productos ya tienen guardado el precio nuevo. */
export function verificarGuardado(esperado: { id: string; nuevo: number }[], guardados: { id: string; precioVenta: number }[]) {
  const porId = new Map(guardados.map(p => [p.id, Math.round(Number(p.precioVenta))]));
  const fallaron = esperado.filter(e => porId.get(e.id) !== e.nuevo);
  return { ok: esperado.length - fallaron.length, total: esperado.length, fallaron: fallaron.map(f => f.id) };
}
