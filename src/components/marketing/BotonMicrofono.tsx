import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useDictado } from '@/hooks/useDictado';

/**
 * Botón de micrófono para dictar en vez de escribir.
 * Creado 2026-09-19: Gonzalo prefiere hablar seguido para no perder el contexto
 * de la idea. Usa el reconocimiento de voz del navegador (gratis, sin llaves).
 */

interface Props {
  /** Se llama con cada frase reconocida, para irla agregando al texto. */
  onTexto: (frase: string) => void;
  className?: string;
  titulo?: string;
}

export const BotonMicrofono: React.FC<Props> = ({ onTexto, className = '', titulo }) => {
  const { escuchando, disponible, textoParcial, error, alternar } = useDictado(onTexto);

  if (!disponible) return null;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={alternar}
        title={titulo || (escuchando ? 'Tocar para dejar de dictar' : 'Tocar para dictar hablando')}
        className={`flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
          escuchando
            ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {escuchando ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {escuchando ? 'Escuchando…' : 'Hablar'}
      </button>

      {escuchando && textoParcial && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic max-w-[220px] truncate">
          {textoParcial}
        </p>
      )}
      {error && <p className="text-[10px] font-bold text-red-600 dark:text-red-400 max-w-[220px]">{error}</p>}
    </div>
  );
};

export default BotonMicrofono;
