import React, { useEffect, useState } from 'react';
import { WifiOff, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/database';
import { cn } from '@/lib/utils';

export function OfflineMonitor() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = async () => {
      setIsOffline(true);
      try {
        // Escribimos en la bitácora simulando que Odysseus (Agente de Seguridad) lo detectó
        await db.addBitacoraIA({
          agenteId: 'odysseus',
          accion: 'Desconexión de Red Detectada',
          detalle: '⚠️ Alerta de Red: Protocolo de Aislamiento Local activado. Protegiendo datos en IndexedDB. Todas las funciones IA pausadas.',
          nivel: 'critical',
        });
      } catch (e) {
        console.error('Error al escribir en bitácora:', e);
      }
    };

    const handleOnline = async () => {
      setIsOffline(false);
      try {
        await db.addBitacoraIA({
          agenteId: 'odysseus',
          accion: 'Conexión a Red Restaurada',
          detalle: '✅ Red detectada. Sistema volviendo a la normalidad. NexusSync iniciará en breve.',
          nivel: 'info',
        });
      } catch (e) {
        console.error('Error al escribir en bitácora:', e);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] bg-rose-600 border-b border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.5)]">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <WifiOff className="w-5 h-5 animate-pulse" />
        <span className="font-black text-sm uppercase tracking-widest text-white drop-shadow-md">
          Sistema Aislado
        </span>
        <span className="hidden sm:inline text-xs font-bold text-rose-100 uppercase tracking-widest px-2 border-l border-rose-400">
          Trabajando de forma local (Offline)
        </span>
        <ShieldAlert className="w-4 h-4 ml-2 text-yellow-300" />
      </div>
      
      {/* Fondo rayado de peligro */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)'
        }}
      />
    </div>
  );
}
