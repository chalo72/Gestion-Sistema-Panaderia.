import { db } from '@/lib/database';
import type { Venta } from '@/types';
import { filtrarRegistrosDelDiaLocal } from '@/lib/fecha-ventas';

/** Lee todas las ventas POS desde IndexedDB (fuente local primaria). */
export async function recuperarVentasDesdeIndexedDB(): Promise<Venta[]> {
  const lista = await db.getAllVentas();
  return Array.isArray(lista) ? (lista as Venta[]) : [];
}

/** LOCAL GANA: el estado en memoria pisa lo de IndexedDB si comparten id. */
export function fusionarVentasLocales(
  enMemoria: Venta[],
  desdeIndexedDB: Venta[] | null | undefined,
): Venta[] {
  if (!desdeIndexedDB?.length) return enMemoria;
  const map = new Map<string, Venta>();
  for (const v of desdeIndexedDB) {
    if (v?.id) map.set(v.id, v);
  }
  for (const v of enMemoria) {
    if (v?.id) map.set(v.id, v);
  }
  return Array.from(map.values());
}

/** ¿Hay ventas de hoy en IndexedDB que no están en memoria? */
export async function detectarVentasHoyFaltantes(enMemoria: Venta[]): Promise<Venta[]> {
  const todas = await recuperarVentasDesdeIndexedDB();
  const idsMemoria = new Set(enMemoria.map((v) => v.id));
  return filtrarRegistrosDelDiaLocal(todas).filter((v) => !idsMemoria.has(v.id));
}
