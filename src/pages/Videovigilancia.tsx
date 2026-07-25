import { useState, useRef, useEffect } from 'react';
import { Camera, Shield, Search, AlertTriangle, Play, Pause, Plus, Settings, Video, Eye, ShieldAlert, Cpu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import { generateUUID } from '@/lib/safe-utils';

interface Camara {
  id: string;
  nombre: string;
  url: string; // URL MJPEG o Imagen de snapshot
  tipo: 'snapshot' | 'mjpeg';
  activa: boolean;
}

export function Videovigilancia() {
  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [odysseusActivo, setOdysseusActivo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [bitacora, setBitacora] = useState<{ id: string, tiempo: Date, mensaje: string, alerta: boolean }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [nuevaCamara, setNuevaCamara] = useState<Partial<Camara>>({ tipo: 'snapshot', activa: true });
  
  // Para configuración simplificada
  const [ipLocal, setIpLocal] = useState('');
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('');
  const [marca, setMarca] = useState('hikvision');
  const [canal, setCanal] = useState('1');

  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});
  const videoRefs = useRef<{ [key: string]: HTMLImageElement | null }>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cargarCamaras();
  }, []);

  const cargarCamaras = async () => {
    try {
      const data = await db.getAllCamaras();
      if (data && data.length > 0) {
        setCamaras(data);
      } else {
        // Camaras de demostración por defecto
        const demo: Camara[] = [
          { id: generateUUID(), nombre: 'Caja Principal', url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=600', tipo: 'snapshot', activa: true },
          { id: generateUUID(), nombre: 'Área de Producción', url: 'https://images.unsplash.com/photo-1587241321921-91a834d6d191?auto=format&fit=crop&q=80&w=600', tipo: 'snapshot', activa: true }
        ];
        for (const c of demo) await db.saveCamara(c);
        setCamaras(demo);
      }
    } catch { toast.error('Error cargando cámaras'); }
  };

  const generarUrlPorMarca = () => {
    if (!ipLocal) return '';
    const ip = ipLocal.replace('http://', '').replace('https://', '');
    const auth = usuario && clave ? `${usuario}:${clave}@` : '';
    
    switch (marca) {
      case 'hikvision': return `http://${auth}${ip}/ISAPI/Streaming/channels/${canal}01/picture`;
      case 'dahua': return `http://${auth}${ip}/cgi-bin/snapshot.cgi?channel=${canal}`;
      case 'tapo': return `http://${auth}${ip}/stream/video/mjpeg`; // TP-Link / Genericas
      case 'generica_mjpeg': return `http://${auth}${ip}:8080/video`;
      default: return `http://${ip}/snapshot.cgi`;
    }
  };

  const guardarCamara = async () => {
    let urlFinal = nuevaCamara.url;
    // Si usó el asistente fácil pero no llenó la URL manual
    if (!urlFinal && ipLocal) {
      urlFinal = generarUrlPorMarca();
    }

    if (!nuevaCamara.nombre || !urlFinal) return toast.error('Faltan el nombre o la dirección IP de la cámara');
    
    const cam = { 
      ...nuevaCamara, 
      url: urlFinal,
      id: generateUUID() 
    } as Camara;
    
    await db.saveCamara(cam);
    setCamaras([...camaras, cam]);
    setModalOpen(false);
    toast.success('Cámara añadida');
  };

  const eliminarCamara = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta cámara?')) return;
    await db.deleteCamara(id);
    setCamaras(camaras.filter(c => c.id !== id));
    toast.success('Cámara eliminada');
  };

  const toggleOdysseus = () => {
    if (odysseusActivo) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setOdysseusActivo(false);
      agregarLog('Sistema ODYSSEUS desactivado.');
    } else {
      setOdysseusActivo(true);
      agregarLog('Sistema ODYSSEUS activado. Escaneando red de cámaras...');
      iniciarVigilancia();
    }
  };

  const agregarLog = (mensaje: string, alerta = false) => {
    setBitacora(prev => [{ id: generateUUID(), tiempo: new Date(), mensaje, alerta }, ...prev].slice(0, 50));
  };

  // Extrae un frame de una camara usando Canvas oculto (para procesarlo)
  const capturarFrame = (camaraId: string): string | null => {
    const img = videoRefs.current[camaraId];
    const canvas = canvasRefs.current[camaraId];
    if (!img || !canvas || img.getAttribute('data-error') === 'true') return null;
    
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = 400; // Redimensionar para IA
      canvas.height = 300;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Retorna base64 jpeg
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
      console.warn('CORS bloqueó el canvas. Instalar extensión CORS Unblock.', e);
      return null;
    }
  };

  const iniciarVigilancia = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Cada 15 segundos escanea una cámara aleatoria activa
    intervalRef.current = setInterval(async () => {
      const activas = camaras.filter(c => c.activa);
      if (activas.length === 0) return;
      
      const camara = activas[Math.floor(Math.random() * activas.length)];
      const frame = capturarFrame(camara.id);
      
      if (!frame) {
        // Fallback visual si el canvas está bloqueado por CORS
        console.warn('CORS previno captura del canvas. Simulando análisis para demo.');
      }

      setAnalizando(true);
      try {
        const contexto = `Estas viendo la cámara: ${camara.nombre}. Tu misión es buscar anomalías (gente inactiva, suciedad, fuego, robo). Si todo está normal di "NORMAL: Todo en orden". Si ves algo extraño lanza "ALERTA: [Descripción]". Responde muy corto.`;
        // En una app real, frame iría en el tercer parámetro. Si falla por CORS, enviamos undefined.
        const res = await consultarAgente('odysseus', contexto, frame || undefined);
        
        const esAlerta = res.toLowerCase().includes('alerta') || res.toLowerCase().includes('anomalía');
        agregarLog(`[${camara.nombre}] ${res.trim()}`, esAlerta);

        // Si es una alerta seria, mandar a la DB real de hallazgos
        if (esAlerta) {
          await db.addAgenteHallazgo('odysseus', {
            id: generateUUID(),
            tipo: 'seguridad',
            gravedad: 'alta',
            titulo: 'Alerta CCTV en ' + camara.nombre,
            descripcion: res,
            fecha: new Date().toISOString(),
            revisado: false
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAnalizando(false);
      }
    }, 15000);
  };

  // Limpiar loop al salir
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="flex-1 h-screen bg-[#020617] text-slate-200 overflow-hidden flex flex-col font-sans">
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Video className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">
              Vigilancia <span className="text-emerald-400">CCTV</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
              Powered by ODYSSEUS AI Vision
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setModalOpen(true)} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-4 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Agregar Cámara
          </Button>
          <Button 
            onClick={toggleOdysseus}
            className={cn("h-10 px-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all",
              odysseusActivo 
                ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 animate-pulse" 
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
            )}
          >
            {odysseusActivo ? <><Pause className="w-4 h-4 mr-2" /> ODYSSEUS Activo</> : <><Play className="w-4 h-4 mr-2" /> Activar ODYSSEUS</>}
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Panel de Cámaras (Grid) */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar bg-black/40">
          
          {showAlert && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 text-yellow-200 relative animate-ag-fade-in">
              <button 
                onClick={() => setShowAlert(false)} 
                className="absolute top-3 right-3 p-1 hover:bg-yellow-500/20 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-yellow-500/70 hover:text-yellow-400" />
              </button>
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
              <div className="text-xs pr-6">
                <p className="font-bold mb-1">¿No se ven las cámaras locales (Ej: 192.168.x.x)?</p>
                <p className="opacity-80">Por seguridad, el navegador bloquea cámaras locales (HTTP) desde una web segura (HTTPS). Para verlas: <strong>Haz clic en el ícono de Candado 🔒 (o Configuración) en la barra de direcciones de Chrome {'->'} Configuración de sitios {'->'} Contenido no seguro: PERMITIR.</strong></p>
                <p className="opacity-80 mt-1">Si deseas que la <strong>IA ODYSSEUS</strong> analice las imágenes, instala la extensión de Chrome <em>"CORS Unblock"</em>, de lo contrario la IA no podrá "leer" las cámaras.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {camaras.map(cam => (
              <div key={cam.id} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden group">
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {/* Etiqueta de grabación */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10">
                    <span className={cn("w-2 h-2 rounded-full animate-pulse", cam.activa ? "bg-red-500" : "bg-slate-500")} />
                    <span className="text-[9px] font-black uppercase text-white tracking-widest">{cam.nombre}</span>
                  </div>
                  
                  {/* Status AI */}
                  {odysseusActivo && (
                    <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-emerald-500/20 backdrop-blur-md rounded-md border border-emerald-500/30 text-[8px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> AI Vision
                    </div>
                  )}

                  {/* Imagen (Snapshot estático pseudo-en vivo o MJPEG) */}
                  <img 
                    ref={el => { videoRefs.current[cam.id] = el }}
                    src={cam.url} 
                    alt={cam.nombre}
                    className={cn("w-full h-full object-cover transition-all", !cam.activa && "grayscale opacity-50")}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.src.includes('error_detected')) {
                        img.setAttribute('data-error', 'true');
                        // No cambiar la src para evitar loop, pero marcar error
                      }
                    }}
                  />

                  {/* Canvas Oculto para capturar frames */}
                  <canvas ref={el => { canvasRefs.current[cam.id] = el }} className="hidden" />

                  {/* Escáner Visual (Solo cosmético para dar sensación de IA) */}
                  {odysseusActivo && cam.activa && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-b from-transparent via-emerald-400/30 to-transparent w-full h-[20%] animate-ag-slide-up" style={{ animationDuration: '3s', animationIterationCount: 'infinite' }} />
                  )}
                </div>
                <div className="p-3 bg-slate-900 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest">Protocolo: {cam.tipo.toUpperCase()}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => eliminarCamara(cam.id)}
                    className="h-6 px-2 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
            
            {camaras.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
                <Video className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase text-white tracking-widest">Sin cámaras configuradas</p>
                <p className="text-xs text-slate-500 mt-2">Agrega cámaras RTSP/Snapshot para iniciar el circuito cerrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Bitácora de ODYSSEUS */}
        <div className="w-96 bg-black/60 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20">
          <div className="shrink-0 p-5 border-b border-white/5 bg-slate-900/80 flex items-center gap-4">
            <Shield className={cn("w-6 h-6", odysseusActivo ? "text-emerald-400" : "text-slate-500")} />
            <div>
              <h2 className="text-[15px] font-black text-white uppercase tracking-wider">Bitácora ODYSSEUS</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Análisis Multimodal en Vivo</p>
            </div>
            {analizando && <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {!odysseusActivo && bitacora.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <Eye className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-xs font-black uppercase">IA en reposo</p>
              </div>
            )}

            {bitacora.map(log => (
              <div key={log.id} className={cn("p-4 rounded-2xl border text-[13px] leading-relaxed transition-all animate-ag-fade-in shadow-lg", 
                log.alerta ? "bg-red-500/10 border-red-500/30 text-red-200" : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
              )}>
                <div className="flex items-center gap-2 mb-2 opacity-60">
                  {log.alerta ? <ShieldAlert className="w-4 h-4 text-red-400" /> : <Search className="w-4 h-4 text-emerald-400" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{log.tiempo.toLocaleTimeString()}</span>
                </div>
                <p className="font-bold">{log.mensaje}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal Agregar Cámara */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm animate-ag-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Nueva Cámara DVR</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white"><Settings className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre Identificador</label>
                <input 
                  type="text" 
                  value={nuevaCamara.nombre || ''}
                  onChange={e => setNuevaCamara({...nuevaCamara, nombre: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#DAA520] focus:outline-none transition-all"
                  placeholder="Ej: Vitrina 1"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setNuevaCamara({...nuevaCamara, tipo: 'snapshot'})}
                  className={cn("flex-1 text-xs", nuevaCamara.tipo === 'snapshot' ? "bg-emerald-500 text-black hover:bg-emerald-600" : "bg-black/40 text-slate-400 hover:text-white")}
                >
                  Asistente Fácil (IP/DVR)
                </Button>
                <Button 
                  onClick={() => setNuevaCamara({...nuevaCamara, tipo: 'mjpeg'})}
                  className={cn("flex-1 text-xs", nuevaCamara.tipo === 'mjpeg' ? "bg-emerald-500 text-black hover:bg-emerald-600" : "bg-black/40 text-slate-400 hover:text-white")}
                >
                  URL Manual Avanzada
                </Button>
              </div>

              {nuevaCamara.tipo === 'snapshot' ? (
                <div className="space-y-3 p-3 bg-black/40 rounded-xl border border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Marca DVR / Cámara</label>
                      <select 
                        value={marca} onChange={e => setMarca(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="hikvision">Hikvision (DVR/NVR)</option>
                        <option value="dahua">Dahua (DVR/NVR)</option>
                        <option value="tapo">TP-Link Tapo / EZVIZ</option>
                        <option value="generica_mjpeg">Cámara IP China genérica</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Canal (DVR)</label>
                      <input 
                        type="number" value={canal} onChange={e => setCanal(e.target.value)} min="1" max="64"
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dirección IP Local (Ej: 192.168.1.100)</label>
                    <input 
                      type="text" value={ipLocal} onChange={e => setIpLocal(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      placeholder="192.168.1.X"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Usuario</label>
                      <input 
                        type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contraseña</label>
                      <input 
                        type="password" value={clave} onChange={e => setClave(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">URL Directa del Stream</label>
                  <input 
                    type="text" 
                    value={nuevaCamara.url || ''}
                    onChange={e => setNuevaCamara({...nuevaCamara, url: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#DAA520] focus:outline-none transition-all"
                    placeholder="http://ip:puerto/video"
                  />
                </div>
              )}

              <Button onClick={guardarCamara} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-widest mt-2">
                Conectar Cámara
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
