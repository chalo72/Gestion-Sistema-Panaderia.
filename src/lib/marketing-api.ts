/**
 * Marketing API - Puente de Webhooks y Automatización N8N
 * Conecta el ERP de Dulce Placer con servicios de automatización (N8N, Make, Zapier)
 * para auto-publicar en redes sociales y procesar contenido multimedia.
 */

export interface PublicacionRequest {
  redSocial: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'AVATAR';
  texto: string;
  imagenUrl?: string | null;
  estrategia: string;
}

export interface VideoProductionRequest {
  videoNombre?: string;
  videoDataUrl?: string | null;
  extraerSubtitulos: boolean;
  generarThumbnail: boolean;
  incluirLogo: boolean;
  estrategia: string;
}

const DEFAULT_WEBHOOK_URL = 'http://localhost:5678/webhook/dulce-placer-marketing';
const STORAGE_KEY = 'N8N_WEBHOOK_URL';

export function getWebhookUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_WEBHOOK_URL;
}

export function setWebhookUrl(url: string): void {
  if (!url || url.trim() === '') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, url.trim());
  }
}

export async function testWebhookConnection(url?: string): Promise<{ success: boolean; message: string }> {
  const targetUrl = url || getWebhookUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        action: 'ping',
        source: 'DulcePlacerERP_Test',
        timestamp: new Date().toISOString()
      }),
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status === 200 || response.status === 204) {
      return { success: true, message: 'Webhook conectado y respondiendo correctamente.' };
    }
    return { success: false, message: `El Webhook respondió con código: ${response.status} ${response.statusText}` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Tiempo de espera agotado (Timeout > 5s). Verifica que N8N esté encendido.' };
    }
    return { success: false, message: err.message || 'No se pudo contactar al servidor N8N / Webhook.' };
  }
}

export async function publicarEnRedSocial(datos: PublicacionRequest): Promise<boolean> {
  const targetUrl = getWebhookUrl();
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'publish_social',
        source: 'DulcePlacerERP',
        timestamp: new Date().toISOString(),
        ...datos
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el Webhook (${response.status}): ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Fallo al conectar con el motor de distribución N8N:', error);
    throw error;
  }
}

export async function enviarVideoAN8N(datos: VideoProductionRequest): Promise<boolean> {
  const targetUrl = getWebhookUrl();
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'process_video_factory',
        source: 'DulcePlacerERP',
        timestamp: new Date().toISOString(),
        ...datos
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el Webhook de Video (${response.status}): ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Fallo al enviar el video a la Fábrica N8N:', error);
    throw error;
  }
}
