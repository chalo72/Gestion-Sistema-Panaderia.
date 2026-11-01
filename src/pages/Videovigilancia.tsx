import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Shield,
  Search,
  AlertTriangle,
  Play,
  Pause,
  Plus,
  Settings,
  Video,
  Eye,
  ShieldAlert,
  Cpu,
  X,
  RefreshCw,
  Lock,
  FolderOpen,
  Copy,
  Download,
  MessageCircle,
  Send,
  BrainCircuit,
  Film,
  FileText,
  FolderSearch,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import { generateUUID } from '@/lib/safe-utils';
import { useAuth } from '@/contexts/AuthContext';
import { leerEquipoLocal, nombreResponsable } from '@/lib/equipo-turno';
import { OjoIA } from '@/components/videovigilancia/OjoIA';
import { resumenOperativoDia, ventasCercanas } from '@/lib/auditoria-profunda';
import {
  detectarEventos,
  estadoVistoVacio,
  cargarModoClips,
  guardarModoClips,
  siguienteModoClips,
  ETIQUETA_MODO,
  type EstadoVisto,
  type ModoClips,
} from '@/lib/disparadores-video';
import {
  cargarConfigAlertas,
  guardarConfigAlertas,
  estacionActiva,
  setEstacionActiva,
  esCategoriaCritica,
  notificarAlertaVigilancia,
  mantenerPantallaEncendida,
  type ConfigAlertas,
} from '@/lib/alertas-vigilancia';
import {
  cargarReglasOdysseus,
  guardarReglasOdysseus,
  construirYamlGo2rtc,
  promptEscaneoOdysseus,
  promptPreguntaOdysseus,
  promptAnalisisClipOdysseus,
  parsearRespuestaClipOdysseus,
  promptInformeDiarioOdysseus,
  promptEscaneoAlRegresar,
  extraerReporteForense,
  REGLAS_FORENSES_DVR,
  type ReglaOdysseus,
  type TipoCamaraPuente,
} from '@/lib/odysseus-vigilancia';
import {
  subirClipBitacora,
  guardarClipBitacora,
  marcarClipAnalizado,
  buscarClipsBitacora,
  urlFirmadaClip,
  clipsDelDia,
  clipsPorCarpetaUI,
  archivarClipEnCarpetas,
  archivarClipEnBandejaForense,
  archivarBlobEnBandejaForense,
  dataUrlABlob,
  bandejaDesdeAnalisis,
  tituloHallazgoForense,
  nombreCarpetaNube,
  type ClipBitacora,
  type CategoriaBitacora,
  type BandejaForense,
} from '@/lib/bitacora-visual';
import {
  probarConexionDvr,
  buscarGrabacionesDvr,
  capturarFrameDvr,
  muestrearSegmentosDvrForense,
  instantesForensesEnSegmento,
  etiquetaPista,
} from '@/lib/dvr-hikvision';

interface Camara {
  id: string;
  nombre: string;
  url: string;
  tipo: 'snapshot' | 'mjpeg';
  activa: boolean;
  /** Solo UI: no debe persistirse como cámara real */
  esDemo?: boolean;
  deletedAt?: string;
}

type LogBitacora = {
  id: string;
  tiempo: Date;
  mensaje: string;
  alerta: boolean;
};

const DEMOS_UI: Camara[] = [
  {
    id: 'demo-caja',
    nombre: 'Demo · Caja (no es cámara real)',
    url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=600',
    tipo: 'snapshot',
    activa: true,
    esDemo: true,
  },
  {
    id: 'demo-produccion',
    nombre: 'Demo · Producción (no es cámara real)',
    url: 'https://images.unsplash.com/photo-1587241321921-91a834d6d191?auto=format&fit=crop&q=80&w=600',
    tipo: 'snapshot',
    activa: true,
    esDemo: true,
  },
];

/** Bitácora Visual: duración de cada micro-video y cada cuánto se graba uno nuevo por cámara. */
const DURACION_CLIP_MS = 10_000;
const INTERVALO_GRABACION_MS = 60_000;

const esUrlHttpLocal = (url: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);

const esUrlTailscale = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.toLowerCase().endsWith('.ts.net');
  } catch {
    return false;
  }
};

/**
 * 2026-10-09 (AUTORIZO Gonzalo): las cámaras del local son de OTRO origen (http://192.168…), y el navegador
 * NO deja grabar una imagen de otro origen ("lienzo contaminado") → la Bitácora nunca guardó un clip.
 * Cuando la app corre en el PC (ABRIR_DULCE_PLACER_LOCAL), la imagen se pide por /__camara (mismo origen).
 *
 * 2026-10-21: localhost/127.0.0.1 + Tailscale (.ts.net) también pasan por /__camara en local.
 * En Vercel (https) se usa /api/camara.
 */
const puedeUsarPuenteCamara = (url: string) =>
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  (esUrlHttpLocal(url) || esUrlTailscale(url));

/**
 * En el PC del local, Tailscale Funnel satura go2rtc al grabar.
 * Convertimos https://….ts.net/api/… → http://127.0.0.1:1984/api/… (mismo go2rtc, sin salir a internet).
 */
const urlGo2rtcLocalSiAplica = (url: string): string => {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().endsWith('.ts.net')) return url;
    if (!u.pathname.includes('/api/')) return url;
    const src = u.searchParams.get('src');
    const local = new URL('http://127.0.0.1:1984');
    local.pathname = u.pathname.includes('stream.mjpeg')
      ? '/api/stream.mjpeg'
      : u.pathname.includes('frame.jpeg')
        ? '/api/frame.jpeg'
        : u.pathname;
    if (src) local.searchParams.set('src', src);
    return local.toString();
  } catch {
    return url;
  }
};

const urlPuenteCamara = (url: string) =>
  `/__camara?u=${encodeURIComponent(urlGo2rtcLocalSiAplica(url))}`;
/** Proxy same-origin en Vercel (api/camara.ts) — frames JPEG desde Tailscale/go2rtc. */
const urlProxyApiCamara = (url: string) => `/api/camara?u=${encodeURIComponent(url)}`;
/** URL grabable (mismo origen): puente local si aplica, si no proxy API. */
const urlParaGrabar = (url: string) =>
  puedeUsarPuenteCamara(url) ? urlPuenteCamara(url) : urlProxyApiCamara(url);

/** Cache-buster para forzar refresco de snapshots estáticos. */
const conBuster = (url: string) => {
  if (!url || url.startsWith('data:')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}`;
};

interface VideovigilanciaProps {
  /** Para cruzar el video con lo que se vendió (Auditoría Digital). */
  ventas?: any[];
  sesionesCaja?: any[];
  onIrAuditoria?: () => void;
}

export function Videovigilancia({ ventas = [], sesionesCaja = [], onIrAuditoria }: VideovigilanciaProps = {}) {
  const { role } = useAuth();
  const puedeGestionar = role === 'ADMIN' || role === 'GERENTE';

  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [odysseusActivo, setOdysseusActivo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [ultimaCamaraEscaneada, setUltimaCamaraEscaneada] = useState<string | null>(null);
  const [bitacora, setBitacora] = useState<LogBitacora[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showOjoIA, setShowOjoIA] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [nuevaCamara, setNuevaCamara] = useState<Partial<Camara>>({ tipo: 'snapshot', activa: true });
  /** asistente = IP/DVR · manual = URL libre · puente = go2rtc (V380, etc.) */
  const [modoFormulario, setModoFormulario] = useState<'asistente' | 'manual' | 'puente'>('asistente');

  const [ipLocal, setIpLocal] = useState('');
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('');
  const [marca, setMarca] = useState('hikvision');
  const [canal, setCanal] = useState('1');
  const [puenteHost, setPuenteHost] = useState('127.0.0.1');
  const [puenteStream, setPuenteStream] = useState('caja');
  const [tipoPuente, setTipoPuente] = useState<TipoCamaraPuente>('hikvision');
  const [reglasOdysseus, setReglasOdysseus] = useState<ReglaOdysseus[]>(() => cargarReglasOdysseus());
  const [preguntaIa, setPreguntaIa] = useState('');
  const [camaraPreguntaId, setCamaraPreguntaId] = useState<string>('');
  const [preguntando, setPreguntando] = useState(false);
  const [grabacionActiva, setGrabacionActiva] = useState(false);
  /** 2026-10-20: último resultado de grabación, visible arriba (antes los errores quedaban escondidos). */
  const [estadoGrab, setEstadoGrab] = useState<{ texto: string; ok: boolean } | null>(null);
  const marcarGrab = (camNombre: string, texto: string, ok = false) =>
    setEstadoGrab({ texto: `${new Date().toLocaleTimeString('es-CO', { hour12: false })} · ${camNombre}: ${texto}`, ok });
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [buscandoClips, setBuscandoClips] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ClipBitacora[]>([]);
  const [videoNube, setVideoNube] = useState<{
    url: string;
    titulo: string;
    clip?: ClipBitacora;
    blobUrl?: string;
  } | null>(null);
  const [cargandoNube, setCargandoNube] = useState(false);
  const [errorVideoNube, setErrorVideoNube] = useState<string | null>(null);
  const [conteoCarpetas, setConteoCarpetas] = useState<{
    todas: number;
    sospechoso: number;
    evidencia: number;
    cuarentena: number;
  }>({
    todas: 0,
    sospechoso: 0,
    evidencia: 0,
    cuarentena: 0,
  });
  const videoBlobRef = useRef<string | null>(null);
  const canvasOffscreenRef = useRef<Record<string, HTMLCanvasElement>>({});
  /** 2026-10-21: escaneo al regresar + DVR */
  const [escaneandoRegreso, setEscaneandoRegreso] = useState(false);
  const [progresoEscaneo, setProgresoEscaneo] = useState('');
  /** Diario visible del escaneo (para que se vea que sí está trabajando). */
  const [diarioEscaneo, setDiarioEscaneo] = useState<string[]>([]);
  const [infoDvr, setInfoDvr] = useState<string | null>(null);
  /** Pestañas del panel derecho — más claro que todo amontonado */
  const [pestanaBitacora, setPestanaBitacora] = useState<
    'vigilar' | 'preguntar' | 'grabaciones' | 'escaneo'
  >('grabaciones');
  const [carpetaActiva, setCarpetaActiva] = useState<'todas' | BandejaForense>('todas');
  const [diasEscaneo, setDiasEscaneo] = useState<7 | 14 | 21>(7);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [informeDia, setInformeDia] = useState<string | null>(null);
  const [mostrarInforme, setMostrarInforme] = useState(false);
  const reglasRef = useRef(reglasOdysseus);
  const [estacion, setEstacion] = useState<boolean>(() => estacionActiva());
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [cfgAlertas, setCfgAlertas] = useState<ConfigAlertas>(() => cargarConfigAlertas());
  const autoArranqueRef = useRef(false);
  const [modoClips, setModoClips] = useState<ModoClips>(() => cargarModoClips());
  const modoClipsRef = useRef<ModoClips>(modoClips);
  const vistoRef = useRef<EstadoVisto>(estadoVistoVacio());

  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const camarasRef = useRef<Camara[]>([]);
  const odysseusRef = useRef(false);
  const grabacionRef = useRef(false);
  const grabacionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const grabandoCamaraIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    camarasRef.current = camaras;
  }, [camaras]);

  useEffect(() => {
    odysseusRef.current = odysseusActivo;
  }, [odysseusActivo]);

  useEffect(() => {
    grabacionRef.current = grabacionActiva;
  }, [grabacionActiva]);

  useEffect(() => {
    reglasRef.current = reglasOdysseus;
  }, [reglasOdysseus]);

  useEffect(() => {
    const reales = camaras.filter((c) => !c.esDemo && !c.deletedAt);
    if (reales.length > 0 && !camaraPreguntaId) {
      setCamaraPreguntaId(reales[0].id);
    }
  }, [camaras, camaraPreguntaId]);

  const agregarLog = useCallback((mensaje: string, alerta = false) => {
    setBitacora((prev) =>
      [{ id: generateUUID(), tiempo: new Date(), mensaje, alerta }, ...prev].slice(0, 80)
    );
  }, []);

  const cargarCamaras = useCallback(async () => {
    try {
      const data = (await db.getAllCamaras()) as Camara[];
      const vivas = (data || []).filter((c) => !c.deletedAt && !c.esDemo);
      if (vivas.length > 0) {
        setCamaras(vivas);
      } else {
        // Demos solo en pantalla — NO se guardan en IndexedDB
        setCamaras(DEMOS_UI);
        toast.message('Sin cámaras reales: mostrando demos. Agrega tu DVR/IP para vigilar de verdad.');
      }
    } catch {
      toast.error('Error cargando cámaras');
      setCamaras(DEMOS_UI);
    }
  }, []);

  useEffect(() => {
    void cargarCamaras();
  }, [cargarCamaras]);

  const ayudaMarca = (() => {
    switch (marca) {
      case 'v380':
        return 'V380 Pro casi nunca abre en Brave. Usa el modo «Puente PC» (carpeta herramientas/puente-cctv) tras activar ONVIF/RTSP en la app.';
      case 'tapo':
        return 'Tapo/EZVIZ: si no carga, prueba URL Manual con el enlace HTTP que muestre tu app o bridge.';
      case 'hikvision':
      case 'dahua':
        return 'Usa la IP del DVR/NVR y el canal correcto (1 = primera cámara).';
      case 'generica_mjpeg':
        return 'Útil para IP Webcam / DroidCam / servidores MJPEG en puerto 8080.';
      default:
        return '';
    }
  })();

  const generarUrlPorMarca = (): { url: string; tipo: 'snapshot' | 'mjpeg' } => {
    if (!ipLocal) return { url: '', tipo: 'snapshot' };
    const ip = ipLocal.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = usuario && clave ? `${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@` : '';

    switch (marca) {
      case 'hikvision':
        return {
          url: `http://${auth}${ip}/ISAPI/Streaming/channels/${canal}01/picture`,
          tipo: 'snapshot',
        };
      case 'dahua':
        return {
          url: `http://${auth}${ip}/cgi-bin/snapshot.cgi?channel=${canal}`,
          tipo: 'snapshot',
        };
      case 'tapo':
        return { url: `http://${auth}${ip}/stream/video/mjpeg`, tipo: 'mjpeg' };
      case 'v380':
        // Patrones frecuentes en clones V380 / Hi3510 (no todas responden).
        // Si falla: URL Manual con puente MJPEG (ej. go2rtc en el PC).
        return {
          url: `http://${auth}${ip}:81/webcapture.jpg?command=snap&channel=${canal}`,
          tipo: 'snapshot',
        };
      case 'generica_mjpeg':
        return { url: `http://${auth}${ip}:8080/video`, tipo: 'mjpeg' };
      default:
        return { url: `http://${ip}/snapshot.cgi`, tipo: 'snapshot' };
    }
  };

  const urlDesdePuente = () => {
    const host = (puenteHost || '127.0.0.1').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const src = (puenteStream || 'caja').trim() || 'caja';
    return `http://${host}:1984/api/stream.mjpeg?src=${encodeURIComponent(src)}`;
  };

  /** Ruta típica en el PC del Director (para pegar en el diálogo de guardar). */
  const RUTA_CARPETA_PUENTE =
    'G:\\Gestion Panaderia DUlce PLacer ORIGINAL\\herramientas\\puente-cctv';

  type WindowConPicker = Window & {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite';
      id?: string;
    }) => Promise<FileSystemDirectoryHandle>;
    showSaveFilePicker?: (opts?: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  };

  const construirYamlPuente = (): string | null => {
    const ip = ipLocal.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    const user = (usuario || 'admin').trim() || 'admin';
    const pass = clave;
    const stream = (puenteStream || 'caja').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'caja';

    if (!ip) {
      toast.error('Pon la IP de la cámara o del DVR (Hikvision / V380)');
      return null;
    }
    if (!pass) {
      toast.error('Pon la contraseña RTSP/ONVIF');
      return null;
    }

    return construirYamlGo2rtc({
      stream,
      tipo: tipoPuente,
      ip,
      usuario: user,
      clave: pass,
      canal: Number(canal) || 1,
    });
  };

  const escribirArchivoYaml = async (fileHandle: FileSystemFileHandle, contenido: string) => {
    const writable = await fileHandle.createWritable();
    await writable.write(contenido);
    await writable.close();
  };

  const descargarYamlFallback = (yaml: string) => {
    const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'go2rtc.yaml';
    a.click();
    URL.revokeObjectURL(href);
  };

  /** Elige la carpeta puente-cctv y guarda go2rtc.yaml ahí (Brave/Chrome). */
  const guardarYamlEligiendoCarpeta = async () => {
    const yaml = construirYamlPuente();
    if (!yaml) return;

    const w = window as WindowConPicker;
    try {
      if (typeof w.showDirectoryPicker === 'function') {
        toast.message('En el cuadro: busca la carpeta herramientas → puente-cctv y pulsa Seleccionar');
        const dir = await w.showDirectoryPicker({
          mode: 'readwrite',
          id: 'dp-puente-cctv',
        });
        const file = await dir.getFileHandle('go2rtc.yaml', { create: true });
        await escribirArchivoYaml(file, yaml);

        let tieneBat = false;
        try {
          await dir.getFileHandle('INICIAR_PUENTE_CCTV.bat');
          tieneBat = true;
        } catch {
          tieneBat = false;
        }

        if (tieneBat) {
          toast.success('Listo: go2rtc.yaml quedó en esa carpeta. Ahora abre INICIAR_PUENTE_CCTV.bat');
        } else {
          toast.message(
            'Archivo guardado, pero no veo el .bat ahí. ¿Elegiste bien herramientas/puente-cctv?'
          );
        }
        return;
      }

      if (typeof w.showSaveFilePicker === 'function') {
        toast.message('Guarda como go2rtc.yaml dentro de herramientas/puente-cctv');
        const file = await w.showSaveFilePicker({
          suggestedName: 'go2rtc.yaml',
          types: [
            {
              description: 'Configuración puente CCTV',
              accept: { 'text/yaml': ['.yaml', '.yml'], 'text/plain': ['.yaml'] },
            },
          ],
        });
        await escribirArchivoYaml(file, yaml);
        toast.success('Archivo guardado donde elegiste. Ejecuta el .bat del puente.');
        return;
      }

      descargarYamlFallback(yaml);
      toast.message('Tu navegador no permite elegir carpeta. Se descargó el archivo: muévelo a puente-cctv');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      descargarYamlFallback(yaml);
      toast.error('No se pudo escribir en la carpeta. Se descargó el archivo como respaldo.');
    }
  };

  const copiarRutaCarpetaPuente = async () => {
    try {
      await navigator.clipboard.writeText(RUTA_CARPETA_PUENTE);
      toast.success('Ruta copiada. En el diálogo de carpeta, pégala arriba (Ctrl+V) y Enter');
    } catch {
      toast.message(RUTA_CARPETA_PUENTE);
    }
  };

  const guardarCamara = async () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden agregar cámaras');
      return;
    }

    let urlFinal = (nuevaCamara.url || '').trim();
    let tipoFinal: 'snapshot' | 'mjpeg' = nuevaCamara.tipo === 'mjpeg' ? 'mjpeg' : 'snapshot';

    if (modoFormulario === 'puente') {
      urlFinal = urlDesdePuente();
      tipoFinal = 'mjpeg';
    } else if (modoFormulario === 'asistente' && !urlFinal && ipLocal) {
      const gen = generarUrlPorMarca();
      urlFinal = gen.url;
      tipoFinal = gen.tipo;
    } else if (modoFormulario === 'manual') {
      tipoFinal = 'mjpeg';
    }

    if (!nuevaCamara.nombre?.trim() || !urlFinal) {
      toast.error('Faltan el nombre o la dirección de la cámara');
      return;
    }

    if (usuario && clave && urlFinal.includes(`${usuario}:`)) {
      toast.message('Aviso: la clave queda en la URL de la cámara. Usa red local confiable.');
    }

    const cam: Camara = {
      id: generateUUID(),
      nombre: nuevaCamara.nombre.trim(),
      url: urlFinal,
      tipo: tipoFinal,
      activa: true,
    };

    await db.saveCamara(cam);
    setCamaras((prev) => {
      const sinDemos = prev.filter((c) => !c.esDemo);
      return [...sinDemos, cam];
    });
    const eraPuente = modoFormulario === 'puente';
    const eraV380 = marca === 'v380';
    setModalOpen(false);
    setIpLocal('');
    setClave('');
    setNuevaCamara({ tipo: 'snapshot', activa: true });
    setModoFormulario('asistente');
    toast.success('Cámara añadida');
    if (eraPuente) {
      toast.message('Deja corriendo INICIAR_PUENTE_CCTV.bat en el PC mientras vigiles.');
    } else if (eraV380) {
      toast.message('V380: si no hay imagen, usa modo Puente PC (herramientas/puente-cctv).');
    }
  };

  const eliminarCamara = async (id: string) => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden eliminar cámaras');
      return;
    }
    const cam = camaras.find((c) => c.id === id);
    if (cam?.esDemo) {
      setCamaras((prev) => prev.filter((c) => c.id !== id));
      toast.success('Demo ocultada');
      return;
    }
    if (!confirm('¿Seguro que deseas eliminar esta cámara?')) return;

    // Soft-delete (tombstone local) + borrado físico si el adapter lo permite
    const soft: Camara = { ...cam!, deletedAt: new Date().toISOString(), activa: false };
    try {
      await db.saveCamara(soft);
    } catch {
      /* ignore */
    }
    try {
      await db.deleteCamara(id);
    } catch {
      /* soft ya quedó */
    }
    setCamaras((prev) => prev.filter((c) => c.id !== id));
    toast.success('Cámara eliminada');
  };

  /** Carga una foto same-origin (proxy) para dibujar/grabar sin contaminar el lienzo. Reintenta si go2rtc está ocupado. */
  const cargarImagenGrabable = useCallback(async (urlCamara: string, timeoutMs = 8000): Promise<HTMLImageElement | null> => {
    const desdeBlob = async (proxyUrl: string): Promise<HTMLImageElement | null> => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const r = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (!r.ok) return null;
        const blob = await r.blob();
        if (blob.size < 32) return null;
        const obj = URL.createObjectURL(blob);
        const im = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
          img.onerror = () => resolve(null);
          img.src = obj;
        });
        URL.revokeObjectURL(obj);
        return im;
      } catch {
        return null;
      }
    };

    // 1) Preferir go2rtc local (127.0.0.1) vía puente
    let img = await desdeBlob(urlParaGrabar(conBuster(urlCamara)));
    if (img) return img;
    await new Promise((r) => setTimeout(r, 600));
    img = await desdeBlob(urlParaGrabar(conBuster(urlCamara)));
    if (img) return img;

    // 2) Si falló y era Tailscale reescrito: probar Tailscale original por el puente
    if (esUrlTailscale(urlCamara) && puedeUsarPuenteCamara(urlCamara)) {
      const viaTs = `/__camara?u=${encodeURIComponent(conBuster(urlCamara))}`;
      img = await desdeBlob(viaTs);
    }
    return img;
  }, []);

  const capturarFrame = async (camaraId: string): Promise<string | null> => {
    const canvas = canvasRefs.current[camaraId];
    const cam = camarasRef.current.find((c) => c.id === camaraId);
    if (!canvas || !cam || cam.esDemo) return null;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = 400;
      canvas.height = 300;
      // 2026-10-21: no dibujar la <img> visible (otro origen → lienzo contaminado).
      const fuente = await cargarImagenGrabable(cam.url);
      if (!fuente) return null;
      ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
      console.warn('CORS bloqueó el canvas (tainted).', e);
      return null;
    }
  };

  const refrescarSnapshot = (camaraId: string) => {
    const img = videoRefs.current[camaraId];
    const cam = camarasRef.current.find((c) => c.id === camaraId);
    if (!img || !cam || cam.tipo !== 'snapshot') return;
    img.removeAttribute('data-error');
    img.src = conBuster(cam.url);
  };

  const escanearCamara = useCallback(
    async (camara: Camara) => {
      if (camara.esDemo) {
        agregarLog(`[${camara.nombre}] Las demos no se analizan. Agrega una cámara real.`, false);
        return;
      }

      // Refrescar snapshot antes de capturar
      if (camara.tipo === 'snapshot') {
        refrescarSnapshot(camara.id);
        await new Promise((r) => setTimeout(r, 450));
      }

      const frame = await capturarFrame(camara.id);
      setUltimaCamaraEscaneada(camara.id);

      if (!frame) {
        const motivo = esUrlHttpLocal(camara.url)
          ? 'Sin imagen: cámara HTTP local / puente. ¿ABRIR_DULCE_PLACER_LOCAL y go2rtc encendidos?'
          : 'Sin imagen: el proxy /api/camara no recibió foto (¿Tailscale + go2rtc?).';
        agregarLog(`[${camara.nombre}] ${motivo}`, true);
        return;
      }

      setAnalizando(true);
      try {
        const mensaje = promptEscaneoOdysseus(camara.nombre, reglasRef.current);

        const res = await consultarAgente('odysseus', mensaje, () => {}, frame);
        const texto = (res || '').trim() || 'SIN_IMAGEN: Respuesta vacía';
        const esAlerta =
          texto.toLowerCase().startsWith('alerta') ||
          texto.toLowerCase().includes('alerta:');
        const sinImg = texto.toLowerCase().includes('sin_imagen');

        agregarLog(`[${camara.nombre}] ${texto}`, esAlerta || sinImg);

        if (esAlerta && !sinImg) {
          await db.addAgenteHallazgo('odysseus', {
            id: generateUUID(),
            tipo: 'seguridad',
            gravedad: 'alta',
            titulo: 'Alerta CCTV en ' + camara.nombre,
            descripcion: texto,
            fecha: new Date().toISOString(),
            revisado: false,
          });
          toast.error(`ODYSSEUS: alerta en ${camara.nombre}`);
          void notificarAlertaVigilancia({ clave: `scan-${camara.id}`, titulo: `Alerta en ${camara.nombre}`, detalle: texto, critica: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error de IA';
        agregarLog(`[${camara.nombre}] Error IA: ${msg}`, true);
        console.error(err);
      } finally {
        setAnalizando(false);
      }
    },
    [agregarLog]
  );

  const cicloVigilancia = useCallback(async () => {
    if (!odysseusRef.current) return;
    const activas = camarasRef.current.filter((c) => c.activa && !c.esDemo && !c.deletedAt);
    if (activas.length === 0) {
      agregarLog('ODYSSEUS: no hay cámaras reales activas para escanear.', true);
      return;
    }
    const camara = activas[Math.floor(Math.random() * activas.length)];
    await escanearCamara(camara);
  }, [agregarLog, escanearCamara]);

  const detenerOdysseus = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setOdysseusActivo(false);
  }, []);

  const toggleOdysseus = () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden activar ODYSSEUS');
      return;
    }

    if (odysseusActivo) {
      detenerOdysseus();
      agregarLog('Sistema ODYSSEUS desactivado.');
      return;
    }

    const reales = camaras.filter((c) => !c.esDemo && c.activa);
    if (reales.length === 0) {
      toast.error('Agrega al menos una cámara real antes de activar ODYSSEUS');
      return;
    }

    setOdysseusActivo(true);
    agregarLog('ODYSSEUS activado. Escaneo cada 15 s (solo con imagen real).');
    void cicloVigilancia();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      void cicloVigilancia();
    }, 15000);
  };

  /** Graba un micro-video de una cámara (canvas.captureStream + MediaRecorder), lo sube y lo manda a analizar. */
  const grabarClipCamara = useCallback(
    async (camara: Camara, motivo?: string) => {
      if (camara.esDemo || grabandoCamaraIds.current.has(camara.id)) return;
      // Con pestaña Videos las cámaras pueden estar ocultas: no exigir <img> visible.
      let canvas = canvasRefs.current[camara.id];
      if (!canvas) {
        if (!canvasOffscreenRef.current[camara.id]) {
          canvasOffscreenRef.current[camara.id] = document.createElement('canvas');
        }
        canvas = canvasOffscreenRef.current[camara.id];
      }

      if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
        marcarGrab(camara.nombre, 'este navegador no permite grabar video');
        return; // Navegador sin soporte: no insistimos con alertas repetidas.
      }

      grabandoCamaraIds.current.add(camara.id);
      let dibujoInterval: ReturnType<typeof setInterval> | null = null;

      try {
        canvas.width = 480;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 2026-10-20 + 2026-10-21: la <img> visible es de otro origen (Tailscale/go2rtc) → no se puede grabar.
        // Siempre pedimos frames por mismo origen: /__camara (LAN local) o /api/camara (Vercel→Tailscale).
        const porPuente = puedeUsarPuenteCamara(camara.url);
        let fuente = await cargarImagenGrabable(camara.url);
        if (!fuente) {
          const via = porPuente ? 'puente local /__camara' : 'proxy /api/camara (Tailscale/go2rtc)';
          agregarLog(`[Bitácora · ${camara.nombre}] No llegó imagen por ${via}. ¿go2rtc y Tailscale encendidos?`, true);
          marcarGrab(camara.nombre, `BLOQUEADO: no llegó imagen grabable (${via})`);
          return;
        }

        const stream = canvas.captureStream(5);
        const mimeType =
          ['video/webm;codecs=vp8', 'video/webm'].find((m) =>
            typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(m) : false
          ) || 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const dibujar = async () => {
          // Cada ~1.5 s (no más rápido: go2rtc se satura si las 4 cámaras piden a la vez).
          const siguiente = await cargarImagenGrabable(camara.url, 6000);
          if (siguiente) fuente = siguiente;
          try {
            if (fuente && fuente.complete && fuente.naturalWidth > 0) {
              ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
            }
          } catch {
            /* frame puntual falló: se sigue con el siguiente */
          }
        };

        await dibujar();
        // Si el lienzo quedó "contaminado", avisar (no debería pasar con el proxy).
        try { ctx.getImageData(0, 0, 1, 1); } catch {
          agregarLog(`[Bitácora · ${camara.nombre}] El navegador no deja grabar (lienzo contaminado). Revisa /api/camara y go2rtc.`, true);
          marcarGrab(camara.nombre, `BLOQUEADO: el navegador no deja grabar la imagen de esta cámara (dirección: ${camara.url.replace(/\/\/[^@/]*@/, '//***@').slice(0, 70)})`);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        dibujoInterval = setInterval(() => {
          void dibujar();
        }, 1500);

        const clipListo = new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
          recorder.onerror = (e) => reject(e);
        });

        recorder.start();
        await new Promise((r) => setTimeout(r, DURACION_CLIP_MS));
        recorder.stop();

        const blob = await clipListo;
        if (dibujoInterval) clearInterval(dibujoInterval);
        dibujoInterval = null;

        if (blob.size < 500) { // Prácticamente vacío: no había imagen real que grabar
          agregarLog(`[Bitácora · ${camara.nombre}] Clip vacío (la cámara no mandó imagen); no se guardó.`);
          marcarGrab(camara.nombre, 'video vacío (la cámara no mandó imagen)');
          return;
        }

        const ruta = await subirClipBitacora(blob, camara.id);
        const registro = await guardarClipBitacora({
          camara_id: camara.id,
          camara_nombre: camara.nombre,
          url_clip: ruta,
          duracion_segundos: 10,
        });
        const equipo = (() => { try { return nombreResponsable(leerEquipoLocal()); } catch { return ''; } })();
        const quienes = equipo.split(/\s+y\s+|,\s*/).map((x) => x.trim()).filter(Boolean);
        const trabajadores = quienes.length ? quienes : ['sin-turno'];
        let descripcion = motivo || 'Ronda de cámara';
        let clasificacion: ClipBitacora['clasificacion'] = null;

        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const mensaje = promptAnalisisClipOdysseus(camara.nombre, motivo);
          const res = await consultarAgente('odysseus', mensaje, () => {}, base64);
          const parseado = parsearRespuestaClipOdysseus((res || '').trim());
          const { categorias, alerta } = parseado;
          clasificacion = parseado.clasificacion;
          descripcion = motivo ? `[${motivo}] ${parseado.descripcion}` : parseado.descripcion;
          await marcarClipAnalizado(registro.id, {
            descripcion_ia: descripcion,
            clasificacion,
            categorias_detectadas: categorias as CategoriaBitacora[],
            alerta,
            trabajador: trabajadores.filter((p) => p !== 'sin-turno').join(' y ') || null,
          });

          if (alerta) {
            agregarLog(`[Bitácora · ${camara.nombre}] ${descripcion}`, true);
            toast.error(`Bitácora: posible ${categorias.join(', ') || 'anomalía'} en ${camara.nombre}`);
            void notificarAlertaVigilancia({
              clave: `clip-${camara.id}-${categorias.join('+') || 'malo'}`,
              titulo: `Posible ${categorias.join(', ') || 'anomalía'} en ${camara.nombre}`,
              detalle: descripcion,
              critica: esCategoriaCritica(categorias) || clasificacion === 'malo',
            });
          }
        } catch (err) {
          // El clip ya quedó guardado; solo falló el análisis (se puede reintentar luego).
          console.error('Bitácora visual: error analizando el clip:', err);
        }

        marcarGrab(camara.nombre, 'video guardado en la nube ✓', true);
        const cuandoClip = new Date(registro.capturado_en);
        const ficha = {
          contexto: motivo || 'ronda',
          descripcion,
          clasificacion: clasificacion || 'sin-clasificar',
          cuando: cuandoClip,
        };
        for (const persona of trabajadores) {
          void archivarClipEnCarpetas(blob, { ...ficha, trabajador: persona, donde: 'trabajador' })
            .catch((err) => console.error('Bitácora visual: no se copió a la carpeta del trabajador', err));
        }
        void archivarClipEnCarpetas(blob, {
          ...ficha,
          trabajador: trabajadores.filter((p) => p !== 'sin-turno').join('-') || 'sin-turno',
          donde: 'situacion',
        }).catch((err) => console.error('Bitácora visual: no se copió a la carpeta de la situación', err));
      } catch (err) {
        console.error('Bitácora visual: error grabando el clip:', err);
        marcarGrab(camara.nombre, `ERROR al guardar: ${(err as any)?.message || String(err)}`.slice(0, 200));
      } finally {
        if (dibujoInterval) clearInterval(dibujoInterval);
        grabandoCamaraIds.current.delete(camara.id);
      }
    },
    [agregarLog, cargarImagenGrabable]
  );

  /** Una cámara tras otra (go2rtc se cae si las 4 piden frame a la vez). */
  const cicloGrabacion = useCallback(() => {
    if (!grabacionRef.current) return;
    if (modoClipsRef.current === 'eventos') return; // en "solo eventos" no se graba a ciegas
    const activas = camarasRef.current.filter((c) => c.activa && !c.esDemo && !c.deletedAt);
    void (async () => {
      for (let i = 0; i < activas.length; i++) {
        if (!grabacionRef.current) break;
        await grabarClipCamara(activas[i]);
        if (i < activas.length - 1) await new Promise((r) => setTimeout(r, 1200));
      }
    })();
  }, [grabarClipCamara]);

  const toggleGrabacion = () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden activar la grabación');
      return;
    }
    if (grabacionActiva) {
      if (grabacionIntervalRef.current) {
        clearInterval(grabacionIntervalRef.current);
        grabacionIntervalRef.current = null;
      }
      setGrabacionActiva(false);
      agregarLog('Grabación de bitácora visual detenida.');
      return;
    }
    const reales = camaras.filter((c) => !c.esDemo && c.activa);
    if (reales.length === 0) {
      toast.error('Agrega al menos una cámara real para grabar bitácora');
      return;
    }
    setGrabacionActiva(true);
    agregarLog('Grabación de bitácora visual activada: clip de 10s cada 1 minuto por cámara (se guardan 30 días).');
    cicloGrabacion();
    if (grabacionIntervalRef.current) clearInterval(grabacionIntervalRef.current);
    grabacionIntervalRef.current = setInterval(cicloGrabacion, INTERVALO_GRABACION_MS);
  };

  // Clips por evento: cuando en caja pasa algo (venta, anulación, movimiento), graba un clip en ese instante.
  useEffect(() => {
    const eventos = detectarEventos(vistoRef.current, ventas, sesionesCaja);
    if (eventos.length === 0 || !grabacionRef.current || modoClipsRef.current === 'continuo') return;
    const activas = camarasRef.current.filter((c) => c.activa && !c.esDemo && !c.deletedAt);
    if (activas.length === 0) return;
    // Máximo 3 eventos por tanda (los sensibles primero) para no saturar con clips
    const elegidos = [...eventos].sort((a, b) => Number(b.sensible) - Number(a.sensible)).slice(0, 3);
    elegidos.forEach((ev, i) => {
      activas.forEach((c) => {
        setTimeout(() => { void grabarClipCamara(c, ev.motivo); }, i * (DURACION_CLIP_MS + 500));
      });
    });
    agregarLog(`Clip por evento: ${elegidos.map((e) => e.motivo).join(' · ')}`, elegidos.some((e) => e.sensible));
  }, [ventas, sesionesCaja, grabarClipCamara, agregarLog]);

  const cambiarModoClips = () => {
    const n = siguienteModoClips(modoClips);
    setModoClips(n);
    modoClipsRef.current = n;
    guardarModoClips(n);
    toast.message(`Clips: ${ETIQUETA_MODO[n]}`);
  };

  // Modo estación: este PC vigila y graba solo apenas abre la app (sin tocar botones) y no deja apagar la pantalla.
  useEffect(() => {
    if (!estacion || !puedeGestionar || autoArranqueRef.current) return;
    const reales = camaras.filter((c) => !c.esDemo && c.activa && !c.deletedAt);
    if (reales.length === 0) return;
    autoArranqueRef.current = true;
    if (!odysseusRef.current) toggleOdysseus();
    if (!grabacionRef.current) toggleGrabacion();
    agregarLog('Modo estación: vigilancia y grabación iniciadas automáticamente.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacion, puedeGestionar, camaras]);

  useEffect(() => {
    if (!estacion) return;
    let liberar: () => void = () => {};
    let cancelado = false;
    void mantenerPantallaEncendida().then((f) => { if (cancelado) f(); else liberar = f; });
    return () => { cancelado = true; liberar(); };
  }, [estacion]);

  const cambiarEstacion = () => {
    const nuevo = !estacion;
    setEstacionActiva(nuevo);
    setEstacion(nuevo);
    autoArranqueRef.current = false;
    toast.success(nuevo
      ? 'Modo estación activado: este PC vigila solo, aunque cambies de módulo. Déjalo encendido con la app abierta.'
      : 'Modo estación desactivado.');
  };

  // 2026-10-20 (AUTORIZO Gonzalo): UN solo botón que prende todo — vigilar las cámaras, grabar
  // (cada minuto + cuando pasa algo en caja) y dejar este PC como estación (arranca solo y no apaga pantalla).
  const todoActivo = estacion && odysseusActivo && grabacionActiva;
  const vigilarTodo = () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden activar la vigilancia');
      return;
    }
    if (todoActivo) {
      toggleOdysseus();
      toggleGrabacion();
      cambiarEstacion();
      return;
    }
    setModoClips('ambos');
    modoClipsRef.current = 'ambos';
    guardarModoClips('ambos');
    autoArranqueRef.current = true; // ya se prende aquí; evita que el modo estación lo prenda dos veces
    if (!estacion) {
      setEstacionActiva(true);
      setEstacion(true);
    }
    if (!odysseusActivo) toggleOdysseus();
    if (!grabacionActiva) toggleGrabacion();
    toast.success('Vigilancia completa: las cámaras se revisan y se graban. Deja este PC encendido con la app abierta.');
  };

  const guardarAlertas = (c: ConfigAlertas) => {
    setCfgAlertas(c);
    guardarConfigAlertas(c);
  };

  const probarAlerta = async () => {
    guardarConfigAlertas(cfgAlertas);
    const r = await notificarAlertaVigilancia(
      { clave: `prueba-${Date.now()}`, titulo: 'Prueba de alerta', detalle: 'Si ves esto, las alertas funcionan.', critica: true },
      cfgAlertas
    );
    toast.message(`Prueba enviada · navegador: ${r.navegador ? 'sí' : 'no'} · WhatsApp: ${r.whatsapp ? 'enviado (revisa tu celular)' : 'sin configurar'}`);
  };

  const ejecutarBusquedaBitacora = async () => {
    const q = busquedaTexto.trim();
    if (!q) return;
    setBuscandoClips(true);
    try {
      const resultados = await buscarClipsBitacora(q);
      setResultadosBusqueda(resultados);
      if (resultados.length === 0) toast.message('Sin resultados. Prueba con otras palabras.');
    } catch (err) {
      toast.error('Error buscando en la bitácora visual');
      console.error(err);
    } finally {
      setBuscandoClips(false);
    }
  };

  const cerrarVideoNube = () => {
    if (videoBlobRef.current) {
      URL.revokeObjectURL(videoBlobRef.current);
      videoBlobRef.current = null;
    }
    setVideoNube(null);
    setErrorVideoNube(null);
  };

  const abrirClipBitacora = async (clip: ClipBitacora) => {
    setErrorVideoNube(null);
    const url = await urlFirmadaClip(clip.url_clip, 7200);
    if (!url) {
      toast.error('No se pudo abrir el video de la nube');
      return;
    }
    const quien = clip.trabajador_id || 'Sin trabajador marcado';
    const situacion = clip.clasificacion || 'sin situación';
    const titulo = `${clip.camara_nombre || clip.camara_id} · ${quien} · ${situacion}`;
    // Blob local: Chrome reproduce mejor el WebM de canvas.captureStream que el URL firmado directo.
    let blobUrl: string | undefined;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const blob = await r.blob();
        const typed = blob.type?.includes('video')
          ? blob
          : new Blob([blob], { type: 'video/webm' });
        if (videoBlobRef.current) URL.revokeObjectURL(videoBlobRef.current);
        blobUrl = URL.createObjectURL(typed);
        videoBlobRef.current = blobUrl;
      }
    } catch {
      /* se usa signed URL */
    }
    setVideoNube({ url: blobUrl || url, titulo, clip, blobUrl });
    setPestanaBitacora('grabaciones');
  };

  const verGrabacionesNube = async () => {
    setPestanaBitacora('grabaciones');
    await abrirCarpetaUI('todas');
  };

  const verClipsEnRevision = async () => {
    setCarpetaActiva('evidencia');
    setPestanaBitacora('grabaciones');
    await abrirCarpetaUI('evidencia');
  };

  const refrescarConteosCarpetas = async () => {
    try {
      const [todas, sospechoso, evidencia, cuarentena] = await Promise.all([
        clipsPorCarpetaUI('todas', 100),
        clipsPorCarpetaUI('sospechoso', 40),
        clipsPorCarpetaUI('evidencia', 40),
        clipsPorCarpetaUI('cuarentena', 40),
      ]);
      setConteoCarpetas({
        todas: todas.length,
        sospechoso: sospechoso.length,
        evidencia: evidencia.length,
        cuarentena: cuarentena.length,
      });
    } catch {
      /* conteos opcionales */
    }
  };

  const abrirCarpetaUI = async (carpeta: 'todas' | BandejaForense) => {
    setCarpetaActiva(carpeta);
    setCargandoNube(true);
    try {
      const lista = await clipsPorCarpetaUI(carpeta, 100);
      setResultadosBusqueda(lista);
      const nombre =
        carpeta === 'todas'
          ? 'Todas'
          : carpeta === 'cuarentena'
            ? 'Cuarentena'
            : carpeta === 'sospechoso'
              ? 'Sospechoso'
              : 'Revisión';
      if (lista.length === 0) {
        toast.message(
          carpeta === 'todas'
            ? 'Carpeta Todas: vacía por ahora'
            : `${nombre} vacía · los grabados están en Todas`
        );
      } else {
        toast.message(`${lista.length} video(s) en ${nombre}`);
      }
      void refrescarConteosCarpetas();
    } catch (err) {
      toast.error('No se pudo abrir la carpeta');
      console.error(err);
    } finally {
      setCargandoNube(false);
    }
  };

  // Al abrir Videos SIEMPRE ir a "Todas" (ahí están los grabados; Sospechoso/Cuarentena suelen estar vacías).
  useEffect(() => {
    if (pestanaBitacora !== 'grabaciones') return;
    void abrirCarpetaUI('todas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaBitacora]);

  /** Conecta al DVR Hikvision (solo app local + LAN). */
  const conectarDvr = async () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE');
      return;
    }
    setProgresoEscaneo('Conectando al DVR…');
    const info = await probarConexionDvr();
    if (!info.ok) {
      setInfoDvr(null);
      toast.error(info.error || 'No conecté al DVR. ¿ABRIR_DULCE_PLACER_LOCAL en el PC del local?');
      setProgresoEscaneo('');
      return;
    }
    setInfoDvr(`${info.modelo || 'DVR'} · fw ${info.firmware || '?'}`);
    toast.success(`DVR OK: ${info.modelo}`);
    setProgresoEscaneo('');
  };

  /** Lista segmentos del DVR (últimos N días) sin bajar todo el video aún. */
  const listarGrabacionesDvr = async (dias: 7 | 14 | 21) => {
    if (!puedeGestionar) return;
    setProgresoEscaneo(`Buscando en DVR (${dias} días)…`);
    const r = await buscarGrabacionesDvr({ dias, maxPorPista: 30 });
    if (!r.ok) {
      toast.error(r.error || 'Falló la búsqueda en el DVR');
      setProgresoEscaneo('');
      return;
    }
    const resumen = r.segmentos
      .slice(0, 12)
      .map((s) => `${etiquetaPista(s.trackId)} · ${s.inicio.slice(0, 16)} → ${s.fin.slice(11, 16)}`)
      .join('\n');
    agregarLog(
      `[DVR] ${r.total} tramo(s) en ${dias} días` +
        (r.hayMas ? ' (hay más en el disco)' : '') +
        (resumen ? `\n${resumen}` : '')
    );
    toast.message(`DVR: ${r.total} tramos hallados (${dias} días)${r.hayMas ? ' · hay más' : ''}`);
    setProgresoEscaneo('');
  };

  /** Reduce JPEG para gastar menos cuota de Gemini en el escaneo. */
  const reducirFrameEscaneo = (dataUrl: string, maxW = 480, maxH = 360, calidad = 0.62): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || maxW;
        let h = img.naturalHeight || maxH;
        const scale = Math.min(1, maxW / w, maxH / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  /**
   * FORENSE DVR — NO es vigilancia en vivo.
   * Revisa grabaciones YA guardadas en el disco (últimos N días),
   * prioriza caja, varios fotogramas por tramo, guarda hallazgos con título+fecha.
   * Tú revisas y borras lo que no sea sospechoso.
   */
  const escaneoAlRegresar = async (dias: 7 | 14 | 21) => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE');
      return;
    }
    if (escaneandoRegreso) return;
    setEscaneandoRegreso(true);
    setDiarioEscaneo([]);
    const notar = (linea: string, alerta = false) => {
      setDiarioEscaneo((prev) =>
        [`${new Date().toLocaleTimeString('es-CO', { hour12: false })} · ${linea}`, ...prev].slice(0, 60)
      );
      agregarLog(`[Forense DVR] ${linea}`, alerta);
    };
    const estabaOdysseus = odysseusActivo;
    if (estabaOdysseus) {
      detenerOdysseus();
      notar('Pausé el VIVO: ahora solo reviso grabaciones viejas del DVR.');
    }
    let aCuarentena = 0;
    let aSospechoso = 0;
    let aEvidencia = 0;
    let analizados = 0;
    let fallosFrame = 0;
    let fallosIa = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Cupos de TRAMOS (cada tramo → varios fotogramas). Caja ~55%.
    const maxTramos = dias === 7 ? 28 : dias === 14 ? 40 : 52;
    const framesPorTramoCaja = 3;
    const framesPorTramoOtra = 2;

    const pedirAnalisis = async (mensaje: string, dataUrl: string): Promise<string | null> => {
      // Forense: un poco más de detalle que el vivo (gesto billete/bolsillo)
      const frame = await reducirFrameEscaneo(dataUrl, 640, 480, 0.72);
      let ultimo = '';
      for (let intento = 1; intento <= 3; intento++) {
        try {
          const res = await consultarAgente('odysseus', mensaje, () => {}, frame);
          if (res && !/no hay proveedores/i.test(res)) return res;
          ultimo = res || 'sin respuesta';
        } catch (e) {
          ultimo = e instanceof Error ? e.message : String(e);
        }
        const saturado = /429|Too Many|quota|rate|proveedores/i.test(ultimo);
        if (!saturado) break;
        const espera = 20_000 * intento;
        setProgresoEscaneo(`IA saturada. Espero ${Math.round(espera / 1000)}s… (${intento}/3)`);
        notar(`IA saturada, reintento en ${Math.round(espera / 1000)}s`, true);
        await sleep(espera);
      }
      return null;
    };

    const guardarHallazgo = async (opts: {
      bandeja: BandejaForense;
      camara: string;
      parseado: ReturnType<typeof parsearRespuestaClipOdysseus>;
      cuando: Date;
      dataUrl?: string;
      rutaClip?: string;
      textoIa?: string;
    }) => {
      const reporteIa = opts.textoIa ? extraerReporteForense(opts.textoIa) : null;
      const titulo = tituloHallazgoForense({
        camara: opts.camara,
        categorias: opts.parseado.categorias,
        clasificacion: opts.parseado.clasificacion,
        descripcion: opts.parseado.descripcion,
        cuando: opts.cuando,
        reporteIa,
      });
      const descCompleta = [
        titulo,
        opts.parseado.descripcion,
        opts.parseado.categorias.length ? `Categorías: ${opts.parseado.categorias.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' — ');
      let ruta: string | null = null;
      if (opts.dataUrl) {
        const blob = dataUrlABlob(opts.dataUrl);
        if (blob) {
          ruta = await archivarBlobEnBandejaForense(blob, opts.bandeja, {
            camara: opts.camara,
            descripcion: opts.parseado.descripcion,
            titulo,
            cuando: opts.cuando,
          });
          try {
            const rutaOrig = await subirClipBitacora(blob, `dvr-${nombreCarpetaNube(opts.camara)}`);
            const reg = await guardarClipBitacora({
              camara_id: `dvr-${opts.camara}`,
              camara_nombre: opts.camara,
              url_clip: rutaOrig,
              duracion_segundos: 1,
              capturado_en: opts.cuando.toISOString(),
            });
            await marcarClipAnalizado(reg.id, {
              descripcion_ia: descCompleta,
              clasificacion: opts.parseado.clasificacion,
              categorias_detectadas: opts.parseado.categorias as CategoriaBitacora[],
              alerta: opts.parseado.alerta,
            });
          } catch {
            /* storage ok aunque falle la tabla */
          }
        }
      } else if (opts.rutaClip) {
        ruta = await archivarClipEnBandejaForense(opts.rutaClip, opts.bandeja, {
          camara: opts.camara,
          descripcion: opts.parseado.descripcion,
          titulo,
          cuando: opts.cuando,
        });
      }
      if (ruta) {
        if (opts.bandeja === 'cuarentena') aCuarentena += 1;
        else if (opts.bandeja === 'sospechoso') aSospechoso += 1;
        else aEvidencia += 1;
        notar(`→ ${opts.bandeja.toUpperCase()}: ${titulo}`, opts.bandeja === 'cuarentena');
        if (opts.dataUrl && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
          const m = opts.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (m) {
            void fetch('/__evidencia', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tipo: opts.parseado.categorias[0] || opts.bandeja,
                camara: opts.camara,
                titulo,
                descripcion: opts.parseado.descripcion,
                cuando: opts.cuando.toISOString(),
                dataBase64: m[1],
                ext: 'jpg',
              }),
            })
              .then((r) => r.json())
              .then((j: { ok?: boolean; ruta?: string }) => {
                if (j.ok) notar(`Copia en D:\\DulcePlacerEvidencia\\${j.ruta || ''}`);
              })
              .catch(() => undefined);
          }
        }
      }
    };

    try {
      const hasta = new Date();
      const desde = new Date();
      desde.setDate(desde.getDate() - (dias - 1));
      const ymdLocal = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      const desdeISO = ymdLocal(desde);
      const hastaISO = ymdLocal(hasta);

      if (!infoDvr) {
        setProgresoEscaneo('Conectando DVR…');
        notar('Conectando al DVR (disco de grabaciones)…');
        const info = await probarConexionDvr();
        if (info.ok) {
          setInfoDvr(`${info.modelo || 'DVR'} · fw ${info.firmware || '?'}`);
          notar(`DVR OK: ${info.modelo || 'conectado'}`);
        } else {
          toast.error(info.error || 'Sin puente DVR. Abre ABRIR_DULCE_PLACER_LOCAL.');
          notar(info.error || 'Sin DVR — no puedo leer grabaciones viejas', true);
          return;
        }
      }

      setProgresoEscaneo(`Buscando grabaciones ${desdeISO} → ${hastaISO}…`);
      notar(`FORENSE: buscar en disco últimos ${dias} días (${desdeISO}→${hastaISO})…`);
      const busqueda = await buscarGrabacionesDvr({ dias, maxPorPista: 80 });
      if (!busqueda.ok) {
        toast.error(busqueda.error || 'El DVR no devolvió grabaciones');
        notar(busqueda.error || 'Puente DVR no respondió', true);
        return;
      }
      if (busqueda.erroresPista?.length) {
        notar(`Pistas con error: ${busqueda.erroresPista.join(', ')}`, true);
      }

      const tramos = muestrearSegmentosDvrForense(busqueda.segmentos, maxTramos);
      type Momento = { trackId: string; cuando: string; fin: string };
      const momentos: Momento[] = [];
      for (const seg of tramos) {
        const n =
          seg.trackId === '101' ? framesPorTramoCaja : framesPorTramoOtra;
        for (const cuando of instantesForensesEnSegmento(seg, n)) {
          momentos.push({ trackId: seg.trackId, cuando, fin: seg.fin });
        }
      }
      notar(
        `Disco: ${busqueda.total} tramos · ${tramos.length} elegidos · ${momentos.length} fotogramas (caja prioritaria)`
      );
      toast.message(`Forense DVR: ${momentos.length} fotogramas de grabaciones (${dias} días)`);

      for (let i = 0; i < momentos.length; i++) {
        const mom = momentos[i];
        const nombreCam = etiquetaPista(mom.trackId);
        const pct = Math.round(((i + 1) / Math.max(1, momentos.length)) * 100);
        const marca = mom.cuando.slice(0, 19).replace('T', ' ');
        setProgresoEscaneo(`${pct}% · ${i + 1}/${momentos.length} · ${nombreCam} · ${marca}`);
        notar(`Disco ${nombreCam} · ${marca}`);
        const frameRes = await capturarFrameDvr(mom.trackId, mom.cuando);
        if (!frameRes.ok || !frameRes.dataUrl) {
          fallosFrame += 1;
          notar(`Sin frame ${nombreCam}: ${frameRes.error || 'error'}`, true);
          continue;
        }
        if (frameRes.fuente === 'live-fallback') {
          notar(`⚠ ${nombreCam}: el puente dio foto en vivo (no histórico) — lo salto`, true);
          fallosFrame += 1;
          continue;
        }
        const mensaje = [
          promptEscaneoAlRegresar(nombreCam, dias, mom.cuando),
          `Tramo disco hasta: ${mom.fin}`,
          `Fuente: ${frameRes.fuente || 'playback'}`,
        ].join('\n');
        const res = await pedirAnalisis(mensaje, frameRes.dataUrl);
        if (!res) {
          fallosIa += 1;
          if (fallosIa >= 3) {
            toast.error('Gemini sin cuota (429). Espera unos minutos o usa 7 días.');
            notar('Aborto: cuota IA agotada', true);
            break;
          }
          continue;
        }
        const parseado = parsearRespuestaClipOdysseus(res.trim());
        analizados += 1;
        fallosIa = 0;
        const bandeja = bandejaDesdeAnalisis({
          alerta: parseado.alerta,
          clasificacion: parseado.clasificacion,
          categorias: parseado.categorias,
          descripcion: parseado.descripcion,
        });
        if (bandeja) {
          await guardarHallazgo({
            bandeja,
            camara: nombreCam,
            parseado,
            cuando: new Date(mom.cuando),
            dataUrl: frameRes.dataUrl,
            textoIa: res,
          });
        } else {
          notar(`OK ${nombreCam} ${marca}: sin irregularidad`);
        }
        if (i < momentos.length - 1) await sleep(4_500);
      }

      if (analizados === 0) {
        const detalle =
          fallosIa > 0
            ? 'Gemini sin cuota (429). Espera unos minutos.'
            : momentos.length === 0
              ? 'No hay grabaciones DVR en ese rango'
              : `Fallaron frames históricos (${fallosFrame})`;
        toast.error(`Forense sin resultados: ${detalle}`);
        notar(`Sin resultados · ${detalle}`, true);
        return;
      }

      const msg = `Forense ${dias}d: ${analizados} revisados · sospechoso ${aSospechoso} · evidencia ${aEvidencia} · cuarentena ${aCuarentena}`;
      notar(msg, aCuarentena > 0);
      toast.success(msg);
      setPestanaBitacora('grabaciones');
      const dest: BandejaForense =
        aCuarentena > 0 ? 'cuarentena' : aEvidencia > 0 ? 'evidencia' : 'sospechoso';
      setCarpetaActiva(dest);
      await abrirCarpetaUI(dest);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Falló el forense DVR');
      notar(err instanceof Error ? err.message : 'Error forense', true);
    } finally {
      setEscaneandoRegreso(false);
      setProgresoEscaneo('');
      if (estabaOdysseus) {
        toast.message('El VIVO sigue pausado. Actívalo aparte cuando quieras.');
      }
    }
  };

  /** La IA revisa los videos ya guardados en D: según las reglas forenses. */
  const revisarVideosDisco = async () => {
    if (!puedeGestionar || escaneandoRegreso) return;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      toast.error('Esa revisión lee D:\\ y solo corre en la app local');
      return;
    }
    setEscaneandoRegreso(true);
    setDiarioEscaneo([]);
    const notar = (linea: string, alerta = false) => {
      setDiarioEscaneo((prev) =>
        [`${new Date().toLocaleTimeString('es-CO', { hour12: false })} · ${linea}`, ...prev].slice(0, 60)
      );
      agregarLog(`[Reglas D:] ${linea}`, alerta);
    };
    try {
      const listaRes = await fetch('/__evidencia?op=pendientes', { cache: 'no-store' });
      if (!listaRes.ok) {
        toast.error('Reinicia ABRIR_DULCE_PLACER_LOCAL para activar la revisión en D:\\');
        return;
      }
      const lista = (await listaRes.json()) as {
        ok?: boolean;
        videos?: { origen: string; rel: string; nombre: string }[];
      };
      const videos = lista.videos || [];
      notar(`${videos.length} videos en D:\\ sin pasar por las reglas actuales`);
      if (videos.length === 0) {
        toast.message('No hay videos nuevos en D:\\DulcePlacerEvidencia ni en PruebaIA');
        return;
      }
      let hallazgos = 0;
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        setProgresoEscaneo(`Reglas ${i + 1}/${videos.length} · ${v.nombre}`);
        notar(`Revisando ${v.origen} · ${v.nombre}`);
        const fr = await fetch(
          `/__evidencia?op=frame&origen=${encodeURIComponent(v.origen)}&rel=${encodeURIComponent(v.rel)}`,
          { cache: 'no-store' }
        );
        const fj = (await fr.json()) as { ok?: boolean; frames?: string[]; error?: string };
        if (!fj.ok || !fj.frames?.length) {
          notar(fj.error || `Sin fotograma en ${v.nombre}`, true);
          continue;
        }
        let mejor: ReturnType<typeof parsearRespuestaClipOdysseus> | null = null;
        let texto = '';
        for (const b64 of fj.frames) {
          const dataUrl = `data:image/jpeg;base64,${b64}`;
          const frame = await reducirFrameEscaneo(dataUrl, 640, 480, 0.72);
          const res = await consultarAgente(
            'odysseus',
            promptEscaneoAlRegresar(v.nombre, 7),
            () => {},
            frame
          );
          if (!res) continue;
          const parseado = parsearRespuestaClipOdysseus(res.trim());
          texto = res;
          if (!mejor || parseado.alerta || (parseado.categorias.length > (mejor.categorias.length || 0))) {
            mejor = parseado;
          }
          if (parseado.alerta || parseado.categorias.length > 0) break;
        }
        const bandeja = mejor
          ? bandejaDesdeAnalisis({
              alerta: mejor.alerta,
              clasificacion: mejor.clasificacion,
              categorias: mejor.categorias,
              descripcion: mejor.descripcion,
            })
          : null;
        const titulo = mejor
          ? tituloHallazgoForense({
              camara: v.nombre,
              categorias: mejor.categorias,
              clasificacion: mejor.clasificacion,
              descripcion: mejor.descripcion,
              reporteIa: extraerReporteForense(texto),
            })
          : '';
        await fetch('/__evidencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'marcar',
            origen: v.origen,
            rel: v.rel,
            tipo: mejor?.categorias[0] || 'ninguna',
            titulo,
            descripcion: mejor?.descripcion || 'SIN_ANOMALIA',
            categorias: mejor?.categorias || [],
            clasificacion: bandeja ? mejor?.clasificacion || 'regular' : 'bueno',
          }),
        });
        if (bandeja && mejor && fj.frames[0]) {
          hallazgos += 1;
          const blob = dataUrlABlob(`data:image/jpeg;base64,${fj.frames[0]}`);
          if (blob) {
            await archivarBlobEnBandejaForense(blob, bandeja, {
              camara: v.nombre,
              titulo,
              descripcion: mejor.descripcion,
            });
          }
          notar(`→ ${bandeja.toUpperCase()}: ${titulo}`, bandeja === 'cuarentena');
        } else {
          notar(`OK ${v.nombre}: las reglas no vieron irregularidad`);
        }
        if (i < videos.length - 1) await new Promise((r) => setTimeout(r, 4000));
      }
      toast.success(`Reglas en D:\\: ${videos.length} videos · ${hallazgos} hallazgos`);
      notar(`Listo. ${hallazgos} hallazgos. Lo demás queda marcado sin anomalía.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pude revisar D:\\');
      notar(err instanceof Error ? err.message : 'Error', true);
    } finally {
      setEscaneandoRegreso(false);
      setProgresoEscaneo('');
    }
  };

  const generarInformeDelDia = async () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden generar el informe');
      return;
    }
    setGenerandoInforme(true);
    try {
      const clips = await clipsDelDia();
      const analizados = clips.filter((c) => c.analizado && c.descripcion_ia);
      if (analizados.length === 0) {
        setInformeDia('No hay clips analizados hoy todavía.');
        setMostrarInforme(true);
        return;
      }
      const resumen = analizados
        .map((c) => {
          const hora = new Date(c.capturado_en).toLocaleTimeString('es-CO', { hour12: false });
          const cats = c.categorias_detectadas?.length ? ` [${c.categorias_detectadas.join(', ')}]` : '';
          return `${hora} · ${c.camara_nombre || c.camara_id}${cats}: ${c.descripcion_ia}`;
        })
        .join('\n');
      const mensaje = `${promptInformeDiarioOdysseus(resumen)}\n\n${resumenOperativoDia(ventas, sesionesCaja)}`;
      const res = await consultarAgente('odysseus', mensaje, () => {});
      setInformeDia((res || '').trim() || 'ODYSSEUS no respondió.');
      setMostrarInforme(true);
    } catch (err) {
      toast.error('Error generando el informe del día');
      console.error(err);
    } finally {
      setGenerandoInforme(false);
    }
  };

  const probarCaptura = async (camara: Camara) => {
    if (camara.esDemo) {
      toast.message('Es una demo. Prueba con una cámara real.');
      return;
    }
    toast.message(`Probando captura de ${camara.nombre}…`);
    await escanearCamara(camara);
  };

  const toggleRegla = (id: ReglaOdysseus['id']) => {
    setReglasOdysseus((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, activa: !r.activa } : r));
      guardarReglasOdysseus(next);
      return next;
    });
  };

  const preguntarAOdysseus = async () => {
    if (!puedeGestionar) {
      toast.error('Solo ADMIN o GERENTE pueden preguntar a ODYSSEUS');
      return;
    }
    const q = preguntaIa.trim();
    if (!q) {
      toast.error('Escribe tu pregunta (ej: ¿hay alguien en caja?)');
      return;
    }
    const cam =
      camaras.find((c) => c.id === camaraPreguntaId && !c.esDemo) ||
      camaras.find((c) => !c.esDemo && c.activa);
    if (!cam) {
      toast.error('Agrega una cámara real primero');
      return;
    }

    if (cam.tipo === 'snapshot') {
      refrescarSnapshot(cam.id);
      await new Promise((r) => setTimeout(r, 450));
    }

    const frame = await capturarFrame(cam.id);
    if (!frame) {
      agregarLog(
        `[${cam.nombre}] SIN_IMAGEN: no puedo responder. Revisa Tailscale/go2rtc o el puente local.`,
        true
      );
      toast.error('Sin imagen de la cámara');
      return;
    }

    setPreguntando(true);
    setUltimaCamaraEscaneada(cam.id);
    agregarLog(`[Tú → ${cam.nombre}] ${q}`);
    try {
      const mensaje = promptPreguntaOdysseus(cam.nombre, q, reglasRef.current);
      const res = await consultarAgente('odysseus', mensaje, () => {}, frame);
      const texto = (res || '').trim() || 'SIN_IMAGEN: Respuesta vacía';
      const esAlerta =
        texto.toLowerCase().startsWith('alerta') || texto.toLowerCase().includes('alerta:');
      agregarLog(`[ODYSSEUS · ${cam.nombre}] ${texto}`, esAlerta || texto.toLowerCase().includes('sin_imagen'));
      setPreguntaIa('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de IA';
      agregarLog(`[ODYSSEUS] Error: ${msg}`, true);
    } finally {
      setPreguntando(false);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (grabacionIntervalRef.current) clearInterval(grabacionIntervalRef.current);
    };
  }, []);

  const haySoloDemos = camaras.length > 0 && camaras.every((c) => c.esDemo);

  return (
    <div className="flex-1 h-screen bg-[#020617] text-slate-200 overflow-hidden flex flex-col font-sans">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(#10b981 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <header className="shrink-0 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Video className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">
              Vigilancia <span className="text-emerald-400">CCTV</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
              ODYSSEUS · Centinela visual
              {!puedeGestionar && (
                <span className="text-amber-500/80 normal-case tracking-normal font-bold">
                  · Solo lectura ({role || 'sin rol'})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={vigilarTodo}
              disabled={!puedeGestionar}
              className={cn(
                'h-10 px-6 rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-40',
                todoActivo
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black'
              )}
              title="Prende todo de una vez: vigilar, grabar y dejar este PC como estación"
            >
              <Shield className="w-4 h-4 mr-2" /> {todoActivo ? 'Vigilando y grabando · Apagar' : 'Vigilar y grabar todo'}
            </Button>
            <Button
              onClick={cambiarModoClips}
              disabled={!puedeGestionar}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-4 rounded-xl text-white font-bold disabled:opacity-40"
              title="Cuándo grabar clips: cada minuto, cuando pasa algo en caja, o ambos"
            >
              <Film className="w-4 h-4 mr-2" /> Clips: {ETIQUETA_MODO[modoClips]}
            </Button>
            <Button
              onClick={() => setAlertasOpen(true)}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-4 rounded-xl text-white font-bold"
              title="Avisos al celular cuando la IA detecte algo grave"
            >
              <MessageCircle className="w-4 h-4 mr-2" /> Alertas
            </Button>
            <Button
              onClick={cambiarEstacion}
              disabled={!puedeGestionar}
              variant="outline"
              className={cn(
                'h-10 px-4 rounded-xl font-bold disabled:opacity-40',
                estacion ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white'
              )}
              title="Este PC vigila y graba solo, aunque cambies de módulo"
            >
              <Cpu className="w-4 h-4 mr-2" /> Estación {estacion ? 'ON' : 'OFF'}
            </Button>
            {onIrAuditoria && (
              <Button
                onClick={onIrAuditoria}
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-4 rounded-xl text-white font-bold"
                title="Cruza lo que graban las cámaras con ventas, cajas y gastos"
              >
                <ShieldAlert className="w-4 h-4 mr-2" /> Auditoría Digital
              </Button>
            )}
            <Button
              onClick={() => setShowOjoIA(true)}
              disabled={!puedeGestionar}
              className="bg-indigo-600 hover:bg-indigo-700 h-10 px-4 rounded-xl text-white font-bold"
            >
              <BrainCircuit className="w-4 h-4 mr-2" /> Cámara de este PC (Ojo IA)
            </Button>
            <Button
              onClick={() => setModalOpen(true)}
            disabled={!puedeGestionar}
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-4 rounded-xl disabled:opacity-40"
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar Cámara
          </Button>
          <Button
            onClick={toggleOdysseus}
            disabled={!puedeGestionar}
            className={cn(
              'h-10 px-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-40',
              odysseusActivo
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30'
            )}
          >
            {odysseusActivo ? (
              <>
                <Pause className="w-4 h-4 mr-2" /> ODYSSEUS Activo
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Activar ODYSSEUS
              </>
            )}
          </Button>
          <Button
            onClick={toggleGrabacion}
            disabled={!puedeGestionar}
            className={cn(
              'h-10 px-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-40',
              grabacionActiva
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 animate-pulse'
                : 'bg-sky-500/20 text-sky-400 border border-sky-500/50 hover:bg-sky-500/30'
            )}
            title="Graba clips de 10s cada 1 minuto por cámara y los guarda 30 días para auditoría"
          >
            <Film className="w-4 h-4 mr-2" /> {grabacionActiva ? 'Grabando Bitácora' : 'Activar Grabación'}
          </Button>
          {grabacionActiva && (
            <p className={cn('basis-full text-xs font-bold px-3 py-2 rounded-lg', estadoGrab?.ok ? 'bg-emerald-500/15 text-emerald-300' : estadoGrab ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-slate-300')}>
              {estadoGrab ? estadoGrab.texto : 'Grabación activa: el primer video sale en menos de 1 minuto…'}
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Modo Videos: reproductor amplio. Las cámaras quedan montadas pero ocultas para no romper la grabación. */}
        {pestanaBitacora === 'grabaciones' && (
          <div className="flex-1 flex flex-col min-w-0 p-4 md:p-5 gap-3 bg-gradient-to-br from-slate-950 via-black to-slate-950">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-lg font-black text-white tracking-tight">Reproductor bitácora</p>
                <p className="text-[12px] text-slate-400">
                  {resultadosBusqueda.length > 0
                    ? `${resultadosBusqueda.length} videos · toca uno a la derecha`
                    : 'Abre una carpeta a la derecha'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPestanaBitacora('vigilar')}
                className="h-9 rounded-xl border-white/15 text-slate-300 text-xs font-bold"
              >
                Ver cámaras en vivo
              </Button>
            </div>
            <div className="flex-1 min-h-0 rounded-3xl border border-cyan-500/25 bg-black overflow-hidden flex flex-col shadow-[0_0_60px_rgba(34,211,238,0.08)]">
              {videoNube ? (
                <>
                  <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                    <p className="flex-1 min-w-0 text-sm font-bold text-white truncate">{videoNube.titulo}</p>
                    <a
                      href={videoNube.url}
                      download={`bitacora-${videoNube.clip?.id || 'clip'}.webm`}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-bold hover:bg-cyan-500/25"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </a>
                    <button
                      type="button"
                      onClick={cerrarVideoNube}
                      className="h-9 w-9 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <video
                    key={videoNube.url}
                    src={videoNube.url}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    className="flex-1 w-full min-h-[42vh] object-contain bg-black"
                    onError={() =>
                      setErrorVideoNube(
                        'Este navegador no reprodujo el WebM. Pulsa Descargar y ábrelo en Chrome, o VLC.'
                      )
                    }
                  />
                  {errorVideoNube && (
                    <p className="shrink-0 px-4 py-2 text-[12px] text-rose-200 bg-rose-500/10 border-t border-rose-500/20">
                      {errorVideoNube}
                    </p>
                  )}
                  {videoNube.clip?.descripcion_ia && (
                    <p className="shrink-0 px-4 py-3 text-[13px] text-slate-300 border-t border-white/10 leading-relaxed">
                      {videoNube.clip.descripcion_ia}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <Film className="w-14 h-14 text-cyan-500/40" />
                  <p className="text-base font-black text-slate-200">Elige un video</p>
                  <p className="text-[12px] text-slate-500 max-w-sm">
                    En la lista de la derecha toca cualquier clip. Carpetas Revisión / Sospechoso /
                    Cuarentena solo tienen los marcados por la IA.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className={cn(
            'flex-1 flex-col p-6 overflow-y-auto custom-scrollbar bg-black/40',
            pestanaBitacora === 'grabaciones' ? 'hidden' : 'flex'
          )}
          aria-hidden={pestanaBitacora === 'grabaciones'}
        >
          {haySoloDemos && (
            <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex gap-3 text-indigo-100">
              <Camera className="w-5 h-5 shrink-0 text-indigo-400" />
              <div className="text-xs">
                <p className="font-bold mb-1">Modo demo</p>
                <p className="opacity-80">
                  Estas imágenes de internet no se guardan ni se analizan. Toca{' '}
                  <strong>Agregar Cámara</strong>. Si tienes <strong>V380 Pro</strong> (Brave no
                  abre la IP), usa <strong>Puente PC</strong> + la carpeta{' '}
                  <code className="text-indigo-200">herramientas/puente-cctv</code>.
                </p>
              </div>
            </div>
          )}

          {showAlert && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 text-yellow-200 relative animate-ag-fade-in">
              <button
                type="button"
                onClick={() => setShowAlert(false)}
                className="absolute top-3 right-3 p-1 hover:bg-yellow-500/20 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-yellow-500/70" />
              </button>
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
              <div className="text-xs pr-6 space-y-1">
                <p className="font-bold">Cámaras en red local (192.168.x.x)</p>
                <p className="opacity-80">
                  Si la app está en HTTPS y la cámara en HTTP, Chrome bloquea la imagen. Solución
                  segura: candado en la barra → Configuración del sitio →{' '}
                  <strong>Contenido no seguro: Permitir</strong> (solo para esta app).
                </p>
                <p className="opacity-80 flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    No instalamos extensiones tipo “CORS Unblock”: debilitan todo el navegador. Si
                    ODYSSEUS no puede leer el canvas, verás el mensaje en la bitácora (no inventará
                    alertas).
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {camaras.map((cam) => (
              <div
                key={cam.id}
                className={cn(
                  'bg-slate-900 border rounded-2xl overflow-hidden group',
                  cam.esDemo ? 'border-indigo-500/30' : 'border-white/10',
                  ultimaCamaraEscaneada === cam.id && odysseusActivo && 'ring-2 ring-emerald-500/50'
                )}
              >
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        cam.activa ? 'bg-red-500 animate-pulse' : 'bg-slate-500'
                      )}
                    />
                    <span className="text-[9px] font-black uppercase text-white tracking-widest truncate max-w-[140px]">
                      {cam.nombre}
                    </span>
                  </div>

                  {odysseusActivo && !cam.esDemo && (
                    <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-emerald-500/20 backdrop-blur-md rounded-md border border-emerald-500/30 text-[8px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-1.5">
                      <Eye className="w-3 h-3" />
                      {analizando && ultimaCamaraEscaneada === cam.id ? 'Analizando…' : 'En ronda'}
                    </div>
                  )}

                  {cam.esDemo && (
                    <div className="absolute bottom-3 left-3 z-10 px-2 py-1 bg-indigo-500/30 rounded-md text-[8px] font-black uppercase text-indigo-200 tracking-widest">
                      Demo · no vigila
                    </div>
                  )}

                  <img
                    ref={(el) => {
                      videoRefs.current[cam.id] = el;
                    }}
                    src={cam.url}
                    alt={cam.nombre}
                    crossOrigin={cam.esDemo ? 'anonymous' : undefined}
                    className={cn(
                      'w-full h-full object-cover transition-all',
                      !cam.activa && 'grayscale opacity-50'
                    )}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.setAttribute('data-error', 'true');
                      // Reintento solo: si el puente/Tailscale aún no estaba listo (p. ej. tras
                      // reiniciar el PC) la imagen se recupera sin tener que recargar la página.
                      if (!cam.esDemo) {
                        window.setTimeout(() => {
                          if (img.isConnected && img.getAttribute('data-error') === 'true') img.src = conBuster(cam.url);
                        }, 10000);
                      }
                    }}
                    onLoad={(e) => {
                      (e.target as HTMLImageElement).removeAttribute('data-error');
                    }}
                  />

                  <canvas
                    ref={(el) => {
                      canvasRefs.current[cam.id] = el;
                    }}
                    className="hidden"
                  />
                </div>
                <div className="p-3 bg-slate-900 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest truncate">
                      {cam.tipo.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!cam.esDemo && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => refrescarSnapshot(cam.id)}
                          className="h-6 px-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md text-[10px] font-bold uppercase"
                          title="Refrescar imagen"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void probarCaptura(cam)}
                          className="h-6 px-2 text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md text-[10px] font-bold uppercase tracking-widest"
                        >
                          Probar IA
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void eliminarCamara(cam.id)}
                      disabled={!puedeGestionar && !cam.esDemo}
                      className="h-6 px-2 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-30"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {camaras.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
                <Video className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase text-white tracking-widest">
                  Sin cámaras configuradas
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Agrega tu DVR o cámara IP para iniciar el circuito
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'max-w-[100vw] flex flex-col z-20 border-l border-cyan-500/20 bg-gradient-to-b from-slate-950 via-[#0a1628] to-black shadow-[-12px_0_40px_rgba(0,0,0,0.45)]',
            pestanaBitacora === 'grabaciones' ? 'w-[22rem] sm:w-[26rem]' : 'w-[27rem]'
          )}
        >
          {/* Cabecera */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%)]">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center border',
                  odysseusActivo
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                    : 'bg-white/5 border-white/10 text-slate-400'
                )}
              >
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black tracking-tight text-white">
                  Bitácora <span className="text-cyan-300">ODYSSEUS</span>
                </h2>
                <p className="text-[11px] text-slate-400 truncate">
                  {odysseusActivo ? 'Vigilando en vivo' : 'Listo para revisar videos'}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border',
                  analizando || preguntando || escaneandoRegreso
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 animate-pulse'
                    : odysseusActivo
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                )}
              >
                {analizando || preguntando || escaneandoRegreso
                  ? 'Trabajando…'
                  : odysseusActivo
                    ? 'Activo'
                    : 'En pausa'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-black/50 border border-white/10">
              {(
                [
                  { id: 'grabaciones' as const, label: 'Videos', icon: Film },
                  { id: 'escaneo' as const, label: 'Escaneo', icon: FolderSearch },
                  { id: 'preguntar' as const, label: 'Chat', icon: MessageCircle },
                  { id: 'vigilar' as const, label: 'Reglas', icon: Settings },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPestanaBitacora(t.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-[10px] font-bold tracking-wide transition-all',
                    pestanaBitacora === t.id
                      ? 'bg-gradient-to-b from-cyan-400 to-emerald-500 text-black shadow-lg shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <t.icon className="w-[18px] h-[18px]" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* —— Reglas —— */}
          {pestanaBitacora === 'vigilar' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 custom-scrollbar">
              <div className="mb-1">
                <p className="text-[15px] font-black text-white">Qué vigilar</p>
                <p className="text-[12px] text-slate-400">Marca solo lo importante para ti.</p>
              </div>
              {reglasOdysseus.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    'flex items-start gap-3 cursor-pointer rounded-2xl px-3.5 py-3 border transition-all',
                    r.activa
                      ? 'bg-emerald-500/10 border-emerald-400/35'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={r.activa}
                    onChange={() => toggleRegla(r.id)}
                    className="mt-1 accent-emerald-400 scale-110"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-white">{r.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{r.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* —— Chat —— */}
          {pestanaBitacora === 'preguntar' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
              <div>
                <p className="text-[15px] font-black text-white">Preguntar al centinela</p>
                <p className="text-[12px] text-slate-400">Elige cámara y escribe en español.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-cyan-300/90">Cámara</label>
                <select
                  value={camaraPreguntaId}
                  onChange={(e) => setCamaraPreguntaId(e.target.value)}
                  className="w-full bg-black/40 border border-cyan-500/20 focus:border-cyan-400/50 rounded-2xl px-3.5 py-3 text-sm text-white outline-none"
                >
                  {camaras.filter((c) => !c.esDemo).length === 0 && (
                    <option value="">Sin cámaras reales</option>
                  )}
                  {camaras
                    .filter((c) => !c.esDemo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-cyan-300/90">Tu pregunta</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={preguntaIa}
                    onChange={(e) => setPreguntaIa(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void preguntarAOdysseus();
                    }}
                    placeholder="¿Hay alguien en caja?"
                    className="flex-1 bg-black/40 border border-cyan-500/20 focus:border-cyan-400/50 rounded-2xl px-3.5 py-3 text-sm text-white outline-none"
                  />
                  <Button
                    type="button"
                    disabled={preguntando}
                    onClick={() => void preguntarAOdysseus()}
                    className="h-12 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-500 hover:opacity-90 text-black font-black"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* —— Videos —— */}
          {pestanaBitacora === 'grabaciones' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-3 pt-3 pb-2 space-y-2.5 border-b border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-black text-white">Lista</p>
                  <button
                    type="button"
                    disabled={cargandoNube}
                    onClick={() => void abrirCarpetaUI(carpetaActiva)}
                    className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    Actualizar
                  </button>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
                  {(
                    [
                      { id: 'todas' as const, label: 'Todas', cls: 'border-sky-400/40 text-sky-100 bg-sky-500/15', n: conteoCarpetas.todas },
                      { id: 'sospechoso' as const, label: 'Sospechoso', cls: 'border-orange-400/40 text-orange-100 bg-orange-500/15', n: conteoCarpetas.sospechoso },
                      { id: 'evidencia' as const, label: 'Evidencia', cls: 'border-amber-400/40 text-amber-100 bg-amber-500/15', n: conteoCarpetas.evidencia },
                      { id: 'cuarentena' as const, label: 'Cuarentena', cls: 'border-rose-400/40 text-rose-100 bg-rose-500/15', n: conteoCarpetas.cuarentena },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={cargandoNube}
                      onClick={() => void abrirCarpetaUI(c.id)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black border transition-all inline-flex items-center gap-1.5',
                        c.cls,
                        carpetaActiva === c.id ? 'ring-2 ring-white/40 scale-105' : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      {c.label}
                      <span className="text-[10px] font-bold opacity-80 tabular-nums">{c.n}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={busquedaTexto}
                    onChange={(e) => setBusquedaTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void ejecutarBusquedaBitacora();
                    }}
                    placeholder="Buscar…"
                    className="flex-1 bg-black/40 border border-white/15 focus:border-cyan-400/50 rounded-xl px-3 py-2 text-[12px] text-white outline-none"
                  />
                  <Button
                    type="button"
                    disabled={buscandoClips}
                    onClick={() => void ejecutarBusquedaBitacora()}
                    className="h-9 w-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 custom-scrollbar">
                {cargandoNube && (
                  <p className="text-center text-xs text-cyan-200/70 py-8 animate-pulse">Cargando…</p>
                )}
                {!cargandoNube && resultadosBusqueda.length === 0 && (
                  <div className="text-center py-6 px-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 space-y-3">
                    <p className="text-[12px] font-bold text-slate-200">
                      {carpetaActiva === 'todas' ? 'Sin videos aún' : 'Esta carpeta está vacía'}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      {carpetaActiva === 'todas'
                        ? 'Activa «Grabar bitácora» en el PC del local.'
                        : 'Sospechoso / Evidencia / Cuarentena se llenan con el Escaneo o alertas de IA.'}
                    </p>
                    {carpetaActiva !== 'todas' && (
                      <Button
                        type="button"
                        onClick={() => void abrirCarpetaUI('todas')}
                        className="h-10 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-500 text-black font-black text-xs"
                      >
                        Ver Todas ({conteoCarpetas.todas || '…'} videos)
                      </Button>
                    )}
                  </div>
                )}
                {resultadosBusqueda.map((clip) => {
                  const grave =
                    clip.clasificacion === 'malo' ||
                    (clip.categorias_detectadas || []).some((x) =>
                      ['robo', 'plata_bolsillo', 'escondite_gaveta', 'devolucion_simulada'].includes(String(x))
                    );
                  const activo = videoNube?.clip?.id === clip.id;
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => void abrirClipBitacora(clip)}
                      className={cn(
                        'w-full text-left rounded-xl border overflow-hidden transition-all',
                        activo
                          ? 'bg-cyan-500/15 border-cyan-400/50'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-cyan-400/25'
                      )}
                    >
                      <div className="flex items-stretch">
                        <div
                          className={cn(
                            'w-1 shrink-0',
                            grave ? 'bg-rose-500' : clip.alerta ? 'bg-amber-400' : 'bg-cyan-500/50'
                          )}
                        />
                        <div className="p-2.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Play className={cn('w-3.5 h-3.5 shrink-0', activo ? 'text-cyan-300' : 'text-slate-500')} />
                            <p className="text-[12px] font-bold text-white truncate flex-1">
                              {clip.camara_nombre || clip.camara_id}
                            </p>
                            {clip.alerta && (
                              <span className="text-[8px] font-black uppercase text-rose-300">!</span>
                            )}
                          </div>
                          <p className="text-[10px] text-cyan-300/80 mt-0.5 pl-5">
                            {new Date(clip.capturado_en).toLocaleString('es-CO', {
                              hour12: false,
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 pl-5 line-clamp-1">
                            {clip.descripcion_ia || 'Sin analizar'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* —— Escaneo —— */}
          {pestanaBitacora === 'escaneo' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
              <div>
                <p className="text-[15px] font-black text-white">Forense DVR (grabaciones viejas)</p>
                <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                  La IA busca según las reglas. En el DVR (7 / 14 / 21 días) y en los videos ya
                  guardados en D:\DulcePlacerEvidencia. Tú borras lo que no sea sospechoso. Carpetas:{' '}
                  <span className="text-orange-300 font-semibold">Sospechoso</span> →{' '}
                  <span className="text-amber-300 font-semibold">Evidencia</span> →{' '}
                  <span className="text-rose-300 font-semibold">Cuarentena</span>.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">
                  Reglas forenses ({REGLAS_FORENSES_DVR.length})
                </p>
                {REGLAS_FORENSES_DVR.map((r) => (
                  <p key={r.id} className="text-[10px] text-slate-400 leading-snug">
                    <span className="text-slate-200 font-semibold">{r.label}</span> — {r.detalle}
                  </p>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" /> DVR
                  </p>
                  {infoDvr ? (
                    <span className="text-[10px] text-emerald-300 font-bold truncate">✓ {infoDvr}</span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Se conecta al escanear</span>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={!puedeGestionar || escaneandoRegreso}
                  onClick={() => void conectarDvr()}
                  className="w-full h-9 rounded-xl bg-white/90 text-black hover:bg-white font-bold text-xs"
                >
                  {infoDvr ? 'Reconectar' : 'Probar conexión DVR'}
                </Button>
              </div>

              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] p-3 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">Rango</p>
                <div className="grid grid-cols-3 gap-2">
                  {([7, 14, 21] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={escaneandoRegreso}
                      onClick={() => setDiasEscaneo(d)}
                      className={cn(
                        'rounded-2xl py-3 text-sm font-black transition-all',
                        diasEscaneo === d
                          ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/30'
                          : 'bg-black/35 text-slate-300 hover:bg-black/50'
                      )}
                    >
                      {d}
                      <span className="block text-[10px] font-semibold opacity-80">días</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-rose-400/35 bg-rose-500/[0.08] p-3 space-y-2">
                {progresoEscaneo && (
                  <p className="text-[12px] text-rose-100 font-semibold animate-pulse">{progresoEscaneo}</p>
                )}
                <Button
                  type="button"
                  disabled={!puedeGestionar || escaneandoRegreso}
                  onClick={() => void escaneoAlRegresar(diasEscaneo)}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-rose-500 hover:opacity-95 text-black font-black text-sm shadow-lg shadow-rose-900/30"
                >
                  {escaneandoRegreso
                    ? 'Revisando con las reglas…'
                    : `Forense: últimos ${diasEscaneo} días en disco`}
                </Button>
                <Button
                  type="button"
                  disabled={!puedeGestionar || escaneandoRegreso}
                  onClick={() => void revisarVideosDisco()}
                  className="w-full h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 font-bold text-xs"
                >
                  Revisar videos de D:\ con las reglas
                </Button>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'sospechoso' as const, label: 'Sospechoso' },
                      { id: 'evidencia' as const, label: 'Evidencia' },
                      { id: 'cuarentena' as const, label: 'Cuarentena' },
                    ] as const
                  ).map((b) => (
                    <Button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setPestanaBitacora('grabaciones');
                        void abrirCarpetaUI(b.id);
                      }}
                      className="h-9 rounded-xl bg-black/40 border border-white/10 text-white text-[10px] font-bold"
                    >
                      {b.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Diario en vivo: se ve que el puente sí trabaja */}
              <div className="rounded-2xl border border-cyan-500/20 bg-black/50 p-3 min-h-[8rem]">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300/90 mb-2">
                  Diario forense (disco DVR)
                </p>
                {diarioEscaneo.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Al pulsar Forense verás cada fotograma del disco y cada hallazgo con fecha.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                    {diarioEscaneo.map((l, i) => (
                      <p key={`${i}-${l.slice(0, 20)}`} className="text-[10px] text-slate-300 leading-snug font-mono">
                        {l}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pie: en Videos se reduce para no tapar la lista */}
          <div className="shrink-0 border-t border-white/10 px-3 py-2 space-y-1.5 bg-black/60 backdrop-blur-md">
            {pestanaBitacora !== 'grabaciones' && (
              <Button
                type="button"
                disabled={generandoInforme}
                onClick={() => void generarInformeDelDia()}
                className="w-full h-10 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 text-xs font-bold gap-2"
              >
                <FileText className="w-4 h-4" />
                {generandoInforme ? 'Generando…' : 'Informe del día'}
              </Button>
            )}
            {bitacora.length > 0 && (
              <div
                className={cn(
                  'overflow-y-auto space-y-1 custom-scrollbar',
                  pestanaBitacora === 'grabaciones' ? 'max-h-12' : 'max-h-24'
                )}
              >
                {bitacora.slice(0, pestanaBitacora === 'grabaciones' ? 2 : 5).map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'px-2.5 py-1.5 rounded-xl text-[10px] leading-snug border',
                      log.alerta
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                        : 'bg-white/[0.03] border-white/5 text-slate-400'
                    )}
                  >
                    <span className="opacity-60 mr-1 font-mono">
                      {log.tiempo.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.mensaje.length > 70 ? `${log.mensaje.slice(0, 70)}…` : log.mensaje}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-ag-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                Nueva Cámara DVR
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Nombre Identificador
                </label>
                <input
                  type="text"
                  value={nuevaCamara.nombre || ''}
                  onChange={(e) => setNuevaCamara({ ...nuevaCamara, nombre: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#DAA520] focus:outline-none transition-all"
                  placeholder="Ej: Vitrina 1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setModoFormulario('asistente');
                      setNuevaCamara({ ...nuevaCamara, tipo: 'snapshot' });
                    }}
                    className={cn(
                      'flex-1 text-[10px] h-9',
                      modoFormulario === 'asistente'
                        ? 'bg-emerald-500 text-black hover:bg-emerald-600'
                        : 'bg-black/40 text-slate-400 hover:text-white'
                    )}
                  >
                    IP / DVR
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setModoFormulario('puente');
                      setNuevaCamara((prev) => ({
                        ...prev,
                        tipo: 'mjpeg',
                        nombre: prev.nombre?.trim() ? prev.nombre : 'Caja V380',
                      }));
                    }}
                    className={cn(
                      'flex-1 text-[10px] h-9',
                      modoFormulario === 'puente'
                        ? 'bg-sky-500 text-black hover:bg-sky-600'
                        : 'bg-black/40 text-slate-400 hover:text-white'
                    )}
                  >
                    Puente PC (video)
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setModoFormulario('manual');
                      setNuevaCamara({ ...nuevaCamara, tipo: 'mjpeg' });
                    }}
                    className={cn(
                      'flex-1 text-[10px] h-9',
                      modoFormulario === 'manual'
                        ? 'bg-emerald-500 text-black hover:bg-emerald-600'
                        : 'bg-black/40 text-slate-400 hover:text-white'
                    )}
                  >
                    URL Manual
                  </Button>
                </div>
              </div>

              {modoFormulario === 'asistente' ? (
                <div className="space-y-3 p-3 bg-black/40 rounded-xl border border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Marca DVR / Cámara
                      </label>
                      <select
                        value={marca}
                        onChange={(e) => {
                          const m = e.target.value;
                          setMarca(m);
                          if (m === 'v380') {
                            toast.message('V380: si Brave no abre la IP, usa el botón «Puente PC».');
                          }
                        }}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="hikvision">Hikvision (DVR/NVR)</option>
                        <option value="dahua">Dahua (DVR/NVR)</option>
                        <option value="tapo">TP-Link Tapo / EZVIZ</option>
                        <option value="v380">V380 Pro (WiFi / app)</option>
                        <option value="generica_mjpeg">Cámara IP / MJPEG genérica</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Canal (DVR)
                      </label>
                      <input
                        type="number"
                        value={canal}
                        onChange={(e) => setCanal(e.target.value)}
                        min={1}
                        max={64}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Dirección IP Local (Ej: 192.168.1.100)
                    </label>
                    <input
                      type="text"
                      value={ipLocal}
                      onChange={(e) => setIpLocal(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      placeholder="192.168.1.X"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Usuario
                      </label>
                      <input
                        type="text"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  {ayudaMarca && (
                    <p className="text-[9px] text-sky-300/90 font-medium leading-relaxed">{ayudaMarca}</p>
                  )}
                  {marca === 'v380' && (
                    <div className="text-[9px] text-slate-400 leading-relaxed space-y-1 border-t border-white/5 pt-2">
                      <p className="font-bold text-slate-300 uppercase tracking-wider">V380 sin imagen en Brave</p>
                      <p>1. Activa ONVIF/RTSP en la app V380.</p>
                      <p>
                        2. En el PC: carpeta <strong>herramientas/puente-cctv</strong> →{' '}
                        <strong>INICIAR_PUENTE_CCTV.bat</strong>
                      </p>
                      <p>3. Vuelve aquí y elige el botón <strong>Puente PC (V380)</strong>.</p>
                    </div>
                  )}
                  <p className="text-[9px] text-amber-400/90 font-medium leading-relaxed">
                    La clave se incrusta en la URL del snapshot (límite del protocolo del DVR). Usa
                    solo en red local de la panadería.
                  </p>
                </div>
              ) : modoFormulario === 'puente' ? (
                <div className="space-y-3 p-3 bg-sky-500/10 rounded-xl border border-sky-500/30">
                  <p className="text-[10px] text-sky-100 font-bold leading-relaxed">
                    Video en vivo (Hikvision o V380) por el puente del PC. Llenas datos → eliges
                    carpeta → enciendes el .bat → Conectar.
                  </p>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Tipo de cámara / DVR
                    </label>
                    <select
                      value={tipoPuente}
                      onChange={(e) => {
                        const t = e.target.value as TipoCamaraPuente;
                        setTipoPuente(t);
                        if (t === 'hikvision') {
                          setPuenteStream((s) => (s === 'caja' ? 'hik1' : s));
                          setNuevaCamara((prev) => ({
                            ...prev,
                            nombre: prev.nombre?.trim() ? prev.nombre : 'Hikvision Ch1',
                          }));
                        }
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="hikvision">Hikvision (DVR/NVR) — video vivo</option>
                      <option value="v380">V380 Pro (WiFi)</option>
                    </select>
                  </div>

                  <div className={cn('grid gap-3', tipoPuente === 'hikvision' ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div className={tipoPuente === 'hikvision' ? '' : 'col-span-1'}>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        {tipoPuente === 'hikvision'
                          ? 'IP del DVR Hikvision'
                          : 'IP de la cámara V380'}
                      </label>
                      <input
                        type="text"
                        value={ipLocal}
                        onChange={(e) => setIpLocal(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="Ej: 192.168.18.10"
                      />
                    </div>
                    {tipoPuente === 'hikvision' && (
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Canal
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={64}
                          value={canal}
                          onChange={(e) => setCanal(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Usuario cámara
                      </label>
                      <input
                        type="text"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="admin"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Contraseña cámara
                      </label>
                      <input
                        type="password"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        IP de este PC (para ver en celular)
                      </label>
                      <input
                        type="text"
                        value={puenteHost}
                        onChange={(e) => setPuenteHost(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="127.0.0.1 en este PC"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Nombre corto
                      </label>
                      <input
                        type="text"
                        value={puenteStream}
                        onChange={(e) => setPuenteStream(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="caja"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      onClick={() => void guardarYamlEligiendoCarpeta()}
                      className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black uppercase tracking-widest text-[10px] gap-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      1 · Elegir carpeta y guardar ahí
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copiarRutaCarpetaPuente()}
                        className="h-9 rounded-xl border-white/15 bg-black/30 text-slate-200 text-[9px] font-black uppercase tracking-wider gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar ruta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const y = construirYamlPuente();
                          if (!y) return;
                          descargarYamlFallback(y);
                          toast.message('Descargado. Si puedes, usa «Elegir carpeta» (más fácil).');
                        }}
                        className="h-9 rounded-xl border-white/15 bg-black/30 text-slate-200 text-[9px] font-black uppercase tracking-wider gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Solo descargar
                      </Button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono break-all leading-relaxed px-1">
                      Carpeta correcta: {RUTA_CARPETA_PUENTE}
                    </p>
                  </div>

                  <ol className="text-[9px] text-slate-300 leading-relaxed space-y-1.5 list-decimal pl-4">
                    <li>
                      Pulsa <strong>Elegir carpeta</strong> → ve a{' '}
                      <strong>herramientas → puente-cctv</strong> → Seleccionar.
                    </li>
                    <li>
                      Doble clic en <strong>INICIAR_PUENTE_CCTV.bat</strong> (déjalo abierto).
                    </li>
                    <li>
                      Si Brave muestra el video → pulsa abajo <strong>Conectar cámara</strong>.
                    </li>
                  </ol>

                  <div className="p-2 bg-black/40 rounded-lg">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      URL que se guardará en la app
                    </p>
                    <p className="text-[11px] text-emerald-300 break-all font-mono">{urlDesdePuente()}</p>
                  </div>
                  <p className="text-[9px] text-amber-200/90">
                    En el celular: pon la IP de este PC (ej. 192.168.18.4), no 127.0.0.1. Misma WiFi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    URL Directa del Stream
                  </label>
                  <input
                    type="text"
                    value={nuevaCamara.url || ''}
                    onChange={(e) => setNuevaCamara({ ...nuevaCamara, url: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#DAA520] focus:outline-none transition-all"
                    placeholder="http://ip:puerto/video  ·  o MJPEG del puente go2rtc"
                  />
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    Cualquier HTTP de foto o MJPEG que abra en el navegador. Ejemplo puente:{' '}
                    <span className="text-slate-400">
                      http://192.168.x.x:1984/api/stream.mjpeg?src=caja
                    </span>
                  </p>
                </div>
              )}

              <Button
                onClick={() => void guardarCamara()}
                className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-widest mt-2"
              >
                Conectar Cámara
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {alertasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Alertas al celular</h3>
              <button type="button" onClick={() => setAlertasOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Tu WhatsApp (con indicativo, ej. 573001234567)
              <input
                value={cfgAlertas.whatsapp}
                onChange={(e) => guardarAlertas({ ...cfgAlertas, whatsapp: e.target.value })}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white normal-case tracking-normal"
              />
            </label>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Clave CallMeBot
              <input
                value={cfgAlertas.apikey}
                onChange={(e) => guardarAlertas({ ...cfgAlertas, apikey: e.target.value })}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white normal-case tracking-normal"
              />
            </label>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Una sola vez: desde tu WhatsApp escribe <b>I allow callmebot to send me messages</b> al <b>+34 644 51 95 23</b>. Te responde con la clave. Es gratis y no confirma la entrega.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={cfgAlertas.navegador} onChange={(e) => guardarAlertas({ ...cfgAlertas, navegador: e.target.checked })} className="accent-emerald-500" />
              Notificación y sonido en este aparato
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={cfgAlertas.soloCriticas} onChange={(e) => guardarAlertas({ ...cfgAlertas, soloCriticas: e.target.checked })} className="accent-emerald-500" />
              Avisar solo lo grave (robo, devolución simulada, regalo, consumo sin registrar)
            </label>
            <Button onClick={() => void probarAlerta()} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-widest">
              Enviar prueba
            </Button>
          </div>
        </div>
      )}

      {mostrarInforme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-ag-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                Informe del día
              </h3>
              <button
                type="button"
                onClick={() => setMostrarInforme(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed font-sans">
              {informeDia}
            </pre>
          </div>
        </div>
      )}

      {showOjoIA && <OjoIA onClose={() => setShowOjoIA(false)} />}
    </div>
  );
}
