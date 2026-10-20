/**
 * useRealtimeSync — sincronización entre aparatos (PC ↔ celulares) vía Supabase.
 *
 * 🩹 REESCRITO 2026-10-07 (Claude, a pedido de Gonzalo: "la sincronización se rompió").
 * Base: la versión de git que funcionaba (commit d0feea4c), con estas mejoras:
 *
 *  1. LO QUE LLEGA DE LA NUBE SE GUARDA SOLO EN ESTE APARATO.
 *     Antes se guardaba con db.updateX(), y varios de esos métodos (productos,
 *     proveedores, precios, clientes, gastos, fiados, trabajadores) VUELVEN A SUBIR
 *     el dato a la nube → la nube avisa a todos → cada aparato lo vuelve a subir…
 *     Ese era el "bucle infinito" que gastaba la cuota de Supabase.
 *     Ahora se escribe directo en IndexedDB (localAdapter), sin re-subir.
 *
 *  2. CAJAS Y FIADOS AHORA SÍ LLEGAN AL INSTANTE.
 *     En la nube las cajas viven en la tabla "caja" y los fiados en "creditos",
 *     pero el aviso en vivo escuchaba "sesiones_caja" y "creditos_clientes"
 *     (nombres que no existen allá) → esos cambios solo llegaban cada varios minutos.
 *
 *  3. "EL MÁS NUEVO GANA" EN CAJAS.
 *     La nube guarda la hora de cada cambio de caja (columna actualizado_en, la pone
 *     la propia nube). Ahora se usa: un celular con una caja vieja ya no pisa la caja
 *     que el administrador corrigió en el PC.
 *
 *  4. Al sincronizar solo se SUBE lo que falta en la nube o lo que cambió aquí
 *     (antes se subía casi toda la base de datos cada vez → mucho gasto de cuota).
 *     Un aviso de venta/caja ya no descarga TODA la tabla: usa el dato que trae el aviso.
 *
 *  5. Se quitó la "limpieza de productos basura" automática: ahora la hace el
 *     administrador a mano en Configuración (src/lib/limpieza-productos.ts).
 *
 *  6. Nunca corren dos sincronizaciones a la vez.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { isSelfWrite, registerSelfWrite } from '@/lib/deviceId';
import { supabaseDB, flushSyncOutbox } from '@/lib/supabase-sync-bridge';
import { db, localAdapter } from '@/lib/database';
import { mergeHydrateItem, timestampDeDoc, esCajaRevivida } from '@/lib/sync-merge-local-gana';

const _sdb = new SupabaseDatabase();
// Mapeadores internos de supabase-db (privados en TypeScript, pero son funciones normales).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _map = _sdb as any;

type Handler = {
  /** Nombre de la tabla en Supabase (el que usa el aviso en vivo). */
  remoteTable:     string;
  getFromSupabase: () => Promise<any[]>;
  /** Guarda SOLO en este aparato (nunca re-sube a la nube). */
  writeToLocal:    (item: any) => Promise<void>;
  /** Borra SOLO en este aparato. */
  deleteFromLocal: (id: string) => Promise<void>;
  localTableName:  string;
  // Opcional: mapea el registro que ya viene en el aviso en vivo, sin traer toda la tabla.
  mapFromRecord?:  (record: any) => any;
};

const soloLocal = (tabla: string) => async (d: any) => {
  if (!d?.id) return;
  await localAdapter.setDocument(tabla, d.id, d);
};
const borrarSoloLocal = (tabla: string) => async (id: string) => {
  await localAdapter.deleteDocument(tabla, id).catch(() => {});
};
const noBorrar = async () => {};

/** Filas de la tabla configuracion que se comparten entre aparatos por este hook. */
const RESPALDOS_COMPARTIDOS: readonly string[] = ['formulaciones_data', 'modelosPan_data', 'cajas_config'];

/** ¿El registro trae su propia hora de "último cambio"? (no cuenta la de creación) */
const tieneHoraDeCambio = (d: any) =>
  !!(d?.updatedAt ?? d?.actualizadoEn ?? d?.fechaActualizacion ?? d?.ultimoCambio ?? d?.updated_at);

/** Caja desde la nube + la hora de su último cambio (la pone la nube sola). */
const mapCaja = (r: any) => {
  const c = _map.mapCajaFromDB.call(_sdb, r);
  if (r?.actualizado_en) {
    const ts = new Date(r.actualizado_en).toISOString();
    c.actualizadoEn = ts;
    c.updatedAt = ts; // mismo valor: así este aparato queda "al día" y no la vuelve a bajar
  }
  return c;
};

const HANDLERS: Record<string, Handler> = {
  productos: {
    remoteTable:     'productos',
    localTableName:  'productos',
    getFromSupabase: () => _sdb.getAllProductos(),
    mapFromRecord:   (r) => _sdb.mapProductoFromDB(r),
    writeToLocal:    soloLocal('productos'),
    deleteFromLocal: borrarSoloLocal('productos'),
  },
  proveedores: {
    remoteTable:     'proveedores',
    localTableName:  'proveedores',
    getFromSupabase: () => _sdb.getAllProveedores(),
    writeToLocal:    soloLocal('proveedores'),
    deleteFromLocal: borrarSoloLocal('proveedores'),
  },
  precios: {
    remoteTable:     'precios',
    localTableName:  'precios',
    getFromSupabase: () => _sdb.getAllPrecios(),
    mapFromRecord:   (r) => _sdb.mapPrecioFromDB(r),
    // mergeHydrateItem ya protege costo/empaque local (ver sync-merge-local-gana.ts)
    writeToLocal:    soloLocal('precios'),
    deleteFromLocal: borrarSoloLocal('precios'),
  },
  ventas: {
    remoteTable:     'ventas',
    localTableName:  'ventas',
    getFromSupabase: () => _sdb.getAllVentas(),
    mapFromRecord:   (r) => _map.mapVentaFromDB.call(_sdb, r),
    writeToLocal:    soloLocal('ventas'),
    deleteFromLocal: noBorrar,
  },
  sesiones_caja: {
    remoteTable:     'caja',
    localTableName:  'sesiones_caja',
    getFromSupabase: async () => {
      const { data, error } = await supabase.from('caja').select('*');
      if (error) throw error;
      return (data ?? []).map(mapCaja);
    },
    mapFromRecord:   mapCaja,
    writeToLocal:    soloLocal('sesiones_caja'),
    deleteFromLocal: noBorrar,
  },
  inventario: {
    remoteTable:     'inventario',
    localTableName:  'inventario',
    getFromSupabase: () => _sdb.getAllInventario(),
    writeToLocal:    soloLocal('inventario'),
    deleteFromLocal: noBorrar,
  },
  recepciones: {
    remoteTable:     'recepciones',
    localTableName:  'recepciones',
    getFromSupabase: () => _sdb.getAllRecepciones(),
    writeToLocal:    soloLocal('recepciones'),
    deleteFromLocal: borrarSoloLocal('recepciones'),
  },
  gastos: {
    remoteTable:     'gastos',
    localTableName:  'gastos',
    getFromSupabase: () => _sdb.getAllGastos(),
    writeToLocal:    soloLocal('gastos'),
    deleteFromLocal: borrarSoloLocal('gastos'),
  },
  creditos_clientes: {
    remoteTable:     'creditos',
    localTableName:  'creditos_clientes',
    getFromSupabase: () => _sdb.getAllCreditosClientes(),
    // supabase-db devuelve los fiados tal cual vienen de la tabla
    mapFromRecord:   (r) => ({ ...r }),
    writeToLocal:    soloLocal('creditos_clientes'),
    deleteFromLocal: borrarSoloLocal('creditos_clientes'),
  },
  prepedidos: {
    remoteTable:     'prepedidos',
    localTableName:  'pre_pedidos',
    getFromSupabase: () => _sdb.getAllPrePedidos(),
    writeToLocal:    soloLocal('pre_pedidos'),
    deleteFromLocal: borrarSoloLocal('pre_pedidos'),
  },
  creditos_trabajadores: {
    remoteTable:     'creditos_trabajadores',
    localTableName:  'creditos_trabajadores',
    getFromSupabase: () => _sdb.getAllCreditosTrabajadores(),
    writeToLocal:    soloLocal('creditos_trabajadores'),
    deleteFromLocal: borrarSoloLocal('creditos_trabajadores'),
  },
  trabajadores: {
    remoteTable:     'trabajadores',
    localTableName:  'trabajadores',
    getFromSupabase: () => _sdb.getAllTrabajadores(),
    writeToLocal:    soloLocal('trabajadores'),
    deleteFromLocal: borrarSoloLocal('trabajadores'),
  },
  recetas: {
    remoteTable:     'recetas',
    localTableName:  'recetas',
    getFromSupabase: () => _sdb.getAllRecetas(),
    writeToLocal:    soloLocal('recetas'),
    deleteFromLocal: borrarSoloLocal('recetas'),
  },
  produccion: {
    remoteTable:     'produccion',
    localTableName:  'produccion',
    getFromSupabase: () => _sdb.getAllOrdenesProduccion(),
    mapFromRecord:   (r) => ({ ...r }),
    writeToLocal:    soloLocal('produccion'),
    deleteFromLocal: noBorrar,
  },
  mesas: {
    remoteTable:     'mesas',
    localTableName:  'mesas',
    getFromSupabase: () => _sdb.getAllMesas(),
    writeToLocal:    soloLocal('mesas'),
    deleteFromLocal: borrarSoloLocal('mesas'),
  },
  pedidos_activos: {
    remoteTable:     'pedidos_activos',
    localTableName:  'pedidos_activos',
    getFromSupabase: () => _sdb.getAllPedidosActivos(),
    writeToLocal:    soloLocal('pedidos_activos'),
    deleteFromLocal: borrarSoloLocal('pedidos_activos'),
  },
  clientes: {
    remoteTable:     'clientes',
    localTableName:  'clientes',
    getFromSupabase: () => _sdb.getAllClientes(),
    writeToLocal:    soloLocal('clientes'),
    deleteFromLocal: borrarSoloLocal('clientes'),
  },
  nominas: {
    remoteTable:     'nominas',
    localTableName:  'nominas',
    getFromSupabase: () => _sdb.getAllNominas(),
    writeToLocal:    soloLocal('nominas'),
    deleteFromLocal: noBorrar,
  },
  configuracion: {
    remoteTable:     'configuracion',
    localTableName:  'configuracion',
    // 🩹 2026-10-09: SOLO los 3 respaldos compartidos. Antes se bajaba TODA la tabla
    // configuracion (incluye ~1 MB de grabaciones de Auditoría) en cada sincronización, y
    // cualquier fila desconocida (auditoria_cinta_X, equipo_turno…) se escribía ENCIMA de la
    // configuración principal 'main'. La configuración 'main' se sincroniza aparte (paso 5).
    getFromSupabase: async () => {
      const { data, error } = await supabase
        .from('configuracion')
        .select('id, categorias')
        .in('id', RESPALDOS_COMPARTIDOS as unknown as string[]);
      if (error) throw error;
      return data ?? [];
    },
    writeToLocal:    async (d) => {
      if (!RESPALDOS_COMPARTIDOS.includes(d?.id)) return; // nunca tocar 'main' ni otras filas
      const val = d.categorias;
      const toSave = Array.isArray(val) ? { id: d.id, data: val } : { id: d.id, ...val };
      await localAdapter.setDocument('backups', d.id, toSave).catch(() => {});
      window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
        detail: { table: d.id, eventType: 'UPDATE', id: d.id },
      }));
    },
    deleteFromLocal: noBorrar,
  },
  checklist_completadas: {
    remoteTable:     'checklist_completadas',
    localTableName:  'checklist_completadas',
    getFromSupabase: () => _sdb.getAllChecklistCompletadas(),
    writeToLocal:    soloLocal('checklist_completadas'),
    deleteFromLocal: borrarSoloLocal('checklist_completadas'),
  },
  asistencias: {
    remoteTable:     'asistencias',
    localTableName:  'asistencia',
    getFromSupabase: () => _sdb.getAllAsistencias(),
    writeToLocal:    soloLocal('asistencia'),
    deleteFromLocal: noBorrar,
  },
};

/** Nombre de tabla en la nube → clave de HANDLERS. */
const REMOTE_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(HANDLERS).map(([key, h]) => [h.remoteTable, key]),
);

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
  nominas:                'Nóminas',
  configuracion:          'Configuración',
  checklist_completadas:  'Checklist de Tareas',
  asistencias:            'Asistencia',
};

export interface RemoteSyncEvent {
  table: string;
  label: string;
  eventType: string;
  id: string;
  timestamp: number;
}

/** ¿Los campos que trae la nube son distintos a los de este aparato? */
function difiere(local: any, remoto: any): boolean {
  for (const k of Object.keys(remoto ?? {})) {
    if (k === 'updatedAt' || k === 'actualizadoEn' || k === 'updated_at') continue;
    const lv = local?.[k];
    if (lv === undefined) continue;
    const rv = remoto[k];
    const lVacio = lv === null || lv === '';
    const rVacio = rv === null || rv === '' || rv === undefined;
    if (lVacio && rVacio) continue;
    if (typeof lv === 'number' || typeof rv === 'number') {
      if (Number(lv) !== Number(rv)) return true;
      continue;
    }
    if (JSON.stringify(lv) !== JSON.stringify(rv)) return true;
  }
  return false;
}

/**
 * ¿Hay que subir este registro? Solo si falta en la nube, o si cambió y la versión
 * de aquí no es más vieja que la de la nube.
 */
function hayQueSubir(local: any, remoto: any | undefined, table?: string): boolean {
  if (!remoto) return true;
  if (!difiere(local, remoto)) return false; // la nube ya lo tiene igual
  if (table === 'sesiones_caja') {
    if (esCajaRevivida(local, remoto)) return true;  // el cierre de aquí no llegó a la nube
    if (esCajaRevivida(remoto, local)) return false; // no reabrir en la nube una caja ya cerrada
  }
  const lt = timestampDeDoc(local);
  const rt = timestampDeDoc(remoto);
  if (lt > 0 && rt > 0) return lt > rt;
  if (rt > 0 && lt === 0) return false; // la nube tiene hora y aquí no → lo baja el pull
  return true;
}

function leerLocal(table: string): Promise<any[]> {
  switch (table) {
    case 'productos':              return db.getAllProductos();
    case 'proveedores':            return db.getAllProveedores();
    case 'precios':                return db.getAllPrecios();
    case 'ventas':                 return db.getAllVentas();
    case 'sesiones_caja':          return db.getAllSesionesCaja();
    case 'inventario':             return db.getAllInventario();
    case 'recepciones':            return db.getAllRecepciones();
    case 'gastos':                 return db.getAllGastos();
    case 'creditos_clientes':      return db.getAllCreditosClientes();
    case 'prepedidos':             return db.getAllPrePedidos();
    case 'creditos_trabajadores':  return db.getAllCreditosTrabajadores();
    case 'trabajadores':           return db.getAllTrabajadores();
    case 'recetas':                return db.getAllRecetas();
    case 'produccion':             return db.getAllOrdenesProduccion();
    case 'mesas':                  return db.getAllMesas();
    case 'pedidos_activos':        return db.getAllPedidosActivos();
    case 'clientes':               return db.getAllClientes();
    case 'nominas':                return db.getAllNominas();
    case 'checklist_completadas':  return db.getAllChecklistCompletadas();
    case 'asistencias':            return db.getAllAsistencia();
    case 'configuracion':          return Promise.resolve([] as any[]).then(async (list: any[]) => {
      const fData = await db.getBackup('formulaciones_data');
      const mData = await db.getBackup('modelosPan_data');
      const cData = await db.getBackup('cajas_config');
      if (fData) list.push({ id: 'formulaciones_data', categorias: fData });
      if (mData) list.push({ id: 'modelosPan_data', categorias: mData });
      if (cData) list.push({ id: 'cajas_config', categorias: cData });
      return list;
    });
    default:                       return Promise.resolve([]);
  }
}

export function useRealtimeSync() {
  const [pendingChanges, setPendingChanges]   = useState<RemoteSyncEvent[]>([]);
  const [syncConnected, setSyncConnected]     = useState(false);
  const channelsRef      = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const processingRef    = useRef(new Set<string>());
  const syncNowIds       = useRef(new Set<string>());  // IDs subidos en syncNow — bloquea sus ecos
  const syncEnCurso      = useRef<Promise<void> | null>(null);

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
        await handler.deleteFromLocal(recordId);
        await db.addTombstone(handler.localTableName, recordId).catch(() => {});
      } else {
        // Si fue eliminado en este aparato, no revivirlo
        const tombstones = await db.getTombstones(handler.localTableName).catch(() => [] as string[]);
        if (tombstones.includes(recordId)) return;

        let item = handler.mapFromRecord
          ? handler.mapFromRecord(record)
          : (await handler.getFromSupabase()).find((i: any) => i.id === recordId);
        // 🩹 2026-10-09: un aviso en vivo es un cambio que OTRO aparato acaba de hacer
        // (los ecos propios ya se descartaron arriba). Si la tabla de la nube no guarda la
        // hora del cambio (fiados, gastos, inventario…), antes el dato local "ganaba" siempre
        // y el cambio del otro aparato no se veía. Ahora se marca como el más nuevo.
        if (item && !tieneHoraDeCambio(item)) item = { ...item, updatedAt: new Date().toISOString() };
        if (item) {
          const local = await localAdapter
            .getDocument<{ id: string }>(handler.localTableName, recordId)
            .catch(() => null);
          const merged = mergeHydrateItem(handler.localTableName, local ?? undefined, item);
          await handler.writeToLocal(merged);
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

    } catch (err) {
      console.error(`❌ [NexusSync] Error en ${table}:`, err);
    } finally {
      setTimeout(() => processingRef.current.delete(key), 3000);
    }
  }, []);

  const syncNowInterno = useCallback(async () => {
    syncNowIds.current.clear();

    // 1) Vaciar cola de envíos que fallaron antes (sin internet / errores de red)
    try {
      await flushSyncOutbox();
    } catch (e) {
      console.warn('⚠️ [syncNow] Outbox flush falló:', e);
    }

    // 2) Bajar UNA vez lo que hay en la nube (se usa para subir y para bajar)
    const remotos = new Map<string, any[]>();
    await Promise.all(Object.entries(HANDLERS).map(async ([table, h]) => {
      remotos.set(table, await h.getFromSupabase().catch(() => [] as any[]));
    }));

    // 3) SUBIR solo lo que falta en la nube o cambió aquí
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pushTasks: [string, () => Promise<any[]>, (d: any) => Promise<void>][] = [
      ['productos', async () => (await db.getAllProductos()).filter((i: any) => i.id && UUID.test(i.id)),
        (d) => supabaseDB.addProducto(d)],
      ['proveedores', () => db.getAllProveedores(),          (d) => supabaseDB.addProveedor(d)],
      ['precios',     () => db.getAllPrecios(),              (d) => supabaseDB.addPrecio(d)],
      ['ventas',      () => db.getAllVentas(),               (d) => supabaseDB.addVenta(d)],
      ['gastos',      () => db.getAllGastos(),               (d) => supabaseDB.addGasto(d)],
      ['recepciones', () => db.getAllRecepciones(),          (d) => supabaseDB.addRecepcion(d)],
      ['inventario',  async () => {
        const [items, prods] = await Promise.all([db.getAllInventario(), db.getAllProductos()]);
        const validIds = new Set(prods.filter((p: any) => UUID.test(p.id)).map((p: any) => p.id));
        return items.filter((i: any) => i.productoId && UUID.test(i.productoId) && validIds.has(i.productoId));
      }, (d) => supabaseDB.updateInventarioItem(d)],
      ['prepedidos',  () => db.getAllPrePedidos(),           (d) => supabaseDB.addPrePedido(d)],
      ['creditos_clientes',    () => db.getAllCreditosClientes(), (d) => supabaseDB.addCreditoCliente(d)],
      ['sesiones_caja',        () => db.getAllSesionesCaja(),     (d) => supabaseDB.updateSesionCaja(d)],
      ['mesas',       () => db.getAllMesas(),                (d) => supabaseDB.updateMesa(d)],
      ['pedidos_activos', () => db.getAllPedidosActivos(),   (d) => supabaseDB.addPedidoActivo(d)],
      ['trabajadores',    () => db.getAllTrabajadores(),     (d) => supabaseDB.addTrabajador(d)],
      ['creditos_trabajadores', () => db.getAllCreditosTrabajadores(), (d) => supabaseDB.addCreditoTrabajador(d)],
      ['recetas',         () => db.getAllRecetas(),          (d) => supabaseDB.addReceta(d)],
      ['produccion',      () => db.getAllOrdenesProduccion(), (d) => supabaseDB.addOrdenProduccion(d)],
      ['clientes',        () => db.getAllClientes(),         (d) => supabaseDB.addCliente(d)],
      ['nominas',         () => db.getAllNominas(),          (d) => supabaseDB.addNomina(d)],
    ];

    await Promise.all(pushTasks.map(async ([tableName, getLocal, writeSupabase]) => {
      const [itemsLocales, tumbas] = await Promise.all([
        getLocal().catch(() => [] as any[]),
        db.getTombstones(HANDLERS[tableName]?.localTableName ?? tableName).catch(() => [] as string[]),
      ]);
      if (itemsLocales.length === 0) return;
      const tombSet = new Set(tumbas);
      const mapaRemoto = new Map((remotos.get(tableName) ?? []).map((r: any) => [r.id, r]));
      const aSubir = itemsLocales.filter((local: any) =>
        local?.id && !tombSet.has(local.id) && hayQueSubir(local, mapaRemoto.get(local.id), tableName),
      );
      if (aSubir.length === 0) return;

      let okCount = 0; let errCount = 0; let lastErr: any = null;
      await Promise.all(aSubir.map((item: any) => {
        registerSelfWrite(tableName, item.id);
        syncNowIds.current.add(`${tableName}:${item.id}`);
        return writeSupabase(item)
          .then(() => {
            okCount++;
            // La nube ya quedó igual a este aparato → el pull no debe "devolverlo"
            mapaRemoto.set(item.id, item);
          })
          .catch((err: any) => { errCount++; lastErr = err; });
      }));
      remotos.set(tableName, [...mapaRemoto.values()]);
      if (errCount > 0) {
        console.warn(`⚠️ [syncNow] ${tableName}: ${errCount} fallos, ${okCount} OK. Error:`, lastErr?.message ?? lastErr);
      }
    }));

    // Respaldos (formulaciones, modelos de pan, config de cajas): este aparato manda, como
    // antes, pero 🩹 2026-10-09 solo se suben si son distintos a los de la nube.
    {
      const respaldosNube = new Map((remotos.get('configuracion') ?? []).map((r: any) => [r.id, r]));
      for (const backupId of RESPALDOS_COMPARTIDOS) {
        try {
          const val = await db.getBackup(backupId);
          if (!val) continue;
          const enNube = respaldosNube.get(backupId);
          if (enNube && JSON.stringify(enNube.categorias) === JSON.stringify(val)) continue;
          registerSelfWrite('configuracion', backupId);
          await supabaseDB.saveBackup(backupId, val);
          respaldosNube.set(backupId, { id: backupId, categorias: val });
        } catch { /* sigue */ }
      }
      remotos.set('configuracion', [...respaldosNube.values()]);
    }

    // Borrados hechos en este aparato → aplicarlos también en la nube
    try {
      const tumbas: any[] = await localAdapter.getCollection<any>('tombstones').catch(() => [] as any[]);
      // 🩹 2026-10-09: antes se reenviaban TODOS los borrados en cada sincronización
      // (~3.000 peticiones al día). Ahora solo los que la nube todavía no tiene.
      let tumbasNube = new Set<string>();
      try {
        const { data } = await supabase.from('tombstones').select('table, item_id');
        tumbasNube = new Set((data ?? []).map((r: any) => `${r.table}:${r.item_id}`));
      } catch { /* si falla, se reenvían todos como antes */ }
      const sigueEnNube = (t: any) => {
        const key = Object.keys(HANDLERS).find(k => HANDLERS[k].localTableName === t.table);
        const lista = key ? remotos.get(key) : undefined;
        return lista === undefined ? true : lista.some((r: any) => r?.id === t.item_id);
      };
      const pendientes = tumbas.filter((t: any) =>
        t?.item_id && (!tumbasNube.has(`${t.table}:${t.item_id}`) || sigueEnNube(t)));
      await Promise.all(pendientes.map(async (t: any) => {
        if (!tumbasNube.has(`${t.table}:${t.item_id}`)) await supabaseDB.addTombstone(t.table, t.item_id).catch(() => {});
        if (!sigueEnNube(t)) return;
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
      }));
    } catch { /* sigue */ }

    // 4) BAJAR lo nuevo y lo que en la nube es más nuevo (respeta borrados)
    const tumbasConFecha: any[] = await localAdapter.getCollection<any>('tombstones').catch(() => [] as any[]);
    for (const [table, handler] of Object.entries(HANDLERS)) {
      const [supabaseItems, localItems, tombstones] = await Promise.all([
        remotos.has(table)
          ? Promise.resolve(remotos.get(table)!)
          : handler.getFromSupabase().catch(() => [] as any[]),
        leerLocal(table).catch(() => [] as any[]),
        db.getTombstones(handler.localTableName).catch(() => [] as string[]),
      ]);

      const localMap     = new Map(localItems.map((i: any) => [i.id, i]));
      const tombstoneSet = new Set(tombstones);

      const nuevos = supabaseItems.filter((i: any) =>
        i?.id && !localMap.has(i.id) && !tombstoneSet.has(i.id),
      );
      // Ventas no se editan después de creadas
      const actualizados = table === 'ventas'
        ? []
        : supabaseItems.filter((remote: any) => {
            if (!remote?.id || !localMap.has(remote.id) || tombstoneSet.has(remote.id)) return false;
            const localItem = localMap.get(remote.id);
            if (table === 'inventario') {
              return remote.stockActual !== localItem.stockActual
                || remote.stockMinimo  !== localItem.stockMinimo;
            }
            if (!difiere(localItem, remote)) return false;
            if (table === 'sesiones_caja' && esCajaRevivida(remote, localItem)) return true;
            const remoteTs = timestampDeDoc(remote);
            const localTs  = timestampDeDoc(localItem);
            if (remoteTs > 0 && localTs > 0) return remoteTs > localTs;
            if (localTs > 0 && remoteTs === 0) return false;
            return true;
          });

      const writeMerged = async (item: any) => {
        const local = localMap.get(item.id);
        const merged = mergeHydrateItem(handler.localTableName, local ?? undefined, item);
        await handler.writeToLocal(merged);
      };
      for (const item of nuevos) await writeMerged(item).catch(() => {});
      for (const item of actualizados) await writeMerged(item).catch(() => {});

      // Borrado aquí, pero editado DESPUÉS en otro aparato → se restaura
      let restaurados = 0;
      if (tombstoneSet.size > 0) {
        const fechaTumba = new Map(
          tumbasConFecha
            .filter((t: any) => t.table === handler.localTableName)
            .map((t: any) => [t.item_id, new Date(t.fecha ?? 0).getTime()]),
        );
        for (const remote of supabaseItems) {
          if (!remote?.id || !tombstoneSet.has(remote.id)) continue;
          const remoteTs = timestampDeDoc(remote);
          if (remoteTs > 0 && remoteTs > (fechaTumba.get(remote.id) ?? 0)) {
            await handler.writeToLocal(remote).catch(() => {});
            await db.removeTombstone(handler.localTableName, remote.id).catch(() => {});
            restaurados++;
          }
        }
      }

      if (nuevos.length > 0 || actualizados.length > 0 || restaurados > 0) {
        setPendingChanges(prev => {
          const sin = prev.filter(e => e.table !== table);
          return [...sin, {
            table, label: TABLE_LABELS[table] ?? table,
            eventType: 'MANUAL', id: 'manual', timestamp: Date.now(),
          }];
        });
        window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
          detail: { table, eventType: 'MANUAL', id: 'manual' },
        }));
      }
    }

    // 5) Configuración del negocio: gana la más nueva (doc único)
    try {
      const [configRemota, configLocal] = await Promise.all([
        _sdb.getConfiguracion().catch(() => null as any),
        db.getConfiguracion().catch(() => null as any),
      ]);
      if (configRemota) {
        const remoteTs = timestampDeDoc(configRemota);
        const localTs  = timestampDeDoc(configLocal);
        if (!configLocal || remoteTs > localTs) {
          const merged = mergeHydrateItem('configuracion', configLocal ?? undefined, { ...configRemota, id: 'main' });
          await localAdapter.setDocument('configuracion', 'main', { ...merged, id: 'main' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
            detail: { table: 'configuracion', eventType: 'MANUAL', id: 'main' },
          }));
        } else if (localTs > remoteTs) {
          registerSelfWrite('configuracion', 'main');
          await _sdb.saveConfiguracion({ ...configLocal, id: 'main' }).catch(() => {});
        }
      } else if (configLocal) {
        registerSelfWrite('configuracion', 'main');
        await _sdb.saveConfiguracion({ ...configLocal, id: 'main' }).catch(() => {});
      }
    } catch (e) {
      console.warn('⚠️ [syncNow] configuracion: error en sync', e);
    }

    // 6) Unir clientes duplicados (ej: "Lucho Alita" repetido) — igual que antes
    try {
      const allClients: any[] = await db.getAllClientes();
      const clientMap = new Map<string, any[]>();
      for (const c of allClients) {
        if (!c.nombre) continue;
        const norm = c.nombre.toLowerCase().trim();
        if (!clientMap.has(norm)) clientMap.set(norm, []);
        clientMap.get(norm)!.push(c);
      }

      for (const [, list] of clientMap.entries()) {
        if (list.length > 1) {
          const allCredits: any[] = await db.getAllCreditosClientes();
          const canonical = list.reduce((best, cur) => {
            const bestCredits = allCredits.filter((c: any) => c.clienteId === best.id).length;
            const curCredits = allCredits.filter((c: any) => c.clienteId === cur.id).length;
            if (curCredits > bestCredits) return cur;
            return best;
          }, list[0]);

          for (const duplicate of list) {
            if (duplicate.id === canonical.id) continue;
            const dupCredits = allCredits.filter((c: any) => c.clienteId === duplicate.id);
            for (const cred of dupCredits) {
              cred.clienteId = canonical.id;
              await localAdapter.setDocument('creditos_clientes', cred.id, cred);
              await _sdb.addCreditoCliente(cred).catch(() => {});
            }
            const allVentas: any[] = await db.getAllVentas();
            const dupVentas = allVentas.filter((v: any) => v.clienteId === duplicate.id);
            for (const v of dupVentas) {
              v.clienteId = canonical.id;
              await localAdapter.setDocument('ventas', v.id, v);
              await _sdb.addVenta(v).catch(() => {});
            }
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

    // Limpiar IDs de syncNow después de 30s — suficiente para que lleguen todos los ecos
    setTimeout(() => syncNowIds.current.clear(), 30_000);
  }, []);

  /** Nunca dos sincronizaciones a la vez (antes se podían encimar). */
  const syncNow = useCallback(async (): Promise<void> => {
    if (syncEnCurso.current) return syncEnCurso.current;
    const p = syncNowInterno().finally(() => { syncEnCurso.current = null; });
    syncEnCurso.current = p;
    return p;
  }, [syncNowInterno]);

  // Freno a la sincronización AUTOMÁTICA (volver a la app / volver el internet):
  // máximo una vez cada 3 minutos. La manual (botón) y 'dp-force-sync' corren siempre.
  const lastAutoSyncAt = useRef(0);
  const AUTO_SYNC_COOLDOWN_MS = 3 * 60 * 1000;
  const syncNowAutoThrottled = useCallback(() => {
    const ahora = Date.now();
    if (ahora - lastAutoSyncAt.current < AUTO_SYNC_COOLDOWN_MS) return Promise.resolve();
    lastAutoSyncAt.current = ahora;
    return syncNow();
  }, [syncNow]);

  // Avisos en vivo — UN solo canal que escucha todas las tablas
  useEffect(() => {
    let canal = supabase.channel('nexus_rt_todas_v5');
    for (const h of Object.values(HANDLERS)) {
      canal = canal.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: h.remoteTable },
        (payload: any) => {
          const key = REMOTE_TO_KEY[payload?.table] ?? REMOTE_TO_KEY[h.remoteTable];
          const record = Object.keys(payload?.new ?? {}).length > 0 ? payload.new : payload?.old;
          if (key) applyRemoteChange(key, payload.eventType, record);
        },
      );
    }
    canal.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') setSyncConnected(true);
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncConnected(false);
    });
    channelsRef.current = [canal];

    // (La sincronización al abrir la app la hace CentinelaProvider cuando el canal conecta.)

    const handleOnline = () => syncNowAutoThrottled().catch(() => {});
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => syncNow().catch(() => {});
    window.addEventListener('dp-force-sync', handleForceSync);

    // Al volver a la app (celular minimiza/maximiza) si estuvo fuera más de 30 s
    let hiddenAt = 0;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        const ausencia = Date.now() - hiddenAt;
        if (hiddenAt > 0 && ausencia > 30_000) {
          syncNowAutoThrottled().catch(() => {});
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
  }, [applyRemoteChange, syncNow, syncNowAutoThrottled]);

  const dismiss    = useCallback((table: string) => {
    setPendingChanges(prev => prev.filter(e => e.table !== table));
  }, []);
  const dismissAll = useCallback(() => setPendingChanges([]), []);

  return { pendingChanges, dismiss, dismissAll, syncConnected, syncNow };
}
