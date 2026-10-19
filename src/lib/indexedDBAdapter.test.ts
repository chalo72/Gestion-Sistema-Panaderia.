import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexedDBAdapter, INIT_TIMEOUT_MS } from './indexedDBAdapter';

/** Petición de apertura falsa: el test decide cuándo (o si) responde. */
const crearRequestFalso = () => {
  const req: any = { onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null, result: null };
  return req;
};

describe('IndexedDBAdapter.init — bloqueo por otra pestaña', () => {
  let req: any;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    open = vi.fn(() => { req = crearRequestFalso(); return req; });
    vi.stubGlobal('indexedDB', { open });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falla con error claro si la apertura nunca responde (antes quedaba colgada en el logo)', async () => {
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const resultado = expect(p).rejects.toThrow(/no respondió/);
    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS + 10);
    await resultado;
  });

  it('permite reintentar después de un timeout', async () => {
    const adapter = new IndexedDBAdapter();
    const p1 = adapter.init();
    const r1 = expect(p1).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS + 10);
    await r1;

    const p2 = adapter.init();
    expect(open).toHaveBeenCalledTimes(2);
    const db = { close: vi.fn(), onversionchange: null as any };
    req.onsuccess({ target: { result: db } });
    await expect(p2).resolves.toBeUndefined();
  });

  it('cierra una apertura tardía que llega después del timeout', async () => {
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const r = expect(p).rejects.toThrow();
    const primera = req;
    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS + 10);
    await r;
    const db = { close: vi.fn(), onversionchange: null as any };
    primera.onsuccess({ target: { result: db } });
    expect(db.close).toHaveBeenCalledOnce();
  });

  it('suelta la base cuando otra pestaña necesita actualizar la versión', async () => {
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const db = { close: vi.fn(), onversionchange: null as any };
    req.onsuccess({ target: { result: db } });
    await p;
    db.onversionchange();
    expect(db.close).toHaveBeenCalledOnce();
    // Tras soltarla, el siguiente init() vuelve a abrir en vez de usar una conexión cerrada.
    adapter.init();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('onblocked solo avisa en consola y no rechaza (la otra pestaña puede liberar a tiempo)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    req.onblocked();
    expect(warn).toHaveBeenCalled();
    const db = { close: vi.fn(), onversionchange: null as any };
    req.onsuccess({ target: { result: db } });
    await expect(p).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
