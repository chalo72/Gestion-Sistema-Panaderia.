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
  veintiuno: '21',
  veintidos: '22',
  veintidós: '22',
  treinta: '30',
  cuarenta: '40',
  cincuenta: '50',
  sesenta: '60',
  setenta: '70',
  ochenta: '80',
  noventa: '90',
  cien: '100',
  ciento: '100',
  mil: '1000',
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
  let s = texto.replace(/(\d),(\d)/g, '$1$2').toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const ordenado = Object.entries(MAP_NUMEROS).sort((a, b) => b[0].length - a[0].length);
  for (const [palabra, digito] of ordenado) {
    const norm = palabra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(new RegExp(`\\b${norm}\\b`, 'gi'), digito);
  }

  // "15 mil" / "50 mil" → montos colombianos frecuentes
  s = s.replace(/\b(\d{1,3})\s*mil\b/gi, (_, n: string) => String(parseInt(n, 10) * 1000));

  return s.replace(/\s+/g, ' ').trim();
}

const STOPWORDS_INICIO =
  /^(?:compramos?|compré|compra|pague|pago|de|el|la|los|las|un|una|unos|unas|producto|productos|factura|item|items|que|es|son|fueron|me|trae|trajo)\s+/i;

/** Limpia relleno al inicio y palabras vacías del dictado */
export function limpiarDescripcionDictada(texto: string): string {
  let s = texto.trim();
  for (let i = 0; i < 4; i++) {
    const antes = s;
    s = s.replace(STOPWORDS_INICIO, '').trim();
    s = s.replace(
      /\b(?:unidades|unidad|und|unds|cantidad|cant|pesos|peso|a|por|valor|monto|cuesta|precio|total|de)\b/gi,
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

/** Números que son parte del nombre (tamaño/embalaje), no cantidad ni precio */
const PATRONES_NUMERO_PRODUCTO: RegExp[] = [
  /\bde\s+\d+\s+onzas?\b/gi,
  /\d+\s+onzas?\b/gi,
  /\d+\s*oz\b/gi,
  /\*\s*\d+/g,
  /\d+\s*(?:ml|lt|l|gr|g|kg)\b/gi,
  /\d+\s*[xX]\s*\d+/g,
];

export function protegerNumerosEnNombreProducto(texto: string): {
  textoProtegido: string;
  restauraciones: string[];
} {
  const restauraciones: string[] = [];
  let out = texto;
  for (const patron of PATRONES_NUMERO_PRODUCTO) {
    out = out.replace(patron, (match) => {
      const idx = restauraciones.length;
      restauraciones.push(match.replace(/\s+/g, ' ').trim());
      return ` __NP${idx}__ `;
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
    out = out.replace(new RegExp(`__NP${idx}__`, 'g'), original);
  });
  return out.replace(/\s+/g, ' ').trim();
}

export interface ExtraccionCantidadMonto {
  cantidad: string;
  monto: number;
  descripcionBase: string;
}

/**
 * Separa cantidad comprada, monto y nombre del producto.
 * Protege "5 onzas", "*24", etc. para que no se confundan con cantidad o precio.
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
    if (n.valor >= 1000 || n.indice > 4) {
      monto = n.valor;
    } else {
      cantidad = String(Math.round(n.valor));
    }
    cleanText = cleanText.replace(n.raw, ' ');
  } else if (numeros.length > 1) {
    monto = Math.max(...numeros.map((n) => n.valor));
    const candidatosQty = numeros.filter((n) => n.valor !== monto && n.valor <= 9999);
    const alInicio = candidatosQty.find((n) => n.indice <= 3);
    if (alInicio) {
      cantidad = String(Math.round(alInicio.valor));
    } else if (candidatosQty.length > 0) {
      cantidad = String(Math.round(candidatosQty[0].valor));
    }
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

/**
 * Inicia reconocimiento con acumulación correcta y auto-reinicio.
 * Devuelve función para detener.
 */
export function iniciarDictadoVoz(opciones: OpcionesDictadoVoz): (() => void) | null {
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
    opciones.onTranscript({ final: acumuladoFinal, interim: '', completo: acumuladoFinal, segmentoFinalNuevo: '' });
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
    opciones.onTranscript(estado);
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

  return () => {
    activo = false;
    try {
      recognition.stop();
    } catch {
      /* noop */
    }
    instancia = null;
    opciones.onEstado?.(false);
  };
}

/** Lee el acumulado final guardado en refs (helper para tests) */
export function construirTranscriptCompleto(final: string, interim: string): string {
  return interim ? `${final} ${interim}`.replace(/\s+/g, ' ').trim() : final.trim();
}
