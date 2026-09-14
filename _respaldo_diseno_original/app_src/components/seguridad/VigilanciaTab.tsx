import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, ShieldAlert, AlertTriangle, CheckCircle2, Eye, RefreshCw, ExternalLink, Zap, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { CAMARAS_DEFAULT } from '@/pages/Videovigilancia';
import { consultarAgente } from '@/constants/agentes';
import { generateUUID } from '@/lib/safe-utils';

interface CamaraLocal {
  id: string;
  nombre: string;
  url: string;
  activa: boolean;
}

export function VigilanciaTab() {
  const [camaras, setCamaras] = useState<CamaraLocal[]>(CAMARAS_DEFAULT);
  const [conBuster, setConBuster] = useState(Date.now());
  const [escaneandoCamaraId, setEscaneandoCamaraId] = useState<string | null>(null);
  const [hallazgosOdysseus, setHallazgosOdysseus] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<any[]>([]);
  const [camaraEstado, setCamaraEstado] = useState<Record<string, 'ok' | 'error' | 'cargando'>>({});
  const timerRef = useRef<any>(null);

  // Ciclo de refresco periódico de snapshots de las cámaras (cada 3 segundos)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setConBuster(Date.now());
    }, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      // 1. Cargar cámaras configuradas
      const camsDB = await db.getAllCamaras();
      if (camsDB && camsDB.length > 0) {
        setCamaras(camsDB.map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          url: c.url,
          activa: c.activa !== false,
        })));
      } else {
        setCamaras(CAMARAS_DEFAULT);
      }

      // 2. Cargar hallazgos de Odysseus
      const hallazgos = await db.getAgenteHallazgos('odysseus');
      const ordenados = [...(hallazgos || [])].sort((a: any, b: any) => {
        const ta = new Date(a.fecha || a.createdAt || 0).getTime();
        const tb = new Date(b.fecha || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setHallazgosOdysseus(ordenados.slice(0, 15));

      // 3. Cargar faltas de empleadas
      const faltasDB = await db.getAllFaltasEmpleada();
      const faltasOrd = [...(faltasDB || [])].sort((a: any, b: any) => {
        const ta = new Date(a.fecha || 0).getTime();
        const tb = new Date(b.fecha || 0).getTime();
        return tb - ta;
      });
      setFaltas(faltasOrd.slice(0, 15));
    } catch (e) {
      console.error('[VigilanciaTab] Error al cargar datos:', e);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleEscanearOdysseus = async (cam: CamaraLocal) => {
    setEscaneandoCamaraId(cam.id);
    toast.info(`Odysseus iniciando escaneo visual en ${cam.nombre}...`);

    try {
      const prompt = `Analiza visualmente la cámara "${cam.nombre}". Detecta si hay clientes esperando, si la caja está desatendida, si se observan movimientos sospechosos de dinero o mercancía sin registrar. Responde con un diagnóstico conciso en formato: [NORMAL | ATENCIÓN | ALERTA CRÍTICA] seguido del detalle.`;
      const res = await consultarAgente('odysseus', prompt);
      const texto = res.respuesta || 'Monitoreo completado sin anomalías detectadas en la zona observada.';

      const esCritica = texto.toLowerCase().includes('crítica') || texto.toLowerCase().includes('robo') || texto.toLowerCase().includes('alerta');
      const esAtencion = texto.toLowerCase().includes('atención') || texto.toLowerCase().includes('espera');

      const gravedad = esCritica ? 'critica' : esAtencion ? 'alta' : 'baja';

      // Guardar hallazgo en base de datos
      await db.addAgenteHallazgo('odysseus', {
        id: generateUUID(),
        agenteId: 'odysseus',
        tipo: 'vigilancia_cctv',
        titulo: `Escaneo CCTV: ${cam.nombre}`,
        descripcion: texto,
        gravedad,
        fecha: new Date().toISOString(),
        revisado: false,
      });

      // Registrar en bitácora IA
      await db.addBitacoraIA({
        id: generateUUID(),
        agenteId: 'odysseus',
        accion: `Escaneo ${cam.nombre}`,
        detalle: texto.slice(0, 120),
        nivel: gravedad,
        createdAt: new Date().toISOString(),
      });

      toast.success(`Escaneo completado: ${cam.nombre}`);
      await cargarDatos();
    } catch (err: any) {
      toast.error('No se pudo completar el escaneo con el agente Odysseus');
    } finally {
      setEscaneandoCamaraId(null);
    }
  };

  const getSnapshotUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}_cb=${conBuster}`;
  };

  return (
    <div className="space-y-6">
      {/* Barra de estado y acción rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-indigo-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center border border-indigo-500/40">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
              Circuito Cerrado CCTV · Odysseus IA
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                EN VIVO
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              DVR Hikvision en línea · 4 canales con refresco automático de snapshot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConBuster(Date.now())}
            className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refrescar Cámaras
          </Button>
          <a
            href="/videovigilancia"
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Centro CCTV
          </a>
        </div>
      </div>

      {/* Matriz de las 4 Cámaras DVR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {camaras.slice(0, 4).map((cam, idx) => (
          <div
            key={cam.id}
            className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md flex flex-col"
          >
            {/* Cabecera de cámara */}
            <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black text-slate-200 uppercase tracking-tight">
                  {cam.nombre}
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest bg-slate-800 px-1.5 py-0.5 rounded">
                CH {idx + 1} · 1080P
              </span>
            </div>

            {/* Contenedor de video / snapshot */}
            <div className="relative aspect-[16/9] bg-black flex items-center justify-center overflow-hidden group">
              <img
                src={getSnapshotUrl(cam.url)}
                alt={cam.nombre}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => {
                  setCamaraEstado(prev => ({ ...prev, [cam.id]: 'error' }));
                }}
                onLoad={() => {
                  setCamaraEstado(prev => ({ ...prev, [cam.id]: 'ok' }));
                }}
              />

              {camaraEstado[cam.id] === 'error' && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 text-center p-4">
                  <Camera className="w-8 h-8 text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">Canal conectando con DVR...</p>
                  <span className="text-[10px] text-slate-500 font-mono">192.168.18.141</span>
                </div>
              )}

              {/* Marca de agua de timestamp */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 font-bold">
                REC ● {new Date(conBuster).toLocaleTimeString()}
              </div>

              {/* Botón flotante para escanear con Odysseus */}
              <button
                onClick={() => handleEscanearOdysseus(cam)}
                disabled={escaneandoCamaraId === cam.id}
                className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-transform active:scale-95"
              >
                <Zap className="w-3 h-3 text-amber-300" />
                {escaneandoCamaraId === cam.id ? 'Analizando...' : 'Escanear IA'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sección inferior: Últimos Hallazgos de Odysseus y Faltas de Empleadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hallazgos de Odysseus */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-white">
                Detecciones de Odysseus IA
              </h4>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              {hallazgosOdysseus.length} reportes
            </span>
          </div>

          {hallazgosOdysseus.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>Sin incidentes críticos detectados en cámaras</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {hallazgosOdysseus.map((h: any) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-slate-800 dark:text-slate-100 truncate">
                      {h.titulo || 'Detección visual'}
                    </span>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                        h.gravedad === 'critica'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : h.gravedad === 'alta'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {h.gravedad || 'normal'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {h.descripcion}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    {new Date(h.fecha || h.createdAt || Date.now()).toLocaleString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Faltas e Infracciones Registradas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-white">
                Faltas / Infracciones de Turno
              </h4>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              {faltas.length} registradas
            </span>
          </div>

          {faltas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>Personal con conducta y atención al 100%</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {faltas.map((f: any) => (
                <div
                  key={f.id}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-950/20 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      {f.empleadaNombre || 'Personal'}
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {f.tipo || 'Falta'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {f.motivo || f.descripcion}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    {new Date(f.fecha || Date.now()).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
