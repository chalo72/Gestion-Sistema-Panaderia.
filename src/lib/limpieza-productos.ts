/**
 * LIMPIEZA DE PRODUCTOS BASURA — con aprobación del Director
 * Creado 2026-09-30 (AUTORIZO Gonzalo).
 *
 * ANTES: esta limpieza estaba escondida dentro de la sincronización automática
 * (useRealtimeSync.syncNow). Corría en TODOS los aparatos (también en el celular
 * de cada vendedora) y borraba productos de la nube sin preguntar. Nunca llegó a
 * funcionar porque usaba `.catch()` sobre consultas de Supabase (que no lo tienen),
 * y ese error la cortaba siempre.
 *
 * AHORA: solo corre cuando el administrador toca "Buscar" en Configuración.
 * 1) buscarProductosBasura() → solo LEE y devuelve la lista (no borra nada).
 * 2) El Director revisa y marca cuáles borrar.
 * 3) borrarProductosBasura(ids) → borra SOLO esos, por el mismo camino que usa
 *    la app cuando alguien borra un producto a mano (db.deleteProducto: nube +
 *    marca de borrado para que no reaparezca + local), más sus precios.
 *
 * El criterio de "basura" es EXACTAMENTE el mismo que tenía la rutina vieja.
 */
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';

export interface ProductoBasura {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  dondeEsta: 'este aparato' | 'nube' | 'ambos';
}

/** Mismo criterio que la rutina original (textos vacíos, basura de OCR, etc.). */
export function esProductoBasura(p: { nombre?: unknown; unidad?: unknown; categoria?: unknown }): boolean {
  const name = String(p?.nombre ?? '').trim().toLowerCase();
  const unit = String(p?.unidad ?? '').toLowerCase();
  const cat = String(p?.categoria ?? '').toLowerCase();
  return name === '' ||
    name === 'undefined' ||
    name === 'null' ||
    cat === 'electrónica' || cat === 'electronica' ||
    name.includes('timiden') ||
    unit.includes('4 x e x z x x') ||
    name.includes('e n d r n t e l l') ||
    (name === 'general' && cat === 'general');
}

/** Solo LEE. No borra nada. */
export async function buscarProductosBasura(): Promise<ProductoBasura[]> {
  let locales: any[] = [];
  let nube: any[] = [];
  try { locales = await db.getAllProductos(); } catch { locales = []; }
  try {
    const { data, error } = await supabase.from('productos').select('id, nombre, categoria, unidad');
    if (!error && Array.isArray(data)) nube = data;
  } catch { nube = []; }

  const mapa = new Map<string, ProductoBasura>();
  for (const p of locales) {
    if (p?.id && esProductoBasura(p)) {
      mapa.set(p.id, { id: p.id, nombre: String(p.nombre ?? ''), categoria: String(p.categoria ?? ''), unidad: String(p.unidad ?? ''), dondeEsta: 'este aparato' });
    }
  }
  for (const p of nube) {
    if (!p?.id || !esProductoBasura(p)) continue;
    const ya = mapa.get(p.id);
    if (ya) ya.dondeEsta = 'ambos';
    else mapa.set(p.id, { id: p.id, nombre: String(p.nombre ?? ''), categoria: String(p.categoria ?? ''), unidad: String(p.unidad ?? ''), dondeEsta: 'nube' });
  }
  return [...mapa.values()];
}

/** Borra SOLO los ids aprobados. Devuelve cuántos se borraron y cuántos fallaron. */
export async function borrarProductosBasura(ids: string[]): Promise<{ borrados: number; fallidos: number }> {
  let borrados = 0;
  let fallidos = 0;
  let preciosLocales: any[] = [];
  try { preciosLocales = await db.getAllPrecios(); } catch { preciosLocales = []; }

  for (const id of ids) {
    try {
      // Mismo camino que el borrado manual (usePriceControl.deleteProducto)
      await db.deleteProducto(id);
      await db.addTombstone('productos', id).catch(() => {});
      for (const precio of preciosLocales.filter((x: any) => x?.productoId === id)) {
        try { await db.deletePrecio(precio.id); } catch { /* sigue */ }
        await db.addTombstone('precios', precio.id).catch(() => {});
      }
      // Restos en la nube que no pasan por el borrado local (precios/inventario de ese producto)
      try { await supabase.from('precios').delete().eq('producto_id', id); } catch { /* sigue */ }
      try { await supabase.from('inventario').delete().eq('producto_id', id); } catch { /* sigue */ }
      borrados++;
    } catch {
      fallidos++;
    }
  }

  if (borrados > 0) {
    for (const table of ['productos', 'precios']) {
      window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
        detail: { table, eventType: 'MANUAL', id: 'limpieza-basura' },
      }));
    }
  }
  return { borrados, fallidos };
}
