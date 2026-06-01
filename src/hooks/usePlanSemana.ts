import { useState, useCallback } from 'react';
import { generateUUID } from '@/lib/safe-utils';
import type { PlanSemana, PlanSemanaItem, DiaPerdido } from '@/types';

const STORAGE_KEY = 'dulceplacer_plan_semana_v1';
const DIAS_PERDIDOS_KEY = 'dulceplacer_dias_perdidos_v1';

function planVacio(): PlanSemana {
  return {
    dias: Array.from({ length: 7 }, () => []),
    updatedAt: new Date().toISOString(),
  };
}

function cargarDesdeStorage(): PlanSemana {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlanSemana;
      // Asegurar que siempre haya 7 días
      if (!Array.isArray(parsed.dias) || parsed.dias.length !== 7) {
        return planVacio();
      }
      return parsed;
    }
  } catch {
    // ignorar errores de parse
  }
  return planVacio();
}

function cargarDiasPerdidos(): DiaPerdido[] {
  try {
    const raw = localStorage.getItem(DIAS_PERDIDOS_KEY);
    if (raw) return JSON.parse(raw) as DiaPerdido[];
  } catch {}
  return [];
}

export function usePlanSemana() {
  const [plan, setPlan] = useState<PlanSemana>(cargarDesdeStorage);
  const [diasPerdidos, setDiasPerdidos] = useState<DiaPerdido[]>(cargarDiasPerdidos);

  const guardarPlan = useCallback((nuevoPlan: PlanSemana) => {
    const actualizado = { ...nuevoPlan, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
    setPlan(actualizado);
  }, []);

  const agregarItem = useCallback((diaSemana: number, item: Omit<PlanSemanaItem, 'id'>) => {
    setPlan(prev => {
      const nuevoDias = prev.dias.map((dia, i) =>
        i === diaSemana ? [...dia, { ...item, id: generateUUID() }] : dia
      );
      const actualizado = { dias: nuevoDias, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  const actualizarItem = useCallback((diaSemana: number, itemId: string, cambios: Partial<PlanSemanaItem>) => {
    setPlan(prev => {
      const nuevoDias = prev.dias.map((dia, i) =>
        i === diaSemana
          ? dia.map(item => item.id === itemId ? { ...item, ...cambios, ...(cambios.formulacionId ? { modeloId: '' } : {}) } : item)
          : dia
      );
      const actualizado = { dias: nuevoDias, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  const eliminarItem = useCallback((diaSemana: number, itemId: string) => {
    setPlan(prev => {
      const nuevoDias = prev.dias.map((dia, i) =>
        i === diaSemana ? dia.filter(item => item.id !== itemId) : dia
      );
      const actualizado = { dias: nuevoDias, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  const registrarDiaPerdido = useCallback((diaIndex: number, fecha: string, items: PlanSemanaItem[]) => {
    setDiasPerdidos(prev => {
      const filtrado = prev.filter(d => d.fecha !== fecha);
      const nuevo: DiaPerdido[] = [...filtrado, { diaSemana: diaIndex, fecha, items, estado: 'pendiente' }];
      localStorage.setItem(DIAS_PERDIDOS_KEY, JSON.stringify(nuevo));
      return nuevo;
    });
  }, []);

  const resolverDiaPerdido = useCallback((fecha: string, estado: 'ignorar' | 'postergar') => {
    setDiasPerdidos(prev => {
      const actualizado = prev.map(d => d.fecha === fecha ? { ...d, estado } : d);
      localStorage.setItem(DIAS_PERDIDOS_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  return {
    plan,
    diasPerdidos,
    guardarPlan,
    agregarItem,
    actualizarItem,
    eliminarItem,
    registrarDiaPerdido,
    resolverDiaPerdido,
  };
}
