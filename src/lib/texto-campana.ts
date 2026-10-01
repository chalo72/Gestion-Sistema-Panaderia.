/**
 * LIMPIEZA DE TEXTO DE CAMPAÑA — Dulce Placer
 * Creado 2026-09-19.
 *
 * El guion que genera la IA trae, mezcladas, dos cosas distintas:
 *  - Lo que DEBE verse/decirse  → "Hoy el amor se regala en bandeja"
 *  - Notas de producción        → "Audio: música acústica rítmica", "Escena 2:", "0-3 seg:"
 *
 * Antes se tomaba la primera línea tal cual y salían las notas técnicas encima
 * de la foto. Aquí se separan: las notas se descartan y queda solo la frase.
 */

/** Renglones que son instrucciones de producción, no texto para el público. */
const LINEA_TECNICA = new RegExp(
  '^\\s*(' +
  'audio|m[úu]sica|sonido|sfx|voz\\s*en\\s*off|locuci[óo]n|' +
  'escena|toma|plano|c[áa]mara|encuadre|transici[óo]n|' +
  'segundo|seg\\b|duraci[óo]n|tiempo|' +
  'gancho|hook|desarrollo|cierre|remate|' +
  'texto\\s*en\\s*pantalla|t[íi]tulo|subt[íi]tulo|' +
  'direcci[óo]n\\s*de\\s*arte|vestuario|actitud|' +
  'hashtags?|cta|llamado\\s*a\\s*la\\s*acci[óo]n|' +
  'instagram|facebook|whatsapp|tiktok|avatar' +
  ')\\s*[:：]',
  'i'
);

/** Marcas de lista, numeración de tiempos y adornos que no aportan. */
const ADORNOS = [
  /^\s*[-*•·—]+\s*/,            // viñetas
  /^\s*\d+\s*[).:-]\s*/,        // "1) " "2. "
  /^\s*\(?\d+\s*[-–a]\s*\d+\s*(seg|s)\b\)?\s*[:：-]?\s*/i, // "0-3 seg:"
  /^\s*\[[^\]]*\]\s*/,          // "[INSTAGRAM]"
  /\*\*/g,                      // negritas de markdown
  /^["“”'']+|["“”'']+$/g,       // comillas sueltas en los extremos
];

function limpiarRenglon(linea: string): string {
  let t = linea.replace(/#[\wÁÉÍÓÚÑáéíóúñ]+/g, ''); // hashtags fuera
  for (const patron of ADORNOS) t = t.replace(patron, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** ¿Este renglón sirve como frase para mostrar al público? */
function esFraseUtil(t: string): boolean {
  if (t.length < 10 || t.length > 130) return false;
  if (LINEA_TECNICA.test(t)) return false;
  // Si son puras mayúsculas y corto, suele ser un encabezado
  if (t === t.toUpperCase() && t.length < 30) return false;
  return true;
}

/**
 * Saca las frases publicables de los textos de la campaña, en orden de
 * preferencia, sin notas técnicas.
 *
 * @param textos  Textos de la campaña (Instagram, WhatsApp, guion…)
 * @param cuantas Cuántas frases devolver
 */
export function extraerFrases(textos: Array<string | undefined>, cuantas = 3): string[] {
  const candidatas: string[] = [];

  for (const texto of textos) {
    if (!texto) continue;
    // Partir por renglones y por final de oración
    const trozos = texto
      .split(/\n+/)
      .flatMap((l) => l.split(/(?<=[.!?…])\s+/));

    for (const trozo of trozos) {
      const limpio = limpiarRenglon(trozo);
      if (esFraseUtil(limpio) && !candidatas.includes(limpio)) {
        candidatas.push(limpio);
      }
    }
  }

  return candidatas.slice(0, cuantas);
}

/** La frase principal (el gancho) para poner grande sobre la imagen. */
export function extraerTitular(textos: Array<string | undefined>): string {
  return extraerFrases(textos, 1)[0] || 'Dulce Placer';
}
