#!/usr/bin/env node

/**
 * Script para actualizar version.json antes de compilar
 * Se ejecuta automáticamente al correr 'npm run build'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFile = path.join(__dirname, '../public', 'version.json');

try {
  // Leer versión actual
  const currentVersion = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

  // Actualizar timestamp (importante para detección de cambios)
  const updatedVersion = {
    ...currentVersion,
    timestamp: Date.now(),
    buildDate: new Date().toISOString().split('T')[0],
    // Incrementar parche de versión
    version: incrementVersion(currentVersion.version)
  };

  // Guardar versión actualizada
  fs.writeFileSync(versionFile, JSON.stringify(updatedVersion, null, 2));

  console.log('✅ Versión actualizada:', updatedVersion.version);
  console.log('📦 Timestamp:', updatedVersion.timestamp);
  console.log('🔄 PC Ventas detectará actualización automáticamente');

} catch (error) {
  console.error('❌ Error actualizando versión:', error.message);
  process.exit(1);
}

/**
 * Incrementa versión semántica (1.0.0 → 1.0.1)
 */
function incrementVersion(version) {
  const parts = version.split('.');
  const patch = parseInt(parts[2]) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}
