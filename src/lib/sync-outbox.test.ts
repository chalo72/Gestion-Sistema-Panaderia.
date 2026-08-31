import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encolarOutbox,
  leerOutbox,
  flushOutbox,
  contarPendientesOutbox,
  quitarOutbox,
} from './sync-outbox';

describe('sync-outbox', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('encola un upsert fallido', () => {
    encolarOutbox('productos', 'upsert', { id: 'p1', nombre: 'Harina' }, 'network');
    expect(contarPendientesOutbox()).toBe(1);
    expect(leerOutbox()[0].table).toBe('productos');
  });

  it('no duplica el mismo id', () => {
    encolarOutbox('productos', 'upsert', { id: 'p1', nombre: 'A' });
    encolarOutbox('productos', 'upsert', { id: 'p1', nombre: 'B' });
    expect(contarPendientesOutbox()).toBe(1);
    expect((leerOutbox()[0].payload as { nombre: string }).nombre).toBe('B');
  });

  it('flush sube y limpia la cola', async () => {
    encolarOutbox('productos', 'upsert', { id: 'p1', nombre: 'Harina' });
    const upsert = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockResolvedValue(undefined);
    const ok = await flushOutbox({ upsert, delete: del });
    expect(ok).toBe(1);
    expect(upsert).toHaveBeenCalled();
    expect(contarPendientesOutbox()).toBe(0);
  });

  it('si falla el flush, mantiene el ítem', async () => {
    encolarOutbox('gastos', 'delete', 'g1');
    const upsert = vi.fn();
    const del = vi.fn().mockRejectedValue(new Error('offline'));
    await flushOutbox({ upsert, delete: del });
    expect(contarPendientesOutbox()).toBe(1);
    expect(leerOutbox()[0].attempts).toBe(1);
  });

  it('quitarOutbox elimina por id de cola', () => {
    encolarOutbox('clientes', 'upsert', { id: 'c1' });
    const id = leerOutbox()[0].id;
    quitarOutbox(id);
    expect(contarPendientesOutbox()).toBe(0);
  });
});
