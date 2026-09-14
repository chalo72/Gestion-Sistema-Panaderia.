import type { Gasto, GastoCategoria, MetodoPago } from '@/types';

export const ID_SIN_PROVEEDOR = '__sin_proveedor__';

export type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'anio' | 'rango' | 'todo';
export type TipoMovimientoFiltro = 'egresos' | 'ingresos' | 'ambos';
export type EstadoGastoFiltro = 'pendiente' | 'pagado' | 'anulado';

export interface RegistroGastoFiltro {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  estado?: string;
  proveedorId?: string;
  metodoPago?: string;
  esIngreso?: boolean;
  facturaItems?: { nombre: string }[];
}

export interface FiltrosGastos {
  periodo: PeriodoPreset;
  fechaDesde?: string;
  fechaHasta?: string;
  proveedorId?: string | null;
  categoria?: string | null;
  metodoPago?: string | null;
  estado?: EstadoGastoFiltro | null;
  tipo?: TipoMovimientoFiltro;
  busqueda?: string;
}

export interface RangoFechas {
  inicio: string;
  fin: string;
}

export interface TotalesPeriodo {
  egresos: number;
  ingresos: number;
  registros: number;
}

export interface TotalProveedor {
  proveedorId: string;
  nombre: string;
  registros: number;
  total: number;
}

export const FILTROS_GASTOS_VACIOS: FiltrosGastos = {
  periodo: 'todo',
  proveedorId: null,
  categoria: null,
  metodoPago: null,
  estado: null,
  tipo: 'ambos',
  busqueda: '',
};

export function fechaLocalYYYYMMDD(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extraerFechaYYYYMMDD(fecha: string): string {
  const s = (fecha || '').trim();
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

/** Solo el día de `ref` (hoy por defecto). */
export function rangoHoy(ref: Date = new Date()): RangoFechas {
  const f = fechaLocalYYYYMMDD(ref);
  return { inicio: f, fin: f };
}

/** Lunes a domingo de la semana de `ref` (lunes = primer día). */
export function rangoSemana(ref: Date = new Date()): RangoFechas {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dia = d.getDay();
  const aLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + aLunes);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { inicio: fechaLocalYYYYMMDD(lunes), fin: fechaLocalYYYYMMDD(domingo) };
}

export function rangoMes(ref: Date = new Date()): RangoFechas {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  // Hasta hoy (no cuenta días futuros del mes)
  const finMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const hoy = fechaLocalYYYYMMDD(ref);
  const finCal = fechaLocalYYYYMMDD(finMes);
  return { inicio: fechaLocalYYYYMMDD(inicio), fin: hoy < finCal ? hoy : finCal };
}

export function rangoAnio(ref: Date = new Date()): RangoFechas {
  const inicio = new Date(ref.getFullYear(), 0, 1);
  return { inicio: fechaLocalYYYYMMDD(inicio), fin: fechaLocalYYYYMMDD(ref) };
}

export function rangoDePeriodo(
  filtros: Pick<FiltrosGastos, 'periodo' | 'fechaDesde' | 'fechaHasta'>,
  ref: Date = new Date(),
): RangoFechas | null {
  if (filtros.periodo === 'todo') return null;
  if (filtros.periodo === 'rango') {
    return {
      inicio: extraerFechaYYYYMMDD(filtros.fechaDesde || '0000-01-01'),
      fin: extraerFechaYYYYMMDD(filtros.fechaHasta || '9999-12-31'),
    };
  }
  if (filtros.periodo === 'hoy') return rangoHoy(ref);
  if (filtros.periodo === 'semana') return rangoSemana(ref);
  if (filtros.periodo === 'anio') return rangoAnio(ref);
  return rangoMes(ref);
}

function estaEnRango(fecha: string, rango: RangoFechas | null): boolean {
  if (!rango) return true;
  const f = extraerFechaYYYYMMDD(fecha);
  return f >= rango.inicio && f <= rango.fin;
}

function esAnulado(g: RegistroGastoFiltro): boolean {
  return (g.estado || '').toLowerCase() === 'anulado';
}

export function calcularTotalesPorPeriodo(
  gastos: RegistroGastoFiltro[],
  rango: RangoFechas | null,
): TotalesPeriodo {
  let egresos = 0;
  let ingresos = 0;
  let registros = 0;
  for (const g of gastos) {
    if (esAnulado(g)) continue;
    if (!estaEnRango(g.fecha, rango)) continue;
    registros += 1;
    const monto = Number(g.monto) || 0;
    if (g.esIngreso) ingresos += monto;
    else egresos += monto;
  }
  return {
    egresos: Math.round(egresos * 100) / 100,
    ingresos: Math.round(ingresos * 100) / 100,
    registros,
  };
}

export function agruparPorProveedor(
  gastos: RegistroGastoFiltro[],
  nombres: Record<string, string>,
  rango: RangoFechas | null = null,
): TotalProveedor[] {
  const mapa = new Map<string, TotalProveedor>();
  for (const g of gastos) {
    if (g.esIngreso || esAnulado(g)) continue;
    if (!estaEnRango(g.fecha, rango)) continue;
    const id = g.proveedorId?.trim() ? g.proveedorId : ID_SIN_PROVEEDOR;
    const prev = mapa.get(id);
    const monto = Number(g.monto) || 0;
    if (prev) {
      prev.registros += 1;
      prev.total = Math.round((prev.total + monto) * 100) / 100;
    } else {
      mapa.set(id, {
        proveedorId: id,
        nombre: id === ID_SIN_PROVEEDOR ? 'Sin proveedor' : (nombres[id] || 'Proveedor'),
        registros: 1,
        total: Math.round(monto * 100) / 100,
      });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

/**
 * Lista principal de Gastos: muestra todo lo guardado salvo anulados.
 * Solo respeta búsqueda y chip de categoría (Otros/Todos).
 * No aplica periodo, proveedor, método ni estado — evita pantalla vacía por filtros ocultos.
 */
export function filtrarGastosParaLista<T extends RegistroGastoFiltro>(
  gastos: T[],
  filtros: Pick<FiltrosGastos, 'busqueda' | 'categoria'>,
  nombresProveedor: Record<string, string>,
): T[] {
  const busqueda = (filtros.busqueda || '').trim();
  return gastos
    .filter((g) => {
      if (esAnulado(g)) return false;
      if (filtros.categoria && g.categoria !== filtros.categoria) return false;
      if (busqueda && !coincideRegistroBusqueda(g, busqueda, nombresProveedor)) return false;
      return true;
    })
    .sort((a, b) =>
      extraerFechaYYYYMMDD(b.fecha).localeCompare(extraerFechaYYYYMMDD(a.fecha)),
    );
}

export function aplicarFiltrosGastos<T extends RegistroGastoFiltro>(
  gastos: T[],
  filtros: FiltrosGastos,
  nombresProveedor: Record<string, string>,
  ref: Date = new Date(),
): T[] {
  const busqueda = (filtros.busqueda || '').trim();
  // Con texto en el buscador: mirar TODAS las fechas (no solo el mes)
  const rango = busqueda ? null : rangoDePeriodo(filtros, ref);
  const tipo = filtros.tipo || 'ambos';

  return gastos.filter((g) => {
    if (!estaEnRango(g.fecha, rango)) return false;

    if (tipo === 'egresos' && g.esIngreso) return false;
    if (tipo === 'ingresos' && !g.esIngreso) return false;

    if (filtros.estado) {
      if ((g.estado || '') !== filtros.estado) return false;
    } else if (esAnulado(g)) {
      return false;
    }

    if (filtros.categoria && g.categoria !== filtros.categoria) return false;
    if (filtros.metodoPago && (g.metodoPago || '') !== filtros.metodoPago) return false;

    if (filtros.proveedorId) {
      if (filtros.proveedorId === ID_SIN_PROVEEDOR) {
        if (g.proveedorId?.trim()) return false;
      } else if (g.proveedorId !== filtros.proveedorId) {
        return false;
      }
    }

    if (busqueda && !coincideRegistroBusqueda(g, busqueda, nombresProveedor)) {
      return false;
    }

    return true;
  }).sort((a, b) => extraerFechaYYYYMMDD(b.fecha).localeCompare(extraerFechaYYYYMMDD(a.fecha)));
}

export function mapaNombresProveedor(proveedores: { id: string; nombre: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of proveedores) out[p.id] = p.nombre;
  return out;
}

/** Quita tildes, comas y deja texto limpio para comparar búsquedas. */
export function normalizarTextoBusqueda(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_BUSQUEDA = new Set(['de', 'del', 'la', 'el', 'y', 'en', 'a', 'un', 'una', 'los', 'las', 'al']);

/** Tokens útiles: "tienda de uno" → ["tienda", "uno"] */
export function tokensBusqueda(s: string): string[] {
  return normalizarTextoBusqueda(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_BUSQUEDA.has(t));
}

/**
 * Coincide descripción/proveedor/ítem con la búsqueda del usuario.
 * "tienda de uno" encuentra "TIENDA D,UNO".
 */
export function coincideTextoBusqueda(texto: string, query: string): boolean {
  const q = (query || '').trim();
  if (!q) return true;
  const h = normalizarTextoBusqueda(texto);
  if (!h) return false;
  const qn = normalizarTextoBusqueda(q);
  if (h.includes(qn)) return true;
  const tokens = tokensBusqueda(q);
  if (tokens.length === 0) return h.includes(qn);
  return tokens.every((t) => h.includes(t));
}

export function coincideRegistroBusqueda(
  g: RegistroGastoFiltro,
  query: string,
  nombresProveedor: Record<string, string>,
): boolean {
  const q = (query || '').trim();
  if (!q) return true;
  const nombreProv = g.proveedorId ? (nombresProveedor[g.proveedorId] || '') : '';
  if (coincideTextoBusqueda(nombreProv, q)) return true;
  if (coincideTextoBusqueda(g.descripcion || '', q)) return true;
  for (const item of g.facturaItems || []) {
    if (coincideTextoBusqueda(item.nombre || '', q)) return true;
  }
  return false;
}

export type GastoConIngreso = Gasto & { esIngreso?: boolean };

export const CATEGORIAS_FILTRO: GastoCategoria[] = [
  'Servicios',
  'Arriendo',
  'Materia Prima',
  'Nómina',
  'Mantenimiento',
  'Otros',
];

export const METODOS_FILTRO: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Datáfono' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];
