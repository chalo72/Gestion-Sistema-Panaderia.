/**
 * Marketing API - Puente de Webhooks
 * Conecta el ERP de Dulce Placer con servicios externos como Make.com o Zapier
 * para auto-publicar en redes sociales sin burocracia de Meta.
 */

export interface PublicacionRequest {
  redSocial: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'AVATAR';
  texto: string;
  imagenUrl?: string | null;
  estrategia: string;
}

// URL de tu Webhook en N8N (Open Source automatizador)
// Por defecto asume que N8N correrá en la misma red local en el puerto 5678.
const WEBHOOK_URL = localStorage.getItem('N8N_WEBHOOK_URL') || 'http://localhost:5678/webhook/dulce-placer-marketing';

export async function publicarEnRedSocial(datos: PublicacionRequest): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'DulcePlacerERP',
        timestamp: new Date().toISOString(),
        ...datos
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el Webhook: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Fallo al conectar con el motor de distribución:', error);
    throw error;
  }
}
