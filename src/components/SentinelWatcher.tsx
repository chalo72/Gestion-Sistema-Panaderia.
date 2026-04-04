import React, { useEffect, useRef } from 'react';
import { db } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Protocolo Sentinel (v1.0.227 - LIVE)
 * Componente centinela que vigila la integridad de los datos en tiempo real.
 * Si detecta un "vaciado" accidental o regresiones, restaura el catálogo.
 */
export const SentinelWatcher: React.FC = () => {
  const { usuario, isAuthenticated } = useAuth();
  const lastCatalogSize = useRef<number>(-1); // -1 = no inicializado aún
  const isRecovering = useRef<boolean>(false);
  const mountTime = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated || !usuario) return;

    const auditIntegrity = async () => {
      if (isRecovering.current) return;

      // PROTECCIÓN: No auditar durante los primeros 15 segundos tras montar
      // Permite que la app cargue completamente sus datos desde IndexedDB
      const tiempoDesdeMount = Date.now() - mountTime.current;
      if (tiempoDesdeMount < 15_000) return;

      try {
        const productos = await db.getAllProductos();
        const proveedores = await db.getAllProveedores();
        const currentSize = productos.length + proveedores.length;

        // Inicializar tamaño conocido en primera auditoría válida
        if (lastCatalogSize.current === -1) {
          lastCatalogSize.current = currentSize;
          // Guardar snapshot inicial sin intentar recuperación
          if (currentSize > 0) {
            await db.saveBackup('productos_snapshot', productos);
            await db.saveBackup('proveedores_snapshot', proveedores);
          }
          return;
        }

        // 1. SI DETECTA VACÍO REPENTINO (PÉRDIDA DE DATOS) — Solo si antes tenía datos
        if (currentSize === 0 && lastCatalogSize.current > 0) {
          console.error('🚨 [Sentinel] ¡ALERTA DE INTEGRIDAD! Catálogo vacío detectado inesperadamente.');
          isRecovering.current = true;
          toast.loading('Sentinel: Detectada pérdida de datos. Restaurando...', { id: 'sentinel-recovery' });

          // Intentar recuperación desde el ESPEJO (Backups v16)
          const backupProds = await db.getBackup('productos_snapshot');
          const backupProvs = await db.getBackup('proveedores_snapshot');

          if (backupProds && backupProds.length > 0) {
            console.log('🛡️ [Sentinel] Restaurando desde Espejo Local...');
            for (const p of backupProds) await db.addProducto(p).catch(() => {});
            for (const p of backupProvs) await db.addProveedor(p).catch(() => {});
            toast.success('Sentinel: Datos restaurados desde el espejo local.', { id: 'sentinel-recovery' });
          } else {
            console.log('☁️ [Sentinel] Espejo vacío. Forzando descarga completa desde la nube...');
            if (db.syncCloudToLocal) {
              await db.syncCloudToLocal();
              toast.success('Sentinel: Catálogo recuperado desde la nube.', { id: 'sentinel-recovery' });
            }
          }
          isRecovering.current = false;
        } 
        
        // 2. ACTUALIZAR ESPEJO (Si el catálogo es saludable)
        if (currentSize > 0) {
          lastCatalogSize.current = currentSize;
          // Guardamos snapshot cada vez que detectamos un catálogo sano (throttled by the interval)
          await db.saveBackup('productos_snapshot', productos);
          await db.saveBackup('proveedores_snapshot', proveedores);
        }

      } catch (e) {
        console.warn('⚠️ [Sentinel] Error en auditoría:', e);
      }
    };

    // Auditoría de "Latido" cada 30 segundos (Acelerado para sincronización en vivo)
    const interval = setInterval(auditIntegrity, 30000);
    
    // Auditoría inicial rápida
    setTimeout(auditIntegrity, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, usuario]);

  return null; // El centinela es invisible
};
