import { Client, Databases, ID, Query } from 'appwrite';
import type { DatabaseAdapter } from './dbAdapter';

export class AppwriteAdapter implements DatabaseAdapter {
  private client: Client;
  private databases: Databases;

  constructor(private endpoint: string, private project: string, private databaseId: string) {
    this.client = new Client();
    this.databases = new Databases(this.client);
  }

  async init() {
    this.client
      .setEndpoint(this.endpoint)
      .setProject(this.project);
  }

  async getCollection<T>(name: string): Promise<T[]> {
    const response = await this.databases.listDocuments(this.databaseId, name);
    return response.documents.map(doc => ({ id: doc.$id, ...doc } as unknown as T));
  }

  async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const response = await this.databases.getDocument(this.databaseId, collectionName, id);
      return { id: response.$id, ...response } as unknown as T;
    } catch (e) {
      return null;
    }
  }

  async setDocument<T>(collectionName: string, id: string, data: T): Promise<void> {
    try {
      // Intentamos actualizar
      await this.databases.updateDocument(this.databaseId, collectionName, id, data as any);
    } catch (e: any) {
      // Si no existe (error 404), creamos
      if (e.code === 404) {
        await this.databases.createDocument(this.databaseId, collectionName, id, data as any);
      } else {
        throw e;
      }
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    await this.databases.deleteDocument(this.databaseId, collectionName, id);
  }

  subscribe<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    const unsubscribe = this.client.subscribe(
      `databases.${this.databaseId}.collections.${collectionName}.documents`,
      () => {
        // Al haber un cambio, recargamos la colección completa para cumplir con la interfaz
        this.getCollection<T>(collectionName).then(callback);
      }
    );
    return () => unsubscribe();
  }
}
