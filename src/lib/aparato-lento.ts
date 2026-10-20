/**
 * DETECTOR DE APARATO LENTO — Dulce Placer
 * Creado 2026-10-04, autorizado por Gonzalo.
 *
 * PARA QUE SIRVE: la app trataba igual a un celular de baja gama con 2 GB de
 * memoria y al PC del escritorio. Este archivo responde UNA sola pregunta:
 * "¿el aparato que esta corriendo la app es de los lentos?".
 *
 * ESTE ARCHIVO NO CAMBIA NADA POR SI SOLO. Solo responde la pregunta. Hasta que
 * algo lo importe y lo use, la app se comporta exactamente igual que antes.
 *
 * REGLA DE ORO — FALLA HACIA "NORMAL": si el navegador no da la informacion (es
 * el caso de iPhone, que no expone memoria ni nucleos), la respuesta es NO es
 * lento. Asi, en la duda, nadie pierde funciones ni se le degrada la pantalla.
 * Mas vale un celular lento sin optimizar que un PC bueno degradado sin razon.
 */

export interface SenalesAparato {
  /** Memoria RAM en GB que reporta el navegador. undefined = no lo dice. */
  memoriaGB?: number;
  /** Nucleos del procesador. undefined = no lo dice. */
  nucleos?: number;
  /** El usuario activo "ahorro de datos" en su navegador. */
  ahorroDatos: boolean;
  /** Tipo de conexion: 'slow-2g' | '2g' | '3g' | '4g' | undefined. */
  conexion?: string;
  /** El usuario pidio menos animaciones en los ajustes del sistema. */
  menosAnimacion: boolean;
}

/** Lee lo que el navegador quiera contar. Nunca truena. */
export function leerSenales(): SenalesAparato {
  const vacio: SenalesAparato = { ahorroDatos: false, menosAnimacion: false };
  if (typeof navigator === 'undefined') return vacio;

  let memoriaGB: number | undefined;
  let nucleos: number | undefined;
  let ahorroDatos = false;
  let conexion: string | undefined;
  let menosAnimacion = false;

  try {
    const n = navigator as any;
    if (typeof n.deviceMemory === 'number') memoriaGB = n.deviceMemory;
    if (typeof n.hardwareConcurrency === 'number') nucleos = n.hardwareConcurrency;
    const c = n.connection || n.mozConnection || n.webkitConnection;
    if (c) {
      ahorroDatos = c.saveData === true;
      if (typeof c.effectiveType === 'string') conexion = c.effectiveType;
    }
  } catch { /* navegador que no comparte nada: se queda en undefined */ }

  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      menosAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch { /* ignorar */ }

  return { memoriaGB, nucleos, ahorroDatos, conexion, menosAnimacion };
}

/**
 * ¿Es un aparato de baja gama? Cualquiera de estas lo marca como lento:
 *   - menos de 4 GB de memoria
 *   - menos de 4 nucleos de procesador
 *   - el usuario activo el ahorro de datos
 *   - la conexion es 2G o 3G
 *   - el usuario pidio menos animaciones
 * Si el navegador no dice NADA de memoria ni nucleos, responde false (normal).
 */
export function esAparatoLento(senales: SenalesAparato = leerSenales()): boolean {
  if (senales.ahorroDatos) return true;
  if (senales.menosAnimacion) return true;
  if (senales.conexion === 'slow-2g' || senales.conexion === '2g' || senales.conexion === '3g') return true;
  if (typeof senales.memoriaGB === 'number' && senales.memoriaGB < 4) return true;
  if (typeof senales.nucleos === 'number' && senales.nucleos < 4) return true;
  return false;
}

/** Se calcula una sola vez al cargar, para no repetir la consulta en cada pantalla. */
export const APARATO_LENTO: boolean = (() => {
  try { return esAparatoLento(); } catch { return false; }
})();

/**
 * Pone un atributo en la etiqueta <html> para que el CSS pueda reaccionar:
 *   <html data-aparato="lento">  o  <html data-aparato="normal">
 *
 * OJO: llamar a esto NO cambia como se ve la app. Solo escribe el atributo.
 * El dia que exista una regla de CSS que mire [data-aparato="lento"], ahi si
 * empieza a tener efecto visual. Mientras no exista, es inofensivo.
 *
 * Devuelve true si el aparato quedo marcado como lento.
 */
export function marcarAparatoEnHtml(): boolean {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-aparato', APARATO_LENTO ? 'lento' : 'normal');
    }
  } catch { /* ignorar */ }
  return APARATO_LENTO;
}

/** Para revisar en la consola del navegador que esta detectando de verdad. */
export function diagnosticoAparato(): string {
  const s = leerSenales();
  return [
    'Aparato: ' + (esAparatoLento(s) ? 'LENTO (baja gama)' : 'normal'),
    'Memoria: ' + (s.memoriaGB !== undefined ? s.memoriaGB + ' GB' : 'no lo dice'),
    'Nucleos: ' + (s.nucleos !== undefined ? String(s.nucleos) : 'no lo dice'),
    'Conexion: ' + (s.conexion || 'no lo dice'),
    'Ahorro de datos: ' + (s.ahorroDatos ? 'si' : 'no'),
    'Pidio menos animacion: ' + (s.menosAnimacion ? 'si' : 'no'),
  ].join(' | ');
}
