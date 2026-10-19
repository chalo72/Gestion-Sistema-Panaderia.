/**
 * Texto de la pantalla "Error Crítico de Inicio" (src/main.tsx).
 *
 * Antes solo decía "La base de datos local no pudo iniciar, recarga la página", sin la causa
 * real ni qué hacer. Aquí se traduce el error de IndexedDB a una causa visible y un consejo
 * concreto. Es una función pura para poder probarla sin abrir un navegador.
 */
export interface ErrorInicio {
  /** Mensaje técnico real, para que se pueda reportar tal cual. */
  causa: string;
  /** Qué hacer, en lenguaje simple. */
  consejo: string;
}

export const AVISO_NO_BORRAR_DATOS =
  'No borres los datos del sitio ni el historial del navegador: ahí está lo que aún no se ha subido a la nube.';

export function describirErrorInicio(err: unknown): ErrorInicio {
  const nombre = String((err as { name?: unknown } | null)?.name ?? '');
  const mensaje = String((err as { message?: unknown } | null)?.message ?? err ?? '').trim();
  const causa = mensaje || nombre || 'Error desconocido';
  const texto = `${nombre} ${mensaje}`.toLowerCase();

  if (texto.includes('no respondi') || texto.includes('blocked') || texto.includes('bloquead')) {
    return {
      causa,
      consejo:
        'Hay otra pestaña o ventana de la app abierta (también la app instalada) que mantiene ocupada la base de datos. Ciérralas todas y pulsa Reintentar.',
    };
  }
  if (texto.includes('quota') || texto.includes('espacio') || texto.includes('full')) {
    return {
      causa,
      consejo:
        'El dispositivo se quedó sin espacio de almacenamiento. Libera espacio (fotos, descargas, otras apps) y pulsa Reintentar.',
    };
  }
  if (
    texto.includes('securityerror') ||
    texto.includes('invalidstateerror') ||
    texto.includes('private') ||
    texto.includes('privado') ||
    texto.includes('denied')
  ) {
    return {
      causa,
      consejo:
        'El navegador no deja guardar datos en este modo (¿ventana de incógnito o privada?). Abre la app en una ventana normal y pulsa Reintentar.',
    };
  }
  return {
    causa,
    consejo:
      'Cierra otras pestañas o ventanas de la app y pulsa Reintentar. Si sigue igual, avísale a soporte con el mensaje de arriba.',
  };
}
