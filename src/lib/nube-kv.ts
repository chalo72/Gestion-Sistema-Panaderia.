/**
 * Lectura/escritura DIRECTA en la nube (tabla `configuracion`, igual que db.saveBackup).
 *
 * Por qué existe: `db.getBackup(key)` devuelve la copia LOCAL si ya existe y solo consulta
 * la nube cuando no hay nada local. Para datos compartidos entre aparatos (pedidos de tortas,
 * equipo del turno, rutas, auditoría) eso significa que nunca se bajan los cambios de otro
 * celular. Esto lee siempre de la nube.
 */
export interface DbRespaldo {
    getBackup(key: string): Promise<any>;
    saveBackup(key: string, val: any): Promise<void>;
}

async function cliente() {
    const m = await import('./supabase');
    return m.supabase as any;
}

export async function leerNube(key: string): Promise<any> {
    const sb = await cliente();
    const { data, error } = await sb.from('configuracion').select('categorias').eq('id', key).maybeSingle();
    if (error) throw error;
    return data ? data.categorias : null;
}

export async function guardarNubeKv(key: string, val: any): Promise<void> {
    const sb = await cliente();
    const payload = Array.isArray(val) ? val : (val && typeof val === 'object' ? val : [val]);
    const { error } = await sb.from('configuracion').upsert({ id: key, categorias: payload });
    if (error) throw error;
}

/** Adaptador con la misma forma que `db` para los módulos que ya usan getBackup/saveBackup. */
export const dbNube: DbRespaldo = {
    getBackup: leerNube,
    saveBackup: guardarNubeKv,
};
