import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('🚨 ERROR CRÍTICO: Faltan variables de entorno de Supabase.');
    console.log('Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén configuradas en Netlify.');
} else {
    console.log('✅ Supabase configurado con URL:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

