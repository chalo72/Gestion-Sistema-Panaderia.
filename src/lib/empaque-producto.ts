/**
 * Producto que se compra por paquete y se vende por unidad (2026-11-18, pedido de Gonzalo).
 *
 * En el formulario de producto se escribe:
 *   - cómo viene (paca, caja, bolsa…) y cuántas unidades trae,
 *   - el precio del paquete completo.
 * Con eso:
 *   - costo por UNIDAD = precio del paquete ÷ unidades  → el margen y el precio de venta
 *     (Punto de Venta) se calculan sobre la unidad,
 *   - el precio del PROVEEDOR se guarda por paquete (paca x24) → Recepción cuenta paquetes.
 */

export const TIPOS_EMPAQUE = ['unidad', 'paca', 'caja', 'bolsa', 'paquete', 'bulto'] as const;
export type TipoEmpaque = (typeof TIPOS_EMPAQUE)[number] | string;

/** Número escrito en el formulario: acepta "12.300", "12300", "12,5". */
export const numeroFormulario = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  // "12.300" (miles con punto) → 12300 ; "12,5" → 12.5 ; "12.5" → 12.5
  const normal = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s.replace(',', '.');
  const n = parseFloat(normal);
  return Number.isFinite(n) ? n : 0;
};

const redondear2 = (n: number) => Math.round(n * 100) / 100;

export interface EmpaqueFormulario {
  /** true si se compra por paquete (más de 1 unidad). */
  porPaquete: boolean;
  tipo: string;
  unidades: number;
  precioPaquete: number;
  /** Costo de UNA unidad: base del margen y del precio de venta. */
  costoUnidad: number;
}

/** Lee del formulario cómo viene el producto y calcula el costo por unidad. */
export const empaqueDesdeFormulario = (f: {
  tipoEmbalaje?: unknown; unidadesPaquete?: unknown; precioPaquete?: unknown; precioCosto?: unknown;
}): EmpaqueFormulario => {
  const tipo = String(f.tipoEmbalaje || 'unidad').trim().toLowerCase() || 'unidad';
  const unidades = Math.max(1, Math.round(numeroFormulario(f.unidadesPaquete)) || 1);
  const precioPaquete = numeroFormulario(f.precioPaquete);
  const porPaquete = tipo !== 'unidad' && unidades > 1 && precioPaquete > 0;
  const costoUnidad = porPaquete ? redondear2(precioPaquete / unidades) : numeroFormulario(f.precioCosto);
  return { porPaquete, tipo: porPaquete ? tipo : 'unidad', unidades: porPaquete ? unidades : 1, precioPaquete, costoUnidad };
};

/** Lo que se guarda como precio del PROVEEDOR (Recepción): por paquete si viene en paquete. */
export const precioProveedorDesdeEmpaque = (e: EmpaqueFormulario): { precioCosto: number; cantidadEmbalaje: number; tipoEmbalaje: string } =>
  e.porPaquete
    ? { precioCosto: redondear2(e.precioPaquete), cantidadEmbalaje: e.unidades, tipoEmbalaje: e.tipo }
    : { precioCosto: redondear2(e.costoUnidad), cantidadEmbalaje: 1, tipoEmbalaje: 'unidad' };

/**
 * Campos del formulario al EDITAR un producto, a partir de su precio de proveedor y del producto.
 * Antes se ponía el precio de la paca ($12.300) como si fuera el costo de una unidad.
 */
export const camposEmpaqueParaEditar = (
  precioProveedor: { precioCosto?: number; cantidadEmbalaje?: number; tipoEmbalaje?: string } | null | undefined,
  producto: { costoBase?: number; unidadesPaquete?: number },
): { tipoEmbalaje: string; unidadesPaquete: string; precioPaquete: string; precioCosto: string } => {
  const cant = Number(precioProveedor?.cantidadEmbalaje) || Number(producto.unidadesPaquete) || 1;
  const precioProv = Number(precioProveedor?.precioCosto) || 0;
  if (cant > 1 && precioProv > 0) {
    return {
      tipoEmbalaje: (precioProveedor?.tipoEmbalaje && precioProveedor.tipoEmbalaje !== 'unidad') ? precioProveedor.tipoEmbalaje : 'paquete',
      unidadesPaquete: String(cant),
      precioPaquete: String(precioProv),
      precioCosto: String(redondear2(precioProv / cant)),
    };
  }
  const costo = precioProv || Number(producto.costoBase) || 0;
  return { tipoEmbalaje: 'unidad', unidadesPaquete: '1', precioPaquete: '', precioCosto: costo ? String(costo) : '' };
};

/** Precio de venta sugerido por unidad con el margen (sobre el precio, como el resto del formulario). */
export const precioVentaConMargen = (costoUnidad: number, margenPct: number): number => {
  if (!(costoUnidad > 0) || !Number.isFinite(margenPct)) return 0;
  const p = margenPct < 100 ? costoUnidad / (1 - margenPct / 100) : costoUnidad * (1 + margenPct / 100);
  return Math.round(p / 100) * 100;
};
