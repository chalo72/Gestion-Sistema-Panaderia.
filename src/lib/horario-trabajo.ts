// Lee el horario escrito a mano en Trabajadores (ej. "Lun-Vie 7am-3pm", "Lun, Mié, Vie 07:00-15:00")
// para saber QUÉ DÍAS le toca trabajar y A QUÉ HORA entra/sale normalmente.
// Si no se puede entender, devuelve null en cada campo y la app se comporta como antes.

export interface HorarioParseado {
  dias: number[] | null;      // 0 = domingo … 6 = sábado. null = no se pudo leer (se asumen todos los días)
  entrada: string | null;     // "HH:MM" 24 h
  salida: string | null;      // "HH:MM" 24 h
}

const DIAS: Record<string, number> = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
const DIA_RE = '(?:lun|mar|mie|jue|vie|sab|dom)[a-z]*';

function sinTildes(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function a24h(h: number, suf: string | undefined): number {
  if (suf === 'pm' && h < 12) return h + 12;
  if (suf === 'am' && h === 12) return 0;
  return h;
}

export function parseHorario(texto?: string | null): HorarioParseado {
  const vacio: HorarioParseado = { dias: null, entrada: null, salida: null };
  if (!texto || !texto.trim()) return vacio;
  const t = sinTildes(texto).replace(/\./g, '');

  // ── Días ────────────────────────────────────────────────────────────────
  const dias = new Set<number>();
  const rangos = new RegExp(`(${DIA_RE})\\s*(?:-|–|a|al|hasta)\\s*(${DIA_RE})`, 'g');
  let sinRangos = t;
  for (const m of t.matchAll(rangos)) {
    const ini = DIAS[m[1].slice(0, 3)];
    const fin = DIAS[m[2].slice(0, 3)];
    let d = ini;
    for (let i = 0; i < 7; i++) {
      dias.add(d);
      if (d === fin) break;
      d = (d + 1) % 7;
    }
    sinRangos = sinRangos.replace(m[0], ' ');
  }
  for (const m of sinRangos.matchAll(new RegExp(DIA_RE, 'g'))) dias.add(DIAS[m[0].slice(0, 3)]);

  // ── Horas ───────────────────────────────────────────────────────────────
  let entrada: string | null = null;
  let salida: string | null = null;
  const hora = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|a|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/;
  const mh = t.match(hora);
  if (mh) {
    const h1raw = Number(mh[1]), m1 = Number(mh[2] ?? 0), s1 = mh[3];
    const h2raw = Number(mh[4]), m2 = Number(mh[5] ?? 0), s2 = mh[6];
    if (h1raw <= 24 && h2raw <= 24 && m1 < 60 && m2 < 60) {
      const h1 = a24h(h1raw, s1 ?? undefined);
      let h2 = a24h(h2raw, s2 ?? undefined);
      // "7-3": si la salida queda antes de la entrada, es de la tarde (3 → 15:00)
      if (h2 * 60 + m2 <= h1 * 60 + m1 && h2 < 12) h2 += 12;
      if (h2 * 60 + m2 > h1 * 60 + m1) {
        entrada = aHHMM(h1, m1);
        salida = aHHMM(h2 % 24, m2);
      }
    }
  }

  return { dias: dias.size > 0 ? [...dias].sort() : null, entrada, salida };
}

/** Minutos entre dos horas "HH:MM" (0 si la salida no es posterior). */
export function minutosEntre(desde: string, hasta: string): number {
  const [h1, m1] = desde.split(':').map(Number);
  const [h2, m2] = hasta.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

/** Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD", sin problemas de zona horaria. */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Fecha de hoy en hora LOCAL ("YYYY-MM-DD"). */
export function fechaLocalHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const NOMBRE_DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
