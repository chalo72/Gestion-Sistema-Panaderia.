import type { UserRole } from '@/types';
import { fechaLocalHoy } from '@/lib/finanzas-personales';

export interface TareaCheck {
  id: string;
  texto: string;
  icono: string;
  roles: UserRole[];
  momento: 'apertura' | 'cierre' | 'todo_el_dia';
}

export interface CompletadaKey {
  tareaId: string;
  usuarioId: string;
  fecha: string; // Formato YYYY-MM-DD
}

export const TAREAS_DEFAULT: TareaCheck[] = [
  { id: 'v1', texto: 'Prender la cafetera (¡lo primero! se demora calentando)', icono: '☕', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v2', texto: 'Barrer el local completo', icono: '🧹', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v3', texto: 'Trapear el piso', icono: '🪣', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v4', texto: 'Surtir las vitrinas con el pan', icono: '🥐', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v5', texto: 'Abrir caja y contar el dinero inicial', icono: '💵', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'v6', texto: 'Organizar sillas y mesas', icono: '🪑', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v7', texto: 'Limpiar mostrador y vitrinas (sin huellas)', icono: '✨', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v8', texto: 'Surtir gaseosas y bebidas en la nevera', icono: '🥤', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'apertura' },
  { id: 'v9',  texto: 'Atender a cada cliente con saludo cordial', icono: '👋', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'todo_el_dia' },
  { id: 'v10', texto: 'Registrar TODAS las ventas en el sistema', icono: '💻', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'todo_el_dia' },
  { id: 'v11', texto: 'Reponer pan cuando se esté acabando', icono: '🥖', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'todo_el_dia' },
  { id: 'v12', texto: 'Cuadrar caja y entregar dinero', icono: '💰', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN', 'GERENTE'], momento: 'cierre' },
  { id: 'v13', texto: 'Guardar el pan sobrante correctamente', icono: '🍞', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v14', texto: 'Barrer y trapear al cerrar', icono: '🧹', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v15', texto: 'Recoger y organizar las sillas', icono: '🪑', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'v16', texto: 'Apagar cafetera y equipos eléctricos', icono: '🔌', roles: ['VENDEDOR', 'AUXILIAR', 'ADMIN'], momento: 'cierre' },
  { id: 'p1', texto: 'Encender los hornos (precalentar)', icono: '🔥', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p2', texto: 'Revisar recetas del día y cantidades', icono: '📋', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p3', texto: 'Pesar y preparar los ingredientes', icono: '⚖️', roles: ['PANADERO', 'ADMIN'], momento: 'apertura' },
  { id: 'p4', texto: 'Conteo del pan del día anterior (sobrante)', icono: '🥐', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'apertura' },
  { id: 'p5', texto: 'Aseo del área de producción al iniciar', icono: '🧹', roles: ['PANADERO', 'ADMIN'], momento: 'apertura' },
  { id: 'p6', texto: 'Mantener área limpia durante producción', icono: '✨', roles: ['PANADERO', 'ADMIN'], momento: 'todo_el_dia' },
  { id: 'p7', texto: 'Llevar los panes terminados a la vitrina', icono: '🥖', roles: ['PANADERO', 'ADMIN'], momento: 'todo_el_dia' },
  { id: 'p8', texto: 'Apagar hornos y limpiar al cierre', icono: '🔌', roles: ['PANADERO', 'ADMIN'], momento: 'cierre' },
  { id: 'p9', texto: 'Inventario de insumos para el día siguiente', icono: '📝', roles: ['PANADERO', 'ADMIN', 'GERENTE'], momento: 'cierre' },
];

export const getCompletadasLocal = (): CompletadaKey[] => {
  try { return JSON.parse(localStorage.getItem('dp_checklist_completadas') || '[]'); } catch { return []; }
};

export const getTareasPendientesHoyString = (): string => {
  const completadas = getCompletadasLocal();
  const hoy = fechaLocalHoy();
  
  // Tareas de hoy (todas las que NO están completadas hoy por alguien)
  const tareasDeHoyCompletadasId = completadas.filter(c => c.fecha === hoy).map(c => c.tareaId);
  const pendientes = TAREAS_DEFAULT.filter(t => !tareasDeHoyCompletadasId.includes(t.id));

  if (pendientes.length === 0) return 'Todas las tareas del checklist de hoy están completadas.';
  
  return pendientes.map(p => "- " + p.texto).join(', ');
};

