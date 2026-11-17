/**
 * CONFIGURACIÓN PARA TRABAJAR EN EL PC — Dulce Placer
 * Creada 2026-09-19.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * 1) `vercel dev` no sirve en este proyecto: vercel.json tiene la regla
 *    { "source": "/(.*)", "destination": "/index.html" }, correcta en producción
 *    (hace funcionar las rutas de la app) pero que en desarrollo se traga TODO
 *    —hasta los archivos internos de Vite— y devuelve error 500.
 *
 * 2) `vite.config.ts` trae un plugin de desarrollo ("vite-api-agente") que
 *    intenta ejecutar la IA dentro del PC. En este equipo falla y devuelve
 *    "No hay proveedores de IA disponibles". Aquí ese plugin se desactiva y las
 *    llamadas a /api se reenvían al sitio publicado, que sí tiene las llaves y
 *    está verificado funcionando.
 *
 * No se modifica vercel.json ni vite.config.ts (ambos protegidos).
 *
 * RESULTADO: la app corre en tu PC —así puede hablarle a N8N en localhost sin
 * que el navegador bloquee nada— y la IA y la publicación directa siguen
 * funcionando contra el servidor publicado.
 *
 * CÓMO SE USA:
 *     npx vite --config vite.config.local.ts
 */
import { defineConfig, mergeConfig, type Plugin, type UserConfig, type UserConfigFnObject } from 'vite';
import { readFileSync, existsSync, unlinkSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import configuracionBase from './vite.config';

const API_REMOTA = 'https://app-eight-sigma-13.vercel.app';
const execFileAsync = promisify(execFile);
/** Colombia (panadería): ISAPI search con offset local, no UTC puro. */
const TZ_DVR = '-05:00';

/** Lee host/usuario/clave del DVR desde go2rtc.yaml (sin exponerlos al navegador). */
function credencialesDvrDesdeGo2rtc(): { host: string; user: string; pass: string } | null {
  try {
    const yamlPath = join(__dirname, 'herramientas', 'puente-cctv', 'go2rtc.yaml');
    if (!existsSync(yamlPath)) return null;
    const txt = readFileSync(yamlPath, 'utf8');
    const m = txt.match(/rtsp:\/\/([^:\/\s]+):([^@\/\s]+)@([0-9.]+)/);
    if (!m) return null;
    return { user: decodeURIComponent(m[1]), pass: decodeURIComponent(m[2]), host: m[3] };
  } catch {
    return null;
  }
}

async function curlDigest(
  url: string,
  user: string,
  pass: string,
  bodyXml?: string
): Promise<{ code: number; body: string }> {
  const args = ['-sS', '-m', '25', '--digest', '-u', `${user}:${pass}`, '-w', '\n__HTTP__%{http_code}'];
  if (bodyXml) {
    args.push('-H', 'Content-Type: application/xml', '-d', bodyXml);
  }
  args.push(url);
  const { stdout } = await execFileAsync('curl.exe', args, { maxBuffer: 8 * 1024 * 1024 });
  const idx = stdout.lastIndexOf('\n__HTTP__');
  if (idx < 0) return { code: 0, body: stdout };
  const body = stdout.slice(0, idx);
  const code = Number(stdout.slice(idx + '\n__HTTP__'.length).trim()) || 0;
  return { code, body };
}

/** JPEG binario con digest (no pasar por string UTF-8). */
async function curlDigestJpeg(
  url: string,
  user: string,
  pass: string
): Promise<{ code: number; jpeg: Buffer | null }> {
  const dir = mkdtempSync(join(tmpdir(), 'dp-dvr-'));
  const out = join(dir, 'frame.jpg');
  try {
    const { stdout } = await execFileAsync(
      'curl.exe',
      ['-sS', '-m', '20', '--digest', '-u', `${user}:${pass}`, '-o', out, '-w', '%{http_code}', url],
      { maxBuffer: 256 * 1024 }
    );
    const code = Number(String(stdout).trim()) || 0;
    if (code !== 200 || !existsSync(out)) return { code, jpeg: null };
    const jpeg = readFileSync(out);
    if (jpeg.length < 32 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return { code, jpeg: null };
    return { code, jpeg };
  } finally {
    try {
      unlinkSync(out);
    } catch {
      /* ok */
    }
  }
}

/** Frame histórico RTSP (Hikvision tracks + starttime). Requiere ffmpeg en el PATH. */
async function frameRtspHistorico(
  host: string,
  user: string,
  pass: string,
  trackId: string,
  cuandoIso: string
): Promise<Buffer | null> {
  const t = new Date(cuandoIso);
  if (Number.isNaN(t.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`;
  const fin = new Date(t.getTime() + 8_000);
  const stampFin =
    `${fin.getUTCFullYear()}${pad(fin.getUTCMonth() + 1)}${pad(fin.getUTCDate())}` +
    `T${pad(fin.getUTCHours())}${pad(fin.getUTCMinutes())}${pad(fin.getUTCSeconds())}Z`;
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`;
  const rtsp =
    `rtsp://${auth}@${host}:554/Streaming/tracks/${trackId}` +
    `?starttime=${stamp}&endtime=${stampFin}`;
  const dir = mkdtempSync(join(tmpdir(), 'dp-dvr-ff-'));
  const out = join(dir, 'frame.jpg');
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-rtsp_transport',
        'tcp',
        '-y',
        '-i',
        rtsp,
        '-frames:v',
        '1',
        '-q:v',
        '5',
        out,
      ],
      { timeout: 28_000, maxBuffer: 2 * 1024 * 1024 }
    );
    if (!existsSync(out)) return null;
    const jpeg = readFileSync(out);
    if (jpeg.length < 32 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
    return jpeg;
  } catch {
    return null;
  } finally {
    try {
      unlinkSync(out);
    } catch {
      /* ok */
    }
  }
}

/**
 * 2026-10-21 (AUTORIZO Gonzalo) — Puente ISAPI del DVR Hikvision: /__dvr?op=info|search|picture|frame
 * Digest auth vía curl.exe; credenciales solo en go2rtc.yaml del PC.
 * 2026-10-21: picture/frame para escaneo forense (cámara 1–4).
 */
function puenteDvr(): Plugin {
  return {
    name: 'dp-puente-dvr',
    configureServer(server) {
      server.middlewares.use('/__dvr', async (req, res) => {
        try {
          const cred = credencialesDvrDesdeGo2rtc();
          if (!cred) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'No leí usuario/clave del DVR en go2rtc.yaml' }));
            return;
          }
          const u = new URL(req.url || '', 'http://local');
          const op = u.searchParams.get('op') || 'info';
          const base = `http://${cred.host}`;

          if (op === 'info') {
            const { code, body } = await curlDigest(`${base}/ISAPI/System/deviceInfo`, cred.user, cred.pass);
            if (code !== 200) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `DVR respondió HTTP ${code}` }));
              return;
            }
            const modelo = body.match(/<model>([^<]*)<\/model>/i)?.[1];
            const serial = body.match(/<serialNumber>([^<]*)<\/serialNumber>/i)?.[1];
            const firmware = body.match(/<firmwareVersion>([^<]*)<\/firmwareVersion>/i)?.[1];
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, modelo, serial, firmware }));
            return;
          }

          if (op === 'picture') {
            const track = (u.searchParams.get('track') || '101').replace(/\D/g, '') || '101';
            const canal = String(Math.floor(Number(track) / 100) || 1);
            const urlPic = `${base}/ISAPI/Streaming/channels/${canal}01/picture`;
            const { code, jpeg } = await curlDigestJpeg(urlPic, cred.user, cred.pass);
            if (!jpeg) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `Sin foto cámara ${canal} (HTTP ${code})` }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-DP-Fuente', 'live');
            res.end(jpeg);
            return;
          }

          if (op === 'frame') {
            const track = (u.searchParams.get('track') || '101').replace(/\D/g, '') || '101';
            const cuando = u.searchParams.get('cuando') || '';
            let jpeg: Buffer | null = null;
            let fuente = 'live';
            if (cuando) {
              jpeg = await frameRtspHistorico(cred.host, cred.user, cred.pass, track, cuando);
              if (jpeg) fuente = 'playback';
            }
            if (!jpeg) {
              const canal = String(Math.floor(Number(track) / 100) || 1);
              const urlPic = `${base}/ISAPI/Streaming/channels/${canal}01/picture`;
              const r = await curlDigestJpeg(urlPic, cred.user, cred.pass);
              jpeg = r.jpeg;
              fuente = 'live-fallback';
            }
            if (!jpeg) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `Sin frame track ${track}` }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-DP-Fuente', fuente);
            res.end(jpeg);
            return;
          }

          if (op === 'search') {
            const desde = u.searchParams.get('desde') || '';
            const hasta = u.searchParams.get('hasta') || '';
            const tracks = (u.searchParams.get('tracks') || '101,201,301,401').split(',').map((t) => t.trim()).filter(Boolean);
            const max = Math.min(80, Math.max(5, Number(u.searchParams.get('max') || 40)));
            if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Fechas inválidas' }));
              return;
            }
            const segmentos: Array<{
              trackId: string;
              inicio: string;
              fin: string;
              playbackUri: string;
              codec?: string;
            }> = [];
            let hayMas = false;
            let total = 0;
            const erroresPista: string[] = [];

            for (const trackID of tracks) {
              const searchID = randomUUID();
              const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription>
  <searchID>${searchID}</searchID>
  <trackList><trackID>${trackID}</trackID></trackList>
  <timeSpanList>
    <timeSpan>
      <startTime>${desde}T00:00:00${TZ_DVR}</startTime>
      <endTime>${hasta}T23:59:59${TZ_DVR}</endTime>
    </timeSpan>
  </timeSpanList>
  <maxResults>${max}</maxResults>
  <searchResultPostion>0</searchResultPostion>
  <metadataList><metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor></metadataList>
</CMSearchDescription>`;
              const { code, body } = await curlDigest(
                `${base}/ISAPI/ContentMgmt/search`,
                cred.user,
                cred.pass,
                xml
              );
              if (code !== 200) {
                erroresPista.push(`${trackID}:HTTP${code}`);
                continue;
              }
              const num = Number(body.match(/<numOfMatches>(\d+)<\/numOfMatches>/i)?.[1] || 0);
              total += num;
              if (/<responseStatusStrg>MORE<\/responseStatusStrg>/i.test(body)) hayMas = true;
              const items = body.split(/<searchMatchItem>/i).slice(1);
              for (const item of items) {
                const inicio = item.match(/<startTime>([^<]+)<\/startTime>/i)?.[1] || '';
                const fin = item.match(/<endTime>([^<]+)<\/endTime>/i)?.[1] || '';
                const playbackUri = (item.match(/<playbackURI>([^<]+)<\/playbackURI>/i)?.[1] || '')
                  .replace(/&amp;/g, '&');
                const codec = item.match(/<codecType>([^<]+)<\/codecType>/i)?.[1];
                const tid = item.match(/<trackID>([^<]+)<\/trackID>/i)?.[1] || trackID;
                if (inicio && playbackUri) {
                  segmentos.push({ trackId: tid, inicio, fin, playbackUri, codec });
                }
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                total,
                hayMas,
                segmentos,
                erroresPista: erroresPista.length ? erroresPista : undefined,
              })
            );
            return;
          }

          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'op inválida (info|search|picture|frame)' }));
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : 'Error puente DVR',
            })
          );
        }
      });
    },
  };
}

/**
 * 2026-10-09 (AUTORIZO Gonzalo) — Puente de cámaras: /__camara?u=http://192.168.x.x/...
 * El navegador no deja GRABAR imágenes de otro origen; pidiéndolas por aquí quedan "del mismo sitio"
 * y la Bitácora Visual sí puede hacer los micro-videos. Solo acepta IPs de la red del local
 * (no es un proxy abierto). Usuario:clave en la URL se envía como autenticación básica.
 * Ojo: cámaras que solo aceptan autenticación "digest" (algunas Hikvision) pueden responder 401.
 *
 * 2026-10-21: localhost + Tailscale (.ts.net). Si frame.jpeg falla (go2rtc saturado),
 * saca 1 JPEG del MJPEG. En Vercel: api/camara.ts.
 */
function puenteCamaras(): Plugin {
  const hostOk = (h: string) =>
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.ts.net') ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);

  const jpegDesdeMjpeg = async (mjpegUrl: string, headers: Record<string, string>): Promise<Buffer | null> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
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
  };

  return {
    name: 'dp-puente-camaras',
    configureServer(server) {
      server.middlewares.use('/__camara', async (req, res) => {
        try {
          const u = new URL(req.url || '', 'http://local').searchParams.get('u') || '';
          const destino = new URL(u);
          const httpsTs = destino.protocol === 'https:' && destino.hostname.toLowerCase().endsWith('.ts.net');
          const httpLan = destino.protocol === 'http:' && hostOk(destino.hostname);
          if (!httpsTs && !httpLan) {
            res.statusCode = 400; res.end('Solo red local, localhost o Tailscale (.ts.net)'); return;
          }
          const authUser = destino.username ? decodeURIComponent(destino.username) : '';
          const authPass = destino.password ? decodeURIComponent(destino.password) : '';
          destino.username = '';
          destino.password = '';
          const headers: Record<string, string> = { Accept: 'image/jpeg,image/*,*/*' };
          if (authUser) {
            headers.Authorization = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString('base64')}`;
          }

          const esMjpeg = destino.pathname.includes('stream.mjpeg') || destino.pathname.endsWith('.mjpeg');
          const urlFrame = new URL(destino.toString());
          if (urlFrame.pathname.includes('stream.mjpeg')) {
            urlFrame.pathname = urlFrame.pathname.replace('stream.mjpeg', 'frame.jpeg');
          }

          let jpeg: Buffer | null = null;
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 6000);
            const r = await fetch(urlFrame.toString(), { headers, signal: ctrl.signal });
            clearTimeout(t);
            if (r.ok) {
              const buf = Buffer.from(await r.arrayBuffer());
              if (buf.length > 32 && buf[0] === 0xff && buf[1] === 0xd8) jpeg = buf;
            }
          } catch {
            /* frame.jpeg ocupado: se intenta MJPEG abajo */
          }

          if (!jpeg && esMjpeg) {
            jpeg = await jpegDesdeMjpeg(destino.toString(), headers);
          }

          if (!jpeg) {
            res.statusCode = 502;
            res.end('Sin frame de cámara (go2rtc ocupado o caído)');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'no-store');
          res.end(jpeg);
        } catch {
          res.statusCode = 400; res.end('URL inválida');
        }
      });
    },
  };
}
/**
 * Copia local de hallazgos forenses a D:\DulcePlacerEvidencia
 * (la carpeta que ya usaban: sin_asignar/fecha/ + indice.jsonl).
 * Solo existe en la app local. La nube no puede escribir en D:.
 */
function puenteEvidenciaDisco(): Plugin {
  const CARPETAS: Record<string, string> = {
    evidencia: 'D:\\DulcePlacerEvidencia',
    prueba: 'D:\\DulcePlacerPruebaIA',
  };
  const RAIZ = CARPETAS.evidencia;
  const leerCuerpo = (req: import('node:http').IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      const trozos: Buffer[] = [];
      let n = 0;
      req.on('data', (c: Buffer) => {
        n += c.length;
        if (n > 8_000_000) {
          reject(new Error('clip demasiado grande'));
          req.destroy();
          return;
        }
        trozos.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
      req.on('error', reject);
    });

  return {
    name: 'dp-evidencia-disco',
    configureServer(server) {
      server.middlewares.use('/__evidencia', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        const q = new URL(req.url || '', 'http://local').searchParams;
        const raizDe = (origen: string) => CARPETAS[origen] || null;
        const absSeguro = (origen: string, rel: string) => {
          const raiz = raizDe(origen);
          if (!raiz || !rel || rel.includes('..')) return null;
          const abs = join(raiz, rel);
          const norm = abs.replace(/\//g, '\\').toLowerCase();
          if (!norm.startsWith(raiz.toLowerCase())) return null;
          return abs;
        };
        const walkVideos = (origen: string, dir: string, rel: string, out: { origen: string; rel: string; nombre: string }[]) => {
          if (rel.toLowerCase().includes('prueba_no_es_real')) return;
          let entries: string[] = [];
          try { entries = readdirSync(dir); } catch { return; }
          for (const name of entries) {
            const abs = join(dir, name);
            const relHijo = rel ? `${rel}\\${name}` : name;
            let st;
            try { st = statSync(abs); } catch { continue; }
            if (st.isDirectory()) walkVideos(origen, abs, relHijo, out);
            else if (/\.(mp4|webm)$/i.test(name)) {
              const ficha = abs.replace(/\.(mp4|webm)$/i, '.json');
              let ya = false;
              if (existsSync(ficha)) {
                try {
                  const j = JSON.parse(readFileSync(ficha, 'utf8')) as { revisadoReglas?: boolean };
                  ya = j.revisadoReglas === true;
                } catch { /* se vuelve a revisar */ }
              }
              if (!ya) out.push({ origen, rel: relHijo, nombre: name });
            }
          }
        };

        if (req.method === 'GET' && q.get('op') === 'pendientes') {
          const lista: { origen: string; rel: string; nombre: string }[] = [];
          for (const origen of Object.keys(CARPETAS)) walkVideos(origen, CARPETAS[origen], '', lista);
          res.end(JSON.stringify({ ok: true, total: lista.length, videos: lista.slice(0, 24) }));
          return;
        }
        if (req.method === 'GET' && q.get('op') === 'frame') {
          const abs = absSeguro(q.get('origen') || '', q.get('rel') || '');
          if (!abs || !existsSync(abs)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ ok: false, error: 'Video no está en la carpeta' }));
            return;
          }
          const dirTmp = mkdtempSync(join(tmpdir(), 'dp-ev-'));
          const frames: string[] = [];
          try {
            for (const ss of ['0.4', '2']) {
              const out = join(dirTmp, `f${ss}.jpg`);
              try {
                await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', ss, '-i', abs, '-frames:v', '1', out], { timeout: 20000 });
                if (existsSync(out)) frames.push(readFileSync(out).toString('base64'));
              } catch { /* segundo instante puede no existir en clips cortos */ }
            }
          } finally {
            try { unlinkSync(join(dirTmp, 'f0.4.jpg')); } catch { /* ok */ }
            try { unlinkSync(join(dirTmp, 'f2.jpg')); } catch { /* ok */ }
          }
          if (frames.length === 0) {
            res.statusCode = 502;
            res.end(JSON.stringify({ ok: false, error: 'ffmpeg no sacó un fotograma' }));
            return;
          }
          res.end(JSON.stringify({ ok: true, frames }));
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'Solo GET o POST' }));
          return;
        }
        try {
          const cuerpo = JSON.parse(await leerCuerpo(req)) as {
            op?: string;
            origen?: string;
            rel?: string;
            tipo?: string;
            camara?: string;
            titulo?: string;
            descripcion?: string;
            categorias?: string[];
            clasificacion?: string;
            cuando?: string;
            dataBase64?: string;
            ext?: string;
          };
          if (cuerpo.op === 'marcar') {
            const abs = absSeguro(cuerpo.origen || 'evidencia', cuerpo.rel || '');
            if (!abs) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Ruta inválida' }));
              return;
            }
            const fichaPath = abs.replace(/\.(mp4|webm|jpg)$/i, '.json');
            let previo: Record<string, unknown> = {};
            if (existsSync(fichaPath)) {
              try { previo = JSON.parse(readFileSync(fichaPath, 'utf8')) as Record<string, unknown>; } catch { /* nueva */ }
            }
            const siguiente = {
              ...previo,
              estado: cuerpo.clasificacion && cuerpo.clasificacion !== 'bueno' ? 'por_verificar' : 'sin_anomalia_reglas',
              titulo: cuerpo.titulo || previo.titulo || '',
              revisadoReglas: true,
              revisadoReglasEn: new Date().toISOString(),
              hallazgoReglas: {
                tipo: cuerpo.tipo || 'ninguna',
                categorias: cuerpo.categorias || [],
                clasificacion: cuerpo.clasificacion || null,
                descripcion: cuerpo.descripcion || '',
              },
            };
            writeFileSync(fichaPath, JSON.stringify(siguiente, null, 2), 'utf8');
            res.end(JSON.stringify({ ok: true, ficha: fichaPath }));
            return;
          }
          const b64 = (cuerpo.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
          if (!b64) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Falta la imagen' }));
            return;
          }
          const cuando = cuerpo.cuando ? new Date(cuerpo.cuando) : new Date();
          const fecha = `${cuando.getFullYear()}-${String(cuando.getMonth() + 1).padStart(2, '0')}-${String(cuando.getDate()).padStart(2, '0')}`;
          const hora = `${String(cuando.getHours()).padStart(2, '0')}-${String(cuando.getMinutes()).padStart(2, '0')}-${String(cuando.getSeconds()).padStart(2, '0')}`;
          const limpio = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'hallazgo';
          const tipo = limpio(cuerpo.tipo || 'sospechoso');
          const cam = limpio(cuerpo.camara || 'cam');
          const ext = cuerpo.ext === 'mp4' || cuerpo.ext === 'webm' ? cuerpo.ext : 'jpg';
          const base = `${hora}_${cam}_${tipo}`;
          const dir = join(RAIZ, 'sin_asignar', fecha);
          mkdirSync(dir, { recursive: true });
          const archivo = `${base}.${ext}`;
          writeFileSync(join(dir, archivo), Buffer.from(b64, 'base64'));
          const relVideo = `sin_asignar\\${fecha}\\${archivo}`;
          const ficha = {
            id: `${fecha}_${base}`,
            estado: 'por_verificar',
            video: relVideo,
            tipo,
            camara: cam,
            camaraNombre: cuerpo.camara || cam,
            desde: cuando.toISOString(),
            horaLocal: `${fecha} ${hora.replace(/-/g, ':')}`,
            titulo: cuerpo.titulo || '',
            hallazgo: {
              tipo,
              descripcion: cuerpo.descripcion || cuerpo.titulo || '',
              evidencia_viable: true,
            },
            revisadoPorHumano: false,
            decisionHumana: null,
          };
          writeFileSync(join(dir, `${base}.json`), JSON.stringify(ficha, null, 2), 'utf8');
          appendFileSync(
            join(RAIZ, 'indice.jsonl'),
            JSON.stringify({ id: ficha.id, ficha: `sin_asignar\\${fecha}\\${base}.json` }) + '\n',
            'utf8'
          );
          res.end(JSON.stringify({ ok: true, ruta: relVideo }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'no se pudo guardar' }));
        }
      });
    },
  };
}

const PLUGIN_A_DESACTIVAR = 'vite-api-agente';

/** Quita el plugin que atiende /api dentro del PC, para que mande al servidor. */
function sinPluginDeApiLocal(plugins: UserConfig['plugins']): UserConfig['plugins'] {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.filter((p) => {
    const nombre = (p as Plugin | undefined)?.name;
    return nombre !== PLUGIN_A_DESACTIVAR;
  });
}

export default defineConfig(async (entorno) => {
  const base = (await (configuracionBase as UserConfigFnObject)(entorno)) as UserConfig;

  const baseSinApiLocal: UserConfig = {
    ...base,
    plugins: sinPluginDeApiLocal(base.plugins),
  };

  return mergeConfig(baseSinApiLocal, {
    plugins: [puenteCamaras(), puenteDvr(), puenteEvidenciaDisco()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false,
      proxy: {
        // Todo /api (la IA y la publicación directa) se atiende en el sitio publicado.
        '/api': {
          target: API_REMOTA,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  } satisfies UserConfig);
});
