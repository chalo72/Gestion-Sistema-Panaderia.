// Prueba del pago INDIVIDUAL en Nómina: se paga a una trabajadora, la otra queda pendiente,
// lo no cobrado se acumula en el saldo y el pago deja abono + gasto + registro en historial.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Nomina from './Nomina';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const fmt = (n: number) => `$ ${n.toLocaleString('es-CO')}`;

const trab = (id: string, nombre: string, salarioBase: number) => ({
  id, nombre, estado: 'activo', salarioBase, rol: 'vendedor',
}) as any;

const credito = (id: string, trabajadorId: string, nombre: string, monto: number) => ({
  id, trabajadorId, trabajadorNombre: nombre, monto, saldo: monto, descripcion: 'prestamo',
  fecha: '2026-10-01', estado: 'activo', tipo: 'prestamo', items: [], descontarDeSalario: true,
  pagos: [], usuarioId: 'x', createdAt: '2026-10-01',
}) as any;

async function montar(props: any) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Nomina {...props} />); });
  return { el, root };
}

const clickTexto = async (el: HTMLElement, texto: string | RegExp, selector = 'button, div') => {
  const nodos = Array.from(el.querySelectorAll<HTMLElement>(selector));
  const n = nodos.filter(x => (typeof texto === 'string' ? x.textContent?.includes(texto) : texto.test(x.textContent || '')))
    .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
  if (!n) throw new Error(`No encontré "${texto}"`);
  await act(async () => { n.click(); });
};

describe('Nómina · pago individual', () => {
  it('paga solo a Samir, acumula lo no cobrado y deja la nómina en pagos parciales', async () => {
    const onAddGasto = vi.fn(async (g: any) => g);
    const onAddNomina = vi.fn(async (n: any) => ({ ...n, id: 'n1', createdAt: 'x' }));
    const onUpdateNomina = vi.fn(async () => {});
    const onUpdateCredito = vi.fn(async () => {});
    const { el } = await montar({
      trabajadores: [trab('t1', 'Samir', 1_000_000), trab('t2', 'Laura', 800_000)],
      asistencia: [],
      creditosTrabajadores: [credito('c1', 't1', 'Samir', 150_000)],
      nominas: [],
      onAddNomina, onUpdateNomina, onAddGasto,
      onAddCreditoTrabajador: vi.fn(), onUpdateCreditoTrabajador: onUpdateCredito, onDeleteCreditoTrabajador: vi.fn(),
      formatCurrency: fmt, onBack: vi.fn(),
    });

    // Sin seleccionar a nadie: no hay botón de guardar individual
    expect(el.textContent).toContain('Toca una trabajadora');

    // Selecciono a Samir -> aparece SU resumen y SU botón
    await clickTexto(el, 'Samir', 'p');
    expect(el.textContent).toContain('Pago de Samir');
    expect(el.textContent).toContain('GUARDAR PAGO DE SAMIR');

    // Cobra solo una parte: $50.000 de $150.000
    const input = el.querySelector<HTMLInputElement>('input[placeholder="Otro monto"]')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, '50000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(el.textContent).toContain('Quedará debiendo $ 100.000');

    await clickTexto(el, 'GUARDAR PAGO DE SAMIR', 'button');
    await clickTexto(el, '✓ Guardar pago', 'button');

    // Un gasto solo para Samir: 500.000 (media quincena) - 50.000
    expect(onAddGasto).toHaveBeenCalledTimes(1);
    expect(onAddGasto.mock.calls[0][0].monto).toBe(450_000);
    expect(onAddGasto.mock.calls[0][0].descripcion).toContain('Samir');

    // La deuda baja 150.000 -> 100.000, sigue activa y recibe un abono
    const cred = (onUpdateCredito.mock.calls[0] as any[])[0];
    expect(cred.saldo).toBe(100_000);
    expect(cred.estado).toBe('activo');
    expect(cred.pagos).toHaveLength(1);
    expect(cred.pagos[0].monto).toBe(50_000);

    // La nómina queda en pagos parciales (Laura sigue pendiente) con el pendiente de Samir
    const nomina = (onAddNomina.mock.calls[0] as any[])[0];
    expect(nomina.estado).toBe('borrador');
    expect(nomina.items).toHaveLength(1);
    expect(nomina.items[0].trabajadorNombre).toBe('Samir');
    expect(nomina.items[0].pendientes[0].saldo).toBe(100_000);
    expect(nomina.totalNeto).toBe(450_000);
  });

  it('resta los días que no vino y suma los días de más (valor del día = sueldo ÷ 30)', async () => {
    const onAddGasto = vi.fn(async (g: any) => g);
    const onAddNomina = vi.fn(async (n: any) => ({ ...n, id: 'n1', createdAt: 'x' }));
    const { el } = await montar({
      trabajadores: [trab('t1', 'Samir', 900_000)], // día = 30.000; quincena base = 450.000
      asistencia: [], creditosTrabajadores: [], nominas: [],
      onAddNomina, onUpdateNomina: vi.fn(), onAddGasto,
      onAddCreditoTrabajador: vi.fn(), onUpdateCreditoTrabajador: vi.fn(), onDeleteCreditoTrabajador: vi.fn(),
      formatCurrency: fmt, onBack: vi.fn(),
    });
    await clickTexto(el, 'Samir', 'p');

    const poner = async (el2: HTMLInputElement, v: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el2, v);
      el2.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="number"][step="0.5"]'));
    await poner(inputs[0], '2');   // 2 días que no vino  -> -60.000
    await poner(inputs[1], '1');   // 1 día de más        -> +30.000
    // 450.000 - 60.000 + 30.000 = 420.000
    expect(el.textContent).toContain('$ 420.000');
    expect(el.textContent).toContain('2 días que no vino');
    expect(el.textContent).toContain('1 día de más');

    await clickTexto(el, 'GUARDAR PAGO DE SAMIR', 'button');
    await clickTexto(el, '✓ Guardar pago', 'button');
    const item = (onAddNomina.mock.calls[0] as any[])[0].items[0];
    expect(item.valorBruto).toBe(420_000);
    expect(item.diasMenos).toBe(2);
    expect(item.diasExtra).toBe(1);
    expect(onAddGasto.mock.calls[0][0].monto).toBe(420_000);
  });
});
