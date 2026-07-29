import { describe, it, expect } from 'vitest';
import { calcularProyeccionQuincena } from '@/lib/finanzas-personales';
import type { CompromisoFijo, VentaDiaria } from '@/types';

describe('calcularProyeccionQuincena', () => {
  const compromisos: CompromisoFijo[] = [
    {
      id: '1',
      nombre: 'Arriendo',
      monto: 500000,
      categoria: 'Arriendo',
      diaDeCobro: 5,
      frecuencia: 'mensual',
      activo: true,
    },
  ];

  it('no suma cierre manual el mismo día que hay POS', () => {
    const result = calcularProyeccionQuincena({
      ventas: [{ fecha: '2026-07-10', total: 100000, metodoPago: 'efectivo' }],
      ventasDiarias: [
        {
          id: 'vd1',
          fecha: '2026-07-10',
          totalEfectivo: 100000,
          totalNequi: 0,
          totalTransferencia: 0,
          totalCredito: 0,
          total: 100000,
        } as VentaDiaria,
      ],
      gastos: [],
      compromisos,
      periodo: { inicioStr: '2026-07-01', finStr: '2026-07-15', quincena: '1' },
    });
    expect(result.ingresosTotales).toBe(100000);
  });

  it('respeta el periodo filtrado (no la quincena de hoy)', () => {
    const result = calcularProyeccionQuincena({
      ventas: [
        { fecha: '2026-06-05', total: 200000, metodoPago: 'efectivo' },
        { fecha: '2026-07-05', total: 999999, metodoPago: 'efectivo' },
      ],
      ventasDiarias: [],
      gastos: [],
      compromisos: [],
      periodo: { inicioStr: '2026-06-01', finStr: '2026-06-15', quincena: '1' },
    });
    expect(result.ingresosTotales).toBe(200000);
    expect(result.diasRestantes).toBe(0); // periodo pasado
  });
});
