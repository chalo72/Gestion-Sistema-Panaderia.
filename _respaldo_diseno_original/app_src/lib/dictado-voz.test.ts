import { describe, it, expect } from 'vitest';
import {
  extraerTranscriptDesdeEvento,
  normalizarTranscriptDictado,
  separarItemsDictadoFactura,
  parsearItemDictadoGasto,
  limpiarDescripcionDictada,
  type SpeechRecognitionResultEvent,
} from './dictado-voz';

function mockSpeechEvent(
  items: Array<{ transcript: string; isFinal: boolean }>,
  resultIndex = 0
): SpeechRecognitionResultEvent {
  const results = items.map((item) => {
    const alt = [{ transcript: item.transcript }];
    return Object.assign(alt, { isFinal: item.isFinal, length: 1 });
  });
  return {
    resultIndex,
    results: Object.assign(results, { length: results.length }),
  } as SpeechRecognitionResultEvent;
}

describe('dictado-voz', () => {
  it('acumula finales sin perder el inicio', () => {
    const r1 = extraerTranscriptDesdeEvento(
      mockSpeechEvent([
        { transcript: 'cincuenta gaseosas', isFinal: true },
        { transcript: 'quince', isFinal: false },
      ]),
      ''
    );
    expect(r1.final).toBe('cincuenta gaseosas');
    expect(r1.completo).toContain('quince');

    // El motor reenvía resultados previos; resultIndex apunta al nuevo
    const r2 = extraerTranscriptDesdeEvento(
      mockSpeechEvent(
        [
          { transcript: 'cincuenta gaseosas', isFinal: true },
          { transcript: 'quince mil', isFinal: true },
        ],
        1
      ),
      r1.final
    );
    expect(r2.final).toBe('cincuenta gaseosas quince mil');
  });

  it('convierte quince mil a número', () => {
    expect(normalizarTranscriptDictado('quince mil')).toContain('15000');
  });

  it('no parte huevo y harina si no hay número después de y', () => {
    const items = separarItemsDictadoFactura('huevo y harina 15000');
    expect(items).toHaveLength(1);
  });

  it('separa ítems cuando hay y antes de número', () => {
    const items = separarItemsDictadoFactura('gaseosa 15000 y 12000 harina');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('limpia stopwords al inicio', () => {
    expect(limpiarDescripcionDictada('compré gaseosa postobon')).toMatch(/Gaseosa/i);
  });

  it('parsea cantidad y monto', () => {
    const item = parsearItemDictadoGasto('50 gaseosa 15000');
    expect(item.cantidad).toBe('50');
    expect(item.monto).toBe(15000);
    expect(item.descripcion.toLowerCase()).toContain('gaseosa');
  });

  it('conserva 5 onzas en el nombre del producto', () => {
    const item = parsearItemDictadoGasto('vaso de cinco onzas quince mil');
    expect(item.descripcion.toLowerCase()).toMatch(/5\s+onzas/);
    expect(item.monto).toBe(15000);
    expect(item.cantidad).toBe('1');
  });

  it('conserva *24 en empaque', () => {
    const item = parsearItemDictadoGasto('bretaña friopack *24 veinte mil');
    expect(item.descripcion).toMatch(/\*24/);
    expect(item.monto).toBe(20000);
  });

  it('convierte DOS (mayúsculas) a 2', () => {
    expect(normalizarTranscriptDictado('DOS omega quince mil')).toBe('2 omega 15000');
  });

  it('convierte dos mil a 2000', () => {
    expect(normalizarTranscriptDictado('dos mil')).toBe('2000');
  });

  it('parsea cantidad dicha en palabras', () => {
    const item = parsearItemDictadoGasto('DOS cafe quince mil');
    expect(item.cantidad).toBe('2');
    expect(item.monto).toBe(15000);
    expect(item.descripcion.toLowerCase()).toMatch(/cafe|café/);
  });

  it('cantidad al inicio y onzas en nombre', () => {
    const item = parsearItemDictadoGasto('3 vaso de 5 onzas doce mil');
    expect(item.cantidad).toBe('3');
    expect(item.descripcion.toLowerCase()).toMatch(/5\s+onzas/);
    expect(item.monto).toBe(12000);
  });

  it('pincho: 25 cm y por 100 son del empaque, no cantidad comprada', () => {
    const item = parsearItemDictadoGasto(
      'palo pincho delgado 25 centimetros por 100 quince mil'
    );
    expect(item.cantidad).toBe('1');
    expect(item.monto).toBe(15000);
    expect(item.descripcion.toLowerCase()).toMatch(/25/);
    expect(item.descripcion.toLowerCase()).toMatch(/centimetro|cm/);
    expect(item.descripcion.toLowerCase()).toMatch(/por\s*100/);
  });

  it('vaso 5 onzas por 50: conserva tamaño y empaque, cantidad 1', () => {
    const item = parsearItemDictadoGasto('vaso 5 onzas por 50 doce mil');
    expect(item.cantidad).toBe('1');
    expect(item.monto).toBe(12000);
    expect(item.descripcion.toLowerCase()).toMatch(/5\s+onzas/);
    expect(item.descripcion.toLowerCase()).toMatch(/por\s*50/);
  });

  it('vaso de cinco onzas por cincuenta no pierde el 5', () => {
    const item = parsearItemDictadoGasto('vaso de cinco onzas por cincuenta quince mil');
    expect(item.cantidad).toBe('1');
    expect(item.descripcion.toLowerCase()).toMatch(/5\s+onzas/);
    expect(item.descripcion.toLowerCase()).toMatch(/por\s*50/);
    expect(item.monto).toBe(15000);
  });
});
