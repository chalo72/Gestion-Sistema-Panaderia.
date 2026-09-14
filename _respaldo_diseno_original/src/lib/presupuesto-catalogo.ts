/**
 * Catálogo de productos filtrado por proveedor para presupuestos de compra.
 * Empareja por ID (si existe) o por nombre normalizado (postobon ≈ Postobón).
 */

export type ProvMin = { id: string; nombre: string };
export type ProdMin = { id: string; nombre: string; deletedAt?: string };
export type PrecioMin = {
  proveedorId: string;
  productoId: string;
  precioCosto: number;
  cantidadEmbalaje?: number;
};

export type ItemCatalogoPresupuesto = {
  id: string;
  nombre: string;
  precioUnitario: number;
};

/** Quita acentos, espacios y puntuación para comparar nombres. */
export const normalizarNombreProv = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Resuelve el proveedor del presupuesto contra el catálogo.
 * Prioridad: proveedorId guardado → nombre exacto → nombre parcial.
 */
export const resolverProveedorPresupuesto = (
  nombrePresupuesto: string,
  proveedores: ProvMin[] | undefined,
  proveedorId?: string | null
): ProvMin | undefined => {
  const lista = proveedores ?? [];
  if (!lista.length) return undefined;

  if (proveedorId) {
    const byId = lista.find((p) => p.id === proveedorId);
    if (byId) return byId;
  }

  const clave = normalizarNombreProv(nombrePresupuesto);
  if (!clave) return undefined;

  return (
    lista.find((p) => normalizarNombreProv(p.nombre) === clave) ||
    lista.find((p) => {
      const n = normalizarNombreProv(p.nombre);
      return n.includes(clave) || clave.includes(n);
    })
  );
};

/**
 * Productos con precio de costo de ese proveedor.
 * Usa precio del embalaje (lo que se paga al proveedor).
 */
export const catalogoProductosProveedor = (
  nombrePresupuesto: string,
  proveedores: ProvMin[] | undefined,
  productos: ProdMin[] | undefined,
  precios: PrecioMin[] | undefined,
  proveedorId?: string | null
): ItemCatalogoPresupuesto[] => {
  const prov = resolverProveedorPresupuesto(nombrePresupuesto, proveedores, proveedorId);
  if (!prov || !productos?.length || !precios?.length) return [];

  const lista: ItemCatalogoPresupuesto[] = [];
  for (const pr of precios) {
    if (String(pr.proveedorId) !== String(prov.id)) continue;
    const costo = Number(pr.precioCosto);
    if (!(costo > 0)) continue;
    const prod = productos.find((p) => p.id === pr.productoId);
    if (!prod || prod.deletedAt) continue;
    lista.push({
      id: prod.id,
      nombre: prod.nombre,
      precioUnitario: Math.round(costo * 100) / 100,
    });
  }
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return lista;
};

/** Busca proveedorId al crear/editar presupuesto (nombre libre del usuario). */
export const buscarProveedorIdPorNombre = (
  nombre: string,
  proveedores: ProvMin[] | undefined
): string | undefined => resolverProveedorPresupuesto(nombre, proveedores)?.id;

export type LineaCompraRealMin = {
  producto?: string;
  cantidad?: number;
  montoReal?: number;
};

export type LineaOrdenDesdePresupuesto = {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  nombre: string;
};

/**
 * Convierte líneas del presupuesto (nombre texto) en ítems de OC con productoId.
 * Las que no matchean el catálogo se omiten (cuentan en `omitidas`).
 */
export const mapComprasRealesALineasOC = (
  comprasReales: LineaCompraRealMin[] | undefined,
  nombrePresupuesto: string,
  proveedores: ProvMin[] | undefined,
  productos: ProdMin[] | undefined,
  precios: PrecioMin[] | undefined,
  proveedorId?: string | null
): { lineas: LineaOrdenDesdePresupuesto[]; omitidas: number } => {
  const catalogo = catalogoProductosProveedor(
    nombrePresupuesto,
    proveedores,
    productos,
    precios,
    proveedorId
  );
  const lineas: LineaOrdenDesdePresupuesto[] = [];
  let omitidas = 0;
  for (const r of comprasReales || []) {
    const nombre = (r.producto || '').trim();
    if (!nombre) {
      omitidas += 1;
      continue;
    }
    const match = catalogo.find(
      (c) => normalizarNombreProv(c.nombre) === normalizarNombreProv(nombre)
    );
    if (!match) {
      omitidas += 1;
      continue;
    }
    const cant = Number(r.cantidad) > 0 ? Number(r.cantidad) : 1;
    const monto = Number(r.montoReal) || 0;
    const unitFromLine = cant > 0 && monto > 0 ? Math.round((monto / cant) * 100) / 100 : 0;
    lineas.push({
      productoId: match.id,
      cantidad: cant,
      precioUnitario: unitFromLine > 0 ? unitFromLine : match.precioUnitario,
      nombre: match.nombre,
    });
  }
  return { lineas, omitidas };
};
