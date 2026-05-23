import fs from 'fs';

async function generateRescueBundle() {
  console.log('Generando bundle de rescate desde Firebase...');
  const collections = ['productos', 'proveedores', 'precios', 'clientes'];
  const dump = {};

  for (const col of collections) {
    const url = `https://firestore.googleapis.com/v1/projects/app-fuxionfitgym/databases/(default)/documents/${col}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed ' + res.status);
      const data = await res.json();
      
      // Transform Firestore format to regular JSON
      dump[col] = (data.documents || []).map(doc => {
        const fields = doc.fields || {};
        const obj = { id: doc.name.split('/').pop() };
        for (const [k, v] of Object.entries(fields)) {
          if (v.stringValue !== undefined) obj[k] = v.stringValue;
          else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
          else if (v.doubleValue !== undefined) obj[k] = parseFloat(v.doubleValue);
          else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
        }
        return obj;
      });
      console.log(`✅ ${col}: ${dump[col].length} items rescatados.`);
    } catch (e) {
      console.log(`❌ Error recuperando ${col}: ${e.message}`);
    }
  }

  const outputContent = `export const RESCUE_DATA = ${JSON.stringify(dump, null, 2)};`;
  fs.writeFileSync('./src/lib/rescue.ts', outputContent);
  console.log(`\n🎉 BUNDLE GENERADO en src/lib/rescue.ts`);
}

generateRescueBundle().catch(console.error);
