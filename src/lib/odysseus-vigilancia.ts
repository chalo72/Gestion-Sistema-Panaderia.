/**
 * ODYSSEUS — reglas de vigilancia, prompts y URLs RTSP (Hikvision / V380).
 */
export type ReglaOdysseusId =
  | 'persona'
  | 'caja_atencion'
  | 'helados_vitrina'
  | 'mostrador_vacio'
  | 'puerta'
  | 'movimiento'
  | 'horno_zona'
  | 'fuera_horario';

export type ReglaOdysseus = {
  id: ReglaOdysseusId;
  label: string;
  descripcion: string;
  activa: boolean;
};

export const REGLAS_ODYSSEUS_DEFAULT: ReglaOdysseus[] = [
  {
    id: 'persona',
    label: 'Personas a la vista',
    descripcion: 'Detectar si hay gente en el encuadre',
    activa: true,
  },
  {
    id: 'caja_atencion',
    label: 'Caja / mostrador',
    descripcion:
      'Zona de cobro: billete a bolsillo, delantal, bolsos bajo la caja, bajo gaveta, manga/ropa; fajo apartado; cambio raro',
    activa: true,
  },
  {
    id: 'helados_vitrina',
    label: 'Helados / vitrina',
    descripcion:
      'Bola o vaso de helado sin cobro, bola de más, helado para sí, regalo al lado, topping aparte, nevera abierta sin cliente',
    activa: true,
  },
  {
    id: 'mostrador_vacio',
    label: 'Mostrador vacío',
    descripcion: 'Parece no haber producto / vitrina vacía (si se ve)',
    activa: false,
  },
  {
    id: 'puerta',
    label: 'Puerta / acceso',
    descripcion: 'Puerta abierta o acceso raro',
    activa: true,
  },
  {
    id: 'movimiento',
    label: 'Situación rara',
    descripcion:
      'Gestos de riesgo: billete a bolsillo/delantal/bolsos bajo caja, arrugar billete, plata bajo gaveta, producto sin cobro',
    activa: true,
  },
  {
    id: 'horno_zona',
    label: 'Zona horno / producción',
    descripcion:
      'Pan que se come o se lleva, bandeja a la puerta trasera o al bolso, mantequilla/queso/chocolate al bolsillo',
    activa: true,
  },
  {
    id: 'fuera_horario',
    label: 'Fuera de horario',
    descripcion: 'Si hay gente y el local debería estar cerrado',
    activa: false,
  },
];

/**
 * Checklist forense (grabaciones YA guardadas en el DVR).
 * Independiente del vivo: se usa solo en Escaneo de histórico.
 * Incluye formas típicas de sacar/ocultar plata de la caja.
 */
export const REGLAS_FORENSES_DVR: { id: string; label: string; detalle: string }[] = [
  {
    id: 'plata_bolsillo',
    label: 'Billete al bolsillo (pantalón / falda)',
    detalle:
      'Mano con billete o fajo que baja al bolsillo del pantalón, falda o short (NO a la gaveta ni al cliente).',
  },
  {
    id: 'plata_delantal',
    label: 'Billete al delantal (frente / pecho)',
    detalle:
      'Mete billete o fajo en el bolsillo frontal del delantal, en el pecho del delantal, o lo desliza detrás del delantal.',
  },
  {
    id: 'bolsos_bajo_caja',
    label: 'Bolsos / bolsas debajo o al pie de la caja',
    detalle:
      'Hay bolsos, bolsas o mochilas en la parte de abajo / al pie de la caja o del mostrador; mete billete o fajo ahí, o saca la mano de ese bolso con plata.',
  },
  {
    id: 'escondite_gaveta',
    label: 'Esconder bajo / detrás / al lado de la gaveta',
    detalle:
      'Mete o saca plata por debajo, detrás o al costado de la gaveta/cajón (no por el flujo normal de cobro hacia el cliente).',
  },
  {
    id: 'billete_arrugado',
    label: 'Arrugar, enrollar u ocultar billete en la mano',
    detalle: 'Arruga, dobla, enrolla o esconde billete en la palma, manga o papel antes de guardarlo fuera de caja.',
  },
  {
    id: 'plata_manga_ropa',
    label: 'Plata en manga, brasier, calcetín o zapato',
    detalle:
      'Lleva la mano con billete hacia manga, escote/brasier, calcetín, zapato o interior de la blusa (gesto de ocultar en el cuerpo).',
  },
  {
    id: 'fajo_fuera_caja',
    label: 'Fajo o billetes fuera del flujo de cobro',
    detalle:
      'Saca varios billetes de la gaveta y los aparta (mesa, debajo de papel, debajo de teclado, cajón lateral) sin entregarlos al cliente.',
  },
  {
    id: 'mano_zona_privada',
    label: 'Mano a cintura / trasero / pecho con plata',
    detalle: 'Tras tocar caja/gaveta, la mano va a cintura, trasero, pecho o bolsillo con algo en la palma.',
  },
  {
    id: 'gaveta_sin_cliente',
    label: 'Gaveta abierta sin cliente',
    detalle: 'Abre gaveta con local vacío o sin persona frente al mostrador; saca billetes sin cobro.',
  },
  {
    id: 'cambio_falso',
    label: 'Cambio / vuelto raro',
    detalle:
      'Entrega billetes al “cliente” o a sí mismo sin que se vea cobro claro, o se queda con parte del vuelto en la mano.',
  },
  {
    id: 'robo',
    label: 'Robo / sustracción',
    detalle: 'Se lleva producto o dinero sin intercambio de cobro visible con cliente.',
  },
  {
    id: 'devolucion_simulada',
    label: 'Devolución simulada',
    detalle: 'Entrega plata “de vuelta” sin que se vea producto devuelto ni cobro previo claro.',
  },
  {
    id: 'consumo_no_registrado',
    label: 'Consumo sin registro',
    detalle: 'Persona del local come o se lleva pan/producto sin gesto de venta/cobro.',
  },
  {
    id: 'producto_regalado',
    label: 'Producto regalado / sin cobro',
    detalle: 'Entrega producto a alguien y no se ve cobro (efectivo, datáfono, Nequi en pantalla).',
  },
  {
    id: 'bodega_gaseosa',
    label: 'Bodega / gaseosas',
    detalle: 'Salida de cajas o paquetes de bodega sin carga de trabajo clara.',
  },
  {
    id: 'entrega_tercero',
    label: 'Plata entregada a un tercero',
    detalle:
      'El billete no va al bolsillo: se lo pasa a otra persona detrás del mostrador o a alguien que “compra” y se va con la plata.',
  },
  {
    id: 'trapo_servilleta',
    label: 'Trapo, servilleta o papel tapa el billete',
    detalle:
      'Cubre el billete con trapo, servilleta o ticket y luego se lleva ese trapo al bolso, delantal o bolsillo.',
  },
  {
    id: 'gaveta_abierta',
    label: 'Gaveta abierta entre clientes',
    detalle: 'La gaveta queda abierta sin nadie cobrando: ventana para sacar plata.',
  },
  {
    id: 'tapa_gaveta',
    label: 'Cuerpo o espalda tapa la gaveta',
    detalle: 'Se pone de espaldas a la cámara o tapa la gaveta con el cuerpo justo al sacar billetes.',
  },
  {
    id: 'salida_con_bulto',
    label: 'Sale del turno con bolsillo o bolso lleno',
    detalle:
      'Al irse, bolsillo, delantal o bolso se ven más llenos; se lleva el bolso que estaba debajo de la caja.',
  },
  {
    id: 'basura_sospechosa',
    label: 'Basura con producto o algo pequeño',
    detalle: 'Tira pan, empaque o un objeto pequeño a la basura y luego saca esa bolsa.',
  },
  {
    id: 'dos_en_gaveta',
    label: 'Dos personas en la gaveta',
    detalle: 'Una habla con el cliente y la otra mete la mano en la caja.',
  },
  {
    id: 'visita_mostrador',
    label: 'Visita detrás del mostrador',
    detalle: 'Alguien que no está cobrando toca gaveta, billetes o el delantal de quien cobra.',
  },
  {
    id: 'helado_sin_cobro',
    label: 'Helado servido sin cobro',
    detalle:
      'En la vitrina de helados: sirve bola, cono o vaso y lo entrega sin plata, datáfono ni celular de pago.',
  },
  {
    id: 'helado_extra',
    label: 'Bola o porción de más',
    detalle: 'Agrega bola, salsa o porción extra que no se cobra (el cliente ya pagó una y recibe otra).',
  },
  {
    id: 'helado_personal',
    label: 'Helado para sí mismo',
    detalle:
      'Quien atiende se sirve una cuchara, vaso o cono y se lo come o lo aparta, sin pasar por caja.',
  },
  {
    id: 'helado_regalo',
    label: 'Helado regalado al lado',
    detalle:
      'Entrega helado a un niño, amigo o persona al costado de la vitrina, sin ir a cobrar.',
  },
  {
    id: 'topping_sin_cobro',
    label: 'Topping o salsa aparte',
    detalle:
      'Saca arequipe, chocolate, galletas o salsa de la zona de helados a un vaso personal o al bolsillo.',
  },
  {
    id: 'nevera_helado_abierta',
    label: 'Nevera de helado abierta sin cliente',
    detalle:
      'Abre la vitrina o el congelador sin cliente enfrente y la mano sale con vaso, bola o pote.',
  },
  {
    id: 'pan_se_come',
    label: 'Se come pan o producto de producción',
    detalle:
      'En horno o mesón de producción: parte, muerde o se come pan, ponqué o producto recién salido, sin registro.',
  },
  {
    id: 'pan_se_lleva',
    label: 'Se lleva pan, bandeja o bolsa',
    detalle:
      'Saca bandeja, bolsa o panes del horno/mesón hacia la puerta, el carro o un bolso personal.',
  },
  {
    id: 'masa_bolsillo',
    label: 'Insumo de producción al bolsillo o bolso',
    detalle:
      'Mantequilla, queso, jamón, chocolate, leche o porción de masa va al bolsillo, delantal o bolso.',
  },
  {
    id: 'bandeja_oculta',
    label: 'Bandeja escondida',
    detalle: 'Mete panes o bandeja debajo de la mesa, en un costal o detrás del horno, fuera de la fila de trabajo.',
  },
  {
    id: 'puerta_trasera',
    label: 'Salida por puerta trasera con producto',
    detalle: 'Sale por la puerta de atrás o de bodega con bolsa, bandeja o caja de producto.',
  },
  {
    id: 'incumplimiento',
    label: 'Incumplimiento de puesto',
    detalle: 'Deja caja, vitrina de helados u horno solos con dinero o producto a la vista.',
  },
];

/**
 * Cómo describir personas en cámara (sin inventar identidad).
 * Dueño / hijos / empleados NO se inventan: hace falta galería de rostros o etiqueta manual.
 */
export const GUIA_IDENTIDAD_CAMARA = [
  'NUNCA inventes nombres, parentesco (“hijo del dueño”, “familiar”) ni rol laboral si no está en una galería que el Director haya cargado.',
  'Solo describe lo visible: detrás del mostrador vs cliente, delantal/uniforme, gorra, cabello, complexión, ropa.',
  'Roles aproximados por posición (no por “quién es”): “persona en caja”, “persona en vitrina”, “cliente frente al mostrador”, “persona en horno/bodega”.',
  'Para saber si es trabajador, dueño o hijo del dueño hace falta: (1) fotos de referencia etiquetadas, o (2) que el Director marque el clip al revisar, o (3) cruce con quién tiene turno/login en caja ese día.',
].join(' ');

const KEY_REGLAS = 'dp_odysseus_reglas_v1';

export const cargarReglasOdysseus = (): ReglaOdysseus[] => {
  try {
    const raw = localStorage.getItem(KEY_REGLAS);
    if (!raw) return REGLAS_ODYSSEUS_DEFAULT.map((r) => ({ ...r }));
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return REGLAS_ODYSSEUS_DEFAULT.map((r) => ({ ...r }));

    return REGLAS_ODYSSEUS_DEFAULT.map((def) => {
      const match = parsed.find(
        (x) => typeof x === 'object' && x !== null && (x as { id?: string }).id === def.id
      ) as { activa?: boolean } | undefined;
      return {
        ...def,
        activa: typeof match?.activa === 'boolean' ? match.activa : def.activa,
      };
    });
  } catch {
    return REGLAS_ODYSSEUS_DEFAULT.map((r) => ({ ...r }));
  }
};

export const guardarReglasOdysseus = (reglas: ReglaOdysseus[]): void => {
  localStorage.setItem(KEY_REGLAS, JSON.stringify(reglas.map((r) => ({ id: r.id, activa: r.activa }))));
};

export const textoReglasActivas = (reglas: ReglaOdysseus[]): string => {
  const activas = reglas.filter((r) => r.activa);
  if (activas.length === 0) {
    return 'Vigila lo general: personas, seguridad básica del local.';
  }
  return activas.map((r) => `- ${r.label}: ${r.descripcion}`).join('\n');
};

/** Prompt de ronda automática (VIVO — distinto del forense DVR). */
export const promptEscaneoOdysseus = (nombreCamara: string, reglas: ReglaOdysseus[]): string => {
  return [
    `Cámara: ${nombreCamara}. VIGILANCIA EN VIVO. Panadería Dulce Placer.`,
    'Analiza SOLO la imagen adjunta.',
    'Reglas activas:',
    textoReglasActivas(reglas),
    'ALERTA si ves plata oculta (bolsillo, delantal, bolso, trapo, tercero) O en helados: bola/vaso sin cobro, helado para sí, topping aparte O en producción: pan que se come o se lleva, insumo al bolsillo, bandeja a la puerta trasera.',
    'Identidad: ' + GUIA_IDENTIDAD_CAMARA,
    'Responde en español, muy corto:',
    'NORMAL: …  o  ALERTA: … (di el gesto concreto)',
    'Si no ves la imagen: SIN_IMAGEN: …',
    'No inventes nombres ni parentesco.',
  ].join('\n');
};

/** Prompt cuando el Director pregunta. */
export const promptPreguntaOdysseus = (
  nombreCamara: string,
  pregunta: string,
  reglas: ReglaOdysseus[]
): string => {
  return [
    `Cámara: ${nombreCamara}.`,
    'Analiza SOLO la imagen adjunta.',
    `Pregunta del Director: ${pregunta}`,
    'Contexto de vigilancia (reglas):',
    textoReglasActivas(reglas),
    'Identidad: ' + GUIA_IDENTIDAD_CAMARA,
    'Responde en español, claro y breve (2-5 frases).',
    'Si no ves la imagen: SIN_IMAGEN: no puedo responder sin video.',
    'No inventes nombres, parentesco ni hechos que no se vean.',
  ].join('\n');
};

export const CATEGORIAS_BITACORA: { id: string; label: string }[] = [
  { id: 'robo', label: 'Robo' },
  { id: 'consumo_no_registrado', label: 'Consumo no registrado (se come producto sin registrar crédito)' },
  { id: 'producto_regalado', label: 'Producto vendido o regalado sin autorización' },
  { id: 'devolucion_simulada', label: 'Devolución de dinero simulada (la venta sigue activa)' },
  { id: 'incumplimiento', label: 'No está haciendo lo que debe (comportamiento / tareas)' },
  { id: 'plata_bolsillo', label: 'Dinero al bolsillo (pantalón / falda)' },
  { id: 'plata_delantal', label: 'Billete al delantal (frente / pecho)' },
  { id: 'bolsos_bajo_caja', label: 'Bolsos / bolsas debajo o al pie de la caja' },
  { id: 'escondite_gaveta', label: 'Esconder plata bajo / detrás / al lado de gaveta' },
  { id: 'billete_arrugado', label: 'Arrugar, enrollar u ocultar billete en la mano' },
  { id: 'plata_manga_ropa', label: 'Plata en manga, brasier, calcetín o zapato' },
  { id: 'fajo_fuera_caja', label: 'Fajo o billetes apartados fuera del cobro' },
  { id: 'cambio_falso', label: 'Cambio / vuelto raro' },
  { id: 'bodega_gaseosa', label: 'Salida sospechosa en bodega / gaseosas' },
  { id: 'gaveta_sin_cliente', label: 'Gaveta abierta sin cliente / sin cobro' },
  { id: 'mano_zona_privada', label: 'Mano a bolsillo/cintura/pecho con plata tras tocar caja' },
  { id: 'entrega_tercero', label: 'Plata entregada a un tercero' },
  { id: 'trapo_servilleta', label: 'Trapo o servilleta tapa el billete' },
  { id: 'gaveta_abierta', label: 'Gaveta abierta entre clientes' },
  { id: 'tapa_gaveta', label: 'Cuerpo tapa la gaveta' },
  { id: 'salida_con_bulto', label: 'Sale del turno con bolso o bolsillo lleno' },
  { id: 'basura_sospechosa', label: 'Basura con producto' },
  { id: 'dos_en_gaveta', label: 'Dos personas en la gaveta' },
  { id: 'visita_mostrador', label: 'Visita detrás del mostrador tocando caja' },
  { id: 'helado_sin_cobro', label: 'Helado servido sin cobro' },
  { id: 'helado_extra', label: 'Bola o porción de helado de más' },
  { id: 'helado_personal', label: 'Helado para sí mismo' },
  { id: 'helado_regalo', label: 'Helado regalado al lado' },
  { id: 'topping_sin_cobro', label: 'Topping o salsa de helados aparte' },
  { id: 'nevera_helado_abierta', label: 'Nevera de helado abierta sin cliente' },
  { id: 'pan_se_come', label: 'Se come pan en producción' },
  { id: 'pan_se_lleva', label: 'Se lleva pan o bandeja de producción' },
  { id: 'masa_bolsillo', label: 'Insumo de producción al bolsillo' },
  { id: 'bandeja_oculta', label: 'Bandeja de pan escondida' },
  { id: 'puerta_trasera', label: 'Salida por puerta trasera con producto' },
];

/**
 * Prompt FORENSE: grabaciones YA guardadas en el DVR (no es vigilancia en vivo).
 * Un fotograma = un instante del disco. Busca anomalías de las reglas forenses.
 */
export const promptEscaneoAlRegresar = (
  nombreCamara: string,
  dias: number,
  momentoIso?: string
): string => {
  const checklist = REGLAS_FORENSES_DVR.map(
    (r) => `- ${r.id}: ${r.label} — ${r.detalle}`
  ).join('\n');
  const cuando = momentoIso
    ? `Momento exacto del disco: ${momentoIso} (úsalo en la descripción con fecha y hora).`
    : `Rango revisado: últimos ${dias} días.`;
  return [
    `Eres ODYSSEUS en modo FORENSE DVR (NO vivo). Cámara: ${nombreCamara}. Dulce Placer, Canalete.`,
    cuando,
    'Esta imagen es un FOTOGRAMA de una grabación antigua ya guardada en el DVR. Tu trabajo: detectar anomalías, no narrar el local.',
    'NO inventes. Identidad: ' + GUIA_IDENTIDAD_CAMARA,
    'Si no hay indicios claros: SIN_ANOMALIA.',
    'Checklist forense (marca solo lo que SE VE):',
    checklist,
    'Según lo que SE VEA en el fotograma, prioriza esa zona:',
    '- Caja: ocultar plata (bolsillo, delantal, bolsos bajo caja, trapo, tercero, gaveta tapada).',
    '- Helados: bola/vaso sin cobro, bola de más, helado para sí, regalo al lado, topping aparte, nevera abierta sin cliente.',
    '- Producción / horno: se come pan, se lleva bandeja o bolsa, insumo (mantequilla, queso, chocolate) al bolsillo, bandeja escondida, puerta trasera con producto.',
    'Responde EXACTAMENTE en 4 líneas:',
    'CLASIFICACION: bueno|regular|malo|por_mejorar',
    `CATEGORIAS: ${REGLAS_FORENSES_DVR.map((r) => r.id).join(',')} (las que apliquen, o "ninguna")`,
    'DESCRIPCION: 2-4 frases: zona (caja, helados o producción) + gesto + a dónde va el producto o la plata. Sin nombres inventados. Si no hay indicios: SIN_ANOMALIA.',
    'REPORTE: título con fecha/hora (ej. "2026-10-14 18:32 · Caja · billete al delantal"). Si SIN_ANOMALIA: REPORTE: ok',
  ].join('\n');
};

/** Extrae línea REPORTE: del análisis forense (título contextualizado). */
export const extraerReporteForense = (texto: string): string | null => {
  const m = texto.match(/REPORTE:\s*([^\n]+)/i);
  if (!m) return null;
  const t = m[1].trim();
  if (!t || /^ok$/i.test(t) || /sin_anomalia/i.test(t)) return null;
  return t.slice(0, 160);
};

/** Prompt para analizar un micro-video (10s) de la Bitácora Visual. */
export const promptAnalisisClipOdysseus = (nombreCamara: string, contextoSistema?: string): string => {
  return [
    `Cámara: ${nombreCamara}. Panadería Dulce Placer.`,
    ...(contextoSistema
      ? [
          `El sistema de caja acaba de registrar: ${contextoSistema}.`,
          'Verifica si lo que se ve coincide (ej.: si se registró una devolución o una salida de caja, ¿se ve entregar dinero o producto? Si se registró una venta, ¿se ve cobrar y entregar?). Si NO coincide o no se ve nada, dilo en la descripción.',
        ]
      : []),
    'Analiza el video/imagen adjunto. Busca ESPECÍFICAMENTE:',
    '1. Robo (alguien se lleva producto o dinero sin pagar).',
    '2. Un trabajador comiéndose un producto sin registrarlo como crédito/consumo.',
    '3. Vender o regalar producto sin autorización.',
    '4. Registrar una devolución de dinero mientras la venta sigue activa (simular una devolución).',
    '5. Comportamiento general: si el trabajador está haciendo lo que debe.',
    'Responde EXACTAMENTE en este formato, 3 líneas, nada más:',
    'CLASIFICACION: bueno|regular|malo|por_mejorar',
    'CATEGORIAS: robo,consumo_no_registrado,producto_regalado,devolucion_simulada,incumplimiento (las que apliquen, separadas por coma, o "ninguna")',
    'DESCRIPCION: 1-2 frases de lo que se ve, en español, sin inventar nada que no se vea.',
    'Si no ves nada relevante o el video no cargó, responde: CLASIFICACION: bueno / CATEGORIAS: ninguna / DESCRIPCION: SIN_IMAGEN: no pude ver la cámara.',
  ].join('\n');
};

/** Interpreta la respuesta de texto de ODYSSEUS al formato de arriba. */
export const parsearRespuestaClipOdysseus = (
  texto: string
): {
  clasificacion: 'bueno' | 'regular' | 'malo' | 'por_mejorar' | null;
  categorias: string[];
  descripcion: string;
  alerta: boolean;
} => {
  const clasMatch = texto.match(/CLASIFICACION:\s*(bueno|regular|malo|por_mejorar)/i);
  const catMatch = texto.match(/CATEGORIAS:\s*([^\n]+)/i);
  const descMatch = texto.match(/DESCRIPCION:\s*([\s\S]+)/i);

  const clasificacion =
    (clasMatch?.[1]?.toLowerCase() as 'bueno' | 'regular' | 'malo' | 'por_mejorar' | undefined) || null;
  const categorias = (catMatch?.[1] || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c && c !== 'ninguna');
  const descripcion = (descMatch?.[1] || texto).trim();
  const alerta = categorias.length > 0 || clasificacion === 'malo';

  return { clasificacion, categorias, descripcion, alerta };
};

/** Prompt del informe de fin de jornada, a partir del resumen de los clips ya analizados. */
export const promptInformeDiarioOdysseus = (resumen: string): string => {
  return [
    'Eres ODYSSEUS. Abajo tienes el resumen de los clips de cámara analizados hoy en la panadería Dulce Placer.',
    'Con base SOLO en esa información (no inventes nada que no esté ahí), organiza el día en 4 grupos:',
    'COSAS BUENAS, COSAS REGULARES, COSAS MALAS, COSAS POR MEJORAR.',
    'Sé breve y concreto, en español, con viñetas cortas. Si un grupo no tiene nada, escribe "Sin novedades".',
    'Si el resumen está vacío, responde: "No hay clips analizados hoy."',
    '',
    'Resumen del día:',
    resumen,
  ].join('\n');
};

export type TipoCamaraPuente = 'v380' | 'hikvision';

/** RTSP Hikvision: canal 1 → 101, canal 2 → 201, … */
export const rtspHikvision = (
  ip: string,
  usuario: string,
  clave: string,
  canal: number
): string => {
  const host = ip.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  const ch = Math.max(1, Math.floor(canal) || 1);
  const code = `${ch}01`;
  const u = encodeURIComponent(usuario || 'admin');
  const p = encodeURIComponent(clave);
  return `rtsp://${u}:${p}@${host}:554/Streaming/Channels/${code}`;
};

export const rtspV380 = (ip: string, usuario: string, clave: string): string[] => {
  const host = ip.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  const u = encodeURIComponent(usuario || 'admin');
  const p = encodeURIComponent(clave);
  return [
    `rtsp://${u}:${p}@${host}:554/live/ch00_0`,
    `rtsp://${u}:${p}@${host}:554/live/ch00_1`,
    `rtsp://${u}:${p}@${host}:554/Streaming/Channels/101`,
    `rtsp://${u}:${p}@${host}:554/onvif1`,
  ];
};

export const construirYamlGo2rtc = (opts: {
  stream: string;
  tipo: TipoCamaraPuente;
  ip: string;
  usuario: string;
  clave: string;
  canal?: number;
}): string => {
  const stream = opts.stream.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'caja';
  const lineas =
    opts.tipo === 'hikvision'
      ? [
          `    - ${rtspHikvision(opts.ip, opts.usuario, opts.clave, opts.canal ?? 1)}`,
          `    # Alternativa substream (si la principal falla):`,
          `    # - ${rtspHikvision(opts.ip, opts.usuario, opts.clave, opts.canal ?? 1).replace(/01$/, '02')}`,
        ]
      : (() => {
          const urls = rtspV380(opts.ip, opts.usuario, opts.clave);
          return [
            `    - ${urls[0]}`,
            `    # Si no hay imagen, prueba UNA (quita el #):`,
            ...urls.slice(1).map((u) => `    # - ${u}`),
          ];
        })();

  return `# Generado desde Dulce Placer → Videovigilancia (${opts.tipo})
# Carpeta: herramientas/puente-cctv/ (junto a INICIAR_PUENTE_CCTV.bat)
# Prueba: http://127.0.0.1:1984/api/stream.mjpeg?src=${stream}

streams:
  ${stream}:
${lineas.join('\n')}

api:
  listen: ":1984"

webrtc:
  listen: ":8555"
`;
};
