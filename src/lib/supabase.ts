import { createClient } from '@supabase/supabase-js';

// PROTEGIDO: Validación segura de credenciales Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
    console.warn('[Supabase] Variables de entorno no configuradas. Modo offline activo.');
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);

// Indicador para que otros módulos sepan si Supabase está disponible
export const isSupabaseConfigured = isConfigured;

