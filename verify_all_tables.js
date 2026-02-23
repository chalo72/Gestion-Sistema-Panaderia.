import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const tables = [
    'usuarios', 'productos', 'proveedores', 'precios',
    'inventario', 'movimientos', 'prepedidos', 'prepedido_items',
    'historial_precios', 'configuracion', 'alertas', 'recepciones'
];

async function checkTables() {
    console.log('--- Verificando Tablas en Supabase ---');
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`❌ Tabla '${table}': ERROR - ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`✅ Tabla '${table}': EXISTE`);
        }
    }
}

checkTables();
