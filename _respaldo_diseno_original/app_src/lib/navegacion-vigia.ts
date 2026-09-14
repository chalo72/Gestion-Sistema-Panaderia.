/**
 * Vigía de navegación — registra visitas de módulo para Mando Superior → VIGÍA-APP.
 * No borra nada: solo alimenta la libreta dp_vigia_stats que ya existía.
 */
import { registrarVisitaModulo } from '@/components/agentes/VigiApp';
import type { ViewType } from '@/types';

const VISTA_A_MODULO: Partial<Record<ViewType, { ruta: string; nombre: string }>> = {
  dashboard: { ruta: '/dashboard', nombre: 'Centro de Mando' },
  comunicaciones: { ruta: '/comunicaciones', nombre: 'Equipo & Checklist' },
  'agentes-ia': { ruta: '/agentes-ia', nombre: 'Mando Superior (IA)' },
  videovigilancia: { ruta: '/videovigilancia', nombre: 'Videovigilancia' },
  cctv: { ruta: '/cctv', nombre: 'Auditoría Digital' },
  ventas: { ruta: '/ventas', nombre: 'Ventas' },
  'historial-ventas': { ruta: '/historial-ventas', nombre: 'Historial de Ventas' },
  caja: { ruta: '/caja', nombre: 'Caja' },
  clientes: { ruta: '/clientes', nombre: 'Clientes' },
  creditos: { ruta: '/creditos', nombre: 'Créditos' },
  produccion: { ruta: '/produccion', nombre: 'Producción' },
  recetas: { ruta: '/recetas', nombre: 'Recetas' },
  inventario: { ruta: '/inventario', nombre: 'Inventario' },
  proveedores: { ruta: '/proveedores', nombre: 'Proveedores' },
  prepedidos: { ruta: '/prepedidos', nombre: 'Órdenes de Compra' },
  recepciones: { ruta: '/recepciones', nombre: 'Recepciones' },
  precios: { ruta: '/precios', nombre: 'Precios' },
  alertas: { ruta: '/alertas', nombre: 'Alertas' },
  gastos: { ruta: '/gastos', nombre: 'Gastos' },
  reportes: { ruta: '/reportes', nombre: 'Reportes' },
  ahorro: { ruta: '/ahorro', nombre: 'Ahorros' },
  mayoristas: { ruta: '/mayoristas', nombre: 'Mayoristas' },
  boveda: { ruta: '/boveda', nombre: 'Bóveda' },
  trabajadores: { ruta: '/trabajadores', nombre: 'Nómina' },
  productos: { ruta: '/productos', nombre: 'Productos' },
  cargamasiva: { ruta: '/cargamasiva', nombre: 'Carga Masiva' },
  configuracion: { ruta: '/configuracion', nombre: 'Configuración' },
  seguridad: { ruta: '/seguridad', nombre: 'Seguridad' },
  nomina: { ruta: '/trabajadores', nombre: 'Nómina' },
  asistencia: { ruta: '/asistencia', nombre: 'Asistencia' },
};

/** Registra la visita del módulo actual (menú lateral u otras entradas). */
export function registrarVisitaVista(view: ViewType): void {
  const meta = VISTA_A_MODULO[view];
  if (!meta) {
    registrarVisitaModulo(`/${view}`, String(view));
    return;
  }
  registrarVisitaModulo(meta.ruta, meta.nombre);
}
