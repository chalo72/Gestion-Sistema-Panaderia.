import { SupabaseDatabase } from './supabase-db';

// Interfaces Definition
export interface DBProducto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  precioVenta: number;
  margenUtilidad: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBProveedor {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  createdAt: string;
}

export interface DBPrecio {
  id: string;
  productoId: string;
  proveedorId: string;
  precioCosto: number;
  fechaActualizacion: string;
  notas?: string;
}

export interface DBPrePedido {
  id: string;
  nombre: string;
  proveedorId: string;
  items: DBPrePedidoItem[];
  total: number;
  presupuestoMaximo: number;
  estado: 'borrador' | 'confirmado' | 'rechazado';
  notas?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface DBPrePedidoItem {
  id: string;
  productoId: string;
  proveedorId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface DBAlerta {
  id: string;
  productoId: string;
  proveedorId: string;
  tipo: 'subida' | 'bajada';
  precioAnterior: number;
  precioNuevo: number;
  diferencia: number;
  porcentajeCambio: number;
  fecha: string;
  leida: boolean;
}

export interface DBConfiguracion {
  id: string;
  margenUtilidadDefault: number;
  ajusteAutomatico: boolean;
  notificarSubidas: boolean;
  umbralAlerta: number;
  categorias: { id: string; nombre: string; color: string }[];
  moneda: string;
  nombreNegocio: string;
  direccionNegocio?: string;
  telefonoNegocio?: string;
  emailNegocio?: string;
  impuestoPorcentaje: number;
  mostrarUtilidadEnLista: boolean;
}

export interface DBInventarioItem {
  id: string;
  productoId: string;
  stockActual: number;
  stockMinimo: number;
  ubicacion?: string;
  ultimoMovimiento?: string;
}

export interface DBMovimientoInventario {
  id: string;
  productoId: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo: string;
  fecha: string;
  usuario: string;
}

export interface DBRecepcionItem {
  id: string;
  productoId: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  precioEsperado: number;
  precioFacturado: number;
  embalajeOk: boolean;
  productoOk: boolean;
  cantidadOk: boolean;
  modeloOk: boolean;
  defectuosos: number;
  lote?: string;
  observaciones?: string;
}

export interface DBRecepcion {
  id: string;
  prePedidoId?: string;
  proveedorId: string;
  numeroFactura: string;
  fechaFactura: string;
  totalFactura: number;
  items: DBRecepcionItem[];
  estado: 'en_proceso' | 'completada' | 'con_incidencias';
  recibidoPor: string;
  firma?: string;
  observaciones?: string;
  fechaRecepcion: string;
  imagenFactura?: string;
}

export interface DBHistorialPrecio {
  id: string;
  productoId: string;
  proveedorId: string;
  precioAnterior: number;
  precioNuevo: number;
  fechaCambio: string;
}

export interface IDatabase {
  init(): Promise<void>;
  getAllProductos(): Promise<DBProducto[]>;
  addProducto(producto: DBProducto): Promise<void>;
  updateProducto(producto: DBProducto): Promise<void>;
  deleteProducto(id: string): Promise<void>;
  getAllProveedores(): Promise<DBProveedor[]>;
  addProveedor(proveedor: DBProveedor): Promise<void>;
  updateProveedor(proveedor: DBProveedor): Promise<void>;
  deleteProveedor(id: string): Promise<void>;
  getAllPrecios(): Promise<DBPrecio[]>;
  getPreciosByProducto(productoId: string): Promise<DBPrecio[]>;
  getPreciosByProveedor(proveedorId: string): Promise<DBPrecio[]>;
  getPrecioByProductoProveedor(productoId: string, proveedorId: string): Promise<DBPrecio | undefined>;
  addPrecio(precio: DBPrecio): Promise<void>;
  updatePrecio(precio: DBPrecio): Promise<void>;
  deletePrecio(id: string): Promise<void>;
  getAllPrePedidos(): Promise<DBPrePedido[]>;
  addPrePedido(prepedido: DBPrePedido): Promise<void>;
  updatePrePedido(prepedido: DBPrePedido): Promise<void>;
  deletePrePedido(id: string): Promise<void>;
  getAllAlertas(): Promise<DBAlerta[]>;
  addAlerta(alerta: DBAlerta): Promise<void>;
  updateAlerta(alerta: DBAlerta): Promise<void>;
  deleteAlerta(id: string): Promise<void>;
  clearAllAlertas(): Promise<void>;
  getConfiguracion(): Promise<DBConfiguracion | undefined>;
  saveConfiguracion(config: DBConfiguracion): Promise<void>;
  getAllInventario(): Promise<DBInventarioItem[]>;
  getInventarioItemByProducto(productoId: string): Promise<DBInventarioItem | undefined>;
  updateInventarioItem(item: DBInventarioItem): Promise<void>;
  getAllMovimientos(): Promise<DBMovimientoInventario[]>;
  addMovimiento(movimiento: DBMovimientoInventario): Promise<void>;
  getAllRecepciones(): Promise<DBRecepcion[]>;
  addRecepcion(recepcion: DBRecepcion): Promise<void>;
  updateRecepcion(recepcion: DBRecepcion): Promise<void>;
  getAllHistorial(): Promise<DBHistorialPrecio[]>;
  addHistorial(entry: DBHistorialPrecio): Promise<void>;
  getHistorialByProducto(productoId: string): Promise<DBHistorialPrecio[]>;
  clearAll(): Promise<void>;
  syncLocalToCloud?(): Promise<void>;
}

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 6;

class IndexedDBDatabase implements IDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('productos')) {
          const s = db.createObjectStore('productos', { keyPath: 'id' });
          s.createIndex('categoria', 'categoria', { unique: false });
          s.createIndex('nombre', 'nombre', { unique: false });
        }
        if (!db.objectStoreNames.contains('proveedores')) {
          const s = db.createObjectStore('proveedores', { keyPath: 'id' });
          s.createIndex('nombre', 'nombre', { unique: false });
        }
        if (!db.objectStoreNames.contains('precios')) {
          const s = db.createObjectStore('precios', { keyPath: 'id' });
          s.createIndex('productoId', 'productoId', { unique: false });
          s.createIndex('proveedorId', 'proveedorId', { unique: false });
          s.createIndex('productoProveedor', ['productoId', 'proveedorId'], { unique: true });
        }
        if (!db.objectStoreNames.contains('prepedidos')) {
          const s = db.createObjectStore('prepedidos', { keyPath: 'id' });
          s.createIndex('proveedorId', 'proveedorId', { unique: false });
          s.createIndex('estado', 'estado', { unique: false });
        }
        if (!db.objectStoreNames.contains('alertas')) {
          const alertasStore = db.createObjectStore('alertas', { keyPath: 'id' });
          alertasStore.createIndex('leida', 'leida', { unique: false });
          alertasStore.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!db.objectStoreNames.contains('configuracion')) {
          db.createObjectStore('configuracion', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inventario')) {
          const inventarioStore = db.createObjectStore('inventario', { keyPath: 'id' });
          inventarioStore.createIndex('productoId', 'productoId', { unique: true });
        }
        if (!db.objectStoreNames.contains('movimientos')) {
          const s = db.createObjectStore('movimientos', { keyPath: 'id' });
          s.createIndex('productoId', 'productoId', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!db.objectStoreNames.contains('recepciones')) {
          const s = db.createObjectStore('recepciones', { keyPath: 'id' });
          s.createIndex('proveedorId', 'proveedorId', { unique: false });
          s.createIndex('fechaRecepcion', 'fechaRecepcion', { unique: false });
        }
        if (!db.objectStoreNames.contains('historialPrecios')) {
          const s = db.createObjectStore('historialPrecios', { keyPath: 'id' });
          s.createIndex('productoId', 'productoId', { unique: false });
          s.createIndex('proveedorId', 'proveedorId', { unique: false });
          s.createIndex('fechaCambio', 'fechaCambio', { unique: false });
        }
      };
    });
  }

  private async ensureInit() {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database failed to initialize');
    return this.db;
  }

  async getAllProductos(): Promise<DBProducto[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['productos'], 'readonly').objectStore('productos').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addProducto(p: DBProducto): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['productos'], 'readwrite').objectStore('productos').add(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateProducto(p: DBProducto): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['productos'], 'readwrite').objectStore('productos').put(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteProducto(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['productos'], 'readwrite').objectStore('productos').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllProveedores(): Promise<DBProveedor[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['proveedores'], 'readonly').objectStore('proveedores').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addProveedor(p: DBProveedor): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['proveedores'], 'readwrite').objectStore('proveedores').add(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateProveedor(p: DBProveedor): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['proveedores'], 'readwrite').objectStore('proveedores').put(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteProveedor(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['proveedores'], 'readwrite').objectStore('proveedores').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllPrecios(): Promise<DBPrecio[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readonly').objectStore('precios').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getPreciosByProducto(pid: string): Promise<DBPrecio[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readonly').objectStore('precios').index('productoId').getAll(pid);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getPreciosByProveedor(pid: string): Promise<DBPrecio[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readonly').objectStore('precios').index('proveedorId').getAll(pid);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getPrecioByProductoProveedor(pid: string, provId: string): Promise<DBPrecio | undefined> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readonly').objectStore('precios').index('productoProveedor').get([pid, provId]);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addPrecio(p: DBPrecio): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readwrite').objectStore('precios').add(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updatePrecio(p: DBPrecio): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readwrite').objectStore('precios').put(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deletePrecio(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readwrite').objectStore('precios').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllPrePedidos(): Promise<DBPrePedido[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prepedidos'], 'readonly').objectStore('prepedidos').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addPrePedido(p: DBPrePedido): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prepedidos'], 'readwrite').objectStore('prepedidos').add(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updatePrePedido(p: DBPrePedido): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prepedidos'], 'readwrite').objectStore('prepedidos').put(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deletePrePedido(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prepedidos'], 'readwrite').objectStore('prepedidos').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllAlertas(): Promise<DBAlerta[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['alertas'], 'readonly').objectStore('alertas').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addAlerta(a: DBAlerta): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['alertas'], 'readwrite').objectStore('alertas').add(a);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateAlerta(a: DBAlerta): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['alertas'], 'readwrite').objectStore('alertas').put(a);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteAlerta(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['alertas'], 'readwrite').objectStore('alertas').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async clearAllAlertas(): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['alertas'], 'readwrite').objectStore('alertas').clear();
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getConfiguracion(): Promise<DBConfiguracion | undefined> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['configuracion'], 'readonly').objectStore('configuracion').get('main');
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async saveConfiguracion(c: DBConfiguracion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['configuracion'], 'readwrite').objectStore('configuracion').put({ ...c, id: 'main' });
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllInventario(): Promise<DBInventarioItem[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['inventario'], 'readonly').objectStore('inventario').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getInventarioItemByProducto(pid: string): Promise<DBInventarioItem | undefined> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['inventario'], 'readonly').objectStore('inventario').index('productoId').get(pid);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async updateInventarioItem(i: DBInventarioItem): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['inventario'], 'readwrite').objectStore('inventario').put(i);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllMovimientos(): Promise<DBMovimientoInventario[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['movimientos'], 'readonly').objectStore('movimientos').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addMovimiento(m: DBMovimientoInventario): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['movimientos'], 'readwrite').objectStore('movimientos').add(m);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllRecepciones(): Promise<DBRecepcion[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recepciones'], 'readonly').objectStore('recepciones').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addRecepcion(r: DBRecepcion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recepciones'], 'readwrite').objectStore('recepciones').add(r);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateRecepcion(r: DBRecepcion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recepciones'], 'readwrite').objectStore('recepciones').put(r);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getAllHistorial(): Promise<DBHistorialPrecio[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['historialPrecios'], 'readonly').objectStore('historialPrecios').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addHistorial(h: DBHistorialPrecio): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['historialPrecios'], 'readwrite').objectStore('historialPrecios').add(h);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async getHistorialByProducto(pid: string): Promise<DBHistorialPrecio[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['historialPrecios'], 'readonly').objectStore('historialPrecios').index('productoId').getAll(pid);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureInit();
    const stores = ['productos', 'proveedores', 'precios', 'prepedidos', 'alertas', 'configuracion', 'inventario', 'movimientos', 'recepciones', 'historialPrecios'];
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
  }
}

// True Hybrid Database Adapter
// Priority: Local (speed) + Async Background Sync to Cloud
class HybridDatabase implements IDatabase {
  private local: IndexedDBDatabase;
  private cloud: SupabaseDatabase;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.local = new IndexedDBDatabase();
    this.cloud = new SupabaseDatabase();
    window.addEventListener('online', () => { this.isOnline = true; this.syncLocalToCloud(); });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  async init(): Promise<void> {
    await this.local.init();
    await this.cloud.init();
    if (this.isOnline) {
      await this.syncCloudToLocal();
    }
  }

  private async syncCloudToLocal() {
    try {
      // Sync basic entities from cloud to local for initial bootstrap
      const productos = await this.cloud.getAllProductos();
      const proveedores = await this.cloud.getAllProveedores();

      for (const p of productos) await this.local.updateProducto(p);
      for (const p of proveedores) await this.local.updateProveedor(p);

      // More sync can be added here (Precios, Inventario, etc.)
    } catch (e) {
      console.warn('Sync cloud to local failed:', e);
    }
  }

  public async syncLocalToCloud() {
    if (!this.isOnline) return;

    console.log('🔄 Iniciando sincronización de Local a Nube...');
    try {
      // 1. Productos
      const productos = await this.local.getAllProductos();
      for (const p of productos) await this.cloud.updateProducto(p).catch(() => this.cloud.addProducto(p));

      // 2. Proveedores
      const proveedores = await this.local.getAllProveedores();
      for (const p of proveedores) await this.cloud.updateProveedor(p).catch(() => this.cloud.addProveedor(p));

      // 3. Precios
      const precios = await this.local.getAllPrecios();
      for (const p of precios) await this.cloud.updatePrecio(p).catch(() => this.cloud.addPrecio(p));

      // 4. Inventario
      const inventario = await this.local.getAllInventario();
      for (const i of inventario) await this.cloud.updateInventarioItem(i);

      // 5. Configuración
      const config = await this.local.getConfiguracion();
      if (config) await this.cloud.saveConfiguracion(config);

      console.log('✅ Sincronización completada con éxito.');
    } catch (e) {
      console.error('❌ Error en sincronización Local a Nube:', e);
    }
  }

  // Implementation Pattern: Read from Local (fast), Write to Both (consistency)
  async getAllProductos() { return this.local.getAllProductos(); }
  async addProducto(p: DBProducto) {
    await this.local.addProducto(p);
    if (this.isOnline) await this.cloud.addProducto(p).catch(console.error);
  }
  async updateProducto(p: DBProducto) {
    await this.local.updateProducto(p);
    if (this.isOnline) await this.cloud.updateProducto(p).catch(console.error);
  }
  async deleteProducto(id: string) {
    await this.local.deleteProducto(id);
    if (this.isOnline) await this.cloud.deleteProducto(id).catch(console.error);
  }

  async getAllProveedores() { return this.local.getAllProveedores(); }
  async addProveedor(p: DBProveedor) {
    await this.local.addProveedor(p);
    if (this.isOnline) await this.cloud.addProveedor(p).catch(console.error);
  }
  async updateProveedor(p: DBProveedor) {
    await this.local.updateProveedor(p);
    if (this.isOnline) await this.cloud.updateProveedor(p).catch(console.error);
  }
  async deleteProveedor(id: string) {
    await this.local.deleteProveedor(id);
    if (this.isOnline) await this.cloud.deleteProveedor(id).catch(console.error);
  }

  async getAllPrecios() { return this.local.getAllPrecios(); }
  async getPreciosByProducto(pid: string) { return this.local.getPreciosByProducto(pid); }
  async getPreciosByProveedor(pid: string) { return this.local.getPreciosByProveedor(pid); }
  async getPrecioByProductoProveedor(pid: string, provId: string) { return this.local.getPrecioByProductoProveedor(pid, provId); }
  async addPrecio(p: DBPrecio) {
    await this.local.addPrecio(p);
    if (this.isOnline) await this.cloud.addPrecio(p).catch(console.error);
  }
  async updatePrecio(p: DBPrecio) {
    await this.local.updatePrecio(p);
    if (this.isOnline) await this.cloud.updatePrecio(p).catch(console.error);
  }
  async deletePrecio(id: string) {
    await this.local.deletePrecio(id);
    if (this.isOnline) await this.cloud.deletePrecio(id).catch(console.error);
  }

  async getAllPrePedidos() { return this.local.getAllPrePedidos(); }
  async addPrePedido(p: DBPrePedido) {
    await this.local.addPrePedido(p);
    if (this.isOnline) await this.cloud.addPrePedido(p).catch(console.error);
  }
  async updatePrePedido(p: DBPrePedido) {
    await this.local.updatePrePedido(p);
    if (this.isOnline) await this.cloud.updatePrePedido(p).catch(console.error);
  }
  async deletePrePedido(id: string) {
    await this.local.deletePrePedido(id);
    if (this.isOnline) await this.cloud.deletePrePedido(id).catch(console.error);
  }

  async getAllAlertas() { return this.local.getAllAlertas(); }
  async addAlerta(a: DBAlerta) {
    await this.local.addAlerta(a);
    if (this.isOnline) await this.cloud.addAlerta(a).catch(console.error);
  }
  async updateAlerta(a: DBAlerta) {
    await this.local.updateAlerta(a);
    if (this.isOnline) await this.cloud.updateAlerta(a).catch(console.error);
  }
  async deleteAlerta(id: string) {
    await this.local.deleteAlerta(id);
    if (this.isOnline) await this.cloud.deleteAlerta(id).catch(console.error);
  }
  async clearAllAlertas() {
    await this.local.clearAllAlertas();
    if (this.isOnline) await this.cloud.clearAllAlertas().catch(console.error);
  }

  async getConfiguracion() {
    const config = await this.local.getConfiguracion();
    if (this.isOnline && !config) {
      const cloudConfig = await this.cloud.getConfiguracion();
      if (cloudConfig) await this.local.saveConfiguracion(cloudConfig);
      return cloudConfig;
    }
    return config;
  }
  async saveConfiguracion(c: DBConfiguracion) {
    await this.local.saveConfiguracion(c);
    if (this.isOnline) await this.cloud.saveConfiguracion(c).catch(console.error);
  }

  async getAllInventario() { return this.local.getAllInventario(); }
  async getInventarioItemByProducto(pid: string) { return this.local.getInventarioItemByProducto(pid); }
  async updateInventarioItem(i: DBInventarioItem) {
    await this.local.updateInventarioItem(i);
    if (this.isOnline) await this.cloud.updateInventarioItem(i).catch(console.error);
  }

  async getAllMovimientos() { return this.local.getAllMovimientos(); }
  async addMovimiento(m: DBMovimientoInventario) {
    await this.local.addMovimiento(m);
    if (this.isOnline) await this.cloud.addMovimiento(m).catch(console.error);
  }

  async getAllRecepciones() { return this.local.getAllRecepciones(); }
  async addRecepcion(r: DBRecepcion) {
    await this.local.addRecepcion(r);
    if (this.isOnline) await this.cloud.addRecepcion(r).catch(console.error);
  }
  async updateRecepcion(r: DBRecepcion) {
    await this.local.updateRecepcion(r);
    if (this.isOnline) await this.cloud.updateRecepcion(r).catch(console.error);
  }

  async getAllHistorial() { return this.local.getAllHistorial(); }
  async addHistorial(h: DBHistorialPrecio) {
    await this.local.addHistorial(h);
    if (this.isOnline) await this.cloud.addHistorial(h).catch(console.error);
  }
  async getHistorialByProducto(pid: string) { return this.local.getHistorialByProducto(pid); }

  async clearAll() {
    await this.local.clearAll();
    // Cloud clear is omitted for security
  }
}

// Factory to choose which DB to use (Always Hybrid if Supabase configured)
const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export const db: IDatabase = hasSupabase
  ? new HybridDatabase()
  : new IndexedDBDatabase();
