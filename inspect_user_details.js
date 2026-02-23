import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectUser() {
    console.log('--- Inspeccionando usuario Chalo8321@gmail.com ---');
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', 'Chalo8321@gmail.com')
        .single();

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Registro en public.usuarios:', JSON.stringify(data, null, 2));
    }
}

inspectUser();
