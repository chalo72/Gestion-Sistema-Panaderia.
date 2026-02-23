
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Faltan variables de entorno.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('--- Iniciando Verificación de Conexión ---');
    console.log('URL:', supabaseUrl);

    try {
        // 1. Probar conexión básica (leer una tabla)
        console.log('1. Probando lectura de tabla "usuarios"...');
        const { data, error } = await supabase.from('usuarios').select('email, rol').limit(5);

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ Conexión establecida, pero la tabla "usuarios" parece estar vacía o no tener registros públicos.');
            } else {
                console.error('❌ Error al consultar la tabla:', error.message);
                console.log('Posibles causas: La tabla no existe, o las políticas RLS bloquean el acceso anónimo.');
            }
        } else {
            console.log('✅ Conexión Exitosa. Usuarios encontrados:', data.length);
            data.forEach(u => console.log(`   - ${u.email} (${u.rol})`));
        }

        // 2. Verificar esquema
        console.log('\n2. Verificando tablas críticas...');
        const tables = ['productos', 'proveedores', 'precios', 'configuracion'];
        for (const table of tables) {
            const { error: tableError } = await supabase.from(table).select('id').limit(1);
            if (tableError) {
                console.log(`   ⚠️ Tabla "${table}": No accesible o no existe (${tableError.message})`);
            } else {
                console.log(`   ✅ Tabla "${table}": OK`);
            }
        }

    } catch (err) {
        console.error('❌ Error inesperado:', err.message);
    }
}

check();
