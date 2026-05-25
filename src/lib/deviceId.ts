const DEVICE_ID_KEY = 'nexus_device_id';
const ECHO_WINDOW_MS = 8_000;

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Registro de escrituras propias → previene que el eco de Supabase Realtime
// dispare un banner de "cambio remoto" en el mismo dispositivo que escribió.
const selfWrites = new Map<string, number>();

export function registerSelfWrite(table: string, id: string): void {
  selfWrites.set(`${table}:${id}`, Date.now());
}

export function isSelfWrite(table: string, id: string): boolean {
  const key = `${table}:${id}`;
  const ts = selfWrites.get(key);
  if (!ts) return false;
  if (Date.now() - ts < ECHO_WINDOW_MS) {
    return true;
  }
  selfWrites.delete(key);
  return false;
}
