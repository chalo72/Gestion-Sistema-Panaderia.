import { createClient } from '@supabase/supabase-js';

// PROTEGIDO: Validación segura de credenciales Supabase
// 🛡️ [ANTIGRAVITY-SECURITY]: Exigir credenciales desde .env (sin hardcode inseguro)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔐 Validación: si no están configuradas, error explícito
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        '❌ [SECURITY] Supabase credentials missing!\n' +
        'Configura en .env:\n' +
        '  VITE_SUPABASE_URL=tu_url\n' +
        '  VITE_SUPABASE_ANON_KEY=tu_key'
    );
}

const isConfigured = true; // ✅ Validado en build time

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

