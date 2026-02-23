import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key.trim()] = value.trim().split(' ')[0];
    }
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testAuth() {
    console.log('Probando Auth con:', env.VITE_SUPABASE_URL);
    console.log('Email: Chalo8321@gmail.com');

    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'Chalo8321@gmail.com',
        password: 'password123' // Suponiendo esta contraseña por defecto o la que use el usuario
    });

    if (error) {
        console.error('❌ Error de Autenticación:', error.message);
        console.error('Status:', error.status);
    } else {
        console.log('✅ Auth Exitosa!');
        console.log('User ID:', data.user.id);
        console.log('Session exists:', !!data.session);
    }
}

testAuth();
