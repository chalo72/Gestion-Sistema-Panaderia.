import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * DICTADO POR VOZ — Dulce Placer
 * Creado 2026-09-19 a pedido de Gonzalo: poder apretar el micrófono y hablar
 * seguido, en vez de escribir, para que no se pierda el contexto de la idea.
 *
 * Usa el reconocimiento de voz que ya trae el navegador (gratis, sin API ni
 * llaves). Va escribiendo mientras se habla y no corta en cada pausa.
 */

type ReconocimientoVoz = any;

function obtenerConstructor(): any | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function dictadoDisponible(): boolean {
  return obtenerConstructor() !== null;
}

export interface UseDictado {
  escuchando: boolean;
  disponible: boolean;
  textoParcial: string;
  error: string | null;
  alternar: () => void;
  detener: () => void;
}

/**
 * @param onTexto  Se llama con el texto final acumulado cada vez que hay una frase nueva.
 * @param idioma   Por defecto español de Colombia.
 */
export function useDictado(onTexto: (texto: string) => void, idioma = 'es-CO'): UseDictado {
  const [escuchando, setEscuchando] = useState(false);
  const [textoParcial, setTextoParcial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ReconocimientoVoz | null>(null);
  const queremosEscuchar = useRef(false);
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;

  const disponible = obtenerConstructor() !== null;

  const crear = useCallback(() => {
    const Constructor = obtenerConstructor();
    if (!Constructor) return null;
    const rec: ReconocimientoVoz = new Constructor();
    rec.lang = idioma;
    rec.continuous = true;      // no cortar en cada pausa
    rec.interimResults = true;  // ir mostrando lo que va oyendo

    rec.onresult = (evento: any) => {
      let parcial = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        const texto = resultado[0]?.transcript || '';
        if (resultado.isFinal) {
          const limpio = texto.trim();
          if (limpio) onTextoRef.current(limpio);
        } else {
          parcial += texto;
        }
      }
      setTextoParcial(parcial);
    };

    rec.onerror = (evento: any) => {
      const codigo = evento?.error;
      if (codigo === 'not-allowed' || codigo === 'service-not-allowed') {
        setError('El navegador no dio permiso para usar el micrófono.');
        queremosEscuchar.current = false;
        setEscuchando(false);
      } else if (codigo === 'no-speech') {
        // Silencio: no es un error real, se reinicia solo abajo.
      } else if (codigo === 'audio-capture') {
        setError('No se encontró un micrófono conectado.');
        queremosEscuchar.current = false;
        setEscuchando(false);
      }
    };

    // El navegador corta el reconocimiento cada cierto tiempo:
    // si el usuario sigue queriendo hablar, lo volvemos a arrancar solo.
    rec.onend = () => {
      setTextoParcial('');
      if (queremosEscuchar.current) {
        try { rec.start(); } catch { /* ya estaba arrancando */ }
      } else {
        setEscuchando(false);
      }
    };

    return rec;
  }, [idioma]);

  const detener = useCallback(() => {
    queremosEscuchar.current = false;
    setEscuchando(false);
    setTextoParcial('');
    try { recRef.current?.stop(); } catch { /* nada */ }
  }, []);

  const alternar = useCallback(() => {
    setError(null);
    if (escuchando) { detener(); return; }
    if (!recRef.current) recRef.current = crear();
    if (!recRef.current) {
      setError('Este navegador no permite dictado por voz. Prueba con Chrome.');
      return;
    }
    queremosEscuchar.current = true;
    try {
      recRef.current.start();
      setEscuchando(true);
    } catch {
      // Si ya estaba arrancado, no pasa nada.
      setEscuchando(true);
    }
  }, [escuchando, crear, detener]);

  useEffect(() => {
    return () => {
      queremosEscuchar.current = false;
      try { recRef.current?.stop(); } catch { /* nada */ }
    };
  }, []);

  return { escuchando, disponible, textoParcial, error, alternar, detener };
}
