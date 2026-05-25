/**
 * useRealtimeSync — sincronización bidireccional por dos canales en paralelo:
 *
 *  Canal 1 — Supabase Realtime (WebSocket): cuando Realtime está habilitado,
 *            el cambio llega en < 2 segundos.
 *
 *  Canal 2 — Polling (fallback garantizado): cada POLL_INTERVAL segundos compara
 *            los IDs de Supabase con los de IndexedDB. Si hay registros en Supabase
 *            que no están en local, los descarga y muestra el banner.
 *
 *  La sincronización funciona aunque Realtime no esté habilitado en Supabase.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { isSelfWrite } from '@/lib/deviceId';
import { originalDbMethods } from '@/lib/supabase-sync-bridge';
import { db } from '@/lib/database';

const _sdb = new SupabaseDatabase();

const POLL_INTERVAL_MS  = 20_000;  // Recibe: revisar Supabase cada 20s
const PUSH_INTERVAL_MS  = 45_000;  // Envía: volcar local→Supabase cada 45s

// ── Mapa de tabla Supabase → cómo leer/escribir en IndexedDB ─────────────────
type Handler = {
  getFromSupabase: () => Promise<any[]>;
  getFromLocal:    () => Promise<any[]>;
  writeToLocal:    (item: any) => Promise<void>;
  deleteFromLocal: (id: string) => Promise<void>;
};

function orig(name: string, fallback: (...a: any[]) => Promise<any>) {
  return (...args: any[]) => (originalDbMethods[name] ?? fallback)(...args);
}

const HANDLERS: Record<string, Handler> = {
  productos: {
    getFromSupabase: () => _sdb.getAllProductos(),
    getFromLocal:    () => db.getAllProductos(),
    writeToLocal:    (d) => orig('updateProducto', db.updateProducto.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteProducto', db.deleteProducto.bind(db))(id),
  },
  proveedores: {
    getFromSupabase: () => _sdb.getAllProveedores(),
    getFromLocal:    () => db.getAllProveedores(),
    writeToLocal:    (d) => orig('updateProveedor', db.updateProveedor.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteProveedor', db.deleteProveedor.bind(db))(id),
  },
  precios: {
    getFromSupabase: () => _sdb.getAllPrecios(),
    getFromLocal:    () => db.getAllPrecios(),
    writeToLocal:    (d) => orig('updatePrecio', db.updatePrecio.bind(db))(d),
    deleteFromLocal: (id) => orig('deletePrecio', db.deletePrecio.bind(db))(id),
  },
  ventas: {
    getFromSupabase: () => _sdb.getAllVentas(),
    getFromLocal:    () => db.getAllVentas(),
    writeToLocal:    (d) => orig('addVenta', db.addVenta.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  caja: {
    getFromSupabase: () => _sdb.getAllSesionesCaja(),
    getFromLocal:    () => db.getAllSesionesCaja(),
    writeToLocal:    (d) => orig('updateSesionCaja', db.updateSesionCaja.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  inventario: {
    getFromSupabase: () => _sdb.getAllInventario(),
    getFromLocal:    () => db.getAllInventario(),
    writeToLocal:    (d) => orig('updateInventarioItem', db.updateInventarioItem.bind(db))(d),
    deleteFromLocal: async () => {},
  },
  recepciones: {
    getFromSupabase: () => _sdb.getAllRecepciones(),
    getFromLocal:    () => db.getAllRecepciones(),
    writeToLocal:    (d) => orig('updateRecepcion', db.updateRecepcion.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteRecepcion', db.deleteRecepcion.bind(db))(id),
  },
  gastos: {
    getFromSupabase: () => _sdb.getAllGastos(),
    getFromLocal:    () => db.getAllGastos(),
    writeToLocal:    (d) => orig('updateGasto', db.updateGasto.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteGasto', db.deleteGasto.bind(db))(id),
  },
  creditos_clientes: {
    getFromSupabase: () => _sdb.getAllCreditosClientes(),
    getFromLocal:    () => db.getAllCreditosClientes(),
    writeToLocal:    (d) => orig('updateCreditoCliente', db.updateCreditoCliente.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteCreditoCliente', db.deleteCreditoCliente.bind(db))(id),
  },
  prepedidos: {
    getFromSupabase: () => _sdb.getAllPrePedidos(),
    getFromLocal:    () => db.getAllPrePedidos(),
    writeToLocal:    (d) => orig('updatePrePedido', db.updatePrePedido.bind(db))(d),
    deleteFromLocal: (id) => orig('deletePrePedido', db.deletePrePedido.bind(db))(id),
  },
  trabajadores: {
    getFromSupabase: () => _sdb.getAllTrabajadores(),
    getFromLocal:    () => db.getAllTrabajadores(),
    writeToLocal:    (d) => orig('updateTrabajador', db.updateTrabajador.bind(db))(d),
    deleteFromLocal: (id) => orig('deleteTrabajador', db.deleteTrabajador.bind(db))(id),
  },
  produccion: {
    getFromSupabase: () => _sdb.getAllOrdenesProduccion(),
    getFromLocal:    () => db.getAllOrdenesProduccion(),
    writeToLocal:    (d) => orig('updateOrdenProduccion', db.updateOrdenProduccion.bind(db))(d),
    deleteFromLocal: async () => {},
  },
};

export const TABLE_LABELS: Record<string, string> = {
  productos:             'Productos',
  proveedores:           'Proveedores',
  precios:               'Precios',
  ventas:                'Ventas',
  caja:                  'Caja',
  inventario:            'Inventario',
  recepciones:           'Recepciones',
  gastos:                'Gastos',
  creditos_clientes:     'Créditos clientes',
  creditos_trabajadores: 'Créditos empleados',
  prepedidos:            'Pre-pedidos',
  trabajadores:          'Empleados',
  produccion:            'Producción',
};

export interface RemoteSyncEvent {
  table: string;
  label: string;
  eventType: string;
  id: string;
  timestamp: number;
}

// Mapa de nombre Supabase → nombre local (para tombstones)
const SUPABASE_TO_LOCAL: Record<string, string> = {
  productos: 'productos', proveedores: 'proveedores', precios: 'precios',
  ventas: 'ventas', caja: 'sesiones_caja', inventario: 'inventario',
  recepciones: 'recepciones', gastos: 'gastos',
  creditos_clientes: 'creditos_clientes', prepedidos: 'pre_pedidos',
  trabajadores: 'trabajadores', produccion: 'produccion',
};

// ── Canal 2: polling diff — compara IDs Supabase vs IndexedDB ────────────────
async function pollTableForNewData(
  table: string,
  handler: Handler,
): Promise<string[]> {
  const localTableName = SUPABASE_TO_LOCAL[table] ?? table;

  const [supabaseItems, localItems, tombstoneIds] = await Promise.all([
    handler.getFromSupabase().catch(() => [] as any[]),
    handler.getFromLocal().catch(() => [] as any[]),
    db.getTombstones(localTableName).catch(() => [] as string[]),
  ]);

  const localIds     = new Set(localItems.map((i: any) => i.id));
  const tombstoneSet = new Set(tombstoneIds);

  // Solo agregar registros que:
  // 1. No existen en local (genuinamente nuevos de otro dispositivo)
  // 2. NO fueron eliminados localmente (no están en tombstones)
  // 3. No son eco de este dispositivo
  const newItems = supabaseItems.filter((i: any) =>
    i.id &&
    !localIds.has(i.id) &&
    !tombstoneSet.has(i.id) &&
    !isSelfWrite(table, i.id),
  );

  for (const item of newItems) {
    await handler.writeToLocal(item).catch(() => {});
  }

  return newItems.map((i: any) => i.id);
}

// ── Canal PUSH: volcar local→Supabase para que otros puedan leer ─────────────
async function pushLocalToSupabase(): Promise<number> {
  const { applySyncPatch: _, ...bridge } = await import('@/lib/supabase-sync-bridge');
  const sdb = bridge.supabaseDB;
  let total = 0;

  const PUSH_MAP: [() => Promise<any[]>, (d: any) => Promise<void>][] = [
    [() => db.getAllProductos(),   (d) => sdb.addProducto(d)],
    [() => db.getAllProveedores(), (d) => sdb.addProveedor(d)],
    [() => db.getAllPrecios(),     (d) => sdb.addPrecio(d)],
    [() => db.getAllVentas(),      (d) => sdb.addVenta(d)],
    [() => db.getAllGastos(),      (d) => sdb.addGasto(d)],
    [() => db.getAllRecepciones(), (d) => sdb.addRecepcion(d)],
  ];

  for (const [getLocal, writeSupabase] of PUSH_MAP) {
    try {
      const items = await getLocal();
      await Promise.all(items.map(item => writeSupabase(item).catch(() => {})));
      total += items.length;
    } catch { /**/ }
  }

  return total;
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useRealtimeSync() {
  const [pendingChanges, setPendingChanges] = useState<RemoteSyncEvent[]>([]);
  const [syncConnected, setSyncConnected] = useState(false);
  const channelsRef   = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const processingRef = useRef(new Set<string>());
  const isPollRunning = useRef(false);
  const isPushRunning = useRef(false);

  // ── Aplica un cambio remoto en IndexedDB ──────────────────────────────────
  const applyRemoteChange = useCallback(async (
    table: string,
    eventType: string,
    record: any,
  ) => {
    const recordId: string | undefined = record?.id;
    if (!recordId) return;
    if (isSelfWrite(table, recordId)) return;

    const key = `${table}:${recordId}:${eventType}`;
    if (processingRef.current.has(key)) return;
    processingRef.current.add(key);

    try {
      const handler = HANDLERS[table];
      if (!handler) return;

      if (eventType === 'DELETE') {
        await handler.deleteFromLocal(recordId);
      } else {
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
    } catch (err) {
      console.error(`❌ [NexusSync] Error al procesar ${table}:`, err);
    } finally {
      setTimeout(() => processingRef.current.delete(key), 3000);
    }
  }, []);

  // ── Canal 1: Supabase Realtime (WebSocket) ────────────────────────────────
  useEffect(() => {
    const tables = Object.keys(HANDLERS);
    let connectedCount = 0;

    channelsRef.current = tables.map(table =>
      supabase
        .channel(`nexus_rt_${table}_v2`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          const record = Object.keys(payload.new ?? {}).length > 0
            ? payload.new : payload.old;
          applyRemoteChange(table, payload.eventType, record);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            connectedCount++;
            if (connectedCount >= tables.length) setSyncConnected(true);
          }
        }),
    );

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
      setSyncConnected(false);
    };
  }, [applyRemoteChange]);

  // ── Canal 2: Polling (pull) — funciona aunque Realtime no esté habilitado ─
  useEffect(() => {
    const poll = async () => {
      if (isPollRunning.current) return;
      isPollRunning.current = true;

      let changedTables: string[] = [];
      for (const [table, handler] of Object.entries(HANDLERS)) {
        try {
          const newIds = await pollTableForNewData(table, handler);
          if (newIds.length > 0) changedTables.push(table);
        } catch { /**/ }
      }

      if (changedTables.length > 0) {
        setPendingChanges(prev => {
          const new_ = changedTables
            .filter(t => !prev.some(e => e.table === t))
            .map(t => ({
              table: t,
              label: TABLE_LABELS[t] ?? t,
              eventType: 'POLL',
              id: 'poll',
              timestamp: Date.now(),
            }));
          return [...prev, ...new_];
        });
        window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
          detail: { tables: changedTables },
        }));
        console.log(`📡 [NexusSync] Poll: datos nuevos en [${changedTables.join(', ')}]`);
      }

      isPollRunning.current = false;
    };

    // Primera verificación al montar (5s después para no bloquear la carga)
    const initial = setTimeout(poll, 5000);
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  // ── Canal PUSH: volcar local→Supabase periódicamente ────────────────────
  useEffect(() => {
    const push = async () => {
      if (isPushRunning.current) return;
      isPushRunning.current = true;
      try {
        const n = await pushLocalToSupabase();
        console.log(`📤 [NexusSync] Push: ${n} registros enviados a Supabase.`);
      } catch { /**/ } finally {
        isPushRunning.current = false;
      }
    };

    // Primer push a los 10s de montar (para que el bridge esté listo)
    const initial = setTimeout(push, 10_000);
    const interval = setInterval(push, PUSH_INTERVAL_MS);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  const dismiss = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);

  const dismissAll = useCallback(() => setPendingChanges([]), []);

  // Sincronización manual forzada
  const syncNow = useCallback(async () => {
    isPushRunning.current = false;
    isPollRunning.current = false;
    await pushLocalToSupabase().catch(() => {});
    for (const [table, handler] of Object.entries(HANDLERS)) {
      const newIds = await pollTableForNewData(table, handler).catch(() => [] as string[]);
      if (newIds.length > 0) {
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

  return { pendingChanges, dismiss, dismissAll, syncConnected, syncNow };
}
