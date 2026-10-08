/**
 * BIBLIOTECA DE MARKETING — Dulce Placer
 * Creado 2026-09-20, a pedido de Gonzalo.
 *
 * Guarda TODO lo que se crea, para que después un sistema automático pueda
 * programar campañas: las fotos y videos quedan en Supabase (depósito
 * "marketing", público) y cada publicación queda en la tabla del historial.
 *
 * POR QUÉ EL DEPÓSITO ES PÚBLICO: Instagram no recibe la foto en el mensaje.
 * Hay que darle un ENLACE y él la descarga desde internet. Si el enlace no es
 * público, Instagram no puede bajarla y la publicación falla. Lo mismo con los
 * videos. Aquí no se guarda nada privado: son las fotos que de todas formas se
 * van a publicar en redes.
 *
 * Tablas (creadas el 2026-09-20):
 *   marketing_medios        — la biblioteca de fotos y videos
 *   marketing_publicaciones — el historial de cada publicación
 *   marketing_rutinas       — lo que se repite (martes 7am, etc.)
 */

import { supabase } from '@/lib/supabase';

const DEPOSITO = 'marketing';

export type MarcaMarketing = 'panaderia' | 'andrea';
export type TipoMedio = 'imagen' | 'video';

export interface MedioGuardado {
  id: string;
  url: string;
  ruta: string;
  tipo: TipoMedio;
}

export interface PublicacionGuardada {
  id?: string;
  creado_en?: string;
  marca?: MarcaMarketing;
  enfoque?: string | null;
  ocasion?: string | null;
  ocasion_libre?: string | null;
  titular?: string | null;
  texto?: string | null;
  hashtags?: string | null;
  color_titular?: string | null;
  fuente_titular?: string | null;
  posicion_titular?: string | null;
  efecto?: string | null;
  formato?: string | null;
  movimiento?: string | null;
  redes?: string[];
  medios?: any;
  arte_url?: string | null;
  video_url?: string | null;
  estado?: string;
  programada_para?: string | null;
  publicada_en?: string | null;
  resultados?: any;
  enlace_facebook?: string | null;
  enlace_instagram?: string | null;
  error?: string | null;
  origen?: string;
}

/** Convierte una imagen/video en data URL a bytes, para poder subirlo. */
function dataUrlABlob(dataUrl: string): Blob {
  const coincide = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  const tipo = coincide ? coincide[1] : 'image/jpeg';
  const base64 = coincide ? coincide[2] : dataUrl;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

function extensionDe(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  return 'jpg';
}

/** Nombre único, ordenado por fecha, para que la carpeta quede legible. */
function nombreUnico(marca: string, tipo: TipoMedio, ext: string): string {
  const hoy = new Date();
  const dia = hoy.toISOString().slice(0, 10);
  const sello = hoy.getTime().toString(36);
  const azar = Math.random().toString(36).slice(2, 7);
  return `${marca}/${dia}/${tipo}-${sello}-${azar}.${ext}`;
}

/**
 * Sube una foto o un video al depósito y lo anota en la biblioteca.
 * Devuelve el enlace público, que es lo que necesita Instagram.
 */
export async function subirMedio(params: {
  contenido: string | Blob;
  tipo: TipoMedio;
  marca?: MarcaMarketing;
  origen?: string;
  etiquetas?: string[];
}): Promise<MedioGuardado> {
  const marca = params.marca || 'panaderia';
  const blob = typeof params.contenido === 'string'
    ? dataUrlABlob(params.contenido)
    : params.contenido;

  const ext = extensionDe(blob.type || '');
  const ruta = nombreUnico(marca, params.tipo, ext);

  const { error: errorSubida } = await supabase.storage
    .from(DEPOSITO)
    .upload(ruta, blob, { contentType: blob.type || undefined, upsert: false });

  if (errorSubida) {
    throw new Error(`No se pudo guardar el archivo: ${errorSubida.message}`);
  }

  const { data: publico } = supabase.storage.from(DEPOSITO).getPublicUrl(ruta);
  const url = publico.publicUrl;

  // Se anota en la biblioteca. Si esto falla, el archivo YA está subido y el
  // enlace sirve igual, así que no se tumba la publicación por eso.
  let id = '';
  try {
    const { data, error } = await supabase
      .from('marketing_medios')
      .insert({
        marca,
        tipo: params.tipo,
        url,
        ruta,
        bytes: blob.size,
        etiquetas: params.etiquetas || [],
        origen: params.origen || 'flash',
      })
      .select('id')
      .single();
    if (!error && data) id = data.id;
  } catch {
    /* la biblioteca es un registro, no un requisito */
  }

  return { id, url, ruta, tipo: params.tipo };
}

/** Sube varias fotos de una. Devuelve solo las que sí subieron. */
export async function subirVariasFotos(
  fotos: string[], marca: MarcaMarketing = 'panaderia', origen = 'flash'
): Promise<MedioGuardado[]> {
  const resultados = await Promise.allSettled(
    fotos.map((f) => subirMedio({ contenido: f, tipo: 'imagen', marca, origen }))
  );
  return resultados
    .filter((r): r is PromiseFulfilledResult<MedioGuardado> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/** Anota una publicación en el historial. Devuelve su id. */
export async function guardarPublicacion(
  datos: PublicacionGuardada
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('marketing_publicaciones')
      .insert(datos)
      .select('id')
      .single();
    if (error) {
      console.warn('[marketing] no se pudo guardar en el historial:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (e: any) {
    console.warn('[marketing] no se pudo guardar en el historial:', e?.message);
    return null;
  }
}

/** Actualiza una publicación ya anotada (por ejemplo con el resultado real). */
export async function actualizarPublicacion(
  id: string, cambios: PublicacionGuardada
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('marketing_publicaciones')
      .update(cambios)
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/** El historial, lo más reciente primero. */
export async function listarPublicaciones(
  limite = 50, marca?: MarcaMarketing
): Promise<PublicacionGuardada[]> {
  try {
    let consulta = supabase
      .from('marketing_publicaciones')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(limite);
    if (marca) consulta = consulta.eq('marca', marca);
    const { data, error } = await consulta;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** La biblioteca de fotos y videos, lo más reciente primero. */
export async function listarMedios(
  limite = 60, marca?: MarcaMarketing, tipo?: TipoMedio
): Promise<{ id: string; url: string; tipo: TipoMedio; creado_en: string }[]> {
  try {
    let consulta = supabase
      .from('marketing_medios')
      .select('id, url, tipo, creado_en')
      .order('creado_en', { ascending: false })
      .limit(limite);
    if (marca) consulta = consulta.eq('marca', marca);
    if (tipo) consulta = consulta.eq('tipo', tipo);
    const { data, error } = await consulta;
    if (error) return [];
    return (data || []) as any;
  } catch {
    return [];
  }
}
