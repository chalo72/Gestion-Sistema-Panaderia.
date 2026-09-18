import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/database';
import { generateUUID } from '@/lib/safe-utils';
import type { AuditoriaProduccion } from '@/types';
import { toast } from 'sonner';

const KEY_AUDITORIAS = 'dp_auditorias_produccion';

function getLocalAuditorias(): AuditoriaProduccion[] {
  try {
    const raw = localStorage.getItem(KEY_AUDITORIAS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAuditorias(list: AuditoriaProduccion[]) {
  try {
    localStorage.setItem(KEY_AUDITORIAS, JSON.stringify(list.slice(0, 365)));
  } catch {}
}

export function useAuditorias() {
  const [auditorias, setAuditorias] = useState<AuditoriaProduccion[]>(() => getLocalAuditorias());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuditorias = useCallback(async () => {
    try {
      setLoading(true);
      let data: AuditoriaProduccion[] = [];
      const adapter = (db as any).adapter;
      if (adapter && typeof adapter.getCollection === 'function') {
        data = await adapter.getCollection('auditorias_produccion');
      } else if (typeof (db as any).getAll === 'function') {
        data = await (db as any).getAll('auditorias_produccion');
      }
      
      if (!data || data.length === 0) {
        data = getLocalAuditorias();
      } else {
        saveLocalAuditorias(data);
      }

      // Sort by descending date
      const sorted = [...data].sort((a, b) => 
        new Date(b.createdAt || b.fecha).getTime() - new Date(a.createdAt || a.fecha).getTime()
      );
      setAuditorias(sorted);
      setError(null);
    } catch (err: any) {
      console.error('Error al cargar auditorías:', err);
      const local = getLocalAuditorias();
      setAuditorias(local);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditorias();
  }, [fetchAuditorias]);

  const addAuditoria = async (auditoria: Omit<AuditoriaProduccion, 'id' | 'createdAt'>) => {
    try {
      const newAuditoria: AuditoriaProduccion = {
        ...auditoria,
        id: generateUUID(),
        createdAt: new Date().toISOString(),
      };
      
      const adapter = (db as any).adapter;
      if (adapter && typeof adapter.setDocument === 'function') {
        await adapter.setDocument('auditorias_produccion', newAuditoria.id, newAuditoria).catch(() => {});
      } else if (typeof (db as any).add === 'function') {
        await (db as any).add('auditorias_produccion', newAuditoria).catch(() => {});
      }

      const actuales = getLocalAuditorias();
      const actualizados = [newAuditoria, ...actuales.filter(a => a.id !== newAuditoria.id)];
      saveLocalAuditorias(actualizados);

      setAuditorias(prev => [newAuditoria, ...prev.filter(a => a.id !== newAuditoria.id)]);
      toast.success('Auditoría guardada exitosamente');
      return newAuditoria;
    } catch (err: any) {
      console.error('Error al guardar auditoría:', err);
      toast.error('No se pudo guardar la auditoría');
      throw err;
    }
  };

  const removeAuditoria = async (id: string) => {
    try {
      const adapter = (db as any).adapter;
      if (adapter && typeof adapter.deleteDocument === 'function') {
        await adapter.deleteDocument('auditorias_produccion', id).catch(() => {});
      } else if (typeof (db as any).delete === 'function') {
        await (db as any).delete('auditorias_produccion', id).catch(() => {});
      }

      const actuales = getLocalAuditorias();
      const actualizados = actuales.filter(a => a.id !== id);
      saveLocalAuditorias(actualizados);

      setAuditorias(prev => prev.filter(a => a.id !== id));
      toast.success('Auditoría eliminada');
    } catch (err: any) {
      console.error('Error al eliminar auditoría:', err);
      toast.error('No se pudo eliminar la auditoría');
      throw err;
    }
  };

  return {
    auditorias,
    loading,
    error,
    fetchAuditorias,
    addAuditoria,
    removeAuditoria
  };
}
