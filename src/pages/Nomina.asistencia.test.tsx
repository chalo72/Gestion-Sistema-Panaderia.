// Coordinación Nómina ↔ Control de turno:
//  · días que no presionó "Llegué" se pueden marcar "sí vino" y se le pagan
//  · solo cuentan los días que le tocan según su horario
//  · si no presionó "Me voy", se completa con su hora normal de salida
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Nomina from './Nomina';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const fmt = (n: number) => `$ ${n.toLocaleString('es-CO')}`;

const reg = (id: string, fecha: string, tipo: 'entrada' | 'salida', hora: string) => ({
  id: `${id}-${fecha}-${tipo}`, trabajadorId: 't1', trabajadorNombre: 'Samir', tipo, fecha, hora, createdAt: fecha,
}) as any;

const clickBtn = async (el: HTMLElement, filtro: (b: HTMLElement) => boolean) => {
  const b = Array.from(el.querySelectorAll<HTMLElement>('button, p')).filter(filtro)
    .sort((a, c) => (a.textContent || '').length - (c.textContent || '').length)[0];
  if (!b) throw new Error('No encontré el elemento');
  await act(async () => { b.click(); });
};

describe('Nómina · coordinación con Control de turno', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('marca un día "sí vino", cuenta solo días de su horario y completa la salida olvidada', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0, 0)); // lunes 12 oct 2026 → 1ra quincena de octubre

    // Horario Lun-Vie 7am-3pm. Días que le tocan del 1 al 15 de oct: 1,2,5,6,7,8,9,12,13,14,15 = 11
    const dias = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const asistencia = dias.flatMap(f => [
      reg('a', f, 'entrada', '07:00'),
      ...(f === '2026-10-09' ? [] : [reg('a', f, 'salida', '15:00')]), // el 9 olvidó "Me voy"
    ]);
    const onAddAsistencia = vi.fn(async (r: any) => ({ ...r, id: 'x', createdAt: 'x' }));
    const onAddGasto = vi.fn(async (g: any) => g);
    const onAddNomina = vi.fn(async (n: any) => ({ ...n, id: 'n1', createdAt: 'x' }));

    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(<Nomina
        trabajadores={[{ id: 't1', nombre: 'Samir', estado: 'activo', salarioBase: 900_000, rol: 'vendedor', horario: 'Lun-Vie 7am-3pm' } as any]}
        asistencia={asistencia} onAddAsistencia={onAddAsistencia as any}
        creditosTrabajadores={[]} nominas={[]}
        onAddNomina={onAddNomina as any} onUpdateNomina={vi.fn()} onAddGasto={onAddGasto}
        onAddCreditoTrabajador={vi.fn() as any} onUpdateCreditoTrabajador={vi.fn()} onDeleteCreditoTrabajador={vi.fn()}
        formatCurrency={fmt} onBack={vi.fn()} />);
    });

    await clickBtn(el, x => x.tagName === 'P' && (x.textContent || '').startsWith('Samir'));
    expect(el.textContent).toContain('Asistencia de la quincena');
    expect(el.textContent).toContain('1 día sin marcar "Me voy"');
    expect(el.textContent).toContain('sale 3:00 pm');
    // el lunes 12 (hoy) le tocaba y no marcó "Llegué"
    expect(el.textContent).toContain('1 día sin marcar');

    // Pago por asistencia: 7 de 11 días → 450.000 × 7/11 = 286.364
    await clickBtn(el, x => x.tagName === 'BUTTON' && (x.textContent || '').includes('Activar pago por asistencia'));
    expect(el.textContent).toContain('$ 286.364');

    // Marca el 12 como "sí vino" → 8 de 11 → 327.273
    await clickBtn(el, x => x.tagName === 'BUTTON' && !!x.title?.includes('Sin marcar') && (x.textContent || '').includes('12'));
    expect(el.textContent).toContain('$ 327.273');

    // Guarda el pago: queda anotado en Control de turno (entrada+salida del 12 y salida automática del 9)
    await clickBtn(el, x => x.tagName === 'BUTTON' && (x.textContent || '').includes('GUARDAR PAGO DE SAMIR'));
    await clickBtn(el, x => x.tagName === 'BUTTON' && (x.textContent || '').includes('✓ Guardar pago'));

    expect(onAddGasto.mock.calls[0][0].monto).toBe(327_273);
    const regs = onAddAsistencia.mock.calls.map(c => c[0]);
    expect(regs).toHaveLength(3);
    expect(regs.find(r => r.fecha === '2026-10-09')).toMatchObject({ tipo: 'salida', hora: '15:00', origen: 'salida-automatica' });
    expect(regs.filter(r => r.fecha === '2026-10-12').map(r => `${r.tipo}@${r.hora}`).sort()).toEqual(['entrada@07:00', 'salida@15:00']);
    const item = (onAddNomina.mock.calls[0] as any[])[0].items[0];
    expect(item.diasVinoManual).toEqual(['2026-10-12']);
  });
});
