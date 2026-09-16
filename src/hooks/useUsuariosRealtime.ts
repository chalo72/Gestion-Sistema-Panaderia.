/**
 * Sincronización en tiempo real de usuarios_sistema (claves de acceso).
 * Complementa useRealtimeSync (IndexedDB) para la libreta de login.
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isSelfWrite } from '@/lib/deviceId';
import {
  applyRemoteUserRecord,
  notifyUsuariosSync,
  pullUsersFromCloud,
  mergeUsersToLocalStorage,
  USUARIOS_SYNC_EVENT,
} from '@/lib/user-cloud-sync';

export function useUsuariosRealtime(): void {
  useEffect(() => {
    let activo = true;

    // Al conectar: traer usuarios de la nube
    pullUsersFromCloud()
      .then((remotos) => {
        if (!activo || remotos.length === 0) return;
        const cambios = mergeUsersToLocalStorage(remotos);
        if (cambios > 0) notifyUsuariosSync('bootstrap');
      })
      .catch(() => {});

    const channel = supabase
      .channel('nexus_rt_usuarios_sistema_v1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios_sistema' },
        (payload) => {
          const record = Object.keys(payload.new ?? {}).length > 0
            ? (payload.new as Record<string, unknown>)
            : (payload.old as Record<string, unknown>);
          const id = record?.id as string | undefined;
          if (!id) return;
          if (isSelfWrite('usuarios_sistema', id)) return;

          const cambios = applyRemoteUserRecord(record, payload.eventType);
          if (cambios > 0) {
            notifyUsuariosSync(`realtime_${payload.eventType.toLowerCase()}`, id);
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

export { USUARIOS_SYNC_EVENT };
