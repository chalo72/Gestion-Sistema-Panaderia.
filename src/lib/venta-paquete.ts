import type { Producto } from '@/types';

/**
 * Venta por paquete en el Punto de Venta e inventario en unidades (2026-11-18, AUTORIZO Gonzalo).
 *
 * - Inventario SIEMPRE en unidades (la más pequeña).
 * - Recepción: llegan 2 pacas de 48 → suma 96 unidades (solo productos con "trae 48" guardado).
 * - Punto de Venta: el producto sale por unidad; si tiene precio por paquete, sale además una
 *   tarjeta "(paquete x48)". Vender 1 paquete resta 48 unidades.
 */

export const SUFIJO_PAQUETE = '::paq';

type ProductoPaquete = Producto & { _baseId?: string; _unidades?: number };

export const unidadesDelPaquete = (p: Pick<Producto, 'unidadesPaquete'> | undefined): number => {
  const n = Math.round(Number(p?.unidadesPaquete) || 0);
  return n > 1 ? n : 1;
};

/** ¿Se vende también por paquete completo? */
export const seVendePorPaquete = (p: Producto | undefined): boolean =>
  !!p && unidadesDelPaquete(p) > 1 && (Number(p.precioVentaPaquete) || 0) > 0;

/** Tarjeta "paquete" del Punto de Venta (producto virtual que apunta al producto real). */
export const productoPaquete = (p: Producto): ProductoPaquete => ({
  ...p,
  id: `${p.id}${SUFIJO_PAQUETE}`,
  nombre: `${p.nombre} (paquete x${unidadesDelPaquete(p)})`,
  precioVenta: Number(p.precioVentaPaquete) || 0,
  _baseId: p.id,
  _unidades: unidadesDelPaquete(p),
});

/** Catálogo del Punto de Venta: cada producto + su tarjeta de paquete si se vende por paquete. */
export const conTarjetasDePaquete = (productos: Producto[]): Producto[] => {
  const out: Producto[] = [];
  for (const p of productos) {
    out.push(p);
    if (seVendePorPaquete(p)) out.push(productoPaquete(p));
  }
  return out;
};

export const esIdPaquete = (id: string | undefined): boolean => String(id || '').endsWith(SUFIJO_PAQUETE);
export const idBase = (id: string): string => (esIdPaquete(id) ? id.slice(0, -SUFIJO_PAQUETE.length) : id);

/** Unidades de inventario que representa 1 de este ítem del carrito (1 o las del paquete). */
export const unidadesPorItem = (p: Producto | ProductoPaquete): number =>
  esIdPaquete(p.id) ? (Number((p as ProductoPaquete)._unidades) || unidadesDelPaquete(p)) : 1;

/** Para guardar la venta: producto real + cuántas unidades descuenta cada ítem. */
export const lineaVenta = (p: Producto | ProductoPaquete) => ({
  productoId: idBase(p.id),
  ...(esIdPaquete(p.id) ? { unidadesPorItem: unidadesPorItem(p), nombre: p.nombre } : {}),
});

/** Devuelve el producto para el carrito a partir de un id guardado (mesas abiertas). */
export const productoDesdeId = (id: string, productos: Producto[]): Producto | undefined => {
  const base = productos.find(p => p.id === idBase(id));
  if (!base) return undefined;
  return esIdPaquete(id) ? productoPaquete(base) : base;
};

/** Unidades que salen del inventario por una línea de venta guardada. */
export const unidadesQueDescuenta = (item: { cantidad?: number; unidadesPorItem?: number }): number =>
  (Number(item.cantidad) || 0) * Math.max(1, Number(item.unidadesPorItem) || 1);

/** Unidades que entran al inventario por lo recibido (2 pacas de 48 → 96). */
export const unidadesQueEntran = (cantidadRecibida: number, producto: Pick<Producto, 'unidadesPaquete'> | undefined): number =>
  (Number(cantidadRecibida) || 0) * unidadesDelPaquete(producto);

/** "96 unidades (2 paquetes)" para mostrar. */
export const textoUnidades = (unidades: number, producto: Pick<Producto, 'unidadesPaquete'> | undefined): string => {
  const n = unidadesDelPaquete(producto);
  const u = Math.round(Number(unidades) || 0);
  if (n <= 1) return `${u} unidades`;
  const paq = Math.floor(u / n);
  const sueltas = u - paq * n;
  return `${u} unidades (${paq} ${paq === 1 ? 'paquete' : 'paquetes'}${sueltas ? ` + ${sueltas} sueltas` : ''})`;
};
