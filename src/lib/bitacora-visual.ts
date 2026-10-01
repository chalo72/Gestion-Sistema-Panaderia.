import { supabase } from './supabase';

/**
 * Bitácora Visual — micro-videos (10s) de Videovigilancia guardados en Supabase Storage
 * + su análisis de IA (ODYSSEUS), para poder buscar por texto y generar el informe del día.
 *
 * Archivo NUEVO y libre (no protegido): usa el cliente `supabase` ya exportado en
 * src/lib/supabase.ts, sin tocar database.ts ni supabase-db.ts.
 */

export type CategoriaBitacora =
  | 'robo'
  | 'consumo_no_registrado'
  | 'producto_regalado'
  | 'devolucion_simulada'
  | 'incumplimiento';

export type ClasificacionBitacora = 'bueno' | 'regular' | 'malo' | 'por_mejorar';

export interface ClipBitacora {
  id: string;
  camara_id: string;
  camara_nombre: string | null;
  capturado_en: string;
  duracion_segundos: number;
  url_clip: string;
  analizado: boolean;
  descripcion_ia: string | null;
  clasificacion: ClasificacionBitacora | null;
  categorias_detectadas: CategoriaBitacora[];
  alerta: boolean;
  trabajador_id: string | null;
  created_at: string;
}

const BUCKET = 'bitacora-visual';

/**
 * Sube un clip (Blob webm/mp4) al bucket privado de Storage.
 * Devuelve la RUTA dentro del bucket (no una URL pública: el bucket es privado
 * a propósito, porque son videos de los trabajadores).
 */
export async function subirClipBitacora(blob: Blob, camaraId: string): Promise<string> {
  const ruta = `${camaraId}/${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, {
    contentType: blob.type || 'video/webm',
    upsert: false,
  });
  if (error) throw error;
  return ruta;
}

/** URL temporal (por defecto 1 hora) para reproducir o descargar un clip guardado. */
export async function urlFirmadaClip(rutaClip: string, segundos = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(rutaClip, segundos);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Guarda el registro del clip apenas se captura (sin análisis todavía). */
export async function guardarClipBitacora(datos: {
  camara_id: string;
  camara_nombre?: string | null;
  url_clip: string;
  duracion_segundos?: number;
  capturado_en?: string;
}): Promise<ClipBitacora> {
  const { data, error } = await supabase
    .from('bitacora_visual')
    .insert({
      camara_id: datos.camara_id,
      camara_nombre: datos.camara_nombre ?? null,
      url_clip: datos.url_clip,
      duracion_segundos: datos.duracion_segundos ?? 10,
      capturado_en: datos.capturado_en ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ClipBitacora;
}

/** Actualiza un clip ya guardado con lo que ODYSSEUS encontró al analizarlo. */
export async function marcarClipAnalizado(
  id: string,
  resultado: {
    descripcion_ia: string;
    clasificacion: ClasificacionBitacora | null;
    categorias_detectadas: CategoriaBitacora[];
    alerta: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('bitacora_visual')
    .update({
      analizado: true,
      descripcion_ia: resultado.descripcion_ia,
      clasificacion: resultado.clasificacion,
      categorias_detectadas: resultado.categorias_detectadas,
      alerta: resultado.alerta,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Búsqueda por texto libre sobre lo que la IA describió (para "busca tal cosa/momento"). */
export async function buscarClipsBitacora(texto: string, limite = 40): Promise<ClipBitacora[]> {
  const qSafe = texto.trim().replace(/[%,]/g, ' ').trim();
  if (!qSafe) return [];
  const { data, error } = await supabase
    .from('bitacora_visual')
    .select('*')
    .or(`descripcion_ia.ilike.%${qSafe}%,camara_nombre.ilike.%${qSafe}%`)
    .order('capturado_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []) as ClipBitacora[];
}

/** Todos los clips analizados de un día (por defecto hoy), en orden cronológico — para el informe. */
export async function clipsDelDia(fecha: Date = new Date()): Promise<ClipBitacora[]> {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from('bitacora_visual')
    .select('*')
    .gte('capturado_en', inicio.toISOString())
    .lte('capturado_en', fin.toISOString())
    .order('capturado_en', { ascending: true });
  if (error) throw error;
  return (data || []) as ClipBitacora[];
}
