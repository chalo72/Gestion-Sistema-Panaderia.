import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data: products, error } = await supabase.from('productos').select('id, nombre, categoria');
    if (error) {
        console.error(error);
        return;
    }

    const postobonProducts = products.filter(p => p.categoria && (p.categoria.toUpperCase().includes('POSTOBON') || p.categoria.toUpperCase().includes('POSTOBÓN')));
    
    const categoryCounts = {};
    postobonProducts.forEach(p => {
        categoryCounts[p.categoria] = (categoryCounts[p.categoria] || 0) + 1;
    });
    console.log('Product category breakdown:', categoryCounts);
    
    // Check config
    const { data: config, error: confError } = await supabase.from('configuracion').select('categorias').eq('id', 'main').single();
    if (confError) {
        console.error('Config error:', confError);
    } else {
        console.log('Categories in config:', config?.categorias);
    }
}
check();
