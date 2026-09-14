/**
 * Merge nube ↔ local (política del Director):
 * - Mismo aparato: local ya está al día al guardar.
 * - Otros aparatos: si la nube es MÁS NUEVA (timestamp), esa versión manda
 *   (así celular/POS no se atrasan).
 * - Si local es igual o más nuevo: LOCAL GANA en campos llenos; nube solo rellena huecos.
 * - Precios: protege empaque/costo local solo cuando la nube viene incompleta (0/vacío)
 *   y NO es claramente más nueva.
 */

const isEmptyValue = (v: unknown): boolean =>
  v === undefined || v === null || v === '';

/** Extrae timestamp ms de un documento (varios nombres de campo). */
export const timestampDeDoc = (doc: unknown): number => {
  if (!doc || typeof doc !== 'object') return 0;
  const d = doc as Record<string, unknown>;
  const raw =
    d.updatedAt ??
    d.fechaActualizacion ??
    d.ultimoCambio ??
    d.updated_at ??
    d.createdAt ??
    d.created_at ??
    0;
  const t = new Date(String(raw || 0)).getTime();
  return Number.isFinite(t) ? t : 0;
};

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
 * Nube más nueva: base nube, pero no pierde datos locales útiles si la nube trae vacío.
 */
export const mergeCloudMasNueva = <T extends { id: string }>(
  local: T | undefined,
  cloud: T
): T => {
  if (!local) {
    return { ...cloud, id: cloud.id };
  }
  const localRec = local as Record<string, unknown>;
  const cloudRec = cloud as Record<string, unknown>;
  const out: Record<string, unknown> = { ...localRec, ...cloudRec, id: cloud.id };

  for (const key of Object.keys(localRec)) {
    if (key === 'id') continue;
    const cv = out[key];
    const lv = localRec[key];
    if (isEmptyValue(cv) && !isEmptyValue(lv)) {
      out[key] = lv;
    }
  }
  return out as T;
};

/**
 * Si la nube trae costo/empaque en 0 o vacío, no borrar el dato local bueno.
 * (Igual que no dejar que alguien pise el precio del saco de harina con un cero.)
 */
const protegerCamposPrecioLocal = <T extends { id: string }>(
  local: T,
  merged: T
): T => {
  const l = local as Record<string, unknown>;
  const o = { ...(merged as Record<string, unknown>) };

  const localCant = Number(l.cantidadEmbalaje);
  const cloudCant = Number(o.cantidadEmbalaje);
  if (Number.isFinite(localCant) && localCant > 0 && (!Number.isFinite(cloudCant) || cloudCant <= 0)) {
    o.cantidadEmbalaje = localCant;
  }

  if (
    typeof l.tipoEmbalaje === 'string' &&
    l.tipoEmbalaje.trim() !== '' &&
    (typeof o.tipoEmbalaje !== 'string' || String(o.tipoEmbalaje).trim() === '')
  ) {
    o.tipoEmbalaje = l.tipoEmbalaje;
  }

  const localCosto = Number(l.precioCosto);
  const cloudCosto = Number(o.precioCosto);
  if (Number.isFinite(localCosto) && localCosto > 0 && (!Number.isFinite(cloudCosto) || cloudCosto <= 0)) {
    o.precioCosto = localCosto;
  }

  if (typeof l.destino === 'string' && l.destino && !o.destino) {
    o.destino = l.destino;
  }

  return o as T;
};

/**
 * Regla extra para precios de proveedor: no dejar que la nube “aplane”
 * cantidadEmbalaje ni precioCosto si el local ya tenía dato útil.
 */
export const mergePrecioLocalGana = <T extends { id: string }>(local: T | undefined, cloud: T): T => {
  const base = mergeCloudItemLocalGana(local, cloud);
  if (!local) return base;
  return protegerCamposPrecioLocal(local, base);
};

/**
 * Merge inteligente con timestamps (para syncCloudToLocal / realtime / hydrate).
 * - nube más nueva → cloud manda (aparatos al día)
 * - local ≥ nube → LOCAL GANA campos
 * - precios: nunca aceptar costo/empaque 0 de la nube si el local ya tenía valor > 0
 */
export const mergeHydrateItem = <T extends { id: string }>(
  collection: string,
  local: T | undefined,
  cloud: T
): T => {
  if (!local) return { ...cloud, id: cloud.id };

  const remoteTs = timestampDeDoc(cloud);
  const localTs = timestampDeDoc(local);
  const nubeMasNueva = remoteTs > 0 && remoteTs > localTs;

  if (nubeMasNueva) {
    const merged = mergeCloudMasNueva(local, cloud);
    if (collection === 'precios') {
      return protegerCamposPrecioLocal(local, merged);
    }
    return merged;
  }

  if (collection === 'precios') {
    return mergePrecioLocalGana(local, cloud);
  }
  return mergeCloudItemLocalGana(local, cloud);
};

/** Asegura updatedAt al guardar (para que otros aparatos sepan qué versión es más nueva). */
export const stampUpdatedAt = <T extends Record<string, unknown>>(data: T): T => {
  const now = new Date().toISOString();
  return {
    ...data,
    updatedAt: now,
    fechaActualizacion: data.fechaActualizacion || now,
  };
};
