import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface VoiceOrchestratorProps {
    onNavigate: (view: string) => void;
    nombreUsuario?: string;
}

export function VoiceOrchestrator({ onNavigate, nombreUsuario }: VoiceOrchestratorProps) {
    const [estado, setEstado] = useState<'reposo' | 'escuchando' | 'pensando' | 'hablando'>('reposo');
    const [volumen, setVolumen] = useState(0); 
    
    const estadoRef = useRef(estado);
    useEffect(() => { estadoRef.current = estado; }, [estado]);

    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    
    const isSpeakingRef = useRef(false);
    const silenceTimerRef = useRef<any>(null);

    const synthRef = useRef<SpeechSynthesis | null>(null);
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                const esVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Natural')));
                if (esVoice) voiceRef.current = esVoice;
                else voiceRef.current = voices.find(v => v.lang.startsWith('es')) || voices[0];
            };
            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
        return () => { detenerTodo(); };
    }, []);

    const detenerTodo = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
        }
        synthRef.current?.cancel();
        setEstado('reposo');
        setVolumen(0);
        isSpeakingRef.current = false;
    };

    const speak = (text: string) => {
        setEstado('hablando');
        if (!synthRef.current) {
            iniciarEscucha();
            return;
        }
        synthRef.current.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-CO';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        if (voiceRef.current) utterance.voice = voiceRef.current;
        
        utterance.onend = () => {
            if (estadoRef.current === 'hablando') iniciarEscucha();
        };
        
        utterance.onerror = () => {
            if (estadoRef.current === 'hablando') iniciarEscucha();
        };

        const estimatedDurationMs = (text.length / 15) * 1000 + 2000;
        setTimeout(() => {
            if (estadoRef.current === 'hablando') iniciarEscucha();
        }, estimatedDurationMs);

        synthRef.current.speak(utterance);
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const processAudioBlob = async (audioBlob: Blob) => {
        setEstado('pensando');
        setVolumen(0);
        try {
            const base64Audio = await blobToBase64(audioBlob);
            const mimeType = audioBlob.type || 'audio/webm';
            
            const { data, error } = await supabase.functions.invoke('chat-fluido', {
                body: { audioBase64: base64Audio, mimeType, contexto: window.location.hash || 'App' }
            });
            
            if (error) throw error;

            if (data && data.reply) {
                const lower = data.reply.toLowerCase();
                if (lower.includes('[abrir caja]')) {
                    onNavigate('caja');
                    speak(data.reply.replace('[abrir caja]', ''));
                } else if (lower.includes('[abrir ventas]')) {
                    onNavigate('ventas');
                    speak(data.reply.replace('[abrir ventas]', ''));
                } else {
                    speak(data.reply);
                }
            } else {
                speak("Grabé el audio, pero la IA no supo qué decir.");
            }
        } catch (e) {
            console.error(e);
            speak("Disculpe jefe, perdí conexión con el cerebro en la nube.");
        }
    };

    const monitorearSilencio = () => {
        if (estadoRef.current !== 'escuchando' || !analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        
        setVolumen(avg); 

        const UMBRAL_VOZ = 12; 
        const TIEMPO_SILENCIO_MS = 1500; 

        if (avg > UMBRAL_VOZ) {
            if (!isSpeakingRef.current) isSpeakingRef.current = true;
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else {
            if (isSpeakingRef.current) {
                if (!silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        isSpeakingRef.current = false;
                        silenceTimerRef.current = null;
                        
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            setEstado('pensando');
                            mediaRecorderRef.current.stop();
                        }
                    }, TIEMPO_SILENCIO_MS);
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(monitorearSilencio);
    };

    const iniciarEscucha = async () => {
        setEstado('escuchando');
        isSpeakingRef.current = false;
        audioChunksRef.current = [];

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            }

            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if(AudioContextClass) {
                   audioContextRef.current = new AudioContextClass();
                   analyserRef.current = audioContextRef.current.createAnalyser();
                   analyserRef.current.fftSize = 256;
                   const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
                   source.connect(analyserRef.current);
                }
            }
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
            const mediaRecorder = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                if (estadoRef.current === 'pensando') {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
                    processAudioBlob(audioBlob);
                }
            };

            mediaRecorder.start();
            monitorearSilencio();

        } catch (e) {
            console.error("Error micrófono:", e);
            toast.error("Por favor, permite el acceso al micrófono.");
            setEstado('reposo');
        }
    };

    const toggleConversacion = async () => {
        if (synthRef.current && estado === 'reposo') {
            const silent = new SpeechSynthesisUtterance("");
            silent.volume = 0;
            synthRef.current.speak(silent);
        }

        if (estado === 'reposo') {
            await iniciarEscucha();
        } else {
            detenerTodo();
        }
    };

    const waveScale = 1 + (volumen / 100);

    return (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-center justify-center">
            {estado === 'escuchando' && (
                <>
                    <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-30" style={{ transform: `scale(${waveScale})`, transition: 'transform 0.1s ease-out' }}></div>
                    <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20 duration-1000"></div>
                </>
            )}
            {estado === 'hablando' && (
                <>
                    <div className="absolute inset-[-10px] rounded-full animate-pulse bg-purple-500 opacity-60"></div>
                    <div className="absolute inset-[-20px] rounded-full animate-ping bg-purple-400 opacity-40" style={{ animationDuration: '2s' }}></div>
                </>
            )}
            {estado === 'pensando' && (
                <div className="absolute inset-[-5px] rounded-full animate-spin bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-80" style={{ filter: 'blur(8px)' }}></div>
            )}

            <button
                onClick={toggleConversacion}
                className={cn(
                    "relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
                    estado === 'reposo' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/40 hover:scale-105" : "",
                    estado === 'escuchando' ? "bg-emerald-500 shadow-emerald-500/50" : "",
                    estado === 'pensando' ? "bg-indigo-800 scale-100" : "",
                    estado === 'hablando' ? "bg-purple-600 shadow-purple-600/60 scale-110" : ""
                )}
            >
                {estado === 'reposo' && <Mic className="w-7 h-7 text-white transition-transform group-hover:scale-110" />}
                {estado === 'escuchando' && <Mic className="w-7 h-7 text-white animate-pulse" />}
                {estado === 'pensando' && <Loader2 className="w-7 h-7 text-white animate-spin" />}
                {estado === 'hablando' && <Bot className="w-7 h-7 text-white animate-pulse" />}
            </button>
        </div>
    );
}

