import { SupabaseDatabase } from './supabase-db';

// Interfaces Definition
export interface DBProducto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  precioVenta: number;
  margenUtilidad: number;
  tipo: 'ingrediente' | 'elaborado';
  costoBase?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBReceta {
  id: string;
  productoId: string;
  ingredientes: {
    productoId: string;
    cantidad: number;
    unidad: string;
  }[];
  porcionesResultantes: number;
  instrucciones?: string;
  fechaActualizacion: string;
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

export interface DBVentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface DBVenta {
  id: string;
  cajaId?: string;
  items: DBVentaItem[];
  total: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
  usuarioId: string;
  cliente?: string;
  notas?: string;
  fecha: string;
}

export interface DBCajaSesion {
  id: string;
  usuarioId: string;
  fechaApertura: string;
  fechaCierre?: string;
  montoApertura: number;
  montoCierre?: number;
  totalVentas: number;
  ventasIds: string[];
  estado: 'abierta' | 'cerrada';
}

export interface DBGasto {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  proveedorId?: string;
  comprobanteUrl?: string;
  metodoPago: string;
  usuarioId: string;
  cajaId?: string;
  metadata?: {
    carpeta: string;
    nombreArchivo: string;
    etiquetas: string[];
  };
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

  // Recetas
  getAllRecetas(): Promise<DBReceta[]>;
  getRecetaByProducto(productoId: string): Promise<DBReceta | undefined>;
  addReceta(receta: DBReceta): Promise<void>;
  updateReceta(receta: DBReceta): Promise<void>;
  deleteReceta(id: string): Promise<void>;

  // Ventas
  getAllVentas(): Promise<DBVenta[]>;
  addVenta(venta: DBVenta): Promise<void>;
  getVentasByCaja(cajaId: string): Promise<DBVenta[]>;

  // Caja
  getAllSesionesCaja(): Promise<DBCajaSesion[]>;
  getSesionCajaActiva(): Promise<DBCajaSesion | undefined>;
  addSesionCaja(sesion: DBCajaSesion): Promise<void>;
  updateSesionCaja(sesion: DBCajaSesion): Promise<void>;

  // Ahorros
  getAllAhorros(): Promise<any[]>;
  addAhorro(ahorro: any): Promise<void>;
  updateAhorro(ahorro: any): Promise<void>;
  deleteAhorro(id: string): Promise<void>;

  // Mesas
  getAllMesas(): Promise<any[]>;
  updateMesa(mesa: any): Promise<void>;

  // Pedidos Activos
  getAllPedidosActivos(): Promise<any[]>;
  addPedidoActivo(pedido: any): Promise<void>;
  updatePedidoActivo(pedido: any): Promise<void>;
  deletePedidoActivo(id: string): Promise<void>;

  // Gastos
  getAllGastos(): Promise<DBGasto[]>;
  addGasto(gasto: DBGasto): Promise<void>;
  updateGasto(gasto: DBGasto): Promise<void>;
  deleteGasto(id: string): Promise<void>;

  clearAll(): Promise<void>;

  syncLocalToCloud?(): Promise<void>;
  syncCloudToLocal?(): Promise<void>;
}

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 11; // Incrementado para incluir gastos y facturación

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
        if (!db.objectStoreNames.contains('recetas')) {
          const s = db.createObjectStore('recetas', { keyPath: 'id' });
          s.createIndex('productoId', 'productoId', { unique: true });
        }
        if (!db.objectStoreNames.contains('ventas')) {
          const s = db.createObjectStore('ventas', { keyPath: 'id' });
          s.createIndex('cajaId', 'cajaId', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!db.objectStoreNames.contains('caja')) {
          const s = db.createObjectStore('caja', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('fechaApertura', 'fechaApertura', { unique: false });
        }
        if (!db.objectStoreNames.contains('ahorros')) {
          const s = db.createObjectStore('ahorros', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
        }
        if (!db.objectStoreNames.contains('mesas')) {
          const s = db.createObjectStore('mesas', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
        }
        if (!db.objectStoreNames.contains('pedidos_activos')) {
          const s = db.createObjectStore('pedidos_activos', { keyPath: 'id' });
          s.createIndex('mesaId', 'mesaId', { unique: false });
          s.createIndex('estado', 'estado', { unique: false });
        }
        if (!db.objectStoreNames.contains('gastos')) {
          const s = db.createObjectStore('gastos', { keyPath: 'id' });
          s.createIndex('categoria', 'categoria', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
          s.createIndex('cajaId', 'cajaId', { unique: false });
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

  // Recetas Implementation
  async getAllRecetas(): Promise<DBReceta[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recetas'], 'readonly').objectStore('recetas').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getRecetaByProducto(productoId: string): Promise<DBReceta | undefined> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recetas'], 'readonly').objectStore('recetas').index('productoId').get(productoId);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addReceta(r: DBReceta): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recetas'], 'readwrite').objectStore('recetas').add(r);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateReceta(r: DBReceta): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recetas'], 'readwrite').objectStore('recetas').put(r);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteReceta(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['recetas'], 'readwrite').objectStore('recetas').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Ventas Implementation
  async getAllVentas(): Promise<DBVenta[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ventas'], 'readonly').objectStore('ventas').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addVenta(v: DBVenta): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ventas'], 'readwrite').objectStore('ventas').add(v);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async getVentasByCaja(cajaId: string): Promise<DBVenta[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ventas'], 'readonly').objectStore('ventas').index('cajaId').getAll(cajaId);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }

  // Caja Implementation
  async getAllSesionesCaja(): Promise<DBCajaSesion[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['caja'], 'readonly').objectStore('caja').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async getSesionCajaActiva(): Promise<DBCajaSesion | undefined> {
    const sesiones = await this.getAllSesionesCaja();
    return sesiones.find(s => s.estado === 'abierta');
  }
  async addSesionCaja(s: DBCajaSesion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['caja'], 'readwrite').objectStore('caja').add(s);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateSesionCaja(s: DBCajaSesion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['caja'], 'readwrite').objectStore('caja').put(s);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Ahorros Implementation
  async getAllAhorros(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ahorros'], 'readonly').objectStore('ahorros').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async addAhorro(ahorro: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ahorros'], 'readwrite').objectStore('ahorros').add(ahorro);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateAhorro(ahorro: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ahorros'], 'readwrite').objectStore('ahorros').put(ahorro);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteAhorro(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['ahorros'], 'readwrite').objectStore('ahorros').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Mesas Implementation
  async getAllMesas(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['mesas'], 'readonly').objectStore('mesas').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async updateMesa(mesa: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['mesas'], 'readwrite').objectStore('mesas').put(mesa);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Pedidos Activos Implementation
  async getAllPedidosActivos(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['pedidos_activos'], 'readonly').objectStore('pedidos_activos').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async addPedidoActivo(pedido: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['pedidos_activos'], 'readwrite').objectStore('pedidos_activos').add(pedido);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updatePedidoActivo(pedido: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['pedidos_activos'], 'readwrite').objectStore('pedidos_activos').put(pedido);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deletePedidoActivo(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['pedidos_activos'], 'readwrite').objectStore('pedidos_activos').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Gastos Implementation
  async getAllGastos(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['gastos'], 'readonly').objectStore('gastos').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async addGasto(g: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['gastos'], 'readwrite').objectStore('gastos').add(g);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateGasto(g: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['gastos'], 'readwrite').objectStore('gastos').put(g);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteGasto(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['gastos'], 'readwrite').objectStore('gastos').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureInit();
    const stores = ['productos', 'proveedores', 'precios', 'prepedidos', 'alertas', 'configuracion', 'inventario', 'movimientos', 'recepciones', 'historialPrecios', 'recetas', 'ventas', 'caja', 'ahorros', 'mesas', 'pedidos_activos', 'gastos'];
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

    // Detección proactiva de conexión
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatusChange(true);
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOnlineStatusChange(false);
    });

    // Verificación inicial de internet real
    this.checkInternetConnection();
  }

  private async checkInternetConnection() {
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      this.isOnline = true;
      this.handleOnlineStatusChange(true);
    } catch (e) {
      this.isOnline = false;
      this.handleOnlineStatusChange(false);
    }
  }

  private handleOnlineStatusChange(online: boolean) {
    if (online) {
      console.log('🌐 Internet detectado - Iniciando sincronización diferida...');
      setTimeout(() => this.syncLocalToCloud(), 2000);
    } else {
      console.log('🔌 Trabajando en modo Offline...');
    }
  }

  async init(): Promise<void> {
    await this.local.init();
    this.cloud.init();
    if (this.isOnline) {
      this.syncCloudToLocal().catch(console.warn);
    }
  }

  public async syncCloudToLocal() {
    try {
      console.log('🔄 Sincronizando datos de la nube a local...');
      const tables = [
        { name: 'productos', fn: () => this.cloud.getAllProductos(), save: (d: any) => this.local.updateProducto(d) },
        { name: 'proveedores', fn: () => this.cloud.getAllProveedores(), save: (d: any) => this.local.updateProveedor(d) },
        { name: 'precios', fn: () => this.cloud.getAllPrecios(), save: (d: any) => this.local.updatePrecio(d) },
        { name: 'inventario', fn: () => this.cloud.getAllInventario(), save: (d: any) => this.local.updateInventarioItem(d) },
        { name: 'configuracion', fn: () => this.cloud.getConfiguracion(), save: (d: any) => this.local.saveConfiguracion(d), single: true },
        { name: 'alertas', fn: () => this.cloud.getAllAlertas(), save: (d: any) => this.local.updateAlerta(d) },
        { name: 'prepedidos', fn: () => this.cloud.getAllPrePedidos(), save: (d: any) => this.local.updatePrePedido(d) },
        { name: 'recepciones', fn: () => this.cloud.getAllRecepciones(), save: (d: any) => this.local.updateRecepcion(d) },
        { name: 'historialPrecios', fn: () => this.cloud.getAllHistorial(), save: (d: any) => this.local.addHistorial(d) },
        { name: 'recetas', fn: () => this.cloud.getAllRecetas(), save: (d: any) => this.local.updateReceta(d) },
        { name: 'ventas', fn: () => this.cloud.getAllVentas(), save: (d: any) => this.local.addVenta(d) },
        { name: 'caja', fn: () => this.cloud.getAllSesionesCaja(), save: (d: any) => this.local.updateSesionCaja(d) }
      ];

      for (const table of tables) {
        try {
          const data = await table.fn();
          if (data) {
            if (table.single) {
              await table.save(data);
            } else if (Array.isArray(data)) {
              for (const item of data) {
                await table.save(item).catch(() => { });
              }
            }
          }
        } catch (err) {
          console.warn(`⚠️ Error sincronizando tabla ${table.name}:`, err);
        }
      }
      console.log('✅ Sincronización Nube -> Local completada.');
    } catch (e) {
      console.warn('⚠️ Sync cloud to local failed:', e);
    }
  }

  public async syncLocalToCloud() {
    if (!this.isOnline) return;
    console.log('🚀 Sincronizando cambios locales con la nube...');
    try {
      const productos = await this.local.getAllProductos();
      for (const p of productos) await this.cloud.updateProducto(p).catch(() => this.cloud.addProducto(p));
      const proveedores = await this.local.getAllProveedores();
      for (const p of proveedores) await this.cloud.updateProveedor(p).catch(() => this.cloud.addProveedor(p));
      const precios = await this.local.getAllPrecios();
      for (const p of precios) await this.cloud.updatePrecio(p).catch(() => this.cloud.addPrecio(p));
      const inventario = await this.local.getAllInventario();
      for (const i of inventario) await this.cloud.updateInventarioItem(i);
      const config = await this.local.getConfiguracion();
      if (config) await this.cloud.saveConfiguracion(config);
      const [alertas, movimientos, prepedidos, recepciones, historial, recetas, ventas, sesiones] = await Promise.all([
        this.local.getAllAlertas(),
        this.local.getAllMovimientos(),
        this.local.getAllPrePedidos(),
        this.local.getAllRecepciones(),
        this.local.getAllHistorial(),
        this.local.getAllRecetas(),
        this.local.getAllVentas(),
        this.local.getAllSesionesCaja()
      ]);
      for (const a of alertas) await this.cloud.updateAlerta(a).catch(() => this.cloud.addAlerta(a));
      for (const m of movimientos) await this.cloud.addMovimiento(m);
      for (const p of prepedidos) await this.cloud.updatePrePedido(p).catch(() => this.cloud.addPrePedido(p));
      for (const r of recepciones) await this.cloud.updateRecepcion(r).catch(() => this.cloud.addRecepcion(r));
      for (const h of historial) await this.cloud.addHistorial(h).catch(() => { });
      for (const re of recetas) await this.cloud.updateReceta(re).catch(() => this.cloud.addReceta(re));
      for (const v of ventas) await this.cloud.addVenta(v).catch(() => { });
      for (const s of sesiones) await this.cloud.updateSesionCaja(s).catch(() => this.cloud.addSesionCaja(s));
      console.log('✅ Sincronización Local -> Nube Exitosa.');
    } catch (e) {
      console.error('❌ Error en sincronización Local a Nube:', e);
    }
  }

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

  async getConfiguracion() { return this.local.getConfiguracion(); }
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
    if (this.isOnline) await this.cloud.addHistorial(h).catch(() => { });
  }
  async getHistorialByProducto(pid: string) { return this.local.getHistorialByProducto(pid); }

  // Recetas Hybrid
  async getAllRecetas() { return this.local.getAllRecetas(); }
  async getRecetaByProducto(productoId: string) { return this.local.getRecetaByProducto(productoId); }
  async addReceta(r: DBReceta) {
    await this.local.addReceta(r);
    if (this.isOnline) await this.cloud.addReceta(r).catch(console.error);
  }
  async updateReceta(r: DBReceta) {
    await this.local.updateReceta(r);
    if (this.isOnline) await this.cloud.updateReceta(r).catch(console.error);
  }
  async deleteReceta(id: string) {
    await this.local.deleteReceta(id);
    if (this.isOnline) await this.cloud.deleteReceta(id).catch(console.error);
  }

  // Ventas Hybrid
  async getAllVentas() { return this.local.getAllVentas(); }
  async addVenta(v: DBVenta) {
    await this.local.addVenta(v);
    if (this.isOnline) await this.cloud.addVenta(v).catch(console.error);
  }
  async getVentasByCaja(cajaId: string) { return this.local.getVentasByCaja(cajaId); }

  // Caja Hybrid
  async getAllSesionesCaja() { return this.local.getAllSesionesCaja(); }
  async getSesionCajaActiva() { return this.local.getSesionCajaActiva(); }
  async addSesionCaja(s: DBCajaSesion) {
    await this.local.addSesionCaja(s);
    if (this.isOnline) await this.cloud.addSesionCaja(s).catch(console.error);
  }
  async updateSesionCaja(s: DBCajaSesion) {
    await this.local.updateSesionCaja(s);
    if (this.isOnline) await this.cloud.updateSesionCaja(s).catch(console.error);
  }

  // Ahorros Hybrid
  async getAllAhorros() { return this.local.getAllAhorros(); }
  async addAhorro(a: any) {
    await this.local.addAhorro(a);
    if (this.isOnline) await this.cloud.addAhorro(a).catch(console.error);
  }
  async updateAhorro(a: any) {
    await this.local.updateAhorro(a);
    if (this.isOnline) await this.cloud.updateAhorro(a).catch(console.error);
  }
  async deleteAhorro(id: string) {
    await this.local.deleteAhorro(id);
    if (this.isOnline) await this.cloud.deleteAhorro(id).catch(console.error);
  }

  // Mesas Hybrid
  async getAllMesas() { return this.local.getAllMesas(); }
  async updateMesa(m: any) {
    await this.local.updateMesa(m);
    // Para simplificar, asumimos que mesas se sincronizan si existen en cloud, sino fallará silenciosamente
    if (this.isOnline) await (this.cloud as any).updateMesa?.(m).catch(() => { });
  }

  // Pedidos Activos Hybrid
  async getAllPedidosActivos() { return this.local.getAllPedidosActivos(); }
  async addPedidoActivo(p: any) {
    await this.local.addPedidoActivo(p);
    if (this.isOnline) await (this.cloud as any).addPedidoActivo?.(p).catch(() => { });
  }
  async updatePedidoActivo(p: any) {
    await this.local.updatePedidoActivo(p);
    if (this.isOnline) await (this.cloud as any).updatePedidoActivo?.(p).catch(() => { });
  }
  async deletePedidoActivo(id: string) {
    await this.local.deletePedidoActivo(id);
    if (this.isOnline) await this.cloud.deletePedidoActivo(id).catch(console.error);
  }

  // Gastos Hybrid
  async getAllGastos() { return this.local.getAllGastos(); }
  async addGasto(g: DBGasto) {
    await this.local.addGasto(g);
    if (this.isOnline) await this.cloud.addGasto(g).catch(console.error);
  }
  async updateGasto(g: DBGasto) {
    await this.local.updateGasto(g);
    if (this.isOnline) await this.cloud.updateGasto(g).catch(console.error);
  }
  async deleteGasto(id: string) {
    await this.local.deleteGasto(id);
    if (this.isOnline) await this.cloud.deleteGasto(id).catch(console.error);
  }

  async clearAll() { await this.local.clearAll(); }
}

export const db = new HybridDatabase();
