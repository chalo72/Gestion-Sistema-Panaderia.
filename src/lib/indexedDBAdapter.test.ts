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

  it('VersionError (base local más nueva que el código): abre la versión existente en vez de fallar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const primera = req;
    // El navegador responde que la base ya está en una versión mayor a la pedida.
    primera.onerror({ target: { error: { name: 'VersionError' } } });

    // Segunda apertura: sin número de versión.
    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1]).toHaveLength(1);
    const db = { close: vi.fn(), onversionchange: null as any };
    req.onsuccess({ target: { result: db } });
    await expect(p).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('VersionError y la segunda apertura también falla: rechaza y deja reintentar', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const rechazo = expect(p).rejects.toBeTruthy();
    req.onerror({ target: { error: { name: 'VersionError' } } });
    req.onerror({ target: { error: { name: 'UnknownError', message: 'backend roto' } } });
    await rechazo;
    adapter.init();
    expect(open).toHaveBeenCalledTimes(3);
    err.mockRestore();
    warn.mockRestore();
  });

  it('otros errores de apertura siguen rechazando sin abrir una segunda vez', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = new IndexedDBAdapter();
    const p = adapter.init();
    const rechazo = expect(p).rejects.toBeTruthy();
    req.onerror({ target: { error: { name: 'QuotaExceededError' } } });
    await rechazo;
    expect(open).toHaveBeenCalledTimes(1);
    err.mockRestore();
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
