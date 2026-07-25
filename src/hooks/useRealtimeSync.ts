/**
 * useRealtimeSync — suscripción PASIVA a Supabase Realtime.
 *
 * Solo escucha. No hace polling ni push automático.
 * Cuando OTRO dispositivo escribe algo, Supabase lo notifica por WebSocket,
 * este hook lo escribe en IndexedDB local y muestra el banner.
 *
 * Sin timers automáticos. Sin peticiones en segundo plano. Sin recargas forzadas.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { isSelfWrite, registerSelfWrite } from '@/lib/deviceId';
import { originalDbMethods, supabaseDB } from '@/lib/supabase-sync-bridge';
import { db, localAdapter } from '@/lib/database';

const _sdb = new SupabaseDatabase();

type Handler = {
  getFromSupabase: () => Promise<any[]>;
  writeToLocal:    (item: any) => Promise<void>;
  deleteFromLocal: (id: string) => Promise<void>;
  localTableName:  string;
};

function orig(name: string, fallback: (...a: any[]) => Promise<any>) {
  return (...args: any[]) => (originalDbMethods[name] ?? fallback)(...args);
}

const HANDLERS: Record<string, Handler> = {
  productos: {
    localTableName:  'productos',
    getFromSupabase: () => _sdb.getAllProductos(),
    writeToLocal:    (d) => orig('updateProducto', db.updateProducto.bind(db))(d),
    // Borra solo del IndexedDB local — NO propaga a Firebase.
    // Si propagáramos a Firebase, el siguiente sync Firebase->local no podría restaurarlo.
    // La tombstone la agrega applyRemoteChange justo después de llamar este método.
    deleteFromLocal: (id) => localAdapter.deleteDocument('productos', id),
  },
  proveedores: {
    localTableName:  'proveedores',
    getFromSupabase: () => _sdb.getAllProveedores(),
    writeToLocal:    (d) => orig('updateProveedor', db.updateProveedor.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteProveedor', db.deleteProveedor.bind(db))(id),
  },
  precios: {
    localTableName:  'precios',
    getFromSupabase: () => _sdb.getAllPrecios(),
    writeToLocal:    (d) => orig('updatePrecio', db.updatePrecio.bind(db))(d),
    deleteFromLocal: (id) => orig('deletePrecio', db.deletePrecio.bind(db))(id),
  },
  ventas: {
    localTableName:  'ventas',
    getFromSupabase: () => _sdb.getAllVentas(),
    writeToLocal:    (d) => orig('addVenta', db.addVenta.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  sesiones_caja: {
    localTableName:  'sesiones_caja',
    getFromSupabase: () => _sdb.getAllSesionesCaja(),
    writeToLocal:    (d) => orig('updateSesionCaja', db.updateSesionCaja.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  inventario: {
    localTableName:  'inventario',
    getFromSupabase: () => _sdb.getAllInventario(),
    writeToLocal:    (d) => orig('updateInventarioItem', db.updateInventarioItem.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  recepciones: {
    localTableName:  'recepciones',
    getFromSupabase: () => _sdb.getAllRecepciones(),
    writeToLocal:    (d) => orig('updateRecepcion', db.updateRecepcion.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteRecepcion', db.deleteRecepcion.bind(db))(id),
  },
  gastos: {
    localTableName:  'gastos',
    getFromSupabase: () => _sdb.getAllGastos(),
    writeToLocal:    (d) => orig('updateGasto', db.updateGasto.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteGasto', db.deleteGasto.bind(db))(id),
  },
  creditos_clientes: {
    localTableName:  'creditos_clientes',
    getFromSupabase: () => _sdb.getAllCreditosClientes(),
    writeToLocal:    (d) => orig('updateCreditoCliente', db.updateCreditoCliente.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteCreditoCliente', db.deleteCreditoCliente.bind(db))(id),
  },
  prepedidos: {
    localTableName:  'pre_pedidos',
    getFromSupabase: () => _sdb.getAllPrePedidos(),
    writeToLocal:    (d) => orig('updatePrePedido', db.updatePrePedido.bind(db))(d),
    deleteFromLocal: (id) => orig('deletePrePedido', db.deletePrePedido.bind(db))(id),
  },
  creditos_trabajadores: {
    localTableName:  'creditos_trabajadores',
    getFromSupabase: () => _sdb.getAllCreditosTrabajadores(),
    writeToLocal:    (d) => orig('updateCreditoTrabajador', db.updateCreditoTrabajador.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteCreditoTrabajador', db.deleteCreditoTrabajador.bind(db))(id),
  },
  trabajadores: {
    localTableName:  'trabajadores',
    getFromSupabase: () => _sdb.getAllTrabajadores(),
    writeToLocal:    (d) => orig('updateTrabajador', db.updateTrabajador.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteTrabajador', db.deleteTrabajador.bind(db))(id),
  },
  recetas: {
    localTableName:  'recetas',
    getFromSupabase: () => _sdb.getAllRecetas(),
    writeToLocal:    (d) => orig('updateReceta', db.updateReceta.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteReceta', db.deleteReceta.bind(db))(id),
  },
  produccion: {
    localTableName:  'produccion',
    getFromSupabase: () => _sdb.getAllOrdenesProduccion(),
    writeToLocal:    (d) => orig('updateOrdenProduccion', db.updateOrdenProduccion.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  mesas: {
    localTableName:  'mesas',
    getFromSupabase: () => _sdb.getAllMesas(),
    writeToLocal:    (d) => orig('updateMesa', db.updateMesa.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteMesa', db.deleteMesa.bind(db))(id),
  },
  pedidos_activos: {
    localTableName:  'pedidos_activos',
    getFromSupabase: () => _sdb.getAllPedidosActivos(),
    writeToLocal:    (d) => orig('updatePedidoActivo', db.updatePedidoActivo.bind(db))(d),
    deleteFromLocal: (id) => orig('deletePedidoActivo', db.deletePedidoActivo.bind(db))(id),
  },
  clientes: {
    localTableName:  'clientes',
    getFromSupabase: () => _sdb.getAllClientes(),
    writeToLocal:    (d) => orig('updateCliente', db.updateCliente.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteCliente', db.deleteCliente.bind(db))(id),
  },
  configuracion: {
    localTableName:  'configuracion',
    getFromSupabase: () => _sdb.getAllConfiguraciones(),
    writeToLocal:    async (d) => {
      if (d.id === 'formulaciones_data' || d.id === 'modelosPan_data' || d.id === 'cajas_config') {
        const val = d.categorias;
        const toSave = Array.isArray(val) ? { id: d.id, data: val } : { id: d.id, ...val };
        await localAdapter.setDocument('backups', d.id, toSave).catch(() => {});
        window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
          detail: { table: d.id, eventType: 'UPDATE', id: d.id },
        }));
      } else {
        await orig('saveConfiguracion', db.saveConfiguracion.bind(db))(d);
      }
    },
    deleteFromLocal: async () => {},
  },
};

export const TABLE_LABELS: Record<string, string> = {
  productos:         'Productos',
  proveedores:       'Proveedores',
  precios:           'Precios',
  ventas:            'Ventas',
  sesiones_caja:     'Caja',
  inventario:        'Inventario',
  recepciones:       'Recepciones',
  gastos:            'Gastos',
  creditos_clientes: 'Créditos',
  prepedidos:             'Pre-pedidos',
  creditos_trabajadores:  'Créd. Trabajadores',
  trabajadores:           'Trabajadores',
  recetas:                'Recetas',
  produccion:             'Producción',
  mesas:                  'Mesas',
  pedidos_activos:        'Pedidos Activos',
  clientes:               'Clientes',
  configuracion:          'Configuración',
};

export interface RemoteSyncEvent {
  table: string;
  label: string;
  eventType: string;
  id: string;
  timestamp: number;
}

export function useRealtimeSync() {
  const [pendingChanges, setPendingChanges]   = useState<RemoteSyncEvent[]>([]);
  const [syncConnected, setSyncConnected]     = useState(false);
  const channelsRef      = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const processingRef    = useRef(new Set<string>());
  const syncNowIds       = useRef(new Set<string>());  // IDs subidos en syncNow — bloquea sus ecos

  const applyRemoteChange = useCallback(async (
    table: string,
    eventType: string,
    record: any,
  ) => {
    const recordId: string | undefined = record?.id;
    if (!recordId) return;

    // Ignorar eco: registro que este dispositivo escribió hace < 8s
    if (isSelfWrite(table, recordId)) return;
    // Ignorar eco de syncNow solo en INSERT/UPDATE — los DELETE de otro dispositivo siempre se aplican
    if (eventType !== 'DELETE' && syncNowIds.current.has(`${table}:${recordId}`)) return;

    const key = `${table}:${recordId}:${eventType}`;
    if (processingRef.current.has(key)) return;
    processingRef.current.add(key);

    try {
      const handler = HANDLERS[table];
      if (!handler) return;

      if (eventType === 'DELETE') {
        // DELETE remoto: siempre borrar del IndexedDB local.
        // Los tombstones protegen contra resurrección por INSERT/UPDATE,
        // pero un DELETE explícito de otro dispositivo SIEMPRE debe aplicarse.
        await handler.deleteFromLocal(recordId);
        // Registrar tombstone para que syncNow no lo vuelva a bajar
        await db.addTombstone(handler.localTableName, recordId).catch(() => {});
      } else {
        // Verificar tombstone: si fue eliminado localmente, no resurrectar
        const tombstones = await db.getTombstones(handler.localTableName).catch(() => [] as string[]);
        if (tombstones.includes(recordId)) return;

        // Obtener el registro completo y mapeado desde Supabase
        const allItems = await handler.getFromSupabase();
        const item = allItems.find((i: any) => i.id === recordId);
        if (item) await handler.writeToLocal(item);
      }

      setPendingChanges(prev => {
        const sin = prev.filter(e => e.table !== table);
        return [...sin, {
          table,
          label: TABLE_LABELS[table] ?? table,
          eventType,
          id: recordId,
          timestamp: Date.now(),
        }];
      });

      window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
        detail: { table, eventType, id: recordId },
      }));

      console.log(`📡 [NexusSync] ${table} ${eventType} ${recordId} recibido de otro dispositivo.`);
    } catch (err) {
      console.error(`❌ [NexusSync] Error en ${table}:`, err);
    } finally {
      setTimeout(() => processingRef.current.delete(key), 3000);
    }
  }, []);

  // Sincronización manual — solo cuando el usuario lo pide
  const syncNow = useCallback(async () => {
    syncNowIds.current.clear();

    // Push: sube datos locales clave a Supabase
    // Para productos y proveedores: push inteligente con comparación de timestamps.
    // Solo sube si el item NO existe en Supabase O si la versión local es MÁS NUEVA.
    // Esto evita que un dispositivo con datos viejos sobreescriba ediciones recientes
    // y evita resurrecciones de productos eliminados que otro dispositivo tenía.
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const [supabaseProductos, supabaseProveedores] = await Promise.all([
      _sdb.getAllProductos().catch(() => [] as any[]),
      _sdb.getAllProveedores().catch(() => [] as any[]),
    ]);
    const sProdsMap = new Map(supabaseProductos.map((i: any) => [i.id, i.updatedAt ?? i.createdAt ?? '']));
    const sProvsMap = new Map(supabaseProveedores.map((i: any) => [i.id, i.updatedAt ?? i.createdAt ?? '']));

    const pushTasks: [string, () => Promise<any[]>, (d: any) => Promise<void>][] = [
      ['productos', async () => {
        const tombstones = await db.getTombstones('productos').catch(() => [] as string[]);
        const tombSet = new Set(tombstones);
        const items = await db.getAllProductos().then(all => all.filter((i: any) => i.id && UUID.test(i.id)));
        return items.filter((local: any) => {
          if (tombSet.has(local.id)) return false; // eliminado localmente, no subir
          const remoteTs = sProdsMap.get(local.id);
          if (remoteTs === undefined) return true; // nuevo en local
          // Solo subir si la versión local es más reciente
          return new Date(local.updatedAt ?? local.createdAt ?? 0) > new Date(remoteTs);
        });
      }, (d) => supabaseDB.addProducto(d)],
      ['proveedores', async () => {
        const tombstones = await db.getTombstones('proveedores').catch(() => [] as string[]);
        const tombSet = new Set(tombstones);
        const items = await db.getAllProveedores();
        return items.filter((local: any) => {
          if (tombSet.has(local.id)) return false;
          const remoteTs = sProvsMap.get(local.id);
          if (remoteTs === undefined) return true;
          return new Date(local.updatedAt ?? local.createdAt ?? 0) > new Date(remoteTs);
        });
      }, (d) => supabaseDB.addProveedor(d)],
      ['precios',     () => db.getAllPrecios(),          (d) => supabaseDB.addPrecio(d)],
      ['ventas',      () => db.getAllVentas(),           (d) => supabaseDB.addVenta(d)],
      ['gastos',      () => db.getAllGastos(),           (d) => supabaseDB.addGasto(d)],
      ['recepciones', () => db.getAllRecepciones(),      (d) => supabaseDB.addRecepcion(d)],
      ['inventario',  async () => {
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const [items, prods] = await Promise.all([db.getAllInventario(), db.getAllProductos()]);
        const validIds = new Set(prods.filter((p: any) => UUID.test(p.id)).map((p: any) => p.id));
        return items.filter((i: any) => i.productoId && UUID.test(i.productoId) && validIds.has(i.productoId));
      }, (d) => supabaseDB.updateInventarioItem(d)],
      ['prepedidos',  () => db.getAllPrePedidos(),       (d) => supabaseDB.addPrePedido(d)],
      ['creditos_clientes',    () => db.getAllCreditosClientes(), (d) => supabaseDB.addCreditoCliente(d)],
      ['sesiones_caja',        () => db.getAllSesionesCaja(),     (d) => supabaseDB.updateSesionCaja(d)],
      ['mesas',       () => db.getAllMesas(),             (d) => supabaseDB.updateMesa(d)],
      ['pedidos_activos', () => db.getAllPedidosActivos(), (d) => supabaseDB.addPedidoActivo(d)],
      ['trabajadores',    () => db.getAllTrabajadores(),   (d) => supabaseDB.addTrabajador(d)],
      ['creditos_trabajadores', () => db.getAllCreditosTrabajadores(), (d) => supabaseDB.addCreditoTrabajador(d)],
      ['recetas',         () => db.getAllRecetas(),        (d) => supabaseDB.addReceta(d)],
      ['produccion',      () => db.getAllOrdenesProduccion(), (d) => supabaseDB.addOrdenProduccion(d)],
      ['clientes',        () => db.getAllClientes(),       (d) => supabaseDB.addCliente(d)],
      ['nominas',         () => db.getAllNominas(),        (d) => supabaseDB.addNomina(d)],
      ['configuracion',   () => db.getConfiguracion().then(c => c ? [c] : []), (d) => supabaseDB.saveConfiguracion(d)],
      ['formulaciones_data', async () => {
        const val = await db.getBackup('formulaciones_data');
        return val ? [{ id: 'formulaciones_data', categorias: val }] : [];
      }, (d) => supabaseDB.saveBackup(d.id, d.categorias)],
      ['modelosPan_data', async () => {
        const val = await db.getBackup('modelosPan_data');
        return val ? [{ id: 'modelosPan_data', categorias: val }] : [];
      }, (d) => supabaseDB.saveBackup(d.id, d.categorias)],
      ['cajas_config', async () => {
        const val = await db.getBackup('cajas_config');
        return val ? [{ id: 'cajas_config', categorias: val }] : [];
      }, (d) => supabaseDB.saveBackup(d.id, d.categorias)],
      ['tombstones', async () => {
        const all = await localAdapter.getCollection('tombstones').catch(() => []);
        return all;
      }, async (t: any) => {
        await supabaseDB.addTombstone(t.table, t.item_id).catch(() => {});
        if (t.table === 'productos') await supabaseDB.deleteProducto(t.item_id).catch(() => {});
        else if (t.table === 'proveedores') await supabaseDB.deleteProveedor(t.item_id).catch(() => {});
        else if (t.table === 'precios') await supabaseDB.deletePrecio(t.item_id).catch(() => {});
        else if (t.table === 'recepciones') await supabaseDB.deleteRecepcion(t.item_id).catch(() => {});
        else if (t.table === 'gastos') await supabaseDB.deleteGasto(t.item_id).catch(() => {});
        else if (t.table === 'creditos_clientes') await supabaseDB.deleteCreditoCliente(t.item_id).catch(() => {});
        else if (t.table === 'pre_pedidos') await supabaseDB.deletePrePedido(t.item_id).catch(() => {});
        else if (t.table === 'creditos_trabajadores') await supabaseDB.deleteCreditoTrabajador(t.item_id).catch(() => {});
        else if (t.table === 'trabajadores') await supabaseDB.deleteTrabajador(t.item_id).catch(() => {});
        else if (t.table === 'recetas') await supabaseDB.deleteReceta(t.item_id).catch(() => {});
        else if (t.table === 'mesas') await supabaseDB.deleteMesa(t.item_id).catch(() => {});
        else if (t.table === 'pedidos_activos') await supabaseDB.deletePedidoActivo(t.item_id).catch(() => {});
        else if (t.table === 'clientes') await supabaseDB.deleteCliente(t.item_id).catch(() => {});
      }],
    ];
    // Push todas las tablas en paralelo (antes era secuencial y tardaba mucho)
    await Promise.all(pushTasks.map(async ([tableName, getLocal, writeSupabase]) => {
      const items = await getLocal().catch(() => []);
      if (items.length === 0) return;
      let okCount = 0; let errCount = 0; let lastErr: any = null;
      await Promise.all(items.map((item: any) => {
        if (item?.id) {
          registerSelfWrite(tableName, item.id);
          syncNowIds.current.add(`${tableName}:${item.id}`);
        }
        return writeSupabase(item)
          .then(() => { okCount++; })
          .catch((err: any) => { errCount++; lastErr = err; });
      }));
      if (errCount > 0) {
        console.warn(`⚠️ [syncNow] ${tableName}: ${errCount} fallos, ${okCount} OK. Error:`, lastErr?.message ?? lastErr);
      } else {
        console.log(`✅ [syncNow] ${tableName}: ${okCount} items subidos`);
      }
    }));

    // Pull: descarga desde Supabase lo que no esté en local (respeta tombstones)
    for (const [table, handler] of Object.entries(HANDLERS)) {
      const [supabaseItems, localItems, tombstones] = await Promise.all([
        handler.getFromSupabase().catch(() => [] as any[]),
        (async () => {
          switch (table) {
            case 'productos':         return db.getAllProductos();
            case 'proveedores':       return db.getAllProveedores();
            case 'precios':           return db.getAllPrecios();
            case 'ventas':            return db.getAllVentas();
            case 'sesiones_caja':          return db.getAllSesionesCaja();
            case 'inventario':        return db.getAllInventario();
            case 'recepciones':       return db.getAllRecepciones();
            case 'gastos':            return db.getAllGastos();
            case 'creditos_clientes':      return db.getAllCreditosClientes();
            case 'prepedidos':             return db.getAllPrePedidos();
            case 'creditos_trabajadores':  return db.getAllCreditosTrabajadores();
            case 'trabajadores':           return db.getAllTrabajadores();
            case 'recetas':                return db.getAllRecetas();
            case 'produccion':             return db.getAllOrdenesProduccion();
            case 'mesas':                  return db.getAllMesas();
            case 'pedidos_activos':        return db.getAllPedidosActivos();
            case 'clientes':               return db.getAllClientes();
            case 'configuracion':          return db.getConfiguracion().then(c => c ? [c] : []).then(async (list) => {
              const fData = await db.getBackup('formulaciones_data');
              const mData = await db.getBackup('modelosPan_data');
              const cData = await db.getBackup('cajas_config');
              if (fData) list.push({ id: 'formulaciones_data', categorias: fData });
              if (mData) list.push({ id: 'modelosPan_data', categorias: mData });
              if (cData) list.push({ id: 'cajas_config', categorias: cData });
              return list;
            });
            default:                       return [];
          }
        })(),
        db.getTombstones(handler.localTableName).catch(() => [] as string[]),
      ]);

      const localIds     = new Set(localItems.map((i: any) => i.id));
      const localTsMap   = new Map(localItems.map((i: any) => [i.id, i.updatedAt ?? i.createdAt ?? '']));
      const tombstoneSet = new Set(tombstones);

      // Items que no existen localmente y no están tombstoneados → descargar
      const nuevos = supabaseItems.filter((i: any) =>
        i.id && !localIds.has(i.id) && !tombstoneSet.has(i.id),
      );
      // Items que YA existen localmente pero Supabase tiene versión MÁS NUEVA → actualizar
      // Ventas son inmutables (no se editan después de creadas)
      const TABLAS_INMUTABLES = ['ventas'];
      const actualizados = TABLAS_INMUTABLES.includes(table)
        ? []
        : supabaseItems.filter((remote: any) => {
            if (!remote.id || !localIds.has(remote.id) || tombstoneSet.has(remote.id)) return false;

            if (table === 'inventario') {
              const localItem = localItems.find((l: any) => l.id === remote.id);
              return !localItem
                || remote.stockActual !== localItem.stockActual
                || remote.stockMinimo  !== localItem.stockMinimo;
            }

            // Extraer timestamp de modificación del registro (varios nombres de campo posibles)
            const remoteTs = new Date(
              remote.updatedAt ?? remote.fechaActualizacion ?? remote.ultimoCambio ??
              remote.updated_at ?? remote.createdAt ?? remote.created_at ?? 0
            ).getTime();
            const localItem = localItems.find((l: any) => l.id === remote.id);
            const localTs = new Date(
              localItem?.updatedAt ?? localItem?.fechaActualizacion ?? localItem?.ultimoCambio ??
              localItem?.updated_at ?? localItem?.createdAt ?? localItem?.created_at ?? 0
            ).getTime();

            // Ambos tienen timestamp → solo actualizar si remoto es más nuevo
            if (remoteTs > 0 && localTs > 0) return remoteTs > localTs;
            // Local tiene timestamp pero remoto no → conservar local
            if (localTs > 0 && remoteTs === 0) return false;
            // Sin timestamps confiables → actualizar (push ya subió local a Supabase)
            return true;
          });
      for (const item of nuevos)        await handler.writeToLocal(item).catch(() => {});
      for (const item of actualizados)  await handler.writeToLocal(item).catch(() => {});
      
      const restaurar = supabaseItems.filter((remote: any) => {
        if (!remote.id || !tombstoneSet.has(remote.id)) return false;
        const remoteTs = new Date(
          remote.updatedAt ?? remote.fechaActualizacion ?? remote.ultimoCambio ??
          remote.updated_at ?? remote.createdAt ?? remote.created_at ?? 0
        ).getTime();
        const localTs = new Date(localTsMap.get(remote.id) as string || 0).getTime();
        return remoteTs > localTs && remoteTs > 0;
      });
      
      for (const item of restaurar) {
        await handler.writeToLocal(item).catch(() => {});
        await db.removeTombstone(handler.localTableName, item.id).catch(() => {});
      }

      const hayNuevos = nuevos.length > 0 || actualizados.length > 0 || restaurar.length > 0;
      if (hayNuevos) {
        setPendingChanges(prev => {
          const sin = prev.filter(e => e.table !== table);
          return [...sin, {
            table, label: TABLE_LABELS[table] ?? table,
            eventType: 'MANUAL', id: 'manual', timestamp: Date.now(),
          }];
        });
        // Notificar listeners locales (ej: useInventario recarga el estado de React)
        window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
          detail: { table, eventType: 'MANUAL', id: 'manual' },
        }));
      }
    }
    // Sincronizar configuración del negocio (no está en HANDLERS porque es doc único)
    try {
      const [configRemota, configLocal] = await Promise.all([
        _sdb.getConfiguracion().catch(() => null as any),
        db.getConfiguracion().catch(() => null as any),
      ]);
      if (configRemota) {
        const remoteTs = new Date(configRemota.updatedAt ?? configRemota.updated_at ?? 0).getTime();
        const localTs  = new Date(configLocal?.updatedAt ?? configLocal?.updated_at ?? 0).getTime();
        if (remoteTs > localTs || (!configLocal && configRemota)) {
          await db.saveConfiguracion({ ...configRemota, id: 'main' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
            detail: { table: 'configuracion', eventType: 'MANUAL', id: 'main' },
          }));
          console.log('✅ [syncNow] configuracion: actualizada desde Supabase');
        } else if (configLocal) {
          await _sdb.saveConfiguracion({ ...configLocal, id: 'main' }).catch(() => {});
          console.log('✅ [syncNow] configuracion: subida a Supabase');
        }
      } else if (configLocal) {
        await _sdb.saveConfiguracion({ ...configLocal, id: 'main' }).catch(() => {});
        console.log('✅ [syncNow] configuracion: subida a Supabase (primera vez)');
      }
    } catch (e) {
      console.warn('⚠️ [syncNow] configuracion: error en sync', e);
    }

    // Sincronizar nóminas (append-only, no está en HANDLERS)
    try {
      const [nominasRemota, nominasLocal] = await Promise.all([
        _sdb.getAllNominas().catch(() => [] as any[]),
        db.getAllNominas().catch(() => [] as any[]),
      ]);
      const localNominaIds = new Set(nominasLocal.map((n: any) => n.id));
      const nuevasNominas = nominasRemota.filter((n: any) => n.id && !localNominaIds.has(n.id));
      for (const n of nuevasNominas) {
        await db.addNomina(n).catch(() => {});
      }
      if (nuevasNominas.length > 0) {
        window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
          detail: { table: 'nominas', eventType: 'MANUAL', id: 'manual' },
        }));
        console.log(`✅ [syncNow] nominas: ${nuevasNominas.length} nuevas descargadas`);
      }
    } catch (e) {
      console.warn('⚠️ [syncNow] nominas: error en sync', e);
    }

    // DEDUPLICACIÓN DE CLIENTES DUPLICADOS (ej: Lucho Alita)
    try {
      const allClients = await db.getAllClientes();
      const clientMap = new Map<string, any[]>();
      for (const c of allClients) {
        if (!c.nombre) continue;
        const norm = c.nombre.toLowerCase().trim();
        if (!clientMap.has(norm)) clientMap.set(norm, []);
        clientMap.get(norm)!.push(c);
      }

      for (const [norm, list] of clientMap.entries()) {
        if (list.length > 1) {
          const allCredits = await db.getAllCreditosClientes();
          const canonical = list.reduce((best, cur) => {
            const bestCredits = allCredits.filter((c: any) => c.clienteId === best.id).length;
            const curCredits = allCredits.filter((c: any) => c.clienteId === cur.id).length;
            if (curCredits > bestCredits) return cur;
            return best;
          }, list[0]);

          console.log(`[Deduplicate Clients] Múltiples clientes para "${canonical.nombre}". Canónico: ${canonical.id}`);
          
          for (const duplicate of list) {
            if (duplicate.id === canonical.id) continue;
            // 1. Reasignar créditos que apuntan al duplicado
            const dupCredits = allCredits.filter((c: any) => c.clienteId === duplicate.id);
            for (const cred of dupCredits) {
              cred.clienteId = canonical.id;
              await db.updateCreditoCliente(cred);
              await _sdb.addCreditoCliente(cred).catch(() => {});
            }

            // 2. Reasignar ventas que apuntan al duplicado
            const allVentas = await db.getAllVentas();
            const dupVentas = allVentas.filter((v: any) => v.clienteId === duplicate.id);
            for (const v of dupVentas) {
              v.clienteId = canonical.id;
              await db.addVenta(v);
              await _sdb.addVenta(v).catch(() => {});
            }

            // 3. Eliminar el cliente duplicado
            await localAdapter.deleteDocument('clientes', duplicate.id).catch(() => {});
            await _sdb.deleteCliente(duplicate.id).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
            detail: { table: 'clientes', eventType: 'MANUAL', id: 'dedup' },
          }));
          window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
            detail: { table: 'creditos_clientes', eventType: 'MANUAL', id: 'dedup' },
          }));
        }
      }
    } catch (err) {
      console.warn('⚠️ [Deduplicate Clients] Error:', err);
    }

    // PURGAR PRODUCTOS BASURA DE SUPABASE Y LOCAL
    try {
      const { data: supaProds } = await supabase.from('productos').select('*');
      if (supaProds && supaProds.length > 0) {
        const garbage = supaProds.filter((p: any) => {
          const name = (p.nombre || '').toLowerCase();
          const unit = (p.unidad || '').toLowerCase();
          const cat = (p.categoria || '').toLowerCase();
          
          return cat === 'electrónica' || cat === 'electronica' ||
                 name.includes('timiden') ||
                 unit.includes('4 x e x z x x') ||
                 name.includes('e n d r n t e l l') ||
                 (name === 'general' && cat === 'general');
        });

        if (garbage.length > 0) {
          console.log(`[Clean Garbage Products] Eliminando ${garbage.length} productos basura de la nube...`);
          const garbageIds = garbage.map((g: any) => g.id);
          // 1. Eliminar precios
          await supabase.from('precios').delete().in('producto_id', garbageIds).catch(() => {});
          // 2. Eliminar inventario
          await supabase.from('inventario').delete().in('producto_id', garbageIds).catch(() => {});
          // 3. Eliminar productos de Supabase
          await supabase.from('productos').delete().in('id', garbageIds).catch(() => {});
          
          // 4. Eliminar localmente y registrar en tombstone
          for (const id of garbageIds) {
            await localAdapter.deleteDocument('productos', id).catch(() => {});
            await db.addTombstone('productos', id).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
            detail: { table: 'productos', eventType: 'MANUAL', id: 'garbage' },
          }));
        }
      }
    } catch (err) {
      console.warn('⚠️ [Clean Garbage Products] Error:', err);
    }

    // Limpiar IDs de syncNow después de 30s — suficiente para que lleguen todos los ecos
    setTimeout(() => syncNowIds.current.clear(), 30_000);
  }, []);

  // Suscripciones Realtime — solo escucha, no hace peticiones en segundo plano
  useEffect(() => {
    const tables = Object.keys(HANDLERS);
    let count = 0;

    channelsRef.current = tables.map(table =>
      supabase
        .channel(`nexus_rt_${table}_v3`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          const record = Object.keys(payload.new ?? {}).length > 0
            ? payload.new : payload.old;
          applyRemoteChange(table, payload.eventType, record);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            count++;
            if (count >= tables.length) setSyncConnected(true);
            console.log(`✅ [NexusSync] Escuchando '${table}'`);
          }
        }),
    );

    // Sincronizar al recuperar conexión de red
    const handleOnline = () => syncNow().catch(() => {});
    window.addEventListener('online', handleOnline);

    // Sync forzado por operaciones masivas (ej: carga 100 uds de inventario)
    const handleForceSync = () => syncNow().catch(() => {});
    window.addEventListener('dp-force-sync', handleForceSync);

    // Sync al volver a la app (celular minimiza/maximiza, cambio de pestaña)
    // Evitar sync si la app estuvo oculta menos de 30s (no vale la pena)
    let hiddenAt = 0;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        const ausencia = Date.now() - hiddenAt;
        if (hiddenAt > 0 && ausencia > 30_000) {
          console.log(`📱 [NexusSync] App volvió a primer plano (${Math.round(ausencia / 1000)}s) — sincronizando...`);
          syncNow().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
      setSyncConnected(false);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('dp-force-sync', handleForceSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [applyRemoteChange, syncNow]);

  const dismiss    = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);
  const dismissAll = useCallback(() => setPendingChanges([]), []);

  return { pendingChanges, dismiss, dismissAll, syncConnected, syncNow };
}
