import { db } from '@/lib/database';

const NAV_HINT_KEY = 'dulceplacer_nav_prepedido_hint';

export async function enviarAlertaPreventistaPorWhatsApp(prov: { id: string; nombre: string }, diasRestantes: number): Promise<boolean> {
  const config = await db.getConfiguracion();
  const phone = (config?.telefonoNegocio ?? '').replace(/\D/g, '');
  if (!phone) {
    alert('No hay teléfono del negocio configurado. Ve a Configuración → Datos del Negocio para agregarlo.');
    return false;
  }

  const urgencia =
    diasRestantes <= 0 ? '🚨 HOY llega' :
    diasRestantes === 1 ? '🔔 MAÑANA llega' :
    `📅 En ${diasRestantes} días llega`;

  const msg =
    `${urgencia} el preventista de *${prov.nombre}*\n\n` +
    `¿Tienes el prepedido listo?\n\n` +
    `_Alerta automática — Panadería Dulce Placer_`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  return true;
}

export function guardarHintNavegacion(proveedorId: string) {
  localStorage.setItem(NAV_HINT_KEY, proveedorId);
}

export function leerYLimpiarHintNavegacion(): string | null {
  const hint = localStorage.getItem(NAV_HINT_KEY);
  if (hint) localStorage.removeItem(NAV_HINT_KEY);
  return hint;
}
