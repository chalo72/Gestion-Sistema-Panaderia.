// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() } }));

import { OrdenarPanesModal } from './OrdenarPanesModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const SAL = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51';
const DULCE = '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52';
const prod = (id: string, nombre: string, categoria = 'Panes'): any => ({
  id, nombre, categoria, tipo: 'elaborado', precioVenta: 1000, margenUtilidad: 0, createdAt: '',
});
const modelo = (id: string, nombre: string, formulacionId: string, extra: any = {}): any => ({
  id, nombre, formulacionId, activo: true, precioVentaUnitario: 600, costoUnitario: 180, margenPorcentaje: 70, ...extra,
});

describe('OrdenarPanesModal (desde Modelos de pan)', () => {
  it('categoriza por masa, vincula, crea y mueve', async () => {
    const onAddCategoria = vi.fn().mockResolvedValue({});
    const onAddProducto = vi.fn().mockResolvedValue({ id: 'nuevo-1' });
    const onUpdateProducto = vi.fn().mockResolvedValue(undefined);
    const onUpdateModelo = vi.fn().mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <OrdenarPanesModal
          isOpen onOpenChange={() => {}}
          formulaciones={[{ id: SAL, nombre: 'Masa de Sal Mixta' } as any, { id: DULCE, nombre: 'Masa de Dulce' } as any]}
          modelosPan={[
            modelo('m1', 'Pan Mantequilla 45gr', SAL, { productoId: 'p1' }),      // vinculado, en Panes → mover
            modelo('m2', 'Pan queso dulce 45gr', DULCE),                           // sin vínculo, producto parecido → vincular
            modelo('m3', 'Pan de guayaba', DULCE),                                 // no existe → crear
            modelo('m4', 'Pan Aliñado', SAL, { productoId: 'p4' }),                // ya en Pan de sal → ok
          ]}
          productos={[
            prod('p1', 'Pan Mantequilla'),
            prod('p2', 'Pan queso dulce'),
            prod('p4', 'Pan Aliñado', 'Pan de sal'),
            prod('p9', 'Pan Suelto'),                                              // huérfano en Panes
          ]}
          categorias={[{ id: 'c1', nombre: 'Panes', color: '#000', tipo: 'venta' } as any, { id: 'c2', nombre: 'Pan de sal', color: '#000', tipo: 'venta' } as any]}
          onAddCategoria={onAddCategoria} onAddProducto={onAddProducto}
          onUpdateProducto={onUpdateProducto} onUpdateModelo={onUpdateModelo}
        />
      );
    });
    const body = document.body;
    // La lista sale de los modelos: 3 por ordenar + 1 huérfano; el 4º ya está listo
    expect(body.querySelectorAll('[data-modelo]').length).toBe(3);
    expect(body.querySelectorAll('[data-prod]').length).toBe(1);
    expect(body.textContent).toContain('Ya ordenados (1)');

    const boton = [...body.querySelectorAll('button')].find((b) => b.textContent?.includes('Aplicar')) as HTMLButtonElement;
    expect(boton.textContent).toContain('Aplicar 3 cambios'); // el huérfano no tiene pista → sin marcar
    await act(async () => { boton.click(); });

    expect(onAddCategoria).toHaveBeenCalledTimes(1);
    expect(onAddCategoria.mock.calls[0][0]).toBe('Pan de dulce');
    expect(onUpdateProducto).toHaveBeenCalledWith('p1', { categoria: 'Pan de sal' });
    expect(onUpdateProducto).toHaveBeenCalledWith('p2', { categoria: 'Pan de dulce' });
    expect(onUpdateModelo).toHaveBeenCalledWith('m2', { productoId: 'p2' });
    expect(onAddProducto).toHaveBeenCalledTimes(1);
    expect(onAddProducto.mock.calls[0][0]).toMatchObject({ nombre: 'Pan de guayaba', categoria: 'Pan de dulce', precioVenta: 600, tipo: 'elaborado' });
    expect(onUpdateModelo).toHaveBeenCalledWith('m3', { productoId: 'nuevo-1' });
    act(() => root.unmount());
  });
});
