/**
 * Recuperación crítica de gastos — lee TODAS las fuentes posibles y unifica en la DB actual.
 * Caso típico: gastos guardados en PriceControlDB (legacy) mientras la app lee dulce-placer-db.
 */
import { db } from '@/lib/database';
import { generateUUID } from '@/lib/safe-utils';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { fechaLocalHoy } from '@/lib/finanzas-personales';
import type { Gasto, GastoCategoria, MetodoPago } from '@/types';

const DB_LEGACY = 'PriceControlDB';
const STORE_GASTOS = 'gastos';

const CATEGORIAS_VALIDAS: GastoCategoria[] = [
  'Servicios',
  'Arriendo',
  'Materia Prima',
  'Nómina',
  'Mantenimiento',
  'Otros',
];

const METODOS_VALIDOS: MetodoPago[] = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'nequi',
  'daviplata',
  'credito',
];

export interface ResultadoRecuperacionGastos {
  gastos: Gasto[];
  migrados: number;
  desdeLegacy: number;
  desdeActual: number;
  desdeNube: number;
}

function leerIndexedDBStore(dbName: string, storeName: string): Promise<unknown[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve([]);
      return;
    }
    try {
      const req = indexedDB.open(dbName);
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(storeName)) {
          idb.close();
          resolve([]);
          return;
        }
        const tx = idb.transaction(storeName, 'readonly');
        const getAll = tx.objectStore(storeName).getAll();
        getAll.onsuccess = () => {
          idb.close();
          resolve(Array.isArray(getAll.result) ? getAll.result : []);
        };
        getAll.onerror = () => {
          idb.close();
          resolve([]);
        };
      };
    } catch {
      resolve([]);
    }
  });
}

/** Normaliza registros legacy / nube / locales al tipo Gasto actual */
export function normalizarGastoRecuperado(raw: unknown): Gasto | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;

  const id =
    typeof g.id === 'string' && g.id.trim().length > 0 ? g.id.trim() : generateUUID();

  const descripcion = String(
    g.descripcion ?? g.concepto ?? g.nombre ?? g.detalle ?? '',
  ).trim();

  const montoRaw = g.monto ?? g.valor ?? g.total ?? g.importe ?? 0;
  const monto = Math.round(Number(montoRaw) * 100) / 100;

  if (!descripcion || !Number.isFinite(monto) || monto <= 0) return null;

  let fecha = String(g.fecha ?? g.fechaGasto ?? g.createdAt ?? g.updatedAt ?? '').slice(
    0,
    10,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fecha = fechaLocalHoy();
  }

  const catRaw = String(g.categoria ?? 'Otros');
  const categoria = (
    CATEGORIAS_VALIDAS.includes(catRaw as GastoCategoria) ? catRaw : 'Otros'
  ) as GastoCategoria;

  const estadoRaw = String(g.estado ?? 'pagado').toLowerCase();
  const estado: Gasto['estado'] =
    estadoRaw === 'anulado'
      ? 'anulado'
      : estadoRaw === 'pendiente'
        ? 'pendiente'
        : 'pagado';

  const metodoRaw = String(g.metodoPago ?? g.metodo_pago ?? 'efectivo').toLowerCase();
  const metodoPago = (
    METODOS_VALIDOS.includes(metodoRaw as MetodoPago) ? metodoRaw : 'efectivo'
  ) as MetodoPago;

  const proveedorId =
    typeof g.proveedorId === 'string'
      ? g.proveedorId
      : typeof g.proveedor_id === 'string'
        ? g.proveedor_id
        : undefined;

  const usuarioId =
    typeof g.usuarioId === 'string'
      ? g.usuarioId
      : typeof g.usuario_id === 'string'
        ? g.usuario_id
        : 'recuperado';

  const facturaItems = Array.isArray(g.facturaItems)
    ? (g.facturaItems as Gasto['facturaItems'])
    : undefined;

  return {
    id,
    descripcion,
    monto,
    categoria,
    fecha,
    estado,
    proveedorId,
    metodoPago,
    usuarioId,
    cajaId: typeof g.cajaId === 'string' ? g.cajaId : undefined,
    comprobanteUrl:
      typeof g.comprobanteUrl === 'string'
        ? g.comprobanteUrl
        : typeof g.comprobante_url === 'string'
          ? g.comprobante_url
          : undefined,
    facturaItems,
    esFactura: Boolean(g.esFactura),
    metadata:
      g.metadata && typeof g.metadata === 'object'
        ? (g.metadata as Gasto['metadata'])
        : undefined,
  };
}

/**
 * Lee legacy (PriceControlDB) + DB actual + Supabase, fusiona y migra faltantes a dulce-placer-db.
 */
export async function recuperarGastosMultifuente(): Promise<ResultadoRecuperacionGastos> {
  const [legacyRaw, actualRaw, nubeRaw] = await Promise.all([
    leerIndexedDBStore(DB_LEGACY, STORE_GASTOS),
    db.getAllGastos().catch(() => [] as unknown[]),
    new SupabaseDatabase()
      .getAllGastos()
      .catch(() => [] as unknown[]),
  ]);

  const mapa = new Map<string, Gasto>();
  let desdeLegacy = 0;
  let desdeActual = 0;
  let desdeNube = 0;

  for (const raw of legacyRaw) {
    const g = normalizarGastoRecuperado(raw);
    if (g) {
      mapa.set(g.id, g);
      desdeLegacy += 1;
    }
  }

  for (const raw of actualRaw) {
    const g = normalizarGastoRecuperado(raw);
    if (g) {
      mapa.set(g.id, g);
      desdeActual += 1;
    }
  }

  for (const raw of nubeRaw) {
    const g = normalizarGastoRecuperado(raw);
    if (g) {
      mapa.set(g.id, g);
      desdeNube += 1;
    }
  }

  const gastos = Array.from(mapa.values()).sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || ''),
  );

  const idsActuales = new Set(
    (actualRaw as { id?: string }[])
      .map((x) => x.id)
      .filter((id): id is string => typeof id === 'string'),
  );

  let migrados = 0;
  for (const g of gastos) {
    if (g.estado === 'anulado') continue;
    if (idsActuales.has(g.id)) continue;
    try {
      await db.addGasto(g);
      idsActuales.add(g.id);
      migrados += 1;
    } catch {
      /* duplicado o fallo puntual */
    }
  }

  return {
    gastos: gastos.filter((g) => g.estado !== 'anulado'),
    migrados,
    desdeLegacy,
    desdeActual,
    desdeNube,
  };
}
