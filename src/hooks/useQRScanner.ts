import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeResult } from 'html5-qrcode';
import { toast } from 'sonner';

interface UseQRScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

/**
 * 🔍 Hook para lectura de códigos QR/Códigos de barras
 * Usa cámara del dispositivo para escanear automáticamente
 */
export function useQRScanner({ onScan, onError, enabled = true }: UseQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Inicializar scanner
  useEffect(() => {
    if (!enabled) return;

    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: 'environment', // Cámara trasera (por defecto)
          },
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText: string) => {
          // Código detectado
          console.log(`✅ Código leído: ${decodedText}`);
          onScan(decodedText);
          toast.success(`✓ Código: ${decodedText}`);
        },
        (error: Html5QrcodeResult) => {
          // Error (no mostrar, es normal mientras busca código)
          if (onError) onError(error.toString());
        }
      );

      setIsScanning(true);
      setCameraActive(true);

      return () => {
        if (scannerRef.current) {
          try {
            scanner.clear();
          } catch {
            // Ignorar error al limpiar
          }
        }
      };
    } catch (error) {
      console.error('Error inicializando scanner:', error);
      toast.error('Cámara no disponible');
      setIsScanning(false);
    }
  }, [enabled, onScan, onError]);

  // Pausar/Reanudar scanner
  const toggleCamera = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      if (cameraActive) {
        await scannerRef.current.pause();
        setCameraActive(false);
        toast.info('Cámara pausada');
      } else {
        await scannerRef.current.resume();
        setCameraActive(true);
        toast.info('Cámara reactivada');
      }
    } catch (error) {
      console.error('Error alternando cámara:', error);
      toast.error('Error al cambiar cámara');
    }
  }, [cameraActive]);

  return {
    isScanning,
    cameraActive,
    toggleCamera,
    containerRef,
  };
}
