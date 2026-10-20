import React, { useState, useRef, useEffect } from 'react';
import {
  Zap, X, Instagram, Facebook, MessageCircle, Music2,
  Sparkles, Send, RefreshCw, Upload, Check, AlertCircle, ImageIcon, ExternalLink, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';
import { publicarDirecto } from '@/lib/publicar-directo';
import { publicarEnRedSocial } from '@/lib/marketing-api';
import { BotonMicrofono } from '@/components/marketing/BotonMicrofono';
import { EFECTOS, aplicarEfecto, HASHTAGS_SUGERIDOS, unirTextoYHashtags } from '@/lib/efectos-foto';
import {
  generarArte, COLORES_TEXTO, FUENTES,
  type DisenoTexto, type FormatoArte,
} from '@/lib/motor-arte';
import { Hash, Wand2, Phone, Link2, Pencil, Type, Palette, LayoutTemplate, Crop, Target, CalendarDays, Film, Download, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  movimientosDisponibles, buscarMovimiento, generarVideoMovimiento,
  descargarVideoMovimiento, type IdMovimiento, type ResultadoMovimiento,
} from '@/lib/motor-movimiento';
import {
  subirMedio, subirVariasFotos, guardarPublicacion, actualizarPublicacion,
} from '@/lib/biblioteca-marketing';
import {
  ENFOQUES_FLASH, OCASIONES_FLASH, construirContexto,
} from '@/lib/enfoques';
import {
  getConfigNegocio, setConfigNegocio, agregarCierre, construirCierre,
  limpiarNumero, type ConfigNegocio,
} from '@/lib/config-negocio';

/**
 * PUBLICACIÓN FLASH 360° — Dulce Placer
 * Creado 2026-09-20, sobre el diseño que trajo Gonzalo (Studio 360).
 *
 * DOS TEXTOS DISTINTOS (pedido de Gonzalo, 2026-09-20):
 *   1. TITULAR  → va ESCRITO SOBRE LA FOTO. Corto a propósito (máx. 60
 *      caracteres) para que no tape el producto. Se le elige color,
 *      tipo de letra y en qué parte de la foto va.
 *   2. TEXTO    → es la descripción que sale DEBAJO de la publicación,
 *      con los hashtags y el WhatsApp de pedidos.
 * La IA mira la foto y escribe los dos de una vez.
 *
 * DIFERENCIA CON EL DISEÑO ORIGINAL: allá todo estaba simulado (un
 * temporizador de 1,2 s que decía "éxito"). Aquí todo está conectado:
 *   - "Escribir con IA"    → Gemini, que SÍ ve la foto (vía /api/agente)
 *   - Facebook / Instagram → publicación real (/api/publicar)
 *   - WhatsApp / TikTok    → se envían al flujo de N8N
 */

type Canal = 'INSTAGRAM' | 'FACEBOOK' | 'WHATSAPP' | 'TIKTOK';

interface CanalInfo {
  id: Canal;
  nombre: string;
  icono: React.ElementType;
  color: string;
  /** true = publica directo desde la app; false = pasa por N8N */
  directo: boolean;
}

const CANALES: CanalInfo[] = [
  { id: 'INSTAGRAM', nombre: 'Instagram', icono: Instagram, color: 'text-fuchsia-600', directo: true },
  { id: 'FACEBOOK', nombre: 'Facebook', icono: Facebook, color: 'text-blue-600', directo: true },
  { id: 'WHATSAPP', nombre: 'WhatsApp', icono: MessageCircle, color: 'text-emerald-600', directo: false },
  { id: 'TIKTOK', nombre: 'TikTok', icono: Music2, color: 'text-slate-900 dark:text-white', directo: false },
];

/** Dónde va el titular sobre la foto, en palabras de todos los días. */
const POSICIONES: { id: DisenoTexto; nombre: string; ayuda: string }[] = [
  { id: 'banda', nombre: 'Abajo, aparte', ayuda: 'La foto queda completa y el texto va en una franja debajo. No tapa nada.' },
  { id: 'arriba', nombre: 'Arriba', ayuda: 'Sobre la foto, en la parte de arriba.' },
  { id: 'abajo', nombre: 'Encima abajo', ayuda: 'Sobre la foto, en la parte de abajo.' },
  { id: 'centro', nombre: 'Enfrente', ayuda: 'En el centro, delante de la foto.' },
  { id: 'lado-izq', nombre: 'Al lado izq.', ayuda: 'En una columna a la izquierda; el producto se ve a la derecha.' },
  { id: 'lado-der', nombre: 'Al lado der.', ayuda: 'En una columna a la derecha; el producto se ve a la izquierda.' },
];

const FORMATOS: { id: FormatoArte; nombre: string; nota: string }[] = [
  { id: 'cuadrado', nombre: 'Cuadrado', nota: 'Feed' },
  { id: 'vertical', nombre: 'Vertical', nota: 'Historia / Reel' },
  { id: 'horizontal', nombre: 'Horizontal', nota: 'Facebook' },
];

/** Máximo del titular: pasado de ahí empieza a tapar el producto. */
const LARGO_TITULAR = 60;

/** Tope de fotos por publicación. Más de eso hace el video eterno y pesado. */
const MAX_FOTOS = 10;

/** Se recuerda el último enfoque y la última ocasión, para no re-elegirlos cada vez. */
const CLAVE_ENFOQUE = 'DP_FLASH_ENFOQUE';
const CLAVE_OCASION = 'DP_FLASH_OCASION';

function leerGuardado(clave: string, porDefecto: string): string {
  try { return localStorage.getItem(clave) || porDefecto; } catch { return porDefecto; }
}
function guardar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor); } catch { /* modo incógnito */ }
}

export interface PublicacionFlashProps {
  abierto: boolean;
  onCerrar: () => void;
  /** Marca activa, para darle contexto a la IA. */
  marca?: 'panaderia' | 'andrea';
  /** Foto ya elegida en el estudio. Si no viene, se puede subir aquí. */
  imagenInicial?: string | null;
  /** Texto ya generado en el estudio, si lo hay. */
  textoInicial?: string;
  /** Ocasión de la campaña (ej: Día del Amor y la Amistad). */
  ocasion?: string;
}

interface ResultadoCanal {
  canal: Canal;
  ok: boolean;
  detalle: string;
  /** Enlace del post ya publicado, para abrirlo o compartirlo. */
  enlace?: string;
}

/**
 * Abre la ventana de Facebook para compartir un post en el PERFIL PERSONAL.
 * Facebook no deja que ningún programa publique en un perfil personal (cerraron
 * esa puerta en 2018), así que compartir con un clic es la única vía real.
 */
function compartirEnPerfil(enlace: string) {
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlace)}`,
    '_blank',
    'noopener,noreferrer,width=660,height=640'
  );
}

export const PublicacionFlash: React.FC<PublicacionFlashProps> = ({
  abierto, onCerrar, marca = 'panaderia', imagenInicial, textoInicial, ocasion,
}) => {
  const [seleccionados, setSeleccionados] = useState<Canal[]>(['INSTAGRAM', 'FACEBOOK']);
  const [texto, setTexto] = useState(textoInicial || '');
  const [fotos, setFotos] = useState<string[]>(imagenInicial ? [imagenInicial] : []);
  /** La primera foto manda: es la que se publica como imagen. */
  const imagen = fotos[0] || null;
  const [generandoIA, setGenerandoIA] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCanal[] | null>(null);
  const [efecto, setEfecto] = useState('ninguno');
  const [hashtags, setHashtags] = useState('');
  const [incluirHashtags, setIncluirHashtags] = useState(true);
  const [contacto, setContacto] = useState<ConfigNegocio>(() => getConfigNegocio());
  const [editandoCierre, setEditandoCierre] = useState(false);

  // --- Texto que va ESCRITO SOBRE LA FOTO ---
  const [titular, setTitular] = useState('');
  const [colorTitular, setColorTitular] = useState('#facc15');
  const [fuenteTitular, setFuenteTitular] = useState('moderna');
  const [posicion, setPosicion] = useState<DisenoTexto>('banda');
  const [formato, setFormato] = useState<FormatoArte>('cuadrado');
  const [arte, setArte] = useState<string | null>(null);
  const [armandoArte, setArmandoArte] = useState(false);

  // --- Video con movimiento ---
  const [movimiento, setMovimiento] = useState<IdMovimiento>('acercar');
  const [video, setVideo] = useState<ResultadoMovimiento | null>(null);
  const [haciendoVideo, setHaciendoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);

  // --- Enfoque (el ángulo) y ocasión (la fecha o el motivo) ---
  const [enfoque, setEnfoque] = useState(() => leerGuardado(CLAVE_ENFOQUE, 'antojo'));
  const [ocasionId, setOcasionId] = useState(() =>
    ocasion ? 'personalizada' : leerGuardado(CLAVE_OCASION, 'ninguna')
  );
  const [ocasionLibre, setOcasionLibre] = useState(ocasion || '');

  const elegirEnfoque = (id: string) => { setEnfoque(id); guardar(CLAVE_ENFOQUE, id); };
  const elegirOcasion = (id: string) => { setOcasionId(id); guardar(CLAVE_OCASION, id); };

  /** Guarda el contacto apenas cambia, para no perderlo. */
  const actualizarContacto = (cambios: Partial<ConfigNegocio>) => {
    setContacto((prev) => {
      const nuevo = { ...prev, ...cambios };
      setConfigNegocio(nuevo);
      return nuevo;
    });
  };
  const inputFoto = useRef<HTMLInputElement>(null);

  /**
   * Arma la imagen final cada vez que cambia algo: efecto, titular, color,
   * letra, posición o formato. Lo que se ve acá es EXACTAMENTE lo que se publica.
   */
  useEffect(() => {
    if (!abierto) return;
    if (!imagen) { setArte(null); return; }
    let vivo = true;
    setArmandoArte(true);
    const t = setTimeout(async () => {
      try {
        const conEfecto = await aplicarEfecto(imagen, efecto);
        const compuesta = titular.trim()
          ? await generarArte({
              imagen: conEfecto,
              titular: titular.trim(),
              colorTexto: colorTitular,
              fuente: fuenteTitular,
              diseno: posicion,
              formato,
            })
          : conEfecto;
        if (vivo) setArte(compuesta);
      } catch {
        if (vivo) setArte(null);
      } finally {
        if (vivo) setArmandoArte(false);
      }
    }, 320);
    return () => { vivo = false; clearTimeout(t); };
  }, [abierto, imagen, efecto, titular, colorTitular, fuenteTitular, posicion, formato]);

  if (!abierto) return null;

  const alternarCanal = (c: Canal) =>
    setSeleccionados((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  /** Lee un archivo y lo devuelve como data URL. */
  const leerArchivo = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!archivos.length) return;

    const pesadas = archivos.filter((f) => f.size > 8 * 1024 * 1024);
    if (pesadas.length) {
      toast.error(`${pesadas.length} foto(s) pesan más de 8MB y se dejaron por fuera.`);
    }
    const buenas = archivos.filter((f) => f.size <= 8 * 1024 * 1024).slice(0, MAX_FOTOS);
    if (!buenas.length) return;

    try {
      const nuevas = await Promise.all(buenas.map(leerArchivo));
      const eraPrimera = fotos.length === 0;
      setFotos((prev) => [...prev, ...nuevas].slice(0, MAX_FOTOS));
      setResultados(null);
      setVideo(null);
      // Apenas entra la primera foto, la IA la mira y escribe los dos textos sola.
      // Si Gonzalo ya escribió algo, no se lo pisa.
      if (eraPrimera && !texto.trim() && !titular.trim()) {
        toast.info('Mirando la foto para escribir los textos…');
        asistirConIA(nuevas[0]);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudieron cargar las fotos.');
    }
  };

  const quitarFoto = (i: number) => {
    setFotos((prev) => prev.filter((_, x) => x !== i));
    setVideo(null);
  };

  const moverFoto = (i: number, hacia: -1 | 1) => {
    setFotos((prev) => {
      const destino = i + hacia;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
    setVideo(null);
  };

  /** Arma el video con el movimiento elegido. Se graba en vivo: tarda lo que dura. */
  const crearVideo = async () => {
    if (!fotos.length) { toast.error('Sube al menos una foto.'); return; }
    setHaciendoVideo(true);
    setProgresoVideo(0);
    try {
      // Se usan las fotos CON el efecto de color ya grabado adentro.
      const conEfecto = await Promise.all(fotos.map((f) => aplicarEfecto(f, efecto)));
      const r = await generarVideoMovimiento({
        imagenes: conEfecto,
        movimiento,
        formato: formato === 'cuadrado' ? 'cuadrado' : formato === 'horizontal' ? 'horizontal' : 'vertical',
        titular: titular.trim() || undefined,
        colorTexto: colorTitular,
        fuente: fuenteTitular,
        onProgreso: setProgresoVideo,
      });
      setVideo(r);
      toast.success(`Video listo (${r.segundos.toFixed(0)}s, .${r.extension})`);
      // Queda guardado en la biblioteca, con enlace público: es lo que va a
      // hacer falta el día que se publique el video automáticamente.
      subirMedio({ contenido: r.blob, tipo: 'video', marca, origen: 'flash' })
        .catch((e) => console.warn('[marketing] el video no se pudo guardar:', e?.message));
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo hacer el video.');
    } finally {
      setHaciendoVideo(false);
    }
  };

  /** Pide los DOS textos a la IA — mirando la foto de verdad. */
  const asistirConIA = async (fotoNueva?: string) => {
    const foto = fotoNueva || imagen;
    setGenerandoIA(true);
    try {
      const quien = marca === 'andrea'
        ? 'la marca personal de Andrea Cadena, repostera de Dulce Placer'
        : 'la Panadería Dulce Placer';
      const prompt = `Eres copywriter de marketing gastronómico para ${quien}, un negocio colombiano.
${foto
  ? 'MIRA LA FOTO ADJUNTA CON ATENCIÓN. Identifica exactamente qué producto es (torta, pan, postre, galleta, lo que sea), de qué sabor parece y cómo está decorado, y NÓMBRALO. No hables de un producto que no esté en la foto.'
  : 'No hay foto: escribe de forma general, sin inventar qué producto es.'}
${construirContexto(enfoque, ocasionId, ocasionLibre)}

Tienes que escribir DOS textos distintos:

1) TITULAR — es el que va ESCRITO ENCIMA DE LA FOTO. Máximo 5 palabras y máximo ${LARGO_TITULAR} caracteres. Tiene que ser corto de verdad para que NO tape el producto. Sin emojis, sin comillas, sin punto final. Que enganche: un antojo, no una descripción.

2) TEXTO — es la descripción que va DEBAJO de la publicación. Máximo 4 renglones, español de Colombia, 2 o 3 emojis, y un cierre que invite a escribir por WhatsApp o pasar al local.

REGLAS: no inventes direcciones, calles, ciudades, teléfonos, precios ni testimonios. No uses referencias de otros países.
NO escribas el número de WhatsApp ni ningún enlace: eso se agrega automáticamente al final. Tu cierre debe invitar a escribir o pasar, sin dar el dato.

FORMATO DE RESPUESTA (obligatorio, sin nada más, cada uno en su renglón):
TITULAR: (el texto corto que va sobre la foto)
TEXTO: (el texto de la publicación)
HASHTAGS: (entre 6 y 10 hashtags separados por espacio, mezclando los de la marca con los del producto)`;

      let acumulado = '';
      await consultarAgente('influencer', prompt, (chunk) => { acumulado += chunk; }, foto || undefined);

      if (!acumulado.trim()) {
        toast.error('La IA no devolvió texto. Intenta de nuevo.');
        return;
      }

      // La IA responde con TITULAR: … TEXTO: … HASHTAGS: … — se separan aquí.
      const mTitular = acumulado.match(/TITULAR\s*:\s*([^\n]*)/i);
      const mTexto = acumulado.match(/TEXTO\s*:\s*([\s\S]*?)(?=HASHTAGS\s*:|$)/i);
      const mTags = acumulado.match(/HASHTAGS\s*:\s*([\s\S]*)/i);

      const soloTitular = (mTitular ? mTitular[1] : '')
        .replace(/["'«»*_]/g, '')
        .replace(/[.\s]+$/, '')
        .trim()
        .slice(0, LARGO_TITULAR);
      const soloTexto = (mTexto ? mTexto[1] : acumulado).trim();
      const soloTags = mTags ? mTags[1].replace(/\s+/g, ' ').trim() : '';

      if (soloTitular) setTitular(soloTitular);
      if (soloTexto) setTexto(soloTexto);
      if (soloTags) setHashtags(soloTags);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el texto con IA.');
    } finally {
      setGenerandoIA(false);
    }
  };

  const despachar = async () => {
    if (seleccionados.length === 0) { toast.error('Elige al menos una red.'); return; }
    if (!texto.trim()) { toast.error('Falta el texto de la publicación.'); return; }

    const directos = seleccionados.filter((c) => CANALES.find((x) => x.id === c)?.directo);
    if (directos.length > 0 && !imagen) {
      toast.error('Facebook e Instagram necesitan una foto.');
      return;
    }

    setPublicando(true);
    setResultados(null);
    const salida: ResultadoCanal[] = [];

    try {
      // Se publica EXACTAMENTE la imagen de la vista previa: con el efecto
      // grabado adentro y con el titular escrito encima.
      let imagenFinal: string | null = arte;
      if (imagen && !imagenFinal) {
        const conEfecto = await aplicarEfecto(imagen, efecto);
        imagenFinal = titular.trim()
          ? await generarArte({
              imagen: conEfecto,
              titular: titular.trim(),
              colorTexto: colorTitular,
              fuente: fuenteTitular,
              diseno: posicion,
              formato,
            })
          : conEfecto;
      }

      // Todo queda guardado ANTES de publicar: las fotos van al depósito de
      // Supabase (de ahí sale el enlace público que Instagram necesita) y la
      // publicación queda anotada en el historial, salga bien o salga mal.
      let urlArte: string | null = null;
      try {
        if (imagenFinal) {
          const guardada = await subirMedio({
            contenido: imagenFinal, tipo: 'imagen', marca, origen: 'flash',
          });
          urlArte = guardada.url;
        }
        // Las fotos originales también se guardan, para reusarlas después.
        if (fotos.length) subirVariasFotos(fotos, marca, 'flash-original');
      } catch (e: any) {
        console.warn('[marketing] no se pudo guardar en la biblioteca:', e?.message);
      }

      // 1) el cierre con el WhatsApp real  2) los hashtags al final
      const conCierre = agregarCierre(texto, contacto);
      const textoFinal = incluirHashtags && hashtags.trim()
        ? unirTextoYHashtags(conCierre, hashtags.trim().split(/\s+/))
        : conCierre;

      const idHistorial = await guardarPublicacion({
        marca,
        enfoque, ocasion: ocasionId, ocasion_libre: ocasionLibre || null,
        titular: titular.trim() || null,
        texto: textoFinal,
        hashtags: hashtags.trim() || null,
        color_titular: colorTitular, fuente_titular: fuenteTitular,
        posicion_titular: posicion, efecto, formato, movimiento,
        redes: seleccionados,
        arte_url: urlArte,
        estado: 'publicando',
        origen: 'flash',
      });

      // --- Facebook / Instagram: publicación real desde la app ---
      if (directos.length > 0 && imagenFinal) {
        const red = directos.length === 2 ? 'AMBAS' : directos[0] as 'FACEBOOK' | 'INSTAGRAM';
        const r = await publicarDirecto({ red, texto: textoFinal, imagen: imagenFinal });
        for (const res of r.resultados) {
          salida.push({
            canal: res.red as Canal,
            ok: res.ok,
            detalle: res.ok ? 'Publicado' : (res.error || 'Error desconocido'),
            enlace: res.enlace,
          });
        }
      }

      // --- WhatsApp / TikTok: van al flujo de N8N ---
      for (const canal of seleccionados) {
        if (CANALES.find((x) => x.id === canal)?.directo) continue;
        try {
          await publicarEnRedSocial({
            redSocial: canal as 'WHATSAPP' | 'TIKTOK',
            texto: textoFinal,
            imagenUrl: imagenFinal,
            estrategia: ocasion || 'publicacion-flash',
          });
          salida.push({ canal, ok: true, detalle: 'Enviado a N8N' });
        } catch (e: any) {
          salida.push({ canal, ok: false, detalle: e?.message || 'N8N no respondió' });
        }
      }

      setResultados(salida);
      const buenos = salida.filter((s) => s.ok).length;

      // Se cierra el registro con lo que de verdad respondieron las redes.
      if (idHistorial) {
        const fb = salida.find((r) => r.canal === 'FACEBOOK');
        const ig = salida.find((r) => r.canal === 'INSTAGRAM');
        actualizarPublicacion(idHistorial, {
          estado: buenos === salida.length ? 'publicada' : (buenos > 0 ? 'publicada' : 'fallida'),
          publicada_en: new Date().toISOString(),
          resultados: salida,
          enlace_facebook: fb?.enlace || null,
          enlace_instagram: ig?.enlace || null,
          error: salida.filter((r) => !r.ok).map((r) => `${r.canal}: ${r.detalle}`).join(' | ') || null,
        });
      }

      if (buenos === salida.length) toast.success(`Publicado en ${buenos} red(es) 🚀`);
      else if (buenos > 0) toast.error(`Salió en ${buenos} de ${salida.length}. Mira el detalle.`);
      else toast.error('No se pudo publicar en ninguna red.');
    } catch (e: any) {
      toast.error(e?.message || 'Falló la publicación.');
    } finally {
      setPublicando(false);
    }
  };

  const ayudaPosicion = POSICIONES.find((p) => p.id === posicion)?.ayuda || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-950 border-2 border-orange-300 dark:border-orange-900/50 rounded-2xl p-5 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">

        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-600">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                Publicación Flash 360°
              </h4>
              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                {marca === 'andrea' ? 'Andrea Influencer' : 'Panadería Dulce Placer'}
                {ocasion ? ` · ${ocasion}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enfoque y ocasión — definen CÓMO escribe la IA */}
        <div className="space-y-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> ¿Qué enfoque le damos?
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
              {ENFOQUES_FLASH.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => elegirEnfoque(e.id)}
                  title={e.instruccion}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold text-left border-2 transition-all ${
                    enfoque === e.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  {e.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> ¿Para qué ocasión?
            </label>
            <select
              value={ocasionId}
              onChange={(e) => elegirOcasion(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {OCASIONES_FLASH.map((o) => (
                <option key={o.id} value={o.id}>{o.etiqueta}</option>
              ))}
            </select>
            {ocasionId === 'personalizada' && (
              <input
                value={ocasionLibre}
                onChange={(e) => setOcasionLibre(e.target.value)}
                placeholder="Ej: aniversario 5 años de la panadería"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            )}
            <p className="text-[10px] text-slate-500 leading-relaxed">
              El enfoque es el ángulo y la ocasión es el motivo: se combinan. La IA
              tiene prohibido escribir la fecha exacta, para que nunca publique un día equivocado.
            </p>
          </div>
        </div>

        {/* Fotos — una o varias */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Fotos {fotos.length > 0 && <span className="text-slate-400 font-semibold">({fotos.length}/{MAX_FOTOS})</span>}
            </label>
            {fotos.length > 0 && (
              <button
                onClick={() => inputFoto.current?.click()}
                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar más
              </button>
            )}
          </div>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={subirFoto}
          />

          {fotos.length > 0 ? (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {fotos.map((f, i) => (
                  <div
                    key={i}
                    className={`shrink-0 relative rounded-xl overflow-hidden border-2 ${
                      i === 0 ? 'border-orange-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <img src={f} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover" />
                    {i === 0 && (
                      <span className="absolute top-0 left-0 bg-orange-500 text-white text-[8px] font-black px-1 py-0.5 rounded-br-md">
                        PRINCIPAL
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarFoto(i)}
                      title="Quitar esta foto"
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 flex bg-black/55">
                      <button
                        type="button"
                        onClick={() => moverFoto(i, -1)}
                        disabled={i === 0}
                        title="Mover antes"
                        className="flex-1 text-white disabled:opacity-25 flex justify-center py-0.5 hover:bg-white/20"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverFoto(i, 1)}
                        disabled={i === fotos.length - 1}
                        title="Mover después"
                        className="flex-1 text-white disabled:opacity-25 flex justify-center py-0.5 hover:bg-white/20"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                La <b>principal</b> es la que se publica como imagen. Las demás solo se usan
                para el video: carrusel, boomerang y 360. El orden manda — muévelas con las flechitas.
              </p>
            </>
          ) : (
            <button
              onClick={() => inputFoto.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-bold">Subir foto(s) del producto</span>
            </button>
          )}
        </div>

        {/* Vista previa de la imagen final — lo que realmente se publica */}
        {imagen && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-orange-600" /> Así se va a publicar
              </label>
              {armandoArte && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> armando…
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden border-2 border-orange-200 dark:border-orange-900/40 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <img
                src={arte || imagen}
                alt="Vista previa de la publicación"
                className="w-full max-h-64 object-contain"
              />
            </div>
          </div>
        )}

        {/* TEXTO 1 — el que va ESCRITO SOBRE LA FOTO */}
        {imagen && (
          <div className="space-y-2 rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20 p-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> Texto 1 · encima de la foto
              </label>
              <span className={`text-[10px] font-bold ${titular.length > LARGO_TITULAR - 12 ? 'text-red-600' : 'text-slate-400'}`}>
                {titular.length}/{LARGO_TITULAR}
              </span>
            </div>

            <div className="flex gap-1.5">
              <input
                value={titular}
                maxLength={LARGO_TITULAR}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Ej: EL ANTOJO DE HOY"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <BotonMicrofono
                onTexto={(f) => setTitular((prev) => ((prev ? prev + ' ' : '') + f).slice(0, LARGO_TITULAR))}
                titulo="Dictar el texto que va sobre la foto"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Corto a propósito: si se alarga empieza a tapar el producto. Déjalo vacío
              si quieres publicar la foto limpia, sin letras encima.
            </p>

            {/* Color */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Color de la letra
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COLORES_TEXTO.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorTitular(c.valor)}
                    title={c.nombre}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${
                      colorTitular === c.valor
                        ? 'border-slate-900 dark:border-white scale-110 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.valor }}
                  />
                ))}
                <label
                  className="w-7 h-7 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-orange-400"
                  title="Cualquier otro color"
                >
                  <input
                    type="color"
                    value={colorTitular}
                    onChange={(e) => setColorTitular(e.target.value)}
                    className="w-0 h-0 opacity-0"
                  />
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                </label>
              </div>
            </div>

            {/* Tipo de letra */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Type className="w-3 h-3" /> Tipo de letra
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {FUENTES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFuenteTitular(f.id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] border-2 transition-all ${
                      fuenteTitular === f.id
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-300'
                    }`}
                    style={{ fontFamily: f.familia, fontWeight: f.peso as any }}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Dónde va */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <LayoutTemplate className="w-3 h-3" /> ¿Dónde lo pongo?
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {POSICIONES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPosicion(p.id)}
                    title={p.ayuda}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${
                      posicion === p.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{ayudaPosicion}</p>
            </div>

            {/* Formato */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Crop className="w-3 h-3" /> Tamaño
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {FORMATOS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormato(f.id)}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${
                      formato === f.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {f.nombre}
                    <span className="block text-[8px] font-semibold opacity-70">{f.nota}</span>
                  </button>
                ))}
              </div>
              {formato === 'vertical' && seleccionados.includes('INSTAGRAM') && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Ojo: el vertical 9:16 es para historias y reels. Instagram puede rechazarlo
                  en el feed — para feed va mejor <b>Cuadrado</b>.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Efectos sobre la foto */}
        {imagen && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-indigo-600" /> Efecto de la foto
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {EFECTOS.map((ef) => {
                const activo = efecto === ef.id;
                return (
                  <button
                    key={ef.id}
                    type="button"
                    onClick={() => setEfecto(ef.id)}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      activo ? 'border-orange-500 shadow-md scale-105' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                    title={ef.nombre}
                  >
                    <img
                      src={imagen}
                      alt={ef.nombre}
                      className="w-14 h-14 object-cover"
                      style={{ filter: ef.filtro === 'none' ? undefined : ef.filtro }}
                    />
                    <span className={`block text-[9px] font-bold py-0.5 px-1 ${
                      activo ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      {ef.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              El efecto queda grabado en la foto que se publica, no es solo vista previa.
            </p>
          </div>
        )}

        {/* Video con movimiento */}
        {fotos.length > 0 && (
          <div className="space-y-2 rounded-xl border border-fuchsia-200 dark:border-fuchsia-900/40 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-fuchsia-900 dark:text-fuchsia-200 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Video con movimiento
              </label>
              <span className="text-[10px] text-slate-400">
                {fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {movimientosDisponibles(fotos.length).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMovimiento(m.id); setVideo(null); }}
                  title={m.descripcion}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold text-left border-2 transition-all ${
                    movimiento === m.id
                      ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-fuchsia-300'
                  }`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {buscarMovimiento(movimiento).descripcion}
            </p>

            {fotos.length < 3 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Con más fotos se desbloquean el <b>carrusel</b> (2 o más) y el <b>360°</b> (3 o más).
                Para un 360 de verdad, tómale fotos a la torta desde varios lados.
              </p>
            )}

            <button
              type="button"
              onClick={crearVideo}
              disabled={haciendoVideo || publicando}
              className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-60 text-white font-black text-[11px] uppercase tracking-wide flex items-center justify-center gap-2 transition-all"
            >
              {haciendoVideo
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Grabando… {progresoVideo}%</>
                : <><Film className="w-3.5 h-3.5" /> Crear el video</>}
            </button>

            {haciendoVideo && (
              <>
                <div className="h-1.5 rounded-full bg-fuchsia-100 dark:bg-fuchsia-950 overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-600 transition-all duration-200"
                    style={{ width: `${progresoVideo}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Se graba en vivo: un video de 5 segundos tarda 5 segundos. No cierres esta ventana.
                </p>
              </>
            )}

            {video && !haciendoVideo && (
              <div className="space-y-1.5">
                <video
                  src={video.url}
                  controls
                  loop
                  playsInline
                  className="w-full max-h-64 rounded-xl bg-black"
                />
                <button
                  type="button"
                  onClick={() => descargarVideoMovimiento(video, 'dulce-placer-video')}
                  className="w-full py-2 rounded-xl border-2 border-fuchsia-300 dark:border-fuchsia-800 text-fuchsia-700 dark:text-fuchsia-300 font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/40"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar el video (.{video.extension})
                </button>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Por ahora el video se descarga y lo subes tú como reel o historia. El botón
                  de publicar de abajo manda la <b>imagen</b>, no el video — publicar video
                  automáticamente es el paso que sigue.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Redes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            ¿A dónde lo mandamos? (puedes elegir varias)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CANALES.map((c) => {
              const Icono = c.icono;
              const activo = seleccionados.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternarCanal(c.id)}
                  className={`px-2 py-2.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all border-2 ${
                    activo
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Icono className={`w-4 h-4 ${activo ? '' : c.color}`} />
                  <span>{c.nombre}</span>
                  {!c.directo && <span className="text-[8px] opacity-70">vía N8N</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* TEXTO 2 — el que va debajo de la publicación */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-slate-500" /> Texto 2 · debajo de la publicación
            </label>
            <button
              type="button"
              onClick={() => asistirConIA()}
              disabled={generandoIA || publicando}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
            >
              {generandoIA
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Escribiendo…</>
                : <><Sparkles className="w-3 h-3" /> Escribir los dos con IA</>}
            </button>
          </div>
          <textarea
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escríbelo, dítalo por micrófono, o pídeselo a la IA (mira la foto y escribe los dos textos)"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none transition-all"
          />
          <div className="flex justify-end">
            <BotonMicrofono
              onTexto={(f) => setTexto((prev) => (prev ? prev + ' ' : '') + f)}
              titulo="Dictar el texto hablando"
            />
          </div>
        </div>

        {/* Hashtags */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-600" /> Hashtags
            </label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirHashtags}
                onChange={(e) => setIncluirHashtags(e.target.checked)}
                className="w-3.5 h-3.5 accent-orange-500"
              />
              Incluirlos al publicar
            </label>
          </div>
          <textarea
            rows={2}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#DulcePlacer #PanArtesanal …  (la IA los propone, o agrégalos tú)"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-indigo-700 dark:text-indigo-300 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none transition-all"
          />
          <div className="flex flex-wrap gap-1">
            {HASHTAGS_SUGERIDOS.map((h) => {
              const puesto = hashtags.toLowerCase().includes(h.toLowerCase());
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHashtags((prev) =>
                    puesto
                      ? prev.split(/\s+/).filter((x) => x.toLowerCase() !== h.toLowerCase()).join(' ')
                      : (prev ? prev.trim() + ' ' : '') + h
                  )}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                    puesto
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pedidos por WhatsApp — el dato real, no inventado por la IA */}
        <div className="space-y-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Pedidos por WhatsApp
            </label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={contacto.incluirCierre}
                onChange={(e) => actualizarContacto({ incluirCierre: e.target.checked })}
                className="w-3.5 h-3.5 accent-emerald-600"
              />
              Agregarlo al final
            </label>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <span className="text-[11px] text-slate-400">+</span>
              <input
                value={contacto.indicativo}
                onChange={(e) => actualizarContacto({ indicativo: limpiarNumero(e.target.value).slice(0, 4) })}
                className="w-8 bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <input
              value={contacto.whatsapp}
              onChange={(e) => actualizarContacto({ whatsapp: limpiarNumero(e.target.value).slice(0, 12) })}
              placeholder="300 123 4567"
              inputMode="numeric"
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              value={contacto.enlace}
              onChange={(e) => actualizarContacto({ enlace: e.target.value })}
              placeholder="Enlace opcional (página, catálogo, YouTube de Andrea…)"
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Cómo va a quedar el cierre */}
          {contacto.incluirCierre && (limpiarNumero(contacto.whatsapp) || contacto.enlace) && (
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Así va a salir al final
                </span>
                <button
                  type="button"
                  onClick={() => setEditandoCierre(!editandoCierre)}
                  className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                >
                  <Pencil className="w-3 h-3" /> {editandoCierre ? 'Listo' : 'Cambiar'}
                </button>
              </div>
              {editandoCierre ? (
                <>
                  <input
                    value={contacto.mensajeCierre}
                    onChange={(e) => actualizarContacto({ mensajeCierre: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Puedes usar <b>{'{whatsapp}'}</b> (el número), <b>{'{link}'}</b> (enlace directo al chat) y <b>{'{enlace}'}</b>.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {construirCierre(contacto)}
                </p>
              )}
            </div>
          )}

          {!limpiarNumero(contacto.whatsapp) && (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Escribe aquí el celular de pedidos y queda guardado. La IA tiene prohibido
              inventar números, así que este es el único que se publica — siempre el correcto.
            </p>
          )}
        </div>

        {/* Resultado real de cada red */}
        {resultados && (
          <div className="space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50 dark:bg-slate-900">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Resultado</p>
            {resultados.map((r) => (
              <div key={r.canal} className="flex items-start gap-1.5 text-[10px]">
                {r.ok
                  ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <span className={r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                    <b>{r.canal}:</b> {r.detalle}
                  </span>
                  {r.ok && r.enlace && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <a
                        href={r.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver publicación
                      </a>
                      {r.canal === 'FACEBOOK' && (
                        <button
                          type="button"
                          onClick={() => compartirEnPerfil(r.enlace as string)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          <Share2 className="w-3 h-3" /> Compartir en mi perfil
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {resultados.some((r) => r.canal === 'FACEBOOK' && r.ok && r.enlace) && (
              <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                La Página y el Instagram ya salieron solos. Facebook no permite que ningún
                programa publique en un perfil personal, por eso ese último paso es un clic tuyo.
              </p>
            )}
          </div>
        )}

        {/* Publicar */}
        <button
          onClick={despachar}
          disabled={publicando || generandoIA || armandoArte}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:opacity-60 text-white font-black text-xs tracking-wide uppercase shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {publicando
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Publicando…</>
            : <><Send className="w-4 h-4" /> Publicar ahora</>}
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed flex items-center justify-center gap-1">
          <ImageIcon className="w-3 h-3" />
          Facebook e Instagram salen directo. WhatsApp y TikTok pasan por N8N.
        </p>
      </div>
    </div>
  );
};

export default PublicacionFlash;
