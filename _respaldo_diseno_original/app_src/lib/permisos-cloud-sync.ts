/**
 * Sync de permisos (acciones + módulos visibles) vía Supabase.
 * Una fila por clave en tabla permisos_sistema.
 */
import { supabase } from './supabase';
import { registerSelfWrite } from './deviceId';

const TABLE = 'permisos_sistema';

export const PERMISSIONS_KEY = 'pricecontrol_permissions';
export const MODULOS_KEY = 'dp_permisos_modulos_v1';
export const PERMISOS_SYNC_EVENT = 'dp-permisos-sync';

interface PermisoRow {
  clave: string;
  valor: unknown;
  updated_at: string;
}

let aplicandoRemoto = false;

function tsKey(clave: string): string {
  return `dp_permiso_ts_${clave}`;
}

export function marcarPermisoLocal(clave: string): string {
  const ts = new Date().toISOString();
  localStorage.setItem(tsKey(clave), ts);
  return ts;
}

export function shouldSkipPermisoPush(): boolean {
  return aplicandoRemoto;
}

export async function pushPermisoBlob(clave: string, valor: unknown): Promise<boolean> {
  try {
    const updated_at = marcarPermisoLocal(clave);
    registerSelfWrite(TABLE, clave);
    const { error } = await supabase.from(TABLE).upsert(
      { clave, valor, updated_at },
      { onConflict: 'clave' },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function pullAllPermisos(): Promise<PermisoRow[]> {
  try {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error || !data) return [];
    return data as PermisoRow[];
  } catch {
    return [];
  }
}

function storageKeyForClave(clave: string): string {
  return clave === MODULOS_KEY || clave === PERMISSIONS_KEY ? clave : clave;
}

/** Aplica permiso remoto si la nube es más reciente (LOCAL GANA si el timestamp local es mayor). */
export function applyRemotePermiso(clave: string, valor: unknown, remoteAt: string): boolean {
  const localAt = localStorage.getItem(tsKey(clave)) || '';
  if (localAt && localAt >= remoteAt) return false;

  aplicandoRemoto = true;
  try {
    localStorage.setItem(storageKeyForClave(clave), JSON.stringify(valor));
    localStorage.setItem(tsKey(clave), remoteAt);

    if (clave === MODULOS_KEY) {
      window.dispatchEvent(new Event('dp_permisos_changed'));
    }
    if (clave === PERMISSIONS_KEY) {
      window.dispatchEvent(new Event('dp_permissions_changed'));
    }
    return true;
  } finally {
    aplicandoRemoto = false;
  }
}

export function notifyPermisosSync(reason: string): void {
  window.dispatchEvent(new CustomEvent(PERMISOS_SYNC_EVENT, { detail: { reason } }));
}

export async function sincronizarPermisosDesdeNube(): Promise<number> {
  const rows = await pullAllPermisos();
  let cambios = 0;
  for (const row of rows) {
    if (applyRemotePermiso(row.clave, row.valor, row.updated_at || '')) {
      cambios++;
    }
  }
  if (cambios > 0) notifyPermisosSync('pull_nube');
  return cambios;
}

/** Sube permisos locales actuales (si existen). */
export async function subirPermisosLocalesSiExisten(): Promise<void> {
  const permRaw = localStorage.getItem(PERMISSIONS_KEY);
  if (permRaw) {
    try {
      await pushPermisoBlob(PERMISSIONS_KEY, JSON.parse(permRaw) as unknown);
    } catch { /* ignore */ }
  }
  const modRaw = localStorage.getItem(MODULOS_KEY);
  if (modRaw) {
    try {
      await pushPermisoBlob(MODULOS_KEY, JSON.parse(modRaw) as unknown);
    } catch { /* ignore */ }
  }
}
