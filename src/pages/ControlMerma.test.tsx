// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

vi.mock('@/contexts/AuthContext', () => ({ useCan: () => ({ check: () => true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import ControlMerma from './ControlMerma';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const productos: any[] = [
  { id: 'p1', nombre: 'Pan Aliñado', categoria: 'Pan de sal', tipo: 'elaborado', precioVenta: 500, costoBase: 200, margenUtilidad: 0, createdAt: '' },
  { id: 'p2', nombre: 'Pan de Coco', categoria: 'Pan de dulce', tipo: 'elaborado', precioVenta: 800, costoBase: 300, margenUtilidad: 0, createdAt: '' },
  { id: 'p3', nombre: 'Harina', categoria: 'Harinas', tipo: 'ingrediente', precioVenta: 0, margenUtilidad: 0, createdAt: '' },
];
const inventario: any[] = [{ id: 'i1', productoId: 'p1', stockActual: 40, stockMinimo: 5 }];

describe('ControlMerma', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  const clickTexto = (sel: string, texto: string) => {
    const el = [...host.querySelectorAll(sel)].reverse().find((e) => e.textContent?.includes(texto)) as HTMLElement;
    expect(el, `no se halló ${texto}`).toBeTruthy();
    act(() => { el.click(); });
  };

  it('filtra por categoría, descuenta inventario con motivo de merma y lo muestra en el resumen', async () => {
    const onAjustarStock = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(
        <ControlMerma productos={productos} inventario={inventario} movimientos={[]} categorias={[]}
          onAjustarStock={onAjustarStock} formatCurrency={(v) => `$${v}`} usuarioNombre="Ana" />
      );
    });

    // Solo productos terminados; las categorías salen de los productos reales
    expect(host.textContent).toContain('Pan de sal (1)');
    expect(host.textContent).toContain('Pan de dulce (1)');
    expect(host.textContent).not.toContain('Harina');

    clickTexto('button', 'Pan de dulce (1)');
    expect(host.textContent).toContain('Pan de Coco');
    expect(host.textContent).not.toContain('Pan Aliñado');

    clickTexto('button', 'Pan de sal (1)');
    act(() => { (host.querySelector('[data-producto="p1"]') as HTMLElement).click(); });
    expect(host.textContent).toContain('En inventario: 40');

    act(() => { (host.querySelector('button[aria-label="Más"]') as HTMLElement).click(); }); // 2
    act(() => { (host.querySelector('[data-causa="Quemado en horno"]') as HTMLElement).click(); });
    await act(async () => { clickTexto('button', 'Registrar merma'); });

    expect(onAjustarStock).toHaveBeenCalledTimes(1);
    const [id, cant, tipo, motivo] = onAjustarStock.mock.calls[0];
    expect([id, cant, tipo]).toEqual(['p1', 2, 'salida']);
    expect(motivo).toMatch(/^Merma · Quemado en horno · por Ana · #\w{4}$/);
  });

  it('muestra las mermas guardadas y permite anular (devuelve stock)', async () => {
    const onAjustarStock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const movimientos: any[] = [
      { id: 'm1', productoId: 'p1', tipo: 'salida', cantidad: 4, motivo: 'Merma · Caída / accidente · por Ana · #zz99', fecha: new Date().toISOString(), usuario: 'x' },
    ];
    await act(async () => {
      root.render(
        <ControlMerma productos={productos} inventario={inventario} movimientos={movimientos} categorias={[]}
          onAjustarStock={onAjustarStock} formatCurrency={(v) => `$${v}`} />
      );
    });
    expect(host.querySelector('[data-testid="kpi-unidades"]')?.textContent).toBe('4');
    expect(host.querySelector('[data-testid="kpi-costo"]')?.textContent).toBe('$800');

    clickTexto('button', 'Historial');
    expect(host.textContent).toContain('4 × Pan Aliñado');
    await act(async () => { clickTexto('button', 'Anular'); });
    expect(onAjustarStock).toHaveBeenCalledWith('p1', 4, 'entrada', 'Anulación merma · #zz99');
  });
});
