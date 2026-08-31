/**
 * Costo de insumos en kg (base común).
 * Precio de proveedor: precioCosto del embalaje ÷ cantidadEmbalaje (en kg tras normalizar en Proveedores).
 * Cantidad de receta/fórmula → kg con factorUnidad (lb panadera Dulce Placer = 0.5 kg).
 */
export type PrecioInsumoRef = {
  precioCosto: number;
  cantidadEmbalaje?: number;
};

/** Convierte cantidad de receta a kg (o L equivalentes). */
export function factorUnidadAKg(unidad: string): number {
  const u = (unidad || 'kg').toLowerCase().trim();
  if (u === 'gr' || u === 'g') return 0.001;
  if (u === 'ml') return 0.001;
  if (u === 'lb' || u === 'libra' || u === 'libras') return 0.5; // libra panadera 500 g
  if (u === 'oz') return 0.0283;
  if (u === 'l' || u === 'lt' || u === 'litro' || u === 'litros') return 1;
  if (u === 'und' || u === 'unidades' || u === 'unidad' || u === 'u') return 0.05; // aprox. huevo ~50 g
  if (u === 'arroba' || u === 'arr') return 12.5;
  return 1; // kg u otras
}

/** $/kg (o por unidad de embalaje ya normalizada a kg). */
export function precioPorKg(
  mp: PrecioInsumoRef | null | undefined,
  costoBaseFallback = 0
): number {
  if (mp && Number(mp.precioCosto) > 0) {
    const emb = Number(mp.cantidadEmbalaje);
    const divisor = Number.isFinite(emb) && emb > 0 ? emb : 1;
    return Number(mp.precioCosto) / divisor;
  }
  return Number(costoBaseFallback) || 0;
}

/** Costo de una línea: precio/kg × cantidad convertida a kg. */
export function calcularCostoLineaInsumo(args: {
  cantidad: number;
  unidad: string;
  mejorPrecio: PrecioInsumoRef | null | undefined;
  costoBase?: number;
}): number {
  const qty = Number(args.cantidad) || 0;
  if (qty <= 0) return 0;
  const porKg = precioPorKg(args.mejorPrecio, args.costoBase ?? 0);
  const kg = qty * factorUnidadAKg(args.unidad);
  const total = porKg * kg;
  // Redondeo a pesos enteros (evita basura flotante en PDF)
  return Math.round(total);
}

/** Umbral: un solo insumo > $5M por arroba casi seguro está mal digitado. */
export const COSTO_INSUMO_SOSPECHOSO = 5_000_000;

export function esCostoInsumoSospechoso(costo: number): boolean {
  return Number(costo) >= COSTO_INSUMO_SOSPECHOSO;
}
