/**
 * PUBLICACIÓN DIRECTA A REDES — Dulce Placer
 * Creado 2026-09-19. Ampliado 2026-09-20.
 *
 * Publica una foto con su texto en la página de Facebook y en la cuenta de
 * Instagram del negocio, SIN pasar por N8N.
 *
 * Por qué se hizo así: N8N corre en el PC de Gonzalo (localhost). Desde el
 * celular de la vendedora "localhost" es su propio teléfono, no el PC, y el
 * navegador además bloquea esa conexión por seguridad. Con esta función la app
 * publica sola desde cualquier dispositivo, sin depender de que haya un
 * computador prendido.
 *
 * CAMBIOS DEL 2026-09-20 (Instagram fallaba con "Media ID is not available"):
 *  1. Cada resultado trae el ENLACE del post, para poder abrirlo y comprobar
 *     que sí quedó publicado — y para poder compartirlo en el perfil personal
 *     (Facebook NO permite publicar en perfiles personales desde 2018, solo
 *     en páginas; compartir es la única vía y la confirma una persona).
 *  2. Los errores de Instagram dicen EN QUÉ PASO fallaron. Antes llegaba el
 *     mensaje pelado de Facebook y no se sabía si era al hospedar la foto, al
 *     pedir el enlace, al crear el contenedor o al publicar.
 *  3. Se espera y se consulta el ESTADO REAL del contenedor de Instagram antes
 *     de publicarlo. Instagram tiene que descargar la imagen desde internet y
 *     eso tarda; publicar a ciegas es lo que producía "Media ID is not available".
 *  4. Cuando se publica en las dos redes, Instagram reusa la foto que Facebook
 *     ACABA de publicar (esa sí tiene enlace público) en vez de subir una
 *     segunda copia oculta, que era la sospecha principal del fallo.
 *
 * Variables de entorno necesarias (en Vercel):
 *   FB_PAGE_ID      — ID de la página de Facebook
 *   FB_PAGE_TOKEN   — token permanente de esa página
 *   IG_USER_ID      — ID de la cuenta de Instagram de empresa vinculada
 */

export const config = { runtime: 'edge' };

const GRAPH = 'https://graph.facebook.com/v21.0';

type Red = 'FACEBOOK' | 'INSTAGRAM' | 'AMBAS';

interface Resultado {
  red: string;
  ok: boolean;
  id?: string;
  /** Enlace para abrir la publicación y comprobar que quedó. */
  enlace?: string;
  error?: string;
}

/** Envuelve un paso para que, si falla, el error diga cuál fue. */
async function paso<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    throw new Error(`[${nombre}] ${e?.message || 'error desconocido'}`);
  }
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Convierte una imagen en data URL a bytes para subirla. */
function dataUrlABlob(dataUrl: string): { blob: Blob; nombre: string } {
  const coincide = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  const tipo = coincide ? coincide[1] : 'image/jpeg';
  const base64 = coincide ? coincide[2] : dataUrl;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  const ext = tipo.includes('png') ? 'png' : 'jpg';
  return { blob: new Blob([bytes], { type: tipo }), nombre: `foto.${ext}` };
}

/** Sube la foto a Facebook. published=false la deja oculta, solo para hospedarla. */
async function subirFotoAFacebook(
  pageId: string, token: string, blob: Blob, nombre: string,
  caption: string | undefined, publicar: boolean
): Promise<{ id: string; postId?: string }> {
  const form = new FormData();
  form.append('source', blob, nombre);
  form.append('published', publicar ? 'true' : 'false');
  form.append('access_token', token);
  if (publicar && caption) form.append('message', caption);

  const res = await fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Facebook respondió ${res.status}`);
  }
  return { id: json.id, postId: json.post_id };
}

/** Arma el enlace para abrir la publicación de Facebook. */
function enlaceFacebook(postId?: string, fotoId?: string): string | undefined {
  if (postId) return `https://www.facebook.com/${postId}`;
  if (fotoId) return `https://www.facebook.com/photo/?fbid=${fotoId}`;
  return undefined;
}

/** Pide a Facebook el enlace público de una foto ya subida (lo necesita Instagram). */
async function obtenerUrlPublica(fotoId: string, token: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${fotoId}?fields=images&access_token=${token}`);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || 'No se pudo obtener el enlace de la foto');
  }
  const url = json?.images?.[0]?.source;
  if (!url) throw new Error('Facebook no devolvió un enlace utilizable de la foto');
  return url;
}

/**
 * Espera a que Instagram TERMINE de descargar y preparar la imagen.
 * Sin esto se publicaba a ciegas y salía "Media ID is not available".
 * Cuando falla, Instagram explica el motivo en `status` — se devuelve tal cual.
 */
async function esperarContenedor(creationId: string, token: string): Promise<void> {
  for (let intento = 0; intento < 12; intento++) {
    const res = await fetch(`${GRAPH}/${creationId}?fields=status_code,status&access_token=${token}`);
    const json = await res.json();
    if (json?.error) throw new Error(json.error.message || 'No se pudo consultar el estado');

    const estado = json?.status_code;
    if (estado === 'FINISHED') return;
    if (estado === 'ERROR' || estado === 'EXPIRED') {
      throw new Error(
        `Instagram no pudo preparar la imagen (${estado}). Dice: ${json?.status || 'sin detalle'}`
      );
    }
    await esperar(1500);
  }
  throw new Error('Instagram se demoró más de 18 segundos preparando la imagen y no terminó.');
}

/** Enlace público de la publicación de Instagram. Si no lo da, no es un error. */
async function permalinkInstagram(mediaId: string, token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${token}`);
    const json = await res.json();
    return json?.permalink || undefined;
  } catch {
    return undefined;
  }
}

/** Publica en Instagram: se crea el contenedor, se espera y luego se publica. */
async function publicarEnInstagram(
  igUserId: string, token: string, imageUrl: string, caption: string
): Promise<{ id: string; enlace?: string }> {
  const creado = await paso('Instagram: crear el contenedor', async () => {
    const r = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j?.error?.message || `respondió ${r.status}`);
    if (!j.id) throw new Error('Instagram no devolvió el identificador del contenedor');
    return j as { id: string };
  });

  await paso('Instagram: preparar la imagen', () => esperarContenedor(creado.id, token));

  const publicado = await paso('Instagram: publicar', async () => {
    const r = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creado.id, access_token: token }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j?.error?.message || `respondió ${r.status}`);
    return j as { id: string };
  });

  const enlace = await permalinkInstagram(publicado.id, token);
  return { id: publicado.id, enlace };
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const PAGE_ID = process.env.FB_PAGE_ID;
  const TOKEN = process.env.FB_PAGE_TOKEN;
  const IG_ID = process.env.IG_USER_ID;

  if (!PAGE_ID || !TOKEN) {
    return new Response(JSON.stringify({
      error: 'Faltan las credenciales de Facebook (FB_PAGE_ID / FB_PAGE_TOKEN) en el servidor.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let cuerpo: { red?: Red; texto?: string; imagen?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la petición inválido.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const red: Red = cuerpo.red || 'AMBAS';
  const texto = (cuerpo.texto || '').trim();
  const imagen = cuerpo.imagen;

  if (!imagen) {
    return new Response(JSON.stringify({ error: 'Hace falta la foto para publicar.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const resultados: Resultado[] = [];
  const { blob, nombre } = dataUrlABlob(imagen);

  /** Si Facebook publica primero, Instagram reusa ESA foto (ya es pública). */
  let idFotoPublicada: string | undefined;

  // --- FACEBOOK ---
  if (red === 'FACEBOOK' || red === 'AMBAS') {
    try {
      const { id, postId } = await subirFotoAFacebook(PAGE_ID, TOKEN, blob, nombre, texto, true);
      idFotoPublicada = id;
      resultados.push({ red: 'FACEBOOK', ok: true, id, enlace: enlaceFacebook(postId, id) });
    } catch (e: any) {
      resultados.push({ red: 'FACEBOOK', ok: false, error: e?.message || 'Error desconocido' });
    }
  }

  // --- INSTAGRAM ---
  if (red === 'INSTAGRAM' || red === 'AMBAS') {
    if (!IG_ID) {
      resultados.push({ red: 'INSTAGRAM', ok: false, error: 'Falta IG_USER_ID en el servidor.' });
    } else {
      try {
        // Instagram exige un enlace público de la imagen. Si Facebook ya la
        // publicó en esta misma petición, se reusa esa foto. Si no, se sube
        // una copia oculta a la página solo para hospedarla.
        let idHospedaje = idFotoPublicada;
        if (!idHospedaje) {
          const hospedada = await paso('Instagram: hospedar la foto en Facebook', () =>
            subirFotoAFacebook(PAGE_ID, TOKEN, blob, nombre, undefined, false)
          );
          idHospedaje = hospedada.id;
        }

        const urlPublica = await paso('Instagram: conseguir el enlace de la foto', () =>
          obtenerUrlPublica(idHospedaje as string, TOKEN)
        );

        const post = await publicarEnInstagram(IG_ID, TOKEN, urlPublica, texto);
        resultados.push({ red: 'INSTAGRAM', ok: true, id: post.id, enlace: post.enlace });
      } catch (e: any) {
        resultados.push({ red: 'INSTAGRAM', ok: false, error: e?.message || 'Error desconocido' });
      }
    }
  }

  const algunoOk = resultados.some(r => r.ok);
  return new Response(JSON.stringify({ ok: algunoOk, resultados }), {
    status: algunoOk ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
