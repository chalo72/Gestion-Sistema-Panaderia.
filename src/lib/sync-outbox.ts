/**
 * Cola de pendientes nube (outbox).
 * Si falla la subida a Supabase, se guarda y se reintenta al volver internet.
 * No traga el error en silencio: emite eventos para aviso en UI.
 */

const OUTBOX_KEY = 'dp_sync_outbox_v1';
const MAX_ITEMS = 200;
const MAX_ATTEMPTS = 8;

export type OutboxOp = 'upsert' | 'delete';

export type OutboxItem = {
  id: string;
  table: string;
  op: OutboxOp;
  /** Documento completo (upsert) o solo id (delete) */
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export type SyncStatusDetail = {
  kind: 'pending' | 'flushed' | 'error' | 'online';
  message: string;
  pendingCount: number;
};

const emitStatus = (detail: SyncStatusDetail): void => {
  try {
    window.dispatchEvent(new CustomEvent('dp-sync-status', { detail }));
  } catch {
    /* SSR / tests */
  }
};

export const leerOutbox = (): OutboxItem[] => {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is OutboxItem =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as OutboxItem).id === 'string' &&
        typeof (x as OutboxItem).table === 'string'
    );
  } catch {
    return [];
  }
};

const guardarOutbox = (items: OutboxItem[]): void => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota */
  }
};

export const contarPendientesOutbox = (): number => leerOutbox().length;

/**
 * Encola un fallo de subida. Idempotente por table+op+recordId.
 */
export const encolarOutbox = (
  table: string,
  op: OutboxOp,
  payload: unknown,
  errorMsg?: string
): void => {
  const recordId =
    op === 'delete'
      ? String(payload)
      : String((payload as { id?: string } | null)?.id ?? '');
  if (!recordId) return;

  const key = `${table}:${op}:${recordId}`;
  const prev = leerOutbox().filter((i) => i.id !== key);
  const next: OutboxItem = {
    id: key,
    table,
    op,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: errorMsg?.slice(0, 200),
  };
  guardarOutbox([next, ...prev]);
  emitStatus({
    kind: 'pending',
    message: `Cambio pendiente de subir (${table}). Se reintentará solo.`,
    pendingCount: contarPendientesOutbox(),
  });
};

export const quitarOutbox = (itemId: string): void => {
  guardarOutbox(leerOutbox().filter((i) => i.id !== itemId));
};

type FlushHandlers = {
  upsert: (table: string, data: unknown) => Promise<void>;
  delete: (table: string, id: string) => Promise<void>;
};

/**
 * Reintenta pendientes. Devuelve cuántos se lograron subir.
 */
export const flushOutbox = async (handlers: FlushHandlers): Promise<number> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emitStatus({
      kind: 'pending',
      message: 'Sin internet: los cambios quedan en cola.',
      pendingCount: contarPendientesOutbox(),
    });
    return 0;
  }

  const items = leerOutbox();
  if (items.length === 0) return 0;

  let ok = 0;
  const remaining: OutboxItem[] = [];

  for (const item of items) {
    try {
      if (item.op === 'delete') {
        await handlers.delete(item.table, String(item.payload));
      } else {
        await handlers.upsert(item.table, item.payload);
      }
      ok += 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = item.attempts + 1;
      if (attempts < MAX_ATTEMPTS) {
        remaining.push({ ...item, attempts, lastError: msg.slice(0, 200) });
      } else {
        emitStatus({
          kind: 'error',
          message: `No se pudo subir ${item.table} tras ${MAX_ATTEMPTS} intentos.`,
          pendingCount: remaining.length + 1,
        });
        remaining.push({ ...item, attempts, lastError: msg.slice(0, 200) });
      }
    }
  }

  guardarOutbox(remaining);
  if (ok > 0) {
    emitStatus({
      kind: 'flushed',
      message:
        remaining.length === 0
          ? `Nube al día: ${ok} cambio(s) subido(s).`
          : `Subidos ${ok}. Quedan ${remaining.length} pendientes.`,
      pendingCount: remaining.length,
    });
  }
  return ok;
};
