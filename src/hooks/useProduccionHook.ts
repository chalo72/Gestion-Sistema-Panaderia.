import { generateUUID } from '@/lib/safe-utils';
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
  ModeloPan,
  PlanProduccionDiario
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
  const [planesDiarios, setPlanesDiarios] = useState<PlanProduccionDiario[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar formulaciones y modelos desde IndexedDB (principal) + localStorage (fallback)
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // 1. Cargar desde las 3 posibles fuentes (IDB, LocalStorage, Backups)
        const [formulacionesIDB, modelosIDB, planesDiariosIDB] = await Promise.all([
          db.getAllFormulaciones(),
          db.getAllModelosPan(),
          db.getAllPlanesDiarios()
        ]);
        
        const oldBackupForm = await db.getBackup('formulaciones_data');
        const oldBackupMod = await db.getBackup('modelosPan_data');
        
        const localForm = JSON.parse(localStorage.getItem('formulaciones') || '[]');
        const localMod = JSON.parse(localStorage.getItem('modelosPan') || '[]');

        // 1.5 Cargar forzosamente desde Supabase por si la caché está rota
        let cloudForm = [];
        let cloudMod = [];
        try {
          const { supabaseDB } = await import('@/lib/supabase');
          const serverConf = await supabaseDB.getAllConfiguraciones();
          const sf = serverConf.find((c: any) => c.id === 'formulaciones_data');
          const sm = serverConf.find((c: any) => c.id === 'modelosPan_data');
          if (sf && sf.categorias) cloudForm = Array.isArray(sf.categorias) ? sf.categorias : Object.values(sf.categorias);
          if (sm && sm.categorias) cloudMod = Array.isArray(sm.categorias) ? sm.categorias : Object.values(sm.categorias);
        } catch (e) {
          console.warn('No se pudo contactar a Supabase para fusión en caliente', e);
        }

        // 2. Fusión inteligente
        const mergeData = (idb: any[], backup: any, local: any[], cloud: any[], defaults: any[]) => {
           const map = new Map<string, any>();
           // Agregar de menor a mayor prioridad para que los últimos sobreescriban
           if (defaults && defaults.length) defaults.forEach(d => map.set(d.id, d));
           if (backup && backup.length) backup.forEach((d: any) => map.set(d.id, d));
           if (local && local.length) local.forEach(d => map.set(d.id, d));
           if (idb && idb.length) idb.forEach(d => map.set(d.id, d));
           if (cloud && cloud.length) cloud.forEach(d => { if (typeof d === 'object') map.set(d.id, d); });
           
           // Limpieza profunda
           return Array.from(map.values()).filter(d => d && typeof d === 'object' && d.id && d.nombre);
        };

        const finalFormulaciones = mergeData(
          formulacionesIDB || [], 
          oldBackupForm, 
          localForm, 
          cloudForm,
          DATOS_EJEMPLO.formulaciones || []
        );

        const finalModelos = mergeData(
          modelosIDB || [], 
          oldBackupMod, 
          localMod, 
          cloudMod,
          DATOS_EJEMPLO.modelosPan || []
        );

        setFormulaciones(finalFormulaciones);
        setModelosPan(finalModelos);
        if (planesDiariosIDB && planesDiariosIDB.length > 0) {
          setPlanesDiarios(planesDiariosIDB);
        }
        
        // Disparar sincronización para asegurar que la base unificada se propague a la nube
        if (finalFormulaciones.length > 0) db.saveBackup('formulaciones_data', finalFormulaciones).catch(() => {});
        if (finalModelos.length > 0) db.saveBackup('modelosPan_data', finalModelos).catch(() => {});

      } catch {
        // Si IndexedDB falla, usar localStorage
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
      } finally {
        setIsLoaded(true);
      }
    };
    cargarDatos();
  }, []);

  // Sincronizar hacia la nube a través de saveBackup cuando cambien localmente
  useEffect(() => {
    if (isLoaded && formulaciones.length > 0) {
      db.saveBackup('formulaciones_data', formulaciones).catch(console.error);
    }
  }, [formulaciones, isLoaded]);

  useEffect(() => {
    if (isLoaded && modelosPan.length > 0) {
      db.saveBackup('modelosPan_data', modelosPan).catch(console.error);
    }
  }, [modelosPan, isLoaded]);


  // Persistir formulaciones en localStorage + IndexedDB (doble capa)
  useEffect(() => {
    if (!isLoaded) return;
    if (formulaciones.length > 0 || localStorage.getItem('formulaciones')) {
      localStorage.setItem('formulaciones', JSON.stringify(formulaciones));
      db.saveBackup('formulaciones_data', formulaciones).catch(() => {});
    }
  }, [formulaciones, isLoaded]);

  // Persistir modelos en localStorage + IndexedDB (doble capa)
  useEffect(() => {
    if (!isLoaded) return;
    if (modelosPan.length > 0 || localStorage.getItem('modelosPan')) {
      localStorage.setItem('modelosPan', JSON.stringify(modelosPan));
      db.saveBackup('modelosPan_data', modelosPan).catch(() => {});
    }
  }, [modelosPan, isLoaded]);

  // --- Ordenes de Producción ---
  const addOrdenProduccion = useCallback(async (data: Omit<OrdenProduccion, 'id' | 'fechaInicio' | 'estado'>) => {
    const orden: OrdenProduccion = {
      ...data,
      id: generateUUID(),
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

  const addPlanDiario = useCallback(async (data: Omit<PlanProduccionDiario, 'id' | 'creadoEn' | 'estado'>) => {
    const plan: PlanProduccionDiario = {
      ...data,
      id: generateUUID(),
      creadoEn: new Date().toISOString(),
      estado: 'planeado'
    };
    await db.addPlanDiario(plan as any);
    setPlanesDiarios(prev => [...prev, plan]);
    toast.success('Plan diario guardado exitosamente');
    return plan;
  }, []);

  const deletePlanDiario = useCallback(async (id: string) => {
    await db.deletePlanDiario(id);
    setPlanesDiarios(prev => prev.filter(p => p.id !== id));
    toast.success('Plan eliminado');
  }, []);

  const finalizarProduccion = useCallback(async (id: string, cantidadCompletada: number) => {
    const orden = produccion.find(o => o.id === id);
    if (!orden || orden.estado === 'completado') return;

    // 1. Obtener receta o formulación
    const receta = recetas.find(r => r.productoId === orden.productoId);
    const formulacion = orden.formulacionId ? formulaciones.find(f => f.id === orden.formulacionId) : null;
    const modelo = orden.modeloPanId ? modelosPan.find(m => m.id === orden.modeloPanId) : null;

    if (!receta && !formulacion) {
      toast.error('No hay receta ni formulación definida para esta orden. Configura la receta antes de finalizar.');
      return;
    }

    // 2. Preparar ajustes de stock (Batch)
    const mermaFactor = modelo?.mermaEstimada ? 1 + (modelo.mermaEstimada / 100) : 1;
    const mermaKgEstimado = modelo?.mermaEstimada
      ? Math.round(((mermaFactor - 1) * cantidadCompletada) * 100) / 100
      : 0;

    const usuarioActual = (() => {
      try {
        const u = localStorage.getItem('pricecontrol_local_user');
        return u ? (JSON.parse(u)?.nombre || 'sistema') : 'sistema';
      } catch { return 'sistema'; }
    })();

    const ajustes: any[] = [];

    // A. Descontar ingredientes
    if (formulacion && modelo) {
        // LÓGICA NUEVA: Basado en arrobasUsadas y formulacion (Plan Diario)
        // Usar las arrobas planeadas que están en la orden
        const arrobasCalculadas = orden.arrobasUsadas || (cantidadCompletada / modelo.panesPorArroba);
        for (const ingrediente of formulacion.ingredientes) {
            // cantidad total = cantidad por arroba * arrobas calculadas
            const cantidadTotal = ingrediente.cantidadPorArroba * arrobasCalculadas;
            ajustes.push({
                productoId: ingrediente.productoId,
                cantidad: cantidadTotal,
                tipo: 'salida',
                motivo: `Producción (Formulación) Lote: ${orden.lote || 'N/A'}`,
                usuario: usuarioActual
            });
        }
    } else if (receta) {
        // LÓGICA ANTIGUA (Legacy): Basada en receta simple
        for (const ingrediente of receta.ingredientes) {
          const cantidadBase = (ingrediente.cantidad / receta.porcionesResultantes) * cantidadCompletada;
          const cantidadConMerma = Math.round(cantidadBase * mermaFactor * 1000) / 1000;
          ajustes.push({
            productoId: ingrediente.productoId,
            cantidad: cantidadConMerma,
            tipo: 'salida',
            motivo: `Producción Lote: ${orden.lote || 'N/A'} (merma ${modelo?.mermaEstimada ?? 0}%)`,
            usuario: usuarioActual
          });
        }
    }

    // B. Cargar producto terminado
    ajustes.push({
      productoId: orden.productoId,
      cantidad: cantidadCompletada,
      tipo: 'entrada',
      motivo: `Producción Finalizada Lote: ${orden.lote || 'N/A'}`,
      usuario: usuarioActual
    });

    // 3. Ejecutar ajustes atómicos
    await db.batchAjustarStock(ajustes);

    // 5. Actualizar orden con datos reales de merma
    const updatedOrden: OrdenProduccion = {
      ...orden,
      cantidadCompletada,
      estado: 'completado',
      fechaFin: new Date().toISOString(),
      mermaKg: mermaKgEstimado,
    };
    await db.updateOrdenProduccion(updatedOrden as any);
    setProduccion(prev => prev.map(o => o.id === id ? updatedOrden : o));

    const mermaTexto = mermaKgEstimado > 0 ? ` · merma ${modelo?.mermaEstimada}% registrada` : '';
    toast.success(`✓ ${cantidadCompletada} unidades producidas y stock actualizado${mermaTexto}.`);
  }, [produccion, recetas, modelosPan, onAjustarStock]);

  // --- Formulaciones ---
  const addFormulacion = useCallback(async (data: Omit<import('@/types').FormulacionBase, 'id'>) => {
    const formulacion: import('@/types').FormulacionBase = {
      ...data,
      id: generateUUID(),
    };
    setFormulaciones(prev => {
      const newList = [...prev, formulacion];
      db.saveBackup('formulaciones_data', newList).catch(() => {});
      return newList;
    });
    db.addFormulacion(formulacion).catch(console.error);
    toast.success('Formulación creada');
    return formulacion;
  }, []);

  const updateFormulacion = useCallback(async (id: string, updates: Partial<import('@/types').FormulacionBase>) => {
    setFormulaciones(prev => {
      const updatedList = prev.map(f => f.id === id ? { ...f, ...updates, fechaActualizacion: new Date().toISOString() } : f);
      const updatedModel = updatedList.find(f => f.id === id);
      if (updatedModel) db.updateFormulacion(updatedModel).catch(console.error);
      db.saveBackup('formulaciones_data', updatedList).catch(() => {});
      return updatedList;
    });
    toast.success('Formulación actualizada');
  }, []);

  const deleteFormulacion = useCallback(async (id: string) => {
    setFormulaciones(prev => {
      const newList = prev.filter(f => f.id !== id);
      db.saveBackup('formulaciones_data', newList).catch(() => {});
      return newList;
    });
    db.deleteFormulacion(id).catch(console.error);
    toast.success('Formulación eliminada');
  }, []);

  // --- Modelos de Pan ---
  const addModeloPan = useCallback(async (data: Omit<import('@/types').ModeloPan, 'id'>) => {
    const modelo: import('@/types').ModeloPan = {
      ...data,
      id: generateUUID(),
    };
    setModelosPan(prev => {
      const newList = [...prev, modelo];
      db.saveBackup('modelosPan_data', newList).catch(() => {});
      return newList;
    });
    db.addModeloPan(modelo).catch(console.error);
    toast.success('Modelo de pan creado');
    return modelo;
  }, []);

  const updateModeloPan = useCallback(async (id: string, updates: Partial<import('@/types').ModeloPan>) => {
    setModelosPan(prev => {
      const updatedList = prev.map(m => m.id === id ? { ...m, ...updates } : m);
      const updatedModel = updatedList.find(m => m.id === id);
      if (updatedModel) db.updateModeloPan(updatedModel).catch(console.error);
      db.saveBackup('modelosPan_data', updatedList).catch(() => {});
      return updatedList;
    });
    toast.success('Modelo actualizado');
  }, []);

  const deleteModeloPan = useCallback(async (id: string) => {
    setModelosPan(prev => {
      const newList = prev.filter(m => m.id !== id);
      db.saveBackup('modelosPan_data', newList).catch(() => {});
      return newList;
    });
    db.deleteModeloPan(id).catch(console.error);
    toast.success('Modelo eliminado');
  }, []);

  return {
    // State
    produccion, setProduccion,
    formulaciones,
    modelosPan,
    planesDiarios,
    // Actions
    addOrdenProduccion, updateOrdenProduccion, finalizarProduccion,
    addFormulacion, updateFormulacion, deleteFormulacion,
    addModeloPan, updateModeloPan, deleteModeloPan,
    addPlanDiario, deletePlanDiario,
    // Acción de merma
    addRegistroMerma: async (productoId: string, cantidad: number, motivo: string) => {
      await onAjustarStock(productoId, cantidad, 'salida', `Merma: ${motivo}`);
      toast.warning(`Merma de ${cantidad} unidades registrada`);
    }
  };
}
