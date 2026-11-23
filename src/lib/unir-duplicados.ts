/**
 * Reglas estrictas para UNIR productos duplicados (2026-11-23, pedido de Gonzalo).
 *
 * Gonzalo: «que sea riguroso, bien estricto… que no genere que vaya uno a cobrar de más o mal».
 * Este archivo solo DECIDE (plan); no escribe nada. Niveles:
 *  - 🟢 seguro : mismo nombre (o 1 letra de diferencia), mismo tamaño, misma categoría o proveedor,
 *               y los precios/costos cuadran (paca ÷ unidades ≈ costo del suelto, ±30%;
 *               sueltos: precio de venta ±25%).
 *  - 🟡 dudoso : falla alguna regla → solo se une si Gonzalo lo decide (se dice el motivo).
 *  - 🔴 nunca  : tamaños o números distintos (ya los descarta productos-duplicados.ts).
 * El precio de venta del producto que se queda NUNCA cambia; solo se completa si estaba vacío.
 */
import { analizarNombre, buscarDuplicados, type InfoNombre } from './productos-duplicados';

export type Nivel = 'seguro' | 'dudoso';

export interface ProveedorDeProducto { proveedorId: string; proveedor?: string; costo: number; cantidadEmbalaje: number }

export interface ProductoUnion {
  id: string;
  nombre: string;
  categoria?: string;
  precioVenta: number;
  costoBase?: number;
  margenUtilidad?: number;
  tipo?: string;
  stock?: number;
  proveedores?: ProveedorDeProducto[];
  updatedAt?: string;
}

export interface PlanUnion {
  nivel: Nivel;
  motivos: string[];            // por qué es dudoso (vacío si es seguro)
  principal: ProductoUnion;     // el que se queda
  unidos: ProductoUnion[];      // los que se ocultan como «unido a …»
  resultado: {
    precioVenta: number;
    precioVentaCompletado: boolean; // true si el principal no tenía precio y se tomó de otro
    costoUnitario: number;
    stock: number;
    stockConvertido: boolean;       // hubo paca → unidades
    categoria: string;
    proveedores: ProveedorDeProducto[];
  };
}

const norm = (s?: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Diferencia en letras entre dos textos (Levenshtein). */
export function distanciaLetras(a: string, b: string): number {
  const x = a.replace(/\s+/g, ''), y = b.replace(/\s+/g, '');
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  }
  return d[x.length][y.length];
}

/** Costo por UNIDAD: el del producto, o el del proveedor dividido por su empaque. */
export function costoUnitario(p: ProductoUnion, inf: InfoNombre = analizarNombre(p.nombre)): number {
  const base = Number(p.costoBase) || 0;
  if (base > 0) return inf.paca ? base / inf.paca : base;
  const pr = (p.proveedores || []).find(x => x.costo > 0);
  return pr ? pr.costo / (pr.cantidadEmbalaje || 1) : 0;
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const dentro = (a: number, b: number, tolerancia: number) => Math.abs(a - b) <= Math.max(a, b) * tolerancia;

/** Revisa si `b` puede unirse a `a` sin riesgo. Devuelve los motivos de duda (vacío = seguro). */
export function motivosDeDuda(a: ProductoUnion, b: ProductoUnion): string[] {
  const ia = analizarNombre(a.nombre), ib = analizarNombre(b.nombre);
  const m: string[] = [];
  // 1. Nombre igual o con 1 letra de diferencia
  if (ia.base !== ib.base && distanciaLetras(ia.base, ib.base) > 1) m.push(`los nombres no son iguales («${a.nombre.trim()}» / «${b.nombre.trim()}»)`);
  // 2. Tamaño: igual en los dos (un número sin unidad vale como la del otro)
  if ((ia.tamano == null) !== (ib.tamano == null)) m.push('a uno le falta el tamaño');
  // 3. Misma categoría o mismo proveedor
  const mismaCat = !a.categoria || !b.categoria || norm(a.categoria) === norm(b.categoria);
  const provA = new Set((a.proveedores || []).map(x => x.proveedorId));
  const compartenProv = (b.proveedores || []).some(x => provA.has(x.proveedorId));
  if (!mismaCat && !compartenProv) m.push(`categorías distintas («${a.categoria}» / «${b.categoria}») y ningún proveedor en común`);
  // 4. Costos y precios que cuadran
  const ca = costoUnitario(a, ia), cb = costoUnitario(b, ib);
  if (ca > 0 && cb > 0 && !dentro(ca, cb, 0.3)) {
    m.push(`los costos por unidad no cuadran (${pesos(ca)} / ${pesos(cb)})`);
  }
  const unaEsPaca = (ia.paca ?? 1) !== (ib.paca ?? 1);
  if (!unaEsPaca && a.precioVenta > 0 && b.precioVenta > 0 && !dentro(a.precioVenta, b.precioVenta, 0.25)) {
    m.push(`los precios de venta no cuadran (${pesos(a.precioVenta)} / ${pesos(b.precioVenta)})`);
  }
  // 5. Uno de venta y otro insumo, los dos con precio de venta
  const tipoA = a.tipo === 'ingrediente' ? 'insumo' : 'venta', tipoB = b.tipo === 'ingrediente' ? 'insumo' : 'venta';
  if (tipoA !== tipoB && a.precioVenta > 0 && b.precioVenta > 0) m.push('uno es de venta y el otro insumo');
  return m;
}

/** Puntos por datos completos: gana el más completo para quedarse. */
export function puntaje(p: ProductoUnion, categoriasExistentes: Set<string>): number {
  const inf = analizarNombre(p.nombre);
  let s = 0;
  if (p.precioVenta > 0) s += 3;
  if (costoUnitario(p, inf) > 0) s += 2;
  if ((p.margenUtilidad || 0) > 0) s += 1;
  if (p.categoria && categoriasExistentes.has(norm(p.categoria))) s += 2;
  if ((p.stock || 0) > 0) s += 1;
  s += Math.min(2, (p.proveedores || []).length);
  if (!inf.paca) s += 3;            // el suelto es el que se vende: debe quedarse sobre la paca
  if (p.tipo !== 'ingrediente') s += 1;
  return s;
}

/** Arma el plan de unión de un grupo de posibles duplicados. No escribe nada. */
export function planDeUnion(grupo: ProductoUnion[], categoriasExistentes: string[] = []): PlanUnion {
  const cats = new Set(categoriasExistentes.map(norm));
  const orden = [...grupo].sort((a, b) =>
    puntaje(b, cats) - puntaje(a, cats) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const principal = orden[0];
  const unidos = orden.slice(1);
  const motivos = Array.from(new Set(unidos.flatMap(u => motivosDeDuda(principal, u))));
  // Costo que es claramente de paca puesto como unidad (ej. Ponny Mini: costo $46.000, precio $2.000):
  // no se puede unir «seguro» con ese costo, hay que corregirlo antes.
  for (const p of [principal, ...unidos]) {
    const c = costoUnitario(p), v = p.precioVenta;
    if (c > 0 && v > 0 && c >= v * 3) motivos.push(`«${p.nombre.trim()}» tiene costo ${pesos(c)} con precio ${pesos(v)}: el costo parece de un paquete`);
  }

  const ip = analizarNombre(principal.nombre);
  const conPrecio = unidos.find(u => u.precioVenta > 0);
  const precioVenta = principal.precioVenta > 0 ? principal.precioVenta : (conPrecio?.precioVenta || 0);
  const costoUnitarioFinal = costoUnitario(principal, ip) || unidos.map(u => costoUnitario(u)).find(c => c > 0) || 0;

  let stock = Number(principal.stock) || 0;
  let stockConvertido = false;
  for (const u of unidos) {
    const iu = analizarNombre(u.nombre);
    const factor = iu.paca && !ip.paca ? iu.paca : 1; // paca explícita (*24) → unidades
    if (factor > 1 && (u.stock || 0) > 0) stockConvertido = true;
    stock += (Number(u.stock) || 0) * factor;
  }

  // Proveedores: todos los de todos; la paca queda como forma de compra con su cantidad
  const provs = new Map<string, ProveedorDeProducto>();
  for (const p of [principal, ...unidos]) {
    const ipp = analizarNombre(p.nombre);
    for (const pr of p.proveedores || []) {
      const cant = ipp.paca && !ip.paca && (pr.cantidadEmbalaje || 1) === 1 ? ipp.paca : (pr.cantidadEmbalaje || 1);
      const k = `${pr.proveedorId}|${cant}`;
      if (!provs.has(k)) provs.set(k, { ...pr, cantidadEmbalaje: cant });
    }
  }
  const categoria = (principal.categoria && cats.has(norm(principal.categoria)) ? principal.categoria : unidos.find(u => u.categoria && cats.has(norm(u.categoria)))?.categoria) || principal.categoria || '';

  return {
    nivel: motivos.length ? 'dudoso' : 'seguro',
    motivos,
    principal,
    unidos,
    resultado: {
      precioVenta,
      precioVentaCompletado: principal.precioVenta <= 0 && precioVenta > 0,
      costoUnitario: Math.round(costoUnitarioFinal),
      stock,
      stockConvertido,
      categoria,
      proveedores: Array.from(provs.values()),
    },
  };
}

/** Todos los planes: grupos del detector → plan de cada uno (seguros primero). */
export function planesDeUnion(productos: ProductoUnion[], categoriasExistentes: string[] = []): PlanUnion[] {
  return buscarDuplicados(productos)
    .map(g => planDeUnion(g.productos, categoriasExistentes))
    .sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'seguro' ? -1 : 1) || a.principal.nombre.localeCompare(b.principal.nombre, 'es'));
}
