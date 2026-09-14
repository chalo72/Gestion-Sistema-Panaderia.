/**
 * Realtime + bootstrap para permisos de roles y visibilidad de módulos.
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isSelfWrite } from '@/lib/deviceId';
import {
  applyRemotePermiso,
  notifyPermisosSync,
  sincronizarPermisosDesdeNube,
  PERMISOS_SYNC_EVENT,
} from '@/lib/permisos-cloud-sync';

export function usePermisosRealtime(): void {
  useEffect(() => {
    let activo = true;

    sincronizarPermisosDesdeNube()
      .then((cambios) => {
        if (activo && cambios > 0) notifyPermisosSync('bootstrap');
      })
      .catch(() => {});

    const channel = supabase
      .channel('nexus_rt_permisos_sistema_v1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'permisos_sistema' },
        (payload) => {
          const record = Object.keys(payload.new ?? {}).length > 0
            ? (payload.new as { clave?: string; valor?: unknown; updated_at?: string })
            : (payload.old as { clave?: string; valor?: unknown; updated_at?: string });
          const clave = record?.clave;
          if (!clave) return;
          if (isSelfWrite('permisos_sistema', clave)) return;

          if (payload.eventType === 'DELETE') return;

          const cambio = applyRemotePermiso(
            clave,
            record.valor,
            record.updated_at || new Date().toISOString(),
          );
          if (cambio) {
            notifyPermisosSync(`realtime_${payload.eventType.toLowerCase()}`);
          }
        },
      )
      .subscribe();

    return () => {
      activo = false;
      supabase.removeChannel(channel);
    };
  }, []);
}

export { PERMISOS_SYNC_EVENT };
