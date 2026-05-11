import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import type { DatabaseAdapter } from './dbAdapter';

export class FirebaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor(private config: any) {}

  async init() {
    const app = initializeApp(this.config);
    this.db = getFirestore(app);
  }

  async getCollection<T>(name: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(this.db, name));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
  }

  async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    const docRef = doc(this.db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as unknown as T;
    }
    return null;
  }

  async setDocument<T>(collectionName: string, id: string, data: T): Promise<void> {
    const docRef = doc(this.db, collectionName, id);
    // Usamos merge: true para no sobreescribir campos existentes por error
    await setDoc(docRef, data, { merge: true });
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    const docRef = doc(this.db, collectionName, id);
    await deleteDoc(docRef);
  }

  subscribe<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    return onSnapshot(collection(this.db, collectionName), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
      callback(data);
    });
  }
}
