import { unirHistorial } from './historial-credito';
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
  const aMs = (v: unknown): number => {
    if (v === undefined || v === null || v === '') return 0;
    const t = new Date(String(v)).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  // La hora MÁS RECIENTE entre los campos de cambio: un registro puede traer un updatedAt
  // viejo (bajado de la nube) y un actualizadoEn nuevo (cierre de caja hecho aquí).
  const cambio = Math.max(
    aMs(d.updatedAt),
    aMs(d.fechaActualizacion),
    aMs(d.ultimoCambio),
    aMs(d.updated_at),
    aMs(d.actualizadoEn), // sesiones de caja (hora de la última modificación)
  );
  if (cambio > 0) return cambio;
  return aMs(d.createdAt) || aMs(d.created_at);
};

/** Campos que fija el cierre de una caja; una copia "abierta" nunca debe borrarlos. */
const CAMPOS_CIERRE_CAJA = ['estado', 'fechaCierre', 'montoCierre', 'observaciones', 'ventasManualIngresadas'] as const;

/** ¿La nube intenta reabrir una caja que este aparato ya cerró? (no existe "reabrir caja") */
export const esCajaRevivida = (local: unknown, cloud: unknown): boolean =>
  (local as { estado?: string } | undefined)?.estado === 'cerrada' &&
  (cloud as { estado?: string } | undefined)?.estado === 'abierta';

const conservarCierreCaja = <T extends { id: string }>(local: T, merged: T): T => {
  const l = local as Record<string, unknown>;
  const o = { ...(merged as Record<string, unknown>) };
  for (const k of CAMPOS_CIERRE_CAJA) {
    if (!isEmptyValue(l[k])) o[k] = l[k];
  }
  return o as T;
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
 * Sesiones de caja: si un lado está cerrado y el otro abierto, gana el cerrado
 * (con su fechaCierre/montoCierre). Devuelve undefined si no hay conflicto de estado.
 */
export const mergeCajaCierreGana = <T extends { id: string }>(local: T, cloud: T): T | undefined => {
  const l = local as Record<string, unknown>;
  const c = cloud as Record<string, unknown>;
  const lCerrada = l.estado === 'cerrada';
  const cCerrada = c.estado === 'cerrada';
  if (lCerrada === cCerrada) return undefined;
  const cerrada = lCerrada ? l : c;
  const base = mergeCloudItemLocalGana(local, cloud) as Record<string, unknown>;
  return {
    ...base,
    estado: 'cerrada',
    fechaCierre: cerrada.fechaCierre ?? base.fechaCierre,
    montoCierre: cerrada.montoCierre ?? base.montoCierre,
    id: local.id,
  } as unknown as T;
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

  // Créditos: un cobro de nómina nunca se deshace (ver mergeCreditoCobroGana, 2026-11-18)
  if (collection === 'creditos_trabajadores' || collection === 'creditos_clientes') {
    const unido = mergeCreditoCobroGana(local, cloud, mergeHydrateItem('_credito', local, cloud));
    // Historial: se juntan los eventos de los dos lados (nadie pierde quién anotó qué)
    const hist = unirHistorial((local as any).historial, (cloud as any).historial);
    return (hist.length > 0 ? { ...unido, historial: hist } : unido) as T;
  }

  // Caja: un cierre nunca se deshace. Si cualquiera de los dos lados la tiene cerrada,
  // queda cerrada con los datos de cierre de ese lado (2026-11-07: el PC reabría cajas).
  if (collection === 'sesiones_caja') {
    // Cerrar es definitivo: gana el cierre, venga de aquí o de la nube; el resto (ventas
    // de último minuto) se toma de la versión más nueva.
    if (esCajaRevivida(local, cloud)) return conservarCierreCaja(local, mergeCloudMasNueva(local, cloud));
    if (esCajaRevivida(cloud, local)) return conservarCierreCaja(cloud, mergeCloudMasNueva(local, cloud));
    const merged = mergeCajaCierreGana(local, cloud);
    if (merged) return merged;
  }

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

/**
 * Qué precios de este aparato se suben a la nube al sincronizar (2026-11-16).
 * Solo los que no existen en la nube o cuya fecha local es MÁS NUEVA que la de la nube.
 * Así un celular con un costo viejo no borra la corrección hecha en otro equipo.
 * - remotoFechas: id → fechaActualizacion en la nube. null = no se pudo leer la nube → no subir nada.
 */
export const preciosParaSubir = <T extends { id: string; fechaActualizacion?: string; updatedAt?: string }>(
  locales: T[],
  remotoFechas: Map<string, string> | null,
  borrados: Set<string> = new Set()
): T[] => pendientesDeSubir(locales, remotoFechas, borrados, (p) => p.fechaActualizacion ?? p.updatedAt);

/**
 * Regla general (2026-11-16): de lo que tiene este aparato, qué se sube a la nube.
 * Solo lo que la nube no tiene, o lo que este aparato cambió DESPUÉS que la nube.
 * Usada para precios, clientes y créditos de clientes/empleadas.
 */
export const pendientesDeSubir = <T extends { id: string }>(
  locales: T[],
  remotoFechas: Map<string, string> | null,
  borrados: Set<string> = new Set(),
  fechaLocal: (item: T) => string | undefined = (i) =>
    ((i as Record<string, unknown>).updatedAt as string | undefined) ??
    ((i as Record<string, unknown>).createdAt as string | undefined)
): T[] => {
  if (!remotoFechas) return [];
  return locales.filter((local) => {
    if (!local?.id || borrados.has(local.id)) return false;
    if (!remotoFechas.has(local.id)) return true; // nuevo en este aparato
    const remoteTs = new Date(remotoFechas.get(local.id) || 0).getTime();
    const localTs = new Date(fechaLocal(local) ?? 0).getTime();
    if (!Number.isFinite(localTs) || localTs <= 0) return false;
    if (!Number.isFinite(remoteTs) || remoteTs <= 0) return true;
    return localTs > remoteTs;
  });
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

const ES_FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const vacio = (v: unknown) => v === null || v === undefined || v === '';

/**
 * ¿Es el mismo dato aunque venga escrito distinto? (2026-11-16)
 * La nube devuelve fechas como "2026-11-07T13:05:00+00:00" y el aparato las guarda con "Z";
 * los objetos JSON vuelven con las llaves en otro orden. Antes eso contaba como "cambió"
 * y cada aparato resubía todos sus registros en cada sincronización (6.000 envíos al día).
 */
export const valoresIguales = (a: unknown, b: unknown): boolean => {
  if (vacio(a) && vacio(b)) return true;
  if (vacio(a) || vacio(b)) return false;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a), nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) ? na === nb : a === b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return true;
    if (ES_FECHA_ISO.test(a) && ES_FECHA_ISO.test(b)) {
      const ta = new Date(a).getTime(), tb = new Date(b).getTime();
      return Number.isFinite(ta) && ta === tb;
    }
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => valoresIguales(x, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>;
    const llaves = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    for (const k of llaves) if (!valoresIguales(ra[k], rb[k])) return false;
    return true;
  }
  return a === b;
};

/** Ejecuta `fn` sobre la lista de a `tamano` a la vez (no cientos de envíos simultáneos). */
export const enLotes = async <T>(lista: T[], tamano: number, fn: (item: T) => Promise<unknown>): Promise<void> => {
  for (let i = 0; i < lista.length; i += tamano) {
    await Promise.all(lista.slice(i, i + tamano).map(fn));
  }
};

// ── Créditos de trabajadoras: un descuento de nómina nunca se deshace (2026-11-18) ──
// Un celular con una copia vieja (sin el descuento) volvía a dejar el crédito "activo" y
// el consumo reaparecía en la nómina siguiente. Se mide el avance por los cobros hechos.

const ESTADOS_CERRADOS = new Set(['descontado', 'pagado']);

/** Cuánto se ha cobrado de este crédito (suma de pagos con monto > 0). */
export const totalCobrado = (c: unknown): number => {
  const pagos = (c as { pagos?: unknown })?.pagos;
  if (!Array.isArray(pagos)) return 0;
  return pagos.reduce((s: number, p: any) => {
    const m = Number(p?.monto);
    return s + (p?.cobrada !== false && Number.isFinite(m) && m > 0 ? m : 0);
  }, 0);
};

/**
 * ¿`viejo` está ATRASADO frente a `nuevo` en cobros de nómina?
 * (nuevo ya está cerrado y viejo sigue activo, o nuevo tiene más cobrado).
 */
export const creditoAtrasado = (viejo: unknown, nuevo: unknown): boolean => {
  if (!viejo || !nuevo) return false;
  const ev = String((viejo as any).estado ?? '');
  const en = String((nuevo as any).estado ?? '');
  if (ESTADOS_CERRADOS.has(en) && !ESTADOS_CERRADOS.has(ev)) return true;
  return totalCobrado(nuevo) > totalCobrado(viejo) + 0.5;
};

/** Toma de `adelantado` los campos del cobro (estado, saldo, pagos, cuota); lo demás de `base`. */
const conservarCobro = <T extends { id: string }>(adelantado: T, base: T): T => {
  const a = adelantado as Record<string, unknown>;
  const o = { ...(base as Record<string, unknown>) };
  for (const k of ['estado', 'saldo', 'pagos', 'cuota', 'fechaDescuento']) {
    if (a[k] !== undefined) o[k] = a[k];
  }
  return o as T;
};

/** Unión para créditos: primero que no se pierda ningún cobro, luego la regla normal. */
export const mergeCreditoCobroGana = <T extends { id: string }>(local: T, cloud: T, normal: T): T => {
  if (creditoAtrasado(local, cloud)) return conservarCobro(cloud, normal);
  if (creditoAtrasado(cloud, local)) return conservarCobro(local, normal);
  return normal;
};
