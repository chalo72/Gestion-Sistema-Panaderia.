import { useState, useCallback, useMemo } from 'react';
import type {
  ProgramacionSemanaFlexible,
  ProgramacionDia,
  AsignacionCategoria,
  CategoriaProduccion,
  DiaProduccionPerdido,
} from '@/types';
import { generateUUID } from '@/lib/safe-utils';

// ─── Constants ───────────────────────────────────────────
const STORAGE_KEY_PROGRAMACION = 'dp_programacion_semanal';
const STORAGE_KEY_PERDIDOS = 'dp_dias_perdidos_v2';

// Días perdidos: velocidadVenta determine recovery logic
// Alta/Estrella → recuperar hoy
// Media/Baja → postergar
const CAPACIDAD_DEFAULT = 3; // arrobas de referencia por defecto

// ─── Helpers ─────────────────────────────────────────────
export function getSemanaId(fecha: Date = new Date()): string {
  // ISO week year-week
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getLunesDeSemana(fecha: Date = new Date()): string {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust for Sunday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/** Índice del día en nuestra convención: 0=Lunes…6=Domingo */
export function diaJsToIdx(dayJs: number): number {
  return dayJs === 0 ? 6 : dayJs - 1;
}

const defaultDia = (): ProgramacionDia => ({
  categorias: [],
  capacidadReferencia: CAPACIDAD_DEFAULT,
});

const defaultSemana = (): ProgramacionSemanaFlexible => ({
  semanaId: getSemanaId(),
  fechaInicio: getLunesDeSemana(),
  dias: Array.from({ length: 7 }, defaultDia),
  updatedAt: new Date().toISOString(),
});

function loadProgramacion(): ProgramacionSemanaFlexible {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRAMACION);
    if (raw) return JSON.parse(raw) as ProgramacionSemanaFlexible;
  } catch { /* ignore */ }
  return defaultSemana();
}

function saveProgramacion(p: ProgramacionSemanaFlexible) {
  localStorage.setItem(STORAGE_KEY_PROGRAMACION, JSON.stringify(p));
}

function loadPerdidos(): DiaProduccionPerdido[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERDIDOS);
    if (raw) return JSON.parse(raw) as DiaProduccionPerdido[];
  } catch { /* ignore */ }
  return [];
}

function savePerdidos(p: DiaProduccionPerdido[]) {
  localStorage.setItem(STORAGE_KEY_PERDIDOS, JSON.stringify(p));
}

// ─── Hook ────────────────────────────────────────────────
export function useProgramacionSemanal() {
  const [programacion, setProgramacionState] = useState<ProgramacionSemanaFlexible>(loadProgramacion);
  const [diasPerdidos, setDiasPerdidosState] = useState<DiaProduccionPerdido[]>(loadPerdidos);

  const setProgramacion = useCallback((updater: (prev: ProgramacionSemanaFlexible) => ProgramacionSemanaFlexible) => {
    setProgramacionState(prev => {
      const next = updater(prev);
      saveProgramacion(next);
      return next;
    });
  }, []);

  const setDiasPerdidos = useCallback((updater: (prev: DiaProduccionPerdido[]) => DiaProduccionPerdido[]) => {
    setDiasPerdidosState(prev => {
      const next = updater(prev);
      savePerdidos(next);
      return next;
    });
  }, []);

  /** Actualizar la capacidad de referencia de un día */
  const setCapacidadDia = useCallback((diaIdx: number, capacidad: number) => {
    setProgramacion(prev => {
      const dias = [...prev.dias];
      dias[diaIdx] = { ...dias[diaIdx], capacidadReferencia: Math.max(0.25, capacidad) };
      return { ...prev, dias, updatedAt: new Date().toISOString() };
    });
  }, [setProgramacion]);

  /** Agregar o actualizar la asignación de una categoría en un día */
  const setAsignacionCategoria = useCallback((
    diaIdx: number,
    categoria: CategoriaProduccion,
    arrobas: number
  ) => {
    setProgramacion(prev => {
      const dias = [...prev.dias];
      const dia = { ...dias[diaIdx] };
      const existente = dia.categorias.findIndex(c => c.categoria === categoria);
      if (arrobas <= 0) {
        // Remove if zero
        dia.categorias = dia.categorias.filter(c => c.categoria !== categoria);
      } else if (existente >= 0) {
        dia.categorias = dia.categorias.map((c, i) =>
          i === existente ? { ...c, arrobas } : c
        );
      } else {
        dia.categorias = [...dia.categorias, { categoria, arrobas }];
      }
      dias[diaIdx] = dia;
      return { ...prev, dias, updatedAt: new Date().toISOString() };
    });
  }, [setProgramacion]);

  /** Eliminar una categoría de un día */
  const eliminarCategoriaDia = useCallback((diaIdx: number, categoria: CategoriaProduccion) => {
    setAsignacionCategoria(diaIdx, categoria, 0);
  }, [setAsignacionCategoria]);

  /** Actualizar notas de un día */
  const setNotasDia = useCallback((diaIdx: number, notas: string) => {
    setProgramacion(prev => {
      const dias = [...prev.dias];
      dias[diaIdx] = { ...dias[diaIdx], notas };
      return { ...prev, dias, updatedAt: new Date().toISOString() };
    });
  }, [setProgramacion]);

  /** Registrar un día de producción perdida */
  const registrarDiaPerdido = useCallback((
    fecha: string,
    diaSemana: number,
    categoriasPerdidas: AsignacionCategoria[]
  ) => {
    if (categoriasPerdidas.length === 0) return;
    const existe = diasPerdidos.find(d => d.fecha === fecha);
    if (existe) return; // ya registrado
    const nuevo: DiaProduccionPerdido = {
      id: generateUUID(),
      fecha,
      diaSemana,
      categoriasPerdidas,
      estado: 'pendiente',
    };
    setDiasPerdidos(prev => [...prev, nuevo]);
  }, [diasPerdidos, setDiasPerdidos]);

  /** Resolver un día perdido con una acción */
  const resolverDiaPerdido = useCallback((
    id: string,
    accion: 'recuperar_hoy' | 'postergar' | 'cancelar'
  ) => {
    setDiasPerdidos(prev =>
      prev.map(d =>
        d.id === id
          ? {
              ...d,
              accionTomada: accion,
              estado: accion === 'cancelar' ? 'cancelado' : 'recuperado_parcial',
              fechaResolucion: new Date().toISOString(),
            }
          : d
      )
    );
  }, [setDiasPerdidos]);

  /** IA: sugerir qué recuperar de un día perdido basándose en velocidadVenta de los modelos */
  const sugerirRecuperacion = useCallback((
    categoriasPerdidas: AsignacionCategoria[],
    // modelos de pan con categoría y velocidadVenta
    modelos: Array<{ categoriaProduccion?: string; velocidadVenta?: string }>,
    diasTranscurridos: number
  ): { recuperar: AsignacionCategoria[]; cancelar: AsignacionCategoria[]; motivo: string } => {
    const recuperar: AsignacionCategoria[] = [];
    const cancelar: AsignacionCategoria[] = [];

    for (const asig of categoriasPerdidas) {
      // Obtener el promedio de velocidad de los modelos de esa categoría
      const modelosCat = modelos.filter(m => m.categoriaProduccion === asig.categoria);
      const tieneEstrella = modelosCat.some(m => m.velocidadVenta === 'estrella' || m.velocidadVenta === 'alta');
      const todosLentos = modelosCat.every(m => m.velocidadVenta === 'baja');

      // Lógica:
      // - 0 días transcurridos (faltó ayer): recuperar si estrella/alta; postergar si media; cancelar si baja
      // - 1 día transcurrido: recuperar solo estrella; cancelar el resto (ya no vale)
      // - 2+ días: cancelar todo
      if (diasTranscurridos >= 2) {
        cancelar.push(asig);
      } else if (diasTranscurridos === 1) {
        if (tieneEstrella && !todosLentos) {
          recuperar.push(asig);
        } else {
          cancelar.push(asig);
        }
      } else {
        // ayer
        if (tieneEstrella) {
          recuperar.push(asig);
        } else if (todosLentos) {
          cancelar.push(asig);
        } else {
          recuperar.push(asig); // media → intentar recuperar hoy
        }
      }
    }

    const motivo = diasTranscurridos >= 2
      ? 'Han pasado 2+ días, el pan ya no vale la pena producirlo.'
      : diasTranscurridos === 1
      ? 'Solo se recuperan los panes de alta demanda (Estrella/Alta). El resto se cancela.'
      : 'Se recupera todo lo de alta rotación. Los de baja venta se cancelan.';

    return { recuperar, cancelar, motivo };
  }, []);

  // ─── Computed ─────────────────────────────────────────
  const hoyIdx = useMemo(() => diaJsToIdx(new Date().getDay()), []);

  const programacionHoy = useMemo(
    () => programacion.dias[hoyIdx] ?? defaultDia(),
    [programacion, hoyIdx]
  );

  const totalArrobasHoy = useMemo(
    () => programacionHoy.categorias.reduce((s, c) => s + c.arrobas, 0),
    [programacionHoy]
  );

  const diasPerdidosPendientes = useMemo(
    () => diasPerdidos.filter(d => d.estado === 'pendiente'),
    [diasPerdidos]
  );

  return {
    programacion,
    diasPerdidos,
    diasPerdidosPendientes,
    hoyIdx,
    programacionHoy,
    totalArrobasHoy,
    // Acciones
    setCapacidadDia,
    setAsignacionCategoria,
    eliminarCategoriaDia,
    setNotasDia,
    registrarDiaPerdido,
    resolverDiaPerdido,
    sugerirRecuperacion,
  };
}
