import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFaceDescriptor } from '@/lib/face-recognition';
import { toast } from 'sonner';

interface CapturaRostroProps {
  onCapture: (descriptor: number[], fotoBase64: string) => void;
  onCancel: () => void;
}

export default function CapturaRostro({ onCapture, onCancel }: CapturaRostroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error('No se pudo acceder a la cámara');
        onCancel();
      }
    }
    
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [onCancel]);

  const tomarFoto = async () => {
    if (!videoRef.current) return;
    
    setAnalyzing(true);
    
    try {
      // 1. Dibujar el frame en un canvas
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      
      // 2. Extraer descriptor
      const descriptor = await getFaceDescriptor(video);
      
      if (!descriptor) {
        toast.error('No se detectó ningún rostro claramente. Intenta de nuevo.');
        setAnalyzing(false);
        return;
      }
      
      toast.success('Rostro calibrado correctamente');
      onCapture(descriptor, base64);
      
    } catch (err) {
      console.error(err);
      toast.error('Error al analizar el rostro');
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-500" />
            Calibración Biométrica
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video mb-4 flex items-center justify-center">
            {loading && <Loader2 className="w-8 h-8 text-indigo-400 animate-spin absolute" />}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'}`}
            />
            
            {/* Guía visual */}
            <div className="absolute inset-0 border-4 border-white/20 rounded-xl pointer-events-none"></div>
            <div className="absolute inset-x-12 inset-y-8 border-2 border-dashed border-indigo-400/50 rounded-full pointer-events-none"></div>
          </div>
          
          <p className="text-sm text-slate-500 font-medium text-center mb-6">
            Ubica tu rostro dentro del óvalo y asegúrate de tener buena iluminación.
          </p>
          
          <Button 
            onClick={tomarFoto} 
            disabled={loading || analyzing}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg"
          >
            {analyzing ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analizando Rostro...</>
            ) : (
              <><Check className="w-5 h-5 mr-2" /> Guardar Rostro</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
