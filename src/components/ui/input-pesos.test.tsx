// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useState } from 'react';
import { InputPesos, soloDigitos } from './input-pesos';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const escribir = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('InputPesos', () => {
  it('acepta "80.000" con punto y entrega 80000', async () => {
    const visto = vi.fn();
    function Caso() { const [v, setV] = useState(0); return <InputPesos aria-label="m" value={v} onValor={n => { setV(n); visto(n); }} />; }
    await act(async () => { root.render(<Caso />); });
    const el = host.querySelector('input')!;
    await act(async () => { escribir(el, '80.000'); });
    expect(visto).toHaveBeenLastCalledWith(80000);
    expect(el.value).toBe('80.000');
    await act(async () => { escribir(el, '1250000'); });
    expect(el.value).toBe('1.250.000');
    await act(async () => { escribir(el, '8.00'); }); // borró un cero de "8.000"
    expect(visto).toHaveBeenLastCalledWith(800);
  });
  it('lee valores guardados con centavos', () => {
    expect(soloDigitos('2500.00')).toBe('2500');
    expect(soloDigitos(3017.5)).toBe('3017');
  });
});
