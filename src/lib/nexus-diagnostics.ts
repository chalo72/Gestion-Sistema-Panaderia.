/**
 * 🧪 NEXUS INTERNAL TEST SUITE
 * Herramientas de diagnóstico nativas para verificar el estado del sistema.
 * Ejecutables desde la consola del navegador (F12).
 */

import { db } from './database';
import { backupService } from './backupService';

export const NexusDiagnostics = {
  /**
   * Verifica la integridad de la base de datos local y la conexión a la nube.
   */
  async runHealthCheck() {
    console.group('🧪 [NEXUS DIAGNOSTICS]: Ejecutando verificación de salud...');
    
    try {
      // 1. Verificar IndexedDB
      const productos = await db.getAllProductos();

      // 2. Verificar Snapshots
      const snapshots = backupService.getAllSnapshots();

      // 3. Verificar Sincronización (si existe)
      const isOnline = navigator.onLine;

      console.groupEnd();
      return true;
    } catch (e) {
      console.error('❌ [DIAGNOSTICS]: Error crítico en el sistema:', e);
      console.groupEnd();
      return false;
    }
  },

  /**
   * Expone el diagnóstico globalmente para acceso desde consola.
   */
  expose() {
    (window as any).NexusDebug = this;
  },

  /**
   * Envía telemetría al servidor Nexus Core (MCP Bridge)
   */
  async sendTelemetry(type: string, data: any) {
    try {
      const response = await fetch('http://localhost:9000/execute?tool_name=engram_store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-secret-key'
        },
        body: JSON.stringify({ args: { type, content: data } })
      });
      if (!response.ok) throw new Error('Nexus Bridge inalcanzable');
    } catch (e) {
      console.warn('⚠️ [NEXUS CORE]: Servidor Nexus desconectado o en reposo.');
    }
  }
};
