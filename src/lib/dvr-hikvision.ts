/**
 * Cliente DVR Hikvision (ISAPI) vía puente local `/__dvr`.
 * Solo funciona con la app local (vite.config.local.ts) en la red de la panadería.
 * Las claves NO van en el navegador: el puente las lee de go2rtc.yaml.
 *
 * AUTORIZO Gonzalo 2026-10-21 — escaneo al regresar / forense.
 */

export type SegmentoDvr = {
  trackId: string;
  inicio: string;
  fin: string;
  playbackUri: string;
  codec?: string;
};

export type ResumenDvr = {
  ok: boolean;
  modelo?: string;
  serial?: string;
  firmware?: string;
  error?: string;
};

export type BusquedaDvr = {
  ok: boolean;
  total: number;
  hayMas: boolean;
  segmentos: SegmentoDvr[];
  error?: string;
  /** Pistas que fallaron en la búsqueda (ej. "401:HTTP401"). */
  erroresPista?: string[];
};

export type FrameDvr = {
  ok: boolean;
  /** data URL JPEG listo para ODYSSEUS */
  dataUrl?: string;
  /** live | playback | live-fallback */
  fuente?: string;
  error?: string;
};

/** Pistas típicas Hikvision: canal N → track (N*100)+1 (ej. cam1=101 … cam4=401). */
export const PISTAS_DVR_DEFAULT = ['101', '201', '301', '401'] as const;

async function llamarDvr(params: Record<string, string>): Promise<Response> {
  const q = new URLSearchParams(params);
  return fetch(`/__dvr?${q.toString()}`, { cache: 'no-store' });
}

export async function probarConexionDvr(): Promise<ResumenDvr> {
  try {
    const r = await llamarDvr({ op: 'info' });
    const j = (await r.json()) as ResumenDvr;
    return j;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No hay puente /__dvr (¿abriste ABRIR_DULCE_PLACER_LOCAL?)',
    };
  }
}

/**
 * Busca segmentos grabados en el DVR entre dos fechas (ISO date YYYY-MM-DD).
 * `dias` = atajo: últimos N días hasta hoy.
 */
export async function buscarGrabacionesDvr(opts: {
  dias?: 7 | 14 | 21;
  desde?: string;
  hasta?: string;
  tracks?: string[];
  maxPorPista?: number;
}): Promise<BusquedaDvr> {
  const hasta = opts.hasta || new Date().toISOString().slice(0, 10);
  let desde = opts.desde;
  if (!desde && opts.dias) {
    const d = new Date();
    d.setDate(d.getDate() - (opts.dias - 1));
    desde = d.toISOString().slice(0, 10);
  }
  if (!desde) {
    return { ok: false, total: 0, hayMas: false, segmentos: [], error: 'Falta rango de fechas' };
  }

  try {
    const r = await llamarDvr({
      op: 'search',
      desde,
      hasta,
      tracks: (opts.tracks || [...PISTAS_DVR_DEFAULT]).join(','),
      max: String(opts.maxPorPista ?? 40),
    });
    const j = (await r.json()) as BusquedaDvr;
    return j;
  } catch (e) {
    return {
      ok: false,
      total: 0,
      hayMas: false,
      segmentos: [],
      error: e instanceof Error ? e.message : 'Fallo buscando en el DVR',
    };
  }
}

export function etiquetaPista(trackId: string): string {
  const n = Number(trackId);
  if (!Number.isFinite(n)) return `pista ${trackId}`;
  const canal = Math.floor(n / 100);
  return `Cámara ${canal} (track ${trackId})`;
}

/** Foto en vivo del canal (ISAPI picture). */
export async function capturarFotoDvr(trackId: string): Promise<FrameDvr> {
  try {
    const r = await llamarDvr({ op: 'picture', track: trackId });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: j.error || `HTTP ${r.status}` };
    }
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return {
      ok: true,
      dataUrl: `data:image/jpeg;base64,${btoa(bin)}`,
      fuente: r.headers.get('X-DP-Fuente') || 'live',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Sin puente /__dvr' };
  }
}

/**
 * Frame de un momento del disco (RTSP playback vía ffmpeg en el puente).
 * Si falla el histórico, el puente puede devolver foto en vivo (live-fallback).
 */
export async function capturarFrameDvr(trackId: string, cuandoIso: string): Promise<FrameDvr> {
  try {
    const r = await llamarDvr({ op: 'frame', track: trackId, cuando: cuandoIso });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: j.error || `HTTP ${r.status}` };
    }
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Evitar stack overflow con frames grandes
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(bin);
    return {
      ok: true,
      dataUrl: `data:image/jpeg;base64,${b64}`,
      fuente: r.headers.get('X-DP-Fuente') || 'playback',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Sin puente /__dvr' };
  }
}

/** Elige hasta `max` segmentos repartidos entre pistas (incluye cámara 4 = 401). */
export function muestrearSegmentosDvr(segmentos: SegmentoDvr[], max = 24): SegmentoDvr[] {
  if (segmentos.length <= max) return [...segmentos];
  const porPista = new Map<string, SegmentoDvr[]>();
  for (const s of segmentos) {
    const arr = porPista.get(s.trackId) || [];
    arr.push(s);
    porPista.set(s.trackId, arr);
  }
  const pistas = [...porPista.keys()].sort();
  const porCanal = Math.max(1, Math.floor(max / Math.max(1, pistas.length)));
  const out: SegmentoDvr[] = [];
  for (const tid of pistas) {
    const lista = porPista.get(tid) || [];
    if (lista.length <= porCanal) {
      out.push(...lista);
      continue;
    }
    for (let i = 0; i < porCanal; i++) {
      const idx = Math.floor((i * (lista.length - 1)) / Math.max(1, porCanal - 1));
      out.push(lista[idx]);
    }
  }
  return out.slice(0, max);
}

/**
 * Muestreo FORENSE: prioriza caja (track 101) con ~55% de cupos.
 * El resto se reparte en 201/301/401. Así el billete→bolsillo tiene más chances.
 */
export function muestrearSegmentosDvrForense(segmentos: SegmentoDvr[], max = 48): SegmentoDvr[] {
  if (segmentos.length === 0) return [];
  if (segmentos.length <= max) return [...segmentos];

  const porPista = new Map<string, SegmentoDvr[]>();
  for (const s of segmentos) {
    const arr = porPista.get(s.trackId) || [];
    arr.push(s);
    porPista.set(s.trackId, arr);
  }

  /** Canal 1 = caja (prioridad forense billete/bolsillo). */
  const esCaja = (tid: string) => tid === '101';
  const pistasCaja = [...porPista.keys()].filter(esCaja);
  const pistasOtras = [...porPista.keys()].filter((t) => !esCaja(t)).sort();

  const cupoCaja = Math.max(Math.ceil(max * 0.55), 1);
  const cupoOtras = Math.max(max - cupoCaja, 1);
  const out: SegmentoDvr[] = [];

  const tomarEspaciados = (lista: SegmentoDvr[], cupo: number) => {
    if (lista.length === 0 || cupo <= 0) return;
    if (lista.length <= cupo) {
      out.push(...lista);
      return;
    }
    for (let i = 0; i < cupo; i++) {
      const idx = Math.floor((i * (lista.length - 1)) / Math.max(1, cupo - 1));
      out.push(lista[idx]);
    }
  };

  const listaCaja = pistasCaja.flatMap((t) => porPista.get(t) || []);
  tomarEspaciados(listaCaja, cupoCaja);

  const porOtra = Math.max(1, Math.floor(cupoOtras / Math.max(1, pistasOtras.length)));
  for (const tid of pistasOtras) {
    tomarEspaciados(porPista.get(tid) || [], porOtra);
  }

  // Deduplicar por inicio+track
  const seen = new Set<string>();
  const uniq: SegmentoDvr[] = [];
  for (const s of out) {
    const k = `${s.trackId}|${s.inicio}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
  }
  return uniq.slice(0, max);
}

/**
 * Varios instantes dentro de un tramo (inicio → fin) para no perder gestos cortos.
 * Devuelve ISO timestamps repartidos en el segmento.
 */
export function instantesForensesEnSegmento(seg: SegmentoDvr, cuantos = 3): string[] {
  const a = Date.parse(seg.inicio);
  const b = Date.parse(seg.fin);
  if (!Number.isFinite(a)) return [seg.inicio];
  if (!Number.isFinite(b) || b <= a + 5_000) return [seg.inicio];
  const n = Math.max(1, Math.min(5, cuantos));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    // Evita extremos exactos (a veces el DVR no tiene I-frame al borde)
    const frac = (i + 0.35) / n;
    const t = a + (b - a) * frac;
    out.push(new Date(t).toISOString());
  }
  return out;
}
