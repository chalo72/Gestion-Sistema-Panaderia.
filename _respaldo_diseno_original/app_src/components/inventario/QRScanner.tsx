import { useState, useCallback } from 'react';
import { Camera, X, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Producto } from '@/types';

interface QRScannerProps {
  productos: Producto[];
  onProductoDetectado: (producto: Producto) => void;
  onClose: () => void;
}

/**
 * 📱 Componente de Lectura de Códigos QR/Códigos de Barras
 * Escanea instantáneamente y detecta productos
 */
export function QRScanner({ productos, onProductoDetectado, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState('');

  // Importar dinámicamente para evitar errores en SSR
  const [scanner, setScanner] = useState<any>(null);

  // Inicializar scanner cuando se monte
  useState(() => {
    if (typeof window !== 'undefined' && !scanner) {
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const qrScanner = new Html5QrcodeScanner(
          'qr-reader-container',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            videoConstraints: {
              facingMode: 'environment',
            },
          },
          false
        );

        qrScanner.render(
          (decodedText: string) => {
            handleScan(decodedText);
          },
          () => {
            // Error ignorado (es normal mientras busca código)
          }
        );

        setScanner(qrScanner);
      });
    }
  });

  // Manejar cuando se detecta un código
  const handleScan = useCallback((code: string) => {
    if (lastScannedCode === code) return; // Evitar duplicados
    setLastScannedCode(code);

    // Buscar producto por código
    const producto = productos.find(p =>
      p.id === code || // Por ID
      (p as any).codigo === code || // Por código personalizado
      (p as any).barcode === code // Por código de barras
    );

    if (producto) {
      toast.success(`✓ ${producto.nombre}`);
      onProductoDetectado(producto);
      
      // Auto-cerrar después de 1 segundo
      setTimeout(() => {
        setLastScannedCode('');
      }, 500);
    } else {
      toast.error(`Producto no encontrado: ${code}`);
    }
  }, [productos, onProductoDetectado, lastScannedCode]);

  const handleClose = useCallback(async () => {
    if (scanner) {
      try {
        await scanner.clear();
      } catch {
        // Ignorar error
      }
    }
    onClose();
  }, [scanner, onClose]);

  const handleToggleCamera = useCallback(async () => {
    if (!scanner) return;
    try {
      if (isScanning) {
        await scanner.pause();
        setIsScanning(false);
      } else {
        await scanner.resume();
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Error alternando cámara:', error);
    }
  }, [scanner, isScanning]);

  return (
    <Card className="fixed inset-0 z-50 rounded-none m-0 border-0 flex flex-col">
      <CardHeader className="bg-slate-900 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Escanear Producto
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-slate-800"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-sm text-slate-300 mt-2">Apunta la cámara al código QR o código de barras</p>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        {/* Área del Scanner */}
        <div
          id="qr-reader-container"
          className="flex-1 bg-black"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {/* Controles */}
        <div className="bg-slate-100 p-4 space-y-3 border-t">
          {lastScannedCode && (
            <div className="bg-green-100 border border-green-500 rounded-lg p-3">
              <p className="text-sm font-semibold text-green-900">
                ✓ Código leído: {lastScannedCode}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={isScanning ? 'default' : 'outline'}
              onClick={handleToggleCamera}
              className="flex-1 gap-2"
            >
              {isScanning ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Reanudar
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              className="flex-1 gap-2"
            >
              <X className="w-4 h-4" />
              Cerrar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Escanea un código para agregar al inventario
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
