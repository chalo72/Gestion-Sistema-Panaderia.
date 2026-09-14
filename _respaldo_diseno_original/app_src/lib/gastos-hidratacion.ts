/**
 * Hidratación y fusión de gastos — evita pantalla en $0 al reiniciar.
 * LOCAL SIEMPRE GANA: nunca vaciar lista si ya había datos en memoria/caché.
 */
import type { Gasto } from '@/types';
import { recuperarGastosMultifuente } from '@/lib/recuperacion-gastos';

const CACHE_KEY = 'dp_gastos_cache_v1';
const MAX_CACHE = 5000;

export function fusionarGastosUnicos(...listas: Gasto[][]): Gasto[] {
  const mapa = new Map<string, Gasto>();
  for (const lista of listas) {
    for (const g of lista) {
      if (g && typeof g.id === 'string' && g.id.length > 0) {
        mapa.set(g.id, g);
      }
    }
  }
  return Array.from(mapa.values())
    .filter((g) => g.estado !== 'anulado')
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export function leerCacheGastos(): Gasto[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Gasto[]) : [];
  } catch {
    return [];
  }
}

export function guardarCacheGastos(gastos: Gasto[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(gastos.slice(0, MAX_CACHE)));
  } catch {
    /* quota — no bloquear */
  }
}

/** Aplica lista nueva sin borrar datos ya visibles por carrera async. */
export function fusionarGastosEnEstado(prev: Gasto[], nuevos: Gasto[]): Gasto[] {
  if (nuevos.length === 0 && prev.length > 0) return prev;
  const merged = fusionarGastosUnicos(prev, nuevos);
  if (merged.length > 0) guardarCacheGastos(merged);
  return merged;
}

/** Lectura rápida: caché de sesión + IndexedDB + legacy + nube. */
export async function hidratarGastosCompletos(): Promise<Gasto[]> {
  const cache = leerCacheGastos();
  const r = await recuperarGastosMultifuente();
  const merged = fusionarGastosUnicos(cache, r.gastos);
  if (merged.length > 0) guardarCacheGastos(merged);
  return merged;
}
