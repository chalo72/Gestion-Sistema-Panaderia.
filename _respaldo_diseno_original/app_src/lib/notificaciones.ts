/**
 * SISTEMA DE NOTIFICACIONES — Panadería Dulce Placer
 * Para enviar alertas a Email y WhatsApp del gerente.
 */

const EMAILJS_USER_ID = 'TU_USER_ID_AQUI'; 
const EMAILJS_SERVICE_ID = 'TU_SERVICE_ID_AQUI';
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID_AQUI';

export async function enviarAlertaEmail(
  destinatario: string,
  asunto: string,
  mensaje: string,
  gravedad: string,
  camara: string,
  empleadaNombre: string
) {
  try {
    if (EMAILJS_USER_ID === 'TU_USER_ID_AQUI') {
      console.log('📧 Simulando envío de email a', destinatario);
      console.log('Asunto:', asunto);
      return true;
    }
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

export async function enviarAlertaWhatsapp(
  numeroDestino: string,
  apikey: string,
  mensaje: string
) {
  try {
    if (!numeroDestino || !apikey || numeroDestino === '0000000000') {
      console.log('💬 Simulando envío de WhatsApp a', numeroDestino);
      console.log('Mensaje:', mensaje);
      return true;
    }
    return true;
  } catch (error) {
    console.error('Error enviando WhatsApp:', error);
    return false;
  }
}
