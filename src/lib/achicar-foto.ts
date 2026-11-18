/**
 * Achica una foto antes de guardarla (2026-11-16).
 * Una foto de celular en base64 pesaba hasta 4 MB y cada aparato la bajaba y subía
 * en cada sincronización: la nube se saturaba y los consumos no llegaban a otros equipos.
 * Resultado: JPEG de máximo 1000 px por lado (~100–200 KB).
 */

export const LADO_MAXIMO_FOTO = 1000;
export const CALIDAD_FOTO = 0.7;

/** Tamaño final manteniendo la proporción; nunca agranda. */
export const medidasAchicadas = (ancho: number, alto: number, max = LADO_MAXIMO_FOTO): { ancho: number; alto: number } => {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 0, alto: 0 };
  const escala = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
};

const leerComoDataURL = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const achicarFoto = async (file: Blob): Promise<string> => {
  const original = await leerComoDataURL(file);
  if (typeof document === 'undefined') return original;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('imagen inválida'));
      i.src = original;
    });
    const { ancho, alto } = medidasAchicadas(img.naturalWidth, img.naturalHeight);
    if (!ancho || !alto) return original;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, ancho, alto);
    const chica = canvas.toDataURL('image/jpeg', CALIDAD_FOTO);
    return chica.length < original.length ? chica : original;
  } catch {
    return original;
  }
};
