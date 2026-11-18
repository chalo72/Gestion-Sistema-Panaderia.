/**
 * DATOS DE CONTACTO DEL NEGOCIO — Dulce Placer
 * Creado 2026-09-20.
 *
 * Guarda el WhatsApp de pedidos y el enlace del negocio, y arma el mensaje de
 * cierre que va al final de cada publicación.
 *
 * POR QUÉ ESTO IMPORTA: la IA tiene prohibido inventar teléfonos, direcciones o
 * enlaces (esa regla evitó que publicara datos falsos). Entonces el número no lo
 * escribe la IA: se toma de aquí, donde lo registró el dueño, y se pega al final
 * tal cual. Así el dato siempre es real y siempre es el mismo.
 */

const CLAVE = 'DP_CONFIG_NEGOCIO';

export interface ConfigNegocio {
  /** Número de WhatsApp para pedidos, solo dígitos. Ej: 3001234567 */
  whatsapp: string;
  /** Indicativo del país. Colombia = 57 */
  indicativo: string;
  /** Enlace opcional (página, catálogo, YouTube de Andrea…) */
  enlace: string;
  /** Plantilla del cierre. Admite {whatsapp}, {link} y {enlace}. */
  mensajeCierre: string;
  /** Si se pega o no al final de cada publicación. */
  incluirCierre: boolean;
}

export const CONFIG_POR_DEFECTO: ConfigNegocio = {
  whatsapp: '',
  indicativo: '57',
  enlace: '',
  mensajeCierre: '📲 Pide el tuyo por WhatsApp: {whatsapp}',
  incluirCierre: true,
};

export function getConfigNegocio(): ConfigNegocio {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return { ...CONFIG_POR_DEFECTO };
    return { ...CONFIG_POR_DEFECTO, ...JSON.parse(guardado) };
  } catch {
    return { ...CONFIG_POR_DEFECTO };
  }
}

export function setConfigNegocio(config: ConfigNegocio): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(config)); } catch { /* nada */ }
}

/** Deja el número solo con dígitos. */
export function limpiarNumero(valor: string): string {
  return (valor || '').replace(/\D/g, '');
}

/** Muestra el número bonito: 300 123 4567 */
export function formatearWhatsapp(numero: string): string {
  const n = limpiarNumero(numero);
  if (n.length === 10) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  return n;
}

/** Enlace de WhatsApp que abre el chat directo, con mensaje opcional. */
export function enlaceWhatsapp(config: ConfigNegocio, mensaje?: string): string {
  const n = limpiarNumero(config.whatsapp);
  if (!n) return '';
  const completo = n.startsWith(config.indicativo) ? n : `${config.indicativo}${n}`;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${completo}${texto}`;
}

/**
 * Arma el mensaje de cierre listo para pegar al final de la publicación.
 * Devuelve cadena vacía si no hay número ni enlace, o si está desactivado.
 */
export function construirCierre(config: ConfigNegocio): string {
  if (!config.incluirCierre) return '';
  const tieneWhats = !!limpiarNumero(config.whatsapp);
  if (!tieneWhats && !config.enlace) return '';

  let cierre = config.mensajeCierre || CONFIG_POR_DEFECTO.mensajeCierre;
  cierre = cierre
    .replace(/\{whatsapp\}/g, tieneWhats ? formatearWhatsapp(config.whatsapp) : '')
    .replace(/\{link\}/g, tieneWhats ? enlaceWhatsapp(config) : '')
    .replace(/\{enlace\}/g, config.enlace || '');

  // Si hay enlace y la plantilla no lo menciona, se agrega en su propio renglón.
  if (config.enlace && !cierre.includes(config.enlace)) {
    cierre += `\n🔗 ${config.enlace}`;
  }
  return cierre.replace(/\n{3,}/g, '\n\n').trim();
}

/** Pega el cierre al final del texto, sin repetirlo si ya está. */
export function agregarCierre(texto: string, config: ConfigNegocio): string {
  const cierre = construirCierre(config);
  const base = (texto || '').trim();
  if (!cierre) return base;
  if (base.includes(cierre)) return base;
  return `${base}\n\n${cierre}`;
}
