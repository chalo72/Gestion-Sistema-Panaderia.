import { DatabaseAdapter, setAdapter } from './dbAdapter';
import { FirebaseAdapter } from './firebaseAdapter';
import { AppwriteAdapter } from './appwriteAdapter';
import { PocketBaseAdapter } from './pocketbaseAdapter';

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
  
  // ... Se pueden agregar más métodos según se necesiten
}

/**
 * 🛰️ MULTI-ENGINE ADAPTER
 * Coordina múltiples bases de datos al mismo tiempo (Patrón Capitán/Suplente).
 */
class MultiAdapter implements DatabaseAdapter {
  constructor(private primary: DatabaseAdapter, private shadow?: DatabaseAdapter) {}

  async init() {
    await this.primary.init();
    if (this.shadow) await this.shadow.init();
  }

  async getCollection<T>(name: string) {
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
    await this.primary.setDocument(collection, id, data);
    if (this.shadow) {
      try {
        await this.shadow.setDocument(collection, id, data);
      } catch (e) {
        console.warn(`⚠️ [NEXUS]: Fallo silencioso en Suplente.`);
      }
    }
  }

  async deleteDocument(collection: string, id: string) {
    await this.primary.deleteDocument(collection, id);
    if (this.shadow) {
      try {
        await this.shadow.deleteDocument(collection, id);
      } catch (e) {
        console.warn(`⚠️ [NEXUS]: Fallo silencioso en Suplente al borrar.`);
      }
    }
  }

  subscribe<T>(collection: string, callback: (data: T[]) => void) {
    return this.primary.subscribe(collection, callback);
  }
}

/**
 * 🏢 NEXUS DATABASE WRAPPER
 * Implementa IDatabase delegando en el MultiAdapter.
 * Esto permite que la app siga usando los métodos específicos sin enterarse del cambio de motor.
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

  // Lápidas
  async getTombstones(table: string) { 
    const tombs = await this.adapter.getCollection<any>('tombstones');
    return tombs.filter(t => t.table === table).map(t => t.item_id);
  }
  async addTombstone(table: string, id: string) { 
    return this.adapter.setDocument('tombstones', `${table}:${id}`, { table, item_id: id, fecha: new Date().toISOString() });
  }
  async removeTombstone(table: string, id: string) { 
    return this.adapter.deleteDocument('tombstones', `${table}:${id}`);
  }

  // Configuración
  async getConfiguracion() { 
    const configs = await this.adapter.getCollection('configuracion');
    return configs.find(c => c.id === 'main');
  }
  async saveConfiguracion(config: any) { 
    return this.adapter.setDocument('configuracion', 'main', { ...config, id: 'main' });
  }

  // --- STUBS PARA NO ROMPER LA APP ---
  async getInventarioItemByProducto(id: string) { return null; }
  async updateInventarioItem(item: any) { }
  async getAllPrePedidos() { return []; }
  async addPrePedido(p: any) { }
  async updatePrePedido(p: any) { }
  async deletePrePedido(id: string) { }
  async getAllAlertas() { return []; }
  async addAlerta(a: any) { }
  async updateAlerta(a: any) { }
  async clearAllAlertas() { }
  async addHistorial(e: any) { }
  async getAllInventario() { return []; }
  async getAllMovimientos() { return []; }
  async getAllRecepciones() { return []; }
  async getAllHistorial() { return []; }
  async getAllVentas() { return []; }
  async addVenta(v: any) { }
  async getAllSesionesCaja() { return []; }
  async getSesionCajaActiva() { return null; }
  async addSesionCaja(s: any) { }
  async updateSesionCaja(s: any) { }
  async getBackup(key: string) { return null; }
  async saveBackup(key: string, val: any) { }
}

// ─── CONFIGURACIÓN DE INSTANCIAS ───

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  project: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  database: import.meta.env.VITE_APPWRITE_DATABASE_ID || 'main'
};

const pocketbaseConfig = {
  url: import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
};

let activeAdapter: DatabaseAdapter;

const hasFirebase = !!import.meta.env.VITE_FIREBASE_API_KEY;
const hasAppwrite = !!import.meta.env.VITE_APPWRITE_ENDPOINT;
const hasPocketbase = !!import.meta.env.VITE_POCKETBASE_URL;

const firebaseAdapter = hasFirebase ? new FirebaseAdapter(firebaseConfig) : null;
const appwriteAdapter = hasAppwrite ? new AppwriteAdapter(appwriteConfig.endpoint, appwriteConfig.project, appwriteConfig.database) : null;
const pocketbaseAdapter = hasPocketbase ? new PocketBaseAdapter(pocketbaseConfig.url) : null;

// Modo Local por defecto si no hay nada
class LocalFallbackAdapter implements DatabaseAdapter {
  async init() { console.log("🏠 [NEXUS]: Operando en MODO LOCAL."); }
  async getCollection<T>() { return []; }
  async getDocument<T>() { return null; }
  async setDocument() { }
  async deleteDocument() { }
  subscribe() { return () => {}; }
}

if (appwriteAdapter && firebaseAdapter) {
  activeAdapter = new MultiAdapter(appwriteAdapter, firebaseAdapter);
} else if (pocketbaseAdapter) {
  activeAdapter = pocketbaseAdapter;
} else if (appwriteAdapter) {
  activeAdapter = appwriteAdapter;
} else if (firebaseAdapter) {
  activeAdapter = firebaseAdapter;
} else {
  activeAdapter = new LocalFallbackAdapter();
}

activeAdapter.init();

// Exportamos la instancia de NexusDatabase que implementa IDatabase
export const db = new NexusDatabase(activeAdapter);
