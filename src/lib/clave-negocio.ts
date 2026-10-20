/**
 * CLAVE DEL NEGOCIO — Dulce Placer
 * Creado 2026-09-30 (AUTORIZO Gonzalo) tras la auditoría del 29-sep.
 *
 * Problema: las funciones del servidor (/api/publicar, /api/agente, /api/whisper)
 * aceptaban llamadas de CUALQUIERA en internet → podían publicar en el Facebook
 * del negocio o gastar los créditos de IA.
 *
 * Solución: una clave que se escribe UNA vez en cada celular/PC de confianza
 * (Configuración → Clave del negocio). Se guarda solo en ese aparato — NUNCA
 * va dentro del código de la app, así que no se puede sacar leyendo el código.
 * El servidor la compara con la variable DP_CLAVE_NEGOCIO de Vercel.
 *
 * Mientras DP_CLAVE_NEGOCIO no esté configurada en Vercel, el servidor sigue
 * aceptando todo como antes (para no romper nada durante la transición).
 */

const LLAVE = 'dp_clave_negocio';

export function leerClaveNegocio(): string {
  try { return localStorage.getItem(LLAVE) || ''; } catch { return ''; }
}

export function guardarClaveNegocio(clave: string): void {
  try {
    const limpia = clave.trim();
    if (limpia) localStorage.setItem(LLAVE, limpia);
    else localStorage.removeItem(LLAVE);
  } catch { /* navegador sin almacenamiento: no se guarda */ }
}

/** Encabezados para llamar a /api/*: agrega la clave si este aparato la tiene. */
export function encabezadosConClave(base: Record<string, string> = {}): Record<string, string> {
  const clave = leerClaveNegocio();
  return clave ? { ...base, 'x-dp-clave': clave } : base;
}
