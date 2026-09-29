/**
 * ENFOQUES Y OCASIONES — Dulce Placer
 * Creado 2026-09-20, a pedido de Gonzalo.
 *
 * Dos cosas distintas que se combinan:
 *   ENFOQUE  = el ÁNGULO con que se escribe (antojo, historia, encargo…)
 *   OCASIÓN  = la FECHA o el motivo (día de la madre, cumpleaños, navidad…)
 * "Antojo + Día de la Madre" no da el mismo texto que "Por encargo + Día de la Madre".
 *
 * NOTA IMPORTANTE SOBRE LAS FECHAS: aquí NO se guardan fechas (ni "segundo
 * domingo de mayo" ni "19 de septiembre"). Las fuentes colombianas no coinciden
 * en varias de ellas, y un dato malo publicado es peor que no dar el dato. Cada
 * ocasión describe la celebración y le prohíbe a la IA escribir fechas exactas.
 */

export interface Enfoque {
  id: string;
  etiqueta: string;
  /** Lo que se le dice a la IA para que escriba con ese ángulo. */
  instruccion: string;
}

export const ENFOQUES_FLASH: Enfoque[] = [
  {
    id: 'antojo',
    etiqueta: '😋 Antojo',
    instruccion: 'ÁNGULO: puro antojo sensorial. Describe la textura, el olor, lo crujiente o lo esponjoso, lo que se siente al morderlo. Frases cortas y golpeadas. Que dé hambre leerlo.',
  },
  {
    id: 'recien',
    etiqueta: '🔥 Recién horneado',
    instruccion: 'ÁNGULO: el momento. Acaba de salir del horno, está calientico, hay poquito y se acaba. Urgencia real del día, sin exagerar ni prometer cantidades que no sabes.',
  },
  {
    id: 'historia',
    etiqueta: '💛 Historia',
    instruccion: 'ÁNGULO: emocional. Habla de la gente, del momento que se comparte, del recuerdo, de la mesa. Tono cálido y cercano, nada de vender de frente.',
  },
  {
    id: 'directo',
    etiqueta: '📲 Directo al pedido',
    instruccion: 'ÁNGULO: directo, sin rodeos. Llamado a la acción muy claro: escribir por WhatsApp o pasar al local hoy. Concreto y corto.',
  },
  {
    id: 'promocion',
    etiqueta: '🏷️ Promoción',
    instruccion: 'ÁNGULO: precio-valor, que vale la pena. NO inventes precios, descuentos, porcentajes ni fechas límite: habla del valor sin dar cifras, porque los números los pone el dueño.',
  },
  {
    id: 'nuevo',
    etiqueta: '✨ Producto nuevo',
    instruccion: 'ÁNGULO: lanzamiento. Es algo nuevo que sacamos, invita a ser de los primeros en probarlo. Tono de novedad y curiosidad.',
  },
  {
    id: 'encargo',
    etiqueta: '🎂 Por encargo',
    instruccion: 'ÁNGULO: pedidos personalizados. Se hace a la medida: tu fecha, tu sabor, tu decoración. Invita a encargar con tiempo.',
  },
  {
    id: 'proceso',
    etiqueta: '👐 Detrás del horno',
    instruccion: 'ÁNGULO: el oficio y el proceso. La masa, las manos, la madrugada, lo artesanal. Genera confianza mostrando cómo se hace.',
  },
  {
    id: 'dato',
    etiqueta: '💡 Dato curioso',
    instruccion: 'ÁNGULO: enseña algo corto y cierto sobre el producto (cómo se conserva, con qué acompaña bien, por qué es artesanal). Nada de datos nutricionales ni cifras inventadas.',
  },
  {
    id: 'barrio',
    etiqueta: '🏠 Orgullo de barrio',
    instruccion: 'ÁNGULO: cercanía y pertenencia. Somos de aquí, la panadería del barrio, la de toda la vida. Tono de vecino, no de empresa.',
  },
  {
    id: 'pregunta',
    etiqueta: '❓ Pregunta',
    instruccion: 'ÁNGULO: abrir conversación. Termina con una pregunta sencilla para que la gente comente (¿con café o con chocolate?, ¿cuál es tu favorito?). Los comentarios son lo que más mueve el alcance.',
  },
  {
    id: 'fecha',
    etiqueta: '🎉 Fecha especial',
    instruccion: 'ÁNGULO: la celebración manda. Todo el texto gira alrededor de la ocasión elegida y de regalar, compartir o celebrar con el producto.',
  },
];

export function buscarEnfoque(id: string): Enfoque | undefined {
  return ENFOQUES_FLASH.find((e) => e.id === id);
}

export interface Ocasion {
  id: string;
  etiqueta: string;
  /** Lo que se le dice a la IA sobre la celebración. Sin fechas. */
  prompt: string;
}

export const OCASIONES_FLASH: Ocasion[] = [
  { id: 'ninguna', etiqueta: 'Sin ocasión especial', prompt: '' },

  { id: 'cumpleanos', etiqueta: '🎂 Cumpleaños', prompt: 'La publicación es para cumpleaños: la torta del cumpleañero, la sorpresa, cantar el feliz cumpleaños. Invita a encargar la torta con tiempo.' },
  { id: 'madre', etiqueta: '🌷 Día de la Madre', prompt: 'La publicación es para el Día de la Madre en Colombia. Enfócate en el detalle para mamá, la nostalgia, el cariño y consentirla.' },
  { id: 'padre', etiqueta: '👔 Día del Padre', prompt: 'La publicación es para el Día del Padre en Colombia. Enfócate en el detalle para papá, tono cálido y cercano, sin cursilería.' },
  { id: 'amor-amistad', etiqueta: '💛 Amor y Amistad', prompt: 'La publicación es para el Día del Amor y la Amistad en Colombia. Gira alrededor de regalar y compartir con la pareja, los amigos, la familia o consentirse uno mismo. Puedes mencionar el amigo secreto.' },
  { id: 'nino', etiqueta: '🧸 Día del Niño', prompt: 'La publicación es para el Día del Niño en Colombia. Tono alegre y juguetón, pensado en consentir a los chiquitos.' },
  { id: 'mujer', etiqueta: '🌹 Día de la Mujer', prompt: 'La publicación es para el Día de la Mujer. Tono de reconocimiento y respeto, nada condescendiente ni de estereotipos.' },
  { id: 'maestro', etiqueta: '📚 Día del Maestro', prompt: 'La publicación es para el Día del Maestro en Colombia: el detalle para la profe o el profe, agradecimiento.' },
  { id: 'secretaria', etiqueta: '💼 Día de la Secretaria', prompt: 'La publicación es para el Día de la Secretaria en Colombia: el detalle para quien sostiene la oficina.' },
  { id: 'abuelos', etiqueta: '👵 Día de los Abuelos', prompt: 'La publicación es para el Día de los Abuelos: el pan de siempre, el recuerdo, consentir a los abuelos.' },

  { id: 'navidad', etiqueta: '🎄 Navidad', prompt: 'La publicación es de temporada navideña: reuniones, mesa compartida, regalos y el detalle para llevar a la casa ajena.' },
  { id: 'novena', etiqueta: '🕯️ Novena / Aguinaldos', prompt: 'La publicación es para las novenas de aguinaldos: la reunión de cada noche, los buñuelos, la natilla y lo que se lleva para compartir.' },
  { id: 'velitas', etiqueta: '🕯️ Día de las Velitas', prompt: 'La publicación es para el Día de las Velitas en Colombia: la noche de las velas, la familia en la puerta, el chocolate y el pan.' },
  { id: 'ano-nuevo', etiqueta: '🎆 Año Nuevo', prompt: 'La publicación es de fin de año y Año Nuevo: cerrar el año, los propósitos, la mesa de la última noche.' },
  { id: 'reyes', etiqueta: '👑 Día de Reyes', prompt: 'La publicación es para el Día de Reyes: el último día de la temporada navideña, un detalle dulce para cerrarla.' },
  { id: 'halloween', etiqueta: '🎃 Halloween', prompt: 'La publicación es de Halloween: tono divertido, disfraces, dulces y niños.' },
  { id: 'semana-santa', etiqueta: '🕊️ Semana Santa', prompt: 'La publicación es de Semana Santa: tono respetuoso y familiar, los productos de la temporada y la mesa en familia.' },
  { id: 'san-valentin', etiqueta: '❤️ San Valentín / aniversario', prompt: 'La publicación es para celebrar el amor de pareja: aniversario, cita o sorpresa romántica.' },
  { id: 'patrias', etiqueta: '🇨🇴 Fiestas patrias', prompt: 'La publicación es de fiesta patria colombiana: orgullo por lo nuestro, tono alegre y sin política.' },

  { id: 'grados', etiqueta: '🎓 Grados', prompt: 'La publicación es para graduaciones: celebrar al que se gradúa, la torta del grado, el orgullo de la familia.' },
  { id: 'comunion', etiqueta: '⛪ Primera comunión / bautizo', prompt: 'La publicación es para primera comunión o bautizo: tono tierno y familiar, la mesa de la celebración.' },
  { id: 'quinces', etiqueta: '💃 Quince años', prompt: 'La publicación es para una fiesta de quince años: la torta grande, la noche especial, la familia reunida.' },
  { id: 'baby-shower', etiqueta: '🍼 Baby shower', prompt: 'La publicación es para un baby shower: tono tierno, la mesa dulce, celebrar la llegada del bebé.' },
  { id: 'matrimonio', etiqueta: '💍 Matrimonio / aniversario', prompt: 'La publicación es para matrimonios y aniversarios: la torta de la boda, la mesa de postres, celebrar juntos.' },
  { id: 'fiesta', etiqueta: '🎈 Fiesta / reunión', prompt: 'La publicación es para cualquier fiesta o reunión: la mesa para compartir, el pedido para varios, la picada dulce.' },
  { id: 'fin-de-semana', etiqueta: '☀️ Fin de semana', prompt: 'La publicación impulsa el consumo de fin de semana: desayuno en familia, onces, plan de sábado o domingo.' },

  { id: 'personalizada', etiqueta: '✏️ Escribir mi propia ocasión', prompt: '' },
];

export function buscarOcasion(id: string): Ocasion | undefined {
  return OCASIONES_FLASH.find((o) => o.id === id);
}

/**
 * Arma el trozo de instrucción que se le pega al prompt de la IA.
 * `libre` es lo que Gonzalo escriba cuando elige "mi propia ocasión",
 * o la ocasión que llegue desde una campaña del estudio.
 */
export function construirContexto(
  idEnfoque: string, idOcasion: string, libre?: string
): string {
  const partes: string[] = [];

  const enfoque = buscarEnfoque(idEnfoque);
  if (enfoque) partes.push(enfoque.instruccion);

  const ocasion = buscarOcasion(idOcasion);
  if (ocasion?.prompt) partes.push(`OCASIÓN: ${ocasion.prompt}`);
  else if (libre && libre.trim()) partes.push(`OCASIÓN: ${libre.trim()}`);

  if (partes.length) {
    partes.push(
      'SOBRE LAS FECHAS: no escribas la fecha exacta de la celebración (ni el día, ni el mes, ni "este sábado"). Habla de la celebración sin decir cuándo es.'
    );
  }
  return partes.join('\n');
}
