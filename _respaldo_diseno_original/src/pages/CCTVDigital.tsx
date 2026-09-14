import { useState, useEffect, useRef } from 'react';
import { getAuditoriaSessions, getSessionEvents } from '@/lib/auditoria-rrweb';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Video, Play, AlertTriangle, Search, Activity, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function CCTVDigital() {
    const [sesiones, setSesiones] = useState<any[]>([]);
    const [sesionActiva, setSesionActiva] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const playerRef = useRef<HTMLDivElement>(null);
    const rrwebPlayerInstance = useRef<any>(null);

    useEffect(() => {
        cargarSesiones();
    }, []);

    const cargarSesiones = async () => {
        const data = await getAuditoriaSessions();
        setSesiones(data);
    };

    const reproducirSesion = async (id: string) => {
        setCargando(true);
        setSesionActiva(id);
        const eventos = await getSessionEvents(id);
        setCargando(false);

        if (eventos && eventos.length > 2 && playerRef.current) {
            if (rrwebPlayerInstance.current) {
                // Remove previous instance if it exists by clearing innerHTML
                playerRef.current.innerHTML = '';
            }

            try {
                // We need to wait a tick for React to render the div if it wasn't there
                setTimeout(() => {
                    if (!playerRef.current) return;
                    rrwebPlayerInstance.current = new rrwebPlayer({
                        target: playerRef.current,
                        props: {
                            events: eventos,
                            width: playerRef.current.clientWidth || 800,
                            height: playerRef.current.clientHeight || 500,
                            autoPlay: true,
                        },
                    });
                }, 100);
            } catch (e) {
                console.error('Error reproduciendo sesión:', e);
            }
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                        <Video className="w-8 h-8 text-rose-500" />
                        CCTV Digital (Auditoría Fantasma)
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Visualiza exactamente cada clic, desplazamiento y texto escrito por el personal en la aplicación. 
                        Este registro es inalterable y sirve como prueba irrefutable ante anomalías.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                        Grabando en 2º Plano
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Lista de Sesiones */}
                <Card className="lg:col-span-1 border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5 py-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            Sesiones Recientes
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={cargarSesiones} className="h-6 w-6">
                            <RefreshCw className="w-3 h-3 text-slate-500" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto flex-1">
                        {sesiones.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                                <Activity className="w-8 h-8 mb-3 opacity-20" />
                                <p className="text-sm font-medium">No hay grabaciones aún.</p>
                                <p className="text-xs mt-1 opacity-70">Las sesiones se guardan automáticamente cada 30 segundos.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {sesiones.map((s) => (
                                    <button 
                                        key={s.id}
                                        onClick={() => reproducirSesion(s.id)}
                                        className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group ${sesionActiva === s.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500' : ''}`}
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {s.date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {s.date.toLocaleDateString('es-CO')}
                                            </p>
                                        </div>
                                        <Play className={`w-4 h-4 ${sesionActiva === s.id ? 'text-indigo-500' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Reproductor */}
                <Card className="lg:col-span-3 border-slate-200 dark:border-white/10 shadow-sm bg-slate-100 dark:bg-slate-950 flex flex-col h-[600px] overflow-hidden">
                    {sesionActiva ? (
                        cargando ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                                <p className="text-sm font-medium">Cargando Cinta de Seguridad...</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-4 bg-black/5 h-full w-full overflow-hidden relative">
                                {/* RRWEB Player Container */}
                                <div ref={playerRef} className="w-full h-full rounded-lg shadow-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-center" />
                            </div>
                        )
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">CCTV Digital Listo</h3>
                            <p className="text-sm mt-2 max-w-md">
                                Selecciona un registro en el panel izquierdo para reproducir la sesión exacta. Verás el ratón, los clics y todo lo que el usuario vio en su pantalla.
                            </p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
