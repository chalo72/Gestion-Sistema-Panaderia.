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
import { isSelfWrite } from '@/lib/deviceId';
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
  creditos_clientes: 'Créditos',
  prepedidos:        'Pre-pedidos',
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
  const channelsRef   = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const processingRef = useRef(new Set<string>());

  const applyRemoteChange = useCallback(async (
    table: string,
    eventType: string,
    record: any,
  ) => {
    const recordId: string | undefined = record?.id;
    if (!recordId) return;

    // Ignorar eco: este dispositivo escribió este registro hace < 8s
    if (isSelfWrite(table, recordId)) return;

    const key = `${table}:${recordId}:${eventType}`;
    if (processingRef.current.has(key)) return;
    processingRef.current.add(key);

    try {
      const handler = HANDLERS[table];
      if (!handler) return;

      if (eventType === 'DELETE') {
        // Verificar tombstone para no borrar lo que no debemos
        const tombstones = await db.getTombstones(handler.localTableName).catch(() => [] as string[]);
        if (!tombstones.includes(recordId)) {
          await handler.deleteFromLocal(recordId);
        }
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

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
      setSyncConnected(false);
    };
  }, [applyRemoteChange]);

  // Sincronización manual — solo cuando el usuario lo pide
  const syncNow = useCallback(async () => {
    const { supabaseDB } = await import('@/lib/supabase-sync-bridge');

    // Push: sube datos locales clave a Supabase
    const pushTasks: [() => Promise<any[]>, (d: any) => Promise<void>][] = [
      [() => db.getAllProductos(),   (d) => supabaseDB.addProducto(d)],
      [() => db.getAllProveedores(), (d) => supabaseDB.addProveedor(d)],
      [() => db.getAllPrecios(),     (d) => supabaseDB.addPrecio(d)],
      [() => db.getAllVentas(),      (d) => supabaseDB.addVenta(d)],
      [() => db.getAllGastos(),      (d) => supabaseDB.addGasto(d)],
    ];
    for (const [getLocal, writeSupabase] of pushTasks) {
      const items = await getLocal().catch(() => []);
      await Promise.all(items.map((item: any) => writeSupabase(item).catch(() => {})));
    }

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
            case 'creditos_clientes': return db.getAllCreditosClientes();
            case 'prepedidos':        return db.getAllPrePedidos();
            default:                  return [];
          }
        })(),
        db.getTombstones(handler.localTableName).catch(() => [] as string[]),
      ]);

      const localIds     = new Set(localItems.map((i: any) => i.id));
      const tombstoneSet = new Set(tombstones);

      const nuevos = supabaseItems.filter((i: any) =>
        i.id && !localIds.has(i.id) && !tombstoneSet.has(i.id),
      );

      for (const item of nuevos) {
        await handler.writeToLocal(item).catch(() => {});
      }

      if (nuevos.length > 0) {
        setPendingChanges(prev => {
          const sin = prev.filter(e => e.table !== table);
          return [...sin, {
            table, label: TABLE_LABELS[table] ?? table,
            eventType: 'MANUAL', id: 'manual', timestamp: Date.now(),
          }];
        });
      }
    }
  }, []);

  const dismiss    = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);
  const dismissAll = useCallback(() => setPendingChanges([]), []);

  return { pendingChanges, dismiss, dismissAll, syncConnected, syncNow };
}
