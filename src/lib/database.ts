// Base de datos IndexedDB para PriceControl Pro

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 6;

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

class PriceControlDatabase {
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

        // Store de Productos
        if (!db.objectStoreNames.contains('productos')) {
          const productosStore = db.createObjectStore('productos', { keyPath: 'id' });
          productosStore.createIndex('categoria', 'categoria', { unique: false });
          productosStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // Store de Proveedores
        if (!db.objectStoreNames.contains('proveedores')) {
          const proveedoresStore = db.createObjectStore('proveedores', { keyPath: 'id' });
          proveedoresStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // Store de Precios
        if (!db.objectStoreNames.contains('precios')) {
          const preciosStore = db.createObjectStore('precios', { keyPath: 'id' });
          preciosStore.createIndex('productoId', 'productoId', { unique: false });
          preciosStore.createIndex('proveedorId', 'proveedorId', { unique: false });
          preciosStore.createIndex('productoProveedor', ['productoId', 'proveedorId'], { unique: true });
        }

        // Store de Pre-Pedidos
        if (!db.objectStoreNames.contains('prepedidos')) {
          const prepedidosStore = db.createObjectStore('prepedidos', { keyPath: 'id' });
          prepedidosStore.createIndex('proveedorId', 'proveedorId', { unique: false });
          prepedidosStore.createIndex('estado', 'estado', { unique: false });
        }

        // Store de Alertas
        if (!db.objectStoreNames.contains('alertas')) {
          const alertasStore = db.createObjectStore('alertas', { keyPath: 'id' });
          alertasStore.createIndex('leida', 'leida', { unique: false });
          alertasStore.createIndex('fecha', 'fecha', { unique: false });
        }

        // Store de Configuración
        if (!db.objectStoreNames.contains('configuracion')) {
          db.createObjectStore('configuracion', { keyPath: 'id' });
        }

        // Store de Inventario
        if (!db.objectStoreNames.contains('inventario')) {
          const inventarioStore = db.createObjectStore('inventario', { keyPath: 'id' });
          inventarioStore.createIndex('productoId', 'productoId', { unique: true });
        }

        // Store de Movimientos
        if (!db.objectStoreNames.contains('movimientos')) {
          const movimientosStore = db.createObjectStore('movimientos', { keyPath: 'id' });
          movimientosStore.createIndex('productoId', 'productoId', { unique: false });
          movimientosStore.createIndex('fecha', 'fecha', { unique: false });
        }

        // Store de Recepciones
        if (!db.objectStoreNames.contains('recepciones')) {
          const recepcionesStore = db.createObjectStore('recepciones', { keyPath: 'id' });
          recepcionesStore.createIndex('proveedorId', 'proveedorId', { unique: false });
          recepcionesStore.createIndex('fechaRecepcion', 'fechaRecepcion', { unique: false });
        }

        // Store de Historial de Precios
        if (!db.objectStoreNames.contains('historialPrecios')) {
          const historialStore = db.createObjectStore('historialPrecios', { keyPath: 'id' });
          historialStore.createIndex('productoId', 'productoId', { unique: false });
          historialStore.createIndex('proveedorId', 'proveedorId', { unique: false });
          historialStore.createIndex('fechaCambio', 'fechaCambio', { unique: false });
        }
      };
    });
  }

  // Productos
  async getAllProductos(): Promise<DBProducto[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productos'], 'readonly');
      const store = transaction.objectStore('productos');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addProducto(producto: DBProducto): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productos'], 'readwrite');
      const store = transaction.objectStore('productos');
      const request = store.add(producto);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateProducto(producto: DBProducto): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productos'], 'readwrite');
      const store = transaction.objectStore('productos');
      const request = store.put(producto);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProducto(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productos'], 'readwrite');
      const store = transaction.objectStore('productos');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Proveedores
  async getAllProveedores(): Promise<DBProveedor[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['proveedores'], 'readonly');
      const store = transaction.objectStore('proveedores');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addProveedor(proveedor: DBProveedor): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['proveedores'], 'readwrite');
      const store = transaction.objectStore('proveedores');
      const request = store.add(proveedor);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateProveedor(proveedor: DBProveedor): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['proveedores'], 'readwrite');
      const store = transaction.objectStore('proveedores');
      const request = store.put(proveedor);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProveedor(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['proveedores'], 'readwrite');
      const store = transaction.objectStore('proveedores');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Precios
  async getAllPrecios(): Promise<DBPrecio[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readonly');
      const store = transaction.objectStore('precios');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPreciosByProducto(productoId: string): Promise<DBPrecio[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readonly');
      const store = transaction.objectStore('precios');
      const index = store.index('productoId');
      const request = index.getAll(productoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPreciosByProveedor(proveedorId: string): Promise<DBPrecio[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readonly');
      const store = transaction.objectStore('precios');
      const index = store.index('proveedorId');
      const request = index.getAll(proveedorId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPrecioByProductoProveedor(productoId: string, proveedorId: string): Promise<DBPrecio | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readonly');
      const store = transaction.objectStore('precios');
      const index = store.index('productoProveedor');
      const request = index.get([productoId, proveedorId]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addPrecio(precio: DBPrecio): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readwrite');
      const store = transaction.objectStore('precios');
      const request = store.add(precio);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updatePrecio(precio: DBPrecio): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readwrite');
      const store = transaction.objectStore('precios');
      const request = store.put(precio);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePrecio(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['precios'], 'readwrite');
      const store = transaction.objectStore('precios');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Pre-Pedidos
  async getAllPrePedidos(): Promise<DBPrePedido[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['prepedidos'], 'readonly');
      const store = transaction.objectStore('prepedidos');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addPrePedido(prepedido: DBPrePedido): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['prepedidos'], 'readwrite');
      const store = transaction.objectStore('prepedidos');
      const request = store.add(prepedido);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updatePrePedido(prepedido: DBPrePedido): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['prepedidos'], 'readwrite');
      const store = transaction.objectStore('prepedidos');
      const request = store.put(prepedido);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePrePedido(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['prepedidos'], 'readwrite');
      const store = transaction.objectStore('prepedidos');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Alertas
  async getAllAlertas(): Promise<DBAlerta[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['alertas'], 'readonly');
      const store = transaction.objectStore('alertas');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addAlerta(alerta: DBAlerta): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['alertas'], 'readwrite');
      const store = transaction.objectStore('alertas');
      const request = store.add(alerta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateAlerta(alerta: DBAlerta): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['alertas'], 'readwrite');
      const store = transaction.objectStore('alertas');
      const request = store.put(alerta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAlerta(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['alertas'], 'readwrite');
      const store = transaction.objectStore('alertas');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllAlertas(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['alertas'], 'readwrite');
      const store = transaction.objectStore('alertas');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Configuración
  async getConfiguracion(): Promise<DBConfiguracion | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['configuracion'], 'readonly');
      const store = transaction.objectStore('configuracion');
      const request = store.get('main');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveConfiguracion(config: DBConfiguracion): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['configuracion'], 'readwrite');
      const store = transaction.objectStore('configuracion');
      const request = store.put({ ...config, id: 'main' });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Inventario
  async getAllInventario(): Promise<DBInventarioItem[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['inventario'], 'readonly');
      const store = transaction.objectStore('inventario');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getInventarioItemByProducto(productoId: string): Promise<DBInventarioItem | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['inventario'], 'readonly');
      const store = transaction.objectStore('inventario');
      const index = store.index('productoId');
      const request = index.get(productoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateInventarioItem(item: DBInventarioItem): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['inventario'], 'readwrite');
      const store = transaction.objectStore('inventario');
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Movimientos
  async getAllMovimientos(): Promise<DBMovimientoInventario[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['movimientos'], 'readonly');
      const store = transaction.objectStore('movimientos');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addMovimiento(movimiento: DBMovimientoInventario): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['movimientos'], 'readwrite');
      const store = transaction.objectStore('movimientos');
      const request = store.add(movimiento);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Recepciones
  async getAllRecepciones(): Promise<DBRecepcion[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recepciones'], 'readonly');
      const store = transaction.objectStore('recepciones');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addRecepcion(recepcion: DBRecepcion): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recepciones'], 'readwrite');
      const store = transaction.objectStore('recepciones');
      const request = store.add(recepcion);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateRecepcion(recepcion: DBRecepcion): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recepciones'], 'readwrite');
      const store = transaction.objectStore('recepciones');
      const request = store.put(recepcion);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Historial de Precios
  async getAllHistorial(): Promise<DBHistorialPrecio[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['historialPrecios'], 'readonly');
      const store = transaction.objectStore('historialPrecios');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addHistorial(entry: DBHistorialPrecio): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['historialPrecios'], 'readwrite');
      const store = transaction.objectStore('historialPrecios');
      const request = store.add(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getHistorialByProducto(productoId: string): Promise<DBHistorialPrecio[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['historialPrecios'], 'readonly');
      const store = transaction.objectStore('historialPrecios');
      const index = store.index('productoId');
      const request = index.getAll(productoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Limpiar toda la base de datos
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    const stores = ['productos', 'proveedores', 'precios', 'prepedidos', 'alertas', 'configuracion', 'inventario', 'movimientos', 'recepciones', 'historialPrecios'];
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const db = new PriceControlDatabase();
