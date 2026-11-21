/**
 * Limpieza de la lista de categorías de cada aparato (2026-11-21, pedido de Gonzalo).
 *
 * En Recepción → Nuevo producto el desplegable de categoría mostraba recetas de pan
 * ("Pan aliñado Grd empaque"…) y "Postobon"/"Postobón" repetido. La nube ya se limpió,
 * pero cada celular guarda su propia lista; esto la limpia al abrir la app.
 */

/** Minúsculas, sin espacios sobrantes y sin tildes: "Postobón" = "postobon". */
export const normalizarNombreCat = (s: string): string =>
  String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Una receta (modelo de pan) que se coló en la lista de categorías. */
export function esCategoriaDeReceta(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return !!o.formulacionId || o.panesPorArroba != null || Array.isArray(o.ingredientes);
}

/**
 * Entre dos categorías con el mismo nombre (ej. "Postobon" y "Postobón"),
 * ¿conviene quedarse con la nueva? Sí, si su nombre exacto es el que usan los productos
 * y el de la que ya estaba no.
 */
export function preferirPorUsoEnProductos(nueva: string, existente: string, nombresUsados: Set<string>): boolean {
  return nombresUsados.has(String(nueva || '').trim()) && !nombresUsados.has(String(existente || '').trim());
}
