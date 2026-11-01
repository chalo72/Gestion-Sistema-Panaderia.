import { describe, it, expect } from 'vitest';
import { calcularAnalisisOperativo, lunesDeSemana } from '@/lib/analisis-operativo';
import type { CompromisoFijo, VentaDiaria } from '@/types';

describe('analisis-operativo', () => {
  it('lunesDeSemana apunta al lunes local', () => {
    // 2026-10-24 es sábado → lunes 19
    expect(lunesDeSemana('2026-10-24')).toBe('2026-10-19');
  });

  it('suma ventas semanales/quincenales y promedio proveedores', () => {
    const ventasDiarias: VentaDiaria[] = [
      {
        id: '1',
        fecha: '2026-10-06',
        totalEfectivo: 500000,
        totalNequi: 0,
        totalTransferencia: 0,
        totalCredito: 0,
        total: 500000,
        cajas: { 'Caja Tortas': 200000, 'Caja Helados': 100000, Principal: 200000 },
      } as VentaDiaria,
      {
        id: '2',
        fecha: '2026-10-13',
        totalEfectivo: 600000,
        totalNequi: 0,
        totalTransferencia: 0,
        totalCredito: 0,
        total: 600000,
        cajas: { 'Caja Tortas': 250000, Gaseosas: 50000, Principal: 300000 },
      } as VentaDiaria,
    ];

    const compromisos: CompromisoFijo[] = [
      {
        id: 'c1',
        nombre: 'Arriendo',
        monto: 800000,
        categoria: 'Arriendo',
        diaDeCobro: 5,
        frecuencia: 'mensual',
        activo: true,
      },
    ];

    const r = calcularAnalisisOperativo({
      ventas: [],
      ventasDiarias,
      gastos: [
        {
          fecha: '2026-10-07',
          monto: 200000,
          categoria: 'Materia Prima',
          proveedorId: 'p1',
          descripcion: 'Harina',
        },
        {
          fecha: '2026-10-14',
          monto: 100000,
          categoria: 'Materia Prima',
          proveedorId: 'p1',
          descripcion: 'Azúcar',
        },
        {
          fecha: '2026-10-08',
          monto: 150000,
          categoria: 'Servicios',
          descripcion: 'Pago Luz Local',
        },
      ],
      compromisos,
      proveedores: [{ id: 'p1', nombre: 'Mayorista Norte' }],
      bovedas: [{ id: 'b1', nombre: 'Efectivo', saldo: 0 }],
    });

    expect(r.rangoDatos.diasCubiertos).toBeGreaterThanOrEqual(8);
    expect(r.proveedores[0].nombre).toBe('Mayorista Norte');
    expect(r.proveedores[0].total).toBe(300000);
    expect(r.totalProveedores).toBe(300000);
    expect(r.lineasCaja.some((l) => l.label === 'Tortas')).toBe(true);
    expect(r.equilibrio.fijosMensuales).toBe(800000);
    expect(r.equilibrio.capitalTrabajoMinimo).toBeGreaterThan(0);
    expect(r.patrones.some((p) => p.clave === 'luz')).toBe(true);
    expect(r.semanal.length).toBeGreaterThan(0);
    expect(r.quincenal.length).toBeGreaterThan(0);
  });

  it('no inventa ventas si no hay datos', () => {
    const r = calcularAnalisisOperativo({
      ventas: [],
      ventasDiarias: [],
      gastos: [],
      compromisos: [],
    });
    expect(r.equilibrio.avisoDatos).toBeTruthy();
    expect(r.semanal).toHaveLength(0);
  });
});
