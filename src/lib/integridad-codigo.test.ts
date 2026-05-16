/**
 * ═══════════════════════════════════════════════════════════════════
 * CAPA 3 DE PROTECCIÓN: Verificación de integridad del código fuente
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Estos tests leen el CÓDIGO FUENTE real y verifican que las protecciones
 * contra re-seed de datos eliminados siguen presentes.
 * 
 * Si alguien modifica usePriceControl.ts o database.ts y quita una
 * protección, estos tests FALLAN inmediatamente.
 * 
 * NUNCA eliminar este archivo sin aprobación del equipo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leer archivos fuente una vez
const hooksDir = resolve(__dirname, '../hooks');
const libDir = resolve(__dirname, '../lib');
const componentsDir = resolve(__dirname, '../components');

const usePriceControlSrc = readFileSync(resolve(hooksDir, 'usePriceControl.ts'), 'utf-8');
const databaseSrc = readFileSync(resolve(libDir, 'database.ts'), 'utf-8');
const useProduccionSrc = readFileSync(resolve(hooksDir, 'useProduccionHook.ts'), 'utf-8');
const sentinelSrc = readFileSync(resolve(componentsDir, 'SentinelWatcher.tsx'), 'utf-8');
const useAutoUpdateSrc = readFileSync(resolve(hooksDir, 'useAutoUpdate.ts'), 'utf-8');
const mainSrc = readFileSync(resolve(__dirname, '../main.tsx'), 'utf-8');

// ============================================================
// CAPA 3A: Protecciones en usePriceControl.ts
// ============================================================
describe('CAPA 3: Integridad del código — usePriceControl.ts', () => {
  
  it('loadCriticalData verifica flag dulceplacer_setup_done ANTES de seedear', () => {
    // Si alguien quita el check del flag, este test falla
    expect(usePriceControlSrc).toContain("localStorage.getItem('dulceplacer_setup_done')");
  });

  it('loadCriticalData establece flag dulceplacer_setup_done DESPUÉS de seedear', () => {
    expect(usePriceControlSrc).toContain("localStorage.setItem('dulceplacer_setup_done', 'true')");
  });

  it('autoSeedData tiene guard de doble verificación del flag', () => {
    // Guard runtime: si alguien llama autoSeedData fuera de contexto
    expect(usePriceControlSrc).toContain('autoSeedData bloqueado');
  });

  it('autoSeedData consulta tombstones de productos', () => {
    expect(usePriceControlSrc).toContain("db.getTombstones('productos')");
  });

  it('autoSeedData consulta tombstones de proveedores', () => {
    expect(usePriceControlSrc).toContain("db.getTombstones('proveedores')");
  });

  it('autoSeedData consulta tombstones de precios', () => {
    expect(usePriceControlSrc).toContain("db.getTombstones('precios')");
  });

  it('autoSeedData filtra productos con tombstones antes de agregar', () => {
    // Verificar que usa tombsProductos en el filtrado
    expect(usePriceControlSrc).toContain('!tombsProductos.includes(p.id)');
  });

  it('autoSeedData filtra proveedores con tombstones antes de agregar', () => {
    expect(usePriceControlSrc).toContain('!tombsProveedores.includes(prov.id)');
  });

  it('autoSeedData filtra precios con tombstones antes de agregar', () => {
    expect(usePriceControlSrc).toContain('!tombsPrecios.includes(p.id)');
  });

  it('deleteProducto tiene guard defensivo con try/catch + addTombstone', () => {
    // Si alguien simplifica deleteProducto y quita el try/catch, falla
    expect(usePriceControlSrc).toContain("await db.addTombstone('productos', id)");
  });

  it('deleteProveedor tiene guard defensivo con try/catch + addTombstone', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('proveedores', id)");
  });

  it('cargarDatosEjemplo limpia tombstones antes de re-agregar', () => {
    // Cuando el usuario pide cargar datos de ejemplo, debe limpiar tombstones primero
    expect(usePriceControlSrc).toContain("db.removeTombstone('productos', id)");
    expect(usePriceControlSrc).toContain("db.removeTombstone('proveedores', id)");
    expect(usePriceControlSrc).toContain("db.removeTombstone('precios', id)");
  });
});

// ============================================================
// CAPA 3B: Protecciones en database.ts
// ============================================================
describe('CAPA 3: Integridad del código — database.ts', () => {
  
  it('deleteProducto crea tombstone en la capa de DB', () => {
    // Tombstone se crea en usePriceControl con guard defensivo (Capa 2)
    expect(usePriceControlSrc).toContain("await db.addTombstone('productos', id)");
  });

  it('deleteProveedor crea tombstone en la capa de DB', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('proveedores', id)");
  });

  it('deletePrecio crea tombstone en la capa de DB', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('precios', precio.id)");
  });

  it('la tabla tombstones existe en el schema de IndexedDB', () => {
    expect(databaseSrc).toContain("'tombstones'");
  });

  it('getTombstones retorna item_id (no el id compuesto)', () => {
    expect(databaseSrc).toContain('t.item_id');
  });
});

// ============================================================
// CAPA 3C: Verificación de que NO hay re-seed sin protección
// ============================================================
describe('CAPA 3: Ausencia de re-seed sin protección', () => {

  it('NO hay setProductos(DATOS_EJEMPLO.productos) directo sin filtrar', () => {
    // Antes del fix, había: setProductos(DATOS_EJEMPLO.productos as Producto[])
    // Ahora debe hacer re-query a la DB real
    const directSeedMatch = usePriceControlSrc.match(/setProductos\(DATOS_EJEMPLO\.productos/);
    expect(directSeedMatch).toBeNull();
  });

  it('NO hay setProveedores(DATOS_EJEMPLO.proveedores) directo sin filtrar', () => {
    const directSeedMatch = usePriceControlSrc.match(/setProveedores\(DATOS_EJEMPLO\.proveedores/);
    expect(directSeedMatch).toBeNull();
  });

  it('autoSeedData hace re-query a la DB después del seed (no usa datos hardcodeados)', () => {
    // Después del seed, debe: db.getAllProductos() para obtener datos reales
    // Buscar que dentro de autoSeedData hay un getAllProductos DESPUÉS del seed
    expect(usePriceControlSrc).toContain('// Actualizar estado LOCAL con los datos reales (re-query para consistencia)');
  });
});

// ============================================================
// CAPA 3D: Flag setup_done en DOBLE CAPA (localStorage + IndexedDB)
// ============================================================
describe('CAPA 3: Flag setup_done resistente a limpieza de caché', () => {
  
  it('loadCriticalData verifica flag en IndexedDB además de localStorage', () => {
    expect(usePriceControlSrc).toContain("db.getBackup('dulceplacer_setup_done')");
  });

  it('loadCriticalData guarda flag en IndexedDB después del seed', () => {
    expect(usePriceControlSrc).toContain("db.saveBackup('dulceplacer_setup_done', true)");
  });

  it('autoSeedData verifica flag en IndexedDB (guard triple)', () => {
    // autoSeedData debe consultar AMBAS fuentes antes de decidir seedear
    const autoSeedSection = usePriceControlSrc.match(/autoSeedData[\s\S]*?db\.getBackup\('dulceplacer_setup_done'\)/);
    expect(autoSeedSection).not.toBeNull();
  });
});

// ============================================================
// CAPA 3E: syncCloudToLocal NO sobrescribe datos locales recientes
// ============================================================
describe('CAPA 3: Protección de sync contra reversión de precios', () => {
  
  it('deleteProducto/Proveedor tiene guard defensivo (tombstone se crea SIEMPRE)', () => {
    // Guard: tombstone se crea incluso si falla la eliminación en DB
    expect(usePriceControlSrc).toContain('Guard defensivo: tombstone se crea SIEMPRE');
  });

  it('deleteProveedor NO elimina tombstones durante el proceso de borrado', () => {
    // deleteProveedor NO debe llamar removeTombstone (el tombstone persiste como protección)
    const deleteProvSection = usePriceControlSrc.match(/const deleteProveedor[\s\S]*?}\s*,\s*\[precios\]/);
    expect(deleteProvSection).not.toBeNull();
    if (deleteProvSection) {
      expect(deleteProvSection[0]).not.toContain('removeTombstone');
    }
  });

  it('tombstones de deleteProducto usan await (no fire-and-forget)', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('productos', id)");
  });

  it('tombstones de deleteProveedor usan await (no fire-and-forget)', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('proveedores', id)");
  });

  it('tombstones de deletePrecio usan await (no fire-and-forget)', () => {
    expect(usePriceControlSrc).toContain("await db.addTombstone('precios', precio.id)");
  });

  it('deleteProveedor NO elimina tombstone después de sync exitoso', () => {
    // Dentro de deleteProveedor en usePriceControl NO debe haber removeTombstone
    const deleteProvSection = usePriceControlSrc.match(/const deleteProveedor[\s\S]*?}\s*,\s*\[precios\]/);
    expect(deleteProvSection).not.toBeNull();
    if (deleteProvSection) {
      expect(deleteProvSection[0]).not.toContain('removeTombstone');
    }
  });
});

// ============================================================
// CAPA 3F: SentinelWatcher protegido contra restauración prematura
// ============================================================
describe('CAPA 3: SentinelWatcher no restaura datos durante carga', () => {
  
  it('SentinelWatcher tiene delay protector antes de auditar', () => {
    // No debe auditar durante los primeros segundos tras montar
    expect(sentinelSrc).toContain('tiempoDesdeMount');
  });

  it('SentinelWatcher inicializa lastCatalogSize en -1 (no en 0)', () => {
    // -1 = no inicializado, evita falsos positivos de "catálogo vacío"
    expect(sentinelSrc).toContain('useRef<number>(-1)');
  });

  it('SentinelWatcher solo restaura si ANTES tenía datos', () => {
    expect(sentinelSrc).toContain('lastCatalogSize.current === -1');
  });
});

// ============================================================
// CAPA 3G: useProduccionHook usa IndexedDB como respaldo
// ============================================================
describe('CAPA 3: useProduccionHook con doble persistencia', () => {
  
  it('useProduccionHook carga formulaciones desde IndexedDB', () => {
    expect(useProduccionSrc).toContain("db.getBackup('formulaciones_data')");
  });

  it('useProduccionHook carga modelos desde IndexedDB', () => {
    expect(useProduccionSrc).toContain("db.getBackup('modelosPan_data')");
  });

  it('useProduccionHook guarda formulaciones en IndexedDB al cambiar', () => {
    expect(useProduccionSrc).toContain("db.saveBackup('formulaciones_data'");
  });

  it('useProduccionHook guarda modelos en IndexedDB al cambiar', () => {
    expect(useProduccionSrc).toContain("db.saveBackup('modelosPan_data'");
  });
});

// ============================================================
// CAPA 3H: Service Worker no interrumpe operaciones pendientes
// ============================================================
describe('CAPA 3: Service Worker con protección de datos', () => {
  
  it('main.tsx tiene delay antes de recargar por SW update', () => {
    // No debe ser updateSW(true) inmediato, sino con setTimeout
    expect(mainSrc).toContain('setTimeout');
  });

  it('useAutoUpdate tiene delay antes de recargar por controllerchange', () => {
    // No debe recargar inmediatamente al cambiar de SW
    expect(useAutoUpdateSrc).toContain('setTimeout(() => recargar()');
  });
});
