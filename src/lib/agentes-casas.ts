/**
 * Grafo por casa + memoria inventario + aprobación humana.
 * Sin LangGraph: cada AgenteId solo recibe el contexto de su casa.
 */

import type { AgenteId } from '@/types/agente-id';

const MEMORIA_INV_KEY = 'dp_memoria_inventario';
const MAX_MEMORIAS = 20;

export type MemoriaInventario = {
  texto: string;
  fecha: string;
  fuente: string;
};

export type DatosCasas = {
  fechaLabel: string;
  ventasHoy: number;
  ticketsHoy: number;
  ticketPromedio: number;
  metodosTxt: string;
  topProductosTxt: string;
  ultimosTicketsTxt: string;
  gastosHoy: number;
  egresosHoy: number;
  cajaAbierta: boolean;
  montoApertura: number | null;
  criticos: { nombre: string; stock: number; min: number }[];
  topCriticosTxt: string;
  ordenesProduccionAbiertas: number;
  formulacionesActivas: number;
  resumenProduccionTxt: string;
  memoriaInventarioTxt: string;
  proveedoresActivos: number;
  proveedoresTxt: string;
  ordenesCompraAbiertas: number;
  resumenOrdenesCompraTxt: string;
  recepcionesRecientesTxt: string;
  clientesActivos: number;
  clientesTxt: string;
  creditosActivos: number;
  saldoCreditosPendiente: number;
  topDeudoresTxt: string;
  creditosVencidos: number;
  trabajadoresActivos: number;
  trabajadoresTxt: string;
  adelantosTrabajadores: number;
  saldoAdelantosTrabajadores: number;
  nominasRecientesTxt: string;
  margenesBajosTxt: string;
  productosConPrecio: number;
  sistemaOnline: boolean;
  sistemaResumenTxt: string;
};

type LineaVenta = { nombre?: string; productoNombre?: string; cantidad?: number; qty?: number };
type VentaRow = {
  fecha?: string;
  createdAt?: string;
  total?: number;
  metodoPago?: string;
  productos?: LineaVenta[];
  items?: LineaVenta[];
};
type InvRow = {
  productoId?: string;
  stockActual?: number;
  cantidad?: number;
  stockMinimo?: number;
};
type ProdRow = {
  id: string;
  nombre?: string;
  deletedAt?: string;
  precioCosto?: number;
  precioVenta?: number;
  costo?: number;
};
type GastoRow = { fecha?: string; monto?: number; categoria?: string; estado?: string };
type OrdenRow = {
  id?: string;
  estado?: string;
  productoNombre?: string;
  nombre?: string;
  cantidad?: number;
  deletedAt?: string;
};
type FormRow = { id?: string; nombre?: string; activa?: boolean; deletedAt?: string };
type ProveedorRow = { id?: string; nombre?: string; deletedAt?: string; activo?: boolean };
type PrePedidoRow = {
  id?: string;
  nombre?: string;
  proveedorId?: string;
  estado?: string;
  total?: number;
  presupuestoMaximo?: number;
  numeroOrden?: string;
  deletedAt?: string;
};
type RecepcionRow = {
  id?: string;
  proveedorNombre?: string;
  proveedorId?: string;
  fecha?: string;
  createdAt?: string;
  total?: number;
  deletedAt?: string;
};
type ClienteRow = {
  id?: string;
  nombre?: string;
  tipo?: string;
  puntosLealtad?: number;
  deletedAt?: string;
};
type CreditoClienteRow = {
  id?: string;
  clienteNombre?: string;
  saldo?: number;
  monto?: number;
  estado?: string;
  fechaVencimiento?: string;
  deletedAt?: string;
};
type TrabajadorRow = {
  id?: string;
  nombre?: string;
  rol?: string;
  estado?: string;
  salarioBase?: number;
  horario?: string;
  deletedAt?: string;
};
type CreditoTrabRow = {
  id?: string;
  trabajadorNombre?: string;
  saldo?: number;
  estado?: string;
  deletedAt?: string;
};
type NominaRow = {
  id?: string;
  periodo?: string;
  estado?: string;
  mes?: number;
  anio?: number;
  deletedAt?: string;
};

const esHoy = (iso: string | undefined, hoy: string): boolean => {
  if (!iso) return false;
  try {
    return new Date(iso).toDateString() === hoy;
  } catch {
    return false;
  }
};

/**
 * Carga datos reales desde IndexedDB y arma el snapshot por casas.
 */
export const cargarDatosCasas = async (db: {
  getAllVentas: () => Promise<VentaRow[]>;
  getAllInventario: () => Promise<InvRow[]>;
  getAllProductos: () => Promise<ProdRow[]>;
  getSesionCajaActiva: () => Promise<{ montoInicial?: number } | null>;
  getAllGastos: () => Promise<GastoRow[]>;
  getAllOrdenesProduccion?: () => Promise<OrdenRow[]>;
  getAllFormulaciones?: () => Promise<FormRow[]>;
  getAllProveedores?: () => Promise<ProveedorRow[]>;
  getAllPrePedidos?: () => Promise<PrePedidoRow[]>;
  getAllRecepciones?: () => Promise<RecepcionRow[]>;
  getAllClientes?: () => Promise<ClienteRow[]>;
  getAllCreditosClientes?: () => Promise<CreditoClienteRow[]>;
  getAllTrabajadores?: () => Promise<TrabajadorRow[]>;
  getAllCreditosTrabajadores?: () => Promise<CreditoTrabRow[]>;
  getAllNominas?: () => Promise<NominaRow[]>;
}): Promise<DatosCasas> => {
  const hoy = new Date().toDateString();
  const [
    ventas,
    inventario,
    productos,
    sesionCaja,
    gastos,
    ordenes,
    formulaciones,
    proveedores,
    prepedidos,
    recepciones,
    clientes,
    creditosClientes,
    trabajadores,
    creditosTrab,
    nominas,
  ] = await Promise.all([
    db.getAllVentas().catch(() => [] as VentaRow[]),
    db.getAllInventario().catch(() => [] as InvRow[]),
    db.getAllProductos().catch(() => [] as ProdRow[]),
    db.getSesionCajaActiva().catch(() => null),
    db.getAllGastos().catch(() => [] as GastoRow[]),
    db.getAllOrdenesProduccion?.().catch(() => [] as OrdenRow[]) ?? Promise.resolve([] as OrdenRow[]),
    db.getAllFormulaciones?.().catch(() => [] as FormRow[]) ?? Promise.resolve([] as FormRow[]),
    db.getAllProveedores?.().catch(() => [] as ProveedorRow[]) ?? Promise.resolve([] as ProveedorRow[]),
    db.getAllPrePedidos?.().catch(() => [] as PrePedidoRow[]) ?? Promise.resolve([] as PrePedidoRow[]),
    db.getAllRecepciones?.().catch(() => [] as RecepcionRow[]) ?? Promise.resolve([] as RecepcionRow[]),
    db.getAllClientes?.().catch(() => [] as ClienteRow[]) ?? Promise.resolve([] as ClienteRow[]),
    db.getAllCreditosClientes?.().catch(() => [] as CreditoClienteRow[]) ??
      Promise.resolve([] as CreditoClienteRow[]),
    db.getAllTrabajadores?.().catch(() => [] as TrabajadorRow[]) ?? Promise.resolve([] as TrabajadorRow[]),
    db.getAllCreditosTrabajadores?.().catch(() => [] as CreditoTrabRow[]) ??
      Promise.resolve([] as CreditoTrabRow[]),
    db.getAllNominas?.().catch(() => [] as NominaRow[]) ?? Promise.resolve([] as NominaRow[]),
  ]);

  const ventasHoy = ventas.filter((v) => esHoy(v.fecha || v.createdAt, hoy));
  const totalHoy = ventasHoy.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
  const ticketPromedio =
    ventasHoy.length > 0 ? Math.round((totalHoy / ventasHoy.length) * 100) / 100 : 0;
  const porMetodo = ventasHoy.reduce<Record<string, number>>((acc, v) => {
    const m = (v.metodoPago || 'otro').toLowerCase();
    acc[m] = (acc[m] || 0) + (Number(v.total) || 0);
    return acc;
  }, {});

  const qtyPorProducto = new Map<string, number>();
  for (const v of ventasHoy) {
    const lineas = v.productos || v.items || [];
    for (const linea of lineas) {
      const nombre = (linea.nombre || linea.productoNombre || 'Producto').trim() || 'Producto';
      const qty = Number(linea.cantidad ?? linea.qty ?? 1) || 1;
      qtyPorProducto.set(nombre, (qtyPorProducto.get(nombre) || 0) + qty);
    }
  }
  const topProductosTxt =
    [...qtyPorProducto.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, qty]) => `${nombre} ×${qty}`)
      .join('; ') || 'sin desglose de productos en tickets de hoy';

  const ultimosTicketsTxt =
    [...ventasHoy]
      .slice(-5)
      .reverse()
      .map((v) => {
        const total = Number(v.total) || 0;
        const metodo = (v.metodoPago || 'otro').toLowerCase();
        return `$${total.toLocaleString('es-CO')} (${metodo})`;
      })
      .join('; ') || 'sin tickets recientes';

  const gastosHoyList = gastos.filter(
    (g) => esHoy(g.fecha, hoy) && (g.estado || '').toLowerCase() !== 'anulado'
  );
  const totalGastosHoy = gastosHoyList.reduce((s, g) => s + (Number(g.monto) || 0), 0);

  const nombrePorId = new Map(
    productos.filter((p) => !p.deletedAt).map((p) => [p.id, p.nombre || p.id])
  );
  const criticos = inventario
    .map((i) => {
      const stock = Number(i.stockActual ?? i.cantidad ?? 0);
      const min = Number(i.stockMinimo ?? 5);
      return {
        nombre: (i.productoId && nombrePorId.get(i.productoId)) || i.productoId || 'Sin nombre',
        stock,
        min,
      };
    })
    .filter((i) => i.stock < i.min)
    .sort((a, b) => a.stock - b.stock);

  const topCriticosTxt = criticos
    .slice(0, 12)
    .map((i) => `${i.nombre} (stock ${i.stock} / mín ${i.min})`)
    .join('; ');

  const ordenesVivas = ordenes.filter(
    (o) =>
      !o.deletedAt &&
      !['cerrada', 'cancelada', 'completada', 'done'].includes((o.estado || '').toLowerCase())
  );
  const formsActivas = formulaciones.filter((f) => !f.deletedAt && f.activa !== false);
  const resumenProduccionTxt =
    ordenesVivas
      .slice(0, 8)
      .map((o) => `${o.productoNombre || o.nombre || o.id || 'orden'} [${o.estado || 'sin estado'}]`)
      .join('; ') || 'sin órdenes abiertas';

  const proveedoresVivos = proveedores.filter((p) => !p.deletedAt && p.activo !== false);
  const nombreProvPorId = new Map(
    proveedoresVivos.map((p) => [p.id || '', p.nombre || p.id || 'Proveedor'])
  );
  const proveedoresTxt =
    proveedoresVivos
      .slice(0, 12)
      .map((p) => p.nombre || p.id || 'Proveedor')
      .join('; ') || 'sin proveedores activos';

  const ocAbiertas = prepedidos.filter(
    (p) =>
      !p.deletedAt &&
      ['borrador', 'enviado', 'pendiente', 'abierto'].includes((p.estado || '').toLowerCase())
  );
  const resumenOrdenesCompraTxt =
    ocAbiertas
      .slice(0, 8)
      .map((p) => {
        const prov =
          (p.proveedorId && nombreProvPorId.get(p.proveedorId)) || p.nombre || 'proveedor';
        const total = Number(p.total) || 0;
        const tope = Number(p.presupuestoMaximo) || 0;
        const orden = p.numeroOrden || p.id || 'OC';
        return `${orden}→${prov} [${p.estado || '?'}] $${total.toLocaleString('es-CO')}${tope > 0 ? ` / tope $${tope.toLocaleString('es-CO')}` : ''}`;
      })
      .join('; ') || 'sin órdenes de compra abiertas';

  const recepcionesRecientesTxt =
    [...recepciones]
      .filter((r) => !r.deletedAt)
      .slice(-5)
      .reverse()
      .map((r) => {
        const prov =
          r.proveedorNombre ||
          (r.proveedorId && nombreProvPorId.get(r.proveedorId)) ||
          'proveedor';
        const total = Number(r.total) || 0;
        return `${prov}${total > 0 ? ` $${total.toLocaleString('es-CO')}` : ''}`;
      })
      .join('; ') || 'sin recepciones recientes';

  const clientesVivos = clientes.filter((c) => !c.deletedAt && (c.nombre || '').trim());
  const clientesTxt =
    clientesVivos
      .slice(0, 12)
      .map((c) => {
        const tipo = c.tipo ? ` (${c.tipo})` : '';
        const pts =
          c.puntosLealtad != null && Number(c.puntosLealtad) > 0
            ? ` · ${Number(c.puntosLealtad)} pts`
            : '';
        return `${c.nombre}${tipo}${pts}`;
      })
      .join('; ') || 'sin clientes en maestro';

  const creditosPendientes = creditosClientes.filter((c) => {
    if (c.deletedAt) return false;
    const estado = (c.estado || '').toLowerCase();
    const saldo = Number(c.saldo) || 0;
    if (estado === 'pagado') return false;
    return saldo > 0 || estado === 'activo' || estado === 'vencido';
  });
  const saldoCreditosPendiente = creditosPendientes.reduce(
    (s, c) => s + (Number(c.saldo) || 0),
    0
  );
  const hoyMs = Date.now();
  const creditosVencidos = creditosPendientes.filter((c) => {
    if ((c.estado || '').toLowerCase() === 'vencido') return true;
    if (!c.fechaVencimiento) return false;
    try {
      return new Date(c.fechaVencimiento).getTime() < hoyMs;
    } catch {
      return false;
    }
  }).length;
  const topDeudoresTxt =
    [...creditosPendientes]
      .sort((a, b) => (Number(b.saldo) || 0) - (Number(a.saldo) || 0))
      .slice(0, 8)
      .map((c) => `${c.clienteNombre || 'Cliente'} $${(Number(c.saldo) || 0).toLocaleString('es-CO')} [${c.estado || '?'}]`)
      .join('; ') || 'sin deudores con saldo';

  const trabajadoresVivos = trabajadores.filter((t) => !t.deletedAt);
  const trabajadoresActivosList = trabajadoresVivos.filter(
    (t) => (t.estado || 'activo').toLowerCase() === 'activo'
  );
  const trabajadoresTxt =
    trabajadoresVivos
      .slice(0, 12)
      .map((t) => {
        const rol = t.rol || 'otro';
        const est = t.estado || 'activo';
        const horario = t.horario ? ` · ${t.horario}` : '';
        return `${t.nombre || 'Trabajador'} [${rol}/${est}]${horario}`;
      })
      .join('; ') || 'sin trabajadores registrados';

  const adelantosPendientes = creditosTrab.filter((c) => {
    if (c.deletedAt) return false;
    const estado = (c.estado || '').toLowerCase();
    if (estado === 'pagado' || estado === 'descontado') return false;
    return (Number(c.saldo) || 0) > 0;
  });
  const saldoAdelantosTrabajadores = adelantosPendientes.reduce(
    (s, c) => s + (Number(c.saldo) || 0),
    0
  );

  const nominasRecientesTxt =
    [...nominas]
      .filter((n) => !n.deletedAt)
      .slice(-4)
      .reverse()
      .map((n) => {
        const per = n.periodo || '?';
        const est = n.estado || '?';
        const periodoLabel =
          n.mes != null && n.anio != null ? `${n.mes}/${n.anio}` : n.id || 'nómina';
        return `${periodoLabel} ${per} [${est}]`;
      })
      .join('; ') || 'sin nóminas registradas';

  // Markup = (venta - costo) / costo × 100 — productos con margen bajo o negativo
  const conPrecio = productos.filter((p) => {
    if (p.deletedAt) return false;
    const costo = Number(p.precioCosto ?? p.costo ?? 0);
    const venta = Number(p.precioVenta ?? 0);
    return costo > 0 && venta > 0;
  });
  const margenesBajosTxt =
    conPrecio
      .map((p) => {
        const costo = Number(p.precioCosto ?? p.costo ?? 0);
        const venta = Number(p.precioVenta ?? 0);
        const markup = ((venta - costo) / costo) * 100;
        return { nombre: p.nombre || p.id, markup, costo, venta };
      })
      .filter((p) => p.markup < 15)
      .sort((a, b) => a.markup - b.markup)
      .slice(0, 10)
      .map(
        (p) =>
          `${p.nombre} markup ${Math.round(p.markup * 10) / 10}% (costo $${p.costo.toLocaleString('es-CO')} → venta $${p.venta.toLocaleString('es-CO')})`
      )
      .join('; ') || 'sin alertas de margen bajo (markup < 15%)';

  const sistemaOnline =
    typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
  const sistemaResumenTxt = [
    `Red: ${sistemaOnline ? 'online' : 'OFFLINE'}`,
    `Caja: ${sesionCaja ? 'abierta' : 'cerrada'}`,
    `Productos: ${productos.filter((p) => !p.deletedAt).length}`,
    `Proveedores: ${proveedoresVivos.length}`,
    `Tickets hoy: ${ventasHoy.length}`,
    `Trabajadores activos: ${trabajadoresActivosList.length}`,
    'Regla: LOCAL SIEMPRE GANA · tombstones · crítico IA = /api/agente',
  ].join(' · ');

  return {
    fechaLabel: new Date().toLocaleDateString('es-CO'),
    ventasHoy: totalHoy,
    ticketsHoy: ventasHoy.length,
    ticketPromedio,
    metodosTxt:
      Object.entries(porMetodo)
        .map(([m, t]) => `${m}: $${t.toLocaleString('es-CO')}`)
        .join(', ') || 'sin desglose',
    topProductosTxt,
    ultimosTicketsTxt,
    gastosHoy: gastosHoyList.length,
    egresosHoy: totalGastosHoy,
    cajaAbierta: Boolean(sesionCaja),
    montoApertura: sesionCaja?.montoInicial != null ? Number(sesionCaja.montoInicial) : null,
    criticos,
    topCriticosTxt,
    ordenesProduccionAbiertas: ordenesVivas.length,
    formulacionesActivas: formsActivas.length,
    resumenProduccionTxt,
    memoriaInventarioTxt: textoMemoriaParaContexto(),
    proveedoresActivos: proveedoresVivos.length,
    proveedoresTxt,
    ordenesCompraAbiertas: ocAbiertas.length,
    resumenOrdenesCompraTxt,
    recepcionesRecientesTxt,
    clientesActivos: clientesVivos.length,
    clientesTxt,
    creditosActivos: creditosPendientes.length,
    saldoCreditosPendiente,
    topDeudoresTxt,
    creditosVencidos,
    trabajadoresActivos: trabajadoresActivosList.length,
    trabajadoresTxt,
    adelantosTrabajadores: adelantosPendientes.length,
    saldoAdelantosTrabajadores,
    nominasRecientesTxt,
    margenesBajosTxt,
    productosConPrecio: conPrecio.length,
    sistemaOnline,
    sistemaResumenTxt,
  };
};

/** Contexto completo solo para el gerente (orquestador). */
export const contextoGerente = (d: DatosCasas): string =>
  [
    `CONTEXTO REAL PANADERÍA (${d.fechaLabel})`,
    `Ventas hoy: ${d.ticketsHoy} tickets · Total $${d.ventasHoy.toLocaleString('es-CO')} COP · Ticket prom. $${d.ticketPromedio.toLocaleString('es-CO')}`,
    `Por método: ${d.metodosTxt}`,
    d.topProductosTxt ? `Top productos: ${d.topProductosTxt}` : '',
    `Gastos/egresos hoy: ${d.gastosHoy} · $${d.egresosHoy.toLocaleString('es-CO')} COP`,
    `Caja POS abierta: ${d.cajaAbierta ? 'SÍ' : 'NO'}${d.montoApertura != null ? ` · apertura $${d.montoApertura.toLocaleString('es-CO')}` : ''}`,
    `Ítems stock crítico: ${d.criticos.length}`,
    d.topCriticosTxt
      ? `Faltantes/críticos (top): ${d.topCriticosTxt}`
      : 'Faltantes/críticos (top): ninguno reportado',
    `Producción: ${d.ordenesProduccionAbiertas} órdenes abiertas · ${d.formulacionesActivas} formulaciones · ${d.resumenProduccionTxt}`,
    `Compras: ${d.proveedoresActivos} proveedores · ${d.ordenesCompraAbiertas} OC abiertas`,
    `Clientes: ${d.clientesActivos} · Fiados activos: ${d.creditosActivos} · Saldo pendiente $${d.saldoCreditosPendiente.toLocaleString('es-CO')}`,
    `Nómina: ${d.trabajadoresActivos} activos · adelantos $${d.saldoAdelantosTrabajadores.toLocaleString('es-CO')}`,
    `Márgenes en riesgo: ${d.margenesBajosTxt.includes('sin alertas') ? 'ninguno' : 'hay alertas'}`,
    `Sistema: ${d.sistemaOnline ? 'online' : 'OFFLINE'}`,
    d.memoriaInventarioTxt ? `Memoria bodega: ${d.memoriaInventarioTxt}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

/**
 * Grafo por casa: cada especialista solo ve lo de su dominio.
 */
export const contextoParaAgente = (agente: AgenteId | string, d: DatosCasas): string => {
  const id = String(agente).toLowerCase();

  if (id === 'contable') {
    return [
      `CASA: CAJA / BANCO INTERNO (${d.fechaLabel})`,
      `Caja POS abierta: ${d.cajaAbierta ? 'SÍ' : 'NO'}${d.montoApertura != null ? ` · apertura $${d.montoApertura.toLocaleString('es-CO')}` : ''}`,
      `Ventas hoy: ${d.ticketsHoy} tickets · $${d.ventasHoy.toLocaleString('es-CO')} COP`,
      `Por método: ${d.metodosTxt}`,
      `Gastos/egresos hoy: ${d.gastosHoy} · $${d.egresosHoy.toLocaleString('es-CO')} COP`,
      'NO tienes datos de cámaras ni stock. Solo dinero del día.',
    ].join(' | ');
  }

  if (id === 'inventario') {
    return [
      `CASA: INVENTARIO / BODEGA (${d.fechaLabel})`,
      `Ítems stock crítico: ${d.criticos.length}`,
      d.topCriticosTxt
        ? `Faltantes/críticos: ${d.topCriticosTxt}`
        : 'Faltantes/críticos: ninguno reportado en IndexedDB',
      d.memoriaInventarioTxt
        ? `Memoria útil (semanas anteriores): ${d.memoriaInventarioTxt}`
        : 'Memoria útil: (vacía)',
      'Regla: números en nombres (40*30, 2L) son TEXTO, no cantidades.',
      'NO tienes datos de caja ni cámaras. Solo stock.',
    ].join(' | ');
  }

  if (id === 'odysseus') {
    return [
      `CASA: VIDEOVIGILANCIA / CCTV (${d.fechaLabel})`,
      'Solo analizas imagen de cámara. Sin imagen → SIN_IMAGEN.',
      'NO hables de caja, stock, márgenes ni marketing.',
    ].join(' | ');
  }

  if (id === 'produccion') {
    return [
      `CASA: PRODUCCIÓN / HORNO (${d.fechaLabel})`,
      `Órdenes abiertas: ${d.ordenesProduccionAbiertas}`,
      `Formulaciones activas: ${d.formulacionesActivas}`,
      `Resumen órdenes: ${d.resumenProduccionTxt}`,
      d.topCriticosTxt
        ? `Insumos críticos que pueden frenar horneado: ${d.topCriticosTxt}`
        : 'Insumos críticos: ninguno reportado',
      'NO inventes hornadas. Usa solo este contexto. No hables de cámaras ni impuestos.',
    ].join(' | ');
  }

  if (id === 'pico-claw') {
    return [
      `CASA: MÁRGENES / PRECIOS (${d.fechaLabel})`,
      `Ventas hoy: $${d.ventasHoy.toLocaleString('es-CO')} · Gastos hoy: $${d.egresosHoy.toLocaleString('es-CO')}`,
      `Tickets: ${d.ticketsHoy} · Métodos: ${d.metodosTxt}`,
      `Productos con precio costo+venta: ${d.productosConPrecio}`,
      `Alertas markup < 15%: ${d.margenesBajosTxt}`,
      d.topCriticosTxt ? `Señal stock (solo contexto): ${d.topCriticosTxt}` : '',
      'Markup = (venta - costo) / costo × 100. No propongas borrar datos. No cámaras ni nómina.',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (id === 'ventas') {
    return [
      `CASA: VENTAS / POS (${d.fechaLabel})`,
      `Tickets hoy: ${d.ticketsHoy} · Total $${d.ventasHoy.toLocaleString('es-CO')} COP`,
      `Ticket promedio: $${d.ticketPromedio.toLocaleString('es-CO')}`,
      `Por método: ${d.metodosTxt}`,
      `Top productos: ${d.topProductosTxt}`,
      `Últimos tickets: ${d.ultimosTicketsTxt}`,
      'NO tienes cámaras ni nómina. Solo ventas del mostrador/POS.',
    ].join(' | ');
  }

  if (id === 'hermes') {
    return [
      `CASA: HERMES / COMANDA RÁPIDA (${d.fechaLabel})`,
      `Referencia ventas hoy: ${d.ticketsHoy} tickets · $${d.ventasHoy.toLocaleString('es-CO')}`,
      `Top del día (para sugerir): ${d.topProductosTxt}`,
      `Últimos tickets: ${d.ultimosTicketsTxt}`,
      'Tu trabajo: armar borradores de comanda claros. No inventes precios sin dato.',
      'NO hables de cámaras, bóveda ni impuestos.',
    ].join(' | ');
  }

  if (id === 'logistica') {
    return [
      `CASA: COMPRAS / LOGÍSTICA (${d.fechaLabel})`,
      `Proveedores activos: ${d.proveedoresActivos}`,
      `Lista proveedores: ${d.proveedoresTxt}`,
      `Órdenes de compra abiertas: ${d.ordenesCompraAbiertas}`,
      `Detalle OC: ${d.resumenOrdenesCompraTxt}`,
      `Recepciones recientes: ${d.recepcionesRecientesTxt}`,
      d.topCriticosTxt
        ? `Faltantes que impulsan compra: ${d.topCriticosTxt}`
        : 'Faltantes que impulsan compra: ninguno reportado',
      d.memoriaInventarioTxt ? `Memoria bodega: ${d.memoriaInventarioTxt}` : '',
      'NO inventes proveedores ni montos. Pedidos ≥$500.000 requieren confirmación del Director.',
      'NO hables de cámaras ni nómina.',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (id === 'clientes') {
    return [
      `CASA: CLIENTES / FIDELIZACIÓN (${d.fechaLabel})`,
      `Clientes en maestro: ${d.clientesActivos}`,
      `Lista (muestra): ${d.clientesTxt}`,
      `Señal fiados (solo aviso): ${d.creditosActivos} activos · saldo $${d.saldoCreditosPendiente.toLocaleString('es-CO')}`,
      'Si hay deuda detallada, remite a agente creditos. NO inventes saldos.',
      'NO hables de cámaras, compras ni nómina.',
    ].join(' | ');
  }

  if (id === 'creditos') {
    return [
      `CASA: CRÉDITOS / FIADOS (${d.fechaLabel})`,
      `Créditos activos: ${d.creditosActivos}`,
      `Saldo pendiente total: $${d.saldoCreditosPendiente.toLocaleString('es-CO')}`,
      `Vencidos: ${d.creditosVencidos}`,
      `Top deudores: ${d.topDeudoresTxt}`,
      `Clientes en maestro (referencia): ${d.clientesActivos}`,
      'NO inventes deudas. Borrar/anular fiado requiere confirmación del Director.',
      'NO hables de cámaras ni stock.',
    ].join(' | ');
  }

  if (id === 'nomina') {
    return [
      `CASA: NÓMINA / PERSONAL (${d.fechaLabel})`,
      `Trabajadores activos: ${d.trabajadoresActivos}`,
      `Equipo: ${d.trabajadoresTxt}`,
      `Adelantos pendientes: ${d.adelantosTrabajadores} · saldo $${d.saldoAdelantosTrabajadores.toLocaleString('es-CO')}`,
      `Nóminas recientes: ${d.nominasRecientesTxt}`,
      'NO inventes salarios. Cambios sensibles requieren confirmación del Director.',
      'NO hables de cámaras ni stock.',
    ].join(' | ');
  }

  if (id === 'open-claw') {
    return [
      `CASA: SISTEMAS / SYNC (${d.fechaLabel})`,
      d.sistemaResumenTxt,
      `Stock crítico (señal integridad datos): ${d.criticos.length}`,
      `OC abiertas: ${d.ordenesCompraAbiertas} · Fiados: ${d.creditosActivos}`,
      'LOCAL SIEMPRE GANA. Tombstones. Crítico IA = /api/agente (no :9000).',
      'NO hables de pan, marketing ni nómina de personal.',
    ].join(' | ');
  }

  if (id === 'gerente') {
    return contextoGerente(d);
  }

  // Fallback mínimo: resumen corto sin filtrar de más (agentes aún no endurecidos)
  return contextoGerente(d);
};

const PATRON_SENSIBLE =
  /\b(borrar|eliminar|anular|cerrar\s*caja|cierre\s*de\s*caja|wipe|drop|vaciar|pedido\s*grande|orden\s*masiv|comprar\s+todo|destruir|hard.?delete|cambiar\s*salario|borrar\s*trabajador|liquidar\s*n[oó]mina)\b/i;

/** Detecta tareas que deben pausarse hasta que el Director confirme. */
export const esTareaSensible = (agente: string, tarea: string): boolean => {
  const texto = `${agente} ${tarea}`.toLowerCase();
  if (PATRON_SENSIBLE.test(texto)) return true;
  // Pedido con monto alto en COP (ej. $2.000.000 o 2000000)
  const monto = tarea.match(/\$?\s*([\d]{1,3}(?:[.\s]\d{3})+|\d{6,})/);
  if (monto) {
    const n = Number(monto[1].replace(/[.\s]/g, ''));
    if (!Number.isNaN(n) && n >= 500_000) return true;
  }
  return false;
};

export const leerMemoriaInventario = (): MemoriaInventario[] => {
  try {
    const raw = localStorage.getItem(MEMORIA_INV_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MemoriaInventario =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as MemoriaInventario).texto === 'string' &&
        typeof (m as MemoriaInventario).fecha === 'string'
    );
  } catch {
    return [];
  }
};

export const guardarMemoriaInventario = (texto: string, fuente = 'inventario'): void => {
  const limpio = texto.trim().slice(0, 280);
  if (limpio.length < 8) return;
  const prev = leerMemoriaInventario();
  const dup = prev.some((m) => m.texto.toLowerCase() === limpio.toLowerCase());
  if (dup) return;
  const next: MemoriaInventario[] = [
    { texto: limpio, fecha: new Date().toISOString(), fuente },
    ...prev,
  ].slice(0, MAX_MEMORIAS);
  try {
    localStorage.setItem(MEMORIA_INV_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
};

export const textoMemoriaParaContexto = (): string => {
  const items = leerMemoriaInventario().slice(0, 8);
  if (items.length === 0) return '';
  return items
    .map((m) => {
      const dia = new Date(m.fecha).toLocaleDateString('es-CO');
      return `[${dia}] ${m.texto}`;
    })
    .join(' · ');
};

/**
 * Extrae una nota corta de la respuesta del agente inventario
 * (ej. "faltó harina") para reutilizarla la próxima semana.
 */
export const capturarMemoriaDesdeRespuestaInventario = (respuesta: string): string | null => {
  const lineas = respuesta
    .split(/\n|;|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Prioriza faltantes/pedido concreto sobre "ESTADO: N críticos"
  const candidata =
    lineas.find((l) => /falt|sin stock|pedir|agot|pedido sugerido/i.test(l)) ||
    lineas.find((l) => /crít/i.test(l) && !/^estado\b/i.test(l)) ||
    (respuesta.length > 40 ? respuesta.slice(0, 160) : null);
  if (!candidata) return null;
  const nota = candidata.replace(/\s+/g, ' ').slice(0, 200);
  guardarMemoriaInventario(nota, 'agente-inventario');
  return nota;
};

/** Telemetría opcional — NUNCA bloquea ni es crítica. */
export const notificarTelemetriaOpcional = (mensaje: string, contexto: string): void => {
  const url = (import.meta.env.VITE_NEXUS_TELEMETRY_URL as string | undefined)?.trim();
  if (!url) return;
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, contexto }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};
