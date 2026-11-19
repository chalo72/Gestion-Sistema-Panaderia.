import { describe, it, expect } from 'vitest';
import { esErrorDeRed } from './sync-outbox';

describe('cola de envíos: sin internet no se gastan intentos', () => {
  it('reconoce fallos por falta de internet', () => {
    expect(esErrorDeRed(new TypeError('Failed to fetch'))).toBe(true);
    expect(esErrorDeRed(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(esErrorDeRed(new TypeError('Load failed'))).toBe(true); // Safari / iPhone
    expect(esErrorDeRed('net::ERR_INTERNET_DISCONNECTED')).toBe(true);
    expect(esErrorDeRed(new Error('The operation timed out'))).toBe(true);
  });

  it('un error real del servidor sí cuenta como intento', () => {
    expect(esErrorDeRed(new Error('duplicate key value violates unique constraint'))).toBe(false);
    expect(esErrorDeRed(new Error('column "x" does not exist'))).toBe(false);
  });
});
