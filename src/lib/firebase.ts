import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// App nombrada para evitar colisión con la app default de database.ts
const APP_NAME = 'dulce-placer-auth';

let firestoreInstance: Firestore | null = null;

try {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[Firebase] Variables de entorno no configuradas — modo offline activo');
  } else {
    const app: FirebaseApp = getApps().some(a => a.name === APP_NAME)
      ? getApp(APP_NAME)
      : initializeApp(firebaseConfig, APP_NAME);
    firestoreInstance = getFirestore(app);
  }
} catch (e) {
  console.warn('[Firebase] No se pudo inicializar — el sistema funcionará en modo local:', e);
}

export const firestore = firestoreInstance;
