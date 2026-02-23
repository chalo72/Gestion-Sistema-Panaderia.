
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurlzmarkmkjhwmkwqld.supabase.co';
const supabaseAnonKey = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('--- Verificando Usuarios en Supabase ---');
    try {
        const { data, error } = await supabase.from('usuarios').select('email, rol, nombre');
        if (error) {
            console.error('❌ Error:', error.message);
        } else {
            console.log('✅ Usuarios encontrados:', data.length);
            data.forEach(u => console.log(`   - ${u.email} [${u.rol}] - ${u.nombre}`));
        }
    } catch (err) {
        console.error('❌ Error inesperado:', err.message);
    }
}

check();
