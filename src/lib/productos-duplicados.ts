/**
 * Posibles productos duplicados (2026-11-23, pedido de Gonzalo).
 *
 * Casos reales: «Agua cristal 600 *24» ($29.999, sin precio de venta) y «Agua crital 600ml»
 * ($4.200); dos «Golpe Original 140g»; «coca 250 pqñ» vs «Coca-Cola mini». Solo MARCA: nunca
 * une ni borra; Gonzalo decide.
 *
 * Lógica: se limpia el nombre (minúsculas, sin tildes, marcas unificadas), se separa el tamaño
 * (250 ml, 1.5 l → 1500 ml, 42 g), el empaque (*24, x24, paca) y palabras de tamaño (mini,
 * pequeña, pqñ, personal = chico; grande, familiar = grande). Lo que queda es el nombre base.
 * Dos productos son posible duplicado si el nombre base es igual o casi igual (errores de
 * escritura) y el tamaño es compatible. Tamaños distintos (250 ml y 1.5 l) NO se marcan.
 */

export type Unidad = 'ml' | 'g';
export type PalabraTamano = 'chico' | 'grande';

export interface InfoNombre {
  base: string;
  tamano: number | null;      // en ml o g
  unidad: Unidad | null;      // null si el número venía sin unidad (ej. «Agua cristal 600 *24»)
  paca: number | null;        // unidades por paquete (*24, x24)
  palabraTamano: PalabraTamano | null;
}

export type MotivoDuplicado = 'mismo-tamano' | 'paca' | 'palabra-tamano' | 'mismo-nombre';

export interface ProductoDup { id: string; nombre: string }

export interface GrupoDuplicado<T extends ProductoDup = ProductoDup> {
  clave: string;
  productos: T[];
  motivo: MotivoDuplicado;
  texto: string;
  grave: boolean;
}

const MARCAS: [RegExp, string][] = [
  [/\bcoca[\s-]*cola\b|\bcocacola\b|\bcoca\b/g, 'cocacola'],
  [/\bponn?y\b|\bpony\b/g, 'pony'],
  [/\bpostob[o]n\b/g, 'postobon'],
  [/\bbig[\s-]*cola\b/g, 'bigcola'],
];
const CHICO = /\b(mini|pequen[ao]s?|peq|pqn|personal|pers|persnl|pqno)\b/;
const GRANDE = /\b(grande|grd|familiar|mega|gigante)\b/;
const RUIDO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'und', 'unidad', 'unidades', 'caja', 'paca', 'pack', 'x', 'por', 'y', 'con']);

const limpiar = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ñ/g, 'n').replace(/[_|()]+/g, ' ');

export function analizarNombre(nombre: string): InfoNombre {
  let s = ' ' + limpiar(nombre) + ' ';
  let tamano: number | null = null;
  let unidad: Unidad | null = null;
  let paca: number | null = null;

  // Empaque: *24, x24, × 24 (antes del tamaño para no confundir «600*24»)
  const UNIDADES = 'ml|cc|l|lt|ltr|ltro|litr|ltrs|litros?|kg|kl|kilos?|g|gr|grs|gramos|oz|onzas?|lb|libras?';
  s = s.replace(new RegExp(`[*x×]\\s*(\\d{1,3})(?!\\d)(?![\\d.,]*\\s*(${UNIDADES})\\b)`, 'g'), (_m, n) => {
    if (paca == null) paca = Number(n);
    return ' ';
  });
  // Tamaño con unidad (acepta 1/2 libra, 1,5 litro, 600ml, 42 gr, 14 oz)
  s = s.replace(new RegExp(`(\\d+(?:[.,]\\d+)?(?:\\/\\d+)?)\\s*(${UNIDADES})\\b`, 'g'), (_m, n, u) => {
    const txt = String(n).replace(',', '.');
    const v = txt.includes('/') ? Number(txt.split('/')[0]) / Number(txt.split('/')[1]) : Number(txt);
    if (tamano == null && Number.isFinite(v)) {
      if (/^(l|lt|ltr|ltro|litr|ltrs|litros?)$/.test(u)) { tamano = Math.round(v * 1000); unidad = 'ml'; }
      else if (/^(kg|kl|kilos?)$/.test(u)) { tamano = Math.round(v * 1000); unidad = 'g'; }
      else if (/^(lb|libras?)$/.test(u)) { tamano = Math.round(v * 500); unidad = 'g'; }
      else if (/^(oz|onzas?)$/.test(u)) { tamano = Math.round(v * 29.57); unidad = 'ml'; }
      else if (u === 'ml' || u === 'cc') { tamano = Math.round(v); unidad = 'ml'; }
      else { tamano = Math.round(v); unidad = 'g'; }
    }
    return ' ';
  });
  // «Litro» o «libra» sin número = 1 litro / 1 libra
  if (tamano == null && /\b(litro|ltro|litr|lt)\b/.test(s)) { tamano = 1000; unidad = 'ml'; s = s.replace(/\b(litro|ltro|litr|lt)\b/, ' '); }
  if (tamano == null && /\blibras?\b/.test(s)) { tamano = 500; unidad = 'g'; s = s.replace(/\blibras?\b/, ' '); }
  // Número suelto que parece tamaño (ej. «Agua cristal 600»): entre 100 y 5000, sin unidad
  if (tamano == null) {
    s = s.replace(/\s(\d{3,4})(?=\s)/, (m, n) => {
      const v = Number(n);
      if (v >= 100 && v <= 5000) { tamano = v; return ' '; }
      return m;
    });
  }
  const palabraTamano: PalabraTamano | null = CHICO.test(s) ? 'chico' : GRANDE.test(s) ? 'grande' : null;
  s = s.replace(CHICO, ' ').replace(GRANDE, ' ');
  for (const [re, rep] of MARCAS) s = s.replace(re, rep);
  // Los números que quedan (1 bola, 3s, #17) SÍ cuentan: distinguen productos
  const base = s.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter(w => w && !RUIDO.has(w)).join(' ');
  return { base, tamano, unidad, paca, palabraTamano };
}

/** Parecido entre dos textos (0 a 1) por pares de letras: tolera «crital» vs «cristal». */
export function parecido(a: string, b: string): number {
  if (a === b) return 1;
  const pares = (t: string) => { const x = t.replace(/\s+/g, ''); const r: string[] = []; for (let i = 0; i < x.length - 1; i++) r.push(x.slice(i, i + 2)); return r; };
  const pa = pares(a), pb = pares(b);
  if (!pa.length || !pb.length) return 0;
  const m = new Map<string, number>();
  for (const p of pa) m.set(p, (m.get(p) || 0) + 1);
  let comunes = 0;
  for (const p of pb) { const c = m.get(p) || 0; if (c > 0) { comunes++; m.set(p, c - 1); } }
  return (2 * comunes) / (pa.length + pb.length);
}

export const PARECIDO_MIN = 0.8; // «cristal» vs «crital» = 0.84; «galleta oreo» vs «galleta dux» = 0.63

const tamanoTexto = (i: InfoNombre) => i.tamano == null ? '' : `${i.tamano >= 1000 && i.unidad === 'ml' ? `${i.tamano / 1000} l` : `${i.tamano} ${i.unidad ?? ''}`}`.trim();

/** ¿Estos dos productos pueden ser el mismo? Devuelve el motivo o null. */
export function compararProductos(a: InfoNombre, b: InfoNombre): MotivoDuplicado | null {
  if (!a.base || !b.base) return null;
  if (a.base !== b.base && parecido(a.base, b.base) < PARECIDO_MIN) return null;
  // Números que quedan en el nombre (3/4, 1/2, «3k», «1 bola») deben coincidir: si no, son otros productos
  const numeros = (s: string) => s.split(' ').filter(w => /\d/.test(w)).sort().join(' ');
  if (numeros(a.base) !== numeros(b.base)) return null;
  const unidadesCompatibles = !a.unidad || !b.unidad || a.unidad === b.unidad;
  if (a.tamano != null && b.tamano != null) {
    if (!unidadesCompatibles || Math.abs(a.tamano - b.tamano) > Math.max(a.tamano, b.tamano) * 0.02) return null;
    if ((a.paca ?? 1) !== (b.paca ?? 1)) return 'paca';
    return 'mismo-tamano';
  }
  if (a.tamano != null || b.tamano != null) {
    const conTam = a.tamano != null ? a : b;
    const sinTam = a.tamano != null ? b : a;
    if (sinTam.palabraTamano === 'chico' && (conTam.tamano ?? 0) <= 400) return 'palabra-tamano';
    if (sinTam.palabraTamano === 'grande' && (conTam.tamano ?? 0) >= 1000) return 'palabra-tamano';
    if (sinTam.palabraTamano == null && conTam.palabraTamano == null) return 'mismo-nombre';
    return null;
  }
  if (a.palabraTamano !== b.palabraTamano) return null;
  if ((a.paca ?? 1) !== (b.paca ?? 1)) return 'paca';
  return 'mismo-nombre';
}

const FUERZA: Record<MotivoDuplicado, number> = { 'mismo-tamano': 4, 'paca': 3, 'palabra-tamano': 2, 'mismo-nombre': 1 };
const TEXTO: Record<MotivoDuplicado, string> = {
  'mismo-tamano': 'Mismo nombre y tamaño',
  'paca': 'Uno es la paca y otro el suelto',
  'palabra-tamano': 'Mismo producto: uno dice el tamaño y otro «mini/pequeña/grande»',
  'mismo-nombre': 'Nombre igual o casi igual (a alguno le falta el tamaño)',
};

/** Agrupa los posibles duplicados. Cada grupo trae los productos ordenados de menor a mayor tamaño. */
export function buscarDuplicados<T extends ProductoDup>(productos: T[]): GrupoDuplicado<T>[] {
  const info = productos.map(p => analizarNombre(p.nombre));
  const padre = productos.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const motivoDe = new Map<number, MotivoDuplicado>();
  // Tamaños que ya hay en cada grupo: un grupo nunca mezcla tamaños distintos (ej. un «Trident»
  // sin tamaño no puede juntar al de 3s con el de 60s).
  const tamanosDe = new Map<number, Set<string>>();
  info.forEach((inf, i) => { if (inf.tamano != null) tamanosDe.set(i, new Set([`${inf.unidad ?? ''}${inf.tamano}`])); });
  const mezclaTamanos = (ri: number, rj: number) => {
    const s = new Set([...(tamanosDe.get(ri) ?? []), ...(tamanosDe.get(rj) ?? [])]);
    const nums = [...s].map(t => Number(t.replace(/^\D+/, '')));
    return nums.some(n => Math.abs(n - nums[0]) > Math.max(n, nums[0]) * 0.02);
  };
  // Para no comparar todos contra todos: solo dentro de la misma primera letra del nombre base
  const porLetra = new Map<string, number[]>();
  info.forEach((inf, i) => { if (!inf.base) return; const k = inf.base[0]; if (!porLetra.has(k)) porLetra.set(k, []); porLetra.get(k)!.push(i); });
  for (const idxs of porLetra.values()) {
    for (let x = 0; x < idxs.length; x++) for (let y = x + 1; y < idxs.length; y++) {
      const i = idxs[x], j = idxs[y];
      const m = compararProductos(info[i], info[j]);
      if (!m) continue;
      const ri = raiz(i), rj = raiz(j);
      if (ri !== rj && mezclaTamanos(ri, rj)) continue;
      const previo = [motivoDe.get(ri), motivoDe.get(rj), m].filter(Boolean) as MotivoDuplicado[];
      const mejor = previo.sort((p, q) => FUERZA[q] - FUERZA[p])[0];
      if (ri !== rj) {
        padre[rj] = ri;
        tamanosDe.set(ri, new Set([...(tamanosDe.get(ri) ?? []), ...(tamanosDe.get(rj) ?? [])]));
      }
      motivoDe.set(raiz(i), mejor);
    }
  }
  const grupos = new Map<number, number[]>();
  productos.forEach((_, i) => { const r = raiz(i); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r)!.push(i); });
  const out: GrupoDuplicado<T>[] = [];
  for (const [r, idxs] of grupos) {
    if (idxs.length < 2) continue;
    const motivo = motivoDe.get(r) ?? 'mismo-nombre';
    const orden = [...idxs].sort((i, j) => compararPorTamano(info[i], info[j]) || productos[i].nombre.localeCompare(productos[j].nombre, 'es'));
    const t = tamanoTexto(info[orden[0]]);
    out.push({
      clave: info[r].base + (t ? ` · ${t}` : ''),
      productos: orden.map(i => productos[i]),
      motivo,
      texto: TEXTO[motivo],
      grave: motivo === 'mismo-tamano',
    });
  }
  return out.sort((a, b) => Number(b.grave) - Number(a.grave) || a.clave.localeCompare(b.clave, 'es'));
}

/** Orden por tamaño, de menor a mayor (ml antes que g; sin tamaño al final). */
export function compararPorTamano(a: InfoNombre, b: InfoNombre): number {
  if (a.tamano == null && b.tamano == null) return 0;
  if (a.tamano == null) return 1;
  if (b.tamano == null) return -1;
  if ((a.unidad ?? 'ml') !== (b.unidad ?? 'ml')) return (a.unidad ?? 'ml') === 'ml' ? -1 : 1;
  return a.tamano - b.tamano || (a.paca ?? 1) - (b.paca ?? 1);
}

/** Para ordenar una lista de productos por nombre base y luego tamaño (250, 400, 1.5 l…). */
export function ordenarPorNombreYTamano<T extends ProductoDup>(productos: T[]): T[] {
  const info = new Map(productos.map(p => [p.id, analizarNombre(p.nombre)] as const));
  return [...productos].sort((a, b) => {
    const ia = info.get(a.id)!, ib = info.get(b.id)!;
    return ia.base.localeCompare(ib.base, 'es') || compararPorTamano(ia, ib) || a.nombre.localeCompare(b.nombre, 'es');
  });
}
