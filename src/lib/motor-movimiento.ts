/**
 * MOTOR DE MOVIMIENTO — Dulce Placer
 * Creado 2026-09-20, a pedido de Gonzalo (boomerang, acercamiento, 360, carrusel).
 *
 * Convierte UNA o VARIAS fotos en un video corto .mp4, en el navegador,
 * gratis y sin marca de agua. No sube nada a ningún servidor.
 *
 * HONESTIDAD SOBRE EL 360 Y EL BOOMERANG:
 *  - Con UNA sola foto no existe un 360 real (no hay otros ángulos del producto)
 *    ni un boomerang real (el de Instagram es una ráfaga de fotos). Con una foto
 *    se hace un vaivén de zoom, que se le parece mucho pero no es lo mismo.
 *  - Con VARIAS fotos sí son reales: el 360 recorre las fotos como si uno diera
 *    la vuelta alrededor, y el boomerang va y vuelve por ellas.
 *  Por eso cada movimiento declara `minFotos`: la interfaz solo debe ofrecer
 *  los que alcanzan con las fotos que haya cargadas.
 *
 * Sin audio a propósito: evita líos de derechos de la música.
 */

import { buscarFuente } from '@/lib/motor-arte';

export type FormatoMovimiento = 'vertical' | 'cuadrado' | 'horizontal';

export type IdMovimiento =
  | 'quieto' | 'acercar' | 'alejar' | 'boomerang' | 'paneo-lat' | 'paneo-vert'
  | 'latido' | 'balanceo' | 'giro' | 'temblor' | 'brillo' | 'destellos'
  | 'fundido' | 'carrusel' | 'giro360';

export interface Movimiento {
  id: IdMovimiento;
  nombre: string;
  descripcion: string;
  /** Cuántas fotos hacen falta como mínimo. */
  minFotos: number;
  /** Duración sugerida en segundos (el carrusel la calcula por foto). */
  segundos: number;
}

export const MOVIMIENTOS: Movimiento[] = [
  { id: 'quieto',    nombre: '🖼️ Sin movimiento', descripcion: 'La foto quieta. Sirve para publicar imagen, no video.', minFotos: 1, segundos: 4 },
  { id: 'acercar',   nombre: '🔍 Acercamiento',   descripcion: 'La cámara se acerca despacio al producto.', minFotos: 1, segundos: 5 },
  { id: 'alejar',    nombre: '🔭 Alejamiento',    descripcion: 'Arranca cerquita y se va abriendo.', minFotos: 1, segundos: 5 },
  { id: 'boomerang', nombre: '🔁 Boomerang',      descripcion: 'Va y vuelve, en vaivén. Con varias fotos es un boomerang de verdad.', minFotos: 1, segundos: 4 },
  { id: 'paneo-lat', nombre: '↔️ Paneo lateral',  descripcion: 'Recorre la foto de lado a lado.', minFotos: 1, segundos: 5 },
  { id: 'paneo-vert',nombre: '↕️ Paneo vertical', descripcion: 'Recorre la foto de arriba a abajo.', minFotos: 1, segundos: 5 },
  { id: 'latido',    nombre: '💓 Latido',         descripcion: 'Pulso suave, como respirando. Muy bueno para antojo.', minFotos: 1, segundos: 4 },
  { id: 'balanceo',  nombre: '🎐 Balanceo',       descripcion: 'Se mece apenas, de un lado al otro.', minFotos: 1, segundos: 5 },
  { id: 'giro',      nombre: '🌀 Giro',           descripcion: 'La foto da una vuelta completa sobre sí misma.', minFotos: 1, segundos: 5 },
  { id: 'temblor',   nombre: '📳 Temblor',        descripcion: 'Vibración sutil, tipo cámara en mano.', minFotos: 1, segundos: 4 },
  { id: 'brillo',    nombre: '✨ Barrido de luz', descripcion: 'Una luz cruza la foto en diagonal.', minFotos: 1, segundos: 4 },
  { id: 'destellos', nombre: '🌟 Destellos',      descripcion: 'Luces doradas cayendo sobre el producto.', minFotos: 1, segundos: 5 },
  { id: 'fundido',   nombre: '🎬 Fundido',        descripcion: 'Aparece desde negro y se va a negro.', minFotos: 1, segundos: 4 },
  { id: 'carrusel',  nombre: '🎞️ Carrusel',       descripcion: 'Pasa tus fotos una por una, con transición suave.', minFotos: 2, segundos: 0 },
  { id: 'giro360',   nombre: '🔄 360°',           descripcion: 'Recorre las fotos como dando la vuelta al producto. Necesita fotos desde varios lados.', minFotos: 3, segundos: 5 },
];

/** Los que se pueden usar con la cantidad de fotos que hay cargadas. */
export function movimientosDisponibles(cuantasFotos: number): Movimiento[] {
  return MOVIMIENTOS.filter((m) => cuantasFotos >= m.minFotos);
}

export function buscarMovimiento(id: string): Movimiento {
  return MOVIMIENTOS.find((m) => m.id === id) || MOVIMIENTOS[0];
}

const MEDIDAS: Record<FormatoMovimiento, { w: number; h: number }> = {
  vertical:   { w: 1080, h: 1920 },
  cuadrado:   { w: 1080, h: 1080 },
  horizontal: { w: 1920, h: 1080 },
};

/** MP4 si el navegador lo permite; si no, WebM (Chrome siempre puede uno de los dos). */
function elegirMimeType(): { mimeType: string; extension: 'mp4' | 'webm' } {
  const candidatos: { mimeType: string; extension: 'mp4' | 'webm' }[] = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];
  for (const c of candidatos) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: '', extension: 'webm' };
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar una de las fotos.'));
    img.src = src;
  });
}

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

/** Dibuja una foto tapando todo el lienzo, con escala y desplazamiento. */
function dibujarFoto(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  w: number, h: number, escalaExtra: number, dx: number, dy: number, giro: number, alfa: number
) {
  const base = Math.max(w / img.width, h / img.height);
  const esc = base * escalaExtra;
  const ancho = img.width * esc;
  const alto = img.height * esc;

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(w / 2 + dx, h / 2 + dy);
  if (giro) ctx.rotate(giro);
  ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto);
  ctx.restore();
}

interface Chispa { x: number; y: number; r: number; v: number; fase: number; }

export interface OpcionesMovimiento {
  /** Una o varias fotos, en data URL. */
  imagenes: string[];
  movimiento: IdMovimiento;
  formato?: FormatoMovimiento;
  /** Texto corto que va escrito sobre el video. Opcional. */
  titular?: string;
  colorTexto?: string;
  fuente?: string;
  /** Segundos. Si no viene, se usa el sugerido del movimiento. */
  segundos?: number;
  onProgreso?: (porcentaje: number) => void;
}

export interface ResultadoMovimiento {
  blob: Blob;
  url: string;
  extension: 'mp4' | 'webm';
  segundos: number;
}

/**
 * Genera el video. OJO: se graba en tiempo real, así que un video de 5 segundos
 * tarda 5 segundos en hacerse. Eso no es lentitud, es cómo graba el navegador.
 */
export async function generarVideoMovimiento(
  opts: OpcionesMovimiento
): Promise<ResultadoMovimiento> {
  if (!opts.imagenes.length) throw new Error('No hay fotos para hacer el video.');

  const mov = buscarMovimiento(opts.movimiento);
  const formato = opts.formato || 'vertical';
  const { w, h } = MEDIDAS[formato];
  const fotos = await Promise.all(opts.imagenes.map(cargarImagen));

  // El carrusel dura según cuántas fotos haya; los demás, lo suyo.
  const duracion = opts.segundos
    || (mov.id === 'carrusel' ? Math.min(30, Math.max(3, fotos.length * 1.8)) : mov.segundos)
    || 5;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite generar video.');

  const { mimeType, extension } = elegirMimeType();
  const stream = canvas.captureStream(30);
  const grabador = mimeType
    ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
    : new MediaRecorder(stream);

  const trozos: BlobPart[] = [];
  grabador.ondataavailable = (e) => { if (e.data.size > 0) trozos.push(e.data); };

  // Chispas del efecto "destellos" — posiciones fijas para que no salten.
  const chispas: Chispa[] = Array.from({ length: 28 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: w * (0.004 + Math.random() * 0.008),
    v: h * (0.06 + Math.random() * 0.12),
    fase: Math.random() * Math.PI * 2,
  }));

  const tipo = buscarFuente(opts.fuente || 'moderna');
  const colorTexto = opts.colorTexto || '#facc15';
  const margen = w * 0.075;
  const tamTitular = Math.round(w * (formato === 'horizontal' ? 0.055 : 0.072));

  const listo = new Promise<Blob>((resolve) => {
    grabador.onstop = () => resolve(new Blob(trozos, { type: mimeType || 'video/webm' }));
  });

  grabador.start();
  const inicio = performance.now();

  await new Promise<void>((resolve) => {
    const pintar = () => {
      const t = (performance.now() - inicio) / 1000;
      const avance = Math.min(1, t / duracion);

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // --- Qué foto y con qué movimiento ---
      let escala = 1;
      let dx = 0, dy = 0, giro = 0, alfa = 1;
      let indice = 0;
      let mezcla: { otra: number; peso: number } | null = null;

      switch (mov.id) {
        case 'acercar':
          escala = 1 + 0.18 * avance;
          break;
        case 'alejar':
          escala = 1.18 - 0.18 * avance;
          break;
        case 'boomerang': {
          // Va y vuelve. Con varias fotos recorre la serie de ida y de regreso.
          const vaiven = 1 - Math.abs(1 - 2 * ((t / (duracion / 2)) % 2));
          if (fotos.length > 1) {
            indice = Math.min(fotos.length - 1, Math.floor(vaiven * fotos.length));
            escala = 1.02;
          } else {
            escala = 1 + 0.14 * vaiven;
          }
          break;
        }
        case 'paneo-lat':
          escala = 1.16;
          dx = (0.5 - avance) * w * 0.16;
          break;
        case 'paneo-vert':
          escala = 1.16;
          dy = (0.5 - avance) * h * 0.12;
          break;
        case 'latido':
          escala = 1.04 + 0.035 * Math.sin(t * Math.PI * 2 * 0.9);
          break;
        case 'balanceo':
          escala = 1.14;
          giro = Math.sin(t * Math.PI * 2 * 0.35) * 0.035;
          break;
        case 'giro':
          escala = 1.45;
          giro = avance * Math.PI * 2;
          break;
        case 'temblor':
          escala = 1.08;
          dx = Math.sin(t * 17) * w * 0.004 + Math.sin(t * 7.3) * w * 0.003;
          dy = Math.cos(t * 13) * h * 0.003;
          break;
        case 'fundido':
          escala = 1 + 0.06 * avance;
          alfa = Math.min(1, Math.min(avance, 1 - avance) * 6);
          break;
        case 'carrusel': {
          const porFoto = duracion / fotos.length;
          const crudo = t / porFoto;
          indice = Math.min(fotos.length - 1, Math.floor(crudo));
          const dentro = crudo - indice;
          escala = 1.02 + 0.06 * dentro;
          // Transición suave con la siguiente en el último 22% de cada foto
          if (dentro > 0.78 && indice < fotos.length - 1) {
            mezcla = { otra: indice + 1, peso: (dentro - 0.78) / 0.22 };
          }
          break;
        }
        case 'giro360': {
          // Recorre las fotos como dando la vuelta al producto, ida y vuelta.
          const vaiven = 1 - Math.abs(1 - 2 * ((t / (duracion / 2)) % 2));
          indice = Math.min(fotos.length - 1, Math.floor(vaiven * fotos.length));
          escala = 1.04;
          break;
        }
        default:
          escala = 1.02;
      }

      const foto = fotos[Math.min(indice, fotos.length - 1)];
      dibujarFoto(ctx, foto, w, h, escala, dx, dy, giro, alfa);
      if (mezcla) {
        dibujarFoto(ctx, fotos[mezcla.otra], w, h, 1.02, 0, 0, 0, mezcla.peso);
      }

      // --- Adornos encima ---
      if (mov.id === 'brillo') {
        const pos = (avance * 1.6 - 0.3) * w;
        const grad = ctx.createLinearGradient(pos - w * 0.2, 0, pos + w * 0.2, h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.34)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      if (mov.id === 'destellos') {
        ctx.save();
        for (const c of chispas) {
          const y = (c.y + t * c.v) % (h + 40);
          const brillo = 0.35 + 0.35 * Math.sin(t * 3 + c.fase);
          ctx.globalAlpha = brillo;
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath();
          ctx.arc(c.x, y, c.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // --- Titular sobre el video ---
      if (opts.titular && opts.titular.trim()) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        ctx.font = `${tipo.peso} ${tamTitular}px ${tipo.familia}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = Math.round(w * 0.016);
        ctx.fillStyle = colorTexto;
        const renglones = partirEnRenglones(ctx, opts.titular.trim(), w - margen * 2).slice(0, 3);
        const altoRenglon = tamTitular * 1.18;
        const yBase = h - margen - (renglones.length - 1) * altoRenglon;
        renglones.forEach((linea, i) => ctx.fillText(linea, margen, yBase + i * altoRenglon));
        ctx.restore();
      }

      opts.onProgreso?.(Math.round(avance * 100));

      if (t < duracion) requestAnimationFrame(pintar);
      else { grabador.stop(); resolve(); }
    };
    requestAnimationFrame(pintar);
  });

  const blob = await listo;
  return { blob, url: URL.createObjectURL(blob), extension, segundos: duracion };
}

/** Descarga el video generado. */
export function descargarVideoMovimiento(r: ResultadoMovimiento, nombreBase = 'dulce-placer') {
  const a = document.createElement('a');
  a.href = r.url;
  a.download = `${nombreBase}-${new Date().toISOString().slice(0, 10)}.${r.extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
