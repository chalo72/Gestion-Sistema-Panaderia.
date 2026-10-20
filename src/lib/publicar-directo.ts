/**
 * PUBLICACIÓN DIRECTA (lado de la app) — Dulce Placer
 * Creado 2026-09-19.
 *
 * Manda la foto y el texto a /api/publicar, que publica en Facebook e Instagram
 * sin pasar por N8N. Funciona desde cualquier celular, sin PC prendido.
 */

export type RedDirecta = 'FACEBOOK' | 'INSTAGRAM' | 'AMBAS';

export interface ResultadoRed {
  red: string;
  ok: boolean;
  id?: string;
  /** Enlace para abrir la publicación y comprobar que quedó. */
  enlace?: string;
  error?: string;
}

/**
 * Achica la foto antes de mandarla. Necesario porque el servidor no acepta
 * peticiones de más de ~4.5 MB y una foto de celular puede pesar más.
 */
export async function achicarImagen(dataUrl: string, ladoMax = 1440, calidad = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
      if (escala >= 1 && dataUrl.length < 3_000_000) { resolve(dataUrl); return; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function publicarDirecto(params: {
  red: RedDirecta;
  texto: string;
  imagen: string;
}): Promise<{ ok: boolean; resultados: ResultadoRed[] }> {
  const imagenLista = await achicarImagen(params.imagen);

  const res = await fetch('/api/publicar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ red: params.red, texto: params.texto, imagen: imagenLista }),
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* respuesta no JSON */ }

  if (!json) {
    return { ok: false, resultados: [{ red: params.red, ok: false, error: `El servidor respondió ${res.status}` }] };
  }
  if (json.error) {
    return { ok: false, resultados: [{ red: params.red, ok: false, error: json.error }] };
  }
  return { ok: !!json.ok, resultados: json.resultados || [] };
}
