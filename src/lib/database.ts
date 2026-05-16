import type { DatabaseAdapter } from './dbAdapter';
import { FirebaseAdapter } from './firebaseAdapter';
import { IndexedDBAdapter } from './indexedDBAdapter';
import { SupabaseDatabase } from './supabase-db';

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
  
  getBackup(key: string): Promise<any>;
  saveBackup(key: string, val: any): Promise<void>;
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
 * 🌊 HYDRATE: Carga datos de Firebase → IndexedDB al arrancar.
 * Solo hidrata si la colección local está vacía (primera vez o reset manual).
 */
async function hydratarDesdeNube(
  localDB: IndexedDBAdapter,
  nube: FirebaseAdapter,
  colecciones: string[],
  force: boolean = false
): Promise<void> {
  console.log(`🌊 [NEXUS]: Iniciando hidratación Firebase → IndexedDB (Force: ${force})...`);
  for (const col of colecciones) {
    try {
      const localCount = await localDB.count(col);
      if (localCount === 0 || force) {
        console.log(`📡 [NEXUS-DEBUG]: Intentando recuperar '${col}' desde la nube...`);
        const datosNube = await nube.getCollection<any>(col);
        console.log(`📡 [NEXUS-DEBUG]: Recibidos ${datosNube.length} items de '${col}' de la nube.`);
        if (datosNube.length > 0) {
          console.log(`📡 [NEXUS-DEBUG]: Ejemplo primer item de ${col}:`, JSON.stringify(datosNube[0]).substring(0, 100));
          await localDB.hydrateFromCloud(col, datosNube);
        } else {
          console.warn(`📡 [NEXUS-DEBUG]: La colección '${col}' está VACÍA en la nube.`);
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

  // Recetas
  async getAllRecetas() { return this.adapter.getCollection('recetas'); }
  async addReceta(r: any) { return this.adapter.setDocument('recetas', r.id, r); }
  async updateReceta(r: any) { return this.adapter.setDocument('recetas', r.id, r); }
  async deleteReceta(id: string) { return this.adapter.deleteDocument('recetas', id); }

  // Producción & Formulaciones
  async getAllFormulaciones() { return this.adapter.getCollection('formulaciones'); }
  async addFormulacion(f: any) { return this.adapter.setDocument('formulaciones', f.id, f); }
  async updateFormulacion(f: any) { return this.adapter.setDocument('formulaciones', f.id, f); }
  async deleteFormulacion(id: string) { return this.adapter.deleteDocument('formulaciones', id); }

  async getAllModelosPan() { return this.adapter.getCollection('modelosPan'); }
  async addModeloPan(m: any) { return this.adapter.setDocument('modelosPan', m.id, m); }
  async updateModeloPan(m: any) { return this.adapter.setDocument('modelosPan', m.id, m); }
  async deleteModeloPan(id: string) { return this.adapter.deleteDocument('modelosPan', id); }

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

  // Finanzas

  // Finanzas
  async addGasto(g: any) { return this.adapter.setDocument('gastos', g.id, g); }
  async updateGasto(g: any) { return this.adapter.setDocument('gastos', g.id, g); }
  async deleteGasto(id: string) { return this.adapter.deleteDocument('gastos', id); }

  async addCreditoCliente(c: any) { return this.adapter.setDocument('creditos_clientes', c.id, c); }
  async updateCreditoCliente(c: any) { return this.adapter.setDocument('creditos_clientes', c.id, c); }
  async deleteCreditoCliente(id: string) { return this.adapter.deleteDocument('creditos_clientes', id); }

  async addCreditoTrabajador(c: any) { return this.adapter.setDocument('creditos_trabajadores', c.id, c); }
  async updateCreditoTrabajador(c: any) { return this.adapter.setDocument('creditos_trabajadores', c.id, c); }
  async deleteCreditoTrabajador(id: string) { return this.adapter.deleteDocument('creditos_trabajadores', id); }

  async addTrabajador(t: any) { return this.adapter.setDocument('trabajadores', t.id, t); }
  async updateTrabajador(t: any) { return this.adapter.setDocument('trabajadores', t.id, t); }
  async deleteTrabajador(id: string) { return this.adapter.deleteDocument('trabajadores', id); }

  // Movimientos e Inventario
  async addMovimiento(m: any) { return this.adapter.setDocument('movimientos', m.id, m); }
  async addRecepcion(r: any) { return this.adapter.setDocument('recepciones', r.id, r); }
  async updateRecepcion(r: any) { return this.adapter.setDocument('recepciones', r.id, r); }
  async deleteRecepcion(id: string) { return this.adapter.deleteDocument('recepciones', id); }

  // Operaciones Atómicas (Simuladas por ahora)
  async batchAjustarStock(ajustes: any[]) {
    for (const a of ajustes) {
      const invItem = await this.getInventarioItemByProducto(a.productoId);
      const stockActual = invItem ? invItem.stockActual : 0;
      const nuevoStock = a.tipo === 'entrada' ? stockActual + a.cantidad : Math.max(0, stockActual - a.cantidad);
      
      const item = {
        id: invItem?.id || crypto.randomUUID(),
        productoId: a.productoId,
        stockActual: nuevoStock,
        stockMinimo: invItem?.stockMinimo || 10,
        ultimoMovimiento: new Date().toISOString()
      };
      
      await this.updateInventarioItem(item);
      await this.addMovimiento({
        id: crypto.randomUUID(),
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
    if (firebaseAdapter) {
      await hydratarDesdeNube(localAdapter, firebaseAdapter, COLECCIONES_PRINCIPALES, true);
    }
  }

  async syncLocalToCloud() {
    if (firebaseAdapter) {
      console.log('📤 [NEXUS]: Iniciando respaldo local → nube...');
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

  async rescueFromSupabase() {
    console.log('🚨 [NEXUS]: Iniciando Protocolo Armagedón — Rescate desde Supabase...');
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
        console.log(`📡 [RESCATE]: Recuperando '${task.col}'...`);
        const items = await task.fn();
        if (items && items.length > 0) {
          console.log(`📥 [RESCATE]: Volcando ${items.length} items en local...`);
          await localAdapter.hydrateFromCloud(task.col, items);
        }
      } catch (e) {
        console.error(`❌ [RESCATE]: Error en '${task.col}':`, e);
      }
    }
    console.log('🏁 [NEXUS]: Rescate completado. Sincronizando con nueva nube...');
    await this.syncLocalToCloud();
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

