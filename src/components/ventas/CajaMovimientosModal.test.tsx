// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CajaMovimientosModal } from './CajaMovimientosModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement; let root: Root;
const setVal = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const boton = () => Array.from(document.querySelectorAll('button')).find(b => /Confirmar Salida/i.test(b.textContent || '')) as HTMLButtonElement;

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ''; });

// 2026-11-20: en el celular "80.000" dejaba el botón Confirmar apagado.
describe('Salida de caja', () => {
  it('acepta "80.000" con punto y guarda 80000', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await act(async () => { root.render(<CajaMovimientosModal isOpen onOpenChange={() => {}} tipo="salida" onSubmit={onSubmit} />); });
    expect(boton().disabled).toBe(true);

    await act(async () => { setVal(document.querySelector('input[aria-label="Monto"]') as HTMLInputElement, '80.000'); });
    expect(document.body.textContent).toContain('Escriba el motivo (ej: Gas)');
    expect((document.querySelector('input[aria-label="Monto"]') as HTMLInputElement).value).toBe('80.000');

    await act(async () => { setVal(document.querySelector('textarea') as HTMLTextAreaElement, 'Gas'); });
    expect(boton().disabled).toBe(false);

    await act(async () => { boton().click(); });
    expect(onSubmit).toHaveBeenCalledWith(80000, 'Gas', undefined);
  });
});
