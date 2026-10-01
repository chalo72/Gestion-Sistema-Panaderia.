/**
 * MOTOR DE VIDEO — Dulce Placer
 * Creado 2026-09-19.
 *
 * Genera videos cortos REALES (archivo .mp4) a partir de una foto y unos textos,
 * dibujándolos cuadro a cuadro en un canvas y grabándolos con MediaRecorder.
 *
 * Por qué así y no con un servicio de IA:
 *  - Es 100% gratis y sin límite de videos.
 *  - NO pone marca de agua.
 *  - No necesita servidor ni que el PC esté prendido: corre en el mismo
 *    navegador del celular o del computador que está usando la app.
 *
 * Verificado el 2026-09-19: el navegador soporta grabar en
 * 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' (H.264), que es el formato que
 * aceptan Instagram, TikTok, Facebook y WhatsApp.
 */

export type FormatoVideo = 'vertical' | 'cuadrado' | 'horizontal';

export interface OpcionesVideo {
  /** Foto de fondo (data URL o URL). */
  imagen: string;
  /** Frases que van apareciendo, en orden. La primera es el gancho. */
  frases: string[];
  /** Texto pequeño fijo abajo (ej: @dulceplacer1729). */
  firma?: string;
  formato?: FormatoVideo;
  /** Duración total en segundos (por defecto 10). */
  duracionSeg?: number;
  /** Color del texto. Por defecto amarillo. */
  colorTexto?: string;
  /** Color de la franja (solo diseño 'banda'). */
  colorFondo?: string;
  /**
   * 'banda'  → la foto queda completa arriba y el texto en una franja abajo
   *            (NADA tapa el producto). Es el recomendado.
   * 'abajo'  → texto encima de la foto, abajo, con degradado.
   * 'arriba' → texto encima de la foto, arriba.
   */
  diseno?: 'banda' | 'abajo' | 'arriba';
  /** Para mostrar el avance de 0 a 100. */
  onProgreso?: (pct: number) => void;
}

export interface ResultadoVideo {
  blob: Blob;
  url: string;
  extension: 'mp4' | 'webm';
  mimeType: string;
  duracionSeg: number;
}

const MEDIDAS: Record<FormatoVideo, { w: number; h: number }> = {
  vertical: { w: 1080, h: 1920 },   // Reels, Shorts, Historias, Estado de WhatsApp
  cuadrado: { w: 1080, h: 1080 },   // Publicación de feed
  horizontal: { w: 1920, h: 1080 }, // YouTube
};

/** Elige el mejor formato de grabación que soporte este navegador. */
function elegirMimeType(): { mimeType: string; extension: 'mp4' | 'webm' } {
  const candidatos: Array<{ mimeType: string; extension: 'mp4' | 'webm' }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];
  for (const c of candidatos) {
    try { if (MediaRecorder.isTypeSupported(c.mimeType)) return c; } catch { /* seguir */ }
  }
  return { mimeType: '', extension: 'webm' };
}

/** Parte un texto en renglones que quepan en el ancho dado. */
function partirEnRenglones(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la foto para el video.'));
    img.src = src;
  });
}

/**
 * Genera el video y devuelve el archivo listo para descargar o publicar.
 * Se graba en tiempo real: un video de 10 segundos tarda ~10 segundos.
 */
export async function generarVideoCorto(opts: OpcionesVideo): Promise<ResultadoVideo> {
  const formato = opts.formato || 'vertical';
  const duracionSeg = Math.min(Math.max(opts.duracionSeg ?? 10, 4), 60);
  const { w, h } = MEDIDAS[formato];
  const frases = (opts.frases || []).map(f => f.trim()).filter(Boolean).slice(0, 4);
  if (frases.length === 0) frases.push('Dulce Placer');

  const img = await cargarImagen(opts.imagen);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite dibujar el video.');

  const { mimeType, extension } = elegirMimeType();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 6_000_000,
  });

  const trozos: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) trozos.push(e.data); };

  const terminado = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(trozos, { type: mimeType || 'video/webm' }));
  });

  const duracionMs = duracionSeg * 1000;
  const inicio = performance.now();

  const colorTexto = opts.colorTexto || '#facc15';
  const colorFondo = opts.colorFondo || '#0f172a';
  const diseno = opts.diseno || 'banda';

  const margen = w * 0.075;
  const tamFuente = Math.round(w * (formato === 'horizontal' ? 0.052 : 0.068));
  const altoRenglon = tamFuente * 1.2;
  // Altura de la franja de texto (solo en diseño 'banda')
  const altoBanda = Math.round(h * (formato === 'vertical' ? 0.26 : 0.22));
  const altoFoto = diseno === 'banda' ? h - altoBanda : h;
  const escalaFoto = Math.max(w / img.width, altoFoto / img.height);

  const dibujar = () => {
    const t = performance.now() - inicio;
    const avance = Math.min(t / duracionMs, 1);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // --- Foto con acercamiento lento (Ken Burns) ---
    const zoom = 1 + 0.16 * avance;
    const esc = escalaFoto * zoom;
    const anchoDib = img.width * esc;
    const altoDib = img.height * esc;
    const desplazamiento = 0.03 * avance;
    const x = (w - anchoDib) / 2 - anchoDib * desplazamiento * 0.5;
    const y = (altoFoto - altoDib) / 2 - altoDib * desplazamiento;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, altoFoto);
    ctx.clip();
    ctx.drawImage(img, x, y, anchoDib, altoDib);
    ctx.restore();

    if (diseno === 'banda') {
      // Franja de color abajo: la foto queda intacta.
      ctx.fillStyle = colorFondo;
      ctx.fillRect(0, altoFoto, w, altoBanda);
      ctx.fillStyle = colorTexto;
      ctx.fillRect(0, altoFoto, w, Math.max(4, w * 0.006));
    } else {
      // Degradado para que el texto encima se lea
      const arriba = diseno === 'arriba';
      const grad = arriba
        ? ctx.createLinearGradient(0, 0, 0, h * 0.5)
        : ctx.createLinearGradient(0, h * 0.4, 0, h);
      grad.addColorStop(0, arriba ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0)');
      grad.addColorStop(1, arriba ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, arriba ? 0 : h * 0.4, w, arriba ? h * 0.5 : h * 0.6);
    }

    // --- Texto: cada frase aparece en su turno ---
    const porFrase = 1 / frases.length;
    const indice = Math.min(Math.floor(avance / porFrase), frases.length - 1);
    const avanceLocal = (avance - indice * porFrase) / porFrase;
    const entrada = Math.min(avanceLocal / 0.18, 1);
    const salida = indice < frases.length - 1
      ? 1 - Math.max((avanceLocal - 0.88) / 0.12, 0)
      : 1;
    const opacidad = Math.max(0, Math.min(entrada, salida));
    const subida = (1 - entrada) * (h * 0.02);

    ctx.font = `900 ${tamFuente}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const renglones = partirEnRenglones(ctx, frases[indice], w - margen * 2);

    let baseY: number;
    if (diseno === 'banda') {
      baseY = altoFoto + margen * 0.75 + tamFuente;
    } else if (diseno === 'arriba') {
      baseY = margen + tamFuente;
    } else {
      baseY = h - h * 0.15 - (renglones.length - 1) * altoRenglon;
    }

    ctx.save();
    ctx.globalAlpha = opacidad;
    if (diseno !== 'banda') {
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = Math.round(w * 0.018);
      ctx.shadowOffsetY = Math.round(w * 0.004);
    }
    ctx.fillStyle = colorTexto;
    renglones.forEach((linea, i) => {
      ctx.fillText(linea, margen, baseY + subida + i * altoRenglon);
    });
    ctx.restore();

    // --- Firma fija ---
    if (opts.firma) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = `600 ${Math.round(w * 0.030)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = diseno === 'banda' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)';
      if (diseno !== 'banda') {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = Math.round(w * 0.012);
      }
      ctx.fillText(opts.firma, margen, h - h * 0.035);
      ctx.restore();
    }

    opts.onProgreso?.(Math.round(avance * 100));

    if (avance < 1) {
      requestAnimationFrame(dibujar);
    } else {
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120);
    }
  };

  recorder.start(200);
  requestAnimationFrame(dibujar);

  const blob = await terminado;
  stream.getTracks().forEach(t => t.stop());

  return {
    blob,
    url: URL.createObjectURL(blob),
    extension,
    mimeType: mimeType || 'video/webm',
    duracionSeg,
  };
}

/** Descarga el video generado con un nombre claro. */
export function descargarVideo(resultado: ResultadoVideo, nombreBase = 'dulce-placer') {
  const a = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = resultado.url;
  a.download = `${nombreBase}-${fecha}.${resultado.extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
