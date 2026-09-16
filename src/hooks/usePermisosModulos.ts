import { useState, useEffect } from 'react';

export const PERMISOS_KEY = 'dp_permisos_modulos_v1';

export interface ModuloPermiso {
  ver: boolean;
  eliminar: boolean;
}

export type PermisosRol = Record<string, ModuloPermiso>;
export type PermisosModulos = Record<string, PermisosRol>;

export interface ModuloInfo {
  id: string;
  label: string;
  seccion: string;
}

export const MODULOS_CONFIGURABLES: ModuloInfo[] = [
  { id: 'dashboard',        label: 'Centro de Mando',       seccion: 'General' },
  { id: 'comunicaciones',   label: 'Equipo & Checklist',    seccion: 'General' },
  { id: 'agentes-ia',       label: 'Mando Superior (IA)',   seccion: 'General' },
  { id: 'videovigilancia',  label: 'Videovigilancia',       seccion: 'General' },
  { id: 'cctv',             label: 'Auditoría Digital (CCTV)', seccion: 'General' },
  { id: 'whatsapp-hub',     label: 'Comandos WhatsApp & IA',   seccion: 'General' },
  { id: 'ventas',           label: 'Ventas / POS',           seccion: 'Ventas' },
  { id: 'historial-ventas', label: 'Historial de Ventas',   seccion: 'Ventas' },
  { id: 'caja',             label: 'Control de Caja',        seccion: 'Ventas' },
  { id: 'clientes',         label: 'Gestión de Clientes',   seccion: 'Ventas' },
  { id: 'creditos',         label: 'Créditos a Clientes',   seccion: 'Ventas' },
  { id: 'mayoristas',       label: 'Ventas al Mayor',        seccion: 'Ventas' },
  { id: 'produccion',       label: 'Producción de Pan',     seccion: 'Producción' },
  { id: 'recetas',          label: 'Recetas',                seccion: 'Producción' },
  { id: 'inventario',       label: 'Inventario',             seccion: 'Producción' },
  { id: 'proveedores',      label: 'Proveedores',            seccion: 'Compras' },
  { id: 'prepedidos',       label: 'Órdenes de Compra',     seccion: 'Compras' },
  { id: 'recepciones',      label: 'Entrada de Mercancía',  seccion: 'Compras' },
  { id: 'productos',        label: 'Productos',              seccion: 'Catálogo' },
  { id: 'cargamasiva',      label: 'Carga Masiva',           seccion: 'Catálogo' },
  { id: 'precios',          label: 'Historial de Costos',   seccion: 'Finanzas' },
  { id: 'alertas',          label: 'Alertas de Costos',     seccion: 'Finanzas' },
  { id: 'gastos',           label: 'Egresos y Facturas',    seccion: 'Finanzas' },
  { id: 'boveda',           label: 'Bóveda / Tesorería',    seccion: 'Finanzas' },
  { id: 'inversiones',      label: 'Inversión y Crecimiento', seccion: 'Finanzas' },
  { id: 'reportes',         label: 'Análisis Financiero',   seccion: 'Finanzas' },
  { id: 'ahorro',           label: 'Mis Ahorros',            seccion: 'Finanzas' },
  { id: 'trabajadores',     label: 'Trabajadores',           seccion: 'Admin' },
  { id: 'expedientes',      label: 'Expediente Empleadas',   seccion: 'Admin' },
  { id: 'asistencia',       label: 'Asistencia',             seccion: 'Admin' },
  { id: 'nomina',           label: 'Nómina',                 seccion: 'Admin' },
];

export const ROLES_CONFIGURABLES = [
  { id: 'GERENTE',            label: 'Gerente',            color: 'bg-violet-500' },
  { id: 'CONTROL_FINANCIERO', label: 'Control Financiero', color: 'bg-sky-500' },
  { id: 'COMPRADOR',          label: 'Comprador',          color: 'bg-blue-500' },
  { id: 'VENDEDOR',           label: 'Vendedor',           color: 'bg-emerald-500' },
  { id: 'PANADERO',           label: 'Panadero',           color: 'bg-amber-500' },
  { id: 'AUXILIAR',           label: 'Auxiliar',           color: 'bg-slate-500' },
];

const VER_VENDEDOR   = ['dashboard','ventas','historial-ventas','caja','creditos','clientes','productos','asistencia','whatsapp-hub','inventario'];
const VER_COMPRADOR  = ['dashboard','proveedores','prepedidos','recepciones','inventario','productos','precios','alertas','asistencia'];
const VER_CONTROL_FINANCIERO = [
  'dashboard',
  'caja',
  'boveda',
  'gastos',
  'nomina',
  'creditos',
  'proveedores',
  'prepedidos',
  'recepciones',
  'reportes',
  'precios',
  'alertas',
  'ahorro',
  'inversiones',
  'trabajadores',
  'expedientes',
  'historial-ventas',
  'ventas',
  'clientes',
  'asistencia',
  'whatsapp-hub',
];
const VER_PANADERO   = ['dashboard','produccion','recetas','inventario','reportes','asistencia','whatsapp-hub'];
const VER_AUXILIAR   = ['dashboard','ventas','asistencia'];
const TODOS          = MODULOS_CONFIGURABLES.map(m => m.id);

function defaultParaRol(ids: string[]): PermisosRol {
  return Object.fromEntries(
    MODULOS_CONFIGURABLES.map(m => [m.id, { ver: ids.includes(m.id), eliminar: false }])
  );
}

const DEFAULT_PERMISOS: PermisosModulos = {
  GERENTE:            Object.fromEntries(MODULOS_CONFIGURABLES.map(m => [m.id, { ver: true, eliminar: true }])),
  CONTROL_FINANCIERO: defaultParaRol(VER_CONTROL_FINANCIERO),
  COMPRADOR:          defaultParaRol(VER_COMPRADOR),
  VENDEDOR:           defaultParaRol(VER_VENDEDOR),
  PANADERO:           defaultParaRol(VER_PANADERO),
  AUXILIAR:           defaultParaRol(VER_AUXILIAR),
};

/** Parche único: el menú de módulos ocultaba Reportes al Panadero aunque la matriz ya lo permitía. */
const PATCH_PANADERO_REPORTES = 'dp_patch_panadero_reportes_20260810';
/** Parche: Rol Control Financiero y módulos Bóveda/Inversiones */
const PATCH_CONTROL_FINANCIERO = 'dp_patch_control_financiero_20260913';
/** Parche: WhatsApp Hub y Asistencia rápida para todos los roles clave */
const PATCH_WHATSAPP_HUB = 'dp_patch_whatsapp_hub_20260913_v2';
/** Parche: Vendedor gana acceso a Inventario (para inventariar desde el celular) */
const PATCH_VENDEDOR_INVENTARIO = 'dp_patch_vendedor_inventario_20260915';

// ─── Persistencia ────────────────────────────────────────────────────────────

export function cargarPermisos(): PermisosModulos {
  try {
    const raw = localStorage.getItem(PERMISOS_KEY);
    if (raw) {
      let parsed = JSON.parse(raw) as PermisosModulos;
      let changed = false;

      if (!localStorage.getItem(PATCH_PANADERO_REPORTES)) {
        parsed = {
          ...parsed,
          PANADERO: {
            ...(parsed.PANADERO || DEFAULT_PERMISOS.PANADERO),
            reportes: {
              ver: true,
              eliminar: parsed.PANADERO?.reportes?.eliminar ?? false,
            },
          },
        };
        localStorage.setItem(PATCH_PANADERO_REPORTES, '1');
        changed = true;
      }

      if (!localStorage.getItem(PATCH_CONTROL_FINANCIERO) || !parsed.CONTROL_FINANCIERO) {
        parsed = {
          ...parsed,
          CONTROL_FINANCIERO: {
            ...defaultParaRol(VER_CONTROL_FINANCIERO),
            ...(parsed.CONTROL_FINANCIERO || {}),
          },
          // Asegurar que Gerente tenga boveda e inversiones
          GERENTE: {
            ...(parsed.GERENTE || DEFAULT_PERMISOS.GERENTE),
            boveda: { ver: true, eliminar: true },
            inversiones: { ver: true, eliminar: true },
          },
        };
        localStorage.setItem(PATCH_CONTROL_FINANCIERO, '1');
        changed = true;
      }

      if (!localStorage.getItem(PATCH_WHATSAPP_HUB)) {
        parsed = {
          ...parsed,
          GERENTE: {
            ...(parsed.GERENTE || DEFAULT_PERMISOS.GERENTE),
            'whatsapp-hub': { ver: true, eliminar: true },
            'asistencia': { ver: true, eliminar: true },
            'expedientes': { ver: true, eliminar: true },
          },
          CONTROL_FINANCIERO: {
            ...(parsed.CONTROL_FINANCIERO || DEFAULT_PERMISOS.CONTROL_FINANCIERO),
            'whatsapp-hub': { ver: true, eliminar: false },
            'asistencia': { ver: true, eliminar: false },
            'expedientes': { ver: true, eliminar: false },
          },
          VENDEDOR: {
            ...(parsed.VENDEDOR || DEFAULT_PERMISOS.VENDEDOR),
            'whatsapp-hub': { ver: true, eliminar: false },
            'asistencia': { ver: true, eliminar: false },
          },
          PANADERO: {
            ...(parsed.PANADERO || DEFAULT_PERMISOS.PANADERO),
            'whatsapp-hub': { ver: true, eliminar: false },
            'asistencia': { ver: true, eliminar: false },
          },
          COMPRADOR: {
            ...(parsed.COMPRADOR || DEFAULT_PERMISOS.COMPRADOR),
            'asistencia': { ver: true, eliminar: false },
          },
          AUXILIAR: {
            ...(parsed.AUXILIAR || DEFAULT_PERMISOS.AUXILIAR),
            'asistencia': { ver: true, eliminar: false },
          },
        };
        localStorage.setItem(PATCH_WHATSAPP_HUB, '1');
        changed = true;
      }

      if (!localStorage.getItem(PATCH_VENDEDOR_INVENTARIO)) {
        parsed = {
          ...parsed,
          VENDEDOR: {
            ...(parsed.VENDEDOR || DEFAULT_PERMISOS.VENDEDOR),
            'inventario': { ver: true, eliminar: false },
          },
        };
        localStorage.setItem(PATCH_VENDEDOR_INVENTARIO, '1');
        changed = true;
      }

      if (changed) {
        localStorage.setItem(PERMISOS_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {}
  return DEFAULT_PERMISOS;
}

export function guardarPermisos(permisos: PermisosModulos) {
  localStorage.setItem(PERMISOS_KEY, JSON.stringify(permisos));
  window.dispatchEvent(new Event('dp_permisos_changed'));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePermisosModulos() {
  const [permisos, setPermisos] = useState<PermisosModulos>(cargarPermisos);

  useEffect(() => {
    const sync = () => setPermisos(cargarPermisos());
    window.addEventListener('storage', sync);
    window.addEventListener('dp_permisos_changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('dp_permisos_changed', sync);
    };
  }, []);

  const puedeVer = (rol: string, moduloId: string): boolean => {
    if (!rol || rol === 'ADMIN') return true;
    return permisos[rol]?.[moduloId]?.ver ?? true;
  };

  const puedeEliminar = (rol: string, moduloId: string): boolean => {
    if (!rol || rol === 'ADMIN') return true;
    return permisos[rol]?.[moduloId]?.eliminar ?? false;
  };

  return { permisos, puedeVer, puedeEliminar };
}
