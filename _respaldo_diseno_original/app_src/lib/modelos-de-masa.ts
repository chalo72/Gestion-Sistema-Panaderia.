/**
 * Lista de panes de una masa — misma lógica en PC (Auditoría) y celular (Plan día).
 * El celular a menudo tiene otro UUID para «Masa de Dulce Especial» que la PC;
 * si paramos al primer formulacionId coincidente, el listado queda en 1 pan.
 */

export type ModeloPanLista = {
  id: string;
  nombre: string;
  formulacionId?: string;
  activo?: boolean;
  pesoUnitarioGr?: number;
  piezasPorLata?: number;
};

export type FormLista = {
  id: string;
  nombre?: string;
  mixProduccion?: Array<{ modeloPanId?: string }>;
};

export type OrigenListaPanes = 'formulacion' | 'mix' | 'union' | 'todos' | 'vacio';

export function normalizarNombreMasa(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** IDs de todas las formulaciones con el mismo nombre (PC vs celular). */
export function idsMasasEquivalentes(
  formId: string,
  formulaciones: Array<{ id?: string; nombre?: string }> | undefined,
  nombreFallback?: string,
): Set<string> {
  const ids = new Set<string>([formId]);
  const lista = formulaciones || [];
  const sel = lista.find((f) => f.id === formId);
  const targetNombre = sel?.nombre || nombreFallback;
  if (!targetNombre) return ids;
  const n = normalizarNombreMasa(targetNombre);
  for (const f of lista) {
    if (f.id && f.nombre && normalizarNombreMasa(f.nombre) === n) ids.add(f.id);
  }
  return ids;
}

export function resolverModelosDeMasa(
  formCorr: FormLista | null | undefined,
  modelosPan: ModeloPanLista[] | undefined,
  todasFormulaciones?: FormLista[],
): { modelos: ModeloPanLista[]; origen: OrigenListaPanes } {
  const activos = (modelosPan || []).filter((m) => m && m.id && m.nombre && m.activo !== false);
  const ordenar = (arr: ModeloPanLista[]) =>
    arr.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

  if (!formCorr?.id) {
    return { modelos: ordenar(activos), origen: activos.length ? 'todos' : 'vacio' };
  }

  const idsMasa = idsMasasEquivalentes(
    formCorr.id,
    todasFormulaciones?.length ? todasFormulaciones : [formCorr],
    formCorr.nombre,
  );
  const porId = activos.filter((m) => m.formulacionId && idsMasa.has(m.formulacionId));

  const mixIds = new Set<string>();
  const formas = (todasFormulaciones || []).filter((f) => f.id && idsMasa.has(f.id));
  const fuentesMix = formas.length > 0 ? formas : [formCorr];
  for (const f of fuentesMix) {
    for (const x of f.mixProduccion || []) {
      if (x?.modeloPanId) mixIds.add(x.modeloPanId);
    }
  }
  const porMix = activos.filter((m) => mixIds.has(m.id));

  const unionMap = new Map<string, ModeloPanLista>();
  for (const m of [...porId, ...porMix]) unionMap.set(m.id, m);
  const union = Array.from(unionMap.values());

  if (union.length > 0) {
    const origen: OrigenListaPanes =
      porId.length > 0 && porMix.length > 0 && union.length > porId.length ? 'union' : porId.length > 0 ? 'formulacion' : 'mix';
    return { modelos: ordenar(union), origen };
  }

  return { modelos: ordenar(activos), origen: activos.length ? 'todos' : 'vacio' };
}
