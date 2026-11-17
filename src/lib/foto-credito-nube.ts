import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * La lista de Consumo y Préstamos ya no descarga las fotos (2026-11-16): eran casi 10 MB
 * y saturaban la nube. La foto de un registro se trae solo cuando se toca.
 */
export const fotoCreditoTrabajadorDesdeNube = async (id: string): Promise<string | null> => {
  if (!isSupabaseConfigured || !id) return null;
  const { data, error } = await supabase
    .from('creditos_trabajadores')
    .select('foto_evidencia')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data?.foto_evidencia as string | null) || null;
};
