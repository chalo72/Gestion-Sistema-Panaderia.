import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

function checkIntegrity() {
  console.log('🔍 Iniciando Auditoría de Integridad Dulce Placer...');

  // 1. Verificar version.json
  const versionPath = path.join(rootDir, 'public', 'version.json');
  if (fs.existsSync(versionPath)) {
    const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    console.log(`✅ Versión Actual (Source): v${version.version} (Build: ${version.buildDate})`);
  } else {
    console.error('❌ Error: public/version.json no existe.');
  }

  // 2. Verificar si dist/ existe y su versión
  const distVersionPath = path.join(rootDir, 'dist', 'version.json');
  if (fs.existsSync(distVersionPath)) {
    const distVersion = JSON.parse(fs.readFileSync(distVersionPath, 'utf8'));
    console.log(`✅ Versión Compilada (Dist): v${distVersion.version}`);
  } else {
    console.warn('⚠️ Advertencia: La carpeta /dist no existe o no tiene version.json. Ejecuta "npm run build" para compilar.');
  }

  // 3. Verificar Sincronizador de Categorías
  const seedDataPath = path.join(rootDir, 'src', 'lib', 'seed-data.ts');
  if (fs.existsSync(seedDataPath)) {
    const content = fs.readFileSync(seedDataPath, 'utf8');
    const hasInsumos = content.includes('INS: Panadería') && content.includes('tipo: \'insumo\'');
    if (hasInsumos) {
      console.log('✅ Taxonomía de Insumos: CORRECTA');
    } else {
      console.error('❌ Error: src/lib/seed-data.ts no contiene las nuevas categorías de insumos.');
    }
  }

  console.log('\n🚀 RESUMEN:');
  console.log('Si los cambios no se ven en la web:');
  console.log('1. Ejecuta "npm run build"');
  console.log('2. Asegúrate de que el despliegue en Vercel se haya completado');
  console.log('3. La aplicación se actualizará automáticamente en el navegador tras unos segundos.');
}

checkIntegrity();
