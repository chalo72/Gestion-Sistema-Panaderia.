-- Historial de cada crédito/préstamo de trabajadoras (2026-11-18, AUTORIZO Gonzalo):
-- quién lo creó o cambió, desde qué aparato, fecha y hora, cobros y posposiciones.
-- APLICADA en Supabase el 2026-11-18.
alter table public.creditos_trabajadores add column if not exists historial jsonb;
