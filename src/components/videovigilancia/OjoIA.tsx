import React, { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Camera, ShieldAlert, X, Activity, Scan, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function OjoIA({ onClose }: { onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [events, setEvents] = useState<{ id: string; time: Date; text: string }[]>([]);
    
    // Model ref to hold it across renders without triggering re-renders
    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        let stream: MediaStream | null = null;

        const setupCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                toast.error("No se pudo acceder a la cámara. Revisa los permisos.");
                console.error("Error accessing camera:", err);
            }
        };

        const loadModel = async () => {
            try {
                modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
                setIsModelLoaded(true);
            } catch (err) {
                console.error("Error loading TF model:", err);
                toast.error("Error cargando el modelo de Inteligencia Artificial.");
            }
        };

        setupCamera();
        loadModel();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, []);

    useEffect(() => {
        if (isModelLoaded && videoRef.current) {
            videoRef.current.onloadeddata = () => {
                detectFrame();
            };
        }
    }, [isModelLoaded]);

    const addEvent = (text: string) => {
        setEvents(prev => {
            // Prevent spamming the same event within 5 seconds
            const last = prev[0];
            if (last && last.text === text && (new Date().getTime() - last.time.getTime() < 5000)) {
                return prev;
            }
            const newEvents = [{ id: Math.random().toString(36), time: new Date(), text }, ...prev];
            return newEvents.slice(0, 50); // Keep last 50
        });
    };

    const detectFrame = async () => {
        if (!modelRef.current || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState !== 4) {
            requestRef.current = requestAnimationFrame(detectFrame);
            return;
        }

        // Match canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        try {
            const predictions = await modelRef.current.detect(video);
            
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let personDetected = false;
                let bagDetected = false;

                predictions.forEach(prediction => {
                    const [x, y, width, height] = prediction.bbox;
                    const text = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;

                    // Detect rules
                    if (prediction.class === 'person') personDetected = true;
                    if (['backpack', 'handbag', 'suitcase'].includes(prediction.class)) bagDetected = true;

                    // Draw bounding box
                    ctx.strokeStyle = prediction.class === 'person' ? '#f59e0b' : '#10b981';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(x, y, width, height);

                    // Draw label background
                    ctx.fillStyle = prediction.class === 'person' ? '#f59e0b' : '#10b981';
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillRect(x, y - 25, textWidth + 10, 25);

                    // Draw label text
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '16px sans-serif';
                    ctx.fillText(text, x + 5, y - 7);
                });

                if (personDetected) addEvent("👁️ Persona detectada en el área");
                if (bagDetected) addEvent("🎒 Mochila/Bolso detectado en el área");
            }
        } catch (e) {
            // Ignore minor frame errors
        }

        requestRef.current = requestAnimationFrame(detectFrame);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-950 w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
                
                {/* Visual Area */}
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {!isModelLoaded && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80">
                            <Activity className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                            <p className="text-white font-bold animate-pulse">Cargando Redes Neuronales Vision AI...</p>
                        </div>
                    )}
                    
                    {/* The Video and Canvas overlay */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        <video 
                            ref={videoRef}
                            autoPlay 
                            playsInline 
                            muted
                            className="absolute max-w-full max-h-full object-contain"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute max-w-full max-h-full object-contain z-10 pointer-events-none"
                        />
                    </div>
                    
                    {/* HUD Overlays */}
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                        <Badge variant="outline" className="bg-black/50 text-emerald-400 border-emerald-400/30 backdrop-blur-md">
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            CÁMARA ACTIVA
                        </Badge>
                        <Badge variant="outline" className="bg-black/50 text-indigo-400 border-indigo-400/30 backdrop-blur-md">
                            YOLO-LITE MODEL
                        </Badge>
                    </div>

                    <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Log Area */}
                <div className="w-full md:w-80 bg-slate-900 border-l border-white/5 flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-slate-950">
                        <h3 className="text-sm font-black text-white flex items-center gap-2">
                            <Scan className="w-4 h-4 text-indigo-400" />
                            Auditoría en Tiempo Real
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                            El cerebro visual está escaneando el perímetro a 30 FPS.
                        </p>
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto space-y-3">
                        {events.length === 0 ? (
                            <div className="text-center text-slate-600 mt-10">
                                <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs">Esperando eventos...</p>
                            </div>
                        ) : (
                            events.map(ev => (
                                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5 animate-in fade-in slide-in-from-right-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-200">{ev.text}</p>
                                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                            {ev.time.toLocaleTimeString('es-CO', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
