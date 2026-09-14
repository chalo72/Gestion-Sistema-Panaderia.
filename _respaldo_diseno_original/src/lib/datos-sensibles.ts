/**
 * Interruptores de datos sensibles (lenguaje claro para el Director).
 * Cada interruptor mapea a un Permission ya existente en la matriz de roles.
 */
import type { Permission } from '@/types';

export type DatoSensibleId =
  | 'costos'
  | 'margenes'
  | 'precio_venta'
  | 'totales_ventas'
  | 'finanzas_profundas';

export type DatoSensibleSwitch = {
  id: DatoSensibleId;
  /** Texto que ve el Director */
  label: string;
  /** Explicación corta */
  ayuda: string;
  /** Candado real del sistema */
  permission: Permission;
  /** Ejemplo de quién normalmente lo tiene OFF */
  tipOff?: string;
};

/** Lista fija de interruptores (Orden: lo más crítico primero). */
export const DATOS_SENSIBLES: DatoSensibleSwitch[] = [
  {
    id: 'costos',
    label: 'Ver costos de productos',
    ayuda: 'Precio de compra, costo de recetas y “mejor costo”. Si está apagado, no se muestran números de costo.',
    permission: 'VER_PRECIO_COSTO',
    tipOff: 'Recomendado OFF para Panadero y Vendedor',
  },
  {
    id: 'margenes',
    label: 'Ver márgenes y utilidad',
    ayuda: 'Porcentajes de rentabilidad, utilidad bruta y comparaciones de margen.',
    permission: 'VER_MARGEN',
    tipOff: 'Recomendado OFF para Panadero y Vendedor',
  },
  {
    id: 'precio_venta',
    label: 'Ver precio de venta',
    ayuda: 'Cuánto se cobra al cliente (PVP). Útil para quien atiende la caja o consulta precios.',
    permission: 'VER_PRECIO_VENTA',
    tipOff: 'Normalmente ON para Vendedor',
  },
  {
    id: 'totales_ventas',
    label: 'Ver totales de ventas (día / KPIs)',
    ayuda: 'Ingresos del día, ticket promedio y tarjetas de estadísticas del tablero.',
    permission: 'VER_ESTADISTICAS',
    tipOff: 'Recomendado OFF para Panadero',
  },
  {
    id: 'finanzas_profundas',
    label: 'Ver finanzas profundas (quincena / mes / bóveda)',
    ayuda: 'Quincena, bóveda, compromisos, utilidades del mes/año y análisis financiero completo. Sin esto, Reportes queda como Libreta del Horno.',
    permission: 'VER_FINANZAS',
    tipOff: 'Solo ADMIN / GERENTE normalmente',
  },
];

/** Etiquetas amigables para la matriz técnica de permisos. */
export const PERMISSION_LABEL_ES: Partial<Record<Permission, string>> = {
  VER_PRECIO_COSTO: 'Ver costos de productos',
  VER_MARGEN: 'Ver márgenes y utilidad',
  VER_PRECIO_VENTA: 'Ver precio de venta',
  VER_PRECIOS: 'Entrar a historial de costos',
  EDITAR_PRECIOS: 'Editar precios / costos',
  VER_ESTADISTICAS: 'Ver totales / KPIs de ventas',
  VER_FINANZAS: 'Ver finanzas profundas',
  VER_REPORTES: 'Entrar a Reportes / Libreta',
  VER_PRODUCTOS: 'Ver catálogo de productos',
  VER_PRODUCCION: 'Ver producción',
  GESTIONAR_PRODUCCION: 'Gestionar producción',
  VER_VENTAS: 'Ver ventas / POS',
  GESTIONAR_VENTAS: 'Gestionar ventas',
  ABRIR_CERRAR_CAJA: 'Abrir / cerrar caja',
  VER_INVENTARIO: 'Ver inventario',
  GESTIONAR_INVENTARIO: 'Gestionar inventario',
  VER_DASHBOARD: 'Ver centro de mando',
};
