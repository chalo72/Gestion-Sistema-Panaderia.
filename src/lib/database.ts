import type { DatabaseAdapter } from './dbAdapter';
import { FirebaseAdapter } from './firebaseAdapter';
import { IndexedDBAdapter } from './indexedDBAdapter';

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
    // La suscripción en tiempo real usa la nube si está disponible,
    // si no, cae al polling local del IndexedDBAdapter
    return this.primary.subscribe(collection, callback);
  }
}

// ─── COLECCIONES QUE SE HIDRATAN DESDE FIREBASE AL ARRANCAR ───
const COLECCIONES_PRINCIPALES = [
  'productos',
  'proveedores',
  'precios',
  'configuracion',
  'ventas',
  'inventario',
];

/**
 * 🌊 HYDRATE: Carga datos de Firebase → IndexedDB al arrancar.
 * Solo hidrata si la colección local está vacía (primera vez o reset manual).
 */
async function hydratarDesdeNube(
  localDB: IndexedDBAdapter,
  nube: FirebaseAdapter,
  colecciones: string[]
): Promise<void> {
  console.log('🌊 [NEXUS]: Iniciando hidratación Firebase → IndexedDB...');
  for (const col of colecciones) {
    try {
      const localCount = await localDB.count(col);
      if (localCount === 0) {
        const datosNube = await nube.getCollection<any>(col);
        if (datosNube.length > 0) {
          await localDB.hydrateFromCloud(col, datosNube);
        }
      } else {
        console.log(`✅ [NEXUS]: '${col}' ya tiene ${localCount} items locales. No se sobrescribe.`);
      }
    } catch (e) {
      console.warn(`⚠️ [NEXUS]: No se pudo hidratar '${col}'.`, e);
    }
  }
  console.log('✅ [NEXUS]: Hidratación completada.');
}

/**
 * 🏢 NEXUS DATABASE WRAPPER
 * La app solo conoce esta interfaz. El motor real es transparente.
 */
class NexusDatabase implements IDatabase {
  constructor(private adapter: DatabaseAdapter) {}

  async init() { await this.adapter.init(); }

  // Productos
  async getAllProductos() { return this.adapter.getCollection('productos'); }
  async addProducto(p: any) { return this.adapter.setDocument('productos', p.id, p); }
  async updateProducto(p: any) { return this.adapter.setDocument('productos', p.id, p); }
  async deleteProducto(id: string) { return this.adapter.deleteDocument('productos', id); }

  // Proveedores
  async getAllProveedores() { return this.adapter.getCollection('proveedores'); }
  async addProveedor(p: any) { return this.adapter.setDocument('proveedores', p.id, p); }
  async updateProveedor(p: any) { return this.adapter.setDocument('proveedores', p.id, p); }
  async deleteProveedor(id: string) { return this.adapter.deleteDocument('proveedores', id); }

  // Precios
  async getAllPrecios() { return this.adapter.getCollection('precios'); }
  async getPrecioByProductoProveedor(productoId: string, proveedorId: string) {
    const precios = await this.getAllPrecios();
    return precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
  }
  async addPrecio(p: any) { return this.adapter.setDocument('precios', p.id, p); }
  async updatePrecio(p: any) { return this.adapter.setDocument('precios', p.id, p); }
  async deletePrecio(id: string) { return this.adapter.deleteDocument('precios', id); }

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
    return this.adapter.deleteDocument('tombstones', `${table}:${id}`);
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
  async getInventarioItemByProducto(id: string) {
    return this.adapter.getDocument('inventario', id);
  }
  async getAllCreditosClientes() { return this.adapter.getCollection('creditos_clientes'); }
  async getAllCreditosTrabajadores() { return this.adapter.getCollection('creditos_trabajadores'); }
  async getAllTrabajadores() { return this.adapter.getCollection('trabajadores'); }
  async getAllGastos() { return this.adapter.getCollection('gastos'); }
  async getAllPedidosActivos() { return this.adapter.getCollection('pedidos_activos'); }
  async getAllMesas() { return this.adapter.getCollection('mesas'); }
  async getAllAhorros() { return this.adapter.getCollection('ahorros'); }
  async updateInventarioItem(item: any) {
    return this.adapter.setDocument('inventario', item.id, item);
  }
  async getAllPrePedidos() { return this.adapter.getCollection('pre_pedidos'); }
  async addPrePedido(p: any) { return this.adapter.setDocument('pre_pedidos', p.id, p); }
  async updatePrePedido(p: any) { return this.adapter.setDocument('pre_pedidos', p.id, p); }
  async deletePrePedido(id: string) { return this.adapter.deleteDocument('pre_pedidos', id); }
  async getAllAlertas() { return this.adapter.getCollection('alertas'); }
  async addAlerta(a: any) { return this.adapter.setDocument('alertas', a.id, a); }
  async updateAlerta(a: any) { return this.adapter.setDocument('alertas', a.id, a); }
  async clearAllAlertas() {
    const alertas = await this.adapter.getCollection<any>('alertas');
    for (const a of alertas) await this.adapter.deleteDocument('alertas', a.id);
  }
  async addHistorial(e: any) { return this.adapter.setDocument('historial', e.id, e); }
  async getAllInventario() { return this.adapter.getCollection('inventario'); }
  async getAllMovimientos() { return this.adapter.getCollection('movimientos'); }
  async getAllRecepciones() { return this.adapter.getCollection('recepciones'); }
  async getAllHistorial() { return this.adapter.getCollection('historial'); }
  async getAllVentas() { return this.adapter.getCollection('ventas'); }
  async addVenta(v: any) { return this.adapter.setDocument('ventas', v.id, v); }
  async getAllSesionesCaja() { return this.adapter.getCollection('sesiones_caja'); }
  async getSesionCajaActiva() {
    const sesiones = await this.adapter.getCollection<any>('sesiones_caja');
    return sesiones.find(s => s.activa === true) || null;
  }
  async addSesionCaja(s: any) { return this.adapter.setDocument('sesiones_caja', s.id, s); }
  async updateSesionCaja(s: any) { return this.adapter.setDocument('sesiones_caja', s.id, s); }
  async getBackup(key: string) { return this.adapter.getDocument('backups', key); }
  async saveBackup(key: string, val: any) {
    return this.adapter.setDocument('backups', key, { id: key, ...val });
  }
}

// ─────────────────────────────────────────────────────────
// 🏗️ ARQUITECTURA TRÍO: IndexedDB (Local) + Firebase (Nube)
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

// 1️⃣ MOTOR LOCAL: IndexedDB — SIEMPRE activo, fuente de verdad offline
const localAdapter = new IndexedDBAdapter();

// 2️⃣ MOTOR NUBE: Firebase — activo solo si hay credenciales configuradas en .env
const firebaseAdapter = hasFirebase ? new FirebaseAdapter(firebaseConfig) : null;

// 3️⃣ ORQUESTADOR: IndexedDB como primario, Firebase como sombra.
//    Escrituras → local primero, luego nube en paralelo.
//    Lecturas → local siempre (offline-first).
const activeAdapter: DatabaseAdapter = firebaseAdapter
  ? new MultiAdapter(localAdapter, firebaseAdapter)
  : localAdapter;

// Inicialización asíncrona con hidratación automática desde la nube al arrancar
(async () => {
  try {
    await activeAdapter.init();

    if (firebaseAdapter) {
      // Carga datos Firebase → IndexedDB solo si el local está vacío
      await hydratarDesdeNube(localAdapter, firebaseAdapter, COLECCIONES_PRINCIPALES);
    } else {
      console.log('📴 [NEXUS]: Sin Firebase configurado. Modo 100% Local (IndexedDB).');
    }
  } catch (e) {
    console.error('❌ [NEXUS]: Error crítico al inicializar la base de datos.', e);
  }
})();

// La app importa solo esto — el motor real es completamente transparente
export const db = new NexusDatabase(activeAdapter);

