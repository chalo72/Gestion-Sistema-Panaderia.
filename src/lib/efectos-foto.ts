/**
 * EFECTOS DE FOTO — Dulce Placer
 * Creado 2026-09-20. Tomados del diseño Studio 360 que trajo Gonzalo.
 *
 * IMPORTANTE: el efecto no es solo una vista bonita en pantalla. Al publicar,
 * el filtro se "quema" dentro de la imagen con canvas, así que la foto que
 * llega a Facebook e Instagram sale realmente con el efecto aplicado.
 * (Si solo se pusiera el filtro por CSS, se vería aquí pero se publicaría la
 * foto original — eso sería engañar al usuario.)
 */

export interface EfectoFoto {
  id: string;
  nombre: string;
  /** Filtro en sintaxis CSS. Sirve igual para la vista previa y para el canvas. */
  filtro: string;
}

export const EFECTOS: EfectoFoto[] = [
  { id: 'ninguno', nombre: 'Original', filtro: 'none' },
  { id: 'dorado', nombre: 'Dorado', filtro: 'contrast(1.15) saturate(1.35) sepia(0.22) brightness(1.04)' },
  { id: 'calido', nombre: 'Cálido', filtro: 'brightness(1.08) contrast(1.1) saturate(1.15)' },
  { id: 'vintage', nombre: 'Vintage', filtro: 'sepia(0.4) contrast(0.95) brightness(0.95)' },
  { id: 'duotono', nombre: 'Duotono', filtro: 'contrast(1.3) saturate(1.5) brightness(0.95) sepia(0.45)' },
  { id: 'retro', nombre: 'Retro', filtro: 'contrast(1.2) saturate(0.85) sepia(0.35) hue-rotate(-20deg)' },
  { id: 'vivido', nombre: 'Vívido', filtro: 'saturate(1.6) contrast(1.2)' },
  { id: 'suave', nombre: 'Suave', filtro: 'brightness(1.1) contrast(0.95) saturate(0.95)' },
  { id: 'byn', nombre: 'Blanco y negro', filtro: 'grayscale(1) contrast(1.1)' },
  // --- Agregados 2026-09-20 a pedido de Gonzalo ---
  { id: 'cine', nombre: 'Cine', filtro: 'contrast(1.25) saturate(1.1) hue-rotate(-8deg) brightness(0.98)' },
  { id: 'miel', nombre: 'Miel', filtro: 'sepia(0.3) saturate(1.45) brightness(1.06) contrast(1.05)' },
  { id: 'chocolate', nombre: 'Chocolate', filtro: 'sepia(0.55) saturate(1.2) contrast(1.15) brightness(0.94)' },
  { id: 'fresa', nombre: 'Fresa', filtro: 'saturate(1.5) hue-rotate(-12deg) contrast(1.1) brightness(1.04)' },
  { id: 'pastel', nombre: 'Pastel', filtro: 'saturate(0.8) brightness(1.14) contrast(0.9)' },
  { id: 'fuerte', nombre: 'Alto contraste', filtro: 'contrast(1.45) saturate(1.25)' },
  { id: 'pelicula', nombre: 'Película', filtro: 'sepia(0.18) contrast(1.12) saturate(0.92) brightness(1.02)' },
  { id: 'horno', nombre: 'Luz de horno', filtro: 'sepia(0.3) saturate(1.5) brightness(1.12) contrast(1.08) hue-rotate(-6deg)' },
  { id: 'neon', nombre: 'Neón', filtro: 'saturate(2) contrast(1.3) hue-rotate(10deg) brightness(1.05)' },
  { id: 'frio', nombre: 'Frío', filtro: 'hue-rotate(12deg) saturate(1.1) brightness(1.03) contrast(1.08)' },
];

export function buscarEfecto(id: string): EfectoFoto {
  return EFECTOS.find((e) => e.id === id) || EFECTOS[0];
}

/**
 * Aplica el efecto DE VERDAD sobre la imagen y devuelve una foto nueva.
 * Si el efecto es "ninguno", devuelve la misma imagen sin tocarla.
 */
export async function aplicarEfecto(dataUrl: string, idEfecto: string): Promise<string> {
  const efecto = buscarEfecto(idEfecto);
  if (!efecto.filtro || efecto.filtro === 'none') return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        // Aquí es donde el efecto queda grabado en los píxeles.
        ctx.filter = efecto.filtro;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Hashtags locales que casi siempre aplican, para agregar con un clic. */
export const HASHTAGS_SUGERIDOS = [
  '#DulcePlacer', '#PanArtesanal', '#HechoConAmor', '#ReciénHorneado',
  '#Panadería', '#Repostería', '#AntojoDelDía', '#SaborCasero',
  '#DesayunoPerfecto', '#PostresArtesanales',
];

/** Junta el texto con los hashtags, sin repetir los que ya estén escritos. */
export function unirTextoYHashtags(texto: string, hashtags: string[]): string {
  const limpio = texto.trim();
  const nuevos = hashtags
    .map((h) => h.trim())
    .filter((h) => h && !limpio.toLowerCase().includes(h.toLowerCase()));
  if (nuevos.length === 0) return limpio;
  return `${limpio}\n\n${nuevos.join(' ')}`;
}
