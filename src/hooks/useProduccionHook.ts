/**
 * useProduccionHook — Sub-hook para gestión de producción, formulaciones y modelos de pan
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/database';
import { DATOS_EJEMPLO } from '@/lib/seed-data';
import type {
  OrdenProduccion,
  Receta,
  FormulacionBase,
  ModeloPan
} from '@/types';
import { toast } from 'sonner';

interface UseProduccionParams {
  onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida', motivo: string) => Promise<void>;
  recetas: Receta[];
}

export function useProduccionHook({ onAjustarStock, recetas }: UseProduccionParams) {
  const [produccion, setProduccion] = useState<OrdenProduccion[]>([]);
  const [formulaciones, setFormulaciones] = useState<FormulacionBase[]>([]);
  const [modelosPan, setModelosPan] = useState<ModeloPan[]>([]);

  // Cargar formulaciones y modelos desde localStorage
  useEffect(() => {
    const savedFormulaciones = localStorage.getItem('formulaciones');
    const savedModelos = localStorage.getItem('modelosPan');
    
    if (savedFormulaciones && JSON.parse(savedFormulaciones).length > 0) {
      setFormulaciones(JSON.parse(savedFormulaciones));
    } else if (DATOS_EJEMPLO.formulaciones) {
      setFormulaciones(DATOS_EJEMPLO.formulaciones as FormulacionBase[]);
    }
    
    if (savedModelos && JSON.parse(savedModelos).length > 0) {
      setModelosPan(JSON.parse(savedModelos));
    } else if (DATOS_EJEMPLO.modelosPan) {
      setModelosPan(DATOS_EJEMPLO.modelosPan as ModeloPan[]);
    }
  }, []);

  // Persistir formulaciones
  useEffect(() => {
    if (formulaciones.length > 0 || localStorage.getItem('formulaciones')) {
      localStorage.setItem('formulaciones', JSON.stringify(formulaciones));
    }
  }, [formulaciones]);

  // Persistir modelos
  useEffect(() => {
    if (modelosPan.length > 0 || localStorage.getItem('modelosPan')) {
      localStorage.setItem('modelosPan', JSON.stringify(modelosPan));
    }
  }, [modelosPan]);

  // --- Ordenes de Producción ---
  const addOrdenProduccion = useCallback(async (data: Omit<OrdenProduccion, 'id' | 'fechaInicio' | 'estado'>) => {
    const orden: OrdenProduccion = {
      ...data,
      id: crypto.randomUUID(),
      fechaInicio: new Date().toISOString(),
      estado: 'planeado',
    };
    await db.addOrdenProduccion(orden as any);
    setProduccion(prev => [...prev, orden]);
    return orden;
  }, []);

  const updateOrdenProduccion = useCallback(async (id: string, updates: Partial<OrdenProduccion>) => {
    const orden = produccion.find(o => o.id === id);
    if (!orden) return;
    const updatedOrden = { ...orden, ...updates };
    await db.updateOrdenProduccion(updatedOrden as any);
    setProduccion(prev => prev.map(o => o.id === id ? updatedOrden : o));
  }, [produccion]);

  const finalizarProduccion = useCallback(async (id: string, cantidadCompletada: number) => {
    const orden = produccion.find(o => o.id === id);
    if (!orden || orden.estado === 'completado') return;

    // 1. Obtener receta
    const receta = recetas.find(r => r.productoId === orden.productoId);
    if (!receta) {
      toast.error('No hay receta definida para este producto. No se pueden descontar insumos.');
    } else {
      // 2. Descontar ingredientes
      for (const ingrediente of receta.ingredientes) {
        const cantidadTotal = (ingrediente.cantidad / receta.porcionesResultantes) * cantidadCompletada;
        await onAjustarStock(
          ingrediente.productoId,
          cantidadTotal,
          'salida',
          `Producción Lote: ${orden.lote || 'N/A'} - Orden: ${orden.id.slice(0, 8)}`
        );
      }
    }

    // 3. Cargar producto terminado
    await onAjustarStock(
      orden.productoId,
      cantidadCompletada,
      'entrada',
      `Producción Finalizada Lote: ${orden.lote || 'N/A'}`
    );

    // 4. Actualizar orden
    const updatedOrden: OrdenProduccion = {
      ...orden,
      cantidadCompletada,
      estado: 'completado',
      fechaFin: new Date().toISOString()
    };
    await db.updateOrdenProduccion(updatedOrden as any);
    setProduccion(prev => prev.map(o => o.id === id ? updatedOrden : o));

    toast.success(`Producción de ${cantidadCompletada} unidades completada y stock actualizado.`);
  }, [produccion, recetas, onAjustarStock]);

  // --- Formulaciones ---
  const addFormulacion = useCallback(async (data: Omit<import('@/types').FormulacionBase, 'id'>) => {
    const formulacion: import('@/types').FormulacionBase = {
      ...data,
      id: crypto.randomUUID(),
    };
    setFormulaciones(prev => [...prev, formulacion]);
    toast.success('Formulación creada');
    return formulacion;
  }, []);

  const updateFormulacion = useCallback(async (id: string, updates: Partial<import('@/types').FormulacionBase>) => {
    setFormulaciones(prev => prev.map(f => f.id === id ? { ...f, ...updates, fechaActualizacion: new Date().toISOString() } : f));
    toast.success('Formulación actualizada');
  }, []);

  const deleteFormulacion = useCallback(async (id: string) => {
    setFormulaciones(prev => prev.filter(f => f.id !== id));
    toast.success('Formulación eliminada');
  }, []);

  // --- Modelos de Pan ---
  const addModeloPan = useCallback(async (data: Omit<import('@/types').ModeloPan, 'id'>) => {
    const modelo: import('@/types').ModeloPan = {
      ...data,
      id: crypto.randomUUID(),
    };
    setModelosPan(prev => [...prev, modelo]);
    toast.success('Modelo de pan creado');
    return modelo;
  }, []);

  const updateModeloPan = useCallback(async (id: string, updates: Partial<import('@/types').ModeloPan>) => {
    setModelosPan(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    toast.success('Modelo actualizado');
  }, []);

  const deleteModeloPan = useCallback(async (id: string) => {
    setModelosPan(prev => prev.filter(m => m.id !== id));
    toast.success('Modelo eliminado');
  }, []);

  return {
    // State
    produccion, setProduccion,
    formulaciones,
    modelosPan,
    // Actions
    addOrdenProduccion, updateOrdenProduccion, finalizarProduccion,
    addFormulacion, updateFormulacion, deleteFormulacion,
    addModeloPan, updateModeloPan, deleteModeloPan,
  };
}
