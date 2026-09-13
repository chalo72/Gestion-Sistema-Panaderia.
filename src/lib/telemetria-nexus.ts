export const WEBHOOK_URL = 'http://localhost:3005/api/alert';

const sentRecently = new Map<string, number>();
const DEDUP_WINDOW_MS = 4000;

export function enviarTelemetria(
  tipoIncidente: string,
  descripcion: string | unknown,
  vendedorNombre?: string,
  extra?: Record<string, any>
) {
  if (typeof window === 'undefined') return;

  const desc = typeof descripcion === 'string'
    ? descripcion
    : (descripcion instanceof Error ? `${descripcion.message}\n${descripcion.stack || ''}` : JSON.stringify(descripcion));

  // Filtrar ruidos esperados o inocuos
  if (
    !desc ||
    desc.includes('permission-denied') ||
    desc.includes('Firebase') ||
    desc.includes('Missing or insufficient') ||
    desc.includes('ResizeObserver loop')
  ) {
    return;
  }

  // Deduplicación inteligente: evitar bucles repetitivos de un mismo fallo en corto tiempo
  const dedupKey = `${tipoIncidente}:${desc.slice(0, 120)}`;
  const now = Date.now();
  const lastSent = sentRecently.get(dedupKey) || 0;
  if (now - lastSent < DEDUP_WINDOW_MS) {
    return;
  }
  sentRecently.set(dedupKey, now);

  // Limpiar llaves antiguas periódicamente
  if (sentRecently.size > 100) {
    for (const [k, ts] of sentRecently.entries()) {
      if (now - ts > DEDUP_WINDOW_MS * 2) sentRecently.delete(k);
    }
  }

  const payload = {
    tipoIncidente,
    descripcion: desc,
    vendedorNombre: vendedorNombre || 'Navegador',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...extra,
  };

  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function reportarFalla(tipo: string, err: unknown, modulo?: string) {
  enviarTelemetria(
    tipo,
    err,
    modulo || 'Sensor_Automatico',
    { modulo: modulo || 'Global' }
  );
}

export function reportarInconsistencia(origen: string, detalle: string) {
  enviarTelemetria(
    'INCONSISTENCIA_PLATAFORMA',
    detalle,
    origen,
    { origen }
  );
}