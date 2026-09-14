import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;
const loadModel = () => {
  if (!modelPromise) {
    modelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
  }
  return modelPromise;
};

interface WebRTCVideoProps {
  src: string;
  fallbackUrl: string;
  className?: string;
  odysseusActivo?: boolean;
}

export const WebRTCVideo = forwardRef(
  function WebRTCVideoComponent({ src, fallbackUrl, className, odysseusActivo }: WebRTCVideoProps, forwardedRef: React.Ref<HTMLVideoElement>) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(forwardedRef, () => localVideoRef.current as HTMLVideoElement);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const requestRef = useRef<number>();
    const [modelLoaded, setModelLoaded] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const startedRef = useRef(false);

    useEffect(() => {
      loadModel().then(() => setModelLoaded(true));
    }, []);

    // WebRTC Connection Logic
    useEffect(() => {
      if (!localVideoRef.current || !src || startedRef.current || useFallback) return;

      let mounted = true;
      startedRef.current = true;
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (localVideoRef.current && event.streams[0]) {
          localVideoRef.current.srcObject = event.streams[0];
        }
      };

      const start = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const response = await fetch(`http://127.0.0.1:1984/api/webrtc?src=${encodeURIComponent(src)}`, {
            method: 'POST',
            body: offer.sdp,
            headers: { 'Content-Type': 'application/sdp' }
          });
          if (!response.ok) throw new Error('WebRTC failed');
          const answer = await response.text();
          if (mounted) {
            await pc.setRemoteDescription({ type: 'answer', sdp: answer });
          }
        } catch (err) {
          console.error('WebRTC error:', err);
          if (mounted) setUseFallback(true);
        }
      };

      const timer = setTimeout(() => {
        if (mounted) start();
      }, 500);

      // Fallback timer if video doesn't play after 5 seconds
      const fallbackTimer = setTimeout(() => {
        if (mounted && localVideoRef.current && (localVideoRef.current.readyState < 2 || localVideoRef.current.videoWidth === 0)) {
          console.warn('WebRTC video timeout, switching to fallback');
          setUseFallback(true);
        }
      }, 5000);

      return () => {
        mounted = false;
        startedRef.current = false;
        clearTimeout(timer);
        clearTimeout(fallbackTimer);
        pc.close();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      };
    }, [src, useFallback]);

    // TF.js Detection Logic
    useEffect(() => {
      if (!odysseusActivo || !modelLoaded) return;
      let mounted = true;

      const detectFrame = async () => {
        if (!mounted) return;
        
        // Determinar qué elemento analizar (video o img)
        const sourceElement = useFallback 
          ? document.getElementById(`fallback-img-${src}`) as HTMLImageElement
          : localVideoRef.current;
          
        const canvas = canvasRef.current;
        
        if (sourceElement && canvas) {
          const isReady = useFallback 
            ? ((sourceElement as HTMLImageElement).complete && (sourceElement as HTMLImageElement).naturalWidth > 0)
            : ((sourceElement as HTMLVideoElement).readyState >= 2 && (sourceElement as HTMLVideoElement).videoWidth > 0);
            
          if (isReady) {
            const model = await loadModel();
            const predictions = await model.detect(sourceElement);
            
            if (!mounted) return;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const width = useFallback ? (sourceElement as HTMLImageElement).naturalWidth : (sourceElement as HTMLVideoElement).videoWidth;
              const height = useFallback ? (sourceElement as HTMLImageElement).naturalHeight : (sourceElement as HTMLVideoElement).videoHeight;
              canvas.width = width;
              canvas.height = height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              predictions.forEach((prediction) => {
                if (prediction.class === 'person' && prediction.score > 0.5) {
                  const [x, y, w, h] = prediction.bbox;
                  ctx.strokeStyle = '#10b981';
                  ctx.lineWidth = 4;
                  ctx.strokeRect(x, y, w, h);
                  ctx.fillStyle = '#10b981';
                  ctx.font = '18px Arial';
                  ctx.fillText(`${Math.round(prediction.score * 100)}%`, x, y > 20 ? y - 5 : y + 20);
                }
              });
            }
          }
        }
        
        if (mounted) {
          requestRef.current = requestAnimationFrame(detectFrame);
        }
      };

      detectFrame();

      return () => {
        mounted = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
    }, [odysseusActivo, modelLoaded, useFallback, src]);

    return (
      <div className="relative w-full h-full">
        {useFallback ? (
          <img
            id={`fallback-img-${src}`}
            src={fallbackUrl}
            crossOrigin="anonymous"
            className={className}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={className}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }
);
WebRTCVideo.displayName = 'WebRTCVideo';
