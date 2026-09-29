/**
 * GENERADOR DE CONTENIDO AUTOMÁTICO — Dulce Placer
 * Creado 2026-09-27, a pedido de Gonzalo: "que cuando no tengamos nada que
 * publicar, la IA cree contenido sola y la página siempre esté en movimiento".
 *
 * DE DÓNDE SALE EL CONTENIDO (en este orden):
 *   1. FOTOS QUE YA TIENES. Se reusa una foto de la biblioteca que lleve
 *      tiempo sin publicarse y se le escribe un texto COMPLETAMENTE distinto,
 *      con otro enfoque. La misma torta vuelve como "por encargo" o como
 *      pregunta. La foto es real, es tu producto.
 *   2. TARJETAS DE TEXTO. Una frase sobre el color de la panadería, para los
 *      días sin foto. Instagram no deja publicar sin imagen, así que esto es
 *      lo que llena esos huecos de forma honesta.
 *
 * LO QUE ESTE ARCHIVO NO HACE, A PROPÓSITO: no inventa fotos de productos.
 * Publicar una torta generada por computador como si fuera de la panadería es
 * prometerle al cliente algo que no existe, y esa confianza no se recupera.
 *
 * REGLA DE ORO: nada de lo que aquí se arma se publica solo. Todo queda
 * guardado en estado "espera_aprobacion" para que Gonzalo lo revise.
 */

import { supabase } from '@/lib/supabase';
import { consultarAgente } from '@/constants/agentes';
import { generarArte, COLORES_TEXTO } from '@/lib/motor-arte';
import { subirMedio, guardarPublicacion, type MarcaMarketing } from '@/lib/biblioteca-marketing';
import { buscarEnfoque, ENFOQUES_FLASH } from '@/lib/enfoques';

/** Ideas para los días en que no hay foto nueva del local. */
export interface IdeaSinFoto {
  id: string;
  etiqueta: string;
  /** Lo que se le pide a la IA. */
  instruccion: string;
  /** Si es true, se arma una tarjeta de texto en vez de usar una foto. */
  tarjeta: boolean;
}

export const IDEAS_SIN_FOTO: IdeaSinFoto[] = [
  {
    id: 'pregunta-favorito',
    etiqueta: '❓ ¿Cuál es tu favorito?',
    instruccion: 'Haz una pregunta corta y sencilla para que la gente responda en los comentarios sobre cuál es su producto favorito de la panadería. Nada de listas: una pregunta y ya.',
    tarjeta: true,
  },
  {
    id: 'pregunta-acompanar',
    etiqueta: '☕ ¿Con qué lo acompañas?',
    instruccion: 'Pregunta con qué prefieren acompañar el pan: café, chocolate, avena, jugo. Tono de conversación de barrio, que invite a responder.',
    tarjeta: true,
  },
  {
    id: 'dato-conservar',
    etiqueta: '💡 Cómo conservarlo',
    instruccion: 'Da un consejo corto y CIERTO sobre cómo conservar el pan artesanal para que dure. No inventes cifras ni días exactos si no estás seguro: habla en términos generales.',
    tarjeta: true,
  },
  {
    id: 'dato-artesanal',
    etiqueta: '🌾 Por qué artesanal',
    instruccion: 'Explica en pocas palabras qué hace distinto al pan hecho a mano frente al industrial. Sin atacar a nadie, sin datos nutricionales inventados.',
    tarjeta: true,
  },
  {
    id: 'invitacion-encargo',
    etiqueta: '🎂 Encarga con tiempo',
    instruccion: 'Invita a encargar tortas y pedidos personalizados con anticipación, para cumpleaños o celebraciones. No des precios ni tiempos exactos de entrega.',
    tarjeta: false,
  },
  {
    id: 'invitacion-desayuno',
    etiqueta: '🌅 Desayuno',
    instruccion: 'Invita a arrancar el día con pan fresco. Tono de mañana, cálido, cortito.',
    tarjeta: false,
  },
  {
    id: 'gracias-barrio',
    etiqueta: '🏠 Gracias al barrio',
    instruccion: 'Un mensaje corto de agradecimiento a los clientes del barrio, sin exagerar ni sonar a discurso. Sencillo y sincero.',
    tarjeta: true,
  },
  {
    id: 'detras-horno',
    etiqueta: '👐 La madrugada',
    instruccion: 'Cuenta en pocas palabras el trabajo de madrugada que hay detrás del pan de cada mañana. Que se sienta el oficio, no la queja.',
    tarjeta: false,
  },
  {
    id: 'antojo-suelto',
    etiqueta: '😋 Antojo del día',
    instruccion: 'Puro antojo: describe lo que se siente al morder algo recién horneado. Frases cortas, sensoriales.',
    tarjeta: false,
  },
  {
    id: 'plan-finde',
    etiqueta: '☀️ Plan de fin de semana',
    instruccion: 'Propón el pan o el postre como el plan de la tarde del fin de semana, en familia o con visita.',
    tarjeta: false,
  },
];

export function buscarIdea(id: string): IdeaSinFoto | undefined {
  return IDEAS_SIN_FOTO.find((i) => i.id === id);
}

/**
 * Busca una foto de la biblioteca que lleve rato sin publicarse.
 * Devuelve null si no hay biblioteca todavía.
 */
export async function fotoParaReusar(
  diasDescanso = 21, marca: MarcaMarketing = 'panaderia'
): Promise<{ id: string; url: string } | null> {
  try {
    const { data: fotos, error } = await supabase
      .from('marketing_medios')
      .select('id, url, creado_en')
      .eq('marca', marca)
      .eq('tipo', 'imagen')
      .order('creado_en', { ascending: true })
      .limit(200);
    if (error || !fotos?.length) return null;

    // Qué se ha publicado últimamente, para no repetir.
    const desde = new Date(Date.now() - diasDescanso * 24 * 60 * 60 * 1000).toISOString();
    const { data: recientes } = await supabase
      .from('marketing_publicaciones')
      .select('arte_url, medios')
      .gte('creado_en', desde);

    const usadas = new Set<string>();
    for (const p of recientes || []) {
      if (p.arte_url) usadas.add(p.arte_url);
      const lista = Array.isArray(p.medios) ? p.medios : [];
      for (const m of lista) {
        if (typeof m === 'string') usadas.add(m);
        else if (m?.url) usadas.add(m.url);
      }
    }

    const descansadas = fotos.filter((f) => !usadas.has(f.url));
    // Si todas se usaron, se toma la más antigua: lleva más tiempo sin salir.
    const elegidas = descansadas.length ? descansadas : fotos;
    const foto = elegidas[Math.floor(Math.random() * elegidas.length)];
    return { id: foto.id, url: foto.url };
  } catch {
    return null;
  }
}

/** Fondo liso con los colores de la panadería, para las tarjetas de texto. */
export function fondoDeMarca(ancho = 1080, alto = 1080): string {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite armar la tarjeta.');

  const grad = ctx.createLinearGradient(0, 0, ancho, alto);
  grad.addColorStop(0, '#7c2d12');   // café oscuro
  grad.addColorStop(0.55, '#c2410c'); // naranja horneado
  grad.addColorStop(1, '#f97316');   // naranja claro
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ancho, alto);

  // Textura suave, para que no quede plano
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const r = Math.random() * ancho * 0.05;
    ctx.beginPath();
    ctx.arc(Math.random() * ancho, Math.random() * alto, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/jpeg', 0.92);
}

export interface BorradorAutomatico {
  idea: string;
  enfoque: string;
  titular: string;
  texto: string;
  hashtags: string;
  imagenUrl: string | null;
  esTarjeta: boolean;
}

/**
 * Arma UNA publicación completa sin que Gonzalo suba nada.
 * Corre en el navegador porque necesita dibujar la imagen.
 */
export async function prepararPublicacion(opts: {
  idea?: string;
  enfoque?: string;
  marca?: MarcaMarketing;
  diasDescanso?: number;
}): Promise<BorradorAutomatico> {
  const marca = opts.marca || 'panaderia';
  const idea = buscarIdea(opts.idea || '')
    || IDEAS_SIN_FOTO[Math.floor(Math.random() * IDEAS_SIN_FOTO.length)];
  const enfoque = buscarEnfoque(opts.enfoque || '')
    || ENFOQUES_FLASH[Math.floor(Math.random() * ENFOQUES_FLASH.length)];

  // 1) ¿Foto reusada o tarjeta de texto?
  const foto = idea.tarjeta ? null : await fotoParaReusar(opts.diasDescanso ?? 21, marca);
  const esTarjeta = !foto;

  // 2) El texto, a la IA
  const quien = marca === 'andrea'
    ? 'la marca personal de Andrea Cadena, repostera de Dulce Placer'
    : 'la Panadería Dulce Placer, de San José de Canalete';

  const prompt = `Eres copywriter de marketing gastronómico para ${quien}, un negocio colombiano.

${idea.instruccion}

${enfoque.instruccion}

${esTarjeta
  ? 'NO hay foto: el texto va a ir escrito sobre un fondo de color, así que el TITULAR es lo que la gente va a leer grande. Hazlo bueno.'
  : 'Hay una foto de un producto real de la panadería que ya se publicó antes. NO describas la foto en detalle (no la estás viendo): habla del producto de forma general y del momento, no de colores ni decoraciones específicas.'}

REGLAS: no inventes direcciones, teléfonos, precios, horarios, descuentos ni testimonios. Español de Colombia. No escribas el número de WhatsApp ni enlaces: se agregan solos al final.

FORMATO (obligatorio, cada uno en su renglón):
TITULAR: (máximo 6 palabras, va escrito grande sobre la imagen, sin emojis ni punto final)
TEXTO: (máximo 3 renglones, con 2 emojis)
HASHTAGS: (entre 6 y 9 hashtags separados por espacio)`;

  let crudo = '';
  await consultarAgente('influencer', prompt, (c) => { crudo += c; });
  if (!crudo.trim()) throw new Error('La IA no devolvió contenido.');

  const mTit = crudo.match(/TITULAR\s*:\s*([^\n]*)/i);
  const mTxt = crudo.match(/TEXTO\s*:\s*([\s\S]*?)(?=HASHTAGS\s*:|$)/i);
  const mTag = crudo.match(/HASHTAGS\s*:\s*([\s\S]*)/i);

  const titular = (mTit ? mTit[1] : '').replace(/["'«»*_]/g, '').replace(/[.\s]+$/, '').trim().slice(0, 60);
  const texto = (mTxt ? mTxt[1] : crudo).trim();
  const hashtags = mTag ? mTag[1].replace(/\s+/g, ' ').trim() : '';

  // 3) La imagen
  const base = esTarjeta ? fondoDeMarca() : foto!.url;
  const color = COLORES_TEXTO[Math.floor(Math.random() * 3)].valor; // amarillo, blanco o rosa
  const arte = await generarArte({
    imagen: base,
    titular: titular || 'Dulce Placer',
    firma: 'Panadería Dulce Placer',
    colorTexto: color,
    diseno: esTarjeta ? 'centro' : 'banda',
    formato: 'cuadrado',
  });

  const guardada = await subirMedio({
    contenido: arte, tipo: 'imagen', marca, origen: 'automatico',
    etiquetas: [idea.id, enfoque.id, esTarjeta ? 'tarjeta' : 'reuso'],
  });

  return {
    idea: idea.id,
    enfoque: enfoque.id,
    titular,
    texto,
    hashtags,
    imagenUrl: guardada.url,
    esTarjeta,
  };
}

/**
 * Prepara VARIAS de una, con distintas ideas y enfoques, y las deja
 * guardadas esperando aprobación. Devuelve cuántas salieron bien.
 */
export async function prepararLote(opts: {
  cuantas?: number;
  marca?: MarcaMarketing;
  /** Fechas en las que se quiere publicar cada una, en el mismo orden. */
  fechas?: string[];
}): Promise<{ listas: number; fallidas: number; errores: string[] }> {
  const cuantas = Math.min(10, Math.max(1, opts.cuantas || 3));
  const marca = opts.marca || 'panaderia';

  // Ideas y enfoques distintos para que el lote no salga repetido.
  const ideas = [...IDEAS_SIN_FOTO].sort(() => Math.random() - 0.5).slice(0, cuantas);
  const enfoques = [...ENFOQUES_FLASH].sort(() => Math.random() - 0.5);

  let listas = 0;
  let fallidas = 0;
  const errores: string[] = [];

  for (let i = 0; i < ideas.length; i++) {
    try {
      const borrador = await prepararPublicacion({
        idea: ideas[i].id,
        enfoque: enfoques[i % enfoques.length].id,
        marca,
      });

      await guardarPublicacion({
        marca,
        enfoque: borrador.enfoque,
        ocasion: borrador.idea,
        titular: borrador.titular,
        texto: borrador.texto,
        hashtags: borrador.hashtags,
        redes: ['FACEBOOK', 'INSTAGRAM'],
        arte_url: borrador.imagenUrl,
        estado: 'espera_aprobacion',
        programada_para: opts.fechas?.[i] || null,
        origen: 'automatico',
      });
      listas++;
    } catch (e: any) {
      fallidas++;
      errores.push(e?.message || 'error desconocido');
    }
  }

  return { listas, fallidas, errores };
}
