/**
 * NexusSync Bridge — escucha cada escritura en `db` (IndexedDB) y la replica
 * en paralelo hacia Supabase. Esto activa Supabase Realtime para que TODOS los
 * dispositivos conectados reciban el cambio en < 1 segundo.
 *
 * Política Director: local YA → nube lo antes posible → cola si falla (no silencio).
 */
import { db } from './database';
import { SupabaseDatabase } from './supabase-db';
import { registerSelfWrite } from './deviceId';
import { encolarOutbox, flushOutbox } from './sync-outbox';
import { stampUpdatedAt } from './sync-merge-local-gana';

let patched = false;

export const supabaseDB = new SupabaseDatabase();

// Métodos originales (pre-patch) para que useRealtimeSync pueda escribir
// en IndexedDB SIN volver a disparar una escritura en Supabase (evita loops).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const originalDbMethods: Record<string, (...args: any[]) => Promise<void>> = {};

type WriteSpec = {
  method: string;
  table: string;
  fn: (d: Record<string, unknown>) => Promise<void>;
};

type DeleteSpec = {
  method: string;
  table: string;
  /** Nombre de colección local para tombstones (puede diferir del table supabase) */
  localTable: string;
  fn: (id: string) => Promise<void>;
};

const WRITES: WriteSpec[] = [
  { method: 'addProducto', table: 'productos', fn: (d) => supabaseDB.addProducto(d as never) },
  { method: 'updateProducto', table: 'productos', fn: (d) => supabaseDB.updateProducto(d as never) },
  { method: 'addProveedor', table: 'proveedores', fn: (d) => supabaseDB.addProveedor(d as never) },
  { method: 'updateProveedor', table: 'proveedores', fn: (d) => supabaseDB.updateProveedor(d as never) },
  { method: 'addPrecio', table: 'precios', fn: (d) => supabaseDB.addPrecio(d as never) },
  { method: 'updatePrecio', table: 'precios', fn: (d) => supabaseDB.updatePrecio(d as never) },
  { method: 'addVenta', table: 'ventas', fn: (d) => supabaseDB.addVenta(d as never) },
  { method: 'addSesionCaja', table: 'sesiones_caja', fn: (d) => supabaseDB.addSesionCaja(d as never) },
  { method: 'updateSesionCaja', table: 'sesiones_caja', fn: (d) => supabaseDB.updateSesionCaja(d as never) },
  { method: 'addGasto', table: 'gastos', fn: (d) => supabaseDB.addGasto(d as never) },
  { method: 'updateGasto', table: 'gastos', fn: (d) => supabaseDB.updateGasto(d as never) },
  { method: 'addRecepcion', table: 'recepciones', fn: (d) => supabaseDB.addRecepcion(d as never) },
  { method: 'updateRecepcion', table: 'recepciones', fn: (d) => supabaseDB.updateRecepcion(d as never) },
  { method: 'addPrePedido', table: 'prepedidos', fn: (d) => supabaseDB.addPrePedido(d as never) },
  { method: 'updatePrePedido', table: 'prepedidos', fn: (d) => supabaseDB.updatePrePedido(d as never) },
  { method: 'updateInventarioItem', table: 'inventario', fn: (d) => supabaseDB.updateInventarioItem(d as never) },
  { method: 'addCreditoCliente', table: 'creditos_clientes', fn: (d) => supabaseDB.addCreditoCliente(d as never) },
  { method: 'updateCreditoCliente', table: 'creditos_clientes', fn: (d) => supabaseDB.updateCreditoCliente(d as never) },
  { method: 'addCreditoTrabajador', table: 'creditos_trabajadores', fn: (d) => supabaseDB.addCreditoTrabajador(d as never) },
  { method: 'updateCreditoTrabajador', table: 'creditos_trabajadores', fn: (d) => supabaseDB.updateCreditoTrabajador(d as never) },
  { method: 'addTrabajador', table: 'trabajadores', fn: (d) => supabaseDB.addTrabajador(d as never) },
  { method: 'updateTrabajador', table: 'trabajadores', fn: (d) => supabaseDB.updateTrabajador(d as never) },
  { method: 'addReceta', table: 'recetas', fn: (d) => supabaseDB.addReceta(d as never) },
  { method: 'updateReceta', table: 'recetas', fn: (d) => supabaseDB.updateReceta(d as never) },
  { method: 'addOrdenProduccion', table: 'produccion', fn: (d) => supabaseDB.addOrdenProduccion(d as never) },
  { method: 'updateOrdenProduccion', table: 'produccion', fn: (d) => supabaseDB.updateOrdenProduccion(d as never) },
  { method: 'updateMesa', table: 'mesas', fn: (d) => supabaseDB.updateMesa(d as never) },
  { method: 'addPedidoActivo', table: 'pedidos_activos', fn: (d) => supabaseDB.addPedidoActivo(d as never) },
  { method: 'updatePedidoActivo', table: 'pedidos_activos', fn: (d) => supabaseDB.updatePedidoActivo(d as never) },
  { method: 'addCliente', table: 'clientes', fn: (d) => supabaseDB.addCliente(d as never) },
  { method: 'updateCliente', table: 'clientes', fn: (d) => supabaseDB.updateCliente(d as never) },
  { method: 'saveConfiguracion', table: 'configuracion', fn: (d) => supabaseDB.saveConfiguracion(d as never) },
  { method: 'addNomina', table: 'nominas', fn: (d) => supabaseDB.addNomina(d as never) },
  { method: 'updateNomina', table: 'nominas', fn: (d) => supabaseDB.updateNomina(d as never) },
];

/** Deletes → nube (tombstone local ya lo hace database._delete). Realtime avisa a otros aparatos. */
const DELETES: DeleteSpec[] = [
  { method: 'deleteProducto', table: 'productos', localTable: 'productos', fn: (id) => supabaseDB.deleteProducto(id) },
  { method: 'deleteProveedor', table: 'proveedores', localTable: 'proveedores', fn: (id) => supabaseDB.deleteProveedor(id) },
  { method: 'deletePrecio', table: 'precios', localTable: 'precios', fn: (id) => supabaseDB.deletePrecio(id) },
  { method: 'deleteGasto', table: 'gastos', localTable: 'gastos', fn: (id) => supabaseDB.deleteGasto(id) },
  { method: 'deleteRecepcion', table: 'recepciones', localTable: 'recepciones', fn: (id) => supabaseDB.deleteRecepcion(id) },
  { method: 'deletePrePedido', table: 'prepedidos', localTable: 'pre_pedidos', fn: (id) => supabaseDB.deletePrePedido(id) },
  { method: 'deleteCreditoCliente', table: 'creditos_clientes', localTable: 'creditos_clientes', fn: (id) => supabaseDB.deleteCreditoCliente(id) },
  { method: 'deleteCreditoTrabajador', table: 'creditos_trabajadores', localTable: 'creditos_trabajadores', fn: (id) => supabaseDB.deleteCreditoTrabajador(id) },
  { method: 'deleteTrabajador', table: 'trabajadores', localTable: 'trabajadores', fn: (id) => supabaseDB.deleteTrabajador(id) },
  { method: 'deleteReceta', table: 'recetas', localTable: 'recetas', fn: (id) => supabaseDB.deleteReceta(id) },
  { method: 'deleteMesa', table: 'mesas', localTable: 'mesas', fn: (id) => supabaseDB.deleteMesa(id) },
  { method: 'deletePedidoActivo', table: 'pedidos_activos', localTable: 'pedidos_activos', fn: (id) => supabaseDB.deletePedidoActivo(id) },
  { method: 'deleteCliente', table: 'clientes', localTable: 'clientes', fn: (id) => supabaseDB.deleteCliente(id) },
];

const UPSERT_BY_TABLE: Record<string, (d: unknown) => Promise<void>> = {
  productos: (d) => supabaseDB.addProducto(d as never),
  proveedores: (d) => supabaseDB.addProveedor(d as never),
  precios: (d) => supabaseDB.addPrecio(d as never),
  ventas: (d) => supabaseDB.addVenta(d as never),
  sesiones_caja: (d) => supabaseDB.updateSesionCaja(d as never),
  gastos: (d) => supabaseDB.addGasto(d as never),
  recepciones: (d) => supabaseDB.addRecepcion(d as never),
  prepedidos: (d) => supabaseDB.addPrePedido(d as never),
  inventario: (d) => supabaseDB.updateInventarioItem(d as never),
  creditos_clientes: (d) => supabaseDB.addCreditoCliente(d as never),
  creditos_trabajadores: (d) => supabaseDB.addCreditoTrabajador(d as never),
  trabajadores: (d) => supabaseDB.addTrabajador(d as never),
  recetas: (d) => supabaseDB.addReceta(d as never),
  produccion: (d) => supabaseDB.addOrdenProduccion(d as never),
  mesas: (d) => supabaseDB.updateMesa(d as never),
  pedidos_activos: (d) => supabaseDB.addPedidoActivo(d as never),
  clientes: (d) => supabaseDB.addCliente(d as never),
  configuracion: (d) => supabaseDB.saveConfiguracion(d as never),
  nominas: (d) => supabaseDB.addNomina(d as never),
};

const DELETE_BY_TABLE: Record<string, (id: string) => Promise<void>> = {
  productos: (id) => supabaseDB.deleteProducto(id),
  proveedores: (id) => supabaseDB.deleteProveedor(id),
  precios: (id) => supabaseDB.deletePrecio(id),
  gastos: (id) => supabaseDB.deleteGasto(id),
  recepciones: (id) => supabaseDB.deleteRecepcion(id),
  prepedidos: (id) => supabaseDB.deletePrePedido(id),
  creditos_clientes: (id) => supabaseDB.deleteCreditoCliente(id),
  creditos_trabajadores: (id) => supabaseDB.deleteCreditoTrabajador(id),
  trabajadores: (id) => supabaseDB.deleteTrabajador(id),
  recetas: (id) => supabaseDB.deleteReceta(id),
  mesas: (id) => supabaseDB.deleteMesa(id),
  pedidos_activos: (id) => supabaseDB.deletePedidoActivo(id),
  clientes: (id) => supabaseDB.deleteCliente(id),
};

/** Reintenta cola de pendientes (llamar al volver online / syncNow). */
export const flushSyncOutbox = async (): Promise<number> =>
  flushOutbox({
    upsert: async (table, data) => {
      const fn = UPSERT_BY_TABLE[table];
      if (!fn) throw new Error(`Sin handler upsert para ${table}`);
      const id = String((data as { id?: string })?.id ?? '');
      if (id) registerSelfWrite(table, id);
      await fn(data);
    },
    delete: async (table, id) => {
      const fn = DELETE_BY_TABLE[table];
      if (!fn) throw new Error(`Sin handler delete para ${table}`);
      registerSelfWrite(table, id);
      await fn(id);
    },
  });

const replicateUpsert = (table: string, data: Record<string, unknown>, fn: WriteSpec['fn']): void => {
  registerSelfWrite(table, String(data.id ?? ''));
  fn(data)
    .catch((e: unknown) => {
      console.warn(`[Bridge] ${table} → Supabase upsert falló, encolando:`, e);
      encolarOutbox(table, 'upsert', data, String(e));
    });
};

const replicateDelete = (table: string, id: string, fn: DeleteSpec['fn']): void => {
  registerSelfWrite(table, id);
  fn(id)
    .catch((e: unknown) => {
      console.warn(`[Bridge] DELETE ${table} → Supabase falló, encolando:`, e);
      encolarOutbox(table, 'delete', id, String(e));
    });
};

export function applySyncPatch(): void {
  if (patched) return;
  patched = true;

  const originalGetBackup = db.getBackup.bind(db);
  const originalSaveBackup = db.saveBackup.bind(db);

  db.getBackup = async (key: string) => {
    const doc: unknown = await originalGetBackup(key);
    let resolvedDoc = doc;
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      const arr: unknown[] = [];
      let i = 0;
      const rec = doc as Record<string, unknown>;
      while (Object.prototype.hasOwnProperty.call(rec, i.toString())) {
        arr.push(rec[i.toString()]);
        i++;
      }
      if (arr.length > 0) {
        resolvedDoc = arr;
      }
    }

    if (
      (!resolvedDoc || (Array.isArray(resolvedDoc) && resolvedDoc.length === 0)) &&
      (key === 'formulaciones_data' || key === 'modelosPan_data' || key === 'cajas_config')
    ) {
      try {
        const remote = await supabaseDB.getBackup(key);
        if (remote) {
          await originalSaveBackup(key, remote);
          resolvedDoc = remote;
        }
      } catch (err) {
        console.error(`❌ [Bridge] Error al descargar backup '${key}':`, err);
      }
    }
    return resolvedDoc;
  };

  db.saveBackup = async (key: string, val: unknown) => {
    await originalSaveBackup(key, val);
    if (key === 'formulaciones_data' || key === 'modelosPan_data' || key === 'cajas_config') {
      registerSelfWrite('configuracion', key);
      supabaseDB
        .saveBackup(key, val)
        .catch((e: unknown) => {
          console.warn(`[Bridge] Backup '${key}' → Supabase falló, encolando:`, e);
          encolarOutbox('configuracion', 'upsert', { id: key, categorias: val }, String(e));
        });
    }
  };

  for (const spec of WRITES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (db as any)[spec.method]?.bind(db);
    if (!original) continue;
    originalDbMethods[spec.method] = original;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)[spec.method] = async (data: any) => {
      const stamped = stampUpdatedAt({ ...(data || {}) });
      registerSelfWrite(spec.table, String(stamped.id ?? ''));
      await original(stamped);
      replicateUpsert(spec.table, stamped, spec.fn);
    };
  }

  for (const spec of DELETES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (db as any)[spec.method]?.bind(db);
    if (!original) continue;
    originalDbMethods[spec.method] = original;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)[spec.method] = async (id: string) => {
      await original(id);
      replicateDelete(spec.table, id, spec.fn);
    };
  }

}
