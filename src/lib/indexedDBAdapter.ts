import type { DatabaseAdapter } from './dbAdapter';
import { mergeHydrateItem } from './sync-merge-local-gana';

/**
 * 🏠 INDEXEDDB ADAPTER — Dulce Placer ERP
 * Adaptador de almacenamiento LOCAL real usando IndexedDB del navegador.
 * Es el motor PRIMARIO de la arquitectura offline-first.
 * 
 * Responsabilidades:
 *  - Guardar y leer datos localmente sin necesidad de internet.
 *  - Actuar como fuente de verdad cuando la nube no está disponible.
 *  - Proveer la misma interfaz que Firebase/Appwrite para el MultiAdapter.
 * 
 * @version 1.0.0
 */

const DB_NAME = 'dulce-placer-db';
const DB_VERSION = 7;

/** Colecciones conocidas — cada una se convierte en un Object Store de IndexedDB */
const COLLECTIONS = [
  'productos',
  'proveedores',
  'precios',
  'clientes',
  'tombstones',
  'configuracion',
  'ventas',
  'inventario',
  'movimientos',
  'recepciones',
  'historial',
  'sesiones_caja',
  'backups',
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
  'agente_misiones',
  'agente_hallazgos',
  'agente_config',
  'bitacora_ia',
  'asistencia',
  'nominas',
  'auditorias_produccion',
  'planes_diarios',
  'workflows'
];

export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Abre (o crea) la base de datos y registra todos los Object Stores. Idempotente. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Crear Object Stores para cada colección si no existen aún
        for (const col of COLLECTIONS) {
          if (!db.objectStoreNames.contains(col)) {
            db.createObjectStore(col, { keyPath: 'id' });
            console.log(`📦 [IndexedDB]: Object Store creado → '${col}'`);
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('🏠 [IndexedDB]: Base de datos local lista.');
        resolve();
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.error('❌ [IndexedDB]: Error al abrir la DB:', error);
        reject(error);
      };
    });
    return this.initPromise;
  }

  /** Garantiza que init() haya completado antes de operar. */
  private ensureReady(): Promise<void> {
    if (this.db) return Promise.resolve();
    return this.init();
  }

  /** Devuelve la instancia de DB asegurada (lanza error si init() no fue llamado). */
  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('❌ [IndexedDB]: La base de datos no está inicializada. Llama a init() primero.');
    }
    return this.db;
  }

  /**
   * Ejecuta una transacción de lectura/escritura sobre un Object Store.
   */
  private transaction(
    collection: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const db = this.getDB();
      
      // Si el Object Store no existe (colección nueva), resolver con valor vacío
      if (!db.objectStoreNames.contains(collection)) {
        console.warn(`⚠️ [IndexedDB]: Colección '${collection}' no existe. Devolviendo vacío.`);
        resolve(mode === 'readonly' ? [] : undefined);
        return;
      }

      const tx = db.transaction(collection, mode);
      const store = tx.objectStore(collection);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─────────────────────────────────────────────
  // IMPLEMENTACIÓN DE LA INTERFAZ DatabaseAdapter
  // ─────────────────────────────────────────────

  /** Obtiene todos los documentos de una colección. */
  async getCollection<T>(name: string): Promise<T[]> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();

      if (!db.objectStoreNames.contains(name)) {
        resolve([]);
        return;
      }

      const tx = db.transaction(name, 'readonly');
      const store = tx.objectStore(name);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result || []) as T[]);
      request.onerror = () => {
        console.error(`❌ [IndexedDB]: Error al leer colección '${name}'`);
        reject(request.error);
      };
    });
  }

  /** Obtiene un documento específico por su ID. */
  async getDocument<T>(collection: string, id: string): Promise<T | null> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();

      if (!db.objectStoreNames.contains(collection)) {
        resolve(null);
        return;
      }

      const tx = db.transaction(collection, 'readonly');
      const store = tx.objectStore(collection);
      const request = store.get(id);

      request.onsuccess = () => resolve((request.result as T) || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Guarda o actualiza un documento en la colección.
   * Usa `put()` que es un upsert nativo (crea o actualiza).
   */
  async setDocument<T>(collection: string, id: string, data: T): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();

      if (!db.objectStoreNames.contains(collection)) {
        console.warn(`⚠️ [IndexedDB]: Colección '${collection}' no existe. No se guardó.`);
        resolve();
        return;
      }

      const tx = db.transaction(collection, 'readwrite');
      const store = tx.objectStore(collection);
      // Aseguramos que el campo `id` esté presente en el objeto (keyPath)
      const request = store.put({ ...(data as any), id });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`❌ [IndexedDB]: Error al guardar en '${collection}' id='${id}'`);
        reject(request.error);
      };
    });
  }

  /** Elimina un documento por su ID. */
  async deleteDocument(collection: string, id: string): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();

      if (!db.objectStoreNames.contains(collection)) {
        resolve();
        return;
      }

      const tx = db.transaction(collection, 'readwrite');
      const store = tx.objectStore(collection);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Suscripción a cambios en tiempo real.
   * IndexedDB no soporta subscripciones nativas. Este método usa un polling
   * ligero como mecanismo de compatibilidad con la interfaz DatabaseAdapter.
   * La sincronización real en tiempo real la provee Firebase.
   */
  subscribe<T>(collection: string, callback: (data: T[]) => void): () => void {
    // Carga inicial inmediata
    this.getCollection<T>(collection).then(callback);

    // Polling cada 3 segundos para detectar cambios locales (ej: otra pestaña)
    const interval = setInterval(() => {
      this.getCollection<T>(collection).then(callback);
    }, 3000);

    return () => clearInterval(interval);
  }

  // ─────────────────────────────────────────────
  // MÉTODOS DE UTILIDAD
  // ─────────────────────────────────────────────

  /**
   * Hidrata IndexedDB con datos de la nube.
   * LOCAL SIEMPRE GANA: si ya existe el id, se hace merge (nube solo rellena huecos).
   * En `precios` protege cantidadEmbalaje, tipoEmbalaje y precioCosto locales.
   */
  async hydrateFromCloud<T extends { id: string }>(collection: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    await this.ensureReady();
    
    const CHUNK_SIZE = 500;
    let errorOccurred = false;

    // Helper to process a single chunk in one transaction
    const processChunk = (chunk: T[]): Promise<void> => {
      return new Promise((resolve, reject) => {
        const db = this.getDB();
        if (!db.objectStoreNames.contains(collection)) {
          console.warn(`⚠️ [IndexedDB]: Colección '${collection}' no existe. No se hidrató.`);
          resolve();
          return;
        }

        const tx = db.transaction(collection, 'readwrite');
        const store = tx.objectStore(collection);

        for (const item of chunk) {
          // get + merge + put en la misma tx (LOCAL GANA; nube solo llena huecos)
          const getReq = store.get(item.id);
          getReq.onsuccess = () => {
            const existing = getReq.result as T | undefined;
            const merged = mergeHydrateItem(collection, existing, { ...(item as T), id: item.id });
            const putReq = store.put(merged);
            putReq.onerror = (e) => {
              errorOccurred = true;
              console.error(`❌ [IndexedDB]: Error al hidratar en '${collection}' id='${item.id}'`, (e.target as IDBRequest).error);
            };
          };
          getReq.onerror = (e) => {
            errorOccurred = true;
            console.error(`❌ [IndexedDB]: Error al leer local '${collection}' id='${item.id}'`, (e.target as IDBRequest).error);
          };
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    };

    // Procesar en chunks para no bloquear el hilo principal (UI)
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await processChunk(chunk);
      // Ceder el control al event loop para que la UI no se congele
      await new Promise(res => setTimeout(res, 0));
    }

    if (!errorOccurred) {
      console.log(`☁️→🏠 [IndexedDB]: Hidratado '${collection}' con ${items.length} items (MERGE LOCAL GANA).`);
    }
  }

  /**
   * Borra todos los datos de una colección local.
   * Útil para forzar una re-sincronización desde la nube.
   */
  async clearCollection(collection: string): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();
      if (!db.objectStoreNames.contains(collection)) { resolve(); return; }

      const tx = db.transaction(collection, 'readwrite');
      const store = tx.objectStore(collection);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retorna el número de documentos en una colección.
   */
  async count(collection: string): Promise<number> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const db = this.getDB();
      if (!db.objectStoreNames.contains(collection)) { resolve(0); return; }

      const tx = db.transaction(collection, 'readonly');
      const store = tx.objectStore(collection);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
