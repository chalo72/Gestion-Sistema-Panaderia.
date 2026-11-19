import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Despacho } from '@/lib/rutas-reparto';

/**
 * Despachos y datos de tiendas, cada uno en su propia fila en la nube (2026-11-19).
 *
 * Antes todos los despachos se guardaban como UN solo bloque (configuracion): si dos
 * vendedores estaban en ruta a la vez con dos celulares, el último en guardar borraba
 * lo del otro. Ahora cada despacho es una fila (tabla despachos_ruta) y solo se sube el
 * que cambió.
 */

// ── Despachos ──

/** Último actualizadoEn subido por despacho en esta sesión (para no resubir lo mismo). */
const subidos = new Map<string, number>();

export async function cargarDespachosNube(): Promise<Despacho[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('despachos_ruta').select('id, data');
  if (error) return null;
  const lista = (data ?? []).map((r: any) => r.data as Despacho).filter(d => d && d.id);
  for (const d of lista) subidos.set(d.id, Number(d.actualizadoEn) || 0);
  return lista;
}

/** Sube solo los despachos nuevos o cambiados desde la última vez. */
export async function guardarDespachosNube(despachos: Despacho[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const cambiados = despachos.filter(d => d?.id && (Number(d.actualizadoEn) || 0) > (subidos.get(d.id) ?? -1));
  if (cambiados.length === 0) return;
  const filas = cambiados.map(d => ({
    id: d.id,
    fecha: d.fecha || null,
    vendedor: d.vendedor || null,
    ruta_nombre: d.rutaNombre || null,
    estado: d.estado || null,
    data: d,
    actualizado_en: new Date(Number(d.actualizadoEn) || Date.now()).toISOString(),
  }));
  const { error } = await supabase.from('despachos_ruta').upsert(filas);
  if (error) throw error;
  for (const d of cambiados) subidos.set(d.id, Number(d.actualizadoEn) || 0);
}

// ── Datos de la tienda (dueño, WhatsApp, barrio) ──

export interface DatosTienda {
  clienteId: string;
  dueno?: string;
  whatsapp?: string;
  barrio?: string;
  actualizadoEn: number;
}

const LS_TIENDAS = 'dp_tiendas_ruta';

export function cargarTiendasLocal(): Record<string, DatosTienda> {
  try {
    const v = JSON.parse(localStorage.getItem(LS_TIENDAS) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

const guardarTiendasLocal = (t: Record<string, DatosTienda>) => {
  try { localStorage.setItem(LS_TIENDAS, JSON.stringify(t)); } catch { /* lleno */ }
};

/** Junta lo del aparato con lo de la nube (gana el más reciente por tienda). */
export async function cargarTiendas(): Promise<Record<string, DatosTienda>> {
  const local = cargarTiendasLocal();
  if (!isSupabaseConfigured) return local;
  const { data, error } = await supabase.from('tiendas_ruta').select('cliente_id, dueno, whatsapp, barrio, actualizado_en');
  if (error) return local;
  const out = { ...local };
  for (const r of data ?? []) {
    const nube: DatosTienda = {
      clienteId: r.cliente_id,
      dueno: r.dueno ?? undefined,
      whatsapp: r.whatsapp ?? undefined,
      barrio: r.barrio ?? undefined,
      actualizadoEn: new Date(r.actualizado_en).getTime() || 0,
    };
    const aqui = out[r.cliente_id];
    if (!aqui || nube.actualizadoEn >= (aqui.actualizadoEn || 0)) out[r.cliente_id] = nube;
  }
  guardarTiendasLocal(out);
  return out;
}

export async function guardarTienda(t: DatosTienda): Promise<void> {
  const todas = cargarTiendasLocal();
  todas[t.clienteId] = t;
  guardarTiendasLocal(todas);
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('tiendas_ruta').upsert({
    cliente_id: t.clienteId,
    dueno: t.dueno || null,
    whatsapp: t.whatsapp || null,
    barrio: t.barrio || null,
    actualizado_en: new Date(t.actualizadoEn).toISOString(),
  });
  if (error) throw error;
}

/** Enlace de WhatsApp (Colombia por defecto). '' si no hay número. */
export function enlaceWhatsapp(numero: string | undefined, texto = ''): string {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (digitos.length < 7) return '';
  const completo = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${completo}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
