import React, { useState, useEffect } from 'react';
import { Instagram, Facebook, MessageCircle, PlaySquare, Send, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generarVideoCorto, descargarVideo, type FormatoVideo, type ResultadoVideo } from '@/lib/motor-video';
import { BotonMicrofono } from '@/components/marketing/BotonMicrofono';
import { generarArte, descargarArte, COLORES_TEXTO, type FormatoArte, type DisenoTexto } from '@/lib/motor-arte';
import { extraerFrases, extraerTitular } from '@/lib/texto-campana';
import { ImageIcon, Check } from 'lucide-react';
import { Download, Film } from 'lucide-react';

/**
 * Vista Previa de Campaña — muestra CÓMO SE VA A VER la publicación en cada red
 * antes de que salga. Nada se publica sin que el usuario lo apruebe aquí.
 *
 * Creado el 2026-09-19 a pedido de Gonzalo: antes, el Modo Rápido generaba y
 * enviaba de una, sin enseñarle nada.
 */

export interface VistaPreviaProps {
  imagen: string | null;
  secciones: Record<string, string>;
  ocasionLabel?: string;
  publicando?: boolean;
  regenerando?: boolean;
  onAprobarYPublicar: () => void;
  onPedirCambio: (instruccion: string, idVariante?: string) => void;
  onCancelar: () => void;
  /** 'n8n' = manda todo al equipo de agentes. 'directo' = publica ya, sin N8N. */
  modoPublicacion: 'n8n' | 'directo';
  onCambiarModo: (modo: 'n8n' | 'directo') => void;
  /** Las distintas opciones generadas de la misma foto. */
  variantes?: Array<{ id: string; etiqueta: string; secciones: Record<string, string> }>;
  seleccionadas?: string[];
  onAlternarSeleccion?: (id: string) => void;
  onVerVariante?: (id: string) => void;
}

type Pestana = 'arte' | 'instagram' | 'facebook' | 'whatsapp' | 'video';

const PESTANAS: { id: Pestana; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'arte', label: 'Imagen final', icon: ImageIcon, color: 'text-amber-600' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-fuchsia-600' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600' },
  { id: 'video', label: 'Reel / TikTok', icon: PlaySquare, color: 'text-rose-600' },
];

export const VistaPreviaCampana: React.FC<VistaPreviaProps> = ({
  imagen, secciones, ocasionLabel, publicando, regenerando,
  onAprobarYPublicar, onPedirCambio, onCancelar,
  modoPublicacion, onCambiarModo,
  variantes = [], seleccionadas = [], onAlternarSeleccion, onVerVariante,
}) => {
  const [pestana, setPestana] = useState<Pestana>('arte');
  const [instruccion, setInstruccion] = useState('');

  // Motor de video: genera un .mp4 real en el mismo navegador (gratis, sin marca de agua)
  const [formatoVideo, setFormatoVideo] = useState<FormatoVideo>('vertical');
  const [generandoVideo, setGenerandoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [videoGenerado, setVideoGenerado] = useState<ResultadoVideo | null>(null);
  const [errorVideo, setErrorVideo] = useState<string | null>(null);

  // Opción que se está viendo
  const [varianteActiva, setVarianteActiva] = useState<string>(variantes[0]?.id || '');

  // Arte (imagen terminada con el texto encima)
  const [formatoArte, setFormatoArte] = useState<FormatoArte>('cuadrado');
  const [arte, setArte] = useState<string | null>(null);
  const [generandoArte, setGenerandoArte] = useState(false);

  // Texto y estilo que el usuario puede cambiar a mano
  const [titular, setTitular] = useState('');
  const [apoyo, setApoyo] = useState('');
  const [colorTexto, setColorTexto] = useState('#facc15'); // amarillo por defecto
  const [disenoTexto, setDisenoTexto] = useState<DisenoTexto>('banda');

  const textoIG = secciones['INSTAGRAM'] || '';
  const textoWA = secciones['WHATSAPP'] || '';
  const guionTikTok = secciones['TIKTOK_VIRAL'] || '';
  const guionAvatar = secciones['AVATAR_PROMPT'] || '';

  // Frases publicables, ya sin notas técnicas del guion (audio, escena, etc.)
  const frasesSugeridas = extraerFrases([textoIG, textoWA, guionTikTok], 3);
  const ganchoSugerido = extraerTitular([textoIG, textoWA, guionTikTok]);

  /** Frases que van saliendo en el video: lo que el usuario dejó escrito. */
  const frasesParaVideo = (): string[] => {
    const propias = [titular.trim(), apoyo.trim()].filter(Boolean);
    if (propias.length) return propias.slice(0, 3);
    return frasesSugeridas.length ? frasesSugeridas : ['Dulce Placer'];
  };

  const handleGenerarVideo = async () => {
    if (!imagen) { setErrorVideo('Necesito una foto para armar el video.'); return; }
    setGenerandoVideo(true);
    setErrorVideo(null);
    setProgresoVideo(0);
    setVideoGenerado(null);
    try {
      const res = await generarVideoCorto({
        imagen,
        frases: frasesParaVideo(),
        firma: '@dulceplacer1729',
        formato: formatoVideo,
        duracionSeg: 10,
        colorTexto,
        diseno: disenoTexto,
        onProgreso: setProgresoVideo,
      });
      setVideoGenerado(res);
    } catch (e: any) {
      setErrorVideo(e?.message || 'No se pudo generar el video.');
    } finally {
      setGenerandoVideo(false);
    }
  };

  const enviarCambio = () => {
    const t = instruccion.trim();
    if (!t) return;
    onPedirCambio(t, varianteActiva || undefined);
    setInstruccion('');
  };

  return (
    <div className="space-y-4">
      {/* Animación para la vista previa del video (efecto de acercamiento tipo Ken Burns) */}
      <style>{`
        @keyframes dp-kenburns {
          0%   { transform: scale(1)    translate(0, 0); }
          50%  { transform: scale(1.18) translate(-2%, -3%); }
          100% { transform: scale(1)    translate(0, 0); }
        }
        @keyframes dp-subir {
          0%, 12%  { opacity: 0; transform: translateY(14px); }
          22%, 88% { opacity: 1; transform: translateY(0); }
          100%     { opacity: 1; transform: translateY(0); }
        }
        .dp-kenburns { animation: dp-kenburns 9s ease-in-out infinite; }
        .dp-subir    { animation: dp-subir 9s ease-out infinite; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-500" />
            Así va a quedar {ocasionLabel ? `— ${ocasionLabel}` : ''}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Revisa cada red. Nada se publica hasta que tú lo apruebes.
          </p>
        </div>
      </div>

      {/* OPCIONES GENERADAS — escoge una, dos o todas */}
      {variantes.length > 1 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
          <p className="text-[11px] font-black text-amber-900 dark:text-amber-200">
            Se generaron {variantes.length} opciones distintas de tu foto. Marca las que te gusten
            (puedes escoger varias) y mira cada una antes de publicar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {variantes.map((v, i) => {
              const marcada = seleccionadas.includes(v.id);
              const viendo = varianteActiva === v.id;
              return (
                <div
                  key={v.id}
                  className={`rounded-lg border-2 p-2.5 transition-all ${
                    viendo
                      ? 'border-slate-900 dark:border-white bg-white dark:bg-slate-900 shadow'
                      : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setVarianteActiva(v.id); setArte(null); onVerVariante?.(v.id); }}
                      className="text-left flex-1"
                    >
                      <p className="text-[11px] font-black text-slate-900 dark:text-white">
                        Opción {i + 1} — {v.etiqueta}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {(v.secciones['INSTAGRAM'] || '').slice(0, 80)}…
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAlternarSeleccion?.(v.id)}
                      title={marcada ? 'Quitar de la selección' : 'Marcar para publicar'}
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        marcada
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {viendo && (
                    <p className="text-[9px] font-bold text-slate-400 mt-1.5">Viendo esta</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
            Marcadas para publicar: {seleccionadas.length || 0} de {variantes.length}
          </p>
        </div>
      )}

      {/* Pestañas por red */}
      <div className="flex flex-wrap gap-1.5">
        {PESTANAS.map(p => {
          const Icon = p.icon;
          const activa = pestana === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activa
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activa ? '' : p.color}`} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ===== EDITOR DE TEXTO Y ESTILO (imagen y video) ===== */}
      {(pestana === 'arte' || pestana === 'video') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-3">
          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300">
            Texto y estilo — escribe lo que tú quieras
          </p>

          {/* Frase principal */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500">Frase principal (la grande)</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Ej: Hoy el amor se regala en bandeja"
                className="text-xs bg-white dark:bg-slate-950"
              />
              <BotonMicrofono
                onTexto={(f) => setTitular((prev) => (prev ? prev + ' ' : '') + f)}
                titulo="Dictar la frase principal"
              />
            </div>
          </div>

          {/* Frase de apoyo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500">Frase de apoyo (la pequeña, opcional)</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={apoyo}
                onChange={(e) => setApoyo(e.target.value)}
                placeholder="Ej: Pásate hoy por el punto o escríbenos"
                className="text-xs bg-white dark:bg-slate-950"
              />
              <BotonMicrofono
                onTexto={(f) => setApoyo((prev) => (prev ? prev + ' ' : '') + f)}
                titulo="Dictar la frase de apoyo"
              />
            </div>
          </div>

          {/* Sugerencias de la campaña */}
          {frasesSugeridas.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500">O usa una de la campaña:</Label>
              <div className="flex flex-wrap gap-1.5">
                {frasesSugeridas.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTitular(f)}
                    className="px-2 py-1 rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300 hover:border-slate-400 max-w-full truncate"
                    title={f}
                  >
                    {f.length > 45 ? f.slice(0, 45) + '…' : f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color del texto */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500">Color del texto</Label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {COLORES_TEXTO.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setColorTexto(col.valor)}
                  title={col.nombre}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    colorTexto === col.valor
                      ? 'border-slate-900 dark:border-white scale-110 shadow'
                      : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: col.valor }}
                />
              ))}
              <input
                type="color"
                value={colorTexto}
                onChange={(e) => setColorTexto(e.target.value)}
                title="Otro color"
                className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0"
              />
            </div>
          </div>

          {/* Dónde va el texto */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500">Dónde va el texto</Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { id: 'banda' as DisenoTexto, label: 'Franja abajo (no tapa la foto)' },
                { id: 'abajo' as DisenoTexto, label: 'Encima, abajo' },
                { id: 'arriba' as DisenoTexto, label: 'Encima, arriba' },
              ]).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDisenoTexto(d.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    disenoTexto === d.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow'
                      : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {pestana === 'video' && (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Después de cambiar el texto o el color, vuelve a darle "Generar video" para que salga con lo nuevo.
              La música se agrega aparte, no va como texto.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center py-2">
        {/* ---------- IMAGEN FINAL (ARTE) ---------- */}
        {pestana === 'arte' && (
          <div className="w-full max-w-[340px] space-y-3">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {([
                { id: 'cuadrado' as FormatoArte, label: 'Publicación' },
                { id: 'vertical' as FormatoArte, label: 'Historia / Reel' },
                { id: 'horizontal' as FormatoArte, label: 'YouTube' },
              ]).map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFormatoArte(f.id); setArte(null); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    formatoArte === f.id
                      ? 'bg-amber-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {generandoArte && (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Armando la imagen…
              </div>
            )}

            {!generandoArte && arte && (
              <>
                <img
                  src={arte}
                  alt="Imagen final de la campaña"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => descargarArte(arte, 'dulce-placer-arte')}
                  className="w-full h-9 text-xs font-bold"
                >
                  Descargar la imagen
                </Button>
                <p className="text-[10px] text-center text-slate-500 leading-relaxed">
                  Esta es la imagen terminada, con el titular encima. Así queda publicada.
                </p>
              </>
            )}

            {!generandoArte && !arte && !imagen && (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                Sin foto no se puede armar la imagen.
              </div>
            )}
          </div>
        )}

        {/* ---------- INSTAGRAM ---------- */}
        {pestana === 'instagram' && (
          <div className="w-full max-w-[340px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-950 flex items-center justify-center text-[10px] font-black">DP</div>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">dulceplacer1729</span>
            </div>
            {imagen ? (
              <img src={arte || imagen} alt="Vista previa" className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-xs text-slate-400">
                Sin foto
              </div>
            )}
            <div className="px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                <span className="font-bold">dulceplacer1729 </span>
                {textoIG || 'Sin texto generado.'}
              </p>
            </div>
          </div>
        )}

        {/* ---------- FACEBOOK ---------- */}
        {pestana === 'facebook' && (
          <div className="w-full max-w-[360px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-black">DP</div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Panadería Dulce Placer</p>
                <p className="text-[10px] text-slate-500">Ahora · 🌎</p>
              </div>
            </div>
            <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {textoIG || 'Sin texto generado.'}
            </p>
            {imagen && <img src={imagen} alt="Vista previa" className="w-full object-cover max-h-[320px]" />}
          </div>
        )}

        {/* ---------- WHATSAPP ---------- */}
        {pestana === 'whatsapp' && (
          <div className="w-full max-w-[320px] rounded-2xl p-3 bg-[#0b141a] shadow-xl">
            <p className="text-[10px] text-slate-400 text-center mb-2">Estado / Difusión</p>
            <div className="rounded-lg overflow-hidden bg-[#005c4b] p-1.5 shadow">
              {imagen && <img src={imagen} alt="Vista previa" className="w-full rounded-md object-cover max-h-[260px]" />}
              <p className="text-[11px] leading-relaxed text-white/95 whitespace-pre-wrap px-1.5 py-2">
                {textoWA || 'Sin texto generado.'}
              </p>
              <p className="text-[9px] text-white/50 text-right px-1.5 pb-1">
                {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </p>
            </div>
          </div>
        )}

        {/* ---------- VIDEO / REEL ---------- */}
        {pestana === 'video' && (
          <div className="w-full max-w-[280px] space-y-3">
            <div className="relative rounded-[28px] border-[6px] border-slate-900 dark:border-slate-700 bg-black overflow-hidden shadow-2xl" style={{ aspectRatio: '9 / 16' }}>
              {imagen ? (
                <img src={imagen} alt="Vista previa del video" className="absolute inset-0 w-full h-full object-cover dp-kenburns" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Sin foto</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="dp-subir text-white font-black text-[15px] leading-tight drop-shadow-lg">
                  {ganchoVideo || 'Gancho del video'}
                </p>
                <p className="text-white/70 text-[10px] mt-1.5">@dulceplacer1729</p>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 leading-relaxed">
              Arriba está la simulación. Abajo generas el archivo de video de verdad
              (.mp4, gratis, sin marca de agua) para subirlo o mandarlo por WhatsApp.
            </p>

            {/* MOTOR DE VIDEO */}
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-3 space-y-2.5">
              <p className="text-[11px] font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Generar el video
              </p>

              <div className="flex flex-wrap gap-1.5">
                {([
                  { id: 'vertical' as FormatoVideo, label: 'Reel / Short / Estado' },
                  { id: 'cuadrado' as FormatoVideo, label: 'Publicación' },
                  { id: 'horizontal' as FormatoVideo, label: 'YouTube' },
                ]).map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setFormatoVideo(f.id); setVideoGenerado(null); }}
                    disabled={generandoVideo}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                      formatoVideo === f.id
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleGenerarVideo}
                disabled={generandoVideo || !imagen}
                className="w-full h-9 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white"
              >
                {generandoVideo
                  ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Armando el video… {progresoVideo}%</>
                  : <><Film className="w-3.5 h-3.5 mr-1.5" /> Generar video (10 seg)</>}
              </Button>

              {generandoVideo && (
                <>
                  <div className="h-1.5 w-full rounded-full bg-rose-100 dark:bg-rose-900/40 overflow-hidden">
                    <div className="h-full bg-rose-600 transition-all duration-200" style={{ width: `${progresoVideo}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    Se graba en tiempo real: no cierres esta pestaña mientras avanza.
                  </p>
                </>
              )}

              {errorVideo && (
                <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{errorVideo}</p>
              )}

              {videoGenerado && (
                <div className="space-y-2">
                  <video
                    src={videoGenerado.url}
                    controls
                    playsInline
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-black"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => descargarVideo(videoGenerado, 'dulce-placer-campana')}
                    className="w-full h-9 text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Descargar el video (.{videoGenerado.extension})
                  </Button>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Descárgalo y súbelo a Instagram, TikTok o mándalo por WhatsApp.
                    Publicarlo automáticamente lo conectamos en el siguiente paso.
                  </p>
                </div>
              )}
            </div>
            {guionTikTok && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 mb-1">Guion completo</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{guionTikTok}</p>
              </div>
            )}
            {guionAvatar && (
              <div className="rounded-lg bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/40 p-2.5">
                <p className="text-[10px] font-black text-fuchsia-700 dark:text-fuchsia-300 mb-1">Guion de Andrea (avatar)</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{guionAvatar}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pedir cambios */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2">
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
          ¿Quieres cambiarle algo? Escríbelo o dítalo hablando, y lo vuelvo a generar
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={instruccion}
            onChange={(e) => setInstruccion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviarCambio(); }}
            placeholder='Escribe o toca "Hablar": "más corto", "menciona el precio", "enfócate en el domicilio"'
            className="text-xs bg-white dark:bg-slate-950"
            disabled={regenerando || publicando}
          />
          <BotonMicrofono
            onTexto={(frase) => setInstruccion(prev => (prev ? prev + ' ' : '') + frase)}
            titulo="Dictar el cambio hablando"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={enviarCambio}
            disabled={regenerando || publicando || !instruccion.trim()}
            className="text-xs whitespace-nowrap"
          >
            {regenerando ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Rehacer
          </Button>
        </div>
      </div>

      {/* A dónde va la campaña cuando se apruebe */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 space-y-2">
        <p className="text-[11px] font-black text-indigo-900 dark:text-indigo-200">
          Al aprobar, ¿a dónde va la campaña?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onCambiarModo('n8n')}
            className={`text-left rounded-lg border-2 p-2.5 transition-all ${
              modoPublicacion === 'n8n'
                ? 'border-indigo-500 bg-white dark:bg-slate-900 shadow'
                : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 hover:border-indigo-300'
            }`}
          >
            <p className="text-[11px] font-black text-slate-900 dark:text-white">🤖 Al equipo de agentes (N8N)</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
              Campaña completa: el flujo hace su trabajo, adapta cada red y programa la publicación.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onCambiarModo('directo')}
            className={`text-left rounded-lg border-2 p-2.5 transition-all ${
              modoPublicacion === 'directo'
                ? 'border-emerald-500 bg-white dark:bg-slate-900 shadow'
                : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 hover:border-emerald-300'
            }`}
          >
            <p className="text-[11px] font-black text-slate-900 dark:text-white">⚡ Publicar ya (directo)</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
              Sale de una a Facebook e Instagram sin N8N. Para cuando el PC está apagado o hay afán.
            </p>
          </button>
        </div>
      </div>

      {/* Aprobar / cancelar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={onAprobarYPublicar}
          disabled={publicando || regenerando}
          className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/25"
        >
          {publicando
            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Publicando...</>
            : <><CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar y publicar</>}
        </Button>
        <Button
          variant="outline"
          onClick={onCancelar}
          disabled={publicando || regenerando}
          className="h-12 text-xs font-bold sm:w-40"
        >
          Descartar
        </Button>
      </div>
    </div>
  );
};

export default VistaPreviaCampana;
