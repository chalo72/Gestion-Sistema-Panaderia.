/**
 * ¿El posible duplicado es de verdad un duplicado? (2026-11-23, Gonzalo: "uno es de Postobón y el
 * otro del Carmen, cada uno tiene su precio; borré sin darme cuenta").
 *
 * - mismo-proveedor: los dos los vende el MISMO proveedor → es copia, se deja uno.
 * - proveedores-distintos: cada uno viene de un proveedor distinto → NO borrar (cada uno su precio).
 * - sin-proveedor: alguno no tiene proveedor → ese suele ser la copia hecha a mano.
 *
 * Nombres de proveedor con las mismas palabras en otro orden cuentan como el mismo
 * («El Carmen Tienda y Distribuidora» = «Tienda Y Distribuidora El Carmen»).
 */
export type TipoDuplicado = 'mismo-proveedor' | 'proveedores-distintos' | 'sin-proveedor';

export const claveProveedor = (nombre: string): string =>
  String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !['y', 'de', 'la', 'el', 'distr', 'distribuidora'].includes(w))
    .sort().join(' ');

/** proveedoresPorProducto: para cada producto del grupo, los nombres de sus proveedores. */
export function tipoDeDuplicado(proveedoresPorProducto: string[][]): TipoDuplicado {
  const claves = proveedoresPorProducto.map(l => new Set(l.map(claveProveedor).filter(Boolean)));
  if (claves.some(s => s.size === 0)) return 'sin-proveedor';
  for (let i = 0; i < claves.length; i++) {
    for (let j = i + 1; j < claves.length; j++) {
      for (const c of claves[i]) if (claves[j].has(c)) return 'mismo-proveedor';
    }
  }
  return 'proveedores-distintos';
}
