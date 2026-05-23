import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyA6m40NxjWcPbP6XZEzzNXiIvx9CPCMJj0",
  authDomain: "app-fuxionfitgym.firebaseapp.com",
  projectId: "app-fuxionfitgym",
  storageBucket: "app-fuxionfitgym.firebasestorage.app",
  messagingSenderId: "839881579975",
  appId: "1:839881579975:web:d7d7c4d125a2833a188de2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function rescueData() {
  console.log('Iniciando rescate de datos de Firebase...');
  const collections = ['productos', 'proveedores', 'precios', 'ventas', 'clientes'];
  const dump = {};

  for (const col of collections) {
    console.log(`Recuperando ${col}...`);
    try {
      const snapshot = await getDocs(collection(db, col));
      dump[col] = [];
      snapshot.forEach(doc => dump[col].push(doc.data()));
      console.log(`✅ ${col}: ${dump[col].length} items rescatados.`);
    } catch (e) {
      console.log(`❌ Error recuperando ${col}: ${e.message}`);
    }
  }

  const outputPath = path.resolve('./firebase-dump.json');
  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));
  console.log(`\n🎉 RESPALDO EXITOSO: Archivo guardado en ${outputPath}`);
}

rescueData().catch(console.error);
