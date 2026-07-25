/**
 * NexusSync Bridge — escucha cada escritura en `db` (IndexedDB) y la replica
 * en paralelo hacia Supabase. Esto activa Supabase Realtime para que TODOS los
 * dispositivos conectados reciban el cambio en < 1 segundo.
 *
 * No modifica ningún archivo protegido. Opera como una capa de intercepción
 * sobre el objeto `db` exportado ya existente.
 */
import { db } from './database';
import { SupabaseDatabase } from './supabase-db';
import { registerSelfWrite } from './deviceId';

let patched = false;

export const supabaseDB = new SupabaseDatabase();

// Métodos originales (pre-patch) para que useRealtimeSync pueda escribir
// en IndexedDB SIN volver a disparar una escritura en Supabase (evita loops).
export const originalDbMethods: Record<string, (...args: any[]) => Promise<void>> = {};

type WriteSpec = {
  method: string;
  table: string;
  fn: (d: any) => Promise<void>;
};

type DeleteSpec = {
  method: string;
  table: string;
  fn: (id: string) => Promise<void>;
};

const WRITES: WriteSpec[] = [
  { method: 'addProducto',          table: 'productos',          fn: (d) => supabaseDB.addProducto(d) },
  { method: 'updateProducto',       table: 'productos',          fn: (d) => supabaseDB.updateProducto(d) },
  { method: 'addProveedor',         table: 'proveedores',        fn: (d) => supabaseDB.addProveedor(d) },
  { method: 'updateProveedor',      table: 'proveedores',        fn: (d) => supabaseDB.updateProveedor(d) },
  { method: 'addPrecio',            table: 'precios',            fn: (d) => supabaseDB.addPrecio(d) },
  { method: 'updatePrecio',         table: 'precios',            fn: (d) => supabaseDB.updatePrecio(d) },
  { method: 'addVenta',             table: 'ventas',             fn: (d) => supabaseDB.addVenta(d) },
  { method: 'addSesionCaja',        table: 'sesiones_caja',      fn: (d) => supabaseDB.addSesionCaja(d) },
  { method: 'updateSesionCaja',     table: 'sesiones_caja',      fn: (d) => supabaseDB.updateSesionCaja(d) },
  { method: 'addGasto',             table: 'gastos',             fn: (d) => supabaseDB.addGasto(d) },
  { method: 'updateGasto',          table: 'gastos',             fn: (d) => supabaseDB.updateGasto(d) },
  { method: 'addRecepcion',         table: 'recepciones',        fn: (d) => supabaseDB.addRecepcion(d) },
  { method: 'updateRecepcion',      table: 'recepciones',        fn: (d) => supabaseDB.updateRecepcion(d) },
  { method: 'addPrePedido',         table: 'prepedidos',         fn: (d) => supabaseDB.addPrePedido(d) },
  { method: 'updatePrePedido',      table: 'prepedidos',         fn: (d) => supabaseDB.updatePrePedido(d) },
  { method: 'updateInventarioItem', table: 'inventario',         fn: (d) => supabaseDB.updateInventarioItem(d) },
  { method: 'addCreditoCliente',    table: 'creditos_clientes',  fn: (d) => supabaseDB.addCreditoCliente(d) },
  { method: 'updateCreditoCliente', table: 'creditos_clientes',  fn: (d) => supabaseDB.updateCreditoCliente(d) },
  { method: 'addCreditoTrabajador', table: 'creditos_trabajadores', fn: (d) => supabaseDB.addCreditoTrabajador(d) },
  { method: 'updateCreditoTrabajador', table: 'creditos_trabajadores', fn: (d) => supabaseDB.updateCreditoTrabajador(d) },
  { method: 'addTrabajador',        table: 'trabajadores',       fn: (d) => supabaseDB.addTrabajador(d) },
  { method: 'updateTrabajador',     table: 'trabajadores',       fn: (d) => supabaseDB.updateTrabajador(d) },
  { method: 'addReceta',            table: 'recetas',            fn: (d) => supabaseDB.addReceta(d) },
  { method: 'updateReceta',         table: 'recetas',            fn: (d) => supabaseDB.updateReceta(d) },
  { method: 'addOrdenProduccion',   table: 'produccion',         fn: (d) => supabaseDB.addOrdenProduccion(d) },
  { method: 'updateOrdenProduccion',table: 'produccion',         fn: (d) => supabaseDB.updateOrdenProduccion(d) },
  { method: 'updateMesa',           table: 'mesas',              fn: (d) => supabaseDB.updateMesa(d) },
  { method: 'addPedidoActivo',      table: 'pedidos_activos',    fn: (d) => supabaseDB.addPedidoActivo(d) },
  { method: 'updatePedidoActivo',   table: 'pedidos_activos',    fn: (d) => supabaseDB.updatePedidoActivo(d) },
  { method: 'addCliente',           table: 'clientes',           fn: (d) => supabaseDB.addCliente(d) },
  { method: 'updateCliente',        table: 'clientes',           fn: (d) => supabaseDB.updateCliente(d) },
  { method: 'saveConfiguracion',    table: 'configuracion',      fn: (d) => supabaseDB.saveConfiguracion(d) },
  { method: 'addNomina',            table: 'nominas',            fn: (d) => supabaseDB.addNomina(d) },
  { method: 'updateNomina',         table: 'nominas',            fn: (d) => supabaseDB.updateNomina(d) },
];

const DELETES: DeleteSpec[] = [
  // 🛡️ ESCUDO DE KI ACTIVADO:
  // Todas las eliminaciones hacia Supabase están BLOQUEADAS temporalmente
  // para evitar pérdida catastrófica de datos por sincronizaciones erráticas.
  // 
  // { method: 'deleteProducto',           table: 'productos',              fn: (id) => supabaseDB.deleteProducto(id) },
  // { method: 'deleteProveedor',          table: 'proveedores',            fn: (id) => supabaseDB.deleteProveedor(id) },
  // { method: 'deletePrecio',             table: 'precios',                fn: (id) => supabaseDB.deletePrecio(id) },
  // { method: 'deleteGasto',              table: 'gastos',                 fn: (id) => supabaseDB.deleteGasto(id) },
  // { method: 'deleteRecepcion',          table: 'recepciones',            fn: (id) => supabaseDB.deleteRecepcion(id) },
  // { method: 'deletePrePedido',          table: 'prepedidos',             fn: (id) => supabaseDB.deletePrePedido(id) },
  // { method: 'deleteCreditoCliente',     table: 'creditos_clientes',      fn: (id) => supabaseDB.deleteCreditoCliente(id) },
  // { method: 'deleteCreditoTrabajador',  table: 'creditos_trabajadores',  fn: (id) => supabaseDB.deleteCreditoTrabajador(id) },
  // { method: 'deleteTrabajador',         table: 'trabajadores',           fn: (id) => supabaseDB.deleteTrabajador(id) },
  // { method: 'deleteReceta',             table: 'recetas',                fn: (id) => supabaseDB.deleteReceta(id) },
  // { method: 'deleteMesa',               table: 'mesas',                  fn: (id) => supabaseDB.deleteMesa(id) },
  // { method: 'deletePedidoActivo',       table: 'pedidos_activos',        fn: (id) => supabaseDB.deletePedidoActivo(id) },
  // { method: 'deleteCliente',            table: 'clientes',               fn: (id) => supabaseDB.deleteCliente(id) },
  // { method: 'deleteOrdenProduccion',    table: 'produccion',             fn: (id) => supabaseDB.deleteOrdenProduccion(id) },
];

export function applySyncPatch(): void {
  if (patched) return;
  patched = true;

  // Interceptar saveBackup y getBackup para replicación y corrección de arrays
  const originalGetBackup = db.getBackup.bind(db);
  const originalSaveBackup = db.saveBackup.bind(db);

  db.getBackup = async (key: string) => {
    const doc: any = await originalGetBackup(key);
    let resolvedDoc = doc;
    // Corregir bug de destructuración de arrays en IndexedDB ({ id: key, '0': x, '1': y... })
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      const arr: any[] = [];
      let i = 0;
      while (doc.hasOwnProperty(i.toString())) {
        arr.push(doc[i.toString()]);
        i++;
      }
      if (arr.length > 0) {
        resolvedDoc = arr;
      }
    }

    // Si local está vacío, intentar recuperar desde Supabase (sincronización inicial)
    if ((!resolvedDoc || (Array.isArray(resolvedDoc) && resolvedDoc.length === 0)) &&
        (key === 'formulaciones_data' || key === 'modelosPan_data' || key === 'cajas_config')) {
      console.log(`🌐 [Bridge] Sincronizando backup '${key}' desde la nube...`);
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

  db.saveBackup = async (key: string, val: any) => {
    await originalSaveBackup(key, val);
    if (key === 'formulaciones_data' || key === 'modelosPan_data' || key === 'cajas_config') {
      registerSelfWrite('configuracion', key);
      supabaseDB.saveBackup(key, val)
        .then(() => console.log(`✅ [Bridge] Backup '${key}' sincronizado a la nube.`))
        .catch((err: any) => console.error(`❌ [Bridge] Sincronización de backup '${key}' falló:`, err?.message ?? err));
    }
  };

  for (const spec of WRITES) {
    const original = (db as any)[spec.method]?.bind(db);
    if (!original) continue;
    originalDbMethods[spec.method] = original;

    (db as any)[spec.method] = async (data: any) => {
      registerSelfWrite(spec.table, data?.id ?? '');
      await original(data);
      spec.fn(data)
        .then(() => console.log(`✅ [Bridge] ${spec.table} → Supabase OK (${data?.id})`))
        .catch((err: any) => console.error(`❌ [Bridge] ${spec.table} → Supabase FALLÓ:`, err?.message ?? err, data));
    };
  }

  for (const spec of DELETES) {
    const original = (db as any)[spec.method]?.bind(db);
    if (!original) continue;
    originalDbMethods[spec.method] = original;

    (db as any)[spec.method] = async (id: string) => {
      registerSelfWrite(spec.table, id);
      await original(id);
      spec.fn(id)
        .then(() => console.log(`✅ [Bridge] DELETE ${spec.table} → Supabase OK (${id})`))
        .catch((err: any) => console.error(`❌ [Bridge] DELETE ${spec.table} → Supabase FALLÓ:`, err?.message ?? err, id));
    };
  }

  console.log('🔄 [NexusSync] Bridge activado — escrituras replicadas hacia Supabase Realtime.');
}
