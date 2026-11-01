// Avisos de cambio de turno: quedan en la app hasta marcarlos leídos,
// y se pueden mandar por WhatsApp a quien no viene y a quien cubre.

import type { CambioHorario } from '@/lib/horario-tienda';
import { TEXTO_MOTIVO } from '@/lib/horario-tienda';
import { db } from '@/lib/database';

export const CLAVE_AVISOS_TURNO = 'dulce_avisos_turno_v1';
export const EVENTO_AVISOS_TURNO = 'dulce-avisos-turno';

export type RolAvisoTurno = 'ausente' | 'cubre';

export interface AvisoTurno {
  id: string;
  createdAt: string;
  fechaTurno: string;
  destinatarioId: string | null;
  destinatarioNombre: string;
  rol: RolAvisoTurno;
  titulo: string;
  texto: string;
  leido: boolean;
  whatsappIntentado: boolean;
}

export interface DestinoWhatsApp {
  nombre: string;
  telefono: string | null;
  texto: string;
  rol: RolAvisoTurno;
}

function avisar(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_AVISOS_TURNO));
}

function leerRaw(): AvisoTurno[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CLAVE_AVISOS_TURNO);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data as AvisoTurno[] : [];
  } catch {
    return [];
  }
}

export function leerAvisosTurno(): AvisoTurno[] {
  return leerRaw().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function guardarAvisosTurno(lista: AvisoTurno[]): void {
  try { localStorage.setItem(CLAVE_AVISOS_TURNO, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  avisar();
}

export function avisosNoLeidos(lista: AvisoTurno[] = leerAvisosTurno()): AvisoTurno[] {
  return lista.filter(a => !a.leido);
}

/** Solo los del trabajador, o todos si no se pasa id/nombre. */
export function avisosVisiblesPara(
  lista: AvisoTurno[],
  quien?: { id?: string | null; nombre?: string | null; verTodos?: boolean },
): AvisoTurno[] {
  if (!quien || quien.verTodos) return lista;
  const id = quien.id || null;
  const clave = primerNombre(quien.nombre || '');
  return lista.filter(a =>
    (id && a.destinatarioId === id)
    || (clave && primerNombre(a.destinatarioNombre) === clave),
  );
}

export function marcarAvisoLeido(id: string): AvisoTurno[] {
  const lista = leerRaw().map(a => a.id === id ? { ...a, leido: true } : a);
  guardarAvisosTurno(lista);
  return lista;
}

export function marcarTodosLeidos(ids?: string[]): AvisoTurno[] {
  const set = ids ? new Set(ids) : null;
  const lista = leerRaw().map(a => (!set || set.has(a.id) ? { ...a, leido: true } : a));
  guardarAvisosTurno(lista);
  return lista;
}

function primerNombre(nombre: string): string {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)[0] ?? '';
}

/** Colombia: 300… → 57300… */
export function telefonoWhatsApp(tel?: string | null): string | null {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 && d.startsWith('3')) d = `57${d}`;
  if (d.length < 11) return null;
  return d;
}

export function fechaCortaEs(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function mensajeWhatsAppAusente(c: CambioHorario): string {
  const dia = fechaCortaEs(c.fecha);
  const motivo = TEXTO_MOTIVO[c.motivo];
  const detalle = c.nota.trim() ? `\nNota: ${c.nota.trim()}` : '';
  const cubre = c.cubre
    ? `\nTu ${c.puesto} la cubre ${c.cubre}.`
    : `\nTu ${c.puesto} quedó sin cubrir por ahora.`;
  return [
    '🥖 *Dulce Placer — cambio de turno*',
    '',
    `Hola ${c.enfermo.split(' ')[0]},`,
    `Quedó anotado que el *${dia}* no vienes (${motivo}).${detalle}${cubre}`,
    '',
    'Revisa el aviso en la app y márcalo leído cuando lo veas.',
  ].join('\n');
}

export function mensajeWhatsAppCubre(c: CambioHorario): string {
  const dia = fechaCortaEs(c.fecha);
  const motivo = TEXTO_MOTIVO[c.motivo];
  const detalle = c.nota.trim() ? `\nNota: ${c.nota.trim()}` : '';
  return [
    '🥖 *Dulce Placer — te toca cubrir*',
    '',
    `Hola ${String(c.cubre).split(' ')[0]},`,
    `El *${dia}* cubres la *${c.puesto}* de ${c.enfermo} (${motivo}).${detalle}`,
    '',
    'Revisa el aviso en la app y márcalo leído cuando lo veas.',
  ].join('\n');
}

export function crearAvisosDeCambio(c: CambioHorario): AvisoTurno[] {
  const ahora = new Date().toISOString();
  const dia = fechaCortaEs(c.fecha);
  const avisos: AvisoTurno[] = [{
    id: `aus-${c.fecha}-${c.enfermoId || c.enfermo}-${Date.now()}`,
    createdAt: ahora,
    fechaTurno: c.fecha,
    destinatarioId: c.enfermoId ?? null,
    destinatarioNombre: c.enfermo,
    rol: 'ausente',
    titulo: `Cambio de turno · ${c.enfermo.split(' ')[0]}`,
    texto: `${c.enfermo} no viene el ${dia} (${TEXTO_MOTIVO[c.motivo]}). ${c.cubre ? `Cubre ${c.cubre} en la ${c.puesto}.` : `La ${c.puesto} quedó sin cubrir.`}${c.nota.trim() ? ` ${c.nota.trim()}` : ''}`,
    leido: false,
    whatsappIntentado: false,
  }];
  if (c.cubre) {
    avisos.push({
      id: `cub-${c.fecha}-${c.cubreId || c.cubre}-${Date.now() + 1}`,
      createdAt: ahora,
      fechaTurno: c.fecha,
      destinatarioId: c.cubreId ?? null,
      destinatarioNombre: c.cubre,
      rol: 'cubre',
      titulo: `Te toca cubrir · ${c.cubre.split(' ')[0]}`,
      texto: `${c.cubre}: el ${dia} cubres la ${c.puesto} de ${c.enfermo} (${TEXTO_MOTIVO[c.motivo]}).${c.nota.trim() ? ` ${c.nota.trim()}` : ''}`,
      leido: false,
      whatsappIntentado: false,
    });
  }
  const lista = [...avisos, ...leerRaw()];
  guardarAvisosTurno(lista);
  return avisos;
}

export function destinosWhatsAppDeCambio(
  c: CambioHorario,
  telefonos: Record<string, string | null | undefined>,
): DestinoWhatsApp[] {
  const porNombre = (nombre: string, id?: string | null) =>
    (id && telefonos[id]) || telefonos[nombre] || null;
  const destinos: DestinoWhatsApp[] = [{
    nombre: c.enfermo,
    telefono: telefonoWhatsApp(porNombre(c.enfermo, c.enfermoId)),
    texto: mensajeWhatsAppAusente(c),
    rol: 'ausente',
  }];
  if (c.cubre) {
    destinos.push({
      nombre: c.cubre,
      telefono: telefonoWhatsApp(porNombre(c.cubre, c.cubreId)),
      texto: mensajeWhatsAppCubre(c),
      rol: 'cubre',
    });
  }
  return destinos;
}

export function abrirWhatsApp(telefono: string, texto: string): void {
  if (typeof window === 'undefined') return;
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, '_blank');
}

async function callMeBot(phone: string, apiKey: string, text: string): Promise<boolean> {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text.slice(0, 900))}&apikey=${encodeURIComponent(apiKey)}`;
  try {
    await fetch(url, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

/** Abre WhatsApp a cada trabajadora con teléfono. Si hay CallMeBot del negocio, también avisa ahí. */
export async function notificarCambioTurnoWhatsApp(
  c: CambioHorario,
  telefonos: Record<string, string | null | undefined>,
): Promise<{ abiertos: string[]; sinTelefono: string[]; admin: boolean }> {
  const destinos = destinosWhatsAppDeCambio(c, telefonos);
  const abiertos: string[] = [];
  const sinTelefono: string[] = [];
  for (const d of destinos) {
    if (!d.telefono) {
      sinTelefono.push(d.nombre);
      continue;
    }
    abrirWhatsApp(d.telefono, d.texto);
    abiertos.push(d.nombre);
  }

  let admin = false;
  try {
    const config = await db.getConfiguracion();
    const phone = telefonoWhatsApp(config?.telefonoNegocio);
    const apiKey = (config?.whatsappApiKey ?? '').trim();
    if (phone && apiKey) {
      const resumen = [
        '🥖 Dulce Placer — cambio de turno',
        `${c.enfermo} no viene el ${fechaCortaEs(c.fecha)} (${TEXTO_MOTIVO[c.motivo]}).`,
        c.cubre ? `Cubre ${c.cubre} en la ${c.puesto}.` : `La ${c.puesto} sin cubrir.`,
        c.nota.trim() || '',
      ].filter(Boolean).join('\n');
      admin = await callMeBot(phone, apiKey, resumen);
    }
  } catch { /* sin config */ }

  const lista = leerRaw().map(a => {
    if (a.fechaTurno !== c.fecha) return a;
    if (a.destinatarioNombre === c.enfermo || a.destinatarioNombre === c.cubre) {
      return { ...a, whatsappIntentado: true };
    }
    return a;
  });
  guardarAvisosTurno(lista);

  return { abiertos, sinTelefono, admin };
}
