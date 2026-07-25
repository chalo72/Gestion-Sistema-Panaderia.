import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/database';
import { generateUUID } from '@/lib/safe-utils';
import type { AuditoriaProduccion } from '@/types';
import { toast } from 'sonner';

export function useAuditorias() {
  const [auditorias, setAuditorias] = useState<AuditoriaProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuditorias = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.getAll('auditorias_produccion');
      // Sort by descending date
      const sorted = (data as AuditoriaProduccion[]).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAuditorias(sorted);
      setError(null);
    } catch (err: any) {
      console.error('Error al cargar auditorías:', err);
      setError(err);
      toast.error('Error al cargar el historial de auditorías');
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
      
      await db.add('auditorias_produccion', newAuditoria);
      setAuditorias(prev => [newAuditoria, ...prev]);
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
      await db.delete('auditorias_produccion', id);
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
