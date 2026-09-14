/**
 * Comparación de líneas de gasto / factura contra el catálogo del proveedor.
 * Usado en Gastos (modo masivo) y reutilizable en otros módulos.
 */
import { matchProductoEnCatalogo } from '@/lib/ocr-service';
import type { PrecioProveedor, Producto } from '@/types';

/** Tolerancia en pesos (redondeo de factura) */
const TOLERANCIA_PESOS = 100;
/** Tolerancia porcentual para considerar precio igual */
const TOLERANCIA_PCT = 0.75;

export type EstadoComparacionPrecio =
  | 'fila_vacia'
  | 'sin_proveedor'
  | 'sin_monto'
  | 'sin_producto'
  | 'precio_nuevo'
  | 'igual'
  | 'subio'
  | 'bajo';

export interface LineaGastoComparable {
  nombre: string;
  cantidad: number;
  montoTotal: number;
}

export interface ResultadoComparacionLinea {
  estado: EstadoComparacionPrecio;
  nombreLinea: string;
  productoNombre?: string;
  productoId?: string;
  cantidad: number;
  montoTotal: number;
  /** Precio por pack/unidad de compra en la factura */
  precioPackFactura: number;
  /** Precio registrado en catálogo del proveedor (por pack) */
  precioPackCatalogo?: number;
  diferencia?: number;
  porcentajeCambio?: number;
  mensaje: string;
}

export function calcularPrecioPackFactura(cantidad: number, montoTotal: number): number {
  if (montoTotal <= 0) return 0;
  const qty = cantidad > 0 ? cantidad : 1;
  return Math.round((montoTotal / qty) * 100) / 100;
}

function umbralEsIgual(anterior: number, nuevo: number): boolean {
  if (anterior <= 0) return false;
  const diff = Math.abs(nuevo - anterior);
  const pct = (diff / anterior) * 100;
  return diff <= TOLERANCIA_PESOS || pct <= TOLERANCIA_PCT;
}

/**
 * Compara una línea de gasto con el precio del catálogo del proveedor.
 * `montoTotal` = total de la fila; `cantidad` = packs/unidades compradas en esa fila.
 * El catálogo guarda `precioCosto` por pack (embalaje del proveedor).
 */
export function compararLineaConCatalogo(
  linea: LineaGastoComparable,
  proveedorId: string | undefined,
  productos: Producto[],
  precios: PrecioProveedor[],
): ResultadoComparacionLinea {
  const nombreLinea = linea.nombre.trim();
  const cantidad = linea.cantidad > 0 ? linea.cantidad : 1;
  const montoTotal = linea.montoTotal;
  const precioPackFactura = calcularPrecioPackFactura(cantidad, montoTotal);

  const base: ResultadoComparacionLinea = {
    estado: 'fila_vacia',
    nombreLinea,
    cantidad,
    montoTotal,
    precioPackFactura,
    mensaje: '',
  };

  if (!nombreLinea) {
    return { ...base, estado: 'fila_vacia', mensaje: '—' };
  }

  if (montoTotal <= 0) {
    return { ...base, estado: 'sin_monto', mensaje: 'Falta monto' };
  }

  if (!proveedorId) {
    return {
      ...base,
      estado: 'sin_proveedor',
      mensaje: 'Elige proveedor arriba para comparar',
    };
  }

  const catalogoProv = productos.filter((p) =>
    precios.some((px) => px.proveedorId === proveedorId && px.productoId === p.id),
  );
  const pool = catalogoProv.length > 0 ? catalogoProv : productos;
  const match = matchProductoEnCatalogo(
    nombreLinea,
    pool,
    (p) => p.nombre,
    catalogoProv.length > 0 ? 0.52 : 0.58,
  );

  if (match.indice < 0) {
    return {
      ...base,
      estado: 'sin_producto',
      mensaje: 'No está en el catálogo de este proveedor',
    };
  }

  const producto = pool[match.indice];
  const precioRegistro = precios.find(
    (px) => px.proveedorId === proveedorId && px.productoId === producto.id,
  );

  if (!precioRegistro || precioRegistro.precioCosto <= 0) {
    return {
      ...base,
      estado: 'precio_nuevo',
      productoNombre: producto.nombre,
      productoId: producto.id,
      mensaje: `Primera vez en catálogo: $${precioPackFactura.toLocaleString('es-CO')}`,
    };
  }

  const precioPackCatalogo = precioRegistro.precioCosto;
  const diferencia = precioPackFactura - precioPackCatalogo;
  const porcentajeCambio =
    precioPackCatalogo > 0
      ? Math.round((diferencia / precioPackCatalogo) * 1000) / 10
      : 0;

  if (umbralEsIgual(precioPackCatalogo, precioPackFactura)) {
    return {
      ...base,
      estado: 'igual',
      productoNombre: producto.nombre,
      productoId: producto.id,
      precioPackCatalogo,
      diferencia: 0,
      porcentajeCambio: 0,
      mensaje: `Igual al catálogo ($${precioPackCatalogo.toLocaleString('es-CO')})`,
    };
  }

  if (diferencia > 0) {
    return {
      ...base,
      estado: 'subio',
      productoNombre: producto.nombre,
      productoId: producto.id,
      precioPackCatalogo,
      diferencia,
      porcentajeCambio,
      mensaje: `Subió ${porcentajeCambio}% · Catálogo $${precioPackCatalogo.toLocaleString('es-CO')} → Factura $${precioPackFactura.toLocaleString('es-CO')}`,
    };
  }

  return {
    ...base,
    estado: 'bajo',
    productoNombre: producto.nombre,
    productoId: producto.id,
    precioPackCatalogo,
    diferencia,
    porcentajeCambio,
    mensaje: `Bajó ${Math.abs(porcentajeCambio)}% · Catálogo $${precioPackCatalogo.toLocaleString('es-CO')} → Factura $${precioPackFactura.toLocaleString('es-CO')}`,
  };
}

export interface ResumenAlertasGasto {
  subieron: ResultadoComparacionLinea[];
  bajaron: ResultadoComparacionLinea[];
  nuevos: ResultadoComparacionLinea[];
  sinMatch: ResultadoComparacionLinea[];
  iguales: number;
  sinProveedor: number;
}

export function resumirComparaciones(resultados: ResultadoComparacionLinea[]): ResumenAlertasGasto {
  return {
    subieron: resultados.filter((r) => r.estado === 'subio'),
    bajaron: resultados.filter((r) => r.estado === 'bajo'),
    nuevos: resultados.filter((r) => r.estado === 'precio_nuevo'),
    sinMatch: resultados.filter((r) => r.estado === 'sin_producto'),
    iguales: resultados.filter((r) => r.estado === 'igual').length,
    sinProveedor: resultados.filter((r) => r.estado === 'sin_proveedor').length,
  };
}

export function claseBadgeComparacion(estado: EstadoComparacionPrecio): string {
  switch (estado) {
    case 'subio':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'bajo':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'igual':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'precio_nuevo':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'sin_producto':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'sin_proveedor':
      return 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500 border-slate-100 dark:border-slate-800';
    default:
      return 'bg-transparent text-transparent border-transparent';
  }
}

export function etiquetaCortaComparacion(r: ResultadoComparacionLinea): string {
  switch (r.estado) {
    case 'subio':
      return `↑ ${r.porcentajeCambio ?? 0}%`;
    case 'bajo':
      return `↓ ${Math.abs(r.porcentajeCambio ?? 0)}%`;
    case 'igual':
      return 'OK';
    case 'precio_nuevo':
      return 'Nuevo';
    case 'sin_producto':
      return 'Sin match';
    case 'sin_proveedor':
      return 'Sin prov.';
    case 'sin_monto':
      return '—';
    default:
      return '';
  }
}
