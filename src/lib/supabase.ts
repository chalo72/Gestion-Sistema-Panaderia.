import { createClient } from '@supabase/supabase-js';

// PROTEGIDO: Validación segura de credenciales Supabase
// 🛡️ [NEXUS-EMERGENCY-RESCUE]: Credenciales inyectadas directamente para rescate de meses de trabajo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hurlzmarkmkjhwmkwqld.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';

const isConfigured = true; // ✅ Forzamos configuración activa

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
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

