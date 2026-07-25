export interface MetaInversion {
  id: string;
  nombre: string;
  objetivo: number;
  acumulado: number;
  fechaCreacion: string;
  estado: 'activa' | 'completada';
}

const STORAGE_KEY = 'dulce_placer_metas_inversion';

export const getMetasInversion = (): MetaInversion[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveMetasInversion = (metas: MetaInversion[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metas));
};

export const addMetaInversion = (meta: Omit<MetaInversion, 'id' | 'acumulado' | 'fechaCreacion' | 'estado'>) => {
  const metas = getMetasInversion();
  const nuevaMeta: MetaInversion = {
    ...meta,
    id: crypto.randomUUID(),
    acumulado: 0,
    fechaCreacion: new Date().toISOString(),
    estado: 'activa'
  };
  saveMetasInversion([...metas, nuevaMeta]);
  return nuevaMeta;
};

export const aportarAMeta = (id: string, monto: number) => {
  const metas = getMetasInversion();
  const updated = metas.map(m => {
    if (m.id === id) {
      const nuevoAcumulado = m.acumulado + monto;
      return {
        ...m,
        acumulado: nuevoAcumulado,
        estado: nuevoAcumulado >= m.objetivo ? 'completada' : 'activa'
      };
    }
    return m;
  });
  saveMetasInversion(updated);
};

export const deleteMetaInversion = (id: string) => {
  const metas = getMetasInversion();
  saveMetasInversion(metas.filter(m => m.id !== id));
};
