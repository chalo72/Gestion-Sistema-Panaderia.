/**
 * ODYSSEUS — reglas de vigilancia, prompts y URLs RTSP (Hikvision / V380).
 */
export type ReglaOdysseusId =
  | 'persona'
  | 'caja_atencion'
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
    descripcion: 'Alguien en caja o zona de cobro',
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
    descripcion: 'Actividad sospechosa o fuera de lo normal',
    activa: true,
  },
  {
    id: 'horno_zona',
    label: 'Zona horno / producción',
    descripcion: 'Persona cerca del horno o área de producción',
    activa: false,
  },
  {
    id: 'fuera_horario',
    label: 'Fuera de horario',
    descripcion: 'Si hay gente y el local debería estar cerrado',
    activa: false,
  },
];

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

/** Prompt de ronda automática. */
export const promptEscaneoOdysseus = (nombreCamara: string, reglas: ReglaOdysseus[]): string => {
  return [
    `Cámara: ${nombreCamara}.`,
    'Analiza SOLO la imagen adjunta (panadería Dulce Placer, Canalete).',
    'Reglas activas (solo estas):',
    textoReglasActivas(reglas),
    'Responde en español, muy corto:',
    'NORMAL: …  o  ALERTA: …',
    'Si no ves la imagen: SIN_IMAGEN: …',
    'No inventes. No hables de caja/stock/márgenes.',
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
    'Responde en español, claro y breve (2-5 frases).',
    'Si no ves la imagen: SIN_IMAGEN: no puedo responder sin video.',
    'No inventes personas ni hechos que no se vean.',
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
