/**
 * Detector de precios de venta inconsistentes (2026-11-23, pedido de Gonzalo).
 *
 * Gonzalo quiere ver marcados, en Productos, en el catálogo del proveedor y en la lista para
 * imprimir, los productos cuyo precio de venta "no cuadra", para revisarlos rápido.
 * Solo marca: nunca cambia precios. Las reglas salen de casos reales de la base (nov-2026):
 * PVP no redondo por costo×margen ($3.071), costo de paquete puesto como unitario
 * (Cifrut 400: costo $14.500, PVP $1.637) y nombres repetidos con precios distintos
 * (Golpe Original 140g: $8.500 y $67.600).
 */

export type MotivoPrecio =
  | 'sin-precio' | 'bajo-costo' | 'costo-paquete' | 'margen-bajo' | 'margen-alto' | 'no-redondo' | 'repetido';

export interface ProblemaPrecio {
  motivo: MotivoPrecio;
  texto: string;
  /** Grave = puede hacer perder plata o cobrar mal (rojo). Si no, es para revisar (ámbar). */
  grave: boolean;
}

export interface ProductoPrecio {
  id: string;
  nombre: string;
  precioVenta: number | string | undefined;
  costoBase?: number | string;
  tipo?: string;
}

/** Ganancia sobre el costo por debajo de esto se marca como "muy baja". */
export const MARGEN_MIN_PCT = 10;
/** Ganancia sobre el costo por encima de esto se marca como "muy alta" (posible costo o precio mal puesto). */
export const MARGEN_MAX_PCT = 300;

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const normNombre = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export type IndiceRepetidos = Map<string, { id: string; precioVenta: number }[]>;

/** Agrupa por nombre (sin tildes, mayúsculas ni espacios de más) para encontrar repetidos. */
export function indiceRepetidos(productos: ProductoPrecio[]): IndiceRepetidos {
  const m: IndiceRepetidos = new Map();
  for (const p of productos) {
    const k = normNombre(p.nombre);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push({ id: p.id, precioVenta: Math.round(Number(p.precioVenta) || 0) });
  }
  return m;
}

/**
 * Revisa el precio de venta de un producto. `costoUnitario` permite pasar el costo que ya
 * calculó la pantalla (p. ej. desde el proveedor); si no, se usa `costoBase`.
 */
export function revisarPrecio(p: ProductoPrecio, opts: { costoUnitario?: number; repetidos?: IndiceRepetidos } = {}): ProblemaPrecio[] {
  const pv = Math.round(Number(p.precioVenta) || 0);
  const costo = Number(opts.costoUnitario ?? p.costoBase) || 0;
  const esInsumo = p.tipo === 'ingrediente';
  const out: ProblemaPrecio[] = [];

  if (!esInsumo && pv <= 0) {
    out.push({ motivo: 'sin-precio', texto: 'Sin precio de venta', grave: true });
  }
  if (pv > 0 && costo > 0) {
    if (costo >= pv * 3) {
      out.push({ motivo: 'costo-paquete', texto: `El costo (${pesos(costo)}) parece de un paquete completo`, grave: true });
    } else if (pv < costo) {
      out.push({ motivo: 'bajo-costo', texto: `Se vende por debajo del costo (${pesos(costo)})`, grave: true });
    } else if (!esInsumo) {
      const ganancia = ((pv - costo) / costo) * 100;
      if (ganancia < MARGEN_MIN_PCT) out.push({ motivo: 'margen-bajo', texto: `Ganancia muy baja (${ganancia.toFixed(0)}%)`, grave: false });
      else if (ganancia > MARGEN_MAX_PCT) out.push({ motivo: 'margen-alto', texto: `Ganancia muy alta (${ganancia.toFixed(0)}%): revise costo o precio`, grave: false });
    }
  }
  if (!esInsumo && pv > 0 && pv % 50 !== 0) {
    out.push({ motivo: 'no-redondo', texto: `Precio no redondo (${pesos(pv)})`, grave: false });
  }
  const otros = (opts.repetidos?.get(normNombre(p.nombre)) || []).filter(o => o.id !== p.id && o.precioVenta !== pv);
  if (otros.length > 0) {
    out.push({ motivo: 'repetido', texto: `Hay otro «${p.nombre.trim()}» a ${otros.map(o => pesos(o.precioVenta)).join(', ')}`, grave: false });
  }
  return out;
}

export const tieneProblemaGrave = (ps: ProblemaPrecio[]) => ps.some(p => p.grave);
