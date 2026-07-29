/**
 * Candados de vista — mismo mapa que el menú (Sidebar).
 * ADMIN siempre pasa (acceso del Director libre).
 */
import type { Permission, ViewType } from '@/types';

/** Permiso de acción requerido por vista (alineado a Sidebar.tsx) */
export const VISTA_PERMISO: Partial<Record<ViewType, Permission>> = {
  dashboard: 'VER_DASHBOARD',
  comunicaciones: 'VER_DASHBOARD',
  'agentes-ia': 'VER_DASHBOARD',
  videovigilancia: 'VER_DASHBOARD',
  ventas: 'VER_VENTAS',
  'historial-ventas': 'VER_VENTAS',
  caja: 'ABRIR_CERRAR_CAJA',
  clientes: 'VER_USUARIOS',
  creditos: 'VER_FINANZAS',
  produccion: 'VER_PRODUCTOS',
  recetas: 'VER_PRODUCTOS',
  inventario: 'VER_INVENTARIO',
  proveedores: 'VER_PROVEEDORES',
  prepedidos: 'VER_PREPEDIDOS',
  recepciones: 'VER_RECEPCIONES',
  precios: 'VER_PRECIOS',
  alertas: 'VER_ALERTAS',
  gastos: 'VER_FINANZAS',
  reportes: 'VER_FINANZAS',
  ahorro: 'VER_FINANZAS',
  mayoristas: 'VER_FINANZAS',
  boveda: 'VER_FINANZAS',
  inversiones: 'VER_FINANZAS',
  productos: 'VER_PRODUCTOS',
  cargamasiva: 'CREAR_PRODUCTOS',
  oficina: 'VER_USUARIOS',
  trabajadores: 'VER_USUARIOS',
  asistencia: 'VER_USUARIOS',
  nomina: 'VER_FINANZAS',
  usuarios: 'VER_USUARIOS',
  roles: 'VER_USUARIOS',
  seguridad: 'VER_FINANZAS',
  configuracion: 'VER_CONFIGURACION',
};

export type VistaGuardOpts = {
  isAdmin: boolean;
  role: string | null;
  check: (permission: Permission) => boolean;
  puedeVer: (rol: string, moduloId: string) => boolean;
};

/**
 * ¿Puede montarse esta vista?
 * - login: sí
 * - ADMIN: siempre sí
 * - resto: mismo criterio que el menú (permiso + puedeVer módulo)
 */
export const puedeAccederVista = (view: ViewType, opts: VistaGuardOpts): boolean => {
  if (view === 'login') return true;
  if (opts.isAdmin) return true;

  const permiso = VISTA_PERMISO[view];
  // Vistas sin mapa (ej. lista provincial): no bloquear por candado nuevo
  if (!permiso) return true;

  if (!opts.check(permiso)) return false;
  if (!opts.puedeVer(opts.role ?? '', view)) return false;
  return true;
};
