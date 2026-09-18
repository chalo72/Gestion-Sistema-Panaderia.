export interface N8NCampaignPayload {
  productoId: string;
  nombreProducto: string;
  estrategia: string;
  imagenBase64: string | null;
  textosGenerados: {
    instagram?: string;
    tiktok?: string;
    whatsapp?: string;
    avatarPrompt?: string;
  };
  tendenciasVirales: any[];
}

/**
 * URL del Webhook de N8N.
 * Por ahora apuntará a localhost. Cuando instales N8N, cambiaremos esta URL
 * por la dirección real de tu servidor N8N.
 */
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/dulce-placer-marketing';

export async function enviarCampanaAN8N(payload: N8NCampaignPayload): Promise<boolean> {
  console.log('[N8N] Preparando paquete de campaña para enviar al servidor automatizador...', payload);
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        origen: 'ERP_DULCE_PLACER',
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      console.warn('[N8N] El servidor N8N no respondió correctamente. ¿Está encendido?');
      return false;
    }

    console.log('[N8N] ¡Campaña enviada con éxito a N8N!');
    return true;
  } catch (error) {
    console.warn('[N8N] No se pudo conectar con N8N. Asegúrate de tenerlo instalado y corriendo.', error);
    // Lanzamos el error para que la UI lo atrape y le avise a Gonzalo
    throw new Error('N8N_NOT_REACHABLE');
  }
}
