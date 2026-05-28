const DEVICE_ID_KEY  = 'nexus_device_id';
const ECHO_WINDOW_MS = 8_000;
const IDB_DB_NAME    = 'PriceControlDB';
const IDB_STORE      = 'configuracion';
const IDB_DOC_ID     = '_device';

// ── Raw IndexedDB helpers (no dependen del singleton db para evitar ciclos) ──

function idbReadDeviceId(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME);
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) { idb.close(); resolve(null); return; }
        try {
          const tx    = idb.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const get   = store.get(IDB_DOC_ID);
          get.onsuccess = () => { idb.close(); resolve(get.result?.value ?? null); };
          get.onerror   = () => { idb.close(); resolve(null); };
        } catch { idb.close(); resolve(null); }
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbWriteDeviceId(id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME);
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) { idb.close(); resolve(); return; }
        try {
          const tx    = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          store.put({ id: IDB_DOC_ID, value: id });
          tx.oncomplete = () => { idb.close(); resolve(); };
          tx.onerror    = () => { idb.close(); resolve(); };
        } catch { idb.close(); resolve(); }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Síncrono — usa localStorage como caché rápida. Compatible con código existente. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Async — persiste en IndexedDB (sobrevive "Limpiar caché" del navegador).
 * Migra automáticamente desde localStorage si ya existe un ID allí.
 * Llama esto una vez al arrancar la app para anclar el ID en IDB.
 */
export async function initDeviceId(): Promise<string> {
  // 1. Intentar leer de IndexedDB
  let id = await idbReadDeviceId();
  if (!id) {
    // 2. Migrar desde localStorage si existe
    id = localStorage.getItem(DEVICE_ID_KEY);
  }
  if (!id) {
    // 3. Generar nuevo
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  // Guardar en ambos lados
  localStorage.setItem(DEVICE_ID_KEY, id);
  await idbWriteDeviceId(id);
  return id;
}

// Registro de escrituras propias → previene que el eco de Supabase Realtime
// dispare un banner de "cambio remoto" en el mismo dispositivo que escribió.
const selfWrites = new Map<string, number>();

export function registerSelfWrite(table: string, id: string): void {
  selfWrites.set(`${table}:${id}`, Date.now());
}

export function isSelfWrite(table: string, id: string): boolean {
  const key = `${table}:${id}`;
  const ts = selfWrites.get(key);
  if (!ts) return false;
  if (Date.now() - ts < ECHO_WINDOW_MS) {
    return true;
  }
  selfWrites.delete(key);
  return false;
}
