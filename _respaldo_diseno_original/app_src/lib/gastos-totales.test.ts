import { describe, it, expect } from 'vitest';
import {
  extraerFechaYYYYMMDD,
  rangoSemana,
  rangoMes,
  rangoAnio,
  calcularTotalesPorPeriodo,
  agruparPorProveedor,
  aplicarFiltrosGastos,
  coincideTextoBusqueda,
  ID_SIN_PROVEEDOR,
  type RegistroGastoFiltro,
} from './gastos-totales';

function g(p: Partial<RegistroGastoFiltro> & { id: string; fecha: string; monto: number }): RegistroGastoFiltro {
  return {
    descripcion: p.descripcion || 'item',
    categoria: p.categoria || 'Otros',
    estado: p.estado || 'pagado',
    ...p,
  };
}

describe('gastos-totales', () => {
  it('extrae YYYY-MM-DD de fecha ISO', () => {
    expect(extraerFechaYYYYMMDD('2026-08-31T15:00:00.000Z')).toBe('2026-08-31');
  });

  it('semana va de lunes a domingo', () => {
    // miércoles 26 ago 2026
    const r = rangoSemana(new Date(2026, 7, 26));
    expect(r.inicio).toBe('2026-08-24');
    expect(r.fin).toBe('2026-08-30');
  });

  it('domingo cae en la semana que empezó el lunes anterior', () => {
    const r = rangoSemana(new Date(2026, 7, 30));
    expect(r.inicio).toBe('2026-08-24');
    expect(r.fin).toBe('2026-08-30');
  });

  it('mes y año van desde el inicio hasta el día de referencia', () => {
    const m = rangoMes(new Date(2026, 7, 15));
    expect(m.inicio).toBe('2026-08-01');
    expect(m.fin).toBe('2026-08-15');
    const a = rangoAnio(new Date(2026, 7, 15));
    expect(a.inicio).toBe('2026-01-01');
    expect(a.fin).toBe('2026-08-15');
  });

  it('hoy es un solo día', () => {
    const h = rangoHoy(new Date(2026, 7, 31));
    expect(h.inicio).toBe('2026-08-31');
    expect(h.fin).toBe('2026-08-31');
  });

  it('totales del mes suman egresos e ingresos y omiten anulados', () => {
    const gastos = [
      g({ id: '1', fecha: '2026-08-10', monto: 1000, esIngreso: false }),
      g({ id: '2', fecha: '2026-08-12', monto: 400, esIngreso: true }),
      g({ id: '3', fecha: '2026-08-13', monto: 50, estado: 'anulado' }),
      g({ id: '4', fecha: '2026-07-01', monto: 999 }),
    ];
    const t = calcularTotalesPorPeriodo(gastos, { inicio: '2026-08-01', fin: '2026-08-31' });
    expect(t.egresos).toBe(1000);
    expect(t.ingresos).toBe(400);
    expect(t.registros).toBe(2);
  });

  it('agrupa por proveedor de mayor a menor y junta sin proveedor', () => {
    const gastos = [
      g({ id: '1', fecha: '2026-08-10', monto: 200, proveedorId: 'p1' }),
      g({ id: '2', fecha: '2026-08-11', monto: 800, proveedorId: 'p1' }),
      g({ id: '3', fecha: '2026-08-12', monto: 100 }),
      g({ id: '4', fecha: '2026-08-12', monto: 50, esIngreso: true, proveedorId: 'p1' }),
    ];
    const rows = agruparPorProveedor(gastos, { p1: 'Harinas del Sur' }, { inicio: '2026-08-01', fin: '2026-08-31' });
    expect(rows[0].nombre).toBe('Harinas del Sur');
    expect(rows[0].total).toBe(1000);
    expect(rows[0].registros).toBe(2);
    expect(rows[1].proveedorId).toBe(ID_SIN_PROVEEDOR);
    expect(rows[1].total).toBe(100);
  });

  it('filtra por proveedor, categoría y búsqueda', () => {
    const gastos = [
      g({ id: '1', fecha: '2026-08-10', monto: 10, proveedorId: 'p1', categoria: 'Materia Prima', descripcion: 'harina' }),
      g({ id: '2', fecha: '2026-08-10', monto: 20, proveedorId: 'p2', categoria: 'Otros', descripcion: 'galleta' }),
    ];
    const out = aplicarFiltrosGastos(
      gastos,
      { periodo: 'mes', proveedorId: 'p1', categoria: 'Materia Prima', busqueda: 'har' },
      { p1: 'Harinas del Sur' },
      new Date(2026, 7, 15),
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('tienda de uno encuentra TIENDA D,UNO en todas las fechas', () => {
    expect(coincideTextoBusqueda('TIENDA D,UNO', 'tienda de uno')).toBe(true);
    expect(coincideTextoBusqueda('EL CARMEN TIENDA Y DISTRIBUIDORA', 'tienda de uno')).toBe(false);

    const gastos = [
      g({ id: '1', fecha: '2026-08-30', monto: 100, proveedorId: 'p1' }),
      g({ id: '2', fecha: '2026-07-01', monto: 50, proveedorId: 'p1' }),
      g({ id: '3', fecha: '2026-08-15', monto: 20, proveedorId: 'p2' }),
    ];
    const out = aplicarFiltrosGastos(
      gastos,
      { periodo: 'mes', busqueda: 'tienda de uno' },
      { p1: 'TIENDA D,UNO', p2: 'EL CARMEN TIENDA Y DISTRIBUIDORA' },
      new Date(2026, 7, 15),
    );
    expect(out.map((x) => x.id).sort()).toEqual(['1', '2']);
  });

  it('filtro sin proveedor deja solo filas sueltas', () => {
    const gastos = [
      g({ id: '1', fecha: '2026-08-10', monto: 10, proveedorId: 'p1' }),
      g({ id: '2', fecha: '2026-08-10', monto: 20 }),
    ];
    const out = aplicarFiltrosGastos(
      gastos,
      { periodo: 'todo', proveedorId: ID_SIN_PROVEEDOR },
      {},
    );
    expect(out.map((x) => x.id)).toEqual(['2']);
  });
});
