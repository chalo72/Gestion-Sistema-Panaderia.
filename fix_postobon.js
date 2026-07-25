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

async function fix() {
    console.log('1. Migrating products from "Postobon" to "Postobón"...');
    
    // Update products table
    const { error: updateError, data: updateData } = await supabase
        .from('productos')
        .update({ categoria: 'Postobón' })
        .eq('categoria', 'Postobon')
        .select();
        
    if (updateError) {
        console.error('Error updating products:', updateError);
        return;
    }
    
    console.log(`Successfully migrated ${updateData.length} products.`);

    console.log('2. Removing duplicate category from configuracion...');
    
    const { data: config, error: confError } = await supabase
        .from('configuracion')
        .select('categorias')
        .eq('id', 'main')
        .single();
        
    if (confError) {
        console.error('Config error:', confError);
        return;
    }
    
    const categorias = config.categorias;
    const initialLen = categorias.length;
    const newCategorias = categorias.filter(c => c.id !== 'cat-rec-postobon-1779902658933');
    
    if (newCategorias.length < initialLen) {
        const { error: saveError } = await supabase
            .from('configuracion')
            .update({ categorias: newCategorias })
            .eq('id', 'main');
            
        if (saveError) {
            console.error('Error saving config:', saveError);
        } else {
            console.log(`Successfully removed duplicate category. Config updated (from ${initialLen} to ${newCategorias.length} items).`);
        }
    } else {
        console.log('Duplicate category not found in config.');
    }
    
    console.log('Done.');
}
fix();
