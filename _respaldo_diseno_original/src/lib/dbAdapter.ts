/**
 * 🌍 ANTIGRAVITY DATABASE ADAPTER INTERFACE
 * Define las operaciones estándar que cualquier proveedor (Firebase, Appwrite, PocketBase) debe cumplir.
 */

export interface DatabaseAdapter {
  // Conectividad
  init(): Promise<void>;
  
  // Operaciones de Datos
  getCollection<T>(name: string): Promise<T[]>;
  getDocument<T>(collection: string, id: string): Promise<T | null>;
  setDocument<T>(collection: string, id: string, data: T): Promise<void>;
  deleteDocument(collection: string, id: string): Promise<void>;
  
  // Tiempo Real
  subscribe<T>(collection: string, callback: (data: T[]) => void): () => void;
}

// Singleton para la instancia activa
export let dbAdapter: DatabaseAdapter;

export function setAdapter(adapter: DatabaseAdapter) {
  dbAdapter = adapter;
}
