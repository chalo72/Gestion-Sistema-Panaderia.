import { generateUUID } from '@/lib/safe-utils';
import type { DatabaseAdapter } from './dbAdapter';
import { FirebaseAdapter } from './firebaseAdapter';
import { IndexedDBAdapter } from './indexedDBAdapter';
import { SupabaseDatabase } from './supabase-db';
import { RESCUE_DATA } from './rescue';

// Definición de la interfaz IDatabase que la app espera
export interface IDatabase {
  init(): Promise<void>;

  // Productos
  getAllProductos(): Promise<any[]>;
  addProducto(producto: any): Promise<void>;
  updateProducto(producto: any): Promise<void>;
  deleteProducto(id: string): Promise<void>;

  // Proveedores
  getAllProveedores(): Promise<any[]>;
  addProveedor(proveedor: any): Promise<void>;
  updateProveedor(proveedor: any): Promise<void>;
  deleteProveedor(id: string): Promise<void>;

  // Precios
  getAllPrecios(): Promise<any[]>;
  getPrecioByProductoProveedor(productoId: string, proveedorId: string): Promise<any>;
  addPrecio(precio: any): Promise<void>;
  updatePrecio(precio: any): Promise<void>;
  deletePrecio(id: string): Promise<void>;

  // Lápidas (Tombstones)
  getTombstones(table: string): Promise<string[]>;
  addTombstone(table: string, id: string): Promise<void>;
  removeTombstone(table: string, id: string): Promise<void>;

  // Configuración
  getConfiguracion(): Promise<any>;
  saveConfiguracion(config: any): Promise<void>;

  // Sincronización
  syncCloudToLocal(): Promise<void>;
  syncLocalToCloud(): Promise<void>;
  clearAll(): Promise<void>;
  rescueFromSupabase(): Promise<void>;
  exportDatabaseToJson(): Promise<void>;
  importDatabaseFromJson(jsonData: any): Promise<void>;

  // Métodos Delegados
  getAllVentas(): Promise<any[]>;
  addVenta(v: any): Promise<void>;
  getAllSesionesCaja(): Promise<any[]>;
  getSesionCajaActiva(): Promise<any | null>;
  addSesionCaja(s: any): Promise<void>;
  updateSesionCaja(s: any): Promise<void>;
  
  getAllRecetas(): Promise<any[]>;
  addReceta(r: any): Promise<void>;
  updateReceta(r: any): Promise<void>;
  deleteReceta(id: string): Promise<void>;

  getAllFormulaciones(): Promise<any[]>;
  addFormulacion(f: any): Promise<void>;
  updateFormulacion(f: any): Promise<void>;
  deleteFormulacion(id: string): Promise<void>;

  getAllModelosPan(): Promise<any[]>;
  addModeloPan(m: any): Promise<void>;
  updateModeloPan(m: any): Promise<void>;
  deleteModeloPan(id: string): Promise<void>;

  getAllOrdenesProduccion(): Promise<any[]>;
  addOrdenProduccion(o: any): Promise<void>;
  updateOrdenProduccion(o: any): Promise<void>;
  batchAjustarStock(ajustes: any[]): Promise<void>;

  getAllInventario(): Promise<any[]>;
  getInventarioItemByProducto(id: string): Promise<any>;
  updateInventarioItem(item: any): Promise<void>;
  getAllMovimientos(): Promise<any[]>;
  addMovimiento(m: any): Promise<void>;
  getAllRecepciones(): Promise<any[]>;
  addRecepcion(r: any): Promise<void>;
  updateRecepcion(r: any): Promise<void>;
  deleteRecepcion(id: string): Promise<void>;

  getAllGastos(): Promise<any[]>;
  addGasto(g: any): Promise<void>;
  updateGasto(g: any): Promise<void>;
  deleteGasto(id: string): Promise<void>;

  getAllCreditosClientes(): Promise<any[]>;
  addCreditoCliente(c: any): Promise<void>;
  updateCreditoCliente(c: any): Promise<void>;
  deleteCreditoCliente(id: string): Promise<void>;

  getAllCreditosTrabajadores(): Promise<any[]>;
  addCreditoTrabajador(c: any): Promise<void>;
  updateCreditoTrabajador(c: any): Promise<void>;
  deleteCreditoTrabajador(id: string): Promise<void>;

  getAllTrabajadores(): Promise<any[]>;
  addTrabajador(t: any): Promise<void>;
  updateTrabajador(t: any): Promise<void>;
  deleteTrabajador(id: string): Promise<void>;

  getAllAlertas(): Promise<any[]>;
  addAlerta(a: any): Promise<void>;
  updateAlerta(a: any): Promise<void>;
  clearAllAlertas(): Promise<void>;

  getAgenteMisiones(agenteId: string): Promise<any[]>;
  getAgenteHallazgos(agenteId: string): Promise<any[]>;
  addAgenteHallazgo(agenteId: string, h: any): Promise<void>;
  
  // Clientes (CRM)
  getAllClientes(): Promise<any[]>;
  addCliente(c: any): Promise<void>;
  updateCliente(c: any): Promise<void>;
  deleteCliente(id: string): Promise<void>;

  getBackup(key: string): Promise<any>;
  saveBackup(key: string, val: any): Promise<void>;

  // Asistencia
  getAllAsistencia(): Promise<any[]>;
  addRegistroAsistencia(r: any): Promise<void>;
  getAsistenciaByFecha(fecha: string): Promise<any[]>;
}

/**
 * 🛰️ NEXUS MULTI-ENGINE ADAPTER
 * Patrón Capitán/Suplente: escribe en ambos motores, lee del local primero.
 */
class MultiAdapter implements DatabaseAdapter {
  constructor(private primary: DatabaseAdapter, private shadow?: DatabaseAdapter) {}

  async init() {
    await this.primary.init();
    if (this.shadow) await this.shadow.init();
  }

  async getCollection<T>(name: string) {
    // Lee siempre del local primero (offline-first)
    const data = await this.primary.getCollection<T>(name);
    if ((!data || data.length === 0) && this.shadow) {
      return this.shadow.getCollection<T>(name);
    }
    return data || [];
  }

  async getDocument<T>(collection: string, id: string) {
    const doc = await this.primary.getDocument<T>(collection, id);
    if (!doc && this.shadow) return this.shadow.getDocument<T>(collection, id);
    return doc;
  }

  async setDocument<T>(collection: string, id: string, data: T) {
    // Escribe en local primero (siempre garantizado)
    await this.primary.setDocument(collection, id, data);
    // Escribe en nube en paralelo (fallo silencioso)
    if (this.shadow) {
      this.shadow.setDocument(collection, id, data).catch(() => {
        console.warn(`⚠️ [NEXUS]: Fallo silencioso al escribir '${collection}/${id}' en nube.`);
      });
    }
  }

  async deleteDocument(collection: string, id: string) {
    await this.primary.deleteDocument(collection, id);
    if (this.shadow) {
      this.shadow.deleteDocument(collection, id).catch(() => {
        console.warn(`⚠️ [NEXUS]: Fallo silencioso al borrar '${collection}/${id}' en nube.`);
      });
    }
  }

  subscribe<T>(collection: string, callback: (data: T[]) => void) {
    if (this.shadow && typeof this.shadow.subscribe === 'function') {
      console.log(`📡 [NEXUS]: Activando Real-time Sync para '${collection}'`);
      return this.shadow.subscribe<T>(collection, async (cloudData) => {
        try {
          // Filtro Anti-Zombies
          const tombstonesData = await this.primary.getCollection<any>('tombstones') || [];
          const deadKeys = new Set(tombstonesData.map(t => `${t.table}:${t.item_id}`));
          const datosVivos = cloudData.filter(d => !deadKeys.has(`${collection}:${(d as any).id}`));

          if (datosVivos.length > 0) {
            await (this.primary as any).hydrateFromCloud(collection, datosVivos);
          }
          callback(datosVivos);
        } catch (e) {
          console.error(`⚠️ [NEXUS]: Error en Real-time Sync para '${collection}'`, e);
          callback(cloudData);
        }
      });
    }
    
    // Si no hay nube, cae al polling local del IndexedDBAdapter
    return this.primary.subscribe(collection, callback);
  }
}

// ─── COLECCIONES QUE SE HIDRATAN DESDE FIREBASE AL ARRANCAR ───
const COLECCIONES_PRINCIPALES = [
  'productos',
  'proveedores',
  'precios',
  'clientes',
  'configuracion',
  'ventas',
  'inventario',
  'movimientos',
  'recepciones',
  'historial',
  'sesiones_caja',
  'pre_pedidos',
  'alertas',
  'gastos',
  'mesas',
  'ahorros',
  'creditos_clientes',
  'creditos_trabajadores',
  'trabajadores',
  'pedidos_activos',
  'recetas',
  'formulaciones',
  'modelosPan',
  'produccion',
  'backups',
  'agente_misiones',
  'agente_hallazgos',
];

/**
 * 🌊 HYDRATE: Sincroniza Firebase → IndexedDB (merge bidireccional).
 * - Siempre descarga datos de la nube.
 * - Filtra tombstones locales para no resucitar eliminaciones.
 * - Hace merge: agrega/actualiza items de la nube sin borrar los locales.
 * - Si force=true, sobrescribe todos los items (reset completo desde nube).
 */
async function hydratarDesdeNube(
  localDB: IndexedDBAdapter,
  nube: FirebaseAdapter,
  colecciones: string[],
  force: boolean = false
): Promise<void> {
  console.log(`🌊 [NEXUS]: Iniciando sincronización Firebase → IndexedDB (Force: ${force})...`);
  for (const col of colecciones) {
    try {
      const localCount = await localDB.count(col);
      // Siempre sincronizar (merge) — no solo cuando está vacío
      console.log(`📡 [NEXUS-DEBUG]: Sincronizando '${col}' (local: ${localCount} items)...`);
      const datosNube = await nube.getCollection<any>(col);
      console.log(`📡 [NEXUS-DEBUG]: Recibidos ${datosNube.length} items de '${col}' de la nube.`);

      if (datosNube.length === 0 && localCount > 0) {
        // La nube está vacía pero tenemos datos locales — no borrar locales
        console.warn(`📡 [NEXUS-DEBUG]: '${col}' vacío en nube, conservando ${localCount} items locales.`);
        continue;
      }

      // 🛡️ Filtro Anti-Zombies: no resucitar items eliminados localmente
      const tombstonesData = await localDB.getCollection<any>('tombstones') || [];
      const deadKeys = new Set(tombstonesData.map((t: any) => `${t.table}:${t.item_id}`));
      const datosVivos = datosNube.filter((d: any) => !deadKeys.has(`${col}:${d.id}`));

      if (datosVivos.length < datosNube.length) {
        console.log(`🛡️ [NEXUS]: Filtrados ${datosNube.length - datosVivos.length} items zombies de '${col}'.`);
      }

      // force=true → Firebase es fuente de verdad: restaurar TODOS los items,
      // incluidos los tombstoneados, y luego limpiar esos tombstones.
      // Esto permite recuperar productos borrados accidentalmente via Firebase.
      const itemsParaHidratar = force ? datosNube : datosVivos;

      if (itemsParaHidratar.length > 0) {
        if (force || localCount === 0) {
          // Reset completo: reemplazar toda la colección local
          await localDB.hydrateFromCloud(col, itemsParaHidratar);
          // Limpiar tombstones de items restaurados desde Firebase
          if (force) {
            for (const item of datosNube) {
              const tombKey = `${col}:${item.id}`;
              if (deadKeys.has(tombKey)) {
                await localDB.deleteDocument('tombstones', tombKey).catch(() => {});
                console.log(`🔓 [NEXUS]: Tombstone limpiado para '${tombKey}' (restaurado por Firebase).`);
              }
            }
          }
        } else {
          // Merge: obtener IDs locales y solo insertar/actualizar lo que vino de la nube
          const localItems = await localDB.getCollection<any>(col);
          const localIds = new Set(localItems.map((i: any) => i.id));
          let nuevos = 0;
          for (const item of datosVivos) {
            if (!localIds.has(item.id)) {
              // Item nuevo en la nube — agregar localmente
              await localDB.setDocument(col, item.id, item);
              nuevos++;
            }
            // Si ya existe localmente, se respeta la versión local (offline-first)
          }
          if (nuevos > 0) {
            console.log(`🔄 [NEXUS]: Merge '${col}': ${nuevos} items nuevos desde la nube.`);
          } else {
            console.log(`✅ [NEXUS]: '${col}' sincronizado — sin cambios nuevos.`);
          }
        }
      } else {
        console.warn(`📡 [NEXUS-DEBUG]: '${col}' — todos los items de la nube son zombies o está vacío.`);
      }
    } catch (e) {
      console.warn(`⚠️ [NEXUS]: No se pudo sincronizar '${col}'.`, e);
    }
  }
  console.log('✅ [NEXUS]: Sincronización completada.');
}

/**
 * 🏢 NEXUS DATABASE WRAPPER
 * La app solo conoce esta interfaz. El motor real es transparente.
 */
class NexusDatabase implements IDatabase {
  constructor(private adapter: DatabaseAdapter) {}

  private async _delete(collection: string, id: string) {
    if (firebaseAdapter) {
      firebaseAdapter.deleteDocument(collection, id).catch(() => {});
    }
    // Propagar a Supabase para que la eliminación no vuelva en el próximo sync
    try {
      const supaDB = new SupabaseDatabase();
      if (collection === 'productos')        supaDB.deleteProducto(id).catch(() => {});
      else if (collection === 'proveedores') supaDB.deleteProveedor(id).catch(() => {});
      else if (collection === 'precios')     supaDB.deletePrecio(id).catch(() => {});
    } catch (_) {}
    if (collection !== 'tombstones') {
      await this.addTombstone(collection, id).catch(() => {});
    }
    return this.adapter.deleteDocument(collection, id);
  }

  async init() { await this.adapter.init(); }

  // 🔄 Helper de escritura Supabase (fire-and-forget, fallo silencioso)
  private _supabaseSync(op: 'add' | 'update' | 'delete', col: string, data?: any) {
    try {
      const supaDB = new SupabaseDatabase();
      if (op === 'delete') {
        supaDB.deleteProducto(data).catch(() => {});
      } else if (col === 'productos') {
        (op === 'add' ? supaDB.addProducto(data) : supaDB.updateProducto(data)).catch(() => {});
      } else if (col === 'proveedores') {
        (op === 'add' ? supaDB.addProveedor(data) : supaDB.updateProveedor(data)).catch(() => {});
      } else if (col === 'precios') {
        (op === 'add' ? supaDB.addPrecio(data) : supaDB.updatePrecio(data)).catch(() => {});
      }
    } catch (_) { /* fallo silencioso — IndexedDB ya tiene el dato */ }
  }

  // Productos
  async getAllProductos() { return this.adapter.getCollection('productos'); }
  async addProducto(p: any) {
    await this.adapter.setDocument('productos', p.id, p);
    // 🔀 Sincronizar en Supabase para que otros dispositivos lo vean
    try { new SupabaseDatabase().addProducto(p).catch(() => {}); } catch (_) {}
  }
  async updateProducto(p: any) {
    await this.adapter.setDocument('productos', p.id, p);
    try { new SupabaseDatabase().updateProducto(p).catch(() => {}); } catch (_) {}
  }
  async deleteProducto(id: string) { return this._delete('productos', id); }

  // Proveedores
  async getAllProveedores() { return this.adapter.getCollection('proveedores'); }
  async addProveedor(p: any) { return this.adapter.setDocument('proveedores', p.id, p); }
  async updateProveedor(p: any) { return this.adapter.setDocument('proveedores', p.id, p); }
  async deleteProveedor(id: string) { return this._delete('proveedores', id); }

  // Precios
  async getAllPrecios() { return this.adapter.getCollection('precios'); }
  async getPrecioByProductoProveedor(productoId: string, proveedorId: string) {
    const precios = await this.getAllPrecios();
    return precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
  }
  async addPrecio(p: any) { return this.adapter.setDocument('precios', p.id, p); }
  async updatePrecio(p: any) { return this.adapter.setDocument('precios', p.id, p); }
  async deletePrecio(id: string) { return this._delete('precios', id); }

  // Lápidas (Tombstones para sincronización)
  async getTombstones(table: string) {
    const tombs = await this.adapter.getCollection<any>('tombstones');
    return tombs.filter(t => t.table === table).map(t => t.item_id);
  }
  async addTombstone(table: string, id: string) {
    return this.adapter.setDocument('tombstones', `${table}:${id}`, {
      id: `${table}:${id}`, table, item_id: id, fecha: new Date().toISOString(),
    });
  }
  async removeTombstone(table: string, id: string) {
    return this._delete('tombstones', `${table}:${id}`);
  }

  // Configuración
  async getConfiguracion() {
    const configs = await this.adapter.getCollection<any>('configuracion');
    return configs.find(c => c.id === 'main');
  }
  async saveConfiguracion(config: any) {
    return this.adapter.setDocument('configuracion', 'main', { ...config, id: 'main' });
  }

  // ─── Métodos adicionales — ahora delegan al adapter real ───
  async getInventarioItemByProducto(productoId: string) {
    const all = await this.adapter.getCollection<any>('inventario');
    return all.find((i: any) => i.productoId === productoId) || null;
  }
  async getAllCreditosClientes() { return this.adapter.getCollection('creditos_clientes'); }
  async getAllCreditosTrabajadores() { return this.adapter.getCollection('creditos_trabajadores'); }
  async getAllTrabajadores() { return this.adapter.getCollection('trabajadores'); }
  async getAllGastos() { return this.adapter.getCollection('gastos'); }
  async getAllPedidosActivos() { return this.adapter.getCollection('pedidos_activos'); }
  async addPedidoActivo(p: any) { return this.adapter.setDocument('pedidos_activos', p.id, p); }
  async updatePedidoActivo(p: any) { return this.adapter.setDocument('pedidos_activos', p.id, p); }
  async deletePedidoActivo(id: string) { return this._delete('pedidos_activos', id); }
  async getAllMesas() { return this.adapter.getCollection('mesas'); }
  async updateMesa(m: any) { return this.adapter.setDocument('mesas', m.id, m); }
  async deleteMesa(id: string) { return this._delete('mesas', id); }
  async getAllAhorros() { return this.adapter.getCollection('ahorros'); }
  async updateInventarioItem(item: any) {
    return this.adapter.setDocument('inventario', item.id, item);
  }
  async getAllPrePedidos() { return this.adapter.getCollection('pre_pedidos'); }
  async addPrePedido(p: any) { return this.adapter.setDocument('pre_pedidos', p.id, p); }
  async updatePrePedido(p: any) { return this.adapter.setDocument('pre_pedidos', p.id, p); }
  async deletePrePedido(id: string) { return this._delete('pre_pedidos', id); }
  async getAllAlertas() { return this.adapter.getCollection('alertas'); }
  async addAlerta(a: any) { return this.adapter.setDocument('alertas', a.id, a); }
  async updateAlerta(a: any) { return this.adapter.setDocument('alertas', a.id, a); }
  async clearAllAlertas() {
    const alertas = await this.adapter.getCollection<any>('alertas');
    for (const a of alertas) await this._delete('alertas', a.id);
  }
  async addHistorial(e: any) { return this.adapter.setDocument('historial', e.id, e); }
  async getAllInventario() { return this.adapter.getCollection('inventario'); }
  async getAllMovimientos() { return this.adapter.getCollection('movimientos'); }
  async getAllRecepciones() { return this.adapter.getCollection('recepciones'); }
  async getAllHistorial() { return this.adapter.getCollection('historial'); }
  async getAllVentas() { return this.adapter.getCollection('ventas'); }
  async addVenta(v: any) { return this.adapter.setDocument('ventas', v.id, v); }
  async getAllSesionesCaja() { return this.adapter.getCollection('sesiones_caja'); }
  async getSesionCajaActiva(usuarioId?: string) {
    const sesiones = await this.adapter.getCollection<any>('sesiones_caja');
    // Busca por estado === 'abierta' (campo correcto del tipo CajaSesion)
    // Si se pasa usuarioId, filtra por la caja del usuario actual
    const abiertas = sesiones.filter((s: any) => s.estado === 'abierta');
    if (usuarioId) {
      return abiertas.find((s: any) => s.usuarioId === usuarioId) || abiertas[0] || null;
    }
    return abiertas[0] || null;
  }
  async addSesionCaja(s: any) { return this.adapter.setDocument('sesiones_caja', s.id, s); }
  async updateSesionCaja(s: any) { return this.adapter.setDocument('sesiones_caja', s.id, s); }
  async getBackup(key: string) { return this.adapter.getDocument('backups', key); }
  async saveBackup(key: string, val: any) {
    return this.adapter.setDocument('backups', key, { id: key, ...val });
  }

  // Asistencia
  async getAllAsistencia() { return this.adapter.getCollection('asistencia'); }
  async addRegistroAsistencia(r: any) { return this.adapter.setDocument('asistencia', r.id, r); }
  async getAsistenciaByFecha(fecha: string) {
    const all = await this.adapter.getCollection<any>('asistencia');
    return all.filter((r: any) => r.fecha === fecha);
  }

  // Recetas
  async getAllRecetas() { return this.adapter.getCollection('recetas'); }
  async addReceta(r: any) { return this.adapter.setDocument('recetas', r.id, r); }
  async updateReceta(r: any) { return this.adapter.setDocument('recetas', r.id, r); }
  async deleteReceta(id: string) { return this._delete('recetas', id); }

  // Producción & Formulaciones
  async getAllFormulaciones() { return this.adapter.getCollection('formulaciones'); }
  async addFormulacion(f: any) { return this.adapter.setDocument('formulaciones', f.id, f); }
  async updateFormulacion(f: any) { return this.adapter.setDocument('formulaciones', f.id, f); }
  async deleteFormulacion(id: string) { return this._delete('formulaciones', id); }

  async getAllModelosPan() { return this.adapter.getCollection('modelosPan'); }
  async addModeloPan(m: any) { return this.adapter.setDocument('modelosPan', m.id, m); }
  async updateModeloPan(m: any) { return this.adapter.setDocument('modelosPan', m.id, m); }
  async deleteModeloPan(id: string) { return this._delete('modelosPan', id); }

  async getAllOrdenesProduccion() { return this.adapter.getCollection('produccion'); }
  async addOrdenProduccion(o: any) { return this.adapter.setDocument('produccion', o.id, o); }
  async updateOrdenProduccion(o: any) { return this.adapter.setDocument('produccion', o.id, o); }

  // Agentes
  async getAgenteMisiones(agenteId: string) {
    const misiones = await this.adapter.getCollection<any>('agente_misiones');
    return misiones.filter(m => m.agenteId === agenteId);
  }
  async getAgenteHallazgos(agenteId: string) {
    const hallazgos = await this.adapter.getCollection<any>('agente_hallazgos');
    return hallazgos.filter(h => h.agenteId === agenteId);
  }
  async addAgenteHallazgo(agenteId: string, h: any) {
    return this.adapter.setDocument('agente_hallazgos', h.id, { ...h, agenteId });
  }

  // Clientes (CRM)
  async getAllClientes() { return this.adapter.getCollection('clientes'); }
  async addCliente(c: any) {
    await this.adapter.setDocument('clientes', c.id, c);
    new SupabaseDatabase().addCliente(c).catch(() => {});
  }
  async updateCliente(c: any) {
    await this.adapter.setDocument('clientes', c.id, c);
    new SupabaseDatabase().updateCliente(c).catch(() => {});
  }
  async deleteCliente(id: string) {
    // Firebase conserva la copia como backup.
    // Tombstone evita que el sync restaure al cliente eliminado.
    await this.addTombstone('clientes', id).catch(() => {});
    new SupabaseDatabase().deleteCliente(id).catch(() => {});
    return localAdapter.deleteDocument('clientes', id);
  }

  // Finanzas

  // Finanzas
  async addGasto(g: any) { return this.adapter.setDocument('gastos', g.id, g); }
  async updateGasto(g: any) { return this.adapter.setDocument('gastos', g.id, g); }
  async deleteGasto(id: string) { return this._delete('gastos', id); }

  async addCreditoCliente(c: any) { return this.adapter.setDocument('creditos_clientes', c.id, c); }
  async updateCreditoCliente(c: any) { return this.adapter.setDocument('creditos_clientes', c.id, c); }
  async deleteCreditoCliente(id: string) { return this._delete('creditos_clientes', id); }

  async addCreditoTrabajador(c: any) { return this.adapter.setDocument('creditos_trabajadores', c.id, c); }
  async updateCreditoTrabajador(c: any) { return this.adapter.setDocument('creditos_trabajadores', c.id, c); }
  async deleteCreditoTrabajador(id: string) { return this._delete('creditos_trabajadores', id); }

  async addTrabajador(t: any) { return this.adapter.setDocument('trabajadores', t.id, t); }
  async updateTrabajador(t: any) { return this.adapter.setDocument('trabajadores', t.id, t); }
  async deleteTrabajador(id: string) { return this._delete('trabajadores', id); }

  // Movimientos e Inventario
  async addMovimiento(m: any) { return this.adapter.setDocument('movimientos', m.id, m); }
  async addRecepcion(r: any) { return this.adapter.setDocument('recepciones', r.id, r); }
  async updateRecepcion(r: any) { return this.adapter.setDocument('recepciones', r.id, r); }
  async deleteRecepcion(id: string) { return this._delete('recepciones', id); }

  // Operaciones Atómicas (Simuladas por ahora)
  async batchAjustarStock(ajustes: any[]) {
    for (const a of ajustes) {
      const invItem = await this.getInventarioItemByProducto(a.productoId);
      const stockActual = invItem ? invItem.stockActual : 0;
      const nuevoStock = a.tipo === 'entrada' ? stockActual + a.cantidad : Math.max(0, stockActual - a.cantidad);
      
      const item = {
        id: invItem?.id || generateUUID(),
        productoId: a.productoId,
        stockActual: nuevoStock,
        stockMinimo: invItem?.stockMinimo || 10,
        ultimoMovimiento: new Date().toISOString()
      };
      
      await this.updateInventarioItem(item);
      await this.addMovimiento({
        id: generateUUID(),
        productoId: a.productoId,
        tipo: a.tipo,
        cantidad: a.cantidad,
        motivo: a.motivo,
        fecha: new Date().toISOString(),
        usuario: a.usuario || 'sistema'
      });
    }
  }

  // Sincronización Bidireccional
  async syncCloudToLocal() {
    let cloudExito = false;

    // 1️⃣ Intentar Firebase (legacy)
    if (firebaseAdapter) {
      try {
        await hydratarDesdeNube(localAdapter, firebaseAdapter, COLECCIONES_PRINCIPALES, true);
        cloudExito = true;
      } catch (error) {
        console.error('❌ [NEXUS] Falla al conectar con Firebase. Usando BUNDLE DE RESCATE LOCAL.', error);
      }
    }

    // 2️⃣ Intentar Supabase si Firebase no está disponible
    if (!cloudExito) {
      try {
        const supaDB = new SupabaseDatabase();
        const remoteProductos = await supaDB.getAllProductos();
        if (remoteProductos && remoteProductos.length > 0) {
          console.log('☁️ [NEXUS] Datos encontrados en Supabase. Sincronizando hacia local (MERGE — LOCAL GANA)...');
          const tasks: Array<{ col: string; fn: () => Promise<any[]> }> = [
            { col: 'productos',          fn: () => supaDB.getAllProductos() },
            { col: 'proveedores',        fn: () => supaDB.getAllProveedores() },
            { col: 'precios',            fn: () => supaDB.getAllPrecios() },
            { col: 'ventas',             fn: () => supaDB.getAllVentas() },
            { col: 'inventario',         fn: () => supaDB.getAllInventario() },
            { col: 'gastos',             fn: () => supaDB.getAllGastos() },
            { col: 'recepciones',        fn: () => supaDB.getAllRecepciones() },
            { col: 'pre_pedidos',        fn: () => supaDB.getAllPrePedidos() },
            { col: 'creditos_clientes',  fn: () => supaDB.getAllCreditosClientes() },
            { col: 'clientes',           fn: () => supaDB.getAllClientes() },
            { col: 'recetas',            fn: () => supaDB.getAllRecetas() },
            { col: 'sesiones_caja',      fn: () => supaDB.getAllSesionesCaja() },
            { col: 'mesas',              fn: () => supaDB.getAllMesas() },
            { col: 'pedidos_activos',    fn: () => supaDB.getAllPedidosActivos() },
          ];

          // Precargar tombstones una sola vez para todo el bloque
          const tombstonesData = await localAdapter.getCollection<any>('tombstones') || [];
          const deadKeys = new Set(tombstonesData.map((t: any) => `${t.table}:${t.item_id}`));

          for (const task of tasks) {
            try {
              const items = await task.fn();
              if (items && items.length > 0) {
                // 🔀 MERGE BIDIRECCIONAL: Solo agregar lo que NO existe localmente.
                // Los datos locales nunca se sobreescriben — así los productos recién creados
                // en cualquier módulo (Productos, Mayoristas, etc.) no se pierden al sincronizar.
                const localItems = await localAdapter.getCollection<any>(task.col);
                const localIds = new Set(localItems.map((i: any) => i.id));
                let nuevos = 0;
                for (const item of items) {
                  const key = `${task.col}:${item.id}`;
                  if (!localIds.has(item.id) && !deadKeys.has(key)) {
                    await localAdapter.setDocument(task.col, item.id, item);
                    nuevos++;
                  }
                }
                if (nuevos > 0) {
                  console.log(`🔄 [NEXUS-Supabase] Merge '${task.col}': ${nuevos} items nuevos desde la nube.`);
                } else {
                  console.log(`✅ [NEXUS-Supabase] '${task.col}' sincronizado — sin cambios nuevos.`);
                }
              }
            } catch (_) { /* colección opcional, continuar */ }
          }
          cloudExito = true;
          console.log('✅ [NEXUS] Sincronización MERGE desde Supabase completada. Datos locales preservados.');
        }
      } catch (e) {
        console.warn('☁️ [NEXUS] Supabase no disponible en este momento:', e);
      }
    }

    // 3️⃣ Fallback: inyectar RESCUE_DATA si aún no hay datos
    const checkProductos = await localAdapter.getCollection('productos');

    if (!cloudExito || !checkProductos || checkProductos.length === 0) {
      console.warn('⚠️ [NEXUS] Base de datos vacía o falla de nube. Inyectando RESCUE_DATA hardcodeado al IndexedDB...');
      for (const [colName, items] of Object.entries(RESCUE_DATA)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            await localAdapter.setDocument(colName, item.id, item);
          }
        }
      }
      console.log('✅ [NEXUS] Rescate Físico Terminado.');

      // 4️⃣ Subir RESCUE_DATA a Supabase si está vacío, para que otros dispositivos puedan sincronizar
      try {
        const supaDB = new SupabaseDatabase();
        const remoteCheck = await supaDB.getAllProductos().catch(() => [] as any[]);
        if (remoteCheck.length === 0) {
          console.log('☁️ [NEXUS] Supabase vacío — subiendo RESCUE_DATA para sincronización entre dispositivos...');
          const tombstonesData = await localAdapter.getCollection<any>('tombstones') || [];
          const deadKeys = new Set(tombstonesData.map((t: any) => `${t.table}:${t.item_id}`));
          const rescueUploads: Array<{ col: string; items: any[]; fn: (item: any) => Promise<void> }> = [
            { col: 'productos',   items: (RESCUE_DATA as any).productos   || [], fn: (d) => supaDB.addProducto(d) },
            { col: 'proveedores', items: (RESCUE_DATA as any).proveedores || [], fn: (d) => supaDB.addProveedor(d) },
            { col: 'precios',     items: (RESCUE_DATA as any).precios     || [], fn: (d) => supaDB.addPrecio(d) },
          ];
          for (const task of rescueUploads) {
            for (const item of task.items) {
              if (!deadKeys.has(`${task.col}:${item.id}`)) {
                await task.fn(item).catch(() => {});
              }
            }
          }
          console.log('✅ [NEXUS] RESCUE_DATA disponible en Supabase para todos los dispositivos.');
        }
      } catch (e) {
        console.warn('⚠️ [NEXUS] No se pudo subir RESCUE_DATA a Supabase (no crítico):', e);
      }
    }
  }

  async syncLocalToCloud() {
    if (firebaseAdapter) {
      console.log('📤 [NEXUS]: Iniciando respaldo local → nube...');

      // NOTA: Los tombstones NO se propagan a Firebase automáticamente.
      // La eliminación en Firebase ya se hace en tiempo real dentro de _delete().
      // Propagar tombstones aquí causaría que una eliminación en un dispositivo
      // se replique a la nube y destruya el dato para todos los demás dispositivos.
      // Si se quiere eliminar definitivamente desde la nube, debe hacerse explícitamente.

      // Sincronizar creaciones y actualizaciones
      for (const col of COLECCIONES_PRINCIPALES) {
        const items = await localAdapter.getCollection<any>(col);
        for (const item of items) {
          await firebaseAdapter.setDocument(col, item.id, item);
        }
      }
      console.log('✅ [NEXUS]: Respaldo completado.');
    }
  }

  async clearAll() {
    console.log('🗑️ [NEXUS]: Borrando todos los datos locales...');
    for (const col of COLECCIONES_PRINCIPALES) {
      await localAdapter.clearCollection(col);
    }
    console.log('✅ [NEXUS]: Base de datos local limpia.');
  }

  async exportDatabaseToJson(): Promise<void> {
    console.log('📦 [NEXUS]: Generando backup completo...');
    const backup: Record<string, any[]> = {};
    for (const col of COLECCIONES_PRINCIPALES) {
      backup[col] = await localAdapter.getCollection(col);
    }
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_full_nexus_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('✅ [NEXUS]: Backup descargado.');
  }

  async importDatabaseFromJson(jsonData: any): Promise<void> {
    console.log('📥 [NEXUS]: Restaurando backup completo desde JSON...');
    for (const [colName, items] of Object.entries(jsonData)) {
      if (COLECCIONES_PRINCIPALES.includes(colName) && Array.isArray(items)) {
        console.log(`Restaurando coleccion: ${colName} con ${items.length} items`);
        await localAdapter.hydrateFromCloud(colName, items);
      }
    }
    console.log('✅ [NEXUS]: Restauración local completada, sincronizando con la nube...');
    await this.syncLocalToCloud();
  }

  async rescueFromSupabase() {
    console.log('🚨 [NEXUS]: Iniciando Protocolo Armagedón — Rescate desde Supabase...');
    await this.exportDatabaseToJson(); // CAPA 1: Backup Automático antes del rescate
    
    const legacyDB = new SupabaseDatabase();
    
    // Lista de rescate extendida
    const rescate = [
      { col: 'productos', fn: () => legacyDB.getAllProductos() },
      { col: 'proveedores', fn: () => legacyDB.getAllProveedores() },
      { col: 'precios', fn: () => legacyDB.getAllPrecios() },
      { col: 'recetas', fn: () => legacyDB.getAllRecetas() },
      { col: 'configuracion', fn: async () => { 
          const c = await legacyDB.getConfiguracion(); 
          return c ? [c] : []; 
      }},
      { col: 'ventas', fn: () => legacyDB.getAllVentas() },
      { col: 'inventario', fn: () => legacyDB.getAllInventario() },
      { col: 'movimientos', fn: () => legacyDB.getAllMovimientos() },
      { col: 'gastos', fn: () => legacyDB.getAllGastos() },
      { col: 'creditos_clientes', fn: async () => {
          const { data } = await (legacyDB as any).supabase.from('creditos_clientes').select('*');
          return data || [];
      }},
    ];

    for (const task of rescate) {
      try {
        console.log('[RESCATE] Recuperando ' + task.col + '...');
        const items = await task.fn();
        if (items && items.length > 0) {
          console.log('[RESCATE] Volcando ' + items.length + ' items en local...');
          await localAdapter.hydrateFromCloud(task.col, items);
        }
      } catch (e) {
        console.error('[RESCATE] Error en ' + task.col + ':', e);
      }
    }
    console.log('[NEXUS] Rescate completado. Sincronizando con nueva nube...');
    await this.syncLocalToCloud();
  }
}

// ─────────────────────────────────────────────────────────
// ARQUITECTURA: IndexedDB (Local) + Firebase (Nube)
// ─────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebase =
  !!import.meta.env.VITE_FIREBASE_API_KEY &&
  !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

// MOTOR LOCAL: IndexedDB — SIEMPRE activo, fuente de verdad offline
// Exportado para que useRealtimeSync pueda borrar directo en IndexedDB
// sin propagar a Firebase (evita que Realtime DELETE cascade y borre Firebase también).
export const localAdapter = new IndexedDBAdapter();

// MOTOR NUBE: Firebase — activo solo si hay credenciales configuradas en .env
const firebaseAdapter = hasFirebase ? new FirebaseAdapter(firebaseConfig) : null;

// ORQUESTADOR: IndexedDB como primario, Firebase como sombra.
const activeAdapter: DatabaseAdapter = firebaseAdapter
  ? new MultiAdapter(localAdapter, firebaseAdapter)
  : localAdapter;

export const db = new NexusDatabase(activeAdapter);

db.init().then(() => {
  console.log('[IndexedDB]: Base de datos local lista.');
  if (firebaseAdapter) {
    hydratarDesdeNube(localAdapter, firebaseAdapter, COLECCIONES_PRINCIPALES);
  }
}).catch(console.error);
