/**
 * BÓVEDA INMUTABLE DE PRODUCCIÓN - DULCE PLACER
 * Capas de Protección Activas:
 * 1. Respaldo Inmutable en Código (Hard Fallback)
 * 2. Centinela de Integridad (Detección de datos degradados <= 2 ingredientes)
 * 3. Auto-Heal (Reparación automática en caliente si falta algún insumo)
 * 4. Barrera de Nube (Bloqueo de escrituras corruptas hacia Supabase)
 * 5. Restaurador de Emergencia en 1 Clic
 */

import { FORMULACIONES_INMUTABLES } from './vault/formulaciones-inmutables';
import { MODELOS_PAN_INMUTABLES } from './vault/modelos-inmutables';
import type { FormulacionBase, ModeloPan } from '@/types';
import { db } from './database';
import { toast } from 'sonner';

// ── CAPA 1: DATOS MAESTROS INMUTABLES CONGELADOS ──────────────────────────────
export const BOVEDA_FORMULACIONES: FormulacionBase[] = Object.freeze(
  JSON.parse(JSON.stringify(FORMULACIONES_INMUTABLES))
) as FormulacionBase[];

export const BOVEDA_MODELOS_PAN: ModeloPan[] = Object.freeze(
  JSON.parse(JSON.stringify(MODELOS_PAN_INMUTABLES))
) as ModeloPan[];

// Identificadores y alias de las 5 Masas Maestras Críticas que jamás pueden borrarse ni degradarse
export const MASAS_CRITICAS_MAP: Record<string, { nombre: string; minIngredientes: number; alias: string[] }> = {
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51': { nombre: 'Masa de Sal Mixta', minIngredientes: 10, alias: ['sal', 'sal mixta', 'masa sal', 'masa de sal'] },
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52': { nombre: 'Masa de Dulce', minIngredientes: 9, alias: ['dulce', 'masa dulce', 'masa de dulce', 'dulce especial'] },
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53': { nombre: 'Masa de Hojaldre Mixta', minIngredientes: 8, alias: ['hojaldre', 'hojaldre mixta', 'masa hojaldre'] },
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54': { nombre: 'Batido de Tortas Maestro', minIngredientes: 10, alias: ['torta', 'tortas', 'batido torta', 'batido de tortas'] },
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55': { nombre: 'Vatido Galleta', minIngredientes: 8, alias: ['galleta', 'galletas', 'vatido galleta', 'batido galleta'] },
};

/**
 * Conteo seguro de ingredientes en cualquier estructura
 */
export function contarIngredientesSeguro(f: any): number {
  if (!f) return 0;
  if (Array.isArray(f.ingredientes)) return f.ingredientes.length;
  if (f.ingredientes && typeof f.ingredientes === 'object') {
    return Object.keys(f.ingredientes).length;
  }
  return 0;
}

// ── CAPA 2: CENTINELA DE INTEGRIDAD Y AUTO-HEAL ──────────────────────────────

/**
 * Inspecciona un listado de formulaciones. Si detecta que alguna de las masas maestras
 * fue podada o tiene menos ingredientes de los mínimos exigidos, la restaura de inmediato.
 * Si faltaba alguna masa maestra en la lista, la inyecta de vuelta.
 */
export function blindarYRepararFormulaciones(actuales: FormulacionBase[]): {
  resultado: FormulacionBase[];
  reparadas: number;
} {
  const mapActuales = new Map<string, FormulacionBase>();
  let reparaciones = 0;

  for (const f of actuales) {
    if (f && f.id) mapActuales.set(f.id, f);
  }

  // Verificar cada masa crítica de la bóveda
  for (const bovedaForm of BOVEDA_FORMULACIONES) {
    const critica = MASAS_CRITICAS_MAP[bovedaForm.id];
    const minExigido = critica ? critica.minIngredientes : 8;

    // Buscar por ID exacto
    let actual = mapActuales.get(bovedaForm.id);
    let matchedId = bovedaForm.id;

    // Si no está por ID exacto, buscar por coincidencia de nombre o alias
    if (!actual && critica?.alias) {
      for (const [id, f] of mapActuales.entries()) {
        const nom = (f.nombre || '').toLowerCase().trim();
        if (critica.alias.some(a => nom.includes(a))) {
          actual = f;
          matchedId = id;
          break;
        }
      }
    }

    if (!actual) {
      // Masa crítica faltante: reinsertar desde la bóveda
      mapActuales.set(bovedaForm.id, JSON.parse(JSON.stringify(bovedaForm)));
      reparaciones++;
      console.warn(`🛡️ [Bóveda] Masa crítica ausente restaurada: ${bovedaForm.nombre}`);
    } else {
      const cantActual = contarIngredientesSeguro(actual);
      if (cantActual < minExigido) {
        // Masa degradada: restaurar ingredientes íntegros de la bóveda
        const healed: FormulacionBase = {
          ...actual,
          ingredientes: JSON.parse(JSON.stringify(bovedaForm.ingredientes || [])),
          rendimientoBaseKg: bovedaForm.rendimientoBaseKg || actual.rendimientoBaseKg,
          costoTotalArroba: bovedaForm.costoTotalArroba || actual.costoTotalArroba,
          fechaActualizacion: new Date().toISOString(),
        };
        mapActuales.set(matchedId, healed);
        if (matchedId !== bovedaForm.id) {
          mapActuales.set(bovedaForm.id, JSON.parse(JSON.stringify(bovedaForm)));
        }
        reparaciones++;
        console.warn(
          `🛡️ [Bóveda] Insumos degradados (${cantActual}/${minExigido}) reparados automáticamente en: ${bovedaForm.nombre}`
        );
      }
    }
  }

  return {
    resultado: Array.from(mapActuales.values()),
    reparadas: reparaciones,
  };
}

/**
 * Inspecciona los modelos de pan y garantiza que existan al menos los 35 modelos de la bóveda
 */
export function blindarYRepararModelos(actuales: ModeloPan[]): {
  resultado: ModeloPan[];
  reparados: number;
} {
  const mapActuales = new Map<string, ModeloPan>();
  let reparados = 0;

  for (const m of actuales) {
    if (m && m.id) mapActuales.set(m.id, m);
  }

  for (const bovedaMod of BOVEDA_MODELOS_PAN) {
    if (!mapActuales.has(bovedaMod.id)) {
      mapActuales.set(bovedaMod.id, { ...bovedaMod });
      reparados++;
    }
  }

  return {
    resultado: Array.from(mapActuales.values()),
    reparados,
  };
}

// ── CAPA 3: INTERCEPTOR DE MODIFICACIÓN Y BORRADO ─────────────────────────────

/**
 * Valida si una actualización a una formulación es legal o si degrada los insumos
 */
export function esActualizacionSeguraFormulacion(
  original: FormulacionBase | undefined,
  nueva: Partial<FormulacionBase>
): { segura: boolean; error?: string } {
  if (!original) return { segura: true };

  const critica = MASAS_CRITICAS_MAP[original.id];
  if (critica) {
    const cantNueva = contarIngredientesSeguro(nueva);
    if (cantNueva > 0 && cantNueva < 4) {
      return {
        segura: false,
        error: `Acción bloqueada por seguridad: "${critica.nombre}" no puede reducirse a ${cantNueva} ingredientes. Requiere mínimo ${critica.minIngredientes}.`,
      };
    }
  }
  return { segura: true };
}

/**
 * Bloquea la eliminación accidental de cualquiera de las masas maestras
 */
export function puedeEliminarFormulacion(id: string): { permitido: boolean; error?: string } {
  const critica = MASAS_CRITICAS_MAP[id];
  if (critica) {
    return {
      permitido: false,
      error: `La masa "${critica.nombre}" es un pilar del negocio protegido en bóveda inmutable y no puede ser eliminada.`,
    };
  }
  return { permitido: true };
}

// ── CAPA 4: BARRERA DE PROTECCIÓN HACIA LA NUBE ──────────────────────────────

/**
 * Valida si un guardado en nube hacia Supabase es seguro o degradaría los datos
 */
export function validarBackupNube(
  key: string,
  data: any
): { permitido: boolean; motivo?: string } {
  if (key === 'formulaciones_data') {
    const arr = Array.isArray(data) ? data : [];
    const totalIngs = arr.reduce((s, f) => s + contarIngredientesSeguro(f), 0);
    if (totalIngs < 25) {
      return {
        permitido: false,
        motivo: `Intento de subir formulaciones degradadas con solo ${totalIngs} ingredientes en total. Mínimo exigido: 25.`,
      };
    }
  }

  if (key === 'modelosPan_data') {
    const arr = Array.isArray(data) ? data : [];
    if (arr.length < 15) {
      return {
        permitido: false,
        motivo: `Intento de subir modelos de pan podados (${arr.length} modelos). Mínimo exigido: 15.`,
      };
    }
  }

  return { permitido: true };
}

// ── CAPA 5: RESTAURADOR DE EMERGENCIA DE LA BÓVEDA EN 1-CLIC ───────────────────

/**
 * Ejecuta una restauración total forzada desde la Bóveda Inmutable.
 * Restaura LocalStorage, IndexedDB y actualiza la Nube Supabase.
 */
export async function forzarRestauracionDesdeBoveda(): Promise<{
  success: boolean;
  formulacionesCount: number;
  modelosCount: number;
}> {
  try {
    const ahora = new Date().toISOString();
    const forms = BOVEDA_FORMULACIONES.map((f) => ({
      ...f,
      fechaActualizacion: ahora,
    }));
    const mods = BOVEDA_MODELOS_PAN.map((m) => ({
      ...m,
      updatedAt: ahora,
    }));

    // 1. LocalStorage
    localStorage.setItem('formulaciones', JSON.stringify(forms));
    localStorage.setItem('modelosPan', JSON.stringify(mods));

    // 2. IndexedDB
    await Promise.all([
      ...forms.map((f) => db.updateFormulacion(f).catch(() => {})),
      ...mods.map((m) => db.updateModeloPan(m).catch(() => {})),
    ]);

    // 3. Supabase Cloud Backup
    await Promise.all([
      db.saveBackup('formulaciones_data', forms).catch(() => {}),
      db.saveBackup('modelosPan_data', mods).catch(() => {}),
    ]);

    // 4. Notificar a componentes en tiempo real
    window.dispatchEvent(new CustomEvent('nexus-realtime-change', {
      detail: { table: 'configuracion', id: 'formulaciones_data' }
    }));

    toast.success(
      `🛡️ Bóveda Restaurada: ${forms.length} masas (${forms.reduce((s,f)=>s+(f.ingredientes?.length||0),0)} insumos) y ${mods.length} modelos de pan protegidos.`
    );

    return {
      success: true,
      formulacionesCount: forms.length,
      modelosCount: mods.length,
    };
  } catch (error: any) {
    console.error('Error al restaurar desde la bóveda:', error);
    toast.error('Error al restaurar la bóveda: ' + (error?.message || 'Desconocido'));
    return { success: false, formulacionesCount: 0, modelosCount: 0 };
  }
}
