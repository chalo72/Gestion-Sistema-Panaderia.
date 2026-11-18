-- Precio de venta del paquete completo en el Punto de Venta (2026-11-18, AUTORIZO Gonzalo).
-- Vacío = el producto se vende solo por unidad. APLICADA en Supabase el 2026-11-18.
alter table public.productos add column if not exists precio_venta_paquete numeric;
