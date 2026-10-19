// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useConfirmar } from './useConfirmar';
import mayoristasSrc from '../pages/Mayoristas.tsx?raw';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('useConfirmar', () => {
  let root: Root;
  let host: HTMLElement;
  let api: ReturnType<typeof useConfirmar>;

  const Probe = () => {
    api = useConfirmar();
    return api.dialogo;
  };

  const boton = (texto: string) =>
    [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement | undefined;

  const preguntar = async (opciones = { titulo: '¿Eliminar este cliente?', confirmarTexto: 'Eliminar', destructivo: true }) => {
    let resultado: Promise<boolean> | undefined;
    await act(async () => { resultado = api.confirmar(opciones); });
    return { promesa: resultado as Promise<boolean> };
  };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(createElement(Probe)));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('muestra el diálogo con el título y no devuelve nada hasta que el usuario decide', async () => {
    let terminado = false;
    const { promesa: p } = await preguntar();
    p.then(() => { terminado = true; });
    expect(document.body.textContent).toContain('¿Eliminar este cliente?');
    await Promise.resolve();
    expect(terminado).toBe(false);
    await act(async () => { boton('Cancelar')!.click(); });
    await p;
  });

  it('devuelve true al pulsar el botón de confirmar', async () => {
    const { promesa: p } = await preguntar();
    expect(boton('Eliminar')).toBeTruthy();
    await act(async () => { boton('Eliminar')!.click(); });
    await expect(p).resolves.toBe(true);
    expect(document.body.textContent).not.toContain('¿Eliminar este cliente?');
  });

  it('devuelve false al pulsar Cancelar', async () => {
    const { promesa: p } = await preguntar();
    await act(async () => { boton('Cancelar')!.click(); });
    await expect(p).resolves.toBe(false);
  });

  it('devuelve false con Escape', async () => {
    const { promesa: p } = await preguntar();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(p).resolves.toBe(false);
  });

  it('una pregunta nueva cancela la anterior que siguiera abierta', async () => {
    const { promesa: primera } = await preguntar();
    const { promesa: segunda } = await preguntar({ titulo: 'Stock insuficiente', confirmarTexto: 'Vender de todas formas', destructivo: false });
    await expect(primera).resolves.toBe(false);
    expect(document.body.textContent).toContain('Stock insuficiente');
    await act(async () => { boton('Vender de todas formas')!.click(); });
    await expect(segunda).resolves.toBe(true);
  });
});

describe('Mayoristas — eliminaciones sin confirm() nativo', () => {
  it('eliminar cliente, abono, registro y venta con stock insuficiente usan useConfirmar', () => {
    expect(mayoristasSrc).not.toContain("!confirm('¿Seguro");
    expect(mayoristasSrc).not.toContain('window.confirm(`Stock insuficiente');
    expect(mayoristasSrc.match(/await confirmar\(/g)?.length).toBe(4);
    expect(mayoristasSrc).toContain("titulo: '¿Eliminar este cliente?'");
  });

  it('el diálogo se renderiza en las dos vistas (listado y perfil del cliente)', () => {
    expect(mayoristasSrc.match(/\{dialogo\}/g)?.length).toBe(2);
  });
});
