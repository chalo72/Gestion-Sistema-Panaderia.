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
  { id: 'reportes',         label: 'Análisis Financiero',   seccion: 'Finanzas' },
  { id: 'ahorro',           label: 'Mis Ahorros',            seccion: 'Finanzas' },
  { id: 'trabajadores',     label: 'Trabajadores',           seccion: 'Admin' },
  { id: 'asistencia',       label: 'Asistencia',             seccion: 'Admin' },
  { id: 'nomina',           label: 'Nómina',                 seccion: 'Admin' },
];

export const ROLES_CONFIGURABLES = [
  { id: 'GERENTE',   label: 'Gerente',   color: 'bg-violet-500' },
  { id: 'COMPRADOR', label: 'Comprador', color: 'bg-blue-500' },
  { id: 'VENDEDOR',  label: 'Vendedor',  color: 'bg-emerald-500' },
  { id: 'PANADERO',  label: 'Panadero',  color: 'bg-amber-500' },
  { id: 'AUXILIAR',  label: 'Auxiliar',  color: 'bg-slate-500' },
];

const VER_VENDEDOR   = ['dashboard','ventas','historial-ventas','caja','creditos','clientes','productos'];
const VER_COMPRADOR  = ['dashboard','proveedores','prepedidos','recepciones','inventario','productos','precios','alertas'];
const VER_PANADERO   = ['dashboard','produccion','recetas','inventario'];
const VER_AUXILIAR   = ['dashboard','ventas'];
const TODOS          = MODULOS_CONFIGURABLES.map(m => m.id);

function defaultParaRol(ids: string[]): PermisosRol {
  return Object.fromEntries(
    MODULOS_CONFIGURABLES.map(m => [m.id, { ver: ids.includes(m.id), eliminar: false }])
  );
}

const DEFAULT_PERMISOS: PermisosModulos = {
  GERENTE:   Object.fromEntries(MODULOS_CONFIGURABLES.map(m => [m.id, { ver: true, eliminar: true }])),
  COMPRADOR: defaultParaRol(VER_COMPRADOR),
  VENDEDOR:  defaultParaRol(VER_VENDEDOR),
  PANADERO:  defaultParaRol(VER_PANADERO),
  AUXILIAR:  defaultParaRol(VER_AUXILIAR),
};

// ─── Persistencia ────────────────────────────────────────────────────────────

export function cargarPermisos(): PermisosModulos {
  try {
    const raw = localStorage.getItem(PERMISOS_KEY);
    if (raw) return JSON.parse(raw) as PermisosModulos;
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
