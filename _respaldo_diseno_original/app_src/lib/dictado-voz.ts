/**
 * Utilidades de dictado por voz — Web Speech API (es-CO).
 * Evita cortes: acumula resultados finales y muestra interim aparte.
 */

export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: { error: string }) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionResultEvent) => void) | null;
}

export interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface TranscriptAcumulado {
  /** Texto confirmado por el motor (no se pierde) */
  final: string;
  /** Lo que aún está procesando (puede cambiar) */
  interim: string;
  /** final + interim para mostrar en pantalla */
  completo: string;
  /** Solo el tramo nuevo que acaba de confirmarse */
  segmentoFinalNuevo: string;
}

const MAP_NUMEROS: Record<string, string> = {
  cero: '0',
  un: '1',
  uno: '1',
  una: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
  diez: '10',
  once: '11',
  doce: '12',
  docena: '12',
  trece: '13',
  catorce: '14',
  quince: '15',
  dieciseis: '16',
  dieciséis: '16',
  diecisiete: '17',
  dieciocho: '18',
  diecinueve: '19',
  veinte: '20',
  veintiun: '21',
  veintiuno: '21',
  veintiuna: '21',
  veintidos: '22',
  veintidós: '22',
  veintitres: '23',
  veintitrés: '23',
  veinticuatro: '24',
  veinticinco: '25',
  veintiseis: '26',
  veintiséis: '26',
  veintisiete: '27',
  veintiocho: '28',
  veintinueve: '29',
  treinta: '30',
  cuarenta: '40',
  cincuenta: '50',
  sesenta: '60',
  setenta: '70',
  ochenta: '80',
  noventa: '90',
  cien: '100',
  ciento: '100',
  doscientos: '200',
  doscientas: '200',
  trescientos: '300',
  cuatrocientos: '400',
  quinientos: '500',
  seiscientos: '600',
  setecientos: '700',
  ochocientos: '800',
  novecientos: '900',
  // "mil" NO va aquí: se maneja abajo con "2 mil" → 2000 / "mil" solo → 1000
};

/** Obtiene el constructor de SpeechRecognition del navegador */
export function obtenerSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Acumula transcript correctamente desde resultIndex.
 * Los resultados finales no se pierden; el interim no pisa el inicio.
 */
export function extraerTranscriptDesdeEvento(
  event: SpeechRecognitionResultEvent,
  acumuladoFinalPrevio: string
): TranscriptAcumulado {
  let segmentoFinalNuevo = '';
  let interim = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const pieza = (result[0]?.transcript ?? '').trim();
    if (!pieza) continue;

    if (result.isFinal) {
      segmentoFinalNuevo = segmentoFinalNuevo
        ? `${segmentoFinalNuevo} ${pieza}`
        : pieza;
    } else {
      interim = interim ? `${interim} ${pieza}` : pieza;
    }
  }

  const final = segmentoFinalNuevo
    ? `${acumuladoFinalPrevio} ${segmentoFinalNuevo}`.replace(/\s+/g, ' ').trim()
    : acumuladoFinalPrevio.trim();

  const completo = interim
    ? `${final} ${interim}`.replace(/\s+/g, ' ').trim()
    : final;

  return { final, interim, completo, segmentoFinalNuevo };
}

/** Convierte números en palabras y limpia espacios del dictado */
export function normalizarTranscriptDictado(texto: string): string {
  let s = (texto || '')
    .replace(/(\d),(\d)/g, '$1$2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Variantes orales frecuentes del motor (Chrome a veces suelta mayúsculas o guiones)
  s = s
    .replace(/\bveinti[\s-]?un[oa]?\b/gi, '21')
    .replace(/\bveinti[\s-]?dos\b/gi, '22')
    .replace(/\bveinti[\s-]?tres\b/gi, '23')
    .replace(/\bveinti[\s-]?cuatro\b/gi, '24')
    .replace(/\bveinti[\s-]?cinco\b/gi, '25')
    .replace(/\bveinti[\s-]?seis\b/gi, '26')
    .replace(/\bveinti[\s-]?siete\b/gi, '27')
    .replace(/\bveinti[\s-]?ocho\b/gi, '28')
    .replace(/\bveinti[\s-]?nueve\b/gi, '29');

  const ordenado = Object.entries(MAP_NUMEROS).sort((a, b) => b[0].length - a[0].length);
  for (const [palabra, digito] of ordenado) {
    const norm = palabra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // \b falla a veces con Unicode; usamos bordes de letra/dígito explícitos
    s = s.replace(new RegExp(`(^|[^a-z0-9])${norm}(?=[^a-z0-9]|$)`, 'gi'), `$1${digito}`);
  }

  // "30 y 5" / "veinte y tres" residuales → 35 / 23
  s = s.replace(/\b(\d{1,2})\s+y\s+(\d)\b/gi, (_, a: string, b: string) =>
    String(parseInt(a, 10) + parseInt(b, 10)),
  );

  // "15 mil" / "2 mil" / "50 mil" → montos colombianos
  s = s.replace(/\b(\d{1,3})\s*mil\b/gi, (_, n: string) => String(parseInt(n, 10) * 1000));
  // "mil" solo al inicio de monto → 1000
  s = s.replace(/(^|[^0-9])mil(?=[^0-9]|$)/gi, '$11000');

  return s.replace(/\s+/g, ' ').trim();
}

/** Para mostrar en pantalla mientras dicta (números ya convertidos). */
export function transcriptParaPantalla(final: string, interim: string): string {
  const base = interim
    ? `${final} ${interim}`.replace(/\s+/g, ' ').trim()
    : (final || '').trim();
  return normalizarTranscriptDictado(base);
}

const STOPWORDS_INICIO =
  /^(?:compramos?|compré|compra|pague|pago|de|el|la|los|las|un|una|unos|unas|producto|productos|factura|item|items|que|es|son|fueron|me|trae|trajo)\s+/i;

/** Limpia relleno al inicio y palabras vacías del dictado.
 * OJO: NO borrar "de" ni "por" en medio — forman parte del nombre
 * ("vaso de 5 onzas", "pincho por 100").
 */
export function limpiarDescripcionDictada(texto: string): string {
  let s = texto.trim();
  for (let i = 0; i < 4; i++) {
    const antes = s;
    s = s.replace(STOPWORDS_INICIO, '').trim();
    s = s.replace(
      /\b(?:unidades|unidad|und|unds|cantidad|cant|pesos|peso|valor|monto|cuesta|precio|total)\b/gi,
      ' '
    );
    s = s.replace(/\s+/g, ' ').trim();
    if (s === antes) break;
  }
  if (!s) return 'Gasto general';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Separa ítems de una factura dictada sin cortar "huevo y harina" */
export function separarItemsDictadoFactura(transcript: string): string[] {
  const normalizado = normalizarTranscriptDictado(transcript);
  if (!normalizado) return [];

  const partes = normalizado
    .split(
      /(?:,\s*|\s+y\s+(?=\d)|\s+ademas\s+|\s+además\s+|\s+luego\s+|\s+despues\s+|\s+después\s+|\s+otro\s+|\s+siguiente\s+)/i
    )
    .map((c) => c.trim())
    .filter((c) => c.length > 1);

  return partes.length > 0 ? partes : [normalizado];
}

/**
 * Números que son TAMAÑO o EMPAQUE del producto, NO cantidad comprada ni precio.
 * Ej: "5 onzas", "25 cm", "por 100", "x50", "*24"
 */
const PATRONES_NUMERO_PRODUCTO: RegExp[] = [
  // Tamaño / medida
  /\bde\s+\d+\s+onzas?\b/gi,
  /\d+\s+onzas?\b/gi,
  /\d+\s*oz\b/gi,
  /\d+\s*(?:centimetros?|centímetros?|cms?|cm)\b/gi,
  /\d+\s*(?:milimetros?|milímetros?|mms?|mm)\b/gi,
  /\d+\s*(?:pulgadas?|inch|in)\b/gi,
  /\d+\s*(?:ml|lt|l|gr|g|kg)\b/gi,
  /\d+\s*[xX]\s*\d+/g,
  // Empaque: *24, x 100, por 100, por 100 unidades
  /\*\s*\d+/g,
  /\bx\s*\d{1,4}\b/gi,
  /\bpor\s+\d{1,4}(?:\s*(?:unidades|unidad|unds?|uds?))?\b/gi,
];

export function protegerNumerosEnNombreProducto(texto: string): {
  textoProtegido: string;
  restauraciones: string[];
} {
  const restauraciones: string[] = [];
  let out = texto;
  for (const patron of PATRONES_NUMERO_PRODUCTO) {
    // Reset lastIndex por si el regex es global y se reutiliza
    patron.lastIndex = 0;
    out = out.replace(patron, (match) => {
      const idx = restauraciones.length;
      restauraciones.push(match.replace(/\s+/g, ' ').trim());
      // Sin dígitos en el placeholder (si no, el parser los toma por cantidad/monto)
      const letra = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String(idx) : '');
      return ` __NP${letra}__ `;
    });
  }
  return { textoProtegido: out.replace(/\s+/g, ' ').trim(), restauraciones };
}

export function restaurarNumerosEnNombreProducto(
  texto: string,
  restauraciones: string[]
): string {
  let out = texto;
  restauraciones.forEach((original, idx) => {
    const letra = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String(idx) : '');
    out = out.replace(new RegExp(`__NP${letra}__`, 'gi'), original);
  });
  return out.replace(/\s+/g, ' ').trim();
}

export interface ExtraccionCantidadMonto {
  cantidad: string;
  monto: number;
  descripcionBase: string;
}

/**
 * Separa cantidad COMPRADA, monto y nombre del producto.
 * Protege medidas/empaque ("5 onzas", "25 cm", "por 100") para no
 * confundirlos con "compré 100 unidades".
 */
export function extraerCantidadMontoDescripcion(texto: string): ExtraccionCantidadMonto {
  const normalizado = normalizarTranscriptDictado(texto);
  const { textoProtegido, restauraciones } = protegerNumerosEnNombreProducto(normalizado);

  const numeros = [...textoProtegido.matchAll(/\d[\d.,]*/g)]
    .map((m) => ({
      raw: m[0],
      valor: parseFloat(m[0].replace(/[^\d]/g, '')),
      indice: m.index ?? 0,
    }))
    .filter((n) => !Number.isNaN(n.valor) && n.valor > 0);

  let monto = 0;
  let cantidad = '1';
  let cleanText = textoProtegido;

  if (numeros.length === 1) {
    const n = numeros[0];
    // Un solo número: si parece plata (≥1000) o no está al inicio → monto.
    // Si está al inicio y es chico, podría ser cantidad comprada ("3 gaseosas").
    if (n.valor >= 1000 || n.indice > 4) {
      monto = n.valor;
    } else {
      cantidad = String(Math.round(n.valor));
    }
    cleanText = cleanText.replace(n.raw, ' ');
  } else if (numeros.length > 1) {
    // El mayor suele ser el monto (pesos). El resto, si está al inicio, es cantidad comprada.
    monto = Math.max(...numeros.map((n) => n.valor));
    const candidatosQty = numeros.filter((n) => n.valor !== monto && n.valor <= 999);
    const alInicio = candidatosQty.find((n) => n.indice <= 3);
    if (alInicio) {
      cantidad = String(Math.round(alInicio.valor));
    }
    // Si el único candidato NO está al inicio, es ruido residual → cantidad sigue en 1
    for (const n of numeros) {
      cleanText = cleanText.replace(n.raw, ' ');
    }
  }

  const descripcionBase = restaurarNumerosEnNombreProducto(
    limpiarDescripcionDictada(cleanText),
    restauraciones
  );

  return { cantidad, monto, descripcionBase };
}

export interface ItemDictadoGasto {
  cantidad: string;
  descripcion: string;
  monto: number;
}

/** Parsea un ítem dictado: cantidad, descripción y monto */
export function parsearItemDictadoGasto(chunk: string): ItemDictadoGasto {
  const { cantidad, monto, descripcionBase } = extraerCantidadMontoDescripcion(chunk);
  return { cantidad, descripcion: descripcionBase, monto };
}

export interface OpcionesDictadoVoz {
  /** Texto ya escrito antes de empezar a dictar (no se borra) */
  textoInicial?: string;
  onTranscript: (estado: TranscriptAcumulado) => void;
  onSegmentoFinal?: (segmento: string, acumuladoFinal: string) => void;
  onError?: (error: string) => void;
  onEstado?: (escuchando: boolean) => void;
}

export interface ControlDictadoVoz {
  /** Detiene el micrófono */
  detener: () => void;
  /** Borra el texto acumulado sin apagar el mic (listo para el siguiente gasto) */
  reiniciarTexto: () => void;
}

/**
 * Inicia reconocimiento con acumulación correcta y auto-reinicio.
 * Devuelve control para detener o limpiar el buffer tras registrar.
 */
export function iniciarDictadoVoz(opciones: OpcionesDictadoVoz): ControlDictadoVoz | null {
  const Ctor = obtenerSpeechRecognition();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = 'es-CO';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let activo = true;
  let acumuladoFinal = opciones.textoInicial?.trim() ?? '';
  let instancia: SpeechRecognitionInstance | null = recognition;

  if (acumuladoFinal) {
    const completo = normalizarTranscriptDictado(acumuladoFinal);
    opciones.onTranscript({ final: acumuladoFinal, interim: '', completo, segmentoFinalNuevo: '' });
  }

  const reiniciarSuave = () => {
    if (!activo || !instancia) return;
    window.setTimeout(() => {
      if (!activo || !instancia) return;
      try {
        instancia.start();
      } catch {
        /* ya iniciado */
      }
    }, 350);
  };

  recognition.onstart = () => {
    opciones.onEstado?.(true);
  };

  recognition.onresult = (event) => {
    const estado = extraerTranscriptDesdeEvento(event, acumuladoFinal);
    if (estado.segmentoFinalNuevo) {
      acumuladoFinal = estado.final;
      opciones.onSegmentoFinal?.(estado.segmentoFinalNuevo, acumuladoFinal);
    }
    opciones.onTranscript({
      ...estado,
      completo: transcriptParaPantalla(estado.final, estado.interim),
    });
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech') return;
    if (event.error === 'aborted') return;
    opciones.onError?.(event.error);
    if (event.error === 'not-allowed' || event.error === 'audio-capture') {
      activo = false;
      opciones.onEstado?.(false);
    }
  };

  recognition.onend = () => {
    if (activo) {
      reiniciarSuave();
    } else {
      opciones.onEstado?.(false);
    }
  };

  try {
    recognition.start();
  } catch {
    opciones.onError?.('start-failed');
    return null;
  }

  return {
    detener: () => {
      activo = false;
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
      instancia = null;
      opciones.onEstado?.(false);
    },
    reiniciarTexto: () => {
      acumuladoFinal = '';
      opciones.onTranscript({ final: '', interim: '', completo: '', segmentoFinalNuevo: '' });
    },
  };
}

/** Lee el acumulado final guardado en refs (helper para tests) */
export function construirTranscriptCompleto(final: string, interim: string): string {
  return interim ? `${final} ${interim}`.replace(/\s+/g, ' ').trim() : final.trim();
}
