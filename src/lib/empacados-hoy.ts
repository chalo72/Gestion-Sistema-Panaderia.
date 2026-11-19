import { fechaLocal, esCategoriaPan, type Despacho } from '@/lib/rutas-reparto';

/**
 * "Empacados de hoy" (2026-11-19, pedido de Gonzalo).
 *
 * El panadero pregunta: ¿cuánto pan de empaque hacemos hoy? La respuesta sale de:
 *   lo que se vende en la panadería (promedio de los últimos días iguales: ej. los últimos jueves)
 * + lo que se va en las rutas (cargado − lo que regresó bueno)
 * − lo que ya está empacado en la estantería.
 * Si todavía no hay historial, se usa el número base que pone el dueño.
 */

export interface ProductoEmpaque {
  id: string;
  nombre: string;
  categoria?: string;
  descripcion?: string;
  tipo?: string;
}

export interface VentaLite {
  fecha: string;
  items: { productoId: string; cantidad: number; unidadesPorItem?: number }[];
}

export interface FilaEmpacado {
  productoId: string;
  nombre: string;
  promTienda: number; // promedio vendido en la panadería ese día de la semana
  promRuta: number; // promedio que se fue en las rutas ese día de la semana
  semanasConDatos: number;
  stock: number;
  base: number;
  hacer: number;
  porBase: boolean; // sin historial: se usó el número base
}

const normal = (s?: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * ¿Es pan de empaque? Tiene que ser de una categoría de PAN ("Panes", "Pan de…")
 * y decir "empaque"/"empacado" en el nombre, la descripción o la categoría.
 * Así no entran los helados de "Helado Empaque" ni los insumos.
 */
export function esPanEmpaque(p: ProductoEmpaque): boolean {
  if (p.tipo === 'ingrediente') return false;
  if (!esCategoriaPan(p.categoria)) return false;
  return /empaque|empacad/.test(`${normal(p.nombre)} ${normal(p.descripcion)} ${normal(p.categoria)}`);
}

const fechaDeVenta = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso).slice(0, 10) : fechaLocal(d);
};

export function calcularEmpacados(opts: {
  productos: ProductoEmpaque[];
  ventas: VentaLite[];
  despachos: Despacho[];
  stock: Record<string, number>;
  bases: Record<string, number>;
  hoy?: Date;
  semanas?: number;
}): FilaEmpacado[] {
  const { productos, ventas, despachos, stock, bases, hoy = new Date(), semanas = 4 } = opts;
  const empaques = productos.filter(esPanEmpaque);
  const ids = new Set(empaques.map(p => p.id));

  // Los mismos días de la semana de las últimas N semanas
  const fechas: string[] = [];
  for (let i = 1; i <= semanas; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 7 * i);
    fechas.push(fechaLocal(d));
  }
  const setFechas = new Set(fechas);

  // Ventas en la panadería por fecha y producto
  const tienda = new Map<string, number>(); // `${fecha}|${id}`
  const diasAbiertos = new Set<string>();
  for (const v of ventas) {
    const f = fechaDeVenta(v.fecha);
    if (!setFechas.has(f)) continue;
    diasAbiertos.add(f);
    for (const it of v.items || []) {
      if (!ids.has(it.productoId)) continue;
      const u = (Number(it.cantidad) || 0) * (Number(it.unidadesPorItem) || 1);
      tienda.set(`${f}|${it.productoId}`, (tienda.get(`${f}|${it.productoId}`) || 0) + u);
    }
  }

  // Rutas: lo que salió en el carro menos lo que volvió bueno
  const ruta = new Map<string, number>();
  for (const d of despachos) {
    if (!setFechas.has(d.fecha) || d.estado === 'cargado') continue;
    diasAbiertos.add(d.fecha);
    for (const c of d.carga || []) {
      if (!ids.has(c.productoId)) continue;
      const volvio = (d.regreso || []).find(r => r.productoId === c.productoId)?.buenos || 0;
      const salio = Math.max(0, (Number(c.cantidad) || 0) - (Number(volvio) || 0));
      ruta.set(`${d.fecha}|${c.productoId}`, (ruta.get(`${d.fecha}|${c.productoId}`) || 0) + salio);
    }
  }

  const n = diasAbiertos.size;
  return empaques
    .map(p => {
      let sumT = 0, sumR = 0;
      for (const f of fechas) {
        sumT += tienda.get(`${f}|${p.id}`) || 0;
        sumR += ruta.get(`${f}|${p.id}`) || 0;
      }
      const promTienda = n > 0 ? sumT / n : 0;
      const promRuta = n > 0 ? sumR / n : 0;
      const base = Math.max(0, Math.round(Number(bases[p.id]) || 0));
      const enEstante = Math.max(0, Math.round(Number(stock[p.id]) || 0));
      const sinHistorial = sumT + sumR === 0;
      const necesita = sinHistorial ? base : Math.ceil(promTienda + promRuta);
      return {
        productoId: p.id,
        nombre: p.nombre,
        promTienda: Math.round(promTienda * 10) / 10,
        promRuta: Math.round(promRuta * 10) / 10,
        semanasConDatos: n,
        stock: enEstante,
        base,
        hacer: Math.max(0, necesita - enEstante),
        porBase: sinHistorial,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Números base (sin historial) ──
const LS_BASES = 'dp_empacados_base';
export const CLAVE_NUBE_BASES = 'empacados_base';

export function cargarBasesLocal(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(LS_BASES) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function guardarBasesLocal(b: Record<string, number>) {
  try { localStorage.setItem(LS_BASES, JSON.stringify(b)); } catch { /* lleno */ }
}
