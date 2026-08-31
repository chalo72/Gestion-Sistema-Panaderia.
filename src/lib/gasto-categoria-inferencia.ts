/**
 * Inferencia de GastoCategoria comparando descripciones de gasto
 * contra el catálogo de productos y precios por proveedor.
 */
import { matchProductoEnCatalogo } from '@/lib/ocr-service';
import type { Gasto, GastoCategoria, Producto, PrecioProveedor } from '@/types';

const CATEGORIAS_VALIDAS: GastoCategoria[] = [
  'Servicios',
  'Arriendo',
  'Materia Prima',
  'Nómina',
  'Mantenimiento',
  'Otros',
];

/** Categorías guardadas por Turbo que hay que corregir en BD */
const CATEGORIAS_LEGACY = /^(insumos?|empaques?|operativos?)$/i;

/** Tokens demasiado genéricos para buscar en catálogo */
const TOKENS_IGNORAR = new Set([
  'valor', 'total', 'und', 'unids', 'unidad', 'unidades', 'pesos', 'peso',
  'producto', 'general', 'gasto', 'compra', 'factura', 'item', 'paquete',
]);

export interface InferenciaCategoriaGasto {
  categoria: GastoCategoria;
  confianza: 'alta' | 'media' | 'baja';
  razon: string;
  productoId?: string;
  productoNombre?: string;
}

export interface RecategorizacionGasto {
  id: string;
  descripcion: string;
  anterior: string;
  nueva: GastoCategoria;
  razon: string;
}

export function esCategoriaLegacyInvalida(raw?: string | null): boolean {
  return CATEGORIAS_LEGACY.test((raw || '').trim());
}

/** Normaliza categorías inválidas guardadas por Turbo (Insumos, Empaques, etc.) */
export function normalizarCategoriaGasto(raw?: string | null): GastoCategoria {
  const t = (raw || '').trim();
  if (!t) return 'Otros';
  if ((CATEGORIAS_VALIDAS as string[]).includes(t)) return t as GastoCategoria;

  const low = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^insumos?$|^empaques?$|^materia\s*prima|^ingrediente/.test(low)) return 'Materia Prima';
  if (/servicio|luz|agua|internet|gas|telefono|acueducto/.test(low)) return 'Servicios';
  if (/arriendo|canon|local/.test(low)) return 'Arriendo';
  if (/nomina|salario|sueldo/.test(low)) return 'Nómina';
  if (/mantenimiento|reparacion/.test(low)) return 'Mantenimiento';
  if (/operativo|mecato|venta|reventa/.test(low)) return 'Otros';
  return 'Otros';
}

/** Quita prefijos de cantidad/unidad de la descripción del gasto */
export function extraerNombreProductoDeDescripcion(descripcion: string): string {
  let s = (descripcion || '').trim();
  if (!s) return '';

  s = s.replace(/^\[ANULADO:[^\]]*\]\s*/i, '');
  s = s.replace(/^\d+\s*x\s+/i, '');
  s = s.replace(/^\d+(?:[.,]\d+)?\s*(?:unids?|unds?|und|un|kg|gr|lt|ml)\s+/i, '');
  s = s.replace(/\s+valor\s*$/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function sinAcentos(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Mapea categoría/tipo del producto del catálogo → categoría de gasto */
function productoAGastoCategoria(producto: Producto): GastoCategoria {
  const cat = sinAcentos(producto.categoria || '');

  if (producto.tipo === 'ingrediente') return 'Materia Prima';
  if (producto.tipo === 'elaborado') return 'Otros';

  if (/^ins\b|^ins:|insumo|materia\s*prima|harina|levadura|panaderia|tortas|reposteria|cafeteria|cafeter/.test(cat)) {
    return 'Materia Prima';
  }
  if (/mecato|bebida|dulce|helado|lacteo|postre|snack|gaseosa|galleta|venta|piñateria|michelada/.test(cat)) {
    return 'Otros';
  }
  return 'Otros';
}

function filtrarCatalogoPorProveedor(
  productos: Producto[],
  precios: PrecioProveedor[],
  proveedorId?: string
): Producto[] {
  if (!proveedorId) return productos;
  const ids = new Set(
    precios.filter((p) => p.proveedorId === proveedorId).map((p) => p.productoId)
  );
  if (ids.size === 0) return productos;
  return productos.filter((p) => ids.has(p.id));
}

interface MatchCatalogo {
  producto: Producto;
  score: number;
  metodo: string;
}

/** Búsqueda en catálogo: nombre completo + tokens significativos */
function buscarMejorMatchCatalogo(
  nombreLimpio: string,
  productos: Producto[],
  umbral = 0.5
): MatchCatalogo | null {
  if (!nombreLimpio || productos.length === 0) return null;

  const matchCompleto = matchProductoEnCatalogo(nombreLimpio, productos, (p) => p.nombre, umbral);
  let mejor: MatchCatalogo | null =
    matchCompleto.indice >= 0
      ? {
          producto: productos[matchCompleto.indice],
          score: matchCompleto.score,
          metodo: 'nombre-completo',
        }
      : null;

  const tokens = sinAcentos(nombreLimpio)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !TOKENS_IGNORAR.has(t));

  for (const token of tokens) {
    if (token.length < 4) continue;
    const m = matchProductoEnCatalogo(token, productos, (p) => p.nombre, 0.52);
    if (m.indice >= 0) {
      const candidato: MatchCatalogo = {
        producto: productos[m.indice],
        score: m.score * (token.length >= 5 ? 0.95 : 0.85),
        metodo: `token:${token}`,
      };
      if (!mejor || candidato.score > mejor.score) mejor = candidato;
    }
  }

  // Frases compuestas frecuentes: "omega valor", "ping pong"
  const bigramas = tokens.length >= 2
    ? tokens.slice(0, -1).map((t, i) => `${t} ${tokens[i + 1]}`)
    : [];
  for (const bg of bigramas) {
    const m = matchProductoEnCatalogo(bg, productos, (p) => p.nombre, 0.48);
    if (m.indice >= 0) {
      const candidato: MatchCatalogo = {
        producto: productos[m.indice],
        score: m.score,
        metodo: `bigrama:${bg}`,
      };
      if (!mejor || candidato.score > mejor.score) mejor = candidato;
    }
  }

  return mejor;
}

/** Reglas de negocio Dulce Placer — reventa / mecato (prioridad alta) */
function inferirReventaMecato(text: string): InferenciaCategoriaGasto | null {
  if (
    /\b(omega\s*valor|omega\b)/.test(text) ||
    /\bping\s*[-]?\s*pong\b/.test(text) ||
    /\bgalleta/.test(text) ||
    /\b(mecato|dulce|chicle|bombon|menta|masmelo|supercoco|barrilete|goma|papas?\s+frit)/.test(text) ||
    /\b(gaseosa|coca\s*cola|postobon|postob[oó]n|jugo|hit\b|tampico|brisa|cristal|colombiana|man[ií]|mani\b)/.test(text) ||
    /\b(helado|paleta|cono|snack|yogur|yogurt|bon\s*yurt|alpina|kumis)\b/.test(text) ||
    /\b(gelatina|chocolatin|chocorramo|tostao|natuchips|cheetos|doritos|margarita)\b/.test(text)
  ) {
    return { categoria: 'Otros', confianza: 'media', razon: 'Mercancía para reventa (mecato/bebidas)' };
  }
  return null;
}

/** Materia prima / insumo de producción */
function inferirMateriaPrima(text: string): InferenciaCategoriaGasto | null {
  if (
    /\b(cafe\s*instant|caf[eé]\s*instant|instantaneo|nescafe|caf[eé]\s*molid)/.test(text) ||
    /\b(harina|huevo|levadura|mantequilla|margarina|azucar|grasa|sal\b|levad|masa\b)/.test(text) ||
    /\b(empaque|bolsa|bolsas|envase|film|caja\s+carton|vaso\s+desech|moldes?)\b/.test(text) ||
    /\b(queso\s+cost|crema\s+de\s+leche|leche\s+enter|suero|suplemento\s+pan)/.test(text)
  ) {
    return { categoria: 'Materia Prima', confianza: 'media', razon: 'Insumo de producción / panadería' };
  }
  return null;
}

function inferirPorPalabrasClave(descripcion: string): InferenciaCategoriaGasto | null {
  const text = sinAcentos(descripcion);

  if (/\b(nomina|salario|sueldo|prestacion)\b/.test(text)) {
    return { categoria: 'Nómina', confianza: 'media', razon: 'Palabra clave de nómina' };
  }
  if (/\b(arriendo|canon|alquiler)\b/.test(text)) {
    return { categoria: 'Arriendo', confianza: 'media', razon: 'Palabra clave de arriendo' };
  }
  if (/\b(mantenimiento|reparacion|arreglo|plomeria|electricista)\b/.test(text)) {
    return { categoria: 'Mantenimiento', confianza: 'media', razon: 'Palabra clave de mantenimiento' };
  }
  if (
    /\b(pago\s+(de\s+)?(luz|internet|gas|telefono|acueducto)|servicio\s+de\s+|factura\s+(luz|agua|gas))\b/.test(text) ||
    /\b(acueducto|energia|codensa|epm)\b/.test(text)
  ) {
    return { categoria: 'Servicios', confianza: 'media', razon: 'Servicio público o utility' };
  }

  // Reventa ANTES que insumo (evita que "galleta" caiga en Otros por error inverso)
  const reventa = inferirReventaMecato(text);
  if (reventa) return reventa;

  const insumo = inferirMateriaPrima(text);
  if (insumo) return insumo;

  return null;
}

/**
 * Infiere GastoCategoria comparando la descripción con el catálogo.
 * Prioriza productos del proveedor indicado.
 */
export function inferirCategoriaGasto(
  descripcion: string,
  productos: Producto[],
  precios: PrecioProveedor[] = [],
  proveedorId?: string
): InferenciaCategoriaGasto {
  const nombreLimpio = extraerNombreProductoDeDescripcion(descripcion);
  if (!nombreLimpio) {
    return { categoria: 'Otros', confianza: 'baja', razon: 'Descripción vacía' };
  }

  const catalogoProveedor = filtrarCatalogoPorProveedor(productos, precios, proveedorId);

  const matchProv = buscarMejorMatchCatalogo(
    nombreLimpio,
    catalogoProveedor.length > 0 ? catalogoProveedor : productos,
    proveedorId ? 0.48 : 0.5
  );

  if (matchProv && (proveedorId || matchProv.score >= 0.52)) {
    const categoria = productoAGastoCategoria(matchProv.producto);
    return {
      categoria,
      confianza: matchProv.score >= 0.82 ? 'alta' : 'media',
      razon: `Catálogo${proveedorId ? ' proveedor' : ''}: "${matchProv.producto.nombre}" (${matchProv.producto.categoria})`,
      productoId: matchProv.producto.id,
      productoNombre: matchProv.producto.nombre,
    };
  }

  const matchGlobal = buscarMejorMatchCatalogo(nombreLimpio, productos, 0.52);
  if (matchGlobal) {
    const categoria = productoAGastoCategoria(matchGlobal.producto);
    return {
      categoria,
      confianza: matchGlobal.score >= 0.88 ? 'alta' : 'media',
      razon: `Catálogo general: "${matchGlobal.producto.nombre}" (${matchGlobal.producto.categoria})`,
      productoId: matchGlobal.producto.id,
      productoNombre: matchGlobal.producto.nombre,
    };
  }

  const porPalabras = inferirPorPalabrasClave(nombreLimpio);
  if (porPalabras) return porPalabras;

  return { categoria: 'Otros', confianza: 'baja', razon: 'Sin coincidencia — clasificado como Otros (no insumo)' };
}

function necesitaRecategorizacion(
  rawCat: string,
  anteriorNorm: GastoCategoria,
  inferido: InferenciaCategoriaGasto
): boolean {
  if (inferido.categoria !== anteriorNorm) return true;
  if (inferido.categoria !== rawCat) return true;
  if (esCategoriaLegacyInvalida(rawCat)) return true;
  // Corregir insumos mal puestos aunque ya digan Materia Prima en pantalla
  if (
    (rawCat === 'Materia Prima' || esCategoriaLegacyInvalida(rawCat)) &&
    inferido.categoria === 'Otros' &&
    inferido.confianza !== 'baja'
  ) {
    return true;
  }
  return false;
}

/** Lista gastos que cambiarían de categoría al recategorizar con el catálogo */
export function planificarRecategorizacionGastos(
  gastos: Gasto[],
  productos: Producto[],
  precios: PrecioProveedor[] = []
): RecategorizacionGasto[] {
  const cambios: RecategorizacionGasto[] = [];

  for (const g of gastos) {
    if (g.estado === 'anulado') continue;

    const rawCat = String(g.categoria || '').trim();
    const anteriorNorm = normalizarCategoriaGasto(rawCat);
    const inferido = inferirCategoriaGasto(g.descripcion, productos, precios, g.proveedorId);

    if (necesitaRecategorizacion(rawCat, anteriorNorm, inferido)) {
      cambios.push({
        id: g.id,
        descripcion: g.descripcion,
        anterior: rawCat || anteriorNorm,
        nueva: inferido.categoria,
        razon: inferido.razon,
      });
    }
  }

  return cambios;
}
