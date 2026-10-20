import React, { useState } from 'react';
import { Repeat, Copy, Check, ExternalLink, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';

/** BigMotion genera y publica en su web, no dentro de Dulce Placer. */
export const BIGMOTION_APP_URL = 'https://app.bigmotion.ai';

const CLAVES = ['BIGMOTION_NICHO', 'BIGMOTION_TEMA', 'BIGMOTION_ESTILO', 'BIGMOTION_REGLAS', 'BIGMOTION_PASOS'] as const;

function parsearSerie(texto: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = texto.split(/\[(BIGMOTION_NICHO|BIGMOTION_TEMA|BIGMOTION_ESTILO|BIGMOTION_REGLAS|BIGMOTION_PASOS)\]/i);
  let current = 'OTROS';
  parts.forEach((part) => {
    const match = part.toUpperCase().trim();
    if ((CLAVES as readonly string[]).includes(match)) {
      current = match;
    } else if (part.trim()) {
      sections[current] = (sections[current] || '') + part.trim();
    }
  });
  return sections;
}

const TITULOS: Record<(typeof CLAVES)[number], string> = {
  BIGMOTION_NICHO: 'Nicho (elige este en BigMotion)',
  BIGMOTION_TEMA: 'Tema personalizado (pégalo en Custom Topic)',
  BIGMOTION_ESTILO: 'Estilo visual',
  BIGMOTION_REGLAS: 'Reglas para que no ensucie la marca',
  BIGMOTION_PASOS: 'Pasos en BigMotion (auto-post APAGADO)',
};

interface Props {
  nombreProducto: string;
  ocasionPrompt?: string;
}

export function BigMotionStudio({ nombreProducto, ocasionPrompt }: Props) {
  const [generando, setGenerando] = useState(false);
  const [bloques, setBloques] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(clave);
    toast.success('Copiado. Pégalo en BigMotion.');
    setTimeout(() => setCopiado(null), 2000);
  };

  const abrirBigMotion = () => {
    window.open(BIGMOTION_APP_URL, '_blank', 'noopener,noreferrer');
    toast.message('Se abre BigMotion. El vídeo se crea y publica allá, no aquí.');
  };

  const generarSerie = async () => {
    setGenerando(true);
    setBloques({});
    const ocasion = ocasionPrompt?.trim()
      ? `\nOcasión o ángulo (respétalo, sin inventar precios): ${ocasionPrompt.trim()}\n`
      : '';
    const prompt = `Eres director de contenido para la panadería Dulce Placer (Colombia).
Hay que armar UNA serie de Shorts SIN CARA para pegar en BigMotion (bigmotion.ai).
Producto de referencia: ${nombreProducto}.
${ocasion}

REGLAS OBLIGATORIAS:
- No inventes precios, ofertas, descuentos, stock ni horarios.
- No prometas domicilio.
- No uses motivación genérica, crypto, historia mundial ni "datos curiosos" ajenos a panadería.
- El canal de esta serie NO es el de Andrea con cara. Es faceless: recetas visuales, antojo, horno, masa, vitrina.
- Shorts de máximo 90 segundos. Español de Colombia, cercano.
- Recomienda un canal APARTE, no mezclar con el YouTube real de la panadería hasta ver el primer vídeo.

Genera EXACTAMENTE esta estructura, sin otros bloques:

[BIGMOTION_NICHO]
Una línea: el nicho a elegir (o "Custom Topic"). Ejemplo: panadería artesanal / antojo de pan y postres.

[BIGMOTION_TEMA]
Párrafo corto para pegar en Custom Topic de BigMotion: de qué trata la serie, tono, qué SÍ mostrar y qué NUNCA decir (precios, stock).

[BIGMOTION_ESTILO]
Estilo visual en 4 líneas: colores cálidos de horno, comida apetitosa, sin caras, subtítulos grandes, música suave. Sin marca de agua inventada.

[BIGMOTION_REGLAS]
Lista de 5 viñetas: auto-post APAGADO hasta ver el primer vídeo; no conectar el YouTube principal el primer día; no editar guion después del render (limitación real de BigMotion); Shorts no YouTube largo; si sale basura, archivar la serie.

[BIGMOTION_PASOS]
Pasos numerados para app.bigmotion.ai: crear Series → Custom Topic (pegar el tema) → estilo → captions → conectar redes SOLO cuando el preview convenza → Generate. El primer vídeo se puede ver en Your Videos antes de dejar el piloto automático.`;

    try {
      let acumulado = '';
      await consultarAgente('influencer', prompt, (chunk) => {
        acumulado += chunk;
      });
      const parsed = parsearSerie(acumulado);
      if (!parsed['BIGMOTION_TEMA'] && !parsed['BIGMOTION_NICHO']) {
        toast.error('La IA no devolvió la serie. Intenta otra vez.');
        return;
      }
      setBloques(parsed);
      toast.success('Serie lista. Cópiala y ábrela en BigMotion. Auto-post apagado.');
    } catch {
      toast.error('No se pudo generar la serie.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Card
      id="bigmotion-studio"
      className="border-2 border-sky-300 dark:border-sky-800 bg-gradient-to-br from-sky-50/80 to-slate-50/60 dark:from-sky-950/20 dark:to-slate-950/20 shadow-xl overflow-hidden"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Repeat className="w-4 h-4 text-sky-600" /> BigMotion — Shorts sin cara, en piloto
        </CardTitle>
        <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
          Aquí se arma el nicho y el tema. BigMotion escribe el guion, arma el vídeo (hasta 90 s) y, si tú lo enciendes, publica solo en YouTube / TikTok / Instagram. Esta app no publica ni finge haberlo publicado.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-xs text-amber-950 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            No conectes el YouTube de Dulce Placer el primer día. Prueba en un canal aparte. En la serie deja <strong>auto-post apagado</strong> hasta ver el siguiente vídeo en Your Videos. BigMotion no deja editar el guion después de renderizar.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={generarSerie}
            disabled={generando}
            className="flex-1 h-11 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black uppercase tracking-wide text-xs gap-2"
          >
            {generando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generando ? 'Armando la serie…' : 'Generar serie para BigMotion'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={abrirBigMotion}
            className="h-11 text-xs font-bold gap-2 border-sky-300 dark:border-sky-800"
          >
            <ExternalLink className="w-4 h-4" /> Abrir BigMotion
          </Button>
        </div>

        {bloques['BIGMOTION_TEMA'] || bloques['BIGMOTION_NICHO'] ? (
          <div className="space-y-3">
            {CLAVES.map((clave) => (
              bloques[clave] ? (
                <div key={clave} className="rounded-xl border border-sky-200 dark:border-sky-900/50 bg-white/80 dark:bg-slate-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-400">{TITULOS[clave]}</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copiar(bloques[clave], clave)}>
                      {copiado === clave ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{bloques[clave]}</p>
                </div>
              ) : null
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
