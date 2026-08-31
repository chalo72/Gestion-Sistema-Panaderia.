import { describe, expect, it, beforeEach } from 'vitest';
import {
  contextoParaAgente,
  esTareaSensible,
  capturarMemoriaDesdeRespuestaInventario,
  leerMemoriaInventario,
  contextoGerente,
  type DatosCasas,
} from './agentes-casas';

const baseDatos = (): DatosCasas => ({
  fechaLabel: '2/8/2026',
  ventasHoy: 100000,
  ticketsHoy: 5,
  ticketPromedio: 20000,
  metodosTxt: 'efectivo: $100.000',
  topProductosTxt: 'Pan de bono ×12; Gaseosa 2L ×3',
  ultimosTicketsTxt: '$20.000 (efectivo); $15.000 (nequi)',
  gastosHoy: 2,
  egresosHoy: 20000,
  cajaAbierta: true,
  montoApertura: 50000,
  criticos: [{ nombre: 'Harina', stock: 1, min: 10 }],
  topCriticosTxt: 'Harina (stock 1 / mín 10)',
  ordenesProduccionAbiertas: 1,
  formulacionesActivas: 3,
  resumenProduccionTxt: 'Pan de bono [abierta]',
  memoriaInventarioTxt: '[26/7/2026] La semana pasada faltó harina',
  proveedoresActivos: 3,
  proveedoresTxt: 'Postobón; Molinos; Distribuidora Norte',
  ordenesCompraAbiertas: 2,
  resumenOrdenesCompraTxt: 'OC-1→Postobón [borrador] $80.000; OC-2→Molinos [enviado] $450.000',
  recepcionesRecientesTxt: 'Molinos $200.000',
  clientesActivos: 4,
  clientesTxt: 'Doña Rosa (frecuente) · 120 pts; Colegio San José (mayorista)',
  creditosActivos: 2,
  saldoCreditosPendiente: 85000,
  topDeudoresTxt: 'Doña Rosa $50.000 [activo]; Tienda El Puente $35.000 [vencido]',
  creditosVencidos: 1,
  trabajadoresActivos: 3,
  trabajadoresTxt: 'Ana [vendedor/activo]; Luis [panadero/activo]',
  adelantosTrabajadores: 1,
  saldoAdelantosTrabajadores: 40000,
  nominasRecientesTxt: '7/2026 primera [pagada]',
  margenesBajosTxt: 'Gaseosa 2L markup 5% (costo $3.000 → venta $3.150)',
  productosConPrecio: 40,
  sistemaOnline: true,
  sistemaResumenTxt: 'Red: online · Caja: abierta · Productos: 40 · Regla: LOCAL SIEMPRE GANA',
});

describe('agentes-casas — grafo por casa', () => {
  it('contable solo ve caja, no stock', () => {
    const ctx = contextoParaAgente('contable', baseDatos());
    expect(ctx).toMatch(/CAJA/);
    expect(ctx).toMatch(/Ventas hoy/);
    expect(ctx).not.toMatch(/Harina/);
    expect(ctx).toMatch(/NO tienes datos de cámaras ni stock/);
  });

  it('inventario solo ve stock + memoria', () => {
    const ctx = contextoParaAgente('inventario', baseDatos());
    expect(ctx).toMatch(/INVENTARIO/);
    expect(ctx).toMatch(/Harina/);
    expect(ctx).toMatch(/faltó harina/);
    expect(ctx).not.toMatch(/Caja POS abierta/);
  });

  it('odysseus solo CCTV', () => {
    const ctx = contextoParaAgente('odysseus', baseDatos());
    expect(ctx).toMatch(/VIDEOVIGILANCIA/);
    expect(ctx).not.toMatch(/Ventas hoy/);
  });

  it('produccion ve hornadas e insumos críticos', () => {
    const ctx = contextoParaAgente('produccion', baseDatos());
    expect(ctx).toMatch(/PRODUCCIÓN/);
    expect(ctx).toMatch(/Pan de bono/);
    expect(ctx).toMatch(/Harina/);
  });

  it('ventas ve tickets y top productos, no stock', () => {
    const ctx = contextoParaAgente('ventas', baseDatos());
    expect(ctx).toMatch(/VENTAS \/ POS/);
    expect(ctx).toMatch(/Pan de bono/);
    expect(ctx).toMatch(/Ticket promedio/);
    expect(ctx).not.toMatch(/Harina \(stock/);
  });

  it('hermes ve comanda rápida con top del día', () => {
    const ctx = contextoParaAgente('hermes', baseDatos());
    expect(ctx).toMatch(/HERMES/);
    expect(ctx).toMatch(/comanda/i);
    expect(ctx).toMatch(/Pan de bono/);
    expect(ctx).not.toMatch(/Caja POS abierta/);
  });

  it('logistica ve proveedores y OC, más faltantes para comprar', () => {
    const ctx = contextoParaAgente('logistica', baseDatos());
    expect(ctx).toMatch(/COMPRAS \/ LOGÍSTICA/);
    expect(ctx).toMatch(/Postobón/);
    expect(ctx).toMatch(/OC-1/);
    expect(ctx).toMatch(/Harina/);
    expect(ctx).not.toMatch(/Caja POS abierta/);
  });

  it('clientes ve maestro y remite fiados', () => {
    const ctx = contextoParaAgente('clientes', baseDatos());
    expect(ctx).toMatch(/CLIENTES \/ FIDELIZACIÓN/);
    expect(ctx).toMatch(/Doña Rosa/);
    expect(ctx).toMatch(/remite a agente creditos/i);
    expect(ctx).not.toMatch(/Harina \(stock/);
  });

  it('creditos ve deudores y saldos, no stock', () => {
    const ctx = contextoParaAgente('creditos', baseDatos());
    expect(ctx).toMatch(/CRÉDITOS \/ FIADOS/);
    expect(ctx).toMatch(/Doña Rosa/);
    expect(ctx).toMatch(/85\.000|85000/);
    expect(ctx).not.toMatch(/Harina \(stock/);
  });

  it('nomina ve equipo y adelantos', () => {
    const ctx = contextoParaAgente('nomina', baseDatos());
    expect(ctx).toMatch(/NÓMINA \/ PERSONAL/);
    expect(ctx).toMatch(/Ana/);
    expect(ctx).toMatch(/adelantos/i);
    expect(ctx).not.toMatch(/Harina \(stock/);
  });

  it('pico-claw ve márgenes bajos', () => {
    const ctx = contextoParaAgente('pico-claw', baseDatos());
    expect(ctx).toMatch(/MÁRGENES/);
    expect(ctx).toMatch(/markup/);
    expect(ctx).toMatch(/Gaseosa/);
  });

  it('open-claw ve salud de sistema', () => {
    const ctx = contextoParaAgente('open-claw', baseDatos());
    expect(ctx).toMatch(/SISTEMAS \/ SYNC/);
    expect(ctx).toMatch(/LOCAL SIEMPRE GANA/);
    expect(ctx).toMatch(/\/api\/agente/);
  });

  it('gerente tiene resumen amplio', () => {
    const ctx = contextoGerente(baseDatos());
    expect(ctx).toMatch(/Ventas hoy/);
    expect(ctx).toMatch(/stock crítico/);
    expect(ctx).toMatch(/Producción/);
    expect(ctx).toMatch(/Top productos/);
    expect(ctx).toMatch(/Compras/);
    expect(ctx).toMatch(/Fiados activos/);
    expect(ctx).toMatch(/Nómina/);
  });
});

describe('agentes-casas — aprobaciones', () => {
  it('detecta borrar gasto / cerrar caja', () => {
    expect(esTareaSensible('contable', 'Borrar el gasto de ayer')).toBe(true);
    expect(esTareaSensible('contable', 'Cerrar caja del turno')).toBe(true);
    expect(esTareaSensible('inventario', 'Listar stock crítico')).toBe(false);
  });

  it('detecta pedido grande por monto', () => {
    expect(esTareaSensible('logistica', 'Crear pedido de $1.200.000 a Molinos')).toBe(true);
  });
});

describe('agentes-casas — memoria inventario', () => {
  beforeEach(() => {
    localStorage.removeItem('dp_memoria_inventario');
  });

  it('guarda nota desde respuesta del agente', () => {
    const nota = capturarMemoriaDesdeRespuestaInventario(
      'ESTADO: 2 críticos\nFALTANTES: faltó harina de trigo\nACCIÓN: pedir 2 sacos'
    );
    expect(nota).toBeTruthy();
    const mem = leerMemoriaInventario();
    expect(mem.length).toBeGreaterThan(0);
    expect(mem[0].texto.toLowerCase()).toMatch(/harina|falt/);
  });
});
