import React, { useRef, useState } from 'react';
import { Clapperboard, Copy, Check, ExternalLink, Upload, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';

/** Vidu S2-Avatar se genera en su web, no dentro de Dulce Placer. */
export const VIDU_S2_URL = 'https://www.vidu.com/vidu-stream';

type SlotId = 'cara' | 'ropa' | 'fondo' | 'objeto';

const SLOTS: { id: SlotId; titulo: string; ayuda: string }[] = [
  { id: 'cara', titulo: 'Cara / cuerpo', ayuda: 'Quien habla (Andrea o quien atienda).' },
  { id: 'ropa', titulo: 'Delantal / uniforme', ayuda: 'Cámbialo a mitad, sin parar el vídeo.' },
  { id: 'fondo', titulo: 'Vitrina / mostrador', ayuda: 'Fondo real del local.' },
  { id: 'objeto', titulo: 'Producto en la mano', ayuda: 'Una foto clara, sin precio escrito.' },
];

const CLAVES_CLIP = ['VIDU_CLIP_1', 'VIDU_CLIP_2', 'VIDU_CLIP_3', 'VIDU_CAMBIOS'] as const;

function parsearClips(texto: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = texto.split(/\[(VIDU_CLIP_1|VIDU_CLIP_2|VIDU_CLIP_3|VIDU_CAMBIOS)\]/i);
  let current = 'OTROS';
  parts.forEach((part) => {
    const match = part.toUpperCase().trim();
    if ((CLAVES_CLIP as readonly string[]).includes(match)) {
      current = match;
    } else if (part.trim()) {
      sections[current] = (sections[current] || '') + part.trim();
    }
  });
  return sections;
}

interface Props {
  nombreProducto: string;
  ocasionPrompt?: string;
}

export function AvatarViduStudio({ nombreProducto, ocasionPrompt }: Props) {
  const [fotos, setFotos] = useState<Record<SlotId, string | null>>({
    cara: null,
    ropa: null,
    fondo: null,
    objeto: null,
  });
  const [generando, setGenerando] = useState(false);
  const [clips, setClips] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const inputsRef = useRef<Record<SlotId, HTMLInputElement | null>>({
    cara: null,
    ropa: null,
    fondo: null,
    objeto: null,
  });

  const cargarFoto = (slot: SlotId, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Esa foto pesa más de 8 MB. Vidu pide menos de 10 MB; súbela más liviana.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFotos((prev) => ({ ...prev, [slot]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const copiar = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(clave);
    toast.success('Copiado. Pégalo en Vidu S2-Avatar.');
    setTimeout(() => setCopiado(null), 2000);
  };

  const abrirVidu = () => {
    window.open(VIDU_S2_URL, '_blank', 'noopener,noreferrer');
    toast.message('Se abre Vidu S2. El vídeo se genera allá, no aquí.');
  };

  const generarGuiones = async () => {
    setGenerando(true);
    setClips({});
    const ocasion = ocasionPrompt?.trim()
      ? `\nOcasión o ángulo (respétalo, sin inventar precios): ${ocasionPrompt.trim()}\n`
      : '';
    const prompt = `Eres copywriter de mostrador para la panadería Dulce Placer (Colombia).
Producto a mostrar: ${nombreProducto}.
${ocasion}
REGLAS OBLIGATORIAS:
- No inventes precios, ofertas, descuentos ni cantidades de stock.
- No prometas domicilio ni horarios que no estén en el contexto.
- Tono de mostrador cercano. No influencer, no baile, no show.
- Cada clip dura 15 a 20 segundos. Frases cortas para leer en voz alta.
- El avatar es de mostrador de Dulce Placer.

Genera EXACTAMENTE esta estructura, sin otros bloques:

[VIDU_CLIP_1]
Título: Buenos días
Texto para dictar a Vidu S2-Avatar:
(15-20 s, saludo, nombre de Dulce Placer, invitar a pedir por WhatsApp o pasar al local. Sin precio.)
Fotos: cara + delantal + fondo de vitrina.

[VIDU_CLIP_2]
Título: Producto en la mano
Texto para dictar:
(habla del producto "${nombreProducto}" por lo que se ve, sin inventar nombre si no estás seguro)
A mitad de generación dile a Vidu: "toma este producto y muéstralo a la cámara" y sube la foto de objeto.

[VIDU_CLIP_3]
Título: Cambio de escena
Texto para dictar:
(mismo personaje, otro rincón del local)
A mitad dile: "ahora estás detrás del mostrador" y sube la foto de fondo.

[VIDU_CAMBIOS]
Lista de 4 líneas: qué foto subir (ropa / fondo / objeto / cara) y la frase exacta para decirle a Vidu sin detener la generación.`;

    try {
      let acumulado = '';
      await consultarAgente('influencer', prompt, (chunk) => {
        acumulado += chunk;
      }, fotos.objeto || fotos.cara || undefined);
      const parsed = parsearClips(acumulado);
      if (!parsed['VIDU_CLIP_1'] && !parsed['VIDU_CLIP_2']) {
        toast.error('La IA no devolvió los clips. Intenta otra vez.');
        return;
      }
      setClips(parsed);
      toast.success('Tres clips listos. Cópialos y ábrelos en Vidu.');
    } catch {
      toast.error('No se pudieron generar los guiones.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Card
      id="avatar-vidu-studio"
      className="border-2 border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50/80 to-fuchsia-50/60 dark:from-amber-950/20 dark:to-fuchsia-950/20 shadow-xl overflow-hidden"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-amber-600" /> Avatar Vidu S2 — mostrador en tiempo real
        </CardTitle>
        <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
          Aquí se arman las fotos y el texto. El vídeo (720p, cambios de ropa/fondo/producto mientras genera) se hace en Vidu S2-Avatar. Esta app no finge haberlo creado.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SLOTS.map((slot) => (
            <div key={slot.id} className="space-y-1.5">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
                ref={(el) => { inputsRef.current[slot.id] = el; }}
                onChange={(e) => {
                  cargarFoto(slot.id, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => inputsRef.current[slot.id]?.click()}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 overflow-hidden text-left hover:border-amber-400 transition-colors"
              >
                {fotos[slot.id] ? (
                  <img src={fotos[slot.id]!} alt={slot.titulo} className="w-full h-24 object-cover" />
                ) : (
                  <div className="h-24 flex flex-col items-center justify-center gap-1 text-slate-400">
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px] font-bold px-2 text-center">{slot.titulo}</span>
                  </div>
                )}
              </button>
              <p className="text-[10px] text-slate-500 leading-snug">{slot.ayuda}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={generarGuiones}
            disabled={generando}
            className="flex-1 h-11 bg-gradient-to-r from-amber-600 to-fuchsia-600 hover:from-amber-500 hover:to-fuchsia-500 text-white font-black uppercase tracking-wide text-xs gap-2"
          >
            {generando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generando ? 'Escribiendo clips…' : 'Generar 3 clips para Vidu'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={abrirVidu}
            className="h-11 text-xs font-bold gap-2 border-amber-300 dark:border-amber-800"
          >
            <ExternalLink className="w-4 h-4" /> Abrir Vidu S2-Avatar
          </Button>
        </div>

        {clips['VIDU_CLIP_1'] && (
          <div className="space-y-3">
            {([
              ['VIDU_CLIP_1', 'Clip 1 · Buenos días'],
              ['VIDU_CLIP_2', 'Clip 2 · Producto en la mano'],
              ['VIDU_CLIP_3', 'Clip 3 · Cambio de escena'],
              ['VIDU_CAMBIOS', 'Cambios a mitad (sin parar)'],
            ] as const).map(([clave, titulo]) => (
              clips[clave] ? (
                <div key={clave} className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white/80 dark:bg-slate-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">{titulo}</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copiar(clips[clave], clave)}>
                      {copiado === clave ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{clips[clave]}</p>
                </div>
              ) : null
            ))}
            <p className="text-[10px] text-slate-500">
              En Vidu: foto de cara → pega el texto → mientras genera, sube ropa / fondo / objeto. No pongas precios que no hayas confirmado hoy.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
