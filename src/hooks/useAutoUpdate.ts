import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const SERVIDOR_URL = import.meta.env.VITE_UPDATE_SERVER_URL || 'http://192.168.1.102:5173';
const CHECK_INTERVAL = 30000; // Verificar cada 30 segundos

interface VersionInfo {
  version: string;
  timestamp: number;
  changes?: string[];
}

export function useAutoUpdate() {
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const performUpdateRef = useRef<((version: VersionInfo) => Promise<void>) | null>(null);

  // Obtener versión actual guardada localmente
  useEffect(() => {
    const saved = localStorage.getItem('app_version');
    if (saved) {
      setCurrentVersion(JSON.parse(saved));
    } else {
      // Primera vez: guardar versión inicial
      const initialVersion: VersionInfo = {
        version: '1.0.0',
        timestamp: Date.now(),
      };
      localStorage.setItem('app_version', JSON.stringify(initialVersion));
      setCurrentVersion(initialVersion);
    }
  }, []);

  // Descargar e instalar actualización
  const performUpdate = useCallback(async (newVersion: VersionInfo) => {
    setIsUpdating(true);
    try {
      toast.loading('Descargando actualización...');

      // Descargar archivos actualizados del servidor
      const response = await fetch(`${SERVIDOR_URL}/api/files`, {
        method: 'GET'
      });

      if (!response.ok) throw new Error('Error descargando actualizaciones');

      const files = await response.json();

      // Guardar en localStorage (para PWA offline)
      localStorage.setItem('app_files_cache', JSON.stringify(files));
      localStorage.setItem('app_version', JSON.stringify(newVersion));

      toast.success('✅ Actualización descargada');
      console.log('✅ Actualización instalada:', newVersion.version);

      // Recargar la app después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (_error) {
      console.error('Error en actualización:', _error);
      toast.error('Error descargando actualización');
      setIsUpdating(false);
    }
  }, []);

  performUpdateRef.current = performUpdate;

  // Verificar si hay actualizaciones disponibles
  const checkForUpdates = useCallback(async () => {
    try {
      const response = await fetch(`${SERVIDOR_URL}/api/version`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) return; // Servidor no disponible

      const serverVersion: VersionInfo = await response.json();

      // Comparar versiones
      if (currentVersion && serverVersion.timestamp > currentVersion.timestamp) {
        console.log('📦 Nueva versión disponible:', serverVersion.version);
        setUpdateAvailable(true);
        
        // Mostrar notificación
        toast('Actualización disponible', {
          description: 'Haz click para actualizar',
          action: {
            label: 'Actualizar',
            onClick: () => performUpdateRef.current?.(serverVersion)
          },
          duration: 10000
        });
      }
    } catch {
      console.log('No se pudo verificar actualizaciones (servidor offline)');
    }
  }, [currentVersion]);

  // Verificar periodicamente
  useEffect(() => {
    // Primera verificación inmediata
    checkForUpdates();

    // Luego cada 30 segundos
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return {
    currentVersion,
    updateAvailable,
    isUpdating,
    checkForUpdates,
    performUpdate
  };
}
