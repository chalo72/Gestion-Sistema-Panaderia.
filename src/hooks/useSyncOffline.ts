import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

const SERVIDOR_URL = 'http://192.168.1.100:5173'; // Cambia esto por tu IP real

// PROTEGIDO: No modificar sin revisión. Función crítica de sincronización offline/online validada en producción.
export function useSyncOffline() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isServerAvailable, setIsServerAvailable] = useState(false);

  // Detectar si el servidor está disponible
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${SERVIDOR_URL}/ping`, {
          method: 'HEAD',
          mode: 'no-cors'
        });
        setIsServerAvailable(true);
        console.log('✅ Servidor disponible');
      } catch (error) {
        setIsServerAvailable(false);
        console.log('❌ Servidor no disponible - Modo offline');
      }
    };

    // Verificar cada 10 segundos
    const interval = setInterval(checkServer, 10000);
    checkServer(); // Primera verificación

    return () => clearInterval(interval);
  }, []);

  // Sincronizar datos
  const syncData = useCallback(async () => {
    if (!isServerAvailable) {
      toast.error('Servidor no disponible. Se guardará localmente.');
      return;
    }

    setSyncStatus('syncing');
    try {
      // Obtener datos locales
      const datosLocales = {
        ventas: JSON.parse(localStorage.getItem('ventas') || '[]'),
        productos: JSON.parse(localStorage.getItem('productos') || '[]'),
        precios: JSON.parse(localStorage.getItem('precios') || '[]'),
      };

      // Enviar al servidor
      const response = await fetch(`${SERVIDOR_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosLocales)
      });

      if (response.ok) {
        const datosServidor = await response.json();
        
        // Actualizar localStorage con datos del servidor
        localStorage.setItem('ventas', JSON.stringify(datosServidor.ventas || []));
        localStorage.setItem('productos', JSON.stringify(datosServidor.productos || []));
        localStorage.setItem('precios', JSON.stringify(datosServidor.precios || []));

        setSyncStatus('success');
        toast.success('✅ Datos sincronizados correctamente');
        
        // Recargar para ver cambios
        window.location.reload();
      } else {
        setSyncStatus('error');
        toast.error('Error en sincronización');
      }
    } catch (error) {
      setSyncStatus('error');
      console.error('Error sincronizando:', error);
      toast.error('Error al sincronizar con servidor');
    }
  }, [isServerAvailable]);

  // Auto-sincronizar cuando detecta servidor
  useEffect(() => {
    if (isServerAvailable && syncStatus === 'idle') {
      const timer = setTimeout(() => {
        syncData();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isServerAvailable, syncStatus, syncData]);

  return {
    syncStatus,
    isServerAvailable,
    syncData,
    syncNow: syncData
  };
}
