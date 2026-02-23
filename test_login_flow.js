import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testFullLoginFlow() {
    const email = 'Chalo8321@gmail.com';
    const password = 'password123';

    console.log(`--- Probando Flujo de Acceso para: ${email} ---`);

    // 1. Probar Autenticación
    console.log('1. Intentando signInWithPassword...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (authError) {
        console.error('❌ Error de Autenticación:', authError.message);
        return;
    }

    console.log('✅ Autenticación exitosa. User ID:', authData.user.id);

    // 2. Probar acceso a la tabla 'usuarios' (Perfil)
    console.log('2. Buscando perfil en tabla public.usuarios...');
    const { data: profileData, error: profileError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        if (profileError.code === 'PGRST116') {
            console.warn('⚠️ Perfil no encontrado en la tabla usuarios (pero el login fue OK).');
        } else {
            console.error('❌ Error accediendo a tabla usuarios:', profileError.message);
        }
    } else {
        console.log('✅ Perfil encontrado:', JSON.stringify(profileData, null, 2));
    }

    // 3. Probar acceso a otra tabla (ej: productos) para verificar RLS
    console.log('3. Verificando RLS (acceso a tabla productos)...');
    const { data: prodData, error: prodError } = await supabase
        .from('productos')
        .select('*')
        .limit(1);

    if (prodError) {
        console.error('❌ Error accediendo a productos (RLS?):', prodError.message);
    } else {
        console.log('✅ Acceso a productos OK. Registros encontrados:', prodData.length);
    }

    console.log('--- Fin del test ---');
}

testFullLoginFlow();
