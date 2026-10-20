// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
const batch = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/nube-kv', () => ({ dbNube: { getBackup: async () => null, saveBackup: async () => {} } }));
vi.mock('@/lib/database', () => ({
    db: {
        getBackup: vi.fn().mockResolvedValue(null),
        saveBackup: vi.fn().mockResolvedValue(undefined),
        getAllTrabajadores: vi.fn().mockResolvedValue([{ nombre: 'Luis', estado: 'activo' }]),
        batchAjustarStock: (...a: any[]) => batch(...a),
    },
}));

import RutasReparto from './RutasReparto';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const catalogo = [{ productoId: 'p1', nombre: 'Pan Aliñado', costo: 500, precioMayorista: 800, pvp: 1000 }];
const clientes: any[] = [{ id: 'c1', nombre: 'Tienda La Esquina', tipo: 'mayorista', createdAt: '' }];

function escribir(el: HTMLInputElement, valor: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
function elegir(el: HTMLSelectElement, valor: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    act(() => { setter.call(el, valor); el.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('RutasReparto', () => {
    let host: HTMLDivElement; let root: Root;
    beforeEach(() => {
        localStorage.clear(); batch.mockClear();
        host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    });
    afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ''; });

    const q = (sel: string) => document.body.querySelector(sel) as HTMLElement;
    const clickTexto = async (sel: string, texto: string) => {
        const el = [...document.body.querySelectorAll(sel)].reverse().find(e => e.textContent?.includes(texto)) as HTMLElement;
        expect(el, `no se halló "${texto}"`).toBeTruthy();
        await act(async () => { el.click(); });
    };

    it('crea ruta, arma despacho, sale a ruta (descuenta inventario) y calcula lo dejado', async () => {
        const addCredito = vi.fn().mockResolvedValue(undefined);
        await act(async () => {
            root.render(
                <RutasReparto catalogo={catalogo} clientes={clientes} config={{ margenNegocio: 20, margenRevendedor: 25 }}
                    addCreditoCliente={addCredito} updateCliente={vi.fn()} formatCurrency={v => `$${Math.round(v)}`} usuarioId="u1" />
            );
        });

        // Ruta
        await clickTexto('button', 'Rutas');
        await clickTexto('button', 'Nueva ruta');
        escribir(q('input[placeholder^="Nombre (ej."]') as HTMLInputElement, 'Centro');
        const selTienda = [...document.body.querySelectorAll('select')].find(s => s.textContent?.includes('Agregar tienda')) as HTMLSelectElement;
        elegir(selTienda, 'c1');
        await clickTexto('button', 'Guardar ruta');
        expect(host.textContent).toContain('Centro');
        expect(host.textContent).toContain('1. Tienda La Esquina');

        // Despacho
        await clickTexto('button', 'Despachos');
        await clickTexto('button', 'Nuevo despacho');
        const rutaId = JSON.parse(localStorage.getItem('dp_rutas_reparto')!)[0].id;
        const selRuta = [...document.body.querySelectorAll('select')].find(s => s.textContent?.includes('Ruta…')) as HTMLSelectElement;
        elegir(selRuta, rutaId);
        escribir(q('input[placeholder="Vendedor que sale"]') as HTMLInputElement, 'Luis');
        escribir(q('input[placeholder^="Buscar producto"]') as HTMLInputElement, 'Pan');
        await clickTexto('button', 'Pan Aliñado');
        await clickTexto('button', 'Crear despacho');

        // Detalle: sale a ruta
        await clickTexto('button', 'Salir a ruta');
        expect(batch).toHaveBeenCalledTimes(1);
        const ajuste = batch.mock.calls[0][0][0];
        expect([ajuste.productoId, ajuste.cantidad, ajuste.tipo]).toEqual(['p1', 10, 'salida']);
        expect(document.body.textContent).toContain('En ruta');

        // Entrega en la tienda: dejó 8 → neto 8 × 800 = 6400, debe volver 2
        // (la primera tienda sin visitar ya viene desplegada)
        const dejo = document.body.querySelector('input[type="number"]') as HTMLInputElement;
        expect(dejo).toBeTruthy();
        escribir(dejo, '8');
        expect(document.body.textContent).toContain('$6400');
        expect(document.body.textContent).toContain('queda a crédito $6400');

        const guardado = JSON.parse(localStorage.getItem('dp_despachos_reparto') || '[]');
        expect(guardado[0].estado).toBe('en_ruta');

        // Liquida: lo no cobrado pasa a Créditos Clientes y el sobrante buenos vuelve al stock
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const regreso = [...document.body.querySelectorAll('input[type="number"]')].filter(i => (i as HTMLInputElement).placeholder === '') as HTMLInputElement[];
        // buenos de regreso = penúltimo grupo (buenos, dañados, efectivo): el primero tras los de la tienda
        const buenos = regreso.find(i => i.className.includes('col-span-2') && i.closest('div')?.textContent?.startsWith('Pan Aliñado2')) as HTMLInputElement;
        expect(buenos).toBeTruthy();
        escribir(buenos, '2');
        batch.mockClear();
        await clickTexto('button', 'Liquidar');
        expect(addCredito).toHaveBeenCalledTimes(1);
        expect(addCredito.mock.calls[0][0]).toMatchObject({ clienteId: 'c1', monto: 6400, saldo: 6400, estado: 'activo' });
        expect(batch).toHaveBeenCalledTimes(1);
        const entrada = batch.mock.calls[0][0][0];
        expect([entrada.productoId, entrada.cantidad, entrada.tipo]).toEqual(['p1', 2, 'entrada']);
        expect(JSON.parse(localStorage.getItem('dp_despachos_reparto')!)[0].estado).toBe('liquidado');
    });

    it('sin datos muestra los estados vacíos de análisis y vendedores', async () => {
        await act(async () => {
            root.render(
                <RutasReparto catalogo={catalogo} clientes={clientes} config={{ margenNegocio: 20, margenRevendedor: 25 }}
                    updateCliente={vi.fn()} formatCurrency={v => `$${v}`} usuarioId="u1" />
            );
        });
        await clickTexto('button', 'Tiendas');
        expect(host.textContent).toContain('El análisis aparece cuando registres visitas');
        await clickTexto('button', 'Vendedores');
        expect(host.textContent).toContain('El control del vendedor aparece al liquidar');
    });
});
