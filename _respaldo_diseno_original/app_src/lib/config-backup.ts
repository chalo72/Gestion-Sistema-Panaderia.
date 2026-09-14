/**
 * CONFIG BACKUP — Nivel 2 & 3 de protección
 * Guarda snapshots en localStorage (rápido, local) y permite restaurarlos.
 * Hasta 10 snapshots automáticos + snapshots manuales ilimitados.
 */

const STORAGE_KEY = 'dulceplacer_config_snapshots';
const MAX_AUTO_SNAPSHOTS = 10;

export interface ConfigSnapshot {
  id: string;
  label: string;
  tipo: 'auto' | 'manual';
  fecha: string;   // ISO 8601
  version: string; // versión de la app al momento del snapshot
  data: {
    configuracion?: Record<string, any>;
    productos?: any[];    // todos los productos con sus características
    proveedores?: any[];
    precios?: any[];      // vínculos producto-proveedor (cantidad, destino, costos)
  };
}

// ── GUARDAR ────────────────────────────────────────────────────────────────

export function guardarSnapshot(
  label: string,
  data: ConfigSnapshot['data'],
  tipo: 'auto' | 'manual' = 'auto'
): string {
  const todos = leerTodos();
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const nuevo: ConfigSnapshot = {
    id,
    label,
    tipo,
    fecha: new Date().toISOString(),
    version: '5.1.5',
    data,
  };

  // Para auto-snapshots: respetar límite máximo
  const autos = todos.filter(s => s.tipo === 'auto');
  const manuales = todos.filter(s => s.tipo === 'manual');
  const autosActualizados = tipo === 'auto'
    ? [nuevo, ...autos].slice(0, MAX_AUTO_SNAPSHOTS)
    : autos;
  const manualesActualizados = tipo === 'manual'
    ? [nuevo, ...manuales]
    : manuales;

  const actualizados = [...manualesActualizados, ...autosActualizados]
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizados));
  } catch {
    // localStorage lleno: eliminar los más viejos y reintentar
    const recortados = actualizados.slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recortados));
  }

  return id;
}

// ── LEER ───────────────────────────────────────────────────────────────────

export function leerTodos(): ConfigSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function leerSnapshot(id: string): ConfigSnapshot | null {
  return leerTodos().find(s => s.id === id) ?? null;
}

export function eliminarSnapshot(id: string): void {
  const actualizados = leerTodos().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizados));
}

// ── EXPORTAR / IMPORTAR ────────────────────────────────────────────────────

export function exportarSnapshotJSON(snapshot: ConfigSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_dulceplacer_${snapshot.fecha.slice(0, 10)}_${snapshot.tipo}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importarSnapshotJSON(archivo: File): Promise<ConfigSnapshot['data']> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        // Acepta snapshot completo o solo el data directamente
        const data = raw.data ?? raw;
        if (!data.configuracion && !data.proveedores && !data.precios) {
          throw new Error('El archivo no contiene datos válidos de Dulce Placer.');
        }
        resolve(data);
      } catch (err: any) {
        reject(new Error(err.message || 'Archivo JSON inválido'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(archivo);
  });
}

// ── HELPERS ────────────────────────────────────────────────────────────────

export function formatearFechaSnapshot(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}
