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
  BrainCircuit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import { generateUUID } from '@/lib/safe-utils';
import { useAuth } from '@/contexts/AuthContext';
import { OjoIA } from '@/components/videovigilancia/OjoIA';
import {
  cargarReglasOdysseus,
  guardarReglasOdysseus,
  construirYamlGo2rtc,
  promptEscaneoOdysseus,
  promptPreguntaOdysseus,
  type ReglaOdysseus,
  type TipoCamaraPuente,
} from '@/lib/odysseus-vigilancia';

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

const esUrlHttpLocal = (url: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);

/** Cache-buster para forzar refresco de snapshots estáticos. */
const conBuster = (url: string) => {
  if (!url || url.startsWith('data:')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}`;
};

export function Videovigilancia() {
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
  const reglasRef = useRef(reglasOdysseus);

  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const camarasRef = useRef<Camara[]>([]);
  const odysseusRef = useRef(false);

  useEffect(() => {
    camarasRef.current = camaras;
  }, [camaras]);

  useEffect(() => {
    odysseusRef.current = odysseusActivo;
  }, [odysseusActivo]);

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

  const capturarFrame = (camaraId: string): string | null => {
    const img = videoRefs.current[camaraId];
    const canvas = canvasRefs.current[camaraId];
    if (!img || !canvas || img.getAttribute('data-error') === 'true') return null;
    if (!img.complete || img.naturalWidth === 0) return null;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = 400;
      canvas.height = 300;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

      const frame = capturarFrame(camara.id);
      setUltimaCamaraEscaneada(camara.id);

      if (!frame) {
        const motivo = esUrlHttpLocal(camara.url)
          ? 'Sin imagen: cámara HTTP local bloqueada o CORS. En Chrome: candado → Contenido no seguro → Permitir (solo en esta app).'
          : 'Sin imagen: la cámara no cargó o el navegador bloqueó el canvas (CORS).';
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

    const frame = capturarFrame(cam.id);
    if (!frame) {
      agregarLog(
        `[${cam.nombre}] SIN_IMAGEN: no puedo responder. Revisa Contenido no seguro / puente encendido.`,
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
        <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowOjoIA(true)}
              disabled={!puedeGestionar}
              className="bg-indigo-600 hover:bg-indigo-700 h-10 px-4 rounded-xl text-white font-bold"
            >
              <BrainCircuit className="w-4 h-4 mr-2" /> Activar Ojo IA
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
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar bg-black/40">
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

        <div className="w-96 bg-black/60 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20">
          <div className="shrink-0 p-5 border-b border-white/5 bg-slate-900/80 flex items-center gap-4">
            <Shield className={cn('w-6 h-6', odysseusActivo ? 'text-emerald-400' : 'text-slate-500')} />
            <div>
              <h2 className="text-[15px] font-black text-white uppercase tracking-wider">
                Bitácora ODYSSEUS
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                Video · alertas · preguntas
              </p>
            </div>
            {(analizando || preguntando) && (
              <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>

          {/* B: Qué vigilar */}
          <div className="shrink-0 p-4 border-b border-white/5 space-y-2 max-h-[28%] overflow-y-auto">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/90">
              Qué vigilar (configura)
            </p>
            <div className="space-y-1.5">
              {reglasOdysseus.map((r) => (
                <label
                  key={r.id}
                  className="flex items-start gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={r.activa}
                    onChange={() => toggleRegla(r.id)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-200">{r.label}</span>
                    <span className="block text-[9px] text-slate-500 leading-snug">{r.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* C: Preguntar */}
          <div className="shrink-0 p-4 border-b border-white/5 space-y-2 bg-emerald-500/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              Pregúntale a ODYSSEUS
            </p>
            <select
              value={camaraPreguntaId}
              onChange={(e) => setCamaraPreguntaId(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white"
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
            <div className="flex gap-2">
              <input
                type="text"
                value={preguntaIa}
                onChange={(e) => setPreguntaIa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void preguntarAOdysseus();
                }}
                placeholder="¿Hay alguien en caja?"
                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              />
              <Button
                type="button"
                disabled={preguntando}
                onClick={() => void preguntarAOdysseus()}
                className="h-9 w-9 shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {!odysseusActivo && bitacora.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <Eye className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-xs font-black uppercase">IA en reposo</p>
                <p className="text-[10px] mt-2 px-4 normal-case tracking-normal opacity-80">
                  Activa ODYSSEUS, configura alertas o pregúntale arriba.
                </p>
              </div>
            )}

            {bitacora.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'p-4 rounded-2xl border text-[13px] leading-relaxed transition-all animate-ag-fade-in',
                  log.alerta
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                )}
              >
                <div className="flex items-center gap-2 mb-2 opacity-60">
                  {log.alerta ? (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  ) : (
                    <Search className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {log.tiempo.toLocaleTimeString()}
                  </span>
                </div>
                <p className="font-bold">{log.mensaje}</p>
              </div>
            ))}
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
      
      {showOjoIA && <OjoIA onClose={() => setShowOjoIA(false)} />}
    </div>
  );
}
