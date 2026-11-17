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
  | 'incumplimiento'
  | 'plata_bolsillo'
  | 'plata_delantal'
  | 'bolsos_bajo_caja'
  | 'escondite_gaveta'
  | 'billete_arrugado'
  | 'plata_manga_ropa'
  | 'fajo_fuera_caja'
  | 'cambio_falso'
  | 'bodega_gaseosa'
  | 'gaveta_sin_cliente'
  | 'mano_zona_privada'
  | 'entrega_tercero'
  | 'trapo_servilleta'
  | 'gaveta_abierta'
  | 'tapa_gaveta'
  | 'salida_con_bulto'
  | 'basura_sospechosa'
  | 'dos_en_gaveta'
  | 'visita_mostrador'
  | 'helado_sin_cobro'
  | 'helado_extra'
  | 'helado_personal'
  | 'helado_regalo'
  | 'topping_sin_cobro'
  | 'nevera_helado_abierta'
  | 'pan_se_come'
  | 'pan_se_lleva'
  | 'masa_bolsillo'
  | 'bandeja_oculta'
  | 'puerta_trasera';

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
 * Bandejas forenses (orden de gravedad ↑):
 * 1) sospechoso — indicios
 * 2) evidencia — irregularidad comprobada (antes “revisión”)
 * 3) cuarentena — urgente / grave (auditor forense)
 */
export type BandejaForense = 'sospechoso' | 'evidencia' | 'cuarentena';

/** Alias legacy: archivos viejos en revision/ se leen como evidencia. */
export type BandejaForenseLegacy = BandejaForense | 'revision';

export const BANDEJAS_FORENSES: { id: BandejaForense; label: string; hint: string }[] = [
  { id: 'sospechoso', label: 'Sospechoso', hint: 'Indicios' },
  { id: 'evidencia', label: 'Evidencia', hint: 'Comprobada' },
  { id: 'cuarentena', label: 'Cuarentena', hint: 'Urgente' },
];

/** Nombre seguro para carpeta o archivo en la nube. */
export function nombreCarpetaNube(texto: string): string {
  const limpio = (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return limpio || 'sin-nombre';
}

/**
 * Copia el mismo video a dos carpetas de la nube:
 * trabajadores/{persona}/{fecha}/... y situaciones/{regular|otra}/{fecha}/...
 * El clip original de la cámara se deja donde estaba.
 */
export async function archivarClipEnCarpetas(
  blob: Blob,
  datos: { trabajador: string; contexto: string; descripcion: string; clasificacion: string; cuando?: Date; donde?: 'trabajador' | 'situacion' },
): Promise<string | null> {
  const cuando = datos.cuando || new Date();
  const fecha = cuando.toISOString().slice(0, 10);
  const hora = cuando.toISOString().slice(11, 19).replace(/:/g, '');
  const quien = nombreCarpetaNube(datos.trabajador || 'sin-turno');
  const ctx = nombreCarpetaNube(datos.contexto || 'ronda');
  const desc = nombreCarpetaNube(datos.descripcion || 'sin-descripcion').slice(0, 40);
  const sit = nombreCarpetaNube(datos.clasificacion || 'sin-clasificar');
  const tipo = blob.type || 'video/webm';
  const ruta = datos.donde === 'situacion'
    ? `situaciones/${sit}/${fecha}/${fecha}_${hora}_${quien}_${ctx}.webm`
    : `trabajadores/${quien}/${fecha}/${fecha}_${hora}_${ctx}_${desc}.webm`;
  const subida = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: tipo, upsert: false });
  if (subida.error) return null;
  return ruta;
}

/**
 * Sube un clip (Blob webm/mp4) al bucket privado de Storage.
 * Devuelve la RUTA dentro del bucket (no una URL pública: el bucket es privado
 * a propósito, porque son videos de los trabajadores).
 */
export async function subirClipBitacora(blob: Blob, camaraId: string): Promise<string> {
  const esJpg = (blob.type || '').includes('jpeg') || (blob.type || '').includes('jpg');
  const ext = esJpg ? 'jpg' : 'webm';
  const ruta = `${camaraId}/${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, {
    contentType: esJpg ? 'image/jpeg' : 'video/webm',
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
    trabajador?: string | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    analizado: true,
    descripcion_ia: resultado.descripcion_ia,
    clasificacion: resultado.clasificacion,
    categorias_detectadas: resultado.categorias_detectadas,
    alerta: resultado.alerta,
  };
  if (resultado.trabajador) patch.trabajador_id = resultado.trabajador;
  const { error } = await supabase.from('bitacora_visual').update(patch).eq('id', id);
  if (error && resultado.trabajador) {
    delete patch.trabajador_id;
    const retry = await supabase.from('bitacora_visual').update(patch).eq('id', id);
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}

/** Últimas grabaciones guardadas en la nube, para verlas desde cualquier aparato. */
export async function clipsRecientes(limite = 40): Promise<ClipBitacora[]> {
  const { data, error } = await supabase
    .from('bitacora_visual')
    .select('*')
    .order('capturado_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []) as ClipBitacora[];
}

/** Clips que la IA marcó como posible problema (alerta, malo, regular o por mejorar). 2026-10-20 */
export async function clipsEnRevision(limite = 60): Promise<ClipBitacora[]> {
  const { data, error } = await supabase
    .from('bitacora_visual')
    .select('*')
    .or('alerta.eq.true,clasificacion.in.(malo,regular,por_mejorar)')
    .order('capturado_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []) as ClipBitacora[];
}

/** Título corto para el archivo en nube (fecha · cámara · categoría · gesto). */
export function tituloHallazgoForense(opts: {
  camara?: string;
  categorias?: string[];
  clasificacion?: string | null;
  descripcion?: string;
  cuando?: Date;
  /** Título ya redactado por la IA (línea REPORTE:). */
  reporteIa?: string | null;
}): string {
  if (opts.reporteIa?.trim()) {
    return opts.reporteIa.trim().slice(0, 140);
  }
  const cam = (opts.camara || 'camara').slice(0, 28);
  const cats = (opts.categorias || []).filter(Boolean).slice(0, 2).join('+');
  const clase = opts.clasificacion || '';
  const etiqueta = cats || clase || 'irregularidad';
  const cuando = opts.cuando || new Date();
  const fecha = cuando.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const desc = (opts.descripcion || '')
    .replace(/\s+/g, ' ')
    .replace(/SIN_ANOMALIA/gi, '')
    .trim()
    .slice(0, 70);
  return desc ? `${fecha} · ${cam} · ${etiqueta} · ${desc}` : `${fecha} · ${cam} · ${etiqueta}`;
}

/**
 * Copia un clip ya existente (por ruta en el bucket) a bandeja forense:
 * sospechoso/ | evidencia/ | cuarentena/
 */
export async function archivarClipEnBandejaForense(
  rutaOrigen: string,
  bandeja: BandejaForense,
  datos: { camara?: string; descripcion?: string; cuando?: Date; titulo?: string }
): Promise<string | null> {
  try {
    const { data: archivo, error: errDl } = await supabase.storage.from(BUCKET).download(rutaOrigen);
    if (errDl || !archivo) return null;
    const cuando = datos.cuando || new Date();
    const fecha = cuando.toISOString().slice(0, 10);
    const hora = cuando.toISOString().slice(11, 19).replace(/:/g, '');
    const cam = nombreCarpetaNube(datos.camara || 'camara');
    const desc = nombreCarpetaNube(datos.titulo || datos.descripcion || 'anomalia').slice(0, 60);
    const ruta = `${bandeja}/${fecha}/${fecha}_${hora}_${cam}_${desc}.webm`;
    const subida = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
      contentType: archivo.type || 'video/webm',
      upsert: false,
    });
    if (subida.error) return null;
    return ruta;
  } catch {
    return null;
  }
}

/** Sube un JPEG/WebM nuevo directo a bandeja forense (escaneo DVR). */
export async function archivarBlobEnBandejaForense(
  blob: Blob,
  bandeja: BandejaForense,
  datos: { camara?: string; descripcion?: string; cuando?: Date; titulo?: string }
): Promise<string | null> {
  try {
    const cuando = datos.cuando || new Date();
    const fecha = cuando.toISOString().slice(0, 10);
    const hora = cuando.toISOString().slice(11, 19).replace(/:/g, '');
    const cam = nombreCarpetaNube(datos.camara || 'camara');
    const desc = nombreCarpetaNube(datos.titulo || datos.descripcion || 'anomalia').slice(0, 60);
    const ext = (blob.type || '').includes('jpeg') || (blob.type || '').includes('jpg') ? 'jpg' : 'webm';
    const ruta = `${bandeja}/${fecha}/${fecha}_${hora}_${cam}_${desc}.${ext}`;
    const subida = await supabase.storage.from(BUCKET).upload(ruta, blob, {
      contentType: blob.type || (ext === 'jpg' ? 'image/jpeg' : 'video/webm'),
      upsert: false,
    });
    if (subida.error) return null;
    return ruta;
  } catch {
    return null;
  }
}

/** dataURL → Blob (para archivar frames del DVR). */
export function dataUrlABlob(dataUrl: string): Blob | null {
  try {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || 'image/jpeg' });
  } catch {
    return null;
  }
}

/** Elige bandeja según gravedad del análisis. */
export function bandejaDesdeAnalisis(opts: {
  alerta: boolean;
  clasificacion: ClasificacionBitacora | null;
  categorias: string[];
  descripcion?: string;
}): BandejaForense | null {
  const desc = (opts.descripcion || '').toLowerCase();
  if (/sin_anomalia|sin_imagen|no pude ver/.test(desc)) return null;
  const cats = opts.categorias.map((c) => c.toLowerCase());
  const grave =
    cats.includes('robo') ||
    cats.includes('devolucion_simulada') ||
    cats.includes('plata_bolsillo') ||
    cats.includes('plata_delantal') ||
    cats.includes('bolsos_bajo_caja') ||
    cats.includes('escondite_gaveta') ||
    cats.includes('billete_arrugado') ||
    cats.includes('plata_manga_ropa') ||
    cats.includes('fajo_fuera_caja') ||
    cats.includes('mano_zona_privada') ||
    cats.includes('entrega_tercero') ||
    cats.includes('trapo_servilleta') ||
    cats.includes('tapa_gaveta') ||
    cats.includes('salida_con_bulto') ||
    cats.includes('basura_sospechosa') ||
    cats.includes('dos_en_gaveta') ||
    cats.includes('helado_sin_cobro') ||
    cats.includes('helado_extra') ||
    cats.includes('helado_personal') ||
    cats.includes('helado_regalo') ||
    cats.includes('topping_sin_cobro') ||
    cats.includes('pan_se_come') ||
    cats.includes('pan_se_lleva') ||
    cats.includes('masa_bolsillo') ||
    cats.includes('bandeja_oculta') ||
    cats.includes('puerta_trasera');
  // 3) Cuarentena — urgente / grave
  if (grave || opts.clasificacion === 'malo') return 'cuarentena';
  // 2) Evidencia comprobada — irregularidad vista (categoría o clase clara)
  if (
    cats.length > 0 ||
    opts.clasificacion === 'regular' ||
    opts.clasificacion === 'por_mejorar'
  ) {
    return 'evidencia';
  }
  // 1) Sospechoso — solo indicios (alerta sin categoría firme)
  if (opts.alerta) return 'sospechoso';
  return null;
}

const CATS_GRAVES = new Set([
  'robo',
  'devolucion_simulada',
  'plata_bolsillo',
  'plata_delantal',
  'bolsos_bajo_caja',
  'escondite_gaveta',
  'billete_arrugado',
  'plata_manga_ropa',
  'fajo_fuera_caja',
  'cambio_falso',
  'mano_zona_privada',
  'entrega_tercero',
  'trapo_servilleta',
  'tapa_gaveta',
  'salida_con_bulto',
  'basura_sospechosa',
  'dos_en_gaveta',
  'helado_sin_cobro',
  'helado_extra',
  'helado_personal',
  'helado_regalo',
  'topping_sin_cobro',
  'pan_se_come',
  'pan_se_lleva',
  'masa_bolsillo',
  'bandeja_oculta',
  'puerta_trasera',
]);

/** Lista clips de bitácora filtrados como si fueran las 3 carpetas (para la UI). */
export async function clipsPorCarpetaUI(
  carpeta: 'todas' | BandejaForense,
  limite = 60
): Promise<ClipBitacora[]> {
  if (carpeta === 'todas') return clipsRecientes(limite);
  const { data, error } = await supabase
    .from('bitacora_visual')
    .select('*')
    .order('capturado_en', { ascending: false })
    .limit(Math.max(limite * 3, 120));
  if (error) throw error;
  const todos = (data || []) as ClipBitacora[];
  const filtrados = todos.filter((c) => {
    const cats = (c.categorias_detectadas || []).map((x) => String(x).toLowerCase());
    const grave = cats.some((x) => CATS_GRAVES.has(x));
    if (carpeta === 'cuarentena') return c.clasificacion === 'malo' || grave;
    if (carpeta === 'sospechoso') {
      // Solo indicios: alerta sin categoría firme
      return Boolean(c.alerta) && cats.length === 0 && c.clasificacion !== 'malo' && !grave;
    }
    // evidencia comprobada (antes “revisión”)
    return (
      !grave &&
      c.clasificacion !== 'malo' &&
      (cats.length > 0 ||
        c.clasificacion === 'regular' ||
        c.clasificacion === 'por_mejorar')
    );
  });
  return filtrados.slice(0, limite);
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

/** Clips entre dos fechas (para cruzar con la Auditoría Digital). Devuelve [] si la tabla no existe. */
export async function clipsEnRango(desdeISO: string, hastaISO: string, limite = 1500): Promise<ClipBitacora[]> {
  try {
    const { data, error } = await supabase
      .from('bitacora_visual')
      .select('*')
      .gte('capturado_en', new Date(`${desdeISO}T00:00:00`).toISOString())
      .lte('capturado_en', new Date(`${hastaISO}T23:59:59`).toISOString())
      .order('capturado_en', { ascending: false })
      .limit(limite);
    if (error) return [];
    return (data || []) as ClipBitacora[];
  } catch {
    return [];
  }
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
