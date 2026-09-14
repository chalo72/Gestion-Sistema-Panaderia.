/**
 * Bitácora de ingresos al sistema (login / logout / fallos).
 * Persistencia local — offline-first.
 */
import { generateUUID } from '@/lib/safe-utils';
import { getDeviceId } from '@/lib/deviceId';
import type { UserRole } from '@/types';

const STORAGE_KEY = 'dp_login_auditoria';
const MAX_EVENTOS = 2000;

export type TipoEventoLogin =
  | 'login_ok'
  | 'login_fallo'
  | 'logout'
  | 'usuario_inactivo';

export interface EventoLoginAuditoria {
  id: string;
  tipo: TipoEventoLogin;
  usuarioId?: string;
  email: string;
  nombre?: string;
  rol?: UserRole;
  exito: boolean;
  motivo?: string;
  fecha: string;
  deviceId: string;
  userAgent: string;
}

function leerEventos(): EventoLoginAuditoria[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EventoLoginAuditoria[]) : [];
  } catch {
    return [];
  }
}

function guardarEventos(eventos: EventoLoginAuditoria[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos.slice(0, MAX_EVENTOS)));
}

export function getEventosLoginAuditoria(): EventoLoginAuditoria[] {
  return leerEventos();
}

export function registrarEventoLogin(params: {
  tipo: TipoEventoLogin;
  email: string;
  exito: boolean;
  usuarioId?: string;
  nombre?: string;
  rol?: UserRole;
  motivo?: string;
}): EventoLoginAuditoria {
  const evento: EventoLoginAuditoria = {
    id: generateUUID(),
    tipo: params.tipo,
    usuarioId: params.usuarioId,
    email: params.email.toLowerCase().trim(),
    nombre: params.nombre,
    rol: params.rol,
    exito: params.exito,
    motivo: params.motivo,
    fecha: new Date().toISOString(),
    deviceId: getDeviceId(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
  };
  const todos = leerEventos();
  guardarEventos([evento, ...todos]);
  return evento;
}

export function limpiarEventosLoginAntiguos(dias = 90): number {
  const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
  const antes = leerEventos();
  const filtrados = antes.filter((e) => new Date(e.fecha).getTime() >= corte);
  guardarEventos(filtrados);
  return antes.length - filtrados.length;
}

export function etiquetaTipoEventoLogin(tipo: TipoEventoLogin): string {
  switch (tipo) {
    case 'login_ok':
      return 'Ingreso exitoso';
    case 'login_fallo':
      return 'PIN incorrecto';
    case 'logout':
      return 'Cierre de sesión';
    case 'usuario_inactivo':
      return 'Usuario inactivo';
    default:
      return tipo;
  }
}
