import type { DatabaseAdapter } from './dbAdapter';

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
const DB_VERSION = 1;

/** Colecciones conocidas — cada una se convierte en un Object Store de IndexedDB */
const COLLECTIONS = [
  'productos',
  'proveedores',
  'precios',
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
];

export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBDatabase | null = null;

  /** Abre (o crea) la base de datos y registra todos los Object Stores. */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
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
   * Hidrata la base de datos local con datos provenientes de la nube.
   * Usado al arrancar la app para cargar datos de Firebase → IndexedDB.
   * @param collection - Nombre de la colección
   * @param items - Array de documentos de la nube
   */
  async hydrateFromCloud<T extends { id: string }>(collection: string, items: T[]): Promise<void> {
    for (const item of items) {
      await this.setDocument(collection, item.id, item);
    }
    console.log(`☁️→🏠 [IndexedDB]: Hidratado '${collection}' con ${items.length} items de la nube.`);
  }

  /**
   * Borra todos los datos de una colección local.
   * Útil para forzar una re-sincronización desde la nube.
   */
  async clearCollection(collection: string): Promise<void> {
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
