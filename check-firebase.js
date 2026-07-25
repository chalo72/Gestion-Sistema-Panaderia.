import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const cols = ['clientes', 'ventas', 'creditos_clientes'];
    for (const col of cols) {
      const snap = await getDocs(collection(db, col));
      console.log(`Coleccion ${col}: ${snap.size} documentos`);
      if (snap.size > 0) {
        console.log(`Ejemplo ${col}:`, snap.docs[0].data());
      }
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
check();
