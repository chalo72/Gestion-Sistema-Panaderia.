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
          const { supabaseDB } = await import('@/lib/supabase-sync-bridge');
          const serverConf = await supabaseDB.getAllConfiguraciones();
          const sf = serverConf.find((c: any) => c.id === 'formulaciones_data');
          const sm = serverConf.find((c: any) => c.id === 'modelosPan_data');
          if (sf && sf.categorias) cloudForm = Array.isArray(sf.categorias) ? sf.categorias : Object.values(sf.categorias);
          if (sm && sm.categorias) cloudMod = Array.isArray(sm.categorias) ? sm.categorias : Object.values(sm.categorias);
        } catch (e) {
          console.warn('No se pudo contactar a Supabase para fusión en caliente', e);
        }

        // 2. Fusión: gana la versión MÁS RECIENTE (fechaActualizacion).
        // Orden de empate (sin fecha): nube → backup → localStorage → IndexedDB
        // (así el celular recibe lo que la PC ya subió a la nube).
        // Datos de ejemplo SOLO si no hay nada real en ninguna fuente.
        type RegistroProd = { id?: string; nombre?: string; fechaActualizacion?: string; createdAt?: string; activo?: boolean };
        const toArr = (raw: unknown): RegistroProd[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw as RegistroProd[];
          if (typeof raw === 'object') return Object.values(raw as Record<string, RegistroProd>);
          return [];
        };
        const tsDe = (d: RegistroProd): number => {
          const raw = d.fechaActualizacion || d.createdAt || '';
          const t = raw ? Date.parse(raw) : NaN;
          return Number.isFinite(t) ? t : 0;
        };
        const getIngCount = (item: any): number => {
          if (!item) return 0;
          if (Array.isArray(item.ingredientes)) return item.ingredientes.length;
          if (item.ingredientes && typeof item.ingredientes === 'object') return Object.keys(item.ingredientes).length;
          return 0;
        };

        const mergePorRecencia = (
          fuentes: { label: string; data: RegistroProd[]; prioridadEmpate: number }[],
          defaults: RegistroProd[],
        ): RegistroProd[] => {
          const map = new Map<string, { item: RegistroProd; ts: number; prio: number }>();
          const aplicar = (arr: RegistroProd[], prio: number) => {
            for (const d of arr) {
              if (!d || typeof d !== 'object' || !d.id || !d.nombre) continue;
              const ts = tsDe(d);
              const prev = map.get(d.id);
              if (!prev) {
                map.set(d.id, { item: d, ts, prio });
                continue;
              }

              // GUARDIÁN ANTI-RETROCESO ESTRICTO:
              const prevIngCount = getIngCount(prev.item);
              const newIngCount = getIngCount(d);

              // 1. Si la versión existente tiene más de 2 ingredientes y la nueva viene degradada (<= 2), PROHIBIR sobreescritura
              if (prevIngCount > 2 && newIngCount <= 2) {
                console.warn(`[Anti-Retroceso] Protegido ${d.nombre}: se mantiene versión con ${prevIngCount} ingredientes frente a versión degradada con ${newIngCount}`);
                continue;
              }

              // 2. Si la nueva versión tiene significativamente más ingredientes, gana automáticamente
              if (newIngCount > prevIngCount) {
                map.set(d.id, { item: d, ts, prio });
                continue;
              }

              // 3. Si ambas tienen los mismos ingredientes (o son modelos de pan sin campo ingredientes):
              // Fecha más nueva gana; si empatan o no hay fecha, gana mayor prioridadEmpate
              if (ts > prev.ts || (ts === prev.ts && prio >= prev.prio)) {
                map.set(d.id, { item: d, ts, prio });
              }
            }
          };
          // Defaults primero (más débiles)
          aplicar(defaults, 0);
          for (const f of fuentes) aplicar(f.data, f.prioridadEmpate);
          return Array.from(map.values()).map((v) => v.item);
        };

        const formIDB = toArr(formulacionesIDB);
        const formBackup = toArr(oldBackupForm);
        const formLocal = toArr(localForm);
        const formCloud = toArr(cloudForm);
        const hasRealForm =
          formIDB.length > 0 || formBackup.length > 0 || formLocal.length > 0 || formCloud.length > 0;
        const finalFormulaciones = mergePorRecencia(
          [
            { label: 'local', data: formLocal, prioridadEmpate: 2 },
            { label: 'backup', data: formBackup, prioridadEmpate: 3 },
            { label: 'idb', data: formIDB, prioridadEmpate: 4 },
            // Nube con máxima prioridad de enlace
            { label: 'cloud', data: formCloud, prioridadEmpate: 10 },
          ],
          hasRealForm ? [] : toArr(DATOS_EJEMPLO.formulaciones),
        ) as FormulacionBase[];

        const modIDB = toArr(modelosIDB);
        const modBackup = toArr(oldBackupMod);
        const modLocal = toArr(localMod);
        const modCloud = toArr(cloudMod);
        const hasRealMod =
          modIDB.length > 0 || modBackup.length > 0 || modLocal.length > 0 || modCloud.length > 0;
        const finalModelos = mergePorRecencia(
          [
            { label: 'local', data: modLocal, prioridadEmpate: 2 },
            { label: 'backup', data: modBackup, prioridadEmpate: 3 },
            { label: 'idb', data: modIDB, prioridadEmpate: 4 },
            { label: 'cloud', data: modCloud, prioridadEmpate: 10 },
          ],
          hasRealMod ? [] : toArr(DATOS_EJEMPLO.modelosPan),
        ) as ModeloPan[];

        // CAPA DE BÓVEDA INMUTABLE: Auto-reparar si falta alguna masa maestra o insumo
        const { blindarYRepararFormulaciones, blindarYRepararModelos } = await import('@/lib/boveda-produccion-inmutable');
        const { resultado: blindadasForm } = blindarYRepararFormulaciones(finalFormulaciones);
        const { resultado: blindadosMod } = blindarYRepararModelos(finalModelos);

        setFormulaciones(blindadasForm);
        setModelosPan(blindadosMod);
        if (planesDiariosIDB && planesDiariosIDB.length > 0) {
          setPlanesDiarios(planesDiariosIDB);
        }

        // Persistir SIEMPRE las versiones blindadas y completas (NUNCA las degradadas)
        localStorage.setItem('formulaciones', JSON.stringify(blindadasForm));
        localStorage.setItem('modelosPan', JSON.stringify(blindadosMod));

        // Espejo en IndexedDB para que la próxima apertura coincida
        Promise.all([
          ...blindadasForm.map((f) => db.updateFormulacion(f).catch(() => {})),
          ...blindadosMod.map((m) => db.updateModeloPan(m).catch(() => {})),
        ]).catch(() => {});

        // Sincronizar hacia la nube si la lista blindada está completa
        const totalIngredientes = (list: any[]) =>
          list.reduce((acc, f) => acc + getIngCount(f), 0);
        const cloudFormIngCount = totalIngredientes(formCloud);
        const blindadasIngCount = totalIngredientes(blindadasForm);

        const debeSubirForm =
          blindadasForm.length > 0 &&
          (formCloud.length === 0 || blindadasIngCount >= cloudFormIngCount) &&
          blindadasIngCount >= 25;

        const debeSubirMod =
          blindadosMod.length > 0 &&
          (modCloud.length === 0 || blindadosMod.length >= modCloud.length) &&
          blindadosMod.length >= 10;

        if (debeSubirForm) db.saveBackup('formulaciones_data', blindadasForm).catch(() => {});
        if (debeSubirMod) db.saveBackup('modelosPan_data', blindadosMod).catch(() => {});

      } catch {
        // Si falla IndexedDB/Merge, rescatar desde Bóveda Inmutable
        try {
          const savedFormulaciones = localStorage.getItem('formulaciones');
          const savedModelos = localStorage.getItem('modelosPan');
          const rawForm = savedFormulaciones ? JSON.parse(savedFormulaciones) : [];
          const rawMod = savedModelos ? JSON.parse(savedModelos) : [];
          const { blindarYRepararFormulaciones, blindarYRepararModelos } = await import('@/lib/boveda-produccion-inmutable');
          const { resultado: blindadasForm } = blindarYRepararFormulaciones(rawForm);
          const { resultado: blindadosMod } = blindarYRepararModelos(rawMod);
          setFormulaciones(blindadasForm);
          setModelosPan(blindadosMod);
        } catch {
          const { BOVEDA_FORMULACIONES, BOVEDA_MODELOS_PAN } = await import('@/lib/boveda-produccion-inmutable');
          setFormulaciones(BOVEDA_FORMULACIONES);
          setModelosPan(BOVEDA_MODELOS_PAN);
        }
      } finally {
        setIsLoaded(true);
      }
    };

    cargarDatos();

    const handleRealtime = (e: any) => {
      const dt = e.detail;
      if (!dt) return;
      if (dt.table === 'configuracion' || dt.table === 'formulaciones' || dt.id === 'formulaciones_data' || dt.id === 'modelosPan_data') {
        cargarDatos();
      }
    };
    window.addEventListener('nexus-realtime-change', handleRealtime);
    
    return () => {
      window.removeEventListener('nexus-realtime-change', handleRealtime);
    };
  }, []);

  // Sincronizar hacia la nube y localmente SOLO si los datos no están degradados
  useEffect(() => {
    if (!isLoaded || formulaciones.length === 0) return;
    const totalIngs = formulaciones.reduce((acc, f) => acc + (Array.isArray(f.ingredientes) ? f.ingredientes.length : 0), 0);
    // GUARDIÁN: no guardar en nube ni sobreescribir si vienen menos de 20 ingredientes totales
    if (totalIngs >= 20) {
      localStorage.setItem('formulaciones', JSON.stringify(formulaciones));
      db.saveBackup('formulaciones_data', formulaciones).catch(console.error);
    } else {
      console.warn(`[Anti-Retroceso] Intento de sincronizar formulaciones degradadas (${totalIngs} ingredientes) bloqueado.`);
    }
  }, [formulaciones, isLoaded]);

  useEffect(() => {
    if (!isLoaded || modelosPan.length === 0) return;
    if (modelosPan.length >= 10) {
      localStorage.setItem('modelosPan', JSON.stringify(modelosPan));
      db.saveBackup('modelosPan_data', modelosPan).catch(console.error);
    } else {
      console.warn(`[Anti-Retroceso] Intento de sincronizar lista degradada de modelos (${modelosPan.length}) bloqueado.`);
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
    const ahora = new Date().toISOString();
    const formulacion: import('@/types').FormulacionBase = {
      ...data,
      id: generateUUID(),
      fechaActualizacion: ahora,
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
    const { esActualizacionSeguraFormulacion } = await import('@/lib/boveda-produccion-inmutable');
    const existing = formulaciones.find(f => f.id === id);
    const check = esActualizacionSeguraFormulacion(existing, updates);
    if (!check.segura) {
      toast.error(check.error || 'Actualización bloqueada por el Centinela de Integridad.');
      return;
    }
    setFormulaciones(prev => {
      const updatedList = prev.map(f => f.id === id ? { ...f, ...updates, fechaActualizacion: new Date().toISOString() } : f);
      const updatedModel = updatedList.find(f => f.id === id);
      if (updatedModel) db.updateFormulacion(updatedModel).catch(console.error);
      db.saveBackup('formulaciones_data', updatedList).catch(() => {});
      return updatedList;
    });
    toast.success('Formulación actualizada');
  }, [formulaciones]);

  const deleteFormulacion = useCallback(async (id: string) => {
    const { puedeEliminarFormulacion } = await import('@/lib/boveda-produccion-inmutable');
    const check = puedeEliminarFormulacion(id);
    if (!check.permitido) {
      toast.error(check.error || 'Esta formulación está protegida por la Bóveda Inmutable.');
      return;
    }
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
    const ahora = new Date().toISOString();
    const modelo: ModeloPan & { fechaActualizacion?: string } = {
      ...data,
      id: generateUUID(),
      createdAt: data.createdAt || ahora,
      fechaActualizacion: ahora,
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
    const ahora = new Date().toISOString();
    setModelosPan(prev => {
      const updatedList = prev.map((m) =>
        m.id === id
          ? ({ ...m, ...updates, fechaActualizacion: ahora } as ModeloPan & { fechaActualizacion?: string })
          : m,
      );
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

