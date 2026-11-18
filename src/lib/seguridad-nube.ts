/**
 * seguridad-nube.ts — Bitácora anti-robo compartida entre aparatos.
 *
 * Antes las alertas de faltante, los cuadres de turno y los registros de
 * actividad vivían SOLO en el localStorage del aparato donde pasaron: el dueño
 * no las veía desde su celular, y quien usaba la caja podía borrarlas limpiando
 * el navegador. Aquí cada evento se sube a la tabla `seguridad_eventos`
 * (Supabase), que solo permite AGREGAR y LEER (no borrar ni editar, solo marcar
 * "leída"). Ver supabase/migrations/20261018_seguridad_eventos.sql.
 *
 * Si no hay internet o la tabla aún no existe, el evento queda en cola local
 * y se reintenta después. Nunca rompe el flujo de la caja.
 */

const COLA_KEY = 'dp_security_cola_nube';
const MAX_COLA = 500;

export type TipoEventoSeguridad = 'alerta' | 'cuadre' | 'log';

export interface EventoSeguridadNube {
  id: string;
  tipo: TipoEventoSeguridad;
  nivel?: string;
  titulo?: string;
  descripcion?: string;
  usuario?: string;
  payload: Record<string, any>;
  fecha: string;
  leida?: boolean;
}

function leerCola(): EventoSeguridadNube[] {
  try {
    const raw = localStorage.getItem(COLA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function guardarCola(cola: EventoSeguridadNube[]): void {
  try { localStorage.setItem(COLA_KEY, JSON.stringify(cola.slice(-MAX_COLA))); } catch { /* sin espacio */ }
}

function dispositivo(): string {
  try { return (navigator.userAgent || '').slice(0, 120); } catch { return ''; }
}

/** Import perezoso: supabase.ts lanza error si faltan las variables (tests, modo offline). */
async function cliente() {
  try {
    const mod = await import('@/lib/supabase');
    return mod.supabase;
  } catch {
    return null;
  }
}

function aFila(e: EventoSeguridadNube) {
  return {
    id: e.id,
    tipo: e.tipo,
    nivel: e.nivel ?? null,
    titulo: e.titulo ?? null,
    descripcion: e.descripcion ?? null,
    usuario: e.usuario ?? null,
    payload: e.payload ?? {},
    dispositivo: dispositivo(),
    fecha: e.fecha,
    leida: e.leida ?? false,
  };
}

/** Sube un evento a la nube (no bloquea). Si falla, queda en cola para reintento. */
export function subirEventoSeguridad(evento: EventoSeguridadNube): void {
  void (async () => {
    const sb = await cliente();
    if (!sb) { guardarCola([...leerCola(), evento]); return; }
    // upsert con ignoreDuplicates: si ya existe no intenta UPDATE (solo hay permiso de INSERT)
    const { error } = await sb.from('seguridad_eventos').upsert(aFila(evento), { onConflict: 'id', ignoreDuplicates: true });
    if (error) guardarCola([...leerCola(), evento]);
  })().catch(() => guardarCola([...leerCola(), evento]));
}

/** Reintenta subir lo que quedó pendiente por falta de internet. */
export async function reintentarColaSeguridad(): Promise<void> {
  const cola = leerCola();
  if (cola.length === 0) return;
  const sb = await cliente();
  if (!sb) return;
  const { error } = await sb
    .from('seguridad_eventos')
    .upsert(cola.map(aFila), { onConflict: 'id', ignoreDuplicates: true });
  if (!error) guardarCola([]);
}

/** Baja los últimos eventos de TODOS los aparatos. Devuelve [] si no hay conexión. */
export async function bajarEventosSeguridad(limite = 400): Promise<EventoSeguridadNube[]> {
  const sb = await cliente();
  if (!sb) return [];
  const { data, error } = await sb
    .from('seguridad_eventos')
    .select('id,tipo,nivel,titulo,descripcion,usuario,payload,fecha,leida')
    .order('fecha', { ascending: false })
    .limit(limite);
  if (error || !data) return [];
  return data as EventoSeguridadNube[];
}

/** Marca leída en la nube (único campo que la tabla deja cambiar). */
export function marcarLeidaNube(ids: string[]): void {
  if (ids.length === 0) return;
  void (async () => {
    const sb = await cliente();
    if (!sb) return;
    await sb.from('seguridad_eventos').update({ leida: true }).in('id', ids);
  })().catch(() => {});
}
