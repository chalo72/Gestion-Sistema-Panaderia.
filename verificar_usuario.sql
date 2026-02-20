-- 🔍 PRICECONTROL PRO - VERIFICACIÓN DE USUARIO
-- Copia y corre esto en el SQL Editor para ver si el usuario realmente existe

SELECT 
    u.id, 
    u.email, 
    u.role as auth_role, 
    p.rol as app_role,
    p.activo,
    u.email_confirmed_at
FROM auth.users u
LEFT JOIN public.usuarios p ON u.id = p.id
WHERE u.email = 'Chalo8321@gmail.com'; -- 👈 Asegúrate que coincida
