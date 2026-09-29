import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Image as ImageIcon, Copy, CheckCircle2, Megaphone, Target, TrendingUp, UserCircle, MapPin, Send, Instagram, PlaySquare, FileText, ShoppingBag, Radar, Upload, RefreshCw, MessageCircle, Check, Share2, Facebook, Video, User, Settings2, Sliders, CheckCircle, AlertCircle, Zap, Clock, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/contexts/AuthContext';
import { publicarEnRedSocial, getWebhookUrl, setWebhookUrl, testWebhookConnection, enviarVideoAN8N, getProgramacion, setProgramacion, type ProgramacionEnvio, type FrecuenciaProgramacion } from '@/lib/marketing-api';
import { scrapeViralTrends, type TrendVideo } from '@/lib/viral-scraper';
import type { Producto } from '@/types';
import { VistaPreviaCampana } from '@/components/marketing/VistaPreviaCampana';
import { BotonMicrofono } from '@/components/marketing/BotonMicrofono';
import { PublicacionFlash } from '@/components/marketing/PublicacionFlash';
import { publicarDirecto } from '@/lib/publicar-directo';

const STRATEGIES = [
  { id: 'prueba-social', label: '🔥 Prueba Social (Alta Demanda)', desc: 'Demuestra que estás vendiendo mucho para generar FOMO.' },
  { id: 'antojo', label: '🍰 Antojo Irresistible', desc: 'Enfócate en la textura, el sabor y los sentidos.' },
  { id: 'promocion', label: '💸 Promoción Especial (Mover Inventario)', desc: 'Oferta local urgente para acelerar ventas hoy.' },
  { id: 'avatar-andrea', label: '👱‍♀️ Avatar Andrea (Marca Personal)', desc: 'Guion para que Andrea (o su avatar) enseñe o recomiende algo.' },
  { id: 'local-viral', label: '📍 Local Viral (Dulce Placer)', desc: 'Contenido diseñado para que los vecinos compartan y visiten el local.' }
];

// Ocasiones / ángulos de campaña. Agregado 2026-09-19: antes no existía forma de
// decirle a la IA para qué fecha o con qué enfoque era la campaña.
// Enfoques para generar VARIAS opciones distintas de la misma foto (2026-09-19).
// Gonzalo quiere ver 2-3 campañas terminadas y escoger las que le gusten.
const ENFOQUES = [
  {
    id: 'antojo',
    etiqueta: 'Antojo',
    instruccion: 'ENFOQUE DE ESTA VERSIÓN: puro antojo sensorial. Describe la textura, el olor, el sabor, lo que se siente al morderlo. Frases cortas y golpeadas. Que dé hambre leerlo.',
  },
  {
    id: 'historia',
    etiqueta: 'Historia',
    instruccion: 'ENFOQUE DE ESTA VERSIÓN: emocional y con historia. Habla de la gente, del momento que se comparte, del recuerdo. Tono cálido y cercano, nada de vender de frente.',
  },
  {
    id: 'oferta',
    etiqueta: 'Directa',
    instruccion: 'ENFOQUE DE ESTA VERSIÓN: directa y con urgencia sana. Llamado a la acción muy claro (escribir por WhatsApp, pasar al local hoy). Concreta, sin rodeos.',
  },
];

export interface VarianteCampana {
  id: string;
  etiqueta: string;
  secciones: Record<string, string>;
}

const OCASIONES = [
  { id: 'ninguna',        label: 'Sin ocasión especial',        prompt: '' },
  { id: 'amor-amistad',   label: '💛 Día del Amor y la Amistad', prompt: 'Hoy es el Día del Amor y la Amistad en Colombia (se celebra el tercer sábado de septiembre). La campaña DEBE girar alrededor de regalar y compartir con la pareja, los amigos, la familia o consentirse uno mismo. Menciónalo de forma natural, sin sonar a tarjeta genérica.' },
  { id: 'dia-madre',      label: '🌷 Día de la Madre',           prompt: 'La campaña es para el Día de la Madre. Enfócate en el detalle para mamá, la nostalgia y el cariño.' },
  { id: 'dia-padre',      label: '👔 Día del Padre',             prompt: 'La campaña es para el Día del Padre. Enfócate en el detalle para papá, con tono cálido y cercano.' },
  { id: 'navidad',        label: '🎄 Navidad / Fin de año',      prompt: 'La campaña es de temporada navideña y de fin de año: reuniones, novena, regalos y mesa compartida.' },
  { id: 'halloween',      label: '🎃 Halloween',                 prompt: 'La campaña es de Halloween: tono divertido, disfraces, dulces y niños.' },
  { id: 'amor-pareja',    label: '❤️ San Valentín / aniversario', prompt: 'La campaña es para celebrar el amor de pareja: aniversario, cita o sorpresa romántica.' },
  { id: 'fin-de-semana',  label: '☀️ Fin de semana / desayuno',  prompt: 'La campaña es para impulsar el consumo de fin de semana: desayuno en familia, onces, plan de sábado o domingo.' },
  { id: 'personalizada',  label: '✏️ Escribir mi propio ángulo',  prompt: '' },
];

interface Props {
  productos?: Producto[];
}

export default function MarketingStudio({ productos = [] }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [viralTrends, setViralTrends] = useState<TrendVideo[]>([]);
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});

  // Configuración de Webhook N8N
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [currentWebhookUrl, setCurrentWebhookUrl] = useState(getWebhookUrl());
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<string | null>(null);

  // Fábrica de Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extraerSubtitulos, setExtraerSubtitulos] = useState(true);
  const [generarThumbnail, setGenerarThumbnail] = useState(true);
  const [incluirLogo, setIncluirLogo] = useState(true);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Modo Rápido: solo sube la foto y la app genera + envía sola (Admin, Vendedora, Encargado)
  const [isQuickSending, setIsQuickSending] = useState(false);

  // Ocasión / ángulo de la campaña
  const [selectedOcasion, setSelectedOcasion] = useState('ninguna');
  const [anguloLibre, setAnguloLibre] = useState('');

  // Vista previa antes de publicar (nada sale sin aprobación)
  const [previewAbierta, setPreviewAbierta] = useState(false);
  const [seccionesPreview, setSeccionesPreview] = useState<Record<string, string> | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [modoPreview, setModoPreview] = useState<'panaderia' | 'andrea'>('panaderia');
  const [estrategiaPreview, setEstrategiaPreview] = useState<string>('prueba-social');
  const [isRegenerando, setIsRegenerando] = useState(false);

  // Publicación Flash 360° (diseño Studio 360)
  const [flashAbierto, setFlashAbierto] = useState(false);

  // Varias opciones de campaña para escoger
  const [variantes, setVariantes] = useState<VarianteCampana[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  // A dónde va la campaña al aprobarla. Por defecto al equipo de agentes (N8N),
  // que es el motor del sistema. 'directo' es el atajo para cuando hay afán.
  const [modoPublicacion, setModoPublicacion] = useState<'n8n' | 'directo'>(() => {
    try { return (localStorage.getItem('DP_MODO_PUBLICACION') as 'n8n' | 'directo') || 'n8n'; }
    catch { return 'n8n'; }
  });
  const cambiarModoPublicacion = (m: 'n8n' | 'directo') => {
    setModoPublicacion(m);
    try { localStorage.setItem('DP_MODO_PUBLICACION', m); } catch { /* nada */ }
  };

  // Programación de envío a N8N (cada cuánto y a qué horas publicar)
  const [programacion, setProgramacionState] = useState<ProgramacionEnvio>(getProgramacion());

  const handleSaveProgramacion = () => {
    setProgramacion(programacion);
    toast.success('Programación de publicación guardada.');
  };

  const toggleHoraProgramada = (hora: string) => {
    setProgramacionState(prev => {
      const yaEsta = prev.horas.includes(hora);
      return { ...prev, horas: yaEsta ? prev.horas.filter(h => h !== hora) : [...prev.horas, hora].sort() };
    });
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookStatusMsg(null);
    try {
      const res = await testWebhookConnection(currentWebhookUrl);
      if (res.success) {
        toast.success(res.message);
        setWebhookStatusMsg(`✅ ${res.message}`);
      } else {
        toast.error(res.message);
        setWebhookStatusMsg(`⚠️ ${res.message}`);
      }
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSaveWebhook = () => {
    setWebhookUrl(currentWebhookUrl);
    toast.success('URL del Webhook guardada exitosamente.');
    setShowWebhookConfig(false);
  };

  const handleScrapeTrends = async () => {
    setIsScraping(true);
    try {
      const trends = await scrapeViralTrends(['reposteria', 'panaderia', 'pasteleria']);
      setViralTrends(trends);
      toast.success(`Se encontraron ${trends.length} videos y ganchos virales.`);
    } catch (error) {
      toast.error('Error al consultar el radar viral.');
    } finally {
      setIsScraping(false);
    }
  };
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [selectedProductId, setSelectedProductId] = useState<string>('ninguno');
  const [generatedContent, setGeneratedContent] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async (
    redSocial: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'AVATAR',
    texto: string,
    opts?: { estrategiaOverride?: string; imagenOverride?: string | null; silencioso?: boolean }
  ) => {
    try {
      setIsPublishing(prev => ({ ...prev, [redSocial]: true }));
      await publicarEnRedSocial({
        redSocial,
        texto,
        imagenUrl: opts?.imagenOverride !== undefined ? opts.imagenOverride : imagePreview,
        estrategia: opts?.estrategiaOverride ?? selectedStrategy
      });
      if (!opts?.silencioso) {
        toast.success(`¡Enviado a ${redSocial} con éxito! 🚀`);
      }
      return true;
    } catch (error) {
      if (!opts?.silencioso) {
        toast.error('Error al conectar con la red social. ¿Configuraste el Webhook?');
      }
      return false;
    } finally {
      setIsPublishing(prev => ({ ...prev, [redSocial]: false }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error('La imagen es muy pesada. Máximo 4MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (estrategiaIdOverride?: string, imagenOverride?: string | null, instruccionExtra?: string, sinStream?: boolean): Promise<Record<string, string> | null> => {
    const estrategiaId = estrategiaIdOverride ?? selectedStrategy;
    const imagenParaGenerar = imagenOverride !== undefined ? imagenOverride : imagePreview;
    setIsGenerating(true);
    setGeneratedContent('');

    const estrategia = STRATEGIES.find(s => s.id === estrategiaId);
    const productoObj = productos.find(p => p.id === selectedProductId);
    const nombreProducto = productoObj ? productoObj.nombre : 'mi producto de panadería/repostería';

    let baseContext = `Actúa como un experto copywriter de marketing gastronómico y director creativo. `;

    if (estrategiaId === 'avatar-andrea') {
      baseContext += `El objetivo es posicionar la marca personal de "Andrea Cadena", dueña y repostera experta de Dulce Placer. `;
    } else {
      baseContext += `El objetivo es impulsar las ventas locales de la "Panadería Dulce Placer". `;
    }

    baseContext += `La estrategia a usar es "${estrategia?.label}". El producto estrella de esta campaña es: ${nombreProducto}. `;

    // Ocasión / ángulo elegido por el usuario
    const ocasion = OCASIONES.find(o => o.id === selectedOcasion);
    if (selectedOcasion === 'personalizada' && anguloLibre.trim()) {
      baseContext += `\nÁNGULO ESPECÍFICO DE ESTA CAMPAÑA (obligatorio respetarlo): ${anguloLibre.trim()}\n`;
    } else if (ocasion?.prompt) {
      baseContext += `\nOCASIÓN DE ESTA CAMPAÑA (obligatorio respetarla en TODOS los textos): ${ocasion.prompt}\n`;
    }

    // Instrucción de corrección pedida desde la vista previa
    if (instruccionExtra && instruccionExtra.trim()) {
      baseContext += `\nCORRECCIÓN PEDIDA POR EL DUEÑO (tiene prioridad sobre todo lo demás): ${instruccionExtra.trim()}\n`;
    }

    if (imagenParaGenerar) {
      // 2026-09-19: antes aquí solo se le pedía "inspirarse en los colores", por eso
      // la IA nunca nombraba el producto de la foto. Ahora se le pide identificarlo.
      baseContext += `MIRA LA FOTO ADJUNTA CON ATENCIÓN. Identifica exactamente qué producto de panadería o repostería aparece en ella (por ejemplo: torta, bollo de canela, pan, galleta, postre) y NÓMBRALO en la campaña, describiendo lo que realmente se ve: su textura, su color, su cobertura, su presentación. Si no logras identificarlo con seguridad, descríbelo de forma general SIN inventar un nombre concreto. `;
    }

    if (viralTrends.length > 0) {
      baseContext += `\nIMPORTANTE - TENDENCIAS VIRALES ACTUALES:\nEl navegador fantasma ha detectado que los siguientes videos están virales ahora mismo en TikTok y YouTube Shorts:\n`;
      viralTrends.forEach(trend => {
        baseContext += `- Título: "${trend.titulo}" (${trend.vistas} vistas). Ángulo/Guion: "${trend.guionExtraido}"\n`;
      });
      baseContext += `Por favor, INSPÍRATE en estos ángulos virales, adapta su psicología y ganchos (hooks) al producto "${nombreProducto}", pero dándole la identidad de Dulce Placer.\n`;
    }

    const prompt = `${baseContext}

Genera un plan de contenidos directo y persuasivo con esta estructura EXACTA:

[INSTAGRAM]
(Texto para Instagram y Facebook enfocado en atraer público local. Incluye emojis, hashtags locales y un Call to Action claro para visitar el local o pedir a domicilio)

[WHATSAPP]
(Texto muy corto, cercano y urgente para subir a Estados de WhatsApp o enviar a clientes frecuentes. Debe generar hambre y urgencia)

[TIKTOK_VIRAL]
(Guion exacto para un video corto de 15 a 30 segundos. Formato: Gancho de 3 segundos + Desarrollo + Cierre. Especifíca qué se debe mostrar en cámara en cada segundo)

[AVATAR_PROMPT]
(Un guion de texto exacto para que Andrea, o su Avatar de Inteligencia Artificial, lo lea frente a cámara. Debe sonar natural, experto y empático. Además incluye una breve dirección de arte: cómo debería estar vestida o qué actitud debe tener)`;

    try {
      let accumulatedText = '';
      await consultarAgente('influencer', prompt, (chunk) => {
        accumulatedText += chunk;
        // Cuando se generan varias opciones a la vez no se escribe en el panel,
        // porque se pisarían entre ellas.
        if (!sinStream) setGeneratedContent(accumulatedText);
      }, imagenParaGenerar || undefined);
      if (!sinStream) toast.success('¡Campaña 360° generada con éxito!');
      return parseContent(accumulatedText);
    } catch (error) {
      if (!sinStream) toast.error('Hubo un error generando la campaña.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const parseContent = (content: string) => {
    const sections: Record<string, string> = {};
    const parts = content.split(/\[(INSTAGRAM|WHATSAPP|TIKTOK_VIRAL|AVATAR_PROMPT)\]/i);
    let currentKey = 'OTROS';
    parts.forEach(part => {
      const match = part.toUpperCase().trim();
      if (['INSTAGRAM', 'WHATSAPP', 'TIKTOK_VIRAL', 'AVATAR_PROMPT'].includes(match)) {
        currentKey = match;
      } else if (part.trim()) {
        sections[currentKey] = (sections[currentKey] || '') + part.trim();
      }
    });
    return sections;
  };

  const sections = generatedContent ? parseContent(generatedContent) : {};

  /**
   * Modo Rápido: la vendedora/encargado/admin solo sube una foto y elige a qué rama pertenece
   * (Panadería Dulce Placer o Andrea Influencer). La app genera la campaña completa con IA y la
   * manda sola al Webhook de N8N (todas las redes que apliquen), sin pasar por el flujo manual.
   */
  const handleQuickSend = async (modo: 'panaderia' | 'andrea', fotoDataUrl: string) => {
    const estrategiaId = modo === 'andrea' ? 'avatar-andrea' : 'prueba-social';
    setSelectedStrategy(estrategiaId);
    setImagePreview(fotoDataUrl);
    setIsQuickSending(true);
    try {
      // Se generan VARIAS opciones distintas de la misma foto, al mismo tiempo,
      // para que Gonzalo escoja la que le guste (o varias).
      const resultados = await Promise.all(
        ENFOQUES.map(async (enf) => {
          const secciones = await handleGenerate(
            estrategiaId,
            fotoDataUrl,
            `${enf.instruccion} Esta versión debe quedar claramente distinta de cualquier otra.`,
            true,
          );
          return secciones ? { id: enf.id, etiqueta: enf.etiqueta, secciones } : null;
        }),
      );

      const buenas = resultados.filter(Boolean) as VarianteCampana[];
      if (buenas.length === 0) {
        toast.error('No se pudo generar ninguna opción de campaña.');
        return;
      }

      setVariantes(buenas);
      setSeleccionadas([buenas[0].id]);
      setSeccionesPreview(buenas[0].secciones);
      setImagenPreview(fotoDataUrl);
      setModoPreview(modo);
      setEstrategiaPreview(estrategiaId);
      setPreviewAbierta(true);
      toast.success(`${buenas.length} opciones listas. Escoge las que te gusten 👀`);
    } finally {
      setIsQuickSending(false);
    }
  };

  const alternarSeleccion = (id: string) => {
    setSeleccionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  /** Generar desde el panel manual y abrir también la vista previa. */
  const handleGenerarConPreview = async () => {
    const secciones = await handleGenerate();
    if (!secciones) return;
    setSeccionesPreview(secciones);
    setImagenPreview(imagePreview);
    setModoPreview(selectedStrategy === 'avatar-andrea' ? 'andrea' : 'panaderia');
    setEstrategiaPreview(selectedStrategy);
    setPreviewAbierta(true);
  };

  /** Rehacer la campaña con una corrección pedida desde la vista previa. */
  const handlePedirCambio = async (instruccion: string, idVariante?: string) => {
    setIsRegenerando(true);
    try {
      const enfoque = ENFOQUES.find(e => e.id === idVariante);
      const extra = enfoque ? `${enfoque.instruccion} ${instruccion}` : instruccion;
      const nuevas = await handleGenerate(estrategiaPreview, imagenPreview, extra, true);
      if (nuevas) {
        setSeccionesPreview(nuevas);
        if (idVariante) {
          setVariantes(prev => prev.map(v => v.id === idVariante ? { ...v, secciones: nuevas } : v));
        }
        toast.success('Opción actualizada con tu corrección.');
      } else {
        toast.error('No se pudo rehacer la opción.');
      }
    } finally {
      setIsRegenerando(false);
    }
  };

  /** Publicar de verdad, solo después de que el usuario aprobó en la vista previa. */
  const publicarCampanaAprobada = async () => {
    if (!seccionesPreview) return;
    // Se publica cada opción que el usuario haya marcado. Si no marcó ninguna,
    // se usa la que tiene abierta.
    const aPublicar = variantes.length
      ? variantes.filter(v => seleccionadas.includes(v.id))
      : [{ id: 'unica', etiqueta: 'Campaña', secciones: seccionesPreview }];
    if (aPublicar.length === 0) {
      toast.error('Marca al menos una opción antes de publicar.');
      return;
    }
    setIsQuickSending(true);
    try {
      // ================== CAMINO 1: EL EQUIPO DE AGENTES (N8N) ==================
      // Es el motor del sistema: recibe la campaña completa y él hace el resto
      // (adaptar cada red, programar, producir). Este es el modo por defecto.
      if (modoPublicacion === 'n8n') {
        let enviados = 0;
        let fallidos = 0;
        for (const variante of aPublicar) {
          const s = variante.secciones;
          const objetivos: Array<{ red: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'AVATAR'; texto?: string }> = modoPreview === 'andrea'
            ? [
                { red: 'AVATAR', texto: s['AVATAR_PROMPT'] },
                { red: 'INSTAGRAM', texto: s['INSTAGRAM'] },
                { red: 'WHATSAPP', texto: s['WHATSAPP'] },
              ]
            : [
                { red: 'WHATSAPP', texto: s['WHATSAPP'] },
                { red: 'INSTAGRAM', texto: s['INSTAGRAM'] },
                { red: 'TIKTOK', texto: s['TIKTOK_VIRAL'] },
              ];
          for (const objetivo of objetivos) {
            if (!objetivo.texto) continue;
            const ok = await handlePublish(objetivo.red, objetivo.texto, {
              estrategiaOverride: estrategiaPreview,
              imagenOverride: imagenPreview,
              silencioso: true,
            });
            if (ok) enviados++; else fallidos++;
          }
        }

        if (enviados > 0 && fallidos === 0) {
          toast.success(`Campaña enviada al equipo de agentes en ${enviados} red(es) 🤖`);
          setPreviewAbierta(false);
        } else if (enviados > 0) {
          toast.error(`Solo se enviaron ${enviados} de ${enviados + fallidos}. Revisa el Webhook N8N.`);
        } else {
          toast.error('No se pudo llegar a N8N. Revisa el Webhook, o usa "Publicar ya (directo)".');
        }
        return;
      }

      // ================== CAMINO 2: PUBLICAR YA, SIN N8N ==================
      // Atajo para cuando el PC está apagado o hay afán: la app publica sola.
      if (!imagenPreview) {
        toast.error('Para publicar directo hace falta la foto.');
        return;
      }
      let publicadas = 0;
      for (const variante of aPublicar) {
        const textoRedes = variante.secciones['INSTAGRAM'] || variante.secciones['WHATSAPP'] || '';
        if (!textoRedes) continue;
        const r = await publicarDirecto({ red: 'AMBAS', texto: textoRedes, imagen: imagenPreview });
        const ok = r.resultados.filter(x => x.ok).map(x => x.red);
        const fallo = r.resultados.filter(x => !x.ok);
        if (ok.length) publicadas++;
        fallo.forEach(f => toast.error(`${variante.etiqueta} — ${f.red}: ${f.error}`));
      }
      if (publicadas > 0) {
        toast.success(`${publicadas} opción(es) publicada(s) en Facebook e Instagram ✅`);
        setPreviewAbierta(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo publicar.');
    } finally {
      setIsQuickSending(false);
    }
  };

  const handleQuickFileUpload = (e: React.ChangeEvent<HTMLInputElement>, modo: 'panaderia' | 'andrea') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('La imagen es muy pesada. Máximo 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      handleQuickSend(modo, dataUrl);
    };
    reader.readAsDataURL(file);
    // Limpia el input para poder volver a subir la misma foto si hace falta
    e.target.value = '';
  };

  const HORAS_SUGERIDAS = ['07:00', '08:00', '12:00', '13:00', '16:00', '19:00', '20:00'];

  // Solo mostramos productos elaborados, no ingredientes
  const productosFinales = productos.filter(p => p.tipo !== 'ingrediente').sort((a,b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 border border-fuchsia-500/20">
              <Megaphone className="w-6 h-6" />
            </div>
            Marketing Studio 360°
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor de crecimiento local para Dulce Placer y construcción de marca personal para Andrea.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWebhookConfig(!showWebhookConfig)}
            className="text-xs font-semibold gap-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur"
          >
            <Settings2 className="w-4 h-4 text-fuchsia-500" />
            Webhook N8N
          </Button>

          <Button
            size="sm"
            onClick={() => setFlashAbierto(true)}
            className="text-xs font-black gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 uppercase tracking-wide"
          >
            <Zap className="w-4 h-4" />
            Publicación Flash
          </Button>
        </div>
      </div>

      {/* MODO RÁPIDO: solo sube la foto — para Admin, Vendedora y Encargado */}
      <Card className="border-2 border-dashed border-fuchsia-300 dark:border-fuchsia-800 bg-gradient-to-br from-fuchsia-50/70 to-indigo-50/70 dark:from-fuchsia-950/20 dark:to-indigo-950/20 shadow-xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Modo Rápido: solo sube la foto
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
            Para Administrador, Vendedora o Encargado: elige a quién impulsa la foto y yo genero la campaña y la mando sola a N8N. Sin pasos extra.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PANADERÍA */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="quick-upload-panaderia"
                onChange={(e) => handleQuickFileUpload(e, 'panaderia')}
                disabled={isQuickSending || isGenerating}
              />
              <label
                htmlFor="quick-upload-panaderia"
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-6 text-center cursor-pointer transition-all ${isQuickSending || isGenerating ? 'opacity-60 pointer-events-none' : 'hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'} border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50`}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">🥖 Panadería Dulce Placer</p>
                <p className="text-[11px] text-slate-500">Sube una foto del producto y la mando a WhatsApp, Instagram y TikTok</p>
              </label>
            </div>

            {/* ANDREA INFLUENCER */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="quick-upload-andrea"
                onChange={(e) => handleQuickFileUpload(e, 'andrea')}
                disabled={isQuickSending || isGenerating}
              />
              <label
                htmlFor="quick-upload-andrea"
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-6 text-center cursor-pointer transition-all ${isQuickSending || isGenerating ? 'opacity-60 pointer-events-none' : 'hover:border-fuchsia-400 hover:bg-fuchsia-50/50 dark:hover:bg-fuchsia-950/20'} border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50`}
              >
                <div className="w-12 h-12 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400" />
                </div>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">👱‍♀️ Andrea Influencer</p>
                <p className="text-[11px] text-slate-500">Marca personal de Andrea — mando el guion del avatar, Instagram y WhatsApp</p>
              </label>
            </div>
          </div>

          {(isQuickSending || isGenerating) && (
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
              <RefreshCw className="w-4 h-4 animate-spin" /> Generando campaña y enviando a N8N...
            </div>
          )}
        </CardContent>
      </Card>

      {/* VISTA PREVIA DE LA CAMPAÑA — nada se publica sin aprobación (2026-09-19) */}
      {previewAbierta && seccionesPreview && (
        <Card className="border-2 border-emerald-300 dark:border-emerald-800 bg-white/80 dark:bg-slate-950/60 shadow-2xl animate-in slide-in-from-top-2">
          <CardContent className="p-4 sm:p-6">
            <VistaPreviaCampana
              imagen={imagenPreview}
              secciones={seccionesPreview}
              ocasionLabel={OCASIONES.find(o => o.id === selectedOcasion)?.label}
              publicando={isQuickSending}
              regenerando={isRegenerando || isGenerating}
              onAprobarYPublicar={publicarCampanaAprobada}
              onPedirCambio={handlePedirCambio}
              onCancelar={() => setPreviewAbierta(false)}
              modoPublicacion={modoPublicacion}
              onCambiarModo={cambiarModoPublicacion}
              variantes={variantes}
              seleccionadas={seleccionadas}
              onAlternarSeleccion={alternarSeleccion}
              onVerVariante={(id) => {
                const v = variantes.find(x => x.id === id);
                if (v) setSeccionesPreview(v.secciones);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* PUBLICACIÓN FLASH 360° — publica de una, con IA que ve la foto */}
      <PublicacionFlash
        abierto={flashAbierto}
        onCerrar={() => setFlashAbierto(false)}
        marca={modoPreview}
        imagenInicial={imagenPreview || imagePreview}
        textoInicial={seccionesPreview?.['INSTAGRAM'] || ''}
        ocasion={OCASIONES.find(o => o.id === selectedOcasion && o.id !== 'ninguna')?.label}
      />

      {/* MODAL / PANEL DE CONFIGURACIÓN WEBHOOK */}
      {showWebhookConfig && (
        <Card className="border-fuchsia-200 dark:border-fuchsia-900/50 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 shadow-xl animate-in slide-in-from-top-2">
          <CardHeader className="py-3 px-4 sm:px-6 border-b border-fuchsia-100 dark:border-fuchsia-900/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-fuchsia-950 dark:text-fuchsia-200">
              <Sliders className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" /> Configuración de Enlace N8N / Webhooks
            </CardTitle>
            <CardDescription className="text-xs text-fuchsia-700 dark:text-fuchsia-300">
              Configura la URL del Webhook receptor para auto-publicar en redes y procesar videos en segundo plano.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL del Webhook (N8N / Make / Zapier)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={currentWebhookUrl}
                  onChange={(e) => setCurrentWebhookUrl(e.target.value)}
                  placeholder="http://localhost:5678/webhook/dulce-placer-marketing"
                  className="text-xs font-mono bg-white dark:bg-slate-900"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isTestingWebhook}
                  onClick={handleTestWebhook}
                  className="text-xs whitespace-nowrap"
                >
                  {isTestingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Probar Conexión
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveWebhook}
                  className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white whitespace-nowrap"
                >
                  Guardar
                </Button>
              </div>
              {webhookStatusMsg && (
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                  {webhookStatusMsg}
                </p>
              )}
            </div>

            {/* PROGRAMACIÓN DE PUBLICACIÓN */}
            <div className="space-y-2 pt-4 border-t border-fuchsia-100 dark:border-fuchsia-900/30">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" /> Programación de Publicación (cada cuánto y a qué hora)
              </Label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Esto se manda en cada envío a N8N, para que N8N sepa con qué frecuencia repetir/programar la publicación en vez de publicar todo de inmediato.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500">Frecuencia</Label>
                  <Select value={programacion.frecuencia} onValueChange={(v) => setProgramacionState(prev => ({ ...prev, frecuencia: v as FrecuenciaProgramacion }))}>
                    <SelectTrigger className="w-full bg-white dark:bg-slate-900 h-10 text-xs border-slate-200 dark:border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inmediata">Inmediata (apenas se envía)</SelectItem>
                      <SelectItem value="diaria">Diaria</SelectItem>
                      <SelectItem value="cada_2_dias">Cada 2 días</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500">Horas del día (elige una o varias)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {HORAS_SUGERIDAS.map(hora => (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => toggleHoraProgramada(hora)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${programacion.horas.includes(hora) ? 'bg-fuchsia-600 border-fuchsia-700 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-fuchsia-300'}`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSaveProgramacion}
                className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white whitespace-nowrap mt-1"
              >
                Guardar Programación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          
          {/* SELECCIÓN DE PRODUCTO */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-500" /> 1. ¿Qué vamos a impulsar?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Selecciona un producto de tu inventario (Opcional)</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 h-11 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Elige un producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">-- Campaña de Marca (General) --</SelectItem>
                    {productosFinales.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* OCASIÓN / ÁNGULO — agregado 2026-09-19 */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs text-slate-500">¿Para qué ocasión o con qué ángulo?</Label>
                <Select value={selectedOcasion} onValueChange={setSelectedOcasion}>
                  <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 h-11 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Elige la ocasión..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OCASIONES.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOcasion === 'personalizada' && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
                    <Input
                      value={anguloLibre}
                      onChange={(e) => setAnguloLibre(e.target.value)}
                      placeholder='Escribe o dicta tu ángulo. Ej: "promoción 2x1 solo hoy", "producto nuevo"'
                      className="text-xs bg-white dark:bg-slate-950"
                    />
                    <BotonMicrofono
                      onTexto={(frase) => setAnguloLibre(prev => (prev ? prev + ' ' : '') + frase)}
                      titulo="Dictar el ángulo hablando"
                    />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Lo que elijas aquí se aplica a TODOS los textos de la campaña, también en el Modo Rápido.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* RADAR VIRAL MCP */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radar className="w-4 h-4 text-violet-500" /> Radar Viral (Navegador Fantasma)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <Button 
                onClick={handleScrapeTrends} 
                disabled={isScraping} 
                variant="outline" 
                className="w-full text-xs font-bold border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-violet-900 dark:hover:bg-violet-900/20"
              >
                {isScraping ? <><Radar className="w-4 h-4 mr-2 animate-spin text-violet-500" /> Escaneando TikTok y YouTube...</> : <><Radar className="w-4 h-4 mr-2 text-violet-500" /> Escanear Tendencias de Repostería</>}
              </Button>
              
              {viralTrends.length > 0 && (
                <div className="space-y-3 mt-3">
                  {viralTrends.map(trend => (
                    <div key={trend.id} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{trend.titulo}</span>
                        <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded font-black">{trend.vistas}</span>
                      </div>
                      <p className="text-slate-500 italic">"{trend.guionExtraido}"</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ESTRATEGIA */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-500" /> 2. Elige el Enfoque (Ángulo)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {STRATEGIES.map(strategy => (
                <div key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedStrategy === strategy.id ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                  <h3 className={`text-sm font-bold ${selectedStrategy === strategy.id ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-700 dark:text-slate-300'}`}>{strategy.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{strategy.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* FOTO (OPCIONAL) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-500" /> 3. Referencia Visual (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              {!imagePreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sube una foto del producto</p>
                  <p className="text-[10px] text-slate-500 mt-1">Ayuda a la IA a describir los detalles</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden group">
                  <img src={imagePreview} alt="Preview" className="w-full h-auto object-cover max-h-48 rounded-xl" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm" className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Cambiar foto
                    </Button>
                  </div>
                </div>
              )}
              
              <Button onClick={handleGenerarConPreview} disabled={isGenerating} className="w-full h-12 mt-6 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-500/25 font-black uppercase tracking-wider text-xs">
                {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creando Campaña...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generar Campaña 360°</>}
              </Button>
            </CardContent>
          </Card>

        </div>

        <div className="lg:col-span-8">
          <Card className="h-full border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl min-h-[600px]">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Resultados de la Campaña
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {!generatedContent ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-24">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Selecciona el producto y presiona Generar.</p>
                    <p className="text-xs max-w-sm mx-auto">Crearé los textos virales para TikTok, WhatsApp y los guiones para el avatar de Andrea de forma automática.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* WHATSAPP */}
                  {sections['WHATSAPP'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black tracking-widest text-[10px] uppercase">
                          <MessageCircle className="w-4 h-4" /> 1. Estados de WhatsApp (Venta Rápida)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['WHATSAPP'], 'wa')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['WHATSAPP']}
                            onClick={() => handlePublish('WHATSAPP', sections['WHATSAPP'])} 
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isPublishing['WHATSAPP'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />} 
                            Auto-Publicar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-300 font-medium">
                        {sections['WHATSAPP']}
                      </div>
                    </div>
                  )}

                  {/* INSTAGRAM */}
                  {sections['INSTAGRAM'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '100ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-black tracking-widest text-[10px] uppercase">
                          <Instagram className="w-4 h-4" /> 2. Post Instagram & Facebook (Local)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['INSTAGRAM'], 'ig')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'ig' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['INSTAGRAM']}
                            onClick={() => handlePublish('INSTAGRAM', sections['INSTAGRAM'])} 
                            className="h-8 text-xs gap-1.5 bg-pink-600 hover:bg-pink-700"
                          >
                            {isPublishing['INSTAGRAM'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Facebook className="w-3.5 h-3.5" />} 
                            Auto-Publicar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                        {sections['INSTAGRAM']}
                      </div>
                    </div>
                  )}

                  {/* TIKTOK VIRAL */}
                  {sections['TIKTOK_VIRAL'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '200ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-slate-900 dark:text-white font-black tracking-widest text-[10px] uppercase">
                          <Video className="w-4 h-4" /> 3. Guion TikTok / Reels Viral
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['TIKTOK_VIRAL'], 'tk')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'tk' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['TIKTOK']}
                            onClick={() => handlePublish('TIKTOK', sections['TIKTOK_VIRAL'])} 
                            className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            {isPublishing['TIKTOK'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />} 
                            Mandar a TikTok
                          </Button>
                        </div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 italic shadow-inner">
                        {sections['TIKTOK_VIRAL']}
                      </div>
                    </div>
                  )}

                  {/* AVATAR ANDREA */}
                  {sections['AVATAR_PROMPT'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '300ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400 font-black tracking-widest text-[10px] uppercase">
                          <User className="w-4 h-4" /> 4. Guion para Avatar (Andrea Cadena)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['AVATAR_PROMPT'], 'av')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'av' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['AVATAR']}
                            onClick={() => handlePublish('AVATAR', sections['AVATAR_PROMPT'])} 
                            className="h-8 text-xs gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                          >
                            {isPublishing['AVATAR'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />} 
                            Enviar a IA Avatar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-4 rounded-xl border border-fuchsia-200 dark:border-fuchsia-900/50 whitespace-pre-wrap text-sm text-fuchsia-900 dark:text-fuchsia-300 font-medium">
                        {sections['AVATAR_PROMPT']}
                      </div>
                    </div>
                  )}

                  {sections['OTROS'] && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl whitespace-pre-wrap text-sm">
                      {sections['OTROS']}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FÁBRICA DE VIDEO (PRODUCCIÓN Y N8N) */}
          <Card className="h-auto border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl mt-6">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <PlaySquare className="w-4 h-4 text-rose-500" /> Fábrica de Video Automática (N8N)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* ZONA DE SUBIDA */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Sube el Video o Audio Base</Label>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 50 * 1024 * 1024) {
                          toast.error('El archivo supera los 50MB permitidos.');
                          return;
                        }
                        setVideoFile(f);
                        toast.success(`Archivo cargado: ${f.name}`);
                      }
                    }}
                  />
                  <div 
                    onClick={() => videoInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors group ${videoFile ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      {videoFile ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <Upload className="w-6 h-6 text-slate-400" />}
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {videoFile ? videoFile.name : 'Arrastra la grabación de Andrea'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB - Clic para cambiar` : 'Soporta .MP4, .MOV, .MP3 (Máx 50MB)'}
                    </p>
                  </div>
                </div>

                {/* ZONA DE ÓRDENES */}
                <div className="space-y-4">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">2. Órdenes para N8N</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={extraerSubtitulos} 
                        onChange={(e) => setExtraerSubtitulos(e.target.checked)}
                        className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" 
                      />
                      <span>Extraer Subtítulos Dinámicos IA</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={generarThumbnail} 
                        onChange={(e) => setGenerarThumbnail(e.target.checked)}
                        className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" 
                      />
                      <span>Generar Portada (Thumbnail) Viral</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={incluirLogo} 
                        onChange={(e) => setIncluirLogo(e.target.checked)}
                        className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" 
                      />
                      <span>Añadir Logo de Dulce Placer</span>
                    </label>
                  </div>
                </div>
              </div>

              <Button 
                disabled={isPublishing['N8N_VIDEO']}
                onClick={async () => {
                  setIsPublishing(prev => ({ ...prev, N8N_VIDEO: true }));
                  try {
                    await enviarVideoAN8N({
                      videoNombre: videoFile?.name || 'grabacion_directa.mp4',
                      extraerSubtitulos,
                      generarThumbnail,
                      incluirLogo,
                      estrategia: selectedStrategy
                    });
                    toast.success('¡Video y directivas enviadas a N8N exitosamente! 🚀');
                  } catch (error: any) {
                    toast.error(error.message || 'Error al conectar con el Webhook de N8N. Verifica tu configuración.');
                  } finally {
                    setIsPublishing(prev => ({ ...prev, N8N_VIDEO: false }));
                  }
                }}
                className="w-full h-12 bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white shadow-lg shadow-rose-500/25 font-black uppercase tracking-wider text-xs gap-2"
              >
                {isPublishing['N8N_VIDEO'] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Iniciar Edición IA y Publicar Múltiple
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
