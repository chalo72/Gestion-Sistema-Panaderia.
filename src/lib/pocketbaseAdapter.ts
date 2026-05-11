import PocketBase from 'pocketbase';
import type { DatabaseAdapter } from './dbAdapter';

export class PocketBaseAdapter implements DatabaseAdapter {
  private pb: PocketBase;

  constructor(private url: string) {
    this.pb = new PocketBase(this.url);
  }

  async init() {
    console.log("🐻 [PocketBase]: Inicializado en", this.url);
  }

  async getCollection<T>(name: string): Promise<T[]> {
    const records = await this.pb.collection(name).getFullList();
    return records.map(record => ({ id: record.id, ...record } as unknown as T));
  }

  async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const record = await this.pb.collection(collectionName).getOne(id);
      return { id: record.id, ...record } as unknown as T;
    } catch (e) {
      return null;
    }
  }

  async setDocument<T>(collectionName: string, id: string, data: T): Promise<void> {
    try {
      // Intentamos actualizar
      await this.pb.collection(collectionName).update(id, data as any);
    } catch (e: any) {
      // Si no existe (status 404), creamos
      if (e.status === 404) {
        // En PocketBase se puede forzar el ID pasándolo en el objeto de creación
        await this.pb.collection(collectionName).create({ id, ...data as any });
      } else {
        throw e;
      }
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    await this.pb.collection(collectionName).delete(id);
  }

  subscribe<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    this.pb.collection(collectionName).subscribe('*', () => {
      // Al haber un cambio, recargamos la colección completa
      this.getCollection<T>(collectionName).then(callback);
    });
    
    return () => this.pb.collection(collectionName).unsubscribe('*');
  }
}
