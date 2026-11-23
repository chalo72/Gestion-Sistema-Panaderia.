/**
 * Guardián de borrados (2026-11-23, pedido de Gonzalo: "lo que borro vuelve a aparecer").
 *
 * En la nube había 90 productos con lápida (borrados por el usuario) que seguían vivos:
 * el borrado en la nube falló o un aparato con copia vieja los volvió a subir, y todos
 * los aparatos los volvían a bajar. Regla: si un registro tiene lápida en la nube y
 * nadie lo editó DESPUÉS de borrarlo, está borrado — no se baja, no se sube y se quita
 * también aquí. Si alguien lo editó después del borrado, se respeta (fue restaurado).
 */
import { timestampDeDoc } from './sync-merge-local-gana';

/** Lápidas de la nube: clave `tabla:id` → hora del borrado (ms). */
export type LapidasNube = Map<string, number>;

export function leerLapidasNube(filas: { table?: string; item_id?: string; deleted_at?: string | null }[]): LapidasNube {
  const m: LapidasNube = new Map();
  for (const f of filas || []) {
    if (!f?.table || !f?.item_id) continue;
    const t = f.deleted_at ? new Date(f.deleted_at).getTime() : 0;
    const clave = `${f.table}:${f.item_id}`;
    m.set(clave, Math.max(m.get(clave) ?? 0, Number.isFinite(t) ? t : 0));
  }
  return m;
}

/**
 * ¿Este registro quedó borrado según la nube? Sí, si tiene lápida y ninguna de las copias
 * que se conocen (aquí o en la nube) se editó después del borrado. Sin hora de borrado
 * (lápida vieja), cualquier copia con hora conocida no la contradice: gana el borrado.
 */
export function borradoSegunNube(
  lapidas: LapidasNube | null | undefined, tabla: string, id: string | undefined,
  ...copias: unknown[]
): boolean {
  if (!lapidas || !id) return false;
  const clave = `${tabla}:${id}`;
  if (!lapidas.has(clave)) return false;
  const horaBorrado = lapidas.get(clave) ?? 0;
  if (horaBorrado === 0) return true;
  return copias.every(c => !c || timestampDeDoc(c) <= horaBorrado);
}
