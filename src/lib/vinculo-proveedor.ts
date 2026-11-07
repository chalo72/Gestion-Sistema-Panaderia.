/**
 * Vínculo producto ↔ proveedor al crear un producto nuevo desde Recepciones.
 *
 * Un producto solo aparece en el catálogo de un proveedor (Gestión de Proveedores)
 * si existe una fila en `precios` (PrecioProveedor) que los una. Recepciones creaba el
 * producto y su inventario pero no esa fila, así que el producto quedaba huérfano.
 *
 * Esta función decide si hay que crear el vínculo y con qué datos. Es pura para poder
 * probarla sin montar la pantalla.
 */

export interface DatosVinculoProveedor {
  productoId: string;
  /** Proveedor elegido en el formulario del producto (puede venir vacío). */
  proveedorIdForm?: string;
  /** Proveedor de la factura que se está recibiendo (respaldo si el formulario no eligió uno). */
  proveedorIdRecepcion?: string;
  /** Costo escrito en el formulario del producto. */
  precioCosto: number;
  notas?: string;
}

export interface VinculoProveedor {
  productoId: string;
  proveedorId: string;
  precioCosto: number;
  notas?: string;
}

/**
 * Devuelve los datos para `onAddOrUpdatePrecio`, o `null` si no se debe vincular
 * (sin proveedor, sin id de producto o sin un costo válido > 0).
 */
export function armarVinculoProveedor(datos: DatosVinculoProveedor): VinculoProveedor | null {
  const proveedorId = datos.proveedorIdForm || datos.proveedorIdRecepcion || '';
  if (!datos.productoId || !proveedorId) return null;

  const costo = Number(datos.precioCosto);
  if (!Number.isFinite(costo) || costo <= 0) return null;

  const notas = datos.notas?.trim();
  return {
    productoId: datos.productoId,
    proveedorId,
    precioCosto: Math.round(costo * 100) / 100,
    ...(notas ? { notas } : {}),
  };
}
