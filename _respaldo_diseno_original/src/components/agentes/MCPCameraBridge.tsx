import { Camera, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface MCPCameraBridgeProps {
  onCapture?: (blob: Blob) => void;
}

export const MCPCameraBridge: React.FC<MCPCameraBridgeProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<string | null>(null);

  useEffect(() => {
    iniciarCamara();
    return () => stream?.getTracks().forEach(track => track.stop());
  }, []);

  const iniciarCamara = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setError(null);
    } catch (err) {
      console.error("Error acceso cámara:", err);
      setError("No se pudo acceder a la cámara. Verifique permisos.");
    }
  };

  const capturar = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            setLastCapture(URL.createObjectURL(blob));
            onCapture?.(blob);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black/20 border border-white/10 backdrop-blur-sm group">
      {error ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-red-500/10 gap-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
          <p className="text-red-200 text-sm">{error}</p>
          <button 
            onClick={iniciarCamara}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-xs"
          >
            Reintentar Acceso
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full aspect-video object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Overlay de Control */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
            <div className="flex justify-between items-start">
              <span className="flex items-center gap-2 bg-blue-500/80 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-widest backdrop-blur-md">
                <ShieldCheck className="w-3 h-3" /> Transmisión Segura CLAW
              </span>
              <button 
                onClick={iniciarCamara}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="flex justify-center gap-4">
              <button 
                onClick={capturar}
                className="w-14 h-14 bg-white/20 hover:bg-white/40 border-2 border-white/40 rounded-full flex items-center justify-center backdrop-blur-xl transform active:scale-90 transition-transform shadow-2xl"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Camera className="w-5 h-5 text-black" />
                </div>
              </button>
            </div>
          </div>

          {/* Última Captura en Miniatura */}
          {lastCapture && (
            <div className="absolute bottom-4 right-4 w-16 h-16 rounded-lg border-2 border-white/20 overflow-hidden shadow-2xl">
              <img src={lastCapture} className="w-full h-full object-cover" alt="Última captura" />
            </div>
          )}
        </>
      )}
    </div>
  );
};
