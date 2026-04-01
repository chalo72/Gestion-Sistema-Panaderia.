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

export interface DBOrdenProduccion {
  id: string;
  productoId: string;
  cantidadPlaneada: number;
  cantidadCompletada: number;
  estado: 'planeado' | 'en_proceso' | 'completado' | 'cancelado';
  fechaInicio: string;
  fechaFin?: string;
  usuarioId: string;
  notas?: string;
  lote?: string;
  costoEstimadoTotal: number;
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
  deleteMesa(id: string): Promise<void>;

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

  // Producción
  getAllOrdenesProduccion(): Promise<DBOrdenProduccion[]>;
  addOrdenProduccion(orden: DBOrdenProduccion): Promise<void>;
  updateOrdenProduccion(orden: DBOrdenProduccion): Promise<void>;
  deleteOrdenProduccion(id: string): Promise<void>;

  // Facturas Escaneadas (Archivo de Imágenes)
  getAllFacturasEscaneadas(): Promise<any[]>;
  addFacturaEscaneada(factura: any): Promise<void>;
  deleteFacturaEscaneada(id: string): Promise<void>;
  getFacturasEscaneadasByProveedor(proveedorId: string): Promise<any[]>;
  getFacturasEscaneadasByFecha(fechaInicio: string, fechaFin: string): Promise<any[]>;

  // Préstamos entre Cajas
  getAllPrestamosCaja(): Promise<any[]>;
  addPrestamoCaja(prestamo: any): Promise<void>;
  updatePrestamoCaja(prestamo: any): Promise<void>;

  clearAll(): Promise<void>;

  syncLocalToCloud?(): Promise<void>;
  syncCloudToLocal?(): Promise<void>;
}

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 14; // Incrementado para incluir prestamos_caja

class IndexedDBDatabase implements IDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    console.log(`💽 IndexedDB: Starting init (v${DB_VERSION})...`);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onblocked = () => {
        console.warn("⚠️ IndexedDB: Connection blocked! Please close other tabs of this app.");
        alert("⚠️ Por favor, cierra otras pestañas de la aplicación para actualizar la base de datos.");
      };
      request.onerror = () => {
        console.error("❌ IndexedDB: Error opening DB", request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log("✅ IndexedDB: DB opened successfully");
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        console.log("🔄 IndexedDB: Upgrade needed...");
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
        if (!db.objectStoreNames.contains('produccion')) {
          const s = db.createObjectStore('produccion', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('productoId', 'productoId', { unique: false });
          s.createIndex('fechaInicio', 'fechaInicio', { unique: false });
        }
        if (!db.objectStoreNames.contains('facturas_escaneadas')) {
          const s = db.createObjectStore('facturas_escaneadas', { keyPath: 'id' });
          s.createIndex('proveedorId', 'proveedorId', { unique: false });
          s.createIndex('fechaEscaneo', 'fechaEscaneo', { unique: false });
          s.createIndex('fechaFactura', 'fechaFactura', { unique: false });
          s.createIndex('recepcionId', 'recepcionId', { unique: false });
        }
        if (!db.objectStoreNames.contains('creditos_clientes')) {
          const s = db.createObjectStore('creditos_clientes', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
          s.createIndex('clienteNombre', 'clienteNombre', { unique: false });
        }
        if (!db.objectStoreNames.contains('trabajadores')) {
          const s = db.createObjectStore('trabajadores', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('rol', 'rol', { unique: false });
        }
        if (!db.objectStoreNames.contains('creditos_trabajadores')) {
          const s = db.createObjectStore('creditos_trabajadores', { keyPath: 'id' });
          s.createIndex('trabajadorId', 'trabajadorId', { unique: false });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos_caja')) {
          const s = db.createObjectStore('prestamos_caja', { keyPath: 'id' });
          s.createIndex('estado', 'estado', { unique: false });
          s.createIndex('fechaPrestamo', 'fechaPrestamo', { unique: false });
          s.createIndex('cajaOrigenId', 'cajaOrigenId', { unique: false });
          s.createIndex('cajaDestinoId', 'cajaDestinoId', { unique: false });
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
    if (!p.precioCosto || p.precioCosto <= 0) {
      throw new Error(`addPrecio: precioCosto debe ser mayor a 0 (recibido: ${p.precioCosto})`);
    }
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['precios'], 'readwrite').objectStore('precios').add(p);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        // Si el precio ya existe (ConstraintError por índice único), actualizar en vez de fallar
        if (req.error?.name === 'ConstraintError') {
          this.updatePrecio(p).then(resolve).catch(reject);
        } else {
          reject(req.error);
        }
      };
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
  async deleteMesa(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['mesas'], 'readwrite').objectStore('mesas').delete(id);
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

  // Producción Implementation
  async getAllOrdenesProduccion(): Promise<DBOrdenProduccion[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['produccion'], 'readonly').objectStore('produccion').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async addOrdenProduccion(orden: DBOrdenProduccion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['produccion'], 'readwrite').objectStore('produccion').add(orden);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateOrdenProduccion(orden: DBOrdenProduccion): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['produccion'], 'readwrite').objectStore('produccion').put(orden);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteOrdenProduccion(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['produccion'], 'readwrite').objectStore('produccion').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // === FACTURAS ESCANEADAS ===
  async getAllFacturasEscaneadas(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['facturas_escaneadas'], 'readonly').objectStore('facturas_escaneadas').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }

  async addFacturaEscaneada(factura: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['facturas_escaneadas'], 'readwrite').objectStore('facturas_escaneadas').add(factura);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async deleteFacturaEscaneada(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['facturas_escaneadas'], 'readwrite').objectStore('facturas_escaneadas').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async getFacturasEscaneadasByProveedor(proveedorId: string): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['facturas_escaneadas'], 'readonly');
      const store = tx.objectStore('facturas_escaneadas');
      const index = store.index('proveedorId');
      const req = index.getAll(proveedorId);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }

  async getFacturasEscaneadasByFecha(fechaInicio: string, fechaFin: string): Promise<any[]> {
    const all = await this.getAllFacturasEscaneadas();
    return all.filter(f => f.fechaEscaneo >= fechaInicio && f.fechaEscaneo <= fechaFin);
  }

  // Créditos a Clientes
  async getAllCreditosClientes(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_clientes'], 'readonly').objectStore('creditos_clientes').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addCreditoCliente(c: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_clientes'], 'readwrite').objectStore('creditos_clientes').add(c);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateCreditoCliente(c: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_clientes'], 'readwrite').objectStore('creditos_clientes').put(c);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteCreditoCliente(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_clientes'], 'readwrite').objectStore('creditos_clientes').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Créditos Trabajadores
  async getAllCreditosTrabajadores(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_trabajadores'], 'readonly').objectStore('creditos_trabajadores').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addCreditoTrabajador(c: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_trabajadores'], 'readwrite').objectStore('creditos_trabajadores').add(c);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateCreditoTrabajador(c: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_trabajadores'], 'readwrite').objectStore('creditos_trabajadores').put(c);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteCreditoTrabajador(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['creditos_trabajadores'], 'readwrite').objectStore('creditos_trabajadores').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Trabajadores
  async getAllTrabajadores(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['trabajadores'], 'readonly').objectStore('trabajadores').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async addTrabajador(t: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['trabajadores'], 'readwrite').objectStore('trabajadores').add(t);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updateTrabajador(t: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['trabajadores'], 'readwrite').objectStore('trabajadores').put(t);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async deleteTrabajador(id: string): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['trabajadores'], 'readwrite').objectStore('trabajadores').delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  // Préstamos entre Cajas
  async getAllPrestamosCaja(): Promise<any[]> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prestamos_caja'], 'readonly').objectStore('prestamos_caja').getAll();
      req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
  }
  async addPrestamoCaja(p: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prestamos_caja'], 'readwrite').objectStore('prestamos_caja').add(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  async updatePrestamoCaja(p: any): Promise<void> {
    const db = await this.ensureInit();
    return new Promise((resolve, reject) => {
      const req = db.transaction(['prestamos_caja'], 'readwrite').objectStore('prestamos_caja').put(p);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureInit();
    const stores = ['productos', 'proveedores', 'precios', 'prepedidos', 'alertas', 'configuracion', 'inventario', 'movimientos', 'recepciones', 'historialPrecios', 'recetas', 'ventas', 'caja', 'ahorros', 'mesas', 'pedidos_activos', 'gastos', 'produccion', 'creditos_clientes', 'trabajadores'];
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

  // --- Tombstone: registro de IDs eliminados localmente para evitar que la nube los restaure ---
  private readonly TOMBSTONE_KEY = 'pricecontrol_deleted_proveedores';

  private getTombstone(): Set<string> {
    try {
      const saved = localStorage.getItem(this.TOMBSTONE_KEY);
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  }

  private addTombstone(id: string) {
    const t = this.getTombstone();
    t.add(id);
    localStorage.setItem(this.TOMBSTONE_KEY, JSON.stringify([...t]));
  }

  private removeTombstone(id: string) {
    const t = this.getTombstone();
    t.delete(id);
    localStorage.setItem(this.TOMBSTONE_KEY, JSON.stringify([...t]));
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

      // LOCAL SIEMPRE GANA: cargar IDs locales antes de sincronizar.
      // Nunca sobreescribir con versiones de la nube — la nube puede tener datos más viejos.
      const [localProductos, localProveedores, localPrecios, localPrepedidos, localRecepciones, localGastos, localAhorros] = await Promise.all([
        this.local.getAllProductos().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllProveedores().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllPrecios().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllPrePedidos().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllRecepciones().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllGastos().then(arr => new Set(arr.map((p: any) => p.id))),
        this.local.getAllAhorros().then(arr => new Set(arr.map((p: any) => p.id))),
      ]);

      // Lápidas: IDs de proveedores eliminados localmente que la nube aún no ha procesado
      const tombstone = this.getTombstone();

      const tables = [
        // Para productos/proveedores/precios: SOLO agregar los que no existen localmente.
        // Esto protege los datos completos del local ante versiones reducidas de la nube.
        {
          name: 'productos',
          fn: () => this.cloud.getAllProductos(),
          save: (d: any) => localProductos.has(d.id) ? Promise.resolve() : this.local.updateProducto(d)
        },
        {
          name: 'proveedores',
          fn: () => this.cloud.getAllProveedores(),
          save: async (d: any) => {
            // Si este proveedor tiene lápida: fue eliminado localmente — borrarlo de la nube también
            if (tombstone.has(d.id)) {
              const eliminado = await this.cloud.deleteProveedor(d.id).then(() => true).catch(e => { console.error(e); return false; });
              if (eliminado) this.removeTombstone(d.id); // Solo quitar lápida si el delete en nube fue exitoso
              return;
            }
            // Si ya existe localmente: no sobreescribir (la nube tiene versión reducida)
            if (localProveedores.has(d.id)) return;
            return this.local.updateProveedor(d);
          }
        },
        {
          name: 'precios',
          fn: () => this.cloud.getAllPrecios(),
          save: (d: any) => localPrecios.has(d.id) ? Promise.resolve() : this.local.updatePrecio(d)
        },
        // LOCAL GANA para todos: solo agregar de la nube lo que NO existe localmente
        { name: 'inventario', fn: () => this.cloud.getAllInventario(), save: (d: any) => this.local.updateInventarioItem(d) },
        {
          name: 'configuracion', fn: () => this.cloud.getConfiguracion(),
          save: async (d: any) => {
            const localConfig = await this.local.getConfiguracion();
            if (localConfig) return; // LOCAL GANA: si ya existe config local, no sobreescribir
            return this.local.saveConfiguracion(d);
          },
          single: true
        },
        { name: 'alertas', fn: () => this.cloud.getAllAlertas(), save: (d: any) => this.local.updateAlerta(d) },
        { name: 'prepedidos', fn: () => this.cloud.getAllPrePedidos(), save: (d: any) => localPrepedidos.has(d.id) ? Promise.resolve() : this.local.updatePrePedido(d) },
        { name: 'recepciones', fn: () => this.cloud.getAllRecepciones(), save: (d: any) => localRecepciones.has(d.id) ? Promise.resolve() : this.local.updateRecepcion(d) },
        { name: 'historialPrecios', fn: () => this.cloud.getAllHistorial(), save: (d: any) => this.local.addHistorial(d) },
        { name: 'recetas', fn: () => this.cloud.getAllRecetas(), save: (d: any) => this.local.updateReceta(d) },
        { name: 'ventas', fn: () => this.cloud.getAllVentas(), save: (d: any) => this.local.addVenta(d) },
        { name: 'caja', fn: () => this.cloud.getAllSesionesCaja(), save: (d: any) => this.local.updateSesionCaja(d) },
        { name: 'gastos', fn: () => this.cloud.getAllGastos(), save: (d: any) => localGastos.has(d.id) ? Promise.resolve() : this.local.updateGasto(d) },
        { name: 'ahorros', fn: () => this.cloud.getAllAhorros(), save: (d: any) => localAhorros.has(d.id) ? Promise.resolve() : this.local.updateAhorro(d) },
        // Trabajadores y créditos — nuevos en sync v5.2
        { name: 'trabajadores', fn: () => this.cloud.getAllTrabajadores(), save: (d: any) => this.local.updateTrabajador(d) },
        { name: 'creditos_trabajadores', fn: () => this.cloud.getAllCreditosTrabajadores(), save: (d: any) => this.local.updateCreditoTrabajador(d) },
      ];

      for (const table of tables) {
        try {
          const data = await table.fn();
          if (data) {
            if ((table as any).single) {
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
    console.log('🚀 [Nexus-Volt] Iniciando sincronización robusta con la nube...');
    try {
      const logError = (table: string, id: string, err: any) => 
        console.warn(`⚠️ [Sync] Error en ${table} (ID: ${id}):`, err.message || err);

      const productos = await this.local.getAllProductos();
      for (const p of productos) 
        await this.cloud.updateProducto(p).catch(err => {
          logError('productos', p.id, err);
          return this.cloud.addProducto(p).catch(e => logError('productos-add', p.id, e));
        });

      const proveedores = await this.local.getAllProveedores();
      for (const p of proveedores) 
        await this.cloud.updateProveedor(p).catch(err => {
          logError('proveedores', p.id, err);
          return this.cloud.addProveedor(p).catch(e => logError('proveedores-add', p.id, e));
        });

      const precios = await this.local.getAllPrecios();
      for (const p of precios) 
        await this.cloud.updatePrecio(p).catch(err => {
          logError('precios', p.id, err);
          return this.cloud.addPrecio(p).catch(e => logError('precios-add', p.id, e));
        });

      const inventario = await this.local.getAllInventario();
      for (const i of inventario) await this.cloud.updateInventarioItem(i).catch(e => logError('inventario', i.id, e));

      const config = await this.local.getConfiguracion();
      if (config) await this.cloud.saveConfiguracion(config).catch(e => logError('config', 'main', e));

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

      // Sincronización atomizada para evitar bloqueos por fallos numéricos o de esquema
      for (const a of alertas) await this.cloud.updateAlerta(a).catch(e => logError('alertas', a.id, e));
      for (const m of movimientos) await this.cloud.addMovimiento(m).catch(e => logError('movimientos', m.id, e));
      for (const p of prepedidos) await this.cloud.updatePrePedido(p).catch(e => logError('prepedidos', p.id, e));
      for (const r of recepciones) await this.cloud.updateRecepcion(r).catch(e => logError('recepciones', r.id, e));
      for (const h of historial) await this.cloud.addHistorial(h).catch(() => { });
      for (const re of recetas) await this.cloud.updateReceta(re).catch(e => logError('recetas', re.id, e));
      for (const v of ventas) await this.cloud.addVenta(v).catch(() => { });
      for (const s of sesiones) await this.cloud.updateSesionCaja(s).catch(() => { });

      const [trabajadores, creditosTrabajadores] = await Promise.all([
        this.local.getAllTrabajadores(),
        this.local.getAllCreditosTrabajadores(),
      ]);
      for (const t of trabajadores) await this.cloud.updateTrabajador(t).catch(e => logError('trabajadores', t.id, e));
      for (const c of creditosTrabajadores) await this.cloud.updateCreditoTrabajador(c).catch(e => logError('creditos', c.id, e));

      console.log('✅ [Nexus-Volt] Sincronización Local -> Nube Completada (con protección de errores).');
    } catch (e) {
      console.error('❌ Error crítico en orquestación de sincronización:', e);
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
    // Marcar como eliminado para que syncCloudToLocal no lo restaure si la nube falla
    this.addTombstone(id);
    if (this.isOnline) {
      try {
        await this.cloud.deleteProveedor(id);
        this.removeTombstone(id); // Eliminado de la nube con éxito — limpiar lápida
      } catch (e) {
        console.error('⚠️ Error eliminando proveedor de la nube (se reintentará al sincronizar):', e);
        // La lápida queda activa para el próximo syncCloudToLocal
      }
    }
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
    if (this.isOnline) await (this.cloud as any).updateMesa?.(m).catch(() => { });
  }
  async deleteMesa(id: string) {
    await this.local.deleteMesa(id);
    if (this.isOnline) await (this.cloud as any).deleteMesa?.(id).catch(console.error);
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

  // Producción Hybrid
  async getAllOrdenesProduccion() { return this.local.getAllOrdenesProduccion(); }
  async addOrdenProduccion(o: DBOrdenProduccion) {
    await this.local.addOrdenProduccion(o);
    if (this.isOnline) await (this.cloud as any).addOrdenProduccion?.(o).catch(() => { });
  }
  async updateOrdenProduccion(o: DBOrdenProduccion) {
    await this.local.updateOrdenProduccion(o);
    if (this.isOnline) await (this.cloud as any).updateOrdenProduccion?.(o).catch(() => { });
  }
  async deleteOrdenProduccion(id: string) {
    await this.local.deleteOrdenProduccion(id);
    if (this.isOnline) await (this.cloud as any).deleteOrdenProduccion?.(id).catch(() => { });
  }

  // Facturas Escaneadas Hybrid (Solo local - las imágenes son pesadas para sync)
  async getAllFacturasEscaneadas() { return this.local.getAllFacturasEscaneadas(); }
  async addFacturaEscaneada(f: any) { await this.local.addFacturaEscaneada(f); }
  async deleteFacturaEscaneada(id: string) { await this.local.deleteFacturaEscaneada(id); }
  async getFacturasEscaneadasByProveedor(proveedorId: string) { return this.local.getFacturasEscaneadasByProveedor(proveedorId); }
  async getFacturasEscaneadasByFecha(fechaInicio: string, fechaFin: string) { return this.local.getFacturasEscaneadasByFecha(fechaInicio, fechaFin); }

  // Créditos a Clientes Hybrid
  async getAllCreditosClientes() { return this.local.getAllCreditosClientes(); }
  async addCreditoCliente(c: any) { await this.local.addCreditoCliente(c); }
  async updateCreditoCliente(c: any) { await this.local.updateCreditoCliente(c); }
  async deleteCreditoCliente(id: string) { await this.local.deleteCreditoCliente(id); }

  // Créditos Trabajadores Hybrid
  async getAllCreditosTrabajadores() { return this.local.getAllCreditosTrabajadores(); }
  async addCreditoTrabajador(c: any) {
    await this.local.addCreditoTrabajador(c);
    if (this.isOnline) await this.cloud.addCreditoTrabajador(c).catch(console.error);
  }
  async updateCreditoTrabajador(c: any) {
    await this.local.updateCreditoTrabajador(c);
    if (this.isOnline) await this.cloud.updateCreditoTrabajador(c).catch(console.error);
  }
  async deleteCreditoTrabajador(id: string) {
    await this.local.deleteCreditoTrabajador(id);
    if (this.isOnline) await this.cloud.deleteCreditoTrabajador(id).catch(console.error);
  }

  // Trabajadores Hybrid
  async getAllTrabajadores() { return this.local.getAllTrabajadores(); }
  async addTrabajador(t: any) {
    await this.local.addTrabajador(t);
    if (this.isOnline) await this.cloud.addTrabajador(t).catch(console.error);
  }
  async updateTrabajador(t: any) {
    await this.local.updateTrabajador(t);
    if (this.isOnline) await this.cloud.updateTrabajador(t).catch(console.error);
  }
  async deleteTrabajador(id: string) {
    await this.local.deleteTrabajador(id);
    if (this.isOnline) await this.cloud.deleteTrabajador(id).catch(console.error);
  }

  // Préstamos entre Cajas Hybrid (solo local — datos sensibles del admin)
  async getAllPrestamosCaja() { return this.local.getAllPrestamosCaja(); }
  async addPrestamoCaja(p: any) { await this.local.addPrestamoCaja(p); }
  async updatePrestamoCaja(p: any) { await this.local.updatePrestamoCaja(p); }

  async clearAll() { await this.local.clearAll(); }
}

export const db = new HybridDatabase();
