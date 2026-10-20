/**
 * MOTOR DE ARTE — Dulce Placer
 * Creado 2026-09-19. Ampliado el mismo día con colores y diseños.
 *
 * Arma la IMAGEN terminada de la campaña. Gratis, sin marca de agua y sin
 * servidor: se dibuja en el navegador.
 *
 * DISEÑOS (para que el texto no tape el producto):
 *  - 'banda'  → la foto queda completa arriba y el texto va en una franja
 *               de color abajo. NADA tapa la foto. (recomendado)
 *  - 'abajo'  → texto encima de la foto, en la parte baja, con degradado.
 *  - 'arriba' → texto encima de la foto, en la parte alta.
 */

export type FormatoArte = 'cuadrado' | 'vertical' | 'horizontal';
export type DisenoTexto = 'banda' | 'abajo' | 'arriba' | 'centro' | 'lado-izq' | 'lado-der';

const MEDIDAS: Record<FormatoArte, { w: number; h: number }> = {
  cuadrado: { w: 1080, h: 1080 },
  vertical: { w: 1080, h: 1920 },
  horizontal: { w: 1920, h: 1080 },
};

/** Tipos de letra disponibles (todas existen en Windows, no hay que descargar nada). */
export const FUENTES = [
  { id: 'moderna', nombre: 'Moderna', familia: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', peso: '900' },
  { id: 'impacto', nombre: 'Impacto', familia: '"Arial Black", Impact, sans-serif', peso: '900' },
  { id: 'elegante', nombre: 'Elegante', familia: 'Georgia, "Times New Roman", serif', peso: '700' },
  { id: 'redonda', nombre: 'Redonda', familia: '"Trebuchet MS", "Segoe UI", sans-serif', peso: '800' },
  { id: 'maquina', nombre: 'Máquina', familia: '"Courier New", monospace', peso: '700' },
];

export function buscarFuente(id: string) {
  return FUENTES.find((f) => f.id === id) || FUENTES[0];
}

/** Paleta lista para elegir con un clic. */
export const COLORES_TEXTO = [
  { id: 'amarillo', nombre: 'Amarillo', valor: '#facc15' },
  { id: 'blanco',   nombre: 'Blanco',   valor: '#ffffff' },
  { id: 'rosa',     nombre: 'Rosa',     valor: '#f472b6' },
  { id: 'naranja',  nombre: 'Naranja',  valor: '#fb923c' },
  { id: 'verde',    nombre: 'Verde',    valor: '#4ade80' },
  { id: 'celeste',  nombre: 'Celeste',  valor: '#38bdf8' },
  { id: 'rojo',     nombre: 'Rojo',     valor: '#ef4444' },
  { id: 'negro',    nombre: 'Negro',    valor: '#111111' },
];

export interface OpcionesArte {
  imagen: string;
  titular: string;
  apoyo?: string;
  firma?: string;
  formato?: FormatoArte;
  /** Color del texto principal. Por defecto amarillo. */
  colorTexto?: string;
  /** Color del fondo de la franja (solo diseño 'banda'). */
  colorFondo?: string;
  diseno?: DisenoTexto;
  /** Tipo de letra. Por defecto 'moderna'. */
  fuente?: string;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la foto para el arte.'));
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

/** Devuelve la imagen terminada como data URL lista para ver o publicar. */
export async function generarArte(opts: OpcionesArte): Promise<string> {
  const formato = opts.formato || 'cuadrado';
  const diseno = opts.diseno || 'banda';
  const colorTexto = opts.colorTexto || '#facc15';
  const tipo = buscarFuente(opts.fuente || 'moderna');
  const colorFondo = opts.colorFondo || '#0f172a';
  const { w, h } = MEDIDAS[formato];

  const img = await cargarImagen(opts.imagen);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite generar el arte.');

  const margen = w * 0.075;
  const tamTitular = Math.round(w * (formato === 'horizontal' ? 0.055 : 0.072));
  const tamApoyo = Math.round(tamTitular * 0.45);
  const tamFirma = Math.round(w * 0.031);

  // Medir cuánto espacio necesita el texto
  ctx.font = `${tipo.peso} ${tamTitular}px ${tipo.familia}`;
  const anchoUtil = (diseno === 'lado-izq' || diseno === 'lado-der') ? w * 0.44 : w - margen * 2;
  const renglones = partirEnRenglones(ctx, opts.titular, anchoUtil).slice(0, 4);
  const altoRenglon = tamTitular * 1.18;

  ctx.font = `600 ${tamApoyo}px ${tipo.familia}`;
  const renglonesApoyo = opts.apoyo
    ? partirEnRenglones(ctx, opts.apoyo, anchoUtil).slice(0, 2)
    : [];

  const altoTexto =
    renglones.length * altoRenglon +
    (renglonesApoyo.length ? renglonesApoyo.length * tamApoyo * 1.35 + tamApoyo * 0.5 : 0) +
    (opts.firma ? tamFirma * 2 : 0) +
    margen * 1.4;

  // ---------- Fondo ----------
  if (diseno === 'banda') {
    // La foto ocupa la parte de arriba, COMPLETA, sin nada encima.
    const altoFoto = h - altoTexto;
    const escala = Math.max(w / img.width, altoFoto / img.height);
    const anchoDib = img.width * escala;
    const altoDib = img.height * escala;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, altoFoto);
    ctx.clip();
    ctx.drawImage(img, (w - anchoDib) / 2, (altoFoto - altoDib) / 2, anchoDib, altoDib);
    ctx.restore();

    // Franja de color abajo
    ctx.fillStyle = colorFondo;
    ctx.fillRect(0, altoFoto, w, altoTexto);
    // Filo de acento entre la foto y la franja
    ctx.fillStyle = colorTexto;
    ctx.fillRect(0, altoFoto, w, Math.max(4, w * 0.006));
  } else if (diseno === 'lado-izq' || diseno === 'lado-der') {
    // Panel a un costado: la mitad de la foto queda libre.
    const escala = Math.max(w / img.width, h / img.height);
    const anchoDib = img.width * escala;
    const altoDib = img.height * escala;
    ctx.drawImage(img, (w - anchoDib) / 2, (h - altoDib) / 2, anchoDib, altoDib);

    const izq = diseno === 'lado-izq';
    const anchoPanel = w * 0.52;
    const x0 = izq ? 0 : w - anchoPanel;
    const grad = ctx.createLinearGradient(izq ? 0 : w, 0, izq ? anchoPanel : w - anchoPanel, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, anchoPanel, h);
  } else if (diseno === 'centro') {
    const escala = Math.max(w / img.width, h / img.height);
    const anchoDib = img.width * escala;
    const altoDib = img.height * escala;
    ctx.drawImage(img, (w - anchoDib) / 2, (h - altoDib) / 2, anchoDib, altoDib);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, w, h);
  } else {
    // La foto llena todo y el texto va encima, con degradado para que se lea.
    const escala = Math.max(w / img.width, h / img.height);
    const anchoDib = img.width * escala;
    const altoDib = img.height * escala;
    ctx.drawImage(img, (w - anchoDib) / 2, (h - altoDib) / 2, anchoDib, altoDib);

    const arriba = diseno === 'arriba';
    const grad = arriba
      ? ctx.createLinearGradient(0, 0, 0, h * 0.55)
      : ctx.createLinearGradient(0, h * 0.42, 0, h);
    grad.addColorStop(arriba ? 0 : 0, arriba ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0)');
    grad.addColorStop(arriba ? 1 : 1, arriba ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, arriba ? 0 : h * 0.42, w, arriba ? h * 0.55 : h * 0.58);
  }

  // ---------- Texto ----------
  let y: number;
  if (diseno === 'arriba') {
    y = margen + tamTitular;
  } else if (diseno === 'centro') {
    y = h / 2 - ((renglones.length - 1) * altoRenglon) / 2;
  } else if (diseno === 'lado-izq' || diseno === 'lado-der') {
    y = h / 2 - ((renglones.length - 1) * altoRenglon) / 2;
  } else {
    y = h - altoTexto + margen * 0.9 + tamTitular;
  }

  // En los paneles laterales el texto arranca dentro del panel
  const xTexto = diseno === 'lado-der' ? w - w * 0.50 : margen;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${tipo.peso} ${tamTitular}px ${tipo.familia}`;
  ctx.fillStyle = colorTexto;
  if (diseno !== 'banda') {
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = Math.round(w * 0.016);
    ctx.shadowOffsetY = Math.round(w * 0.003);
  }
  renglones.forEach((linea, i) => ctx.fillText(linea, xTexto, y + i * altoRenglon));
  y += renglones.length * altoRenglon;

  if (renglonesApoyo.length) {
    ctx.font = `600 ${tamApoyo}px ${tipo.familia}`;
    ctx.fillStyle = diseno === 'banda' ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.92)';
    y += tamApoyo * 0.4;
    renglonesApoyo.forEach((linea, i) => ctx.fillText(linea, xTexto, y + i * tamApoyo * 1.35));
    y += renglonesApoyo.length * tamApoyo * 1.35;
  }

  if (opts.firma) {
    ctx.shadowBlur = diseno === 'banda' ? 0 : Math.round(w * 0.01);
    ctx.font = `700 ${tamFirma}px ${tipo.familia}`;
    ctx.fillStyle = colorTexto;
    ctx.globalAlpha = 0.85;
    ctx.fillText(opts.firma, margen, Math.min(y + tamFirma * 1.6, h - margen * 0.5));
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Descarga un arte generado. */
export function descargarArte(dataUrl: string, nombreBase = 'dulce-placer-arte') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${nombreBase}-${new Date().toISOString().slice(0, 10)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
