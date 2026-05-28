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
import { originalDbMethods } from '@/lib/supabase-sync-bridge';
import { db } from '@/lib/database';

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
    deleteFromLocal: (id) => orig('deleteProducto', db.deleteProducto.bind(db))(id),
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
  caja: {
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
  creditos: {
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
};

export const TABLE_LABELS: Record<string, string> = {
  productos:         'Productos',
  proveedores:       'Proveedores',
  precios:           'Precios',
  ventas:            'Ventas',
  caja:              'Caja',
  inventario:        'Inventario',
  recepciones:       'Recepciones',
  gastos:            'Gastos',
  creditos:               'Créditos',
  prepedidos:             'Pre-pedidos',
  creditos_trabajadores:  'Créd. Trabajadores',
  trabajadores:           'Trabajadores',
  recetas:                'Recetas',
  produccion:             'Producción',
  mesas:                  'Mesas',
  pedidos_activos:        'Pedidos Activos',
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
    const { supabaseDB } = await import('@/lib/supabase-sync-bridge');

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
      ['creditos',    () => db.getAllCreditosClientes(), (d) => supabaseDB.addCreditoCliente(d)],
      ['caja',        () => db.getAllSesionesCaja(),     (d) => supabaseDB.updateSesionCaja(d)],
      ['mesas',       () => db.getAllMesas(),             (d) => supabaseDB.updateMesa(d)],
      ['pedidos_activos', () => db.getAllPedidosActivos(), (d) => supabaseDB.addPedidoActivo(d)],
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
            case 'caja':              return db.getAllSesionesCaja();
            case 'inventario':        return db.getAllInventario();
            case 'recepciones':       return db.getAllRecepciones();
            case 'gastos':            return db.getAllGastos();
            case 'creditos':               return db.getAllCreditosClientes();
            case 'prepedidos':             return db.getAllPrePedidos();
            case 'creditos_trabajadores':  return db.getAllCreditosTrabajadores();
            case 'trabajadores':           return db.getAllTrabajadores();
            case 'recetas':                return db.getAllRecetas();
            case 'produccion':             return db.getAllOrdenesProduccion();
            case 'mesas':                  return db.getAllMesas();
            case 'pedidos_activos':        return db.getAllPedidosActivos();
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
      // (solo para tablas con updatedAt — productos, proveedores, precios)
      const actualizados = (['productos', 'proveedores', 'precios'].includes(table))
        ? supabaseItems.filter((remote: any) => {
            if (!remote.id || !localIds.has(remote.id) || tombstoneSet.has(remote.id)) return false;
            const localTs  = new Date(localTsMap.get(remote.id) ?? 0).getTime();
            const remoteTs = new Date(remote.updatedAt ?? remote.createdAt ?? 0).getTime();
            return remoteTs > localTs; // Supabase más nuevo → actualizar local
          })
        : [];
      // Items tombstoneados localmente pero que Supabase tiene vivos → restaurar
      // SOLO proveedores: el caso "la 36 eliminada por error" justifica la restauración.
      // Productos y precios NO se restauran: si el usuario los eliminó, la intención debe respetarse.
      const restaurar = (table === 'proveedores')
        ? supabaseItems.filter((i: any) => i.id && tombstoneSet.has(i.id))
        : [];

      for (const item of nuevos)        await handler.writeToLocal(item).catch(() => {});
      for (const item of actualizados)  await handler.writeToLocal(item).catch(() => {});
      for (const item of restaurar) {
        await db.removeTombstone(handler.localTableName, item.id).catch(() => {});
        await handler.writeToLocal(item).catch(() => {});
      }

      const hayNuevos = nuevos.length > 0 || actualizados.length > 0;
      if (hayNuevos) {
        setPendingChanges(prev => {
          const sin = prev.filter(e => e.table !== table);
          return [...sin, {
            table, label: TABLE_LABELS[table] ?? table,
            eventType: 'MANUAL', id: 'manual', timestamp: Date.now(),
          }];
        });
      }
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

    // Fix 1: sincronizar al recuperar conexión
    const handleOnline = () => syncNow().catch(() => {});
    window.addEventListener('online', handleOnline);

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
      setSyncConnected(false);
      window.removeEventListener('online', handleOnline);
    };
  }, [applyRemoteChange, syncNow]);

  const dismiss    = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);
  const dismissAll = useCallback(() => setPendingChanges([]), []);

  return { pendingChanges, dismiss, dismissAll, syncConnected, syncNow };
}
