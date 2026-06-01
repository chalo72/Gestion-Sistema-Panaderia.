import { db } from '@/lib/database';

const NAV_HINT_KEY = 'dulceplacer_nav_prepedido_hint';
const SENT_KEY = 'dp_wa_sent_v1';

// ─── Deduplicación por día ────────────────────────────────────────────────────

interface SentRecord {
  fecha: string;
  ids: string[];
}

function getSentToday(): string[] {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (!raw) return [];
    const rec: SentRecord = JSON.parse(raw);
    const hoy = new Date().toISOString().split('T')[0];
    return rec.fecha === hoy ? rec.ids : [];
  } catch { return []; }
}

function markSent(ids: string[]) {
  const hoy = new Date().toISOString().split('T')[0];
  const merged = [...new Set([...getSentToday(), ...ids])];
  localStorage.setItem(SENT_KEY, JSON.stringify({ fecha: hoy, ids: merged }));
}

// ─── Envío via CallMeBot ──────────────────────────────────────────────────────

async function callMeBot(phone: string, apiKey: string, text: string): Promise<boolean> {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  try {
    await fetch(url, { mode: 'no-cors' });
    return true;
  } catch {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = () => resolve(true);
      img.src = url;
      setTimeout(() => resolve(true), 4000);
    });
  }
}

// ─── Mensaje consolidado (varios proveedores) ─────────────────────────────────

export interface ProveedorAlerta {
  id: string;
  nombre: string;
  diasRestantes: number;
}

function buildMensaje(pendientes: ProveedorAlerta[]): string {
  const hoy      = pendientes.filter(p => p.diasRestantes <= 0);
  const manana   = pendientes.filter(p => p.diasRestantes === 1);
  const proximos = pendientes.filter(p => p.diasRestantes > 1);

  const lineas: string[] = [
    '🥖 *Panadería Dulce Placer*',
    '━━━━━━━━━━━━━━━━━━',
    '📦 *Alerta de Preventistas*',
    '',
  ];

  if (hoy.length > 0) {
    lineas.push('🚨 *HOY LLEGAN:*');
    hoy.forEach(p => lineas.push(`  • ${p.nombre}`));
    lineas.push('');
  }
  if (manana.length > 0) {
    lineas.push('🔔 *MAÑANA LLEGAN:*');
    manana.forEach(p => lineas.push(`  • ${p.nombre}`));
    lineas.push('');
  }
  if (proximos.length > 0) {
    lineas.push('📅 *PRÓXIMOS DÍAS:*');
    proximos.forEach(p => lineas.push(`  • ${p.nombre} (en ${p.diasRestantes} día${p.diasRestantes !== 1 ? 's' : ''})`));
    lineas.push('');
  }

  lineas.push('¿Están listos los prepedidos?');
  return lineas.join('\n');
}

// ─── Automático: se llama al montar Proveedores ───────────────────────────────
// Solo actúa si hay API key. Filtra los ya enviados hoy. Sin interacción del usuario.

export async function enviarAlertasAutomatico(alertas: ProveedorAlerta[]): Promise<void> {
  if (alertas.length === 0) return;
  const config = await db.getConfiguracion();
  const phone  = (config?.telefonoNegocio ?? '').replace(/\D/g, '');
  const apiKey = (config?.whatsappApiKey ?? '').trim();
  if (!phone || !apiKey) return;

  const pendientes = alertas.filter(a => !getSentToday().includes(a.id));
  if (pendientes.length === 0) return;

  const ok = await callMeBot(phone, apiKey, buildMensaje(pendientes));
  if (ok) markSent(pendientes.map(a => a.id));
}

// ─── Manual: botón en la alerta (todos los de la lista, sin filtrar) ──────────

export async function enviarAlertaManual(alertas: ProveedorAlerta[]): Promise<boolean> {
  const config = await db.getConfiguracion();
  const phone  = (config?.telefonoNegocio ?? '').replace(/\D/g, '');
  const apiKey = (config?.whatsappApiKey ?? '').trim();

  if (!phone) {
    alert('No hay teléfono del negocio configurado. Ve a Configuración → WhatsApp para agregarlo.');
    return false;
  }

  const msg = buildMensaje(alertas);

  if (apiKey) {
    await callMeBot(phone, apiKey, msg);
  } else {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }
  markSent(alertas.map(a => a.id));
  return true;
}

// ─── Legacy: compatibilidad con el botón individual existente ─────────────────

export async function enviarAlertaPreventistaPorWhatsApp(
  prov: { id: string; nombre: string },
  diasRestantes: number
): Promise<boolean> {
  return enviarAlertaManual([{ id: prov.id, nombre: prov.nombre, diasRestantes }]);
}

// ─── Hint de navegación ──────────────────────────────────────────────────────

export function guardarHintNavegacion(proveedorId: string) {
  localStorage.setItem(NAV_HINT_KEY, proveedorId);
}

export function leerYLimpiarHintNavegacion(): string | null {
  const hint = localStorage.getItem(NAV_HINT_KEY);
  if (hint) localStorage.removeItem(NAV_HINT_KEY);
  return hint;
}
