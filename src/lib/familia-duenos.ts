/**
 * Catálogo de familia / dueños / gerentes para etiquetar retiros de la panadería.
 * Fuente de verdad para gastos categoría Familia y compromisos esPropietario.
 */

export type RolPersonaFamilia = 'dueno' | 'gerente' | 'ambos';

export interface PersonaFamilia {
  id: string;
  nombre: string;
  rol: RolPersonaFamilia;
  /** Tokens para detectar el nombre en descripciones de gasto */
  aliases: string[];
}

/** Umbral: si Familia supera este % de ventas del periodo → alerta */
export const UMBRAL_FAMILIA_PCT_VENTAS = 15;

export const PERSONAS_FAMILIA: PersonaFamilia[] = [
  {
    id: 'emiliano',
    nombre: 'Emiliano',
    rol: 'dueno',
    aliases: ['emiliano'],
  },
  {
    id: 'isabela',
    nombre: 'Isabela',
    rol: 'dueno',
    aliases: ['isabela', 'isabella'],
  },
  {
    id: 'gonzalo-ivan',
    nombre: 'Gonzalo Iván',
    rol: 'ambos',
    aliases: ['gonzalo ivan', 'gonzalo iván', 'gonzalo', 'ivan', 'iván'],
  },
  {
    id: 'andrea-cadena',
    nombre: 'Andrea Cadena',
    rol: 'dueno',
    aliases: ['andrea cadena', 'cadena'],
  },
  {
    id: 'santiago',
    nombre: 'Santiago',
    rol: 'dueno',
    aliases: ['santiago'],
  },
  {
    id: 'andrea-rosales',
    nombre: 'Andrea Rosales',
    rol: 'gerente',
    aliases: ['andrea rosales', 'rosales'],
  },
];

const sinTilde = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function nombresPersonaFamilia(): string[] {
  return PERSONAS_FAMILIA.map((p) => p.nombre);
}

/** Opciones para select de compromisos / gastos Familia */
export function opcionesPersonaFamilia(): { value: string; label: string }[] {
  return PERSONAS_FAMILIA.map((p) => ({
    value: p.nombre,
    label:
      p.rol === 'gerente'
        ? `${p.nombre} (gerente)`
        : p.rol === 'ambos'
          ? `${p.nombre} (dueño / gerente)`
          : `${p.nombre} (familia)`,
  }));
}

export function esNombrePersonaFamilia(nombre?: string | null): boolean {
  if (!nombre?.trim()) return false;
  const n = sinTilde(nombre.trim());
  return PERSONAS_FAMILIA.some(
    (p) => sinTilde(p.nombre) === n || p.aliases.some((a) => sinTilde(a) === n)
  );
}

/**
 * Detecta qué persona de la familia aparece en un texto de gasto.
 * Prefiere coincidencias más largas (Andrea Cadena antes que solo "Andrea").
 */
export function detectarPersonaFamiliaEnTexto(texto?: string | null): PersonaFamilia | null {
  if (!texto?.trim()) return null;
  const t = sinTilde(texto);
  let mejor: PersonaFamilia | null = null;
  let mejorLen = 0;
  for (const p of PERSONAS_FAMILIA) {
    for (const alias of [sinTilde(p.nombre), ...p.aliases.map(sinTilde)]) {
      if (alias.length < 4 && !/\s/.test(alias)) continue; // evita "ivan" suelto demasiado corto salvo compuestos
      const re = new RegExp(`(?:^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`);
      if (re.test(t) && alias.length >= mejorLen) {
        mejor = p;
        mejorLen = alias.length;
      }
    }
  }
  // Segunda pasada: aliases cortos solo si no hubo match
  if (!mejor) {
    for (const p of PERSONAS_FAMILIA) {
      for (const alias of p.aliases.map(sinTilde)) {
        if (alias.length >= 4) continue;
        const re = new RegExp(`(?:^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`);
        if (re.test(t)) return p;
      }
    }
  }
  return mejor;
}

export function personaFamiliaDeGasto(g: {
  personaFamilia?: string;
  metadata?: { personaFamilia?: string; [k: string]: unknown };
  descripcion?: string;
}): string | undefined {
  const directa = g.personaFamilia || g.metadata?.personaFamilia;
  if (typeof directa === 'string' && directa.trim()) return directa.trim();
  const det = detectarPersonaFamiliaEnTexto(g.descripcion);
  return det?.nombre;
}
