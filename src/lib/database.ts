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
  updatedAt?: string;
  fechaActualizacion?: string;
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
  fechaActualizacion?: string;
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
  nombreNegocio: string;
  direccionNegocio?: string;
  telefonoNegocio?: string;
  emailNegocio?: string;
  moneda: string;
  margenUtilidadDefault: number;
  impuestoPorcentaje: number;
  umbralAlerta: number;
  ajusteAutomatico: boolean;
  notificarSubidas: boolean;
  mostrarUtilidadEnLista?: boolean;
  aiMode?: 'local' | 'hybrid' | 'off'; // LOCAL (Ollama), HYBRID (Llama + Claude), OFF (Kill Switch)
  categorias: Array<{ id: string; nombre: string; icono?: string; color?: string; }>;
}

export type AgenteId = 
  | 'gerente' | 'produccion' | 'inventario' | 'marketing' | 'nomina' 
  | 'inversion' | 'contable' | 'logistica' | 'calidad' | 'mantenimiento' 
  | 'clientes' | 'sostenibilidad' | 'expansion' | 'creditos' | 'subvenciones' 
  | 'pitch' | 'abogado' | 'tax' | 'ventas' | 'influencer'
  | 'pico-claw' | 'open-claw' | 'auto-claw';

export type TombstoneTable = 
  | 'proveedores' 
  | 'productos' 
  | 'precios'
  | 'agente_misiones'
  | 'agente_hallazgos';

export interface DBAgenteConfig {
  id: AgenteId;
  directivaPrimaria: string;
  autonomia: number;
  restricciones: string[];
  habilidadesHabilitadas: string[];
  conocimientoInyectado: string;
  ultimaActualizacion: string;
}

export interface DBMisionAgent {
  id: string;
  agenteId: AgenteId;
  creadaPor: string;
  misionExplicita: string;
  frecuencia: 'unica' | '5min' | '1h' | 'diaria' | 'semanal';
  estado: 'espera' | 'ejecutando' | 'pausada';
  ultimaEjecucion?: string;
  proximaEjecucion: string;
  metadata?: any;
}

export interface DBHallazgoAgente {
  id: string;
  agenteId: AgenteId;
  misionId?: string;
  tipo: 'visual' | 'financiero' | 'operativo' | 'alerta';
  gravedad: 'info' | 'baja' | 'media' | 'alta' | 'critica';
  titulo: string;
  descripcion: string;
  evidenciaUrl?: string; // Captura de cámara o fragmento de datos
  fecha: string;
  revisado: boolean;
  metadata?: any; // Para validación adversaria, engramas, etc.
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
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'nequi' | 'daviplata' | 'descuento_nomina' | 'credito' | 'otro';
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
  totalVentasEfectivo?: number;
  totalCreditos?: number;
  ventasIds: string[];
  estado: 'abierta' | 'cerrada';
}

export interface DBGasto {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  estado: 'pendiente' | 'pagado' | 'anulado';
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

  getAllRecetas(): Promise<DBReceta[]>;
  getRecetaByProducto(productoId: string): Promise<DBReceta | undefined>;
  addReceta(receta: DBReceta): Promise<void>;
  updateReceta(receta: DBReceta): Promise<void>;
  deleteReceta(id: string): Promise<void>;

  getAllVentas(): Promise<DBVenta[]>;
  addVenta(venta: DBVenta): Promise<void>;
  getVentasByCaja(cajaId: string): Promise<DBVenta[]>;

  getAllSesionesCaja(): Promise<DBCajaSesion[]>;
  getSesionCajaActiva(): Promise<DBCajaSesion | undefined>;
  addSesionCaja(sesion: DBCajaSesion): Promise<void>;
  updateSesionCaja(sesion: DBCajaSesion): Promise<void>;

  getAllAhorros(): Promise<any[]>;
  addAhorro(ahorro: any): Promise<void>;
  updateAhorro(ahorro: any): Promise<void>;
  deleteAhorro(id: string): Promise<void>;

  getAllMesas(): Promise<any[]>;
  updateMesa(mesa: any): Promise<void>;
  deleteMesa(id: string): Promise<void>;

  getAllPedidosActivos(): Promise<any[]>;
  addPedidoActivo(pedido: any): Promise<void>;
  updatePedidoActivo(pedido: any): Promise<void>;
  deletePedidoActivo(id: string): Promise<void>;

  getAllGastos(): Promise<DBGasto[]>;
  addGasto(gasto: DBGasto): Promise<void>;
  updateGasto(gasto: DBGasto): Promise<void>;
  deleteGasto(id: string): Promise<void>;

  getAllOrdenesProduccion(): Promise<DBOrdenProduccion[]>;
  addOrdenProduccion(orden: DBOrdenProduccion): Promise<void>;
  updateOrdenProduccion(orden: DBOrdenProduccion): Promise<void>;
  deleteOrdenProduccion(id: string): Promise<void>;

  getAllFacturasEscaneadas(): Promise<any[]>;
  addFacturaEscaneada(factura: any): Promise<void>;
  deleteFacturaEscaneada(id: string): Promise<void>;
  getFacturasEscaneadasByProveedor(proveedorId: string): Promise<any[]>;
  getFacturasEscaneadasByFecha(fechaInicio: string, fechaFin: string): Promise<any[]>;

  getAllPrestamosCaja(): Promise<any[]>;
  addPrestamoCaja(prestamo: any): Promise<void>;
  updatePrestamoCaja(prestamo: any): Promise<void>;

  clearAll(): Promise<void>;

  getTombstones(table: string): Promise<string[]>;
  removeTombstone(table: string, id: string): Promise<void>;
  addTombstone(table: TombstoneTable, id: string): Promise<void>;
  saveBackup(id: string, data: any): Promise<void>;
  getBackup(id: string): Promise<any>;
  syncLocalToCloud?(): Promise<void>;
  syncCloudToLocal?(): Promise<void>;

  // MÉTODOS CRÉDITOS CLIENTES
  getAllCreditosClientes(): Promise<any[]>;
  addCreditoCliente(c: any): Promise<void>;
  updateCreditoCliente(c: any): Promise<void>;
  deleteCreditoCliente(id: string): Promise<void>;

  // MÉTODOS CRÉDITOS TRABAJADORES
  getAllCreditosTrabajadores(): Promise<any[]>;
  addCreditoTrabajador(c: any): Promise<void>;
  updateCreditoTrabajador(c: any): Promise<void>;
  deleteCreditoTrabajador(id: string): Promise<void>;

  // MÉTODOS TRABAJADORES
  getAllTrabajadores(): Promise<any[]>;
  addTrabajador(t: any): Promise<void>;
  updateTrabajador(t: any): Promise<void>;
  deleteTrabajador(id: string): Promise<void>;

  getAgenteConfig(id: string): Promise<DBAgenteConfig | undefined>;
  saveAgenteConfig(config: DBAgenteConfig): Promise<void>;
  getAllAgenteConfigs(): Promise<DBAgenteConfig[]>;

  // NUEVOS MÉTODOS CENTINELA
  getAgenteMisiones(agenteId?: AgenteId): Promise<DBMisionAgent[]>;
  saveAgenteMision(mision: DBMisionAgent): Promise<void>;
  deleteAgenteMision(id: string): Promise<void>;
  getAgenteHallazgos(limite?: number): Promise<DBHallazgoAgente[]>;
  saveAgenteHallazgo(hallazgo: DBHallazgoAgente): Promise<void>;
  marcarHallazgoLeido(id: string): Promise<void>;
}

const DB_NAME = 'PriceControlDB';
const DB_VERSION = 18;

class IndexedDBDatabase implements IDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onblocked = () => console.warn("⚠️ IndexedDB: Connection blocked!");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const stores = [
          { name: 'productos', key: 'id', indexes: ['categoria', 'nombre'] },
          { name: 'proveedores', key: 'id', indexes: ['nombre'] },
          { name: 'precios', key: 'id', indexes: ['productoId', 'proveedorId', 'productoProveedor'] },
          { name: 'prepedidos', key: 'id', indexes: ['proveedorId', 'estado'] },
          { name: 'alertas', key: 'id', indexes: ['leida', 'fecha'] },
          { name: 'configuracion', key: 'id', indexes: [] },
          { name: 'inventario', key: 'id', indexes: ['productoId'] },
          { name: 'movimientos', key: 'id', indexes: ['productoId', 'fecha'] },
          { name: 'recepciones', key: 'id', indexes: ['proveedorId', 'fechaRecepcion'] },
          { name: 'historialPrecios', key: 'id', indexes: ['productoId', 'proveedorId', 'fechaCambio'] },
          { name: 'recetas', key: 'id', indexes: ['productoId'] },
          { name: 'ventas', key: 'id', indexes: ['cajaId', 'fecha'] },
          { name: 'caja', key: 'id', indexes: ['estado', 'fechaApertura'] },
          { name: 'ahorros', key: 'id', indexes: ['estado'] },
          { name: 'mesas', key: 'id', indexes: ['estado'] },
          { name: 'pedidos_activos', key: 'id', indexes: ['mesaId', 'estado'] },
          { name: 'gastos', key: 'id', indexes: ['categoria', 'fecha', 'cajaId'] },
          { name: 'produccion', key: 'id', indexes: ['estado', 'productoId', 'fechaInicio'] },
          { name: 'facturas_escaneadas', key: 'id', indexes: ['proveedorId', 'fechaEscaneo', 'fechaFactura', 'recepcionId'] },
          { name: 'creditos_clientes', key: 'id', indexes: ['estado', 'fecha', 'clienteNombre'] },
          { name: 'trabajadores', key: 'id', indexes: ['estado', 'rol'] },
          { name: 'creditos_trabajadores', key: 'id', indexes: ['trabajadorId', 'estado', 'fecha'] },
          { name: 'prestamos_caja', key: 'id', indexes: ['estado', 'fechaPrestamo', 'cajaOrigenId', 'cajaDestinoId'] },
          { name: 'tombstones', key: 'id', indexes: ['table'] },
          { name: 'backups', key: 'id', indexes: [] },
          { name: 'agente_configs', key: 'id', indexes: [] },
          { name: 'agente_misiones', key: 'id', indexes: ['agenteId', 'proximaEjecucion'] },
          { name: 'agente_hallazgos', key: 'id', indexes: ['agenteId', 'tipo', 'gravedad', 'fecha'] }
        ];

        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, { keyPath: s.key });
            s.indexes.forEach(idx => {
              if (idx === 'productoProveedor') {
                store.createIndex(idx, ['productoId', 'proveedorId'], { unique: true });
              } else {
                store.createIndex(idx, idx, { unique: false });
              }
            });
          }
        });
      };
    });
  }

  private async ensureInit() {
    if (!this.db) await this.init();
    return this.db!;
  }

  async getAllProductos() { const db = await this.ensureInit(); return new Promise<DBProducto[]>((res, rej) => { const req = db.transaction('productos').objectStore('productos').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addProducto(p: DBProducto) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('productos', 'readwrite').objectStore('productos').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateProducto(p: DBProducto) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('productos', 'readwrite').objectStore('productos').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteProducto(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('productos', 'readwrite').objectStore('productos').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllProveedores() { const db = await this.ensureInit(); return new Promise<DBProveedor[]>((res, rej) => { const req = db.transaction('proveedores').objectStore('proveedores').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addProveedor(p: DBProveedor) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('proveedores', 'readwrite').objectStore('proveedores').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateProveedor(p: DBProveedor) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('proveedores', 'readwrite').objectStore('proveedores').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteProveedor(id: string) { const db = await this.ensureInit(); try { await new Promise<void>((res, rej) => { const req = db.transaction('proveedores', 'readwrite').objectStore('proveedores').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); } catch(e) { throw e; } }

  async getAllPrecios() { const db = await this.ensureInit(); return new Promise<DBPrecio[]>((res, rej) => { const req = db.transaction('precios').objectStore('precios').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getPreciosByProducto(pid: string) { const db = await this.ensureInit(); return new Promise<DBPrecio[]>((res, rej) => { const req = db.transaction('precios').objectStore('precios').index('productoId').getAll(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getPreciosByProveedor(pid: string) { const db = await this.ensureInit(); return new Promise<DBPrecio[]>((res, rej) => { const req = db.transaction('precios').objectStore('precios').index('proveedorId').getAll(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getPrecioByProductoProveedor(pid: string, provId: string) { const db = await this.ensureInit(); return new Promise<DBPrecio | undefined>((res, rej) => { const req = db.transaction('precios').objectStore('precios').index('productoProveedor').get([pid, provId]); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addPrecio(p: DBPrecio) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('precios', 'readwrite').objectStore('precios').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updatePrecio(p: DBPrecio) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('precios', 'readwrite').objectStore('precios').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deletePrecio(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('precios', 'readwrite').objectStore('precios').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllPrePedidos() { const db = await this.ensureInit(); return new Promise<DBPrePedido[]>((res, rej) => { const req = db.transaction('prepedidos').objectStore('prepedidos').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addPrePedido(p: DBPrePedido) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('prepedidos', 'readwrite').objectStore('prepedidos').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updatePrePedido(p: DBPrePedido) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('prepedidos', 'readwrite').objectStore('prepedidos').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deletePrePedido(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('prepedidos', 'readwrite').objectStore('prepedidos').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllAlertas() { const db = await this.ensureInit(); return new Promise<DBAlerta[]>((res, rej) => { const req = db.transaction('alertas').objectStore('alertas').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addAlerta(a: DBAlerta) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('alertas', 'readwrite').objectStore('alertas').add(a); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateAlerta(a: DBAlerta) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('alertas', 'readwrite').objectStore('alertas').put(a); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteAlerta(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('alertas', 'readwrite').objectStore('alertas').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async clearAllAlertas() { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('alertas', 'readwrite').objectStore('alertas').clear(); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getConfiguracion() { const db = await this.ensureInit(); return new Promise<DBConfiguracion | undefined>((res, rej) => { const req = db.transaction('configuracion').objectStore('configuracion').get('main'); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async saveConfiguracion(c: DBConfiguracion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('configuracion', 'readwrite').objectStore('configuracion').put({ ...c, id: 'main' }); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllInventario() { const db = await this.ensureInit(); return new Promise<DBInventarioItem[]>((res, rej) => { const req = db.transaction('inventario').objectStore('inventario').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getInventarioItemByProducto(pid: string) { const db = await this.ensureInit(); return new Promise<DBInventarioItem | undefined>((res, rej) => { const req = db.transaction('inventario').objectStore('inventario').index('productoId').get(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async updateInventarioItem(i: DBInventarioItem) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('inventario', 'readwrite').objectStore('inventario').put(i); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllMovimientos() { const db = await this.ensureInit(); return new Promise<DBMovimientoInventario[]>((res, rej) => { const req = db.transaction('movimientos').objectStore('movimientos').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addMovimiento(m: DBMovimientoInventario) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('movimientos', 'readwrite').objectStore('movimientos').add(m); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllRecepciones() { const db = await this.ensureInit(); return new Promise<DBRecepcion[]>((res, rej) => { const req = db.transaction('recepciones').objectStore('recepciones').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addRecepcion(r: DBRecepcion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('recepciones', 'readwrite').objectStore('recepciones').add(r); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateRecepcion(r: DBRecepcion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('recepciones', 'readwrite').objectStore('recepciones').put(r); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllHistorial() { const db = await this.ensureInit(); return new Promise<DBHistorialPrecio[]>((res, rej) => { const req = db.transaction('historialPrecios').objectStore('historialPrecios').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addHistorial(h: DBHistorialPrecio) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('historialPrecios', 'readwrite').objectStore('historialPrecios').add(h); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getHistorialByProducto(pid: string) { const db = await this.ensureInit(); return new Promise<DBHistorialPrecio[]>((res, rej) => { const req = db.transaction('historialPrecios').objectStore('historialPrecios').index('productoId').getAll(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async getAllRecetas() { const db = await this.ensureInit(); return new Promise<DBReceta[]>((res, rej) => { const req = db.transaction('recetas').objectStore('recetas').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getRecetaByProducto(pid: string) { const db = await this.ensureInit(); return new Promise<DBReceta | undefined>((res, rej) => { const req = db.transaction('recetas').objectStore('recetas').index('productoId').get(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addReceta(r: DBReceta) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('recetas', 'readwrite').objectStore('recetas').add(r); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateReceta(r: DBReceta) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('recetas', 'readwrite').objectStore('recetas').put(r); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteReceta(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('recetas', 'readwrite').objectStore('recetas').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllVentas() { const db = await this.ensureInit(); return new Promise<DBVenta[]>((res, rej) => { const req = db.transaction('ventas').objectStore('ventas').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addVenta(v: DBVenta) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('ventas', 'readwrite').objectStore('ventas').add(v); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getVentasByCaja(cid: string) { const db = await this.ensureInit(); return new Promise<DBVenta[]>((res, rej) => { const req = db.transaction('ventas').objectStore('ventas').index('cajaId').getAll(cid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async getAllSesionesCaja() { const db = await this.ensureInit(); return new Promise<DBCajaSesion[]>((res, rej) => { const req = db.transaction('caja').objectStore('caja').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getSesionCajaActiva() { const all = await this.getAllSesionesCaja(); return all.find(s => s.estado === 'abierta'); }
  async addSesionCaja(s: DBCajaSesion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('caja', 'readwrite').objectStore('caja').add(s); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateSesionCaja(s: DBCajaSesion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('caja', 'readwrite').objectStore('caja').put(s); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllAhorros() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('ahorros').objectStore('ahorros').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addAhorro(a: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('ahorros', 'readwrite').objectStore('ahorros').add(a); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateAhorro(a: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('ahorros', 'readwrite').objectStore('ahorros').put(a); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteAhorro(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('ahorros', 'readwrite').objectStore('ahorros').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllMesas() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('mesas').objectStore('mesas').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async updateMesa(m: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('mesas', 'readwrite').objectStore('mesas').put(m); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteMesa(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('mesas', 'readwrite').objectStore('mesas').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllPedidosActivos() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('pedidos_activos').objectStore('pedidos_activos').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addPedidoActivo(p: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('pedidos_activos', 'readwrite').objectStore('pedidos_activos').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updatePedidoActivo(p: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('pedidos_activos', 'readwrite').objectStore('pedidos_activos').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deletePedidoActivo(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('pedidos_activos', 'readwrite').objectStore('pedidos_activos').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllGastos() { const db = await this.ensureInit(); return new Promise<DBGasto[]>((res, rej) => { const req = db.transaction('gastos').objectStore('gastos').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addGasto(g: DBGasto) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('gastos', 'readwrite').objectStore('gastos').add(g); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateGasto(g: DBGasto) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('gastos', 'readwrite').objectStore('gastos').put(g); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteGasto(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('gastos', 'readwrite').objectStore('gastos').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllOrdenesProduccion() { const db = await this.ensureInit(); return new Promise<DBOrdenProduccion[]>((res, rej) => { const req = db.transaction('produccion').objectStore('produccion').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addOrdenProduccion(o: DBOrdenProduccion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('produccion', 'readwrite').objectStore('produccion').add(o); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateOrdenProduccion(o: DBOrdenProduccion) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('produccion', 'readwrite').objectStore('produccion').put(o); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteOrdenProduccion(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('produccion', 'readwrite').objectStore('produccion').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async getAllFacturasEscaneadas() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('facturas_escaneadas').objectStore('facturas_escaneadas').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addFacturaEscaneada(f: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('facturas_escaneadas', 'readwrite').objectStore('facturas_escaneadas').add(f); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteFacturaEscaneada(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('facturas_escaneadas', 'readwrite').objectStore('facturas_escaneadas').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getFacturasEscaneadasByProveedor(pid: string) { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('facturas_escaneadas').objectStore('facturas_escaneadas').index('proveedorId').getAll(pid); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getFacturasEscaneadasByFecha(f1: string, f2: string) { const all = await this.getAllFacturasEscaneadas(); return all.filter(f => f.fechaEscaneo >= f1 && f.fechaEscaneo <= f2); }

  async getAllPrestamosCaja() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('prestamos_caja').objectStore('prestamos_caja').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addPrestamoCaja(p: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('prestamos_caja', 'readwrite').objectStore('prestamos_caja').add(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updatePrestamoCaja(p: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('prestamos_caja', 'readwrite').objectStore('prestamos_caja').put(p); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  async clearAll() { const db = await this.ensureInit(); const stores = db.objectStoreNames; const tx = db.transaction([...stores], 'readwrite'); Array.from(stores).forEach(s => tx.objectStore(s).clear()); return new Promise<void>((res) => { tx.oncomplete = () => res(); }); }

  async getTombstones(tab: string) { const db = await this.ensureInit(); return new Promise<string[]>((res, rej) => { const req = db.transaction('tombstones').objectStore('tombstones').index('table').getAll(tab); req.onsuccess = () => res(req.result.map((t: any) => t.itemId)); req.onerror = () => rej(req.error); }); }
  async removeTombstone(tab: string, id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('tombstones', 'readwrite').objectStore('tombstones').delete(`${tab}:${id}`); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async addTombstone(tab: TombstoneTable, id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('tombstones', 'readwrite').objectStore('tombstones').put({ id: `${tab}:${id}`, table: tab, itemId: id, fecha: new Date().toISOString() }); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async saveBackup(id: string, data: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('backups', 'readwrite').objectStore('backups').put({ id, data, fecha: new Date().toISOString() }); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getBackup(id: string) { const db = await this.ensureInit(); return new Promise<any>((res, rej) => { const req = db.transaction('backups').objectStore('backups').get(id); req.onsuccess = () => res(req.result?.data); req.onerror = () => rej(req.error); }); }

  async getAgenteConfig(id: string) { const db = await this.ensureInit(); return new Promise<DBAgenteConfig | undefined>((res, rej) => { const req = db.transaction('agente_configs').objectStore('agente_configs').get(id); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async saveAgenteConfig(c: DBAgenteConfig) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('agente_configs', 'readwrite').objectStore('agente_configs').put(c); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getAllAgenteConfigs() { const db = await this.ensureInit(); return new Promise<DBAgenteConfig[]>((res, rej) => { const req = db.transaction('agente_configs').objectStore('agente_configs').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async getAgenteMisiones(aid?: AgenteId) { const db = await this.ensureInit(); return new Promise<DBMisionAgent[]>((res, rej) => { const store = db.transaction('agente_misiones').objectStore('agente_misiones'); const req = aid ? store.index('agenteId').getAll(aid) : store.getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async saveAgenteMision(m: DBMisionAgent) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('agente_misiones', 'readwrite').objectStore('agente_misiones').put(m); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteAgenteMision(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('agente_misiones', 'readwrite').objectStore('agente_misiones').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async getAgenteHallazgos(lim: number = 50) { const db = await this.ensureInit(); return new Promise<DBHallazgoAgente[]>((res, rej) => { const req = db.transaction('agente_hallazgos').objectStore('agente_hallazgos').getAll(); req.onsuccess = () => { const sorted = (req.result as DBHallazgoAgente[]).sort((a,b) => b.fecha.localeCompare(a.fecha)); res(sorted.slice(0, lim)); }; req.onerror = () => rej(req.error); }); }
  async saveAgenteHallazgo(h: DBHallazgoAgente) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('agente_hallazgos', 'readwrite').objectStore('agente_hallazgos').put(h); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async marcarHallazgoLeido(id: string) { const db = await this.ensureInit(); const store = db.transaction('agente_hallazgos', 'readwrite').objectStore('agente_hallazgos'); const h = await new Promise<DBHallazgoAgente>((res, rej) => { const r = store.get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); if (h) await new Promise<void>((res, rej) => { const r = store.put({ ...h, revisado: true }); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

  // Créditos Clientes
  async getAllCreditosClientes() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('creditos_clientes').objectStore('creditos_clientes').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addCreditoCliente(c: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_clientes', 'readwrite').objectStore('creditos_clientes').add(c); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateCreditoCliente(c: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_clientes', 'readwrite').objectStore('creditos_clientes').put(c); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteCreditoCliente(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_clientes', 'readwrite').objectStore('creditos_clientes').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  // Créditos Trabajadores
  async getAllCreditosTrabajadores() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('creditos_trabajadores').objectStore('creditos_trabajadores').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addCreditoTrabajador(c: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_trabajadores', 'readwrite').objectStore('creditos_trabajadores').add(c); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateCreditoTrabajador(c: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_trabajadores', 'readwrite').objectStore('creditos_trabajadores').put(c); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteCreditoTrabajador(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('creditos_trabajadores', 'readwrite').objectStore('creditos_trabajadores').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }

  // Trabajadores
  async getAllTrabajadores() { const db = await this.ensureInit(); return new Promise<any[]>((res, rej) => { const req = db.transaction('trabajadores').objectStore('trabajadores').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async addTrabajador(t: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('trabajadores', 'readwrite').objectStore('trabajadores').add(t); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async updateTrabajador(t: any) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('trabajadores', 'readwrite').objectStore('trabajadores').put(t); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
  async deleteTrabajador(id: string) { const db = await this.ensureInit(); return new Promise<void>((res, rej) => { const req = db.transaction('trabajadores', 'readwrite').objectStore('trabajadores').delete(id); req.onsuccess = () => res(); req.onerror = () => rej(req.error); }); }
}

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

  async init() { 
    await this.local.init(); 
    // Sincronización en segundo plano para no bloquear el inicio de la app
    if (this.isOnline) {
      this.syncCloudToLocal().catch(err => console.warn("Background sync failed", err));
    }
  }

  // Sync Logic
  // MARGEN_SEGURIDAD: la nube SOLO AGREGA lo que no existe localmente. LOCAL SIEMPRE GANA.
  async syncCloudToLocal() {
    try {
      const MARGEN_SEGURIDAD = 60 * 1000; // 60s de barrera protectora — no se usa en tiempo pero documenta la intención
      void MARGEN_SEGURIDAD; // evitar warning de TS unused
      const processTable = async (cloudItems: any[], localIds: Set<string>, tombstoneSet: Set<string>, addFn: (i: any) => Promise<void>) => {
        for (const item of cloudItems) {
          if (tombstoneSet.has(item.id)) continue;
          if (!localIds.has(item.id)) await addFn(item).catch(() => {});
        }
      };
      // CRÍTICO: usar tombstones de NUBE + local (protege aunque IndexedDB se limpie)
      const [cloudProds, cloudProvs, cloudPrecios,
             localTombsProds, localTombsProvs, localTombsPrecios,
             cloudTombsProds, cloudTombsProvs, cloudTombsPrecios] = await Promise.all([
        this.cloud.getAllProductos(), this.cloud.getAllProveedores(), this.cloud.getAllPrecios(),
        this.local.getTombstones('productos'), this.local.getTombstones('proveedores'), this.local.getTombstones('precios'),
        this.cloud.getTombstones('productos').catch(() => [] as string[]),
        this.cloud.getTombstones('proveedores').catch(() => [] as string[]),
        this.cloud.getTombstones('precios').catch(() => [] as string[]),
      ]);
      const tombstoneSet = new Set([
        ...localTombsProds, ...localTombsProvs, ...localTombsPrecios,
        ...cloudTombsProds, ...cloudTombsProvs, ...cloudTombsPrecios,
      ]);
      const [lProds, lProvs, lPrecios] = await Promise.all([
        this.local.getAllProductos(), this.local.getAllProveedores(), this.local.getAllPrecios()
      ]);
      await processTable(cloudProds, new Set(lProds.map(p => p.id)), tombstoneSet, p => this.local.addProducto(p));
      await processTable(cloudProvs, new Set(lProvs.map(p => p.id)), tombstoneSet, p => this.local.addProveedor(p));
      await processTable(cloudPrecios, new Set(lPrecios.map(p => p.id)), tombstoneSet, p => this.local.addPrecio(p));
    } catch(e) { console.warn("Sync failed", e); }
  }

  // syncLocalToCloud: sube productos, proveedores y precios a la nube
  async syncLocalToCloud() {
    if (!this.isOnline) return;
    try {
      const [localProds, localProvs, localPrecios] = await Promise.all([
        this.local.getAllProductos(), this.local.getAllProveedores(), this.local.getAllPrecios()
      ]);
      for (const p of localProds) await this.cloud.updateProducto(p).catch(() => this.cloud.addProducto(p).catch(() => {}));
      for (const p of localProvs) await this.cloud.updateProveedor(p).catch(() => this.cloud.addProveedor(p).catch(() => {}));
      for (const p of localPrecios) await this.cloud.updatePrecio(p).catch(() => this.cloud.addPrecio(p).catch(() => {}));
    } catch(e) { console.warn("Sync failed", e); }
  }

  // recoverFromCloud: restaura TODO desde Supabase usando tombstones de la nube como filtro
  async recoverFromCloud(): Promise<{ productos: number; proveedores: number; precios: number }> {
    const [cloudProds, cloudProvs, cloudPrecios,
           cloudTombsProds, cloudTombsProvs, cloudTombsPrecios] = await Promise.all([
      this.cloud.getAllProductos(), this.cloud.getAllProveedores(), this.cloud.getAllPrecios(),
      this.cloud.getTombstones('productos').catch(() => [] as string[]),
      this.cloud.getTombstones('proveedores').catch(() => [] as string[]),
      this.cloud.getTombstones('precios').catch(() => [] as string[]),
    ]);
    const cloudTombstones = new Set([...cloudTombsProds, ...cloudTombsProvs, ...cloudTombsPrecios]);

    let recovered = { productos: 0, proveedores: 0, precios: 0 };

    for (const p of cloudProds) {
      if (cloudTombstones.has(p.id)) continue;
      await this.local.updateProducto(p).catch(() => this.local.addProducto(p).catch(() => {}));
      recovered.productos++;
    }
    for (const p of cloudProvs) {
      if (cloudTombstones.has(p.id)) continue;
      await this.local.updateProveedor(p).catch(() => this.local.addProveedor(p).catch(() => {}));
      recovered.proveedores++;
    }
    for (const p of cloudPrecios) {
      if (cloudTombstones.has(p.id)) continue;
      await this.local.updatePrecio(p).catch(() => this.local.addPrecio(p).catch(() => {}));
      recovered.precios++;
    }
    // Restaurar tombstones de nube en local
    for (const id of cloudTombsProds) await this.local.addTombstone('productos', id).catch(() => {});
    for (const id of cloudTombsProvs) await this.local.addTombstone('proveedores', id).catch(() => {});
    for (const id of cloudTombsPrecios) await this.local.addTombstone('precios', id).catch(() => {});

    return recovered;
  }

  // Delegates
  async getAllProductos() { return this.local.getAllProductos(); }
  async addProducto(p: DBProducto) { await this.local.addProducto(p); if (this.isOnline) this.cloud.addProducto(p); }
  async updateProducto(p: DBProducto) { await this.local.updateProducto(p); if (this.isOnline) this.cloud.updateProducto(p); }
  async deleteProducto(id: string) { await this.local.deleteProducto(id); await this.addTombstone('productos', id); if (this.isOnline) this.cloud.deleteProducto(id); }

  async getAllProveedores() { return this.local.getAllProveedores(); }
  async addProveedor(p: DBProveedor) { await this.local.addProveedor(p); if (this.isOnline) this.cloud.addProveedor(p); }
  async updateProveedor(p: DBProveedor) { await this.local.updateProveedor(p); if (this.isOnline) this.cloud.updateProveedor(p); }
  async deleteProveedor(id: string) { await this.local.deleteProveedor(id); await this.addTombstone('proveedores', id); if (this.isOnline) this.cloud.deleteProveedor(id); }

  async getAllPrecios() { return this.local.getAllPrecios(); }
  async getPreciosByProducto(pid: string) { return this.local.getPreciosByProducto(pid); }
  async getPreciosByProveedor(pid: string) { return this.local.getPreciosByProveedor(pid); }
  async getPrecioByProductoProveedor(pid: string, provId: string) { return this.local.getPrecioByProductoProveedor(pid, provId); }
  async addPrecio(p: DBPrecio) { await this.local.addPrecio(p); if (this.isOnline) this.cloud.addPrecio(p); }
  async updatePrecio(p: DBPrecio) { await this.local.updatePrecio(p); if (this.isOnline) this.cloud.updatePrecio(p); }
  async deletePrecio(id: string) { await this.local.deletePrecio(id); await this.addTombstone('precios', id); if (this.isOnline) this.cloud.deletePrecio(id); }

  async getAllPrePedidos() { return this.local.getAllPrePedidos(); }
  async addPrePedido(p: DBPrePedido) { await this.local.addPrePedido(p); if (this.isOnline) this.cloud.addPrePedido(p); }
  async updatePrePedido(p: DBPrePedido) { await this.local.updatePrePedido(p); if (this.isOnline) this.cloud.updatePrePedido(p); }
  async deletePrePedido(id: string) { await this.local.deletePrePedido(id); if (this.isOnline) this.cloud.deletePrePedido(id); }

  async getAllAlertas() { return this.local.getAllAlertas(); }
  async addAlerta(a: DBAlerta) { await this.local.addAlerta(a); if (this.isOnline) this.cloud.addAlerta(a); }
  async updateAlerta(a: DBAlerta) { await this.local.updateAlerta(a); if (this.isOnline) this.cloud.updateAlerta(a); }
  async deleteAlerta(id: string) { await this.local.deleteAlerta(id); if (this.isOnline) this.cloud.deleteAlerta(id); }
  async clearAllAlertas() { await this.local.clearAllAlertas(); if (this.isOnline) this.cloud.clearAllAlertas(); }

  async getConfiguracion() { return this.local.getConfiguracion(); }
  async saveConfiguracion(c: DBConfiguracion) { await this.local.saveConfiguracion(c); if (this.isOnline) this.cloud.saveConfiguracion(c); }

  async getAllInventario() { return this.local.getAllInventario(); }
  async getInventarioItemByProducto(pid: string) { return this.local.getInventarioItemByProducto(pid); }
  async updateInventarioItem(i: DBInventarioItem) { await this.local.updateInventarioItem(i); if (this.isOnline) this.cloud.updateInventarioItem(i); }

  async getAllMovimientos() { return this.local.getAllMovimientos(); }
  async addMovimiento(m: DBMovimientoInventario) { await this.local.addMovimiento(m); if (this.isOnline) this.cloud.addMovimiento(m); }

  async getAllRecepciones() { return this.local.getAllRecepciones(); }
  async addRecepcion(r: DBRecepcion) { await this.local.addRecepcion(r); if (this.isOnline) this.cloud.addRecepcion(r); }
  async updateRecepcion(r: DBRecepcion) { await this.local.updateRecepcion(r); if (this.isOnline) this.cloud.updateRecepcion(r); }

  async getAllHistorial() { return this.local.getAllHistorial(); }
  async addHistorial(h: DBHistorialPrecio) { await this.local.addHistorial(h); if (this.isOnline) this.cloud.addHistorial(h); }
  async getHistorialByProducto(pid: string) { return this.local.getHistorialByProducto(pid); }

  async getAllRecetas() { return this.local.getAllRecetas(); }
  async getRecetaByProducto(pid: string) { return this.local.getRecetaByProducto(pid); }
  async addReceta(r: DBReceta) { await this.local.addReceta(r); if (this.isOnline) this.cloud.addReceta(r); }
  async updateReceta(r: DBReceta) { await this.local.updateReceta(r); if (this.isOnline) this.cloud.updateReceta(r); }
  async deleteReceta(id: string) { await this.local.deleteReceta(id); if (this.isOnline) this.cloud.deleteReceta(id); }

  async getAllVentas() { return this.local.getAllVentas(); }
  async addVenta(v: DBVenta) { await this.local.addVenta(v); if (this.isOnline) this.cloud.addVenta(v); }
  async getVentasByCaja(cid: string) { return this.local.getVentasByCaja(cid); }

  async getAllSesionesCaja() { return this.local.getAllSesionesCaja(); }
  async getSesionCajaActiva() { return this.local.getSesionCajaActiva(); }
  async addSesionCaja(s: DBCajaSesion) { await this.local.addSesionCaja(s); if (this.isOnline) this.cloud.addSesionCaja(s); }
  async updateSesionCaja(s: DBCajaSesion) { await this.local.updateSesionCaja(s); if (this.isOnline) this.cloud.updateSesionCaja(s); }

  async getAllAhorros() { return this.local.getAllAhorros(); }
  async addAhorro(a: any) { await this.local.addAhorro(a); }
  async updateAhorro(a: any) { await this.local.updateAhorro(a); }
  async deleteAhorro(id: string) { await this.local.deleteAhorro(id); }

  async getAllMesas() { return this.local.getAllMesas(); }
  async updateMesa(m: any) { await this.local.updateMesa(m); }
  async deleteMesa(id: string) { await this.local.deleteMesa(id); }

  async getAllPedidosActivos() { return this.local.getAllPedidosActivos(); }
  async addPedidoActivo(p: any) { await this.local.addPedidoActivo(p); }
  async updatePedidoActivo(p: any) { await this.local.updatePedidoActivo(p); }
  async deletePedidoActivo(id: string) { await this.local.deletePedidoActivo(id); }

  async getAllGastos() { return this.local.getAllGastos(); }
  async addGasto(g: DBGasto) { await this.local.addGasto(g); if (this.isOnline) this.cloud.addGasto(g); }
  async updateGasto(g: DBGasto) { await this.local.updateGasto(g); if (this.isOnline) this.cloud.updateGasto(g); }
  async deleteGasto(id: string) { await this.local.deleteGasto(id); if (this.isOnline) this.cloud.deleteGasto(id); }

  async getAllOrdenesProduccion() { return this.local.getAllOrdenesProduccion(); }
  async addOrdenProduccion(o: DBOrdenProduccion) { await this.local.addOrdenProduccion(o); }
  async updateOrdenProduccion(o: DBOrdenProduccion) { await this.local.updateOrdenProduccion(o); }
  async deleteOrdenProduccion(id: string) { await this.local.deleteOrdenProduccion(id); }

  async getAllFacturasEscaneadas() { return this.local.getAllFacturasEscaneadas(); }
  async addFacturaEscaneada(f: any) { await this.local.addFacturaEscaneada(f); }
  async deleteFacturaEscaneada(id: string) { await this.local.deleteFacturaEscaneada(id); }
  async getFacturasEscaneadasByProveedor(pid: string) { return this.local.getFacturasEscaneadasByProveedor(pid); }
  async getFacturasEscaneadasByFecha(f1: string, f2: string) { return this.local.getFacturasEscaneadasByFecha(f1, f2); }

  async getAllPrestamosCaja() { return this.local.getAllPrestamosCaja(); }
  async addPrestamoCaja(p: any) { await this.local.addPrestamoCaja(p); }
  async updatePrestamoCaja(p: any) { await this.local.updatePrestamoCaja(p); }

  async clearAll() { await this.local.clearAll(); }

  async getTombstones(tab: string) { return this.local.getTombstones(tab); }
  async removeTombstone(tab: string, id: string) { await this.local.removeTombstone(tab, id); if (this.isOnline) this.cloud.removeTombstone(tab, id).catch(() => {}); }
  async addTombstone(tab: TombstoneTable, id: string) { await this.local.addTombstone(tab, id); if (this.isOnline) this.cloud.addTombstone(tab, id).catch(() => {}); }
  async saveBackup(id: string, data: any) { await this.local.saveBackup(id, data); }
  async getBackup(id: string) { return this.local.getBackup(id); }

  async getAgenteConfig(id: string) { return this.local.getAgenteConfig(id); }
  async saveAgenteConfig(c: DBAgenteConfig) { await this.local.saveAgenteConfig(c); if (this.isOnline) this.cloud.saveAgenteConfig(c); }
  async getAllAgenteConfigs() { return this.local.getAllAgenteConfigs(); }

  async getAgenteMisiones(aid?: AgenteId) { return this.local.getAgenteMisiones(aid); }
  async saveAgenteMision(m: DBMisionAgent) { await this.local.saveAgenteMision(m); }
  async deleteAgenteMision(id: string) { await this.local.deleteAgenteMision(id); }
  async getAgenteHallazgos(lim?: number) { return this.local.getAgenteHallazgos(lim); }
  async saveAgenteHallazgo(h: DBHallazgoAgente) { await this.local.saveAgenteHallazgo(h); }
  async marcarHallazgoLeido(id: string) { await this.local.marcarHallazgoLeido(id); }

  // Créditos Clientes
  async getAllCreditosClientes() { return this.local.getAllCreditosClientes(); }
  async addCreditoCliente(c: any) { await this.local.addCreditoCliente(c); }
  async updateCreditoCliente(c: any) { await this.local.updateCreditoCliente(c); }
  async deleteCreditoCliente(id: string) { await this.local.deleteCreditoCliente(id); }

  // Créditos Trabajadores
  async getAllCreditosTrabajadores() { return this.local.getAllCreditosTrabajadores(); }
  async addCreditoTrabajador(c: any) { await this.local.addCreditoTrabajador(c); }
  async updateCreditoTrabajador(c: any) { await this.local.updateCreditoTrabajador(c); }
  async deleteCreditoTrabajador(id: string) { await this.local.deleteCreditoTrabajador(id); }

  // Trabajadores
  async getAllTrabajadores() { return this.local.getAllTrabajadores(); }
  async addTrabajador(t: any) { await this.local.addTrabajador(t); }
  async updateTrabajador(t: any) { await this.local.updateTrabajador(t); }
  async deleteTrabajador(id: string) { await this.local.deleteTrabajador(id); }

  // 🔄 SISTEMA DE RESCATE (CLOUD -> LOCAL)
  async downloadFromCloud() {
    if (!navigator.onLine) return;
    try {
      console.log('📥 [Nexus-Rescue] Iniciando recuperación de datos desde Supabase...');
      const [p, pr, c] = await Promise.all([
        this.cloud.getAllProductos(),
        this.cloud.getAllProveedores(),
        this.cloud.getConfiguracion()
      ]);

      if (p.length > 0) {
        for (const item of p) await this.local.addProducto(item).catch(() => {});
      }
      if (pr.length > 0) {
        for (const prov of pr) await this.local.addProveedor(prov).catch(() => {});
      }
      if (c) {
        await this.local.saveConfiguracion(c).catch(() => {});
      }
      console.log('✅ [Nexus-Rescue] Rescate completado con éxito.');
    } catch (err) {
      console.error('❌ [Nexus-Rescue] Error durante el rescate:', err);
    }
  }
}

export const db = new HybridDatabase();
