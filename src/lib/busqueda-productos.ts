/**
 * Búsqueda rápida / POS: espurgue inteligente de catálogo.
 * Oculta solo basura clara e insumos SIN precio de venta.
 * Si tiene PVP > 0, SIEMPRE aparece (aunque esté mal tipado como ingrediente).
 */

import type { Producto } from '@/types';

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'un', 'una', 'con', 'por', 'para']);

/** Nombre basura / sin sentido (pruebas, vacíos, placeholders). */
const NOMBRE_BASURA =
  /^(test|prueba|xxx+|asdf+|qwerty|nuevo\s*producto|producto\s*\d+|sin\s*nombre|n\/?a|null|undefined|temp|temporal|aaa+|bbb+)(\s|$)/i;

export function normTexto(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function esCategoriaInsumo(categoria: string | undefined | null): boolean {
  const c = normTexto(categoria);
  if (!c) return false;
  // Solo prefijos claros de insumos — no bloquear categorías de venta mal escritas
  return c.startsWith('ins:') || c.startsWith('ins ') || c.startsWith('insumos');
}

export function esNombreBasura(nombre: string | undefined | null): boolean {
  const n = normTexto(nombre);
  if (!n || n.length < 2) return true;
  if (/^\d+$/.test(n)) return true;
  if (NOMBRE_BASURA.test(n)) return true;
  return false;
}

/**
 * ¿Aparece en búsqueda de mostrador?
 * Regla de oro: si tiene precio de venta, es producto de venta (aunque diga "ingrediente").
 */
export function esProductoBusquedaVenta(p: Producto): boolean {
  if (!p || esNombreBasura(p.nombre)) return false;

  const pv = Number(p.precioVenta) || 0;
  if (pv > 0) return true;

  // Sin PVP: ocultar solo insumos claros
  if (p.tipo === 'ingrediente') return false;
  if (esCategoriaInsumo(p.categoria)) return false;
  return true;
}

function tokensBusqueda(term: string): string[] {
  return normTexto(term)
    .split(/[\s,/.\-_+]+/)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

function palabras(s: string | undefined | null): string[] {
  return normTexto(s).split(/[\s,/.\-_+()]+/).filter(Boolean);
}

/** Variantes singulares: "panes" → "pane", "pan"; "tortas" → "torta". */
function variantesToken(tok: string): string[] {
  const v = [tok];
  if (tok.length >= 4 && tok.endsWith('es')) v.push(tok.slice(0, -2));
  if (tok.length >= 4 && tok.endsWith('s')) v.push(tok.slice(0, -1));
  return v;
}

/** Distancia de edición simple (typos: bogui/boggy). */
function distanciaEdicion(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

/**
 * Coincidencia estricta de una palabra del query contra las palabras de un campo:
 * - inicio de palabra ("pan" → "Pan Francés", NO "Empanada")
 * - dentro de palabra solo si el término tiene ≥ 4 letras ("bono" → "pandebono")
 * - typo de 1 letra solo con términos ≥ 5 letras ("boggi" → "boggy")
 */
function tokenCoincideEnPalabras(tok: string, words: string[]): boolean {
  for (const t of variantesToken(tok)) {
    for (const w of words) {
      if (w.startsWith(t)) return true;
      if (t.length >= 4 && w.includes(t)) return true;
      if (t.length >= 5 && w.length >= 4) {
        if (distanciaEdicion(t, w) <= 1) return true;
        if (w.length > t.length && distanciaEdicion(t, w.slice(0, t.length)) <= 1) return true;
      }
    }
  }
  return false;
}

function coincideCampo(campo: string | undefined | null, term: string): boolean {
  const q = normTexto(term);
  if (!q) return false;
  const texto = normTexto(campo);
  if (!texto) return false;
  if (q.length >= 3 && q.includes(' ') && texto.includes(q)) return true;
  const tokens = tokensBusqueda(term);
  if (tokens.length === 0) return false;
  const words = palabras(campo);
  return tokens.every((tok) => tokenCoincideEnPalabras(tok, words));
}

/** Todas las palabras del query aparecen en el NOMBRE. */
export function coincideNombreProducto(p: Producto, term: string): boolean {
  return coincideCampo(p.nombre, term);
}

/** Todas las palabras del query aparecen en la CATEGORÍA. */
export function coincideCategoriaProducto(p: Producto, term: string): boolean {
  return coincideCampo(p.categoria, term);
}

/** ¿El término encaja por nombre o, si no, por categoría? (todas las palabras, sin OR). */
export function coincideBusquedaProducto(p: Producto, term: string): boolean {
  return coincideNombreProducto(p, term) || coincideCategoriaProducto(p, term);
}

function scoreMatch(p: Producto, term: string): number {
  const q = normTexto(term);
  const name = normTexto(p.nombre);
  let score = 0;
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 500;
  else if (name.includes(q)) score += 200;

  const tokens = tokensBusqueda(term);
  const words = palabras(p.nombre);
  tokens.forEach((tok, i) => {
    if (words[i] && words[i].startsWith(tok)) score += 100;
    else if (name.startsWith(tok)) score += 80;
    else if (words.some((w) => w.startsWith(tok))) score += 40;
    else if (tokenCoincideEnPalabras(tok, words)) score += 15;
  });

  // Nombres cortos primero ante empate: "Pan" antes que "Pan de queso con bocadillo grande"
  score -= Math.min(words.length, 10) * 2;

  const pv = Number(p.precioVenta) || 0;
  if (pv > 0) score += 30;
  else score -= 20;

  return score;
}

/**
 * Deduplica por nombre normalizado: deja el de mayor precio de venta
 * (si empatan, el de mayor costoBase = más “completo”).
 */
export function deduplicarPorNombre(productos: Producto[]): Producto[] {
  const map = new Map<string, Producto>();
  for (const p of productos) {
    const key = normTexto(p.nombre);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, p);
      continue;
    }
    const pv = Number(p.precioVenta) || 0;
    const pvPrev = Number(prev.precioVenta) || 0;
    if (pv > pvPrev) {
      map.set(key, p);
      continue;
    }
    if (pv === pvPrev && (Number(p.costoBase) || 0) > (Number(prev.costoBase) || 0)) {
      map.set(key, p);
    }
  }
  return Array.from(map.values());
}

export type BusquedaProductosOpts = {
  /** Si false, oculta elaborados con PVP 0. Por defecto true (no esconder productos reales). */
  incluirSinPrecio?: boolean;
  limite?: number;
  /** Si true, prioriza coincidencias en el nombre (útil en búsqueda rápida). */
  priorizarNombre?: boolean;
};

/**
 * Catálogo limpio + coincidencia inteligente para Búsqueda rápida / POS.
 */
export function buscarProductosVenta(
  productos: Producto[],
  term: string,
  opts: BusquedaProductosOpts = {}
): Producto[] {
  const limite = opts.limite ?? 60;
  const incluirSinPrecio = opts.incluirSinPrecio ?? true;
  const priorizarNombre = opts.priorizarNombre ?? false;
  const q = normTexto(term);
  if (!q) return [];

  let base = productos.filter(esProductoBusquedaVenta);
  if (!incluirSinPrecio) {
    base = base.filter((p) => (Number(p.precioVenta) || 0) > 0);
  }

  // 1) Por NOMBRE (todas las palabras). Si hay resultados, solo esos: nada de "todo el catálogo".
  // 2) Si ningún nombre encaja, por CATEGORÍA ("hojaldres", "postres").
  // 3) Último recurso, solo si 1 y 2 están vacíos: alguna palabra fuerte (≥ 4) en el nombre.
  let matched = base.filter((p) => coincideNombreProducto(p, term));
  if (matched.length === 0) {
    matched = base.filter((p) => coincideCategoriaProducto(p, term));
  }
  if (matched.length === 0) {
    const fuertes = tokensBusqueda(term).filter((t) => t.length >= 4);
    if (fuertes.length >= 2) {
      matched = base.filter((p) => {
        const words = palabras(p.nombre);
        return fuertes.some((tok) => tokenCoincideEnPalabras(tok, words));
      });
    }
  }
  const unique = deduplicarPorNombre(matched);

  return unique
    .sort((a, b) => {
      let sa = scoreMatch(a, term);
      let sb = scoreMatch(b, term);
      if (priorizarNombre) {
        const qa = normTexto(term);
        if (normTexto(a.nombre).startsWith(qa)) sa += 80;
        if (normTexto(b.nombre).startsWith(qa)) sb += 80;
      }
      if (sb !== sa) return sb - sa;
      return normTexto(a.nombre).localeCompare(normTexto(b.nombre));
    })
    .slice(0, limite);
}

/** Cuántos se ocultaron vs catálogo total (para feedback en UI). */
export function resumenEspurgue(productos: Producto[]): {
  total: number;
  venta: number;
  ocultos: number;
} {
  const total = productos.length;
  const venta = productos.filter(esProductoBusquedaVenta).length;
  return { total, venta, ocultos: Math.max(0, total - venta) };
}
