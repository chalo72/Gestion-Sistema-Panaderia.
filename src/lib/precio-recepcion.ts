import type { PrecioProveedor } from '@/types';

/**
 * Qué precio poner a un producto al agregarlo en Recepción (2026-11-18).
 *
 * Antes: precio del proveedor escogido → si no había, el costo POR UNIDAD del producto.
 * Gonzalo recibe por paca, así que el agua Pool salía a $700 (una botella) en vez de
 * $14.000 (la paca) cuando el proveedor escogido no tenía el precio.
 *
 * Ahora, en orden:
 *  1. 'proveedor'      → el precio del proveedor escogido.
 *  2. 'otro-proveedor' → el precio más reciente de otro proveedor (normalmente la paca).
 *  3. 'unidad'         → el costo por unidad del producto (último recurso; se avisa).
 */
export type FuentePrecioRecepcion = 'proveedor' | 'otro-proveedor' | 'unidad' | 'ninguno';

export interface PrecioRecepcion {
  precio: number;
  fuente: FuentePrecioRecepcion;
  /** El precio usado cuando sale de un proveedor (para mostrar paca/cantidad y de quién). */
  referencia?: PrecioProveedor;
}

const valido = (p: PrecioProveedor | undefined): p is PrecioProveedor =>
  !!p && Number.isFinite(Number(p.precioCosto)) && Number(p.precioCosto) > 0;

const fecha = (p: PrecioProveedor) => new Date(p.fechaActualizacion || 0).getTime() || 0;

export const precioParaRecepcion = (
  precios: PrecioProveedor[],
  productoId: string,
  proveedorId: string | undefined,
  costoBase: number | undefined,
): PrecioRecepcion => {
  const delProducto = precios.filter(p => p.productoId === productoId && valido(p));

  if (proveedorId) {
    const propio = delProducto.find(p => p.proveedorId === proveedorId);
    if (propio) return { precio: Number(propio.precioCosto), fuente: 'proveedor', referencia: propio };
  }

  const otro = delProducto
    .filter(p => p.proveedorId !== proveedorId)
    .sort((a, b) => fecha(b) - fecha(a))[0];
  if (otro) return { precio: Number(otro.precioCosto), fuente: 'otro-proveedor', referencia: otro };

  const base = Number(costoBase);
  if (Number.isFinite(base) && base > 0) return { precio: base, fuente: 'unidad' };
  return { precio: 0, fuente: 'ninguno' };
};

/** "paca x20", "caja x24"… o '' si es por unidad. */
export const describirEmpaque = (p: PrecioProveedor | undefined): string => {
  const cant = Number(p?.cantidadEmbalaje);
  if (!p || !Number.isFinite(cant) || cant <= 1) return '';
  return `${(p.tipoEmbalaje || 'paquete').trim()} x${cant}`;
};
