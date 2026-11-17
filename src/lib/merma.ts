/**
 * Control de Merma — lógica pura (sin React).
 *
 * Las mermas NO viven en una tabla aparte: son movimientos de inventario de tipo
 * 'salida' cuyo `motivo` empieza por "Merma · ". Así:
 *  - descuentan el stock real (vía onAjustarStock),
 *  - se guardan y sincronizan con la misma tabla `movimientos` que ya existe,
 *  - y también se ven en el historial de Inventario.
 *
 * Formato del motivo:  Merma · {causa} [· nota: {texto}] [· por {usuario}] · #{token}
 * Anulación:           Anulación merma · #{token}   (movimiento de 'entrada' que devuelve el stock)
 * Compatibilidad:      "Merma: {causa}" (formato antiguo de Producción) también se cuenta.
 */
import type { MovimientoInventario } from '@/types';

export interface CausaMerma {
  id: string;
  label: string;
  icono: string;
  /** Consejo corto que se muestra cuando es la causa principal del periodo */
  consejo: string;
}

export const CAUSAS_MERMA: CausaMerma[] = [
  { id: 'Quemado en horno', label: 'Quemado en horno', icono: '🔥', consejo: 'Revisa temperatura y tiempos del horno, y usa temporizador en cada tanda.' },
  { id: 'Mala masa / formulación', label: 'Mala masa / formulación', icono: '🥣', consejo: 'Revisa la receta técnica y pesa los ingredientes; anota qué tanda salió mal.' },
  { id: 'Sobrante sin vender', label: 'Sobrante sin vender', icono: '📅', consejo: 'Produce menos de ese producto o sácalo en oferta en la tarde para que no sobre.' },
  { id: 'Caída / accidente', label: 'Caída / accidente', icono: '💥', consejo: 'Revisa bandejas, estantes y el traslado del horno al mostrador.' },
  { id: 'Vencido / moho', label: 'Vencido / moho', icono: '🦠', consejo: 'Rota el producto (primero en entrar, primero en salir) y baja la producción.' },
  { id: 'Empaque / presentación', label: 'Empaque / presentación', icono: '📦', consejo: 'Revisa el empaque y el manejo; un producto bueno con mal aspecto igual se pierde.' },
  { id: 'Degustación / regalo', label: 'Degustación / regalo', icono: '🎁', consejo: 'Lleva control de cuánto se regala; si es mucho, ponle un tope diario.' },
  { id: 'Otro', label: 'Otro motivo', icono: '📝', consejo: 'Escribe una nota para entender mejor qué pasó.' },
];

export const PREFIJO_MERMA = 'Merma · ';
export const PREFIJO_ANULACION = 'Anulación merma · ';
const SEP = ' · ';

export function generarToken(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

function limpiar(texto: string): string {
  return texto.replace(/\s*·\s*/g, ' - ').replace(/\s+/g, ' ').trim();
}

export function construirMotivoMerma(p: { causa: string; nota?: string; usuario?: string; token: string }): string {
  const partes = ['Merma', limpiar(p.causa) || 'Otro'];
  const nota = limpiar(p.nota || '');
  if (nota) partes.push(`nota: ${nota}`);
  const usuario = limpiar(p.usuario || '');
  if (usuario) partes.push(`por ${usuario}`);
  partes.push(`#${p.token}`);
  return partes.join(SEP);
}

export function construirMotivoAnulacion(token: string): string {
  return `${PREFIJO_ANULACION}#${token}`;
}

export interface RegistroMerma {
  /** id del movimiento de inventario */
  id: string;
  /** token corto para poder anular (vacío en registros antiguos) */
  token: string;
  productoId: string;
  cantidad: number;
  causa: string;
  nota: string;
  usuario: string;
  fecha: string;
  anulada: boolean;
}

export function esMovimientoMerma(m: Pick<MovimientoInventario, 'tipo' | 'motivo'>): boolean {
  if (m.tipo !== 'salida') return false;
  const mot = m.motivo || '';
  return mot.startsWith(PREFIJO_MERMA) || /^merma\s*:/i.test(mot);
}

export function parsearMotivoMerma(motivo: string): { causa: string; nota: string; usuario: string; token: string } {
  if (motivo.startsWith(PREFIJO_MERMA)) {
    const partes = motivo.split(SEP).slice(1);
    let token = '';
    let usuario = '';
    let nota = '';
    const resto: string[] = [];
    for (const parte of partes) {
      if (parte.startsWith('#') && parte.length > 1) token = parte.slice(1);
      else if (parte.startsWith('por ')) usuario = parte.slice(4);
      else if (parte.startsWith('nota: ')) nota = parte.slice(6);
      else resto.push(parte);
    }
    return { causa: resto[0] || 'Otro', nota, usuario, token };
  }
  // Formato antiguo "Merma: causa"
  const causa = motivo.replace(/^merma\s*:\s*/i, '').trim() || 'Otro';
  return { causa, nota: '', usuario: '', token: '' };
}

/** Extrae las mermas (marcando las anuladas) de la lista de movimientos de inventario */
export function extraerMermas(movimientos: MovimientoInventario[]): RegistroMerma[] {
  const anulados = new Set<string>();
  for (const m of movimientos) {
    if (m.tipo === 'entrada' && (m.motivo || '').startsWith(PREFIJO_ANULACION)) {
      const t = (m.motivo || '').slice(PREFIJO_ANULACION.length).replace(/^#/, '').trim();
      if (t) anulados.add(t);
    }
  }
  return movimientos
    .filter(esMovimientoMerma)
    .map((m) => {
      const p = parsearMotivoMerma(m.motivo || '');
      return {
        id: m.id,
        token: p.token,
        productoId: m.productoId,
        cantidad: Number(m.cantidad) || 0,
        causa: p.causa,
        nota: p.nota,
        usuario: p.usuario || (m.usuario && m.usuario !== 'system' && m.usuario !== 'sistema' ? m.usuario : ''),
        fecha: m.fecha,
        anulada: p.token ? anulados.has(p.token) : false,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type PeriodoMerma = 'hoy' | '7d' | '30d' | 'todo';

export function inicioPeriodo(periodo: PeriodoMerma, ahora: Date = new Date()): number {
  if (periodo === 'todo') return 0;
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  if (periodo === 'hoy') return d.getTime();
  d.setDate(d.getDate() - (periodo === '7d' ? 6 : 29));
  return d.getTime();
}

export function filtrarPorPeriodo(registros: RegistroMerma[], periodo: PeriodoMerma, ahora: Date = new Date()): RegistroMerma[] {
  const desde = inicioPeriodo(periodo, ahora);
  return registros.filter((r) => new Date(r.fecha).getTime() >= desde);
}

export interface ItemValor {
  clave: string;
  nombre: string;
  unidades: number;
  costo: number;
  venta: number;
  registros: number;
}

export interface ResumenMerma {
  unidades: number;
  costo: number;
  venta: number;
  registros: number;
  porCausa: ItemValor[];
  porProducto: ItemValor[];
  porCategoria: ItemValor[];
}

export interface ProductoValor {
  nombre: string;
  categoria: string;
  costoUnitario: number;
  ventaUnitaria: number;
}

/** Resume las mermas vigentes (las anuladas no cuentan) */
export function resumirMermas(
  registros: RegistroMerma[],
  getProducto: (id: string) => ProductoValor | undefined
): ResumenMerma {
  const vigentes = registros.filter((r) => !r.anulada);
  const causas = new Map<string, ItemValor>();
  const productos = new Map<string, ItemValor>();
  const categorias = new Map<string, ItemValor>();
  let unidades = 0, costo = 0, venta = 0;

  const sumar = (mapa: Map<string, ItemValor>, clave: string, nombre: string, u: number, c: number, v: number) => {
    const it = mapa.get(clave) || { clave, nombre, unidades: 0, costo: 0, venta: 0, registros: 0 };
    it.unidades += u; it.costo += c; it.venta += v; it.registros += 1;
    mapa.set(clave, it);
  };

  for (const r of vigentes) {
    const p = getProducto(r.productoId);
    const c = (p?.costoUnitario || 0) * r.cantidad;
    const v = (p?.ventaUnitaria || 0) * r.cantidad;
    unidades += r.cantidad; costo += c; venta += v;
    sumar(causas, r.causa, r.causa, r.cantidad, c, v);
    sumar(productos, r.productoId, p?.nombre || 'Producto eliminado', r.cantidad, c, v);
    const cat = p?.categoria || 'Sin categoría';
    sumar(categorias, cat, cat, r.cantidad, c, v);
  }
  const ordenar = (m: Map<string, ItemValor>) =>
    [...m.values()].sort((a, b) => b.costo - a.costo || b.unidades - a.unidades);
  return {
    unidades, costo, venta, registros: vigentes.length,
    porCausa: ordenar(causas), porProducto: ordenar(productos), porCategoria: ordenar(categorias),
  };
}

export function consejoParaCausa(causa: string): string {
  return CAUSAS_MERMA.find((c) => c.id === causa)?.consejo
    || 'Anota una nota en cada merma para encontrar el patrón que se repite.';
}
