/**
 * 🛡️ NEXUS BACKUP SERVICE — Rolling Window Snapshot System
 * Gestiona una ventana deslizante de backups en localStorage.
 * Patrón: Automatic Snapshot con Rolling Window (5 estados).
 */

const BACKUP_KEY = 'nexus_rolling_snapshots';
const MAX_SNAPSHOTS = 5;

export interface BackupState {
  id: string;
  timestamp: string;
  label: string;
  trigger: string; // Qué acción disparó el backup (add_item, delete, etc)
  data: any; 
}

export const backupService = {
  /**
   * Guarda un nuevo snapshot eliminando el más antiguo si excede el límite.
   */
  async createBackup(data: any, trigger: string = 'manual'): Promise<string> {
    const snapshots = this.getAllSnapshots();
    const id = `snap_${Date.now()}`;
    const label = `Backup ${new Date().toLocaleTimeString()} - ${trigger}`;
    
    const newSnapshot: BackupState = {
      id,
      timestamp: new Date().toISOString(),
      label,
      trigger,
      data
    };

    // Añadir al inicio y recortar a MAX_SNAPSHOTS (Rolling Window)
    const updated = [newSnapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
    
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(updated));
      console.log(`📸 [BACKUP]: Snapshot '${label}' creado exitosamente.`);
    } catch (e) {
      console.warn('⚠️ [BACKUP]: LocalStorage lleno, intentando con ventana reducida...', e);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(updated.slice(0, 2)));
    }

    return id;
  },

  getAllSnapshots(): BackupState[] {
    try {
      return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getLatestSnapshot(): BackupState | null {
    const all = this.getAllSnapshots();
    return all.length > 0 ? all[0] : null;
  },

  deleteOldest(): void {
    const all = this.getAllSnapshots();
    if (all.length > 0) {
      all.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
    }
  },

  clearAll(): void {
    localStorage.removeItem(BACKUP_KEY);
  }
};
