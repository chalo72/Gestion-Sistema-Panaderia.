/**
 * Merge nube → local respetando LOCAL SIEMPRE GANA.
 * La nube solo rellena huecos; nunca borra cantidad/precio/empaque ya guardados en el aparato.
 */

const isEmptyValue = (v: unknown): boolean =>
  v === undefined || v === null || v === '';

/**
 * Une un documento de la nube con el local.
 * - Si no hay local → se usa la nube.
 * - Si hay local → los campos locales con valor mandan; la nube solo completa vacíos.
 */
export const mergeCloudItemLocalGana = <T extends { id: string }>(
  local: T | undefined,
  cloud: T
): T => {
  if (!local) {
    return { ...cloud, id: cloud.id };
  }

  const localRec = local as Record<string, unknown>;
  const cloudRec = cloud as Record<string, unknown>;
  const out: Record<string, unknown> = { ...cloudRec, ...localRec, id: local.id };

  for (const key of Object.keys(cloudRec)) {
    if (key === 'id') continue;
    const lv = localRec[key];
    const cv = cloudRec[key];
    if (isEmptyValue(lv) && !isEmptyValue(cv)) {
      out[key] = cv;
    } else if (!isEmptyValue(lv)) {
      out[key] = lv;
    }
  }

  return out as T;
};

/**
 * Regla extra para precios de proveedor: no dejar que la nube “aplane”
 * cantidadEmbalaje ni precioCosto si el local ya tenía dato útil.
 */
export const mergePrecioLocalGana = <T extends { id: string }>(local: T | undefined, cloud: T): T => {
  const base = mergeCloudItemLocalGana(local, cloud);
  if (!local) return base;

  const l = local as Record<string, unknown>;
  const o = base as Record<string, unknown>;

  const localCant = Number(l.cantidadEmbalaje);
  if (Number.isFinite(localCant) && localCant > 0) {
    o.cantidadEmbalaje = localCant;
  }

  if (typeof l.tipoEmbalaje === 'string' && l.tipoEmbalaje.trim() !== '') {
    o.tipoEmbalaje = l.tipoEmbalaje;
  }

  const localCosto = Number(l.precioCosto);
  if (Number.isFinite(localCosto) && localCosto > 0) {
    o.precioCosto = localCosto;
  }

  if (typeof l.destino === 'string' && l.destino) {
    o.destino = l.destino;
  }

  return o as T;
};

/** Elige merge según colección. */
export const mergeHydrateItem = <T extends { id: string }>(
  collection: string,
  local: T | undefined,
  cloud: T
): T => {
  if (collection === 'precios') {
    return mergePrecioLocalGana(local, cloud);
  }
  return mergeCloudItemLocalGana(local, cloud);
};
