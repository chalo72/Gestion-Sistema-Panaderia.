import { SupabaseDatabase } from './supabase-db';

// Base de datos IndexedDB para PriceControl Pro
// ... (IndexedDB implementation remains here, renamed to IndexedDBDatabase) ...
// For brevity, I will output the file content directly in the tool call if possible, 
// but since I'm in 'write_to_file', I will write the full hybrid adapter.

// However, to avoid huge file duplication in the prompt context, I will use `replace_file_content` 
// to rename the class and add the factory export. 
// Wait, I can't use replace_file_content to rewrite the whole structure easily if I want to keep the old code.
// I will write the new content fully.

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 6;

// Export interfaces (same as before)
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
  usuario: string; // ID o nombre del usuario que hizo el movimiento
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
  imagenFactura?: string; // Base64 string of the invoice image
}

export interface DBHistorialPrecio {
  id: string;
  productoId: string;
  proveedorId: string;
  precioAnterior: number;
  precioNuevo: number;
  fechaCambio: string;
}

// Define Interface for the Database Adapter
export interface IDatabase {
  init(): Promise<void>;

  // Productos
  getAllProductos(): Promise<DBProducto[]>;
  addProducto(producto: DBProducto): Promise<void>;
  updateProducto(producto: DBProducto): Promise<void>;
  deleteProducto(id: string): Promise<void>;

  // Proveedores
  getAllProveedores(): Promise<DBProveedor[]>;
  addProveedor(proveedor: DBProveedor): Promise<void>;
  updateProveedor(proveedor: DBProveedor): Promise<void>;
  deleteProveedor(id: string): Promise<void>;

  // Precios
  getAllPrecios(): Promise<DBPrecio[]>;
  getPreciosByProducto(productoId: string): Promise<DBPrecio[]>;
  getPreciosByProveedor(proveedorId: string): Promise<DBPrecio[]>;
  getPrecioByProductoProveedor(productoId: string, proveedorId: string): Promise<DBPrecio | undefined>;
  addPrecio(precio: DBPrecio): Promise<void>;
  updatePrecio(precio: DBPrecio): Promise<void>;
  deletePrecio(id: string): Promise<void>;

  // Pre-Pedidos
  getAllPrePedidos(): Promise<DBPrePedido[]>;
  addPrePedido(prepedido: DBPrePedido): Promise<void>;
  updatePrePedido(prepedido: DBPrePedido): Promise<void>;
  deletePrePedido(id: string): Promise<void>;

  // Alertas
  getAllAlertas(): Promise<DBAlerta[]>;
  addAlerta(alerta: DBAlerta): Promise<void>;
  updateAlerta(alerta: DBAlerta): Promise<void>;
  deleteAlerta(id: string): Promise<void>;
  clearAllAlertas(): Promise<void>;

  // Configuración
  getConfiguracion(): Promise<DBConfiguracion | undefined>;
  saveConfiguracion(config: DBConfiguracion): Promise<void>;

  // Inventario
  getAllInventario(): Promise<DBInventarioItem[]>;
  getInventarioItemByProducto(productoId: string): Promise<DBInventarioItem | undefined>;
  updateInventarioItem(item: DBInventarioItem): Promise<void>;

  // Movimientos
  getAllMovimientos(): Promise<DBMovimientoInventario[]>;
  addMovimiento(movimiento: DBMovimientoInventario): Promise<void>;

  // Recepciones
  getAllRecepciones(): Promise<DBRecepcion[]>;
  addRecepcion(recepcion: DBRecepcion): Promise<void>;
  updateRecepcion(recepcion: DBRecepcion): Promise<void>;

  // Historial
  getAllHistorial(): Promise<DBHistorialPrecio[]>;
  addHistorial(entry: DBHistorialPrecio): Promise<void>;
  getHistorialByProducto(productoId: string): Promise<DBHistorialPrecio[]>;

  clearAll(): Promise<void>;
}

class IndexedDBDatabase implements IDatabase {
  private db: IDBDatabase | null = null;
  // ... (Existing IndexedDB implementation) ...
  // Re-pasting the exact implementation from previous view_file content to ensure no regression
  // But omitting for brevity in this task description, will implement in the actual tool call

  // Actually, I can't "omit" in the tool call `write_to_file`. I have to write the whole thing.
  // Since I have the content from `view_file` (Step 209), I will use that.

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

  // Helper to ensure DB is initialized
  private async ensureInit() {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database failed to initialize');
    return this.db;
  }

  // --- Implementación de métodos (Copy-paste logic but wrapped) ---
  // Productos
  async getAllProductos(): Promise<DBProducto[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['productos'], 'readonly').objectStore('productos').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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

  // Proveedores
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

  // Precios
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

  // Pre-Pedidos
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

  // Alertas
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

  // Config
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

  // Inventario
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

  // Movimientos
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

  // Recepciones
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

  // Historial
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
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// Factory to choose which DB to use
const shouldUseSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export const db: IDatabase = shouldUseSupabase
  ? new SupabaseDatabase()
  : new IndexedDBDatabase();
