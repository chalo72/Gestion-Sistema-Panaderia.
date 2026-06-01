import { useState, useCallback } from 'react';
import { generateUUID } from '@/lib/safe-utils';
import type { InspeccionCalidad, RechazoCalidad } from '@/types';

const STORAGE_KEY = 'dulceplacer_control_calidad_v1';

function cargar(): InspeccionCalidad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as InspeccionCalidad[];
  } catch {}
  return [];
}

export function useControlCalidad() {
  const [inspecciones, setInspecciones] = useState<InspeccionCalidad[]>(cargar);

  const guardarInspeccion = useCallback((data: Omit<InspeccionCalidad, 'id' | 'fechaInspeccion' | 'porcentajeRechazo' | 'cantidadAprobada'>) => {
    const totalRechazados = data.rechazos.reduce((s, r) => s + r.cantidad, 0);
    const cantidadAprobada = Math.max(0, data.cantidadContada - totalRechazados);
    const porcentajeRechazo = data.cantidadContada > 0
      ? Math.round((totalRechazados / data.cantidadContada) * 100)
      : 0;

    const nueva: InspeccionCalidad = {
      id: generateUUID(),
      fechaInspeccion: new Date().toISOString(),
      cantidadAprobada,
      porcentajeRechazo,
      ...data,
    };

    setInspecciones(prev => {
      // Reemplazar si ya existe para esta orden
      const filtrado = prev.filter(i => i.ordenProduccionId !== data.ordenProduccionId);
      const actualizado = [nueva, ...filtrado];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      return actualizado;
    });

    return nueva;
  }, []);

  const getInspeccionPorOrden = useCallback((ordenId: string) => {
    return inspecciones.find(i => i.ordenProduccionId === ordenId);
  }, [inspecciones]);

  const eliminarInspeccion = useCallback((ordenId: string) => {
    setInspecciones(prev => {
      const actualizado = prev.filter(i => i.ordenProduccionId !== ordenId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  return { inspecciones, guardarInspeccion, getInspeccionPorOrden, eliminarInspeccion };
}
