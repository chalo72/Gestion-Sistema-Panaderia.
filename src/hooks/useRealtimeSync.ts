/**
 * useRealtimeSync — suscripción bidireccional a Supabase Realtime.
 *
 * Cuando CUALQUIER dispositivo escribe un cambio (venta, producto, precio…),
 * Supabase lo retransmite por WebSocket a TODOS los demás. Este hook recibe
 * ese evento, aplica el cambio en IndexedDB local y notifica a la UI para
 * que recargue los datos.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { isSelfWrite } from '@/lib/deviceId';
import { originalDbMethods } from '@/lib/supabase-sync-bridge';
import { db } from '@/lib/database';

const _sdb = new SupabaseDatabase();

// ── Mapa de tabla Supabase → cómo leer y escribir en IndexedDB ───────────────
type Handler = {
  getAll: () => Promise<any[]>;
  writeOne: (item: any) => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
};

function orig(name: string, fallback: (...a: any[]) => Promise<any>) {
  return (...args: any[]) => (originalDbMethods[name] ?? fallback)(...args);
}

const HANDLERS: Record<string, Handler> = {
  productos: {
    getAll:    () => _sdb.getAllProductos(),
    writeOne:  (d) => orig('updateProducto', db.updateProducto.bind(db))(d),
    deleteOne: (id) => orig('deleteProducto', db.deleteProducto.bind(db))(id),
  },
  proveedores: {
    getAll:    () => _sdb.getAllProveedores(),
    writeOne:  (d) => orig('updateProveedor', db.updateProveedor.bind(db))(d),
    deleteOne: (id) => orig('deleteProveedor', db.deleteProveedor.bind(db))(id),
  },
  precios: {
    getAll:    () => _sdb.getAllPrecios(),
    writeOne:  (d) => orig('updatePrecio', db.updatePrecio.bind(db))(d),
    deleteOne: (id) => orig('deletePrecio', db.deletePrecio.bind(db))(id),
  },
  ventas: {
    getAll:    () => _sdb.getAllVentas(),
    writeOne:  (d) => orig('addVenta', db.addVenta.bind(db))(d),
    deleteOne: async () => {},
  },
  caja: {
    getAll:    () => _sdb.getAllSesionesCaja(),
    writeOne:  (d) => orig('updateSesionCaja', db.updateSesionCaja.bind(db))(d),
    deleteOne: async () => {},
  },
  inventario: {
    getAll:    () => _sdb.getAllInventario(),
    writeOne:  (d) => orig('updateInventarioItem', db.updateInventarioItem.bind(db))(d),
    deleteOne: async () => {},
  },
  recepciones: {
    getAll:    () => _sdb.getAllRecepciones(),
    writeOne:  (d) => orig('updateRecepcion', db.updateRecepcion.bind(db))(d),
    deleteOne: (id) => orig('deleteRecepcion', db.deleteRecepcion.bind(db))(id),
  },
  gastos: {
    getAll:    () => _sdb.getAllGastos(),
    writeOne:  (d) => orig('updateGasto', db.updateGasto.bind(db))(d),
    deleteOne: (id) => orig('deleteGasto', db.deleteGasto.bind(db))(id),
  },
  creditos_clientes: {
    getAll:    () => _sdb.getAllCreditosClientes(),
    writeOne:  (d) => orig('updateCreditoCliente', db.updateCreditoCliente.bind(db))(d),
    deleteOne: (id) => orig('deleteCreditoCliente', db.deleteCreditoCliente.bind(db))(id),
  },
  creditos_trabajadores: {
    getAll:    () => _sdb.getAllCreditosTrabajadores(),
    writeOne:  (d) => orig('updateCreditoTrabajador', db.updateCreditoTrabajador.bind(db))(d),
    deleteOne: (id) => orig('deleteCreditoTrabajador', db.deleteCreditoTrabajador.bind(db))(id),
  },
  prepedidos: {
    getAll:    () => _sdb.getAllPrePedidos(),
    writeOne:  (d) => orig('updatePrePedido', db.updatePrePedido.bind(db))(d),
    deleteOne: (id) => orig('deletePrePedido', db.deletePrePedido.bind(db))(id),
  },
  trabajadores: {
    getAll:    () => _sdb.getAllTrabajadores(),
    writeOne:  (d) => orig('updateTrabajador', db.updateTrabajador.bind(db))(d),
    deleteOne: (id) => orig('deleteTrabajador', db.deleteTrabajador.bind(db))(id),
  },
  produccion: {
    getAll:    () => _sdb.getAllOrdenesProduccion(),
    writeOne:  (d) => orig('updateOrdenProduccion', db.updateOrdenProduccion.bind(db))(d),
    deleteOne: async () => {},
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

// ── Hook principal ────────────────────────────────────────────────────────────
export function useRealtimeSync() {
  const [pendingChanges, setPendingChanges] = useState<RemoteSyncEvent[]>([]);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const processingRef = useRef(new Set<string>()); // evita procesamiento doble simultáneo

  const applyRemoteChange = useCallback(async (
    table: string,
    eventType: string,
    record: any,
  ) => {
    const recordId: string | undefined = record?.id;
    if (!recordId) return;

    // Eco: ignorar si ESTE dispositivo escribió el registro hace menos de 8s
    if (isSelfWrite(table, recordId)) return;

    // Procesamiento doble: si ya estamos manejando este evento, saltar
    const key = `${table}:${recordId}:${eventType}`;
    if (processingRef.current.has(key)) return;
    processingRef.current.add(key);

    try {
      const handler = HANDLERS[table];
      if (!handler) return;

      if (eventType === 'DELETE') {
        await handler.deleteOne(recordId);
      } else {
        // Obtener el registro ya mapeado (camelCase) desde Supabase
        const allItems = await handler.getAll();
        const item = allItems.find((i: any) => i.id === recordId);
        if (item) {
          await handler.writeOne(item);
        }
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

      console.log(`📡 [NexusSync] ${table} ${eventType} ${recordId} — aplicado en IndexedDB.`);
    } catch (err) {
      console.error(`❌ [NexusSync] Error al procesar cambio en '${table}':`, err);
    } finally {
      setTimeout(() => processingRef.current.delete(key), 2000);
    }
  }, []);

  useEffect(() => {
    const tables = Object.keys(HANDLERS);

    channelsRef.current = tables.map(table =>
      supabase
        .channel(`nexus_rt_${table}_v1`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            const record = Object.keys(payload.new ?? {}).length > 0
              ? payload.new
              : payload.old;
            applyRemoteChange(table, payload.eventType, record);
          },
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [NexusSync] Escuchando '${table}'`);
          }
        }),
    );

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [applyRemoteChange]);

  const dismiss = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);

  const dismissAll = useCallback(() => setPendingChanges([]), []);

  return { pendingChanges, dismiss, dismissAll };
}
