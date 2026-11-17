/**
 * Proxy same-origin de frames de cámara (Bitácora Visual / ODYSSEUS).
 *
 * Continúa el trabajo 2026-10-20: el navegador NO deja grabar imágenes de otro
 * origen (lienzo contaminado). Las cámaras llegan por Tailscale
 * (https://*.ts.net/.../stream.mjpeg) → este endpoint las trae al mismo origen
 * que la app en Vercel y devuelve un JPEG limpio.
 *
 * 2026-10-21: si frame.jpeg falla (go2rtc saturado al grabar 4 cámaras),
 * extrae 1 JPEG del stream MJPEG.
 *
 * Seguridad: solo hosts permitidos (Tailscale Funnel, LAN, localhost).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs', maxDuration: 15 };

function hostPermitido(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
  if (h.endsWith('.ts.net')) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return true;
  return false;
}

function aUrlFrame(destino: URL): URL {
  const path = destino.pathname;
  if (path.includes('stream.mjpeg')) {
    destino.pathname = path.replace('stream.mjpeg', 'frame.jpeg');
  } else if (path.endsWith('.mjpeg')) {
    destino.pathname = path.replace(/\.mjpeg$/i, '.jpeg');
  }
  return destino;
}

async function jpegDesdeMjpeg(
  mjpegUrl: string,
  headers: Record<string, string>
): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(mjpegUrl, { headers, signal: ctrl.signal });
    if (!r.ok || !r.body) return null;
    const reader = r.body.getReader();
    const partes: Uint8Array[] = [];
    let total = 0;
    while (total < 2_500_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      partes.push(value);
      total += value.length;
      const buf = Buffer.concat(partes.map((p) => Buffer.from(p)));
      const ini = buf.indexOf(Buffer.from([0xff, 0xd8]));
      if (ini < 0) continue;
      const fin = buf.indexOf(Buffer.from([0xff, 0xd9]), ini + 2);
      if (fin >= 0) {
        await reader.cancel().catch(() => undefined);
        return buf.subarray(ini, fin + 2);
      }
    }
    await reader.cancel().catch(() => undefined);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET' });
  }

  const raw = typeof req.query.u === 'string' ? req.query.u : '';
  if (!raw) {
    return res.status(400).json({ error: 'Falta parámetro u (URL de la cámara)' });
  }

  let destino: URL;
  try {
    destino = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
  }

  if (!['http:', 'https:'].includes(destino.protocol) || !hostPermitido(destino.hostname)) {
    return res.status(400).json({
      error: 'Solo cámaras Tailscale (.ts.net), red local o localhost',
    });
  }

  const authUser = destino.username ? decodeURIComponent(destino.username) : '';
  const authPass = destino.password ? decodeURIComponent(destino.password) : '';
  destino.username = '';
  destino.password = '';

  const headers: Record<string, string> = { Accept: 'image/jpeg,image/*,*/*' };
  if (authUser) {
    headers.Authorization = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString('base64')}`;
  }

  const urlOriginal = destino.toString();
  const esMjpeg =
    destino.pathname.includes('stream.mjpeg') || destino.pathname.endsWith('.mjpeg');
  const urlFrame = aUrlFrame(new URL(urlOriginal)).toString();

  try {
    let jpeg: Buffer | null = null;
    let ultimoStatus = 0;
    let ultimoDetalle = '';

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const r = await fetch(urlFrame, {
        headers: { ...headers, 'User-Agent': 'DulcePlacer-Bitacora/1.0' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      ultimoStatus = r.status;
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 32 && buf[0] === 0xff && buf[1] === 0xd8) jpeg = buf;
        else ultimoDetalle = `respuesta ${buf.length} bytes (no es JPEG)`;
      } else {
        ultimoDetalle = `HTTP ${r.status}`;
      }
    } catch (e) {
      ultimoDetalle = e instanceof Error ? e.message : 'fetch falló';
    }

    if (!jpeg && esMjpeg) {
      jpeg = await jpegDesdeMjpeg(urlOriginal, {
        ...headers,
        'User-Agent': 'DulcePlacer-Bitacora/1.0',
      });
    }

    if (!jpeg) {
      // 566 = Tailscale Funnel no puede llegar al PC (típico si Funnel está mal o el nodo offline).
      const hint =
        ultimoStatus === 566 || /566/.test(ultimoDetalle)
          ? ' Tailscale Funnel no alcanza el PC desde internet (código 566). Enciende Funnel/go2rtc en el PC del local, o graba desde la app LOCAL (los clips igual van a la nube).'
          : ' ¿go2rtc y Tailscale Funnel encendidos en el PC del local?';
      return res.status(502).json({
        error: `Sin frame de cámara.${hint}`,
        statusCamara: ultimoStatus || undefined,
        detalle: ultimoDetalle || undefined,
      });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(jpeg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fallo de red';
    return res.status(502).json({
      error: `No se pudo alcanzar la cámara (${msg}). ¿Tailscale Funnel / go2rtc encendidos?`,
    });
  }
}
