import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        const val = value.trim();
        // Remove trailing commas or comments if they exist
        acc[key.trim()] = val.split(' ')[0];
    }
    return acc;
}, {});

console.log('Probando conexión con:', env.VITE_SUPABASE_URL);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkConnection() {
    console.log('Consultando tabla usuarios...');
    const { data, error } = await supabase.from('usuarios').select('*').limit(5);

    if (error) {
        console.error('❌ Error en query simple:', error.message);
        console.error('Código del error:', error.code);
    } else {
        console.log('✅ Conexión exitosa a tabla usuarios. Filas:', data.length);
        console.log('Datos:', JSON.stringify(data, null, 2));
    }
}


checkConnection();
