import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import type { DatabaseAdapter } from './dbAdapter';

/**
 * 🛡️ [NEXUS-SHIELD] FirebaseAdapter — Modo Silencioso
 *
 * Firebase actúa como red de seguridad histórica (legacy backup).
 * Supabase + IndexedDB son los sistemas principales.
 *
 * REGLA: Si Firebase falla por permisos o conectividad, falla en
 * SILENCIO total. No lanza excepciones, no contamina logs, no
 * dispara el webhook de auditoría. Retorna datos vacíos como fallback.
 */

const FIREBASE_LOG_PREFIX = '🔥 [FIREBASE-BACKUP]';

export class FirebaseAdapter implements DatabaseAdapter {
  private db: any;
  private _ready = false;

  constructor(private config: any) {}

  async init() {
    try {
      const app = initializeApp(this.config);
      this.db = getFirestore(app);
      this._ready = true;
    } catch (e) {
      // Firebase no disponible — silencio total
      this._ready = false;
    }
  }

  async getCollection<T>(name: string): Promise<T[]> {
    if (!this._ready || !this.db) return [];
    try {
      const querySnapshot = await getDocs(collection(this.db, name));
      return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
    } catch (e: any) {
      // permission-denied y otros errores de Firebase → silencio
      // Solo logueamos en modo debug para no contaminar el webhook de auditoría
      if (import.meta.env.DEV) {
        console.debug(`${FIREBASE_LOG_PREFIX} Sin acceso a '${name}' (modo legado): ${e?.code || e?.message}`);
      }
      return [];
    }
  }

  async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    if (!this._ready || !this.db) return null;
    try {
      const docRef = doc(this.db, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as unknown as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  async setDocument<T>(collectionName: string, id: string, data: T): Promise<void> {
    if (!this._ready || !this.db) return;
    try {
      const docRef = doc(this.db, collectionName, id);
      await setDoc(docRef, data, { merge: true });
    } catch {
      // Fallo silencioso — Supabase es la fuente de verdad
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    if (!this._ready || !this.db) return;
    try {
      const docRef = doc(this.db, collectionName, id);
      await deleteDoc(docRef);
    } catch {
      // Fallo silencioso
    }
  }

  subscribe<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    if (!this._ready || !this.db) return () => {};
    try {
      return onSnapshot(
        collection(this.db, collectionName),
        (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
          callback(data);
        },
        (_error) => {
          // Error de suscripción → silencio total, no relanzar
        }
      );
    } catch {
      return () => {};
    }
  }
}
